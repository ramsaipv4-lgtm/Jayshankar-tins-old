import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/captures';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('captured', name, '·', page.url());
}

async function signInFresh(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#identifier', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|rep|floor)/, { timeout: 10000 });
  await page.waitForTimeout(800);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE, { waitUntil: 'networkidle' });
await shot(page, '01-signin');

await signInFresh(page, 'admin@jayshankar.demo', 'DevPassword123!');
await shot(page, '02-admin-dashboard');

await page.click('a:has-text("Bills")');
await page.waitForTimeout(700);
await shot(page, '03-bills-reconciliation');

const bellBtn = page.locator('button[aria-label*="Notifications"]');
if (await bellBtn.count() > 0) { await bellBtn.first().click(); await page.waitForTimeout(500); }
await shot(page, '04-notifications');
const overlay = page.locator('div.fixed.inset-0.z-10');
if (await overlay.count() > 0) { await overlay.first().click(); await page.waitForTimeout(300); }

async function backToAdmin(page) {
  await page.click('a:has-text("Back to admin dashboard")');
  await page.waitForTimeout(600);
}

await backToAdmin(page);
await page.click('a:has-text("Reversals")');
await page.waitForTimeout(700);
await shot(page, '05-reversals');

await backToAdmin(page);
await page.click('a:has-text("Confirm arrivals")');
await page.waitForTimeout(700);
await shot(page, '06-confirm-arrivals');

await backToAdmin(page);
await page.click('a:has-text("Complaints")');
await page.waitForTimeout(700);
await shot(page, '06b-complaints');

await signInFresh(page, 'rep@jayshankar.demo', 'DevPassword123!');
await shot(page, '07-rep-dashboard');

await page.click('a:has-text("+ Delivery")');
await page.waitForTimeout(700);
await shot(page, '08-deliver-form');

await page.goBack({ waitUntil: 'networkidle' });
await page.click('a:has-text("Pack container")');
await page.waitForTimeout(700);
await shot(page, '09-pack-form');

await page.goBack({ waitUntil: 'networkidle' });
await page.click('a:has-text("+ Sale")');
await page.waitForTimeout(700);
await shot(page, '10-sell-form');

await page.goBack({ waitUntil: 'networkidle' });
await page.click('a:has-text("My tasks")');
await page.waitForTimeout(700);
await shot(page, '11-my-tasks-rep');

await signInFresh(page, 'worker@jayshankar.demo', 'DevPassword123!');
await shot(page, '12-floor-dashboard');

await page.click('a:has-text("+ Repack")');
await page.waitForTimeout(700);
await shot(page, '13-repack-form');

await page.goBack({ waitUntil: 'networkidle' });
await page.click('a:has-text("My tasks")');
await page.waitForTimeout(700);
await shot(page, '14-my-tasks-worker');

await browser.close();
console.log('\ndone.');
