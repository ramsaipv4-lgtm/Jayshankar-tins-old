# T6-repack-form — audit

**Result: integrated, clean.** MiniMax's diff was exactly in scope, correct, and well-matched to
existing conventions. No auditor-side code fix was needed — the only auditor action beyond
independent re-verification was a database hygiene cleanup unrelated to the diff itself (see
below). Full re-verification below, including the class of check this project has repeatedly
found matters (T3, decision #34): confirming the *actual live data shape* the new queries return
matches what the component code assumes, not just trusting that diff + gate = working.

## Environment reset (standing rule)

Fresh `npm install` from WSL before verifying anything — MiniMax built on Windows.
`up to date, audited 468 packages` — no native-binary breakage this round (unlike T1).

## Independent gate re-runs

- `npm run validate` → **72 pass, 0 warn, 0 fail. PASS.** Matches MiniMax's report.
- `npm run typecheck` → **clean, no output, exit 0.** Matches MiniMax's report (including their
  own caught-and-fixed `as unknown as` cast issue — see below, confirmed correct not just
  plausible).
- `npm run build` → **143 modules, built in 7.99s, PWA generated (7 precache entries).** Matches
  MiniMax's report (142 → 143, the +1 is `RepackForm.tsx`).

## Diff review (all 5 files read in full)

1. **`src/lib/mutations.ts`** — `RepackInput`/`RepackResult`/`recordRepack()` structurally
   identical to `recordTransfer()`, including the two-level error handling and the unused
   `_userId` second parameter (matches the existing convention exactly — the RPC gets the caller
   from `auth.uid()` server-side, the client param is vestigial by design, not a bug).
2. **`src/components/FormFields.tsx`** — `SourceFillSelect` and `AvailableContainerSelect` both
   follow `SkuSelect`/`LocationSelect`'s exact shape. Query keys are `['container-fills',
   'repack-source']` and `['containers', 'repack-destination']` — distinct from every existing
   key in the file, as the brief required. `AvailableContainerSelect` correctly queries the
   existing `container_availability` view rather than re-deriving availability client-side
   (matches D17 — availability is derived, not stored).
3. **`src/pages/RepackForm.tsx`** (new) — structurally mirrors `TransferForm.tsx`. Success
   message uses the RPC's actual returned `kgMoved`/`expiresAt`, not a generic string — correctly
   makes the screen prove its own point (expiry unchanged). Invalidates both new query keys plus
   `recent-activity`, matching sibling forms' invalidation pattern.
4. **`src/App.tsx`** — route added under `/spoil`, role scope `['worker', 'super-worker',
   'vendor-rep']` copied verbatim from the brief, matches `/transfer`/`/spoil` exactly.
5. **`src/pages/FloorDashboard.tsx`** — one link added to the existing 2-item "Record activity"
   grid (now 3, auto-flows correctly at `grid-cols-2 sm:grid-cols-4`), same classes as its
   siblings.

Scope-limit compliance confirmed: no `.sql` file touched, `SaleForm.tsx`/`SpoilageForm.tsx`
untouched, no location filtering added (correctly out of scope per D29).

## The check that matters most: does the actual data shape match what the code assumes?

MiniMax's `NOTES.md` was explicit that they didn't do a signed-in browser check (correctly,
per the brief and the browser-skill credential restriction) and asked the auditor to verify the
dropdowns populate from real data. No live data existed to check against (all of this session's
earlier `test-container-fill.mjs`/`test-container-repack.mjs` runs clean up after themselves) —
so rather than a no-op empty-state check, seeded one real container fill + one real empty
destination container via the already-tested `record_container_fill` RPC, then hit PostgREST
with the **exact select strings** `SourceFillSelect` and `AvailableContainerSelect` use, signed
in as the real `worker@jayshankar.demo` user (not the secret key — RLS matters here: if worker
read access were blocked, the dropdowns would silently show empty even with real data present,
exactly the "diff correct, gate green, feature still doesn't work" shape T3 taught this project
to check for).

Confirmed empirically, not just read as plausible:
- `container_fills?select=id,kg_remaining,expires_at,containers(container_number)` — the
  embedded `containers` field comes back as a **single object**, not an array, for the real seeded
  row. This directly confirms MiniMax's `as unknown as SourceFillRow[]` cast comment ("the actual
  wire shape is a single object... Supabase JS types it as an array only because the generic
  client can't infer the many-to-one cardinality") is correct at the runtime level, not merely a
  plausible-sounding justification for a cast.
- `f.containers?.container_number` — the exact access pattern used in the option label — reads
  correctly against the live shape.
- `container_availability?select=container_id,container_number,capacity_kg&eq.available=true` —
  returned the seeded empty destination container, and correctly **excluded** the seeded source
  container (which still had stock) from the available list.
- Both queries returned HTTP 200 under the **worker** token — confirms `rls-policies.sql`'s
  `container_fills_select_authenticated`/`containers_select_authenticated` policies actually let
  a worker session populate this screen, not just that they exist in the SQL file.

All seed data cleaned up via secret key afterward (script in the session scratchpad, not the
repo — this was an audit script, not a durable project asset).

## Found during audit, not part of T6's diff: 13 leftover test containers

`containers` had 13 rows (`TEST-C-*`, 5kg/20kg) left over from this session's own earlier
`test-container-fill.mjs`/`test-container-repack.mjs` debugging runs — traced to a few of those
runs predating a cleanup-tracking fix made mid-session (specifically, before `created.containers
.push(...)` was added for Test 3's registered-but-rejected container). Harmless (inert, no fill
ever referenced them, no FK risk) but would have shown up as fake entries in the real `/repack`
destination dropdown today. Confirmed none had any `container_fills` reference (active or
historical) before deleting via the secret key. Not a T6 defect — pre-existing residue T6's own
audit happened to surface by being the first thing to actually query `container_availability`
against live data since those runs.

## Verdict

**Integrated.** No code changes needed. `delegation/LEDGER.md` updated to `integrated`.
