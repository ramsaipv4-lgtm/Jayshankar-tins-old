#!/usr/bin/env node
// test-phone-identity.mjs — live test for migration 0014 (D35: nullable users.email,
// users_identity_present CHECK, handle_new_user() now mirrors phone). Creates one real phone-only
// auth user via the Admin API (same shape the invite-user Edge Function's phone branch uses:
// phone_confirm: true, no email, no password), confirms handle_new_user() produced a correct
// public.users row, then confirms the identity-presence CHECK actually rejects an all-null
// identity. Deletes the test user in cleanup either way.
//
// Cannot test from here: real SMS delivery / signInWithOtp+verifyOtp end to end -- that needs a
// real SMS provider connected in the Supabase Dashboard and a real phone to receive the code
// (SPEC.md §4.3.12's documented prerequisite). This script only proves the schema/trigger side.
//
// Run AFTER applying supabase/migrations/0014_phone_or_email_identity.sql.

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
const SECRET = scriptsEnv.SUPABASE_SECRET_KEY;
if (!URL || !SECRET) { console.error('Missing URL / secret key.'); process.exit(1); }

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.error(`  ✗ ${m}`); } }

const secret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

// A real, syntactically-valid but unassigned Indian mobile number range reserved for
// documentation/testing (matches E.164). Not dialable; used only so Supabase's own phone-format
// validation on admin.createUser passes.
//
// Verified live (see debug run, decision log): GoTrue stores/returns phone WITHOUT the leading
// '+' -- "+919999900001" in, "919999900001" back out, on both auth.users and (via the trigger)
// public.users. TEST_PHONE is what we SEND; comparisons below check against the digits-only
// form GoTrue actually stores, not a literal echo of what was sent.
const TEST_PHONE = '+919999900001';
const TEST_PHONE_STORED = TEST_PHONE.replace(/^\+/, '');

async function main() {
  console.log('== test-phone-identity.mjs (migration 0014 / D35) ==\n');
  let testUserId = null;

  try {
    // ------------------------------------------------------------
    // 1. Create a phone-only auth user via the Admin API -- the exact call the invite-user
    //    Edge Function's phone branch makes.
    // ------------------------------------------------------------
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: secret,
      body: JSON.stringify({
        phone: TEST_PHONE,
        phone_confirm: true,
        user_metadata: { role: 'worker', display_name: 'Phone Test Worker' },
      }),
    });
    const created = await createRes.json();
    assert(createRes.ok, `admin.createUser with phone_confirm:true succeeds (HTTP ${createRes.status})`);
    if (!createRes.ok) { console.error('  ', JSON.stringify(created)); return; }
    testUserId = created.id;
    assert(created.phone === TEST_PHONE_STORED, 'created auth.users row has the phone number');
    assert(!created.email, 'created auth.users row has no real email (GoTrue\'s own \'\' convention)');

    // ------------------------------------------------------------
    // 2. handle_new_user() should have fired and produced a matching public.users row.
    // ------------------------------------------------------------
    const puRes = await fetch(`${URL}/rest/v1/users?id=eq.${testUserId}&select=id,email,phone,role,display_name`, { headers: secret });
    const puRows = await puRes.json();
    assert(puRes.ok && puRows.length === 1, 'public.users row was created by handle_new_user()');
    const pu = puRows[0];
    if (pu) {
      assert(pu.phone === TEST_PHONE_STORED, 'public.users.phone was populated (previously never written by this trigger)');
      assert(pu.email === null, 'public.users.email is a real NULL, not the old \'\' sentinel');
      assert(pu.role === 'worker', 'role from user_metadata was applied');
      assert(pu.display_name === 'Phone Test Worker', 'display_name from user_metadata was applied');
    }

    // ------------------------------------------------------------
    // 3. The identity-presence CHECK should still reject an all-null identity -- confirm the
    //    constraint is real, not just assumed from reading the migration.
    // ------------------------------------------------------------
    const badRes = await fetch(`${URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...secret, Prefer: 'return=representation' },
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-00000000dead',
        email: null,
        phone: null,
        display_name: 'Should Never Exist',
        role: 'worker',
      }),
    });
    assert(!badRes.ok, 'inserting a row with both email and phone NULL is rejected');
    if (!badRes.ok) {
      const badBody = await badRes.json();
      assert(String(badBody.code) === '23514' || /identity_present/.test(JSON.stringify(badBody)), 'rejected specifically by users_identity_present, not some other error');
    }
  } finally {
    // ------------------------------------------------------------
    // Cleanup: delete the test auth user. handle_user_delete() (0001_init.sql) removes the
    // matching public.users row via the same cascade every other real deletion uses.
    // ------------------------------------------------------------
    if (testUserId) {
      await fetch(`${URL}/auth/v1/admin/users/${testUserId}`, { method: 'DELETE', headers: secret });
      const check = await fetch(`${URL}/rest/v1/users?id=eq.${testUserId}&select=id`, { headers: secret });
      const rows = await check.json();
      assert(Array.isArray(rows) && rows.length === 0, 'cleanup: public.users row removed along with the auth user');
    }
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
