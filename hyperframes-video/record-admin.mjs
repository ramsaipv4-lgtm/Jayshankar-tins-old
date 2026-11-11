// record-admin.mjs — single-action scenarios 21-25: the "admin setup" category.

import { signOutIn, typeInto, selectByText, newRecordingContext, finish, runScenarios } from './lib.mjs';

// ============================================================
// 21. Create a new warehouse
// ============================================================
async function scenario21(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Warehouses")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Add warehouse")');
  await page.waitForTimeout(800);
  await typeInto(page, '#display-name', 'North Depot');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add warehouse")');
  await page.waitForTimeout(2000);

  await finish(page, context, '21-add-warehouse.webm');
}

// ============================================================
// 22. Add a new fish type
// ============================================================
async function scenario22(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Manage fish types")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Add new fish type")');
  await page.waitForTimeout(800);
  await typeInto(page, '#english-name', 'Rock Cod');
  await typeInto(page, '#tamil-name', 'பாறை மீன்');
  await page.waitForTimeout(300);
  await selectByText(page, '#category', 'Fish');
  await selectByText(page, '#size', 'Large');
  await page.waitForTimeout(300);
  await page.click('summary:has-text("More settings")');
  await page.waitForTimeout(500);
  await typeInto(page, '#shelf-life', '30');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Add fish type")');
  await page.waitForTimeout(2000);

  await finish(page, context, '22-add-fish-type.webm');
}

// ============================================================
// 23. Invite a new team member (get a shareable link -- nothing sent automatically)
// ============================================================
async function scenario23(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Team")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Invite someone new")');
  await page.waitForTimeout(800);
  await typeInto(page, '#invite-email', 'priya@jayshankar.demo');
  await typeInto(page, '#invite-name', 'Priya');
  await page.waitForTimeout(300);
  await selectByText(page, '#invite-role', 'Receiving & sales');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Get invite link")');
  await page.waitForTimeout(2200);
  await page.click('button:has-text("Copy link")');
  await page.waitForTimeout(1500);

  await finish(page, context, '23-invite-team-member.webm');
}

// ============================================================
// 24. Change a team member's access -- see the orphaned-task warning, save anyway
// ============================================================
async function scenario24(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  // A fresh, uniquely-named invitee -- no duplicate-display-name ambiguity to fight, unlike
  // "Anitha"/"Suresh" (both of whom exist twice in the seed data).
  await page.click('a:has-text("Team")');
  await page.waitForTimeout(900);
  await page.click('button:has-text("+ Invite someone new")');
  await page.waitForTimeout(800);
  await typeInto(page, '#invite-email', 'divya@jayshankar.demo');
  await typeInto(page, '#invite-name', 'Divya');
  await page.waitForTimeout(300);
  await selectByText(page, '#invite-role', 'Receiving & sales');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Get invite link")');
  await page.waitForTimeout(1800);
  await page.click('button:has-text("Done")');
  await page.waitForTimeout(900);
  await page.click('a:has-text("Back to admin dashboard")');
  await page.waitForTimeout(700);

  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  await selectByText(page, '#task-vendor', 'Ravi');
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Divya")').first().click();
  await page.waitForTimeout(1600);
  await page.click('a:has-text("Back to admin dashboard")');
  await page.waitForTimeout(700);

  await page.click('a:has-text("Team")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Divya' }).first().click();
  await page.waitForTimeout(900);
  await page.click('label:has-text("Access on") input[type="checkbox"]');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(2200);

  await finish(page, context, '24-role-change-orphan-warning.webm');
}

// ============================================================
// 25. Toggle a co-admin's self-reverse permission
// ============================================================
async function scenario25(browser) {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Team")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Sai Ram' }).first().click();
  await page.waitForTimeout(900);
  await page.click('label:has-text("Can approve their own reversal requests") input[type="checkbox"]');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(2200);

  await finish(page, context, '25-toggle-self-reverse.webm');
}

await runScenarios({ 21: scenario21, 22: scenario22, 23: scenario23, 24: scenario24, 25: scenario25 });
