-- 0002_handle_new_user_meta.sql — Jayshankar v1 schema patch
-- Implements SPEC.md §2.2.2. Replaces the original handle_new_user() with a
-- version that reads role + display_name from NEW.raw_user_meta_data (so
-- admin-driven user creation can supply both), with safe fallbacks so the
-- "first user becomes admin" guarantee still holds.
--
-- Why this exists: 0001_init.sql's handle_new_user() did NOT read display_name,
-- but public.users.display_name is NOT NULL. The trigger's INSERT blew up
-- with SQLSTATE 23502, which rolled back the auth.users INSERT. seed-auth-users.mjs
-- was failing with 0 created, 3 failed. Validator: §js-handle-new-user-meta
-- (the function must reference raw_user_meta_data so the bug doesn't regress).
--
-- IDEMPOTENT: CREATE OR REPLACE. The trigger re-creation is also idempotent
-- (DROP + CREATE).
--
-- Run after 0001_init.sql. No data loss — this only changes the function body.

-- ============================================================
-- 1. handle_new_user — reads role + display_name from raw_user_meta_data
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
  meta_role  text;
  meta_display text;
  resolved_role text;
  resolved_display text;
  email_local text;
begin
  -- Pull role + display_name from raw_user_meta_data if the caller supplied them
  -- (e.g. seed-auth-users.mjs, or admin-driven user creation with app_metadata).
  -- raw_user_meta_data is jsonb; ->> returns text or NULL.
  meta_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  -- Role resolution: caller-supplied wins; else first user becomes admin,
  -- subsequent users become 'worker' (SPEC §2.2.2).
  if meta_role is not null and meta_role in ('admin', 'vendor-rep', 'worker', 'super-worker') then
    resolved_role := meta_role;
  else
    select count(*) into user_count from public.users;
    if user_count = 0 then
      resolved_role := 'admin';
    else
      resolved_role := 'worker';
    end if;
  end if;

  -- Display name: caller-supplied wins; else synthesize from email local-part
  -- (e.g. 'admin' from 'admin@jayshankar.demo'). Guarantees NOT NULL.
  if meta_display is not null then
    resolved_display := meta_display;
  else
    email_local := split_part(coalesce(new.email, 'user'), '@', 1);
    if email_local = '' then
      email_local := 'user';
    end if;
    resolved_display := upper(substring(email_local from 1 for 1)) ||
                        substring(email_local from 2);
  end if;

  insert into public.users (id, email, role, display_name, created_at)
  values (new.id, coalesce(new.email, ''), resolved_role, resolved_display, now());
  return new;
end;
$$;

-- The trigger re-creation is already idempotent in 0001_init.sql, but we
-- re-state it here so a fresh apply of just this file (skipping 0001) is
-- also safe.
drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();
