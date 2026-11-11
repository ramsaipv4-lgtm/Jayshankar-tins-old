-- Regressions for defects found by an adversarial review of 0037-0045.
do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_sup uuid := 'a0000000-0000-0000-0000-000000000005';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  v_crab uuid := 'd0000000-0000-0000-0000-000000000003';
  v_seer uuid := 'd0000000-0000-0000-0000-000000000002';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  s2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  v_floor uuid := 'c0000000-0000-0000-0000-000000000002';
  r jsonb; x record; n int; k numeric; b uuid; bill uuid; p1 uuid; p2 uuid; tl uuid; po uuid; req uuid; q1 uuid; q2 uuid; pr1 uuid; pr2 uuid;
begin
  -- 1) trace_batch on a plain bill batch and on a transfer child must not crash
  perform pg_temp.as_user(v_rep);
  r := public.record_bill_delivery(s1, v_cold, current_date, null, jsonb_build_array(
        jsonb_build_object('sku_id', v_sela, 'kg', 150, 'price_per_kg_paid', 200),
        jsonb_build_object('sku_id', v_crab, 'kg', 20, 'price_per_kg_paid', 400)));
  b := (r->'batches'->0->>'batch_id')::uuid;
  r := public.trace_batch(b);
  perform pg_temp.ok(not (r ? 'error') and (r->>'derived_batch')::boolean = false and r->>'receiving_code' is null, 'trace of a legacy bill batch works: '||r::text);

  -- 2) a transfer must not double-count purchases
  perform pg_temp.as_user(v_adm);
  -- transfers must cross warehouses (0029), so stand up a second warehouse with one location
  insert into public.warehouses (name, display_name) values ('branch', 'Branch') on conflict (name) do nothing;
  insert into public.locations (id, name, display_name, kind, warehouse_id)
  values ('c0000000-0000-0000-0000-0000000000f1', 'branch-floor', 'Branch floor', 'display',
          (select id from public.warehouses where name = 'branch'));
  r := public.record_transfer_cascade(v_sela, v_cold, 'c0000000-0000-0000-0000-0000000000f1', 60, 'to branch');
  perform pg_temp.ok(not (r ? 'error'), 'transfer ok: '||r::text);
  r := public.profit_summary();
  perform pg_temp.ok((r->>'bought_amount')::numeric = 150*200 + 20*400, 'bought = 38000 not inflated by the transfer child: '||(r->>'bought_amount'));
  select * into x from public.analytics_supplier_split(current_date, current_date) where vendor_id = s1;
  perform pg_temp.ok(x.kg = 170 and x.amount = 38000, 'supplier split ignores the transfer child (kg '||x.kg||')');
  select * into x from public.report_purchases() where english_name = 'Sela Fish';
  perform pg_temp.ok(x.kg_received = 150, 'purchases report ignores the transfer child');
  select id into b from public.batches where location_id = 'c0000000-0000-0000-0000-0000000000f1' limit 1;
  r := public.trace_batch(b);
  perform pg_temp.ok((r->>'derived_batch')::boolean and r->>'derived_note' is not null, 'transfer child is labelled derived');

  -- 3) NaN and all-zero are refused
  perform pg_temp.ok((public.create_procurement(v_seer, 'NaN'::numeric, s1, 100)) ? 'error', 'NaN kg refused on create_procurement');
  perform pg_temp.ok((public.create_procurement(v_seer, 10, s1, 'NaN'::numeric)) ? 'error', 'NaN rate refused');
  p1 := (public.create_procurement(v_sela, 60, s1, 200)->>'procurement_id')::uuid;
  p2 := (public.create_procurement(v_crab, 20, s1, 400, null, 'credit')->>'procurement_id')::uuid;
  tl := (public.dispatch_procurement(array[p1,p2], 'TN', null, v_cold)->>'truck_load_id')::uuid;
  r := public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'good_kg', 'NaN'), jsonb_build_object('sku_id', v_crab, 'good_kg', 1)));
  perform pg_temp.ok(r ? 'error', 'NaN weight refused: '||r::text);
  r := public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'good_kg', 0), jsonb_build_object('sku_id', v_crab, 'good_kg', 0)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%cancel%', 'an all-zero truck is refused, not billed: '||r::text);
  r := public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela), jsonb_build_object('sku_id', v_crab, 'good_kg', 1)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%good_kg%', 'missing good_kg gets a clear message');
  select count(*) into n from public.procurement where truck_load_id = tl and status = 'dispatched'; perform pg_temp.ok(n = 2, 'refusals left the truck untouched');

  -- 4) same supplier, cash lot + credit lot on one truck -> two bills, each with its own terms
  r := public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'good_kg', 60), jsonb_build_object('sku_id', v_crab, 'good_kg', 20)));
  perform pg_temp.ok(not (r ? 'error'), 'receive ok: '||r::text);
  select count(*) into n from public.bills where id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(n = 2, 'one bill per (supplier, terms)');
  select total_amount into k from public.bills where payment_terms = 'credit' and id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(k = 8000, 'the credit bill is the credit lot only (8000), got '||coalesce(k::text,'none'));
  select total_amount into k from public.bills where payment_terms = 'cash' and id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(k = 12000, 'the cash bill is the cash lot only (12000)');

  -- 5) set_app_setting rejects wrong types
  r := public.set_app_setting('enforce_blind_receiving', '"true"'::jsonb);
  perform pg_temp.ok(r ? 'error', 'a string cannot flip the blind switch');
  r := public.set_app_setting('grading_tolerance_pct', '"lots"'::jsonb); perform pg_temp.ok(r ? 'error', 'a string tolerance refused');
  r := public.set_app_setting('grading_tolerance_pct', '150'::jsonb);   perform pg_temp.ok(r ? 'error', 'a percentage over 100 refused');
  r := public.set_app_setting('grading_tolerance_pct', '4'::jsonb);     perform pg_temp.ok(r ? 'key', 'a good value is accepted');

  -- 6) a PO with one received and one cancelled purchase is received, not partially_received
  insert into public.purchase_requirements (sku_id, qty_kg) values (v_seer, 20) returning id into req;
  po := (public.create_purchase_order(s2, jsonb_build_array(
          jsonb_build_object('sku_id', v_seer, 'qty_kg', 10, 'price_per_kg', 600, 'requirement_id', req),
          jsonb_build_object('sku_id', v_sela, 'qty_kg', 10, 'price_per_kg', 190, 'requirement_id', req)))->>'po_id')::uuid;
  perform public.release_purchase_order(po);
  select id into pr1 from public.procurement where po_id = po and sku_id = v_seer;
  select id into pr2 from public.procurement where po_id = po and sku_id = v_sela;
  perform public.cancel_procurement(pr2, 'no sela today');
  tl := (public.dispatch_procurement(array[pr1], 'TN2', null, v_cold)->>'truck_load_id')::uuid;
  perform public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_seer, 'good_kg', 10)));
  select status into x from public.purchase_orders where id = po;
  perform pg_temp.ok(x.status = 'received', 'PO with a cancelled line is received (got '||x.status||')');
  select status into x from public.purchase_requirements where id = req;
  perform pg_temp.ok(x.status = 'completed', 'requirement completed');

  -- 7) creating a PO from a second quote clears the first selection instead of erroring
  insert into public.purchase_requirements (sku_id, qty_kg) values (v_seer, 50) returning id into req;
  insert into public.supplier_quotations (requirement_id, sku_id, qty_kg, supplier_id, price_per_kg) values (req, v_seer, 50, s1, 700) returning id into q1;
  insert into public.supplier_quotations (requirement_id, sku_id, qty_kg, supplier_id, price_per_kg) values (req, v_seer, 50, s2, 690) returning id into q2;
  perform public.select_quotation(q1);
  r := public.create_purchase_order(s2, null, null, null, 0, 0, 0, q2);
  perform pg_temp.ok(r ? 'po_id', 'PO from an unselected quote while another is selected works: '||r::text);
  select count(*) into n from public.supplier_quotations where requirement_id = req and selected; perform pg_temp.ok(n = 1, 'still exactly one selected');

  -- 8) the scorecard sees legacy-bill suppliers (they used to show 0 kg and a 0% issue rate)
  select * into x from public.vendor_quality_scorecard(current_date, current_date) where vendor_id = s1;
  perform pg_temp.ok(x.kg_received >= 170, 'legacy supplier shows received kg in the scorecard (got '||x.kg_received||')');
  select id into b from public.batches where bill_id is not null and sku_id = v_sela and truck_load_id is null limit 1;
  perform public.raise_quality_issue('damaged', 30, null, b);
  select * into x from public.vendor_quality_scorecard(current_date, current_date) where vendor_id = s1;
  perform pg_temp.ok(x.issue_kg_allocated >= 30 and x.issue_pct > 0, 'legacy supplier issue rate is non-zero: '||x.issue_pct);

  -- 9) blind receiver cannot read receiving_confirmations once the switch is on
  update public.users set receiving_blind = true where id = v_sup;
  perform public.set_app_setting('enforce_blind_receiving', 'true'::jsonb);
  perform pg_temp.as_user(v_sup);
  select count(*) into n from public.receiving_confirmations; perform pg_temp.ok(n = 0, 'blind receiver reads 0 receiving_confirmations');
  r := public.trace_batch((select id from public.batches_safe where kg > 0 limit 1));
  perform pg_temp.ok(r->>'purchase_code' is null and r->>'supplier' is null and r->>'allocated_supplier' is null, 'blind trace carries no supplier or lot id');
end $$;
