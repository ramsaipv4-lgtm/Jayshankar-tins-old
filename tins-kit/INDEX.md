# INDEX.md — the kit's selective-chooser

> **A 1-page index of every kit asset, with 1-line briefs.** A fresh LLM
> session reads this first, then selectively picks the relevant items.
> Without this, the LLM has to `ls` + `cat` every file to know what's
> available. With this, the LLM can see the whole menu at a glance.
>
> **Read time:** 3 minutes end-to-end. **Save time:** 30+ minutes of
> "what does the kit have?" exploration per fresh session.
>
> **Source:** the kit's selective-chooser discipline (D27). The INDEX
> is the entry point; the per-asset files are the substance.

---

## How to use this

1. **Read this file end-to-end** (3 minutes; 8 sections).
2. **For each asset, decide:** relevant (read in full) / not-relevant (skip).
3. **Apply the relevant patterns + modules + scripts + prompts.**
4. **If unsure, default to "read it."** A 5-minute read is cheaper than
   a 30-minute re-derivation.

When you start a new session at a project, the recommended order is:
`AGENT-BRIEF.md` (at the project root) → `PIPELINE.md` (this INDEX's
companion) → **this file** → the specific files you marked as relevant.

---

## 1. Patterns (23)

Architect recipes. Each is ~200–500 lines with worked examples. The
canonical 4-section structure (D19): §0 Why this exists, §1 the
substance, §2 anti-patterns, §3 when this changes.

