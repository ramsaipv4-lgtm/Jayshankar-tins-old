# VERSIONING.md — how the kit and its projects are versioned

> **Read this if you are wondering: which kit is the source of truth? how do
> I sync changes? what if a consumer changes their vendored copy?**
>
> **The 30-second answer:** the top-level `tins-kit/` is the source of
> truth. Each consumer project has a `tins-kit/` vendored copy at
> `<project>/tins-kit/`. The `scripts/kit-sync.mjs` script pushes changes
> from the top-level to a project's vendored copy (and pulls back via
> `scripts/kit-extract.mjs`).

---

## 1. The layout

```
C:\Users\user\Desktop\TINS-projects\atal-incubation\   ← the workspace root
├── tins-kit\                                          ← THE SOURCE OF TRUTH (D1)
│   ├── SPEC.md, HANDOVER.md, AGENTS.md, PIPELINE.md
│   ├── lib\, prompts\, scripts\, schemas\, templates\, docs\
│   └── .github/workflows/validate.yml
│
├── Jayshankar\                                        ← consumer #1 (fish wholesale)
│   ├── tins-kit\                                      ← vendored copy
│   ├── SPEC.md, HANDOVER.md, BUILDER-DECISIONS-REVIEW.md
│   ├── lib\, prisma\, src\, supabase\
│   └── (the project's own code)
│
├── incubos\                                           ← consumer #2 (multi-tenant SaaS)
│   ├── tins-kit\                                      ← vendored copy
│   ├── SPEC.md, HANDOVER.md, AGENTS.md, BUILDER-DECISIONS-REVIEW.md
│   ├── docs\, scripts\
│   └── (the project's own code)
│
├── Data-cleaning-script\                              ← consumer #3 (CSV cleaner)
│   ├── tins-kit\
│   └── (the project's own code)
│
├── package5\                                          ← consumer #4 (study plan)
│   ├── tins-kit\
│   └── (the project's own code)
│
├── exam-forge\                                        ← consumer #5 (study app)
│   ├── tins-kit\
│   └── (the project's own code)
│
├── archive\                                           ← reference projects (read-only)
│   ├── exam-forge-reference\                          ← canonical exam-forge, locked
│   └── atal-incubation-reference\                     ← canonical atal-incubation, locked
│
├── docs\, scripts\, specs\, TINS-MCP\, memory\         ← shared top-level files
├── README.md, HANDOVER.md, AGENTS.md, TRAININGS.md, ASSESSMENT.md
└── ...
```

The kit is at the top level. Each consumer is a sibling. The kit is
vendored inside each consumer at `<project>/tins-kit/`. The 5 consumers +
the kit are all the same level — no nesting, no parent-child.

---

## 2. The rules

### Rule 1 — The top-level `tins-kit/` is the source of truth

Any change to the kit's source code (a new pattern, a new module, an
updated SPEC.md, a fix to a script) is made at the top-level
`tins-kit/`. The vendored copies in each project are **not** the source.

If you find a bug in `<project>/tins-kit/scripts/validate.mjs`, the
fix goes to the top-level `<root>/tins-kit/scripts/validate.mjs`, then
gets synced to all the projects. Never fix the vendored copy.

### Rule 2 — Vendored copies are read-only for the kit, writable for the project

A consumer project reads its `<project>/tins-kit/` to understand the
kit's patterns and modules. The project does NOT edit
`<project>/tins-kit/` to fix a bug — that's the source's job (per Rule 1).

A consumer project MAY add project-specific files INSIDE
`<project>/tins-kit/` if the kit is the natural home (e.g. a project-
specific script that wraps a kit script). But these are exceptions, not
the rule, and they should be documented in the project's
`BUILDER-DECISIONS-REVIEW.md`.

### Rule 3 — `kit-sync.mjs` pushes the top-level kit to a project's vendored copy

When the kit grows, the vendored copies are stale. Run:

```bash
# At the kit root
node scripts/kit-sync.mjs --to=../Jayshankar
node scripts/kit-sync.mjs --to=../incubos
node scripts/kit-sync.mjs --to=../Data-cleaning-script
node scripts/kit-sync.mjs --to=../package5
node scripts/kit-sync.mjs --to=../exam-forge
```

The script copies the top-level `tins-kit/` files into the target
project's `<project>/tins-kit/`. It is **additive + update** — it does
not delete files the project has added.

### Rule 4 — `kit-extract.mjs` pulls a project's learnings back to the kit

When a consumer records a kit-worthy decision, the kit-growth session
runs:

```bash
# At the kit root
node scripts/kit-extract.mjs --consumer=../Jayshankar
# → writes Jayshankar/kit-growth-candidates.md
```

