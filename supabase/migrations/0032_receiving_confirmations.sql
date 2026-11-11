-- 0032_receiving_confirmations.sql — Jayshankar V1 sprint
-- Builds the bigger half of the in-transit request (migration 0031 was the small half): the
-- "promised at pickup vs measured at arrival" workflow the user described directly — a bill is
-- created from the vendor's own claim (produce, type, quantity, quality) at the pickup point,
-- then re-measured once the fish physically reaches the warehouse door. This is SPEC.md
-- §4.2.15's `receiving_confirmations` — spec'd since the original D-amendment, confirmed
-- directly (not assumed) to have never actually been created in any migration; migration 0006's
-- own comment says so explicitly ("receiving_confirmations (§4.2.15) is NOT in this [migration]").
--
-- Built per-BATCH rather than per-bill as originally spec'd — a deliberate adaptation, not a
-- blind copy: D43 later gave bills N SKU lines (record_bill_delivery), so a single
-- `confirmed_weight_kg` per bill would blur which specific line actually had the discrepancy.
--
-- Two real business-policy answers gate this design, asked directly of the user rather than
-- guessed (the same class of question D49's refund-refusal question was):
--   1. "Case by case, reconciled by hand" — a physical/money split, deliberately kept separate:
--      `batches.kg`/`kg_remaining` (physical truth) DOES adjust to the confirmed/measured amount
--      — you cannot sell fish you don't physically have — but `bills.total_amount` (money owed
--      to the vendor) is NEVER auto-adjusted by this migration. A discrepancy is recorded and
--      surfaced (a new `delivery_discrepancy` notification to admins) for them to reconcile by
--      hand — exactly matching the answer, not silently picking a side for them.
--   2. Outbound transit needs no checkout stage — "today's one-step sale already matches
--      reality." Nothing in this migration touches record_container_sale or the outbound leg at
--      all; that answer is a no-op for schema, not a separate migration.
--
-- IDEMPOTENT throughout. Run after 0001-0031.

alter table public.movements
  drop constraint if exists movements_kind_check;
alter table public.movements
  add constraint movements_kind_check
  check (kind in ('delivery_in', 'transfer', 'sale', 'spoilage', 'repack', 'reversal', 'receiving_confirmed'));

create table if not exists public.receiving_confirmations (
  id                  uuid primary key default gen_random_uuid(),
  bill_id             uuid not null references public.bills(id) on delete restrict,
  batch_id            uuid not null references public.batches(id) on delete restrict,
  promised_kg         numeric(10,3) not null,
  confirmed_kg         numeric(10,3) not null,
  promised_sku_id     uuid not null references public.skus(id),
  confirmed_sku_id    uuid not null references public.skus(id),
  discrepancy_flag    boolean not null default false,
  notes               text,
  photo_status        text not null default 'none' check (photo_status in ('none', 'pending_upload', 'uploaded')),
  confirmed_by        uuid not null references public.users(id),
  confirmed_at        timestamptz not null default now()
);
create index if not exists receiving_confirmations_bill_idx on public.receiving_confirmations (bill_id);
create index if not exists receiving_confirmations_batch_idx on public.receiving_confirmations (batch_id);

alter table public.receiving_confirmations enable row level security;

drop policy if exists receiving_confirmations_select on public.receiving_confirmations;
create policy receiving_confirmations_select
  on public.receiving_confirmations
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );
-- No INSERT/UPDATE/DELETE policy — confirm_delivery_arrival() (SECURITY DEFINER) is the only
-- writer, same append-only-history shape as audit_log/notifications/check_ins.

