-- BACKEND-REQUIREMENTS §2.1 — receiving must never see vendor or rate.
do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_sup uuid := 'a0000000-0000-0000-0000-000000000005';
  v_transit uuid; r jsonb; n int; q record;
begin
  select id into v_transit from public.locations where kind='in_transit_inbound';
  -- a rep records a bill into the inbound-transit location
  perform pg_temp.as_user(v_rep);
  r := public.record_bill_delivery('e0000000-0000-0000-0000-000000000001', v_transit, current_date, 'AN-77',
        '[{"sku_id":"d0000000-0000-0000-0000-000000000001","kg":150,"price_per_kg_paid":212}]'::jsonb);
  perform pg_temp.ok(r ? 'bill_id', 'bill recorded: '||r::text);
  perform pg_temp.as_superuser();

  -- 1) BEFORE the switch: documents today's exposure — a worker CAN read vendor and price.
  perform pg_temp.as_user(v_wrk);
  select count(*) into n from public.batches where price_per_kg_paid is not null and vendor_id is not null;
  perform pg_temp.ok(n = 1, 'baseline: worker can read vendor/price from batches while the switch is off');
  perform pg_temp.as_superuser();

  -- 2) turn the switch on (admin only)
  perform pg_temp.as_user(v_rep);
  begin
    perform public.set_app_setting('enforce_blind_receiving','true'::jsonb);
    raise exception 'ASSERT FAILED: rep must not flip the switch';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_superuser();
  perform pg_temp.as_user(v_adm);
  r := public.set_app_setting('enforce_blind_receiving','true'::jsonb);
  perform pg_temp.ok(r->>'value' = 'true', 'admin turned the switch on');
  perform pg_temp.as_superuser();

  -- 3) worker: base tables go dark, safe view still works
  perform pg_temp.as_user(v_wrk);
  select count(*) into n from public.batches;          perform pg_temp.ok(n = 0, 'worker sees 0 batches rows');
  select count(*) into n from public.bills;            perform pg_temp.ok(n = 0, 'worker sees 0 bills rows');
  select count(*) into n from public.vendors;          perform pg_temp.ok(n = 0, 'worker sees 0 vendors rows');
  select count(*) into n from public.batches_safe;     perform pg_temp.ok(n = 1, 'worker still sees the batch through batches_safe');
  select kg_remaining into q from public.batches_safe;
  perform pg_temp.ok(q.kg_remaining = 150, 'quantity visible');
  begin
    execute 'select vendor_id from public.batches_safe';
    raise exception 'ASSERT FAILED: batches_safe must not expose vendor_id';
  exception when undefined_column then null; end;
  begin
    execute 'select price_per_kg_paid from public.batches_safe';
    raise exception 'ASSERT FAILED: batches_safe must not expose the rate';
  exception when undefined_column then null; end;
  perform pg_temp.as_superuser();

  -- 4) rep (not blind yet) still sees everything
  perform pg_temp.as_user(v_rep);
  select count(*) into n from public.batches; perform pg_temp.ok(n = 1, 'non-blind rep still reads batches');
  perform pg_temp.as_superuser();

  -- 5) admin marks super-worker blind -> they lose the base tables but keep the queue
  perform pg_temp.as_user(v_adm);
  update public.users set receiving_blind = true where id = v_sup;
  perform pg_temp.as_superuser();
  perform pg_temp.as_user(v_sup);
  select count(*) into n from public.batches; perform pg_temp.ok(n = 0, 'blind super-worker sees 0 batches');
  select count(*) into n from public.vendors; perform pg_temp.ok(n = 0, 'blind super-worker sees 0 vendors');
  select * into q from public.list_receiving_queue();
  perform pg_temp.ok(q.expected_kg = 150 and q.english_name = 'Sela Fish', 'blind user gets the queue row');
  perform pg_temp.ok(q.vendor_name is null and q.bill_number is null, 'queue hides vendor and bill number from the blind user');
  perform pg_temp.ok(q.short_code like 'RCV-%', 'receiving code present');
  perform pg_temp.as_superuser();

  -- 6) the non-blind rep gets the vendor name in the queue
  perform pg_temp.as_user(v_rep);
  select * into q from public.list_receiving_queue();
  perform pg_temp.ok(q.vendor_name = 'Annamalai Boat' and q.bill_number = 'AN-77', 'non-blind rep sees vendor in the queue');
  perform pg_temp.as_superuser();

  -- 7) a plain worker may not call the queue at all (same role set as confirm_delivery_arrival)
  perform pg_temp.as_user(v_wrk);
  begin perform * from public.list_receiving_queue(); raise exception 'ASSERT FAILED: worker called queue';
  exception when insufficient_privilege then null; end;
  perform pg_temp.as_superuser();

  -- 8) the confirm RPC works for a blind user and does not leak money in its result
  perform pg_temp.as_user(v_sup);
  r := public.confirm_delivery_arrival(
        (select ref_id from public.list_receiving_queue() limit 1),
        'c0000000-0000-0000-0000-000000000001', 146, 2, null, 'two crates soft', 'none');
  perform pg_temp.ok(r->>'discrepancy_flag' = 'true', 'discrepancy raised on 148 vs 150');
  perform pg_temp.ok(not (r::text ~* 'price|vendor|rate|amount'), 'confirm result carries no money fields: '||r::text);
  perform pg_temp.as_superuser();

  -- 9) audit: the bill row is now in audit_log (coverage fix)
  select count(*) into n from public.audit_log where table_name = 'bills';
  perform pg_temp.ok(n >= 1, 'bills inserts are audited now');
  select count(*) into n from public.audit_log where table_name = 'receiving_confirmations';
  perform pg_temp.ok(n >= 1, 'receiving_confirmations inserts are audited');
end $$;

-- Views must be read-only for signed-in users (default privileges grant ALL on new views; 0038 revokes it)
do $$
declare v_wrk uuid := 'a0000000-0000-0000-0000-000000000004'; v text; c text; stmt text; wrote boolean;
begin
  perform pg_temp.as_user(v_wrk);
  foreach v in array array['batches_safe', 'grading_current_v', 'supplier_quotations_landed_v'] loop
    select column_name into c from information_schema.columns where table_schema='public' and table_name=v order by ordinal_position limit 1;
    foreach stmt in array array[format('update public.%I set %I = %I', v, c, c), format('delete from public.%I', v)] loop
      wrote := false;
      begin execute stmt; wrote := true; exception when others then null; end;   -- any error = refused
      perform pg_temp.ok(not wrote, 'write allowed through view: ' || stmt);
    end loop;
  end loop;
  wrote := false;
  begin insert into public.batches_safe (id) values (gen_random_uuid()); wrote := true; exception when others then null; end;
  perform pg_temp.ok(not wrote, 'INSERT allowed through batches_safe');
  perform pg_temp.as_superuser();
end $$;
