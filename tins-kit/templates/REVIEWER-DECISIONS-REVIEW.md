# REVIEWER-DECISIONS-REVIEW.md — end-of-mode meta-review

> **The reviewer's findings on a finished mode (Demo, Pilot, Production).** Written
> at mode boundaries, not after every W item. The reviewer's most valuable findings
> are at the meta-level ("should this exist?", "what's the cheapest version?",
> "what did the builder miss because they were too deep in the build?").
>
> **Source:** tins-kit §0.2 (D10: role-separation is recommended at every mode
> boundary, not after every W item). Format derived from the exam-forge and
> atal-incubation reviewer sessions.

---

## What this file is for

A **reviewer finding** is a meta-level observation about a finished mode that
the builder, deep in the work, would not have seen. Examples:

- "The §0.0 cheapest-version line is missing — the spec never priced the
  Google-Sheet version." (forces a re-think)
- "The audit log is never queried by the UI. We built it for compliance; it
  has no operational use. Maybe drop it." (proposes removal)
- "The 3 user roles are over-engineered for the Demo. The wholesaler's team
  is 4 people; admin/rep/worker is fine, but `super-worker` is unused." (D3a)
- "The seed inserts 25 SKUs but only 6 are referenced by sales. The other
  19 are visual noise. Trim the seed." (Demo-data quality)

**What this file is NOT for:** line-level code review. That's the validator
and the test suite. Reviewer findings are about the *whole* of a mode.

---

## When to write an entry

- At the end of a mode (per the consumer's SPEC §0.2 lifecycle: Demo → Pilot →
  Production). Spawn a reviewer session (R3 per the role-separation pattern).
- After any major SPEC amendment, even mid-mode (because an amendment can
  change the mode's intent).
- NOT after every W item. D10 is explicit: the reviewer's value drops if
  they review every change.

---

## Format

```markdown
## Mode: <Demo | Pilot | Production> — review date YYYY-MM-DD

### Finding N — short title

**What was checked.** One paragraph: the surface area the reviewer looked at
(SPEC.md, the schema, the UI, the validator, the seed, etc.).

**What's good.** One paragraph: what the builder got right. Be specific —
name the file, the line, the test. Empty paragraphs are fine if the surface
is genuinely weak.

**What's missing / what's wrong.** One paragraph: the gap. Be specific.
Quote the line of code or spec that has the problem.

**Severity.** One of:
- **🔴 CRITICAL** — blocks Mode → next mode. Fix before promoting.
- **🟡 SHOULD-FIX** — degrades the mode. Fix during the next mode.
- **🟢 NICE-TO-HAVE** — improves the mode. Add to the next mode's queue.

**Suggested next action.** One paragraph: what to do, who should do it,
which W item it belongs in.

**Builder response** (added later, when the builder acts on the finding).
One paragraph: what the builder did, or why they deferred it.
```

Each finding is a level-3 heading under a level-2 mode header. Findings are
numbered per mode (Finding 1, Finding 2, ...) — restart the count per mode.

---

## Worked example (from exam-forge W3 review, paraphrased)

```markdown
## Mode: Demo — review date 2024-XX-XX

### Finding 1 — The §0.0 cheapest-version line is missing

**What was checked.** SPEC.md §0.0 (the cheapest-version line at the top of
the spec, mandated by kit D11).

**What's good.** §0.1, §0.2 are complete and consistent. The 14 locked
decisions are well-grounded.

**What's missing / what's wrong.** SPEC.md starts at §0.1 — there is no §0.0
line that names the cheapest version that would work (a Google Form + Sheets,
probably). A future contributor reading the spec has no anchor for "is this
over-engineered?"

**Severity.** 🟡 SHOULD-FIX.

**Suggested next action.** Builder adds a one-paragraph §0.0: "The cheapest
version that would work is a Google Form per exam centre, with results in a
shared Sheet. The expensive version below buys real-time analytics, offline
drafts, and structured question banks. We chose the expensive version because
[reason]."

**Builder response.** Added §0.0 in commit abc123. Re-ran validator; the
§0.0 check (added in the same commit) passes.
```

---

## How this file gets used

1. **Mode boundary:** the Maintainer (R4 per the role-separation pattern)
   reads this file to decide whether to promote to the next mode.
2. **Builder response:** the builder reads this file at the start of the
   next mode, before picking up new W items. Findings without a builder
   response are open; findings with one are closed.
3. **Cross-mode learning:** the Maintainer scans all findings across all
   modes to see which patterns recur (e.g. "we always under-test the audit
   log; build a TRAININGS entry").
4. **Kit improvement:** findings that say "the kit doesn't ship a template
   for X" are escalated to the kit's own `BUILDER-DECISIONS-REVIEW.md`.

---

## Cross-references

- `tins-kit/HANDOVER.md` §7 — the handover protocol
- `tins-kit/SPEC.md` §0.2 (D10) — role-separation at mode boundaries
- `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md` — build-time decisions
- `tins-kit/templates/TRAININGS.md` — debugging-wisdom (symptom-driven)
- A worked-example from a future Mode A review of Jayshankar: written at
  W6, when the gatekeeper demo is shipped.

---

*Template version 1. Last updated 2026-08-06. Format adapted from exam-forge
and atal-incubation reviewer sessions. The exam-forge review was the
"nobody ever priced the cheap version" finding that became D11; the
atal-incubation review was the "self-maintaining docs" finding that became
D8 and the `lib/docs-guardian/` module.*
