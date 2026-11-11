-- 0024_check_ins_and_tasks.sql — Jayshankar V1 sprint, employee tracking phase 1
-- Check-ins (no manual button, ever) and task delegation, per a real design conversation with
-- the user (not guessed) — see BUILDER-DECISIONS-REVIEW.md decision #70 for the full record.
-- Performance rating and wage-tier suggestions are a deliberate follow-up piece, NOT in this
-- migration — they read from what this migration writes (task completion times, kg handled),
-- so they have to come after real task data exists to be meaningful, not before.
--
-- IDEMPOTENT throughout. Run after 0001-0023.

-- ============================================================
-- 1. check_ins — no manual "check in" button anywhere in this app, ever. The first time an
-- employee's app loads their task view on a given calendar day, ensure_checked_in() below
-- writes one row. work_date is computed SERVER-SIDE in India Standard Time, not trusted from
-- the client (a phone's clock/timezone can't be trusted for something this) -- Postgres
-- defaults to UTC, and this is a Tamil Nadu business, so a day boundary computed naively in UTC
-- would split a workday at 5:30am IST, not midnight.
-- ============================================================

create table if not exists public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  work_date      date not null,
  checked_in_at  timestamptz not null default now(),
  unique (user_id, work_date)
);
create index if not exists check_ins_user_date_idx on public.check_ins (user_id, work_date desc);

alter table public.check_ins enable row level security;

drop policy if exists check_ins_select_own_or_admin on public.check_ins;
create policy check_ins_select_own_or_admin
  on public.check_ins
  for select
  to authenticated
  using (
    user_id = auth.uid() or public.current_user_role() in ('admin', 'co-admin')
  );

-- No INSERT/UPDATE/DELETE policy for any role — ensure_checked_in() (SECURITY DEFINER) is the
-- only writer, same trigger-only-write shape as audit_log/notifications. A plain client INSERT
-- would let a user backdate their own work_date or check in on someone else's behalf; routing
-- through the RPC means the server, not the client, decides what "today" is and who "you" are.

create or replace function public.ensure_checked_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_work_date date := (now() at time zone 'Asia/Kolkata')::date;
  v_checked_in_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'ensure_checked_in: not signed in' using errcode = '42501';
  end if;

  insert into public.check_ins (user_id, work_date)
  values (v_user_id, v_work_date)
  on conflict (user_id, work_date) do nothing;

  select checked_in_at into v_checked_in_at
    from public.check_ins where user_id = v_user_id and work_date = v_work_date;

  return jsonb_build_object('work_date', v_work_date, 'checked_in_at', v_checked_in_at);
end;
$$;

grant execute on function public.ensure_checked_in() to authenticated;

-- ============================================================
-- 2. tasks — delegated work, either picked by the admin (a large-icon employee grid, the
-- user's own framing) or auto-assigned. "Round robin" is implemented as least-currently-loaded
-- (fewest pending/in_progress tasks), not strict cyclic order — a fairer automatic distribution
-- than literal rotation, since strict rotation keeps handing a slow employee more work at the
-- same rate as everyone else. Easy to swap for literal round-robin later if that's what's
-- actually wanted; flagged as a real interpretation choice, not hidden.
--
-- An employee can hold several tasks at once (confirmed explicitly by the user, not assumed) --
-- no uniqueness constraint prevents concurrent pending/in_progress rows per assignee. Time-per-
-- task is plain wall-clock (completed_at - assigned_at) with no attempt to split effort across
-- overlapping tasks -- asking an employee to clock in/out per task would break the same
-- "no manual action" principle check-ins are built around; a simple concurrent-task COUNT is
-- computed at read time (not stored) as context alongside the raw duration, so a task that took
-- 3 hours while 2 others were also open reads differently from one that took 3 hours alone,
-- without pretending to divide the 3 hours precisely.
-- ============================================================

create table if not exists public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  type                  text not null check (type in ('receive_delivery', 'make_sale', 'pack_repack', 'custom')),
  title                 text,
  assigned_to           uuid not null references public.users(id) on delete restrict,
  assigned_by           uuid references public.users(id) on delete set null,
  assignment_mode       text not null check (assignment_mode in ('manual', 'round_robin')),
  status                text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  related_vendor_id     uuid references public.vendors(id) on delete set null,
  related_customer_id   uuid references public.customers(id) on delete set null,
  related_bill_id       uuid references public.bills(id) on delete set null,
  related_sale_id       uuid references public.sales(id) on delete set null,
  assigned_at           timestamptz not null default now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  notes                 text,
  created_at            timestamptz not null default now()
);
create index if not exists tasks_assignee_status_idx on public.tasks (assigned_to, status);

