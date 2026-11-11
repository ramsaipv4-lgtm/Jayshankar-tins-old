# `kit-modes-audit-and-redesign` — kit pattern (DRAFT, kit-growth candidate)

> **Draft for `tins-kit/kit-staging/inbox/`. This repo never edits `tins-kit/` (AGENTS.md §6).** Copy to
> `lib/patterns/kit-modes-audit-and-redesign.md` when exporting.
>
> **What the kit's execution modes cover, where they fall short for a multi-model, multi-harness, multi-agent
> project, and the shape I would give the kit if I were building it fresh — as a design to confirm with a pilot,
> not a finished system.** Companion to `role-routed-records.md`.
>
> **Status: DRAFT v2 — revised after round-1 review.** Several gaps below turned out to be worse than first
> stated (the dispatcher delivers an *unfilled template*, not merely "can't take a per-task prompt"); the kit
> copy `_external/tins-kit-next/` implements fixes — see `docs/changes/round1-*.md` there.
>
> **Source:** Jayshankar, read on 2026-10-02 against `tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md`,
> `lib/patterns/tiered-escalation.md`, `lib/patterns/manual-relay-worker-loop.md`,
> `templates/ORCHESTRATION.json`, `scripts/orchestrate.mjs`, `lib/docs-guardian/`, and this project's own
> `delegation/` (a Claude planner/auditor with MiniMax M3 then Cline CLI as workers, relayed by hand).

---

## 0. Why this exists

The kit's five modes were designed around one question — **who is in the loop?** That was the right first
question. This project hit a second one the modes don't answer: **which model should do which *kind* of work,
and how do several harnesses share what each learned?** Each gap below was met in a real round, not imagined.

What the kit covers today (five modes, per `EXECUTION-MODE-INTERVIEW.md`; this repo's `delegation/README.md`
says "six", which is wrong):

| Mode | Orchestrator | Worker |
|---|---|---|
| `solo` | the user + one session | the same session |
| `auditor-local` | an auditor session | native subagents, same harness, unattended |
| `auditor-remote` | an auditor session | another provider's CLI via `workerCmd` (presets: Claude Code, Codex, Gemini CLI) |
| `self-parallel` | **the person** | the person's other sessions, full context |
| `external` | the person | someone else, from scrubbed packets |

Plus, around the modes: tiered escalation T0/T1/T2 (by reversibility), a manual-relay recipe for a GUI-only
worker, `docs-guardian` (stale-keyword check), `decision-log.mjs`, and the kit-staging inbox for growth.

---

## 1. The 3 lessons, in detail

### 1.1 Where the kit falls behind (each observed here)

1. **Modes encode who orchestrates, not which model does what.** There is no role→model routing; the only
   guidance is "a weaker worker needs a tighter brief". Nothing says the *scribe*, *verifier* or *reviewer* may
   be different models from the *builder*, and nothing records which model did what (the ledger has no
   model, token or cost column).
2. **`orchestrate.mjs` delivers an unfilled template** (verified round 1, `round1-harness` C1). It hardcodes the
   generic `WORKER-SESSION.md` and only substitutes `{{TASK_ID}}`/`{{PROMPT_FILE}}` in the *command*; the worker's
   prompt still contains the literal `{{TASK_BRIEF}}`. The cross-harness path (`auditor-remote`) has therefore
   never worked end to end — the only real autonomous run used native subagents. It also uses `$(cat file)`,
   which fails on Windows `cmd`/PowerShell and on long prompts, and `shell:true`. This project had a scriptable
   CLI (Cline) and stayed hand-relayed for the same underlying reason. *Fix:* render a per-task `PACKET.md`
   (fail if any `{{…}}` remains) and hand the worker a short pointer or stdin.
3. **No adapter model for harnesses.** Three CLI presets plus a prose recipe for GUI apps. A fourth CLI means a
   hand-built `workerCmd`; the GUI case isn't a first-class "adapter that prints a packet and waits for a
   result file".
4. **Memory has no schema.** `docs-guardian` checks that docs *mention* keywords. It cannot check that
   references resolve, ids are unique, or that state is newer than the records it should reflect. Three
   numbering systems and a stale "not built" line survived in this repo for exactly that reason.
5. **Records are single files and single-writer.** Parallel agents contend on `BUILDER-DECISIONS-REVIEW.md` and
   `HANDOVER.md`; the ledger that coordinates them was gitignored.
6. **Not portable.** `tins-kit/` and `delegation/` are gitignored here; a second machine or harness starts
   without the kit prompts or the ledger.
