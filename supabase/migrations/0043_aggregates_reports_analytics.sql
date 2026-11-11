-- 0043_aggregates_reports_analytics.sql — Phase B (BACKEND-REQUIREMENTS §3, §6, §8.5)
-- Read-side RPCs so a phone makes ONE call, and so the desk's panels can take a date range as a
-- parameter (which is why these are functions, not views).
--
-- Money rule: functions that reveal purchase cost, margin or supplier split require
-- can_view_procurement_money() / can_manage_procurement(). Counts and sales are visible to every
-- role, as the sales table already is.
--
-- Conventions
--   * "Today" and date ranges are Asia/Kolkata calendar days.
--   * A reversed sale (reversal_requests.status = 'executed') is excluded from sales, cost and profit.
--   * Cost of goods sold = kg sold x the batch's price_per_kg_paid (FIFO already chose the batch).
--   * Spoilage cost = spoiled kg x the batch's price_per_kg_paid.
--   * Refunds from customer complaints are NOT netted from sales here (they are recorded on the
--     complaint); profit is therefore "before complaint refunds". Stated, not hidden.
--
-- IDEMPOTENT. Run after 0042.

-- (_ist_day and _is_purchase_batch are defined in 0037)

-- ================================================================================================
-- home_stats_today — chapter 1: "450 KG today / 2 pending / ₹ 24K sales"
-- ================================================================================================
create or replace function public.home_stats_today()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := public._ist_day(now());
  v_kg_in numeric; v_pending int; v_sales numeric; v_sales_kg numeric; v_spoil numeric;
begin
  if public.current_user_role() is null then
    raise exception 'home_stats_today: not signed in' using errcode = '42501';
  end if;

  -- fish that physically arrived today: confirmed arrivals + direct deliveries into real locations
  select coalesce(sum(m.kg), 0) into v_kg_in
    from public.movements m
    left join public.locations l on l.id = m.to_location_id
   where public._ist_day(m.occurred_at) = v_today
     and (m.kind = 'receiving_confirmed'
          or (m.kind = 'delivery_in' and coalesce(l.kind, 'storage') <> 'in_transit_inbound'));

  select count(*) into v_pending from (
    select t.id from public.truck_loads t where t.status = 'dispatched'
    union all
    select b.id from public.batches b join public.locations l on l.id = b.location_id
     where l.kind = 'in_transit_inbound' and b.bill_id is not null
  ) q;

  select coalesce(sum(s.total_amount), 0), coalesce(sum(s.total_kg), 0) into v_sales, v_sales_kg
    from public.sales s
   where public._ist_day(s.sold_at) = v_today
     and not exists (select 1 from public.reversal_requests r where r.sale_id = s.id and r.status = 'executed');

  select coalesce(sum(m.kg), 0) into v_spoil
    from public.movements m where m.kind = 'spoilage' and public._ist_day(m.occurred_at) = v_today;

  return jsonb_build_object('date', v_today, 'kg_received_today', v_kg_in, 'pending_receiving', v_pending,
                            'sales_amount_today', v_sales, 'sales_kg_today', v_sales_kg, 'spoiled_kg_today', v_spoil);
end;
$$;
grant execute on function public.home_stats_today() to authenticated;

