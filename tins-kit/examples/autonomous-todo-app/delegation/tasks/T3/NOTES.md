# T3 — notes

**Task:** the page shell (`index.html`) and all styling (`src/styles.css`).
**Files touched:** `index.html`, `src/styles.css`. Nothing else.
**Outcome:** returned. No escalation filed.

---

## 1. What I built

`index.html` is a complete static document — doctype, `lang="en"`, charset,
`width=device-width` viewport, `<title>Focus</title>`, `./src/styles.css`, and
`<script type="module" src="./src/ui.js"></script>` as the last element in the
body. Between them: a header, the storage notice, the add form, a toolbar
carrying the remaining count and the three filters, an empty `<ul>` for the
list, the empty state, and the clear-completed control.

Every hook from the interface contract is present with the exact id I was
given, and none was renamed:

| Hook | Element | Notes |
|---|---|---|
| `#new-todo-form` | `<form novalidate>` | no `required` — see §2.12 |
| `#new-todo-input` | `<input type="text">` | named by a visually-hidden `<label for>` |
| `#todo-list` | `<ul>` | left empty, as instructed |
| `#remaining-count` | `<span aria-live="polite" aria-atomic="true">` | seeded `0 remaining` — see §2.5 |
| `#filters` | `<div role="group" aria-label="Filter todos">` | three `<button type="button">` with `data-filter="all\|active\|done"`, in that order |
| `#clear-completed` | `<button type="button">` | enabled — see §2.7 |
| `#empty-state` | `<p>` | visible by default — see §2.6 |
| `#storage-notice` | `<p role="status" hidden>` | hidden by default, as instructed |

`src/styles.css` carries every visual rule: SPEC §5's palette and 8px rhythm as
custom properties, the 34rem centred column, the focus ring, the row rules, and
one narrow-viewport media query. No behaviour, no inline styles in the HTML.

---

## 2. T1 judgement calls (each with its reason)

**2.1 Row markup is styled structurally, not by class name.** The interface
contract fixes the shell's ids but says nothing about the markup `ui.js` emits
inside `#todo-list`. Rather than invent class names and quietly add them to a
shared contract other workers are already building against, the row rules are
keyed on what SPEC §8.6 *guarantees* — one row per visible todo, each with a
checkbox and a delete control — using `#todo-list > *`, `#todo-list
input[type="checkbox"]` and `#todo-list button`. Done rows are matched by
`:has(input[type="checkbox"]:checked)` **and** by `[data-done="true"]`,
`.done`, `.is-done` and `.completed`, so whichever convention `ui.js` picks,
the styling lands. This is additive and costs nothing if unused.

**2.2 The done-row selectors are wrapped in `:is()` on purpose.** An
unsupported `:has()` sitting bare in a selector list would invalidate the whole
rule; inside the forgiving `:is()` it is dropped on its own and the class and
attribute fallbacks still match. Baseline `:has()` is Chromium 105 / Safari
15.4 / Firefox 121, so this only matters on an old engine.

**2.3 The strike-through is applied to the row's text descendants, not to the
row.** I wrote it on the row first, and the browser check caught the bug:
`text-decoration` propagates to in-flow descendants and **cannot** be switched
off further down, so `#todo-list button { text-decoration: none }` did nothing
and the line was painted straight through the delete control's label — visible
in the screenshot. The rule now targets
`:not(button, input, select, textarea, :has(button))` inside a done row, which
strikes the text carrier (span, label, whatever) and leaves controls alone. The
muting stays on the row, since `color` *is* overridable lower down.
*Known limit:* a todo whose text is a bare text node directly inside the row —
not wrapped in any element — cannot be targeted by CSS and would not be struck.
§8.6's accessible-name requirement makes an unwrapped text node very unlikely,
but `ui.js` should wrap the text in an element.

**2.4 Focus ring on `:focus`, not `:focus-visible`.** 3px solid accent with a
2px offset. SPEC §6 says focus is visible "at all times" — that reads as
literal, and a pointer user who then reaches for the keyboard should not have
to tab away and back to find out where they are. The 2px offset also keeps the
ring visible against the accent-filled Add and active-filter buttons, where an
inset accent ring would vanish. 3px rather than the minimum 2px so the criterion
is met with margin after any sub-pixel rounding.

**2.5 `#remaining-count` is seeded with the text `0 remaining`.** The contract
does not say whether `ui.js` writes a bare number or a full phrase. A static
"remaining" label *outside* the span would read "3 remaining remaining" if
`ui.js` writes a phrase; an empty span would read as a bare "3" if it writes a
number. Seeding the phrase *inside* the live region is correct in both cases:
`ui.js` overwrites the whole node either way, and the pre-script state is
honest. The live region is the span itself (`aria-live="polite"`,
`aria-atomic="true"`) so the whole count is announced as one unit.

