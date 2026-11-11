#!/usr/bin/env node
// scripts/tooling-audit.mjs
//
// The blocking gate for D33. Reads a consumer project's TOOLING-AUDIT.md
// and refuses to let work proceed while a REQUIRED capability is still
// unresolved, or while a tool judged UNSAFE is marked installed.
//
// This gate is blocking by design, at the user's explicit request:
// proceeding "with assumptions and handicaps" is the precise failure being
// prevented, and a gate that can be skipped silently does not prevent it.
// Do not edit this script to pass. If a row's priority was wrong, change
// the row deliberately and say so.
//
// What fails the gate:
//   1. Audit status is not `complete`.
//   2. A REQUIRED row whose status is still `pending`.
//   3. A row judged UNSAFE that is marked `installed`.
//   4. A waived row whose handicap note is empty or a placeholder — a
//      waiver is not a dismissal (third-party-tool-audit.md §3.3). It must
//      name the capability given up and where assumptions now stand in for
//      real data, because that sentence is what the next session inherits.
//   5. An unrecognised verdict / priority / status value. The vocabulary is
//      closed on purpose; "probably fine" is not a verdict.
//
// Usage:
//   node tins-kit/scripts/tooling-audit.mjs
//   node tins-kit/scripts/tooling-audit.mjs --file=TOOLING-AUDIT.md --json
//
// Exit 0: gate green — every REQUIRED item installed or properly waived.
// Exit 1: gate red — work must not proceed. Reasons are printed.
// Exit 2: TOOLING-AUDIT.md missing or unparseable.
//
// Zero-dep Node ESM (D3).

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const HELP = `tooling-audit.mjs — the D33 blocking tooling gate

  --file=<path>   Default ./TOOLING-AUDIT.md
  --json          Machine-readable result.
  --help          This text.

Exit 0 green / 1 blocked / 2 missing or unparseable.
Rubric: lib/patterns/third-party-tool-audit.md
Workflow: prompts/TOOLING-AUDIT.md`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const jsonOut = args.includes('--json');
const fileArg = args.find((a) => a.startsWith('--file='));
const auditPath = resolve(process.cwd(), fileArg ? fileArg.slice('--file='.length) : 'TOOLING-AUDIT.md');

function die(msg, code) {
  if (jsonOut) console.log(JSON.stringify({ ok: false, code, errors: [msg] }, null, 2));
  else console.error(`ERROR: ${msg}`);
  process.exit(code);
}

if (!existsSync(auditPath)) {
  die(
    `${auditPath} not found. Run prompts/TOOLING-AUDIT.md first — it copies ` +
      'templates/TOOLING-AUDIT.md and fills it in. Work does not start before this gate.',
    2,
  );
}

const text = readFileSync(auditPath, 'utf8').replace(/\r\n/g, '\n');

const VERDICTS = ['SAFE', 'REVIEW-REQUIRED', 'UNSAFE'];
const PRIORITIES = ['REQUIRED', 'RECOMMENDED', 'OPTIONAL'];
const STATUSES = ['pending', 'installed', 'waived'];
const PLACEHOLDER_NOTE = /^(|-|—|–|n\/?a|tbd|none|todo|skipped,? not needed|not needed)$/i;

// --- audit status line ---------------------------------------------------
const statusMatch = text.match(/\*\*Audit status:\*\*\s*([A-Za-z-]+)/);
const auditStatus = statusMatch ? statusMatch[1].toLowerCase() : null;

