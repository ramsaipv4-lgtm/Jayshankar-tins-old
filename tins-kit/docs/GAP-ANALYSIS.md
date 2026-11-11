# GAP-ANALYSIS.md — what tins-kit is missing, and what we're adding

> **Generated 2026-08-15** by an LLM session that read the kit + IncubOS + Jayshankar +
> Data-cleaning-script + package5 + TINS-MCP + exam-forge-reference in full. This is the
> starting point for the kit's "evergrowing project" promise.
>
> **Last updated:** 2026-08-15

---

## 0. Methodology

Cross-referenced patterns observed in the user's five reference projects against
`tins-kit/SPEC.md` (D1–D16) and the actual file inventory under `prompts/`, `schemas/`,
`lib/`, `scripts/`, `templates/`. For every pattern that recurs in 2+ projects but is not
in the kit, the gap is recorded below as a TODO with the destination file path, the
source projects it came from, and a one-line description.

The five reference projects:
- **exam-forge** (`archive/exam-forge-reference/`) — single-user static site, the
  methodology ancestor.
- **Jayshankar** (`Jayshankar/`, `Jayshankar/tins-kit/archive/atal-incubation-reference/`)
  — fish-wholesale inventory, single-tenant, 3 roles, Supabase + PWA, Mode A complete.
- **atal-incubation** (`incubos/` + `HANDOVER.md` + `TRAININGS.md` + `AGENTS.md`) —
  multi-tenant SaaS, Next.js + Prisma + PostgreSQL + RLS, 25 modules, 7 roles.
- **Data-cleaning-script** (`Jayshankar/Data-cleaning-script/`) — the v1→v1.1→v3→v4
  CSV cleaning station lineage, single-file C# .exe with embedded PowerShell.
- **package5** (`Jayshankar/package5/`) — the 3-track Azure AI/ML/Cloud study plan
  (Sem 3, Sem 5 Azure AI, Sem 5 Cloud+Full Stack), 600+ files, 81 companion files,
  the "skill-template" pattern, the job-market report.

Plus the TINS-MCP server (`TINS-MCP/`) — the LLM-facing tool layer.

---

## 1. Inventory of the kit *as it was* before this session

### 1.1 What the kit has
- `SPEC.md` (935 lines, 16 locked decisions D1–D16, 12 acceptance sections, 9 out-of-scope items)
- `HANDOVER.md` (work queue W1–W9)
- `AGENTS.md` (1-page onboarding)
- `BUILDER-DECISIONS-REVIEW.md` (9 decisions, self-application)
- `context.md` (legacy)
- `prompts/SPEC-AUTHOR.md` (W1, 7-question interview + A/B/C pass)
- `templates/`: `SPEC.md`, `HANDOVER.md`, `AGENTS.md`, `TRAININGS.md`, `BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md`
- `lib/patterns/`: 7 entries (`supabase-auth-trigger.md`, `postgres-mutations.md`, `client-side-aggregation.md`, `pwa-offline-graceful.md`, `empty-states.md`, `private-to-public.md`, `FRONTEND-OVERHAUL.md`)
- `scripts/`: `validate.mjs` (W1, 10 checks), `selftest.mjs` (W1, 15 cases)
- `archive/`: `kit-test-2026-08-04/`, `kit-update-package-2026-08-07/`

### 1.2 What the kit spec *promises* but doesn't yet have
- `schemas/` (4 JSON Schemas)
- `lib/`: `no-backend/`, `tenant-rls/`, `audit-viewer/`, `docs-guardian/`, `pwa-config/`, `money-as-decimal/`, `auth-shell/`
- `scripts/`: `migration-runner.mjs`, `docs-guardian.mjs`, `docs-update.mjs`, `new-project.mjs`, `decision-log.mjs`
- `templates/`: `HANDOVER.md`, `AGENTS.md`, `TRAININGS.md`, `zod-schemas/money.zod.ts`, `sql/rls-policies.sql`, `sql/audit-trigger.sql`, `eslint/no-float-money.js`, `.gitignore`
- `docs/`: `WORKFLOW.md`, `LIBRARY-CONVENTIONS.md`, `KITTING.md`
- `tests/`: `kit-smoke.mjs`

---

## 2. The gap table

Each row is a pattern observed in 2+ reference projects that's missing from the kit
today. The "Target file" column is the file the kit will write (or the
existing-file-it-will-update) to close the gap. The "Why" column is the one-line
rationale from the originating projects.

### 2.1 lib/patterns/ (doc-only recipes) — current 7, need ~10 more

