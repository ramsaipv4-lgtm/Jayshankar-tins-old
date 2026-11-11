#!/usr/bin/env node
// test-container-fill.mjs — live test for migration 0007's compute_container_fill_expiry
// and record_container_fill RPCs, run against the real Supabase project (no local Postgres
// is reachable from this environment — same PostgREST-only constraint as probe-db.mjs).
//
// This is the test AGENT-BRIEF.md asks for: "get the shelf-life-timestamp fix covered by a
// test before moving on; it's the easiest thing in this whole amendment to get subtly wrong."
// record_container_fill is the prerequisite piece, so it's what gets the test first.
//
// IMPORTANT: current_user_role() reads auth.uid(), which is NULL for secret-key calls (no JWT
// subject) — so this test signs in as the real admin demo user via the Auth password grant,
// exactly like the app does, instead of bypassing RLS with the secret key. The secret key is
// used ONLY for read-back verification and cleanup afterward.
//
// Leaves no data behind: every row it creates (bills, batches, containers, container_fills,
// container_fill_items) is deleted at the end, in FK-safe order, even on assertion failure.
//
// Usage: node scripts/test-container-fill.mjs

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const rootEnv = loadEnv(resolve(process.cwd(), '.env'));
const scriptsEnv = loadEnv(resolve(process.cwd(), 'scripts', '.env'));

const URL = rootEnv.VITE_SUPABASE_URL || scriptsEnv.SUPABASE_URL;
const PUBLISHABLE = rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY || scriptsEnv.SUPABASE_PUBLISHABLE_KEY;
const SECRET = scriptsEnv.SUPABASE_SECRET_KEY;

