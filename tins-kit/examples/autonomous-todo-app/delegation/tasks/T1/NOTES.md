# T1 — `src/store.js` — worker notes

**Task:** state + persistence module for Focus.
**Files touched:** `src/store.js` (only).
**Outcome:** returned. No escalations filed.

---

## 1. What I built

`src/store.js`, exporting exactly the §4.2 surface and nothing else:

- `STORAGE_KEY = 'focus.todos.v1'`
- `createStore()` → `{ getTodos, getVisible, getRemainingCount, add, toggle,
  remove, clearCompleted, isPersistent, subscribe }`

Structure: three module-level helpers (`getStorage`, `makeId`, `keepValid`) and
one module-level `load()` implementing §4.3 "Loading at startup" verbatim, then
a closure per store holding `todos`, `persistent`, and the subscriber list.

Behaviour follows §4.3 and §7 directly:

- **add** trims, returns `null` on empty, mints `crypto.randomUUID()` or the
  `` `${Date.now()}-${counter++}` `` fallback, appends, persists, notifies.
- **toggle / remove** on an unknown id return `false` and do not persist or
  notify — §7 row 6 says "change nothing", and a persist+notify is a change.
- **load** distinguishes the three failure shapes §7 separates: storage
  unreadable (persistent = false), JSON corrupt (persistent stays true), entry
  malformed (drop that entry only).
- **persist** never lets a failed write cost the session its work.

No DOM reference of any kind; no imports at all (D1). The only global reached
for is `localStorage`, and every access is guarded.

---

## 2. T1 judgement calls

Each of these is a spec line that did not settle the case, decided inside locked
scope, reversible inside this one file, with no effect on the §4.2 signatures
other tasks are building against.

1. **`localStorage` is resolved lazily on every access, not captured at module
   load.** §4.1 requires the module to load under `node --test`, where the
   global is absent, and the T4 tests will almost certainly install a fake after
   importing. A captured reference would make the module's behaviour depend on
   import order. The lookup is also inside `try/catch`: reading the property
   itself throws in browsers configured to block site data, which is a load-time
   crash rather than the graceful degradation D3 asks for.

2. **`isPersistent()` is sticky-false: once a read or write has failed it never
   returns true again for that store.** §7 sets it false in two rows and never
   un-sets it, and §3 rule 2 asks for a *persistent* notice — a flag that flipped
   back on the next successful write would flicker the notice on and off as
   quota pressure varied. Writes keep being attempted after a failure regardless,
   because giving up on writing would turn a transient quota error into
   permanent data loss.

3. **Malformed-entry survivors are normalised to the four `Todo` fields, and an
   absent or non-finite `createdAt` becomes `Date.now()` at load.** §4.3 step 4
   validates only `id`, `text`, and `done`, so it is silent on an entry that
   passes but carries a junk `createdAt` or extra keys. Rebuilding the object
   means a corrupt cache cannot smuggle extra properties into the collection,
   and the substituted `createdAt` is a finite number that stabilises on the
   next write rather than a `NaN` that would poison any later sort. Authored
   `text` is copied through untouched (D4).

4. **An unrecognised filter value shows everything.** §4.2 types `Filter` as
   `'all'|'active'|'done'` but the store cannot enforce that at runtime.
   Defaulting to "show all" rather than "show none" is D5's spirit: a typo'd
   filter that hid every row would read to a user as their data being deleted.

5. **`getTodos()` and `getVisible()` return a fresh array every call; the `Todo`
   objects inside are shared, not cloned or frozen.** The fresh array is what
   §8.4 asks for. Cloning or freezing the todos was rejected deliberately:
   `add()` hands a `Todo` back to the caller by contract, so freezing would make
   a perfectly ordinary `todo.done = true` in `ui.js` or a test throw, and
   cloning would break identity between what `add()` returned and what
   `getTodos()` reports.

