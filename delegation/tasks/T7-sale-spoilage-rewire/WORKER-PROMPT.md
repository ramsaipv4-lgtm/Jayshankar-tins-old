You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`.

**Environment note:** the same project folder is also mounted at
`/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux environment, where
the planner/auditor session (Claude) runs. Same files, not a copy —
`node_modules` is physically shared and platform-specific. Not expected to
matter for this task (no dependency changes), noted for consistency with
every other brief.

---

Task: **T7-sale-spoilage-rewire**

**Brief:** `src/pages/SaleForm.tsx` and `src/pages/SpoilageForm.tsx` currently
call `recordSale`/`recordSpoilage` in `src/lib/mutations.ts`, which do an
old, simple client-side lookup: find the single oldest batch for a SKU at a
location, deduct from it, report a shortfall if that one batch isn't enough.
That path never looks at the container model at all — no container-tracked
stock is ever considered.

Two new, already-built, already-tested database functions replace that
logic: `record_container_sale` and `record_container_spoilage` (migration
0009). They run a real two-phase cascade server-side — container-tracked
stock first (soonest-to-expire fill first), falling back to un-contained
batches for whatever isn't packed yet, correctly split across as many rows
as needed. This task rewires the two forms to call them instead. **You are
not changing any cascade/FIFO logic yourself — that already exists and is
tested. You're replacing what `recordSale`/`recordSpoilage` call and
updating their result shape to match what the new functions actually
return.**

**The two RPCs you're wiring up to:**

```
supabase.rpc('record_container_sale', {
  p_sku_id: string,
  p_location_id: string,
  p_customer_name: string,
  p_total_kg: number,
  p_sale_price_per_kg: number,
  p_notes: string | null,
})
```
Success response: `{ sale_id, movement_group_id, kg_sold, shortfall, container_sourced_kg, direct_sourced_kg }`.
Business-rejection response (still HTTP 200): `{ error, shortfall }` — e.g. zero stock anywhere.
A real HTTP-layer error (`error` from `supabase.rpc()` itself) means something went wrong at the
network/permission layer, not a business rule.

```
supabase.rpc('record_container_spoilage', {
  p_sku_id: string,
  p_location_id: string,
  p_total_kg: number,
  p_reason: string,
  p_notes: string | null,
})
```
Success response: `{ movement_group_id, kg_spoiled, shortfall, container_sourced_kg, direct_sourced_kg }`.
Business-rejection response: `{ error, shortfall }`.

