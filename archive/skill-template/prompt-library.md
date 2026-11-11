# Prompt Library — Reusable Prompts for the Syllabus-to-Study-Plan Skill

> Copy-paste these into your session whenever you invoke the skill.

**v1.1 update (superseded — kept for history):** Prompts P2, P3, P5, P6, P7, P8, P9 were updated to reference the **3 companion files per day per track** (whiteboard + live coding + memory recall) as part of the standard output, living in the **track root** (e.g., `sem3/whiteboard_day03.md`), not the `day3/` subfolder.

**v1.2 update (current):** That track-root placement is reversed — companion files (+ the student/participant guide) now live **inside `day{N}/` itself**, alongside the rest of that day's artifacts. Also new in v1.2: `instructor_script.md` (P2, P3) is generated as a **teleprompter/Say-Do script** (word-for-word `[SAY]` lines, `[DO]`/`[TYPE]`/`[BOARD]`/`[PAUSE]`/`[WORK TIME]` markers, inline cross-question callouts, mistake-first structure throughout), not an outline. Every prompt below reflects both v1.2 changes.

---

## P1 — Initial invocation (kick off the skill)

```
I'm preparing for [N] semester(s) and need a chronological study plan.

**Syllabus files (paste or attach):**
- [path or paste]
- [path or paste]

**Semesters / tracks:**
- Sem 3: [track name, e.g., "AI Essentials on Azure"]
- Sem 5: [track name 1], [track name 2]

**Industry overlays to weave in:** [Azure / AWS / GCP / Databricks / Snowflake / none]

**My tools:** [Wacom + Excalidraw / VSCode / JupyterLab / OBS / etc.]

**Pacing:** [N] days × [N] hours/day

**Special asks:**
- [Combine Sem 3 & Sem 5 when topics overlap, separate otherwise]
- [Add Wacom/Excalidraw whiteboard exercises]
- [Add live coding sessions]
- [Add memory recall layer (Feynman + active recall + Anki cards)]
- [Currency check against retirements/renames as of [today's date]]

Start by extracting both syllabi, propose the folder structure, then generate
Day 1 for all tracks for sign-off. Do NOT generate Days 2-8 until I approve
the Day 1 pattern.
```

---

## P2 — Day 1 generation (the pilot)

