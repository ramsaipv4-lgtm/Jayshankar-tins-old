-- 0041_quality_and_traceability.sql — Phase B (BACKEND-REQUIREMENTS §2.3, §2.4, §5)
-- Chapters 12 and 13 of the picture book: "One ID from boat to bill" and "Which vendor sent this?".
--
--   quality_issues            the receiving screen's Quality Issue button: bad smell, soft flesh,
--                             damaged, old stock, size mismatch, weight, ice/water, other — with kg
--                             affected and a photo. Raised by whoever is at the dock (no supplier
--                             is known or shown to them).
--   vendor_quality_scorecard  admin-side rollup per supplier: kg received, issues, kg affected,
--                             spoiled-at-door, shortfall, customer complaints. A FUNCTION, not a
--                             view: a plain view runs with its owner's rights and would ignore RLS,
--                             and this data must never reach the receiving role.
--   trace_batch / trace_sale  answer "the customer complained - whose fish was it?" by walking
--                             PR -> RCV -> BATCH -> SALE -> CUSTOMER.
--
-- The honesty limit (requirements §2.4), enforced in the numbers rather than the copy: an issue
-- raised against a mixed truck load cannot be pinned on one supplier, so its kg is spread over that
-- fish's lots on the truck PRO RATA to expected kg, and trace_* return `mixed_with` and an explicit
-- note whenever a batch is a pro-rata share. The scorecard therefore says "allocated", not "caused".
--
-- IDEMPOTENT. Run after 0040.

create table if not exists public.quality_issues (
  id             uuid primary key default gen_random_uuid(),
  truck_load_id  uuid references public.truck_loads(id) on delete restrict,
  batch_id       uuid references public.batches(id) on delete restrict,
  sku_id         uuid not null references public.skus(id),
  issue_type     text not null check (issue_type in
                   ('bad_smell', 'soft_flesh', 'damaged', 'old_stock', 'size_mismatch', 'weight_issue', 'ice_water_issue', 'other')),
  kg_affected    numeric(10,3) not null check (kg_affected >= 0),
  photo_url      text,
  note           text,
  status         text not null default 'open' check (status in ('open', 'resolved')),
  raised_by      uuid not null references public.users(id),
  raised_at      timestamptz not null default now(),
  resolved_by    uuid references public.users(id),
  resolved_at    timestamptz,
  resolution_note text,
  constraint quality_issue_has_target check (truck_load_id is not null or batch_id is not null)
);
create index if not exists quality_issues_truck_idx on public.quality_issues (truck_load_id);
create index if not exists quality_issues_batch_idx on public.quality_issues (batch_id);
create index if not exists quality_issues_raised_idx on public.quality_issues (raised_at);

