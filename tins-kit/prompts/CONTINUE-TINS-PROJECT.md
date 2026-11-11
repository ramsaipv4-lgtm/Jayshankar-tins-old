# Prompt: CONTINUE-TINS-PROJECT (the generic copy-paste prompt for picking up an existing TINS project)

> **The prompt you paste into a fresh LLM session when you want to
> continue work on an existing TINS project.** The project already has
> the kit vendored at `./tins-kit/`, has its own `HANDOVER.md` with a
> W-queue, and has been built with the kit's discipline. At the end,
> the W is done, the gate is green, and the HANDOVER is updated.
>
> **Source:** the kit's 4-scenario matrix (D27). Companion to:
> - `prompts/NEW-PROJECT.md` (Scenario 1: start from scratch)
> - `prompts/PROMOTE-TO-TINS.md` (Scenario 2: retro-fit an existing project)
> - `prompts/KIT-GROWTH-SESSION.md` (Scenario 4: triage the inbox at the kit root)
> - `prompts/FRONTEND-REFRESH.md` (specialized W: a frontend visual redesign —
>   Step 2 below routes to it instead of the generic W interview)
> - `prompts/DELEGATE-WORK.md` (specialized W: splitting remaining
>   *locked* work for parallel execution by multiple LLM sessions or
>   people — Step 2 below routes to it instead of the generic W interview)
> - `prompts/PUBLISH-OPEN-SOURCE.md` (specialized W: packaging a finished
>   project for public release — Step 2 below routes to it instead of the
>   generic W interview)
> - `prompts/GENERATE-CURRICULUM.md` (specialized W: turning a finished
>   project into standalone teaching material — Step 2 below routes to
>   it instead of the generic W interview)
> - `prompts/AUTONOMOUS-BUILD.md` (specialized W: standing up an auditor +
>   workers to build the locked spec unattended — Step 2 below routes to it
>   instead of the generic W interview)
> - `prompts/TOOLING-AUDIT.md` (the D33 blocking gate Step 0 below runs
>   before any work starts)
> - `prompts/STEERING-PROMPTS.md` (the D34 catalogue of adaptive correction
>   cards this session offers the user inline)
>
> The kit must already be vendored at `./tins-kit/`. If it's missing,
> the user forgot to pull the latest. Tell them to run
> `node /path/to/tins-kit/scripts/kit-sync.mjs --to=./tins-kit`.

---

## The prompt

```
You are continuing work on an existing TINS project. Your working
directory is $PWD ($PWD expands to the absolute path the user gives you).

The project has the kit vendored at ./tins-kit/. The project has its
own HANDOVER.md with a W-queue. Your job is to pick up the next W,
or start a new one based on the user's request.

The 6 steps (do them in this order).

---

## The 6 steps (do them in this order)

### Step 0 — Confirm your location

```bash
pwd
ls -la
ls tins-kit/    # confirm the kit is here
```

If the kit is missing, the user forgot to vendor it. Tell them to run
`node /path/to/tins-kit/scripts/kit-sync.mjs --to=./tins-kit` to pull
the latest from the kit machine.

**Then run the tooling gate (D33) before anything else:**

```bash
node tins-kit/scripts/tooling-audit.mjs
```

If it exits non-zero — or if `TOOLING-AUDIT.md` does not exist yet, or was
last audited for a different W — open `tins-kit/prompts/TOOLING-AUDIT.md`
and run it now, scoped to the W you are about to start. **This gate is
blocking.** Do not continue to Step 1 until it exits 0.

This is not bureaucracy. A session that lacks a capability does not stop —
it improvises: guesses at what an API returns, estimates a number it could
have looked up, writes a plausible paragraph where a real query belonged.
That output is confidently wrong in a way the user cannot see. Naming the
gap and closing it beats working around it silently.

**And read the steering catalogue (D34):** open
`tins-kit/prompts/STEERING-PROMPTS.md` now. Throughout this session you
will surface short, adapted, paste-ready correction prompts to the user at
its defined checkpoints — and immediately, every time, whenever you correct
yourself on a recheck.

### Step 1 — Read these files in this order

| # | File | Why |
|---|---|---|
| 1 | `tins-kit/INDEX.md` | The selective-chooser — see what the kit offers |
| 2 | `tins-kit/PIPELINE.md` | The 7-step methodology (universal) |
| 3 | This project's `AGENT-BRIEF.md` (or AGENTS.md) | The project context |
| 4 | This project's `HANDOVER.md` (the W-queue) | The current state + next W |
| 5 | This project's `SPEC.md` (if exists) | The contract |
| 6 | This project's `BUILDER-DECISIONS-REVIEW.md` (if exists) | The decision history |

### Step 2 — Pick the right W (or run coverage)

**First, ask how this round should be executed (D35).** Do not infer it from
how the user phrased the W. Open
`tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md` and run it — it reads the
previous round's mode from `delegation/LEDGER.md` and pre-fills, so this is a
one-word confirm when nothing has changed. It presents five modes and routes
onward:

| Mode | Who executes | Routes to |
|---|---|---|
| `solo` | this session, sequentially | Step 3 below (the normal W interview) |
| `auditor-local` | an auditor + workers in this harness | `AUTONOMOUS-BUILD.md` |
| `auditor-remote` | an auditor here, workers on the user's other LLM CLIs | `AUTONOMOUS-BUILD.md` |
| `self-parallel` | the user personally, across their own LLM accounts | `DELEGATE-WORK.md` (self) |
| `external` | a hired human or someone else's LLM | `DELEGATE-WORK.md` (external) |
| `hybrid` | a mix, recorded per task | both, per task |

The mode question is separate from the W-type routing below: the routing
paragraphs decide **what kind of work this is**, the interview decides **who
builds it**. A frontend-refresh W can be `solo` or `auditor-local`; a
parallel split can be user-driven or auditor-driven. Ask both.

If the remaining work is small or genuinely interlocked, say so and recommend
`solo` — spinning up an auditor and three workers for two files' worth of
work costs more than it saves.

```bash
# See the W-queue
cat HANDOVER.md | grep "### W"