-- ================================================================================================
-- todays_profit — chapter 15 (admin / procurement-money roles only)
-- ================================================================================================
create or replace function public.profit_summary(p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_from date := coalesce(p_from, public._ist_day(now()));
  v_to   date := coalesce(p_to, v_from);
  v_bought numeric; v_sold numeric; v_cogs numeric; v_spoil_cost numeric; v_kg_sold numeric;
begin
  if not public.can_view_procurement_money() then
    raise exception 'profit_summary: not permitted' using errcode = '42501';
  end if;

  select coalesce(sum(b.kg * b.price_per_kg_paid), 0) into v_bought
    from public.batches b where public._ist_day(b.delivered_at) between v_from and v_to
     and public._is_purchase_batch(b.id);   -- transfer / restock batches are not purchases

  select coalesce(sum(s.total_amount), 0), coalesce(sum(s.total_kg), 0) into v_sold, v_kg_sold
    from public.sales s
   where public._ist_day(s.sold_at) between v_from and v_to
     and not exists (select 1 from public.reversal_requests r where r.sale_id = s.id and r.status = 'executed');

  select coalesce(sum(m.kg * b.price_per_kg_paid), 0) into v_cogs
    from public.movements m
    join public.batches b on b.id = m.batch_id
    join public.sales s on s.id = m.sale_id
   where m.kind = 'sale' and public._ist_day(s.sold_at) between v_from and v_to
     and not exists (select 1 from public.reversal_requests r where r.sale_id = s.id and r.status = 'executed');

  select coalesce(sum(m.kg * b.price_per_kg_paid), 0) into v_spoil_cost
    from public.movements m join public.batches b on b.id = m.batch_id
   where m.kind = 'spoilage' and public._ist_day(m.occurred_at) between v_from and v_to;

  return jsonb_build_object(
    'from', v_from, 'to', v_to, 'bought_amount', round(v_bought, 2), 'sold_amount', round(v_sold, 2),
    'kg_sold', v_kg_sold, 'cost_of_goods_sold', round(v_cogs, 2),
    'gross_profit', round(v_sold - v_cogs, 2),
    'spoilage_cost', round(v_spoil_cost, 2),
    'profit_after_spoilage', round(v_sold - v_cogs - v_spoil_cost, 2),
    'margin_pct', case when v_sold > 0 then round(100 * (v_sold - v_cogs - v_spoil_cost) / v_sold, 2) end,
    'note', 'Before customer-complaint refunds and logistics costs.');
end;
$$;
grant execute on function public.profit_summary(date, date) to authenticated;

-- ================================================================================================
-- Reports (chapter 8)
-- ================================================================================================
create or replace function public.report_stock()
returns table (sku_id uuid, english_name text, tamil_name text, kg_on_hand numeric, low_stock_threshold_kg numeric, is_low boolean, batches int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.current_user_role() is null then raise exception 'report_stock: not signed in' using errcode = '42501'; end if;
  return query
  select s.id, s.english_name, s.tamil_name,
         coalesce(sum(b.kg_remaining), 0),
         s.low_stock_threshold_kg,
         coalesce(sum(b.kg_remaining), 0) < s.low_stock_threshold_kg,
         count(b.id) filter (where b.kg_remaining > 0)::int
    from public.skus s
    left join public.batches b on b.sku_id = s.id
         and b.location_id not in (select id from public.locations where kind in ('in_transit_inbound', 'in_transit_outbound'))
   where s.active
   group by s.id
   order by s.english_name;
end;
$$;
grant execute on function public.report_stock() to authenticated;

create or replace function public.report_sales(p_from date default null, p_to date default null)
returns table (sku_id uuid, english_name text, kg_sold numeric, amount numeric, avg_price_per_kg numeric, sales_count int)
language plpgsql stable security definer set search_path = public
as $$
declare v_from date := coalesce(p_from, public._ist_day(now()) - 6); v_to date := coalesce(p_to, public._ist_day(now()));
begin
  if public.current_user_role() is null then raise exception 'report_sales: not signed in' using errcode = '42501'; end if;
  return query
  select s.sku_id, k.english_name, sum(s.total_kg), sum(s.total_amount),
         round(sum(s.total_amount) / nullif(sum(s.total_kg), 0), 2), count(*)::int
    from public.sales s join public.skus k on k.id = s.sku_id
   where public._ist_day(s.sold_at) between v_from and v_to
     and not exists (select 1 from public.reversal_requests r where r.sale_id = s.id and r.status = 'executed')
   group by s.sku_id, k.english_name
   order by 4 desc;
end;
$$;
grant execute on function public.report_sales(date, date) to authenticated;

create or replace function public.report_purchases(p_from date default null, p_to date default null)
returns table (sku_id uuid, english_name text, kg_received numeric, amount numeric, avg_rate_per_kg numeric, batches int)
language plpgsql stable security definer set search_path = public
as $$
declare v_from date := coalesce(p_from, public._ist_day(now()) - 6); v_to date := coalesce(p_to, public._ist_day(now()));
begin
  if not public.can_view_procurement_money() then raise exception 'report_purchases: not permitted' using errcode = '42501'; end if;
  return query
  select b.sku_id, k.english_name, sum(b.kg), round(sum(b.kg * b.price_per_kg_paid), 2),
         round(sum(b.kg * b.price_per_kg_paid) / nullif(sum(b.kg), 0), 2), count(*)::int
    from public.batches b join public.skus k on k.id = b.sku_id
   where public._ist_day(b.delivered_at) between v_from and v_to and public._is_purchase_batch(b.id)
   group by b.sku_id, k.english_name
   order by 4 desc;
end;
$$;
grant execute on function public.report_purchases(date, date) to authenticated;

-- ================================================================================================
-- Procurement analytics (chapter 31) — one RPC per panel, date range as parameter
-- ================================================================================================
create or replace function public.analytics_purchase_by_fish(p_from date, p_to date)
returns table (sku_id uuid, english_name text, kg numeric, amount numeric, avg_rate numeric, share_of_kg_pct numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_manage_procurement() then raise exception 'analytics: not permitted' using errcode = '42501'; end if;
  return query
  select b.sku_id, k.english_name, sum(b.kg), round(sum(b.kg * b.price_per_kg_paid), 2),
         round(sum(b.kg * b.price_per_kg_paid) / nullif(sum(b.kg), 0), 2),
         round(100 * sum(b.kg) / nullif(sum(sum(b.kg)) over (), 0), 1)
    from public.batches b join public.skus k on k.id = b.sku_id
   where public._ist_day(b.delivered_at) between p_from and p_to and public._is_purchase_batch(b.id)
   group by b.sku_id, k.english_name order by 3 desc;
end;
$$;

create or replace function public.analytics_purchase_vs_sale_price(p_from date, p_to date)
returns table (sku_id uuid, english_name text, avg_purchase_rate numeric, avg_sale_price numeric, margin_per_kg numeric, margin_pct numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_manage_procurement() then raise exception 'analytics: not permitted' using errcode = '42501'; end if;
  return query
  with buy as (
    select b.sku_id, sum(b.kg * b.price_per_kg_paid) / nullif(sum(b.kg), 0) as rate
      from public.batches b where public._ist_day(b.delivered_at) between p_from and p_to and public._is_purchase_batch(b.id) group by b.sku_id),
  sell as (
    select s.sku_id, sum(s.total_amount) / nullif(sum(s.total_kg), 0) as price
      from public.sales s
     where public._ist_day(s.sold_at) between p_from and p_to
       and not exists (select 1 from public.reversal_requests r where r.sale_id = s.id and r.status = 'executed')
     group by s.sku_id)
  select k.id, k.english_name, round(buy.rate, 2), round(sell.price, 2), round(sell.price - buy.rate, 2),
         round(100 * (sell.price - buy.rate) / nullif(sell.price, 0), 1)
    from public.skus k left join buy on buy.sku_id = k.id left join sell on sell.sku_id = k.id
   where buy.rate is not null or sell.price is not null
   order by 5 desc nulls last;
end;
$$;

create or replace function public.analytics_supplier_split(p_from date, p_to date)
returns table (vendor_id uuid, vendor_name text, kg numeric, amount numeric, share_of_amount_pct numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.can_manage_procurement() then raise exception 'analytics: not permitted' using errcode = '42501'; end if;
  return query
  select v.id, v.name, sum(b.kg), round(sum(b.kg * b.price_per_kg_paid), 2),
         round(100 * sum(b.kg * b.price_per_kg_paid) / nullif(sum(sum(b.kg * b.price_per_kg_paid)) over (), 0), 1)
    from public.batches b join public.vendors v on v.id = b.vendor_id
   where public._ist_day(b.delivered_at) between p_from and p_to and public._is_purchase_batch(b.id)
   group by v.id, v.name order by 4 desc;
end;
$$;

create or replace function public.procurement_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := public._ist_day(now());
  v_req numeric; v_ordered numeric; v_arrivals int; v_open_po int; v_stale int;
  v_stale_days int := public.get_setting_numeric('market_price_stale_days', 2)::int;
begin
  if not public.can_manage_procurement() then raise exception 'procurement_dashboard: not permitted' using errcode = '42501'; end if;
  select coalesce(sum(qty_kg), 0) into v_req from public.purchase_requirements
   where required_date = v_today and status in ('open', 'in_progress');
  select coalesce(sum(expected_kg), 0) into v_ordered from public.procurement
   where status in ('created', 'dispatched') and (expected_arrival is null or public._ist_day(expected_arrival) <= v_today);
  select count(*) into v_arrivals from public.truck_loads where status = 'dispatched';
  select count(*) into v_open_po from public.purchase_orders where status in ('sent', 'partially_received');
  select count(*) into v_stale from (
    select market, sku_id, max(price_date) d from public.market_prices group by 1, 2) x
   where v_today - d > v_stale_days;
  return jsonb_build_object('date', v_today, 'fish_required_today_kg', v_req, 'on_order_kg', v_ordered,
                            'trucks_on_the_way', v_arrivals, 'open_purchase_orders', v_open_po,
                            'stale_market_prices', v_stale);
end;
$$;

grant execute on function public.analytics_purchase_by_fish(date, date) to authenticated;
grant execute on function public.analytics_purchase_vs_sale_price(date, date) to authenticated;
grant execute on function public.analytics_supplier_split(date, date) to authenticated;
grant execute on function public.procurement_dashboard() to authenticated;
