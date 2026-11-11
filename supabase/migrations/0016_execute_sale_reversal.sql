-- 0016_execute_sale_reversal.sql — Jayshankar V1 sprint
-- Implements SPEC.md D22/§4.3.11: the reversal EXECUTION algorithm. Migration 0012 built the
-- request/approval schema only, deliberately ("not the algorithms on top of it" — its own
-- comment) -- this is that algorithm. Approve/deny (UPDATE status, admin/co-admin only) works
-- as a plain RLS-gated write, no RPC needed for that. Request creation turned out to need its
-- own RPC too (migration 0017, added after this file was first written -- see its own comment
-- for why a plain client INSERT couldn't safely decide the §4.3.11 step 2 auto-approval).
-- EXECUTION is the other part that needs SECURITY DEFINER, because restoring stock correctly
-- requires bypassing the normal movement trigger (see below) and, for the self-execute
-- exemption, checking users.can_self_reverse in code rather than through the reversal_requests
-- UPDATE policy (which RLS restricts to admin/co-admin only -- a self-reversing rep has no
-- other path to transition their own request).
--
-- Real, checked-not-assumed finding this design depends on: apply_movement_to_batches (0001)
-- only acts on kind IN ('transfer','sale','spoilage') -- 'reversal' isn't in that list, so
-- inserting a kind='reversal' movement does NOT automatically restore batches.kg_remaining.
-- This function restores it explicitly, the same way container_fills.kg_remaining is already
-- handled explicitly elsewhere in this project (the container cascade functions, migration 0009).
--
-- Reverses every original movement tied to the sale (there can be several -- a single sale can
-- draw from multiple container fills and multiple direct batches via the two-phase cascade,
-- migration 0009) by mirroring each one: same batch_id/container_fill_id/kg, direction reversed,
-- kind='reversal', grouped under one new movement_group_id.
--
-- Notifications (D27) are deliberately NOT written here -- that's its own, not-yet-built piece
-- of this sprint (nothing writes to public.notifications anywhere yet); this migration is scoped
-- to stock correctness, the highest-risk part, not the full notification taxonomy.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0015.

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
  v_can_self boolean;
  v_new_group_id uuid := gen_random_uuid();
  v_original record;
  v_reversed_count int := 0;
begin
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

  if v_role in ('admin', 'co-admin') then
    -- Admin/co-admin can execute a 'requested' or already-'approved' request directly.
    if v_req.status not in ('requested', 'approved') then
      return jsonb_build_object('error', 'Request is not in an executable state');
    end if;
  else
    -- Self-execute path (D22): only the original requester, only with the per-employee
    -- exemption, and only once the request is 'approved' -- which, per §4.3.11 step 2, a
    -- can_self_reverse requester's own request already is from the moment of creation
    -- (request_sale_reversal, migration 0017, sets that server-side). A still-'requested' row
    -- here means either the exemption wasn't set at creation time or this is someone else's
    -- request -- either way, not self-executable.
    select can_self_reverse into v_can_self from public.users where id = v_user_id;
    if v_req.requested_by is distinct from v_user_id or coalesce(v_can_self, false) is not true
       or v_req.status != 'approved' then
      raise exception 'execute_sale_reversal: not permitted' using errcode = '42501';
    end if;
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
