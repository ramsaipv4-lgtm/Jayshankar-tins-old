# Validation Checklist — 8-Point Gate (v1.2)

> Run this **before declaring the study plan done**. Any ❌ means fix in place.
>
> **v1.1 change (superseded, kept for history):** Upgraded from 6 → 7 points. Added **check #7: Companion files** to verify the 81 whiteboard + live coding + memory recall files exist for every day (0-8) in every track, in the **track root**, matching the reference Day 1 format.
>
> **v1.2 change (current):** Upgraded from 7 → 8 points.
> - **Check #7 relocated:** companion files (+ a new 4th file type, the participant/student guide) now live **inside `day{N}/`**, not the track root. File count is now 108 (4 file types × 9 days × 3 tracks), not 81.
> - **NEW check #8: Instructor-script teleprompter format.** `instructor_script.md` must be a full word-for-word Say/Do script (legend, timing map, continuous clock, mistake-first structure, inline cross-Qs, Emergency Recovery + Optional Beats appendices) — not an outline.
>
> Both changes came from real usage feedback on a live delivery of this skill. See `SKILL.md`'s versioning notes for the full rationale.

---

## 1. Voice check (does it teach from zero?)

- [ ] Open `deepdive.md` and read the first 50 lines aloud
- [ ] A 5th-grader could follow the first 2 paragraphs
- [ ] No "as we all know" / "obviously" / "trivially" smugness
- [ ] Every acronym is spelled out the first time
- [ ] Every external concept has a 1-sentence "from-scratch" definition

**Failure mode:** Writing for yourself, not the learner. Fix by adding the from-scratch explanation.

---

## 2. Pacing check (does the instructor script hit its target duration?)

