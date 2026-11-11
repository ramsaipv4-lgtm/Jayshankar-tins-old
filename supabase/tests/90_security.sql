-- Function access: nobody signed out can call anything; internal helpers are not client-callable.
do $$
declare
  v_adm uuid := 'a0000000-0000-0000-0000-000000000001';
  v_sela uuid := 'd0000000-0000-0000-0000-000000000001';
  v_cold uuid := 'c0000000-0000-0000-0000-000000000001';
  n int; r jsonb; fn record; called boolean;
begin
  -- 1) not one application function is executable by anon (or PUBLIC)
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'execute');
  perform pg_temp.ok(n = 0, n || ' public function(s) are still executable by anon');

  -- 2) the attacks that worked before 0046 are refused
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  called := false;
  begin perform public.container_sourced_cascade(v_sela, v_cold, 30, 'spoilage', null, gen_random_uuid(), 'x', v_adm); called := true;
  exception when others then null; end;
  perform pg_temp.ok(not called, 'anon wrote stock through container_sourced_cascade');
  called := false;
  begin perform public.direct_batch_cascade(v_sela, v_cold, 30, 'spoilage', null, gen_random_uuid(), 'x', v_adm); called := true;
  exception when others then null; end;
  perform pg_temp.ok(not called, 'anon wrote stock through direct_batch_cascade');
  called := false;
  begin perform public.notify_admins('x', '{}'::jsonb); called := true; exception when others then null; end;
  perform pg_temp.ok(not called, 'anon could call notify_admins');
  called := false;
  begin perform public.run_alert_sweeps(); called := true; exception when others then null; end;
  perform pg_temp.ok(not called, 'anon could run the alert sweep');
  called := false;
  begin perform public.resolve_quality_issue(gen_random_uuid()); called := true; exception when insufficient_privilege then null; end;
  perform pg_temp.ok(not called, 'anon passed resolve_quality_issue role check');
  perform pg_temp.as_superuser();

  -- 3) a signed-in user cannot call the internal helpers either
  perform pg_temp.as_user(v_adm);
  called := false;
  begin perform public.notify_admins('x', '{}'::jsonb); called := true; exception when insufficient_privilege then null; end;
  perform pg_temp.ok(not called, 'authenticated can call notify_admins directly');
  called := false;
  begin perform public.next_code('PR'); called := true; exception when insufficient_privilege then null; end;
  perform pg_temp.ok(not called, 'authenticated can call next_code directly');
  called := false;
  begin perform public.container_sourced_cascade(v_sela, v_cold, 1, 'spoilage', null, gen_random_uuid(), 'x', v_adm); called := true; exception when insufficient_privilege then null; end;
  perform pg_temp.ok(not called, 'authenticated can call container_sourced_cascade directly');
  perform pg_temp.as_superuser();

  -- 4) the service key / a scheduler (no end-user session) still can run the sweep
  r := public.run_alert_sweeps();
  perform pg_temp.ok(r ? 'expiring', 'service-side sweep still works');
end $$;
