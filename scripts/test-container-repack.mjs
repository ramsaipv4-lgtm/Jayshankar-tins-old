#!/usr/bin/env node
// test-container-repack.mjs — live test for migration 0008's record_repack RPC.
// Same pattern as test-container-fill.mjs (signs in as real demo users — current_user_role()
// needs a real auth.uid(), the secret key can't exercise role checks; secret key is used only
// for read-back verification and cleanup).
//
// Cleanup note this script needs that test-container-fill.mjs didn't: movements now has
// ON DELETE RESTRICT back to container_fills on BOTH container_fill_id (source) and
// destination_container_fill_id — record_container_fill (0007) never wrote movements rows,
// but record_repack (0008) does, on every call. Cleanup must delete those movements rows
// before the container_fills they reference, or the container_fills delete fails silently
// leaves test data behind.
//
// Usage: node scripts/test-container-repack.mjs

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
const asAnon = { apikey: PUBLISHABLE, 'Content-Type': 'application/json' };
const asSecret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

async function rpc(headers, fn, args) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
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
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`insert ${table} failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body[0] : body;
}

async function delEq(headers, table, column, value) {
  const res = await fetch(`${URL}/rest/v1/${table}?${column}=eq.${value}`, { method: 'DELETE', headers });
  if (!res.ok) console.error(`  (cleanup) delete ${table} where ${column}=${value} failed: HTTP ${res.status} ${await res.text()}`);
}

const created = { container_fills: [], batches: [], bills: [], containers: [] };

async function cleanup() {
  console.log('\n--- Cleanup (secret key, bypasses RLS) ---');
  // movements → container_fills is ON DELETE RESTRICT on BOTH container_fill_id (source) and
  // destination_container_fill_id — must go first, on both columns, for every fill we touched.
  for (const id of created.container_fills) {
    await delEq(asSecret, 'movements', 'container_fill_id', id);
    await delEq(asSecret, 'movements', 'destination_container_fill_id', id);
  }
  for (const id of created.container_fills) await delEq(asSecret, 'container_fill_items', 'container_fill_id', id);
  for (const id of created.container_fills) await delEq(asSecret, 'container_fills', 'id', id);
  for (const id of created.batches) await delEq(asSecret, 'batches', 'id', id);
  for (const id of created.bills) await delEq(asSecret, 'bills', 'id', id);
  for (const id of created.containers) await delEq(asSecret, 'containers', 'id', id);
  console.log('  done.');
}

async function main() {
  console.log('=== record_repack live test ===\n');

  console.log('--- Setup ---');
  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const workerToken = await signIn('worker@jayshankar.demo', 'DevPassword123!');
  console.log('  ✓ signed in as admin and worker demo users');

  const vendors = await select(asUser(adminToken), 'vendors', 'select=id&active=eq.true&limit=1');
  if (!vendors.length) throw new Error('No active vendor found.');
  const vendorId = vendors[0].id;

  const skus = await select(asUser(adminToken), 'skus', 'select=id,shelf_life_hours&active=eq.true&order=shelf_life_hours.asc&limit=20');
  const distinctShelfLives = [...new Set(skus.map(s => s.shelf_life_hours))];
  if (distinctShelfLives.length < 2) throw new Error('Need at least 2 distinct shelf_life_hours values.');
  const skuShort = skus.find(s => s.shelf_life_hours === distinctShelfLives[0]);
  const skuLong = skus.find(s => s.shelf_life_hours === distinctShelfLives[distinctShelfLives.length - 1]);

  const locations = await select(asUser(adminToken), 'locations', 'select=id&active=eq.true&limit=1');
  if (!locations.length) throw new Error('No active location found.');
  const locationId = locations[0].id;

  const bill = await insert(asUser(adminToken), 'bills', { vendor_id: vendorId, vendor_bill_number: 'TEST-0008', total_amount: 1000 });
  created.bills.push(bill.id);

  const batchA = await insert(asUser(adminToken), 'batches', {
    sku_id: skuShort.id, vendor_id: vendorId, location_id: locationId, kg: 10, kg_remaining: 10, price_per_kg_paid: 100, bill_id: bill.id,
  });
  created.batches.push(batchA.id);
  const batchB = await insert(asUser(adminToken), 'batches', {
    sku_id: skuLong.id, vendor_id: vendorId, location_id: locationId, kg: 10, kg_remaining: 10, price_per_kg_paid: 150, bill_id: bill.id,
  });
  created.batches.push(batchB.id);
  console.log('  ✓ created 1 bill, 2 batches (10kg each)');

  // Source fill: 10kg across both batches (6+4), via the already-tested record_container_fill.
  const srcContainerNumber = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const srcFillResult = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: srcContainerNumber,
    p_capacity_kg: 20, p_items: [{ batch_id: batchA.id, kg: 6 }, { batch_id: batchB.id, kg: 4 }],
  });
  if (!srcFillResult.ok || srcFillResult.body.error) throw new Error(`setup: source fill creation failed: ${JSON.stringify(srcFillResult.body)}`);
  const sourceFillId = srcFillResult.body.container_fill_id;
  created.container_fills.push(sourceFillId);
  created.containers.push(srcFillResult.body.container_id);

  const sourceFillBefore = (await select(asSecret, 'container_fills', `id=eq.${sourceFillId}&select=filled_at,expires_at,kg_remaining,container_id`))[0];
  console.log(`  ✓ created source fill (10kg, expires_at=${sourceFillBefore.expires_at})`);

  // Destination container, capacity 10 — exactly fits.
  const destContainer = await insert(asUser(adminToken), 'containers', { container_number: `TEST-DEST-${Math.random().toString(36).slice(2, 8)}`, capacity_kg: 10 });
  created.containers.push(destContainer.id);

  console.log('\n--- Test 1: happy path, as WORKER (repack is open to workers, unlike receiving) ---');
  const t1 = await rpc(asUser(workerToken), 'record_repack', {
    p_source_fill_id: sourceFillId, p_destination_container_id: destContainer.id,
  });
  assert(t1.ok, `RPC returned HTTP ${t1.status} (expected 2xx): ${JSON.stringify(t1.body)}`);
  assert(t1.body && !t1.body.error, `no error in response: ${JSON.stringify(t1.body)}`);

  let destFillId = null;
  if (t1.body && t1.body.destination_container_fill_id) {
    destFillId = t1.body.destination_container_fill_id;
    created.container_fills.push(destFillId);
    assert(Number(t1.body.kg_moved) === 10, `kg_moved is 10 (got ${t1.body.kg_moved})`);
    assert(new Date(t1.body.expires_at).getTime() === new Date(sourceFillBefore.expires_at).getTime(),
      `returned expires_at exactly matches the SOURCE fill's original expires_at (not recomputed, not now()+something)`);

    const sourceFillAfter = (await select(asSecret, 'container_fills', `id=eq.${sourceFillId}&select=kg_remaining`))[0];
    assert(Number(sourceFillAfter.kg_remaining) === 0, `source fill's kg_remaining is now 0 (got ${sourceFillAfter.kg_remaining})`);

    const destFillRows = await select(asSecret, 'container_fills', `id=eq.${destFillId}&select=filled_at,expires_at,kg_remaining,location_id`);
    assert(destFillRows.length === 1, 'exactly one destination container_fills row persisted');
    if (destFillRows.length === 1) {
      const d = destFillRows[0];
      assert(Number(d.kg_remaining) === 10, `destination kg_remaining is 10 (got ${d.kg_remaining})`);
      assert(new Date(d.filled_at).getTime() === new Date(sourceFillBefore.filled_at).getTime(),
        `destination filled_at EXACTLY equals source's filled_at — the whole point of this fix: repack must never reset the freshness clock`);
      assert(new Date(d.expires_at).getTime() === new Date(sourceFillBefore.expires_at).getTime(),
        `destination expires_at EXACTLY equals source's expires_at`);
      assert(d.location_id === locationId, 'destination fill keeps the same location (repack consolidates, does not relocate)');
    }

    const destItems = await select(asSecret, 'container_fill_items', `container_fill_id=eq.${destFillId}&select=batch_id,kg&order=kg.desc`);
    assert(destItems.length === 2, `destination fill has 2 container_fill_items (got ${destItems.length})`);
    if (destItems.length === 2) {
      assert(Number(destItems[0].kg) === 6 && destItems[0].batch_id === batchA.id, 'item 1: batchA/6kg copied correctly');
      assert(Number(destItems[1].kg) === 4 && destItems[1].batch_id === batchB.id, 'item 2: batchB/4kg copied correctly');
    }

    const moveRows = await select(asSecret, 'movements', `movement_group_id=eq.${t1.body.movement_group_id}&select=kind,sku_id,batch_id,kg,container_fill_id,destination_container_fill_id,from_location_id,to_location_id&order=kg.desc`);
    assert(moveRows.length === 2, `exactly 2 movements rows (one per source item), got ${moveRows.length}`);
    for (const m of moveRows) {
      assert(m.kind === 'repack', `movement kind is 'repack' (got ${m.kind})`);
      assert(m.container_fill_id === sourceFillId, 'movement.container_fill_id references the SOURCE fill');
      assert(m.destination_container_fill_id === destFillId, 'movement.destination_container_fill_id references the DESTINATION fill');
      assert(m.from_location_id === locationId && m.to_location_id === locationId, 'from/to location both unchanged (consolidation, not relocation)');
    }

    // The trigger must NOT have touched batches.kg_remaining — repack isn't consumption.
    const batchesAfter = await select(asSecret, 'batches', `id=in.(${batchA.id},${batchB.id})&select=id,kg_remaining`);
    assert(batchesAfter.every(b => Number(b.kg_remaining) === 10), `batches.kg_remaining untouched by repack (still 10 each): ${JSON.stringify(batchesAfter)}`);
  }

  console.log('\n--- Test 2: repacking an already-empty source fill is rejected ---');
  const t2 = await rpc(asUser(adminToken), 'record_repack', { p_source_fill_id: sourceFillId, p_destination_container_id: destContainer.id });
  assert(t2.body && typeof t2.body.error === 'string' && /already empty/i.test(t2.body.error), `rejected with "already empty": ${JSON.stringify(t2.body)}`);

  console.log('\n--- Test 3: same-container guard ---');
  const src2ContainerNumber = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const src2 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: src2ContainerNumber,
    p_capacity_kg: 5, p_items: [{ batch_id: batchA.id, kg: 4 }], // batchA: 10 total, 6 already packed -> 4 available
  });
  if (!src2.ok || src2.body.error) throw new Error(`setup: second source fill failed: ${JSON.stringify(src2.body)}`);
  created.container_fills.push(src2.body.container_fill_id);
  created.containers.push(src2.body.container_id);

  const t3 = await rpc(asUser(adminToken), 'record_repack', {
    p_source_fill_id: src2.body.container_fill_id, p_destination_container_id: src2.body.container_id,
  });
  assert(t3.body && typeof t3.body.error === 'string' && /same container/i.test(t3.body.error), `rejected with "same container": ${JSON.stringify(t3.body)}`);

  console.log('\n--- Test 4: destination capacity too small ---');
  const src3ContainerNumber = `TEST-C-${Math.random().toString(36).slice(2, 8)}`;
  const src3 = await rpc(asUser(adminToken), 'record_container_fill', {
    p_bill_id: bill.id, p_location_id: locationId, p_container_number: src3ContainerNumber,
    p_capacity_kg: 10, p_items: [{ batch_id: batchB.id, kg: 6 }], // batchB: 10 total, 4 already packed -> 6 available
  });
  if (!src3.ok || src3.body.error) throw new Error(`setup: third source fill failed: ${JSON.stringify(src3.body)}`);
  created.container_fills.push(src3.body.container_fill_id);
  created.containers.push(src3.body.container_id);

  const smallDest = await insert(asUser(adminToken), 'containers', { container_number: `TEST-SMALL-${Math.random().toString(36).slice(2, 8)}`, capacity_kg: 5 });
  created.containers.push(smallDest.id);

  const t4 = await rpc(asUser(adminToken), 'record_repack', { p_source_fill_id: src3.body.container_fill_id, p_destination_container_id: smallDest.id });
  assert(t4.body && typeof t4.body.error === 'string' && /destination capacity/i.test(t4.body.error), `rejected with capacity error: ${JSON.stringify(t4.body)}`);

  console.log('\n--- Test 5: destination not available (already has stock) ---');
  const t5 = await rpc(asUser(adminToken), 'record_repack', { p_source_fill_id: src3.body.container_fill_id, p_destination_container_id: destContainer.id });
  assert(t5.body && typeof t5.body.error === 'string' && /not available/i.test(t5.body.error), `rejected with "not available": ${JSON.stringify(t5.body)}`);

  console.log('\n--- Test 6: unauthenticated (anon) call is rejected ---');
  const t6 = await rpc(asAnon, 'record_repack', { p_source_fill_id: src3.body.container_fill_id, p_destination_container_id: smallDest.id });
  assert(!t6.ok, `anon call rejected at the HTTP layer (got HTTP ${t6.status}, expected non-2xx)`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message); fail++; })
  .finally(async () => {
    await cleanup();
    process.exit(fail > 0 ? 1 : 0);
  });
