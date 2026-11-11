You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`.

**Environment note:** the same project folder is also mounted at
`/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux environment, where
the planner/auditor session (Claude) runs. Same files, not a copy —
`node_modules` is physically shared and platform-specific. Not expected to
matter here (no dependency changes), noted for consistency with every brief.

---

Task: **T8-contrast-and-cleanup** — four small, independent housekeeping items,
all previously logged but never queued. None depend on each other; do them in
any order, but keep them as separate, clean diffs within your one commit-worth
of changes (don't tangle them together in ways that make one hard to revert
without the others).

## Part A — Fix the 3 failing WCAG contrast pairs

`scripts/check-contrast.mjs` (built in an earlier task) already knows the
exact 3 pairs that fail AA-normal (ratio < 4.5): `text-slate-400 on white`
(~2.56), `text-slate-400 on slate-50` (~2.45), `text-slate-300 on white`
(~1.48). Run `node scripts/check-contrast.mjs` yourself first to confirm
this is still accurate before changing anything.

Every real usage of `text-slate-400` and `text-slate-300` in `src/` (checked
before writing this brief — fix all of these, on white or slate-50
backgrounds, unless you find one on a different background where the
existing check doesn't apply, in which case leave it and say so in your
notes):

- `src/components/SignInForm.tsx:92`
- `src/components/Layout.tsx:38`, `:43`
- `src/components/RecentActivity.tsx:78`
- `src/components/StockBySku.tsx:112`, `:125` (`text-slate-300`), `:132`
- `src/pages/FloorDashboard.tsx:120`, `:152`
- `src/pages/RepDashboard.tsx:61`, `:82`
- `src/pages/AuditLog.tsx:182`, `:242`

Fix: bump each to the next darker Tailwind slate shade that passes AA-normal
— `text-slate-400` → `text-slate-500`, `text-slate-300` → `text-slate-400`.
After changing, verify with `check-contrast.mjs`'s underlying formula (or by
reasoning from its known-good numbers in `scripts/check-contrast.mjs`'s own
palette table) that the new shade actually passes — don't just find-and-replace
blind. `text-slate-500 on white` and `text-slate-500 on slate-50` are both
already in the checker's palette and already known to pass; `text-slate-400`
replacing `text-slate-300` needs the same confirmation.

## Part B — Wire `check-contrast.mjs` into the real `validate.mjs` gate

Right now `check-contrast.mjs` exists and works but nothing runs it
automatically — a new contrast regression wouldn't be caught. Add a check to
`scripts/validate.mjs` that imports and runs `check-contrast.mjs`'s
programmatic interface (it already exports functions for exactly this, not
just a CLI — read the file, don't shell out to it as a subprocess) against
its default palette, and fails the overall `validate` run if any pair fails
AA-normal. Follow `validate.mjs`'s existing check-registration pattern (read
a few existing checks in the file first to match the style — pass/warn/fail
reporting, the `§8.X` labeling convention if there is one for checks in this
area, whatever `validate.mjs` already does for a new structural check).

## Part C — Fix the `queryKey: ['skus']` collision (decision #34's bug class, found a second time)

Two components share the bare query key `['skus']` with different `select`
shapes:
- `src/components/FormFields.tsx`'s `SkuSelect` (line ~14): selects
  `id, code, english_name, tamil_name`.
- `src/pages/RepDashboard.tsx` (line ~23): selects `id, code, english_name`
  (no `tamil_name`).

Currently harmless by coincidence — `RepDashboard.tsx` never reads
`tamil_name` from its own `skus` variable — but this is the exact same
TanStack Query cache-collision shape that broke `FloorDashboard.tsx` and
`AdminDashboard.tsx` before (decision #34): whichever query runs second gets
silently starved of a fetch, serving the other's cached shape instead. Fix:
give `RepDashboard.tsx`'s query its own distinct, scoped key — follow the
exact naming convention already used elsewhere in this codebase (`['skus',
'floor-dashboard']`, `['skus', 'admin-dashboard']`) — use `['skus',
'rep-dashboard']`. Do not touch `FormFields.tsx`'s key; `SkuSelect` is a
shared component used by many pages and its bare `['skus']` key is the
"default" shape other pages' distinct keys are meant to route around, not
something to rename.

## Part D — `typecheck` joins the actual gate

Right now `package.json`'s `validate` script (`node scripts/validate.mjs`)
and `typecheck` script (`tsc --noEmit`) are separate — `npm run validate` can
report success while a real TypeScript error sits unnoticed. Change the
`validate` script in `package.json` to run both, failing if either fails:
```json
"validate": "tsc --noEmit && node scripts/validate.mjs"
```
(`tsc` first — if there's a type error, fail fast before running the slower
structural checks.) Don't change what `scripts/validate.mjs` itself checks —
this is purely a `package.json` script-composition change, not new logic
inside `validate.mjs` (Part B's new contrast check is the only new logic
`validate.mjs` gets in this task).

---

**Files you may touch:** `src/components/SignInForm.tsx`,
`src/components/Layout.tsx`, `src/components/RecentActivity.tsx`,
`src/components/StockBySku.tsx`, `src/pages/FloorDashboard.tsx`,
`src/pages/RepDashboard.tsx`, `src/pages/AuditLog.tsx`,
`scripts/validate.mjs`, `package.json`. Nothing else. Do not touch
`scripts/check-contrast.mjs` itself (Part B imports it, doesn't modify it) or
any `.sql`/migration file.

**Acceptance criteria:**
1. `node scripts/check-contrast.mjs` reports 0 AA-normal failures against its
   default palette (currently reports exactly 3).
2. `npm run validate` still exits 0, and now runs both `tsc --noEmit` and the
   structural checks — confirm by temporarily introducing a deliberate type
   error, confirming `npm run validate` fails, then removing it again (don't
   leave a broken state).
3. `npm run validate`'s own contrast check (Part B) actually fails if you
   temporarily revert one of the Part A fixes — confirm the new check is
   real, not a no-op, then re-apply the fix.
4. `grep -n "queryKey: \['skus'\]" src/pages/RepDashboard.tsx` finds nothing;
   `grep -n "queryKey: \['skus', 'rep-dashboard'\]" src/pages/RepDashboard.tsx`
   finds it.
5. `npm run build` succeeds.
6. No file outside the list above is created or modified.

**You may decide alone (T0/T1):** exact wording of the new `validate.mjs`
check's console output/label, whether Part A's replacement is a plain
find-and-replace or needs per-usage judgment (e.g. if any usage turns out to
be on a background the checker doesn't cover — say so rather than guessing).

**Escalate instead of guessing (T2) if:** `check-contrast.mjs` doesn't export
a programmatic (non-CLI) interface as described — re-read the file first,
but if it's genuinely CLI-only, stop and report that rather than shelling out
to it from inside `validate.mjs` in a way that doesn't match the rest of that
file's style.

**When done, write `delegation/tasks/T8-contrast-and-cleanup/NOTES.md`**
(create it): paste `check-contrast.mjs`'s before/after output, confirm the
deliberate-type-error test from criterion 2, confirm the deliberate-revert
test from criterion 3, list the exact files touched. Then stop — no git, no
second task.
