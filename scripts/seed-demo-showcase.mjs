#!/usr/bin/env node
// seed-demo-showcase.mjs — populates the Demo Warehouse with real data touching every feature
// built this sprint (CRM, bills, containers, reversals, notifications, tasks, check-ins), so the
// app has something to actually click through and show off. Deliberately NOT part of the
// zero-dependency validate/migration-runner rule (scripts/perf-check.mjs already carved out
// that exception) -- uses built-in fetch only, no new dependency either way.
//
// Calls the REAL RPCs, signed in as the real demo accounts -- not hand-crafted SQL inserts --
// so every cascade/validation/auto-completion path this project actually has is exercised for
// real, the same discipline every other piece of this sprint has been verified with. This data
// is meant to STAY (a demo showcase, not test-and-cleanup scratch), so every entity gets a
// plausible, presentable name -- matching SPEC.md Appendix A's own "plausible, not real people"
// convention for the original Mode A seed.
//
// Idempotent-ish: re-running creates a second round of demo data rather than erroring, since
// there's no natural unique key to conflict on for most of this (a customer name isn't unique).
// Meant to be run once; use scripts/reset-demo-warehouse.mjs first if you want to start over.
//
// Updated (2026-09-13) to reflect migrations 0030-0035, per the user's own "reseed to match the
// changed schema" instruction after a wipe-and-rebuild of the Demo Warehouse: the self-reverse
// demo (step 11, below) now uses the ADMIN account, not the rep -- can_self_reverse is admin/
// co-admin only as of migration 0033/decision #82, and the rep account this script used to
// toggle it on for would just get silently clamped back to false by that migration's own
// trigger now. Also adds in-transit delivery + confirm-arrival (with a deliberate discrepancy)
// and bill reconciliation (settle one, defer one with a reminder) -- the two biggest feature
// areas this schema update actually added.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[line.slice(0, eq).trim()] = val;
  }
  return env;
}

const scriptsEnv = loadEnv(resolve(import.meta.dirname, '.env'));
const baseUrl = scriptsEnv.SUPABASE_URL;
const anonKey = scriptsEnv.SUPABASE_PUBLISHABLE_KEY;
const secretKey = scriptsEnv.SUPABASE_SECRET_KEY;
const secretHeaders = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

async function signIn(email, password) {
  const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signIn ${email} failed: ${JSON.stringify(body)}`);
  return { access_token: body.access_token, user_id: body.user.id };
}
function asHeaders(token) { return { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
async function rpc(name, args, headers) {
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const body = await res.json();
  if (!res.ok || body?.error) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body;
}
async function get(path, headers = secretHeaders) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { headers });
  return res.json();
}
async function post(path, data, headers = secretHeaders) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(data) });
  const body = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed: ${JSON.stringify(body)}`);
  return body;
}
async function patch(path, data, headers = secretHeaders) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(data) });
  return res.json();
}

const step = (label) => console.log(`\n=== ${label} ===`);

// Unique per run, not a fixed 'TC-DEMO-01'/'TC-DEMO-02' -- found live, running this exact script
// against data a reset pass hadn't fully cleared: record_container_fill finds an existing
// ACTIVE container by number and, if its one fill has drained to kg_remaining=0 (not deleted,
// just spent), silently adds a SECOND fill onto the SAME physical container rather than
// erroring -- exactly the D50 container-reuse class of bug, just from a leftover row instead of
// a redesign gap. A fresh suffix sidesteps the question of whether cleanup was ever complete.
const RUN_ID = Date.now().toString(36);

const admin = await signIn('admin@jayshankar.demo', scriptsEnv.SEED_ADMIN_PASSWORD || 'DevPassword123!');
const rep = await signIn('rep@jayshankar.demo', scriptsEnv.SEED_REP_PASSWORD || 'DevPassword123!');
const worker = await signIn('worker@jayshankar.demo', scriptsEnv.SEED_WORKER_PASSWORD || 'DevPassword123!');
const adminH = asHeaders(admin.access_token);
const repH = asHeaders(rep.access_token);
const workerH = asHeaders(worker.access_token);