The session triages the candidates via `prompts/KITTING-REVIEW.md`. The
accepted ones are added to the top-level kit via
`prompts/KITTING.md` + `scripts/kit-new-pattern.mjs`. Then `kit-sync.mjs`
pushes the new kit to all the other projects.

### Rule 5 — The kit is "filesystem-versioned" (no git for v1)

The kit does not have a git repo (per the original kit's D2 / "no
backend by default" rule, applied to version control). The "version
history" is:

- `HANDOVER.md`'s "Last updated" header (per-session timestamp)
- `BUILDER-DECISIONS-REVIEW.md` (per-decision audit trail)
- `SPEC.md`'s "Predecessor documents" footer (per-version snapshot)
- `docs/GAP-ANALYSIS.md` (per-session gap analysis)

When a future kit version is needed (a major breaking change), the
top-level kit is copied to `tins-kit-archive/<version>/` and a new
top-level `tins-kit/` is started. The "version" is a directory name
with a date + semver tag (e.g. `tins-kit-2026-08-15-v2.0/`).

Consumers are git-versioned if the consumer's team wants to (the kit
doesn't mandate a VCS, but git is the obvious choice for any
non-trivial project). The top-level `tins-kit/` is filesystem-only.

### Rule 6 — Each consumer has its own `HANDOVER.md` + `BUILDER-DECISIONS-REVIEW.md`

The kit's `templates/HANDOVER.md` + `templates/BUILDER-DECISIONS-REVIEW.md`
are the templates. Each consumer copies them to its own root. The
consumer's HANDOVER is project-specific; the kit's HANDOVER (at
`tins-kit/HANDOVER.md`) is kit-specific. They are independent.

When the kit's templates change (e.g. a new section in
BUILDER-DECISIONS-REVIEW.md), `kit-sync.mjs` does NOT touch the
consumer's existing BUILDER-DECISIONS-REVIEW.md — that would lose the
consumer's history. The new template is in the vendored
`tins-kit/templates/`, and the consumer can opt to migrate.

### Rule 7 — Reference projects in `archive/` are read-only

`archive/exam-forge-reference/` and `archive/atal-incubation-reference/`
are the canonical reference projects. They are NOT to be modified. They
are the historical record of "what the kit was built from."

---

## 3. The kit-sync.mjs script

`scripts/kit-sync.mjs` is the workhorse. It:

1. Takes `--to=<path>` (the target project root; the script will write to
   `<path>/tins-kit/`).
2. Computes the diff between the top-level `tins-kit/` and the
   project's vendored copy.
3. Copies new + updated files to the vendored copy.
4. Preserves project-added files (does not delete).
5. Prints a summary: N files added, M updated, K preserved.

```bash
# At the kit root
node scripts/kit-sync.mjs --to=../Jayshankar
# → "Synced: 3 added, 7 updated, 95 preserved (105 total)"

# At a consumer root (forward sync — pull the latest kit)
node tins-kit/scripts/kit-sync.mjs --to=./tins-kit
# (the script detects the parent kit as the source)

# JSON output for CI / scripts
node scripts/kit-sync.mjs --to=../Jayshankar --json
```

**The script is idempotent** — running it twice is the same as running
it once (no double-add, no double-update).

**The script does NOT touch** the consumer's `SPEC.md`,
`HANDOVER.md`, `BUILDER-DECISIONS-REVIEW.md`, `lib/`, `src/`, `prisma/`,
or any other project-specific file. It only touches
`<project>/tins-kit/`.

---

## 4. The auto-extraction loop (D17)

The full loop, end-to-end:

```
+--------------------+         +---------------------+
|                    |         |                     |
|  Consumer Project  |         |   Top-level Kit     |
|  (Jayshankar etc.) |         |   (tins-kit/)       |
|                    |         |                     |
+--------+-----------+         +----------+----------+
         |                               ^
         |  1. Build + record decisions   |  4. kit-extract.mjs
         |     in BUILDER-DECISIONS-     |     reads the consumer's
         |     REVIEW.md                  |     decisions
         |                               |
         v                               |
+--------+-----------+                   |
|                    |   2. Mine         |
|  Project's own     |   (auto-extract   |
|  code + vendored   |   from project)   |
|  tins-kit/         |                   |
|                    |                   |
+--------+-----------+                   |
         |                              |
         |  3. Triage                    |
         |     (KITTING-REVIEW.md)      |
         |                              |
         v                              |
+--------------------+        5. KITTING.md lands the new pattern
|                    |           in the top-level kit
|  Kit growth        |------------------->+
|  session           |                   |
|  (LLM at kit root) |        6. kit-sync.mjs pushes the new kit
|                    |           to every project's vendored copy
+--------------------+           (Jayshankar, incubos, etc.)
```

