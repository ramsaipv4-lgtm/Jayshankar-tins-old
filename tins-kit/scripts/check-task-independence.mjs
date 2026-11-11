#!/usr/bin/env node
// scripts/check-task-independence.mjs
//
// Reads a consumer project's delegation/LEDGER.md and checks whether the
// tasks listed there are truly independent — i.e. no two tasks touch the
// same file. This runs BEFORE any task packet is built or handed out
// (DELEGATE-WORK.md Step 4): a round fully de-risked of contention is the
// goal, not a warning issued after packets already went out.
//
// Independence rule (generic, project-agnostic, per D29): two tasks are
// independent if (a) their touched-file sets don't intersect, and (b)
// neither task's interface contract depends on an artefact the other task
// produces. This script checks (a) mechanically; (b) is a judgment call
// the LLM/human makes when writing each TASK-BRIEF.md's "Interface
// Contract" section — this script can't see intent, only files.
//
// Usage:
//   node tins-kit/scripts/check-task-independence.mjs
//   node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md
//   node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md --json
//
// Exit 0: every pair of tasks is file-disjoint. Safe to build packets.
// Exit 1: at least one file is claimed by 2+ tasks. Do NOT build or hand
//         out packets until the conflict is resolved (merge the tasks).
// Exit 2: LEDGER.md not found, or no parseable task rows.
//
// Zero-dep Node ESM (D3).

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const ledgerArg = args.find((a) => a.startsWith('--ledger='));
const jsonOut = args.includes('--json');
const ledgerPath = resolve(
  process.cwd(),
  ledgerArg ? ledgerArg.slice('--ledger='.length) : 'delegation/LEDGER.md',
);

if (!existsSync(ledgerPath)) {
  console.error(`ERROR: ${ledgerPath} not found.`);
  console.error('Run DELEGATE-WORK.md Step 3 first to create delegation/LEDGER.md');
  console.error('from templates/DELEGATION-LEDGER.md.');
  process.exit(2);
}

const text = readFileSync(ledgerPath, 'utf8').replace(/\r\n/g, '\n');

// Parse the LEDGER.md markdown table. Expected columns (any order, matched
// by header name, case-insensitive substring): Task, Mode, Status,
// Assignee, Touched files. The "Touched files" cell is a `;`-separated
// list; an entry may end in a `*` to mean "this path and anything under
// it" (e.g. `src/admin/*`).
const lines = text.split('\n');
function firstTableBlock(text, requiredCols) {
  // Take only the FIRST contiguous markdown table whose header carries the
  // required columns. Parsing every `|` line in the file breaks the moment a
  // ledger grows a second table — a round-outcome summary, a notes table — and
  // templates/DELEGATION-LEDGER.md explicitly invites extra sections. Found by
  // running a real autonomous round (examples/autonomous-todo-app) against a
  // ledger that had grown an outcome table: every summary row was parsed as a
  // task and the runner died on "unrecognised status".
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    const head = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().toLowerCase());
    if (!requiredCols.every((c) => head.some((h) => h.includes(c)))) continue;
    const block = [];
    for (let j = i; j < lines.length && lines[j].trim().startsWith('|'); j++) block.push(lines[j]);
    return block;
  }
  return [];
}

const tableLines = firstTableBlock(text, ['task', 'touched']);
if (tableLines.length < 3) {
  console.error(`ERROR: no task table found in ${ledgerPath} (need a table with Task and Touched files columns).`);
  process.exit(2);
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const header = splitRow(tableLines[0]).map((h) => h.toLowerCase());
const taskCol = header.findIndex((h) => h.includes('task'));
const touchedCol = header.findIndex((h) => h.includes('touched'));
if (taskCol === -1 || touchedCol === -1) {
  console.error('ERROR: LEDGER.md table must have a "Task" column and a "Touched files" column.');
  process.exit(2);
}

const dataRows = tableLines.slice(1).filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
const tasks = dataRows
  .map((l) => {
    const cells = splitRow(l);
    const id = cells[taskCol] || '(unnamed)';
    const filesCell = cells[touchedCol] || '';
    const files = filesCell
      .split(';')
      .map((f) => f.trim())
      .filter(Boolean);
    return { id, files };
  })
  .filter((t) => t.files.length > 0);

if (tasks.length === 0) {
  console.error('ERROR: no task rows with a non-empty "Touched files" cell found.');
  console.error('Every task in LEDGER.md needs its touched-file list filled in before this check means anything.');
  process.exit(2);
}

// A minimal glob matcher — only a trailing `*` (prefix match). No dep on
// minimatch/glob (D3); this covers "everything under this directory" and
// "any file starting with this prefix", which is what a touched-file list
// actually needs.
function overlaps(a, b) {
  if (a === b) return true;
  const prefixMatch = (pattern, candidate) => {
    if (!pattern.endsWith('*')) return false;
    return candidate.startsWith(pattern.slice(0, -1));
  };
  return prefixMatch(a, b) || prefixMatch(b, a);
}

const conflicts = [];
for (let i = 0; i < tasks.length; i++) {
  for (let j = i + 1; j < tasks.length; j++) {
    const shared = [];
    for (const fa of tasks[i].files) {
      for (const fb of tasks[j].files) {
        const label = fa === fb ? fa : `${fa} ~ ${fb}`;
        if (overlaps(fa, fb) && !shared.includes(label)) shared.push(label);
      }
    }
    if (shared.length > 0) {
      conflicts.push({ a: tasks[i].id, b: tasks[j].id, files: shared });
    }
  }
}

if (jsonOut) {
  console.log(JSON.stringify({ ledgerPath, tasks: tasks.map((t) => t.id), conflicts }, null, 2));
} else {
  console.log('');
  console.log(`Checked ${tasks.length} task(s) from ${ledgerPath}`);
  console.log('');
  if (conflicts.length === 0) {
    console.log('  ✓ No file overlaps. Every task is independent — safe to build packets.');
  } else {
    for (const c of conflicts) {
      console.log(`  X ${c.a}  <->  ${c.b}`);
      for (const f of c.files) console.log(`      shares: ${f}`);
      console.log(`      → Merge ${c.a} and ${c.b} into one task. Recommended delegate:`);
      console.log('        a senior engineer, or a frontier model run at extended/max');
      console.log('        thinking — not two independent contributors, since a shared');
      console.log('        file creates ordering risk between them.');
      console.log('');
    }
    console.log(`  ${conflicts.length} conflict(s) found. Resolve before building any packet.`);
  }
  console.log('');
}

process.exit(conflicts.length > 0 ? 1 : 0);
