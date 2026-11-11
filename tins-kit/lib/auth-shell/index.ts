// lib/auth-shell/index.ts
//
// The "auth shell" kit module. NOT a full auth implementation — it provides
// the session shape + the role-gating primitives that consumer apps build
// on top of Supabase / NextAuth / Auth0 / custom JWT.
//
// Provides:
//   - Session: the canonical session shape
//   - useSession: client-side React hook
//   - getServerSession: server-side helper (with a SessionProvider
//     interface for the consumer to wire to Supabase/NextAuth/etc.)
//   - requireRole: API route helper that returns 401/403 if the session
//     doesn't have the right role
//   - RoleGate: React component that conditionally renders children
//   - ROLES: the controlled vocabulary
//   - handleFirstUserIsAdmin: the "first sign-up becomes admin" pattern
//
// Source: Jayshankar/src/lib/auth.ts + src/components/Layout.tsx (the
// canonical implementation). See lib/patterns/supabase-auth-trigger.md for
// the Supabase-specific trigger work.

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Session {
  userId: string;
  email: string;
  role: Role;
  tenantId: string | null; // null for SUPER_ADMIN
  expiresAt?: number; // unix ms
}

export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MEMBER',
  'MENTOR',
  'STARTUP_FOUNDER',
  'OBSERVER',
  'INVESTOR',
  'GUEST',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * The provider interface. Consumers wire this to Supabase / NextAuth /
 * Auth0 / custom JWT. The kit ships only the type.
 */
export interface SessionProvider {
  /** Read the current session from the request (server-side). */
  getServerSession: () => Promise<Session | null>;
  /** Subscribe to session changes (client-side). */
  onSessionChange: (cb: (session: Session | null) => void) => () => void;
}

// ---------------------------------------------------------------------------
// DEFAULT SESSION PROVIDER (the consumer replaces this)
// ---------------------------------------------------------------------------

let _provider: SessionProvider | null = null;

/**
 * The consumer MUST call this once at app startup to wire the kit's session
 * helpers to the consumer's auth provider (Supabase, NextAuth, etc.).
 *
 *   import { setSessionProvider } from '@/lib/auth-shell';
 *   import { supabase } from '@/lib/supabase';
 *
 *   setSessionProvider({
 *     getServerSession: async () => {
 *       const { data } = await supabase.auth.getUser();
 *       if (!data.user) return null;
 *       return { userId: data.user.id, email: data.user.email!, role: 'ADMIN', tenantId: 't-1' };
 *     },
 *     onSessionChange: (cb) => {
 *       return supabase.auth.onAuthStateChange((_event, session) => cb(session ? toSession(session) : null)).data.subscription.unsubscribe;
 *     },
 *   });
 */
export function setSessionProvider(provider: SessionProvider): void {
  _provider = provider;
}

// ---------------------------------------------------------------------------
// useSession: client-side React hook
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!_provider) {
      // No provider wired — return null. The consumer MUST call
      // setSessionProvider at app startup.
      return;
    }
    return _provider.onSessionChange(setSession);
  }, []);
  return session;
}

// ---------------------------------------------------------------------------
// getServerSession: server-side helper
// ---------------------------------------------------------------------------

export async function getServerSession(): Promise<Session | null> {
  if (!_provider) {
    throw new Error(
      'auth-shell: no SessionProvider wired. Call setSessionProvider() at app startup.'
    );
  }
  return _provider.getServerSession();
}

// ---------------------------------------------------------------------------
// requireRole: API route helper
// ---------------------------------------------------------------------------

/**
 * The return type. If `ok` is true, `session` is set. Otherwise, the API
 * route should return the `response`.
 */
export type RequireRoleResult =
  | { ok: true; session: Session }
  | { ok: false; response: Response };

/**
 * Guard an API route: returns the session if it exists and has the required
 * role; otherwise returns a 401 or 403 response. The API route handler
 * uses the result like:
 *
 *   const guard = await requireRole(req, 'ADMIN');
 *   if (!guard.ok) return guard.response;
 *   const { session } = guard;
 *   // ... rest of the handler
 */
export async function requireRole(
  _req: Request,
  role: Role | Role[]
): Promise<RequireRoleResult> {
  const session = await getServerSession();
  if (!session) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    };
  }
  const allowed = Array.isArray(role) ? role : [role];
  // SUPER_ADMIN is always allowed
  if (session.role !== 'SUPER_ADMIN' && !allowed.includes(session.role)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    };
  }
  return { ok: true, session };
}

// ---------------------------------------------------------------------------
// RoleGate: React component
// ---------------------------------------------------------------------------

export interface RoleGateProps {
  /** The role(s) that may see the children. SUPER_ADMIN always sees. */
  roles: Role | Role[];
  /** The children to render if the role check passes. */
  children: React.ReactNode;
  /** Optional fallback to render if the role check fails. */
  fallback?: React.ReactNode;
}

export function RoleGate(props: RoleGateProps) {
  const session = useSession();
  if (!session) return <>{props.fallback ?? null}</>;
  const allowed = Array.isArray(props.roles) ? props.roles : [props.roles];
  if (session.role === 'SUPER_ADMIN' || allowed.includes(session.role)) {
    return <>{props.children}</>;
  }
  return <>{props.fallback ?? null}</>;
}

// ---------------------------------------------------------------------------
// handleFirstUserIsAdmin: the "first sign-up becomes admin" pattern
// ---------------------------------------------------------------------------

/**
 * Returns the role for a new user. The first user in the system becomes
 * ADMIN (or SUPER_ADMIN for single-tenant systems). Subsequent users get
 * the default role.
 *
 *   const role = handleFirstUserIsAdmin({
 *     isFirstUser: existingUserCount === 0,
 *     isSuperAdminSystem: false,
 *     defaultRole: 'MEMBER',
 *   });
 *   // → 'ADMIN' (if isFirstUser) or 'MEMBER' (otherwise)
 */
export function handleFirstUserIsAdmin(params: {
  isFirstUser: boolean;
  isSuperAdminSystem: boolean;
  defaultRole: Role;
}): Role {
  if (params.isFirstUser) {
    return params.isSuperAdminSystem ? 'SUPER_ADMIN' : 'ADMIN';
  }
  return params.defaultRole;
}

export default {
  useSession,
  getServerSession,
  requireRole,
  RoleGate,
  setSessionProvider,
  handleFirstUserIsAdmin,
  ROLES,
};
