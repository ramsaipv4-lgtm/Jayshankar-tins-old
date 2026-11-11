# New kit-side decisions — to append to `tins-kit/BUILDER-DECISIONS-REVIEW.md`

> **5 pre-written kit-side decision entries (decisions 4–8) to append
> to `tins-kit/BUILDER-DECISIONS-REVIEW.md` after the existing decision 3.**
> The format matches the existing 3 entries.

---

## What to do

1. Open `tins-kit/BUILDER-DECISIONS-REVIEW.md`.
2. Find the end of Decision 3 (the last paragraph ends with "the worked
   example here shows how to wire them in.").
3. Append the 5 entries below, in order, separated by a blank line.
4. Verify the new total is 8 decisions.

---

## The 5 new entries

### Decision 4 — Pull forward `lib/patterns/postgres-mutations.md` (SECURITY DEFINER pattern)

**What changed.** Wrote `tins-kit/lib/patterns/postgres-mutations.md` (~310 lines) — the canonical recipe for a multi-table mutation that needs RLS bypass + race-condition safety, bundling 3 lessons crystallised in Jayshankar's W3 → W5:
1. Wrap the cascade in a Postgres function with `SECURITY DEFINER` (lesson 1).
2. Use `SELECT ... FOR UPDATE` for race-condition safety (lesson 2).
3. `SECURITY DEFINER` is the smallest privilege escalation that solves the multi-table-RLS problem; alternatives (set role, direct GRANTs, trigger-based) all fail in different ways (lesson 3).

Worked example: Jayshankar's `record_transfer_cascade` (decision 23, migration 0005). The pattern walks through the SQL function, the browser call (`supabase.rpc('record_transfer_cascade', {...})`), the validator check, and the end-to-end test (RLS path + race-condition path with 2 browser tabs).

**Why.** The transfer form was the first user action that touched 2 tables with different RLS policies (worker can write `movements` but not `batches`). The naive approach (2 sequential browser-side UPDATEs) failed silently because RLS denied the second UPDATE without an error. The function approach is the only one that gives race-condition safety AND RLS bypass AND a clean error message. This is reusable beyond transfers: any TINS consumer that has a multi-table mutation will hit the same wall.

**Impact on downstream.** Future TINS consumers that need a multi-table mutation ship with the 3 lessons pre-applied. The pattern is the doc-only equivalent of `lib/<module>/` — markdown that bundles a hard-won lesson, with the code reference (`0005_record_transfer_cascade.sql`) and the validator check (`js-record-transfer-cascade`).

**Kit-level implication.** The kit's `lib/patterns/` directory is now 2 entries (this + `supabase-auth-trigger.md`). The convention is established: a pattern is a focused recipe that bundles 2-4 hard-won lessons, with a worked example from a real consumer, a validator check that pins the design, and an end-to-end test. The `lib/patterns/` layer is the kit's "gotchas" handbook — the place where a contributor goes when their migration's working but the data is wrong.

### Decision 5 — Pull forward `lib/patterns/client-side-aggregation.md` (JS-first heuristic)

**What changed.** Wrote `tins-kit/lib/patterns/client-side-aggregation.md` (~190 lines) — a heuristic for "do this aggregation in JavaScript or in a Postgres view?" with a worked example (Jayshankar's `StockBySku` component, decision 24). The pattern's three lessons:
1. The "200ms in DevTools Network" threshold (the default-to-JS rule).
2. JS aggregation is easier to spec, view aggregation is easier to enforce.
3. Aggregate the raw rows; don't ask the server to aggregate "to save bandwidth" (the common middle-ground anti-pattern).

**Why.** Most TINS consumers will need *some* aggregation (stock by SKU, sales by day, total revenue this month). The naive instinct is "do it in SQL — that's what databases are for." The instinct is right eventually, but for V1/Mode A the dataset is too small to justify the migration. The pattern is a decision rubric, not a recipe — it tells the consumer *when* to switch to a view, not *how*.

**Impact on downstream.** Future TINS consumers default to JS-side aggregation for V1, switch to a view when DevTools Network >200ms. Jayshankar's `StockBySku` (130 batches) is the worked example; a Pilot project at 10K+ batches would re-evaluate. The pattern includes the view's SQL when the consumer is ready to switch.

**Kit-level implication.** This is the kit's first *heuristic* pattern (vs. a recipe). The convention is now: a pattern can be a recipe (do X), a rubric (decide between X and Y), or a heuristic (use X when condition Z holds). All three are first-class. The `client-side-aggregation` pattern is the rubric flavour.

### Decision 6 — Pull forward `lib/patterns/pwa-offline-graceful.md` (3-layer offline)

**What changed.** Wrote `tins-kit/lib/patterns/pwa-offline-graceful.md` (~260 lines) — the canonical recipe for "make the app work offline" without building an offline write-queue. The three lessons:
1. Three layers, not one (hook + banner + form-level guard).
2. `navigator.onLine` + window events, not a fetch heartbeat.
3. The PWA service worker is the safety net, not the primary cache.

Worked example: Jayshankar's `vite-plugin-pwa` config, `src/lib/online.ts`, `src/components/OfflineBanner.tsx`, and the 4 mutation forms (decisions 26, 27).

**Why.** SPEC D6 (PWA with graceful offline degradation) is common to many TINS consumers — wholesale inventory, field inspections, inventory audits. The naive approach is to build an offline write-queue (1-2 weeks of work, subtle bugs). The pattern is a 3-file, ~80-line minimum-viable offline experience that covers the common case (read offline, write online). The write-queue is documented as the V2 upgrade.

**Impact on downstream.** Future TINS consumers that need offline get a 30-minute deploy instead of a 2-week project. The `vite-plugin-pwa` config, the hook, the banner, and the form-level guard are all copy-paste.

**Kit-level implication.** The `lib/patterns/` directory is now 3 entries. The convention is strong: each pattern has a "When this changes" section that calls out the V2 upgrade path. For PWA: the offline write-queue. For Supabase: the `supabase-js` v3 migration (when it lands). For aggregation: the Postgres view. The kit is now opinionated about the *upgrade path* of every pattern, not just the initial state.

### Decision 7 — Pull forward `lib/patterns/empty-states.md` (3-tier rubric)

**What changed.** Wrote `tins-kit/lib/patterns/empty-states.md` (~190 lines) — a 3-tier rubric for empty states: action / hint / message. The pattern's three lessons:
1. Tier 1 (action): the user can resolve the empty state — show a primary action button.
2. Tier 2 (hint): the empty state is a config issue the user can't fix — show a hint pointing to the fix.
3. Tier 3 (message): read-only viewer, nothing to do — just the message, no button.

Worked example: Jayshankar's three empty states — FloorDashboard "no active batches" (Tier 1), RepDashboard "no active vendors" (Tier 2), AuditLog "no entries" (Tier 3). The rubric is a flowchart that a contributor follows when designing a new empty state.

**Why.** SPEC §3.7 mandates a primary action button "where there is one" — but "where there is one" is the hard part. Without a rubric, every empty state becomes an ad-hoc decision. The 3-tier rubric is a flowchart with a binary decision at each step; the consumer picks a tier in 30 seconds instead of debating for 10 minutes.

**Impact on downstream.** Future TINS consumers ship a consistent empty-state UX out of the box. The rubric is reusable beyond lists (e.g. profile pages, settings, search results). The pattern's "Common mistakes to avoid" section prevents the 4 most common ad-hoc-decision mistakes (wrong action, button on a hint, hint on a viewer, generic "no data" message).

**Kit-level implication.** `lib/patterns/` is now 4 entries. The kit's pattern library is broad enough to cover the most common TINS-consumer UX surfaces: auth, multi-table mutations, aggregation, PWA, empty states. The next likely pattern (a heuristic for "client-side validation vs. server-side validation") would close the gap on forms.

### Decision 8 — Add Lesson 4 to `supabase-auth-trigger.md` (the `authenticated` GRANT)

**What changed.** Updated `tins-kit/lib/patterns/supabase-auth-trigger.md`:
- §1 header: "3 lessons" → "4 lessons"
- §1.4 added: `authenticated` ALSO needs explicit GRANTs on `public.*` (the browser-side equivalent of Lesson 3)
- §2 intro: "4 files" → "5 files" (the new file is `0003_grant_authenticated.sql`)
- §3 header: "3 lessons" → "4 lessons"
- §3 validator check added: `js-grant-authenticated` (string-match the migration for `grant select ... to authenticated`)

**Why.** The original 3-lesson version of the pattern assumed `authenticated` was "the default signed-in user" and that the GRANTs would Just Work. They don't. The first time the browser called `supabase.from('skus').select('*')`, the request returned `SQLSTATE 42501` "permission denied for table skus" *before* the RLS policy was even evaluated. The RLS layer is downstream of the GRANT layer; without the GRANT, RLS is moot.

**Impact on downstream.** Future TINS consumers that follow the pattern ship with the 4 GRANT fixes pre-applied: FK drop (Lesson 1), trigger meta (Lesson 2), GRANT service_role (Lesson 3), GRANT authenticated (Lesson 4). Jayshankar's `BUILDER-DECISIONS-REVIEW.md` is unchanged (it's the source); the kit's pattern is the canonical place where all 4 lessons live together.

**Kit-level implication.** This is the kit's first *update* to an existing pattern (vs. a new pattern). The convention for updates is: a short `BUILDER-DECISIONS-REVIEW` entry that lists the specific section changes (header, §1.4 added, §3 check added). The pattern itself doesn't get a "version 2" header — the BUILDER-DECISIONS-REVIEW is the changelog. This is the kit's "doc-only patch" discipline.
