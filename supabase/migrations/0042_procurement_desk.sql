-- 0042_procurement_desk.sql — Phase B (BACKEND-REQUIREMENTS §8.1, 8.3, 8.4, 8.2 PO)
-- The desktop "procurement desk" chapters 21-32 of the picture book, as data:
--
--   purchase_requirements   "what do we need today" (ch.22). Open -> In progress -> Completed.
--   market_prices           what each market is paying per kg (ch.25). NOT price_history, which is
--                           our own realised sale price. Entered by hand today.
--   festivals               demand/price effects by date (ch.26), plain reference data.
--   supplier_quotations     several suppliers quoting the same requirement (ch.27); landed cost is
--                           derived, never stored (ch.30): price + transport + ice/packing +
--                           loading + other, per kg.
--   purchase_orders (+lines) the formal PO (ch.28), with codes PO-2026-000007.
--
-- All of it is procurement MONEY, so every table is readable only by can_manage_procurement()
-- (admin, co-admin, and vendor-rep / super-worker unless made receiving_blind). The requirements
-- doc left open whether the app owns procurement at all (§10 Q2) and whether the desk is a sixth
-- role (§2.7); these tables cost nothing if unused, and the role question is one function
-- (can_manage_procurement). If the client answers "no, we only receive here", the PO and quotation
-- tables simply stay empty and chapters 22/25-28/30 become reports over bills.
--
-- (Postgres treats NaN as larger than every number, so `check (x > 0)` alone lets 'NaN' through; the
-- tables people can write directly therefore also carry `x < 'NaN'`.)
--
-- Writes: ordinary CRUD tables (requirements, market prices, festivals, quotations) get RLS
-- insert/update policies for the procurement team; the PO is a RPC because it moves through
-- statuses and links to procurement rows.
--
-- IDEMPOTENT. Run after 0041.

