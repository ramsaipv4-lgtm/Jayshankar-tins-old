-- 0019_record_bill_delivery.sql — Jayshankar V1 sprint
-- Implements SPEC.md §4.3.7 step 1 for real: "Create the bills row (vendor, date) and one
-- batches row per SKU line, exactly as the existing delivery flow already does." Checked
-- directly against DeliveryForm.tsx/recordDelivery (mutations.ts) before writing this and
-- confirmed the claim was wrong — the pre-Mode-B W3 delivery flow never created a bills row at
-- all (batches.bill_id has sat NULL on every row since migration 0006 added the column), and it
-- only ever recorded one SKU line per submission with two sequential, unlocked client-side
-- inserts (batch, then movement — a partial-failure between them would orphan a batch with no
-- movement). This is what should have always been there: one bill, N SKU lines, one atomic
-- SECURITY DEFINER call — matching the record_transfer_cascade/record_container_fill precedent
-- rather than the old plain-insert path. See BUILDER-DECISIONS-REVIEW.md decision #64.
--
-- p_items shape: jsonb array of { "sku_id": "<uuid>", "kg": <numeric>, "price_per_kg_paid": <numeric> }.
-- One location and one vendor for the whole bill (a vendor's delivery physically arrives at one
-- place in one trip) — matches how DeliveryForm.tsx's single line already worked; only the
-- "one SKU per submission" restriction is being lifted, not the "one location" one.
--
-- Every movement from one bill shares a movement_group_id — SPEC.md's own precedent (spoilage's
-- cascade, §4.3.2 step 6) for "the audit log will show all of them as a group."
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0018.

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
begin
  -- Role check — matches rls-policies.sql's batches/bills INSERT policies exactly (same shape
  -- as record_container_fill's own check, migration 0007).
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

  -- Validate every line before writing anything — a bill with 3 lines where line 3 is invalid
  -- must reject cleanly, not leave lines 1-2 half-committed.
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

  return jsonb_build_object(
    'bill_id', v_bill_id,
    'movement_group_id', v_group_id,
    'total_amount', v_total,
    'batches', v_batches
  );
end;
$$;

grant execute on function public.record_bill_delivery(uuid, uuid, date, text, jsonb) to authenticated;
