# Backend Phase B — what is built, what is not

> Written 1 October 2026. Answers `BACKEND-REQUIREMENTS-phase-b.md` ("nothing in this document has been implemented") with what now exists.
> Everything below is **built and tested against a real PostgreSQL 16 database** (`supabase/tests/run.sh`, 10 SQL test files, all passing; re-applying every migration on top of itself is also clean), but **not yet applied to the live Supabase project** and **not wired into any screen** except six notification texts. Applying and wiring are the next steps; see §6 and §7.

> **Apply `0046` first if you apply nothing else.** It closes a hole that exists in the live app today (§3, finding 1).

## 1. What was built

Ten new migrations, `0037`–`0046`, all idempotent (each was re-run on top of itself in testing). 14 new tables, 3 new views, about 40 functions created or replaced (one existing function is replaced: `record_container_fill`).

| Migration | What it adds | Requirement it answers |
|---|---|---|
| `0037_phase_b_foundations` | `app_settings` (switches and thresholds as rows), `users.receiving_blind`, role helpers `can_view_procurement_money()` / `can_manage_procurement()`, `next_code()` for `PR-2026-000125`-style codes, **audit trigger attached to 12 tables that had none** | §2.1, §2.5, §2.7 |
| `0038_blind_receiving` | The "receiving never sees vendor or rate" rule, enforced in the database: policy changes on `batches`, `bills`, `vendors`, `vendor_payments`; `batches_safe` view; `list_receiving_queue()` | §2.1 (build order 1) |
| `0039_grading` | `grades`, `grading_runs`, `grading_lines`, `record_grading_run()`, `grading_current_v` | §3.1 (ch. 4) |
| `0040_procurement_and_truck_loads` | `procurement` (PR), `truck_loads` (RCV), `create_procurement`, `dispatch_procurement`, `cancel_procurement`, `receive_truck_load`; traceability columns on `batches` / `receiving_confirmations`; truck loads added to `list_receiving_queue()` | §2.2, §2.3, §2.4, §8.2 (ch. 12) |
| `0041_quality_and_traceability` | `quality_issues`, `raise_quality_issue`, `resolve_quality_issue`, `vendor_quality_scorecard`, `trace_batch`, `trace_sale` | §5 (ch. 13) |
| `0042_procurement_desk` | `purchase_requirements`, `market_prices`, `festivals`, `supplier_quotations` (+ `supplier_quotations_landed_v`), `purchase_orders` (+ lines), `select_quotation`, `create_purchase_order`, `release_purchase_order`, `latest_market_prices`; a trigger that completes POs and requirements when their purchases are received | §8.1, 8.3, 8.4 (ch. 22, 25–28, 30) |
| `0043_aggregates_reports_analytics` | `home_stats_today`, `profit_summary`, `report_stock` / `report_sales` / `report_purchases`, `analytics_*` (3), `procurement_dashboard` | §3, §6, §8.5 (ch. 1, 7, 8, 15, 21, 31) |
| `0044_alerts_and_container_card` | `run_alert_sweeps()` (expiry, low stock, overdue PO, supplier quality) with 12-hour de-duplication; `container_card()` and the QR payload convention | §2.6, §4 (ch. 9, 11, 32) |
| `0045_mixed_supplier_crates` | `record_container_fill` now accepts a crate packed from several suppliers' lots **of one truck load** (and refuses the same batch twice in one fill); `container_fill_is_mixed()` computes whether a fill is mixed, so nothing stored can go stale | the "mixed 25 kg crates" gap from the research |
| `0046_lock_down_function_access` | Revokes `EXECUTE` on every public function from `PUBLIC` and `anon`, changes the default privileges so new functions are not exposed, and takes the internal helpers (cascades, notification helpers, `next_code`, trigger functions) away from `authenticated` too | **security finding, §3 item 1** |

Also changed: `supabase/rls-policies.sql` (the same flag-aware read policies as `0038`; it is re-runnable and would otherwise have put the permissive ones back), `src/components/NotificationBell.tsx` (texts for the six new notification types), `docs/SCHEMA.md` (regenerated), `docs/DECISIONS.md`, `docs/SUPABASE-SETUP.md`.

