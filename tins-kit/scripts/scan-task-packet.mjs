#!/usr/bin/env node
// scripts/scan-task-packet.mjs
//
// Scans a delegation task packet directory for two kinds of leak before it
// ever leaves the project (D29):
//   1. Methodology fingerprints — words, phrases, and filenames that would
//      tell an external contributor "this was built with a proprietary
//      spec-first LLM methodology," even if they couldn't fully
//      reconstruct it from that alone.
//   2. Path escapes — anything that reaches outside the packet folder
//      (../, an absolute path, a .git reference), which could point a
//      curious contributor back at the rest of the project.
//
// This is defense-in-depth, not the primary defense. The primary defense
// is a well-written TASK-BRIEF.md, a files/ folder scoped to exactly what
// the task needs, and a blank generic NOTES.md — a disciplined author
// following the template shouldn't trip this scanner at all. A clean scan
// does not certify the packet is safe; it's the last mechanical check
// before the zip is built, not a substitute for reading it yourself.
//
// Usage:
//   node tins-kit/scripts/scan-task-packet.mjs <path-to-packet-dir>
//   node tins-kit/scripts/scan-task-packet.mjs delegation/tasks/T2-search/packet
//   node tins-kit/scripts/scan-task-packet.mjs delegation/tasks/T2-search/packet --json
//
// Exit 0: clean. Safe to zip and hand off.
// Exit 1: one or more leaks found. Do NOT ship — fix the source file(s)
//         in packet/ and re-run.
// Exit 2: no directory given, or the given path isn't a directory.
//
// Zero-dep Node ESM (D3). Only scans text-ish files; skips known binary
// extensions so it doesn't choke on images or archives dropped in files/.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('Usage: scan-task-packet.mjs <path-to-packet-dir> [--json]');
  process.exit(2);
}

const packetDir = resolve(process.cwd(), target);
if (!existsSync(packetDir) || !statSync(packetDir).isDirectory()) {
  console.error(`ERROR: ${packetDir} is not a directory.`);
  process.exit(2);
}

// --- What a task packet must never reveal ---------------------------------
// A flat, easy-to-extend list on purpose. Add to it as the kit grows new
// methodology-specific vocabulary or file names.
const BANNED_TERMS = [
  'TINS', 'There Is No Source', 'tins-kit',
  'SPEC.md', 'HANDOVER.md', 'AGENTS.md', 'PIPELINE.md', 'INDEX.md', 'VERSIONING.md',
  'BUILDER-DECISIONS-REVIEW', 'REVIEWER-DECISIONS-REVIEW',
  'kit-staging', 'kit-worthy', 'kit-growth', 'kit-coverage',
  '2-consumer rule', 'two-consumer rule', 'locked-decisions', 'locked decision',
  'the spec is the source', 'the cheapest version that would work',
  'decision-log.mjs', 'kit-extract.mjs', 'kit-coverage.mjs', 'kit-sync.mjs',
  'kit-ingest.mjs', 'kit-staging-export.mjs', 'kit-new-project-shell.mjs',
  'kit-listing.mjs', 'kit-new-pattern.mjs', 'migration-runner.mjs',
  'docs-guardian.mjs', 'validate.mjs', 'selftest.mjs',
  'check-task-independence.mjs', 'scan-task-packet.mjs',
  'DELEGATE-WORK.md', 'INTEGRATE-DELEGATED-WORK.md', 'delegation/LEDGER.md',
];

// Path-escape patterns: anything that could point back at the rest of the
// project or its version control instead of staying inside the packet.
const BANNED_PATTERNS = [
  { re: /\.\.[\\/]/g, why: 'relative path escapes the packet folder (../)' },
  { re: /\bC:\\|\/home\/|\/Users\/|\/mnt\//g, why: 'absolute path may point at the real project location' },
  { re: /\.git[\\/]/g, why: 'reference to a .git directory' },
];

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pdf',
  '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.ico', '.mp4', '.mp3',
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === '.git' || name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (st.isFile() && !SKIP_EXT.has(extname(name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(packetDir);
const findings = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable as text; skip rather than false-positive on binary noise
  }
  const rel = file.slice(packetDir.length + 1);
  const lower = text.toLowerCase();

  for (const term of BANNED_TERMS) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1) {
      const line = text.slice(0, idx).split('\n').length;
      findings.push({ file: rel, line, kind: 'term', match: term });
    }
  }
  for (const { re, why } of BANNED_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const line = text.slice(0, m.index).split('\n').length;
      findings.push({ file: rel, line, kind: 'path', match: m[0], why });
    }
  }
}

if (jsonOut) {
  console.log(JSON.stringify({ packetDir, filesScanned: files.length, findings }, null, 2));
} else {
  console.log('');
  console.log(`Scanned ${files.length} file(s) in ${packetDir}`);
  console.log('');
  if (findings.length === 0) {
    console.log('  ✓ No methodology fingerprints or path escapes found.');
    console.log("  (This is a scan, not a guarantee — the template and the author's");
    console.log('   own read-through are still the primary defense.)');
  } else {
    for (const f of findings) {
      if (f.kind === 'term') {
        console.log(`  X ${f.file}:${f.line}  contains "${f.match}"`);
      } else {
        console.log(`  X ${f.file}:${f.line}  ${f.why} ("${f.match}")`);
      }
    }
    console.log('');
    console.log(`  ${findings.length} leak(s) found. Fix the source file(s) and re-run before zipping.`);
  }
  console.log('');
}

process.exit(findings.length > 0 ? 1 : 0);
