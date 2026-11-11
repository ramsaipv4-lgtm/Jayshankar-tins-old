-- 0010_transfer_timestamp_fix.sql — §4.3.10, the C.4 timestamp bug (D-amendment §C.4, amends
-- §4.3.3, repurposed cross-warehouse-only by D29). See BUILDER-DECISIONS-REVIEW.md decision #43
-- for the full design writeup — this comment covers only what's load-bearing to read the SQL.
--
-- The bug, exactly as SPEC.md states it: the pre-Mode-B transfer algorithm set the destination
-- batch's delivered_at = now() (the transfer time), silently resetting a fish's apparent
-- freshness on every transfer. The fix: carry the ORIGINAL freshness timestamp through instead —
-- container_fills.filled_at when the source was container-tracked, or the source batch's own
-- delivered_at otherwise (the spec's prose scopes its example to the container case; the same
-- "never reset apparent freshness" principle applies identically to un-contained stock, and both
-- cases are handled by the same function, so leaving one half fixed and the other broken would
-- be an arbitrary, undocumented half-fix of the exact bug class this migration exists to close).
--
-- Also fixes two things found while building this, not invented afterward:
--
-- 1. record_transfer_cascade (migration 0005) has NEVER had an internal role check. That was
--    genuinely safe under Mode A, where transfer was open to every role — SECURITY DEFINER
--    bypasses RLS, so the table policy never protected this function either way, but it didn't
--    matter while the intended caller set was "everyone." D29 restricted transfer to admin/
--    co-admin only, which made the missing check a real gap — flagged explicitly in decision
--    #38 as a known follow-up for "any transfer-fix RPC," closed here.
--
-- 2. Making transfer able to draw from container_fill_items (the only way to fix the timestamp
--    bug at all — there's no filled_at to carry through if transfer never looks at containers)
--    means transfer becomes a THIRD consumer of container-tracked stock, alongside
--    record_container_sale/record_container_spoilage. Their "how much of this (fill,batch)
--    pairing has already been drawn" and "how much of this batch is currently sitting in a
--    container" computations (migration 0009) only checked kind IN ('sale','spoilage') —
--    without adding 'transfer' to both filters, a transfer could draw kg that a sale/spoilage
--    cascade would then also consider available, a fresh double-allocation gap introduced by
--    this migration rather than by 0009. Fixed here via CREATE OR REPLACE on both helpers.
--
-- Deliberate scope decision, NOT an oversight: transfer stays single-source-draw (one fill or
-- one batch per call), unlike sale/spoilage's decision #41 upgrade to a full multi-batch
-- cascade. SPEC.md §4.3.3's original text does describe a multi-batch cascade with weighted-
-- average pricing across sources — a real, larger scope than this fix needs to take on right
-- now, given: transfer is still dormant (D29 — no second warehouse exists in real use), and
-- HANDOVER.md already flags the vendor-attribution rule as "one of three plausible choices...
-- easy to amend in Mode B," i.e. provisional, not a hardened design worth building heavy
-- machinery around today. The container-aware SOURCE SELECTION below (preferring soonest-
-- expiring container-tracked stock over an arbitrary older un-contained batch) is what actually
-- matters for the fix to have any effect; a multi-batch cascade on top of it is a separate,
-- later decision if transfer ever sees real use.
--
-- Apply order: AFTER 0001–0009.

-- ============================================================
-- 1. container_sourced_cascade (0009) — add 'transfer' to the "already drawn from this
-- (fill, batch) pairing" filter.
-- ============================================================

create or replace function public.container_sourced_cascade(
  p_sku_id uuid,
  p_location_id uuid,
  p_kg numeric,
  p_kind text,
  p_sale_id uuid,
  p_movement_group_id uuid,
  p_notes text,
  p_user_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining numeric(10,3) := p_kg;
  v_now timestamptz := now();
  fill record;
  item record;
  v_item_remaining numeric(10,3);
  v_draw numeric(10,3);
begin
  for fill in
    select cf.id, cf.expires_at
      from public.container_fills cf
     where cf.location_id = p_location_id
       and cf.kg_remaining > 0
       and exists (
         select 1 from public.container_fill_items cfi
         join public.batches b on b.id = cfi.batch_id
        where cfi.container_fill_id = cf.id and b.sku_id = p_sku_id
       )
     order by cf.expires_at asc
     for update of cf
  loop
    exit when v_remaining <= 0;

    for item in
      select cfi.batch_id, cfi.kg as original_kg
        from public.container_fill_items cfi
        join public.batches b on b.id = cfi.batch_id
       where cfi.container_fill_id = fill.id and b.sku_id = p_sku_id
       order by b.delivered_at asc, cfi.id asc
    loop
      exit when v_remaining <= 0;

      select item.original_kg - coalesce(sum(m.kg), 0)
        into v_item_remaining
        from public.movements m
       where m.container_fill_id = fill.id
         and m.batch_id = item.batch_id
         -- 'transfer' added (migration 0010) -- transfer can now also draw from this exact
         -- (fill, batch) pairing; without counting it here, this cascade would over-offer kg
         -- a transfer has already moved out.
         and m.kind in ('sale', 'spoilage', 'transfer');
      v_item_remaining := coalesce(v_item_remaining, 0);

      if v_item_remaining > 0 then
        v_draw := least(v_item_remaining, v_remaining);

        insert into public.movements (
          kind, from_location_id, to_location_id, sku_id, kg, batch_id,
          container_fill_id, movement_group_id, sale_id, notes, occurred_at, created_by
        ) values (
          p_kind, p_location_id, null, p_sku_id, v_draw, item.batch_id,
          fill.id, p_movement_group_id, p_sale_id, p_notes, v_now, p_user_id
        );

        update public.container_fills
           set kg_remaining = kg_remaining - v_draw
         where id = fill.id;

        v_remaining := v_remaining - v_draw;
      end if;
    end loop;
  end loop;

  return p_kg - v_remaining;
end;
$$;

-- ============================================================
-- 2. direct_batch_cascade (0009) — add 'transfer' to the "currently packed" filter.
-- ============================================================

create or replace function public.direct_batch_cascade(
  p_sku_id uuid,
  p_location_id uuid,
  p_kg numeric,
  p_kind text,
  p_sale_id uuid,
  p_movement_group_id uuid,
  p_notes text,
  p_user_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining numeric(10,3) := p_kg;
  v_now timestamptz := now();
  batch record;
  v_packed numeric(10,3);
  v_available numeric(10,3);
  v_draw numeric(10,3);
begin
  for batch in
    select id, kg_remaining
      from public.batches
     where sku_id = p_sku_id
       and location_id = p_location_id
       and kg_remaining > 0
     order by delivered_at asc, id asc
     for update
  loop
    exit when v_remaining <= 0;

    select coalesce(sum(cfi.kg), 0)
         - coalesce((
             select sum(m.kg) from public.movements m
              where m.batch_id = batch.id and m.container_fill_id is not null
                -- 'transfer' added (migration 0010), same reasoning as above.
                and m.kind in ('sale', 'spoilage', 'transfer')
           ), 0)
      into v_packed
      from public.container_fill_items cfi
     where cfi.batch_id = batch.id;
    v_packed := greatest(coalesce(v_packed, 0), 0);

    v_available := batch.kg_remaining - v_packed;
    if v_available > 0 then
      v_draw := least(v_available, v_remaining);

      insert into public.movements (
        kind, from_location_id, to_location_id, sku_id, kg, batch_id,
        movement_group_id, sale_id, notes, occurred_at, created_by
      ) values (
        p_kind, p_location_id, null, p_sku_id, v_draw, batch.id,
        p_movement_group_id, p_sale_id, p_notes, v_now, p_user_id
      );

      v_remaining := v_remaining - v_draw;
    end if;
  end loop;

  return p_kg - v_remaining;
end;
$$;

-- ============================================================
-- 3. record_transfer_cascade — the actual C.4 fix (§4.3.10)
-- Single-source-draw (one container fill OR one un-contained batch per call — see the scope
-- note above). Prefers container-tracked stock, soonest-to-expire, over un-contained stock;
-- falls back to the oldest un-contained batch (excluding whatever's currently packed elsewhere)
-- if no container-tracked stock exists for this SKU at this location.
-- Returns jsonb { destination_batch_id, movement_group_id, shortfall, timestamp_source } on
-- success ('timestamp_source' is 'container_fill' or 'batch', for testability/debugging), jsonb
-- { error, shortfall } if nothing was available.
-- ============================================================

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
begin
  -- Role check (migration 0010 addendum — see file header). Matches rls-policies.sql's
  -- movements INSERT policy for kind='transfer': admin, co-admin only (D29).
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

  -- Prefer container-tracked stock, soonest-to-expire first (D21/§2.5a) — the whole point of
  -- this fix only matters if the source selection actually prioritizes this over an arbitrary
  -- older un-contained batch. Unlocked scan first (can't combine FOR UPDATE with a computed-
  -- column filter in one query); each candidate gets locked and re-checked below before use.
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
    -- Lock this fill, then re-derive its per-(fill,batch) remaining under that lock — protects
    -- against a concurrent draw between the unlocked scan above and here.
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
    -- else: exhausted since the unlocked scan (e.g. a concurrent draw) -- try the next candidate.
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
    -- Fall back to the oldest un-contained batch, excluding whatever's currently packed
    -- elsewhere (same exclusion direct_batch_cascade uses, same reasoning: that portion is
    -- only reachable via the container path, not here).
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

  -- The actual fix: v_dest_timestamp is either the source container_fill's filled_at or the
  -- source batch's own delivered_at -- never now().
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