# See what the kit recommends for this SPEC
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md
```

**If the user has a specific W in mind** (e.g. "add a /api/something
endpoint"), use that. The HANDOVER.md may not have it yet — that's
OK, just start it.

**If the user wants to pick up the next W** (the first W with status
`⏳` or `🔶` in HANDOVER.md), use that.

**If the user is just exploring** ("what should I work on next?"),
look at the W-queue + run kit-coverage and suggest the next W based
on what the kit recommends.

**If the W is a frontend visual / design redesign** ("refresh the look",
"modernize the UI", "give it a new frontend"), do NOT use the generic
5-question W interview in Step 3 below. Use
`tins-kit/prompts/FRONTEND-REFRESH.md` instead — it runs the shared
`FRONTEND-VISION-INTERVIEW.md` interview and the install-vs-recreate
library logic this kind of W needs, then returns here (Step 6) to record
decisions and update HANDOVER.md the normal way.

**If the W is splitting remaining work for parallel execution**
("let's build this in parallel", "I want to hand some of this off",
"split this so multiple sessions/people can work on it"), do NOT use
the generic 5-question W interview in Step 3 below. Use
`tins-kit/prompts/DELEGATE-WORK.md` instead — it requires the relevant
spec section to already be locked, asks the self-vs-external mode
question, runs the independence check, and for external-mode tasks
builds a scrubbed packet. Once tasks return, its companion
`tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md` brings them back
together and returns here (Step 6) to record decisions and update
HANDOVER.md the normal way.

**If the W is packaging this project for public release** ("let's
open-source this", "package this for my portfolio", "get this ready to
publish"), do NOT use the generic 5-question W interview in Step 3
below. First confirm the gate is green (a half-built project isn't
ready for this regardless of what the user wants). Then use
`tins-kit/prompts/PUBLISH-OPEN-SOURCE.md` instead — it runs the
`lib/patterns/private-to-public.md` copy-and-scan workflow, writes the
public-facing docs in a corporate voice, and holds them against a
quality rubric aimed at real technical scrutiny, then returns here
(Step 6) to record the release and update HANDOVER.md the normal way.

**If the W is turning this project into teaching material** ("turn this
into a curriculum", "make onboarding docs from this", "I want to learn
from what I built", "build interview prep from this project"), do NOT
use the generic 5-question W interview in Step 3 below. First confirm
the gate is green, for the same reason `PUBLISH-OPEN-SOURCE.md` does.
Then use `tins-kit/prompts/GENERATE-CURRICULUM.md` instead — it produces
a sibling `<project>-curriculum/` folder, one file per turn, in direct
second-person instructional voice (not the corporate voice
`PUBLISH-OPEN-SOURCE.md` uses), reusing the same
`scripts/private-to-public.mjs` scan as its safety gate. If the user
specifically wants first-principles reimplementation drills for
technical-interview practice on top of that curriculum, its companion
`tins-kit/prompts/GENERATE-INTERVIEW-PREP.md` is a separate, optional
next pass — ideally run on a frontier model at extended/max thinking.
Either way, return here (Step 6) to record the run and update
HANDOVER.md the normal way.

**If the W is building the locked spec autonomously** ("build the rest of
it on its own", "run it unattended", "spin up an auditor and workers",
"just finish the project"), do NOT use the generic 5-question W interview
in Step 3 below. Use `tins-kit/prompts/AUTONOMOUS-BUILD.md` instead — this
session becomes the auditor, decomposes the remaining locked work,
dispatches worker sessions running
`tins-kit/prompts/WORKER-SESSION.md`, verifies and integrates what comes
back, and escalates only decisions an LLM must not make alone (the tiers
are in `tins-kit/lib/patterns/tiered-escalation.md`). It requires the
relevant spec section to already be locked and the tooling gate green,
reuses `DELEGATE-WORK.md`'s independence check and
`INTEGRATE-DELEGATED-WORK.md` unchanged, and returns here (Step 6) to
record decisions and update HANDOVER.md the normal way.

### Step 3 — Interview the user (the 5 questions for a new W)

If the W is non-trivial (touches code, schema, API, or is a new
feature), interview the user before drafting. The 5 questions:

1. **What is the W?** (the one-sentence description)
2. **What's the user's pain?** (why does this W exist; what
   bug/feature request triggered it)
3. **What does "done" look like?** (the acceptance criteria)
4. **Are there constraints?** (existing decisions in
   BUILDER-DECISIONS-REVIEW.md that this W must respect)
5. **Is this kit-worthy?** (does it generalise to other TINS
   consumers? if so, the kit's growth session may want to add it as
   a pattern)

If the W is trivial (a typo fix, a renamed variable, a 1-line config
change), skip the interview. Just do it.

### Step 4 — Spec first, code second

1. **Edit the relevant section of SPEC.md** (or the per-project
   BUILDER-DECISIONS-REVIEW.md for a builder decision). Add a new
   §8.X acceptance criterion.
2. **Re-run the validator:**
   ```bash
   node tins-kit/scripts/validate.mjs --spec=SPEC.md
   ```
   It must exit 0. If it fails, fix the spec before coding.
3. **Write the code.** Follow the kit's patterns where applicable
   (the kit-coverage output told you which).
4. **Record every non-obvious decision** in BUILDER-DECISIONS-REVIEW.md via:
   ```bash
   node tins-kit/scripts/decision-log.mjs builder \
     --title="..." \
     --context="..." \
     --decision="..." \
     --alternatives="..." \
     --consequences="..."
   ```
5. **Update HANDOVER.md:** mark the W as `✅ DONE (YYYY-MM-DD)` or
   `🔶 PARTIAL`. Add new Ws if the work spawned follow-ups. Update
   the "Last updated" / "Last worked on by" / "Queue position" header.

### Step 5 — Mine learnings (if applicable)

```bash
# Mine this W's decisions for kit-worthy patterns
node tins-kit/scripts/kit-extract.mjs --consumer=.
# → produces ./kit-growth-candidates.md
# → exits 0 if no candidates, 1 if there are
```

If the script exits 1, you've found kit-worthy patterns. The
kit-growth session at the kit root will triage them. For now, just
note the candidates in HANDOVER.md:

```md
## Kit-worthy patterns (from this W)
- C1: <title> (score N/7) — see kit-growth-candidates.md
```

### Step 6 — Leave the gate green

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test tins-kit/scripts/selftest.mjs
```

