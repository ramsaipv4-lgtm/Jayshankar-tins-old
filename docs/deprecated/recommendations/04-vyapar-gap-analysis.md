# 04 — Vyapar gap analysis (Vyapar Desktop + Mobile parity)

> Research date: 2026-09-15. The user explicitly named Vyapar as a reference app: *"they were using the vyapar application and wanted something similiar but different that is customised for them."* This document captures what Vyapar actually does and maps it to what Jayshankar needs to deliver to satisfy that "Vyapar-like but fish-wholesale" target.

## Sources fetched

| URL | Status | What it gave |
|---|---|---|
| `https://vyaparapp.in/` | 200 | Top-level feature inventory |
| `https://vyaparapp.in/features/` | 404 | Content lives on the `free/*` pages, not a single features index |
| `https://vyaparapp.in/desktop-features/` | 404 | Same |
| `https://vyaparapp.in/mobile-app/` | 404 | Mobile framed as a download CTA on the same root |
| `https://vyaparapp.in/gst-accounting-pc` | 200 | Full Desktop/PC feature page |
| `https://vyaparapp.in/free/invoicing-software` | 200 | Invoicing feature list, recurring, quotations, GST+non-GST |
| `https://vyaparapp.in/free/inventory-management-software` | 200 | Inventory: FIFO, batch, expiry, multi-godown, low-stock, custom fields, barcode |
| `https://vyaparapp.in/free/small-business-accounting-software` | 200 | The only page that **enumerates the report names** |
| `https://vyaparapp.in/free/pos-billing-software` | 200 | POS-specific: multi-counter sync, barcode billing, loyalty, weighing scale integration |
| `https://play.google.com/store/apps/details?id=in.android.vyapar` | 200 | 4.8★, 10M+ downloads, 194K reviews |
| `https://apps.apple.com/in/app/vyapar-billing-invoice-app/id6478382307` | 200 | iOS description; release notes — **highest-density source for actual report names** |

**Key methodology note:** the Play Store + App Store release notes were the highest-density source for *actual* feature names because Vyapar ships a named report with each major version. The pricing/plan tables on every `free/*` page gave me which features sit behind which tier (Free / Silver / Gold / Retail Pro / Platinum).

## Part 1 — Vyapar's actual feature inventory

### 1.1 Dashboard / home-screen widgets

| Widget | Where confirmed |
|---|---|
| Total sales today / this week / this month | accounting page, accounting dashboard |
| Total purchases today | accounting page |
| Total expenses | accounting page |
| Cash / bank balance | PC page — "View your bank balances, cash-on-hand, total sales, and expenses" |
| Receivables / payables outstanding | accounting page |
| Low-stock alerts (per-item threshold, push + banner) | inventory + accounting pages |
| Stock value (FIFO cost × qty) | inventory page |
| Top-selling items | iOS description, POS page |
| Pending payments (paid/unpaid/overdue) | invoicing page |
| Profit & Loss snapshot | accounting page |
| Sales trend | PC page mentions charts are delivered via the Reports tab, not the dashboard |

**Shape:** Vyapar's dashboard is a *summary*, not the *charting* surface. Charts all sit under a Reports tab. Mobile home screen mirrors the same widgets with push-notification banners layered on.

### 1.2 The actual report inventory (~30 reports)

Pulled from the accounting page's "Get Real-Time Financial Accounting Reports" section, plus iOS release notes:

| # | Report | Plan gate |
|---|---|---|
| 1 | Transaction report (sales, purchases, P&L, daybook, balance sheet, trial balance) | Free |
| 2 | Party report (party statements, party-wise P&L, sales/purchase by party or party-group) | Free |
| 3 | GSTR-1, GSTR-2, GSTR-3B, GSTR-9, GSTR-9A | Gold+ |
| 4 | Item / Stock report (stock levels, low-stock summary, item-wise P&L, discounts, item detail, item by party) | Free |
| 5 | Tax report (GST rate report, TCS, TDS) | Free |
| 6 | Expense report (by category, by item) | Free |
| 7 | Sales / Purchase Order report (status, fulfillment) | Free |
| 8 | Other Income report (by category, by item) | Free |
| 9 | Sale/Purchase by Party Group report | iOS v9.8 |
| 10 | Sale Aging / Purchase Aging | iOS v9.7 |
| 11 | HSN/SAC summary by sale | iOS v9.0 |
| 12 | Stock Transfer report | iOS v9.6 |
| 13 | Item Serial / IMEI report | iOS v10.0 |
| 14 | Bank Statement report | iOS v9.4 |
| 15 | Discount report (incl. item-wise) | iOS v9.4 |
| 16 | Bill-wise Profit & Loss | iOS v9.4 |
| 17 | Loan Statement | iOS v10.0 |
| 18 | Manufacturing & Consumption | iOS v10.0 (Platinum) |
| 19 | Item Report by Party | iOS v9.6 |
| 20 | Tax Rate report | iOS v9.6 |
| 21 | Item Category Sales / Purchase | iOS v9.6 |
| 22 | VAT 201 report (UAE track) | iOS v10.0 |
| 23 | Low Stock Summary | iOS v9.6 |
| 24 | Item Detail | iOS v9.6 |
| 25 | Sale/Purchase by Party | iOS v9.4 |
| 26 | Profit & Loss (standalone) | Free |
| 27 | Balance Sheet | Free |
| 28 | Cash Flow | Free |
| 29 | Trial Balance | Free (Gold plan feature) |
| 30 | Day Book | Free |
| 31 | Chart of Accounts | Gold plan |

Marketing claim: *"50+ Accounting & GST Reports."* Real distinct report count: ~30.

### 1.3 Charts / visualizations

**Vyapar does not build a charting surface inside the app.** Charts are delegated to exports (Excel/PDF) that the user re-graphs elsewhere. The dashboard widgets are numeric summaries. The Reports tab exports tabular reports.

**This is the largest single gap between Vyapar and what the user is asking Jayshankar to deliver.**

### 1.4 Invoicing

- GST + non-GST invoicing from same UI
- GST rate selection per item (CGST/SGST/IGST)
- HSN/SAC codes
- **E-Invoice** (IRN, QR code) via GSP — Gold+
- **E-Way Bill** generation
- Recurring invoices (auto-schedule)
- Quotation / Estimate → Invoice conversion
- Proforma invoice
- Delivery Challan
- 14 invoice templates (Capterra)
- Custom invoice design (logo, font, color, fields, QR)
- A4 / Landscape / Thermal formats
- Barcode scanning on bill
- **Multiple payment modes in one bill** (cash + UPI + bank split)
- UPI QR code on invoice
- Multi-currency invoicing
- **Payment reminders** (WhatsApp + SMS)
- Paid/unpaid/overdue status on every invoice
- Cancel a sale (Silver+)
- Discount: item-level or overall
- **Bill-wise profit** (margin per bill)
- MRP-based billing
- Transaction SMS
- Receipt / bill book formats

### 1.5 Inventory

