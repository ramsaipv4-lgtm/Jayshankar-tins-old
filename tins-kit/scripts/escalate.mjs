#!/usr/bin/env node
// scripts/escalate.mjs
//
// Files a tiered escalation from a worker or auditor session during an
// autonomous build (D32). Appends a well-formed entry to
// delegation/ESCALATIONS.md and — for a T2 — marks the task
// `blocked-escalation` in delegation/LEDGER.md so the run parks that task
// and keeps building everything else.
//
// The tier rules live in lib/patterns/tiered-escalation.md. In short:
//   T0  decide and log            -> NOT an escalation. Belongs in NOTES.md.
//   T1  decide, log, flag         -> recorded here for the run digest; does
//                                    not block.
//   T2  stop and ask the user     -> blocks this task (and its dependents),
//                                    never the whole run.
//
// A T2 must carry all five fields (pattern §1.3): question, why-it-is-T2,
// options, recommendation, and the blocked task. This script refuses to
// file one without them — an escalation that reads "Postgres or SQLite?"
// converts the model's work into the user's work, which is the opposite of
// delegation.
//
// Usage:
//   node tins-kit/scripts/escalate.mjs --task=T3 --tier=2 \
//     --question="Should failed migration rows be deleted or quarantined?" \
//     --why="Irreversible data loss; not settled by a locked decision" \
//     --options="A: delete (simple, unrecoverable) | B: quarantine table (recoverable, extra table)" \
//     --recommend="B — recoverable, and D5's append-only rule points the same way"
//
//   node tins-kit/scripts/escalate.mjs --task=T4 --tier=1 \
//     --question="Named the helper formatBatchPrice rather than priceForBatch" \
//     --why="Naming inside locked scope"
//
// Options:
//   --task=<id>            Required. The LEDGER.md task row id.
//   --tier=<1|2>           Required. T0 is rejected on purpose.
//   --question=<text>      Required. One answerable sentence.
//   --why=<text>           Required. Which trigger fired.
//   --options=<a | b>      Required for T2. `|`-separated, 2+ entries.
//   --recommend=<text>     Required for T2. What you would choose, and why.
//   --blocks=<id,id>       Optional. Other task ids stalled by this.
//   --escalations=<path>   Default delegation/ESCALATIONS.md
//   --ledger=<path>        Default delegation/LEDGER.md
//   --json                 Machine-readable result.
//
// Exit 0: escalation filed.
// Exit 2: usage error, missing required field, or missing ESCALATIONS.md.
//
// Zero-dep Node ESM (D3).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const HELP = `escalate.mjs — file a tiered escalation (D32)

  --task=<id>          Required. LEDGER.md task row id.
  --tier=<1|2>         Required. T0 is not an escalation (use NOTES.md).
  --question=<text>    Required. One answerable sentence.
  --why=<text>         Required. Which tier trigger fired.
  --options=<a | b>    Required for T2. '|'-separated, 2 or more.
  --recommend=<text>   Required for T2. What you would choose, and why.
  --blocks=<id,id>     Optional. Other tasks stalled by this.
  --escalations=<path> Default delegation/ESCALATIONS.md
  --ledger=<path>      Default delegation/LEDGER.md
  --json               Machine-readable result.

