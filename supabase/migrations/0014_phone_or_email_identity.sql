-- 0014_phone_or_email_identity.sql — Jayshankar Mode B schema patch
-- Implements SPEC.md D35 / §4.2.1 / §4.3.12: a phone-only account (admin.createUser with
-- phone_confirm: true, no password, ever) is now a real, first-class way to onboard someone,
-- not just an email account with an optional phone number attached.
--
-- Why this is needed, not just nice-to-have: public.users.email has been NOT NULL since
-- 0001_init.sql. handle_new_user() (migration 0002, amended by 0012) is an AFTER INSERT trigger
-- on auth.users — if its INSERT into public.users ever violated a NOT NULL constraint, the
-- whole auth.users INSERT transaction rolls back, silently breaking every phone-only account at
-- creation time. This migration fixes the root cause (the constraint) rather than papering over
-- it with an empty-string sentinel.
--
-- Verified live against the real Admin API before writing this (not assumed): a phone-only
-- auth.users row does NOT come back with email = NULL -- GoTrue itself represents "no email" as
-- '' (its own historical NOT NULL convention, same reason 0002 originally coalesced to ''; same
-- for phone on an email-only account). This migration's job is to normalise THAT into a real
-- NULL on our own table, not to assume Supabase already hands us one.
--
-- IDEMPOTENT: ALTER COLUMN DROP NOT NULL is naturally idempotent (no-op if already nullable);
-- the CHECK constraint uses the same dynamic-drop-by-definition pattern as migrations 0011/0012
-- (find and drop by pattern match, not by an assumed auto-generated name) so re-running this
-- file is safe; CREATE OR REPLACE for the function.
--
-- Run after 0001–0013.

-- ============================================================
-- 1. users.email becomes nullable; a users_identity_present CHECK replaces the guarantee
--    NOT NULL used to provide (SPEC.md §4.2.1, D35).
-- ============================================================

alter table public.users alter column email drop not null;

do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%email%is not null%or%phone%is not null%'
      and conname = 'users_identity_present'
  loop
    execute format('alter table public.users drop constraint %I', con.conname);
  end loop;
end $$;

-- nullif(..., '') rather than a bare IS NOT NULL: GoTrue's own '' convention (see above) means a
-- naive IS NOT NULL check would be trivially satisfied by an empty string that isn't really an
-- identity at all. Self-defending at the constraint level, not just relying on every write path
-- (today, only the trigger below) to have normalised first.
alter table public.users
  add constraint users_identity_present
  check (nullif(email, '') is not null or nullif(phone, '') is not null);

-- ============================================================
-- 2. handle_new_user() — now also mirrors new.phone into public.users.phone (previously
--    declared in the table but never actually populated by this trigger), and normalises
--    GoTrue's own '' convention (see above) into a real NULL on our table for whichever
--    identifier is absent, instead of carrying '' straight through.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
  meta_role  text;
  meta_display text;
  resolved_role text;
  resolved_display text;
  email_local text;
begin
  meta_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  if meta_role is not null and meta_role in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker') then
    resolved_role := meta_role;
  else
    select count(*) into user_count from public.users;
    if user_count = 0 then
      resolved_role := 'admin';
    else
      resolved_role := 'worker';
    end if;
  end if;

  if meta_display is not null then
    resolved_display := meta_display;
  else
    -- Fallback only — every path this project actually drives (seed script, invite-user Edge
    -- Function) always supplies meta_display. Kept correct for a hypothetical future self-serve
    -- signup: falls back to the email local-part, then the raw phone number, then 'user'.
    -- nullif(...,'') matters here: coalesce alone would stop at new.email's '' (GoTrue's "no
    -- email" convention) and never fall through to phone at all.
    email_local := split_part(coalesce(nullif(new.email, ''), nullif(new.phone, ''), 'user'), '@', 1);
    if email_local = '' then
      email_local := 'user';
    end if;
    resolved_display := upper(substring(email_local from 1 for 1)) ||
                        substring(email_local from 2);
  end if;

  insert into public.users (id, email, phone, role, display_name, created_at)
  values (new.id, nullif(new.email, ''), nullif(new.phone, ''), resolved_role, resolved_display, now());
  return new;
end;
$$;
