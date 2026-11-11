# Database Schema

> Generated from the migrations: `supabase/migrations/0001`–`0045` applied in order, then `supabase/rls-policies.sql`, to a clean PostgreSQL 16 database (the same build `supabase/tests/run.sh` tests).
> It is the schema the migrations *define*. The live Supabase project is the source of truth for what is actually deployed; if the two ever disagree, one of the migrations has not been run there.
> The earlier export of 2026-08-14 described 9 tables and is superseded by this file. `SCHEMA.png` still shows that old 9-table diagram.

**38 tables, 8 views, 71 application functions.** RLS is enabled on every table.
`audit_log` is append-only: only the audit trigger writes to it and no UPDATE/DELETE policy exists.
32 tables carry the audit trigger (see "Audit coverage" below).

For setup see `./SUPABASE-SETUP.md`; for what Phase B added and what is still open see `./BACKEND-PHASE-B-STATUS.md`; for every callable function see `./API-REFERENCE.md`.

## Tables at a glance

| Table | Columns | Added in | Audited | RLS policies |
|---|---|---|---|---|
| `app_settings` | 6 | 0037 | yes | 1 |
| `audit_log` | 8 | 0001 | no | 1 |
| `batches` | 14 | 0001 | yes | 3 |
| `bills` | 16 | 0006 | yes | 3 |
| `check_ins` | 4 | 0024 | no | 1 |
| `code_counters` | 3 | 0037 | no | 0 |
| `container_fill_items` | 4 | 0006 | yes | 2 |
| `container_fills` | 9 | 0006 | yes | 3 |
| `containers` | 6 | 0006 | yes | 4 |
| `customer_complaints` | 19 | 0027 | yes | 1 |
| `customers` | 18 | 0012 | yes | 3 |
| `festivals` | 11 | 0042 | yes | 3 |
| `grades` | 7 | 0039 | yes | 3 |
| `grading_lines` | 5 | 0039 | yes | 1 |
| `grading_runs` | 12 | 0039 | yes | 1 |
| `locations` | 8 | 0001 | yes | 3 |
| `market_prices` | 8 | 0042 | yes | 3 |
| `movements` | 15 | 0001 | yes | 2 |
| `notifications` | 7 | 0012 | no | 2 |
| `payments` | 9 | 0012 | yes | 2 |
| `price_history` | 7 | 0001 | yes | 2 |
| `procurement` | 21 | 0040 | yes | 1 |
| `purchase_order_lines` | 8 | 0042 | yes | 1 |
| `purchase_orders` | 14 | 0042 | yes | 1 |
| `purchase_requirements` | 12 | 0042 | yes | 3 |
| `quality_issues` | 14 | 0041 | yes | 1 |
| `receiving_confirmations` | 15 | 0032 | yes | 1 |
| `reversal_requests` | 9 | 0012 | yes | 3 |
| `sales` | 12 | 0001 | yes | 3 |
| `skus` | 16 | 0001 | yes | 3 |
| `supplier_quotations` | 17 | 0042 | yes | 3 |
| `tasks` | 16 | 0024 | no | 2 |
| `truck_loads` | 12 | 0040 | yes | 1 |
| `user_role_history` | 5 | 0012 | no | 1 |
| `users` | 12 | 0001 | yes | 3 |
| `vendor_payments` | 9 | 0020 | yes | 2 |
| `vendors` | 13 | 0001 | yes | 3 |
| `warehouses` | 5 | 0006 | yes | 3 |

### Views

| View | Added in | Notes |
|---|---|---|
| `batches_safe` | 0038 | Floor/receiving-safe batch columns (no vendor, no rate). Runs with owner rights, so it must stay free of money columns. |
| `container_availability` | 0006 |  |
| `customer_complaint_summary` | 0027 |  |
| `customer_credit_status` | 0013 |  |
| `daily_sales_summary` | 0022 |  |
| `grading_current_v` | 0039 | Live grading lines per batch with grade labels. |
| `supplier_quotations_landed_v` | 0042 | Landed cost per kg and total, best-price flag; empty unless can_manage_procurement(). |
| `vendor_credit_status` | 0020 |  |

### Audit coverage

Audited (insert/update/delete written to `audit_log`): `app_settings`, `batches`, `bills`, `container_fill_items`, `container_fills`, `containers`, `customer_complaints`, `customers`, `festivals`, `grades`, `grading_lines`, `grading_runs`, `locations`, `market_prices`, `movements`, `payments`, `price_history`, `procurement`, `purchase_order_lines`, `purchase_orders`, `purchase_requirements`, `quality_issues`, `receiving_confirmations`, `reversal_requests`, `sales`, `skus`, `supplier_quotations`, `truck_loads`, `users`, `vendor_payments`, `vendors`, `warehouses`.

Not audited, on purpose (operational churn, not a financial or stock record): `check_ins`, `notifications`, `tasks`, `user_role_history`. `audit_log` and `code_counters` are internal.

