# 07 — Tiered build priority (what to build first, second, third)

> This is the build order. Every item has an effort estimate (Low / Med / High) and a value rating (Low / Med / High) for a Tamil Nadu fresh-fish wholesale. Items are grouped into 4 tiers; within a tier, build any order — they don't depend on each other.

## Tier 1 — Close the obvious holes first (1-2 weeks)

**Why Tier 1:** Every item here is buildable from existing data (no schema change), closes real technical debt, and is the kind of feature every user expects without knowing to ask for.

| # | Item | Source doc | Difficulty | Value | Notes |
|---|---|---|---|---|---|
| T1.1 | **B1 — `customer_sale_balances` view** | `02-client-side-logic-for-backend.md` | Low | High | Eliminates duplicate per-sale-balance logic in `PaymentManagement.tsx:92-99` + `CustomerCard.tsx:81-93` |
| T1.2 | **B2 — `pack_available_per_batch` view** | `02-client-side-logic-for-backend.md` | Low | High | Stops `PackContainerForm.tsx` from "mirroring" `record_container_fill`'s guard |
| T1.3 | **B3 — `expires_at` via generated column or view** | `02-client-side-logic-for-backend.md` | Low | Med | Two consumers (`FloorDashboard.tsx:62-68`, `FishCard.tsx:28-31`) compute the same thing |
| T1.4 | **B5 — `stock_by_sku` view (decision #24 tech debt)** | `02-client-side-logic-for-backend.md` | Low | High | Explicit technical debt comment in the file |
| T1.5 | **A1 — `price_history` panel on `FishCard`** | `01-backend-without-frontend-gaps.md` | Low | High | D8's analytics purpose made visible |
| T1.6 | **A2 — `customer_complaint_summary` on `CustomerCard`** | `01-backend-without-frontend-gaps.md` | Low | High | D49's own motivation |
| T1.7 | **A5 — `/containers` admin page** | `01-backend-without-frontend-gaps.md` | Low | High | D32's bulk-register + see active/retired |
| T1.8 | **A8 — `paymentTerms` filter on `BillsManagement`** | `01-backend-without-frontend-gaps.md` | Low | High | "Which bills are credit?" admin question |
| T1.9 | **A11 — Receiving confirmation history panel** | `01-backend-without-frontend-gaps.md` | Low | Med | Per-batch confirmation history; uses existing `receiving_confirmations` |
| T1.10 | **A13 — Task → bill/sale link, show `started_at`** | `01-backend-without-frontend-gaps.md` | Low | Med | Operational traceability |
| T1.11 | **C1 — Per-SKU / per-batch margin report** | `03-competitive-gap-analysis.md` | Low | High | Pure join; admin's "what did I make on prawns last week?" question |
| T1.12 | **C2 — Daily closing summary page** | `03-competitive-gap-analysis.md` | `04-vyapar-gap-analysis.md` | Low | High | Any shop owner asks this daily; needs `/daily-closing` page + view |
| T1.13 | **C3 — Per-vendor purchase history view** | `03-competitive-gap-analysis.md` | Low | High | Admin's primary purchasing question |
| T1.14 | **B7 — `sale_vendor_chain` view** | `02-client-side-logic-for-backend.md` | Low | High | N+1 → 1 query on `CustomerCard`; also unblocks provenance chain on `FishCard` (A15) |
| T1.15 | **A15 — Provenance chain surfaced in `FishCard` + `CustomerCard`** | `01-backend-without-frontend-gaps.md` | Low | **High** | The wholesaler's most-asked question in commodity trading |

**Tier 1 total: ~15 items, 1-2 weeks of focused work.** All pure SQL views + small UI tweaks + 1 new page (`/containers`) + 1 new page (`/daily-closing`). Zero migrations beyond view definitions.

## Tier 2 — Festival intelligence + Vyapar essentials (2-3 weeks)

**Why Tier 2:** These require new schema (mostly) but each is a feature the wholesaler doesn't currently have. Festival awareness is the headline differentiator. Customer baseline pricing directly addresses D31's pain point.

| # | Item | Source doc | Difficulty | Value | Notes |
|---|---|---|---|---|---|
| T2.1 | **F1 — `indian_festivals` table + seed** | `05-forecasting-roadmap.md` | Low | **High** | Hand-curated TN calendar, ~30 rows |
| T2.2 | **F2 — `demand_calendar` view + `forecast_sku_demand` RPC** | `05-forecasting-roadmap.md` | Low | **High** | Headline forecast; weekday-vs-weekend is free |
| T2.3 | **F3 — `festival_demand_lift` table + Edge Function** | `05-forecasting-roadmap.md` | Med | **High** | Empirical lift factors per festival per SKU |
| T2.4 | **F4 — Admin dashboard Forecast widget** | `05-forecasting-roadmap.md` | Med | **High** | Compact widget on `/admin` |
| T2.5 | **F5 — `forecast_sku_price` RPC** | `05-forecasting-roadmap.md` | Low | Med | Admin-only (D31) |
| T2.6 | **C12 — Low-stock notification type** | `03-competitive-gap-analysis.md` | Low | **High** | Already infrastructure exists (D27, D46) |
| T2.7 | **C13 — Expiring-soon container dashboard** | `03-competitive-gap-analysis.md` | Low-Med | **High** | The killer food-industry feature; Unleashed ships "expiry-due dashboard" |
| T2.8 | **C14 — Per-buyer pricing baseline** | `03-competitive-gap-analysis.md`, `06-creative-extensions.md` (C49) | Med | **High** | Most strategically important gap |
| T2.9 | **C15 — Quality grade tag at receiving** | `03-competitive-gap-analysis.md`, `06-creative-extensions.md` (C50) | Med | **High** | Fish size/grade drives price |
| T2.10 | **C25 — Daily cash reconciliation** | `06-creative-extensions.md` | Low | **High** | Critical for cash-based Indian wholesale |
| T2.11 | **C28 — Catch-location analytics on `VendorCard`** | `06-creative-extensions.md` | Low | Med | `vendors.port_or_village` already in schema |
| T2.12 | **C34 — Bulk container registration UI** | `06-creative-extensions.md` | Low | Med | D32's convenience action |
| T2.13 | **A9 — Overdue-reconciliation notification** | `01-backend-without-frontend-gaps.md` | Med | **High** | D27 Track C infra unblocks this + others |

**Tier 2 total: ~13 items, 2-3 weeks of focused work.** 4 migrations (festival calendar, forecast RPCs, customer_prices table, low-stock notification type), 1 Edge Function (festival-lift-calculator), 1 new component (ForecastWidget), 2 new pages (`/forecasts`, `/festivals`), several existing pages updated.

## Tier 3 — Supply forecasting + admin reports (2-3 weeks)

**Why Tier 3:** Fish catch forecasting is the other headline differentiator. The admin reports round out the Vyapar-parity story. These need either weather API integration or are big analytical views.

| # | Item | Source doc | Difficulty | Value | Notes |
|---|---|---|---|---|---|
| T3.1 | **F6 — `fishing_ban_periods` + `forecast_supply` RPC** | `05-forecasting-roadmap.md` | Med | **High** | Supply-side baseline |
| T3.2 | **F7 — Weather API integration (IMD + Open-Meteo fallback)** | `05-forecasting-roadmap.md` | Med | Med | Daily cron; needed for accurate supply forecast |
| T3.3 | **F9 — Lunar calendar overlay** | `05-forecasting-roadmap.md` | Low | Low | 1 function + 1 line integration |
| T3.4 | **F8 — "What should I buy tomorrow?" composite** | `05-forecasting-roadmap.md` | Med-High | **High** | Headline operational forecast; combines F2 + F6 + F7 |
| T3.5 | **F4-followup — Forecast change ≥15% drift notification** | `05-forecasting-roadmap.md` | Low | Med | Hourly cron; pushes `forecast_alert` notifications |
| T3.6 | **C16 — Vendor price list baseline** | `03-competitive-gap-analysis.md` | Med | Med | Catches vendor price hikes before bill reconciliation |
| T3.7 | **C18 — Proof-of-delivery photo on sale** | `03-competitive-gap-analysis.md` (blocked on D19) | Med | **High** | New `sale_proofs` table; needs D19 R2 plumbing |
| T3.8 | **C29 — Buyer WhatsApp templates** | `06-creative-extensions.md` | Low-Med | **High** | Closes customer-facing side of D31; ShareComposer reuse |
| T3.9 | **A4 — `check_ins` view on `EmployeeCard`** | `01-backend-without-frontend-gaps.md` | Low | Med | Closes a real existing gap |
| T3.10 | **A7 — Recent vendor payments on `VendorCard`** | `01-backend-without-frontend-gaps.md` | Low | Med | Currently admin has no UI to see past payments |
| T3.11 | **C7 — Container utilisation report** | `03-competitive-gap-analysis.md` | Low | Med | Capacity planning |
| T3.12 | **C4 — Spoilage trend report** | `03-competitive-gap-analysis.md` | Low | Med | Food-waste is a real cost driver |
| T3.13 | **C27 — Receipt printing (browser print + Bluetooth)** | `06-creative-extensions.md` | Med | **High** | Tangible worker experience win |
| T3.14 | **C45 — Daily/weekly admin email digest** | `06-creative-extensions.md` | Low | Med | Trivial Edge Function |
| T3.15 | **B6 — `employee_activity_summary` view** | `02-client-side-logic-for-backend.md` | Low | Med | Used by both `EmployeeCard` and any "who does what" report |

**Tier 3 total: ~15 items, 2-3 weeks of focused work.** 3 migrations (fishing ban, weather cache, forecast change log), 2 Edge Functions (weather-cache, forecast-drift-monitor), 3 new views, several pages updated.

## Tier 4 — Creative / out-of-scope candidate (as needed)

**Why Tier 4:** Each item is a small standalone build; pick based on real user demand rather than shipping speculatively.

| # | Item | Source doc | Difficulty | Value | Notes |
|---|---|---|---|---|---|
| T4.1 | **C21 — Outbound delivery tracking** | `06-creative-extensions.md` | Med-High | **High** | D29's `in_transit_outbound` already provisioned; blocked on business-policy answers |
| T4.2 | **C24 — Vehicle/transport-cost tracking** | `06-creative-extensions.md` | Med | Med | Better as part of C21 |
| T4.3 | **C30 — Multi-unit support (kg + maund + dozen)** | `06-creative-extensions.md` | High | Low | Invasive; **ask wholesaler first** |
| T4.4 | **C31 — Wage/commission calculation for reps** | `06-creative-extensions.md` | Med | Med | D47 deferred |
| T4.5 | **C32 — Buyer self-service via tokenised URL** | `06-creative-extensions.md` | High | Med | BlueCart/OrderEase pattern; conflicts with D34/D36 |
| T4.6 | **C35 — Mobile Bluetooth ESC/POS printing** | `06-creative-extensions.md` | High | Med | Bluetooth pairing UX is real |
| T4.7 | **C36 — Cash drawer / till-management screen** | `06-creative-extensions.md` | Med | Low | Vyapar has this on desktop |
| T4.8 | **C38 — Bid/auction support for spot-priced fish** | `06-creative-extensions.md` | High | Low | Whole new workflow |
| T4.9 | **C41 — Expense ledger** | `06-creative-extensions.md` | Med | Med | Bookkeeping overhead |
| T4.10 | **C42 — Profit snapshot per trip** | `06-creative-extensions.md` | Med | **High** | If C21 ships, this becomes natural |
| T4.11 | **C44 — Buyer request workflow ("Suresh wants 5kg pomfret tomorrow")** | `06-creative-extensions.md` | Med | Med | D44's pre-order interest |
| T4.12 | **C47 — Multi-photo per record** | `06-creative-extensions.md` | Med | Med | Once D19 unblocks |
| T4.13 | **C19 — Partial-payment / instalments** | `03-competitive-gap-analysis.md` | Med | Low-Med | Some buyers may need it |
| T4.14 | **C20 — Damage/loss tracking distinct from spoilage** | `03-competitive-gap-analysis.md` | Med | Low-Med | Some wholesalers distinguish |
| T4.15 | **C8 — Container utilisation report** | `03-competitive-gap-analysis.md` | Low | Med | Same as T3.11; called out separately here for completeness |
| T4.16 | **C10 — Price-history visualisation in-app** | `03-competitive-gap-analysis.md` | Low-Med | Med | Already exposed via T1.5 (price history panel on `FishCard`); in-app chart is a Tier 4 nice-to-have |
| T4.17 | **C11 — Per-employee activity summary** | `03-competitive-gap-analysis.md` | Low | Low-Med | Covered by T3.15 |
| T4.18 | **C39 — Bulk weight conversion (kg to maund)** | `06-creative-extensions.md` | Low | Low | Cheap; marginal value |

## Total roadmap summary

| Tier | Items | Effort | What it ships |
|---|---|---|---|
| **Tier 1** | 15 | 1-2 weeks | "Does the obvious thing work?" — analytics views, missing pages, technical debt |
| **Tier 2** | 13 | 2-3 weeks | "Festival-aware intelligence" — headline differentiator |
| **Tier 3** | 15 | 2-3 weeks | "Catch forecasting + admin reports" — second headline differentiator |
| **Tier 4** | 18 | as needed | "Vyapar parity on a fish-wholesale angle" |

**Grand total: 61 candidate items, of which T1+T2+T3 (43 items) would take 5-8 weeks of focused work and ship a Vyapar-comparable + festival-aware forecasting + fish-catch forecasting + creative fish-wholesale features product.**

## Highest-leverage items (top 10 across all tiers)

If you only have time for 10 things, do these first:

1. **T1.4** — `stock_by_sku` view (B5, decision-24 tech debt)
2. **T1.12** — Daily closing summary (C2)
3. **T1.7** — `/containers` admin page (A5)
4. **T2.4** — Admin dashboard Forecast widget (F4)
5. **T2.1+T2.2** — Indian festival calendar + demand forecast (F1+F2)
6. **T2.8** — Per-buyer pricing baseline (C14/C49, D31's pain point)
7. **T3.4** — "What should I buy tomorrow?" composite (F8)
8. **T1.13** — Per-vendor purchase history view (C3)
9. **T2.7** — Expiring-soon container dashboard (C13)
10. **T1.15** — Provenance chain surfaced (A15)

## Per-tier dependency graph (simplified)

```
T1 (no dependencies — all pure SQL views + small UI)
  ↓
T2 (depends on T1's stock_by_sku for the Forecast widget's data fetch)
  ↓
T3 (depends on T2's forecast RPCs as inputs to the composite, plus the weather cache)
  ↓
T4 (standalone — pick as needed)
```

Within a tier, items are independent. Across tiers, T2-T4 each depend on the previous tier's core deliverables.

## How to use this doc

- **Spec author:** read `00`, `07`, `08`. Pick a tier to start with. Each item in the tier maps to a SPEC.md amendment + 1+ migrations + 1+ pages in `08-spec-amendment-deltas.md`.
- **Frontend dev:** read `00`, `07`, then the relevant tier items. Each item names the page or component that needs the change.
- **Backend dev:** read `00`, `07`, `02`, `05`. Each item names the view/RPC/migration.
- **Wholesaler / admin:** read `00`, `07`. The tiers are the conversation framework for "what would you like first?"