7. **The kit's own gate disagrees with its docs** (round-1 consistency): five modes in the prompt, "all 6
   execution modes" in `validate.mjs`; pattern counts of 24 / 23 / 21 / 20 in four places; `selftest` failed 44
   of 56 from a consumer root (fixed in the kit copy — it now derives the kit root from its own path); no route
   for a consumer to propose a change to an *existing* kit file or to add a script/template (the export silently
   dropped them). Generate counts; add the proposals lane.
8. **Kit quality items found in use:** `migration-runner.mjs` calls `require()` in ESM; the kit's selftest
   depends on the working directory (both recorded in BUILDER decision #92 in this repo).

### 1.2 What I would build from scratch — protocol first, modes as presets

- **Records, typed.** (Round 1 narrowed this: session records live in a tracked `sessions/` directory, one file
  per session — `session-ledger-worktree-reconcile.md`.) `records/<type>/<id>.md` with front matter (`id`, `type: decision|finding|gotcha|state|
  claim|task|kit-candidate`, `status`, `supersedes`, `refs`, `evidence`, `author: {model, harness}`, `date`).
  One file per record; `INDEX.md` and `HANDOVER` snapshot are *generated*. (`role-routed-records.md`.)
- **Roles are capabilities, not products.** `planner` (judgement, owns locked decisions), `builder`,
  `verifier`, `scribe` (renders facts), `reviewer`. A `roles.json` maps each to a harness+model list with an
  escalation order — cheap first, escalate on gate failure. This is a *second* tier axis alongside T0–T2
  (reversibility) and the two must stay separate.
- **One adapter interface.** `run(packet) → exit code + result file`. Adapters: Claude Code, Codex, Gemini,
  Cline, Aider, and `relay` (print the packet, wait for the result file — the GUI/human case). The five modes
  become **presets over `roles.json` + adapters + a human-in-loop flag**, so a sixth never needs new prose.
  Every task has its own prompt file the dispatcher is told about.
- **A context-pack compiler.** `kit context <task>` walks the `refs` graph from the task and emits a read list
  with a size budget, so a fresh model of any kind starts from ~10 files, not the repo.
- **Concurrency by git, not by hope — with the environment named.** A worktree contains only *tracked* files, so
  a gitignored `tins-kit/`, `delegation/`, `node_modules` and `.env` are absent from it; its `.git` pointer holds
  an absolute path, so a worktree made from WSL on `/mnt/c` cannot be used from native Windows git. Details and
  the `doctor` check in `session-ledger-worktree-reconcile.md`. A worktree per task, a `claim` record per task, records never edited in
  place by two agents (supersede instead), generated files regenerated not merged.
- **A wider gate.** Schema, reference resolution, id sequence, snapshot freshness, secret scan, plus the
  existing validator and selftest — all runnable by any harness with no model involved.
- **Growth without a zip.** `kit-candidate` records are typed, so the kit-staging inbox reads them directly.

### 1.3 What I would *not* build

A vector store or "second brain" over raw transcripts: it indexes the noisiest, least reliable layer, leaks
secrets, and answers the wrong question. Embeddings are an optimisation for when link-following over typed
records demonstrably fails to find something. Obsidian is a fine *viewer* of the same markdown; it isn't the
mechanism.

---

## 2. The 3 known anti-patterns

1. **Adding a mode for every new harness.** Modes multiply; adapters don't. A new tool is an adapter and a
   `roles.json` line, not a new section of prose.
2. **Routing by model brand in prose ("use Haiku for docs").** Brands change monthly; route by role and
   capability, keep the brand in one config file, and re-verify the CLI flags each time (the kit's own
   `_workerCmdPresets` note says so).
3. **Building the whole design before measuring one piece.** Everything above except §1.3 is untested. The cheap
   first slice is *typed records + validator + `kit context`*; if that doesn't cut a fresh session's reading,
   the rest isn't justified.

---

## 3. When this pattern changes

- If a second consumer shows the same gaps in §1.1 (this is one consumer), promote §1.1 to pattern-level and
  split §1.2 into its own tickets.
- If a standard for shared agent memory emerges that several harnesses read, adopt it as the transport instead
  of `records/`.
- Pilot order: (1) records + validator on this repo; (2) `kit context`; (3) the adapter interface with two
  adapters; (4) role routing with cost logged per task. Stop at the first step that does not pay.

---

*End of `kit-modes-audit-and-redesign` pattern.*
