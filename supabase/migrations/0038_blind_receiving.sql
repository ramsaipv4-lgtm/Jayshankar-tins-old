-- 0038_blind_receiving.sql — Phase B step 1 (BACKEND-REQUIREMENTS §2.1)
-- The client's own handover rule: the person receiving fish sees receiving id, fish, expected kg,
-- physical kg, difference, quality and a photo — and NOT the supplier, the purchase price, the
-- supplier contact, or profit/margin.
--
-- The gap this closes (found by reading the shipped RLS, see docs/BACKEND-PHASE-B-STATUS.md):
-- batches and bills have `select ... using (true)` for every signed-in user, and batches carry
-- vendor_id and price_per_kg_paid. RLS is row-level, so the UI hiding a column hides nothing: any
-- signed-in worker could `select vendor_id, price_per_kg_paid from batches` from the browser.
--
-- Design (option 1 of the requirements doc, with a safety switch):
--   * A view  `batches_safe`  exposes only the columns a floor/receiving user needs.
--   * An RPC  `list_receiving_queue()` returns the receiving queue; vendor name and bill number
--     come back NULL for users who may not see them, so one screen serves everyone.
--   * The base-table SELECT policies on batches, bills, vendors and vendor_payments become
--     "allowed unless the switch is on and you are not allowed to see procurement money".
--   * The switch is app_settings.enforce_blind_receiving and ships OFF, so applying this migration
--     changes nothing until the receiving/floor screens have been moved to the view/RPC
--     (FloorDashboard, StockBySku, PackContainerForm, DeliveryConfirmation — see docs). An admin
--     turns it on with set_app_setting('enforce_blind_receiving', 'true').
--   * Who counts as blind: role 'worker' always; 'vendor-rep' and 'super-worker' when an admin has
--     set users.receiving_blind = true; 'admin' and 'co-admin' never.
--
-- supabase/rls-policies.sql carries the same four policies — it is re-runnable and would otherwise
-- re-create the permissive versions. Keep them in step.
--
-- IDEMPOTENT. Run after 0037.

-- ---- policies -------------------------------------------------------------------------------
drop policy if exists batches_select_authenticated on public.batches;
create policy batches_select_authenticated
  on public.batches for select to authenticated
  using (not public.blind_receiving_enforced() or public.can_view_procurement_money());

drop policy if exists bills_select_authenticated on public.bills;
create policy bills_select_authenticated
  on public.bills for select to authenticated
  using (not public.blind_receiving_enforced() or public.can_view_procurement_money());

drop policy if exists vendors_select_non_worker on public.vendors;
create policy vendors_select_non_worker
  on public.vendors for select to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
    and (not public.blind_receiving_enforced() or public.can_view_procurement_money())
  );

drop policy if exists vendor_payments_select_non_worker on public.vendor_payments;
create policy vendor_payments_select_non_worker
  on public.vendor_payments for select to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
    and (not public.blind_receiving_enforced() or public.can_view_procurement_money())
  );

-- receiving_confirmations carries per-lot promised kg plus bill_id and procurement_id, which would let
-- a blind receiver group fish by supplier without ever seeing a name. Same gate.
drop policy if exists receiving_confirmations_select on public.receiving_confirmations;
create policy receiving_confirmations_select
  on public.receiving_confirmations for select to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
    and (not public.blind_receiving_enforced() or public.can_view_procurement_money())
  );

-- ---- batches_safe ---------------------------------------------------------------------------
-- A plain view runs with its owner's rights, so it is NOT subject to the base table's RLS. That is
-- the point (it must keep working when the base policy hides the table) and the reason it exposes
-- only columns that are safe for every signed-in role. Never add vendor_id, bill_id's vendor,
-- price_per_kg_paid or anything derived from them.
create or replace view public.batches_safe as
select b.id,
       b.sku_id,
       b.location_id,
       b.kg,
       b.kg_remaining,
       b.delivered_at,
       b.created_at,
       'RCV-' || upper(substr(replace(b.id::text, '-', ''), 1, 6)) as short_code
  from public.batches b
 where auth.uid() is not null;

-- IMPORTANT: this project's default privileges (migration 0004) grant ALL on every new table AND
-- VIEW to `authenticated`, and a single-table view is auto-updatable. Because this view runs with
-- its owner's rights, those default grants would let any signed-in user UPDATE or DELETE batches
-- THROUGH the view, around the batches RLS write policies. So revoke everything, then grant SELECT.
revoke all on public.batches_safe from public, anon, authenticated;
grant select on public.batches_safe to authenticated;

-- ---- list_receiving_queue -------------------------------------------------------------------
-- What is on the road / at the door waiting to be weighed. Safe columns for everyone; vendor_name
-- and bill_number only for users who may see procurement money.
drop function if exists public.list_receiving_queue();
create or replace function public.list_receiving_queue()
returns table (
  source         text,          -- 'bill' (today's flow) | 'procurement' (0040)
  ref_id         uuid,          -- batch id or procurement id; pass to the confirm RPC
  short_code     text,          -- RCV-xxxxxx or the procurement's receiving code
  sku_id         uuid,
  english_name   text,
  tamil_name     text,
  expected_kg    numeric,
  location_id    uuid,
  location_name  text,
  arrived_at     timestamptz,
  vendor_name    text,          -- NULL unless can_view_procurement_money()
  bill_number    text           -- NULL unless can_view_procurement_money()
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_money boolean := public.can_view_procurement_money();
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'list_receiving_queue: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  return query
  select 'bill'::text,
         b.id,
         'RCV-' || upper(substr(replace(b.id::text, '-', ''), 1, 6)),
         b.sku_id,
         s.english_name,
         s.tamil_name,
         b.kg,
         b.location_id,
         l.display_name,
         b.created_at,
         case when v_money then v.name end,
         case when v_money then bl.vendor_bill_number end
    from public.batches b
    join public.locations l on l.id = b.location_id and l.kind = 'in_transit_inbound'
    join public.skus s on s.id = b.sku_id
    left join public.vendors v on v.id = b.vendor_id
    left join public.bills bl on bl.id = b.bill_id
   where b.bill_id is not null
   order by b.created_at;
end;
$$;
grant execute on function public.list_receiving_queue() to authenticated;
