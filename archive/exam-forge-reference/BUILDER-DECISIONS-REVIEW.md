# Decisions Review — W7b and recent work

> **Date:** 2026-08-03
> **Author:** session 9 (post-W7b, pre-W6)
> **Scope:** decisions in the W5b, W5b review, W7b, and W7b follow-up work, plus inherited decisions from W1–W5 where I would have done them differently.
> **Purpose:** not a defence of the choices. A "what I'd think harder about next time" list, with the alternatives I should have considered. The user is reviewing my judgement; I'm reviewing my own. The decisions are ranked by how much they could bite us, not by how interesting the alternatives are.

A note on scope: this review is honest about my own uncertainty, not a flagellation. Some of the items below are durable gaps that need a fix; some are placeholder values that need data; some are inherited choices I'd defend if asked. The "What to do" list at the end is what the next session should act on.

---

## Part 1 — The top concerns

### 1. The Leitner interval curve — `1, 1, 3, 7, 16` days

**What I picked.** `BOX_INTERVALS_DAYS = {1: 0, 2: 1, 3: 3, 4: 7, 5: 16}` in `src/lib/leitner.ts:40-46`. Box 5 stays at 16 days forever (no further promotion, no graduation).

**Why I picked it.** Felt like a reasonable spaced-repetition curve. Box 2 at 1 day, then 3, 7, 16. Common in flashcard literature.

**What I should have considered.**

- **SuperMemo SM-2** has six levels with intervals like 1, 6, then `interval × ease_factor` (starting at 2.5). SM-2 is the empirical baseline, with ~30 years of data. My curve has no ease factor — it doesn't adjust to whether you're consistently right or consistently struggling.
- **Anki's default curve** is roughly 1, 10, then doubling. A "graduated" card comes back every 4× its current interval, capped around 100 days. Mine is much shorter.
- **Pimsleur's graduated interval recall** uses 5 seconds, 25 seconds, 2 minutes, 10 minutes, 1 hour, 5 hours, 1 day, 5 days, 25 days, 4 months, 2 years. That's for *vocabulary*, not exam questions, but it's the only research-backed curve I have a name for.

**Why I am not confident.** I made these numbers up. There is no evidence behind them. They feel "obviously reasonable" because they grow roughly exponentially, but "feels right" is not a number. The "feels right" trap is exactly the §7 protocol failure mode in reverse — I designed something I couldn't *break* with a deliberately bad input. If 16 days is too short, students forget. If 16 days is too long, the review loop never closes. I don't know which it is.

**What to do.** The right next step is to log every commit (timestamp + box transition) for the first 50 real students, then plot "days between commit and next answer" against "did the student get it right." That tells you the actual forgetting curve for *this* content, which is the only curve that matters. Until that data exists, the constants are placeholders and the comment in `leitner.ts` should say so.

---

### 2. The integrity band thresholds — `0 / 1–9 / ≥10`

**What I picked.** `SEVERITY_WEIGHTS = {low: 1, medium: 3, high: 8}` and `INTEGRITY_BANDS = [{min: 10, label: 'Significant'}, {min: 1, label: 'Minor'}, {min: 0, label: 'No anomalies'}]` in `src/lib/scoring.ts:18-42`.

**Why I picked it.** A 1–9 "Minor" band means a single tab-hidden event (severity low, weight 1) is "Minor." That felt right. A 10+ "Significant" means 1 high + 1 low + 1 low, or two mediums, or ten lows. Also felt right.

**What I should have considered.**

- **False positive rate.** A legitimate exam taker might switch tabs once (to look at the rules doc), get a phone notification (1 low event), or paste a question ID into a notes app (1 copy event). Under my thresholds, that's "Minor." Is that the right word? A student who gets a "Minor" flag in their report is going to feel accused, even with the D6 disclaimer.
- **D6 ("the report never says 'cheated'") is doing all the work.** The thresholds shape how often a "Minor" or "Significant" band actually fires, and that shapes whether the disclaimer is enough. I picked the thresholds without checking what fraction of legitimate attempts would land in each band.
- **The thresholds are subjective.** "1 phone notification = Minor" is a product call, not a mathematical fact. I have no data on what a normal exam attempt's event log looks like.

