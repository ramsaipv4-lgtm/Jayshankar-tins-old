# Evidence manifest — Jayshankar source files for kit-update context

> **A curated list of Jayshankar source files to read for the
> kit-update.** The patterns in `applied-changes/new-patterns/` are
> pre-written; this manifest tells you which Jayshankar files back
> each pattern, so you can verify the patterns against the source.

The files are in `Jayshankar/` at the same workspace root as
`tins-kit/`. Paths are relative to the workspace root.

## For `postgres-mutations.md`

| File | Why read it |
|---|---|
| `Jayshankar/supabase/migrations/0005_record_transfer_cascade.sql` | The worked example: a SECURITY DEFINER function with `FOR UPDATE`. Read the full file (~110 lines). |
| `Jayshankar/src/lib/mutations.ts` | The browser-side call site: `supabase.rpc('record_transfer_cascade', {...})`. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decision 23 | The decision rationale: why SECURITY DEFINER + GRANT EXECUTE, not the alternatives. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decision 19 | The earlier decision to defer race-condition protection; the SECURITY DEFINER function delivers it. |

## For `client-side-aggregation.md`

| File | Why read it |
|---|---|
| `Jayshankar/src/components/StockBySku.tsx` | The worked example: client-side aggregation with `useMemo`. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decision 24 | The decision rationale: why client-side for V1, the 200ms threshold. |
| `Jayshankar/docs/W4-MANUAL-VERIFICATION.md` Check 1 + Check 2 | The manual verification confirms the JS aggregation is fast enough for 130 batches. |

## For `pwa-offline-graceful.md`

| File | Why read it |
|---|---|
| `Jayshankar/vite.config.ts` | The worked example: `vite-plugin-pwa` config, manifest, workbox. |
| `Jayshankar/src/lib/online.ts` | The hook: `useOnlineStatus()`. |
| `Jayshankar/src/components/OfflineBanner.tsx` | The banner: SPEC §2.14 text, `role="status"`. |
| `Jayshankar/src/components/Layout.tsx` | The wiring: `<OfflineBanner />` rendered in the layout. |
| `Jayshankar/src/pages/DeliveryForm.tsx`, `SaleForm.tsx`, `TransferForm.tsx`, `SpoilageForm.tsx` | The form-level guards: `useOnlineStatus()` + `if (!online)` + `disabled`. |
| `Jayshankar/public/icon.svg` | The maskable-safe SVG icon. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decisions 26 + 27 | The decision rationale: 3 layers, `navigator.onLine` vs. fetch heartbeat, Service Worker as safety net. |
| `Jayshankar/docs/W5-MANUAL-VERIFICATION.md` | The 8 manual checks that verify the pattern works. |

## For `empty-states.md`

| File | Why read it |
|---|---|
| `Jayshankar/src/pages/FloorDashboard.tsx` | The Tier 1 example: "+ Transfer from storage" button on the empty active-batches state. |
| `Jayshankar/src/pages/RepDashboard.tsx` | The Tier 2 example: hint card pointing to the seed for the empty vendors state. |
| `Jayshankar/src/pages/AuditLog.tsx` | The Tier 3 example: friendly "no activity yet" message on the audit log. |
| `Jayshankar/src/components/RecentActivity.tsx` | A third Tier 3 example: "no activity yet" on the role shells. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decision 28 | The decision rationale: the 3-tier rubric. |

## For the Lesson 4 update to `supabase-auth-trigger.md`

| File | Why read it |
|---|---|
| `Jayshankar/supabase/migrations/0004_grant_authenticated.sql` | The 4th GRANT migration: `grant select ... to authenticated`, plus the "no DELETE" reasoning. |
| `Jayshankar/BUILDER-DECISIONS-REVIEW.md` decision 16 | The decision rationale: the browser-side bug that the lesson captures. |
| `Jayshankar/scripts/validate.mjs` (search for `js-grant-authenticated`) | The validator check that pins the design. |

## Reading order (for the kit-author session)

1. **First read (10 min):** `decisions-summary.md` in this folder, then
   the 7 Jayshankar decisions referenced above (16, 19, 23, 24, 26, 27, 28).
2. **Per pattern (5 min each):** read the pattern file in
   `applied-changes/new-patterns/`, then 1-2 evidence files from the
   table above, then verify the pattern matches the source.
3. **Last read (5 min):** `tins-kit/SPEC.md` and `tins-kit/HANDOVER.md`
   to know what to update after the patterns are dropped in.

## What NOT to copy

The following Jayshankar files are evidence for the patterns but should
NOT be copied into the kit (the kit is markdown + scripts, not a JS
app):

- `Jayshankar/src/**` (all TS/TSX) — the kit is framework-agnostic.
  The patterns are the consumer-side wrappers.
- `Jayshankar/package.json`, `vite.config.ts`, `tailwind.config.ts`,
  `index.html` — Jayshankar's stack. The kit's `templates/` has
  consumer-side examples but the actual scaffold is consumer-built.
- `Jayshankar/supabase/migrations/*.sql` — the worked examples. The
  pattern files reference them by path; they don't need to be
  in the kit itself.

The kit-update is a *markdown + scripts* operation. The new patterns
are 4 markdown files (~750 lines total). The Lesson 4 update is a
~50-line diff to one existing markdown file. That's it.