Both must exit 0. If either fails, fix it before stopping. A broken
gate is worse than no gate.

---

## What you do NOT do (the kit machine does these)

- **Add new patterns to the kit** — that's the KITTING workflow at
  the kit root. You produce the candidates; the kit decides.
- **Sync the kit** — `scripts/kit-sync.mjs` is bidirectional; pull
  from kit when needed (`--to=./tins-kit`), don't push (the kit
  machine does that).
- **Edit kit files at tins-kit/** — read-only for the project. If you
  find a kit bug, add a BUILDER-DECISIONS-REVIEW entry describing
  the bug; the kit-growth session will fix it.

---

## When you get stuck

1. Re-read `tins-kit/INDEX.md` (the selective-chooser).
2. Re-read `tins-kit/PIPELINE.md` Step 2 (the 5 commands).
3. Re-read this project's HANDOVER.md (the W-queue).
4. If a kit question comes up (e.g. "should this be Decimal or
   Float?"), check `tins-kit/lib/patterns/` for a relevant pattern
   (e.g. `money-as-decimal.md`).
5. If you discover a generalizable pattern (the same decision
   appears in 2+ projects), the kit's growth loop will add it to
   the kit automatically.

---

## The 5 commands (memorise)

```bash
# Step 2: see what the kit recommends
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md

# Step 2: see the W-queue
cat HANDOVER.md | grep "### W"

# Step 4: validate the spec
node tins-kit/scripts/validate.mjs --spec=SPEC.md

# Step 4: record a decision
node tins-kit/scripts/decision-log.mjs builder --title="..." --context="..." --decision="..." --alternatives="..." --consequences="..."

# Step 5: mine learnings
node tins-kit/scripts/kit-extract.mjs --consumer=.

# Step 6: leave the gate green
node --test tins-kit/scripts/selftest.mjs
```

---

## What success looks like

1. The user gives you a TINS project + a request.
2. You read the kit shell + the project.
3. You pick the right W (or start a new one).
4. You interview the user (5 questions).
5. You spec first, code second.
6. You record decisions + update HANDOVER.
7. You mine learnings (if any).
8. You leave the gate green.
9. The next session reads HANDOVER and picks up where you left off.

Begin with Step 0.
```

---

*— End of `CONTINUE-TINS-PROJECT.md` prompt. See also:
`prompts/NEW-PROJECT.md` (Scenario 1, start from scratch),
`prompts/PROMOTE-TO-TINS.md` (Scenario 2, retro-fit),
`prompts/KIT-GROWTH-SESSION.md` (Scenario 4, triage the inbox),
`INDEX.md` (the selective-chooser), `PIPELINE.md` (the 7-step
methodology), `scripts/kit-coverage.mjs` (see what applies),
`scripts/decision-log.mjs` (record decisions),
`scripts/kit-extract.mjs` (mine learnings),
`scripts/validate.mjs` (the gate).*
