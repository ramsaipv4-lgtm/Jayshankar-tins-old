# delegation/ — parallel work coordination for this project

> Bootstrapped 2026-09-10 from `tins-kit/templates/DELEGATION-README.md`. Read
> that file's own header first — this is the Jayshankar-specific adaptation of
> it, not a replacement.

**Author-side only.** Nothing in this folder is exported anywhere — Jayshankar
has no `external`-mode tasks (no hired outside contractor), so there is no
`packet/` scrubbing step in play here. Everything in `delegation/` can
reference this project's real `SPEC.md` / `HANDOVER.md` / methodology freely,
same as the kit's own convention.

`delegation/` is gitignored (see `.gitignore`'s "Methodology-internal docs"
block) — same treatment as `SPEC.md`/`HANDOVER.md`/`AGENTS.md`. It's part of
how this project gets built, not part of what ships.

---

## The setup: Claude (planner+auditor) + a worker LLM, dispatched per round

This project's real setup doesn't map onto tins-kit's five execution modes
cleanly, so read this section before touching `LEDGER.md`.

**Who's who:**
- **Planner + Auditor — Claude Sonnet 5 (this session, or a fresh one that
  reads this file), running in WSL2.** Decomposes locked spec work into one
  task at a time, writes a tightly-scoped brief, and — once the worker
  returns — verifies the result (runs the gate, checks every acceptance
  criterion, reads the code, runs the app and takes screenshots via the `run`
  skill where a visual check matters) before integrating it.
