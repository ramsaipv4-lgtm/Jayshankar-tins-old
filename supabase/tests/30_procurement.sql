do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sup uuid := 'a0000000-0000-0000-0000-000000000005';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  v_crab uuid := 'd0000000-0000-0000-0000-000000000003';
  s1 uuid := 'e0000000-0000-0000-0000-000000000001';
  s2 uuid := 'e0000000-0000-0000-0000-000000000002';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  r jsonb; p1 uuid; p2 uuid; p3 uuid; tl uuid; n int; k numeric; q record; stock_before numeric;
begin
  -- a worker cannot raise a purchase
  perform pg_temp.as_user(v_wrk);
  begin perform public.create_procurement(v_sela, 100, s1, 200); raise exception 'ASSERT FAILED: worker created PR';
  exception when insufficient_privilege then null; end;

  -- admin raises three PRs: sela 100kg@200 (s1), sela 50kg@220 (s2), crab 20kg@400 (s1)
  perform pg_temp.as_user(v_adm);
  r := public.create_procurement(v_sela, 100, s1, 200, now() + interval '1 day');  p1 := (r->>'procurement_id')::uuid;
  perform pg_temp.ok(r->>'code' ~ '^PR-20[0-9]{2}-000001$', 'first code format: '||r::text);
  r := public.create_procurement(v_sela, 50, s2, 220);                             p2 := (r->>'procurement_id')::uuid;
  perform pg_temp.ok(r->>'code' ~ '-000002$', 'codes increment');
  r := public.create_procurement(v_crab, 20, s1, 400);                             p3 := (r->>'procurement_id')::uuid;
  perform pg_temp.ok((public.create_procurement(v_sela, -1, s1, 200)) ? 'error', 'negative kg refused');
  perform pg_temp.as_superuser();

  -- stock unaffected by creating purchases (§2.2)
  select count(*) into n from public.batches;   perform pg_temp.ok(n = 0, 'no batches from PRs');
  select count(*) into n from public.movements; perform pg_temp.ok(n = 0, 'no movements from PRs');

  -- dispatch all three on one vehicle
  perform pg_temp.as_user(v_adm);
  r := public.dispatch_procurement(array[p1,p2,p3], 'TN-65-AB-1234', null, v_cold);
  tl := (r->>'truck_load_id')::uuid;
  perform pg_temp.ok(r->>'receiving_code' ~ '^RCV-20[0-9]{2}-000001$', 'receiving code: '||r::text);
  perform pg_temp.ok((public.dispatch_procurement(array[p1], null)) ? 'error', 'cannot dispatch twice');
  perform pg_temp.as_superuser();
  select count(*) into n from public.movements; perform pg_temp.ok(n = 0, 'dispatch moves no stock');

  -- make the super-worker a blind receiver and switch enforcement on
  perform pg_temp.as_user(v_adm);
  update public.users set receiving_blind = true where id = v_sup;
  perform public.set_app_setting('enforce_blind_receiving','true'::jsonb);
  perform pg_temp.as_superuser();

  -- blind receiver cannot read the purchase rows, sees the truck in the queue without supplier
  perform pg_temp.as_user(v_sup);
  select count(*) into n from public.procurement; perform pg_temp.ok(n = 0, 'blind receiver reads 0 procurement rows');
  select count(*) into n from public.list_receiving_queue() where source='truck_load'; perform pg_temp.ok(n = 2, 'queue: one row per fish (2 fish)');
  select * into q from public.list_receiving_queue() where sku_id = v_sela and source='truck_load';
  perform pg_temp.ok(q.expected_kg = 150 and q.vendor_name is null, 'sela line: 150 kg expected, supplier hidden');

  -- wrong inputs
  r := public.receive_truck_load(tl, '[{"sku_id":"d0000000-0000-0000-0000-000000000001","good_kg":140}]'::jsonb);
  perform pg_temp.ok(r ? 'error', 'must weigh every fish: '||r::text);

  -- receive: sela good 140 + spoiled 4 (expected 150); crab good 20 (expected 20)
  r := public.receive_truck_load(tl, jsonb_build_array(
        jsonb_build_object('sku_id', v_sela, 'good_kg', 140, 'spoiled_kg', 4),
        jsonb_build_object('sku_id', v_crab, 'good_kg', 20)), v_cold, 'two boxes soft');
  perform pg_temp.ok(r->>'discrepancy' = 'true', 'discrepancy because 144 vs 150: '||r::text);
  perform pg_temp.ok(not (r::text ~* 'price|rate|amount|supplier|vendor'), 'result leaks no money/supplier');
  perform pg_temp.ok((public.receive_truck_load(tl, '[]'::jsonb)) ? 'error', 'empty refused');
  r := public.receive_truck_load(tl, jsonb_build_array(
        jsonb_build_object('sku_id', v_sela, 'good_kg', 1), jsonb_build_object('sku_id', v_crab, 'good_kg', 1)), v_cold);
  perform pg_temp.ok(r->>'error' like '%already received%', 'cannot receive twice');
  perform pg_temp.as_superuser();

  -- physical kg posted, per supplier, pro rata
  select sum(kg), sum(kg_remaining) into q from public.batches where sku_id = v_sela;
  perform pg_temp.ok(q.sum = 144.000 and q.sum = 144, 'sela batch kg sums to physical 144 (got '||q.sum||')');
  select sum(kg_remaining) into k from public.batches where sku_id = v_sela;
  perform pg_temp.ok(k = 140.000, 'sela sellable stock is the GOOD 140 (got '||k||')');
  select kg into k from public.batches where procurement_id = p1;  perform pg_temp.ok(k = 96.000, 'supplier 1 share = 144*100/150 = 96 (got '||k||')');
  select kg into k from public.batches where procurement_id = p2;  perform pg_temp.ok(k = 48.000, 'supplier 2 share = 48 (got '||k||')');
  select count(*) into n from public.batches where truck_load_id = tl and is_pro_rata_share and sku_id = v_sela;
  perform pg_temp.ok(n = 2, 'both sela batches flagged pro-rata');
  select count(*) into n from public.batches where truck_load_id = tl and not is_pro_rata_share and sku_id = v_crab;
  perform pg_temp.ok(n = 1, 'crab came from one supplier -> not flagged');
  select sum(kg) into k from public.movements where kind='delivery_in' and sku_id = v_sela;  perform pg_temp.ok(k = 144, 'delivery_in at physical kg');
  select sum(kg) into k from public.movements where kind='spoilage' and sku_id = v_sela;     perform pg_temp.ok(k = 4, 'spoilage at physical kg');

  -- money: bills are the PROMISED amounts, one per supplier
  select count(*) into n from public.bills where id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(n = 2, 'one bill per supplier');
  select total_amount into k from public.bills where vendor_id = s1 and id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(k = 100*200 + 20*400, 'supplier 1 bill = promised 28000 (got '||k||')');
  select total_amount into k from public.bills where vendor_id = s2 and id in (select bill_id from public.procurement where truck_load_id = tl);
  perform pg_temp.ok(k = 50*220, 'supplier 2 bill = promised 11000');

  select count(*) into n from public.procurement where truck_load_id = tl and status='received'; perform pg_temp.ok(n = 3, 'all PRs received');
  select count(*) into n from public.truck_loads where id = tl and status='received';            perform pg_temp.ok(n = 1, 'truck received');
  select count(*) into n from public.receiving_confirmations where truck_load_id = tl;          perform pg_temp.ok(n = 3, '3 confirmations (one per batch)');
  select count(*) into n from public.notifications where type='truck_load_discrepancy';          perform pg_temp.ok(n >= 1, 'admins notified');
  select count(*) into n from public.audit_log where table_name='procurement' and action='UPDATE'; perform pg_temp.ok(n >= 6, 'procurement changes audited');

  -- DB-level guard: even an admin cannot flip status by hand
  perform pg_temp.as_user(v_adm);
  update public.procurement set expected_kg = 1 where id = p1;
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'direct UPDATE touches 0 rows (no update policy), got '||n);
  -- ... and a direct INSERT is refused for everyone
  begin insert into public.procurement (code, sku_id, supplier_id, rate_per_kg, expected_kg) values ('X', v_sela, s1, 1, 1);
        raise exception 'ASSERT FAILED: direct insert allowed';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_superuser();
  begin update public.procurement set status='received', received_kg=null, received_at=null where id = p1;
        raise exception 'ASSERT FAILED: check constraint missing';
  exception when check_violation then null; end;

  -- cancel flow
  perform pg_temp.as_user(v_adm);
  r := public.create_procurement(v_sela, 10, s1, 190); p1 := (r->>'procurement_id')::uuid;
  r := public.cancel_procurement(p1, 'supplier no-show');
  perform pg_temp.ok(r->>'status' = 'cancelled', 'cancel created PR');
  perform pg_temp.ok((public.cancel_procurement(p1)) ? 'error', 'cannot cancel twice');
end $$;
