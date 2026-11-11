# `lib/auth-shell` — kit code module

> **The "auth shell" kit module.** NOT a full auth implementation — it
> provides the session shape + the role-gating primitives that consumer apps
> build on top of Supabase / NextAuth / Auth0 / custom JWT.
>
> **Provides:** `Session` type, `useSession` (client), `getServerSession`
> (server), `requireRole` (API guard), `<RoleGate>` (UI gate), `ROLES`
> (controlled vocabulary), `handleFirstUserIsAdmin` (the "first sign-up
> becomes admin" pattern).
>
> **Source:** `Jayshankar/src/lib/auth.ts` + `src/components/Layout.tsx`.
> See `lib/patterns/supabase-auth-trigger.md` for the Supabase-specific
> trigger work.

---

## Install

```bash
cp -r tins-kit/lib/auth-shell/ src/lib/auth-shell/
```

The module is zero-dep (just React for the hook + component). The
consumer wires their own auth provider via `setSessionProvider`.

---

## Setup

### 1. Wire your auth provider at app startup

```ts
// src/main.tsx (client) or src/app/layout.tsx (Next.js)
import { setSessionProvider } from '@/lib/auth-shell';
import { supabase } from '@/lib/supabase';

setSessionProvider({
  getServerSession: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      userId: data.user.id,
      email: data.user.email!,
      role: 'ADMIN',  // wire to your users.role column
      tenantId: 't-1',
    };
  },
  onSessionChange: (cb) => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cb(session ? toSession(session) : null);
    });
    return () => data.subscription.unsubscribe();
  },
});
```

### 2. Use `useSession` in client components

```tsx
import { useSession } from '@/lib/auth-shell';

function Header() {
  const session = useSession();
  return (
    <header>
      {session ? `Welcome, ${session.email}` : <a href="/login">Sign in</a>}
    </header>
  );
}
```

### 3. Use `requireRole` in API routes

```ts
// src/app/api/admin/users/route.ts
import { requireRole } from '@/lib/auth-shell';

export async function GET(req: Request) {
  const guard = await requireRole(req, 'ADMIN');
  if (!guard.ok) return guard.response;
  const { session } = guard;
  // ... rest of the handler
}
```

### 4. Use `<RoleGate>` in UI

```tsx
import { RoleGate } from '@/lib/auth-shell';

function AdminPanel() {
  return (
    <RoleGate roles="ADMIN" fallback={<p>You don't have access.</p>}>
      <h1>Admin Panel</h1>
    </RoleGate>
  );
}
```

### 5. Use `handleFirstUserIsAdmin` in the signup flow

```ts
import { handleFirstUserIsAdmin } from '@/lib/auth-shell';

const role = handleFirstUserIsAdmin({
  isFirstUser: existingUserCount === 0,
  isSuperAdminSystem: false,
  defaultRole: 'MEMBER',
});
// First signup → 'ADMIN'. Subsequent → 'MEMBER'.
```

---

## API

### `Session`

```ts
interface Session {
  userId: string;
  email: string;
  role: Role;
  tenantId: string | null; // null for SUPER_ADMIN
  expiresAt?: number;
}
```

### `ROLES`

The controlled vocabulary:

```ts
const ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MEMBER', 'MENTOR',
  'STARTUP_FOUNDER', 'OBSERVER', 'INVESTOR', 'GUEST',
] as const;
type Role = (typeof ROLES)[number];
```

Consumers may add custom roles, but they must be appended (not reordered) to
preserve the kit's compatibility.

### `setSessionProvider(provider)`

Wire the consumer's auth provider. Must be called once at app startup
(client and server separately).

### `useSession()`

Client-side React hook returning the current `Session | null`.

### `getServerSession()`

Server-side helper. Returns the current `Session | null`. Throws if no
provider is wired.

### `requireRole(req, role)`

API route guard. Returns `{ ok: true, session }` if the session has the
required role; otherwise returns `{ ok: false, response }` where `response`
is a 401 or 403 `Response` ready to return.

**SUPER_ADMIN always passes.** This is intentional — SUPER_ADMIN is the
escape hatch for cross-tenant operations.

### `<RoleGate roles={...}>`

UI gate. Renders children if the session has the required role; otherwise
renders the optional `fallback`.

**`SUPER_ADMIN` always sees the children.** Same reason as `requireRole`.

### `handleFirstUserIsAdmin({ isFirstUser, isSuperAdminSystem, defaultRole })`

The "first sign-up becomes admin" pattern. Returns `'ADMIN'` (or
`'SUPER_ADMIN'` for single-tenant systems) for the first user;
`defaultRole` for subsequent users.

---

## The 3 rules

### 1. Always wire `setSessionProvider` before any consumer code runs

If `setSessionProvider` is not called, `getServerSession` throws and
`useSession` returns `null` (which is silent — bad). The consumer's app
startup must call `setSessionProvider` *before* any route or component
uses the session helpers.

### 2. `SUPER_ADMIN` is the escape hatch

`SUPER_ADMIN` always passes `requireRole` and `<RoleGate>`. This is
intentional — SUPER_ADMIN is for cross-tenant operations (admin tools,
migrations, batch jobs). Consumers that want a stricter check should
explicitly deny SUPER_ADMIN in their handler:

```ts
const guard = await requireRole(req, 'ADMIN');
if (!guard.ok) return guard.response;
if (guard.session.role === 'SUPER_ADMIN') {
  return new Response('SUPER_ADMIN not allowed here', { status: 403 });
}
```

### 3. The session is server-side authoritative

Never trust a client-side `useSession` for access control. The API route
handler is the gate; the client-side `<RoleGate>` is a UX hint, not a
security boundary.

---

## When to extend

- **If the consumer adds custom roles** (e.g. `'AUDITOR'`): extend
  `ROLES` with the new role. Note: this is a typed breaking change —
  consumers on the old `ROLES` will not see the new role.
- **If the consumer needs per-resource RBAC** (a user can do X to deal #1
  but not deal #2): the kit's `requireRole` is coarse-grained. Build a
  per-resource check on top, or use `lib/tenant-rls/` to enforce at the
  database layer.
- **If the consumer needs a session refresh interval**: wrap `useSession`
  in a custom hook that re-fetches every N minutes.

---

## Tests

See `tests/auth-shell.test.ts` for the 3-case test suite: happy-path
(`requireRole` returns `ok: true` for the right role), edge-case
(`requireRole` returns `401` for missing session), error-case
(`handleFirstUserIsAdmin` returns the right role for the first user).

---

*— End of `lib/auth-shell/README.md`. See also:
`lib/patterns/supabase-auth-trigger.md` (the Supabase-specific trigger work),
`lib/tenant-rls/` (the database-layer enforcement).*
