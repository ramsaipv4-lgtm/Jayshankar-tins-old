<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:LOW -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:JAVASCRIPT -->

# Focus — Canonical Specification (v1)

> A single-user, offline-first todo list that runs as a static page with no
> backend, no build step, and no dependencies.

---

## 0. Preamble

### 0.0 Cheapest version that would work

A plain text file on the desktop, edited by hand. That genuinely works for one
person and costs nothing to build or maintain.

**The expensive version below buys:** state that survives a reload without the
user thinking about saving, a filter that hides finished work without deleting
it, and a keyboard-reachable interface a text file cannot offer. It does not
buy sync, sharing, or multi-device access — those need a backend, which §0.2
D2 rules out.

### 0.1 What this document is

The canonical specification for **Focus**, a demo TINS project built to
exercise the kit's autonomous build pipeline end to end. The document is the
source: if the app is wrong, this file was wrong.

### 0.2 Locked decisions

| # | Decision | Resolution | Source |
|---|---|---|---|
| **D1** | **Zero dependencies, zero build step.** Plain ES modules loaded directly by the browser. No bundler, no framework, no package installs. `node --test` runs the tests using only Node built-ins. | LOCKED | The kit's D3 zero-dependency discipline; also makes the demo runnable anywhere without a network |
| **D2** | **No backend.** All state lives in the browser. No server, no API, no accounts. | LOCKED | `lib/patterns/` no-backend module; single-user scope makes a server pure cost |
| **D3** | **`localStorage` is a cache, not the source of truth.** The in-memory state is authoritative during a session; `localStorage` is written after every mutation and read once at startup. When `localStorage` is unavailable the app runs fully in memory and says so. | LOCKED | Private-browsing and quota-exceeded both make storage fail at runtime, not at load |
| **D4** | **Ids are generated, never authored.** A todo's `id` is derived at creation and never edited by a user or a script. Its `text` is authored and must never be overwritten by derived data. | LOCKED | The kit's authored-vs-derived separation rule |
| **D5** | **Filtering hides, it never deletes.** Switching to "active" removes finished todos from view only. The stored collection is unchanged. | LOCKED | Filter-as-deletion is the most common bug in this app category |
| **D6** | **Public release intended: FALSE.** This is a demo artefact inside the kit's own examples, not a shipped product. | LOCKED | Kit D30's mandatory release-intent question |

### 0.3 What exists vs. what is to build

Nothing exists. Every file in §4.1 is to be built.

### 0.4 What changed from the original brief

| Original brief | Actual requirement | What changed |
|---|---|---|
| "a todo app" | A demo whose modules are genuinely file-disjoint, so an autonomous run can build them in parallel | The store / UI / shell split in §4.1 is driven by parallelisability, not by taste. A single `app.js` would be simpler and would defeat the demo's purpose |
| "saves your todos" | Survives reload, and degrades honestly when storage is denied rather than failing silently | D3 makes `localStorage` a cache and requires a visible notice on failure |
| "shows completed ones separately" | A filter over one collection, not two collections | D5 — two collections invite drift between them |

---

## 1. Description

A single-page todo list for one person on one device. The worst device that
must work is a 320px-wide phone on no network after first load. It renders as
a static page opened directly from disk or served by any static host.

---

## 2. Functionality

**2.1 Add a todo.** A text field and an add control. Submitting non-empty text
creates a todo and clears the field. Whitespace-only input is rejected without
creating anything and without an error dialog.

**2.2 Toggle a todo.** Each row has a checkbox. Toggling flips its done state
and re-renders. Toggling twice returns to the original state.

**2.3 Remove a todo.** Each row has a delete control that removes that todo
from the collection.

**2.4 Filter.** Three filters — all, active, done. The active filter is
visually distinct. Filtering changes the view only (D5).

**2.5 Clear completed.** A control that removes every done todo at once.

**2.6 Counter.** A live count of remaining active todos.

**2.7 Empty state.** When nothing is visible, show a message appropriate to
why: no todos at all (offer the action), or none matching this filter (offer
the hint).

---

## 3. Universal behaviour rules

1. **No silent data loss.** Any action that discards a user's data must be
   either reversible or explicitly confirmed. The app never destroys authored
   text as a side effect of something the user was not asking for.
2. **Storage failure is visible.** If `localStorage` cannot be read or
   written, the app keeps working in memory and shows a persistent notice.
3. **Keyboard first.** Every control is reachable and operable by keyboard,
   with a visible focus indicator.
4. **Text is untrusted.** Todo text is rendered as text, never as markup.
5. **Derived data never overwrites authored data** (D4).

---

## 4. Technical implementation

### 4.1 Architecture

```
index.html          the shell: markup skeleton and module script tag
src/store.js        state + persistence. No DOM access whatsoever
src/ui.js           DOM rendering + event wiring. Calls store, owns no state
src/styles.css      all styling
tests/store.test.mjs  node:test tests for store.js
```

`store.js` must not touch the DOM. `ui.js` must not hold state. This
separation is what makes the two files independently buildable.