**2.6 `#empty-state` is visible by default, carrying the "no todos at all"
copy.** SPEC §8.7's first branch is exactly the state a freshly-loaded page with
no stored todos is in, so that is the honest static default. `ui.js` owns it
from first render onward — hiding it when rows exist, swapping the copy for the
"no match for this filter" hint.

**2.7 `#clear-completed` ships enabled, not disabled.** A `disabled` default
would leave a permanently dead button if `ui.js` only wires a click handler and
never enables it. An enabled button whose handler finds nothing to clear is the
cheaper failure. `.btn[disabled]` is styled anyway, so `ui.js` can disable it.

**2.8 The active filter is marked with `aria-pressed` in the initial markup**
(`all` = true), which is the conventional accessible marking for a toggle-button
group and gives screen-reader users the state SPEC §2.4 only describes
visually. The CSS also accepts `.active`, `.is-active`, `.selected` and
`[aria-current]` on those buttons, so a different convention in `ui.js` still
renders correctly — but `ui.js` should keep `aria-pressed` in sync, otherwise
two filters will look active at once.

**2.9 Two neutrals beyond SPEC §5's four named colours.** §5 names accent,
body, background and muted, but borders and the inset panels behind the empty
state and the storage notice need something. `--line: #e5e7eb` and
`--surface: #f9fafb` are the same grey family as `--muted: #6b7280`. No new hue
was introduced — notably, the storage notice uses the accent as a left rule
rather than an invented warning amber.

**2.10 `[hidden] { display: none !important }`.** Several of these elements get
`display: flex` or `display: block` from a layout rule, which would otherwise
outrank the UA stylesheet's `[hidden]` and re-show an element `ui.js` had
hidden. Verified: setting `.hidden = true/false` from script works in both
directions.

**2.11 `.visually-hidden` with `.sr-only` as an alias.** The shell uses the
first; the second costs one selector and covers `ui.js` reaching for the other
name for a checkbox or delete-button label.

**2.12 No `required` on the input, plus `novalidate` on the form.** SPEC §2.1
rejects whitespace-only input "without an error dialog" — constraint validation
would pop exactly that bubble. Rejection is `ui.js`'s job via `store.add()`
returning `null`.

**2.13 Smaller calls, grouped:** `color-scheme: light` (the spec fixes a white
background, so a dark-mode browser must not repaint the form controls); 16px
base font size (also avoids iOS focus-zoom); 40px minimum control height and
32px for in-row controls, for touch targets; `overflow-wrap: anywhere` on rows
so one long unbroken word cannot force a horizontal scroll; `#todo-list:empty`
drops its top border so an empty list leaves no stray rule; header copy
("Focus" / "One list. What is left, and what is done.") and the storage-notice
sentence are mine — the spec does not author copy; hover transitions are inside
a `prefers-reduced-motion: no-preference` guard.

No T0/T1 call here changed a shared interface, and no T2 arose.

---

## 3. Noticed, not acted on

**3.1 `file://` cannot run this app, which contradicts SPEC §1.** §1 says the
page "renders as a static page opened directly from disk or served by any
static host", but D1 locks the app to plain ES modules. Chromium blocks module
scripts over `file://` — confirmed here, verbatim: *"Access to script at
'file:///…/src/ui.js' from origin 'null' has been blocked by CORS policy"*, and
the page renders with zero rows. This is inherent to ES modules on `file://`
(Firefox and Safari behave the same way); no change inside `index.html` fixes it
without either inlining the script — which breaks the `store.js` / `ui.js`
split in §4.1 — or adding a build step, which D1 forbids. I did **not**
escalate: the interface contract mandates the module script tag either way, so
nothing about my task was blocked, and an escalation with nothing blocked is
the status-update anti-pattern from `tiered-escalation.md` §2.1. **But someone
owns this** — it is either a §1 wording fix ("served by any static host") or a
§0.2 amendment, and it is an auditor/spec decision, not a worker's. Everything
downstream should be verified over `http://`, not `file://`.

**3.2 The row-markup contract has a hole.** §2.1, §2.5, §2.6 and §2.8 above are
all the same root cause: the brief pinned the shell ids but left the row
structure, the done-row marking, the active-filter marking and the
remaining-count string shape unstated. I absorbed all four defensively rather
than expanding the contract mid-flight. If T2 lands on a convention my
selectors miss, the fix is one selector in `styles.css` — cheap, and visible
immediately on screen.

**3.3 `#empty-state` is not a live region.** SPEC §6 asks only that the
remaining count announce politely, so I left the empty state as a plain `<p>`.
A screen-reader user who switches filters and empties the view is told the new
count but not the empty-state message. Adding `role="status"` there would be a
small a11y win beyond the spec — a spec question, not a worker's call.

