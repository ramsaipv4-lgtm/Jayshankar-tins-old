do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  v_crab uuid := 'd0000000-0000-0000-0000-000000000003';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  r jsonb; bill uuid; b1 uuid; b2 uuid; x record; n int; sale uuid; cust uuid;
begin
  perform pg_temp.as_user(v_rep);
  r := public.record_bill_delivery(s1, v_cold, current_date, null, jsonb_build_array(
        jsonb_build_object('sku_id', v_sela, 'kg', 100, 'price_per_kg_paid', 200),
        jsonb_build_object('sku_id', v_crab, 'kg', 10, 'price_per_kg_paid', 400)));
  perform pg_temp.ok(r ? 'bill_id', 'bill: '||r::text);
  bill := (r->>'bill_id')::uuid;

  -- home stats before any sale: 110 kg arrived directly today, nothing pending
  perform pg_temp.as_user(v_wrk);
  r := public.home_stats_today();
  perform pg_temp.ok((r->>'kg_received_today')::numeric = 110, 'worker sees kg received today = 110: '||r::text);
  perform pg_temp.ok((r->>'pending_receiving')::int = 0 and (r->>'sales_amount_today')::numeric = 0, 'no pending, no sales');
  begin perform public.profit_summary(); raise exception 'ASSERT FAILED: worker read profit';
  exception when insufficient_privilege then null; end;
  begin perform * from public.report_purchases(); raise exception 'ASSERT FAILED: worker read purchases';
  exception when insufficient_privilege then null; end;

  -- sell 40 kg sela at 300 -> revenue 12000, cogs 8000, gross 4000
  perform pg_temp.as_user(v_rep);
  r := public.record_container_sale(v_sela, v_cold, 'Hotel A', 40, 300, null, null);
  perform pg_temp.ok(not (r ? 'error'), 'sale ok (sells straight from batch FIFO): '||r::text);
  -- spoil 5 kg crab -> 2000 loss
  r := public.record_container_spoilage(v_crab, v_cold, 5, 'power cut');
  perform pg_temp.ok(not (r ? 'error'), 'spoilage: '||r::text);

  perform pg_temp.as_user(v_adm);
  r := public.profit_summary();
  perform pg_temp.ok((r->>'bought_amount')::numeric = 24000, 'bought 100*200+10*400 = 24000: '||r::text);
  perform pg_temp.ok((r->>'sold_amount')::numeric = 12000, 'sold 12000');
  perform pg_temp.ok((r->>'cost_of_goods_sold')::numeric = 8000, 'cogs 8000');
  perform pg_temp.ok((r->>'gross_profit')::numeric = 4000, 'gross 4000');
  perform pg_temp.ok((r->>'spoilage_cost')::numeric = 2000, 'spoilage 2000');
  perform pg_temp.ok((r->>'profit_after_spoilage')::numeric = 2000 and (r->>'margin_pct')::numeric = 16.67, 'after spoilage 2000, 16.67%: '||(r->>'margin_pct'));

  select * into x from public.report_sales() where english_name = 'Sela Fish';
  perform pg_temp.ok(x.kg_sold = 40 and x.amount = 12000 and x.avg_price_per_kg = 300, 'sales report');
  select * into x from public.report_purchases() where english_name = 'Sela Fish';
  perform pg_temp.ok(x.kg_received = 100 and x.amount = 20000 and x.avg_rate_per_kg = 200, 'purchase report');
  select * into x from public.report_stock() where english_name = 'Sela Fish';
  perform pg_temp.ok(x.kg_on_hand = 60, 'stock 60 left (got '||x.kg_on_hand||')');
  select * into x from public.report_stock() where english_name = 'Blue Crab';
  perform pg_temp.ok(x.kg_on_hand = 5, 'crab 5 left after spoilage');
  select * into x from public.analytics_purchase_vs_sale_price(current_date, current_date) where english_name = 'Sela Fish';
  perform pg_temp.ok(x.avg_purchase_rate = 200 and x.avg_sale_price = 300 and x.margin_per_kg = 100 and x.margin_pct = 33.3, 'buy vs sell');
  select * into x from public.analytics_purchase_by_fish(current_date, current_date) where english_name = 'Sela Fish';
  perform pg_temp.ok(x.kg = 100 and x.share_of_kg_pct = 90.9, 'purchase share 100/110 = 90.9%: '||x.share_of_kg_pct);
  select * into x from public.analytics_supplier_split(current_date, current_date) where vendor_id = s1;
  perform pg_temp.ok(x.amount = 24000 and x.share_of_amount_pct = 100, 'supplier split');
  r := public.procurement_dashboard();
  perform pg_temp.ok((r->>'trucks_on_the_way')::int = 0, 'dashboard: ' || r::text);

  -- a reversed sale drops out of sales and profit
  perform pg_temp.as_superuser();
  select id into sale from public.sales limit 1;
  insert into public.reversal_requests (sale_id, requested_by, status, reason)
    select sale, v_adm, 'executed', 'test' where true;
  perform pg_temp.as_user(v_adm);
  r := public.profit_summary();
  perform pg_temp.ok((r->>'sold_amount')::numeric = 0 and (r->>'cost_of_goods_sold')::numeric = 0, 'reversed sale excluded: '||r::text);
  r := public.home_stats_today();
  perform pg_temp.ok((r->>'sales_amount_today')::numeric = 0, 'home stats exclude reversed sale');
end $$;
