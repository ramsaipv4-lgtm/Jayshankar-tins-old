#!/usr/bin/env node
// test-container-sale-spoilage.mjs — live test for migration 0009's record_container_sale /
// record_container_spoilage (§4.3.8). Same pattern as test-container-fill.mjs /
// test-container-repack.mjs: signs in as real demo users, seeds real data, reads results back
// via the secret key against what's actually persisted (not the RPC's self-report), cleans up
// everything it creates.
//
// Each test gets its OWN dedicated SKU (not shared) — the cascade draws FIFO across ALL stock
// for a given SKU+location, so two tests sharing a SKU would let the direct-fallback phase
// silently pull leftover stock from an earlier test instead of the batch that test itself
// created, making batch-specific assertions unreliable. Caught this before the first run, not
// after a confusing failure.
//
// Coverage, given this is a two-phase cascade with a derived per-(fill,batch) remaining
// computation (not just single-batch-fill like the older recordSale/recordSpoilage):
//   1. Simple container-sourced sale (one fill, one batch)
//   2. Multi-fill cascade in expires_at order (soonest-first)
//   3. Mixed-SKU fill isolation (selling SKU A doesn't touch SKU B's portion in the same fill)
//   4. Container-then-direct-fallback split within one call
//   5. Partially-packed batch: fallback offers only the un-packed remainder, no double-count
//   6. Shortfall reporting when requested > available
//   7. Zero stock -> error, no sales row created
//   8. Role checks: worker rejected for sale, allowed for spoilage
//   9. Cross-call double-sell prevention (a fill drawn to 0 by call 1 isn't reused by call 2)
//  10. Spoilage happy path + reason/notes concatenation, no sales row involved
//
// Usage: node scripts/test-container-sale-spoilage.mjs

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
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
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
async function select(headers, table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers });
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
  if (!res.ok) console.error(`  (cleanup) delete ${table} where ${col}=${val} failed: HTTP ${res.status}`);
}

const created = { bills: [], batches: [], container_fills: [], containers: [], sales: [], movement_group_ids: [] };

async function cleanup() {
  console.log('\n--- Cleanup (secret key, bypasses RLS) ---');
  for (const gid of created.movement_group_ids) await delEq(asSecret, 'movements', 'movement_group_id', gid);
  for (const id of created.sales) await delEq(asSecret, 'sales', 'id', id);
  for (const id of created.container_fills) await delEq(asSecret, 'container_fill_items', 'container_fill_id', id);
  for (const id of created.container_fills) await delEq(asSecret, 'container_fills', 'id', id);
  for (const id of created.batches) await delEq(asSecret, 'batches', 'id', id);
  for (const id of created.bills) await delEq(asSecret, 'bills', 'id', id);
  for (const id of created.containers) await delEq(asSecret, 'containers', 'id', id);
  console.log('  done.');
}

