# Prompt: DELEGATE-WORK (split locked work for parallel execution)

> **The prompt you paste into a fresh LLM session when a TINS project's
> remaining work should be split across multiple LLM sessions or people,
> so it can be built in parallel and brought back together.** This is a
> specialized W within Scenario 3 — `prompts/CONTINUE-TINS-PROJECT.md`
> Step 2 routes here instead of the generic W interview when the user
> wants to split and parallelize remaining work. It requires the spec
> section covering that work to be locked already; this prompt does not
> touch vision or design decisions, only how the *building* gets divided.
>
> **Source:** D29 (session 13). Companion to
> `prompts/INTEGRATE-DELEGATED-WORK.md` (the other half — bringing the
> finished pieces back together), `templates/TASK-BRIEF.md`,
> `templates/DELEGATION-LEDGER.md`, `templates/DELEGATION-README.md`,
> `scripts/check-task-independence.mjs`, `scripts/scan-task-packet.mjs`.
>
> The kit must already be vendored at `./tins-kit/`. This prompt operates
> on the *consumer* project — the delegation folder it builds lives in
> the consumer project's root, not in the kit.

---

## The prompt

```
You are splitting the remaining work on an existing TINS project into
independent tasks so it can be built in parallel — by you across
multiple sessions, or by other people. Your working directory is $PWD.

The project has the kit vendored at ./tins-kit/. Your job is to: confirm
the relevant spec is locked, propose a task split, check it's genuinely
contention-free, and — for any task going to someone outside your
direct control — build a scrubbed, self-contained packet with nothing
in it that reveals how this project is actually built.

The 8 steps (do them in this order).
```

---

## The 8 steps (do them in this order)

### Step 0 — Confirm your location and that the work is locked

```bash
pwd
ls -la
ls tins-kit/    # confirm the kit is here
cat SPEC.md | grep -A3 "0.2"   # spot-check the relevant decisions are LOCKED
```

**Hard precondition:** the spec section covering the work you're about
to split must already be locked (no open decisions, no "TBD"). If it
isn't, stop — this is not the prompt for that. Splitting work before the
vision is settled just produces tasks built against a brief that changes
out from under them. Send the user back to the normal spec-amendment
flow first.

### Step 1 — Read the context

| # | File | Why |
|---|---|---|
| 1 | This project's `SPEC.md` §0.2 and the relevant §2/§4 sections | What's locked, what's left to build |
| 2 | This project's `HANDOVER.md` | The current W-queue — what's already done, what's next |
| 3 | This project's `BUILDER-DECISIONS-REVIEW.md` | Constraints already decided during implementation |
| 4 | `delegation/LEDGER.md`, if it exists | An earlier round may already be in flight |

### Step 2 — Read the round's mode, then propose the task split

**Do not ask the self-vs-external question here.** As of D35 it is asked
once per round, for all five execution modes at once, by
`tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md` — which is what routed you
here. Read the answer instead of re-asking it:

```bash
grep -i "Execution mode for this round" delegation/LEDGER.md
```

You should see `self-parallel`, `external`, or `hybrid`. What each means for
the rest of this prompt:

- **`self-parallel`** — the user personally runs each task, in their own
  sessions, on whatever LLM accounts and platforms they own. Full repo, full
  context, real `SPEC.md`, nothing scrubbed, no packets. Your job is the task
  split plus per-task launch instructions they can paste into each window.
- **`external`** — someone else runs it. Scrubbed packets, every time.
- **`hybrid`** — per task, from each row's Mode cell. Give each task its own
  treatment; never leave a row reading `hybrid`.

If the header is missing or reads `auditor-local` / `auditor-remote` /
`solo`, you are in the wrong prompt: an auditor-driven round belongs in
`AUTONOMOUS-BUILD.md`, and a `solo` round belongs in the normal
`CONTINUE-TINS-PROJECT.md` W flow. Stop and route correctly rather than
building packets nobody asked for. (Legacy pre-D35 ledgers say `Default mode
for this round: self | external`; read `self` as `self-parallel`.)

Then propose a task split from the remaining locked scope: each task a
self-contained unit of work with a clear boundary. For each candidate
task, list its touched files (everything it will create or modify) —
this list is what makes the next step meaningful, so be exhaustive, not
approximate.

Show the proposed split to the user before proceeding. Getting the split
wrong here is cheap to fix; getting it wrong after packets are built and
handed out is not.

### Step 3 — Write delegation/LEDGER.md

```bash
mkdir -p delegation/tasks delegation/completed
cp tins-kit/templates/DELEGATION-README.md delegation/README.md
cp tins-kit/templates/DELEGATION-LEDGER.md delegation/LEDGER.md
```

