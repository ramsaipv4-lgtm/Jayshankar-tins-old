do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_sup uuid := 'a0000000-0000-0000-0000-000000000005';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  s2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  r jsonb; p1 uuid; p2 uuid; tl uuid; n int; q record; b1 uuid; sale uuid; cust uuid;
begin
  perform pg_temp.as_user(v_adm);
  p1 := (public.create_procurement(v_sela, 100, s1, 200)->>'procurement_id')::uuid;
  p2 := (public.create_procurement(v_sela, 50, s2, 220)->>'procurement_id')::uuid;
  tl := (public.dispatch_procurement(array[p1,p2], 'TN01', null, v_cold)->>'truck_load_id')::uuid;
  update public.users set receiving_blind = true where id = v_sup;
  perform pg_temp.as_superuser();

  -- blind receiver receives, then raises a quality issue on the TRUCK (no supplier known)
  perform pg_temp.as_user(v_sup);
  perform public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'good_kg', 147, 'spoiled_kg', 0)));
  r := public.raise_quality_issue('soft_flesh', 30, tl, null, v_sela, null, 'soft near the gills');
  perform pg_temp.ok(r ? 'issue_id', 'issue raised: '||r::text);
  perform pg_temp.ok((public.raise_quality_issue('nonsense', 1, tl))::text like '%Unknown issue type%', 'bad type refused');
  perform pg_temp.ok((public.raise_quality_issue('other', 1))::text like '%which truck load%', 'needs a target');
  perform pg_temp.as_superuser();
  select count(*) into n from public.notifications where type='quality_issue'; perform pg_temp.ok(n >= 1, 'admins notified of the issue');

  -- the blind receiver cannot read the scorecard or the trace's supplier
  perform pg_temp.as_user(v_sup);
  begin perform * from public.vendor_quality_scorecard(); raise exception 'ASSERT FAILED: blind user read scorecard';
  exception when insufficient_privilege then null; end;
  select id into b1 from public.batches_safe limit 1;   -- exists through the view
  r := public.trace_batch(b1);
  perform pg_temp.ok(r->>'supplier' is null and r->'mixed_with' = '[]'::jsonb, 'blind trace hides suppliers: '||r::text);
  perform pg_temp.ok(r->>'honesty_note' is not null, 'mixed batch carries the honesty note');
  perform pg_temp.ok(r->>'receiving_code' like 'RCV-%', 'chain has the receiving code');
  perform pg_temp.as_superuser();

  -- admin scorecard: 30 kg split pro rata 100:50 -> 20 / 10
  perform pg_temp.as_user(v_adm);
  select * into q from public.vendor_quality_scorecard() where vendor_id = s1;
  perform pg_temp.ok(q.issue_kg_allocated = 20.000 and q.issues = 1, 's1 gets 20 kg allocated (got '||q.issue_kg_allocated||')');
  select * into q from public.vendor_quality_scorecard() where vendor_id = s2;
  perform pg_temp.ok(q.issue_kg_allocated = 10.000 and q.kg_received = 49.000, 's2 gets 10 kg, received 49 (got '||q.kg_received||')');
  perform pg_temp.ok(q.shortfall_kg = 1.000, 'shortfall = expected 50 - received 49');

  -- a sale from the s1 batch, then a complaint, then the trace and the scorecard
  select id into b1 from public.batches where procurement_id = p1;
  perform pg_temp.as_superuser();
  insert into public.customers (name, warehouse_id) values ('Hotel Saravana', (select id from public.warehouses where name='main')) returning id into cust;
  insert into public.sales (sku_id, location_id, customer_name, total_kg, sale_price_per_kg, total_amount, sold_by, customer_id)
    values (v_sela, v_cold, 'Hotel Saravana', 20, 300, 6000, v_adm, cust) returning id into sale;
  insert into public.movements (kind, from_location_id, sku_id, kg, batch_id, movement_group_id, sale_id, created_by)
    values ('sale', v_cold, v_sela, 20, b1, gen_random_uuid(), sale, v_adm);
  insert into public.customer_complaints (sale_id, customer_id, kg_returned, claim_description, status, kg_confirmed_bad, reported_by)
    values (sale, cust, 5, 'smelled off', 'resolved', 5, v_adm);

  perform pg_temp.as_user(v_adm);
  r := public.trace_sale(sale);
  perform pg_temp.ok(r->>'customer' = 'Hotel Saravana', 'sale trace names the customer');
  perform pg_temp.ok(jsonb_array_length(r->'sources') = 1, 'one source batch');
  perform pg_temp.ok(r->'sources'->0->'trace'->>'allocated_supplier' = 'Annamalai Boat' and r->'sources'->0->'trace'->>'supplier' is null, 'admin sees the supplier of a pro-rata share labelled as an allocation, not as the supplier');
  perform pg_temp.ok(jsonb_array_length(r->'sources'->0->'trace'->'mixed_with') = 2, 'and that the truck was mixed with 2 lots');
  perform pg_temp.ok(r->'sources'->0->'trace'->>'receiving_code' like 'RCV-%', 'receiving code in chain');
  select * into q from public.vendor_quality_scorecard() where vendor_id = s1;
  perform pg_temp.ok(q.complaints = 1 and q.complaint_bad_kg_allocated = 5.000, 'complaint lands on s1: '||q.complaints||'/'||q.complaint_bad_kg_allocated);

  -- resolve flow (admin only)
  perform pg_temp.as_user(v_wrk);
  begin perform public.resolve_quality_issue(gen_random_uuid()); raise exception 'ASSERT FAILED: worker resolved';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_user(v_adm);
  r := public.resolve_quality_issue((select id from public.quality_issues limit 1), 'credit note agreed');
  perform pg_temp.ok(r->>'status' = 'resolved', 'issue resolved');
  perform pg_temp.ok((public.resolve_quality_issue((select id from public.quality_issues limit 1))) ? 'error', 'cannot resolve twice');
end $$;
