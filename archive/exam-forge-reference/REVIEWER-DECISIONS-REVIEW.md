# Decisions Review — the reviewer's own

> **Date:** 2026-08-03
> **Author:** the reviewing session (observer role, R3-adjacent)
> **Companion to:** `DECISIONS-REVIEW.md` by the building session
> **Scope:** decisions *I* made or pushed, and decisions neither of us questioned.

The builder's review is honest and worth reading. It is also, necessarily, a review of code
decisions by the person who wrote the code — intervals, thresholds, plugin choices, test
methodology. Every item on it is real.

It has one blind spot, and it is not the builder's fault: **it never asks whether the
application should exist.** They were told to build; they built. Questioning the shape of the
work was my job, and I did not do it.

This document is the part of the review that only the reviewer can write. It is ranked by how
much each decision could have cost, not by how defensible it is.

---

## Part 1 — The three I would change

### 1. Nobody ever priced the cheap version

**What happened.** The user arrived with "a 3-part website: study, drill, exam." I redirected
to "fix the content pipeline first," which was right — the input data was measurably broken
(85% answer-A bias, 20/47 complete metadata, a converter that dropped 18 of 47 questions while
printing `Done ✅`). That redirection was the single most valuable thing I did.

Then we built this:

| | |
|---|---|
| `SPEC.md` | 1,196 lines |
| `docs/` | 2,509 lines across 13 files |
| `scripts/` | 4,498 lines across 27 files |
| `prompts/` | 674 lines |
| study notes | 2,951 lines |
| the application | React + Vite + TypeScript, 281 tests |
| **what it serves** | **50 questions, covering 3 of 8 course days, for ~30 students** |

**What I never asked.** *What is the cheapest artefact that teaches these thirty people?*

The honest answer is a single static HTML file: fifty questions, click to reveal, rationale
underneath. Perhaps 200 lines, no build step, no tests, no spec, no repository split, no
worktrees. It would have shipped in an afternoon and covered — on the evidence of what students
actually need — most of the value.

We have partial proof of this. The night the user said "I need to share questions with students
and I have a time constraint," the PDF and the Google Forms scripts were built and working in
about two hours. That path delivered a usable, gradeable assessment for thirty students. The
application, weeks in, has still not been opened by one.

**The alternatives never considered:**

- **A single HTML file.** Sufficient for drill, which is the highest-value mode.
- **Anki.** Free, cross-platform, spaced repetition solved by people with decades of data, and
  it imports CSV. `make-sets.mjs` could emit an Anki deck in ~30 lines. The entire Leitner
  scheduler — and every uncertainty in the builder's items #1 and #8 — exists because we chose
  to write one.
- **Google Forms alone.** Which is what actually got used.

**Why I didn't ask.** The user framed the project as "build this website," and I treated the
frame as fixed and optimised inside it. That is the reviewer's characteristic failure: rigorous
about correctness within the chosen shape, silent about the shape.

**What I would do now.** Before the first line of a spec, write down the cheapest thing that
would work and say out loud what the expensive version buys over it. If the answer is
"reusability across future banks," say so explicitly and accept that the first bank is
subsidising banks that may never exist. That is a legitimate choice. Making it by default is
not.

---

### 2. We paid for TINS and never used it

**The premise.** `SPEC.md` is the source. The application is generated from it. Defects are
fixed by editing the spec and regenerating, **never** by patching generated output. That rule
is in the README, in `AGENTS.md`, in `START-HERE.md`, and I enforced it in nearly every review
message I sent.

**What actually happened.** The application was generated once, at W1. Every subsequent change
— W2 through W7b, roughly a dozen work items — was a hand edit to `src/`, followed by an
amendment to `SPEC.md` to describe what had been written.

That is not TINS. That is a well-documented codebase with an unusually detailed design
document, and a ceremony where the design document is edited first.

**The costs we paid anyway:**

- Spec/code divergence became a recurring defect class. The builder's items #4 and #5 are both
  instances: the code is more specific than the spec, and the test — not the spec — is what
  pins the behaviour.
- The SPEC claimed the validator checked interleave feasibility when it did not. I caught that.
  A spec that is never executed cannot be wrong in a way anything notices.
