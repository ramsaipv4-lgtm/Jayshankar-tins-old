-- 0009_container_sourced_sale_spoilage.sql — §4.3.8 (D21, D-amendment §C.2)
-- SPEC.md: "container-tracked storage locks candidate container_fills ordered by expires_at ASC
-- (soonest-to-expire first)... in parallel, batches.kg_remaining is decremented via
-- container_fill_items for pricing/lineage." See BUILDER-DECISIONS-REVIEW.md decision #41 for
-- the full design writeup — this comment covers only what's load-bearing to read the SQL.
--
-- Two real design questions the spec's prose doesn't fully resolve, worked out here:
--
-- 1. A container_fill can hold MULTIPLE SKUs (§4.2.13 — "portions of several batches bought on
--    the same trip"). "How much of SKU S is left in fill F" is therefore not fill.kg_remaining
--    (that's the fill's TOTAL across all SKUs) — it's derived per (fill, batch) pairing:
--    container_fill_items.kg for that pairing, minus whatever's already been drawn from that
--    EXACT pairing by a past sale/spoilage (found via movements rows that share both
--    container_fill_id AND batch_id). container_fill_items stays immutable; this is a read-time
--    derivation, matching D17's "derived, not stored" convention already used for container
--    availability.
--
-- 2. Real stock right now sits almost entirely in un-contained `batches` rows — receiving
--    doesn't yet require every delivery to also create a container_fill, and no real fill has
--    ever existed outside test data. A container-only cascade would leave today's actual stock
--    unsellable. Two-phase cascade: container-tracked stock first (the actual point of this
--    feature — soonest-expiry-first), then the older direct-batch FIFO (delivered_at ASC) as a
--    fallback for whatever isn't packed yet. The fallback must not re-offer kg that's currently
--    sitting inside a container (packed but not yet drawn via the container phase) — a batch
--    that's PARTIALLY packed only offers its un-packed remainder directly. Uses the exact same
--    "sum container_fill_items, subtract already-drawn" shape as record_container_fill's
--    double-allocation guard (decision #38), applied here to gate the fallback instead of gate
--    packing.
--
-- Deliberate scope upgrade beyond W3's "single-batch fill + shortfall" (decision #18, both
-- record_transfer_cascade and the current client-side recordSale/recordSpoilage only ever draw
-- from ONE batch). §4.3.2/§4.3.4/§4.3.8 always described a real multi-row cascade; decision #18
-- explicitly deferred it to "Pilot," not rejected it. Building the container-sourced cascade is
-- the natural point to finally build it properly, for both phases consistently — a container
-- fill split across repacks, or a SKU spread across several batches, makes single-source-only
-- shortfalls needlessly common otherwise.
--
-- Known, deliberately NOT fixed here: record_container_fill's (migration 0007) validation reads
-- batches.kg_remaining and container_fill_items WITHOUT a FOR UPDATE lock, while this
-- migration's direct-batch fallback DOES lock batches. A plain SELECT never blocks on another
-- transaction's lock in Postgres, so two truly concurrent calls — one packing a batch, one
-- selling from it directly — have a narrow race window. Not fixed here: doing so means re-editing
-- and re-testing an already-shipped, already-tested file for a race that needs two operations on
-- the exact same batch within milliseconds, on a single-operator, sequential-physical-actions
-- business. Flagged in HANDOVER.md's gotchas, not silently ignored.
--
-- Two private helpers (no GRANT — never called directly by a client, only from the two public
-- RPCs below, which run as the function owner via SECURITY DEFINER and so already have implicit
-- execute rights on their own owner's functions) plus 2 public RPCs, each with its own role
-- check (SECURITY DEFINER bypasses RLS — the checks below are the only enforcement, same
-- discipline as every prior function this session).
--
-- Apply order: AFTER 0001–0008.

-- ============================================================
-- 1. container_sourced_cascade — phase A (private helper)
-- Draws p_kg of p_sku_id at p_location_id from container-tracked stock, soonest-expiry-first,
-- inserting one movements row per (fill, batch) pairing actually drawn from. Returns the total
-- kg actually drawn (<= p_kg; caller computes any remainder).
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
  -- Lock candidate fills at this location that still have ANY stock and contain this SKU
  -- (via their items), soonest-to-expire first — the "least shelf life first" rule (§2.5a).
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

    -- Within this fill, the batches contributing THIS SKU, oldest delivery first (no
    -- shelf-life reason to prefer one over another within the same fill — they share one
    -- expires_at — delivered_at is just a stable, sensible tiebreak).
    for item in
      select cfi.batch_id, cfi.kg as original_kg
        from public.container_fill_items cfi
        join public.batches b on b.id = cfi.batch_id
       where cfi.container_fill_id = fill.id and b.sku_id = p_sku_id
       order by b.delivered_at asc, cfi.id asc
    loop
      exit when v_remaining <= 0;

      -- Derived remaining for this EXACT (fill, batch) pairing: what was originally packed,
      -- minus whatever a past sale/spoilage already drew from this same pairing.
      -- container_fill_items itself is immutable (§4.2.13 / RLS design) — this is a read-time
      -- derivation, not a stored counter, matching D17.
      select item.original_kg - coalesce(sum(m.kg), 0)
        into v_item_remaining
        from public.movements m
       where m.container_fill_id = fill.id
         and m.batch_id = item.batch_id
         and m.kind in ('sale', 'spoilage');
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
        -- apply_movement_to_batches (0001) does NOT touch kg_remaining for a movements row
        -- with container_fill_id set differently than plain batch rows — re-checked: the
        -- trigger keys only on kind IN ('transfer','sale','spoilage'), unconditional on
        -- container_fill_id, so it DOES decrement batches.kg_remaining here too. That's
        -- exactly right — it's what makes §4.3.8's "in parallel, batches.kg_remaining is
        -- decremented... for pricing/lineage" true for free, no extra UPDATE needed here.

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
-- 2. direct_batch_cascade — phase B (private helper, fallback)
-- Draws whatever phase A didn't cover from un-contained (or partially-packed) batches,
-- delivered_at ASC, excluding whatever portion of each batch is currently sitting inside a
-- container (reachable only via phase A, not here).
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

    -- "Currently packed" = ever packed into a container, minus whatever's already been sold/
    -- spoiled out of a container for this batch. What's left is physically inside a sealed
    -- container right now — not directly sellable, only reachable via phase A. Same shape as
    -- record_container_fill's (0007) double-allocation guard, applied here in the other
    -- direction (gating the fallback, not gating a new pack).
    select coalesce(sum(cfi.kg), 0)
         - coalesce((
             select sum(m.kg) from public.movements m
              where m.batch_id = batch.id
                and m.container_fill_id is not null
                and m.kind in ('sale', 'spoilage')
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
      -- Trigger decrements batch.kg_remaining automatically (kind IN sale/spoilage).

      v_remaining := v_remaining - v_draw;
    end if;
  end loop;

  return p_kg - v_remaining;
end;
$$;

-- ============================================================
-- 3. record_container_sale — public RPC, §4.3.8 for sale
-- Returns jsonb { sale_id, movement_group_id, kg_sold, shortfall, container_sourced_kg,
-- direct_sourced_kg } on success (kg_sold > 0), jsonb { error, shortfall } if nothing was
-- available at all. Partial fulfillment is NOT an error — matches the existing
-- recordSale/record_transfer_cascade convention of reporting a shortfall rather than rejecting.
-- ============================================================

create or replace function public.record_container_sale(
  p_sku_id uuid,
  p_location_id uuid,
  p_customer_name text,
  p_total_kg numeric,
  p_sale_price_per_kg numeric,
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
  v_sale_id uuid := gen_random_uuid();
  v_container_drawn numeric(10,3);
  v_direct_drawn numeric(10,3) := 0;
  v_fulfilled numeric(10,3);
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
  if p_customer_name is null or btrim(p_customer_name) = '' then
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
    id, sku_id, location_id, customer_name, total_kg, sale_price_per_kg, total_amount,
    sold_by, sold_at, notes
  ) values (
    v_sale_id, p_sku_id, p_location_id, btrim(p_customer_name), v_fulfilled, p_sale_price_per_kg,
    round(v_fulfilled * p_sale_price_per_kg, 2), v_user_id, now(), p_notes
  );

  update public.movements
     set sale_id = v_sale_id
   where movement_group_id = v_group_id
     and sale_id is null;

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

-- ============================================================
-- 4. record_container_spoilage — public RPC, §4.3.8 for spoilage
-- Returns jsonb { movement_group_id, kg_spoiled, shortfall, container_sourced_kg,
-- direct_sourced_kg } on success, jsonb { error, shortfall } if nothing was available.
-- No sales row involved — the ordering problem above doesn't apply here.
-- ============================================================

create or replace function public.record_container_spoilage(
  p_sku_id uuid,
  p_location_id uuid,
  p_total_kg numeric,
  p_reason text,
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
  v_combined_notes text;
  v_container_drawn numeric(10,3);
  v_direct_drawn numeric(10,3) := 0;
  v_fulfilled numeric(10,3);
begin
  -- Role check — matches rls-policies.sql's movements INSERT policy for kind='spoilage'
  -- (admin, co-admin, vendor-rep, worker, super-worker — spoilage IS a worker task, unlike sale).
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker') then
    raise exception 'record_container_spoilage: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_total_kg <= 0 then
    return jsonb_build_object('error', 'kg must be positive');
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('error', 'Reason is required');
  end if;

  -- Matches the existing client-side recordSpoilage's notes convention exactly
  -- (src/lib/mutations.ts: "input.reason + (input.notes ? ' — ' + input.notes : '')").
  v_combined_notes := btrim(p_reason) || case when p_notes is not null and btrim(p_notes) != '' then ' — ' || p_notes else '' end;

  v_container_drawn := public.container_sourced_cascade(
    p_sku_id, p_location_id, p_total_kg, 'spoilage', null, v_group_id, v_combined_notes, v_user_id);

  if p_total_kg - v_container_drawn > 0 then
    v_direct_drawn := public.direct_batch_cascade(
      p_sku_id, p_location_id, p_total_kg - v_container_drawn, 'spoilage', null, v_group_id, v_combined_notes, v_user_id);
  end if;

  v_fulfilled := v_container_drawn + v_direct_drawn;

  if v_fulfilled = 0 then
    return jsonb_build_object('error', 'No stock at this location', 'shortfall', p_total_kg);
  end if;

  return jsonb_build_object(
    'movement_group_id', v_group_id,
    'kg_spoiled', v_fulfilled,
    'shortfall', p_total_kg - v_fulfilled,
    'container_sourced_kg', v_container_drawn,
    'direct_sourced_kg', v_direct_drawn
  );
end;
$$;

grant execute on function public.record_container_sale(uuid, uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.record_container_spoilage(uuid, uuid, numeric, text, text) to authenticated;
