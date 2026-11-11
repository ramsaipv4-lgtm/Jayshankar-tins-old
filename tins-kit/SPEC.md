<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:ANY -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->

# tins-kit — Canonical Specification (v1)

> **A library of TINS (There Is No Source) patterns, prompts, schemas, scripts, and templates,
> informed by three real reference projects.**
>
> The kit is itself a TINS project. It consumes its own methodology. If the kit is wrong, the
> document was wrong.

---

## 0. Preamble

### 0.0 Cheapest version that would work

A single TINS spec template (`templates/SPEC.md`) with TINS markers, the §0.2 decision table
format, the §8 acceptance-criteria format, and a one-page "how to interview first" guide. That
template alone delivers ~70% of tins-kit's value. The rest of the kit (lib/, scripts/, prompts/)
is a multiplier on the same patterns.

**The expensive version below buys:**

- A **standardised interview** (`prompts/SPEC-AUTHOR.md`) that any LLM session can run to
  produce a new consumer's SPEC.md, instead of every session re-inventing the questions.
- A **reusable validator** (`scripts/validate.mjs`) that runs the spec's acceptance criteria
  and fails the build loudly — instead of every consumer writing their own.
- A **multi-tenant RLS primitive** (`lib/tenant-rls/`) that ships the two-Prisma-client +
  `app.current_tenant` + `withTenantTx` pattern, tested once, used by every consumer that
  needs tenant isolation.
- A **self-maintaining docs system** (`lib/docs-guardian/`, `scripts/docs-guardian.mjs`,
  `scripts/docs-update.mjs`) that catches stale docs automatically, instead of every consumer
  rediscovering the problem in 6 months.
- A **handover discipline** (`HANDOVER.md` template, `templates/BUILDER-DECISIONS-REVIEW.md`,
  `templates/REVIEWER-DECISIONS-REVIEW.md`) so a future session opening a consumer's repo
  cold knows the state in 10 minutes.

**What the kit is NOT:**

- Not a runtime dependency. Consumers do not `npm install tins-kit` and import from it. The
  kit ships **files** the consumer copies or links. (D1)
- Not a UI library. The kit does not ship React components. It ships *patterns* and
  *primitives* the consumer adapts.
- Not a one-size-fits-all starter. A consumer picks the modules it needs. The fish-wholesale
  app needs `lib/tenant-rls/` but not `lib/pwa-config/`. The student-incubation platform
  needs `lib/tenant-rls/` and `lib/audit-viewer/` but not the offline-first PWA. The
  exam-prep site needs none of them — it's single-user, single-tenant, static-only.

### 0.1 What this document is

This is the **canonical specification for tins-kit**. Under TINS this file *is* the source:
the kit is generated from it, and defects are fixed by editing this file and regenerating.

It supersedes and absorbs the following prior work:

| Prior work | What the kit absorbs |
|---|---|
| `exam-forge/SPEC.md` (1,196 lines, exam-prep study site) | The **methodology itself**: locked-decisions table format, validator discipline, "cheapest version" line, the reviewer's lessons (#1, #2, #3 — "what is the cheapest artefact", "use a real user as a gate", "TINS must be used not just paid for") |
| `exam-forge/BUILDER-DECISIONS-REVIEW.md` and `REVIEWER-DECISIONS-REVIEW.md` | The **role-separation pattern** (Builder / Reviewer / Maintainer) and the **decision-log template** |
| `exam-forge/scripts/`, `exam-forge/AGENTS.md`, `exam-forge/HANDOVER.md` | The **handover 2-doc system** (AGENTS 1-page + HANDOVER work system) and the **zero-dependency scripts** discipline |
| `jayshankar/SPEC.md` (1,046 lines, fish-wholesale inventory) | The **3-mode lifecycle** (Demo → Pilot → Production), **demo data is real-schema fake-content** (D14), the **per-batch pricing** pattern, the **append-only audit log with RLS-protected trigger** pattern |
| `atal-incubation/specs/SPEC-v3.md` (1,706 lines, multi-tenant incubation SaaS) | The **3-doc handover extension** (adds `TRAININGS.md` for debugging wisdom), the **self-maintaining docs system** (`docs/DOC-MAP.md` + `docs-guardian.mjs` + `docs-update.mjs`), the **two-Prisma-clients + multi-tenant RLS** primitive, the **money-as-Decimal** standing rule, the **TINS markers** (`<!-- TINS Specification v1.0 -->` + `<!-- ZS: -->...<!-- /ZS: -->`) |
| `atal-incubation/AGENTS.md` | The "two-pronged knowledge system" concept: the spec is the source, the train/handbook teaches the craft |

### 0.2 Locked design decisions

