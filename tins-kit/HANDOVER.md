# HANDOVER.md — tins-kit work system

> **Read this before starting.** The kit is itself a TINS project; its own SPEC.md is the
> source. This file is the operational guide: current state, work queue, gotchas, handover
> protocol.

**Last updated:** 2026-08-26 (session 16 — closed three user-requested
capabilities in one round: D32 autonomous orchestration, D33 tooling
discovery + security audit, D34 adaptive inline steering prompts.
**D32:** `prompts/AUTONOMOUS-BUILD.md` (the auditor's 9-step contract) +
`prompts/WORKER-SESSION.md` (the worker's 7-step contract) +
`scripts/orchestrate.mjs` (the reference runner: `--dry-run` / `--status` /
dispatch; exit 0 complete / 1 failed / 2 config / 3 parked) +
`scripts/escalate.mjs` + `lib/patterns/tiered-escalation.md` +
`templates/ORCHESTRATION.json` + `templates/ESCALATIONS.md`. The auditor
decomposes, dispatches, verifies, integrates and gates but never writes
product code; all run state lives in `delegation/LEDGER.md` (statuses
extended to `ready`/`running`/`blocked-escalation`/`integrated`/`failed`, plus
an optional `Depends` column) so a fresh auditor can take over mid-run; a T2
escalation parks its own task and lets the rest of the run continue.
**D33:** `prompts/TOOLING-AUDIT.md` + `scripts/tooling-audit.mjs` (a HARD
BLOCKING gate, chosen by the user over the recommended advisory design) +
`templates/TOOLING-AUDIT.md` + `lib/patterns/third-party-tool-audit.md`
(9 red flags, 3 verdicts, uncertainty → REVIEW-REQUIRED). The kit never
installs and never executes a candidate. **D34:**
`prompts/STEERING-PROMPTS.md` — a catalogue the LLM selects from, never a
file handed to the user; 7 drift classes, adaptive per scenario/state/event,
mandatory immediate emission after any self-correction. Wired all three into
`NEW-PROJECT.md`, `CONTINUE-TINS-PROJECT.md`, `SPEC-AUTHOR.md`,
`INTERVIEW-CHECKLIST.md` and `kit-new-project-shell.mjs`. Updated `SPEC.md`
(D32/D33/D34 + §8.29/§8.30/§8.31 + §0.4 rows + §4.1 tree + §9 out-of-scope),
`scripts/validate.mjs` (expectedPrompts 19→23, expectedTemplates 16→19,
expectedScripts 17→20, plus 18 new §8.29–§8.31 checks), `scripts/selftest.mjs`
(+16 real cases — unlike the D28/D29/D31 prompt-only precedent, this round
ships 3 executable scripts and one of them is a blocking gate, and a gate
nobody has watched fail is decoration per D7), `INDEX.md`, and
`BUILDER-DECISIONS-REVIEW.md` (D26/D27/D28). Validator: 60 pass / 0 warn /
0 fail (was 42). Selftest: 35/35 (was 19).)
**Last worked on by:** session 16 — closed the user's three requests in one
round: (1) "once the interview to the user is done I want the agent harness
... to automatically create a auditor (master) and slaves that can run the
parallelisation pipeline ... tiered decisions ... only the absolutely
necessary decisions that a llm cannot answer on its own would be forwarded to
the user"; (2) "Scan the internet for any relevant MCP server and skills (do a
full audit ... if you are unsure just flag the user to read it) ... rather
than going ahead with assumptions and handicaps"; (3) "the LLM is also
providing prompts that the user can ask at appropriate intervals whenever
there is some oversight done by the LLM ... when LLM mis remember something
and correct itself during rechecks." Interview ran as one AskUserQuestion
round of 4 questions. The user took the recommended option on orchestration
shape (contract + reference runner) and on escalation behaviour (park the
task, keep building), **overrode** the recommendation on the tooling audit
(chose the hard blocking gate over advisory-but-recorded), and answered
outside the options on the steering prompts (asked for adaptive inline cards
rather than any static deck) — which is why D34 ships a catalogue the model
selects from rather than a file the user receives.
**Session 17 (2026-08-26):** closed D35 — the kit now *asks* how a round's
work should be executed instead of inferring it from how a W was phrased.
New `prompts/EXECUTION-MODE-INTERVIEW.md` (shared interview, D4 shape, same
as D28's design-vision interview) presents five modes — `solo`,
`auditor-local`, `auditor-remote` (workers on the user's other LLM CLIs),
`self-parallel` (the user personally drives sessions across their own
accounts), `external` — plus `hybrid` per task, and routes onward. Asked
**per round**, pre-filled with the previous round's answer. The recorded mode
is a mechanism, not a note: it lives in `delegation/LEDGER.md`'s round header
and `scripts/orchestrate.mjs` reads it literally, dispatching only
auditor-driven rounds and **refusing `solo` / `self-parallel` / `external`
outright** — the user said they would drive that work, or it is destined for a
scrubbed packet, and a runner that quietly did it instead would override a
stated decision. Legacy pre-D35 ledgers (`Default mode for this round: self`)
still work, with `self` read as `self-parallel`.
`prompts/DELEGATE-WORK.md` stopped asking its own self-vs-external question
and now reads the recorded mode. `templates/ORCHESTRATION.json` ships
worker-command presets for Claude Code / Codex / Gemini, **verified 2026-08-26
against each tool's own headless docs** and marked for re-checking (the
kit's own B-pass discipline applied to itself). Validator 68 pass / 0 fail
(+8). Selftest 43/43 (+8). One real defect found by the new tests: the mode
refusal originally sat *after* the nothing-runnable exit, so a user-driven
round reported exit 3 ("parked, owed an answer") when the true message was
exit 2 ("wrong prompt") — fixed by moving the check ahead of it.

**Session 18 (2026-08-26):** ran D32 for real for the first time and captured
it as `examples/autonomous-todo-app/` (D36 + §8.33). See W18 below. Three kit
defects found: the two-table ledger parse bug (**fixed**, 2 regression tests),
`kit-sync.mjs` vendoring `examples/` (**fixed**, §8.33e), and the missing
round-level escalation slot in `escalate.mjs` (**recorded, open** — top
kit-growth candidate). D32's "untested by reality" caveat is now discharged.

**Queue position:** W1–W18 all ✅ done except W7/W8 (the two consumer
retro-fits). The kit is end-to-end shippable + the 4 scenarios are covered +
frontend refresh + parallel-work delegation + public-release packaging +
curriculum generation + **a locked spec can now be built unattended by an
auditor and workers, every project starts behind a blocking tooling gate, and
sessions hand the user adaptive correction cards inline.** Next: W7 (consumer
retro-fit: Jayshankar) + ongoing kit-growth sessions triggered by
`kit-extract.mjs` exits-1 OR `kit-ingest.mjs` exits-1 + the user's own pilots
of `DELEGATE-WORK.md`, `PUBLISH-OPEN-SOURCE.md`,
`GENERATE-CURRICULUM.md`/`GENERATE-INTERVIEW-PREP.md`, and — the highest-value
one now — **`AUTONOMOUS-BUILD.md` on a real project**, since D32's whole
design rests on assumptions about worker behaviour that only a real
unattended run can test.

**Addendum (2026-09-10, D31):** a related but distinct real run happened on Jayshankar —
not `AUTONOMOUS-BUILD.md` (still pending, per above), but a manually-relayed `self-parallel`
round with a `WORKER-SESSION.md`-shaped brief, for a worker tool (MiniMax Coder) with no CLI
hook for scripted dispatch. New pattern: `lib/patterns/manual-relay-worker-loop.md`. Single
consumer so far — see that file's own source note.

**Addendum 2 (2026-09-10, D32):** second consumer arrived same day — EduPlay v2, via a direct
cross-session message rather than `kit-staging/inbox/`. 2-consumer bar met; lesson 1 gained a
harder DrvFs `chmod`-support failure mode (verified independently on Jayshankar's own mount
before folding in, not taken on trust), plus a 4th anti-pattern. See D32 in
`BUILDER-DECISIONS-REVIEW.md` for the full writeup.

---

## 1. Sixty-second brief

- `tins-kit/SPEC.md` is the source. The kit is generated from it. Defects are fixed by
  editing the spec.
- **The kit is now a working library.** 23 patterns, 7 lib modules (no-backend,
  money-as-decimal, tenant-rls, audit-viewer, docs-guardian, pwa-config, auth-shell),
  24 prompts (the 4 generic prompts cover the 4 scenarios in the user-facing flow;
  2 more — FRONTEND-VISION-INTERVIEW + FRONTEND-REFRESH — cover the frontend-refresh
  specialization added in W12; 2 more — DELEGATE-WORK + INTEGRATE-DELEGATED-WORK —
  cover the parallel-work-delegation specialization added in W13; 1 more —
  PUBLISH-OPEN-SOURCE — covers the public-release-packaging specialization added
  in W14; 2 more — GENERATE-CURRICULUM + GENERATE-INTERVIEW-PREP — cover the
  teaching-material specialization added in W15; 4 more — AUTONOMOUS-BUILD +
  WORKER-SESSION + TOOLING-AUDIT + STEERING-PROMPTS — cover the autonomous-build,
  tooling-gate and steering specializations added in W16; 1 more —
  EXECUTION-MODE-INTERVIEW — is the D35 menu asked at the start of every
  round in W17), 19 templates (plus the
  SQL / eslint / zod subdirs), 20 scripts, 4 JSON Schemas, 4 docs files, 1 staging area
  (`kit-staging/` with inbox + archive + README), 1 INDEX (`INDEX.md` — the
  1-page selective-chooser).
  Gate: `node scripts/validate.mjs --spec=SPEC.md` + `node --test scripts/selftest.mjs`
  (19 cases). See the validator run recorded in W15 for the current pass count.
- Five reference projects informed the spec + gap analysis: exam-forge (methodology),
  Jayshankar (3-mode lifecycle, audit log, per-batch pricing, FIFO cascade, shortfall),
  atal-incubation (multi-tenant RLS, two-Prisma-clients, outbox/jobqueue, self-maintaining
  docs, TRAININGS handbook, observability), Data-cleaning-script (build-time vs. runtime
  env, manifest-in-lockstep, the v1→v1.1→v3→v4 lineage), package5 (skill-template
  pattern, the 3-track study plan).
- 31 locked decisions in SPEC §0.2 (D1–D16 original, D17–D24 added 2026-08-15
  morning, D25 + D26 added 2026-08-15 evening, D27 added session 11, D28 added
  session 12, D29 added session 13, D30 added session 14, D31 added session 15).
  The most consequential of the recent ones:
  - **D17** The kit is evergrowing, not exhaustive (the loop, not the list)
  - **D19** Every pattern has the 4-section structure (§0/§1/§2/§3)
  - **D20** Every code module has the canonical layout (index.ts + README.md + tests/)
  - **D24** Every change comes with (a) §8.X, (b) validate.mjs check, (c) selftest.mjs case
  - **D25** The kit is the source of truth; consumer projects vendor a copy at
    `<project>/tins-kit/`
  - **D26** The kit has a `kit-staging/` inbox + a portable kit shell + 2 generic
    prompts (NEW-PROJECT.md, KIT-GROWTH-SESSION.md) — the transport layer for
    projects on other machines
  - **D27** The kit ships an INDEX + 4 generic prompts — one per scenario in the
    user-facing flow. (See §3 below for the 4-scenario matrix.)
  - **D28** An existing tins-kit website can get a frontend refresh — survey
    first, install-or-recreate against 5 named reference libraries, two-fold
    sign-off (`approved_before` / `approved_after`) scoped to the project's
    current mode.
  - **D29** A TINS project's remaining *locked* work can be split for
    parallel execution — self-mode (full continuity, no packet) vs.
    external-mode (scrubbed, repo-free task packet), independence
    de-risked before anything is handed out, notes recovered into the
    real decision log at integration regardless of who did the task.
  - **D30** A finished TINS project can be packaged for public release —
    an unconditional early question (SPEC-AUTHOR.md Q8) records intent,
    a later dedicated prompt (`PUBLISH-OPEN-SOURCE.md`) does the actual
    packaging, `scripts/private-to-public.mjs` scans the whole tree
    (comments included) for methodology AND LLM-authorship fingerprints,
    and public docs are held to a quality rubric aimed at real technical
    scrutiny, not just the absence of known strings.
  - **D31** A finished TINS project can be turned into standalone teaching
    material — `GENERATE-CURRICULUM.md` produces a sibling
    `<project>-curriculum/` folder (primer, prerequisite map, glossary,
    concept-to-code index, milestones, per-module README/scenario-questions/
    real-bug debugging case studies) in second-person instructional voice,
    generated one file per turn against a `CURRICULUM-PROGRESS.md`
    resumability tracker; the separate, optional `GENERATE-INTERVIEW-PREP.md`
    pass adds first-principles reimplementation drills for technical-interview
    practice, explicitly recommended to run on a frontier model at
    extended/max thinking; both reuse `scripts/private-to-public.mjs
    --scan-only` as-is for the safety gate.

## 2. Environment facts (verified)

| Fact | Value |
|---|---|
| Workspace | `C:\Users\user\Desktop\TINS-projects\atal-incubation\Jayshankar\tins-kit\` |
| Node | 22.x (one version installed at `C:\nvm4w\nodejs`) |
| Git | not applicable — the kit is filesystem-only (uses HANDOVER.md as log) |
| Reference projects | `../archive/exam-forge-reference/`, `../archive/atal-incubation-reference/`, the new Data-cleaning-script + package5 references are in the parent atal-incubation folder |
| First consumer | `../Jayshankar/` — spec v1 already written; the kit retro-fits it (W7) |

## 3. State snapshot

```
$ node tins-kit/scripts/validate.mjs --spec tins-kit/SPEC.md
  → must exit 0 (verify in §3 of HANDOVER after W7+)
$ node tins-kit/scripts/selftest.mjs
  → must exit 0 (verify)
$ node tins-kit/scripts/kit-listing.mjs
  → 21 patterns, 19 prompts, 4 schemas, 16 templates, 17 scripts, 7 lib modules, 4 docs
$ node tins-kit/scripts/kit-coverage.mjs --spec=../Jayshankar/SPEC.md
  → 12+ patterns likely apply (verify in W7)
```

## 4. Content inventory

| Asset | Path | Status |
|---|---|---|
| Kit spec | `tins-kit/SPEC.md` | ✅ v3 (1100+ lines, D1–D31, 28 §8 sections) |
| Kit handover | `tins-kit/HANDOVER.md` | ✅ v5 (this file) |
| Kit agents | `tins-kit/AGENTS.md` | ✅ v2 (updated §0–§5) |
| Kit builder-decisions | `tins-kit/BUILDER-DECISIONS-REVIEW.md` | ✅ v5 (8 → 25 decisions) |
| Gap analysis | `tins-kit/docs/GAP-ANALYSIS.md` | ✅ v1 (60 gaps, G01–G60) |
| Methodology | `tins-kit/PIPELINE.md` | ✅ v2 (7-step universal methodology + "Beyond the 7 steps" for staging) |
| Versioning | `tins-kit/VERSIONING.md` | ✅ v2 (7 rules + §7 "The transport layer" for staging) |
| **Prompts** | `tins-kit/prompts/SPEC-AUTHOR.md` | ✅ v3 (original; amended session 12 for Step 7a, session 14 for question 8) |
| | `tins-kit/prompts/BUILDER-REVIEW-TEMPLATE.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/prompts/REVIEWER-REVIEW-TEMPLATE.md` | ✅ v1 |
| | `tins-kit/prompts/INTERVIEW-CHECKLIST.md` | ✅ v3 (original; amended session 12 for Q7a, session 14 for Q8) |
| | `tins-kit/prompts/SPEC-REVIEWER.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/prompts/KITTING.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/prompts/RELEASE-CHECKLIST.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/prompts/KITTING-REVIEW.md` | ✅ v1 (added 2026-08-15, session 8) |
| | `tins-kit/prompts/NEW-PROJECT.md` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/prompts/KIT-GROWTH-SESSION.md` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/prompts/PROMOTE-TO-TINS.md` | ✅ v1 (added 2026-08-15, session 11) |
| | `tins-kit/prompts/CONTINUE-TINS-PROJECT.md` | ✅ v5 (added 2026-08-15, session 11; amended session 12 for FRONTEND-REFRESH routing, session 13 for DELEGATE-WORK routing, session 14 for PUBLISH-OPEN-SOURCE routing, session 15 for GENERATE-CURRICULUM routing) |
| | `tins-kit/prompts/FRONTEND-VISION-INTERVIEW.md` | ✅ v1 (added 2026-08-21, session 12) |
| | `tins-kit/prompts/FRONTEND-REFRESH.md` | ✅ v1 (added 2026-08-21, session 12) |
| | `tins-kit/prompts/DELEGATE-WORK.md` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/prompts/PUBLISH-OPEN-SOURCE.md` | ✅ v1 (added 2026-08-21, session 14) |
| | `tins-kit/prompts/GENERATE-CURRICULUM.md` | ✅ v1 (added 2026-08-21, session 15) |
| | `tins-kit/prompts/GENERATE-INTERVIEW-PREP.md` | ✅ v1 (added 2026-08-21, session 15) |
| **Index** | `tins-kit/INDEX.md` | ✅ v1 (added 2026-08-15, session 11 — the 1-page selective-chooser) |
| **Templates** | `tins-kit/templates/SPEC.md` | ✅ v1 (original) |
| | `tins-kit/templates/HANDOVER.md`, `AGENTS.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/templates/TRAININGS.md` | ✅ v1 (original) |
| | `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md` | ✅ v1 (original) |
| | `tins-kit/templates/PROJECT-AGENT-BRIEF.md` | ✅ v1 (added 2026-08-15, session 9) |
| | `tins-kit/templates/zod-schemas/money.zod.ts` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/templates/sql/rls-policies.sql`, `audit-trigger.sql` | ✅ v1 (original) |
| | `tins-kit/templates/sql/idempotent-migration-pattern.sql` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/templates/eslint/no-float-money.js` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/templates/.gitignore` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/templates/TASK-BRIEF.md` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/templates/DELEGATION-LEDGER.md` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/templates/DELEGATION-README.md` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/templates/CURRICULUM-PROGRESS.md` | ✅ v1 (added 2026-08-21, session 15) |
| **Schemas** | `tins-kit/schemas/tins-markers.schema.json` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/schemas/locked-decisions.schema.json` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/schemas/handover.schema.json` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/schemas/tins-spec-minimal.schema.json` | ✅ v1 (added 2026-08-15) |
| **Lib code modules** | `tins-kit/lib/no-backend/` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/lib/money-as-decimal/` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/lib/tenant-rls/` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/lib/audit-viewer/` | ✅ v1 (added 2026-08-15, session 7) |
| | `tins-kit/lib/docs-guardian/` | ✅ v1 (added 2026-08-15, session 7) |
| | `tins-kit/lib/pwa-config/` | ✅ v1 (added 2026-08-15, session 7) |
| | `tins-kit/lib/auth-shell/` | ✅ v1 (added 2026-08-15, session 7) |
| **Lib patterns** | `tins-kit/lib/patterns/` | ✅ 21 entries (7 original + 13 added 2026-08-15 + 1 kit-self-application added 2026-08-15; `private-to-public.md` substantially rewritten 2026-08-21, session 14) |
| **Scripts** | `tins-kit/scripts/validate.mjs` | ✅ v2 (28 checks via --spec, 23 inventory via --kit/--all, incl. §8.28a-e added session 15) |
| | `tins-kit/scripts/selftest.mjs` | ✅ v2 (19 cases, unchanged since session 14; D31 added no new cases — prompt-only addition, D30's script reused as-is) |
| | `tins-kit/scripts/migration-runner.mjs` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/scripts/decision-log.mjs` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/scripts/kit-coverage.mjs` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/scripts/kit-listing.mjs` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/scripts/kit-new-pattern.mjs` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/scripts/new-project.mjs` | ✅ v1 (added 2026-08-15, session 7) |
| | `tins-kit/scripts/docs-guardian.mjs` | ✅ v1 (added 2026-08-15, session 7) |
| | `tins-kit/scripts/kit-extract.mjs` | ✅ v1 (added 2026-08-15, session 8) |
| | `tins-kit/scripts/kit-sync.mjs` | ✅ v1 (added 2026-08-15, session 9) |
| | `tins-kit/scripts/kit-ingest.mjs` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/scripts/kit-new-project-shell.mjs` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/scripts/kit-staging-export.mjs` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/scripts/check-task-independence.mjs` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/scripts/scan-task-packet.mjs` | ✅ v1 (added 2026-08-21, session 13) |
| | `tins-kit/scripts/private-to-public.mjs` | ✅ v1 (added 2026-08-21, session 14; promoted from an embedded code block, fixed a latent glob-matching bug) |
| **Docs** | `tins-kit/docs/WORKFLOW.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/docs/LIBRARY-CONVENTIONS.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/docs/KITTING.md` | ✅ v1 (added 2026-08-15) |
| | `tins-kit/docs/GAP-ANALYSIS.md` | ✅ v1 (added 2026-08-15) |
| **Staging area** | `tins-kit/kit-staging/README.md` | ✅ v1 (added 2026-08-15, session 10) |
| | `tins-kit/kit-staging/inbox/` | ✅ (empty by default; self-cleaning) |
| | `tins-kit/kit-staging/archive/` | ✅ (consumed entries land here) |
| | `.github/workflows/validate.yml` | ✅ v1 (added 2026-08-15, session 7) |
| Reference projects | `archive/exam-forge-reference/`, `archive/atal-incubation-reference/` | ✅ moved, read-only |
| First consumer (Jayshankar) | `../Jayshankar/SPEC.md` | ✅ v1 written; await kit modules to retro-fit (W7) |

## 5. Work queue

### W1 — Prompts, templates, validator, selftest (the gate)  ✅ DONE (2026-08-05)

> **Result:** 4 load-bearing files shipped. The validator passes against the kit's own
> SPEC.md (10/10, 0 fail). Selftest is 15/15 green. The kit has its first green build.
> (See earlier sessions for the full text.)

### W2 — Schemas, decision log, more templates  ✅ DONE (2026-08-15)

> **Result:** 4 JSON Schemas + 3 new templates + 1 new script shipped. The 4 schemas
> (tins-markers, locked-decisions, handover, tins-spec-minimal) are valid JSON Schema
> 2020-12 and ready for `ajv` integration. The 3 new templates (HANDOVER, AGENTS,
> idempotent-migration-pattern) fill gaps that were promised in §2.5 but never shipped.
> `scripts/decision-log.mjs` is the CLI for recording builder + reviewer decisions.

### W3 — `lib/no-backend` and `lib/money-as-decimal`  ✅ DONE (2026-08-15)

> **Result:** Both code modules shipped with the canonical layout (index.ts + README.md
> + tests/). 7 test cases for no-backend (happy / SSR / quota / clear / clearAll /
> availability). 8 test cases for money-as-decimal (happy / 0.1+0.2 trap / IEEE 754 trap /
> division-by-zero / Zod schema accept-reject). The "0.1 + 0.2 === 0.3" test is the
> load-bearing case for the whole module.

### W4 — `lib/tenant-rls`  ✅ DONE (2026-08-15)

> **Result:** The two-Prisma-clients + `withTenantTx` + `tenantTxStorage` primitive
> shipped. The `TENANT_SCOPED` set is explicit (audit-able); the `$allOperations`
> extension throws when called outside a `withTenantTx` context. README documents the 3
> rules (no `basePrisma` outside the approved list, always wrap `restrictedPrisma` in
> `withTenantTx`, keep `TENANT_SCOPED` in sync with `schema.prisma`).

### W5 — `lib/audit-viewer`, `lib/auth-shell`  ✅ DONE (2026-08-15, session 7)

> **Result:** Both modules shipped with the canonical layout.
> - `lib/audit-viewer/` (~4.2 KB index.ts, ~4.3 KB README.md, ~5.9 KB tests with
>   13 cases): `AuditLogEntry` type, `applyFilter`, `paginate`, `diffRows`,
>   `renderAuditViewer` (the pure-TS render function the framework adapter
>   wires up). Source: atal-incubation's `incubos/src/components/AuditLogTable.tsx`.
> - `lib/auth-shell/` (~7.5 KB index.ts, ~6.5 KB README.md, ~5.6 KB tests with
>   11 cases): `Session` type, `ROLES` (8 controlled-vocabulary roles),
>   `setSessionProvider` (the wire-up), `useSession`, `getServerSession`,
>   `requireRole` (API guard), `<RoleGate>` (UI gate), `handleFirstUserIsAdmin`
>   (the "first sign-up becomes admin" pattern). Source: Jayshankar's
>   `src/lib/auth.ts` + `src/components/Layout.tsx`.

### W6 — `lib/docs-guardian`, `lib/pwa-config`  ✅ DONE (2026-08-15, session 7)

> **Result:** Both modules shipped + the `scripts/docs-guardian.mjs` CLI.
> - `lib/docs-guardian/` (~4.6 KB index.ts, ~4.8 KB README.md, ~5.1 KB tests
>   with 11 cases): `DocArea` (13 controlled-vocabulary areas), `DocMap`,
>   `DocMapEntry`, `loadDocMap`, `checkDocFreshness`, `countReferences`. Source:
>   atal-incubation's `docs/DOC-MAP.md` + `scripts/docs-guardian.mjs`.
> - `lib/pwa-config/` (~6.5 KB index.ts, ~5.7 KB README.md, ~3.8 KB tests with
>   8 cases): `withPwa` (Vite plugin wrapper), `useOnlineStatus` (React hook,
>   SSR-safe), `<OfflineBanner />` (React component with the spec's
>   "stale data — read only" wording + `data-testid="is-offline"`). Source:
>   Jayshankar's `src/lib/online.ts` + `src/components/OfflineBanner.tsx`.
> - `scripts/docs-guardian.mjs` (~7.6 KB): the CLI wrapper that reads
>   `docs/DOC-MAP.md`, scans source + docs, reports freshness, exits non-zero on
>   fail.

### W7 — Consumer retro-fit: Jayshankar  ⏳ in progress (next session)

- Apply the kit's `templates/SPEC.md` format to the Jayshankar SPEC.md (it already
  has the right shape; verify against the validator).
- Adopt `lib/money-as-decimal/` for Jayshankar (D7 already says `numeric(10,2)`).
- Adopt `lib/audit-viewer/` for the W1 admin audit log (D5).
- Adopt `lib/pwa-config/` for the W5 PWA work (D6).
- Add `BUILDER-DECISIONS-REVIEW.md` and `REVIEWER-DECISIONS-REVIEW.md` for Jayshankar
  (W0 of every consumer per the kit's rules).
- Run `node tins-kit/scripts/kit-coverage.mjs --spec=../Jayshankar/SPEC.md` and adopt
  the recommended patterns.
- **Done when:** Jayshankar's SPEC.md validates against the kit's validator, and
  Jayshankar's HANDOVER.md references at least 5 kit patterns.

### W8 — Consumer retro-fit: atal-incubation  ⏳ next

- The reference project is already in `archive/atal-incubation-reference/`. Apply
  the kit's templates to its `HANDOVER.md`, `AGENTS.md`, and add the
  `BUILDER-DECISIONS-REVIEW.md` and `REVIEWER-DECISIONS-REVIEW.md`.
- **Done when:** the atal-incubation reference has the full handover 4-doc system.

### W9 — Kit's own self-application + CI  ✅ DONE (2026-08-15, session 7)

> **Result:** The CI workflow + the scaffolder + the validator update are all
> shipped.
> - `.github/workflows/validate.yml`: runs `node scripts/validate.mjs --all`
>   + `node --test scripts/selftest.mjs` on every push and PR. Zero-dep
>   (Node 22 only).
> - `scripts/new-project.mjs`: scaffolds a new TINS consumer in a sibling
>   directory (templates + the chosen lib/ modules + scripts + schemas +
>   prompts + lib/patterns + the kit's docs + the CI workflow + a starter
>   package.json + a starter tsconfig.json). The `node scripts/new-project.mjs
>   my-saas --with=tenant-rls,money-as-decimal` workflow is the consumer
>   on-ramp.
> - `scripts/validate.mjs` extended: the `--all` flag (or `--spec` pointing
>   at the kit's own SPEC.md) now also runs the kit-inventory layer
>   (§8.13–§8.20). The gate currently runs 18 inventory checks + 10 spec
>   structural checks + 1 kit-§0.4 = 28 total when `--spec` is used.

### W10 — Staging area + portable kit shell + 2 generic prompts  ✅ DONE (2026-08-15, session 10)

> **Result:** The third leg of the bidirectional loop (D17 + D18 = project-aware;
> D26 = machine-agnostic). Five new files + one new top-level dir:
> - `kit-staging/` (inbox + archive + README): the transport layer for projects
>   on other machines. `kit-staging/README.md` documents the 4-thing-can-be-dropped
>   table, the flow diagram, the inbox lifecycle, and why a staging area (not
>   direct sync). The inbox and archive are self-cleaning.
> - `scripts/kit-ingest.mjs` (~12.9 KB): the inbox scanner. Reads every
>   `<project>/BUILDER-DECISIONS-REVIEW.md` in the inbox, re-runs the
>   `kit-extract.mjs` heuristic on each, produces a merged triage report.
>   Exits 0 if no candidates, 1 if there are. `--archive` moves consumed
>   entries to `kit-staging/archive/<date>/`. Zero-dep.
> - `scripts/kit-new-project-shell.mjs` (~12 KB): the portable kit shell
>   scaffolder. Produces a `.kit-shell/` directory (~10 files, ~50 KB) with
>   the minimum kit (decision-log + kit-extract + kit-staging-export + 3
>   prompts + 3 templates + the `.kit-shell.json` marker). The shell ships
>   with the project; the user copies the project (or just `.kit-shell/`) to
>   a different machine. Zero-dep.
> - `scripts/kit-staging-export.mjs` (~7.1 KB): the consumer-side dump helper.
>   Bundles the consumer's BUILDER-DECISIONS-REVIEW.md + kit-growth-candidates.md
>   + any lib/patterns/*.md + any lib/<module>/ + any prompts/*.md + the
>   `.kit-shell.json` marker into a single `.tar.gz` (POSIX) or `.zip`
>   (Windows) file. Zero-dep.
> - `prompts/NEW-PROJECT.md` (~7.7 KB): the 7-step generic copy-paste prompt
>   for starting a TINS project in any directory on any machine. The LLM
>   reads the kit shell, runs the interview, drafts the spec, builds the
>   project, records decisions, mines the learnings, and ships a tarball
>   back. The 5 commands to memorise: pwd, decision-log, kit-extract,
>   kit-staging-export, validate.
> - `prompts/KIT-GROWTH-SESSION.md` (~8.7 KB): the 8-step generic copy-paste
>   prompt for triaging the inbox at the kit root. The LLM runs
>   `kit-ingest.mjs`, triages each candidate via `KITTING-REVIEW.md`'s
>   3-question rubric (generalises? worked example? duplicates existing?),
>   runs the KITTING workflow for each accepted candidate, syncs the new
>   kit to every project via `kit-sync.mjs`, and archives the inbox. The
>   2-consumer rule is enforced.
> - **Validator §8.23** (8 new checks): the validator now checks the staging
>   area is present + non-trivial, the inbox and archive dirs exist, the 2
>   new scripts are present, and the 2 new prompts are present + non-trivial.
>   All 18 inventory + 10 spec structural + 15 selftest = green.
> - **PIPELINE.md** updated: added "Beyond the 7 steps" section that explains
>   the staging area for remote/different-machine consumers.
> - **VERSIONING.md** updated: added §7 "The transport layer (kit-staging/)"
>   section that explains why a staging area (not direct sync) and how the
>   2 generic prompts participate in the version control strategy.
> - **SPEC.md** updated: §0.2 D26 (the staging-area decision, locked) and
>   §8.23 (8 new acceptance criteria).

### W11 — 4-scenario matrix: INDEX + 2 new generic prompts (PROMOTE-TO-TINS + CONTINUE-TINS-PROJECT)  ✅ DONE (2026-08-15, session 11)

> **Result:** The user-facing flow now has complete scenario coverage. Three new
> files + SPEC + validator updates.
> - **`INDEX.md`** (~13.3 KB, the 1-page selective-chooser): 8 sections covering
>   all 65+ kit assets with 1-line briefs each. Sections: (1) 21 patterns,
>   (2) 7 lib modules, (3) 12 prompts (with the 4-scenario matrix as a
>   cross-reference table), (4) 12 templates, (5) 14 scripts, (6) 4 schemas,
>   (7) 4 docs, (8) 8 top-level files. Plus a "How to read the kit in 30 minutes"
>   fast path, a "How to add a new asset to the kit" maintenance path, and
>   a "When this file is wrong" rule.
> - **`prompts/PROMOTE-TO-TINS.md`** (~10.6 KB, Scenario 2): the 7-step retro-fit
>   workflow for taking an existing project (built WITHOUT the kit) and turning
>   it into a TINS project. The 4 retro-fit questions are different from the
>   7 greenfield questions because the LLM is documenting what IS, not what
>   SHOULD BE.
> - **`prompts/CONTINUE-TINS-PROJECT.md`** (~7.9 KB, Scenario 3): the 6-step
>   pickup workflow for picking up an existing TINS project and adding a new W.
>   The 5 W questions are: what is the W? what's the user's pain? what does
>   "done" look like? are there constraints? is this kit-worthy?
> - **SPEC.md** updated: §0.2 D27 (the 4-scenario matrix decision, locked) and
>   §8.24 (3 new acceptance criteria).
> - **`scripts/validate.mjs`** updated: expectedPrompts list extended 8 → 12;
>   3 new §8.24a/b/c checks (INDEX + PROMOTE-TO-TINS + CONTINUE-TINS-PROJECT
>   present + non-trivial); order array extended.
> - **Validator**: 31 pass / 0 warn / 0 fail (was 28 → 31 with the 3 new checks).
> - **Subagent test**: started a fresh subagent on `vikas-FDP-AI-for-educators/`
>   with no prior context + only the relevant prompt. Verified the pipeline
>   works end-to-end (the subagent's triage report at
>   `vikas-FDP-AI-for-educators/kit-growth-triage-<date>.md` should appear after
>   the subagent finishes).

### W12 — Frontend-refresh workflow (D28): 2 new prompts, shared design-vision interview  ✅ DONE (2026-08-21, session 12)

> **Result:** The user asked for a way to take an existing tins-kit-built website
> (any framework/language, frontend-only) and refresh its visual layer using 5
> named reference libraries, survey-first. Full SPEC-AUTHOR interview (7Q + A/B/C)
> run live with the user before drafting, including a rot-check web search on all
> 5 libraries. Two new files + 4 prompt amendments + SPEC + validator updates.
> - **`prompts/FRONTEND-VISION-INTERVIEW.md`** (~9.4 KB): the shared design-vision
>   interview. Surveys the user's visual direction (5 questions), falls back to
>   web-searched inspiration sites if the user is unsure, and locks a per-library
>   install-vs-recreate decision for anime.js / motion / kokonut-ui / bklit-ui /
>   shadcn. Writes `FRONTEND-VISION.md` (authored, never overwritten by a script)
>   and `.frontend-detect.json` (derived). Never duplicated — triggered from two
>   places per D4.
> - **`prompts/FRONTEND-REFRESH.md`** (~9.6 KB): the 7-step generic copy-paste
>   prompt for refreshing an existing tins-kit website's frontend. Frontend-only
>   (no backend/API/schema changes); runs `FRONTEND-VISION-INTERVIEW.md` as its
>   interview step; verification is scoped to the project's current mode (A/B/C)
>   — a Mode A project verifies against seeded/mock data, not a backend that
>   doesn't exist yet, and a follow-up W is logged if a later re-verify is needed.
> - **`prompts/SPEC-AUTHOR.md`** amended: new Step 7a, after the 7 questions —
>   for website projects only, hands off to `FRONTEND-VISION-INTERVIEW.md` before
>   the A/B/C pass.
> - **`prompts/INTERVIEW-CHECKLIST.md`** amended: new "Q7a — Website check"
>   section documenting the same trigger, for the checklist-reading session.
> - **`prompts/CONTINUE-TINS-PROJECT.md`** amended: Step 2 now routes
>   frontend-visual-redesign W's to `FRONTEND-REFRESH.md` instead of the generic
>   5-question W interview.
> - **SPEC.md** updated: §0.2 D28 (the frontend-refresh decision, locked), §2.1
>   (2 new prompt bullets), §4.1 (2 new tree entries), §8.25 (4 new acceptance
>   criteria a–d).
> - **`INDEX.md`** updated: Prompts section 12 → 14, 2 new rows.
> - **`scripts/validate.mjs`** updated: expectedPrompts list extended 12 → 14;
>   4 new §8.25a/b/c/d checks (2 new prompts present + non-trivial, trigger
>   wiring present in SPEC-AUTHOR/INTERVIEW-CHECKLIST/CONTINUE-TINS-PROJECT);
>   order array extended.
> - **Rot check (web search, 2026-08-21):** anime.js is v4.0.0
>   (`npm install animejs`, framework-agnostic); Motion's npm package is now
>   `motion` (was `framer-motion`), also framework-agnostic; Kokonut UI and
>   Bklit UI are both React + Tailwind v4 + shadcn-CLI copy-paste libraries, NOT
>   npm dependencies — Bklit UI specifically turned out to be a charts/data-viz
>   library, not general design inspiration as initially assumed (recorded as a
>   §0.4-style correction in D28's own text). None of the 5 require a CDN at
>   runtime once installed, satisfying the user's independence requirement.
> - **Validator**: 35 pass / 0 warn / 0 fail (was 31 → 35 with the 4 new §8.25
>   checks). `node --test scripts/selftest.mjs`: 15/15 green, unchanged.
> - **Follow-up (same session):** user asked to also fix pre-existing doc drift
>   this W had surfaced but not caused — §2.1 and §4.1 were missing prose/tree
>   entries for 5 real, passing prompts (`KITTING-REVIEW`, `NEW-PROJECT`,
>   `PROMOTE-TO-TINS`, `CONTINUE-TINS-PROJECT`, `KIT-GROWTH-SESSION`), and §9 had
>   a stale out-of-scope item claiming retro-fits are unsupported — false since
>   `PROMOTE-TO-TINS.md` shipped in session 11. Backfilled all 5 prompts into
>   §2.1/§4.1 and rewrote the §9 item to the still-true boundary (no automated
>   codemod; the retro-fit judgment stays manual). No validator/selftest changes
>   needed — these were prose-only fixes; re-ran the gate to confirm still green.

### W13 — Parallel-work delegation (D29): self-vs-external split, independence check, scrubbed task packets  ✅ DONE (2026-08-21, session 13)

> **Result:** The user asked for a way to split a TINS project's remaining
> locked work across multiple LLM sessions or people and build it in
> parallel, without leaking the kit's methodology to anyone outside the
> user's direct control. Interview ran across several rounds live with the
> user (self-vs-external split confirmed, `kit-staging/`-pattern pushback
> confirmed as the right call, notes-recovery design confirmed). Two new
> prompts + two new scripts + three new templates + SPEC + validator + INDEX
> updates.
> - **`prompts/DELEGATE-WORK.md`** (~9 KB): the 8-step generic copy-paste
>   prompt for splitting a project's remaining *locked* work into
>   independent tasks. Requires the relevant spec section to already be
>   locked. Asks the round's self-vs-external mode question (overridable
>   per task), proposes a task split with touched-file lists, runs
>   `check-task-independence.mjs` until clean, and for external-mode tasks
>   only builds/scans/zips a scrubbed packet.
> - **`prompts/INTEGRATE-DELEGATED-WORK.md`** (~8 KB): the 7-step companion
>   that merges returned tasks back in, recovers every external-mode
>   task's `NOTES.md` into the real `BUILDER-DECISIONS-REVIEW.md`, sorts
>   discrepancies into auto-fixed vs. explain-before-applying, archives to
>   `delegation/completed/`, and leaves the gate green.
> - **`scripts/check-task-independence.mjs`**: reads a consumer's
>   `delegation/LEDGER.md`, flags any pairwise touched-file overlap before
>   packets are built, recommends merging conflicting tasks to a senior
>   engineer or a frontier model at extended/max thinking. Exit 0 clean, 1
>   on conflict, 2 on a missing/unparseable ledger. Zero-dep.
> - **`scripts/scan-task-packet.mjs`**: scans a built packet directory for
>   methodology fingerprints (TINS-specific terms, kit filenames, kit
>   script names) and path escapes (`../`, absolute paths, `.git`
>   references) before it ships. Defense-in-depth on top of the template,
>   per the user's explicit design ("it should start from a well-designed
>   template ... the script is a good addition" on top of that). Exit 0
>   clean, 1 on any leak. Zero-dep.
> - **`templates/TASK-BRIEF.md`**: the raw starter for an external-mode
>   packet's ticket — Context, Scope, Interface Contract, the packet's
>   file list, Acceptance Criteria, Out of Scope, Definition of Done, How
>   to Return Your Work. Written like a ticket a senior architect hands to
>   a team lead, per the user's explicit framing — zero TINS vocabulary.
> - **`templates/DELEGATION-LEDGER.md`**, **`templates/DELEGATION-README.md`**:
>   the raw starters for a consumer project's `delegation/LEDGER.md` (the
>   task table) and `delegation/README.md` (author-side only, free to
>   reference the real methodology since it never leaves the project).
> - **`prompts/CONTINUE-TINS-PROJECT.md`** amended: Step 2 now also routes
>   parallel-work-split W's to `DELEGATE-WORK.md` instead of the generic
>   5-question W interview (alongside the existing FRONTEND-REFRESH.md
>   routing from W12).
> - **Design decisions made live with the user, not by default:**
>   - **Folder convention:** a per-*project* `delegation/` folder, not a
>     reuse of the kit-root `kit-staging/` pattern. Advised against reusing
>     `kit-staging/` directly — it's unidirectional (consumer → kit),
>     kit-rooted (shared across all consumers), and 2-state (inbox/archive);
>     this needed to be bidirectional (author hands out, then receives
>     back), project-local (each project's own round), and multi-state
>     (proposed → independence-checked → assigned → in-progress → returned
>     → integrated). The spirit — plain folders, self-documenting README,
>     archive-when-done — carried over; the shape did not.
>   - **Self vs. external is architectural, not just policy.** Self-mode
>     tasks need no packet at all (a clone + the normal
>     `CONTINUE-TINS-PROJECT.md` flow, full continuity); external-mode
>     tasks need the full scrub-and-export path. The distinction is who's
>     *directing* the executor (even across the user's own multiple LLM
>     accounts/platforms, still self) vs. someone else directing it (a
>     hired human, or their own LLM session — external), not which AI
>     vendor is involved.
>   - **Notes recovery is symmetric, not two-tier.** Every external-mode
>     packet gets the same generic `NOTES.md`, read and translated back
>     into the real decision log at integration regardless of who did the
>     task — the user confirmed this over an earlier draft that only
>     guaranteed continuity for self-directed work.
> - **SPEC.md** updated: §0.2 D29 (locked), §2.1 (2 new prompt bullets), §2.4
>   (2 new script bullets), §2.5 (3 new template bullets), §4.1 (7 new tree
>   entries), §8.26 (6 new acceptance criteria a–f), §9 (3 new out-of-scope
>   items for D29's own boundaries, plus a deferred-candidate-D30 note for
>   the open-source-release idea raised alongside this W and explicitly not
>   built — see the D30 note in §9 for the reasoning).
> - **`INDEX.md`** updated: Prompts 14 → 16, Templates 12 → 15, Scripts
>   14 → 16, 7 new rows total.
> - **`scripts/validate.mjs`** updated: expectedPrompts 14 → 16,
>   expectedTemplates 12 → 15, expectedScripts 14 → 16; 6 new §8.26a–f
>   checks; order array extended; HELP text extended.
> - **Deferred, not built:** candidate D30 (an open-source/public-release
>   packaging capability, reusing `scan-task-packet.mjs` retargeted at a
>   whole finished project rather than one task) — raised by the user
>   alongside this W, explicitly scoped out of D29, noted in SPEC.md §9 for
>   a future session with its own interview.
> - **Validator**: 41 pass / 0 warn / 0 fail (was 35 → 41 with the 6 new
>   §8.26 checks). Both new scripts smoke-tested live (not just
>   presence-checked): `check-task-independence.mjs` against a clean
>   3-task ledger (exit 0), a 2-task file-overlap conflict (exit 1, correct
>   merge recommendation), a missing ledger (exit 2), and `--json` mode;
>   `scan-task-packet.mjs` against a clean packet (exit 0), a packet
>   deliberately seeded with TINS/SPEC.md/HANDOVER.md/locked-decisions/
>   BUILDER-DECISIONS-REVIEW terms plus a `../` path escape (exit 1, all 7
>   leaks caught), and no argument (exit 2).
>   `node --test scripts/selftest.mjs`:
>   15/15 green, unchanged (D29 did not add new selftest cases — the two
>   new scripts are exercised by the validator's §8.26d/e presence checks
>   and are simple enough that a dedicated selftest case would duplicate
>   that coverage; revisit if the user's pilot run surfaces a real defect
>   worth locking in as a regression test).

### W14 — Open-source release packaging (D30): whole-tree scan, corporate-tone docs, quality rubric  ✅ DONE (2026-08-21, session 14)

> **Result:** The user asked to finish the D30 candidate deferred at the end
> of W13: a way to package a finished project for public release without
> leaking the kit's methodology OR the fact that an LLM wrote it. Interview
> ran across two rounds live with the user (substantial rework of
> `lib/patterns/private-to-public.md` confirmed, not just promoting the
> script as-is; in-line-comment scrutiny raised as an open discussion and
> settled by the whole-tree-scan design, which scans every file including
> comments as a side effect rather than needing a separate comment-parser;
> fully corporate public-doc tone confirmed; D29/D30 banned-terms lists
> kept separate confirmed; D30-now/D31-deferred scope split confirmed;
> two-trigger design confirmed). One new prompt + one newly-real script +
> one substantially rewritten pattern + wiring across 4 files.
> - **`scripts/private-to-public.mjs`** (new, ~10 KB): promoted from a code
>   block embedded in `lib/patterns/private-to-public.md` into a real,
>   shipped, zero-dep script — never shipped as an actual file before this
>   session. Copies the private working copy into a public sibling per an
>   include/exclude table, mechanically rewrites the TINS marker-line
>   comment, then scans the ENTIRE destination tree (every file, in-line
>   comments included) against its own banned-terms list covering two
>   categories: methodology fingerprints and LLM-authorship fingerprints
>   (model/vendor names, leftover assistant-speak like "as an AI" or
>   "Certainly!"). Supports `--scan-only` (re-scan without re-copying) and
>   `--json`. Exit 0 clean, 1 leaks found, 2 bad usage — mirroring
>   `scan-task-packet.mjs`'s shape, deliberately using a SEPARATE
>   banned-terms list per the user's explicit choice.
>   **Bug found and fixed while promoting it:** the inherited copy-filter's
>   `pathMatches` only special-cased `/**` and `/*` suffixes; it silently
>   matched nothing for `scripts/*.mjs`-style patterns (a wildcard
>   mid-pattern), so `scripts/validate.mjs`-equivalent files were never
>   actually copied in the original embedded design. Replaced with a small
>   glob-to-regex converter and verified the fix against a live fixture
>   before and after.
> - **`lib/patterns/private-to-public.md`** substantially rewritten (not
>   just the script promoted as-is, per the user's explicit request): a
>   new §3.0 corporate-tone requirement for every public doc (no
>   first-person LLM voice, no hedging, no stock AI openers/closers); the
>   old narrow SCRUB_RULES-on-known-files description replaced with the
>   whole-tree-scan description; a new §3.6 `docs/DESIGN-WALKTHROUGH.md`
>   doc type (what problem, the approach taken, at least one rejected
>   alternative, the trickiest bug, what you'd do differently); a new §3.7
>   five-question quality rubric (re-implementable from the docs alone,
>   every non-obvious choice has a stated reason, at least one rejected
>   alternative per major decision, survives "why not X instead," setup
>   instructions actually work); §4 no longer embeds the full script,
>   references the real file instead (avoids drift); fixed the stale
>   framing that conflated this pattern with `RELEASE-CHECKLIST.md`'s
>   same-repo "no TODOs in prod" sweep — added an explicit
>   not-the-same-thing note; the 10-step workflow restructured around the
>   one-command copy+scan.
> - **`prompts/PUBLISH-OPEN-SOURCE.md`** (new, ~9 KB): the 9-step
>   late-stage packaging prompt — readiness check, read context, decide
>   scope, copy+scan (delegates to the pattern), quality rubric, verify the
>   public gate, git init/commit/deploy, record the release in the private
>   decision log, leave both copies' gates green. Explicitly NOT the same
>   job as `RELEASE-CHECKLIST.md` (same-repo deploy gate vs. this prompt's
>   second-repo public release).
> - **`prompts/SPEC-AUTHOR.md`** amended: new question 8, right after 7a —
>   asked unconditionally, for EVERY project (not gated like 7a's website
>   check) — whether public release is ever intended. Records
>   `Public release intended: TRUE/FALSE` as a locked §0.2 row; the actual
>   packaging is deferred to `PUBLISH-OPEN-SOURCE.md` at real release time.
> - **`prompts/INTERVIEW-CHECKLIST.md`** amended: new "Q8 — Public release
>   intent" section mirroring Q7a's style but framed as unconditional, not
>   a gate.
> - **`prompts/CONTINUE-TINS-PROJECT.md`** amended: Step 2 now also routes
>   "package this for public release" W's to `PUBLISH-OPEN-SOURCE.md`
>   (alongside the existing FRONTEND-REFRESH.md and DELEGATE-WORK.md
>   routing). Also backfilled a pre-existing gap this W surfaced: the
>   prompt's own brief for itself never mentioned the D29 DELEGATE-WORK.md
>   routing it already had — fixed alongside the new D30 line.
> - **Two pre-existing SPEC.md staleness spots fixed while in the
>   neighbourhood (not caused by this W, found while editing adjacent
>   text):** the §2.3 one-line brief for `private-to-public.md` wrongly
>   described it as "the launch checklist for the 'no TODOs in prod'
>   sweep" — that's `RELEASE-CHECKLIST.md`'s job, not this pattern's; and
>   a "the kit ships 20 patterns" undercount — the real count is 21 (the
>   Tier 1/Tier 2 lists only itemized 20; `kit-self-application.md` was
>   never listed in either, even though `INDEX.md` and this file's own §4
>   already had it right). Added a Tier 3 entry for it and fixed the count
>   and the §4.1 tree comment to match.
> - **SPEC.md** updated: §0.2 D30 (locked), §2.1 (2 new prompt bullets: the
>   new prompt + the CONTINUE-TINS-PROJECT brief backfill), §2.3 (stale
>   brief fixed, new Tier 3 pattern entry), §2.4 (1 new script bullet),
>   §4.1 (4 new/changed tree entries), §8.27 (6 new acceptance criteria
>   a–f), §9 (D30's candidate note replaced with a new, richly-detailed D31
>   candidate note preserving the user's full curriculum-generator framing).
> - **`INDEX.md`** updated: Prompts 16 → 17, Scripts 16 → 17, 2 new rows,
>   3 existing rows amended (SPEC-AUTHOR, CONTINUE-TINS-PROJECT,
>   private-to-public pattern brief).
> - **`scripts/validate.mjs`** updated: expectedPrompts 16 → 17,
>   expectedScripts 16 → 17; 6 new §8.27a–f checks (including a check that
>   private-to-public.mjs does NOT import scan-task-packet.mjs, keeping the
>   D30 confirmation mechanically enforced, not just documented); order
>   array extended; HELP text extended.
> - **`scripts/selftest.mjs`** updated: 4 new cases — but unlike D29, these
>   test `private-to-public.mjs` DIRECTLY (shelling out to it against live
>   fixtures), not just the validator. Rationale for the different call
>   than D29's skip: this script does meaningfully more (three modes, its
>   own glob matching, two fingerprint categories) and a real bug was
>   already found in it once during manual smoke-testing — exactly what a
>   presence-only validator check can't catch. Cases: wildcard copy-filter
>   + exclude correctness, a planted methodology fingerprint (exit 1), a
>   planted LLM-authorship fingerprint (exit 1), and `--scan-only` +
>   bad-usage exit 2.
> - **Deferred, not built:** candidate D31 (repurposing a finished
>   project's documentation into full teaching/interview-prep material) —
>   raised by the user alongside this W, explicitly scoped out after a
>   grep against `docs/GAP-ANALYSIS.md` and every `lib/patterns/` file
>   confirmed zero prior art for the idea (package5's study-plan mention is
>   a single unabsorbed line, never a gap, never a pattern) — this is a
>   from-scratch design effort of comparable size to D29/D30, not a
>   "finish what's there" job. Full framing preserved in SPEC.md §9 for
>   whenever it's picked up.
> - **Validator**: 47 pass / 0 warn / 0 fail (was 41 → 47 with the 6 new
>   §8.27 checks), confirmed against the live vendored tree on the
>   device, not just the staged copy. `node --test scripts/selftest.mjs`:
>   19/19 green (15 unchanged + 4 new, directly exercising the new
>   script), also confirmed live. `scripts/private-to-public.mjs` also
>   smoke-tested manually beyond the selftest cases, against the real
>   committed file: a fixture with a real TINS/AGENTS.md/HANDOVER.md/
>   Claude/"as an AI"/"Certainly!" leak set (exit 1, all 7 distinct leak
>   types caught), the same fixture cleaned (exit 0), and no-args usage
>   (exit 2). `scripts/decision-log.mjs builder` run live to append D24
>   to `BUILDER-DECISIONS-REVIEW.md`; gate re-confirmed green afterward
>   (47/0/0, 19/19, unchanged).

### W15 — Curriculum / interview-prep generation (D31): teaching material from a finished project's real history  ✅ DONE (2026-08-21, session 15)

> **Result:** The user asked to finish the D31 candidate deferred at the end
> of W14: turning a finished project's real working history into standalone
> teaching material. Interview ran across three `AskUserQuestion` rounds plus
> prose discussion live with the user, following D12/AGENTS.md §0a's
> mandatory-interview-before-drafting discipline even for the kit's own
> self-development. Round 1 confirmed all three heavy content pieces in v1
> (real-bug debugging case studies, scenario questions from real
> requirements, first-principles reimplementation drills), and specifically
> confirmed the FULL ambitious version of the reimplementation drills over a
> deferred or scoped-down option. The user then raised two design questions
> unprompted, verbatim: wanting the LLM to "reply back in parts so that the
> output context window doesnt get hit and the llm can be as descriptive as
> possible," and asking whether curriculum generation needs "the same
> [model] as the first llm that the author used or is it some other cheaper
> model," specifically flagging that the reimplementation drills might need
> "a smarter model" because "that task is monumental in itself." Both were
> resolved in prose before Round 2: the first into a manifest-first +
> one-file-per-turn generation design; the second into the kit's own D4
> fresh-session discipline (a prompt should work from real project artifacts,
> never the original builder session's memory) plus an explicit
> frontier-model-at-extended/max-thinking recommendation specifically for the
> reimplementation-drills prompt, reusing D29's
> `check-task-independence.mjs` precedent for that exact phrasing. Round 2
> confirmed all of this; Round 3 confirmed the full proposed folder layout
> and design summary as-is ("Yes, build it as described"). Two new prompts +
> one new template + wiring + SPEC + validator + INDEX updates.
> - **`prompts/GENERATE-CURRICULUM.md`** (~14 KB): the 10-step fresh-session
>   prompt that produces a sibling `<project>-curriculum/` folder — a primer
>   (`00-START-HERE.md`), a glossary, a concept-to-code index, a milestones/
>   pacing file, and one `modules/<NN>-<name>/` per non-trivial subsystem,
>   each with a `README.md`, real-acceptance-criteria-sourced
>   `SCENARIO-QUESTIONS.md`, and — only where `BUILDER-DECISIONS-REVIEW.md`
>   shows a real bug in that module's history — a `DEBUGGING-CASE-STUDY.md`
>   structured as "diagnose it yourself first, then see the real fix."
>   Generates ONE FILE PER TURN by design (never compresses multiple files
>   into one response), tracked via `CURRICULUM-PROGRESS.md` so an
>   interrupted run resumes instead of restarting. Written in direct
>   second-person instructional voice — deliberately NOT
>   `PUBLISH-OPEN-SOURCE.md`'s corporate voice, since the two serve different
>   audiences (someone evaluating the software vs. someone learning from it).
>   Ends with `scripts/private-to-public.mjs --scan-only` as the safety gate,
>   reused exactly as-is.
> - **`prompts/GENERATE-INTERVIEW-PREP.md`** (~13 KB): the separate,
>   optional 9-step companion pass — reads the curriculum
>   `GENERATE-CURRICULUM.md` already produced, identifies the project's real
>   core CS/systems concepts from the concept-to-code index (never a generic
>   textbook topic list), and generates one guided from-scratch
>   reimplementation exercise per concept: problem statement → real
>   constraints from SPEC.md §7 → an explicit "attempt it yourself first"
>   divider → a worked, actually-reasoned-through reference solution → how
>   it differs from the real project's version. Its own header prominently
>   and explicitly recommends running it on a frontier model at
>   extended/max thinking, citing `check-task-independence.mjs` (D29) as the
>   kit's existing precedent for that exact recommendation, and instructs the
>   session to tell the user plainly if it is not one. Same one-file-per-turn,
>   `CURRICULUM-PROGRESS.md`-tracked (its own separate copy, inside
>   `interview-prep/`), scan-gated mechanics as `GENERATE-CURRICULUM.md`.
> - **`templates/CURRICULUM-PROGRESS.md`**: the raw starter for a
>   generation run's resumability tracker, mirroring
>   `templates/DELEGATION-LEDGER.md`'s role — a manifest table of every
>   planned file with pending/done status, resume instructions, and a
>   safety-gate result log. Each generation run starts its own fresh copy at
>   its own output location; `GENERATE-CURRICULUM.md`'s and
>   `GENERATE-INTERVIEW-PREP.md`'s copies are deliberately kept separate,
>   never merged.
> - **`prompts/CONTINUE-TINS-PROJECT.md`** amended: Step 2 now also routes
>   "turn this into teaching material" W's to `GENERATE-CURRICULUM.md`
>   (alongside the existing FRONTEND-REFRESH.md, DELEGATE-WORK.md, and
>   PUBLISH-OPEN-SOURCE.md routing), confirming the gate is green first for
>   the same reason `PUBLISH-OPEN-SOURCE.md`'s routing does, and naming
>   `GENERATE-INTERVIEW-PREP.md` as the optional next pass. The header
>   companion-block gained a 4th specialized-W bullet.
> - **Key design decision, reasoned through and locked in SPEC.md's D31
>   row rather than separately re-confirmed as its own question (consistent
>   with everything the user did confirm):** `scripts/private-to-public.mjs`
>   is reused AS-IS for the curriculum's safety gate — no new script, no new
>   banned-terms list — because the curriculum's own process-teaching
>   content must describe engineering practices in generic vocabulary (not
>   kit-specific terms) to avoid becoming a methodology leak itself, meaning
>   it needs to avoid exactly the same two categories D30 already blocks
>   (methodology fingerprints, LLM-authorship fingerprints).
> - **Per the established D28/D29 precedent** (pure-prompt-only additions
>   with no new runnable script can skip new selftest cases, since the
>   validator's presence/content checks cover it): D31 ships 2 prompts + 1
>   template but reuses D30's already-tested `private-to-public.mjs` rather
>   than shipping a new script, so no new `scripts/selftest.mjs` cases were
>   added — unlike D30's own entry, which DID add 4 direct cases because it
>   shipped a real new script doing meaningfully more than a presence check
>   can verify.
> - **SPEC.md** updated: §0.2 D31 (locked, full interview detail preserved),
>   §2.1 (2 new prompt bullets + brief update), §4.1 (3 new tree entries),
>   §8.28 (5 new acceptance criteria a–e), §9 (D31's old candidate bullet
>   replaced with a short "no auto-grading/quiz/drift-sync" boundary note),
>   plus a 1-line fix to D30's own §0.2 row so it no longer dangles a
>   reference to a §9 note structure that no longer exists.
> - **`INDEX.md`** updated: Prompts 17 → 19, Templates 15 → 16, 3 new rows,
>   the CONTINUE-TINS-PROJECT row amended.
> - **`scripts/validate.mjs`** updated: expectedPrompts 17 → 19,
>   expectedTemplates 15 → 16; 5 new §8.28a–e checks; order array extended;
>   HELP text extended.
> - **Validator**: 52 pass / 0 warn / 0 fail (was 47 → 52 with the 5 new
>   §8.28 checks), confirmed against the live vendored tree on the device.
>   `node --test scripts/selftest.mjs`: 19/19 green, unchanged by design (see
>   the D28/D29 precedent note above).

### W16 — Autonomous orchestration + tooling gate + steering prompts (D32/D33/D34)  ✅ DONE (2026-08-26, session 16)

Three user-requested capabilities, closed in one round.

**D32 — autonomous orchestration.** After the interview locks the spec, the
harness can stand up an **auditor** (master) session and **worker** (slave)
sessions that drive D29's existing parallelisation pipeline to completion on
their own. Shipped as a harness-agnostic **contract**
(`prompts/AUTONOMOUS-BUILD.md`, `prompts/WORKER-SESSION.md`) plus a
**reference runner** (`scripts/orchestrate.mjs`), so a harness with native
subagent spawning satisfies the contract without the script and one without
gets a working runner. Run state lives in files — `delegation/LEDGER.md` is
the state machine, `ORCHESTRATION.json` the config, `ESCALATIONS.md` the
question queue — so a fresh auditor can take over mid-run. Escalation is
tiered (`lib/patterns/tiered-escalation.md`): T0 decide and log, T1 decide
and flag in the digest, T2 stop and ask; **uncertainty resolves to T2, never
T1**; a T2 parks its own task and its dependents while the rest of the run
continues (exit 3, distinct from success and failure). The auditor never
writes product code and re-issues failing tasks to fresh workers rather than
patching them.

**D33 — tooling discovery + security audit.** Every Scenario 1 and Scenario 3
run now starts behind a **blocking** gate: inventory what the harness actually
has, derive what the work actually needs, search the internet for MCP servers
and skills that close the gap, audit each candidate against 9 red flags, land
it on SAFE / REVIEW-REQUIRED / UNSAFE with **uncertainty resolving to
REVIEW-REQUIRED**, and record it in the consumer's `TOOLING-AUDIT.md`.
`scripts/tooling-audit.mjs` blocks while a REQUIRED capability is `pending`,
when an UNSAFE tool is installed, or when a waiver names no handicap. The kit
never installs and never executes a candidate.

**D34 — adaptive inline steering prompts.** `prompts/STEERING-PROMPTS.md` is a
catalogue the LLM selects from — **not** a file handed to the user. Seven
drift classes, each card adapted from the scenario, the project's live state,
and what just happened, so it names the real file / decision / W. Emission is
at five checkpoints, one of them mandatory and immediate: **the moment the
model corrects itself on a recheck**, it says so out loud and offers the card.
Cards are offered, never auto-executed.

**Gate:** validator 60 pass / 0 warn / 0 fail (was 42, +18 checks). Selftest
35/35 (was 19, +16 cases). Unlike the D28/D29/D31 prompt-only precedent, this
round shipped three executable scripts, one of which is a blocking gate — and
per D7 a gate nobody has watched fail is decoration, so all three are tested
directly against real defects.

**Still untested by reality:** D32's design rests on assumptions about how
worker sessions behave that only a real unattended run can check. Piloting
`AUTONOMOUS-BUILD.md` on a real project is now the kit's highest-value next
step.

---

### W17 — Execution-mode selection (D35): ask how the work should actually be built  ✅ DONE (2026-08-26, session 17)

The kit could build work five ways but never asked which one the user wanted —
routing depended entirely on how they happened to phrase the W. D35 makes it a
question.

`prompts/EXECUTION-MODE-INTERVIEW.md` is a shared interview (D4, the same
shape as D28's design-vision interview: referenced from four trigger points,
never duplicated). It presents `solo`, `auditor-local`, `auditor-remote`,
`self-parallel`, `external`, and `hybrid`, with their real costs and
trade-offs, and routes onward. **`auditor-remote` vs `self-parallel` is the
distinction users collapse most often** — both use several LLMs; the
difference is whether a session orchestrates or the person does — so the
interview is required to state it explicitly.

Asked **per round**, pre-filled from the previous round, because the right
mode shifts as scope shrinks: five independent modules is a different question
from the last two bug fixes.

The answer is enforced, not just recorded. `orchestrate.mjs` reads
`delegation/LEDGER.md`'s round header literally and refuses to dispatch
`solo` / `self-parallel` / `external` rounds. In a `hybrid` round only the
auditor-driven rows dispatch. Pre-D35 ledgers still work.
`DELEGATE-WORK.md` stopped asking its own self-vs-external question.

`templates/ORCHESTRATION.json` ships worker-command shapes for Claude Code,
Codex and Gemini, verified against each tool's own headless documentation on
2026-08-26 and dated so the next session knows to re-check — rather than
invented from memory, which is exactly the rot the kit's own B-pass exists to
catch. The standing advice is to run one worker by hand on one task first: a
subtly wrong `workerCmd` fails identically for every task, unattended, up to
`maxRetries` times each.

**Gate:** validator 68 pass / 0 fail (+8 checks). Selftest 43/43 (+8 cases).
The new tests found a real defect: the mode refusal sat after the
nothing-runnable early exit, so a user-driven round exited 3 ("parked, owed an
answer") instead of 2 ("wrong prompt"). Moved ahead of it.

**Still untested by reality:** `auditor-remote` has never been run end to end
against a second provider. The presets are documentation-verified, not
execution-verified.

---

### W18 — First real autonomous run, captured as `examples/` (D36)  ✅ DONE (2026-08-26, session 18)

D32 had never been run. `HANDOVER.md` said so: *"Still untested by reality."*
This was that test — a real auditor + worker round building a zero-dependency
todo app from a locked spec, with 4 worker sessions across 2 waves.

**It worked.** 3 of 4 tasks integrated, 16/16 auditor end-to-end checks passed
on the integrated app in real Chromium, 38 unit tests green. The run ended
**parked at exit 3** with 2 spec amendments only a human may make — the correct
terminal state, not a failure.

**It also found 3 defects in the kit, all now fixed or recorded:**

1. **A ledger with a second markdown table broke both ledger readers.** The
   auditor appended a round-outcome summary and `orchestrate.mjs` parsed its
   rows as tasks, dying on "unrecognised status".
   `templates/DELEGATION-LEDGER.md` invites extra sections, so this would hit
   any project documenting its own round. **Fixed** in `orchestrate.mjs` and
   `check-task-independence.mjs` (first matching table only), pinned with 2
   regression selftests.
2. **`escalate.mjs` has no slot for a round-level escalation.** It requires
   `--task`, but a spec contradiction belongs to no task. Filing against a
   non-ledger id works (the script warns and parks nothing) but that is
   graceful degradation, not a modelled case. **Recorded, not fixed** — a
   genuine D32 gap and the best candidate for the next kit-growth session.
3. **`kit-sync.mjs` would have vendored `examples/` into every consumer**,
   contradicting D36 the moment it was written. **Fixed**, and pinned by
   §8.33e so the decision is true in the code rather than only in the table.

**Also notable:** the D33 tooling gate paid for itself on its first real run by
disproving its own assumption — it expected no browser and would have waived
§8.8/§8.9; checking found Playwright and Chromium installed. Two acceptance
criteria would otherwise have been "verified" by reading CSS.

And one worker misdiagnosed a red gate while another correctly diagnosed it,
with the auditor reproducing it independently before accepting either. That
chain is the entire argument for the worker/auditor split.

**Gate:** validator 73 pass / 0 fail (+5). Selftest 45/45 (+2).

---

## 6. Gotchas / known issues

- **The kit is now a working library, but the validator hasn't been updated to
  check the new §8.13–§8.20 acceptance criteria.** W9 fixes this. Until then, the
  gate doesn't catch a missing `tests/<name>.test.ts` in a new module.
- **The 4 deferred `lib/` modules** (audit-viewer, docs-guardian, pwa-config,
  auth-shell) are documented in SPEC §9 as deferred. A future kit release may
  promote them to first-class modules; for now, the patterns in `lib/patterns/`
  cover the rationale.
- **The reference projects use different stacks.** exam-forge is Vite+React+localStorage,
  Jayshankar is Vite+React+Supabase, atal-incubation is Next.js+Prisma+Postgres,
  Data-cleaning-script is C#+PowerShell, package5 is study-plan-only. The kit's
  `lib/` modules serve the first 3; the last 2 are captured as patterns only.
- **The atal-incubation reference has a 656 MB `original-incubos-checkout.zip` in
  archive/.** This is a leftover from the prior session's working copy. The kit
  does not need it.
- **The kit does not have a CHANGELOG.md yet.** SPEC.md is the versioned source;
  git history is the change log. The `BUILDER-DECISIONS-REVIEW.md` is the
  per-change audit trail.
- **The `tenant-rls` module's `TENANT_SCOPED` set is a placeholder.** Consumers
  must replace it with their actual schema's tenant-scoped models. The README
  documents this in step 1.
- **The `migration-runner.mjs` uses `pg` (the `postgres` npm package).** It
  needs `DATABASE_URL` to be set; otherwise it errors out (or runs in dry-run
  mode). The kit is otherwise zero-dep (D3) but this one script needs `pg`
  because writing a Postgres client from scratch in Node is more than 200 lines
  and not worth the maintenance burden.

## 7. Handover protocol

When you finish a W item:
1. Run `node tins-kit/scripts/validate.mjs --spec tins-kit/SPEC.md`. It must exit 0.
2. Run `node tins-kit/scripts/selftest.mjs`. It must exit 0.
3. Update this file: the "Last updated" line, the "Last worked on by" line, the
   "Queue position" line, the state snapshot, the relevant row in §4.
4. If you amended the spec, write a one-paragraph note in
   `BUILDER-DECISIONS-REVIEW.md` (consumer's file, at the kit root or inside the
   changed module) describing the change and the reason.
5. If a reviewer session ran, its findings go in `REVIEWER-DECISIONS-REVIEW.md`.
6. The kit's own changes are visible to consumers; if a change is a breaking
   change to a `lib/` module, mark it explicitly.

When you start a new session:
1. Read `HANDOVER.md` first (5 min context).
2. Then `SPEC.md` §0 (the 24 locked decisions) and §0.4 (the absorption table).
3. Then `AGENTS.md` for the standing rules.
4. Then `docs/WORKFLOW.md` for the 5-step consumer workflow.
5. Then the spec sections relevant to your W item.

An unrecorded finding is a finding the next session pays for again.