**The loop runs as often as needed.** Every consumer that finishes Mode
A triggers it. The kit grows by 1-10 patterns per consumer session.

---

## 5. A worked example (the 2026-08-15 restructure)

Session 9 (this one) restructured the workspace:

**Before:**
```
atal-incubation/
├── Jayshankar/
│   ├── tins-kit/                  ← the kit, nested
│   ├── Data-cleaning-script/      ← nested project
│   ├── package5/                  ← nested project
│   ├── archive/
│   │   └── exam-forge-reference/  ← nested reference
│   └── ...
├── incubos/
│   └── ...
└── ...
```

**After:**
```
atal-incubation/
├── tins-kit/                      ← lifted, source of truth
├── Jayshankar/                    ← stays
│   └── tins-kit/                  ← vendored copy
├── incubos/                       ← stays
│   └── tins-kit/                  ← vendored copy
├── Data-cleaning-script/          ← lifted
│   └── tins-kit/
├── package5/                      ← lifted
│   └── tins-kit/
├── exam-forge/                    ← extracted from archive
│   └── tins-kit/
└── archive/                       ← kept (reference projects)
    ├── exam-forge-reference/
    └── atal-incubation-reference/
```

**The kit's HANDOVER.md `Last updated` line records the change.** Every
new session that reads HANDOVER sees the new layout. The
`PIPELINE.md` is the new "read this first" doc that explains how to
work in either location (kit root or consumer root).

---

## 6. Edge cases

### "I'm at a consumer root and tins-kit/ is missing"

It happens. Re-scaffold:

```bash
# At the consumer root
node <root>/tins-kit/scripts/new-project.mjs . --with=<modules>
# (the scaffolder copies the kit into ./tins-kit/)
```

### "The top-level kit moved (renamed) and my vendored copy is stale"

Run `kit-sync.mjs` with the new path:

```bash
# After renaming tins-kit/ to tins-kit-v2/
node tins-kit-v2/scripts/kit-sync.mjs --to=../Jayshankar
# (the script reads the source from its own location, so renaming
#  the source directory is transparent)
```

### "Two consumers propose the same pattern in the same week"

