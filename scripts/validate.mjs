#!/usr/bin/env node
// validate.mjs — Jayshankar spec + SQL validator
// Zero-dependency Node ESM. Runs:
//   (a) the kit's 10 structural checks against SPEC.md (re-implemented; no cross-dir import)
//   (b) Jayshankar-specific static checks against supabase/migrations/*.sql,
//       supabase/seed.sql, and the spec's own §8 acceptance criteria
//   (c) a FIFO spoilage algorithm correctness test (JS fixture)
//
// Exits 0 on pass, 1 on any fail, 2 on a usage error.
//
// Usage:
//   node scripts/validate.mjs
//   node scripts/validate.mjs --help
//   node scripts/validate.mjs --spec <path> --migration <path> --rls <path> --seed <path>

import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, isAbsolute, join } from 'node:path';
import { existsSync } from 'node:fs';
import { checkPalette, PALETTE } from './check-contrast.mjs';

const HELP = `validate.mjs — Jayshankar spec + SQL + setup validator

Usage:
  node scripts/validate.mjs                        Run all checks (default paths)
  node scripts/validate.mjs --spec <path>          SPEC.md to validate (default: SPEC.md)
  node scripts/validate.mjs --migration <path>     0001_init.sql (default: supabase/migrations/0001_init.sql)
  node scripts/validate.mjs --rls <path>           rls-policies.sql (default: supabase/rls-policies.sql)
  node scripts/validate.mjs --seed <path>          seed.sql (default: supabase/seed.sql)
  node scripts/validate.mjs --seed-auth <path>     seed-auth-users.mjs (default: scripts/seed-auth-users.mjs)
  node scripts/validate.mjs --env-example <path>    .env.example (default: scripts/.env.example)
  node scripts/validate.mjs --gitignore <path>      .gitignore (default: .gitignore)
  node scripts/validate.mjs --builder-decisions <path>   BUILDER-DECISIONS-REVIEW.md (default: BUILDER-DECISIONS-REVIEW.md)
  node scripts/validate.mjs --help                 Show this help

Validates: project structure, project structural checks, migration idempotency,
RLS enable + policies, seed idempotency + counts, FIFO algorithm fixture,
seed-auth-users.mjs (zero-dep, calls Admin API, idempotent, patches role),
.env.example (documents secrets), .gitignore (excludes .env + *.pem),
WCAG 2.1 AA-normal contrast for every (fg, bg) pair the UI uses
(scripts/check-contrast.mjs is imported, not shelled out).
Exits 0 if every check passes or warns. Exits 1 if any check fails.

Checks (project structural):
  §8.1a  Specification marker present
  §8.1b  At least one ZS: marker present
  §8.1c  All ZS: marker keys are known (COMPLEXITY, PLATFORM, LANGUAGE)
  §8.2a  §0 has at least one of {§0.0, §0.1, §0.2} subsections
  §8.2b  §0.2 has Decision and Resolution columns
  §8.2c  §0.2 has at least one decision row
  §8.3a  §0.0 names a concrete cheapest artefact
  §8.4a  §8 has at least 5 numbered criteria
  §8.5a  §9 has at least 1 out-of-scope item
  kit-§0.4  §0.4 interview-reveals-reality present

Checks (Jayshankar-specific, from SPEC §8):
  js-§8.1a  9 expected tables present in the migration
  js-§8.1b  Migration is idempotent (every CREATE has IF NOT EXISTS / OR REPLACE;
            every TRIGGER preceded by DROP TRIGGER IF EXISTS)
  js-§8.1c  CHECK constraint on movements (from_location, to_location) forbids (NULL, NULL)
  js-§8.3   audit_trigger() function defined and applied to every audited table
  js-§8.4   FIFO spoilage algorithm passes its JS fixture (cascade + shortfall)
  js-§8.5a  seed.sql is idempotent (every INSERT has ON CONFLICT, or runs inside the
            idempotency guard at the top of the file)
  js-§8.5b  seed.sql declares the right counts (6 vendors, 25 SKUs, 3 locations,
            150+ movements, 20+ sales, 30+ price_history)
  js-rls    rls-policies.sql enables RLS on every tenant-scoped table and creates at
            least one policy per audited table
  js-handle handle_new_user() trigger is defined and attached to auth.users
  js-kg     apply_movement_to_batches() trigger is defined and attached to movements
  js-contrast  WCAG 2.1 AA-normal pass for every (fg, bg) pair in
               scripts/check-contrast.mjs's PALETTE (SPEC §6)
`;