**3.4 The §6 announcement requirement is verified as markup only** — the
`aria-live="polite"` / `aria-atomic="true"` attributes are present on
`#remaining-count`. Per `TOOLING-AUDIT.md` §3 there is no screen reader in this
environment, so whether a user *hears* it is untested. That is the waived
handicap already recorded, restated here so it is not read as verified.

**3.5 `store.js` appeared in `src/` while I worked** (T1, running in parallel).
I did not read it, run it, or touch it.

---

## 4. How I verified each criterion

Verification ran in real Chromium via the Playwright install that
`TOOLING-AUDIT.md` §1 confirmed — not by reading the CSS back to myself. The
harness lives **outside the repo** at
`…/scratchpad/verify/` (`check.mjs`, plus a throwaway stub standing in for
`ui.js` that renders four rows: two open, two done, one with an 80-character
unbroken word, in two different markup shapes — a `label`-wrapped row and a flat
row using a `.done` class). Nothing from it was written into the project. Served
over `http://127.0.0.1:8731` because of §3.1. Final result: **26 pass, 0 fail**.

- **§8.8 — no horizontal scroll at 320px.** 320×640 viewport,
  `document.documentElement.scrollWidth <= clientWidth` (320 = 320) **and** a
  sweep of every element in the document for `getBoundingClientRect().right >
  window.innerWidth` (none). Checked twice — empty list, and populated
  including the long unbroken word. Also passes at 280px, below the required
  floor. Full-page screenshots taken at 320px and 380px and inspected.
- **§8.9 — keyboard reach + a ≥2px focus indicator.** Real `Tab` presses from
  the top of the document, recording `document.activeElement` at each step,
  then diffed against every focusable element in the DOM: all 14 reached
  (input, Add, three filters, four checkboxes, four deletes, clear-completed),
  none skipped, no keyboard trap. At each stop, computed `outline-style` and
  `outline-width` were read: `solid 3px rgb(37, 99, 235)` on every one — the
  criterion asks for 2px. Also asserted `outline-offset > 0` on the
  accent-filled Add button, so the ring is not painted accent-on-accent.
- **§5 — style guide.** Asserted from computed styles: `system-ui` leads the
  font stack; body `rgb(31,41,55)` on `rgb(255,255,255)`; muted
  `rgb(107,114,128)`; accent `rgb(37,99,235)` on interactive elements;
  `.app` max-width 544px = 34rem and rendering at exactly 544px, centred; done
  rows muted **and** their text struck, open rows neither; and — after the
  §2.3 bug — that no ancestor of a delete control in a done row carries
  `line-through`, walked up the tree, since propagation cannot be undone.
  Spacing rhythm is 8px-derived tokens, checked by reading the file.
- **§6 — accessibility.** Contrast computed with the WCAG relative-luminance
  formula: body 14.68:1, muted 4.83:1, white-on-accent (Add button and active
  filter) 5.17:1 — all above AA's 4.5:1. `#new-todo-input` has an accessible
  name from its `<label for>`. `#remaining-count` carries
  `aria-live="polite"` (see §3.4 for what that does and does not prove).
  Active filter confirmed visually distinct from inactive on both background
  and foreground.
- **Interface contract.** Asserted in the browser that all eight ids resolve,
  that `#filters` yields `data-filter` values `all,active,done` in order, that
  `#todo-list` ships empty, that `#storage-notice` is `hidden` with computed
  `display: none` and becomes `display: block` when script sets
  `.hidden = false`, and that the document loads exactly `./src/styles.css` and
  `./src/ui.js` with `type="module"`.
- **Spec gate.** `node tins-kit/scripts/validate.mjs --spec SPEC.md` → 10 pass,
  0 warn, 0 fail, PASS. There is no `npm` project gate — D1 forbids one.
- **Scope.** No git here, so file scope was checked with `find -newermt`
  against the round's start: only `index.html` and `src/styles.css` are mine.
  The other new files (`src/store.js`, `delegation/tasks/T1/*`) are T1's,
  running concurrently; I did not open or modify them.

---

## 5. For the next session

1. **Serve over HTTP, never `file://`** (§3.1). `python3 -m http.server` from
   the repo root is enough.
2. **`ui.js` should wrap todo text in an element** — a `<span>` or `<label>` —
   not leave it as a bare text node (§2.3).
3. **`ui.js` should keep `aria-pressed` in sync on the filter buttons** (§2.8),
   and can use `.done` or `data-done="true"` on a row if that is more
   convenient than relying on the checkbox state.
4. **`#remaining-count` takes the whole phrase**, not a bare number (§2.5) —
   e.g. `2 remaining`. Set `textContent`, never `innerHTML`; SPEC §3 rule 4
   makes todo text untrusted.
5. **Hide and show with the `hidden` property** (`el.hidden = true/false`); the
   stylesheet is set up for it and a `display` rule will not fight you.
6. The verification harness is re-runnable and is the fastest way to re-check
   §8.8 and §8.9 after T2 lands with the real rows.
