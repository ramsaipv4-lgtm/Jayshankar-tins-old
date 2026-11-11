# Database API reference — Phase B functions

Everything the frontend calls is `supabase.rpc('<name>', { p_… })`. This lists the functions added by migrations `0037`–`0046`; for the older ones (`record_bill_delivery`, `confirm_delivery_arrival`, `record_container_sale`, …) read the migration that defines them (the schema doc lists which).

## Conventions

- **Two kinds of failure.** A *permission* failure raises an exception (SQLSTATE `42501`, `supabase-js` gives `error.code === '42501'`). A *business* failure returns normally with `{ "error": "message" }` in the JSON, and nothing was written. Always check `data?.error` as well as `error`.
- All names are `p_`-prefixed named arguments; omit any that have a default.
- "Procurement team" = `can_manage_procurement()`: admin, co-admin, and vendor-rep / super-worker unless `users.receiving_blind`. "Receivers" = admin, co-admin, vendor-rep, super-worker (blind or not). "Anyone" = any signed-in role.
- Days and "today" are Asia/Kolkata calendar days. Money is rupees, `numeric(10,2)`; weights are kg, `numeric(10,3)`.
- Codes: `PR-2026-000125` (purchase), `RCV-2026-000012` (truck load / receiving id), `PO-2026-000007` (purchase order). Counters restart each calendar year and never repeat.

## Settings and roles (0037)

| Function | Who | Does |
|---|---|---|
| `set_app_setting(p_key text, p_value jsonb)` → `{key, value}` | admin, co-admin | Change an existing setting. Unknown key → `{error}`. Keys: `enforce_blind_receiving` (JSON boolean, not the string "true"), `grading_tolerance_pct`, `normal_damage_pct`, `quality_rejection_alert_pct`, `expiry_alert_hours`, `market_price_stale_days` (numbers, zero or more; `NaN`/`Infinity` refused; the `_pct` ones cannot exceed 100). |
| `get_setting_numeric(p_key, p_default)` → numeric | anyone | Read a numeric setting (settings are also directly selectable). |
| `can_view_procurement_money()` → bool | anyone | Whether the caller may see supplier, rate, margin. The gate used by every money policy. |
| `can_manage_procurement()` → bool | anyone | Currently identical; the single place to add a procurement role later. |
| `blind_receiving_enforced()` → bool | anyone | State of the switch. |

## Receiving (0038, 0040)

| Function | Who | Does |
|---|---|---|
| `list_receiving_queue()` → rows `{source, ref_id, short_code, sku_id, english_name, tamil_name, expected_kg, location_id, location_name, arrived_at, vendor_name, bill_number}` | receivers | What is waiting to be weighed: in-transit bills (`source='bill'`, `ref_id` = batch id → pass to `confirm_delivery_arrival`) and dispatched truck loads (`source='truck_load'`, one row per fish, `ref_id` = truck load id → pass to `receive_truck_load`). `vendor_name` / `bill_number` are null for blind users. |
| `receive_truck_load(p_truck_load_id uuid, p_lines jsonb, p_destination_location_id uuid = null, p_notes text = null, p_photo_status text = 'none')` → `{truck_load_id, receiving_code, discrepancy, lines[], movement_group_id}` | receivers | Confirms a truck. `p_lines` = `[{"sku_id", "good_kg", "spoiled_kg"?}]`, **exactly one per fish on the truck**. Posts physical kg to stock, one batch per supplier lot (pro rata when mixed), one bill per supplier at the promised amount, one receiving confirmation per batch, notifies admins on any difference. Returns **no supplier and no money**. Errors: not every fish weighed; every weight zero; a weight that is not a number; already received; destination missing or a transit stage. Bills are one per (supplier, payment terms). |
| `batches_safe` (view) | anyone | `id, sku_id, location_id, kg, kg_remaining, delivered_at, created_at, short_code`. Read-only. |

## Purchases and trucks (0040) — procurement team

| Function | Does |
|---|---|
| `create_procurement(p_sku_id, p_expected_kg, p_supplier_id, p_rate_per_kg, p_expected_arrival = null, p_payment_terms = 'cash', p_notes = null)` → `{procurement_id, code, status:'created'}` | Raise a purchase. Moves no stock. |
| `dispatch_procurement(p_procurement_ids uuid[], p_vehicle_no = null, p_expected_arrival = null, p_destination_location_id = null)` → `{truck_load_id, receiving_code, purchases}` | Put one or more `created` purchases on one vehicle; makes the truck load receiving will see. Moves no stock. |
| `cancel_procurement(p_procurement_id, p_reason = null)` | Cancel a `created` or `dispatched` purchase. A truck whose purchases are all cancelled is cancelled. |

