# Skill: Syllabus-to-Study-Plan Generator

**Version:** 1.2
**Author:** MiniMax Agent (v1.0–v1.1); updated by Claude (v1.2) from a real-world instructor-led delivery
**Purpose:** Turn any university syllabus (1 or many semesters, with optional industry track overlays like Azure / AWS / GCP) into a chronological, day-by-day preparation plan with reusable artifacts.

> **One-line summary:** Hand me a syllabus → I return a complete study plan with code, slides, diagrams, practice questions, **Wacom+Excalidraw whiteboard exercises per day, a teleprompter-style live-coding/instructor script per day, and memory recall exercises per day**, plus cross-semester overlap detection.

**Versioning notes:**
- v1.0 (initial): 7-artifact set per day per track
- v1.1: Added the **3 companion files per day per track** (whiteboard + live coding + memory recall), placed in the *track root*, now the standard. For a 3-track × 8-day plan, that's **9 days × 3 file types × 3 tracks = 81 companion files** in addition to the original 7-artifact set.
- **v1.2 (current):** Two changes, both learned from a real single-track instructor-led delivery (an FDP — faculty development program — 5 days × 4 hrs/day):
  1. **Companion files (+ the per-day participant/student guide) now live inside `day{N}/` itself**, not the track root — see Step 3 and Step 4a. This is the new default; revert to track-root placement only if a specific run is genuinely multi-track and the track-level file list benefits from sorting next to companion files at that level (see the note in Step 4a).
  2. **`instructor_script.md` is now a teleprompter/Say-Do script, not a facilitation outline** — see the new Step 4b. Modeled on a real presenter script (word-for-word `[SAY]` lines, `[DO]`/`[TYPE]`/`[BOARD]`/`[PAUSE]` markers, `⚠️ LIKELY CROSS-Q` callouts, every concept taught mistake-first) and built using the `mistake-first-demo-script` skill's methodology, if that skill is available in the environment generating the plan.

---

## 1. When to use this skill

Trigger this skill when the user provides:
- A university course syllabus (PDF, DOCX, XLSX, or pasted text)
- 1 or more semesters to plan for
- An optional industry platform to weave in (Azure, AWS, GCP, Databricks, Snowflake, etc.)
- An optional list of tools/equipment the user has (Wacom, Excalidraw, IDE, etc.)

The output is a complete study plan that is:
- Chronological (Day 1 → Day N)
- Track-aware (Sem 3 vs Sem 5 separated when deliverables differ, combined when they overlap)
- Artifact-rich (code, slides, diagrams, quizzes, printable cards)
- Reusable (shared content deduplicated, cross-referenced)

---

## 2. Inputs

| Input | Required? | Format | Example |
|---|---|---|---|
| Syllabus file(s) | Yes | `.pdf`, `.docx`, `.xlsx`, or pasted markdown table | `University 3rd Sem Plan.xlsx` |
| Number of semesters | Yes | integer | `2` (Sem 3 + Sem 5) |
| Track names per semester | Yes | list | `["AI Essentials", "Azure AI", "Azure Cloud + Full Stack"]` |
| Industry overlay(s) | No | list of platforms | `["Microsoft Azure", "Microsoft Foundry"]` |
| Hours per day | No (default 6) | integer | `6` |
| Total days | No (default 8) | integer | `8` |
| User's tools | No | list | `["Wacom", "Excalidraw", "VSCode"]` |
| Live coding preference | No | bool | `true` |
| Today date | Yes (for currency checks) | ISO date | `2026-07-29` |

---

## 3. Process (the recipe)

### Step 1 — Extract the syllabus
1. Read the file(s) with `extract_pdfs_key_info`, `extract_pdfs_full_content`, or Read on DOCX/XLSX.
2. Output a flat topic list: `[{ day: 1, topic: "...", subtopics: [...] }, ...]` per track.
3. Identify "shared topics" — same/similar topic appearing in multiple semesters.
4. Flag the syllabus structure: weeks vs days vs modules.

### Step 2 — Cross-reference against industry platform(s)
1. Web search the official learning path for each platform overlay (e.g., `Microsoft Learn → AI-102`).
2. Map each syllabus topic to the equivalent industry module.
3. Use `mcp__matrix__batch_web_search` to cross-check current exam/cert retirement status.
4. **Currency check:** if a cert or service is retired/renamed, flag with `⚠️ DRIFT` and use the live API/portal as source of truth.

