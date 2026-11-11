# BUILDER-DECISIONS-REVIEW.md — build-time decisions log

Append-only. Future sessions read this before starting work.

---

### Decision 1 — Applied `tins-kit`'s SPEC.md template to a CLI data pipeline, not a web app

**What changed.** Used `tins-kit/templates/SPEC.md` as the skeleton for a project that has no UI,
no database, no auth, and no money — categories the template (and the "10 categories" guidance in
`SPEC-AUTHOR.md`) assumes. Sections 5 (style guide) and 6 (accessibility) were reinterpreted for
documents (Markdown/PDF typography) rather than left as unfillable web-UI boilerplate.

**Why.** The user explicitly pointed this session at `tins-kit` and asked that its process be
followed. Reading `scripts/validate.mjs` first showed the *validator* only checks structure
(TINS markers, §0.0/§0.2/§0.4 presence and shape, §8 criteria count, §9 non-empty) — it does not
hard-require web-specific categories like auth or money. So the spec could honestly follow the
kit's discipline (locked decisions, §0.4 interview-reveals-reality, numbered acceptance criteria)
without inventing irrelevant web-app content just to check a box.

**Impact on downstream.** A future kit-growth session (per `PIPELINE.md` Step 5) reviewing this
project's decisions should note that the SPEC.md template works fine for non-web CLI/pipeline
projects as long as the builder swaps §5/§6's content rather than treating them as mandatory
web-UI sections. That's arguably a kit-level gap (the template doesn't say this explicitly).

**Kit-level implication.** Possible candidate for a future `docs/LIBRARY-CONVENTIONS.md` note:
"§5/§6 apply to any deliverable with a presentation layer, including documents and PDFs, not just
web UI — reinterpret, don't skip." Not raised as a formal kit-growth candidate yet (needs a 2nd
consumer per the kit's 2-consumer rule, D17/§0.4 of `context.md`) — noting it here so it's not
lost.

### Decision 2 — `pywhispercpp` over `openai-whisper` / `faster-whisper` for STT

**What changed.** Selected `pywhispercpp` (a Python binding for whisper.cpp) as the STT engine,
in preference to the two more commonly-reached-for Python Whisper packages.

**Why.** Tried `openai-whisper` first: it depends on `torch`, and `pip install torch` in this
sandbox timed out (>2 minutes, likely attempting to pull a multi-GB CUDA-enabled wheel even
though no GPU is present). Tried `faster-whisper` next: it installed cleanly (no torch
dependency, uses CTranslate2), but `WhisperModel(...)` fails at construction because it always
tries to `snapshot_download` its model from huggingface.co, which this sandbox's network policy
blocks (`httpx.ProxyError: 403 Forbidden`) — there's no way to point it at a local file without
first getting the file into HF's expected cache layout, which itself requires the same blocked
download. `pywhispercpp` installed cleanly via `pip install pywhispercpp` (compiles the bundled
whisper.cpp C++ source at install time, no model download in that step) and its `Model(path=...)`
constructor accepts a plain local `.bin` file path directly — no cache-layout dance, no
implicit network call.

**Impact on downstream.** The pipeline's STT step (`transcribe.py`, W4) takes an explicit
`--model <path>` CLI argument rather than a model *name* — there's no "just say 'base.en' and
we'll figure it out" convenience, by design, since that convenience is exactly what breaks in a
network-restricted environment. `README.md` documents this as a required manual step for the
operator.

**Kit-level implication.** This is a strong candidate for a `lib/patterns/offline-cpu-stt.md`
kit pattern if a second TINS project ever needs offline speech-to-text — the "torch pulls a
GPU wheel by default" and "faster-whisper hardcodes a HF download" traps are both non-obvious and
would cost a future session the same 10+ minutes of trial-and-error this session spent. Deferred
per the 2-consumer rule; noted here for the next kit-growth session to pick up if it recurs.

### Decision 3 — Slide detection via dHash frame diffing, not a scene-detection library

**What changed.** Built slide-change detection from a ~15-line pure-Python dHash implementation
(§4.3.4 of SPEC.md) rather than pulling in `scenedetect`/`ffmpeg`'s built-in scene-detect filter
(`select='gt(scene,0.X)'`).