Before migration 0037 only users, locations, vendors, skus, batches, movements, sales and price_history were audited.


---

## Table `app_settings`

_Added in migration 0037._

| Name | Type | Constraints |
|---|---|---|
| `key` | `text` | Primary |
| `id` | `uuid` | Not null |
| `value` | `jsonb` | Not null |
| `description` | `text` |  |
| `updated_by` | `uuid` | → `users` |
| `updated_at` | `timestamptz` | Not null, default `now()` |

## Table `audit_log`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | → `users` |
| `action` | `text` | Not null |
| `table_name` | `text` | Not null |
| `row_id` | `uuid` | Not null |
| `before_json` | `jsonb` |  |
| `after_json` | `jsonb` |  |
| `at` | `timestamptz` | Not null, default `now()` |

## Table `batches`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sku_id` | `uuid` | Not null, → `skus` |
| `vendor_id` | `uuid` | Not null, → `vendors` |
| `location_id` | `uuid` | Not null, → `locations` |
| `kg` | `numeric(10,3)` | Not null |
| `kg_remaining` | `numeric(10,3)` | Not null |
| `price_per_kg_paid` | `numeric(10,2)` | Not null |
| `delivered_at` | `timestamptz` | Not null, default `now()` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `created_by` | `uuid` | → `users` |
| `bill_id` | `uuid` | → `bills` |
| `procurement_id` | `uuid` | → `procurement` |
| `truck_load_id` | `uuid` | → `truck_loads` |
| `is_pro_rata_share` | `bool` | Not null, default `false` |

## Table `bills`

_Added in migration 0006._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `vendor_id` | `uuid` | Not null, → `vendors` |
| `vendor_bill_number` | `text` |  |
| `bill_date` | `date` | Not null, default `CURRENT_DATE` |
| `total_amount` | `numeric(10,2)` | Not null, default `0` |
| `share_status` | `text` | Not null, default `'not_shared'::text` |
| `shared_at` | `timestamptz` |  |
| `share_method` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `payment_terms` | `text` | Not null, default `'cash'::text` |
| `reconciled_total_amount` | `numeric(10,2)` |  |
| `reconciliation_notes` | `text` |  |
| `reconciliation_reminder_at` | `timestamptz` |  |
| `reconciled_at` | `timestamptz` |  |
| `reconciled_by` | `uuid` | → `users` |

## Table `check_ins`

_Added in migration 0024._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | Not null, → `users` |
| `work_date` | `date` | Not null |
| `checked_in_at` | `timestamptz` | Not null, default `now()` |

## Table `code_counters`

_Added in migration 0037._

| Name | Type | Constraints |
|---|---|---|
| `prefix` | `text` | Primary |
| `year` | `int4` | Primary |
| `last_value` | `int4` | Not null, default `0` |

## Table `container_fill_items`

_Added in migration 0006._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `container_fill_id` | `uuid` | Not null, → `container_fills` |
| `batch_id` | `uuid` | Not null, → `batches` |
| `kg` | `numeric(10,3)` | Not null |

## Table `container_fills`

_Added in migration 0006._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `container_id` | `uuid` | Not null, → `containers` |
| `bill_id` | `uuid` | Not null, → `bills` |
| `location_id` | `uuid` | Not null, → `locations` |
| `filled_at` | `timestamptz` | Not null, default `now()` |
| `kg_remaining` | `numeric(10,3)` | Not null |
| `expires_at` | `timestamptz` | Not null |
| `created_by` | `uuid` | → `users` |
| `is_repack_copy` | `bool` | Not null, default `false` |

## Table `containers`

_Added in migration 0006._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `container_number` | `text` | Not null |
| `capacity_kg` | `numeric(5,2)` | Not null |
| `active` | `bool` | Not null, default `true` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `ownership` | `text` | Not null, default `'owned'::text` |

## Table `customer_complaints`

