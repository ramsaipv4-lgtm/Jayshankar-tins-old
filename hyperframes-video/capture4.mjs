import { chromium } from 'playwright';
const OUT = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/captures2';
const BASE = 'http://localhost:5173';
async function shot(page, name) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('captured', name); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.fill('#identifier', 'admin@jayshankar.demo');
await page.fill('#password', 'DevPassword123!');
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin/, { timeout: 10000 });
await page.waitForTimeout(800);
await page.click('a:has-text("Payments")');
await page.waitForTimeout(600);
await page.selectOption('select', { label: 'Saravana Stores (Saravana Fish Stores)' }).catch(async () => {
  const opts = await page.locator('select option').allTextContents();
  console.log('options:', opts);
});
await page.waitForTimeout(600);
await shot(page, '32b-payments-customer');
await browser.close();