6. **A no-op mutation does not persist and does not notify.** `toggle`/`remove`
   with an unknown id and `clearCompleted()` when nothing is done all return
   early. §4.2's "every mutator persists after mutating" is conditioned on a
   mutation having happened; a spurious notify would make `ui.js` re-render for
   nothing.

7. **`notify()` iterates a snapshot of the subscriber list and does not catch
   subscriber exceptions.** The snapshot makes subscribing or unsubscribing from
   inside a callback safe. Not catching is the deliberate half: a throwing
   subscriber is a bug in the renderer, and swallowing it here would make a
   broken UI present as a broken store. Worth flagging to whoever owns `ui.js` —
   if a render throws, the mutation has already been applied and persisted, and
   the exception surfaces out of `add()`.

8. **A non-string argument to `add()` returns `null` rather than throwing.**
   §4.3 step 1 says "trim the input text" and step 2 says "create nothing, throw
   nothing"; `add(null)` has no text to trim, so it takes the same path as
   `add("")`. `String(text)` was rejected — it would turn `add(null)` into a
   todo reading "null".

9. **The fallback id counter is module-level, not per-store.** §4.3 writes
   `counter++` without naming a scope. Module scope is the safe reading: two
   stores constructed in the same millisecond in a test would otherwise mint
   identical ids.

10. **A corrupt stored value is left in place at load, not overwritten.** §4.3
    says to start empty; it does not say to erase. Nothing has been mutated at
    that point, and destroying a user's data as a side effect of a *read* is
    precisely what §3 rule 1 forbids. The first real mutation replaces it.

No T2 triggers fired. Nothing here spends money, touches credentials, publishes,
deletes user data, contradicts a §0.2 decision, or picks a product direction —
and every item above is a one-file change that is obvious and cheap to reverse
if the auditor disagrees.

---

## 3. Noticed, not acted on

- **§3 rule 1 ("no silent data loss") is only half-satisfiable inside the
  store.** `remove()` and `clearCompleted()` discard authored text and the store
  offers no undo. The rule allows "reversible **or** explicitly confirmed", so
  the confirmation has to live in `ui.js` (T2), and §9 explicitly rules out an
  undo stack. Flagging it because the criterion reads like a store obligation
  and is not one. `clearCompleted()` returning a count is the only affordance the
  store gives a UI here.

- **§8.10 ("`node --test tests/` passes, ≥8 assertions covering §8.1–§8.5") is
  currently red, and correctly so** — `tests/` is empty because
  `tests/store.test.mjs` is T4's file. `node --test tests/` exits 1 on an empty
  directory. Not my criterion and not my file; noted so the auditor does not read
  it as a T1 failure.

- **§4.2's contract has no way to distinguish "storage was never available" from
  "a write failed mid-session".** Both collapse to `isPersistent() === false`,
  so `ui.js` cannot word the §3 rule 2 notice differently for the two cases. That
  looks intentional (one notice, one flag) but the spec never says so. Not a
  defect I would fix by widening the interface — other tasks are built against it.

- **`getVisible()` returning shared `Todo` objects means `ui.js` can mutate a
  todo's `done` directly and bypass persistence entirely.** See judgement call 5
  for why freezing was rejected. If this ever bites, the fix is in `ui.js`
  discipline, not in the store's return shape.

---

## 4. How I verified each acceptance criterion

Verification ran two ways, because a fake `localStorage` is not the real thing:

- **`node --test`** against a scratchpad suite (31 tests, ~110 assertions) at
  `<scratchpad>/verify-t1.mjs`, using an in-memory `localStorage` stand-in
  installed on `globalThis`. Deliberately kept out of the repo — `tests/` belongs
  to T4 and this suite is not its deliverable.
- **A real Chromium page** (Playwright, per `TOOLING-AUDIT.md` §1) serving
  `store.js` over `http://localhost` and driving it against the browser's own
  `localStorage`. All 8 probes passed with no page errors and no console errors.

