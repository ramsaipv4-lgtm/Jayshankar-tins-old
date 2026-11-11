import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const OUT_DIR = '/mnt/c/Users/user/Desktop/Jayshankar/hyperframes-video/raw-recordings';
mkdirSync(OUT_DIR, { recursive: true });

const CREDS = {
  admin: ['admin@jayshankar.demo', 'DevPassword123!'],
  rep: ['rep@jayshankar.demo', 'DevPassword123!'],
  worker: ['worker@jayshankar.demo', 'DevPassword123!'],
};

async function signOutIn(page, who, { first = false } = {}) {
  const [email, password] = CREDS[who];
  if (!first) {
    await page.click('button:has-text("Sign out")');
    await page.waitForTimeout(700);
  } else {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(400);
  await page.click('#identifier');
  await page.type('#identifier', email, { delay: 45 });
  await page.waitForTimeout(200);
  await page.click('#password');
  await page.type('#password', password, { delay: 45 });
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  // Not waitForURL: HashRouter keeps whatever route was showing across a sign-out/sign-in
  // cycle (e.g. still "#/complaints"), and most in-app routes allow every role, so nothing
  // forces a redirect to /admin, /rep or /floor on login. Waiting for the header's "Sign out"
  // button is what's actually true regardless of which route it lands back on.
  await page.waitForSelector('button:has-text("Sign out")', { timeout: 10000 });
  await page.waitForTimeout(900);
}

async function typeInto(page, selector, text, opts = {}) {
  await page.click(selector);
  await page.waitForTimeout(150);
  // Several forms pre-fill a numeric field from real state (e.g. FileComplaintForm's
  // #complaint-kg defaults to the sale's own total_kg) -- page.type() inserts at the cursor
  // rather than replacing, so typing into an already-"6"-filled field silently produced "66"
  // and a same-value-looking submission failed its own RPC validation with zero visible error
  // in the recording. Clearing first (instant, invisible) keeps the visible per-character type
  // animation while guaranteeing the field ends up holding exactly what we typed.
  await page.fill(selector, '');
  await page.type(selector, text, { delay: opts.delay ?? 70 });
  await page.waitForTimeout(350);
}

async function selectByText(page, selector, text) {
  const value = await page.locator(`${selector} option`, { hasText: text }).first().getAttribute('value');
  await page.selectOption(selector, value);
  await page.waitForTimeout(500);
}

// selectByExactPrefix — for SKU names specifically. "Seer fish" as a plain hasText substring
// also matches "Medium Seer Fish"/"Small Seer Fish" (case-insensitive substring, not exact),
// and since options render alphabetically and "Medium..." sorts before "Seer fish" itself,
// .first() would silently pick the WRONG fish — confirmed live: it actually happened, sold
// "Medium Seer Fish" while every comment claimed "Seer fish". Every SKU option is "Name
// (code)", so anchoring at the start is exact enough without needing the code suffix.
async function selectByExactPrefix(page, selector, text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = await page.locator(`${selector} option`, { hasText: new RegExp(`^${escaped}\\s*(\\(|$)`, 'i') }).first().getAttribute('value');
  await page.selectOption(selector, value);
  await page.waitForTimeout(500);
}

async function newRecordingContext(browser) {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
  });
}
async function finish(page, context, filename) {
  await context.close();
  const videoPath = await page.video().path();
  const dest = path.join(OUT_DIR, filename);
  renameSync(videoPath, dest);
  console.log('saved', dest);
}

const browser = await chromium.launch();

// ============================================================
// 31. Receive -> Pack -> Sell (one batch's whole life, one rep)
// ============================================================
async function scenario31() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Receive
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Pomfret');
  await typeInto(page, '#kg-0', '20');
  await typeInto(page, '#price-0', '330');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);

  // Pack
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(700);
  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  // Bills are listed most-recent-delivery-first, so .first() is the bill this scenario
  // just created above (not a stale bill left over from an earlier failed run).
  await page.locator('button.rounded-lg', { hasText: 'Ravi' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-TUT-31');
  await page.waitForTimeout(300);
  await page.selectOption('#container-capacity', '20'); // matches the 20kg just delivered, so it isn't over capacity
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1800);

  // Sell
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(700);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Pomfret');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '12');
  await typeInto(page, '#price', '395');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(2000);

  await finish(page, context, '31-receive-pack-sell.webm');
}

