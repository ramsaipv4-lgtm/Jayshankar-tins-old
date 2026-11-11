
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './docs/design-sample/variants/screenshots';
mkdirSync(OUT, { recursive: true });

const VIEW_PORTS = {
  desktop: { width: 1440, height: 900 },
  phone:   { width: 390,  height: 844 },
};

const VARIANTS = [
  'A1-rep-dashboard',
  'A2-pack-form',
  'B1-rep-dashboard',
  'B2-pack-form',
  'C1-rep-dashboard',
  'C2-pack-form',
];

const browser = await chromium.launch({ headless: true });
try {
  for (const name of VARIANTS) {
    for (const [vpName, vp] of Object.entries(VIEW_PORTS)) {
      const ctx = await browser.newContext({ viewport: vp, locale: 'en-US' });
      const page = await ctx.newPage();
      const url = `file:///${process.cwd().replace(/\\\\/g,'/')}/docs/design-sample/variants/${name}.html`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        // Wait for fonts to load (Google Fonts) so first paint is the real design.
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const out = join(OUT, `${vpName}-${name}.png`);
        await page.screenshot({ path: out, fullPage: false });
        console.log(`  OK  ${vpName}/${name}`);
      } catch (e) {
        console.log(`  FAIL ${vpName}/${name}: ${e.message.split("\\n")[0]}`);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
