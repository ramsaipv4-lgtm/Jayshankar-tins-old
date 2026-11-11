-- 0008_record_repack.sql — repack (§4.3.9, D21, D-amendment §C.3)
-- SPEC.md §4.2.21 addendum (D-amendment §B.12a) + §4.3.9. See BUILDER-DECISIONS-REVIEW.md
-- decision #39 for the full writeup.
--
-- Schema gap this migration closes: §4.3.9 step 5 asks for one movements row referencing
-- BOTH the source and destination container_fill_id for a repack. Migration 0006 only added
-- one container_fill_id column (found while designing this function, not fixed on the spot —
-- see decision #38's addendum). movements.container_fill_id keeps its existing "drawn from"
-- meaning (the source fill); this migration adds destination_container_fill_id, populated only
-- for kind='repack'.
--
-- Why repack doesn't touch batches.kg_remaining: apply_movement_to_batches() (migration
-- 0001_init.sql) only decrements on kind IN ('transfer', 'sale', 'spoilage') — 'repack' was
-- correctly left out already (confirmed by reading the live trigger before writing this, not
-- assumed). Repack moves fish between containers, not out of the batch lineage — the same total
-- kg, same batches, just a new container_fills row. No trigger change needed here.
--
-- Second gap found live, via test-container-repack.mjs's own setup (not a hypothetical): repack
-- copies container_fill_items onto the destination fill (§4.3.9 step 3, correctly) — but
-- 0007's double-allocation guard in record_container_fill sums container_fill_items.kg across
-- ALL fills for a batch, unconditionally. After a repack, the same kg is counted twice: once on
-- the (now-empty, but still-recorded) source fill, once on the copy. container_fills.
-- is_repack_copy marks which fills are copies, not fresh draws from a batch, so that guard can
-- exclude them. That column is declared in 0007, NOT here, even though it's set here — a
-- fresh install runs migrations in filename order, and 0007's own guard depends on the column
-- existing, so it can't be defined in a later file. This migration just sets its value.
--
-- Idempotent, matching every prior migration's convention. Apply order: AFTER 0001–0007.

-- ============================================================
-- 1. movements.destination_container_fill_id (§4.2.21 addendum)
-- ============================================================

alter table public.movements
  add column if not exists destination_container_fill_id
    uuid references public.container_fills(id) on delete restrict;
create index if not exists movements_dest_container_fill_idx
  on public.movements (destination_container_fill_id) where destination_container_fill_id is not null;

-- ============================================================
-- 2. record_repack — §4.3.9
-- Returns: jsonb { destination_container_fill_id, kg_moved, expires_at, movement_group_id }
-- on success, jsonb { error } on any validation failure.
-- ============================================================

