-- 0040_procurement_and_truck_loads.sql — Phase B (BACKEND-REQUIREMENTS §2.2, §2.3, §2.4, §8.2)
-- The client's proposed shape, built so it sits BESIDE today's bill flow instead of replacing it:
--
--   PR-2026-000125  procurement   one purchase from one supplier: fish, expected kg, rate. Exists
--                                 BEFORE the fish arrives. Supplier and rate are the locked fields.
--     -> RCV-2026-000012 truck_loads   one physical arrival (a vehicle) carrying fish from one or
--                                 several suppliers. This is the ONLY thing receiving sees.
--       -> BATCH   batches        created on receiving confirmation, from the PHYSICAL weight.
--         -> SALE -> CUSTOMER     existing tables; traceability added in 0041.
--
-- Rules this migration enforces in the database rather than in the UI:
--   * Stock moves only on receiving confirmation, and moves by PHYSICAL kg (§2.2). procurement and
--     truck_loads have NO insert/update/delete policy; the only code that turns a procurement row
--     into stock is receive_truck_load(), which writes physical kg. Creating or dispatching a
--     procurement row cannot change stock (a test asserts it). A CHECK also forbids status
--     'received' without a physical weight and a time.
--   * Receiving never sees supplier or rate (§2.1). Receivers use list_receiving_queue() and
--     receive_truck_load(); the second returns no money and no supplier.
--   * Same money rule as today (migration 0032, "case by case, reconciled by hand"): the bill for a
--     supplier is the PROMISED amount (expected kg x rate) and is never auto-adjusted to the weight
--     that arrived; physical truth adjusts the batch, a discrepancy notifies the admins.
--   * Mixed loads, honestly (§2.4): when fish from several suppliers is mixed on the truck the
--     arrival weight of each fish cannot be split by supplier by anyone. receive_truck_load()
--     allocates the physical kg across the suppliers' lots PRO RATA to expected kg, and every batch
--     made that way is flagged is_pro_rata_share = true. batches stay single-supplier so FIFO and
--     costing keep working; traceability reports "a share of truck load RCV-x, which contained
--     lots from A, B, C" and never "this crate was supplier B".
--
-- A truck-load discrepancy raises its own notification type, 'truck_load_discrepancy' (payload: truck_load_id,
-- receiving_code, lots[]), because the existing 'delivery_discrepancy' payload is per bill and the bell's
-- text for it would read wrongly.
--
-- Extends list_receiving_queue() (0038) with truck loads.
-- IDEMPOTENT. Run after 0039.

-- ---- truck_loads ----------------------------------------------------------------------------
create table if not exists public.truck_loads (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,                    -- RCV-2026-000012
  vehicle_no               text,
  expected_arrival         timestamptz,
  destination_location_id  uuid references public.locations(id),
  status                   text not null default 'dispatched' check (status in ('dispatched', 'received', 'cancelled')),
  notes                    text,
  dispatched_by            uuid references public.users(id) on delete set null,
  dispatched_at            timestamptz not null default now(),
  received_by              uuid references public.users(id) on delete set null,
  received_at              timestamptz,
  created_at               timestamptz not null default now(),
  constraint truck_loads_received_has_time check (status <> 'received' or received_at is not null)
);

-- ---- procurement ----------------------------------------------------------------------------
create table if not exists public.procurement (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,                          -- PR-2026-000125
  sku_id             uuid not null references public.skus(id),
  supplier_id        uuid not null references public.vendors(id),   -- LOCKED from receiving
  rate_per_kg        numeric(10,2) not null check (rate_per_kg >= 0),   -- LOCKED from receiving
  expected_kg        numeric(10,3) not null check (expected_kg > 0),
  payment_terms      text not null default 'cash' check (payment_terms in ('cash', 'credit')),
  expected_arrival   timestamptz,
  status             text not null default 'created' check (status in ('created', 'dispatched', 'received', 'cancelled')),
  truck_load_id      uuid references public.truck_loads(id) on delete restrict,
  notes              text,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  dispatched_at      timestamptz,
  received_kg        numeric(10,3),       -- physical good + spoiled kg allocated to this lot
  received_at        timestamptz,
  bill_id            uuid references public.bills(id) on delete restrict,
  batch_id           uuid references public.batches(id) on delete restrict,
  cancelled_reason   text,
  constraint procurement_received_needs_weight
    check (status <> 'received' or (received_kg is not null and received_at is not null)),
  constraint procurement_dispatched_needs_truck
    check (status not in ('dispatched', 'received') or truck_load_id is not null)
);
create index if not exists procurement_status_idx on public.procurement (status);
create index if not exists procurement_truck_idx  on public.procurement (truck_load_id);
create index if not exists procurement_supplier_idx on public.procurement (supplier_id);

