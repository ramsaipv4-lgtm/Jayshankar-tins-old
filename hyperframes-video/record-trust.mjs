// record-trust.mjs — single-action scenarios 14-20: the "trust & corrections" category.

import { signOutIn, typeInto, selectByText, newRecordingContext, finish, runScenarios } from './lib.mjs';
const BASE = 'http://localhost:5173';

// ============================================================
// 14. Admin self-reverses their own sale (can_self_reverse -- auto-approved, no second admin)
// ============================================================
async function scenario14(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  // A SKU with real, fresh stock -- not whatever's left of the seed data ("Sundu" turned out
  // to have zero, which failed the sale silently (an inline form error, not a crash) and left
  // the reversal request pointed at a completely unrelated pre-existing sale instead.
  await signOutIn(page, 'rep', { first: true });
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Squid 2');
  await typeInto(page, '#kg-0', '6');
  await typeInto(page, '#price-0', '260');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'admin');
  await page.goto(`${BASE}/#/sell`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Squid 2');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '4');
  await typeInto(page, '#price', '190');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1800);
  // SaleForm's own footer link is hardcoded "Back to rep dashboard" regardless of role -- as
  // admin it lands on /rep, which Shell redirects straight back to /admin (its real default).
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(700);

  await page.click('a:has-text("Reversals")');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("Request reversal")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#reversal-reason', 'Priced it wrong, fixing it myself');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Request reversal")');
  await page.waitForTimeout(1600);
  // can_self_reverse auto-approves at creation -- straight to Execute, no second admin needed.
  await page.locator('button:has-text("Execute")').first().click();
  await page.waitForTimeout(2200);

  await finish(page, context, '14-admin-self-reverse.webm');
}

// ============================================================
// 15. Admin denies a reversal request
// ============================================================
async function scenario15(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Tholan');
  await typeInto(page, '#kg-0', '8');
  await typeInto(page, '#price-0', '200');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Tholan');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Green Leaf Hotel');
  await typeInto(page, '#kg', '5');
  await typeInto(page, '#price', '280');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Reversals")');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("Request reversal")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#reversal-reason', 'Customer wants a refund, checking with admin first');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Request reversal")');
  await page.waitForTimeout(1600);

  await signOutIn(page, 'admin');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Deny")').first().click();
  await page.waitForTimeout(2000);

  await finish(page, context, '15-admin-denies-reversal.webm');
}

// ============================================================
// 16. Notifications: a bill comes in, admin sees it in the bell and reads it
// ============================================================
async function scenario16(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Karthik');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Kv 3');
  await typeInto(page, '#kg-0', '7');
  await typeInto(page, '#price-0', '340');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'admin');
  await page.waitForTimeout(500);
  await page.click('button[aria-label*="Notifications"]');
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Mark all read")');
  await page.waitForTimeout(1800);

  await finish(page, context, '16-notifications-bell.webm');
}

// ============================================================
// 17. Audit log: filter by table and user
// ============================================================
async function scenario17(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("View audit log")');
  await page.waitForTimeout(1200);
  await selectByText(page, '#filter-table', 'sales');
  await page.waitForTimeout(800);
  await page.locator('button:has-text("show")').first().click();
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Reset filters")');
  await page.waitForTimeout(1200);

  await finish(page, context, '17-audit-log.webm');
}

// ============================================================
// 18. A complaint that gets fully rejected -- no refund at all
// ============================================================
async function scenario18(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Deliver fresh stock first -- never trust leftover seed stock to still be there (found the
  // hard way: two other scenarios' sales silently failed on a zero-stock SKU and the script,
  // not checking for a form error, barrelled ahead into requesting a reversal against a
  // completely unrelated older sale instead).
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Sembaalai');
  await typeInto(page, '#kg-0', '9');
  await typeInto(page, '#price-0', '230');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Sembaalai');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '4');
  await typeInto(page, '#price', '300');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Complaints")');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("File a complaint")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#complaint-description', 'Says he never picked it up, wants it back -- no proof of any defect');
  await page.waitForTimeout(400);
  await page.click('button:has-text("File complaint")');
  await page.waitForTimeout(1600);

  await signOutIn(page, 'admin');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Review & resolve")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#kg-rejected', '4');
  await page.waitForTimeout(400);
  await selectByText(page, '#rejected-disposition', 'Disposed');
  await typeInto(page, '#resolution-notes', 'No defect shown -- past pickup window, rejected');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Resolve complaint")');
  await page.waitForTimeout(2200);

  await finish(page, context, '18-complaint-fully-rejected.webm');
}

// ============================================================
// 19. Delegate a custom task, then cancel it
// ============================================================
async function scenario19(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("Custom")');
  await page.waitForTimeout(500);
  await typeInto(page, '#task-title', 'Clean the storage shelves before Friday delivery');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Auto-assign (round robin)")');
  await page.waitForTimeout(1600);

  await page.locator('div.divide-y > div', { hasText: 'Clean the storage shelves' }).first()
    .locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(1800);

  await finish(page, context, '19-cancel-delegated-task.webm');
}

// ============================================================
// 20. Edit an existing vendor (tap to edit, toggle reliability + active)
// ============================================================
async function scenario20(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Manage vendors")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Murugan' }).first().click();
  await page.waitForTimeout(900);
  await page.click('summary:has-text("More settings")');
  await page.waitForTimeout(500);
  await selectByText(page, '#vendor-reliability', '5 (most reliable)');
  await typeInto(page, '#vendor-notes', 'Consistently good quality, pays attention to ice');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(2000);

  await finish(page, context, '20-edit-vendor.webm');
}

await runScenarios({ 14: scenario14, 15: scenario15, 16: scenario16, 17: scenario17, 18: scenario18, 19: scenario19, 20: scenario20 });
