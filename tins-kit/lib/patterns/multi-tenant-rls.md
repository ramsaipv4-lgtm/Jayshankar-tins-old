# `multi-tenant-rls` — kit pattern

> **The architect's-eye-view of when and why to use PostgreSQL Row-Level Security for
> multi-tenant isolation.** Self-contained. (The code is in `lib/tenant-rls/`;
> this pattern is the *why*, not the *how*.)
>
> **Source:** atal-incubation (the canonical implementation, with RLS on 23
> tables, 4 Postgres roles, the `app.current_tenant` session var pattern).

---

## 0. Why this exists

A multi-tenant SaaS has N tenants, each with their own users, data, and
workflows. The fundamental design question is: **at what layer is tenant isolation
enforced?**

Three answers exist, ordered by where the trust boundary lives:

| Layer | What it does | What it doesn't do | Verdict |
|---|---|---|---|
| **Application code** | Every query writes `where: { tenantId: session.tenantId }` | One missed `where` = data leak. | Bug-prone. |
| **Postgres RLS** | A `tenant_isolation` policy on every tenant-scoped table. The `tenantId` column is checked on every read/write, by the database. | Requires a session-var setter at the start of every request. The app must use the restricted client (not the superuser client). | **The right answer** — the database is the trust boundary; the app cannot bypass it. |
| **Database-per-tenant** | Each tenant has its own Postgres database. | Operationally heavy (migrations × N, backups × N, connection pools × N). RLS still needed for the per-tenant queries. | Overkill for a single-tenant-to-many-tenant growth story. |

The pattern is: **Postgres RLS is the trust boundary, application code is
defence-in-depth.** This pattern is the rationale, the trade-off table, and the
checklist for "is my consumer ready for RLS?"

---

## 1. The 4 questions to answer before adopting RLS

### Q1 — Do you actually have multiple tenants?

Single-tenant apps don't need RLS. A wholesale inventory app for one store, a
university-specific tool, a personal-finance tracker — none of these need tenant
isolation. If your answer is "I'll have multiple tenants *eventually*," defer RLS
until you have two. Premature RLS adds 2 weeks of work for zero current benefit.

**The rule:** RLS is for consumers that have at least 2 tenants *in production
today*.

### Q2 — Is your data model a tenant graph or a tenant root?

A **tenant graph** (every row is owned by exactly one tenant) is the easy case.
RLS works perfectly: one `tenantId` column on every tenant-scoped table, one
`tenant_isolation` policy, done.

A **tenant root** (some tables are shared across tenants, e.g. a global
`vendors` catalog) is the hard case. RLS works, but the policy is
`using (tenant_id is null or tenant_id = current_setting('app.current_tenant'))` —
the application code has to know when to set `tenant_id` and when to leave it
null. This is what the atal-incubation `InvestorContact` table does (intentionally
network-global, no `tenantId`).

**The rule:** if your data model is a tenant graph, RLS is straightforward. If
it's a tenant root, RLS works but the app code has to be more careful.

### Q3 — Will you have SUPER_ADMIN or auditor roles that need cross-tenant access?

If yes, the pattern needs a second Prisma client (the superuser one) that
bypasses RLS. The atal-incubation `getPrismaClient(session)` helper returns
`basePrisma` (superuser) for SUPER_ADMIN sessions, `restrictedPrisma` (RLS) for
everyone else.

**The rule:** if you have any cross-tenant role, you need the two-Prisma-clients
pattern (`lib/patterns/two-prisma-clients.md`). RLS alone isn't enough.

### Q4 — How will you test that RLS is actually working?

The hard part isn't writing the policies. The hard part is *knowing* the
policies work — that a tenant-A user really can't see tenant-B's data.

The pattern's test recipe: a SQL script that runs as `tenantA_user`, tries to
`SELECT * FROM users`, and asserts the result count is 0 (or only tenantA's
users). Same for INSERT, UPDATE, DELETE. The script is part of the consumer's
CI; it runs on every PR.

**The rule:** if you don't have a test for "tenant A can't see tenant B's data,"
you don't have RLS. You have a config file.

---

## 2. The 2 known gotchas

### Gotcha 1 — `localhost` vs `127.0.0.1`

Prisma's engine on Windows may fail to resolve `localhost:5432` even when the
port is reachable. Use `127.0.0.1` in `DATABASE_URL` and `DATABASE_URL_APP`. The
kit's `validate.mjs` warns (does not fail) if `localhost` is found.

### Gotcha 2 — Two Postgres installations on the same host

The Windows host often has a host Postgres service on `:5432`; Docker Postgres
also wants `:5432`. The first listener wins; the second is silently down. The
kit's `lib/tenant-rls/README.md` documents the fix (`Stop-Service postgresql-x64-18`
or change Docker's published port). Always verify with
`netstat -ano | Select-String ':5432.*LISTENING'` before debugging RLS.

---

## 3. The 3 known deployment pitfalls

1. **Forgetting to apply `rls-policies.sql` to a fresh environment.** The
   migration is idempotent but it's not auto-applied by `prisma migrate deploy`.
   The consumer's `DEPLOYMENT.md` must include a step:
   `docker exec -i db psql -U user -d db < prisma/rls-policies.sql`.
2. **The `service_role` and `authenticated` roles need GRANTs, not just RLS.**
   Postgres privilege layers: GRANTs are table-level, RLS is row-level. Without
   the GRANT, RLS is moot. See `lib/patterns/supabase-auth-trigger.md` Lesson 3
   and 4.
3. **`BYPASSRLS` is a privilege, not a role property.** Set it on the
   `incubos_superadmin` role (or whatever your superuser role is called).
   `service_role` in Supabase has it by default; a self-managed Postgres
   `incubos` role needs `ALTER ROLE incubos BYPASSRLS;`.

---

## 4. The 1 known anti-pattern

**"We use RLS so we don't need `tenantId` in the app layer."** This is the
biggest misunderstanding. RLS is the *second* line of defense. The first line
is: every Prisma query writes `where: { tenantId: ... }` (via the
`$allOperations` extension). Without the app-layer filter, a query that asks
"give me all the users" returns nothing (RLS hides them) — but a query that
asks "give me the user with id=42" returns the right user, not the user with
id=42 in tenant A. The RLS layer is opaque to the developer; the app-layer
filter is the developer's first check.

---

## 5. When this changes (the V2 upgrade path)

- **If you grow past 100 tenants and RLS is your bottleneck**, look at
  connection pooling (PgBouncer) and read-replica fan-out. RLS still works at
  scale; the bottleneck is connection count, not the policy check.
- **If you add a row-level encryption requirement** (encrypt each tenant's
  sensitive rows with a per-tenant key), RLS is still the access boundary, but
  the encryption layer sits *below* RLS. The atal-incubation SPEC v3 §25.4
  documents the pattern; the kit does not yet ship it.

---

*— End of pattern. The 1,000-line rationale lives in
`atal-incubation/TRAININGS.md` §1 "Mental model" and
`prisma/rls-policies.sql`. This pattern is the focused architect's-eye
view designed to be read before adopting RLS, not while debugging it.*

---

*— End of `multi-tenant-rls` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
