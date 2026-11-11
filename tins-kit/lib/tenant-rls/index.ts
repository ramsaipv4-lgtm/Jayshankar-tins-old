// lib/tenant-rls/index.ts
//
// The "multi-tenant Postgres with RLS" kit module. Provides:
//
//   - basePrisma: the superuser Prisma client (BYPASSRLS, for cross-tenant ops)
//   - restrictedPrisma: the RLS-enforced Prisma client (via $extends)
//   - getPrismaClient(session): returns the right client based on the caller's role
//   - withTenantTx(tenantId, fn): the AsyncLocalStorage-guarded transaction helper
//   - tenantTxStorage: the AsyncLocalStorage instance (escape hatch for advanced use)
//
// This is the CODE module. The pattern (architect's-eye view) is at
// `lib/patterns/two-prisma-clients.md` and `lib/patterns/multi-tenant-rls.md`.
//
// Source: atal-incubation/src/lib/prisma.ts (canonical), the kit's own
// `lib/patterns/prisma-extensions-rls.md` (the recipe).

import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type TenantTxContext = {
  tenantId: string;
  userId?: string;
  role?: string;
  tx: PrismaClient;
};

export type Session = {
  tenantId: string;
  userId?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER' | 'GUEST';
};

// ---------------------------------------------------------------------------
// THE TWO CLIENTS
// ---------------------------------------------------------------------------

/**
 * The superuser Prisma client. Connects as the role defined in DATABASE_URL,
 * which has BYPASSRLS. Use this for:
 *   - Cross-tenant operations (admin tools, batch jobs, the seeder)
 *   - The migration runner
 *   - Anything that needs to read/write data from multiple tenants
 *
 * In production code, this client should only appear in:
 *   - src/app/api/superadmin/*  (guarded by SUPER_ADMIN middleware)
 *   - src/lib/seed.ts
 *   - scripts/migration-runner.mjs
 *   - the withTenantTx helper itself
 */
export const basePrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/**
 * The RLS-enforced Prisma client. Every query that goes through this client
 * MUST have a `tenantId` in scope (set by withTenantTx). If you call
 * `restrictedPrisma.deal.findMany()` outside a withTenantTx, the extension
 * throws.
 *
 * The TENANT_SCOPED list is the explicit set of models that have a `tenantId`
 * column. The kit's `scripts/validate.mjs` checks this list against the
 * schema. If you add a new model with `tenantId`, add it here too.
 */
const TENANT_SCOPED = new Set<string>([
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
  'ApiKey',
  // ADD YOUR CONSUMER'S TENANT-SCOPED MODELS HERE
]);

/**
 * AsyncLocalStorage holds the current tenant context for the request's
 * lifetime. The withTenantTx helper sets it; the restrictedPrisma extension
 * reads it.
 */
export const tenantTxStorage = new AsyncLocalStorage<TenantTxContext>();

function injectTenantId(model: string, args: any, ctx: TenantTxContext): any {
  if (!TENANT_SCOPED.has(model)) return args;
  return {
    ...args,
    where: { ...args.where, tenantId: ctx.tenantId },
  };
}

/**
 * The RLS-enforced Prisma client. Auto-injects `tenantId` into every query.
 * Throws if called outside a withTenantTx context.
 */
export const restrictedPrisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const ctx = tenantTxStorage.getStore();
      if (!ctx) {
        throw new Error(
          `restrictedPrisma.${model}.${operation} called outside withTenantTx(). ` +
            `Use withTenantTx(tenantId, async (tx) => { ... }) or basePrisma for cross-tenant ops.`
        );
      }
      return query(injectTenantId(model, args, ctx));
    },
  },
});

// ---------------------------------------------------------------------------
// THE SESSION HELPER
// ---------------------------------------------------------------------------

/**
 * Return the right Prisma client for the given session.
 *
 *   - SUPER_ADMIN sessions get basePrisma (cross-tenant access).
 *   - All other sessions get restrictedPrisma (RLS-enforced, scoped to the
 *     session's tenantId via withTenantTx).
 */
export function getPrismaClient(session: Session): {
  client: PrismaClient | typeof restrictedPrisma;
  isSuperAdmin: boolean;
} {
  if (session.role === 'SUPER_ADMIN') {
    return { client: basePrisma, isSuperAdmin: true };
  }
  return { client: restrictedPrisma, isSuperAdmin: false };
}

// ---------------------------------------------------------------------------
// THE TRANSACTION HELPER
// ---------------------------------------------------------------------------

/**
 * Run `fn` inside a transaction that has the given tenantId in scope. Every
 * `tx.<model>.<op>(...)` call inside `fn` is auto-scoped to `tenantId` by the
 * restrictedPrisma extension.
 *
 * Usage:
 *   export async function GET(req: Request) {
 *     const session = await getServerSession();
 *     return withTenantTx(session.tenantId, async (tx) => {
 *       const deals = await tx.deal.findMany();
 *       return Response.json(deals);
 *     });
 *   }
 */
export async function withTenantTx<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
  context?: { userId?: string; role?: string }
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    return tenantTxStorage.run(
      { tenantId, userId: context?.userId, role: context?.role, tx: tx as unknown as PrismaClient },
      async () => {
        return fn(tx as unknown as PrismaClient);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// DEFAULT EXPORT
// ---------------------------------------------------------------------------

export default {
  basePrisma,
  restrictedPrisma,
  getPrismaClient,
  withTenantTx,
  tenantTxStorage,
  TENANT_SCOPED,
};