### 4.2 Interface contract

`src/store.js` exports exactly this. `src/ui.js` and `tests/store.test.mjs`
are built against it and must not change it.

```js
/** @typedef {{ id: string, text: string, done: boolean, createdAt: number }} Todo */
/** @typedef {'all'|'active'|'done'} Filter */

export const STORAGE_KEY = 'focus.todos.v1';

/** Creates a store. Loads persisted todos if storage is readable. */
export function createStore(): Store;

/**
 * Store shape:
 *   getTodos(): Todo[]                 all todos, insertion order
 *   getVisible(filter: Filter): Todo[] filtered view (never mutates)
 *   getRemainingCount(): number        count of !done
 *   add(text: string): Todo | null     null if text is empty/whitespace
 *   toggle(id: string): boolean        true if a todo changed
 *   remove(id: string): boolean        true if a todo was removed
 *   clearCompleted(): number           how many were removed
 *   isPersistent(): boolean            false when storage is unavailable
 *   subscribe(fn: () => void): () => void   returns an unsubscribe fn
 */
```

Every mutator persists after mutating and notifies subscribers.

### 4.3 Algorithms

**Adding a todo:**
1. Trim the input text.
2. If the result is empty, return `null`. Create nothing, throw nothing.
3. Build `{ id, text: trimmed, done: false, createdAt: Date.now() }` where
   `id` is `crypto.randomUUID()` when available, else
   `` `${Date.now()}-${counter++}` ``.
4. Append to the collection. Persist. Notify. Return the todo.

**Loading at startup:**
1. Attempt to read `STORAGE_KEY`. If reading throws, set persistent = false,
   start empty, and stop.
2. If absent, start empty with persistent = true.
3. Parse. If parsing throws, or the result is not an array, start empty —
   never crash on corrupt state.
4. Keep only entries with a string `id`, a string `text`, and a boolean
   `done`. Drop the rest silently; a malformed entry is not recoverable and
   blocking startup on it helps nobody.

**Persisting:** serialise the collection and write it. If writing throws
(quota, private mode), set persistent = false and keep the in-memory state.
Never lose the session's work because the write failed.

### 4.4 Dependencies

None. Runtime is the browser's own ES module support; tests use `node:test`
and `node:assert` only.

---

## 5. Style guide

System font stack. A single accent colour `#2563eb` for interactive elements.
Body text `#1f2937` on `#ffffff`; muted text `#6b7280`. 8px spacing rhythm.
Maximum content width 34rem, centred. Done todos are muted and struck through.

---

## 6. Accessibility

Every control is a real focusable element with an accessible name. Focus is
visible at all times with at least a 2px indicator. The remaining-count region
announces politely on change. Contrast meets WCAG AA for body text.

---

## 7. Error handling

| Failure | Exact behaviour |
|---|---|
| `localStorage` read throws | Start empty, persistent = false, show the notice |
| `localStorage` write throws | Keep in-memory state, persistent = false, show the notice |
| Stored JSON is corrupt | Start empty, persistent stays true, no crash |
| A stored entry is malformed | Drop that entry, keep the rest |
| `crypto.randomUUID` unavailable | Fall back to the timestamp+counter id |
| Toggle/remove with an unknown id | Return `false`, change nothing |

---

## 8. Acceptance criteria

- **§8.1** `add("read the spec")` returns a todo with a non-empty string `id`,
  `text` equal to the trimmed input, `done === false`, and a numeric
  `createdAt`.
- **§8.2** `add("")` and `add("   ")` each return `null` and leave
  `getTodos().length` unchanged.
- **§8.3** `toggle(id)` flips `done` and returns `true`; calling it twice
  returns the todo to its original state. `toggle("nope")` returns `false`.
- **§8.4** `getVisible('active')` excludes done todos, `getVisible('done')`
  includes only done todos, `getVisible('all')` returns every todo, and none
  of the three mutates `getTodos()`.
- **§8.5** After mutations, a fresh `createStore()` reading the same storage
  returns the same todos. With storage unavailable, `createStore()` still
  works and `isPersistent()` returns `false`.
- **§8.6** The rendered list contains exactly one row per visible todo, each
  with a checkbox and a delete control carrying an accessible name.
- **§8.7** With no todos at all the empty state offers the primary action;
  with todos present but none matching the filter it offers a hint instead.
- **§8.8** At 320px viewport width the page does not scroll horizontally.
- **§8.9** Every interactive element is reachable by keyboard and shows a
  visible focus indicator of at least 2px.
- **§8.10** `node --test tests/` passes, with at least 8 assertions covering
  §8.1 through §8.5.

---

## 9. Out of scope

- **Sync, sharing, or accounts.** D2 rules out a backend; anything
  multi-device is therefore impossible and is not attempted.
- **Due dates, priorities, tags, or sub-tasks.** One list, flat, in insertion
  order.
- **Undo history beyond what §3 rule 1 requires.** No general undo stack.
- **A build step.** No bundler, no transpiler, no minifier (D1).
- **Drag-to-reorder.** Insertion order only.
