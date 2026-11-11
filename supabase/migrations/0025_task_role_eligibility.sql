-- 0025_task_role_eligibility.sql — Jayshankar V1 sprint
-- Fixes a real bug found before live-testing 0024: create_task_round_robin() picked from
-- vendor-rep/worker/super-worker for EVERY task type, ignoring a restriction that's been in
-- this app since W2/W3 — a plain 'worker' has never been allowed to receive deliveries or make
-- sales (record_bill_delivery/record_container_sale both explicitly exclude 'worker', per
-- §2.11's original design: the worker never handles pricing, customers, or vendors directly).
-- Round-robin-assigning a receive_delivery or make_sale task to a worker would have created a
-- task that employee can NEVER complete — auto_complete_task only fires from inside the RPC
-- that fulfills it, and a worker is permission-denied from calling either one. Found by asking
-- "why would a worker not get delegated a task" before any test ran, not discovered by a stuck
-- task in real data. See BUILDER-DECISIONS-REVIEW.md decision #71.
--
-- pack_repack is the one type where 'worker' genuinely IS eligible — record_repack (not
-- record_container_fill) already allows 'worker', and repack is explicitly the worker's
-- everyday task per §2.11 ("the worker's everyday 'move stock' action now"). custom tasks have
-- no RPC-level restriction at all (completed via a plain client UPDATE, RLS-gated by ownership
-- only), so every operational role stays eligible for those.
--
-- Same fix applied to create_task() (the manual/admin-picks path), not just round-robin — an
-- admin picking from a "large icon" employee grid in the not-yet-built frontend could make the
-- exact same mistake by hand; the RPC validates regardless of what the UI later does or doesn't
-- filter, matching this project's consistent "UI hides, the RPC actually enforces" pattern.
--
-- IDEMPOTENT: CREATE OR REPLACE. Run after 0001-0024.

create or replace function public.eligible_roles_for_task_type(p_type text)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'receive_delivery' then array['vendor-rep', 'super-worker']
    when 'make_sale'        then array['vendor-rep', 'super-worker']
    when 'pack_repack'      then array['vendor-rep', 'worker', 'super-worker']
    else                         array['vendor-rep', 'worker', 'super-worker'] -- 'custom'
  end;
$$;

create or replace function public.create_task(
  p_type text,
  p_assigned_to uuid,
  p_title text default null,
  p_related_vendor_id uuid default null,
  p_related_customer_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_task_id uuid;
  v_assignee_role text;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'create_task: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_type not in ('receive_delivery', 'make_sale', 'pack_repack', 'custom') then
    return jsonb_build_object('error', 'Invalid task type');
  end if;
  if p_type = 'custom' and (p_title is null or btrim(p_title) = '') then
    return jsonb_build_object('error', 'Custom tasks need a title');
  end if;

  select role into v_assignee_role from public.users where id = p_assigned_to and active;
  if v_assignee_role is null then
    return jsonb_build_object('error', 'Assignee not found or inactive');
  end if;
  if not (v_assignee_role = any(public.eligible_roles_for_task_type(p_type))) then
    return jsonb_build_object('error', format(
      '%s cannot be assigned a "%s" task — that role has no way to complete one', v_assignee_role, p_type));
  end if;

  insert into public.tasks (type, title, assigned_to, assigned_by, assignment_mode, related_vendor_id, related_customer_id, notes)
  values (p_type, p_title, p_assigned_to, auth.uid(), 'manual', p_related_vendor_id, p_related_customer_id, p_notes)
  returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id);
end;
$$;

create or replace function public.create_task_round_robin(
  p_type text,
  p_title text default null,
  p_related_vendor_id uuid default null,
  p_related_customer_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_task_id uuid;
  v_pick uuid;
begin
  if v_role is null or v_role not in ('admin', 'co-admin') then
    raise exception 'create_task_round_robin: role % not permitted', coalesce(v_role, '(none)') using errcode = '42501';
  end if;
  if p_type not in ('receive_delivery', 'make_sale', 'pack_repack', 'custom') then
    return jsonb_build_object('error', 'Invalid task type');
  end if;

  -- Least-currently-loaded, restricted to roles that can actually complete this task type —
  -- the fix this migration exists for (see header comment).
  select u.id into v_pick
    from public.users u
    left join public.tasks t on t.assigned_to = u.id and t.status in ('pending', 'in_progress')
   where u.active and u.role = any(public.eligible_roles_for_task_type(p_type))
   group by u.id
   order by count(t.id) asc, u.id asc
   limit 1;

  if v_pick is null then
    return jsonb_build_object('error', 'No active, eligible employee available to assign');
  end if;

  insert into public.tasks (type, title, assigned_to, assigned_by, assignment_mode, related_vendor_id, related_customer_id, notes)
  values (p_type, p_title, v_pick, auth.uid(), 'round_robin', p_related_vendor_id, p_related_customer_id, p_notes)
  returning id into v_task_id;

  return jsonb_build_object('task_id', v_task_id, 'assigned_to', v_pick);
end;
$$;

grant execute on function public.create_task(text, uuid, text, uuid, uuid, text) to authenticated;
grant execute on function public.create_task_round_robin(text, text, uuid, uuid, text) to authenticated;
