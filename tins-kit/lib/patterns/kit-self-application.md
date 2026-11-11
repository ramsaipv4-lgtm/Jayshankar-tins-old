# `kit-self-application` — kit pattern

> **The bidirectional loop that lets the kit grow from every consumer project.** A
> new consumer scaffolds from the kit (`scripts/new-project.mjs`), uses the kit's
> patterns and modules to build, records its decisions in its own
> `BUILDER-DECISIONS-REVIEW.md`, and a kit-growth session mines that file for new
> patterns and lands them in the kit via the KITTING workflow. The kit is the
> evergrowing project (D17); this pattern is the loop.
>
> **Source:** the kit's own evolution from session 1 (D1–D16, the original 16
> decisions and 7 patterns) to session 7 (D17–D24, the 8 new decisions, 13 new
> patterns, 3 new lib modules, 5 new scripts, 4 new schemas, 3 new docs, plus
> the 4-deferred-items-shipping). Every session followed this pattern; this file
> is the formalised workflow.

---

## 0. Why this exists

The kit is evergrowing (D17). Every consumer project that adopts the kit
crystallises new patterns. Without a feedback loop, the kit stays frozen at the
patterns from session 1; new consumers repeat the same mistakes the kit's
original 5 reference projects (exam-forge, Jayshankar, atal-incubation,
Data-cleaning-script, package5) had already made and documented. With a
feedback loop, the kit grows by 5–10 patterns per consumer, and the third
consumer is dramatically better-served than the first.

The loop is **two halves**:

1. **Kit → consumer** (the *distribution* half). A new project scaffolds from
   the kit (`new-project.mjs`), adopts the patterns and modules, and the LLM
   uses them as recipes + drop-ins. This half is fully automated; the consumer
   runs 3 commands and the kit is wired in.
2. **Consumer → kit** (the *extraction* half). A consumer that crystallises a new
   pattern records it in its own `BUILDER-DECISIONS-REVIEW.md`. A kit-growth
   session mines that file (`kit-extract.mjs`), triages the candidates
   (`prompts/KITTING-REVIEW.md`), and lands the keepers in the kit
   (`prompts/KITTING.md` + `kit-new-pattern.mjs`). This half was manual until
   session 7 added `kit-extract.mjs` (the auto-miner) and `KITTING-REVIEW.md`
   (the triage prompt).

The pattern is the loop, end-to-end. The kit's growth since session 1 is
the worked example.

---

## 1. The 3 lessons, in detail

### Lesson 1 — The kit is a library of files, not a runtime dependency

The kit is shipped as files. Consumers do not `npm install tins-kit`. They
either:

- **Vendor the kit** as a sibling directory (the kit's recommended approach
  per D1):
  ```bash
  git clone <tins-kit-repo> tins-kit
  node tins-kit/scripts/new-project.mjs my-saas --with=tenant-rls,money-as-decimal
  ```
- **Or git-submodule** the kit and reference it via relative path.
- **Or `cp -r`** the relevant `lib/` + `prompts/` + `templates/` + `scripts/`
  into the consumer and adapt the paths.

The vendor approach is best because it preserves the kit's git history
(so `git log tins-kit/` shows the kit's growth). The submodule approach
is fine for monorepos. The `cp -r` approach loses the audit trail; the
consumer has to manually sync when the kit updates.

The kit does not have a `package.json` at the root with a published
artifact. The kit's `scripts/` are zero-dep (D3) and the `lib/` modules
are plain TypeScript. A consumer that wants a runtime dep can wrap
individual `lib/` modules as npm packages, but the kit's primary
delivery is git-vendored.

### Lesson 2 — The extraction is a script + a triage prompt, not a model

The naive approach to "kit learns from consumer" is: every consumer
session runs an LLM that reads its own BUILDER-DECISIONS-REVIEW.md and
emits a JSON of "these are the new patterns." That has two problems:
(1) the LLM call is expensive and non-deterministic, and (2) the LLM
can't be the gate (it can't be re-run reliably in CI).

The kit's approach is **a heuristic classifier** (`scripts/kit-extract.mjs`)
that scores each decision 0–7 based on:
- Title contains "pattern" / "recipe" / "discipline" / "convention" / "rule" (+2)
- Body is substantive (decision > 300 chars, context > 300 chars) (+1 each)
- Mentions "lesson" / "anti-pattern" / "gotcha" / "pitfall" (+1)
- Has a worked example (file path, code, SQL) (+2)
- Not project-specific (mentions consumer name < 4 times) (-3 if violated)
- Not deferred/rejected (penalty -2)
- Not already a kit pattern (+1 if new)