**Why I am not confident.** The thresholds are the *only* signal the report gives about integrity. If they're set wrong, the report either over-accuses (high false positive rate) or under-flags (high false negative rate). I picked a number; the number has no basis.

**What to do.** Same answer as #1: log events from real attempts, look at the distribution, and set the bands where the false-positive rate is acceptable. The 20-attempt ring buffer is already there; we just need to read from it and re-tune.

---

### 3. `MIN_WORDS = 12` for the explanation box

**What I picked.** Twelve distinct words in `src/lib/explanation.ts`. The "the the the the..." attack is rejected. Twelve unique nonsense words is accepted. `explanationAcceptable` is the gate.

**Why I picked it.** 12 feels like a sentence or two. Less than 12 feels like a token effort. More than 12 starts to be onerous.

**What I should have considered.**

- **Retrieval-practice research (Karpicke & Roediger 2008; Roediger & Karpicke 2006).** The strongest predictor of retention is *whether* the student retrieves, not *how much* they write. A 3-word retrieval beats a 100-word re-read. So the lower bound on `MIN_WORDS` could be lower than 12 — maybe 4 or 5.
- **Product reality.** The student is grading themselves. A 12-word gate prevents the "I just tapped Reveal" gaming pattern. But the gate doesn't grade meaning, so a 12-nonsense-words attack gets through, which feels wrong to a human reviewer.
- **The user's framing was "the gate is for count, not content."** I implemented exactly that. The question is whether the count threshold itself is right.

**Why I am not confident.** 12 was chosen because "12 unique words feels like writing a sentence." That's a feeling, not evidence. A better threshold would be informed by:

1. What fraction of legitimate student explanations are above 12 words (should be ~100%).
2. What fraction of "I'll just type something to skip" attempts are above 12 words (should be much lower; if it's not, 12 is too low).
3. Whether there's a more meaningful signal (e.g., 1 sentence = roughly 8-15 words, but a sentence is a structural signal, not a count).

**What to do.** When the first batch of drill sessions is in, log the explanation length distribution. If 99% of real explanations are 12+, the threshold is fine. If real explanations cluster at 8-10, drop the threshold. If gaming patterns cluster at 12-13 (i.e., just above the gate), the threshold is the *cause* of the gaming and the design is wrong.

---

### 4. The Leitner "lucky guess" demote rule

**What I picked.** `correct === true && selfMark === 'wrong'` → demote to box 1 in `src/lib/leitner.ts:77-80`. The self-mark wins over the answer.

**Why I picked it.** User's explicit guidance in the W5b review: "the self-mark wins over the answer, per §2.4.3."

**What I should have considered.**

- **The SPEC text is ambiguous.** SPEC §2.4.3 says: "The student marks themselves against the model rationale." "Marks themselves" could mean (a) the self-mark button, or (b) the option they picked (which the model says is wrong). I went with (a) because that's what was specified in the conversation.
- **If the SPEC actually meant (b)**, my implementation is wrong: I'd be demoting when the student gets it right but feels bad about it, instead of demoting when the student gets it wrong but claims they got it right.
- **The two readings have very different product behavior.** Under (a), a student who gets 10 in a row and marks every "wrong" never graduates past box 1 — punitive. Under (b), a student who always marks "had it" but always picks wrong graduates happily — the opposite problem.

**Why I am not confident.** I trust the user's reading but the SPEC is silent on the ambiguity. A SPEC amendment is needed, not just a code implementation. Right now the test only covers the (a) interpretation; a future "fix" that re-reads the SPEC as (b) would silently change behavior with no test failure.

**What to do.** SPEC amendment that pins the interpretation. Either "self-mark is the authoritative signal" or "the picked option is the authoritative signal." Right now, the code and the SPEC can disagree without either side knowing.

---

### 5. "Reveal all" review panel content

**What I picked.** The review panel shows the chosen answer, ✓/✗, per-option rationales, and self-mark. Added in commit `a6599b3` (the W5b review pass) after I noticed the implementation gap in `c058a84`.

**Why I picked it.** The user's framing in the W5b review was "re-read every rationale without pressing Reveal 24 times." I added rationales to the panel to match that framing.

**What I should have considered.**

- **The SPEC §2.4.5 wording is one sentence.** "Reveal all: A toggle that reveals all answered questions at once." No mention of rationales.
- **I implemented the user's reading, not the SPEC.** The SPEC is now silent on whether the panel should include rationales; the code is more elaborate than the SPEC.
- **The other reading** of the SPEC is: "Reveal all" makes every committed question behave as if you'd just pressed Reveal — the same per-option rationale view you'd see one at a time, but in a list. That's *exactly* what I built. So I think the implementation is right, but the SPEC should be amended to say so.

**Why I am not confident.** The implementation and the SPEC got out of sync. The `a6599b3` commit added the feature *because the test forced it*, which is the right outcome but a sign the SPEC was incomplete. A SPEC amendment is the durable fix; right now we're relying on the test to pin the behavior.

**What to do.** SPEC §2.4.5 should say "Reveal all" reveals rationales too, and the test should pin the wording. I should have done this in the W5b review pass but did the code, not the spec.

---

### 6. `vite-plugin-singlefile` for the W7b build

**What I picked.** `vite-plugin-singlefile@2.3.3` in `package.json`. It inlines every asset into one HTML file. Standard plugin, Vite 8 support, clean README.

**Why I picked it.** It worked. ~800ms build. 675 KB output. All test gates green.

**What I should have considered.**

- **`rollup-plugin-html` and `vite-plugin-html-inline`** are alternatives. I didn't compare output sizes, didn't check for known edge cases (e.g., sourcemap handling, dynamic imports, CSS extraction).
- **A custom rollup config** is also possible — Vite is just rollup underneath. A custom config would give precise control but more maintenance.
- **The plugin handles `inlineDynamicImports` by setting `codeSplitting: false` automatically.** I didn't write a test that pins this — a future Vite version that changes the contract could break the single-file build silently.

**Why I am not confident.** I picked the most popular option without comparing. The build works, but I don't have a "why not the alternatives" answer. If `vite-plugin-singlefile` becomes unmaintained, I have no fallback documented.

**What to do.** Document the alternative candidates and the reason for the pick in a comment. Lock the version (`2.3.3`, not `^2.3.3`) so a breaking change can't ship without a test catching it. Add a regression test that exercises the `inlineDynamicImports` path.

---

### 7. `mulberry32` for paper construction

**What I picked.** `mulberry32` in `src/lib/prng.ts` — 32-bit PRNG, period 2^32, ~10 lines of code. Used for paper construction, sampling, interleave, and option shuffle.

**Why I picked it.** Small, deterministic, no dependency, sufficient for 50-question papers.

**What I should have considered.**

- **`xoshiro256**`** has 256 bits of state, longer period, better statistical properties. ~15 lines of code. Used by Vite itself.
- **Statistical bias.** mulberry32 has known weaknesses in the lowest bits. I use `Math.floor(prng() * n)` for sampling, which is biased for small `n` and high `prng()` values. For 50-question papers, the bias is below 1%, but it exists.
- **Worth testing.** I don't have a test that asserts "the paper is uniformly distributed over the pool across 10,000 seeds." Such a test would catch a regression where the PRNG is swapped and the bias increases.

**Why I am not confident.** I picked the smallest PRNG that would work. For 50-question papers on 50-question banks, this is fine. For a 500-question bank with a 100-question paper, the bias could become visible (one question type over-represented by 1-2% of the draws). I don't have a test that would catch a regression.

**What to do.** Add a §8.9-style distribution test: 10,000 seeds, assert each question's draw count is within ±3% of the expected value. Currently §8.9 only checks per-domain balance, not per-question balance.

---

### 8. The Leitner "box 5 stays at 5" decision (or lack of one)

**What I picked.** Box 5 means "due in 16 days, forever" in `src/lib/leitner.ts:46`. No graduation. The schedule continues to surface the question.

**Why I picked it.** I didn't consciously pick this. I wrote `BOX_INTERVALS_DAYS[5] = 16` and moved on.

**What I should have considered.**

- **Graduation.** Box 5 could mean "graduated — never schedule again." Anki's "mature" cards behave this way. The student moves on.
- **Longer intervals.** Box 5 could mean "due in 60 days" or "due in 90 days." The review loop is real but rare.
- **Two parallel states.** A "scheduled" box (1-5) and a "graduated" state (no longer scheduled, can be reset to box 1 if the student revisits).
- **The product question.** A student preparing for an exam 30 days out is doing the work in 16-day cycles. They might *never* finish the bank. The "Due today" filter is the only escape hatch.

**Why I am not confident.** I never thought about this. The current behavior is "you review everything forever" which might be exactly right for a 50-question bank (graduation doesn't matter) but wrong for a 500-question bank (graduation is the whole point of the scheduler).

**What to do.** When the bank grows past ~200 questions, add a graduated state. For 50 questions, the current behavior is fine and the W5b "synthetic tests, real bank has pool ≈ quota" comment in `leitner.ts:6` already names the gap.

---

### 9. `explanationAcceptable` accepts 12 unique nonsense words

**What I picked.** The gate is for count, not content. A "buffalo buffalo buffalo..." attack is accepted.

**Why I picked it.** User's explicit guidance: "the gate is for count, not content — §2.4.2 doesn't grade meaning."

**What I should have considered.**

- **A "12 unique words" submission is almost certainly gaming** in practice. No human writes "apple banana cherry date elephant fig grape honeydew indigo jackal kiwi lemon" as an explanation. The acceptance is technically per SPEC but feels wrong.
- **The SPEC's stance is correct** — a content gate would require an LLM or a human grader, which is out of scope. The product is "force retrieval, not grade meaning." A student gaming their own revision is wasting their own time, not the teacher's.
- **The question is whether 12 is the right number to make gaming just-barely-possible.** If a real student writes 8 words and a gamer writes 12, the gate rewards the gamer. If the gate is 4, the gamer writes 4 and a real student feels accused for short explanations. There's no number that makes both happy.

**Why I am not confident.** The implementation is right. The product call (count-not-content) is right. The threshold (12) is the part I'm not sure about, and the answer is the same as #3: log real data and tune.

**What to do.** Same as #3. There's no fix beyond "watch the real distribution."

---

## Part 2 — Test methodology gaps

### 10. Static-render tests are not runtime tests

**What I picked.** Tests use `renderToString` from `react-dom/server`. They paint but never fire `useEffect` or `onClick`. Documented in `src/routes/ExamReport.test.tsx:1-37` and the W4 gotcha in `HANDOVER.md §6.16`.

**Why I picked it.** Vitest is fast, deterministic, and doesn't need a browser. The static-render approach catches all the *content* bugs (wrong text, missing data-testid, broken JSX) without the cost of Playwright.

**What I should have considered.**

- **`useEffect` calls don't fire.** `ExamReport` calls `exitFullscreenBestEffort` on mount. The static test can't catch a regression in that call. The W3 probes cover fullscreen, but they're not in the test loop.
- **Click handlers don't fire.** `ExamReport` has `onExport` (JSON download) and `window.print`. No test exercises either.
- **Async behaviour doesn't run.** `setState` after a promise resolves, `useEffect` cleanups, `IntersectionObserver` callbacks — none of these run under `renderToString`.
- **The `Drill` route has `useEffect` for content hash computation.** The `Drill.test.tsx` static-render test renders `DrillView` directly, *not* `Drill`, precisely because the route's `useEffect` doesn't run. That bypasses real behaviour.

**Why I am not confident.** The static tests are a great filter for content bugs but a poor filter for behavioural bugs. The W4 review found one (the "exit fullscreen on mount" was never tested) and we noted it as a "future Playwright suite" item. That suite hasn't been built.

**What to do.** Either build the Playwright suite (a W between W4 and W8), or accept the gap and document it clearly. Right now it's a known unknown that nobody owns.

---

### 11. `singleBuildArtifact.test.ts` is a static check, not a runtime check

**What I picked.** The test reads the built HTML and greps for external script/link/iframe/img/font-face refs in `src/lib/singleBuildArtifact.test.ts`.

**Why I picked it.** It catches the most common single-file build regressions (a future contributor adding a `<script src=...>` somewhere) without needing a browser.

**What I should have considered.**

- **The test can't catch runtime exceptions.** If the bundled JS throws on `file://` (e.g., a `localStorage` access that the static analysis didn't predict), the test passes but the file is broken.
- **User's point in the W7b review: "Nothing has opened the file."** True. The static check is necessary but not sufficient. The only real test is opening the file in a browser with the network off and clicking through.
- **I can't write a Playwright test for `file://` runs** without a browser binary, which is a heavier setup than the current CI.

**Why I am not confident.** The test covers the "did the build pipeline inline everything" question. It does not cover the "does the result work in a browser" question. The latter is the actual user experience.

**What to do.** Add a Playwright step to CI that opens the file with the network disabled, navigates to a question, and asserts the question renders. Slow (5-10s) but real. Or accept that the manual test (a real user opening the file) is the canonical signal and document that.

---

### 12. The bank is too small to fully exercise the tests

**What I picked.** 50 questions, 3 domains, weights 32.14% / 17.86% / 50.00%. The real bank for the project.

**Why I picked it.** It's what we have.

**What I should have considered.**

- **The W5b review found three "tests that pass on the only bank we have"** issues. The zulu/alpha fixture fixed one. The other two — file-total vs per-section callout counts and "got wrong last time" on the only bank — were caught earlier.
- **The bank is alphabetical = blueprint order** (`section-a, section-b, section-c`). This means a regression to alphabetical sort produces the same hash.
- **The bank has pool ≈ quota** for every domain. This means the scheduler has nothing to schedule (the synthetic tests cover the algorithm, but the *integration* test against a real surplus is hypothetical).
- **The bank has no `scenario` or `true-false` questions.** The renderer has the branches; the data doesn't exercise them.

**Why I am not confident.** A 50-question bank is enough to demo the app. It is not enough to validate that the test suite is sharp. The W5b review proved this empirically. The "synthetic banks" approach (zulu/alpha, larger sample sizes) is a partial fix but not a complete one.

**What to do.** Author a second bank on a different topic (which is on the queue anyway, per the W-after-W9 work). Run the full test suite against it. If tests still pass on a different bank, the test suite is sharp. If they fail, the suite is over-fit.

---

## Part 3 — Inherited decisions I would have made differently

### 13. The `bankHash` formula was iterated on twice

**What happened.**

- **W5 (commit `3ee3648`).** Formula was `sha256(questions + "\n" + blueprint + "\n" + sorted(glob('notes/*.md')))`. I thought it was done.
- **W5b refinement (commit `c058a84`).** The user pointed out the rule was unverified on the real bank (alphabetical = blueprint order). I refactored to `domain.order` instead of filename sort, added the README-exclusion rule, added the loud-failure rule for missing `notesFile`.
- **W5b completion.** BankHash changed from `c3beca56` to `07a76d30a94e` — a one-time move. The new formula is correct; the old formula was incomplete.

**Why I am not confident.** The W5 design was incomplete. I shipped it. I should have:

- Recognised that "alphabetical = blueprint" makes the rule untestable.
- Designed the rule to be testable *first* (zulu/alpha fixture as a sanity check during W5).
- Acknowledged that a hash move is cheap when nothing is deployed, and a re-architecture is cheaper than a deploy-and-recall.

**What to do.** Same as the §7 protocol: pick inputs where right and wrong diverge, *first*. I should have started with the zulu/alpha fixture in W5 and the bankHash would have been one commit, not two.

---

### 14. The W5b completion commit missed the rationales

**What happened.** `c058a84` claimed "W5b done: full §2.4.5 + Reveal all + bankHash refinement." "Reveal all" without per-option rationales is incomplete by the user's description. The `a6599b3` review-pass commit added the rationales because a test forced it.

**Why I am not confident.** "Done" should mean "matches the SPEC and your description." I shipped a commit that matched the test count (190 → 266) but didn't match the product. The review pass was correct but should not have been necessary — the original commit should have included the rationales.

**What to do.** Tighter reading of the description before claiming done. The phrase "re-read every rationale without pressing Reveal 24 times" is in the conversation, not in the SPEC; if I'd reread the description before claiming done, I would have noticed the gap.

---

### 15. The HANDOVER `§6` gotchas section reads like a fix log, not a guideline

**What I see.** `HANDOVER.md §6.17`: ".gitattributes is build-app only — flag for the merge." `§6.18`: "core.autocrlf local override dance — flagged in HANDOVER for reproduction." `§6.19`: "Process: `git add --renormalize`, not `git rm --cached -r .`." These are incident reports from W4 follow-up, not durable rules.

**Why I am not confident.** The gotcha section has two kinds of content:

- **Durable guidelines** ("the answer key ships in the bundle, so D6 forbids the report from accusing anyone").
- **Incident records** ("during session 6c I ran `git config core.autocrlf false`...").

The incident records are valuable for the specific merge-and-deploy moment, but they read as if every new contributor will hit the same problem. Most won't.

**What to do.** Two sections: `§6 Durables` (rules a new contributor needs) and `§7 Incident log` (what happened, by date, in case someone is debugging). Or simply: prune the incident reports to the lesson, not the play-by-play.

---

## Part 4 — Process concerns

### 16. The single-file build wasn't tested on the actual target device

**What I did.** Asserted statically that no external refs exist. A real user is opening it on a 2021 Android with the network off.

**Why I am not confident.** A 2021 Android is a real device with real constraints: RAM budget, slow JS engine, maybe an older Chrome. The static check doesn't catch:

- A JS that runs too long on a slow engine.
- A layout that breaks on a 6.5" screen.
- A `localStorage` quirk for `file://` (raised in the W7b review).
- A font fallback that looks broken.

**What to do.** Test on a real 2021 Android before claiming "W7b done." The static checks are necessary; they are not sufficient. If the storage notice appears, that's the answer and the fix is local.

---

### 17. I make up numbers and call them "reasonable"

**The pattern.** Throughout this list: intervals, thresholds, MIN_WORDS, box 5 behaviour, "feels right." Each is a number I picked because the alternative was "leave it blank and ship a TODO."

**Why I am not confident.** I am biased toward "ship a number" over "ship nothing." A wrong number is a bug. A blank is a debt. The user accepts the debt better than the bug in *most* cases, but a number with a comment ("this is a placeholder, see #1 for the right next step") is honest in a way that a confident-looking number isn't.

**What to do.** Mark tuning constants with a `// TODO(synthetic-data): <reason>` comment when they ship without empirical support. The constant itself is fine; the *signaling* is what's missing. `leitner.ts`, `scoring.ts`, and `explanation.ts` are the three files where this would matter.

---

## Summary — what to do

1. **Tuning constants without data** (#1, #2, #3, #8, #9, #17): add `TODO(synthetic-data)` markers. The constants are placeholders until real usage logs exist.

2. **SPEC vs code divergence** (#4, #5): amend SPEC §2.4.3 and §2.4.5 to pin the behaviour. The test pins the code; the SPEC should pin the intent.

3. **Static vs runtime tests** (#10, #11, #16): document the gap clearly. Either build the Playwright suite (W after W9) or accept the manual test as the canonical signal and stop pretending static checks are enough.

4. **Test suite over-fit** (#12): the zulu/alpha fixture is partial. A second bank on a different topic is the real test.

5. **Inherited decisions** (#13, #14, #15): the bankHash iteration and the missed-rationales are process errors, not design errors. The fix is reading the description before claiming done, and curating the gotcha section.

Nothing here is broken. Everything here is a placeholder or a known gap. The product ships; the next session has a list of where to look.
