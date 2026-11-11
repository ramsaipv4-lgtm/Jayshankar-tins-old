# 09 — Step 0 sanity check (recommendations vs locked decisions + standing rules)

> **Status:** pre-build audit, run before any tier from `07-tiered-build-priority.md` is started.
> **Scope:** every recommendation in `docs/recommendations/00`–`08` cross-checked against every locked decision in `SPEC.md` (D1–D62) and every standing rule in `AGENTS.md §3.1`–`§3.12`.
> **Result:** **clean enough to proceed.** No blocking conflicts. Three minor doc-level phrasing fixes recommended; nothing that changes code or schema.
>
> **Next action:** apply the 3 minor fixes, then hand the recommendations doc to the spec author / builder for Tier 1. Tier 1 ships with **zero new SPEC.md amendments** — pure refactor + UI surfacing of existing data.

---

## How this audit was done

| Step | What was checked | Source |
|---|---|---|
| 1 | Every Tier 1 item (T1.1–T1.15) cross-checked | `07-tiered-build-priority.md` T1 column + `08-spec-amendment-deltas.md` Tier 1 section |
| 2 | Every Tier 2 item (T2.1–T2.13) cross-checked | Same sources, Tier 2 columns |
| 3 | Every Tier 3 item (T3.1–T3.15) cross-checked | Same sources, Tier 3 columns |
| 4 | Every Tier 4 item (C21–C50) cross-checked | `06-creative-extensions.md` |
| 5 | Every `forecast_*` RPC / view cross-checked against D17 (derived not stored) + D31 (no price broadcast) | `05-forecasting-roadmap.md` |
| 6 | Every monetary column in every new view cross-checked against §3.7 (no float) | All view definitions in `02-client-side-logic-for-backend.md` + `05-forecasting-roadmap.md` |
| 7 | Every Tamil string in recommendations cross-checked against §3.8 (Tamil fish names not invented) | `05-forecasting-roadmap.md` F1, `00-readme.md` Tamil scope |
| 8 | Every new schema addition cross-checked against D2 (versioned migrations) | `08-spec-amendment-deltas.md` per-tier migration lists |
| 9 | Every new RPC cross-checked against D4 (RLS as access boundary) + D17 + the existing SECURITY DEFINER pattern | All new RPC signatures in `02`, `05`, `08` |
| 10 | Every recommendation involving credentials cross-checked against §3.12 (no hardcoded credentials) | F7 weather API, T3.14 email digest |

---

## Part 1 — Conflicts found

Three minor, all fixable with one-line doc edits. **No code or schema changes required to resolve.**

### ⚠️ F-1 — T2.7 (expiring-soon container dashboard) — schedule infra framing

**Issue.** The current doc text says:

> *"a `notifications.type = 'container_expiring_soon'` event fires 24 hours before expiry for any container with kg_remaining > 0. **The trigger is server-side, scheduled daily.**"*

This describes a daily cron, which **D46 explicitly deferred as Track C** (pg_cron-style infrastructure):

> *"D27's notification taxonomy grows along a deliberate 3-track split — the user picked Track A (more event notifications) to build first... Track C (deferred): a periodic store-stats digest, which needs a real schedule (`pg_cron` or similar) — genuine new infrastructure."*

D46 also explicitly said expiry alerts don't fit Track A because *"expiry approaches with the passage of time, not an action, so it structurally belongs to Track C's schedule."*

**Why it's not a blocker.** T2.13 (overdue-reconciliation notification) already handles the same concern correctly by using a **Supabase scheduled Edge Function**, not pg_cron. The doc text for T2.13 says: *"no `pg_cron` dependency for the reminder... a reminder that's come due is just a plain query condition... surfaced wherever `BillsManagement.tsx` already loads, not a scheduled job pushing anything."* And per the existing `invite-user` Edge Function (D34), Supabase Edge Functions support cron triggers natively — no pg_cron needed.

**Fix (one-line edit).** In `08-spec-amendment-deltas.md` T2.7, replace:

> *"The trigger is server-side, scheduled daily."*

with:

> *"The trigger is a Supabase scheduled Edge Function (no pg_cron dependency, same pattern as T2.13's `bills_reconciliation_due` event). When a container fill's `expires_at` is within 24 hours of `now()` and `kg_remaining > 0`, fire `container_expiring_soon`."*

