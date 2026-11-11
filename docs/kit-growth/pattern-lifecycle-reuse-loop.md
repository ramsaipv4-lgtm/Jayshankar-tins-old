# `pattern-lifecycle-reuse-loop` — kit pattern (DRAFT v2, kit-growth candidate)

> **Status: DRAFT v2 — rewritten after round-1 review** (`rounds/round1-retrieval.md` above all; also
> `round1-redteam.md`, `round1-consistency.md`, `round1-economics.md`). The design's *direction* survived; the
> machinery it said it would "extend" was largely **not there**: `kit-ingest` parsed 0 candidates from this
> project's real decision log, `kit-coverage` missed **56%** of the patterns a human would apply, and the first
> draft's example metadata was wrong. The kit copy `_external/tins-kit-next/` builds the foundation (shared
> parser, front matter, `kit-coverage` v2, `kit-ingest` fix); the rest is **deferred on purpose** (§3).
>
> **Draft for `tins-kit/kit-staging/inbox/`. This repo never edits `tins-kit/` (AGENTS.md §6).** Copy to
> `lib/patterns/pattern-lifecycle-reuse-loop.md` when exporting.
>
> **The recipe for making the kit self-improving in practice:** each pattern carries *authored, cited*
> applicability metadata; a new project is *retrieved-for* at spec time and task time (not only offered a menu);
> retraction is possible; promotion stays a human decision with a *verifiably independent* second consumer; and
> the thing worth measuring is **pattern gaps found**, not "reinvention rate". The model's job on a new project
> becomes *fitting* a described implementation to it.
>
> **Source:** Jayshankar, 2026-10-02. One consumer. **Unbuilt beyond the foundation. Untested.**

---

## 0. Why this exists

The kit has both halves of the loop — kit → consumer (`new-project.mjs`, 24 patterns, `kit-coverage`, `INDEX.md`)
and consumer → kit (`kit-extract`, `kit-ingest`, `KITTING-REVIEW`, `KITTING`). Round 1 tested them against real
data and found the loop leaks at every joint:

1. **Retrieval was one keyword pass, and a bad one.** On three hypothetical specs (expense tracker, focus
   assistant, inventory app) `kit-coverage` found 12 of 27 applicable patterns (**miss rate 56%**); four of the
   24 patterns had no keyword entry and could never match; matching was by substring ("worlds" fired `rls`).
2. **Intake could not read the owner's own log.** `kit-ingest` splits on `\n##\s+` and the log uses
   `### Decision N —`: **0 candidates**. `kit-extract` returned 76 of 98 decisions as candidates, including all 16
   decisions that are the *source* of existing patterns — so "a close match to an existing pattern is a retrieval
   failure" would have scored every pattern's own origin as a failure.
3. **Patterns carry no machine-readable applicability.** And what looked easy was not: `solves` is extractable
   from the lede for ~21 of 24; `triggers` is invented vocabulary; **`verified` is impossible** (no pattern records
   a version or a date — the first draft's own example, `vite-plugin-pwa 0.20`, contradicted `package.json`'s
   `^1.3.0`); **`not_when` is not in the prose** ("When this changes" holds upgrade paths, not exclusions). A
   `not_when` filled by a model is *plausible and unsourced* — worse than empty.
4. **There is no retraction.** `kit-sync` never deletes destination files and the kit has no git; one wrong
   pattern would be copied into every future project, and a usage counter would make it look *more* validated.
5. **The two-consumer bar is forgeable** (`kit-ingest` takes the project name from the inbox folder name) and
   **there is no route for a consumer to change an existing kit file** — the export silently dropped scripts,
   templates, schemas and edits.

---

## 1. The 3 lessons, in detail

### 1.1 Metadata is authored and cited; generated data lives elsewhere

Front matter at the top of each pattern, parsed by **one** shared zero-dependency parser (validate, ingest,
coverage, listing, new-pattern all use it — round 1 found two parsers disagreeing about one rule):

```yaml
---
id: pwa-offline-graceful
solves: "make the app usable offline without building an offline write-queue"
triggers: [offline, pwa, service worker, intermittent connectivity, field staff]
assumes: [web app, HTTP backend]
not_when: ["writes must succeed while offline (cite: §0 — the pattern is read-offline only)"]
artefact: prose              # prose | template | module — module only if installed and tested in a consumer
derived_from: [jayshankar#26, jayshankar#27]
status: active               # active | deprecated | retracted
superseded_by: null
verified: null               # "YYYY-MM-DD: <command that was run>" or null — null beats guessed
---
```

Rules that came out of the backfill trial: `not_when` entries carry a **citation to the pattern text or a consumer
observation, or are omitted** (empty is fine); `verified` is null unless a command was actually run; `triggers`
use the vocabulary a spec would use, with synonyms. **Generated data (usage counts, `used_by`) is not written into
pattern bodies** — doing so edits every pattern on every sync and breaks `docs/KITTING.md` Anti-pattern 3; keep it
in a sidecar when there is data to keep. Retire the heading-literal check in `kit-ingest` (only 8 of 24 shipped
patterns passed it): front matter is the machine surface, prose stays free-form.