### Step 3 — Design the folder structure
```
<output_root>/
├── README.md                     ← file map + currency notes
├── COURSE-MAP.md                 ← day-by-day topic matrix
├── SPEC.md                       ← deliverable spec for sub-agents
├── shared/                       ← content shared between tracks (deduplicated)
│   └── <topic>.md
├── sem<N>_<track_slug>/          ← one folder per track (omit this level entirely for a single-track program — see SPEC.md's own adaptations section)
│   └── day<M>/                   ← v1.2: EVERY file about day M lives here — see Step 4 + Step 4a
│       ├── quicklearn.md, deepdive.md, instructor_script.md, printable_handout.md, resources.md/mslearn_badges.md
│       ├── student_guide_dayNN.md, whiteboard_dayNN.md, live_coding_dayNN.md, memory_recall_dayNN.md   ← v1.2: moved in here, was track root in v1.1
│       ├── lab/
│       └── assets/
├── chronological_study_plan.md   ← the merged day-by-day plan
├── downloadable_assets/          ← code, Bicep, notebooks
├── printable_materials/          ← 1-2 page reference cards
├── screenshots/                  ← screenshot placeholders
├── instructor_notes/             ← teaching guidance
└── exam_mock_<cert>.md           ← mock exam (if cert-aligned)
```

### Step 4 — Generate per-day content (the 7-artifact set)
For every day in every track, produce:

| # | Artifact | Length | Format | Purpose |
|---|---|---|---|---|
| 1 | `quicklearn.md` | ~80 lines | md | Read in 10 min. 5 things to know + 8-question diagnostic |
| 2 | `deepdive.md` | 400-600 lines | md | 80/20 from-scratch tutorial with runnable code |
| 3 | `instructor_script.md` | Length follows content (see Step 4b) | md | **Teleprompter/Say-Do script** (v1.2), not an outline — minute-by-minute (running clock, not reset per hour), every concept taught mistake-first, 3+ named activities |
| 4 | `printable_handout.md` | ~120 lines | md | 2-sided A4 cheat card |
| 5 | `mslearn_badges.md` (Sem 5) or `external_resources.md` (Sem 3) | ~120 lines | md | Pre-class reading + badge links |
| 6 | `lab/` | 5-6 files | .py / .bicep / .sh | Runnable code, 30-90 min each |
| 7 | `assets/` | 5 diagrams | .mmd + .svg | Mermaid diagrams rendered to SVG |

### Step 4a — Generate the 3 companion files per day per track (mandatory since v1.1)

For every day in every track, in addition to the 7-artifact set above, generate these 3 companion files **inside that day's own subfolder** (v1.2 — see "Where they live" below for the v1.1→v1.2 change):

| # | Companion file | Length | Time to use | What it does |
|---|---|---|---|---|
| 8 | `whiteboard_dayNN.md` | ~150 lines | 15 min (3 × 5) | Wacom + Excalidraw: 3 hand-drawn diagrams saved as `.excalidraw` + `.png` |
| 9 | `live_coding_dayNN.md` | ~160 lines | 30 min (OBS recording) | Recorded coding session script with intentional bug fix at ~18:00 |
| 10 | `memory_recall_dayNN.md` | ~150 lines | 25 min (5 × 5) | 5 closed-book recall exercises (diagram / code / recite / Feynman / tradeoffs) |

**Naming convention** (zero-padded day number):
- Day 0 (triage primer) → `whiteboard_day00.md`, `live_coding_day00.md`, `memory_recall_day00.md`
- Day 1 → `whiteboard_day01.md`, etc.
- Day 8 (capstone) → `whiteboard_day08.md`, etc.

