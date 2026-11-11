# Worked Example — azure-combined-track

> **Historical note (v1.1-era, preserved as-delivered):** This worked example was produced under the **v1.1** convention — companion files in the **track root**, 3 file types (no participant guide), 81 total files, 7-point validation gate, `instructor_script.md` as an outline rather than a teleprompter script. It is kept exactly as delivered for accurate history and is **not** the current recommendation. As of **v1.2**, companion files (now 4 types, including the participant/student guide) live inside `day{N}/`, `instructor_script.md` is a teleprompter/Say-Do script, and the validation gate is 8-point. See `SKILL.md`'s versioning notes, `folder-template.md`, and `prompt-library.md` for the current (v1.2) pattern — don't copy the track-root layout or outline-style script below into a new run.

This folder is a pointer to the full worked example. The actual deliverables live one level up at `../../` (the parent of `skill-template/`).

## Pointer

The azure-combined-track example is the parent directory. Specifically:

```
../../
├── README.md                              ← see this for the file map
├── COURSE-MAP.md                          ← day-by-day matrix (with companion file column)
├── SPEC.md                                ← deliverable spec
├── chronological_study_plan.md            ← merged day-by-day plan
├── pedagogy-guide.md                      ← 6-hour pacing guide
├── student-learning-guide.md              ← 90-min block using companion files
├── exam_mock_ai102.md                     ← mock exam
├── shared/                                ← deduplicated content
├── sem3/                                  ← Sem 3 AI Essentials
│   ├── day01_*.md ... day08_*.md          ← 8 day-level summaries (track root)
│   ├── student_guide_day01.md ... day08.md← 8 per-day quick-reference (track root)
│   ├── whiteboard_day00.md ... day08.md   ← 9 companion files (track root, NEW v1.1)
│   ├── live_coding_day00.md ... day08.md  ← 9 companion files (track root, NEW v1.1)
│   ├── memory_recall_day00.md ... day08.md← 9 companion files (track root, NEW v1.1)
│   ├── day0/, day1/, ..., day8/           ← 9 day subfolders with 7-artifact set
│   ├── recordings/                        ← OBS live coding MP4s (NEW v1.1)
│   └── capstone/
├── sem5_azure_ai/                         ← Sem 5 Azure AI track (same structure)
├── sem5_azure_cloud/                      ← Sem 5 Cloud + Full Stack (same structure)
├── ppts/                                  ← PPT source
├── lab-repo/                              ← cumulative lab repo
├── career-trajectory_*.md                 ← post-course job roadmaps
└── skill-template/                        ← this skill bundle
```

## Companion file coverage (NEW in v1.1)

Every day in every track has **3 companion files** in the track root, in addition to the 7-artifact set in the day subfolder:

- **`whiteboard_dayNN.md`** — 15-min Wacom + Excalidraw session, 3 hand-drawn diagrams (skeleton → labels → annotations → failure modes).
- **`live_coding_dayNN.md`** — 30-min OBS-recorded build-along with an intentional bug fix at ~18:00.
- **`memory_recall_dayNN.md`** — 25-min closed-book recall, 5 exercises × 5 min each (recreate diagram / re-code / recite / Feynman / tradeoffs).

**Total: 81 companion files = 3 file types × 9 days × 3 tracks.** These are NOT optional — they turn the 90-minute self-study block from reading-only (~20% retention) into drawing + coding + recall (~70% retention).

## How this example informs the skill

The azure-combined-track plan was the pilot run that produced this skill template. Key learnings baked into the recipe:

1. **3 parallel tracks** (Sem 3 + 2 Sem 5) is the sweet spot for "student preparing for both semesters". More than 3 = too much to maintain in parallel.

2. **8 days × 6 hours** = 48 contact hours. This is enough to cover a full AI/ML curriculum from foundations to capstone without rushing. **Plus a Day 0 triage primer** to bring everyone to a common starting line — that makes it 9 days × 3 tracks = 27 day-units.

3. **The 7-artifact set** (quicklearn / deepdive / instructor script / handout / badges / lab / assets) emerged from iteration. Don't skip any of them.

4. **The 3-companion-file set** (whiteboard / live coding / memory recall) was added in v1.1 after seeing the 20% → 70% retention jump. The files live in the **track root** (paired with `student_guide_dayNN.md`), NOT inside the day subfolder.

5. **Shared content tagging** (`[SHARED]` in section headers) is critical. Without it, you regenerate the same Azure ML primer 3 times.

6. **Currency drift** is the #1 failure mode. AI-900 + AI-102 retired 30 June 2026, Azure AI Studio → Microsoft Foundry rename. Always run the currency check (P8) before generation.

7. **Sub-agent delegation** works well for Days 4-8 after Day 1-3 is the pilot. Each sub-agent gets the SPEC.md + a clear input/output contract + a budget. Companion files are best delegated **in parallel** with the day subfolder files, not sequentially.

## To re-run this exact example

```bash
# 1. Drop the two syllabus files into user_input_files/
cp /your/sem3.xlsx user_input_files/University\ 3rd\ Sem\ Plan\ .xlsx
cp /your/sem5.xlsx user_input_files/University\ Training\ Sem\ 5\ Syllabus.xlsx

# 2. Invoke the skill with Prompt P1 from prompt-library.md
# 3. Sign off on Day 1 (pilot — 10 files per track: 7 core + 3 companion)
# 4. Auto-replicate Days 0, 2-8 (delegated to sub-agents in parallel, 3 sub-agents × 9 days = 27 invocations)
# 5. Run validation-checklist.md (7-point gate, includes companion files check)
# 6. Print handouts, open Excalidraw, start Day 1
```

## Variations

To adapt this for **your** next semester, change only:
- The 2 syllabus files in `user_input_files/`
- The track names in `README.md` and `COURSE-MAP.md`
- The industry overlay (swap Azure → AWS / GCP / Databricks)
- The day count (8 is the default, can be 5-15; Day 0 triage primer is optional)

Everything else (folder structure, naming, 7-artifact set, 3-companion-file set, 7-point validation gate) is reusable.