A decision with score ≥ 3 is a *candidate*. The triage prompt
(`prompts/KITTING-REVIEW.md`) applies the 3-question rubric (generalises?
worked example? duplicates an existing pattern?) and produces
accept/reject/defer.

This split — heuristic extraction + LLM triage — is the same shape as
the validator + selftest pair (the validator is the static check, the
selftest is the proof-it-catches-defects). The script is fast and
re-runnable; the prompt is where the judgement lives.

### Lesson 3 — The loop is closed by the consumer recording decisions

The kit can't extract what the consumer doesn't record. The discipline is:
**every consumer that adopts the kit must have a
`BUILDER-DECISIONS-REVIEW.md` and must record its non-obvious decisions
in it.** The kit ships `templates/BUILDER-DECISIONS-REVIEW.md` and
`scripts/decision-log.mjs` for this. A consumer that skips the decision
log is invisible to the kit's growth loop; the next consumer that
hits the same wall will re-derive the lesson from scratch.

The kit's `validate.mjs` has a `kit-§0.4` check (the §0.4
interview-reveals-reality must be present), but it doesn't (yet) check
that a consumer's `BUILDER-DECISIONS-REVIEW.md` has entries. That's a
W-future improvement. For now, the discipline is convention + the
`scripts/decision-log.mjs` helper.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — Editing the kit's `lib/` directly from a consumer

```ts
// ❌ WRONG — consumer patches the kit's code in-place
import { withTenantTx } from '../../../tins-kit/lib/tenant-rls';

// Then later: a kit update overwrites the consumer's patch.
```

Consumers must `cp -r` (or vendor) the kit's `lib/` into their own
`src/lib/`, then adapt. The kit is read-only once installed (D5, the
kit-owns-it rule). If a consumer needs a kit change, the right path is
the KITTING workflow (propose back to the kit) — not in-place editing.

### Anti-pattern 2 — Skipping the consumer's BUILDER-DECISIONS-REVIEW

```ts
// ❌ WRONG — consumer never writes decisions; kit has nothing to mine
// (consumer builds, ships, never records what it learned)
```

A consumer that skips the decision log is invisible to the loop. The
kit grows by 0 patterns from that consumer. The next consumer that
hits the same wall repeats the mistake.

The discipline: every non-obvious decision in `scripts/` or `lib/`
or `prisma/migrations/` or `SPEC.md` amendments gets a
`BUILDER-DECISIONS-REVIEW.md` entry. Use `scripts/decision-log.mjs` to
append without manual editing.

### Anti-pattern 3 — Auto-extracting from a single consumer

```ts
// ❌ WRONG — kit-extract.mjs runs on a single consumer; produces 10
// candidates; the kit-growth session accepts 8 of them; the kit is now
// polluted with patterns observed in 1 consumer.
```

The 2-consumer rule is non-negotiable. A pattern is a pattern only if
it recurs. The `kit-extract.mjs` heuristic doesn't enforce this
(it can't — it sees one consumer at a time); the triage prompt does
("defer if only 1 consumer has the decision"). Future kit releases
may add a cross-consumer check: "this candidate is already proposed
by consumer X, and consumer Y also has the same decision → it's a
real pattern."

---

## 3. When this pattern changes

- **When the kit ships to a hosted docs site (MkDocs / Docusaurus):** the
  `kit-extract.mjs` report becomes a generated page; consumers can
  browse "what's pending in the kit" without running the script.
- **When the kit has > 50 patterns:** the triage prompt's 3-question
  rubric needs a 4th question: "does this pattern overlap with an
  existing one?" (Right now the triage prompt says "compare to existing
  patterns" but doesn't have a systematic way to do it. At 50+ patterns
  the comparison becomes hard for a human; need a similarity check.)
- **When the kit has multiple parallel consumers building at once:**
  the kit-growth session becomes a conflict-resolution problem (two
  consumers propose the same pattern with slightly different shapes).
  The fix: a `kit-arbitrate.mjs` that merges duplicate candidates
  before the triage.
- **When the kit supports cross-language patterns (Python, Go, Rust):**
  the extraction needs to handle language-specific decision logs
  (`BUILDER-DECISIONS-REVIEW.md` in each language) and the triage
  prompt needs language-aware heuristics.

---

*— End of `kit-self-application` pattern. See also: `scripts/kit-extract.mjs`
(the auto-miner), `prompts/KITTING-REVIEW.md` (the triage prompt),
`prompts/KITTING.md` (the per-pattern workflow), `docs/WORKFLOW.md`
(where the loop fits in the consumer flow).*
