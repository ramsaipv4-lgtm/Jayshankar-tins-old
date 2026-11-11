-- 0006_container_model.sql — Mode B foundation: warehouses, containers, bills
-- SPEC.md v2 §4.2.10–§4.2.14 (D21 containers, D23 multi-warehouse).
--
-- Sequencing note (logged in BUILDER-DECISIONS-REVIEW.md): AGENT-BRIEF.md's phase order says
-- "container model first, bills second" — but container_fills.bill_id is a NOT NULL FK to
-- bills.id (enforces the one-purchase-event-per-fill rule, §4.2.12), so bills must exist
-- BEFORE container_fills at the schema level regardless of build-phase framing. This migration
-- creates bills first for exactly that reason. receiving_confirmations (§4.2.15) is NOT in this
-- migration — nothing else has a hard FK dependency on it, so it's deferred to a later task,
-- matching AGENT-BRIEF's phase 2.
--
-- Idempotent: every CREATE is IF NOT EXISTS, every ALTER TABLE ADD COLUMN is IF NOT EXISTS,
-- the CHECK-constraint replacement uses DROP IF EXISTS + ADD, matching 0001_init.sql's
-- conventions. Safe to re-run.
--
-- Apply order: AFTER 0001–0005.

-- ============================================================
-- 1. warehouses (§4.2.10, D23) — multi-warehouse-ready schema, single row seeded for now
-- ============================================================

create table if not exists public.warehouses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  display_name  text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Seed exactly one warehouse for the current single-warehouse reality (D29).
-- A second warehouse is a second row here, added when it actually exists — not before.
insert into public.warehouses (name, display_name)
values ('main', 'Main Warehouse')
on conflict (name) do nothing;