```
Generate Day 1 for all 3 tracks. Constraints:

**Inputs:**
- Day 1 syllabus: [paste from your syllabus]
- Shared content pool: [list of `shared/*.md` files]
- Industry overlay: [Azure Foundry / etc.]
- Today's date: [for currency checks]
- Reference Day 1 companion files (study these first — all inside day1/):
  - `sem3/day1/whiteboard_day01.md` (Wacom + Excalidraw format, ~150 lines)
  - `sem3/day1/live_coding_day01.md` (rehearsal/prep copy — the authoritative word-for-word version lives inside instructor_script.md itself, ~150 lines)
  - `sem3/day1/memory_recall_day01.md` (5-exercise format, ~150 lines)
  - `sem5_azure_ai/day1/whiteboard_day01.md`, `live_coding_day01.md`, `memory_recall_day01.md` (Azure-aware variants)

**Output per track (all files live together inside `day1/` — 11 files per track for Day 1):**
- `sem3/day1/quicklearn.md, deepdive.md, instructor_script.md, printable_handout.md, external_resources.md, student_guide_day01.md, lab/, assets/` (core 7-artifact set + student guide)
- `sem3/day1/whiteboard_day01.md` (Wacom + Excalidraw, 15 min)
- `sem3/day1/live_coding_day01.md` (rehearsal/prep for the live demo embedded in instructor_script.md)
- `sem3/day1/memory_recall_day01.md` (5 closed-book exercises, 25 min)
- Same pattern for `sem5_azure_ai/day1/` and `sem5_azure_cloud/day1/`
- `shared/<topic>.md` if Day 1 content overlaps

**Required structure per core file:**
1. Header with course code, day, date, [SHARED] tag if applicable
2. Learning objectives (5-7)
3. Quick learn (10 min read)
4. Deep dive (45 min read, 10-12 sections, runnable code)
5. Hands-on lab (60-90 min, 5 scripts)
6. Self-check quiz (8 questions with answers)
7. Printable handout (1-2 page A4)
8. MS Learn / external resources (Sem 5: badges; Sem 3: free resources)
9. **Instructor script — teleprompter/Say-Do format** (see below, not the old minute-by-minute outline)
10. Mermaid diagrams (5, rendered to SVG)

**`instructor_script.md` — teleprompter/Say-Do format (v1.2, mandatory):**
- A legend defining `[SAY]`/`[DO]`/`[TYPE]`/`[BOARD]`/`[PAUSE]`/`[WORK TIME]`/`⚠️ LIKELY CROSS-Q`
- A one-sentence "spine" for the day, stated near the top and echoed at the close
- A timing map table, then a **continuous running clock** (0:00 at day start, not reset per hour)
- Every major concept taught **mistake-first**: realistic wrong version shown live → diagnosed → corrected — never lead with the right version
- `[WORK TIME]` blocks framed going in and debriefed coming out, not scripted word-for-word
- `⚠️ LIKELY CROSS-Q` callouts placed inline at the point they'd realistically come up
- Emergency Recovery + Optional Beats appendices at the end
- If the `mistake-first-demo-script` skill is available in your environment, use it directly for this step

**Required structure per companion file (in `day1/`, alongside the core files):**
- `whiteboard_day01.md`: Setup (1 min) + 3 exercises × 5 min each (skeleton → labels → annotations → failure modes → save) + wrap-up
- `live_coding_day01.md`: rehearsal/prep version — Pre-flight (5 min) + 0:00→30:00 timeline in 5-min blocks with narration + code + **intentional bug fix at ~18:00** + files produced + what to do after. Note: the authoritative word-for-word version of this session is embedded directly in `instructor_script.md` at the point in the day it happens — don't let the two drift apart.
- `memory_recall_day01.md`: 5 exercises × 5 min (recreate diagram / re-code / recite 5 facts / Feynman audio / tradeoffs table) + wrap-up scoring rubric

**Stop conditions:**
- Never split a day file mid-section
- Stop at ~70% of context; emit handoff block
- Mark any retired/renamed services with `⚠️ DRIFT`

After Day 1 is approved, replicate the pattern to Days 0, 2-8.
```

---

## P3 — Sub-agent delegation (per day, per track)

```
You are a sub-agent generating Day [N] for [track] in the [course] plan.

**Inputs (read these files first):**
- `[output_root]/SPEC.md` — the deliverable contract
- `[output_root]/shared/` — list of files to REFERENCE (not regenerate)
- `[syllabus_file]` — extract Day [N] topic + subtopics
- `[output_root]/sem[3|5]_<track>/day[N-1]/` — what came before
- **Reference Day 1 companion files** (study these first for format — all inside `day1/`):
  - `sem3/day1/whiteboard_day01.md`, `live_coding_day01.md`, `memory_recall_day01.md` (or `sem5_azure_ai/day1/` equivalents)
  - `sem3/day1/instructor_script.md` — study this for the teleprompter/Say-Do format itself, not just the companion files
  - These are the canonical formats. Match them exactly.

**Output location:** ONE folder — `[output_root]/sem[3|5]_<track>/day[N]/`. As of v1.2, everything about Day [N] lives together; there is no separate track-root layer to also write to.

**In `[output_root]/sem[3|5]_<track>/day[N]/` (11 files total):**

Core 7-artifact set:
1. README.md (file map + how to use)
2. quicklearn.md (10 min read, 8 Q quiz)
3. deepdive.md (400-600 lines, 10-12 sections, runnable code)
4. instructor_script.md — **teleprompter/Say-Do format** (see P2 above for the full spec; length follows content, not a fixed line count)
5. printable_handout.md (1-2 page A4)
6. mslearn_badges.md (Sem 5) OR external_resources.md (Sem 3)
7. lab/ (5-6 runnable scripts) + assets/ (5 Mermaid + 5 SVG)

Student guide + companion files (v1.2 — same folder as above, not track root):
8. student_guide_day[N].md
9. whiteboard_day[N].md (Wacom + Excalidraw, 15 min, 3 exercises × 5 min)
10. live_coding_day[N].md (rehearsal/prep copy — authoritative version is embedded in instructor_script.md)
11. memory_recall_day[N].md (5 closed-book exercises, 25 min)

**Quality bar:**
- All code runs in a fresh venv
- All Mermaid renders without errors
- All MS Learn URLs return 200 OK
- Cross-references to other days use the day number
- No TODO/placeholder text
- **Companion files match the reference Day 1 format exactly** (voice, structure, time budgets, the ~18:00 intentional bug fix pattern)
- **instructor_script.md matches the reference Day 1 teleprompter format exactly** (legend, running clock, mistake-first structure, inline cross-Qs, both appendices) — this is graded separately from the companion-files check, see validation-checklist.md

**Stop conditions:**
- Stop at ~70% of context
- Emit `=== STATE HANDOFF ===` block at the end
- Never split a file mid-section
- Report back: list of 11 files created (all in `day[N]/`) + any deviations
```

---

## P4 — Mermaid diagram generation

```
For Day [N], topic "[topic]", produce 5 Mermaid diagrams:

1. **System architecture** (graph TB) — components + their relationships
2. **Data flow** (graph LR) — request/response or pipeline
3. **Sequence** (sequenceDiagram) — actors + interactions over time
4. **State machine** (stateDiagram-v2) — if applicable, else skip
5. **Comparison** (graph TB) — vs 2-3 alternatives, pros/cons

Save each as `assets/0[N]_*.mmd` then render to SVG using
`mcp__matrix__render_mermaid_to_image` (or `mmdc` / mermaid-cli if that MCP
tool isn't available — verify the render actually succeeds either way).
List all 5 in `assets/README.md`.
```

---

## P5 — Memory recall layer (per day, per track)

> **v1.1 update (superseded):** The Anki-card section was removed in favor of the 5-exercise structure below (higher retention, lower friction).
> **v1.2 update (current):** Save as `memory_recall_day[N].md` inside `day[N]/`, not the track root.

```
For Day [N] of [track], produce `memory_recall_day[N].md` inside `day[N]/`.

**Time budget:** 25 minutes (5 exercises × 5 min)

**Exercise 1: Recreate one key diagram (5 min)**
- What to do: open blank Excalidraw or paper
- The answer: [3-region diagram from the day, with example dots in each region]
- Score yourself: did you get the 3 names + 3 examples?

**Exercise 2: Write the key code from memory (5 min)**
- What to do: open blank .py file
- The answer: [full working code block for the day's main artifact]
- Run it. Does it work?

**Exercise 3: Recite 5 key formulas/concepts (5 min)**
- Without looking, write these 5 on paper
- The answers: [5 formulas with brief explanation]

**Exercise 4: Feynman check (5 min)**
- Record yourself (audio only is fine) answering 3 questions
- Target answers: [3 questions, each with 1-3 sentence target answer in plain English, no jargon]

**Exercise 5: Tradeoffs/comparison table (5 min)**
- Without looking, list 3 pros and 3 cons of [X] vs [Y]
- Target answer: [comparison table with 5-6 dimensions]

**Wrap-up:**
- Scoring rubric (5/5, 3-4/5, 0-2/5 → what to re-do)
- The most important exercise is always #4 (Feynman)
- Next step pointer (e.g., "Day N+1 covers...")
```

**Reference format:** Read `sem3/day1/memory_recall_day01.md` (~150 lines) before generating. Match the voice, depth, and structure exactly.

---

## P6 — Live coding session script (per day, per track)

> **v1.1 update (superseded):** Saved as `live_coding_day[N].md` in the track root.
> **v1.2 update (current):** Save the rehearsal/prep copy as `live_coding_day[N].md` inside `day[N]/`. The authoritative, word-for-word version of this session lives **inside `instructor_script.md` itself**, at the point in the day's running clock where it happens — write that version first (see P2/P3), then derive this file as a shorter prep/rehearsal reference that points back to it. Mandatory for every day in every track.

```
Generate `live_coding_day[N].md` — a rehearsal/prep reference for a ~20-30 min
live-coding/demo session on Day [N]'s main topic. Save inside `day[N]/`
(e.g., `sem3/day5/live_coding_day05.md`). Cross-reference the authoritative
word-for-word version in `instructor_script.md`'s relevant Part.

**Format:**
- Pre-flight (5 min before the session) — tools/windows open, dataset loaded, terminal/venv ready
- A timeline in 5-min blocks with narration + code — condensed from instructor_script.md, not a full duplicate
- **CRITICAL: 1 intentional bug**, realistically placed (not necessarily exactly minute 18 — place it where it's pedagogically natural for this topic), then diagnosed and fixed on screen
  - Talk through WHY before HOW
  - Show debugging (the real diagnostic steps for this domain — pdb/breakpoints for code, cell inspection for spreadsheets, query plans for databases, whatever fits)
- Recap and preview next day

**Output:**
- Recording saved to `recordings/day[N]_<track>_<topic>.mp4` if the session is actually recorded (self-paced context) — otherwise omit if this is read live by an instructor per instructor_script.md
- This prep file saved to `live_coding_day[N].md` inside `day[N]/`
- Any code/artifacts produced saved to `lab-repo/day[N]_<topic>_live.*` or similar

**Reference format:** Read `sem3/day1/live_coding_day01.md` and `sem3/day1/instructor_script.md`'s corresponding Part before generating. Match the voice, structure, and the intentional-bug-fix pattern exactly.
```

---

## P7 — Wacom + Excalidraw whiteboard exercise (per day, per track)

> **v1.1 update (superseded):** Saved as `whiteboard_day[N].md` in the track root.
> **v1.2 update (current):** Save as `whiteboard_day[N].md` inside `day[N]/`, not the track root. Mandatory for every day in every track.

```
Generate `whiteboard_day[N].md` — a 15-min Excalidraw session
on Day [N]'s main concept. Save inside `day[N]/` (e.g., `sem3/day5/whiteboard_day05.md`).

**Time budget:** 15 minutes (3 exercises × 5 min)

**Setup (1 min):**
- Wacom tablet connected, pen calibrated
- Excalidraw open at https://excalidraw.com
- New scene: `day[N]_<topic>.excalidraw`
- Enable "Dynamic stroke width" (so pressure = thickness)
- Enable "Palm rejection" on Wacom (rest hand on tablet)

**Exercise 1 (5 min):** The main concept diagram
- Step 1 (2 min): Skeleton (boxes + arrows, no labels)
- Step 2 (1 min): Add labels
- Step 3 (1 min): Add example dots / data flow
- Step 4 (1 min): Add "where am I in this?" annotation
- Save: `assets/whiteboards/day[N]_exercise1.excalidraw` + `.png`

**Exercise 2 (5 min):** A second diagram (architecture, equation, comparison)
- Same 4-step pattern
- Save: `assets/whiteboards/day[N]_exercise2.excalidraw` + `.png`

**Exercise 3 (5 min):** A failure-mode diagram (what could go wrong?)
- 6 boxes representing stages / components
- Red X on each, with the failure mode annotated
- Save: `assets/whiteboards/day[N]_exercise3.excalidraw` + `.png`

**Wrap-up (1 min):**
- Why drawing matters for memory (deciding what to include, distinctive hand-drawn aesthetic, JSON editability for Day 8 redraw)
- Files produced: list all 6 files (3 .excalidraw + 3 .png)
- Daily 5-min recall: tomorrow morning, re-draw from memory

**Reference format:** Read `sem3/day1/whiteboard_day01.md` or `sem5_azure_ai/day1/whiteboard_day01.md` before generating. Match the voice, structure, and exercise count exactly.
```

---

## P8 — Currency check (run before every generation)

```
For the [Azure / AWS / GCP] cert/track I'm planning, check:

1. Has [cert name] been retired? (search official cert retirement page)
2. Have any services been renamed in the last [6 months]?
3. Are any SDKs deprecated? (check PyPI/npm latest version)
4. Have any UI portals moved? (check the URL still works)
5. What's the current exam pricing and exam code?

Today's date: [YYYY-MM-DD]

Output: a 1-page `currency_check.md` with all ✅/⚠️/❌ flags.
If anything is ❌ (retired), pivot to the live alternative.

**Note:** any claim that will be spoken aloud in an instructor_script.md's
[SAY] lines gets this same verification bar — a script read word-for-word
to a room is not the place for an unverified assumption.
```

---

## P9 — Final sign-off checklist (8-point gate)

> **v1.1 update (superseded):** Included the companion files check as point 7 of 7.
> **v1.2 update (current):** Companion files now checked inside `day{N}/`, not track root, and a new point 8 checks the teleprompter format.

```
Before declaring the study plan done, verify:

[ ] All 3 tracks have 9 day folders (day0, day1, ..., day8) = 27 day folders
[ ] All 7 core artifacts exist per day per track inside day{N}/ = 7 × 27 = 189 files
[ ] **All 3 companion files + the student guide exist per day per track, INSIDE day{N}/ (not track root) = 4 × 9 × 3 = 108 files (v1.2)**
    - For each track, each day{N}/: whiteboard_dayNN.md, live_coding_dayNN.md, memory_recall_dayNN.md, student_guide_dayNN.md
    - All 108 files exist, in the right folder
    - All match the reference Day 1 format (voice, structure, ~18:00-ish bug fix in live coding)
[ ] **Every instructor_script.md is a teleprompter/Say-Do script (v1.2, new)** — legend, running clock, mistake-first structure, inline cross-Qs, Emergency Recovery + Optional Beats appendices — not an outline
[ ] All `lab/*.py` files run end-to-end (no exceptions)
[ ] All Mermaid diagrams render to SVG without errors
[ ] All MS Learn URLs return 200 OK
[ ] No "TODO" or "..." placeholders in any file
[ ] `chronological_study_plan.md` merges all tracks into one view
[ ] `STATE_HANDOFF.md` is current and complete
[ ] `pedagogy-guide.md` covers the actual pacing used (6-hour or instructor-led 4-hour variant), 50/50 split, breaks
[ ] `student-learning-guide.md` (or `faculty-learning-guide.md` for instructor-led programs) describes how the companion files get used
[ ] Currency notes include any retirements/renames

**Per 3-track × 9-day plan total: ~300+ files (189 core + 108 companion/participant-guide, all nested inside day{N}/).**

If any item fails, fix in place. Do not declare done.
```
