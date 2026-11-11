// lib.mjs — shared Playwright recording helpers, factored out of record-composites.mjs once
// the same hard-won fixes (signOutIn's hash-route staleness, typeInto's pre-filled-field
// collision, selectByExactPrefix's substring trap) were about to be copy-pasted into every
// new recording script for the remaining single-action scenarios.

import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

export const BASE = 'http://localhost:5173';
export const OUT_DIR = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/raw-recordings';
mkdirSync(OUT_DIR, { recursive: true });

export const CREDS = {
  admin: ['admin@jayshankar.demo', 'DevPassword123!'],
  rep: ['rep@jayshankar.demo', 'DevPassword123!'],
  worker: ['worker@jayshankar.demo', 'DevPassword123!'],
};

export async function signOutIn(page, who, { first = false } = {}) {
  const [email, password] = CREDS[who];
  if (!first) {
    await page.click('button:has-text("Sign out")');
    await page.waitForTimeout(700);
  } else {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(400);
  await page.click('#identifier');
  await page.type('#identifier', email, { delay: 45 });
  await page.waitForTimeout(200);
  await page.click('#password');
  await page.type('#password', password, { delay: 45 });
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  // Not waitForURL: HashRouter keeps whatever route was showing across a sign-out/sign-in
  // cycle, and most routes allow every role, so nothing forces a redirect to /admin, /rep or
  // /floor. Waiting for the header's "Sign out" button is what's actually true regardless of
  // which route it lands back on.
  await page.waitForSelector('button:has-text("Sign out")', { timeout: 10000 });
  await page.waitForTimeout(900);
}

export async function typeInto(page, selector, text, opts = {}) {
  await page.click(selector);
  await page.waitForTimeout(150);
  // Several forms pre-fill a field from real state (e.g. a payment amount defaulting to the
  // sale's own balance) -- page.type() inserts at the cursor rather than replacing, so typing
  // into an already-filled field silently produces a wrong, doubled value. Clearing first
  // (instant, invisible) keeps the visible per-character type animation while guaranteeing the
  // field ends up holding exactly what we typed.
  await page.fill(selector, '');
  await page.type(selector, text, { delay: opts.delay ?? 70 });
  await page.waitForTimeout(350);
}

export async function selectByText(page, selector, text) {
  const value = await page.locator(`${selector} option`, { hasText: text }).first().getAttribute('value');
  await page.selectOption(selector, value);
  await page.waitForTimeout(500);
}

// selectByExactPrefix — for names that collide as substrings of a longer, alphabetically
// earlier name (e.g. "Seer fish" vs "Medium Seer Fish"). Every SKU/location option here is
// "Name (code)" or "Name — extra", so anchoring at the start is exact enough without needing
// the full suffix.
export async function selectByExactPrefix(page, selector, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = await page.locator(`${selector} option`, { hasText: new RegExp(`^${escaped}\\s*[(—]|^${escaped}$`, 'i') }).first().getAttribute('value');
  await page.selectOption(selector, value);
  await page.waitForTimeout(500);
}

export async function newRecordingContext(browser) {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
  });
}

export async function finish(page, context, filename) {
  await context.close();
  const videoPath = await page.video().path();
  const dest = path.join(OUT_DIR, filename);
  renameSync(videoPath, dest);
  console.log('saved', dest);
}

export async function launchBrowser() {
  return chromium.launch();
}

// runScenarios — shared CLI entrypoint: `node some-script.mjs 9 10` runs only those, no args
// runs everything in the map, in definition order.
export async function runScenarios(scenarioMap) {
  const browser = await launchBrowser();
  const requested = process.argv.slice(2).map(Number).filter((n) => scenarioMap[n]);
  const toRun = requested.length ? requested : Object.keys(scenarioMap).map(Number);
  for (const n of toRun) {
    console.log(`\n=== scenario ${n} ===`);
    await scenarioMap[n](browser);
  }
  await browser.close();
  console.log('\ndone.');
}
