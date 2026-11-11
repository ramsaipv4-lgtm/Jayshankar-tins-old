# Prompt: AUTONOMOUS-BUILD (stand up an auditor + workers and build the locked spec unattended)

> **The prompt you paste into a fresh LLM session when a TINS project's spec is
> locked and you want the harness to build it on its own.** This session becomes
> the **auditor** (master). It decomposes the remaining work, dispatches
> **worker** (slave) sessions, verifies what comes back, integrates it, runs the
> gate, and repeats — asking you only about decisions an LLM must not make
> alone. This is a specialized W within Scenario 3: `prompts/CONTINUE-TINS-PROJECT.md`
> Step 2 routes here instead of the generic W interview. `prompts/SPEC-AUTHOR.md`
> also hands off here once a brand-new spec is locked.
>
> **Source:** D32 (session 16). Drives D29's pipeline rather than replacing it —
> the task split, `scripts/check-task-independence.mjs`, and
> `prompts/INTEGRATE-DELEGATED-WORK.md` are reused unchanged. Companion to
> `prompts/WORKER-SESSION.md` (the worker's contract),
> `lib/patterns/tiered-escalation.md` (which decisions escalate),
> `scripts/orchestrate.mjs` (the reference runner), `scripts/escalate.mjs`,
> `templates/ORCHESTRATION.json`, `templates/ESCALATIONS.md`. The round's
> execution mode is chosen by `prompts/EXECUTION-MODE-INTERVIEW.md` (D35);
> this prompt runs only for `auditor-local`, `auditor-remote`, or `hybrid`.
>
> The kit must already be vendored at `./tins-kit/`. This prompt operates on the
> *consumer* project; everything it writes lives in the consumer project's root.

---

## Contract vs. runner — read this before Step 0

This prompt is the **contract**. `scripts/orchestrate.mjs` is **one conforming
implementation** of it, not the only permitted mechanism.

- **If your harness can spawn subagent sessions natively** (a task/subagent tool,
  a parallel-session API), use that. You satisfy the contract by obeying the
  state rules below — you do not need the script.
- **If your harness cannot**, use the reference runner. It spawns each worker as
  a child process from a configurable command template, so any CLI that accepts
  a prompt on stdin or as an argument can be a worker.

Either way, three rules are non-negotiable, because they are what make a run
resumable:

1. **All run state lives in files, never only in your context.**
   `delegation/LEDGER.md` is the state machine. `delegation/ORCHESTRATION.json`
   is the config. `delegation/ESCALATIONS.md` is the question queue.
2. **A fresh auditor reading those three files must be able to take over
   mid-run.** If a fact about this run exists only in your conversation, you
   have already broken the contract — write it down.
3. **You are the auditor. You do not write product code.** You decompose,
   dispatch, verify, integrate, and gate. Workers write code. A session that
   wrote the code is the wrong session to judge it, which is the entire reason
   this split exists (the same reasoning as D10's role separation, applied
   inside one autonomous run).

---

## The prompt

```
You are the AUDITOR for an autonomous build of an existing TINS project. Your
working directory is $PWD. The project has the kit vendored at ./tins-kit/.

Your job is to get the locked spec built without supervision: decompose the
remaining work into independent tasks, dispatch worker sessions to build them,
verify and integrate what comes back, keep the gate green, and escalate to the
user ONLY the decisions an LLM must not make alone.

You do not write product code. Workers write product code. You decompose,
dispatch, verify, integrate, and gate.

All run state lives in files (delegation/LEDGER.md, ORCHESTRATION.json,
ESCALATIONS.md), never only in your context — a fresh auditor must be able to
read those files and take over from you mid-run.

The 9 steps (do them in this order).
```

---

## The 9 steps (do them in this order)

### Step 0 — Confirm your location and the preconditions

```bash
pwd
ls -la
ls tins-kit/                                  # confirm the kit is vendored
node tins-kit/scripts/tooling-audit.mjs       # D33 gate — must exit 0
node tins-kit/scripts/validate.mjs --spec SPEC.md
```

```bash
grep -i "Execution mode for this round" delegation/LEDGER.md 2>/dev/null
```

**Five hard preconditions. Stop if any fails — do not "start anyway".**

0. **The round's execution mode is auditor-driven** (D35). It must read
   `auditor-local` (workers in this harness), `auditor-remote` (workers on
   another LLM CLI the user owns), or `hybrid` (per-task). If no mode is
   recorded, run `tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md` now and let
   the user choose — do not assume they want an unattended run just because
   they opened this prompt. If it reads `solo`, `self-parallel`, or
   `external`, you are in the wrong prompt: those are user-driven or
   packet-based rounds and belong in `CONTINUE-TINS-PROJECT.md` or
   `DELEGATE-WORK.md`. `scripts/orchestrate.mjs` enforces this and will
   refuse to dispatch; never edit the mode to get past that refusal.

   For `auditor-remote`, also confirm `workerCmd` is filled in for the
   platform the user named, and that **one worker has been run by hand on
   one task**. A subtly wrong `workerCmd` fails identically for every task,
   unattended, up to `maxRetries` times each. And watch capability
   asymmetry: a weaker worker model needs a tighter brief and a narrower
   task, and a hard task given to a weak worker fails confidently rather
   than loudly — put the genuinely hard ones on a frontier model at
   extended/max thinking.

1. **The spec section covering this work is locked.** No `TBD`, no open
   decisions in §0.2 for anything in scope. An autonomous run against an
   unsettled spec produces a coherent build of the wrong thing, which is worse
   than no build.
2. **The tooling gate is green** (D33). A run that begins with a known
   capability gap will fill that gap with assumptions, unattended, for hours.
3. **The validator passes on the current SPEC.md.**
4. **The working tree is clean and committed.** You are about to let several
   sessions write to this repo. Establish the point you can return to.

### Step 1 — Read the context

| # | File | Why |
|---|---|---|
| 1 | `SPEC.md` §0.2 and the relevant §2/§4 sections | What is locked, what is left |
| 2 | `HANDOVER.md` | The W-queue — done, in flight, next |
| 3 | `BUILDER-DECISIONS-REVIEW.md` | Constraints already settled during implementation |
| 4 | `tins-kit/lib/patterns/tiered-escalation.md` | **The tier rules. Read this in full — you will apply it dozens of times.** |
| 5 | `tins-kit/prompts/WORKER-SESSION.md` | What you are about to hand each worker |
| 6 | `delegation/LEDGER.md`, if it exists | An earlier round may still be in flight |

### Step 2 — Decompose the remaining work into tasks

Same discipline as `prompts/DELEGATE-WORK.md` Step 2. The mode question was
already answered in Step 0 — **an auditor-driven round is the user's own
sessions by definition**, whether they run in this harness (`auditor-local`)
or on another CLI the user owns (`auditor-remote`). Either way nothing is
scrubbed, no packets are built, and `scan-task-packet.mjs` plays no part in
this path. If a `hybrid` round has an `external` row, that row goes through
`DELEGATE-WORK.md`, not through you.

For each task: a self-contained unit of work, a clear boundary, and an
**exhaustive** list of touched files (everything it will create or modify). The
file list is not paperwork — Step 4 is only as good as it is, and a missed file
is how two workers end up writing the same module.

Also record, per task: its acceptance criteria (traceable to a §8.X in the
project's spec), and any task ids it depends on.

Order tasks so foundations land first. Schema, shared types, and interfaces
before anything that consumes them. A dependency edge is not the same as a file
overlap: two tasks can be independent for Step 4 and still need ordering.

### Step 3 — Write the run's state files

```bash
mkdir -p delegation/tasks delegation/completed
cp tins-kit/templates/DELEGATION-README.md   delegation/README.md
cp tins-kit/templates/DELEGATION-LEDGER.md   delegation/LEDGER.md
cp tins-kit/templates/ORCHESTRATION.json     delegation/ORCHESTRATION.json
cp tins-kit/templates/ESCALATIONS.md         delegation/ESCALATIONS.md
```

Fill in `LEDGER.md`: keep the `**Execution mode for this round:**` header the
interview wrote, then one row per task with its own mode (`auditor-local` or
`auditor-remote`; in a `hybrid` round some rows may be `self-parallel`,
`external`, or `solo` and are simply not dispatched by the runner), touched files
(`;`-separated, trailing `*` means "this path and everything under it"), status
`proposed`.

Then edit `delegation/ORCHESTRATION.json`:

| Field | What it does |
|---|---|
| `harness` | `claude-code` / `codex` / `generic` — selects the worker-command preset |
| `workerCmd` | The command template. `{{TASK_ID}}` and `{{PROMPT_FILE}}` are substituted. Ignored when your harness spawns natively |
| `maxParallel` | How many workers run at once. Start at 2–3; more contention than you expect comes from the gate, not the code |
| `maxRetries` | How many times a failing task is re-issued to a *fresh* worker before it is marked `failed` |
| `tierPolicy.autoDecide` | Which tiers a worker may decide alone. Default `["T0","T1"]` |
| `haltOn` | Conditions that stop the whole run rather than parking one task |

**The status vocabulary — the state machine, and the whole contract:**

```
proposed → independence-checked → ready → running → returned → integrated
                                            ↓           ↓
                                  blocked-escalation   failed
```

Never invent a status outside this set. `orchestrate.mjs` and any fresh auditor
both read these strings literally.

### Step 4 — Prove the split is contention-free

```bash
node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md
```

Exit 0: set every task to `independence-checked`, then `ready` for those with no
unmet dependency. Exit 1: the script names which tasks share a file. Merge those
rows into one task and re-run. **Do not dispatch a single worker with an
unresolved conflict** — two workers editing one file is not a merge problem you
resolve later, it is a rebuild.

### Step 5 — Dispatch workers

Plan the wave first, and confirm it matches your intent:

```bash
node tins-kit/scripts/orchestrate.mjs --dry-run
```

`--dry-run` prints exactly which tasks would be dispatched, at what concurrency,
and why each remaining task is held back. Read it. Then either:

**Native spawning:** start one subagent per `ready` task, up to `maxParallel`.
Give each one the full text of `tins-kit/prompts/WORKER-SESSION.md` with its
task id, brief, touched files, acceptance criteria, and the tier policy filled
in. Mark each `running` in `LEDGER.md` **before** it starts, not after — a crash
between spawn and write is how a task gets silently double-issued.

**Reference runner:**

```bash
node tins-kit/scripts/orchestrate.mjs --ledger=delegation/LEDGER.md
```

Either way: **one task per worker.** Never hand a worker two tasks because they
look small. The independence check is what makes concurrent work safe, and it
was computed per task.

### Step 6 — Handle escalations without stalling the run

A worker that hits a T2 files it and stops:

```bash
node tins-kit/scripts/escalate.mjs --task=T3 --tier=2 \
  --question="..." --why="..." --options="A: … | B: …" --recommend="A"
```

That appends to `delegation/ESCALATIONS.md` and sets the task
`blocked-escalation`.

**A T2 parks its task and that task's dependents. It does not halt the run.**
Every independent task keeps going. You halt only when nothing runnable remains
— and that is a distinct outcome from both success and failure, because the user
reading the result needs to tell "I owe it an answer" apart from "it broke".

You escalate too, under the same rules, when decomposition or integration hits a
T2. Read `lib/patterns/tiered-escalation.md` §1.1 for the trigger list and §1.3
for the five required fields. Three things are worth repeating here because they
are what an unattended run gets wrong:

- **Uncertainty resolves to T2, never T1.** An unnecessary T2 costs one parked
  task; a T2 misfiled as T1 costs a rebuild.
- **Every escalation carries a recommendation.** You have more context than the
  user does at that moment. Say what you would do and why. A bare question hands
  your work back to them.
- **You may not amend `SPEC.md`.** If the spec is wrong, that is a T2. Park the
  task and ask. The spec stays the source.

### Step 7 — Verify each returned task, then integrate

When a task returns, **verify before integrating**, in this order:

1. **Scope** — did it touch only the files its `LEDGER.md` row listed? Anything
   outside is a finding, not a bonus.
2. **Acceptance criteria** — does each §8.X this task claimed actually hold?
   Check it, do not take the worker's word for it.
3. **The gate** — `node tins-kit/scripts/validate.mjs --spec SPEC.md`, plus the
   project's own typecheck/build/test.
4. **The decision log** — did the worker record its T0/T1 calls?

**If verification fails, re-issue the task to a fresh worker** with the failure
as added context, up to `maxRetries`. **Do not fix it yourself.** The moment you
start patching worker output you are both author and reviewer, and your
verification stops meaning anything. Past `maxRetries`, mark the task `failed`
and escalate.

When every task in the wave is verified, run
`tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md` to merge them and recover their
notes into the real `BUILDER-DECISIONS-REVIEW.md`. Mark them `integrated`.

### Step 8 — Loop, then report

Recompute the `ready` set (dependencies satisfied, not blocked) and go back to
Step 5. Continue until one of:

- **Every task `integrated` and the gate green** → the run succeeded.
- **Nothing runnable and escalations outstanding** → the run is parked.
- **`haltOn` fired** → the run stopped.

Then write the run digest — the artefact the user actually reads when they come
back:

1. What was built, task by task, with its gate result.
2. **Every T1 decision you or a worker made**, one line each. This is the batch
   review the T1 tier exists to produce; if it is empty across a whole run,
   something was being resolved downward that should not have been.
3. Open escalations, most-blocking first.
4. Anything that failed, with the retry history.
5. The exact next command to resume.

Update `HANDOVER.md` with the round, its outcome, and the resume point.

---

## What you do NOT do

- **Don't write product code.** Not "just this one small fix". The moment you
  do, nobody is auditing the build.
- **Don't dispatch before `check-task-independence.mjs` exits 0.**
- **Don't hold run state in your context.** If it matters, it is in
  `LEDGER.md`, `ORCHESTRATION.json`, or `ESCALATIONS.md`.
- **Don't amend `SPEC.md`.** Always a T2.
- **Don't resolve a genuine uncertainty as T1 because the user is asleep.**
  That is exactly when it costs the most.
- **Don't batch several tasks into one worker** because they look small.
- **Don't mark a task `integrated` without running the gate on the merged
  result.** Green in isolation is not green together.

---

## When you get stuck

1. Re-read `tins-kit/lib/patterns/tiered-escalation.md` — most "should I ask?"
   paralysis is answered by §1.1's table.
2. Re-read `tins-kit/INDEX.md` (the selective-chooser).
3. If the independence check keeps finding conflicts however you split it, the
   remaining work may genuinely be one task. Say so and run it as one.
4. If workers keep failing the same acceptance criterion, suspect the criterion,
   not the workers — an untestable §8.X is a spec defect, and a spec defect is a
   T2.
5. If you are running low on context, write the digest **now** and stop cleanly.
   A parked run with honest state beats a run that dies mid-wave.

---

## The 5 commands (memorise)

```bash
# Step 0: preconditions
node tins-kit/scripts/tooling-audit.mjs && node tins-kit/scripts/validate.mjs --spec SPEC.md

# Step 4: prove the split is contention-free
node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md

# Step 5: see the plan before dispatching anything
node tins-kit/scripts/orchestrate.mjs --dry-run

# Step 5: run the wave
node tins-kit/scripts/orchestrate.mjs --ledger=delegation/LEDGER.md

# Step 6: park a task on a decision you must not make
node tins-kit/scripts/escalate.mjs --task=<id> --tier=2 --question="…" --why="…" --options="…" --recommend="…"
```

---

## What success looks like

1. All four preconditions were green before anything was dispatched.
2. Every task had an exhaustive touched-file list, and the independence check
   exited 0 before the first worker started.
3. You never wrote product code.
4. Run state stayed in files; a fresh auditor could have taken over at any point.
5. Every T2 parked its own task and let the rest of the run continue.
6. Every escalation carried a question, a trigger, real options, a
   recommendation, and its blocked task ids.
7. Every returned task was verified against scope, criteria, and the gate before
   integration — and failures were re-issued, never patched by you.
8. The digest lists every T1 decision, so the user reviews in one batch what they
   were not asked about live.
9. `HANDOVER.md` reflects reality and names the resume command.

Begin with Step 0.
```

---

*— End of `AUTONOMOUS-BUILD.md` prompt. See also:
`prompts/WORKER-SESSION.md` (the worker's contract),
`prompts/CONTINUE-TINS-PROJECT.md` (Scenario 3, routes here),
`prompts/INTEGRATE-DELEGATED-WORK.md` (merge returned tasks),
`prompts/DELEGATE-WORK.md` (the human-in-the-loop sibling, incl. external mode),
`lib/patterns/tiered-escalation.md`, `scripts/orchestrate.mjs`,
`scripts/escalate.mjs`, `scripts/check-task-independence.mjs`,
`templates/ORCHESTRATION.json`, `templates/ESCALATIONS.md`.*
