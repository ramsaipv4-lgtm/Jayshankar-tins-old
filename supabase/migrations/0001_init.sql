-- 0001_init.sql — Jayshankar v1 schema
-- Implements SPEC.md §4.2 (9 tables), §4.3.5 (kg_remaining trigger),
-- §4.3.6 (audit trigger), §2.2.2 (handle_new_user trigger).
--
-- IDEMPOTENT: every statement uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP TRIGGER IF EXISTS + CREATE TRIGGER, so re-running this file is a
-- no-op. The validator's §8.1b check (SPEC.md) requires this.
--
-- Run order: applied automatically by `supabase db push` in lexical order.
-- This file is the V1 baseline; future schema changes go in
-- `<UTC-timestamp>_<description>.sql` per SPEC D2.

-- ============================================================
-- 0. Extensions
-- ============================================================

create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists btree_gist;   -- EXCLUDE on price_history

-- ============================================================
-- 1. users — app-side users, joined to auth.users by id
-- ============================================================

create table if not exists public.users (
  -- id is semantically equal to auth.users.id, but the FK is intentionally
  -- omitted to avoid a chicken-and-egg with the seed (we want to be able to
  -- insert public.users rows before the corresponding auth.users rows exist).
  -- The handle_new_user() trigger (defined below) creates the matching
  -- public.users row when a new auth.users row is created via signup. The
  -- handle_user_delete() trigger removes the public.users row when the
  -- auth.users row is deleted. Validator: §js-noauthfk.
  id            uuid primary key,
  email         text not null,
  phone         text,
  display_name  text not null,
  role          text not null check (role in ('admin', 'vendor-rep', 'worker', 'super-worker')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.users(id) on delete set null,
  updated_by    uuid references public.users(id) on delete set null
);
create index if not exists users_role_idx on public.users (role);

-- ============================================================
-- 2. locations — physical places where stock sits
-- ============================================================

create table if not exists public.locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  display_name  text not null,
  kind          text not null check (kind in ('storage', 'display', 'freezer', 'other')),
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 3. vendors — fishermen (separate from users; they don't log in)
-- ============================================================

create table if not exists public.vendors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  port_or_village text,
  boat_name       text,
  typical_catch   text,
  reliability     int2 not null default 3 check (reliability between 1 and 5),
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  updated_by      uuid references public.users(id) on delete set null
);
create index if not exists vendors_active_idx on public.vendors (active) where active;

-- ============================================================
-- 4. skus — fish catalog (one species at one size grade per row)
-- ============================================================

create table if not exists public.skus (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  english_name           text not null,
  tamil_name             text not null default '',
  category               text not null check (category in ('fin_fish', 'shellfish', 'crustacean', 'cephalopod', 'dried')),
  size_grade             text not null check (size_grade in ('small', 'medium', 'large', 'xl', 'mixed')),
  unit                   text not null default 'kg' check (unit in ('kg', 'piece', 'dozen')),
  shelf_life_hours       int4 not null default 24,
  storage_type           text not null default 'chilled' check (storage_type in ('chilled', 'frozen', 'ambient')),
  low_stock_threshold_kg numeric(10,2) not null default 5.00,
  active                 boolean not null default true,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references public.users(id) on delete set null,
  updated_by             uuid references public.users(id) on delete set null
);
create index if not exists skus_active_idx on public.skus (active) where active;
create index if not exists skus_category_idx on public.skus (category);

-- ============================================================
-- 5. batches — one delivery = one row
-- ============================================================

create table if not exists public.batches (
  id                 uuid primary key default gen_random_uuid(),
  sku_id             uuid not null references public.skus(id) on delete restrict,
  vendor_id          uuid not null references public.vendors(id) on delete restrict,
  location_id        uuid not null references public.locations(id) on delete restrict,
  kg                 numeric(10,3) not null check (kg > 0),
  kg_remaining       numeric(10,3) not null check (kg_remaining >= 0),
  price_per_kg_paid  numeric(10,2) not null check (price_per_kg_paid >= 0),
  delivered_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  created_by         uuid references public.users(id) on delete set null
);
create index if not exists batches_sku_loc_remaining_idx
  on public.batches (sku_id, location_id, delivered_at)
  where kg_remaining > 0;

-- ============================================================
-- 6. movements — the only way stock changes
-- ============================================================

create table if not exists public.movements (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('delivery_in', 'transfer', 'sale', 'spoilage')),
  from_location_id    uuid references public.locations(id) on delete restrict,
  to_location_id      uuid references public.locations(id) on delete restrict,
  sku_id              uuid not null references public.skus(id) on delete restrict,
  kg                  numeric(10,3) not null check (kg > 0),
  batch_id            uuid not null references public.batches(id) on delete restrict,
  movement_group_id   uuid not null,
  sale_id             uuid,
  notes               text,
  occurred_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  created_by          uuid references public.users(id) on delete set null,
  -- SPEC §4.2.6: at least one side of a movement must be a real location.
  -- NULL, NULL means "nowhere to nowhere" and is forbidden.
  constraint movements_locations_not_both_null
    check (not (from_location_id is null and to_location_id is null))
);
create index if not exists movements_group_idx on public.movements (movement_group_id);
create index if not exists movements_sku_occurred_idx on public.movements (sku_id, occurred_at desc);
create index if not exists movements_batch_idx on public.movements (batch_id);
create index if not exists movements_kind_idx on public.movements (kind);

-- ============================================================
-- 7. sales — sibling of movements; sales rows + cascaded movements
-- ============================================================