**Where they live (v1.2 — changed from v1.1):** Inside the day's own subfolder (e.g., `sem3/day3/whiteboard_day03.md`), alongside that day's `student_guide_dayNN.md`, `deepdive.md`, and the rest of the 7-artifact set. **v1.1 placed these in the track root instead** (`sem3/whiteboard_day03.md`, one level up from `day3/`) — that convention is superseded. Rationale for the v1.2 change: a real delivery of this skill found that keeping every file about a single day in one folder is simpler to navigate, easier to hand to a sub-agent as a self-contained unit, and easier to zip/share as one thing. **When track-root placement might still be right:** if a run has many tracks and the track-level file listing genuinely benefits from every day's companion files sorting together at that level (rather than nested per-day) — this is now the exception, not the default; note explicitly in that run's `SPEC.md` if you choose it.

**Why mandatory:** Without these, the 90-minute learning block (described in `student-learning-guide.md`) has no whiteboard/live-coding/recall prompts. The student falls back on reading-only, which has ~20% retention. With the companion files, retention jumps to ~70% in 1 week.

**Day 0 special case:** If a track doesn't have a `day0/` subfolder (only `day1/`...`day8/`), generate the Day 0 companion files from the most-related track's Day 0 content (e.g., sem5_azure_ai Day 0 whiteboard references the sem3 Day 0 quicklearn but reframes the 4 triage checks for an Azure-AI audience: subscription, `az login`, Python venv, pip packages).

### Step 4b — Generate `instructor_script.md` as a teleprompter/Say-Do script (mandatory since v1.2)

