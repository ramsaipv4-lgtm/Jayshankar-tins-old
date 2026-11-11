// record-tasks-search.mjs — single-action scenarios 26-30: "task coordination" + "search".

import { signOutIn, typeInto, selectByText, selectByExactPrefix, newRecordingContext, finish, runScenarios } from './lib.mjs';

// ============================================================
// 26. Auto-assign a task via round robin (least-currently-loaded picks it up)
// ============================================================
async function scenario26(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  // Default task type is already "Receive a delivery".
  await selectByText(page, '#task-vendor', 'Selvam');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Auto-assign (round robin)")');
  await page.waitForTimeout(2200);

  await finish(page, context, '26-auto-assign-round-robin.webm');
}

// ============================================================
// 27. A custom task: delegate it, then the worker starts and completes it by hand
// ============================================================
async function scenario27(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("Custom")');
  await page.waitForTimeout(500);
  await typeInto(page, '#task-title', 'Wash down the display counter');
  await page.waitForTimeout(400);
  // Two seeded users are named "Suresh" -- the real worker@jayshankar.demo login sorts last
  // among same-name ties (verified live, same pattern as the duplicate "Anitha" accounts).
  await page.locator('button:has-text("Suresh")').last().click();
  await page.waitForTimeout(1600);

  await signOutIn(page, 'worker');
  await page.click('a:has-text("My tasks")');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Start")');
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Mark complete")');
  await page.waitForTimeout(2000);

  await finish(page, context, '27-custom-task-start-complete.webm');
}

// ============================================================
// 28. Delegate a pack/repack task; the worker closes it by actually repacking
// ============================================================
async function scenario28(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Set up one empty spare tub and one near-empty source, same reasoning as scenario 6/
  // composite 35 -- a container only ever exists already-filled.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Paalai');
  await typeInto(page, '#kg-0', '3');
  await typeInto(page, '#price-0', '200');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Mani' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-STD-28-SPARE');
  await page.selectOption('#container-capacity', '5');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Paalai');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '3');
  await typeInto(page, '#price', '250');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Paalai');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '200');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Mani' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-STD-28-MAIN');
  await page.selectOption('#container-capacity', '10');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Paalai');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Green Leaf Hotel');
  await typeInto(page, '#kg', '8');
  await typeInto(page, '#price', '240');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'admin');
  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("Pack / repack")');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Suresh")').last().click();
  await page.waitForTimeout(1600);

  await signOutIn(page, 'worker');
  await page.click('a:has-text("+ Repack")');
  await page.waitForTimeout(900);
  await selectByExactPrefix(page, '#source-fill', 'TC-STD-28-MAIN');
  await selectByExactPrefix(page, '#destination-container', 'TC-STD-28-SPARE');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Repack container")');
  await page.waitForTimeout(2200);

  await finish(page, context, '28-delegate-pack-repack-task.webm');
}

// ============================================================
// 29. My tasks -- the worker's own view: open work, and what's already done
// ============================================================
async function scenario29(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'worker', { first: true });

  await page.click('a:has-text("My tasks")');
  await page.waitForTimeout(1500);
  await page.click('a:has-text("Back to dashboard")');
  await page.waitForTimeout(1000);

  await finish(page, context, '29-my-tasks-worker-view.webm');
}

// ============================================================
// 30. Search: find a fish, then a customer, by name
// ============================================================
async function scenario30(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Search")');
  await page.waitForTimeout(900);
  await typeInto(page, 'input[placeholder*="vanjaram"]', 'pomfret');
  await page.waitForTimeout(900);
  await page.locator('a', { hasText: 'Pomfret' }).first().click();
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to search")');
  await page.waitForTimeout(700);

  await page.fill('input[placeholder*="vanjaram"]', '');
  await typeInto(page, 'input[placeholder*="vanjaram"]', 'Saravana');
  await page.waitForTimeout(900);
  await page.locator('a', { hasText: 'Saravana Stores' }).first().click();
  await page.waitForTimeout(1800);

  await finish(page, context, '30-search-fish-customer.webm');
}

await runScenarios({ 26: scenario26, 27: scenario27, 28: scenario28, 29: scenario29, 30: scenario30 });
