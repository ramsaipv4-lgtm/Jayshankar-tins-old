# T7-sale-spoilage-rewire — audit

**Result: integrated, clean.** Second delegated task in a row (after T6) needing no auditor-side
code fix. Diff was exactly in scope and correctly matched the RPC contract.

## Environment reset (standing rule)

Fresh `npm install` from WSL before verifying — MiniMax built on Windows. No native-binary
breakage this round.

## Independent gate re-runs

- `npm run validate` → **72 pass, 0 warn, 0 fail. PASS.**
- `npm run typecheck` → **clean, exit 0.**
- `npm run build` → **143 modules, 472.44 kB bundle** — matches MiniMax's report exactly, byte
  for byte.

## Diff review (all 3 files read in full)

`src/lib/mutations.ts`: `recordSale`/`recordSpoilage` bodies fully replaced. Param mapping to
`record_container_sale`/`record_container_spoilage` checked against the migration 0009 source
directly — `p_sku_id`/`p_location_id`/`p_customer_name`/`p_total_kg`/`p_sale_price_per_kg`/
`p_notes` and `p_sku_id`/`p_location_id`/`p_total_kg`/`p_reason`/`p_notes` both match exactly.
Response field mapping (`sale_id`→`saleId`, `container_sourced_kg`→`containerSourcedKg`, etc.)
correct. Two-level error handling matches the `recordTransfer`/`recordRepack` precedent exactly.
`batchId` removed from both result interfaces — independently re-confirmed zero references
anywhere in `src/` (not just trusting the worker's own grep). `round2()` helper correctly
identified as dead code and removed.

`SaleForm.tsx`/`SpoilageForm.tsx`: message-building logic correctly destructures the new fields;
split-vs-no-split branching matches the brief's recommendation exactly.

Scope-limit compliance confirmed: no `.sql` file touched, `recordDelivery`/`recordTransfer`/
`recordRepack` untouched, `FormFields.tsx`/`App.tsx`/routing untouched.

## The live functional check the brief specifically asked for

Migration 0009's cascade logic is already covered by 42 live assertions (decision #41) — what
T7 actually changed is the *glue*: the JS-to-RPC param mapping and the response-to-UI-message
rendering, none of which a `data as {...}` cast gets validated against real runtime shape by
TypeScript. Wrote a script that exactly mirrors the new `recordSale`/`recordSpoilage` bodies
(same param names, same destructuring) and the forms' exact message-building logic, then ran it
against the live database signed in as the real admin role:

- **Split-message path** (sale with both container and direct-fallback stock): seeded a batch
  with 6kg packed / 4kg un-packed, sold all 10kg. Confirmed `containerSourcedKg=6`,
  `directSourcedKg=4`, and the *exact* rendered message text:
  `"Sale <id> recorded (6.000 kg from containers, 4.000 kg from storage)."` — not just that the
  numbers were right, that the string the user would actually see is correct.
- **No-split path** (spoilage entirely from a container): confirmed `directSourcedKg=0` and the
  message correctly omits the breakdown entirely: `"Spoilage recorded."` — proving the
  `directSourcedKg > 0` branch condition works both ways, not just the case MiniMax's own manual
  check would have been most likely to try.
- Read back the `sales` row directly (secret key) to confirm `total_kg`/`customer_name`
  persisted correctly through the full call chain, not just that the RPC's response looked right.

11/11 assertions passed. All seed data cleaned up afterward.

## Verdict

**Integrated.** No code changes needed. `delegation/LEDGER.md` updated to `integrated`.
