#!/usr/bin/env node
// scripts/kit-coverage.mjs
//
// Given a consumer's `SPEC.md`, print which `lib/patterns/` entries from the kit
// are likely to apply. Helps the consumer decide what to copy into their project.
//
// Usage:
//   node scripts/kit-coverage.mjs                              # scan SPEC.md in cwd
//   node scripts/kit-coverage.mjs --spec=path/to/SPEC.md
//
// The script is a simple keyword-based classifier. It scans the SPEC.md for
// keywords and prints matching patterns. This is a *recommendation*, not a
// guarantee — the consumer should still read each pattern's "When this changes"
// section to decide.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const specArg = args.find((a) => a.startsWith('--spec='));
const specPath = specArg
  ? resolve(specArg.split('=')[1])
  : resolve(process.cwd(), 'SPEC.md');

if (!existsSync(specPath)) {
  console.error(`ERROR: SPEC.md not found at ${specPath}`);
  process.exit(2);
}

const spec = readFileSync(specPath, 'utf8').toLowerCase();

const kitRoot = resolve(import.meta.dirname, '..');
const patternsDir = join(kitRoot, 'lib', 'patterns');

if (!existsSync(patternsDir)) {
  console.error(`ERROR: kit patterns dir not found at ${patternsDir}`);
  process.exit(2);
}

// Each pattern has a list of "trigger keywords" that, if found in the spec,
// suggest the pattern applies. These are intentionally broad — false positives
// are fine (the consumer reads the pattern and decides), false negatives are
// not (a missing pattern is a real loss).
const KEYWORDS = {
  'supabase-auth-trigger.md': [
    'supabase', 'auth.users', 'auth.onauthstatechanged', 'signup trigger',
  ],
  'postgres-mutations.md': [
    'postgres', 'sql', 'rls', 'row-level security', 'database function',
    'plpgsql', 'trigger',
  ],
  'client-side-aggregation.md': [
    'aggregation', 'aggregate', 'sum', 'group by', 'dashboard',
    'analytics',
  ],
  'pwa-offline-graceful.md': [
    'offline', 'pwa', 'service worker', 'indexeddb', 'sync queue',
    'background sync',
  ],
  'empty-states.md': [
    'empty', 'no data', 'first-time', 'onboarding', 'zero state',
  ],
  'private-to-public.md': [
    'launch', 'public', 'production', 'deploy', 'release',
  ],
  'FRONTEND-OVERHAUL.md': [
    'redesign', 'rewrite', 'migrate ui', 'frontend overhaul', 'rewrite from scratch',
  ],
  'two-prisma-clients.md': [
    'multi-tenant', 'prisma', 'tenant', 'rls', 'row-level security',
  ],
  'cross-tenant-404.md': [
    'multi-tenant', 'tenant', '404 not 403', 'resource not found across tenants',
  ],
  'outbox-job-queue.md': [
    'email', 'notification', 'webhook', 'async', 'background job', 'cron',
    'outbox', 'job queue',
  ],
  'append-only-audit-log.md': [
    'audit', 'audit log', 'tamper-evident', 'immutable log', 'change history',
  ],
  'multi-tenant-rls.md': [
    'multi-tenant', 'tenant', 'rls', 'row-level security', 'tenant isolation',
  ],
  'fifo-cascade-algorithm.md': [
    'fifo', 'first in first out', 'cascade', 'spoilage', 'expiry', 'aged',
  ],
  'shortfall-pattern.md': [
    'shortfall', 'partial', 'insufficient', 'stock', 'available',
  ],
  'idempotent-migrations.md': [
    'migration', 'schema change', 'idempotent', 're-runnable',
  ],
  'pinned-deps.md': [
    'dependencies', 'package.json', 'pnpm', 'npm', 'lockfile', 'version pin',
  ],
  'observability-first.md': [
    'observability', 'monitoring', 'alerts', 'runbook', 'health check',
    'liveness', 'readiness',
  ],
  'env-vs-config.md': [
    'environment variables', '.env', 'configuration', 'secrets', 'docker-compose',
  ],
  'prisma-extensions-rls.md': [
    'prisma', 'rls', 'extends', 'asynclocalstorage', 'withtenanttx',
  ],
  'versioned-spec-amendment.md': [
    'spec amendment', 'spec v2', 'merge-ready', 'predecessor documents',
  ],
};

const files = readdirSync(patternsDir).filter((f) => f.endsWith('.md'));
const matches = [];
for (const file of files) {
  const keywords = KEYWORDS[file] || [];
  const found = keywords.filter((k) => spec.includes(k.toLowerCase()));
  if (found.length > 0) {
    matches.push({ file, found, score: found.length / keywords.length });
  }
}

matches.sort((a, b) => b.score - a.score);

console.log(`Kit coverage for: ${specPath}\n`);
console.log(`${matches.length} of ${files.length} patterns likely apply:\n`);

for (const m of matches) {
  const pct = (m.score * 100).toFixed(0).padStart(3);
  console.log(`  ${pct}%  ${m.file}`);
  console.log(`         matched: ${m.found.join(', ')}`);
}

if (matches.length === 0) {
  console.log('  (none — your spec may be very early-stage; revisit after the spec matures)');
}

console.log(`\nTotal patterns in kit: ${files.length}`);
console.log(`Recommended for this spec: ${matches.length}`);
