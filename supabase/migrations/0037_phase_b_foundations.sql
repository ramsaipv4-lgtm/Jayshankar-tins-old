-- 0037_phase_b_foundations.sql — Phase B (backend for the workflow picture book)
-- Source of the requirement list: docs/BACKEND-REQUIREMENTS-phase-b.md. This migration holds the
-- pieces every later Phase B migration leans on, plus one fix to something already shipped.
--
--   1. app_settings        - small key/value table for switches and tunable thresholds, so a
--                            business answer ("what counts as normal damage?") is a row, not a
--                            redeploy. Written only through set_app_setting().
--   2. users.receiving_blind - lets an admin make an individual vendor-rep / super-worker "blind"
--                            (the client's handover rule: whoever receives fish must not see the
--                            vendor or the purchase rate).
--   3. Role helpers        - can_view_procurement_money(), can_manage_procurement(). ONE place to
--                            change when the client decides whether the procurement team is a
--                            sixth role (BACKEND-REQUIREMENTS §2.7).
--   4. next_code()         - atomic, gap-free-per-year human codes: PR-2026-000125, PO-2026-000007.
--   5. Audit coverage fix  - docs and the Storybook say "every change tracked, no edits possible",
--                            but audit_trigger() was only ever attached to 8 tables (users,
--                            locations, vendors, skus, batches, movements, sales, price_history).
--                            Bills, payments, customers, containers, fills, vendor payments,
--                            receiving confirmations, reversal requests and complaints were NOT
--                            audited. Attached here. (tasks, check_ins and notifications are
--                            deliberately left out: operational noise, not a financial record.)
--
-- IDEMPOTENT throughout. Run after 0001-0036.