### How the pieces fit

```
purchase_requirements ─▶ supplier_quotations ─▶ purchase_orders ──release──▶ procurement (PR-2026-…)
                                                                                   │ dispatch (one vehicle, one or more PRs)
                                                                                   ▼
                                                                          truck_loads (RCV-2026-…)  ◀── what receiving sees
                                                                                   │ receive_truck_load(physical kg per fish)
                                                    ┌──────────────────────────────┴────────────────────────┐
                                                    ▼                                                       ▼
                                  batches (one per supplier lot, physical kg)                    bills (one per supplier, PROMISED amount)
                                                    │ is_pro_rata_share when the load was mixed
                                                    ▼
                                  container_fills ─▶ sales ─▶ customers          trace_sale() walks this chain backwards
```

## 2. Rules the database now enforces (and the test that proves each)

| Rule | Where | Test |
|---|---|---|
| Receiving cannot read supplier or rate (once the switch is on) | `0038` policies + `batches_safe` + `list_receiving_queue` | `10_blind_receiving` |
| Stock moves only on receiving confirmation, by **physical** kg. Creating or dispatching a purchase moves nothing | `0040`: `procurement` / `truck_loads` have no write policy; `receive_truck_load` is the only path; `CHECK` forbids `received` without a weight and a time | `30_procurement` |
| Money is never auto-adjusted: the supplier bill is the promised amount (expected kg × rate); only the batch follows the scale. A shortfall raises a `truck_load_discrepancy` notification | `0040` | `30_procurement` |
| A mixed truck is allocated pro rata and **labelled** (`is_pro_rata_share`); traces say "a share of a mixed load", never "supplier B's crate" | `0040`, `0041` | `30_`, `40_` |
| A grade split must reconcile with the kg received (graded + shrink within `grading_tolerance_pct`); re-grading never edits, it supersedes | `0039` | `20_grading` |
| Every new money/stock table is audited | `0037`–`0042` | `10_`, `20_`, `30_` |
| New views are read-only for signed-in users | `0038`/`0039`/`0042` | `10_blind_receiving` |

## 3. Things found while building (worth knowing even if you ignore the rest)

1. **Stock could be rewritten by someone who is not signed in.** Postgres grants `EXECUTE` on every new function to everyone by default, and nothing in `0001`–`0036` revoked it. The internal cascade functions (`container_sourced_cascade`, `direct_batch_cascade`, …) and `notify_admins` are `SECURITY DEFINER`, so a request with only the public anon key could call them. It was reproduced on a copy of the schema: one anonymous call cut a 100 kg batch to 70 kg. **`0046` closes it**, and `90_security.sql` asserts that no public function is executable by `anon`, that the specific attacks now fail, and that the internal helpers are not callable by any client role. The live project should be checked the same way before anything else: as `anon`, `select has_function_privilege('anon', 'public.notify_admins(text, jsonb)', 'execute')` must be `false`. Nothing in this repo shows whether the live project was ever hardened by hand, so treat it as open until checked.
2. **The audit trail was incomplete.** The Storybook and docs say "every change tracked, no edits possible", but `audit_trigger()` had only ever been attached to 8 tables (`users`, `locations`, `vendors`, `skus`, `batches`, `movements`, `sales`, `price_history`). Bills (including the reconciliation fields), payments, vendor payments, customers, containers, container fills, receiving confirmations, reversal requests and complaints were not audited. `0037` attaches it to those 12. History before that migration is not recoverable.
3. **Vendor and rate were readable by every signed-in user** (`batches` and `bills` had `using (true)`), so hiding the fields in the UI hid nothing. `0038` fixes this behind a switch (below).
4. **A single-table view is writable through the default grants.** `0004` grants `ALL` on every new table *and view* to `authenticated`. A simple view that runs with owner rights, like `batches_safe`, would have let any user `UPDATE`/`DELETE` batches through it, around the RLS write policies. Caught by a test; the new views revoke everything and grant `SELECT` only. The existing views are `security_invoker`, so they respect RLS and are not affected.
5. **`rls-policies.sql` is re-runnable and would have undone `0038`.** It now carries the same policies. It must run **after all migrations** (it already referenced tables from `0006`–`0034`; `SUPABASE-SETUP.md` said "after 0005" and now says after all migrations).