const [demoWh] = await get(`warehouses?select=id&name=eq.main`);
const [storageLoc] = await get(`locations?select=id&name=eq.storage`);
const [transitInLoc] = await get(`locations?select=id&warehouse_id=eq.${demoWh?.id}&kind=eq.in_transit_inbound`);
const [vendors] = [await get(`vendors?select=id,name&active=eq.true&limit=3`)];
const [skus] = [await get(`skus?select=id,english_name&active=eq.true&limit=6`)];
if (!demoWh || !storageLoc || !transitInLoc || vendors.length < 2 || skus.length < 4) {
  throw new Error('Demo warehouse/locations/vendors/SKUs missing prerequisite data -- aborting.');
}
console.log('Demo warehouse:', demoWh.id, '· storage location:', storageLoc.id, '· transit-in:', transitInLoc.id);
console.log('Vendors:', vendors.map((v) => v.name).join(', '));
console.log('SKUs:', skus.map((s) => s.english_name).join(', '));

// Let the ADMIN account self-approve reversals -- a real business setting (D22), turned on here
// specifically so the self-reverse path has something real to show. NOT the rep account any
// more: can_self_reverse is admin/co-admin only as of migration 0033/decision #82, enforced by
// a trigger that would just clamp this back to false on any other role.
await patch(`users?id=eq.${admin.user_id}`, { can_self_reverse: true });

step('1. Customers — a healthy one and one that will go over its credit limit');
const custHealthy = (await post('customers', {
  name: 'Saravana Stores', business_name: 'Saravana Fish Stores', phone: '9840012345',
  warehouse_id: demoWh.id, active: true, credit_limit: 50000, credit_period_days: 14,
  fish_preference: 'Pomfret, Seer fish',
}))[0];
const custOverLimit = (await post('customers', {
  name: 'Green Leaf Hotel', business_name: 'Green Leaf Hotel & Bar', phone: '9840099887',
  warehouse_id: demoWh.id, active: true, credit_limit: 2000, credit_period_days: 7,
}))[0];
console.log('customers:', custHealthy.name, '/', custOverLimit.name);

step('2. Tasks created BEFORE the actions that fulfill them, so auto-completion has something real to show');
const t1 = await rpc('create_task', { p_type: 'receive_delivery', p_assigned_to: rep.user_id, p_related_vendor_id: vendors[0].id, p_notes: 'Morning delivery' }, adminH);
const t2 = await rpc('create_task', { p_type: 'make_sale', p_assigned_to: rep.user_id, p_related_customer_id: custHealthy.id, p_notes: 'Regular order' }, adminH);
const t3 = await rpc('create_task_round_robin', { p_type: 'pack_repack', p_notes: "Pack today's catch" }, adminH);
const t4 = await rpc('create_task', { p_type: 'custom', p_assigned_to: worker.user_id, p_title: 'Deep-clean the display counter', p_notes: 'Weekly hygiene check' }, adminH);
console.log('tasks created:', [t1.task_id, t2.task_id, t3.task_id, t4.task_id]);

step('3. Check-ins for rep and worker');
await rpc('ensure_checked_in', {}, repH);
await rpc('ensure_checked_in', {}, workerH);

step('4. A real bill — 3 fish lines from the first vendor (completes task 1)');
const bill = await rpc('record_bill_delivery', {
  p_vendor_id: vendors[0].id, p_location_id: storageLoc.id, p_vendor_bill_number: 'DEMO-001',
  p_items: [
    { sku_id: skus[0].id, kg: 40, price_per_kg_paid: 320 },
    { sku_id: skus[1].id, kg: 25, price_per_kg_paid: 410 },
    { sku_id: skus[2].id, kg: 15, price_per_kg_paid: 560 },
  ],
}, repH);
console.log('bill:', bill.bill_id, '· total ₹' + bill.total_amount);

step('5. Pack container from the bill — flagged vendor_provided (migration 0033) since this box came with the delivery, not one the business owns');
const fill = await rpc('record_container_fill', {
  p_bill_id: bill.bill_id, p_location_id: storageLoc.id, p_container_number: `TC-DEMO-01-${RUN_ID}`, p_capacity_kg: 25,
  p_items: [{ batch_id: bill.batches[0].batch_id, kg: 20 }], p_ownership: 'vendor_provided',
}, repH);
console.log('container fill:', fill.container_fill_id, '· expires', fill.expires_at, '· ownership: vendor_provided');

step('6. A sale that draws from the packed container (stays standing — kept unreversed) — needed to draw the container down before repacking it in step 7');
const sale1 = await rpc('record_container_sale', {
  p_sku_id: skus[0].id, p_location_id: storageLoc.id, p_customer_name: 'ignored', p_total_kg: 12,
  p_sale_price_per_kg: 380, p_customer_id: custHealthy.id,
}, repH);
console.log('sale to', custHealthy.name, ':', sale1.sale_id, '· kg', sale1.kg_sold, '· from container:', sale1.container_sourced_kg, 'kg');