- Every change cost two commits and a round of "spec first" discipline.

**The benefit we did not collect.** Nothing was ever regenerated. If it had been, the spec would
have been continuously tested against reality, and the divergences would have surfaced
immediately instead of during review.

**The alternative never considered.** Keep `SPEC.md` and call it a design document. Drop the
regeneration claim. Same artefact, honest label, no ceremony. Or genuinely regenerate one
module from spec at some point as a test of whether the spec is complete — which would have
been a genuinely interesting experiment and we never ran it.

**Why I didn't raise it.** TINS was the user's premise, arriving with the folder. I never
treated the premise as reviewable. Given that "verify the artefact, not the process" became a
guiding rule of this project, failing to apply it to the project's own methodology is a
straightforward inconsistency.

---

### 3. Nothing shipped to a student

The builder's report says "log real data and tune" seven times, across items #1, #2, #3, #8,
#9 and #17. Every tuning constant in the product is a guess, and every proposed fix is "watch
what real students do."

**That data does not exist, because we never put it in front of anyone.**

The drill mode has been functional for weeks. Publishing it after W1 — even rough, even with
one domain — would have produced exactly the usage logs the builder is now asking for, and
would have let student behaviour decide what got built next instead of a work queue written
before anyone had used anything.

I did eventually push for this ("pause app work, use what exists"), and the user chose it. But I
pushed for it at hour N of N, not hour 2. The right moment was immediately after W1, and the
argument was available then.

**What I would do now.** Treat "a real user has touched this" as a gate on the work queue, not a
milestone at the end of it. No W(n+1) until W(n) has been used by someone who isn't building it.

---

## Part 2 — Decisions I got wrong, and the pattern underneath

These were corrected within the conversation. I list them because the pattern matters more than
the individual errors.

### 4. I pushed raw-byte hashing over canonical JSON, and I was wrong

The builder implemented `bankHash` over canonicalised JSON. I overrode it in favour of hashing
raw file bytes, on the grounds that canonical JSON needs two implementations to agree forever
and raw bytes has exactly one obvious meaning.

**Raw bytes has a property I did not think about: it is platform-dependent.** With
`core.autocrlf` on — which is the Windows default and was set on the user's machine — two
checkouts of the same repository produced two different fingerprints. We demonstrated this:
`exam-forge` gave `043bd0f8`, `exam-forge-review` gave `a2372c75`, same content.

Canonical JSON was immune to this. My reason for overriding it was aesthetic — "deliberately
dumb, one possible implementation" — not empirical. It cost two extra rounds and a
`.gitattributes` renormalisation.

The eventual fix (compute at build time, inject a constant, normalise line endings) is right,
and it was also *my* suggestion — but the builder had proposed exactly that in their own
planning before I said anything, and talked themselves out of it. Two of us independently found
the right answer and neither took it.

### 5. I fabricated a measurement and presented it as fact

I reported "**69 of 69 text files contain CR bytes**." The number came from a shell test where
`grep -c` prints `0` and exits `1`, so my `|| echo 0` fallback appended a second line and every
file compared unequal to `"0"`. Every file was counted as CRLF, including the ones that weren't.

I stated this while enforcing "never state a count you have not just measured" on the builder,
who checked it themselves and found 7–8.

### 6. My phrasing sent the builder into hours of wasted work

I wrote: *"don't assume a 1:1 pairing and don't drop a section that lacks one."* I meant "some
sections have no callouts; render them anyway." They read it as "find the missing pairing," and
built an 87-line inference engine that derived callout ownership from the position of horizontal
rules — violating D2 (metadata is authored, never inferred) — and broke `section-a` from 17
callouts to 0.

There was no problem to solve. 44 of 48 sections had exactly 1/1; the three `## Sources`
sections correctly had none; one long section had two because it has three sub-parts.

**I caused this by giving file totals when per-section detail was what mattered** — the exact
mistake I criticised in three of their tests over the following hours.

### The pattern

All three are the same failure: **I applied the project's rules to the builder's work and not
to my own.** Verify the artefact; never state an unmeasured count; give inputs where right and
wrong diverge. I enforced each of these, and violated each of them, in the same evening.

