-- 0022_looker_studio_readonly_role.sql — D26, §8.14b
-- "Google Looker Studio is the self-service reporting tool... The admin gets a dedicated
-- read-only Postgres role; Postgres-level RLS must be configured on that role explicitly."
-- Confirmed a real V1 deliverable (D26's own text), not deferred — this had never been built;
-- found via a direct audit of SPEC.md's §8 acceptance criteria against the actual codebase
-- (grep for "warehouse_id"/"looker"/"readonly" in rls-policies.sql returned nothing).
--
-- What this migration does NOT do, deliberately: set the role's actual login password. A real
-- password can't safely live in a committed SQL file (the same "rotate first, clean second"
-- discipline this project applies to every other secret — .env, the service-role key). The
-- password is set once, directly in the Supabase Dashboard SQL Editor, by whoever administers
-- this — see docs/LOOKER-STUDIO-SETUP.md for the exact command and the rest of the connection
-- walkthrough.
--
-- Design: this role gets real table-level GRANTs (SELECT only — no INSERT/UPDATE/DELETE, which
-- is §8.14b's literal acceptance criterion), not RLS-policy-scoped access. Two reasons this is
-- the right shape here, not a shortcut: (1) the admin/wholesaler is the only person who will
-- ever hold this role's password — Postgres's own role-level authentication (a long, unique
-- password known only to them) is the actual security boundary, the same trust model this
-- project already uses for service_role's key; (2) Looker Studio reporting needs a genuine
-- cross-role, cross-warehouse view of the whole business (revenue trends, stock levels, vendor
-- performance) — RLS policies in this project are all scoped to what a signed-in APP USER's
-- role should see, a different, narrower question than "what should the business owner's own
-- reporting tool see." BYPASSRLS is granted for exactly this reason, mirroring service_role's
-- own precedent (migration 0003) — not a new pattern invented here.
--
-- IDEMPOTENT: DO blocks with existence checks throughout. Run after 0001-0021.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'looker_studio_readonly') then
    create role looker_studio_readonly with login bypassrls;
  end if;
end
$$;

-- No expiry, no superuser, no createrole/createdb — a plain login role, scoped down explicitly
-- below to SELECT-only. If Supabase's platform requires a role to have a connection-limit or
-- other platform-specific setting, that's configured in the Dashboard, not here (kept out of
-- version control for the same reason as the password — platform specifics drift, and this
-- file should stay a portable record of the actual privilege grants).
alter role looker_studio_readonly connection limit 5;

grant usage on schema public to looker_studio_readonly;
grant select on all tables in schema public to looker_studio_readonly;

-- Any FUTURE table/view created in public also becomes SELECT-only for this role automatically
-- — same "don't need to re-run this migration after every schema change" reasoning as migration
-- 0003/0004's own default-privilege grants for service_role/authenticated.
alter default privileges in schema public
  grant select on tables to looker_studio_readonly;

-- Explicitly NOT granted, and this is the point of the role existing at all: insert, update,
-- delete, truncate, references, trigger. §8.14b: "The Looker Studio read-only role cannot
-- INSERT, UPDATE, or DELETE on any table" — true by construction (only SELECT was ever
-- granted), not by a policy that could later be loosened by mistake.

-- ============================================================
-- daily_sales_summary — one starter reporting view, not a replacement for building real charts
-- in Looker Studio itself (that's Looker Studio's own job). Pre-aggregates the single most
-- obvious "how is the business doing" question so day-1 report-building isn't starting from
-- raw per-transaction rows. security_invoker = true matches every other view in this project
-- (customer_credit_status, vendor_credit_status, container_availability) — though for a role
-- with BYPASSRLS this setting has no practical effect (BYPASSRLS skips RLS regardless of
-- invoker/definer semantics), kept for consistency and so the view behaves identically if ever
-- queried by a role that isn't BYPASSRLS.
-- ============================================================

create or replace view public.daily_sales_summary
  with (security_invoker = true)
as
select
  date_trunc('day', sold_at)::date as sale_date,
  sku_id,
  s.english_name as sku_name,
  count(*) as sale_count,
  sum(total_kg) as total_kg_sold,
  sum(total_amount) as total_revenue
from public.sales
join public.skus s on s.id = sales.sku_id
group by date_trunc('day', sold_at), sku_id, s.english_name;