| # | Decision | Resolution | Source |
|---|---|---|---|
| **D1** | **tins-kit is a library of files, not a runtime dependency.** Consumers do not `npm install` it. The kit ships files (scripts, prompts, templates) that are copied, linked, or vendored into a consumer project. A consumer that does want a runtime dep can wrap individual `lib/` modules as npm packages, but the kit's primary delivery is **git submodule or file copy**. | LOCKED | exam-forge's zero-dependency rule, reinforced by atal-incubation's "scripts/ are zero-dependency" |
| **D2** | **tins-kit consumes its own methodology.** Changes to the kit's prompts, schemas, scripts, or templates go through this SPEC.md first, the way changes to a consumer's product go through its SPEC.md. The kit's HANDOVER.md and AGENTS.md follow the same format consumers are expected to follow. | LOCKED | TINS — the methodology is the standard |
| **D3** | **`scripts/` is zero-dependency.** Every script in `scripts/` runs on Node 18+ ESM with built-in modules only. No `chalk`, no `lodash`, no `axios`, no `zod` in the script code. The pipeline must run before any `npm install`. | LOCKED | exam-forge's "scripts/ is zero-dependency by design — the pipeline must run before any `npm install`" |
| **D4** | **`prompts/` are paste-into-fresh-session format.** Every prompt file in `prompts/` is a complete message an LLM session can ingest. No "see also" links across files. If a prompt needs supporting context, that context is included in the prompt or referenced by absolute path. | LOCKED | SPEC-AUTHOR.md is the canonical example; the kit's prompts are versions of it |
| **D5** | **`lib/` modules are framework-agnostic where possible, with a thin framework adapter layer where not.** `lib/audit-viewer/` is pure TS (no React, no Prisma — just types and a render function). `lib/tenant-rls/` is Prisma-specific (the primitive only makes sense with Prisma + Postgres). `lib/pwa-config/` is Vite-specific. The rule: the *core* of a module is framework-agnostic; the *adapter* is the only framework-specific part. | LOCKED | Multi-stack reference: exam-forge is Vite+React, jayshankar is Vite+React+Supabase, atal-incubation is Next.js+Prisma+Postgres. The kit must serve all three. |
| **D6** | **Schemas are JSON Schema for static artefacts, Zod for runtime inputs.** `schemas/tins-markers.schema.json` validates the `<!-- ZS: -->` block in a SPEC.md header. `schemas/locked-decisions.schema.json` validates the §0.2 table structure. Runtime validation (request bodies, env vars) is left to the consumer's chosen validator; tins-kit ships Zod examples in `templates/zod-schemas/` but does not mandate Zod. | LOCKED | exam-forge and atal-incubation both use Zod at runtime; the schema layer (DB, JSON) is always static-typed |
| **D7** | **The kit ships a self-test that proves the validator fails on known defects.** `scripts/selftest.mjs` runs validator checks against deliberately broken inputs and asserts the validator catches each one. A validator nobody has watched fail is decoration. | LOCKED | exam-forge's "the validator is the arbiter, and a self-test that proves the validator can fail" |
| **D8** | **The self-maintaining docs system is opt-in but recommended.** Consumers that adopt `lib/docs-guardian/` (the `DOC-MAP.md` + `docs-guardian.mjs` + `docs-update.mjs` trio) get automated stale-doc detection. Consumers that don't adopt it are responsible for keeping their docs in sync manually. The kit ships the trio because atal-incubation proved it works; the consumer decides whether to use it. | LOCKED | atal-incubation's W9 task and `docs-guardian.mjs` |
| **D9** | **The locked-decisions table format is the standard for every consumer.** Every consumer SPEC.md has a §0.2 table with rows `(#, Decision, Resolution, Source)`. The kit's templates enforce this structure. Consumers may add columns; they may not remove `Decision` or `Resolution`. | LOCKED | All three reference projects use the same format |
| **D10** | **The role-separation pattern (R1 Author / R2 Builder / R3 Reviewer / R4 Maintainer) is recommended at every mode boundary, not after every W item.** The reviewer's most valuable findings are at the meta-level ("should this exist?", "what's the cheapest version?"). Spawning a reviewer session after every work item is expensive and dilutes the role. The kit recommends reviewer sessions at end of Mode A / Mode B / Mode C (per jayshankar's lifecycle) and after any major SPEC amendment. | LOCKED | atal-incubation's "W1–W8 work queue" plus the reviewer's #1 finding in exam-forge |
| **D11** | **The "cheapest version that would work" line is mandatory at the top of every consumer SPEC.** §0.0 of every consumer's SPEC.md must name the cheapest artefact (often: a Google Sheet, a static HTML file, a CLI script) and what the expensive version buys. The reviewer checks for this on every review. | LOCKED | exam-forge REVIEWER's "Nobody ever priced the cheap version" — the kit adopts this as a hard rule |
| **D12** | **The interview is mandatory before the spec is written.** The kit's `prompts/SPEC-AUTHOR.md` runs a 7-question interview followed by A/B/C (measure input data, check for rot, propose data format) before any feature is drafted. The LLM does not write the spec until the user has answered the interview and approved A/B/C. | LOCKED | SPEC-AUTHOR.md's "Before writing anything, interview me" |
| **D13** | **Money is `Decimal`, never `Float`.** Consumers whose domain has money adopt this rule. The kit ships a Zod schema and a Postgres migration snippet in `templates/money-as-decimal/` for the common cases. The kit does not enforce this for domains that have no money (e.g. exam-forge's content pipeline). | LOCKED | atal-incubation's "Money is Decimal, never Float" as a standing rule |
| **D14** | **Multi-tenant RLS is opt-in.** `lib/tenant-rls/` is one of the most valuable modules in the kit, but not every consumer needs it. Single-user apps (exam-forge) skip it. Single-tenant multi-user apps (Jayshankar's Mode A Demo) skip it. Only multi-tenant SaaS apps (atal-incubation, Jayshankar's Mode C) use it. The kit ships the primitive; the consumer decides. | LOCKED | Three reference projects show three tenancy profiles |
| **D15** | **The kit does not pick a hosting target.** The three reference projects ship to GitHub Pages (exam-forge), Netlify (jayshankar), and Docker + Kubernetes (atal-incubation). The kit ships `lib/pwa-config/` (Vite plugin pattern) as a building block; the consumer picks the host. The kit's standing rule is "no backend by default" (D8 in jayshankar), but `lib/tenant-rls/` requires a Postgres backend, so the rule is "no backend UNLESS you adopt a backend module". | LOCKED | All three reference projects differ on hosting; the kit must not lock in one |
| **D16** | **The kit is itself versioned using TINS.** A change to a kit module is a change to the consumer's repository too. The kit ships a migration story: when `lib/tenant-rls/` changes, consumers run a documented migration script (or re-derive from the new kit version, TINS-style). | LOCKED | TINS is the methodology; the kit applies it to itself |
| **D17** | **The kit is evergrowing, not exhaustive, AND the loop is bidirectional.** The gap analysis (`docs/GAP-ANALYSIS.md`) is the first snapshot of "what the kit should ship." Future sessions add more patterns / modules / scripts as new consumer projects crystallise more lessons. The loop has two halves: (1) Kit → Consumer (scaffold via `new-project.mjs`, use via `kit-coverage.mjs` + the patterns); (2) Consumer → Kit (auto-extract via `scripts/kit-extract.mjs`, triage via `prompts/KITTING-REVIEW.md`, land via the KITTING workflow). The kit promises the *closed loop* that grows it, not a fixed list. | LOCKED | The 5 reference projects (exam-forge, Jayshankar, atal-incubation, Data-cleaning-script, package5) show that patterns emerge from real consumer work, not from up-front design. The auto-extraction was added in session 8 (2026-08-15) to close the loop the user identified was missing. |
| **D18** | **The kit's `lib/patterns/` directory is doc-only recipes (architect's-eye view); `lib/<module>/` is code + README + tests.** The two are complementary. A pattern without a code module is a recipe with no ingredients; a code module without a pattern is ingredients with no recipe. | LOCKED | The atal-incubation `lib/prisma.ts` is 254 lines; the kit needs a focused 1-page recipe + a focused 200-line drop-in. |
| **D19** | **Every kit pattern follows the 4-section structure: §0 Why this exists, §1 The 3 lessons, §2 The 3 known anti-patterns, §3 When this pattern changes.** The validator parses for these headings. A pattern with a different structure fails the gate. | LOCKED | The atal-incubation "FRONTEND-OVERHAUL.md" was unstructured and hard to consume; the kit adopts a single canonical structure. |
| **D20** | **Every kit code module follows the layout: `index.ts` + `README.md` + `<impl>.ts` + `tests/<name>.test.ts`.** The validator parses for this layout. A module missing any file fails the gate. | LOCKED | The 3 reference code modules (no-backend, money-as-decimal, tenant-rls) all shipped with this layout. |
| **D21** | **The kit's `scripts/` is the consumer's workflow automation.** `migration-runner.mjs`, `decision-log.mjs`, `kit-coverage.mjs`, `kit-listing.mjs`, `kit-new-pattern.mjs` are CLI tools a consumer runs against their own repo (or against the kit). They are zero-dep (D3) and runnable in any Node 18+ shell. | LOCKED | The atal-incubation `docs-guardian.mjs` + `docs-update.mjs` proved that small, focused CLI scripts are the right delivery vehicle. |
| **D22** | **The kit's `schemas/` is JSON Schema for static artefacts only.** Runtime input validation is the consumer's responsibility (Zod, Valibot, etc.); the kit does not ship a runtime validator. The 4 schemas (tins-markers, locked-decisions, handover, tins-spec-minimal) are for "is this a valid TINS file?" checks, not for "is this a valid request body?" checks. | LOCKED | D6 already locks this split; D22 makes it explicit. |
| **D23** | **The kit's `docs/` is workflow + conventions, not tutorials.** `WORKFLOW.md` is the consumer's end-to-end flow (5 steps from "I have an idea" to "I have a working consumer"). `LIBRARY-CONVENTIONS.md` is the contributor's "how to write a new `lib/` module." `KITTING.md` is the contributor's "how to add a new pattern to the kit." No "what is TINS" tutorial — that's `prompts/SPEC-AUTHOR.md`'s job. | LOCKED | The 3 reference projects each had a "how we work" doc; the kit adopts the pattern at the meta level. |
| **D24** | **The kit's gate is `validate.mjs` + `selftest.mjs`.** Every change to the kit (new pattern, new module, new script, new schema) must come with: (a) a §8.X acceptance criterion in this SPEC, (b) a `validate.mjs` check, (c) a `selftest.mjs` case. A change without all three is incomplete and fails the next gate run. | LOCKED | atal-incubation's `HANDOVER.md` §5 rule "Before stopping: `pnpm typecheck` + `pnpm build` must be green" — applied to the kit itself. |
| **D25** | **The kit is the source of truth; consumer projects vendor a copy at `<project>/tins-kit/`.** The kit lives at the top level of the workspace (`<root>/tins-kit/`). Each consumer project is a sibling of the kit and has the kit vendored inside. The bidirectional loop (D17) is project-aware: a project's LLM session runs `tins-kit/scripts/kit-extract.mjs --consumer=.` to mine learnings; the kit-growth session at the kit root runs `tins-kit/scripts/kit-sync.mjs --to=<project>` to push the new kit back. The "absolutely must follow" doc for any LLM is `PIPELINE.md` at the kit root; the per-project extension is `AGENT-BRIEF.md` at the project root. | LOCKED | The 2026-08-15 restructure (session 9) lifted the kit from `Jayshankar/tins-kit/` to top-level, extracted the 5 projects to siblings, vendored the kit into each, and added the `PIPELINE.md` + `VERSIONING.md` + `kit-sync.mjs` machinery. |
| **D26** | **The kit has a `kit-staging/` inbox + a portable kit shell + 2 generic prompts for the LLM.** A consumer project that doesn't have a vendored `tins-kit/` (because it's on a different machine, predates the kit, or is a one-off experiment) ships its kit-worthy artefacts to `tins-kit/kit-staging/inbox/<project-name>/`. The kit-growth session at the kit root runs `scripts/kit-ingest.mjs` to scan the inbox and produce a merged triage report. The new-project flow is captured in `prompts/NEW-PROJECT.md` (a copy-paste prompt for starting a project from the kit shell). The kit-growth flow is captured in `prompts/KIT-GROWTH-SESSION.md` (a copy-paste prompt for triaging the inbox). The portable kit shell is scaffolded via `scripts/kit-new-project-shell.mjs` and exported via `scripts/kit-staging-export.mjs`. | LOCKED | The user asked (session 10) for a mechanism to handle projects on other machines / future projects / projects the kit doesn't know about yet. The staging area is the transport layer; the kit shell is the portable subset; the 2 generic prompts are the LLM-facing workflows. |
| **D27** | **The kit ships an INDEX + 4 generic prompts — one per scenario in the user-facing flow.** The INDEX is a 1-page selective-chooser at `tins-kit/INDEX.md` that lists every asset with a 1-line brief, so a fresh LLM can scan the menu in 3 minutes instead of `ls`-ing the kit. The 4 generic prompts are: (1) `NEW-PROJECT` — start a new TINS project from the kit shell; (2) `PROMOTE-TO-TINS` — retro-fit an existing project (built without the kit) into a TINS project; (3) `CONTINUE-TINS-PROJECT` — pick up an existing TINS project and add a new W; (4) `KIT-GROWTH-SESSION` — at the kit root, triage the inbox. Every consumer LLM session picks one of the 4 prompts based on which scenario it's in. The prompts are paste-into-fresh-session format (D4) and self-contained. | LOCKED | The user asked (session 11) for "a generic copy-paste prompt for any project I generate in the future" + an INDEX so the LLM "selectively choose[s] which skill to take ... not reinvent the wheel." The 4 scenarios are: (1) new from scratch, (2) retro-fit existing non-TINS, (3) continue existing TINS, (4) kit-growth at the kit root. The INDEX is the entry point; the prompts are the substance. |
| **D28** | **An existing tins-kit website can get a frontend refresh — survey-first, install-or-recreate, 5 named reference libraries.** `prompts/FRONTEND-REFRESH.md` is a specialized W within Scenario 3 (`CONTINUE-TINS-PROJECT.md` routes to it for frontend-visual-redesign W's) that refreshes ONLY the frontend of an existing tins-kit-built site, any framework/language, backend/DB/business-logic untouched. It shares its design-vision interview (`prompts/FRONTEND-VISION-INTERVIEW.md`) with `prompts/SPEC-AUTHOR.md`'s new-website path (triggered as Step 7a, after the core 7 questions, only when the project is a website) — one interview, two trigger points, per D4. The interview surveys the user's vision (researching inspiration sites if unsure) and locks per-library install-vs-recreate decisions against 5 references: `anime.js` and `motion` (framework-agnostic, almost always `npm install`), and `kokonut-ui` / `bklit-ui` / `shadcn` (React + Tailwind + shadcn-CLI copy-paste only — installed if the target stack matches, otherwise recreated natively, never copied wholesale into a mismatched framework). None of the 5 require a 3rd-party CDN at runtime once wired in. "Correct" is two-fold and recorded in `FRONTEND-VISION.md`: `approved_before` (the user signs off on the vision + inspiration links pre-build) and `approved_after` (the user signs off that the new frontend correctly links to backend/DB/3rd-party services POST-build) — scoped to the project's current mode (A/B/C) at survey time, not to a future finalized backend that may not exist yet. Out of scope for v1: no backend/API/schema/business-logic changes; no production deployment (localhost-verified only); no libraries beyond the 5 without a kit-growth decision. | LOCKED | User-requested (session 12): "update tins-kit to ensure that after taking an existing project that was built using tins-kit ... update it using the listed css libraries after the llm takes a survey of the user." Interview + A/B/C pass + live sign-off recorded in `BUILDER-DECISIONS-REVIEW.md`. |
| **D29** | **A TINS consumer project can split its remaining locked work across multiple LLM sessions or people and build it in parallel — self-mode with full continuity, external-mode with a scrubbed, repo-free packet.** `prompts/DELEGATE-WORK.md` is a specialized W within Scenario 3 (`CONTINUE-TINS-PROJECT.md` routes to it) that splits the remaining work covered by an already-*locked* spec section into independent tasks. It requires a round-level **self vs. external** decision (overridable per task): self-mode is the same person directing every executor, however many LLM accounts/platforms, so nothing is hidden and the task runs the normal `CONTINUE-TINS-PROJECT.md` flow in a full clone with full decision-log continuity; external-mode is someone else (a hired human, or their own LLM session) directing it, so the task gets a scrubbed, self-contained **task packet** only — no repo access, no git history, no TINS vocabulary — built from `templates/TASK-BRIEF.md` (written like a company ticket: Context, Scope, Interface Contract, Acceptance Criteria, Out of Scope, Definition of Done) plus a `files/` folder scoped to exactly that task's touched files and a blank generic `NOTES.md`. Independence is defined generically: two tasks are independent if their touched-file sets don't intersect and neither's interface contract depends on the other's output; `scripts/check-task-independence.mjs` checks the file-set half mechanically against `delegation/LEDGER.md` and must exit 0 (recommending a merge, delegated to a senior engineer or a frontier model at extended/max thinking, on any conflict) before any packet is built — full contention is de-risked before anything is ever handed out, not flagged after. Every external-mode packet is scanned by `scripts/scan-task-packet.mjs` for methodology fingerprints and path escapes before it ships — defense-in-depth on top of the template, not instead of it. `prompts/INTEGRATE-DELEGATED-WORK.md` brings returned tasks back together: self-mode tasks merge directly (already using the project's real vocabulary); external-mode tasks' `NOTES.md` is read and translated into the real `BUILDER-DECISIONS-REVIEW.md` via `decision-log.mjs` — the same recovery step for every packet, regardless of who did the task, rather than only for self-directed work. Small integration discrepancies are auto-fixed and noted; anything touching behavior, security, or scope is explained to the user *before* being applied. Coordination is entirely file-based and lives in a per-*project* `delegation/` folder (never at the kit root, and never a `kit-staging/`-style shared inbox — that convention is unidirectional, kit-rooted, and 2-state, where this needs to be bidirectional, project-local, and multi-state). Out of scope for v1: no live/shared coordination service; no automated task-dependency scheduling beyond the file-overlap check; no legal/NDA tooling (the scanner is a technical safeguard, not a legal one). | LOCKED | User-requested (session 13): "i am planning to update tins-kit to support multiple llm's or humans working on the same project ... the first author gets to finalise and set the vision in place and once that is locked in a set of tasks that are independent of each other just need to be built independently." Interview across several rounds; self-vs-external split, `kit-staging/`-pattern pushback, and the notes-recovery design all explicitly confirmed live with the user. |
| **D30** | **A finished TINS project can be packaged for public release — methodology and LLM-authorship fingerprints scanned out of the whole tree, public docs written in a corporate voice, held to a rubric aimed at real technical scrutiny, not just the absence of known strings.** The intent question is asked at the very start of every project, unconditionally (any project type, not gated like D28's website check): question 8 of `prompts/SPEC-AUTHOR.md`'s interview asks whether public release is ever intended and records `Public release intended: TRUE/FALSE` as a locked row in the consumer's own SPEC.md §0.2 — a discipline decision, not a gate, since answering FALSE doesn't foreclose release later, it just means more cleanup then. The actual packaging is a separate, later trigger: `prompts/PUBLISH-OPEN-SOURCE.md`, a specialized W within Scenario 3 (`CONTINUE-TINS-PROJECT.md` routes to it) run whenever release actually happens, requiring the gate green first. It delegates its mechanics entirely to `lib/patterns/private-to-public.md` (rewritten for D30) and the newly-real `scripts/private-to-public.mjs` — previously only embedded as a code block inside the pattern doc, never shipped as an actual file; D30 promotes it, and while doing so fixes a latent bug in the inherited copy-filter (a `pathMatches` special-case matcher that never actually matched glob patterns like `scripts/*.mjs`, replaced with a small glob-to-regex converter). The script copies the include/exclude file set from the pattern's table, mechanically rewrites the TINS marker-line comment, then scans the ENTIRE destination tree — every file, including in-line code comments, not just a handful of known files — against its own banned-terms list, covering two categories: methodology fingerprints (kit file/term names) and LLM-authorship fingerprints (model/vendor names, leftover assistant-speak like "as an AI" or "Certainly!"), refusing to call the tree clean until both are absent (exit 0 clean / 1 leaks found / 2 usage error, mirroring `scan-task-packet.mjs`'s shape). This banned-terms list is **deliberately kept separate** from `scan-task-packet.mjs`'s (D29) — the two solve different problems (one scoped task packet vs. a whole publicly-released project) and the kit does not merge them, so tightening one never silently loosens the other; this is revisitable later if real drift becomes a maintenance burden, but not before. Public documentation (README.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/SCHEMA.md, and a new `docs/DESIGN-WALKTHROUGH.md` for non-trivial subsystems) must read in a corporate, professional voice — no first-person LLM voice, no hedging, no stock AI openers/closers — because the release bar is not "no TINS-shaped strings," it's whether a skeptical engineer could genuinely study, explain, or re-implement pieces of it under real scrutiny; a 5-question quality rubric in the pattern's §3.7 checks for that directly (re-implementable from the docs alone, every non-obvious choice has a stated reason, at least one rejected alternative per major decision, survives "why not X instead," setup instructions actually work). Out of scope for v1: no automated corporate-tone rewriting (a human or an LLM instructed accordingly writes the docs; the scanner and rubric are checks, not authors); no merging of the two banned-terms lists; the deeper "repurpose this documentation into a full teaching/interview-prep curriculum" idea the user also raised is explicitly NOT built here — it shipped one session later as D31. | LOCKED | User-requested (session 14): "lets finish d30 too," following up on the candidate noted at the end of D29. Interview across two rounds: the user asked to substantially rework `lib/patterns/private-to-public.md` (not just promote the script as-is), wants in-line comments in scope for scrutiny (settled by the whole-tree scan design, which scans every file including comments as a side effect rather than needing a separate comment-parser), wants public docs to read as fully corporate with no LLM tells, confirmed keeping D29's and D30's banned-terms lists separate for now, confirmed a two-trigger design (an unconditional early question plus a later dedicated packaging prompt) mirroring D28's shared-interview pattern, and confirmed scoping the curriculum-generator idea out to a deferred D31 candidate rather than attempting it alongside D30. |

| **D31** | **A finished project's private working history can be turned into a standalone teaching / interview-prep curriculum — a sibling artifact with its own instructional voice, generated fresh-session from real project material, chunked one file per turn with resumable progress tracking.** Two new fresh-session prompts (D4), both run after `prompts/PUBLISH-OPEN-SOURCE.md`: `prompts/GENERATE-CURRICULUM.md` (the core pass — primer, prerequisite map, glossary, concept-to-code index, milestones/pacing, and per-module content) and `prompts/GENERATE-INTERVIEW-PREP.md` (a separate later pass, first-principles reimplementation drills only). **Location and voice are deliberately split from D30's public product repo:** the curriculum lives in its own sibling folder (`<project>-curriculum/`, alongside the private working copy and the D30 public repo, not inside either), because good teaching material is written in second-person instructional voice ("try this yourself," "here's a question to test your understanding") — which is *correct* pedagogy, not a tone leak, but is exactly what D30's corporate-product voice rubric forbids. Putting the two in the same repo would force one to compromise the other; splitting them lets each have the right voice for its own audience. **Source discipline follows D4, not session continuity:** both prompts run in a fresh session reading the real artifacts (`SPEC.md`, `BUILDER-DECISIONS-REVIEW.md`, `HANDOVER.md`, the code) — never the original builder session's conversation memory — matching exactly how `PUBLISH-OPEN-SOURCE.md` and `DELEGATE-WORK.md` already work; if a fresh session reading the decision log can't produce good curriculum content, that reveals the decision log wasn't capturing enough, which is a documentation gap to fix upstream, not a reason to route around fresh-session discipline. **Safety reuses D30's existing scanner as-is — no new script, no new banned-terms list:** both prompts' final gate is `node tins-kit/scripts/private-to-public.mjs <curriculum-dir> --scan-only`. This is deliberate, not a shortcut — the curriculum needs to stay clear of the exact same two things D30 already blocks (kit/TINS-methodology vocabulary and LLM-authorship fingerprints), so reusing the identical list is the *correct* choice, not the lazy one; a curriculum that explains "the team wrote a specification first" and "decisions were logged with context/alternatives/consequences" in generic engineering language teaches the real practice without ever naming the proprietary methodology that produced it. **Generation mechanics, to keep single-turn output maximally descriptive without hitting the context window:** each prompt's first step produces a manifest of every file it will write; generation then proceeds strictly one file per turn, in full detail, explicitly pausing after each rather than compressing multiple files into one response; a derived `CURRICULUM-PROGRESS.md` (raw starter at `templates/CURRICULUM-PROGRESS.md`) tracks pending/done per file so a fresh session can resume a run that didn't finish in one sitting. **Content scope confirmed in full** (the user chose the maximal option at every fork): `00-START-HERE.md` (primer assuming none of the background the original project assumed, plus a prerequisite map), `GLOSSARY.md`, `CONCEPT-TO-CODE-INDEX.md` (curriculum section → real file/line reference), `MILESTONES.md` (pacing/checkpoints), and per-module `modules/<NN>-<name>/` folders each with a `README.md` (what/why/how, expanded from `docs/DESIGN-WALKTHROUGH.md`), a `SCENARIO-QUESTIONS.md` (LeetCode-style questions framed as the module's own real acceptance criteria, not generic problems), and — where a real bug exists in that module's decision-log history — a `DEBUGGING-CASE-STUDY.md`. **The debugging case study format directly implements the user's "write buggy code first, then resolve it" pedagogy using real history instead of fabricated bugs:** it presents the real buggy situation and an explicit "before reading on, diagnose this yourself" prompt, THEN reveals the real diagnosis and fix pulled from the decision log's Context/Decision/Consequences fields; a module with no real bug in its history gets no `DEBUGGING-CASE-STUDY.md` rather than an invented one. `prompts/GENERATE-INTERVIEW-PREP.md` produces `interview-prep/00-OVERVIEW.md` plus one guided from-scratch reimplementation exercise per core CS/systems concept the stack touches, and — mirroring D29's `check-task-independence.mjs` precedent of naming a model-tier recommendation for a specific hard sub-task — explicitly recommends running it with a frontier model at extended/max thinking, since a from-scratch systems-level reimplementation exercise is easy for a weaker model to get subtly, confidently wrong. Out of scope for v1: no automated code-quality grading of a learner's attempts at the exercises; no interactive/quiz-app delivery (the curriculum is markdown, read by a human, not a served application); no mechanism to keep the curriculum in sync automatically as the project changes after generation (re-running the prompt regenerates it; there is no incremental-diff mode). | LOCKED | User-requested (session 15): "lets finish d31," following the candidate deferred at the end of D30. Interview across four rounds: confirmed the full content scope including the full first-principles-reimplementation option at every fork (not the scoped-down or deferred options offered); worked through, live, whether curriculum generation needs the original builder session's context (resolved: no, fresh-session-reading-real-artifacts per D4, same as D30) and whether reimplementation drills need a stronger model (resolved: yes, explicit frontier-model recommendation per the D29 precedent); confirmed the sibling-folder location and the two-prompt split, both with the user's explicit reasoning check ("let's discuss") before locking in; confirmed the manifest-first, one-file-per-turn, maximally-descriptive chunking mechanism the user asked for to avoid hitting the output window; confirmed resumability via a progress-tracking file; final folder-layout proposal confirmed as-is in the closing round. |
| **D32** | **Once the spec is locked, the agent harness stands up an auditor (master) session and worker (slave) sessions that drive the existing D29 parallelisation pipeline to completion on their own, escalating only decisions an LLM must not make alone.** The kit ships a harness-agnostic **contract** plus a **reference runner**, not one blessed mechanism: `prompts/AUTONOMOUS-BUILD.md` (the auditor's contract) and `prompts/WORKER-SESSION.md` (the worker's contract) are normative, and `scripts/orchestrate.mjs` is one conforming implementation. A harness with native subagent spawning satisfies the contract without the script; a harness without one uses the runner, which spawns workers through a configurable `--worker-cmd` template with presets for the common harnesses. **All run state lives in files, never only in the auditor's context** — D29's `delegation/LEDGER.md` is the state machine (statuses extended to `ready` / `running` / `returned` / `blocked-escalation` / `integrated` / `failed`), `delegation/ORCHESTRATION.json` is the run config, `delegation/ESCALATIONS.md` is the question queue — so a crashed or context-exhausted auditor is resumable by a fresh one reading the same files, which is the whole reason the state is not held in a conversation. **This is a driver on top of D29, not a second parallelisation pipeline:** the task split, the exhaustive touched-file lists, `scripts/check-task-independence.mjs`, and `prompts/INTEGRATE-DELEGATED-WORK.md` are all reused unchanged. Autonomous rounds are self-mode by definition (every session is the same person's), so no packet scrubbing happens in this path and `scan-task-packet.mjs` is not part of it. **Escalation is tiered** (`lib/patterns/tiered-escalation.md`): **T0** decide and log (mechanical, reversible, already settled by the locked spec); **T1** decide, log, and flag in the run digest (judgement inside locked scope — naming, file layout, a choice among genuinely equivalent libraries); **T2** stop and ask the user (irreversible or externally visible: money, credentials, publishing, data deletion, third-party accounts; anything that would contradict or amend a locked §0.2 decision; vision or taste the spec does not settle; legal, security, or privacy judgement; and any call where the model's own confidence is below the bar). **Genuine uncertainty resolves to T2, never T1** — the failure this guards against is a confident wrong call compounding unattended for hours. **A T2 parks its task; it does not halt the run** (the user chose this over halting): `scripts/escalate.mjs` appends the question to `delegation/ESCALATIONS.md` and marks that task `blocked-escalation`, and the auditor keeps building every task that does not depend on it, halting only when nothing runnable remains — exit code 3, "parked with questions outstanding", distinct from 0 (complete) and 1 (a worker failed hard). **The auditor never writes product code.** It decomposes, dispatches, verifies, integrates, and runs the gate; workers write code. A session that wrote the code is the wrong session to judge it, so this separation is what makes the auditor's verification worth anything — the same reasoning as D10's role separation, applied inside a single autonomous run. Every returned task is gated before integration, and a failing task is re-issued to a fresh worker up to the configured retry cap rather than patched by the auditor. Out of scope for v1: no cross-machine or cross-account distribution (every session is local to one harness); no cost or token budgeting beyond `maxParallel` and the retry cap; no automatic merge-conflict resolution beyond what the independence check already prevents; and the auditor may not amend `SPEC.md` — a needed amendment is always a T2. | LOCKED | User-requested (session 16): "once the interview to the user is done I want the agent harness ... to automatically create a auditor (master) and slaves that can run the parallelisation pipeline that we have developed on its own and complete the project on its own ... tiered decisions ... only the absolutely necessary decisions that a llm cannot answer on its own would be forwarded to the user." Interview confirmed the contract-plus-reference-runner shape over a script-only or prompt-only design, and confirmed park-and-continue over halting the whole run on a T2. |
| **D33** | **Before work starts, every new or continued project audits the harness's actual tooling against what the work needs, searches the internet for MCP servers and skills that close the gap, security-audits each candidate, and blocks until every REQUIRED one is installed or waived in writing.** `prompts/TOOLING-AUDIT.md` runs at the front of Scenario 1 (`NEW-PROJECT.md`) and Scenario 3 (`CONTINUE-TINS-PROJECT.md`): inventory what the harness genuinely has (MCP servers, skills, CLI tools), derive from the SPEC or the W what the work genuinely needs, name the gap, and search rather than assume nothing exists to fill it. **Every candidate is audited before it is ever recommended**, against the rubric in `lib/patterns/third-party-tool-audit.md`: instruction-override or prompt-injection text in a skill body, credential and environment access beyond the stated purpose, network egress to undisclosed hosts, obfuscated or encoded payloads, install and postinstall scripts, destructive shell commands, over-broad declared permissions, an unknown or unverifiable publisher, and abandonment. Three verdicts: **SAFE** (recommend), **REVIEW-REQUIRED** (recommend only with an explicit read-this-yourself flag naming the specific lines to look at and why they gave pause), **UNSAFE** (never recommend; record the reason). **Uncertainty resolves to REVIEW-REQUIRED, never SAFE** — the user's "if you are unsure just flag the user to read it" is the default here, not a fallback, because an LLM's confident clearance of a skill it half-understood is exactly the outcome the audit exists to prevent. Findings land in the consumer project's own `TOOLING-AUDIT.md` (from `templates/TOOLING-AUDIT.md`): one row per candidate with the gap it closes, verdict, priority (REQUIRED / RECOMMENDED / OPTIONAL), status (pending / installed / waived), and, for a waiver, the named handicap accepted. **This is a hard blocking gate, chosen by the user over a softer advisory-but-recorded design.** `scripts/tooling-audit.mjs` exits non-zero while any REQUIRED row is still `pending`, and also when any row judged UNSAFE is marked `installed`; work does not proceed past setup until each REQUIRED item is installed or explicitly waived. The user's reasoning is the decisive argument: proceeding "with assumptions and handicaps" is the precise failure being prevented, and a gate that can be skipped silently does not prevent it. A waiver is therefore not a dismissal — it must name the capability given up and where assumptions will now stand in for real data, and it becomes a row in the consumer's §0.2 so the next session inherits the known handicap instead of rediscovering it. **The kit never installs anything and never executes a candidate to evaluate it.** It reports, audits, and blocks; installation is always the user's own action in their own harness, and the audit is static reading of the skill body, the server manifest, and the published source. Out of scope for v1: no runtime sandboxing or dynamic analysis; no scheduled re-audit of already-installed tools (re-audit is triggered by a new W or an explicit request); no private or enterprise registry integration; no automated installation under any flag. | LOCKED | User-requested (session 16): "Scan the internet for any relevant MCP server and skills (do a full audit on the skills to ensure that there is no malicious actors intent hidden in it if you are unsure just flag the user to read it) whenever he is creating a new project or continuing a existing tins-project ... rather than going ahead with assumptions and handicaps." The user explicitly chose the blocking-gate option over the recommended advisory-but-recorded one. |
| **D34** | **A session running `NEW-PROJECT.md` or `CONTINUE-TINS-PROJECT.md` surfaces short, ready-to-paste corrective prompts inline, adapted to how this user is actually using the kit right now — most importantly the moment the model corrects itself.** `prompts/STEERING-PROMPTS.md` is the **catalogue the LLM reads and selects from**, not a document handed to the user: it holds the cards grouped by drift class plus the selection and adaptation rules. **Selection and wording are adaptive, which is the point of the decision** (the user asked for "inline comments that change appropriately based on how the user uses tins-kit," having been offered a static deck and declined it): which cards appear, and how each is phrased, is a function of the scenario the session is in, the project's current mode and W, and what just happened. A card must name the actual artefact, decision id, W, or file at issue in this project — a generic card is worse than no card, because it trains the user to skim past the mechanism entirely. **The drift classes v1 covers:** self-correction (the model contradicted or corrected itself on a recheck — the user's own named example), stale recall (describing a file or decision without re-reading it), scope creep (work drifting past the locked W), spec bypass (code moving ahead of the spec), unearned confidence (a factual claim with no verification behind it), silent assumption (a gap filled without flagging it), and gate avoidance (approaching a stopping point without a green gate). **Emission is at fixed checkpoints and on events:** after the interview or W selection, at the start of each W, immediately after any self-correction or recheck that changed an earlier answer, before the gate, and before handover. The self-correction trigger is mandatory and immediate — the moment the model notices it misremembered, it names the correction out loud and offers the adapted card, rather than quietly fixing the error and moving on, because a silent self-correction is precisely the event the user cannot see and therefore cannot steer. **Cards are offered, never auto-executed:** the user pastes one if they want it, and the LLM does not act on a card's content on the user's behalf. Out of scope for v1: no automatic drift detection beyond the model's own honest self-report; no persistence of which cards were shown across sessions; and no standalone card deck delivered to the user as a file — that shape was considered and rejected, since a static deck goes unread and cannot name this project's actual artefacts. | LOCKED | User-requested (session 16): "we need to ensure that the LLM is also providing prompts that the user can ask at appropriate intervals whenever there is some oversight done by the LLM for example when LLM mis remember something and correct itself during rechecks. to bring it back to track." Offered a deck-file / inline-only / both split; the user answered outside the options with "inline comments that change appropriately based on how the user uses tins-kit," which is what the adaptive-selection rule above encodes. |
| **D35** | **The kit asks the user how a round's work should actually be executed, from a menu of five modes, rather than inferring it from how a W happened to be phrased.** `prompts/EXECUTION-MODE-INTERVIEW.md` is a shared interview with several trigger points (D4, same shape as D28's `FRONTEND-VISION-INTERVIEW.md` — referenced, never duplicated): `prompts/SPEC-AUTHOR.md` and `prompts/NEW-PROJECT.md` once a new spec is locked, `prompts/CONTINUE-TINS-PROJECT.md` Step 2 at the start of each round, and `prompts/AUTONOMOUS-BUILD.md` Step 0 as a precondition check. **The five modes, plus a per-task mix:** `solo` (this session builds it sequentially — the honest default when the remaining work is small or interlocked, since spinning up an auditor and three workers for two files' worth of work costs more than it saves); `auditor-local` (D32's auditor plus workers, all in this harness); `auditor-remote` (the same auditor here, but `workerCmd` points at another LLM CLI the user owns, so orchestration happens in one place while the building spends a different provider's quota); `self-parallel` (D29 self-mode — the user personally drives a session per task across their own accounts and platforms, full repo, nothing scrubbed); `external` (D29 external-mode — scrubbed packets to a hired human or someone else's LLM); and `hybrid`, a round-level word that requires every task row to name a real executor. **`auditor-remote` and `self-parallel` differ by who orchestrates — a session or the person — not by how many LLMs are involved**, and the interview is required to state that distinction explicitly because it is the one users most often collapse. **The recorded answer is a mechanism, not a note.** It lives in `delegation/LEDGER.md`'s round header (`**Execution mode for this round:**`, replacing D29's narrower `**Default mode for this round:** self | external`, with legacy `self` read as `self-parallel`), and `scripts/orchestrate.mjs` reads it literally: it dispatches only `auditor-local`, `auditor-remote`, and the auditor-driven rows of a `hybrid` round, and **refuses `solo`, `self-parallel`, and `external` outright**. That refusal is a safety property rather than a limitation — the user said they would drive that work themselves, or that it is destined for a scrubbed packet, and a runner that quietly did it instead would be overriding a stated decision; the prompts therefore forbid editing the mode to get a command to run. **The question is asked per round, pre-filled with the previous round's answer**, because the right mode genuinely shifts as remaining scope shrinks: five independent modules is a different question from the last two bug fixes, and a session that reuses a project-level answer forever will parallelise work that should not be split. **`prompts/DELEGATE-WORK.md` stops asking its own self-vs-external question** and reads the recorded mode instead, so the user is asked once per round in one place. For `auditor-remote`, `templates/ORCHESTRATION.json` ships worker-command shapes for the common CLIs, verified against each tool's own headless documentation on 2026-08-26 and explicitly marked for re-checking, with the standing advice to run one worker by hand on one task first — a subtly wrong `workerCmd` fails identically for every task, unattended, up to `maxRetries` times each. The interview also has to raise capability asymmetry: a weaker remote worker needs a tighter brief and a narrower task, and it fails subtly and confidently rather than loudly, so a genuinely hard task gets a frontier-model recommendation (the D29/D31 precedent). Out of scope for v1: no automatic mode selection from scope heuristics (the model advises, the user decides); no cost or quota modelling across providers; no capability probing of remote worker CLIs (the kit ships shapes and tells the user to test one); no mode changes mid-round (finish the round or re-run the interview and start a new one). | LOCKED | User-requested (session 17): "the tins-kit needs to ask the user if they want to run the auditor and slave workflow or parallelism (on other llms i own and other options listed there)." Interview across one round of three questions: the user selected all four self-run modes for the menu (solo, auditor-local, auditor-remote, self-parallel), chose to keep external delegation on the same menu so `DELEGATE-WORK.md` stops asking separately, and chose per-round asking with the previous answer remembered over a once-per-project locked row. |
| **D36** | **The kit ships `examples/` — complete, captured runs of its own workflows, including what went wrong.** The first is `examples/autonomous-todo-app/`: a real D32 auditor + worker run that built a zero-dependency todo app from a locked spec across two waves of four worker sessions, with the verbatim worker prompts, each worker's returned report, all four decision logs, the run digest, and the finished code. An example is **a captured run, not a tutorial** — it is written after the fact from what actually happened, and it is required to include the failures. This run found three defects in the kit (a ledger with a second markdown table broke both ledger readers; `escalate.mjs` has no slot for a round-level escalation that belongs to no task; a piped `exit=$?` was twice misread as a script's exit code), one contradiction in the spec being built (§1 promised `file://` while D1 made it impossible), and one worker misdiagnosis another worker corrected — and it says so, because an example that only shows the happy path teaches a workflow nobody will recognise when they run it. The run's honest terminal state is preserved too: it ended **parked at exit 3**, not complete, with two spec amendments only a human may make. Examples are deliberately NOT synced into consumer projects by `kit-sync.mjs` and are not part of the portable shell — they are reference material for a person reading the kit, and vendoring 440 KB of transcript into every consumer would be pure cost. Out of scope for v1: no requirement that every workflow have an example (they are written when a run is worth capturing, not on a schedule); no mechanism to keep an example in sync as the workflow changes (a stale example is re-run or deleted, never patched to look current, since a patched transcript is a fabricated one). | LOCKED | User-requested (session 18): "can u walk me through by scaffolding a subagent that creates a demo project ... run it autonomously and save ur prompts and replies by the subagent and the result saved too ... maybe keep as example?" The run doubled as the reality-check `HANDOVER.md` had flagged as D32's outstanding risk. |

