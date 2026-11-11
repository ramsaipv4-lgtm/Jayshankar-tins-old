# 06 — Creative extensions beyond pure inventory

> The user said: *"i think my app is not a pure inventory management app so think creatively in this direction too."* This document lists features that aren't standard inventory capabilities but are plausibly valuable for a Tamil Nadu fresh-fish wholesale. Some are derivable from existing data; most need new schema or external integration.

Each item: classification, difficulty, value, notes.

| # | Feature | Classification | Difficulty | Value | Notes |
|---|---|---|---|---|---|
| **C21** | **Outbound delivery tracking** — when a worker takes fish to a buyer, record who took it, when, in what vehicle, planned vs actual delivery time | **New schema** (vehicles, trips, trip_line_items) + UI | Med-High | **High** | D29's `in_transit_outbound` is provisioned in `locations` (migration 0031 trigger) but has no caller. Decision #80 says outbound checkout is "no-op for now" pending two real business-policy answers. The user (wholesaler) needs to articulate: (a) does a worker take a whole container to one buyer, or mix-and-match to several buyers in one trip? (b) when a vehicle returns, is unsold fish auto-spoiled, re-packaged, or returned-to-stock? Until those are answered, schema-design is premature. |
| **C22** | **Cold-chain temperature log** | **New schema** (sensors, readings, devices) + IoT integration | High | Med | Requires IoT hardware in the warehouse. Low priority for now. |
| **C23** | **Weather/fishing-season integration** — tag deliveries by weather / season for catch-quality analytics | Already covered by F7 (weather API) | Low | Med | Tag every `batches.delivered_at` with the day's `weather_observations_cache.condition`. Lets the admin ask "did rainy-day catches have more spoilage complaints?" over time. |
| **C24** | **Vehicle/transport-cost tracking** — ice, fuel, transport per delivery | **New schema** (`trip_costs` or extend `bills`) | Med | Med | Marginal value; admin overhead. Better as Trip-level field added when C21 ships. |
| **C25** | **Daily cash reconciliation** — count physical cash vs `payments WHERE method='cash'` | **Buildable-from-existing-data** (just a query against `payments` joined to date) | Low | **High** | Important for an Indian wholesale shop that runs on cash. Surface as `/daily-closing` page: today_cash_collected, today_upi_collected, today_bank_collected, today_total_collected. Compare to expected (sum of `sales.total_amount` where not yet paid by other means). |
| **C26** | **Document management** — fishing licenses, GST certificates, permits per vendor | **New schema** (file attachments, depends on D19 R2 plumbing) | Med | Med | Compliance-driven; depends on D19 being unblocked. |
| **C27** | **Receipt printing** — browser print / Bluetooth thermal printer | **New feature** (browser print stylesheet + optional Web Bluetooth) | Med | High | Tangible win for the worker handing fish to a buyer. Browser print covers most cases (print-to-PDF for record; print-to-thermal-printer via OS print dialog). Bluetooth ESC/POS is fancier but adds Bluetooth pairing UX. |
| **C28** | **Catch-location analytics** — `vendors.port_or_village` exists but is never surfaced | **Buildable-from-existing-data** | Low | Med | Already in schema; show in `VendorCard`. Could also feed a "deliveries by port" map view (Looker). |
| **C29** | **Buyer WhatsApp templates** (per-buyer — D45 only does vendor templates) | **Buildable-from-existing-data** + ShareComposer reuse | Low-Med | **High** | Closes the customer-facing side of D31's differential-pricing concern. Today the admin can compose and share a vendor's bill via `ShareComposer`; same component needs to support a buyer's outstanding balance, recent sales, etc. |
| **C30** | **Multi-unit support** (kg + maund + dozen pieces) | **New schema** (`units` table, `skus.unit` becomes FK) + UI | High | Low | Tamil Nadu sells fish by kg AND maund AND piece (pomfret is sold by piece, sardines by kg). Current schema has `skus.unit` as a free-text field. Adding a real unit system requires migration of all kg-typed columns (numeric(10,3) → numeric + unit), which is invasive. **Ask the wholesaler first** before committing — they may be fine with kg + a per-piece override field. |
| **C31** | **Wage/commission calculation for reps** (deferred per D47) | **New schema** (`wage_tiers` or extend `users`) + view | Med | Med | Worker compensation based on kg sold. Requires business input on the commission rate structure. |
| **C32** | **Buyer self-service via tokenised URL** (no login, just a link) | **New auth model** | High | Med | BlueCart/OrderEase pattern. **Conflicts with D34/D36** which use Supabase Auth. Would need a separate token-issuing RPC and a public-read-only Edge Function. Future-mode candidate. |
| **C33** | **Catch forecasting** (analytics on what fish is likely available tomorrow based on past 30 days) | **Buildable-from-existing-data + view** | Low | Med | Drives purchasing decisions. **Already covered by F8 (reorder_recommendation).** |
| **C34** | **Bulk container registration UI** (D32 — register 6 of the 10kg size) | **Buildable-from-existing-data + small UI** | Low | Med | D32's own convenience action, never built. A `/containers` admin page with a "register 6× 10kg" form. |
| **C35** | **Mobile receipt printing via Bluetooth ESC/POS** | **New feature** (Web Bluetooth API + ESC/POS command generator) | High | Med | Worker handing fish to a buyer. Tangible but adds Bluetooth pairing UX. |
| **C36** | **Cash drawer / till-management screen** | **New schema** (cash_drawer_sessions) | Med | Low | Vyapar has this on desktop. Jayshankar's per-payment method tracking is closer to "right amount per payment" than "running drawer total". Future if needed. |
| **C37** | **Vehicle maintenance log** (own fleet vs hired) | **New schema** (vehicles, maintenance_records) | Med | Low | Marginal unless Jayshankar operates its own fleet. |
| **C38** | **Bid/auction support for spot-priced fish** (rare species sold at market-clearing price) | **New schema** (bids, auction_sessions) + UI | High | Low | Whole new workflow. Not in the wholesaler's stated needs. Future-mode candidate. |
| **C39** | **Bulk weight conversion (kg to maund, kg to dozen pieces)** | **Buildable-from-existing-data** (lookup table) | Low | Low | Cheap to add, marginal value. Even Tamil Nadu users are comfortable with decimal kg. |
| **C40** | **Catch location tracking** (which port did this come from) — already in `vendors.port_or_village` | **Buildable-from-existing-data** | Low | Med | Same as C28. Surface in `VendorCard` and a Looker Studio map. |
| **C41** | **Expense ledger** (ice, fuel, transport, wages) | **New schema** (expenses table, expense_categories) | Med | Med | Useful but adds bookkeeping overhead. Vyapar has this. |
| **C42** | **Profit snapshot per trip** — given a trip's sales, what was the margin on that trip? | **Buildable-from-existing-data** (depends on C21 + existing sale data) | Med | **High** | If outbound delivery tracking ships (C21), this becomes natural — every trip has a margin. |
| **C43** | **Stock transfer to a buyer's vehicle on the lot** — for buyers who come pick up at the warehouse | **New schema** (vehicle-side inventory) | High | Low | Whole new operational model. Future-mode candidate. |
| **C44** | **Buyer request workflow** — buyer calls ahead, admin records "Suresh wants 5kg pomfret tomorrow", surfaces on admin's morning list | **New schema** (buyer_requests) | Med | Med | Matches D44's "fish pre-orders" feature interest. Not the same as pre-orders in e-commerce sense. |
| **C45** | **Daily/weekly admin email digest** | **New Edge Function** (cron, daily) | Low | Med | Trivial implementation: nightly cron queries today's totals, formats a small HTML email, sends via transactional email provider. D26's discipline doesn't preclude this since it's external. |
| **C46** | **Push notifications to admins on key events** (low-stock, expiring-soon containers, weather warnings) | **Buildable + new notification types** | Low | **High** | Multiple notification types already exist (`bill_received`, `customer_over_limit`, `delivery_discrepancy`, `tasks_reassigned`, `reversal_requested`, `reversal_auto_approved`, `task_completed`, `forecast_alert` once F2 ships). Add `low_stock` (C12), `container_expiring_soon` (C13), `delivery_weather_warning` (F7), `task_overdue` (C13). All ride the existing `NotificationBell` infrastructure. |
| **C47** | **Multi-photo per record** (currently single `photo_status` column on `receiving_confirmations`; A5/A11 are about this) | **New schema** (record_photos 1-to-many) | Med | Med | Deferred per D19. Once R2 plumbing exists, this unlocks multiple photo features. |
| **C48** | **Proof-of-delivery photo on sale** — buyer takes photo of fish loaded onto their vehicle, or admin snaps one | **New schema** (`sale_proofs`) + D19 plumbing | Med | **High** | Protects against quality disputes. Same R2 plumbing as C47. |
| **C49** | **Per-buyer pricing baseline** — admin sets a default `sale_price_per_kg` per buyer per SKU; sale form pre-fills but stays per-sale overridable per D31 | **New schema** (`customer_prices` table) + UI | Med | **High** | Most strategically important gap. See `03-competitive-gap-analysis.md` and `08-spec-amendment-deltas.md`. |
| **C50** | **Quality grade tag at receiving** — grade-A vs grade-B vs damaged tagging, distinct from kg-discrepancy | **New schema** (`receiving_confirmations.quality_grade` enum + comment) | Med | **High** | Fish size/grade drives price. D49 complaints currently surface grade mismatches post-hoc; this surfaces them at receiving. |