| Gap # | Pattern name | Target file | Source projects | Why |
|---|---|---|---|---|
| G01 | `two-prisma-clients` | `lib/patterns/two-prisma-clients.md` | atal-incubation (the canonical `basePrisma` + `restrictedPrisma` + `getPrismaClientForTenant` + `withTenantTx`), exam-forge (no, doesn't apply), Jayshankar (uses Supabase but the same split is implicit) | Multi-tenant RLS without the kit's `lib/tenant-rls/` codepath is the most-asked-for pattern. The atal-incubation writeup is 1,000+ lines of rationale; the kit needs a focused recipe. |
| G02 | `cross-tenant-404` | `lib/patterns/cross-tenant-404.md` | atal-incubation (the "return 404 not 403" rule) | Security: an attacker probing the resource graph can use 403-vs-404 to learn what exists in other tenants. The pattern is "anywhere a resource lookup might cross tenants, return 404, never 403." |
| G03 | `outbox-job-queue` | `lib/patterns/outbox-job-queue.md` | atal-incubation (`NotificationOutbox`, `JobQueue`, `CronLog` tables + cron jobs), package5 (the Azure deployment-heavy capstone that needs async) | "Decouple email delivery from request handling." The pattern ships the 3 tables, the cron worker, the SELECT FOR UPDATE SKIP LOCKED pattern, and the outbox retry schedule. |
| G04 | `append-only-audit-log` | `lib/patterns/append-only-audit-log.md` | atal-incubation (full audit log via Postgres trigger, no UPDATE/DELETE policy), Jayshankar (`audit_log` table + `audit_trigger` function, RLS denies INSERT except for the SECURITY DEFINER trigger) | "Every mutation writes to audit_log via a Postgres trigger. The audit log has no INSERT policy (only the trigger writes), no UPDATE policy, no DELETE policy. Admin can SELECT." The pattern is universal; the SPEC mentions it but no `lib/patterns/` entry exists. |
| G05 | `multi-tenant-rls` | `lib/patterns/multi-tenant-rls.md` | atal-incubation (the two-Prisma-clients + `app.current_tenant` + RLS enable+force pattern) | "The kit ships `lib/tenant-rls/` (code) AND a pattern (doc) for the rationale. The pattern is what an architect reads first to decide if they need tenant RLS at all." |
| G06 | `fifo-cascade-algorithm` | `lib/patterns/fifo-cascade-algorithm.md` | Jayshankar (FIFO spoilage, FIFO sale cascade, FIFO transfer), atal-incubation (AIM tranche release guard — same philosophy) | "How to specify an algorithm as a numbered procedure so the validator can test it." The pattern is the canonical "numbered steps + JS fixture + test" template. |
| G07 | `shortfall-pattern` | `lib/patterns/shortfall-pattern.md` | Jayshankar ("sale of 999 kg with 7 available records 7 kg with shortfall: 992.000 kg message"), Data-cleaning-script (the 03-audit/04-fix/05-verify `$pkCol = $null` guards) | "Never fail silently when the user's intent can't be fully satisfied — record what was done, surface the gap, and let the user decide." Universal across mutations, migrations, fixes. |
| G08 | `idempotent-migrations` | `lib/patterns/idempotent-migrations.md` | Jayshankar (5 SQL files, every CREATE has `IF NOT EXISTS`, every TRIGGER preceded by `DROP TRIGGER IF EXISTS`, every INSERT has `ON CONFLICT DO NOTHING`), atal-incubation (14 migrations, all idempotent), Data-cleaning-script (the seed's idempotency guard) | "A migration that fails on re-apply is not a migration — it's a one-shot." The pattern is the canonical idempotency checklist + the 3 most-frequent gotchas. |
| G09 | `pinned-deps` | `lib/patterns/pinned-deps.md` | atal-incubation ("never commit `node_modules`/`.next`/`.turbo`/`build`/`.env*`/log files"), Data-cleaning-script (the v4 build's `/resource:` flag list must stay in sync with `EMBEDDED_RESOURCES`) | "Anything that is generated, embedded, or environment-specific must be in `.gitignore` or in a manifest, never in the source-of-truth." |
| G10 | `observability-first` | `lib/patterns/observability-first.md` | atal-incubation (the 7 runbooks, OTel traces + Prometheus + Grafana, the 5 most common alert sources) | "The first 7 runbooks you need." The pattern is the runbook template + the 5 alerts that every multi-tenant consumer will hit. |
| G11 | `env-vs-config` | `lib/patterns/env-vs-config.md` | atal-incubation (env vs compose-level env), Data-cleaning-script (the 4 environmental gotchas: `.gitignore`, env-before-build, `SECRETS_SCAN_ENABLED=false`, service-worker caching) | "What's the difference between `DATABASE_URL` (app reads it) and `POSTGRES_PASSWORD` (compose reads it)?" The pattern is the split-the-files discipline. |
| G12 | `prisma-extensions-rls` | `lib/patterns/prisma-extensions-rls.md` | atal-incubation (the `$allOperations` extension that injects `tenantId`, the `AsyncLocalStorage` `tenantTxStorage` guard) | The companion to `two-prisma-clients`: a recipe for the Prisma `$extends` pattern itself. The atal-incubation file is dense; the kit needs a focused version. |
| G13 | `versioned-spec-amendment` | `lib/patterns/versioned-spec-amendment.md` | Jayshankar (`SPEC-AMENDMENT-v2.md`, merge-ready), atal-incubation (`specs/SPEC-v3.md` supersedes `specs/AICL_updated.md`), exam-forge (SPEC v1, v2 archive) | "A spec amendment is a separate file with the same section numbering and a clear merge path back to SPEC.md." The pattern is the merge-ready convention. |

### 2.2 prompts/ — current 1 (SPEC-AUTHOR), need ~6 more

| Gap # | Prompt name | Target file | Source projects | Why |
|---|---|---|---|---|
| G14 | `BUILDER-REVIEW-TEMPLATE` | `prompts/BUILDER-REVIEW-TEMPLATE.md` | exam-forge, atal-incubation, Jayshankar, Data-cleaning-script (all use the format) | "The template for a consumer's BUILDER-DECISIONS-REVIEW.md" — the kit's SPEC promises this file but it's not shipped. |
| G15 | `REVIEWER-REVIEW-TEMPLATE` | `prompts/REVIEWER-REVIEW-TEMPLATE.md` | exam-forge, atal-incubation, Jayshankar (the same format) | Same: the kit's SPEC promises this; not shipped. |
| G16 | `INTERVIEW-CHECKLIST` | `prompts/INTERVIEW-CHECKLIST.md` | the kit's own SPEC §2.1 promises this | "A one-page reference for the SPEC-AUTHOR prompt: 7 questions, A/B/C pass, what I guessed." |
| G17 | `SPEC-REVIEWER` | `prompts/SPEC-REVIEWER.md` | atal-incubation (the W1 SPEC-v3 review), Jayshankar (the Mode A review session) | "The reviewer session runs this prompt." Currently the kit promises `prompts/REVIEWER-REVIEW-TEMPLATE.md` but the *prompt* that runs the review (vs. the template it fills in) is missing. |
| G18 | `KITTING` | `prompts/KITTING.md` | the kit's own SPEC promises `docs/KITTING.md` (a how-to-add-a-new-pattern doc) | "When a contributor wants to add a new `lib/patterns/` entry, they run this prompt." Closes the evergrowing-project loop. |
| G19 | `RELEASE-CHECKLIST` | `prompts/RELEASE-CHECKLIST.md` | Data-cleaning-script (the v4 build-bundle + 6 decision disciplines), Jayshankar (the `private-to-public` pattern), atal-incubation (the "validate before deploy" gate) | "The prompt that runs at the end of Mode A, before shipping publicly." |

### 2.3 templates/ — current 7, need ~8 more

| Gap # | Template name | Target file | Source projects | Why |
|---|---|---|---|---|
| G20 | `HANDOVER.md` | `templates/HANDOVER.md` | atal-incubation (the canonical W-queue format), Jayshankar, Data-cleaning-script | The SPEC promises this template; it does not exist. |
| G21 | `AGENTS.md` | `templates/AGENTS.md` | atal-incubation, Jayshankar | Same: promised, not shipped. |
| G22 | `zod-schemas/money.zod.ts` | `templates/zod-schemas/money.zod.ts` | atal-incubation, Jayshankar | "The Zod schema for money. The regex `^\d+\.\d{2}$` is the contract." |
| G23 | `sql/rls-policies.sql` | `templates/sql/rls-policies.sql` | atal-incubation, Jayshankar | The idempotent RLS-enable migration. |
| G24 | `sql/audit-trigger.sql` | `templates/sql/audit-trigger.sql` | atal-incubation, Jayshankar | The append-only audit log trigger. |
| G25 | `eslint/no-float-money.js` | `templates/eslint/no-float-money.js` | atal-incubation (rule 5), Jayshankar (D7) | The ESLint rule that bans `Number()` and `parseFloat()` on money fields. |
| G26 | `.gitignore` | `templates/.gitignore` | all 5 projects | "The kit's recommended `.gitignore` (extends the npm default with `.env*`, `node_modules`, build outputs, log files)." |
| G27 | `sql/idempotent-migration-pattern.sql` | `templates/sql/idempotent-migration-pattern.sql` | Jayshankar, atal-incubation | A starter migration showing the idempotency patterns (IF NOT EXISTS, DROP TRIGGER IF EXISTS, ON CONFLICT DO NOTHING, DO block guards). |

### 2.4 lib/ (code modules) — current 0 modules, need 3 minimum

| Gap # | Module name | Target folder | Source | Why |
|---|---|---|---|---|
| G28 | `lib/no-backend` | `lib/no-backend/index.ts`, `lib/no-backend/README.md`, `lib/no-backend/tests/` | exam-forge | The kit's SPEC §2.3.1 promises this. The module is `useLocalState` + `clearLocalState` + `isLocalStorageAvailable`. |
| G29 | `lib/money-as-decimal` | `lib/money-as-decimal/index.ts`, `lib/money-as-decimal/README.md`, `lib/money-as-decimal/tests/` | atal-incubation, Jayshankar | The Zod schema + `formatINR` + `formatUSD` + `moneyFromNumber` + `moneyToNumber`. |
| G30 | `lib/tenant-rls` (the code) | `lib/tenant-rls/index.ts`, `lib/tenant-rls/withTenantTx.ts`, `lib/tenant-rls/rls-policies.sql`, `lib/tenant-rls/README.md`, `lib/tenant-rls/tests/` | atal-incubation | The two-Prisma-clients + `withTenantTx` primitive. |

The remaining 4 lib modules (audit-viewer, docs-guardian, pwa-config, auth-shell) are
deferred to a future kit release — the patterns (doc-only) cover their rationale
already.

### 2.5 scripts/ — current 2, need ~5 more

| Gap # | Script | Target file | Why |
|---|---|---|---|
| G31 | `migration-runner.mjs` | `scripts/migration-runner.mjs` | Apply SQL migrations in order, idempotent, track in `migrations_applied` table. |
| G32 | `decision-log.mjs` | `scripts/decision-log.mjs` | Append a decision to the consumer's `BUILDER-DECISIONS-REVIEW.md`. |
| G33 | `kit-coverage.mjs` | `scripts/kit-coverage.mjs` | Given a consumer SPEC.md, print which `lib/patterns/` entries apply. (Helps the consumer decide what to copy.) |
| G34 | `kit-listing.mjs` | `scripts/kit-listing.mjs` | List every pattern, prompt, schema, template, script. (Discovery — a "what's in the kit?" one-liner.) |
| G35 | `kit-new-pattern.mjs` | `scripts/kit-new-pattern.mjs` | Scaffold a new `lib/patterns/<name>.md` from the standard template. |

### 2.6 schemas/ — current 0, need 4

| Gap # | Schema | Target file | Why |
|---|---|---|---|
| G36 | `tins-markers.schema.json` | `schemas/tins-markers.schema.json` | Validate the `<!-- TINS -->` and `<!-- ZS: -->` block. |
| G37 | `locked-decisions.schema.json` | `schemas/locked-decisions.schema.json` | Validate the §0.2 table. |
| G38 | `handover.schema.json` | `schemas/handover.schema.json` | Validate the HANDOVER header (Last updated, Last worked on by, Queue position) + the W-item structure. |
| G39 | `tins-spec-minimal.schema.json` | `schemas/tins-spec-minimal.schema.json` | Validate the minimum viable SPEC.md shape (§0, §1, §2, §4, §8, §9). |

### 2.7 docs/ — current 0 files, need 3

| Gap # | Doc | Target file | Why |
|---|---|---|---|
| G40 | `WORKFLOW.md` | `docs/WORKFLOW.md` | "How a consumer uses the kit, end to end." |
| G41 | `LIBRARY-CONVENTIONS.md` | `docs/LIBRARY-CONVENTIONS.md` | "How to write a new `lib/` module." |
| G42 | `KITTING.md` | `docs/KITTING.md` | "How to add a new pattern to the kit." |

### 2.8 SPEC.md itself — needs updates

| Gap # | SPEC change | What |
|---|---|---|
| G43 | Add D17–D24 | 8 new locked decisions captured in this gap analysis: each new pattern gets a one-row entry in the §0.2 table. |
| G44 | Update §0.4 absorption table | The §0.4 table currently lists 7 patterns (the 7 from Jayshankar) plus the tin-kit pwa off the atal-incubation doc; the 13 new patterns need rows. |
| G45 | Update §2 (functionality) | Each new `lib/`, `prompts/`, `schemas/`, `templates/`, `scripts/` file needs a description in §2. |
| G46 | Update §4.1 architecture | The directory tree needs the new files. |
| G47 | Update §8 acceptance criteria | Each new file needs at least one §8 check. The current §8 has 12 sections; we'll go to ~20. |
| G48 | Update §9 out-of-scope | Add "auto-generated API client SDKs" and "a hosted docs site" (already implied but list explicitly). |

### 2.9 HANDOVER.md + AGENTS.md — need updates

| Gap # | Doc change | What |
|---|---|---|
| G49 | HANDOVER W2–W6 marked done | The "still in progress" tasks that are now done. |
| G50 | New W7+ work queue | What's next: code the 3 lib modules, write the runbooks, etc. |
| G51 | AGENTS "Built and working" updated | The kit is no longer "the spec and nothing else." |
| G52 | AGENTS reading list expanded | Add the 5 new file types (schemas, scripts, lib modules, templates) to the "Read these in this order" list. |
| G53 | New standing rules | E.g. "every new pattern must come with a §0 'Why this exists' + a worked example from a reference project + a validator check + a self-test case." |
| G54 | Ask-vs-try expanded | E.g. "always try: adding a new `lib/patterns/` entry following the KITTING.md template." |

### 2.10 BUILDER-DECISIONS-REVIEW.md — needs new entries

| Gap # | Decision | What |
|---|---|---|
| G55 | "Pull forward the 13 new patterns from the gap analysis" | A new entry documenting the gap-analysis-driven additions. |
| G56 | "Pull forward the 6 new prompts" | A new entry documenting the prompt additions. |
| G57 | "Pull forward the 8 new templates" | A new entry documenting the template additions. |
| G58 | "Pull forward the 3 lib code modules" | A new entry documenting the lib module adds. |
| G59 | "Pull forward the 5 new scripts" | A new entry documenting the script adds. |
| G60 | "Pull forward the 4 new schemas" | A new entry documenting the schema adds. |

---

## 3. The execution order (this session)

1. **Write the gap analysis** (this file). Done in this turn.
2. **Write the new lib/patterns/ files** (G01–G13) — 13 files.
3. **Write the new prompts/** files (G14–G19) — 6 files.
4. **Write the new templates/** files (G20–G27) — 8 files.
5. **Write the 3 lib code modules** (G28–G30) — code + README + tests.
6. **Write the new scripts/** files (G31–G35) — 5 files.
7. **Write the 4 schemas/** files (G36–G39) — JSON Schema.
8. **Write the 3 docs/** files (G40–G42).
9. **Update SPEC.md** (G43–G48) — D17–D24, §0.4 table, §2, §4.1, §8, §9.
10. **Update HANDOVER.md** (G49–G50) — mark W2–W6 done, add W7+.
11. **Update AGENTS.md** (G51–G54) — "built and working", reading list, rules, ask-vs-try.
12. **Update BUILDER-DECISIONS-REVIEW.md** (G55–G60) — 6 new decisions.
13. **Run validate.mjs + selftest.mjs** to make sure the kit still passes its own gate.

This is a large but bounded execution. Every line is a write the user asked for.

---

## 4. Out of scope for this session

The kit is **evergrowing** (per the user's request) — the gap analysis is the first
snapshot. Future sessions will run the `KITTING.md` workflow to add more patterns as
new consumer projects crystallise more lessons. The kit does not promise to be
exhaustive today; it promises the *loop* that grows it.

Specifically deferred:
- A web UI for the kit
- A hosted docs site
- A "TINS-certified" mark
- A VS Code linter
- The 4 deferred lib modules (`audit-viewer`, `docs-guardian`, `pwa-config`, `auth-shell`)
- Multi-language prompts (Hindi, Tamil)
- A migration path for projects built without the kit

These are out of scope per `tins-kit/SPEC.md` §9; the gap analysis does not re-open them.

---

*— End of gap analysis. Closing it here so the next LLM session can add new gaps as they
emerge without inheriting this session's mental model. The kit grows by gap analyses, not
by big-bang refactors.*