### 0.3 Implementation baseline

**Not yet built.** The kit's SPEC is v1. The work queue (W1, W2, ...) is in `HANDOVER.md` §5. The first deliverable is `prompts/SPEC-AUTHOR.md` (which already exists in the reference material at `archive/exam-forge-reference/SPEC-AUTHOR.md` and is the ancestor of the kit's version).

The kit is informed by three real projects but is itself still a specification. **The proof of value is the first consumer project that uses it.** Until then, the kit is "this is what the patterns would be." Mode A of the kit is "ship the patterns as templates and copy-able files"; Mode B is "use them on the Jayshankar retrofit"; Mode C is "extract the lessons and stabilise."

### 0.4 What the kit absorbs from each reference project

The kit's value is the intersection of patterns that recur in 2+ reference projects. The matrix:

| Pattern | exam-forge | Jayshankar | atal-incubation | Kit absorbs? |
|---|---|---|---|---|
| TINS markers (`<!-- ZS: -->`) | ✅ | ❌ (added post-spec by kit) | ✅ | **YES** — kit standardises the markers |
| Locked-decisions table at §0.2 | ✅ (D1–D12) | ✅ (D1–D17) | ✅ (D1–D8) | **YES** — kit ships a template |
| Validator + self-test | ✅ (`scripts/validate.mjs` + `selftest.mjs`) | ✅ (specified in §8) | ❌ (relies on `pnpm typecheck` + `pnpm build`) | **YES** — kit ships both |
| Zero-dep scripts | ✅ | ✅ (specified) | ⚠️ (most scripts use pnpm-deps) | **YES** — kit's scripts/ are zero-dep |
| AGENTS.md (1-page onboarding) | ✅ | ✅ | ✅ | **YES** — kit ships a template |
| HANDOVER.md (work system) | ✅ | ✅ | ✅ | **YES** — kit ships a template |
| TRAININGS.md (debugging wisdom) | ❌ | ❌ | ✅ | **YES (optional)** — kit ships a template; consumers decide if they need it |
| 3-doc handover (AGENTS + HANDOVER + TRAININGS) | ❌ (2-doc) | ❌ (2-doc) | ✅ | **YES (recommended)** — kit recommends 3-doc for non-trivial projects |
| Self-maintaining docs system | ❌ | ❌ | ✅ | **YES (opt-in)** — kit ships `lib/docs-guardian/` |
| Money as Decimal | ❌ (no money) | ✅ (D7) | ✅ (HANDOVER §5 rule 5) | **YES (opt-in)** — kit ships the pattern for money domains |
| Multi-tenant RLS | ❌ (single-user) | ⚠️ (specified for Mode C) | ✅ (two-Prisma-clients) | **YES (opt-in)** — kit ships the primitive |
| Append-only audit log | ❌ | ✅ (D5) | ✅ (NotificationOutbox etc.) | **YES (opt-in)** — kit ships a Postgres trigger template |
| Per-batch pricing (vs per-SKU) | ❌ (no money) | ✅ (D8) | ✅ (per-application) | **YES (opt-in)** — kit ships a Zod example |
| FIFO spoilage / canonical algorithms | ❌ | ✅ (SPEC §4.3) | ⚠️ (in-app helpers) | **YES (recommended)** — kit ships the "specify algorithms as numbered steps" template |
| PWA + offline graceful degradation | ❌ (static site) | ✅ (D6) | ⚠️ (PWA in §25.2) | **YES (opt-in)** — kit ships `lib/pwa-config/` |
| 3-mode lifecycle (Demo/Pilot/Production) | ❌ | ✅ (D7) | ❌ | **YES (recommended)** — kit ships a Mode-A starter template |
| Roles-as-data (controlled vocabulary) | ❌ (single role) | ✅ (D3) | ✅ (Role enum) | **YES** — kit ships the pattern |
| No `Float` for money | n/a | ✅ (D7) | ✅ (HANDOVER §5 rule 5) | **YES** — same as money-as-Decimal |
| No `DELETE` policy, only soft-delete | ❌ | ✅ (AGENTS §3 rule 5) | ⚠️ (mostly soft-delete, some hard-delete) | **YES** — kit's standing rule for any multi-tenant consumer |
| TINS marker validation | n/a | ❌ | ❌ | **YES** — kit ships `scripts/validate-tins-markers.mjs` |
| Cheapest-version line at §0.0 | ⚠️ (implicit) | ✅ (explicit) | ❌ (no §0.0) | **YES** — kit makes it mandatory (D11) |
| No backend by default | ✅ (D8) | ❌ (Supabase required) | ❌ (Postgres required) | **YES (with caveat)** — kit ships `lib/no-backend/` for static-only consumers; consumers with backend modules override |
| Supabase Auth + `public.users` wiring (FK drop, trigger meta-data, service_role GRANTs) | ❌ | ✅ (decisions 8, 10, 11) | ❌ | **YES** — kit ships `lib/patterns/supabase-auth-trigger.md` (recipe + 4 gotchas + validator checks). Pulled forward from W5 to "now" by the W1.5 live apply. Lesson 4 (the `authenticated` GRANT) added in W2 of Jayshankar (decision 16). |
| `pnpm dev` wrapping bash scripts | ❌ (npm only) | ❌ (npm) | ✅ (npm + bash) | **NO** — Windows-but-bash mixing is a footgun, not a pattern |
| Multi-table mutation with RLS bypass (SECURITY DEFINER function) | ❌ | ✅ (decisions 19, 23) | ✅ (V1 → V2) | **YES** — kit ships `lib/patterns/postgres-mutations.md` (recipe + 3 gotchas + validator check). Pulled forward from Jayshankar W3 → W5 (2026-08-07). |
| Client-side aggregation for V1, server view for Pilot | ❌ | ✅ (decision 24) | ❌ | **YES** — kit ships `lib/patterns/client-side-aggregation.md` (rubric + worked example + decision threshold). Pulled forward from Jayshankar W4 (2026-08-07). |
| PWA with graceful offline degradation (read-only, no write-queue) | ❌ | ✅ (decisions 26, 27) | ❌ | **YES** — kit ships `lib/patterns/pwa-offline-graceful.md` (recipe + 3 lessons + worked example). Pulled forward from Jayshankar W5 (2026-08-07). |
| 3-tier empty-state rubric (action / hint / message) | ❌ | ✅ (decision 28) | ✅ (informal) | **YES** — kit ships `lib/patterns/empty-states.md` (rubric + 3 lessons + common-mistakes list). Pulled forward from Jayshankar W5 (2026-08-07). |
| HS256 JWT with hardcoded fallback secret | ❌ | ❌ | ✅ (V1) | **NO** — V1 was rejected in V2; kit does not propagate a rejected pattern |
| `next.config.mjs` + subpath routing | ❌ (Vite) | ❌ (Vite) | ✅ (Next.js) | **NO** — framework-specific, not a kit pattern |
| Polymorphic `ownerId` / `ownerType` | ❌ | ❌ | ✅ (V1) | **NO** — V1's dual-ERP thesis was rejected in V2; polymorphic FK is a rejected pattern |
| **Two-Prisma-clients + AsyncLocalStorage + `withTenantTx`** | ❌ (no DB) | ⚠️ (specified for Mode C) | ✅ (canonical, 254 lines in `src/lib/prisma.ts`) | **YES** — kit ships `lib/patterns/two-prisma-clients.md` (recipe) + `lib/tenant-rls/` (code) |
| **Cross-tenant 404 (return 404 not 403)** | ❌ | ⚠️ (specified D20) | ✅ (HANDOVER §9 gotcha + security discipline) | **YES** — kit ships `lib/patterns/cross-tenant-404.md` |
| **Outbox + JobQueue + CronLog (3 tables, SKIP LOCKED, exponential retry)** | ❌ | ⚠️ (specified) | ✅ (NotificationOutbox + JobQueue + CronLog + 3 cron workers) | **YES** — kit ships `lib/patterns/outbox-job-queue.md` |
| **Append-only audit log (Postgres trigger, no UPDATE/DELETE policy)** | ❌ | ✅ (D5, `audit_log` table + `audit_trigger` function) | ✅ (full audit log, RLS-denies-except-trigger) | **YES** — kit ships `lib/patterns/append-only-audit-log.md` + `templates/sql/audit-trigger.sql` |
| **FIFO cascade (numbered procedure + JS fixture + selftest)** | ❌ | ✅ (spoilage, sale cascade, transfer — D8) | ✅ (AIM tranche release guard) | **YES** — kit ships `lib/patterns/fifo-cascade-algorithm.md` |
| **Shortfall pattern (`{ result, shortfall, warnings }` in mutation response)** | ❌ | ✅ ("sale of 999 kg with 7 available → records 7 kg, shortfall 992.000 kg") | ✅ (tranche release returns shortfall) | **YES** — kit ships `lib/patterns/shortfall-pattern.md` |
| **Idempotent migrations (6 primitives: IF NOT EXISTS, OR REPLACE, DROP+CREATE TRIGGER, ON CONFLICT DO NOTHING, DO $$ guard, ENABLE/FORCE RLS)** | ❌ (static) | ✅ (5 SQL files, all idempotent) | ✅ (14 migrations, all idempotent) | **YES** — kit ships `lib/patterns/idempotent-migrations.md` + `templates/sql/idempotent-migration-pattern.sql` |
| **Pinned dependencies (exact version in `package.json`, `.gitignore` for generated, manifest-in-lockstep)** | ❌ | ✅ (D7) | ✅ (AGENTS §3 rule 3) | **YES** — kit ships `lib/patterns/pinned-deps.md` + `templates/.gitignore` |
| **Observability-first (liveness vs. readiness split, 5 must-have alerts, 5 runbooks, per-tenant metric labels)** | ❌ | ⚠️ (specified) | ✅ (7 runbooks + OTel + Prometheus + Grafana) | **YES** — kit ships `lib/patterns/observability-first.md` |
| **Env-vs-config split (3 files: `.env.example` / `.env.local` / `.env.production`; compose vs. app env; build-time vs. runtime)** | ❌ | ✅ (D7: 3 env files) | ✅ (compose-level vs. app-level env, documented in HANDOVER §9) | **YES** — kit ships `lib/patterns/env-vs-config.md` |
| **Prisma `$extends` + AsyncLocalStorage (`$allOperations` injecting `tenantId`)** | ❌ | ⚠️ (specified for Mode C) | ✅ (the `restrictedPrisma = basePrisma.$extends(...)` pattern) | **YES** — kit ships `lib/patterns/prisma-extensions-rls.md` (the recipe) |
| **Versioned spec amendment (merge-ready file with same section numbering, predecessor-documents footer)** | ❌ | ✅ (SPEC-AMENDMENT-v2.md, merge-ready) | ✅ (specs/SPEC-v3.md supersedes specs/AICL_updated.md) | **YES** — kit ships `lib/patterns/versioned-spec-amendment.md` |
| **Build-time vs. runtime env (Data-cleaning-script `SECRETS_SCAN_ENABLED` flag pattern)** | n/a | ❌ | ⚠️ (similar pattern in env-vs-config) | **YES** — covered by `lib/patterns/env-vs-config.md` §1.3 |
| **Per-tenant metric labels (every OTel attribute includes `tenant_id`)** | ❌ | ❌ | ✅ (`incubos/src/lib/logger.ts` always includes `tenant_id`) | **YES** — covered by `lib/patterns/observability-first.md` §1.3 |
| **Tiered decision escalation (T0 decide / T1 decide+flag / T2 stop and ask; uncertainty resolves upward)** | ❌ | ⚠️ (implicit — the builder asked when unsure) | ⚠️ (implicit) | **YES** — kit ships `lib/patterns/tiered-escalation.md`. Made explicit in session 16 (D32) because an unattended run has no human to read hesitation. |
| **Manual-relay worker loop (`self-parallel` dispatch + a `WORKER-SESSION.md`-shaped brief, for a worker tool with no CLI hook)** | ❌ | ✅ (a real 4-task round, decisions #31/33/34/35 — MiniMax M3 via a GUI-only desktop tool as worker) | ❌ | **YES, single-consumer, staged** — kit ships `lib/patterns/manual-relay-worker-loop.md`. Only one reference project so far; kept explicit about that in the pattern's own source note rather than overclaiming. Re-validate against a second consumer before treating it as more than one run's observation. |
| **Third-party tool / skill security audit before recommending (9 red flags, 3 verdicts, uncertainty → REVIEW-REQUIRED)** | ❌ | ❌ | ❌ | **YES** — kit ships `lib/patterns/third-party-tool-audit.md`. Not from a reference project: a skill is instructions the model follows, so the threat model postdates all three (D33, session 16). |
| **Embedded / generated manifest in lockstep (`EMBEDDED_RESOURCES` ↔ `.csproj` `/resource:`)** | n/a | ❌ | ❌ | **YES** (Data-cleaning-script) — covered by `lib/patterns/pinned-deps.md` §1.3 |

---

## 1. Description

**tins-kit** is a library of patterns, prompts, schemas, scripts, and templates for building
software spec-first under the TINS (There Is No Source) methodology. It is informed by three
real reference projects of three different sizes, stacks, and domains.

The kit is consumed by **a new TINS project** that wants to skip the "what format should the
spec be in?" / "how do I write acceptance criteria?" / "what does a validator look like?"
discovery phase. The consumer starts with a TINS spec template (interview-first), adopts the
modules it needs (tenant RLS? audit log? self-maintaining docs?), and ships a project that
already has the methodology baked in.

The kit is **not**:
- A runtime dependency
- A UI library
- A code generator (the LLM is the generator, per the atal-incubation TINS-MCP review)
- A hosting target

The kit is **also** a TINS project — its own SPEC.md follows the methodology, its own
HANDOVER.md tracks its own work queue, and changes to the kit go through the spec first.

### 1.1 The three reference projects at a glance

| | **exam-forge** | **Jayshankar** | **atal-incubation** |
|---|---|---|---|
| Domain | Education (study / drill / exam) | Retail (fish wholesale inventory) | SaaS (multi-tenant incubation management) |
| Stack | Vite + React + TS + localStorage | Vite + React + TS + Supabase + PWA | Next.js + Prisma + Postgres + RLS + ERPNext |
| Users | Single-user (a student) | 3 roles (admin, vendor-rep, worker) | 7 roles (SUPER_ADMIN, INCUBATOR_ADMIN, EMPLOYEE, MENTOR, STARTUP_FOUNDER, OBSERVER, INVESTOR) |
| Tenancy | Single-user | Single-tenant | Multi-tenant with RLS |
| Money | None | Per-batch pricing (₹/kg) | Per-application (₹ lakhs) |
| Output target | Static site (GitHub Pages) | PWA (Netlify) | Docker + K8s |
| LOC of spec | 1,196 lines | 1,046 lines | 1,706 lines |
| Status | Built and shipped | Spec done, demo pending | Built, scaling |
| TINS adherence | Strict | Strict (spec only, no app yet) | TINS with stub generator |

### 1.2 The lifecycle of a kit consumer

```
Interview (prompts/SPEC-AUTHOR.md)
       │
       ▼
Draft SPEC.md (templates/SPEC.md)
       │
       ├──► pick modules: tenant-rls? audit? pwa? docs-guardian?
       │
       ▼
Mode A — Demo (week 1–2)
  seeded data, runnable locally, no real users
       │
       ▼
Mode B — Pilot (week 3–6)
  real data, real users, real feedback
  reviewer session at the end
       │
       ▼
Mode C — Production (week 7+)
  locked schema, hardened, observability
  reviewer session at every major SPEC amendment
```

The kit's `HANDOVER.md` template is what Mode A → B → C looks like in a consumer project.
The kit's `prompts/REVIEWER-REVIEW-TEMPLATE.md` is what the reviewer uses at the end of
each mode.

---

## 2. What tins-kit provides

The kit is organised into five layers. A consumer may adopt any subset; the kit does not
mandate an all-or-nothing adoption.

### 2.1 Layer 1 — Prompts

**`prompts/SPEC-AUTHOR.md`** — the interview-first spec-generation prompt. Adapted from
`archive/exam-forge-reference/SPEC-AUTHOR.md` (which was the original). Runs a 7-question
interview (what the software does, who uses it, what data goes in, what must NOT be built,
where it's hosted, what "correct" means, what already exists), then the A/B/C pass
(measure input data, check for rot, propose data format), and only then writes the spec.

**`prompts/BUILDER-REVIEW-TEMPLATE.md`** — the template for a consumer's
`BUILDER-DECISIONS-REVIEW.md`. Adapted from the format in
`archive/exam-forge-reference/BUILDER-DECISIONS-REVIEW.md`. A new LLM session building a
consumer project fills this out at the end of every mode.

**`prompts/REVIEWER-REVIEW-TEMPLATE.md`** — the template for a consumer's
`REVIEWER-DECISIONS-REVIEW.md`. Adapted from the format in
`archive/exam-forge-reference/REVIEWER-DECISIONS-REVIEW.md`. A reviewer session fills
this out at the end of every mode.

**`prompts/INTERVIEW-CHECKLIST.md`** — a one-page reference for the SPEC-AUTHOR prompt: the
7 questions, the A/B/C pass, and the "what I guessed" closing list. Useful as a sanity
check before submitting the interview answers.

**`prompts/SPEC-REVIEWER.md`** — the prompt a *separate* reviewer LLM session runs
against a frozen-for-v1 SPEC.md. Six review passes (what-would-break-this walkthrough,
rot check, I-guessed pass, acceptance-criteria completeness, predecessor-document
check, spec-vs-reality pass) that produce a `REVIEWER-DECISIONS-REVIEW.md` entry
saying "approved" / "approved with conditions" / "rejected" with evidence.

**`prompts/KITTING.md`** — the machine-facing workflow an LLM session runs to add a
new pattern to the kit. The 9-step loop: pick shape, scaffold doc / code, add the
validator check, add the self-test case, update SPEC.md, update HANDOVER.md, update
BUILDER-DECISIONS-REVIEW.md, run the gate. The kit's evergrowing loop is this prompt.

**`prompts/KITTING-REVIEW.md`** — added session 8 (the auto-extraction loop, D17
second half). The triage rubric a kit-growth session runs against each candidate in
`kit-growth-candidates.md`: a 3-question test (does it generalise? is there a worked
example? does it duplicate an existing pattern?) that decides accept / reject / defer.
Companion to `KITTING.md` — this is the gate before the 9-step workflow runs.

**`prompts/RELEASE-CHECKLIST.md`** — the prompt run at the end of Mode A before
shipping publicly. Eight sections: type-check + build + test, the 5-command smoke
test, 5-minute staging soak, private-to-public sweep, documentation gate, security
sweep, observability gate, backout plan. Output: a single go / no-go decision in
`REVIEWER-DECISIONS-REVIEW.md`.

**The 4 generic prompts (D27)** — one per scenario in the user-facing flow (see
§1.2's lifecycle diagram and `INDEX.md`'s scenario table for how a session picks
one):

**`prompts/NEW-PROJECT.md`** — added session 10. **Scenario 1.** The 7-step generic
copy-paste prompt for starting a new TINS project in any directory, on any machine,
from the portable kit shell (scaffolded via `scripts/kit-new-project-shell.mjs`).
Ends by shipping a tarball back to `kit-staging/inbox/<project-name>/` via
`scripts/kit-staging-export.mjs`.

**`prompts/PROMOTE-TO-TINS.md`** — added session 11. **Scenario 2.** The 7-step
retro-fit workflow for taking an existing project that was built WITHOUT the kit and
turning it into a TINS project. Documents what the project **IS** (not what it
should be), runs `kit-coverage.mjs` to decide which patterns to adopt / document /
defer, and produces the kit's standard handover docs.

**`prompts/CONTINUE-TINS-PROJECT.md`** — added session 11. **Scenario 3.** The
6-step pickup workflow for continuing an existing TINS project and adding a new W.
The 5 W-questions: what is the W, what's the user's pain, what does "done" look
like, are there constraints, is this kit-worthy. Since session 12 (D28), Step 2
routes a frontend-visual-redesign W to `FRONTEND-REFRESH.md` instead of the generic
W interview; since session 13 (D29), it also routes a parallel-work-split W to
`DELEGATE-WORK.md`; since session 14 (D30), it also routes a "package this for
public release" W to `PUBLISH-OPEN-SOURCE.md`; since session 15 (D31), it also
routes a "turn this into teaching material" W to `GENERATE-CURRICULUM.md`.

**`prompts/KIT-GROWTH-SESSION.md`** — added session 10. **Scenario 4.** The 8-step
generic prompt run at the kit root: scan `kit-staging/inbox/` (`kit-ingest.mjs`),
triage each candidate via `KITTING-REVIEW.md`, run the KITTING workflow for each
accepted candidate, sync the new kit to every vendored project
(`kit-sync.mjs`), and archive the inbox. The 2-consumer rule is enforced here.

**`prompts/FRONTEND-VISION-INTERVIEW.md`** — added session 12 (D28). The shared
design-vision interview: surveys the user's visual direction (researching
inspiration sites if unsure), and locks per-library install-vs-recreate decisions
against the kit's 5 reference libraries (anime.js, motion, kokonut-ui, bklit-ui,
shadcn). Triggered from two places — never duplicated (D4): `SPEC-AUTHOR.md` Step
7a for new websites, and `FRONTEND-REFRESH.md` Step 2 for existing ones. Produces
`FRONTEND-VISION.md` (authored) and `.frontend-detect.json` (derived).

