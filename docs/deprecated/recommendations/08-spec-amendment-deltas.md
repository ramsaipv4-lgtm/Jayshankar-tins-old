# 08 — SPEC amendment deltas (the exact changes that would ship each tier)

> **NOT APPLIED.** This document lists, for each tier in `07-tiered-build-priority.md`, exactly which SPEC.md amendments, migrations, RPCs, views, Edge Functions, and pages would be needed to ship it. Use this as the source-of-truth checklist when a tier is actually built.

The format for each item is consistent:

```
### T[N].[M] — <short name>

**SPEC.md amendment:** <what locked decision to add or modify, with the decision number>
**Migration:** <number + filename> — <summary>
**View(s):** <name> — <purpose>
**RPC(s):** <name> — <purpose>
**Edge Function(s):** <name> — <purpose>
**Page(s) touched:** <which existing pages change, which new pages ship>
**Migration shape:** <rough SQL/RPC signature, in code blocks>
```

---

## Tier 1 — Close the obvious holes first

### T1.1 — B1 `customer_sale_balances` view

**SPEC.md amendment:** none (no behavior change — pure refactor).
**Migration:** `0040_customer_sale_balances_view.sql` (could ship alongside T1.4 in a single migration `0040_views_for_client_logic.sql`).
**View:** `customer_sale_balances(sale_id, customer_id, sold_at, total_amount, paid_amount, balance)` (security_invoker).
**Page(s) touched:** `src/pages/PaymentManagement.tsx` (replace lines 72-101), `src/pages/CustomerCard.tsx` (replace lines 69-93).

```sql
create or replace view public.customer_sale_balances
  with (security_invoker = true)
as
select
  s.id as sale_id, s.customer_id, s.sold_at, s.total_amount,
  coalesce((select sum(p.amount) from public.payments p where p.sale_id = s.id), 0) as paid_amount,
  greatest(0, s.total_amount - coalesce((select sum(p.amount) from public.payments p where p.sale_id = s.id), 0)) as balance
from public.sales s
where s.customer_id is not null;
```

### T1.2 — B2 `pack_available_per_batch` view

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`.
**View:** `pack_available_per_batch(batch_id, bill_id, kg_delivered, kg_remaining, kg_packed_non_repack, kg_available)`.
**Page(s) touched:** `src/pages/PackContainerForm.tsx` (replace lines 64-104).

### T1.3 — B3 `expires_at` generated column or view

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`. Use a view `batches_with_expiry(batch_id, sku_id, expires_at)` — keeps the generated-column risk off the critical path.
**Page(s) touched:** `src/pages/FloorDashboard.tsx` (replace lines 62-68), `src/pages/FishCard.tsx` (replace function at line 28-31).

### T1.4 — B5 `stock_by_sku` view (decision #24 tech debt)

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`.
**View:** `stock_by_sku(sku_id, code, english_name, tamil_name, low_stock_threshold_kg, total_kg, batch_count, by_location, is_low_stock)`.
**Page(s) touched:** `src/components/StockBySku.tsx` (replace lines 60-79). Removes the explicit technical debt comment at line 3-4.

### T1.5 — A1 `price_history` panel on `FishCard`

**SPEC.md amendment:** none (surface of existing data).
**Page(s) touched:** `src/pages/FishCard.tsx` — new section "Price history (last 6 months)" using `from('price_history')`.

### T1.6 — A2 `customer_complaint_summary` on `CustomerCard`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/CustomerCard.tsx` — add a small "False claims" badge section reading from `customer_complaint_summary` view.

### T1.7 — A5 `/containers` admin page

**SPEC.md amendment:** none.
**Page(s) added:** `src/pages/ContainerManagement.tsx`. Lists containers + bulk-register convenience (D32).
**Components added:** A small form for "register N containers of size X" — uses a generated-name loop calling a new lightweight RPC.

```typescript
// New RPC: public.register_containers(p_count int, p_capacity_kg numeric, p_container_number_prefix text)
//   returns setof uuid  -- returns the newly-registered container_ids
// RLS: admin/co-admin only
```