create or replace function public.record_repack(
  p_source_fill_id           uuid,
  p_destination_container_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role          text := public.current_user_role();
  v_user_id       uuid := auth.uid();
  v_source        record;
  v_dest_capacity numeric(5,2);
  v_dest_container_id uuid;
  v_dest_fill_id  uuid := gen_random_uuid();
  v_group_id      uuid := gen_random_uuid();
  v_now           timestamptz := now();
  v_item_count    int;
  v_item          record;
begin
  -- Role check (SECURITY DEFINER bypasses RLS). Repack is open to any real role — matches
  -- rls-policies.sql's movements INSERT policy for kind='repack' (admin, co-admin, vendor-rep,
  -- worker, super-worker). Not receiving (record_container_fill), which is narrower.
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker') then
    raise exception 'record_repack: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  -- Lock the source fill — must not race with a concurrent sale/spoilage/another repack
  -- draining the same fill.
  select id, container_id, bill_id, location_id, filled_at, kg_remaining, expires_at
    into v_source
    from public.container_fills
   where id = p_source_fill_id
   for update;

  if not found then
    return jsonb_build_object('error', 'Source container fill not found');
  end if;
  if v_source.kg_remaining <= 0 then
    return jsonb_build_object('error', 'Source fill is already empty — nothing to repack');
  end if;

  if p_destination_container_id = v_source.container_id then
    return jsonb_build_object('error', 'Destination cannot be the same container as the source');
  end if;

  select capacity_kg into v_dest_capacity
    from public.containers
   where id = p_destination_container_id and active;

  if v_dest_capacity is null then
    return jsonb_build_object('error', 'Destination container not found or not active');
  end if;

  -- Destination must be available — §4.2.11's derived-availability rule, same guard as
  -- record_container_fill (migration 0007).
  if exists (
    select 1 from public.container_fills
    where container_id = p_destination_container_id and kg_remaining > 0
  ) then
    return jsonb_build_object('error', 'Destination container is not available (still has stock)');
  end if;

  if v_source.kg_remaining > v_dest_capacity then
    return jsonb_build_object('error', format(
      'Source has %s kg remaining, destination capacity is only %s kg',
      round(v_source.kg_remaining, 3), round(v_dest_capacity, 2)));
  end if;

  select count(*) into v_item_count
    from public.container_fill_items
   where container_fill_id = p_source_fill_id;
  if v_item_count = 0 then
    -- Shouldn't happen (record_container_fill never creates a fill with zero items) — a
    -- defensive check, not an expected path, since a silent no-op movements-wise would leave
    -- the source zeroed with nothing to show for it.
    return jsonb_build_object('error', 'Source fill has no container_fill_items — data integrity issue, aborting');
  end if;

  -- The whole point of this function (§4.3.9 step 2 / C.3, same discipline as the §C.4 transfer
  -- fix): filled_at and expires_at are copied UNCHANGED. A repack must never make fish appear
  -- fresher than it is.
  insert into public.container_fills (
    id, container_id, bill_id, location_id, filled_at, kg_remaining, expires_at, created_by,
    is_repack_copy
  ) values (
    v_dest_fill_id, p_destination_container_id, v_source.bill_id, v_source.location_id,
    v_source.filled_at, v_source.kg_remaining, v_source.expires_at, v_user_id,
    true
  );

  -- Copy the fill_items breakdown unchanged (same batch_id/kg lineage) — §4.3.9 step 3.
  insert into public.container_fill_items (container_fill_id, batch_id, kg)
  select v_dest_fill_id, batch_id, kg
    from public.container_fill_items
   where container_fill_id = p_source_fill_id;

  -- Free the source container — §4.3.9 step 4.
  update public.container_fills
     set kg_remaining = 0
   where id = p_source_fill_id;

  -- One movements row PER source item (movements.sku_id/batch_id are NOT NULL — a fill can
  -- span multiple batches/SKUs, §4.2.13, so a single row can't represent the whole repack any
  -- more than a single sale/spoilage movements row can span multiple source batches). All rows
  -- share movement_group_id, container_fill_id (source, "drawn from") and
  -- destination_container_fill_id — together they ARE "the one repack event" §4.3.9 step 5
  -- describes, at the same per-batch grain every other cascade in this schema already uses.
  -- Same location on both sides — repack consolidates containers, it doesn't relocate stock.
  for v_item in
    select cfi.batch_id, cfi.kg, b.sku_id
      from public.container_fill_items cfi
      join public.batches b on b.id = cfi.batch_id
     where cfi.container_fill_id = p_source_fill_id
  loop
    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id,
      container_fill_id, destination_container_fill_id, movement_group_id, occurred_at, created_by
    ) values (
      'repack', v_source.location_id, v_source.location_id, v_item.sku_id, v_item.kg, v_item.batch_id,
      p_source_fill_id, v_dest_fill_id, v_group_id, v_now, v_user_id
    );
  end loop;

  return jsonb_build_object(
    'destination_container_fill_id', v_dest_fill_id,
    'kg_moved', v_source.kg_remaining,
    'expires_at', v_source.expires_at,
    'movement_group_id', v_group_id
  );
end;
$$;

grant execute on function public.record_repack(uuid, uuid) to authenticated;
