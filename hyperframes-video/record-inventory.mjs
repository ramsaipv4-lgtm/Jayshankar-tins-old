// record-inventory.mjs — single-action scenarios 3-8: the "inventory movement" category from
// the 36-item feature-coverage plan (1-2 and 31-36 already recorded). Each is one focused
// action, verified against the live DB after running, same discipline as record-composites.mjs.

import { signOutIn, typeInto, selectByText, selectByExactPrefix, newRecordingContext, finish, runScenarios } from './lib.mjs';

// real-operations warehouse's "Main Storage" -- picked by id, not text, since two locations
// share the literal display text "Main Storage" (real-operations and simulated-operations).
const REAL_OPS_MAIN_STORAGE_ID = 'ee6dcdf4-0fe2-4fde-859d-c6fe30a26c98';

// ============================================================
// 3. Transfer stock between warehouses (admin, cross-warehouse only per D29)
// ============================================================
async function scenario3(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Trevally');
  await typeInto(page, '#kg-0', '15');
  await typeInto(page, '#price-0', '300');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'admin');
  await page.click('a:has-text("+ Transfer")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Trevally');
  await selectByText(page, '#from', 'Cold Storage');
  await page.selectOption('#to', REAL_OPS_MAIN_STORAGE_ID);
  await page.waitForTimeout(500);
  await typeInto(page, '#kg', '8');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record transfer")');
  await page.waitForTimeout(2000);

  await finish(page, context, '03-transfer-warehouses.webm');
}

// ============================================================
// 4. Record spoilage (worker, floor dashboard)
// ============================================================
async function scenario4(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Katla');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '260');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'worker');
  await page.click('a:has-text("+ Spoilage")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Katla');
  await selectByText(page, '#location', 'Cold Storage');
  await typeInto(page, '#kg', '2');
  await page.waitForTimeout(300);
  await selectByText(page, '#reason', 'Damaged in storage');
  await typeInto(page, '#notes', 'Ice melted overnight, found soft on morning check');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record spoilage")');
  await page.waitForTimeout(2000);

  await finish(page, context, '04-record-spoilage.webm');
}

// ============================================================
// 5. Confirm a delivery arrival that matches exactly (the happy path -- no discrepancy)
// ============================================================
async function scenario5(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByExactPrefix(page, '#location', 'Demo Warehouse (feature showcase) — in transit (inbound)');
  await selectByText(page, '#sku-0', 'Emperor  - 1');
  await typeInto(page, '#kg-0', '12');
  await typeInto(page, '#price-0', '270');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Confirm arrivals")');
  await page.waitForTimeout(1000);
  // Most-recent-first list (created_at ascending in the query, but our fresh one is the only
  // "Emperor" row in transit) -- match on the fish name to avoid any stale in-transit batch.
  await page.locator('div.rounded-lg', { hasText: 'Emperor' }).getByText('Confirm arrival →').first().click();
  await page.waitForTimeout(900);
  await selectByText(page, '#destination', 'Cold Storage');
  await page.fill('#confirmed-good-kg', '');
  await typeInto(page, '#confirmed-good-kg', '12');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Confirm arrival")');
  await page.waitForTimeout(2200);

  await finish(page, context, '05-confirm-arrival-happy-path.webm');
}

// ============================================================
// 6. Floor dashboard: stock by location, then a simple repack (near-empty -> spare tub)
// ============================================================
async function scenario6(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Warm-up: small delivery -> pack -> sell it all, to produce an empty, available tub
  // (same reasoning as composite scenario 35 -- a container only ever exists already-filled).
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Kalava');
  await typeInto(page, '#kg-0', '3');
  await typeInto(page, '#price-0', '210');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Ravi' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-STD-06-SPARE');
  await page.selectOption('#container-capacity', '5');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Kalava');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '3');
  await typeInto(page, '#price', '260');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  // Second delivery -> pack -> sell most, leaving dregs.
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Kalava');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '210');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Ravi' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-STD-06-MAIN');
  await page.selectOption('#container-capacity', '10');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Kalava');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Green Leaf Hotel');
  await typeInto(page, '#kg', '8');
  await typeInto(page, '#price', '250');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  // Now the worker's own view: active stock, then repack the dregs.
  await signOutIn(page, 'worker');
  await page.waitForTimeout(600);
  await page.goto('http://localhost:5173/#/repack', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await selectByExactPrefix(page, '#source-fill', 'TC-STD-06-MAIN');
  await selectByExactPrefix(page, '#destination-container', 'TC-STD-06-SPARE');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Repack container")');
  await page.waitForTimeout(2000);
  await page.click('a:has-text("Back to floor dashboard")');
  await page.waitForTimeout(1500);

  await finish(page, context, '06-floor-dashboard-repack.webm');
}

// ============================================================
// 7. Pack a container and flag it as the vendor's own box (ownership)
// ============================================================
async function scenario7(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Karthik');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Panna');
  await typeInto(page, '#kg-0', '9');
  await typeInto(page, '#price-0', '190');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Karthik' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-STD-07-VENDOR');
  await page.selectOption('#container-capacity', '10');
  await page.waitForTimeout(400);
  await selectByText(page, '#container-ownership', "The vendor's");
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(2000);

  await finish(page, context, '07-pack-ownership-flag.webm');
}

// ============================================================
// 8. Sell directly from un-contained storage stock (no container involved at all)
// ============================================================
async function scenario8(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Sadayan');
  await typeInto(page, '#kg-0', '14');
  await typeInto(page, '#price-0', '160');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);

  // No packing step -- sell straight from the un-contained batch.
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Sadayan');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '9');
  await typeInto(page, '#price', '210');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(2200);

  await finish(page, context, '08-direct-storage-sale.webm');
}

await runScenarios({ 3: scenario3, 4: scenario4, 5: scenario5, 6: scenario6, 7: scenario7, 8: scenario8 });
