# kit-staging/ — the inbox for remote / future projects

> **The transport layer between a consumer project (anywhere) and the
> top-level kit.** A consumer that doesn't have a vendored `tins-kit/`
> — because it's on a different machine, or because it started before
> the kit existed, or because it's a one-off experiment — drops its
> kit-worthy artefacts here. A kit-growth session at the kit root
> scans this directory, triages the artefacts, and adds the keepers
> to the kit.

---

## The 4 things a consumer can drop here

| Artefact | What it is | How the kit-ingest script handles it |
|---|---|---|
| `BUILDER-DECISIONS-REVIEW.md` | The consumer's decision log | Re-runs `kit-extract.mjs` heuristic on it; produces candidates |
| `kit-growth-candidates.md` | The pre-mined report (from `kit-extract.mjs --consumer=.`) | Reads the candidate sections; uses them as-is |
| `lib/patterns/<name>.md` | A new pattern the consumer wants to contribute | Validates the 4-section structure; adds directly if conformant |
| `lib/<module>/` | A new code module the consumer wants to contribute | Validates the canonical layout (index.ts + README.md + tests/); adds if conformant |
| `prompts/<name>.md` | A new prompt the consumer wants to contribute | Validates the paste-into-session format; adds if conformant |

The consumer can drop any combination. The ingest script handles all 5
types in a single pass.

---

## The flow (end-to-end)

```
+---------------------+         +---------------------+         +---------------------+
|                     |         |                     |         |                     |
|  Consumer Project   |         |  kit-staging/inbox/ |         |  Kit-growth session |
|  (anywhere)         |         |  (the inbox)        |         |  (at the kit root)   |
|                     |         |                     |         |                     |
+---------+-----------+         +----------+----------+         +----------+----------+
          |                               |                               ^
          |  1. Build + record decisions   |                               |
          |     in BUILDER-DECISIONS-     |                               |
          |     REVIEW.md                  |                               |
          |                               |                               |
          v                               |                               |
+---------+-----------+                   |                               |
|                     |   2. Run           |                               |
|  .kit-shell/        |   kit-staging-     |                               |
|  (portable kit      |   export.mjs to    |                               |
|  subset)            |   produce the      |                               |
|                     |   export bundle    |                               |
+---------+-----------+                   |                               |
          |                               |                               |
          |  3. Copy the export bundle     |                               |
          |     to the kit machine         |                               |
          v                               v                               |
                                +----------+----------+                  |
                                |  inbox/<project>/   |                  |
                                |    kit-staging-     |                  |
                                |    export.json      |                  |
                                |    BUILDER-         |                  |
                                |    DECISIONS-       |                  |
                                |    REVIEW.md        |                  |
                                |    lib/patterns/    |                  |
                                |    lib/<module>/    |                  |
                                |    prompts/         |                  |
                                +----------+----------+                  |
                                           |                              |
                                           |  4. kit-ingest.mjs           |
                                           |     scans the inbox          |
                                           |     produces a merged         |
                                           |     triage report             |
                                           v                              |
                                +----------+----------+                  |
                                |  triage-<date>.md   |                  |
                                +----------+----------+                  |
                                           |                              |
                                           |  5. KITTING-REVIEW.md triages |
                                           |     each candidate           |
                                           v                              |
                                +----------+----------+                  |
                                |  accepted candidates |-----------------+
                                |  → land in the kit   |  (via KITTING.md)
                                |  → sync to projects  |
                                +---------------------+
```

---

## How a consumer produces the export bundle

**At the consumer's machine** (anywhere; doesn't need the kit installed):

```bash
# 1. Run the export script (ships with .kit-shell/)
node .kit-shell/scripts/kit-staging-export.mjs

# This produces:
#   ./kit-staging-export-<date>.tar.gz
#   (contains: BUILDER-DECISIONS-REVIEW.md + any lib/ + any prompts/ + the
#    .kit-shell.json marker)
```

**At the kit machine**:

```bash
# 2. Extract the bundle into the inbox
mkdir -p ../tins-kit/kit-staging/inbox/<project-name>/
tar -xzf kit-staging-export-<date>.tar.gz -C ../tins-kit/kit-staging/inbox/<project-name>/

# 3. (Optional) Trigger the kit-growth session manually
cd ../tins-kit/
node scripts/kit-ingest.mjs
# → produces ./kit-staging/triage-<date>.md

# 4. Open a fresh LLM session, paste prompts/KIT-GROWTH-SESSION.md
#    The session reads triage-<date>.md, triages each candidate,
#    runs KITTING for the accepted ones.
```

---

## The inbox lifecycle

1. **Consumer drops:** `kit-staging/inbox/<project-name>/<files>`.
2. **Kit-growth session ingests:** `node scripts/kit-ingest.mjs` produces
   `kit-staging/triage-<date>.md`.
3. **Triage happens:** the session triages the candidates via
   `KITTING-REVIEW.md`. Accepted ones land in the kit via KITTING.
4. **Archive:** the session moves the inbox entry to
   `kit-staging/archive/<date>/<project-name>/` (so the inbox stays
   clean for the next consumer).
5. **Sync to projects:** the session runs `kit-sync.mjs --to=../<each-project>`
   to push the new kit.

The inbox is *self-cleaning*: every kit-growth session empties it (by
archiving) as part of step 4.

---

## What's in this directory (the layout)

```
kit-staging/
├── README.md            ← this file
├── inbox/               ← where consumers drop their bundles
│   └── (empty by default; consumers add <project-name>/ subdirs)
└── archive/             ← where the kit-growth session moves consumed entries
    └── (empty by default; the session adds <date>/<project-name>/)
```

---

## Why a staging area, not direct sync

The current `kit-sync.mjs` + `kit-extract.mjs` loop assumes the
consumer's repo is **adjacent** to the kit (`../<project>/`). That's
fine for the 5 reference projects (Jayshankar, incubos,
Data-cleaning-script, package5, exam-forge) and for any future project
that's scaffolded via `new-project.mjs` into the same workspace root.

But it doesn't work for:
- A project on a **different machine** (the user has a laptop + a
  server, or two computers).
- A project the kit **doesn't know about yet** (a friend sent you a
  tarball; you want to ingest their learnings).
- A project that **predates the kit** (the user has a working app and
  wants to bring it into the kit's growth loop retroactively).

The staging area is the solution. It's the inbox that any project,
anywhere, can drop its kit-worthy artefacts into. The kit-growth
session at the kit root ingests them.

---

*— End of `kit-staging/README.md`. The ingest script is at
`scripts/kit-ingest.mjs`. The portable project shell is at
`scripts/kit-new-project-shell.mjs`. The export helper is at
`scripts/kit-staging-export.mjs`.*
