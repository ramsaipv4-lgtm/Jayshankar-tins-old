-- 0003_grant_service_role.sql — Jayshankar v1 schema patch
-- Grants the Supabase service_role the table-level privileges it needs to
-- bypass RLS in practice. (RLS bypass is one half; GRANT is the other half —
-- the seed-auth-users.mjs script PATCHes public.users as service_role, and
-- failed with SQLSTATE 42501 because service_role lacks DML on the table.)
--
-- Why this exists: 0001_init.sql created the tables as the `postgres` role.
-- service_role in Supabase gets BYPASSRLS by default but does NOT get DML
-- GRANTs on tables in `public`. The seed.sql works because it runs in the
-- SQL Editor as `postgres` (schema owner). Any server-side script that uses
-- the secret key (e.g. seed-auth-users.mjs, future admin scripts, Edge
-- Functions that touch the DB directly) needs these GRANTs.
--
-- The pattern is the Supabase-recommended one — see the docs on
-- "service_role" privileges. Without it, every script that hits the REST
-- API as service_role hits the same wall.
--
-- IDEMPOTENT: GRANT is idempotent. Re-running this file is a no-op.
--
-- Run after 0002_handle_new_user_meta.sql. No data loss.

-- Schema-level: required so service_role can look up objects in `public`.
-- (service_role already has usage on public in a fresh Supabase project, but
-- we re-state it for safety — GRANT USAGE is idempotent.)
grant usage on schema public to service_role;

-- Table-level: SELECT, INSERT, UPDATE, DELETE on every existing table in
-- public. The "all tables in schema" form catches the 9 tables in 0001 plus
-- any future ones (as long as this migration is re-applied after schema
-- changes — see the new `js-grant-covers-all` validator check).
grant all on all tables in schema public to service_role;

-- Sequence-level: needed for INSERTs that use serial/identity columns.
-- Most Jayshankar tables use gen_random_uuid() (not sequences), but a few
-- future tables may not; the GRANT is cheap insurance.
grant all on all sequences in schema public to service_role;

-- Function-level: needed so the seed-auth-users.mjs PATCH (which calls
-- PostgREST) can use functions like public.current_user_role(). PostgREST
-- uses service_role when the secret key is presented, so service_role needs
-- EXECUTE on any function the API path invokes.
grant all on all functions in schema public to service_role;

-- Default privileges: any FUTURE table/sequence/function created in public
-- will also get these GRANTs to service_role automatically. This means we
-- don't have to re-run this migration after every schema change — but we
-- still re-run it for the "existing" GRANTs above (the ALTER DEFAULT
-- PRIVILEGES doesn't retroactively cover pre-existing objects).
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;
