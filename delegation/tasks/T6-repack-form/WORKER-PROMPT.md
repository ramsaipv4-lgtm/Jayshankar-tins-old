You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`.

**Environment note (read this first):** the same project folder is also
mounted at `/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux
environment, where the planner/auditor session (Claude) runs. It's the same
files, not a copy. `node_modules` is physically shared and platform-specific
— if you run `npm install` or `npm run build`, do it, that's fine, just know
the auditor will run a fresh `npm install` before verifying regardless (this
has bitten a prior task before — not something you need to work around,
just why you might see the auditor re-install afterward).

---

Task: **T6-repack-form**

**Brief:** Build a new screen, `src/pages/RepackForm.tsx`, that lets a
worker consolidate a near-empty container's stock into a smaller, empty
container by calling an already-built, already-tested database function,
`record_repack`. This is new frontend/application code — the backend RPC
this wires up to is done and live; nothing about the database changes in
this task.

**Why this operation exists (context, not something to re-derive):** fish
is stored in numbered thermocol containers packed with ice (5/10/15/20/25kg
sizes). As a container sells down, at some point its remaining stock would
fit in a smaller container — repacking frees up the larger container and
keeps the physical stock organized. The one rule that matters: the new,
smaller container must inherit the OLD container's exact `filled_at`/
`expires_at` timestamps, never reset them to "now" — the whole point of
this feature is never making fish look fresher than it actually is. The
database function you're calling already enforces and guarantees this; you
don't need to compute or touch any date/time logic yourself, just display
what the function returns.

**The RPC you're wiring up to — `record_repack`:**

```
supabase.rpc('record_repack', {
  p_source_fill_id: string,           // uuid of the container_fills row being emptied
  p_destination_container_id: string, // uuid of the containers row receiving the stock
})
```

Response shape (JSON), on success:
```json
{ "destination_container_fill_id": "uuid", "kg_moved": 6.5, "expires_at": "2026-09-12T14:30:00+00:00", "movement_group_id": "uuid" }
```
On failure (still HTTP 200 — this is a business-rule rejection, not a
network/auth error):
```json
{ "error": "human-readable message" }
```
On a real HTTP-layer failure (e.g. `error` from the `supabase.rpc()` call
itself, not in the response body), treat it as a hard error the same way
the existing `recordTransfer` function does — see the exact template below.

**Follow this exact existing pattern — don't invent a different shape.**
`src/lib/mutations.ts` already has `recordTransfer()`, which calls a
sibling RPC (`record_transfer_cascade`) with the identical
error-then-payload-then-error-field shape. Read it in full before writing
anything. Your new `recordRepack()` function should be structurally
identical to it: same two-level error handling (RPC-call-level `error`,
then a `payload.error` field), same style of returning a typed result
object, same interface-naming convention (`RepackInput`/`RepackResult`,
matching `TransferInput`/`TransferResult`).

**What to build, precisely:**

1. **`src/lib/mutations.ts`** — add:
   - `interface RepackInput { sourceFillId: string; destinationContainerId: string }`
   - `interface RepackResult { destinationContainerFillId: string | null; kgMoved: number; expiresAt: string | null; movementGroupId: string | null; error: string | null }`
   - `export async function recordRepack(input: RepackInput): Promise<RepackResult>` — calls
     `supabase.rpc('record_repack', { p_source_fill_id: input.sourceFillId, p_destination_container_id: input.destinationContainerId })`,
     handling both error levels exactly as `recordTransfer` does.

2. **`src/components/FormFields.tsx`** — add two new reusable select
   components, following the **exact** pattern of the existing
   `LocationSelect`/`SkuSelect` in this file (same `useQuery` + `<select>`
   shape, same prop signature style: `{ value, onChange, required, id }`):

   - **`SourceFillSelect`** — queries `container_fills` for fills that are
     actual repack candidates: `kg_remaining > 0`, ordered by
     `kg_remaining` ascending (smallest-remaining first — those are the
     near-empty ones a worker is actually trying to consolidate). You'll
     need the container's number too for a readable label, which means
     joining to `containers` — Supabase JS supports this via embedded
     resource selects, e.g.
     `.select('id, kg_remaining, expires_at, containers(container_number)')`.
     Each option's label should show the container number, the kg
     remaining, and a human-readable expiry (not a raw ISO timestamp) —
     e.g. `"TC-001 — 3.500 kg, expires Sep 12 2:30 PM"`. Exact formatting
     is your call.
   - **`AvailableContainerSelect`** — queries the **existing** database
     view `container_availability` (already created by migration 0006 —
     do not create a new query against `containers` + `container_fills`
     yourself, this view already does that derivation correctly):
     `.from('container_availability').select('container_id, container_number, capacity_kg').eq('available', true)`.
     Each option's label should show the container number and capacity,
     e.g. `"TC-002 (10kg capacity)"`.

   **Query key discipline — read this carefully, it's a real bug class
   that has bitten this exact file before (decision #34 in
   `BUILDER-DECISIONS-REVIEW.md`, if you want the full story):
   `FormFields.tsx`'s existing `SkuSelect` uses the bare query key
   `['skus']`, and two other components elsewhere in this codebase used
   to share that exact key with a *different* `select` shape — TanStack
   Query silently deduped them and one component's query results starved
   the other, even though nothing else was wrong. Give your two new
   components their own clearly distinct, scoped keys —
   `['container-fills', 'repack-source']` and
   `['containers', 'repack-destination']` — and do not reuse `['skus']`,
   `['locations']`, or any bare/generic key already in this file.**

