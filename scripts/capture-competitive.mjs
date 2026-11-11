
// Capture 6 closest competitors at desktop + phone, key product surfaces.
// Many will 404 / cookie-wall / fail — the captured set is what it is.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './docs/design-sample/competitive';
mkdirSync(OUT, { recursive: true });

const VIEW_PORTS = {
  desktop: { width: 1440, height: 900 },
  phone:   { width: 390,  height: 844 },
};

// Each target is a known URL surface, with the URL pattern + the page label.
const TARGETS = [
  // 1. Vyapar — your stated comparator.
  { name: 'vyapar-home',          url: 'https://vyaparapp.in/' },
  { name: 'vyapar-inventory',     url: 'https://vyaparapp.in/free/inventory-management-software' },
  { name: 'vyapar-gst',           url: 'https://vyaparapp.in/gst-accounting-pc' },
  { name: 'vyapar-play-store',    url: 'https://play.google.com/store/apps/details?id=in.android.vyapar' },

  // 2. Zoho Inventory — SMB cloud inventory, India GST-ready.
  { name: 'zoho-inv-home',        url: 'https://www.zoho.com/inventory/' },
  { name: 'zoho-inv-features',    url: 'https://www.zoho.com/inventory/features/' },
  { name: 'zoho-inv-pricing',     url: 'https://www.zoho.com/inventory/pricing/' },

  // 3. Unleashed Software — wholesale / food & bev, has the expiry-due dashboard.
  { name: 'unleashed-home',       url: 'https://www.unleashedsoftware.com/' },
  { name: 'unleashed-inventory',  url: 'https://www.unleashedsoftware.com/product/inventory-management-software/' },
  { name: 'unleashed-warehouse',  url: 'https://www.unleashedsoftware.com/product/warehouse-management-system/' },

  // 4. inFlow Inventory — mobile-first.
  { name: 'inflow-home',          url: 'https://www.inflowinventory.com/' },
  { name: 'inflow-features',      url: 'https://www.inflowinventory.com/features/' },

  // 5. Sortly — mobile-first photo inventory, the closest to "phone is the primary tool."
  { name: 'sortly-home',          url: 'https://www.sortly.com/' },
  { name: 'sortly-features',      url: 'https://www.sortly.com/features/' },

  // 6. MarketMan — restaurant-vendor ordering; their white-label mobile-distributor app
  //    is the only real precedent for D28's "one mobile app" architecture.
  { name: 'marketman-product',    url: 'https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management' },
  { name: 'marketman-home',       url: 'https://www.marketman.com/' },
];

const browser = await chromium.launch({ headless: true });
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const success = [];
const failed = [];

for (const t of TARGETS) {
  for (const [vpName, vp] of Object.entries(VIEW_PORTS)) {
    const ctx = await browser.newContext({
      viewport: vp,
      userAgent,
      locale: 'en-US',
      // Allow common cookie/analytics scripts; we don't need them to render.
    });
    const page = await ctx.newPage();
    const fname = `${vpName}-${t.name}.png`;
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // let JS hydrate
      await page.waitForTimeout(2500);
      // Best-effort cookie-banner dismiss.
      await page.evaluate(() => {
        const sels = [
          'button[aria-label*="Accept" i]',
          'button[aria-label*="Accept all" i]',
          'button[aria-label*="I agree" i]',
          'button:has-text("Accept")',
          'button:has-text("Accept All")',
          'button:has-text("I Accept")',
          'button:has-text("I Agree")',
          'button:has-text("Allow All")',
          'button:has-text("Got it")',
        ];
        for (const sel of sels) {
          try {
            for (const b of document.querySelectorAll(sel)) {
              if (b && b.offsetParent !== null) { b.click(); }
            }
          } catch {}
        }
      });
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(OUT, fname), fullPage: false });
      success.push({ name: t.name, vp: vpName, url: t.url });
      console.log(`  OK   ${vpName}/${t.name}`);
    } catch (e) {
      failed.push({ name: t.name, vp: vpName, url: t.url, err: e.message.split('\n')[0] });
      console.log(`  FAIL ${vpName}/${t.name}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}

await browser.close();
console.log(`\nSUMMARY: ${success.length} OK, ${failed.length} FAIL`);