Fixes from an adversarial review of `0037`–`0045` (each has a regression in `95_review_regressions.sql`):

- A transfer or restock creates a child batch; reports and the profit summary counted it as a second purchase. Purchase queries now filter with `_is_purchase_batch()`, and `trace_batch` labels such a batch `derived_batch` with a note.
- `purchase_code` in `trace_batch` was visible to blind users; it is now money-roles only, and `allocated_supplier` is shown (money roles only) when a batch is a pro-rata share.
- `NaN` passed `check (x > 0)` (Postgres sorts NaN above every number). `create_procurement`, `receive_truck_load` and `set_app_setting` now refuse it; `receive_truck_load` also refuses an all-zero weighing.
- `set_app_setting` type-checks: booleans for the switch, numbers of zero or more for thresholds, percentages not above 100.
- `run_alert_sweeps` accepts admin / co-admin, or a scheduler running as `service_role`; any other caller gets 42501.
- Bills from `receive_truck_load` are one per **(supplier, payment terms)**, so a cash lot and a credit lot from the same supplier are not merged.
- An expired quotation no longer counts as the best price; a purchase order with one received and one cancelled line becomes `received`; selecting a second quote for a requirement clears the first instead of erroring; the supplier scorecard includes legacy bill batches.
6. **Customer credit limits already existed** (`customers.credit_limit`, `credit_period_days`, view `customer_credit_status`, notification `customer_over_limit`), so requirements §6 needed nothing there.
7. **Physical-kg rule already held for the in-transit flow.** `confirm_delivery_arrival` (0036) sets `batches.kg` to the measured good + spoiled weight; nothing needed changing there. The new rule is about the new `procurement` path.

## 4. Per-chapter status (replaces §11 of the requirements doc)

"Backend" = ready to call. "Screen" = what the frontend still has to do.

| Ch | Chapter | Backend | Screen |
|---|---|---|---|
| 1 | One app for the whole day | `home_stats_today()` | call it from the three home screens |
| 2 | How a purchase is recorded | as before (`record_bill_delivery`); optional PR path `create_procurement` | none, unless the client wants the PR model (§5 Q2) |
| 3 | What happens when fish arrives | `list_receiving_queue()`, `receive_truck_load()`; existing `confirm_delivery_arrival` unchanged | switch `DeliveryConfirmation.tsx` to the queue RPC before the blind switch is turned on |
| 4 | Grading the catch | `record_grading_run()`, `grades`, `grading_current_v` | **new screen** |
| 5 | Packing into containers | mixed-supplier crates (`0045`) | allow multi-lot selection from one truck; **grade-aware packing is not built** (§5) |
| 6 | Selling fish to a buyer | unchanged | grade-wise price **not built** (blocked on client Q1) |
| 7 | What the manager sees | `report_stock()`, `home_stats_today()`, `container_card()` | wire into `/rep`, `/admin` |
| 8 | Reports without a spreadsheet | `report_stock`, `report_sales`, `report_purchases` | **new screen** |
| 9 | Containers & QR tags | `container_card()`, QR payload `jsk://container/<uuid>` | QR **encoder and scanner** (new dependency) |
| 10 | When fish goes bad | unchanged | none |
| 11 | Alerts — nothing slips past | `run_alert_sweeps()`; six new notification types (bell texts added) | a trigger for the sweep (§7) |
| 12 | One ID from boat to bill | `procurement`, `truck_loads`, `trace_batch()`, `trace_sale()` | **new screen** |
| 13 | Which vendor sent this? | `raise_quality_issue`, `vendor_quality_scorecard`, `trace_*` | Quality Issue button on the receiving screen; scorecard screen |
| 14 | Customers & payments | unchanged | none |
| 15 | Profit & the audit trail | `profit_summary()`; audit coverage extended | profit panel |
| 16 | Bills, terms & reconciliation | unchanged (`reconcile_bill`, `payment_terms`) | none |
| 17–20 | Reversals, complaints, tasks, team | unchanged | none |
| 21 | Procurement dashboard | `procurement_dashboard()` | **new desktop screen** |
| 22 | Purchase requirements | `purchase_requirements` (table CRUD) | **new** |
| 23 | Fish master | `skus`; per-fish grade names via `grades.sku_id` | extend `SkuManagement` |
| 24 | Supplier management | `vendor_quality_scorecard()` | extend `VendorManagement` |
| 25 | Daily market price | `market_prices`, `latest_market_prices()` | **new**; needs someone to type prices (§5 Q4) |
| 26 | Festival & market factors | `festivals` | **new** |
| 27 | Supplier quotation | `supplier_quotations`, `supplier_quotations_landed_v`, `select_quotation()` | **new** |
| 28 | Purchase order | `create_purchase_order()`, `release_purchase_order()` | **new** — only if the app owns procurement |
| 29 | Goods receiving | `list_receiving_queue()`, `receive_truck_load()` | desk-width view of ch. 3 |
| 30 | Purchase cost calculation | `supplier_quotations_landed_v` (landed cost per kg and total) | **new** |
| 31 | Procurement analytics | `analytics_purchase_by_fish`, `_purchase_vs_sale_price`, `_supplier_split` | **new** |
| 32 | Alerts & notifications | as ch. 11 | desk-width bell |

