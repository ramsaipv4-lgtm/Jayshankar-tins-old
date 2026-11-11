-- 0036_fix_confirm_delivery_arrival_movement_group_id.sql — Jayshankar V1 sprint
-- Real bug found live, running seed-demo-showcase.mjs's updated in-transit/confirm-arrival
-- section for the first time against actually-applied migrations (0030-0035): both movement
-- INSERTs inside confirm_delivery_arrival (migration 0033) omitted movement_group_id, which has
-- been NOT NULL since migration 0001 -- every other RPC in this project generates one
-- (`v_group_id uuid := gen_random_uuid()`) and this one simply never did. 23502 not-null-
-- violation on the very first real attempt to confirm an arrival with a discrepancy.
--
-- Fixed by grouping the 'receiving_confirmed' movement and the 'spoilage' movement (when there
-- is one) under the SAME new group id -- they're one physical event (fish arrives, some of it is
-- immediately found bad), the same grouping convention record_bill_delivery/record_transfer_
-- cascade/etc already use for their own multi-movement events.
--
-- Same 7-parameter signature as migration 0033 -- plain CREATE OR REPLACE, no overload risk.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0035.

create or replace function public.confirm_delivery_arrival(
  p_batch_id uuid,
  p_destination_location_id uuid,
  p_confirmed_good_kg numeric,
  p_confirmed_spoiled_kg numeric default 0,
  p_confirmed_sku_id uuid default null,
  p_notes text default null,
  p_photo_status text default 'none'
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
  v_batch record;
  v_source_kind text;
  v_source_warehouse_id uuid;
  v_dest_kind text;
  v_dest_warehouse_id uuid;
  v_final_sku_id uuid;
  v_total_measured numeric(10,3);
  v_discrepancy boolean;
  v_confirmation_id uuid := gen_random_uuid();
  v_vendor_name text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'confirm_delivery_arrival: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_confirmed_good_kg < 0 or p_confirmed_spoiled_kg < 0 then
    return jsonb_build_object('error', 'Kg values cannot be negative');
  end if;
  v_total_measured := p_confirmed_good_kg + p_confirmed_spoiled_kg;
  if v_total_measured <= 0 then
    return jsonb_build_object('error', 'At least some kg must have arrived');
  end if;
  if p_photo_status not in ('none', 'pending_upload', 'uploaded') then
    return jsonb_build_object('error', 'Invalid photo status');
  end if;

  select id, bill_id, sku_id, vendor_id, kg, kg_remaining, location_id
    into v_batch
    from public.batches
   where id = p_batch_id
   for update;

  if not found then
    return jsonb_build_object('error', 'Batch not found');
  end if;
  if v_batch.bill_id is null then
    return jsonb_build_object('error', 'This batch has no bill — nothing to confirm');
  end if;
  if v_batch.kg_remaining is distinct from v_batch.kg then
    return jsonb_build_object('error',
      'This batch already has activity against it (packed/sold/spoiled) — it can''t still be in transit');
  end if;

  select kind, warehouse_id into v_source_kind, v_source_warehouse_id
    from public.locations where id = v_batch.location_id;
  if v_source_kind is distinct from 'in_transit_inbound' then
    return jsonb_build_object('error', 'This batch is not sitting in an inbound-transit location — nothing to confirm');
  end if;

  select kind, warehouse_id into v_dest_kind, v_dest_warehouse_id
    from public.locations where id = p_destination_location_id;
  if v_dest_kind is null then
    return jsonb_build_object('error', 'Destination location not found');
  end if;
  if v_dest_kind in ('in_transit_inbound', 'in_transit_outbound') then
    return jsonb_build_object('error', 'Destination must be a real storage location, not another transit stage');
  end if;
  if v_dest_warehouse_id is distinct from v_source_warehouse_id then
    return jsonb_build_object('error',
      'Destination must be in the same warehouse this delivery is inbound to');
  end if;

  v_final_sku_id := coalesce(p_confirmed_sku_id, v_batch.sku_id);
  v_discrepancy := (v_total_measured is distinct from v_batch.kg) or (v_final_sku_id is distinct from v_batch.sku_id);

  update public.batches
     set location_id = p_destination_location_id,
         sku_id = v_final_sku_id,
         kg = v_total_measured,
         kg_remaining = v_total_measured
   where id = p_batch_id;

  insert into public.movements (
    kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, occurred_at, created_by
  ) values (
    'receiving_confirmed', v_batch.location_id, p_destination_location_id, v_final_sku_id,
    v_total_measured, p_batch_id, v_group_id, now(), v_user_id
  );

  if p_confirmed_spoiled_kg > 0 then
    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, notes, occurred_at, created_by
    ) values (
      'spoilage', p_destination_location_id, null, v_final_sku_id, p_confirmed_spoiled_kg,
      p_batch_id, v_group_id, coalesce(p_notes, 'Found spoiled/damaged at receiving confirmation'), now(), v_user_id
    );
  end if;

  insert into public.receiving_confirmations (
    id, bill_id, batch_id, promised_kg, confirmed_kg, spoiled_kg, promised_sku_id, confirmed_sku_id,
    discrepancy_flag, notes, photo_status, confirmed_by
  ) values (
    v_confirmation_id, v_batch.bill_id, p_batch_id, v_batch.kg, p_confirmed_good_kg, p_confirmed_spoiled_kg,
    v_batch.sku_id, v_final_sku_id, v_discrepancy, p_notes, p_photo_status, v_user_id
  );

  if v_discrepancy then
    select name into v_vendor_name from public.vendors where id = v_batch.vendor_id;
    perform public.notify_admins('delivery_discrepancy', jsonb_build_object(
      'bill_id', v_batch.bill_id, 'batch_id', p_batch_id, 'vendor_name', v_vendor_name,
      'promised_kg', v_batch.kg, 'confirmed_good_kg', p_confirmed_good_kg,
      'confirmed_spoiled_kg', p_confirmed_spoiled_kg,
      'sku_changed', v_final_sku_id is distinct from v_batch.sku_id
    ));
  end if;

  return jsonb_build_object(
    'confirmation_id', v_confirmation_id,
    'discrepancy_flag', v_discrepancy,
    'confirmed_good_kg', p_confirmed_good_kg,
    'confirmed_spoiled_kg', p_confirmed_spoiled_kg,
    'promised_kg', v_batch.kg,
    'movement_group_id', v_group_id
  );
end;
$$;

grant execute on function public.confirm_delivery_arrival(uuid, uuid, numeric, numeric, uuid, text, text) to authenticated;
