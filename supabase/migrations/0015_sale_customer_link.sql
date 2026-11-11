-- 0015_sale_customer_link.sql — Jayshankar V1 sprint
-- Implements SPEC.md §4.3.8/D33: record_container_sale gains an optional p_customer_id, so a
-- sale can actually link to a real customers row (customer_id already existed on sales since
-- migration 0012, but nothing ever populated it — the entire CRM layer built in Mode B has had
-- zero frontend, this is the first piece of closing that gap).
--
-- Backward-compatible, deliberately: p_customer_id stays optional (default null). A one-off
-- buyer with no formal customer record works exactly as before, free-text name only — matches
-- D25's "incomplete data warns, never blocks" philosophy extended to this case. When a real
-- customer IS selected, their name is derived from the customers row (not re-typed), and
-- customer_id is set so customer_credit_status (migration 0013) actually has something to key
-- off going forward.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0014.

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
begin
  -- Role check — matches rls-policies.sql's movements INSERT policy for kind='sale'
  -- (admin, co-admin, vendor-rep, super-worker — plain 'worker' cannot record a sale).
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

  -- If a real customer was selected, derive the display name from their row rather than
  -- trusting whatever free text (if any) came alongside it -- the customer record is the
  -- authoritative name once one is linked.
  if p_customer_id is not null then
    select name into v_customer_name from public.customers where id = p_customer_id;
    if v_customer_name is null then
      return jsonb_build_object('error', 'Selected customer not found');
    end if;
  end if;

  if v_customer_name is null or btrim(v_customer_name) = '' then
    return jsonb_build_object('error', 'Customer name is required');
  end if;

  -- Movements rows are inserted with sale_id = NULL first, then backfilled once the sales row
  -- exists (below) — sales.total_kg must equal what was ACTUALLY fulfilled, which isn't known
  -- until after both cascade phases run, but movements.sale_id is an immediate (non-deferrable)
  -- FK to sales.id, so the sales row can't be created before the movements it's linked from.
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

  -- Return shape kept byte-for-byte identical to the pre-existing function (kg_sold,
  -- movement_group_id, shortfall as a plain subtraction) — only the new parameter and the
  -- customer-linking logic above are the actual change here; src/lib/mutations.ts's recordSale()
  -- reads these exact field names.
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
