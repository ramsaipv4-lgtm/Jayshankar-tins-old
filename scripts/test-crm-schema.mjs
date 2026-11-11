#!/usr/bin/env node
// test-crm-schema.mjs — live test for migration 0012 (customers/payments/reversal_requests/
// notifications/user_role_history) and the co-admin fix. Creates one temporary auth user (via
// the Admin API, same pattern as seed-auth-users.mjs) to actually test co-admin end to end —
// promote them, sign in as them, confirm current_user_role() and an admin-gated RLS action both
// see 'co-admin' correctly. Deletes that user and all other test data in cleanup.

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
  const b = await res.json(); if (!res.ok) throw new Error(JSON.stringify(b)); return b.access_token;
}
// The REAL, auth-linked user id, decoded straight from the JWT's sub claim — NOT looked up by
// email. Found live (see decision log): public.users has TWO rows per demo email — one real
// (matching auth.users, this is what auth.uid() resolves to), one a fixed-UUID leftover from
// the original Mode A raw-SQL seed with no matching auth.users row at all. An email lookup
// silently risks picking the wrong one, exactly as this script's first draft did.
function userIdFromToken(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
}
function asUser(t) { return { apikey: PUBLISHABLE, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }
const secret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

async function select(headers, table, q) {
  const res = await fetch(`${URL}/rest/v1/${table}?${q}`, { headers });
  if (!res.ok) throw new Error(`select ${table} failed: HTTP ${res.status} ${await res.text()}`);
  return await res.json();
}
async function insert(headers, table, row) {
  const res = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(row) });
  const body = await res.json();
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true, status: res.status, body: Array.isArray(body) ? body[0] : body };
}
async function update(headers, table, q, patch) {
  const res = await fetch(`${URL}/rest/v1/${table}?${q}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(patch) });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}
async function delEq(headers, table, col, val) {
  await fetch(`${URL}/rest/v1/${table}?${col}=eq.${val}`, { method: 'DELETE', headers });
}

const created = { customers: [], payments: [], reversal_requests: [], notifications: [], sales: [] };
let tempAuthUserId = null;

async function cleanup() {
  console.log('\n--- Cleanup ---');
  for (const id of created.notifications) await delEq(secret, 'notifications', 'id', id);
  for (const id of created.reversal_requests) await delEq(secret, 'reversal_requests', 'id', id);
  for (const id of created.payments) await delEq(secret, 'payments', 'id', id);
  for (const id of created.sales) await delEq(secret, 'sales', 'id', id);
  for (const id of created.customers) await delEq(secret, 'customers', 'id', id);
  if (tempAuthUserId) {
    // user_role_history rows are ON DELETE CASCADE from users, so deleting the auth user
    // (which cascades to public.users via handle_user_delete) cleans those up too.
    await fetch(`${URL}/auth/v1/admin/users/${tempAuthUserId}`, { method: 'DELETE', headers: secret });
  }
  console.log('  done.');
}

async function main() {
  console.log('=== Migration 0012 (CRM/payments/notifications/user_role_history) + co-admin fix live test ===\n');

  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const repToken = await signIn('rep@jayshankar.demo', 'DevPassword123!');
  const workerToken = await signIn('worker@jayshankar.demo', 'DevPassword123!');
  const admin = asUser(adminToken), rep = asUser(repToken), worker = asUser(workerToken);
  const adminId = userIdFromToken(adminToken), repId = userIdFromToken(repToken);

  const [warehouse] = await select(admin, 'warehouses', 'select=id&limit=1');
  const [sku] = await select(admin, 'skus', 'select=id&active=eq.true&limit=1');
  const [location] = await select(admin, 'locations', 'select=id&active=eq.true&limit=1');

  // ============================================================
  console.log('--- Test 1: the co-admin fix, end to end (not just the CHECK constraint) ---');
  const email = `probe-coadmin-${Date.now()}@jayshankar.demo`;
  const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST', headers: secret,
    body: JSON.stringify({ email, password: 'ProbePassword123!', email_confirm: true, user_metadata: { role: 'worker', display_name: 'Probe Co-admin' } }),
  });
  const createdUser = await createRes.json();
  assert(createRes.ok, `temp auth user created: ${JSON.stringify(createdUser.id ?? createdUser)}`);
  tempAuthUserId = createdUser.id;

  // Confirm the user_role_history trigger fired on INSERT (role='worker' initially).
  const historyAfterCreate = await select(secret, 'user_role_history', `user_id=eq.${tempAuthUserId}&select=role,effective_to`);
  assert(historyAfterCreate.length === 1 && historyAfterCreate[0].role === 'worker' && historyAfterCreate[0].effective_to === null,
    `trigger opened 1 history row on INSERT, role=worker, still open: ${JSON.stringify(historyAfterCreate)}`);

  // Promote to co-admin — this is the actual fix. Would have failed with a CHECK violation before 0012.
  const promote = await update(admin, 'users', `id=eq.${tempAuthUserId}`, { role: 'co-admin' });
  assert(promote.ok, `promoting to co-admin succeeded (was previously IMPOSSIBLE): HTTP ${promote.status}, ${JSON.stringify(promote.body)}`);

  // Confirm the trigger closed the old row and opened a new one.
  const historyAfterPromote = await select(secret, 'user_role_history', `user_id=eq.${tempAuthUserId}&select=role,effective_to&order=effective_from.asc`);
  assert(historyAfterPromote.length === 2, `trigger created a 2nd history row on role change (got ${historyAfterPromote.length})`);
  assert(historyAfterPromote[0].role === 'worker' && historyAfterPromote[0].effective_to !== null, `old 'worker' row closed (effective_to set)`);
  assert(historyAfterPromote[1].role === 'co-admin' && historyAfterPromote[1].effective_to === null, `new 'co-admin' row open`);

  // Sign in AS the newly-promoted co-admin and confirm an admin-gated action actually works —
  // not just that the role column says 'co-admin', but that current_user_role()/RLS treat it
  // as such. Use the containers_update_admin policy (admin/co-admin only) as the real test.
  // Create a throwaway container to test against rather than relying on one existing already
  // (it usually won't — every other test script in this project cleans up after itself).
  const coAdminToken = await signIn(email, 'ProbePassword123!');
  const coAdmin = asUser(coAdminToken);
  const probeContainer = await insert(admin, 'containers', { container_number: `PROBE-COADMIN-${Date.now()}`, capacity_kg: 5 });
  if (probeContainer.ok) {
    const asCoAdminUpdate = await update(coAdmin, 'containers', `id=eq.${probeContainer.body.id}`, { container_number: probeContainer.body.container_number });
    assert(asCoAdminUpdate.ok && asCoAdminUpdate.body.length === 1, `signed in AS the co-admin user, an admin/co-admin-gated RLS action (containers UPDATE) succeeds: HTTP ${asCoAdminUpdate.status}, ${JSON.stringify(asCoAdminUpdate.body)}`);
    const asWorkerUpdate = await update(worker, 'containers', `id=eq.${probeContainer.body.id}`, { container_number: probeContainer.body.container_number });
    assert(asWorkerUpdate.body.length === 0, `sanity: the SAME action correctly fails for plain worker (0 rows affected, got ${JSON.stringify(asWorkerUpdate.body)})`);
    await delEq(secret, 'containers', 'id', probeContainer.body.id);
  } else {
    assert(false, `setup: could not create a probe container to test against: ${JSON.stringify(probeContainer.body)}`);
  }

  // ============================================================
  console.log('\n--- Test 2: customers ---');
  const custInsert = await insert(rep, 'customers', { name: 'Probe Buyer', phone: '9999999999', warehouse_id: warehouse.id, follow_up_status: 'cold_call' });
  assert(custInsert.ok, `vendor-rep can INSERT a customer: HTTP ${custInsert.status}, ${JSON.stringify(custInsert.body)}`);
  if (custInsert.ok) created.customers.push(custInsert.body.id);

  const workerCustInsert = await insert(worker, 'customers', { name: 'Should Fail', warehouse_id: warehouse.id });
  assert(!workerCustInsert.ok, `worker CANNOT insert a customer (got HTTP ${workerCustInsert.status})`);

  // ============================================================
  console.log('\n--- Test 3: payments (append-only) ---');
  const saleInsert = await insert(rep, 'sales', { sku_id: sku.id, location_id: location.id, customer_name: 'Probe', total_kg: 1, sale_price_per_kg: 100, total_amount: 100, sold_by: repId });
  assert(saleInsert.ok, `setup: raw sales insert succeeded: ${JSON.stringify(saleInsert.body)}`);
  if (saleInsert.ok) created.sales.push(saleInsert.body.id);

  const payInsert = await insert(rep, 'payments', { sale_id: saleInsert.body.id, amount: 100, method: 'cash', recorded_by: repId });
  assert(payInsert.ok, `vendor-rep can INSERT a payment: HTTP ${payInsert.status}, ${JSON.stringify(payInsert.body)}`);
  if (payInsert.ok) created.payments.push(payInsert.body.id);

  const badAmount = await insert(rep, 'payments', { sale_id: saleInsert.body.id, amount: -5, recorded_by: repId });
  assert(!badAmount.ok, `payments.amount > 0 CHECK correctly rejects a negative amount (got HTTP ${badAmount.status})`);

  if (payInsert.ok) {
    const payUpdate = await update(rep, 'payments', `id=eq.${payInsert.body.id}`, { amount: 200 });
    assert(payUpdate.body.length === 0 || !payUpdate.ok, `payments has no UPDATE policy — attempted edit silently affects 0 rows: ${JSON.stringify(payUpdate.body)}`);
  }

  // ============================================================
  console.log('\n--- Test 4: reversal_requests ---');
  const revInsert = await insert(rep, 'reversal_requests', { sale_id: saleInsert.body.id, requested_by: repId, reason: 'Probe reversal' });
  assert(revInsert.ok, `vendor-rep can INSERT a reversal_request: HTTP ${revInsert.status}, ${JSON.stringify(revInsert.body)}`);
  if (revInsert.ok) created.reversal_requests.push(revInsert.body.id);

  if (revInsert.ok) {
    const repApprove = await update(rep, 'reversal_requests', `id=eq.${revInsert.body.id}`, { status: 'approved' });
    assert(repApprove.body.length === 0, `vendor-rep CANNOT approve their own reversal request (0 rows affected, got ${JSON.stringify(repApprove.body)})`);
    const adminApprove = await update(admin, 'reversal_requests', `id=eq.${revInsert.body.id}`, { status: 'approved', decided_by: adminId });
    assert(adminApprove.ok && adminApprove.body.length === 1, `admin CAN approve it: HTTP ${adminApprove.status}, ${JSON.stringify(adminApprove.body)}`);
  }

  // ============================================================
  console.log('\n--- Test 5: notifications (owner-only visibility) ---');
  const notifInsert = await insert(secret, 'notifications', { user_id: repId, type: 'probe_test', payload: { hello: 'world' }, role_at_creation: 'vendor-rep' });
  assert(notifInsert.ok, `secret key can insert a notification (simulating a future dispatch function): ${JSON.stringify(notifInsert.body)}`);
  if (notifInsert.ok) created.notifications.push(notifInsert.body.id);

  if (notifInsert.ok) {
    const ownRead = await select(rep, 'notifications', `id=eq.${notifInsert.body.id}&select=id`);
    assert(ownRead.length === 1, `the owning user (rep) CAN see their own notification`);
    const otherRead = await select(worker, 'notifications', `id=eq.${notifInsert.body.id}&select=id`);
    assert(otherRead.length === 0, `a DIFFERENT user (worker) CANNOT see it (RLS isolation)`);
    const markRead = await update(rep, 'notifications', `id=eq.${notifInsert.body.id}`, { read_at: new Date().toISOString() });
    assert(markRead.ok && markRead.body.length === 1, `the owner CAN mark their own notification read: HTTP ${markRead.status}`);
  }

  // ============================================================
  console.log('\n--- Test 6: user_role_history admin-only read ---');
  const repHistRead = await select(rep, 'user_role_history', 'select=id&limit=1');
  assert(repHistRead.length === 0, `vendor-rep CANNOT read user_role_history (0 rows via RLS, got ${repHistRead.length})`);
  const adminHistRead = await select(admin, 'user_role_history', 'select=id&limit=1');
  assert(adminHistRead.length >= 1, `admin CAN read user_role_history (got ${adminHistRead.length} row(s))`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message, err.stack); fail++; })
  .finally(async () => { await cleanup(); process.exit(fail > 0 ? 1 : 0); });
