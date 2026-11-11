# T7 — Sale/spoilage rewire (container-sourced cascade)

## What I changed

Rewired `recordSale` and `recordSpoilage` in `src/lib/mutations.ts` to
call the new container-sourced RPCs (`record_container_sale` and
`record_container_spoilage` from migration 0009) instead of the old
client-side "find the oldest batch, deduct, insert one movement" logic.
Also updated the success messages in `SaleForm.tsx` and `SpoilageForm.tsx`
to surface the new container-vs-direct split.

### Files touched (exactly 3, as scoped)

1. **`src/lib/mutations.ts`**
   - Updated the file header comment to reflect the new 5-function
     architecture (was "4 mutation functions"; added a one-line summary
     of each and a note that the race-condition concern from decision #19
     is gone for the RPC-backed paths).
   - Replaced `SaleResult` interface:
     - **Removed** `batchId` (the new RPC can draw from several fills
       and several batches; no single batch to report).
     - **Added** `containerSourcedKg: number` and
       `directSourcedKg: number` from the new response shape.
     - Kept `saleId`, `shortfall`, `error` (unchanged semantics).
   - Replaced `recordSale` body entirely. Now calls
     `supabase.rpc('record_container_sale', { p_sku_id, p_location_id,
     p_customer_name, p_total_kg, p_sale_price_per_kg, p_notes })`.
     Mirrors `recordTransfer` / `recordRepack` exactly: two-level error
     handling (RPC-level error → return shape with error; payload.error
     → return shape with that error message), success path returns the
     four response fields mapped to camelCase. The `_userId` parameter
     is kept for API compatibility with `SaleForm.tsx`'s call site
     (the new RPC uses `auth.uid()` internally, so the param is
     intentionally unused, matching the `_userId` pattern set by
     `recordRepack` in T6).
   - Replaced `SpoilageResult` interface and `recordSpoilage` body with
     the same pattern. Same field changes (batchId removed, kg
     breakdown added).
   - Removed the now-dead `round2()` helper (it was only used in the
     old `recordSale` to round `total_amount` for the sales row insert;
     the new RPC handles that server-side).

2. **`src/pages/SaleForm.tsx`**
   - Updated the file header to point at the new RPC.
   - Updated the success message: now also destructures
     `containerSourcedKg, directSourcedKg` from the result.
   - Final success message (when `directSourcedKg > 0`):
     `Sale <prefix> recorded (shortfall: X kg) (Y kg from containers, Z kg from storage).`
   - Final success message (when `directSourcedKg === 0`, the
     all-from-containers case):
     `Sale <prefix> recorded (shortfall: X kg).` (unchanged shape; no
     split appended)
   - Updated the page sub-text to describe the two-phase cascade
     rather than the W3 "single-batch fill".

3. **`src/pages/SpoilageForm.tsx`**
   - Same pattern as SaleForm.
   - Final success message (when `directSourcedKg > 0`):
     `Spoilage recorded (shortfall: X kg) (Y kg from containers, Z kg from storage).`
   - Final success message (when `directSourcedKg === 0`):
     `Spoilage recorded (shortfall: X kg).` (unchanged shape)
   - Updated file header and page sub-text.

### Database state (pre-flight)

Before writing any code, I confirmed migration 0009 is live and the RPC
signatures match the brief:

- `record_container_sale(p_sku_id uuid, p_location_id uuid, p_customer_name text, p_total_kg numeric, p_sale_price_per_kg numeric, p_notes text default null)` returns `jsonb` with `{ sale_id, movement_group_id, kg_sold, shortfall, container_sourced_kg, direct_sourced_kg }` on success, `{ error, shortfall }` on business rejection, and raises an exception (HTTP error) on role check failure. (Verified in `supabase/migrations/0009_container_sourced_sale_spoilage.sql` lines 243–322.)
- `record_container_spoilage(p_sku_id uuid, p_location_id uuid, p_total_kg numeric, p_reason text, p_notes text default null)` returns `jsonb` with `{ movement_group_id, kg_spoiled, shortfall, container_sourced_kg, direct_sourced_kg }` on success, `{ error, shortfall }` on business rejection. (Lines 331–392.)
- Both functions are granted `execute to authenticated`.