-- ============================================================
-- 2. locations.warehouse_id (§4.2.6 revised, D23/D29) — backfill-safe NOT NULL add
-- Every existing row (the Mode A demo's storage/display/freezer seed) gets backfilled to
-- the single seeded warehouse before the NOT NULL constraint is applied — a naive
-- ADD COLUMN ... NOT NULL would fail outright against a table that already has rows.
-- ============================================================

alter table public.locations
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete restrict;

update public.locations
set warehouse_id = (select id from public.warehouses where name = 'main')
where warehouse_id is null;

alter table public.locations
  alter column warehouse_id set not null;

-- Locations retired vocabulary note (D29): 'display' and 'freezer' kind values stay valid on
-- the existing CHECK constraint (historical Mode A data uses them) — no new location of either
-- kind should be created going forward, per SPEC.md §2.5.1, but this migration does not rewrite
-- history. New code should treat 'warehouse' as the only kind it writes.
alter table public.locations
  drop constraint if exists locations_kind_check;
alter table public.locations
  add constraint locations_kind_check
  check (kind in ('storage', 'display', 'freezer', 'warehouse', 'other'));

-- ============================================================
-- 3. bills (§4.2.14, Problem A) — created before containers; see the sequencing note above
-- ============================================================

create table if not exists public.bills (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid not null references public.vendors(id) on delete restrict,
  vendor_bill_number  text,
  bill_date           date not null default current_date,
  total_amount        numeric(10,2) not null default 0 check (total_amount >= 0),
  share_status        text not null default 'not_shared' check (share_status in ('not_shared', 'shared')),
  shared_at           timestamptz,
  share_method        text check (share_method is null or share_method in ('pdf', 'whatsapp', 'email')),
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists bills_vendor_date_idx on public.bills (vendor_id, bill_date desc);

-- ============================================================
-- 4. batches.bill_id (§4.2.14) — nullable, backward compatible with pre-Mode-B rows
-- ============================================================

alter table public.batches
  add column if not exists bill_id uuid references public.bills(id) on delete set null;
create index if not exists batches_bill_idx on public.batches (bill_id) where bill_id is not null;

-- ============================================================
-- 5. containers (§4.2.11, D21) — physical, numbered, reusable thermocol containers
-- ============================================================

create table if not exists public.containers (
  id                uuid primary key default gen_random_uuid(),
  container_number  text not null,
  capacity_kg       numeric(5,2) not null check (capacity_kg in (5, 10, 15, 20, 25)),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Unique among ACTIVE containers only (a retired container's number can be reissued to its
-- replacement, per SPEC.md §4.2.11) — a partial unique index, not a table-wide unique constraint.
create unique index if not exists containers_number_active_uidx
  on public.containers (container_number) where active;

-- ============================================================
-- 6. container_fills (§4.2.12, D21) — one purchase event, one shelf-life clock
-- ============================================================

create table if not exists public.container_fills (
  id            uuid primary key default gen_random_uuid(),
  container_id  uuid not null references public.containers(id) on delete restrict,
  bill_id       uuid not null references public.bills(id) on delete restrict,
  location_id   uuid not null references public.locations(id) on delete restrict,
  filled_at     timestamptz not null default now(),
  kg_remaining  numeric(10,3) not null check (kg_remaining >= 0),
  expires_at    timestamptz not null,
  created_by    uuid references public.users(id) on delete set null
);
create index if not exists container_fills_container_idx on public.container_fills (container_id);
-- The container-sourced FIFO algorithm (SPEC.md §4.3.8) locks candidates ordered by
-- expires_at ASC within a location, only among fills that still have stock — this partial
-- index matches that access pattern exactly.
create index if not exists container_fills_expiry_idx
  on public.container_fills (location_id, expires_at)
  where kg_remaining > 0;

-- ============================================================
-- 7. container_fill_items (§4.2.13, D21) — a fill can span multiple batches/SKUs
-- ============================================================

create table if not exists public.container_fill_items (
  id                  uuid primary key default gen_random_uuid(),
  container_fill_id   uuid not null references public.container_fills(id) on delete restrict,
  batch_id            uuid not null references public.batches(id) on delete restrict,
  kg                  numeric(10,3) not null check (kg > 0)
);
create index if not exists container_fill_items_fill_idx on public.container_fill_items (container_fill_id);
create index if not exists container_fill_items_batch_idx on public.container_fill_items (batch_id);

-- ============================================================
-- 8. movements: container_fill_id + new kind values (§4.2.21, D21/D22)
-- 'repack' (§4.3.9) and 'reversal' (§4.3.11) join the existing 4 kinds.
-- ============================================================

alter table public.movements
  add column if not exists container_fill_id uuid references public.container_fills(id) on delete restrict;
create index if not exists movements_container_fill_idx
  on public.movements (container_fill_id) where container_fill_id is not null;

-- Don't assume the original inline CHECK's auto-generated name (movements_kind_check is
-- Postgres's default pattern, but assuming it and being wrong would silently stack two CHECK
-- constraints — the old, narrower one would keep blocking 'repack'/'reversal' with no error
-- anywhere, since ADD CONSTRAINT doesn't fail just because a same-column constraint already
-- exists under a different name). Find and drop it dynamically instead.
do $$
declare
  con record;
begin
  for con in
    select pgc.conname
    from pg_constraint pgc
    join pg_class rel on rel.oid = pgc.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'movements'
      and pgc.contype = 'c'
      and pg_get_constraintdef(pgc.oid) like '%kind%delivery_in%'
  loop
    execute format('alter table public.movements drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.movements
  add constraint movements_kind_check
  check (kind in ('delivery_in', 'transfer', 'sale', 'spoilage', 'repack', 'reversal'));

-- ============================================================
-- 9. Derived-availability helper (SPEC.md §4.2.11: "container availability is derived, not
-- stored") — a view, not a stored column, per D17. A container is available if no
-- container_fills row on it has kg_remaining > 0.
-- ============================================================

create or replace view public.container_availability
  with (security_invoker = true)
as
select
  c.id as container_id,
  c.container_number,
  c.capacity_kg,
  not exists (
    select 1 from public.container_fills cf
    where cf.container_id = c.id and cf.kg_remaining > 0
  ) as available
from public.containers c
where c.active;
