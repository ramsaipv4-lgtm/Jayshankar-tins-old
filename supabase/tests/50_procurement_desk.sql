do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sup uuid := 'a0000000-0000-0000-0000-000000000005';
  v_seer uuid := 'd0000000-0000-0000-0000-000000000002';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  s2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  req uuid; q1 uuid; q2 uuid; q3 uuid; po uuid; r jsonb; n int; x record; pr uuid; tl uuid;
begin
  -- team can write the requirement; a worker can neither read nor write it
  perform pg_temp.as_user(v_rep);
  insert into public.purchase_requirements (sku_id, qty_kg, destination, priority, expected_price_per_kg)
    values (v_seer, 300, 'Chennai', 'high', 700) returning id into req;
  perform pg_temp.as_user(v_wrk);
  select count(*) into n from public.purchase_requirements; perform pg_temp.ok(n = 0, 'worker reads no requirements');
  begin insert into public.purchase_requirements (sku_id, qty_kg) values (v_seer, 1); raise exception 'ASSERT FAILED: worker inserted';
  exception when insufficient_privilege then null; end;

  -- blind super-worker (enforcement flag irrelevant here: can_manage_procurement already excludes blind)
  perform pg_temp.as_user(v_adm);
  update public.users set receiving_blind = true where id = v_sup;
  perform pg_temp.as_user(v_sup);
  select count(*) into n from public.purchase_requirements; perform pg_temp.ok(n = 0, 'blind user reads no requirements');
  begin perform * from public.latest_market_prices(); raise exception 'ASSERT FAILED';
  exception when insufficient_privilege then null; end;

  -- three quotes: landed = price + (transport+ice+loading+other)/kg
  perform pg_temp.as_user(v_adm);
  insert into public.supplier_quotations (requirement_id, sku_id, qty_kg, supplier_id, price_per_kg, transport_cost, ice_packing_cost, valid_until)
    values (req, v_seer, 300, s1, 690, 3000, 1500, current_date + 1) returning id into q1;     -- 690 + 15 = 705
  insert into public.supplier_quotations (requirement_id, sku_id, qty_kg, supplier_id, price_per_kg, transport_cost, ice_packing_cost, loading_cost, valid_until)
    values (req, v_seer, 300, s2, 680, 6000, 1500, 1500, current_date + 1) returning id into q2;  -- 680 + 30 = 710
  insert into public.supplier_quotations (requirement_id, sku_id, qty_kg, supplier_id, price_per_kg, valid_until)
    values (req, v_seer, 300, s2, 650, current_date - 1) returning id into q3;                -- expired
  select * into x from public.supplier_quotations_landed_v where id = q1;
  perform pg_temp.ok(x.landed_per_kg = 705.00, 'landed per kg = 705 (got '||x.landed_per_kg||')');
  perform pg_temp.ok(x.landed_total = 211500.00, 'landed total = 211500');
  select * into x from public.supplier_quotations_landed_v where id = q2;
  perform pg_temp.ok(x.landed_per_kg = 710.00, 'q2 landed 710');
  select count(*) into n from public.supplier_quotations_landed_v where is_best_price and requirement_id = req;
  perform pg_temp.ok(n = 1, 'exactly one best price');
  select q.id into x from public.supplier_quotations_landed_v q where is_best_price and requirement_id = req;
  perform pg_temp.ok(x.id = q1, 'best price is the live 705 quote, not the expired 650');

  r := public.select_quotation(q3);
  perform pg_temp.ok(r->>'error' like '%expired%', 'expired quote cannot be selected');
  perform pg_temp.ok(public.select_quotation(q2) ? 'selected', 'q2 selected');
  perform pg_temp.ok(public.select_quotation(q1) ? 'selected', 'switching to q1 clears q2');
  select count(*) into n from public.supplier_quotations where requirement_id = req and selected; perform pg_temp.ok(n = 1, 'exactly one selected');
  select status into x from public.purchase_requirements where id = req;
  perform pg_temp.ok(x.status = 'in_progress', 'requirement moves to in_progress');

  -- PO from the quotation
  r := public.create_purchase_order(s1, null, current_date + 1, v_cold, 7, 0, 0, q1);
  po := (r->>'po_id')::uuid;
  perform pg_temp.ok(r->>'code' ~ '^PO-20[0-9]{2}-000001$', 'po code '||r::text);
  perform pg_temp.ok((public.create_purchase_order(s1, null, null, null, 0, 0, 0, q1)) ? 'error', 'quote used once');
  perform pg_temp.ok((public.create_purchase_order(s2, null, null, null, 0, 0, 0, q1)) ? 'error', 'wrong supplier refused');
  select count(*) into n from public.purchase_order_lines where po_id = po and qty_kg = 300 and price_per_kg = 690; perform pg_temp.ok(n = 1, 'line copied from the quote');
  select transport_cost into x from public.purchase_orders where id = po; perform pg_temp.ok(x.transport_cost = 3000, 'costs copied');

  r := public.release_purchase_order(po);
  perform pg_temp.ok(jsonb_array_length(r->'purchases') = 1, 'PO released into 1 PR');
  perform pg_temp.ok((public.release_purchase_order(po)) ? 'error', 'cannot release twice');
  select id into pr from public.procurement where po_id = po;
  select payment_terms into x from public.procurement where id = pr; perform pg_temp.ok(x.payment_terms = 'credit', '7-day terms -> credit');

  -- dispatch, receive -> PO and requirement complete themselves
  tl := (public.dispatch_procurement(array[pr], 'TN09', null, v_cold)->>'truck_load_id')::uuid;
  perform pg_temp.as_user(v_adm);
  perform public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_seer, 'good_kg', 300)));
  select status into x from public.purchase_orders where id = po;        perform pg_temp.ok(x.status = 'received', 'PO follows its PR to received (got '||x.status||')');
  select status into x from public.purchase_requirements where id = req; perform pg_temp.ok(x.status = 'completed', 'requirement completed (got '||x.status||')');

  -- market prices: latest per market, change vs previous, stale flag
  insert into public.market_prices (market, sku_id, price_date, price_per_kg) values
    ('Chennai', v_seer, current_date - 1, 700), ('Chennai', v_seer, current_date, 735),
    ('Coimbatore', v_seer, current_date - 5, 650);
  select * into x from public.latest_market_prices(v_seer) where market = 'Chennai';
  perform pg_temp.ok(x.price_per_kg = 735 and x.prev_price_per_kg = 700 and x.change_pct = 5.0 and not x.is_stale, 'Chennai +5%: '||x.change_pct);
  select * into x from public.latest_market_prices(v_seer) where market = 'Coimbatore';
  perform pg_temp.ok(x.is_stale, 'Coimbatore price 5 days old is stale');
  begin insert into public.market_prices (market, sku_id, price_date, price_per_kg) values ('Chennai', v_seer, current_date, 1);
        raise exception 'ASSERT FAILED: duplicate day';
  exception when unique_violation then null; end;
  perform pg_temp.ok(true, 'ok');
end $$;
