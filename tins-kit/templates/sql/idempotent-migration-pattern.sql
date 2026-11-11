-- templates/sql/idempotent-migration-pattern.sql
--
-- A starter migration showing the 6 idempotency primitives every TINS
-- consumer's migrations must use. Copy the relevant sections to your
-- consumer's migration file.
--
-- THE 6 PRIMITIVES (see `tins-kit/lib/patterns/idempotent-migrations.md`):
--   1. CREATE TABLE IF NOT EXISTS
--   2. CREATE OR REPLACE (for functions / views)
--   3. DROP TRIGGER IF EXISTS before CREATE TRIGGER
--   4. ON CONFLICT DO NOTHING (for INSERTs)
--   5. DO $$ ... $$ guard (for conditional DDL)
--   6. ALTER TABLE ... ENABLE ROW LEVEL SECURITY (idempotent)
--
-- Source: atal-incubation (14 migrations, all idempotent), Jayshankar
-- (5 SQL files in supabase/migrations/, all idempotent).

-- =============================================================================
-- EXAMPLE 1: CREATE TABLE (primitive 1)
-- =============================================================================

-- WRONG: fails on re-apply
-- CREATE TABLE "Deal" (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL
-- );

-- RIGHT: idempotent
CREATE TABLE IF NOT EXISTS "Deal" (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  amount        DECIMAL(18, 4) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'OPEN',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Deal_tenant_id_idx" ON "Deal" (tenant_id);
CREATE INDEX IF NOT EXISTS "Deal_status_idx" ON "Deal" (status);

-- =============================================================================
-- EXAMPLE 2: CREATE OR REPLACE FUNCTION (primitive 2)
-- =============================================================================

-- WRONG: fails on re-apply ("function already exists")
-- CREATE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ ... $$;

-- RIGHT: idempotent
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- EXAMPLE 3: CREATE TRIGGER (primitives 1, 3)
-- =============================================================================

-- WRONG: fails on re-apply ("trigger already exists")
-- CREATE TRIGGER deal_updated_at_trigger
--   BEFORE UPDATE ON "Deal"
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RIGHT: idempotent
DROP TRIGGER IF EXISTS deal_updated_at_trigger ON "Deal";
CREATE TRIGGER deal_updated_at_trigger
  BEFORE UPDATE ON "Deal"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- EXAMPLE 4: INSERT seed data (primitive 4)
-- =============================================================================

-- WRONG: fails on re-apply ("duplicate key value violates unique constraint")
-- INSERT INTO "Pipeline" (id, tenant_id, name) VALUES
--   ('pipe-1', 't-1', 'Default Sales Pipeline');

-- RIGHT: idempotent
INSERT INTO "Pipeline" (id, tenant_id, name) VALUES
  ('pipe-1', 't-1', 'Default Sales Pipeline')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- EXAMPLE 5: Conditional DDL (primitive 5)
-- =============================================================================

-- Add a column only if it doesn't exist (Postgres doesn't have
-- "ADD COLUMN IF NOT EXISTS" in older versions; this is the workaround).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Deal' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE "Deal" ADD COLUMN closed_at TIMESTAMPTZ;
  END IF;
END $$;

-- (Postgres 9.6+ has ADD COLUMN IF NOT EXISTS natively, so this can just be:
--  ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
-- )

-- =============================================================================
-- EXAMPLE 6: ENABLE ROW LEVEL SECURITY (primitive 6)
-- =============================================================================

-- WRONG: errors with "row level security is already enabled" (actually, no —
-- ENABLE is idempotent, but FORCE is not in all versions. Be explicit.)

-- RIGHT: idempotent for both
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;        -- idempotent
ALTER TABLE "Deal" FORCE ROW LEVEL SECURITY;          -- idempotent in PG 12+

-- =============================================================================
-- FULL EXAMPLE: a single migration file combining all 6 primitives
-- =============================================================================

-- 0005_add_deal_pipeline.sql

-- Primitive 1: CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "Pipeline" (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Pipeline_tenant_id_idx" ON "Pipeline" (tenant_id);

-- Primitive 1: CREATE TABLE IF NOT EXISTS (a join table)
CREATE TABLE IF NOT EXISTS "DealPipelineStage" (
  deal_id     TEXT NOT NULL REFERENCES "Deal"(id) ON DELETE CASCADE,
  stage_id    TEXT NOT NULL REFERENCES "PipelineStage"(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (deal_id, stage_id)
);

-- Primitive 2: CREATE OR REPLACE FUNCTION
CREATE OR REPLACE FUNCTION set_pipeline_default_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "PipelineStage" (id, pipeline_id, name, position)
  VALUES
    (gen_random_uuid()::text, NEW.id, 'Lead',       1),
    (gen_random_uuid()::text, NEW.id, 'Qualified',  2),
    (gen_random_uuid()::text, NEW.id, 'Proposal',   3),
    (gen_random_uuid()::text, NEW.id, 'Won',        4),
    (gen_random_uuid()::text, NEW.id, 'Lost',       5)
  ON CONFLICT (id) DO NOTHING;  -- primitive 4
  RETURN NEW;
END;
$$;

-- Primitive 3: DROP TRIGGER IF EXISTS + CREATE TRIGGER
DROP TRIGGER IF EXISTS pipeline_default_stages_trigger ON "Pipeline";
CREATE TRIGGER pipeline_default_stages_trigger
  AFTER INSERT ON "Pipeline"
  FOR EACH ROW EXECUTE FUNCTION set_pipeline_default_stages();

-- Primitive 6: ENABLE + FORCE RLS
ALTER TABLE "Pipeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pipeline" FORCE ROW LEVEL SECURITY;

-- Primitive 5: conditional column add (for older Postgres)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Pipeline' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE "Pipeline" ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================================================
-- THE MIGRATION RUNNER USES THIS
-- =============================================================================
--
-- The kit's `scripts/migration-runner.mjs` applies every `migrations/<n>_*.sql`
-- file in order, tracking applied migrations in a `migrations_applied` table:
--
--   CREATE TABLE IF NOT EXISTS migrations_applied (
--     filename     TEXT PRIMARY KEY,
--     applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
--     checksum     TEXT  -- optional: SHA-256 of the file contents
--   );
--
-- The runner checks the `migrations_applied` table before applying a file.
-- If the file is already there, it's skipped. So the IDEMPOTENT primitives
-- above are the **second line of defense** — they protect against manual
-- re-runs, partial applies, and the rare case where a migration is run
-- outside the runner.
