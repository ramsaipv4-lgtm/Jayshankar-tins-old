// TeamManagement — admin-only: change an EXISTING user's role/access, or invite someone who's
// never signed in before. The first half already worked at the backend level before this file
// existed (users_update_admin RLS + the co-admin fix, decision #46) — there was just no UI. The
// second half (a genuinely new login) needed the invite-user Edge Function (SPEC.md §4.3.12,
// D34, decision #51) — creating a real auth.users row needs the service-role key, which must
// never touch the client, so this form calls a server-side function instead of writing to any
// table directly.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatPhone, normalizeIndianPhone, useSession } from '../lib/auth';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';
import RoleBadge, { ROLE_LABELS } from '../components/RoleBadge';

interface TeamUser {
  id: string;
  // Nullable since D35/migration 0014: a phone-only account never has an email, and vice versa.
  email: string | null;
  phone: string | null;
  display_name: string;
  role: 'admin' | 'co-admin' | 'vendor-rep' | 'worker' | 'super-worker';
  active: boolean;
  can_self_reverse: boolean;
}

// Shares RoleBadge.tsx's ROLE_LABELS rather than its own copy -- these had drifted out of sync
// with each other once already (found while answering the user's own question about friendlier
// role names), not worth risking a second time.
const ROLE_OPTIONS: { value: TeamUser['role']; label: string }[] = [
  { value: 'admin', label: ROLE_LABELS.admin },
  { value: 'co-admin', label: ROLE_LABELS['co-admin'] },
  { value: 'vendor-rep', label: ROLE_LABELS['vendor-rep'] },
  { value: 'worker', label: ROLE_LABELS.worker },
  { value: 'super-worker', label: ROLE_LABELS['super-worker'] },
];

const selectCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function TeamManagement() {
  const { user: me } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TeamUser | 'invite' | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', 'team-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, phone, display_name, role, active, can_self_reverse')
        .order('active', { ascending: false })
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as TeamUser[];
    },
  });

  if (editing === 'invite') {
    return (
      <InviteForm
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['users'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (editing) {
    return (
      <TeamUserForm
        teamUser={editing}
        isSelf={editing.id === me?.id}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['users'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Team</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tap someone to change their role or turn their access off.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('invite')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Invite someone new
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {users?.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setEditing(u)}
            className={`w-full text-left rounded-lg border p-4 hover:bg-slate-50 ${u.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {u.display_name}
                  {u.id === me?.id && <span className="text-slate-500 font-normal"> (you)</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{u.email ?? formatPhone(u.phone)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RoleBadge role={u.role} />
                {!u.active && <span className="text-xs text-red-600 font-medium">Off</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

const OPERATIONAL_ROLES: TeamUser['role'][] = ['vendor-rep', 'worker', 'super-worker'];

function TeamUserForm({ teamUser, isSelf, onDone, onCancel }: { teamUser: TeamUser; isSelf: boolean; onDone: () => void; onCancel: () => void }) {
  const [role, setRole] = useState<TeamUser['role']>(teamUser.role);
  const [active, setActive] = useState(teamUser.active);
  const [canSelfReverse, setCanSelfReverse] = useState(teamUser.can_self_reverse);
  const [submitting, setSubmitting] = useState(false);
  // can_self_reverse is admin/co-admin only, enforced at the database level (migration 0033) --
  // a trigger auto-clears it the moment role changes away from either, so the checkbox only
  // ever makes sense to show (and would otherwise silently do nothing) for those two roles.
  const isAdminTier = role === 'admin' || role === 'co-admin';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Only worth asking if they currently hold an operational role at all — otherwise there's
  // nothing that could be orphaned by this edit. A trigger (migration 0030) does the actual
  // force-reassignment; this is just so the admin isn't surprised by it after the fact.
  const wasOperational = OPERATIONAL_ROLES.includes(teamUser.role) && teamUser.active;
  const { data: openTaskCount } = useQuery({
    queryKey: ['tasks', 'open-count', teamUser.id],
    enabled: wasOperational,
    queryFn: async () => {
      const { count, error: countErr } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', teamUser.id)
        .in('status', ['pending', 'in_progress']);
      if (countErr) throw countErr;
      return count ?? 0;
    },
  });
  const willOrphan = wasOperational && !(OPERATIONAL_ROLES.includes(role) && active) && !!openTaskCount;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: updateErr } = await supabase
      .from('users')
      .update({ role, active, can_self_reverse: isAdminTier ? canSelfReverse : false })
      .eq('id', teamUser.id);
    setSubmitting(false);
    if (updateErr) { setError(`Could not save: ${updateErr.message}`); return; }
    setSuccess(`${teamUser.display_name} updated.`);
    setTimeout(onDone, 600);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">{teamUser.display_name}</h2>
      <p className="text-sm text-slate-500">{teamUser.email ?? formatPhone(teamUser.phone)}</p>

      {isSelf && (
        <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          This is your own account. Be careful — changing your own role or turning off your own
          access could lock you out immediately.
        </div>
      )}

      {willOrphan && (
        <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          {teamUser.display_name} has {openTaskCount} open task{openTaskCount === 1 ? '' : 's'} right
          now. Saving this change will automatically hand {openTaskCount === 1 ? 'it' : 'them'} to
          someone else who can still do the work — {teamUser.display_name} won't be able to see
          {openTaskCount === 1 ? ' it' : ' them'} on My tasks anymore once this role no longer
          qualifies.
        </div>
      )}

      <FormField id="role" label="Role" required>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as TeamUser['role'])}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
        Access on (uncheck to turn off their access without deleting their history)
      </label>

      {isAdminTier && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={canSelfReverse} onChange={(e) => setCanSelfReverse(e.target.checked)} className="rounded border-slate-300" />
          Can approve their own reversal requests instantly, without another admin reviewing first
        </label>
      )}

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// E.164: '+' then 7-15 digits, first digit 1-9. Same shape the invite-user Edge Function
// validates server-side (SPEC.md §4.3.12) -- checked here too so a malformed number gets a
// clear message before the round-trip, not just whatever Supabase's own error says.
const E164_RE = /^\+[1-9]\d{6,14}$/;

function InviteForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  // D36/D37: email and phone are still two different fields (an admin decision about how this
  // person will sign in later — password behind an email vs. password behind a phone number),
  // but both now go through the exact same link-based workflow underneath — the form makes the
  // choice explicit rather than guessing from what looks like a phone number.
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<TeamUser['role']>('worker');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D36/D37: neither path auto-sends anything any more — both hand back a link the admin has to
  // actually copy and share. Set on success; while set, the form shows the "here's the link"
  // panel instead of auto-closing (there'd be nothing left to share).
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // D39 -- normalized before ever being checked/sent, so a plain 10-digit number (no country
  // code, nothing the admin has to think about) is valid input, not an error state.
  const identifierValid = method === 'email' ? !!email.trim() : E164_RE.test(normalizeIndianPhone(phone));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const normalizedPhone = normalizeIndianPhone(phone);
    if (method === 'phone' && !E164_RE.test(normalizedPhone)) {
      setSubmitting(false);
      setError("That doesn't look like a valid 10-digit number.");
      return;
    }

    // supabase.functions.invoke automatically attaches the current signed-in user's own JWT as
    // the Authorization header — exactly what the invite-user Edge Function verifies the caller
    // with (SPEC.md §4.3.12 step 1). No manual header/token handling needed here.
    const body = method === 'email'
      ? { email: email.trim(), role, display_name: displayName.trim() }
      : { phone: normalizedPhone, role, display_name: displayName.trim() };
    const { data, error: invokeErr } = await supabase.functions.invoke('invite-user', { body });
    setSubmitting(false);

    if (invokeErr) { setError(`Could not send invite: ${invokeErr.message}`); return; }
    if (data?.error) { setError(data.error); return; }

    // Don't auto-close (D36/D37): the admin still has to copy/share this link — closing now
    // would lose it with no way to get it back short of re-inviting.
    setInviteLink(data.invite_link);
  }

  if (inviteLink) {
    const shareText = `Here's your invite to Jayshankar: ${inviteLink}`;
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-xl font-semibold text-slate-800">Invite ready for {displayName}</h2>
        <p className="text-sm text-slate-500">
          Nothing has been sent yet — copy this link and share it yourself (WhatsApp, SMS, in
          person). It lets {displayName} set up their own password; you never see or set it.
        </p>

        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 break-all select-all">
          {inviteLink}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard access can fail (permissions, non-secure context) — the link is
                // already visible and select-all above, so the admin can still copy it by hand.
              }
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={() => { navigator.share({ text: shareText }).catch(() => {}); }}
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50"
            >
              Share…
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Invite someone new</h2>

      <div className="flex gap-2" role="radiogroup" aria-label="How should they sign in?">
        {(['email', 'phone'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={`rounded-md px-4 py-2 text-sm font-medium border ${method === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
          >
            {m === 'email' ? 'By email' : 'By phone number'}
          </button>
        ))}
      </div>

      {method === 'email' ? (
        <>
          <p className="text-sm text-slate-500">
            You'll get a link to send them yourself (WhatsApp, SMS, whatever's easiest) — nothing
            is sent automatically. They use it to set up their own password; you never see or set
            it for them.
          </p>
          <FormField id="invite-email" label="Email address" required>
            <TextInput id="invite-email" label="" type="email" value={email} onChange={setEmail} required placeholder="e.g. suresh@example.com" />
          </FormField>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Same idea as email — you'll get a link to share, they set their own password with it.
            They sign in with this phone number and that password.
          </p>
          <FormField id="invite-phone" label="Phone number" required>
            <TextInput id="invite-phone" label="" type="tel" value={phone} onChange={setPhone} required placeholder="e.g. 9876543210" />
          </FormField>
          {/* Live inline feedback, not just a disabled button with no explanation (found from
              real device testing). Checked against the normalized number -- a plain 10-digit
              number is fine (D39, no country code needed) -- only shows once they've typed
              something that's still wrong after normalizing. */}
          {phone.trim() && !E164_RE.test(normalizeIndianPhone(phone)) && (
            <p role="alert" className="text-sm text-red-600 -mt-2">
              That doesn't look like a valid 10-digit number.
            </p>
          )}
        </>
      )}

      <FormField id="invite-name" label="Name" required>
        <TextInput id="invite-name" label="" value={displayName} onChange={setDisplayName} required placeholder="e.g. Suresh" />
      </FormField>

      <FormField id="invite-role" label="Role" required>
        <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as TeamUser['role'])} required className={selectCls}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      <FormError message={error} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !identifierValid || !displayName.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating…' : method === 'email' ? 'Get invite link' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
