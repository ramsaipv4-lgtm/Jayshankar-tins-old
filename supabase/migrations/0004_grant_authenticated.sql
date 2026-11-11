-- 0004_grant_authenticated.sql — Jayshankar v1 schema patch
-- Grants the `authenticated` role the table-level privileges it needs to run
-- browser code (the publishable key with a signed-in user runs as `authenticated`).
-- 0003_grant_service_role.sql only covered `service_role`; without this, every
-- Supabase JS query from a signed-in browser throws SQLSTATE 42501
-- "permission denied for table X" — even though RLS would have allowed it.
--
-- Why this exists: W2's useSession() reads public.users (to get the role for
-- the routing decision). The publishable key, with a signed-in user, runs as
-- `authenticated`. Default Supabase projects GRANT anon + authenticated + service_role
-- to all tables in `public` via ALTER DEFAULT PRIVILEGES, BUT only if those
-- defaults were set before the table was created. Our 0001_init.sql ran AFTER
-- the project init, so the defaults applied — except in some project states
-- (older projects, custom schema setups, the "fresh project after a reset"
-- case) the defaults don't kick in, and the result is exactly this 42501.
--
-- A real, easy-to-miss Supabase default-privileges gotcha: a fresh project's schema-level
-- default GRANTs only cover tables created AFTER the defaults were set, not before. Applies to
-- any project whose init migration runs immediately after project creation.
--
-- IDEMPOTENT: GRANT is idempotent. ALTER DEFAULT PRIVILEGES is also idempotent.

grant usage on schema public to authenticated;
grant all on all tables    in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all functions in schema public to authenticated;

alter default privileges in schema public grant all on tables    to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant all on functions to authenticated;