### T1.8 — A8 `paymentTerms` filter on `BillsManagement`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/BillsManagement.tsx` — add a filter chip "Credit bills only" alongside existing filters.

### T1.9 — A11 Receiving confirmation history panel

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/BillsManagement.tsx` — for bills with confirmations, expand a "Confirmations" sub-panel showing each `receiving_confirmations` row with promised_kg, confirmed_good_kg, confirmed_spoiled_kg, discrepancy_flag, photo_status.

### T1.10 — A13 Task → bill/sale link, show `started_at`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/MyTasks.tsx`, `src/pages/TaskDelegation.tsx` — read `tasks.related_bill_id` and `tasks.related_sale_id`, render link text "Open bill" / "Open sale". Show `tasks.started_at` for in_progress tasks.

### T1.11 — C1 Per-SKU / per-batch margin report

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`.
**View:** `sku_margin_by_period(sku_id, period, kg_sold, revenue, cost, margin, margin_pct)`.
**Page(s) added:** `src/pages/MarginReport.tsx` or as a section on Admin dashboard.

### T1.12 — C2 Daily closing summary page

**SPEC.md amendment:** none.
**Migration:** `0041_daily_closing_view.sql`.
**View:** `daily_closing_summary(day, total_sales_kg, total_sales_amount, total_collected, total_outstanding, cash_collected, upi_collected, bank_collected, top_seller_sku_id)`.
**Page(s) added:** `src/pages/DailyClosing.tsx` at `/daily-closing`. Shows today's totals with comparisons to yesterday + last 7-day average.

### T1.13 — C3 Per-vendor purchase history view

**SPEC.md amendment:** none.
**Migration:** `0042_vendor_purchase_history_view.sql`.
**View:** `vendor_purchase_history(vendor_id, period_start, period_end, kg_total, bill_count, avg_price_per_kg, top_sku_id, top_sku_kg)`.
**Page(s) touched:** `src/pages/VendorCard.tsx` — new section using this view.

### T1.14 — B7 `sale_vendor_chain` view

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`.
**View:** `sale_vendor_chain(sale_id, vendor_ids, vendor_names)`.
**Page(s) touched:** `src/pages/CustomerCard.tsx` (replace lines 95-114).

### T1.15 — A15 Provenance chain surfaced in `FishCard` + `CustomerCard`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/FishCard.tsx` (new "Where this fish came from" section reading `sale_vendor_chain` per sale that drew from this SKU), `src/pages/CustomerCard.tsx` (already touched in T1.14).

---

## Tier 2 — Festival intelligence + Vyapar essentials

### T2.1 — F1 `indian_festivals` table + seed

**SPEC.md amendment:** add **D62: Indian festival calendar**. Locked decision text:

> A static, hand-curated `indian_festivals` table is the authoritative source for festival-aware forecasting. Scope is Tamil Nadu-focused (~25-30 named festivals/year) with cross-community coverage (national, religious, commercial). Lift factors per festival per SKU are NOT seeded — they start at 1.0 and are populated from Jayshankar's own history by the `festival-lift-calculator` Edge Function as data accumulates. No external calendar API is required; the festival list is part of the spec.

**Migration:** `0043_indian_festivals.sql` (table + seed of ~30 entries).
**Page(s) added:** `src/pages/FestivalCalendar.tsx` at `/festivals`.

### T2.2 — F2 `demand_calendar` view + `forecast_sku_demand` RPC

**SPEC.md amendment:** add **D63: Demand forecast surface**. Locked decision text:

> The demand forecast for the next N days is computed as `predicted_kg = baseline_dow × festival_multiplier × trend_factor × weather_penalty × lunar_multiplier` per SKU. Weekday-vs-weekend pattern emerges from `baseline_dow` (no separate "weekday pattern detection" component). The forecast is exposed to admins via the `forecast_sku_demand` SECURITY DEFINER RPC and the `/forecasts` page. The forecast is **admin-only** and never broadcast to customers (D31).

