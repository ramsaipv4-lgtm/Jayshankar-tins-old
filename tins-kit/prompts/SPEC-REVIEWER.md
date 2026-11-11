# Prompt: SPEC-REVIEWER

> **The reviewer session runs this prompt.** Companion to `prompts/SPEC-AUTHOR.md`
> (the writer) and `prompts/REVIEWER-REVIEW-TEMPLATE.md` (the file the reviewer fills
> in). This is the *workflow* the reviewer session executes.
>
> **Source:** `atal-incubation` (the W1 SPEC-v3 review pass), `Jayshankar` (the Mode A
> review session that audited the spec against the implementation), `exam-forge`
> (the v1→v2 review that found the 4 holes in the v1 spec).

---

## When to use

A TINS consumer produces a `SPEC.md` (via `SPEC-AUTHOR.md`). Before the spec is
considered "frozen for v1," a *separate* LLM session runs this prompt to:

1. Find the holes in the spec (gaps, ambiguities, missing acceptance criteria).
2. Find the rot in the spec (outdated library versions, deprecated APIs).
3. Find the "I guessed" assumptions in §0.3 and challenge them.
4. Produce a `REVIEWER-DECISIONS-REVIEW.md` entry that says "approved" / "approved with
   conditions" / "rejected" with evidence.

The reviewer session is **separate** from the writer session (the writer's context
is biased toward "this is a good spec because I just wrote it").

---

## The prompt

```
You are reviewing a TINS specification: `SPEC.md` in this repo. Your job is to find
holes, rot, and unstated assumptions, and to produce a `REVIEWER-DECISIONS-REVIEW.md`
entry that says whether the spec is ready to drive implementation.

The spec IS the contract. If implementation deviates from the spec, the spec (or the
implementation) is wrong. Your job is to make sure the spec is *implementable as
written* — not "implementable after I read the writer's mind."

Open `SPEC.md` now. Read it end-to-end. Then run these 6 review passes. For each
pass, record what you found in `REVIEWER-DECISIONS-REVIEW.md` as a numbered
R<n> entry.

---

## Pass 1 — The "what would break this?" walkthrough

Pick the single feature in the spec that the user said is most critical (it's
usually in §1 or §2.1). Walk through it step-by-step, from user action to
server response, as if you were a junior engineer about to implement it. At each
step, ask: "Is this specified? Is the spec clear? If I implement it wrong, will
the spec catch me?"

For every step that the spec doesn't catch, that's a hole. Record it.

---

## Pass 2 — The "rot" check

Anything in the spec with a version number, a date, a product name, or a "current
best practice" claim. Use web search (you have it). For each, ask: "Is this still
true in 2026?" Record any that are not.

Common rot:
- Outdated framework versions (Next.js 14 → 15 changes a lot).
- Deprecated APIs (the `cookies()` helper in Next.js changed signature).
- Sunset services (a "current best practice" from 2024 may be deprecated now).
- Compliance regimes (GDPR, SOC 2 — anything that mentions a specific year).

---

## Pass 3 — The "I guessed" pass

Open SPEC.md §0.3 ("What I guessed"). For each guessed item, ask: "Is this
extrapolation reasonable? What would the user have said if I'd asked
explicitly?" If any guess is a stretch (e.g. "user said '5 incubators', I guessed
multi-tenant — but 5 is small enough to be single-tenant with one DB and 5
schemas"), flag it.

---

## Pass 4 — The acceptance-criteria completeness check

Open SPEC.md §8 (acceptance criteria). For each §8.X, ask: "Could a junior
engineer with no context pass this check?" If the answer is no, the criterion
is too vague. Rewrite it in the R<n> entry as a suggested fix.

The bar: every §8.X is *runnable* — it's either a command, a curl, a test, or
a "see file X" reference. No "the system should be fast" — that's not a
criterion.

---

## Pass 5 — The predecessor documents check

Open SPEC.md §0.0 (predecessor documents). For each predecessor, ask: "Did the
author actually read this? Are the decisions in the predecessor preserved,
amended, or rejected?" If a predecessor said X and the new spec contradicts X
without saying so, that's a hole.

---

## Pass 6 — The "I would build it differently" pass

Imagine you are the builder, and you are about to start implementation tomorrow.
Are there any decisions in the spec that you would *unilaterally change* because
they don't make sense in practice? If so, flag them as "spec-vs-reality gaps."

The builder should not be making these decisions in their BUILDER-DECISIONS-REVIEW.md
— they should be in the spec.

---

## Output

After the 6 passes, write a single R<n> entry in `REVIEWER-DECISIONS-REVIEW.md`:

```md
## R<N> — SPEC.md v<N> review

**Date:** <YYYY-MM-DD>
**Reviewer:** <this session>
**Subject:** <SPEC.md path + version>
**Status:** ✅ approved · 🟡 approved with conditions · ❌ rejected

**Holes found (Pass 1).**
- §<X>.<Y>: <hole, 1 sentence>
- §<X>.<Y>: <hole, 1 sentence>

**Rot found (Pass 2).**
- §<X>.<Y>: <"Next.js 14.2 → 15 changed <X>" with citation link>
- §<X>.<Y>: <"<API> deprecated 2025-09, use <replacement>" with citation link>

**Guesses to verify (Pass 3).**
- §0.3 item 1: <"user said X, I guessed Y — confirm with user">

**Acceptance criteria rewrites (Pass 4).**
- §8.<X>: rewrite as <suggested new text>

**Predecessor contradictions (Pass 5).**
- §<X>.<Y> contradicts <predecessor §A.B> — <how to resolve>

**Spec-vs-reality gaps (Pass 6).**
- §<X>.<Y>: <what the spec says, what a builder would actually do>

**Decision.** <approved / approved-with-conditions / rejected + 1-line reason>

**Conditions (if any).** <list of fixes the spec author must make before v1 freezes>
```

---

## Constraints

- **Do not write the spec.** You are a reviewer, not a writer. If a §X is wrong,
  suggest the rewrite in your R<n> entry — let the spec author accept / reject.
- **Do not add features.** If the spec is missing a feature, that's a hole, not
  a feature request. Flag it; don't add it.
- **Cite your work.** Every "rot" finding needs a web citation. Every "hole"
  finding needs a §X.Y reference. The next reviewer (often an LLM) needs to be
  able to verify your evidence.

---

## When the review is done

The spec author reads the R<n> entry, accepts or rejects each condition, and
either:
- Updates the spec and re-requests review (R<n+1> with the same status as
  "approved after fixes").
- Defers the conditions to a `SPEC-AMENDMENT-v2.md` (for v2 work).

Either way, the R<n> entry is the audit trail. It is the place where the
"why is the spec this shape?" question is answered for the next contributor.
```

---

*— End of `SPEC-REVIEWER` prompt. See also: `prompts/SPEC-AUTHOR.md` (the writer),
`prompts/REVIEWER-REVIEW-TEMPLATE.md` (the file template), `templates/SPEC.md` (the
canonical structure), `templates/REVIEWER-DECISIONS-REVIEW.md` (the file template).*
