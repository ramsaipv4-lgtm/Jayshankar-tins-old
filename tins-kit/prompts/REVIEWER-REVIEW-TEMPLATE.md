# Prompt template: REVIEWER-DECISIONS-REVIEW.md

> **What this is:** the structural template a TINS consumer uses to record every
> *reviewer-side* decision made during the review pass. The companion to
> `BUILDER-DECISIONS-REVIEW.md`. Reviewer decisions are the *meta* decisions: "we
> accept this PR because X", "we reject this PR because Y", "we merged this amendment
> into the spec because Z."
>
> **Source:** `exam-forge/REVIEWER-DECISIONS-REVIEW.md` (the 4-decision format:
  "we approved mode-A", "we rejected the no-backend variant", etc.), the kit's own
  `BUILDER-DECISIONS-REVIEW.md` (the dual format: builder side + reviewer side).

---

## When to use

Run this prompt when you (the reviewer) need to record a decision made *about* a
deliverable, not *during* the deliverable. The 4 canonical cases:

1. You approved a Mode A / Mode B / Mode C milestone — what did the verification
   actually show?
2. You rejected a PR or amendment — what was the reason, and what would unblock it?
3. You merged a `SPEC-AMENDMENT-vN.md` into `SPEC.md` — what's the audit trail?
4. You accepted a builder decision as "the right call" — what's the evidence?

---

## The template

```md
# REVIEWER-DECISIONS-REVIEW.md

> **Audience:** the next reviewer session. The decisions below are made *about*
> deliverables, not during them. If you change a decision (e.g. "we now reject D3
> from BUILDER-DECISIONS-REVIEW"), update this file in the same PR.
>
> **Format:** one decision per ## section. Numbered R1, R2, ... (separate namespace
> from builder D<n>).
>
> **Last updated:** <YYYY-MM-DD>

---

## R<N> — <one-line title>

**Date:** <YYYY-MM-DD>
**Reviewer:** <name>
**Subject:** <what was reviewed — a PR, a milestone, a builder decision, a spec amendment>
**Status:** ✅ approved · 🟡 approved with conditions · ❌ rejected · 🔁 sent back for revision

**Context.** <2–5 sentences. What was being reviewed? What did the builder claim?>

**Evidence reviewed.**
- <test run, e.g. `pnpm test` passed in 4.2s, 32/32 cases green>
- <endpoint hit, e.g. `curl POST /api/auth/login` returned 200 with valid JWT>
- <spec section, e.g. SPEC.md §3.4 was read and matches the implementation>

**Decision.** <1–3 sentences. Approved / rejected / approved-with-conditions.>

**Conditions (if any).** <"Builder must add a regression test for case X before
merging"> or <"Spec author must absorb D3 into SPEC.md §4.2 in the next amendment">.

**What this enables / forecloses.**
- <Enables: the next milestone can build on this>
- <Forecloses: alternative Y is now off the table>

---

<add more R<n> sections as needed>
```

---

## Worked example (R1 from a real consumer)

```md
## R1 — Approve Mode A (auth + protected route end-to-end)

**Date:** 2026-08-15
**Reviewer:** Sai Ram
**Subject:** Mode A milestone — login → JWT → middleware → protected page render
**Status:** ✅ approved

**Context.** Builder claimed Mode A was complete: login form posts to
`/api/auth/login`, server validates against `users` table, returns JWT in HTTP-only
cookie, middleware reads cookie, sets `x-user-id` header, protected page reads header
and renders. We ran the canonical 5-command smoke test from `tins-kit/AGENTS.md` §2.

**Evidence reviewed.**
- `GET /` → 200 (page renders).
- `GET /api/health?check=liveness` → 200 (no DB).
- `GET /api/health?check=readiness` → 200 (DB connected).
- `POST /api/auth/login` with valid creds → 200, Set-Cookie present.
- `GET /api/superadmin/tenants` with the cookie → 200, returns 3 rows.
- `GET /api/superadmin/tenants` without the cookie → 401.
- `pnpm typecheck` → green.
- `pnpm build` → green.

**Decision.** ✅ approved. Mode A is the foundation; subsequent modes (B, C) build
on this. The smoke test is the contract.

**Conditions.** None. The `AGENTS.md` §2 smoke test now lives in
`scripts/smoke.mjs` and is part of the CI gate.
```

---

## Reviewer discipline

A reviewer decision is **evidence-based, not opinion-based**. Every ✅ in this file
must be backed by an "Evidence reviewed" list — a test run, an endpoint hit, a
spec section quoted. The next reviewer (often an LLM) needs to be able to verify
the evidence is still valid, not just trust that the previous reviewer was right.

The 5-question rubric for any review:

1. **What was the builder's claim?** (1 sentence, paste from the PR description)
2. **What evidence did the builder provide?** (test output, screenshots, etc.)
3. **What evidence did I gather independently?** (re-run the test, re-hit the
   endpoint, read the spec section)
4. **Does the evidence support the claim?** (yes / no / partially)
5. **What's the decision and the conditions?** (approved / approved-with / rejected)

If you can't answer 1–3 with concrete artefacts, the review is incomplete.

---

*— End of `REVIEWER-REVIEW-TEMPLATE` prompt. See also: `prompts/BUILDER-REVIEW-TEMPLATE.md`
(the builder-side companion), `prompts/SPEC-REVIEWER.md` (the prompt a reviewer session
runs to do the review itself), `templates/REVIEWER-DECISIONS-REVIEW.md` (the file
template, not the prompt).*