**`prompts/FRONTEND-REFRESH.md`** — added session 12 (D28). The generic
copy-paste prompt for refreshing the frontend of an existing tins-kit website,
any framework/language. Frontend-only: no backend/API/schema/business-logic
changes. Runs `FRONTEND-VISION-INTERVIEW.md` as its interview step, then
installs the reference libraries where the target stack matches (React +
Tailwind for kokonut-ui / bklit-ui / shadcn; almost any JS stack for anime.js /
motion) or recreates the visual pattern natively where it doesn't. Verification
is scoped to the project's current mode (A/B/C) — a Mode A project verifies
against seeded/mock data, not a backend that doesn't exist yet.

**`prompts/DELEGATE-WORK.md`** — added session 13 (D29). The specialized
W within Scenario 3 for splitting a TINS project's remaining *locked*
work into independent tasks for parallel execution. Asks the round's
self-vs-external mode question, proposes a task split with touched-file
lists, runs `check-task-independence.mjs` until clean, and — for
external-mode tasks only — builds, scans, and zips a scrubbed task
packet via `templates/TASK-BRIEF.md` and `scripts/scan-task-packet.mjs`.
Writes and maintains `delegation/LEDGER.md` in the consumer project
(never in the kit).

**`prompts/INTEGRATE-DELEGATED-WORK.md`** — added session 13 (D29). The
companion to `DELEGATE-WORK.md`: merges every returned task back into
the project, recovers each external-mode task's `NOTES.md` into the
real `BUILDER-DECISIONS-REVIEW.md` via `decision-log.mjs`, auto-fixes
small discrepancies, explains large ones to the user before applying
them, and leaves the gate green.

**`prompts/PUBLISH-OPEN-SOURCE.md`** — added session 14 (D30). The
specialized W within Scenario 3 for packaging a finished TINS project
for public release. Requires the gate green first, then runs the
`lib/patterns/private-to-public.md` copy-and-scan workflow via
`scripts/private-to-public.mjs`, writes the public docs (README,
CONTRIBUTING, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/SCHEMA.md,
docs/DESIGN-WALKTHROUGH.md) in a corporate voice, holds them against the
pattern's §3.7 quality rubric, verifies the gate in the public copy too,
and records the release back in the private `BUILDER-DECISIONS-REVIEW.md`.
Not the same job as `RELEASE-CHECKLIST.md` (that one gates a same-repo
production deploy; this one produces a second, public-facing repo).

**`prompts/GENERATE-CURRICULUM.md`** — added session 15 (D31). The
specialized W within Scenario 3 for turning a finished project's private
working history into a standalone teaching curriculum. Fresh-session
(D4): reads `SPEC.md`, `BUILDER-DECISIONS-REVIEW.md`, `HANDOVER.md`, and
the code directly, never relying on the original builder session's
memory. Produces a manifest, then generates a sibling
`<project>-curriculum/` folder one file per turn — a primer +
prerequisite map (`00-START-HERE.md`), `GLOSSARY.md`,
`CONCEPT-TO-CODE-INDEX.md`, `MILESTONES.md`, and per-module folders
each with a `README.md`, a `SCENARIO-QUESTIONS.md` (from the module's
real acceptance criteria), and — where a real bug exists in that
module's decision-log history — a `DEBUGGING-CASE-STUDY.md` structured
as a "diagnose it yourself first" exercise. Tracks progress in a derived
`CURRICULUM-PROGRESS.md` so a fresh session can resume. Gates on
`scripts/private-to-public.mjs --scan-only` against the curriculum
folder before calling it shareable — reusing D30's scanner as-is,
deliberately, since the curriculum needs to stay clear of exactly the
same two things D30 already blocks.

**`prompts/GENERATE-INTERVIEW-PREP.md`** — added session 15 (D31). The
companion to `GENERATE-CURRICULUM.md`, run separately and later:
produces `interview-prep/00-OVERVIEW.md` plus one guided from-scratch
reimplementation exercise per core CS/systems concept the project's
stack touches, aimed at OpenAI/Anthropic-style technical interview
prep. Explicitly recommends running it with a frontier model at
extended/max thinking (mirroring D29's `check-task-independence.mjs`
precedent) — a from-scratch systems-level reimplementation is easy for
a weaker model to get subtly, confidently wrong. Same manifest-first,
one-file-per-turn, progress-tracked, scan-gated mechanics as
`GENERATE-CURRICULUM.md`.

**`prompts/AUTONOMOUS-BUILD.md`** — added session 16 (D32). The auditor's
contract for an unattended build. This session becomes the **auditor**
(master): it decomposes the remaining locked work into file-disjoint tasks,
dispatches **worker** (slave) sessions, verifies each returned task against
scope / acceptance criteria / the gate, integrates via
`INTEGRATE-DELEGATED-WORK.md`, and loops until the spec is built. It drives
D29's pipeline rather than replacing it, and it never writes product code —
a session that wrote the code is the wrong session to judge it. All run
state lives in `delegation/LEDGER.md` (the state machine),
`ORCHESTRATION.json` (config) and `ESCALATIONS.md` (the question queue), so
a fresh auditor can take over mid-run. Escalation is tiered per
`lib/patterns/tiered-escalation.md`, and a T2 parks its own task rather than
halting the run.

