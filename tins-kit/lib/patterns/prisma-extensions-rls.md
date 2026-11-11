# `prisma-extensions-rls` — kit pattern

> **The companion to `two-prisma-clients`:** the recipe for the Prisma `$extends` /
> `$allOperations` pattern that injects `tenantId` into every query, and the
> `AsyncLocalStorage` guard that prevents cross-tenant leaks. Self-contained: a
> consumer can copy this pattern and follow the recipe without reading the rest of
> the kit.
>
> **Source:** `atal-incubation/src/lib/prisma.ts` (the canonical implementation:
  `restrictedPrisma = basePrisma.$extends({ query: { $allOperations: ({ args, query }) =>
  ... } })`, the `tenantTxStorage` `AsyncLocalStorage<TenantTx>` guard, the
  `withTenantTx(tenantId, fn)` helper).

---

## 0. Why this exists

The `two-prisma-clients` pattern says: "use `basePrisma` for cross-tenant ops, use
`restrictedPrisma` for tenant-scoped ops." But how does `restrictedPrisma` actually
*enforce* the tenant scope? Three options:

1. **Trust the developer to write `where: { tenantId }` everywhere.** Bug-prone; one
   missed `where` and data leaks.
2. **Use RLS on every tenant-scoped table and set the role manually in every query.**
   Works, but every query has to remember to `SET LOCAL app.current_tenant = ...`,
   and a forgotten `SET` returns zero rows (or every row, depending on the policy).
3. **Prisma `$extends` + AsyncLocalStorage.** The `restrictedPrisma` client is
   *itself* an extension that automatically injects `where: { tenantId }` into every
   query, and the `tenantId` is pulled from an `AsyncLocalStorage` that the request
   handler sets once at the top. The developer writes `prisma.deal.findMany()` and
   the extension adds the `where` for them.

Option 3 is the pattern. It makes "forgot to add the tenant filter" a compile-time
impossibility.

---

## 1. The 3 lessons, in detail

### Lesson 1 — The `$allOperations` extension injects `tenantId`

```ts
// src/lib/prisma.ts (companion to two-prisma-clients)
import { PrismaClient } from '@prisma/client';

export const basePrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export type TenantTx = { tenantId: string; tx: PrismaClient };

// AsyncLocalStorage holds the "current tenant" for the request's lifetime
export const tenantTxStorage = new AsyncLocalStorage<TenantTx>();

// The restricted client auto-injects tenantId into every read/write
export const restrictedPrisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const ctx = tenantTxStorage.getStore();
      if (!ctx) {
        throw new Error(
          `restrictedPrisma.${model}.${operation} called outside withTenantTx()`
        );
      }
      // Inject tenantId into the where clause
      const tenantScopedArgs = injectTenantId(model, args, ctx.tenantId);
      return query(tenantScopedArgs);
    },
  },
});

function injectTenantId(model: string, args: any, tenantId: string): any {
  // Models with tenantId (the kit ships a list)
  const TENANT_SCOPED = new Set([
    'Deal', 'Contact', 'Note', 'Task', 'Tag', 'CustomField',
    // ... 11 more
  ]);
  if (!TENANT_SCOPED.has(model)) return args;
  return {
    ...args,
    where: { ...args.where, tenantId },
  };
}
```

The list of `TENANT_SCOPED` models is **explicit**, not implicit. The kit's `selftest`
runs a check: "every model in `prisma/schema.prisma` that has a `tenantId` field is in
the `TENANT_SCOPED` set." If you add a new model with `tenantId` but forget to add it
to the set, the test fails.

### Lesson 2 — `withTenantTx` sets the context once, for the whole request

```ts
// src/lib/prisma.ts
export async function withTenantTx<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    return tenantTxStorage.run({ tenantId, tx }, async () => {
      return fn(tx as unknown as PrismaClient);
    });
  });
}

// Usage in an API route:
// src/app/api/deals/route.ts
export async function GET() {
  const session = await getServerSession();
  return withTenantTx(session.tenantId, async (tx) => {
    return tx.deal.findMany();   // auto-scoped to session.tenantId
  });
}
```

The `AsyncLocalStorage` is the magic: even if the request handler spawns 5 helper
functions and 2 background promises, they all see the same `tenantId` without
threading it through every function signature.

