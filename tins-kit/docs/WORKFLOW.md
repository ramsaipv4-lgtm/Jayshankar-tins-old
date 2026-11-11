# WORKFLOW.md — How a consumer uses the kit, end to end

> **The 5-step workflow from "I have an idea" to "I have a working TINS consumer."
> Read this once, then go to step 1.**

---

## Step 0 — Decide if you need the kit

The kit is for projects that:

- Have a non-trivial spec (more than a one-page app).
- Will outlive your first session (someone else — including future-you —
  will work on it).
- Need to be built correctly the first time (no "we'll fix it later" — the
  TINS spec is the contract).
- Use one of the kit's known stacks (Next.js, Vite, Supabase, Prisma, or
  similar). The kit is stack-flexible but the patterns assume a modern
  web app with a database.

If your project is a one-evening hackathon script, the kit is overkill.
If it's a multi-week build, the kit pays for itself in the first sprint.

---

## Step 1 — Run the SPEC-AUTHOR prompt

In a fresh LLM session, paste `prompts/SPEC-AUTHOR.md`. Answer the 7
interview questions. Let the LLM run the A/B/C pass (measure, check rot,
propose data format first). Receive a `SPEC.md` draft.

**The interview is the highest-leverage 10 minutes of the project.** Don't
skip questions. Don't accept "I'll fill in the gaps later."

**The "what I guessed" appendix (§0.3) is the most important part of the
draft.** Read it. Push back on any guess that feels wrong. The LLM is
extrapolating from your answers; some extrapolations will be wrong.

**Deliverable:** `SPEC.md` (draft, 200–1500 lines, with the §0.3 appendix).

---

## Step 2 — Run the SPEC-REVIEWER prompt

In a *separate* LLM session, paste `prompts/SPEC-REVIEWER.md`. The reviewer
runs the 6 review passes (what-would-break-this, rot, I-guessed,
acceptance-criteria, predecessor, I-would-build-it-differently). You
receive a `REVIEWER-DECISIONS-REVIEW.md` entry that says "approved" /
"approved with conditions" / "rejected."

**The review session must be separate from the writing session.** The
writer is biased toward "this is a good spec." The reviewer is biased
toward "find what's wrong."

**If the review is "approved with conditions":** fix the conditions
yourself or with the writer session, then re-review. Repeat until
"approved."

**Deliverable:** `SPEC.md` (frozen for v1) + `REVIEWER-DECISIONS-REVIEW.md`
R1 entry.

---

## Step 3 — Run the kit-coverage script

```bash
node tins-kit/scripts/kit-coverage.mjs --spec=./SPEC.md
```

The script prints which `lib/patterns/` entries are likely to apply to
your spec. Read each recommended pattern. Decide which ones to copy into
your consumer.

**Not every pattern applies.** Some are stack-specific (Prisma only),
some are domain-specific (multi-tenant only). The script is a
*recommendation*, not a mandate.

**For each pattern you copy:** add a row to your `BUILDER-DECISIONS-REVIEW.md`
("we adopted `<pattern>` from the kit, see `tins-kit/lib/patterns/<name>.md`").

**Deliverable:** a list of patterns you'll use, recorded in
`BUILDER-DECISIONS-REVIEW.md`.

---

## Step 4 — Copy the templates and code modules

For each pattern / module you adopted in step 3, copy the relevant
template or module into your consumer:

```bash
# Templates (drop into your consumer's root)
cp tins-kit/templates/HANDOVER.md ./HANDOVER.md
cp tins-kit/templates/AGENTS.md ./AGENTS.md
cp tins-kit/templates/.gitignore ./.gitignore
cp tins-kit/templates/zod-schemas/money.zod.ts ./src/lib/validations/money.zod.ts
cp tins-kit/templates/sql/rls-policies.sql ./prisma/migrations/<n>_enable_rls/migration.sql
cp tins-kit/templates/sql/audit-trigger.sql ./prisma/migrations/<n+1>_audit/migration.sql
cp tins-kit/templates/eslint/no-float-money.js ./.eslint-rules/no-float-money.js
cp tins-kit/templates/sql/idempotent-migration-pattern.sql ./prisma/migrations/<n+2>_example/migration.sql

# Code modules
cp -r tins-kit/lib/no-backend/ ./src/lib/no-backend/
cp -r tins-kit/lib/money-as-decimal/ ./src/lib/money-as-decimal/
cp -r tins-kit/lib/tenant-rls/ ./src/lib/tenant-rls/
```

For each copy: read the `README.md`, run the test suite
(`pnpm test lib/<module>/`), and adapt the API to your project's
conventions (function names, import paths, etc.).

**For the migration templates:** review the SQL carefully. The placeholder
table names must be replaced with your actual tables. The
`rls-policies.sql` is the most error-prone — read the comments.

**For the code modules:** the public API is `import x from '<module>'`. If
your project uses a different style, document the deviation in
`BUILDER-DECISIONS-REVIEW.md`.

**Deliverable:** your consumer now has the kit's templates + code
modules, adapted to your project.

---

## Step 5 — Build Mode A, ship Mode C, run the release checklist