**Why.** These are slide-deck screen recordings, not filmed video — cuts are either "static slide
for N seconds" or "smooth cursor movement within the same slide," never camera pans or lighting
changes that scene-detection libraries are tuned for. A perceptual hash with a tunable Hamming
threshold is simpler, has zero new dependencies, and is easier to explain/debug ("this frame
differs from the last emitted one by X of 64 bits") than a black-box scene-detection score.

**Impact on downstream.** The threshold (default 8) is a single tunable number, expected to need
adjustment after seeing real output (flagged in SPEC.md's closing "what's most likely to be
wrong" section) — this is intentional: better to have one obvious knob than a scene-detector's
opaque internal heuristics.

**Kit-level implication.** None identified yet — video-slide extraction hasn't recurred in any
other TINS consumer project.

### Decision 4 — Extract embedded base64 images to files instead of leaving them inline

**What changed.** During the first real run of `html_to_markdown.py` against all 29 HTML files,
the output Markdown was 1.03MB with 2 individual lines over 400KB each. Root cause: Google-Docs
-exported `<img>` tags embed diagrams as `data:image/png;base64,...` URIs directly in the HTML,
and `markdownify` faithfully reproduces that entire data URI as the `![]()` image src in the
Markdown output. Added `_extract_embedded_images()` (SPEC.md §4.3.2b): decodes each data-URI
image to a real file under `output/images/`, rewrites the `<img src>` to a short relative path,
*before* the content sub-tree is handed to markdownify.

**Why.** A 1MB Markdown file with multi-hundred-KB single lines is unusable in most editors/viewers
and defeats the point of "correctly formatted markdown." Extracting to real files is also what
lets the Markdown be portable (open the `.md` next to its `images/` folder anywhere) rather than
carrying every diagram as an unreadable blob inline.

**Impact on downstream.** `output/images/` is now a real output directory or the Markdown file
delivered to the user must ship together with it (SendUserFile needs to include both, or zip
them). `README.md` should mention this if the user unzips the deliverable elsewhere expecting a
single self-contained `.md` file — noted as a follow-up for W5 (see `HANDOVER.md`).

**Kit-level implication.** "Google Docs → HTML export embeds images as base64 data URIs, decode
before Markdown conversion" is a plausible `lib/patterns/` candidate if a second TINS consumer
ever processes Google-Docs-exported HTML. Deferred per the 2-consumer rule.

### Decision 5 — Google-Docs-pasted code needs a structural fold before markdownify, not just a style tweak

**What changed.** The first real pipeline run also revealed that source code pasted from an
editor into Google Docs (then exported to this LMS's HTML) has **no semantic `<pre>`/`<code>`
tags at all** — each line is its own `<p>` with inline syntax-highlight `<span style="color:...">`
tags and pixel-based margin indentation. Left alone, `markdownify` emitted one Markdown paragraph
per code line, and any comment line starting with `#` (extremely common in the Python examples in
this course) rendered as a Markdown ATX heading in the output — silently corrupting every code
sample in the document. Fixed by `_fold_code_blocks()` (SPEC.md §4.3.2): detect contiguous runs
of class-less `<p style="margin:0...;color:black">` paragraphs (verified against 138 code-shaped
vs. 74 non-code, class-less-but-differently-styled paragraphs in one sample file — zero false
positives found), fold each run into one `<pre><code>` element (mapping the pixel margin-left to
4-space indent levels) before handing the tree to markdownify.

**Why.** This is the single highest-impact bug found in this session — every one of the 6
problem-statement briefs contains multiple large code samples, and all of them were being
silently mangled (comments turned into headings, underscores backslash-escaped, all indentation
lost) before this fix.

**Impact on downstream.** Any *new* HTML export from this same Google-Docs-via-LMS pipeline
(D12 reusability) will hit the same code-paragraph shape, so this fix generalizes for free.
If a future export uses real `<pre>/<code>` tags instead (e.g. a different authoring tool),
`_fold_code_blocks` simply finds no class-less code-styled paragraphs and does nothing — safe
either way.

**Kit-level implication.** Strong candidate for a `lib/patterns/google-docs-pasted-code.md`
kit pattern — this is exactly the kind of "the naive/first-thing-Google-suggests path silently
corrupts data" trap the kit exists to capture. Deferred per the 2-consumer rule; flagged here so
the next kit-growth session sees it on the first pass.

### Decision 6 — Quiz option/explanation parsing: never filter bare digits as noise inside the options run

**What changed.** The first version of `_extract_quiz()` dropped any line matching `^\d+$` inside
a question's options run, intending to filter the "Marks awarded:" score line. This also deleted
*real* MCQ options that happen to be bare numbers — found on `1-6-4` ("What is dp[i][j] for a
single character?", options `0`/`1`/`2`/`"It depends on the character"` — 3 of 4 options were
silently dropped). Fixed by removing the digit filter from the options loop entirely (the actual
score digit only ever appears *after* the literal `"Marks awarded:"` line, which is handled in a
separate, later step). Also found: the score can be signed (`"+2"` for a correct answer, not just
`"0"`) — the score-skip regex was `^\d+(\.\d+)?$`, missed `+2`, and the `+2` leaked into the
explanation text. Fixed to `^[+-]?\d+(\.\d+)?$`. Also found a `"Your answer"` status label
injected inline among the options (like `"Not attempted"`) — added to the noise set.

**Why.** All three bugs share a root cause: treating "looks like a number" as sufficient evidence
of "is UI chrome, not content." The fix in each case was to key off structural position (before
vs. after the literal `"Marks awarded:"` marker) or an explicit vocabulary match, never a bare
number-shaped regex.

**Impact on downstream.** Re-ran extraction after each fix; verified against the raw
`get_text()` dump of the affected source file each time, not just re-reading the rendered
Markdown — this is what caught the digit-options bug (`1-6-4` looked like a correctness bug in
the *output*, but the giveaway was checking the source file's raw text).

**Kit-level implication.** None specific to TINS beyond the general lesson "don't filter by shape
when you can filter by position" — not distinct enough to be its own pattern.

### Decision 7 — Slide detection needs a 2-sample confirmation, not single-frame-crosses-threshold

**What changed.** Testing `video_to_slides.py` against `1-3-1_arrays_and_strings-theory.mkv`
(the first real run) produced 29 slides for a 4m32s video. Eyeballing the screenshots found
`slide_010` was a garbage frame: a mid-animation page-flip transition (two slides visible at once,
diagonally split, rotated text) between the real slide at `slide_009` and the real next slide at
`slide_011`. The original algorithm (SPEC.md §4.3.4 v1: emit as soon as a frame exceeds
`hash_threshold` vs. the last *emitted* hash) treats the transition frame as its own distinct
slide because it genuinely is visually distinct from both neighbors. Fixed by requiring a new
visual state to persist for `min_run_length` (default 2) consecutive samples before it's
confirmed as a real slide — implemented as anchor-based contiguous run-building over the whole
sampled-frame sequence, then filtering to runs long enough to count (SPEC.md §4.3.4 v2).

**Why.** The LMS's own page-flip transition animation lasts well under 0.5s (it appeared in
exactly 1 sample at 2fps and was gone by the next), while every genuine slide in this course
holds for several seconds (many samples). A length-based confirmation cleanly separates the two
without needing to understand *what* a transition looks like — it only needs to know transitions
are brief and real slides aren't.

**Impact on downstream.** Every video in this course uses the same LMS page-flip transition
style, so this fix generalizes across all 7 videos (and any future video from the same
platform, D12). The `min_run_length` parameter is exposed on the CLI and stored in the slides
manifest for reproducibility, alongside `hash_threshold` — both are the two knobs SPEC.md's
closing "what's most likely to be wrong" section already flagged as needing real-data tuning.

**Kit-level implication.** "Confirm state changes over N samples, don't trust a single sample" is
a general debouncing pattern that could apply to any TINS consumer doing change-detection over a
sampled signal (video, sensor data, polling). Candidate for `lib/patterns/` if a second consumer
needs it. Deferred per the 2-consumer rule.

### Decision 8 — Transcribe in fixed 30s chunks, not one pass over the whole file

**What changed.** `transcribe.py` originally called `model.transcribe(whole_file.wav)` once per
video. Rewrote it to slice the WAV into fixed 30-second chunks (ffmpeg `-ss`/`-t`) and call
`model.transcribe()` once per chunk against the same loaded `Model` instance, offsetting each
chunk's segment timestamps by the chunk's start time before merging.

**Why.** Running the full W4 batch across all 7 videos, 2 of them (`1-10-2`, `1-12-2`) came back
with a transcript of several hundred segments that were each just a lone `"["` or `"]"` character
— 236 and 295 segments respectively, averaging 1.0 chars/segment, versus 55-67 chars/segment for
the other 5 videos. Isolated the cause with a bisection test on `1-10-2`: transcribing 15s clips
from anywhere in the file worked perfectly (confirmed real, clear speech is present throughout,
using both the small and base models), but transcribing progressively longer prefixes of the same
file (0-60s, 0-120s, ...) showed the small model hitting a brief hallucination loop around the
50-57s mark, then in the *whole-file* run never recovering — it fell into decoding roughly 1
audio-second per output segment, all bracket tokens, for the remaining ~185s. Splitting the same
file into eight independent 30s chunks and transcribing each separately fixed it completely:
chunks 1-7 all produced clean, accurate speech text; only chunk 0 (which contains the same 50-57s
trouble spot) had a short bracket-hallucination prefix before self-correcting *within that same
30s chunk*, rather than corrupting the rest of the file.

**Why 30 seconds specifically.** Whisper's encoder itself only ever looks at 30s of mel-spectrogram
context per pass — chunking at exactly that boundary costs nothing in extra context loss beyond
what whisper.cpp's own internal windowing already does; it only adds a hard reset point so a
decoder that gets stuck in a degenerate/repeating hypothesis in one window can't drag every later
window down with it. A word can in principle be split across a chunk boundary, which is the one
accepted trade-off (documented, not treated as a bug).

**Impact on downstream.** `1-10-2` and `1-12-2` were re-transcribed with the fixed script (see
`run_fix_broken_transcripts.sh`) and their PDFs rebuilt. Confirmed the fix works via the same
chars/segment sanity check used to find the bug in the first place (see verification note in
`HANDOVER.md` W4). `--chunk-seconds` is exposed on the CLI (default 30) for future tuning, same
pattern as `video_to_slides.py`'s tunable thresholds.

**Kit-level implication.** Strong candidate for a `lib/patterns/offline-cpu-stt.md` kit pattern
(can merge with Decision 2's note there): "whisper.cpp can silently fall into a
degenerate-token decode loop on long audio after hitting one ambiguous patch, and it does not
self-recover within the same call — always chunk long audio into independent ≤30s windows and
never trust segment count alone as a success signal; check average text length per segment."
This is also a general lesson beyond STT: **a plausible-looking output count is not proof of
correct output** — `236 segments` looked like a normal transcript in a first glance at the log
line; only checking the actual segment *text* (not just that segments existed) caught it. Deferred
per the 2-consumer rule; noted here for the next kit-growth session.

### Decision 9 — Final PDF names are derived from the manifests, not hand-mapped

**What changed.** The operator asked, after delivery, for the 2 PDFs per video to be renamed to
fit the source folder's own naming convention: the screenshots-only PDF takes the name of its
paired *recap* `.htm` file (the PDF is explicitly replacing that file — this was decided back in
the original interview, see D2/D9), and the transcript PDF takes the video's own filename. Rather
than doing this as a one-off manual rename (which would silently rot the next time `pipeline.py`
runs on a new topic folder), added `find_recap_stem()` to `build_pdfs.py`: it reads the
already-on-disk HTML manifests (written by `html_to_markdown.py`, module 1) to find each video's
recap sibling by `file_type` + `sort_key[1]` match, with a same-`file_type`-has-exactly-1-video-
and-1-recap fallback for the one case in this dataset where recap and video don't share a group
number (the theory section: video `1-3-1` pairs with recap `1-4-14`, group numbers 3 vs. 4).

**Why not just hard-code the mapping this run needed?** The whole point of this project (per the
operator's original ask — "if I plug any LLM into it, will it do the same task") is that
`pipeline.py` reproduces this same output on a *new* topic folder with zero code changes (D12). A
hand-written `{video: recap}` dict would have been correct for exactly this one folder and silently
wrong (or would need manual updating) for the next one. Deriving the pairing from manifest data
that the pipeline already produces costs nothing extra and generalizes for free.

**A real gotcha found while implementing this:** the recap file for problem 12 is genuinely named
`1-12-3-14_arrays_and_strings-problem.htm` on the operator's machine (confirmed via `device_bash
ls`), but the copy that had been staged into this sandbox's workspace early in the session was
named `1_-12-3-14_arrays_and_strings-problem.htm` — an extra underscore, apparently introduced by
the staging step itself, not present in the source. This was caught only because the operator's
rename request required re-deriving filenames from the manifests and a fresh `ls` on the actual
device disagreed with what the sandbox had on disk. **Lesson:** when a task depends on an exact
filename (not just file content), re-verify against the source of truth (the operator's own
machine) rather than trusting a value that passed through an intermediate staging/copy step,
especially many turns earlier in a long session.

**Impact on downstream.** All 14 PDFs were rebuilt with the new names and moved into `output-1/`
(alongside the untouched original files in `input-1/`, per D16) directly on the operator's machine
via `device_bash mv` — same-volume renames, no re-transfer of the ~170MB of PDF data needed. If
`find_recap_stem()` can't confidently match a recap (a different topic folder might not have 1:1
recap pages at all, e.g. quiz-only content), it falls back to the old `<stem>-screenshots.pdf`
name and prints a warning — degrades safely rather than crashing or guessing wrong silently.

**Kit-level implication.** "Re-verify exact filenames/paths against the actual source before a
task that depends on them, don't trust a multi-turn-old staged copy" is a general lesson beyond
this project — could fold into a `lib/patterns/` entry on stale-cache/staging risk in long agent
sessions if a second TINS consumer hits the same class of bug. Deferred per the 2-consumer rule.

### Decision 10 — Split Markdown output added alongside the combined file (D17)

**What changed.** The operator asked for `1_arrays_and_strings.md` to be split "in the same
fashion" as the PDF renaming — one Markdown file per source `.htm`/`.html`, named after that
source file. Added `write_split_markdown()` to `html_to_markdown.py`: it reuses the exact same
per-manifest `title`/`markdown_body`/video-companion-cross-reference data that `assemble_markdown()`
already renders into the combined document, just writes each one to its own
`output/markdown/<source-stem>.md` instead of concatenating. The combined file is still written
too (D3 wasn't revoked) — this is additive, not a replacement, since the original interview
explicitly asked for "one combined markdown file" and that's still a valid, still-delivered thing.

**Two real bugs found and fixed while wiring this up, not new ones introduced by it:**
1. The video-companion cross-reference note (`_This page hosts the video lecture only — see
   `<stem>-transcript.pdf`..._`) still referenced the **old** transcript PDF suffix, from before
   D15's rename. Would have pointed the reader at a file that no longer exists. Fixed in both the
   combined-doc renderer and the new split renderer (same string, extracted once so it can't drift
   between the two again).
2. `1-3_arrays_and_strings-theory.html`'s `<title>` tag has a raw embedded newline in the source
   HTML (`"Industry Readiness Integrated Series (IRIS) – Proficiency Level 3\n - Course"`) that
   BeautifulSoup's `get_text(strip=True)` does not collapse (it only strips the ends, not internal
   whitespace) — this rendered as a heading followed by an orphan `" - Course"` line, which several
   Markdown renderers would show as a stray one-item bullet. Was already present, unnoticed, in
   the previously-delivered combined document (verified: same broken rendering exists at line 118
   of the original `1_arrays_and_strings.md`). Fixed with a `re.sub(r'\s+', ' ', ...)` whitespace
   normalization on the `<title>`-derived title path. Found only because writing each file
   standalone made this one page's heading the very first line, impossible not to notice, whereas
   in the combined 2373-line document it was one heading among ~40 and easy to scroll past.

**Why worth calling out.** Neither bug was something the operator flagged — both were caught by
re-examining already-delivered output while implementing an unrelated feature request. Consistent
with this project's pattern so far (Decisions 4-7, 9): the fastest way to find a real defect in
this pipeline has repeatedly been "look again, carefully, at what was already produced" rather
than only testing the new code path in isolation.

**Impact on downstream.** `output/markdown/` now has 22 files (one per non-excluded manifest,
matching the 22-file docs+quiz count from Decision 1's original classification run). Moved into
`output-1/` on the operator's machine in place of the single combined file, per D16's archival
convention, mirroring how `input-1/` mirrors the source folder's own file boundaries.

### Decision 11 — Filename regex was too strict for a second, real topic folder (D18)

**What changed.** The operator pasted a second topic's export ("Sorting and Searches", 40 files:
33 `.htm`/`.mkv` + video, source filenames like `2-10-1_sorting_and_searches-problems.htm` and
`2-4_sorting_and_searches-theory-12.htm`) directly into the same folder and asked for a smoke
test — literally the reusability contract (D12) being exercised for the first time on data this
project didn't design around. Ran `html_to_markdown.py` completely unmodified first (the actual
test), and it did NOT crash — but 19 of the 40 files (all "problems"-typed content: 12 htm + 6 mkv
+ the one `theory-12` recap) came back `file_type: "unknown"`, `sort_key: [1000000000]`. Root
cause: `FILENAME_RE`'s type group only accepted the literal words `theory`, `problem`, `quiz` —
this course's export uses `problems` (plural) for every problem-statement file, and one recap file
has an extra `-12` appended after the type word instead of inside the numeric prefix. Fixed by
widening the regex to `theory|problems?|quiz` plus an optional trailing `-<digits>` group, folding
that suffix number onto `sort_key` and normalizing `problems` back to `problem` at the single
point (`parse_filename()`) everything else reads `file_type` from — no other function needed to
change.

**Why this counts as a real bug, not scope creep.** DOM-shape classification (docs/quiz/recap,
D1) is filename-independent and worked perfectly on all 40 files — that part of D12's contract
held up. But `sort_key`/`file_type` (used for natural ordering, §4.3.8's Theory/Quiz/Problem
grouping, and D15's recap↔video pairing) come entirely from the filename regex, and a `file_type`
of `"unknown"` silently breaks all of those for nearly half this topic's files while never
crashing — exactly the kind of "looks fine, is actually wrong" failure this project's whole
verification habit (Decisions 4-10) exists to catch. Verified the fix both ways: re-ran every one
of topic 1's original 36 filenames through the new `parse_filename()` — zero change in output
(no regressions) — and topic 2's 40 filenames — zero `"unknown"` remaining.

**Impact on downstream.** D15's `find_recap_stem()` needs a matching `file_type` to pair a video
with its recap; before this fix, none of the 6 problem-statement videos (and the 1 theory video)
in topic 2 could have been paired, silently falling back to `<stem>-screenshots.pdf` for all 7.
After the fix, all 7 paired correctly (verified directly, see Decision 12 for the one that needed
the fallback rule specifically).

**Kit-level implication.** "Run the literal reusability claim on real second data before trusting
it, not just on a hand-picked second file" — this is the single clearest validation yet in this
project that D12-style claims need an actual second dataset to mean anything. Strong `lib/patterns/`
candidate: filename-based classification in any TINS pipeline should be smoke-tested against a
genuinely different, operator-supplied second dataset before being trusted, not just re-run on a
variant the builder invented.

### Decision 12 — Title extraction: first block in reading order, not first heading tag (D19)

**What changed.** Also found while running the topic-2 smoke test (not something the operator
flagged): 2 of the 6 "problem statement" pages (`2-13-1...`, `2-15-1...`) got the wrong extracted
title — `"Code Evolution Comparison"` instead of their real problem names ("Next Greater Element
Distance in an Array", "Maximum Frequency Window After Sorting"). Root cause: `_extract_docs()`'s
title logic was `content_root.find(['h1','h2'])` — the first `h1`/`h2` *anywhere* in the page.
For these 2 pages specifically, the true title paragraph was never given a heading style in the
source (Google Docs authoring slip — the exact same class of "the naive path trusts a style that
isn't always applied" issue as Decision 5), so the only `h1` in the whole page was a later,
*recurring* section title ("Code Evolution Comparison" — every problem statement in this course
has a section by that name near the end). Fixed by searching for the first non-empty leaf block
(`h1`/`h2`/`p`) in document order instead of specifically the first heading-tagged one, bounded to
≤150 characters so a genuine long lead paragraph can't be mistaken for a title, falling back to the
old "first h1/h2 anywhere" behavior when the first block doesn't qualify.

**A regression caught before it shipped.** The first version of this fix broke a *topic-1* page:
`1-3_arrays_and_strings-theory.html` (the near-empty video-companion page for the `1-3-1` video)
started returning `"Write a comment..."` as its title — the LMS's standard empty-comment-box
placeholder text, which is short enough to pass the new "first block" check. Caught by re-running
the full topic-1 regression sweep after the change (not just topic 2) — fixed by skipping any
first-block candidate that matches `EMPTY_DOCS_BOILERPLATE` (the same pattern already used to
detect video-companion pages), falling through to the title-tag fallback as before.

**Why worth calling out.** A second self-caught regression in the same sitting as the smoke test
that found it — reinforces that touching shared extraction logic (title detection is used by
every `docs` page, not just the ones that motivated the change) always needs the FULL regression
sweep across every previously-working file, not just the file that prompted the change.

**Impact on downstream.** Verified final state: all 6 topic-2 problem titles correct, all 12
topic-1 titles unchanged (including the video-companion page's title, now correctly restored).

---

*Decisions are appended here as the build progresses. See `HANDOVER.md` §5 for when to write a
new entry.*
