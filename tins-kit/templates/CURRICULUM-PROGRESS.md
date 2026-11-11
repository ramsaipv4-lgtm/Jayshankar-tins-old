# CURRICULUM-PROGRESS.md — resumability tracker for this generation run

> **Audience:** the LLM session running `prompts/GENERATE-CURRICULUM.md` or
> `prompts/GENERATE-INTERVIEW-PREP.md` (across turns, and across sessions if the run
> doesn't finish in one sitting). This file is the single source of truth for one
> generation run: every file the manifest committed to producing, and whether it's been
> written yet. A fresh session resuming this run reads the table below, skips every file
> already marked `done`, and continues from the first `pending` entry — it never
> regenerates a finished file and never restarts from scratch just because the session
> changed.
>
> This is a **derived-at-destination** file: each generation run starts a fresh copy of
> this template in its own output folder and edits that copy directly as it works. There
> is no single shared "the" `CURRICULUM-PROGRESS.md` — `GENERATE-CURRICULUM.md`'s run
> lives at `<project>-curriculum/CURRICULUM-PROGRESS.md`, and if
> `GENERATE-INTERVIEW-PREP.md` is later run against the same project, it keeps its own
> separate copy at `<project>-curriculum/interview-prep/CURRICULUM-PROGRESS.md`. Don't
> confuse or merge the two — each tracks only the manifest its own prompt is producing.
>
> **Run started:** <YYYY-MM-DD>
> **Generating prompt:** `GENERATE-CURRICULUM.md` | `GENERATE-INTERVIEW-PREP.md`
> **Source project:** <path to the private working copy this run reads from>

---

## Manifest

List every file this run committed to producing, in the exact order they'll be
generated, one row per file. Add rows for the real manifest decided in that prompt's own
Step 5 — the row below is a placeholder to replace, not an example to keep.

| # | File | Status | Notes |
|---|---|---|---|
| 1 | `00-START-HERE.md` | pending | |

**Status values:** `pending` → `done`. There is no partial state — a file is either not
started yet or written in full; this design deliberately generates one file per turn so
there's never a half-written file to resume mid-way through.

**Notes column** — anything worth remembering about that specific file: why a module was
given a `DEBUGGING-CASE-STUDY.md` or not, why a concept was included or dropped in an
interview-prep run, anything that would help a resuming session (possibly a different
LLM session than the one that started the run) pick up with the same judgment calls
already made.

---

## Resume instructions

A session resuming this run should:

1. Read this file's Manifest table.
2. Skip every row marked `done` without re-reading or re-writing it.
3. Continue generation from the first row marked `pending`, in table order.
4. Mark each row `done` immediately after that file is written in full — not before, and
   not batched at the end.

If the manifest itself needs to change mid-run (a module turns out to need an extra file,
or a planned file turns out not to be warranted), edit the table to reflect the new plan
and note why in that row's Notes column, rather than silently diverging from what this
file says.

---

## Safety gate result

<Filled in once the generation run's safety-gate step
(`scripts/private-to-public.mjs <dest> --scan-only`) has been run: the date, and
clean / N leak(s) found (and what changed to fix it, if any).>

- <date>: <result>
