-- rls-policies.sql — Jayshankar v1 RLS policies
-- Implements the spec §2.3–§2.12. Every tenant-scoped table has RLS enabled
-- with explicit policies for SELECT, INSERT, UPDATE, DELETE per role.
--
-- Roles (SPEC D3): admin, vendor-rep, worker, super-worker.
-- In V1 the UI collapses vendor-rep and worker into a "super-worker" view
-- (D3a), but the DB policies distinguish them strictly.
--
-- IDEMPOTENT: every policy uses DROP POLICY IF EXISTS + CREATE POLICY,
-- every ALTER TABLE … ENABLE ROW LEVEL SECURITY is a no-op when already
-- enabled. Re-running this file is safe.
--
-- Apply order: AFTER EVERY migration in supabase/migrations/ (it references tables and
-- functions from 0006-0034, and from 0037 onward the blind-receiving helpers
-- can_view_procurement_money() / blind_receiving_enforced()). Re-run it after adding migrations.
-- The batches / bills / vendors SELECT policies below are the same ones migration 0038 installs;
-- keep the two in step or a re-run will undo the other.

-- ============================================================
-- 0. Helper: public.current_user_role()
-- Returns the role of the currently authenticated user, or NULL
-- when no user is logged in. Used by every policy below.
-- Marked security definer so it can read public.users even when
-- the calling user lacks the privilege directly.
-- ============================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ============================================================
-- 1. audit_log — append-only, admin read, trigger write
-- SPEC §2.12.3. The trigger (security definer) bypasses RLS.
-- No INSERT, UPDATE, or DELETE policies for any role. The only
-- way to write is via the audit_trigger() function.
-- ============================================================

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'));

-- No INSERT/UPDATE/DELETE policies by design. The trigger bypasses RLS
-- because it is declared SECURITY DEFINER. A direct INSERT from any
-- authenticated role is denied because there is no INSERT policy.

-- ============================================================
-- 2. users — admin manages; everyone sees display names
-- SPEC §2.2. No DELETE (deactivate via active=false).
-- ============================================================

alter table public.users enable row level security;

drop policy if exists users_select_authenticated on public.users;
create policy users_select_authenticated
  on public.users
  for select
  to authenticated
  using (true);

drop policy if exists users_insert_admin on public.users;
create policy users_insert_admin
  on public.users
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists users_update_admin on public.users;
create policy users_update_admin
  on public.users
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy. Soft-delete via active=false.

-- ============================================================
-- 3. locations — admin manages; everyone reads
-- SPEC §2.5.3.
-- ============================================================

alter table public.locations enable row level security;

drop policy if exists locations_select_authenticated on public.locations;
create policy locations_select_authenticated
  on public.locations
  for select
  to authenticated
  using (true);

drop policy if exists locations_insert_admin on public.locations;
create policy locations_insert_admin
  on public.locations
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists locations_update_admin on public.locations;
create policy locations_update_admin
  on public.locations
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 4. vendors — admin manages; worker cannot see (SPEC §8.2a)
-- SPEC §2.3.4. SELECT for any authenticated EXCEPT worker.
-- INSERT/UPDATE for admin only. No DELETE.
-- ============================================================

alter table public.vendors enable row level security;

drop policy if exists vendors_select_non_worker on public.vendors;
create policy vendors_select_non_worker
  on public.vendors
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
    and (not public.blind_receiving_enforced() or public.can_view_procurement_money())   -- migration 0038
  );

drop policy if exists vendors_insert_admin on public.vendors;
create policy vendors_insert_admin
  on public.vendors
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists vendors_update_admin on public.vendors;
create policy vendors_update_admin
  on public.vendors
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy. Soft-delete via active=false.

-- ============================================================
-- 5. skus — admin manages; everyone reads
-- SPEC §2.4.4.
-- ============================================================

alter table public.skus enable row level security;

drop policy if exists skus_select_authenticated on public.skus;
create policy skus_select_authenticated
  on public.skus
  for select
  to authenticated
  using (true);

