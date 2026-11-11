// AcceptInvite — where a shared invite link (email or phone, D36/D37) actually lands. Reads
// token_hash + type out of the URL and calls verifyOtp() directly, client-side, rather than
// sending anyone to Supabase's own /auth/v1/verify redirect endpoint (D38 — see the comment on
// ownInviteLink() in supabase/functions/invite-user/index.ts for exactly why: this app's
// hash-based routing and Supabase's own redirect both want the URL fragment for different
// things, a real collision; verifyOtp with a token_hash sidesteps it entirely since it's OTP
// verification, not something that depends on which OAuth flow the project is configured for).
//
// verifyOtp() succeeding establishes a real session, but the person hasn't set a password yet
// (email) or never has one to begin with until now (phone, D37) -- this page's second stage
// collects that password via supabase.auth.updateUser(). Rendered by App.tsx BEFORE the normal
// signed-in/signed-out branch, on purpose: as soon as verifyOtp() succeeds, useSession() would
// otherwise see a real session and the normal router would route straight to a role dashboard,
// skipping the password step entirely.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Stage = 'verifying' | 'set-password' | 'done' | 'error';

const inputCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function AcceptInvite() {
  const [stage, setStage] = useState<Stage>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // HashRouter isn't mounted for this page -- read the query string out of the hash directly.
    // Shape: '#/accept-invite?token_hash=...&type=invite'.
    const afterHash = window.location.hash.replace(/^#/, '');
    const queryStart = afterHash.indexOf('?');
    const params = new URLSearchParams(queryStart === -1 ? '' : afterHash.slice(queryStart + 1));
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (!token_hash || !type) {
      setError("This link is missing something it needs. Ask whoever invited you to send a new one.");
      setStage('error');
      return;
    }

    supabase.auth.verifyOtp({ token_hash, type: type as 'invite' }).then(({ error: verifyErr }) => {
      if (verifyErr) {
        setError(`This link didn't work (${verifyErr.message}). It may have already been used, or have expired — ask whoever invited you to send a new one.`);
        setStage('error');
        return;
      }
      setStage('set-password');
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setStage('done');
    // A full reload back to the bare origin (hash cleared) rather than an in-app navigate --
    // deliberately exits this one-time mode and lets useSession() pick the now-real session up
    // fresh, same as any other sign-in.
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname;
    }, 1200);
  }

  return (
    <div className="min-h-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-indigo-600">Jayshankar</h1>
          <p className="text-sm text-slate-500 mt-1">Fresh-fish wholesale inventory</p>
        </div>

        {stage === 'verifying' && (
          <p className="text-sm text-slate-500">Checking your invite…</p>
        )}

        {stage === 'error' && (
          <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {stage === 'set-password' && (
          <form onSubmit={onSubmit} className="space-y-5">
            <p className="text-sm text-slate-600">Almost done — set a password for your account.</p>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">Password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">Type it again</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              disabled={submitting || !password || !confirm}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Set password and continue'}
            </button>
          </form>
        )}

        {stage === 'done' && (
          <p className="text-sm text-green-700">All set — taking you in…</p>
        )}
      </div>
    </div>
  );
}
