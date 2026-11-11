do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  v_seer uuid := 'd0000000-0000-0000-0000-000000000002';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  r jsonb; bill uuid; b1 uuid; b2 uuid; fill1 uuid; fill2 uuid; cid1 uuid; n int; po uuid; tl uuid; p1 uuid;
begin
  perform pg_temp.as_user(v_rep);
  r := public.record_bill_delivery(s1, v_cold, current_date, null, jsonb_build_array(
        jsonb_build_object('sku_id', v_sela, 'kg', 40, 'price_per_kg_paid', 200)));
  bill := (r->>'bill_id')::uuid; b1 := (r->'batches'->0->>'batch_id')::uuid;
  -- pack two containers from the same batch: 10 kg and 15 kg
  r := public.record_container_fill(bill, v_cold, 'TC-0001', 10, jsonb_build_array(jsonb_build_object('batch_id', b1, 'kg', 10)));
  perform pg_temp.ok(not (r ? 'error'), 'fill 1: '||r::text);
  r := public.record_container_fill(bill, v_cold, 'TC-0002', 15, jsonb_build_array(jsonb_build_object('batch_id', b1, 'kg', 15)));
  perform pg_temp.ok(not (r ? 'error'), 'fill 2: '||r::text);

  -- container card (a worker may scan)
  perform pg_temp.as_user(v_wrk);
  r := public.container_card(null, 'TC-0001');
  perform pg_temp.ok(r->>'empty' = 'false' and (r->>'kg_remaining')::numeric = 10, 'card shows contents: '||r::text);
  perform pg_temp.ok(r->>'qr_payload' like 'jsk://container/%', 'qr payload uses the uuid');
  perform pg_temp.ok(r->'contents'->0->>'fish' = 'Sela Fish', 'contents list the fish');
  perform pg_temp.ok(not (replace(r::text, 'is_mixed_supplier', '') ~* 'price|rate|vendor|supplier|amount'), 'card is money-free');
  perform pg_temp.ok((public.container_card(null, 'NOPE')) ? 'error', 'unknown container');
  cid1 := (r->>'container_id')::uuid;

  -- make TC-0002 the older one -> it is the one to sell next
  perform pg_temp.as_superuser();
  update public.container_fills f set expires_at = now() + interval '3 hours' where container_id = (select id from public.containers where container_number='TC-0002');
  update public.container_fills f set expires_at = now() + interval '30 hours' where container_id = cid1;
  perform pg_temp.as_user(v_wrk);
  r := public.container_card(null, 'TC-0002'); perform pg_temp.ok((r->>'sell_this_next')::boolean, 'older expiry is next');
  r := public.container_card(cid1);            perform pg_temp.ok(not (r->>'sell_this_next')::boolean, 'newer expiry is not next');

  -- alert sweeps
  begin perform public.run_alert_sweeps(); raise exception 'ASSERT FAILED: worker ran sweeps';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_user(v_adm);
  -- overdue PO
  po := (public.create_purchase_order(s1, jsonb_build_array(jsonb_build_object('sku_id', v_seer, 'qty_kg', 10, 'price_per_kg', 600)), current_date - 2)->>'po_id')::uuid;
  perform public.release_purchase_order(po);
  -- a quality problem big enough to trip 5%: receive 100 kg via truck then 20 kg issue
  p1 := (public.create_procurement(v_seer, 100, s1, 600)->>'procurement_id')::uuid;
  tl := (public.dispatch_procurement(array[p1], 'TN', null, v_cold)->>'truck_load_id')::uuid;
  perform public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_seer, 'good_kg', 100)));
  perform public.raise_quality_issue('damaged', 20, tl, null, v_seer);

  perform pg_temp.as_superuser(); update public.skus set low_stock_threshold_kg = 500 where id = v_sela; perform pg_temp.as_user(v_adm);
  r := public.run_alert_sweeps();
  perform pg_temp.ok((r->>'expiring')::int = 1, 'one container expiring within 6h: '||r::text);
  perform pg_temp.ok((r->>'po_overdue')::int = 1, 'one overdue PO');
  perform pg_temp.ok((r->>'quality')::int = 1, 'one supplier over 5%');
  perform pg_temp.ok((r->>'low_stock')::int = 1, 'sela (40 kg vs 500 threshold) flagged; never-stocked fish are not');
  r := public.run_alert_sweeps();
  perform pg_temp.ok((r->>'expiring')::int = 0 and (r->>'po_overdue')::int = 0 and (r->>'quality')::int = 0, 'de-duplicated on the second run: '||r::text);
  select count(*) into n from public.notifications where type = 'container_expiring' and user_id = v_adm;
  perform pg_temp.ok(n = 1, 'admin got exactly one expiry notification');
  -- service-key style call (no end-user session) is allowed
  perform pg_temp.as_superuser();
  r := public.run_alert_sweeps();
  perform pg_temp.ok(r ? 'expiring', 'scheduler call works with no user session');
end $$;
