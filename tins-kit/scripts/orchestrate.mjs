#!/usr/bin/env node
// scripts/orchestrate.mjs
//
// The reference runner for an autonomous build (D32). Reads
// delegation/LEDGER.md (the state machine) and delegation/ORCHESTRATION.json
// (the run config), works out which tasks are runnable right now, and
// dispatches a wave of worker sessions.
//
// This script is ONE conforming implementation of prompts/AUTONOMOUS-BUILD.md,
// not the only permitted mechanism. A harness that spawns subagent sessions
// natively satisfies the same contract without ever running this file — as
// long as it obeys the same three rules: all run state lives in files, a
// fresh auditor can take over mid-run, and the auditor never writes product
// code.
//
// The round's EXECUTION MODE (D35) is read from delegation/LEDGER.md's header
// line `**Execution mode for this round:** <mode>`. Only auditor-driven rounds
// are dispatchable by this runner:
//
//   solo           this session builds it sequentially      -> NOT dispatched
//   auditor-local  auditor + workers in this harness        -> dispatched
//   auditor-remote auditor + workers on other LLM CLIs      -> dispatched
//   self-parallel  the USER orchestrates across their LLMs  -> NOT dispatched
//   external       scrubbed packets to someone else         -> NOT dispatched
//   hybrid         per-task; only auditor-* rows dispatch
//
// Refusing to auto-dispatch a user-driven or external round is a safety
// property, not a limitation: the user said they would drive that work
// themselves, or that it is destined for a scrubbed packet, and the runner
// must not quietly do it instead. Legacy ledgers written before D35 say
// `**Default mode for this round:** self | external`; `self` reads as
// `self-parallel`.
//
// The status vocabulary IS the contract. Nothing outside this set is valid:
//
//   proposed -> independence-checked -> ready -> running -> returned -> integrated
//                                                  |          |
//                                        blocked-escalation  failed
//
// Usage:
//   node tins-kit/scripts/orchestrate.mjs --dry-run     # plan only, spawn nothing
//   node tins-kit/scripts/orchestrate.mjs --status      # current run state
//   node tins-kit/scripts/orchestrate.mjs               # dispatch a wave
//
// Options:
//   --ledger=<path>   Default delegation/LEDGER.md
//   --config=<path>   Default delegation/ORCHESTRATION.json
//   --dry-run         Print the dispatch plan and exit. Never spawns.
//   --status          Print run state and the exit code it would produce.
//   --json            Machine-readable output.
//
// Exit 0: every task integrated — the run is complete.
// Exit 1: at least one task is `failed` (a worker failed past maxRetries).
// Exit 2: usage error, missing ledger/config, or an unrecognised status.
// Exit 3: PARKED — nothing runnable, escalations outstanding. Distinct from
//         both success and failure on purpose: a human reading the result
//         needs to tell "I owe it an answer" apart from "it broke".
//
// Zero-dep Node ESM (D3).

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const HELP = `orchestrate.mjs — the reference runner for an autonomous build (D32)

  --ledger=<path>   Default delegation/LEDGER.md
  --config=<path>   Default delegation/ORCHESTRATION.json
  --dry-run         Print the dispatch plan and exit. Spawns nothing.
  --status          Print run state and the exit code it would produce.
  --json            Machine-readable output.
  --help            This text.

Reads the round's execution mode (D35) from LEDGER.md and dispatches only
auditor-local / auditor-remote / hybrid rounds. solo, self-parallel and
external rounds are user-driven and are refused.

Exit 0 complete / 1 a task failed / 2 usage or config error / 3 parked.
Contract: prompts/AUTONOMOUS-BUILD.md   Worker: prompts/WORKER-SESSION.md`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

function arg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const jsonOut = args.includes('--json');
const dryRun = args.includes('--dry-run');
const statusOnly = args.includes('--status');
const ledgerPath = resolve(process.cwd(), arg('ledger', 'delegation/LEDGER.md'));
const configPath = resolve(process.cwd(), arg('config', 'delegation/ORCHESTRATION.json'));

const VALID = [
  'proposed',
  'independence-checked',
  'ready',
  'running',
  'returned',
  'integrated',
  'blocked-escalation',
  'failed',
];