alter table public.tasks enable row level security;

drop policy if exists tasks_select_own_or_admin on public.tasks;
create policy tasks_select_own_or_admin
  on public.tasks
  for select
  to authenticated
  using (
    assigned_to = auth.uid() or public.current_user_role() in ('admin', 'co-admin')
  );

-- No direct INSERT policy — create_task()/create_task_round_robin() below (SECURITY DEFINER)
-- are the only writers, so "who can delegate" is enforced in one place, not duplicated between
-- an RLS check-clause and an RPC role-check that could drift apart.

drop policy if exists tasks_update_own_or_admin on public.tasks;
create policy tasks_update_own_or_admin
  on public.tasks
  for update
  to authenticated
  using (
    assigned_to = auth.uid() or public.current_user_role() in ('admin', 'co-admin')
  )
  with check (
    assigned_to = auth.uid() or public.current_user_role() in ('admin', 'co-admin')
  );
-- A plain UPDATE is enough for the assignee to move their own task to 'in_progress'/'completed'
-- (custom tasks — no automatic completion signal exists for those, see below) or for an
-- admin to reassign/cancel. Auto-completion for the other 3 types goes through
-- auto_complete_task() (SECURITY DEFINER) instead, called from inside the RPC that actually
-- fulfills the task, not a separate client write.

-- No DELETE policy — a task's history stays, same D5 append-only spirit as everything else.

create or replace function public.create_task(
  p_type text,
  p_assigned_to uuid,
  p_title text default null,
  p_related_vendor_id uuid default null,
  p_related_customer_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_task_id uuid;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'create_task: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_type not in ('receive_delivery', 'make_sale', 'pack_repack', 'custom') then
    return jsonb_build_object('error', 'Invalid task type');
  end if;
  if p_type = 'custom' and (p_title is null or btrim(p_title) = '') then
    return jsonb_build_object('error', 'Custom tasks need a title');
  end if;
  if not exists (select 1 from public.users where id = p_assigned_to and active) then
    return jsonb_build_object('error', 'Assignee not found or inactive');
  end if;

  insert into public.tasks (type, title, assigned_to, assigned_by, assignment_mode, related_vendor_id, related_customer_id, notes)
  values (p_type, p_title, p_assigned_to, auth.uid(), 'manual', p_related_vendor_id, p_related_customer_id, p_notes)
  returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id);
end;
$$;

grant execute on function public.create_task(text, uuid, text, uuid, uuid, text) to authenticated;

