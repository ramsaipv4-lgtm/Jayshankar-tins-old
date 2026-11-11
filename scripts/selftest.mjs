#!/usr/bin/env node
// selftest.mjs — Jayshankar validator's self-test
// Proves the validator fails on known defects. Uses Node's built-in test runner
// (node --test). Zero dependencies.
//
// Usage:
//   node scripts/selftest.mjs
//   node --test scripts/selftest.mjs   (verbose)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pExecFile = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const VALIDATOR = join(REPO_ROOT, 'scripts/validate.mjs');

// The four schema files under test, plus the three setup/tooling files the
// validator also reads (so the temp dir is a complete-enough repo to validate
// against). Read them once; mutate in-memory for the broken variants.
const SPEC_PATH = join(REPO_ROOT, 'SPEC.md');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations');
const RLS_PATH = join(REPO_ROOT, 'supabase/rls-policies.sql');
const SEED_PATH = join(REPO_ROOT, 'supabase/seed.sql');
const SEED_AUTH_SCRIPT_PATH = join(REPO_ROOT, 'scripts/seed-auth-users.mjs');
const ENV_EXAMPLE_PATH = join(REPO_ROOT, 'scripts/.env.example');
const GITIGNORE_PATH = join(REPO_ROOT, '.gitignore');
const BUILDER_DECISIONS_PATH = join(REPO_ROOT, 'BUILDER-DECISIONS-REVIEW.md');

async function readAll() {
  // The validator reads ALL .sql files in supabase/migrations/ in lexical order
  // and concatenates them. Mirror that here so the selftest matches the live
  // apply. We read them as an object keyed by filename so the helper can write
  // each one out (and so defects can target a specific file).
  const { readdir } = await import('node:fs/promises');
  const migrationFiles = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();
  const migrations = {};
  for (const f of migrationFiles) {
    migrations[f] = await readFile(join(MIGRATIONS_DIR, f), 'utf8');
  }
  return {
    spec: await readFile(SPEC_PATH, 'utf8'),
    migrations,
    rls: await readFile(RLS_PATH, 'utf8'),
    seed: await readFile(SEED_PATH, 'utf8'),
    seedAuth: await readFile(SEED_AUTH_SCRIPT_PATH, 'utf8'),
    envExample: await readFile(ENV_EXAMPLE_PATH, 'utf8'),
    gitignore: await readFile(GITIGNORE_PATH, 'utf8'),
    builderDecisions: await readFile(BUILDER_DECISIONS_PATH, 'utf8'),
  };
}

async function runValidatorInTmpDir(files) {
  const { mkdir } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'jayshankar-selftest-'));
  for (const [name, content] of Object.entries(files)) {
    if (name === 'migrations') {
      // Spread the per-file map into the migrations/ subdir
      const subdir = join(dir, 'supabase/migrations');
      await mkdir(subdir, { recursive: true });
      for (const [filename, sql] of Object.entries(content)) {
        await writeFile(join(subdir, filename), sql);
      }
    } else if (name === 'spec') {
      await writeFile(join(dir, 'SPEC.md'), content);
    } else if (name === 'rls') {
      const subdir = join(dir, 'supabase');
      await mkdir(subdir, { recursive: true });
      await writeFile(join(subdir, 'rls-policies.sql'), content);
    } else if (name === 'seed') {
      const subdir = join(dir, 'supabase');
      await mkdir(subdir, { recursive: true });
      await writeFile(join(subdir, 'seed.sql'), content);
    } else if (name === 'seedAuth') {
      const subdir = join(dir, 'scripts');
      await mkdir(subdir, { recursive: true });
      await writeFile(join(subdir, 'seed-auth-users.mjs'), content);
    } else if (name === 'envExample') {
      const subdir = join(dir, 'scripts');
      await mkdir(subdir, { recursive: true });
      await writeFile(join(subdir, '.env.example'), content);
    } else if (name === 'gitignore') {
      await writeFile(join(dir, '.gitignore'), content);
    } else if (name === 'builderDecisions') {
      await writeFile(join(dir, 'BUILDER-DECISIONS-REVIEW.md'), content);
    } else {
      throw new Error(`Unknown file key in selftest: ${name}`);
    }
  }
  let code = 0;
  let stdout = '';
  try {
    ({ stdout } = await pExecFile('node', [VALIDATOR], { cwd: dir }));
  } catch (err) {
    code = err.code || 1;
    stdout = (err.stdout || '') + (err.stderr || '');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return { code, stdout };
}

// === Defect 1: Specification marker removed ===
// Expected: validator fails §8.1a
async function defectNoSpecMarker() {
  const f = await readAll();
  f.spec = f.spec.replace('<!-- TINS Specification v1.0 -->', '');
  return { files: f, expectFailId: '§8.1a' };
}

// === Defect 2: Unknown ZS key ===
// Expected: validator fails §8.1c
async function defectUnknownZsKey() {
  const f = await readAll();
  f.spec = f.spec.replace(
    '<!-- ZS:COMPLEXITY:HIGH -->',
    '<!-- ZS:UNKNOWNKEY:foo -->',
  );
  return { files: f, expectFailId: '§8.1c' };
}

