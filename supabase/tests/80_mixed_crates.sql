do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  s2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  p1 uuid; p2 uuid; tl uuid; r jsonb; ba uuid; bb uuid; bill_a uuid; other_bill uuid; other_batch uuid; x record; n int;
begin
  perform pg_temp.as_user(v_adm);
  p1 := (public.create_procurement(v_sela, 60, s1, 200)->>'procurement_id')::uuid;
  p2 := (public.create_procurement(v_sela, 40, s2, 220)->>'procurement_id')::uuid;
  tl := (public.dispatch_procurement(array[p1,p2], 'TN', null, v_cold)->>'truck_load_id')::uuid;
  perform public.receive_truck_load(tl, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'good_kg', 100)));
  select batch_id, bill_id into ba, bill_a from public.procurement where id = p1;
  select batch_id into bb from public.procurement where id = p2;

  -- one 25 kg crate: 15 from supplier 1's share + 10 from supplier 2's share, anchored on bill A
  r := public.record_container_fill(bill_a, v_cold, 'TC-MIX1', 25, jsonb_build_array(
         jsonb_build_object('batch_id', ba, 'kg', 15), jsonb_build_object('batch_id', bb, 'kg', 10)));
  perform pg_temp.ok(not (r ? 'error'), 'mixed crate accepted: '||r::text);
  perform pg_temp.ok(public.container_fill_is_mixed((r->>'container_fill_id')::uuid), 'fill is mixed (derived from its items)');

  -- an unrelated bill's batch is still refused
  r := public.record_bill_delivery(s1, v_cold, current_date, null, jsonb_build_array(jsonb_build_object('sku_id', v_sela, 'kg', 20, 'price_per_kg_paid', 190)));
  other_bill := (r->>'bill_id')::uuid; other_batch := (r->'batches'->0->>'batch_id')::uuid;
  r := public.record_container_fill(bill_a, v_cold, 'TC-MIX2', 25, jsonb_build_array(
         jsonb_build_object('batch_id', ba, 'kg', 5), jsonb_build_object('batch_id', other_batch, 'kg', 5)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%one purchase event or one truck load%', 'unrelated bill refused: '||r::text);

  -- a plain single-bill crate still works and is NOT flagged
  r := public.record_container_fill(other_bill, v_cold, 'TC-ONE', 25, jsonb_build_array(jsonb_build_object('batch_id', other_batch, 'kg', 20)));
  perform pg_temp.ok(not (r ? 'error'), 'single-bill crate unchanged: '||r::text);
  perform pg_temp.ok(not public.container_fill_is_mixed((r->>'container_fill_id')::uuid), 'single-bill fill is not mixed');

  -- capacity rule still enforced
  r := public.record_container_fill(bill_a, v_cold, 'TC-MIX3', 5, jsonb_build_array(
         jsonb_build_object('batch_id', ba, 'kg', 3), jsonb_build_object('batch_id', bb, 'kg', 3)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%capacity%' or r->>'error' like 'Invalid%' or r->>'error' like '%exceeds%', 'capacity rule still applies: '||r::text);

  -- the card lists both lots and says the crate is mixed
  r := public.container_card(null, 'TC-MIX1');
  perform pg_temp.ok(jsonb_array_length(r->'contents') = 2 and (r->>'is_mixed_supplier')::boolean, 'card lists both lots and flags the crate as mixed');

  -- the same batch listed twice is refused (it would let the crate over-pack the batch)
  r := public.record_container_fill(bill_a, v_cold, 'TC-DUP', 25, jsonb_build_array(
         jsonb_build_object('batch_id', ba, 'kg', 5), jsonb_build_object('batch_id', ba, 'kg', 5)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%once%', 'duplicate batch line refused: '||r::text);
end $$;
