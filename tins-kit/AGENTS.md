# AGENTS.md — onboarding for a new LLM session

> You are a new session about to work on `tins-kit`. Read this before anything else.
> If you are a human, read `README.md` instead — this file tells your AI assistant what to
> do on day one.

---

## 0. Sixty-second orientation

- **What tins-kit is:** a library of TINS (There Is No Source) patterns, prompts, schemas,
  scripts, templates, lib modules, and docs, consumed by new TINS projects. The kit is
  itself a TINS project.
- **What it's for:** skip the "what format should the spec be in?", "how do I write
  acceptance criteria?", "what does a validator look like?" discovery phase on a new project.
- **Methodology:** TINS. `tins-kit/SPEC.md` is the source. The kit is generated from it.
  Never fix a defect by editing generated code; edit `SPEC.md` and regenerate.
- **Built and working:** the spec + 20 patterns + 3 lib code modules + 7 prompts +
  8 templates + 4 JSON Schemas + 10 scripts + 4 docs files. The kit is now a working
  library, not just a spec.
- **Not built:** the 4 deferred `lib/` modules (audit-viewer, docs-guardian, pwa-config,
  auth-shell). The patterns in `lib/patterns/` cover the rationale; the modules themselves
  are documented in SPEC §9 as deferred to a future kit release.
- **Gate:** `node scripts/validate.mjs && node scripts/selftest.mjs` must both exit 0.
- **The kit is evergrowing (D17).** Adding new patterns / modules / scripts is a
  first-class workflow (see `prompts/KITTING.md` + `docs/KITTING.md`).

## 0a. Which job are you here to do?

| The user asked you to… | Role | Go to |
|---|---|---|
| Build the kit (continue at W7+) | R2 Builder | `HANDOVER.md` §5, then `SPEC.md` §2 for the W item |
| Amend the kit's SPEC | R1 Spec author | Read `SPEC.md` §0 first, then the 7-question interview in `prompts/SPEC-AUTHOR.md` |
| Review the kit's builder work | R3 Reviewer | `prompts/SPEC-REVIEWER.md`, `BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md` |
| Use the kit in a new project | R2 Consumer | `docs/WORKFLOW.md` and the kit's `SPEC.md` §4.3 |
| Add a new pattern / module to the kit | R2 Contributor | `prompts/KITTING.md` and `docs/KITTING.md` |
| Check status / hand the project on | R4 Maintainer | `HANDOVER.md` §1 |

## 0b. What the kit is and what it is not

**The kit is:**

- A library of files (prompts, schemas, scripts, lib modules, templates, docs) consumed
  by new TINS projects. 20 patterns, 3 lib modules, 7 prompts, 8 templates, 4 JSON
  Schemas, 10 scripts, 4 docs.
- Informed by five real reference projects: exam-forge (methodology), Jayshankar
  (3-mode lifecycle, audit log, per-batch pricing, FIFO cascade, shortfall),
  atal-incubation (multi-tenant RLS, two-Prisma-clients, outbox/jobqueue, observability,
  self-maintaining docs, TRAININGS), Data-cleaning-script (build-time vs. runtime env,
  manifest-in-lockstep, the v1→v1.1→v3→v4 lineage), package5 (skill-template pattern,
  3-track study plan).
- A TINS project itself — its own `SPEC.md` follows the methodology.
- **Evergrowing** (D17). New patterns / modules / scripts are added via the KITTING
  workflow; the gap analysis (`docs/GAP-ANALYSIS.md`) is the live record of what's
  pending.

**The kit is NOT:**

- A runtime dependency. Consumers do not `npm install tins-kit`. They vendor the files
  (git submodule, file copy, or `scripts/new-project.mjs`).
- A UI library. It ships patterns and a few React-adjacent primitives (`useLocalState`,
  `OfflineBanner`-style), not a full component library.
