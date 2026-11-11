# Folder Template — Copy-Paste Scaffold for a New Study Plan

> Save this as your `<output_root>/` and rename per your course.

**v1.1 update (superseded — kept for history):** Companion files (whiteboard + live coding + memory recall) moved into the **track root** (e.g., `sem3/whiteboard_day03.md`), NOT inside the `day3/` subfolder.

**v1.2 update (current):** That v1.1 layout is reversed. Companion files, and the per-day student/participant guide, now live **inside the day's own subfolder** (`sem3/day3/whiteboard_day03.md`), alongside the rest of that day's 7-artifact set. Also new in v1.2: `instructor_script.md` is a teleprompter/Say-Do script (see `SKILL.md` Step 4b), not an outline. Both changes came from real usage feedback on a live delivery of this skill — see `SKILL.md`'s versioning notes for the full rationale.

---

## How to use

1. Copy this entire template into a new folder (e.g., `next-semester-plan/`).
2. Rename `azure-combined-track` → your course name.
3. Replace the syllabus files in `user_input_files/` with your new syllabi.
4. Update `README.md` (currency notes, day status table).
5. Update `COURSE-MAP.md` (day-by-day topic matrix).
6. Invoke the skill with Prompt P1 from `prompt-library.md`.

---

## The scaffold

```
<course-name>/
├── README.md                                  ← file map + currency warnings
├── COURSE-MAP.md                              ← day-by-day topic matrix
├── SPEC.md                                    ← deliverable contract
├── chronological_study_plan.md                ← merged day-by-day view
├── pedagogy-guide.md                          ← pacing (6-hour original / 4-hour instructor-led variant), 50/50 rule, breaks
├── student-learning-guide.md                  ← 90-min block using companion files (self-paced) OR faculty-learning-guide.md (instructor-led)
├── exam_mock_<cert>.md                        ← mock exam (if cert-aligned)
├── STATE_HANDOFF.md                           ← resume-from-here
│
├── shared/                                    ← content shared between tracks
│   ├── <topic1>.md                            ← e.g., azure_ml_basics_intro
│   ├── <topic2>.md
│   └── mslearn-badges-master.md
│
├── sem3/                                      ← Semester 3 (rename as needed; OMIT this whole level for a single-track program — see SKILL.md's adaptation notes)
│   ├── day0/                                  ← Day 0 triage primer (foundations), if used
│   ├── day1/                                  ← v1.2: EVERY file about Day 1 lives here, nothing for this day lives in the track root
│   │   ├── README.md
│   │   ├── quicklearn.md
│   │   ├── deepdive.md
│   │   ├── instructor_script.md               ← v1.2: teleprompter/Say-Do script (SKILL.md Step 4b), not an outline
│   │   ├── printable_handout.md
│   │   ├── external_resources.md              ← Sem 3 uses this (not MS Learn); or a unified resources.md — see SKILL.md's naming note
│   │   ├── student_guide_day01.md             ← v1.2: moved in here (was track root in v1.1)
│   │   ├── whiteboard_day01.md                ← v1.2: moved in here (was track root in v1.1)
│   │   ├── live_coding_day01.md               ← v1.2: moved in here (was track root in v1.1); rehearsal/prep copy — authoritative word-for-word version is inside instructor_script.md
│   │   ├── memory_recall_day01.md             ← v1.2: moved in here (was track root in v1.1)
│   │   ├── lab/                               ← 5-6 runnable scripts
│   │   │   ├── day1_topic1.py
│   │   │   └── ...
│   │   └── assets/                            ← 5 Mermaid + 5 SVG
│   │       ├── 01_*.mmd
│   │       ├── 02_*.mmd
│   │       ├── 03_*.mmd
│   │       ├── 04_*.mmd
│   │       ├── 05_*.mmd
│   │       └── *.svg                          ← rendered diagrams
│   ├── day2/ ... day8/                        ← same structure as day1/
│   ├── recordings/                            ← OBS live coding MP4s, if faculty/students record their own (self-paced context)
│   └── capstone/
│
├── sem5_<track1>/                             ← same structure as sem3/
├── sem5_<track2>/                             ← same structure as sem3/
│
├── downloadable_assets/                       ← all code, Bicep, notebooks
│   ├── notebooks/
│   ├── bicep/
│   ├── scripts/
│   └── data/
│
├── printable_materials/                       ← 1-2 page reference cards
│   ├── day01_card.pdf
│   └── ...
│
├── screenshots/                               ← screenshot placeholder descriptions
│   ├── README.md
│   └── day01_*.md
│
├── ppts/                                      ← PowerPoint source
│   ├── sem3/day{N}/slide-01.js ... slide-12.js
│   ├── sem5_<track1>/day{N}/slide-01.js ... slide-12.js
│   └── sem5_<track2>/day{N}/slide-01.js ... slide-12.js
│
├── lab-repo/                                  ← cumulative lab repo
│   ├── README.md
│   ├── data/
│   ├── notebooks/
│   ├── solutions/
│   ├── tests/
│   └── env/requirements.txt
│
├── career-trajectory_<location>.md            ← post-course job roadmap (optional)
│
└── skill-template/                            ← THIS SKILL BUNDLE (keep here)
    ├── SKILL.md
    ├── folder-template.md                     ← this file
    ├── prompt-library.md
    ├── validation-checklist.md
    ├── faulty-first-instructions/             ← companion skill: mistake-first pattern for written tutorials
    │   └── SKILL.md
    └── examples/
        └── azure-combined-track/             ← the worked example (v1.1-era, preserved as delivered)
            └── README.md
```

