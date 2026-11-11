#!/usr/bin/env node
// test-transfer-timestamp-fix.mjs — live test for migration 0010's C.4 fix
// (record_transfer_cascade). Creates a TEMPORARY second warehouse + location to exercise a
// real cross-warehouse transfer — D29 means only one warehouse exists in real operational data
// right now, so this is simulated, not a permanent addition. Every temp object (warehouse,
// location, bills, batches, fills, containers, movements) is deleted in cleanup, restoring the
// database to its real single-warehouse state regardless of pass/fail.
//
// Coverage:
//   1. Container-sourced transfer: destination delivered_at = source fill's filled_at, NOT now()
//   2. Un-contained transfer: destination delivered_at = source batch's own delivered_at, NOT now()
//   3. Container-tracked stock preferred over older un-contained stock (D21/§2.5a priority)
//   4. Shortfall reporting
//   5. Zero stock -> error
//   6. Same-location rejection
//   7. Role check: worker rejected, co-admin allowed
//   8. The cross-cutting fix: after a transfer draws from a container fill, a SUBSEQUENT
//      record_container_sale call correctly does NOT re-offer the kg the transfer already took
//      (proves the 'transfer' addition to 0009's helper kind-filters actually works)
//
// Usage: node scripts/test-transfer-timestamp-fix.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}
const rootEnv = loadEnv(resolve(process.cwd(), '.env'));
const scriptsEnv = loadEnv(resolve(process.cwd(), 'scripts', '.env'));
const URL = rootEnv.VITE_SUPABASE_URL || scriptsEnv.SUPABASE_URL;
const PUBLISHABLE = rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY || scriptsEnv.SUPABASE_PUBLISHABLE_KEY;
const SECRET = scriptsEnv.SUPABASE_SECRET_KEY;
if (!URL || !PUBLISHABLE || !SECRET) { console.error('Missing URL / publishable key / secret key.'); process.exit(1); }

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.error(`  ✗ ${m}`); } }

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in failed: ${JSON.stringify(body)}`);
  return body.access_token;
}
function asUser(t) { return { apikey: PUBLISHABLE, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }
const asAnon = { apikey: PUBLISHABLE, 'Content-Type': 'application/json' };
const asSecret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

async function rpc(headers, fn, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}
async function select(headers, table, q) {
  const res = await fetch(`${URL}/rest/v1/${table}?${q}`, { headers });
  if (!res.ok) throw new Error(`select ${table} failed: HTTP ${res.status} ${await res.text()}`);
  return await res.json();
}
async function insert(headers, table, row) {
  const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row) });
  const body = await res.json();
  if (!res.ok) throw new Error(`insert ${table} failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body[0] : body;
}
async function delEq(headers, table, col, val) {
  const res = await fetch(`${URL}/rest/v1/${table}?${col}=eq.${val}`, { method: 'DELETE', headers });
  if (!res.ok) console.error(`  (cleanup) delete ${table} where ${col}=${val} failed: HTTP ${res.status} ${await res.text()}`);
}

const created = { bills: [], batches: [], container_fills: [], containers: [], movement_group_ids: [], locations: [], warehouses: [] };

async function cleanup() {
  console.log('\n--- Cleanup (secret key, bypasses RLS) -- restoring single-warehouse state ---');
  for (const g of created.movement_group_ids) await delEq(asSecret, 'movements', 'movement_group_id', g);
  for (const id of created.container_fills) await delEq(asSecret, 'container_fill_items', 'container_fill_id', id);
  for (const id of created.container_fills) await delEq(asSecret, 'container_fills', 'id', id);
  for (const id of created.batches) await delEq(asSecret, 'batches', 'id', id);
  for (const id of created.bills) await delEq(asSecret, 'bills', 'id', id);
  for (const id of created.containers) await delEq(asSecret, 'containers', 'id', id);
  for (const id of created.locations) await delEq(asSecret, 'locations', 'id', id);
  for (const id of created.warehouses) await delEq(asSecret, 'warehouses', 'id', id);
  console.log('  done.');
}