step('7. Repack the now-mostly-empty container into a smaller one — done by whoever the round-robin task (t3) actually assigned, so it genuinely auto-completes that exact task rather than assuming who got it. Done AFTER the sale above draws the fill down, since a repack destination must be large enough to hold what\'s left, not the original full fill');
const repackerHeaders = t3.assigned_to === worker.user_id ? workerH : repH;
console.log('  task 3 (pack_repack) was round-robin-assigned to:', t3.assigned_to === worker.user_id ? 'worker' : 'rep');
// record_repack needs a destination container that already exists (unlike record_container_fill,
// it never auto-registers a new number) -- register one directly, empty, ready to repack into.
const destContainer = (await post('containers', { container_number: `TC-DEMO-02-${RUN_ID}`, capacity_kg: 10 }))[0];
const repackResult = await rpc('record_repack', { p_source_fill_id: fill.container_fill_id, p_destination_container_id: destContainer.id }, repackerHeaders);
console.log('repack:', repackResult.destination_container_fill_id, '·', repackResult.kg_moved, 'kg moved');

step('8. Two more sales — one that will get a partial payment (kept standing), one that pushes a customer over their credit limit');
// sale4 is the one PaymentManagement shows a real partial-payment balance against — stays
// standing, never reversed.
const sale4 = await rpc('record_container_sale', {
  p_sku_id: skus[2].id, p_location_id: storageLoc.id, p_customer_name: 'ignored', p_total_kg: 4,
  p_sale_price_per_kg: 560, p_customer_id: custHealthy.id,
}, repH);
console.log('sale to', custHealthy.name, '(partial payment):', sale4.sale_id, '· kg', sale4.kg_sold);

const sale2 = await rpc('record_container_sale', {
  p_sku_id: skus[1].id, p_location_id: storageLoc.id, p_customer_name: 'ignored', p_total_kg: 6,
  p_sale_price_per_kg: 500, p_customer_id: custOverLimit.id, // 3000 > their 2000 limit -> customer_over_limit notification
}, repH);
console.log('sale to', custOverLimit.name, '(over limit):', sale2.sale_id);

step('9. A partial payment against sale4 — leaves a real outstanding balance to show in PaymentManagement');
const sale4Total = Number(sale4.kg_sold) * 560;
await post('payments', { sale_id: sale4.sale_id, amount: Math.round(sale4Total * 0.6 * 100) / 100, method: 'upi', recorded_by: rep.user_id, notes: 'Partial payment, balance next visit' });
console.log('partial payment recorded (60% of ₹' + sale4Total.toFixed(2) + ')');

step('10. A vendor payment against the demo bill — partial, leaves a real vendor_credit_status balance');
await post('vendor_payments', { vendor_id: vendors[0].id, bill_id: bill.bill_id, amount: Math.round(bill.total_amount * 0.5 * 100) / 100, method: 'cash', recorded_by: admin.user_id, notes: 'Half paid on delivery' });
console.log('vendor payment recorded (50% of ₹' + bill.total_amount.toFixed(2) + ')');

step('11. A dedicated direct-batch sale (skus[1], never packed into any container) + a self-approved, executed reversal on it — as the ADMIN (can_self_reverse is admin/co-admin only, migration 0033)');
// Deliberately NOT reversing sale1 (or sale4/sale2) here: sale1 drew from the container that
// step 7 has since repacked away, and execute_sale_reversal restores kg to the ORIGINAL
// container_fill_id a movement references — it has no idea a repack happened afterward, so
// reversing a container-sourced sale after its source fill was repacked would "resurrect" stock
// in a container that's no longer physically holding anything, a real latent edge case worth
// flagging on its own rather than baking it silently into demo data. A direct-batch-sourced sale
// (one skus[1] delivery batch was never packed into a container at all) reverses cleanly.
const saleToReverse = await rpc('record_container_sale', {
  p_sku_id: skus[1].id, p_location_id: storageLoc.id, p_customer_name: 'ignored', p_total_kg: 5,
  p_sale_price_per_kg: 410, p_customer_id: custHealthy.id,
}, repH);
console.log('sale to be reversed:', saleToReverse.sale_id, '· direct-sourced kg:', saleToReverse.direct_sourced_kg);

