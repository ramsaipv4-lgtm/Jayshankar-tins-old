# T2 — `src/ui.js` — worker notes

**Task:** DOM rendering and event wiring for Focus.
**Files touched:** `src/ui.js` (only). 349 lines.
**Outcome:** returned. No escalation filed — see §2.0 for the one call that was
weighed as a T2 and why it resolved down.

---

## 1. What I built

`src/ui.js`: one `render()` subscribed to the store, plus five delegated event
listeners. It imports `createStore` from `./store.js` and nothing else.

**Shape.** `mustGet(id)` resolves the eight contract ids or throws; module scope
holds exactly one mutable binding, `let filter = 'all'`; `render()` reads the
store and rewrites the six regions this module owns; wiring routes every gesture
back through the store's §4.2 API. `store.subscribe(render)` then `render()` at
the bottom, so there is one repaint per mutation and no second source of truth.

**What `render()` writes**

| Region | Behaviour |
|---|---|
| `#todo-list` | one `<li>` per `getVisible(filter)` entry, built with `createElement` + `textContent` and swapped in with `replaceChildren` (§8.6) |
| `#remaining-count` | `` `${getRemainingCount()} remaining` ``, written only when the string changed (§2.6) |
| `#filters` | `aria-pressed` set true on the showing filter, false on the other two (§2.4) |
| `#empty-state` | hidden when rows exist; otherwise the offer or the hint (§2.7, §8.7) |
| `#clear-completed` | `disabled` when nothing is done (§2.5) |
| `#storage-notice` | `hidden = store.isPersistent()`, re-read every render (§3 rule 2) |

**Row markup.** `<li data-id data-done><label><input type=checkbox><span>text</span></label><button aria-label="Delete: …">Delete</button></li>`.
The wrapping `<label>` names the checkbox from the todo's own text without
minting an `id` per row; the `<span>` gives the stylesheet an element to strike
(T3 notes §2.3 warned a bare text node cannot be targeted).

**Wiring.** Submit → `store.add(input.value)`. Delegated `change` on the list →
`store.toggle(id)`. Delegated `click` on the list → `store.remove(id)`. Delegated
`click` on `#filters` → set `filter`, re-render. `#clear-completed` → confirm,
then `store.clearCompleted()`. Delegation throughout, so rows rebuilt by
`render()` need no rebinding and no listener leaks.

Interface contract came back unchanged: `src/store.js` was read, never edited;
all eight shell ids are used verbatim and none was renamed.

---

## 2. T1 judgement calls

### 2.0 The one I weighed as a T2 first: §3 rule 1 vs §2.5 (clear completed)

**Decision: "Clear completed" asks for an explicit `window.confirm()` naming the
count; per-row delete does not.**

§3 rule 1 allows a destructive action to be *either* reversible *or* explicitly
confirmed. I checked whether reversible was available to me and it is not:

- an undo buffer holds authored todo text, i.e. application state, and §4.1
  forbids `ui.js` from holding any;
- §9 rules out an undo stack;
- the store's §4.2 surface has no restore, and T1's file is closed to me — the
  only path back through the public API is `add(text)`, which mints a **new**
  id, a new `createdAt`, appends at the end and resets `done`. That is not
  restoration, it is a lossy re-creation, and offering it as "Undo" would be a
  worse lie than no undo at all.

So rule 1's "or" collapses to one branch. Confirmation is not a preference here,
it is the only compliant mechanism left, which is why this did **not** meet the
T2 bar despite the word "delete" appearing in the trigger list.

**Why not T2, in the pattern's own terms.** `tiered-escalation.md` §1.1 tiers by
reversibility and blast radius, and §1.2's test is *"if I am wrong, is it obvious
within the hour, and is it cheap to undo?"* — a confirm dialog is the first thing
anyone sees on clicking the button, and reversing it is deleting one `if`. Both
yeses. The T2 trigger "deleting data" describes the *agent* performing an
irreversible destructive act during the build; it does not describe implementing
a delete feature the spec itself mandates in §2.5 — on that reading §2.3 would be
unbuildable too. And nothing was blocked: filing this would have been the
status-update anti-pattern from §2.1. `native confirm()` was chosen over a custom
modal because it is keyboard- and screen-reader-operable with no focus-trap code,
and D1 forbids reaching for a library.

**Why per-row delete is *not* confirmed.** Rule 1's own second sentence scopes
the harm: destruction "as a side effect of something the user was **not** asking
for". Pressing one row's delete control, whose accessible name is
`Delete: <that todo's text>`, is precisely asking, for one named item the user
can see. "Clear completed" is different in kind — one press, N items, and under
the `active` filter **every** row it destroys is off screen. That is the silent
loss rule 1 names, and it is why the prompt states the count rather than asking a
generic "are you sure?". Confirming every single delete would also contradict
§2.3's plain reading ("a delete control that removes that todo").