**Migration:** `0044_demand_calendar_view.sql` + `0045_forecast_sku_demand_rpc.sql`.
**Page(s) added:** `src/pages/Forecasts.tsx` at `/forecasts`.
**Component added:** `src/components/ForecastWidget.tsx` on Admin dashboard.

### T2.3 — F3 `festival_demand_lift` table + Edge Function

**SPEC.md amendment:** extend D62.

> Per-SKU per-festival lift factors are computed nightly by the `festival-lift-calculator` Edge Function. The function scans the last N years of `sales` around each `indian_festivals.festival_date`, computes the multiplier against control windows, and upserts `festival_demand_lift`. The forecast RPC prefers an empirical lift over D62's heuristic whenever `n_samples >= 2`.

**Migration:** `0046_festival_demand_lift.sql`.
**Edge Function added:** `supabase/functions/festival-lift-calculator/index.ts` (cron daily 02:00 IST).

### T2.4 — F4 Admin dashboard Forecast widget

**SPEC.md amendment:** none (UI surfacing of T2.2 RPC).
**Page(s) touched:** `src/pages/AdminDashboard.tsx` — add `<ForecastWidget />` section.

### T2.5 — F5 `forecast_sku_price` RPC

**SPEC.md amendment:** add **D64: Price forecast is admin-only**. Locked decision text:

> The price forecast is exposed only on the `/forecasts` page (admin/co-admin only). It is never surfaced to a customer, never broadcast via WhatsApp (D45's ShareComposer), never displayed in a sale form. The forecast is derived from `price_history` per D8 — the admin's authored reference price, the cleanest signal available.

**Migration:** `0047_forecast_sku_price_rpc.sql`.
**Page(s) touched:** `src/pages/Forecasts.tsx`.

### T2.6 — C12 Low-stock notification type

**SPEC.md amendment:** extend D27 (Track A). Locked decision text:

> A new `notifications.type = 'low_stock'` event fires whenever a SKU's `stock_by_sku.total_kg` (post-mutation) falls below its `low_stock_threshold_kg`. The trigger is `after insert or update or delete on batches`. The forecast widget (T2.4) and the `/forecasts` page surface the alert.

**Migration:** `0048_low_stock_notification_trigger.sql`.
**Component(s) touched:** `src/components/NotificationBell.tsx` (add text + destination for `low_stock`).

### T2.7 — C13 Expiring-soon container dashboard

**SPEC.md amendment:** add **D65: Expiring-soon container alerts**. Locked decision text:

> Containers nearing shelf-life surface in a `/expiring-soon` admin/co-admin page sorted by `expires_at`. A `notifications.type = 'container_expiring_soon'` event fires 24 hours before expiry for any container with kg_remaining > 0. The trigger is server-side, scheduled daily.

> **Step 0 audit — both versions for reference (F-1)**
>
> **Original (pre-Step-0):** The trigger is server-side, scheduled daily.
>
> **Revised (post-Step-0):** The trigger is a Supabase scheduled Edge Function (no pg_cron dependency, same pattern as T2.13's `bills_reconciliation_due` event). When a container fill's `expires_at` is within 24 hours of `now()` and `kg_remaining > 0`, fire `container_expiring_soon`.
>
> **Rationale:** D46 deferred Track C (pg_cron-style infrastructure); T2.7's "scheduled daily" framing needed to match T2.13's existing Supabase scheduled Edge Function pattern. See `09-step0-sanity-check.md` F-1.

**Migration:** `0049_container_expiring_soon_view.sql` + `0050_container_expiring_soon_trigger.sql`.
**Page(s) added:** `src/pages/ExpiringSoon.tsx` at `/expiring-soon`.

### T2.8 — C14 / C49 Per-buyer pricing baseline

**SPEC.md amendment:** add **D66: Per-buyer pricing baseline**. Locked decision text:

> A `customer_prices(customer_id, sku_id, baseline_price_per_kg, effective_from, effective_to)` table records admin-set baselines. The sale form pre-fills the price from this table when a customer is selected, but remains per-sale overridable. **No broadcast of this price to anyone** (D31 still binding — this is admin-only and customer-private). Falls back to `price_history` (D8) and then to free entry if no baseline exists.

**Migration:** `0051_customer_prices.sql`.
**Page(s) touched:** `src/pages/CustomerCard.tsx` (new "Pricing baseline" section), `src/pages/SaleForm.tsx` (pre-fill logic).

### T2.9 — C15 / C50 Quality grade tag at receiving

**SPEC.md amendment:** add **D67: Quality grade at receiving**. Locked decision text:

> A `receiving_confirmations.quality_grade` enum (`grade_a`, `grade_b`, `damaged`, `mixed`) is set by the receiving person at confirmation time. Distinct from `confirmed_spoiled_kg` (a quantity) — a grade is a categorical assessment. Used in vendor reliability scoring over time. Not surfaced on the existing vendor portal (no vendor portal — D28); available on `VendorCard`.

**Migration:** `0052_quality_grade.sql`.
**Page(s) touched:** `src/pages/DeliveryConfirmation.tsx` (new field), `src/pages/VendorCard.tsx` (display).

### T2.10 — C25 Daily cash reconciliation

**SPEC.md amendment:** none.
**Migration:** covered by T1.12 (`daily_closing_summary` view covers it).
**Page(s) touched:** `src/pages/DailyClosing.tsx` — add a "Cash drawer summary" section.

### T2.11 — C28 Catch-location analytics on `VendorCard`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/VendorCard.tsx` — surface `vendors.port_or_village`, `boat_name`, `typical_catch` (already in schema, just never shown).

### T2.12 — C34 Bulk container registration UI

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/ContainerManagement.tsx` (from T1.7) — add the bulk-register form.

### T2.13 — A9 Overdue-reconciliation notification

**SPEC.md amendment:** extend D27 Track C. Locked decision text:

> A `notifications.type = 'bills_reconciliation_due'` event fires daily for any `bills` row where `reconciliation_reminder_at <= current_date and reconciled_at is null`. The trigger is server-side, scheduled daily. Delivery: in-app inbox via `NotificationBell` (existing infrastructure).

**Migration:** `0053_bills_reconciliation_due_trigger.sql`.
**Component(s) touched:** `src/components/NotificationBell.tsx` (add text + destination).

---

## Tier 3 — Supply forecasting + admin reports

### T3.1 — F6 `fishing_ban_periods` + `forecast_supply` RPC

**SPEC.md amendment:** add **D68: Fishing ban periods**. Locked decision text:

> A `fishing_ban_periods` table records Tamil Nadu's state-declared marine fishing ban (typically mid-April to mid-June, dates shift yearly). Seeded annually by the spec author from the TN Fisheries Department's annual gazette order. The `forecast_supply` RPC returns 0.1× baseline (effectively zero) during active ban windows for marine vendors.

**Migration:** `0054_fishing_ban_periods.sql` + `0055_forecast_supply_rpc.sql`.
**Page(s) touched:** `src/pages/Forecasts.tsx` — new section "Supply forecast".

### T3.2 — F7 Weather API integration

**SPEC.md amendment:** add **D69: Weather data source tiering**. Locked decision text:

> Weather data is fetched by the `weather-cache` Supabase Edge Function on a daily cron. **IMD public API is the primary source**; Open-Meteo (free, no API key) is the graceful fallback. Every row in `weather_observations_cache` carries a `data_source` enum (`'imd'`, `'open_meteo'`, `'cache_only'`) so the UI can honestly surface "(using Open-Meteo fallback — IMD unavailable)". Forecasts that depend on weather degrade gracefully — never fail. Forecasts are clearly tagged with their `data_source` so the admin knows the confidence level.

**Migration:** `0056_weather_observations_cache.sql`.
**Edge Function added:** `supabase/functions/weather-cache/index.ts` (cron daily 03:00 IST).

### T3.3 — F9 Lunar calendar overlay

**SPEC.md amendment:** none.
**Migration:** `0057_lunar_phase_fn.sql` (single SQL function).
**RPC(s) touched:** `forecast_supply` (T3.1) — add 1.1× multiplier on full-moon windows.

### T3.4 — F8 "What should I buy tomorrow?" composite

**SPEC.md amendment:** add **D70: Reorder recommendation composite**. Locked decision text:

> The `reorder_recommendation` RPC composes `forecast_sku_demand` + `forecast_supply` + current stock into a per-SKU recommendation. The composite is exposed via `/forecasts` only and the surface is admin-only. Urgency levels: `critical` (need ≥50% of demand), `high` (≥25%), `normal` (>0), `ok` (sufficient stock).

**Migration:** `0058_reorder_recommendation_rpc.sql`.
**Page(s) touched:** `src/pages/Forecasts.tsx` — new "Today" section sorted by urgency.

### T3.5 — F4-followup Forecast change ≥15% drift notification

**SPEC.md amendment:** extend D27. Locked decision text:

> A `forecast_change_log` table records every forecast comparison. The `forecast-drift-monitor` Edge Function re-runs F2/F5/F6/F8 hourly during business hours (08:00-20:00 IST). When `abs(drift_pct) >= 15`, a `notifications.type = 'forecast_alert'` fires. The 15% threshold is the documented default; a future `app_settings` table will let admin tune it (not in this pass).

> **Step 0 audit — both versions for reference (F-3)**
>
> **Original (pre-Step-0):** *No D17 framing on `forecast_change_log`.* The locked-decision text above describes the table's purpose but doesn't explicitly distinguish "audit-shaped per D17's exception" from "stored forecast snapshot" — leaving a future reader uncertain whether the table violates D17 (derived, not stored).
>
> **Revised (post-Step-0):** `forecast_change_log` is structurally an audit-log-shaped table (D17's exception): it records forecast values + drift percentages for drift detection and audit, **not** for user display. The actual forecast the user sees is always computed on read from `forecast_sku_demand` / `forecast_sku_price` / `forecast_supply` / `reorder_recommendation`. The table exists so the `forecast-drift-monitor` Edge Function can diff previous vs current values and fire notifications; it is not a cache of displayed forecasts.
>
> **Rationale:** D17 explicitly allows computed snapshots in audit-shaped tables ("The audit log is the only place computed snapshots are allowed to live, and only as a debug aid"). This annotation makes the structural shape explicit so the table doesn't read as a D17 violation. See `09-step0-sanity-check.md` F-3.

**Migration:** `0059_forecast_change_log.sql`.
**Edge Function added:** `supabase/functions/forecast-drift-monitor/index.ts` (cron hourly 08:00-20:00 IST).
**Component(s) touched:** `src/components/NotificationBell.tsx`.

### T3.6 — C16 Vendor price list baseline

**SPEC.md amendment:** add **D71: Vendor price list baseline**. Locked decision text:

> A `vendor_prices(vendor_id, sku_id, baseline_price_per_kg, effective_from, effective_to)` table records admin-set vendor baselines. A `notifications.type = 'vendor_price_jump'` event fires when a new `batches.price_per_kg_paid` exceeds the baseline by ≥15%. Distinct from C49 (`customer_prices`); same idea, vendor side.

**Migration:** `0060_vendor_prices.sql`.
**Page(s) touched:** `src/pages/VendorCard.tsx` (new section), `src/pages/DeliveryForm.tsx` (compare at submit time, warn if >15% above baseline).

### T3.7 — C18 Proof-of-delivery photo on sale

**SPEC.md amendment:** add **D72: Proof-of-delivery photo on sale**. Blocked on D19 (R2 + Edge Function for photo upload). When D19 ships, this becomes buildable.

**Migration:** `0061_sale_proofs.sql` (table + photo_status enum, similar to `receiving_confirmations.photo_status`).
**Page(s) touched:** `src/pages/SaleForm.tsx` (new "Attach photo" field — photo soft-gate per D25; the sale completes without the photo, just flagged).

### T3.8 — C29 Buyer WhatsApp templates

**SPEC.md amendment:** extend D45 (ShareComposer "lite"). Locked decision text:

> The `ShareComposer` component already supports vendor bill-share (D45). Add buyer-facing templates: "Outstanding balance reminder", "Recent sales summary", "Payment received confirmation". All compose-only; never auto-send.

**Page(s) touched:** `src/components/ShareComposer.tsx`, `src/pages/CustomerCard.tsx`, `src/pages/PaymentManagement.tsx`.

### T3.9 — A4 `check_ins` view on `EmployeeCard`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/EmployeeCard.tsx` — add "Recent check-ins" section.

### T3.10 — A7 Recent vendor payments on `VendorCard`

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/VendorCard.tsx` — add "Recent payments" section using `vendor_payments`.

### T3.11 — C7 Container utilisation report

**SPEC.md amendment:** none.
**Migration:** `0062_container_utilization_view.sql`.
**View:** `container_utilization(container_id, container_number, total_fills, current_kg, idle_days, last_used_at)`.
**Page(s) touched:** `src/pages/ContainerManagement.tsx` (from T1.7).

### T3.12 — C4 Spoilage trend report

**SPEC.md amendment:** none.
**Migration:** `0063_spoilage_trend_view.sql`.
**View:** `spoilage_by_week(sku_id, week, kg_spoiled, movements_count)`.
**Page(s) touched:** Looker Studio source. Optional: in-app section on Admin dashboard.

### T3.13 — C27 Receipt printing

**SPEC.md amendment:** none.
**Page(s) touched:** `src/pages/SaleForm.tsx` — new "Print receipt" CTA after a successful sale. Print stylesheet `@media print` added to `src/index.css`. Bluetooth ESC/POS is a stretch goal (T4.6).

### T3.14 — C45 Daily/weekly admin email digest

**SPEC.md amendment:** none.
**Edge Function added:** `supabase/functions/admin-digest/index.ts` (cron weekly Monday 08:00 IST).

> **Step 0 audit — both versions for reference (F-2)**
>
> **Original (pre-Step-0):** The section above documents the Edge Function and its cron schedule, but does not explicitly call out two standing rules the rest of the recommendations doc respects: (1) AGENTS.md §3.12 — *"Hardcoded credentials are a build break."* A transactional email provider's API key must come from a Netlify env var, never be committed to the repo. (2) D18's "no paid services" framing — D18 explicitly reopens this framing for the Apple Developer Program ($99/year recurring); most transactional email providers have generous free tiers, but the doc should name the provider's free-tier limit so the wholesaler knows the cost shape.
>
> **Revised (post-Step-0):** **Credentials + paid-service framing.** The transactional email provider is configured via Netlify env var `TRANSACTIONAL_EMAIL_API_KEY` — never committed, per AGENTS.md §3.12. Suggested provider: **Resend** (free tier: 100 emails/day, 3,000/month) — covers the weekly admin digest comfortably; above ~100 admin/day the wholesaler would need to upgrade, flagged at admin-dashboard setup time. Per D18's own framing, this does not reopen the 'no paid services' decision — the free tier is the assumed operating point, with upgrade as an explicit future decision if usage grows.
>
> **Rationale:** AGENTS.md §3.12 + D18's "no paid services" framing both require explicit naming of the email provider's free tier and the env-var credential rule. See `09-step0-sanity-check.md` F-2.

### T3.15 — B6 `employee_activity_summary` view

**SPEC.md amendment:** none.
**Migration:** same `0040_views_for_client_logic.sql`.
**View:** `employee_activity_summary(user_id, display_name, role, deliveries_count, sales_count, transfers_count, spoilage_count, repacks_count, reversals_count, last_activity_at)`.
**Page(s) touched:** `src/pages/EmployeeCard.tsx` (replace 4 queries with 1).

---

## Tier 4 — Creative / out-of-scope candidate

Items in `06-creative-extensions.md` (C21, C24, C30, C31, C32, C35, C36, C38, C41, C42, C44, C47, C19, C20, C8, C10, C11, C39) are documented but not scheduled. Each ships under its own ad-hoc SPEC amendment when the wholesaler asks.

For the highest-leverage Tier 4 item, **C21 (Outbound delivery tracking)**, the migration shape would be:

```sql
-- vehicles, trips, trip_line_items
-- + trigger that provisions in_transit_outbound location per warehouse (already done in 0031)
-- + RPC: record_outbound_departure(p_vehicle_id, p_driver_id, p_buyer_id, p_container_ids uuid[], p_expected_return_at timestamptz)
-- + RPC: record_outbound_return(p_trip_id, p_returned_container_states jsonb)  -- what came back, what stayed
-- + View: outbound_trip_summary(trip_id, vehicle, driver, buyer, departed_at, returned_at, kg_departed, kg_returned, kg_sold)
```

But this is blocked on the two real business-policy questions decision #80 still flags — ship only when those are answered.

---

## SPEC.md locked decision summary (Tier 1-3 additions)

This is what `SPEC.md` would gain from Tier 1+2+3 (the 17 locked decisions, in order):

- **D62** — Indian festival calendar (T2.1)
- **D63** — Demand forecast surface (T2.2)
- **D64** — Price forecast is admin-only (T2.5)
- **D65** — Expiring-soon container alerts (T2.7)
- **D66** — Per-buyer pricing baseline (T2.8)
- **D67** — Quality grade at receiving (T2.9)
- **D68** — Fishing ban periods (T3.1)
- **D69** — Weather data source tiering (T3.2)
- **D70** — Reorder recommendation composite (T3.4)
- **D71** — Vendor price list baseline (T3.6)
- **D72** — Proof-of-delivery photo on sale (T3.7)

That's 11 new decisions for Tier 1-3 combined, with Tier 1 needing **zero** (it's pure refactor) and Tier 2-3 needing 11.

The full migration count for Tier 1+2+3:

| Tier | Migrations | Edge Functions | New views | New RPCs |
|---|---|---|---|---|
| Tier 1 | 3 (`0040`, `0041`, `0042`) | 0 | 6 | 1 (T1.7) |
| Tier 2 | 11 (`0043`–`0053`) | 1 (`festival-lift-calculator`) | 5 | 1 (T2.2) |
| Tier 3 | 8 (`0054`–`0063`, with shared views) | 2 (`weather-cache`, `forecast-drift-monitor`, plus `admin-digest`) | 7 | 4 (T3.1, T3.4, T3.5, T3.6) |
| **Total** | **~22** | **3-4** | **18** | **6** |

Pages: 5 new (`/containers`, `/daily-closing`, `/forecasts`, `/festivals`, `/expiring-soon`).

---

## Per-tier effort summary (recap from `07-tiered-build-priority.md`)

| Tier | Items | Effort | What it ships |
|---|---|---|---|
| Tier 1 | 15 | 1-2 weeks | "Does the obvious thing work?" — analytics views, missing pages, tech debt |
| Tier 2 | 13 | 2-3 weeks | "Festival-aware intelligence" — headline differentiator |
| Tier 3 | 15 | 2-3 weeks | "Catch forecasting + admin reports" — second headline differentiator |
| Tier 4 | 18 | as needed | "Vyapar parity on a fish-wholesale angle" |

---

## How to use this doc when shipping a tier

1. **Spec author:** start with the **SPEC.md amendment** for the tier. Open a PR that adds the new locked decisions (D62-D72 as needed). Get sign-off from the wholesaler on the calendar seed (`indian_festivals` rows) and the `fishing_ban_periods` rows.
2. **Backend dev:** write the migrations in the listed order. Each migration is idempotent (`create or replace` / `if not exists`).
3. **Frontend dev:** wire the pages. Use TanStack Query keys per the existing pattern (`['forecasts', skuId]`, etc.).
4. **Validator author:** add a check per tier that the new views exist, the new RPCs return expected shapes, and the new pages render for the right role(s).
5. **Edge Function author:** deploy each Edge Function as part of its tier's release. The cron schedule is set via Supabase scheduled functions.

Every change goes through the existing `npm run validate` gate. No bypass, no `--force`.
