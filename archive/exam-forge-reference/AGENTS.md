# AGENTS.md — onboarding for a new LLM session

> You are a new session about to work on `exam-forge`. Read this before anything else.
> If you are a human, read `README.md` instead — this file tells your AI assistant what
> to do on day one.
>
> Last updated: 2026-08-01 (repository created; content pipeline verified)

---

## 0. Sixty-second orientation

- **Product:** a spec-first generator for static exam-practice sites. Three modes —
  study, drill, timed practice exam — plus a static catalog of built banks.
- **Methodology:** TINS (There Is No Source). `SPEC.md` **is** the source code. The app is
  generated from it. Never fix a defect by editing generated app code; edit `SPEC.md` and
  regenerate.
- **Built and working:** the content pipeline (schema → converter → validator → self-test),
  one converted bank (`content/ai102-day1-3`, 50 questions, 3 domains), study notes for all
  three domains, and an authored blueprint using official AI-102 domain weights.
- **Not built:** the application itself, the catalog site, checkpoint questions. See
  `HANDOVER.md` §Work queue.
- **Stack for the app when you generate it:** Vite + React + TypeScript + Tailwind, static
  output to `dist/`, GitHub Pages, hash routing, no backend, `localStorage` only.
- **Stack for `scripts/`:** zero-dependency Node ESM. Keep it that way — the pipeline must
  run before any `npm install`.

## 0a. Which job are you here to do?

**Read `START-HERE.md` first if you have not.** It routes between three roles that should not
share a context window. The short version:

| The user asked you to… | Role | Go to |
|---|---|---|
| Build the app / study / drill / exam / catalog | **R2 Builder** | this file, then `HANDOVER.md` §5, start at W1 |
| **Add questions on a new topic** | **R1 Author** | `START-HERE.md` § Handoff protocol, then `docs/NEW-BANK.md` |
| Check status / hand the project on | **R3 Maintainer** | `docs/STATUS-REPORT.md` |

**If you are R2, stop reading about content and go to W1.** The rest of this file is yours.

**If you were handed a topic and asked for MCQs, do not start writing MCQs**, and by default do
not author them in this session at all. Ask the topic, then package the work for a fresh
session that has web search:

```bash
node scripts/new-bank.mjs --id <slug> --domains "a:Alpha,b:Beta"
node scripts/authoring-brief.mjs --id <slug> --topic "<what it is about>"
```

That writes a self-contained `AUTHORING-BRIEF.md` the user carries elsewhere. If they are short
on time and ask you to do it inline, do it — but say once what they are trading (topic context
degrading later app work; and that good notes need web search). Full script in
`START-HERE.md`.

Whichever way it runs, the order is fixed — **notes first, questions second**:

```
new-bank.mjs   →   NOTES-V1.md   →   GENERATOR-V2.md   →   validate
 scaffold          notes + weights    questions from notes
```

Notes are the syllabus; questions test the notes. Each question records the `## ` heading it
came from (`sourceSection`), which turns "did we cover the material?" into a check the validator
runs rather than something nobody discovers until a student sits the exam.

**You still need to ask for the topic.** Nothing in this repo knows what subject the user has in
mind, and nothing will guess one.

Two things to refuse: writing notes from your own knowledge when no source material exists, and
writing a dated claim (retired / deprecated / renamed) you have not verified against a URL. The
validator rejects the second; only you can catch the first.

## 0b. You do not need anything outside this folder

This repository is self-contained for W1–W8 (`SPEC.md` §0.2b). No script reads an external path,
and every format the exporters target is written out in full in `SPEC.md` §2.9.

Mentions of `sem5_azure_cloud/`, `mcq-mastery-&-analytics/`, `text2excel/` and the rest are
**provenance only**. You need the parent workspace *only* to author new content from the course
material (more study notes, checkpoint questions, or a Days 4–8 bank). If you were pointed at
`exam-forge/` alone, that is correct and sufficient — start at W1.