**`prompts/WORKER-SESSION.md`** — added session 16 (D32). The worker's
contract, filled in and dispatched by the auditor rather than pasted by the
user. One task, one file list, one interface contract; escalate anything
outside it; verify your own work; write `NOTES.md`; stop. A worker never
integrates, never merges, and never touches the ledger.

**`prompts/TOOLING-AUDIT.md`** — added session 16 (D33). The blocking
capability gate at the front of Scenario 1 and Scenario 3: inventory what
the harness actually has, derive what the work actually needs, search the
internet for MCP servers and skills that close the gap, security-audit each
candidate against `lib/patterns/third-party-tool-audit.md`'s nine red flags,
and record the result. The kit never installs and never executes a
candidate. Work does not proceed while a REQUIRED capability is `pending`.

**`prompts/STEERING-PROMPTS.md`** — added session 16 (D34). The catalogue
the LLM selects from when offering the user short, paste-ready correction
prompts inline — adapted to the scenario, the project's current state, and
what just drifted. Not a file the user is handed. Emission is at fixed
checkpoints and, mandatorily and immediately, after any self-correction on a
recheck.

**`prompts/EXECUTION-MODE-INTERVIEW.md`** — added session 17 (D35). The
shared interview that asks how a round's work should actually be executed,
instead of inferring it from how a W was phrased. Five modes — `solo`,
`auditor-local`, `auditor-remote`, `self-parallel`, `external` — plus
`hybrid` per task. Triggered from `SPEC-AUTHOR.md` and `NEW-PROJECT.md` once
a spec locks, from `CONTINUE-TINS-PROJECT.md` at the start of each round, and
from `AUTONOMOUS-BUILD.md` Step 0 as a precondition. Records the answer in
`delegation/LEDGER.md`'s round header, which `scripts/orchestrate.mjs` reads
literally — it dispatches auditor-driven rounds and refuses user-driven and
external ones. Replaces the self-vs-external question `DELEGATE-WORK.md` used
to ask on its own.

### 2.2 Layer 2 — Schemas

**`schemas/tins-markers.schema.json`** — JSON Schema for the `<!-- TINS Specification v1.0
-->` and `<!-- ZS: -->` block at the top of a SPEC.md. Validates that the markers are
present and well-formed.

**`schemas/locked-decisions.schema.json`** — JSON Schema for the §0.2 table. Validates the
`(#, Decision, Resolution)` columns at minimum; consumers may add `Source`, `Date`, etc.

**`schemas/handover.schema.json`** — JSON Schema for the `HANDOVER.md` structure. Validates
the `Last updated`, `Last worked on by`, `Queue position` header and the W-item structure
in the work queue.

**`schemas/tins-spec-minimal.schema.json`** — JSON Schema for the **minimum viable** SPEC.md
shape. A consumer that wants to lint "is this a TINS spec?" runs this. The schema is
permissive: the spec may have any sections, but it must have §0, §1, §2, §4, §8, and §9.

### 2.3 Layer 3 — Lib

The lib is the kit's reusable code. Each module is a folder with an `index.ts` (or
multiple files), a `README.md` explaining when to use it, and a `tests/` folder with at
least one passing test.

**`lib/no-backend/`** — for static-only consumers (exam-forge-style). The module is
`localStorage` + hash routing. No database, no auth, no RLS. The module is "a hook that
stores JSON-serialisable state under a namespaced key."

**`lib/tenant-rls/`** — the multi-tenant Postgres RLS primitive. Provides:
- A `restrictedPrisma` factory that takes a `tenantId` and returns a Prisma client
  pinned to that tenant
- A `withTenantTx(prisma, tenantId, fn)` wrapper that opens an interactive transaction,
  sets the `app.current_tenant` session var, and runs `fn` inside
- A migration template (`rls-policies.sql`) that enables RLS on every tenant-scoped table
  and creates the policies
- A guard against the two known ways this fails: (1) a tenant-scoped query inside an
  already-open transaction losing the `app.current_tenant` setting; (2) an array-form
  `$transaction([...])` call divorcing the SET from the query
- Zod-typed `RlsConfig` and `TenantContext`

The module is Prisma-specific (the primitive only makes sense with Prisma + Postgres).
Consumers on Drizzle or Kysely fork the module.

**`lib/audit-viewer/`** — pure-TS UI component for a read-only audit log table. Props:
`(rows: AuditLogEntry[], filterControls: boolean)`. The component is React (the most
common consumer framework), but the rendering logic is framework-agnostic — a Vue/Svelte
consumer can use the same data shape.

**`lib/docs-guardian/`** — the self-maintaining docs system. Provides:
- A `DOC-MAP.md` template
- A `docs-guardian.mjs` script that scans the code, finds stale docs, prints a report
- A `docs-update.mjs` script that, given an area, prints a per-doc checklist
- A `DocArea` enum (e.g. `'API routes'`, `'Prisma models'`, `'Env vars'`, `'UI pages'`)
- A `doc-map.json` schema for the mapping itself

**`lib/pwa-config/`** — the offline-capable PWA Vite plugin wrapper. Provides:
- A `withPwa(viteConfig, options)` function that wraps the Vite config with
  `vite-plugin-pwa` and the right defaults for the kit's use cases
- A `useOnlineStatus()` React hook
- A `<OfflineBanner />` React component (matches the spec's "stale data — read only"
  wording)
- A service worker template

**`lib/money-as-decimal/`** — for consumers with money in scope. Provides:
- A Zod schema for `Money` (string-encoded decimal to avoid JS float pitfalls)
- A Postgres `numeric(10,2)` migration snippet
- A `formatINR(amount)` and `formatUSD(amount)` helper (the INR formatter is mandatory;
  USD is provided as a template consumers can clone)
- A "don't import `Number.parseFloat`" ESLint rule snippet (consumer wires it up)

**`lib/auth-shell/`** — for consumers that need auth. NOT a full auth implementation.
Provides:
- A `useSession()` React hook (read from Supabase / NextAuth / Auth0 — consumer picks)
- A `<RoleGate roles={['admin']}>` component
- A `requireRole(req, role)` API route helper
- A `getServerSession()` server-component helper
- The "first sign-up becomes admin" pattern (reusable across consumers)

#### `lib/patterns/` — doc-only recipes (architect's-eye view)

The kit ships 21 patterns. Each is a focused, copy-paste-able recipe: the "why this
exists" rationale, 3 lessons (the 3 most-important things to know), 3 known
anti-patterns (the 3 most-common mistakes), and "when this changes" (3 triggers that
re-open the design). Patterns are *not* code — they are the design rationale the code
implements.

