# Round 1 — kit-internal consistency and change impact

Lens: if the four drafts were adopted, what would they collide with in `tins-kit/`, and what would have to change?
All runs were on scratch copies under `/tmp/claude-1000/.../scratchpad/r1-consistency/` (`kit`, `k1`, `t1`..`t6`, `flow`). Nothing in the repo was modified except this file. Paths below are relative to `tins-kit/`.

## 1. Verdict

The two pattern-shaped drafts would pass the kit's format gate unchanged, but that gate is much weaker than the kit's own docs claim, and it is not what stops adoption. What stops it is that three of the four drafts are designs for kit machinery (new scripts, front matter, a ledger tree, a role/adapter model). The kit has no intake path for scripts, templates, schemas or edits to existing files. Its decision procedure (D24) also requires a SPEC row, a validator check and a selftest case for each, and it has no single canonical copy to land them in. The kit is also already inconsistent with itself (stale counts, a split-brain kit root, claimed checks that do not exist), so adding to it without fixing that first would widen the drift.

## 2. Problems

### Critical

**C1. A consumer cannot propose a change to an existing kit file, or add a script, template or schema.**
- Evidence (verified, walked in `flow/`): I scaffolded a shell and put the four drafts in `lib/patterns/`, a new `scripts/ledger.mjs`, `schemas/session-record.schema.json`, `templates/SESSION-LEDGER.md`, a `prompts/RECONCILER.md`, an empty-ish `lib/ledger-mod/`, and a modified `scripts/orchestrate.mjs`. `kit-staging-export.mjs` shipped only `BUILDER-DECISIONS-REVIEW.md`, the 4 patterns, the prompt and the marker (`scripts/kit-staging-export.mjs:92-134`). Scripts, schemas, templates, docs, the orchestrate edit and the module were dropped without a warning.
- `kit-ingest.mjs` then found 5 candidates (4 patterns, 1 prompt). It handles only patterns, modules, prompts, BDR sections and `kit-growth-candidates.md` (`scripts/kit-ingest.mjs:113-200`). `kit-staging/README.md` lists "the 4 things" (it then lists five rows).
- `prompts/KITTING-REVIEW.md` and `KIT-GROWTH-SESSION.md:80-85` triage only "new pattern / does it duplicate". They have no "amend an existing file" disposition. `docs/KITTING.md` Anti-pattern 3 forbids editing an existing pattern in place.
- Fix: add a patch lane. Export gains a `proposals/` directory (a unified diff against a named kit version, plus a rationale file). Ingest gains types `script|template|schema|doc|patch` and applies the patch to a scratch copy, runs the gate there, and reports pass or fail. KITTING-REVIEW gains an "amend existing" rubric. Without this the key proposals (changing `orchestrate.mjs:388`, `validate.mjs`, `kit-coverage.mjs`) have no route in.

**C2. There is no single kit to land in, and no version identity.**
- Evidence: `BUILDER-DECISIONS-REVIEW.md` D33-D35 (lines 883-1046) records three divergent copies (atal-incubation "canonical", the Jayshankar vendored copy, the class-fun-ef copy). The Jayshankar copy was more advanced, so it was pushed up with `kit-sync.mjs`. That tool has no exclusion flag and overwrites by hash with no merge (`scripts/kit-sync.mjs`). `VERSIONING.md` Rule 5 says the kit has no git ("filesystem-versioned"). Here `tins-kit/` is gitignored with no `.git` of its own, so git cannot be used to apply or diff proposals. The shell marker hardcodes `kitVersion: '2.0'` (`kit-new-project-shell.mjs:~150`) and `.kit-sync.json` carries no version or hash.
- Fix: before any growth work, stamp a version and content hash (a generated `KIT-VERSION`, written into `.kit-sync.json` and the shell marker). Make a patch say which version it is against. State which tree is canonical.

### High

