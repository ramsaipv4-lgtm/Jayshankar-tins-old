# Prompt: NEW-PROJECT (the generic copy-paste prompt for starting any new TINS project)

> **The prompt you paste into a fresh LLM session when you want to start a
> new TINS project in any directory, on any machine.** The LLM doesn't need
> the full kit installed — it just needs the kit shell (a small portable
> subset of the kit). At the end, the LLM produces a tarball that you copy
> back to the kit machine.
>
> **Source:** the kit's `kit-staging/` architecture. Companion to
> `prompts/KIT-GROWTH-SESSION.md` (the prompt for triaging the inbox).
> The shell script that scaffolds the kit shell is
> `scripts/kit-new-project-shell.mjs` (or, on a remote machine, the
> `.kit-shell/` directory that ships with this prompt).

---

## The prompt

```
You are starting a new TINS project. Your working directory is $PWD
($PWD expands to the absolute path the user gives you).

You do NOT have the full kit installed. You have a "kit shell" — a
portable subset of the kit at ./.kit-shell/. It contains:
  - scripts/decision-log.mjs (records builder decisions)
  - scripts/kit-extract.mjs (mines the decisions for kit-worthy patterns)
  - scripts/kit-staging-export.mjs (dumps the candidates to a tarball)
  - prompts/SPEC-AUTHOR.md (interview the user)
  - prompts/INTERVIEW-CHECKLIST.md
  - prompts/BUILDER-REVIEW-TEMPLATE.md
  - templates/HANDOVER.md, BUILDER-DECISIONS-REVIEW.md, etc.
  - .kit-shell.json (marker: {"shell": true, "kitVersion": "2.0"})

The kit's full validate.mjs / selftest.mjs / KITTING workflow runs at
the KIT MACHINE, not here. Your job is to build the project + record
decisions + produce a tarball for transport back to the kit machine.

---

## The 7 steps (do them in this order)

### Step 0 — Confirm your location

```bash
pwd
ls -la
ls .kit-shell/    # confirm the kit shell is here
cat .kit-shell/.kit-shell.json   # confirm the marker
```

If `.kit-shell/` is missing, the user forgot to scaffold the shell. Tell
them to run `node /path/to/tins-kit/scripts/kit-new-project-shell.mjs <project-name>`
at the kit machine and copy the resulting folder here.

**Then run the tooling gate (D33) before anything else:**

```bash
node .kit-shell/scripts/tooling-audit.mjs
```

The first time through, `TOOLING-AUDIT.md` will not exist yet and the gate
exits 2. That is expected — open `.kit-shell/prompts/TOOLING-AUDIT.md` and
run it. It inventories what this harness actually has, derives what the
project needs, searches the internet for MCP servers and skills that close
the gap, security-audits each candidate against the nine red flags, and
records the result. **The gate is blocking:** work does not proceed while a
REQUIRED capability is still `pending`.

Two things about that audit are absolute: **you never install anything**
(you report; the user installs), and **you never run a candidate to find
out what it does** (you read it — running an untrusted skill to evaluate it
*is* the compromise).

Run it before the interview if the stack is already known, or immediately
after Step 2 once the interview reveals what the project actually needs —
but always before Step 3 drafts a line of spec.

**And read the steering catalogue (D34):** open
`.kit-shell/prompts/STEERING-PROMPTS.md` now. Throughout this session you
will surface short, adapted, paste-ready correction prompts to the user at
its defined checkpoints — and immediately, every time, whenever you correct
yourself on a recheck. The catalogue is yours to select from; the user
never sees the file, only the adapted card.

### Step 1 — Read the project shell

| # | File | Why |
|---|---|---|
| 1 | `AGENT-BRIEF.md` (the per-project onboarding the scaffolder produced) | The project context |
| 2 | `HANDOVER.md` (template; you'll fill it in) | The project's W-queue + state |
| 3 | `.kit-shell/prompts/SPEC-AUTHOR.md` | The 7-question interview + A/B/C pass |
| 4 | `.kit-shell/prompts/INTERVIEW-CHECKLIST.md` | The interview checklist |
| 5 | `.kit-shell/prompts/BUILDER-REVIEW-TEMPLATE.md` | The decision-log format |
| 6 | `.kit-shell/prompts/TOOLING-AUDIT.md` | The D33 blocking gate — what this harness has vs. what the work needs |
| 7 | `.kit-shell/prompts/STEERING-PROMPTS.md` | The D34 correction cards you offer the user inline |
| 8 | `.kit-shell/prompts/EXECUTION-MODE-INTERVIEW.md` | The D35 menu — ask how the build should actually be executed, once the spec locks |

### Step 2 — Interview the user (paste `.kit-shell/prompts/SPEC-AUTHOR.md` as your guide)

Ask the user the 7 questions. Then run the A/B/C pass. Get their approval
on the "what I guessed" appendix BEFORE drafting the spec.

### Step 3 — Draft `SPEC.md` (at the project root)

Use `templates/SPEC.md` as the scaffold. The TINS markers at the top are
required:

```
<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
```

Fill in the §0 preamble (cheapest-version line, what-this-document-is, locked
decisions table, "what I guessed" appendix), §1 description, §2 functionality,
§4 architecture, §8 acceptance criteria, §9 out-of-scope.

### Step 3a — Ask how this should be built (D35)

Once `SPEC.md` is locked, run
`.kit-shell/prompts/EXECUTION-MODE-INTERVIEW.md` before you write any code.
It presents five execution modes — `solo`, `auditor-local`,
`auditor-remote`, `self-parallel`, `external` — and routes onward. Ask; do not
assume the user wants this session to build everything sequentially, and do
not assume they want an unattended run either. They know what LLM accounts
they own and what they are willing to spend; you do not.

Record the answer in `delegation/LEDGER.md`'s round header. If they choose
`solo`, continue to Step 4 below as normal.

### Step 4 — Build the project (spec first, code second)

For every non-trivial W (a feature, a schema, a route, a module):
1. Edit the relevant section of SPEC.md.
2. Write the code.
3. Run the project's own validator if it has one.

### Step 5 — Record every non-obvious decision in `BUILDER-DECISIONS-REVIEW.md`

Use the kit shell's `decision-log.mjs`:

```bash
node .kit-shell/scripts/decision-log.mjs builder \
  --title="<title>" \
  --context="<the problem>" \
  --decision="<the choice>" \
  --alternatives="<A> (rejected: <reason>); <B> (rejected: <reason>)" \
  --consequences="<what this enables>; <what this forecloses>"