## 5. Not built, and why

| Item | Why |
|---|---|
| Grade-aware packing ("Sela A 30 kg + Sela B 20 kg" in one container) | Needs `record_container_fill` to carry a grade per item, or a batch to be split into per-grade child batches. Either is a rewrite of the packing path; do it once the grading answers (client Q1) are final. |
| Grade-wise selling price (`grade_prices`) | Blocked on the client's Q1(b). Not guessed. |
| A dedicated procurement role (sixth role) | Open question §2.7. Today the procurement team is admin, co-admin, and any vendor-rep / super-worker not marked `receiving_blind`. To add a role, change `can_view_procurement_money()` and nothing else. |
| Decision "does the app own procurement?" (Q2) | The tables and RPCs exist and cost nothing if unused. If the answer is no, purchase orders and quotations stay empty and chapters 22, 25–28, 30 become reports over bills. |
| QR encoding and scanning | The database side is done (`container_card`, payload convention). A real encoder (new dependency) and a camera scanner are frontend work. |
| Scale integration | Weight is typed by a person; no scale is read. Open question §10 Q6. |
| Scheduling the alert sweep | `run_alert_sweeps()` is callable by an admin and by any scheduler using the service key, but nothing calls it automatically. The project has held off pg_cron (D27 Track C); §7 lists the options. |
| Market prices and festival dates | The tables exist; no data does. Nobody is assigned to enter prices daily. |
| Photo storage | `photo_url` columns store a URL string. No storage bucket, upload policy or retention rule exists (requirements §10 Q7). |
| WhatsApp sending | Unchanged: the share sheet only (D20). |
| Offline writes | Frontend concern; unchanged. |
| Grading and packing for the legacy bill path in `DeliveryForm` | Works today; nothing needed. |

### Known limits of what is built

- `tasks.related_vendor_id` is an opaque id readable by the task's assignee (pre-existing). It reveals which vendor a task is about only to someone who can already see the task, not the vendor's name.
- A legacy batch with no `delivery_in` movement (created before bills recorded one) is treated as a non-purchase, so it drops out of purchase reports.
- A batch created by a transfer or restock has no truck lineage; trace it through the batch it came from.
- Pro-rata allocation is the only basis for a mixed truck; see open question 6.

### Placeholder values that are guesses, not client answers

Stored in `app_settings`, changeable with `set_app_setting()` by an admin without a deploy:

| Key | Value | Used by | Needs an answer from |
|---|---|---|---|
| `grading_tolerance_pct` | 3 | `record_grading_run` (the deck's 148.5 → 145 kg is 2.4 %, so it passes) | Jayshankar / Mori |
| `normal_damage_pct` | 2 | reserved for the quality alert; not used by any function yet | Jayshankar / Mori |
| `quality_rejection_alert_pct` | 5 | `run_alert_sweeps` | Jayshankar / Mori |
| `expiry_alert_hours` | 6 | `run_alert_sweeps` | operations |
| `market_price_stale_days` | 2 | `latest_market_prices`, `procurement_dashboard` | whoever enters prices |

## 6. Turning blind receiving on (do this in order)

The switch ships **off**, so applying the migrations changes nothing the app does today. When it is on, `batches`, `bills`, `vendors` and `vendor_payments` return **no rows** to a user who may not see procurement money, and several existing screens read those tables directly.

1. Apply `0037`–`0046` (§7), then `rls-policies.sql`.
2. Frontend changes needed first:
   - `src/pages/FloorDashboard.tsx` and `src/components/StockBySku.tsx` → read `batches_safe` instead of `batches` (they already select only safe columns).
   - `src/pages/DeliveryConfirmation.tsx` → read `rpc('list_receiving_queue')`. It currently joins `vendors(name)` and `bills(...)`.
   - `src/pages/PackContainerForm.tsx` → it shows the vendor name and bill number when picking a batch. Use `batches_safe` (`short_code`) for blind users.
   - `FishCard.tsx`, `VendorCard.tsx`, `BillsManagement.tsx` are admin / money screens and need nothing.
3. In the app (as admin) mark the people who receive fish: set `users.receiving_blind = true` for any vendor-rep or super-worker who should not see money. `worker` is always blind.
4. Turn it on: `select set_app_setting('enforce_blind_receiving', 'true'::jsonb);`
5. Check as a blind user: `select * from batches` returns 0 rows; `select * from batches_safe` returns rows; `select * from list_receiving_queue()` shows `vendor_name` and `bill_number` as null.
6. To roll back: `select set_app_setting('enforce_blind_receiving', 'false'::jsonb);` — instant, no migration.

Who sees what once on:

| | admin / co-admin | vendor-rep, super-worker | same, `receiving_blind = true` | worker |
|---|---|---|---|---|
| `batches`, `bills`, `vendors`, `vendor_payments`, purchase tables | yes | yes | no | no |
| `batches_safe`, `list_receiving_queue()` (without supplier) | yes | yes | yes | queue: no (not a receiving role) |
| `receive_truck_load()`, `raise_quality_issue()` | yes | yes | yes | no |
| `profit_summary`, `report_purchases`, analytics, scorecard | yes | yes | no | no |
| `home_stats_today`, `report_stock`, `report_sales`, `container_card` | yes | yes | yes | yes |

## 7. Applying it

On the live Supabase project, in the SQL editor or with `supabase db push`, **in this order**, stopping at the first error:

1. `0046` can go first and alone if you want only the security fix; otherwise `0037` → `0046`, one at a time (each is idempotent).
2. `supabase/rls-policies.sql` (after all migrations).
3. Run the checks in §6 step 5 against real accounts.

Back up first (Supabase dashboard → Database → Backups). `0045` replaces `record_container_fill` (same signature, three small edits to the live body); it is the one change to an existing business function, so run a single pack-a-container check in the app afterwards.

**Scheduling the alert sweep** (pick one; none is built): a Supabase scheduled function that calls `rpc('run_alert_sweeps')` with the service key every 15 minutes; a Netlify scheduled function doing the same; a GitHub Action on a cron. Until then an admin can call it from a button. It de-duplicates, so calling it often is harmless.

**Tests** run on a throwaway local PostgreSQL, never on Supabase. They were run on PostgreSQL 16; Supabase is on 15, and nothing here uses a 16-only feature, but that has not been proven on 15:

```bash
PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh      # all
./supabase/tests/run.sh 30                                            # one file
```

It applies every migration plus `rls-policies.sql` to a scratch database with a small stub for Supabase's `auth` schema and roles, creates one user per role, and runs each test in a rolled-back transaction. The stub is not Supabase: it proves the SQL and the policies, not the Supabase Auth, PostgREST or Edge Function layers.

## 8. Open questions this build leaves (additions to `client-qa/client-questions-pending.md`)

1. Grading (their Q1): finer grades? grade-wise price? photo per grade? per-fish grade names? The tables allow all four; only the first and last are exercised.
2. What tolerance between graded kg + shrink and received kg is acceptable? (placeholder 3 %)
3. Does the app own procurement (purchase orders, quotations), or only receiving? §5.
4. Who enters market prices every morning, and from where?
5. Which of the receiving staff are `vendor-rep` / `super-worker`, and should any of them be able to see prices? This decides who gets `receiving_blind`.
6. When a mixed truck is received, is pro-rata allocation by expected kg an acceptable basis for paying and scoring suppliers? It is the only basis available when fish is mixed on the dock, but it means a supplier who short-delivered is averaged against the others in the same fish. The scorecard says "allocated", not "caused".
7. Retention of photos and the audit log.

## 9. Applying this from the repository (2026-09-29)

The ten migrations, `supabase/tests/` and the updated `rls-policies.sql` are now **in this repo** —
they previously existed only inside `client-qa/session3/backend-phase-b.zip`. Staging them changed
nothing about the live database: the project is still at `0036`, verified read-only (`app_settings`,
`truck_loads` and `grading_rules` all return 404).

**One value is missing, and it is the only thing blocking the apply.** There is no database password
and no access token anywhere in this repo, so nothing here can run the migrations:

- `scripts/` reaches Supabase through PostgREST with the service key. PostgREST **cannot execute
  DDL**, so no script in this repo's `scripts/` can apply a migration, and none ever could.
- `.env` holds `VITE_SUPABASE_URL` + the publishable key. `scripts/.env` holds the URL, the
  publishable key, the secret key and `SUPABASE_JWKS_URL`. **No `DATABASE_URL`, no
  `SUPABASE_ACCESS_TOKEN`.**
- `psql`, `pg_dump` and the Supabase CLI are not installed in this environment, and the `pg` package
  is not a dependency.

Two working paths, in the order I would try them.

**A. The SQL editor (no install, no new secret).** Supabase Dashboard → SQL Editor, and run the files
**in order, stopping at the first error** — exactly as §7 says. `0046` first if you want the security
fix on its own. Then paste `supabase/rls-policies.sql`. Then run §6 step 5's checks. Back up first
(Dashboard → Database → Backups).

**B. `DATABASE_URL` + the kit's runner.** Add the connection string (Dashboard → Database →
Connection string, the direct or pooler Postgres URI) to `scripts/.env`, install `pg` as a dev
dependency, then:

```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' \
  node tins-kit/scripts/migration-runner.mjs --dir=supabase/migrations --dry-run
```

**Read the dry run before trusting it.** The runner tracks applied files in its own
`migrations_applied` table, which does not exist on this project — the 36 earlier migrations were
applied through the SQL editor, not through a runner. So a plain run would attempt **all 46**, not
just the 10 pending. Either point `--dir` at a directory holding only `0037`–`0046`, or accept
re-applying 0001–0036 (they are idempotent, but this is a live database with real data, and "should
be idempotent" is not the same as "verified against this database today").

Two further notes on path B: the kit's runner calls `require('node:crypto')` inside an ESM module and
throws `require is not defined` before it applies anything (recorded in `BUILDER-DECISIONS-REVIEW.md`
as a kit-growth candidate — the kit is read-only for consumers), and it does not apply
`rls-policies.sql`, which still has to be pasted by hand afterwards.

Whichever path is used, §6's order holds: apply → update the frontend screens → mark the receiving
staff → turn the switch on → check as a blind user. Blind receiving ships **off**, so applying the
migrations changes nothing the app does today.