### 1.2 Retrieve when it can still change the work — and hand over a *scrubbed excerpt*, not a path

- **Spec time** — `kit-coverage` runs on the draft spec (today) *and* the interview answers.
- **Task time** — the planner runs `kit-coverage --task <brief> --json` and puts the **excerpt + `not_when`**
  of each hit in the task packet. Not a kit path: the external-packet scrubber rejects the string `tins-kit`, so a
  path-based `kit_refs` could never reach an external worker.
- **Decision time is retrospective** (decisions are written after the work — #90 says "logged retroactively"), so a
  warning there arrives after the code. Its value is the **pattern-gap** signal, not prevention.

`kit-coverage` v2: reads `triggers`/`solves` from front matter (no second hand-kept file), **word-boundary**
matching, ranked with a score floor, prints `not_when`, never returns a non-`active` pattern; indexing each
pattern's first ~35 lines recovered 5/9, 3/7 and 7/11 of the human sets on the three specs, vs 3/9, 1/7, 8/11 for
the keyword map — and surfaced `tiered-escalation` for the agent-with-approval-boundary spec. **Embeddings are
rejected at 24 patterns** (whole-body TF-IDF is dominated by hub documents); revisit if measured top-3 recall falls
below ~0.7 or the corpus passes ~50–100. Token-overlap on decisions is a *hint to a human*, never a gate
(top-1 precision ~0.55 / recall ~0.60 on a hand-checked sample); exclude a pattern's own `derived_from` sources.

### 1.3 Promotion is human and independent; retraction exists; measure gaps, not compliance

- **Promotion is a T2 decision** (`tiered-escalation.md`): externally visible to every future project and,
  without retraction, effectively irreversible. The **two-consumer bar stays**, but independence is verified by
  **repo URL + first-commit sha in the export manifest**, not the inbox folder name; `used_by` counts are never
  evidence of *correctness* (popularity ≠ validity).
- **Retraction:** `status: deprecated | retracted` + `superseded_by` + a reason; retrieval never returns a
  non-`active` pattern; `kit-sync` writes a **tombstone** in vendored copies and warns; the kit gets a version
  identity (`KIT-VERSION`, content hash) so a proposed change names what it is against; a **proposals lane**
  (a diff against a named kit version, applied to a scratch copy and run through the gate) is the sanctioned way
  to change an *existing* kit file.
- **Measure three things separately** (decisions need a `Date:` so "pattern existed first" is computable):
  *reinvented* (a decision re-derived an existing pattern), *applied*, and — **the most valuable** — *pattern gap
  found* (here: `CREATE OR REPLACE` silently creating a second function when the signature changes, #73, which
  `idempotent-migrations` does not cover; a `SECURITY DEFINER` function needing its own role check, #38, which
  `postgres-mutations` does not say). On this project "reinvention rate" would score ~0 *by construction* — it
  authored the patterns — so the metric needs a **second consumer** to mean anything.

---

## 2. The 3 known anti-patterns

1. **Auto-promoting from one project, or counting use as proof.** One project's accident becomes every project's
   rule and looks more validated as it spreads. Human triage; independent second consumer; retraction path.
2. **Per-ref dispositions that can be padded.** Kit gates are existence checks, so `applied` costs nothing to
   claim. If dispositions are ever built, `applied` must be *mechanically checkable* (a `fingerprint:` string the
   pattern names must appear in the session's diff), `rejected` must cite a `not_when` item or give a reason of
   real length, and ~20% are re-checked by a different model. They are **deferred** (§3): overhead was 20–140K
   cost-units per session and they measure nothing with one consumer.
3. **Treating pattern text as both "a recipe to follow" and "data, not instructions".** Patterns *are* meant to be
   followed — so only patterns with a **recorded promotion** are trusted recipes; inbox candidates, session
   bodies and `kit_refs` are untrusted data and are never executed as recipes. The kit's role prompts must say so.

---

## 3. When this pattern changes

- **Built in the kit copy now (foundation):** shared parser; front matter on all 24 patterns (honestly: `verified`
  null, `not_when` empty unless cited); `kit-coverage` v2; `kit-ingest` fixed + similarity hints; decision `Date:`;
  proposals lane; `KIT-VERSION`; tombstones.
- **Deferred until a second consumer (or ≥ 20 sessions of evidence):** dispositions, the reinvention/gap metric's
  automation, map-then-reduce, embeddings, per-pattern usage counters.
- **Pilot.** A *new* small project (the round-2 builds) and an *old* spec replayed: (a) does `kit-coverage` v2 at
  task time surface the right pattern; (b) does `not_when` ever block a bad fit; (c) how many decisions cite a kit
  pattern vs. re-derive one; (d) how many pattern **gaps** appear. If (a) does not beat the old one-pass
  `kit-coverage`, stop.
- **Single-consumer, unbuilt:** admissible to the kit only with an honest status line (the precedent is
  `manual-relay-worker-loop`); designs that are not recipes belong in `docs/GAP-ANALYSIS.md` as "future" so
  `kit-coverage` does not hand them to consumers as recipes.

---

*End of `pattern-lifecycle-reuse-loop` pattern.*