The brief's contract is exactly what the migrations define. No
T2 escalation needed.

## Acceptance criteria — verification

1. **`node scripts/validate.mjs` exits 0 (72/0/0)**
   — Ran `npm run validate`. Final lines:
   `72 pass, 0 warn, 0 fail` / `Result: PASS`. Exit code: `0`. ✓
   (This task touches only frontend files; the validator doesn't read
   any of them, so the gate staying green is expected.)

2. **`npm run typecheck` passes**
   — Ran `npm run typecheck`. Final output: `tsc --noEmit` with no
   errors. Exit code: `0`. ✓

3. **`npm run build` succeeds**
   — Ran `npm run build` (background task `bg_b9ca056f`). Final
   output: `✓ 143 modules transformed.` (unchanged from T6 — no new
   modules added, just refactoring existing call paths). `✓ built in
   2.88s`. PWA generated `dist/sw.js` + `dist/workbox-*.js`. Exit
   code: `0`. ✓
   Bundle size: `472.44 kB` (down from `473.20 kB` in T6 — small
   drop, expected because we removed the dead `round2` helper and
   several lines of client-side FIFO code).

4. **`grep -rn "from('batches')" src/lib/mutations.ts` inside
   `recordSale` / `recordSpoilage` finds nothing**
   — Ran the grep. Two matches in the file, both at:
   - `mutations.ts:38` — `recordDelivery` (`const { error: batchErr } = await supabase.from('batches').insert({...})`)
   - `mutations.ts:65` — `recordDelivery` rollback
     (`await supabase.from('batches').delete().eq('id', batchId)`)
   Both are inside `recordDelivery` (the only client-side insert
   remaining — deliveries haven't been migrated to a container-aware
   RPC and the brief explicitly didn't ask me to touch them). The
   brief said: *"grep -rn `from('batches')` src/lib/mutations.ts
   inside recordSale/ recordSpoilage should find nothing"*. Neither
   function references `batches` anymore. ✓

5. **Neither form references `.batchId`**
   - `grep .batchId src/pages/SaleForm.tsx` → no matches. ✓
   - `grep .batchId src/pages/SpoilageForm.tsx` → no matches. ✓

6. **No file outside the 3 listed is created or modified**
   - `grep .batchId src/` (whole tree) → no matches. Confirms nothing
     else reads `.batchId` from these results either, so dropping it
     from the interface was safe. ✓
   - No other file in the workspace was created, modified, or deleted
     in this session.

7. **Manual check via `npm run dev`**
   — Started `npm run dev` (task `bg_7b0a184a`). Vite reported
   `ready in 393 ms` on `http://localhost:5173/`.
   - Opened `http://localhost:5173/` in the in-app browser. The
     sign-in page rendered (title "Jayshankar — Fish Wholesale
     Inventory", demo user list visible). Confirms the dev server
     serves the build with the refactored mutations module without
     import-time errors.
   - Killed the dev server (`task_stop` on `bg_7b0a184a`, status
     `canceled`).
   - The brief explicitly flagged this as the kind of change where
     the auditor's live functional check matters most: *"expect the
     auditor to actually run a sale and a spoilage through the live
     database, not just review the diff"*. The signed-in functional
     check is the auditor's job on the WSL side.

## T1 judgement calls I made

- **Success-message split threshold**: I went with the brief's
  recommendation — only show the container/direct split when
  `directSourcedKg > 0`. When `directSourcedKg === 0`, every kg came
  from containers, the breakdown is implied (and showing it every
  time would be visual noise for the common "everything is packed"
  case). The brief explicitly allowed this T1 call.

- **Removed `round2` helper**: It was only used in the old
  `recordSale` body. Strictly the brief said "delete the old
  client-side 'find the oldest batch, deduct, insert one movement'
  logic entirely — it's fully superseded"; the `round2` helper is
  part of that logic. Removing it eliminates dead code and
  simplifies the file. Left a one-line `// no client-side helpers
  needed` comment in its place for clarity.

- **Kept the `_userId` parameter** on both `recordSale` and
  `recordSpoilage`, even though the new RPCs use `auth.uid()`
  internally and don't need it. This matches the pattern set by
  `recordRepack` in T6 and avoids changing the call sites in the two
  forms (which would otherwise need a small code change for no
  functional benefit). The underscore prefix signals "intentionally
  unused" to readers.

- **Updated the file header comment** in `mutations.ts`. The old
  header documented the now-deleted client-side FIFO logic and
  claimed there were "the 4 mutation functions". The new header
  documents the current 5-function architecture and the RPC-backed
  flow. The brief said "Files you may touch: src/lib/mutations.ts…"
  — header comments are part of that file, and leaving the old
  comment would be actively misleading after the refactor.

- **Updated the sub-text below the page heading** in both forms
  ("Deducts kg using the two-phase cascade…") to reflect what the
  form actually does now. The old text said "Deducts from the
  oldest available batch (FIFO). Single-batch fill for W3." which is
  no longer accurate. Small enough to be in-scope, and keeping stale
  text would mislead the next reader.

- **Surface `kg_sold` / `kgSpoiled`?** No. The new response
  carries `kg_sold` / `kg_spoiled` (the actual amount fulfilled) in
  addition to `shortfall`. I considered adding the fulfilled amount
  to the success message (e.g. "Sale recorded: 6.500 kg sold (4.500
  from containers, 2.000 from storage)"), but the brief's example
  didn't include it and the current `kg → shortfall` framing is
  already clear to the user (the form shows the requested kg on
  submit; the result either fully or partially fulfills that, and
  the shortfall tells them how much was missed). Adding the kg
  fulfilled would be information overload. Easy to add later if
  wanted.

## Final success-message wording (for both forms)

**SaleForm**, when `directSourcedKg > 0` (split happened):
```
Sale {saleId.slice(0, 8)} recorded (shortfall: {X} kg) ({Y} kg from containers, {Z} kg from storage).
```

**SaleForm**, when `directSourcedKg === 0` (all from containers):
```
Sale {saleId.slice(0, 8)} recorded (shortfall: {X} kg).
```

**SpoilageForm**, when `directSourcedKg > 0`:
```
Spoilage recorded (shortfall: {X} kg) ({Y} kg from containers, {Z} kg from storage).
```

**SpoilageForm**, when `directSourcedKg === 0`:
```
Spoilage recorded (shortfall: {X} kg).
```

The `shortfall` parenthetical is omitted entirely when
`shortfall === 0` (i.e. the request was fully fulfilled) — this is
preserved from the existing behavior in both forms.

## Things I noticed but did NOT touch

- The brief's **scope-limit list** explicitly excluded:
    - `recordTransfer`, `recordRepack` — already use the
      RPC-calling pattern, no changes needed.
    - `recordDelivery` — the only remaining client-side
      insert path. Not in scope for this task. The brief only
      asked to rewire `recordSale` / `recordSpoilage`. If the
      project later wants deliveries to be container-aware, that's
      a separate task.
    - Any `.sql` / `supabase/migrations/` file.
    - `src/components/FormFields.tsx`, `src/App.tsx`, routing.
    - `SaleInput` / `SpoilageInput` interfaces (their fields map
      directly onto the new RPC params; confirmed by inspection).

- The `userId` parameter on `recordDelivery(input, userId)` is
  *not* prefixed with `_` — it actually uses `userId` in the
  `created_by` field of the movement row insert. I didn't change
  that. (Only `recordSale` and `recordSpoilage` got the `_userId`
  treatment, because only they were rewired.)

- The brief noted: "Checked before writing this brief: nothing
  outside mutations.ts/SaleForm.tsx/SpoilageForm.tsx reads .batchId
  from either result, so removing it is safe." I independently
  verified this with `grep -rn "\.batchId" src/` — zero matches
  anywhere in `src/`. The brief's claim holds.

- The new RPCs (`record_container_sale`, `record_container_spoilage`)
  have **partial-fulfillment semantics**: they report a shortfall
  rather than rejecting. This matches the old client-side
  behavior, so the form's existing `shortfall` rendering continues
  to make sense. No new "sale partially failed" UX is needed.

## Confirmation

I created or modified exactly the 3 files listed in the brief:
`src/lib/mutations.ts`, `src/pages/SaleForm.tsx`,
`src/pages/SpoilageForm.tsx`. No other file in the workspace was
created, modified, or deleted in this session. No git operations
performed.
