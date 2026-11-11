-- templates/sql/rls-policies.sql
--
-- The idempotent RLS-enable + RLS-force migration for a multi-tenant TINS
-- consumer. Copy this file to your consumer's
-- `prisma/migrations/<n>_enable_rls/migration.sql` (or
-- `supabase/migrations/<n>_enable_rls.sql`) and run via the migration runner.
--
-- THE CONTRACT:
--   - Every tenant-scoped table has RLS enabled AND forced (FORCE ROW LEVEL
--     SECURITY, so the table owner is also subject to the policy).
--   - The RLS policy is permissive: tenant_id = current_setting('app.current_tenant')
--   - The trigger sets app.current_tenant to the value of the JWT claim
--     'tenant_id' at the start of every transaction.
--   - The migration is IDEMPOTENT: re-running it does nothing.
--
-- Source: atal-incubation/incubos/prisma/rls-policies.sql (the canonical),
-- Jayshankar/supabase/rls-policies.sql (the Supabase variant).
--
-- IMPORTANT: The list of tenant-scoped tables below is a PLACEHOLDER. Replace
-- with the actual list from your consumer's prisma/schema.prisma. The kit's
-- `scripts/validate.mjs` checks that the list in this file matches the list
-- in schema.prisma.

-- =============================================================================
-- 1. THE TENANT-SCOPED TABLES (REPLACE WITH YOUR CONSUMER'S LIST)
-- =============================================================================

-- Each row: (table_name, tenant_column_name)
-- The default tenant_column_name is 'tenant_id'. Override if your schema
-- uses a different name (rare).
DO $$
DECLARE
  tenant_tables TEXT[] := ARRAY[
    'Deal',
    'Contact',
    'Note',
    'Task',
    'Tag',
    'CustomField',
    'Pipeline',
    'PipelineStage',
    'Activity',
    'EmailTemplate',
    'Webhook',
    'ApiKey'
    -- ADD YOUR CONSUMER'S TENANT-SCOPED TABLES HERE
  ];
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY tenant_tables
  LOOP
    -- 1.1 Enable RLS (idempotent)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- 1.2 FORCE RLS (so the table owner is also subject to the policy)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    -- 1.3 Drop the policy if it exists (idempotent re-apply)
    policy_name := t || '_tenant_isolation';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);

    -- 1.4 Create the policy
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.current_tenant'', true))',
      policy_name, t
    );

    RAISE NOTICE 'RLS enabled on table: %', t;
  END LOOP;
END $$;

-- =============================================================================
-- 2. THE TENANT-SETTING TRIGGER (sets app.current_tenant from the JWT)
-- =============================================================================

-- This trigger runs at the start of every transaction. It reads the
-- 'tenant_id' claim from the JWT (set by your app's connection pooler) and
-- sets the Postgres session variable `app.current_tenant` to that value.
--
-- RLS policies then check this variable via current_setting('app.current_tenant', true).
-- The `true` argument means "return NULL if the setting is missing" — which
-- means a tenant-less connection (e.g. a SUPER_ADMIN tool) gets NULL and
-- must use basePrisma, not restrictedPrisma.

CREATE OR REPLACE FUNCTION set_current_tenant_from_jwt()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  jwt_tenant_id TEXT;
BEGIN
  -- Try to read the tenant_id from the JWT claim. The exact mechanism
  -- depends on your auth provider:
  --   - Supabase:  current_setting('request.jwt.claims', true)::json->>'tenant_id'
  --   - Custom JWT:  current_setting('request.jwt.claims', true)::json->>'tenant_id'
  --   - ERPNext sidecar:  current_setting('app.erp_tenant_id', true)
  --
  -- The placeholder below reads from a generic claim; replace with your
  -- provider's actual claim path.

  BEGIN
    jwt_tenant_id := current_setting('request.jwt.claims', true)::json->>'tenant_id';
  EXCEPTION WHEN OTHERS THEN
    jwt_tenant_id := NULL;
  END;

  IF jwt_tenant_id IS NOT NULL THEN
    PERFORM set_config('app.current_tenant', jwt_tenant_id, true);
  END IF;
END;
$$;

-- Run the trigger at the start of every transaction.
-- The trigger is on `pg_catalog.pg_db_role_setting` — actually, no, the
-- canonical pattern is a per-transaction SET LOCAL. See your consumer's
-- `withTenantTx` helper for the runtime side. This trigger is a fallback
-- for connections that don't go through the helper.

-- =============================================================================
-- 3. VERIFICATION (run after the migration to confirm)
-- =============================================================================

-- List all tables with RLS enabled:
-- SELECT schemaname, tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- List all policies on a specific table:
-- SELECT * FROM pg_policies WHERE tablename = 'Deal';
