# T3 — status

**Outcome:** `returned`
**Timestamp:** 2026-08-26T10:06:34Z
**Files touched:** `index.html`, `src/styles.css` — and nothing else.
**Escalations filed:** none. No T2 arose; every call was T0/T1 and is recorded
in `NOTES.md` §2.

---

## Gate result

| Gate | Result |
|---|---|
| `node tins-kit/scripts/validate.mjs --spec SPEC.md` | **PASS** — 10 pass, 0 warn, 0 fail |
| Project gate (`npm run …`) | **n/a** — D1 locks the project to zero dependencies and no build step, so there is no npm gate to run |
| Browser acceptance harness (Playwright / Chromium) | **PASS** — 26 pass, 0 fail |
| Scope check (`find -newermt` against the round's start; no git repo here) | **clean** — only `index.html` and `src/styles.css` are mine |

---

## How each acceptance criterion was verified

Verified in real Chromium via the Playwright install confirmed by
`TOOLING-AUDIT.md` §1, not by re-reading the CSS. The harness is outside the
repo, in the session scratchpad at `…/scratchpad/verify/check.mjs`, with a
throwaway stub in place of `ui.js` rendering four rows (two open, two done, one
80-character unbroken word, in two different markup shapes). Served over
`http://127.0.0.1:8731` — see the caveat below.

- **§8.8 — no horizontal scroll at 320px.** PASS. At a 320×640 viewport,
  `scrollWidth (320) <= clientWidth (320)`, and no element in the document has
  a bounding rect extending past `window.innerWidth`. Checked with the list
  empty and populated, including the long unbroken word. Also clean at 280px.
- **§8.9 — keyboard reachable, focus indicator ≥ 2px.** PASS. Real `Tab`
  presses reached all 14 focusable elements with none skipped and no trap;
  every one computed `outline: solid 3px rgb(37, 99, 235)` with a 2px offset,
  against a 2px requirement.
- **§5 — style guide.** PASS. Computed styles confirm the system font stack,
  `#1f2937` on `#ffffff`, muted `#6b7280`, accent `#2563eb`, a 34rem centred
  column rendering at exactly 544px, and done todos muted and struck while open
  ones are neither.
- **§6 — accessibility.** PASS for what is mechanically checkable: contrast
  14.68:1 / 4.83:1 / 5.17:1 (all above AA 4.5:1), an accessible name on the
  input, and `aria-live="polite"` on `#remaining-count`.
- **Interface contract.** PASS. All eight ids resolve, `data-filter` values are
  `all,active,done` in order, `#todo-list` ships empty, `#storage-notice` is
  hidden by default and reveals correctly when script clears `.hidden`, and the
  document loads `./src/styles.css` and `./src/ui.js` as `type="module"`.

## Two things the auditor should carry forward

1. **A spec conflict is open and is not mine to resolve.** SPEC §1 promises the
   page works "opened directly from disk", but D1's ES modules are CORS-blocked
   over `file://` in every major browser — confirmed here with the console
   error and a zero-row render. Nothing inside my two files can fix it without
   breaking D1. Not escalated because nothing about T3 was blocked by it (the
   contract mandates the module tag either way, and an escalation with nothing
   blocked is `tiered-escalation.md` §2.1's anti-pattern) — but it needs a §1
   wording fix or a §0.2 amendment. **Verify everything downstream over
   `http://`.** Details in `NOTES.md` §3.1.
2. **§6's "announces politely" is verified as markup only** — the waived
   handicap from `TOOLING-AUDIT.md` §3. No screen reader exists in this
   environment, so the claim is about attributes, not about what a user hears.
