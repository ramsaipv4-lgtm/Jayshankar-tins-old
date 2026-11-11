# T2 — status

**Outcome:** `returned`

**Task:** DOM rendering + event wiring — `src/ui.js`.
**Finished:** 2026-08-26 10:16 UTC
**Files touched:** `src/ui.js` only (plus this task folder).
**Escalations filed:** none. One call was weighed against the T2 bar and
resolved down to T1 with its reasoning written out in `NOTES.md` §2.0 — the
§3-rule-1 guard on §2.5 "Clear completed".

---

## Gate

| Gate | Command | Result |
|---|---|---|
| Spec validator | `node tins-kit/scripts/validate.mjs --spec SPEC.md` | **PASS** — 10 pass, 0 warn, 0 fail |
| Syntax | `node --check src/ui.js` | clean |
| Browser verification | `node <scratchpad>/verify-t2.mjs` | **91 pass, 0 fail** |
| Focus-management verification | `node <scratchpad>/verify-t2-focus.mjs` | **7 pass, 0 fail** |
| Project gate | — | none exists; D1 forbids an `npm` project |
| `node --test tests/` | not run for this task | `tests/` is T4's file and T4 is `blocked-escalation` on §8.10's wording |

Both browser harnesses ran in real Chromium (Playwright 1.56.0) over
`http://127.0.0.1`, never `file://` — the open SPEC-1 escalation. Every page
asserted zero `pageerror` and zero console errors.

---

## How each acceptance criterion was verified

Full detail in `NOTES.md` §4. In short:

- **§8.6** — 3 todos rendered exactly 3 `<li>`, each with a checkbox; a real
  **accessibility-tree snapshot** confirmed 3 delete buttons named
  `Delete: <todo text>` and 3 checkboxes named by their todo text. With a filter
  applied, the list rendered one row per *visible* todo (2) while storage still
  held 3 — the row count follows `getVisible()`, not `getTodos()`.
- **§8.7** — no todos at all → the empty state shows the offer
  (`/add your first todo/`); todos present with a filter matching none → it shows
  a hint instead, asserted in both directions (`done` filter with nothing done,
  and `active` filter with everything done) and after the collection was emptied
  again by deletion.
- **§2.1–§2.7** — one assertion group each: trimmed add via Enter *and* the Add
  button with the field cleared, whitespace-only rejected with **zero** dialogs
  raised and the field untouched; toggle by mouse and by `Space`, twice returning
  to the original state; delete removing the right todo and persisting; three
  filters asserted for both contents and `aria-pressed`, with all 3 todos still
  stored afterwards (D5); clear-completed clearing every done todo at once
  including ones hidden by the current filter; the counter live across toggle,
  filter change and clear; the empty state transitioning both ways.
- **§3 rule 1** — dismissing the confirmation destroyed nothing (all 3 todos
  still present); the prompt names the count.
- **§3 rule 2** — loaded with `localStorage` replaced by a throwing getter:
  `#storage-notice` revealed and computing `display: block`, the app fully usable
  in memory, the notice persisting across mutations; control case with working
  storage keeps it hidden.
- **§3 rule 4** — a todo whose text is `<img src=x onerror=…><b>bold</b>`
  produced no elements and ran no script; text rendered verbatim.
- **Supporting** — §8.8 (no horizontal scroll at 320px with a done row and a
  102-character unbroken word), §8.9 (real `Tab` sweep reaching every enabled
  control, each with a ≥2px focus indicator), §4.1 (source asserted to hold no
  application state and to route every mutation through the store), and a
  reload round-trip.

Two checks failed on the first harness run; both were defects in the harness
(a computed style read mid-CSS-transition, and a regex matching a function-local
`const`), both are recorded in `NOTES.md` §4, and neither required a change to
`src/ui.js`.

---

## Scope

No git in this repo, so scope was checked by listing mtimes across the project:
`src/ui.js` is the only file written by this task. `tests/store.test.mjs`,
`delegation/LEDGER.md` and `delegation/ESCALATIONS.md` carry recent times from T4
and the auditor running concurrently; `src/store.js`, `index.html` and
`src/styles.css` were read only. The interface contract is unchanged — all eight
shell ids used verbatim, `store.js` untouched.

Not done, by instruction: no integration, no merge, no edit to
`delegation/LEDGER.md`.
