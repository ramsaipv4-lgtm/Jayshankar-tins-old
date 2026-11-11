-- 0030_reassign_orphaned_tasks_on_role_change.sql — Jayshankar V1 sprint
-- Closes a real gap found while answering the user's own question about the team-management
-- frontend: TeamManagement.tsx lets an admin change anyone's role or turn their access off at
-- any time (a plain `update users set role=…, active=…`), but nothing ever looked at whether
-- that person still had open tasks. /my-tasks is route-gated to the 3 operational roles
-- (OPERATIONAL_ROLES in lib/tasks.ts) — if someone holding a `pending`/`in_progress` task gets
-- promoted to admin/co-admin, or is turned off, the task row itself doesn't change: it stays
-- `assigned_to` them, permanently unreachable through their own screen, not automatically
-- reassigned or flagged anywhere except incidentally in TaskDelegation.tsx's 20-most-recent
-- feed. See BUILDER-DECISIONS-REVIEW.md decision #79.
--
-- Fixed as a TRIGGER on `users`, not a new RPC wrapping the update — TeamManagement.tsx's own
-- write is a plain table UPDATE today (relying on RLS, not an RPC), and this project's own
-- pattern for structural invariants that must hold "no matter how the row gets written" is a
-- trigger (apply_movement_to_batches, auto_complete_task's callers), not trusting every future
-- call site to remember to do the right thing by hand.
--
-- Reassignment logic mirrors create_task_round_robin()/eligible_roles_for_task_type() (migration
-- 0025) exactly — least-currently-loaded, restricted to roles that can actually complete that
-- task's type — so a force-reassigned task lands somewhere it's actually completable, not just
-- somewhere it's off the original holder's plate.
--
-- Honest edge case, not silently papered over: if literally no other eligible active employee
-- exists (a single-operational-employee shop), there is nothing to reassign to — the task stays
-- exactly where it was, unchanged. That's a real "someone needs to look at this by hand" case,
-- not a bug in this trigger.
--
-- IDEMPOTENT: CREATE OR REPLACE + DROP TRIGGER IF EXISTS/CREATE TRIGGER. Run after 0001-0029.

create or replace function public.reassign_orphaned_tasks_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_pick uuid;
  v_reassigned_count int := 0;
begin
  -- Only relevant if this person WAS eligible to hold operational tasks before this update...
  if not (old.active and old.role in ('vendor-rep', 'worker', 'super-worker')) then
    return new;
  end if;
  -- ...and is NOT any more. (A role change between the 3 operational roles, e.g. worker →
  -- vendor-rep, doesn't orphan anything — eligible_roles_for_task_type() is re-checked per task
  -- below anyway, so a task that genuinely became uncompletable for them specifically still
  -- moves; one that's still fine stays put.)
  if new.active and new.role in ('vendor-rep', 'worker', 'super-worker') then
    return new;
  end if;

  for v_task in
    select id, type
      from public.tasks
     where assigned_to = new.id
       and status in ('pending', 'in_progress')
     order by assigned_at asc
  loop
    select u.id into v_pick
      from public.users u
      left join public.tasks t on t.assigned_to = u.id and t.status in ('pending', 'in_progress')
     where u.active
       and u.id <> new.id
       and u.role = any(public.eligible_roles_for_task_type(v_task.type))
     group by u.id
     order by count(t.id) asc, u.id asc
     limit 1;

    if v_pick is not null then
      update public.tasks
         set assigned_to = v_pick,
             assignment_mode = 'round_robin',
             assigned_at = now(),
             notes = trim(coalesce(notes, '') || E'\n' ||
               format('Auto-reassigned: %s no longer holds an eligible role (was %s, now %s%s).',
                 new.display_name, old.role, new.role, case when not new.active then ', inactive' else '' end))
       where id = v_task.id;
      v_reassigned_count := v_reassigned_count + 1;
    end if;
    -- else: no eligible candidate exists at all — left exactly as-is, deliberately (see header).
  end loop;

  if v_reassigned_count > 0 then
    perform public.notify_admins('tasks_reassigned', jsonb_build_object(
      'from_user_id', new.id, 'from_display_name', new.display_name,
      'count', v_reassigned_count, 'old_role', old.role, 'new_role', new.role, 'new_active', new.active
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reassign_orphaned_tasks on public.users;
create trigger trg_reassign_orphaned_tasks
  after update of role, active on public.users
  for each row
  when (old.role is distinct from new.role or old.active is distinct from new.active)
  execute function public.reassign_orphaned_tasks_on_role_change();
