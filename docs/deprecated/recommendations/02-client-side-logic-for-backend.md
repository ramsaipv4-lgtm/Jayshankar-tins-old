# 02 — Client-side logic that should be Postgres views / RPCs

> Produced from a thorough audit of every component in `src/components/` and `src/pages/`. Each item below is a real piece of business logic that lives in the browser today — duplicated, drifting-risk, and consuming `numeric(10,3)`/`numeric(10,2)` arithmetic on every render.

Each item recommends where the computation should live server-side, the new view/RPC signature, and the call sites that should switch to it.

| # | What | Where duplicated today | Recommended server-side home | Why |
|---|---|---|---|---|
| **B1** | **Per-sale balance** = `Math.max(0, total_amount − sum(payments.amount))` | `PaymentManagement.tsx:92-99` reads `sales` + `payments`, sums payments grouped by `sale_id`, computes `Math.max(0, total_amount − paid)`. `CustomerCard.tsx:81-93` does the **identical** computation independently. | **New view** `customer_sale_balances(sale_id, customer_id, sold_at, total_amount, paid_amount numeric, balance numeric)` (security_invoker, same RLS pattern as `customer_credit_status`) | Same formula in two places; if rounding or floor logic ever changes, they drift. `customer_credit_status` does the per-customer aggregate; this is its per-sale twin. |
| **B2** | **Available-to-pack per batch** = `least(kg_remaining, kg − packed_in_non_repack_copies)` | `PackContainerForm.tsx:74-104` mirrors `record_container_fill`'s own guard (the RPC rejects packs that exceed `least(kg_remaining, kg − packed)`). Comment in the file: *"The form is 'mirroring' record_container_fill's own guard."* | **New view** `pack_available_per_batch(batch_id, bill_id, kg_delivered, kg_remaining, kg_packed_non_repack, kg_available)` | The RPC and the picker share one definition today by *coincidence*. A view makes drift impossible. The same view would also feed the analytics "what's still unpacked from yesterday's bill" report. |
| **B3** | **`expires_at = delivered_at + skus.shelf_life_hours`** | `FloorDashboard.tsx:62-68` and `FishCard.tsx:28-31` both compute this client-side. Comment in `FishCard.tsx`: *"shelf_life_hours... exposed on skus, not on batches."* | **New generated column** `batches.expires_at timestamptz GENERATED ALWAYS AS (delivered_at + (SELECT shelf_life_hours FROM skus WHERE id = sku_id) * interval '1 hour') STORED` — OR a view `batches_with_expiry(batch_id, expires_at)` if generated columns prove fragile | Generated column beats a view for query simplicity (every consumer joins `batches` already). If the Postgres planner complains about the subquery, fall back to the view. |
| **B4** | **Vendor top-SKU-by-kg aggregation** | `VendorCard.tsx:94-114` pulls up to 500 batches for the vendor, aggregates `kg` by `sku_id` in JS, sorts, slices top 10. **Silent truncation risk** if a vendor has >500 batches. | **New view** `vendor_top_sku_kg(vendor_id, sku_id, english_name, total_kg, batches_count)` with a proper `GROUP BY vendor_id, sku_id` (no `LIMIT 500` cap) | One vendor could easily have >500 batches after a year of operation. The current implementation silently shows wrong top-10. |
| **B5** | **Stock-by-SKU aggregation** (per-SKU total kg, per-location breakdown, low-stock flag) | `StockBySku.tsx:60-79` — explicit technical debt. **Header comment in the file itself**: *"Pilot: move to a Postgres view + a SECURITY DEFINER function for atomicity + the §8.6 performance target (decision 24)."* | **New view** `stock_by_sku(sku_id, code, english_name, tamil_name, low_stock_threshold_kg, total_kg, batch_count, by_location jsonb, is_low_stock bool)` + optional SECURITY DEFINER RPC `get_stock_by_sku(p_warehouse_id uuid)` for atomicity | The decision-24 debt. Atomicity matters because `batches.kg_remaining` is a hot column. SECURITY DEFINER lets the view bypass RLS for the aggregation while still respecting per-user visibility. |
| **B6** | **Employee activity counts** (deliveries / sales / transfers / spoilage / repacks / reversals — all the `movements.kind` values per employee, plus `sales` count and `reversal_requests` count) | `EmployeeCard.tsx:49-79` does **four separate queries**: one to `movements` (grouped by kind client-side), one head-count on `sales`, one head-count on `reversal_requests`, and one join for `users` for display. | **New view** `employee_activity_summary(user_id, display_name, role, deliveries_count, sales_count, transfers_count, spoilage_count, repacks_count, reversals_count, last_activity_at)` | One render, one query. The same view would feed any "who-does-what" admin report (Looker Studio too). |
| **B7** | **Per-sale vendor chain** (which vendor supplied the fish in each of a customer's sales, via `movements.sale_id` → `batches` → `vendors`) | `CustomerCard.tsx:95-114` walks `movements` for each sale, joins `batches → vendors`, dedupes via `Set<string>` in JS. **O(N) database roundtrips** per customer. | **New view** `sale_vendor_chain(sale_id, vendor_ids uuid[], vendor_names text[])` (security_invoker) | The current code does N+1 queries per customer with sales. The view is one query per customer. Also unblocks `FishCard`'s "where did this fish originally come from?" feature. |
| **B8** | **Notification display text + destination** | `NotificationBell.tsx:26-49` — a 7-type `switch` that hard-codes the display text and link destination for each notification type. **Adding a new notification type requires editing the bell** to know what to say. | **New view** `notifications_with_text(id, user_id, type, payload, created_at, read_at, role_at_creation, display_text text, link_href text, icon text)` — populated by a trigger that reads a `notification_type_copy` reference table | One new notification type = one new row in `notification_type_copy`, no frontend change. Also makes email / native-push templates trivially possible (they read the same view). |

## Summary

- **8 items**, every one is **buildable from existing data** via a new view (or a generated column for B3).
- **No new tables required** for any of them.
- **No RLS changes** required — all views use `security_invoker = true`, matching the project's existing pattern (`container_availability`, `customer_credit_status`, `vendor_credit_status`, `customer_complaint_summary`).
- **Performance wins** are real: B5 is the only one with a "Pilot" tag already (decision 24). B7 is N+1 → 1 query. B4 removes a silent-truncation bug.
- **Drift-prevention wins** are bigger than the perf wins: B1, B2, B8 would all eliminate the "two places compute the same thing" failure mode.

## Suggested view definitions

(Below are the actual SQL bodies; NOT applied — documented here for the migration that would ship these.)

```sql
-- B1: per-sale balance
create or replace view public.customer_sale_balances
  with (security_invoker = true)
as
select
  s.id as sale_id,
  s.customer_id,
  s.sold_at,
  s.total_amount,
  coalesce((select sum(p.amount) from public.payments p where p.sale_id = s.id), 0) as paid_amount,
  greatest(0, s.total_amount - coalesce((select sum(p.amount) from public.payments p where p.sale_id = s.id), 0)) as balance
from public.sales s
where s.customer_id is not null;

-- B2: per-batch available-to-pack
create or replace view public.pack_available_per_batch
  with (security_invoker = true)
as
select
  b.id as batch_id,
  b.bill_id,
  b.kg as kg_delivered,
  b.kg_remaining,
  coalesce((
    select sum(cfi.kg)
      from public.container_fill_items cfi
      join public.container_fills cf on cf.id = cfi.container_fill_id
     where cfi.batch_id = b.id and not cf.is_repack_copy
  ), 0) as kg_packed_non_repack,
  greatest(0, least(b.kg_remaining, b.kg - coalesce((
    select sum(cfi.kg)
      from public.container_fill_items cfi
      join public.container_fills cf on cf.id = cfi.container_fill_id
     where cfi.batch_id = b.id and not cf.is_repack_copy
  ), 0))) as kg_available
from public.batches b
where b.bill_id is not null;

-- B3: per-batch expiry — view form (if generated column approach fails)
create or replace view public.batches_with_expiry
  with (security_invoker = true)
as
select
  b.*,
  case
    when s.shelf_life_hours is not null
      then b.delivered_at + (s.shelf_life_hours * interval '1 hour')
    else null
  end as expires_at
from public.batches b
left join public.skus s on s.id = b.sku_id;

-- B4: vendor top SKUs by kg
create or replace view public.vendor_top_sku_kg
  with (security_invoker = true)
as
select
  v.id as vendor_id,
  s.id as sku_id,
  s.english_name,
  s.tamil_name,
  sum(b.kg) as total_kg,
  count(*) as batches_count
from public.vendors v
join public.batches b on b.vendor_id = v.id
join public.skus s on s.id = b.sku_id
group by v.id, s.id, s.english_name, s.tamil_name;

-- B5: stock by SKU (Pilot debt — decision #24)
create or replace view public.stock_by_sku
  with (security_invoker = true)
as
select
  s.id as sku_id,
  s.code,
  s.english_name,
  s.tamil_name,
  s.low_stock_threshold_kg,
  coalesce(sum(b.kg_remaining), 0) as total_kg,
  count(*) filter (where b.kg_remaining > 0) as batch_count,
  coalesce(jsonb_object_agg(
    coalesce(l.name, 'unknown'),
    coalesce(b_kg.loc_kg, 0)
  ) filter (where b_kg.loc_kg is not null), '{}'::jsonb) as by_location,
  coalesce(sum(b.kg_remaining), 0) < s.low_stock_threshold_kg as is_low_stock
from public.skus s
left join public.batches b on b.sku_id = s.id and b.kg_remaining > 0
left join lateral (
  select l.name, sum(b2.kg_remaining) as loc_kg
  from public.batches b2
  join public.locations l on l.id = b2.location_id
  where b2.sku_id = s.id and b2.kg_remaining > 0
  group by l.name
) b_kg on true
where s.active
group by s.id, s.code, s.english_name, s.tamil_name, s.low_stock_threshold_kg;

-- B6: employee activity summary
create or replace view public.employee_activity_summary
  with (security_invoker = true)
as
select
  u.id as user_id,
  u.display_name,
  u.role,
  u.active,
  coalesce(sum(case when m.kind = 'delivery_in' then 1 else 0 end), 0) as deliveries_count,
  coalesce(sum(case when m.kind = 'transfer' then 1 else 0 end), 0) as transfers_count,
  coalesce(sum(case when m.kind = 'sale' then 1 else 0 end), 0) as sales_count,
  coalesce(sum(case when m.kind = 'spoilage' then 1 else 0 end), 0) as spoilage_count,
  coalesce(sum(case when m.kind = 'repack' then 1 else 0 end), 0) as repacks_count,
  coalesce(sum(case when m.kind = 'reversal' then 1 else 0 end), 0) as reversals_count,
  coalesce(sum(case when m.kind = 'reversal' and m.kind = 'receiving_confirmed' then 1 else 0 end), 0) as receiving_confirmations_count,
  (select count(*) from public.sales s where s.sold_by = u.id) as sales_records_count,
  (select count(*) from public.reversal_requests rr where rr.requested_by = u.id) as reversal_requests_count,
  (select max(m2.occurred_at) from public.movements m2 where m2.created_by = u.id) as last_activity_at
from public.users u
left join public.movements m on m.created_by = u.id
group by u.id, u.display_name, u.role, u.active;

-- B7: sale vendor chain
create or replace view public.sale_vendor_chain
  with (security_invoker = true)
as
select
  m.sale_id,
  array_agg(distinct b.vendor_id) filter (where b.vendor_id is not null) as vendor_ids,
  array_agg(distinct v.name) filter (where v.id is not null) as vendor_names
from public.movements m
join public.batches b on b.id = m.batch_id
join public.vendors v on v.id = b.vendor_id
where m.sale_id is not null
group by m.sale_id;

-- B8: notification copy reference
create table if not exists public.notification_type_copy (
  type text primary key,
  display_text text not null,
  link_href_template text not null,    -- e.g. '/admin/bills/{bill_id}' or '/reversals/{reversal_request_id}'
  icon text not null default '🔔',
  created_at timestamptz not null default now()
);
-- (then trigger populates a `notifications_with_text` view from notifications + notification_type_copy)

create or replace view public.notifications_with_text
  with (security_invoker = true)
as
select
  n.id,
  n.user_id,
  n.type,
  n.payload,
  n.role_at_creation,
  n.created_at,
  n.read_at,
  c.display_text,
  -- Simple template substitution: replace {key} with payload->>key
  regexp_replace(c.link_href_template, '\{(\w+)\}', (n.payload->>'\1'), 'g') as link_href,
  c.icon
from public.notifications n
join public.notification_type_copy c on c.type = n.type;
```

## Call-site migration

Once the views exist, the following files change (call-site only, no logic change):

| File:line | Current | After |
|---|---|---|
| `src/pages/PaymentManagement.tsx:72-101` | reads `sales` + `payments`, computes per-sale balance in JS | reads `customer_sale_balances` |
| `src/pages/CustomerCard.tsx:69-93` | reads `sales` + `payments`, computes per-sale balance in JS | reads `customer_sale_balances` |
| `src/pages/PackContainerForm.tsx:64-104` | reads `batches` + `container_fill_items`, computes available-to-pack in JS | reads `pack_available_per_batch` |
| `src/pages/FloorDashboard.tsx:62-68` | computes `expires_at` from `delivered_at` + `shelf_life_hours` | uses `batches_with_expiry.expires_at` |
| `src/pages/FishCard.tsx:28-31` | computes `expires_at` from `delivered_at` + `shelf_life_hours` | uses `batches_with_expiry.expires_at` |
| `src/pages/VendorCard.tsx:94-114` | reads 500 batches + aggregates in JS | reads `vendor_top_sku_kg` |
| `src/components/StockBySku.tsx:60-79` | reads `batches` + aggregates in JS | reads `stock_by_sku` |
| `src/pages/EmployeeCard.tsx:49-79` | 4 separate queries | reads `employee_activity_summary` |
| `src/pages/CustomerCard.tsx:95-114` | walks `movements → batches → vendors` per sale | reads `sale_vendor_chain` |
| `src/components/NotificationBell.tsx:26-49` | 7-type switch for display text | reads `notifications_with_text` |

## Migration number suggestion

All 8 views (plus the `notification_type_copy` table for B8) ship as **a single migration**, e.g. `0040_views_for_client_logic.sql`. Idempotent (`create or replace view` everywhere).