**H1. The proposal contradicts D24 and the kit's admission rules as written.**
- D24 (`SPEC.md:95`): every change needs a §8.X criterion, a validate check and a selftest case. Four drafts imply roughly 4 new D rows (next free is D37), and `scripts/ledger.mjs` needs all three.
- `docs/KITTING.md` header (3-question test) and `lib/patterns/kit-self-application.md:161` ("2-consumer rule is non-negotiable") reject single-consumer, unbuilt patterns. All four drafts say "one consumer" and "unbuilt, untested". Counter-precedent: BUILDER D31 absorbed `manual-relay-worker-loop` as single-consumer with the status stated in its source note, and `third-party-tool-audit` was absorbed with no reference-project evidence. So admission is possible if the drafts keep that honest label. But `kit-modes-audit-and-redesign` and `pattern-lifecycle-reuse-loop` are designs, not recipes. Per `AGENTS.md:179-181` (non-pattern-shaped lessons) they belong in `docs/GAP-ANALYSIS.md` as "future". Counter-risk: if they enter `lib/patterns/`, `kit-coverage` and `new-project.mjs` hand them to every consumer as recipes.

**H2. "Front matter in every pattern" collides with five kit parts, though not the validator.**
- Verified: YAML front matter on a pattern leaves validate at 73/0/0 (T1). Renaming `## 1. The 3 lessons, in detail` to `## 1. Lessons` also passes (T2). The validator checks only `## 0. Why this exists`, at least 3 numbered `##` sections, a "When this" `##` section, and the footer (`scripts/validate.mjs:327-356`). D19 and `SPEC.md:1286` say it parses the exact headings; it does not.
- `kit-ingest.mjs:~135` uses exact `includes('## 1. The 3 lessons')`. The same renamed heading was silently dropped from ingest with no warning (3 of 4 candidates). Two parsers disagree about one rule.
- `kit-coverage.mjs:67-117` holds a hardcoded `KEYWORDS` map for 20 files. The newer patterns (`tiered-escalation`, `manual-relay-worker-loop`, `kit-self-application`, `third-party-tool-audit`) have no entry, so they can never match. This is the existing instance of the problem the lifecycle draft names, and it shows the cost of metadata kept apart from the pattern.
- `validate.mjs` is D3 zero-dep, so reading YAML needs a hand-written mini-parser or a restricted subset.
- Generated fields (`used_by`, `verified`) written into pattern files edit patterns in place. That breaks `docs/KITTING.md` Anti-pattern 3 and makes every `kit-sync` overwrite every pattern. Keep generated data in a sidecar such as `lib/patterns/_meta.json`.
- A `lib/patterns/INDEX.md` or `README.md` fails §8.13 (T5: 2 failures), so a generated index must live elsewhere.
- Fix: amend D19, `validate.mjs`, `kit-ingest.mjs`, `kit-coverage.mjs`, `kit-new-pattern.mjs` and `kit-listing.mjs` in one change, with one shared pattern parser and a selftest.

**H3. The "ledger" duplicates and collides with what the kit already ships.**
- `delegation/LEDGER.md` is the D32 state machine. `orchestrate.mjs`, `escalate.mjs` and `check-task-independence.mjs` parse it as one markdown table, and the auditor is its only writer (`prompts/WORKER-SESSION.md:178-181`). Workers already write one file per task: `delegation/tasks/<id>/NOTES.md` and `status.md` (`WORKER-SESSION.md:155-170`). `INTEGRATE-DELEGATED-WORK.md` already merges one task at a time and re-runs the gate (lines 60-80, 131-150), which is the "reconciler" the session-ledger draft proposes. A new `ledger/` tree would also give the word "ledger" two meanings.
- `check-task-independence.mjs` reads touched files from the LEDGER table only. The draft's claim that it will predict conflicts from per-session files is false as written.
- Fix: extend `NOTES.md`/`status.md` with machine-derived front matter (base, head, numstat, gate exit code, model as launched) instead of a new `ledger/` tree, or rename the new tree and document the relationship. Say that the proposal changes WORKER-SESSION Step 7, which currently has the worker self-report its gate result.