create or replace function public.create_task_round_robin(
  p_type text,
  p_title text default null,
  p_related_vendor_id uuid default null,
  p_related_customer_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_task_id uuid;
  v_pick uuid;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'create_task_round_robin: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_type not in ('receive_delivery', 'make_sale', 'pack_repack', 'custom') then
    return jsonb_build_object('error', 'Invalid task type');
  end if;

  -- Least-currently-loaded active operational employee (vendor-rep/worker/super-worker — not
  -- admin/co-admin, who don't do field work) — see this file's header comment for why this is
  -- "least loaded," not literal round-robin.
  select u.id into v_pick
    from public.users u
    left join public.tasks t on t.assigned_to = u.id and t.status in ('pending', 'in_progress')
   where u.active and u.role in ('vendor-rep', 'worker', 'super-worker')
   group by u.id
   order by count(t.id) asc, u.id asc
   limit 1;

  if v_pick is null then
    return jsonb_build_object('error', 'No active employee available to assign');
  end if;

  insert into public.tasks (type, title, assigned_to, assigned_by, assignment_mode, related_vendor_id, related_customer_id, notes)
  values (p_type, p_title, v_pick, auth.uid(), 'round_robin', p_related_vendor_id, p_related_customer_id, p_notes)
  returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id, 'assigned_to', v_pick);
end;
$$;

grant execute on function public.create_task_round_robin(text, text, uuid, uuid, text) to authenticated;

-- auto_complete_task — called from inside record_bill_delivery/record_container_sale/
-- record_container_fill/record_repack (below), not from client code. Finds the OLDEST matching
-- open task for this exact employee and marks it done — "oldest first" mirrors this project's
-- own FIFO instinct everywhere else, and means an employee working through a backlog completes
-- them in the order they were assigned, not an arbitrary one.
create or replace function public.auto_complete_task(
  p_type text,
  p_user_id uuid,
  p_vendor_id uuid default null,
  p_customer_id uuid default null,
  p_bill_id uuid default null,
  p_sale_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  select id into v_task_id
    from public.tasks
   where type = p_type
     and assigned_to = p_user_id
     and status in ('pending', 'in_progress')
     and (p_vendor_id is null or related_vendor_id = p_vendor_id)
     and (p_customer_id is null or related_customer_id = p_customer_id)
   order by assigned_at asc
   limit 1;

  if v_task_id is not null then
    update public.tasks
       set status = 'completed',
           completed_at = now(),
           related_bill_id = coalesce(related_bill_id, p_bill_id),
           related_sale_id = coalesce(related_sale_id, p_sale_id)
     where id = v_task_id;
  end if;
end;
$$;

-- ============================================================
-- 3. Wire auto-completion into the 4 RPCs it applies to. All 4 are already live — re-issued in
-- full per this project's own fix-forward convention, not edited in place.
-- ============================================================

create or replace function public.record_bill_delivery(
  p_vendor_id uuid,
  p_location_id uuid,
  p_bill_date date default current_date,
  p_vendor_bill_number text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_bill_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_item_count int := 0;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
  v_vendor_name text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_bill_delivery: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_vendor_id is null then
    return jsonb_build_object('error', 'Vendor is required');
  end if;
  if p_location_id is null then
    return jsonb_build_object('error', 'Location is required');
  end if;
  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'At least one fish line is required');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;

    if not (v_item ? 'sku_id') or not (v_item ? 'kg') or not (v_item ? 'price_per_kg_paid') then
      return jsonb_build_object('error', format('Line %s is missing a required field', v_item_count));
    end if;
    if (v_item->>'kg')::numeric <= 0 then
      return jsonb_build_object('error', format('Line %s: kg must be positive', v_item_count));
    end if;
    if (v_item->>'price_per_kg_paid')::numeric < 0 then
      return jsonb_build_object('error', format('Line %s: price cannot be negative', v_item_count));
    end if;
    if not exists (select 1 from public.skus where id = (v_item->>'sku_id')::uuid) then
      return jsonb_build_object('error', format('Line %s: SKU not found', v_item_count));
    end if;

    v_total := v_total + round((v_item->>'kg')::numeric * (v_item->>'price_per_kg_paid')::numeric, 2);
  end loop;

  insert into public.bills (id, vendor_id, vendor_bill_number, bill_date, total_amount, created_by)
  values (v_bill_id, p_vendor_id, p_vendor_bill_number, coalesce(p_bill_date, current_date), v_total, v_user_id);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_batch_id := gen_random_uuid();

    insert into public.batches (
      id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at,
      bill_id, created_by
    ) values (
      v_batch_id, (v_item->>'sku_id')::uuid, p_vendor_id, p_location_id,
      (v_item->>'kg')::numeric, (v_item->>'kg')::numeric, (v_item->>'price_per_kg_paid')::numeric,
      now(), v_bill_id, v_user_id
    );

    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, created_by
    ) values (
      'delivery_in', null, p_location_id, (v_item->>'sku_id')::uuid, (v_item->>'kg')::numeric,
      v_batch_id, v_group_id, v_user_id
    );

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch_id, 'sku_id', v_item->>'sku_id', 'kg', v_item->>'kg'
    );
  end loop;

  select name into v_vendor_name from public.vendors where id = p_vendor_id;
  perform public.notify_admins('bill_received', jsonb_build_object(
    'bill_id', v_bill_id, 'vendor_id', p_vendor_id, 'vendor_name', v_vendor_name, 'total_amount', v_total
  ));
  perform public.auto_complete_task('receive_delivery', v_user_id, p_vendor_id, null, v_bill_id, null);

  return jsonb_build_object(
    'bill_id', v_bill_id,
    'movement_group_id', v_group_id,
    'total_amount', v_total,
    'batches', v_batches
  );