alter table public.quality_issues enable row level security;
drop policy if exists quality_issues_select_receivers on public.quality_issues;
create policy quality_issues_select_receivers on public.quality_issues for select to authenticated
  using (public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker'));
-- writes only through raise_quality_issue / resolve_quality_issue

drop trigger if exists trg_quality_issues_audit on public.quality_issues;
create trigger trg_quality_issues_audit after insert or update or delete on public.quality_issues
  for each row execute function public.audit_trigger();

create or replace function public.raise_quality_issue(
  p_issue_type text,
  p_kg_affected numeric,
  p_truck_load_id uuid default null,
  p_batch_id uuid default null,
  p_sku_id uuid default null,
  p_photo_url text default null,
  p_note text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_id uuid := gen_random_uuid();
  v_batch record;
  v_tl uuid := p_truck_load_id;
  v_sku uuid := p_sku_id;
  v_code text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'raise_quality_issue: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_issue_type not in ('bad_smell', 'soft_flesh', 'damaged', 'old_stock', 'size_mismatch', 'weight_issue', 'ice_water_issue', 'other') then
    return jsonb_build_object('error', 'Unknown issue type');
  end if;
  if p_kg_affected is null or p_kg_affected < 0 then
    return jsonb_build_object('error', 'Kg affected cannot be negative');
  end if;
  if p_truck_load_id is null and p_batch_id is null then
    return jsonb_build_object('error', 'Say which truck load or batch this is about');
  end if;

  if p_batch_id is not null then
    select id, sku_id, truck_load_id into v_batch from public.batches where id = p_batch_id;
    if not found then return jsonb_build_object('error', 'Batch not found'); end if;
    v_sku := v_batch.sku_id;
    v_tl := coalesce(v_tl, v_batch.truck_load_id);
  end if;
  if v_sku is null then
    return jsonb_build_object('error', 'Say which fish this is about');
  end if;
  if v_tl is not null then
    select code into v_code from public.truck_loads where id = v_tl;
    if v_code is null then return jsonb_build_object('error', 'Truck load not found'); end if;
  end if;

  insert into public.quality_issues (id, truck_load_id, batch_id, sku_id, issue_type, kg_affected, photo_url, note, raised_by)
  values (v_id, v_tl, p_batch_id, v_sku, p_issue_type, p_kg_affected, p_photo_url, p_note, auth.uid());

  perform public.notify_admins('quality_issue', jsonb_build_object(
    'issue_id', v_id, 'issue_type', p_issue_type, 'kg_affected', p_kg_affected, 'sku_id', v_sku,
    'receiving_code', v_code, 'batch_id', p_batch_id));
  return jsonb_build_object('issue_id', v_id, 'status', 'open');
end;
$$;
grant execute on function public.raise_quality_issue(text, numeric, uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.resolve_quality_issue(p_issue_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('admin', 'co-admin') then
    raise exception 'resolve_quality_issue: not permitted' using errcode = '42501';
  end if;
  update public.quality_issues
     set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution_note = p_note
   where id = p_issue_id and status = 'open';
  if not found then return jsonb_build_object('error', 'Issue not found or already resolved'); end if;
  return jsonb_build_object('status', 'resolved');
end;
$$;
grant execute on function public.resolve_quality_issue(uuid, text) to authenticated;

-- ================================================================================================
-- vendor_quality_scorecard — admin/co-admin and the procurement team only
-- ================================================================================================
create or replace function public._vendor_quality_scorecard(
  p_from date,
  p_to   date
)
returns table (
  vendor_id uuid,
  vendor_name text,
  lots int,
  kg_expected numeric,
  kg_received numeric,
  shortfall_kg numeric,
  spoiled_at_receiving_kg numeric,
  issues int,
  issue_kg_allocated numeric,
  issue_pct numeric,
  complaints int,
  complaint_bad_kg_allocated numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query
  with lots as (
    select p.supplier_id, p.id as lot_id, p.truck_load_id, p.sku_id, p.expected_kg,
           coalesce(p.received_kg, 0) as received_kg
      from public.procurement p
     where p.status = 'received'
       and (p.received_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  ),
  -- legacy single-supplier bills (record_bill_delivery): the supplier is exact and the promise is the
  -- receiving confirmation's promised kg when there is one
  legacy as (
    select b.vendor_id as supplier_id, b.id as batch_id, b.kg as received_kg,
           coalesce((select rc.promised_kg from public.receiving_confirmations rc where rc.batch_id = b.id order by rc.confirmed_at limit 1), b.kg) as expected_kg,
           coalesce((select sum(rc.spoiled_kg) from public.receiving_confirmations rc where rc.batch_id = b.id), 0) as spoiled
      from public.batches b
     where b.truck_load_id is null and b.bill_id is not null
       and public._is_purchase_batch(b.id)
       and public._ist_day(b.delivered_at) between p_from and p_to
  ),
  lot_spoiled as (
    select x.supplier_id, coalesce(sum(x.spoiled), 0) as spoiled
      from (
        select l.supplier_id, rc.spoiled_kg as spoiled
          from lots l left join public.receiving_confirmations rc on rc.procurement_id = l.lot_id
        union all
        select g.supplier_id, g.spoiled from legacy g
      ) x
     group by x.supplier_id
  ),
  -- truck-level issues spread over that fish's lots, pro rata to expected kg
  issue_alloc_truck as (
    select l.supplier_id, i.id as issue_id,
           i.kg_affected * l.expected_kg / sum(l.expected_kg) over (partition by i.id) as kg
      from public.quality_issues i
      join lots l on l.truck_load_id = i.truck_load_id and l.sku_id = i.sku_id
     where (i.raised_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  ),
  -- legacy single-supplier bill batches: the supplier is known exactly
  issue_alloc_batch as (
    select b.vendor_id as supplier_id, i.id as issue_id, i.kg_affected as kg
      from public.quality_issues i
      join public.batches b on b.id = i.batch_id
     where i.truck_load_id is null
       and (i.raised_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  ),
  issue_all as (
    select * from issue_alloc_truck union all select * from issue_alloc_batch
  ),
  issue_sum as (
    select supplier_id, count(distinct issue_id)::int as n, coalesce(sum(kg), 0) as kg from issue_all group by supplier_id
  ),
  complaint_alloc as (
    select b.vendor_id as supplier_id, c.id as complaint_id,
           coalesce(c.kg_confirmed_bad, 0) * m.kg / nullif(sum(m.kg) over (partition by c.id), 0) as bad_kg
      from public.customer_complaints c
      join public.movements m on m.sale_id = c.sale_id and m.kind = 'sale'
      join public.batches b on b.id = m.batch_id
     where (c.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  ),
  complaint_sum as (
    select supplier_id, count(distinct complaint_id)::int as n, coalesce(sum(bad_kg), 0) as bad_kg
      from complaint_alloc group by supplier_id
  ),
  lot_sum as (
    select supplier_id, count(*)::int as n, sum(expected_kg) as exp_kg, sum(received_kg) as rec_kg
      from (select supplier_id, expected_kg, received_kg from lots
            union all select supplier_id, expected_kg, received_kg from legacy) u
     group by supplier_id
  )
  select v.id, v.name,
         coalesce(ls.n, 0),
         coalesce(ls.exp_kg, 0),
         coalesce(ls.rec_kg, 0),
         coalesce(ls.exp_kg, 0) - coalesce(ls.rec_kg, 0),
         coalesce(sp.spoiled, 0),
         coalesce(isum.n, 0),
         round(coalesce(isum.kg, 0), 3),
         case when coalesce(ls.rec_kg, 0) > 0 then round(100 * coalesce(isum.kg, 0) / ls.rec_kg, 2) else 0 end,
         coalesce(cs.n, 0),
         round(coalesce(cs.bad_kg, 0), 3)
    from public.vendors v
    left join lot_sum ls on ls.supplier_id = v.id
    left join lot_spoiled sp on sp.supplier_id = v.id
    left join issue_sum isum on isum.supplier_id = v.id
    left join complaint_sum cs on cs.supplier_id = v.id
   where ls.n is not null or isum.n is not null or cs.n is not null
   order by 12 desc nulls last, 5 desc;
end;
$$;
-- internal: no role check, so the alert sweep (0044) can use it without a signed-in user
revoke all on function public._vendor_quality_scorecard(date, date) from public, anon, authenticated;

create or replace function public.vendor_quality_scorecard(
  p_from date default (current_date - 30),
  p_to   date default current_date
)
returns table (
  vendor_id uuid, vendor_name text, lots int, kg_expected numeric, kg_received numeric, shortfall_kg numeric,
  spoiled_at_receiving_kg numeric, issues int, issue_kg_allocated numeric, issue_pct numeric,
  complaints int, complaint_bad_kg_allocated numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_manage_procurement() then
    raise exception 'vendor_quality_scorecard: not permitted' using errcode = '42501';
  end if;
  return query select * from public._vendor_quality_scorecard(p_from, p_to);
end;
$$;
grant execute on function public.vendor_quality_scorecard(date, date) to authenticated;

-- ================================================================================================
-- trace_batch / trace_sale
-- ================================================================================================
create or replace function public.trace_batch(p_batch_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_money boolean := public.can_view_procurement_money();
  b record;
  v_tl_code text;
  v_tl_received timestamptz;
  v_pr_code text;
  v_derived boolean;
  v_mixed jsonb := '[]'::jsonb;
  v_sales jsonb;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'trace_batch: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  select ba.*, s.english_name as sku_name, v.name as vendor_name
    into b
    from public.batches ba
    join public.skus s on s.id = ba.sku_id
    left join public.vendors v on v.id = ba.vendor_id
   where ba.id = p_batch_id;
  if not found then return jsonb_build_object('error', 'Batch not found'); end if;

  if b.truck_load_id is not null then
    select code, received_at into v_tl_code, v_tl_received from public.truck_loads where id = b.truck_load_id;
  end if;
  if b.procurement_id is not null and v_money then
    select code into v_pr_code from public.procurement where id = b.procurement_id;   -- a per-supplier lot id: money roles only
  end if;
  -- batches made by a transfer or a complaint restock are not purchases and carry no purchase chain
  v_derived := not public._is_purchase_batch(b.id);

  if v_money and b.is_pro_rata_share then
    select coalesce(jsonb_agg(jsonb_build_object('purchase', p.code, 'supplier', v.name, 'expected_kg', p.expected_kg)), '[]'::jsonb)
      into v_mixed
      from public.procurement p join public.vendors v on v.id = p.supplier_id
     where p.truck_load_id = b.truck_load_id and p.sku_id = b.sku_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'sale_id', sa.id, 'sold_at', sa.sold_at, 'kg', m.kg, 'customer', coalesce(c.name, sa.customer_name),
           'reversed', exists (select 1 from public.reversal_requests rr where rr.sale_id = sa.id and rr.status = 'executed')
         ) order by sa.sold_at), '[]'::jsonb)
    into v_sales
    from public.movements m
    join public.sales sa on sa.id = m.sale_id
    left join public.customers c on c.id = sa.customer_id
   where m.batch_id = p_batch_id and m.kind = 'sale';

  return jsonb_build_object(
    'batch', jsonb_build_object('id', b.id, 'short_code', 'RCV-' || upper(substr(replace(b.id::text, '-', ''), 1, 6)),
                                'fish', b.sku_name, 'kg', b.kg, 'kg_remaining', b.kg_remaining,
                                'received_at', b.delivered_at, 'is_pro_rata_share', b.is_pro_rata_share),
    'receiving_code', v_tl_code,
    'truck_received_at', v_tl_received,
    'purchase_code', v_pr_code,
    -- on a pro-rata share the supplier is an ALLOCATION, so it is labelled as one and 'supplier' stays null
    'supplier', case when v_money and not b.is_pro_rata_share then b.vendor_name end,
    'allocated_supplier', case when v_money and b.is_pro_rata_share then b.vendor_name end,
    'derived_batch', v_derived,
    'derived_note', case when v_derived then 'Created by a transfer or a restock, not by a purchase. Trace the batch it came from.' end,
    'mixed_with', v_mixed,
    'honesty_note', case when b.is_pro_rata_share
        then 'This batch is a share of a mixed truck load. The fish was combined on the dock, so it came from the suppliers listed in mixed_with, not from any one of them.'
        else null end,
    'sales', v_sales
  );
end;
$$;
grant execute on function public.trace_batch(uuid) to authenticated;

create or replace function public.trace_sale(p_sale_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  s record;
  v_sources jsonb;
begin
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'trace_sale: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  select sa.id, sa.sold_at, sa.total_kg, sa.total_amount, coalesce(c.name, sa.customer_name) as customer
    into s from public.sales sa left join public.customers c on c.id = sa.customer_id where sa.id = p_sale_id;
  if not found then return jsonb_build_object('error', 'Sale not found'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('kg_from_batch', x.kg, 'trace', public.trace_batch(x.batch_id))), '[]'::jsonb)
    into v_sources
    from (select batch_id, sum(kg) as kg from public.movements where sale_id = p_sale_id and kind = 'sale' group by batch_id) x;

  return jsonb_build_object('sale_id', s.id, 'sold_at', s.sold_at, 'customer', s.customer,
                            'total_kg', s.total_kg, 'sources', v_sources);
end;
$$;
grant execute on function public.trace_sale(uuid) to authenticated;