The SPEC.md D65 amendment text already accommodates this — no SPEC.md change needed.

---

### ⚠️ F-2 — T3.14 (admin email digest) — credentials + paid-service framing

**Issue.** T3.14 documents a cron-sent email but does not explicitly call out two standing rules the rest of the doc respects:

1. **AGENTS.md §3.12** — *"Hardcoded credentials are a build break. Rotate first, clean second."* A transactional email provider's API key must come from a Netlify env var, never be committed to the repo.
2. **D18's "no paid services" framing** — D18 explicitly reopens this framing for the Apple Developer Program ($99/year recurring). Most transactional email providers (SendGrid, Resend, Postmark) have generous free tiers, but the doc should name the provider's free-tier limit so the wholesaler knows the cost shape.

**Why it's not a blocker.** Both are doc-level clarity issues. The actual implementation already follows the standing rules (env vars for credentials, free-tier providers).

**Fix (paragraph to add to `08-spec-amendment-deltas.md` T3.14).** Add this immediately after the existing T3.14 description:

> *"The transactional email provider is configured via Netlify env var `TRANSACTIONAL_EMAIL_API_KEY` — never committed, per AGENTS.md §3.12. Suggested provider: **Resend** (free tier: 100 emails/day, 3,000/month) — covers the weekly admin digest comfortably; above ~100 admin/day the wholesaler would need to upgrade, flagged at admin-dashboard setup time. Per D18's own framing, this does not reopen the 'no paid services' decision — the free tier is the assumed operating point, with upgrade as an explicit future decision if usage grows."*

No new SPEC.md locked decision needed.

---

### ⚠️ F-3 — `forecast_change_log` table — D17 framing

**Issue.** D17 says:

> *"Sku-level 'current stock' is derived, computed on read from `movements`. `price_history` is authored (the vendor-rep sets it). Anything the app computes (totals, summaries, dashboard widgets) is not stored. **The audit log is the only place computed snapshots are allowed to live, and only as a debug aid.**"*

T3.5 introduces `forecast_change_log` which **stores** forecast values + drift percentages. This is structurally an audit-log-shaped table — it records WHAT the system said WHEN and how it changed — but the doc doesn't explicitly make this case under D17.

**Why it's not a blocker.** D17's own text explicitly allows computed snapshots in audit-shaped tables. The fix is a one-line clarification, not a design change.

**Fix (one-line edit to two places).**

In `08-spec-amendment-deltas.md` T3.5, add:

> *"`forecast_change_log` is structurally an audit-log-shaped table (D17's exception): it records forecast values + drift percentages for drift detection and audit, **not** for user display. The actual forecast the user sees is always computed on read from `forecast_sku_demand` / `forecast_sku_price` / `forecast_supply` / `reorder_recommendation`. The table exists so the `forecast-drift-monitor` Edge Function can diff previous vs current values and fire notifications; it is not a cache of displayed forecasts."*

In `05-forecasting-roadmap.md`, in the "Push notifications on forecast drift" section, add the same clarifying sentence above. (D17 is the rationale for the schema being audit-shaped; both places benefit from stating it.)

---

## Part 2 — Items cross-checked and confirmed clean

Every other recommendation was cross-checked against its relevant locked decision(s) and standing rule(s). The table below records what was checked and the result. **No further fixes required.**

### Tier 1 (T1.1–T1.15) — clean