Status chain: `created → dispatched → received` (or `cancelled`). Direct `insert/update` on `procurement` and `truck_loads` is not possible; there is no write policy.

## Grading (0039) — anyone may grade

`record_grading_run(p_batch_id uuid, p_lines jsonb, p_shrink_kg numeric = 0, p_note text = null)` → `{grading_run_id, received_kg, graded_kg, shrink_kg, unreconciled_kg, supersedes}`

- `p_lines` = `[{"grade_id", "kg", "photo_url"?}]`, each grade at most once; a grade with a `sku_id` only on that fish.
- Refused if the lot is still in transit, or if `|received − graded − shrink|` exceeds `grading_tolerance_pct` % of received (the error carries `gap_kg` and `allowed_gap_kg`).
- A second call for the same batch supersedes the first (history kept, one live run).
- Read `grades` (reference), `grading_runs`, `grading_lines`, and view `grading_current_v` (live split per batch with labels).

## Quality and traceability (0041)

| Function | Who | Does |
|---|---|---|
| `raise_quality_issue(p_issue_type, p_kg_affected, p_truck_load_id = null, p_batch_id = null, p_sku_id = null, p_photo_url = null, p_note = null)` → `{issue_id, status}` | receivers | Types: `bad_smell soft_flesh damaged old_stock size_mismatch weight_issue ice_water_issue other`. Needs a truck load or a batch (a batch supplies the fish and truck). Notifies admins (`quality_issue`). |
| `resolve_quality_issue(p_issue_id, p_note = null)` | admin, co-admin | Close an issue. |
| `vendor_quality_scorecard(p_from date = today-30, p_to date = today)` → rows per supplier `{vendor_id, vendor_name, lots, kg_expected, kg_received, shortfall_kg, spoiled_at_receiving_kg, issues, issue_kg_allocated, issue_pct, complaints, complaint_bad_kg_allocated}` | procurement team | Truck-level issues are spread over that fish's lots pro rata to expected kg; complaint bad-kg is spread over the batches a sale drew from. "Allocated", not "caused". |
| `trace_batch(p_batch_id)` → jsonb | receivers | Chain: batch, receiving code, purchase code, `supplier` (null for blind users), `mixed_with[]` and `purchase_code` (money roles only), `allocated_supplier` (money roles only; set when the batch is a pro-rata share), `honesty_note` when a pro-rata share, `derived_batch` / `derived_note` (true when the batch came from a transfer or restock rather than a purchase), and every sale from the batch (with `reversed`). |
| `trace_sale(p_sale_id)` → jsonb | receivers | The customer, and `sources[]` = `trace_batch` for each batch the sale drew from. The "customer complained, whose fish was it" call. |

## Procurement desk (0042) — procurement team

Tables with plain insert/update (no delete): `purchase_requirements`, `market_prices` (one price per market, fish and day), `festivals`, `supplier_quotations`. Purchase orders move through RPCs.

| Function | Does |
|---|---|
| `select_quotation(p_quotation_id)` | Mark the winning quote for its requirement (clears the previous one); refuses an expired quote; requirement → `in_progress`. |
| `create_purchase_order(p_supplier_id, p_lines jsonb, p_expected_arrival date = null, p_destination_location_id = null, p_payment_terms_days int = 0, p_transport_cost = 0, p_ice_packing_cost = 0, p_quotation_id = null, p_note = null)` → `{po_id, code, status:'draft'}` | Lines `[{"sku_id","qty_kg","price_per_kg","grade_id"?,"requirement_id"?}]`, or pass `p_quotation_id` to build it from a quote (supplier must match; a quote can be used once). |
| `release_purchase_order(p_po_id)` → `{status:'sent', purchases:[codes]}` | Turn each line into a purchase (`PR-…`). Terms > 0 days → `credit`. |
| `latest_market_prices(p_sku_id = null)` → rows `{market, sku_id, english_name, price_per_kg, price_date, prev_price_per_kg, change_pct, is_stale}` | Newest price per market with change vs the previous entry. |
| `supplier_quotations_landed_v` (view) | Quote columns plus `landed_per_kg`, `landed_total`, `transport_per_kg`…, `is_best_price` (expired quotes are never "best"). |

A purchase order and its requirement complete themselves when their purchases are received (`sync_po_status` trigger): all received → `received`; some → `partially_received`; all cancelled → `cancelled`.

## Reports and analytics (0043)

