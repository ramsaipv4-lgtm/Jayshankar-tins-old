#!/usr/bin/env node
// scripts/kit-sync.mjs
// Sync the top-level kit to a project's vendored copy.
//
// The top-level `tins-kit/` is the source of truth (Rule 1, VERSIONING.md).
// Each consumer has a vendored copy at `<project>/tins-kit/`. When the
// kit grows, run this script to push the new files to each consumer.
//
// Usage:
//   node scripts/kit-sync.mjs --to=../Jayshankar         # push to a specific project
//   node scripts/kit-sync.mjs --to=../Jayshankar --json  # JSON output
//   node scripts/kit-sync.mjs --to=../Jayshankar --dry-run  # show what would change
//
// The script is idempotent. It does NOT touch any project files outside
// the vendored `tins-kit/` (e.g. it does not touch the project's
// SPEC.md, HANDOVER.md, BUILDER-DECISIONS-REVIEW.md, lib/, src/, etc.).
//
// The script DOES preserve project-added files inside the vendored
// `tins-kit/` (e.g. a project might add a project-specific script to
// `<project>/tins-kit/scripts/`). These are listed as "preserved" in
// the output.
//
// Zero-dep Node ESM.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';

const args = process.argv.slice(2);
const toArg = args.find(a => a.startsWith('--to='));
const jsonOut = args.includes('--json');
const dryRun = args.includes('--dry-run');

if (!toArg) {
  console.error('Usage: node scripts/kit-sync.mjs --to=<project-path> [--json] [--dry-run]');
  console.error('  Example: node scripts/kit-sync.mjs --to=../Jayshankar');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDir, '..');  // the top-level tins-kit/
const targetRoot = resolve(toArg.split('=')[1]);
const targetKitDir = join(targetRoot, 'tins-kit');

if (!existsSync(sourceRoot)) {
  console.error(`ERROR: source kit not found: ${sourceRoot}`);
  process.exit(2);
}

// Detect direction
//   --to=../Jayshankar → target's tins-kit/ is a child → forward sync (push)
//   --to=./tins-kit   → target is the project's tins-kit/ → reverse sync (pull from parent)
const isForwardSync = basename(targetRoot) !== 'tins-kit';

if (!isForwardSync) {
  // --to=./tins-kit means "pull the latest from the parent kit"
  // The "source" is the parent directory's tins-kit/, the "target" is ./tins-kit
  // We re-set the source to the parent kit (one level up)
  const parentKit = resolve(targetRoot, '..', 'tins-kit');
  if (existsSync(parentKit)) {
    console.log(`Reverse sync: pulling from ${parentKit}`);
    // Recurse with the parent as source
    doSync(parentKit, targetRoot);
  } else {
    console.error(`ERROR: no parent kit found at ${parentKit}`);
    process.exit(2);
  }
} else {
  // Forward sync: push from top-level tins-kit/ to <project>/tins-kit/
  doSync(sourceRoot, targetKitDir);
}

function doSync(src, dst) {
  if (!existsSync(src)) {
    console.error(`ERROR: source not found: ${src}`);
    process.exit(2);
  }

  // Compute the diff
  const srcFiles = walkFiles(src);
  const dstFiles = existsSync(dst) ? walkFiles(dst) : new Map();

  // 1. Files to add (in src, not in dst)
  const toAdd = [];
  for (const [rel, srcHash] of srcFiles) {
    if (!dstFiles.has(rel)) {
      toAdd.push(rel);
    } else {
      const dstHash = dstFiles.get(rel);
      if (srcHash !== dstHash) {
        toAdd.push(rel);  // changed; treat as "add" (overwrite)
      }
    }
  }

  // 2. Files to preserve (in dst, not in src) — project-added
  const toPreserve = [];
  for (const rel of dstFiles.keys()) {
    if (!srcFiles.has(rel)) {
      toPreserve.push(rel);
    }
  }

  // 3. Files unchanged (in both, same hash) — skip
  let unchanged = 0;
  for (const [rel, srcHash] of srcFiles) {
    if (dstFiles.has(rel) && dstFiles.get(rel) === srcHash) {
      unchanged++;
    }
  }

  if (dryRun) {
    console.log(`DRY RUN: would copy ${toAdd.length} file(s) to ${dst}`);
    for (const f of toAdd.slice(0, 20)) console.log(`  + ${f}`);
    if (toAdd.length > 20) console.log(`  ... and ${toAdd.length - 20} more`);
    console.log(`Preserve: ${toPreserve.length} project-added file(s)`);
    console.log(`Unchanged: ${unchanged}`);
    return;
  }

  // 4. Copy
  for (const rel of toAdd) {
    const srcPath = join(src, rel);
    const dstPath = join(dst, rel);
    mkdirSync(dirname(dstPath), { recursive: true });
    copyFileSync(srcPath, dstPath);
  }

  // 5. Write a sync marker (so consumers can tell when they were last synced)
  const marker = {
    syncedAt: new Date().toISOString(),
    sourceKit: src,
    filesCopied: toAdd.length,
    filesPreserved: toPreserve.length,
    filesUnchanged: unchanged,
  };
  const markerPath = join(dst, '.kit-sync.json');
  if (existsSync(dst)) {
    writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf8');
  }

  // 6. Report
  if (jsonOut) {
    console.log(JSON.stringify({ ...marker, filesAdded: toAdd.slice(0, 100) }, null, 2));
  } else {
    console.log(`Synced: ${toAdd.length} copied, ${unchanged} unchanged, ${toPreserve.length} preserved`);
    if (toAdd.length > 0) {
      console.log(`First 5:`);
      for (const f of toAdd.slice(0, 5)) console.log(`  + ${f}`);
    }
    if (toPreserve.length > 0) {
      console.log(`Project-added files (preserved):`);
      for (const f of toPreserve.slice(0, 5)) console.log(`  ~ ${f}`);
      if (toPreserve.length > 5) console.log(`  ... and ${toPreserve.length - 5} more`);
    }
    console.log(`Sync marker: ${markerPath}`);
  }
}

function walkFiles(root) {
  // Returns Map<relativePath, sha256Hash> for all files under root.
  const out = new Map();
  function visit(dir) {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      const st = statSync(full);
      if (st.isDirectory()) {
        // Skip the .git directory if it exists
        if (f === '.git' || f === 'node_modules') continue;
        // D36: examples/ holds captured runs — reference material for a person
        // reading the kit, not something a consumer project needs. One example
        // is ~440 KB of transcript; vendoring that into every consumer is pure
        // cost. Never synced.
        if (f === 'examples') continue;
        visit(full);
      } else {
        const rel = relative(root, full);
        out.set(rel, hashFile(full));
      }
    }
  }
  visit(root);
  return out;
}

function hashFile(path) {
  // Simple sha256 of the file content. Used for change detection.
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}