If the auditor disagrees, both halves are one-line changes in this file.

### 2.1 Done rows are marked with `data-done="true"`, one convention, everywhere

The brief offered three and asked for consistency. `data-done` is explicit in the
DOM, survives a browser without `:has()` support, and does not depend on
inferring state from a control's checked property. Open rows carry
`data-done="false"` rather than no attribute, so the row's state is always
readable rather than sometimes-absent.

### 2.2 The delete control is named `Delete: <text>`, visible label "Delete"

§8.6 requires an accessible name; "Delete" repeated once per row is a name that
identifies nothing. The visible word **leads** the accessible name so a
voice-control user saying "Delete" still matches it (WCAG 2.5.3, label in name).
`aria-label` rather than a visually-hidden span: one attribute, no extra element
inside the button for the stylesheet's strike-through exclusions to reason about.

### 2.3 The counter writes the whole phrase, and only when it changed

`` `${n} remaining` `` matches the shell's seeded `0 remaining` (T3 notes §2.5).
Guarded by a `setText()` helper that skips an identical assignment, because
`#remaining-count` is an `aria-live` region and some assistive tech re-announces
on DOM *mutation*, not on change — an unrelated repaint should not read the same
count aloud again.

### 2.4 Empty-state copy is tailored per filter, and names the way out

Branch 1 (no todos at all) keeps T3's shell copy verbatim, "Nothing here yet —
add your first todo above", which offers the primary action by pointing at the
add form directly above rather than duplicating a second Add control inside a
`<p>`. Branch 2 (todos exist, none match) gets a per-filter hint that names the
filter to switch to — the whole point of D5 is that the missing rows still exist,
so an empty view must not read as data loss. The unreachable `all` entry is kept
as a fallback so an unexpected filter value cannot render a blank message.

### 2.5 `#clear-completed` is disabled when nothing is done

T3 shipped it enabled and styled `.btn[disabled]` explicitly for this. Disabling
states plainly that the action is unavailable, and prevents a confirm dialog
being raised over zero items. The handler still guards on the count independently,
so the disabled attribute is a signal, not the enforcement. §8.9 is unaffected:
every *interactive* element stays reachable; a disabled control is not one.

### 2.6 Focus is preserved across the repaint

A full list rebuild destroys the focused element, which would strand a keyboard
user at the top of the document on every toggle — §3 rule 3 is "keyboard first",
so this is compliance, not polish. `rememberFocus()` records the row id, which
control, and the row index; `restoreFocus()` prefers the same control on the same
todo, falls back to the same control on the row that took its place (the case
after a delete, or after a toggle under the `active` filter), and falls back
again to the add field. Rows are matched by walking `list.children` rather than
with an attribute selector, so an id containing selector-special characters
cannot break the lookup. Nothing is restored unless focus was inside the list
before the render, so clicking a filter never yanks focus into the rows.

Same reasoning for the one bespoke case: if `#clear-completed` disables itself
while the user is standing on it, focus would drop to `<body>`, so it moves to
the add field instead.

### 2.7 Focus returns to the add field after every submit

Including a mouse click on Add. It makes a run of todos typeable without
reaching for the mouse, and there is nothing else useful to focus.

### 2.8 A rejected (whitespace-only) submit does not clear the field

§2.1 promises the clear *on success* and says a whitespace-only submit is
rejected "without creating anything and without an error dialog" — it never asks
for the field to be wiped. Wiping it would discard what the user typed with no
explanation, which is the shape §3 rule 1 dislikes even though whitespace is not
really data.

### 2.9 The filter resets to `all` on reload

It is view state, not application state. §4.2 gives the store no filter field and
this file may not add one, so persisting it is not available without changing an
interface other tasks are built against. `all` is also the honest default: it
never hides anything on first paint.

### 2.10 `mustGet()` throws on a missing shell id

A missing hook means `index.html` and this file have drifted, which is a
build-time mistake, not a runtime condition §7 covers. Throwing surfaces it on
first load instead of scattering the same failure across a dozen silent no-ops.

### 2.11 Smaller calls, grouped

Event delegation on `#todo-list` and `#filters` rather than per-row listeners (no
rebinding, no leaks, rows are disposable). `replaceChildren` with a
`DocumentFragment` — one reflow per paint. `data-action` attributes distinguish
the toggle from the delete inside the delegated handlers, so the code does not
depend on element order within a row. Every handler re-reads the id from the DOM
rather than closing over a `Todo`, so a stale closure cannot act on a removed
todo. `instanceof Element` guards on every delegated target.

