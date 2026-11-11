# Prompt: INTEGRATE-DELEGATED-WORK (bring parallel tasks back together)

> **The prompt you paste into a fresh LLM session once every task from a
> `DELEGATE-WORK.md` round has come back.** It merges each returned
> task's output into the project, folds whatever notes came back into
> the real decision log, resolves discrepancies (small ones itself,
> large ones with you), and leaves the gate green.
>
> **Source:** D29 (session 13). Companion to `prompts/DELEGATE-WORK.md`
> (the other half — splitting and handing out).
>
> The kit must already be vendored at `./tins-kit/`. This prompt assumes
> `delegation/LEDGER.md` exists with at least one task marked `returned`.

---

## The prompt

```
You are integrating the results of a parallel-work round on an existing
TINS project. Your working directory is $PWD. delegation/LEDGER.md
lists the tasks from that round; some or all are marked "returned".

Your job: merge every returned task in, recover whatever's usable from
each task's notes, resolve discrepancies — auto-fixing the small ones
and explaining the large ones to the user before touching anything —
and leave the project's gate green.

The 7 steps (do them in this order).
```

---

## The 7 steps (do them in this order)

### Step 0 — Confirm your location and what's ready

```bash
pwd
ls -la
cat delegation/LEDGER.md | grep -A2 "|.*|"    # see task statuses
```

Only integrate tasks marked `returned`. A task still `in-progress` or
`assigned` isn't ready — leave it in the ledger and integrate the rest;
you don't have to wait for every task in a round to finish before
bringing in the ones that are done, unless their interface contracts
depend on each other (they shouldn't, if the independence check passed
— but re-check the brief if something feels off).

### Step 1 — Read the context

| # | File | Why |
|---|---|---|
| 1 | This project's `SPEC.md` | What the finished whole is supposed to look like |
| 2 | This project's `HANDOVER.md` | Where the project stood before this round |
| 3 | `delegation/LEDGER.md` | Which tasks, which mode, what's returned |
| 4 | Each returned task's `TASK-BRIEF.md` (in its `packet/`, external mode) | What that task was actually asked to do — the contract to check against |

### Step 2 — Merge each returned task, self-mode first

**Self-mode tasks** are already integrated into their own clone with
full commit/decision history — bring that clone's changes into the main
tree (merge, cherry-pick, or manual copy, whatever fits the project's
version control). Nothing needs translation; it already speaks the
project's real vocabulary.

**External-mode tasks** land from `delegation/tasks/<id>/returned/` —
copy the delivered files into the project tree at the paths the
`TASK-BRIEF.md`'s Interface Contract specified. Diff against what was
in `packet/files/` originally to see exactly what changed.

Merge in whatever order avoids stepping on files still being merged
from another task — the independence check should mean this doesn't
actually matter, but do it one task at a time and re-run the gate (Step
4) between each if the project is large enough that "obviously fine"
isn't obvious.

### Step 3 — Recover the notes

For every external-mode task, read its `packet/NOTES.md` (now sitting
in `delegation/tasks/<id>/returned/` or wherever it was unzipped). If
the contributor left anything worth keeping — a decision they made, a
trade-off, something they'd do differently — translate it into a
`BUILDER-DECISIONS-REVIEW.md` entry in the project's real vocabulary
via `decision-log.mjs`:

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="<title, in the project's own terms>" \
  --context="<what NOTES.md said, restated>" \
  --decision="<what they chose>" \
  --alternatives="<if mentioned>" \
  --consequences="<if apparent>" \
  --cross-refs="delegation/LEDGER.md <task id>"
```

Self-mode tasks already wrote directly to the real
`BUILDER-DECISIONS-REVIEW.md` — nothing to recover there.

### Step 4 — Reconcile discrepancies

Run the project's own gate:

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test <project's test command, if any>
```

Sort what comes up into two piles:

**Auto-fixable** — naming mismatches, formatting, a straightforward
merge conflict, anything where the correct resolution is obvious and
low-risk. Fix it yourself and note what you changed and why in your
summary to the user.

**Needs the human** — anything touching behavior, security, scope, or
where two returned tasks made incompatible choices. For each of these:
**explain what your proposed fix would do before applying it**, and
either get the user's go-ahead or let them describe a different fix.
Don't apply a needs-human fix silently just because you're confident —
that's exactly the category where a wrong guess is expensive.

### Step 5 — Update the ledger and archive

Mark every merged task `integrated` in `delegation/LEDGER.md`. Move its
folder from `delegation/tasks/<id>/` to `delegation/completed/<id>/`
(the packet, the returned work, and status.md — the full record of that
task, kept for reference).

### Step 6 — Record and leave the gate green

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="Integrate <round name/date> — N tasks merged" \
  --context="..." --decision="..." --consequences="..." \
  --cross-refs="delegation/LEDGER.md, delegation/completed/"
```

Update `HANDOVER.md`: mark the round's W as done, note anything
kit-worthy that came out of running a parallel round for the first time
on this project.

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test <project's test command, if any>
```

Both must exit 0. If either fails, fix it before stopping — an
integration that leaves the gate red is worse than not integrating at
all.

---

## What you do NOT do

- **Don't silently apply a needs-human fix.** Explain first, always,
  for anything above the auto-fixable bar.
- **Don't skip recovering notes because a task was external-mode.**
  That's the entire point of asking for a generic `NOTES.md` — losing
  it by not reading it defeats the design, not just the courtesy.
- **Don't delete a task's `packet/` or `returned/` folder after
  merging.** Archive it to `delegation/completed/` instead — it's the
  audit trail for what actually shipped.
- **Don't integrate a task still marked `in-progress`.** Wait for it,
  or drop it from this round and integrate it separately later.

---

## When you get stuck

1. Re-read the returned task's `TASK-BRIEF.md` — the Interface Contract
   section is the contract to check the delivered work against.
2. Re-read `delegation/LEDGER.md`'s touched-file lists — if merged
   files don't match what was declared, that's worth asking the user
   about before proceeding.
3. If two returned tasks conflict in a way that isn't a simple merge
   conflict (they made genuinely incompatible design choices), that's
   a needs-human discrepancy — stop and explain, don't pick a winner
   yourself.

---

## The 2 commands (memorise)

```bash
# Step 3: fold a returned task's notes into the real decision log
node tins-kit/scripts/decision-log.mjs builder --title="..." --context="..." --decision="..." --cross-refs="delegation/LEDGER.md <task id>"

# Step 4 / Step 6: the gate
node tins-kit/scripts/validate.mjs --spec=SPEC.md
```

---

## What success looks like

1. Every `returned` task is merged into the project tree.
2. Every external-mode task's `NOTES.md` was read; anything useful is
   now in the real `BUILDER-DECISIONS-REVIEW.md`.
3. Small discrepancies were fixed and noted; large ones were explained
   to the user before being touched.
4. `delegation/LEDGER.md` and `delegation/completed/` reflect what
   actually happened.
5. The gate is green.
6. `HANDOVER.md` tells the next session this round is done.

Begin with Step 0.
```

---

*— End of `INTEGRATE-DELEGATED-WORK.md` prompt. See also:
`prompts/DELEGATE-WORK.md` (the other half — splitting and handing
out), `scripts/decision-log.mjs`, `scripts/validate.mjs`,
`delegation/LEDGER.md` (per-project, not in the kit).*
