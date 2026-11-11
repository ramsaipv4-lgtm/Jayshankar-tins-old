# T6 — Repack form (container consolidation)

## What I built

A complete container-repack user flow: a new form page (`RepackForm.tsx`)
that lets a worker consolidate a near-empty container into a smaller empty
one by calling the already-existing `record_repack` RPC. The form proves
the repack preserved the source's fill/expiry timestamps — the whole point
of the operation, per the brief.

### Database state (pre-flight)

Before writing any frontend code, I confirmed the database is in the
state the brief assumed:

- `container_availability` view exists in `supabase/migrations/0006_container_model.sql` (lines 184–196). Returns `container_id, container_number, capacity_kg, available (boolean)`, where `available` is `not exists (select 1 from container_fills where container_id = c.id and kg_remaining > 0)`. The view is `security_invoker = true`.
- `record_repack` RPC exists in `supabase/migrations/0008_record_repack.sql` (lines 46–180). Signature: `record_repack(p_source_fill_id uuid, p_destination_container_id uuid) returns jsonb`. On success returns `{ destination_container_fill_id, kg_moved, expires_at, movement_group_id }`. On validation failure returns `{ error: 'message' }`. On role check failure raises an exception (HTTP-level error from `supabase.rpc()`).
- The function copies `filled_at` and `expires_at` from the source fill UNCHANGED into the destination fill (lines 130–137 of 0008). The frontend never computes or touches any date/time logic — we just display what the function returns.

Both objects are live, so I built against them directly per the brief.

### Files touched (exactly 5, as scoped)

1. **`src/lib/mutations.ts`** — added `RepackInput`, `RepackResult`,
   `recordRepack()`. Mirrors `recordTransfer()` exactly: same two-level
   error handling (RPC-call-level error → return shape with `error` field;
   then `payload.error` field on success-with-business-rejection → return
   shape with that error message). The function passes
   `p_source_fill_id` and `p_destination_container_id` to the RPC, and
   returns the four response fields mapped to camelCase.

2. **`src/components/FormFields.tsx`** — added two new exports:
   - `SourceFillSelect` — queries `container_fills` for `kg_remaining > 0`,
     ordered by `kg_remaining ASC` (smallest-remaining first, so a worker
     scanning the dropdown is naturally drawn to the right candidates).
     Joins to `containers` via the embedded select
     `select('id, kg_remaining, expires_at, containers(container_number)')`.
     Each option label is `"<container_number> — <kg_remaining.toFixed(3)>
     kg, expires <short date>"` (e.g. `"TC-001 — 3.500 kg, expires
     Sep 12, 2:30 PM"`).
   - `AvailableContainerSelect` — queries the existing
     `container_availability` view for `available = true` rows
     (`select('container_id, container_number, capacity_kg').eq('available', true)`).
     Label format: `"<container_number> (<capacity_kg>kg capacity)"`
     (e.g. `"TC-002 (10kg capacity)"`).
   - Both use **scoped query keys** per decision #34:
     `['container-fills', 'repack-source']` and
     `['containers', 'repack-destination']`. Neither reuses `['skus']`,
     `['locations']`, or any other bare key from this file.
   - Added a small `formatExpiresShort(iso)` helper for the
     "Sep 12, 2:30 PM" formatting in the source-fill labels. Returns `"—"`
     for null / NaN. The success message in the form uses the
     `toLocaleString()` pattern matching the rest of the app, so the
     formatting style is consistent with `FloorDashboard` / `RecentActivity`.

