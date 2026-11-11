# T1 — status

**Outcome:** `returned`
**Completed:** 2026-08-26T10:02:36Z
**Files touched:** `src/store.js` (only)
**Escalations filed:** none. 10 T1 judgement calls recorded in `NOTES.md` §2.

---

## Gate result

| Gate | Command | Result |
|---|---|---|
| Spec validator | `node tins-kit/scripts/validate.mjs --spec SPEC.md` | **PASS** — 10 pass, 0 warn, 0 fail |
| Syntax | `node --check src/store.js` | clean |
| Unit verification | `node --test <scratchpad>/verify-t1.mjs` | **31/31 pass**, 0 fail (~110 assertions) |
| Real-browser verification | Chromium via Playwright, `store.js` served over `http://localhost`, driven against the browser's own `localStorage` | **8/8 probes pass**, no page errors, no console errors |

**Project gate `node --test tests/` is red, and that is expected, not a T1
failure.** `tests/` is empty: `tests/store.test.mjs` is T4's file and T4 has not
run. `node --test` exits 1 on a directory with no test files. §8.10 is T4's
acceptance criterion. Nothing else in the project's gate applies — D1 locks the
project to zero dependencies, so there is no `npm run typecheck`, no build step,
and no `package.json`.

The unit suite lives in the scratchpad rather than in `tests/` on purpose:
writing it into the repo would have collided with T4's only file.

---

## Acceptance criteria

| Criterion | Verified | Method |
|---|---|---|
| §8.1 add returns a well-formed todo | yes | field-by-field assertions on shape, trimming, id uniqueness over 500 adds, and the `crypto.randomUUID`-absent fallback; re-checked in Chromium |
| §8.2 empty/whitespace add returns `null`, count unchanged | yes | `""`, `"   "`, `"\t\n  "` plus non-string inputs; also asserted no subscriber notification fires |
| §8.3 toggle flips, twice restores, unknown id `false` | yes | round-trip flip; unknown id leaves a JSON snapshot byte-identical and fires no notification |
| §8.4 filters exclude/include correctly and never mutate | yes | 3 todos with one done, all three filters checked, `getTodos()` length unchanged; returned arrays proved to be copies |
| §8.5 fresh store re-reads the same todos; works with storage unavailable | yes | shared fake storage round-trip via `deepEqual`, repeated against real browser `localStorage`; then `delete globalThis.localStorage` and asserted the store still works with `isPersistent() === false` |

Supporting coverage, not required of T1 but checked: every row of §7's failure
table, and §4.1's "no DOM access whatsoever" (source scanned for `document`,
`window.`, `HTMLElement`, `innerHTML`, `querySelector`, `addEventListener`, and
non-relative imports — none present).

Full method for each criterion is in `NOTES.md` §4.

---

## Scope confirmation

`find` over the repo for files modified during this session returns only
`src/store.js` from this worker. `index.html` and `src/styles.css` also carry
recent mtimes — that is T3 running concurrently in its own file list, untouched
by T1. `delegation/LEDGER.md` was not modified. Nothing was integrated or merged.

## Interface contract

Returned unchanged. `STORAGE_KEY` and `createStore()` are exported; the store
exposes exactly the nine §4.2 members and nothing else, asserted mechanically
via `Object.keys(store).sort()`.
