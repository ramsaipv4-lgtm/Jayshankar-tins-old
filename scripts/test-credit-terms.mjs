#!/usr/bin/env node
// test-credit-terms.mjs — live test for migration 0013 (customers.credit_limit/
// credit_period_days + the customer_credit_status view). Records real unpaid/partially-paid
// sales against a test customer and confirms the derived view computes outstanding balance,
// over-limit flag, and days-overdue correctly — read back under real RLS (vendor-rep), not the
// secret key, since the view's security_invoker=true design specifically means it must respect
// the querying user's own permissions.

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
function userIdFromToken(token) { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub; }
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
  if (!res.ok) throw new Error(`insert ${table} failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body[0] : body;
}
async function delEq(headers, table, col, val) { await fetch(`${URL}/rest/v1/${table}?${col}=eq.${val}`, { method: 'DELETE', headers }); }

const created = { customers: [], sales: [], payments: [] };
async function cleanup() {
  console.log('\n--- Cleanup ---');
  for (const id of created.payments) await delEq(secret, 'payments', 'id', id);
  for (const id of created.sales) await delEq(secret, 'sales', 'id', id);
  for (const id of created.customers) await delEq(secret, 'customers', 'id', id);
  console.log('  done.');
}

async function main() {
  console.log('=== Migration 0013 (credit terms) live test ===\n');

  const adminToken = await signIn('admin@jayshankar.demo', 'DevPassword123!');
  const repToken = await signIn('rep@jayshankar.demo', 'DevPassword123!');
  const admin = asUser(adminToken), rep = asUser(repToken);
  const repId = userIdFromToken(repToken);

  const [warehouse] = await select(admin, 'warehouses', 'select=id&limit=1');
  const [sku] = await select(admin, 'skus', 'select=id&active=eq.true&limit=1');
  const [location] = await select(admin, 'locations', 'select=id&active=eq.true&limit=1');

  // ============================================================
  console.log('--- Test 1: no sales yet -- outstanding_balance is 0, is_over_limit false ---');
  const cust1 = await insert(admin, 'customers', { name: 'Probe Customer 1', warehouse_id: warehouse.id, credit_limit: 5000, credit_period_days: 15 });
  created.customers.push(cust1.id);
  const status1 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust1.id}&select=*`))[0];
  assert(Number(status1.outstanding_balance) === 0, `outstanding_balance is 0 with no sales (got ${status1.outstanding_balance})`);
  assert(status1.is_over_limit === false, `is_over_limit is false (got ${status1.is_over_limit})`);
  assert(status1.oldest_unpaid_sale_at === null, `oldest_unpaid_sale_at is null (got ${status1.oldest_unpaid_sale_at})`);
  assert(status1.days_overdue === null, `days_overdue is null (got ${status1.days_overdue})`);

  // ============================================================
  console.log('\n--- Test 2: an unpaid sale below the limit -- balance shown, not over limit ---');
  const sale1 = await insert(rep, 'sales', { sku_id: sku.id, location_id: location.id, customer_id: cust1.id, customer_name: 'Probe Customer 1', total_kg: 10, sale_price_per_kg: 100, total_amount: 1000, sold_by: repId });
  created.sales.push(sale1.id);
  const status2 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust1.id}&select=*`))[0];
  assert(Number(status2.outstanding_balance) === 1000, `outstanding_balance is 1000 (got ${status2.outstanding_balance})`);
  assert(status2.is_over_limit === false, `still under the 5000 limit (got ${status2.is_over_limit})`);
  assert(status2.oldest_unpaid_sale_at !== null, `oldest_unpaid_sale_at is now set`);

  // ============================================================
  console.log('\n--- Test 3: a partial payment -- balance correctly reduces, not zeroed ---');
  const pay1 = await insert(rep, 'payments', { sale_id: sale1.id, amount: 400, method: 'cash', recorded_by: repId });
  created.payments.push(pay1.id);
  const status3 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust1.id}&select=*`))[0];
  assert(Number(status3.outstanding_balance) === 600, `outstanding_balance is 1000-400=600 (got ${status3.outstanding_balance})`);

  // ============================================================
  console.log('\n--- Test 4: fully paid -- balance returns to 0, oldest_unpaid_sale_at clears ---');
  const pay2 = await insert(rep, 'payments', { sale_id: sale1.id, amount: 600, method: 'cash', recorded_by: repId });
  created.payments.push(pay2.id);
  const status4 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust1.id}&select=*`))[0];
  assert(Number(status4.outstanding_balance) === 0, `outstanding_balance back to 0 (got ${status4.outstanding_balance})`);
  assert(status4.oldest_unpaid_sale_at === null, `oldest_unpaid_sale_at cleared now that everything's paid (got ${status4.oldest_unpaid_sale_at})`);

  // ============================================================
  console.log('\n--- Test 5: over the credit limit ---');
  const cust2 = await insert(admin, 'customers', { name: 'Probe Customer 2', warehouse_id: warehouse.id, credit_limit: 500 });
  created.customers.push(cust2.id);
  const sale2 = await insert(rep, 'sales', { sku_id: sku.id, location_id: location.id, customer_id: cust2.id, customer_name: 'Probe Customer 2', total_kg: 10, sale_price_per_kg: 100, total_amount: 1000, sold_by: repId });
  created.sales.push(sale2.id);
  const status5 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust2.id}&select=*`))[0];
  assert(Number(status5.outstanding_balance) === 1000, `outstanding_balance is 1000 (got ${status5.outstanding_balance})`);
  assert(status5.is_over_limit === true, `is_over_limit correctly true (1000 > limit 500), got ${status5.is_over_limit}`);

  // ============================================================
  console.log('\n--- Test 6: no limit set -- never flagged as over limit regardless of balance ---');
  const cust3 = await insert(admin, 'customers', { name: 'Probe Customer 3', warehouse_id: warehouse.id }); // credit_limit left NULL
  created.customers.push(cust3.id);
  const sale3 = await insert(rep, 'sales', { sku_id: sku.id, location_id: location.id, customer_id: cust3.id, customer_name: 'Probe Customer 3', total_kg: 100, sale_price_per_kg: 1000, total_amount: 100000, sold_by: repId });
  created.sales.push(sale3.id);
  const status6 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust3.id}&select=*`))[0];
  assert(status6.credit_limit === null, `credit_limit is null, as set (got ${status6.credit_limit})`);
  assert(status6.is_over_limit === false, `is_over_limit is false with no limit set, regardless of a huge balance (got ${status6.is_over_limit}, balance ${status6.outstanding_balance})`);

  // ============================================================
  console.log('\n--- Test 7: days_overdue -- a sale artificially backdated past its credit period ---');
  const cust4 = await insert(admin, 'customers', { name: 'Probe Customer 4', warehouse_id: warehouse.id, credit_period_days: 15 });
  created.customers.push(cust4.id);
  const backdated = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(); // 20 days ago
  const sale4 = await insert(secret, 'sales', { sku_id: sku.id, location_id: location.id, customer_id: cust4.id, customer_name: 'Probe Customer 4', total_kg: 5, sale_price_per_kg: 100, total_amount: 500, sold_by: repId, sold_at: backdated });
  created.sales.push(sale4.id);
  const status7 = (await select(rep, 'customer_credit_status', `customer_id=eq.${cust4.id}&select=*`))[0];
  assert(status7.days_overdue !== null && Number(status7.days_overdue) >= 4 && Number(status7.days_overdue) <= 6,
    `days_overdue is ~5 (20 days old - 15 day period), got ${status7.days_overdue}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch(err => { console.error('\nFATAL:', err.message, err.stack); fail++; })
  .finally(async () => { await cleanup(); process.exit(fail > 0 ? 1 : 0); });
