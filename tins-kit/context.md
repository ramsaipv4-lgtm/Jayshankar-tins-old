# tins-kit — Context

> **The "why" file.** What tins-kit is, why it exists, what its role is in the bigger
> picture. Read this for orientation. The "what to do" is `HANDOVER.md`. The "how to
> behave" is `AGENTS.md`. The "what to build" is `SPEC.md`.

---

## What this is

**tins-kit** is a library of TINS (There Is No Source) patterns, prompts, schemas,
scripts, and templates, consumed by new TINS projects. It is itself a TINS project —
its own `SPEC.md` follows the methodology, its own `HANDOVER.md` tracks its work
queue, and changes to the kit go through the spec first.

The kit is informed by **three real reference projects**:

| Reference project | Domain | Stack | What the kit absorbed |
|---|---|---|---|
| `archive/exam-forge-reference/` | Education (study / drill / exam) | Vite + React + localStorage | The methodology itself: locked-decisions table, validator discipline, "cheapest version" line, role-separation pattern (Builder / Reviewer / Maintainer) |
| `Jayshankar/` (at the workspace root) | Retail (fish wholesale inventory) | Vite + React + Supabase + PWA | The 3-mode lifecycle (Demo → Pilot → Production), demo-data pattern (real-schema, fake-content), append-only audit log, per-batch pricing, FIFO algorithms |
| `archive/atal-incubation-reference/` | SaaS (multi-tenant incubation management) | Next.js + Prisma + Postgres + RLS + ERPNext | The multi-tenant RLS primitive (two-Prisma-clients + `app.current_tenant` + `withTenantTx`), self-maintaining docs system (`DOC-MAP` + `docs-guardian` + `docs-update`), TRAININGS handbook, money-as-Decimal standing rule |

The kit's value is the **intersection** of patterns that recur in 2+ projects. Three
patterns are explicitly **rejected** because they appeared in one project and were
themselves mistakes (see `SPEC.md` §0.4 for the full matrix).

## Why it exists

Three TINS projects revealed recurring patterns that should be reusable. Each project
re-derived the patterns from scratch:

- The exam-forge project took 2 hours of re-derivation just to define "what's a
  TINS spec."
- The Jayshankar spec took 30 minutes of interview + 2 hours of spec writing.
- The atal-incubation SPEC-v3 took 1,706 lines to capture the patterns that the
  kit now ships in 750 lines.

The kit pays back its 1–2 days of build cost the first time it skips that
re-derivation. The expected payback is on the user's next TINS project — whatever
it is, whenever it comes.

## The 5 layers

The kit is organised into 5 layers. A consumer adopts what it needs; the kit does not
mandate an all-or-nothing adoption.

| Layer | What it provides | Why |
|---|---|---|
| **Prompts** | `SPEC-AUTHOR.md` (the interview-first entry point), `BUILDER-REVIEW-TEMPLATE.md`, `REVIEWER-REVIEW-TEMPLATE.md`, `INTERVIEW-CHECKLIST.md` | Every LLM session working on a consumer project needs an entry point. The prompt is the entry point. |
| **Schemas** | JSON Schemas for the TINS markers, the locked-decisions table, the HANDOVER header, the minimum viable spec shape | Static validation of every artefact a consumer produces. The "is this a TINS spec?" check. |
| **Lib** | Framework-agnostic reusable code with tests + READMEs: `no-backend/`, `tenant-rls/`, `audit-viewer/`, `docs-guardian/`, `pwa-config/`, `money-as-decimal/`, `auth-shell/` | The "how" of the patterns. Each module is opt-in; the consumer picks. |
| **Scripts** | Zero-dependency Node ESM: `validate.mjs`, `selftest.mjs`, `migration-runner.mjs`, `docs-guardian.mjs`, `docs-update.mjs`, `new-project.mjs`, `decision-log.mjs` | The gate. All run before `npm install`. The validator + selftest are the proof that the kit is a kit, not a wishlist. |
| **Templates** | The skeleton: `SPEC.md`, `HANDOVER.md`, `AGENTS.md`, `TRAININGS.md`, `BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md`, plus Zod / SQL / ESLint snippets | The shape a new consumer fills in. Templates enforce the methodology by being the default. |

## The 16 locked decisions

See `SPEC.md` §0.2 for the full table. The 7 most consequential:

- **D1** — Kit is **files**, not a runtime dep. Consumers vendor or submodule.
  Picked because zero-dep scripts + the atal-incubation TINS-MCP review finding
  that the LLM is the generator, not the runtime.