The 2-consumer rule (per `lib/patterns/kit-self-application.md` §2
anti-pattern 3) catches this. `kit-extract.mjs` produces the same
candidate for both. The triage session de-duplicates by pattern name
("C1 from Jayshankar" + "C1 from incubos" = "the same pattern, accept
once"). Future kit releases may add a `kit-arbitrate.mjs` that merges
duplicates automatically.

### "I want to add a 6th project (a new domain)"

```bash
# At the workspace root
node tins-kit/scripts/new-project.mjs my-new-project --with=tenant-rls,money-as-decimal
# → creates my-new-project/ + my-new-project/tins-kit/
# → run the spec-author interview, draft SPEC.md, start Mode A
```

The kit doesn't know about the project until the project's first
kit-extract run registers it (the consumer's path appears in the
candidates report).

---

## 7. The transport layer (kit-staging/)

The 6 rules above assume the consumer is a sibling of the kit
(`../<project>/`). That covers the 5 reference projects + any future
project scaffolded via `scripts/new-project.mjs`. But the kit's loop
also has to work for projects on **other machines** — laptop + server,
two computers, a friend sending you a tarball, a project that predates
the kit. The transport layer for those cases is **`kit-staging/`** +
the **portable kit shell** + **2 generic prompts**.

### 7.1 What `kit-staging/` is

A top-level directory at the kit root. It has 3 children:
- **`kit-staging/README.md`** — the spec for the inbox workflow, the
  4-thing-can-be-dropped table, the flow diagram, the inbox lifecycle.
- **`kit-staging/inbox/`** — where consumers drop their bundles. Empty
  by default. Self-cleaning (the next kit-growth session archives the
  entries after triaging).
- **`kit-staging/archive/`** — where consumed entries land. Empty by
  default. Auditable (the session's date + project name is in the path).

### 7.2 What a "consumer bundle" is

A consumer project (on any machine) produces a tarball via
`scripts/kit-staging-export.mjs`. The tarball contains:
- The consumer's `BUILDER-DECISIONS-REVIEW.md` (the decision log).
- The consumer's `kit-growth-candidates.md` (if `kit-extract.mjs` was
  already run).
- Any `lib/patterns/*.md` the consumer wants to contribute.
- Any `lib/<module>/` the consumer wants to contribute.
- Any `prompts/*.md` the consumer wants to contribute.
- The `.kit-shell.json` marker (proves the consumer had the kit shell).

The user copies the tarball to the kit machine, extracts it into
`kit-staging/inbox/<project-name>/`, and the next kit-growth session
triages it.

### 7.3 What the 2 generic prompts do

The 2 generic prompts (in `prompts/`) are the LLM-facing workflows:

- **`prompts/NEW-PROJECT.md`** — the 7-step generic copy-paste prompt
  for starting a TINS project in any directory on any machine. The LLM
  reads the kit shell, runs the interview, drafts the spec, builds
  the project, records decisions, mines the learnings, and ships a
  tarball back. The 5 commands to memorise are: pwd, decision-log,
  kit-extract, kit-staging-export, validate.
- **`prompts/KIT-GROWTH-SESSION.md`** — the 8-step generic copy-paste
  prompt for triaging the inbox at the kit root. The LLM runs
  `kit-ingest.mjs`, triages each candidate via `KITTING-REVIEW.md`'s
  3-question rubric, runs the KITTING workflow for each accepted
  candidate, syncs the new kit to every project via `kit-sync.mjs`,
  and archives the inbox. The 2-consumer rule is enforced.

The prompts are **paste-into-fresh-session format** (D4). They are
self-contained: no "see also" links across files. If a prompt needs
supporting context, that context is in the prompt or referenced by
absolute path.

### 7.4 The version control rules for the staging area

1. **The staging area is part of the kit's source tree.** `kit-staging/`
   is at the kit root, versioned alongside the rest of the kit. A
   change to `kit-staging/README.md` or any of the 3 new scripts is
   a kit change — it goes through the kit's HANDOVER + BUILDER-DECISIONS-REVIEW
   + SPEC.md amendment + validator check + selftest case (D24).
2. **The inbox is consumed, not stored.** A bundle in
   `kit-staging/inbox/<project>/` is a one-time delivery. After the
   kit-growth session triages it, the entry moves to
   `kit-staging/archive/<date>/<project>/`. The next session starts
   with an empty inbox.
3. **The kit-shell is the source of truth for what's portable.** The
   portable `.kit-shell/` directory is scaffolded by
   `scripts/kit-new-project-shell.mjs` at the kit root. Any change to
   the shell's contents (which scripts, which prompts, which templates
   ship with it) is a kit change.
4. **The 2 generic prompts are first-class kit assets.** A change to
   `prompts/NEW-PROJECT.md` or `prompts/KIT-GROWTH-SESSION.md` is a
   kit change. Both are validated by `scripts/validate.mjs §8.23g/h`
   (must exist + be non-trivial).
5. **A consumer on a different machine is still "one consumer" for the
   2-consumer rule.** A tarball from one remote project produces 1
   observation. The kit-growth session may defer the candidate if the
   2nd observation hasn't happened yet. When the 2nd remote project
   ships its tarball with the same candidate, both observations land
   in the same triage report and the kit-growth session can accept.

### 7.5 When the inbox is large (10+ projects)

If 10+ projects have shipped their candidates at once:
1. Run `node scripts/kit-ingest.mjs` to produce the merged triage report.
2. Triage the candidates in batches of 5-10 (don't try to triage 50 at
   once; triage the first 10, accept/reject/defer, run the gate, then
   triage the next 10).
3. The triage report is a single file; the KITTING workflow can be
   parallelised (3-5 sub-agents working on different patterns).

### 7.6 What success looks like

1. A user on machine A (no kit installed) pastes `NEW-PROJECT.md`
   into a fresh LLM session. The LLM reads the kit shell, interviews
   the user, drafts the spec, builds the project, records decisions,
   and produces a tarball.
2. The user copies the tarball to the kit machine.
3. The user extracts the tarball into `kit-staging/inbox/<project>/`.
4. The next time the user is at the kit root, they paste
   `KIT-GROWTH-SESSION.md` into a fresh LLM session. The LLM runs
   `kit-ingest.mjs`, triages the candidates, runs the KITTING workflow
   for the accepted ones, syncs the new kit to every project, and
   archives the inbox.
5. The kit grew by N patterns / modules / scripts. The next remote
   consumer benefits. The next session starts with an empty inbox.

---

*— End of `VERSIONING.md`. See also: `PIPELINE.md` (the 7-step
methodology + "Beyond the 7 steps" for the staging area),
`lib/patterns/kit-self-application.md` (the loop pattern),
`scripts/kit-sync.mjs` (the workhorse), `scripts/kit-extract.mjs` (the
auto-miner), `kit-staging/README.md` (the transport layer spec).*