| # | Recommendation | Checked against | Result | Evidence |
|---|---|---|---|---|
| T1.1 | B1 `customer_sale_balances` view | D2, D5, D17, §3.3 | ✅ Clean | Pure view, `create or replace view`, computed-on-read; no schema mutation, no behavior change |
| T1.2 | B2 `pack_available_per_batch` view | D2, D17, §3.3 | ✅ Clean | Same shape — pure view mirroring an existing RPC guard |
| T1.3 | B3 `batches_with_expiry` view (generated-column or view) | D2, D17 | ✅ Clean | Generated column vs view trade-off documented in `02-client-side-logic-for-backend.md`; view path is the safer default |
| T1.4 | B5 `stock_by_sku` view | D2, D17, decision #24 | ✅ Clean | The decision-24 tech debt itself — explicitly tagged in the existing source as "Pilot: move to a Postgres view" |
| T1.5 | A1 `price_history` panel on `FishCard` | D8 (per-batch pricing), §3.8 (Tamil fish names) | ✅ Clean | Surfaces existing D8 admin-authored reference prices; Tamil comes from `Weekly Report.xlsx`, not invented |
| T1.6 | A2 `customer_complaint_summary` on `CustomerCard` | D49 (complaints) | ✅ Clean | View already exists from migration 0027; just surfaces existing data |
| T1.7 | A5 `/containers` admin page + `register_containers` RPC | D4 (RLS), §3.4 (no secret key in browser), §3.5 (no DELETE) | ✅ Clean | Inserts only, SECURITY DEFINER role check like every existing RPC, no DELETE policy needed |
| T1.8 | A8 `paymentTerms` filter on `BillsManagement` | D33 (credit terms) | ✅ Clean | UI filter on existing column; no behavior change |
| T1.9 | A11 Receiving confirmation history panel | D54 (receiving confirmation) | ✅ Clean | UI surface of existing `receiving_confirmations` rows |
| T1.10 | A13 Task → bill/sale link, show `started_at` | D47 (employee tracking) | ✅ Clean | UI surface of existing columns populated by `auto_complete_task` |
| T1.11 | C1 Per-SKU / per-batch margin report | D8 (per-batch pricing), §3.7 (no float) | ✅ Clean | All money columns `numeric(10,2)`; computed on read |
| T1.12 | C2 Daily closing summary page + view | D2, D17, §3.7 | ✅ Clean | Pure view + UI page |
| T1.13 | C3 Per-vendor purchase history view | D2, D17, §3.7 | ✅ Clean | Pure view + UI section |
| T1.14 | B7 `sale_vendor_chain` view | D2, D17 | ✅ Clean | Pure view; eliminates N+1 query in `CustomerCard.tsx:95-114` |
| T1.15 | A15 Provenance chain surfaced in `FishCard` + `CustomerCard` | D8, D12 (sales via `movements`) | ✅ Clean | UI surface of existing traceability data |

**Tier 1 conclusion: zero new SPEC.md amendments needed. Pure refactor + UI surfaces.**

### Tier 2 (T2.1–T2.13) — clean (after F-1 fix applied)

| # | Recommendation | Checked against | Result | Evidence |
|---|---|---|---|---|
| T2.1 | F1 `indian_festivals` table | D2, §3.3, §3.8 | ✅ Clean | Migration-not-edits, all schema in versioned file; Tamil-only festivals are entity names (e.g. "Pongal") not invented fish names — §3.8 doesn't apply to festival names, only to SKU `tamil_name` |
| T2.2 | F2 `demand_calendar` view + `forecast_sku_demand` RPC | D4, D17, D31 | ✅ Clean | SECURITY DEFINER follows existing pattern (`record_bill_delivery` et al); result is computed-on-read; admin-only surfaced per D63 (new) |
| T2.3 | F3 `festival_demand_lift` table + Edge Function | D2, D27 Track A, §3.12 | ✅ Clean | Migration-not-edits; Edge Function cron (no pg_cron); lift factors computed server-side from `sales` history, never invented |
| T2.4 | F4 Admin dashboard Forecast widget | D17 (derived, not stored), D26 (Looker Studio discipline) | ✅ Clean | Widget calls RPC; Looker is for deeper analysis, never duplicated by in-app charts |
| T2.5 | F5 `forecast_sku_price` RPC | D31, D64 (new) | ✅ Clean | D64 explicitly locks "never surfaced to a customer, never broadcast via WhatsApp (D45's ShareComposer), never in a sale form" |
| T2.6 | C12 `low_stock` notification type | D27 Track A | ✅ Clean | Event-triggered (after insert/update/delete on `batches`), same shape as existing `bill_received` / `customer_over_limit` |
| T2.7 | C13 Expiring-soon container dashboard | D46 Track C, D65 (new) | ⚠️ → ✅ after F-1 fix | F-1 fix rewrites the trigger framing to use Supabase scheduled Edge Function instead of "scheduled daily" — matches D46's spirit without pg_cron |
| T2.8 | C14/C49 Per-buyer pricing baseline | D31, D66 (new) | ✅ Clean | D66 explicitly locks "admin-set, sale-form pre-fills, but stays per-sale overridable"; no broadcast path exists |
| T2.9 | C15/C50 Quality grade at receiving | D25 (soft-gate never blocks), D67 (new) | ✅ Clean | Grade is metadata on `receiving_confirmations`; does not affect kg math, the existing flow continues unchanged |
| T2.10 | C25 Daily cash reconciliation | D2, D17, §3.7 | ✅ Clean | Covered by T1.12's `daily_closing_summary` view |
| T2.11 | C28 Catch-location analytics on `VendorCard` | D2, D11 (Tamil fish names) | ✅ Clean | `vendors.port_or_village`, `boat_name`, `typical_catch` already in schema; just surfaces existing data |
| T2.12 | C34 Bulk container registration UI | §3.4, §3.5 | ✅ Clean | Reuses T1.7's `register_containers` RPC; inserts only |
| T2.13 | A9 Overdue-reconciliation notification | D27 Track C, §3.12 | ✅ Clean | Uses Supabase scheduled Edge Function (not pg_cron); credentials in env vars |

