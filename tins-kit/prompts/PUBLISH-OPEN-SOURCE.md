# Prompt: PUBLISH-OPEN-SOURCE (package a finished TINS project for public release)

> **The prompt you paste into a fresh LLM session when a finished TINS project is
> actually ready to ship publicly** — open-sourced, shown as a portfolio piece, or
> repurposed as teaching/interview-prep material. It produces a scrubbed public
> sibling folder: methodology fingerprints and LLM-authorship fingerprints removed
> from the entire tree, public-facing documentation written in a corporate voice,
> and a quality bar aimed at real technical scrutiny, not just the absence of a
> few known strings.
>
> **Not the same prompt as `prompts/RELEASE-CHECKLIST.md`.** That one is the
> pre-deploy production-safety gate for the SAME repo — no console.log, no TODOs,
> a staging soak, a backout plan. It never produces a second repo and doesn't care
> whether the code reveals its own methodology. This prompt is the opposite
> concern: producing a second, public-facing copy, scrubbed and documented for an
> outside reader. Run `RELEASE-CHECKLIST.md` for your private deploy; run this one
> only when public release is actually happening.
>
> **Source:** D30 (session 14). The mechanics this prompt runs are fully specified
> in `lib/patterns/private-to-public.md` and implemented in
> `scripts/private-to-public.mjs`. The intent to eventually publish is normally
> recorded much earlier, as question 8 of the `SPEC-AUTHOR.md` interview
> (`SPEC.md` §0.2 `Public release intended: TRUE/FALSE`) — but this prompt works
> even if that row says FALSE, or doesn't exist because the project predates D30;
> it just means more manual cleanup below, since the discipline wasn't there from
> day one.

---

## When to use

You (an LLM session) have a finished, gate-green TINS project and the user has
said something like "let's open-source this," "package this for my portfolio,"
or "get this ready to publish." Run this prompt in a **fresh session** — it needs
full read access to the private working copy, including the methodology-internal
files it must NOT let leak, and a clean context makes it easier to catch a stray
reference than a session that's been carrying private context all day.

If the project isn't gate-green yet (validator red, selftest red, build broken),
stop and send the user back to finish the project first. This prompt packages a
finished thing; it doesn't fix an unfinished one.

---

## The prompt

```
You are packaging a finished TINS project for public release. Your working
directory is $PWD, the private working copy. The project has the kit vendored
at ./tins-kit/. Your job is to produce a scrubbed public sibling folder, write
its public-facing documentation in a corporate voice, and verify the result
would survive real technical scrutiny — not just a grep for known strings.

The 9 steps (do them in this order).

---

## The 9 steps (do them in this order)

### Step 0 — Confirm the project is actually ready

```bash
pwd
ls -la
ls tins-kit/                              # confirm the kit is here
node tins-kit/scripts/validate.mjs --spec=SPEC.md   # must exit 0
node --test tins-kit/scripts/selftest.mjs           # must exit 0
npm run build                              # must exit 0, if this project builds
```

**Hard precondition:** all three must be green. If any is red, stop — this is
not the prompt for that. Send the user back to finish the project (or run
`prompts/RELEASE-CHECKLIST.md` first if the question is really "is this safe
to deploy," not "is this ready to publish").

### Step 1 — Read the context

| # | File | Why |
|---|---|---|
| 1 | This project's `SPEC.md` §0.2 | Look for the `Public release intended` row — if TRUE, the project was built with this day in mind; if FALSE or absent, expect more manual cleanup in Step 3 |
| 2 | This project's `HANDOVER.md` | What's actually finished vs. still in flight — don't publish a half-built W |
| 3 | This project's `BUILDER-DECISIONS-REVIEW.md` | The decision history you'll adapt into `docs/DECISIONS.md` |
| 4 | `tins-kit/lib/patterns/private-to-public.md` | The full pattern this prompt runs — open it now, in full |

### Step 2 — Decide the sibling folder name and confirm scope with the user

Ask, if not already obvious from context: what should the public repo be called,
and where should the sibling folder live? Convention (from the pattern):

```
/projects/myapp/         private working copy (here)
/projects/myapp-public/  public-ready sibling (about to be created)
```

Also confirm: is this a first-time release, or an update to a repo that's
already public? If it's an update, the sibling folder already exists — treat
this run as regenerating it, not creating it fresh (the destination tree is
DERIVED output; don't hand-merge into an old copy).

### Step 3 — Run the copy + scan pattern

Open `tins-kit/lib/patterns/private-to-public.md` and run its 10-step workflow
now, starting from its Step 1. In summary, that workflow:

1. Runs `node tins-kit/scripts/private-to-public.mjs <src> <dst> --name="..."`,
   which copies the files that belong in public (per the pattern's include/
   exclude table) and scans the ENTIRE destination tree — every file,
   including in-line code comments — for methodology fingerprints and
   LLM-authorship fingerprints in one pass.
2. If it exits non-zero, fixes what it found AT THE SOURCE (never hand-edit
   the destination for a copied file) and re-runs until clean.
3. Writes README.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md,
   docs/SCHEMA.md, and docs/DESIGN-WALKTHROUGH.md directly in the destination,
   in the corporate voice the pattern's §3.0 requires — no first-person LLM
   voice, no hedging, no stock AI openers or closers, nothing that reads as a
   chatbot transcript with syntax highlighting.
4. Re-scans the destination in --scan-only mode now that fresh docs exist
   (freshly written prose is exactly where a stray "as an AI" slips back in).
5. Extends the destination's .gitignore.

Do not skip any of these — they are not optional cleanup, they are the release.

### Step 4 — Run the quality rubric

Hold docs/ARCHITECTURE.md, docs/DECISIONS.md, and docs/DESIGN-WALKTHROUGH.md
against lib/patterns/private-to-public.md §3.7 (five questions, the sharpest
being: could a competent stranger re-implement the hardest subsystem from the
docs alone, without reading the source?). If the honest answer to more than one
question is no, go back and improve the docs before moving on. A release that
merely passes the scanner but fails the rubric has been hidden, not published.

### Step 5 — Verify the gate in the public folder

```bash
cd <public-sibling-folder>
npm install
npm run validate    # must be green
npm run selftest    # must be green
npm run build        # must be green
```

If any of these fail in the PUBLIC copy even though they passed in the private
one, something in the copy/scrub step broke a reference (a relative path, an
import, a config value) — fix it in the source and re-run Step 3, don't patch
the public copy directly.

### Step 6 — Git init, commit, and deploy (if applicable)

Follow lib/patterns/private-to-public.md §2 Steps 9-10: git init, review what's
staged (git status — this is your last chance to catch anything that shouldn't
be there), commit, then deploy per whichever variation in the pattern's §5 fits
this project (SPA to static host, CLI to npm package, library to npm package,
backend to container).

### Step 7 — Record the release

Back in the PRIVATE working copy, record what happened:

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="Public release: <project/repo name>" \
  --context="<why now - portfolio, open-source, teaching material>" \
  --decision="Published <public-sibling-path> at <date>, scan clean, rubric section 3.7 passed" \
  --alternatives="<if any were considered - e.g. private demo only>" \
  --consequences="<what this commits the project to going forward - e.g. future comments/decisions must stay public-safe>"
```