3. **`src/pages/RepackForm.tsx`** (new file) — a form matching the visual
   structure of `src/pages/TransferForm.tsx` (read it first, use it as your
   layout template: same `FormField`/`FormError`/`FormSuccess`/
   `FormFooter` components, same `max-w-2xl space-y-4` form shell, same
   offline-disables-submit pattern via `useOnlineStatus()`).
   - Two fields: **source fill** (`SourceFillSelect`) and **destination
     container** (`AvailableContainerSelect`).
   - On submit: call `recordRepack({ sourceFillId, destinationContainerId })`.
   - On success: show a message using the real returned values — kg moved
     and the new expiry, e.g. `` `Repacked ${kgMoved.toFixed(3)} kg. Expires ${formatted expiresAt}.` ``
     — do NOT just say "Repack recorded" with no numbers; the whole point
     of this screen is proving the expiry didn't change, so show it.
   - On success, invalidate both new query keys above (so the just-emptied
     source fill and just-filled destination container disappear from
     their respective dropdowns) plus `['recent-activity']` (existing key,
     matches what `TransferForm`/`SaleForm` already invalidate).
   - Submit button disabled when offline, submitting, or either field is
     empty — same pattern as the other 3 mutation forms.
   - Page heading: "Repack container". Short explanatory line under it,
     similar in tone to TransferForm's
     `"Moves kg from source (FIFO oldest batch) to destination (new batch)."`
     — something like "Moves a near-empty container's stock into a smaller
     one. The new container keeps the original's exact fill date — repacking
     never makes stock look fresher."
   - `FormFooter backHref="/floor" backLabel="Back to floor dashboard"`.

4. **`src/App.tsx`** — add the import and a new route, matching the
   existing `/transfer` and `/spoil` routes **exactly** in role scope:
   ```tsx
   import RepackForm from './pages/RepackForm';
   // ...
   <Route path="/repack" element={<Shell role={user.role} expected={['worker', 'super-worker', 'vendor-rep']}><RepackForm /></Shell>} />
   ```

5. **`src/pages/FloorDashboard.tsx`** — add one link to the new `/repack`
   route, next to (not replacing) the existing "+ Transfer from storage" /
   "+ Record spoilage" links (read the file first to match their exact
   styling/placement — decision #28 in `BUILDER-DECISIONS-REVIEW.md` if you
   want the background on why those look the way they do). Label it
   "+ Repack container" or similar — your call on exact wording.

**Known, deliberate scope limits — do not try to solve these, they are
out of scope for this task:**
- No location filtering on either dropdown. There is currently only one
  warehouse in real use (D29), so this isn't a live problem yet — when a
  second warehouse exists, that's a separate, future task.
- Do not touch `SaleForm.tsx` or `SpoilageForm.tsx`. Those still use the
  older, non-container FIFO path (`recordSale`/`recordSpoilage`) — wiring
  them to container-aware RPCs needs a database function that doesn't
  exist yet (it's the auditor's next backend task, not yours). Leave them
  alone entirely.
- Do not touch any `.sql` file, `supabase/migrations/`, or `rls-policies.sql`.
  Everything you need already exists and is live.

**Files you may touch:** `src/lib/mutations.ts`, `src/components/FormFields.tsx`,
`src/pages/RepackForm.tsx` (new), `src/App.tsx`, `src/pages/FloorDashboard.tsx`.
Nothing else.

**Acceptance criteria:**
1. `node scripts/validate.mjs` still exits 0 (72 pass, 0 warn, 0 fail).
2. `npm run typecheck` passes (this project doesn't gate on it yet, but
   don't introduce a failure — check it anyway).
3. `npm run dev`, sign in as `worker@jayshankar.demo` / `DevPassword123!`,
   navigate to `/repack` (via the new Floor dashboard link) — the form
   loads, both dropdowns populate from real data (there may be zero
   candidates if no container has been filled/repacked yet in your test
   session — that's fine, the dropdown should just show an empty/loading
   state, not crash).
4. If you want to test an actual repack end-to-end and there's no data to
   work with: you can create a test bill/batch/container-fill via the
   Supabase dashboard's table editor, or just verify the form renders and
   submits correctly against whatever real data already exists — don't
   fabricate data through any path other than the actual Supabase project
   (no mocking, no stub data hardcoded into the component).
5. No file outside the 5 listed above is created or modified.

**You may decide alone (T0/T1):** exact label wording/formatting, exact
date-formatting approach for `expires_at` (a small helper function is
fine), exact Tailwind spacing/placement of the new FloorDashboard link
within reason (near the other two, not on the opposite side of the page),
whether to add a loading/empty state message inside the two new selects
beyond what `SkuSelect`/`LocationSelect` already do.

**Escalate instead of guessing (T2) if:** the `container_availability` view
doesn't exist, or `record_repack` doesn't exist, when you check — that
would mean the database isn't in the state this brief assumes, and
guessing around it risks building against the wrong shape. Stop and report
that specifically rather than building a workaround.

**When done, write `delegation/tasks/T6-repack-form/NOTES.md`** (create
it): confirm validator/typecheck output, describe what you saw when you
manually tested `/repack` (screenshot if you can), list the exact 5 files
touched (should match the list above exactly), and flag anything you had
to make a T1 judgment call on. Then stop — no git, no second task.
