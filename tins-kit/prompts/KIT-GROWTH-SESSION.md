# Prompt: KIT-GROWTH-SESSION (the generic copy-paste prompt for triaging the inbox)

> **The prompt you paste into a fresh LLM session at the kit root when
> you want to triage the `kit-staging/inbox/` and decide which candidates
> become new kit patterns, modules, scripts, or prompts.** This is the
> periodic session that runs after one or more consumer projects have
> shipped their `kit-staging-export-<...>.{zip,tar.gz}` into the inbox.
>
> **Source:** the kit's `kit-staging/` architecture. Companion to
> `prompts/NEW-PROJECT.md` (the prompt for starting a new project from
> the kit shell). The ingest script that this prompt runs first is
> `scripts/kit-ingest.mjs`.

---

## The prompt

```
You are running a kit-growth session at the kit root ($PWD). Your job
is to triage the kit-staging/inbox/ and decide which candidates become
new kit assets.

The kit is at the top level of the workspace. The inbox is at
./kit-staging/inbox/. Each subdirectory of the inbox is a project
that has shipped its kit-staging-export-<...> bundle to the kit
machine.

---

## Step 0 — Confirm your location

```bash
pwd

# Confirm you're at the kit root (you should see lib/, prompts/, scripts/, etc.)
ls -la

# Check the inbox
ls -la kit-staging/inbox/
```

If the inbox is empty, there's nothing to do. Exit with "inbox empty."

---

## Step 1 — Read these files in this order

| # | File | Why |
|---|---|---|
| 1 | `./PIPELINE.md` | The 7-step methodology (universal) |
| 2 | `./AGENTS.md` | The kit's standing rules (D1–D24) |
| 3 | `./HANDOVER.md` | The kit's state + W-queue |
| 4 | `./kit-staging/README.md` | The inbox workflow |
| 5 | `./prompts/KITTING-REVIEW.md` | The triage rubric (per-candidate accept/reject/defer) |
| 6 | `./prompts/KITTING.md` | The per-pattern workflow (for accepted candidates) |

---

## Step 2 — Run the ingest script

```bash
node scripts/kit-ingest.mjs
# → scans ./kit-staging/inbox/*/ (each project subdir)
# → produces ./kit-staging/triage-<date>.md
# → exits 0 if no candidates, 1 if there are
# → with --archive, moves the inbox entries to ./kit-staging/archive/<date>/
```

If the script exits 0, there's nothing to ingest. Done.

If the script exits 1, open the triage report and proceed to Step 3.

---

## Step 3 — Triage each candidate

For each candidate in the triage report, apply the 3-question rubric
(see `prompts/KITTING-REVIEW.md`):

1. **Would a different TINS consumer benefit from this?** (Reject if
   project-specific.)
2. **Does it have a worked example from a real consumer?** (Defer if
   no example; the worked example is the load-bearing piece.)
3. **Does it duplicate an existing kit pattern?** (Reject if yes; the
   kit has the pattern under a different name.)

Fill in the triage template at the bottom of the report:

```md
C1 (project: title): [accept | reject | defer] — <reason>
C2 (project: title): [accept | reject | defer] — <reason>
...
```

Write the triage to `./kit-staging/triage-<date>-decided.md` (the
session's output).

The 2-consumer rule is non-negotiable. A pattern is a pattern only if
it recurs. If only 1 consumer has the decision so far, defer (the
kit-extract heuristic may see only 1 consumer; the 2nd observation may
come later).

---

## Step 4 — For each accepted candidate, run the KITTING workflow

For each accepted candidate, the type determines the workflow:

**If the candidate is a pattern** (most common):

```bash
# 1. Scaffold the pattern file
node scripts/kit-new-pattern.mjs <kebab-case-name>

# 2. Fill in the §0 / §1 / §2 / §3 sections based on the candidate's body
#    (open the file in the editor)

# 3. Add a validator check to scripts/validate.mjs (if a new
#    §8.X acceptance criterion is needed)

# 4. Add a self-test case to scripts/selftest.mjs (if needed)

# 5. Update SPEC.md (add D<N+1> in §0.2, add a row in §0.4, add a mention in
#    §2 / §4.1, add §8.X if new)

# 6. Update HANDOVER.md (mark the W done, add a state-snapshot row)

