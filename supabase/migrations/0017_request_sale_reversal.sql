-- 0017_request_sale_reversal.sql — Jayshankar V1 sprint
-- Implements SPEC.md §4.3.11 step 2, which migration 0016/`ReversalRequests.tsx` first built
-- around a plain client-side INSERT into reversal_requests and got wrong: "If
-- users.can_self_reverse is true for the requester, auto-transition to approved (decided_by =
-- requested_by)" happens AT REQUEST-CREATION TIME, not later as a separate self-execute step on
-- a still-'requested' row. Caught and fixed in the same sprint, before anything was applied to
-- the live database — see BUILDER-DECISIONS-REVIEW.md decision #62.
--
-- Why this has to be server-side, not a client INSERT with status picked client-side (the
-- reversal_requests_insert_rep RLS policy's own comment already flags this, migration 0012):
-- the plain INSERT policy has no cheap way to see "is this the requester's own row AND do they
-- have can_self_reverse" without a per-row subquery, so it can't restrict which status a rep is
-- allowed to insert. A raw client insert of status='approved' would have to be trusted, meaning
-- any vendor-rep could grant themselves the exemption just by setting that field, regardless of
-- their real can_self_reverse value. This function checks the real, current value itself
-- (SECURITY DEFINER, same pattern as execute_sale_reversal) before deciding the status, so the
-- client never gets to assert it.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0016.

create or replace function public.request_sale_reversal(
  p_sale_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_user_id uuid := auth.uid();
  v_can_self boolean;
  v_req_id uuid := gen_random_uuid();
  v_status text := 'requested';
  v_decided_by uuid := null;
  v_decided_at timestamptz := null;
begin
  -- Role check — matches rls-policies.sql's reversal_requests INSERT policy: anyone who can
  -- make a sale can request its reversal.
  if v_role is null or v_role not in ('admin', 'co-admin', 'vendor-rep', 'super-worker') then
    raise exception 'request_sale_reversal: role % not permitted', coalesce(v_role, '(none)')
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.sales where id = p_sale_id) then
    return jsonb_build_object('error', 'Sale not found');
  end if;

  if exists (
    select 1 from public.reversal_requests
    where sale_id = p_sale_id and status in ('requested', 'approved')
  ) then
    return jsonb_build_object('error', 'A reversal request for this sale is already pending');
  end if;

  -- §4.3.11 step 2 — checked against the real, current value, not trusted from the client.
  select can_self_reverse into v_can_self from public.users where id = v_user_id;
  if coalesce(v_can_self, false) is true then
    v_status := 'approved';
    v_decided_by := v_user_id;
    v_decided_at := now();
  end if;

  insert into public.reversal_requests (
    id, sale_id, requested_by, reason, status, decided_by, decided_at
  ) values (
    v_req_id, p_sale_id, v_user_id, p_reason, v_status, v_decided_by, v_decided_at
  );

  -- §4.3.11 step 2 also requires: "admin/co-admin is still notified regardless" — even when
  -- auto-approved, so a self-reverse action never happens silently outside admin's view. Not
  -- yet possible: nothing writes to public.notifications anywhere in this project yet
  -- (BUILDER-DECISIONS-REVIEW.md decision #61 flagged this as the sprint's next piece).
  -- Deliberately flagged here, not silently dropped — this is where that write belongs once
  -- the notification taxonomy exists.
  --
  -- Wired two migrations later: migration 0018 re-issues this function with the actual
  -- notify_admins() call added, once that piece was built. This comment is left as written —
  -- an accurate record of the gap at the time this file was first added, same as D38's own
  -- self-correction pattern in SPEC.md.

  return jsonb_build_object('id', v_req_id, 'status', v_status);
end;
$$;