---

## 3. Noticed, not acted on

**3.1 `getVisible()` hands out the store's own `Todo` objects** (T1 notes §5).
This file never mutates one — every change goes through `toggle`/`remove`/`add`
and the harness asserts it — but the hazard is real for anyone editing this file
later. Not fixable from here; the store's return shape is T1's.

**3.2 `#empty-state` is not a live region** (T3 notes §3.3). A screen-reader user
who switches filters into an empty view hears the new count but not the empty
message. Adding `role="status"` would be a small win beyond §6, and it is a
one-attribute change in `index.html` — T3's file, not mine. Flagging rather than
reaching for it.

**3.3 The §6 announcement requirement is verified as markup only.** Per
`TOOLING-AUDIT.md` §3 there is no screen reader here. I assert that
`aria-live="polite"` is on `#remaining-count` and that its text updates; whether
a user *hears* it is the already-recorded waived handicap, restated so nothing
below is read as more than it is.

**3.4 A `<label>`-wrapped checkbox makes the whole row text clickable.** Clicking
the todo's text toggles it. That is standard and matches §2.2's "each row has a
checkbox", but it is a slightly larger hit area than the spec literally
describes. Deliberate, and cheap to narrow if unwanted.

**3.5 `window.confirm` blocks the event loop and is unstyleable.** It is the
correct zero-dependency choice under D1 and it is keyboard/AT-operable, but it
does not match §5's visual language. If the project ever wants a styled
confirmation, that is a spec question (§5 says nothing about dialogs), not a
worker's call.

**3.6 §8.10 is red for reasons outside this task** — `tests/` belongs to T4,
which has filed its own T2 about the literal command in §8.10. Noted so the gate
result below is not misread.

---

## 4. How I verified each acceptance criterion

Verified in **real Chromium** (Playwright 1.56.0, per `TOOLING-AUDIT.md` §1),
served over `http://127.0.0.1` — never `file://`, per the open SPEC-1 escalation
and T3 notes §3.1. Two harnesses, both **outside the repo** in the session
scratchpad (`verify-t2.mjs`, `verify-t2-focus.mjs`): **91 + 7 = 98 checks, 0
failures**, with `pageerror` and console-error listeners asserted empty on every
page.

Two checks failed on the first run; both were harness defects, not code defects,
and are recorded here rather than quietly fixed: the filter-colour assertion read
`background-color` mid-transition (styles.css transitions it over 120ms) and was
given a settle wait; the "no state held" assertion regex matched the local
`const todos = store.getTodos()` inside `render()` and was narrowed to
module-scope declarations.

