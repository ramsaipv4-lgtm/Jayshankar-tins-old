# Prompt template: BUILDER-DECISIONS-REVIEW.md

> **What this is:** the structural template a TINS consumer uses to record every
> *builder-side* decision made during implementation. The companion to
> `REVIEWER-DECISIONS-REVIEW.md`. Every TINS project that adopts the kit must produce
> this file within 1 week of starting implementation.
>
> **Source:** `exam-forge/BUILDER-DECISIONS-REVIEW.md` (the 7-decision format),
> `Jayshankar/BUILDER-DECISIONS-REVIEW.md` (the 4-decision format with cross-refs to
> `AGENTS.md` / `HANDOVER.md` / `SPEC.md`), `tins-kit/BUILDER-DECISIONS-REVIEW.md`
> (the self-application, 9 decisions so far).

---

## When to use

Run this prompt when you (the builder) need to record a decision that was made *during
implementation* — not in the spec. The 4 canonical cases:

1. You found that the spec's chosen library is broken / deprecated / wrong.
2. You hit a constraint the spec didn't anticipate (e.g. "the spec said use S3, but
   the tenant's policy forbids it").
3. You chose a sub-pattern (e.g. "for FIFO cascade, we use a numbered procedure +
   JS fixture, not a trigger" — the spec just said "FIFO cascade").
4. You deviated from a kit pattern (e.g. "we don't use `two-prisma-clients` because
   this project is single-tenant").

---

## The template

Copy this into your consumer's `BUILDER-DECISIONS-REVIEW.md` and fill in:

```md
# BUILDER-DECISIONS-REVIEW.md

> **Audience:** the next LLM session that picks up this project. The decisions below
> are made during implementation and are NOT in `SPEC.md` (those are in the spec
> itself). If you change one, update this file in the same PR.
>
> **Format:** one decision per ## section. Numbered sequentially (D1, D2, ...) in the
> order they were made. Don't renumber — the numbers are the audit trail.
>
> **Last updated:** <YYYY-MM-DD>

---

## D<N> — <one-line title>

**Date:** <YYYY-MM-DD>
**Status:** ✅ accepted · 🟡 proposed · ❌ rejected
**Decided by:** <name>
**Cross-references:** SPEC.md §<X>, AGENTS.md §<Y>, HANDOVER.md W<N>

**Context.** <2–5 sentences. What problem were we solving? What did the spec say?
What did we discover?>

**Decision.** <1–3 sentences. What did we choose?>

**Alternatives considered.**
- <Alternative 1>: <why rejected in 1 sentence>
- <Alternative 2>: <why rejected in 1 sentence>

**Consequences.**
- <What this enables>
- <What this forecloses>

**How to verify.** <"Run X, expect Y"> or <"See test Z">.

---

<add more D<n> sections as needed>
```

---

## Worked example (D1 from a real consumer)

```md
## D1 — Money type is Decimal(18,4) in Postgres, string in Zod, Prisma.Decimal in app

**Date:** 2026-08-15
**Status:** ✅ accepted
**Decided by:** Sai Ram
**Cross-references:** SPEC.md §2.1, AGENTS.md standing rule #5

**Context.** The spec said "all money fields are Decimal." We had to pick the
representation at three layers: Postgres (column type), Zod (input validation),
Prisma (in-process). Float was the obvious-wrong choice.

**Decision.**
- Postgres: `Decimal(18,4)` (18 digits, 4 after the decimal — supports up to
  ₹999,999,999,999,999.9999 per cell, which covers every grant tranche in the spec).
- Zod: `z.string().regex(/^\d+\.\d{2}$/)` — the API accepts strings only, never
  numbers, to prevent JSON float coercion.
- Prisma: `Prisma.Decimal` from `@prisma/client/runtime` — the only way to do exact
  arithmetic in the app.

**Alternatives considered.**
- `Float` (rejected: `0.1 + 0.2 = 0.30000000000000004` in IEEE 754; would cause
  tranche release to drift over many grants).
- `BigInt` storing paise (rejected: humans reading the DB see "₹100" as "10000" —
  too easy to misread).
- `numeric(38,18)` (rejected: overkill for money; clutters the schema).

**Consequences.**
- Every `findMany` returns `Prisma.Decimal`, which is JSON-serialised as a string.
  Frontend must parse with `new Prisma.Decimal(str)`, not `Number(str)`.
- ESLint rule `no-float-money` (template: `templates/eslint/no-float-money.js`) blocks
  `Number()` and `parseFloat()` on any field ending in `Amount`, `Price`, `Cost`,
  `TrancheSize`.

**How to verify.** `pnpm typecheck` (validates the Zod schema), `pnpm test money`
(validates the formatter), and a manual `SELECT SUM(amount) FROM grant_tranche`
matches a hand calculation.
```

---

## When to update

- **When you make a builder decision** (the 4 canonical cases above): add a new
  `D<n>` section in the same PR that implements the decision.
- **When you discover a decision was wrong**: don't delete it — add a new
  `D<n+1>` that says "D<n> is superseded, see this section." The audit trail is the
  point.
- **When the spec changes to absorb a builder decision**: add a
  `BUILDER→SPEC-ABSORBED` note in the builder decision, and link to the
  `SPEC-AMENDMENT-vN.md` that did the absorbing.

---

*— End of `BUILDER-REVIEW-TEMPLATE` prompt. See also: `prompts/REVIEWER-REVIEW-TEMPLATE.md`
(the reviewer-side companion), `templates/BUILDER-DECISIONS-REVIEW.md` (the
file-template, not the prompt), `tins-kit/BUILDER-DECISIONS-REVIEW.md` (the
self-application).*
