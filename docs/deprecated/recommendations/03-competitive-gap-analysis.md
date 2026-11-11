# 03 — Competitive gap analysis (12 inventory-management apps)

> Research date: 2026-09-15. Public feature pages fetched for each app; the missing/inaccessible pages are noted per app. This is a feature-inventory comparison, not a marketing study — what each app *can do*, not how pretty it is.

## Apps researched

| App | Primary use case | URL fetched | Status |
|---|---|---|---|
| **Zoho Inventory** | SMB cloud inventory, India GST-ready | `https://www.zoho.com/inventory/features/` | ✅ |
| **Cin7 Core** | Mid-market cloud inventory ERP | `https://www.cin7.com/features/inventory/`, `/warehouse-management/` | ✅ (Core landing 404'd, used nav + WMS page) |
| **inFlow Inventory** | SMB inventory + manufacturing add-on | `https://www.inflowinventory.com/features/` | ✅ |
| **Sortly** | Mobile-first photo inventory | `https://www.sortly.com/features/` | ✅ |
| **Unleashed Software** | Cloud inventory, wholesale/distribution/F&B | `https://www.unleashedsoftware.com/features/` | ✅ |
| **Square for Retail** | POS-first retail | `https://squareup.com/us/en/point-of-sale/retail` | ✅ |
| **Brightpearl** | "Retail Operating System" — multichannel ecommerce + ERP | `https://www.brightpearl.com/platform-features` | ✅ |
| **Ordoro** | Shipping-first inventory + multichannel | `https://www.ordoro.com/features/`, `/features/inventory-management` | ✅ |
| **Fishbowl Inventory** | Inventory + manufacturing, QuickBooks-first | `https://www.fishbowlinventory.com/features/` | ✅ |
| **MarketMan** | Restaurant inventory + COGS | `https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management` | ✅ |
| **BlueCart** (Handheld Solutions) | Wholesale food & bev — vendor + restaurant | `https://www.bluecart.com/` | ✅ |
| **OrderEase** | B2B order orchestration middleware | `https://orderease.com/` | ✅ |

## Per-app feature inventory (compact)

### Zoho Inventory
- **Inventory:** item groups, composite items (bundles/kits), serial + batch + expiry, multi-warehouse, transfer orders, picklists, bin locations, barcode generation/scanning, reorder points, SKU generator
- **Purchasing:** POs, purchase receives, vendor payments, vendor price lists
- **Sales:** sales orders, multi-channel selling (Amazon/Etsy/Shopify/WooCommerce), invoicing + status tracking, sales returns, backorders, dropshipments, delivery challans, e-way bills
- **Warehouse:** multi-warehouse, transfer orders, picklists, packaging & shipping labels, AfterShip tracking
- **Reporting:** built-in reports, workflow rules, webhooks + custom functions (Deluge), Zoho Analytics integration
- **Integrations:** Zoho Books, Zoho CRM, Tally, marketplaces, FedEx/Shiprocket/Delhivery/BlueDart, Stripe/PayPal/Zoho Payments, Twilio, Slack, Google Workspace
- **Mobile:** iOS, Android, Windows
- **India-specific:** GST invoicing, e-way bills, delivery challans, Tally integration

### Cin7 Core + Omni
- **Inventory:** real-time across locations, batch + expiry (FEFO), serial tracking, multi-location visibility, smart order routing, automatic stock-transfer recommendations, location-specific reorder points, **AI-driven reorder (ForesightAI)**, stocktakes per warehouse
- **Purchasing:** supplier management, automated POs, supplier returns, landed costs/tariffs, recosting
- **Sales:** B2B Portal, e-commerce sync, integrated POS, multichannel order management, 3PL Connect
- **Warehouse:** guided pick paths, multi-order picking, barcode-verified packing, carrier rate comparison, AI-generated stock transfers, stocktakes
- **Reporting:** ForesightAI forecasting, real-time analytics, demand forecasting
- **Integrations:** 700+ (Xero, QBO, Shopify, Amazon, ShipStation, SPS EDI, 3PL)
- **AI:** ForesightAI, Automations engine, IDR (Intelligent Document Recognition), Ask Me Anything AI assistant
- **Industry-specific:** Food & beverage has a dedicated page with batch + expiry, regulatory compliance messaging

### inFlow Inventory
- **Inventory:** multi-level categories, product photos, units of measurement, lot + expiry dates, barcoding (scan/generate/print), serial numbers, sublocations, stock adjustments, transfers, stock counts, **low stock alerts**, **reorder points + recommended reorder**, one-click PO generation, default picking locations
- **Purchasing:** POs (multi ship-to, dropshipping, approvals with limits), scan-to-receive, returns, QBO/Xero push
- **Sales:** quotes, orders, invoices, email invoices, backorders, order priority, fulfillment status, dropshipping, returns, B2B portals (public catalog, private portal, custom domain, abandoned cart emails), pick/pack/ship, carrier cost comparison, mailing labels, partial shipments, online payments, automatic exchange rates, batch payments, partial payments, payment history
- **Customers:** contact info, order histories, customer-specific defaults, restrict by sales rep
- **Vendors:** contact info, order histories, vendor-specific defaults, batch payments, balances, partial payments, payment history
- **Warehouse:** multi-location with sublocations, transfers, stock counts, pick lists, default picking locations
- **Reporting:** inventory, purchasing, sales, customizable dashboard, manufacturing reports
- **Integrations:** 34+ e-commerce, 3 EDI sources, 52 shipping carriers (EasyPost), QBO + Xero, Square payments, Zapier, API
- **Customisation:** custom fields, custom invoices/POs, customizable document numbers, user-specific access rights

### Sortly
- **Inventory:** items with custom details, CSV import, item photos, custom fields, custom folders/tags, **customizable user access + roles**, barcode + QR scanning/label generation
- **Purchasing:** POs (create + export)
- **Warehouse:** pick lists, item check-in/check-out, in-app team messaging/comments/@mentions
- **Reporting:** activity history, inventory summary, user activity summary, low stock reports, move summary, item flow, **saved reports** (custom dashboards), **report subscriptions (email)**
- **Alerts:** low stock, date-based (maintenance/repair), in-app + email
- **Integrations:** QuickBooks Online (invoice + PO write-back), Slack, Webhooks, Microsoft Teams, API
- **Mobile / offline:** iOS + Android, **offline mobile access** (track + update offline), automatic sync
- **Industries:** construction, medical, warehouse, electrical, education, automotive, dental, events, retail, antiques, government, aviation

### Unleashed Software
- **Inventory:** real-time, MRP & Advanced Inventory Manager, barcode scanning, **batch tracking with FEFO and expiry-date-at-a-glance**, serial numbers, multi-bin locations + barcode scanning, demand planning & forecasting, **expiry-due dashboard**
- **Purchasing:** POs (auto-generation), supplier management (pricing, contacts, performance), supplier returns, purchase receipting (partial deliveries), landed costs, recost on price change
- **Sales:** multichannel order management, customer-specific pricing, sales quotes (auto-fill with live stock), sales orders, B2B eCommerce platform, freight & charges
- **Customers / CRM:** in-app CRM, customer pricing, sales pipeline via Sales Growth, Marketing Accelerator
- **Vendors:** supplier management (centralised pricing/contacts/performance), supplier returns, recost on price change
- **Production:** BOMs, assemblies, disassembly, batch tracking through production
- **Warehouse:** multi-bin, pick/pack/receive/transfer with barcode scanning, dedicated Warehouse Management App
- **Reporting:** inventory reports, BI platform, **Access Analytics (natural-language AI query → custom dashboards/KPIs)**, demand forecasting
- **Industry pages:** manufacturing, wholesale, food & beverages, distribution, retail, eCommerce, brewery, coffee roasters, health & supplements (expiry tracking emphasized)
- **Audit:** full transaction history per batch

### Square for Retail
- **Inventory:** real-time across locations/channels, inventory history, bulk inventory management, barcode label printing, **mobile stocktake** (camera-based counts)
- **Purchasing:** POs, vendor profiles, receiving inventory
- **Sales:** in-store payments (all major types, Afterpay, Tap to Pay), discounts (manual/auto), refunds & exchanges (full/partial), online + in-store unified, **AI catalog generation**
- **Customers / CRM:** directory, loyalty programmes, gift cards, marketing (email/SMS), Square Messages, purchase history
- **Warehouse:** limited (no multi-bin, no FEFO, no batch beyond implicit) — POS-first
- **Reporting:** sales reports, COGS tracking, **inventory sell-through**, **aging inventory**, performance dashboards
- **Integrations:** app marketplace, Square Banking, payroll, Square Capital (lending)

### Brightpearl
- **Inventory & Order:** multichannel, real-time stock, **Inventory Forecasting** (Brightpearl acquired Inventory Planner), planning with seasonality factors
- **Purchasing:** built-in procurement workflow
- **Sales:** multichannel (Shopify, Magento, BigCommerce, Amazon, eBay, Walmart, TikTok, Instagram), Shipping & Fulfillment, Warehouse Management
- **Customers / CRM:** CRM module
- **Reporting:** Retail Analytics (CAC/LTV/best-sellers), Retail Accounting, industry benchmarks, paid search/social
- **Integrations:** Shopify, Magento, BigCommerce, Amazon, eBay, Walmart, Lightspeed X, ShipStation, Dotdigital, Klaviyo, Xero, QuickBooks, Sage Intacct, Stripe, Square, Royal Mail, USPS, DPD, FedEx

### Ordoro
- **Inventory:** real-time sync, automated low-stock alerts, multi-warehouse, **FBA inventory sync + FBA/FBM tracking**, **FIFO inventory allocation**, **kitting & bundling**, **BOM + manufacturing**, 3PL order management, max export / reserve quantities by sales channel, automatic inventory writeback, bulk uploads, order routing & splitting, **lead-time tracking by supplier**, **real-time P&L summaries**, barcode-enabled receiving
- **Purchasing:** POs + goods receipts (higher tier)
- **Sales:** multichannel sync, marketplaces (Amazon, eBay, Etsy, Walmart, Reverb), shipping labels (USPS, UPS, FedEx, DHL International, Canada Post, Amazon SFP), shipping presets, RMAs
- **Warehouse:** pick/pack/ship, multi-warehouse, barcode-enabled receiving, 3PL routing
- **Out of scope:** asset tracking, rental returns, currency conversion, listing creation

### Fishbowl Inventory
- **Inventory:** real-time across locations, parts & asset tracking, multi-location, on-the-go inventory, **3PL (track by each owner)**
- **Purchasing:** auto purchasing, receive goods, reorder points, automated workflows, **custom approvals**, vendor management (cost, lead time, part numbers), landed costs
- **Sales:** ecommerce, kitting, order management, integrated POS, RMA (credit returns)
- **Warehouse:** order fulfillment, pick & pack (scan-based), transfer orders, credit returns
- **Manufacturing:** BOMs (simple/configurable, single/multi-build), manufacture & work orders, MRP, **time tracking + labor costing**
- **Integrations:** QuickBooks Online/Desktop/Canada/Payments, Xero, Salesforce, Shopify, Magento, BigCommerce, Amazon, eBay, Walmart, Volusion, ShipStation, ShipWorks, FedEx, UPS, USPS, DHL, OnTrac, Avalara, HubSpot, Zoho, Adobe Commerce, **Metrc (cannabis compliance)**
- **Industries:** aerospace & defense, automotive, chemical, construction, consumer goods, firearms, government, food & beverage, healthcare

### MarketMan
- **Inventory:** live, **par levels**, **automatic reorder suggestions**, vendor catalog with pricing, multi-unit/commissary, **AI ordering** (predictive reorder)
- **Purchasing:** POs (web/mobile), receiving (flag price changes, shortages, missing items), supplier price tracking, par levels + budgets + price limits, alerts for shorts/subs/credits, **white-label mobile app for distributors**
- **Vendors:** management, **automatic vendor management** (Growth tier), performance tracking, vendor payments
- **Warehouse:** multi-unit/commissary, transfer orders
- **Recipes / COGS:** recipe costing, AI-powered recipe creation, real-time recipe costing, automatic COGS, order by recipe, menu profitability
- **Reporting:** COGS dashboard, food cost percentage, sales dashboards, **theoretical vs actual usage**, vendor spend analytics
- **Integrations:** Toast, TouchBistro, Square, Lightspeed, QuickBooks, Xero, **US Foods, Sysco, PFG (Performance Food Group)**

### BlueCart
- **Vendor side:**
  - Order Management: single dashboard, confirm/fulfill/track every transaction
  - Vendor Management: buyer accounts, **custom catalogs per buyer**, per-account pricing
  - **BlueCart Pay**: wholesale invoicing + payment collection
  - **B2B Online Ordering**: digital storefront, **Endless Aisle** (marketplace — 48,000+ restaurant buyer network)
  - **Wholesale CRM & Sales Rep App**: sales rep mobile ordering
  - Digital Catalog: custom catalogs with photos
  - Analytics & Reporting: pricing insights, customizable delivery zones, incentives
- **Restaurant side:** inventory, procurement, food costing, Endless Aisle marketplace
- **Related products (parent company):** Route Management, QR menu (SproutQR), Bar Inventory (BinWise)

### OrderEase
- **Order Orchestration Hub:** centralised order intake synced to back-office/ERP. Multichannel (EDI850, PDF/CSV email, B2B portal, sales rep app, ecommerce, marketplaces) → validation → ERP
- **Customer Ordering Portal:** custom B2B wholesale ordering, customer-specific catalog/pricing/quantity rules
- **EDI Automation:** preconfigured EDI connections, retailer compliance
- **Email Orders:** parses PDF/CSV email POs into structured orders
- **Sales Rep App:** **offline-ready mobile field sales app**
- **B2B Ecommerce:** online ordering integrated with ERP
- **Pricing & Promotions:** tiered pricing, customer-specific price lists at scale
- **ERP Integration:** NetSuite, Sage300, QBO, Microsoft Dynamics 365, Acumatica, Spire, Xero
- **Shipping:** ShipStation, Freightview, Flexport, Stallion Express
- **Warehouse:** Logiwa, Extensiv, Finale Inventory, SOS Inventory

## Cross-app gap matrix for Jayshankar

Legend: ✅ covered · ⚠️ partial · ❌ not covered · 🚫 out of scope (per SPEC §9 + locked decisions)

### Inventory & stock

| Feature | Coverage | Notes |
|---|---|---|
| Item groups / bundles / kits | ⚠️ | `skus` has `category` but no bundle entity. Inapplicable to fish. |
| Serial number tracking | 🚫 | Fish don't have serials. `containers` (D21) is the moral equivalent — *is* tracked per-box. |
| Batch tracking with expiry monitoring | ✅ | D8, D21, migration 0007-0011 |
| Multi-warehouse | ✅ | D23, migration 0006 (cross-warehouse transfers + receiving confirmations) |
| Transfer orders | ✅ | `record_transfer_cascade` (migration 0029 enforces cross-warehouse-only) |
| Picklists | ❌ | Jayshankar is walk-up, not pre-order |
| Bin locations | 🚫 | One warehouse, no bins |
| Barcode generation/scanning | 🚫 | D13 explicit — out of scope |
| Reorder points + automated reorder | ❌ | Every competitor has it; Jayshankar has no proactive reorder suggestion |
| Low stock alerts (push + dashboard) | ⚠️ | `low_stock_threshold_kg` exists; `StockBySku` shows it client-side; **no notification fires** |
| Stock value (FIFO cost × qty) | ✅ | Computable via D8 |
| Sublocations | 🚫 | One warehouse |
| Custom fields per item | ✅ | `skus.notes`, `category`, `size_grade` — flexible |

### Purchasing / receiving

| Feature | Coverage | Notes |
|---|---|---|
| Purchase orders | ❌ | Bills *are* the PO, but no pre-arrival PO state |
| **Receiving confirmations (promised vs measured)** | ✅ | D32, D33, D36 — migration 0036 fixed the movement_group_id bug |
| Vendor payments + vendor bills | ✅ | Migration 0020 + 0034 |
| Vendor price lists | ❌ | No per-vendor price baseline — A2 in `01` |
| **Custom approval workflows on POs** | ❌ | Not in domain for fish wholesale — admin approval exists for reversal requests |
| Landed costs | 🚫 | Local catch, no import |
| Vendor returns | ❌ | Spoilage absorbs this |
| Lead-time tracking by supplier | ❌ | (BlueCart, Ordoro both have this) |
| **PO reconciliation (case by case)** | ✅ | `reconcile_bill` RPC (migration 0034) — explicitly per D54's "case by case, reconciled by hand" answer |

### Sales / orders

| Feature | Coverage | Notes |
|---|---|---|
| Sales orders | ✅ | `record_container_sale` |
| Multi-channel selling | 🚫 | Wholesale direct |
| Invoicing (GST) | 🚫 | Dormant track D24 |
| Sales returns | ✅ | D49 (customer_complaints with restock/spoil/refund) |
| Backorders / dropshipments | 🚫 | Not in domain |
| Delivery challan | 🚫 | Not in domain |
| E-way bill | 🚫 | Dormant GST track |
| **Cancel a sale** (reversal) | ✅ | D22, `execute_sale_reversal` |
| B2B portal (buyer self-service) | ❌ | OrderEase, BlueCart, Cin7 all ship this |
| **B2B Portal on a public link (no login)** | ❌ | Future mode candidate |
| **Per-buyer pricing baseline** | ❌ | Most strategically important gap — see D31 context |
| **Multi-payment-mode on one sale** | ✅ | `payments.method` |
| Payment reminders | ⚠️ | D42's `customer_over_limit` fires once; no recurring nudge loop |
| Bill-wise profit | ✅ | Computable (`sale_price_per_kg − batch price_per_kg_paid`) |

### Customers / CRM

| Feature | Coverage | Notes |
|---|---|---|
| Customer contact management | ✅ | D12, `customers` |
| **Credit limit** | ✅ | D33 (`credit_limit` + `credit_period_days`) |
| **AR aging report** | ⚠️ | `days_overdue` computed; no UI surface |
| **Customer statement / party ledger** | ❌ | Per-sale balance computed in two places — see B1 |
| Loyalty / gift cards / marketing automation | 🚫 | Wholesale relationship-driven, not loyalty |
| **Customer purchase history with vendor trace** | ✅ | `CustomerCard` (D44) |
| **Customer false-claim count** | ❌ | View exists, never queried (A2) |
| **Customer lifetime value** | ❌ | No aggregation |
| **Top customers by volume** | ❌ | Computable, no widget |

### Vendors / suppliers

| Feature | Coverage | Notes |
|---|---|---|
| **Vendor reliability score** | ✅ | `vendors.reliability int2` exists |
| **Vendor purchases this period** | ✅ | `vendor_credit_status` aggregates `$`, not `$ + kg` |
| **Per-vendor purchase history view** | ❌ | A7 / C3 |
| **Vendor portal** | 🚫 | BlueCart/OrderEase pattern |
| **Vendor quality-per-fish ratings** | ❌ | Deferred per D44 + decision #65 |
| Vendor price-change alerts | ❌ | No baseline, no diff |
| Sales rep mobile app | 🚫 | D28 — single app, no separate rep app |

### Warehouse / operations

| Feature | Coverage | Notes |
|---|---|---|
| Multi-bin / sublocations | 🚫 | Single warehouse |
| Pick/pack/ship | ⚠️ | Pack container (record_container_fill) but no "pick list" workflow |
| **Transfer orders between warehouses** | ✅ | D29 + migration 0029 (cross-warehouse-only) |
| **Repack** | ✅ | D21, `record_repack` |
| **In-transit locations (inbound)** | ✅ | Migration 0031, 0032, 0036 |
| **Outbound transit + delivery tracking** | ❌ | D29 left outbound as a no-op (decision #80) |
| Barcode-verified packing | 🚫 | D13 |
| Weight scale integration | 🚫 | Not in scope |
| **Asset tracking (vehicles, freezers)** | ❌ | Out of domain for now |
| **Production / BOMs** | 🚫 | Fish isn't manufactured |

### Reporting / analytics

| Feature | Coverage | Notes |
|---|---|---|
| Built-in reports | ⚠️ | Looker Studio only (D26) |
| **Customisable dashboards** | ❌ | Admin dashboard is fixed |
| **30+ named reports (Vyapar pattern)** | ❌ | See `04-vyapar-gap-analysis.md` |
| **Top-selling items** | ❌ | Computable |
| **Sales trend over time** | ⚠️ | Looker Studio can chart; no in-app widget |
| **Profit & Loss by period** | ❌ | Looker only |
| **Vendor reliability report** | ❌ | No aggregation |
| **Spoilage trend report** | ❌ | Computable (`movements kind=spoilage`) |
| **Container utilisation report** | ❌ | Computable |
| **"Expiring soon" dashboard** | ❌ | Computable, missing UI |
| **Daily closing summary** | ❌ | Computable |
| **Email report subscriptions** | ⚠️ | Sortly, Brightpearl both ship |
| AI demand forecasting | ❌ | Cin7 ForesightAI, Unleashed Access Analytics, MarketMan AI Ordering — Vyapar has none |
| **Festival-aware forecasting** | ❌ | **No competitor has this** — greenfield for Jayshankar |
| **Weekday vs weekend pattern detection** | ❌ | **No competitor has this exposed** |
| **Fish catch forecasting** | ❌ | **No competitor has this** — domain-specific greenfield |
| Custom fields on reports | ❌ | Looker Studio can do it |

### Integrations

| Feature | Coverage | Notes |
|---|---|---|
| Accounting (Tally / QBO / Xero) | 🚫 | Dormant GST track D24 |
| **Looker Studio (BI tool)** | ✅ | D26 — `looker_studio_readonly` role |
| **Cloudflare R2 + Supabase Storage** | ⚠️ | Schema in place; actual upload pending D19 |
| E-commerce (Shopify, Amazon) | 🚫 | D15 |
| Shipping carriers | 🚫 | D29: fish leaves with the hauler, not via courier |
| Payment gateways (Stripe/Square) | 🚫 | Buyers pay cash/UPI outside the app |
| **WhatsApp Business Cloud API** | ⚠️ | "Lite" only (D45, D20); full outbound-WhatsApp deferred |
| **Telegram / SMS** | ❌ | No automated outbound |
| **Voice / telecalling CRM** | 🚫 | Vyapar has NeoDove; Jayshankar has notification inbox |
| **Weather API** | ❌ | F7 in `05` |
| **Indian festival calendar API** | ❌ | F1 in `05` — built as static table, no external dep |

### Mobile / offline

| Feature | Coverage | Notes |
|---|---|---|
| iOS | ✅ | D18 (Capacitor + Android first, iOS to follow) |
| Android | ✅ | D18 + Capacitor wrap |
| Mobile-first design | ✅ | D18 |
| **Worker offline writes with conflict resolution** | ✅ | D30 — *better* than Vyapar's mobile sync |
| **Admin offline reads** | ✅ | D6, PWA service worker |
| **Camera OCR scan-to-bill** | 🚫 | D13 |
| **GPS tracking for sales reps** | 🚫 | D28 — no separate rep app |
| **Mobile barcode scan** | 🚫 | D13 |
| **Mobile weighing scale** | 🚫 | Not in scope |

## Classification summary

- **Definitely missing and can be built from existing data** (joins/views/RPCs over current tables): ~25 features
- **Missing and needs new schema or RPCs**: ~10 features
- **Out of scope** (per SPEC §9 + locked decisions): ~20 features

The top 10 buildable-from-existing-data wins, ranked by value to a fish wholesaler:

1. **Per-buyer pricing baseline** (D31's pain point)
2. **"Expiring soon" container dashboard** (food-industry essential)
3. **Low-stock / reorder-point alerts** (every competitor has it)
4. **Daily closing summary** (any shop owner's first question)
5. **Per-vendor purchase history view** (the admin's primary purchasing question)
6. **Per-SKU / per-batch margin report** (admin's profitability question)
7. **Spoilage / waste trend report** (food-waste is a real cost driver)
8. **Container utilisation report** (capacity planning)
9. **AR aging / customer statement** (if credit is common)
10. **Customer baseline price per buyer** (D31's pain point)

The full priority order with effort estimates is in `07-tiered-build-priority.md`.
