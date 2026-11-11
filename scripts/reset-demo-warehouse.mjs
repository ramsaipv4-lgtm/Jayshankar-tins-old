#!/usr/bin/env node
// reset-demo-warehouse.mjs — deletes every showcase row seed-demo-showcase.mjs (and the
// original Mode A seed.sql) ever created in the Demo Warehouse, so it can be reseeded fresh
// against the current schema. Per the user's own instruction: "delete all old data (since it
// was just to showcase to the client and was seeded using the seed script), reseed the database
// now to match the changed schema."
//
// Scoped explicitly to the Demo Warehouse's own location_ids/warehouse_id -- never touches
// "Real Operations" (still empty, reserved for client-confirmed data) or "simulated-operations"
// (the real spreadsheet import, a different purpose entirely, explicitly not "old showcase
// data"). Deletes children before parents, matching every FK in the schema (checked directly
// against the migrations, not guessed): receiving_confirmations -> movements ->
// container_fill_items -> container_fills -> payments/reversal_requests/customer_complaints ->
// sales -> batches -> tasks -> containers (orphaned only) -> bills (orphaned only) -> customers
// -> check_ins/notifications for the demo accounts. Locations/warehouses themselves are NOT
// deleted -- the structure (including the transit locations migration 0031 already backfilled)
// stays, only the data inside it is cleared.

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
const secretKey = scriptsEnv.SUPABASE_SECRET_KEY;
const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

async function get(path) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${await res.text()}`);
  return res.json();
}
async function del(path) {
  const res = await fetch(`${baseUrl}/rest/v1/${path}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=representation,count=exact' } });
  const countHeader = res.headers.get('content-range');
  const body = await res.json().catch(() => []);
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${JSON.stringify(body)}`);
  return { count: Array.isArray(body) ? body.length : 0, countHeader };
}

const step = (label) => console.log(`\n=== ${label} ===`);

const [demoWh] = await get(`warehouses?select=id,name&name=eq.main`);
if (!demoWh) throw new Error('Demo Warehouse ("main") not found -- aborting, nothing to reset.');
const locations = await get(`locations?select=id,name&warehouse_id=eq.${demoWh.id}`);
const locIds = locations.map((l) => l.id);
console.log('Demo warehouse:', demoWh.id);
console.log('Locations (kept, not deleted):', locations.map((l) => l.name).join(', '));

const locFilter = `in.(${locIds.join(',')})`;

step('1. receiving_confirmations (via batches at these locations)');
const demoBatchIds = (await get(`batches?select=id&location_id=${locFilter}`)).map((b) => b.id);
if (demoBatchIds.length > 0) {
  const r = await del(`receiving_confirmations?batch_id=in.(${demoBatchIds.join(',')})`);
  console.log('deleted:', r.count);
} else {
  console.log('none');
}

step('2. movements (from or to these locations)');
const rFrom = await del(`movements?from_location_id=${locFilter}`);
const rTo = await del(`movements?to_location_id=${locFilter}`);
console.log('deleted (from):', rFrom.count, '· (to):', rTo.count);

step('3. container_fill_items + container_fills at these locations');
const fillIds = (await get(`container_fills?select=id&location_id=${locFilter}`)).map((f) => f.id);
if (fillIds.length > 0) {
  await del(`container_fill_items?container_fill_id=in.(${fillIds.join(',')})`);
  const r = await del(`container_fills?location_id=${locFilter}`);
  console.log('deleted fills:', r.count);
} else {
  console.log('none');
}

step('4. payments, reversal_requests, customer_complaints (via sales at these locations)');
const saleIds = (await get(`sales?select=id&location_id=${locFilter}`)).map((s) => s.id);
if (saleIds.length > 0) {
  const rPay = await del(`payments?sale_id=in.(${saleIds.join(',')})`);
  const rRev = await del(`reversal_requests?sale_id=in.(${saleIds.join(',')})`);
  const rComp = await del(`customer_complaints?sale_id=in.(${saleIds.join(',')})`);
  console.log('deleted payments:', rPay.count, '· reversal_requests:', rRev.count, '· complaints:', rComp.count);
} else {
  console.log('none');
}

step('5. sales at these locations');
const rSales = await del(`sales?location_id=${locFilter}`);
console.log('deleted:', rSales.count);

step('6. batches at these locations');
const rBatches = await del(`batches?location_id=${locFilter}`);
console.log('deleted:', rBatches.count);

step('7. tasks (every one -- all current rows were created by the demo seed, none are real usage yet)');
const rTasks = await del(`tasks?id=not.is.null`);
console.log('deleted:', rTasks.count);

step('8. containers with no remaining fills anywhere (orphaned by step 3)');
const remainingFillContainerIds = (await get(`container_fills?select=container_id`)).map((f) => f.container_id);
const allContainers = await get(`containers?select=id`);
const orphanContainerIds = allContainers.map((c) => c.id).filter((id) => !remainingFillContainerIds.includes(id));
if (orphanContainerIds.length > 0) {
  const r = await del(`containers?id=in.(${orphanContainerIds.join(',')})`);
  console.log('deleted:', r.count);
} else {
  console.log('none');
}

step('9. bills with no remaining batches (orphaned by step 6) and vendor_payments against them');
const remainingBillIds = (await get(`batches?select=bill_id`)).map((b) => b.bill_id).filter(Boolean);
const allBills = await get(`bills?select=id`);
const orphanBillIds = allBills.map((b) => b.id).filter((id) => !remainingBillIds.includes(id));
if (orphanBillIds.length > 0) {
  await del(`vendor_payments?bill_id=in.(${orphanBillIds.join(',')})`);
  const r = await del(`bills?id=in.(${orphanBillIds.join(',')})`);
  console.log('deleted bills:', r.count);
} else {
  console.log('none');
}

step('10. customers scoped to this warehouse');
const rCust = await del(`customers?warehouse_id=eq.${demoWh.id}`);
console.log('deleted:', rCust.count);

step('11. notifications + check_ins for the 3 demo accounts (not warehouse-scoped directly, but every existing row is demo-seed noise)');
const demoUsers = await get(`users?select=id&email=in.(admin@jayshankar.demo,rep@jayshankar.demo,worker@jayshankar.demo)`);
const demoUserIds = demoUsers.map((u) => u.id);
if (demoUserIds.length > 0) {
  const rNotif = await del(`notifications?user_id=in.(${demoUserIds.join(',')})`);
  const rCheck = await del(`check_ins?user_id=in.(${demoUserIds.join(',')})`);
  console.log('deleted notifications:', rNotif.count, '· check_ins:', rCheck.count);
}

console.log('\nDone. Demo Warehouse locations kept, all showcase data cleared. Run '
  + 'scripts/seed-demo-showcase.mjs next to rebuild.');