const rev1 = await rpc('request_sale_reversal', { p_sale_id: saleToReverse.sale_id, p_reason: 'Customer wants a different fish' }, adminH);
console.log('reversal 1 (self-reverse, admin, can_self_reverse=true):', rev1.status);
if (rev1.status === 'approved') {
  const exec = await rpc('execute_sale_reversal', { p_reversal_request_id: rev1.id }, adminH);
  console.log('  executed:', exec.reversed_count, 'movement(s) reversed');
}

step('12. Third sale (a free-text, no-customer-linked buyer) + a second reversal request, from the REP — left pending for the admin to review, since a rep can never self-approve any more');
// p_customer_id explicitly null, not omitted — found live, running this exact call, that
// omitting the key entirely hits a real overload-resolution bug (migration 0026 fixes the
// database side; this fixes the one caller in this project that ever omitted the key).
const sale3 = await rpc('record_container_sale', {
  p_sku_id: skus[2].id, p_location_id: storageLoc.id, p_customer_name: custHealthy.name, p_total_kg: 3,
  p_sale_price_per_kg: 560, p_customer_id: null,
}, repH);
const rev2 = await rpc('request_sale_reversal', { p_sale_id: sale3.sale_id, p_reason: 'Weight looked short — please check' }, repH);
console.log('reversal 2 (rep, always pending now):', rev2.status);

step('13. In-transit delivery + arrival confirmation with a deliberate discrepancy (migrations 0031-0033) — promised 18kg, only 16kg + 1kg spoiled actually arrives');
const transitBill = await rpc('record_bill_delivery', {
  p_vendor_id: vendors[1].id, p_location_id: transitInLoc.id, p_vendor_bill_number: 'DEMO-002',
  p_items: [{ sku_id: skus[3].id, kg: 18, price_per_kg_paid: 300 }], p_payment_terms: 'credit',
}, repH);
console.log('promised (in transit):', transitBill.bill_id, '· 18kg promised');
const confirmation = await rpc('confirm_delivery_arrival', {
  p_batch_id: transitBill.batches[0].batch_id, p_destination_location_id: storageLoc.id,
  p_confirmed_good_kg: 16, p_confirmed_spoiled_kg: 1, p_notes: 'Iced properly but 1kg looked off on arrival',
}, repH);
console.log('confirmed: 16kg good + 1kg spoiled (found at receiving, not later) · discrepancy flagged:', confirmation.discrepancy_flag);

step('14. Bill reconciliation (migration 0034) — settle the discrepant bill above, and defer a second credit bill with a reminder');
const settled = await rpc('reconcile_bill', {
  p_bill_id: transitBill.bill_id, p_reconciled_total_amount: transitBill.total_amount - (2 * 300),
  p_notes: 'Vendor agreed to deduct the 2kg shortfall from this bill',
}, adminH);
console.log('settled at ₹' + (transitBill.total_amount - 600), '· reconciled_at:', settled.reconciled_at);

const creditBill = await rpc('record_bill_delivery', {
  p_vendor_id: vendors[2] ? vendors[2].id : vendors[0].id, p_location_id: storageLoc.id, p_vendor_bill_number: 'DEMO-003',
  p_items: [{ sku_id: skus[4] ? skus[4].id : skus[0].id, kg: 10, price_per_kg_paid: 250 }], p_payment_terms: 'credit',
}, repH);
const deferred = await rpc('reconcile_bill', { p_bill_id: creditBill.bill_id, p_remind_in_days: 10, p_notes: 'Settling next visit' }, adminH);
console.log('credit bill deferred, reminder set for:', deferred.deferred_to);

step('Done — Demo Warehouse now has real data across every feature built this sprint, including 0030-0035.');
console.log(JSON.stringify({
  customers: [custHealthy.name, custOverLimit.name],
  bill: bill.bill_id,
  containerFill: fill.container_fill_id,
  repacked: !!repackResult,
  sales: [sale1.sale_id, sale2.sale_id, sale3.sale_id, sale4.sale_id, saleToReverse.sale_id],
  tasks: { receive_delivery: t1.task_id, make_sale: t2.task_id, pack_repack: t3.task_id, custom: t4.task_id },
  reversals: { autoApproved: rev1.id, pendingAdminReview: rev2.id },
  inTransit: { promisedBill: transitBill.bill_id, confirmationId: confirmation.confirmation_id, discrepancyFlag: confirmation.discrepancy_flag },
  reconciliation: { settledBill: transitBill.bill_id, deferredBill: creditBill.bill_id, remindAt: deferred.deferred_to },
}, null, 2));