drop policy if exists skus_insert_admin on public.skus;
create policy skus_insert_admin
  on public.skus
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists skus_update_admin on public.skus;
create policy skus_update_admin
  on public.skus
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy. Soft-delete via active=false.

-- ============================================================
-- 6. batches — vendor-rep and admin create; admin updates
-- SPEC §2.6.5. Worker cannot record a delivery (no INSERT).
-- kg_remaining is updated by trigger, not by hand.
-- ============================================================

alter table public.batches enable row level security;

drop policy if exists batches_select_authenticated on public.batches;
create policy batches_select_authenticated
  on public.batches
  for select
  to authenticated
  using (not public.blind_receiving_enforced() or public.can_view_procurement_money());   -- migration 0038

drop policy if exists batches_insert_rep on public.batches;
create policy batches_insert_rep
  on public.batches
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists batches_update_admin on public.batches;
create policy batches_update_admin
  on public.batches
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 7. movements — role-restricted by kind
-- SPEC §2.7.5. Worker can only insert transfer + spoilage.
-- All authenticated can read. No UPDATE/DELETE.
-- ============================================================

alter table public.movements enable row level security;

drop policy if exists movements_select_authenticated on public.movements;
create policy movements_select_authenticated
  on public.movements
  for select
  to authenticated
  using (true);

