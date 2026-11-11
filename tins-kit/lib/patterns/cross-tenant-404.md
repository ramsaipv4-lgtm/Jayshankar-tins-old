# `cross-tenant-404` — kit pattern

> **The security pattern for multi-tenant APIs: return 404, never 403, when a
> resource exists in another tenant.** Self-contained.
>
> **Source:** `atal-incubation/TRAININGS.md` §9 "Multi-tenant architecture — why 404
> beats 403" (the canonical writeup). This pattern is the focused 1-page version
> designed to be read at code-review time.

---

## 0. Why this exists

The naive way to handle a resource lookup that crosses tenants is:

```ts
const resource = await prisma.resource.findUnique({ where: { id } });
if (!resource) return res.status(404).json({ error: 'Not found' });
if (resource.tenantId !== session.tenantId) return res.status(403).json({ error: 'Forbidden' });
```

This looks correct. It is a security leak.

An attacker who probes the resource graph with `GET /api/resource/<id>` learns:

| Response | Meaning |
|---|---|
| 200 | The resource exists, and it's in my tenant. |
| 403 | The resource exists, but in someone else's tenant. |
| 404 | The resource does not exist, OR it's in someone else's tenant. |

The 403 response *confirms the existence* of a resource the attacker doesn't own.
Combined with a leaked user ID (e.g. from a public profile page or a stale screenshot),
the attacker can enumerate the entire resource graph one ID at a time.

The fix: return 404 in both the "doesn't exist" and "exists in another tenant" cases.

---

## 1. The 3 lessons, in detail

### Lesson 1 — Treat "not yours" as "not found"

```ts
const resource = await prisma.resource.findUnique({ where: { id } });
if (!resource) return res.status(404).json({ error: 'Not found' });
if (resource.tenantId !== session.tenantId) return res.status(404).json({ error: 'Not found' });
```

The two error messages must be IDENTICAL. The HTTP body, the headers, the timing —
all the same. An attacker must not be able to distinguish "doesn't exist" from
"exists, not yours."

If you really want to surface "forbidden" for non-tenant reasons (e.g. an admin
suspended the user), make sure the reason is genuinely about the *caller* (not the
resource), and document it. Example: returning 403 for "your account is suspended"
is fine because the reason is about the *caller's* state, not the resource's
existence.

### Lesson 2 — Never `findUnique` on the superuser client for tenant-scoped data

If a route uses `basePrisma` (the superuser client that bypasses RLS) to look up the
resource, the application has to do the tenant check itself — and that's the bug.
A forgotten `if (resource.tenantId !== session.tenantId)` line is a 403 leak.

The pattern's rule: **always use `getPrismaClient(session)`** (which returns the
restricted client for non-SUPER_ADMIN sessions) for tenant-scoped routes. The
restricted client + RLS enforces the tenant filter at the database; a "doesn't
exist or not yours" 404 is the natural Prisma response (the query returned `null`
because RLS hid the row).

### Lesson 3 — Batch lookups need the same treatment

A `findMany({ where: { id: { in: [...] } } })` is no exception. The RLS layer hides
foreign-tenant rows from the result; the handler treats the result as authoritative
(returns 200 with the rows it can see, doesn't say "we hid 5 IDs you asked about").
A common bug: the handler checks "is the result count equal to the requested count?"
and returns 404 if not. This leaks the *count* of cross-tenant matches, which is a
weaker but still a leak. The pattern: trust the result, never compare counts.

---

## 2. The 2 known anti-patterns

| Anti-pattern | What the leak is | How to spot it in code review |
|---|---|---|
| `if (!user) return 404; if (user.tenantId !== session.tenantId) return 403;` | Resource-existence leak. | grep for `403` in API routes. |
| `if (results.length !== ids.length) return 404;` | Count leak. | grep for `.length !==` in route handlers. |

The grep-friendly rule: **a multi-tenant route handler may return 200 or 404, never
403, never 409, never "we hid N rows"**. Any deviation is a code-review fail.

---

## 3. The 1 exception (and how to handle it)

**SUPER_ADMIN** is the only role allowed to see cross-tenant resources. The pattern:

- `if (session.role === 'SUPER_ADMIN') { return the resource; }`
- Else, treat as tenant-scoped; RLS does the rest.

The `getPrismaClient(session)` helper returns `basePrisma` for SUPER_ADMIN, which
bypasses RLS. The route handler is allowed to do cross-tenant operations on
SUPER_ADMIN's behalf. **But**: every cross-tenant operation is audit-logged, and
the SUPER_ADMIN's actions are visible to a (future) auditor role.

---

## 4. When this changes (the V2 upgrade path)

- **If you add a role that's allowed to see resources across tenants** (e.g. an
  auditor), add the same audit-logging rule.
- **If you add rate-limiting** to a multi-tenant endpoint, the rate limiter must
  see only the caller's own resources (otherwise an attacker can probe by
  rate-limit-induced 429s). The kit's `lib/docs-guardian/` documentation references
  this pattern in § "Anti-patterns to avoid in API design."

---

*— End of pattern. The 1,200-line rationale lives in
`atal-incubation/TRAININGS.md` §9. This pattern is the focused version
designed to be read at code-review time.*

---

*— End of `cross-tenant-404` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