**Tier 1 — kit-original (added in W1–W2, the first session):**
- `supabase-auth-trigger.md` — FK drop + trigger meta + service_role GRANTs (pulled from Jayshankar D8, D10, D11).
- `postgres-mutations.md` — multi-table mutation with RLS bypass (pulled from Jayshankar D19, D23 and atal-incubation V1→V2).
- `client-side-aggregation.md` — V1 client-side, V2 server view (pulled from Jayshankar D24).
- `pwa-offline-graceful.md` — read-only offline degradation (pulled from Jayshankar D26, D27).
- `empty-states.md` — action / hint / message 3-tier rubric (pulled from Jayshankar D28).
- `private-to-public.md` — producing a scrubbed, corporately-documented public
  sibling repo from a private working copy (rewritten for D30; NOT the same
  thing as `prompts/RELEASE-CHECKLIST.md`'s same-repo "no TODOs in prod" sweep).
- `FRONTEND-OVERHAUL.md` — the "when to rewrite" decision tree.

**Tier 2 — gap-analysis additions (added in W2 of the gap-analysis session, 2026-08-15):**
- `two-prisma-clients.md` — the multi-tenant Postgres isolation recipe.
- `cross-tenant-404.md` — return 404, never 403, when a resource exists in another tenant.
- `outbox-job-queue.md` — decouple email / webhook / cron delivery from request handling.
- `append-only-audit-log.md` — every mutation writes to `audit_log` via a SECURITY DEFINER trigger.
- `multi-tenant-rls.md` — the architect's-eye view of tenant RLS.
- `fifo-cascade-algorithm.md` — specify an algorithm as a numbered procedure + JS fixture.
- `shortfall-pattern.md` — never fail silently; return `{ result, shortfall, warnings }`.
- `idempotent-migrations.md` — the 6 primitives every migration must use.
- `pinned-deps.md` — exact versions in `package.json`, `.gitignore` for generated, manifest-in-lockstep.
- `observability-first.md` — liveness / readiness split + 5 must-have alerts + 5 runbooks.
- `env-vs-config.md` — 3 env files, compose vs. app env, build-time vs. runtime.
- `prisma-extensions-rls.md` — the `$extends` + AsyncLocalStorage recipe (companion to `two-prisma-clients`).
- `versioned-spec-amendment.md` — the merge-ready amendment file convention.

**Tier 3 — meta (added session 7-8, documenting the kit's own evolution):**
- `kit-self-application.md` — the bidirectional loop that lets the kit grow
  from every consumer project (D17); the formalised version of the process
  that produced Tier 1 and Tier 2 above.

See `docs/GAP-ANALYSIS.md` for the full cross-reference (which pattern came from
which reference project, and why).

### 2.4 Layer 4 — Scripts

All scripts are zero-dependency Node ESM. They run before any `npm install` and gate the
build.

**`scripts/validate.mjs`** — the spec validator. Runs every consumer's acceptance criteria
that is mechanisable in a static check. Consumers add their own checks via a
`validate.config.mjs` export.

**`scripts/selftest.mjs`** — the validator's self-test. Runs the validator against
deliberately broken inputs and asserts the validator catches each one. (D7)

**`scripts/migration-runner.mjs`** — applies SQL migrations in order, idempotent. The
baseline: a `migrations/` directory, files named `<UTC-timestamp>_<description>.sql`,
each starting with `-- up`. The script applies them in order, tracks applied migrations
in a `migrations_applied` table.

**`scripts/docs-guardian.mjs`** — part of the `lib/docs-guardian/` system. Scans the
consumer's code, finds stale docs, prints a report.

**`scripts/docs-update.mjs`** — given a `DocArea`, prints a per-doc checklist. The LLM
follows the checklist and updates the docs.

**`scripts/new-project.mjs`** — scaffolds a new consumer project from the kit. Takes
`<project-name>` and writes the directory structure: `SPEC.md`, `HANDOVER.md`,
`AGENTS.md`, `package.json`, `tsconfig.json`, the chosen `lib/` modules, the chosen
`scripts/`, the `prompts/`, and the `archive/exam-forge-reference/` and
`archive/atal-incubation-reference/` symlinks or copies.

**`scripts/decision-log.mjs`** — appends a decision to the consumer's
`BUILDER-DECISIONS-REVIEW.md` or `REVIEWER-DECISIONS-REVIEW.md`. Takes a JSON entry
and writes a date-stamped row.

**`scripts/kit-coverage.mjs`** — given a consumer's `SPEC.md`, prints which
`lib/patterns/` entries from the kit are likely to apply. A keyword-based classifier
that helps the consumer decide what to copy. False positives are fine; false negatives
are not (a missing pattern is a real loss).

**`scripts/kit-listing.mjs`** — list every pattern, prompt, schema, template,
script, lib module, and doc in the kit. The "what's in the kit?" one-liner. Supports
`--json` and `--kind=<name>` filters.

**`scripts/kit-new-pattern.mjs`** — scaffold a new `lib/patterns/<name>.md` from
the canonical 4-section template. The contributor fills in the content. Closes the
evergrowing-project loop.

**`scripts/check-task-independence.mjs`** — added session 13 (D29).
Given a consumer project's `delegation/LEDGER.md`, computes each task's
touched-file set and flags any pairwise overlap before a `DELEGATE-WORK.md`
round proceeds to building packets. Exits 0 clean, 1 if conflicts are
found (with a merge recommendation), 2 if the ledger is missing or
unparseable.

**`scripts/scan-task-packet.mjs`** — added session 13 (D29). Scans a
built `delegation/tasks/<id>/packet/` directory for methodology
fingerprints (TINS-specific terms, kit filenames, kit script names) and
path escapes (`../`, absolute paths, `.git` references) before the
packet is zipped and handed to an external contributor. Defense-in-depth
on top of the `TASK-BRIEF.md` template, not a replacement for it. Exits
0 clean, 1 if leaks are found.

**`scripts/private-to-public.mjs`** — added session 14 (D30); promoted
from a code block embedded in `lib/patterns/private-to-public.md` into a
real, shipped script (fixing a latent copy-filter glob bug in the
process). Copies a private working copy into a public sibling folder per
an include/exclude table, mechanically rewrites the TINS marker-line
comment, then scans the ENTIRE destination tree — every file, in-line
code comments included — against its own banned-terms list (kept
deliberately separate from `scan-task-packet.mjs`'s): methodology
fingerprints AND LLM-authorship fingerprints (model/vendor names,
leftover assistant-speak). Supports `--scan-only` (re-scan an existing
destination without re-copying) and `--json`. Exits 0 clean, 1 if leaks
are found, 2 on bad usage.

**`scripts/orchestrate.mjs`** — added session 16 (D32). The reference
runner for an autonomous build: reads `delegation/LEDGER.md` and
`ORCHESTRATION.json`, computes the runnable set (status `ready`,
dependencies `integrated`), and dispatches a wave of workers through a
configurable `workerCmd` template. `--dry-run` prints the plan without
spawning; `--status` prints run state. One conforming implementation of
`prompts/AUTONOMOUS-BUILD.md`, not the only permitted mechanism — a harness
with native subagent spawning satisfies the same contract without it.
Exits 0 complete / 1 a task failed / 2 usage or config error / 3 parked.

**`scripts/escalate.mjs`** — added session 16 (D32). Files a tiered
escalation: appends to `delegation/ESCALATIONS.md` and, for a T2, marks the
task `blocked-escalation` in the ledger. Refuses a T0 (that is decide-and-log,
not a question) and refuses a T2 missing any of its five required fields —
question, trigger, two or more real options, a recommendation, and the
blocked tasks.

**`scripts/tooling-audit.mjs`** — added session 16 (D33). The blocking gate
for the tooling audit. Fails while the audit is unfinished, while a REQUIRED
capability is `pending`, when an UNSAFE tool is marked installed, when a
waiver names no handicap, or on any value outside the closed
verdict/priority/status vocabulary. Exits 0 green / 1 blocked / 2 missing or
unparseable.

### 2.5 Layer 5 — Templates

**`templates/SPEC.md`** — the spec skeleton. Section headers, the TINS markers, the
locked-decisions table, the acceptance-criteria format, the out-of-scope section. The
consumer fills in the content; the kit enforces the shape.

**`templates/HANDOVER.md`** — the handover work-system template. The `Last updated`,
`Last worked on by`, `Queue position` header. The W1–Wn work-queue format. The
state-snapshot, content-inventory, and gotchas sections.

**`templates/AGENTS.md`** — the 1-page LLM onboarding template. The 60-second
orientation, the standing rules, the first commands, the ask-vs-try section.

**`templates/TRAININGS.md`** — the debugging-wisdom handbook template. Optional but
recommended for non-trivial projects (the atal-incubation version is 1,200+ lines and
worth its weight).

**`templates/BUILDER-DECISIONS-REVIEW.md`** — the build-notes template. Adapted from
`archive/exam-forge-reference/BUILDER-DECISIONS-REVIEW.md`.

**`templates/REVIEWER-DECISIONS-REVIEW.md`** — the meta-review template. Adapted from
`archive/exam-forge-reference/REVIEWER-DECISIONS-REVIEW.md`.

**`templates/zod-schemas/money.zod.ts`** — the money Zod schema.

**`templates/sql/rls-policies.sql`** — the RLS enablement migration. Idempotent.

**`templates/sql/audit-trigger.sql`** — the append-only audit log trigger. Idempotent.

**`templates/eslint/no-float-money.js`** — the ESLint rule that bans `parseFloat` and
`Number()` on money-typed values.

**`templates/.gitignore`** — the kit's recommended `.gitignore` (extends the npm default
with `.env*`, `node_modules`, `dist`, `build`, `.next`, `.turbo`, log files, and the
specific `jwt-*.pem` exclusion for the atal-incubation-style projects).

**`templates/TASK-BRIEF.md`** — added session 13 (D29). The raw
starter file for an external-mode task packet's ticket. Copied to
`delegation/tasks/<id>/packet/TASK-BRIEF.md` and filled in per task:
Context, Scope, Interface Contract, the packet's file list, Acceptance
Criteria, Out of Scope, Definition of Done, How to Return Your Work —
written like a company ticket, zero TINS vocabulary.

**`templates/DELEGATION-LEDGER.md`** — added session 13 (D29). The raw
starter file for a consumer project's `delegation/LEDGER.md`: the task
table (`Task | Mode | Status | Assignee | Touched files`) that
`check-task-independence.mjs` reads.

**`templates/DELEGATION-README.md`** — added session 13 (D29). The raw
starter file for a consumer project's `delegation/README.md`,
explaining the folder's layout and the self-vs-external split to future
sessions. Author-side only — free to reference the project's real
methodology since it never leaves the project.

**`templates/CURRICULUM-PROGRESS.md`** — added session 15 (D31). The raw
starter file for the curriculum sibling folder's
`CURRICULUM-PROGRESS.md`: a table of every planned curriculum file with
a pending/done status, so `prompts/GENERATE-CURRICULUM.md` and
`prompts/GENERATE-INTERVIEW-PREP.md` can resume a generation run that
didn't finish in one session.

**`templates/ORCHESTRATION.json`** — added session 16 (D32). The raw
starter for a consumer's `delegation/ORCHESTRATION.json`: harness preset,
worker command template, `maxParallel`, `maxRetries`, the tier policy, and
`haltOn`.

**`templates/ESCALATIONS.md`** — added session 16 (D32). The raw starter for
the run's question queue: open T2s (each with question, trigger, options,
recommendation, blocked tasks), the T1 digest, and the answered archive.

**`templates/TOOLING-AUDIT.md`** — added session 16 (D33). The raw starter
for a consumer's `TOOLING-AUDIT.md`: the audit-status line the gate reads,
what the harness has, what the work needs, and the candidate table with
verdict / priority / status / handicap columns.

---

## 3. Universal behaviour rules

These are rules the kit enforces on consumers. A consumer that violates them gets a
warning from `scripts/validate.mjs`.

1. **The spec is the source.** Every consumer's `SPEC.md` is the canonical source. Code
   changes follow spec changes, never the other way around. The TINS markers at the top
   are required.
2. **The validator fails loudly.** `npm run validate` exits non-zero on any error. No
   `--force`, no "warn and continue". (D16 in Jayshankar, D3 in exam-forge.)
3. **The cheapest version is named first.** §0.0 of every consumer's SPEC.md names the
   cheapest artefact (often a Google Sheet, a static HTML file, a CLI script) and what
   the expensive version buys. (D11.)
4. **Authored data is separate from derived data.** `current_stock` is computed, not
   stored. `price_history` is authored. The audit log is the only place computed
   snapshots are allowed to live, and only as a debug aid. (D17 in Jayshankar.)
5. **The locked-decisions table is at §0.2.** Every consumer's SPEC.md has a table with
   rows `(#, Decision, Resolution, Source)`. The kit's `validate.mjs` checks for this
   header. (D9.)
6. **The interview is mandatory.** `prompts/SPEC-AUTHOR.md` is the entry point. A
   consumer cannot write a SPEC.md without first running the 7-question interview and
   the A/B/C pass.
7. **Role separation at mode boundaries.** A consumer's project that adopts the
   3-mode lifecycle spawns a reviewer session at the end of Mode A, Mode B, and Mode C,
   and after any major SPEC amendment. (D10.)
8. **Money is `Decimal`, never `Float`.** Consumers whose domain has money adopt this.
   The kit's `lib/money-as-decimal/` ships the pattern. (D13.)
9. **Multi-tenant isolation is the consumer's choice, but if chosen, it uses RLS at
   the database.** Consumers that adopt `lib/tenant-rls/` MUST have RLS policies on
   every tenant-scoped table. The kit's `validate.mjs` checks the `rls-policies.sql`
   migration against the Prisma schema.
10. **No DELETE on data tables.** Soft-delete only (`active = false`). The audit log
    is the only exception (no UPDATE or DELETE there either, by policy). (AGENTS §3
    rule 5 in Jayshankar.)
11. **The build must be green before stopping.** `npm run validate` exits 0, and (for
    consumers that have an app) `pnpm build` exits 0. The handover protocol in
    `templates/HANDOVER.md` enforces this.
12. **Decisions and review findings are recorded.** Every spec amendment produces an
    entry in `BUILDER-DECISIONS-REVIEW.md`. Every reviewer session produces an entry
    in `REVIEWER-DECISIONS-REVIEW.md`. An unrecorded finding is a finding the next
    session pays for again.

---

## 4. Technical implementation

### 4.1 Architecture

```
tins-kit/
├── SPEC.md                              ← this file (the kit's own source)
├── HANDOVER.md                          ← the kit's work system
├── AGENTS.md                            ← the kit's 1-page onboarding
├── README.md                            ← human overview
├── prompts/
│   ├── SPEC-AUTHOR.md                   ← Layer 1
│   ├── BUILDER-REVIEW-TEMPLATE.md
│   ├── REVIEWER-REVIEW-TEMPLATE.md
│   ├── INTERVIEW-CHECKLIST.md
│   ├── SPEC-REVIEWER.md                 ← added 2026-08-15 (gap analysis)
│   ├── KITTING.md                       ← added 2026-08-15
│   ├── KITTING-REVIEW.md                ← added 2026-08-15 (session 8)
│   ├── RELEASE-CHECKLIST.md             ← added 2026-08-15
│   ├── NEW-PROJECT.md                   ← added 2026-08-15 (session 10, Scenario 1)
│   ├── KIT-GROWTH-SESSION.md            ← added 2026-08-15 (session 10, Scenario 4)
│   ├── PROMOTE-TO-TINS.md               ← added 2026-08-15 (session 11, Scenario 2)
│   ├── CONTINUE-TINS-PROJECT.md         ← added 2026-08-15 (session 11, Scenario 3)
│   ├── FRONTEND-VISION-INTERVIEW.md     ← added 2026-08-21 (session 12, D28)
│   ├── FRONTEND-REFRESH.md              ← added 2026-08-21 (session 12, D28)
│   ├── DELEGATE-WORK.md                 ← added 2026-08-21 (session 13, D29)
│   ├── INTEGRATE-DELEGATED-WORK.md      ← added 2026-08-21 (session 13, D29)
│   ├── PUBLISH-OPEN-SOURCE.md           ← added 2026-08-21 (session 14, D30)
│   ├── GENERATE-CURRICULUM.md           ← added 2026-08-21 (session 15, D31)
│   ├── GENERATE-INTERVIEW-PREP.md       ← added 2026-08-21 (session 15, D31)
│   ├── AUTONOMOUS-BUILD.md              ← added 2026-08-26 (session 16, D32)
│   ├── WORKER-SESSION.md                ← added 2026-08-26 (session 16, D32)
│   ├── TOOLING-AUDIT.md                 ← added 2026-08-26 (session 16, D33)
│   ├── STEERING-PROMPTS.md              ← added 2026-08-26 (session 16, D34)
│   └── EXECUTION-MODE-INTERVIEW.md      ← added 2026-08-26 (session 17, D35)
├── schemas/
│   ├── tins-markers.schema.json         ← Layer 2
│   ├── locked-decisions.schema.json
│   ├── handover.schema.json
│   └── tins-spec-minimal.schema.json
├── lib/
│   ├── no-backend/                      ← Layer 3 (code modules)
│   │   ├── index.ts
│   │   ├── useLocalState.ts
│   │   ├── clearLocalState.ts
│   │   ├── isLocalStorageAvailable.ts
│   │   ├── LocalStateError.ts
│   │   ├── README.md
│   │   └── tests/
│   ├── money-as-decimal/                ← added 2026-08-15
│   │   ├── index.ts
│   │   ├── README.md
│   │   └── tests/
│   ├── tenant-rls/                      ← added 2026-08-15
│   │   ├── index.ts
│   │   ├── README.md
│   │   └── tests/
│   ├── audit-viewer/                    ← deferred to future kit release
│   ├── docs-guardian/                   ← deferred
│   ├── pwa-config/                      ← deferred
│   ├── auth-shell/                      ← deferred
│   └── patterns/                        ← doc-only recipes (21 files)
│       ├── supabase-auth-trigger.md
│       ├── postgres-mutations.md
│       ├── client-side-aggregation.md
│       ├── pwa-offline-graceful.md
│       ├── empty-states.md
│       ├── private-to-public.md        ← rewritten 2026-08-21 (session 14, D30)
│       ├── FRONTEND-OVERHAUL.md
│       ├── two-prisma-clients.md        ← added 2026-08-15
│       ├── cross-tenant-404.md
│       ├── outbox-job-queue.md
│       ├── append-only-audit-log.md
│       ├── multi-tenant-rls.md
│       ├── fifo-cascade-algorithm.md
│       ├── shortfall-pattern.md
│       ├── idempotent-migrations.md
│       ├── pinned-deps.md
│       ├── observability-first.md
│       ├── env-vs-config.md
│       ├── prisma-extensions-rls.md
│       ├── versioned-spec-amendment.md
│       ├── kit-self-application.md      ← added session 7-8 (Tier 3, meta)
│       ├── tiered-escalation.md         ← added 2026-08-26 (session 16, D32)
│       └── third-party-tool-audit.md    ← added 2026-08-26 (session 16, D33)
├── scripts/
│   ├── validate.mjs                     ← Layer 4
│   ├── selftest.mjs
│   ├── migration-runner.mjs
│   ├── docs-guardian.mjs
│   ├── docs-update.mjs
│   ├── new-project.mjs
│   ├── decision-log.mjs
│   ├── kit-coverage.mjs                 ← added 2026-08-15
│   ├── kit-listing.mjs                  ← added 2026-08-15
│   ├── kit-new-pattern.mjs              ← added 2026-08-15
│   ├── check-task-independence.mjs      ← added 2026-08-21 (session 13, D29)
│   ├── scan-task-packet.mjs             ← added 2026-08-21 (session 13, D29)
│   ├── private-to-public.mjs            ← added 2026-08-21 (session 14, D30)
│   ├── orchestrate.mjs                  ← added 2026-08-26 (session 16, D32)
│   ├── escalate.mjs                     ← added 2026-08-26 (session 16, D32)
│   ├── tooling-audit.mjs                ← added 2026-08-26 (session 16, D33)
│   └── package.json                     ← zero-dep marker, no install
├── templates/
│   ├── SPEC.md                          ← Layer 5
│   ├── HANDOVER.md                      ← added 2026-08-15
│   ├── AGENTS.md                        ← added 2026-08-15
│   ├── TRAININGS.md
│   ├── BUILDER-DECISIONS-REVIEW.md
│   ├── REVIEWER-DECISIONS-REVIEW.md
│   ├── TASK-BRIEF.md                    ← added 2026-08-21 (session 13, D29)
│   ├── DELEGATION-LEDGER.md             ← added 2026-08-21 (session 13, D29)
│   ├── DELEGATION-README.md             ← added 2026-08-21 (session 13, D29)
│   ├── CURRICULUM-PROGRESS.md           ← added 2026-08-21 (session 15, D31)
│   ├── ORCHESTRATION.json               ← added 2026-08-26 (session 16, D32)
│   ├── ESCALATIONS.md                   ← added 2026-08-26 (session 16, D32)
│   ├── TOOLING-AUDIT.md                 ← added 2026-08-26 (session 16, D33)
│   ├── zod-schemas/
│   │   └── money.zod.ts
│   ├── sql/
│   │   ├── rls-policies.sql
│   │   ├── audit-trigger.sql
│   │   └── idempotent-migration-pattern.sql  ← added 2026-08-15
│   ├── eslint/
│   │   └── no-float-money.js
│   └── .gitignore
├── examples/                            ← added 2026-08-26 (session 18, D36)
│   └── autonomous-todo-app/             ← a real D32 run, captured whole
├── archive/
│   ├── exam-forge-reference/            ← the prior TINS project, read-only
│   ├── atal-incubation-reference/       ← the second prior TINS project, read-only
│   ├── kit-test-2026-08-04/
│   └── kit-update-package-2026-08-07/
├── docs/
│   ├── WORKFLOW.md                      ← how a consumer uses the kit, end to end
│   ├── LIBRARY-CONVENTIONS.md            ← how to write a new lib/ module
│   ├── KITTING.md                       ← how to add a new pattern to the kit
│   └── GAP-ANALYSIS.md                  ← the gap analysis (2026-08-15)
└── tests/
    └── kit-smoke.mjs                    ← proves the kit's own components work together
```

The kit does NOT have a `package.json` at the root with dependencies. Consumers may add
one for their own tooling, but the kit's own scripts are zero-dep (D3). The kit ships a
`package.json` per script if the script ever needs anything Node built-ins don't provide;
until then, plain `.mjs` files in `scripts/`.

### 4.2 Module APIs

#### 4.2.1 `lib/no-backend`

```ts
// index.ts
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void];
export function clearLocalState(key: string): void;
export function isLocalStorageAvailable(): boolean;  // §3.2 storage failure path
```

#### 4.2.2 `lib/tenant-rls`

```ts
// index.ts
import { PrismaClient } from '@prisma/client';

export interface RlsConfig {
  baseUrl: string;          // superuser DATABASE_URL
  restrictedUrl: string;    // RLS-enforced DATABASE_URL_APP
  tenantId: string;         // current tenant
}

export function getRestrictedClient(config: RlsConfig): PrismaClient;
export async function withTenantTx<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T>;
```

The migration is in `templates/sql/rls-policies.sql` and is idempotent.

#### 4.2.3 `lib/audit-viewer`

```ts
// index.ts
export interface AuditLogEntry {
  id: string;
  at: string;               // ISO timestamp
  userId: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  rowId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditViewerProps {
  rows: AuditLogEntry[];
  filterControls?: boolean;  // show filter by user, table, date
  pageSize?: number;          // default 50
}

export function AuditViewer(props: AuditViewerProps): JSX.Element;
```

The trigger is in `templates/sql/audit-trigger.sql` and is idempotent.

#### 4.2.4 `lib/docs-guardian`

```ts
// index.ts
export type DocArea =
  | 'API routes'
  | 'Prisma models'
  | 'Env vars'
  | 'UI pages'
  | 'Cron jobs'
  | 'SQL migrations';

export interface DocMap {
  [area: string]: {
    docFiles: string[];    // the docs that must mention this area
    staleCheck: 'manual' | 'guardian';
  };
}

export function loadDocMap(): DocMap;
export function checkDocFreshness(map: DocMap): {
  pass: string[];
  warn: string[];
  fail: string[];          // stale, must update
};
```

#### 4.2.5 `lib/pwa-config`

```ts
// index.ts
import type { PluginOption } from 'vite';

export interface PwaConfigOptions {
  appName: string;
  themeColor: string;
  offlineMessage?: string;  // default "Offline — read only"
}

export function withPwa(config: any, options: PwaConfigOptions): any;
export function useOnlineStatus(): boolean;
export function OfflineBanner(): JSX.Element;
```

#### 4.2.6 `lib/money-as-decimal`

```ts
// index.ts
import { z } from 'zod';

export const MoneySchema = z.string().regex(/^\d+\.\d{2}$/);
export type Money = z.infer<typeof MoneySchema>;

export function formatINR(amount: Money | number): string;
export function formatUSD(amount: Money | number): string;
export function moneyFromNumber(n: number): Money;
export function moneyToNumber(m: Money): number;
```

#### 4.2.7 `lib/auth-shell`

```ts
// index.ts
export interface Session {
  userId: string;
  email: string;
  role: string;             // controlled vocabulary, see lib/auth-shell/roles
  tenantId: string | null;  // null for SUPER_ADMIN
}

export function useSession(): Session | null;
export function getServerSession(): Promise<Session | null>;
export function requireRole(req: Request, role: string): Session | Response;
export function RoleGate(props: { roles: string[]; children: React.ReactNode }): JSX.Element;

export const ROLES = ['admin', 'vendor-rep', 'worker', 'super-worker'] as const;
export type Role = (typeof ROLES)[number];

// First sign-up becomes admin. Reusable across consumers.
export function handleFirstUserIsAdmin(session: Session | null, allUsers: number): Role;
```

### 4.3 How to consume the kit

The consumer's flow:

1. **Read** `tins-kit/SPEC.md` and `tins-kit/HANDOVER.md` (10 min context).
2. **Run** `node tins-kit/scripts/new-project.mjs <project-name>` to scaffold. This
   copies `templates/SPEC.md`, `templates/HANDOVER.md`, `templates/AGENTS.md`, the
   chosen `lib/` modules, and the `scripts/` into the new project directory.
3. **Open** the new project. Run the interview (`prompts/SPEC-AUTHOR.md`) with the
   user. Get answers, run the A/B/C pass, get approval.
4. **Write** the SPEC.md from the template. The TINS markers, the §0.2 table, the §0.0
   "cheapest version" line, the §8 acceptance criteria, the §9 out-of-scope — all
   filled in.
5. **Validate** the spec: `node tins-kit/scripts/validate.mjs --spec <project>/SPEC.md`.
   Fix any errors. The validator checks the schema, the TINS markers, the decision
   table, the "cheapest version" line, the out-of-scope section.
6. **Adopt** the modules the project needs. Copy the relevant `lib/` folders into the
   project. Each module is self-contained; copying is by hand or via
   `scripts/new-project.mjs --with <module-list>`.
7. **Build** the project. TINS-style: spec first, code second, validator green.
8. **At each mode boundary**, run a reviewer session. The reviewer fills in
   `REVIEWER-DECISIONS-REVIEW.md` using `templates/REVIEWER-REVIEW-TEMPLATE.md`.

### 4.4 Dependencies

The kit's own dependencies:

- **None at runtime.** (D3.)
- **Test-only:** Node 18+ built-in test runner (`node --test`). The kit's own smoke
  test uses only built-ins.
- **Documentation-only:** Markdown. No Markdown linter; the spec is human-checked.

The kit RECOMMENDS for consumers:

- **Zod** for runtime input validation (the kit's templates use Zod; consumers may swap
  for Yup or Valibot if they prefer).
- **Prisma + Postgres** for consumers that adopt `lib/tenant-rls/`. The kit's RLS
  primitive is Prisma-specific.
- **Supabase** for consumers that want Postgres + auth + RLS + realtime in one
  service. The Jayshankar-style projects use Supabase.
- **React** for the `lib/audit-viewer/`, `lib/pwa-config/`, and `lib/auth-shell/`
  components. The kit's React usage is minimal; consumers on Vue/Svelte fork the
  components.

The kit FORBIDS for consumers:

- **`lodash`, `moment`, `axios`, `dotenv`** — all have native or kit alternatives.
- **Any UI library that ships its own design system** (MUI, Chakra, Mantine). The
  consumer uses Tailwind utility classes; the kit does not ship a component library.
- **Float-typed money** in any consumer whose domain has money. (D13.)
- **DELETE policies on data tables** in any consumer. (Rule 10.)

---

## 5. Style guide

The kit's own files follow these conventions:

- **Markdown:** CommonMark. No HTML except for `<!-- TINS markers -->` at the top of
  every `SPEC.md`.
- **TypeScript:** strict mode, ESM, no default exports.
- **Naming:** `kebab-case` for files, `camelCase` for variables, `PascalCase` for
  types/classes, `UPPER_SNAKE_CASE` for constants.
- **Line endings:** LF on every platform (`.gitattributes` pins this; consumers adopt
  the same).
- **Comments:** explain *why*, not *what*. The code is the what.
- **No emoji in code or docs** except in the README's status table (✅/⛔/🔶).

The consumer's style guide follows whatever the consumer's framework prefers. The kit
ships no opinion on color palette, font, or spacing; those are the consumer's call.
TINS is about *what* the app does and *why*, not *how* it looks.

---

## 6. Accessibility

The kit ships components (`AuditViewer`, `RoleGate`, `OfflineBanner`) that follow WCAG
2.1 AA by default:

- All interactive elements have visible focus rings.
- Color is not the only signal (e.g. an "offline" state has both a banner and a
  `data-testid="is-offline"` attribute).
- The audit viewer table is semantic (`<table>`, `<thead>`, `<th scope="col">`).
- Form inputs have `<label>` elements, not just placeholders.

Consumers that ship their own UI extend this; the kit does not enforce beyond the
shipped components.

---

## 7. Error handling

The kit's `scripts/validate.mjs` returns a structured result:

```ts
{
  pass: string[];
  warn: string[];
  fail: string[];
  exitCode: 0 | 1;
}
```

- `pass` — checks that succeeded.
- `warn` — checks that succeeded but the consumer should look at. The validator
  exits 0.
- `fail` — checks that failed. The validator exits 1. No `--force` flag.

Consumers add their own checks via `validate.config.mjs`:

```js
// validate.config.mjs (consumer)
export const checks = [
  // Each check is a function that takes a parsed spec and returns
  // { name: string, status: 'pass' | 'warn' | 'fail', message?: string }
  (spec) => ({
    name: 'no money as float',
    status: spec.usesFloatMoney ? 'fail' : 'pass',
    message: spec.usesFloatMoney ? 'Use Decimal for money (D13).' : undefined,
  }),
];
```

The kit's self-test (`scripts/selftest.mjs`) is the proof that the validator catches
known defects. A consumer that extends the validator adds a corresponding self-test
case.

---

## 8. Acceptance criteria

The kit's own acceptance criteria. Numbered, mechanically checkable. The validator runs
these (and consumers can extend with their own).

### 8.1 TINS marker validation
- **§8.1a** A `SPEC.md` without `<!-- TINS Specification v1.0 -->` at the top is
  rejected.
- **§8.1b** A `SPEC.md` without at least one `<!-- ZS: -->` marker is rejected.
- **§8.1c** A `ZS:` marker with an unknown key is rejected (allowed: `COMPLEXITY`,
  `PLATFORM`, `LANGUAGE`; consumers may add more by extending the schema).

### 8.2 §0 structure
- **§8.2a** Every consumer SPEC.md has a §0 with at least one of §0.0 (cheapest version),
  §0.1 (what this document is), §0.2 (locked decisions).
- **§8.2b** The §0.2 table has columns `Decision` and `Resolution` (additional
  columns are allowed but not required).
- **§8.2c** A consumer SPEC.md that has a §0.2 with zero rows is rejected. The
  table must have at least one decision.

### 8.3 §0.0 cheapest-version line
- **§8.3a** Every consumer SPEC.md has a §0.0 that names a concrete cheapest artefact
  (a tool, a file, a service — not "a database" or "an app").

### 8.4 §8 acceptance criteria
- **§8.4a** Every consumer SPEC.md's §8 has at least 5 numbered criteria, each with a
  mechanically checkable assertion.
- **§8.4b** A criterion that starts with a verb like "loads fast" or "is responsive"
  is rejected (the criterion must name a number or a checkable property).

### 8.5 §9 out-of-scope
- **§8.5a** Every consumer SPEC.md has a §9 that explicitly names things NOT in the
  build. A §9 with zero items is rejected.

### 8.6 Templates
- **§8.6a** `templates/SPEC.md`, `templates/HANDOVER.md`, `templates/AGENTS.md`
  exist and are non-empty.
- **§8.6b** `templates/SPEC.md` contains the `<!-- TINS Specification v1.0 -->`
  marker.
- **§8.6c** `templates/HANDOVER.md` has the `Last updated`, `Last worked on by`,
  `Queue position` header.
- **§8.6d** `templates/AGENTS.md` has the `0. Sixty-second orientation` section.

### 8.7 Prompts
- **§8.7a** `prompts/SPEC-AUTHOR.md` exists and is non-empty.
- **§8.7b** `prompts/SPEC-AUTHOR.md` contains the 7-question interview template.
- **§8.7c** `prompts/SPEC-AUTHOR.md` contains the A/B/C pass (measure input data,
  check for rot, propose data format).
- **§8.7d** `prompts/BUILDER-REVIEW-TEMPLATE.md` and
  `prompts/REVIEWER-REVIEW-TEMPLATE.md` exist and are non-empty.

### 8.8 Schemas
- **§8.8a** `schemas/tins-markers.schema.json` is valid JSON Schema.
- **§8.8b** `schemas/locked-decisions.schema.json` is valid JSON Schema.
- **§8.8c** `schemas/tins-spec-minimal.schema.json` requires §0, §1, §2, §4, §8, §9
  at minimum.

### 8.9 Scripts
- **§8.9a** `scripts/validate.mjs` exits 0 on a known-good SPEC.md.
- **§8.9b** `scripts/validate.mjs` exits 1 on a SPEC.md missing the TINS markers.
- **§8.9c** `scripts/validate.mjs` exits 1 on a SPEC.md missing the §0.2 decisions.
- **§8.9d** `scripts/selftest.mjs` runs each of §8.9b, §8.9c (and more) and asserts
  the validator catches the broken input.
- **§8.9e** All scripts run on Node 18+ with `node --test` only (no `npm install`).

### 8.10 Lib modules
- **§8.10a** Each `lib/*/index.ts` has a `README.md` explaining when to use it.
- **§8.10b** Each `lib/*/index.ts` has at least one passing test in `lib/*/tests/`.
- **§8.10c** `lib/tenant-rls/rls-policies.sql` is idempotent (re-running it on a
  database with RLS already enabled is a no-op).

### 8.11 Kit self-application
- **§8.11a** The kit's own SPEC.md satisfies §8.1–§8.6 (the kit is itself a TINS
  spec; the validator runs against it).