-- ---- purchase_requirements ------------------------------------------------------------------
create table if not exists public.purchase_requirements (
  id                    uuid primary key default gen_random_uuid(),
  required_date         date not null default current_date,
  sku_id                uuid not null references public.skus(id),
  qty_kg                numeric(10,3) not null check (qty_kg > 0 and qty_kg < 'NaN'::numeric),
  destination           text,
  priority              text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  expected_price_per_kg numeric(10,2) check (expected_price_per_kg is null or (expected_price_per_kg >= 0 and expected_price_per_kg < 'NaN'::numeric)),
  status                text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  note                  text,
  created_by            uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists purchase_requirements_date_idx on public.purchase_requirements (required_date, status);

-- ---- market_prices --------------------------------------------------------------------------
create table if not exists public.market_prices (
  id           uuid primary key default gen_random_uuid(),
  market       text not null,
  sku_id       uuid not null references public.skus(id),
  price_date   date not null default current_date,
  price_per_kg numeric(10,2) not null check (price_per_kg >= 0 and price_per_kg < 'NaN'::numeric),
  source       text,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (market, sku_id, price_date)
);
create index if not exists market_prices_lookup_idx on public.market_prices (sku_id, market, price_date desc);

-- ---- festivals ------------------------------------------------------------------------------
create table if not exists public.festivals (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  festival_date        date not null,
  market               text,
  effect               text not null default 'demand_up' check (effect in ('demand_up', 'demand_down', 'price_up', 'price_down', 'no_fish_day')),
  purchase_price_band  text,
  sale_price_band      text,
  est_demand           text,
  note                 text,
  created_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists festivals_date_idx on public.festivals (festival_date);

-- ---- purchase_orders ------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,                       -- PO-2026-000007
  supplier_id            uuid not null references public.vendors(id),
  po_date                date not null default current_date,
  expected_arrival       date,
  destination_location_id uuid references public.locations(id),
  payment_terms_days     int not null default 0 check (payment_terms_days >= 0),
  transport_cost         numeric(10,2) not null default 0 check (transport_cost >= 0),
  ice_packing_cost       numeric(10,2) not null default 0 check (ice_packing_cost >= 0),
  status                 text not null default 'draft' check (status in ('draft', 'sent', 'partially_received', 'received', 'cancelled')),
  note                   text,
  created_by             uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  sent_at                timestamptz
);
create table if not exists public.purchase_order_lines (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references public.purchase_orders(id) on delete restrict,
  sku_id        uuid not null references public.skus(id),
  qty_kg        numeric(10,3) not null check (qty_kg > 0),
  price_per_kg  numeric(10,2) not null check (price_per_kg >= 0),
  grade_id      uuid references public.grades(id),
  procurement_id uuid references public.procurement(id) on delete restrict,   -- set when the line is released as a PR
  requirement_id uuid references public.purchase_requirements(id) on delete set null
);
create index if not exists purchase_order_lines_po_idx on public.purchase_order_lines (po_id);

-- ---- supplier_quotations --------------------------------------------------------------------
create table if not exists public.supplier_quotations (
  id               uuid primary key default gen_random_uuid(),
  requirement_id   uuid references public.purchase_requirements(id) on delete set null,
  sku_id           uuid not null references public.skus(id),
  qty_kg           numeric(10,3) not null check (qty_kg > 0 and qty_kg < 'NaN'::numeric),
  destination      text,
  supplier_id      uuid not null references public.vendors(id),
  price_per_kg     numeric(10,2) not null check (price_per_kg >= 0 and price_per_kg < 'NaN'::numeric),
  transport_cost   numeric(10,2) not null default 0 check (transport_cost >= 0 and transport_cost < 'NaN'::numeric),   -- total for the quote
  ice_packing_cost numeric(10,2) not null default 0 check (ice_packing_cost >= 0 and ice_packing_cost < 'NaN'::numeric),
  loading_cost     numeric(10,2) not null default 0 check (loading_cost >= 0 and loading_cost < 'NaN'::numeric),
  other_cost       numeric(10,2) not null default 0 check (other_cost >= 0 and other_cost < 'NaN'::numeric),
  quoted_at        timestamptz not null default now(),
  valid_until      date,
  selected         boolean not null default false,
  po_id            uuid references public.purchase_orders(id) on delete set null,
  note             text,
  created_by       uuid references public.users(id) on delete set null
);
create index if not exists supplier_quotations_req_idx on public.supplier_quotations (requirement_id);
-- only one selected quote per requirement
create unique index if not exists supplier_quotations_one_selected
  on public.supplier_quotations (requirement_id) where selected and requirement_id is not null;

-- close the loop on procurement
alter table public.procurement
  add column if not exists requirement_id uuid references public.purchase_requirements(id) on delete set null,
  add column if not exists po_id uuid references public.purchase_orders(id) on delete set null;

-- landed cost is arithmetic, never stored (chapter 30)
create or replace view public.supplier_quotations_landed_v with (security_invoker = true) as
select q.*,
       round(q.price_per_kg, 2) as purchase_per_kg,
       round(q.transport_cost / q.qty_kg, 2)   as transport_per_kg,
       round(q.ice_packing_cost / q.qty_kg, 2) as ice_packing_per_kg,
       round(q.loading_cost / q.qty_kg, 2)     as loading_per_kg,
       round(q.other_cost / q.qty_kg, 2)       as other_per_kg,
       round(q.price_per_kg + (q.transport_cost + q.ice_packing_cost + q.loading_cost + q.other_cost) / q.qty_kg, 2) as landed_per_kg,
       round(q.price_per_kg * q.qty_kg + q.transport_cost + q.ice_packing_cost + q.loading_cost + q.other_cost, 2) as landed_total,
       -- "best price" ignores expired quotes: an expired 650 must not beat a live 705
       (q.valid_until is null or q.valid_until >= current_date)
         and (q.price_per_kg + (q.transport_cost + q.ice_packing_cost + q.loading_cost + q.other_cost) / q.qty_kg)
           = min(q.price_per_kg + (q.transport_cost + q.ice_packing_cost + q.loading_cost + q.other_cost) / q.qty_kg)
               filter (where q.valid_until is null or q.valid_until >= current_date)
             over (partition by coalesce(q.requirement_id, q.id)) as is_best_price
  from public.supplier_quotations q;   -- security_invoker: the table's own RLS (procurement team only) applies
revoke all on public.supplier_quotations_landed_v from public, anon, authenticated;
grant select on public.supplier_quotations_landed_v to authenticated;

-- ---- RLS + audit ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['purchase_requirements', 'market_prices', 'festivals', 'supplier_quotations',
                           'purchase_orders', 'purchase_order_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_team', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_manage_procurement())',
                   t || '_select_team', t);
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I
                      for each row execute function public.audit_trigger()', t, t);
  end loop;
  -- plain CRUD tables: procurement team may insert and update (no delete: history stays)
  foreach t in array array['purchase_requirements', 'market_prices', 'festivals', 'supplier_quotations'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_team', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_procurement())',
                   t || '_insert_team', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_team', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_procurement()) with check (public.can_manage_procurement())',
                   t || '_update_team', t);
  end loop;
