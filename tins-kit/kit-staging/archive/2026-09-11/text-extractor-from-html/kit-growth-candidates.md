# kit-growth-candidates.md — hand-authored (kit-extract.mjs's parser doesn't match this project's template-compliant format — see note below)

> **Update (real kit now available):** The real `tins-kit` repo was located at
> `C:\Users\user\Desktop\TINS-projects\atal-incubation\tins-kit\` and its actual
> `kit-extract.mjs` was run against this project's real `BUILDER-DECISIONS-REVIEW.md`.
> It found **0 candidates** — not because there's nothing here, but because of a genuine
> bug in the kit itself (see "Kit bugs found" below): the script's parser regex expects
> `## D<N> — Title` headings with `**Context.**`/`**Decision.**`/`**Alternatives.**`/
> `**Consequences.**` fields, but the kit's own consumer-facing
> `templates/BUILDER-DECISIONS-REVIEW.md` — which this project followed exactly —
> documents `### Decision N — Title` headings with `**What changed.**`/`**Why.**`/
> `**Impact on downstream.**`/`**Kit-level implication**` fields. Confirmed by running the
> real script directly against this project: it silently wrote "0 candidates found" and
> overwrote the hand-authored version of this file that existed before. This file has been
> restored to the hand-authored version below, then exported to the kit's staging inbox
> alongside the real (unparsed) `BUILDER-DECISIONS-REVIEW.md` so a human/LLM triage session
> at the kit root can read the source decisions directly.

---

## Kit bugs found while running this workflow for real (report these separately too)

1. **`kit-extract.mjs` parser doesn't match `templates/BUILDER-DECISIONS-REVIEW.md`'s
   documented format.** The template instructs `### Decision N — Title` (level-3 heading,
   "Decision N" prefix) with `**What changed.**`/`**Why.**`/`**Impact on downstream.**`/
   `**Kit-level implication**` fields — see `templates/BUILDER-DECISIONS-REVIEW.md` "Format"
   section and its worked example (Decision 8). But `kit-extract.mjs`'s `parseDecisions()`
   splits on `/\n##\s+/` and matches titles against `/^(D?\d+)\s*[—\-:]\s*(.+)$/`, then reads
   `**Context.**`/`**Decision.**`/`**Alternatives.**`/`**Consequences.**` fields via
   `extractField()`. Neither the heading level, the "D<N>" vs. "Decision N" prefix, nor the
   field names match. Any consumer that follows the shipped template exactly gets silently
   0 candidates, regardless of decision quality. (The kit's *own* `BUILDER-DECISIONS-REVIEW.md`
   does use the `## D<N>` format the parser expects — so the parser matches the kit's own
   internal convention, just not the template it hands out to consumers.)
2. **`kit-new-project-shell.mjs`'s `shellFiles` list is missing `kit-staging-export.mjs`.**
   The script's own header comment and its generated `README.md` both tell the user to run
   `node .kit-shell/scripts/kit-staging-export.mjs` as the final step — but the actual
   `shellFiles` array only copies `decision-log.mjs` and `kit-extract.mjs` into
   `.kit-shell/scripts/`. Verified by running the real scaffolder end-to-end against a fresh
   `/tmp/shell-test`: the generated shell's `scripts/` directory contains only 2 files, and
   `kit-staging-export.mjs` is absent, so the instructions the shell itself prints don't work
   as shipped.

---

## The 2-consumer rule (context for triage)

Per the kit's `kit-self-application` pattern: a pattern is a pattern only if it recurs in 2+
independent consumer projects. All 3 candidates below were observed in **one** consumer
project (`text-extractor-from-html`) — topic 1 and topic 2 are two *datasets* run through the
same codebase, not two independent TINS consumers. The correct triage outcome right now is
**defer** for all three, pending a second, independent project surfacing the same shape of
problem.

---

## Candidate 1 — Smoke-test filename-based reusability claims against genuinely new, operator-supplied data before trusting them

**Source:** consumer's `BUILDER-DECISIONS-REVIEW.md` Decision 11 (D18 in the consumer's `SPEC.md`).

