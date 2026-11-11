#!/usr/bin/env node
// perf-check.mjs — §8.6's low-end-Android performance targets, automated.
//
// NOT part of the validate gate (scripts/ is otherwise zero-dependency by house rule — this is
// the one deliberate exception, since it's a developer tool for repeatable perf measurement,
// not part of the release gate itself). Uses Playwright + a real headless Chromium, throttled
// via the Chrome DevTools Protocol the exact same way Chrome DevTools' own "4x/10x CPU
// slowdown" + "Slow 4G" presets work — this is the standard, industry technique for
// approximating low-end-device performance from a desktop, not a shortcut: the thing that
// actually matters for a web app's perceived performance is CPU cycles and network conditions,
// not the underlying silicon, so a real device VM buys little a throttled headless browser
// doesn't already give you.
//
// Usage:
//   node scripts/perf-check.mjs <url> [--cpu=10.3] [--route=/admin]
//   node scripts/perf-check.mjs https://your-site.netlify.app --cpu=10.3 --route=/
//
// Network preset matches Chrome DevTools' own "Slow 4G": 400 Kb/s down/up, 400ms latency —
// re-verify these numbers if this file is more than a year or two old; DevTools' presets have
// changed before.

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const cpuArg = args.find((a) => a.startsWith('--cpu='));
const routeArg = args.find((a) => a.startsWith('--route='));
const cpuRate = cpuArg ? Number(cpuArg.split('=')[1]) : 10.3;
const route = routeArg ? routeArg.split('=')[1] : '/';

if (!url) {
  console.error('Usage: node scripts/perf-check.mjs <url> [--cpu=10.3] [--route=/admin]');
  process.exit(1);
}

const target = new URL(route, url).toString();

const SLOW_4G = {
  offline: false,
  downloadThroughput: (400 * 1024) / 8, // 400 Kb/s
  uploadThroughput: (400 * 1024) / 8,
  latency: 400, // ms
};

console.log(`Navigating to ${target}`);
console.log(`CPU throttle: ${cpuRate}x slowdown · Network: Slow 4G (400 Kb/s, 400ms latency)\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);

await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

const start = Date.now();
await page.goto(target, { waitUntil: 'load', timeout: 60_000 });
const loadMs = Date.now() - start;
// This is a client-rendered SPA (Vite/React) — 'load' fires once the HTML shell and JS bundle
// are fetched, but React's own render (and the paint entries that come with it) can land a beat
// later, especially under CPU throttling. A short settle wait avoids reading paint metrics
// before they exist, found live: without this, firstPaint/FCP/LCP all came back null on the
// very first run of this script against a real throttled page.
await page.waitForTimeout(1000);

// Real paint timings from the browser's own Performance API — the same numbers Chrome
// DevTools' own Performance panel and Lighthouse report, not a reimplementation.
const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]));
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  return {
    domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
    firstPaint: paint['first-paint'] ?? null,
    firstContentfulPaint: paint['first-contentful-paint'] ?? null,
    largestContentfulPaint: lcpEntries.length ? lcpEntries[lcpEntries.length - 1].startTime : null,
  };
});

await browser.close();

console.log('Results:');
console.log(`  Full page load:              ${loadMs} ms`);
if (metrics.domContentLoaded != null) console.log(`  DOM content loaded:          ${metrics.domContentLoaded.toFixed(0)} ms`);
if (metrics.firstPaint != null) console.log(`  First paint:                 ${metrics.firstPaint.toFixed(0)} ms`);
if (metrics.firstContentfulPaint != null) console.log(`  First contentful paint:      ${metrics.firstContentfulPaint.toFixed(0)} ms`);
if (metrics.largestContentfulPaint != null) console.log(`  Largest contentful paint:    ${metrics.largestContentfulPaint.toFixed(0)} ms`);

if (metrics.largestContentfulPaint == null) {
  console.log('\n  Largest contentful paint:    (no entry — headless Chrome often needs a real');
  console.log('                                visibility change to finalize LCP; first-contentful-');
  console.log('                                paint above is the reliable number in headless runs)');
}

console.log('\nSPEC.md §8.6 targets: admin dashboard ≤ 2000ms, /floor ≤ 1500ms (both "renders" —');
console.log('treat first-contentful-paint as the closest reliable proxy in a headless run, full');
console.log('page load as the upper bound including background requests).');