| Criterion | How it was checked | Result |
|---|---|---|
| **§8.1** `add("read the spec")` shape | Asserted `typeof id === 'string'` and non-empty, `text` equals the trimmed input (checked with and without surrounding whitespace), `done === false`, `createdAt` a finite number. Also asserted 500 consecutive adds produce 500 distinct ids, and that with `globalThis.crypto` forced undefined the id matches `/^\d+-\d+$/` and is still unique (§7 row 5). Re-checked in Chromium, where the id is a real UUID. | pass |
| **§8.2** `add("")` / `add("   ")` | Both return `null`; `getTodos().length` unchanged across `""`, `"   "`, and `"\t\n  "`. Also asserted a rejected add fires **no** subscriber callback, and that `add(null)`, `add(undefined)`, `add(42)` return `null` without throwing. | pass |
| **§8.3** toggle | `toggle(id)` returns `true` and flips `done`; a second call returns the todo to `done === false`. `toggle("nope")` returns `false`, leaves a JSON snapshot of `getTodos()` byte-identical, and fires no notification. | pass |
| **§8.4** getVisible | Built 3 todos with the middle one done: `'active'` → `[a, c]`, `'done'` → `[b]`, `'all'` → `[a, b, c]`, `getTodos().length` still 3 after all three calls (D5). Separately asserted the returned arrays are copies — truncating and pushing into them leaves the store at 2 todos — and that an unknown/`undefined` filter returns everything. | pass |
| **§8.5** persistence round-trip | With a shared fake storage: added, toggled, and removed through store A, then constructed store B over the same storage and asserted `deepEqual(B.getTodos(), A.getTodos())` including ids, text, and `done`. Repeated over the browser's real `localStorage` in Chromium, plus a `clearCompleted()` round-trip. For the unavailable half: deleted `globalThis.localStorage` entirely, then asserted `createStore()` returns a working store, `isPersistent() === false`, and add/toggle/remove/count all still function in memory. | pass |
| §7 (supporting) | One test per row: read throws → empty + `persistent` false; write throws → todo still created, session state intact, `persistent` false, and sticky across a later successful write while the write itself still lands; corrupt JSON and four non-array JSON shapes → empty with `persistent` still true and the corrupt value untouched in storage; a 9-entry array with 6 malformed entries → exactly the 2 valid ones survive; `crypto.randomUUID` absent → fallback id. | pass |
| §4.1 (supporting) | Stripped comments from the source and asserted it contains no `document`, `window.`, `HTMLElement`, `innerHTML`, `querySelector`, or `addEventListener`, and no non-relative `import`. Asserted `Object.keys(store).sort()` equals the nine §4.2 names exactly and all nine are functions. | pass |

Gate: `node tins-kit/scripts/validate.mjs --spec SPEC.md` → **10 pass, 0 warn,
0 fail, Result: PASS**. `node --check src/store.js` → clean.

Scope: `find` over the repo for anything modified during this session shows only
`src/store.js` from me. `index.html` and `src/styles.css` also show recent
mtimes — that is T3 working concurrently, not this task.

---

## 5. For the next session

- The `Todo` objects handed out by `add()`, `getTodos()`, and `getVisible()` are
  the store's own. Mutating one directly changes state without persisting or
  notifying. `ui.js` should route every change through `toggle`/`remove`.
- `subscribe()` fires **after** the write attempt, so `isPersistent()` is already
  settled when a subscriber runs. That ordering is what lets the §3 rule 2 notice
  render on the same tick as the mutation that revealed the failure; do not
  reorder it.
- `isPersistent()` can be `false` from the very first call (storage absent or
  unreadable) or flip to `false` later (a write failed). `ui.js` should read it
  on every notification, not just at startup.
- The unsubscribe function is idempotent — calling it twice is safe.
- If T4's tests install a fake `localStorage`, they can do it at any point before
  `createStore()`; the lookup is lazy. They should also `delete
  globalThis.localStorage` for the §8.5 unavailable case rather than setting it
  to a throwing object, since both paths are covered but the delete is the one
  that matches a browser with no web storage.