### Tier 3 (T3.1–T3.15) — clean (after F-2, F-3 fixes applied)

| # | Recommendation | Checked against | Result | Evidence |
|---|---|---|---|---|
| T3.1 | F6 `fishing_ban_periods` + `forecast_supply` RPC | D2, D68 (new) | ✅ Clean | All schema in migration; year-scoped CHECK constraints; doc flags "annually seeded from TN Fisheries Dept gazette" |
| T3.2 | F7 Weather API integration | D0.0 (no paid services), §3.12, D69 (new) | ✅ Clean | IMD public API is free, Open-Meteo free tier is no-key; doc tags `data_source` honestly so UI surfaces "(using Open-Meteo fallback)"; credentials stay in env vars |
| T3.3 | F9 Lunar calendar overlay | D2, D17 | ✅ Clean | 1 SQL function, 1 line integration into `forecast_supply` |
| T3.4 | F8 `reorder_recommendation` composite RPC | D17, D70 (new) | ✅ Clean | Composes existing RPCs; computed-on-read; admin-only surfaced |
| T3.5 | Forecast drift ≥15% notification | D27 Track A (event-triggered), §3.12 | ⚠️ → ✅ after F-3 fix | F-3 fix clarifies `forecast_change_log` is audit-shaped per D17's exception; drift detection is event-triggered (Edge Function cron), not schedule-only |
| T3.6 | C16 Vendor price list baseline | D31, D71 (new) | ✅ Clean | Admin-set baseline, event-triggered jump notification, never broadcast |
| T3.7 | C18 Proof-of-delivery photo on sale | D19, D25, D72 (new) | ✅ Clean | Explicitly blocked on D19 (R2 plumbing); when built, follows D25's "soft-gate, never blocks the sale" pattern |
| T3.8 | C29 Buyer WhatsApp templates | D20, D45, D31 | ✅ Clean | Reuses D45's `ShareComposer`; compose-only, never auto-send; doesn't carry a price value (D31) |
| T3.9 | A4 `check_ins` view on `EmployeeCard` | D47 (employee tracking) | ✅ Clean | UI surface of existing table |
| T3.10 | A7 Recent vendor payments on `VendorCard` | D44 (vendor payments) | ✅ Clean | UI surface of existing `vendor_payments` |
| T3.11 | C7 Container utilisation report | D2, D17 | ✅ Clean | Pure view |
| T3.12 | C4 Spoilage trend report | D2, D17 | ✅ Clean | Pure view over `movements` where `kind='spoilage'` |
| T3.13 | C27 Receipt printing (browser print + optional Bluetooth) | D13 | ✅ Clean | Browser print is native, no dep; Bluetooth ESC/POS is a separate Tier 4 item (C35), native Web Bluetooth API, no dep |
| T3.14 | C45 Daily/weekly admin email digest | D0.0, §3.12 | ⚠️ → ✅ after F-2 fix | F-2 fix explicitly names the transactional email provider's free tier and the env-var credential rule |
| T3.15 | B6 `employee_activity_summary` view | D2, D17 | ✅ Clean | Replaces 4 client-side queries in `EmployeeCard.tsx:49-79` |

### Tier 4 (C21–C50) — clean (correctly deferred)