```

A "non-obvious decision" is any choice that deviates from the obvious,
was forced by a real failure, or would trip up a future contributor.

### Step 6 — When done (or at a meaningful milestone), mine your learnings

```bash
node .kit-shell/scripts/kit-extract.mjs --consumer=.
# → produces ./kit-growth-candidates.md
# → exits 0 if no candidates, 1 if there are
```

If the script exits 1, you've found kit-worthy patterns. The kit-growth
session at the kit machine will triage them.

### Step 7 — Ship back to the kit machine (via the staging tarball)

```bash
node .kit-shell/scripts/kit-staging-export.mjs
# → produces ./kit-staging-export-<project-name>-<date>.zip (Windows) or .tar.gz (POSIX)
```

The user then copies the tarball to the kit machine:

```bash
# at the kit machine
mkdir -p ../tins-kit/kit-staging/inbox/<project-name>/
# Windows: Expand-Archive the .zip into the inbox dir
# POSIX:   tar -xzf the .tar.gz into the inbox dir
```

The next kit-growth session at the kit root will run
`scripts/kit-ingest.mjs` to scan the inbox, triage the candidates, and
land the accepted ones in the kit via the KITTING workflow.

---

## What you do NOT do (the kit machine does these)

- **Validate the spec** — `scripts/validate.mjs` is at the kit machine.
  You can use it locally if you also `cp -r` the kit's `scripts/validate.mjs`
  to your project, but it's not required for the shell workflow.
- **Run the KITTING workflow** — that's the kit-growth session at the kit
  root. You just produce the candidates; the kit decides which to add.
- **Sync back** — `scripts/kit-sync.mjs` is at the kit machine. The
  kit-growth session runs it after the new patterns are landed.

---

## When you get stuck

1. Re-read `.kit-shell/prompts/SPEC-AUTHOR.md` (the interview is
   the load-bearing piece).
2. Re-read this project's `HANDOVER.md` (the W-queue).
3. If a kit question comes up (e.g. "should this be Decimal or Float?"),
  look at `.kit-shell/prompts/BUILDER-REVIEW-TEMPLATE.md` for the decision
  format — but the answer is "record the decision in
  BUILDER-DECISIONS-REVIEW.md and let the kit-growth session decide
  whether it's a new pattern."
4. If you discover a generalizable pattern (the same decision appears
  in 2+ projects), the kit's growth loop will add it to the kit
  automatically.

---

## The 5 commands (memorise)

```bash
# Step 0: confirm location
pwd; ls -la

# Step 2: interview (paste the prompt)
# (no command — this is a conversation)

# Step 5: record a decision
node .kit-shell/scripts/decision-log.mjs builder --title="..." --context="..." --decision="..." --alternatives="..." --consequences="..."

# Step 6: mine your learnings
node .kit-shell/scripts/kit-extract.mjs --consumer=.

# Step 7: ship back
node .kit-shell/scripts/kit-staging-export.mjs
```

---

## What success looks like

1. The user gives you a project idea.
2. You interview them (7 questions + A/B/C pass).
3. You draft SPEC.md, get their sign-off.
4. You build the project (spec first, code second).
5. You record every non-obvious decision in BUILDER-DECISIONS-REVIEW.md.
6. You mine the decisions → `kit-growth-candidates.md`.
7. You produce a tarball via `kit-staging-export.mjs`.
8. The user copies the tarball to the kit machine.
9. The next kit-growth session at the kit root triages the candidates
   and decides which to add to the kit.
10. The kit grows by 1-10 patterns. The next consumer benefits.

Begin with Step 0.
```

---

*— End of `NEW-PROJECT.md` prompt. See also: `prompts/KIT-GROWTH-SESSION.md`
(the prompt for triaging the inbox at the kit root), `prompts/SPEC-AUTHOR.md`
(the canonical interview), `scripts/kit-new-project-shell.mjs` (the
scaffolder that produces the kit shell).*
