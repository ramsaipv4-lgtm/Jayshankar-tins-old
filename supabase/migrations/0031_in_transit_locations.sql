-- 0031_in_transit_locations.sql — Jayshankar V1 sprint
-- Adds the physical "in transit" stage the user described directly: the same thermocol/ice
-- containers used at rest in the warehouse also travel — inbound (vendor's pickup point to the
-- warehouse door) and outbound (warehouse to the buyer). Both are real locations stock can sit
-- at for real hours, not a data-entry nicety — fish can spoil during either leg, which is exactly
-- why they need their own trackable place rather than being invisibly folded into "already at
-- the warehouse" the moment a bill/sale is recorded.
--
-- Modeled as two new `locations.kind` values, one warehouse-scoped pair per warehouse (matching
-- how every location already requires a `warehouse_id`, D23/D29/migration 0006) — inbound
-- belongs to the DESTINATION warehouse, outbound to the SOURCE warehouse, both natural fits for
-- the existing shape. Auto-provisioned by a trigger on `warehouses` (this project's convention
-- for a structural invariant that must hold "no matter how the row gets created" — same reasoning
-- as migration 0030's task-reassignment trigger and the original apply_movement_to_batches) so
-- `WarehouseManagement.tsx`'s existing "+ Add warehouse" form needs zero changes to get this for
-- free; the 2 existing warehouses (Demo, Real Operations) are backfilled in this same migration.
--
-- This migration is deliberately the SMALL, non-blocking half of the user's request — the
-- locations themselves, safe to ship regardless of how the bigger half resolves. The receiving-
-- confirmation workflow (promised-at-pickup vs measured-at-arrival, finally building the
-- long-dormant `receiving_confirmations` from SPEC.md §4.2.15 — spec'd since the D-amendment,
-- never actually created per migration 0006's own comment) and the outbound checkout question
-- are held for a follow-up migration pending two real business-policy answers (see the decision
-- record for what's being asked and why they're genuinely not engineering calls).
--
-- IDEMPOTENT throughout. Run after 0001-0030.

alter table public.locations
  drop constraint if exists locations_kind_check;
alter table public.locations
  add constraint locations_kind_check
  check (kind in ('storage', 'display', 'freezer', 'warehouse', 'in_transit_inbound', 'in_transit_outbound', 'other'));

create or replace function public.provision_warehouse_transit_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.locations (name, display_name, kind, warehouse_id)
  values (
    new.name || '-transit-in', new.display_name || ' — in transit (inbound)',
    'in_transit_inbound', new.id
  )
  on conflict (name) do nothing;

  insert into public.locations (name, display_name, kind, warehouse_id)
  values (
    new.name || '-transit-out', new.display_name || ' — in transit (outbound)',
    'in_transit_outbound', new.id
  )
  on conflict (name) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_provision_warehouse_transit_locations on public.warehouses;
create trigger trg_provision_warehouse_transit_locations
  after insert on public.warehouses
  for each row
  execute function public.provision_warehouse_transit_locations();

-- Backfill: the 2 warehouses that already exist today (Demo Warehouse, Real Operations) predate
-- this trigger and need the same 2 locations each, added directly rather than by re-inserting
-- their warehouse row.
insert into public.locations (name, display_name, kind, warehouse_id)
select w.name || '-transit-in', w.display_name || ' — in transit (inbound)', 'in_transit_inbound', w.id
  from public.warehouses w
 where not exists (
   select 1 from public.locations l where l.warehouse_id = w.id and l.kind = 'in_transit_inbound'
 )
on conflict (name) do nothing;

insert into public.locations (name, display_name, kind, warehouse_id)
select w.name || '-transit-out', w.display_name || ' — in transit (outbound)', 'in_transit_outbound', w.id
  from public.warehouses w
 where not exists (
   select 1 from public.locations l where l.warehouse_id = w.id and l.kind = 'in_transit_outbound'
 )
on conflict (name) do nothing;