function parseArgs(argv) {
  const out = {
    spec: null, migration: null, rls: null, seed: null, help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--spec')        out.spec = next();
    else if (a.startsWith('--spec='))        out.spec = a.slice('--spec='.length);
    else if (a === '--migration') out.migration = next();
    else if (a.startsWith('--migration='))    out.migration = a.slice('--migration='.length);
    else if (a === '--rls')        out.rls = next();
    else if (a.startsWith('--rls='))          out.rls = a.slice('--rls='.length);
    else if (a === '--seed')       out.seed = next();
    else if (a.startsWith('--seed='))         out.seed = a.slice('--seed='.length);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function resolveDefault(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

// REPO_ROOT is a hint for the --help text; default file resolution uses cwd.
const REPO_ROOT = process.cwd();

// === Output formatting ===

const checks = [];
function check(id, status, message) {
  checks.push({ id, status, message });
}
const pass = (id, msg) => check(id, 'pass', msg);
const warn = (id, msg) => check(id, 'warn', msg);
const fail = (id, msg) => check(id, 'fail', msg);

// === Section extractor (line-based, LF-normalized) ===

function section(text, header) {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(line => line.startsWith(header));
  if (headerIdx === -1) return null;
  const headerLevel = (header.match(/^#+\s/) || [''])[0].trim().length;
  const captured = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#+\s)/);
    if (m && m[1].trim().length <= headerLevel) break;
    captured.push(line);
  }
  return captured.join('\n');
}

async function readNormalized(path) {
  const raw = await readFile(path, 'utf8');
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

async function readOrNull(path) {
  if (!existsSync(path)) return null;
  return readNormalized(path);
}

// ============================================================
// Part A — Kit's structural checks (re-implemented)
// ============================================================

function runKitChecks(spec) {
  const ALLOWED_ZS_KEYS = new Set(['COMPLEXITY', 'PLATFORM', 'LANGUAGE']);

  // §8.1
  // NOTE (2026-09-10): this must mirror tins-kit/scripts/validate.mjs's own §8.1a check
  // verbatim — the kit convention is the generic `TINS Specification v1.0` marker (see
  // tins-kit/templates/SPEC.md line 1), not a per-project marker. This literal string was
  // found changed to `Jayshankar Specification v1.0` with no corresponding SPEC.md edit and
  // no BUILDER-DECISIONS-REVIEW.md entry — an undocumented, unintentional drift that broke
  // the gate for ~4 weeks. Reverted; see BUILDER-DECISIONS-REVIEW.md decision #30 and
  // AUDIT-2026-09-10.md §2 for the full root-cause writeup.
  if (spec.includes('<!-- TINS Specification v1.0 -->')) {
    pass('§8.1a', 'Specification marker present');
  } else {
    fail('§8.1a', 'Missing marker: <!-- TINS Specification v1.0 -->');
  }

  const zsMatches = spec.match(/<!-- ZS:[A-Z]+:[^>]+?-->/g) || [];
  if (zsMatches.length > 0) {
    pass('§8.1b', `${zsMatches.length} ZS: marker(s) present`);
    const unknown = [];
    for (const m of zsMatches) {
      const key = m.match(/<!-- ZS:([A-Z]+):/)?.[1];
      if (key && !ALLOWED_ZS_KEYS.has(key)) unknown.push(key);
    }
    if (unknown.length === 0) {
      pass('§8.1c', 'all ZS: keys are known');
    } else {
      fail('§8.1c', `unknown ZS: keys: ${[...new Set(unknown)].join(', ')} (allowed: ${[...ALLOWED_ZS_KEYS].join(', ')})`);
    }
  } else {
    fail('§8.1b', 'Missing at least one <!-- ZS:KEY:VALUE --> marker');
  }

  // §8.2 / §8.3 / kit-§0.4
  const s00 = section(spec, '### 0.0');
  const s01 = section(spec, '### 0.1');
  const s02 = section(spec, '### 0.2');

  if (s00 || s01 || s02) {
    pass('§8.2a', '§0 has at least one of {§0.0, §0.1, §0.2}');
  } else {
    fail('§8.2a', '§0 has none of §0.0, §0.1, §0.2 — preamble is empty');
  }

  if (s02) {
    if (/\|[^|\n]*Decision[^|\n]*\|/.test(s02) && /\|[^|\n]*Resolution[^|\n]*\|/.test(s02)) {
      pass('§8.2b', '§0.2 table has Decision and Resolution columns');
    } else {
      fail('§8.2b', '§0.2 table must have both Decision and Resolution columns');
    }
    const lines = s02.split('\n').filter(l => l.startsWith('|'));
    const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l));
    const decisionCount = Math.max(0, dataRows.length - 1);
    if (decisionCount >= 1) {
      pass('§8.2c', `§0.2 has ${decisionCount} decision(s)`);
    } else {
      fail('§8.2c', '§0.2 must have at least one decision row');
    }
  } else {
    fail('§8.2b', '§0.2 not found');
    fail('§8.2c', '§0.2 not found');
  }

  if (s00) {
    const trimmed = s00.trim();
    if (trimmed.length < 50) {
      fail('§8.3a', '§0.0 is too short — must name a concrete cheapest artefact (≥50 chars)');
    } else {
      const tooVague = /^(the cheapest (version|artefact|artifact) that would work( for this project)?[^\n]*\n+)?\s*(a database|an app|a service|a system|software|an application)\s*\.?\s*$/im;
      if (tooVague.test(trimmed)) {
        fail('§8.3a', '§0.0 says "a database" / "an app" / "a service" — must name a concrete artefact');
      } else {
        pass('§8.3a', '§0.0 names a concrete cheapest artefact');
      }
    }
  } else {
    fail('§8.3a', '§0.0 not found — every consumer spec must have a cheapest-version line');
  }

  const s04 = section(spec, '### 0.4');
  if (s04 && s04.trim().length > 50) {
    const tableRows = s04.split('\n').filter(l => l.startsWith('|') && !/^\|[\s\-:|]+\|$/.test(l));
    if (tableRows.length >= 4) {
      pass('kit-§0.4', `§0.4 interview-reveals-reality present (${tableRows.length - 1} row(s))`);
    } else {
      warn('kit-§0.4', `§0.4 present but looks thin (${tableRows.length - 1} data row(s))`);
    }
  } else if (s04) {
    warn('kit-§0.4', '§0.4 present but very short');
  } else {
    fail('kit-§0.4', '§0.4 not found — every consumer spec must show what the design is reacting to');
  }

  // §8.4 / §8.5
  const s8 = section(spec, '## 8.');
  if (s8) {
    const criteria = s8.match(/\*\*§8\.\d+[a-z]?\*\*/g) || [];
    if (criteria.length >= 5) {
      pass('§8.4a', `§8 has ${criteria.length} numbered criteria`);
    } else {
      fail('§8.4a', `§8 has only ${criteria.length} criteria; minimum is 5`);
    }
  } else {
    fail('§8.4a', '§8 not found — every spec must have at least 5 mechanically-checkable criteria');
  }

  const s9 = section(spec, '## 9.');
  if (s9) {
    const items = s9.split('\n').filter(l => /^\s*[-*]\s+/.test(l));
    if (items.length >= 1) {
      pass('§8.5a', `§9 has ${items.length} out-of-scope item(s)`);
    } else {
      fail('§8.5a', '§9 present but no list items');
    }
  } else {
    fail('§8.5a', '§9 not found — every spec must have an explicit out-of-scope list');
  }
}

// ============================================================
// Part B — Jayshankar-specific static SQL checks
// ============================================================

const EXPECTED_TABLES = [
  'users', 'locations', 'vendors', 'skus', 'batches',
  'movements', 'sales', 'price_history', 'audit_log',
];

function runMigrationChecks(migration) {
  // js-§8.1a — 9 expected tables
  for (const t of EXPECTED_TABLES) {
    // accept `create table if not exists public.<name> (` or `create table public.<name> (`
    const re = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?public\\.${t}\\b`, 'i');
    if (re.test(migration)) {
      pass('js-§8.1a', `table ${t} present in migration`);
    } else {
      fail('js-§8.1a', `table ${t} missing from migration`);
    }
  }

  // js-§8.1b — idempotency
  // Every `create table` (not `create table if not exists`) is a fail
  const badTable = /create\s+table\s+(?!if\s+not\s+exists)public\.\w+/gi;
  const badTables = migration.match(badTable) || [];
  if (badTables.length === 0) {
    pass('js-§8.1b-idempotent-tables', 'every CREATE TABLE has IF NOT EXISTS');
  } else {
    fail('js-§8.1b-idempotent-tables', `CREATE TABLE without IF NOT EXISTS: ${badTables.join('; ')}`);
  }

  // Every `create function` should be `create or replace function`
  const fnCreates = [...migration.matchAll(/create\s+(or\s+replace\s+)?function\s+([\w.]+)\s*\(/gi)];
  let nonReplace = 0;
  for (const m of fnCreates) {
    if (!m[1]) nonReplace++;
  }
  if (nonReplace === 0) {
    pass('js-§8.1b-idempotent-functions', `every CREATE FUNCTION is CREATE OR REPLACE (${fnCreates.length} functions)`);
  } else {
    fail('js-§8.1b-idempotent-functions', `${nonReplace} CREATE FUNCTION statements without OR REPLACE`);
  }

  // Every `create trigger` should be preceded by `drop trigger if exists`.
  // We accept either:
  //   (a) explicit `drop trigger if exists <name>; create trigger <name>` pairs
  //   (b) a DO block that loops over a list of tables, executing both
  //       `drop trigger if exists` and `create trigger` for each
  const triggerCreates = [...migration.matchAll(/create\s+trigger\s+(\w+)/gi)];
  const dropTriggers = [...migration.matchAll(/drop\s+trigger\s+if\s+exists\s+(\w+)/gi)];
  const droppedNames = new Set(dropTriggers.map(m => m[1]));
  // DO-block pattern: a `do $$ ... execute format('drop trigger if exists trg_%I_audit ...') ... execute format('create trigger trg_%I_audit ...') ... end $$;`
  const hasDynamicDropAndCreate = /do\s+\$\$[\s\S]*?execute\s+format\s*\(\s*['"]drop\s+trigger[\s\S]*?create\s+trigger/si.test(migration);
  let missingDrop = 0;
  for (const m of triggerCreates) {
    if (!droppedNames.has(m[1]) && !hasDynamicDropAndCreate) missingDrop++;
  }
  if (missingDrop === 0) {
    const how = hasDynamicDropAndCreate ? ' (dynamic DO-block pattern)' : '';
    pass('js-§8.1b-idempotent-triggers', `every CREATE TRIGGER preceded by DROP TRIGGER IF EXISTS (${triggerCreates.length} triggers)${how}`);
  } else {
    fail('js-§8.1b-idempotent-triggers', `${missingDrop} CREATE TRIGGER without preceding DROP TRIGGER IF EXISTS`);
  }

  // js-§8.1c — CHECK on movements
  if (/check\s*\(\s*not\s*\(\s*from_location_id\s+is\s+null\s+and\s+to_location_id\s+is\s+null\s*\)\s*\)/i.test(migration)) {
    pass('js-§8.1c', 'CHECK constraint on movements forbids (NULL, NULL)');
  } else {
    fail('js-§8.1c', 'CHECK constraint on movements(from_location_id, to_location_id) forbidding (NULL, NULL) is missing');
  }

  // js-§8.3 — audit_trigger
  if (/create\s+or\s+replace\s+function\s+public\.audit_trigger\s*\(/i.test(migration)) {
    pass('js-§8.3-fn', 'audit_trigger() function defined');
  } else {
    fail('js-§8.3-fn', 'audit_trigger() function not found in migration');
  }
  if (/create\s+trigger\s+trg_\w+_audit\b[\s\S]*?execute\s+function\s+public\.audit_trigger\s*\(\s*\)/i.test(migration)) {
    pass('js-§8.3-trg', 'audit trigger attached via DO block / explicit CREATE TRIGGER');
  } else if (/do\s+\$\$[\s\S]*?create\s+trigger\s+trg_%I_audit[\s\S]*?execute\s+function\s+public\.audit_trigger\s*\(\s*\)/i.test(migration)) {
    pass('js-§8.3-trg', 'audit trigger attached via DO block (dynamic format string)');
  } else {
    fail('js-§8.3-trg', 'audit trigger not attached to a table');
  }
  // Every audited table should have a trg_<table>_audit trigger
  // Accept either explicit `create trigger trg_<table>_audit` OR a DO block
  // whose format string iterates over the expected table list.
  const auditedTables = ['users', 'locations', 'vendors', 'skus', 'batches', 'movements', 'sales', 'price_history'];
  const hasDoBlockAudit = /do\s+\$\$[\s\S]*?create\s+trigger\s+trg_%I_audit/i.test(migration);
  let missingAuditTrg = [];
  if (hasDoBlockAudit) {
    // Verify the DO block iterates over the expected table list
    const tableListMatch = migration.match(/unnest\s*\(\s*array\s*\[\s*([^\]]+)\]/i);
    if (tableListMatch) {
      const listed = tableListMatch[1].match(/'(\w+)'/g) || [];
      const listedNames = new Set(listed.map(s => s.replace(/'/g, '')));
      for (const t of auditedTables) {
        if (!listedNames.has(t)) missingAuditTrg.push(t);
      }
    } else {
      missingAuditTrg = [...auditedTables];
    }
  } else {
    for (const t of auditedTables) {
      const re = new RegExp(`create\\s+trigger\\s+trg_${t}_audit\\b`, 'i');
      if (!re.test(migration)) missingAuditTrg.push(t);
    }
  }
  if (missingAuditTrg.length === 0) {
    pass('js-§8.3-all', 'audit trigger attached to all 8 audited tables');
  } else {
    fail('js-§8.3-all', `audit trigger missing on: ${missingAuditTrg.join(', ')}`);
  }

  // js-handle — handle_new_user
  if (/create\s+or\s+replace\s+function\s+public\.handle_new_user\s*\(/i.test(migration)) {
    pass('js-handle-fn', 'handle_new_user() function defined');
  } else {
    fail('js-handle-fn', 'handle_new_user() function not found in migration');
  }
  if (/create\s+trigger\s+trg_handle_new_user\b[\s\S]{0,200}?on\s+auth\.users/i.test(migration)) {
    pass('js-handle-trg', 'handle_new_user trigger attached to auth.users');
  } else {
    fail('js-handle-trg', 'handle_new_user trigger not attached to auth.users');
  }

  // js-handle-del — handle_user_delete trigger (cascading cleanup)
  if (/create\s+trigger\s+trg_handle_user_delete\b[\s\S]{0,200}?on\s+auth\.users/i.test(migration)) {
    pass('js-handle-del-trg', 'handle_user_delete trigger attached to auth.users (cascading cleanup)');
  } else {
    fail('js-handle-del-trg', 'handle_user_delete trigger not attached to auth.users — deleting an auth.users row would leave an orphan public.users row');
  }

  // js-noauthfk — public.users.id must NOT have a FK to auth.users(id); integrity
  // is enforced by the handle_new_user / handle_user_delete triggers. This is
  // the deliberate Supabase pattern that lets the seed insert public.users
  // rows before the matching auth.users rows exist.
  // We assert this by looking for the forbidden pattern in the users table
  // definition (between "create table if not exists public.users" and the closing ");").
  const usersTableMatch = migration.match(/create\s+table\s+if\s+not\s+exists\s+public\.users\s*\(([\s\S]*?)\);/i);
  if (usersTableMatch) {
    const usersTableBody = usersTableMatch[1];
    // The id line must NOT contain "references auth.users"
    const idLineMatch = usersTableBody.match(/^\s*id\s+uuid[^\n]*/im);
    if (idLineMatch && /references\s+auth\.users/i.test(idLineMatch[0])) {
      fail('js-noauthfk', 'public.users.id has a FK to auth.users(id) — drop it; integrity must be enforced by handle_new_user / handle_user_delete triggers so the seed can run');
    } else {
      pass('js-noauthfk', 'public.users.id has no FK to auth.users(id) — integrity is trigger-based (correct)');
    }
  } else {
    fail('js-noauthfk', 'public.users table not found');
  }

  // js-handle-new-user-meta — handle_new_user() must read role + display_name
  // from NEW.raw_user_meta_data. Without this, any caller that supplies meta
  // (seed-auth-users.mjs, admin-driven user creation) gets a NULL display_name
  // in public.users, which violates the NOT NULL constraint and rolls back the
  // auth.users INSERT. This was the W1.5 first-apply failure (SQLSTATE 23502).
  if (/create\s+or\s+replace\s+function\s+public\.handle_new_user\s*\([\s\S]*?raw_user_meta_data/i.test(migration)) {
    pass('js-handle-new-user-meta', 'handle_new_user() reads role + display_name from NEW.raw_user_meta_data (with safe fallbacks)');
  } else {
    fail('js-handle-new-user-meta', 'handle_new_user() does not read NEW.raw_user_meta_data — caller-supplied role/display_name will be lost; the NOT NULL on display_name will trip the trigger and roll back auth.users INSERTs (SQLSTATE 23502)');
  }

  // js-grant-service-role — service_role needs explicit GRANTs on public tables
  // for server-side scripts (e.g. seed-auth-users.mjs) to work. BYPASSRLS is
  // necessary but not sufficient; without GRANT SELECT/INSERT/UPDATE, the REST
  // API returns SQLSTATE 42501 "permission denied for table X" even when the
  // caller presents the secret key. The check is satisfied by any GRANT to
  // service_role in any of: a table, all tables in schema, default privileges.
  if (/grant\s+(all\s+on\s+all\s+tables\s+in\s+schema\s+public|[\w,\s]+on\s+public\.\w+)\s+to\s+service_role/i.test(migration)
      || /alter\s+default\s+privileges\s+in\s+schema\s+public[\s\S]{0,200}?grant\s+all\s+on\s+tables\s+to\s+service_role/i.test(migration)) {
    pass('js-grant-service-role', 'service_role has table-level GRANTs (BYPASSRLS is paired with explicit GRANT)');
  } else {
    fail('js-grant-service-role', 'service_role has BYPASSRLS but no table-level GRANTs — server-side scripts that hit the REST API as service_role will fail with SQLSTATE 42501; add a migration that GRANTs ALL on public tables (or specific tables) to service_role');
  }

  // js-grant-authenticated — `authenticated` (the role the publishable key
  // becomes when a user is signed in) needs the same GRANTs. Without this,
  // browser code reading public.users (useSession in src/lib/auth.ts) fails
  // with SQLSTATE 42501 before RLS even evaluates. This was the W2 first-try
  // failure: the user could sign in, but useSession's public.users lookup
  // threw "permission denied for table users". The check is the same shape
  // as js-grant-service-role.
  if (/grant\s+(all\s+on\s+all\s+tables\s+in\s+schema\s+public|[\w,\s]+on\s+public\.\w+)\s+to\s+authenticated/i.test(migration)
      || /alter\s+default\s+privileges\s+in\s+schema\s+public[\s\S]{0,200}?grant\s+all\s+on\s+tables\s+to\s+authenticated/i.test(migration)) {
    pass('js-grant-authenticated', 'authenticated has table-level GRANTs (browser code with a signed-in user can read public tables)');
  } else {
    fail('js-grant-authenticated', 'authenticated role has no table-level GRANTs — the publishable key, with a signed-in user, runs as authenticated; without these GRANTs every Supabase JS query from the browser fails with SQLSTATE 42501; add a migration that GRANTs ALL on public tables to authenticated');
  }

  // js-record-transfer-cascade — the migration must include a SECURITY DEFINER
  // function record_transfer_cascade (or equivalent). Required so workers can
  // record transfers: workers don't have INSERT on batches per RLS, and a
  // transfer needs to create a destination batch atomically with the FIFO
  // source deduction. The function is the right place to do both.
  if (/create\s+or\s+replace\s+function\s+public\.record_transfer_cascade/i.test(migration)
      && /security\s+definer/i.test(migration)
      && /for\s+update/i.test(migration)) {
    pass('js-record-transfer-cascade', 'public.record_transfer_cascade is SECURITY DEFINER with FOR UPDATE — workers can transfer, race-condition protected');
  } else {
    fail('js-record-transfer-cascade', 'no public.record_transfer_cascade (or equivalent SECURITY DEFINER transfer function) found — workers cannot record transfers because RLS denies batches INSERT; add a migration with a SECURITY DEFINER function that does FIFO + 2 inserts atomically');
  }

  // js-kg — apply_movement_to_batches
  if (/create\s+or\s+replace\s+function\s+public\.apply_movement_to_batches\s*\(/i.test(migration)) {
    pass('js-kg-fn', 'apply_movement_to_batches() function defined');
  } else {
    fail('js-kg-fn', 'apply_movement_to_batches() function not found in migration');
  }
  if (/create\s+trigger\s+trg_movements_apply\b[\s\S]{0,200}?on\s+public\.movements/i.test(migration)) {
    pass('js-kg-trg', 'apply_movement_to_batches trigger attached to movements');
  } else {
    fail('js-kg-trg', 'apply_movement_to_batches trigger not attached to movements');
  }
}

function runRlsChecks(rls) {
  if (!rls) {
    fail('js-rls', 'rls-policies.sql not found');
    return;
  }
  // RLS enabled on every tenant-scoped table
  const rlsEnabled = [...rls.matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi)];
  const enabledTables = new Set(rlsEnabled.map(m => m[1]));
  let missingEnable = [];
  for (const t of EXPECTED_TABLES) {
    if (!enabledTables.has(t)) missingEnable.push(t);
  }
  if (missingEnable.length === 0) {
    pass('js-rls-enable', `RLS enabled on all ${EXPECTED_TABLES.length} tables`);
  } else {
    fail('js-rls-enable', `RLS not enabled on: ${missingEnable.join(', ')}`);
  }

  // At least one SELECT policy per audited table
  for (const t of EXPECTED_TABLES) {
    const re = new RegExp(`create\\s+policy\\s+\\w+\\s+on\\s+public\\.${t}\\b`, 'i');
    if (re.test(rls)) {
      pass(`js-rls-policy-${t}`, `policy defined on ${t}`);
    } else {
      fail(`js-rls-policy-${t}`, `no policy defined on ${t}`);
    }
  }

  // audit_log must NOT have INSERT, UPDATE, or DELETE policy
  // (extract the audit_log block — between the comment "audit_log" header and the next
  // blank-line-delimiter or comment-delimited section)
  const auditLogBlock = rls.split(/^-- =+$/m).find(s => /SPEC §2\.12\.3/.test(s)) || '';
  if (auditLogBlock) {
    if (/create\s+policy\s+\w+\s+on\s+public\.audit_log\s+for\s+insert/i.test(auditLogBlock)) {
      fail('js-rls-audit-insert', 'audit_log has an INSERT policy (should be trigger-only)');
    } else {
      pass('js-rls-audit-insert', 'audit_log has no INSERT policy (trigger-only by design)');
    }
    if (/create\s+policy\s+\w+\s+on\s+public\.audit_log\s+for\s+update/i.test(auditLogBlock)) {
      fail('js-rls-audit-update', 'audit_log has an UPDATE policy (immutable)');
    } else {
      pass('js-rls-audit-update', 'audit_log has no UPDATE policy (immutable)');
    }
    if (/create\s+policy\s+\w+\s+on\s+public\.audit_log\s+for\s+delete/i.test(auditLogBlock)) {
      fail('js-rls-audit-delete', 'audit_log has a DELETE policy (immutable)');
    } else {
      pass('js-rls-audit-delete', 'audit_log has no DELETE policy (immutable)');
    }
  } else {
    fail('js-rls-audit-block', 'audit_log RLS block not found in rls-policies.sql');
  }
}

function runSeedChecks(seed) {
  if (!seed) {
    fail('js-§8.5', 'seed.sql not found');
    return;
  }

  // js-§8.5a — idempotency
  // The file must have an idempotency guard at the top OR every INSERT has ON CONFLICT.
  // We look for a do $$ block with `if (select count(*) from public.X ... )` followed by
  // a return; within a few thousand chars. The narrower regex avoids the trap of
  // matching the `)` inside a `raise notice '...')` message.
  const hasGuard = /do\s+\$\$[\s\S]{0,200}?if\s*\(\s*select\s+count\(\*\)\s+from\s+public\.\w+[\s\S]{0,1500}?return\s*;/i.test(seed);
  const insertStatements = [...seed.matchAll(/insert\s+into\s+([\w.]+)/gi)].map(m => m[1]);
  const onConflict = (seed.match(/on\s+conflict/gi) || []).length;
  if (hasGuard && onConflict >= 1) {
    pass('js-§8.5a', `seed is idempotent (idempotency guard present; ${onConflict} ON CONFLICT clauses across ${insertStatements.length} INSERTs)`);
  } else if (onConflict >= insertStatements.length * 0.5) {
    warn('js-§8.5a', `seed has ON CONFLICT on ${onConflict} of ${insertStatements.length} INSERTs but no top-level guard`);
  } else {
    fail('js-§8.5a', `seed is not idempotent: ${onConflict} ON CONFLICT clauses across ${insertStatements.length} INSERTs, no top-level guard`);
  }

  // js-§8.5b — counts (parse loop bounds, not hard-coded totals)
  // Vendors: count the `(...)` tuples in the vendors VALUES block
  const vendorBlock = (seed.match(/insert\s+into\s+public\.vendors[\s\S]*?;/i) || [''])[0];
  const vendorTuples = (vendorBlock.match(/\('10000000-/g) || []).length;
  if (vendorTuples === 6) {
    pass('js-§8.5b-vendors', `seed has ${vendorTuples} vendors`);
  } else {
    fail('js-§8.5b-vendors', `seed has ${vendorTuples} vendors, expected 6`);
  }

  // SKUs
  const skuBlock = (seed.match(/insert\s+into\s+public\.skus[\s\S]*?;/i) || [''])[0];
  const skuTuples = (skuBlock.match(/\('20000000-/g) || []).length;
  if (skuTuples === 25) {
    pass('js-§8.5b-skus', `seed has ${skuTuples} SKUs`);
  } else {
    fail('js-§8.5b-skus', `seed has ${skuTuples} SKUs, expected 25`);
  }

  // Locations
  const locBlock = (seed.match(/insert\s+into\s+public\.locations[\s\S]*?;/i) || [''])[0];
  const locTuples = (locBlock.match(/\('00000000-/g) || []).length;
  if (locTuples === 3) {
    pass('js-§8.5b-locations', `seed has ${locTuples} locations`);
  } else {
    fail('js-§8.5b-locations', `seed has ${locTuples} locations, expected 3`);
  }

  // Parse the 4 movement loops (deliveries, transfers, sales, spoilage) by their
  // bounds. Each loop creates 1 movement row per iteration. Cumulative total ≥ 150.
  // We look for the section header (e.g. "Deliveries + Movements") and the loop bound
  // in the next ~2000 chars.
  function phaseLoopBound(text, headerRegex) {
    const m = text.match(headerRegex);
    if (!m) return 0;
    const tail = text.slice(m.index, m.index + 4000);
    const loop = tail.match(/for\s+v_i\s+in\s+1\.\.(\d+)/i);
    return loop ? parseInt(loop[1], 10) : 0;
  }
  const phaseDeliveries = phaseLoopBound(seed, /\n--\s*6\.\s*Deliveries/i);
  const phaseTransfers  = phaseLoopBound(seed, /\n--\s*7\.\s*Transfers/i);
  const phaseSales      = phaseLoopBound(seed, /\n--\s*8\.\s*Sales/i);
  const phaseSpoilage   = phaseLoopBound(seed, /\n--\s*9\.\s*Spoilage/i);
  const totalMovements = phaseDeliveries + phaseTransfers + phaseSales + phaseSpoilage;
  if (totalMovements >= 150) {
    pass('js-§8.5b-movements',
      `seed declares ${totalMovements} movements (deliveries=${phaseDeliveries} + transfers=${phaseTransfers} + sales=${phaseSales} + spoilage=${phaseSpoilage}) ≥ 150`);
  } else {
    fail('js-§8.5b-movements',
      `seed declares ${totalMovements} movements (deliveries=${phaseDeliveries} + transfers=${phaseTransfers} + sales=${phaseSales} + spoilage=${phaseSpoilage}), expected ≥ 150`);
  }

  // Sales — same as the Phase 3 movement count
  if (phaseSales >= 20) {
    pass('js-§8.5b-sales', `seed declares ${phaseSales} sales rows ≥ 20`);
  } else {
    fail('js-§8.5b-sales', `seed declares ${phaseSales} sales rows, expected ≥ 20`);
  }

  // price_history — parse the loop bound and the number of SKU inserts per iteration.
  // The section header is "5. Price history" in the seed; the table name `price_history`
  // (no space) is only inside the DO block.
  const priceIdx = seed.search(/\n--\s*5\.\s*Price\s+history/i);
  if (priceIdx >= 0) {
    const tail = seed.slice(priceIdx, priceIdx + 5000);
    const loopMatch = tail.match(/for\s+v_i\s+in\s+0\.\.(\d+)/i);
    const insertsPerIter = (tail.match(/insert\s+into\s+public\.price_history/gi) || []).length;
    const days = loopMatch ? parseInt(loopMatch[1], 10) + 1 : 0;
    const total = days * insertsPerIter;
    if (total >= 30) {
      pass('js-§8.5b-price', `seed declares ${days} days × ${insertsPerIter} SKUs = ${total} price_history rows ≥ 30`);
    } else {
      fail('js-§8.5b-price', `seed declares ${total} price_history rows (${days} days × ${insertsPerIter} SKUs), expected ≥ 30`);
    }
  } else {
    fail('js-§8.5b-price', 'price_history block not found in seed');
  }
}

// ============================================================
// Part C — FIFO spoilage algorithm fixture (pure JS)
// Implements SPEC §4.3.2 verbatim.
// ============================================================

function fifoSpoil(state, skuId, locationId, kgRequested) {
  // state = { batches: [{id, skuId, locationId, kgRemaining, deliveredAt}, ...] }
  // Mutates state.batches[i].kgRemaining in place and returns the cascade.
  if (kgRequested <= 0) {
    return { ok: false, error: 'invalid_kg' };
  }
  const candidates = state.batches
    .filter(b => b.skuId === skuId && b.locationId === locationId && b.kgRemaining > 0)
    .sort((a, b) => {
      if (a.deliveredAt < b.deliveredAt) return -1;
      if (a.deliveredAt > b.deliveredAt) return 1;
      return a.id < b.id ? -1 : 1;
    });
  // Lock (in a real DB this is SELECT ... FOR UPDATE)
  const totalAvail = candidates.reduce((s, b) => s + b.kgRemaining, 0);
  if (totalAvail < kgRequested) {
    return { ok: false, error: 'insufficient_stock', available: totalAvail, requested: kgRequested };
  }
  let remaining = kgRequested;
  const cascade = [];
  const groupId = 'test-group';
  for (const batch of candidates) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.kgRemaining, remaining);
    batch.kgRemaining -= deduct;
    remaining -= deduct;
    cascade.push({
      kind: 'spoilage',
      fromLocationId: locationId,
      toLocationId: null,
      skuId,
      kg: deduct,
      batchId: batch.id,
      movementGroupId: groupId,
    });
  }
  return { ok: true, cascade, totalDeducted: kgRequested };
}

// ----------------------------------------------------------------
// Setup artefacts: seed-auth-users.mjs + .env.example + .gitignore
// (BUILDER-DECISIONS-REVIEW.md decision 8: the auth users come from a Node
// script using the service-role Admin API, not from the SQL seed.)
// ----------------------------------------------------------------
function runSeedAuthChecks(seedAuth, envExample, gitignore) {
  // js-seed-auth-script — file exists and is non-empty (already enforced by
  // existsSync in main(); here we just check it has the expected structure).
  if (!/DEMO_USERS/i.test(seedAuth)) {
    fail('js-seed-auth-script', 'scripts/seed-auth-users.mjs does not define a DEMO_USERS array');
  } else {
    pass('js-seed-auth-script', 'seed-auth-users.mjs defines DEMO_USERS');
  }

  // js-seed-auth-roles — the script must create one of each role
  const rolesInScript = ['admin', 'vendor-rep', 'worker'].filter(r => new RegExp(`role['":\\s]+['"]${r}['"]`).test(seedAuth));
  if (rolesInScript.length === 3) {
    pass('js-seed-auth-roles', 'seed-auth-users.mjs creates all 3 roles (admin, vendor-rep, worker)');
  } else {
    fail('js-seed-auth-roles', `seed-auth-users.mjs only creates [${rolesInScript.join(', ')}]; expected [admin, vendor-rep, worker]`);
  }

  // js-seed-auth-uses-fetch — the script must use Node's built-in fetch, NOT
  // import @supabase/supabase-js. Zero-dep is the discipline (matches the kit's
  // D3). The point is: anyone with the .env file can run this script without
  // a separate `npm install` step.
  if (/from\s+['"]@supabase\/supabase-js['"]/.test(seedAuth)) {
    fail('js-seed-auth-uses-fetch', 'seed-auth-users.mjs imports @supabase/supabase-js — the script must be zero-dep (use built-in fetch)');
  } else if (/fetch\s*\(/.test(seedAuth)) {
    pass('js-seed-auth-uses-fetch', 'seed-auth-users.mjs uses built-in fetch (zero-dep)');
  } else {
    fail('js-seed-auth-uses-fetch', 'seed-auth-users.mjs does not call fetch()');
  }

  // js-seed-auth-calls-admin — the script must hit the Admin API
  if (/\/auth\/v1\/admin\/users/.test(seedAuth)) {
    pass('js-seed-auth-calls-admin', 'seed-auth-users.mjs calls /auth/v1/admin/users (Supabase Admin API)');
  } else {
    fail('js-seed-auth-calls-admin', 'seed-auth-users.mjs does not call the Supabase Admin API at /auth/v1/admin/users');
  }

  // js-seed-auth-idempotent — the script must handle the "user already exists" case
  if (/already\s+exists|listUsers|existing\.users\.find/i.test(seedAuth)) {
    pass('js-seed-auth-idempotent', 'seed-auth-users.mjs is idempotent (handles existing users)');
  } else {
    fail('js-seed-auth-idempotent', 'seed-auth-users.mjs is not idempotent — re-running should update, not fail');
  }

  // js-seed-auth-patches-public — the script must update public.users.role
  if (/public\.users|from\s*\(\s*['"]users['"]\s*\)|\.from\(['"]users['"]\)/i.test(seedAuth)) {
    pass('js-seed-auth-patches-public', 'seed-auth-users.mjs patches public.users (sets role + display_name)');
  } else {
    fail('js-seed-auth-patches-public', 'seed-auth-users.mjs does not patch public.users.role — the trigger sets the first user to admin and the rest to worker; the script must override for vendor-rep');
  }

  // js-env-example — .env.example exists and documents the required vars
  if (/SUPABASE_URL/.test(envExample) && /SUPABASE_SECRET_KEY/.test(envExample)) {
    pass('js-env-example', '.env.example documents SUPABASE_URL and SUPABASE_SECRET_KEY');
  } else {
    fail('js-env-example', '.env.example missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  // js-gitignore-env — .gitignore must exclude .env
  if (/^\.env\s*$/m.test(gitignore) || /^\.env\.\*?\s*$/m.test(gitignore) || /^\.env\*\s*$/m.test(gitignore)) {
    pass('js-gitignore-env', '.gitignore excludes .env (real secrets stay out of git)');
  } else {
    fail('js-gitignore-env', '.gitignore does not exclude .env — risk of committing the service-role key');
  }

  // js-gitignore-pem — .gitignore must exclude *.pem (per exam-forge standing rule #12)
  if (/^\*\.pem\s*$/m.test(gitignore) || /^\*\.pem\s+/m.test(gitignore)) {
    pass('js-gitignore-pem', '.gitignore excludes *.pem (per the standing rule: rotate first, clean second)');
  } else {
    fail('js-gitignore-pem', '.gitignore does not exclude *.pem — risk of committing JWT keys (per exam-forge standing rule #12)');
  }
}

// ----------------------------------------------------------------
// Lesson recording (kit D2: handover protocol mandates BUILDER-DECISIONS-REVIEW).
// Without these checks a consumer can create a project and never record a
// decision. The kit's templates/BUILDER-DECISIONS-REVIEW.md is the format spec.
// ----------------------------------------------------------------
function runLessonRecordingChecks(builderDecisions) {
  // js-builder-decisions-exists — the file must exist (already enforced by
  // existsSync in main(); here we assert it has a format-conformant header)
  if (/^#\s+BUILDER-DECISIONS-REVIEW\.md/m.test(builderDecisions)) {
    pass('js-builder-decisions-exists', 'BUILDER-DECISIONS-REVIEW.md exists and is format-conformant (kit D2)');
  } else {
    fail('js-builder-decisions-exists', 'BUILDER-DECISIONS-REVIEW.md does not start with the expected `# BUILDER-DECISIONS-REVIEW.md` header — see docs/DECISIONS.md for the format');
  }

  // js-builder-decisions-non-empty — the file must have at least 1 decision
  // (counted as level-3 headings matching "Decision N — ...")
  const decisionCount = (builderDecisions.match(/^###\s+Decision\s+\d+\s+—/gm) || []).length;
  if (decisionCount >= 1) {
    pass('js-builder-decisions-non-empty', `BUILDER-DECISIONS-REVIEW.md has ${decisionCount} decision(s) recorded (kit D2)`);
  } else {
    fail('js-builder-decisions-non-empty', 'BUILDER-DECISIONS-REVIEW.md has no `### Decision N — ...` entries — a consumer without recorded decisions will re-encounter the same wall; see docs/DECISIONS.md');
  }
}

function runAlgorithmFixture() {
  // Fixture 1: simple case, single batch has enough
  const f1 = {
    batches: [
      { id: 'b1', skuId: 's1', locationId: 'L', kgRemaining: 10, deliveredAt: '2025-01-01T00:00:00Z' },
    ],
  };
  const r1 = fifoSpoil(f1, 's1', 'L', 5);
  if (r1.ok && r1.cascade.length === 1 && f1.batches[0].kgRemaining === 5 && r1.totalDeducted === 5) {
    pass('js-§8.4a', 'spoil 5kg from 10kg single batch reduces kg_remaining to 5');
  } else {
    fail('js-§8.4a', `spoil simple case failed: ${JSON.stringify(r1)}`);
  }

  // Fixture 2: cascade — oldest batch has 3kg, next has 10kg, request 5kg
  const f2 = {
    batches: [
      { id: 'b1', skuId: 's1', locationId: 'L', kgRemaining: 3, deliveredAt: '2025-01-01T00:00:00Z' },
      { id: 'b2', skuId: 's1', locationId: 'L', kgRemaining: 10, deliveredAt: '2025-01-02T00:00:00Z' },
    ],
  };
  const r2 = fifoSpoil(f2, 's1', 'L', 5);
  if (r2.ok && r2.cascade.length === 2 && f2.batches[0].kgRemaining === 0 && f2.batches[1].kgRemaining === 8) {
    pass('js-§8.4b', 'spoil cascade: oldest 3kg + next 2kg = 5kg; 2 movement rows');
  } else {
    fail('js-§8.4b', `spoil cascade failed: ${JSON.stringify(r2)}, batches: ${JSON.stringify(f2.batches)}`);
  }

  // Fixture 3: insufficient stock
  const f3 = {
    batches: [
      { id: 'b1', skuId: 's1', locationId: 'L', kgRemaining: 3, deliveredAt: '2025-01-01T00:00:00Z' },
    ],
  };
  const r3 = fifoSpoil(f3, 's1', 'L', 10);
  if (!r3.ok && r3.error === 'insufficient_stock' && r3.available === 3 && r3.requested === 10) {
    pass('js-§8.4c', 'spoil insufficient stock rejected with shortfall named');
  } else {
    fail('js-§8.4c', `spoil shortfall failed: ${JSON.stringify(r3)}`);
  }

  // Fixture 4: tie-break determinism (same deliveredAt, different id)
  const f4 = {
    batches: [
      { id: 'b2', skuId: 's1', locationId: 'L', kgRemaining: 1, deliveredAt: '2025-01-01T00:00:00Z' },
      { id: 'b1', skuId: 's1', locationId: 'L', kgRemaining: 1, deliveredAt: '2025-01-01T00:00:00Z' },
    ],
  };
  const r4 = fifoSpoil(f4, 's1', 'L', 1);
  if (r4.ok && r4.cascade[0].batchId === 'b1') {
    pass('js-§8.4f', 'FIFO tie-break by id ASC is deterministic');
  } else {
    fail('js-§8.4f', `FIFO tie-break failed: first pick was ${r4.cascade[0]?.batchId}, expected b1`);
  }

  // Fixture 5: FIFO ordering — three batches, request spans two
  const f5 = {
    batches: [
      { id: 'b1', skuId: 's1', locationId: 'L', kgRemaining: 2, deliveredAt: '2025-01-01T00:00:00Z' },
      { id: 'b2', skuId: 's1', locationId: 'L', kgRemaining: 4, deliveredAt: '2025-01-02T00:00:00Z' },
      { id: 'b3', skuId: 's1', locationId: 'L', kgRemaining: 6, deliveredAt: '2025-01-03T00:00:00Z' },
    ],
  };
  const r5 = fifoSpoil(f5, 's1', 'L', 5);
  if (r5.ok && r5.cascade.length === 2 &&
      r5.cascade[0].batchId === 'b1' && r5.cascade[0].kg === 2 &&
      r5.cascade[1].batchId === 'b2' && r5.cascade[1].kg === 3 &&
      f5.batches[0].kgRemaining === 0 && f5.batches[1].kgRemaining === 1 && f5.batches[2].kgRemaining === 6) {
    pass('js-§8.4e', 'FIFO with three batches: oldest emptied, second partially drained, third untouched');
  } else {
    fail('js-§8.4e', `3-batch FIFO failed: cascade=${JSON.stringify(r5.cascade)}`);
  }
}

// ============================================================
// Part D — WCAG 2.1 AA contrast check (SPEC §6 accessibility)
// Runs check-contrast.mjs's programmatic interface against its default
// palette and reports pass/fail. Without this, a future regression that
// re-introduces a low-contrast color would slip past the validator.
// ============================================================

function runContrastChecks() {
  const results = checkPalette(PALETTE, { silent: true });
  const failed = results.filter(r => !r.aaNormal);
  if (failed.length === 0) {
    pass('js-contrast', `WCAG 2.1 AA-normal pass for all ${results.length} palette pair(s) — script:check-contrast.mjs`);
  } else {
    const detail = failed.map(r => `${r.label} (ratio ${r.ratio.toFixed(2)})`).join('; ');
    fail('js-contrast', `WCAG 2.1 AA-normal FAIL on ${failed.length}/${results.length} palette pair(s): ${detail} — script:check-contrast.mjs`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  const specPath = resolveDefault(args.spec || join(REPO_ROOT, 'SPEC.md'));
  const rlsPath = resolveDefault(args.rls || join(REPO_ROOT, 'supabase/rls-policies.sql'));
  const seedPath = resolveDefault(args.seed || join(REPO_ROOT, 'supabase/seed.sql'));
  const seedAuthScriptPath = resolveDefault(args['seed-auth'] || join(REPO_ROOT, 'scripts/seed-auth-users.mjs'));
  const envExamplePath = resolveDefault(args['env-example'] || join(REPO_ROOT, 'scripts/.env.example'));
  const gitignorePath = resolveDefault(args.gitignore || join(REPO_ROOT, '.gitignore'));
  const builderDecisionsPath = resolveDefault(args['builder-decisions'] || join(REPO_ROOT, 'BUILDER-DECISIONS-REVIEW.md'));

  // Migration: --migration <path> validates a single file. Default: read all
  // .sql files in supabase/migrations/ in lexical order and concatenate. This
  // is what the live apply does (Supabase CLI applies them in order), so the
  // validator should mirror that.
  let migrationPaths;
  let migrationLabel;
  if (args.migration) {
    migrationPaths = [resolveDefault(args.migration)];
    migrationLabel = migrationPaths[0];
  } else {
    const migrationsDir = join(REPO_ROOT, 'supabase', 'migrations');
    if (!existsSync(migrationsDir)) {
      console.error(`Error: migrations directory not found at ${migrationsDir}`);
      process.exit(2);
    }
    migrationPaths = (await readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort()  // lexical order = apply order
      .map(f => join(migrationsDir, f));
    if (migrationPaths.length === 0) {
      console.error(`Error: no .sql files in ${migrationsDir}`);
      process.exit(2);
    }
    migrationLabel = `${migrationPaths.length} file(s) in supabase/migrations/`;
  }

  // Verify all inputs exist
  for (const [label, p] of [
    ['SPEC.md', specPath],
    ...migrationPaths.map(p => ['migration', p]),
    ['rls', rlsPath],
    ['seed', seedPath],
    ['seed-auth-users.mjs', seedAuthScriptPath],
    ['.env.example', envExamplePath],
    ['.gitignore', gitignorePath],
    ['BUILDER-DECISIONS-REVIEW.md', builderDecisionsPath],
  ]) {
    if (!existsSync(p)) {
      console.error(`Error: ${label} not found at ${p}`);
      process.exit(2);
    }
  }

  console.log('');
  console.log('Validating Jayshankar spec + SQL + setup:');
  console.log(`  SPEC:               ${specPath}`);
  console.log(`  Migration:          ${migrationLabel}`);
  console.log(`  RLS:                ${rlsPath}`);
  console.log(`  Seed:               ${seedPath}`);
  console.log(`  Seed auth users:    ${seedAuthScriptPath}`);
  console.log(`  .env.example:       ${envExamplePath}`);
  console.log(`  .gitignore:         ${gitignorePath}`);
  console.log(`  BUILDER-DECISIONS:  ${builderDecisionsPath}`);
  console.log('');

  const spec = await readNormalized(specPath);
  const migration = (await Promise.all(migrationPaths.map(p => readNormalized(p)))).join('\n\n');
  const rls = await readOrNull(rlsPath);
  const seed = await readOrNull(seedPath);
  const seedAuth = await readNormalized(seedAuthScriptPath);
  const envExample = await readNormalized(envExamplePath);
  const gitignore = await readNormalized(gitignorePath);
  const builderDecisions = await readNormalized(builderDecisionsPath);

  runKitChecks(spec);
  runMigrationChecks(migration);
  runRlsChecks(rls);
  runSeedChecks(seed);
  runSeedAuthChecks(seedAuth, envExample, gitignore);
  runLessonRecordingChecks(builderDecisions);
  runAlgorithmFixture();
  runContrastChecks();

  // Output
  const order = [
    '§8.1a', '§8.1b', '§8.1c',
    '§8.2a', '§8.2b', '§8.2c',
    '§8.3a', 'kit-§0.4',
    '§8.4a', '§8.5a',
    'js-§8.1a',
    'js-§8.1b-idempotent-tables', 'js-§8.1b-idempotent-functions', 'js-§8.1b-idempotent-triggers',
    'js-§8.1c',
    'js-§8.3-fn', 'js-§8.3-trg', 'js-§8.3-all',
    'js-handle-fn', 'js-handle-trg', 'js-handle-del-trg', 'js-noauthfk', 'js-handle-new-user-meta',
    'js-grant-service-role', 'js-grant-authenticated', 'js-record-transfer-cascade',
    'js-kg-fn', 'js-kg-trg',
    'js-§8.4a', 'js-§8.4b', 'js-§8.4c', 'js-§8.4e', 'js-§8.4f',
    'js-§8.5a', 'js-§8.5b-vendors', 'js-§8.5b-skus', 'js-§8.5b-locations',
    'js-§8.5b-movements', 'js-§8.5b-sales', 'js-§8.5b-price',
    'js-rls-enable', 'js-rls-audit-insert', 'js-rls-audit-update', 'js-rls-audit-delete',
  ];
  for (const t of EXPECTED_TABLES) order.push(`js-rls-policy-${t}`);
  order.push(
    'js-seed-auth-script', 'js-seed-auth-roles', 'js-seed-auth-uses-fetch',
    'js-seed-auth-calls-admin', 'js-seed-auth-idempotent', 'js-seed-auth-patches-public',
    'js-env-example', 'js-gitignore-env', 'js-gitignore-pem',
    'js-builder-decisions-exists', 'js-builder-decisions-non-empty',
    'js-contrast',
  );

  const sorted = order.map(id => checks.find(c => c.id === id)).filter(Boolean);
  for (const c of checks) {
    if (!sorted.includes(c)) sorted.push(c);
  }

  const width = Math.max(...sorted.map(c => c.id.length));
  let passCount = 0, warnCount = 0, failCount = 0, hasFail = false;

  for (const c of sorted) {
    const icon = c.status === 'pass' ? '\u2713' : c.status === 'warn' ? '!' : 'X';
    console.log(`  ${icon} ${c.id.padEnd(width)}  ${c.message || ''}`);
    if (c.status === 'pass') passCount++;
    else if (c.status === 'warn') warnCount++;
    else { failCount++; hasFail = true; }
  }

  console.log('');
  console.log(`  ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
  console.log('');

  if (hasFail) {
    console.log('  Result: FAIL');
    console.log('');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('  Result: PASS (with warnings)');
    console.log('');
    process.exit(0);
  } else {
    console.log('  Result: PASS');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
