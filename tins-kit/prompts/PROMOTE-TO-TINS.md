# Prompt: PROMOTE-TO-TINS (the generic copy-paste prompt for retro-fitting an existing project)

> **The prompt you paste into a fresh LLM session when you want to take
> an existing project (built WITHOUT the kit) and turn it into a TINS
> project.** The project doesn't have a `tins-kit/` vendored copy yet
> (or it does, but the project itself wasn't built with the kit's
> discipline). At the end, the project has the kit's standard handover
> docs (SPEC.md, HANDOVER.md, AGENT-BRIEF.md, BUILDER-DECISIONS-REVIEW.md)
> and a tarball of kit-worthy artefacts ready to ship to the kit machine.
>
> **Source:** the kit's 4-scenario matrix (D27). Companion to:
> - `prompts/NEW-PROJECT.md` (Scenario 1: start from scratch)
> - `prompts/CONTINUE-TINS-PROJECT.md` (Scenario 3: continue an existing TINS project)
> - `prompts/KIT-GROWTH-SESSION.md` (Scenario 4: triage the inbox at the kit root)
>
> The shell script that vendors the kit is
> `scripts/kit-sync.mjs --to=./tins-kit` (or, on a different machine,
> `scripts/kit-new-project-shell.mjs` to scaffold a portable kit shell).

---

## The prompt

```
You are taking an existing project (built without the kit) and turning
it into a TINS project. Your working directory is $PWD ($PWD expands
to the absolute path the user gives you).

You do NOT need to rebuild the project. You need to:
1. Document the existing state (a SPEC.md that describes what IS,
   not what SHOULD BE).
2. Identify the kit patterns that apply (run kit-coverage).
3. Create the kit's standard handover docs (HANDOVER.md, AGENT-BRIEF.md,
   BUILDER-DECISIONS-REVIEW.md).
4. Mine the existing decisions and add them to BUILDER-DECISIONS-REVIEW.md.
5. Run kit-extract.mjs to find new kit-worthy patterns.
6. Produce a tarball via kit-staging-export.mjs (if there are candidates).
7. Hand off to the kit machine via the inbox.

The kit (or a portable kit shell) must already be at ./tins-kit/ or
./.kit-shell/. If it's missing, the user forgot to vendor it. Tell
them to run one of:
  - `node /path/to/tins-kit/scripts/kit-sync.mjs --to=./tins-kit` (kit machine)
  - `node /path/to/tins-kit/scripts/kit-new-project-shell.mjs <name>` (other machine)

---

## The 7 steps (do them in this order)

### Step 0 — Confirm your location

```bash
pwd
ls -la
ls tins-kit/ 2>/dev/null || ls .kit-shell/ 2>/dev/null
```

Confirm the project exists (you should see source files, not an empty
folder). Confirm the kit (or kit shell) is present. If neither is
present, stop and tell the user.

### Step 1 — Read the kit shell (5 files)

| # | File | Why |
|---|---|---|
| 1 | `tins-kit/INDEX.md` (or `.kit-shell/INDEX.md` if vendored) | The selective-chooser — see what the kit offers |
| 2 | `tins-kit/PIPELINE.md` (or `.kit-shell/PIPELINE.md`) | The 7-step methodology (universal) |
| 3 | `tins-kit/AGENTS.md` | The kit's standing rules |
| 4 | `tins-kit/prompts/SPEC-AUTHOR.md` | The 7-question interview format |
| 5 | This project's README (or top-level doc) | What the project IS |

### Step 2 — Read the existing project (3 files minimum)

| # | File | Why |
|---|---|---|
| 1 | `README.md` | The project's own pitch |
| 2 | `package.json` (or equivalent) | The dependency list + scripts |
| 3 | `src/` (or `lib/`, `app/`, `cmd/`, `bin/`, etc.) | The actual code |

If the project is a non-JS project, the equivalents are:
- **C# / .NET**: `*.csproj`, `Program.cs`, `bin/`
- **PowerShell**: `*.ps1`, `*.psd1`
- **Python**: `pyproject.toml` or `requirements.txt`, `main.py`
- **Markdown-only** (study plans, docs): skip the "src" step; the project IS the markdown

### Step 3 — Interview the user (the 4 retro-fit questions)

The retro-fit is different from a greenfield spec interview. You're
not asking "what do you want to build?" You're asking "what does this
project ALREADY do, and what kit value do you want to extract from it?"

The 4 questions:
1. **What is this project?** (the one-sentence pitch — what does it
   do, who uses it, why does it exist)
2. **What's the current state?** (is it shippable? is it in active
   development? is it abandoned? does it have tests?)
3. **What kit value do you want?** (just the handover docs? the
   patterns? a full TINS retro-fit? a kit-growth extraction?)
4. **Are there any non-obvious decisions in this project that should
   be preserved?** (the "we used X because Y" decisions; these are
   the BUILDER-DECISIONS-REVIEW entries)

### Step 4 — Draft SPEC.md (at the project root)

Use `tins-kit/templates/SPEC.md` as the scaffold. The §0.0 line is
now the "what IS" line, not the "cheapest version" line. The §0.2
table is now the existing decisions, not new ones.

Key sections to fill:
- **§0.0**: "This document describes the current state of the project
  (retro-fit). It is not a greenfield spec."
- **§0.1**: What the project IS (one paragraph).
- **§0.2**: The existing locked decisions (extracted from the codebase
  + the interview).
- **§1**: The user-facing description.
- **§2**: The current functionality (what modules / endpoints / commands exist).
- **§4**: The current architecture (the folder structure, the dependency tree).
- **§8**: The acceptance criteria for the retro-fit (the kit's perspective:
  "what kit value did we extract?").
- **§9**: Out-of-scope for the retro-fit (e.g. "we are not rebuilding X;
  we are documenting it as-is").

The TINS markers at the top are required (per `tins-kit/AGENTS.md`):

```
<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
```

(Adjust ZS: keys to match the project's actual stack.)

### Step 5 — Run kit-coverage

```bash
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md
```

This tells you which kit patterns apply. For each, decide:
- **Adopt**: refactor the code to use the pattern (e.g. `cp -r lib/money-as-decimal/ src/lib/`).
- **Document**: note in SPEC.md that the pattern is in use (no code change).
- **Defer**: not relevant to this project.

### Step 6 — Create the kit's standard handover docs

```bash
# Copy the templates
cp tins-kit/templates/AGENTS.md ./AGENTS.md
cp tins-kit/templates/HANDOVER.md ./HANDOVER.md
cp tins-kit/templates/BUILDER-DECISIONS-REVIEW.md ./BUILDER-DECISIONS-REVIEW.md
# (the optional one)
cp tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md ./REVIEWER-DECISIONS-REVIEW.md
cp tins-kit/templates/PROJECT-AGENT-BRIEF.md ./AGENT-BRIEF.md
```

Fill in:
- **AGENT-BRIEF.md** (or AGENTS.md): the 1-page LLM onboarding. Reference
  `tins-kit/templates/PROJECT-AGENT-BRIEF.md` for the format.
- **HANDOVER.md**: the W-queue. Start with one entry: "W1 = retro-fit to
  TINS, done". Then add W2, W3, ... for the follow-up work (e.g. "adopt
  the money-as-decimal module" or "migrate the existing audit log to the
  append-only-audit-log pattern").
- **BUILDER-DECISIONS-REVIEW.md**: extract the existing decisions from
  the codebase. For each, use:
  ```bash
  node tins-kit/scripts/decision-log.mjs builder \
    --title="<the decision>" \
    --context="<the problem>" \
    --decision="<the choice>" \
    --alternatives="<A> (rejected: <reason>); <B> (rejected: <reason>)" \
    --consequences="<what this enables>; <what this forecloses>"
  ```

### Step 7 — Mine learnings + ship (if applicable)

```bash
# Mine the retro-fit's decisions
node tins-kit/scripts/kit-extract.mjs --consumer=.
# → produces ./kit-growth-candidates.md
# → exits 0 if no candidates, 1 if there are
```

If the script exits 1, you've found kit-worthy patterns. To ship them
to the kit machine:

```bash
# Produce the tarball
node tins-kit/scripts/kit-staging-export.mjs
# → produces ./kit-staging-export-<project-name>-<date>.{zip,tar.gz}
```

The user then copies the tarball to the kit machine and extracts it
into `tins-kit/kit-staging/inbox/<project-name>/`. The next
kit-growth session at the kit root triages the candidates.

---

## What you do NOT do (the kit machine does these)

- **Validate the spec** — `scripts/validate.mjs` is at the kit machine
  (and at this project's `tins-kit/scripts/validate.mjs`). You CAN use
  it locally:
  ```bash
  node tins-kit/scripts/validate.mjs --spec=SPEC.md
  ```
- **Run the KITTING workflow** — that's the kit-growth session at the
  kit root. You just produce the candidates.
- **Sync back** — `scripts/kit-sync.mjs` is at the kit machine. The
  kit-growth session runs it after the new patterns are landed.

---

## When you get stuck

1. Re-read `tins-kit/INDEX.md` (the selective-chooser). The kit
   probably has what you need.
2. Re-read `tins-kit/PIPELINE.md` Step 2 (the 5 commands).
3. If you find a generalizable pattern, add it to
   BUILDER-DECISIONS-REVIEW.md via `decision-log.mjs` — the
   kit-growth session will pick it up.
4. If the user wants to STOP the retro-fit and just keep the project
   as-is, that's fine. The retro-fit is a value-add, not a mandate.

---

## The 5 commands (memorise)

```bash
# Step 5: see what the kit recommends
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md