**H4. `ledger.mjs` and git assumptions conflict with the kit's stance.**
- No kit script calls git (`grep "'git'" scripts/*.mjs` is empty), and `worktree` appears nowhere (the only hint is `DELEGATE-WORK.md:139`, "a separate branch/checkout"). D3 forbids npm packages, not binaries, so shelling out to git is legal. But the kit's own Rule 5 is "no git" and `.github/workflows/validate.yml` contradicts it. The kit's gate for itself could not use a ledger check.
- `orchestrate.mjs:388` hardcodes `tins-kit/prompts/WORKER-SESSION.md` relative to cwd (the draft's claim is verified). It would also break in a `.kit-shell` layout, where prompts live under `.kit-shell/prompts/`.
- Fix: add a documented D3 note ("binaries on PATH are allowed if probed") and give `orchestrate.mjs` a per-task `promptFile` field.

### Medium

**M1. New assets must be hand-added to at least six hardcoded rosters.** `new-project.mjs` (script list around lines 140-150), `kit-new-project-shell.mjs:`shellFiles` (a new script is absent from the portable shell, so it never reaches remote or GUI-relay consumers), `validate.mjs` `expectedScripts` and `order`, `INDEX.md`, `kit-coverage` `KEYWORDS`, and `kit-listing`. T6 verified: a script importing the `yaml` npm package, with INDEX count set to `(3)`, still passes `--all`. D3 and INDEX freshness are not mechanically enforced.

**M2. Existing defects in the paths the proposal would use.**
- `kit-new-project-shell.mjs:87` copies `templates/AGENT-BRIEF.md`, which does not exist (it is `PROJECT-AGENT-BRIEF.md`). The existence guard hides it, so the shell has no `AGENT-BRIEF.md` while its README says to read it (verified in `flow/proj`).
- `kit-staging-export` copies every `*.md` in the consumer's `lib/patterns/`. `new-project.mjs` copies all kit patterns there, so a scaffolded consumer re-exports the whole kit as "candidates" (code-read, not run). `kit-ingest` does not dedupe against the kit.
- `selftest.mjs:20` resolves from `process.cwd()`. Run from `/tmp` it gave 12 pass, 44 fail (verified). `AGENTS.md:27` says "validate.mjs && selftest.mjs both exit 0", but bare `validate.mjs` exits 1 (it needs `--spec` or `--kit`).
- `kit-ingest.mjs`: `id: D${idMatch[1]}` double-prefixes an id already matching `D?\d+`, and the triage template numbers `C${i+1}` per project but lists globally.

**M3. Anything the proposal numbers or counts will drift unless generated.** See section 3.

### Low

- The lifecycle draft says there are five modes. `EXECUTION-MODE-INTERVIEW.md` says five, but `validate.mjs:91,977` labels the check "all 6 execution modes". The draft is right and the kit is internally inconsistent.
- `validate.mjs` help text numbers §8.13a-c differently from `SPEC.md:1286-1292`. The documented §8.13c absorption-table check is not implemented (the four drafts passed with no §0.4 rows). BUILDER D31 relied on that check.

## 3. Stale counts and self-description (verified by listing and grep)

| Source | Patterns | Other claims |
|---|---|---|
| Filesystem / `kit-listing` | 24 | 24 prompts, 22 scripts, 20 template files, 4 schemas, 7 lib modules (listing's "lib: 42" double-counts patterns; "140 files") |
| `INDEX.md:30` | 23 (omits `manual-relay-worker-loop`) | 24 prompts, 19 templates, 20 scripts |
| `AGENTS.md:18,44` (last modified 2026-08-15) | 20 | 3 lib modules, 7 prompts, 8 templates, 10 scripts, "24 decisions", "4 deferred modules not built" |
| `SPEC.md:526` | 21 | has D1-D36 |
| `HANDOVER.md:121` vs `:206` | 23 vs 21 | state snapshot says "verify" and was never filled |
| `HANDOVER.md` header | "Last updated 2026-08-26, session 16" | file touched 2026-09-10; BUILDER logs D35 on 2026-09-12 |

There are also two numbering systems inside the kit: SPEC D1-D36 versus BUILDER D1-D35, offset by about 6 (BUILDER D31 cites "D32's dispatch gap", which is SPEC D32). This is the same hazard Jayshankar's AGENTS.md warns about. The only computed count in the kit is the triage report's "Kit already has: N patterns", and it is the one that is right.

Recommendation: generate. `kit-listing --json` is already the single source. Have `INDEX.md` counts, the AGENTS.md/HANDOVER snapshot and the triage report written from it, and add a validate check that fails when a pattern is missing from INDEX or a count differs.

## 4. Does the kit practice what it proposes?

No. `HANDOVER.md` is 1,058 lines/70 KB (§5 work queue alone is lines 296-1009, with addenda stacked into the header), `BUILDER-DECISIONS-REVIEW.md` is 1,046 lines/93 KB, and `SPEC.md` is 148 KB. The single-writer, single-big-file, hand-numbered pattern the drafts criticise is the kit's own. `decision-log.mjs` allocates "next D<n>" by scanning the whole file, which is exactly the numbering authority the draft says breaks under parallel agents. This supports the proposal's diagnosis, but it also means the kit has no worked example of the proposed layout.

## 5. What survives

- All four drafts pass the kit's real pattern gate: validate `--kit` 73/0/0 and selftest 56/56 with them copied in (28 patterns). They pass `kit-ingest` as 4 candidates and the footer and heading checks.
- The kit is green today: `validate --kit` 73 pass, `validate --spec SPEC.md` 83 pass, selftest 56/56 from inside the kit.
- The drafts' factual claims about the kit check out: `kit-coverage`'s keyword limitation, `orchestrate.mjs:388` hardcoding, the cwd dependency of selftest, and the single-file logs are all real and match the drafts.
- Precedent exists for a single-consumer, honestly labelled pattern (BUILDER D31).

## 6. Unverified

- Whether `git worktree` works on this mount (another lens covers it).
- Whether the real canonical kit (atal-incubation) is reachable or differs from this copy; I did not read `C:\Users\user\Desktop\TINS-projects\`.
- The re-export flood in M2 (code-read only; not run with a scaffolded consumer).
- Whether Windows CRLF breaks the validators' regexes (not tested).

## 7. Top 5 changes to the kit first

1. Fix the existing drift and generate counts: add `KIT-VERSION` plus content hash, make INDEX/AGENTS/HANDOVER counts come from `kit-listing --json`, implement the §8.13c and INDEX-completeness checks, and fix the `AGENT-BRIEF.md` template name and the selftest cwd dependency.
2. Add the proposal intake lane (C1): export/ingest/KITTING-REVIEW support for scripts, templates, schemas, docs and patches against a named version, with the gate run on a scratch copy.
3. Settle one canonical root and the sync rule (C2), with a `kit-sync` exclude list and a version stamp, before any change lands.
4. Decide the pattern-metadata design once (H2): a shared zero-dep parser used by validate, ingest, coverage, listing and new-pattern; generated data in a sidecar, not in pattern bodies; D19 amended with it.
5. Land the session record inside the existing `delegation/tasks/<id>/` structure (H3/H4): derived facts in `status.md` front matter, a `promptFile` field for `orchestrate.mjs`, a D3 note on binaries on PATH, and a decision on whether `kit-modes-audit` and `pattern-lifecycle-reuse-loop` go to GAP-ANALYSIS as "future" rather than into `lib/patterns/`.
