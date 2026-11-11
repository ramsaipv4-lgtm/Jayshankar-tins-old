-- 0033_self_reverse_restriction_and_receiving_spoilage.sql — Jayshankar V1 sprint
-- Four small, independent fixes from the same round of user feedback:
--
-- 1. can_self_reverse is now admin/co-admin ONLY, enforced at the schema level, not just a
--    convention. Found one real existing violation before adding the constraint (not assumed
--    clean): Anitha (vendor-rep) had it set true from earlier demo seeding — reset first, or
--    the new CHECK would have failed outright on existing data. A BEFORE trigger auto-clears the
--    flag on any INSERT/UPDATE that would leave it true on a non-admin/co-admin row (auto-heal,
--    matching migration 0030's own precedent, rather than erroring the whole role-change out);
--    the CHECK constraint is a hard backstop behind it, same defense-in-depth shape as RLS+RPC
--    role checks elsewhere in this project.
--
-- 2. notify_user() — a single-recipient sibling to notify_admins() (migration 0018), same
--    SECURITY DEFINER/append-only shape. Wired into a new trigger on `tasks`: whoever a task is
--    assigned to gets told the moment it completes, regardless of which of the two completion
--    paths did it (auto_complete_task's RPC-driven UPDATE, or MyTasks.tsx's own plain UPDATE for
--    custom tasks) — a trigger on the table catches both without duplicating the notify call in
--    two different places that could drift.
--
-- 3. containers.ownership — the user liked this over the QR-sticker "conceptual container"
--    rethink they'd floated: a box that's genuinely fungible (vendor-provided, or handed to a
--    buyer and never coming back) is just marked as such, without changing what a container's
--    identity means. Wired into record_container_fill's existing inline container-creation path
--    (still the only place a container is ever created — no bulk-registration UI exists yet,
--    unchanged by this migration).
--
-- 4. confirm_delivery_arrival (migration 0032) is superseded here, not edited in place (this
--    project's append-only migration convention — matches how 0028 fixed 0027 before 0027 had
--    ever been applied anywhere either). Splits the single "confirmed_kg" into confirmed-GOOD
--    and confirmed-SPOILED — the user asked directly whether delivery-time spoilage should be
--    checked here at all: yes, and it's kept structurally distinct from ordinary in-warehouse
--    spoilage (record_container_spoilage) for a real reason — spoilage found the moment fish
--    arrives is far more likely the vendor's fault (bad stock, poor handling before pickup) than
--    spoilage found later in storage. No new tag column needed for that distinction:
--    `receiving_confirmations.spoiled_kg` (added here) IS unambiguously "found at receiving" by
--    definition — any other 'spoilage' movement, with no receiving_confirmations row behind it,
--    is unambiguously "found in the warehouse." The actual WEIGHTING of these two in a vendor
--    quality score is deliberately not decided here — that rating system doesn't exist yet
--    (still on the same deferred list as employee performance rating, per D47's own note: it
--    needs real data and the wholesaler's own numbers to mean anything) — this migration only
--    makes sure the data it will need is captured with the right granularity from day one.
--
-- IDEMPOTENT throughout. Run after 0001-0032.

-- ============================================================
-- 1. can_self_reverse restricted to admin/co-admin
-- ============================================================

update public.users
   set can_self_reverse = false
 where can_self_reverse and role not in ('admin', 'co-admin');

create or replace function public.clamp_can_self_reverse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.can_self_reverse and new.role not in ('admin', 'co-admin') then
    new.can_self_reverse := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clamp_can_self_reverse on public.users;
create trigger trg_clamp_can_self_reverse
  before insert or update on public.users
  for each row
  execute function public.clamp_can_self_reverse();

alter table public.users
  drop constraint if exists users_can_self_reverse_admin_only;
alter table public.users
  add constraint users_can_self_reverse_admin_only
  check (not can_self_reverse or role in ('admin', 'co-admin'));

-- ============================================================
-- 2. notify_user() + a trigger that fires it when a task completes, whoever completed it
-- ============================================================

create or replace function public.notify_user(p_user_id uuid, p_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.users where id = p_user_id;
  if v_role is null then
    return;
  end if;
  insert into public.notifications (user_id, type, payload, role_at_creation)
  values (p_user_id, p_type, p_payload, v_role);
end;
$$;

create or replace function public.notify_task_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.notify_user(new.assigned_to, 'task_completed', jsonb_build_object(
      'task_id', new.id, 'type', new.type, 'title', new.title
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_completion on public.tasks;
create trigger trg_notify_task_completion
  after update of status on public.tasks
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.notify_task_completion();

-- ============================================================
-- 3. containers.ownership
-- ============================================================

alter table public.containers
  add column if not exists ownership text not null default 'owned'
  check (ownership in ('owned', 'vendor_provided', 'given_to_buyer'));

-- record_container_fill has been LIVE since migration 0024 at its 5-parameter signature —
-- adding p_ownership via a plain CREATE OR REPLACE would create a second overload (the exact
-- PGRST203 bug class from decisions #73/#77 this sprint already hit twice). Explicit DROP first.
drop function if exists public.record_container_fill(uuid, uuid, text, numeric, jsonb);

create or replace function public.record_container_fill(
  p_bill_id          uuid,
  p_location_id      uuid,
  p_container_number text,
  p_capacity_kg      numeric,
  p_items            jsonb,
  p_ownership        text default 'owned'
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

-- ============================================================
-- 4. confirm_delivery_arrival — split into confirmed-good vs confirmed-spoiled kg
-- ============================================================

drop function if exists public.confirm_delivery_arrival(uuid, uuid, numeric, uuid, text, text);

alter table public.receiving_confirmations
  add column if not exists spoiled_kg numeric(10,3) not null default 0;

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

  -- Physical truth adjusts to the FULL measured amount first (good + spoiled really arrived);
  -- the spoilage movement below then draws the spoiled share back out via the same trigger
  -- every other spoilage event already uses (apply_movement_to_batches, migration 0001) —
  -- kg_remaining lands at exactly p_confirmed_good_kg without this function computing it twice.
  update public.batches
     set location_id = p_destination_location_id,
         sku_id = v_final_sku_id,
         kg = v_total_measured,
         kg_remaining = v_total_measured
   where id = p_batch_id;

  insert into public.movements (
    kind, from_location_id, to_location_id, sku_id, kg, batch_id, occurred_at, created_by
  ) values (
    'receiving_confirmed', v_batch.location_id, p_destination_location_id, v_final_sku_id,
    v_total_measured, p_batch_id, now(), v_user_id
  );

  if p_confirmed_spoiled_kg > 0 then
    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, notes, occurred_at, created_by
    ) values (
      'spoilage', p_destination_location_id, null, v_final_sku_id, p_confirmed_spoiled_kg,
      p_batch_id, coalesce(p_notes, 'Found spoiled/damaged at receiving confirmation'), now(), v_user_id
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
    'promised_kg', v_batch.kg
  );
end;
$$;

grant execute on function public.confirm_delivery_arrival(uuid, uuid, numeric, numeric, uuid, text, text) to authenticated;
