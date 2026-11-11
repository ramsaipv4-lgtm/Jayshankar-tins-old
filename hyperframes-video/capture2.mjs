import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/captures2';
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
async function toAdmin(page) {
  const cancelBtn = page.locator('button', { hasText: 'Cancel' });
  if (await cancelBtn.count() > 0) { await cancelBtn.first().click(); await page.waitForTimeout(400); }
  const backLink = page.locator('a', { hasText: 'Back to admin dashboard' });
  if (await backLink.count() > 0) { await backLink.first().click(); await page.waitForTimeout(500); }
  else { await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await signInFresh(page, 'admin@jayshankar.demo', 'DevPassword123!');

// -- Manage fish types --
await page.click('a:has-text("Manage fish types")');
await page.waitForTimeout(700);
await shot(page, '20-skus-list');
await page.click('button:has-text("Add new fish type")');
await page.waitForTimeout(500);
await shot(page, '21-sku-form');
await toAdmin(page);

// -- Warehouses --
await page.click('a:has-text("Warehouses")');
await page.waitForTimeout(700);
await shot(page, '22-warehouses');
await toAdmin(page);

// -- Vendors management --
await page.click('a:has-text("Manage vendors")');
await page.waitForTimeout(700);
await shot(page, '23-vendors-list');
await page.click('button:has-text("Add vendor")');
await page.waitForTimeout(500);
await shot(page, '24-vendor-form');
await toAdmin(page);

// -- Team --
await page.click('a:has-text("Team")');
await page.waitForTimeout(700);
await shot(page, '25-team-list');
await page.click('button:has-text("Anitha")').catch(async () => { await page.locator('button', { hasText: 'Anitha' }).first().click().catch(() => {}); });
await page.waitForTimeout(500);
await shot(page, '26-team-edit-form');
await toAdmin(page);

// -- Audit log --
await page.click('a:has-text("View audit log")');
await page.waitForTimeout(700);
await shot(page, '27-audit-log');
await toAdmin(page);

// -- Delegate tasks --
await page.click('a:has-text("Delegate tasks")');
await page.waitForTimeout(700);
await shot(page, '28-task-delegation');
await toAdmin(page);

// -- Transfer --
await page.click('a:has-text("+ Transfer")');
await page.waitForTimeout(700);
await shot(page, '29-transfer-form');
await toAdmin(page);

// -- Spoilage --
await page.click('a:has-text("+ Spoilage")');
await page.waitForTimeout(700);
await shot(page, '30-spoilage-form');
await toAdmin(page);

// -- Customers --
await page.click('a:has-text("Customers")');
await page.waitForTimeout(700);
await shot(page, '31-customers');
await toAdmin(page);

// -- Payments --
await page.click('a:has-text("Payments")');
await page.waitForTimeout(700);
await shot(page, '32-payments');
await toAdmin(page);

// -- Bills: WhatsApp share compose --
await page.click('a:has-text("Bills")');
await page.waitForTimeout(700);
const markSharedBtns = page.locator('a,button', { hasText: 'Mark shared' });
await markSharedBtns.first().click();
await page.waitForTimeout(400);
await page.click('button:has-text("WhatsApp")');
await page.waitForTimeout(600);
await shot(page, '33-bill-whatsapp-share');
await page.click('button:has-text("Cancel")').catch(() => {});
await page.waitForTimeout(300);

// -- Bills: reconcile panel (credit bill) --
const reconcileBtn = page.locator('button', { hasText: 'Reconcile' }).first();
if (await reconcileBtn.count() > 0) {
  await reconcileBtn.click();
  await page.waitForTimeout(500);
  await shot(page, '34-bill-reconcile-panel');
}
await toAdmin(page);

// -- Search: fish --
await page.click('a:has-text("Search")');
await page.waitForTimeout(500);
await page.fill('input[type="text"]', 'pomfret');
await page.waitForTimeout(600);
await shot(page, '35-search-fish-results');
await page.locator('a', { hasText: /pomfret/i }).first().click();
await page.waitForTimeout(700);
await shot(page, '36-fish-card');
await page.goBack({ waitUntil: 'networkidle' });

// -- Search: customer --
await page.fill('input[type="text"]', 'Saravana');
await page.waitForTimeout(600);
await shot(page, '37-search-customer-results');
await page.locator('a', { hasText: /Saravana/i }).first().click();
await page.waitForTimeout(700);
await shot(page, '38-customer-card');
await page.goBack({ waitUntil: 'networkidle' });

// -- Search: vendor --
await page.fill('input[type="text"]', 'Murugan');
await page.waitForTimeout(600);
await shot(page, '39-search-vendor-results');
await page.locator('a', { hasText: /Murugan/i }).first().click();
await page.waitForTimeout(700);
await shot(page, '40-vendor-card');

// -- Search: employee --
await page.goBack({ waitUntil: 'networkidle' });
await page.fill('input[type="text"]', 'Anitha');
await page.waitForTimeout(600);
await shot(page, '41-search-employee-results');
await page.locator('a', { hasText: /Anitha/i }).first().click();
await page.waitForTimeout(700);
await shot(page, '42-employee-card');

await browser.close();
console.log('\ndone.');