-- ---- traceability columns -------------------------------------------------------------------
alter table public.batches
  add column if not exists procurement_id uuid references public.procurement(id) on delete restrict,
  add column if not exists truck_load_id  uuid references public.truck_loads(id) on delete restrict,
  add column if not exists is_pro_rata_share boolean not null default false;
alter table public.receiving_confirmations
  add column if not exists procurement_id uuid references public.procurement(id) on delete restrict,
  add column if not exists truck_load_id  uuid references public.truck_loads(id) on delete restrict;
create index if not exists batches_procurement_idx on public.batches (procurement_id) where procurement_id is not null;
create index if not exists batches_truck_idx       on public.batches (truck_load_id)  where truck_load_id  is not null;

-- ---- RLS: read only; every write goes through the RPCs below ---------------------------------
alter table public.truck_loads enable row level security;
alter table public.procurement enable row level security;

drop policy if exists truck_loads_select_receivers on public.truck_loads;
create policy truck_loads_select_receivers on public.truck_loads for select to authenticated
  using (public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker'));

drop policy if exists procurement_select_team on public.procurement;
create policy procurement_select_team on public.procurement for select to authenticated
  using (public.can_manage_procurement());

do $$
declare t text;
begin
  foreach t in array array['truck_loads', 'procurement'] loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I
                      for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- ================================================================================================
-- create_procurement
-- ================================================================================================
create or replace function public.create_procurement(
  p_sku_id uuid,
  p_expected_kg numeric,
  p_supplier_id uuid,
  p_rate_per_kg numeric,
  p_expected_arrival timestamptz default null,
  p_payment_terms text default 'cash',
  p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
begin
  if not public.can_manage_procurement() then
    raise exception 'create_procurement: not permitted' using errcode = '42501';
  end if;
  if p_expected_kg is null or p_expected_kg <= 0 or p_expected_kg = 'NaN'::numeric then return jsonb_build_object('error', 'Expected kg must be a positive number'); end if;
  if p_rate_per_kg is null or p_rate_per_kg < 0 or p_rate_per_kg = 'NaN'::numeric then return jsonb_build_object('error', 'Rate must be a number, zero or more'); end if;
  if p_payment_terms not in ('cash', 'credit') then return jsonb_build_object('error', 'Invalid payment terms'); end if;
  if not exists (select 1 from public.skus where id = p_sku_id and active) then
    return jsonb_build_object('error', 'Fish not found or inactive');
  end if;
  if not exists (select 1 from public.vendors where id = p_supplier_id and active) then
    return jsonb_build_object('error', 'Supplier not found or inactive');
  end if;

  v_code := public.next_code('PR');
  insert into public.procurement (id, code, sku_id, supplier_id, rate_per_kg, expected_kg, payment_terms,
                                  expected_arrival, notes, created_by)
  values (v_id, v_code, p_sku_id, p_supplier_id, p_rate_per_kg, p_expected_kg, p_payment_terms,
          p_expected_arrival, p_notes, auth.uid());
  return jsonb_build_object('procurement_id', v_id, 'code', v_code, 'status', 'created');
end;
$$;
grant execute on function public.create_procurement(uuid, numeric, uuid, numeric, timestamptz, text, text) to authenticated;

-- ================================================================================================
-- dispatch_procurement — put one or more PRs on one vehicle -> a truck load (the receiving id)
-- ================================================================================================
create or replace function public.dispatch_procurement(
  p_procurement_ids uuid[],
  p_vehicle_no text default null,
  p_expected_arrival timestamptz default null,
  p_destination_location_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_tl_id uuid := gen_random_uuid();
  v_code text;
  v_n int;
  v_bad int;
  v_dest_kind text;
begin
  if not public.can_manage_procurement() then
    raise exception 'dispatch_procurement: not permitted' using errcode = '42501';
  end if;
  if p_procurement_ids is null or cardinality(p_procurement_ids) = 0 then
    return jsonb_build_object('error', 'Pick at least one purchase to dispatch');
  end if;

  -- lock the rows so a concurrent cancel cannot be overwritten
  perform 1 from public.procurement where id = any (p_procurement_ids) order by id for update;
  select count(*) into v_n from public.procurement where id = any (p_procurement_ids);
  if v_n <> cardinality(p_procurement_ids) then
    return jsonb_build_object('error', 'One of those purchases does not exist');
  end if;
  select count(*) into v_bad from public.procurement where id = any (p_procurement_ids) and status <> 'created';
  if v_bad > 0 then
    return jsonb_build_object('error', 'Only purchases in status "created" can be dispatched');
  end if;
  if p_destination_location_id is not null then
    select kind into v_dest_kind from public.locations where id = p_destination_location_id;
    if v_dest_kind is null or v_dest_kind in ('in_transit_inbound', 'in_transit_outbound') then
      return jsonb_build_object('error', 'Destination must be a real storage location');
    end if;
  end if;

  v_code := public.next_code('RCV');
  insert into public.truck_loads (id, code, vehicle_no, expected_arrival, destination_location_id, dispatched_by)
  values (v_tl_id, v_code, p_vehicle_no,
          coalesce(p_expected_arrival, (select min(expected_arrival) from public.procurement where id = any (p_procurement_ids))),
          p_destination_location_id, auth.uid());

  update public.procurement
     set status = 'dispatched', truck_load_id = v_tl_id, dispatched_at = now()
   where id = any (p_procurement_ids) and status = 'created';

  return jsonb_build_object('truck_load_id', v_tl_id, 'receiving_code', v_code, 'purchases', v_n);
end;
$$;
grant execute on function public.dispatch_procurement(uuid[], text, timestamptz, uuid) to authenticated;

-- ================================================================================================
-- cancel_procurement
-- ================================================================================================
create or replace function public.cancel_procurement(p_procurement_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_p record;
  v_left int;
begin
  if not public.can_manage_procurement() then
    raise exception 'cancel_procurement: not permitted' using errcode = '42501';
  end if;
  select id, status, truck_load_id into v_p from public.procurement where id = p_procurement_id for update;
  if not found then return jsonb_build_object('error', 'Purchase not found'); end if;
  if v_p.status not in ('created', 'dispatched') then
    return jsonb_build_object('error', 'A received or cancelled purchase cannot be cancelled');
  end if;

  update public.procurement
     set status = 'cancelled', cancelled_reason = p_reason
   where id = p_procurement_id;
  -- keep the audit trail's truck_load_id: the row stays attached for history

  if v_p.truck_load_id is not null then
    select count(*) into v_left from public.procurement
     where truck_load_id = v_p.truck_load_id and status = 'dispatched';
    if v_left = 0 then
      update public.truck_loads set status = 'cancelled' where id = v_p.truck_load_id and status = 'dispatched';
    end if;
  end if;
  return jsonb_build_object('status', 'cancelled');
end;
$$;
grant execute on function public.cancel_procurement(uuid, text) to authenticated;

-- ================================================================================================
-- receive_truck_load — the receiving confirmation. Physical kg in, stock moves, money untouched.
--   p_lines: [{"sku_id": uuid, "good_kg": 140, "spoiled_kg": 2}, ...]  one line per fish on the truck
-- Returns NO money and NO supplier, so it is safe for a blind receiver.
-- ================================================================================================
create or replace function public.receive_truck_load(
  p_truck_load_id uuid,
  p_lines jsonb,
  p_destination_location_id uuid default null,
  p_notes text default null,
  p_photo_status text default 'none'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user uuid := auth.uid();
  v_tl record;
  v_dest uuid;
  v_dest_kind text;
  v_line jsonb;
  v_sku uuid;
  v_good numeric; v_spoiled numeric;
  v_rows record;
  v_total_exp numeric; v_left_good numeric; v_left_spoiled numeric;
  v_i int; v_cnt int;
  v_alloc_good numeric; v_alloc_spoiled numeric;
  v_group uuid := gen_random_uuid();
  v_bill_id uuid;
  v_batch_id uuid;
  v_conf_id uuid;
  v_disc boolean;
  v_any_disc boolean := false;
  v_summary jsonb := '[]'::jsonb;
  v_admin_detail jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_n_skus int;
  v_supplier record;
  v_bill_ids jsonb := '{}'::jsonb;
  v_bill_key text;
  v_grand_total numeric := 0;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'receive_truck_load: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_photo_status not in ('none', 'pending_upload', 'uploaded') then
    return jsonb_build_object('error', 'Invalid photo status');
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('error', 'Enter the weight of each fish on the truck');
  end if;

  select * into v_tl from public.truck_loads where id = p_truck_load_id for update;
  if not found then return jsonb_build_object('error', 'Truck load not found'); end if;
  if v_tl.status <> 'dispatched' then
    return jsonb_build_object('error', 'This truck load is already ' || v_tl.status);
  end if;

  v_dest := coalesce(p_destination_location_id, v_tl.destination_location_id);
  if v_dest is null then return jsonb_build_object('error', 'Choose where the fish is going'); end if;
  select kind into v_dest_kind from public.locations where id = v_dest and active;
  if v_dest_kind is null then return jsonb_build_object('error', 'Destination not found'); end if;
  if v_dest_kind in ('in_transit_inbound', 'in_transit_outbound') then
    return jsonb_build_object('error', 'Destination must be a real storage location, not a transit stage');
  end if;

  -- every fish on the truck needs exactly one line, and no extras
  select count(distinct sku_id) into v_n_skus from public.procurement
   where truck_load_id = p_truck_load_id and status = 'dispatched';
  if jsonb_array_length(p_lines) <> v_n_skus then
    return jsonb_build_object('error', format('This truck carries %s kind(s) of fish; enter a weight for each', v_n_skus));
  end if;
  perform 1 from public.procurement where truck_load_id = p_truck_load_id and status = 'dispatched' order by id for update;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if not (v_line ? 'sku_id') or not (v_line ? 'good_kg') then
      return jsonb_build_object('error', 'Each line needs a fish (sku_id) and a good_kg weight');
    end if;
    v_sku := (v_line->>'sku_id')::uuid;
    if v_sku = any (v_seen) then return jsonb_build_object('error', 'Each fish can appear only once'); end if;
    v_seen := v_seen || v_sku;
    if not exists (select 1 from public.procurement where truck_load_id = p_truck_load_id and status = 'dispatched' and sku_id = v_sku) then
      return jsonb_build_object('error', 'A fish in the list is not on this truck');
    end if;
    v_good := (v_line->>'good_kg')::numeric;
    v_spoiled := coalesce((v_line->>'spoiled_kg')::numeric, 0);
    if v_good = 'NaN'::numeric or v_spoiled = 'NaN'::numeric then
      return jsonb_build_object('error', 'Weights must be numbers');
    end if;
    if v_good < 0 or v_spoiled < 0 then
      return jsonb_build_object('error', 'Weights cannot be negative');
    end if;
    v_grand_total := v_grand_total + v_good + v_spoiled;
  end loop;
  if v_grand_total <= 0 then
    -- a truck where nothing arrived is a cancellation, not a receipt: receiving it would bill every supplier for fish that never came
    return jsonb_build_object('error', 'No fish was weighed in. If the truck did not arrive, cancel its purchases instead.');
  end if;

  -- ---- allocate and post, one fish at a time ------------------------------------------------
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := (v_line->>'sku_id')::uuid;
    v_good := (v_line->>'good_kg')::numeric;
    v_spoiled := coalesce((v_line->>'spoiled_kg')::numeric, 0);
    select sum(expected_kg), count(*) into v_total_exp, v_cnt
      from public.procurement where truck_load_id = p_truck_load_id and status = 'dispatched' and sku_id = v_sku;
    v_left_good := v_good; v_left_spoiled := v_spoiled; v_i := 0;
    v_disc := abs((v_good + v_spoiled) - v_total_exp) > 0.0005;
    if v_disc then v_any_disc := true; end if;

    for v_rows in
      select p.* from public.procurement p
       where p.truck_load_id = p_truck_load_id and p.status = 'dispatched' and p.sku_id = v_sku
       order by p.created_at, p.id
    loop
      v_i := v_i + 1;
      if v_i = v_cnt then
        v_alloc_good := v_left_good; v_alloc_spoiled := v_left_spoiled;     -- remainder: totals stay exact
      else
        v_alloc_good    := round(v_good    * v_rows.expected_kg / v_total_exp, 3);
        v_alloc_spoiled := round(v_spoiled * v_rows.expected_kg / v_total_exp, 3);
        v_left_good := v_left_good - v_alloc_good; v_left_spoiled := v_left_spoiled - v_alloc_spoiled;
      end if;

      -- one bill per supplier AND payment terms per truck load (a cash lot and a credit lot from the same supplier are two bills), at the PROMISED amount (never auto-adjusted)
      v_bill_key := v_rows.supplier_id::text || '|' || v_rows.payment_terms;
      v_bill_id := (v_bill_ids ->> v_bill_key)::uuid;
      if v_bill_id is null then
        v_bill_id := gen_random_uuid();
        insert into public.bills (id, vendor_id, bill_date, total_amount, payment_terms, created_by)
        select v_bill_id, v_rows.supplier_id, current_date,
               round(sum(p2.expected_kg * p2.rate_per_kg), 2), v_rows.payment_terms, v_user
          from public.procurement p2
         where p2.truck_load_id = p_truck_load_id and p2.status = 'dispatched'
           and p2.supplier_id = v_rows.supplier_id and p2.payment_terms = v_rows.payment_terms;
        v_bill_ids := v_bill_ids || jsonb_build_object(v_bill_key, v_bill_id);
      end if;

      v_batch_id := null;
      if (v_alloc_good + v_alloc_spoiled) > 0 then
        v_batch_id := gen_random_uuid();
        insert into public.batches (id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid,
                                    delivered_at, bill_id, created_by, procurement_id, truck_load_id, is_pro_rata_share)
        values (v_batch_id, v_sku, v_rows.supplier_id, v_dest, v_alloc_good + v_alloc_spoiled,
                v_alloc_good + v_alloc_spoiled, v_rows.rate_per_kg, now(), v_bill_id, v_user,
                v_rows.id, p_truck_load_id, v_cnt > 1 or (select count(distinct supplier_id) from public.procurement
                                                           where truck_load_id = p_truck_load_id and sku_id = v_sku) > 1);
        -- stock enters HERE, at physical weight
        insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, created_by)
        values ('delivery_in', null, v_dest, v_sku, v_alloc_good + v_alloc_spoiled, v_batch_id, v_group, v_user);
        if v_alloc_spoiled > 0 then
          insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, notes, created_by)
          values ('spoilage', v_dest, null, v_sku, v_alloc_spoiled, v_batch_id, v_group,
                  coalesce(p_notes, 'Found spoiled/damaged at receiving'), v_user);
        end if;

        insert into public.receiving_confirmations (id, bill_id, batch_id, promised_kg, confirmed_kg, spoiled_kg,
              promised_sku_id, confirmed_sku_id, discrepancy_flag, notes, photo_status, confirmed_by,
              procurement_id, truck_load_id)
        values (gen_random_uuid(), v_bill_id, v_batch_id, v_rows.expected_kg, v_alloc_good, v_alloc_spoiled,
                v_sku, v_sku, v_disc, p_notes, p_photo_status, v_user, v_rows.id, p_truck_load_id);
      end if;

      update public.procurement
         set status = 'received', received_kg = v_alloc_good + v_alloc_spoiled, received_at = now(),
             bill_id = v_bill_id, batch_id = v_batch_id
       where id = v_rows.id and status = 'dispatched';

      -- (rows were locked above, so this guard only trips on a logic error)
      v_admin_detail := v_admin_detail || jsonb_build_object(
        'procurement_id', v_rows.id, 'code', v_rows.code, 'supplier_id', v_rows.supplier_id,
        'expected_kg', v_rows.expected_kg, 'allocated_good_kg', v_alloc_good, 'allocated_spoiled_kg', v_alloc_spoiled);
      v_bill_id := null;   -- re-resolved per row from v_bill_ids
    end loop;

    v_summary := v_summary || jsonb_build_object(
      'sku_id', v_sku, 'expected_kg', v_total_exp, 'good_kg', v_good, 'spoiled_kg', v_spoiled,
      'difference_kg', round((v_good + v_spoiled) - v_total_exp, 3), 'discrepancy', v_disc);
  end loop;

  update public.truck_loads
     set status = 'received', received_by = v_user, received_at = now(),
         destination_location_id = v_dest, notes = coalesce(p_notes, notes)
   where id = p_truck_load_id;

  if v_any_disc then
    perform public.notify_admins('truck_load_discrepancy', jsonb_build_object(
      'truck_load_id', p_truck_load_id, 'receiving_code', v_tl.code, 'lots', v_admin_detail));
  end if;
  perform public.auto_complete_task('receive_delivery', v_user, null, null, null, null);

  return jsonb_build_object(
    'truck_load_id', p_truck_load_id, 'receiving_code', v_tl.code,
    'discrepancy', v_any_disc, 'lines', v_summary, 'movement_group_id', v_group);
end;
$$;
grant execute on function public.receive_truck_load(uuid, jsonb, uuid, text, text) to authenticated;

-- ================================================================================================
-- list_receiving_queue — now also lists truck loads (one row per fish on the truck)
-- ================================================================================================
drop function if exists public.list_receiving_queue();
create or replace function public.list_receiving_queue()
returns table (
  source         text,
  ref_id         uuid,
  short_code     text,
  sku_id         uuid,
  english_name   text,
  tamil_name     text,
  expected_kg    numeric,
  location_id    uuid,
  location_name  text,
  arrived_at     timestamptz,
  vendor_name    text,
  bill_number    text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_money boolean := public.can_view_procurement_money();
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'list_receiving_queue: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;

  return query
  select 'bill'::text, b.id,
         'RCV-' || upper(substr(replace(b.id::text, '-', ''), 1, 6)),
         b.sku_id, s.english_name, s.tamil_name, b.kg, b.location_id, l.display_name, b.created_at,
         case when v_money then v.name end,
         case when v_money then bl.vendor_bill_number end
    from public.batches b
    join public.locations l on l.id = b.location_id and l.kind = 'in_transit_inbound'
    join public.skus s on s.id = b.sku_id
    left join public.vendors v on v.id = b.vendor_id
    left join public.bills bl on bl.id = b.bill_id
   where b.bill_id is not null
  union all
  select 'truck_load'::text, t.id, t.code, p.sku_id, s.english_name, s.tamil_name,
         sum(p.expected_kg), t.destination_location_id, dl.display_name,
         coalesce(t.expected_arrival, t.dispatched_at),
         case when v_money then string_agg(distinct v.name, ', ') end,
         null::text
    from public.truck_loads t
    join public.procurement p on p.truck_load_id = t.id and p.status = 'dispatched'
    join public.skus s on s.id = p.sku_id
    join public.vendors v on v.id = p.supplier_id
    left join public.locations dl on dl.id = t.destination_location_id
   where t.status = 'dispatched'
   group by t.id, t.code, p.sku_id, s.english_name, s.tamil_name, t.destination_location_id, dl.display_name,
            t.expected_arrival, t.dispatched_at
   order by 10;
end;
$$;
grant execute on function public.list_receiving_queue() to authenticated;
