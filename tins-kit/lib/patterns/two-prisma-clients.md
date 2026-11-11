# `two-prisma-clients` — kit pattern

> **The canonical recipe for multi-tenant Postgres isolation in a Prisma + TypeScript
> consumer.** Two clients, one superuser + one RLS-enforced, and the helper that
> switches between them. Self-contained: a consumer can copy this pattern and follow
> the recipe without reading the rest of the kit.
>
> **Source:** `atal-incubation/src/lib/prisma.ts` (the canonical implementation, 254
> lines). The pattern is the architect's-eye-view of why this file exists.

---

## 0. Why this exists

A single Prisma client connecting as a single Postgres role cannot enforce row-level
isolation in a multi-tenant app — every `prisma.user.findMany()` returns rows from every
tenant. Two design choices exist:

1. **App-layer tenant filtering only.** Every query writes `where: { tenantId: ... }`.
   Bug-prone; one missed `where` and data leaks.
2. **Database-layer RLS only.** A single Prisma client + RLS on every tenant-scoped
   table. Works, but loses the ability to do cross-tenant operations (admin tools,
   migrations, batch jobs) from the same code path.

The pattern that works is **both**: two Prisma clients (a superuser client that bypasses
RLS for cross-tenant operations, and a restricted client that RLS-enforces every
query), and a `getPrismaClient(session)` helper that returns the right one based on the
caller's role.

---

## 1. The 3 lessons, in detail

### Lesson 1 — Two clients, one connection pool each

```ts
// src/lib/prisma.ts
export const basePrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },  // superuser
});

export const restrictedPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_APP } },  // RLS-enforced
});
```

`basePrisma` is the `incubos` superuser role — it bypasses RLS via Postgres
`BYPASSRLS` privilege. Use it for: pre-auth flows (login, refresh, accept-invite),
SUPER_ADMIN operations, migrations, the outbox/cron workers (which need cross-tenant
visibility), and seed scripts.

`restrictedPrisma` is the `incubos_app` non-superuser role — every query is RLS-scoped.
Use it for: every authenticated user session that is not SUPER_ADMIN. A bug in the
app-layer `where: { tenantId }` filter is now caught at the database.

### Lesson 2 — A helper that returns the right client

```ts
export function getPrismaClient(session: SessionContext) {
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  return isSuperAdmin ? basePrisma : restrictedPrisma;
}
```

Callers do `const prisma = getPrismaClient(session);` at the top of every route
handler. They never `import { basePrisma }` directly. The `basePrisma` is only used
inside `lib/prisma.ts` itself.

### Lesson 3 — The `$allOperations` extension that injects `tenantId`

For the restricted client, every `findMany`, `create`, `update`, `delete` needs a
`tenantId` clause — even if the developer forgets. A Prisma `$extends` `$allModels`
`$allOperations` hook injects it automatically:

```ts
restrictedPrisma.$extends({
  query: {
    $allModels: {
      $allOperations: ({ model, operation, args, query }) => {
        if (model && TENANT_SCOPED_MODELS.has(model)) {
          if (operation === 'create') {
            args.data = { ...args.data, tenantId: session.tenantId };
          } else if (operation === 'createMany') {
            args.data = args.data.map(row => ({ ...row, tenantId: session.tenantId }));
          } else if (operation === 'upsert') {
            args.where = { ...args.where, tenantId: session.tenantId };
            args.create = { ...args.create, tenantId: session.tenantId };
          } else {
            args.where = { ...args.where, tenantId: session.tenantId };
          }
        }
        return query(args);
      },
    },
  },
});
```

The `TENANT_SCOPED_MODELS` set is the canonical list (the same set that RLS is enabled
on). The two sets MUST agree; the kit's `lib/tenant-rls/` ships a helper that
verifies this at startup.

---

## 2. The 3 known failure modes (and how the pattern handles each)

| # | What you wrote | What goes wrong | How the pattern prevents it |
|---|---|---|---|
| 1 | `import { basePrisma } from '@/lib/prisma';` in a tenant-scoped route | Cross-tenant data leak. The route's RLS is bypassed. | `getPrismaClient(session)` is the only public export for tenant-scoped code. Code review catches direct `basePrisma` imports. |
| 2 | A `prisma.user.findMany()` without `where: { tenantId }` | Returns rows from every tenant. | The extension injects `tenantId` automatically. Even if the developer forgets, RLS catches it. |
| 3 | A query inside an already-open interactive transaction loses the `app.current_tenant` session var | The query runs on a *different* pooled connection. RLS rejects the write with "tenant_id mismatch". | `withTenantTx(prisma, tenantId, fn)` opens the transaction, sets the var, runs `fn` inside an `AsyncLocalStorage` guard, and the extension sees the guard and skips re-wrapping. |

---

## 3. The shape of the helper module

```
src/lib/prisma.ts         # the 3 things: basePrisma, restrictedPrisma, getPrismaClient
src/lib/withTenantTx.ts   # the interactive-transaction wrapper
src/lib/tenant-rls/
  TENANT_SCOPED_MODELS    # the canonical set
  README.md               # when to use, when not to use
```

The kit's `lib/tenant-rls/` module IS this pattern's code counterpart. See
`templates/AGENTS.md` § "Read these, in this order" for which to read first (pattern vs
code).

---

## 4. When this changes (the V2 upgrade path)

- **If you add a new tenant-scoped model**, add it to BOTH `TENANT_SCOPED_MODELS`
  (TS) AND `prisma/rls-policies.sql` (Postgres). The kit's `validate.mjs` will
  warn if the two sets diverge.
- **If you switch from Prisma to Drizzle or Kysely**, port the `$extends` hook
  to Drizzle's `customTypes` or Kysely's `plugins`. The pattern's three lessons
  transfer directly.
- **If you add a second Postgres role** (e.g. a `incubos_readonly` for analytics),
  add a third client. The helper grows to `getPrismaClient(session, purpose)`.

---

*— End of pattern. The recipe's 1,000-line rationale lives in atal-incubation's
`src/lib/prisma.ts`; this pattern is the entry point.*

---

*— End of `two-prisma-clients` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
