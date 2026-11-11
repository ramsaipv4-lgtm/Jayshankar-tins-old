# Round 1 — Retrieval and reuse loop (lens report)

Experiments ran on a scratch copy of the kit; scripts and outputs are in the session scratch dir `r1-retrieval/` (`match.mjs`, `eval.mjs`, `specrank.mjs`, `specs/`, `frontmatter-trial.md`).

## 1. Verdict

The design is sound, but the machinery it says it will "extend" does not yet exist: `kit-ingest.mjs` has no similarity matching and parsed 0 candidates from Jayshankar's real decision log, and `kit-coverage.mjs` missed 56% of the patterns a human would apply across three specs. A reinvention-rate metric on Jayshankar would score near zero by construction. Build front matter and a corrected kit-coverage first; treat the disposition gate and metric as unproven until a pilot.

## 2. Problems

### Critical

**C1. kit-ingest cannot read the owner's own decision log, and has no duplicate detection.**
- *Evidence (verified).* I copied Jayshankar's `BUILDER-DECISIONS-REVIEW.md` into a scratch inbox. `kit-ingest.mjs` returned "0 candidate(s)". It splits on `\n##\s+` (`kit-ingest.mjs:88`), but the log uses `### Decision N —` under `## W6 — date`. `kit-extract.mjs:162` was fixed for this format; `kit-ingest` was not. Both real triage reports (`kit-staging/triage-2026-08-16.md`, `-09-11.md`) say 0 candidates.
- *Evidence (verified).* Run on the same file, `kit-extract` returns 76 of 98 decisions as "candidates". All 16 decisions that are the known sources of existing patterns (#8, 10, 11, 16, 18, 19, 23, 24, 26, 27, 28, 31, 33, 34, 35, 60) are re-flagged as new, at scores 5–8. Its only dedup is `+1` if the title slug differs from a pattern filename (`kit-extract.mjs:303`). `KITTING-REVIEW.md` Q3 says "compare titles" and leaves it to the reviewer.
- *Consequence.* "Count a close match to an existing pattern as a retrieval failure" would score every pattern's own source decision as a failure.
- *Rectify.* Share one parser module between `kit-ingest` and `kit-extract`. Add `derived_from: [jayshankar#8, #10, #11]` to pattern front matter (pre-fill from the `> **Source:**` lines; 21 of 24 have one) and exclude those decisions from the duplicate check. Add a selftest feeding a `### Decision N —` log and expecting more than 0 candidates.

### High

**H1. kit-coverage is too weak to be the spine of retrieval.**
- *Evidence (verified).* Specs: (a) expense tracker, (b) focus assistant, (c) inventory app; ground truth is my judgement. Spec (c) was written knowing Jayshankar, so it is biased toward the keyword list.

| Spec | Human-applicable | kit-coverage hits | Recall | False positives |
|---|---|---|---|---|
| a | 9 | 3 | 33% | 0 |
| a, with "offline-first PWA" worded in | 9 | 4 | 44% | 0 |
| b | 7 strong (+4 maybe) | 1 | 14% | 3 of 6 shown |
| c | 11 | 8 | 73% | 0 |

  Pooled over a/b/c: 12 of 27 found, **miss rate 56%**.
- Four of 24 patterns have no `KEYWORDS` entry and can never match: `tiered-escalation`, `third-party-tool-audit`, `manual-relay-worker-loop`, `kit-self-application`. Spec (b), an LLM agent with an approval boundary, is the textbook `tiered-escalation` case and scores 0.
- Matching is substring: "worlds" fires `rls`, "sqlite" fires `sql`, "summary" fires `sum`, "public portal" fires `private-to-public`. Score is `found / keywords.length`, so short keyword lists outrank better matches. Spec (b) got two Prisma multi-tenant patterns for a one-user app.
- *Rectify.* Move `triggers` into each pattern's front matter so there is one source and no second hand-kept file. Use word-boundary matching. Return a ranked list with a score floor, not a count. Add a required `triggers` check to `validate.mjs`. A validator check needs a SPEC §8.X and a selftest case (`KITTING.md` step 6), so budget that.

**H2. The 4-section "standard" is nominal, and the two checkers disagree.**
- *Evidence (verified).* `kit-ingest` requires the literal headings `## 1. The 3 lessons`, `## 2. The 3 known anti-patterns` and `## 3. When this`. Only 8 of 24 shipped patterns pass. `validate.mjs:339-345` accepts a looser regex.
- Headings vary: `pwa-offline-graceful` has no §2 and "When this changes" at §4. Extraction cannot be regex-only.
- *Rectify.* Front matter is the machine surface; prose stays free-form. Retire the heading-literal check in `kit-ingest`.

**H3. `verified` and `not_when` cannot be filled honestly from existing prose.**
- *Evidence (verified).* I wrote front matter for `pwa-offline-graceful`, `shortfall-pattern` and `tiered-escalation`. `solves` is extractable from the lede in about 21 of 24 patterns (not `FRONTEND-OVERHAUL`, `private-to-public`, `env-vs-config`); `assumes` partly; `used_by` by parsing the Source line. `triggers` is invented vocabulary. `verified` is impossible: no pattern records a version or date, and the draft's own example is already wrong (`vite-plugin-pwa 0.20` versus `package.json:54` `^1.3.0`). `not_when` is not in the text: "When this changes" holds upgrade paths, not exclusions, and the draft's example `[collaborative editing, regulated data capture]` has 0 hits in the pattern. That is what an LLM-filled field looks like: plausible and unsourced.
- *Rectify.* Backfill by hand, once, by an author who has read each pattern. `not_when` = conditions stated in the pattern or observed in a consumer, with a citation. `verified` = a command that was run, else null; null beats guessed.

**H4. Task-time `kit_refs` collides with the packet scrubber.**
- *Evidence (verified).* `scan-task-packet.mjs:57` fails any external packet containing the string `tins-kit`. So `kit_refs` pointing at kit paths cannot ship to MiniMax-style external workers.
- *Rectify.* `kit_refs` must carry a scrubbed pattern excerpt plus its `not_when`, inlined; add a scrubbed-export mode to the packet builder.

### Medium

**M1. The reinvention metric measures the wrong thing on this repo.**
- *Evidence (verified).* 20 of 24 patterns date from 2026-08-15; 12 were extracted partly from Jayshankar's W1–W6 decisions (#8, 10, 11, 18, 19, 23, 24, 26–28, 31–35). Jayshankar could not reinvent what it authored. Its real rediscoveries were different: within-project (#11 then #16, the same GRANT lesson two days apart), and pattern gaps (#73: `CREATE OR REPLACE` creates a second function when the signature changes, and `idempotent-migrations.md:37` covers only the same-signature case; #38: a SECURITY DEFINER function needs its own role check, which `postgres-mutations.md` does not say).
- Decisions carry no dates (16 date strings in 4,567 lines; git history starts 2026-09-10), so "pattern existed before the decision" cannot be computed. The log cites kit patterns 7 times in 98 decisions, mostly as authorship.
- *Rectify.* Add `date:` to the decision template and to `decision-log.mjs`. Report three separate counts: reinvented, applied, and "pattern gap found". The last one is the most valuable signal.

**M2. Decision-time warn is retrospective.** Decisions are written after the work (#90 says "logged retroactively"), so the warning arrives after the code. Retrieval belongs at task-packet time (`DELEGATE-WORK`) and spec-review time; decision time is useful only for the pattern-gap signal.

**M3. The disposition gate will pad.**
- Evidence (inferred). Kit gates are existence checks, so padding is cheap; any file path satisfies `applied`.
- *Rectify.* Make `applied` mechanically checkable (the pattern's named artefact or a sentinel string appears in the diff), make `rejected`/`adapted` cheap and honest-by-default, and spot-check a random 20% with a different model.

### Low

- **`INDEX.md` is already stale** (says 23 patterns; `manual-relay-worker-loop` is missing), which supports keeping retrieval data in the pattern file.
- **Module claims overstate.** Jayshankar imports none of `lib/*`; `withPwa` is partly a stub; `money-as-decimal` requires `@prisma/client`. `artefact: module` must mean "installed and tested in a consumer".

## 3. What survives

- **Front matter in the pattern file is right**: one source, and `solves` is extractable for most patterns.
- **Rejecting embeddings at 24 patterns is correct.** Whole-body TF-IDF is dominated by hubs (`FRONTEND-OVERHAUL`, `private-to-public`), but indexing only each pattern's first 35 lines (a stand-in for `solves`/`triggers`) recovered 5/9, 3/7 and 7/11 of the human sets in the top 8 for specs a/b/c. That beats KEYWORDS on a and b (3/9, 1/7), is just below it on c (8/11), and surfaced `tiered-escalation` and `third-party-tool-audit` for spec (b).
- **Token overlap on decisions works only as a hint.** On Jayshankar #29–#98 (my 20 positive labels, set after seeing outputs, so recall is inflated): top-1 precision 0.55 / recall 0.60 at θ=0.16; recall 0.15 at θ=0.20; top-3 gives 0.68 / 0.75. Titles alone fire almost nothing. Use similarity to surface candidates for judgement, not as a gate.
- **Human promotion and the two-consumer bar are right.** Both real triage runs produced 0 candidates; there is no throughput to automate yet.
- **At 100 patterns** hubness and the hand-kept INDEX fail first. Stay flat and curated to about 50; add embeddings only if measured top-3 recall falls below about 0.7.

## 4. Unverified

- Whether `not_when` blocks real bad fits: pilot on spec (a), which needs offline writes.
- Disposition padding rates: needs a real multi-session run.
- My ground-truth labels are single-reviewer; a blind second labeller would settle precision/recall.
- How front matter propagates to consumers via `kit-sync.mjs` (not read).

## 5. Top 5 changes to make to the kit first

1. **Fix `kit-ingest`:** shared parser with `kit-extract`, drop the heading-literal check, selftest on a `### Decision N —` fixture.
2. **Backfill front matter on all 24 patterns by hand** (`solves`, `triggers`, `derived_from`, cited `not_when`; `verified` null unless a command was run), with a `validate.mjs` check, SPEC §8.X and selftest.
3. **Rewrite `kit-coverage.mjs`** to read front matter, match on word boundaries, rank with a floor, and print `not_when`. Delete `KEYWORDS`.
4. **Add `date:` to the decision template and `decision-log.mjs`.**
5. **Put scrubbed pattern excerpts in task packets** (`kit_refs`), then pilot on spec (a) before building dispositions or the metric.