The structural cause is that nothing checks the reviewer. The builder has `npm run pipeline`,
281 tests, and me. I have nothing. The only correction mechanism was the user occasionally
saying "your lingo is difficult to understand" and the builder occasionally checking my numbers
— which they did, twice, and were right both times.

---

## Part 3 — Decisions nobody questioned

These are the ones I am least confident about, because neither of us examined them at all.

### 7. Proctoring exists because it was asked for, not because it works

The product has fullscreen enforcement, integrity event logging, severity weighting, an
integrity band, and a specced camera tier. It also has:

- **D4:** fullscreen cannot be enforced.
- **D5:** the camera detects face-presence, not gaze.
- **D6:** the report never accuses, and false positives are expected and must be stated.
- **§2.11:** the client computes the score and can edit the payload; not a basis for a grade.

So we built an elaborate integrity apparatus and then documented, at length and honestly, that
it establishes nothing. The builder's item #2 is uncertain about thresholds for a signal that
by design cannot support a conclusion.

**The alternative never offered:** don't build it. Tell students plainly, "this is practice, we
don't monitor it, your score is for you." One sentence replaces a subsystem, several SPEC
decisions, a severity constant, a band calculation, a disclaimer, and W8 entirely.

This is a thirty-student practice test in an undergraduate elective. The honest framing was
always available and is better product.

I inherited this from the user's opening request ("eye tracking, cheat report") and spent my
effort making it *honest* rather than asking whether it should exist. Making a bad idea honest
is not the same as questioning it.

### 8. The blueprint weights rest on a retired exam

`blueprint.json` declares `weightSource: "official-normalized"` and carries a `weightSourceRef`.
The whole D2 apparatus — metadata is authored, never inferred, and must name its source — is
built on top of these numbers.

The numbers are the published AI-102 domain bands. **AI-102 retired on 30 June 2026.** The exam
a student would now sit is AI-103, and the project's own notes say, at `section-a.md:490`:

> *"the precise weights for the other five domains are not yet published in Microsoft's official
> skills outline as of 2026-08-02. The table below uses **inferred** relative shifts."*

So the bank is weighted to a retired exam, and the successor's weights are explicitly
unpublished and inferred. `weightSource: "official-normalized"` is true and misleading at the
same time: official to an exam nobody can take.

Nobody said this out loud. I audited the *provenance mechanism* thoroughly and never audited
whether the provenance still pointed at something live.

**What to do:** either add `weightSourceExamStatus: "retired"` so the label carries its own
caveat, or re-weight to the AI-103 bands with `weightSource: "inferred"` and accept the honest
downgrade. The current state claims more authority than it has.

### 9. The catalogue should probably be deleted, not deprioritised

W6 builds a second static site listing every published bank, filterable by category, tags,
paper type, language and date. Its purpose is discovery across many banks.

There is one bank. There has been one bank for the entire life of the project.

I deprioritised it. I should have proposed cutting it from the spec, because a feature whose
value begins at N=5 in a project that has never reached N=2 is not "later," it is speculative.
Its presence in the queue has shaped `emit-meta.mjs`, `build-catalog.mjs`, `fetch-registry.mjs`,
`registry/`, a daily GitHub Action, four filter fields, `apply-tags.mjs`, `taxonomy.json`, and a
frozen-contract clause (D9) — all live code and documentation, serving nothing.

### 10. "No backend" (D8) was decided once and forced everything after it

Static-only is right for cost and simplicity, and I would probably choose it again. But it is
load-bearing in a way nobody traced:

- The answer key must ship in the bundle → the honesty apparatus around that.
- Results are self-reported → D6 cannot be strengthened → the integrity band cannot mean
  anything → §7 above.
- Nothing reaches the teacher → W9 exists to POST to a Google Sheet.
- No usage logs → every tuning constant in the builder's report is unmeasurable.

**The alternative never priced:** the user already runs Google Apps Script. A `doPost` endpoint
is free, already in their toolchain, already used by `consolidate-responses.gs`, and would have
given server-side result collection and usage logging for perhaps 50 lines. That is the
"logging" the builder's report asks for seven times.

D8 was justified by "GitHub Pages is free and there's no server." True — but a Google Sheet
*is* a server the user already operates.

