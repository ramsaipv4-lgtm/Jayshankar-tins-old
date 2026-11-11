// useSession — the canonical "is anyone signed in, and if so, who?" hook.
// Reads auth state from Supabase, then looks up public.users.role + display_name
// for the routing decision. The trigger (handle_new_user) creates the public.users
// row on auth.users INSERT, so this lookup should never miss for a real user.

import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Role = 'admin' | 'co-admin' | 'vendor-rep' | 'worker' | 'super-worker';

export interface AppUser {
  id: string;
  // Nullable since D35/migration 0014: a phone-only account never has an email. Exactly one of
  // email/phone is guaranteed non-null by the database's users_identity_present CHECK, never
  // neither -- but TypeScript can't see a cross-column DB constraint, so both stay optional here.
  email: string | null;
  phone: string | null;
  displayName: string;
  role: Role;
}

interface UseSessionResult {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  error: string | null;
}

export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // identifier is whichever of email/phone the auth session actually has -- used only for the
    // error message below, never assumed non-null (D35: a phone-only session has no email).
    async function loadPublicUser(id: string, identifier: string) {
      const { data, error: e } = await supabase
        .from('users')
        .select('id, email, phone, display_name, role')
        .eq('id', id)
        .single();
      if (cancelled) return;
      if (e) {
        setError(`Could not load public.users: ${e.message}`);
        return;
      }
      if (data) {
        setUser({
          id: data.id,
          email: data.email,
          phone: data.phone,
          displayName: data.display_name,
          role: data.role as Role,
        });
      } else {
        setError(`Signed in as ${identifier} but no public.users row found. The handle_new_user trigger may not have run.`);
      }
    }

    async function loadInitial() {
      const { data: { session: s }, error: e } = await supabase.auth.getSession();
      if (cancelled) return;
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      setSession(s);
      if (s?.user) {
        await loadPublicUser(s.user.id, s.user.email ?? s.user.phone ?? s.user.id);
      }
      setLoading(false);
    }

    loadInitial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s);
      if (s?.user) {
        await loadPublicUser(s.user.id, s.user.email ?? s.user.phone ?? s.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading, error };
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

// Phone + OTP sign-in (D35 — the deferred "full implementation", NOT the active sign-in path;
// see D37). No password, ever; requestPhoneOtp texts a fresh code every time, verifyPhoneOtp
// completes the sign-in with that code. Requires an SMS provider connected in the Supabase
// Dashboard (SPEC.md §4.3.12) -- without one, requestPhoneOtp's error message will say so.
// Kept here, unused by any screen right now, specifically so reviving D35 later doesn't mean
// rewriting this from scratch — SignInForm.tsx currently calls signInPhonePassword instead.
export async function requestPhoneOtp(phone: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  return { error: error?.message ?? null };
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  return { error: error?.message ?? null };
}

// D37 -- phone + password, the ACTIVE phone sign-in mechanism (a "graceful degradation" of D35's
// OTP design, per the user's own framing: no SMS provider needed at all, at the honest cost of
// a password to remember). phoneToSyntheticEmail must derive EXACTLY the same string the
// invite-user Edge Function derived at account-creation time (kept in sync by hand across the
// two runtimes -- same tolerated-duplication pattern as the role list, SPEC.md §4.3.12 step 2).
// Not a secret: deriving it is equivalent to knowing the phone number, which isn't the
// credential -- the password is, and ordinary signInWithPassword rate-limiting/lockout applies.
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function phoneToSyntheticEmail(phone: string): string {
  return `${phoneDigits(phone)}@phone.invalid`;
}

// D39 -- this app serves exactly one client, always in Tamil Nadu, always +91. Asking a
// non-technical user to type a country code they don't think of themselves as having is pure
// friction with zero real benefit here. Normalizes a bare 10-digit number into E.164 (what the
// Edge Function and every phone-format check still require) automatically, so the country code
// never needs to be shown or typed anywhere in the UI. Accepts "9876543210", "919876543210", or
// an already-prefixed "+919876543210" and returns the canonical "+919876543210" form; anything
// else that doesn't look like an Indian mobile number is returned trimmed but unchanged, so the
// real E.164 check downstream still rejects it with a clear message rather than this function
// silently guessing wrong.
export function normalizeIndianPhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return trimmed;
}

export async function signInPhonePassword(phone: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email: phoneToSyntheticEmail(phone), password });
  return { error: error?.message ?? null };
}

// Supabase/GoTrue stores phone numbers without the leading '+' (verified live against the real
// Admin API while building D35 -- "+919876543210" in, "919876543210" back out, on both
// auth.users and public.users). Fine for matching/sign-in, confusing to read in the UI -- this
// is display-only formatting, never used for comparisons or sent back to any API.
export function formatPhone(phone: string | null): string | null {
  if (!phone) return phone;
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}
