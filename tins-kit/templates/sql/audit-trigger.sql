-- templates/sql/audit-trigger.sql
--
-- The append-only audit log trigger for a TINS consumer. Copy this file to
-- your consumer's `prisma/migrations/<n>_audit_trigger/migration.sql` and
-- run via the migration runner.
--
-- THE CONTRACT:
--   - Every mutation (INSERT, UPDATE, DELETE) on every audited table writes a
--     row to `audit_log`.
--   - The `audit_log` table has NO INSERT policy (only the SECURITY DEFINER
--     trigger can write), NO UPDATE policy, NO DELETE policy. Once written,
--     a row is immutable.
--   - Admin users can SELECT from `audit_log` (via a separate read-only role
--     or a SECURITY DEFINER view that filters by tenant).
--   - The migration is IDEMPOTENT: re-running it does nothing.
--
-- Source: atal-incubation/incubos/prisma/audit-trigger.sql (the canonical,
-- per-table triggers + per-statement triggers), Jayshankar/supabase/migrations/
-- 0002_audit.sql (the Supabase variant, single trigger function).

-- =============================================================================
-- 1. THE AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    TEXT,                    -- nullable: cross-tenant admin actions
  table_name   TEXT NOT NULL,
  row_id       TEXT NOT NULL,           -- the PK of the affected row (as text)
  operation    TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     JSONB,                   -- the row before the change (NULL on INSERT)
  new_data     JSONB,                   -- the row after the change (NULL on DELETE)
  changed_by   TEXT,                    -- the user_id (from JWT)
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id   TEXT,                    -- optional, for tracing
  ip_address   INET                     -- optional, for security audit
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_id_idx ON audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_table_name_idx ON audit_log (table_name);
CREATE INDEX IF NOT EXISTS audit_log_row_id_idx ON audit_log (row_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log (changed_at DESC);

COMMENT ON TABLE audit_log IS
  'Append-only audit log. INSERT only via SECURITY DEFINER trigger. No UPDATE/DELETE allowed.';

-- =============================================================================
-- 2. THE TRIGGER FUNCTION
-- =============================================================================

-- This function is called by every per-table trigger. It serialises the old
-- and new row data to JSONB and inserts an audit_log row.
--
-- The function is SECURITY DEFINER so it can bypass the no-INSERT RLS policy
-- on audit_log. The trigger must be owned by a role that has INSERT on
-- audit_log; the function runs as that role's permissions.

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id  TEXT;
  v_row_id     TEXT;
  v_changed_by TEXT;
  v_request_id TEXT;
BEGIN
  -- Try to read the current tenant from the session variable.
  -- (Set by the consumer's `withTenantTx` helper.)
  BEGIN
    v_tenant_id := current_setting('app.current_tenant', true);
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;

  -- Try to read the user from the JWT claim.
  BEGIN
    v_changed_by := current_setting('request.jwt.claims', true)::json->>'sub';
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  -- Try to read the request_id (set by the consumer's request middleware).
  BEGIN
    v_request_id := current_setting('app.request_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_request_id := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_row_id := NEW.id::text;
    INSERT INTO audit_log (tenant_id, table_name, row_id, operation,
                           old_data, new_data, changed_by, request_id)
    VALUES (v_tenant_id, TG_TABLE_NAME, v_row_id, 'INSERT',
            NULL, to_jsonb(NEW), v_changed_by, v_request_id);
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    v_row_id := NEW.id::text;
    INSERT INTO audit_log (tenant_id, table_name, row_id, operation,
                           old_data, new_data, changed_by, request_id)
    VALUES (v_tenant_id, TG_TABLE_NAME, v_row_id, 'UPDATE',
            to_jsonb(OLD), to_jsonb(NEW), v_changed_by, v_request_id);
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    v_row_id := OLD.id::text;
    INSERT INTO audit_log (tenant_id, table_name, row_id, operation,
                           old_data, new_data, changed_by, request_id)
    VALUES (v_tenant_id, TG_TABLE_NAME, v_row_id, 'DELETE',
            to_jsonb(OLD), NULL, v_changed_by, v_request_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION audit_trigger_func() IS
  'Inserts a row into audit_log for every INSERT/UPDATE/DELETE. SECURITY DEFINER so it can bypass the no-INSERT RLS policy on audit_log.';

-- =============================================================================
-- 3. ATTACH THE TRIGGER TO EVERY AUDITED TABLE
-- =============================================================================

-- REPLACE THIS LIST with the consumer's audited tables (typically every
-- tenant-scoped table plus a handful of system tables).

DO $$
DECLARE
  audited_tables TEXT[] := ARRAY[
    'Deal',
    'Contact',
    'Note',
    'Task',
    'Pipeline',
    'Activity'
    -- ADD YOUR CONSUMER'S AUDITED TABLES HERE
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY audited_tables
  LOOP
    -- Drop the trigger if it exists (idempotent re-apply)
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I',
                   t || '_audit_trigger', t);

    -- Create the trigger
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I ' ||
      'FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()',
      t || '_audit_trigger', t
    );

    RAISE NOTICE 'Audit trigger attached to: %', t;
  END LOOP;
END $$;

-- =============================================================================
-- 4. THE NO-MUTATION RLS POLICIES (the "append-only" enforcement)
-- =============================================================================

-- Enable RLS on audit_log (so the policies below are enforced).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- 4.1 No one can UPDATE audit_log
DROP POLICY IF EXISTS audit_log_no_update ON audit_log;
CREATE POLICY audit_log_no_update ON audit_log
  FOR UPDATE
  USING (false);

-- 4.2 No one can DELETE audit_log
DROP POLICY IF EXISTS audit_log_no_delete ON audit_log;
CREATE POLICY audit_log_no_delete ON audit_log
  FOR DELETE
  USING (false);

-- 4.3 No one can INSERT directly (only the SECURITY DEFINER trigger can)
DROP POLICY IF EXISTS audit_log_no_insert ON audit_log;
CREATE POLICY audit_log_no_insert ON audit_log
  FOR INSERT
  WITH CHECK (false);

-- 4.4 Admins can SELECT (filtered by tenant)
DROP POLICY IF EXISTS audit_log_admin_select ON audit_log;
CREATE POLICY audit_log_admin_select ON audit_log
  FOR SELECT
  USING (
    -- Replace this with the consumer's admin role check. Examples:
    --   current_setting('app.current_user_role', true) = 'SUPER_ADMIN'
    --   OR
    --   tenant_id = current_setting('app.current_tenant', true)
    --
    -- The placeholder below is permissive: any tenant can read its own rows.
    tenant_id = current_setting('app.current_tenant', true)
    OR current_setting('app.current_user_role', true) = 'SUPER_ADMIN'
  );

-- =============================================================================
-- 5. VERIFICATION
-- =============================================================================

-- Confirm a row is in audit_log after a test mutation:
-- INSERT INTO "Deal" (id, tenant_id, name) VALUES ('test-1', 't-1', 'Test Deal');
-- SELECT * FROM audit_log WHERE row_id = 'test-1';

-- Confirm UPDATE is blocked:
-- UPDATE audit_log SET operation = 'TAMPERED' WHERE id = 1;
--   -- ERROR: new row violates row-level security policy for table "audit_log"

-- Confirm DELETE is blocked:
-- DELETE FROM audit_log WHERE id = 1;
--   -- ERROR: new row violates row-level security policy for table "audit_log"