### 11. Three sessions, three workspaces, one machine — never tested

I designed the Author / Builder / Maintainer separation on the theory that a builder carrying
20,000 tokens of Azure trivia writes worse React. It sounds right. It was never tested.

The measurable costs are in this conversation: a git worktree, two checkouts that disagreed on
line endings, a content fix applied twice in two places with different wording, a `bankHash`
that moved three times, a merge that failed because a branch was checked out elsewhere, and a
long stretch of the user hand-carrying messages between two sessions — including pasting the
same message three times because the boundary made it hard to tell what had been delivered.

And the isolation I designed for did not even hold: the builder acquired my exact rationale
wording from an *uncommitted* file in the review worktree, which means the two workspaces were
never actually separated.

**The alternative:** one session, one folder. The context-pollution risk is real but unmeasured;
the coordination cost is large and was measured, all evening, by the user.

---

## Part 4 — What the builder's report cannot see

Their report is item-level and code-level. Three things sit outside its frame:

1. **Whether the application should have been built** (§1). Not their call, and not visible from
   inside the work.
2. **That five of eight course days have no content at all.** Days 4–8 — generative AI, agentic,
   MLOps, responsible AI, deployment — have no notes, no questions, no bank. The project has
   spent weeks on tooling to deliver 3/8 of a syllabus. This never appears in their review
   because content is not their role, which is precisely why the role split hid it.
3. **That their own conclusion — "log real data and tune" — is blocked by a decision they
   didn't make** (D8, no backend, §10 above). They can't fix it and probably can't see it.

---

## Part 5 — What I would defend

Not everything here is a doubt.

- **Fixing the content pipeline before building anything.** The set5 audit found a bank where
  85% of answers were "A" and the converter silently dropped 38% of the questions. Building a
  beautiful app on that data would have been the real disaster. This was right.
- **The loud-failing validator with no `--force`.** Repeatedly caught real defects. The
  self-test proving the validator fails on known defects is the single best-designed thing in
  the repository.
- **Verifying the artefact rather than the process.** You cannot make a model research; you can
  refuse output lacking a dated `## Sources` section with URLs. Writing that check forced a
  re-verification that found three stale claims, including a certification described as active
  that had retired.
- **Refusing to let the report accuse anyone.** D6 is right regardless of whether the feature
  should exist.
- **Notes before questions.** The user's idea, and it made coverage mechanically checkable.
- **Honesty about the answer key shipping in the bundle.** The temptation to obscure it was
  real and was correctly resisted.

---

## What to do

**Now:**

1. **Author Days 4–8, or explicitly decide not to.** Five of eight days is the largest gap in
   the project and the least discussed. Say out loud whether this bank is finished at 3/8.
2. **Fix the weight provenance** (§8). Either mark the source as retired or re-weight to AI-103
   and downgrade `weightSource` to `inferred`. It currently claims authority it doesn't have.
3. **Get it in front of students.** Already decided. It unblocks every "log real data" item in
   the builder's report.

**Before any further feature work:**

4. **Decide whether the proctoring subsystem stays** (§7). If the report can't support a
   conclusion, consider deleting the feature rather than refining its thresholds. That closes
   the builder's #2 and all of W8.
5. **Cut W6 from the spec** (§9), or state the N at which it becomes worth building.
6. **Either regenerate a module from SPEC.md, or stop claiming TINS** (§2). Both are fine. The
   current state pays the cost and skips the benefit.
7. **Price a Google Apps Script `doPost` endpoint** (§10). Fifty lines, free, already in the
   toolchain, and it unblocks every tuning constant the builder cannot currently measure.

**Process:**

8. **A "cheapest version" line at the top of any future spec.** What is the least that would
   work, and what does the expensive version buy? Answering badly is fine. Not answering is what
   happened here.
9. **Nothing checks the reviewer.** Two of my errors this session were caught by the builder
   checking my numbers. That should be the norm, stated explicitly: the builder is expected to
   verify the reviewer's measurements, and "I checked and you're wrong" is the desired response,
   not friction.

---

*The application works. The pipeline is genuinely good and will outlive this bank. The
uncertainties above are mostly about whether the right thing was built, not whether the thing
was built right — and that question was mine to ask.*