# 7. Update BUILDER-DECISIONS-REVIEW.md (add a D<N> entry documenting
#    "kit now ships <name> pattern")
```

**If the candidate is a code module** (lib/<name>/):

```bash
# 1. cp -r <inbox>/<project>/lib/<name>/ lib/<name>/
# 2. Add a mention in SPEC.md §2.3 + §4.1
# 3. Add §8.14 acceptance criterion
# 4. Add a self-test case
# 5. Update HANDOVER.md + BUILDER-DECISIONS-REVIEW.md
```

**If the candidate is a prompt** (prompts/<name>.md):

```bash
# 1. cp <inbox>/<project>/prompts/<name>.md prompts/<name>.md
# 2. Add a mention in SPEC.md §2.1
# 3. Update HANDOVER.md + BUILDER-DECISIONS-REVIEW.md
```

---

## Step 5 — Run the gate

```bash
node scripts/validate.mjs --all
node --test scripts/selftest.mjs
```

Both must exit 0. If either fails, fix it before continuing (most
often: a missing section header, a missing cross-reference, a typo in
the file name).

---

## Step 6 — Push the new kit to all projects

```bash
# For each known project (the 5 in the workspace + any new ones)
for project in Jayshankar incubos Data-cleaning-script package5 exam-forge vikas-FDP-AI-for-educators; do
  node scripts/kit-sync.mjs --to="../$project"
done
```

(Adjust the list as the workspace grows. The session also gets this
list from the workspace root: `ls -d ../*/` minus `../tins-kit` and
`../archive`.)

If the new pattern / module changes the kit's API, the consumer's
`AGENT-BRIEF.md` may need a small update (e.g. "the kit now ships the
FDP-handover pattern; see `tins-kit/lib/patterns/fdp-handover.md`").

---

## Step 7 — Archive the inbox (so it stays clean for the next session)

```bash
# Either re-run the ingest with --archive (if you didn't the first time)
node scripts/kit-ingest.mjs --archive
# OR move the entries manually
mkdir -p kit-staging/archive/$(date +%Y-%m-%d)/
mv kit-staging/inbox/*/ kit-staging/archive/$(date +%Y-%m-%d)/
```

The inbox is self-cleaning. The next kit-growth session starts with an
empty inbox.

---

## Step 8 — Update HANDOVER.md (record this session)

```bash
# Open HANDOVER.md
# - Update the "Last updated" line
# - Update the "Last worked on by" line
# - Update the "Queue position" line
# - Add a state-snapshot row
# - If a new W was created (e.g. "audit the new FDP-handover pattern in 30 days"),
#   add it to the W-queue
```

---

## The 5 commands (memorise)

```bash
# Step 0 + 2
node scripts/kit-ingest.mjs

# Step 4 (most common)
node scripts/kit-new-pattern.mjs <name>

# Step 5
node scripts/validate.mjs --all
node --test scripts/selftest.mjs

# Step 6
node scripts/kit-sync.mjs --to=../<project>

# Step 7
node scripts/kit-ingest.mjs --archive
```

---

## Constraints

- **The kit is itself versioned (D16).** A new pattern is a kit change;
  it goes through the kit's own HANDOVER + BUILDER-DECISIONS-REVIEW.
- **The kit is evergrowing (D17), not exhaustive.** Better to defer 3
  good candidates than to accept 1 mediocre one.
- **The bidirectional loop is now project-aware (D25).** The kit's
  growth is driven by real consumer learnings, not by the spec author's
  imagination. Every candidate came from a real project.
- **The staging area is self-cleaning.** The next session starts with
  an empty inbox.

---

## When the inbox is large (10+ projects)

If 10+ projects have shipped their candidates at once:

1. Run `node scripts/kit-ingest.mjs` to produce the merged triage report.
2. Triage the candidates in batches of 5-10 (don't try to triage 50 at
   once; triage the first 10, accept/reject/defer, run the gate, then
   triage the next 10).
3. The triage report is a single file; the KITTING workflow can be
   parallelised (3-5 sub-agents working on different patterns).

---

## What success looks like

1. You read 6 files (PIPELINE, AGENTS, HANDOVER, kit-staging/README, KITTING-REVIEW, KITTING).
2. You run `kit-ingest.mjs` and get a merged triage report.
3. You triage each candidate (accept/reject/defer).
4. For each accepted, you run the KITTING workflow.
5. You run the gate (must be green).
6. You push the new kit to all 6 projects (5 reference + vikas).
7. You archive the inbox.
8. You update HANDOVER.md.
9. The kit grew by N patterns / modules / scripts. The next consumer benefits.
10. You exit. The next session starts with an empty inbox.

Begin with Step 0.
```

---

*— End of `KIT-GROWTH-SESSION.md` prompt. See also: `prompts/NEW-PROJECT.md`
(the prompt for starting a new project from the kit shell),
`prompts/KITTING-REVIEW.md` (the per-candidate triage rubric), `prompts/KITTING.md`
(the per-pattern workflow), `scripts/kit-ingest.mjs` (the inbox scanner),
`scripts/kit-staging-export.mjs` (the consumer-side dump helper),
`kit-staging/README.md` (the inbox workflow).*