function die(msg, code = 2) {
  if (jsonOut) console.log(JSON.stringify({ ok: false, code, errors: [msg] }, null, 2));
  else console.error(`ERROR: ${msg}`);
  process.exit(code);
}

if (!existsSync(ledgerPath)) {
  die(`${ledgerPath} not found. Run AUTONOMOUS-BUILD.md Step 3 to create it from templates/DELEGATION-LEDGER.md.`);
}

// --- config --------------------------------------------------------------
const DEFAULT_CONFIG = {
  harness: 'generic',
  workerCmd: '',
  maxParallel: 2,
  maxRetries: 1,
  tierPolicy: { autoDecide: ['T0', 'T1'] },
  haltOn: [],
};
let config = { ...DEFAULT_CONFIG };
if (existsSync(configPath)) {
  try {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(configPath, 'utf8')) };
  } catch (err) {
    die(`${configPath} is not valid JSON: ${err.message}`);
  }
} else if (!dryRun && !statusOnly) {
  die(`${configPath} not found. Copy templates/ORCHESTRATION.json into delegation/ first.`);
}

// --- ledger --------------------------------------------------------------
const text = readFileSync(ledgerPath, 'utf8').replace(/\r\n/g, '\n');
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

const tableLines = firstTableBlock(text, ['task', 'status']);
if (tableLines.length < 2) die(`no task table found in ${ledgerPath} (need a table with Task and Status columns).`);

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

// --- round execution mode (D35) ------------------------------------------
const MODES = ['solo', 'auditor-local', 'auditor-remote', 'self-parallel', 'external', 'hybrid'];
const DISPATCHABLE_MODES = ['auditor-local', 'auditor-remote', 'hybrid'];

