# T1 — Floor dashboard: location display name

## What I changed

Three edits, all in `src/pages/FloorDashboard.tsx`, mirroring the pattern in
`src/components/RecentActivity.tsx`:

1. **Line 11** — `Location` interface gains the optional field:
   ```ts
   interface Location { id: string; name: string; display_name?: string | null }
   ```
2. **Line 26** — locations query selects the extra column:
   ```ts
   .from('locations').select('id, name, display_name').order('name')
   ```
3. **Line 51** — `locationName` fallback chain (function name kept, per brief):
   ```ts
   function locationName(id: string) {
     return locations?.find((l) => l.id === id)?.display_name
       ?? locations?.find((l) => l.id === id)?.name
       ?? '—';
   }
   ```

No other lines touched. The `batches` query, table render, and all surrounding
helpers are unchanged.

## Acceptance criteria — verification

1. **Location interface includes `display_name?: string | null`**
   — `read` of the file at line 11 shows:
   `interface Location { id: string; name: string; display_name?: string | null }`. ✓

2. **Locations query selects `id, name, display_name`**
   — `read` at line 26 shows:
   `.from('locations').select('id, name, display_name').order('name')`. ✓

3. **`locationName(id)` returns `display_name ?? name ?? '—'`**
   — `read` at line 51 shows the chained `??` matching RecentActivity's order. ✓

4. **No file other than `src/pages/FloorDashboard.tsx` was modified**
   — Only three `edit` calls were issued, all targeting
   `C:\Users\user\Desktop\Jayshankar\src\pages\FloorDashboard.tsx`. No other
   tool wrote to the workspace in this session. ✓

5. **`node scripts/validate.mjs` exits 0**
   — Ran `npm run validate`. Final lines:
   `72 pass, 0 warn, 0 fail` / `Result: PASS`. Exit code: `0`. ✓

6. **`npm run build` succeeds with no new errors or warnings**
   — Ran `npm run build` (background task). Final output:
   `✓ 142 modules transformed.` / `✓ built in 2.84s` / PWA generated
   `dist/sw.js` + `dist/workbox-*.js`. Exit code: `---build-exit:0---`. ✓

7. **`npm run typecheck` succeeds** — **NOT MET, but pre-existing**
   — Ran `npm run typecheck`. Output:
   `src/components/RecentActivity.tsx(4,1): error TS6133: 'Link' is declared but its value is never read.`
   Exit code: `2`.
   This error is in `RecentActivity.tsx`, a file the brief forbids me to edit
   ("Do not touch RecentActivity.tsx … or any other file"). The error is
   unrelated to my change — I read the same file before editing and the unused
   `Link` import was already there. Confirmed by inspecting line 4 of
   RecentActivity.tsx (import of `Link` from `react-router-dom`) and the rest
   of the file (no JSX `<Link>` usage anywhere — the component renders raw
   text/links via `<a>` or string templates, not the router's `Link`). The
   strict-TS noUnusedLocals rule catches it.
   **Flagging for the auditor**: criterion 7 fails because of a pre-existing
   typecheck issue in a file outside my scope. Recommend either relaxing
   `noUnusedLocals` for that import, dropping the import, or issuing a
   follow-up task T1.1 to clean up RecentActivity's unused import.

## Things I noticed but did NOT touch

- **`src/pages/AdminDashboard.tsx` has the exact same bug** T1 just fixed in
  FloorDashboard:
  - Line 12: `interface Location { id: string; name: string }` (no display_name)
  - Line 36: `.from('locations').select('id, name').order('name')`
  - Plus a `locationName` helper that returns `?.name ?? '—'` (same shape as
    the bug I just fixed).
  Verified with `grep` — these are the only two `id, name`-only locations
  queries in `src/`. The other three files (RecentActivity, StockBySku,
  FormFields) already select `display_name`. So AdminDashboard is the
  remaining instance. **Recommended follow-up task**: T2 with the same
  one-file pattern.

- Minor style nit (not a defect): `src/components/StockBySku.tsx` line 11
  declares `display_name: string | null` (non-optional), whereas the brief's
  contract and the other files use `display_name?: string | null`. Outside
  this task's scope; just noting it for the auditor.

- The brief's contract specifies `display_name?: string | null` (optional
  with `?:`), which I used. This matches `RecentActivity.tsx` exactly.

## Confirmation

I touched exactly one file: `src/pages/FloorDashboard.tsx`. Three `edit` calls,
no `write`, no other modifications. `RecentActivity.tsx`, `AdminDashboard.tsx`,
`StockBySku.tsx`, `FormFields.tsx`, and every other file are untouched.
No git operations performed — that is the auditor's job on the WSL side.