Exit 0 filed / 2 usage or missing field.
See lib/patterns/tiered-escalation.md for the tier rules.`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

function arg(name, fallback = null) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const jsonOut = args.includes('--json');
const task = arg('task');
const tierRaw = arg('tier');
const question = arg('question');
const why = arg('why');
const optionsRaw = arg('options');
const recommend = arg('recommend');
const blocks = (arg('blocks') || '').split(',').map((s) => s.trim()).filter(Boolean);
const escPath = resolve(process.cwd(), arg('escalations', 'delegation/ESCALATIONS.md'));
const ledgerPath = resolve(process.cwd(), arg('ledger', 'delegation/LEDGER.md'));

const errors = [];
if (!task) errors.push('--task=<id> is required.');
if (!tierRaw) errors.push('--tier=<1|2> is required.');

const tier = tierRaw === null ? null : String(tierRaw).replace(/^[tT]/, '');
if (tier !== null && !['0', '1', '2'].includes(tier)) {
  errors.push(`--tier must be 1 or 2 (got "${tierRaw}").`);
}
if (tier === '0') {
  errors.push(
    'T0 is not an escalation. A T0 is "decide and log" — record it in ' +
      'delegation/tasks/<id>/NOTES.md. Filling the escalation queue with ' +
      'decisions nobody needs to make is how the real questions get skimmed ' +
      'past (tiered-escalation.md §2.1).',
  );
}
if (!question) errors.push('--question=<one answerable sentence> is required.');
if (!why) errors.push('--why=<which trigger fired> is required.');

if (tier === '2') {
  if (!optionsRaw) {
    errors.push("--options is required for a T2 ('|'-separated, 2 or more).");
  } else if (optionsRaw.split('|').map((s) => s.trim()).filter(Boolean).length < 2) {
    errors.push('--options must list 2 or more real candidates, separated by "|".');
  }
  if (!recommend) {
    errors.push(
      '--recommend is required for a T2. You have more context than the user ' +
        'does right now; a bare question hands your work back to them ' +
        '(tiered-escalation.md §1.3).',
    );
  }
}

if (errors.length) {
  if (jsonOut) {
    console.log(JSON.stringify({ ok: false, errors }, null, 2));
  } else {
    console.error('ERROR: cannot file this escalation.\n');
    for (const e of errors) console.error(`  · ${e}`);
    console.error('\nRun with --help for the full field list.');
  }
  process.exit(2);
}

if (!existsSync(escPath)) {
  const msg = `${escPath} not found. Copy templates/ESCALATIONS.md into delegation/ first (AUTONOMOUS-BUILD.md Step 3).`;
  if (jsonOut) console.log(JSON.stringify({ ok: false, errors: [msg] }, null, 2));
  else console.error(`ERROR: ${msg}`);
  process.exit(2);
}

const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
const options = (optionsRaw || '')
  .split('|')
  .map((s) => s.trim())
  .filter(Boolean);

let entry;
if (tier === '2') {
  entry = [
    ``,
    `### [T2] ${task} — ${question}`,
    ``,
    `- **Filed:** ${now}`,
    `- **Status:** OPEN`,
    `- **Why this is T2:** ${why}`,
    `- **Options:**`,
    ...options.map((o) => `  - ${o}`),
    `- **Recommendation:** ${recommend}`,
    `- **Blocked:** ${[task, ...blocks].join(', ')}`,
    `- **Answer:** _(the user writes the answer here, then sets Status to ANSWERED)_`,
    ``,
  ].join('\n');
} else {
  entry = [
    ``,
    `- **[T1] ${task}** (${now}) — ${question} _Why:_ ${why}`,
    ``,
  ].join('\n');
}

const escText = readFileSync(escPath, 'utf8').replace(/\r\n/g, '\n');
const T1_HEADING = '## T1 decisions (digest — no action needed)';
const T2_HEADING = '## T2 escalations (open questions — the run is parked on these)';

let updated;
if (tier === '2') {
  updated = escText.includes(T2_HEADING)
    ? escText.replace(T2_HEADING, T2_HEADING + '\n' + entry)
    : escText.trimEnd() + '\n\n' + T2_HEADING + '\n' + entry;
} else {
  updated = escText.includes(T1_HEADING)
    ? escText.replace(T1_HEADING, T1_HEADING + '\n' + entry)
    : escText.trimEnd() + '\n\n' + T1_HEADING + '\n' + entry;
}
writeFileSync(escPath, updated, 'utf8');

// A T2 parks its task. It does NOT halt the run — every independent task
// keeps going (tiered-escalation.md §2.2).
let ledgerUpdated = false;
if (tier === '2' && existsSync(ledgerPath)) {
  const raw = readFileSync(ledgerPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  let statusCol = -1;
  let taskCol = -1;
  const out = lines.map((line) => {
    if (!line.trim().startsWith('|')) return line;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    if (statusCol === -1) {
      const lower = cells.map((c) => c.trim().toLowerCase());
      if (lower.some((h) => h.includes('status')) && lower.some((h) => h.includes('task'))) {
        statusCol = lower.findIndex((h) => h.includes('status'));
        taskCol = lower.findIndex((h) => h.includes('task'));
        return line;
      }
      return line;
    }
    if (taskCol === -1 || statusCol === -1) return line;
    if (cells[taskCol] === undefined) return line;
    if (cells[taskCol].trim() !== task) return line;
    const width = cells[statusCol].length;
    const replacement = ` blocked-escalation `.padEnd(Math.max(width, 20), ' ');
    cells[statusCol] = replacement;
    ledgerUpdated = true;
    return `|${cells.join('|')}|`;
  });
  if (ledgerUpdated) writeFileSync(ledgerPath, out.join('\n'), 'utf8');
}

const result = {
  ok: true,
  tier: `T${tier}`,
  task,
  filed: escPath,
  ledgerUpdated,
  blocks: tier === '2' ? [task, ...blocks] : [],
};

if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
} else if (tier === '2') {
  console.log(`Filed T2 escalation for ${task} in ${escPath}`);
  console.log(
    ledgerUpdated
      ? `  ${task} marked blocked-escalation in the ledger.`
      : `  NOTE: no ledger row matched "${task}" — mark it blocked-escalation by hand.`,
  );
  console.log(`  Blocked: ${[task, ...blocks].join(', ')}`);
  console.log('  The run continues on every task that does not depend on this one.');
  console.log(`  Stop working on ${task} now. Do not start a speculative branch.`);
} else {
  console.log(`Recorded T1 decision for ${task} in ${escPath} (run digest; not blocking).`);
}
process.exit(0);