-- INSERT, revised for the spec §2.7.5 (D29 repurposes 'transfer' to cross-warehouse-only,
-- an admin/co-admin-tier action; D21 adds 'repack' as explicitly worker-executable; D22 keeps
-- 'reversal' off every direct-INSERT path — see the note below):
--   delivery_in, sale  → vendor-rep, admin/co-admin only (never worker — unchanged from V1)
--   spoilage           → vendor-rep, admin/co-admin, worker (unchanged from V1)
--   repack             → vendor-rep, admin/co-admin, worker, super-worker (D21 — everyday
--                        warehouse operation now that there's one warehouse, D29)
--   transfer           → admin/co-admin ONLY (D29 — cross-warehouse, not a routine worker task
--                        anymore; doesn't run in practice until a 2nd warehouse exists)
--   reversal           → nobody, direct. Only ever written by the approved-execution path
--                        (D22/§4.3.11), a future SECURITY DEFINER function matching the
--                        existing record_transfer_cascade precedent (decision #23) — never a
--                        direct client INSERT for any role.
drop policy if exists movements_insert_role_checked on public.movements;
create policy movements_insert_role_checked
  on public.movements
  for insert
  to authenticated
  with check (
    (kind in ('delivery_in', 'sale')
       and public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker'))
    or
    (kind = 'spoilage'
       and public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker'))
    or
    (kind = 'repack'
       and public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker'))
    or
    (kind = 'transfer'
       and public.current_user_role() in ('admin', 'co-admin'))
  );

-- No UPDATE policy. Movements are immutable.
-- No DELETE policy. Corrections are admin-issued reverse movements (V2).

-- ============================================================
-- 8. sales — vendor-rep and admin create; admin updates
-- SPEC §2.8.4. No DELETE.
-- ============================================================

alter table public.sales enable row level security;

drop policy if exists sales_select_authenticated on public.sales;
create policy sales_select_authenticated
  on public.sales
  for select
  to authenticated
  using (true);

drop policy if exists sales_insert_rep on public.sales;
create policy sales_insert_rep
  on public.sales
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists sales_update_admin on public.sales;
create policy sales_update_admin
  on public.sales
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy. Soft-correction is admin-issued UPDATE on the sales row;
-- the underlying movements are not edited (D5 immutability).

-- ============================================================
-- 9. price_history — admin writes, everyone reads
-- SPEC §2.9.4. Price history is immutable: no UPDATE, no DELETE.
-- ============================================================

alter table public.price_history enable row level security;

drop policy if exists price_history_select_authenticated on public.price_history;
create policy price_history_select_authenticated
  on public.price_history
  for select
  to authenticated
  using (true);

drop policy if exists price_history_insert_admin on public.price_history;
create policy price_history_insert_admin
  on public.price_history
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No UPDATE policy. Corrections are new rows.
-- No DELETE policy.

-- ============================================================
-- 10. warehouses — admin/co-admin manages; everyone reads
-- the spec §4.2.10, D23. Same shape as locations (§3 above).
-- ============================================================

alter table public.warehouses enable row level security;

drop policy if exists warehouses_select_authenticated on public.warehouses;
create policy warehouses_select_authenticated
  on public.warehouses
  for select
  to authenticated
  using (true);

drop policy if exists warehouses_insert_admin on public.warehouses;
create policy warehouses_insert_admin
  on public.warehouses
  for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists warehouses_update_admin on public.warehouses;
create policy warehouses_update_admin
  on public.warehouses
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 11. bills — created at receiving (vendor-rep/admin/co-admin); admin/co-admin updates
-- the spec §4.2.14, D-amendment §B.5 (Problem A). Same INSERT shape as batches (§6 above) —
-- the purchase-record equivalent, created in the same receiving flow.
-- ============================================================

alter table public.bills enable row level security;

drop policy if exists bills_select_authenticated on public.bills;
create policy bills_select_authenticated
  on public.bills
  for select
  to authenticated
  using (not public.blind_receiving_enforced() or public.can_view_procurement_money());   -- migration 0038

drop policy if exists bills_insert_rep on public.bills;
create policy bills_insert_rep
  on public.bills
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

-- UPDATE: admin/co-admin only (e.g. share_status/shared_at/share_method when a bill is shared
-- back to the vendor — the spec §4.2.14). total_amount corrections are also admin/co-admin-gated,
-- matching batches' price-field-correction precedent.
drop policy if exists bills_update_admin on public.bills;
create policy bills_update_admin
  on public.bills
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 12. containers — the physical container registry
-- the spec §4.2.11, D21. Registered at receiving (vendor-rep/admin/co-admin), retired
-- (active=false) by admin/co-admin only.
-- ============================================================

alter table public.containers enable row level security;

drop policy if exists containers_select_authenticated on public.containers;
create policy containers_select_authenticated
  on public.containers
  for select
  to authenticated
  using (true);

drop policy if exists containers_insert_rep on public.containers;
create policy containers_insert_rep
  on public.containers
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists containers_update_admin on public.containers;
create policy containers_update_admin
  on public.containers
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy. Soft-retire via active=false.

-- ============================================================
-- 13. container_fills — created at receiving AND by repack (worker-executable, D21/§4.3.9)
-- the spec §4.2.12. INSERT is intentionally broader than batches' — repack means a worker
-- creates a destination fill directly, unlike batches which workers never insert.
-- kg_remaining maintenance (the FIFO cascade, repack's zero-out step) is expected to run
-- through a SECURITY DEFINER function once built (matching record_transfer_cascade,
-- decision #23) — the UPDATE policy below is the same safety-net shape batches.kg_remaining
-- uses (admin/co-admin-only direct UPDATE), not the primary mutation path.
-- ============================================================

alter table public.container_fills enable row level security;

drop policy if exists container_fills_select_authenticated on public.container_fills;
create policy container_fills_select_authenticated
  on public.container_fills
  for select
  to authenticated
  using (true);

drop policy if exists container_fills_insert_rep_or_worker on public.container_fills;
create policy container_fills_insert_rep_or_worker
  on public.container_fills
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker')
  );

drop policy if exists container_fills_update_admin on public.container_fills;
create policy container_fills_update_admin
  on public.container_fills
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 14. container_fill_items — immutable line items, same broad INSERT as container_fills
-- the spec §4.2.13. Written once at fill creation (receiving or repack), never edited.
-- ============================================================

alter table public.container_fill_items enable row level security;

drop policy if exists container_fill_items_select_authenticated on public.container_fill_items;
create policy container_fill_items_select_authenticated
  on public.container_fill_items
  for select
  to authenticated
  using (true);

drop policy if exists container_fill_items_insert_rep_or_worker on public.container_fill_items;
create policy container_fill_items_insert_rep_or_worker
  on public.container_fill_items
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker')
  );

-- No UPDATE policy. Line items are immutable once written.
-- No DELETE policy.

-- ============================================================
-- 15. customers — the spec §4.2.16. Broader INSERT/UPDATE than vendors (§2 above): a vendor-rep
-- registers and updates customers constantly in the field (D25 — an incomplete customer record
-- must never block a sale), unlike vendors, which are a more admin-gatekept, infrequently-
-- created asset. Deliberately not mirroring vendors' admin-only insert/update.
-- ============================================================

alter table public.customers enable row level security;

drop policy if exists customers_select_non_worker on public.customers;
create policy customers_select_non_worker
  on public.customers
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists customers_insert_rep on public.customers;
create policy customers_insert_rep
  on public.customers
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists customers_update_rep on public.customers;
create policy customers_update_rep
  on public.customers
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker'))
  with check (public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker'));

-- No DELETE policy — matches vendors' pattern; a customer relationship doesn't get destroyed,
-- follow_up_status moves to 'inactive' instead.

-- ============================================================
-- 16. payments — the spec §4.2.17. Append-only, same D5 spirit as sales/movements: a
-- mis-recorded payment is corrected with a new row, never an UPDATE/DELETE on the original.
-- ============================================================

alter table public.payments enable row level security;

drop policy if exists payments_select_non_worker on public.payments;
create policy payments_select_non_worker
  on public.payments
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists payments_insert_rep on public.payments;
create policy payments_insert_rep
  on public.payments
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

-- No UPDATE policy. No DELETE policy.

-- ============================================================
-- 17. reversal_requests — the spec §4.2.18, D22. Anyone who can make a sale can request its
-- reversal; only admin/co-admin can decide one (approve/deny) — matches §4.3.11's "admin/
-- co-admin reviews and sets status" exactly. Auto-approval for can_self_reverse users is
-- application/RPC-layer logic (§4.3.11 step 2), not an RLS policy — RLS can't see "is this the
-- requester's own row and do they have can_self_reverse" cheaply without a subquery per row,
-- and the actual execution (§4.3.11 step 4) needs a SECURITY DEFINER function regardless (it
-- restores kg_remaining, which no direct-INSERT path should ever touch).
-- ============================================================

alter table public.reversal_requests enable row level security;

drop policy if exists reversal_requests_select_non_worker on public.reversal_requests;
create policy reversal_requests_select_non_worker
  on public.reversal_requests
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists reversal_requests_insert_rep on public.reversal_requests;
create policy reversal_requests_insert_rep
  on public.reversal_requests
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists reversal_requests_update_admin on public.reversal_requests;
create policy reversal_requests_update_admin
  on public.reversal_requests
  for update
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

-- No DELETE policy.

-- ============================================================
-- 18. notifications — the spec §4.2.19, D27. A user's own inbox: visible and markable-read only
-- by its owner. No INSERT policy for any role — matches audit_log's trigger-only precedent
-- (migration 0001); a future notification-dispatch function writes these as SECURITY DEFINER,
-- bypassing RLS, the same way audit_trigger() does.
-- ============================================================

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT policy (system/trigger-only, see above). No DELETE policy.

-- ============================================================
-- 19. user_role_history — the spec §4.2.20, D27. Admin-only read, matching audit_log's own
-- precedent (migration 0001) — this is an audit-adjacent table, not a personal inbox. No
-- INSERT/UPDATE/DELETE policy for any role: only track_user_role_change() (migration 0012,
-- SECURITY DEFINER, fires on every users insert/update) writes to this table, the same
-- trigger-only pattern as audit_log.
-- ============================================================

alter table public.user_role_history enable row level security;

drop policy if exists user_role_history_select_admin on public.user_role_history;
create policy user_role_history_select_admin
  on public.user_role_history
  for select
  to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'));

-- No INSERT, UPDATE, or DELETE policy for any role — trigger-only, see above.

-- ============================================================
-- End of rls-policies.sql
-- ============================================================
