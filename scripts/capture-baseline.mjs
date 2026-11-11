
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './docs/design-sample/baseline';
mkdirSync(OUT, { recursive: true });

const VIEW_PORTS = {
  desktop: { width: 1440, height: 900 },
  phone:   { width: 390,  height: 844 },   // iPhone 14
  tablet:  { width: 834,  height: 1112 },  // iPad-ish
};

const BASE = 'http://localhost:5180';

// Routes are hash-based per D-spec. Plain GET to /path will not navigate in-app
// (decision #88 caught this). For captures the relevant URL is the bare base.
const ROUTES = [
  { name: '00-base-load', hash: '' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [vpName, vp] of Object.entries(VIEW_PORTS)) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'en-US' });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      try {
        await page.goto(BASE + '/' + (r.hash ? '#/' + r.hash : ''), { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2500); // let React hydrate
        await page.screenshot({ path: join(OUT, `${vpName}-${r.name}.png`), fullPage: false });
        // Also a full-page screenshot to capture what the user sees on scroll.
        await page.evaluate(async () => {
          for (let y = 0; y <= document.body.scrollHeight; y += 600) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await new Promise(r => setTimeout(r, 80));
          }
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise(r => setTimeout(r, 400));
        });
        await page.screenshot({ path: join(OUT, `${vpName}-${r.name}-full.png`), fullPage: true });
        console.log(`  ${vpName}/${r.name}  OK`);
      } catch (e) {
        console.log(`  ${vpName}/${r.name}  FAIL: ${e.message.split("\n")[0]}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
