-- 0034_bill_reconciliation_and_credit_terms.sql — Jayshankar V1 sprint
-- Closes a real gap left by migration 0032/0033's receiving-confirmation work: that work
-- detects and NOTIFIES a promised-vs-measured discrepancy ("case by case, reconciled by hand"
-- was the user's own policy answer), but nothing ever let the admin actually RECORD what they
-- decided. This migration adds that missing "how it actually got settled" step, plus the
-- vendor-payment-terms distinction the user's own description implied (a credit purchase's
-- reconciliation can be deliberately DEFERRED, with a reminder, rather than done immediately).
--
-- `bills.payment_terms` ('cash'/'credit') — set at delivery time, defaults to 'cash' (today's
-- only behaviour, unchanged unless a rep actually picks credit). A credit bill's reconciliation
-- can be deferred; a cash bill has no real reason to be, though nothing stops it either.
--
-- `reconcile_bill()` is deliberately NOT the same thing as adjusting bills.total_amount (D54's
-- "never auto-adjusted" answer stands) — reconciled_total_amount is a SEPARATE, admin-entered
-- figure recording what was actually agreed/settled with the vendor after the fact, alongside
-- (not replacing) the original promised total_amount. Both stay on the record.
--
-- No pg_cron dependency for the reminder (this project has consistently held off on that
-- infrastructure — see D27 Track C, still not built) — a reminder that's come due is just a
-- plain query condition (reconciliation_reminder_at <= now() and reconciled_at is null),
-- surfaced wherever BillsManagement.tsx already loads, not a scheduled job pushing anything.
--
-- IDEMPOTENT throughout. Run after 0001-0033.

alter table public.bills
  add column if not exists payment_terms text not null default 'cash'
  check (payment_terms in ('cash', 'credit'));

alter table public.bills
  add column if not exists reconciled_total_amount numeric(10,2);
alter table public.bills
  add column if not exists reconciliation_notes text;
alter table public.bills
  add column if not exists reconciliation_reminder_at timestamptz;
alter table public.bills
  add column if not exists reconciled_at timestamptz;
alter table public.bills
  add column if not exists reconciled_by uuid references public.users(id);

-- record_bill_delivery has been LIVE at its 5-parameter signature since migration 0019 —
-- explicit DROP before adding p_payment_terms, guarding pre-emptively against the overload bug
-- this sprint has now hit or caught five separate times (decisions #73/#77/#80/#82 and this one).
drop function if exists public.record_bill_delivery(uuid, uuid, date, text, jsonb);

create or replace function public.record_bill_delivery(
  p_vendor_id uuid,
  p_location_id uuid,
  p_bill_date date default current_date,
  p_vendor_bill_number text default null,
  p_items jsonb default '[]'::jsonb,
  p_payment_terms text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_bill_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_item_count int := 0;
  v_batch_id uuid;
  v_batches jsonb := '[]'::jsonb;
  v_vendor_name text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'record_bill_delivery: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_vendor_id is null then
    return jsonb_build_object('error', 'Vendor is required');
  end if;
  if p_location_id is null then
    return jsonb_build_object('error', 'Location is required');
  end if;
  if p_payment_terms not in ('cash', 'credit') then
    return jsonb_build_object('error', 'Invalid payment terms');
  end if;
  if p_items is null or jsonb_typeof(p_items) != 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('error', 'At least one fish line is required');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_count := v_item_count + 1;

    if not (v_item ? 'sku_id') or not (v_item ? 'kg') or not (v_item ? 'price_per_kg_paid') then
      return jsonb_build_object('error', format('Line %s is missing a required field', v_item_count));
    end if;
    if (v_item->>'kg')::numeric <= 0 then
      return jsonb_build_object('error', format('Line %s: kg must be positive', v_item_count));
    end if;
    if (v_item->>'price_per_kg_paid')::numeric < 0 then
      return jsonb_build_object('error', format('Line %s: price cannot be negative', v_item_count));
    end if;
    if not exists (select 1 from public.skus where id = (v_item->>'sku_id')::uuid) then
      return jsonb_build_object('error', format('Line %s: SKU not found', v_item_count));
    end if;

    v_total := v_total + round((v_item->>'kg')::numeric * (v_item->>'price_per_kg_paid')::numeric, 2);
  end loop;

  insert into public.bills (id, vendor_id, vendor_bill_number, bill_date, total_amount, payment_terms, created_by)
  values (v_bill_id, p_vendor_id, p_vendor_bill_number, coalesce(p_bill_date, current_date), v_total, p_payment_terms, v_user_id);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_batch_id := gen_random_uuid();

    insert into public.batches (
      id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at,
      bill_id, created_by
    ) values (
      v_batch_id, (v_item->>'sku_id')::uuid, p_vendor_id, p_location_id,
      (v_item->>'kg')::numeric, (v_item->>'kg')::numeric, (v_item->>'price_per_kg_paid')::numeric,
      now(), v_bill_id, v_user_id
    );

    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, created_by
    ) values (
      'delivery_in', null, p_location_id, (v_item->>'sku_id')::uuid, (v_item->>'kg')::numeric,
      v_batch_id, v_group_id, v_user_id
    );

    v_batches := v_batches || jsonb_build_object(
      'batch_id', v_batch_id, 'sku_id', v_item->>'sku_id', 'kg', v_item->>'kg'
    );
  end loop;

  select name into v_vendor_name from public.vendors where id = p_vendor_id;
  perform public.notify_admins('bill_received', jsonb_build_object(
    'bill_id', v_bill_id, 'vendor_id', p_vendor_id, 'vendor_name', v_vendor_name, 'total_amount', v_total
  ));
  perform public.auto_complete_task('receive_delivery', v_user_id, p_vendor_id, null, v_bill_id, null);

  return jsonb_build_object(
    'bill_id', v_bill_id,
    'movement_group_id', v_group_id,
    'total_amount', v_total,
    'batches', v_batches
  );
end;
$$;

grant execute on function public.record_bill_delivery(uuid, uuid, date, text, jsonb, text) to authenticated;

create or replace function public.reconcile_bill(
  p_bill_id uuid,
  p_reconciled_total_amount numeric default null,
  p_notes text default null,
  p_remind_in_days int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'reconcile_bill: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.bills where id = p_bill_id) then
    return jsonb_build_object('error', 'Bill not found');
  end if;
  if p_remind_in_days is not null and p_remind_in_days <= 0 then
    return jsonb_build_object('error', 'Reminder must be at least 1 day out');
  end if;

  if p_remind_in_days is not null then
    -- Deferring, not settling yet — leaves reconciled_at null so it still shows as open.
    update public.bills
       set reconciliation_notes = coalesce(p_notes, reconciliation_notes),
           reconciliation_reminder_at = now() + (p_remind_in_days || ' days')::interval
     where id = p_bill_id;
    return jsonb_build_object('deferred_to', now() + (p_remind_in_days || ' days')::interval);
  end if;

  update public.bills
     set reconciled_total_amount = coalesce(p_reconciled_total_amount, reconciled_total_amount),
         reconciliation_notes = coalesce(p_notes, reconciliation_notes),
         reconciled_at = now(),
         reconciled_by = v_user_id,
         reconciliation_reminder_at = null
   where id = p_bill_id;

  return jsonb_build_object('reconciled_at', now());
end;
$$;

grant execute on function public.reconcile_bill(uuid, numeric, text, int) to authenticated;