| Criterion | How it was checked | Result |
|---|---|---|
| **§8.6** one row per visible todo | Added 3 todos → asserted exactly 3 `<li>`, text equal to the authored text in insertion order, every row carrying a checkbox. Then toggled one and switched to `active` → asserted the list renders one row per **visible** todo (2), while `localStorage` still holds 3 (D5). | pass |
| **§8.6** checkbox + named delete control | Asserted every row's delete control has `aria-label` naming its todo, then took a real **accessibility-tree snapshot** and asserted the tree exposes 3 `button:"Delete: …"` nodes and 3 `checkbox:"<todo text>"` nodes — i.e. the names as a browser computes them, not just the attributes I set. | pass |
| **§8.7** offer when empty | Fresh page, no todos → `#empty-state` visible and its copy matches `/add your first todo/`. Re-checked after the collection was emptied again by deleting the last row, so the offer is state-driven and not just the shell's static default. | pass |
| **§8.7** hint when filtered out | Todos present, `done` filter, nothing done → 0 rows, empty state visible, copy does **not** match the add-your-first offer and does name the way out. Repeated for the mirror case: everything done, `active` filter. | pass |
| §2.1 add | Text with surrounding whitespace → 1 row with the trimmed text, field cleared. Whitespace-only → no row created, **zero dialogs raised** (a `dialog` listener counted them), field left untouched. Verified via Enter **and** via the Add button. Focus lands back in the field. | pass |
| §2.2 toggle | Click flips `done`, marks `data-done="true"`, and the row's text computes `line-through`. Second click returns it exactly. `Space` from the keyboard toggles, and focus is asserted to still be on that row's checkbox after the repaint. | pass |
| §2.3 remove | Delete removes that row, the surviving row's `data-id` proves the right one went, and `localStorage` shows 1 entry. | pass |
| §2.4 filter | All three filters asserted for row contents **and** `aria-pressed` triples. Active filter's computed `background-color` is `rgb(37,99,235)` and differs from both inactive ones. After three filter changes all 3 todos are still there (D5). | pass |
| §2.5 clear completed | 3 todos, 2 done → accepting the confirm leaves exactly the 1 active todo, persisted, counter updated, button now disabled. Also driven from the `active` filter with the done todo **off screen**, which is the case the confirmation exists for. | pass |
| §2.6 counter | `2 remaining` with 3 todos and 1 done; unchanged by filter switches; updates to `1 remaining` live on toggle; `0 remaining` after a clear. `aria-live="polite"` asserted present. | pass |
| §2.7 empty state | Covered by the §8.7 rows above, plus the transition in both directions (hidden when rows appear, shown when they go). | pass |
| §3 rule 1 | Dismissing the confirm destroys **nothing** — all 3 todos still present. The prompt text is asserted to contain the count. Per-row delete asserted to remove one named todo only. | pass |
| §3 rule 2 | Loaded with `localStorage` replaced by a **throwing getter** via an init script: `#storage-notice` is `hidden === false` and computes `display: block`, the app still adds and toggles fully in memory, and the notice persists across mutations. Control case: with storage working the notice stays hidden. | pass |
| §3 rule 3 | Real `Tab` sweep with rows present: every enabled focusable element reached, none skipped, and every stop computes `outline-style !== none` with `outline-width >= 2px`. Plus the four focus-management cases in the second harness (see below). | pass |
| §3 rule 4 | Added the literal text `<img src=x onerror="window.__pwned=1"><b>bold</b>`: no script ran, zero `<img>` and zero `<b>` inside the list, and the `<span>` text equals the input byte for byte. Source also asserted free of `innerHTML` / `insertAdjacentHTML` / `document.write`. | pass |
| §4.1 (no state here) | Source asserted: `./store.js` is the only import; no todo collection at module scope; the **only** mutable module-scope binding is `filter`; `localStorage` never appears; all four mutations go through `store.`. | pass |
| §8.8 (supporting) | 320×640 with a done row and a 102-character unbroken word: `scrollWidth <= clientWidth` and a sweep of every element for `rect.right > innerWidth` found none. Screenshot inspected. | pass |
| §8.9 (supporting) | The Tab sweep above, now with the real rows T3 could only stub. | pass |
| focus management | Second harness: clear-completed disabling itself under a keyboard user hands focus to the add field; deleting a middle row lands on the row that replaced it; deleting the last row falls back to the add field; a filter click does **not** steal focus into the list. | pass |
| persistence (UI side) | Added 2, toggled 1, reloaded: rows, done state and counter all restored; filter resets to `all` (§2.9 above). | pass |

**Gate.** `node tins-kit/scripts/validate.mjs --spec SPEC.md` → **10 pass, 0
warn, 0 fail, PASS**. `node --check src/ui.js` → clean. There is no `npm` project
gate; D1 forbids one. `node --test tests/` is T4's criterion and is blocked on
T4's own escalation (§3.6).

**Scope.** No git here, so file mtimes across the repo were listed: `src/ui.js`
is the only file I wrote. `tests/store.test.mjs`, `delegation/LEDGER.md` and
`delegation/ESCALATIONS.md` also show recent times — that is T4 and the auditor
working concurrently. I did not open `store.js`, `index.html` or `styles.css` for
writing, and I touched no delegation file outside `delegation/tasks/T2/`.

---

## 5. For the next session

1. **Both verification harnesses are re-runnable** and are the fastest way to
   re-check the whole UI after any change:
   `node <scratchpad>/verify-t2.mjs` and `node <scratchpad>/verify-t2-focus.mjs`.
   Both start their own static server (ports 8742 / 8743) and need no arguments.
   Neither is a project deliverable — `tests/` is T4's.
2. **The done-row convention is `data-done="true"` on the `<li>`.** `styles.css`
   accepts two other conventions; if anyone changes this file, change it in
   `buildRow()` only and keep it single.
3. **`window.confirm` is load-bearing for §3 rule 1.** Removing it without adding
   a real undo path puts the app back in breach. Any automated test that clicks
   `#clear-completed` must register a `dialog` handler or it will hang.
4. **`render()` must stay pure-read.** It calls `getTodos`, `getVisible`,
   `getRemainingCount` and `isPersistent` and writes nothing back; a mutation
   inside it would re-enter through `subscribe` and loop.
5. **If §8.7's copy is ever reworded**, the two harness assertions key on
   `/add your first todo/` and `/switch to All/`.
6. The `all` branch of `EMPTY_NO_MATCH` is unreachable by construction and is a
   deliberate fallback, not dead code left by accident.
