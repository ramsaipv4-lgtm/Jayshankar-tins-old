-- 0046_lock_down_function_access.sql — security fix, independent of Phase B (apply it first if you apply nothing else)
--
-- THE PROBLEM. PostgreSQL grants EXECUTE on every new function to PUBLIC by default, and Supabase
-- additionally grants it to `anon` (the role of anyone holding the project's public API key, i.e.
-- every visitor to the website, signed in or not). Most application RPCs check the caller's role
-- and refuse a signed-out caller, but several SECURITY DEFINER helpers do not, and they run with
-- the owner's rights. Reproduced against the migrations as shipped, as the `anon` role:
--
--     select public.container_sourced_cascade(<sku>, <location>, 30, 'spoilage', null, gen_random_uuid(), 'x', <any user id>);
--       -> writes off 30 kg of stock, attributed to whichever user id the caller names
--     select public.notify_admins('anything', '{}');   -> inserts a notification row for every admin
--
-- (direct_batch_cascade, notify_user and auto_complete_task are open the same way.) None of these
-- is called from the browser: the app only ever calls the user-facing RPCs below them.
--
-- THE FIX, in three parts:
--   1. Nobody but a signed-in user can execute any function in `public` (PUBLIC and anon revoked;
--      `authenticated` and `service_role` keep the grants migrations 0003/0004 gave them).
--   2. Default privileges are changed so functions created LATER are not handed to PUBLIC/anon either.
--   3. The internal helpers that were never meant to be called from a client are also revoked from
--      `authenticated`. They keep working: a SECURITY DEFINER function that calls another function
--      runs it with the owner's rights, and trigger functions are checked only when the trigger is created.
--
-- If a future feature genuinely needs an anonymous RPC (a public status page, say), grant it
-- explicitly and add a role-aware check inside it.
--
-- IDEMPOTENT. Safe to run at any point; re-run it after adding functions if you have not changed
-- the default privileges on the role that creates them.

revoke execute on all functions in schema public from public, anon;

alter default privileges in schema public revoke execute on functions from public, anon;

do $$
declare sig text;
begin
  -- internal helpers: server-side only
  for sig in
    select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'container_sourced_cascade', 'direct_batch_cascade', 'auto_complete_task',
         'notify_admins', 'notify_user', 'notify_task_completion',
         'apply_movement_to_batches', 'audit_trigger', 'handle_new_user', 'handle_user_delete',
         'provision_warehouse_transit_locations', 'reassign_orphaned_tasks_on_role_change',
         'track_user_role_change', 'clamp_can_self_reverse', 'sync_po_status', 'touch_updated_at',
         'next_code', '_notify_once', '_vendor_quality_scorecard')
  loop
    execute 'revoke execute on function ' || sig || ' from public, anon, authenticated';
  end loop;
end $$;
