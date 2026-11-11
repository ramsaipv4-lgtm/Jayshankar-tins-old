// Capture the field-tooling references for the real-effort pass.
// Replaces the safe SaaS-template set from the prior pass with the apps whose
// information architecture actually matches Jayshankar's operating environment.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './docs/design-sample/field-references';
mkdirSync(OUT, { recursive: true });

const VIEW_PORTS = {
  desktop: { width: 1440, height: 900 },
  phone:   { width: 390,  height: 844 },
};

const TARGETS = [
  // Field service — same one-hand, glove-finger, low-light reality as fish warehouse.
  { name: 'servicetitan-mobile',     url: 'https://www.servicetitan.com/products/mobile/' },
  { name: 'jobber-mobile',           url: 'https://getjobber.com/products/mobile-field-service-app/' },
  // Last-mile delivery driver — pickup/drive/drop matches floor worker's day.
  { name: 'onfleet-driver-app',      url: 'https://onfleet.com/products/driver-app/' },
  { name: 'bringg-driver',           url: 'https://www.bringg.com/driver-app/' },
  // Kitchen-display-system — closest aesthetic match: cold room, one tap per row, scannable from 1m.
  { name: 'toast-kds',               url: 'https://pos.toasttab.com/products/hardware/kitchen-display-system' },
  { name: 'square-kds',              url: 'https://squareup.com/us/en/point-of-sale/restaurants' },
  // Last-mile tracking in picker mode — scan/go.
  { name: 'aftership-tracking',      url: 'https://www.aftership.com/' },
  // Gig picker — one-handed, QR-scan-and-go.
  { name: 'dunzo-business',          url: 'https://www.dunzo.com/business' },
  // Anti-reference: spreadsheets-on-phone (failure mode).
  { name: 'sheet-mobile',            url: 'https://www.google.com/sheets/about/' },
  // Two design-system refs (still useful for admin/rep, not for worker).
  { name: 'linear-app',              url: 'https://linear.app/' },
  { name: 'notion-software',         url: 'https://www.notion.so/product' },
];

const browser = await chromium.launch({ headless: true });
const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
let ok = 0, fail = 0;
for (const t of TARGETS) {
  for (const [vpName, vp] of Object.entries(VIEW_PORTS)) {
    const ctx = await browser.newContext({ viewport: vp, userAgent: ua, locale: 'en-US' });
    const page = await ctx.newPage();
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);
      // Best-effort cookie dismiss.
      await page.evaluate(() => {
        const sels = [
          'button[aria-label*="Accept" i]',
          'button[aria-label*="Accept all" i]',
          'button:has-text("Accept")',
          'button:has-text("I Accept")',
          'button:has-text("Allow All")',
          'button:has-text("Got it")',
        ];
        for (const sel of sels) {
          try {
            for (const b of document.querySelectorAll(sel)) if (b.offsetParent !== null) b.click();
          } catch {}
        }
      });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(OUT, `${vpName}-${t.name}.png`) });
      ok++;
      console.log(`  OK    ${vpName}/${t.name}`);
    } catch (e) {
      fail++;
      console.log(`  FAIL  ${vpName}/${t.name}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\nSUMMARY: ${ok} OK, ${fail} FAIL`);