// ============================================================
// 32. Delivery with a shortfall: confirm-arrival short + spoiled -> reconcile
// (all as admin, who can do every step)
// ============================================================
async function scenario32() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Rep logs the vendor's promised delivery straight into "in transit (inbound)" — not
  // physically at the warehouse yet. selectByText's substring "in transit (inbound)" matches
  // 3 warehouses' transit legs; the Demo Warehouse's ("main-transit-in") sorts first
  // alphabetically among the underlying location names, so .first() lands on the right one.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'in transit (inbound)');
  await selectByExactPrefix(page, '#sku-0', 'Seer fish');
  await typeInto(page, '#kg-0', '20');
  await typeInto(page, '#price-0', '410');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);

  // Admin receives it at the door — measured less than promised.
  await signOutIn(page, 'admin');
  await page.click('a:has-text("Confirm arrivals")');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Confirm arrival")');
  await page.waitForTimeout(900);
  await selectByText(page, '#destination', 'Cold Storage');
  await page.fill('#confirmed-good-kg', '');
  await typeInto(page, '#confirmed-good-kg', '17');
  await typeInto(page, '#confirmed-spoiled-kg', '2');
  await typeInto(page, '#notes', 'Ice had melted, 1kg simply missing');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Confirm arrival")');
  await page.waitForTimeout(2000);

  // Notification appears
  await page.click('button[aria-label*="Notifications"]');
  await page.waitForTimeout(1200);
  const overlay = page.locator('div.fixed.inset-0.z-10');
  if (await overlay.count() > 0) await overlay.first().click();
  await page.waitForTimeout(400);

  // Reconcile the bill by hand (physical stock already adjusted to what was measured; the
  // vendor's own bill amount is a separate, deliberate decision -- D54/reconcile_bill).
  await page.click('a:has-text("Back to admin dashboard")').catch(() => {});
  await page.waitForTimeout(500);
  await page.click('a:has-text("Bills")');
  await page.waitForTimeout(900);
  const reconcileBtn = page.locator('button', { hasText: 'Reconcile' }).first();
  await reconcileBtn.click();
  await page.waitForTimeout(800);
  await typeInto(page, '#reconcile-notes', 'Vendor agreed, next bill adjusted');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Mark settled")');
  await page.waitForTimeout(1800);

  await finish(page, context, '32-delivery-shortfall-reconcile.webm');
}

// ============================================================
// 33. A return, start to finish: sale -> complaint -> admin resolves partial
// ============================================================
async function scenario33() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Tuna -- its own SKU (no other composite scenario touches it) delivered fresh right here,
  // rather than trusting whatever's left of the seeded stock: repeated recording attempts of
  // this exact scenario had already run the "Seer fish" stock down far enough that a later
  // attempt sold less than requested (a real, silent shortfall), which then couldn't file a
  // complaint for the ORIGINAL 6kg since the sale on record was actually smaller.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Tuna');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '380');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByExactPrefix(page, '#sku', 'Tuna');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Green Leaf Hotel');
  await typeInto(page, '#kg', '6');
  await typeInto(page, '#price', '460');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1800);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Complaints")');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("File a complaint")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#complaint-kg', '6');
  await typeInto(page, '#complaint-description', 'Said half the batch smelled off');
  await page.waitForTimeout(400);
  await page.click('button:has-text("File complaint")');
  await page.waitForTimeout(1600);

  // Switch to admin to resolve. Complaints allows every role, so there's no redirect on
  // sign-in -- we land right back on this same Complaints page as admin, no nav click needed
  // (there also isn't a "Complaints" link ON the Complaints page itself to click).
  await signOutIn(page, 'admin');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Review & resolve")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#kg-bad', '2');
  await typeInto(page, '#kg-good', '4');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Resolve complaint")').catch(async () => {
    await page.locator('button[type="submit"]').first().click();
  });
  await page.waitForTimeout(2000);

  await finish(page, context, '33-return-partial-resolve.webm');
}

// ============================================================
// 34. A correction, start to finish: sale -> reversal requested -> admin approves + executes
// ============================================================
async function scenario34() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Sardine -- fresh delivery first (same reasoning as scenario33's Tuna): don't spend down
  // whatever's left of a shared seeded SKU across repeated recording attempts.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Ravi');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Sardine');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '150');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Sardine');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '5');
  await typeInto(page, '#price', '470');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Reversals")');
  await page.waitForTimeout(900);
  await page.locator('button:has-text("Request reversal")').first().click();
  await page.waitForTimeout(800);
  await typeInto(page, '#reversal-reason', 'Customer changed their mind before pickup');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Request reversal")');
  await page.waitForTimeout(1800);

  // Switch to admin: approve + execute. Reversals allows every role too, so (same reasoning
  // as scenario33's Complaints switch) we land right back on this page as admin already.
  await signOutIn(page, 'admin');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Approve")').first().click();
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("Execute")').first().click();
  await page.waitForTimeout(2000);

  await finish(page, context, '34-correction-approve-execute.webm');
}