# Step 6: record a decision
node tins-kit/scripts/decision-log.mjs builder --title="..." --context="..." --decision="..." --alternatives="..." --consequences="..."

# Step 7: mine learnings
node tins-kit/scripts/kit-extract.mjs --consumer=.

# Step 7: ship to the kit machine
node tins-kit/scripts/kit-staging-export.mjs

# (anytime) leave the gate green
node tins-kit/scripts/validate.mjs --spec=SPEC.md
```

---

## What success looks like

1. The user gives you an existing project.
2. You read the kit shell + the project.
3. You interview the user (4 retro-fit questions).
4. You draft SPEC.md (describes what IS).
5. You create AGENT-BRIEF.md + HANDOVER.md + BUILDER-DECISIONS-REVIEW.md.
6. You run kit-coverage and decide which patterns to adopt.
7. You run kit-extract.mjs to find kit-worthy patterns.
8. You produce a tarball via kit-staging-export.mjs.
9. The user copies the tarball to the kit machine.
10. The next kit-growth session triages the candidates and adds the
    keepers to the kit.
11. The kit grows by 1-10 patterns. The next consumer benefits.

Begin with Step 0.
```

---

*— End of `PROMOTE-TO-TINS.md` prompt. See also: `prompts/NEW-PROJECT.md`
(Scenario 1, start from scratch), `prompts/CONTINUE-TINS-PROJECT.md`
(Scenario 3, continue a TINS project), `prompts/KIT-GROWTH-SESSION.md`
(Scenario 4, triage the inbox), `INDEX.md` (the selective-chooser),
`scripts/kit-coverage.mjs` (see what applies), `scripts/decision-log.mjs`
(record decisions), `scripts/kit-extract.mjs` (mine learnings),
`scripts/kit-staging-export.mjs` (ship to the kit machine).*
