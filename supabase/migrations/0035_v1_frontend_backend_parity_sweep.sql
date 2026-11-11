-- 0035_v1_frontend_backend_parity_sweep.sql — Jayshankar V1 sprint
-- A systematic frontend/backend parity audit, not another one-off spot-check: every client-
-- facing RPC's own role check was diffed against the App.tsx route (or in-page gate) that
-- actually reaches it. Two real findings, both fixed here + in the frontend:
--
-- 1. execute_sale_reversal's self-execute branch is dead code after migration 0033 --
-- can_self_reverse can now only ever be true on admin/co-admin, but admin/co-admin already take
-- the FIRST branch of this function's role check regardless of that flag. The ELSE (self-
-- execute) branch can therefore only ever be reached by a non-admin whose can_self_reverse is
-- guaranteed false by 0033's own trigger -- meaning it always raises the exception now, never
-- actually lets anyone through. Worse: ReversalRequests.tsx still showed a "Execute now
-- (self-reverse)" button to any non-admin whose OWN request an admin had manually approved
-- (decide(id, 'approved') is a plain client UPDATE, independent of can_self_reverse) -- a real
-- button that would always 403 when clicked. Removed from both sides: this migration drops the
-- dead branch (admin/co-admin only, matching what the code actually does now, not what it used
-- to do before 0033); the frontend fix (same commit, not this file) removes the button.
--
-- 2. record_container_spoilage/record_repack have always accepted admin/co-admin too (checked
-- directly in their own source, not assumed) -- /spoil and /repack never did. Not a lockout like
-- /transfer's or /deliver's (worker/super-worker/vendor-rep could already reach both), but the
-- same class of drift. Fixed in App.tsx (not this file, no schema change needed) -- both routes
-- widened to match their RPCs exactly, SpoilageForm.tsx/RepackForm.tsx given an explicit
-- admin/co-admin back-link branch instead of falling into the vendor-rep/else split that
-- predates their access.
--
-- Every other client-facing RPC (record_bill_delivery, confirm_delivery_arrival,
-- record_container_fill, record_container_sale, record_transfer_cascade, create_task[_round_
-- robin], file_customer_complaint, resolve_customer_complaint, reconcile_bill,
-- request_sale_reversal) already matched its route/in-page gate exactly -- checked, not assumed.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0034.

create or replace function public.execute_sale_reversal(p_reversal_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_req record;
  v_new_group_id uuid := gen_random_uuid();
  v_original record;
  v_reversed_count int := 0;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'execute_sale_reversal: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  select * into v_req from public.reversal_requests where id = p_reversal_request_id for update;
  if v_req is null then
    return jsonb_build_object('error', 'Reversal request not found');
  end if;
  if v_req.status = 'executed' then
    return jsonb_build_object('error', 'This reversal has already been executed');
  end if;
  if v_req.status = 'denied' then
    return jsonb_build_object('error', 'This request was denied');
  end if;
  if v_req.status not in ('requested', 'approved') then
    return jsonb_build_object('error', 'Request is not in an executable state');
  end if;

  for v_original in
    select * from public.movements where sale_id = v_req.sale_id for update
  loop
    insert into public.movements (
      kind, from_location_id, to_location_id, sku_id, kg, batch_id, container_fill_id,
      movement_group_id, sale_id, notes, occurred_at, created_by
    ) values (
      'reversal', null, v_original.from_location_id, v_original.sku_id, v_original.kg,
      v_original.batch_id, v_original.container_fill_id, v_new_group_id, v_req.sale_id,
      'Reversal of movement ' || v_original.id, now(), v_user_id
    );

    update public.batches set kg_remaining = kg_remaining + v_original.kg where id = v_original.batch_id;

    if v_original.container_fill_id is not null then
      update public.container_fills set kg_remaining = kg_remaining + v_original.kg where id = v_original.container_fill_id;
    end if;

    v_reversed_count := v_reversed_count + 1;
  end loop;

  if v_reversed_count = 0 then
    return jsonb_build_object('error', 'No original movements found for this sale');
  end if;

  update public.reversal_requests
     set status = 'executed',
         decided_by = coalesce(decided_by, v_user_id),
         decided_at = coalesce(decided_at, now()),
         executed_movement_group_id = v_new_group_id
   where id = p_reversal_request_id;

  return jsonb_build_object('movement_group_id', v_new_group_id, 'reversed_count', v_reversed_count);
end;
$$;

grant execute on function public.execute_sale_reversal(uuid) to authenticated;