-- ============================================================
-- 1. app_settings
-- ============================================================
create table if not exists public.app_settings (
  key         text primary key,
  id          uuid not null unique default gen_random_uuid(),   -- audit_trigger() keys on id
  value       jsonb not null,
  description text,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select to authenticated using (true);
-- No INSERT/UPDATE/DELETE policy: set_app_setting() (SECURITY DEFINER) is the only writer.

insert into public.app_settings (key, value, description) values
  ('enforce_blind_receiving', 'false'::jsonb,
   'When true, batches/bills/vendors are hidden from users who may not see procurement money (see can_view_procurement_money). Turn on only after the receiving screens read batches_safe / list_receiving_queue().'),
  ('grading_tolerance_pct', '3'::jsonb,
   'PLACEHOLDER pending client Q1. Max gap, as % of received kg, between graded kg + shrink and the kg received before record_grading_run refuses the split.'),
  ('normal_damage_pct', '2'::jsonb,
   'PLACEHOLDER pending client answer. Damage at or below this % of a lot is treated as normal and does not raise a quality alert.'),
  ('quality_rejection_alert_pct', '5'::jsonb,
   'PLACEHOLDER. A vendor whose issues over the last 30 days exceed this % of kg received raises a quality alert.'),
  ('expiry_alert_hours', '6'::jsonb,
   'A container fill whose shelf life ends within this many hours raises an expiry alert.'),
  ('market_price_stale_days', '2'::jsonb,
   'A market with no price newer than this many days is reported as stale on the procurement dashboard.')
on conflict (key) do nothing;

create or replace function public.get_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  select value into v from public.app_settings where key = p_key;
  if v is null or jsonb_typeof(v) <> 'number' then return p_default; end if;
  return (v #>> '{}')::numeric;
end;
$$;

create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'set_app_setting: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_value is null then
    return jsonb_build_object('error', 'Value is required');
  end if;
  if not exists (select 1 from public.app_settings where key = p_key) then
    return jsonb_build_object('error', 'Unknown setting: ' || coalesce(p_key, '(null)'));
  end if;
  -- type-check: a stray string must not silently turn a switch off or fall back to a default
  if p_key = 'enforce_blind_receiving' and jsonb_typeof(p_value) <> 'boolean' then
    return jsonb_build_object('error', 'enforce_blind_receiving must be true or false (a JSON boolean, not a string)');
  end if;
  if p_key <> 'enforce_blind_receiving' then
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}') in ('NaN', 'Infinity', '-Infinity')
       or (p_value #>> '{}')::numeric < 0 then
      return jsonb_build_object('error', p_key || ' must be a number, zero or more');
    end if;
    if p_key like '%\_pct' and (p_value #>> '{}')::numeric > 100 then
      return jsonb_build_object('error', p_key || ' is a percentage and cannot exceed 100');
    end if;
  end if;
  update public.app_settings
     set value = p_value, updated_by = auth.uid(), updated_at = now()
   where key = p_key;
  return jsonb_build_object('key', p_key, 'value', p_value);
end;
$$;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;
grant execute on function public.get_setting_numeric(text, numeric) to authenticated;

-- ============================================================
-- 2. users.receiving_blind
-- ============================================================
alter table public.users
  add column if not exists receiving_blind boolean not null default false;

-- ============================================================
-- 3. Role helpers (plpgsql, so they bind late and survive column/table order in rls-policies.sql)
-- ============================================================
create or replace function public.can_view_procurement_money()
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare r text; blind boolean;
begin
  select role, receiving_blind into r, blind from public.users where id = auth.uid();
  if r is null then return false; end if;
  if r in ('admin', 'co-admin') then return true; end if;
  if r in ('vendor-rep', 'super-worker') then return not coalesce(blind, false); end if;
  return false;   -- 'worker' never sees vendor or rate
end;
$$;

create or replace function public.can_manage_procurement()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.can_view_procurement_money(); $$;
-- If the client later wants a dedicated procurement role (BACKEND-REQUIREMENTS §2.7), add it to
-- the allowed list in can_view_procurement_money() and nowhere else.

create or replace function public.blind_receiving_enforced()
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v jsonb;
begin
  select value into v from public.app_settings where key = 'enforce_blind_receiving';
  return coalesce(v = 'true'::jsonb, false);
end;
$$;

grant execute on function public.can_view_procurement_money() to authenticated;
grant execute on function public.can_manage_procurement() to authenticated;
grant execute on function public.blind_receiving_enforced() to authenticated;

-- ============================================================
-- 4. next_code — PR-2026-000125 style codes
-- ============================================================
create table if not exists public.code_counters (
  prefix     text not null,
  year       int  not null,
  last_value int  not null default 0,
  primary key (prefix, year)
);
alter table public.code_counters enable row level security;   -- no policies: definer-only

create or replace function public.next_code(p_prefix text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  v_n int;
begin
  insert into public.code_counters (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_value = public.code_counters.last_value + 1
  returning last_value into v_n;
  return format('%s-%s-%s', p_prefix, v_year, lpad(v_n::text, 6, '0'));
end;
$$;
revoke all on function public.next_code(text) from public, anon, authenticated;

-- ============================================================
-- 4b. Small helpers used by the reports (0043) and traces (0041)
-- ============================================================
create or replace function public._ist_day(p timestamptz) returns date
language sql immutable as $$ select (p at time zone 'Asia/Kolkata')::date $$;

-- A batch is a PURCHASE if it has a delivery_in movement. Batches created by a transfer
-- (record_transfer_cascade) or a complaint restock copy vendor and price from their source but are
-- not purchases; summing them into "bought" would double-count the fish.
create or replace function public._is_purchase_batch(p_batch_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.movements m where m.batch_id = p_batch_id and m.kind = 'delivery_in') $$;
create index if not exists movements_batch_kind_idx on public.movements (batch_id, kind);

-- ============================================================
-- 5. Audit coverage: attach audit_trigger() to the tables that were missing it
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'bills', 'payments', 'vendor_payments', 'customers', 'containers', 'container_fills',
    'container_fill_items', 'receiving_confirmations', 'reversal_requests',
    'customer_complaints', 'warehouses', 'app_settings'
  ] loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;
