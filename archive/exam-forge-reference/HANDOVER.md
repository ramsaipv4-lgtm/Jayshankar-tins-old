# HANDOVER.md — work system

> **Read this before starting. Do not re-audit the legacy tools** — `docs/AUDIT-set5.md`
> and `docs/PIPELINE.md` already did, with measurements. Start from §5 (Work queue).

**Last updated:** 2026-08-03 (session 9 — W5b done + W5b review pass + W7b single-file offline build)
**Last worked on by:** session 9 — W7b. `npm run build:single` → one self-contained HTML file at `dist-single/<bankId>.html` (currently 675.56 KB / 207.77 KB gzipped, 0.64 MB — well under the 5 MB warn threshold). `vite-plugin-singlefile@2.3.3` inlines every asset (CSS, JS, the bank itself). `vite.config.single.ts` is a sibling of `vite.config.ts` with `base: './'` (relative paths for `file://`), the same `@bank` alias, the same `__BANK_HASH__` define, plus a new `__SINGLE_FILE__` define. `src/lib/buildTarget.ts` exposes `isSingleFileBuild` so the runtime can label the camera tier as "unavailable in this build" rather than "tier 0 was chosen" — SPEC §8.20c. The integrity band in `ExamReport.tsx` carries the new `data-testid="integrity-tier-offline"` note. `scripts/check-single-size.mjs` is the size-budget gate (warn 5 MB / fail 10 MB), invoked from the build script and as a vitest subprocess test. **Test count:** 268 → 281 (+13: 1 buildTarget + 1 ExamReport offline branch + 5 size budget + 5 self-contained artifact + 1). All §8.20a–§8.20c covered. The single-build `bankHash` is `__BANK_HASH__` injected at config-eval time (same as the web build); the build-time check prints the size in MB and exits 1 above 10 MB so a 500-question bank with images finds out at build time, not on a student's phone.
**Last worked on by (prior):** session 9 — W5b review pass. Two test fixes from the W5b review: (1) the §2.4.1 test for "Reveal all cannot bypass commit" was asserting presence-of-gate, which a broken implementation that renders the gate AND dumps the rationale below it would have passed. Fix: assert on a distinctive string from the uncommitted current question's rationale and expect zero matches, in BOTH reviewMode=true and reviewMode=false renderings. (2) The blueprint-order rule was untested because the real bank has alphabetical == domain order. Fix: a fixture bank with `zulu` (order 1) and `alpha` (order 2) — alphabetical and blueprint order disagree, so a regression to `sort(glob('notes/*.md'))` is detectable. (3) `ReviewPanel` was missing the per-option rationales the SPEC §2.4.5 review affordance calls for — added `<p data-testid="review-panel-rationale">` under each option. (4) §7 protocol note added: "before writing an assertion, describe the broken implementation that would still pass it. If you can name one, the assertion is wrong." Three for three on the W5/W5b review. Total 266 → 268 (+1 bankHash zulu/alpha fixture; the ReviewPanel fix reshaped existing assertions, no new test added). §2.4.4 scheduler (already in W5b), §2.4.5 full filter set (got-wrong, unanswered, likelihood, difficulty, type, tag) with filter-state persistence and §3.3 empty-state-with-hint, "Reveal all" review affordance with the §2.4.1 guard. The bankHash refinement (hash one file per declared domain in domain.order, drop notes/README.md) lands standalone — one-time hash move. Bundle +9.51 KB / +2.10 KB gzipped; +76 tests (190 → 266). (1) bankHash
moved to a build-time constant: `vite.config.ts` calls `scripts/bankHash.mjs:bankHashFor`
at config-eval time, normalises `\r\n` → `\n`, and injects the result as
`__BANK_HASH__` via Vite's `define`. The runtime reads a string constant; the
`?raw` import is gone; the duplicate bank (W4 follow-up) is gone; bundle is
back to 426 KB / 128 KB gzipped. (2) `.gitattributes` pins every text extension
to `text eol=lf` so the on-disk bytes are LF on every platform. The `normalise()`
step in `bankHashFor` is defence-in-depth. (3) `npm test` exits 0; the static-render
marker is in the test file; CI gates tests+build; all 27 main scripts are
present in build-app's `package.json` (5 new: start, dev, preview, test, test:watch;
build replaced with the real Vite script). **Test count:** 108 → 107 (post-W4
refactor dropped the canonical-JSON describe and the "tampered bank" cross-check,
gained the awkward-case fixture). Then 107 → 109 (this session: +5 for
`normaliseLineEndings`, +6 for `bankHashFor` covering LF/CRLF equivalence, awkward
cases, and content changes, -3 in `real bank` consolidation, -3 in the now-
superseded cross-check describes; net +2). The single test that "went" between
108 and 107 was `bankHash.test.ts > script-side > produces the same hash on a
tampered bank`, subsumed by the awkward-case fixture.
scoring.ts (severity weights in one constant, bands, partial credit, weak subtopics
ordered by likelihood, pacing, the D6 disclaimer), attempts.ts (20-attempt ring buffer +
SeenIndex persisted under separate keys, ring buffer survives a submit, SeenIndex survives
a ring-buffer eviction), full ExamReport.tsx (score, per-domain breakdown, weak subtopics,
pacing, full review in optionOrder, integrity band + D6 disclaimer in
`data-testid="integrity-disclaimer"`, seed display, retake, JSON export, print
stylesheet), bankHash.ts as the single source of truth for the bankHash formula
(shared with scripts/bankHash.mjs; both produce `sha256:` strings; one definition
locked by a cross-check test), storage.ts (probe + in-memory Map + DOM notice so
§3.2 is visible to a private-mode student, not just the console), print stylesheet.
Attempt gains `bankHash: string` (SPEC §4.2 amendment) captured at createAttempt so a
paper can be re-scored against the same build that produced it. The §8.18 test scrapes
the rendered HTML and the JSON export and asserts "cheated"/"cheating" appear only
inside the disclaimer block. 33 unit tests added; total 108.
**Queue position:** W5b ✅ done, W5b review pass ✅ done, W7b ✅ done. W6 ⏳ next (catalog, still deprioritised).

---

## 1. Sixty-second brief

- `SPEC.md` is the source (TINS). The app is generated from it.
- The **content pipeline is done and verified**: schema, converter, validator, self-test,
  one converted bank, and study notes for all three domains.
- **The application is partially generated.** W1 (drill) and W2 (paper construction) are
  done. W3 (exam runtime) is next.
- **One bank = one built site = one public repo.** A bank's content is inlined into the
  JavaScript bundle at build time, so `dist/` is self-contained. Build the next bank with
  `BANK=<bankId> npm run build`; everything else picks up the env var.
- **Nothing is blocked on the user any more.** Both prior blockers (study-notes source
  material, official domain weights) were resolved from `sem5_azure_cloud/`. The deployment
  base path is also resolved (`/ai102-day1-3/`, OPEN-QUESTIONS §6). One staleness flag
  remains in the bank: Q2's rationale.
- ⚠️ **The bank contains a stale factual claim.** `question-bank-50.md` Q2's rationale says no
  AI-102 successor has been announced; AI-103 has been. `docs/SOURCE-MATERIAL.md` §4.

## 2. Environment facts (verified — do not re-derive)

| Fact | Value |
|---|---|
| Host OS | Windows 11 |
| Repo root | `C:\Users\user\Desktop\TINS\exam-forge` |
| Git | ⚠️ **Untracked inside a clone of `github.com/ScuffedEpoch/TINS`.** Not its own repo, no history; `git add -A` in the parent would stage every file here, and `git clean -fd` there deletes the project. Run `npm run check-git` — it exits 1 until this is fixed. Move it out and `git init`; see `docs/STATUS-REPORT.md` §1 |
| Node | v22 available; scripts require ≥18 |
| Dependencies | **none installed, and none needed** for the pipeline. `scripts/` is zero-dependency by design |
| Parent workspace | `C:\Users\user\Desktop\TINS` — contains the TINS docs and the four legacy tools referenced by `docs/PIPELINE.md` |
| Legacy tools | `mcq-mastery-&-analytics/`, `Google_Form_Builder/`, `text2excel/`, `instructions to create google form/` — read-only reference, do not develop there |

## 3. State snapshot

Dated snapshot — run `npm run pipeline` for current figures rather than trusting these lines.

```
$ npm run pipeline
  selftest: 35 passed, 0 failed                          # 2026-08-02
  validate (ai102-day1-3): 50q, 3 domains, 4 warnings    # PASSED
  validate (demo-probe):    7q,  2 domains, 2 warnings   # PASSED
  scan-secrets: no credentials found

$ npm run build
  vite v8.2.0  194 modules
  dist/index.html                   0.48 kB │ gzip:   0.30 kB
  dist/assets/index-*.css          11.20 kB │ gzip:   3.04 kB
  dist/assets/index-*.js          385.05 kB │ gzip: 117.53 kB
  meta -> dist/meta.json  (50 questions, hash a634375a6c5d…)
```

Total gzipped bundle is **117.5 KB including the inlined bank**. The bank alone is
≈30 KB gzipped, so framework+app is ≈87 KB gzipped — well under the SPEC §4.1 target
of 200 KB gzipped excluding the bank.

The four ai102-day1-3 validate warnings are unchanged from session 2 and remain
**known and accepted** (table below).

The four ai102-day1-3 validate warnings are **known and accepted**, each with an owner:

| Warning | Meaning | Action |
|---|---|---|
| B is correct in 26/48 single-answer questions (54%) | authoring habit, above the 40% target | Delivery shuffling hides it (D10). Fix on the next regeneration with prompt v2 |
| section-a: pool 15 vs quota 13 at length 40 | a retake reuses 87% of section A | Acceptable. Grow the bank to relieve it |
| section-c: pool 20 vs quota 20 at length 40 | a retake reuses 100% of section C | `section-c` is the binding constraint on test length; see `docs/SOURCE-MATERIAL.md` §3 |
| no question declares `sourceSection` | the bank was converted from Markdown, so notes↔question coverage cannot be checked | Expected for a converted bank. New banks authored via `GENERATOR-V2` set it; see `docs/NEW-BANK.md` |

## 4. Content inventory

| Bank | Questions | Domains (weight) | Types | Notes | Checkpoints |
|---|---|---|---|---|---|
| `ai102-day1-3` | 50 | 3 — a 32.14 / b 17.86 / c 50.00 | mcq-single 47, multi-select 2, code-completion 1 | ✅ all 3 | ⛔ none |

Weights are **official-normalized** from the published AI-102 domain bands, not from question
counts. Pools are 15 / 15 / 20, so `section-c` binds test length at a maximum of 40. Derivation
and revert instructions: `docs/SOURCE-MATERIAL.md` §3.

Three structural gaps to be aware of before building study mode:

- **No `scenario` and no `true-false` questions.** The converter classifies by prose
  length (>400 chars) and this bank's stems are short — its scenario-style questions
  (Q30, Q44, Q50) are recorded as `mcq-single`. The renderer still needs all five
  branches; do not conclude from the data that three types suffice.
- **`tags` are now applied** from the authored `content/ai102-day1-3/tag-map.json` via
  `npm run tags`. 48/50 questions tagged across 13 taxonomy terms; the 2 untagged are the
  questions whose subtopic is literally "Scenario", which describes form not subject.
  Re-run `node scripts/apply-tags.mjs --bank <dir>` after editing the map.

- ⚠️ **The notes were over-compressed and should be rewritten.** They summarise material that
  was already a summary: Day 2 kept 184 lines of an 889-line source (20%). `prompts/NOTES-V1.md`
  now distinguishes *consolidate* from *condense* and this bank is the worked example of getting
  it wrong. Rewriting them is a content job, not a code job — re-run NOTES-V1 against
  `sem5_azure_cloud/day{1,2,3}/` in consolidate mode. Nothing downstream breaks meanwhile.

- **No `usage: "checkpoint"` questions exist.** Study mode's per-domain quiz has no
  content. Authoring them removes questions from the exam pool (D12), and the pool is
  already exactly one full-length paper.

## 4b. Adding a bank for a different topic

This is a **separate workflow from the work queue**, fully documented in `docs/NEW-BANK.md`:

```
node scripts/new-bank.mjs --id <slug> --domains "a:Alpha,b:Beta"
prompts/NOTES-V1.md        →  blueprint weights + notes/*.md   (notes FIRST)
prompts/GENERATOR-V2.md    →  questions.json, each with sourceSection
npm run validate           →  every bank under content/
```

You must still **ask the user for the topic and their source material** — nothing in the repo
knows what subject they have in mind, and both prompts refuse to guess. If no source material
exists, say so and stop rather than writing notes from model knowledge.

`content/demo-probe/` is a disposable fixture demonstrating notes→question linkage; it is the
only bank here with working `sourceSection`. Read it, then delete it.

## 5. Work queue

Work down in order. Each item states its own done-condition.

### W1 ✅ Generate the application from `SPEC.md`
Vite + React + TS + Tailwind, hash routing, static build. `/drill/:domainId` renders
all questions in authored order with commit-before-reveal (§2.4.1–§2.4.3 + §2.4.5).
The full five-type renderer is in `src/components/QuestionCard.tsx`; only
`mcq-single`, `multi-select`, and `code-completion` exist in the current bank
data, but the `true-false` and `scenario` branches are present and will exercise
when a question of those types is reached.

**Folding decision (worth flagging):** W1's "Done when" was written for the W1 boundary
under the assumption that drill's commit-before-reveal mechanic would be added in W5b.
That mechanic is the single most important drill behaviour (the §2.4.1 paragraph calls
it out explicitly), and shipping drill without it would have meant W5b was a rewrite of
the reveal flow rather than an extension. So W1 includes §2.4.1–§2.4.3 + §2.4.5 from the
spec. **W5b is now scoped to the Leitner scheduler (§2.4.4) only.**

**Done when:** `/drill/section-a` renders all 15 questions with reveal-in-place and
per-option rationale, on a phone-width viewport. ✅ Verified: dev server smoke-tested,
all asset paths 200, bundle 117.5 KB gzipped including the bank.

### W2 ✅ Exam mode paper construction (`SPEC.md` §2.5.2, §4.3)
Seeded PRNG, largest-remainder quotas, difficulty-balanced sampling, interleave, option
shuffle with `optionOrder` mapping.
**Done when:** acceptance criteria §8.8 and §8.9 pass — identical paper from an identical
seed, and per-domain counts within ±1 of quota across 1,000 seeds. The "interleave
single corrective pass" defect (`A,A,A,A,A,B`) was caught and fixed in this pass.

### W3 ✅ Exam runtime — timer, autosave, fullscreen handling
Timer (`deadlineAt + pausedMs - Date.now()`, recompute on `visibilitychange`),
autosave to localStorage, restore-on-reload against the original deadline, fullscreen
exit → pause + blur + modal + log. Acceptance §8.11–§8.14 covered by unit tests.
Absolute-deadline timer, `localStorage` autosave, restore-on-reload, fullscreen exit →
pause + blur + modal + log.
**Done when:** acceptance criteria §8.11 through §8.14 pass.

### W4 ✅ Tier-0 integrity + full report (`SPEC.md` §2.7, §4.2)
Severity band per §4.3 (low 1 / medium 3 / high 8; 0 / 1–9 / ≥10), the full report
screen (score, per-domain breakdown vs weight, weak subtopics by likelihood, pacing,
full review in the shuffled option order, integrity band with the D6 disclaimer, seed,
retake, JSON export, print stylesheet), 20-attempt ring buffer and SeenIndex persisted
under separate keys, `Attempt.bankHash` captured at createAttempt (SPEC §4.2 amendment
in its own commit). §3.2 storage degradation has a DOM notice, not just a console.warn;
a private-mode student sees "progress will not persist" in the report. §8.18 is enforced
on both the rendered HTML and the JSON export.
**Done when:** §8.18 passes, a report renders for a completed attempt, and a
stale-attempt / new-build mismatch surfaces in the DOM (not silently).
**SPEC amendment** in `8af6a53` (its own commit, per TINS): `bankHash` is now
`sha256(questions.json + "\n" + blueprint.json)`; `Attempt.bankHash` is captured at
construction; §8.21 widened to "any question or any domain weight"; §8.21b added:
"same (seed, length, bankHash) ⇒ byte-identical paper". The runtime and
`scripts/emit-meta.mjs` re-implement the formula (runtime is sync + browser; script is
zero-dep Node); a cross-check test (`src/lib/bankHash.test.ts`) locks the two
implementations together.

### W5 ✅ Study mode (`SPEC.md` §2.3)
`/study/:domainId` lazy-loads one notes file per domain (Vite emits a
per-file chunk; the 213 KB across the three sections is NOT in the
initial bundle), parses it with the `parseNotes` helper in
`src/lib/notes.ts`, and renders the sticky in-page ToC + MVK/Trap
callouts + Markdown body + checkpoint section. A `## Sources`
section with no callouts renders its body unchanged (D2 — never
infer metadata; the author wrote a Sources section, it gets one).
A section with two MVK/Trap pairs (the long section-c
"local-first alternative" with three `###` sub-sections, two of
which carry their own pair) renders both pairs in body order.
Markdown safety is delegated to the shared `Markdown` component
(rehype-sanitize + the `urlAllowed` allowlist), so
`[click](javascript:…)`, `data:` URLs, and raw `<img onerror=…>`
cannot survive as executable. **Verified** by `Study.test.tsx`'s
Markdown-safety block.

**What I measured (not guessed) before writing the parser.**
The bank has 48 `## ` sections across the three files: 44 with
exactly 1 MVK + 1 Trap, 3 `## Sources` with 0 + 0, and 1 long
section with 2 + 2. The naive "nearest preceding `## `" rule
produces that exact distribution. I tried a heuristic
(re-attribute callouts that sit before a `---` horizontal rule)
to fix an apparent "orphan" — turns out the apparent orphan was
just two `###` sub-sections in one long section, each with their
own callouts. The heuristic was the keyword-inference pattern
in different clothes (D2). Reverted. The notes test asserts
the per-section shape, not the file total, so a future
re-attribution heuristic that keeps the totals constant would
still fail.

**Bundle delta.** Initial `index-*.js` went 426.72 KB →
433.47 KB (+6.75 KB) / 128.03 → 129.80 KB gzipped (+1.77 KB)
— just the Study route code. The three notes chunks
(65.94 / 69.56 / 78.31 KB) are separate and load on first
visit to each domain, not at app boot.

**Checkpoint empty state.** The bank has zero
`usage: "checkpoint"` questions. `StudyCheckpointSection`
renders the `data-testid="checkpoint-empty"` notice — visible,
not hidden — per SPEC §3.3. The quiz renderer is W5b.

**Official-guide fallback.** `domain.officialGuideUrl` is
`null` on all three domains (AI-102 retired 2026-06-30, no live
skills-outline URL recorded). The `data-testid="no-official-guide"`
notice is therefore the common case here, not an edge case.

**Test count.** 16 notes tests (parser) + 22 Study tests
(rendering, ToC, callouts, fallback, empty state, Markdown
safety, loading state). Total 147, all green.
**Done when:** §8 passes (it does — `/study/section-a` renders
notes with both callout styles distinct from body text on a
phone-width viewport; checkpoint empty state is visible, not
hidden; notes are lazy-loaded; Markdown safety is asserted).

### W5b ✅ Drill: spaced repetition / Leitner scheduler + the rest of §2.4.5 (`SPEC.md` §2.4.4 + §2.4.5)
The scheduler lives in `src/lib/leitner.ts` as pure functions
(`applyOutcome`, `isDue`, `contentHashFor`, `reconcileOnLoad`,
`dueSubset`, `BOX_INTERVALS_DAYS`). No DOM, no bank, no
storage. The route (`src/routes/Drill.tsx`) calls these on
every commit and on question load.

**Scheduler (§2.4.4 + §2.4.3):** promote on correct + self-mark
"I had it"; hold on self-mark "partly"; demote to box 1
otherwise (wrong answer, "I had it wrong", no self-mark,
"I don't know"). The lucky-guess case (correct + self-mark
"I had it wrong") demotes. The contentHash formula is
sha256(stem + options + correct + type), first 12 hex chars,
matching `scripts/release.mjs`; a drift test re-runs the
script in a subprocess and asserts the two agree.

**Filters (§2.4.5) — order of utility, as built:**

| Filter | Status | Where |
|---|---|---|
| **got wrong last time** (the revision loop) | ✓ | `drillFilters.ts:matchesGotWrongLastTime` |
| **unanswered** | ✓ | `drillFilters.ts:matchesUnanswered` |
| **likelihood** (★..★★★★★) | ✓ | `drillFilters.ts:matchesLikelihood` |
| **difficulty** | ✓ | `drillFilters.ts:matchesDifficulty` |
| **tag** | ✓ | `drillFilters.ts:matchesTag` |
| **type** | ✓ | `drillFilters.ts:matchesType` |
| **due today** | ✓ (already in W5b) | `drill.tsx` |

**Filter-state persistence (§2.4.5 SPEC addition):** the
filter set persists per bank in `localStorage` at
`exam-forge.drill-filters.<bankId>`, separate from the
per-question drill state. A student who sets ★★★★★ + got-
wrong on the Domain 1 page and navigates to a question does
not have to re-set the filter on return. The cleared/empty
filter is the default on first load; the defaults are not
written back to localStorage until the student touches a
filter. `loadDrillFilters` validates the loaded shape:
out-of-range `likelihoodMin` is clamped to null, unknown
difficulty / type values are dropped. The round-trip test
in `persistence.test.ts` pins the per-bank isolation.

**Empty-state-with-hint (§3.3):** filters compose with AND;
a deliberately over-constrained combination can match zero
questions ("★★★★★ + hard + due today" on a 50-question
bank). The empty state names which filters to loosen, with
one "Remove this filter" button per active chip. The
empty-state source is `activeFilterChips(filters)` in
`drillFilters.ts` — same array the chip bar consumes, so
the two never drift.

**"Reveal all" (SPEC §2.4.5 review affordance):** a toggle
in the header activates a Review panel listing every
committed question with its chosen answer, correctness,
per-option rationales, and self-mark. Uncommitted questions
are NOT in the panel; they remain behind the §2.4.1 commit
gate, exactly as before. The static-render test
`review mode lists committed questions in the review
panel and leaves uncommitted behind the gate` is the
§2.4.1 guarantee: it renders the route with reviewMode=true,
a mix of committed and uncommitted questions, and asserts
that the commit-gate elements (the textarea, the
"I don't know" button) are present in BOTH the
reviewMode=true and reviewMode=false renderings of an
uncommitted current question. The test fails if a future
refactor accidentally bypasses §2.4.1.

**The explanation box is never graded, never read back, never
stored as an artifact (§2.4.2).** Two anti-gaming rules
(distinct-word count + paste check) live in
`src/lib/explanation.ts`, with 25 tests in
`explanation.test.ts`. The "the the the the the the the
the the the the the" attack is explicitly tested and
rejected; a 12-unique-words attack is accepted (the gate
is for count, not content — §2.4.2 doesn't grade meaning).

**BankHash refinement (`scripts/bankHash.mjs`, SPEC §2.10):**
the formula now reads notes files by domain, not by
directory glob. The hash inputs are exactly one file per
declared domain, in `domain.order`. A file in `notes/`
that is not a domain's `notesFile` is, by construction,
not part of the published content — so a developer edit
to `notes/README.md` no longer moves the bankHash and
falsely surfaces a "revised" status in the catalog. A
domain that declares a missing `notesFile` throws at
build time ("loud failure, not silent skip"): a bank that
declared four domains and shipped three notes files
would silently hash three inputs where four were
expected, defeating the catalog's "last updated"
contract. One-time hash move: `c3beca56…` →
`07a76d30a94e…`.

**The promote/hold/demote rule (§2.4.4 + §2.4.3):** promote on
correct + self-mark "I had it"; hold on self-mark "partly";
demote to box 1 otherwise (wrong answer, "I had it wrong",
no self-mark, "I don't know"). The lucky-guess case (correct
answer, self-mark "I had it wrong") demotes — the self-mark
wins over the answer, per §2.4.3.

**The contentHash reset (§2.4.4):** runtime formula is
sha256(stem + options + correct + type), first 12 hex chars,
matching `scripts/release.mjs` exactly. A drift test in
`src/lib/leitner.test.ts` re-runs the script in a subprocess
on a fixture (`src/lib/leitner.fixture.json`) and asserts the
two implementations agree — if they ever drift, the live site
won't reset the schedule when the build script thinks it
should. Tags, difficulty, subtopic, and provenance are NOT
in the hash; they may drift freely.

**The "Due today" filter is a filter, never a cage (§8.7f).**
The toggle is OFF by default; the student can always reach
every question. When ON, the visible list is the subset of
questions whose schedule says they are due, in authored
order. A never-seen question is implicitly due (box 1, due
today).

**The real bank has pool ≈ quota — the feature is wired, the
test surface is synthetic.** section-a has 15 questions /
default quota 13; section-c has 20 / 20. Spaced repetition
schedules by question, not by draw; a domain where every
question is always drawn has nothing to schedule. The
synthetic tests in `src/lib/leitner.test.ts` exercise the
promote/hold/demote transitions, the contentHash reset, and
the dueSubset filter against a synthetic question. The route
tests (`src/routes/Drill.test.tsx`) pin the UI: the toggle
is visible, the count is correct, the OFF state is the
default. A future bank with surplus pool will exercise the
end-to-end flow on real data.

**The explanation box is never graded, never read back, never
stored as an artifact (§2.4.2).** It exists because writing
the explanation is what forces retrieval; the text itself is
not an artifact. Do not build storage, review, or scoring for
it. The scheduler reads only (correct, selfMark), not the
explanation text.

**Test count:** 31 leitner + 25 explanation + 31 drillFilters
+ 8 persistence + 17 DrillView = +112. The bankHash
contribution is recorded separately: 14 → 22 across the
refinement and this review pass (+1 zulu/alpha fixture).
Total after the W5b review pass: 268 tests.
**Bundle:** 436.42 → 445.92 KB (+9.51 KB) / 130.73 → 132.83
KB gzipped (+2.10 KB). The drei notes chunks unchanged.
**Done when:** §8.7a–§8.7g all pass; the empty-state-with-
hint test pins the §3.3 contract; the Reveal-all test pins
the §2.4.1 "Reveal all cannot bypass commit" guarantee.

### W7b ✅ Single-file offline build target (`SPEC.md` §4.1)
`npm run build:single` → one self-contained HTML file at
`dist-single/<bankId>.html` that runs from `file://` with
no network. The current build is **675.56 KB / 207.77 KB
gzipped** (0.64 MB) — well under the 5 MB warn threshold.
`vite-plugin-singlefile@2.3.3` inlines every asset (CSS,
JS, the bank itself). `vite.config.single.ts` is a sibling
of `vite.config.ts` with `base: './'` (relative paths for
`file://`), the same `@bank` alias, the same `__BANK_HASH__`
define, plus a new `__SINGLE_FILE__` define. `src/lib/buildTarget.ts`
exposes `isSingleFileBuild` so the runtime can label the
camera tier as "unavailable in this build" rather than
"tier 0 was chosen" — SPEC §8.20c. The integrity band in
`ExamReport.tsx` carries the new `data-testid="integrity-tier-offline"`
note.

**Size budget (SPEC §4.1, §8.20b):** `scripts/check-single-size.mjs`
warns at 5 MB, fails at 10 MB, exits 2 when the file is
missing. The script is invoked from `npm run build:single`
and as a vitest subprocess test (`scripts/check-single-size.test.mjs`,
5 tests covering OK / WARN / FAIL / missing / real-bank).
A 50-question bank is comfortably inside. A 500-question
bank with images may not be, and finds out at build time
rather than on a student's phone.

**Self-contained (SPEC §8.20a):** `src/lib/singleBuildArtifact.test.ts`
reads the built artifact and asserts no external `<script
src=…>`, `<link href=…>`, `<iframe src=…>`, `<img src=https://…>`,
or `@font-face` with a remote src. The test skips cleanly
when the artifact is absent (the build hasn't run) so the
unit tests can run in isolation. CI gates `npm run build:single`
before `npm test`, so in CI the artifact is always present.

**Camera tier (SPEC §8.20c):** `src/lib/buildTarget.ts:isSingleFileBuild`
is `true` only in the single-file build (the Vite `define`
substitutes the value at build time; tests see `false`).
`ExamReport.tsx` renders an italic note under the "Tier"
line in the integrity summary when this is true, with
`data-testid="integrity-tier-offline"`. The wording names
the constraint the student actually hits: tier 1's model
loads from a CDN, which is not inlined. ExamReport.test.tsx
exercises the branch via `vi.doMock` + dynamic import.

**Test count:** 268 → 281 (+13: 1 buildTarget, 1 ExamReport
offline branch, 5 size budget, 5 self-contained artifact, 1
inline `singleBuildArtifact` exists check). The size-budget
test is run by the test runner, not by the build — the build
calls the same script and re-exits the same code, so a
regression in either path is caught.

**Bundle:** the single-file artifact is 675.56 KB / 207.77
KB gzipped. Web build unchanged at 446.10 KB / 132.89 KB.
The bankHash is the same constant — both targets read
`__BANK_HASH__` from Vite's `define`. A bank that ships
into both targets hashes the same way; the §2.10 contract
holds.

**Done when:** §8.20a (self-contained, no network), §8.20b
(size budget), §8.20c (camera tier reported) all pass.

### W6 ⏳ Catalog site — deprioritised
There is one bank. A catalog of one renders an almost-empty
page. W6 stays in the queue but is not next; if/when a
second bank ships, W6 jumps back to the top.
Static, client-side search/filter/sort over `catalog.json`. The record shape and the four
filter fields are specified in `SPEC.md` §2.10; the publishing runbook is `docs/PUBLISHING.md`.
Filters: `tags` (multi-select, AND), `paperType`, `languages`, `vendor`, `examStatus`,
`questionCount` range. Sort by `contentUpdatedAt` — **not** `builtAt`, which moves on every
rebuild. Show `weightSource` on every card. Treat every field as untrusted text (§3.5).
**Done when:** §8.22 passes, an empty registry yields `[]`, and each of the four filters
returns the right subset against a two-bank registry.

### W7 ⏳ Exporters (`scripts/export.mjs`)
`gforms`, `gamification-csv`, `mcq-mastery`. Pure functions of the canonical JSON. All three
target shapes are written out in full in `SPEC.md` §2.9 — you do **not** need the legacy repos.
**Done when:** all three formats emit, each prints an exported/skipped summary, and the
`gamification-csv` header matches byte-for-byte including the misspelled `explaination`.

### W8 ⏳ Tier-1 camera module
Lazy CDN load, face presence / count / head pose, self-disabling.
**Done when:** §8.16 and §8.17 pass — denial and weak devices both leave the exam
completely unaffected.

### W9 ⏳ Result submission (SPEC §2.11) — optional, only if you want results in a sheet
Apps Script Web App endpoint, pre-flight fields from `blueprint.submission`, deliberate
post-report submit, `text/plain` transport to dodge the CORS preflight.
**Done when:** a submitted attempt appends one row; a failed POST leaves the local report
intact and offers the JSON download; nothing from the camera tier is transmitted.
Design and alternatives: `docs/SCALING-AND-INTEGRATIONS.md`.

### Deferred (not queued)
Tier-2 browser extension implementation; class analytics; OCR ingestion; any backend.

## 5b. Audit findings — 2026-08-02

Four specialist reviews (security, spec/algorithms, scripts, docs/facts) were run against
this repo. Fixed in that pass:

| Was | Now |
|---|---|
| `scan-secrets` suppressed a whole LINE when any benign word appeared on it — a live key next to the word "example.com" was silently dropped | suppression is scoped to a window around the match; added SAS, DB-URL-with-password, Slack/Discord webhook, private-key-block, Slack-token patterns and `.pem/.p12/.crt/.key` scanning |
| `scan-secrets --dir` with no value scanned nothing and reported "clean" | `FATAL`, exit 2; a non-existent `--dir` also refuses |
| `convert-qb50` silently overwrote `questions.json` on every `npm run pipeline`, destroying hand edits | refuses unless `--force`; `convert` removed from `pipeline` (it is a migration tool, not a build step) |
| `true-false` omitted from the answer-count rule — a question could mark BOTH True and False correct | included, plus a check that the options actually say True/False |
| notes checks matched `## Sources` / MVK / Trap **inside fenced code blocks** | fences stripped before every structural check |
| `testLengthOptions: []` or `[0]` made every quota non-positive, disabling pool checks entirely | rejected; `defaultTestLength` must also be one of the options |
| duplicate entries in `correct`; `optionRationale` keyed to a non-existent option; `options` not an array | all now errors |
| a zero-width space defeated duplicate-stem detection | NFKC + strip `\p{Cf}` before comparing |
| `--bank --strict path` silently set the bank to `"--strict"`; `--bank` with no value threw a raw TypeError | arg parser tracks consumed tokens; clean `FATAL` |
| converter truncated multi-paragraph rationale at the first blank line, silently | fixed; also warns on gaps/duplicates in source question numbering |
| self-test's difficulty fixture passed even with the rule deleted | split into two fixtures that isolate each rule; the suite grew accordingly |
| SPEC's interleave "single corrective pass" is provably insufficient (`A,A,A,A,A,B`) with no fallback | feasibility inequality checked at build time; repair loop bounded; `interleaveDegraded` recorded |
| difficulty-bucket ties and `sort by (seen, prng())` were unspecified — same seed, different papers | tie-break order fixed; generate-key-then-sort spelled out (a random comparator is engine-dependent) |
| `seenInPreviousAttempts` was load-bearing but unmodelled | `SeenIndex` added, persisted independently of the 20-attempt ring buffer |
| `bankHash` was unspecified — questions only, no blueprint weights, runtime had no way to recompute it | SPEC §2.10 / §4.2 / §8.21 amended; `bankHash = sha256(questions + "\n" + blueprint)`; one source of truth in `src/lib/bankHash.ts`, mirrored by `scripts/bankHash.mjs`, cross-check test in `src/lib/bankHash.test.ts`; `Attempt.bankHash` captured at createAttempt |
| Markdown rendering escaped HTML but allowed `javascript:` URLs | `href`/`src` allowlist required; catalog fields declared untrusted |

**Known and accepted, not fixed:** the answer key ships in the client bundle (unavoidable
for a static site — D8); attempt state in `localStorage` is user-editable. Both are why D6
forbids the report from accusing anyone, and why this must never gate a real credential.

**Still open:** no `blueprint.json` schema (weights/`order` are contractual but informal);
tier-1 CDN model needs an SRI pin and a CSP before W8; `bankHash` does not state what bytes
it hashes.

## 6. Gotchas

1. **GitHub Pages base path.** `vite.config.ts` needs `base: '/<repo>/'` or every asset
   404s. Hash routing is mandatory for deep links. Add `.nojekyll`.
2. **Fullscreen must be requested inside a click handler.** A deferred or async call is
   silently rejected by every browser.
3. **`document.fullscreenEnabled` is false on iPhone Safari.** Do not branch on user-agent;
   branch on the capability, and record it in the attempt.
4. **Never decrement a timer variable.** Store `deadlineAt` and subtract from
   `Date.now()`, recomputing on `visibilitychange`. Otherwise a backgrounded tab gifts time.
5. **The converter is fence-aware for a reason.** Option markers inside fenced code blocks
   must stay ignored — that is what prevents the phantom-option bug documented in
   `docs/AUDIT-set5.md` §3.
6. **Question ids are `sha1(stem)[0:8]`.** Editing a stem changes its id and orphans that
   question's saved history. Acceptable, but do not treat ids as human-stable.
7. **The bank is imported as a module, not fetched.** Keep it that way; a `fetch` breaks
   `file://` use and adds a network dependency to an offline-first product.
8. **`scripts/` must stay dependency-free.** The app may add dependencies; the pipeline
   may not.
9. **`blueprint.json` is authored, not generated.** The converter writes it only when absent
   and never overwrites it (`--forceBlueprint` overrides). Re-running the converter will not
   silently revert the domain weights.
10. **Source material rots.** The course folder's own skill (`sem5_azure_cloud/skill-template/`
    §8) names currency drift as its #1 failure mode, and the content already exhibits it — see
    `docs/SOURCE-MATERIAL.md` §4. Re-verify any dated claim before shipping it to students.
11. **react-markdown v9 renamed `transformLinkUri` → `urlTransform`.** v9 is the only
    version under active support. v8 used the old name; if you downgrade, the
    `Markdown.tsx` `urlTransform` prop becomes a no-op and the URL allowlist silently
    stops enforcing.
12. **`base: '/ai102-day1-3/'` is the resolved GitHub Pages sub-path.** Set 2026-08-02
    per OPEN-QUESTIONS §6. If the site is republished to a different path (root user
    pages, custom domain), `vite.config.ts` is the only file that changes; every
    asset URL is computed from `base`.
13. **react-router-dom is pinned to 7.18.2 + an override for the inner `react-router`
    package.** CVE-2026-22030 (CSRF on document POST) affects 7.0.0–7.11.0 and was
    patched in 7.12.0. CVE-2026-33245 (RSC CSRF bypass) was patched in 7.13.2.
    7.18.2 sits above both fixes. The `npm audit` warning that may still appear is
    for an RSC CSRF in 7.12+; that does not apply (static SPA, HashRouter, no RSC,
    no SSR, no Actions). The `_security` block in `package.json` is the trail.
    **Do not downgrade below 7.18.2 without re-auditing current advisories.**
14. **SPEC §4.2 DrillState is keyed by `${bankId}:${questionId}`, not just
    `questionId`.** Two banks in the same localStorage would otherwise collide. The
    TINS update is in `SPEC.md` §4.2; the runtime key is built by
    `src/lib/persistence.ts:drillKey`. The comment in `src/lib/types.ts` `DrillState`
    type points to the same.
15. **Dark/light toggle (SPEC §5) is deferred.** W1 ships dark-only with
    `darkMode: 'media'` in Tailwind — a light-mode OS still gets dark. This is a
    **deliberate deferral, not a spec re-interpretation**: §5's "Dark by default,
    light toggle, respecting prefers-color-scheme" splits into two features
    (default-respecting + user-toggle). Default is done; toggle is not. Recording
    here so the next session knows it's tracked, not forgotten. When a W picks it
    up: a header control, persistence in localStorage under `exam-forge.theme`,
    and a small `prefers-color-scheme` listener.
16. **Static-render vs runtime test coverage.** `src/routes/ExamReport.test.tsx`
    uses `react-dom/server`'s `renderToString`, which paints but never fires
    `useEffect` or `onClick`. The 11 tests in that file prove **what the user
    sees** — score, breakdown, weak subtopics, pacing, full review in optionOrder,
    integrity band + D6 disclaimer inside `data-testid="integrity-disclaimer"`,
    storage notice when degraded, bankHash on the header, bankHash-mismatch
    warning. They do **not** prove the `exitFullscreenBestEffort` mount call, the
    Export-JSON click, or the Print click. Runtime coverage for those lives in
    `scripts/probe-w*.mjs` (W3) and the unit tests in `src/lib/{fullscreen,
    storage}.ts`. A real Playwright suite for the report is on the W-after-W9
    list — `vitest.config.ts` keeps `npm test` exit-0 clean by suppressing the
    useLayoutEffect warning that MemoryRouter emits under SSR.
17. **`.gitattributes` is build-app only — flag for the merge.** The
    line-ending fix (W4 follow-up) landed on `build-app` in commit
    `9e060dc` and `4d89474`. The main worktree and any other clone that
    hasn't pulled these commits is still CRLF on Windows and will keep
    emitting a different bankHash until the user re-checks-out the
    files. Whoever merges build-app → main needs to (1) pull the
    `.gitattributes` commits, (2) re-checkout the working tree on
    any CRLF worktree (`git checkout HEAD -- .` after the merge,
    or `git add --renormalize . && git commit -m "renormalize LF"`
    if files show up as changed), (3) verify a fresh `git clone`
    produces `dist/meta.json: bankHash = sha256:043bd0f8…` with
    default `core.autocrlf=true`. The verification was done in
    `C:\Users\user\AppData\Local\Temp\exam-forge-fresh-clone` —
    clean. Don't skip the re-checkout; the index was already LF
    on build-app because of the local config dance, but a clean
    clone of the merged main will need its files re-checked-out
    to flip CRLF→LF.
18. **`core.autocrlf` local override dance — flagged in HANDOVER for
    reproduction.** During session 6c I ran `git config core.autocrlf
    false` locally to force a re-checkout of files that were
    incorrectly LF in the index but CRLF in the working tree. After
    verifying the fix works on a true fresh clone (with
    `core.autocrlf=true`, the system default), I unset the local
    override so the working tree is back to inheriting the system
    default. **Do not** leave `core.autocrlf=false` in a local
    override as part of the build — the fix depends on
    `.gitattributes` and the `normalise()` step in `bankHashFor`,
    not on a per-developer config. The `normalise()` step is the
    defence-in-depth in case `.gitattributes` is ever bypassed (a
    file added by a future contributor without updating the
    attribute list).
19. **Process: `git add --renormalize`, not `git rm --cached -r .`.**
    When `.gitattributes` was added, the intended path is:
    `git add .gitattributes && git commit -m "...gitattributes..."`
    followed by `git add --renormalize . && git commit -m
    "renormalise text files to LF"`. I used `git rm --cached -r .`
    instead because the local `core.autocrlf` was still `true` and
    `git add --renormalize` was reporting "nothing to renormalise"
    on files it had already re-checked-out as CRLF. The destructive
    path worked but it's the wrong path — if the second `git add`
    had failed, recovery would have been confusing. The
    `git add --renormalize` path fails safe and is the one to use
    next time.
20. **Assert callout counts per section, not per file.** A file-total
    assertion (e.g. "section-a has 17 MVK and 17 Trap") passes for
    the wrong reasons — a parser that re-attributes callouts
    between sections keeps the file total constant. The right
    assertion is the per-section shape: 44 sections with 1/1,
    3 `## Sources` sections with 0/0, 1 long section with 2/2.
    The per-section test would have caught a re-attribution
    heuristic that the file-total test passed.
21. **Notes parser is a nearest-preceding-`## ` split, nothing
    more.** A long section with three `###` sub-sections, two of
    which carry their own MVK/Trap pair, is one section with
    2 MVK + 2 Trap callouts, not two sections and a stray orphan.
    D2 forbids inferring metadata from prose position — the
    `---` heuristic looked like an orphan, but it was just the
    author's section-break marker between two related sub-parts.
    `src/lib/notes.ts` is intentionally simple: split on
    `^## `, extract callouts in body order, render all of them.
    The data model is `callouts: NoteCallout[]` (0..N per
    section) for exactly this reason.
22. **`bankHash` now covers `notes/*.md` (post-W5 review).** When
    W5 shipped study mode, notes went from "unpublished source
    material" to "published content". A bank whose notes change
    but whose `questions.json` and `blueprint.json` don't would
    previously hash the same and surface in the catalog as
    "unrevised" while serving different study material. That's a
    broken contract on §2.10's own promise. The fix: every
    `notes/*.md` in **sorted filename order** is now a hash
    input, with the same `normalise()` (LF/CRLF → LF) as
    questions + blueprint. One function, one formula, two
    callers (vite.config.ts and emit-meta.mjs). A bank with no
    `notes/` dir still hashes — it's an empty list of additional
    inputs, not an error. A bank that *adds* notes will see a
    one-time hash change as the notes enter the formula, which
    is correct (the content really did change). The
    `contentUpdatedAt` mechanism in `emit-meta.mjs` already
    only moves when the hash moves, so the catalog now surfaces
    note edits automatically — no separate signal needed.
23. **The single-file build is its own config file.**
    `vite.config.single.ts` is a sibling of `vite.config.ts`,
    not a plugin. Differences from the web target: `base:
    './'` (relative paths for `file://`), `vite-plugin-singlefile`
    inlines every asset, `__SINGLE_FILE__` is set to `true`.
    The bankHash and the `@bank` alias are shared. The
    `dist/` (web) and `dist-single/` (offline) outputs are
    independent — one is not overwritten by the other. The
    file is renamed to `<bankId>.html` by a tiny inline plugin
    (`closeBundle` hook) so the receiving phone has a
    predictable filename. **Do not** add new dependencies
    that the single-file build would have to inline —
    a 50 KB library added today is 50 KB added to every
    student's offline file.
24. **`__SINGLE_FILE__` is a build-time token, not a runtime
    flag.** Vite's `define` substitutes the value at build
    time; the test env sees the token as undefined, so
    `src/lib/buildTarget.ts` guards with `typeof !== 'undefined'`
    and falls back to `false`. The web config explicitly
    defines `__SINGLE_FILE__: false` so the type checker
    is happy and the runtime is unambiguous. A test that
    wants the offline branch uses `vi.doMock` + dynamic
    import (`src/routes/ExamReport.test.tsx`) — the `vi.mock`
    at the top of the file returns the default `false` for
    the rest of the suite.

## 7. Protocol — before you stop

1. Update §3 (state snapshot) with real command output, not a description of it.
2. Update the queue position at the top and mark completed items ✅ with what changed.
3. Add any new gotcha to §6. A finding you do not write down is one the next session
   pays for again.
4. If you changed behaviour, **edit `SPEC.md` first** and note the section. Spec drift is
   the one failure this methodology cannot absorb.
5. If you added a validator rule, add a matching case to `scripts/selftest.mjs`.
6. Run `npm run pipeline` and paste the output into §3.
7. **Before writing an assertion, describe the broken implementation that would still
   pass it.** If you can name one, the assertion is wrong. Three for three on the
   W5/W5b review:
   - notes parser — a file-total assertion (17 MVK, 17 Trap) passed even with a
     re-attribution heuristic that moved callouts between sections while keeping the
     file total constant. Fix: assert the per-section shape, not the file total.
   - `perDomainBreakdown` (drill) — a fixture bank where the right formula and the
     wrong formula happened to coincide. Fix: pick inputs where correct and incorrect
     behaviour actually diverge.
   - "Reveal all" (drill) — a presence-of-gate assertion passed for a broken
     implementation that rendered the gate AND dumped the rationale below it.
     Plausible, not contrived. Fix: assert on a distinctive string that the rationale
     contributes, expect zero matches, and do it for the current question (not just
     the review panel).
   The fix is the same every time: pick inputs where the correct and incorrect
   behaviour actually diverge, then assert on the difference. If the inputs you
   have don't make them diverge, the test is unverified on the only bank you have.