create or replace function public.confirm_delivery_arrival(
  p_batch_id uuid,
  p_destination_location_id uuid,
  p_confirmed_kg numeric,
  p_confirmed_sku_id uuid default null,
  p_notes text default null,
  p_photo_status text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_batch record;
  v_source_kind text;
  v_source_warehouse_id uuid;
  v_dest_kind text;
  v_dest_warehouse_id uuid;
  v_final_sku_id uuid;
  v_discrepancy boolean;
  v_confirmation_id uuid := gen_random_uuid();
  v_vendor_name text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'confirm_delivery_arrival: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if p_confirmed_kg <= 0 then
    return jsonb_build_object('error', 'Confirmed kg must be positive');
  end if;
  if p_photo_status not in ('none', 'pending_upload', 'uploaded') then
    return jsonb_build_object('error', 'Invalid photo status');
  end if;

  select id, bill_id, sku_id, vendor_id, kg, kg_remaining, location_id
    into v_batch
    from public.batches
   where id = p_batch_id
   for update;

  if not found then
    return jsonb_build_object('error', 'Batch not found');
  end if;
  if v_batch.bill_id is null then
    return jsonb_build_object('error', 'This batch has no bill — nothing to confirm');
  end if;
  if v_batch.kg_remaining is distinct from v_batch.kg then
    return jsonb_build_object('error',
      'This batch already has activity against it (packed/sold/spoiled) — it can''t still be in transit');
  end if;

  select kind, warehouse_id into v_source_kind, v_source_warehouse_id
    from public.locations where id = v_batch.location_id;
  if v_source_kind is distinct from 'in_transit_inbound' then
    return jsonb_build_object('error', 'This batch is not sitting in an inbound-transit location — nothing to confirm');
  end if;

  select kind, warehouse_id into v_dest_kind, v_dest_warehouse_id
    from public.locations where id = p_destination_location_id;
  if v_dest_kind is null then
    return jsonb_build_object('error', 'Destination location not found');
  end if;
  if v_dest_kind in ('in_transit_inbound', 'in_transit_outbound') then
    return jsonb_build_object('error', 'Destination must be a real storage location, not another transit stage');
  end if;
  if v_dest_warehouse_id is distinct from v_source_warehouse_id then
    return jsonb_build_object('error',
      'Destination must be in the same warehouse this delivery is inbound to');
  end if;

  v_final_sku_id := coalesce(p_confirmed_sku_id, v_batch.sku_id);
  v_discrepancy := (p_confirmed_kg is distinct from v_batch.kg) or (v_final_sku_id is distinct from v_batch.sku_id);

  -- Physical truth adjusts (you can't sell fish you don't have); money does not — see header.
  update public.batches
     set location_id = p_destination_location_id,
         sku_id = v_final_sku_id,
         kg = p_confirmed_kg,
         kg_remaining = p_confirmed_kg
   where id = p_batch_id;

  insert into public.movements (
    kind, from_location_id, to_location_id, sku_id, kg, batch_id, occurred_at, created_by
  ) values (
    'receiving_confirmed', v_batch.location_id, p_destination_location_id, v_final_sku_id,
    p_confirmed_kg, p_batch_id, now(), v_user_id
  );

  insert into public.receiving_confirmations (
    id, bill_id, batch_id, promised_kg, confirmed_kg, promised_sku_id, confirmed_sku_id,
    discrepancy_flag, notes, photo_status, confirmed_by
  ) values (
    v_confirmation_id, v_batch.bill_id, p_batch_id, v_batch.kg, p_confirmed_kg, v_batch.sku_id,
    v_final_sku_id, v_discrepancy, p_notes, p_photo_status, v_user_id
  );

  if v_discrepancy then
    select name into v_vendor_name from public.vendors where id = v_batch.vendor_id;
    perform public.notify_admins('delivery_discrepancy', jsonb_build_object(
      'bill_id', v_batch.bill_id, 'batch_id', p_batch_id, 'vendor_name', v_vendor_name,
      'promised_kg', v_batch.kg, 'confirmed_kg', p_confirmed_kg,
      'sku_changed', v_final_sku_id is distinct from v_batch.sku_id
    ));
  end if;

  return jsonb_build_object(
    'confirmation_id', v_confirmation_id,
    'discrepancy_flag', v_discrepancy,
    'confirmed_kg', p_confirmed_kg,
    'promised_kg', v_batch.kg
  );
end;
$$;

grant execute on function public.confirm_delivery_arrival(uuid, uuid, numeric, uuid, text, text) to authenticated;