async function main() {
  console.log('=== record_container_sale / record_container_spoilage live test ===\n');

  console.log('--- Setup ---');
  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const workerToken = await signIn('worker@jayshankar.demo', 'DevPassword123!');
  const admin = asUser(adminToken);

  const vendors = await select(admin, 'vendors', 'select=id&active=eq.true&limit=1');
  const vendorId = vendors[0].id;
  // 10 DISTINCT SKUs, one dedicated per test (see file header) — avoids any cross-test stock
  // contamination via the FIFO cascade, which would otherwise silently draw from an earlier
  // test's leftover stock instead of the batch a later test itself created.
  const skus = await select(admin, 'skus', 'select=id,shelf_life_hours&active=eq.true&order=english_name.asc&limit=10');
  if (skus.length < 10) throw new Error(`Need >= 10 active SKUs for full test isolation, found ${skus.length}.`);
  const [sku1, sku2, sku3a, sku3b, sku4, sku6, sku7, sku8, sku9, sku10] = skus;
  const locations = await select(admin, 'locations', 'select=id&active=eq.true&limit=1');
  const locationId = locations[0].id;
  console.log(`  ✓ signed in, ${skus.length} distinct SKUs reserved, location=${locationId.slice(0, 8)}`);

  async function makeBillAndBatch(skuId, kg) {
    const bill = await insert(admin, 'bills', { vendor_id: vendorId, vendor_bill_number: `T7-${Math.random().toString(36).slice(2, 7)}`, total_amount: 100 });
    created.bills.push(bill.id);
    const batch = await insert(admin, 'batches', { sku_id: skuId, vendor_id: vendorId, location_id: locationId, kg, kg_remaining: kg, price_per_kg_paid: 100, bill_id: bill.id });
    created.batches.push(batch.id);
    return batch;
  }
  async function packFill(billId, items, capacity = 25) {
    const num = `T7-C-${Math.random().toString(36).slice(2, 7)}`;
    const r = await rpc(admin, 'record_container_fill', { p_bill_id: billId, p_location_id: locationId, p_container_number: num, p_capacity_kg: capacity, p_items: items });
    if (!r.ok || r.body.error) throw new Error(`packFill failed: ${JSON.stringify(r.body)}`);
    created.container_fills.push(r.body.container_fill_id);
    created.containers.push(r.body.container_id);
    return r.body;
  }
  function track(result) {
    if (result.body.movement_group_id) created.movement_group_ids.push(result.body.movement_group_id);
    if (result.body.sale_id) created.sales.push(result.body.sale_id);
  }

  // ============================================================
  console.log('\n--- Test 1: simple container-sourced sale ---');
  const t1batch = await makeBillAndBatch(sku1.id, 10);
  const t1fill = await packFill(t1batch.bill_id, [{ batch_id: t1batch.id, kg: 6 }]);
  const t1 = await rpc(admin, 'record_container_sale', { p_sku_id: sku1.id, p_location_id: locationId, p_customer_name: 'Test Customer', p_total_kg: 4, p_sale_price_per_kg: 200 });
  assert(t1.ok && !t1.body.error, `RPC succeeded: ${JSON.stringify(t1.body)}`);
  track(t1);
  assert(Number(t1.body.kg_sold) === 4, `kg_sold is 4 (got ${t1.body.kg_sold})`);
  assert(Number(t1.body.shortfall) === 0, `shortfall is 0 (got ${t1.body.shortfall})`);
  assert(Number(t1.body.container_sourced_kg) === 4, `all 4kg came from the container (got ${t1.body.container_sourced_kg})`);
  const t1fillAfter = (await select(asSecret, 'container_fills', `id=eq.${t1fill.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(t1fillAfter.kg_remaining) === 2, `fill kg_remaining is 6-4=2 (got ${t1fillAfter.kg_remaining})`);
  const t1batchAfter = (await select(asSecret, 'batches', `id=eq.${t1batch.id}&select=kg_remaining`))[0];
  assert(Number(t1batchAfter.kg_remaining) === 6, `batch kg_remaining decremented by the trigger to 10-4=6 (got ${t1batchAfter.kg_remaining})`);
  const t1sale = (await select(asSecret, 'sales', `id=eq.${t1.body.sale_id}&select=total_kg,total_amount,customer_name`))[0];
  assert(Number(t1sale.total_kg) === 4 && Number(t1sale.total_amount) === 800, `sales row correct: total_kg=4, total_amount=800 (got ${JSON.stringify(t1sale)})`);
  const t1move = await select(asSecret, 'movements', `movement_group_id=eq.${t1.body.movement_group_id}&select=container_fill_id,batch_id,kg,sale_id,kind`);
  assert(t1move.length === 1 && t1move[0].container_fill_id === t1fill.container_fill_id && t1move[0].sale_id === t1.body.sale_id, `1 movement row, correctly linked to fill and sale: ${JSON.stringify(t1move)}`);

  // ============================================================
  console.log('\n--- Test 2: multi-fill cascade, soonest-expiry-first ---');
  const t2batch1 = await makeBillAndBatch(sku2.id, 10);
  const fillEarly = await packFill(t2batch1.bill_id, [{ batch_id: t2batch1.id, kg: 3 }]);
  // Packing fillEarly FIRST naturally gives it an earlier filled_at, hence earlier expires_at
  // for the same SKU (expiry = filled_at + a fixed shelf-life constant) — no special-casing
  // needed, just pack the two fills in the order their expiry should end up in.
  const t2batch2 = await makeBillAndBatch(sku2.id, 10);
  const fillLate = await packFill(t2batch2.bill_id, [{ batch_id: t2batch2.id, kg: 5 }]);
  assert(new Date(fillEarly.expires_at).getTime() <= new Date(fillLate.expires_at).getTime(), `fillEarly really does expire at or before fillLate (${fillEarly.expires_at} vs ${fillLate.expires_at})`);
  // Sell 6kg of sku2: should drain fillEarly (3kg) then pull the remaining 3kg from fillLate.
  const t2 = await rpc(admin, 'record_container_sale', { p_sku_id: sku2.id, p_location_id: locationId, p_customer_name: 'Test Customer 2', p_total_kg: 6, p_sale_price_per_kg: 150 });
  assert(t2.ok && !t2.body.error, `RPC succeeded: ${JSON.stringify(t2.body)}`);
  track(t2);
  assert(Number(t2.body.kg_sold) === 6, `kg_sold is 6 (got ${t2.body.kg_sold})`);
  const t2move = await select(asSecret, 'movements', `movement_group_id=eq.${t2.body.movement_group_id}&select=container_fill_id,kg&order=kg.desc`);
  assert(t2move.length === 2, `2 movement rows (drew from both fills), got ${t2move.length}`);
  const earlyRow = t2move.find(m => m.container_fill_id === fillEarly.container_fill_id);
  const lateRow = t2move.find(m => m.container_fill_id === fillLate.container_fill_id);
  assert(earlyRow && Number(earlyRow.kg) === 3, `fillEarly fully drained: 3kg drawn (got ${earlyRow && earlyRow.kg})`);
  assert(lateRow && Number(lateRow.kg) === 3, `fillLate partially drawn: 3kg (got ${lateRow && lateRow.kg})`);
  const fillEarlyAfter = (await select(asSecret, 'container_fills', `id=eq.${fillEarly.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(fillEarlyAfter.kg_remaining) === 0, `fillEarly's kg_remaining is 0 (got ${fillEarlyAfter.kg_remaining})`);

  // ============================================================
  console.log('\n--- Test 3: mixed-SKU fill isolation ---');
  const t3batchA = await makeBillAndBatch(sku3a.id, 10);
  const t3batchB = await insert(admin, 'batches', { sku_id: sku3b.id, vendor_id: vendorId, location_id: locationId, kg: 10, kg_remaining: 10, price_per_kg_paid: 100, bill_id: t3batchA.bill_id });
  created.batches.push(t3batchB.id);
  const t3fill = await packFill(t3batchA.bill_id, [{ batch_id: t3batchA.id, kg: 4 }, { batch_id: t3batchB.id, kg: 5 }], 10);
  const t3 = await rpc(admin, 'record_container_sale', { p_sku_id: sku3a.id, p_location_id: locationId, p_customer_name: 'Test Customer 3', p_total_kg: 4, p_sale_price_per_kg: 100 });
  assert(t3.ok && !t3.body.error, `RPC succeeded: ${JSON.stringify(t3.body)}`);
  track(t3);
  const t3fillAfter = (await select(asSecret, 'container_fills', `id=eq.${t3fill.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(t3fillAfter.kg_remaining) === 5, `fill kg_remaining is 9-4=5 (SKU B's 5kg untouched), got ${t3fillAfter.kg_remaining}`);
  const t3bMovements = await select(asSecret, 'movements', `container_fill_id=eq.${t3fill.container_fill_id}&batch_id=eq.${t3batchB.id}&select=kg`);
  const skuBDrawn = t3bMovements.reduce((s, m) => s + Number(m.kg), 0);
  assert(skuBDrawn === 0, `SKU B's portion in the mixed fill was never drawn from (got ${skuBDrawn} kg drawn)`);

  // ============================================================
  console.log('\n--- Test 4: container + direct fallback split, partially-packed batch excluded correctly ---');
  const t4batch = await makeBillAndBatch(sku4.id, 10); // will pack 6, leave 4 unpacked
  const t4fill = await packFill(t4batch.bill_id, [{ batch_id: t4batch.id, kg: 6 }]);
  // Sell all 10kg: 6 should come from the container, 4 from the direct fallback (the SAME
  // batch's own un-packed remainder — sku4 has no other stock anywhere, so this is unambiguous)
  // — NOT 10 from direct (which would double-count the packed 6kg).
  const t4 = await rpc(admin, 'record_container_sale', { p_sku_id: sku4.id, p_location_id: locationId, p_customer_name: 'Test Customer 4', p_total_kg: 10, p_sale_price_per_kg: 120 });
  assert(t4.ok && !t4.body.error, `RPC succeeded: ${JSON.stringify(t4.body)}`);
  track(t4);
  assert(Number(t4.body.kg_sold) === 10, `kg_sold is 10 (got ${t4.body.kg_sold})`);
  assert(Number(t4.body.container_sourced_kg) === 6, `container_sourced_kg is exactly 6, the packed amount (got ${t4.body.container_sourced_kg})`);
  assert(Number(t4.body.direct_sourced_kg) === 4, `direct_sourced_kg is exactly 4, the UN-packed remainder -- not 10 (got ${t4.body.direct_sourced_kg})`);
  const t4batchAfter = (await select(asSecret, 'batches', `id=eq.${t4batch.id}&select=kg_remaining`))[0];
  assert(Number(t4batchAfter.kg_remaining) === 0, `batch fully drawn down to 0 across both phases (got ${t4batchAfter.kg_remaining})`);
  const t4move = await select(asSecret, 'movements', `movement_group_id=eq.${t4.body.movement_group_id}&select=container_fill_id,kg`);
  assert(t4move.length === 2, `2 movement rows: one container-sourced, one direct (got ${t4move.length})`);
  const directRow = t4move.find(m => m.container_fill_id === null);
  assert(directRow && Number(directRow.kg) === 4, `the direct-sourced row has container_fill_id=null and kg=4 (got ${JSON.stringify(directRow)})`);

  // ============================================================
  console.log('\n--- Test 6: shortfall when requested exceeds all available stock ---');
  await makeBillAndBatch(sku6.id, 3); // sku6 has exactly 3kg, nowhere else — deterministic shortfall
  const t6 = await rpc(admin, 'record_container_sale', { p_sku_id: sku6.id, p_location_id: locationId, p_customer_name: 'Test Customer 6', p_total_kg: 100, p_sale_price_per_kg: 100 });
  assert(t6.ok && !t6.body.error, `RPC succeeded (partial fulfillment, not an error): ${JSON.stringify(t6.body)}`);
  track(t6);
  assert(Number(t6.body.kg_sold) === 3, `kg_sold is exactly the 3kg available (got ${t6.body.kg_sold})`);
  assert(Number(t6.body.shortfall) === 97, `shortfall = 100 - 3 = 97 (got ${t6.body.shortfall})`);
  const t6sale = (await select(asSecret, 'sales', `id=eq.${t6.body.sale_id}&select=total_kg`))[0];
  assert(Number(t6sale.total_kg) === 3, `sales row uses the FULFILLED amount (3), not the requested 100 (got ${t6sale.total_kg})`);

  // ============================================================
  console.log('\n--- Test 7: zero stock -> error, no sales row created ---');
  // sku7 has zero batches/fills anywhere in this test run — a genuinely deterministic zero-stock
  // case, no draining dance needed.
  const t7 = await rpc(admin, 'record_container_spoilage', { p_sku_id: sku7.id, p_location_id: locationId, p_total_kg: 1, p_reason: 'testing zero stock' });
  assert(!t7.body.movement_group_id, 'no movement_group_id in the response (nothing was drawn)');
  assert(t7.body.error && Number(t7.body.shortfall) === 1, `zero-stock case returns an error + shortfall=requested: ${JSON.stringify(t7.body)}`);
  // (Not asserting "zero movements for sku7 ever" here — sku7 is a real demo SKU from the
  // original Mode A seed data and may have pre-existing historical movements unrelated to this
  // test run. The response's own error + empty movement_group_id + correct shortfall already
  // fully proves this CALL drew nothing.)

  // ============================================================
  console.log('\n--- Test 8: role checks ---');
  await makeBillAndBatch(sku8.id, 5);
  const t8sale = await rpc(asUser(workerToken), 'record_container_sale', { p_sku_id: sku8.id, p_location_id: locationId, p_customer_name: 'x', p_total_kg: 1, p_sale_price_per_kg: 1 });
  assert(!t8sale.ok, `worker rejected for record_container_sale (got HTTP ${t8sale.status}, expected non-2xx)`);
  const t8spoil = await rpc(asUser(workerToken), 'record_container_spoilage', { p_sku_id: sku8.id, p_location_id: locationId, p_total_kg: 1, p_reason: 'worker test' });
  assert(t8spoil.ok, `worker ALLOWED for record_container_spoilage (spoilage is a worker task): HTTP ${t8spoil.status}, ${JSON.stringify(t8spoil.body)}`);
  track(t8spoil);
  const anonSale = await rpc(asAnon, 'record_container_sale', { p_sku_id: sku8.id, p_location_id: locationId, p_customer_name: 'x', p_total_kg: 1, p_sale_price_per_kg: 1 });
  assert(!anonSale.ok, `anon rejected (got HTTP ${anonSale.status})`);

  // ============================================================
  console.log('\n--- Test 9: cross-call double-sell prevention ---');
  const t9batch = await makeBillAndBatch(sku9.id, 5);
  const t9fill = await packFill(t9batch.bill_id, [{ batch_id: t9batch.id, kg: 5 }]);
  const t9call1 = await rpc(admin, 'record_container_sale', { p_sku_id: sku9.id, p_location_id: locationId, p_customer_name: 'Call 1', p_total_kg: 5, p_sale_price_per_kg: 100 });
  track(t9call1);
  assert(Number(t9call1.body.kg_sold) === 5, `call 1 fully drains the fill (got ${t9call1.body.kg_sold})`);
  // Call 2, same SKU/location, sku9 has NO other stock anywhere -> must be a clean error, and
  // must NOT re-draw from the already-drained fill.
  const t9call2 = await rpc(admin, 'record_container_sale', { p_sku_id: sku9.id, p_location_id: locationId, p_customer_name: 'Call 2', p_total_kg: 1, p_sale_price_per_kg: 100 });
  assert(t9call2.body.error && !t9call2.body.movement_group_id, `call 2 correctly finds nothing left (error: ${t9call2.body.error})`);
  const t9fillAfter = (await select(asSecret, 'container_fills', `id=eq.${t9fill.container_fill_id}&select=kg_remaining`))[0];
  assert(Number(t9fillAfter.kg_remaining) === 0, `t9fill's kg_remaining still 0, not negative or re-incremented (got ${t9fillAfter.kg_remaining})`);

  // ============================================================
  console.log('\n--- Test 10: spoilage happy path + reason/notes concatenation ---');
  const t10batch = await makeBillAndBatch(sku10.id, 5);
  const t10fill = await packFill(t10batch.bill_id, [{ batch_id: t10batch.id, kg: 5 }]);
  const t10 = await rpc(admin, 'record_container_spoilage', { p_sku_id: sku10.id, p_location_id: locationId, p_total_kg: 3, p_reason: 'Ice melted', p_notes: 'found during morning check' });
  assert(t10.ok && !t10.body.error, `RPC succeeded: ${JSON.stringify(t10.body)}`);
  track(t10);
  assert(Number(t10.body.kg_spoiled) === 3, `kg_spoiled is 3 (got ${t10.body.kg_spoiled})`);
  const t10move = await select(asSecret, 'movements', `movement_group_id=eq.${t10.body.movement_group_id}&select=kind,notes,sale_id,container_fill_id`);
  assert(t10move.length === 1 && t10move[0].kind === 'spoilage' && t10move[0].sale_id === null, `1 spoilage movement, no sale_id: ${JSON.stringify(t10move)}`);
  assert(t10move[0].notes === 'Ice melted — found during morning check', `notes correctly concatenated as "reason — notes" (got "${t10move[0].notes}")`);
  assert(t10move[0].container_fill_id === t10fill.container_fill_id, `correctly container-sourced`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message, err.stack); fail++; })
  .finally(async () => { await cleanup(); process.exit(fail > 0 ? 1 : 0); });
