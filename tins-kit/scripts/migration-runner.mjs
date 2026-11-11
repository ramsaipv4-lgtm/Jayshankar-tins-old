#!/usr/bin/env node
// scripts/migration-runner.mjs
//
// Apply SQL migrations in order, idempotent, track in `migrations_applied` table.
//
// Usage:
//   node scripts/migration-runner.mjs                       # apply all pending
//   node scripts/migration-runner.mjs --dry-run            # list what would run
//   node scripts/migration-runner.mjs --check              # exit 1 if any pending
//   node scripts/migration-runner.mjs --dir=supabase/migrations
//
// The migration files are expected to be named `<n>_<name>.sql` (zero-padded
// number prefix, e.g. `0001_init.sql`). They are applied in lexicographic
// order. Each file must be idempotent (see `tins-kit/lib/patterns/idempotent-migrations.md`).
//
// Source: Jayshankar (the supabase CLI's migration runner, simplified),
// atal-incubation (the prisma migrate engine's idempotency model).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import process from 'node:process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkOnly = args.includes('--check');
const dirArg = args.find((a) => a.startsWith('--dir='));
const migrationsDir = dirArg
  ? resolve(dirArg.split('=')[1])
  : resolve(process.cwd(), 'prisma/migrations');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl && !dryRun) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(2);
}

function loadMigrations() {
  if (!existsSync(migrationsDir)) {
    console.error(`ERROR: migrations directory not found: ${migrationsDir}`);
    process.exit(2);
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => statSync(join(migrationsDir, f)).isFile())
    .sort();
  return files.map((f) => ({
    filename: f,
    path: join(migrationsDir, f),
    content: readFileSync(join(migrationsDir, f), 'utf8'),
  }));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT filename FROM migrations_applied ORDER BY filename'
  );
  return new Set(result.rows.map((r) => r.filename));
}

function checksum(content) {
  // Simple checksum: sha-256 of the file content, hex
  // (Node 18+ has crypto.subtle but for CLI simplicity use the sync API)
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  const migrations = loadMigrations();
  console.log(`Found ${migrations.length} migration file(s) in ${migrationsDir}`);

  if (migrations.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would apply:');
    for (const m of migrations) {
      console.log(`  - ${m.filename} (${m.content.length} bytes)`);
    }
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const pending = migrations.filter((m) => !applied.has(m.filename));
    console.log(`Already applied: ${applied.size}, pending: ${pending.length}`);

    if (checkOnly) {
      if (pending.length > 0) {
        console.log('\n[CHECK] Pending migrations:');
        for (const m of pending) {
          console.log(`  - ${m.filename}`);
        }
        process.exit(1);
      } else {
        console.log('[CHECK] No pending migrations. Up to date.');
        return;
      }
    }

    for (const m of pending) {
      console.log(`\n[APPLY] ${m.filename}`);
      const start = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(m.content);
        await client.query(
          'INSERT INTO migrations_applied (filename, checksum) VALUES ($1, $2)',
          [m.filename, checksum(m.content)]
        );
        await client.query('COMMIT');
        const elapsed = Date.now() - start;
        console.log(`  ✅ Applied in ${elapsed}ms`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Failed: ${e.message}`);
        process.exit(1);
      }
    }

    console.log('\n✅ All migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
