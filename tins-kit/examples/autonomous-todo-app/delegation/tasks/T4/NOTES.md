# T4 — `tests/store.test.mjs` — worker notes

**Task:** the test suite for `src/store.js`.
**Files touched:** `tests/store.test.mjs` (only), plus this folder.
**Outcome:** `blocked-escalation` — one T2 filed (SPEC §8.10's gate command).
**Deliverable state:** complete and green. 38 tests, 106 assertions, 0 fail.

---

## 1. What I built

`tests/store.test.mjs` — a single file, `node:test` + `node:assert/strict`, no
imports beyond those two and `../src/store.js`. Zero dependencies, no framework,
no install (D1, §4.4).

11 suites / 38 tests / ~106 assertions, organised by the spec section each one
answers to:

| Suite | Tests | What it covers |
|---|---|---|
| §4.2 interface contract | 3 | `STORAGE_KEY`'s value; `Object.keys(store).sort()` is exactly the nine documented members and all nine are functions; a store over empty storage starts empty and persistent |
| §8.1 add() | 5 | todo shape, trimming, insertion order, 200 distinct ids, and that the todo lands under `STORAGE_KEY` |
| §8.2 empty input | 4 | `""`, `"   "`, `"\t\n  "` → `null`, count unchanged, no notification |
| §8.3 toggle | 4 | flips + `true`, twice restores, `toggle("nope")` → `false` and changes nothing, remaining count stays in step |
| §8.4 getVisible | 5 | `active` / `done` / `all`, no mutation of `getTodos()`, returned arrays are copies |
| §8.5 persistence | 3 | full round-trip through a second `createStore()`, a `clearCompleted()` round-trip, and the storage-unavailable path |
| §7 failure table | 7 | one test per row (see §4 below) |
| §2.3 / §2.5 / §2.6 | 4 | `remove`, `clearCompleted`, `getRemainingCount` |
| §4.2 subscribe | 3 | notification per mutation, unsubscribe, idempotent unsubscribe, multiple subscribers, subscriber sees the mutation |

Only the §4.2 public surface is touched. Nothing imports or asserts on a
module-internal name.

---

## 2. T1 judgement calls (each with its reason)

**2.1 `localStorage` is an in-memory stand-in installed on `globalThis` by the
test file itself.** Node has no web storage (Node 22 only exposes
`localStorage` behind `--experimental-webstorage`, and the brief and D1 rule out
extra flags and dependencies). `store.js` resolves `globalThis.localStorage`
lazily on every access — T1's judgement call 1 — so a fake installed before
`createStore()` is seen, and the module needs no change to be testable. The
stand-in implements `getItem`/`setItem`/`removeItem`/`clear`/`key`/`length`, not
just the two methods the store calls, so it fails the way real storage would if
the store ever reached for more.

**2.2 The global is installed and restored per test, in a `try/finally`, and
every test body is synchronous.** `withStorage()` saves whether
`globalThis.localStorage` was an own property and restores exactly that state.
Because no test body is `async`, two tests can never hold the global at the same
time no matter how the runner schedules them — this does not rely on
`node:test`'s default concurrency of 1. `withoutCrypto()` does the same for
`globalThis.crypto`, restoring the original property descriptor rather than
re-assigning (the global is a configurable accessor, not a data property).

**2.3 Storage failure is injected through the stand-in, not by patching the
module.** `makeStorage({ throwOnRead })` and `{ throwOnWrite }` throw from
`getItem`/`setItem`. That is exactly the shape §7 rows 1 and 2 describe —
storage that is present but refuses — and it keeps the test on the public side of
the boundary.

**2.4 "Storage unavailable" is `delete globalThis.localStorage`, not a throwing
object.** Both are covered (the throwing object is §7 row 1), but the delete is
what a browser with no web storage and what plain Node actually look like, and
it is what T1's notes §5 recommended for the §8.5 case.

**2.5 §7 row 6's "change nothing" is asserted as: return `false`, a
`JSON.stringify` snapshot of `getTodos()` byte-identical, and no subscriber
notification.** The notification assertion is the one judgement here — §4.2 says
"every mutator persists after mutating and notifies subscribers", so a call that
mutated nothing should notify nobody. It matches what `store.js` does. Flagging
it because a spurious notify is arguably not a "change"; if the auditor reads it
the other way, delete two lines in each of the two tests.

**2.6 I did not test behaviour the spec leaves to `store.js`'s own judgement.**
`getVisible()` with an unrecognised filter, whether a corrupt stored value is
left in place at load, and the exact `createdAt` substituted for a malformed
entry are all T1 judgement calls (its notes §2.3, §2.4, §2.10), not spec lines.
Asserting them here would freeze another worker's private decisions into the
gate. `add(null)` is left out for the same reason (T1's §2.8).

**2.7 Assertions use `node:assert/strict`.** `assert.equal` is then `===`, so a
`done` of `"yes"` or an `id` of `42` cannot pass a test written for `false` and
`'42'`. The §7 row 4 fixture depends on that sharpness.

**2.8 Suites are named after the spec section they answer to** (`§8.1 add()
returns a well-formed todo`, …). The runner prints the section id next to every
pass or fail, so a red gate names the criterion it broke without anyone opening
the file.

**2.9 The suite goes beyond the §8.1–§8.5 floor on purpose** — all seven §7 rows
and the four §4.2 methods those criteria never mention (`getRemainingCount`,
`clearCompleted`, `subscribe`, `remove`). The brief says treat 8 assertions as a
floor; the store's whole public surface is now covered, at 106 assertions.

No T0/T1 call changed a shared interface. `src/store.js` was read, never
modified.

---

## 3. The T2 I filed

**SPEC §8.10 names a gate command that cannot pass on this project's runtime.**

`node --test tests/` exits 1 on Node v22.22.2 with
`Error: Cannot find module '<abs>/tests'` — the runner treats a positional
argument as a file or glob pattern and never expands a bare directory. This is
argument handling, not anything about the suite: I reproduced it in an empty
scratch directory containing one three-line passing CommonJS test, where
`node --test tests2` fails identically and `node --test "tests2/*.test.js"`
passes. The failure happens before any test file is loaded, so **no possible
content of `tests/store.test.mjs` makes the literal command exit 0.**

Filed as T2 rather than decided as T1 because the fix is an amendment to
`SPEC.md`, which is always T2, and because the line at issue is this task's own
acceptance criterion — the one thing a worker must not resolve by interpreting
it (WORKER-SESSION.md step 2.2). It is the same shape as the SPEC-1 escalation
already in the queue: a spec sentence asserting a runtime behaviour that the
runtime falsifies, found by running it rather than by reading it. Options and a
recommendation (B — `node --test "tests/**/*.test.mjs"`) are in
`delegation/ESCALATIONS.md`.

The answer cannot change a line of `tests/store.test.mjs`. Only §8.10's wording
is in question.

---

## 4. Noticed, not acted on

**4.1 No defect found in `src/store.js`.** Every one of the 38 tests passes
first time. All seven §7 rows behave exactly as the table specifies, the §4.2
surface is exactly the nine documented members, and the §8.1–§8.5 criteria hold
under both a working storage and no storage at all. I found nothing to report
against the module, and I changed nothing in it.

**4.2 `delegation/tasks/T1/status.md` misdiagnoses the red gate.** It says
"`node --test tests/` is red … `tests/` is empty: `node --test` exits 1 on a
directory with no test files", predicting it would go green once this file
existed. The emptiness was not the cause; the directory argument is. The gate is
still red now that the suite exists and passes. Not my file to correct — noting
it so the auditor does not carry the wrong explanation into integration.

**4.3 `src/store.js` loads as ESM only because Node's module-syntax detection is
on by default here.** There is no `package.json` and therefore no
`"type": "module"`, so a bare `.js` file is nominally CommonJS; Node v22.7+
detects the `export` syntax and loads it as ESM anyway. It works today (verified)
and D1 forbids adding a `package.json` for a dependency's sake — but the project
has an unstated dependency on that detection behaviour. If a future Node ever
requires the flag again, both the tests and any Node-side use of `store.js`
break at import. §4.4 might be worth a sentence about it. Not a worker's call and
not in my file list.

**4.4 §8.10's "at least 8 assertions" is a floor with no upper bound and no
mechanical definition of "assertion".** I counted `assert.*` call sites (106
total; 57 of them inside the §8.1–§8.5 suites, more at runtime because two are
inside loops). Any reasonable counting rule clears the floor by an order of
magnitude, so the ambiguity never bit — noting it because the criterion would be
awkward to check mechanically if a suite ever sat near the boundary.

**4.5 `src/ui.js` appeared in `src/` while I worked** (T2, running in parallel).
I did not read, run, import, or touch it. This suite imports `../src/store.js`
and nothing else from the project.

---

## 5. How I verified each acceptance criterion

| Criterion | How it was checked | Result |
|---|---|---|
| **§8.10 — the suite passes** | `node --test "tests/**/*.test.mjs"` → 38 tests, 11 suites, **0 fail**, exit 0. Same result from `node --test` at the repo root, and from `node --test tests/*.test.mjs` (shell-expanded). `node --check tests/store.test.mjs` clean. | **pass in substance** |
| **§8.10 — the literal command** | `node --test tests/` → exit 1, `MODULE_NOT_FOUND` on the directory path. Reproduced with a one-line passing CJS test in an empty scratch directory, so it is Node's argument handling and not this suite. | **red — escalated, see §3** |
| **§8.10 — ≥8 assertions over §8.1–§8.5** | Counted `assert.*` call sites inside the five `describe` blocks named §8.1–§8.5: 15 + 8 + 12 + 6 + 16 = **57** static call sites across 21 tests (more at runtime; the §7 non-array loop and others iterate). The floor is 8. | **pass** |
| **§8.1** | 5 tests: `typeof id === 'string'` and non-empty, `text` equals the trimmed input (checked with and without surrounding whitespace and newlines), `done === false`, `createdAt` a finite number; insertion order by both text and id; 200 adds → 200 distinct ids; the todo is readable back out of the stand-in under `STORAGE_KEY`. | **pass** |
| **§8.2** | 4 tests: `add("")` and `add("   ")` each return `null` with `getTodos().length` unchanged from a non-zero baseline; `add("\t\n  ")` likewise from zero; a rejected add fires no subscriber callback while the next real add fires exactly one. | **pass** |
| **§8.3** | 4 tests: `toggle(id)` returns `true` and `getTodos()[0].done` becomes `true`; a second call returns it to `false`; `toggle("nope")` returns `false`, leaves a JSON snapshot byte-identical and notifies nobody; `getRemainingCount()` tracks the flips both ways. | **pass** |
| **§8.4** | 5 tests over three todos with the middle one done: `active` → `[a, c]`, `done` → `[b]`, `all` → `[a, b, c]` (compared by id, so order is asserted too); after all three calls `getTodos()` is still length 3 and byte-identical to its snapshot; truncating and pushing into the returned arrays leaves the store at 3. | **pass** |
| **§8.5** | 3 tests: add ×3, toggle, remove through store A, then `createStore()` over the same storage → `deepEqual` on the whole array plus id order, `done` state, remaining count and `isPersistent() === true`; a `clearCompleted()` round-trip separately; and with `globalThis.localStorage` deleted, `createStore()` returns a working store whose `isPersistent()` is `false` and whose add/toggle/remove/getVisible/getRemainingCount all still function in memory. | **pass** |
| §7 (supporting) | One test per row. Row 1 read throws → empty + persistent `false` even with data present. Row 2 write throws → todo still created, count 1, persistent `false`, and toggle/remove still work afterwards. Row 3 corrupt JSON → empty, persistent stays `true`, store usable after; plus five non-array JSON shapes (`{"todos":[]}`, a string, a number, `null`, `true`) in a loop. Row 4 → a 9-entry array with 7 bad entries (non-string id, missing text, object text, string `done`, `null`, a bare string, a nested array) leaves exactly the 2 valid ones, in order. Row 5 → with `globalThis.crypto` removed, ids match `/^\d+-\d+$/` and are distinct. Row 6 → `remove("nope")` returns `false`, snapshot identical, no notification. | **pass** |
| Spec gate | `node tins-kit/scripts/validate.mjs --spec SPEC.md` → 10 pass, 0 warn, 0 fail, **PASS**. There is no `npm` gate — D1 forbids one. | **pass** |

---

## 6. Scope confirmation

No git here, so scope was checked with `find -newermt` against this session's
start. Files modified by me:

- `tests/store.test.mjs` — my one deliverable.
- `delegation/tasks/T4/NOTES.md`, `delegation/tasks/T4/status.md` — this folder.
- `delegation/ESCALATIONS.md` and `delegation/LEDGER.md` — **written by
  `tins-kit/scripts/escalate.mjs`**, not by hand. The brief told me not to touch
  the ledger; the escalation script marks the task row `blocked-escalation` as
  its documented behaviour, and the brief handed me that exact command. The only
  ledger change is T4's Status cell: `running` → `blocked-escalation`.

`src/ui.js` also carries a recent mtime — that is T2 working concurrently in its
own file list, untouched by me. `src/store.js`, `index.html`, `src/styles.css`
and `SPEC.md` are unchanged. Nothing was integrated or merged.

---

## 7. For the next session

1. **Run the suite with `node --test "tests/**/*.test.mjs"` or `node --test`
   from the repo root** until §8.10 is answered. `node --test tests/` is red for
   a reason no file can fix.
2. **The suite is a live gate for `ui.js` too** — if T2 mutates a `Todo` object
   directly instead of routing through `toggle`/`remove` (T1's notes §5), these
   tests will not catch it, because they only exercise the store. That
   discipline still has to come from `ui.js`'s own review.
3. **Adding a test needs no harness work**: `withStore(options, (store,
   storage) => …)` installs a fake `localStorage`, builds a store over it, and
   restores the global afterwards. `null` in place of the options object means
   "no web storage at all". Keep new test bodies synchronous — that is what makes
   the global-swapping safe.