- **Worker — changes per round, recorded in `LEDGER.md`'s Assignee column
  for each task, not fixed project-wide.** T1–T8 (2026-09-10) used MiniMax
  M3, via the MiniMax Coder desktop application, on native Windows. T9
  onward (2026-09-18, Phase A UI redesign) uses **Cline CLI**
  (`/home/sai/.local/bin/cline`, WSL2 — same side as the planner/auditor,
  the user's explicit choice), a genuinely different situation from MiniMax
  Coder worth reading the next subsection for. Builds exactly one task per
  round. Nothing more.

**Why Cline CLI doesn't change the `self-parallel` mode designation, even
though it's a real CLI (unlike MiniMax Coder).** `ORCHESTRATION.json`'s own
comment names "the other platform gets a scriptable CLI" as the trigger for
reconsidering `auditor-remote` — checked this seriously, not dismissed.
`tins-kit/scripts/orchestrate.mjs` genuinely could shell out to `cline`
non-interactively (`--auto-approve true`, `-c <path>`, no TTY needed once
authenticated). But `orchestrate.mjs` hardcodes its prompt file to the
generic, placeholder-bearing `tins-kit/prompts/WORKER-SESSION.md` — it has
no mechanism to point at a project's own fully-written, per-task
`delegation/tasks/<id>/WORKER-PROMPT.md`, which is this project's whole
established brief convention (see below). Adopting real `orchestrate.mjs`
dispatch would mean reworking how every brief here gets authored, a bigger
change than "swap the executor." So: still `self-parallel` (no automated
wave dispatch), and dispatch stays user-driven exactly like the MiniMax
rounds — **the user runs and watches Cline themselves** (explicit
instruction: "dont control it i will copy paste"), it's just a shell command
now instead of a paste into a GUI chat window. Claude does not invoke `cline`
via its own tool calls for this project, on this or any future round, unless
asked again. See `LEDGER.md`'s 2026-09-18 entry for the exact command and
the auth blocker found before the first real T9 run.

**Why this is recorded as `self-parallel`, not `auditor-remote`, in
`LEDGER.md`:** `auditor-remote` (per `tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md`
§2) assumes `scripts/orchestrate.mjs` can shell out to the worker via a
`workerCmd` CLI invocation. MiniMax Coder is a GUI desktop app with no CLI
hook to script against — exactly the case that same file names as the
deciding factor for `self-parallel` instead ("their other platforms are chat
interfaces rather than CLIs the auditor could invoke"). So: no orchestrator
script, no automated dispatch. **The user is the relay** — copies the
planner's brief into MiniMax Coder, lets it work, copies MiniMax's output
back to Claude.

**Why the brief is `WORKER-SESSION.md`-shaped anyway, not the generic
`CONTINUE-TINS-PROJECT.md` hand-off `self-parallel` normally uses:**
`self-parallel`'s documented default is to paste the full
`CONTINUE-TINS-PROJECT.md` onboarding prompt into the other session and let
it self-direct through the normal pipeline. That's the right call when the
other session is a peer-strength model you trust to scope its own work. It's
the wrong call here: MiniMax M3 is the cost-optimized leg of this setup
specifically *because* it's cheaper, and `templates/ORCHESTRATION.json`'s own
note about `auditor-remote` applies just as much in spirit — "a weaker
worker model needs a tighter brief and a narrower task, and it fails subtly
and confidently rather than loudly." So each round's brief is built the way
`prompts/WORKER-SESSION.md` builds one for an auditor-dispatched worker:
one task, an explicit touched-file list, mechanically-checkable acceptance
criteria, an interface contract, and an explicit tier policy — even though
dispatch itself is manual. `delegation/ORCHESTRATION.json` is kept in this
folder purely to hold that tier policy and document the deviation; its
`workerCmd` is intentionally blank and `scripts/orchestrate.mjs` is not used.

**This is a genuine adaptation, not yet validated by a real run.** Per the
user's own plan: once this has actually been used on a real task, whatever
worked and whatever didn't should be written up and fed back into
`tins-kit/` (mirroring how `tins-kit`'s own delegation system already absorbed
lessons from its `examples/autonomous-todo-app/` first run — see that
folder's `RUN-DIGEST.md` for the precedent). Candidate write-up: a
`self-parallel` variant, or a new named mode, for "the other platform is a
GUI app, not a CLI, but you still want worker-tier brief scoping, not a full
autonomous hand-off."

---

## The cross-platform gotcha: WSL2 (planner) vs native Windows (worker)

This is a real, currently-undocumented gap in `tins-kit` (confirmed by a
2026-09-10 audit: `TOOLING-AUDIT.md`'s scope is tool/capability access, not
OS/platform — nothing in the kit currently covers this). Every brief handed
to MiniMax must restate it, because it does not carry over automatically:

1. **The project folder is physically the same folder on both sides.**
   `C:\Users\user\Desktop\Jayshankar` (what MiniMax Coder sees) and
   `/mnt/c/Users/user/Desktop/Jayshankar` (what Claude sees) are the same
   files on disk, via the WSL2 filesystem mount — not a sync, not a copy.
   A change either side makes is immediately visible to the other.
2. **`node_modules` is therefore also physically shared, and it is
   platform-specific.** Packages with native/compiled bindings (this
   project's dependency tree includes esbuild, Rollup, and other Vite
   toolchain pieces that ship per-platform prebuilt binaries) get installed
   for whichever OS last ran `npm install`. If Claude runs `npm install`
   from WSL (Linux binaries) and MiniMax then runs `npm run dev`/`build` on
   native Windows against that same `node_modules`, it will fail — and vice
   versa. **Whoever is about to run anything that touches `node_modules`
   should run `npm install` fresh first**, every round, rather than assume
   the last person's install is still valid for them.
3. **Zero-dependency Node scripts are safe.** `scripts/validate.mjs`,
   `scripts/selftest.mjs`, and everything under `tins-kit/scripts/` are pure
   Node ESM with no native deps (project standing rule, `AGENTS.md` §6) —
   these run identically on either side without an install step.
4. **Don't assume POSIX tools exist on the Windows side.** No `bash`,
   `grep`, `sed` unless MiniMax Coder's own environment happens to provide
   them. Stick to `npm`/`node` commands and whatever MiniMax Coder's own
   built-in tooling offers; don't hand it a bash one-liner as if it were a
   given.
5. **Git**: this repo now has git history (`git init` + first commit,
   2026-09-10). Both sides can use it fine — it's just files on disk like
   everything else — but be explicit in every brief about what should and
   shouldn't be committed (see `.gitignore`; don't let a Windows-side commit
   accidentally stage something the WSL side always excluded, e.g. by using
   `git add .` inside an IDE that ignores `.gitignore` case-sensitivity
   quirks — unlikely here, but worth a glance the first time).

## The flow, per round

1. **Claude (planner)** picks the next task from the locked spec (or the
   user names one), writes it into `LEDGER.md` as a new row, and writes a
   `WORKER-SESSION.md`-shaped brief — see `tins-kit/prompts/WORKER-SESSION.md`
   for the exact shape being adapted — into
   `delegation/tasks/<id>/WORKER-PROMPT.md`, including the environment note
   above verbatim.
2. **User** copies `WORKER-PROMPT.md`'s content into MiniMax Coder, lets
   MiniMax M3 build it, and copies whatever MiniMax produces (code changes +
   its own notes/summary) back — dropped into
   `delegation/tasks/<id>/returned/`.
3. **Claude (auditor)** reads the returned work and MiniMax's own notes,
   re-verifies independently (runs `node scripts/validate.mjs`,
   `npm run selftest`, `npm run build`/`typecheck`, checks every acceptance
   criterion itself, and — where a visual/behavioral check matters — runs
   the app and takes screenshots via the `run` skill), writes
   `delegation/tasks/<id>/AUDIT.md` with the verdict, and either integrates
   (folds the result into the real `BUILDER-DECISIONS-REVIEW.md`, updates
   `HANDOVER.md`, marks the `LEDGER.md` row `integrated`) or sends it back
   with specific, concrete fixes needed.
4. Repeat for the next task/round.

## See also

`LEDGER.md` (the live table), `ORCHESTRATION.json` (tier policy — `workerCmd`
intentionally unused here), `ESCALATIONS.md` (open questions), `TOOLING-AUDIT.md`
(project root — what this setup can and can't confirm about MiniMax Coder's
own environment), `tins-kit/prompts/WORKER-SESSION.md`,
`tins-kit/lib/patterns/tiered-escalation.md`.
