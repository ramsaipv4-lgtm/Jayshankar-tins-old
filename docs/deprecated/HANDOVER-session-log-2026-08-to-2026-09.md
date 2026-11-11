# HANDOVER session log, 2026-08-14 → 2026-09-29 (retired from `HANDOVER.md`)

> **Status: historical. Do not read this to learn the current state** — `HANDOVER.md` §1–§5 is the live
> picture. This is the per-session diary that used to sit at the top of `HANDOVER.md`, moved here
> **verbatim** on 2026-10-02 so the live file could return to the kit's shape (header → §1 brief → §2
> environment → §3 state → §4 inventory → §5 work queue → §6 gotchas → §7 protocol).
>
> **Why it is safe to be here:** every "part" below cites numbered decisions in
> `BUILDER-DECISIONS-REVIEW.md` (#30–#90), which stays the authoritative record. Nothing in this log is
> the only copy of a decision.
>
> **What in it was still live, and where it went:** the open items (unexplained `docs/recommendations/`,
> `public/tutorials/categorized/` duplicate, the deadline, the frontend-refresh gate, three-mode
> Tamil/Tanglish/English UI, offline-conflict UX, real SKU import, Google OAuth) were carried into
> `HANDOVER.md` §5 "Backlog carried from the session log". **One statement here is wrong now:** every
> mention of a **"November 1, 2026" deadline** is superseded — Play Store submission is **1 December
> 2026**, live **15 December 2026** (`client-qa/session3/plan.md` §0A; `client-qa/truckload-procurement-
> receiving-2026-09-22.md`). Likewise "migrations 0015–0018 pending" and "`docs/recommendations/` … read it
> yourself" describe the state at the time; see the live file.
>
> The paragraphs from "Last updated" down to "Current queue position" below are the header block as it
> stood on 2026-09-29 (session 13).

---

Previous: 2026-09-29 (session 13 — deck 2 built and wired end to end; the Phase B docs landed
as a merge and the migrations were staged; `REVIEWER-DECISIONS-REVIEW.md` created with the Mode A
review; and §1–§4 of this file corrected against a live read-only probe, having been wrong about the
most basic facts)
**Last worked on by:** session 13 — see W7–W10 below for the record. Previous: session 12, part 25
(all 36 tutorial-video scenarios recorded, the `/learn` library shipped, `Jayshankar-clean` resynced
and pushed as "v1 complete"; decisions #67–#90, see that part's note about the #67–#89 gap).
**Current queue position:** W10 — publish deck 2 to GitHub Pages (W9's merge is approved but withheld
by choice; Phase B's migration apply is blocked on one credential, per W7)

**Session 12's earlier work (2026-09-10, full-directory audit + validator regression fix; see `AUDIT-2026-09-10.md` for the full writeup):** a full read-through audit of the whole workspace (this app, `tins-kit/`, `Data-cleaning-script/`, `archive/`, `client-qa/`) at the user's request, written up in full in `AUDIT-2026-09-10.md` (gitignored, not part of the public repo). Found and fixed one real regression: `npm run validate` had been silently failing (71/72) since a session-11 post-hoc, unlogged edit to `scripts/validate.mjs`'s `§8.1a` marker check (it required `<!-- Jayshankar Specification v1.0 -->`, a string never present in `SPEC.md`, instead of the kit's actual `<!-- TINS Specification v1.0 -->` convention); `scripts/selftest.mjs` had the matching drift. Reverted both — see decision #30 in `BUILDER-DECISIONS-REVIEW.md` for the full root-cause writeup. Confirmed green: validate 72/72, selftest 9/9. Also relocated the two unrelated side-projects flagged by the audit — `Data-cleaning-script/`
and `archive/atal-incubation-reference/` — into a new `_external/` folder (gitignored, not
deleted, just moved) per the user's explicit instruction not to clean them up, only keep them
out of git tracking; `archive/exam-forge-reference/` was left in place since `AGENTS.md`'s own
onboarding table still points there. `git init` run this session, first commit made
(`1c17d5f`, 63 files — matches what the audit said should/shouldn't be tracked). Everything else
in the audit (Mode A code review, Mode B/`SPEC-AMENDMENT-v2.md` implementation-status check,
`tins-kit` state, side-project inventory) found no other code defects, only documentation
staleness — see the audit doc for details, don't duplicate it here.

**Same session, part 2 (after the user copied an updated `tins-kit/` in):** the new `tins-kit`
turned out to carry a full delegation/auditor/worker system (D29, D32-D36 — see `tins-kit/
HANDOVER.md` and `tins-kit/SPEC.md` §0.2). Bootstrapped it for this project's real setup —
Claude (planner + auditor, in WSL2) plans and audits, **MiniMax M3 via the MiniMax Coder desktop
app (native Windows) builds** — recorded as `self-parallel` mode (MiniMax Coder has no CLI hook
for `auditor-remote`'s scripted dispatch) but using a `WORKER-SESSION.md`-shaped tight brief
instead of the mode's normal generic hand-off, since MiniMax M3 is the cost-optimized leg on
purpose. Full reasoning, the WSL2-vs-Windows environment gotcha (shared `node_modules` is
platform-specific — whoever runs `npm install` last determines which OS's native binaries are
present), and the round-by-round flow are all in `delegation/README.md` (gitignored, like
`SPEC.md`/`HANDOVER.md`). Also added `TOOLING-AUDIT.md` (root, gitignored) per the kit's D33 gate.

**Same session, part 3 (T1 ran end to end):** picked a small trial task on purpose — `Floor
Dashboard.tsx`'s Location column showed raw short names instead of friendly display names.
MiniMax M3 built it correctly (one file, matched the existing pattern in `RecentActivity.tsx`
exactly); Claude audited independently (re-ran the gate, didn't trust the self-report, visually
confirmed via a screenshot after signing in as the worker demo user) and integrated. **The loop
works.** It also caught the cross-platform `node_modules` risk for real, not just in theory —
MiniMax's Windows-side `npm run build` left Windows-only native binaries in the shared
`node_modules`, breaking the WSL2 dev server until `npm install` was re-run there. Full record:
`BUILDER-DECISIONS-REVIEW.md` decision #31, `delegation/tasks/T1-floor-location-display-name/`.
`TOOLING-AUDIT.md` is now `complete` (both rows independently confirmed, not just self-reported).
Two follow-up candidates are logged but **not queued**: T2 (`AdminDashboard.tsx` has the same
gap T1 fixed, but latent/invisible right now, lower urgency) and T3 (`FloorDashboard.tsx`'s
Expires column is separately always blank — a different missing-column bug, found during T1's
audit, not by MiniMax). A trivial pre-existing `typecheck` failure (unused import in
`RecentActivity.tsx`) was fixed directly during integration, unrelated to T1 — worth deciding
later whether `typecheck` should join the actual gate (`validate` + `selftest`) since neither of
those catches it and it went unnoticed for a while.

**Same session, part 4 (T2 + T3 ran; T3 found a real bug the loop was built to catch):** T2
(`AdminDashboard.tsx` display_name) integrated cleanly, no surprises — full `display_name`
rollout across all 5 `locations`-query files now complete. **T3 is the more important one to
read.** MiniMax's fix (add `shelf_life_hours` to `FloorDashboard.tsx`'s `skus` query) was
correct and the gate was green, but the Expires column was *still* blank on the independent
visual check. Root cause: a pre-existing TanStack Query `queryKey` collision — 5 components
share the literal key `['skus']` with 3 different `select` shapes, and `RecentActivity.tsx`'s
narrower query was silently winning over `FloorDashboard.tsx`'s own. Checked whether this was
live elsewhere too: **it was** — `AdminDashboard.tsx`'s "Shelf life (hrs)" column has been
showing `—` for all 25 SKUs for a while, same root cause, unrelated to this session. Auditor
fixed both (distinct query keys), re-verified with real screenshots (dates now render on Floor,
hour counts now render on Admin). Full writeup: `BUILDER-DECISIONS-REVIEW.md` decision #34.
**Not fixed, logged only:** the same collision risk still exists for `FormFields.tsx`/
`RepDashboard.tsx` (currently harmless by coincidence of matching shapes) — a real
architectural cleanup (one canonical `skus` query hook), not queued as a task.

**Same session, part 5 (T4 ran — round complete, 4/4 integrated):** `scripts/check-contrast.mjs`
built cleanly by MiniMax, zero discrepancies on independent re-verification (the first task this
round with none) — closes the WCAG-check gap flagged in decision #32. Confirms 3 real, live AA
failures in this app's actual colors (`text-slate-400`, `text-slate-300` against light
backgrounds) — detected, not yet remediated. Full record: `BUILDER-DECISIONS-REVIEW.md` decision
#35, `delegation/tasks/T4-contrast-checker/`.

**Round status: T1–T4 all `integrated`, `delegation/LEDGER.md` has no `assigned`/`proposed` rows
left.** The loop validated itself across 4 real tasks and caught one genuinely non-trivial
pre-existing bug (decision #34's `queryKey` collision) that a surface read of a diff plus a green
gate would have missed — this is the concrete case for why the audit step does an independent
visual/functional check rather than trusting a worker's self-report.

**Same session, part 6 — SPEC.md is now v2 (Mode B merged in).** A long scoping conversation
surfaced real operational facts (one warehouse, no display/freezer, worker offline-write need
confirmed, no-price-broadcast rule, single-app mobile decision backed by real research, container
model provenance + a scaling caution) — all captured in `client-qa/operational-reality-2026-09-10.md`
— then folded into `SPEC.md` alongside `SPEC-AMENDMENT-v2.md`'s D18–D27, reconciling both against
reality rather than merging blind. Four new locked decisions (D28–D31), §9 substantially revised
(most "out of scope" items moved into scope), all of §2/§4/§8 extended for the Mode B feature set.
`SPEC-AMENDMENT-v2.md` is now marked superseded/historical. `npm run validate` confirmed green
(72/72) after the merge. Full record: `BUILDER-DECISIONS-REVIEW.md` decision #36. **Not done in
this pass:** no code touched (spec-only, correctly), no delegation tasks created yet — that's the
deliberate next step, sequenced after the spec so task briefs derive from the final locked
version. `SPEC.md`'s own new closing §D lists what's still genuinely open (box quantities, GST
status, credit terms, second-warehouse timing, a **Tanglish UI possibility — raised as "maybe,"
not locked**) — don't resolve these by guessing, they're waiting on the user/client.

**Same session, part 7 — container model schema (migration 0006 + RLS) written.** Container
model build started per `AGENT-BRIEF.md` §3's order. `supabase/migrations/0006_container_model.sql`
(warehouses, bills, containers, container_fills, container_fill_items, plus column/constraint
additions to locations/batches/movements) and an updated `supabase/rls-policies.sql` (co-admin
added to every existing admin policy — required for D28 to actually work; movements' INSERT
policy rewritten per-kind for D29's transfer/repack changes; new policies for the 5 new tables).
Written directly by the auditor, not delegated — the one deliberate exception to this session's
MiniMax pattern, since this changes live schema. Full record: decision #37. **Not yet applied**
— no direct DB connection from this environment; needs the user to run it via the Supabase
Dashboard SQL Editor, same as 0001–0005. `npm run validate`/`npm run selftest` both green against
the file content (structural only, doesn't prove live correctness).

**Same session, part 8 — migration 0006 applied+confirmed; migration 0007 (`record_container_fill`)
written, applied, and covered by a real live test before being called done.** User ran
`0006_container_model.sql` + updated `rls-policies.sql` in the Supabase SQL Editor — confirmed via
extended `scripts/probe-db.mjs` (all 14 tables, all 3 new columns, `warehouses` seeded, everything
else empty, no pre-existing Mode A data disturbed). Then wrote `supabase/migrations/
0007_record_container_fill.sql` (`compute_container_fill_expiry` helper + the `record_container_fill`
receiving-side RPC, §4.3.7) and `scripts/test-container-fill.mjs`, a live test that signs in as the
real demo admin/worker users (not the secret key — `current_user_role()` needs a real `auth.uid()`)
and exercises 6 cases. First live run caught a real bug: 3 error messages used printf-style `%.3f`/
`%.2f` in Postgres `format()`, which only supports `%s`/`%I`/`%L`/`%%` — fixed, re-applied via
`CREATE OR REPLACE FUNCTION` (no new migration number needed), re-ran, 14/14 passed. Full record:
decision #38. **A real schema gap found and deliberately not fixed here:** `record_repack` (next
up) needs `movements` to reference *both* a source and destination `container_fill_id`, but
migration 0006 only added one column — flagged as a small follow-up migration, not improvised
around.

**Same session, part 9 — migration 0008 (`record_repack`) written, applied, tested; two more real
bugs found in already-shipped 0007 before either migration was called done.** Closed the
`movements` source/destination `container_fill_id` gap from part 8 (`destination_container_fill_id`
added; `container_fill_id` keeps its existing "drawn from" meaning, documented as a `SPEC.md`
§4.2.21 addendum, not silently reinterpreted). `record_repack` verified live via
`scripts/test-container-repack.mjs`, 28/28 passing — including confirming, by reading the DB back
directly, that `filled_at`/`expires_at` copy byte-for-byte from source to destination and
`batches.kg_remaining` is provably untouched. Along the way found and fixed two more bugs in 0007:
(1) `record_container_fill` never checked whether a batch's kg was already packed into a *different*
container (packing doesn't decrement `kg_remaining`, so two separate calls could each validate
independently and double-allocate the same physical fish) — fixed with a guard summing
`container_fill_items.kg` per batch; (2) that guard then double-counted kg that had moved through a
repack, since `record_repack` correctly *copies* `container_fill_items` onto its destination —
fixed with `container_fills.is_repack_copy` to exclude copies from the sum. A third issue was a
process question, not a test failure: the user asked whether a fresh database just runs migrations
0001→0008 in order — it would have broken at 0007, since an earlier version of this fix declared
`is_repack_copy` in 0008 (where it's *set*) rather than 0007 (where it's *read*), a real
filename-order dependency bug. Fixed by moving the column declaration into 0007; no live re-run
needed since the column already existed on the already-applied database either way. Full record:
decision #39. **The worker gets real delegated work again now** — wiring `SaleForm.tsx`/
`SpoilageForm.tsx` to the container-aware RPCs and a new repack UI screen is genuine
frontend/application code with no schema risk, unlike everything since decision #37.

**Same session, part 10 — T6 (repack UI screen) delegated, returned, integrated clean.** First
task since T4 with no auditor-side code fix needed. Independently re-verified the same way as
every prior task (fresh `npm install`, all 3 gates re-run) plus a live-data shape check per
lesson 2's discipline: seeded a real container fill, hit PostgREST with the exact queries
`SourceFillSelect`/`AvailableContainerSelect` use, signed in as the real worker role — confirmed
MiniMax's `as unknown as` cast is actually correct at the runtime level (not just plausible) and
that RLS genuinely lets a worker populate both dropdowns (a blocked read would look identical to
"no data yet" from a diff alone). Found and cleaned up 13 leftover test containers from this
session's own earlier debugging runs — not a T6 defect, but would've cluttered the real
destination dropdown. Full record: decision #40.

**Same session, part 11 — §4.3.8 (container-sourced sale/spoilage FIFO) built, live, tested.**
`record_container_sale`/`record_container_spoilage` (migration 0009) — the most intricate
function in this project so far. A real two-phase cascade: container-tracked stock first
(soonest-`expires_at`-first), falling back to the older direct-batch FIFO for whatever isn't
packed yet, correctly handling a fill that holds multiple SKUs (derives per-(fill,batch)
remaining rather than reading the fill's aggregate `kg_remaining`) and a batch that's only
partially packed (the fallback excludes whatever's currently sitting in a container, so nothing
gets sold twice through two paths). Deliberately upgrades past decision #18's "W3: single-batch
fill" scope to a real multi-row cascade, since §4.3.2/§4.3.4/§4.3.8 always described one and
decision #18 only ever deferred it. Verified live: 42 assertions covering multi-fill cascade
ordering, mixed-SKU isolation, the container/direct split, partial-fulfillment shortfall
reporting, zero-stock, the sale/spoilage role split, and cross-call double-sell prevention. One
test assertion was itself wrong on the first run (checked a real demo SKU's historical movements
that predate this test) — fixed; the RPC was correct throughout. One known, narrow, deliberately
unfixed race condition logged in §6 below. Full record: decision #41.

**Same session, part 12 — T7 (sale/spoilage rewire) delegated, returned, integrated clean.**
Second task in a row (after T6) needing no auditor-side code fix. `recordSale`/`recordSpoilage`
now call `record_container_sale`/`record_container_spoilage` entirely; the old client-side
single-batch FIFO is gone. Went beyond diff review the same way as T6: since the cascade logic
itself is already covered by 42 assertions (decision #41), what actually needed live proof was
the new glue code (JS-to-RPC param mapping, response-to-message rendering) — ran a script
mirroring the exact new function bodies and message logic against the live database, confirming
both the split-message and no-split success-message paths render the precise text a user would
see. Full record: decision #42.

**Container model core algorithms and their frontend wiring are now complete**: receiving,
repack, sale/spoilage — all live, tested, and wired into the UI. Only the C.4
transfer-timestamp fix (§4.3.10) remains from the original amendment.

**Same session, part 13 — C.4 transfer-timestamp fix (§4.3.10) built and tested, closing out
the container model amendment.** `record_transfer_cascade` (0005) fixed: destination batch's
freshness timestamp now carries through from the source (`container_fills.filled_at` when
container-tracked, the source batch's own `delivered_at` otherwise) instead of resetting to
`now()`. Also closes a real, independently-found gap (no internal role check, flagged since
decision #38) and a fresh double-allocation risk this same change would have introduced (transfer
becoming a third consumer of container-tracked stock meant 0009's "already drawn" checks needed
`'transfer'` added to their kind filters, or a transfer's draw could look double-available to a
later sale). Deliberately kept single-source-draw rather than upgrading to a full multi-batch
cascade (unlike decision #41's sale/spoilage upgrade) — transfer is still dormant and the
vendor-attribution rule is already flagged as provisional, not worth heavier machinery yet.
User explicitly asked to build and test this now: since a *permanent* second warehouse would
misrepresent the business's real single-warehouse state, the test creates one temporarily,
exercises the fix (26 assertions, including the cross-cutting fix), and deletes it in cleanup —
confirmed independently afterward that `warehouses` shows exactly the one real `main` row. Full
record: decision #43.

**The container model amendment (SPEC-AMENDMENT-v2 §C) is now fully built, live, and tested end
to end**: receiving, repack, sale/spoilage, transfer. What's left is genuinely open, not
deferred out of caution — see decision #43's closing note.

**2026-09-11, part 14 — the §D open-items batch answered; D32 (container quantities) built and
verified; Capacitor scaffolded; T8 dispatched.** User answered essentially all of the decision
list from part 13 in one message:
- **Container quantities (D32, resolved):** wholesaler-entered, individually-numbered
  containers registered in bulk, custom sizes allowed, delete blocked once ever filled. Built as
  migration 0011, verified live under real RLS (not just applied) — see decision #44.
- **GST / credit terms:** turned up a real gap while grounding these — `customers`, `payments`,
  `reversal_requests`, `notifications`, `user_role_history` are all fully designed in `SPEC.md`
  §4.2.16–4.2.20 but **none have ever been migrated**. GST's `is_gst_registered`/`gstin` fields
  already live on the designed-but-unbuilt `customers` table; credit terms' outstanding-balance
  math (`total_amount - sum(payments)`) is already designed on the unbuilt `payments` table. Both
  blocked on the same next step: migrating that schema.
- **Second-warehouse timing:** informational only, no action, as recommended.
- **Tanglish UI:** scope grew — user wants three modes (Tanglish/English/pure Tamil), not a
  binary choice. Real i18n work, deliberately not started yet — its own dedicated pass.
- **Staff follow-up verification:** stays unsolved per its own spec framing; user added a
  cheap partial mitigation (a manual "on this task" toggle) worth folding into worker UI design
  later, not urgent alone.
- **Offline-write conflict UX, multi-batch transfer cascade, tins-kit sync:** offline-conflict UX
  to be designed alongside the Capacitor/mobile work; transfer cascade and tins-kit sync both
  deferred, as recommended.
- **T1–T4-round housekeeping (WCAG fix, wiring the contrast checker into the gate, the
  `RepDashboard.tsx` `queryKey` collision — a genuine second occurrence of decision #34's bug
  class, confirmed by inspection before writing the brief — and `typecheck` joining the gate):**
  bundled into **T8**, dispatched to MiniMax. `delegation/tasks/T8-contrast-and-cleanup/
  WORKER-PROMPT.md`.

**Capacitor (D18) scaffolding started, per explicit user instruction to begin now.**
`@capacitor/core`/`cli`/`android` installed, `capacitor.config.ts` added, `npx cap add android`
scaffolded the native project (confirmed correct — `applicationId`/`versionCode` match config,
not just command-exit-0), `npm run cap:sync` works end to end. No Java/Android SDK/Gradle exist
in this WSL2 environment (checked directly) — matches this project's whole WSL2-plans/
Windows-builds pattern, so actually compiling/running/signing needs Android Studio on the
Windows side, where the shared project folder (`C:\Users\user\Desktop\Jayshankar\android`) is
already visible with no extra step. Full record: decision #45.

**Same session, part 15 — migration 0012 (customers/payments/reversal_requests/notifications/
user_role_history) built and verified; the co-admin fix.** All 5 tables built exactly to
`SPEC.md`'s pre-existing design, schema only (the payment/reversal/notification algorithms are
separate, deliberate follow-up work, same split as the container model). Found and fixed a real,
previously-undiscovered gap while touching users-adjacent schema: `co-admin` (D28, full admin
capability) has never actually been settable — `users.role`'s CHECK constraint never included
it since migration 0001, despite every RLS policy since decision #37 assuming it works. Fixed
(the constraint, and `handle_new_user()`, which independently rejected it too). Verified live
with 23 assertions, including promoting a real temporary auth user to `co-admin` and confirming
an admin-gated RLS action actually succeeds for them and still correctly fails for a worker — not
just that the constraint allows the value. Also surfaced (not caused by this migration) that
every demo account has two `public.users` rows — see §6 gotchas. Full record: decision #46.

Android Studio setup instructions given for the Windows side (Capacitor scaffolding from part 14
is ready to open there); user working through first build/run.

**Same session, part 16 — first real-device test (Poco X6 Pro): sign-in works end to end; found
and fixed 3 bugs invisible in web/PWA testing.** `StockBySku.tsx` clipped its "By location"
column (plain `overflow-hidden`, no scroll container — fixed with a nested `overflow-x-auto`
wrapper). `AuditLog.tsx` was the one page missing the `<FormFooter>` back-link pattern every
mutation form already has. Deeper cause behind the same symptom: `@capacitor/app` wasn't even
installed, so the Android hardware/gesture back button was never wired to the app's navigation
at all — a web/PWA build relies entirely on the browser's own back handling, which a native wrap
has none of. Installed it, wired the documented `canGoBack` pattern in `App.tsx`, guarded behind
`Capacitor.isNativePlatform()` so it's a no-op on web. Confirmed the plugin registered correctly
in the native project; the actual behavior is the user's own device to confirm next, same
handoff shape as the rest of the Capacitor thread — nothing about this is testable from WSL2.
Full record: decision #47.

Second-device install failure (Poco X5 Pro, "package appears to be invalid") diagnosed as almost
certainly a corrupted transfer (sharing the `.apk` through a chat app), not a build problem — it
installed clean on the X6 Pro from the same build. Recommended re-transferring via USB/cloud
link, or just running directly from Android Studio onto the second device too.

**Same session, part 17 — real-device fixes confirmed working (Poco X6 Pro: SKU table now
scrolls); the X5 Pro install failure confirmed as a transfer/corruption issue, not a build
problem (installed clean once run directly from Android Studio). Migration 0013 (credit terms,
D33) built and verified live, 15 assertions.** `customers.credit_limit`/`credit_period_days` +
a derived `customer_credit_status` view, soft enforcement only (the sale-recording RPC is
untouched, matches D25's existing philosophy). Full record: decision #48. GST's backend work
was already complete as of migration 0012 — nothing further needed there until the frontend
(entry UI, invoice rendering) gets built.

Also confirmed: this project's Android build has no ABI-split configuration anywhere, so a plain
`.apk` build (not a Play Store App Bundle) is already universal — installs on any device
architecture with zero extra config. User wants a shareable universal `.apk` for an early
progress build to send the client via a GitHub Releases link (not a Play Store submission — V1
isn't done). Standard Android Studio `Build → Build APK(s)` output.

**Same session, part 18 — real client feedback relayed via a phone call transcript acted on
directly.** Built `SkuManagement.tsx` — the first UI this app has ever had for creating/editing
a SKU, backend was already ready. Deliberately simple per the client's own words (5 fields up
front, everything else defaulted and tucked behind "More settings," auto-generated `code`, never
typed by hand). Confirmed live that the auto-retry-on-collision logic's core assumption
(Postgres returns `23505` for the unique violation) actually holds. Confirmed the "who changed
what" ask is already met by the existing audit log — no work needed there, just worth
demonstrating to the client.

**A real, significant gap found while building the SKU screen, fixed alongside it:** `Role`
(frontend) has never included `'co-admin'` — every `/admin/*` route, `defaultRouteFor`,
`homeFor`, and `RoleBadge`'s style/label maps only ever recognized `'admin'`. A real co-admin
user (made settable in the database for the first time this session, decision #46) would have
been completely unable to use the app's UI at all. Found systematically: adding `'co-admin'` to
`Role` turns every affected spot into a compiler error via `Record<Role, string>`, so `tsc` was
run immediately as the authoritative checklist rather than trusting a manual grep alone. Fixed
all 4 compiler-caught spots, wired co-admin into every admin route, gave it its own badge color.
Full record: decision #49.

**Google OAuth discussed, not built** — user wants it for the next client-facing version (serves
both "real login" and "no password to manage"). Blocked on the user completing Google Cloud
Console + Supabase provider setup (both manual, external-console steps, instructions given).
Flagged the real Capacitor-specific gotcha ahead of time: a naive in-WebView redirect would be
rejected by Google's anti-embedded-WebView policy; the correct approach uses the system browser
+ a deep-link redirect, not a plain in-page one.

Also: user confirmed a universal `.apk` build was correct as suggested (no ABI-split config
exists in this project) and is sharing a progress build with the client via GitHub Releases.

**Same session, part 19 — the "1st warehouse setup workflow" the user flagged as missing,
addressed, with a clear split on what's actually solved.** `WarehouseManagement.tsx` (add/edit
warehouses — only one has ever existed, seeded directly by migration 0006, no way to add a
second without raw SQL until now) and `TeamManagement.tsx` (change an existing user's role or
turn their access off — the backend has supported this since decision #46, no UI existed).
Verified live, 8 assertions.

**Explicitly NOT solved, and said so directly rather than leaving it implied:** creating a
brand-new user who has never signed in before. That needs a real `auth.users` row, which needs
the service-role/secret key, which must never reach the client (`SPEC.md` §4.1) — the correct
fix is a Supabase Edge Function, which this project has never built (no `supabase/functions/`
exists). Explained clearly to the user, including that `inviteUserByEmail` depends on Supabase's
own email deliverability at this account's tier — not started, waiting on the user's decision to
proceed. Full record: decision #50.

**Same session, part 20 — D34 + §4.3.12 written and locked before any Edge Function code, at
the user's explicit instruction to document first.** Specifies the user-invitation workflow in
full: caller verification via their own JWT (reuses the existing RLS boundary rather than a new
hand-rolled check), a service-role client constructed only inside the function and never
returned/logged, and confirmation that the existing `handle_new_user()` trigger needs no changes
to pick up the result. One self-caught correctness fix along the way: an early draft misquoted
§4.1 (recalled from `HANDOVER.md`'s gotchas instead of read fresh) — checked and corrected
before finalizing, not after. Also closed a small pre-existing gap while in the area:
`@capacitor/app` (decision #47) had never been logged in §4.4's dependency table despite
AGENTS.md's own rule requiring it. Full record: decision #51.

**Same session, part 21 — `invite-user` Edge Function + the invite form built, directly against
§4.3.12, no improvisation.** This project's first Edge Function. Cannot be verified live from
this environment — no Supabase CLI in WSL2, and unlike a SQL migration an Edge Function has to
actually be deployed before it exists to call at all. `typecheck`/`validate`/`cap:sync` all
clean. Deployment instructions (Supabase Dashboard's Edge Functions UI, no CLI required) given
to the user next; live testing (including whether the invite email actually arrives) follows
once deployed. Full record: decision #52.

**Same session, part 22 — the invite mechanism deployed, broke, root-caused, and confirmed
working end to end by a real human on a real device (D34–D40); T8 landed and audited (decision
#60); `tins-kit` fully reconciled across all 3 known locations; then, on the user's explicit
"lets sprint to v1," the CRM frontend gap closed (decisions #61–#63).** In order:
- **Invitation, taken from "specified, awaiting deployment" (part 21) all the way to confirmed
  working.** The user redirected the phone path mid-build: not D35's OTP design after all, a
  simpler "graceful degradation" — same link-and-password shape as email (D37). A real invite
  link, clicked for real, then exposed two problems neither the email nor phone path had hit
  yet: no page in the app ever handled an invite link at all, and Supabase's own redirect
  collides with this app's hash routing (D38 — fixed with an app-owned `#/accept-invite` route
  calling `verifyOtp` client-side). The token then failed `otp_expired` on the phone path only —
  root-caused, not guessed at, by isolating the working email path against the failing phone
  path side by side: a second write to the account (`updateUserById`, attaching the phone)
  *after* `generateLink` was silently invalidating that link's own token (D40 — fixed by setting
  both identifiers in one `createUser` call, then never mutating the account again). Also folded
  in from direct user feedback: country codes removed from every phone-facing screen
  (`normalizeIndianPhone()`, D39 — this app has exactly one client, always Tamil Nadu, always
  `+91`), sign-in collapsed from two method tabs to one auto-detecting field, "remember me"
  confirmed already correct (existing Supabase client config, not rebuilt). **Confirmed working
  end to end by the user, twice** — first a failure video, then after the Edge Function's
  Dashboard editor turned out to still hold pre-D40 code (redeploy alone doesn't re-paste new
  source), a success video. Full record: decisions #51–#59.
- **T8 (contrast/queryKey/typecheck-gate housekeeping, dispatched to MiniMax) landed and
  audited, one real gap found independently before committing** — `TeamManagement.tsx`, built
  after T8 was dispatched, still had a live `text-slate-400` T8's own new comment claimed didn't
  exist anywhere in `src/`; re-grepped rather than trusted, fixed before committing. Decision #60.
- **`tins-kit` reconciled across all 3 locations this project touches or connects to** — this
  project's own vendored copy, the peer Claude session's copy (`class-fun-ef`, a separate
  project, coordinated via `SendMessage`/`ListAgents`), and the canonical root at
  `atal-incubation/tins-kit/`, discovered this session to be a fourth, more authoritative
  location than either vendored copy. 6 real bugs fixed in `private-to-public.mjs` (path-escape
  scoping, bare-word false positives, script-only files no longer copied verbatim, a
  `CONTENT_REWRITES` mechanism, and — found the hard way, mid-session — 5 hand-authored docs that
  a blanket include pattern was silently clobbering on re-run). `selftest.mjs` grew 51→56, all
  green. Not part of this app's own work queue, but real infrastructure this project depends on.
- **"lets sprint to v1" — the CRM frontend gap.** An audit (not assumed from the schema) found
  `customers`/`payments`/`reversal_requests`/`bills`/`notifications` — the entire CRM layer built
  in Mode B, migrations 0012–0013 — had zero frontend usage anywhere: no page, no query, in any
  file. Closed in priority order: **Customers** (list/add/edit, `CustomerManagement.tsx`) →
  **Payments** (`PaymentManagement.tsx`, per-sale balance computed client-side, no RPC needed) →
  **Reversals** (`ReversalRequests.tsx` + new RPCs `record_container_sale`'s `p_customer_id`
  param, migration 0015, and `execute_sale_reversal`, migration 0016 — the execution algorithm
  §4.3.11 always specified but 0012 deliberately left unbuilt) → **Notifications**, scoped
  deliberately to the one rule SPEC.md actually locks (§4.3.11 step 2's admin-notified-regardless
  clause; migration 0018's `notify_admins()`, `NotificationBell.tsx`). **A real spec deviation
  caught mid-sprint, before anything touched the live database:** the reversal-request flow's
  first pass used a plain client insert defaulting to `status='requested'` always, missing that
  a `can_self_reverse` requester's own request auto-approves *at creation*, server-side — fixed
  same session (migration 0017's `request_sale_reversal` RPC) before it ever reached a live
  install. Full record: decisions #61–#63; SPEC.md D41–D42.
- **Bills is explicitly NOT started, and is a different kind of gap from the rest of this
  sprint** — deliberately, not an oversight. Every other CRM piece was additive (a new page, a
  new optional column, a new RPC alongside an existing one). Bills is not: nothing anywhere,
  including the existing, already-tested `record_delivery` flow, ever creates a `bills` row —
  §4.3.7 step 1 says the delivery flow "already does" this, but checked directly against
  `DeliveryForm.tsx`/its RPC and confirmed it doesn't. A real Bills UI means retrofitting the
  core delivery-recording path (single-SKU-at-a-time today) toward something closer to §4.3.7's
  actual multi-line, vendor-bill-first shape — an architecture change to an already-live, already
  -tested flow, not a new independent screen. Flagged for the user rather than started
  unilaterally.
- **Migrations 0015–0018 are all still pending** — written, read back line-by-line, typechecked/
  validated/built clean (73/73 the whole way through), but **not yet applied to the live
  Supabase database**. Next real step: the user runs them via the Dashboard SQL Editor, in order,
  then a live test of `record_container_sale` (with `p_customer_id`), `request_sale_reversal`,
  and `execute_sale_reversal` — the same "never trust a clean `validate` run alone" discipline
  every other RPC in this project has gone through.
- **Correction to part 21's own note, found by asking the peer session directly rather than
  re-guessing:** the reference walkthrough video is on this project's own machine, not the peer
  session's D: drive — `C:\Users\user\Desktop\Jayshankar\example-video\Best B2B Product Demo
  Video _ Software Walkthrough _ Animation Video Production for Enterprise SaaS.mp4`. The
  HyperFrames-video and Puppeteer/UI-check workflows the user asked to relay both turned out to
  belong to the peer session's own project (EduPlay), not this one — not something to act on
  here. Still gated on V1 completion regardless.

**Same session, part 23 — the Bills question from part 22 answered ("start working on bills as
well"), plus a large new search feature proposed and scoped, both built.** `record_bill_delivery`
(migration 0019) replaced the old no-bill, one-SKU-per-call `recordDelivery`; `DeliveryForm.tsx`
is now a repeatable-line form. `record_container_fill` (migration 0007, zero frontend usage
since Mode B) finally got one — `PackContainerForm.tsx`, inherently bill-scoped since
`container_fills.bill_id` is NOT NULL. `BillsManagement.tsx` lists bills and lets admin mark one
shared back to a vendor. Separately, the user proposed a much larger "Pokemon-card" search
feature (fish/employee/vendor/customer cards, employee hours/tasks/ratings/pay, vendor quality
ratings, message templates, complaints) and explicitly invited more suggestions — rather than
guess at a brand-new feature area's scope, asked two direct questions first: employee "money
due" stays admin-entered (no payroll math), and a vendor-credit mirror (`vendor_payments`/
`vendor_credit_status`, migration 0020, symmetric to the customer-side one) gets built now.
Built phase 1 on that answer: client-side fuzzy search (`Fuse.js`, `src/lib/search.ts` — these
identity tables are small enough for a single-warehouse wholesaler that this beats a Postgres
extension) plus `FishCard`/`CustomerCard`/`VendorCard`/`EmployeeCard.tsx`, almost entirely built
from data that already existed (current stock, purchase history, credit status, full sale-to-
vendor-to-employee traceability). Employee check-ins/tasks/ratings, vendor quality-per-fish
ratings, message templates, and complaints are explicitly NOT built — suggested by this session,
never confirmed as wanted beyond the two questions actually asked; `EmployeeCard.tsx` says so
visibly rather than quietly looking finished. Full record: decisions #64–#65, SPEC.md D43–D44.

**Same session, part 24 — migrations 0015–0021 all applied and live-verified for real; the V1
sprint's backend is done.** Every new/changed RPC was exercised against the live database,
signed in as the real demo rep/admin accounts (not the service-role key, so the RPCs' own
`auth.uid()`/role checks actually get exercised) — 33/33 checks across `record_bill_delivery`,
`record_container_fill` (its first-ever live call), `record_container_sale` with
`p_customer_id`, both `request_sale_reversal` paths, `execute_sale_reversal` (verified
`batches.kg_remaining` actually increased by the exact reversed amount), and `vendor_payments`/
`vendor_credit_status`. Found one real bug in the process — `record_container_fill` registered a
real container before validating pack items, so a rejected pack left a phantom "available"
container behind — fixed forward in migration `0021` (0007 was already live, so fixed forward
per this project's own convention, not edited in place) and confirmed live with 7 more checks:
the same overshoot attack now creates zero container rows, and a valid pack right after still
works. All test rows cleaned up both times, verified empty; `audit_log` deliberately left
untouched (immutable, no DELETE policy for any role, by design). Full record: decision #66 and
its same-day addendum.

**Also this part — the frontend-refresh conversation, logged not started.** The user asked
about overhauling the visual frontend once V1 testing is done, using client-supplied design
references (palette, fonts, animations, panel layouts). Discussed and logged, not acted on:
`tins-kit/prompts/FRONTEND-REFRESH.md` is the right workflow (confirmed neither it nor its
vision interview has ever been run for this project — no `FRONTEND-VISION.md` exists), its 5
reference libraries are all free/open-source with zero ongoing cost, and both its sign-offs
(`approved_before`/`approved_after`) are deliberately human, not automated. Added one idea beyond
the kit prompt itself: publish a small style-preview Artifact (palette/fonts/sample components,
no real data) before touching the real app, so the client can react to something visual, not
just a text spec. See [[jayshankar-frontend-refresh-plan]] (memory) — gated on the user saying
V1 testing is done, not queued work yet.

**Queue now:** regenerate `Jayshankar-clean` now that the backend is confirmed live (not just
statically gated) and push/redeploy → decide whether to continue the search feature into phase 2
(employee attendance/tasks/ratings, vendor quality ratings, message templates, complaints — all
still open questions, not queued work) → the frontend refresh (gated on the user saying V1
testing is done) → offline-conflict UX (alongside ongoing Capacitor/mobile work) →
Tanglish/English/Tamil UI (its own dedicated pass). Real SKU data import is still blocked on the
user gaining access to the client's Google Sheet (pending, no ETA) — not blocking anything else.
`example-video/*.mp4` files are in `.gitignore` — resolved, not an open question.

**Queue position (updated 2026-09-12, part 24):** `SPEC.md` now has D34–D44 locked since part
21's D32–D34 snapshot — the full invitation mechanism (D34–D40), India-only phone UX (D39), the
CRM-sprint pieces (D41 customers/payments/reversals, D42 notifications, D43 bills/container-
packing, D44 search phase 1). Migrations run through 0021 — **all of them live and independently
verified**, not just statically gated. Decisions #51–#66 cover this window in full. Capacitor/
mobile-app work (the November 1 deadline) has not moved this session — this window was entirely
invitation-mechanism, housekeeping, kit reconciliation, and the CRM/search sprint. Still open:
hard deadline **November 1, 2026** for a working mobile app (Zoho-comparable UI); search phase
2's scope (above); the frontend refresh (logged, gated on V1 testing being declared done); the
HyperFrames walkthrough-video idea (explicitly gated on V1
being complete, not started, and — per the correction in part 22 — not something the peer
session is building for this project).

**Part 25 — migrations 0030–0036 landed live (in-transit locations, receiving confirmation,
self-reverse restriction, bill reconciliation, a real spreadsheet import, a frontend/backend
parity sweep); then, on explicit go-ahead, the full 36-scenario tutorial-video library built and
shipped as an in-app "Learn" page; `Jayshankar-clean` resynced and pushed. Logged retroactively
— see the note below on why.** In order:
- **D52–D59 built and live-verified**: force-reassigned orphaned tasks on a role change;
  in-transit inbound/outbound locations auto-provisioned per warehouse; `receiving_confirmations`
  (spec'd since Mode B, never built) with a promised-vs-measured discrepancy split;
  `can_self_reverse` restricted to admin/co-admin with a DB trigger enforcing it regardless of
  call path; bill reconciliation as a genuinely separate field from the vendor's own promised
  total (physical stock adjusts to what's measured, the bill amount is a human decision, never
  auto-derived); the real client spreadsheet imported into a third, clearly-labeled provisional
  warehouse; a full frontend/backend parity audit that closed a real gap (`VendorManagement.tsx`
  had backend support since migration 0001 with zero UI, ever). A live reseed bug (leftover
  `container_fills` from an incomplete cleanup) and a real, previously-shipped bug
  (`confirm_delivery_arrival` never set the NOT-NULL `movement_group_id` on its own movement
  rows) were both found and fixed live, not just in review.
- **All 36 planned tutorial scenarios recorded as real Playwright screen recordings** (never
  screenshots) — the 6 multi-step composites first (per explicit instruction), then the
  remaining 28 single-action scenarios, category by category. Every scenario verified against
  the live database afterward. Several real, non-obvious bugs found and fixed in the recording
  pipeline itself (a button mis-assumed to be a div; multiple lists with no secondary sort key,
  where "most recent" silently isn't; a sale against a zero-stock SKU failing invisibly instead
  of crashing; a container-only-ever-exists-already-filled constraint that broke a naive repack
  setup) — full detail in decision #90, not repeated here.
- **A role-filtered `/learn` page** (`src/pages/TutorialLibrary.tsx` + `src/lib/tutorials.ts`)
  turns all 36 rendered videos into in-app teaching material, defaulting to whatever's relevant
  to the signed-in role, with an "All 36 features" toggle. Reachable via a "🎓 Learn" button on
  every dashboard. Verified live against all 5 roles (rendered counts matched the hand-authored
  role tags exactly). The 69MB of video (`public/tutorials/`) is confirmed NOT precached by the
  PWA service worker.
- **`Jayshankar-clean` resynced from a 3-commits-behind, mid-sprint state to fully current**,
  with a real gap caught along the way: the sync carried 119 code-comment references to the
  excluded methodology docs by filename, across 49 files — found by inspection (one already-
  committed file showed clear evidence of prior deliberate scrubbing that the blind sync had
  just regressed), fixed throughout without touching any comment's actual reasoning.
  `scripts/validate.mjs`/`selftest.mjs` (TINS-gate tooling meaningless without the doc they
  check for) removed from the clean copy entirely. **The user committed and pushed this
  independently** — `49ffe66 "v1 complete"`, confirmed on `origin/master` — before this
  retroactive write-up happened.

**Why "logged retroactively":** this entire part (migrations 0030–0036 through the video
library and the `Jayshankar-clean` push) happened across several long-running conversation
turns that got summarized/continued more than once. `BUILDER-DECISIONS-REVIEW.md` and this file
both fell behind in the moment — decisions #67–#89 for the migrations/video-composition work
were, on inspection, logged correctly at the time; the 34-scenario recording sprint, the
`/learn` page, and the `Jayshankar-clean` resync were not, until decision #90 (added
2026-09-16, same pass as this entry) caught it up. **If you are a future session and notice a
gap like this again — a git log with commits that have no matching decision entry — the fix is
exactly what happened here: write the missing entry before doing anything else, don't leave it
silently missing.** See `NEXT-AGENT-ONBOARDING.md` for the full incident write-up and what it
implies about this project's actual handover discipline in practice, not just on paper.

**Two things found while writing decision #90, left open, not resolved:**
1. `docs/recommendations/` (10 files, dated 2026-09-15, this repo) — a full Mode B/C roadmap
   (competitive analysis, a forecasting-system design, a tiered build-priority list, draft SPEC
   amendment deltas). Documentation only, nothing applied. No other record of who/what produced
   it exists in this decision log — read it yourself before assuming its recommendations are
   endorsed or sequenced correctly against everything else in this file.
2. `public/tutorials/categorized/` (`Jayshankar-clean`, untracked, not in `src/` anywhere) — the
   same 36 videos copied again into 7 category subfolders under a different scheme than
   `tutorials.ts`'s own, doubling that repo's `public/tutorials/` footprint to 135MB. Purpose and
   origin unconfirmed.

**Queue now:** decide what to do with the two open items just above → work through
`docs/recommendations/07-tiered-build-priority.md`'s proposed order, if its premises hold up to
a read → the frontend refresh (still gated on the user saying V1 testing is done) → offline-
conflict UX → Tanglish/English/Tamil UI. The November 1, 2026 mobile-app deadline has still not
moved since part 22 — Capacitor/Android scaffolding exists (decision #45, part 14) and one real
device has installed and run the app (part 16), but no further native-side work happened this
window either; it was entirely backend migrations and the tutorial-video/Learn/clean-repo arc.