function normaliseMode(raw) {
  if (!raw) return null;
  const m = raw.trim().toLowerCase().replace(/[`*]/g, '');
  if (m === 'self') return 'self-parallel'; // legacy D29 ledgers
  return m;
}

const modeMatch =
  text.match(/\*\*Execution mode for this round:\*\*\s*([A-Za-z-]+)/) ||
  text.match(/\*\*Default mode for this round:\*\*\s*([A-Za-z-]+)/);
const roundMode = normaliseMode(modeMatch ? modeMatch[1] : null);

if (roundMode && !MODES.includes(roundMode)) {
  die(
    `unrecognised execution mode "${roundMode}" in ${ledgerPath}. ` +
      `The vocabulary is closed: ${MODES.join(', ')}. ` +
      'Run prompts/EXECUTION-MODE-INTERVIEW.md to set it.',
  );
}

const header = splitRow(tableLines[0]).map((h) => h.toLowerCase());
const col = {
  task: header.findIndex((h) => h.includes('task')),
  status: header.findIndex((h) => h.includes('status')),
  depends: header.findIndex((h) => h.includes('depend')),
  mode: header.findIndex((h) => h.includes('mode')),
};
if (col.task === -1 || col.status === -1) {
  die('LEDGER.md table must have a "Task" column and a "Status" column.');
}

const tasks = tableLines
  .slice(1)
  .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
  .map(splitRow)
  .map((cells) => ({
    id: cells[col.task] || '',
    status: (cells[col.status] || '').toLowerCase(),
    mode: col.mode === -1 ? null : normaliseMode(cells[col.mode]),
    depends:
      col.depends === -1
        ? []
        : (cells[col.depends] || '')
            .split(/[;,]/)
            .map((s) => s.trim().replace(/^`|`$/g, ''))
            .filter((s) => s && !/^[-—–]$/.test(s)),
  }))
  // Skip unfilled template rows.
  .filter((t) => t.id && !/^<.*>$/.test(t.id) && !/^T\d+-<.*>$/.test(t.id));

if (!tasks.length) die(`no parseable task rows in ${ledgerPath}.`);

const unknown = tasks.filter((t) => !VALID.includes(t.status));
if (unknown.length) {
  die(
    `unrecognised status on ${unknown.map((t) => `${t.id} ("${t.status}")`).join(', ')}. ` +
      `The vocabulary is closed: ${VALID.join(', ')}.`,
  );
}

const byId = new Map(tasks.map((t) => [t.id, t]));
const DONE = new Set(['integrated']);
const STALLED = new Set(['blocked-escalation', 'failed']);

// A task is auto-dispatchable only when both the round and the task itself
// are auditor-driven. In a `hybrid` round the task's own Mode cell decides.
function taskIsDispatchable(t) {
  if (roundMode === null) return true; // no mode recorded (pre-D35 ledger)
  if (!DISPATCHABLE_MODES.includes(roundMode)) return false;
  if (roundMode === 'hybrid') {
    return t.mode ? DISPATCHABLE_MODES.includes(t.mode) && t.mode !== 'hybrid' : false;
  }
  return t.mode ? t.mode !== 'external' && t.mode !== 'solo' && t.mode !== 'self-parallel' : true;
}

function heldReason(t) {
  if (DONE.has(t.status)) return 'done';
  if (t.status === 'blocked-escalation') return 'parked on an open escalation';
  if (t.status === 'failed') return 'failed past maxRetries';
  if (t.status === 'running') return 'already running';
  if (t.status === 'returned') return 'returned — awaiting the auditor\'s verification';
  if (t.status === 'proposed') return 'not independence-checked yet (AUTONOMOUS-BUILD.md Step 4)';
  if (t.status === 'independence-checked') return 'checked but not marked ready';
  const unmet = t.depends.filter((d) => {
    const dep = byId.get(d);
    return !dep || !DONE.has(dep.status);
  });
  if (unmet.length) return `waiting on ${unmet.join(', ')}`;
  if (!taskIsDispatchable(t)) {
    const m = roundMode === 'hybrid' ? t.mode || '(no task mode)' : roundMode;
    return `user-driven mode (${m}) — this runner does not dispatch it`;
  }
  return null;
}

const runnable = tasks.filter((t) => t.status === 'ready' && heldReason(t) === null);
const running = tasks.filter((t) => t.status === 'running');
const slots = Math.max(0, Number(config.maxParallel || 1) - running.length);
const wave = runnable.slice(0, slots);
const held = tasks.filter((t) => !wave.includes(t)).map((t) => ({ id: t.id, reason: heldReason(t) || 'held' }));

const counts = VALID.reduce((acc, s) => {
  acc[s] = tasks.filter((t) => t.status === s).length;
  return acc;
}, {});

const allDone = tasks.every((t) => DONE.has(t.status));
const anyFailed = tasks.some((t) => t.status === 'failed');
const anyParked = tasks.some((t) => t.status === 'blocked-escalation');
const nothingRunnable = wave.length === 0 && running.length === 0;

let outcome;
let exitCode;
if (allDone) {
  outcome = 'complete';
  exitCode = 0;
} else if (anyFailed && nothingRunnable) {
  outcome = 'failed';
  exitCode = 1;
} else if (anyParked && nothingRunnable) {
  outcome = 'parked';
  exitCode = 3;
} else if (nothingRunnable) {
  outcome = 'stalled';
  exitCode = 3;
} else {
  outcome = 'dispatchable';
  exitCode = 0;
}

const plan = {
  ok: true,
  ledger: ledgerPath,
  roundMode,
  dispatchable: roundMode === null || DISPATCHABLE_MODES.includes(roundMode),
  harness: config.harness,
  maxParallel: config.maxParallel,
  maxRetries: config.maxRetries,
  autoDecide: config.tierPolicy?.autoDecide ?? [],
  counts,
  running: running.map((t) => t.id),
  wave: wave.map((t) => t.id),
  held,
  outcome,
  exitCode,
};

function report() {
  if (jsonOut) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(`orchestrate — ${ledgerPath}`);
  console.log(`  execution mode: ${roundMode || '(not recorded — run EXECUTION-MODE-INTERVIEW.md)'}`);
  console.log(`  harness: ${config.harness}   maxParallel: ${config.maxParallel}   maxRetries: ${config.maxRetries}`);
  console.log(`  worker may decide alone: ${(config.tierPolicy?.autoDecide ?? []).join(', ') || '(none)'}`);
  console.log(
    `  ${tasks.length} task(s): ` +
      VALID.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`).join(', '),
  );
  console.log(`\n  Wave (${wave.length}): ${wave.map((t) => t.id).join(', ') || '(none runnable)'}`);
  if (held.length) {
    console.log('  Held:');
    for (const h of held) console.log(`    · ${h.id} — ${h.reason}`);
  }
  console.log(`\n  Outcome: ${outcome} (exit ${exitCode})`);
  if (roundMode && !DISPATCHABLE_MODES.includes(roundMode)) {
    console.log(`  This round is \`${roundMode}\` — you drive it, not this runner.`);
    console.log(
      roundMode === 'external'
        ? '  Build and scan packets with prompts/DELEGATE-WORK.md instead.'
        : roundMode === 'solo'
          ? '  Build it in this session with prompts/CONTINUE-TINS-PROJECT.md instead.'
          : '  Get the per-task launch instructions from prompts/DELEGATE-WORK.md instead.',
    );
  }
  if (outcome === 'parked') {
    console.log('  Answer the open items in delegation/ESCALATIONS.md, set the task back to');
    console.log('  ready, and re-run. Parked is not failure — the run is owed an answer.');
  }
}