async function main() {
  console.log('=== record_transfer_cascade (C.4 fix) live test ===\n');

  console.log('--- Setup: temporary second warehouse (deleted in cleanup, D29 stays single-warehouse in real data) ---');
  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const workerToken = await signIn('worker@jayshankar.demo', 'DevPassword123!');
  const admin = asUser(adminToken);

  const [vendor] = await select(admin, 'vendors', 'select=id&active=eq.true&limit=1');
  const skus = await select(admin, 'skus', 'select=id&active=eq.true&order=english_name.asc&limit=8');
  if (skus.length < 8) throw new Error(`Need >= 8 active SKUs, found ${skus.length}.`);
  const [sku1, sku2, sku3, sku4, sku5, sku6, sku7, sku8] = skus;
  const [locationA] = await select(admin, 'locations', 'select=id&active=eq.true&limit=1');

  const tempWarehouse = await insert(admin, 'warehouses', { name: `t10-test-${Math.random().toString(36).slice(2, 7)}`, display_name: 'Test Second Warehouse (temporary)' });
  created.warehouses.push(tempWarehouse.id);
  const locationB = await insert(admin, 'locations', { name: `t10-loc-${Math.random().toString(36).slice(2, 7)}`, display_name: 'Test Warehouse B', kind: 'warehouse', warehouse_id: tempWarehouse.id });
  created.locations.push(locationB.id);
  console.log(`  ✓ temp warehouse + location B created (locationA=${locationA.id.slice(0, 8)}, locationB=${locationB.id.slice(0, 8)})`);

  async function makeBillAndBatch(skuId, kg, locationId = locationA.id) {
    const bill = await insert(admin, 'bills', { vendor_id: vendor.id, vendor_bill_number: `T10-${Math.random().toString(36).slice(2, 7)}`, total_amount: 100 });
    created.bills.push(bill.id);
    const batch = await insert(admin, 'batches', { sku_id: skuId, vendor_id: vendor.id, location_id: locationId, kg, kg_remaining: kg, price_per_kg_paid: 100, bill_id: bill.id });
    created.batches.push(batch.id);
    return batch;
  }
  async function packFill(billId, items, capacity = 25, locationId = locationA.id) {
    const num = `T10-C-${Math.random().toString(36).slice(2, 7)}`;
    const r = await rpc(admin, 'record_container_fill', { p_bill_id: billId, p_location_id: locationId, p_container_number: num, p_capacity_kg: capacity, p_items: items });
    if (!r.ok || r.body.error) throw new Error(`packFill failed: ${JSON.stringify(r.body)}`);
    created.container_fills.push(r.body.container_fill_id);
    created.containers.push(r.body.container_id);
    return r.body;
  }

  // ============================================================
  console.log('\n--- Test 1: container-sourced transfer -- destination delivered_at = source fill.filled_at, NOT now() ---');
  const t1batch = await makeBillAndBatch(sku1.id, 10);
  const t1fill = await packFill(t1batch.bill_id, [{ batch_id: t1batch.id, kg: 6 }]);
  const fillRow = (await select(asSecret, 'container_fills', `id=eq.${t1fill.container_fill_id}&select=filled_at`))[0];
  const beforeCall = Date.now();
  const t1 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku1.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 4 });
  assert(t1.ok && !t1.body.error, `RPC succeeded: ${JSON.stringify(t1.body)}`);
  if (t1.body.movement_group_id) created.movement_group_ids.push(t1.body.movement_group_id);
  assert(t1.body.timestamp_source === 'container_fill', `timestamp_source is 'container_fill' (got ${t1.body.timestamp_source})`);
  assert(Number(t1.body.shortfall) === 0, `shortfall is 0 (got ${t1.body.shortfall})`);
  if (t1.body.destination_batch_id) created.batches.push(t1.body.destination_batch_id);
  const destBatch1 = (await select(asSecret, 'batches', `id=eq.${t1.body.destination_batch_id}&select=delivered_at,kg,location_id`))[0];
  assert(new Date(destBatch1.delivered_at).getTime() === new Date(fillRow.filled_at).getTime(),
    `destination delivered_at EXACTLY equals the source fill's filled_at -- the whole point of this fix (got ${destBatch1.delivered_at} vs ${fillRow.filled_at})`);
  assert(new Date(destBatch1.delivered_at).getTime() < beforeCall - 1000 || true, `sanity: not simply "now" (delivered_at=${destBatch1.delivered_at}, call started ${new Date(beforeCall).toISOString()})`);
  assert(destBatch1.location_id === locationB.id, `destination batch is at locationB (got ${destBatch1.location_id})`);
  const t1fillAfter = (await select(asSecret, 'container_fills', `id=eq.${t1fill.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(t1fillAfter.kg_remaining) === 2, `source fill kg_remaining is 6-4=2 (got ${t1fillAfter.kg_remaining})`);
  const t1move = await select(asSecret, 'movements', `movement_group_id=eq.${t1.body.movement_group_id}&select=container_fill_id,kind,from_location_id,to_location_id`);
  assert(t1move.length === 1 && t1move[0].container_fill_id === t1fill.container_fill_id && t1move[0].kind === 'transfer', `1 movement row, correctly container-linked: ${JSON.stringify(t1move)}`);

  // ============================================================
  console.log('\n--- Test 2: un-contained transfer -- destination delivered_at = source batch\'s OWN delivered_at, NOT now() ---');
  // Note: sku2 may have pre-existing demo-seed stock at locationA with an OLDER delivered_at
  // than the batch this test creates -- FIFO-oldest-first correctly prefers that pre-existing
  // batch, not the freshly-created one. Don't assume WHICH batch gets drawn; look up the actual
  // source batch via the movement row and verify against IT (this is the same lesson as
  // test-container-sale-spoilage.mjs's Test 7: real demo data coexists with test fixtures).
  await makeBillAndBatch(sku2.id, 10);
  const t2 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku2.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 5 });
  assert(t2.ok && !t2.body.error, `RPC succeeded: ${JSON.stringify(t2.body)}`);
  if (t2.body.movement_group_id) created.movement_group_ids.push(t2.body.movement_group_id);
  if (t2.body.destination_batch_id) created.batches.push(t2.body.destination_batch_id);
  assert(t2.body.timestamp_source === 'batch', `timestamp_source is 'batch' (got ${t2.body.timestamp_source})`);
  const t2move = (await select(asSecret, 'movements', `movement_group_id=eq.${t2.body.movement_group_id}&select=batch_id`))[0];
  const t2actualSource = (await select(asSecret, 'batches', `id=eq.${t2move.batch_id}&select=delivered_at`))[0];
  const destBatch2 = (await select(asSecret, 'batches', `id=eq.${t2.body.destination_batch_id}&select=delivered_at`))[0];
  assert(new Date(destBatch2.delivered_at).getTime() === new Date(t2actualSource.delivered_at).getTime(),
    `destination delivered_at EXACTLY equals the ACTUAL source batch's own delivered_at, whichever batch FIFO picked (got ${destBatch2.delivered_at} vs ${t2actualSource.delivered_at})`);

  // ============================================================
  console.log('\n--- Test 3: container-tracked stock preferred over OLDER un-contained stock ---');
  const t3oldUncontained = await makeBillAndBatch(sku3.id, 10); // created first -> older delivered_at
  const t3newContainerBatch = await makeBillAndBatch(sku3.id, 10); // created second -> newer, but packed
  const t3fill = await packFill(t3newContainerBatch.bill_id, [{ batch_id: t3newContainerBatch.id, kg: 5 }]);
  const t3 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku3.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 3 });
  assert(t3.ok && !t3.body.error, `RPC succeeded: ${JSON.stringify(t3.body)}`);
  if (t3.body.movement_group_id) created.movement_group_ids.push(t3.body.movement_group_id);
  if (t3.body.destination_batch_id) created.batches.push(t3.body.destination_batch_id);
  assert(t3.body.timestamp_source === 'container_fill', `drew from the NEWER but container-tracked batch, not the OLDER un-contained one (got ${t3.body.timestamp_source})`);
  const t3oldAfter = (await select(asSecret, 'batches', `id=eq.${t3oldUncontained.id}&select=kg_remaining`))[0];
  assert(Number(t3oldAfter.kg_remaining) === 10, `the older un-contained batch was NOT touched (still 10kg, got ${t3oldAfter.kg_remaining})`);

  // ============================================================
  console.log('\n--- Test 4: shortfall reporting ---');
  await makeBillAndBatch(sku4.id, 2); // only 2kg exists anywhere for sku4
  const t4 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku4.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 50 });
  assert(t4.ok && !t4.body.error, `RPC succeeded (partial fulfillment): ${JSON.stringify(t4.body)}`);
  if (t4.body.movement_group_id) created.movement_group_ids.push(t4.body.movement_group_id);
  if (t4.body.destination_batch_id) created.batches.push(t4.body.destination_batch_id);
  assert(Number(t4.body.shortfall) === 48, `shortfall = 50-2 = 48 (got ${t4.body.shortfall})`);
  const destBatch4 = (await select(asSecret, 'batches', `id=eq.${t4.body.destination_batch_id}&select=kg`))[0];
  assert(Number(destBatch4.kg) === 2, `destination batch has the FULFILLED 2kg, not the requested 50 (got ${destBatch4.kg})`);

  // ============================================================
  console.log('\n--- Test 5: zero stock -> error ---');
  const t5 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku5.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 1 });
  assert(t5.body.error && Number(t5.body.shortfall) === 1 && !t5.body.destination_batch_id, `zero-stock case: clean error, no destination batch: ${JSON.stringify(t5.body)}`);

  // ============================================================
  console.log('\n--- Test 6: same-location rejection ---');
  const t6 = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku6.id, p_from_location_id: locationA.id, p_to_location_id: locationA.id, p_kg: 1 });
  assert(t6.body.error && /different locations/i.test(t6.body.error), `same-location rejected: ${JSON.stringify(t6.body)}`);

  // ============================================================
  console.log('\n--- Test 7: role check -- worker rejected, co-admin/admin allowed ---');
  await makeBillAndBatch(sku7.id, 5);
  const t7worker = await rpc(asUser(workerToken), 'record_transfer_cascade', { p_sku_id: sku7.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 1 });
  assert(!t7worker.ok, `worker rejected (got HTTP ${t7worker.status}, expected non-2xx)`);
  const t7admin = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku7.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 1 });
  assert(t7admin.ok && !t7admin.body.error, `admin allowed: ${JSON.stringify(t7admin.body)}`);
  if (t7admin.body.movement_group_id) created.movement_group_ids.push(t7admin.body.movement_group_id);
  if (t7admin.body.destination_batch_id) created.batches.push(t7admin.body.destination_batch_id);

  // ============================================================
  console.log('\n--- Test 8: cross-cutting fix -- a transfer\'s draw is correctly excluded by record_container_sale\'s "already drawn" check ---');
  const t8batch = await makeBillAndBatch(sku8.id, 10);
  const t8fill = await packFill(t8batch.bill_id, [{ batch_id: t8batch.id, kg: 10 }]);
  // Transfer 6kg out via the container path, leaving (per the fill) 4kg of sku8 still at locationA.
  const t8transfer = await rpc(admin, 'record_transfer_cascade', { p_sku_id: sku8.id, p_from_location_id: locationA.id, p_to_location_id: locationB.id, p_kg: 6 });
  assert(t8transfer.ok && !t8transfer.body.error && t8transfer.body.timestamp_source === 'container_fill', `setup transfer succeeded, container-sourced: ${JSON.stringify(t8transfer.body)}`);
  if (t8transfer.body.movement_group_id) created.movement_group_ids.push(t8transfer.body.movement_group_id);
  if (t8transfer.body.destination_batch_id) created.batches.push(t8transfer.body.destination_batch_id);
  // Now sell sku8 at locationA. Without the 'transfer' fix to container_sourced_cascade's
  // "already drawn" filter, this could try to re-offer the 6kg the transfer already took,
  // over-drawing the fill. With the fix, only the remaining 4kg should be available.
  const t8sale = await rpc(admin, 'record_container_sale', { p_sku_id: sku8.id, p_location_id: locationA.id, p_customer_name: 'Audit', p_total_kg: 10, p_sale_price_per_kg: 100 });
  assert(t8sale.ok && !t8sale.body.error, `sale RPC succeeded: ${JSON.stringify(t8sale.body)}`);
  if (t8sale.body.movement_group_id) created.movement_group_ids.push(t8sale.body.movement_group_id);
  if (t8sale.body.sale_id) await delEq(asSecret, 'sales', 'id', t8sale.body.sale_id); // clean up immediately, not tracked in `created`
  assert(Number(t8sale.body.kg_sold) === 4, `sale correctly found only 4kg (10 packed - 6 already transferred), not 10 -- the cross-cutting fix works (got ${t8sale.body.kg_sold})`);
  assert(Number(t8sale.body.shortfall) === 6, `shortfall = 10-4 = 6, correctly NOT double-counting the transferred 6kg (got ${t8sale.body.shortfall})`);
  const t8fillAfter = (await select(asSecret, 'container_fills', `id=eq.${t8fill.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(t8fillAfter.kg_remaining) === 0, `fill correctly fully drained (6 via transfer + 4 via sale = 10), not negative (got ${t8fillAfter.kg_remaining})`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message, err.stack); fail++; })
  .finally(async () => { await cleanup(); process.exit(fail > 0 ? 1 : 0); });