- A code generator. The LLM is the generator (per atal-incubation TINS-MCP review).
- A hosting target. Consumers pick their own.
- A "TINS-certified" mark. The kit's quality is proven by the reference projects that
  adopted it.

## 1. Read these, in this order

| # | File | Why |
|---|---|---|
| 1 | `tins-kit/HANDOVER.md` | Current state, work queue (W1–W10), gotchas, handover protocol |
| 2 | `tins-kit/SPEC.md` §0 (locked decisions) | 24 decisions that are already settled. Do not relitigate them. |
| 3 | `tins-kit/SPEC.md` §2 + §4 for whatever you are building | What the kit provides, and how to consume it |
| 4 | `tins-kit/docs/WORKFLOW.md` | The 5-step consumer workflow |
| 5 | `tins-kit/docs/GAP-ANALYSIS.md` | The 60 gaps, what's done, what's pending |
| 6 | `tins-kit/docs/LIBRARY-CONVENTIONS.md` | The conventions for writing a new `lib/` module |
| 7 | `tins-kit/docs/KITTING.md` | The 9-step workflow for adding a new pattern |
| 8 | `archive/exam-forge-reference/` (read-only) | The first reference project (Vite + React + localStorage, single-user) |
| 9 | `archive/atal-incubation-reference/` (read-only) | The third reference project (Next.js + Prisma + Postgres + RLS, multi-tenant) |
| 10 | `../SPEC.md` (at the workspace root) | The first consumer project — Jayshankar, fish-wholesale inventory |

## 2. First commands

```bash
node --version                                       # need >= 18
ls tins-kit/                                         # confirm SPEC.md, HANDOVER.md, AGENTS.md exist
ls tins-kit/lib/patterns/                            # 20 entries
ls tins-kit/lib/{no-backend,money-as-decimal,tenant-rls}/  # 3 code modules
ls tins-kit/prompts/                                 # 7 entries
ls tins-kit/schemas/                                 # 4 entries
ls tins-kit/scripts/                                 # 10 entries
ls tins-kit/templates/                               # 8 entries (+ subdirs)
ls tins-kit/docs/                                    # 4 entries

node tins-kit/scripts/validate.mjs --spec tins-kit/SPEC.md   # the gate
node tins-kit/scripts/selftest.mjs                        # the validator's self-test
node tins-kit/scripts/kit-listing.mjs                     # what's in the kit, one-liner
node tins-kit/scripts/kit-coverage.mjs --spec=<consumer>  # which patterns apply
```

Expect: validate green, selftest green, kit-listing reports the inventory above. If red,
stop and fix before touching anything else. A broken gate is worse than no gate.

## 3. Standing rules (non-negotiable)

1. **Never edit generated code to fix a defect.** Edit `tins-kit/SPEC.md` and
   regenerate. The spec is the source. (D2, D16.)
2. **Never add a runtime dependency to the kit's `scripts/`.** D3 — the kit's
   scripts are zero-dep Node ESM, built-ins only. The pipeline must run before any
   `npm install`. (Exception: `migration-runner.mjs` uses `pg` because writing a
   Postgres client from scratch is more than 200 lines; documented in HANDOVER §6.)
3. **Never ship `lib/` modules without tests.** §8.14c — every `lib/<name>/tests/`
   has at least 3 cases (happy / edge / error).
4. **Never add a `lib/` module without a `README.md` explaining when to use it.**
   §8.14a.
5. **Every pattern follows the 4-section structure.** D19 — `§0 Why this exists`,
   `§1 The 3 lessons, in detail`, `§2 The 3 known anti-patterns`, `§3 When this
   pattern changes`. The validator parses for these headings.
6. **Every code module follows the canonical layout.** D20 — `index.ts` + `README.md`
   + `<impl>.ts` + `tests/<name>.test.ts`. The validator parses for this layout.
7. **Every change comes with (a) a §8.X, (b) a validate.mjs check, (c) a selftest
   case.** D24. A change without all three is incomplete.
