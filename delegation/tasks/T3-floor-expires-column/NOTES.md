# T3 — Floor dashboard: Expires column (shelf_life_hours)

## What I changed

One edit, in `src/pages/FloorDashboard.tsx` line 17. The skus query
previously selected `'id, code, english_name'` and never fetched
`shelf_life_hours`, so `expiresAt(b)` always saw `sku.shelf_life_hours` as
`undefined` and returned `null` — making the "Expires" column render `—`
for every row.

The fix:
```ts
// before:
.from('skus').select('id, code, english_name').order('english_name')
// after:
.from('skus').select('id, code, english_name, shelf_life_hours').order('english_name')
```

The `Sku` interface (line 9) already declares
`shelf_life_hours: number | null`, and `expiresAt()` (around line 53) already
reads `sku.shelf_life_hours` correctly. The TypeScript types and the
computation did not need to change — only the SELECT list was missing the
column. No T1 work was touched (the locations query/interface on lines 11
and 26 are intact).

## Acceptance criteria — verification

1. **The skus query selects `id, code, english_name, shelf_life_hours`**
   — `read` of the file at line 17 confirms:
   `.from('skus').select('id, code, english_name, shelf_life_hours').order('english_name')`. ✓

2. **No other line in the file changes**
   — Only one `edit` call in this session, targeting exactly the line above.
   The locations query on line 26 (T1's work) and the `Location` interface
   on line 11 are still in their T1-post state. The `Sku` interface, the
   `Batch` interface, the `expiresAt` helper, the table render — all
   unchanged. ✓

3. **No file other than `src/pages/FloorDashboard.tsx` was modified**
   — One `edit` call, one file. No `write`, no other modifications. ✓

4. **`node scripts/validate.mjs` exits 0**
   — Ran `npm run validate`. Final lines:
   `72 pass, 0 warn, 0 fail` / `Result: PASS`. Exit code: `0`. ✓

5. **`npm run build` succeeds**
   — Ran `npm run build` (background task `bg_850abbc0`). Final output:
   `✓ 142 modules transformed.` / `✓ built in 2.71s` / PWA generated
   `dist/sw.js` + `dist/workbox-*.js`. Exit code: `---build-exit:0---`. ✓
   (Bundle filename is now `index-SrdYFAJj.js` — expected, source changed.)

6. **`npm run typecheck` succeeds**
   — Ran `npm run typecheck`. Final output: `tsc --noEmit` with no errors.
   Exit code: `---typecheck-exit:0---`. ✓ (Strict TS passes — the new
   column matches the already-declared interface field.)

7. **Visual check (Expires column shows real dates)**
   — Did **not** perform a signed-in visual check. Reasons:
     - The in-app browser skill forbids typing credentials and clicking
       sign-in on the user's behalf. The brief gave me a password
       (`DevPassword123!`), but I won't submit it.
     - The brief explicitly allows skipping this: *"If you can't run a
       dev server/browser from your environment, say so in your notes —
       the auditor will do the visual check independently either way,
       same as T1."*
     - T1's NOTES.md followed the same defer-to-auditor pattern.

   What I **did** do as a partial substitute:
     - Started `npm run dev` in background (task `bg_a871dea2`). Vite
       reported `ready in 830 ms` on `http://localhost:5173/`.
     - Opened `http://localhost:5173/` in the in-app browser. The app
       rendered the sign-in form (title "Jayshankar — Fish Wholesale
       Inventory", demo user list `admin@/rep@/worker@jayshankar.demo`).
       Confirms the Vite dev server works and the post-T1 build is
       deliverable end-to-end up to the auth boundary.
     - Killed the dev server (`task_stop` on `bg_a871dea2`, status
       `canceled`) so I don't leave a stray process.

   **Data-side sanity check instead of UI check:** verified the brief's
   claim that every seeded SKU has `shelf_life_hours` set. Read
   `supabase/seed.sql` lines 68–93 (the `insert into public.skus (...)`
   block). All 25 SKU rows have a non-null numeric value in the
   `shelf_life_hours` column (the 8th column of the row tuple). Values
   range from `8` (anchovy) to `720` (dried fish, in hours). No `null`,
   no `0`. So once the SELECT fetches the column, every row in the
   Active batches table will get a real `expiresAt` value, not `—`.

   Combined evidence (gate green + data-side sanity + dev server renders
   sign-in cleanly) is the strongest non-credential verification I can
   produce from this environment. **Auditor: please do the signed-in
   visual check on your WSL side.**

## Things I noticed but did NOT touch

- The grep for `shelf_life_hours` in `src/` would also show the same
  pattern needed in any other component that wants to compute
  expiry. None of the others do today (`RecentActivity` only renders
  "When", not expiry; `StockBySku` aggregates by SKU, not batch). So
  T3's one-line fix is the only place this bug lived.

- The dev server is now stopped. The auditor's environment on WSL is
  independent and the `node_modules` path-difference caveat in the
  brief doesn't affect `node scripts/*.mjs` runs; if the auditor does
  the visual check, they'll need a fresh `npm install` on Linux to
  use `npm run dev` (per the brief's env note).

- Re-confirmed the T1 work is still in place on lines 11 and 26. The
  locations query still selects `id, name, display_name` and the
  `Location` interface still has `display_name?: string | null`. No
  regression.

## Confirmation

I touched exactly one file: `src/pages/FloorDashboard.tsx`. One `edit`
call on line 17, no `write`, no other modifications. `RecentActivity.tsx`,
`AdminDashboard.tsx`, `StockBySku.tsx`, `FormFields.tsx`, and every
other file are untouched. No git operations performed.
