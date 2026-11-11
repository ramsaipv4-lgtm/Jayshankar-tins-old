# Recommendations — Jayshankar Mode B / C roadmap

> **Status:** documentation only. **Nothing here was applied to the codebase.** Every recommendation is a *build target* — code changes (migrations, RPCs, pages) that would land under separate PRs following the project's TINS discipline (`SPEC.md` amendment → migration → validator gate → app code).

## What this directory is

This is the consolidated "what's missing and what should we build next" document for Jayshankar, produced from a thorough audit of the current codebase (39 SQL migrations 0001–0039, 25 page components, 8 shared components, 8 lib files, project meta) and a competitive analysis of 12 inventory-management apps + the explicitly-requested Vyapar reference.

It's written so that:

- **A frontend dev** can read just the relevant section and know what to build.
- **An architect / spec author** can read `01`, `03`, `04`, and `08` and know what SPEC amendments to write.
- **The wholesaler / admin** can read `00` + `07` and see what's being proposed, in what order, and why.

## How this is organised

| File | Question it answers | Audience |
|---|---|---|
| `00-readme.md` *(this file)* | What is this directory and how do I read it? | Everyone |
| `01-backend-without-frontend-gaps.md` | What has the backend been writing that no page reads? | Spec author, frontend dev |
| `02-client-side-logic-for-backend.md` | What client-side computations should be Postgres views / RPCs instead? | Backend dev, spec author |
| `03-competitive-gap-analysis.md` | What features do 12 popular inventory apps have that Jayshankar doesn't? | Spec author, product owner |
| `04-vyapar-gap-analysis.md` | What would "Vyapar-like reports and dashboards" actually look like for a fish wholesale? | Spec author, product owner |
| `05-forecasting-roadmap.md` | How do we build price / demand / festival-aware / fish-catch forecasting? | Spec author, backend dev |
| `06-creative-extensions.md` | What features beyond inventory does a fish-wholesale business plausibly need? | Product owner, spec author |
| `07-tiered-build-priority.md` | In what order should we build, and why? | Everyone — especially the wholesaler deciding what to approve |
| `08-spec-amendment-deltas.md` | Exactly which SPEC.md amendments + migrations would ship each tier? (NOT applied — documented for future PRs.) | Spec author, backend dev |

## Scope and standing rules

**In scope (this doc):** all features a fish wholesaler in Tamil Nadu plausibly wants from this app. Includes reporting, analytics, forecasting, CRM extensions, logistics, mobile, creative extensions.

**Out of scope (per SPEC §9 + locked decisions D13, D15, D24, D28):** retail POS / checkout, GST e-invoicing / e-way bill, bar code scanning, manufacturing BOMs, multi-store (D23 covers multi-warehouse only), e-commerce storefront, payment processing / card readers, customer loyalty programmes, predictive AI hosted services.

**Standing rules respected throughout:** soft-delete via `active=false`, append-only audit/sales/movements/payments, derived-not-stored (D17), no price broadcast (D31 — forecasts are admin-internal only, never auto-pushed to a buyer), `+91` baked in (D39), `numeric(10,2)` for money, server-side IST for time, no offline write-queue outside worker role (D30), bilingual EN+TA with Tamil fish names from the client's own spreadsheet (`example-video/Weekly Report.xlsx`).

## Forecast delivery surface (locked)

Three layers, plus push notifications on meaningful change:

1. **Compact widget on Admin dashboard** — next-7-day demand per top-10 SKU, with festival overlay badges.
2. **Dedicated `/forecasts` page** — every forecast that doesn't fit on the dashboard: price forecast, fish-catch forecast, "what should I buy tomorrow" composite, scenario what-ifs, the full festival calendar with current/per-festival multipliers.
3. **Looker Studio** — deep historical analysis, drill-downs, custom charts. Same D26 discipline: in-app is transactional, Looker is analytical.
4. **Push notifications** — fired when any active forecast changes by ≥15% from its previous value. Default 15%; configurable later via a settings table (not built in this pass).

## Weather API (locked)

**IMD public API primary**, Open-Meteo as graceful fallback. Every forecast row carries a `data_source` enum (`'imd' | 'open_meteo' | 'cache_only'`) so the UI surfaces "(using Open-Meteo fallback — IMD unavailable)" honestly when degradation kicks in. IMD is authoritative for Tamil Nadu but flaky in practice; Open-Meteo is no-key and no-rate-limit, so the forecast never breaks — it just degrades.

## Indian festival calendar scope (locked)

**Tamil Nadu-focused** (~25-30 named festivals/year, hand-curated) seeded once into the `indian_festivals` table. A generic national list overstates relevance and under-curates regional festivals (Pongal, Puthandu, Aadi, Aadi Perukku, etc. have very specific fish-demand profiles in Tamil Nadu). Lift factors per festival per SKU start at 1.0 and are populated from the wholesaler's own history as data accumulates.

## Where the code would go (NOT applied — documented for future PRs)

```
supabase/migrations/
  0040_indian_festivals.sql                  # hand-curated TN festival calendar
  0041_festival_demand_lift.sql              # per-SKU per-festival lift factors
  0042_demand_calendar_view.sql              # sales velocity by SKU × dow × month
  0043_fishing_ban_periods.sql               # TN state-declared ban weeks
  0044_weekly_sku_velocity_view.sql          # weekly kg_sold/purchased/revenue/margin
  0045_vendor_reliability_view.sql           # deliveries count, on-time %, false-claims
  0046_customer_lifetime_value_view.sql      # total purchases, revenue, order cadence
  0047_forecast_rpcs.sql                     # forecast_sku_demand, forecast_sku_price, festivals_in_window
  0048_reorder_recommendation_rpc.sql        # "what should I buy tomorrow" composite
  0049_weather_observations_cache.sql        # IMD primary + Open-Meteo fallback table
  0050_forecast_change_log.sql               # for the ≥15% push-notification trigger

supabase/functions/
  weather-cache/                            # daily cron, IMD → Open-Meteo fallback
  festival-lift-calculator/                  # nightly, scans last-N-years sales around festivals
  forecast-drift-monitor/                   # hourly/daily, computes drift from previous forecast

src/pages/
  Forecasts.tsx                             # /forecasts — every forecast not on the dashboard widget
  DailyClosing.tsx                          # /daily-closing — end-of-day summary
  ExpiringSoon.tsx                          # /expiring-soon — container fill expiry alerts
  VendorPurchaseHistory.tsx                 # vendor-level purchase aggregation
  FestivalCalendar.tsx                      # /festivals — full year view with current multipliers

src/components/
  ForecastWidget.tsx                        # compact widget for the admin dashboard
  ForecastChangeBadge.tsx                   # "↑ 23%" badge with explanation tooltip
```

(Detailed amendment deltas in `08-spec-amendment-deltas.md`.)

## How to read this in 10 minutes

1. `00-readme.md` (this file) — orientation
2. `07-tiered-build-priority.md` — the build order
3. `01-backend-without-frontend-gaps.md` — the lowest-cost wins
4. `05-forecasting-roadmap.md` — the headline differentiator

That's 70% of the value in 10 minutes. The other files fill in the detail.