---

## Naming conventions

| What | Pattern | Example | Location |
|---|---|---|---|
| Track folder | `sem<N>_<slug>` or `sem<N>_<topic_slug>` | `sem3`, `sem5_azure_ai` | output root (omit entirely for a single-track program) |
| Day folder | `day{N}/` | `day1/`, `day2/` | track root (or output root, single-track) |
| Student/participant guide | `student_guide_day{NN}.md` (zero-padded) | `student_guide_day04.md` | **`day{N}/`** (v1.2 — was track root in v1.1) |
| Whiteboard | `whiteboard_day{NN}.md` (zero-padded, Day 00-08) | `whiteboard_day04.md` | **`day{N}/`** (v1.2 — was track root in v1.1) |
| Live coding | `live_coding_day{NN}.md` (zero-padded, Day 00-08) | `live_coding_day04.md` | **`day{N}/`** (v1.2 — was track root in v1.1); rehearsal/prep copy, authoritative version embedded in `instructor_script.md` |
| Memory recall | `memory_recall_day{NN}.md` (zero-padded, Day 00-08) | `memory_recall_day04.md` | **`day{N}/`** (v1.2 — was track root in v1.1) |
| Instructor script | `instructor_script.md` (always) | n/a | `day{N}/` — **teleprompter/Say-Do format, v1.2** (see SKILL.md Step 4b) |
| OBS recording | `day{N}_{track}_{topic}.mp4` | `day04_sem3_cnn_live.mp4` | `recordings/` |
| Lab script | `day{N}_{topic_slug}.py` | `day4_transformer.py` | `day{N}/lab/` |
| Mermaid | `0[N]_{descriptor}.mmd` | `01_architecture.mmd` | `day{N}/assets/` |
| Slide | `slide-NN.js` (zero-padded) | `slide-01.js`, `slide-12.js` | `ppts/sem[N]/day[M]/` |
| Handout | `printable_handout.md` (always) | n/a | `day{N}/` |
| Quick learn | `quicklearn.md` (always) | n/a | `day{N}/` |
| Deep dive | `deepdive.md` (always) | n/a | `day{N}/` |
| MS Learn | `mslearn_badges.md` (Sem 5 only) | n/a | `day{N}/` |
| External | `external_resources.md` (Sem 3 only) — or a unified `resources.md` for multi-vendor programs | n/a | `day{N}/` |

**Note on day numbering:** The detailed lessons and student guides use `day01` (no zero pad) because there are only 8 days. The companion files use `day00` (with zero pad) because there are 9 days (Day 0 triage primer + Day 1-8 main course). This convention lets the file sort order be Day 0, 1, 2, ..., 8 (alphabetically), and the `student_guide_day01.md` and `whiteboard_day01.md` files for the same day sort next to each other — this still matters even now that both live in the same `day{N}/` folder, since alphabetical sort within that folder groups the two together.

**Why the v1.1 → v1.2 relocation:** track-root placement was originally chosen so companion files would sort next to a per-track file listing. In practice, across a real delivery, keeping every file about one day inside that day's own folder proved simpler to navigate, easier to hand a single day to a sub-agent as a self-contained unit, and easier to package/share as one thing (e.g., zip just `day3/` and you have everything about Day 3, full stop). If a specific run has a strong reason to prefer track-root sorting, that's still a legitimate choice — just document it explicitly in that run's `SPEC.md` rather than defaulting to it silently.

---

## File count target (per track, per day)

| Artifact | Files | Lines per file | Location |
|---|---|---|---|
| Markdown top-level | 6 | 80-600 (instructor_script.md length now follows content, not a line target — see SKILL.md Step 4b) | `day{N}/` |
| Lab Python | 5-6 | 50-200 | `day{N}/lab/` |
| Mermaid + SVG | 5+5 | n/a | `day{N}/assets/` |
| PPT slides (in ppts/) | 12 | n/a (JS modules) | `ppts/...` |
| **Companion files + participant guide** | **4** | **50-200** | **`day{N}/` (v1.2 — was track root in v1.1)** |
| **Total per day per track** | **~39 files** | **~3000+ lines** |

**Per 9-day track:** ~350 files, ~27,000+ lines
**Per 3-track plan:** ~1050 files, ~81,000+ lines
  - Of which ~108 are companion + participant-guide files (9 days × 4 file types × 3 tracks) — all now nested inside each `day{N}/`, not in a separate track-root layer
  - The other ~940 are the 7-artifact set + supporting infrastructure

> The pilot (Day 1) is denser. After sign-off, the pattern is replicable. The companion files are generated in parallel by sub-agents (see SKILL.md §9), alongside that same day's core 7-artifact set, since they now live in the same folder.

---

## Shared vs track-specific decision tree

```
Is the topic in 2+ tracks?
├── YES → Place in shared/, reference (not regenerate) from each track
│         Add [SHARED] tag at the top of each referencing section
│         Generate ONCE, link MANY
└── NO  → Generate in the track that owns it
          Other tracks reference it with "see semX/dayY/..."
```

**Examples from this run:**
- Azure ML basics → shared (appears in Sem 3 Day 1 + Sem 5 AI Day 1)
- Perceptron PyTorch code → sem3 only
- Foundry portal walkthrough → sem5_azure_ai only
- Bicep templates → sem5_azure_cloud only
