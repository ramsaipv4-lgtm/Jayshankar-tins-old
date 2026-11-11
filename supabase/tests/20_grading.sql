do $$
declare
  v_rep uuid := 'a0000000-0000-0000-0000-000000000003';
  v_wrk uuid := 'a0000000-0000-0000-0000-000000000004';
  v_transit uuid; v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  r jsonb; v_batch uuid; gA uuid; gB uuid; gC uuid; n int;
begin
  select id into v_transit from public.locations where kind='in_transit_inbound';
  select id into gA from public.grades where code='A' and sku_id is null;
  select id into gB from public.grades where code='B' and sku_id is null;
  select id into gC from public.grades where code='C' and sku_id is null;

  perform pg_temp.as_user(v_rep);
  r := public.record_bill_delivery('e0000000-0000-0000-0000-000000000001', v_transit, current_date, null,
        '[{"sku_id":"d0000000-0000-0000-0000-000000000001","kg":148.5,"price_per_kg_paid":210}]'::jsonb);
  v_batch := (r->'batches'->0->>'batch_id')::uuid;

  -- not received yet -> refused
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',100)));
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%not been received%', 'cannot grade in-transit fish: '||r::text);

  perform public.confirm_delivery_arrival(v_batch, v_cold, 148.5, 0);

  -- the deck's example: 80 + 45 + 20 = 145, shrink 3.5, received 148.5  -> accepted
  perform pg_temp.as_user(v_wrk);   -- a plain worker may grade (no money involved)
  r := public.record_grading_run(v_batch,
        jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',80), jsonb_build_object('grade_id',gB,'kg',45), jsonb_build_object('grade_id',gC,'kg',20)),
        3.5, 'ice melt');
  perform pg_temp.ok(r ? 'grading_run_id' and (r->>'unreconciled_kg')::numeric = 0, 'deck example reconciles: '||r::text);

  -- way off -> refused with numbers
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',60)), 0);
  perform pg_temp.ok(r ? 'error' and (r->>'gap_kg')::numeric = 88.5, 'gap reported: '||r::text);

  -- duplicate grade, unknown grade, zero kg -> refused
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',70), jsonb_build_object('grade_id',gA,'kg',70)), 8.5);
  perform pg_temp.ok(r ? 'error', 'duplicate grade refused');
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gen_random_uuid(),'kg',148.5)), 0);
  perform pg_temp.ok(r ? 'error', 'unknown grade refused');
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',0)), 0);
  perform pg_temp.ok(r ? 'error', 'zero kg refused');

  -- re-grade: old run superseded, history kept, exactly one live run
  r := public.record_grading_run(v_batch,
        jsonb_build_array(jsonb_build_object('grade_id',gA,'kg',90), jsonb_build_object('grade_id',gB,'kg',55)), 3.5);
  perform pg_temp.ok(r ? 'supersedes' and r->>'supersedes' is not null, 'second run supersedes first');
  select count(*) into n from public.grading_current_v where batch_id = v_batch;                perform pg_temp.ok(n = 2, 'current view shows the 2 live lines');
  perform pg_temp.as_superuser();
  select count(*) into n from public.grading_runs where batch_id = v_batch;                     perform pg_temp.ok(n = 2, 'both runs kept');
  select count(*) into n from public.grading_runs where batch_id = v_batch and superseded_at is null; perform pg_temp.ok(n = 1, 'one live run');
  select count(*) into n from public.audit_log where table_name='grading_runs';                 perform pg_temp.ok(n = 4, 'runs audited: 2 inserts + 2 supersede updates, got '||n);

  -- per-fish grade only for that fish
  insert into public.grades (sku_id, code, label) values ('d0000000-0000-0000-0000-000000000003','G1','Crab Grade 1')
    returning id into gC;
  perform pg_temp.as_user(v_wrk);
  r := public.record_grading_run(v_batch, jsonb_build_array(jsonb_build_object('grade_id',gC,'kg',145)), 3.5);
  perform pg_temp.ok(r ? 'error' and r->>'error' like '%different fish%', 'crab grade refused on a sela batch');

  -- workers cannot write grading tables directly
  begin insert into public.grading_runs (batch_id, sku_id, received_kg, graded_by) values (v_batch,'d0000000-0000-0000-0000-000000000001',1,v_wrk);
        raise exception 'ASSERT FAILED: direct insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
