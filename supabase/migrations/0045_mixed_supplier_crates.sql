-- 0045_mixed_supplier_crates.sql — Phase B (closes the "mixed crates" gap found in the research)
-- record_container_fill has refused any fill whose items come from more than one bill ("every item
-- in a fill must trace to one purchase event"). That was written for one boat, one bill. The client
-- described the opposite on the dock: fish from several boats is combined, then packed into 25 kg
-- crates. Since 0040, a truck load makes one bill (and one batch) per supplier, so a mixed crate is
-- exactly "items from several bills that came off the SAME truck load".
--
-- Changes to record_container_fill (the body below is the live function from 0033 with two targeted
-- edits, so every other rule — roles, capacity, availability, expiry — is unchanged):
--   1. it also accepts items whose batch came off the SAME truck load as the anchor bill's batches
--      (a batch from an unrelated bill is still refused);
--   2. it refuses a request that lists the same batch twice, which the per-item availability check
--      would otherwise let pack more kg than the batch holds (a latent bug in the 0033 body).
-- container_fills.bill_id still holds the anchor bill, so anything keyed on it keeps working; check
-- container_fill_is_mixed(fill_id) before presenting "this crate's supplier".
--
-- IDEMPOTENT: CREATE OR REPLACE (same 6-argument signature, so no overload). Run after 0044.

-- "Is this crate mixed?" is DERIVED from its items rather than stored, so a repack (record_repack
-- copies a fill's items) and anything else that copies items stays correct without being patched.
create or replace function public.container_fill_is_mixed(p_fill_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(distinct b.vendor_id) > 1
    from public.container_fill_items i join public.batches b on b.id = i.batch_id
   where i.container_fill_id = p_fill_id
$$;
grant execute on function public.container_fill_is_mixed(uuid) to authenticated;

create or replace function public.record_container_fill(p_bill_id uuid, p_location_id uuid, p_container_number text, p_capacity_kg numeric, p_items jsonb, p_ownership text DEFAULT 'owned'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_role         text := public.current_user_role();
  v_user_id      uuid := auth.uid();
  v_existing_container_id uuid;
  v_container_id uuid;
  v_fill_id      uuid := gen_random_uuid();
  v_now          timestamptz := now();
  v_total_kg     numeric(10,3) := 0;
  v_sku_ids      uuid[] := '{}';
  v_expires_at   timestamptz;
  v_item         jsonb;
  v_batch        record;
  v_item_count   int := 0;
  v_already_packed numeric(10,3);
  v_anchor_truck uuid;      -- 0045: truck load the anchor bill's batches came off, if any
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_container_fill: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_capacity_kg not in (5, 10, 15, 20, 25) then
    return jsonb_build_object('error',
      format('Invalid container capacity %s kg — must be 5, 10, 15, 20, or 25', round(p_capacity_kg, 2)));
  end if;
  if p_ownership not in ('owned', 'vendor_provided', 'given_to_buyer') then
    return jsonb_build_object('error', 'Invalid ownership value');
  end if;

  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'p_items must be a non-empty JSON array');
  end if;
  -- 0045: the availability check below is per item, so the same batch listed twice could pack more
  -- than the batch holds. One line per batch.
  if (select count(distinct e ->> 'batch_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    return jsonb_build_object('error', 'List each batch once; combine its kg into a single line');
  end if;

  select id into v_existing_container_id
    from public.containers
   where container_number = p_container_number
     and active
   limit 1;

  if v_existing_container_id is not null and exists (
    select 1 from public.container_fills
    where container_id = v_existing_container_id and kg_remaining > 0
  ) then
    return jsonb_build_object('error',
      format('Container %s is not available — it still has stock in it', p_container_number));
  end if;

  select b.truck_load_id into v_anchor_truck
    from public.batches b
   where b.bill_id = p_bill_id and b.truck_load_id is not null
   limit 1;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_count := v_item_count + 1;

    if not (v_item ? 'batch_id') or not (v_item ? 'kg') then
      return jsonb_build_object('error', format('Item %s missing batch_id or kg', v_item_count));
    end if;

    select b.id, b.sku_id, b.bill_id, b.kg, b.kg_remaining, b.truck_load_id
      into v_batch
      from public.batches b
     where b.id = (v_item->>'batch_id')::uuid;

    if not found then
      return jsonb_build_object('error', format('Batch %s not found', v_item->>'batch_id'));
    end if;

    if v_batch.bill_id is distinct from p_bill_id
       and not (v_anchor_truck is not null and v_batch.truck_load_id is not distinct from v_anchor_truck) then
      return jsonb_build_object('error', format(
        'Batch %s does not belong to bill %s — every item in a fill must trace to one purchase event or one truck load',
        v_batch.id, p_bill_id));
    end if;

    if (v_item->>'kg')::numeric <= 0 then
      return jsonb_build_object('error', format('Item %s: kg must be positive', v_item_count));
    end if;

    select coalesce(sum(cfi.kg), 0) into v_already_packed
      from public.container_fill_items cfi
      join public.container_fills cf on cf.id = cfi.container_fill_id
     where cfi.batch_id = v_batch.id
       and not cf.is_repack_copy;

    if (v_item->>'kg')::numeric > least(v_batch.kg_remaining, v_batch.kg - v_already_packed) then
      return jsonb_build_object('error', format(
        'Item %s: requested %s kg but batch %s only has %s kg available to pack (%s kg remaining overall, %s kg already packed into other containers)',
        v_item_count, round((v_item->>'kg')::numeric, 3), v_batch.id,
        round(least(v_batch.kg_remaining, v_batch.kg - v_already_packed), 3),
        round(v_batch.kg_remaining, 3), round(v_already_packed, 3)));
    end if;

    v_sku_ids := array_append(v_sku_ids, v_batch.sku_id);
    v_total_kg := v_total_kg + (v_item->>'kg')::numeric;
  end loop;

  if v_total_kg > p_capacity_kg then
    return jsonb_build_object('error', format(
      'Total kg (%s) exceeds container capacity (%s kg)', round(v_total_kg, 3), round(p_capacity_kg, 2)));
  end if;

  if v_existing_container_id is not null then
    v_container_id := v_existing_container_id;
  else
    v_container_id := gen_random_uuid();
    insert into public.containers (id, container_number, capacity_kg, ownership, created_at)
    values (v_container_id, p_container_number, p_capacity_kg, p_ownership, v_now);
  end if;

  v_expires_at := public.compute_container_fill_expiry(v_now, v_sku_ids);

  insert into public.container_fills (
    id, container_id, bill_id, location_id, filled_at, kg_remaining, expires_at, created_by
  ) values (
    v_fill_id, v_container_id, p_bill_id, p_location_id, v_now, v_total_kg, v_expires_at, v_user_id
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.container_fill_items (container_fill_id, batch_id, kg)
    values (v_fill_id, (v_item->>'batch_id')::uuid, (v_item->>'kg')::numeric);
  end loop;

  perform public.auto_complete_task('pack_repack', v_user_id);

  return jsonb_build_object(
    'container_id', v_container_id,
    'container_fill_id', v_fill_id,
    'expires_at', v_expires_at,
    'total_kg', v_total_kg
  );
end;
$$;

grant execute on function public.record_container_fill(uuid, uuid, text, numeric, jsonb, text) to authenticated;