### Lesson 3 — The `basePrisma` escape hatch is logged

The pattern still needs a way to do cross-tenant operations (admin tools, batch
jobs, the seeder, the migration runner). The escape hatch is `basePrisma` — but
every call site that uses it must be explicit about it:

```ts
// src/app/api/superadmin/tenants/route.ts
import { basePrisma } from '@/lib/prisma';

export async function GET() {
  // Explicit basePrisma — this is a SUPER_ADMIN route that lists all tenants.
  // The basePrisma call is the *only* place in the app that bypasses tenant scope.
  // The /superadmin/* middleware block ensures session.role === 'SUPER_ADMIN'.
  return basePrisma.tenant.findMany();
}
```

The kit's `selftest` runs a `grep` for `basePrisma` and flags any usage outside
`src/app/api/superadmin/`, `src/lib/`, `prisma/seed.ts`, and the migration runner.
Every `basePrisma` call site must be a known escape hatch.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — Using `restrictedPrisma` without `withTenantTx`

```ts
// ❌ WRONG — restrictedPrisma throws "called outside withTenantTx"
export async function GET() {
  const deals = await restrictedPrisma.deal.findMany();
  return Response.json(deals);
}

// ✅ RIGHT
export async function GET() {
  const session = await getServerSession();
  return withTenantTx(session.tenantId, async (tx) => {
    const deals = await tx.deal.findMany();
    return Response.json(deals);
  });
}
```

The error message is the safety net. The kit's `selftest` includes a case that hits
this error path and confirms the message is correct.

### Anti-pattern 2 — Implicit `TENANT_SCOPED` (discovered from schema)

```ts
// ❌ WRONG — assumes every model with a `tenantId` field is scoped
const TENANT_SCOPED = Object.keys(prismaModelDefinitions).filter(m => m.hasField('tenantId'));

// ✅ RIGHT — explicit list, fail loud if out of sync
const TENANT_SCOPED = new Set([
  'Deal', 'Contact', // ...
]);
// selftest check: every model with tenantId is in this set, and every model in this set has tenantId
```

The implicit approach feels DRY, but a model that *intentionally* has `tenantId`
but is NOT tenant-scoped (e.g. a join table) would be incorrectly auto-filtered.
The explicit list is auditable.

### Anti-pattern 3 — Forgetting the `tx` parameter in nested calls

```ts
// ❌ WRONG — uses the wrong Prisma client in a nested helper
export async function GET() {
  return withTenantTx(tenantId, async (tx) => {
    return someHelper();  // someHelper uses `prisma` (the global), not `tx`
  });
}

// ✅ RIGHT — pass tx explicitly, or use restrictedPrisma which reads the storage
export async function GET() {
  return withTenantTx(tenantId, async (tx) => {
    return someHelper(tx);
  });
}
```

The `AsyncLocalStorage` saves you here: if `someHelper` uses `restrictedPrisma`
(not the global `prisma`), the storage's `tenantId` is still in scope, and the
extension still works. The `selftest` runs a `grep` for `import { prisma }` to catch
untyped `prisma` usage in helpers.

---

## 3. When this pattern changes

- **When the consumer adds a new tenant-scoped model**: add the model name to the
  `TENANT_SCOPED` set, add a `selftest` case that confirms the set matches the
  schema, and add a migration to add `tenantId` to the new table.
- **When the consumer adds a per-user (not per-tenant) scope** (e.g. a `userId`
  constraint on top of `tenantId`): the `injectTenantId` function needs to inject
  both. The `withTenantTx` signature extends to `withUserTx({ tenantId, userId }, fn)`.
- **When the consumer switches from Prisma to a different ORM** (Drizzle, Kysely):
  the `AsyncLocalStorage` + extension pattern translates; the `$allOperations`
  becomes a middleware. The `selftest` cases change to use the new ORM's
  introspection, but the discipline (explicit `TENANT_SCOPED` set, `withTenantTx`
  guard, `basePrisma` escape hatch log) is the same.

---

*— End of `prisma-extensions-rls` pattern. See also: `lib/patterns/two-prisma-clients.md`
(companion pattern), `lib/patterns/multi-tenant-rls.md` (architect's-eye view), the
upcoming `lib/tenant-rls/` code module (G30).*