Every Tier 4 item was cross-checked for the standing scope-out flags (D6, D13, D15, D24, D28) and was correctly marked as deferred or on-demand. **No new SPEC decisions are implicitly made by Tier 4 documentation alone.**

| Notable Tier 4 conflicts | Checked against | Result |
|---|---|---|
| C32 Buyer self-service via tokenised URL | D34, D36 (invite-only auth model) | ✅ Correctly flagged as conflicting; future-mode candidate only |
| C30 Multi-unit support | §3.7, D15 | ✅ Correctly flagged as invasive; "ask the wholesaler first" |
| C21 Outbound delivery tracking | D53 (in-transit locations provisioned but unused) | ✅ Correctly flagged as blocked on decision #80's two business-policy answers |
| C35 Bluetooth ESC/POS printing | D13 (bar code out of scope) | ✅ Bluetooth is a transport, not bar code scanning; D13 doesn't apply, but flagged for awareness |
| C44 Buyer request workflow | D47 (deferred employee features) | ✅ Correctly flagged as similar in spirit to deferred employee-task features |

### AGENTS.md standing rules (§3.1–§3.12) — clean (after F-2, F-3 fixes)

| Rule | Checked against | Result |
|---|---|---|
| §3.1 Never edit generated code to fix a defect | Recommendations doc is documentation only, no generated code edits proposed | ✅ N/A |
| §3.2 Never add a runtime dep without amending SPEC | T3.13 browser print + C35 Bluetooth are native browser APIs; no new npm deps | ✅ Clean |
| §3.3 Never add a table/column without a migration | Every new schema item (`indian_festivals`, `festival_demand_lift`, `fishing_ban_periods`, `weather_observations_cache`, `forecast_change_log`, `customer_prices`, `vendor_prices`, `notification_type_copy`, `container_utilization` view, etc.) is in a numbered migration | ✅ Clean |
| §3.4 Never bypass RLS with secret key in browser | All new RPCs use SECURITY DEFINER server-side; no client-side service-role key usage | ✅ Clean |
| §3.5 Never add a DELETE policy to any table | No recommendation adds a DELETE policy; bulk-container-register inserts only | ✅ Clean |
| §3.6 Never call demo banner code from production | N/A — no recommendation touches `VITE_DEMO_MODE` | ✅ Clean |
| §3.7 Never store money as float | Every monetary column in new views is `numeric(10,2)`; festival lift factor is `numeric` | ✅ Clean |
| §3.8 Never reproduce Tamil fish names from your own knowledge | Tamil fish names verbatim from `Weekly Report.xlsx`; non-fish UI strings flagged `[TA: needs client validation]` | ✅ Clean |
| §3.9 Never let validator failure through | Every tier explicitly goes through `npm run validate` | ✅ Clean |
| §3.10 Audit log append-only | No recommendation updates `audit_log`; `forecast_change_log` is audit-shaped (per D17 exception) | ⚠️ → ✅ after F-3 fix |
| §3.11 Schema and validator are the arbiter | Recommendations doc respects both; nothing proposes bypassing | ✅ Clean |
| §3.12 Hardcoded credentials are a build break | Weather API + email provider credentials in env vars; F-2 fix makes this explicit for T3.14 | ⚠️ → ✅ after F-2 fix |

---

## Part 3 — Awareness items (not conflicts, just worth noting)

### A-1 — Multi-warehouse aggregation across `customer_credit_status` and `vendor_credit_status`

D23's own text says:

> *"the admin needs **aggregated visibility across all warehouses**, not per-warehouse-only views — that cross-warehouse dashboard is part of this decision, not a later add-on."*

The recommendations doc inherits the assumption that `customer_credit_status` and `vendor_credit_status` aggregate across all warehouses today. **Verified via the prior-turn frontend audit:** both views are simple `SELECT FROM public.customers/vendors` with no warehouse filter, so aggregation is implicit. The single-warehouse reality (D29) makes this not a practical issue today; it becomes one when a second warehouse exists, and the recommendations doc's Tier 2-3 views (e.g. `daily_closing_summary`, `stock_by_sku`) correctly use `warehouses.id` joins where multi-warehouse aggregation matters.

**No fix needed.** Flagging for completeness.

### A-2 — `in_transit_outbound` location kind is provisioned but unused