// === Defect 3: Migration loses idempotency on a function ===
// Change `create or replace function` to `create function` for the kg trigger
// Expected: validator fails js-§8.1b-idempotent-functions
async function defectNonIdempotentFunction() {
  const f = await readAll();
  f.migrations['0001_init.sql'] = f.migrations['0001_init.sql'].replace(
    'create or replace function public.apply_movement_to_batches()',
    'create function public.apply_movement_to_batches()',
  );
  return { files: f, expectFailId: 'js-§8.1b-idempotent-functions' };
}

// === Defect 4: Migration drops the audit trigger on one table ===
// Change the unnest array in the DO block to remove 'skus'
// Expected: validator fails js-§8.3-all
async function defectAuditTriggerMissing() {
  const f = await readAll();
  f.migrations['0001_init.sql'] = f.migrations['0001_init.sql'].replace(
    `'users', 'locations', 'vendors', 'skus',`,
    `'users', 'locations', 'vendors',`,
  );
  return { files: f, expectFailId: 'js-§8.3-all' };
}

// === Defect 5: Seed drops the idempotency guard ===
// Expected: validator fails js-§8.5a (or warns, depending on the ON CONFLICT
// coverage; we expect a FAIL because we remove the guard AND strip ON CONFLICT
// from the static inserts).
async function defectSeedNotIdempotent() {
  const f = await readAll();
  // Strip the entire idempotency-guard DO block
  f.seed = f.seed.replace(
    /-- ============================================================\n-- 0\. Idempotency guard[\s\S]*?end \$\$;?\n/,
    '',
  );
  // Strip every ON CONFLICT clause from the static INSERTs so the warn branch
  // is also not satisfied.
  f.seed = f.seed.replace(/on conflict do nothing/gi, '');
  f.seed = f.seed.replace(/on conflict \(id\) do nothing/gi, '');
  f.seed = f.seed.replace(/on conflict \(name\) do nothing/gi, '');
  f.seed = f.seed.replace(/on conflict \(code\) do nothing/gi, '');
  return { files: f, expectFailId: 'js-§8.5a' };
}

// === Defect 6: Seed under-counts vendors (5 instead of 6) ===
// Expected: validator fails js-§8.5b-vendors
async function defectSeedMissingVendor() {
  const f = await readAll();
  // Delete the entire Ganesan row (multi-line replace)
  f.seed = f.seed.replace(
    /\s*\('10000000-0000-0000-0000-000000000006',\s*'Ganesan'[\s\S]*?\),\s*\n/,
    '\n',
  );
  return { files: f, expectFailId: 'js-§8.5b-vendors' };
}

// === Defect 7: RLS doesn't enable on movements table ===
// Expected: validator fails js-rls-enable
async function defectRlsNotEnabled() {
  const f = await readAll();
  // Delete the entire line (not just comment — the validator's regex would
  // still match the commented text).
  f.rls = f.rls.replace(
    /\s*alter\s+table\s+public\.movements\s+enable\s+row\s+level\s+security;\s*\n/,
    '\n',
  );
  return { files: f, expectFailId: 'js-rls-enable' };
}

// === Tests ===

test('passes on the unmodified repo', async () => {
  const f = await readAll();
  const { code } = await runValidatorInTmpDir(f);
  assert.equal(code, 0, `validator should exit 0 on a clean repo, got ${code}`);
});

for (const [name, defectFn, expectFailId] of [
  ['§8.1a — fails when Specification marker is missing', defectNoSpecMarker, '§8.1a'],
  ['§8.1c — fails on an unknown ZS: key', defectUnknownZsKey, '§8.1c'],
  ['js-§8.1b-idempotent-functions — fails when a function is not CREATE OR REPLACE', defectNonIdempotentFunction, 'js-§8.1b-idempotent-functions'],
  ['js-§8.3-all — fails when an audit trigger is missing on one table', defectAuditTriggerMissing, 'js-§8.3-all'],
  ['js-§8.5a — fails when seed is not idempotent', defectSeedNotIdempotent, 'js-§8.5a'],
  ['js-§8.5b-vendors — fails when seed has wrong vendor count', defectSeedMissingVendor, 'js-§8.5b-vendors'],
  ['js-rls-enable — fails when RLS is not enabled on a table', defectRlsNotEnabled, 'js-rls-enable'],
]) {
  test(name, async () => {
    const { files, expectFailId: expectedId } = await defectFn();
    const { code, stdout } = await runValidatorInTmpDir(files);
    assert.notEqual(code, 0, `validator should fail (exit non-zero) for defect: ${name}`);
    assert.match(stdout, new RegExp(`X\\s+${expectedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
      `validator output should show "${expectedId}" as failing, but did not. Output:\n${stdout}`);
  });
}

test('--help exits 0 and prints usage', async () => {
  const { stdout } = await pExecFile('node', [VALIDATOR, '--help']);
  assert.match(stdout, /Usage:/);
});