- [ ] Open `instructor_script.md`
- [ ] Count minutes: does each segment add up to the target duration (360 for a 6-hour self-paced day; a shorter instructor-led day — e.g. 240 — must add up to *that* day's target instead)?
- [ ] **Show the arithmetic, don't just assert it** — for every named hour/part block, the sub-segment minutes must literally sum to that block's length (e.g. an "Hour 1" block's sub-segments must sum to exactly 60). Add them up with a calculator or `python3 -c "print(a+b+c+...)"` before sign-off; a script that's off by even 10 minutes will run into the next block live.
- [ ] Are there 2+ breaks (15 min each) — or, for a shorter instructor-led day, at least 1?
- [ ] Is the last 30 min reserved for self-check + Q&A?
- [ ] Is there NO new content after the final 30-minute mark?
- [ ] Are there 3+ named activities (game, quiz, whiteboard, demo)?

**Failure mode:** Lecture with no activities, or a pacing table that looks right but whose sub-segments don't actually add up (caught in a real delivery of this skill: an "Hour 1" block silently summed to 70 minutes, not 60). Fix by injecting 3+ activities, and by literally re-adding every block's sub-segments before sign-off.

---

## 3. Fun check (kinesthetic every 90 min?)

- [ ] At least 1 fun/kinesthetic activity per 90-minute block
- [ ] Activities are named (not just "interactive demo")
- [ ] Each activity has a time budget (3 min, 5 min, 10 min, etc.)
- [ ] Activities don't require special equipment (or note the equipment needed)

**Activity bank (use these):**
- Whiteboard race (3 min, 2 teams draw on Excalidraw)
- Code golf (5 min, shortest valid Python wins)
- Bug hunt (10 min, find 3 planted bugs in a code block)
- API call bingo (5 min, mark off REST verbs as you call them)
- Concept skit (5 min, act out a sequence diagram with bodies)
- Live predict (10 min, students call the output before you run the code)

---

## 4. Code check (does every lab run?)

- [ ] Create fresh venv: `python -m venv .venv && source .venv/bin/activate`
- [ ] Install: `pip install -r lab-repo/env/requirements.txt`
- [ ] Run every `lab/*.py` in order, no exceptions
- [ ] Each script prints/returns a result (not just `pass`)
- [ ] No hardcoded absolute paths
- [ ] No `import` of local modules from outside the repo
- [ ] **Every `[TYPE]` code block inside `instructor_script.md` was actually run**, not just described — including the "broken" version of any mistake-first block (it must genuinely fail/misbehave the way the script claims) and the "fixed" version (it must genuinely produce the corrected result)

**Failure mode:** Code that "should work" but doesn't in a fresh env — or a scripted "bug" that doesn't actually reproduce live, which is worse than no bug at all because it undermines the demo in front of the room. Fix by testing in a clean env, and by running every `[TYPE]` block exactly as scripted before committing.

---

## 5. Badge check (are all MS Learn URLs live?)

- [ ] Open each URL in `mslearn_badges.md`
- [ ] Each returns 200 OK (use `curl -I` or browser)
- [ ] The badge is still claimable (cert/achievement not retired)
- [ ] The module is the latest version (not deprecated v1)

**Quick check:**
```bash
grep -E 'https?://learn\.microsoft\.com' mslearn_badges.md | \
  awk '{print $NF}' | \
  xargs -I{} curl -s -o /dev/null -w "%{http_code} {}\n" {}
```

**Failure mode:** Microsoft rotates URLs ~2x/year. Fix by re-searching Microsoft Learn for the current URL.

---

## 6. Diagram check (do all Mermaid render?)

- [ ] Open every `assets/0N_*.mmd` in a Mermaid live editor (mermaid.live)
- [ ] Each renders without errors
- [ ] No special characters that need escaping (e.g., `()`, `[]` in node labels)
- [ ] All arrows have direction
- [ ] All node labels are readable (not 200 chars long)
- [ ] Then re-render via `mcp__matrix__render_mermaid_to_image` to SVG (fallback: `mmdc` / mermaid-cli, if that tool isn't available)

**Common Mermaid issues:**
- `()` in node label → escape with `#40;` `#41;` or use `[]` instead
- `[]` in node label → escape with `#91;` `#93;`
- `<br/>` in node label → use `<br/>` (works) or `\n` (sometimes doesn't)
- Unquoted special chars → quote the label: `node["text (with parens)"]`

---

## 7. Companion + participant-guide files check (v1.2 — relocated) — do all 108 files exist, inside `day{N}/`?

- [ ] **All 108 files exist** — 4 file types × 9 days (Day 0-8) × 3 tracks = 108
- [ ] For each track (`sem3/`, `sem5_azure_ai/`, `sem5_azure_cloud/`), the following 4 files exist **inside each day's own `day{N}/` subfolder** (NOT the track root — that was the v1.1 layout, now reversed):
  - `student_guide_day{NN}.md` (participant/student guide — new file type as of v1.2)
  - `whiteboard_day{NN}.md`
  - `live_coding_day{NN}.md`
  - `memory_recall_day{NN}.md`
  - (zero-padded `day00` through `day08`, 9 days per track, so 36 files per track × 3 tracks = 108)
- [ ] **Each `whiteboard_dayNN.md` matches the reference format:**
  - Has Setup (1 min) section with Wacom + Excalidraw config
  - Has 3 exercises × 5 min each (skeleton → labels → annotations → failure modes → save)
  - Each exercise saves to `assets/whiteboards/dayNN_exercise{1,2,3}.excalidraw` + `.png`
  - Wrap-up section with "Why this matters for memory", "Files produced", "Daily 5-min recall"
  - Length ~150 lines (range 130-200 OK)
  - References the day's `deepdive.md` **with no path prefix** (same-folder reference, since both files now live in `day{N}/`)
- [ ] **Each `live_coding_dayNN.md` matches the reference format:**
  - Framed explicitly as a **rehearsal/prep reference** — the file itself should say the authoritative word-for-word version lives inside `instructor_script.md`
  - Has Pre-flight section (5 min before recording/presenting) with OBS settings (self-paced) or room-setup notes (instructor-led)
  - Has a 0:00→(duration) timeline in 5-min blocks with narration in quotes
  - **Has 1 intentional bug, placed where it's pedagogically natural for this topic** (not rigidly forced to a fixed timestamp) — the meta-skill pattern
  - Files produced section + What to do after section
  - Code is runnable, no TODO/placeholders
  - Length ~160 lines (range 150-250 OK for code-dense days)
  - References `instructor_script.md` and the day's `lab/` code **with no path prefix** (same-folder reference)
- [ ] **Each `memory_recall_dayNN.md` matches the reference format:**
  - Has 5 exercises × 5 min: recreate diagram / re-code / recite 5 facts / Feynman audio / tradeoffs table
  - Each exercise has "What to do" + "The answer" sections (check after you do it)
  - Wrap-up with scoring rubric
  - The most important exercise is always #4 (Feynman)
  - Length ~150 lines (range 130-250 OK)
  - References the day's `quicklearn.md` or `student_guide_dayNN.md` **with no path prefix** (same-folder reference)
- [ ] **Each `student_guide_dayNN.md` (participant guide) matches the reference format:**
  - One-page condensed reference: schedule table, what to bring, deliverable, "one habit to leave with"
  - References `quicklearn.md`, `deepdive.md`, `README.md` **with no path prefix** (same-folder reference)
- [ ] **Voice is consistent across all 108 files** — second-person "you", encouraging, hands-on, no emojis, no "TODO"
- [ ] **No stale cross-references left over from a track-root layout** — grep the whole day folder for `../whiteboard`, `../live_coding`, `../memory_recall`, `../student_guide`, `../participant_guide` and confirm zero hits (any hit means a v1.1-style path survived a v1.2 relocation)

**Quick check (run this from the track root):**
```bash
# For each track, verify 4 files exist inside EVERY day{N}/ folder
for d in sem3/day*/; do
  ls "$d"whiteboard_day*.md "$d"live_coding_day*.md "$d"memory_recall_day*.md "$d"student_guide_day*.md 2>/dev/null
done | wc -l
# Expected: 36 per track (4 types × 9 days)

# Verify no stale track-root-relative references survived the v1.2 relocation
grep -rE '\.\./(whiteboard|live_coding|memory_recall|student_guide|participant_guide)_day' sem3/ sem5_azure_ai/ sem5_azure_cloud/
# Expected: no output
```

**Failure mode:** If you skip the companion + participant-guide files, the learner has no whiteboard/live-coding/recall/reference prompts and falls back on reading-only learning, which has ~20% retention after 1 week. With the companion files, retention jumps to ~70%. If you generate them but leave them at the old v1.1 track-root location (or leave stale `../`-prefixed references after moving them), sub-agents packaging a single day will silently produce an incomplete folder. The companion files are not optional — they're what makes the learning block in `student-learning-guide.md` / `faculty-learning-guide.md` actually work.

---

## 8. Instructor-script teleprompter format check (NEW in v1.2) — is `instructor_script.md` a real Say/Do script, not an outline?

- [ ] **Legend block near the top** defines every marker used: `[SAY]`, `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]`, `[WORK TIME]`, and the cross-question callout marker (e.g. `⚠️ LIKELY CROSS-Q`)
- [ ] **A one-sentence "spine"** — the single idea the whole day is teaching — stated explicitly near the top, something the presenter could repeat if they lost their place
- [ ] **A "before the room opens" prep checklist** — what must be true/ready before minute 0
- [ ] **A TIMING MAP table** — every named block with its start/end clock time, at a glance, before the minute-by-minute script begins
- [ ] **A continuous running clock** through the whole script (e.g. `0:00–0:08`, `0:08–0:18`, ...) — not just "Segment 3", so a presenter mid-script can tell instantly if they're behind
- [ ] **Every concept follows mistake-first structure**: realistic wrong version → `⚠️ LIKELY CROSS-Q` or diagnosis → fix → why the fix works. No concept is introduced correct-version-first.
- [ ] **`[WORK TIME]` blocks are explicitly unscripted** — they name the task and the time budget but do not attempt to word-for-word script what participants say/do during independent work
- [ ] **Inline `⚠️ LIKELY CROSS-Q` callouts** appear at points where a real learner would plausibly interrupt with a question — with the actual answer scripted, not just "be ready for questions"
- [ ] **Two closing appendices exist**: an Emergency Recovery table (what to do if a demo breaks, wifi dies, timing slips) and an Optional Beats section (extra material to use only if time allows)
- [ ] **Every `[TYPE]` code block was actually run** (see check #4) — broken version genuinely breaks, fixed version genuinely fixes
- [ ] **Pacing arithmetic is shown, not asserted** (see check #2) — every named hour/part's sub-segments literally sum to that block's length
- [ ] **Any spoken claim in a `[SAY]` line that could be stale** (pricing, current tool behavior, "as of" facts) was verified against a current source before being scripted (see check #5's spirit, applied to spoken content, not just URLs)

**Failure mode:** An "instructor script" that's really a bulleted outline of topics and rough timings looks done but isn't usable live — the presenter has to improvise the exact wording, the mistake-first moments, and the answers to likely questions in real time, which is exactly the cognitive load this format exists to remove. Fix by rewriting as full word-for-word Say/Do content, matching the structure above (reference example: a real 2-hour presenter script built and used for this exact purpose — ask for it if you don't have a copy on hand).

---

## Final sign-off

After all 8 checks pass:

- [ ] Update `README.md` day status table (mark Day 1 ✅, Day 2 ✅, ..., including companion file status)
- [ ] Update `STATE_HANDOFF.md` (mark the latest completed day, including companion file count)
- [ ] Commit to git (if applicable): `git add . && git commit -m "Day N complete, all 8 checks pass"`
- [ ] Print the printable handout for the day
- [ ] Start the day: read `quicklearn.md` (or `student_guide_dayNN.md`) first, then open `day{N}/whiteboard_dayNN.md`

---

## When to skip checks (and why not to)

| Skip | Risk | Why you should still run it |
|---|---|---|
| Skip voice check | Sounds too academic | Learners disengage in 10 min |
| Skip pacing check | Day runs long, learners lose patience | You'll blow through breaks and lose the room by the final block |
| Skip fun check | Pure lecture, retention drops to 20% | Adult learners need kinesthetic |
| Skip code check | "Works on my machine" syndrome | You'll waste time debugging live in front of the room |
| Skip badge check | 404s in front of learners | Looks unprofessional |
| Skip diagram check | Blank slides, confused learners | Diagrams are the fastest mental model |
| Skip companion files check (v1.2 — relocated + expanded) | Learner has no whiteboard/live-coding/recall/reference prompts; falls back on reading-only | Reading-only retention is ~20% after 1 week. With companion files, ~70%. |
| **Skip teleprompter-format check (NEW v1.2)** | Presenter has to improvise wording, mistake staging, and Q&A answers live | An outline-format script looks finished but isn't rehearsable — the whole point of this format is removing live improvisation load |

**Rule of thumb:** Skipping any check is a 5-min cost now vs a much larger cost during the live day. Always run the check.