end $$;
-- purchase_orders / purchase_order_lines: RPC-only writes (below)

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_purchase_requirements_touch on public.purchase_requirements;
create trigger trg_purchase_requirements_touch before update on public.purchase_requirements
  for each row execute function public.touch_updated_at();

-- ================================================================================================
-- select_quotation — choose the winning quote for a requirement (clears any previous choice)
-- ================================================================================================
create or replace function public.select_quotation(p_quotation_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare q record;
begin
  if not public.can_manage_procurement() then
    raise exception 'select_quotation: not permitted' using errcode = '42501';
  end if;
  select id, requirement_id, valid_until into q from public.supplier_quotations where id = p_quotation_id for update;
  if not found then return jsonb_build_object('error', 'Quotation not found'); end if;
  if q.valid_until is not null and q.valid_until < current_date then
    return jsonb_build_object('error', 'This quotation has expired');
  end if;
  if q.requirement_id is not null then
    update public.supplier_quotations set selected = false where requirement_id = q.requirement_id and selected;
    update public.purchase_requirements set status = 'in_progress' where id = q.requirement_id and status = 'open';
  end if;
  update public.supplier_quotations set selected = true where id = p_quotation_id;
  return jsonb_build_object('selected', p_quotation_id);
end;
$$;
grant execute on function public.select_quotation(uuid) to authenticated;

-- ================================================================================================
-- create_purchase_order — from a selected quotation, or from explicit lines
--   p_lines: [{"sku_id","qty_kg","price_per_kg","grade_id"?,"requirement_id"?}]
-- ================================================================================================
create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_lines jsonb,
  p_expected_arrival date default null,
  p_destination_location_id uuid default null,
  p_payment_terms_days int default 0,
  p_transport_cost numeric default 0,
  p_ice_packing_cost numeric default 0,
  p_quotation_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_code text;
  v_line jsonb;
  v_n int := 0;
  q record;
begin
  if not public.can_manage_procurement() then
    raise exception 'create_purchase_order: not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vendors where id = p_supplier_id and active) then
    return jsonb_build_object('error', 'Supplier not found or inactive');
  end if;
  if coalesce(p_transport_cost, 0) < 0 or coalesce(p_ice_packing_cost, 0) < 0
     or coalesce(p_transport_cost, 0) = 'NaN'::numeric or coalesce(p_ice_packing_cost, 0) = 'NaN'::numeric
     or coalesce(p_payment_terms_days, 0) < 0 then
    return jsonb_build_object('error', 'Costs and payment days must be zero or more');
  end if;

  if p_quotation_id is not null then
    select * into q from public.supplier_quotations where id = p_quotation_id;
    if not found then return jsonb_build_object('error', 'Quotation not found'); end if;
    if q.supplier_id <> p_supplier_id then return jsonb_build_object('error', 'That quotation is from a different supplier'); end if;
    if q.po_id is not null then return jsonb_build_object('error', 'That quotation already has a purchase order'); end if;
    p_lines := jsonb_build_array(jsonb_build_object('sku_id', q.sku_id, 'qty_kg', q.qty_kg,
                'price_per_kg', q.price_per_kg, 'requirement_id', q.requirement_id));
    p_transport_cost := q.transport_cost;
    p_ice_packing_cost := q.ice_packing_cost;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('error', 'A purchase order needs at least one line');
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    if not (v_line ? 'sku_id' and v_line ? 'qty_kg' and v_line ? 'price_per_kg') then
      return jsonb_build_object('error', format('Line %s is missing a field', v_n));
    end if;
    if (v_line->>'qty_kg')::numeric <= 0 or (v_line->>'price_per_kg')::numeric < 0
       or (v_line->>'qty_kg')::numeric = 'NaN'::numeric or (v_line->>'price_per_kg')::numeric = 'NaN'::numeric then
      return jsonb_build_object('error', format('Line %s: kg must be positive and price not negative', v_n));
    end if;
    if not exists (select 1 from public.skus where id = (v_line->>'sku_id')::uuid and active) then
      return jsonb_build_object('error', format('Line %s: fish not found or inactive', v_n));
    end if;
  end loop;

  v_code := public.next_code('PO');
  insert into public.purchase_orders (id, code, supplier_id, expected_arrival, destination_location_id,
                                      payment_terms_days, transport_cost, ice_packing_cost, note, created_by)
  values (v_id, v_code, p_supplier_id, p_expected_arrival, p_destination_location_id,
          coalesce(p_payment_terms_days, 0), coalesce(p_transport_cost, 0), coalesce(p_ice_packing_cost, 0), p_note, auth.uid());

  insert into public.purchase_order_lines (po_id, sku_id, qty_kg, price_per_kg, grade_id, requirement_id)
  select v_id, (l->>'sku_id')::uuid, (l->>'qty_kg')::numeric, (l->>'price_per_kg')::numeric,
         nullif(l->>'grade_id', '')::uuid, nullif(l->>'requirement_id', '')::uuid
    from jsonb_array_elements(p_lines) l;

  if p_quotation_id is not null then
    -- one selected quote per requirement: release any other before claiming this one
    update public.supplier_quotations set selected = false
     where requirement_id = q.requirement_id and selected and id <> p_quotation_id and q.requirement_id is not null;
    update public.supplier_quotations set po_id = v_id, selected = true where id = p_quotation_id;
  end if;
  return jsonb_build_object('po_id', v_id, 'code', v_code, 'status', 'draft');
end;
$$;
grant execute on function public.create_purchase_order(uuid, jsonb, date, uuid, int, numeric, numeric, uuid, text) to authenticated;

-- ================================================================================================
-- release_purchase_order — send the PO: each line becomes a procurement row (PR) ready to dispatch
-- ================================================================================================
create or replace function public.release_purchase_order(p_po_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  po record;
  l record;
  v_pid uuid;
  v_code text;
  v_codes jsonb := '[]'::jsonb;
begin
  if not public.can_manage_procurement() then
    raise exception 'release_purchase_order: not permitted' using errcode = '42501';
  end if;
  select * into po from public.purchase_orders where id = p_po_id for update;
  if not found then return jsonb_build_object('error', 'Purchase order not found'); end if;
  if po.status <> 'draft' then return jsonb_build_object('error', 'Only a draft purchase order can be sent'); end if;

  for l in select * from public.purchase_order_lines where po_id = p_po_id order by id loop
    v_pid := gen_random_uuid();
    v_code := public.next_code('PR');
    insert into public.procurement (id, code, sku_id, supplier_id, rate_per_kg, expected_kg, payment_terms,
                                    expected_arrival, notes, created_by, requirement_id, po_id)
    values (v_pid, v_code, l.sku_id, po.supplier_id, l.price_per_kg, l.qty_kg,
            case when po.payment_terms_days > 0 then 'credit' else 'cash' end,
            po.expected_arrival::timestamptz, 'From ' || po.code, auth.uid(), l.requirement_id, p_po_id);
    update public.purchase_order_lines set procurement_id = v_pid where id = l.id;
    v_codes := v_codes || to_jsonb(v_code);
  end loop;

  update public.purchase_orders set status = 'sent', sent_at = now() where id = p_po_id;
  update public.purchase_requirements set status = 'in_progress'
   where status = 'open' and id in (select requirement_id from public.purchase_order_lines where po_id = p_po_id and requirement_id is not null);
  return jsonb_build_object('status', 'sent', 'purchases', v_codes);
end;
$$;
grant execute on function public.release_purchase_order(uuid) to authenticated;

-- A PO's status follows its purchases: when every PR is received the PO is received; some received
-- = partially_received; every PR cancelled = cancelled. Kept in a trigger so no code path forgets.
create or replace function public.sync_po_status() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_total int; v_recv int; v_canc int; v_status text;
begin
  if new.po_id is null or new.status not in ('received', 'cancelled') then return new; end if;
  select count(*), count(*) filter (where status = 'received'), count(*) filter (where status = 'cancelled')
    into v_total, v_recv, v_canc from public.procurement where po_id = new.po_id;
  -- cancelled purchases do not hold a PO open: it is received when every purchase that was NOT cancelled is
  v_status := case
    when v_canc = v_total then 'cancelled'
    when v_recv > 0 and v_recv + v_canc = v_total then 'received'
    when v_recv > 0 then 'partially_received'
    else null end;
  if v_status is not null then
    update public.purchase_orders set status = v_status
     where id = new.po_id and status in ('sent', 'partially_received') and status <> v_status;
  end if;
  -- a completed purchase completes its requirement when every PR for it is received
  if new.status = 'received' and new.requirement_id is not null then
    if not exists (select 1 from public.procurement where requirement_id = new.requirement_id and status in ('created', 'dispatched')) then
      update public.purchase_requirements set status = 'completed' where id = new.requirement_id and status <> 'cancelled';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_procurement_sync_po on public.procurement;
create trigger trg_procurement_sync_po after update of status on public.procurement
  for each row execute function public.sync_po_status();

-- ================================================================================================
-- latest_market_prices(p_sku) — newest price per market for a fish, flagged stale
-- ================================================================================================
create or replace function public.latest_market_prices(p_sku_id uuid default null)
returns table (market text, sku_id uuid, english_name text, price_per_kg numeric, price_date date, prev_price_per_kg numeric, change_pct numeric, is_stale boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_stale int := public.get_setting_numeric('market_price_stale_days', 2)::int;
begin
  if not public.can_manage_procurement() then
    raise exception 'latest_market_prices: not permitted' using errcode = '42501';
  end if;
  return query
  with ranked as (
    select mp.*, row_number() over (partition by mp.market, mp.sku_id order by mp.price_date desc) as rn
      from public.market_prices mp
     where p_sku_id is null or mp.sku_id = p_sku_id
  )
  select a.market, a.sku_id, s.english_name, a.price_per_kg, a.price_date,
         b.price_per_kg,
         case when b.price_per_kg > 0 then round(100 * (a.price_per_kg - b.price_per_kg) / b.price_per_kg, 1) end,
         (current_date - a.price_date) > v_stale
    from ranked a
    join public.skus s on s.id = a.sku_id
    left join ranked b on b.market = a.market and b.sku_id = a.sku_id and b.rn = 2
   where a.rn = 1
   order by s.english_name, a.market;
end;
$$;
grant execute on function public.latest_market_prices(uuid) to authenticated;
