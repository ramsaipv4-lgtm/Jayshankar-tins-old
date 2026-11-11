#!/usr/bin/env node
// probe-db.mjs — one-shot Phase 2 probe for the Jayshankar dev run.
// Hits the live Supabase project using the publishable key from .env,
// then the secret key from scripts/.env, to confirm:
//   1. project reachable
//   2. which of the 9 schema tables exist
//   3. which migrations / seed steps still need to run
// Read-only — makes no changes.

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

console.log('=== Jayshankar live-DB probe (Phase 2) ===\n');
console.log(`SUPABASE_URL:           ${URL || '(MISSING)'}`);
console.log(`PUBLISHABLE key:        ${PUBLISHABLE ? PUBLISHABLE.slice(0, 24) + '…' : '(MISSING)'}`);
console.log(`SECRET key:             ${SECRET ? SECRET.slice(0, 18) + '…' : '(MISSING)'}\n`);

if (!URL) {
  console.error('ERROR: SUPABASE_URL missing from both .env files.');
  process.exit(1);
}

// --- Step 1: reachability + project metadata via publishable key ---
console.log('--- Step 1: project reachability (publishable key) ---');
try {
  const res = await fetch(`${URL}/auth/v1/settings`, {
    headers: { apikey: PUBLISHABLE || '' },
  });
  if (res.ok) {
    const body = await res.json();
    console.log(`  HTTP ${res.status} — project reachable.`);
    if (body.site_url) console.log(`  site_url:    ${body.site_url}`);
    if (body.uri_allow_list) console.log(`  redirect URIs: ${(body.uri_allow_list || []).length} entries`);
    if (body.mailer_autoconfirm !== undefined) console.log(`  mailer_autoconfirm: ${body.mailer_autoconfirm}`);
  } else {
    const text = await res.text();
    console.error(`  HTTP ${res.status} — project NOT reachable or key invalid.`);
    console.error(`  Body: ${text.slice(0, 200)}`);
    if (res.status === 401 || res.status === 403) {
      console.error('\n  This usually means the publishable key was rotated but the old one is still in .env.');
      console.error('  Fix: open the Supabase dashboard → Project Settings → API Keys, copy the NEW');
      console.error('       publishable key (starts with sb_publishable_), paste it into both .env files.');
    }
    process.exit(1);
  }
} catch (err) {
  console.error(`  Network error: ${err.message}`);
  console.error('  Possible causes: project paused (free tier pauses after 7d idle), wrong URL, or no internet.');
  process.exit(1);
}

// --- Step 2: schema table existence (query each expected table directly) ---
console.log('\n--- Step 2: schema tables (per-table probe, publishable key) ---');
const EXPECTED_TABLES = [
  'users', 'locations', 'vendors', 'skus', 'batches',
  'movements', 'sales', 'price_history', 'audit_log',
  // Added by migration 0006 (SPEC.md v2, decision #37):
  'warehouses', 'bills', 'containers', 'container_fills', 'container_fill_items',
];
const presentTables = [];
const missingTables = [];
for (const t of EXPECTED_TABLES) {
  try {
    const res = await fetch(
      `${URL}/rest/v1/${t}?select=id&limit=0`,
      {
        method: 'HEAD',
        headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}`, Prefer: 'count=exact' },
      },
    );
    if (res.ok) {
      // count = exact returns content-range like "0-0/0" — present but empty
      presentTables.push(t);
      console.log(`  ✓ ${t}`);
    } else if (res.status === 404) {
      missingTables.push(t);
      console.log(`  ✗ ${t}  ← MISSING (404)`);
    } else if (res.status === 401 || res.status === 403) {
      // RLS denies — but the table exists. publishable key works for the table
      // only when the user is signed in (anon role has minimal GRANTs).
      presentTables.push(t);
      console.log(`  ~ ${t}  (exists; anon denied without sign-in — expected)`);
    } else {
      missingTables.push(t);
      console.log(`  ✗ ${t}  ← HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`  ${t}: error ${err.message}`);
  }
}
console.log(`\n  Summary: ${presentTables.length}/${EXPECTED_TABLES.length} tables present${missingTables.length > 0 ? `; ${missingTables.length} missing.` : '.'}`);
if (missingTables.length > 0) {
  console.log(`  Migrations needed: 0001–0006 (run them in order in Supabase SQL Editor).`);
}

