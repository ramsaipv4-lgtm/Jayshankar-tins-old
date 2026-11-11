
// Capture the 6 real-effort variants at phone + desktop viewports.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './docs/design-sample/variants-real/screenshots';
mkdirSync(OUT, { recursive: true });

const VIEW_PORTS = {
  desktop: { width: 1440, height: 900 },
  phone:   { width: 390,  height: 844 },
};

const VARIANTS = [
  'A1-floor-picklist',
  'A2-field-sale',
  'B1-floor-picklist',
  'B2-field-sale',
  'C1-floor-picklist',
  'C2-field-sale',
];

const browser = await chromium.launch({ headless: true });
try {
  for (const name of VARIANTS) {
    for (const [vpName, vp] of Object.entries(VIEW_PORTS)) {
      const ctx = await browser.newContext({ viewport: vp, locale: 'en-US' });
      const page = await ctx.newPage();
      const url = `file:///${process.cwd().replace(/\\/g,'/')}/docs/design-sample/variants-real/${name}.html`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.screenshot({ path: join(OUT, `${vpName}-${name}.png`) });
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
