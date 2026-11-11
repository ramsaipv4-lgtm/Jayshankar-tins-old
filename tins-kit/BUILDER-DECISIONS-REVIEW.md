# BUILDER-DECISIONS-REVIEW.md — the kit's own build decisions

> **The kit consumes its own methodology (D2).** This file applies the
> `templates/BUILDER-DECISIONS-REVIEW.md` format to the kit's own
> non-obvious build decisions. The format is self-referential by design:
> the kit's templates are the templates the kit uses.
>
> **Source:** tins-kit/SPEC.md D2 ("tins-kit consumes its own methodology").

---

## D1 — Pull forward `lib/patterns/supabase-auth-trigger.md` from W5 to "now"

**What changed.** Wrote `tins-kit/lib/patterns/supabase-auth-trigger.md` (~480 lines) — the canonical Supabase Auth + `public.users` wiring recipe, bundling 3 lessons crystallised in Jayshankar's W1.5 live apply. Updated `tins-kit/SPEC.md` (added `lib/patterns/` to the directory tree, added a row to the §0.4 absorption table). Updated `tins-kit/HANDOVER.md`.

**Why.** The 3 W1.5 decisions (FK drop, trigger meta-data, GRANT service_role) are too valuable to leave in a consumer's BUILDER-DECISIONS-REVIEW.md where only that consumer's next session will read them.

**Impact on downstream.** Future TINS consumers on Supabase ship with the 3 fixes pre-applied.

**Cross-references:** SPEC.md §0.4, lib/patterns/supabase-auth-trigger.md.

## D2 — Pull forward W2 templates: BUILDER/REVIEWER-DECISIONS-REVIEW, TRAININGS

**What changed.** Wrote 3 templates under `tins-kit/templates/`. Also wrote this file — the kit's first self-application of its own templates.

**Why.** The user asked "is recording lessons learned a pattern that's already in tins-kit project creation?" The honest answer was: partially. Pulling the templates forward from W2 to "now" crystallises the pattern while the lessons are fresh.

**Cross-references:** SPEC.md §2.5, templates/BUILDER-DECISIONS-REVIEW.md.

## D3 — Add the 2 lesson-recording validator checks to Jayshankar's `validate.mjs` (not the kit's)

