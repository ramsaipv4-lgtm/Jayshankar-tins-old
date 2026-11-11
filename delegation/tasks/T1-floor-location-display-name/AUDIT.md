# T1 — audit (auditor: Claude, 2026-09-10)

**Verdict: INTEGRATED.** MiniMax M3's work is correct, minimal, and exactly
in scope. All 4 file/scope-related acceptance criteria pass. Criterion 5
(validate) and 6 (build) pass, independently re-confirmed. Criterion 7
(typecheck) genuinely fails for a **pre-existing** reason MiniMax correctly
diagnosed and correctly did not touch (out of its file scope) — fixed
separately below, not counted against T1.

## Independent re-verification (not taking MiniMax's self-report at face value)

- `git diff` matches `NOTES.md`'s description exactly — 3 changes, one file
  (`src/pages/FloorDashboard.tsx`), nothing else touched. Confirmed via
  `git status --short` too (only that file modified).
- `node scripts/validate.mjs` — re-ran independently: **72 pass, 0 warn, 0
  fail.** Matches.
- `npm run build` — re-ran independently: succeeds. Matches.
- `npm run typecheck` — re-ran independently: **failed with the exact same
  error** MiniMax reported (`RecentActivity.tsx(4,1): 'Link' is declared but
  its value is never read`). Confirmed the file MiniMax's diff never touches
  it — this is genuinely pre-existing, not introduced by T1. See "Bonus
  fix" below.
- **Environment note, logged for the record:** the first attempt to run the
  dev server on the WSL2 side failed — `Cannot find module
  @rollup/rollup-linux-x64-gnu` — because MiniMax's own `npm run build` on
  Windows had rewritten the shared `node_modules` with Windows-only native
  binaries. Exactly the gotcha `delegation/README.md` and T1's brief warned
  about. Fixed with a plain `npm install` from WSL before continuing — not a
  defect in T1's code, a confirmed real instance of the cross-platform risk.
  **Process takeaway for future rounds:** the auditor should always run its
  own `npm install` before verifying anything that touches `node_modules`,
  every round, not just when something breaks.
- **Visual check** (the user asked for this explicitly): launched the dev
  server, signed in as `worker@jayshankar.demo`, screenshotted the Floor
  dashboard. Location column reads **"Display Counter"** and **"Cold
  Storage"** for every row — not the raw `display`/`storage` short names.
  Zero browser console errors. Screenshot + a text-level extraction of all
  visible Location cells both confirm this independently of the code
  inspection above.

## Corrections to MiniMax's "noticed but not touched" notes

Both of these were checked and are mostly right, with one overstatement
worth correcting so it doesn't get treated as equally urgent as it isn't:

- **`AdminDashboard.tsx`'s missing `display_name`** — real, confirmed
  (`interface Location { id: string; name: string }` at line 12, `.select('id,
  name')` at line 36). **But** MiniMax's note that it has "a `locationName`
  helper... same shape as the bug I just fixed" is **not accurate** — no
  such helper exists in that file, and `locations` data there is only used
  for a count (`<Stat label="Locations" value={locations?.length} />`), never
  rendered per-row. So this is a **latent, currently-invisible** gap, not an
  active display bug like T1's — worth fixing before anyone adds a feature
  that renders a location name on the admin dashboard, but it's not urgent
  the way T1 was. Downgraded priority accordingly for T2 (see below).
- **`StockBySku.tsx`'s non-optional `display_name: string | null`** — confirmed
  accurate, real minor style inconsistency, no functional effect. Fine to
  leave as a backlog nit.

## New finding from this audit (not in MiniMax's notes — found during the
visual check)

**`FloorDashboard.tsx`'s "Expires" column is blank for every row.** The
`skus` query (line 17, untouched by T1) selects only `id, code,
english_name` — it never selects `shelf_life_hours`, even though the `Sku`
interface declares it and `expiresAt()` (line 53) reads
`sku.shelf_life_hours` to compute the date. Seed data does have
`shelf_life_hours` populated for every SKU (confirmed in `supabase/seed.sql`)
— this isn't a seed-data gap, it's the same *pattern* of bug as T1 (a query
not selecting a column the code depends on), just a different column and a
different visible symptom (always-blank, not wrong-value). Good candidate
for a follow-up task — see below.

## Bonus fix applied during integration (not part of T1, logged separately)

Removed the unused `Link` import from `RecentActivity.tsx` (one line) — the
pre-existing typecheck failure above. Trivial, zero behavioral change,
independently confirmed by re-reading the file (no JSX `<Link>` usage
anywhere). `npm run typecheck` now passes clean. This is the auditor's own
integration-time cleanup, not MiniMax's work — logged as its own line in
`BUILDER-DECISIONS-REVIEW.md`, not folded into T1's decision entry.

**Notable side-finding:** this means `npm run typecheck` has been silently
broken for a while — neither `npm run validate` nor `npm run selftest`
(the project's actual gate, per `HANDOVER.md`) run `tsc --noEmit`, so this
slipped through unnoticed across multiple prior sessions. Worth considering
whether `typecheck` should be folded into the gate rather than staying an
opt-in script (`package.json` already separates them, per decision #29,
`git log`/`BUILDER-DECISIONS-REVIEW.md`) — not decided here, just flagged.

## Candidate next tasks (for the user to pick from, not auto-queued)

- **T2 — `AdminDashboard.tsx` display_name gap.** Same one-file pattern as
  T1. Lower urgency than T1 was (latent, not visibly wrong yet) — do it
  when convenient, or bundle with T3.
- **T3 — `FloorDashboard.tsx` Expires-column bug.** New finding above. Same
  file T1 just touched, but the `skus` query — no file-overlap conflict
  with a hypothetical T2 (different file), but note it against `LEDGER.md`'s
  independence check if both are ever queued together with anything else
  touching `FloorDashboard.tsx`.
- **The `typecheck`-not-in-the-gate question above** — not a build task,
  a process question for the user/next planning session.

## Status

`delegation/LEDGER.md` T1 row updated to `integrated`. Decision logged in
`BUILDER-DECISIONS-REVIEW.md`. `HANDOVER.md` updated. Committed to git
(WSL side) as part of this integration.
