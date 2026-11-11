# Prompt: GENERATE-CURRICULUM (turn a finished project into a teaching curriculum)

> **The prompt you paste into a fresh LLM session when a finished TINS project should
> become standalone teaching material** — a curriculum someone with none of the
> project's assumed background could use to actually learn system design, the
> technologies involved, and how to debug a real system, using this project's own real
> history as the material. It produces a sibling folder, `<project>-curriculum/`,
> generated one file at a time so each file gets full, unhurried detail instead of being
> compressed to fit alongside others in one response.
>
> **Not the same output as `prompts/PUBLISH-OPEN-SOURCE.md`.** That prompt produces the
> public PRODUCT repo, written in corporate, professional voice, for someone evaluating
> the software. This prompt produces a separate TEACHING artifact, written in direct
> second-person instructional voice, for someone trying to learn from it. The two need
> different voices for their own audiences, so they're deliberately different folders —
> see `lib/patterns/private-to-public.md` §3.0 for why corporate voice would be wrong
> here, and this prompt's own content rules below for what's right instead.
>
> **Companion to `prompts/GENERATE-INTERVIEW-PREP.md`** — the separate, later pass for
> first-principles reimplementation drills. Run this prompt first; run that one whenever
> the interview-prep angle is actually wanted, not automatically.
>
> **Source:** D31 (session 15). Reuses `scripts/private-to-public.mjs` (D30) as-is for
> the safety gate — no new scanner, no new banned-terms list.
>
> The kit must already be vendored at `./tins-kit/`. This prompt operates on the private
> working copy for source material and produces output in a NEW sibling folder next to
> it — never inside the private copy, never inside the D30 public repo.

---

## When to use

You (an LLM session) have a finished TINS project — ideally one that has already been
through `prompts/PUBLISH-OPEN-SOURCE.md`, though that's not a hard requirement — and the
user wants it turned into teaching material: a portfolio-adjacent artifact, an
onboarding document for future hires, or self-study material for someone learning the
stack from this real example. Run this prompt in a **fresh session**: it works entirely
from the project's real artifacts (the spec, the decision log, the handover doc, the
code), never from memory of the session that originally built the project. If a fresh
session reading those artifacts can't produce good curriculum content, that's a sign the
decision log wasn't capturing enough — worth fixing upstream, not a reason to look for
the original builder session instead.

---

## The prompt