**What changed.** The kit's `validate.mjs` is SPEC-focused. The 2 new checks were added to Jayshankar's `validate.mjs` (the consumer's validator), not the kit's.

**Why not in the kit's validator.** A check that looks for `BUILDER-DECISIONS-REVIEW.md` in some consumer directory is out of scope for the kit's structural validator.

**Cross-references:** SPEC.md §0.2 D3, scripts/validate.mjs.

## D4 — Pull forward `lib/patterns/postgres-mutations.md` (SECURITY DEFINER pattern)

**What changed.** Wrote `tins-kit/lib/patterns/postgres-mutations.md` (~310 lines).

**Why.** The transfer form was the first user action that touched 2 tables with different RLS policies. The function approach is the only one that gives race-condition safety AND RLS bypass AND a clean error message.

**Cross-references:** SPEC.md §0.4, lib/patterns/postgres-mutations.md, Jayshankar decision 23.

## D5 — Pull forward `lib/patterns/client-side-aggregation.md` (JS-first heuristic)

**What changed.** Wrote `tins-kit/lib/patterns/client-side-aggregation.md` (~190 lines).

**Why.** A heuristic for "do this aggregation in JavaScript or in a Postgres view?" with a worked example (Jayshankar's `StockBySku`).

**Cross-references:** SPEC.md §0.4, lib/patterns/client-side-aggregation.md, Jayshankar decision 24.

## D6 — Pull forward `lib/patterns/pwa-offline-graceful.md` (3-layer offline)

**What changed.** Wrote `tins-kit/lib/patterns/pwa-offline-graceful.md` (~260 lines).

**Why.** PWA offline degradation is common to many TINS consumers.

**Cross-references:** SPEC.md §0.4, lib/patterns/pwa-offline-graceful.md, Jayshankar decisions 26, 27.

## D7 — Pull forward `lib/patterns/empty-states.md` (3-tier rubric)

**What changed.** Wrote `tins-kit/lib/patterns/empty-states.md` (~190 lines).

**Why.** A 3-tier rubric for empty states: action / hint / message. Worked example: Jayshankar's three empty states.

**Cross-references:** SPEC.md §0.4, lib/patterns/empty-states.md, Jayshankar decision 28.

## D8 — Add Lesson 4 to `supabase-auth-trigger.md` (the `authenticated` GRANT)

**What changed.** Updated `tins-kit/lib/patterns/supabase-auth-trigger.md` to add a 4th lesson: `authenticated` ALSO needs explicit GRANTs on `public.*`.

**Why.** The first time the browser called `supabase.from('skus').select('*')`, the request returned `SQLSTATE 42501`. The RLS layer is downstream of the GRANT layer; without the GRANT, RLS is moot.

**Cross-references:** Jayshankar decision 16, lib/patterns/supabase-auth-trigger.md.

## D9 — Add `lib/patterns/private-to-public.md` (shipping a TINS workspace)

**What changed.** Wrote `tins-kit/lib/patterns/private-to-public.md` (~480 lines, 9 sections) — the canonical workflow for producing a public-ready sibling folder from a private working copy. Bundles 5 lessons from the Jayshankar Mode A release on 2026-08-13.

**Why.** The first TINS consumer to reach "ship publicly" — the consumer's working copy had AGENTS.md, HANDOVER.md, SPEC.md, tins-kit/, archive/, plus probe scripts and a v0.dev reference zip, none of which belong in a public repo. The first attempt took ~2 hours. The pattern is the checklist that didn't exist.

**Cross-references:** SPEC.md §0.4, lib/patterns/private-to-public.md, Jayshankar Mode A.

## D10 — Pull forward the 13 new patterns from the gap analysis (G01–G13)

**What changed.** Wrote 13 new `lib/patterns/<name>.md` files, all bundling 2+ lessons from 2+ reference projects, with the 4-section structure (D19) and the canonical footer:
- `two-prisma-clients.md` (G01) — multi-tenant Postgres isolation via two Prisma clients + `withTenantTx` + `app.current_tenant`. Source: atal-incubation.
- `cross-tenant-404.md` (G02) — return 404, never 403, when a resource exists in another tenant. Source: atal-incubation HANDOVER §9.
- `outbox-job-queue.md` (G03) — decouple email/webhook/cron from request handling. Source: atal-incubation NotificationOutbox + JobQueue + CronLog.
- `append-only-audit-log.md` (G04) — every mutation writes via a SECURITY DEFINER trigger; no UPDATE/DELETE policy. Source: atal-incubation + Jayshankar.
- `multi-tenant-rls.md` (G05) — architect's-eye view of tenant RLS (companion to `two-prisma-clients.md`).
- `fifo-cascade-algorithm.md` (G06) — numbered procedure + JS fixture + selftest for FIFO algorithms. Source: Jayshankar + atal-incubation.
- `shortfall-pattern.md` (G07) — never fail silently; return `{ result, shortfall, warnings }`. Source: Jayshankar + Data-cleaning-script.
- `idempotent-migrations.md` (G08) — 6 primitives every migration must use. Source: Jayshankar + atal-incubation.
- `pinned-deps.md` (G09) — exact versions in `package.json`, `.gitignore` for generated, manifest-in-lockstep. Source: atal-incubation + Data-cleaning-script.
- `observability-first.md` (G10) — liveness/readiness split + 5 must-have alerts + 5 runbooks + per-tenant metric labels. Source: atal-incubation.
- `env-vs-config.md` (G11) — 3 env files, compose vs. app env, build-time vs. runtime. Source: atal-incubation + Data-cleaning-script.
- `prisma-extensions-rls.md` (G12) — the `$extends` + AsyncLocalStorage recipe. Source: atal-incubation.
- `versioned-spec-amendment.md` (G13) — merge-ready amendment file convention. Source: Jayshankar SPEC-AMENDMENT-v2.md + atal-incubation SPEC-v3 supersedes AICL_updated.md.

**Why.** The 5 reference projects (exam-forge, Jayshankar, atal-incubation, Data-cleaning-script, package5) crystallised 60 patterns that recur in 2+ projects but were not in the kit. The gap analysis (`docs/GAP-ANALYSIS.md`) is the live record. This is the evergrowing loop (D17) in action.

**Impact on downstream.** Any TINS consumer can `cp -r lib/patterns/<name>.md src/lib/patterns/` and follow the recipe. The kit's `scripts/kit-coverage.mjs` automatically recommends which patterns apply to a given consumer's SPEC.md.

**Cross-references:** SPEC.md §0.4 (13 new rows), §0.2 D17–D19 (the decisions), §2.3 (the patterns section), §4.1 (the directory tree), §8.13 (the acceptance criteria), docs/GAP-ANALYSIS.md (the source).

## D11 — Pull forward the 6 new prompts (G14–G19)

**What changed.** Wrote 6 new `prompts/<name>.md` files, all complete paste-into-fresh-session prompts (D4):
- `BUILDER-REVIEW-TEMPLATE.md` (G14) — the consumer's `BUILDER-DECISIONS-REVIEW.md` template, with worked example D1.
- `REVIEWER-REVIEW-TEMPLATE.md` (G15) — the consumer's `REVIEWER-DECISIONS-REVIEW.md` template, with worked example R1.
- `INTERVIEW-CHECKLIST.md` (G16) — the one-page reference for `SPEC-AUTHOR.md`'s 7 questions + A/B/C pass + §0.3 "what I guessed".
- `SPEC-REVIEWER.md` (G17) — the prompt a separate reviewer session runs against a frozen-for-v1 SPEC.md (6 review passes).
- `KITTING.md` (G18) — the machine-facing workflow for adding a new pattern to the kit (9 steps).
- `RELEASE-CHECKLIST.md` (G19) — the pre-deploy gate (8 sections: typecheck/build/test, smoke test, 5-min soak, private-to-public, docs, security, observability, backout).

**Why.** The kit's SPEC §2.1 promised these prompts but they weren't shipped. The gap analysis identified the gap; this decision closes it.

**Impact on downstream.** Every TINS consumer gets a complete prompt library. The `SPEC-REVIEWER` prompt is the discipline that prevents "writer's bias" (a separate session reviews the spec).

**Cross-references:** SPEC.md §0.2 D4 (paste-into-session format), §2.1 (the prompts layer), §8.7 + §8.15 (the acceptance criteria), docs/WORKFLOW.md (where the prompts fit in the consumer flow).

## D12 — Pull forward the 8 new templates (G20–G27)

**What changed.** Wrote 8 new files under `templates/`:
- `HANDOVER.md` (G20) — the consumer's HANDOVER work system (W-queue + state snapshot + gotchas + protocol).
- `AGENTS.md` (G21) — the consumer's 1-page LLM onboarding (60-second orientation + reading list + standing rules + ask-vs-try).
- `zod-schemas/money.zod.ts` (G22) — the Zod schema for money, with the `MONEY_REGEX = /^\d+\.\d{2}$/` contract.
- `sql/rls-policies.sql` (G23) — the idempotent RLS-enable migration (now in templates/, not lib/).
- `sql/audit-trigger.sql` (G24) — the append-only audit log trigger, idempotent.
- `eslint/no-float-money.js` (G25) — the ESLint rule that bans `Number()` and `parseFloat()` on money fields.
- `.gitignore` (G26) — the kit's recommended `.gitignore` (9 must-ignore categories).
- `sql/idempotent-migration-pattern.sql` (G27) — a starter migration showing the 6 idempotency primitives.

**Why.** The SPEC §2.5 promised these templates; the gap analysis identified the gap. The consumer retro-fit (W7) needs every template present and non-empty.

**Impact on downstream.** Consumers copy the templates, fill in the project-specific values, and have a complete TINS workspace on day 1.

**Cross-references:** SPEC.md §2.5 (the templates layer), §8.6 + §8.16 (the acceptance criteria), docs/WORKFLOW.md §4.

## D13 — Pull forward the 3 lib code modules (G28–G30)

**What changed.** Wrote 3 new `lib/<name>/` modules, each with `index.ts` + `README.md` + `tests/<name>.test.ts` (D20):
- `lib/no-backend/` (G28) — `useLocalState` + `clearLocalState` + `isLocalStorageAvailable` + `LocalStateError`. 5 source files, 7 test cases. Source: exam-forge + Jayshankar.
- `lib/money-as-decimal/` (G29) — Zod schema + `fromString` / `toString` / `format` / `sum` / `subtract` / `multiply` / `divide` / `equals` / `gt` / `lt` + `ZERO`. 1 source file, 8 test cases including the load-bearing "0.1 + 0.2 === 0.3" test. Source: atal-incubation + Jayshankar.
- `lib/tenant-rls/` (G30) — `basePrisma` + `restrictedPrisma` + `getPrismaClient` + `withTenantTx` + `tenantTxStorage`. 1 source file, 3 test cases. Source: atal-incubation.

**Why.** The SPEC §2.3 promised the modules; the gap analysis identified the gap. The 4 deferred modules (audit-viewer, docs-guardian, pwa-config, auth-shell) are documented in SPEC §9.

**Impact on downstream.** Consumers `cp -r lib/<name>/ src/lib/<name>/` and have a tested, documented drop-in. The `tenant-rls` module is the most consequential: it ships the two-Prisma-clients + AsyncLocalStorage + `withTenantTx` primitive, the `TENANT_SCOPED` set, and the rules (no `basePrisma` outside the approved list, always wrap `restrictedPrisma` in `withTenantTx`, keep `TENANT_SCOPED` in sync).

**Cross-references:** SPEC.md §2.3 (the lib layer), §8.14 (the acceptance criteria), docs/LIBRARY-CONVENTIONS.md (the conventions).

## D14 — Pull forward the 5 new scripts (G31–G35)

**What changed.** Wrote 5 new `scripts/<name>.mjs` files, all zero-dep Node ESM (D3) except `migration-runner.mjs` (which uses `pg`):
- `migration-runner.mjs` (G31) — apply SQL migrations in order, idempotent, track in `migrations_applied` table. Supports `--dry-run`, `--check`, `--dir=<path>`. Source: Jayshankar supabase CLI + atal-incubation prisma migrate.
- `decision-log.mjs` (G32) — append a date-stamped decision to `BUILDER-DECISIONS-REVIEW.md` or `REVIEWER-DECISIONS-REVIEW.md`. Source: atal-incubation `scripts/decision-log.mjs` (already existed, promoted to first-class).
- `kit-coverage.mjs` (G33) — given a consumer's `SPEC.md`, print which `lib/patterns/` entries are likely to apply (keyword-based classifier). Source: new.
- `kit-listing.mjs` (G34) — list every pattern / prompt / schema / template / script / lib module / doc. Supports `--json` and `--kind=<name>`. Source: new.
- `kit-new-pattern.mjs` (G35) — scaffold a new `lib/patterns/<name>.md` from the canonical 4-section template. Source: new. Closes the evergrowing-project loop (D17).

**Why.** The SPEC §2.4 promised these scripts; the gap analysis identified the gap.

**Impact on downstream.** The `migration-runner.mjs` is the consumer's CI gate for SQL changes. The `decision-log.mjs` is the consumer's discipline for recording decisions. The `kit-coverage.mjs` + `kit-listing.mjs` + `kit-new-pattern.mjs` are the kit's self-maintenance tools.

**Cross-references:** SPEC.md §2.4 (the scripts layer), §8.17 (the acceptance criteria), docs/KITTING.md §5–6 (where kit-new-pattern.mjs fits).

## D15 — Pull forward the 4 new schemas (G36–G39)

**What changed.** Wrote 4 new `schemas/<name>.schema.json` files, all valid JSON Schema 2020-12:
- `tins-markers.schema.json` (G36) — validates the `<!-- TINS -->` and `<!-- ZS: -->` block.
- `locked-decisions.schema.json` (G37) — validates the §0.2 table structure.
- `handover.schema.json` (G38) — validates the HANDOVER header + W-item structure.
- `tins-spec-minimal.schema.json` (G39) — validates the minimum viable SPEC.md shape (§0, §1, §2, §4, §8, §9).

**Why.** The SPEC §2.2 promised these schemas; the gap analysis identified the gap. The schemas are for static artefacts only (D6, D22); runtime input validation is the consumer's responsibility (Zod, Valibot, etc.).

**Impact on downstream.** Consumers can use `ajv` to lint "is this a valid TINS file?" without writing their own parser.

**Cross-references:** SPEC.md §2.2 (the schemas layer), §8.18 (the acceptance criteria).

## D16 — Close the deferral gap: ship all 4 deferred `lib/` modules + scaffolder + CI

**What changed.** Session 6 had inherited the "defer the 4 lib modules" decision from
the original SPEC §2.3 and the gap analysis's G28–G30 list, and propagated it forward
without challenging it. Session 7 closed the gap:

- **`lib/audit-viewer/`** (~4.2 KB index, 13 test cases): `AuditLogEntry` type +
  `applyFilter` + `paginate` + `diffRows` + `renderAuditViewer` (the pure-TS render
  function the framework adapter layer wires up). Source:
  atal-incubation/incubos/src/components/AuditLogTable.tsx.
- **`lib/docs-guardian/`** (~4.6 KB index, 11 test cases): `DocArea` (13 controlled-
  vocabulary areas), `DocMap`, `loadDocMap`, `checkDocFreshness`, `countReferences`.
  Source: atal-incubation/incubos/docs/DOC-MAP.md + scripts/docs-guardian.mjs.
- **`lib/pwa-config/`** (~6.5 KB index, 8 test cases): `withPwa` (Vite plugin
  wrapper) + `useOnlineStatus` (React hook, SSR-safe) + `<OfflineBanner />` (React
  component with `data-testid="is-offline"`). Source: Jayshankar's
  src/lib/online.ts + src/components/OfflineBanner.tsx.
- **`lib/auth-shell/`** (~7.5 KB index, 11 test cases): `Session` + `ROLES`
  (8-role controlled vocabulary) + `setSessionProvider` (the wire-up) + `useSession` +
  `getServerSession` + `requireRole` (API guard) + `<RoleGate>` (UI gate) +
  `handleFirstUserIsAdmin`. Source: Jayshankar's src/lib/auth.ts.
- **`scripts/new-project.mjs`** (~9.7 KB): the scaffolder. `node scripts/new-project.mjs
  my-saas --with=tenant-rls,money-as-decimal` creates a sibling directory with all
  templates + the chosen modules + scripts + schemas + prompts + lib/patterns + the
  CI workflow + a starter package.json + a starter tsconfig.json. Zero-dep.
- **`scripts/docs-guardian.mjs`** (~7.6 KB): the CLI wrapper around `lib/docs-guardian/`
  that reads `docs/DOC-MAP.md`, scans source + docs, reports freshness, exits
  non-zero on fail.
- **`.github/workflows/validate.yml`**: CI that runs `node scripts/validate.mjs --all`
  + `node --test scripts/selftest.mjs` on every push and PR.

**Why.** The user pointed out (rightly) that "deferred to a future kit release" is
leaving the kit half-built. The references existed (atal-incubation has the full
audit-viewer + docs-guardian; Jayshankar has the PWA + auth code; exam-forge has the
scaffolder approach). I had the material; I just didn't apply it. The user's
constraint was "kit it out properly" — that means shipping, not deferring.

**Impact on downstream.** Kit is now fully shipped. Zero deferred items. The 11-check
inventory gate (validator §8.13–§8.20) is green. Consumers can `cp -r lib/<name>/`
for any of the 7 modules and have a tested, documented drop-in.

**Cross-references:** SPEC.md §2.3 (the lib layer, no longer deferred), §8.14d–§8.14f
(the acceptance criteria for the 7 modules + scaffolder + CI), §9 (the out-of-scope
list, the deferred items removed), HANDOVER.md §5 (W5, W6, W9 marked ✅ done),
AGENTS.md §0 ("Built and working" updated to 7 lib modules).

## D17 — Close the auto-extraction half of the bidirectional loop (D17 fully realised)

**What changed.** Session 6 had established D17 ("the kit is evergrowing, not
exhaustive") and shipped the *manual* KITTING workflow (`prompts/KITTING.md` +
`scripts/kit-new-pattern.mjs`). But the *extraction* half was missing: a consumer
that crystallised a new pattern had to have a human (or LLM) read its
BUILDER-DECISIONS-REVIEW and decide which decisions were kit-worthy. Session 8
shipped:

- **`scripts/kit-extract.mjs`** (~13 KB): the heuristic classifier. Reads a
  consumer's `BUILDER-DECISIONS-REVIEW.md` + `lib/patterns/` + `lib/`, scores
  each decision 0-7 (title keywords +2, body substance +1 each, lesson/anti-pattern
  keywords +1, worked example +2, project-specific penalty -3, deferred/rejected
  penalty -2, novel bonus +1), and produces a `kit-growth-candidates.md` report
  with the triage template. Exits 0 if no candidates, 1 if there are — so a CI
  step can trigger the kit-growth session.
- **`prompts/KITTING-REVIEW.md`** (~6 KB): the triage prompt a fresh LLM
  session runs. 3-question rubric (generalises? worked example? duplicates
  existing pattern?), accept/reject/defer per candidate, then for each accepted
  one runs the KITTING workflow.
- **`lib/patterns/kit-self-application.md`** (~9 KB): the canonical pattern for
  the loop end-to-end. Documents the 2-consumer rule, the heuristic
  classifier, and the 3 known anti-patterns (in-place editing of the kit,
  skipping the decision log, auto-extracting from 1 consumer).
- **`docs/WORKFLOW.md`**: updated with the full bidirectional loop end-to-end
  (Kit → Consumer → Kit), with the worked example being the kit's own growth
  across sessions 1, 6, 7, 8.

**Why.** The user pointed out (rightly) that the kit had a one-way loop: it
could scaffold a new consumer, but the consumer's learnings had no automated
path back to the kit. Without the auto-extraction, the kit would stay frozen
at the patterns from session 6; the third consumer would repeat the same
mistakes the first two had already made and documented. With the auto-extraction,
the kit grows by 5-10 patterns per consumer session, and the third consumer
is dramatically better-served than the first.

**Impact on downstream.** The kit's loop is now closed. The next consumer that
finishes Mode A + records its decisions will trigger `kit-extract.mjs` (the
exits-1 design means CI can flag "growth candidates available") and the
kit-growth session will triage the report. The kit's pattern count will grow
organically as more consumers adopt it.

**Cross-references:** SPEC.md §0.2 D17 (now fully realised), §2.1 (the
prompts layer, KITTING-REVIEW.md added), §2.4 (the scripts layer,
kit-extract.mjs added), §2.3 (the lib patterns, kit-self-application.md
added), §4.3 (the consume-the-kit flow), HANDOVER.md §5 (this is session 8's
deliverable), docs/WORKFLOW.md (the full loop documented).

## D18 — Restructure the workspace: lift the kit to top-level, extract the 5 projects to siblings, vendor the kit into each, ship the methodology + sync machinery

**What changed.** Session 9 (2026-08-15) executed the user's request:
"separate the projects into separate folders, include tins-kit in each,
and a new LLM session from any project can update the kit when there's
progress."

**The restructure:**

1. **Lifted `tins-kit/` to top-level.** Was at
   `C:\Users\user\Desktop\TINS-projects\atal-incubation\Jayshankar\tins-kit\`;
   now at `C:\Users\user\Desktop\TINS-projects\atal-incubation\tins-kit\`.
2. **Extracted the 5 reference projects to siblings of the kit:**
   - `Jayshankar/` (stays; was the parent of `tins-kit/`)
   - `incubos/` (stays; was the atal-incubation app)
   - `Data-cleaning-script/` (lifted from `Jayshankar/Data-cleaning-script/`)
   - `package5/` (lifted from `Jayshankar/package5/`)
   - `exam-forge/` (extracted from `Jayshankar/archive/exam-forge-reference/`)
3. **Vendored the kit into each project** (105 files × 5 projects =
   525 vendored files; each project has `<project>/tins-kit/`).
4. **Wrote the 4 new top-level files:**
   - `PIPELINE.md` (~9.5 KB): the 7-step methodology the LLM absolutely
     follows. Universal — applies at kit root AND at consumer root.
   - `VERSIONING.md` (~13 KB): the version control strategy. The 7
     rules (top-level is source of truth, vendored is read-only for the
     kit, kit-sync.mjs is the workhorse, kit-extract.mjs is the pull-back,
     filesystem-versioned, etc.). The 3 worked examples. The 4 edge cases.
   - `scripts/kit-sync.mjs` (~6.4 KB): the workhorse. Idempotent. SHA-256
     diffing. Additive + update (preserves project-added files). Writes
     a `.kit-sync.json` marker for "when was this last synced."
   - `templates/PROJECT-AGENT-BRIEF.md` (~5.7 KB): the per-project
     "absolutely must follow" template.
5. **Generated per-project `AGENT-BRIEF.md`** for all 5 projects. Each
   one says "you are at PROJECT-X; here's the project-specific stuff; the
   methodology is in `./tins-kit/PIPELINE.md`; the kit's growth is in
   `./tins-kit/HANDOVER.md`; the version control is in `./tins-kit/VERSIONING.md`."
6. **Synced all 5 projects** to pick up the new files (4 per project:
   PIPELINE.md, VERSIONING.md, HANDOVER.md, kit-sync.mjs).

**Why.** The kit had the auto-extraction loop (D17) but it was only
usable from the kit root. The user pointed out (rightly) that any LLM
working at a consumer project root should be able to mine its learnings
back to the kit. That requires:
- The kit to be physically present at the consumer root (so the
  consumer can run `node tins-kit/scripts/...`).
- The methodology to be a single, sharp doc the LLM reads first
  (PIPELINE.md replaces the longer WORKFLOW.md for the "what do I do?"
  question).
- The version control strategy to be explicit (VERSIONING.md, with
  the 7 rules, the kit-sync.mjs script, the worked example).
- The per-project brief to be a 1-page starter (AGENT-BRIEF.md), not a
  long AGENTS.md that no one reads.

**Impact on downstream.** The kit's loop is now project-aware. A new
LLM session at any of the 5 consumer projects can:
1. Read `./tins-kit/PIPELINE.md` (universal methodology).
2. Read `./AGENT-BRIEF.md` (project-specific).
3. Build + record decisions.
4. Run `node tins-kit/scripts/kit-extract.mjs --consumer=.` to produce
   the growth candidates.
5. The kit-growth session at the kit root accepts the candidates and
   runs `node scripts/kit-sync.mjs --to=<project>` to push the new kit.

The new 6th project (a future domain) scaffolds with
`node tins-kit/scripts/new-project.mjs <name> --with=<modules>` and gets
the vendored kit on day 1.

**Cross-references:** SPEC.md §0.2 D25 (the workspace structure decision),
§2 (the new PIPELINE.md, VERSIONING.md, kit-sync.mjs, PROJECT-AGENT-BRIEF.md),
§8.22 (the §8 acceptance criteria for the methodology + version control),
HANDOVER.md (session 9 deliverable), BUILDER-DECISIONS-REVIEW.md (this entry),
the 5 per-project `AGENT-BRIEF.md` files at the project roots.

## D19 — Close the staging-area gap: kit-staging/ inbox + portable kit shell + 2 generic prompts (D26 realised)

**What changed.** Session 10 (2026-08-15) shipped the third leg of the
bidirectional loop that D17 + D18 set up but didn't finish: the
**transport layer** for projects that aren't adjacent to the kit
(different machine, future project, project the kit doesn't know about
yet, project that predates the kit).

- **`kit-staging/`** (new top-level dir): the inbox. `kit-staging/README.md`
  documents the 4-thing-can-be-dropped table (BUILDER-DECISIONS-REVIEW.md /
  kit-growth-candidates.md / lib/patterns / lib/<module> / prompts), the
  flow diagram, the inbox lifecycle, and why a staging area (not direct
  sync). `kit-staging/inbox/` and `kit-staging/archive/` are self-cleaning.
- **`scripts/kit-ingest.mjs`** (~12.9 KB): the inbox scanner. Reads every
  `<project>/BUILDER-DECISIONS-REVIEW.md` in the inbox, re-runs the
  `kit-extract.mjs` heuristic on each, and produces a merged triage
  report at `kit-staging/triage-<date>.md`. Exits 0 if no candidates,
  1 if there are. `--archive` moves the consumed entries to
  `kit-staging/archive/<date>/`. Zero-dep.
- **`scripts/kit-new-project-shell.mjs`** (~12 KB): the portable kit
  shell scaffolder. Produces a `.kit-shell/` directory (~10 files,
  ~50 KB) containing the minimum kit: `decision-log.mjs`,
  `kit-extract.mjs`, `kit-staging-export.mjs`, the 3 prompts
  (SPEC-AUTHOR, INTERVIEW-CHECKLIST, BUILDER-REVIEW-TEMPLATE), the
  templates (HANDOVER, BUILDER-DECISIONS-REVIEW, SPEC), and the
  `.kit-shell.json` marker. The shell ships with the project; the user
  copies the whole project (or just `.kit-shell/`) to a different
  machine. Zero-dep.
- **`scripts/kit-staging-export.mjs`** (~7.1 KB): the consumer-side
  dump helper. Bundles the consumer's `BUILDER-DECISIONS-REVIEW.md`
  + `kit-growth-candidates.md` + any `lib/patterns/*.md` + any
  `lib/<module>/` + any `prompts/*.md` + the `.kit-shell.json` marker
  into a single `.tar.gz` (POSIX) or `.zip` (Windows) file. The user
  copies that file to the kit machine and extracts it into
  `kit-staging/inbox/<project-name>/`. Zero-dep.
- **`prompts/NEW-PROJECT.md`** (~7.7 KB): the 7-step generic
  copy-paste prompt for starting a TINS project in any directory on
  any machine. The LLM reads the kit shell, runs the interview
  (SPEC-AUTHOR.md), drafts the spec, builds the project, records
  decisions, mines the learnings, and ships a tarball back. The
  5 commands to memorise: pwd, decision-log, kit-extract,
  kit-staging-export, validate.
- **`prompts/KIT-GROWTH-SESSION.md`** (~8.7 KB): the 8-step generic
  copy-paste prompt for triaging the inbox at the kit root. The LLM
  runs `kit-ingest.mjs`, triages each candidate via
  `KITTING-REVIEW.md`'s 3-question rubric (generalises? worked example?
  duplicates existing?), runs the KITTING workflow for each accepted
  candidate, syncs the new kit to every project via `kit-sync.mjs`,
  and archives the inbox. The 2-consumer rule is enforced.
- **Validator §8.23** (8 new checks): the validator now checks
  `kit-staging/README.md` is present + non-trivial, the inbox and
  archive dirs exist, the 2 new scripts are present, and the 2 new
  prompts are present + non-trivial.

**Why.** The user pointed out (rightly) that the kit's loop, while
project-aware (D18), still assumed the consumer was a sibling of the
kit (`../<project>/`). That doesn't work for:
- A project on a **different machine** (the user has a laptop + a server).
- A **future project** (one the user hasn't scaffolded yet but wants to
  start with the kit's discipline).
- A **project the kit doesn't know about yet** (a friend sent a tarball).
- A **project that predates the kit** (a working app the user wants to
  bring into the growth loop retroactively).

The staging area is the solution. It's the inbox any project, anywhere,
can drop its kit-worthy artefacts into. The portable kit shell is the
minimum kit a project needs to participate in the loop without
installing the full kit. The 2 generic prompts are the LLM-facing
workflows that make the participation drop-in.

**Impact on downstream.** The kit's loop is now machine-agnostic. A
fresh LLM session, on any machine, with just the kit shell + the
NEW-PROJECT prompt, can start a TINS project from scratch, build it,
record decisions, mine learnings, and ship them back to the kit
machine via a single tarball. The next kit-growth session at the kit
root triages the tarball and adds the keepers. The kit grows by
N patterns per remote project. The 2-consumer rule still holds (a
remote project is still 1 consumer; the second observation may come
later from a different remote project).

**Cross-references:** SPEC.md §0.2 D26 (the staging-area decision,
locked this session), §8.23 (the new acceptance criteria, 8 checks
across the staging area + the 2 new scripts + the 2 new prompts),
`kit-staging/README.md` (the transport-layer spec), `prompts/NEW-PROJECT.md`
(the 7-step generic workflow), `prompts/KIT-GROWTH-SESSION.md` (the
8-step generic workflow), the 3 new scripts (`kit-ingest.mjs`,
`kit-new-project-shell.mjs`, `kit-staging-export.mjs`), the
`PIPELINE.md` "Beyond the 7 steps" section (added this session),
the `VERSIONING.md` §7 "The transport layer" section (added this session).

## D20 — Close the 4-scenario matrix gap: INDEX + 2 new generic prompts (D27 realised)

**What changed.** Session 11 (2026-08-15) shipped the entry point + the
remaining 2 scenarios that the prior sessions didn't cover.

The user pointed out (rightly) that the kit had 2 generic prompts
(NEW-PROJECT for Scenario 1, KIT-GROWTH-SESSION for Scenario 4) but
was missing Scenarios 2 and 3, plus an INDEX so a fresh LLM could
"selectively choose which skill to take ... not reinvent the wheel."

- **`INDEX.md`** (~13.3 KB, the 1-page selective-chooser): 8 sections
  covering all 65+ kit assets with 1-line briefs each:
  1. **Patterns (21)**: when to use each architect recipe.
  2. **Lib code modules (7)**: when to use each drop-in code module.
  3. **Prompts (12)**: when to use each paste-into-session prompt,
     including a "The 4 generic prompts (the user-facing flow)"
     cross-reference that maps each prompt to its scenario.
  4. **Templates (12)**: when to use each TINS doc template.
  5. **Scripts (14)**: when to use each zero-dep Node ESM script.
  6. **Schemas (4)**: what each JSON Schema validates.
  7. **Docs (4)**: what each top-level doc covers.
  8. **Top-level files (8)**: INDEX, PIPELINE, VERSIONING, SPEC,
     HANDOVER, AGENTS, BUILDER-DECISIONS-REVIEW, kit-staging/README.

  Plus a "How to read the kit in 30 minutes" fast path, a "How to
  add a new asset to the kit" maintenance path, and a "When this
  file is wrong" rule (the INDEX is the source of truth for
  "what's in the kit"; if an asset is missing, the file is wrong).

- **`prompts/PROMOTE-TO-TINS.md`** (~10.6 KB, Scenario 2): the 7-step
  retro-fit workflow for taking an existing project (built WITHOUT
  the kit) and turning it into a TINS project. The 7 steps are
  confirm location → read the kit shell → read the existing project →
  interview the user (4 retro-fit questions) → draft SPEC.md
  (describing what IS) → run kit-coverage → create the kit's
  standard handover docs + extract decisions to BUILDER-DECISIONS-REVIEW
  → mine learnings + ship via kit-staging-export. The 4 retro-fit
  questions are different from the 7 greenfield questions because
  you're not asking "what do you want to build?" — you're asking
  "what does this project ALREADY do, and what kit value do you want
  to extract from it?"

- **`prompts/CONTINUE-TINS-PROJECT.md`** (~7.9 KB, Scenario 3): the
  6-step pickup workflow for picking up an existing TINS project
  and adding a new W. The 6 steps are confirm location → read
  the project shell → pick the right W (or run coverage) → interview
  the user (5 W questions) → spec first + code second + record decisions
  → mine learnings + leave the gate green. The 5 W questions are:
  what is the W? what's the user's pain? what does "done" look like?
  are there constraints? is this kit-worthy?

- **Validator §8.24** (3 new checks): `INDEX.md` is present and
  non-trivial, `PROMOTE-TO-TINS.md` is present and non-trivial,
  `CONTINUE-TINS-PROJECT.md` is present and non-trivial. The
  expectedPrompts list extended from 8 to 12 (4 generic + 8 other).
  The order array extended with the 3 new §8.24 IDs.

**Why.** The user pointed out (rightly) that:
1. A fresh LLM at a new project root, with only the kit vendored,
   has to "ls + cat" every file to know what's available. That's
   30+ minutes of exploration per session. With INDEX.md, the LLM
   can see the whole menu in 3 minutes and selectively pick.
2. The kit had 2 generic prompts but the user-facing flow has 4
   scenarios. Scenarios 2 and 3 (existing non-TINS project, existing
   TINS project) were unaddressed.
3. The user's stated constraint: "selectively choose which skill
   to take ... not reinvent the wheel" — the INDEX is the wheel
   catalogue, the 4 prompts are the workflows.

**Impact on downstream.** The kit now has complete scenario coverage.
Every consumer LLM session can pick one of 4 prompts based on which
scenario it's in:
- New project from scratch → NEW-PROJECT
- Existing non-TINS project → PROMOTE-TO-TINS
- Existing TINS project → CONTINUE-TINS-PROJECT
- At the kit root, triaging the inbox → KIT-GROWTH-SESSION

The INDEX is the entry point: a fresh LLM reads INDEX first (3 min),
picks a prompt, runs it, and gets to work in 30 min instead of 60+.

**Cross-references:** SPEC.md §0.2 D27 (the 4-scenario matrix
decision, locked this session), §8.24 (3 new acceptance criteria:
§8.24a INDEX, §8.24b PROMOTE-TO-TINS, §8.24c CONTINUE-TINS-PROJECT),
`INDEX.md` (the selective-chooser, 8 sections), `prompts/PROMOTE-TO-TINS.md`
(Scenario 2, 7-step retro-fit), `prompts/CONTINUE-TINS-PROJECT.md`
(Scenario 3, 6-step pickup), `prompts/NEW-PROJECT.md` (Scenario 1,
already existed), `prompts/KIT-GROWTH-SESSION.md` (Scenario 4, already
existed), `scripts/validate.mjs` (3 new checks + extended expectedPrompts
list), `PIPELINE.md` (the 4 prompts are referenced in "Beyond the 7
steps"), `VERSIONING.md` (the 4 prompts are part of the staging
transport's version control).

## D21 — Fix 3 verified bugs in the bidirectional loop, found while running it for real against a genuine remote consumer (`text-extractor-from-html`)

**What changed.** A remote consumer project (`text-extractor-from-html`, on a different
machine — a cloud sandbox, not a sibling of this workspace) ran the full staging-area flow
for real for the first time: hand-assembled a `.kit-shell/`, ran `kit-staging-export.mjs`,
dropped the bundle in `kit-staging/inbox/text-extractor-from-html/`, and ran `kit-ingest.mjs`.
This surfaced 3 real, reproducible bugs, each verified by running the actual script (not by
reading the source and guessing):

1. **`scripts/kit-extract.mjs`'s `parseDecisions()` didn't match
   `templates/BUILDER-DECISIONS-REVIEW.md`'s own documented format.** The template's "Format"
   section and worked example (D8 in that file) specify `### Decision N — Title` (level-3
   heading, "Decision N" prefix) with `**What changed.**`/`**Why.**` (or any free-form label)/
   `**Impact on downstream.**`/optional `**Kit-level implication**` fields. But the parser only
   split on `\n##\s+` (level-2) and matched `/^(D?\d+)\s*[—\-:]\s*(.+)$/`, then looked for
   `**Context.**`/`**Decision.**`/`**Alternatives.**`/`**Consequences.**` — none of which the
   template ships. This directly violated **§8.21d** (locked): "Running `kit-extract.mjs`
   against a consumer with a BUILDER-DECISIONS-REVIEW.md produces ≥1 candidate per decision
   scoring ≥3." Verified before the fix: running the real script against
   `text-extractor-from-html`'s real (template-compliant, 12-entry) decision log produced
   **0 candidates**. Fixed `parseDecisions()` to accept both heading conventions (the kit's own
   `## D<N>` and the template's `### Decision N`), and added a positional field-extraction
   fallback (`extractPositionalFields()`) that reads bold-labelled paragraphs by *position*
   (first = "what changed," last-before-"impact on downstream" = the rationale, everything
   after "impact on downstream" = kit-level implication) rather than requiring exact field
   names — because the template's own worked example (D8) itself uses varying labels between
   "What changed." and "Impact on downstream." (e.g. "Why drop the FK.", "The fix."), not a
   single fixed "Why." label. Also added a `kitLevelImplication` field and a **+2** scoring
   bonus for its presence — the field exists precisely so the author can flag "this should be a
   kit pattern," and the scorer was ignoring that direct signal entirely.
2. **`scripts/kit-new-project-shell.mjs`'s `shellFiles` copy list omits `kit-staging-export.mjs`.**
   The script's own header comment *and* its generated `README.md` both instruct the user to
   run `node .kit-shell/scripts/kit-staging-export.mjs` as the final step, but the actual
   `shellFiles` array only copies `decision-log.mjs` and `kit-extract.mjs`. Directly violates
   **§8.23e** (locked): "scaffolds a portable `.kit-shell/` directory (~10 files, ~50 KB) that
   ships with the project" — a shell missing the one script its own instructions require isn't
   complete. Verified before the fix: scaffolded a fresh shell at `/tmp/shell-test`; its
   `.kit-shell/scripts/` had exactly 2 files. Fixed by adding the missing entry.
3. **`scripts/kit-staging-export.mjs`'s default output name is always `.zip`, even on POSIX,
   where the code always shells out to system `tar czf`.** Directly violates **§8.23f**
   (locked): "produces a tarball (zip on Windows, tar.gz on POSIX)" — the spec already says the
   correct behaviour; the code just didn't do it. Verified before the fix: ran the real script
   on this (Linux) sandbox, then ran `file`/`unzip -l` on the result — confirmed "gzip
   compressed data" content inside a file literally named `....zip`, which neither Windows
   Explorer nor `unzip` can open. Fixed the default extension to depend on `isWindows`, matching
   what the branch below it actually produces.

**Why.** All 3 bugs share a shape: each is a place where the code's actual behaviour diverged
from what this SPEC already locked down (§8.21d, §8.23e, §8.23f) and from what the kit's own
generated artefacts (the shipped template, the generated README.md) tell a consumer to expect —
and none of them were caught by `validate.mjs`/`selftest.mjs`, because those check `SPEC.md`
structure only, not the runtime behaviour of `kit-extract.mjs` / `kit-new-project-shell.mjs` /
`kit-staging-export.mjs`. The kit had never been run end-to-end, for real, from a genuine
different-machine consumer before this — every prior verification of the staging-area flow
(D19/D26) was structural (files exist, scripts accept the right flags), not behavioural (running
them against real consumer content and checking the output is actually right).

**Impact on downstream.** All 5 vendored copies (Jayshankar, incubos, Data-cleaning-script,
package5, exam-forge) should be re-synced (`kit-sync.mjs --to=<project>`) to pick up the fixed
scripts. Re-ran `kit-extract.mjs` against this kit's own `BUILDER-DECISIONS-REVIEW.md` after the
fix as a regression check: all 17 previously-found candidates still found (same set), plus 2 more
that now cross the ≥3 threshold thanks to the new kit-level-implication scoring bonus — no
candidates lost. `text-extractor-from-html`'s inbox entry now has a real, non-zero triage path;
its `kit-growth-candidates.md` (3 hand-authored candidates, all correctly marked `defer` per the
2-consumer rule) is still the primary artefact for that project until a fixed `kit-extract.mjs`
is re-run against it directly.

**Cross-references:** SPEC.md §8.21d/§8.23e/§8.23f (the acceptance criteria these fixes bring
the code into compliance with — no SPEC amendment needed, the SPEC was already correct),
`kit-staging/inbox/text-extractor-from-html/` (the real-world trigger for this decision),
`kit-staging/README.md` (the staging-area flow this exercised end-to-end for the first time).

## D22 — Frontend refresh (D28): shared design-vision interview, install-vs-recreate, two-fold sign-off

**Date:** 2026-08-21
**Status:** ✅ accepted
**Decided by:** <name>
**Cross-references:** SPEC.md D28, §2.1, §4.1, §8.25; prompts/FRONTEND-VISION-INTERVIEW.md; prompts/FRONTEND-REFRESH.md

**Context.** User asked to extend tins-kit so an already-built tins-kit website (any framework/language, frontend-only) can get its frontend refreshed using 5 named reference libraries (anime.js, motion, kokonut UI, bklit.com, shadcn), after a survey of the user's vision (researching inspiration sites if unsure). Full 7-question SPEC-AUTHOR interview + A/B/C pass run live, per D12/AGENTS.md R1 Spec-author role, since this is a change to the kit itself.

**Decision.** Shared interview prompts/FRONTEND-VISION-INTERVIEW.md, triggered from two places and never duplicated (D4): SPEC-AUTHOR.md Step 7a for new websites, FRONTEND-REFRESH.md Step 2 for existing ones. Per-library decision is install (npm/CLI) if the target stack matches, else recreate the visual pattern natively - never copy foreign-framework source wholesale. Rot check found kokonut-ui/bklit-ui/shadcn are React+Tailwind+shadcn-CLI copy-paste only (not general npm deps), anime.js/motion are framework-agnostic npm installs, and bklit.com specifically is a charts/data-viz library, not general design inspiration as first assumed. Correctness is two-fold and recorded in FRONTEND-VISION.md: approved_before (vision+inspiration signed off pre-build) and approved_after (backend/DB/3rd-party linkage verified post-build) - scoped to the project's CURRENT mode (A/B/C) at survey time, so a Mode A project is not blocked on a backend that does not exist yet.

**Alternatives considered.**
- Require backend/DB finalized (Mode B+) before allowing a refresh (rejected: contradicts the kit's own Mode A = demoable-now philosophy
-  user explicitly rejected this option)
-  duplicate the vision-interview questions into both trigger prompts (rejected: D4 forbids untracked drift between copies)
-  fold the refresh workflow into CONTINUE-TINS-PROJECT.md inline (rejected: user preferred a new dedicated prompt matching the kit's one-file-per-scenario convention).

**Consequences.**
- Kit gains a 5th user-facing entry point (frontend-refresh) alongside the 4-scenario matrix, always reachable via CONTINUE-TINS-PROJECT.md's W-router or SPEC-AUTHOR.md's website check. Every future website spec and every future frontend refresh goes through the same 5-library research instead of re-deriving it. Adding a 6th reference library later requires a kit-growth decision, not an ad hoc per-project choice.

**How to verify.** `node scripts/validate.mjs --all` exits 0 (35 pass, 0 warn, 0 fail, up from 31); `node --test scripts/selftest.mjs` exits 0 (15/15, unchanged).

## D23 — Parallel-work delegation (D29): self-vs-external split, independence check, scrubbed task packets, symmetric notes recovery

**Date:** 2026-08-21
**Status:** ✅ accepted
**Decided by:** <name>
**Cross-references:** SPEC.md D29, §2.1, §2.4, §2.5, §4.1, §8.26, §9 (D30 note); prompts/DELEGATE-WORK.md; prompts/INTEGRATE-DELEGATED-WORK.md; scripts/check-task-independence.mjs; scripts/scan-task-packet.mjs; HANDOVER.md W13

**Context.** User wants to split a TINS project's remaining locked work across multiple LLM sessions or people and build it in parallel, without the TINS methodology leaking to anyone outside the user's direct control. Interview ran across several rounds: confirmed self-vs-external is architectural (who directs the executor, not which AI vendor), pushed back on reusing kit-staging/'s inbox/archive pattern (unidirectional, kit-rooted, 2-state) in favor of a per-project delegation/ folder (bidirectional, project-local, multi-state), and corrected an early symmetric-notes proposal back to the user's original self-vs-external split once the architectural reason (self needs no packet at all) was clear.

**Decision.** Ship prompts/DELEGATE-WORK.md + prompts/INTEGRATE-DELEGATED-WORK.md, scripts/check-task-independence.mjs + scripts/scan-task-packet.mjs, templates/TASK-BRIEF.md + DELEGATION-LEDGER.md + DELEGATION-README.md. Self-mode tasks: no packet, full clone, full decision-log continuity. External-mode tasks: scrubbed packet only (TASK-BRIEF.md + files/ + blank NOTES.md), no repo access, independence-checked before export, leak-scanned before shipping. Every external NOTES.md is read and folded into the real decision log at integration, symmetric across all tasks regardless of who did them. Deferred a related open-source-release capability (candidate D30) rather than folding it in.

**Alternatives considered.**
- Reuse kit-staging/'s inbox+archive convention directly (rejected: wrong shape - unidirectional/kit-rooted/2-state vs. needed bidirectional/project-local/multi-state)
-  two-tier notes continuity where only self-directed work keeps decision-log continuity (rejected per user correction: the packet already strips what needs stripping, so recovering notes from external tasks too costs nothing extra and loses nothing kept purposely)
-  building the OSS-release capability in the same pass (rejected: different audience - adversarial-scrutiny minimal export vs. cooperative-scrutiny comprehensive export - deserves its own interview).

**Consequences.**
- delegation/ is a new per-project folder convention alongside HANDOVER.md's W-queue and kit-staging/'s kit-root inbox - three different file-based coordination shapes now exist in the kit, each solving a genuinely different problem. check-task-independence.mjs and scan-task-packet.mjs are reusable infrastructure a future D30 (OSS release) can retarget. The independence-detection design is generic and unvalidated against a real project yet - the user will pilot it himself in a fresh LLM chat before it's proven.

**How to verify.** `node scripts/validate.mjs --spec=SPEC.md` exits 0 (41 pass, 0 warn, 0 fail, up from 35); `node --test scripts/selftest.mjs` exits 0 (15/15, unchanged); `node scripts/check-task-independence.mjs` and `node scripts/scan-task-packet.mjs` smoke-tested live against clean/conflict/missing-ledger and clean/leaky/no-arg fixtures respectively, all exiting the documented codes with correct messages.

## D24 — Open-source release packaging (D30): promote private-to-public.mjs, whole-tree scan, corporate-tone docs, quality rubric

**Date:** 2026-08-21
**Status:** ✅ accepted
**Decided by:** <name>
**Cross-references:** —

**Context.** D29 deferred an open-source/public-release packaging capability as a D30 candidate. The user asked to finish it this session, and additionally wanted lib/patterns/private-to-public.md substantially reworked (not just the embedded script promoted as-is), in-line code comments considered for methodology scrutiny, and all generated public documentation to read in a fully corporate voice with no LLM authorship tells.

**Decision.** Two trigger points mirroring D28's shared-interview pattern: SPEC-AUTHOR.md question 8 (unconditional, every project) records Public release intended: TRUE/FALSE in SPEC.md section 0.2; prompts/PUBLISH-OPEN-SOURCE.md (new, 9 steps) does the actual packaging at release time. scripts/private-to-public.mjs promoted from an embedded code block in the pattern doc into a real, shipped, zero-dep script -- fixed a latent glob-matching bug in its inherited copy-filter along the way (scripts/*.mjs-style wildcard patterns never matched anything before this fix). It copies the private working copy into a public sibling per an include/exclude table, mechanically rewrites the TINS marker-line comment, then scans the ENTIRE destination tree -- every file, in-line comments included -- against its own banned-terms list covering methodology fingerprints AND LLM-authorship fingerprints (model/vendor names, leftover assistant-speak). lib/patterns/private-to-public.md rewritten: a corporate-tone requirement (section 3.0), a new docs/DESIGN-WALKTHROUGH.md doc type (section 3.6), a 5-question quality rubric (section 3.7), and the full script text replaced with a reference to the real file to avoid drift.

**Alternatives considered.**
- Folding the packaging step into RELEASE-CHECKLIST.md's existing private-to-public sweep section (rejected -- that section is a same-repo prod-readiness sweep, a different concern from producing a second public-facing repo). Sharing one banned-terms list between scan-task-packet.mjs (D29) and private-to-public.mjs (D30) (rejected -- user's explicit choice to keep them separate for now, since the two scripts solve different problems: one scoped task packet vs. a whole publicly-released project). A single early-only or late-only trigger (rejected in favor of two trigger points, matching D28's precedent of one interview shared across two entry points).

**Consequences.**
- Every future SPEC-AUTHOR.md interview now asks about public-release intent regardless of project type, adding one more locked decision row. Releasing a project publicly is now a defined, scannable, rubric-gated workflow instead of an ad-hoc 2-hour manual process (the original Jayshankar baseline). The corporate-tone requirement means public docs need real editorial effort, not just a clean scan -- the scanner proves absence of bad strings, not presence of good documentation. The curriculum-generator idea the user also raised was deliberately scoped out as a D31 candidate rather than attempted alongside D30, since it has zero prior art in the kit and is a from-scratch design effort of comparable size to D29 or D30 itself.

**How to verify.** `node scripts/validate.mjs --spec=SPEC.md` exits 0 (47 pass, 0 warn, 0 fail, up from 41); `node scripts/validate.mjs --kit` exits 0 (37 pass, 0 warn, 0 fail); `node --test scripts/selftest.mjs` exits 0 (19/19, up from 15, the 4 new cases exercise `scripts/private-to-public.mjs` directly rather than via the validator); `node scripts/private-to-public.mjs <src> <dst> --name="..."` smoke-tested live against a fixture with planted TINS/AGENTS.md/HANDOVER.md/Claude/"as an AI"/"Certainly!" leaks (exit 1, all caught), the same fixture cleaned (exit 0), and no-args usage (exit 2).

## D25 — Curriculum / interview-prep generation (D31): teach from a finished project's real history

**Date:** 2026-08-21
**Status:** ✅ accepted
**Decided by:** <name>
**Cross-references:** —

**Context.** D30 closed with a deferred candidate: repurposing a finished project's documentation into full teaching/interview-prep material. The user asked to finish it this session ("lets finish d31"). Interview ran across three AskUserQuestion rounds plus prose discussion: Round 1 confirmed all three heavy content pieces in v1 (real-bug debugging case studies, scenario questions from real requirements, first-principles reimplementation drills) at maximum breadth, including the full ambitious reimplementation-drills version over a deferred/scoped-down option. The user then raised two design questions unprompted: wanting the LLM to reply in parts so the output context window is not hit and each turn can be maximally descriptive, and asking whether curriculum generation needs the same (expensive) model the original builder used or a cheaper one, specifically flagging that first-principles reimplementation drills might need a smarter model because that task is monumental in itself.

**Decision.** Ship two new fresh-session prompts, prompts/GENERATE-CURRICULUM.md and prompts/GENERATE-INTERVIEW-PREP.md, plus templates/CURRICULUM-PROGRESS.md, with no new script — both reuse scripts/private-to-public.mjs --scan-only as-is for the safety gate. Both generate output strictly ONE FILE PER TURN into a sibling <project>-curriculum/ folder (never inside the private working copy or the D30 public repo), tracked via a CURRICULUM-PROGRESS.md manifest so an interrupted run resumes instead of restarting. The model/context question resolved via the kit's own D4 fresh-session discipline: a prompt should work from real project artifacts (SPEC.md, BUILDER-DECISIONS-REVIEW.md, HANDOVER.md, code), never from the original builder session's memory; GENERATE-INTERVIEW-PREP.md additionally and explicitly recommends running it on a frontier model at extended/max thinking, reusing check-task-independence.mjs (D29) as the kit's existing precedent for that exact recommendation. GENERATE-CURRICULUM.md is written in direct second-person instructional voice, deliberately distinct from PUBLISH-OPEN-SOURCE.md's corporate voice, since the two serve different audiences (someone evaluating the software vs. someone learning from it). CONTINUE-TINS-PROJECT.md gained a 4th specialized-W routing paragraph.

**Alternatives considered.**
- (1) Route curriculum generation through the same session/model that built the project, for continuity — rejected because it breaks the kit's fresh-session discipline (D4) and does not scale to a curriculum generated long after the original build session ended. (2) Compress all curriculum files into a single large response — rejected per the user's own stated concern about hitting the output context window and wanting maximal per-file descriptiveness
-  the manifest-first, one-file-per-turn design was chosen instead. (3) Write a new scanner/banned-terms list specific to curriculum content — rejected because the curriculum's own process-teaching content must already avoid the same two fingerprint categories (methodology, LLM-authorship) D30's scanner blocks
-  a second list would duplicate that coverage for no benefit. (4) Build the curriculum inside D30's public repo — rejected because the corporate product voice and the instructional teaching voice are incompatible in one folder
-  a sibling folder was chosen instead. (5) Defer the full ambitious reimplementation-drills scope again — offered to the user as the Recommended option but explicitly declined in favor of building it now.

**Consequences.**
- Two new prompts (~15KB and ~17KB) and one new template ship
-  no new script, keeping D31 a pure-prompt addition per the D28/D29 precedent, so no new scripts/selftest.mjs cases were added (the validator's presence/content checks cover it). scripts/validate.mjs gained 5 new §8.28a-e checks
-  SPEC.md gained §0.2 D31 and §8.28
-  INDEX.md and HANDOVER.md updated to match. A real curriculum run against a finished project (not yet attempted) will be the first test of whether a fresh session, working only from real artifacts, produces teaching material as good as the design intends -- if it falls short, that is a signal to improve the project's own decision-log discipline upstream, not a reason to route around fresh-session sourcing.

**How to verify.** `node scripts/validate.mjs --spec=SPEC.md` exits 0 (52 pass, 0 warn, 0 fail, up from 47 — the 5 new §8.28a-e checks); `node scripts/validate.mjs --kit` exits 0 (42 pass, 0 warn, 0 fail, up from 37); `node --test scripts/selftest.mjs` exits 0 (19/19, unchanged from D30 — no new cases added, per the D28/D29 precedent that a pure-prompt addition with no new script can rely on the validator's presence/content checks); `cat prompts/GENERATE-CURRICULUM.md` and `cat prompts/GENERATE-INTERVIEW-PREP.md` show both explicitly instruct one-file-per-turn generation and reference `scripts/private-to-public.mjs --scan-only` as the safety gate, and `GENERATE-INTERVIEW-PREP.md` explicitly recommends a frontier model at extended/max thinking; `cat prompts/CONTINUE-TINS-PROJECT.md` shows the new routing paragraph for teaching-material W's.


## D26 — Autonomous orchestration (D32): auditor + workers, contract plus reference runner, tiered escalation that parks rather than halts

**What changed.** Added `prompts/AUTONOMOUS-BUILD.md` (the auditor's contract — 9 steps from preconditions to run digest) and `prompts/WORKER-SESSION.md` (the worker's contract, dispatched by the auditor rather than pasted by the user), `scripts/orchestrate.mjs` (the reference runner: `--dry-run` / `--status` / dispatch, exit 0/1/2/3), `scripts/escalate.mjs` (files a tiered escalation, parks the task), `lib/patterns/tiered-escalation.md` (the rule), and `templates/ORCHESTRATION.json` + `templates/ESCALATIONS.md`. Wired routing into `CONTINUE-TINS-PROJECT.md` Step 2 and a handoff from `SPEC-AUTHOR.md`'s closing section. Extended `templates/DELEGATION-LEDGER.md` with the autonomous status vocabulary and an optional `Depends` column.

**Why contract-plus-runner rather than a single mechanism.** The kit has never picked a hosting target (D15) and should not pick a harness either. But "just plug an LLM in and it runs" needs something executable, not only prose. Splitting it settles both: `AUTONOMOUS-BUILD.md` is normative and `orchestrate.mjs` is one conforming implementation, so a harness with native subagent spawning skips the script while a harness without one still has a working runner. The user picked this shape over script-only and prompt-only.

**Why the state lives in files.** An auditor holding run state in its context cannot hand off, cannot resume after a crash, and cannot survive its own context window on a long run. Putting `LEDGER.md` / `ORCHESTRATION.json` / `ESCALATIONS.md` in the repo makes a fresh auditor a drop-in replacement — which is the only reason an unattended multi-hour run is safe to start at all.

**Why the auditor writes no product code.** This is D10's role separation applied inside a single run. A session that wrote the code will verify its own assumptions rather than the acceptance criteria. Once the auditor starts patching worker output "just this once", its verification stops meaning anything and the run has no reviewer. Failing tasks are therefore re-issued to a fresh worker up to `maxRetries`, never fixed in place.

**Why a T2 parks instead of halting.** Chosen live by the user over halting the whole run. One unanswered question idling every independent task is the same pathology as a build system serialising on one slow test. Exit code 3 keeps "parked, owed an answer" distinct from both success and failure, because a human reading the outcome needs to tell those apart.

**Why uncertainty resolves to T2 and not T1.** The cost asymmetry only runs one way. An unnecessary T2 costs one parked task and a question answered in a minute; a genuine uncertainty misfiled as T1 compounds unattended for hours with other tasks built on top of it. This is the rule most likely to get quietly softened as "efficiency", so it is stated in the pattern, in both prompts, and enforced by `escalate.mjs` refusing an underspecified T2.

**Why `escalate.mjs` rejects a T0.** Escalation queues that fill with narration get skimmed, and a skimmed queue is one where the real question gets a reflex answer. Making the script refuse a T0 outright turns `tiered-escalation.md` §2.1 from advice into a mechanism.

**Impact on downstream.** A consumer whose spec is locked and whose tooling gate is green can hand the remaining build to a fresh session and get back a built project, a digest of every T1 judgement, and a short queue of genuinely necessary questions.

**Cross-references:** SPEC.md D32 + §8.29, lib/patterns/tiered-escalation.md, prompts/AUTONOMOUS-BUILD.md, prompts/WORKER-SESSION.md, scripts/orchestrate.mjs, scripts/escalate.mjs.

## D27 — Tooling discovery + security audit (D33): a blocking gate, chosen over advisory-but-recorded

**What changed.** Added `prompts/TOOLING-AUDIT.md` (6-step workflow), `scripts/tooling-audit.mjs` (the gate), `templates/TOOLING-AUDIT.md` (the record), and `lib/patterns/third-party-tool-audit.md` (nine red flags, three verdicts). Wired it as a blocking Step 0 into both `NEW-PROJECT.md` and `CONTINUE-TINS-PROJECT.md`, and added the new files to the portable shell scaffolder.

**Why blocking rather than advisory.** The reviewer's instinct was advisory-but-recorded — lower friction, still auditable. The user overrode it, and the argument is decisive: proceeding "with assumptions and handicaps" is the precise failure being prevented, and a gate that can be skipped silently does not prevent it. The failure mode is specific and invisible — a session lacking a capability does not stop, it improvises: guesses at an API response, estimates a number it could have looked up, writes a plausible paragraph where a real query belonged.

**Why a waiver must name the handicap.** The gate can be declined; that is the user's call. But `skipped, not needed` is worthless to the next session. Requiring the waiver to name the capability given up **and** where assumptions now stand in for real data is what makes the handicap inheritable rather than invisible — and invisible handicaps get written up as facts. `tooling-audit.mjs` rejects a placeholder waiver note for exactly this reason.

**Why uncertainty resolves to REVIEW-REQUIRED.** The user's phrasing was "if you are unsure just flag the user to read it." Making that the default rather than a fallback matters because a skill is not a library — it is instructions the model follows, with the same authority as the user's own, where the dangerous line is a plain-English sentence that passes every linter ever written. A confident clearance of a half-read skill is the outcome the rubric exists to prevent.

**Why the kit never executes a candidate.** Dynamic analysis feels more rigorous and is strictly worse here: running an untrusted skill to evaluate it *is* the compromise, and a payload that fires only on a second run or only with a real credential present is invisible to a test run. The audit is static reading, and SAFE is defined honestly as "nothing in the source gave cause for concern" rather than "observed to be harmless."

**Impact on downstream.** Every project now starts with a written, inheritable answer to "what can this harness actually do, and what are we pretending we can do?"

**Cross-references:** SPEC.md D33 + §8.30, lib/patterns/third-party-tool-audit.md, prompts/TOOLING-AUDIT.md, scripts/tooling-audit.mjs.

## D28 — Adaptive inline steering prompts (D34): a catalogue the model selects from, not a deck the user is handed

**What changed.** Added `prompts/STEERING-PROMPTS.md` — seven drift classes, each with a raw card shape, adaptation slots, and a worked adapted example — plus the adaptation rule, the five emission checkpoints, and the offered-never-executed rule. Wired into `NEW-PROJECT.md` and `CONTINUE-TINS-PROJECT.md`.

**Why no file is delivered to the user.** The obvious shape was a static `STEERING-PROMPTS.md` handed over at session start. Offered that option, the user declined it and asked instead for "inline comments that change appropriately based on how the user uses tins-kit." That is the better design and the reason is concrete: a static deck goes unread, and it cannot name *this* project's actual artefacts. A card reading "please re-read the relevant files" trains the user to skim past the mechanism; a card reading "re-open `src/lib/prisma.ts` and D14, quote the lines you're relying on" is an instrument. Hence the file is a catalogue the model reads, and only the adapted card reaches the user.

**Why self-correction is the mandatory trigger.** It was the user's own example, and it is the hardest checkpoint to keep. The natural behaviour on noticing your own error is to fix it quietly and continue — the correction feels like housekeeping and mentioning it feels like drawing attention to a mistake. But a silent self-correction is exactly the event the user cannot see and therefore cannot steer, and one stale-context error usually means others in the same stretch. So the rule is: say it out loud, then offer the card.

**Why cards are offered and never auto-executed.** The whole point is to put the user's judgement back in the loop. A model that answers its own card has removed the human it was trying to re-involve.

**Why no automatic drift detection.** Deferred to §9 rather than attempted. Detection would need a monitor over the transcript; v1 relies on the model's honest self-report, which is enough for the named case (self-correction) and avoids shipping a detector whose false negatives would read as an all-clear.

**Impact on downstream.** The user gets a steering wheel at the moments steering is possible, rather than discovering drift when the output is already wrong.

**Cross-references:** SPEC.md D34 + §8.31, prompts/STEERING-PROMPTS.md.

## D29 — Execution-mode selection (D35): ask which of five ways the work should be built, and enforce the answer

**What changed.** Added `prompts/EXECUTION-MODE-INTERVIEW.md` — a shared interview (D4 shape) presenting `solo`, `auditor-local`, `auditor-remote`, `self-parallel`, `external` and `hybrid`, triggered from `SPEC-AUTHOR.md`, `NEW-PROJECT.md`, `CONTINUE-TINS-PROJECT.md` Step 2, and `AUTONOMOUS-BUILD.md` Step 0. Taught `scripts/orchestrate.mjs` to read the round mode from `delegation/LEDGER.md` and refuse non-auditor rounds. Extended `templates/DELEGATION-LEDGER.md`'s header and task-mode vocabulary, added dated worker-command presets to `templates/ORCHESTRATION.json`, and removed the self-vs-external question from `DELEGATE-WORK.md`.

**Why a question at all.** The kit could already build work five ways, but the choice was inferred from phrasing — "build it in parallel" landed in `DELEGATE-WORK.md`, "run it unattended" in `AUTONOMOUS-BUILD.md`, anything else in the generic W flow. That is guessing about something with real consequences: which accounts get billed, who stays in the loop, and whether a packet needed scrubbing. Three concrete failures it caused: an auditor and three workers spun up for two files' worth of work; everything run on one harness while the user pays for three; work assumed in-house that was always destined for a contractor and therefore never scrubbed.

**Why all five on one menu, including external.** The user chose this over keeping external delegation on its own path. It means one question per round in one place, and it let `DELEGATE-WORK.md` stop asking its own narrower version — two prompts asking overlapping questions is how a user ends up answering the same thing twice and differently.

**Why `auditor-remote` is a distinct mode rather than a config detail.** Pointing `workerCmd` at another CLI is technically just configuration, but the decision behind it is not: it is "spend a different provider's quota" plus "accept capability asymmetry between workers." Making it a named mode forces the interview to raise both, and to recommend a frontier model for genuinely hard tasks — a weak worker fails subtly and confidently rather than loudly, which is the worst failure shape in an unattended run.

**Why the interview must state the `auditor-remote` vs `self-parallel` distinction explicitly.** Both use several LLMs, so users collapse them. The difference is *who orchestrates* — a session, or the person — and it determines whether the run is unattended. Left implicit, a user asking for "parallelism on my other LLMs" gets an unattended auditor when they wanted to drive each session themselves.

**Why the recorded mode is enforced rather than advisory.** A mode written into a ledger that nothing reads is a comment. Making `orchestrate.mjs` refuse `solo` / `self-parallel` / `external` turns it into a safety property: the runner cannot auto-dispatch work the user said they would run themselves, or work destined for a scrubbed packet. The prompts therefore forbid editing the mode to get a command to run — that is the one move that would defeat it.

**Why per-round rather than a locked §0.2 row.** The user chose this. A project-level answer goes stale in the direction of over-parallelising: the mode chosen when six modules remained is still there when two bug fixes remain. Pre-filling from the previous round keeps the cost at one word when nothing changed.

**Why the CLI presets were researched rather than written from memory.** They are a claim about present-day third-party tools, which is exactly what `SPEC-AUTHOR.md`'s B-pass ("check for rot") exists to catch. All three were verified against each tool's own headless documentation and the note carries the verification date, so the next session knows to re-check rather than trusting them indefinitely. They remain documentation-verified, not execution-verified — hence the standing advice to run one worker by hand before the first wave.

**A real defect the new selftests caught.** The mode refusal originally sat after the nothing-runnable early exit. Because a user-driven round has an empty wave by definition, it reported exit 3 ("parked, owed an answer") when the true message was exit 2 ("you are in the wrong prompt") — two states the exit codes exist specifically to distinguish. Moved the check ahead of it.

**Impact on downstream.** Every round now starts with an explicit, recorded, enforced answer to "who is building this, and where."

**Cross-references:** SPEC.md D35 + §8.32, prompts/EXECUTION-MODE-INTERVIEW.md, scripts/orchestrate.mjs, templates/DELEGATION-LEDGER.md, templates/ORCHESTRATION.json.

## D30 — Worked examples (D36): capture a real run, failures included

**What changed.** Added `examples/autonomous-todo-app/` — a complete D32 auditor + worker run that built a zero-dependency todo app from a locked spec: the verbatim worker prompts, each worker's returned report, all four decision logs, the run digest, the run's real state files, and the finished code. Added D36 + §8.33a–e to `SPEC.md`, five validator checks, and an `examples/` exclusion in `kit-sync.mjs`.

**Why run it rather than write it.** `HANDOVER.md` had carried the same caveat since D32 shipped: *"D32's design rests on assumptions about how worker sessions behave that only a real unattended run can check."* A hand-written example would have restated the design, not tested it. The run found three kit defects, one contradiction in the spec it was building, and one worker misdiagnosis another worker corrected. A clean result would have been evidence the exercise was too easy.

**Why an example must document its failures.** The validator enforces this (§8.33c) rather than trusting the author. An example that only shows the happy path teaches a workflow nobody will recognise when they run it — the first time a real ledger breaks a parser or a worker misdiagnoses a gate, a reader whose only reference was a clean transcript concludes they are doing it wrong. Showing the parse bug, the misdiagnosis, and the parked ending is the useful part.

**Why the parked ending was preserved rather than resolved.** It would have taken one line each to amend the spec and turn exit 3 into exit 0. That would have been a worse example and a false one: the whole point of the tier system is that a spec amendment is a human's call, and an auditor that quietly made both calls to produce a tidy result would have demonstrated the failure mode instead of the mechanism.

**Why the planted ambiguity is reported as not firing.** The spec deliberately left the §2.5-vs-§3-rule-1 tension unsettled to exercise the escalation path. It did not fire — T2 resolved it at T1 with sound reasoning and said explicitly why it had considered T2 and declined. Two *unplanted* defects triggered the escalations instead. Reporting that honestly is more informative than quietly re-rigging the spec until the intended path fired.

**Why examples are not synced to consumers.** One example is ~440 KB of transcript. It is reference material for a person reading the kit; a consumer project inherits no value from it. `kit-sync.mjs` now skips it, and §8.33e pins that — D36 asserting it in prose while the code did the opposite was the third defect this session found, and it was found by checking the code against the decision rather than by trusting the decision.

**Why no sync mechanism for stale examples.** A run that no longer matches the workflow gets re-run or deleted, never edited to look current. A patched transcript is a fabricated one, and the entire value of an example is that it happened.

**Impact on downstream.** D32 is no longer theoretical, and the three defects it exposed are fixed or recorded rather than waiting to surface in a user's first real run.

**Cross-references:** SPEC.md D36 + §8.33, examples/autonomous-todo-app/README.md, scripts/orchestrate.mjs, scripts/check-task-independence.mjs, scripts/kit-sync.mjs.

## D31 — `manual-relay-worker-loop` pattern: D32's dispatch gap for a worker tool with no CLI hook

**What changed.** Wrote `lib/patterns/manual-relay-worker-loop.md` and a §0.4 absorption-table
row, sourced from a real 4-task Jayshankar round (decisions #31/33/34/35) using MiniMax M3 via
the MiniMax Coder desktop app — a GUI tool, no CLI/API hook — as the worker.

**The gap this closes.** `EXECUTION-MODE-INTERVIEW.md` correctly names "their other platforms
are chat interfaces rather than CLIs the auditor could invoke" as the trigger for
`self-parallel` — but `self-parallel`'s own default response (paste the full
`CONTINUE-TINS-PROJECT.md` prompt, let the other session self-direct) assumes the other session
is peer-strength. That's backwards for the actual use case: a GUI-only worker tool is exactly
the situation where the worker is likely to be the *cheaper* leg of the setup, which is the
opposite of what the mode's default hand-off assumes it can trust. The pattern is: keep
`self-parallel`'s dispatch mechanism (a human relays messages, nothing scripted) but borrow
`WORKER-SESSION.md`'s tight-brief *shape* (one task, explicit touched files, mechanically
checkable acceptance criteria, an interface contract, a tier policy) instead of the loose
default — `ORCHESTRATION.json`'s own capability-asymmetry warning for `auditor-remote`
("a weaker worker model needs a tighter brief") turns out to apply here too, dispatch mechanism
aside.

**Why staged as single-consumer, not silently treated as proven.** The kit's own growth
discipline (docs/GAP-ANALYSIS.md) leans on cross-project recurrence; this is one project's first
real run. The pattern file says so in its own source note rather than presenting itself as
settled. Absorbed directly rather than left in `kit-staging/` because it's adjacent (Jayshankar
already vendors the kit) and well-evidenced (a real completed round with concrete, reproduced
lessons — not a guess) — matching how several existing single-strong-source patterns in the
absorption table were already handled (e.g. `third-party-tool-audit.md`, absorbed with zero
reference-project ✅s, on reasoned necessity alone). The user is about to apply this on a second,
unrelated project — that will be the real test of whether it generalizes past one run.

**What I did not do.** No new `validate.mjs` check or `selftest.mjs` case specific to this
pattern's content — the existing structural checks (§8.13c/d: every pattern file referenced in
the absorption table, minimum pattern count) already cover it, and a narrative pattern doc like
this one doesn't have a mechanically-checkable property the way e.g. `idempotent-migrations.md`'s
SQL primitives do. `HANDOVER.md` updated with a one-line pointer only, not a full session
write-up, since this isn't a kit-development session in progress.

**Cross-references:** `lib/patterns/manual-relay-worker-loop.md`, `SPEC.md` §0.4, Jayshankar
`BUILDER-DECISIONS-REVIEW.md` decisions #31/33/34/35, `prompts/WORKER-SESSION.md`,
`prompts/EXECUTION-MODE-INTERVIEW.md`, `templates/ORCHESTRATION.json`.

---

## D32 — `manual-relay-worker-loop` reaches its 2-consumer bar; lesson 1 gets a harder failure mode

**What changed.** D31's pattern file said so itself: "one consumer so far, not two... the real
validation of whether this generalizes." That validation arrived 2026-09-10, not through
`kit-staging/inbox/` but as a direct cross-session message from EduPlay v2's own auditor session
(a different, unrelated project independently applying this same pattern with the same MiniMax
Coder worker shape). Folded directly into `lib/patterns/manual-relay-worker-loop.md`: the source
note now records the second consumer; lesson 1 gets an addendum; a 4th anti-pattern is added;
§3's closing note records the bar being met.

**The actual finding, and why it's a correction, not just a confirmation.** Lesson 1 (from
Jayshankar) diagnosed one failure mode on a shared WSL2/Windows mount: whichever OS last ran
`npm install` leaves its native binaries in place, breaking the other side — recoverable with a
plain re-run. EduPlay v2 hit a harder case on an ostensibly similar mount (`/mnt/d` vs.
Jayshankar's `/mnt/c`, both `9p`/`drvfs`): their mount doesn't support `chmod` at all, so
`npm install` fails outright regardless of which OS touched it last, and the standing recovery
rule (re-run `npm install`) doesn't apply — reproduced directly (`chmod` on a test file →
`Operation not permitted`) rather than inferred. Two consumers, same mount *type*, genuinely
different behavior — the correction is "verify with a real `touch`+`chmod` round-trip before
trusting either the standing rule or a `rm -rf node_modules` recovery," not "always assume the
worse case."

**Verified independently before folding in, not taken on the peer's word alone.** Ran the same
`touch`+`chmod` round-trip on Jayshankar's own live project path (`/mnt/c/Users/user/Desktop/
Jayshankar`) before writing anything — confirmed it succeeds here, consistent with every `npm
install` this project's auditor has run from WSL2 this session actually working (not silently
papering over a partial failure — it visibly fixed real breakage each time). This is why
Jayshankar's own instance of the pattern never hit the harder case: not luck, a genuinely
different mount configuration, now confirmed rather than assumed.

**Why this went straight into the existing pattern file, not through `kit-staging/inbox/` /
`KIT-GROWTH-SESSION.md`.** That heavier workflow is for triaging new candidates shipped as
formal export bundles — checked `prompts/KIT-GROWTH-SESSION.md` before proceeding, confirmed it
doesn't fit this case: there's no inbox entry, and this isn't a new pattern needing
`kit-new-pattern.mjs` scaffolding, it's a validated correction to a pattern that already exists
and explicitly invited exactly this kind of second-consumer update in its own text. Proportionate
response: direct edit + this decision entry, matching D31's own precedent of not over-processing
a narrative pattern doc through machinery built for a different kind of intake.

**What I did not do.** No new `validate.mjs`/`selftest.mjs` check — same reasoning as D31, a
narrative pattern doc doesn't have a new mechanically-checkable property here. No permission
escalation of any kind — the peer session reported a finding and a suggestion, not a request for
access; verifying and folding it in used only this session's normal file-edit permissions,
already exercised throughout today's SPEC v2 / migration work.

**Cross-references:** `lib/patterns/manual-relay-worker-loop.md`, D31 above, `HANDOVER.md`
addendum.

---

## D33 — Reconciled with class-fun-ef (EduPlay v2) via direct cross-session message, not `kit-sync.mjs`

**What changed.** The user asked Jayshankar's auditor to connect to the peer session working on
EduPlay v2 (`class-fun-ef`), diff the two vendored `tins-kit/` copies, and reconcile. No shared
top-level canonical kit root exists on this machine that both projects vendor from (checked —
neither `/mnt/d/Python-AI_ML-SRM/` nor any parent directory has a bare `tins-kit/` above both
consumers); `kit-sync.mjs`'s own parent→child model doesn't apply to two siblings. Direct
cross-session message + manual reconciliation stood in for it instead, same pattern
`manual-relay-worker-loop.md`'s own D31/D32 already established for peer-to-peer kit findings.

**Diffed directly first, not assumed.** `diff -rq` between the two `tins-kit/` trees before
messaging: only 5 files differed out of the entire kit — everything else (prompts/, templates/,
schemas/, every other `lib/patterns/` file, `SPEC.md`, `AGENTS.md`, `PIPELINE.md`, `INDEX.md`,
`VERSIONING.md`, docs/, examples/) was already identical.

**What reconciled, and how:**
- `scripts/private-to-public.mjs` + `scripts/selftest.mjs` — Jayshankar's side had 6 verified
  bug fixes from regenerating `Jayshankar-clean` for a real publish today (word-boundary term
  matching, 2+-segment path-escape scoping, `validate.mjs`/`selftest.mjs` self-exclusion with
  `package.json` script stripping, `docs/W*-*.md` exclusion, authored-not-copied `.gitignore`,
  missing `supabase/functions/**`/`capacitor.config.ts` in `INCLUDE_PATTERNS`) — none of it on
  the peer's side yet. This session's own sandbox blocked writing directly into the peer's
  workspace (correctly — not something to route around); the peer pulled the two files
  themselves after reviewing the reasoning independently, then reported their own selftest run
  came back 12/56 rather than 56/56 — traced it themselves to an invocation-path issue
  (`node tins-kit/scripts/selftest.mjs` from their project root vs. `cd tins-kit && node
  scripts/selftest.mjs`; the script resolves `VALIDATOR` off `process.cwd()`) unrelated to the
  diff, confirmed by reverting to their pre-copy version and reproducing the same failure count.
  Worth knowing: `selftest.mjs` assumes its own cwd, not the caller's — a latent fragility, not
  fixed here, flagged for a future pass.
- `lib/patterns/manual-relay-worker-loop.md` — both copies already had the *same* second-consumer
  finding (D32's DrvFs/`chmod` addendum), independently written in each project's own first-person
  voice ("Jayshankar's mount" vs. "this project's mount"). Agreed a neutral, explicitly-named
  version (naming both projects by name throughout, not "this project"/generic deixis) was the
  right target rather than either side's original phrasing. The peer took the more complete pass
  (converted every remaining deictic reference, not just the two originally-differing sections)
  and additionally had a Lesson 2 addendum (a real EduPlay v2 finding, confirming Lesson 2
  independently — "8/8 acceptance criteria, gate green" self-report vs. a real schema defect the
  worker's own checker never caught) this side didn't yet have. Adopted the peer's file verbatim
  rather than re-merging by hand, once confirmed it was a strict superset/improvement.
- `HANDOVER.md` / `BUILDER-DECISIONS-REVIEW.md` — agreed, both sides independently, these are
  legitimately per-consumer narrative logs per `VERSIONING.md` Rule 5/6 and should NOT be forced
  identical. Left diverging on purpose.
- `kit-upgrade` — the user referenced a command by this name; neither side found any such
  script/prompt in their own vendored copy. Not a real command in this kit as currently vendored;
  flagged back to the user rather than guessed at by either session.

**Verified after reconciling, not assumed from the peer's report alone.** Re-ran
`node --test scripts/selftest.mjs` (from inside `tins-kit/`, per the peer's own finding above)
and `node scripts/validate.mjs --spec=SPEC.md` on this side after adopting the peer's pattern
file: 56/56 and 83/83 respectively, both still green.

**Also surfaced and fixed, unrelated to the kit reconciliation itself:** the user's own
`jayshankar-hyperframes-walkthrough-video.md` memory had recorded the wrong drive AND wrong
filename for Jayshankar's reference video (claimed `D:\...\class-fun\example-video\WhatsApp
Video...`). The peer correctly checked their own `example-video/` folder and reported it holds
only unrelated Anki card-creation clips for EduPlay's own work, not a delivery/sale/reversal
demo reference — flagging a likely mix-up rather than assuming silently. Checked directly: the
real file was sitting in Jayshankar's *own* `example-video/` folder the whole time (`Best B2B
Product Demo Video...`, matching the previously-noted file size), never actually on the D: drive.
Memory corrected.

**What did not happen, deliberately.** Did not relay-start HyperFrames planning work on the
peer's side just because this session's user asked for it — the peer correctly held off,
treating a cross-session request as something for *their own* user to confirm before spending
session time on unrelated-project scope, not something to act on unilaterally from a relayed
message alone. Right call; noted rather than pushed back on.

**Cross-references:** `lib/patterns/manual-relay-worker-loop.md`, D31, D32 above;
`scripts/private-to-public.mjs`, `scripts/selftest.mjs`; Jayshankar's own
`BUILDER-DECISIONS-REVIEW.md` decision #56 (the original 6 fixes, project-side).

---

## D34 — `kit-upgrade` clarified as `KIT-GROWTH-SESSION.md`; text-extractor-from-html inbox item triaged and closed

**What changed.** The user's "kit-upgrade" referred to `prompts/KIT-GROWTH-SESSION.md` — clarified
by the peer session (`class-fun-ef`), confirmed present in both vendored copies. Ran it for real:
`kit-staging/inbox/` had one real, unprocessed entry (`text-extractor-from-html`, sitting since
2026-08-16) that the original automated triage had silently mis-scored as "0 candidates" due to
exactly the `kit-extract.mjs` parser bug the submitting project itself diagnosed and reported
(see below) — the hand-authored `kit-growth-candidates.md` sitting alongside it was the correct,
never-actually-processed record.

**Both kit bugs the submitter reported are already fixed, found by checking, not assumed:**
1. `kit-extract.mjs`'s `parseDecisions()` — confirmed fixed in Jayshankar's vendored copy (a
   "Fixed 2026" comment already there, now matching both the kit's own `## D<N>` heading
   convention AND `templates/BUILDER-DECISIONS-REVIEW.md`'s shipped `### Decision N` convention).
   Confirmed via `diff` that `kit-extract.mjs` is byte-identical between Jayshankar's copy and
   the actual canonical root (`C:\Users\user\Desktop\TINS-projects\atal-incubation\tins-kit\` —
   found for the first time this session; not the same as either vendored copy this session had
   been comparing) — the fix is already at the source, not just downstream.
2. `kit-new-project-shell.mjs`'s `shellFiles` missing `kit-staging-export.mjs` — checked directly
   in the canonical root too (not assumed from Jayshankar's copy alone): already fixed there as
   well, same "Fixed 2026" comment present.

**The 3 candidates: correctly deferred, not accepted.** All 3 came from one consumer project
(`text-extractor-from-html`); 2 of the 3 are framed as "two datasets" through the same codebase,
not two independent TINS consumers — the submitter's own triage note got this exactly right
against the kit's 2-consumer bar (the same discipline `manual-relay-worker-loop.md`'s own D31/D32
already established). Agreed with that self-assessment rather than re-deriving it; nothing added
to the kit's patterns from this batch. Re-ran `kit-ingest.mjs --archive`: correctly still reports
0 candidates (the hand-authored file's prose format isn't the pre-mined structured shape
`kit-ingest.mjs` expects to auto-score — a real, minor gap, not chased further here since the
human/LLM-readable judgment call was already made correctly by hand) — inbox entry archived to
`kit-staging/archive/2026-09-11/text-extractor-from-html/`.

**Found, not acted on: the canonical root (`atal-incubation`) and Jayshankar's vendored copy have
diverged substantially beyond these two bugs** — Jayshankar's copy has several newer
prompts/patterns/scripts (D29–D33-era kit growth: `manual-relay-worker-loop.md`,
`tiered-escalation.md`, `third-party-tool-audit.md`, `WORKER-SESSION.md`,
`EXECUTION-MODE-INTERVIEW.md`, `orchestrate.mjs`, etc.) that the canonical root doesn't have yet.
A full sync (`kit-sync.mjs` the other direction, or a proper push-to-canonical) is real, separate
scope — flagged to the user rather than done unprompted; today's task was the two consumers'
reconciliation (D33) plus this inbox item, not a full 3-way kit audit.

**Cross-references:** D33 above; `kit-staging/inbox/text-extractor-from-html/` (now archived);
`kit-staging/triage-2026-09-11.md`; `scripts/kit-extract.mjs`, `scripts/kit-new-project-shell.mjs`.

---

## D35 — Pushed Jayshankar's kit growth up to the real canonical root (`atal-incubation`)

**What changed.** User asked to reconcile the third kit location found while closing out D34
(`C:\Users\user\Desktop\TINS-projects\atal-incubation\tins-kit\` — the actual canonical root per
`VERSIONING.md`'s own layout, not a vendored copy). Used `kit-sync.mjs` exactly as built —
`--to=<canonical-path>` from Jayshankar's kit — treating Jayshankar's vendored copy as the
(more-advanced) source for this one push, the reverse of the tool's normal direction but
mechanically identical.

**Protected the 2 files `VERSIONING.md` Rule 6 names as legitimately independent before running
for real.** Backed up atal-incubation's own `HANDOVER.md`/`BUILDER-DECISIONS-REVIEW.md`, ran the
sync (46 files copied, 109 unchanged, 3 preserved), restored those 2 immediately after — `dry-run`
first showed the tool would have overwritten them too; it has no file-level exclusion flag.
`SPEC.md`/`INDEX.md` were correctly left to sync normally — Rule 6 names only the kit's own
HANDOVER/BUILDER-DECISIONS-REVIEW, not these.

**A real gap found by actually running the gate after, not assumed clean from the sync report
alone.** `validate.mjs` (freshly synced in) failed 4/83 — §8.33a-d, all requiring
`examples/autonomous-todo-app/` to exist. `kit-sync.mjs` deliberately excludes `examples/` by
design (D36's own comment: "reference material for a person," not meant to bloat every vendored
copy) — but a validator check added alongside that same D36 work requires it to exist regardless,
an inconsistency nothing had hit before because no full kit-sync into a fresh/older target had
been run against these particular checks until now. Copied `examples/` (308K) into
atal-incubation directly — the exclusion's own rationale argues FOR the canonical root keeping
it, even though per-consumer vendored copies shouldn't carry it. 83/83 after.

**Also cleaned up:** atal-incubation had its own independent, still-pending
`kit-staging/inbox/text-extractor-from-html/` (a separate copy of the same D34 item, apparently
distributed to multiple inbox locations at some point) — confirmed byte-identical to the
already-archived version before removing the duplicate rather than leaving two copies of the
same processed item.

**Verified after, not assumed.** `node --test scripts/selftest.mjs` (56/56) and
`node scripts/validate.mjs --spec=SPEC.md` (83/83) both re-run directly at the canonical root
after every change above, not just at Jayshankar's own copy.

**Not done: class-fun-ef's copy has its own separate, still-unprocessed inbox duplicate of the
same item** (`/mnt/d/Python-AI_ML-SRM/class-fun/tins-kit/kit-staging/inbox/text-extractor-from-html/`)
— this session's sandbox can't write there; flagged back to that session directly rather than
left silent.

**Cross-references:** D33, D34 above; `scripts/kit-sync.mjs`; `VERSIONING.md` Rules 1, 6;
`examples/autonomous-todo-app/`.