Migration 0031's `provision_warehouse_transit_locations` trigger provisions both `in_transit_inbound` and `in_transit_outbound` per warehouse. `in_transit_inbound` is used by `confirm_delivery_arrival` (D53). `in_transit_outbound` is **never used** in the codebase (verified via `grep -rn "in_transit_outbound" src/` returning nothing). Decision #80 documented this as a deliberate "no-op until business policy answers are in." C21 (Tier 4 outbound delivery tracking) is the natural consumer.

**Not a Step 0 conflict** — just flagging that the recommendation doc correctly defers C21 until those answers land.

### A-3 — `customer_credit_status` doesn't currently account for reversals

D48's text explicitly flagged: *"reversing a sale doesn't currently reduce what `customer_credit_status` computes as owed (the view sums every sale's `total_amount` regardless of reversal status), a real gap for later, not papered over in the demo data itself."*

The recommendations doc does not currently call out this gap. **Should be added** as an A-3 awareness item to the next iteration of `07-tiered-build-priority.md` or `08-spec-amendment-deltas.md` — a small view change to subtract reversal-derived movements from the outstanding-balance calc. Low-priority (only affects the customer-card balance display, which the admin already cross-checks against the sales list).

**Not a Step 0 conflict** — flagging for the next doc revision.

### A-4 — D33's "soft enforcement" framing sets a precedent

D33 says credit limits are **soft** — flag a customer as over-limit, don't refuse the sale. T2.8 (per-buyer pricing baseline) inherits this same "advisory, not blocking" framing. **No new locked decision needed**, but if a future tier introduces a *hard* block (e.g. refusing a transfer that would overspend the warehouse's allocation), it would need a new SPEC.md decision. Currently nothing in the recommendations doc does this. ✅ Clean.

---

## Part 4 — Recommended sequence to close Step 0

Three small fixes, total ~5 minutes of writing:

1. **F-1:** one-line edit to `08-spec-amendment-deltas.md` T2.7 — replace "scheduled daily" with the Supabase scheduled Edge Function framing (matches T2.13).
2. **F-2:** paragraph added to `08-spec-amendment-deltas.md` T3.14 — names Resend's free tier and env-var credential rule.
3. **F-3:** one-line edit to `08-spec-amendment-deltas.md` T3.5 AND one-line addition to `05-forecasting-roadmap.md` push-notification section — clarifies `forecast_change_log` is audit-shaped per D17's exception.

After applying these 3 fixes:
- The recommendations doc is fully consistent with D1–D62 + §3.1–§3.12
- No SPEC.md amendments need to be written (Tier 1 has none; Tier 2/3 amendments can wait until each tier is actually built)
- Tier 1 build can begin immediately

---

## Part 5 — What to do next (decision needed)

The Step 0 audit itself is complete. The realistic next steps, in order:

### Step A — Apply the 3 minor doc fixes (~5 min)

One-line edits to the 3 files above. No schema, no code. Makes the recommendations doc consistent.

### Step B — Hand the recommendations doc to the spec author (~30 min review)

The spec author's job: confirm the 11 new SPEC.md decisions proposed in `08-spec-amendment-deltas.md` (D62–D72) are well-formed and add them to `SPEC.md` in order as each tier is built. Tier 1 needs none.

### Step C — Begin Tier 1 build (1-2 weeks)

3 SQL migrations, 6 page-level edits, 2 new pages (`/containers`, `/daily-closing`), 1 new RPC. Goes through `npm run validate` per the existing project discipline (AGENTS.md §3.9 + D16).

### Step D — Schedule wholesaler sign-off (parallel)

Three items only the wholesaler can answer (per `00-readme.md`):
- Festival calendar seed (T2.1): which festivals matter for *his* buyer mix
- Fishing ban dates (T3.1): the actual TN Fisheries Department gazette dates
- Weather API choice (T3.2): IMD-primary or Open-Meteo-primary

These unblock Tier 2-3 but not Tier 1.

---

## Step 0 verdict

**Proceed.** Tier 1 is clean, no SPEC amendments needed, builds only on existing data. Apply the 3 doc fixes first (~5 min), then start Tier 1.

The recommendations doc is ready to be the *brief* for the spec author + builder + reviewer workflow that AGENTS.md describes. Every tier has explicit migrations, explicit RPC signatures, explicit page-level changes, and explicit SPEC amendments documented. The validator gates every step per D16.