| Function | Who | Returns |
|---|---|---|
| `home_stats_today()` | anyone | `{date, kg_received_today, pending_receiving, sales_amount_today, sales_kg_today, spoiled_kg_today}` |
| `report_stock()` | anyone | per fish `{kg_on_hand, low_stock_threshold_kg, is_low, batches}`; in-transit stock excluded |
| `report_sales(p_from = today-6, p_to = today)` | anyone | per fish `{kg_sold, amount, avg_price_per_kg, sales_count}`; reversed sales excluded |
| `report_purchases(p_from, p_to)` | money roles | per fish `{kg_received, amount, avg_rate_per_kg, batches}` |
| `profit_summary(p_from = today, p_to = p_from)` | money roles | `{bought_amount, sold_amount, kg_sold, cost_of_goods_sold, gross_profit, spoilage_cost, profit_after_spoilage, margin_pct}`; before complaint refunds and logistics |
| `analytics_purchase_by_fish(p_from, p_to)` | procurement team | kg, amount, average rate, share of kg |
| `analytics_purchase_vs_sale_price(p_from, p_to)` | procurement team | average buy rate vs average sale price, margin per kg and % |
| `analytics_supplier_split(p_from, p_to)` | procurement team | kg, amount, share of amount per supplier |
| `procurement_dashboard()` | procurement team | `{fish_required_today_kg, on_order_kg, trucks_on_the_way, open_purchase_orders, stale_market_prices}` |

## Alerts and containers (0044)

| Function | Who | Does |
|---|---|---|
| `run_alert_sweeps()` → `{expiring, low_stock, po_overdue, quality}` (counts of **new** notifications) | admin, co-admin, or a scheduler connecting as `service_role` (anyone else: 42501) | Notifies the admins of: containers expiring within `expiry_alert_hours`; fish below `low_stock_threshold_kg` (only fish ever stocked); purchase orders past their date; suppliers above `quality_rejection_alert_pct` over 30 days. Same condition is not repeated within 12 hours. |
| `container_card(p_container_id uuid = null, p_container_number text = null)` → jsonb | anyone | `{container_id, container_number, capacity_kg, ownership, empty, fill_id, packed_at, expires_at, hours_left, is_expired, sell_this_next, kg_remaining, contents[{fish, tamil_name, kg, batch_code}], qr_payload}`. No money. `sell_this_next` = earliest expiry among live fills sharing a fish. |

QR convention: encode `jsk://container/<container uuid>` (never the printed number). The scan route should parse the uuid and call `container_card`.

### Notification types added

| `type` | When | Payload |
|---|---|---|
| `truck_load_discrepancy` | a truck's weight differs from the order | `truck_load_id, receiving_code, lots[{procurement_id, code, supplier_id, expected_kg, allocated_good_kg, allocated_spoiled_kg}]` |
| `quality_issue` | a receiver raises an issue | `issue_id, issue_type, kg_affected, sku_id, receiving_code, batch_id` |
| `container_expiring` | sweep | `container_fill_id, container_number, expires_at, kg_remaining, already_expired` |
| `low_stock` | sweep | `sku_id, fish, kg_on_hand, threshold_kg` |
| `po_overdue` | sweep | `po_id, code, expected_arrival` |
| `quality_rejection_high` | sweep | `vendor_id, vendor_name, issue_pct, threshold_pct` |

`NotificationBell.tsx` has text for all six.

## Changed existing function

`record_container_fill(p_bill_id, p_location_id, p_container_number, p_capacity_kg, p_items, p_ownership)` (0045): items may now come from several bills **if all those batches came off the same truck load as the anchor bill's batches**; the same batch cannot appear twice in one fill. Whether a fill is mixed is computed by `container_fill_is_mixed(p_fill_id uuid)` → bool (and returned as `is_mixed_supplier` by `container_card`); it is not a stored column. A batch from an unrelated bill is still refused ("…one purchase event or one truck load"). `container_fills.bill_id` holds the anchor bill, so do not present it as "this crate's supplier" when `is_mixed_supplier` is true.

## Access control (0046)

No public function is executable by `anon`. Functions that are only ever called by other functions or triggers (`container_sourced_cascade`, `direct_batch_cascade`, `record_*_cascade` helpers, `auto_complete_task`, `notify_admins`, `notify_*`, `next_code`, `_notify_once`, `_vendor_quality_scorecard`, trigger functions) are not executable by `authenticated` either, so they are not part of the client API. Every function listed above is executable by signed-in users and checks the caller's role itself. New functions are not exposed by default: a migration that adds one must `grant execute … to authenticated` explicitly.
