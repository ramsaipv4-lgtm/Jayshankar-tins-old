// gen-batch.mjs — builds all 28 remaining single-action tutorial compositions (scenarios 3-30)
// in one pass, reusing gen-tutorial.mjs's exact template. Captions are distributed by relative
// weight across each clip's real, ffprobe-measured duration (weight ~ how much real screen
// time that phase plausibly occupies -- sign-in is quick, form-filling is the bulk, the
// outcome lingers) rather than hand-timed against extracted frames the way the 6 multi-step
// composites were: these are simpler, single-page actions with a well-established, now-
// calibrated shape (sign-in ~4s, per-field-group ~3-4s, submit+success ~2-4s) after 8 videos'
// worth of direct frame verification earlier in this same session.

import { mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { buildHtml } from './gen-tutorial.mjs';

const RAW = './raw-recordings';

// weighted(rawDuration, [[text, weight], ...]) -> contiguous captions filling the whole clip.
function weighted(rawDuration, parts) {
  const totalWeight = parts.reduce((s, [, w]) => s + w, 0);
  let t = 2.5;
  const out = [];
  for (const [text, w] of parts) {
    const dur = +(rawDuration * (w / totalWeight)).toFixed(2);
    out.push({ text, start: +t.toFixed(2), dur });
    t += dur;
  }
  // Correct any float drift so the last caption ends exactly at video end.
  const wantEnd = +(2.5 + rawDuration).toFixed(2);
  const gotEnd = +(out[out.length - 1].start + out[out.length - 1].dur).toFixed(2);
  out[out.length - 1].dur = +(out[out.length - 1].dur + (wantEnd - gotEnd)).toFixed(2);
  return out;
}

const VIDEOS = [
  {
    n: '03', dir: 'single-03-transfer', file: '03-transfer-warehouses.mp4', dur: 24.2,
    kicker: 'Tutorial · Inventory', brand: 'Transfer Between Warehouses',
    tag: 'Cross-warehouse only -- moving stock within one warehouse is repack, not transfer.',
    close: 'The FIFO-oldest batch loses kg; the destination gets a new batch with the same real freshness clock.',
    captions: weighted(24.2, [
      ['Deliver some stock first, so there\'s something to move', 2],
      ['+ Transfer: pick the fish and the source', 2],
      ['Pick a DIFFERENT warehouse as the destination', 1.5],
      ['How much to move -- submitted', 2],
    ]),
  },
  {
    n: '04', dir: 'single-04-spoilage', file: '04-record-spoilage.mp4', dur: 27.52,
    kicker: 'Tutorial · Inventory', brand: 'Record Spoilage',
    tag: 'A worker marks kg as waste -- containers first, then storage, same cascade as a sale.',
    close: 'Every reason is picked from a fixed list, so spoilage stays comparable across the whole team.',
    captions: weighted(27.52, [
      ['Deliver some stock first', 2],
      ['Switch to the floor worker\'s own login', 1.5],
      ['+ Spoilage: fish, location, kg', 2],
      ['Pick a reason and add a note', 2],
      ['Recorded as waste', 1.5],
    ]),
  },
  {
    n: '05', dir: 'single-05-confirm-happy-path', file: '05-confirm-arrival-happy-path.mp4', dur: 19.08,
    kicker: 'Tutorial · Inventory', brand: 'A Delivery That Matches',
    tag: 'The happy path for the in-transit workflow -- promised and measured line up exactly.',
    close: 'No discrepancy, no flag for reconciliation -- confirmation closes the loop cleanly.',
    captions: weighted(19.08, [
      ['Log a delivery as "in transit" first', 2.5],
      ['Confirm arrivals -- pick it up', 2],
      ['Measured kg matches exactly what was promised', 2],
      ['Confirmed -- no discrepancy at all', 1.5],
    ]),
  },
  {
    n: '06', dir: 'single-06-floor-repack', file: '06-floor-dashboard-repack.mp4', dur: 56.36,
    kicker: 'Tutorial · Inventory', brand: 'The Floor Dashboard',
    tag: 'What a worker actually sees: current stock by location, and consolidating near-empty tubs.',
    close: 'A container only ever exists already-filled -- an empty tub has to be earned by selling one out.',
    captions: weighted(56.36, [
      ['A quick delivery, packed into a small tub', 3],
      ['Sold out completely -- that tub is now empty', 2],
      ['A bigger delivery, packed into its own container', 3],
      ['Sold down to just a little left over', 2.5],
      ['The worker\'s own view: current stock by location', 2],
      ['Repack the dregs into the empty tub from earlier', 2],
    ]),
  },
  {
    n: '07', dir: 'single-07-pack-ownership', file: '07-pack-ownership-flag.mp4', dur: 20.68,
    kicker: 'Tutorial · Inventory', brand: 'Whose Box Is It?',
    tag: 'A new container can be flagged as the vendor\'s own, not just "ours."',
    close: 'Ownership only matters the moment a container number is genuinely new -- worth getting right once.',
    captions: weighted(20.68, [
      ['Deliver, then pack it into a container', 3],
      ['New container number -- whose box is it?', 2],
      ['"The vendor\'s -- came with this delivery"', 2],
      ['Packed, ownership on record', 1.5],
    ]),
  },
  {
    n: '08', dir: 'single-08-direct-sale', file: '08-direct-storage-sale.mp4', dur: 19.12,
    kicker: 'Tutorial · Inventory', brand: 'Selling Straight From Storage',
    tag: 'No container involved at all -- the other half of the sale cascade.',
    close: 'Containers first, then un-contained storage -- this is what "then storage" looks like.',
    captions: weighted(19.12, [
      ['Deliver -- and don\'t pack it into anything', 2.5],
      ['+ Sale: the fish is still sitting un-contained', 2],
      ['Sold directly out of storage', 2],
    ]),
  },
  {
    n: '09', dir: 'single-09-add-customer', file: '09-add-customer.mp4', dur: 17.4,
    kicker: 'Tutorial · Money & Customers', brand: 'Add a Customer',
    tag: 'Name and phone up front; credit terms and preferences tucked behind "More settings."',
    close: 'A five-second add for a walk-in buyer, with real credit terms available when they matter.',
    captions: weighted(17.4, [
      ['Customers -- add a new one', 2],
      ['Name and phone -- that\'s the minimum', 2],
      ['More settings: what they usually buy, a credit limit', 2.5],
      ['Added', 1],
    ]),
  },
  {
    n: '10', dir: 'single-10-record-payment', file: '10-record-payment.mp4', dur: 29.76,
    kicker: 'Tutorial · Money & Customers', brand: 'Record a Payment',
    tag: 'Pick a customer, see what they owe, record what actually came in.',
    close: 'Outstanding balance recalculates instantly -- no separate reconciliation step needed.',
    captions: weighted(29.76, [
      ['A fresh sale, so there\'s something to owe', 3],
      ['Payments -- pick the customer', 2],
      ['Their outstanding balance, sale by sale', 2],
      ['Record what came in, and how', 2],
    ]),
  },
  {
    n: '11', dir: 'single-11-whatsapp-share', file: '11-share-bill-whatsapp.mp4', dur: 24.84,
    kicker: 'Tutorial · Money & Customers', brand: 'Share a Bill Over WhatsApp',
    tag: 'A real draft built from the bill\'s own lines -- fully editable before it goes anywhere.',
    close: 'Nothing sends automatically -- this preloads the share sheet, the admin still hits send.',
    captions: weighted(24.84, [
      ['Receive a bill, then open it to share', 2.5],
      ['Mark shared -- choose WhatsApp', 2],
      ['A real draft, and a generated picture too', 2.5],
      ['Sent -- marked as shared', 1.5],
    ]),
  },
  {
    n: '12', dir: 'single-12-add-vendor', file: '12-add-vendor.mp4', dur: 16.08,
    kicker: 'Tutorial · Money & Customers', brand: 'Add a Vendor',
    tag: 'Same five-second discipline as adding a customer -- name and phone first.',
    close: 'Port, boat name, typical catch, reliability -- all optional, all there when it\'s worth recording.',
    captions: weighted(16.08, [
      ['Manage vendors -- add one', 2],
      ['Name and phone', 1.5],
      ['More settings: port, typical catch', 2],
      ['Added', 1],
    ]),
  },
  {
    n: '13', dir: 'single-13-defer-reconciliation', file: '13-defer-reconciliation.mp4', dur: 27.48,
    kicker: 'Tutorial · Money & Customers', brand: 'Defer With a Reminder',
    tag: 'A credit bill doesn\'t have to be settled today -- set a reminder instead.',
    close: 'Two distinct actions, not one ambiguous form: settle now, or defer with a real reminder date.',
    captions: weighted(27.48, [
      ['A delivery on credit, not paid today', 3],
      ['Bills -- reconcile or defer', 2],
      ['"Defer with a reminder" instead of settling now', 2],
      ['A reminder date, and a note for later', 2],
    ]),
  },
  {
    n: '14', dir: 'single-14-self-reverse', file: '14-admin-self-reverse.mp4', dur: 33.6,
    kicker: 'Tutorial · Trust & Corrections', brand: 'Self-Reverse a Sale',
    tag: 'A trusted admin can approve their own correction instantly -- when that permission is on.',
    close: 'can_self_reverse is admin/co-admin only, and off by default -- this is what it unlocks.',
    captions: weighted(33.6, [
      ['Deliver, then sell it as the admin', 3],
      ['Reversals -- request one against the sale just made', 2.5],
      ['Auto-approved instantly -- no second admin needed', 2],
      ['Execute -- stock and money both undone', 2],
    ]),
  },
  {
    n: '15', dir: 'single-15-deny-reversal', file: '15-admin-denies-reversal.mp4', dur: 35.16,
    kicker: 'Tutorial · Trust & Corrections', brand: 'Denying a Reversal',
    tag: 'Not every request gets approved -- the sale stands, on record either way.',
    close: 'A denial is still a decision on record, not a silent drop.',
    captions: weighted(35.16, [
      ['A rep sells, then requests a reversal', 3.5],
      ['Reason given, sent for review', 2],
      ['Admin reviews the same request', 2],
      ['Deny -- the sale stands', 2],
    ]),
  },
  {
    n: '16', dir: 'single-16-notifications', file: '16-notifications-bell.mp4', dur: 22.08,
    kicker: 'Tutorial · Trust & Corrections', brand: 'Notifications',
    tag: 'A bill comes in -- the admin sees it land in their own inbox.',
    close: 'Each notification type carries its own destination -- tap it, land where it matters.',
    captions: weighted(22.08, [
      ['A rep receives a bill', 2.5],
      ['Admin\'s own notification bell lights up', 2],
      ['Mark all read', 1.5],
    ]),
  },
  {
    n: '17', dir: 'single-17-audit-log', file: '17-audit-log.mp4', dur: 12.08,
    kicker: 'Tutorial · Trust & Corrections', brand: 'The Audit Log',
    tag: 'Every insert, update, and delete -- filterable by table, user, and date.',
    close: 'Written by trigger only, admin-only to read -- a real, tamper-resistant record.',
    captions: weighted(12.08, [
      ['Filter by table', 1.5],
      ['Expand a row to see the real before/after', 1.5],
      ['Reset filters', 1],
    ]),
  },
  {
    n: '18', dir: 'single-18-complaint-rejected', file: '18-complaint-fully-rejected.mp4', dur: 43.36,
    kicker: 'Tutorial · Trust & Corrections', brand: 'A Complaint, Rejected',
    tag: 'Not every complaint has merit -- this is what "no refund at all" looks like.',
    close: 'The same screen handles all three outcomes: bad, restocked, or rejected outright.',
    captions: weighted(43.36, [
      ['Deliver, then sell it', 3],
      ['A complaint gets filed against the sale', 2.5],
      ['Admin reviews it', 1.5],
      ['All of it rejected -- no defect shown', 2.5],
      ['Resolved -- zero refund', 1.5],
    ]),
  },
  {
    n: '19', dir: 'single-19-cancel-task', file: '19-cancel-delegated-task.mp4', dur: 16.08,
    kicker: 'Tutorial · Trust & Corrections', brand: 'Cancel a Delegated Task',
    tag: 'Plans change -- a task that\'s no longer needed can just be called off.',
    close: 'Cancelled stays on the record, distinct from completed -- the history is honest either way.',
    captions: weighted(16.08, [
      ['A custom task, auto-assigned', 2.5],
      ['Cancel it from the recent delegations list', 2],
      ['Cancelled', 1],
    ]),
  },
  {
    n: '20', dir: 'single-20-edit-vendor', file: '20-edit-vendor.mp4', dur: 15.56,
    kicker: 'Tutorial · Trust & Corrections', brand: 'Edit an Existing Vendor',
    tag: 'Tap any vendor to update what\'s known about them.',
    close: 'The same simple form works for adding and editing -- nothing new to learn.',
    captions: weighted(15.56, [
      ['Tap a vendor to edit them', 2],
      ['Update their reliability and notes', 2],
      ['Saved', 1],
    ]),
  },
  {
    n: '21', dir: 'single-21-add-warehouse', file: '21-add-warehouse.mp4', dur: 12.36,
    kicker: 'Tutorial · Admin Setup', brand: 'Add a Warehouse',
    tag: 'One field: what to call it. Everything else is derived.',
    close: 'A second real warehouse, ready the moment it\'s needed.',
    captions: weighted(12.36, [
      ['Warehouses -- add one', 1.5],
      ['Just a name', 1.5],
      ['Added', 1],
    ]),
  },
  {
    n: '22', dir: 'single-22-add-fish-type', file: '22-add-fish-type.mp4', dur: 15.72,
    kicker: 'Tutorial · Admin Setup', brand: 'Add a Fish Type',
    tag: 'Five fields up front; shelf life and storage tucked behind "More settings."',
    close: 'A brand-new SKU, ready to receive and sell within seconds.',
    captions: weighted(15.72, [
      ['Manage fish types -- add a new one', 2],
      ['English name, Tamil name, type, size', 2],
      ['Shelf life, in More settings', 1.5],
      ['Added', 1],
    ]),
  },
  {
    n: '23', dir: 'single-23-invite-team', file: '23-invite-team-member.mp4', dur: 16.56,
    kicker: 'Tutorial · Admin Setup', brand: 'Invite Someone New',
    tag: 'A real link to share by hand -- nothing sends itself.',
    close: 'They set their own password with it. The admin never sees or sets it for them.',
    captions: weighted(16.56, [
      ['Team -- invite someone new', 2],
      ['Email, name, role', 2],
      ['A link -- copy it, share it yourself', 2],
    ]),
  },
  {
    n: '24', dir: 'single-24-role-change-orphan', file: '24-role-change-orphan-warning.mp4', dur: 25.12,
    kicker: 'Tutorial · Admin Setup', brand: 'Turning Off Access',
    tag: 'Someone with an open task loses access -- what happens to their work?',
    close: 'Force-reassigned automatically the moment access turns off -- nothing is ever silently dropped.',
    captions: weighted(25.12, [
      ['Invite someone, hand them a task', 3.5],
      ['Open their team profile', 1.5],
      ['Turn off access -- a warning about their open task', 2.5],
      ['Saved -- the task moves to someone who can still do it', 2],
    ]),
  },
  {
    n: '25', dir: 'single-25-self-reverse-toggle', file: '25-toggle-self-reverse.mp4', dur: 10.88,
    kicker: 'Tutorial · Admin Setup', brand: 'Granting Self-Reverse',
    tag: 'Admin/co-admin only, off by default -- this is the switch.',
    close: 'A trigger clears this the instant someone leaves admin tier -- it can never quietly linger.',
    captions: weighted(10.88, [
      ['Open a co-admin\'s profile', 1.5],
      ['Grant instant self-reverse approval', 1.5],
      ['Saved', 1],
    ]),
  },
  {
    n: '26', dir: 'single-26-round-robin', file: '26-auto-assign-round-robin.mp4', dur: 11.04,
    kicker: 'Tutorial · Task Coordination', brand: 'Auto-Assign, Round Robin',
    tag: 'Don\'t pick anyone -- let the system find whoever\'s least loaded right now.',
    close: 'The same pool round_robin draws from is exactly who the manual grid would offer.',
    captions: weighted(11.04, [
      ['Delegate tasks -- pick a vendor', 1.5],
      ['Auto-assign instead of choosing by hand', 1.5],
      ['Picked -- whoever\'s carrying the least right now', 1],
    ]),
  },
  {
    n: '27', dir: 'single-27-custom-task', file: '27-custom-task-start-complete.mp4', dur: 22.92,
    kicker: 'Tutorial · Task Coordination', brand: 'A Custom Task, By Hand',
    tag: 'No underlying action to auto-complete it -- Start and Mark complete are real buttons here.',
    close: 'Every other task type closes itself; a custom one is the one exception, on purpose.',
    captions: weighted(22.92, [
      ['Delegate a custom task, assign it by hand', 3],
      ['The worker sees it under My tasks', 2],
      ['Start', 1],
      ['Mark complete', 1.5],
    ]),
  },
  {
    n: '28', dir: 'single-28-pack-repack-task', file: '28-delegate-pack-repack-task.mp4', dur: 61.96,
    kicker: 'Tutorial · Task Coordination', brand: 'A Task That Closes Itself',
    tag: 'Pack or repack anything, and a delegated pack/repack task completes on its own.',
    close: 'No "mark complete" anywhere in this flow -- the real work is the proof.',
    captions: weighted(61.96, [
      ['Pack a small tub, sell it out completely', 3.5],
      ['A bigger delivery, packed, mostly sold', 3.5],
      ['Admin delegates a "Pack / repack" task', 2],
      ['The worker repacks the dregs into the empty tub', 3],
      ['Done -- the task closed itself', 1.5],
    ]),
  },
  {
    n: '29', dir: 'single-29-my-tasks-worker', file: '29-my-tasks-worker-view.mp4', dur: 9.04,
    kicker: 'Tutorial · Task Coordination', brand: 'My Tasks',
    tag: 'What\'s been delegated, and what\'s already done -- one worker\'s own view.',
    close: 'Nothing to chase down -- it\'s all sitting right here, from either side of it.',
    captions: weighted(9.04, [
      ['Open tasks, and what\'s already been finished', 2],
    ]),
  },
  {
    n: '30', dir: 'single-30-search', file: '30-search-fish-customer.mp4', dur: 15.04,
    kicker: 'Tutorial · Search', brand: 'Find Anything, Fast',
    tag: 'One box: fish (English, Tamil, or Tanglish), customers, vendors, employees, phone numbers.',
    close: 'Real stock, real purchase history, real balances -- one search away.',
    captions: weighted(15.04, [
      ['Search a fish name', 1.5],
      ['Real stock across every warehouse', 2],
      ['Search a customer -- their whole purchase history', 2],
    ]),
  },
];

for (const v of VIDEOS) {
  mkdirSync(`${v.dir}/assets`, { recursive: true });
  mkdirSync(`${v.dir}/renders`, { recursive: true });
  cpSync('tutorial-purchase/package.json', `${v.dir}/package.json`);
  cpSync('tutorial-purchase/hyperframes.json', `${v.dir}/hyperframes.json`);
  cpSync('tutorial-purchase/CLAUDE.md', `${v.dir}/CLAUDE.md`);
  cpSync('tutorial-purchase/AGENTS.md', `${v.dir}/AGENTS.md`);
  writeFileSync(`${v.dir}/package.json`, JSON.stringify({ name: v.dir, private: true, type: 'module', scripts: {
    dev: 'npx --yes hyperframes@0.8.36 preview', check: 'npx --yes hyperframes@0.8.36 check',
    render: 'npx --yes hyperframes@0.8.36 render', publish: 'npx --yes hyperframes@0.8.36 publish',
  } }, null, 2));
  writeFileSync(`${v.dir}/meta.json`, JSON.stringify({ id: v.dir, name: v.dir, createdAt: new Date().toISOString() }, null, 2));
  cpSync(`${RAW}/${v.file}`, `${v.dir}/assets/${v.file}`);

  const { html, totalDuration } = buildHtml({
    dir: v.dir,
    videoFile: v.file,
    videoId: `${v.dir}-recording`,
    rawDuration: v.dur,
    titleKicker: v.kicker,
    titleBrand: v.brand,
    titleTag: v.tag,
    headerKicker: v.kicker,
    headerHeadline: v.brand,
    captions: v.captions,
    closeBrand: 'Jayshankar',
    closeTag: v.close,
  });
  writeFileSync(`${v.dir}/index.html`, html);
  console.log(`${v.n}: wrote ${v.dir}/index.html (${totalDuration}s)`);
}