end;
$$;

grant execute on function public.record_bill_delivery(uuid, uuid, date, text, jsonb) to authenticated;

create or replace function public.record_container_sale(
  p_sku_id uuid,
  p_location_id uuid,
  p_customer_name text,
  p_total_kg numeric,
  p_sale_price_per_kg numeric,
  p_notes text default null,
  p_customer_id uuid default null
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
  v_customer_name text := p_customer_name;
  v_over_limit boolean;
  v_outstanding numeric(10,2);
begin
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

  if p_customer_id is not null then
    select name into v_customer_name from public.customers where id = p_customer_id;
    if v_customer_name is null then
      return jsonb_build_object('error', 'Selected customer not found');
    end if;
  end if;

  if v_customer_name is null or btrim(v_customer_name) = '' then
    return jsonb_build_object('error', 'Customer name is required');
  end if;

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
    id, sku_id, location_id, customer_name, customer_id, total_kg, sale_price_per_kg,
    total_amount, sold_by, sold_at, notes
  ) values (
    v_sale_id, p_sku_id, p_location_id, btrim(v_customer_name), p_customer_id, v_fulfilled,
    p_sale_price_per_kg, round(v_fulfilled * p_sale_price_per_kg, 2), v_user_id, now(), p_notes
  );

  update public.movements
     set sale_id = v_sale_id
   where movement_group_id = v_group_id
     and sale_id is null;

  if p_customer_id is not null then
    select is_over_limit, outstanding_balance into v_over_limit, v_outstanding
      from public.customer_credit_status where customer_id = p_customer_id;
    if coalesce(v_over_limit, false) is true then
      perform public.notify_admins('customer_over_limit', jsonb_build_object(
        'customer_id', p_customer_id, 'customer_name', v_customer_name,
        'sale_id', v_sale_id, 'outstanding_balance', v_outstanding
      ));
    end if;
  end if;

  perform public.auto_complete_task('make_sale', v_user_id, null, p_customer_id, null, v_sale_id);

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

grant execute on function public.record_container_sale(uuid, uuid, text, numeric, numeric, text, uuid) to authenticated;

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

  perform public.auto_complete_task('pack_repack', v_user_id);

  return jsonb_build_object(
    'container_id', v_container_id,
    'container_fill_id', v_fill_id,
    'expires_at', v_expires_at,
    'total_kg', v_total_kg
  );
end;
$$;

grant execute on function public.record_container_fill(uuid, uuid, text, numeric, jsonb) to authenticated;

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
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker') then
    raise exception 'record_repack: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

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
    return jsonb_build_object('error', 'Source fill has no container_fill_items — data integrity issue, aborting');
  end if;

  insert into public.container_fills (
    id, container_id, bill_id, location_id, filled_at, kg_remaining, expires_at, created_by,
    is_repack_copy
  ) values (
    v_dest_fill_id, p_destination_container_id, v_source.bill_id, v_source.location_id,
    v_source.filled_at, v_source.kg_remaining, v_source.expires_at, v_user_id,
    true
  );

  insert into public.container_fill_items (container_fill_id, batch_id, kg)
  select v_dest_fill_id, batch_id, kg
    from public.container_fill_items
   where container_fill_id = p_source_fill_id;

  update public.container_fills
     set kg_remaining = 0
   where id = p_source_fill_id;

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

  perform public.auto_complete_task('pack_repack', v_user_id);

  return jsonb_build_object(
    'destination_container_fill_id', v_dest_fill_id,
    'kg_moved', v_source.kg_remaining,
    'expires_at', v_source.expires_at,
    'movement_group_id', v_group_id
  );
end;
$$;

grant execute on function public.record_repack(uuid, uuid) to authenticated;