- **§8.11b** The kit's own HANDOVER.md follows the template.
- **§8.11c** The kit's own AGENTS.md follows the template.

### 8.12 Decision log discipline
- **§8.12a** A consumer project that adopts the kit has a `BUILDER-DECISIONS-REVIEW.md`
  or `REVIEWER-DECISIONS-REVIEW.md` (at least one) within 1 week of starting.
- **§8.12b** A `SPEC.md` amendment produces an entry in
  `BUILDER-DECISIONS-REVIEW.md` within 24 hours.

### 8.13 lib/ patterns (added 2026-08-15)
- **§8.13a** Every `lib/patterns/<name>.md` file has the 4 required sections:
  `## 0. Why this exists`, `## 1. The 3 lessons, in detail`, `## 2. The 3 known
  anti-patterns`, `## 3. When this pattern changes`. (D19.)
- **§8.13b** Every `lib/patterns/<name>.md` file ends with the canonical footer
  `*— End of \`<name>\` pattern. See also: ...*`.
- **§8.13c** Every `lib/patterns/<name>.md` file is referenced in the §0.4 absorption
  table with the source project(s) it was pulled from.
- **§8.13d** The kit ships at least the 13 patterns listed in §0.4 (Tier 2 additions):
  two-prisma-clients, cross-tenant-404, outbox-job-queue, append-only-audit-log,
  multi-tenant-rls, fifo-cascade-algorithm, shortfall-pattern, idempotent-migrations,
  pinned-deps, observability-first, env-vs-config, prisma-extensions-rls,
  versioned-spec-amendment.

### 8.14 lib/ code modules (added 2026-08-15)
- **§8.14a** Every `lib/<name>/` module has the 3 required files: `index.ts`,
  `README.md`, `tests/<name>.test.ts`. (D20.)
- **§8.14b** Every `lib/<name>/index.ts` exports a single default object that
  contains every public function. (LIBRARY-CONVENTIONS §2.)
- **§8.14c** Every `lib/<name>/tests/<name>.test.ts` has at least 3 cases:
  happy-path, edge-case, error-case.
- **§8.14d** The kit ships all 7 code modules: no-backend, money-as-decimal,
  tenant-rls, audit-viewer, docs-guardian, pwa-config, auth-shell.
- **§8.14e** `scripts/new-project.mjs` scaffolder is present and scaffolds a
  new project (SPEC.md, HANDOVER.md, AGENTS.md, the chosen lib/ modules, the
  scripts/, the CI workflow).
- **§8.14f** `.github/workflows/validate.yml` CI workflow is present and runs
  the kit's `validate.mjs --all` + `selftest.mjs` on every push and PR.

### 8.15 prompts/ additions (added 2026-08-15)
- **§8.15a** `prompts/SPEC-REVIEWER.md` exists and is non-empty. (G17.)
- **§8.15b** `prompts/KITTING.md` exists, has the 9-step loop, and is non-empty. (G18.)
- **§8.15c** `prompts/RELEASE-CHECKLIST.md` exists, has the 8 sections, and is
  non-empty. (G19.)
- **§8.15d** Every prompt file in `prompts/` is a complete, paste-into-session
  message with no "see also" cross-file links. (D4.)

### 8.16 templates/ additions (added 2026-08-15)
- **§8.16a** `templates/HANDOVER.md` exists and is non-empty. (G20.)
- **§8.16b** `templates/AGENTS.md` exists, has the 60-second orientation section,
  and is non-empty. (G21.)
- **§8.16c** `templates/sql/idempotent-migration-pattern.sql` exists, demonstrates
  the 6 idempotency primitives, and is non-empty. (G27.)
- **§8.16d** `templates/eslint/no-float-money.js` exists, blocks `Number()` and
  `parseFloat()` on money-typed fields, and is non-empty. (G25.)
- **§8.16e** `templates/.gitignore` exists, has the 9 must-ignore categories, and is
  non-empty. (G26.)

### 8.17 scripts/ additions (added 2026-08-15)
- **§8.17a** `scripts/kit-coverage.mjs` exists, accepts `--spec=<path>`, and prints
  the matching patterns. (G33.)
- **§8.17b** `scripts/kit-listing.mjs` exists, accepts `--kind=<name>` and `--json`,
  and lists every file in the kit. (G34.)
- **§8.17c** `scripts/kit-new-pattern.mjs` exists, accepts `<name>`, scaffolds
  the pattern file from the canonical 4-section template. (G35.)
- **§8.17d** `scripts/migration-runner.mjs` exists, supports `--dry-run`,
  `--check`, `--dir=<path>`, and tracks applied migrations in a `migrations_applied`
  table. (G31.)
- **§8.17e** `scripts/decision-log.mjs` exists, accepts `builder` or `reviewer`,
  and appends a date-stamped entry to the appropriate file. (G32.)
- **§8.17f** All 5 new scripts run on Node 18+ with zero npm dependencies. (D3.)

### 8.18 schemas/ (added 2026-08-15)
- **§8.18a** All 4 JSON Schemas are valid JSON Schema 2020-12.
- **§8.18b** `schemas/tins-markers.schema.json` requires `tins_version`,
  `kit_version`, `consumer.name`, `consumer.path`, `kind`. (G36.)
- **§8.18c** `schemas/locked-decisions.schema.json` requires `decisions` array
  with `id`, `title`, `choice`, `why` per entry. (G37.)
- **§8.18d** `schemas/handover.schema.json` requires `header.last_updated`,
  `header.last_worked_on_by`, `header.current_queue_position`,
  `state_snapshot`, `work_queue`. (G38.)
- **§8.18e** `schemas/tins-spec-minimal.schema.json` requires §0, §1, §2, §4, §8,
  §9 at minimum, and a `sections` array of size ≥ 6. (G39.)

### 8.19 docs/ (added 2026-08-15)
- **§8.19a** `docs/WORKFLOW.md` exists, has the 5-step consumer workflow, and is
  non-empty. (G40.)
- **§8.19b** `docs/LIBRARY-CONVENTIONS.md` exists, has the 10 conventions, and
  is non-empty. (G41.)
- **§8.19c** `docs/KITTING.md` exists, has the 9-step add-a-pattern workflow, and
  is non-empty. (G42.)
- **§8.19d** `docs/GAP-ANALYSIS.md` exists, lists G01–G60 (or more, as the kit
  grows), and references every gap back to a source project. (Methodology.)

### 8.20 Kit gate (added 2026-08-15)
- **§8.20a** Every change to the kit (new pattern, new module, new script, new
  schema) must come with (i) a §8.X acceptance criterion in this SPEC, (ii) a
  `validate.mjs` check, (iii) a `selftest.mjs` case. (D24.)
- **§8.20b** `node scripts/validate.mjs` exits 0 on a known-good kit state.
- **§8.20c** `node scripts/selftest.mjs` runs every case in isolation and exits 0.
- **§8.20d** The kit's gap analysis is regenerated at the end of every "growth
  session" (a session that adds new patterns / modules / scripts).

### 8.21 Auto-extraction loop (added 2026-08-15, session 8)
- **§8.21a** `scripts/kit-extract.mjs` is present and accepts `--consumer=<path>`,
  `--out=<path>`, `--json`. (D17, second half.)
- **§8.21b** `prompts/KITTING-REVIEW.md` is present, has the 3-question rubric
  (generalises? worked example? duplicates existing?), and is non-empty.
- **§8.21c** `lib/patterns/kit-self-application.md` is present, has the 4-section
  structure (D19), and documents the 2-consumer rule + the 3 known anti-patterns.
- **§8.21d** Running `node scripts/kit-extract.mjs --consumer=<a consumer with a
  BUILDER-DECISIONS-REVIEW.md>` produces a `kit-growth-candidates.md` file with at
  least 1 candidate section per decision with score ≥ 3.
- **§8.21e** Running `node scripts/kit-extract.mjs` against a consumer with no
  BUILDER-DECISIONS-REVIEW.md and no `lib/patterns/` exits 2 (clear error
  message).
- **§8.21f** `docs/WORKFLOW.md` has a "Kit → Consumer → Kit" section documenting
  the full bidirectional loop end-to-end.

### 8.22 Workspace restructure + sync (added 2026-08-15, session 9)
- **§8.22a** `PIPELINE.md` is present at the kit root, has the 7-step
  methodology, and is non-empty. (D25.)
- **§8.22b** `VERSIONING.md` is present at the kit root, has the 7 rules of the
  version control strategy, and is non-empty.
- **§8.22c** `scripts/kit-sync.mjs` is present and accepts `--to=<project-path>`,
  `--json`, `--dry-run`. It is idempotent (re-running produces the same result).
- **§8.22d** `templates/PROJECT-AGENT-BRIEF.md` is present, has the 7-step
  per-project onboarding, and is non-empty.
- **§8.22e** The kit ships with a vendored `tins-kit/` copy in each of the 5
  reference projects (Jayshankar, incubos, Data-cleaning-script, package5,
  exam-forge). Each vendored copy has its own `AGENT-BRIEF.md` at the project
  root that points back to `tins-kit/PIPELINE.md`.
- **§8.22f** Running `node scripts/kit-sync.mjs --to=../Jayshankar` after
  changing a file in the top-level kit updates the vendored copy in
  `Jayshankar/tins-kit/` (the sync is additive + update; project-added files
  are preserved).

### 8.23 Staging area + portable kit shell + 2 generic prompts (added 2026-08-15, session 10)
- **§8.23a** `kit-staging/README.md` is present, has the 4-thing-can-be-dropped
  table (BUILDER-DECISIONS-REVIEW.md / kit-growth-candidates.md / lib/patterns /
  lib/<module> / prompts), and is non-empty. (D26.)
- **§8.23b** `kit-staging/inbox/` directory exists (empty by default).
- **§8.23c** `kit-staging/archive/` directory exists (empty by default).
- **§8.23d** `scripts/kit-ingest.mjs` is present and accepts `--out=<path>`,
  `--json`, `--archive`. It scans the inbox and produces a merged triage report
  that groups candidates by project.
- **§8.23e** `scripts/kit-new-project-shell.mjs` is present and accepts
  `<project-name>`, `--out=<path>`, `--tarball=<path>`. It scaffolds a
  portable `.kit-shell/` directory (~10 files, ~50 KB) that ships with the
  project.
- **§8.23f** `scripts/kit-staging-export.mjs` is present and accepts
  `--out=<path>`, `--auto-mine`. It produces a tarball (zip on Windows,
  tar.gz on POSIX) of the consumer's kit-worthy artefacts.
- **§8.23g** `prompts/NEW-PROJECT.md` is present, has the 7-step generic
  workflow, and is non-empty.
- **§8.23h** `prompts/KIT-GROWTH-SESSION.md` is present, has the 8-step
  generic workflow, and is non-empty.
- **§8.23i** Running `node scripts/kit-ingest.mjs` against an inbox with
  one project that has a `BUILDER-DECISIONS-REVIEW.md` with 1+ decisions
  produces a triage report with at least 1 candidate.

### 8.24 INDEX + 4 generic prompts (added 2026-08-15, session 11)
- **§8.24a** `INDEX.md` is present at the kit root, lists all asset
  types (patterns / modules / prompts / templates / scripts / schemas /
  docs / top-level files) with 1-line briefs, and is non-trivial
  (>1 KB). (D27.)
- **§8.24b** `prompts/PROMOTE-TO-TINS.md` is present, has the 7-step
  retro-fit workflow, and is non-trivial.
- **§8.24c** `prompts/CONTINUE-TINS-PROJECT.md` is present, has the
  6-step pickup workflow, and is non-trivial.
- **§8.24d** The kit's 4 generic prompts (NEW-PROJECT,
  PROMOTE-TO-TINS, CONTINUE-TINS-PROJECT, KIT-GROWTH-SESSION) cover
  the 4 scenarios in the user-facing flow (D27): start from scratch,
  retro-fit existing non-TINS, continue existing TINS, kit-growth at
  the kit root. Every consumer LLM session picks one based on which
  scenario it's in.
- **§8.24e** `INDEX.md` references all 4 generic prompts and all 7
  `lib/` code modules by path (so a fresh LLM can `cd` into the kit
  and read them).

### 8.25 Frontend-refresh workflow (added 2026-08-21, session 12)
- **§8.25a** `prompts/FRONTEND-VISION-INTERVIEW.md` is present, is
  non-trivial, and documents the design-vision survey, the
  inspiration-research fallback, and the install-vs-recreate decision
  for all 5 named reference libraries (anime.js, motion, kokonut-ui,
  bklit-ui, shadcn). (D28.)
- **§8.25b** `prompts/FRONTEND-REFRESH.md` is present, is non-trivial,
  and has the 7-step generic workflow for refreshing an existing
  tins-kit website's frontend. (D28.)
- **§8.25c** `prompts/SPEC-AUTHOR.md` and `prompts/INTERVIEW-CHECKLIST.md`
  both reference `FRONTEND-VISION-INTERVIEW.md` as the post-7-question,
  website-only trigger (Step 7a / Q7a). (D28, D4.)