**Important: there is no `batch_id` in either response anymore.** The old
functions drew from exactly one batch, so `SaleResult`/`SpoilageResult` used
to carry a single `batchId`. The new functions can draw from several fills
and several batches in one call (that's the whole point of the cascade) —
there is no longer a single batch to report. Checked before writing this
brief: nothing outside `mutations.ts`/`SaleForm.tsx`/`SpoilageForm.tsx` reads
`.batchId` from either result, so removing it is safe. Don't try to
reconstruct or fake a `batchId` — just drop it from the interface.

**Follow the exact existing pattern for RPC-calling functions in this
file — `recordTransfer()` (and `recordRepack()`, added in T6) are your
templates.** Read both before writing anything. Same two-level error
handling shape: RPC-call-level `error` first, then a `payload.error` field
on the response body.

**What to build, precisely:**

1. **`src/lib/mutations.ts`** — **replace** the bodies of `recordSale` and
   `recordSpoilage` (keep the function names, keep them exported, keep the
   same *input* interfaces — `SaleInput`/`SpoilageInput` don't need to
   change, their fields map directly onto the RPC params). Delete the old
   client-side "find the oldest batch, deduct, insert one movement" logic
   entirely — it's fully superseded.

   Update the *result* interfaces to match what the RPCs actually return:
   ```ts
   export interface SaleResult {
     saleId: string | null;
     shortfall: number;
     containerSourcedKg: number;
     directSourcedKg: number;
     error: string | null;
   }
   export interface SpoilageResult {
     movementGroupId: string | null;
     shortfall: number;
     containerSourcedKg: number;
     directSourcedKg: number;
     error: string | null;
   }
   ```
   (`batchId` removed from both, per above. `SaleResult` also drops nothing
   else it previously had — check the current file for the exact existing
   shape before editing.)

2. **`src/pages/SaleForm.tsx`** — the current success message is:
   ```ts
   const short = shortfall > 0 ? ` (shortfall: ${shortfall.toFixed(3)} kg)` : '';
   setSuccess(`Sale ${saleId?.slice(0, 8)} recorded${short}.`);
   ```
   This still works as-is (doesn't reference `batchId`) — **but** the new
   response carries genuinely useful new information (`containerSourcedKg`/
   `directSourcedKg`) that's worth surfacing, matching how `RepackForm.tsx`
   (T6) shows its RPC's actual returned values rather than a generic
   message. Recommended: mention the container/direct split when both are
   nonzero, e.g. append something like
   `` ` (${containerSourcedKg.toFixed(3)} kg from containers, ${directSourcedKg.toFixed(3)} kg from storage)` ``
   only when `directSourcedKg > 0` (i.e., only mention the split when it's
   not 100% one or the other — showing it every time would be noisy for
   the common case). Exact wording/threshold is your call (T1) — the goal
   is "don't hide genuinely new information," not a specific string.

3. **`src/pages/SpoilageForm.tsx`** — same idea for its success message
   (currently `` `Spoilage recorded${short}.` ``). Same T1 judgment call on
   exact wording.

**What does NOT need to change:** `src/components/FormFields.tsx`,
`src/App.tsx`, routing, `SaleInput`/`SpoilageInput` (the request shape into
`recordSale`/`recordSpoilage` is unchanged — only what happens inside them
and what they return). Do not touch `RepackForm.tsx`, `TransferForm.tsx`, or
any `.sql`/migration file — everything you need already exists and is live.

**Files you may touch:** `src/lib/mutations.ts`, `src/pages/SaleForm.tsx`,
`src/pages/SpoilageForm.tsx`. Nothing else.

**Acceptance criteria:**
1. `node scripts/validate.mjs` still exits 0 (72 pass, 0 warn, 0 fail).
2. `npm run typecheck` passes.
3. `npm run build` succeeds.
4. `grep -rn "from('batches')" src/lib/mutations.ts` inside `recordSale`/
   `recordSpoilage` should find nothing — confirms the old client-side FIFO
   lookup is actually gone, not just supplemented.
5. Neither `SaleForm.tsx` nor `SpoilageForm.tsx` references `.batchId`
   anywhere (it shouldn't have before either, but confirm your changes
   didn't reintroduce something that expects it).
6. No file outside the 3 listed above is created or modified.
7. Manual check via `npm run dev`, same constraint as T6: don't sign in on
   the user's behalf. If you want to sanity-check the pages still render,
   confirming the dev server starts and the sign-in page loads is enough —
   the auditor will do the live functional check independently either way
   (this is exactly the kind of change — client code calling a different
   RPC with a different response shape — where a real signed-in check
   matters most; expect the auditor to actually run a sale and a spoilage
   through the live database, not just review the diff).

**You may decide alone (T0/T1):** exact success-message wording/threshold
for showing the container/direct split, whether to keep or restructure the
existing `short`-variable pattern, minor internal variable naming.

**Escalate instead of guessing (T2) if:** `record_container_sale` or
`record_container_spoilage` don't exist when you check, or their response
shape doesn't match what's documented above — that would mean the database
isn't in the state this brief assumes. Stop and report rather than building
around it.

**When done, write `delegation/tasks/T7-sale-spoilage-rewire/NOTES.md`**
(create it): confirm validator/typecheck/build output, confirm the
grep-for-`from('batches')` check, list the exact 3 files touched, quote your
final success-message wording for both forms, flag any T1 judgment calls.
Then stop — no git, no second task.