```
You are turning a finished TINS project's real working history into a standalone
teaching curriculum. Your working directory is $PWD, the private working copy. The
project has the kit vendored at ./tins-kit/. Your job is to produce a sibling folder,
<project>-curriculum/, containing a primer, a prerequisite map, a glossary, a
concept-to-code index, milestones, and one module per non-trivial subsystem — each
module drawing on the project's REAL decisions, REAL bugs, and REAL requirements,
never invented ones.

You will generate this ONE FILE PER TURN. Do not compress multiple files into a single
response to save turns — the whole point of this pacing is to give each file full,
unhurried, maximally descriptive treatment. Stop after each file and wait for the user
(or your own next turn, if you are continuing unattended) before starting the next one.

The 10 steps (do them in this order).

---

## The 10 steps (do them in this order)

### Step 0 — Confirm your location and the project's readiness

```bash
pwd
ls -la
ls tins-kit/                                       # confirm the kit is here
node tins-kit/scripts/validate.mjs --spec=SPEC.md    # should be green
node --test tins-kit/scripts/selftest.mjs            # should be green
```

If the gate isn't green, tell the user and stop — a curriculum built from an unfinished,
inconsistent project teaches the wrong lessons. Decide the sibling folder name with the
user if it isn't obvious: convention is `../<project-name>-curriculum/`, alongside the
private working copy and (if it exists) the D30 public repo — never inside either.

### Step 1 — Check for an in-progress run (resume, don't restart)

```bash
cat ../<project-name>-curriculum/CURRICULUM-PROGRESS.md 2>/dev/null
```

If `CURRICULUM-PROGRESS.md` already exists and has files marked pending, this is a
resume: skip straight to Step 6 and continue from the first pending file in manifest
order. Do NOT regenerate files already marked done — re-reading and re-writing a
finished file wastes the exact turn budget this whole design is protecting. Only start
fresh at Step 2 if there's no existing progress file, or the user explicitly asks for a
full regeneration.

### Step 2 — Read the real source material

| # | File | Why |
|---|---|---|
| 1 | `SPEC.md` | The real requirements (§2 functionality, §8 acceptance criteria) — the source for `SCENARIO-QUESTIONS.md` and the primer's system-design framing |
| 2 | `BUILDER-DECISIONS-REVIEW.md` | The real decision history — the source for module `README.md`s and `DEBUGGING-CASE-STUDY.md`s |
| 3 | `HANDOVER.md` | The W-queue and content inventory — helps map modules to what actually got built |
| 4 | `docs/DESIGN-WALKTHROUGH.md`, if it exists (from a prior `PUBLISH-OPEN-SOURCE.md` run) | Already has a subsystem breakdown and "trickiest bug" sections — reuse and expand this, don't redo the analysis from scratch |
| 5 | The code itself, for the subsystems `docs/DESIGN-WALKTHROUGH.md` doesn't cover, or if it doesn't exist yet | The ground truth when the docs don't already have it |

### Step 3 — Decide the module breakdown

List every non-trivial subsystem the project has — the same granularity
`docs/DESIGN-WALKTHROUGH.md` §3.6 uses if it exists (reuse its list directly), or derived
fresh from `SPEC.md` §2/§4 if it doesn't. Each becomes one `modules/<NN>-<name>/` folder.
A trivial project (a handful of files, one concern) may have only 2-3 modules; that's
fine — don't invent module boundaries that don't reflect real structure.

### Step 4 — For each module, check whether a real bug exists in its history

Search `BUILDER-DECISIONS-REVIEW.md` for decision entries tied to this module that
describe a real defect being found and fixed (not just a design choice made cleanly the
first time). Note, per module, whether a `DEBUGGING-CASE-STUDY.md` belongs in its
manifest entry. A module with no real bug in its history gets NO debugging case
study file — never invent one. Real, sourced material is the entire value of this
curriculum; a fabricated bug undermines that the moment a reader notices it doesn't
match the actual commit/decision history.

### Step 5 — Write the manifest and initialize `CURRICULUM-PROGRESS.md`

Create the destination folder and write `CURRICULUM-PROGRESS.md` (start from
`tins-kit/templates/CURRICULUM-PROGRESS.md`) listing every file this run will produce,
in the order you'll generate them, each marked `pending`:

```
00-START-HERE.md
GLOSSARY.md
CONCEPT-TO-CODE-INDEX.md
MILESTONES.md
modules/01-<name>/README.md
modules/01-<name>/SCENARIO-QUESTIONS.md
modules/01-<name>/DEBUGGING-CASE-STUDY.md   (only if Step 4 found a real bug)
modules/02-<name>/README.md
...
```

Show this manifest to the user (or state it plainly if running unattended) before
generating anything, so they know what's coming and roughly how many turns it'll take.

### Step 6 — Generate files, one per turn, in manifest order

For each file in the manifest, in order:

1. Write the file in full — see "Content rules" below for what each file type needs.
   Be as descriptive as the file warrants; this pacing exists specifically so you are
   not compressing content to fit a turn budget.
2. Update `CURRICULUM-PROGRESS.md`: mark this file `done`.
3. Stop. Do not start the next file in the same turn. If running interactively, a short
   note ("`00-START-HERE.md` is done — reply to continue with the next file") is enough;
   don't pad it into a full response. If running unattended across scheduled turns,
   proceed to the next file on your next turn.

### Step 7 — Run the safety gate

Once every file in the manifest is `done`:

```bash
node tins-kit/scripts/private-to-public.mjs ../<project-name>-curriculum/ --scan-only
```

This reuses D30's scanner exactly as-is — same banned-terms list, same two categories
(methodology fingerprints, LLM-authorship fingerprints). No new script, no new list: the
curriculum needs to stay clear of precisely the same two things D30 already blocks.

### Step 8 — Fix any leaks, re-scan until clean

If Step 7 exits non-zero, fix the flagged file(s) directly (these are freshly authored,
not copied from anywhere — there's no "source" to fix instead, unlike D30's product
repo) and re-run Step 7 until it exits 0.

### Step 9 — Report completion

Tell the user: how many modules, whether any modules got a debugging case study (and
how many didn't, and why — no real bug found, not an oversight), and that
`prompts/GENERATE-INTERVIEW-PREP.md` is available as a separate, optional next pass for
first-principles reimplementation drills, run whenever that's wanted — not automatically
chained on.

---

## Content rules (apply to every file you write)

**Voice: direct, second-person, instructional — not corporate, not an AI assistant's
voice.** "You'll notice that..." and "Try this yourself before reading on" are correct
here; they'd be wrong in a `PUBLISH-OPEN-SOURCE.md` product doc. What's still wrong in
BOTH: first-person LLM voice ("I've written this section to..."), meta-commentary about
the writing process, stock assistant openers/closers ("Certainly!", "Let me know if you
have questions"), and any mention of the model or vendor that generated the content.

**Everything traces to something real.** Every claim, example, bug, and requirement in
the curriculum must trace back to `SPEC.md`, `BUILDER-DECISIONS-REVIEW.md`,
`HANDOVER.md`, or the code itself. Where you need an illustrative example and nothing
real fits, say so explicitly ("this is a constructed example, not from the project's own
history") rather than presenting invented material as if it happened.

**`00-START-HERE.md`** — the primer. Assumes NONE of the background the original
project's own `SPEC.md` assumed of its builder (not "assumes zero programming
experience ever" — assumes zero background in THIS project's specific domain and stack).
Contains: what the project is, in plain language; a prerequisite map (a table:
concept/technology → why this project needs it → where to learn the fundamentals, as a
pointer, not a full external tutorial → which module first uses it); a short, real
debugging methodology (a concrete procedure — reproduce, isolate, hypothesize, test,
verify, document, or whatever procedure the project's own real debugging history in
`BUILDER-DECISIONS-REVIEW.md` actually followed, described honestly rather than as a
generic checklist); a system-design orientation showing how the modules relate to each
other; and how to use the rest of the curriculum (point to `MILESTONES.md`).

**`GLOSSARY.md`** — every term a newcomer to this project's domain and stack would need
defined, sourced from real usage in the spec/code, not a generic glossary of the
technology.

**`CONCEPT-TO-CODE-INDEX.md`** — a table mapping curriculum sections to real file/line
references in the code, so a reader can always answer "where is this actually
implemented."

**`MILESTONES.md`** — pacing and checkpoints: a suggested order through the modules,
with a concrete "you should be able to do X" checkpoint after each, so a self-directed
learner knows whether they actually absorbed a module before moving to the next.

**`modules/<NN>-<name>/README.md`** — what this subsystem does, why it exists, how it
works, walked through the way you'd explain it to a new hire in their first week — not a
changelog. Reuse and expand `docs/DESIGN-WALKTHROUGH.md`'s content for this module if it
exists.

**`modules/<NN>-<name>/SCENARIO-QUESTIONS.md`** — LeetCode-style questions, but framed as
THIS module's own real acceptance criteria and functional requirements from `SPEC.md`,
not generic algorithm problems. Each question should be answerable by understanding this
module, and each should state what a correct answer needs to handle (drawn from the real
§7 error-handling table and §8 acceptance criteria where relevant).

**`modules/<NN>-<name>/DEBUGGING-CASE-STUDY.md`** (only where Step 4 found a real bug) —
structured as an exercise, not a narration: present the real buggy situation as it
existed at the time (symptom, what was supposed to happen), then an explicit "before
reading on, try to diagnose this yourself — what would you check first?" prompt, THEN
reveal the real diagnosis process and the real fix, pulled from the decision log's
Context/Decision/Consequences fields. This is the "write buggy code first, then resolve
it" pedagogy, using real history instead of a fabricated bug.

---

## What you do NOT do

- **Generate more than one file per turn.** The whole design exists to avoid compressing
  content — collapsing files back into one response defeats the purpose.
- **Invent a bug, a requirement, or an example and present it as real.** If nothing real
  fits, say explicitly that the example is constructed.
- **Write the curriculum in D30's corporate product voice.** That voice is correct for
  `PUBLISH-OPEN-SOURCE.md`'s output and wrong here — see the content rules above.
- **Skip the safety gate because "it's just teaching material."** The curriculum can leak
  the same methodology and LLM-authorship fingerprints the product repo can; it gets the
  same scan.
- **Regenerate files already marked `done` in `CURRICULUM-PROGRESS.md`** on a resumed run.

---

## What success looks like

1. The user has a finished, gate-green TINS project and wants it turned into teaching
   material.
2. You confirm readiness and decide the sibling folder location (Step 0).
3. You resume an in-progress run if one exists, rather than restarting (Step 1).
4. You read the real source material (Step 2) and derive a real module breakdown
   (Step 3), checking each module for real bug history (Step 4).
5. You write and show the manifest before generating anything (Step 5).
6. You generate one file per turn, each maximally descriptive, each traceable to real
   project material, in the right instructional voice (Step 6).
7. You run the safety gate and fix anything it finds (Steps 7-8).
8. You report completion and point to `GENERATE-INTERVIEW-PREP.md` as an optional next
   step, not an automatic one (Step 9).
9. A learner with none of the project's assumed background can open
   `<project>-curriculum/00-START-HERE.md` and actually get started.

Begin with Step 0.
```

---

*— End of `GENERATE-CURRICULUM.md` prompt. See also: `prompts/GENERATE-INTERVIEW-PREP.md`
(the companion pass for first-principles reimplementation drills), `prompts/PUBLISH-OPEN-SOURCE.md`
(the product-repo release this curriculum is a sibling to, not a replacement for),
`lib/patterns/private-to-public.md` (the tone-and-scan discipline this prompt borrows
and adapts), `scripts/private-to-public.mjs` (the safety-gate scanner, reused as-is),
`templates/CURRICULUM-PROGRESS.md` (the resumability tracker's starter file).*
