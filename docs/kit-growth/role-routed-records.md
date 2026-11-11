# `role-routed-records` — kit pattern (DRAFT, kit-growth candidate)

> **Draft for `tins-kit/kit-staging/inbox/`. This repo never edits `tins-kit/` (AGENTS.md §6); a kit-growth
> session lands it via `prompts/KITTING.md`.** Copy to `lib/patterns/role-routed-records.md` when exporting.
>
> **The recipe for keeping a project's written memory (decisions, state, findings, claims) cheap to produce
> and readable by any model on any harness:** split *judgement* from *rendering*, store records as typed files
> in the repo (not in any harness's private memory), and let scripts — not a second expensive read — verify them.
>
> **Status: DRAFT v2 — revised after round-1 review (`rounds/round1-economics.md`, `round1-redteam.md`).** The
> first draft's central claim was wrong as stated; §0 now carries the measured numbers.
>
> **Source:** Jayshankar, 2026-10-02 — a reconciliation session. One consumer so far; the lessons below are
> design-level, and the pilot in §3 is what would confirm them. Complements `tiered-escalation.md` (which tiers
> decisions by reversibility) with a second axis: **who should produce which artefact**.

---

## 0. Why this exists

"Don't let the expensive model write the documentation" is the right instinct aimed at the wrong target. In
this project the cost of documentation was three things, in this order:

**The first version of this draft said "re-reading a 4,500-line decision log every session". That was wrong.**
Measured on the session itself (`rounds/round1-economics.md`, transcript aggregates, assumed price multipliers
cache-read 0.1 / cache-write 1.25 / output 5): the decision log was **never read in full** (0 `Read` calls; 56
targeted `grep`/`sed` lookups pulled ~26K of its ~82K tokens). The real shape:

| Share of session cost | % |
|---|---|
| Reading `.md` | ~21 |
| Verification output (grep / ls / git) | ~9 |
| Documentation writing | ~6 |
| Code writing | ~1 |
| Hidden thinking (inferred) / baseline context | ~8 / ~8 |

The driver is **turns × carried context**: 294 API calls, each re-reading ~430K cached tokens. 85 `grep` calls
returned ~60K tokens of payload but cost ~22% of the session — about 60× their payload — because each is a
round trip. About 160 of 294 calls were verification sweeps a script could do in one. So:

1. **Mechanise verification and return only failures** — one call instead of dozens.
2. **Make the bookkeeping cost zero extra round trips** (hooks and trailers, not "remember to run X").
3. **Write less *prose*, not *less often*:** the "why" stays with the model that decided.
4. Routing the *writing* to a cheaper model is worth **~2–3%** of session cost (of 172 sentences from 10 real
   decisions, 10% were derivable by script, 38% describable from the diff, **52% judgement**), and the facts file
   that feeds the cheap model is nearly as long as the sentence it replaces. Not worth the fidelity risk on its
   own — keep it as an option, not a goal.

Caching already discounts repeat reads *within* a harness; the argument is strongest for harnesses that do not
cache or sessions with long idle gaps (carry ~10× worse; reading outweighs writing there).

Tools already do a version of the routing idea for *code*: Aider's architect/editor split and Cline's per-mode
Plan/Act models pair a strong planner with a cheaper executor, and `AGENTS.md` is now a cross-tool convention
many harnesses read. None of them says what a *record* is, who may write which kind, or how a different
harness finds it — which is the gap this pattern fills.

---

## 1. The 3 lessons, in detail

### 1.1 A record is facts + a rationale; only the rationale needs a strong model

Every record here has the shape *what changed · why · evidence · what is not done*. Only part of that is
mechanical (~10% of sentences are derivable by script; another ~38% are describable from the diff by whoever
holds it; ~52% are judgement or transcript-only, e.g. a debugging narrative). So a record is authored in two
steps:

- the model that did the work states the **facts** as a small structured input (a `--facts` file or flags) and
  writes the **why** itself — two or three sentences, never delegated;
- a script (`scripts/decision-log.mjs` already exists for the numbering and shape) **renders** the entry from a
  template. A cheap model may polish prose; a script may do it alone.

Same split for `HANDOVER.md` state: the *snapshot* (what is built, migrations applied, last gate result) is
generated from the repo; only the *priorities* are written by a strong model.

### 1.2 The protocol is files and scripts, never chat or a harness's private memory

Every role in the loop must be playable by any harness that can read a file and run `npm run <x>`. Concretely:

- the entry point is `AGENTS.md` (read natively by Codex, Cursor, Copilot, Gemini CLI, Aider and others;
  Claude Code reads `CLAUDE.md`, so keep that a symlink or an `@AGENTS.md` import — verify against the
  harness's current docs, this moves);
- state a model learns must land in the repo as a typed record, not in `~/.claude/…`, a Cline memory bank, or a
  chat. Harness-private memory is a *cache* of the repo's records, never the source;
- anything the protocol needs is gitignored nowhere. (`delegation/` and `tins-kit/` being gitignored meant a
  fresh clone, or a second harness on another machine, silently lacked the ledger and the kit prompts.)

### 1.3 Verify cheap output with validators; spend the strong model on the facts, not the prose

If records have a schema, the gate can check them without a model: required fields present, `supersedes`/`refs`
resolve, ids unique and in sequence, a state snapshot no older than the newest record it should reflect, no
secret-shaped strings. What the gate cannot check — *is the why true?* — is a short read of 2–3 sentences per
record, not a re-read of the log. The audit cost becomes proportional to the number of records changed.

---

## 2. The 3 known anti-patterns

1. **The cheap model writes the rationale.** It produces a fluent, plausible reason that was never the real
   one, and the log becomes confidently wrong. Keep the *why* with whoever made the decision.
2. **One shared append-only file.** Parallel agents conflict on it, and every reader pays for the whole file.
   One file per record plus a generated index removes both costs. (Numbers allocated by "next free" from
   a shared file are what let two parallel agents each take the same number — verified in round 1.)
3. **Free-form records with no schema.** The validator can't audit what it can't parse, so a strong model has
   to, which is the cost this pattern exists to avoid.

---

## 3. When this pattern changes

- **Solo, single model, small project:** do none of it; plain markdown is cheaper than a schema.
- **Cheapest first slice (round-1 economics):** (1) a drift checker that returns *only failures*; (2) ledger
  facts via commit trailers and a hook, zero extra model calls; (3) a generated digest of the largest always-read
  file (SPEC §0 was 24% of this project's minimal reading chain); (4) per-record files only when 2+ agents run in
  parallel. Defer the cheap-model rendering, per-ref dispositions and map-reduce until a second consumer.
- **Pilot before adopting.** Re-run the transcript-aggregate script on 2–3 *build* sessions (the measured one
  was a docs-heavy session; its write mix was ~75% documentation, atypical).
- **If a harness gains native shared memory the others can read**, §1.2's "repo is the source" can relax to
  "repo is the export". Not true today.

---

*End of `role-routed-records` pattern.*
