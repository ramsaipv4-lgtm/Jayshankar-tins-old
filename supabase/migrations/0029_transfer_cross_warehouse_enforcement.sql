-- 0029_transfer_cross_warehouse_enforcement.sql — Jayshankar V1 sprint
-- Implements §8.15b for real, now that a genuine second warehouse exists: "A transfer movement
-- is only creatable between two rows in locations that belong to DIFFERENT warehouse_ids — a
-- same-warehouse 'transfer' is rejected; the correct operation for moving stock within one
-- warehouse is repack." This has been a locked acceptance criterion since D29, never actually
-- enforced at the database level — deliberately left dormant per migration 0010's own comment
-- ("doesn't run in practice until a 2nd warehouse exists"). It does now.
--
-- Found in the same pass, and fixed separately in the frontend (not this migration): App.tsx's
-- /transfer route had been left at its pre-D29 role scope (worker/super-worker/vendor-rep) —
-- rls-policies.sql's own comment confirms D29 restricted transfer to admin/co-admin only, a
-- cross-warehouse action, no longer a routine worker/rep task. The mismatch meant no role could
-- actually submit a transfer through the UI at all before this fix — whoever the frontend let
-- in, the backend rejected. See BUILDER-DECISIONS-REVIEW.md decision #78.
--
-- Same 5-parameter signature as always (uuid, uuid, uuid, numeric, text) — no overload risk,
-- unlike the two near-misses earlier this sprint (decisions #73/#77).
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0028.

create or replace function public.record_transfer_cascade(
  p_sku_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_kg numeric,
  p_notes text default null
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
  v_now timestamptz := now();
  v_dest_batch_id uuid := gen_random_uuid();
  v_candidate record;
  v_item_remaining numeric(10,3);
  v_found_container_source boolean := false;
  v_source_fill_id uuid;
  v_source_batch record;
  v_deduct numeric(10,3);
  v_shortfall numeric(10,3);
  v_dest_timestamp timestamptz;
  v_from_warehouse_id uuid;
  v_to_warehouse_id uuid;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'record_transfer_cascade: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_kg <= 0 then
    return jsonb_build_object('error', 'kg must be positive');
  end if;
  if p_from_location_id = p_to_location_id then
    return jsonb_build_object('error', 'Source and destination must be different locations');
  end if;

  -- §8.15b: transfer is cross-warehouse-only. Same-warehouse stock movement is repack's job.
  select warehouse_id into v_from_warehouse_id from public.locations where id = p_from_location_id;
  select warehouse_id into v_to_warehouse_id from public.locations where id = p_to_location_id;
  if v_from_warehouse_id is null or v_to_warehouse_id is null then
    return jsonb_build_object('error', 'Source or destination location not found');
  end if;
  if v_from_warehouse_id = v_to_warehouse_id then
    return jsonb_build_object('error', 'Source and destination must be in different warehouses — use repack to move stock within one warehouse');
  end if;

  for v_candidate in
    select cfi.batch_id, cf.id as fill_id, cf.filled_at, cfi.kg as original_kg
      from public.container_fills cf
      join public.container_fill_items cfi on cfi.container_fill_id = cf.id
      join public.batches b on b.id = cfi.batch_id
     where cf.location_id = p_from_location_id
       and b.sku_id = p_sku_id
       and cf.kg_remaining > 0
     order by cf.expires_at asc
  loop
    perform 1 from public.container_fills where id = v_candidate.fill_id for update;

    select v_candidate.original_kg - coalesce(sum(m.kg), 0)
      into v_item_remaining
      from public.movements m
     where m.container_fill_id = v_candidate.fill_id
       and m.batch_id = v_candidate.batch_id
       and m.kind in ('sale', 'spoilage', 'transfer');
    v_item_remaining := coalesce(v_item_remaining, v_candidate.original_kg);

    if v_item_remaining > 0 then
      v_found_container_source := true;
      exit;
    end if;
  end loop;

  if v_found_container_source then
    select id, kg_remaining, vendor_id, price_per_kg_paid
      into v_source_batch
      from public.batches
     where id = v_candidate.batch_id
     for update;

    v_deduct := least(p_kg, v_item_remaining, v_source_batch.kg_remaining);
    v_dest_timestamp := v_candidate.filled_at;
    v_source_fill_id := v_candidate.fill_id;
  else
    for v_source_batch in
      select id, kg_remaining, vendor_id, price_per_kg_paid, delivered_at
        from public.batches
       where sku_id = p_sku_id and location_id = p_from_location_id and kg_remaining > 0
       order by delivered_at asc, id asc
       for update
    loop
      declare
        v_packed numeric(10,3);
        v_available numeric(10,3);
      begin
        select coalesce(sum(cfi.kg), 0)
             - coalesce((
                 select sum(m.kg) from public.movements m
                  where m.batch_id = v_source_batch.id and m.container_fill_id is not null
                    and m.kind in ('sale', 'spoilage', 'transfer')
               ), 0)
          into v_packed
          from public.container_fill_items cfi
         where cfi.batch_id = v_source_batch.id;
        v_packed := greatest(coalesce(v_packed, 0), 0);

        v_available := v_source_batch.kg_remaining - v_packed;
        if v_available > 0 then
          v_deduct := least(p_kg, v_available);
          v_dest_timestamp := v_source_batch.delivered_at;
          exit;
        end if;
      end;
    end loop;

    if v_deduct is null then
      return jsonb_build_object('error', 'No stock at source location', 'shortfall', p_kg);
    end if;
  end if;

  v_shortfall := p_kg - v_deduct;

  insert into public.batches (
    id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at
  ) values (
    v_dest_batch_id, p_sku_id, v_source_batch.vendor_id, p_to_location_id,
    v_deduct, v_deduct, v_source_batch.price_per_kg_paid, v_dest_timestamp
  );

  insert into public.movements (
    kind, from_location_id, to_location_id, sku_id, kg, batch_id,
    container_fill_id, movement_group_id, notes, occurred_at, created_by
  ) values (
    'transfer', p_from_location_id, p_to_location_id, p_sku_id, v_deduct,
    v_source_batch.id, v_source_fill_id, v_group_id, p_notes, v_now, v_user_id
  );

  if v_source_fill_id is not null then
    update public.container_fills set kg_remaining = kg_remaining - v_deduct where id = v_source_fill_id;
  end if;

  return jsonb_build_object(
    'destination_batch_id', v_dest_batch_id,
    'movement_group_id', v_group_id,
    'shortfall', v_shortfall,
    'timestamp_source', case when v_source_fill_id is not null then 'container_fill' else 'batch' end
  );
end;
$$;

grant execute on function public.record_transfer_cascade(uuid, uuid, uuid, numeric, text) to authenticated;