Fill in the LEDGER.md table: one row per task, its mode, its touched
files (`;`-separated, a trailing `*` means "this path and everything
under it"). Status starts at `proposed`.

### Step 4 — Run the independence check

```bash
node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md
```

**If it exits 0** (no conflicts): update every task's status to
`independence-checked` and continue.

**If it exits 1** (conflicts found): the script names which tasks share
a file and recommends merging them, delegated to a senior engineer or a
frontier model run at extended/max thinking rather than split further.
Do this — merge the conflicting rows in `LEDGER.md` into one — and
re-run the check. Do not proceed to Step 5 with any unresolved conflict.
A round is not ready to hand out until this exits 0.

### Step 5 — Build each task

**For a `self`-mode task:** no packet. Clone or copy the project (or
just work in a separate branch/checkout if that's simpler for you),
and in that copy, paste `tins-kit/prompts/CONTINUE-TINS-PROJECT.md`
into a fresh LLM session scoped to that one task — treat it as a normal
W. That session reads the real `SPEC.md`, writes to the real
`BUILDER-DECISIONS-REVIEW.md`, full context, nothing hidden. Create
`delegation/tasks/<id>/status.md` to track it (assigned/in-progress/
returned/integrated + dates).

**For an `external`-mode task:**

```bash
mkdir -p "delegation/tasks/<id>/packet/files" "delegation/tasks/<id>/returned"
cp tins-kit/templates/TASK-BRIEF.md "delegation/tasks/<id>/packet/TASK-BRIEF.md"
```

1. Fill in `TASK-BRIEF.md` completely: Context, Scope, Interface
   Contract, the files list, Acceptance Criteria, Out of Scope,
   Definition of Done, How to Return Your Work. Write it the way a
   senior architect hands a ticket to a team lead — unambiguous, no
   internal jargon, nothing left to the contributor's guesswork about
   what's in scope.
2. Copy exactly the files this task's `LEDGER.md` row lists into
   `packet/files/` — nothing more. Do not include the whole repo "just
   in case."
3. Create a blank `packet/NOTES.md` with one line: `<!-- Your notes go
   here — decisions you made, trade-offs, anything the next person
   should know. -->`
4. Scan before shipping:
   ```bash
   node tins-kit/scripts/scan-task-packet.mjs "delegation/tasks/<id>/packet"
   ```
   Fix anything it flags in the source files (not by editing the
   scanner) and re-run until it exits 0. This is a check, not the
   defense — re-read `TASK-BRIEF.md` yourself too.
5. Zip it for handoff:
   ```bash
   # POSIX
   tar czf "delegation/tasks/<id>/packet.tar.gz" -C "delegation/tasks/<id>/packet" .
   # Windows
   powershell -NoProfile -Command "Compress-Archive -Path 'delegation/tasks/<id>/packet/*' -DestinationPath 'delegation/tasks/<id>/packet.zip' -Force"
   ```
6. Send the archive to the contributor by whatever channel makes sense
   — not repo access, not a git remote. Just the file.

### Step 6 — Update the ledger

Set every started task's status to `assigned` (or `in-progress` if
work has already begun) in `delegation/LEDGER.md`, with today's date.
Add a line to `HANDOVER.md`'s W-queue noting this round started, how
many tasks, and their mode split.

### Step 7 — Wait, then hand off to integration

When a task comes back: for `self` mode, it's already integrated into
that clone — mark it `returned` and note where the clone lives. For
`external` mode, drop the contributor's delivered archive into
`delegation/tasks/<id>/returned/` (unzip it there) and mark the task
`returned` in `LEDGER.md`.

Once every task in this round is `returned`, open and run
`tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md` — that prompt pulls
everything back together.

---

## What you do NOT do

- **Don't build a packet before the independence check is clean.** A
  conflict found after packets are already out means re-issuing work,
  not just editing a spreadsheet.
- **Don't put anything into `packet/files/` beyond what the LEDGER.md
  row lists.** "Just in case" context is exactly how methodology leaks.
- **Don't skip the scanner "just this once."** It's cheap to run and
  expensive to skip once.
- **Don't let a `self`-mode task skip the real decision log.** There's
  no scrubbing reason to skip it — you're not hiding anything from
  yourself.
- **Don't treat a shipped packet as editable.** If scope needs to
  change after handoff, cancel that task and issue a new one — don't
  send a follow-up patch to `TASK-BRIEF.md` that the contributor has to
  reconcile against work already started.

---

## When you get stuck

1. Re-read `tins-kit/INDEX.md` (the selective-chooser).
2. Re-read this project's `HANDOVER.md` (the W-queue).
3. If the independence check keeps finding conflicts no matter how you
   split it, the remaining work may not be as separable as it looked —
   consider whether it's actually one task, not several.
4. If a scan keeps flagging something that looks like a false positive
   (a legitimate word that happens to match a banned term), rephrase
   the brief rather than special-casing the scanner — the goal is a
   packet that reads cleanly to a human too, not just one that passes
   the script.

---

## The 3 commands (memorise)

```bash
# Step 4: check the split is contention-free
node tins-kit/scripts/check-task-independence.mjs --ledger=delegation/LEDGER.md

# Step 5: scan an external-mode packet before shipping
node tins-kit/scripts/scan-task-packet.mjs delegation/tasks/<id>/packet

# Step 7 (next prompt): bring it all back together
# (open and run tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md)
```

---

## What success looks like

1. The relevant spec section was locked before you started.
2. You asked the self-vs-external question and got a clear round
   default.
3. You proposed a task split with exhaustive touched-file lists.
4. The independence check exits 0 before any packet is built.
5. Every external-mode packet passes the leak scanner before it ships.
6. Every self-mode task runs the normal kit workflow with full
   continuity.
7. `delegation/LEDGER.md` reflects reality at every step.
8. When tasks return, you hand off cleanly to
   `INTEGRATE-DELEGATED-WORK.md`.

Begin with Step 0.
```

---

*— End of `DELEGATE-WORK.md` prompt. See also:
`prompts/INTEGRATE-DELEGATED-WORK.md` (bring it back together),
`prompts/CONTINUE-TINS-PROJECT.md` (Scenario 3, routes here),
`templates/TASK-BRIEF.md`, `templates/DELEGATION-LEDGER.md`,
`templates/DELEGATION-README.md`,
`scripts/check-task-independence.mjs`, `scripts/scan-task-packet.mjs`.*