`instructor_script.md` (artifact #3 in Step 4) is not a bullet-point facilitation outline — it is a script the instructor reads from live, word-for-word, the way a presenter reads a teleprompter. This changed in v1.2 after a real delivery of this skill produced an outline-style script first, then was asked to convert it to match a real presenter's teleprompter script — and the teleprompter version is now the default for every future run, not an on-request upgrade.

**Required structure** (see `references/say-do-format.md` in the `mistake-first-demo-script` skill if it's available in the generating environment, or replicate the pattern described here):

1. **A legend** at the top defining every marker: `[SAY]` (word-for-word, ~110–130 wpm — slower for adult/professional audiences than for students), `[DO]` (a physical action), `[TYPE]` (a prompt/formula/code to enter live), `[BOARD]` (a diagram reference), `[PAUSE]` (a genuine stop for questions), `[WORK TIME]` (unscripted independent/paired work), `⚠️ LIKELY CROSS-Q` (a realistic question + a spoken answer).
2. **A one-sentence "spine"** — the single idea the whole day ladders up to, stated once near the top, echoed at the close.
3. **A timing map table** at the top — parts, topics, clock ranges — independent of and checkable against the detailed script below it.
4. **A continuous running clock** (0:00 at the day's start, not reset per hour/part).
5. **Every major concept taught mistake-first**: the realistic wrong version happens live (typed, run, shown) — diagnosed and corrected only after. Never lead with the correct version. This is the same pattern as `faulty-first-instructions/SKILL.md` in this bundle, applied to a live/spoken script instead of a written tutorial.
6. **`[WORK TIME]` blocks are not written word-for-word** — script the framing going in and the debrief coming out; note what to circulate/watch for in between, not a transcript of independent work.
7. **`⚠️ LIKELY CROSS-Q` callouts inline**, at the point in the script where that question is likely to actually come up — not deferred to a separate bank the presenter has to context-switch to mid-flow.
8. **Two closing appendices:** **Emergency Recovery** (symptom → fast fix, for when a live demo doesn't cooperate) and **Optional Beats** (extra content, explicitly marked as outside the core time budget).
9. **Every `[TYPE]` block should be tested where testable** (e.g., standalone code run in a real environment) — where it genuinely can't be tested ahead of time (live third-party UI behavior), say so explicitly in the script's own prep notes rather than presenting untested behavior as certain.
10. **Show the pacing arithmetic, don't just assert it** — sum each part/hour's internal timed blocks explicitly before finalizing. (A real run of this skill shipped a 70-vs-60-minute pacing bug in an outline-style draft that this explicit-sum check would have caught immediately.)

**Companion file relationship:** `live_coding_dayNN.md` (Step 4a, companion file #9) still exists as a shorter rehearsal/prep document — but the *authoritative*, word-for-word version of any live-coding/demo moment now lives inside `instructor_script.md` itself, at the point in the running clock where it happens. Don't duplicate full word-for-word content in both places; `live_coding_dayNN.md` can summarize and point back ("see `instructor_script.md` Part 3.2 for the full word-for-word version").

### Step 5 — Detect and tag shared content
When a topic appears in 2+ tracks, place it in `shared/` and reference (do not regenerate). Add a `[SHARED]` tag at the top of each referencing section.

### Step 6 — Build the chronological merged plan
- Walk through days. For each day, decide: are Sem 3 and Sem 5 topics **the same** (combine) or **different** (separate)?
- If **same** → single combined file in `shared/`
- If **different** → separate files but in same `chronological_study_plan.md` row, linked

### Step 7 — Add validation gates
Before declaring done, run the **8-point checklist** (see `validation-checklist.md`):
- [ ] All 7 core artifacts exist per day per track (in `day{N}/` subfolder)
- [ ] **All 3 companion files + the student/participant guide exist per day per track, inside `day{N}/` — location changed in v1.2 (was track root in v1.1)**
- [ ] `instructor_script.md` is a teleprompter/Say-Do script (Step 4b), not an outline — **new gate in v1.2**
- [ ] Every `lab/*.py` runs end-to-end in a fresh env
- [ ] All Mermaid diagrams render via `mcp__matrix__render_mermaid_to_image`
- [ ] All MS Learn badge URLs are live
- [ ] Currency notes include any retired/renamed services
- [ ] No "TODO" / placeholder text

### Step 8 — Add the Wacom + Excalidraw + Live Coding layer (now mandatory, see Step 4a)
If the user has these tools, generate for each day in each track:
- A `whiteboard_dayNN.md` file (3-5 min × 3 exercises on Excalidraw, 15 min total) — lives inside `day{N}/` (v1.2; was track root in v1.1)
- A `live_coding_dayNN.md` file (30 min recorded session on the day's main topic, with intentional bug fix at ~18:00) — lives inside `day{N}/` (v1.2; was track root in v1.1); the authoritative word-for-word version of this session is embedded directly in `instructor_script.md` (Step 4b) at the point in the day it happens
- Save the .excalidraw file alongside `assets/`
- Save the recording MP4 in `recordings/dayNN_*.mp4`

> **v1.0 → v1.1 change:** In v1.0 this was an optional layer. In v1.1 it is **mandatory** for every day. The companion files are what enable the 90-minute learning block in `student-learning-guide.md`.
> **v1.1 → v1.2 change:** Location moved from track root into `day{N}/` — see Step 4a.

### Step 9 — Add memory & recall layer (now mandatory, see Step 4a)
Generate per day, per track, inside `day{N}/` (v1.2; was track root in v1.1):
- A `memory_recall_dayNN.md` file with 5 closed-book exercises (25 min total):
  - Exercise 1: Recreate one key diagram from the day
  - Exercise 2: Write the key code from memory
  - Exercise 3: Recite 5 key formulas/concepts
  - Exercise 4: Feynman check (3 questions, audio-recorded answer)
  - Exercise 5: Tradeoffs/comparison table

> **v1.0 → v1.1 change:** In v1.0 this was an optional layer with Anki cards. In v1.1 it is **mandatory** for every day and replaces the Anki format (which was too much friction) with the 5-exercise structure that mirrors the reference Day 1 file in `sem3/memory_recall_day01.md`.
> **v1.1 → v1.2 change:** Location moved from track root into `day{N}/` — see Step 4a.

### Step 10 — Emit handoff
At the end of generation, write a `STATE_HANDOFF.md` so the next session (or sub-agent) can resume without losing context.

---

## 4. Output contract

When this skill is invoked, the deliverable is **always** a folder with the structure in Step 3, plus a top-level `README.md` that explains the file map.

**Mandatory top-level files (6):**
1. `README.md` — file map + currency warnings + day status table
2. `COURSE-MAP.md` — day-by-day topic matrix
3. `SPEC.md` — deliverable spec (so sub-agents can replicate)
4. `chronological_study_plan.md` — the merged day-by-day plan
5. `pedagogy-guide.md` — teaching/learning techniques
6. `STATE_HANDOFF.md` — resume-from-here block

**Optional per-user:**
- `wacom-excalidraw-prompts.md` — if user has Wacom
- `live-coding-sessions.md` — if user wants live coding
- `memory-recall-deck.md` — Anki-style cards for each day

---

## 5. Reusable prompt templates

### Prompt A — Skill invocation
```
I have [N] semester(s) of syllabus at [paths]. I want a chronological
study plan that:
- [separates/combines] Sem 3 and Sem 5 when topics differ/match
- weaves in [industry overlay] topics where they overlap
- produces the 7-artifact set per day
- respects my tools: [tools]
- targets [hours]/day, [days] total

Use the Syllabus-to-Study-Plan skill. Start by extracting both syllabi,
then propose the folder structure and Day 1 content for sign-off.
```

### Prompt B — Per-day generation (for sub-agents)
```
You are generating Day [N] for [track name] in the [course name] study
plan. Inputs:
- Day spec: [paste the day's topic + subtopics from the syllabus]
- Industry overlay: [Azure / AWS / GCP]
- Shared content: [list of `shared/*.md` files to reference, not regenerate]
- Lab patterns: [PyTorch / Azure SDK / Bicep]
- Currency flag: [any retired/renamed services to avoid]

Output: the 7-artifact set in the folder structure defined in
[this repo's SPEC.md]. Do not split a day file mid-section. Stop at
~70% of context and emit a handoff block.
```

### Prompt C — Diagram generation
```
For the topic "[topic]", produce 5 Mermaid diagrams that explain:
1. High-level system architecture
2. Data flow / pipeline
3. Component interaction (sequence)
4. State machine (if applicable)
5. Comparison vs alternatives

Save as `assets/0[1-5]_*.mmd` then render to SVG. List all 5 in
`assets/README.md`.
```

### Prompt D — Memory recall layer
```
For Day [N] of [track name], produce:
- 5 "recreate from memory" exercises (mix of: draw a diagram, write a
  code snippet, recite an API call, explain a concept, list 5 pros/cons)
- 10 Anki-style spaced repetition cards (Q/A format, 1 fact per card)
- 3 Feynman questions (answer as if teaching a 5-year-old)
Save as `memory_recall_day[N].md`.
```

---

## 6. Worked example (from this run)

**Input:**
- `University 3rd Sem Plan.xlsx` (AI Essentials track)
- `University Training Sem 5 Syllabus.xlsx` (2 tracks: Azure AI, Azure Cloud + Full Stack)
- Industry overlay: Microsoft Azure / Microsoft Foundry
- User tools: Wacom, Excalidraw, VSCode
- Hours/day: 6, Days: 8

**Output structure produced (this run):**
```
azure-combined-track/
├── README.md                                  ← file map + currency notes
├── COURSE-MAP.md                              ← 8-day topic matrix
├── SPEC.md                                    ← deliverable spec
├── chronological_study_plan.md                ← merged day-by-day
├── pedagogy-guide.md                          ← teaching/learning techniques
├── student-learning-guide.md                  ← 90-min block + 4 techniques
├── exam_mock_ai102.md                         ← mock exam
├── shared/
│   ├── azure_ml_basics_intro.md
│   ├── ml-math-primer.md
│   ├── azure-foundry-2026-cheatsheet.md
│   └── mslearn-badges-master.md
├── sem3/                                      ← Sem 3 AI Essentials
│   ├── day01_foundations_ai_ml.md             ← Day 1 detailed lesson
│   ├── student_guide_day01.md ... day08.md    ← per-day quick-reference (8 files)
│   ├── whiteboard_day00.md ... day08.md       ← Wacom+Excalidraw (9 files)
│   ├── live_coding_day00.md ... day08.md      ← OBS session script (9 files)
│   ├── memory_recall_day00.md ... day08.md    ← closed-book recall (9 files)
│   ├── day0/ day1/ day2/ ... day8/            ← full 7-artifact set per day
│   └── capstone/
├── sem5_azure_ai/                             ← same structure as sem3/
├── sem5_azure_cloud/                          ← same structure as sem3/
├── ppts/                                      ← PPT source (12 slides/day)
├── lab-repo/                                  ← cumulative lab repo
├── career-trajectory-bangalore.md             ← post-course job roadmap
├── career-trajectory-bangalore-no-degree.md   ← 2016 12th-pass variant
└── skill-template/                            ← THIS FILE (with all 5 docs)
    ├── SKILL.md
    ├── folder-template.md
    ├── prompt-library.md
    ├── validation-checklist.md
    └── examples/azure-combined-track/README.md
```

**Companion file coverage (v1.1 — as originally delivered):**
- 3 tracks × 9 days (Day 0-8) × 3 file types = **81 companion files** in track roots
- ~16,000 lines of whiteboard/live-coding/memory-recall content total
- Format: matches the reference Day 1 files exactly (3 × 5-min whiteboard exercises, 30-min live coding with intentional bug fix at ~18:00, 5 closed-book recall exercises)

> **Note:** this worked example predates v1.2 and is preserved as-delivered (companion files in track roots, `instructor_script.md` as an outline) rather than rewritten — it's historical record of what v1.1 actually produced. A v1.2 run of this same input would instead nest each track's companion files inside `day{N}/`, and would produce a teleprompter-style `instructor_script.md` per Step 4b. See the FDP-AI-for-educators delivery (a single-track, instructor-led run) for a worked v1.2 example if one has been added to `examples/` alongside this one.

**Key outcomes:**
- Day 1: 3 separate day files + 1 shared intro (because Sem 3 and Sem 5 have **different** deliverables for Day 1, but share the Azure ML primer)
- Days 2-7: same pattern — separate per track, shared content flagged
- Day 8: capstone + exam prep, all tracks converge
- **Day 0 (NEW in v1.1):** Foundations primer — Python, math, NumPy, Azure triage, no new material. Companion files generated for all 3 tracks.

---

## 7. Validation gate (before declaring done)

Run this **8-point checklist** (see `validation-checklist.md` for the full gate):

1. **Voice check:** Does `deepdive.md` teach from zero? (Read first 50 lines.)
2. **Pacing check:** Does `instructor_script.md` hit the target duration with 3+ named activities, and does the running clock's arithmetic actually sum correctly (compute it, don't eyeball it)?
3. **Fun check:** Is there at least 1 fun/kinesthetic activity per 90 min?
4. **Code check:** Does every `lab/*.py` run end-to-end in a fresh Python venv, and does every `[TYPE]` block in `instructor_script.md` match code that was actually tested?
5. **Badge check:** Are all MS Learn module URLs live? (curl -I, 200 OK)
6. **Diagram check:** Do all 5 Mermaid diagrams render without errors via `mcp__matrix__render_mermaid_to_image`?
7. **Companion files check:** Do all 3 companion files (`whiteboard_dayNN.md`, `live_coding_dayNN.md`, `memory_recall_dayNN.md`) plus the student/participant guide exist for every day in every track, **inside `day{N}/`** (v1.2 — was track root in v1.1)? Do they match the reference Day 1 format (5 min × 3 exercises for whiteboard, 30-min timeline for live coding with intentional bug fix at ~18:00, 5 closed-book exercises for memory recall)?
8. **Teleprompter format check (NEW v1.2):** Is `instructor_script.md` a word-for-word Say/Do script — legend, timing map, running clock, mistake-first structure throughout, inline cross-question callouts, Emergency Recovery + Optional Beats appendices — rather than a bullet-point outline?

If any check fails, fix in place before handoff. Do not declare done with failures.

---

## 8. Currency & drift handling

The #1 failure mode of this skill is **stale content** (retired certs, renamed services, deprecated SDKs). Mitigations:

1. **Always check today's date** against each industry certification retirement date.
2. **Use the REST API as source of truth**, not UI screenshots. UIs change weekly.
3. **Flag renames inline:** `⚠️ FOUNDRY DEVIATION` for Azure AI Studio → Microsoft Foundry, `⚠️ DEPRECATION` for retired APIs.
4. **Re-validate MS Learn URLs** before each generation. Microsoft rotates URLs ~2x/year.
5. **If a service is renamed**, keep the old name in `(parentheses)` for 1 generation cycle so users with muscle memory can find it.

---

## 9. Sub-agent delegation pattern

For Days 4-8 (after Day 1-3 is the "pilot"), parallelize:

```
[Day 4, Sem 3] ─┐
[Day 4, Sem 5 AI] ─┤
[Day 4, Sem 5 Cloud] ─┼─→ sub-agents in parallel (3-5 at a time)
[Day 5, ...] ─┤
[Day 5, ...] ─┤
```

Each sub-agent gets:
- The `SPEC.md` (so they know the deliverable contract)
- The day's topic + subtopics
- The list of `shared/` files to reference (not regenerate)
- A budget: ~70% of context, then stop and emit handoff

**Sequential dependencies** (must complete first):
- `SPEC.md` (before any day generation)
- `shared/` files (before track-specific day files that reference them)
- Day 1 (before Day 2 in the same track)

---

## 10. Quick-start (for the user)

To reuse this skill for your **next semester**:

1. **Prepare your inputs:**
   - Syllabus file (PDF/DOCX/XLSX) for the new semester
   - List of any topics that overlap with what you've already learned
   - Industry overlay (if any) — Azure, AWS, GCP, etc.
   - Your tools list (Wacom? Excalidraw? Specific IDE?)

2. **Invoke the skill** with Prompt A (above), pasting this template.

3. **Sign off on:**
   - Folder structure (one-time decision)
   - Day 1 content (validates the pattern)
   - Then auto-replicate for Days 2-N

4. **Validate** using the **8-point gate** (Section 7) before you start studying.

5. **Use the artifacts daily (the 90-minute learning block) — all of these now live together in `day{N}/`:**
   - Read `day{N}/student_guide_dayNN.md` (or `day{N}/quicklearn.md`) on the train (10 min)
   - Read `day{N}/student_guide_dayNN.md` §2 (key concepts, deep dive) (20 min)
   - Open `day{N}/whiteboard_dayNN.md` and draw on Excalidraw with Wacom (15 min)
   - Run `day{N}/lab/*.py` code (20 min)
   - Open `day{N}/live_coding_dayNN.md` and record yourself on OBS (30 min) — or, if you had an instructor read this session live from `instructor_script.md`, revisit that day's Part instead
   - Open `day{N}/memory_recall_dayNN.md` and do the 5 exercises from memory (25 min)

---

## 11. Files in this skill bundle

```
skill-template/
├── SKILL.md                          ← this file (the recipe, v1.2)
├── folder-template.md                ← copy-paste folder scaffold (updated for v1.2)
├── prompt-library.md                 ← all reusable prompts (P1-P9, updated for v1.2)
├── validation-checklist.md           ← 8-point gate (was 7, added teleprompter-format check)
├── faulty-first-instructions/        ← companion skill: mistake-first pattern for written tutorials
│   └── SKILL.md
└── examples/
    └── azure-combined-track/         ← the worked example from the v1.1 run (preserved as-delivered — see §6's note)
        └── README.md
```

**v1.1 changes summary (for history):**
- Added Step 4a (mandatory 3 companion files per day per track, placed in track root)
- Upgraded validation gate from 6 → 7 points
- Updated output contract, quick-start, and worked example to reflect the companion files
- Total deliverable per 3-track × 8-day plan: **81 companion files** (whiteboard + live coding + memory recall) in addition to the 7-artifact set

**v1.2 changes summary (current):**
- **Relocated** companion files + the student/participant guide from track root into `day{N}/` itself (Step 3, Step 4a) — learned from a real single-track instructor-led delivery where track-root placement added a navigation hop with no offsetting benefit
- **Added Step 4b**: `instructor_script.md` is now a mandatory teleprompter/Say-Do script (word-for-word `[SAY]` lines, `[DO]`/`[TYPE]`/`[BOARD]`/`[PAUSE]`/`[WORK TIME]` markers, inline `⚠️ LIKELY CROSS-Q`, mistake-first structure throughout, Emergency Recovery + Optional Beats appendices) — user-requested, modeled on a real presenter-script example, built using the `mistake-first-demo-script` skill's methodology where that skill is available
- Upgraded validation gate from 7 → 8 points (added the teleprompter-format check)
- Both changes were made directly in response to real usage feedback on a live run of this skill (not speculative) — this is the intended evolution path for this template: usage feedback becomes the next version's default, not an optional variant

**To reuse:** Copy this `skill-template/` folder, replace the syllabus input, and follow the recipe in §10. The companion files and the teleprompter-style instructor script are both part of the standard output now — not optional add-ons.
