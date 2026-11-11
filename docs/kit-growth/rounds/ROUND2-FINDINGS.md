# Round 2 findings — three builds with the updated kit (2026-10-02)

Kit under test: `_external/tins-kit-next/` (KIT-VERSION 2.0.0+65d1dd6bab6a at launch). Builders had only the kit, `CORE.md`
and `docs/kit-growth/rounds/ROUND2-BRIEF.md`; all were Claude subagents (**same model family and harness as the
authors — a real limit; the other-harness check is `NEXT-VALIDATION.md`, still the owner's**). Projects:
`_external/round2/{focus-queue,expense-tracker,jayshankar-course}/`, each with `FRICTION.md`, `SPEC.md`,
`BUILDER-DECISIONS-REVIEW.md`, `sessions/`.

## Results (verified by me, not only reported)
| Build | Result | Re-checked |
|---|---|---|
| `focus-queue` — one-person ticketing + focus-assistant (WIP limit 1, deterministic `nextTicket`, mandatory self-report, hash-chained event log) | 44 tests, 19 hand-computed scoring cases; spec 10/10; kit selftest 144 pass / 16 skipped; session closed `passed` | `node --test tests/*.test.mjs` 44/0; `session check` clean |
| `expense-tracker` — integer-paise ledger, reversal-not-edit, CSV import dry-run, atomic write | 25 tests incl. 300-ledger property test and a SIGKILL crash test; mutation check (breaking `summary` fails 3 tests) | 25/0; `session check` clean |
| `jayshankar-course` — mistake-first, just-in-time course to rebuild the app, Track 1 (AI) / Track 2 (hand-written), UI 2.a Ant / 2.b Tailwind | `COURSE-MAP.md` 18 modules + 6 extensions, each opening mistake labelled REAL (decision #) or CONSTRUCTED; `METHOD.md`; one full pilot module (M05, stock screen) for both tracks and both UIs; code built and run (tsc clean, 14 tests, vite build, Playwright at 360/1024 px) | course gate passes; `session check` clean |
**Not built:** modules M01–M04, M06–M18 (map entries only); M03 needs a no-cloud SQL runner (PGlite untested); a fresh
`npm install` and a real Supabase were not exercised. The Ant flavour is a course construct (the shipped app is
Tailwind; D67 is open).

## Defects found — reported independently by 2–3 builders (strongest evidence)
| # | Defect | State |
|---|---|---|
| 1 | `validate --spec SPEC.md` ran the kit-inventory layer on a consumer's own spec: **35 false failures on every fresh scaffold**, so the documented "green" command could never pass (all three) | **Fixed** + regression test (confirmed to fail on the unfixed validator) |
| 2 | `ack`, `claim decision-number:next` and `decision-log` disagreed about the next decision number (a fenced template example counted) | **Fixed** (ack + claim; test). `decision-log`'s parser not re-verified |
| 3 | `CORE.md` pointed at `prompts/NEW-PROJECT.md` and `tins-kit/`, absent from a scaffold | **Fixed** (CORE rewritten) |
| 4 | `node --test tests/` fails on Node 22; scaffold had no `test` script | **Fixed** (`test: node --test`) |
| 5 | `kit-coverage` printed 8 of 12 hits as "weak" vocabulary-only noise for a CLI | **Fixed** (hidden by default, kept in `--json`) |
| 6 | `SPEC-AUTHOR` assumes a human, web search and the user's data | **Fixed** ("no human to interview" path) |
| 7 | Scaffold ships web-app `AGENTS.md`/`HANDOVER.md`, `prisma/`, a `typescript` devDependency regardless of project type | **Open** — needs a `--type cli\|web\|content` design decision |
| 8 | Claims for sequential numbers are ceremony in a single-writer project; `decision-log` then demands `--number` | **Documented in CORE**; auto-claim inside `decision-log` open |
| 9 | `ack` edits the record after `start` committed it → dirty tree; `decision-log` flags and headings don't line up; `close --gate-cmd` shell semantics undocumented | **Open** (minor) |

## Retrieval — the loop's weakest joint, now with real evidence
- **Spec time works for web/Postgres shapes and is noise for anything else**: `append-only-audit-log` and `fifo-cascade`
  were *adapted* (principle, not recipe) by both code builders; 9–10 of 12–13 hits per build were rejected (no DB, no web, one user).
- **Task time missed natural language.** Queries "store money as integer paise never float", "atomic write crash safe local
  json", "parse bank statement csv quoted commas", "reversing entry correction ledger", "random property test generator"
  returned **nothing**; the course builder's `client-side-aggregation` hit appeared only after using the pattern's own
  trigger words. Cause is partly *no pattern exists* and partly that **lib modules (e.g. `money-as-decimal`) are not indexed
  by `kit-coverage`** (unverified; it needs `@prisma/client` anyway).
- Verdict ledger across the two code builds (counted from their friction tables): **adapted 6 (3 each, principle only — none used as written), rejected ≈ 19.** `NOT WHEN` lines made rejections fast —
  the strongest evidence yet that authored `not_when` earns its place.

## What the builds say the kit should *contain* (kit-growth candidates — they are the consumers the loop was waiting for)
Integer-minor-units money (as a rule with a grep check); atomic file write (temp + fsync + rename) with a kill-the-child
crash test; append-only **domain** ledger with reversal chains (not a Postgres trigger); hash-chained event log /
fold-to-state; pure-core + injectable clock + CLI exit-code contract; seeded property-style testing; CSV import with
dry-run dedupe; "checks that can fail" (course: decision #30); and for the curriculum prompt below. Each of these was
rebuilt from scratch by a builder because retrieval returned nothing — the reinvention the loop exists to prevent, now
measured at n=3. **None has been written as a pattern yet; do not promote single-build lessons without the two-consumer bar**
(these builds are two independent consumers only for the ones both code builders hit: money/atomic-write/ledger).

## `prompts/GENERATE-CURRICULUM.md` — works partly
Assumes a finished, gate-green TINS project with `./tins-kit/` vendored, a learner who can already program, modules
ordered by subsystem, bugs as an appendix, one file per turn. The course builder kept its rules (real sources only,
resumability tracker, no invented bugs) and departed in five places (its D1). **Gaps:** no step to build/test shipped
code (where running it found 4 defects in the builder's own checker); no label for an *authored* failure
(→ REAL vs CONSTRUCTED); its `private-to-public` scan flagged the 8 citations a course must make. A mistake-first / JIT
variant is a candidate prompt.

## Protocol cost vs value (what the economics reviewer predicted, now observed)
~17–21 extra commands per build (doctor, start, ack, claims, decision-log × N, close, check). **Saved the builders:** the
dirty-tree refusal, `check`, `scan-secrets`, the Session-trailer reminder, `ack` forcing a read. **Gave nothing for one
task/one writer:** `check-task-independence`, per-number claims. Non-code work: the plumbing fits, the *gate* does not —
`close` needs a test command and nothing tests a lesson (the course builder wrote `scripts/course-gate.mjs`).

## What worked (keep)
`session start/close/check` coherent and fast; `scan-secrets` and `doctor` quiet and exact; `NOT WHEN`; the SPEC skeleton
(§0.0, §0.4, §9) forced useful thinking; `decision-log` supplying the entry shape and `Date:`; selftest skipping kit-only
tests in a consumer; the FIFO pattern's insistence on tie-break rules and fixtures shaped a real test plan.

## Honest limits
Three builds, one model family, no human in the loop, no second harness. The builders are "consumers" for the retrieval
question but not for the multi-agent one: **the parallel-worktree + reconciler path (`session.mjs check` across branches)
was not exercised in round 2** — only single-writer sessions. That is the most important unrun test of the ledger design.