_Added in migration 0027._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sale_id` | `uuid` | Not null, → `sales` |
| `customer_id` | `uuid` | → `customers` |
| `kg_returned` | `numeric(10,3)` | Not null |
| `claim_description` | `text` |  |
| `status` | `text` | Not null, default `'pending'::text` |
| `kg_confirmed_bad` | `numeric(10,3)` |  |
| `kg_confirmed_good_restocked` | `numeric(10,3)` |  |
| `kg_rejected_no_action` | `numeric(10,3)` |  |
| `rejected_disposition` | `text` |  |
| `operation_charge` | `numeric(10,2)` |  |
| `refund_amount` | `numeric(10,2)` |  |
| `resolution_notes` | `text` |  |
| `spoilage_movement_group_id` | `uuid` |  |
| `restock_movement_group_id` | `uuid` |  |
| `reported_by` | `uuid` | → `users` |
| `resolved_by` | `uuid` | → `users` |
| `resolved_at` | `timestamptz` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `customers`

_Added in migration 0012._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `name` | `text` | Not null |
| `business_name` | `text` |  |
| `is_business` | `bool` | Not null, default `false` |
| `phone` | `text` |  |
| `address` | `text` |  |
| `follow_up_status` | `text` |  |
| `fish_preference` | `text` |  |
| `is_gst_registered` | `bool` | Not null, default `false` |
| `gstin` | `text` |  |
| `assigned_rep_id` | `uuid` | → `users` |
| `warehouse_id` | `uuid` | Not null, → `warehouses` |
| `active` | `bool` | Not null, default `true` |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |
| `credit_limit` | `numeric(10,2)` |  |
| `credit_period_days` | `int4` |  |

## Table `festivals`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `name` | `text` | Not null |
| `festival_date` | `date` | Not null |
| `market` | `text` |  |
| `effect` | `text` | Not null, default `'demand_up'::text` |
| `purchase_price_band` | `text` |  |
| `sale_price_band` | `text` |  |
| `est_demand` | `text` |  |
| `note` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `grades`

_Added in migration 0039._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sku_id` | `uuid` | → `skus` |
| `code` | `text` | Not null |
| `label` | `text` | Not null |
| `sort_order` | `int4` | Not null, default `0` |
| `active` | `bool` | Not null, default `true` |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `grading_lines`

_Added in migration 0039._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `grading_run_id` | `uuid` | Not null, → `grading_runs` |
| `grade_id` | `uuid` | Not null, → `grades` |
| `kg` | `numeric(10,3)` | Not null |
| `photo_url` | `text` |  |

## Table `grading_runs`

_Added in migration 0039._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `batch_id` | `uuid` | Not null, → `batches` |
| `receiving_confirmation_id` | `uuid` | → `receiving_confirmations` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `received_kg` | `numeric(10,3)` | Not null |
| `shrink_kg` | `numeric(10,3)` | Not null, default `0` |
| `unreconciled_kg` | `numeric(10,3)` | Not null, default `0` |
| `note` | `text` |  |
| `graded_by` | `uuid` | Not null, → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `superseded_at` | `timestamptz` |  |
| `superseded_by_run_id` | `uuid` | → `grading_runs` |

## Table `locations`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `name` | `text` | Not null |
| `display_name` | `text` | Not null |
| `kind` | `text` | Not null |
| `active` | `bool` | Not null, default `true` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `warehouse_id` | `uuid` | Not null, → `warehouses` |

## Table `market_prices`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `market` | `text` | Not null |
| `sku_id` | `uuid` | Not null, → `skus` |
| `price_date` | `date` | Not null, default `CURRENT_DATE` |
| `price_per_kg` | `numeric(10,2)` | Not null |
| `source` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `movements`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `kind` | `text` | Not null |
| `from_location_id` | `uuid` | → `locations` |
| `to_location_id` | `uuid` | → `locations` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `kg` | `numeric(10,3)` | Not null |
| `batch_id` | `uuid` | Not null, → `batches` |
| `movement_group_id` | `uuid` | Not null |
| `sale_id` | `uuid` | → `sales` |
| `notes` | `text` |  |
| `occurred_at` | `timestamptz` | Not null, default `now()` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `created_by` | `uuid` | → `users` |
| `container_fill_id` | `uuid` | → `container_fills` |
| `destination_container_fill_id` | `uuid` | → `container_fills` |

## Table `notifications`

_Added in migration 0012._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | Not null, → `users` |
| `type` | `text` | Not null |
| `payload` | `jsonb` |  |
| `role_at_creation` | `text` | Not null |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `read_at` | `timestamptz` |  |

## Table `payments`

_Added in migration 0012._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sale_id` | `uuid` | Not null, → `sales` |
| `amount` | `numeric(10,2)` | Not null |
| `method` | `text` |  |
| `proof_status` | `text` | Not null, default `'none'::text` |
| `paid_at` | `timestamptz` | Not null, default `now()` |
| `recorded_by` | `uuid` | Not null, → `users` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `price_history`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sku_id` | `uuid` | Not null, → `skus` |
| `price_per_kg` | `numeric(10,2)` | Not null |
| `effective_from` | `date` | Not null |
| `effective_to` | `date` |  |
| `set_by` | `uuid` | Not null, → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `procurement`

_Added in migration 0040._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `code` | `text` | Not null |
| `sku_id` | `uuid` | Not null, → `skus` |
| `supplier_id` | `uuid` | Not null, → `vendors` |
| `rate_per_kg` | `numeric(10,2)` | Not null |
| `expected_kg` | `numeric(10,3)` | Not null |
| `payment_terms` | `text` | Not null, default `'cash'::text` |
| `expected_arrival` | `timestamptz` |  |
| `status` | `text` | Not null, default `'created'::text` |
| `truck_load_id` | `uuid` | → `truck_loads` |
| `notes` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `dispatched_at` | `timestamptz` |  |
| `received_kg` | `numeric(10,3)` |  |
| `received_at` | `timestamptz` |  |
| `bill_id` | `uuid` | → `bills` |
| `batch_id` | `uuid` | → `batches` |
| `cancelled_reason` | `text` |  |
| `requirement_id` | `uuid` | → `purchase_requirements` |
| `po_id` | `uuid` | → `purchase_orders` |

