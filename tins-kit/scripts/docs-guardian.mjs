#!/usr/bin/env node
// scripts/docs-guardian.mjs — the CLI wrapper around `lib/docs-guardian/`
//
// Reads `docs/DOC-MAP.md` (or `docs/DOC-MAP.json`), scans the consumer's
// source for references, scans the consumer's docs for references, and
// reports mismatches.
//
// Usage:
//   node scripts/docs-guardian.mjs                        # use docs/DOC-MAP.md
//   node scripts/docs-guardian.mjs --map=docs/DOC-MAP.md
//   node scripts/docs-guardian.mjs --src=src              # source root (default: .)
//   node scripts/docs-guardian.mjs --docs=docs            # docs root (default: docs)
//
// Exit 0 if all areas pass. Exit 1 if any area fails.
//
// Zero-dep Node ESM. Reads Markdown tables, scans with simple regexes.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const mapArg = args.find(a => a.startsWith('--map='));
const srcArg = args.find(a => a.startsWith('--src='));
const docsArg = args.find(a => a.startsWith('--docs='));

const mapPath = mapArg ? mapArg.split('=')[1] : resolve(process.cwd(), 'docs/DOC-MAP.md');
const srcRoot = srcArg ? srcArg.split('=')[1] : process.cwd();
const docsRoot = docsArg ? docsArg.split('=')[1] : resolve(process.cwd(), 'docs');

if (!existsSync(mapPath)) {
  console.error(`ERROR: DOC-MAP not found: ${mapPath}`);
  console.error('Create one with the format documented in lib/docs-guardian/README.md.');
  process.exit(2);
}

// --- Parse the DOC-MAP.md (or DOC-MAP.json) ---
let docMap;
if (mapPath.endsWith('.json')) {
  docMap = JSON.parse(readFileSync(mapPath, 'utf8'));
} else {
  docMap = parseDocMapMd(readFileSync(mapPath, 'utf8'));
}

// --- Scan the source for references ---
const sourceRefs = {};
for (const [area, entry] of Object.entries(docMap)) {
  if (!entry.sourceGlobs) continue;
  const keywords = entry.freshKeywords || [];
  let count = 0;
  for (const glob of entry.sourceGlobs) {
    // Very simple glob: if it ends with /, walk the dir; else if it has **, walk recursively
    for (const file of walk(srcRoot, glob)) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.sql') && !file.endsWith('.prisma')) continue;
      const text = readFileSync(file, 'utf8');
      count += countReferences(keywords, text);
    }
  }
  sourceRefs[area] = count;
}

// --- Scan the docs for references ---
const docRefs = {};
for (const [area, entry] of Object.entries(docMap)) {
  if (!entry.docFiles) continue;
  const keywords = entry.freshKeywords || [];
  let count = 0;
  for (const file of entry.docFiles) {
    const fullPath = resolve(docsRoot, '..', file);
    if (!existsSync(fullPath)) continue;
    const text = readFileSync(fullPath, 'utf8');
    count += countReferences(keywords, text);
  }
  docRefs[area] = count;
}

// --- Run the freshness check ---
const result = checkDocFreshness(sourceRefs, docRefs, docMap);

// --- Print the report ---
console.log(`DOC-MAP: ${mapPath}`);
console.log('');
let hasFail = false;
for (const [status, list] of [['FAIL', result.fail], ['WARN', result.warn], ['PASS', result.pass]]) {
  if (list.length === 0) continue;
  for (const line of list) {
    const icon = status === 'FAIL' ? 'X' : status === 'WARN' ? '!' : '✓';
    console.log(`  ${icon} [${status}] ${line}`);
    if (status === 'FAIL') hasFail = true;
  }
}
console.log('');
const pass = result.pass.length;
const warn = result.warn.length;
const fail = result.fail.length;
console.log(`  ${pass} pass, ${warn} warn, ${fail} fail`);
console.log('');
if (hasFail) {
  console.log('  Result: FAIL — docs are stale, fix the missing references.');
  console.log('');
  process.exit(1);
} else if (warn > 0) {
  console.log('  Result: PASS (with warnings) — docs look thin, consider expanding.');
  console.log('');
  process.exit(0);
} else {
  console.log('  Result: PASS — docs are fresh.');
  console.log('');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// HELPERS — see lib/docs-guardian/index.ts for the canonical implementations
// ---------------------------------------------------------------------------

function checkDocFreshness(sourceRefs, docRefs, docMap) {
  const pass = [];
  const warn = [];
  const fail = [];
  for (const [area, entry] of Object.entries(docMap)) {
    const srcCount = sourceRefs[area] ?? 0;
    const docCount = docRefs[area] ?? 0;
    if (srcCount > 0 && docCount === 0) {
      fail.push(`${area}: source has ${srcCount} reference(s) but doc has 0`);
    } else if (srcCount > 5 && docCount < srcCount / 2) {
      warn.push(`${area}: source has ${srcCount} reference(s) but doc has only ${docCount} (looks thin)`);
    } else {
      pass.push(`${area}: source=${srcCount}, doc=${docCount}`);
    }
  }
  return { pass, warn, fail };
}

function countReferences(keywords, text) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const k of keywords) {
    if (lower.includes(k.toLowerCase())) count++;
  }
  return count;
}

function parseDocMapMd(md) {
  // Very simple parser: extracts `## Area` sections with their bullets.
  // For each area, captures:
  //   - docFiles: lines starting with "- docFiles: ['...']" or "- docFiles: ..."
  //   - sourceGlobs: lines starting with "- sourceGlobs: ['...']"
  //   - freshKeywords: lines starting with "- freshKeywords: ['...']"
  //   - staleCheck: lines starting with "- staleCheck: ..."
  const lines = md.split('\n');
  const map = {};
  let current = null;
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      map[current] = { docFiles: [], sourceGlobs: [], freshKeywords: [], staleCheck: 'guardian' };
      continue;
    }
    if (!current) continue;
    const docFilesMatch = line.match(/^-\s+docFiles:\s*\[(.+?)\]/);
    if (docFilesMatch) {
      map[current].docFiles = docFilesMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const globsMatch = line.match(/^-\s+sourceGlobs:\s*\[(.+?)\]/);
    if (globsMatch) {
      map[current].sourceGlobs = globsMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const kwMatch = line.match(/^-\s+freshKeywords:\s*\[(.+?)\]/);
    if (kwMatch) {
      map[current].freshKeywords = kwMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const scMatch = line.match(/^-\s+staleCheck:\s*(\w+)/);
    if (scMatch) {
      map[current].staleCheck = scMatch[1];
    }
  }
  return map;
}

function walk(root, glob) {
  // Very simple glob support: 'src/app/api/**/*.ts' → walk src/app/api/ recursively for *.ts
  // 'prisma/schema.prisma' → just that file
  // 'src/**/*.tsx' → walk src/ recursively for *.tsx
  const parts = glob.split('/');
  const recursive = parts.includes('**');
  const filterExt = parts[parts.length - 1].replace('*', '');
  const walkTo = parts.slice(0, parts.indexOf('**')).join('/') || '.';
  const base = resolve(root, walkTo);
  if (!existsSync(base)) return [];
  const out = [];
  function visit(dir) {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      const st = statSync(full);
      if (st.isDirectory()) {
        visit(full);
      } else if (recursive && f.includes(filterExt)) {
        out.push(full);
      } else if (!recursive && full.endsWith(glob.replace(/^\.\//, ''))) {
        out.push(full);
      }
    }
  }
  visit(base);
  return out;
}