- **D3** — `scripts/` is **zero-dependency** Node ESM, built-ins only.
  Carried from exam-forge.
- **D5** — `lib/` is **framework-agnostic where possible**, thin adapter layer
  where not. The three reference projects use three stacks; the kit serves all.
- **D7** — Validator ships with a **self-test that proves it fails on known
  defects**. Exam-forge's #1 finding — a checker nobody has watched fail is
  decoration.
- **D11** — **"Cheapest version that would work" line is mandatory** in every
  consumer SPEC. Exam-forge REVIEWER's #1 finding, adopted as a hard rule.
- **D13** — **Money is `Decimal`, never `Float`**. Consumers whose domain has
  money adopt this.
- **D14** — **Multi-tenant RLS is opt-in**, not the default. Single-user apps
  skip it; multi-tenant SaaS apps adopt `lib/tenant-rls/`.

## What this is NOT

- **Not a runtime dependency.** Consumers do not `npm install tins-kit`. They
  vendor the files (git submodule, file copy, or `scripts/new-project.mjs`).
- **Not a UI library.** It ships patterns, not components.
- **Not a code generator.** The LLM is the generator (per atal-incubation
  TINS-MCP review). The kit ships the prompts the LLM uses.
- **Not a hosting target.** Consumers pick their own.
- **Not a "TINS-certified" mark.** The kit's quality is proven by the reference
  projects that adopted it, not by a badge.
- **Not a multi-language project.** `prompts/SPEC-AUTHOR.md` is English. Future
  versions may add Hindi or Tamil.

## Current state

- **Meta-specs are flushed:** `SPEC.md` (750 lines), `HANDOVER.md` (157 lines),
  `AGENTS.md` (99 lines), `context.md` (this file).
- **Kit components are empty skeletons** awaiting W1–W9 implementation. The kit
  is currently a spec without a validator — the same failure mode the kit
  itself is supposed to prevent.
- **W1 (the gate) is next:** `prompts/SPEC-AUTHOR.md` adapted from
  `archive/exam-forge-reference/`, the `templates/`, `scripts/validate.mjs`,
  `scripts/selftest.mjs`, `scripts/new-project.mjs`. Done when
  `node scripts/validate.mjs --spec tins-kit/SPEC.md` exits 0.

## The bigger picture

TINS as a methodology is mature. The kit makes it **sustainable across projects**
— a new LLM session opening a consumer's repo can read the kit's templates and
produce a spec in 10 minutes, vs. the 2-hour re-derivation that happened for
each of the three reference projects.

The longer-term bet: the user builds 3–5 more TINS projects over the next 12
months (the Azure course apps, the next client engagement, whatever comes).
The kit amortises its build cost over those projects. If the kit ships 10
specs in the next year, the per-spec cost drops by 90% vs. the re-derivation
model.

## Files in this directory

| File | Purpose |
|---|---|
| `SPEC.md` | The canonical spec (750 lines, 16 decisions, 12 acceptance criteria) |
| `HANDOVER.md` | The work system (W1–W9 queue, gotchas, state snapshot, protocol) |
| `AGENTS.md` | 1-page LLM onboarding (standing rules, ask-vs-try) |
| `context.md` | This file — the "why" |
| `prompts/` | Layer 1 — the entry points for every LLM session (W1) |
| `schemas/` | Layer 2 — static validation of artefacts (W2) |
| `lib/` | Layer 3 — reusable code, opt-in per consumer (W3–W6) |
| `scripts/` | Layer 4 — the gate, all zero-dep (W1) |
| `templates/` | Layer 5 — the skeleton a new consumer fills in (W1–W2) |
| `docs/` | Documentation: `WORKFLOW.md`, `LIBRARY-CONVENTIONS.md`, `KITTING.md` |
| `tests/` | The kit's own smoke test (`kit-smoke.mjs`) |
| `archive/` | Read-only reference projects (exam-forge, atal-incubation) |

## When you start

1. Read `HANDOVER.md` (5 min context).
2. Read `SPEC.md` §0 (the 16 locked decisions, 10 min).
3. Read `AGENTS.md` for the standing rules.
4. Read the W item you're working on in `HANDOVER.md` §5.
5. If you need to amend the spec, follow the interview-first rule (D12). The
   interview is in `SPEC.md` §0.1; the formal prompt lands in W1.
