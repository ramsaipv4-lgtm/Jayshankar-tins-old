-- 0027_customer_complaints.sql — Jayshankar V1 sprint
-- A real design conversation first, not a guess: the user worked through the disposition of a
-- returned sale (genuine claim → disposed; false claim, fish still fresh → resold, ideally at
-- the front of the queue; partial recovery → split) and the money (refund minus an optional
-- operation charge, net zero/positive/negative depending on the verdict), then confirmed
-- directly that a false claim CAN be refused outright by the admin, not always refunded. See
-- BUILDER-DECISIONS-REVIEW.md decision #75.
--
-- The core design choice: every returned kg is handled by REUSING existing mechanisms, not
-- inventing new ones —
--   1. The "confirmed good" and "confirmed bad" portions are BOTH restored to their original
--      batch/container_fill first (kind='reversal', proportional across every movement the sale
--      actually drew from — mirrors execute_sale_reversal's own loop, migration 0016, scaled by
--      a ratio instead of the full amount). This preserves the fish's REAL age (delivered_at/
--      expires_at never reset) — the same "never make it look fresher than it is" principle
--      repack (0008) and the transfer fix (0010) already use. It also answers "should returned-
--      but-fine stock be highest priority to resell": yes, automatically — restoring it with its
--      true (older) age means the EXISTING FIFO/soonest-expiring-first cascade already puts it
--      first in line, no new priority field needed.
--   2. The "confirmed bad" share is then immediately spoiled back OUT again (kind='spoilage',
--      same proportional math) — restored-then-spoiled, not silently vanished, so the audit
--      trail reads "came back, then was disposed," matching D5's append-only spirit.
--   3. The "rejected" share touches no stock at all — the fish either stays with the customer or
--      is disposed outside the business's tracked inventory; either way it never re-enters
--      `batches`/`container_fills`.
--   4. The refund is a `payments` row, not a new ledger — a refund reduces what's owed in the
--      exact same direction a cash payment does, so `customer_credit_status`'s existing
--      `total_amount - sum(payments.amount)` math needs zero changes to account for it (D17's
--      "derived, not stored" spirit — reuse the mechanism, don't parallel it). Confirmed-bad kg
--      is always refunded in full (never the customer's fault, no operation charge); confirmed-
--      good-but-accepted kg is refunded minus the operation charge, floored at 0 (a charge can
--      zero a refund, never turn it negative); rejected kg gets nothing.
--
-- IDEMPOTENT: CREATE OR REPLACE / IF NOT EXISTS throughout. Run after 0001-0026.

alter table public.payments
  drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method is null or method in ('cash', 'upi', 'bank_transfer', 'other', 'return_credit'));

create table if not exists public.customer_complaints (
  id                              uuid primary key default gen_random_uuid(),
  sale_id                         uuid not null references public.sales(id) on delete restrict,
  customer_id                     uuid references public.customers(id) on delete set null,
  kg_returned                     numeric(10,3) not null check (kg_returned > 0),
  claim_description               text,
  status                          text not null default 'pending' check (status in ('pending', 'resolved')),

  kg_confirmed_bad                numeric(10,3),
  kg_confirmed_good_restocked     numeric(10,3),
  kg_rejected_no_action           numeric(10,3),
  rejected_disposition            text check (rejected_disposition is null or rejected_disposition in ('returned_to_customer', 'disposed')),
  operation_charge                numeric(10,2),
  refund_amount                   numeric(10,2),
  resolution_notes                text,
  spoilage_movement_group_id      uuid,
  restock_movement_group_id       uuid,

  reported_by                     uuid references public.users(id) on delete set null,
  resolved_by                     uuid references public.users(id) on delete set null,
  resolved_at                     timestamptz,
  created_at                      timestamptz not null default now()
);
create index if not exists customer_complaints_sale_idx on public.customer_complaints (sale_id);
create index if not exists customer_complaints_customer_idx on public.customer_complaints (customer_id);

alter table public.customer_complaints enable row level security;

drop policy if exists customer_complaints_select_non_worker on public.customer_complaints;
create policy customer_complaints_select_non_worker
  on public.customer_complaints
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

-- No INSERT/UPDATE/DELETE policy for any role — file_customer_complaint()/
-- resolve_customer_complaint() below (both SECURITY DEFINER) are the only writers, so "who can
-- file" and "who can resolve" are each enforced in exactly one place. Resolving touches stock
-- and money, so it needs the same admin/co-admin-only boundary reversal decisions already use;
-- a plain UPDATE policy couldn't express "only via this exact validated resolution," an RPC can.

create or replace function public.file_customer_complaint(
  p_sale_id uuid,
  p_kg_returned numeric,
  p_claim_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_complaint_id uuid := gen_random_uuid();
  v_sale record;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'file_customer_complaint: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  select id, customer_id, total_kg into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then
    return jsonb_build_object('error', 'Sale not found');
  end if;
  if p_kg_returned is null or p_kg_returned <= 0 or p_kg_returned > v_sale.total_kg then
    return jsonb_build_object('error', format(
      'kg_returned must be between 0 and the sale''s total_kg (%s)', round(v_sale.total_kg, 3)));
  end if;

  insert into public.customer_complaints (id, sale_id, customer_id, kg_returned, claim_description, reported_by)
  values (v_complaint_id, p_sale_id, v_sale.customer_id, p_kg_returned, p_claim_description, v_user_id);

  return jsonb_build_object('complaint_id', v_complaint_id);
end;
$$;

grant execute on function public.file_customer_complaint(uuid, numeric, text) to authenticated;

create or replace function public.resolve_customer_complaint(
  p_complaint_id uuid,
  p_kg_confirmed_bad numeric default 0,
  p_kg_confirmed_good_restocked numeric default 0,
  p_kg_rejected_no_action numeric default 0,
  p_rejected_disposition text default null,
  p_operation_charge numeric default 0,
  p_resolution_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_complaint record;
  v_sale record;
  v_restore_group_id uuid := gen_random_uuid();
  v_spoil_group_id uuid := gen_random_uuid();
  v_original record;
  v_restore_ratio numeric;
  v_restore_kg numeric;
  v_spoil_kg numeric;
  v_refund numeric;
  v_kg_sum numeric;
  v_any_restore boolean := false;
  v_any_spoil boolean := false;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'resolve_customer_complaint: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  select * into v_complaint from public.customer_complaints where id = p_complaint_id for update;
  if v_complaint.id is null then
    return jsonb_build_object('error', 'Complaint not found');
  end if;
  if v_complaint.status = 'resolved' then
    return jsonb_build_object('error', 'This complaint has already been resolved');
  end if;

  if p_rejected_disposition is not null and p_rejected_disposition not in ('returned_to_customer', 'disposed') then
    return jsonb_build_object('error', 'Invalid rejected_disposition');
  end if;
  if coalesce(p_kg_rejected_no_action, 0) > 0 and p_rejected_disposition is null then
    return jsonb_build_object('error', 'rejected_disposition is required when any kg is rejected');
  end if;

  v_kg_sum := coalesce(p_kg_confirmed_bad, 0) + coalesce(p_kg_confirmed_good_restocked, 0) + coalesce(p_kg_rejected_no_action, 0);
  if abs(v_kg_sum - v_complaint.kg_returned) > 0.001 then
    return jsonb_build_object('error', format(
      'kg_confirmed_bad + kg_confirmed_good_restocked + kg_rejected_no_action (%s) must equal kg_returned (%s)',
      round(v_kg_sum, 3), round(v_complaint.kg_returned, 3)));
  end if;
  if coalesce(p_operation_charge, 0) < 0 then
    return jsonb_build_object('error', 'operation_charge cannot be negative');
  end if;

  select id, total_kg, sale_price_per_kg into v_sale from public.sales where id = v_complaint.sale_id;

  -- Restore (proportionally, across every original movement) whatever fraction of the sale is
  -- confirmed-good-or-bad — both need to physically come back before the bad share can be
  -- spoiled back out again in the same loop.
  v_restore_ratio := (coalesce(p_kg_confirmed_good_restocked, 0) + coalesce(p_kg_confirmed_bad, 0)) / nullif(v_sale.total_kg, 0);

  if coalesce(v_restore_ratio, 0) > 0 then
    for v_original in select * from public.movements where sale_id = v_complaint.sale_id for update loop
      v_restore_kg := round(v_original.kg * v_restore_ratio, 3);
      if v_restore_kg > 0 then
        v_any_restore := true;
        insert into public.movements (
          kind, from_location_id, to_location_id, sku_id, kg, batch_id, container_fill_id,
          movement_group_id, sale_id, notes, occurred_at, created_by
        ) values (
          'reversal', null, v_original.from_location_id, v_original.sku_id, v_restore_kg,
          v_original.batch_id, v_original.container_fill_id, v_restore_group_id, v_complaint.sale_id,
          'Return — complaint ' || p_complaint_id, now(), v_user_id
        );

        update public.batches set kg_remaining = kg_remaining + v_restore_kg where id = v_original.batch_id;
        if v_original.container_fill_id is not null then
          update public.container_fills set kg_remaining = kg_remaining + v_restore_kg where id = v_original.container_fill_id;
        end if;
      end if;

      -- The confirmed-bad share of THIS SAME movement goes straight back out as spoilage, in
      -- the same proportion — restored then spoiled, not silently vanished.
      if coalesce(p_kg_confirmed_bad, 0) > 0 then
        v_spoil_kg := round(v_original.kg * (p_kg_confirmed_bad / nullif(v_sale.total_kg, 0)), 3);
        if v_spoil_kg > 0 then
          v_any_spoil := true;
          insert into public.movements (
            kind, from_location_id, to_location_id, sku_id, kg, batch_id, container_fill_id,
            movement_group_id, notes, occurred_at, created_by
          ) values (
            'spoilage', v_original.from_location_id, null, v_original.sku_id, v_spoil_kg,
            v_original.batch_id, v_original.container_fill_id, v_spoil_group_id,
            'Confirmed bad on return — complaint ' || p_complaint_id, now(), v_user_id
          );
          update public.batches set kg_remaining = kg_remaining - v_spoil_kg where id = v_original.batch_id;
          if v_original.container_fill_id is not null then
            update public.container_fills set kg_remaining = kg_remaining - v_spoil_kg where id = v_original.container_fill_id;
          end if;
        end if;
      end if;
    end loop;
  end if;

  v_refund := round(
    (coalesce(p_kg_confirmed_bad, 0) * v_sale.sale_price_per_kg)
    + greatest(0, coalesce(p_kg_confirmed_good_restocked, 0) * v_sale.sale_price_per_kg - coalesce(p_operation_charge, 0)),
    2
  );

  if v_refund > 0 then
    insert into public.payments (sale_id, amount, method, recorded_by, notes)
    values (v_complaint.sale_id, v_refund, 'return_credit', v_user_id, 'Refund — complaint ' || p_complaint_id);
  end if;

  update public.customer_complaints set
    status = 'resolved',
    kg_confirmed_bad = coalesce(p_kg_confirmed_bad, 0),
    kg_confirmed_good_restocked = coalesce(p_kg_confirmed_good_restocked, 0),
    kg_rejected_no_action = coalesce(p_kg_rejected_no_action, 0),
    rejected_disposition = p_rejected_disposition,
    operation_charge = coalesce(p_operation_charge, 0),
    refund_amount = v_refund,
    resolution_notes = p_resolution_notes,
    spoilage_movement_group_id = case when v_any_spoil then v_spoil_group_id else null end,
    restock_movement_group_id = case when v_any_restore then v_restore_group_id else null end,
    resolved_by = v_user_id,
    resolved_at = now()
  where id = p_complaint_id;

  return jsonb_build_object('refund_amount', v_refund, 'complaint_id', p_complaint_id);
end;
$$;

grant execute on function public.resolve_customer_complaint(uuid, numeric, numeric, numeric, text, numeric, text) to authenticated;

-- customer_complaint_summary — answers "how many false claims have we accepted from this
-- buyer," directly from the request that started this conversation. A complaint counts as
-- "false" when nothing in it was ever confirmed bad (kg_confirmed_bad = 0) — covers both the
-- fully-false-accepted and fully-rejected cases; a partial complaint (some kg genuinely bad)
-- counts as genuine, not false, even if part of it was also fine.
create or replace view public.customer_complaint_summary
  with (security_invoker = true)
as
select
  c.id as customer_id,
  c.name,
  count(cc.id) filter (where cc.status = 'resolved') as total_resolved_complaints,
  count(cc.id) filter (where cc.status = 'resolved' and coalesce(cc.kg_confirmed_bad, 0) = 0) as false_claim_count,
  count(cc.id) filter (where cc.status = 'resolved' and coalesce(cc.kg_confirmed_bad, 0) > 0) as genuine_claim_count
from public.customers c
left join public.customer_complaints cc on cc.customer_id = c.id
group by c.id, c.name;
