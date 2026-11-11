// record-money.mjs — single-action scenarios 9-13: the "money & customers" category.

import { signOutIn, typeInto, selectByText, newRecordingContext, finish, runScenarios } from './lib.mjs';

// ============================================================
// 9. Add a new customer
// ============================================================
async function scenario9(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Customers")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Add new customer")');
  await page.waitForTimeout(800);
  await typeInto(page, '#cust-name', 'Coastal Fresh Mart');
  await typeInto(page, '#cust-phone', '9945501234');
  await page.waitForTimeout(300);
  await page.click('summary:has-text("More settings")');
  await page.waitForTimeout(500);
  await typeInto(page, '#cust-fish-pref', 'Pomfret, prawns');
  await typeInto(page, '#cust-credit-limit', '15000');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add customer")');
  await page.waitForTimeout(2000);

  await finish(page, context, '09-add-customer.webm');
}

// ============================================================
// 10. Record a payment against an outstanding sale
// ============================================================
async function scenario10(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // A fresh, definitely-unpaid sale to pay against, rather than trusting whatever's left
  // outstanding from earlier recordings.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Moral');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '240');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Moral');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '10');
  await typeInto(page, '#price', '300');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1800);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await page.click('a:has-text("Payments")');
  await page.waitForTimeout(900);
  await selectByText(page, '#pay-customer', 'Saravana Stores');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("Record payment")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#pay-amount', '2000');
  await page.waitForTimeout(300);
  await selectByText(page, '#pay-method', 'UPI');
  await typeInto(page, '#pay-notes', 'Partial payment, rest next week');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record payment")');
  await page.waitForTimeout(2000);

  await finish(page, context, '10-record-payment.webm');
}

// ============================================================
// 11. Share a bill with the vendor over WhatsApp
// ============================================================
async function scenario11(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Karthik');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Kaadan');
  await typeInto(page, '#kg-0', '11');
  await typeInto(page, '#price-0', '175');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  // "Mark shared" is admin/co-admin only (isAdmin gate in BillsManagement.tsx) -- a rep can
  // receive the bill but only an admin shares it onward.
  await signOutIn(page, 'admin');
  await page.click('a:has-text("Bills")');
  await page.waitForTimeout(900);
  // Bills is ordered by bill_date DESC with no secondary tiebreak, and every bill made today
  // shares the same date -- ties resolve in whatever arbitrary order Postgres returns them,
  // NOT "most recent first" (confirmed live: an unrelated seed bill sorted ahead of this one).
  // Scope to this exact bill by its total (11kg x Rs175 = Rs1925.00, unique enough) rather than
  // trusting list position.
  await page.locator('div.rounded-lg', { hasText: 'Karthik' }).filter({ hasText: '₹1925.00' }).first()
    .locator('button:has-text("Mark shared")').click();
  await page.waitForTimeout(600);
  await page.click('button:has-text("WhatsApp")');
  await page.waitForTimeout(1000);
  await page.click('#whatsapp-text');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Generate a picture too")');
  await page.waitForTimeout(1800);
  await page.click('button:has-text("I sent it")');
  await page.waitForTimeout(1800);

  await finish(page, context, '11-share-bill-whatsapp.webm');
}

// ============================================================
// 12. Add a new vendor
// ============================================================
async function scenario12(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Manage vendors")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Add vendor")');
  await page.waitForTimeout(800);
  await typeInto(page, '#vendor-name', 'Muthu');
  await typeInto(page, '#vendor-phone', '9840012233');
  await page.waitForTimeout(300);
  await page.click('summary:has-text("More settings")');
  await page.waitForTimeout(500);
  await typeInto(page, '#vendor-port', 'Kasimedu');
  await typeInto(page, '#vendor-catch', 'Seer fish, pomfret');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add vendor")');
  await page.waitForTimeout(2000);

  await finish(page, context, '12-add-vendor.webm');
}

// ============================================================
// 13. Defer a credit bill's reconciliation with a reminder, instead of settling now
// ============================================================
async function scenario13(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Thiruvan');
  await typeInto(page, '#kg-0', '13');
  await typeInto(page, '#price-0', '220');
  await page.waitForTimeout(400);
  await page.click('button[role="radio"]:has-text("On credit")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  await signOutIn(page, 'admin');
  await page.click('a:has-text("Bills")');
  await page.waitForTimeout(900);
  // Same tie-ordering caveat as scenario 11's "Mark shared" -- scope to this exact bill by its
  // total (13kg x Rs220 = Rs2860.00) rather than trusting list position.
  await page.locator('div.rounded-lg', { hasText: 'Mani' }).filter({ hasText: '₹2860.00' }).first()
    .locator('button:has-text("Reconcile / defer")').click();
  await page.waitForTimeout(800);
  await page.click('button:has-text("Defer with a reminder")');
  await page.waitForTimeout(500);
  await typeInto(page, '#remind-days', '5');
  await typeInto(page, '#reconcile-notes', 'Vendor said he\'ll settle up next Friday');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Set reminder")');
  await page.waitForTimeout(2000);

  await finish(page, context, '13-defer-reconciliation.webm');
}

await runScenarios({ 9: scenario9, 10: scenario10, 11: scenario11, 12: scenario12, 13: scenario13 });
