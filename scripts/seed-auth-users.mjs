#!/usr/bin/env node
// seed-auth-users.mjs — create the 3 demo auth users in Supabase Auth.
//
// Why this exists: SPEC §App A.7 lists 3 demo users (admin, vendor-rep, worker)
// but the seed.sql can NOT insert into auth.users (Supabase Auth manages that
// table; only the secret key can write to it via the Admin API; passwords are
// hashed and the SQL Editor has no API access). So we do it here, from a Node
// script, using the REST API + the secret key.
//
// Idempotent: re-runs update existing users' role/display_name instead of
// failing. Safe to re-run after every reset.
//
// Zero dependencies — uses Node 18+'s built-in `fetch`. Reads SUPABASE_URL
// and SUPABASE_SECRET_KEY from `scripts/.env` (see `.env.example`).
//
// Usage:
//   cp scripts/.env.example scripts/.env
//   # edit .env, paste your real values
//   node scripts/seed-auth-users.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader (no dotenv dependency). Parses KEY=VALUE lines, ignoring
// comments and blank lines. Strips surrounding single/double quotes from values.
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

const envPath = resolve(process.cwd(), 'scripts', '.env');
const env = loadEnv(envPath);
const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
// SUPABASE_SECRET_KEY is the new name (Supabase's @supabase/server convention).
// Older setups used SUPABASE_SERVICE_ROLE_KEY; we don't fall back to that name
// because silently accepting the old name would mask config drift. If you have
// a legacy .env, rename the var.
const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.');
  console.error(`Looked in: ${envPath} and process.env.`);
  console.error('Fix: copy scripts/.env.example to scripts/.env and fill in the values.');
  console.error('Find the values in Supabase Dashboard → Project Settings → API Keys.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

// Demo user roster — SPEC §App A.7.
const DEMO_USERS = [
  {
    email: 'admin@jayshankar.demo',
    password: env.SEED_ADMIN_PASSWORD || 'DevPassword123!',
    role: 'admin',
    display_name: 'Karthik (the wholesaler)',
  },
  {
    email: 'rep@jayshankar.demo',
    password: env.SEED_REP_PASSWORD || 'DevPassword123!',
    role: 'vendor-rep',
    display_name: 'Anitha',
  },
  {
    email: 'worker@jayshankar.demo',
    password: env.SEED_WORKER_PASSWORD || 'DevPassword123!',
    role: 'worker',
    display_name: 'Suresh',
  },
];

async function listUsers() {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`listUsers failed (${res.status}): ${text}`);
  }
  const body = await res.json();
  return body.users || [];
}

async function createUser({ email, password, role, display_name }) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // skip the email-confirmation dance for demo users
      user_metadata: { role, display_name },
    }),
  });
  if (res.status === 422) {
    // Already exists — return null; caller will resolve via listUsers.
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createUser(${email}) failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function updatePublicUser(id, { role, display_name }) {
  const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ role, display_name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updatePublicUser failed (${res.status}): ${text}`);
  }
}

async function ensureUser(u, byEmail) {
  const existing = byEmail.get(u.email);
  if (existing) {
    console.log(`  · user exists: ${u.email} (id=${existing.id}) — updating role to '${u.role}'`);
  } else {
    const created = await createUser(u);
    if (!created || !created.id) {
      // 422 from createUser — race or list cache miss. Re-list.
      const fresh = await listUsers();
      const found = fresh.find(x => x.email === u.email);
      if (!found) {
        throw new Error(`Could not create or find ${u.email}`);
      }
      console.log(`  · user exists (race): ${u.email} (id=${found.id})`);
      await updatePublicUser(found.id, u);
      return found.id;
    }
    console.log(`  · created auth user: ${u.email} (id=${created.id})`);
    // The handle_new_user trigger fires after INSERT on auth.users and inserts
    // a matching public.users row. We then PATCH the role (the trigger sets
    // the first user to 'admin' and the rest to 'worker' by default).
  }

  const userId = existing ? existing.id : (await listUsers()).find(x => x.email === u.email).id;
  await updatePublicUser(userId, u);
  console.log(`  · public.users updated: ${u.email} → role='${u.role}', display_name='${u.display_name}'`);
  return userId;
}

async function main() {
  console.log(`Supabase project: ${SUPABASE_URL}`);
  console.log(`Seeding ${DEMO_USERS.length} demo auth users...\n`);

  // List once upfront so we can show "exists" vs "create" for each row.
  const existing = await listUsers();
  const byEmail = new Map(existing.map(u => [u.email, u]));

  let created = 0, updated = 0, failed = 0;
  for (const u of DEMO_USERS) {
    try {
      const wasNew = !byEmail.has(u.email);
      await ensureUser(u, byEmail);
      if (wasNew) created++; else updated++;
    } catch (err) {
      console.error(`  ✗ ${u.email}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Done. ${created} created, ${updated} updated, ${failed} failed.`);
  console.log('');
  console.log('Sign in at your app with any of:');
  for (const u of DEMO_USERS) {
    console.log(`  · ${u.email}  (role: ${u.role})`);
  }

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