// ============================================================
// 35. Running low mid-shift: pack -> sell most -> repack the dregs
// ============================================================
async function scenario35() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'rep', { first: true });

  // Anchovy -- deliberately a SKU no other composite scenario touches, so this scenario's own
  // containers are the only ones ever competing for its stock (record_container_sale cascades
  // soonest-to-expire-first across EVERY container holding a SKU at a location; sharing Pomfret
  // with scenario31's own leftover container would make which container actually drains
  // unpredictable). Also: a container only ever comes into existence already filled
  // (record_container_fill inserts into `containers` itself) -- there's no "register an empty
  // tub" step -- so a genuinely empty, available repack destination has to be produced by fully
  // selling one out first, by hand, right here.

  // Warm-up: tiny delivery -> pack -> sell it ALL, purely to leave an empty tub behind.
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Karthik');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Anchovy');
  await typeInto(page, '#kg-0', '3');
  await typeInto(page, '#price-0', '180');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Karthik' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-TUT-35-SPARE');
  await page.selectOption('#container-capacity', '5');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Anchovy');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Saravana Stores');
  await typeInto(page, '#kg', '3');
  await typeInto(page, '#price', '230');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  // The actual "running low mid-shift" beat: pack a full container, sell most of it, repack
  // the dregs into the now-empty spare tub above.
  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Karthik');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#sku-0', 'Anchovy');
  await typeInto(page, '#kg-0', '10');
  await typeInto(page, '#price-0', '180');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("Pack container")');
  await page.waitForTimeout(900);
  await page.locator('button.rounded-lg', { hasText: 'Karthik' }).first().click();
  await page.waitForTimeout(900);
  await typeInto(page, '#container-number', 'TC-TUT-35');
  await page.selectOption('#container-capacity', '10');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Pack container")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("+ Sale")');
  await page.waitForTimeout(900);
  await selectByText(page, '#sku', 'Anchovy');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByText(page, '#customer', 'Green Leaf Hotel');
  await typeInto(page, '#kg', '8.5');
  await typeInto(page, '#price', '250');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record sale")');
  await page.waitForTimeout(1600);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  // No repack link on RepDashboard (it's a floor/worker task on-screen, though the RPC allows
  // vendor-rep too) -- navigate by hash directly, same-origin so HashRouter picks it up cleanly.
  await page.goto(`${BASE}/#/repack`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await selectByText(page, '#source-fill', 'TC-TUT-35');
  await selectByText(page, '#destination-container', 'TC-TUT-35-SPARE');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Repack container")');
  await page.waitForTimeout(2000);

  await finish(page, context, '35-running-low-repack.webm');
}

// ============================================================
// 36. Delegate and complete: admin assigns -> rep sees + does it -> auto-completes
// ============================================================
async function scenario36() {
  const context = await newRecordingContext(browser);
  const page = await context.newPage();
  await signOutIn(page, 'admin', { first: true });

  await page.click('a:has-text("Delegate tasks")');
  await page.waitForTimeout(900);
  // Default task type is "Receive a delivery", which needs a vendor picked before either
  // assign button enables -- and it must be the SAME vendor ("Mani") the rep delivers from
  // below, since auto_complete_task only closes a task whose related_vendor_id matches.
  await selectByText(page, '#task-vendor', 'Mani');
  // Two seeded users are both named "Anitha" (a leftover demo duplicate + the one actually
  // wired to rep@jayshankar.demo) -- verified directly against the live DB that ordering by
  // display_name puts the real rep account second, so .last() (not .first()) is the one that
  // will actually show up under that login's "My tasks" below.
  await page.locator('button:has-text("Anitha")').last().click();
  await page.waitForTimeout(2000);

  await signOutIn(page, 'rep');
  await page.click('a:has-text("My tasks")');
  await page.waitForTimeout(1200);
  await page.click('a:has-text("Go to + Delivery")');
  await page.waitForTimeout(900);
  await selectByText(page, '#vendor', 'Mani');
  await selectByText(page, '#location', 'Cold Storage');
  await selectByExactPrefix(page, '#sku-0', 'Seer fish');
  await typeInto(page, '#kg-0', '14');
  await typeInto(page, '#price-0', '415');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Record bill")');
  await page.waitForTimeout(1800);

  await page.click('a:has-text("Back to rep dashboard")');
  await page.waitForTimeout(600);
  await page.click('a:has-text("My tasks")');
  await page.waitForTimeout(1500);

  await finish(page, context, '36-delegate-complete.webm');
}

const all = { 31: scenario31, 32: scenario32, 33: scenario33, 34: scenario34, 35: scenario35, 36: scenario36 };
const requested = process.argv.slice(2).map(Number).filter((n) => all[n]);
const toRun = requested.length ? requested : Object.keys(all).map(Number);
for (const n of toRun) {
  console.log(`\n=== scenario ${n} ===`);
  await all[n]();
}

await browser.close();
console.log('\ndone.');
