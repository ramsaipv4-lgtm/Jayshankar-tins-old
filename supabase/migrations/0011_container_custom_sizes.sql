-- 0011_container_custom_sizes.sql — D32: custom container sizes + a DELETE policy for containers
-- SPEC.md §4.2.11 / D32. See BUILDER-DECISIONS-REVIEW.md decision #44 for the full writeup.
--
-- Resolves the "box/container quantities" item SPEC.md's closing §D flagged as open: how many
-- containers the business owns, and of what sizes, turns out to be wholesaler-entered data
-- through the app, not a fixed spec fact — including custom sizes beyond the 5 presets
-- (5/10/15/20/25 kg). Quantities are a bulk-register convenience over individually-numbered
-- containers (§4.2.11 already requires per-box identity for the QR-tag idea and for
-- container_fills to track each physical box's own shelf-life clock) — this migration doesn't
-- add a "quantity" column anywhere; the frontend bulk-creates N ordinary containers.rows.
--
-- The "can't delete a container once fish has been put into it" rule needs NO new schema work —
-- container_fills.container_id has been ON DELETE RESTRICT since migration 0006. What's
-- actually missing is a DELETE policy on containers at all: none exists, so right now deletion
-- is impossible for EVERY container, including ones that were never filled (registered by
-- mistake, or retired before use). This migration adds one; the existing FK continues to do the
-- actual protecting.
--
-- No change needed for "editable" — containers_update_admin (existing RLS) already covers both
-- container_number and capacity_kg.
--
-- Idempotent, matching every prior migration's convention. Apply order: AFTER 0001–0010.

-- ============================================================
-- 1. containers.capacity_kg — replace the fixed-5-values CHECK with capacity_kg > 0
-- ============================================================

-- Don't assume the inline CHECK's auto-generated name (same discipline as decision #38's
-- movements_kind_check gotcha) — find and drop it dynamically.
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
      and rel.relname = 'containers'
      and pgc.contype = 'c'
      and pg_get_constraintdef(pgc.oid) like '%capacity_kg%'
  loop
    execute format('alter table public.containers drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.containers
  add constraint containers_capacity_positive
  check (capacity_kg > 0);

-- ============================================================
-- 2. containers DELETE policy (admin/co-admin, matching containers_update_admin's role scope)
-- ============================================================

drop policy if exists containers_delete_admin on public.containers;
create policy containers_delete_admin
  on public.containers
  for delete
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'));