if (statusOnly || dryRun) {
  if (dryRun && !jsonOut) console.log('(dry run — nothing will be spawned)\n');
  report();
  process.exit(statusOnly ? exitCode : 0);
}

// --- dispatch ------------------------------------------------------------
// The mode refusal comes BEFORE the nothing-runnable exit on purpose: a
// user-driven round has an empty wave by definition, and reporting that as
// "parked" (exit 3) would tell the user the run is owed an answer when the
// real message is that they are in the wrong prompt.
if (roundMode && !DISPATCHABLE_MODES.includes(roundMode)) {
  die(
    `this round's execution mode is "${roundMode}" — you drive it, not this runner. ` +
      'Auto-dispatching work the user said they would run themselves (or work destined for a ' +
      'scrubbed packet) is exactly what this refusal prevents. Use prompts/DELEGATE-WORK.md, ' +
      'or re-run prompts/EXECUTION-MODE-INTERVIEW.md if the mode is genuinely wrong.',
  );
}

if (!wave.length) {
  report();
  process.exit(exitCode);
}

if (!config.workerCmd || /\{\{\s*YOUR/i.test(config.workerCmd) || config.workerCmd.trim() === '') {
  die(
    'ORCHESTRATION.json has no usable "workerCmd". Set it to the command that starts one worker ' +
      'session in your harness ({{TASK_ID}} and {{PROMPT_FILE}} are substituted), or spawn workers ' +
      'natively and skip this script — see AUTONOMOUS-BUILD.md Step 5.',
  );
}

const promptFile = resolve(process.cwd(), 'tins-kit/prompts/WORKER-SESSION.md');
console.log(`Dispatching ${wave.length} worker(s): ${wave.map((t) => t.id).join(', ')}`);
console.log('Mark each task `running` in LEDGER.md before it starts — the auditor owns the ledger.\n');

const results = await Promise.all(
  wave.map(
    (t) =>
      new Promise((res) => {
        const cmd = config.workerCmd
          .replaceAll('{{TASK_ID}}', t.id)
          .replaceAll('{{PROMPT_FILE}}', promptFile);
        // shell:true — workerCmd is the user's own configured command line.
        const child = spawn(cmd, { shell: true, stdio: 'inherit' });
        child.on('close', (code) => res({ id: t.id, code }));
        child.on('error', (err) => res({ id: t.id, code: -1, error: err.message }));
      }),
  ),
);

console.log('\nWave finished:');
for (const r of results) {
  console.log(`  ${r.id}: exit ${r.code}${r.error ? ` (${r.error})` : ''}`);
}
console.log('\nNow verify each returned task before integrating it (AUTONOMOUS-BUILD.md Step 7):');
console.log('  scope -> acceptance criteria -> the gate -> the decision log.');
console.log('Re-issue a failing task to a FRESH worker. Do not patch it yourself.');

process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