## Table `purchase_order_lines`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `po_id` | `uuid` | Not null, → `purchase_orders` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `qty_kg` | `numeric(10,3)` | Not null |
| `price_per_kg` | `numeric(10,2)` | Not null |
| `grade_id` | `uuid` | → `grades` |
| `procurement_id` | `uuid` | → `procurement` |
| `requirement_id` | `uuid` | → `purchase_requirements` |

## Table `purchase_orders`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `code` | `text` | Not null |
| `supplier_id` | `uuid` | Not null, → `vendors` |
| `po_date` | `date` | Not null, default `CURRENT_DATE` |
| `expected_arrival` | `date` |  |
| `destination_location_id` | `uuid` | → `locations` |
| `payment_terms_days` | `int4` | Not null, default `0` |
| `transport_cost` | `numeric(10,2)` | Not null, default `0` |
| `ice_packing_cost` | `numeric(10,2)` | Not null, default `0` |
| `status` | `text` | Not null, default `'draft'::text` |
| `note` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `sent_at` | `timestamptz` |  |

## Table `purchase_requirements`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `required_date` | `date` | Not null, default `CURRENT_DATE` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `qty_kg` | `numeric(10,3)` | Not null |
| `destination` | `text` |  |
| `priority` | `text` | Not null, default `'medium'::text` |
| `expected_price_per_kg` | `numeric(10,2)` |  |
| `status` | `text` | Not null, default `'open'::text` |
| `note` | `text` |  |
| `created_by` | `uuid` | → `users` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |

## Table `quality_issues`

_Added in migration 0041._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `truck_load_id` | `uuid` | → `truck_loads` |
| `batch_id` | `uuid` | → `batches` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `issue_type` | `text` | Not null |
| `kg_affected` | `numeric(10,3)` | Not null |
| `photo_url` | `text` |  |
| `note` | `text` |  |
| `status` | `text` | Not null, default `'open'::text` |
| `raised_by` | `uuid` | Not null, → `users` |
| `raised_at` | `timestamptz` | Not null, default `now()` |
| `resolved_by` | `uuid` | → `users` |
| `resolved_at` | `timestamptz` |  |
| `resolution_note` | `text` |  |

## Table `receiving_confirmations`

_Added in migration 0032._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `bill_id` | `uuid` | Not null, → `bills` |
| `batch_id` | `uuid` | Not null, → `batches` |
| `promised_kg` | `numeric(10,3)` | Not null |
| `confirmed_kg` | `numeric(10,3)` | Not null |
| `promised_sku_id` | `uuid` | Not null, → `skus` |
| `confirmed_sku_id` | `uuid` | Not null, → `skus` |
| `discrepancy_flag` | `bool` | Not null, default `false` |
| `notes` | `text` |  |
| `photo_status` | `text` | Not null, default `'none'::text` |
| `confirmed_by` | `uuid` | Not null, → `users` |
| `confirmed_at` | `timestamptz` | Not null, default `now()` |
| `spoiled_kg` | `numeric(10,3)` | Not null, default `0` |
| `procurement_id` | `uuid` | → `procurement` |
| `truck_load_id` | `uuid` | → `truck_loads` |

## Table `reversal_requests`