| Pattern | When to use |
|---|---|
| `append-only-audit-log` | Every mutation must leave a trail; no UPDATE/DELETE policy, use SECURITY DEFINER trigger. |
| `client-side-aggregation` | Heuristic for "do this aggregation in JS or in a Postgres view?" |
| `cross-tenant-404` | Return 404, never 403, when a resource exists in another tenant. |
| `empty-states` | 3-tier rubric for empty states: action / hint / message. |
| `env-vs-config` | 3 env files, compose vs. app env, build-time vs. runtime. |
| `fifo-cascade-algorithm` | Numbered procedure for FIFO algorithms with worked JS + selftest. |
| `frontend-overhaul` | The "big UI rewrite" pattern: do it as a spec'd sub-project, not a branch. |
| `idempotent-migrations` | 6 primitives every SQL migration must use. |
| `kit-self-application` | The "kit grows by mining its consumers" loop. The 2-consumer rule. |
| `multi-tenant-rls` | Architect's-eye view of tenant RLS (companion to `two-prisma-clients`). |
| `observability-first` | Liveness/readiness split + 5 must-have alerts + 5 runbooks. |
| `outbox-job-queue` | Decouple email/webhook/cron from request handling. |
| `pinned-deps` | Exact versions in `package.json`, manifest-in-lockstep, `.gitignore` for generated. |
| `postgres-mutations` | Multi-table mutation with RLS bypass via SECURITY DEFINER. |
| `prisma-extensions-rls` | The `$extends` + AsyncLocalStorage recipe. |
| `private-to-public` | Producing a scrubbed, corporately-documented public sibling repo from a private working copy (not the same as `RELEASE-CHECKLIST`'s same-repo prod-readiness sweep). |
| `pwa-offline-graceful` | Read-only offline degradation (the 3-layer offline). |
| `shortfall-pattern` | Never fail silently; return `{ result, shortfall, warnings }`. |
| `supabase-auth-trigger` | The canonical Supabase Auth + `public.users` wiring recipe. |
| `third-party-tool-audit` | Reading an MCP server or skill before you trust it: 9 red flags, 3 verdicts, uncertainty → REVIEW-REQUIRED. |
| `tiered-escalation` | Which decisions an LLM may make alone: T0 decide / T1 decide+flag / T2 stop and ask. Tier by reversibility, not difficulty. |
| `two-prisma-clients` | Multi-tenant Postgres isolation via `basePrisma` + `restrictedPrisma`. |
| `versioned-spec-amendment` | Merge-ready amendment file convention. |

## 2. Lib code modules (7)

Drop-in code. Each has `index.ts` + `README.md` + `tests/`. The
consumer `cp -r`s the module into their own `lib/` (or wherever the
project keeps its code).

| Module | When to use |
|---|---|
| `no-backend` | localStorage state with quota + clear + SSR-safety (`useLocalState`, `clearLocalState`, `isLocalStorageAvailable`, `LocalStateError`). |
| `money-as-decimal` | Zod schema + `fromString` / `toString` / `format` / `sum` / `subtract` / `multiply` / `divide` / `equals` / `gt` / `lt` (the "0.1+0.2 === 0.3" trap solver). |
| `tenant-rls` | `basePrisma` + `restrictedPrisma` + `withTenantTx` + `tenantTxStorage` + `TENANT_SCOPED` (the multi-tenant Prisma primitive). |
| `audit-viewer` | `AuditLogEntry` + `applyFilter` + `paginate` + `diffRows` + `renderAuditViewer` (the pure-TS render function the framework adapter wires up). |
| `docs-guardian` | `DocArea` (13 controlled-vocab areas) + `DocMap` + `loadDocMap` + `checkDocFreshness` + `countReferences` (the self-maintaining docs system). |
| `pwa-config` | `withPwa` (Vite plugin) + `useOnlineStatus` (React hook, SSR-safe) + `<OfflineBanner />`. |
| `auth-shell` | `Session` + `ROLES` (8-role vocab) + `setSessionProvider` + `useSession` + `getServerSession` + `requireRole` + `<RoleGate>` + `handleFirstUserIsAdmin`. |

## 3. Prompts (24)

Paste-into-fresh-session format (D4). Each is a complete script an LLM
session can ingest. **One per scenario in the user-facing flow** (D27).

| Prompt | When to use |
|---|---|
| `NEW-PROJECT` | **Scenario 1.** Start a new TINS project from scratch using the kit shell (7-step generic copy-paste). Runs the `TOOLING-AUDIT` blocking gate at Step 0. |
| `PROMOTE-TO-TINS` | **Scenario 2.** Take an existing project (built without the kit) and turn it into a TINS project (7-step retro-fit). |
| `CONTINUE-TINS-PROJECT` | **Scenario 3.** Pick up an existing TINS project and add a new W (6-step pickup); routes frontend-visual W's to `FRONTEND-REFRESH`, parallel-work-split W's to `DELEGATE-WORK`, public-release-packaging W's to `PUBLISH-OPEN-SOURCE`, teaching-material W's to `GENERATE-CURRICULUM`, and build-it-unattended W's to `AUTONOMOUS-BUILD`. Runs the `TOOLING-AUDIT` blocking gate at Step 0 and the `EXECUTION-MODE-INTERVIEW` menu at Step 2. |
| `KIT-GROWTH-SESSION` | **Scenario 4.** At the kit root: triage `kit-staging/inbox/`, run KITTING for accepted candidates, sync to projects, archive the inbox. |
| `SPEC-AUTHOR` | Interview the user (7 questions + A/B/C pass), then draft `SPEC.md`; Step 7a hands off to `FRONTEND-VISION-INTERVIEW` for websites; question 8 (every project) records public-release intent for `PUBLISH-OPEN-SOURCE` later. |
| `SPEC-REVIEWER` | A separate reviewer session reviews a frozen-for-v1 `SPEC.md` (6 review passes). |
| `BUILDER-REVIEW-TEMPLATE` | The template for `BUILDER-DECISIONS-REVIEW.md` (with worked example D1). |
| `REVIEWER-REVIEW-TEMPLATE` | The template for `REVIEWER-DECISIONS-REVIEW.md` (with worked example R1). |
| `INTERVIEW-CHECKLIST` | The 1-page reference for `SPEC-AUTHOR`'s 7 questions + A/B/C pass + §0.3 "what I guessed". |
| `KITTING` | The per-pattern workflow for adding a new pattern to the kit (9 steps). |
| `KITTING-REVIEW` | The triage rubric for `kit-extract.mjs` candidates (3-question accept/reject/defer). |
| `RELEASE-CHECKLIST` | Pre-deploy gate (typecheck/build/test, smoke, 5-min soak, private-to-public, docs, security, observability, backout). |
| `FRONTEND-VISION-INTERVIEW` | The shared design-vision interview (survey + inspiration research + install-vs-recreate for the 5 reference libraries). Triggered by `SPEC-AUTHOR` (new websites) and `FRONTEND-REFRESH` (existing ones) — never duplicated. |
| `FRONTEND-REFRESH` | Refresh an existing tins-kit website's frontend only — any framework/language, backend/DB untouched, verified against the project's current mode (A/B/C). |
| `DELEGATE-WORK` | Split a TINS project's remaining *locked* work into independent tasks for `self-parallel` or `external` execution — reads the round's mode from `LEDGER.md` (set by `EXECUTION-MODE-INTERVIEW`), runs the independence check, builds scrubbed packets for external tasks. |
| `INTEGRATE-DELEGATED-WORK` | Bring returned parallel-work tasks back together — merge, recover notes into the real decision log, reconcile discrepancies (explain before applying). |
| `PUBLISH-OPEN-SOURCE` | Package a finished TINS project for public release — copy+scan via `private-to-public.mjs`, corporate-voice public docs, quality rubric, verify + deploy the public copy. Not the same as `RELEASE-CHECKLIST`. |
| `GENERATE-CURRICULUM` | Turn a finished TINS project into a standalone teaching curriculum — sibling `<project>-curriculum/` folder, one file per turn, second-person instructional voice, sourced from real decisions/bugs/requirements, gated by `private-to-public.mjs --scan-only`. Companion: `GENERATE-INTERVIEW-PREP`. |
| `EXECUTION-MODE-INTERVIEW` | **Ask this first, every round.** How should the work actually be built? Five modes — `solo`, `auditor-local`, `auditor-remote` (workers on your other LLM CLIs), `self-parallel` (you drive them), `external` — plus `hybrid` per task. Records into `LEDGER.md`; `orchestrate.mjs` enforces it. |
| `AUTONOMOUS-BUILD` | **Specialized W.** Become the auditor: decompose the locked spec, dispatch worker sessions, verify + integrate, escalate only what an LLM must not decide alone. Drives D29's pipeline; never writes product code. |
| `WORKER-SESSION` | The worker's contract, dispatched by the auditor (not pasted by the user). One task, one file list, escalate anything outside it, write `NOTES.md`, stop. |
| `TOOLING-AUDIT` | **Blocking gate, run first.** What the harness has vs. what the work needs; search + security-audit MCP servers and skills; never installs, never executes a candidate. |
| `STEERING-PROMPTS` | The catalogue of adaptive correction cards the session offers the user inline — mandatorily and immediately after any self-correction. Not handed to the user as a file. |
| `GENERATE-INTERVIEW-PREP` | Separate, optional pass over an existing curriculum — one guided from-scratch reimplementation exercise per core CS/systems concept the project's real stack touches, for technical-interview practice. Explicitly recommends a frontier model at extended/max thinking. |

## 4. Templates (19)

Consumer copies + fills. The TINS docs system.

| Template | When to use |
|---|---|
| `SPEC.md` | The consumer's `SPEC.md` (the source of truth). |
| `HANDOVER.md` | The consumer's handover work system (W-queue + state + gotchas + protocol). |
| `AGENTS.md` | The consumer's 1-page LLM onboarding. |
| `TRAININGS.md` | The consumer's debugging wisdom handbook. |
| `BUILDER-DECISIONS-REVIEW.md` | The consumer's decision log (every non-obvious decision). |
| `REVIEWER-DECISIONS-REVIEW.md` | The consumer's review log. |
| `PROJECT-AGENT-BRIEF.md` | The 1-page per-project brief (a project's first read). |
| `zod-schemas/money.zod.ts` | The Zod schema for money (`MONEY_REGEX = /^\d+\.\d{2}$/`). |
| `sql/rls-policies.sql` | The idempotent RLS-enable migration. |
| `sql/audit-trigger.sql` | The append-only audit log trigger (idempotent). |
| `sql/idempotent-migration-pattern.sql` | A starter migration showing the 6 idempotency primitives. |
| `eslint/no-float-money.js` | The ESLint rule that bans `Number()` and `parseFloat()` on money. |
| `.gitignore` | The kit's recommended `.gitignore` (9 must-ignore categories). |
| `TASK-BRIEF.md` | The raw starter for an external-mode task packet's ticket (Context/Scope/Interface Contract/Acceptance Criteria/Out of Scope/Definition of Done). |
| `DELEGATION-LEDGER.md` | The raw starter for a consumer project's `delegation/LEDGER.md` (the task table `check-task-independence.mjs` reads). |
| `DELEGATION-README.md` | The raw starter for a consumer project's `delegation/README.md` (author-side only, explains the self-vs-external layout). |
| `ORCHESTRATION.json` | The autonomous run's config: harness, worker command, `maxParallel`, `maxRetries`, tier policy, `haltOn`. |
| `ESCALATIONS.md` | The autonomous run's question queue: open T2s, the T1 digest, the answered archive. |
| `TOOLING-AUDIT.md` | The consumer's tooling record: audit status, capability gaps, candidates, verdicts, priorities, waiver handicaps. |
| `CURRICULUM-PROGRESS.md` | The raw starter for a curriculum generation run's resumability tracker — the manifest table `GENERATE-CURRICULUM.md` / `GENERATE-INTERVIEW-PREP.md` read to skip already-`done` files on resume. |

## 5. Scripts (20)

Zero-dep Node ESM (except `migration-runner.mjs` which uses `pg`).
Run with `node scripts/<name>.mjs`. All exit 0 on success, non-zero
on failure.

| Script | When to use |
|---|---|
| `validate.mjs` | The spec validator. `--spec=<path>` runs the spec checks; `--kit` or `--all` runs the inventory checks. The gate. |
| `selftest.mjs` | The self-test that proves `validate.mjs` fails on known defects. |
| `migration-runner.mjs` | Apply SQL migrations in order, idempotent, track in `migrations_applied` table. |
| `decision-log.mjs` | Append a date-stamped decision to `BUILDER-DECISIONS-REVIEW.md` or `REVIEWER-DECISIONS-REVIEW.md`. |
| `kit-coverage.mjs` | Given a consumer's `SPEC.md`, print which `lib/patterns/` entries are likely to apply. |
| `kit-listing.mjs` | List every pattern / prompt / schema / template / script / lib module / doc. |
| `kit-new-pattern.mjs` | Scaffold a new `lib/patterns/<name>.md` from the canonical 4-section template. |
| `new-project.mjs` | Scaffold a new TINS consumer in a sibling directory (templates + the chosen `lib/` modules). |
| `docs-guardian.mjs` | The CLI wrapper around `lib/docs-guardian/` that checks docs freshness. |
| `kit-extract.mjs` | The auto-miner: scores consumer decisions 0–7, produces `kit-growth-candidates.md`. |
| `kit-sync.mjs` | The workhorse: pushes the top-level kit to a project's vendored copy (additive + update). |
| `kit-ingest.mjs` | The inbox scanner: scans `kit-staging/inbox/`, produces a merged triage report. |
| `kit-new-project-shell.mjs` | The portable kit shell scaffolder (~50 KB output). |
| `kit-staging-export.mjs` | The consumer-side dump helper: bundles kit-worthy artefacts into a tarball. |
| `check-task-independence.mjs` | Reads a consumer's `delegation/LEDGER.md`, flags any file-set overlap between tasks before packets are built. |
| `scan-task-packet.mjs` | Scans a built task packet for methodology fingerprints and path escapes before it ships to an external contributor. |
| `orchestrate.mjs` | The reference runner for an autonomous build. `--dry-run` plans, `--status` reports. Reads the round's execution mode and refuses `solo` / `self-parallel` / `external` rounds. Exit 0 complete / 1 failed / 2 config / 3 parked. |
| `escalate.mjs` | File a tiered escalation. Refuses a T0, and refuses a T2 missing its question / trigger / 2+ options / recommendation. |
| `tooling-audit.mjs` | The D33 blocking gate. Fails on a pending REQUIRED capability, an installed UNSAFE tool, or a waiver that names no handicap. |
| `private-to-public.mjs` | Copies a private working copy to a public sibling folder, then scans the ENTIRE destination tree (comments included) for methodology and LLM-authorship fingerprints. `--scan-only` re-scans without re-copying. |

## 6. Schemas (4)

JSON Schema 2020-12. For static artefacts (D6, D22). Runtime input
validation is the consumer's responsibility.

| Schema | What it validates |
|---|---|
| `tins-markers` | The `<!-- TINS -->` and `<!-- ZS: -->` block at the top of every `SPEC.md`. |
| `locked-decisions` | The §0.2 table structure (`Decision`, `Resolution` columns). |
| `handover` | The `HANDOVER.md` header + W-item structure. |
| `tins-spec-minimal` | The minimum viable `SPEC.md` shape (§0, §1, §2, §4, §8, §9). |

## 7. Docs (4)

| Doc | What it covers |
|---|---|
| `WORKFLOW.md` | The full consumer flow: spec → build → record → mine → sync. |
| `LIBRARY-CONVENTIONS.md` | How to write a new pattern / module / prompt (canonical layouts). |
| `KITTING.md` | The per-pattern KITTING workflow (for the kit root). |
| `GAP-ANALYSIS.md` | The 60 gaps (G01–G60) that the kit grew from. |

## 7b. Examples (1)

Captured runs of the kit's own workflows — written after the fact from what
actually happened, failures included. Not synced into consumer projects (D36).

| Example | What it shows |
|---|---|
| `autonomous-todo-app` | A real D32 run: an auditor decomposed a locked spec, dispatched 4 worker sessions across 2 waves, verified and integrated them, and parked at exit 3 on 2 spec questions. Verbatim worker prompts and reports, all 4 decision logs, the run digest, and the finished zero-dependency app. Documents the 3 kit defects the run exposed. |

## 8. Top-level files (the kit's own docs)

| File | What it covers |
|---|---|
| `INDEX.md` | This file. The selective-chooser. |
| `PIPELINE.md` | The 7-step universal methodology (read first). |
| `VERSIONING.md` | The 7 version control rules + the staging transport layer. |
| `SPEC.md` | The kit's own `SPEC.md` (the source). |
| `HANDOVER.md` | The kit's work system (state + W-queue + gotchas). |
| `AGENTS.md` | The kit's 1-page LLM onboarding. |
| `BUILDER-DECISIONS-REVIEW.md` | The kit's own decision log. |
| `kit-staging/README.md` | The transport layer spec (inbox + archive + 2 generic prompts). |

---

## The 4 generic prompts (the user-facing flow, D27)

The 4 generic prompts cover the 4 scenarios a user can be in. Pick the
one that matches where you are:

| If you are... | Use prompt... | You should have read... |
|---|---|---|
| **Scenario 1:** starting a NEW project from scratch | `NEW-PROJECT` | `INDEX.md` + `PIPELINE.md` |
| **Scenario 2:** retro-fitting an EXISTING project (no kit) | `PROMOTE-TO-TINS` | `INDEX.md` + `PIPELINE.md` |
| **Scenario 3:** continuing an EXISTING TINS project | `CONTINUE-TINS-PROJECT` | `INDEX.md` + `PIPELINE.md` + the project's `HANDOVER.md` |
| **Scenario 4:** at the kit root, triaging the inbox | `KIT-GROWTH-SESSION` | `INDEX.md` + `PIPELINE.md` + `kit-staging/README.md` |

The prompts are **paste-into-fresh-session format** (D4). They are
self-contained: no "see also" links across files. The INDEX is the only
thing the user has to know about before choosing a prompt.

---

## How to read the kit in 30 minutes (the fast path)

1. **Read this file** (3 min).
2. **Read `PIPELINE.md`** (5 min).
3. **Read the project's `AGENT-BRIEF.md`** (2 min).
4. **Read the kit's `HANDOVER.md`** §1 + §5 (3 min) — the state + W-queue.
5. **Run `node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md`** (1 min) — see what applies.
6. **Read the recommended patterns** in full (~20 min for 5 patterns).
7. **You're ready to build.**

Total: ~30 min. After that, the LLM is at the project's level of context.

---

## How to add a new asset to the kit (the maintenance path)

1. **Pattern**: scaffold via `scripts/kit-new-pattern.mjs <name>`, fill the §0/§1/§2/§3 sections, add a §8.X acceptance criterion to `SPEC.md`, add a validator check.
2. **Lib module**: `mkdir lib/<name>/`, write `index.ts` + `README.md` + `tests/<name>.test.ts`, add a §8.X, add a selftest case.
3. **Prompt**: write `prompts/<name>.md` in paste-into-fresh-session format, add a §8.X, add a row to this INDEX.
4. **Script**: write `scripts/<name>.mjs` (zero-dep), add a §8.X, add a row to this INDEX.
5. **Template**: write `templates/<name>.md`, add a §8.X, add a row to this INDEX.
6. **Update this file** with the new asset's 1-line brief. **This step is non-negotiable.**

---

## When this file is wrong

If a pattern / module / prompt / script is missing from this file, the
file is wrong. If a brief is misleading, the file is wrong. Fix it.
The whole point of this file is to be the single source of truth for
"what's in the kit."

---

*— End of `INDEX.md`. See also: `PIPELINE.md` (the 7-step
methodology), `VERSIONING.md` (the version control + staging
transport), `kit-staging/README.md` (the inbox workflow), and the
4 generic prompts at `prompts/`. This file is referenced by every
generic prompt's "Read these files first" section.*