## 1. Read these, in this order

| # | File | Why |
|---|---|---|
| 1 | `HANDOVER.md` | Current state, work queue, gotchas, handover protocol |
| 2 | `SPEC.md` §0 (locked decisions) | Twelve decisions that are already settled. Do not relitigate them |
| 3 | `SPEC.md` §2 + §4 for whatever you are building | Modules and algorithms |
| 4 | `docs/AUDIT-set5.md` | Why the validator is strict. Every rule maps to an observed defect |
| 5 | `docs/PIPELINE.md` | What the four legacy tools were and what survives |
| 6 | `docs/SOURCE-MATERIAL.md` | Where the notes and the domain weights came from — and §4, the stale certification claims still sitting in the bank |
| 7 | `docs/INSTRUCTOR-CONTEXT.md` | Who this is for and how they work. Read before authoring any content — it changes the register, the length, and what counts as a good question |

**Do not re-audit the legacy tools.** `docs/PIPELINE.md` and `docs/AUDIT-set5.md` cover
everything an audit would find, with measurements.

## 2. First commands

```bash
node --version       # need >= 18
npm run pipeline     # selftest -> validate -> scan-secrets
```

Expect: every self-test case passes, both banks PASS with warnings, no credentials found.
Warnings are fine and are explained in §3. **Errors are not** — stop and fix them before
touching anything else. A broken gate is worse than no gate.

Do **not** run `npm run convert`. It is a one-time migration tool and it now refuses to
overwrite the existing bank — that refusal is correct behaviour, not a failure.

## 3. Standing rules (non-negotiable)

1. **Never add a second parser.** If you find yourself writing a regex against question
   prose, you have taken a wrong turn. Input is JSON (D1).
2. **Never infer metadata** — topic, difficulty, Bloom level, domain. Authors state it.
   The previous pipeline inferred it and mapped nearly everything to "Evaluate" (D2).
3. **Never let a validation failure through.** No `--force`, no "warn and continue". The
   predecessor printed a warning and `Done ✅` while dropping 38% of a bank (D3).
4. **Never write or imply that the exam can prevent cheating.** Fullscreen exit cannot be
   blocked by any browser API; iOS Safari has no fullscreen at all. Detect, log, report
   (D4). The report never says "cheated" (D6).
5. **Never make the camera tier a requirement.** It is opt-in, local, self-disabling, and
   unavailable on the primary target device class (D5).
6. **Never call `Math.random()` in paper construction.** Everything is seeded so a paper
   is reproducible from its seed (D11).
7. **Never let checkpoint questions into an exam paper** (D12).
8. **Keep `scripts/` dependency-free.**
9. **Never reproduce real exam items.** These are original questions on the same concepts.
10. **Never regenerate `blueprint.json` from question counts.** Domain weights are authored
    (D2). The converter leaves an existing blueprint alone; keep it that way.
11. **Never write study-notes content the source material does not support.** A missing notes
    file renders a placeholder and is fine. An invented one is not.
12. **Flag hardcoded credentials every time, and say "rotate it".** The author has asked for
    this explicitly and has been burned three times. Content here ships to a public static site
    and routinely contains code samples. `npm run scan-secrets` gates the build; do not
    weaken it, and do not add a bypass flag. Rotate first, clean second — a key that has merely
    been saved to a shared file is burned. Context: `docs/INSTRUCTOR-CONTEXT.md` §6.

## 4. Ask vs. try

**Try** (just do it, then report): anything covered by `SPEC.md`; adding validator checks
with matching self-test cases; converter fixes for a new legacy format hazard.

**Ask first**: changing anything in `SPEC.md` §0.2; changing `catalog.json`'s shape (it is
a frozen contract, D9); adding a runtime dependency; anything that would introduce a
server, an account system, or stored results.

## 5. When you finish

Follow the handover protocol in `HANDOVER.md` §Protocol before you stop. An unrecorded
finding is a finding the next session pays for again.
