-- 0028_complaint_restock_fix.sql — Jayshankar V1 sprint
-- Fixes a real bug the user found by asking the right question before it ever shipped:
-- resolve_customer_complaint (migration 0027) restored kg into the SAME container_fill row the
-- original sale drew from. But a container's physical box gets a brand-new container_fills row
-- every time it's (re)filled — the old row is never reused, just left inert at kg_remaining=0
-- (confirmed by reading record_container_fill's own source, migration 0007/0021/0024). If that
-- physical container had since been refilled with different fish, restoring kg into the OLD fill
-- row would make two fill rows claim stock in the same physical box at once — more kg than it
-- can physically hold. The same class of bug decision #74's own addendum deliberately avoided
-- when choosing which sale to reverse in the demo seed data, but missed guarding against here.
--
-- Also implements the shelf-life question asked in the same conversation: a returned-and-
-- confirmed-good fish is NOT restored with its original freshness intact — worst case, it sat
-- unrefrigerated with the customer, so its effective age is pessimistically extended for that
-- time before it's given a fresh batch row. p_unrefrigerated_multiplier (default 3) is a
-- deliberately adjustable POLICY number, not a scientifically derived constant — flagged as
-- such, not asserted as fact.
--
-- The redesigned restock mechanism, sidestepping containers entirely rather than patching the
-- reuse bug in place:
--   - kg_confirmed_good_restocked becomes ONE fresh `batches` row (not a restore into anything
--     old), attributed to the OLDEST batch the sale actually drew from (the most conservative
--     choice among possibly-several sources — a sale can span multiple batches via the two-
--     phase cascade, migration 0009), with delivered_at pessimistically back-dated using the
--     formula above. A `kind='reversal'` movement records it, container_fill_id always null —
--     it re-enters as plain, un-contained stock; a person can pack it into a real container
--     afterward via the normal record_container_fill flow if they want to, which will correctly
--     compute a fresh expires_at off the NEW, penalized delivered_at.
--   - kg_confirmed_bad gets NO movement and NO stock change at all now — it never re-enters
--     inventory (same as the rejected case), so a "spoilage" movement that touches no
--     kg_remaining would have been a movement in name only. It's recorded purely as a number on
--     the complaint row, which is where it already lived.
--   - Refund math is unchanged (confirmed-bad always refunded in full; confirmed-good-restocked
--     refunded minus the operation charge, floored at 0; rejected gets nothing).
--
-- See BUILDER-DECISIONS-REVIEW.md decision #77.
--
-- IDEMPOTENT: CREATE OR REPLACE for the new signature; DROP FUNCTION IF EXISTS for the old one.
-- This migration itself adds an 8th parameter (p_unrefrigerated_multiplier) to a function
-- that's already live with 7 — the EXACT same class of bug as decision #73
-- (record_container_sale): CREATE OR REPLACE only replaces an exact parameter-list match, so
-- adding a parameter here would otherwise create a second overload instead of replacing the
-- first, live, one migration after that exact lesson was learned. Caught before shipping, not
-- after. Run after 0001-0027.

drop function if exists public.resolve_customer_complaint(uuid, numeric, numeric, numeric, text, numeric, text);

create or replace function public.resolve_customer_complaint(
  p_complaint_id uuid,
  p_kg_confirmed_bad numeric default 0,
  p_kg_confirmed_good_restocked numeric default 0,
  p_kg_rejected_no_action numeric default 0,
  p_rejected_disposition text default null,
  p_operation_charge numeric default 0,
  p_resolution_notes text default null,
  p_unrefrigerated_multiplier numeric default 3
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
  v_source_batch record;
  v_new_batch_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_hours_to_sale numeric;
  v_hours_with_customer numeric;
  v_effective_age_hours numeric;
  v_new_delivered_at timestamptz;
  v_refund numeric;
  v_kg_sum numeric;
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
  if coalesce(p_unrefrigerated_multiplier, 1) < 1 then
    return jsonb_build_object('error', 'unrefrigerated_multiplier must be at least 1');
  end if;

  select id, sku_id, location_id, total_kg, sale_price_per_kg, sold_at
    into v_sale from public.sales where id = v_complaint.sale_id;

  if coalesce(p_kg_confirmed_good_restocked, 0) > 0 then
    -- The oldest batch the sale actually drew from — the most conservative attribution among
    -- possibly-several sources (a sale can span multiple batches via the container/direct
    -- two-phase cascade, migration 0009), and consistent with the "worst case" framing the
    -- shelf-life penalty below already uses.
    select b.id, b.sku_id, b.vendor_id, b.price_per_kg_paid, b.bill_id, b.delivered_at
      into v_source_batch
      from public.movements m
      join public.batches b on b.id = m.batch_id
     where m.sale_id = v_complaint.sale_id
     order by b.delivered_at asc
     limit 1;

    if v_source_batch.id is null then
      return jsonb_build_object('error', 'Could not find the original batch(es) this sale drew from');
    end if;

    -- Worst-case shelf-life penalty: normal (1x) aging up to the sale, then an ACCELERATED rate
    -- for the time it sat with the customer — p_unrefrigerated_multiplier is a policy choice,
    -- not a scientific constant, adjustable per resolution if there's a better estimate for
    -- this specific case (e.g. "it was only out for 10 minutes in the shade").
    v_hours_to_sale := greatest(0, extract(epoch from (v_sale.sold_at - v_source_batch.delivered_at)) / 3600.0);
    v_hours_with_customer := greatest(0, extract(epoch from (now() - v_sale.sold_at)) / 3600.0);
    v_effective_age_hours := v_hours_to_sale + (v_hours_with_customer * p_unrefrigerated_multiplier);
    v_new_delivered_at := now() - (v_effective_age_hours * interval '1 hour');

    v_new_batch_id := gen_random_uuid();
    insert into public.batches (
      id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at,
      bill_id, created_by
    ) values (
      v_new_batch_id, v_sale.sku_id, v_source_batch.vendor_id, v_sale.location_id,
      p_kg_confirmed_good_restocked, p_kg_confirmed_good_restocked, v_source_batch.price_per_kg_paid,
      v_new_delivered_at, v_source_batch.bill_id, v_user_id
    );

    -- container_fill_id deliberately null — this re-enters as plain, un-contained stock, not
    -- restored into any container (old or new). A person can pack it into a real container
    -- afterward via the normal record_container_fill flow if they want to; that path will
    -- correctly compute a fresh expires_at off this batch's own (penalized) delivered_at.
    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, sale_id,
      notes, occurred_at, created_by
    ) values (
      'reversal', null, v_sale.location_id, v_sale.sku_id, p_kg_confirmed_good_restocked,
      v_new_batch_id, v_group_id, v_complaint.sale_id,
      format('Returned, confirmed good — complaint %s (effective age %s h, %sx unrefrigerated penalty)',
        p_complaint_id, round(v_effective_age_hours, 1), p_unrefrigerated_multiplier),
      now(), v_user_id
    );
  end if;

  -- kg_confirmed_bad: no movement, no stock change — it never re-enters inventory (same as the
  -- rejected share), so a "spoilage" movement touching no kg_remaining would be a movement in
  -- name only. Recorded purely as a number on the complaint row below.

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
    spoilage_movement_group_id = null,
    restock_movement_group_id = case when coalesce(p_kg_confirmed_good_restocked, 0) > 0 then v_group_id else null end,
    resolved_by = v_user_id,
    resolved_at = now()
  where id = p_complaint_id;

  return jsonb_build_object('refund_amount', v_refund, 'complaint_id', p_complaint_id, 'new_batch_id', v_new_batch_id);
end;
$$;

grant execute on function public.resolve_customer_complaint(uuid, numeric, numeric, numeric, text, numeric, text, numeric) to authenticated;