// --- table ---------------------------------------------------------------
const tableLines = text.split('\n').filter((l) => l.trim().startsWith('|'));
if (tableLines.length < 2) {
  die(`no markdown table found in ${auditPath}.`, 2);
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

const header = splitRow(tableLines[0]).map((h) => h.toLowerCase());
const col = {
  candidate: header.findIndex((h) => h.includes('candidate')),
  verdict: header.findIndex((h) => h.includes('verdict')),
  priority: header.findIndex((h) => h.includes('priority')),
  status: header.findIndex((h) => h.includes('status')),
  note: header.findIndex((h) => h.includes('handicap') || h.includes('note')),
};
for (const key of ['candidate', 'verdict', 'priority', 'status']) {
  if (col[key] === -1) {
    die(
      `TOOLING-AUDIT.md table must have a "${key}" column ` +
        `(found: ${header.filter(Boolean).join(', ')}).`,
      2,
    );
  }
}

const rows = tableLines
  .slice(1)
  .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
  .map(splitRow)
  // Skip unfilled template rows: a placeholder <like-this> in the candidate cell.
  .filter((cells) => {
    const c = (cells[col.candidate] || '').trim();
    return c && !/^<.*>$/.test(c) && !/^`?<.*>`?$/.test(c);
  });

const problems = [];

if (auditStatus !== 'complete') {
  problems.push(
    auditStatus
      ? `Audit status is "${auditStatus}", not "complete". Finish prompts/TOOLING-AUDIT.md before starting work.`
      : 'No "**Audit status:**" line found. The gate cannot confirm the audit was actually run.',
  );
}

for (const cells of rows) {
  const name = cells[col.candidate] || '(unnamed)';
  const verdict = (cells[col.verdict] || '').toUpperCase().replace(/\s+/g, '');
  const priority = (cells[col.priority] || '').toUpperCase().replace(/\s+/g, '');
  const status = (cells[col.status] || '').toLowerCase().replace(/\s+/g, '');
  const note = col.note === -1 ? '' : (cells[col.note] || '').trim();

  if (!VERDICTS.includes(verdict)) {
    problems.push(`${name}: verdict "${cells[col.verdict]}" is not one of ${VERDICTS.join(' / ')}.`);
  }
  if (!PRIORITIES.includes(priority)) {
    problems.push(`${name}: priority "${cells[col.priority]}" is not one of ${PRIORITIES.join(' / ')}.`);
  }
  if (!STATUSES.includes(status)) {
    problems.push(`${name}: status "${cells[col.status]}" is not one of ${STATUSES.join(' / ')}.`);
  }
  if (verdict === 'UNSAFE' && status === 'installed') {
    problems.push(
      `${name}: judged UNSAFE but marked installed. Remove it, or re-audit and correct the verdict — ` +
        'UNSAFE is never softened because a tool is convenient.',
    );
  }
  if (priority === 'REQUIRED' && status === 'pending') {
    problems.push(
      `${name}: REQUIRED and still pending. Install it, or waive it with a named handicap. ` +
        'Without it the work substitutes assumptions for real data.',
    );
  }
  if (status === 'waived' && PLACEHOLDER_NOTE.test(note)) {
    problems.push(
      `${name}: waived with no handicap named. A waiver must say what capability is given up and ` +
        'where assumptions will now stand in for real data — that sentence is what the next session inherits.',
    );
  }
}

const summary = {
  ok: problems.length === 0,
  file: auditPath,
  auditStatus,
  rows: rows.length,
  required: rows.filter((c) => (c[col.priority] || '').toUpperCase().replace(/\s+/g, '') === 'REQUIRED').length,
  unsafe: rows.filter((c) => (c[col.verdict] || '').toUpperCase().replace(/\s+/g, '') === 'UNSAFE').length,
  reviewRequired: rows.filter((c) => (c[col.verdict] || '').toUpperCase().replace(/\s+/g, '') === 'REVIEW-REQUIRED').length,
  problems,
};

if (jsonOut) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(problems.length === 0 ? 0 : 1);
}

console.log(`tooling-audit — ${auditPath}`);
console.log(
  `  ${summary.rows} candidate(s): ${summary.required} REQUIRED, ` +
    `${summary.reviewRequired} REVIEW-REQUIRED, ${summary.unsafe} UNSAFE`,
);
if (problems.length === 0) {
  console.log('\n  Gate GREEN — every REQUIRED capability is installed or properly waived.');
  process.exit(0);
}
console.log(`\n  Gate RED — ${problems.length} problem(s). Work must not proceed:\n`);
for (const p of problems) console.log(`  · ${p}`);
console.log('\n  Fix the rows, not the script. See prompts/TOOLING-AUDIT.md Step 5.');
process.exit(1);
