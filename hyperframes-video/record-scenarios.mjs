import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const OUT_DIR = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/raw-recordings';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

async function signIn(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#identifier');
  await page.type('#identifier', email, { delay: 55 });
  await page.waitForTimeout(300);
  await page.click('#password');
  await page.type('#password', password, { delay: 55 });
  await page.waitForTimeout(400);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|rep|floor)/, { timeout: 10000 });
  await page.waitForTimeout(1000);
}

async function selectByText(page, selector, text) {
  const value = await page.locator(`${selector} option`, { hasText: text }).first().getAttribute('value');
  await page.selectOption(selector, value);
}

async function typeInto(page, selector, text) {
  await page.click(selector);
  await page.waitForTimeout(200);
  await page.type(selector, text, { delay: 75 });
  await page.waitForTimeout(400);
}

// ============ Scenario 1: Record a Purchase (Delivery) ============
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await signIn(page, 'rep@jayshankar.demo', 'DevPassword123!');
  await page.waitForTimeout(800);

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(1000);

  await selectByText(page, '#vendor', 'Murugan');
  await page.waitForTimeout(700);
  await selectByText(page, '#location', 'Cold Storage');
  await page.waitForTimeout(700);

  await typeInto(page, '#vendor-bill-number', 'MK-2214');

  await selectByText(page, '#sku-0', 'Pomfret');
  await page.waitForTimeout(600);
  await typeInto(page, '#kg-0', '25');
  await typeInto(page, '#price-0', '320');

  await page.click('button:has-text("+ Add another fish")');
  await page.waitForTimeout(700);
  await selectByText(page, '#sku-1', 'Seer fish');
  await page.waitForTimeout(600);
  await typeInto(page, '#kg-1', '15');
  await typeInto(page, '#price-1', '410');

  await page.waitForTimeout(600);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(2200);

  await context.close();
  const videoPath = await page.video().path();
  const dest = path.join(OUT_DIR, '1-record-a-purchase.webm');
  renameSync(videoPath, dest);
  console.log('saved', dest);
}

// ============ Scenario 2: Record a Sale ============
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  await signIn(page, 'rep@jayshankar.demo', 'DevPassword123!');
  await page.waitForTimeout(800);

  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(1000);

  await selectByText(page, '#sku', 'Pomfret');
  await page.waitForTimeout(700);
  await selectByText(page, '#location', 'Cold Storage');
  await page.waitForTimeout(700);
  await selectByText(page, '#customer', 'Saravana Stores');
  await page.waitForTimeout(700);

  await typeInto(page, '#kg', '8');
  await typeInto(page, '#price', '380');

  await page.waitForTimeout(600);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(2200);

  await context.close();
  const videoPath = await page.video().path();
  const dest = path.join(OUT_DIR, '2-record-a-sale.webm');
  renameSync(videoPath, dest);
  console.log('saved', dest);
}

await browser.close();
console.log('done.');
