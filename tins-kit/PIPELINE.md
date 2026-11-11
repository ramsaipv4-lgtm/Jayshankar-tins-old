# PIPELINE.md — the TINS methodology, in 7 steps

> **Read this file first.** It is the shortest path to "I know what to do."
> If you are an LLM session starting work in any TINS workspace (kit root
> or a consumer project), these 7 steps are what you do. In this order.
> Every time. No improvisation.
>
> **Where you might be reading this:**
> - **At the kit root** (`tins-kit/`) — you're a *kit growth* session, mining
>   a consumer for new patterns.
> - **At a consumer project root** (`Jayshankar/`, `incubos/`,
>   `Data-cleaning-script/`, `package5/`, `exam-forge/`) — you're building
>   a consumer, and the kit is vendored at `<project>/tins-kit/`.
>
> **The 7 steps below are universal.** They apply in both contexts. The
> specific commands differ (kit-root vs. project-root), but the discipline
> is the same.

---

## Step 0 — Confirm your location and role

```bash
# Where am I?
pwd

# Which project / which role?
ls -la
# → If you see tins-kit/ as a *child* dir: you're at a CONSUMER root.
#   Use `<project>/tins-kit/` for kit scripts.
# → If you see SPEC.md + HANDOVER.md + lib/ + prompts/ as *children*: you're
#   at the KIT root. Use ./scripts/ and ./lib/ directly.
```

You are at the **consumer root** if the working dir has its own `SPEC.md`,
`HANDOVER.md`, `lib/`, `src/`, etc. AND has `tins-kit/` as a sub-folder.

You are at the **kit root** if the working dir is `tins-kit/` itself (you
read this file at `tins-kit/PIPELINE.md`).

---

## Step 1 — Read 3 files, in this order

