-- 0021_container_fill_defer_registration.sql — Jayshankar V1 sprint
-- Fixes a real bug found live, the first time record_container_fill (migration 0007) was ever
-- actually called against the live database: a brand-new container gets registered
-- (INSERT INTO containers) BEFORE the pack items are validated. A pack attempt that fails
-- validation (e.g. requesting more kg than a batch has available to pack — exercised on
-- purpose, to prove the double-allocation guard works) still leaves behind a real, empty,
-- "available" container row — one that would then show up in AvailableContainerSelect
-- (src/components/FormFields.tsx) as a legitimate repack destination, even though it doesn't
-- correspond to any physical container the business actually owns. Found and fixed the same
-- session as the live-test that exposed it, before the phantom row could accumulate through
-- real use (a rep mistyping a batch or overshooting available kg would trigger this on every
-- retry). See BUILDER-DECISIONS-REVIEW.md decision #66.
--
-- The fix: look up an existing container by number early (read-only — needed for the
-- availability guard, which only means anything for a container that already exists), but defer
-- the actual INSERT of a brand-new container row until every validation step has already
-- passed, immediately before the container_fills insert that will actually use it. A rejected
-- call now creates nothing at all, matching every other RPC in this project's own "validate
-- fully, then write" discipline (record_bill_delivery, record_container_sale, etc.).
--
-- No other logic changes — same role check, same availability guard, same double-allocation
-- guard, same capacity check, byte-identical return shape.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0020.

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
begin
  -- Role check (matches rls-policies.sql's bills/containers/container_fills INSERT
  -- policies — admin, co-admin, vendor-rep, super-worker. Receiving is not a worker task,
  -- unlike repack, which will be — see the follow-up migration this comment references).
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_container_fill: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_capacity_kg not in (5, 10, 15, 20, 25) then
    return jsonb_build_object('error',
      format('Invalid container capacity %s kg — must be 5, 10, 15, 20, or 25', round(p_capacity_kg, 2)));
  end if;

  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'p_items must be a non-empty JSON array');
  end if;

  -- Look up (read-only) an existing ACTIVE container by number — do NOT register a new one
  -- yet. Registration is deferred to just before the container_fills insert, once every
  -- validation step below has already passed (this decision's own fix — see this file's
  -- header comment for why).
  select id into v_existing_container_id
    from public.containers
   where container_number = p_container_number
     and active
   limit 1;

  -- Guard: an EXISTING container must actually be available — SPEC.md §4.2.11's derived-
  -- availability rule ("a container is available if no container_fills row on it has
  -- kg_remaining > 0"). Meaningless for a number that doesn't exist yet (v_existing_container_id
  -- is null), which is correctly skipped — there's nothing to check yet.
  if v_existing_container_id is not null and exists (
    select 1 from public.container_fills
    where container_id = v_existing_container_id and kg_remaining > 0
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

  -- Every validation step above has passed — only now is it safe to actually register a new
  -- container, if this number didn't already exist. Nothing gets written at all if any check
  -- above returned an error.
  if v_existing_container_id is not null then
    v_container_id := v_existing_container_id;
  else
    v_container_id := gen_random_uuid();
    insert into public.containers (id, container_number, capacity_kg, created_at)
    values (v_container_id, p_container_number, p_capacity_kg, v_now);
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

grant execute on function public.record_container_fill(uuid, uuid, text, numeric, jsonb) to authenticated;