8. **The kit's `lib/` is framework-agnostic where possible.** D5 — pure-TS core,
   framework adapter layer where the framework is required. Consumers fork
   components for non-React frameworks.
9. **Never write the spec without running the interview first.** D12 — the entry
   point is `prompts/SPEC-AUTHOR.md`. For the kit itself, the entry point is the
   7-question + A/B/C pass in `prompts/INTERVIEW-CHECKLIST.md`.
10. **The "cheapest version that would work" line is mandatory.** D11 — every
    consumer SPEC.md has a §0.0 that names the cheapest artefact and what the
    expensive version buys.
11. **Money is `Decimal`, never `Float`.** D13 — consumers whose domain has money
    adopt this. The kit ships the pattern in `lib/money-as-decimal/` and the
    `templates/eslint/no-float-money.js` ESLint rule.
12. **Multi-tenant isolation is opt-in, but if chosen, it uses RLS at the database.**
    D14 — `lib/tenant-rls/` ships the primitive; consumers without tenancy skip it.
13. **The validator fails loudly.** D7 + the kit's own rule — no `--force`, no
    "warn and continue". A validator nobody has watched fail is decoration.
14. **Decisions and review findings are recorded.** Every spec amendment produces
    an entry in `BUILDER-DECISIONS-REVIEW.md`. Every reviewer session produces an
    entry in `REVIEWER-DECISIONS-REVIEW.md`. Use `scripts/decision-log.mjs` to
    append without manual editing.
15. **The kit is evergrowing (D17).** When you discover a new pattern (in 2+
    reference projects, reusable, with a worked example), add it via
    `prompts/KITTING.md` + `scripts/kit-new-pattern.mjs`. Don't wait for a
    "kit 2.0"; add it now or add it never.
16. **Cross-tenant 404, not 403.** (G02 / `lib/patterns/cross-tenant-404.md`.)
    When a resource lookup might cross tenants, return 404, never 403.

## 4. Ask vs. try

**Try** (just do it, then report): anything covered by `tins-kit/SPEC.md`; adding
validator checks with matching self-test cases; adding a `lib/` module that follows
`docs/LIBRARY-CONVENTIONS.md`; adding a new `lib/patterns/<name>.md` via
`scripts/kit-new-pattern.mjs` and the KITTING workflow; copying a template or prompt
from a reference project; running `scripts/kit-coverage.mjs` against a consumer's
SPEC.md to recommend patterns.

**Ask first**: changing anything in `tins-kit/SPEC.md` §0.2 (the 24 locked
decisions); adding a new `lib/` module category (D5 is the rule, ask if you're
unsure); anything that would introduce a runtime dependency to the kit's `scripts/`
or `lib/` (D3); breaking changes to existing `lib/` modules (call them out in the
handover); changing the reference-projects archive structure; promoting a deferred
module (audit-viewer, docs-guardian, pwa-config, auth-shell) to first-class.

## 5. When you finish

Follow the handover protocol in `HANDOVER.md` §7. An unrecorded finding is a finding
the next session pays for again.

## 6. If you find a new gap

The kit is evergrowing (D17). If you discover a new pattern (a thing 2+ consumer
projects do that the kit doesn't capture yet):

1. Open `docs/GAP-ANALYSIS.md` and add a row to the gap table (G<N+1>: name, target
   file, source projects, why).
2. Follow `docs/KITTING.md` to scaffold the pattern file via
   `scripts/kit-new-pattern.mjs`.
3. Add a validator check + a self-test case.
4. Update `SPEC.md` (D, §0.4, §2, §4.1, §8.X).
5. Update `HANDOVER.md` (mark the W done, add state snapshot row).
6. Update `BUILDER-DECISIONS-REVIEW.md` (D<N> entry).
7. Run the gate.

If you find a generalisable lesson (not pattern-shaped), add it to
`docs/GAP-ANALYSIS.md` as "future" for a future session to crystallise.