## Most relevant creative extensions for V1 (the spec author's must-read)

The five items most worth shipping as part of any "Vyapar-like but fish-wholesale" build:

1. **C49** — Per-buyer pricing baseline (D31's pain point)
2. **C46** — Multi-event push notifications (low-stock, expiring containers, weather warnings)
3. **C48** — Proof-of-delivery photos (depends on D19)
4. **C25** — Daily cash reconciliation
5. **C27** — Receipt printing (browser print + optional Bluetooth)

These are listed in priority order in `07-tiered-build-priority.md` with effort estimates.

## "Vyapar-like but different" — what "different" means here

The user said *"something similar but different that is customised for them."* The "different" parts are:

| Vyapar | Jayshankar |
|---|---|
| GST invoicing | Fish-delivery sales + payments (no GST — dormant track) |
| Desktop-first, mobile mirror | **Mobile-first per D18** (Capacitor + Android) |
| Single app | Single app, 5 roles (D28 — D28 explicitly rejects multi-app) |
| Generic for any business | Domain-specific: fish, containers, shelf-life, festivals, catch |
| 30 reports, **0 forecasting** | ~30 reports + **festival-aware, weekday-pattern, fish-catch forecasting** (Vyapar has none of this) |
| Barcode scanning | QR-code per container (D21 mention) — different scanning story |
| English UI + a couple of Indian languages | **Bilingual EN + TA, with Tamil fish names from the wholesaler's own spreadsheet** |
| Worker is generic | Worker role is "haul fish to buyer, sync when back online" — D30 worker offline writes |
| Sales staff GPS tracking | **No** — D28 rejects separate sales-staff app |
| Predictive AI for forecasting | Seasonal-naive + festival multiplier + weather penalty + lunar — explainable, no ML black box |

The "Vyapar-like" parts are: the same general UX shape (dashboard summary + reports tab), the same B2B payment/credit-ledger framing, the same barcode/scanner entry path (replaced with QR-for-containers in Jayshankar's case), the same inventory-counts-and-thresholds mental model.

## Out-of-scope reminders for this section

- No retail POS (D15)
- No GST e-invoicing (D24 dormant)
- No barcode scanning of products (D13)
- No manufacturing BOMs
- No e-commerce storefront
- No customer loyalty / gift cards
- No hosted ML forecasting services (D17 + D31 spirit — derived, not stored, and explainable)

## Why this section exists

`03-competitive-gap-analysis.md` and `04-vyapar-gap-analysis.md` are about what other apps *have* that Jayshankar *doesn't*. This section is about features *neither Jayshankar nor any competitor has for this specific domain* — features a fresh-fish wholesaler plausibly wants but no existing tool offers cleanly. They're the spec author's creative latitude.