- **§8.25d** `prompts/CONTINUE-TINS-PROJECT.md` references
  `FRONTEND-REFRESH.md` as the routing target for frontend-visual-redesign
  W's. (D28.)

### 8.26 Parallel-work delegation (added 2026-08-21, session 13)
- **§8.26a** `prompts/DELEGATE-WORK.md` is present, is non-trivial, has
  the self-vs-external mode question, and has the 8-step workflow
  (lock check, read context, mode + split, write ledger, independence
  check, build/scan/zip, ledger update, handoff). (D29.)
- **§8.26b** `prompts/INTEGRATE-DELEGATED-WORK.md` is present, is
  non-trivial, and has the 7-step workflow (merge, notes recovery,
  discrepancy reconciliation with the explain-before-apply rule,
  archive, gate). (D29.)
- **§8.26c** `prompts/CONTINUE-TINS-PROJECT.md` references
  `DELEGATE-WORK.md` as a routing target for parallel-work-split W's.
  (D29.)
- **§8.26d** `scripts/check-task-independence.mjs` is present,
  accepts `--ledger=<path>`, and exits 0 on a file-disjoint task set,
  1 on any pairwise file overlap. (D29.)
- **§8.26e** `scripts/scan-task-packet.mjs` is present, accepts a
  packet directory path, and exits 0 on a clean packet, 1 on any
  methodology-fingerprint or path-escape match. (D29.)
- **§8.26f** `templates/TASK-BRIEF.md`, `templates/DELEGATION-LEDGER.md`,
  and `templates/DELEGATION-README.md` are present and non-empty. (D29.)

### 8.27 Open-source release packaging (added 2026-08-21, session 14)
- **§8.27a** `prompts/PUBLISH-OPEN-SOURCE.md` is present, is non-trivial,
  and has the 9-step workflow (readiness check, read context, decide
  scope, copy+scan, quality rubric, verify public gate, git+deploy,
  record release, leave both gates green). (D30.)
- **§8.27b** `prompts/SPEC-AUTHOR.md` and `prompts/INTERVIEW-CHECKLIST.md`
  both have an item/section asking every project (unconditionally, not
  gated) whether public release is ever intended, and both name the
  §0.2 `Public release intended: TRUE/FALSE` row and
  `prompts/PUBLISH-OPEN-SOURCE.md` as the later trigger. (D30, D4.)
- **§8.27c** `prompts/CONTINUE-TINS-PROJECT.md` references
  `PUBLISH-OPEN-SOURCE.md` as a routing target for public-release-packaging
  W's. (D30.)
- **§8.27d** `scripts/private-to-public.mjs` is present, is a real file
  (not embedded in a doc), accepts `<src-dir> <dst-dir>` and
  `<dst-dir> --scan-only`, and exits 0 on a clean destination tree, 1 on
  any methodology-fingerprint, LLM-authorship-fingerprint, or
  path-escape match, 2 on bad usage. (D30.)
- **§8.27e** `scripts/private-to-public.mjs`'s banned-terms list is a
  separate array from `scripts/scan-task-packet.mjs`'s — the two scripts
  do not share or import one list from the other. (D30.)
- **§8.27f** `lib/patterns/private-to-public.md` documents the corporate
  tone requirement for public docs, the whole-tree scan (not a
  narrow known-files scrub), `docs/DESIGN-WALKTHROUGH.md` as a doc
  type, and the §3.7 quality rubric, and references the real
  `scripts/private-to-public.mjs` file rather than embedding a full
  copy of its source. (D30.)

### 8.28 Curriculum / interview-prep generation (added 2026-08-21, session 15)
- **§8.28a** `prompts/GENERATE-CURRICULUM.md` is present, is non-trivial,
  and documents the manifest-first, one-file-per-turn generation
  discipline and the `<project>-curriculum/` sibling-folder location.
  (D31.)
- **§8.28b** `prompts/GENERATE-INTERVIEW-PREP.md` is present, is
  non-trivial, and explicitly names a frontier-model / extended-or-max-
  thinking recommendation for the reimplementation-drills task. (D31.)
- **§8.28c** Both `prompts/GENERATE-CURRICULUM.md` and
  `prompts/GENERATE-INTERVIEW-PREP.md` reference
  `scripts/private-to-public.mjs` as their safety gate (no new scanner
  script or banned-terms list was created for D31). (D31.)
- **§8.28d** `templates/CURRICULUM-PROGRESS.md` is present and
  non-empty. (D31.)
- **§8.28e** `prompts/CONTINUE-TINS-PROJECT.md` references
  `GENERATE-CURRICULUM.md` as a routing target for
  turn-this-into-teaching-material W's. (D31.)

### 8.29 Autonomous orchestration — auditor + workers (added 2026-08-26, session 16)
- **§8.29a** `prompts/AUTONOMOUS-BUILD.md` is present, is non-trivial,
  documents the auditor/worker split, names `delegation/LEDGER.md` as the
  run's state machine, and states that the auditor does not write product
  code. (D32.)
- **§8.29b** `prompts/WORKER-SESSION.md` is present, is non-trivial, and
  documents the worker's escalation duty and its return protocol. (D32.)
- **§8.29c** `scripts/orchestrate.mjs` is present, supports `--dry-run`,
  and documents its exit codes including the parked-run code 3. (D32.)
- **§8.29d** `scripts/escalate.mjs` is present and non-trivial. (D32.)
- **§8.29e** `prompts/AUTONOMOUS-BUILD.md` references
  `scripts/check-task-independence.mjs` and
  `prompts/INTEGRATE-DELEGATED-WORK.md` — autonomy drives D29's pipeline
  rather than replacing it. (D32.)
- **§8.29f** `lib/patterns/tiered-escalation.md` is present and names all
  three tiers (T0, T1, T2). (D32.)
- **§8.29g** `templates/ORCHESTRATION.json` and `templates/ESCALATIONS.md`
  are present and non-empty. (D32.)
- **§8.29h** `prompts/CONTINUE-TINS-PROJECT.md` references
  `AUTONOMOUS-BUILD.md` as a routing target for build-this-autonomously
  W's. (D32.)

### 8.30 Tooling discovery + security audit (added 2026-08-26, session 16)
- **§8.30a** `prompts/TOOLING-AUDIT.md` is present, is non-trivial, names
  all three verdicts (SAFE / REVIEW-REQUIRED / UNSAFE), and states that
  uncertainty resolves to REVIEW-REQUIRED. (D33.)
- **§8.30b** `prompts/TOOLING-AUDIT.md` states that the kit never installs
  a candidate and never executes one to evaluate it. (D33.)
- **§8.30c** `scripts/tooling-audit.mjs` is present and documents its
  blocking behaviour and exit codes. (D33.)
- **§8.30d** `templates/TOOLING-AUDIT.md` is present and carries the
  required columns (verdict, priority, status). (D33.)
- **§8.30e** `lib/patterns/third-party-tool-audit.md` is present and lists
  the red flags the rubric scans for. (D33.)
- **§8.30f** Both `prompts/NEW-PROJECT.md` and
  `prompts/CONTINUE-TINS-PROJECT.md` run `scripts/tooling-audit.mjs` as a
  blocking gate before work starts. (D33.)

### 8.31 Adaptive inline steering prompts (added 2026-08-26, session 16)
- **§8.31a** `prompts/STEERING-PROMPTS.md` is present, is non-trivial, and
  documents both the adaptive-selection rule and the emission
  checkpoints. (D34.)
- **§8.31b** `prompts/STEERING-PROMPTS.md` covers every named drift class,
  self-correction included. (D34.)
- **§8.31c** `prompts/STEERING-PROMPTS.md` states that cards are offered
  and never auto-executed, and that a generic un-adapted card must not be
  emitted. (D34.)
- **§8.31d** Both `prompts/NEW-PROJECT.md` and
  `prompts/CONTINUE-TINS-PROJECT.md` reference `STEERING-PROMPTS.md`. (D34.)

### 8.32 Execution-mode selection (added 2026-08-26, session 17)
- **§8.32a** `prompts/EXECUTION-MODE-INTERVIEW.md` is present, is
  non-trivial, and names all six mode values (`solo`, `auditor-local`,
  `auditor-remote`, `self-parallel`, `external`, `hybrid`). (D35.)
- **§8.32b** `prompts/EXECUTION-MODE-INTERVIEW.md` states that the question is
  asked per round, pre-filled with the previous round's answer. (D35.)
- **§8.32c** `prompts/EXECUTION-MODE-INTERVIEW.md` distinguishes
  `auditor-remote` from `self-parallel` by who orchestrates. (D35.)
- **§8.32d** `scripts/orchestrate.mjs` reads the round's execution mode and
  refuses to dispatch a `solo`, `self-parallel`, or `external` round. (D35.)
- **§8.32e** `prompts/CONTINUE-TINS-PROJECT.md`, `prompts/SPEC-AUTHOR.md`,
  `prompts/NEW-PROJECT.md` and `prompts/AUTONOMOUS-BUILD.md` all reference
  `EXECUTION-MODE-INTERVIEW.md`. (D35.)
- **§8.32f** `prompts/DELEGATE-WORK.md` reads the recorded mode instead of
  asking its own self-vs-external question. (D35.)
- **§8.32g** `templates/DELEGATION-LEDGER.md` carries the
  `Execution mode for this round` header and documents the closed task-mode
  vocabulary. (D35.)
- **§8.32h** `templates/ORCHESTRATION.json` ships worker-command presets for
  remote workers, marked with the date they were verified. (D35.)

### 8.33 Worked examples (added 2026-08-26, session 18)
- **§8.33a** `examples/autonomous-todo-app/` exists and contains `README.md`,
  `TRANSCRIPT.md`, and `RUN-DIGEST.md`. (D36.)
- **§8.33b** The example preserves the run's real state files —
  `delegation/LEDGER.md`, `delegation/ESCALATIONS.md` — and at least one
  worker's `NOTES.md`. (D36.)
- **§8.33c** `README.md` documents what went wrong, not only what worked: it
  names the kit defects the run exposed. (D36.)
- **§8.33d** The example ships the finished artefact the run produced, so a
  reader can run it. (D36.)
- **§8.33e** `scripts/kit-sync.mjs` excludes `examples/` from consumer syncs,
  so the decision that examples are not vendored is true in the code and not
  only in the decision table. (D36.)

---

## 9. Out of scope (kit v1)

- **A web UI for the kit.** The kit is text files and small scripts; consumers do not
  interact with it through a browser. A future `tins-kit-app/` could provide a
  dashboard, but v1 is CLI-only.
- **A code generator that actually writes the consumer's app.** The LLM is the
  generator (per atal-incubation TINS-MCP review). The kit does not automate code
  generation; it ships the prompts, templates, and patterns the LLM uses.
- **A hosting service for the kit's documentation.** `tins-kit/SPEC.md` is the
  source; consumers read it in the repo. A future `tins-kit-docs/` could publish a
  static site, but v1 is repo-only.
- **A CI/CD pipeline for the kit itself.** The kit's `validate.mjs` and `selftest.mjs`
  are the gate. A future `tins-kit/.github/workflows/` could run them on every push,
  but v1 is local-only.
- **A backwards-compatibility promise for `lib/` modules.** Breaking changes are
  expected. Consumers pin the kit version they adopt; upgrades are explicit.
- **Multi-language prompts.** `prompts/SPEC-AUTHOR.md` is English. A future
  `prompts/SPEC-AUTHOR.hi.md` (Hindi) or `prompts/SPEC-AUTHOR.ta.md` (Tamil) could be
  added, but v1 is English.
- **A "TINS-certified" mark.** No third-party certification. The kit's quality is
  proven by the reference projects that adopted it, not by a badge.
- **An automated codemod that rewrites a non-TINS project's code to adopt kit
  patterns.** `prompts/PROMOTE-TO-TINS.md` (Scenario 2, added session 11) covers
  the retro-fit *process* — it documents an existing project's current state and,
  pattern by pattern, judges adopt / document / defer via `kit-coverage.mjs` and an
  LLM session. It does not mechanically rewrite source to insert `lib/tenant-rls`
  calls or similar; that adoption stays manual, spec-first work. (This item
  previously said retro-fitting itself was out of scope — corrected 2026-08-21,
  session 12, once `PROMOTE-TO-TINS.md` shipped in session 11 made that claim
  false.)
- **A "TINS linter" that runs in VS Code.** A future `tins-kit-vscode/` could
  integrate the validator, but v1 is CLI-only.
- **Auto-generated API client SDKs.** The kit does not ship a tool that reads a
  consumer's API routes and generates a typed client. Consumers may adopt
  `openapi-typescript` or similar, but the kit does not provide this.
- **A hosted docs site for the kit.** The kit's docs are repo-only (this file,
  `docs/WORKFLOW.md`, `docs/LIBRARY-CONVENTIONS.md`, `docs/KITTING.md`,
  `docs/GAP-ANALYSIS.md`). A future `tins-kit-docs/` could publish a static site
  via MkDocs or Docusaurus, but v1 is repo-only.
- **A live/shared coordination service for parallel work (D29).**
  `delegation/` is file-based and git-committed; there is no server, no
  shared database, no real-time presence. A round's state lives in
  `delegation/LEDGER.md` and is read/written by whoever runs the prompts.
- **Automated task-dependency scheduling beyond the file-overlap check
  (D29).** `check-task-independence.mjs` only checks whether two tasks'
  touched-file sets intersect. It does not model or schedule ordering
  for tasks whose interface contracts depend on each other — that
  judgment call is the task-brief author's, not the script's.
- **Legal or NDA tooling around external delegation (D29).**
  `scan-task-packet.mjs` is a technical safeguard against accidental
  methodology leakage in the packet's *contents*; it is not a substitute
  for whatever contractual protection the first author wants in place
  with an external contributor.
- **No automated grading, quiz delivery, or drift-sync for the D31
  curriculum.** `prompts/GENERATE-CURRICULUM.md` and
  `prompts/GENERATE-INTERVIEW-PREP.md` produce markdown, read by a
  human — not a served application, not an auto-graded exercise system.
  There is no incremental mode either: if the project changes after the
  curriculum is generated, re-running the prompts regenerates it from
  scratch rather than diffing.
- **No cross-machine or cross-account distribution of an autonomous run
  (D32).** Every auditor and worker session in a run is local to one
  agent harness on one machine. There is no scheduler, no queue service,
  and no way to hand a task to a harness elsewhere; that is what D29's
  packet flow is for, and it is a human-in-the-loop path by design.
- **No cost or token budgeting inside an autonomous run (D32).**
  `delegation/ORCHESTRATION.json` caps concurrency and worker retries.
  It does not model spend, does not stop a run when a budget is hit, and
  does not choose cheaper models for cheaper tasks.
- **No autonomous SPEC amendment (D32).** The auditor may not edit
  `SPEC.md`. A run that discovers the spec is wrong files a T2
  escalation and parks the affected task. The spec remains the source,
  and only a human-approved amendment changes it.
- **No runtime sandboxing or dynamic analysis of third-party tools
  (D33).** `prompts/TOOLING-AUDIT.md` reads a candidate's skill body,
  manifest, and published source. It never runs the candidate to see
  what it does. A verdict of SAFE means "nothing in the source gave
  cause for concern", not "this was executed and observed to be
  harmless".
- **No automated installation of MCP servers or skills (D33).** The kit
  reports and blocks; the user installs. There is no flag that makes the
  kit install a candidate on the user's behalf, and no scheduled
  re-audit of tools already installed.
- **No obligation to keep an example current, and none to have one (D36).**
  `examples/` holds captured runs. A run that no longer matches the workflow is
  re-run or deleted, never edited to look current — a patched transcript is a
  fabricated one, and the whole value of an example is that it happened.
  Examples are not synced into consumer projects and are not in the portable
  shell.
- **No automatic execution-mode selection (D35).** The interview advises —
  it counts the independent tasks and says plainly when work does not split —
  but the user chooses. There is no heuristic that picks a mode, no cost or
  quota modelling across providers, and no capability probing of a remote
  worker CLI: the kit ships verified command shapes and tells the user to run
  one worker by hand before the first wave.
- **No mid-round mode changes (D35).** A round's mode is fixed once its
  ledger header is written. Changing it means finishing the round or re-running
  the interview and starting a new one, because half the tasks having been
  built under different rules is not a state any of the prompts can reason
  about.
- **No automatic drift detection behind the steering prompts (D34).**
  Emission depends on the model's own honest self-report at the defined
  checkpoints. There is no monitor watching the transcript for
  contradictions, and no memory of which cards were shown in a previous
  session.

---

## Appendix A — A consumer's first day (worked example)

Imagine a new consumer project called `my-saas/`. The flow:

```bash
# 1. Clone or vendor the kit (here: vendor as a sibling directory)
cd projects/
git clone <tins-kit-repo> tins-kit   # or: git submodule add, or: copy

# 2. Scaffold the new project
node tins-kit/scripts/new-project.mjs my-saas \
  --with=tenant-rls,audit-viewer,money-as-decimal,docs-guardian \
  --no-backend=false

# 3. Open my-saas/, run the interview with the user
cd my-saas/
# (paste prompts/SPEC-AUTHOR.md into a fresh LLM session; run the 7 questions; get answers)
# (run the A/B/C pass; get approval)
# (write SPEC.md from templates/SPEC.md)

# 4. Validate the spec
node ../tins-kit/scripts/validate.mjs --spec ./SPEC.md
# Expected: pass. Fix any fails.

# 5. Start Mode A
# (follow HANDOVER.md §5; build the demo; seed data; runnable locally)

# 6. At the end of Mode A, spawn a reviewer session
# (paste prompts/REVIEWER-REVIEW-TEMPLATE.md into a fresh LLM session)
# (the reviewer reads the SPEC, the HANDOVER, the code; fills in REVIEWER-DECISIONS-REVIEW.md)

# 7. Mode B (pilot with real data), Mode C (production), repeat.
```

---

## Appendix B — The kit's own TINS markers

This file's first lines are:

```
<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:ANY -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
```

The kit's platform is `ANY` because the kit's consumers are not all web apps. The
language is `TYPESCRIPT` because the kit's own `lib/` modules and `scripts/` are TS
(scripts are `.mjs` for zero-dep Node, but the surrounding code is TS).

---

*End of tins-kit SPEC.md v1. Implementation begins in `HANDOVER.md` §5.*
