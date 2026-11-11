#!/usr/bin/env node
// scripts/decision-log.mjs
//
// Append a new decision to a consumer's `BUILDER-DECISIONS-REVIEW.md` or
// `REVIEWER-DECISIONS-REVIEW.md`.
//
// Usage:
//   node scripts/decision-log.mjs builder \
//     --title="Money is Decimal(18,4)" \
//     --context="The spec said Decimal, we picked 18,4 at three layers" \
//     --decision="Postgres: Decimal(18,4); Zod: regex; Prisma: Prisma.Decimal" \
//     --alternatives="Float (rejected: drift); BigInt paise (rejected: unreadable)" \
//     --consequences="Frontend must parse Decimal; ESLint rule blocks Number()"
//
//   node scripts/decision-log.mjs reviewer \
//     --title="Approve Mode A" \
//     --evidence="5-command smoke test green" \
//     --decision="approved"
//
// The script reads the existing file, finds the next D<n> / R<n> number,
// inserts a new section in the canonical format, and writes the file back.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const SIDE = process.argv[2]; // 'builder' or 'reviewer'
if (SIDE !== 'builder' && SIDE !== 'reviewer') {
  console.error('Usage: decision-log.mjs {builder|reviewer} --title="..." [...]');
  process.exit(2);
}

const args = process.argv.slice(3);
function argValue(name) {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : null;
}

const title = argValue('title');
const context = argValue('context') || '(no context provided)';
const decision = argValue('decision') || '(no decision provided)';
const alternatives = argValue('alternatives') || '(none)';
const consequences = argValue('consequences') || '(none)';
const crossRefs = argValue('cross-refs') || '';

if (!title) {
  console.error('ERROR: --title is required');
  process.exit(2);
}

const filename = SIDE === 'builder'
  ? 'BUILDER-DECISIONS-REVIEW.md'
  : 'REVIEWER-DECISIONS-REVIEW.md';
const prefix = SIDE === 'builder' ? 'D' : 'R';
const filePath = resolve(process.cwd(), filename);

if (!existsSync(filePath)) {
  console.error(`ERROR: ${filename} not found in ${process.cwd()}`);
  process.exit(2);
}

const existing = readFileSync(filePath, 'utf8');

// Find the next number. Match the pattern `## D<n> ` or `## R<n> `.
const regex = new RegExp(`^## ${prefix}(\\d+) —`, 'gm');
let max = 0;
for (const m of existing.matchAll(regex)) {
  const n = parseInt(m[1], 10);
  if (n > max) max = n;
}
const next = max + 1;
const today = new Date().toISOString().slice(0, 10);

let newSection;
if (SIDE === 'builder') {
  newSection = `
## ${prefix}${next} — ${title}

**Date:** ${today}
**Status:** ✅ accepted
**Decided by:** <name>
**Cross-references:** ${crossRefs || '—'}

**Context.** ${context}

**Decision.** ${decision}

**Alternatives considered.**
- ${alternatives.split(';').join('\n- ')}

**Consequences.**
- ${consequences.split(';').join('\n- ')}

**How to verify.** <see test, run command, or read section>

`;
} else {
  newSection = `
## ${prefix}${next} — ${title}

**Date:** ${today}
**Reviewer:** <name>
**Subject:** <PR / milestone / spec amendment>
**Status:** ✅ approved

**Context.** ${context}

**Evidence reviewed.**
- ${(argValue('evidence') || '(no evidence)').split(';').join('\n- ')}

**Decision.** ${decision}

**Conditions (if any).** <list or "None">

`;
}

// Append (before any trailing "## §" footer that the file may have)
const updated = existing.trimEnd() + '\n' + newSection;
writeFileSync(filePath, updated, 'utf8');

console.log(`✅ Appended ${prefix}${next} to ${filename}`);
console.log(`   Title: ${title}`);
console.log(`   Date: ${today}`);
