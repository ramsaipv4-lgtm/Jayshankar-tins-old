-- 0005_record_transfer_cascade.sql — Jayshankar v1 schema patch
-- Adds a SECURITY DEFINER Postgres function for transfers. Two reasons:
--
-- 1. RLS: the batches_insert_rep policy allows only admin/vendor-rep/super-worker
--    to insert batches. A plain 'worker' is denied — so a worker trying to
--    record a transfer (which inserts a destination batch) hits RLS 42501
--    ("new row violates row-level security policy for table 'batches'"). The
--    SECURITY DEFINER function runs as the function owner (postgres), bypassing
--    RLS, so any authenticated caller can record a transfer.
--
-- 2. Race condition: a transfer needs to read the FIFO source batch and update
--    its kg_remaining in a single transaction. Without FOR UPDATE, two
--    concurrent transfers of the same (sku, from_location) could both read the
--    same source and the trigger's kg_remaining = kg_remaining - new.kg would
--    race. Doing it in a SQL function with FOR UPDATE serialises the FIFO
--    read against other concurrent operations. (This was always the Pilot-mode
--    fix per decision 19; W3 just made it W3-mode by surfacing the RLS bug.)
--
-- The function:
--   - reads the oldest source batch with FOR UPDATE
--   - creates a new destination batch (carries over vendor_id and price_per_kg_paid)
--   - inserts a transfer movement (the apply_movement_to_batches trigger
--     decrements source.kg_remaining)
--   - returns a jsonb payload with the destination batch id, movement group id,
--     and any shortfall kg
--
-- Returns: jsonb { destination_batch_id, movement_group_id, shortfall, error? }
-- Error codes: 'No stock at source location' if no batch has kg_remaining > 0
--             at the source location for this SKU.
--
-- Called from src/lib/mutations.ts: supabase.rpc('record_transfer_cascade', {...})

create or replace function public.record_transfer_cascade(
  p_sku_id          uuid,
  p_from_location_id uuid,
  p_to_location_id   uuid,
  p_kg               numeric,
  p_notes            text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source record;
  v_deduct numeric(10,3);
  v_shortfall numeric(10,3);
  v_dest_batch_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  -- 1. Find the oldest source batch with stock, with FOR UPDATE to serialise
  --    concurrent transfers of the same (sku, from_location) pair.
  select id, kg_remaining, vendor_id, price_per_kg_paid
    into v_source
    from public.batches
   where sku_id = p_sku_id
     and location_id = p_from_location_id
     and kg_remaining > 0
   order by delivered_at asc, id asc
   limit 1
   for update;

  if not found then
    return jsonb_build_object(
      'error', 'No stock at source location',
      'shortfall', p_kg
    );
  end if;

  v_deduct := least(p_kg, v_source.kg_remaining);
  v_shortfall := p_kg - v_deduct;

  -- 2. Insert the destination batch (carries over vendor + price from source)
  insert into public.batches (
    id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at
  ) values (
    v_dest_batch_id, p_sku_id, v_source.vendor_id, p_to_location_id,
    v_deduct, v_deduct, v_source.price_per_kg_paid, v_now
  );

  -- 3. Insert the transfer movement. The apply_movement_to_batches trigger
  --    (migration 0001) decrements source.kg_remaining atomically.
  insert into public.movements (
    kind, from_location_id, to_location_id, sku_id, kg, batch_id,
    movement_group_id, notes, occurred_at, created_by
  ) values (
    'transfer', p_from_location_id, p_to_location_id, p_sku_id, v_deduct,
    v_source.id, v_group_id, p_notes, v_now, v_user_id
  );

  return jsonb_build_object(
    'destination_batch_id', v_dest_batch_id,
    'movement_group_id', v_group_id,
    'shortfall', v_shortfall
  );
end;
$$;

-- Grant EXECUTE to authenticated (workers, vendor-reps, admins all need this).
-- The function itself is SECURITY DEFINER, so the GRANT just controls who can
-- call it — RLS still applies to the underlying tables for direct queries.
grant execute on function public.record_transfer_cascade(uuid, uuid, uuid, numeric, text) to authenticated;