- Items with name, SKU, category, units, price, tax, custom fields
- Multiple units of measure
- **Batch tracking** (assign batch # per purchase entry)
- **Expiry date tracking + auto-alerts**
- **Multi-godown / multi-warehouse**
- **Low-stock alerts** (per-item threshold)
- **FIFO-based stock valuation** ("oldest stock is costed first")
- Automatic stock update
- Stock adjustment entries (damaged, lost, returned)
- Stock transfer report
- Item-wise P&L
- Item categories
- Bulk import from Excel
- Bulk update items (Silver+)
- Custom fields per item
- **Barcode generator / scanner**
- IMEI / Serial tracking
- **Manufacturing** items (raw materials → finished goods)
- **Weighing scale integration**

### 1.6 Party management

- Customer + Vendor unified as "Parties"
- Party ledger / running balance
- Party-wise P&L
- Sale/Purchase by Party / Party Group
- Receivables (who owes what, age)
- Payables (what we owe, age)
- Sale Aging / Purchase Aging
- Credit limit per customer (Gold+)
- Service / payment reminders
- **Loyalty points** (Retail Pro)
- Customer purchase history
- **Salesman / Field-staff GPS tracking** (separate sales-staff app)
- Multi-Counter sales-staff sync

### 1.7 Forecasting / analytics

| Feature | Vyapar? |
|---|---|
| Sales forecasting | ❌ Export-and-build-in-Excel is the workflow |
| Demand forecasting | ❌ |
| Price forecasting / price-trend analytics | ❌ |
| Reorder suggestions | ⚠️ Low-stock alert fires *after* threshold breach; not predictive |
| Cash-flow forecasting | ❌ Historical only |
| Profit forecasting | ❌ |
| Inventory forecasting | ❌ |
| Festival-aware anything | ❌ |
| Weekday vs weekend pattern detection | ❌ |
| "What was selling this time last year" comparison | ❌ |
| Demand spike detection | ❌ |
| Fish catch / supply forecasting | ❌ (out of domain) |

**This is the greenfield Jayshankar can own.**

### 1.8 Festival / seasonality awareness

**None.** Vyapar has a "Greetings & Offers" feature on Retail Pro (festive greetings on WhatsApp to customers) — **messaging**, not forecasting. They print "Send Diwali greetings / Christmas offers" but never model "demand for X will be 1.7× normal in the week before Diwali."

### 1.9 Mobile-specific vs Desktop-specific

**Same on both:** invoicing, inventory, accounting, payments, party management, all 30 reports.

**Mobile-only:**
- GPS-based salesman tracking
- Camera-based OCR scan-to-bill
- On-the-go stock check, instant push alerts
- Barcode scanning via phone camera

**Desktop-only:**
- Cash / bank / cheque / loan management screen
- Multi-counter / multi-device sync
- Thermal printer / cash drawer / weighing scale integration
- 15 regular-printer + 5 thermal-printer themes
- Keyboard-shortcut billing
- Manufacturing module (Platinum, desktop-tier)
- Tally import/export (Retail Pro desktop)
- Online Store setup (desktop)

The "Vyapar Partner" app is a separate Android app for sales-staff/field-rep use — analogous to Jayshankar's "thin worker surface" idea (D28).

### 1.10 Integrations

- Tally import/export (Retail Pro)
- Barcode scanner (USB / Bluetooth)
- Thermal printer (own brand + generic)
- Cash drawer, weighing scale, EDC machine, label printer
- UPI QR / payment links
- Vyapar TaxOne (their own GST filing product)
- Vyapar Table (their own restaurant POS)
- Vyapar Flyy (their own WhatsApp marketing)
- NeoDove (their own telecalling CRM)
- Payment gateways
- WhatsApp Business Cloud API
- Google Drive auto-backup
- Online Store (their own mini-storefront)
- OCR (purchase-bill scanner → auto-entry)
- M-POS (mobile POS sub-app)

### 1.11 Offline / sync

- Desktop: **offline-first**, billing continues with no internet, syncs when back online
- Desktop: Google Drive auto-backup
- Mobile: **offline-capable**
- Mobile: instant cloud sync between devices
- Multi-counter sync (multiple POS terminals in one shop)

**Notable:** Vyapar's mobile sync is the source of user complaints (reviews mention stock and payment mismatches). Jayshankar's D30 worker-offline-write-queue with conflict resolution is *more sophisticated* than Vyapar's mobile sync.

## Part 2 — Vyapar parity matrix vs Jayshankar

Legend: ✅ covered · ⚠️ partial · ❌ not covered · 🚫 out of scope

### 2.1 Dashboards

| Vyapar widget | Jayshankar | Notes |
|---|---|---|
| Total sales today | ✅ | Computed client-side from `sales` |
| Total purchases today | ✅ | "Today's deliveries and sales" |
| Total expenses | ⚠️ | No `expenses` table; cost is on `batches.price_per_kg_paid` |
| Cash / bank balance | ⚠️ | `payments.method` covers cash/UPI/bank, no running "cash drawer" total |
| Receivables outstanding | ✅ | `customer_credit_status` view |
| Payables outstanding | ✅ | `vendor_credit_status` view |
| Low-stock alerts | ✅ | Per-SKU `low_stock_threshold_kg`, StockBySku component |
| Stock value (FIFO × qty) | ✅ | D8 |
| Top-selling items | ⚠️ | Computable, no widget — Looker Studio covers |
| Sales trend (over time) | ❌ | Dashboard has no time-series chart |
| Pending payments | ✅ | `customer_credit_status` exposes days-overdue |
| P&L snapshot | ⚠️ | Computable, no dedicated widget |
| Profit per bill | ❌ | Computed-on-read, no UI |
| Top customers | ⚠️ | `customer_credit_status` shows balances; not sorted by volume |
| Profit margins by item | ⚠️ | Computable, no UI |
| **Cross-warehouse rollup** | ✅ | D23, feature-flagged until second warehouse exists |

### 2.2 Reports (Vyapar's 30 → Jayshankar status)

| Vyapar report | Jayshankar | Notes |
|---|---|---|
| Transaction report | ✅ via Looker | `daily_sales_summary` starter view (D26) |
| Party report / party-wise P&L | ✅ via Looker | `customer_credit_status`, `vendor_credit_status` |
| **GSTR-1, 3B, 9** | 🚫 | D24 dormant |
| Item/Stock report | ✅ via Looker | `container_availability`, FIFO cost derivable |
| Tax report | 🚫 | D24 dormant |
| Expense report | 🚫 | No expense table |
| Sale/Purchase Order report | ⚠️ | `bills` exist, no `orders` table |
| Other Income report | 🚫 | No `other_income` table |
| **Sale/Purchase Aging** | ⚠️ | Days-overdue exists per-customer; no aging UI surface |
| HSN summary | 🚫 | D24 dormant |
| Stock Transfer report | ✅ | `movements.kind='transfer'`, Looker query |
| Item Serial / IMEI report | 🚫 | Fish don't have serials. `container_id` (D21) is the equivalent. |
| Bank Statement report | 🚫 | No bank integration |
| Discount report | 🚫 | Per-D8 (per-batch pricing) and per-D31 (no standing price) |
| Bill-wise P&L | ✅ via Looker | Computable per sale |
| Manufacturing/Consumption | 🚫 | Not in domain. `repack` is the moral equivalent — not surfaced as a report. |
| Loan Statement | 🚫 | Not in domain |
| **Item Report by Party** | ✅ via Looker | Cross-join is straightforward |
| Low Stock Summary | ✅ | Admin dashboard widget |
| Item Detail | ✅ | SkuManagement page |
| **Day Book** | ✅ via Looker | All `movements` rows in time order |
| **Trial Balance** | 🚫 | No double-entry accounting; not in Jayshankar's model |
| **Chart of Accounts** | 🚫 | Same |
| **Cash Flow** | ⚠️ | Receivables/payables exist; true "cash in/out over time" unbuilt |
| Balance Sheet | 🚫 | No GL; no fixed assets |
| **Audit log viewer** | ✅ | `AuditLog.tsx` (admin only), filter by user/table/action/date |

### 2.3 Charts / visualizations

| Vyapar behavior | Jayshankar |
|---|---|
| Charts in the app | ❌ by design — D26 routes to Looker Studio |
| Sparklines / trend lines in dashboard | ❌ |
| Bar/line/pie charts | ❌ |
| Drill-down (click chart → table) | ✅ Looker Studio |

**This is a deliberate Jayshankar decision, not a gap.** The user explicitly asked to keep "no custom chart server" by routing through Looker Studio.

### 2.4 Invoicing

| Vyapar feature | Jayshankar |
|---|---|
| GST + non-GST invoicing | 🚫 D24 dormant. Non-GST equivalent is the `sales` row with free-text buyer. |
| HSN/SAC | 🚫 |
| E-Invoice (IRN/QR) | 🚫 |
| E-Way Bill | 🚫 |
| Recurring invoices | 🚫 Not in domain |
| Quotation → Invoice conversion | 🚫 Pre-sale quotation not in this business's flow |
| Proforma invoice | 🚫 |
| Delivery Challan | 🚫 Fish leaves with the hauler |
| Multiple invoice formats | ⚠️ Single sale record, no template picker |
| Custom invoice design | 🚫 Not needed at this scale |
| Barcode scanning on bill | 🚫 D13 |
| **Multiple payment modes in one bill** | ✅ `payments.method` per payment |
| UPI QR on invoice | 🚫 ShareComposer (D45) shares sale details as text |
| Multi-currency | 🚫 INR only |
| **Payment reminders** | ⚠️ `customer_over_limit` fires once; no recurring nudge |
| Paid/unpaid/overdue status | ✅ Per-customer via `customer_credit_status`; per-sale via B1 (planned) |
| **Cancel a sale** | ✅ `execute_sale_reversal` (D22) |
| Item-level or overall discount | 🚫 Per-D8 (per-batch pricing) and per-D31 |
| **Bill-wise profit** | ✅ Computable |
| MRP-based billing | 🚫 |
| Transaction SMS | 🚫 ShareSheet (D45) is the chosen channel |
| **Bill Book / Receipt** | 🚫 No thermal-receipt artifact |

### 2.5 Inventory

| Vyapar feature | Jayshankar |
|---|---|
| Items with custom fields | ✅ `skus` |
| Multiple UoM | ⚠️ kg only; containers are 5/10/15/20/25 kg + custom (D32) |
| **Batch tracking** | ✅ `batches` + per-batch `kg_remaining`, FIFO spoilage (D10) |
| **Expiry date tracking + alerts** | ✅ `container_fills.kg_remaining > 0` + `compute_container_fill_expiry()` |
| **Multi-warehouse** | ✅ D23 + cross-warehouse transfers |
| **Low-stock alerts** | ✅ per-SKU `low_stock_threshold_kg` |
| **FIFO-based stock valuation** | ✅ D8, D10 |
| Automatic stock update | ✅ Triggers on every mutation |
| **Stock adjustment (damage, loss, return)** | ✅ `spoilage` + `customer_complaints` |
| Stock transfer report | ✅ via Looker |
| Item-wise P&L | ✅ Computable |
| Item categories | ✅ |
| Bulk import from Excel | ⚠️ `scripts/seed-simulated-operations.mjs` reads Excel; no in-app bulk import |
| **Barcode generator / scanner** | 🚫 D13 |
| **IMEI / Serial tracking** | 🚫 Not in domain. `container_id` (D21) is the equivalent. |
| **Manufacturing** | 🚫 Not in domain. `repack` is the closest analog (D29). |
| **Weighing scale integration** | 🚫 Not in scope |

### 2.6 Party management

| Vyapar feature | Jayshankar |
|---|---|
| Customer + Vendor as Parties | ✅ Two separate tables (`customers`, `vendors`) |
| Party ledger / running balance | ✅ `customer_credit_status`, `vendor_credit_status` |
| Party-wise P&L | ✅ Computable |
| Sale/Purchase by Party | ✅ via Looker |
| **Receivables aging** | ✅ days-overdue on `customer_credit_status` |
| **Payables aging** | ✅ `vendor_credit_status` |
| **Credit limit per customer** | ✅ D33 (soft) |
| Credit period per customer | ✅ D33 (`credit_period_days`) |
| Payment reminders (auto) | ⚠️ `customer_over_limit` event only |
| **Loyalty points** | 🚫 Not in domain |
| Customer purchase history | ✅ `CustomerCard` |
| Salesman GPS tracking | 🚫 D28 — no separate rep app |
| Multi-counter sync | 🚫 Single-counter reality (D29) |

### 2.7 Forecasting — **Vyapar has none; this is Jayshankar's greenfield**

See `05-forecasting-roadmap.md` for the full build sequence.

### 2.8 Festival / seasonality — **Vyapar has none**

Same — see `05-forecasting-roadmap.md`.

### 2.9 Mobile vs Desktop

| Capability | Jayshankar |
|---|---|
| Worker offline writes (D30) | ✅ More sophisticated than Vyapar |
| Admin/rep offline read-only | ✅ D6 |
| Mobile push notifications | ⚠️ D27 says FCM/APNs is built-now-or-deferred; in-app inbox is built |
| Camera OCR | 🚫 D13 |
| Mobile barcode scan | 🚫 D13 |
| Mobile weighing scale | 🚫 |

### 2.10 Integrations

| Vyapar integration | Jayshankar |
|---|---|
| Tally import/export | 🚫 Dormant GST track (D24) |
| Barcode scanner | 🚫 D13 |
| Thermal printer | 🚫 Not needed at this scale |
| Cash drawer | 🚫 |
| Weighing scale | 🚫 |
| **UPI QR** | ⚠️ Partial — ShareComposer shares payment details as text, no embedded QR |
| **WhatsApp** | ✅ "Lite" via ShareComposer (D45) |
| **Google Drive backup** | 🚫 Supabase is source of truth |
| **OCR bill scan** | 🚫 D13 |
| **Online Store** | 🚫 D15 |
| **Cloudflare R2 + Supabase Storage** for photos | ✅ D19 |
| **Looker Studio** | ✅ D26 |

### 2.11 Offline / sync

| Behavior | Jayshankar |
|---|---|
| Desktop offline-first | ✅ PWA service worker + IndexedDB read snapshot |
| Mobile offline reads | ✅ Same |
| **Worker offline writes with conflict resolution** | ✅ D30 — *better* than Vyapar's mobile sync |
| Multi-device cloud sync | ✅ Supabase Realtime on `movements` channel |
| Backup to Google Drive | 🚫 Supabase is the backup |

## Part 3 — Vyapar-style reports to ship

Mapped to Jayshankar's spec + plan. In-app vs Looker Studio split per the standing D26 rule.

### 3.1 In-app (transactional, real-time, action-driving)

| Report / widget | Where it lives | Why in-app |
|---|---|---|
| Daily closing summary | New `/daily-closing` page (C2) | Admin opens daily |
| Today's containers (soonest-to-expire) | Existing Floor dashboard | Already exists (FloorDashboard.tsx) |
| Active tasks | Existing `/my-tasks` | Already exists |
| Notification inbox | Existing `NotificationBell` | Already exists |
| Per-customer credit status | `CustomerCard` + `PaymentManagement` | Used when recording a sale |
| Overdue reconciliation banner | `BillsManagement` | A9 |
| Low-stock alerts | Existing `StockBySku` + new `low_stock` notification type | C12 |

### 3.2 Looker Studio (analytical, exploratory)

These become pure SQL views that Looker can chart. None require code changes to the app.

| Report | SQL view needed | Maps to Vyapar |
|---|---|---|
| Transaction report | `daily_sales_summary` (exists, D26) | Vyapar #1 |
| Party report / party-wise P&L | `customer_credit_status`, `vendor_credit_status` (exist) | Vyapar #2 |
| Item/Stock report | `container_availability` (exists) + new `stock_by_sku` view (B5) | Vyapar #4 |
| Sale/Purchase Order report | `bills` view, current Looker query | Vyapar #7 |
| Sale Aging | `customer_credit_status.days_overdue` (exists) | Vyapar #10 |
| Stock Transfer report | `movements WHERE kind='transfer'` (current Looker query) | Vyapar #12 |
| Bill-wise P&L | New view: `bill_wise_pl(bill_id, kg_total, cost_total, revenue_total, margin numeric, margin_pct numeric)` | Vyapar #16 |
| Item Report by Party | New view: `vendor_sku_kg(vendor_id, sku_id, total_kg, batches_count)` (B4) | Vyapar #19 |
| Item Category Sales/Purchase | New view: `category_sales(category, period, kg, revenue)` | Vyapar #21 |
| Low Stock Summary | `stock_by_sku` view (B5) | Vyapar #23 |
| Item Detail | SkuManagement page (in-app) + Looker deep-dive | Vyapar #24 |
| **Day Book** | New view: `day_book(occurred_at, kind, sku, kg, location_from, location_to, user, movement_group_id)` | Vyapar #30 |
| **Cash Flow** | New view: `cash_flow_by_day(day, cash_in, upi_in, bank_in, cash_out, upi_out, bank_out, net)` derived from `payments` | Vyapar #28 |
| Vendor reliability | `vendor_reliability_summary` view (new, see `05`) | New |
| Customer LTV | `customer_lifetime_value` view (new, see `05`) | New |
| Spoilage trend | New view: `spoilage_by_week(sku, week, kg_spoiled, movements_count)` | New |
| Container utilisation | New view: `container_utilization(container_number, total_fills, current_kg, idle_days, last_used_at)` | New |
| Per-SKU margin | New view: `sku_margin_by_period(sku_id, period, kg_sold, revenue, cost, margin, margin_pct)` | New |
| Per-vendor purchase | New view: `vendor_purchases_by_period(vendor_id, period, kg_total, bill_count, avg_price_per_kg)` | New |

## Part 4 — Vyapar parity that genuinely doesn't apply

These features Vyapar ships are explicitly **not** Jayshankar scope, per SPEC §9 + locked decisions:

- **POS retail checkout** — D15 (Jayshankar is wholesale; rep-records sales)
- **Manufacturing BOMs / work orders** — fish isn't manufactured
- **E-commerce storefront** — wholesale, not DTC
- **Multi-store chain retail** — D23 covers multi-warehouse only
- **3PL fulfillment** — Jayshankar isn't a 3PL
- **Drop shipping** — Jayshankar is the wholesaler
- **Loyalty programmes / gift cards / marketing automation** — wholesale relationship-driven
- **Sales quotes / pipeline / CRM-as-pipeline** — sales are not pre-quoted
- **Appointments / scheduling** — irrelevant
- **Payment processing / card readers / POS hardware** — buyers pay outside the app
- **Landed-cost / customs / tariff** — Jayshankar doesn't import
- **Restaurant COGS / recipe costing / menu engineering** — Jayshankar is upstream of restaurants
- **Endless Aisle / marketplace listing** — buyer network is WhatsApp
- **Time tracking / labour costing** — D47 deferred explicitly
- **Equipment / asset / fixed-asset tracking** — not in domain
- **Predictive AI hosted services** — SPEC §9 out
- **Buyer-facing B2B ecommerce storefront** — out of scope; see BlueCart/OrderEase pattern as future-mode candidate

## The headline takeaway

Vyapar ships **30 reports + dashboard widgets**, but **zero forecasting and zero festival awareness**. The dashboard reports can be matched with SQL views + Looker Studio (low effort). The forecasting + festival layer is the genuine greenfield Jayshankar can own — no competitor (Vyapar, Zoho, Cin7, inFlow, Sortly, Unleashed, Square, Brightpearl, Ordoro, Fishbowl, MarketMan, BlueCart, OrderEase) has it for fish wholesale specifically. **See `05-forecasting-roadmap.md` for the build sequence.**
