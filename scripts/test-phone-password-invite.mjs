#!/usr/bin/env node
// test-phone-password-invite.mjs — live test for D40 (phone invite, corrected sequence). Runs
// the exact same sequence the invite-user Edge Function's phone branch performs (create the
// account with BOTH the synthetic email and the real phone set in ONE call, generate the link
// for the already-existing user, never mutate the account again) and — the thing the original
// version of this script never actually checked — verifies the returned link really works.
//
// D37's ORIGINAL sequence (generate the link first, attach the phone via a separate
// updateUserById afterward) is the bug D40 fixes: that second write silently invalidates the
// token the first call just issued, on every single phone invite, unconditionally. Found live
// only once a real invite link was actually clicked (see SPEC.md D40) — this script's own
// earlier version proved the schema/RLS side was correct and, in doing so, never once asked
// "does the actual link work," which is exactly how the bug went unnoticed until a human tried
// it for real. Fixed here by adding that assertion, not just fixing the sequence.
//
// Cannot test from here: opening the link in an actual browser and typing a password — that's
// AcceptInvite.tsx's job, a real UI a human has to click through. This script proves the
// Admin-API/database sequence is correct up to and including a successful verifyOtp, which is
// the exact point the bug lived.

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
const ANON = rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY || scriptsEnv.SUPABASE_PUBLISHABLE_KEY;
const SECRET = scriptsEnv.SUPABASE_SECRET_KEY;
if (!URL || !ANON || !SECRET) { console.error('Missing URL / publishable key / secret key.'); process.exit(1); }

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.error(`  ✗ ${m}`); } }

const secret = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

// Same reserved-range test number as test-phone-identity.mjs, different last digit so the two
// scripts can run without colliding if run back to back.
const TEST_PHONE = '+919999900004';
const phoneDigits = TEST_PHONE.replace(/^\+/, '');
const syntheticEmail = `${phoneDigits}@phone.invalid`;

async function main() {
  console.log('== test-phone-password-invite.mjs (D40) ==\n');
  let userId = null;

  try {
    // Step 1 (D40): create the account with BOTH identifiers in ONE call. Mirrors the Edge
    // Function's phone branch exactly (raw REST shape here; the function itself goes through
    // supabase-js, whose response nests under data.user/data.properties -- same underlying
    // calls, different wrapper).
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: secret,
      body: JSON.stringify({
        email: syntheticEmail,
        phone: TEST_PHONE,
        phone_confirm: true,
        user_metadata: { role: 'worker', display_name: 'D40 Test Worker' },
      }),
    });
    const created = await createRes.json();
    assert(createRes.ok, `createUser with email+phone together succeeds (HTTP ${createRes.status})`);
    if (!createRes.ok) { console.error('  ', JSON.stringify(created)); return; }
    userId = created.id;
    assert(created.email === syntheticEmail, 'the account was created against the synthetic email');
    assert(created.phone === phoneDigits, 'the account already carries the real phone number — set at creation, not a later write');

    // Step 2 (D40): generate a link for the already-existing user. No write happens after this.
    const linkRes = await fetch(`${URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: secret,
      body: JSON.stringify({ type: 'invite', email: syntheticEmail }),
    });
    const linked = await linkRes.json();
    assert(linkRes.ok, `generateLink for the already-existing user succeeds (HTTP ${linkRes.status})`);

    // Confirm the leak this design has to guard against is real before "fixing" it: at this
    // point, BEFORE the correction step, public.users.email should still be the synthetic one.
    const beforeFix = await fetch(`${URL}/rest/v1/users?id=eq.${userId}&select=email,phone`, { headers: secret });
    const beforeRows = await beforeFix.json();
    assert(beforeRows[0]?.email === syntheticEmail, 'confirmed live: without correction, the synthetic email leaks straight into public.users (the bug the correction step exists to prevent)');

    // Step 3: fix public.users directly (handle_new_user() ran at createUser, using the
    // synthetic email).
    const fixRes = await fetch(`${URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...secret, Prefer: 'return=representation' },
      body: JSON.stringify({ email: null, phone: phoneDigits }),
    });
    const fixed = await fixRes.json();
    if (!fixRes.ok) console.error('  fix error body:', JSON.stringify(fixed));
    assert(fixRes.ok, `correcting public.users directly succeeds (HTTP ${fixRes.status})`);
    const fixedRow = Array.isArray(fixed) ? fixed[0] : fixed;
    assert(fixedRow?.email === null, 'public.users.email is NULL after correction — the synthetic email never surfaces in the app');
    assert(fixedRow?.phone === phoneDigits, 'public.users.phone holds the real phone number after correction');
    assert(fixedRow?.role === 'worker', 'role survived (set at createUser; the later generateLink call never touches metadata)');
    assert(fixedRow?.display_name === 'D40 Test Worker', 'display_name survived');

    // Step 4 (THE actual fix, verified, not assumed): does the returned link work? This is the
    // exact assertion the original version of this script never made -- and the bug it would
    // have caught immediately if it had.
    const verifyRes = await fetch(`${URL}/auth/v1/verify`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invite', token_hash: linked.hashed_token }),
    });
    const verifyBody = await verifyRes.json();
    if (!verifyRes.ok) console.error('  verify error body:', JSON.stringify(verifyBody));
    assert(verifyRes.ok, `the invite link's token VERIFIES successfully (HTTP ${verifyRes.status}) -- this is D40's actual fix`);
    assert(!!verifyBody.access_token, 'a real session access_token was returned from verifying it');
  } finally {
    if (userId) {
      await fetch(`${URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: secret });
      const check = await fetch(`${URL}/rest/v1/users?id=eq.${userId}&select=id`, { headers: secret });
      const rows = await check.json();
      assert(Array.isArray(rows) && rows.length === 0, 'cleanup: public.users row removed along with the auth user');
    }
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
