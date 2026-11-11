// SignInForm — the only auth screen. One field, not a tab per method (D39): this app serves one
// client, so making a non-technical person pick "email" or "phone" before they've even typed
// anything is a decision they shouldn't have to make. One identifier field auto-detects which
// kind it is (an "@" means email, otherwise it's treated as a phone number and normalized --
// D39, no country code needed anywhere in this app) and calls the matching sign-in path
// underneath: email + password, or phone + password (D37 — a deliberate "graceful degradation"
// of D35's phone+OTP design: same password-based mechanism as email, no SMS provider needed at
// all, at the honest cost of a password to remember. D35's OTP design stays specified for
// later, not built here — see requestPhoneOtp/verifyPhoneOtp in lib/auth.ts, unused on purpose).
// SPEC §3.5: visible labels (not just placeholders), focus rings, AA contrast.

import { useEffect, useRef, useState } from 'react';
import { signIn, signInPhonePassword, normalizeIndianPhone } from '../lib/auth';

const inputCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function SignInForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const value = identifier.trim();
    const isEmail = value.includes('@');
    const { error: err } = isEmail
      ? await signIn(value, password)
      : await signInPhonePassword(normalizeIndianPhone(value), password);

    if (err) {
      setError(err);
      setSubmitting(false);
    }
    // On success, the auth listener in useSession picks up the new session; App.tsx switches
    // views. We don't navigate here.
  }

  return (
    <div className="min-h-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-indigo-600">Jayshankar</h1>
          <p className="text-sm text-slate-500 mt-1">Fresh-fish wholesale inventory</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" aria-labelledby="signin-title">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-slate-700">
              Email or phone number
            </label>
            <input
              ref={identifierRef}
              id="identifier"
              type="text"
              inputMode="email"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !identifier.trim() || !password}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          Demo users: admin@jayshankar.demo / rep@jayshankar.demo / worker@jayshankar.demo
        </p>
      </div>
    </div>
  );
}