// --- Step 2b: new columns from migration 0006 (a table existing doesn't prove every ALTER
// TABLE ADD COLUMN in the same migration succeeded — check each column directly. PostgREST
// returns 400 with a "column does not exist" message if the select references a missing one,
// distinguishable from a working request.) ---
console.log('\n--- Step 2b: new columns from migration 0006 ---');
const EXPECTED_COLUMNS = [
  { table: 'locations', column: 'warehouse_id' },
  { table: 'batches', column: 'bill_id' },
  { table: 'movements', column: 'container_fill_id' },
];
for (const { table, column } of EXPECTED_COLUMNS) {
  try {
    const res = await fetch(
      `${URL}/rest/v1/${table}?select=${column}&limit=0`,
      { method: 'HEAD', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}` } },
    );
    if (res.ok || res.status === 401 || res.status === 403) {
      console.log(`  ✓ ${table}.${column}`);
    } else if (res.status === 400) {
      console.log(`  ✗ ${table}.${column}  ← MISSING (PostgREST 400 — column not found)`);
    } else {
      console.log(`  ? ${table}.${column}  ← HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`  ${table}.${column}: error ${err.message}`);
  }
}

// --- Step 3: row counts via secret key (bypasses RLS) ---
if (SECRET) {
  console.log('\n--- Step 3: row counts (secret key — bypasses RLS) ---');
  const COUNT_TABLES = [
    'vendors', 'skus', 'locations', 'movements', 'sales', 'price_history',
    'warehouses', 'bills', 'containers', 'container_fills', 'container_fill_items',
  ];
  let secretWorks = true;
  for (const t of COUNT_TABLES) {
    try {
      const res = await fetch(
        `${URL}/rest/v1/${t}?select=id&limit=0`,
        {
          method: 'HEAD',
          headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, Prefer: 'count=exact' },
        },
      );
      if (!res.ok) {
        console.error(`  ✗ ${t}: HTTP ${res.status}`);
        if (res.status === 401 || res.status === 403) {
          secretWorks = false;
          console.error('    Secret key invalid. Bailing.');
          break;
        }
      } else {
        const count = res.headers.get('content-range');
        const n = count ? count.split('/')[1] : '?';
        console.log(`  ${t}: ${n} rows`);
      }
    } catch (err) {
      console.error(`  ${t}: error ${err.message}`);
    }
  }
  if (secretWorks) {
    console.log('\n  Secret key works. Server-side operations will function.');
  }
} else {
  console.log('\n--- Step 3: SKIPPED — SUPABASE_SECRET_KEY missing from scripts/.env ---');
}

// --- Step 4: auth users count via secret key ---
if (SECRET) {
  console.log('\n--- Step 4: auth users count ---');
  try {
    const res = await fetch(`${URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
    });
    if (res.ok) {
      const body = await res.json();
      const users = body.users || [];
      const demo = users.filter((u) => u.email && u.email.endsWith('@jayshankar.demo'));
      console.log(`  ${users.length} total auth user(s); ${demo.length} demo user(s) (@jayshankar.demo).`);
      for (const u of demo) {
        console.log(`    · ${u.email}  (id=${u.id.slice(0, 8)}…, created=${u.created_at.slice(0, 10)})`);
      }
      if (demo.length === 0) {
        console.log('\n  No demo users yet. node scripts/seed-auth-users.mjs needs to run.');
      } else if (demo.length < 3) {
        console.log(`\n  ${demo.length}/3 demo users present. Re-run seed-auth-users.mjs to fill in the rest.`);
      } else {
        console.log('\n  All 3 demo users present. Login should work with DevPassword123!.');
      }
    } else {
      const text = await res.text();
      console.error(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

console.log('\n=== probe done ===');
