# T4 — status

**Outcome:** `blocked-escalation`
**Completed:** 2026-08-26T10:16:00Z
**Files touched:** `tests/store.test.mjs` (only), plus `delegation/tasks/T4/`.
**Escalations filed:** 1 open T2 — SPEC §8.10's gate command. 9 T1 judgement
calls recorded in `NOTES.md` §2.

> **The deliverable is complete and green.** `blocked-escalation` here means "a
> T2 is filed and outstanding", not "the work is unfinished". The open question
> is one sentence of `SPEC.md`; no answer to it changes a line of
> `tests/store.test.mjs`.

---

## Gate result

| Gate | Command | Result |
|---|---|---|
| Test suite | `node --test "tests/**/*.test.mjs"` | **38 tests, 11 suites, 0 fail**, exit 0 |
| Test suite | `node --test` (repo root) | **38 tests, 11 suites, 0 fail**, exit 0 |
| Test suite | `node --test tests/` — the literal §8.10 command | **exit 1** — `MODULE_NOT_FOUND` on the directory path. See below. |
| Syntax | `node --check tests/store.test.mjs` | clean |
| Spec validator | `node tins-kit/scripts/validate.mjs --spec SPEC.md` | **PASS** — 10 pass, 0 warn, 0 fail |

**Why the literal command is red.** On Node v22.22.2 the test runner treats a
positional argument to `--test` as a file or glob pattern and never expands a
bare directory, so it tries to load `<repo>/tests` as a module and fails before
any test file is read. Reproduced in an empty scratch directory holding one
three-line passing CommonJS test: `node --test tests2` fails identically, while
`node --test "tests2/*.test.js"` passes. **No content of
`tests/store.test.mjs` can make it exit 0.** That is the filed T2.

There is no `npm run typecheck` and no build step — D1 locks the project to zero
dependencies and there is no `package.json`.

---

## Acceptance criteria

| Criterion | Verified | Method |
|---|---|---|
| §8.10 the suite passes | yes, in substance | 38/38 under three working invocations; red only under the literal directory-argument form, for the runner reason above |
| §8.10 ≥8 assertions over §8.1–§8.5 | yes | 57 static `assert.*` call sites inside the five §8.1–§8.5 suites (106 across the file), over 21 tests. Floor is 8. |
| §8.1 add() shape | yes | 5 tests — id/text/done/createdAt, trimming, insertion order, 200 distinct ids, persisted under `STORAGE_KEY` |
| §8.2 empty input | yes | 4 tests — `""`, `"   "`, `"\t\n  "` → `null`, count unchanged, no notification |
| §8.3 toggle | yes | 4 tests — flips + `true`, twice restores, `toggle("nope")` → `false` with a byte-identical snapshot and no notification |
| §8.4 getVisible | yes | 5 tests — all three filters by id and order, `getTodos()` unchanged, returned arrays proved to be copies |
| §8.5 persistence | yes | 3 tests — full round-trip through a second `createStore()`, a `clearCompleted()` round-trip, and `delete globalThis.localStorage` → store works with `isPersistent() === false` |

Supporting coverage beyond the criteria: all seven §7 failure-table rows, and
the four §4.2 methods §8 never mentions (`getRemainingCount`, `clearCompleted`,
`remove`, `subscribe`). Full method per criterion in `NOTES.md` §5.

---

## Defects found in `src/store.js`

**None.** All 38 tests passed on the first run. Every §7 row behaves as the table
specifies, and `Object.keys(store).sort()` is exactly the nine §4.2 members.
`src/store.js` was read and never modified.

One defect was found **in `SPEC.md`** (§8.10's command, escalated) and one
misdiagnosis in `delegation/tasks/T1/status.md`, which attributes the same red
gate to `tests/` being empty — see `NOTES.md` §4.2.

---

## Scope confirmation

`find -newermt` against this session's start shows, from me: `tests/store.test.mjs`
and this `delegation/tasks/T4/` folder. `delegation/ESCALATIONS.md` and
`delegation/LEDGER.md` were written by `tins-kit/scripts/escalate.mjs` as its
documented behaviour when filing the T2 — the only ledger change is T4's Status
cell, `running` → `blocked-escalation`. `src/ui.js` carries a recent mtime from
T2 running concurrently; I did not read, import, or touch it. `src/store.js`,
`index.html`, `src/styles.css` and `SPEC.md` are unchanged.

Nothing was integrated or merged.

## Interface contract

Returned unchanged. The suite consumes only `STORAGE_KEY`, `createStore()`, and
the nine documented store methods; nothing internal is imported or asserted on.