If SPEC.md §0.2 doesn't yet have a "Public release intended" row, add one now
(TRUE, with a note that it was decided retroactively at release time rather
than at the original interview) — so a future session reading the spec
understands the discipline this project is under from here on.

### Step 8 — Leave the gate green in BOTH copies

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test tins-kit/scripts/selftest.mjs
```

Run these in the private copy (they should already be green from Step 0 — this
just confirms nothing broke during the release work) AND, if you haven't
already in Step 5, in the public copy. A release that leaves the private
working copy's own gate red is not finished just because the public copy
shipped.

---

## What you do NOT do

- **Skip the quality rubric because the scanner was clean.** The scanner proves
  absence of known bad strings. It does not prove the docs are good enough to
  survive scrutiny. Both checks are required; neither substitutes for the other.
- **Hand-edit the public sibling folder's copied files directly.** Anything the
  script copied from the private source is DERIVED output — fix the source and
  re-run. Only the freshly authored docs (README, CONTRIBUTING, docs/**) are
  meant to be edited in the destination directly, because they're born there.
- **Treat this as the same job as RELEASE-CHECKLIST.md.** That prompt gates a
  same-repo production deploy. This prompt produces a second, public-facing
  repo. A project can need one, the other, both, or (for something that only
  ever runs privately) neither.
- **Publish with a red gate in either copy.** If Step 5 or Step 8 finds a
  failure, fix it before calling the release done.

---

## What success looks like

1. The user says the project is ready to publish.
2. You confirm the gate is green (Step 0).
3. You read the private decision history so the public docs have real content
   to draw from (Step 1).
4. You run the copy + scan pattern until the destination tree is clean of both
   methodology and LLM-authorship fingerprints (Step 3).
5. You write the public docs in a corporate voice and hold them against the
   quality rubric (Step 4) — not just "no banned words," but "would a skeptical
   engineer learn something real from this."
6. You verify the gate is green in the public copy too (Step 5), commit and
   deploy (Step 6).
7. You record the release in the private decision log (Step 7).
8. Both copies' gates are green (Step 8).
9. A stranger who has never heard of this methodology can clone the public
   repo, read its docs, and genuinely study or re-implement pieces of it.

Begin with Step 0.
```

---

*— End of `PUBLISH-OPEN-SOURCE.md` prompt. See also:
`lib/patterns/private-to-public.md` (the full 10-step workflow and the
quality rubric this prompt runs), `scripts/private-to-public.mjs` (the
copy + whole-tree scan script), `prompts/SPEC-AUTHOR.md` (question 8,
where release intent is normally first recorded), `prompts/INTERVIEW-CHECKLIST.md`
(Q8), `prompts/RELEASE-CHECKLIST.md` (the different, same-repo pre-deploy
gate), `prompts/CONTINUE-TINS-PROJECT.md` (routes here for a "let's
open-source this" W).*