**§0 Why this exists.** A pipeline claimed "works on any similarly-shaped input" on the
strength of a clean run against the dataset it was *built* against. When a genuinely new,
operator-supplied second dataset was run through unmodified, 19 of 40 files silently
misclassified (`file_type: "unknown"`) because a filename regex only accepted the exact
words the first dataset happened to use, plus one anomalous suffix pattern. Nothing crashed —
natural sort order, a section-grouping step, and a filename-pairing step all silently
degraded instead.

**§1 The substance.** Any TINS pipeline stage that derives structured metadata from a
filename convention (type, ordering key, grouping) needs its own explicit smoke test: run
it, unmodified, against a second real dataset from the same operator — not a second dataset
invented by the builder to fit the same regex — before the "works on new data" claim in the
spec is trusted. If the parser has a documented "unknown/unparsed" fallback state, that state
must be checked for a nonzero count on real second-dataset runs, not just assumed absent
because nothing threw.

**§2 Anti-patterns.** Testing reusability by re-running the *original* dataset a second time.
Testing with a second dataset the builder constructs by hand to already match the existing
regex. Treating "the run completed without an exception" as proof of correctness for any
parser with a silent-fallback state.

**§3 When this changes.** If a future pipeline's filename parser has no silent-fallback state
(an unparseable filename is a hard error, not a degraded classification), this candidate's
specific failure mode doesn't apply — but the general principle still would.

---

## Candidate 2 — Structural text extraction (title/heading detection) should search by document position, not by first-matching-tag, with a boilerplate exclusion list

**Source:** consumer's `BUILDER-DECISIONS-REVIEW.md` Decision 12 (D19 in the consumer's `SPEC.md`).

**§0 Why this exists.** "Take the first `<h1>`/`<h2>` in the document" is the obvious, naive
way to extract a page's title from semi-structured HTML. It silently breaks when the
authoring tool didn't apply heading styles consistently — a later, unrelated, often
*recurring* section heading gets picked up as "the" title instead.

**§1 The substance.** Search the content root for the first non-empty **leaf** block in
document order among the plausible title tags (not restricted to heading tags), bounded by a
reasonable max length, and explicitly exclude known placeholder/boilerplate text from being
accepted as a title candidate. Fall back to the old first-heading-tag search, then to any
last-resort tag, only if the leaf-block search comes up empty.

**§2 Anti-patterns.** Restricting the search to heading tags only, assuming "real" titles are
always styled as headings. Fixing this kind of bug for one motivating file without re-running
the full regression sweep across every previously-correct file — this fix itself caused a
regression on a different file, caught only because the full sweep was re-run.

**§3 When this changes.** If the source HTML is generated by a single, controlled pipeline
(not authored by humans through a rich-text editor with inconsistent style application),
first-heading-tag search is probably sufficient.

---

## Candidate 3 — Archival/delivery numbering conventions (`input-N`/`output-N`-style) should be scoped explicitly, not assumed to reset per new dataset/topic/entity

**Source:** consumer's `HANDOVER.md` W7 notes + `SPEC.md` D16 amendment (a post-delivery
process correction, not a code fix — flagging anyway since kit-worthy patterns aren't only
code).

**§0 Why this exists.** The consumer project's D16 established a numbered `input-N`/
`output-N` archival pair per pipeline run. When a second topic's first run was delivered,
the builder read "first run for this topic" as "gets `-1`" and created a new sibling folder
with its own `input-1`/`output-1` — technically consistent with the spec's letter, but not
what the operator meant (their own earlier phrasing made clear the numbering was meant to
increment *within* the existing project folder, across topics). The mismatch wasn't caught
until the operator went looking for files under the name they expected and couldn't find them.

**§1 The substance.** Any TINS project that defines a numbered archival/delivery convention
should state explicitly, in the spec, what the number is scoped to — and when genuinely
ambiguous, confirm with the operator before creating the first artifact under the new number.

**§2 Anti-patterns.** Inferring a numbering scope from what makes the spec's prose internally
consistent, without checking it against how the person who'll actually search for the files
by name expects to find them.

**§3 When this changes.** Doesn't apply to conventions with no ambiguity in the first place.

---

*This file is additive — a future, fixed `kit-extract.mjs` run against this project should
merge with, not silently overwrite, anything here that hasn't yet been triaged.*
