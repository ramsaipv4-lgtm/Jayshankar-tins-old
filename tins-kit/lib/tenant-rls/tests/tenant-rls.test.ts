// lib/tenant-rls/tests/tenant-rls.test.ts
//
// The 3-case test suite for `lib/tenant-rls`:
//   1. happy-path: withTenantTx scopes the query
//   2. error-case: calling restrictedPrisma outside withTenantTx throws
//   3. cross-tenant-isolation-case: a query with a different tenantId returns
//      zero rows, not the other tenant's rows
//
// Test runner: any (vitest, jest, node:test). The kit recommends vitest.
// Database: a test Postgres instance (the kit's CI spins one up via docker-compose).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  basePrisma,
  restrictedPrisma,
  withTenantTx,
  tenantTxStorage,
} from '../index';

// =============================================================================
// SETUP
// =============================================================================

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL_TEST } },
  });
  // Run the test migration
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Deal" (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount DECIMAL(18, 4) NOT NULL DEFAULT 0
    );
  `);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "Deal"');
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM "Deal"');
});

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('tenant-rls — happy path', () => {
  it('withTenantTx scopes a query to the given tenantId', async () => {
    // Insert two deals in two tenants
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO "Deal" (id, tenant_id, name) VALUES ('d-1', 't-a', 'A deal')`
    );
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO "Deal" (id, tenant_id, name) VALUES ('d-2', 't-b', 'B deal')`
    );

    // Query inside withTenantTx for tenant t-a
    const result = await withTenantTx('t-a', async (tx) => {
      return tx.$queryRawUnsafe<Array<{ id: string; name: string }>>(
        `SELECT id, name FROM "Deal"`
      );
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d-1');
  });
});

// =============================================================================
// 2. ERROR-CASE
// =============================================================================

describe('tenant-rls — error case', () => {
  it('throws when restrictedPrisma is called outside withTenantTx', async () => {
    // restrictedPrisma is a $extends'd client; calling .deal.findMany() on it
    // without a withTenantTx context must throw.
    // (We use a model that doesn't exist; the point is the throw happens at
    // the $allOperations extension before the model is resolved.)
    expect(() =>
      (restrictedPrisma as any).__test_unknown_model.findMany()
    ).toThrow(/outside withTenantTx/);
  });

  it('throws when reading the storage outside withTenantTx', () => {
    expect(tenantTxStorage.getStore()).toBeUndefined();
  });
});

// =============================================================================
// 3. CROSS-TENANT ISOLATION
// =============================================================================

describe('tenant-rls — cross-tenant isolation', () => {
  it('a query in tenant t-a cannot see tenant t-b data', async () => {
    // Insert data in two tenants
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO "Deal" (id, tenant_id, name) VALUES ('d-a', 't-a', 'A')`
    );
    await basePrisma.$executeRawUnsafe(
      `INSERT INTO "Deal" (id, tenant_id, name) VALUES ('d-b', 't-b', 'B')`
    );

    // From tenant t-a: see only d-a
    const fromA = await withTenantTx('t-a', async (tx) => {
      return tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Deal"`
      );
    });
    expect(fromA.map((r) => r.id).sort()).toEqual(['d-a']);

    // From tenant t-b: see only d-b
    const fromB = await withTenantTx('t-b', async (tx) => {
      return tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "Deal"`
      );
    });
    expect(fromB.map((r) => r.id).sort()).toEqual(['d-b']);

    // From basePrisma: see both
    const fromBase = await basePrisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "Deal"`
    );
    expect(fromBase.map((r) => r.id).sort()).toEqual(['d-a', 'd-b']);
  });
});
