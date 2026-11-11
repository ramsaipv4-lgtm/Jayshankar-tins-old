-- 0023_more_event_notifications.sql — Jayshankar V1 sprint (D27, Track A)
-- Extends the notification bell (migration 0018) beyond reversal requests, per the user's own
-- scoping: "Track A — more event notifications... cheapest, no new infrastructure." Two events,
-- both genuinely event-triggered (fire the instant something happens, no schedule/polling
-- needed) — the third candidate originally considered, "a container nearing expiry," was
-- dropped from this track on reflection: expiry approaches purely with the passage of time, not
-- because of any action, so it structurally needs a scheduled check (pg_cron or similar) — that
-- belongs to Track C (the periodic-digest track), not this one. Keeping it out of Track A rather
-- than forcing a bad fit. See BUILDER-DECISIONS-REVIEW.md decision #68.
--
-- 1. bill_received — admin/co-admin notified whenever a rep records a new bill
--    (record_bill_delivery, migration 0019, already live).
-- 2. customer_over_limit — admin/co-admin notified whenever a sale pushes a customer over their
--    credit_limit. Checked by reading customer_credit_status for that customer immediately
--    after the sale is inserted, within the same transaction — Postgres reads its own
--    uncommitted writes within one transaction, so the view correctly reflects the sale that
--    was just recorded, not stale pre-sale data.
--
-- Both functions are re-issued in full (CREATE OR REPLACE), not just the delta — 0015/0019 are
-- already live, so per this project's own convention this is a fix-forward addition, not an
-- edit to an already-applied migration.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0022.

create or replace function public.record_bill_delivery(
  p_vendor_id uuid,
  p_location_id uuid,
  p_bill_date date default current_date,
  p_vendor_bill_number text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_bill_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_item_count int := 0;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
  v_vendor_name text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_bill_delivery: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_vendor_id is null then
    return jsonb_build_object('error', 'Vendor is required');
  end if;
  if p_location_id is null then
    return jsonb_build_object('error', 'Location is required');
  end if;
  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'At least one fish line is required');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;

    if not (v_item ? 'sku_id') or not (v_item ? 'kg') or not (v_item ? 'price_per_kg_paid') then
      return jsonb_build_object('error', format('Line %s is missing a required field', v_item_count));
    end if;
    if (v_item->>'kg')::numeric <= 0 then
      return jsonb_build_object('error', format('Line %s: kg must be positive', v_item_count));
    end if;
    if (v_item->>'price_per_kg_paid')::numeric < 0 then
      return jsonb_build_object('error', format('Line %s: price cannot be negative', v_item_count));
    end if;
    if not exists (select 1 from public.skus where id = (v_item->>'sku_id')::uuid) then
      return jsonb_build_object('error', format('Line %s: SKU not found', v_item_count));
    end if;

    v_total := v_total + round((v_item->>'kg')::numeric * (v_item->>'price_per_kg_paid')::numeric, 2);
  end loop;

  insert into public.bills (id, vendor_id, vendor_bill_number, bill_date, total_amount, created_by)
  values (v_bill_id, p_vendor_id, p_vendor_bill_number, coalesce(p_bill_date, current_date), v_total, v_user_id);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_batch_id := gen_random_uuid();

    insert into public.batches (
      id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at,
      bill_id, created_by
    ) values (
      v_batch_id, (v_item->>'sku_id')::uuid, p_vendor_id, p_location_id,
      (v_item->>'kg')::numeric, (v_item->>'kg')::numeric, (v_item->>'price_per_kg_paid')::numeric,
      now(), v_bill_id, v_user_id
    );

    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, created_by
    ) values (
      'delivery_in', null, p_location_id, (v_item->>'sku_id')::uuid, (v_item->>'kg')::numeric,
      v_batch_id, v_group_id, v_user_id
    );

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch_id, 'sku_id', v_item->>'sku_id', 'kg', v_item->>'kg'
    );
  end loop;

  select name into v_vendor_name from public.vendors where id = p_vendor_id;
  perform public.notify_admins('bill_received', jsonb_build_object(
    'bill_id', v_bill_id, 'vendor_id', p_vendor_id, 'vendor_name', v_vendor_name, 'total_amount', v_total
  ));

  return jsonb_build_object(
    'bill_id', v_bill_id,
    'movement_group_id', v_group_id,
    'total_amount', v_total,
    'batches', v_batches
  );
end;
$$;

grant execute on function public.record_bill_delivery(uuid, uuid, date, text, jsonb) to authenticated;

create or replace function public.record_container_sale(
  p_sku_id uuid,
  p_location_id uuid,
  p_customer_name text,
  p_total_kg numeric,
  p_sale_price_per_kg numeric,
  p_notes text default null,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_sale_id uuid := gen_random_uuid();
  v_container_drawn numeric(10,3);
  v_direct_drawn numeric(10,3) := 0;
  v_fulfilled numeric(10,3);
  v_customer_name text := p_customer_name;
  v_over_limit boolean;
  v_outstanding numeric(10,2);
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_container_sale: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_total_kg <= 0 then
    return jsonb_build_object('error', 'kg must be positive');
  end if;
  if p_sale_price_per_kg <= 0 then
    return jsonb_build_object('error', 'Sale price must be positive');
  end if;

  if p_customer_id is not null then
    select name into v_customer_name from public.customers where id = p_customer_id;
    if v_customer_name is null then
      return jsonb_build_object('error', 'Selected customer not found');
    end if;
  end if;

  if v_customer_name is null or btrim(v_customer_name) = '' then
    return jsonb_build_object('error', 'Customer name is required');
  end if;

  v_container_drawn := public.container_sourced_cascade(
    p_sku_id, p_location_id, p_total_kg, 'sale', null, v_group_id, p_notes, v_user_id);

  if p_total_kg - v_container_drawn > 0 then
    v_direct_drawn := public.direct_batch_cascade(
      p_sku_id, p_location_id, p_total_kg - v_container_drawn, 'sale', null, v_group_id, p_notes, v_user_id);
  end if;

  v_fulfilled := v_container_drawn + v_direct_drawn;

  if v_fulfilled = 0 then
    return jsonb_build_object('error', 'No stock at this location for this SKU', 'shortfall', p_total_kg);
  end if;

  insert into public.sales (
    id, sku_id, location_id, customer_name, customer_id, total_kg, sale_price_per_kg,
    total_amount, sold_by, sold_at, notes
  ) values (
    v_sale_id, p_sku_id, p_location_id, btrim(v_customer_name), p_customer_id, v_fulfilled,
    p_sale_price_per_kg, round(v_fulfilled * p_sale_price_per_kg, 2), v_user_id, now(), p_notes
  );

  update public.movements
     set sale_id = v_sale_id
   where movement_group_id = v_group_id
     and sale_id is null;

  -- customer_over_limit (D27 Track A): read within the same transaction, so this sees the sale
  -- just inserted above, not stale pre-sale data.
  if p_customer_id is not null then
    select is_over_limit, outstanding_balance into v_over_limit, v_outstanding
      from public.customer_credit_status where customer_id = p_customer_id;
    if coalesce(v_over_limit, false) is true then
      perform public.notify_admins('customer_over_limit', jsonb_build_object(
        'customer_id', p_customer_id, 'customer_name', v_customer_name,
        'sale_id', v_sale_id, 'outstanding_balance', v_outstanding
      ));
    end if;
  end if;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'movement_group_id', v_group_id,
    'kg_sold', v_fulfilled,
    'shortfall', p_total_kg - v_fulfilled,
    'container_sourced_kg', v_container_drawn,
    'direct_sourced_kg', v_direct_drawn
  );
end;
$$;