if (!URL || !PUBLISHABLE || !SECRET) {
  console.error('Missing URL / publishable key / secret key. Check .env and scripts/.env.');
  process.exit(1);
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in failed for ${email}: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

function asUser(token) {
  return { apikey: PUBLISHABLE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
const asSecret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

async function rpc(headers, fn, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

async function select(headers, table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`select ${table} failed: HTTP ${res.status} ${await res.text()}`);
  return await res.json();
}

async function insert(headers, table, row) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`insert ${table} failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body[0] : body;
}

async function del(headers, table, idColumn, id) {
  const res = await fetch(`${URL}/rest/v1/${table}?${idColumn}=eq.${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) console.error(`  (cleanup) delete ${table} ${id} failed: HTTP ${res.status} ${await res.text()}`);
}

const created = { container_fills: [], batches: [], bills: [], containers: [] };

async function cleanup() {
  console.log('\n--- Cleanup (secret key, bypasses RLS) ---');
  // container_fill_items → container_fills is ON DELETE RESTRICT, not CASCADE — the items
  // MUST go first, and by container_fill_id (their own ids were never fetched/tracked).
  for (const id of created.container_fills) await del(asSecret, 'container_fill_items', 'container_fill_id', id);
  for (const id of created.container_fills) await del(asSecret, 'container_fills', 'id', id);
  for (const id of created.batches) await del(asSecret, 'batches', 'id', id);
  for (const id of created.bills) await del(asSecret, 'bills', 'id', id);
  for (const id of created.containers) await del(asSecret, 'containers', 'id', id);
  console.log('  done.');
}

async function main() {
  console.log('=== record_container_fill live test ===\n');

  console.log('--- Setup ---');
  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const workerToken = await signIn('worker@jayshankar.demo', 'DevPassword123!');
  console.log('  ✓ signed in as admin and worker demo users');

  const vendors = await select(asUser(adminToken), 'vendors', 'select=id&active=eq.true&limit=1');
  if (!vendors.length) throw new Error('No active vendor found — cannot build test batches.');
  const vendorId = vendors[0].id;

  const skus = await select(asUser(adminToken), 'skus', 'select=id,shelf_life_hours&active=eq.true&order=shelf_life_hours.asc&limit=20');
  const distinctShelfLives = [...new Set(skus.map(s => s.shelf_life_hours))];
  if (distinctShelfLives.length < 2) throw new Error('Need at least 2 distinct shelf_life_hours values among active SKUs to test the min() rule.');
  const skuShort = skus.find(s => s.shelf_life_hours === distinctShelfLives[0]); // shortest shelf life
  const skuLong = skus.find(s => s.shelf_life_hours === distinctShelfLives[distinctShelfLives.length - 1]); // a longer one
  console.log(`  ✓ using SKU A (shelf_life_hours=${skuShort.shelf_life_hours}) and SKU B (shelf_life_hours=${skuLong.shelf_life_hours})`);

  const locations = await select(asUser(adminToken), 'locations', 'select=id&active=eq.true&limit=1');
  if (!locations.length) throw new Error('No active location found.');
  const locationId = locations[0].id;

  const bill = await insert(asUser(adminToken), 'bills', {
    vendor_id: vendorId, vendor_bill_number: 'TEST-0007', total_amount: 1000,
  });
  created.bills.push(bill.id);
  const bill2 = await insert(asUser(adminToken), 'bills', {
    vendor_id: vendorId, vendor_bill_number: 'TEST-0007-B', total_amount: 500,
  });
  created.bills.push(bill2.id);
  console.log(`  ✓ created 2 test bills`);

  const batchA = await insert(asUser(adminToken), 'batches', {
    sku_id: skuShort.id, vendor_id: vendorId, location_id: locationId,
    kg: 10, kg_remaining: 10, price_per_kg_paid: 100, bill_id: bill.id,
  });
  created.batches.push(batchA.id);
  const batchB = await insert(asUser(adminToken), 'batches', {
    sku_id: skuLong.id, vendor_id: vendorId, location_id: locationId,
    kg: 10, kg_remaining: 10, price_per_kg_paid: 150, bill_id: bill.id,
  });
  created.batches.push(batchB.id);
  const batchOtherBill = await insert(asUser(adminToken), 'batches', {
    sku_id: skuShort.id, vendor_id: vendorId, location_id: locationId,
    kg: 5, kg_remaining: 5, price_per_kg_paid: 100, bill_id: bill2.id,
  });
  created.batches.push(batchOtherBill.id);
  // Dedicated, untouched-by-other-tests batch for Test 3 (capacity-exceeded) — batchA/batchB
  // both get partially consumed by Test 1 and Test 7/8 (the double-allocation guard), which
  // would make Test 3 hit that guard instead of the capacity check it's meant to exercise.
  const batchCapacityTest = await insert(asUser(adminToken), 'batches', {
    sku_id: skuShort.id, vendor_id: vendorId, location_id: locationId,
    kg: 10, kg_remaining: 10, price_per_kg_paid: 100, bill_id: bill.id,
  });
  created.batches.push(batchCapacityTest.id);
  console.log('  ✓ created 4 test batches (3 on bill A, 1 on bill B)');

  const containerNumber = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;

  console.log('\n--- Test 1: happy path (2 SKUs, different shelf lives → expiry uses the shorter one) ---');
  const beforeCall = Date.now();
  const t1 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id,
    p_location_id: locationId,
    p_container_number: containerNumber,
    p_capacity_kg: 20,
    p_items: [
      { batch_id: batchA.id, kg: 6 },
      { batch_id: batchB.id, kg: 4 },
    ],
  });
  assert(t1.ok, `RPC returned HTTP ${t1.status} (expected 2xx): ${JSON.stringify(t1.body)}`);
  assert(t1.body && !t1.body.error, `no error in response: ${JSON.stringify(t1.body)}`);
  if (t1.body && t1.body.container_fill_id) {
    created.container_fills.push(t1.body.container_fill_id);
    assert(t1.body.total_kg === 10 || t1.body.total_kg === '10' || Number(t1.body.total_kg) === 10, `total_kg is 10 (got ${t1.body.total_kg})`);

    const expiresAt = new Date(t1.body.expires_at).getTime();
    const expected = beforeCall + skuShort.shelf_life_hours * 3600 * 1000;
    const driftMs = Math.abs(expiresAt - expected);
    assert(driftMs < 10_000, `expires_at uses the SHORTER shelf life (${skuShort.shelf_life_hours}h), not the longer one — drift ${driftMs}ms (expected < 10000ms)`);

    // Read back directly (secret key) to confirm what's actually persisted, not just what
    // the RPC claimed — this is the point of the test, not the RPC's self-report.
    const fillRows = await select(asSecret, 'container_fills', `id=eq.${t1.body.container_fill_id}&select=filled_at,expires_at,kg_remaining`);
    assert(fillRows.length === 1, 'exactly one container_fills row persisted');
    if (fillRows.length === 1) {
      assert(Number(fillRows[0].kg_remaining) === 10, `persisted kg_remaining is 10 (got ${fillRows[0].kg_remaining})`);
      const persistedExpiry = new Date(fillRows[0].expires_at).getTime();
      assert(persistedExpiry === expiresAt, 'persisted expires_at matches what the RPC returned');
    }
    const itemRows = await select(asSecret, 'container_fill_items', `container_fill_id=eq.${t1.body.container_fill_id}&select=batch_id,kg`);
    assert(itemRows.length === 2, `exactly 2 container_fill_items rows persisted (got ${itemRows.length})`);
  }
  if (t1.body && t1.body.container_id) created.containers.push(t1.body.container_id);

  console.log('\n--- Test 2: re-using the same (still-loaded) container is rejected ---');
  const t2 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber,
    p_capacity_kg: 20, p_items: [{ batch_id: batchA.id, kg: 1 }],
  });
  assert(t2.body && typeof t2.body.error === 'string' && /not available/i.test(t2.body.error), `rejected with "not available": ${JSON.stringify(t2.body)}`);

  console.log('\n--- Test 3: capacity exceeded is rejected ---');
  const containerNumber2 = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const t3 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber2,
    p_capacity_kg: 5, p_items: [{ batch_id: batchCapacityTest.id, kg: 6 }],
  });
  assert(t3.body && typeof t3.body.error === 'string' && /exceeds container capacity/i.test(t3.body.error), `rejected with capacity error: ${JSON.stringify(t3.body)}`);
  if (t3.body && t3.body.container_id) created.containers.push(t3.body.container_id); // registered even though the fill itself was rejected

  console.log('\n--- Test 4: cross-bill item is rejected (one-purchase-event-per-fill rule) ---');
  const containerNumber3 = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const t4 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber3,
    p_capacity_kg: 20, p_items: [{ batch_id: batchOtherBill.id, kg: 2 }],
  });
  assert(t4.body && typeof t4.body.error === 'string' && /does not belong to bill/i.test(t4.body.error), `rejected with cross-bill error: ${JSON.stringify(t4.body)}`);
  if (t4.body && t4.body.container_id) created.containers.push(t4.body.container_id); // container gets registered even if the fill is rejected

  console.log('\n--- Test 5: worker role is rejected (receiving is not a worker task) ---');
  const containerNumber4 = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const t5 = await rpc(asUser(workerToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber4,
    p_capacity_kg: 20, p_items: [{ batch_id: batchA.id, kg: 1 }],
  });
  assert(!t5.ok, `worker call rejected at the HTTP layer (got HTTP ${t5.status}, expected non-2xx)`);

  console.log('\n--- Test 6: compute_container_fill_expiry helper directly (min() across SKUs) ---');
  const t6 = await rpc(asUser(adminToken), 'compute_container_fill_expiry', {
    p_filled_at: new Date(0).toISOString(),
    p_sku_ids: [skuShort.id, skuLong.id],
  });
  assert(t6.ok, `RPC returned HTTP ${t6.status}: ${JSON.stringify(t6.body)}`);
  if (t6.ok) {
    const got = new Date(t6.body).getTime();
    const want = new Date(0).getTime() + skuShort.shelf_life_hours * 3600 * 1000;
    assert(got === want, `uses min(shelf_life_hours) = ${skuShort.shelf_life_hours}h, not the longer SKU's (got ${t6.body})`);
  }

  console.log('\n--- Test 7: double-allocation guard — batchA already has 6kg packed (Test 1); requesting 5 more (only 4kg truly unpacked) is rejected even though kg_remaining still shows 10 ---');
  const containerNumber5 = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const t7 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber5,
    p_capacity_kg: 20, p_items: [{ batch_id: batchA.id, kg: 5 }],
  });
  assert(t7.body && typeof t7.body.error === 'string' && /available to pack/i.test(t7.body.error), `rejected with "available to pack" error: ${JSON.stringify(t7.body)}`);
  if (t7.body && t7.body.container_id) created.containers.push(t7.body.container_id); // registered even though the fill itself was rejected

  console.log('\n--- Test 8: packing exactly the remaining 4kg of batchA succeeds ---');
  const containerNumber6 = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const t8 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: containerNumber6,
    p_capacity_kg: 20, p_items: [{ batch_id: batchA.id, kg: 4 }],
  });
  assert(t8.ok && t8.body && !t8.body.error, `exactly-remaining pack succeeds: ${JSON.stringify(t8.body)}`);
  if (t8.body && t8.body.container_fill_id) created.container_fills.push(t8.body.container_fill_id);
  if (t8.body && t8.body.container_id) created.containers.push(t8.body.container_id);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message); fail++; })
  .finally(async () => {
    await cleanup();
    process.exit(fail > 0 ? 1 : 0);
  });
