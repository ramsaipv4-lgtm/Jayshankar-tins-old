# `lib/tenant-rls` — kit code module

> **The "multi-tenant Postgres with RLS" kit module.** Two Prisma clients
> (superuser + RLS-enforced), an `AsyncLocalStorage` guard, and the `withTenantTx`
> helper that makes "forgot to add the tenant filter" a compile-time impossibility.
>
> **This is the CODE module.** The pattern (architect's-eye view) is at
> `lib/patterns/two-prisma-clients.md` and `lib/patterns/multi-tenant-rls.md`.
> Read those first; this README is the install + use guide.
>
> **Source:** `atal-incubation/src/lib/prisma.ts` (canonical, 254 lines), the
> kit's own `lib/patterns/prisma-extensions-rls.md` (the recipe).

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/tenant-rls/ src/lib/tenant-rls/

# The RLS migration
cp tins-kit/templates/sql/rls-policies.sql prisma/migrations/<n>_enable_rls/migration.sql
pnpm prisma migrate dev
```

The module depends on `@prisma/client` (already required) and
`node:async_hooks` (built into Node).

---

## Setup

### 1. Update the `TENANT_SCOPED` set

Open `src/lib/tenant-rls/index.ts` and add every model in your `schema.prisma`
that has a `tenantId` column to the `TENANT_SCOPED` set:

```ts
const TENANT_SCOPED = new Set<string>([
  'Deal',
  'Contact',
  // ... your models
]);
```

The kit's `scripts/validate.mjs` checks this set against `schema.prisma` on
every validate run. If the set is out of sync, the validator fails.

### 2. Apply the RLS migration

Run the migration from `templates/sql/rls-policies.sql`. It enables RLS on
every table in the `TENANT_SCOPED` set + creates the per-tenant policies.

### 3. Wire up your session middleware

Your session middleware (e.g. Next.js `middleware.ts`) must produce a
`Session` object:

```ts
export type Session = {
  tenantId: string;
  userId?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER' | 'GUEST';
};
```

The `getPrismaClient(session)` helper returns the right client based on
`session.role`. SUPER_ADMIN → basePrisma; everyone else → restrictedPrisma.

---

## API

### `basePrisma`

The superuser Prisma client. Connects as the role defined in `DATABASE_URL`,
which has `BYPASSRLS`. Use for cross-tenant operations.

**Allowed in:**
- `src/app/api/superadmin/*` (guarded by SUPER_ADMIN middleware)
- `src/lib/seed.ts`
- `scripts/migration-runner.mjs`
- The `withTenantTx` helper itself

**The kit's `selftest` greps for `basePrisma` usage and flags any call site
outside these locations.** Every `basePrisma` call must be a known escape
hatch.

### `restrictedPrisma`

The RLS-enforced Prisma client. Every query is auto-scoped to the current
`tenantId` via the `withTenantTx` AsyncLocalStorage context.

```ts
// ❌ WRONG — throws "called outside withTenantTx"
const deals = await restrictedPrisma.deal.findMany();

// ✅ RIGHT
const deals = await withTenantTx(session.tenantId, async (tx) => {
  return tx.deal.findMany();
});
```

### `getPrismaClient(session)`

Returns `{ client, isSuperAdmin }` based on the session's role.

```ts
const { client, isSuperAdmin } = getPrismaClient(session);
if (isSuperAdmin) {
  // client === basePrisma — can read across tenants
  const allDeals = await client.deal.findMany();
} else {
  // client === restrictedPrisma — must wrap in withTenantTx
  const myDeals = await withTenantTx(session.tenantId, (tx) => tx.deal.findMany());
}
```

### `withTenantTx(tenantId, fn, context?)`

The workhorse. Runs `fn` inside a transaction with `tenantId` in scope.

```ts
import { withTenantTx } from '@/lib/tenant-rls';

export async function GET() {
  const session = await getServerSession();
  return withTenantTx(
    session.tenantId,
    async (tx) => {
      const deals = await tx.deal.findMany();
      return Response.json(deals);
    },
    { userId: session.userId, role: session.role }
  );
}
```

The optional `context` object is set on the `AsyncLocalStorage` for downstream
helpers (audit log, structured logger) to read.

### `tenantTxStorage`

The `AsyncLocalStorage` instance. Escape hatch for advanced use — e.g. a helper
that needs to know the current tenant without being passed `tx` explicitly.

```ts
import { tenantTxStorage } from '@/lib/tenant-rls';

export function someHelper() {
  const ctx = tenantTxStorage.getStore();
  if (!ctx) {
    throw new Error('someHelper() called outside withTenantTx()');
  }
  return ctx.tenantId;
}
```

---

## The 3 rules

### 1. Never use `basePrisma` outside the approved list

Every `basePrisma` call site is a known escape hatch. The selftest greps for
`basePrisma` and fails if a new call site is added without justification.

If you need a new cross-tenant operation:
1. Add the call site to `src/app/api/superadmin/*` (guarded by middleware).
2. Add a comment explaining why this needs to bypass RLS.
3. Update the selftest's approved-list regex.

### 2. Always wrap `restrictedPrisma` calls in `withTenantTx`

The extension throws if you call `restrictedPrisma` outside a `withTenantTx`
context. This is the safety net — it's better to fail loudly than to leak
data.

```ts
// ❌ WRONG — throws
const deals = await restrictedPrisma.deal.findMany();

// ✅ RIGHT
const deals = await withTenantTx(tenantId, (tx) => tx.deal.findMany());
```

### 3. Keep `TENANT_SCOPED` in sync with `schema.prisma`

If you add a new model with `tenantId`, add it to `TENANT_SCOPED` in the same
PR. The validator's §8.2 check fails otherwise.

---

## When to extend

- **If you add a per-user scope** (e.g. a `userId` constraint on top of
  `tenantId`): extend `withTenantTx` to take a `userId` parameter, and update
  the `injectTenantId` function to inject both.
- **If you switch from Prisma to Drizzle/Kysely**: the `AsyncLocalStorage` +
  extension pattern translates; the `withTenantTx` helper becomes a
  `withTenantTx(drizzle, fn)` wrapper. The discipline (explicit
  `TENANT_SCOPED` set, `withTenantTx` guard, `basePrisma` escape hatch log)
  is the same.
- **If you add a per-tenant schema** (one Postgres schema per tenant, instead
  of one schema + RLS): the pattern is the same but `injectTenantId` becomes
  `injectSearchPath` (sets the `search_path` to the tenant's schema). The
  `basePrisma` client is the one place that needs to be aware of all schemas.

---

## Tests

See `tests/tenant-rls.test.ts` for the 3-case test suite: happy-path
(withTenantTx scopes the query), error-case (calling restrictedPrisma
outside withTenantTx throws), cross-tenant-isolation-case (a query with a
different tenantId returns zero rows, not the other tenant's rows).

---

*— End of `lib/tenant-rls/README.md`. See also: `lib/patterns/two-prisma-clients.md`,
`lib/patterns/multi-tenant-rls.md`, `lib/patterns/prisma-extensions-rls.md`,
`templates/sql/rls-policies.sql`.*