The TINS milestones are:

- **Mode A** — Auth + protected route end-to-end (the kit's `AGENTS.md` §2
  5-command smoke test is the contract).
- **Mode B** — The core feature (whatever the user actually wants; the
  spec's §1 one-liner).
- **Mode C** — The secondary features + polish (the spec's §1 follow-ups).

At the end of Mode A, run `prompts/RELEASE-CHECKLIST.md` in a fresh
session. The checklist is the gate. If any section is red, don't ship.
If any is amber, fix it before shipping.

**At every step:** update `HANDOVER.md` (mark W done, add new W, update
state snapshot, add gotchas). The handover file is the only thing that
carries state across LLM sessions.

**Deliverable:** a working TINS consumer, shipped, with a `HANDOVER.md`
that the next LLM session can pick up in 5 minutes.

---

## The evergrowing loop (Kit → Consumer → Kit)

The kit is bidirectional. The first half (Kit → Consumer) is the
distribution side. The second half (Consumer → Kit) is the extraction
side. Both halves are now automated.

### The Kit → Consumer half (steps 1–5 above)

You've seen this — the consumer scaffolds from the kit, adopts the
patterns and modules, and the LLM uses them as recipes + drop-ins.

### The Consumer → Kit half (the new auto-extraction)

When a consumer finishes Mode A, it records its decisions in its own
`BUILDER-DECISIONS-REVIEW.md` (using `scripts/decision-log.mjs` to append
without manual editing). A *kit-growth* session then:

```bash
# 1. cd into the kit root
cd tins-kit

# 2. Run the auto-extractor against the consumer
node scripts/kit-extract.mjs --consumer=../my-saas
# → writes my-saas/kit-growth-candidates.md (heuristic-scored, 0-7 each)

# 3. Open a fresh LLM session, paste prompts/KITTING-REVIEW.md
#    The session reads the report, triages each candidate
#    (accept/reject/defer), and writes my-saas/kit-growth-triage.md

# 4. For each accepted candidate, the session runs prompts/KITTING.md
#    + scripts/kit-new-pattern.mjs to land the new pattern in the kit

# 5. Re-run the gate
node scripts/validate.mjs --all
node --test scripts/selftest.mjs

# 6. Push. CI confirms green.
git push
```

The next consumer that adopts the kit will see the new patterns in
`node scripts/kit-coverage.mjs --spec=<their-spec>`. The kit grew by
the number of accepted candidates.

### The 3-question triage rubric (the gate that keeps the kit clean)

For each candidate, the triage session asks:

1. **Would a different TINS consumer benefit from this?** (Reject if
   project-specific.)
2. **Does it have a worked example from a real consumer?** (Defer if
   no example; the worked example is the load-bearing piece.)
3. **Does it duplicate an existing kit pattern?** (Reject if yes; the
   kit has the pattern under a different name.)

The 2-consumer rule is non-negotiable. A pattern is a pattern only if
it recurs. The `kit-extract.mjs` heuristic doesn't enforce this
(it sees one consumer at a time); the triage prompt does.

### The worked example: the kit's own growth

The kit itself is the worked example. Session 1 shipped 7 patterns
(D1–D16 + 7 lib/patterns files). Session 6 added 13 new patterns from
the gap analysis (D17–D24, the 5 reference projects). Session 7 added
the 4 previously-deferred lib modules + scaffolder + CI. Session 8
(this one) added the extraction half of the loop. Every session
followed this pattern: consumer records decisions → kit extracts →
triage → KITTING → CI green.

### Where the loop is documented

- **The architect's-eye view:** `lib/patterns/kit-self-application.md`
  (the canonical pattern).
- **The auto-miner:** `scripts/kit-extract.mjs` (the heuristic
  classifier that produces the candidates report).
- **The triage prompt:** `prompts/KITTING-REVIEW.md` (the
  accept/reject/defer workflow).
- **The per-pattern workflow:** `prompts/KITTING.md` (scaffold + fill
  + validate + commit).
- **The human-facing version:** `docs/KITTING.md` (the same workflow,
  prose).
- **The evergrowing decision (D17):** `SPEC.md` §0.2.

**The kit grows by gap analyses and auto-extraction, not by big-bang
refactors.** Every consumer that crystallises a new lesson is a chance
to make the kit better for the next consumer.

---

## Quick reference

| I want to... | Run this prompt / script |
|---|---|
| Start a new TINS project | `prompts/SPEC-AUTHOR.md` |
| Review a SPEC.md | `prompts/SPEC-REVIEWER.md` |
| See which patterns apply | `scripts/kit-coverage.mjs` |
| List everything in the kit | `scripts/kit-listing.mjs` |
| Add a new pattern to the kit | `prompts/KITTING.md` |
| Scaffold a new pattern file | `scripts/kit-new-pattern.mjs` |
| Record a builder / reviewer decision | `scripts/decision-log.mjs` |
| Run SQL migrations | `scripts/migration-runner.mjs` |
| Pre-deploy gate | `prompts/RELEASE-CHECKLIST.md` |

---

*— End of `WORKFLOW.md`.*
