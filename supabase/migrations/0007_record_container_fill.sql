-- 0007_record_container_fill.sql — container fill creation at receiving
-- SPEC.md v2 §4.3.7 (D21, D-amendment §C.1). The prerequisite for everything else in the
-- container model: repack, container-sourced sale/spoilage FIFO, and the transfer timestamp
-- fix (§4.3.9-§4.3.10) all need real container_fills rows to operate on, and none exist yet
-- (migration 0006's tables are all still empty — confirmed via scripts/probe-db.mjs).
--
-- Scope note (logged in BUILDER-DECISIONS-REVIEW.md decision #38): this migration is
-- deliberately narrower than "the whole container algorithm suite." Repack and the transfer
-- fix are NOT in this migration — while designing repack's movements-row shape (SPEC.md
-- §4.3.9 step 5 asks for a single movements row "referencing both the source and destination
-- container_fill_id"), found that migration 0006 only added one container_fill_id column to
-- movements, not two — a real gap, not something to improvise past in the same breath as this
-- migration. Flagged clearly as a follow-up, not fixed here.
--
-- Two SECURITY DEFINER functions (matching the record_transfer_cascade precedent, migration
-- 0005), each with an EXPLICIT internal role check — SECURITY DEFINER bypasses RLS entirely,
-- so the table-level policies in rls-policies.sql do NOT protect a caller of these functions;
-- the function body is the only enforcement.
--
-- Called from application code via: supabase.rpc('record_container_fill', {...})
--
-- container_fills.is_repack_copy (below) is added HERE, not in migration 0008 where
-- record_repack sets it, even though it reads as a "repack" concern — a fresh database runs
-- migrations in filename order (0001→0008), so a column this file's own guard clause depends
-- on must be defined in this file or earlier, not a later one. Found live: an earlier version
-- of this migration defined it in 0008 instead; a from-scratch install would have broken at
-- 0007 with "column does not exist" the moment the guard below ran. 0008 still sets the
-- column's value on insert; it doesn't need to declare it again.

-- ============================================================
-- 0. container_fills.is_repack_copy — distinguishes a repack's destination fill (a relocation
-- of already-packed kg, set true by record_repack in migration 0008) from an original fill
-- created by record_container_fill below (a fresh draw from a batch, stays false). The
-- double-allocation guard in record_container_fill (§2) needs this to not double-count kg that
-- has moved through a repack.
-- ============================================================

alter table public.container_fills
  add column if not exists is_repack_copy boolean not null default false;

-- ============================================================
-- 1. compute_container_fill_expiry — pure helper, no side effects, not SECURITY DEFINER
-- (reads skus, which every authenticated role can already SELECT — no RLS bypass needed).
-- SPEC.md §4.2.12: "filled_at + min(shelf_life_hours) across the SKUs in
-- container_fill_items for this fill. Computed at fill-creation time (not a generated
-- column, since the underlying SKU shelf-life could change later without retroactively
-- altering an already-packed fill's clock)."
-- ============================================================

create or replace function public.compute_container_fill_expiry(
  p_filled_at timestamptz,
  p_sku_ids   uuid[]
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select p_filled_at + (min(shelf_life_hours) * interval '1 hour')
  from public.skus
  where id = any(p_sku_ids);
$$;

-- ============================================================
-- 2. record_container_fill — the receiving-side operation (§4.3.7 / C.1)
-- p_items shape: jsonb array of { "batch_id": "<uuid>", "kg": <numeric> }
-- Returns: jsonb { container_id, container_fill_id, expires_at, total_kg } on success,
--          jsonb { error } on any validation failure (never raises for expected
--          business-rule violations — only for the role check, which is a real
--          permission boundary, not a recoverable input error).
-- ============================================================

create or replace function public.record_container_fill(
  p_bill_id          uuid,
  p_location_id      uuid,
  p_container_number text,
  p_capacity_kg      numeric,
  p_items            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         text := public.current_user_role();
  v_user_id      uuid := auth.uid();
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
begin
  -- Role check (matches rls-policies.sql's bills/containers/container_fills INSERT
  -- policies — admin, co-admin, vendor-rep, super-worker. Receiving is not a worker task,
  -- unlike repack, which will be — see the follow-up migration this comment references).
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_container_fill: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_capacity_kg not in (5, 10, 15, 20, 25) then
    -- Postgres format() only supports %s/%I/%L/%% — no printf-style %.2f precision
    -- specifiers (found live: this raised "unrecognized format() type specifier" on
    -- first test run). round() the numeric first, let %s cast it to text.
    return jsonb_build_object('error',
      format('Invalid container capacity %s kg — must be 5, 10, 15, 20, or 25', round(p_capacity_kg, 2)));
  end if;

  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'p_items must be a non-empty JSON array');
  end if;

  -- Find an existing ACTIVE container by number, or register a new one.
  select id into v_container_id
    from public.containers
   where container_number = p_container_number
     and active
   limit 1;

  if v_container_id is null then
    v_container_id := gen_random_uuid();
    insert into public.containers (id, container_number, capacity_kg, created_at)
    values (v_container_id, p_container_number, p_capacity_kg, v_now);
  end if;

  -- Guard: the container must actually be available — SPEC.md §4.2.11's derived-availability
  -- rule ("a container is available if no container_fills row on it has kg_remaining > 0").
  -- Re-using a still-loaded container would corrupt the shelf-life/FIFO model silently.
  if exists (
    select 1 from public.container_fills
    where container_id = v_container_id and kg_remaining > 0
  ) then
    return jsonb_build_object('error',
      format('Container %s is not available — it still has stock in it', p_container_number));
  end if;

  -- Validate every item: the batch must exist and must trace to THIS bill — SPEC.md §4.2.12's
  -- "enforces the one-purchase-event-per-fill rule," checked here since it can't be a simple
  -- FK/CHECK constraint (it's a cross-row consistency rule, not a single-column one).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_count := v_item_count + 1;

    if not (v_item ? 'batch_id') or not (v_item ? 'kg') then
      return jsonb_build_object('error', format('Item %s missing batch_id or kg', v_item_count));
    end if;

    select b.id, b.sku_id, b.bill_id, b.kg, b.kg_remaining
      into v_batch
      from public.batches b
     where b.id = (v_item->>'batch_id')::uuid;

    if not found then
      return jsonb_build_object('error', format('Batch %s not found', v_item->>'batch_id'));
    end if;

    if v_batch.bill_id is distinct from p_bill_id then
      return jsonb_build_object('error', format(
        'Batch %s does not belong to bill %s — every item in a fill must trace to one purchase event',
        v_batch.id, p_bill_id));
    end if;

    if (v_item->>'kg')::numeric <= 0 then
      return jsonb_build_object('error', format('Item %s: kg must be positive', v_item_count));
    end if;

    -- Double-allocation guard: packing a batch into a container does NOT decrement
    -- batches.kg_remaining (packing isn't consumption — §4.3.8 decrements it later, when fish
    -- actually leaves via a container-sourced sale/spoilage). That means kg_remaining alone
    -- can't stop the SAME physical fish being packed into two different containers across two
    -- separate calls — each would validate independently against the same static number.
    -- container_fill_items is immutable and additive, so summing it gives exactly how much of
    -- this batch has already been committed to a container. v_batch.kg (the original,
    -- immutable purchased amount) minus that sum is what's still un-packed; kg_remaining
    -- separately still bounds what's truly left when the older direct-batch-sale pathway
    -- (§4.3.4) has already reduced it. Take the tighter of the two.
    --
    -- Excludes fills where container_fills.is_repack_copy is true (migration 0008): a repack
    -- COPIES a source fill's container_fill_items onto its destination (§4.3.9 step 3) — that's
    -- the same physical kg relocated, not a fresh draw from the batch. Counting both the
    -- (now-empty) source's items and the copy would double-count every repacked kg, found live
    -- via test-container-repack.mjs's own setup before this guard had ever run against real
    -- repack data.
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

  return jsonb_build_object(
    'container_id', v_container_id,
    'container_fill_id', v_fill_id,
    'expires_at', v_expires_at,
    'total_kg', v_total_kg
  );
end;
$$;

grant execute on function public.compute_container_fill_expiry(timestamptz, uuid[]) to authenticated;
grant execute on function public.record_container_fill(uuid, uuid, text, numeric, jsonb) to authenticated;