| # | File | Why |
|---|---|---|
| 1 | `tins-kit/PIPELINE.md` (this file) | The methodology |
| 2 | `tins-kit/AGENTS.md` (kit's own onboarding) | The kit's standing rules — D1–D24, validator, self-test |
| 3 | This project's `HANDOVER.md` (at the project root, NOT inside `tins-kit/`) | The project's state, work queue, gotchas |

**At a consumer root:** the third file is `<project>/HANDOVER.md`.
**At the kit root:** the third file is `tins-kit/HANDOVER.md`.

Do NOT skip this. Every TINS session that skipped this step re-derives the
state from scratch and wastes 30 minutes.

---

## Step 2 — Pick the right W (or run coverage)

```bash
# At a consumer root — see what the kit recommends for your SPEC
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md

# At a consumer root — see the work queue
cat HANDOVER.md | grep -A 1 "## §5\|### W"

# At the kit root — see the work queue
cat HANDOVER.md | grep -A 1 "## §5\|### W"
```

**If you are starting a NEW project** (no `SPEC.md` yet, or `SPEC.md` is
empty): run `prompts/SPEC-AUTHOR.md` in a *fresh* LLM session. The
interview is 7 questions + A/B/C pass. Don't skip it.

**If you are continuing an EXISTING project:** pick up the next W in the
H-queue (the first W with status `⏳` or `🔶`). Mark it `in_progress` in
HANDOVER.md before you start.

---

## Step 3 — Spec first, code second (always)

If the W is non-trivial (touches code, schema, API), it goes through the
spec FIRST. The discipline:

1. Edit the relevant section of `SPEC.md` (or the per-project
   `BUILDER-DECISIONS-REVIEW.md` for a builder decision).
2. Re-run the validator: `node tins-kit/scripts/validate.mjs --spec=SPEC.md`.
3. Only then start coding.

The TINS markers at the top of `SPEC.md` (`<!-- TINS Specification v1.0 -->`
+ `<!-- ZS: -->`) are required. The validator will fail without them.

**At the kit root:** the "spec" is `tins-kit/SPEC.md`. Every change to the
kit's source code MUST be matched by a `SPEC.md` amendment and a
`BUILDER-DECISIONS-REVIEW.md` entry.

---

## Step 4 — Build, then record decisions

While you build, every non-obvious decision goes into the project's
`BUILDER-DECISIONS-REVIEW.md` via the CLI:

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="The <X> pattern" \
  --context="We needed <Y>; the naive approach was <Z>; the real fix is <W>." \
  --decision="Always <X>. Pin the pattern in <files>." \
  --alternatives="<A> (rejected because <reason>); <B> (rejected because <reason>)" \
  --consequences="Every <X> now does <Y>; <Z> is deprecated; <W> is the rule."
```

A "non-obvious decision" is any choice that:
- Deviates from the obvious / naive / first-thing-Google-suggests path
- Was forced by a real-world failure (a bug, a SQLSTATE, a misread of the docs)
- Will trip up a future contributor if it's not recorded

If it's in the spec, it's NOT a decision — it's already locked. If it's
"we used `const` instead of `let`", it's not a decision — it's too small.

**At the kit root:** the same `decision-log.mjs` writes to
`tins-kit/BUILDER-DECISIONS-REVIEW.md`.

---

## Step 5 — Mine your learnings back to the kit

When you finish a W (or finish Mode A of a consumer), mine the consumer's
decisions for kit-worthy patterns. This is the *auto-extraction* half of
the loop (D17).

**At a consumer root:**

```bash
# Run the auto-extractor (it reads your BUILDER-DECISIONS-REVIEW.md +
# lib/patterns/ + lib/, scores 0-7, writes kit-growth-candidates.md)
node tins-kit/scripts/kit-extract.mjs --consumer=.
# → exits 0 if no candidates, 1 if there are
```

If the script exits 1, **a kit-growth session is needed** (the next
session, at the kit root). The candidates are in
`<project>/kit-growth-candidates.md`.

**At the kit root (a kit-growth session):**

```bash
# For each consumer that has candidates:
node scripts/kit-extract.mjs --consumer=../<project>
# → produces <project>/kit-growth-candidates.md
```

Then run `prompts/KITTING-REVIEW.md` to triage each candidate
(accept / reject / defer). For each accepted, run the KITTING workflow
(see `prompts/KITTING.md` + `scripts/kit-new-pattern.mjs`).

---

## Step 6 — Sync the vendored kit back to each project

When the kit grows (new pattern, new module, new script), the vendored
copies in each project are stale. Sync them:

**At the kit root:**

```bash
# Push the latest kit to a specific project's vendored copy
node scripts/kit-sync.mjs --to=../Jayshankar
node scripts/kit-sync.mjs --to=../incubos
node scripts/kit-sync.mjs --to=../Data-cleaning-script
node scripts/kit-sync.mjs --to=../package5
node scripts/kit-sync.mjs --to=../exam-forge
```

**At a consumer root (forward sync — pull the latest kit):**

```bash
# Pull the latest kit from the top-level tins-kit/
node tins-kit/scripts/kit-sync.mjs --to=./tins-kit
# (assumes the consumer's tins-kit/ is a sibling of the top-level one;
#  the script computes the relative path automatically)
```

The sync is *additive + update* — it does not delete files the project
has added. The project's own code (outside `tins-kit/`) is never touched.

---

## Step 7 — Leave the gate green, update HANDOVER, commit

Before you stop, the gate must be green:

```bash
# At the kit root
node scripts/validate.mjs --all
node --test scripts/selftest.mjs

# At a consumer root
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test tins-kit/scripts/selftest.mjs
```

If either fails, fix it before stopping. A broken gate is worse than no
gate.

Then update the project's `HANDOVER.md`:
- Mark the W as `✅ DONE (YYYY-MM-DD)` or `🔶 PARTIAL`
- Add a new W if the work spawned follow-ups
- Update the "Last updated" / "Last worked on by" / "Queue position" header
- Add a gotcha to §4 if you hit one
- Update the state snapshot (§3) with anything that changed

Then `git add` + `git commit` (or filesystem-only — see VERSIONING.md for
the version control strategy). The next session reads HANDOVER and picks
up where you left off.

---

## The 7 commands (memorise these)

```bash
# At a CONSUMER root (the typical case):
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md    # Step 2: what does the kit recommend?
cat HANDOVER.md | grep "### W"                            # Step 2: what's the W-queue?
node tins-kit/scripts/validate.mjs --spec=SPEC.md          # Step 3: is the spec valid?
node tins-kit/scripts/decision-log.mjs builder ...         # Step 4: record the decision
node tins-kit/scripts/kit-extract.mjs --consumer=.         # Step 5: mine the learnings
node tins-kit/scripts/kit-sync.mjs --to=./tins-kit         # Step 6: pull the latest kit (when needed)
node tins-kit/scripts/validate.mjs --spec=SPEC.md          # Step 7: leave the gate green
```

```bash
# At the KIT root (a kit-growth session):
node scripts/kit-extract.mjs --consumer=../<project>      # Step 5: read the consumer's candidates
node scripts/kit-new-pattern.mjs <name>                   # Step 5: scaffold a new pattern
node scripts/validate.mjs --all                           # Step 7: kit inventory gate
node --test scripts/selftest.mjs                           # Step 7: selftest
```

---

## What's non-negotiable

1. **Spec first, code second.** No exceptions. The spec is the contract.
2. **The gate is green before you stop.** Always. A broken gate is worse
   than no gate.
3. **Decisions are recorded.** Every spec amendment + every builder
   decision + every reviewer finding has an entry in the right log.
4. **The kit is the source of truth.** A consumer's vendored `tins-kit/`
   is a *copy*; the top-level `tins-kit/` is the *source*. When in
   doubt, the top-level wins.
5. **The loop is closed.** When you build, record; when you record,
   mine; when you mine, accept or reject; when you accept, sync.

---

## Beyond the 7 steps: the staging area (for projects on other machines)

The 7 steps above assume the consumer is a sibling of the kit
(`../<project>/`). That's fine for the 5 reference projects
(Jayshankar, incubos, Data-cleaning-script, package5, exam-forge) and
for any future project that's scaffolded via `scripts/new-project.mjs`
into the same workspace root.

But it doesn't work for projects on **other machines** (laptop vs.
server, two computers, a friend sending you a tarball, a project that
predates the kit). The kit's transport layer for those cases is
**`kit-staging/`** + the **portable kit shell** + **2 generic prompts**.

### When you want to start a new TINS project on a different machine

Paste `prompts/NEW-PROJECT.md` into a fresh LLM session at the new
project's working directory. The prompt:

1. Asks the LLM to confirm its location (the working directory must have
   a `.kit-shell/` directory; if not, the user runs
   `node /path/to/tins-kit/scripts/kit-new-project-shell.mjs <project-name>`
   at the kit machine and copies the resulting folder over).
2. Asks the LLM to read the kit shell's prompts (SPEC-AUTHOR.md,
   INTERVIEW-CHECKLIST.md, BUILDER-REVIEW-TEMPLATE.md).
3. Asks the LLM to interview the user (the 7 questions + A/B/C pass).
4. Asks the LLM to draft the SPEC.md at the project root.
5. Asks the LLM to build the project (spec first, code second).
6. Asks the LLM to record every non-obvious decision in
   `BUILDER-DECISIONS-REVIEW.md` via
   `node .kit-shell/scripts/decision-log.mjs builder ...`.
7. Asks the LLM to run `node .kit-shell/scripts/kit-extract.mjs --consumer=.`
   to mine the decisions for kit-worthy patterns (exits 0 if no
   candidates, 1 if there are).
8. Asks the LLM to run `node .kit-shell/scripts/kit-staging-export.mjs`
   to produce a tarball of the consumer's kit-worthy artefacts.
9. The user copies the tarball back to the kit machine and extracts it
   into `kit-staging/inbox/<project-name>/`.

### When you want to triage the inbox (at the kit root)

Paste `prompts/KIT-GROWTH-SESSION.md` into a fresh LLM session at the
kit root (`./tins-kit/`). The prompt:

1. Asks the LLM to run `node scripts/kit-ingest.mjs` to scan the inbox
   and produce a merged triage report.
2. Asks the LLM to triage each candidate via `KITTING-REVIEW.md`'s
   3-question rubric (generalises? worked example? duplicates existing?).
3. Asks the LLM to run the KITTING workflow (`prompts/KITTING.md` +
   `scripts/kit-new-pattern.mjs`) for each accepted candidate.
4. Asks the LLM to run the gate (validator + selftest).
5. Asks the LLM to push the new kit to every project via
   `node scripts/kit-sync.mjs --to=../<project>`.
6. Asks the LLM to archive the inbox via `node scripts/kit-ingest.mjs --archive`
   (so the next session starts with an empty inbox).
7. Asks the LLM to update HANDOVER.md and BUILDER-DECISIONS-REVIEW.md.

### Why a staging area, not direct sync

The current `kit-sync.mjs` + `kit-extract.mjs` loop assumes the
consumer's repo is **adjacent** to the kit. That's the case for the 5
reference projects + any future project scaffolded via
`scripts/new-project.mjs`. But it doesn't work for a project on a
**different machine** — you can't `kit-sync.mjs --to=../my-remote-project`
because the remote project's `../` isn't the kit machine's `../`. The
staging area is the solution: the remote project ships a tarball, the
kit machine ingests the tarball into `kit-staging/inbox/`, and the
kit-growth session triages the artefacts.

### The 2-consumer rule still holds (D17)

A pattern is a pattern only if it recurs. `kit-extract.mjs` sees one
consumer; the triage prompt (`KITTING-REVIEW.md`) enforces the rule.
A remote project that ships a tarball with 1 candidate is still 1
consumer. The kit-growth session may **defer** the candidate (if the
2nd observation hasn't happened yet) rather than accept it. When the
2nd remote project ships its tarball with the same candidate, both
observations land in the same triage report and the kit-growth session
can accept it. This is the discipline that prevents the kit from
ballooning with project-specific patterns.

### Read these for the staging area

- `kit-staging/README.md` — the inbox workflow, the 4-thing-can-be-dropped
  table, the flow diagram
- `prompts/NEW-PROJECT.md` — the 7-step generic copy-paste prompt for
  starting a new project from the kit shell
- `prompts/KIT-GROWTH-SESSION.md` — the 8-step generic copy-paste prompt
  for triaging the inbox
- `VERSIONING.md §7` — the transport layer (why a staging area, not
  direct sync)
- `scripts/kit-ingest.mjs` — the inbox scanner
- `scripts/kit-new-project-shell.mjs` — the portable kit shell scaffolder
- `scripts/kit-staging-export.mjs` — the consumer-side dump helper

---

*— End of `PIPELINE.md`. See also: `AGENTS.md` (the kit's standing rules),
`HANDOVER.md` (state + W-queue), `docs/WORKFLOW.md` (the full consumer
flow), `VERSIONING.md` (the version control + sync strategy),
`kit-staging/README.md` (the transport layer).*
