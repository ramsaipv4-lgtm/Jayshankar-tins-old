-- 0018_reversal_request_notifications.sql — Jayshankar V1 sprint
-- Wires the one notification trigger SPEC.md actually specifies a rule for: §4.3.11 step 2,
-- "admin/co-admin is still notified regardless" — both when a reversal request needs their
-- review (stays 'requested') and when a can_self_reverse requester's own request auto-approves
-- without them (migration 0017). Deliberately NOT a general notification taxonomy: the merged
-- SPEC references a "§F taxonomy" and a "core transactional subset" (§9's out-of-scope list)
-- that was never actually itemized in this document beyond this one rule and D31's one
-- exclusion (never a price-change type) — building more than this one concrete, locked
-- requirement would mean inventing requirements no one has actually asked for. See
-- BUILDER-DECISIONS-REVIEW.md decision #63.
--
-- notify_admins() is the generic writer every future notification trigger in this project should
-- call — SECURITY DEFINER, bypassing RLS, the exact same pattern audit_trigger() (migration
-- 0001) already established for a different table with the same "no INSERT policy for any
-- role, system-only write" shape (see rls-policies.sql's own comment on notifications' INSERT
-- policy, migration 0012 — it already named this as the intended future shape).
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0017.

create or replace function public.notify_admins(p_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in select id, role from public.users where role in ('admin', 'co-admin') loop
    insert into public.notifications (user_id, type, payload, role_at_creation)
    values (v_admin.id, p_type, p_payload, v_admin.role);
  end loop;
end;
$$;

-- Re-issued in full (not just the delta) per this project's own convention for a function that
-- gains new behaviour — matches how the container-sourced cascades were re-issued across
-- migrations 0009/0010 rather than patched with a separate ALTER.
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

  -- §4.3.11 step 2's "admin/co-admin is still notified regardless" — now actually wired, not
  -- just flagged as missing (see this function's own history in migration 0017's comment).
  perform public.notify_admins(
    case when v_status = 'approved' then 'reversal_auto_approved' else 'reversal_requested' end,
    jsonb_build_object('reversal_request_id', v_req_id, 'sale_id', p_sale_id, 'requested_by', v_user_id)
  );

  return jsonb_build_object('id', v_req_id, 'status', v_status);
end;
$$;