_Added in migration 0012._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sale_id` | `uuid` | Not null, → `sales` |
| `requested_by` | `uuid` | Not null, → `users` |
| `requested_at` | `timestamptz` | Not null, default `now()` |
| `status` | `text` | Not null, default `'requested'::text` |
| `reason` | `text` |  |
| `decided_by` | `uuid` | → `users` |
| `decided_at` | `timestamptz` |  |
| `executed_movement_group_id` | `uuid` |  |

## Table `sales`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `sku_id` | `uuid` | Not null, → `skus` |
| `location_id` | `uuid` | Not null, → `locations` |
| `customer_name` | `text` | Not null |
| `total_kg` | `numeric(10,3)` | Not null |
| `sale_price_per_kg` | `numeric(10,2)` | Not null |
| `total_amount` | `numeric(10,2)` | Not null |
| `sold_by` | `uuid` | Not null, → `users` |
| `sold_at` | `timestamptz` | Not null, default `now()` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `customer_id` | `uuid` | → `customers` |

## Table `skus`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `code` | `text` | Not null |
| `english_name` | `text` | Not null |
| `tamil_name` | `text` | Not null, default `''::text` |
| `category` | `text` | Not null |
| `size_grade` | `text` | Not null |
| `unit` | `text` | Not null, default `'kg'::text` |
| `shelf_life_hours` | `int4` | Not null, default `24` |
| `storage_type` | `text` | Not null, default `'chilled'::text` |
| `low_stock_threshold_kg` | `numeric(10,2)` | Not null, default `5.00` |
| `active` | `bool` | Not null, default `true` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |
| `created_by` | `uuid` | → `users` |
| `updated_by` | `uuid` | → `users` |

## Table `supplier_quotations`

_Added in migration 0042._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `requirement_id` | `uuid` | → `purchase_requirements` |
| `sku_id` | `uuid` | Not null, → `skus` |
| `qty_kg` | `numeric(10,3)` | Not null |
| `destination` | `text` |  |
| `supplier_id` | `uuid` | Not null, → `vendors` |
| `price_per_kg` | `numeric(10,2)` | Not null |
| `transport_cost` | `numeric(10,2)` | Not null, default `0` |
| `ice_packing_cost` | `numeric(10,2)` | Not null, default `0` |
| `loading_cost` | `numeric(10,2)` | Not null, default `0` |
| `other_cost` | `numeric(10,2)` | Not null, default `0` |
| `quoted_at` | `timestamptz` | Not null, default `now()` |
| `valid_until` | `date` |  |
| `selected` | `bool` | Not null, default `false` |
| `po_id` | `uuid` | → `purchase_orders` |
| `note` | `text` |  |
| `created_by` | `uuid` | → `users` |

## Table `tasks`

_Added in migration 0024._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `type` | `text` | Not null |
| `title` | `text` |  |
| `assigned_to` | `uuid` | Not null, → `users` |
| `assigned_by` | `uuid` | → `users` |
| `assignment_mode` | `text` | Not null |
| `status` | `text` | Not null, default `'pending'::text` |
| `related_vendor_id` | `uuid` | → `vendors` |
| `related_customer_id` | `uuid` | → `customers` |
| `related_bill_id` | `uuid` | → `bills` |
| `related_sale_id` | `uuid` | → `sales` |
| `assigned_at` | `timestamptz` | Not null, default `now()` |
| `started_at` | `timestamptz` |  |
| `completed_at` | `timestamptz` |  |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `truck_loads`

_Added in migration 0040._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `code` | `text` | Not null |
| `vehicle_no` | `text` |  |
| `expected_arrival` | `timestamptz` |  |
| `destination_location_id` | `uuid` | → `locations` |
| `status` | `text` | Not null, default `'dispatched'::text` |
| `notes` | `text` |  |
| `dispatched_by` | `uuid` | → `users` |
| `dispatched_at` | `timestamptz` | Not null, default `now()` |
| `received_by` | `uuid` | → `users` |
| `received_at` | `timestamptz` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `user_role_history`

_Added in migration 0012._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` | Not null, → `users` |
| `role` | `text` | Not null |
| `effective_from` | `timestamptz` | Not null, default `now()` |
| `effective_to` | `timestamptz` |  |

## Table `users`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `email` | `text` |  |
| `phone` | `text` |  |
| `display_name` | `text` | Not null |
| `role` | `text` | Not null |
| `active` | `bool` | Not null, default `true` |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |
| `created_by` | `uuid` | → `users` |
| `updated_by` | `uuid` | → `users` |
| `can_self_reverse` | `bool` | Not null, default `false` |
| `receiving_blind` | `bool` | Not null, default `false` |

## Table `vendor_payments`

_Added in migration 0020._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `vendor_id` | `uuid` | Not null, → `vendors` |
| `bill_id` | `uuid` | → `bills` |
| `amount` | `numeric(10,2)` | Not null |
| `method` | `text` |  |
| `paid_at` | `timestamptz` | Not null, default `now()` |
| `recorded_by` | `uuid` | Not null, → `users` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |

## Table `vendors`

_Added in migration 0001._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `name` | `text` | Not null |
| `phone` | `text` |  |
| `port_or_village` | `text` |  |
| `boat_name` | `text` |  |
| `typical_catch` | `text` |  |
| `reliability` | `int2` | Not null, default `3` |
| `active` | `bool` | Not null, default `true` |
| `notes` | `text` |  |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |
| `created_by` | `uuid` | → `users` |
| `updated_by` | `uuid` | → `users` |

## Table `warehouses`

_Added in migration 0006._

| Name | Type | Constraints |
|---|---|---|
| `id` | `uuid` | Primary |
| `name` | `text` | Not null |
| `display_name` | `text` | Not null |
| `active` | `bool` | Not null, default `true` |
| `created_at` | `timestamptz` | Not null, default `now()` |

---

## RLS policies

### `app_settings`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `app_settings_select_authenticated` | SELECT | `true` | — |

### `audit_log`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `audit_log_select_admin` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | — |

### `batches`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `batches_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `batches_select_authenticated` | SELECT | `((NOT blind_receiving_enforced()) OR can_view_procurement_money())` | — |
| `batches_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `bills`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `bills_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `bills_select_authenticated` | SELECT | `((NOT blind_receiving_enforced()) OR can_view_procurement_money())` | — |
| `bills_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `check_ins`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `check_ins_select_own_or_admin` | SELECT | `((user_id = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text])))` | — |

### `code_counters`

No policies: RLS is on and nothing is granted to `authenticated`, so the table is reachable only through `SECURITY DEFINER` functions or the service key.

### `container_fill_items`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `container_fill_items_insert_rep_or_worker` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'worker'::text, 'super-worker'::text]))` |
| `container_fill_items_select_authenticated` | SELECT | `true` | — |

### `container_fills`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `container_fills_insert_rep_or_worker` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'worker'::text, 'super-worker'::text]))` |
| `container_fills_select_authenticated` | SELECT | `true` | — |
| `container_fills_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `containers`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `containers_delete_admin` | DELETE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | — |
| `containers_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `containers_select_authenticated` | SELECT | `true` | — |
| `containers_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `customer_complaints`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `customer_complaints_select_non_worker` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |

### `customers`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `customers_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `customers_select_non_worker` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |
| `customers_update_rep` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |

### `festivals`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `festivals_insert_team` | INSERT | — | `can_manage_procurement()` |
| `festivals_select_team` | SELECT | `can_manage_procurement()` | — |
| `festivals_update_team` | UPDATE | `can_manage_procurement()` | `can_manage_procurement()` |

### `grades`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `grades_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `grades_select_authenticated` | SELECT | `true` | — |
| `grades_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `grading_lines`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `grading_lines_select_authenticated` | SELECT | `true` | — |

### `grading_runs`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `grading_runs_select_authenticated` | SELECT | `true` | — |

### `locations`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `locations_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `locations_select_authenticated` | SELECT | `true` | — |
| `locations_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `market_prices`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `market_prices_insert_team` | INSERT | — | `can_manage_procurement()` |
| `market_prices_select_team` | SELECT | `can_manage_procurement()` | — |
| `market_prices_update_team` | UPDATE | `can_manage_procurement()` | `can_manage_procurement()` |

### `movements`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `movements_insert_role_checked` | INSERT | — | `(((kind = ANY (ARRAY['delivery_in'::text, 'sale'::text])) AND (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))) OR ((kind = 'spoilage'::text) AND (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'worker'::text, 'super-worker'::text]))) OR ((kind = 'repack'::text) AND (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'worker'::text, 'super-worker'::text]))) OR ((kind = 'transfer'::text) AND (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))))` |
| `movements_select_authenticated` | SELECT | `true` | — |

### `notifications`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `notifications_select_own` | SELECT | `(user_id = auth.uid())` | — |
| `notifications_update_own` | UPDATE | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

### `payments`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `payments_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `payments_select_non_worker` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |

### `price_history`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `price_history_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `price_history_select_authenticated` | SELECT | `true` | — |

### `procurement`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `procurement_select_team` | SELECT | `can_manage_procurement()` | — |

### `purchase_order_lines`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `purchase_order_lines_select_team` | SELECT | `can_manage_procurement()` | — |

### `purchase_orders`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `purchase_orders_select_team` | SELECT | `can_manage_procurement()` | — |

### `purchase_requirements`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `purchase_requirements_insert_team` | INSERT | — | `can_manage_procurement()` |
| `purchase_requirements_select_team` | SELECT | `can_manage_procurement()` | — |
| `purchase_requirements_update_team` | UPDATE | `can_manage_procurement()` | `can_manage_procurement()` |

### `quality_issues`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `quality_issues_select_receivers` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |

### `receiving_confirmations`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `receiving_confirmations_select` | SELECT | `((current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text])) AND ((NOT blind_receiving_enforced()) OR can_view_procurement_money()))` | — |

### `reversal_requests`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `reversal_requests_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `reversal_requests_select_non_worker` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |
| `reversal_requests_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `sales`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `sales_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `sales_select_authenticated` | SELECT | `true` | — |
| `sales_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `skus`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `skus_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `skus_select_authenticated` | SELECT | `true` | — |
| `skus_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `supplier_quotations`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `supplier_quotations_insert_team` | INSERT | — | `can_manage_procurement()` |
| `supplier_quotations_select_team` | SELECT | `can_manage_procurement()` | — |
| `supplier_quotations_update_team` | UPDATE | `can_manage_procurement()` | `can_manage_procurement()` |

### `tasks`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `tasks_select_own_or_admin` | SELECT | `((assigned_to = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text])))` | — |
| `tasks_update_own_or_admin` | UPDATE | `((assigned_to = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text])))` | `((assigned_to = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text])))` |

### `truck_loads`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `truck_loads_select_receivers` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` | — |

### `user_role_history`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `user_role_history_select_admin` | SELECT | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | — |

### `users`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `users_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `users_select_authenticated` | SELECT | `true` | — |
| `users_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `vendor_payments`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `vendor_payments_insert_rep` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text]))` |
| `vendor_payments_select_non_worker` | SELECT | `((current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text])) AND ((NOT blind_receiving_enforced()) OR can_view_procurement_money()))` | — |

### `vendors`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `vendors_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `vendors_select_non_worker` | SELECT | `((current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text, 'vendor-rep'::text, 'super-worker'::text])) AND ((NOT blind_receiving_enforced()) OR can_view_procurement_money()))` | — |
| `vendors_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

### `warehouses`

| Policy | Command | USING | WITH CHECK |
|---|---|---|---|
| `warehouses_insert_admin` | INSERT | — | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |
| `warehouses_select_authenticated` | SELECT | `true` | — |
| `warehouses_update_admin` | UPDATE | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` | `(current_user_role() = ANY (ARRAY['admin'::text, 'co-admin'::text]))` |

---

## Functions

`DEF` = `SECURITY DEFINER` (runs with the owner's rights; these are the only writers for most tables). `exec` = the `authenticated` role may call it directly; functions without it are internal helpers.

| Function | Arguments | DEF | exec | Defined in |
|---|---|---|---|---|
| `_is_purchase_batch` | `p_batch_id uuid` | yes | yes | 0037 |
| `_ist_day` | `p timestamp with time zone` |  | yes | 0037 |
| `_notify_once` | `p_type text, p_key text, p_payload jsonb` | yes |  | 0044 |
| `_vendor_quality_scorecard` | `p_from date, p_to date` | yes |  | 0041 |
| `analytics_purchase_by_fish` | `p_from date, p_to date` | yes | yes | 0043 |
| `analytics_purchase_vs_sale_price` | `p_from date, p_to date` | yes | yes | 0043 |
| `analytics_supplier_split` | `p_from date, p_to date` | yes | yes | 0043 |
| `apply_movement_to_batches` | `` | yes |  | 0001 |
| `audit_trigger` | `` | yes |  | 0001 |
| `auto_complete_task` | `p_type text, p_user_id uuid, p_vendor_id uuid, p_customer_id uuid, p_bill_id uuid, p_sale_id uuid` | yes |  | 0024 |
| `blind_receiving_enforced` | `` | yes | yes | 0037 |
| `can_manage_procurement` | `` | yes | yes | 0037 |
| `can_view_procurement_money` | `` | yes | yes | 0037 |
| `cancel_procurement` | `p_procurement_id uuid, p_reason text` | yes | yes | 0040 |
| `clamp_can_self_reverse` | `` | yes |  | 0033 |
| `compute_container_fill_expiry` | `p_filled_at timestamp with time zone, p_sku_ids uuid[]` |  | yes | 0007 |
| `confirm_delivery_arrival` | `p_batch_id uuid, p_destination_location_id uuid, p_confirmed_good_kg numeric, p_confirmed_spoiled_kg numeric, p_confirmed_sku_id uuid, p_notes text, p_photo_status text` | yes | yes | 0036 |
| `container_card` | `p_container_id uuid, p_container_number text` | yes | yes | 0044 |
| `container_fill_is_mixed` | `p_fill_id uuid` | yes | yes | 0045 |
| `container_sourced_cascade` | `p_sku_id uuid, p_location_id uuid, p_kg numeric, p_kind text, p_sale_id uuid, p_movement_group_id uuid, p_notes text, p_user_id uuid` | yes |  | 0010 |
| `create_procurement` | `p_sku_id uuid, p_expected_kg numeric, p_supplier_id uuid, p_rate_per_kg numeric, p_expected_arrival timestamp with time zone, p_payment_terms text, p_notes text` | yes | yes | 0040 |
| `create_purchase_order` | `p_supplier_id uuid, p_lines jsonb, p_expected_arrival date, p_destination_location_id uuid, p_payment_terms_days integer, p_transport_cost numeric, p_ice_packing_cost numeric, p_quotation_id uuid, p_note text` | yes | yes | 0042 |
| `create_task` | `p_type text, p_assigned_to uuid, p_title text, p_related_vendor_id uuid, p_related_customer_id uuid, p_notes text` | yes | yes | 0025 |
| `create_task_round_robin` | `p_type text, p_title text, p_related_vendor_id uuid, p_related_customer_id uuid, p_notes text` | yes | yes | 0025 |
| `current_user_role` | `` | yes | yes |  |
| `direct_batch_cascade` | `p_sku_id uuid, p_location_id uuid, p_kg numeric, p_kind text, p_sale_id uuid, p_movement_group_id uuid, p_notes text, p_user_id uuid` | yes |  | 0010 |
| `dispatch_procurement` | `p_procurement_ids uuid[], p_vehicle_no text, p_expected_arrival timestamp with time zone, p_destination_location_id uuid` | yes | yes | 0040 |
| `eligible_roles_for_task_type` | `p_type text` |  | yes | 0025 |
| `ensure_checked_in` | `` | yes | yes | 0024 |
| `execute_sale_reversal` | `p_reversal_request_id uuid` | yes | yes | 0035 |
| `file_customer_complaint` | `p_sale_id uuid, p_kg_returned numeric, p_claim_description text` | yes | yes | 0027 |
| `get_setting_numeric` | `p_key text, p_default numeric` | yes | yes | 0037 |
| `handle_new_user` | `` | yes |  | 0014 |
| `handle_user_delete` | `` | yes |  | 0001 |
| `home_stats_today` | `` | yes | yes | 0043 |
| `latest_market_prices` | `p_sku_id uuid` | yes | yes | 0042 |
| `list_receiving_queue` | `` | yes | yes | 0040 |
| `next_code` | `p_prefix text` | yes |  | 0037 |
| `notify_admins` | `p_type text, p_payload jsonb` | yes |  | 0018 |
| `notify_task_completion` | `` | yes |  | 0033 |
| `notify_user` | `p_user_id uuid, p_type text, p_payload jsonb` | yes |  | 0033 |
| `procurement_dashboard` | `` | yes | yes | 0043 |
| `profit_summary` | `p_from date, p_to date` | yes | yes | 0043 |
| `provision_warehouse_transit_locations` | `` | yes |  | 0031 |
| `raise_quality_issue` | `p_issue_type text, p_kg_affected numeric, p_truck_load_id uuid, p_batch_id uuid, p_sku_id uuid, p_photo_url text, p_note text` | yes | yes | 0041 |
| `reassign_orphaned_tasks_on_role_change` | `` | yes |  | 0030 |
| `receive_truck_load` | `p_truck_load_id uuid, p_lines jsonb, p_destination_location_id uuid, p_notes text, p_photo_status text` | yes | yes | 0040 |
| `reconcile_bill` | `p_bill_id uuid, p_reconciled_total_amount numeric, p_notes text, p_remind_in_days integer` | yes | yes | 0034 |
| `record_bill_delivery` | `p_vendor_id uuid, p_location_id uuid, p_bill_date date, p_vendor_bill_number text, p_items jsonb, p_payment_terms text` | yes | yes | 0034 |
| `record_container_fill` | `p_bill_id uuid, p_location_id uuid, p_container_number text, p_capacity_kg numeric, p_items jsonb, p_ownership text` | yes | yes | 0045 |
| `record_container_sale` | `p_sku_id uuid, p_location_id uuid, p_customer_name text, p_total_kg numeric, p_sale_price_per_kg numeric, p_notes text, p_customer_id uuid` | yes | yes | 0024 |
| `record_container_spoilage` | `p_sku_id uuid, p_location_id uuid, p_total_kg numeric, p_reason text, p_notes text` | yes | yes | 0009 |
| `record_grading_run` | `p_batch_id uuid, p_lines jsonb, p_shrink_kg numeric, p_note text` | yes | yes | 0039 |
| `record_repack` | `p_source_fill_id uuid, p_destination_container_id uuid` | yes | yes | 0024 |
| `record_transfer_cascade` | `p_sku_id uuid, p_from_location_id uuid, p_to_location_id uuid, p_kg numeric, p_notes text` | yes | yes | 0029 |
| `release_purchase_order` | `p_po_id uuid` | yes | yes | 0042 |
| `report_purchases` | `p_from date, p_to date` | yes | yes | 0043 |
| `report_sales` | `p_from date, p_to date` | yes | yes | 0043 |
| `report_stock` | `` | yes | yes | 0043 |
| `request_sale_reversal` | `p_sale_id uuid, p_reason text` | yes | yes | 0018 |
| `resolve_customer_complaint` | `p_complaint_id uuid, p_kg_confirmed_bad numeric, p_kg_confirmed_good_restocked numeric, p_kg_rejected_no_action numeric, p_rejected_disposition text, p_operation_charge numeric, p_resolution_notes text, p_unrefrigerated_multiplier numeric` | yes | yes | 0028 |
| `resolve_quality_issue` | `p_issue_id uuid, p_note text` | yes | yes | 0041 |
| `run_alert_sweeps` | `` | yes | yes | 0044 |
| `select_quotation` | `p_quotation_id uuid` | yes | yes | 0042 |
| `set_app_setting` | `p_key text, p_value jsonb` | yes | yes | 0037 |
| `sync_po_status` | `` | yes |  | 0042 |
| `touch_updated_at` | `` |  |  | 0042 |
| `trace_batch` | `p_batch_id uuid` | yes | yes | 0041 |
| `trace_sale` | `p_sale_id uuid` | yes | yes | 0041 |
| `track_user_role_change` | `` | yes |  | 0012 |
| `vendor_quality_scorecard` | `p_from date, p_to date` | yes | yes | 0041 |