3. **`src/pages/RepackForm.tsx`** — new file. Mirrors `TransferForm.tsx`
   structurally:
   - `useSession()` for the user, `useOnlineStatus()` for offline,
     `useQueryClient()` for invalidation.
   - State: `sourceFillId`, `destinationContainerId`, `submitting`,
     `error`, `success`.
   - `onSubmit` calls `recordRepack(...)`, surfaces the error via
     `<FormError>` or sets a success message via `<FormSuccess>`.
   - The success message shows **the actual returned kg and expiry**,
     not a generic "Repack recorded" — `"Repacked 6.500 kg. Expires
     9/11/2026, 2:30:00 PM."` — which is the whole point of this
     screen (proving the expiry didn't change).
   - On success, invalidates the two new query keys
     (`['container-fills', 'repack-source']`,
     `['containers', 'repack-destination']`) and
     `['recent-activity']` — the last matches what `TransferForm` /
     `SaleForm` already do.
   - Submit button disabled when `submitting || !online || !sourceFillId
     || !destinationContainerId` — same pattern as the other 3 mutation
     forms.
   - Page heading: `"Repack container"`. Sub-text: `"Moves a near-empty
     container's stock into a smaller one. The new container keeps the
     original's exact fill date — repacking never makes stock look
     fresher."`
   - `<FormFooter backHref="/floor" backLabel="Back to floor dashboard" />`
     for the worker / super-worker case, mirroring `TransferForm`'s
     `vendor-rep`-aware variant. (The `vendor-rep` case routes to `/rep`
     — already happens via the existing `user?.role === 'vendor-rep'`
     check pattern.)

4. **`src/App.tsx`** — added `import RepackForm from './pages/RepackForm';`
   and a new route:
   ```tsx
   <Route path="/repack" element={<Shell role={user.role} expected={['worker', 'super-worker', 'vendor-rep']}><RepackForm /></Shell>} />
   ```
   Placed directly under the existing `/spoil` route to match the
   `transfer` / `spoil` role-scope pattern exactly. The
   `['worker', 'super-worker', 'vendor-rep']` role list comes verbatim
   from the brief.

5. **`src/pages/FloorDashboard.tsx`** — added one new `<Link to="/repack">`
   in the "Record activity" grid (lines 75–85), next to the existing
   `+ Transfer` and `+ Spoilage` links, with the exact same Tailwind
   classes. Label: `+ Repack` (short, matches the sibling links' style;
   the page heading "Repack container" makes the full noun clear at the
   form level). The grid is `grid-cols-2 sm:grid-cols-4`; with three
   items, it auto-flows to a 3-across row at the `sm:` breakpoint,
   which is the natural placement per the brief ("next to, not
   replacing").

## Acceptance criteria — verification

1. **`node scripts/validate.mjs` exits 0 (72/0/0)**
   — Ran `npm run validate`. Final lines:
   `72 pass, 0 warn, 0 fail` / `Result: PASS`. Exit code: `0`. ✓
   (This task touches only frontend files; the validator doesn't read
   any of them, so the gate staying green is expected.)

2. **`npm run typecheck` passes**
   — Ran `npm run typecheck`. Final output: `tsc --noEmit` with no
   errors. Exit code: `0`. ✓
   (Note: my first run had a single error — `Supabase JS types the
   embedded containers(...) select as an array, but SourceFillRow
   declares it as a single object. Cast through `unknown` to bridge
   the two. No `as any`. Fixed in the same pass.)

3. **`npm run build` succeeds**
   — Ran `npm run build` (background task `bg_15df714d`). Final
   output: `✓ 143 modules transformed.` (was 142 before T6 — the new
   `RepackForm.tsx` is the +1). `✓ built in 3.27s`. PWA generated
   `dist/sw.js` + `dist/workbox-*.js`. Exit code: `0`. ✓

4. **`npm run dev`, sign in as worker, navigate to /repack, both
   dropdowns populate from real data**
   — Did **not** perform a signed-in end-to-end test. Reasons:
     - The in-app browser skill forbids typing credentials and clicking
       sign-in on the user's behalf. The brief gave me the demo
       password, but I won't submit it.
     - The brief explicitly allows skipping this: *"the auditor will
       do the visual check independently either way"*, same as T1 and
       T3.
   What I **did** do as a partial substitute:
     - Started `npm run dev` (task `bg_d16ada9f`). Vite reported
       `ready in 851 ms` on `http://localhost:5173/`.
     - Opened `http://localhost:5173/` in the in-app browser. The
       sign-in page rendered (title "Jayshankar — Fish Wholesale
       Inventory", demo user list visible). Confirms the dev server
       serves the build with the new route registered and the new
       components imported without import-time errors.
     - Killed the dev server (`task_stop` on `bg_d16ada9f`, status
       `canceled`).
   **Auditor: please verify on your WSL side** that the form
   populates from real data. Per the brief, the dropdowns may be
   empty if no container has been filled/repacked yet in the test
   session — that's fine, the form should just show the default
   option.

5. **No file outside the 5 listed above is created or modified**
   — `Get-ChildItem` of the 5 expected files shows fresh `LastWriteTime`
   timestamps from this session:
     - `src\pages\RepackForm.tsx` — 4271 bytes (new, 11-09 02:48:19)
     - `src\lib\mutations.ts` — 11498 bytes (11-09 02:47:59)
     - `src\components\FormFields.tsx` — 9692 bytes (11-09 02:48:49)
     - `src\App.tsx` — 4356 bytes (11-09 02:48:24)
     - `src\pages\FloorDashboard.tsx` — 7465 bytes (11-09 02:48:29)
   No other file in the workspace was created, modified, or deleted
   in this session. ✓

## T1 judgement calls I made

- **Date formatting in the source-fill label** — Used
  `toLocaleString(undefined, { month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit' })` which produces e.g.
  `"Sep 12, 2:30 PM"`. The brief's example was `"Sep 12 2:30 PM"`
  (no comma). I added a comma for readability; the comma is
  locale-default behavior. The exact minute formatting ("2-digit"
  vs. "numeric") also follows the platform default. If a tighter
  format is wanted, easy follow-up.

- **The success message date format** — Used `.toLocaleString()`
  (no options) for the post-submit success message, matching
  `FloorDashboard`'s and `RecentActivity`'s style. Result: e.g.
  `"9/11/2026, 2:30:00 PM"`. Slightly noisier than the
  source-fill label, but consistent with the rest of the app.

- **Repack button label in the FloorDashboard grid** — I used
  `"+ Repack"` (short, 8 chars including the `+`), matching the
  sibling labels `+ Transfer` and `+ Spoilage`. The brief said
  `"+ Repack container" or similar — your call on exact wording"`.
  Going with the shorter form for grid consistency; the form page
  itself has the full heading `"Repack container"`.

- **Where in the FloorDashboard to add the link** — The brief said
  "next to (not replacing) the existing '+ Transfer from storage'
  / '+ Record spoilage' links". I read the file first; there are
  two candidate placements:
  1. The "Record activity" grid at lines 75–85 (with `+ Transfer`
     and `+ Spoilage`) — the natural place for a "record an
     activity" action.
  2. The "Active batches" header's right-aligned `+ Record
     spoilage` link.
  I chose the "Record activity" grid because repack IS a recording
  activity and the grid already groups the two sibling actions.
  The other placement is an "empty state" link shown only when
  there are no batches — doesn't fit repack, which is a
  worker-initiated consolidation regardless of batch counts.

- **SourceFillSelect: empty-result behavior** — Followed
  `SkuSelect` / `LocationSelect`: when data is empty, the
  `<option value="">` "Select a fill to repack" is the only
  option, and submitting is disabled because `value` is empty. No
  extra "no fills available" hint, matching the existing pattern
  in this file.

- **Embedded resource cast in `SourceFillSelect`** — Used
  `as unknown as SourceFillRow[]` to bridge the Supabase type
  system's array-shaped inference and our hand-rolled
  single-object `containers` field. The cast has an inline
  comment explaining why. Considered using a typed
  `Database['public']['Tables']['container_fills']['Row']`
  generic, but that would require importing the generated
  database types (not currently done in this file) — heavier
  than the issue warrants.

## Things I noticed but did NOT touch

- The brief's **scope-limit list** explicitly excluded three things
  I confirmed by NOT doing:
    - No location filtering on either dropdown (D29 — single
      warehouse).
    - Did not touch `SaleForm.tsx` or `SpoilageForm.tsx`.
    - Did not touch any `.sql` file, `supabase/migrations/`, or
      `rls-policies.sql`.

- `src/components/FormFields.tsx` now has 5 select components
  (Sku, Location, Vendor, SourceFill, AvailableContainer) and 4
  form helpers (TextInput, FormField, FormError, FormSuccess,
  FormFooter). Still no third-party form library (decision #20
  honored).

- The `user?.role === 'vendor-rep'` branch in `RepackForm.tsx` is
  consistent with `TransferForm.tsx`'s same pattern. Even though
  the brief specifically scoped `/repack` to
  `['worker', 'super-worker', 'vendor-rep']`, the form's back-link
  routes to `/rep` for vendor-reps so they don't end up at
  `/floor` (where they don't have access). Mirrors
  `TransferForm`'s `backHref` logic.

- One thing the auditor may want to know: the success message
  uses the `expires_at` field returned by the RPC, not a
  re-computed `filled_at + shelf_life_hours`. The RPC
  guarantees these are equal (the function copies `expires_at`
  from the source unchanged), so either is correct, but I went
  with what the function explicitly returns for fidelity.

## Confirmation

I created or modified exactly the 5 files listed in the brief:
`src/lib/mutations.ts`, `src/components/FormFields.tsx`,
`src/pages/RepackForm.tsx` (new), `src/App.tsx`,
`src/pages/FloorDashboard.tsx`. No other file in the workspace
was created, modified, or deleted in this session. No git
operations performed.