create table if not exists public.sales (
  id                uuid primary key default gen_random_uuid(),
  sku_id            uuid not null references public.skus(id) on delete restrict,
  location_id       uuid not null references public.locations(id) on delete restrict,
  customer_name     text not null,
  total_kg          numeric(10,3) not null check (total_kg > 0),
  sale_price_per_kg numeric(10,2) not null check (sale_price_per_kg > 0),
  total_amount      numeric(10,2) not null check (total_amount > 0),
  sold_by           uuid not null references public.users(id) on delete restrict,
  sold_at           timestamptz not null default now(),
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists sales_sku_sold_at_idx on public.sales (sku_id, sold_at desc);
create index if not exists sales_customer_idx on public.sales (customer_name);

-- Now that sales exists, link the movements.sale_id FK (deferred from §6).
alter table public.movements
  drop constraint if exists movements_sale_id_fkey;
alter table public.movements
  add constraint movements_sale_id_fkey
  foreign key (sale_id) references public.sales(id) on delete set null;

-- ============================================================
-- 8. price_history — reference prices per SKU per date range
-- ============================================================

create table if not exists public.price_history (
  id              uuid primary key default gen_random_uuid(),
  sku_id          uuid not null references public.skus(id) on delete restrict,
  price_per_kg    numeric(10,2) not null check (price_per_kg > 0),
  effective_from  date not null,
  effective_to    date,
  set_by          uuid not null references public.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  -- SPEC §4.2.8: at most one current price per SKU. Date ranges must not overlap.
  -- We model "currently effective" with a daterange and require non-overlap.
  constraint price_history_dates_valid check (
    effective_to is null or effective_to >= effective_from
  )
);

-- The non-overlap constraint uses btree_gist (enabled at top of file).
-- The exclusion ensures no two rows for the same SKU have overlapping
-- effective date ranges. Open-ended ranges (effective_to IS NULL) are
-- represented by 'infinity' as the upper bound.
create extension if not exists btree_gist;  -- idempotent guard
alter table public.price_history
  drop constraint if exists price_history_no_overlap;
alter table public.price_history
  add constraint price_history_no_overlap
  exclude using gist (
    sku_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  );

-- ============================================================
-- 9. audit_log — append-only, written by trigger only
-- ============================================================

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete set null,
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name   text not null,
  row_id       uuid not null,
  before_json  jsonb,
  after_json   jsonb,
  at           timestamptz not null default now()
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index if not exists audit_log_user_idx on public.audit_log (user_id);

-- ============================================================
-- 10. Trigger function: audit_trigger
-- SPEC §4.3.6. security definer so it can write even when the
-- calling user lacks INSERT on audit_log directly.
-- ============================================================

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_user uuid;
  audit_row jsonb;
begin
  audit_user := auth.uid();
  if (tg_op = 'INSERT') then
    audit_row := to_jsonb(new);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'INSERT', tg_table_name, (new).id, null, audit_row);
    return new;
  elsif (tg_op = 'UPDATE') then
    audit_row := to_jsonb(new);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'UPDATE', tg_table_name, (new).id, to_jsonb(old), audit_row);
    return new;
  elsif (tg_op = 'DELETE') then
    audit_row := to_jsonb(old);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'DELETE', tg_table_name, (old).id, audit_row, null);
    return old;
  end if;
  return null;
end;
$$;

-- ============================================================
-- 11. Trigger function: apply_movement_to_batches
-- SPEC §4.3.5. Safety net for the simple case (one movement,
-- one source batch). The cascade (multi-batch) is application-level.
-- ============================================================

create or replace function public.apply_movement_to_batches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('transfer', 'sale', 'spoilage') and new.from_location_id is not null then
    update public.batches
       set kg_remaining = kg_remaining - new.kg
     where id = new.batch_id;
  end if;
  -- 'delivery_in' and 'transfer' with a fresh destination batch are not
  -- touched here: the delivery inserts the batch with kg_remaining = kg,
  -- and the transfer's destination batch is created at app level before
  -- the movement row is inserted.
  return new;
end;
$$;

drop trigger if exists trg_movements_apply on public.movements;
create trigger trg_movements_apply
  after insert on public.movements
  for each row execute function public.apply_movement_to_batches();

-- ============================================================
-- 12. Audit triggers on every audited table (SPEC §2.12.2)
-- Per SPEC D5: the audit log is append-only. Only the trigger
-- function (security definer) writes; RLS denies direct INSERT.
-- ============================================================

-- Helper: drop-then-create is the only way to make CREATE TRIGGER
-- idempotent. PostgreSQL has no CREATE TRIGGER IF NOT EXISTS.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'users', 'locations', 'vendors', 'skus',
      'batches', 'movements', 'sales', 'price_history'
    ])
  loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%I_audit after insert or update or delete on public.%I '
      'for each row execute function public.audit_trigger()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 13. handle_new_user — first signup becomes admin
-- SPEC §2.2.2. Trigger on auth.users. Runs as SECURITY DEFINER so
-- it can write to public.users regardless of the caller's role.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.users;
  if user_count = 0 then
    insert into public.users (id, email, role, created_at)
    values (new.id, new.email, 'admin', now());
  else
    insert into public.users (id, email, role, created_at)
    values (new.id, coalesce(new.email, ''), 'worker', now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 13b. handle_user_delete — keeps public.users in sync when auth.users
-- is deleted. Required because we deliberately dropped the FK on
-- public.users.id (see the table comment above); without this trigger
-- deleting an auth.users row would leave an orphan public.users row.
-- ============================================================

create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_handle_user_delete on auth.users;
create trigger trg_handle_user_delete
  after delete on auth.users
  for each row execute function public.handle_user_delete();

-- ============================================================
-- End of 0001_init.sql
-- ============================================================
