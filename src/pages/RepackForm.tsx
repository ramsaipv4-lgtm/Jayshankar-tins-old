// RepackForm — worker/vendor-rep records a repack. Source container fill
// (near-empty) is emptied; a new destination fill is created with the source's
// UNCHANGED filled_at and expires_at timestamps. The whole point of this
// operation is never making fish appear fresher than it is — see
// supabase/migrations/0008_record_repack.sql step 2 for the discipline.
//
// The frontend does not compute or touch any date/time logic; the RPC
// (record_repack) does, and we display what it returns.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth';
import { useOnlineStatus } from '../lib/online';
import { recordRepack } from '../lib/mutations';
import { AvailableContainerSelect, FormError, FormField, FormFooter, FormSuccess, SourceFillSelect } from '../components/FormFields';

export default function RepackForm() {
  const { user } = useSession();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [sourceFillId, setSourceFillId] = useState('');
  const [destinationContainerId, setDestinationContainerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // App.tsx only renders this form when user is signed in. TypeScript doesn't
  // know that, so we use a const + null-check here and at every `user.role` use.
  // /repack widened to admin/co-admin to match record_repack's own role check exactly
  // (V1-completeness pass) -- same reasoning as SpoilageForm.tsx's identical fix.
  const isAdminTier = user?.role === 'admin' || user?.role === 'co-admin';
  const backHref = isAdminTier ? '/admin' : user?.role === 'vendor-rep' ? '/rep' : '/floor';
  const backLabel = isAdminTier ? 'Back to admin dashboard' : user?.role === 'vendor-rep' ? 'Back to rep dashboard' : 'Back to floor dashboard';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      setError('You are offline. Reconnect to repack a container.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, kgMoved, expiresAt } = await recordRepack({ sourceFillId, destinationContainerId }, user.id);
    setSubmitting(false);
    if (err) { setError(err); return; }
    // The whole point of this screen is proving the new container kept the
    // source's expiry — so the success message shows the actual returned value,
    // not a generic "Repack recorded".
    const formattedExpiry = expiresAt ? new Date(expiresAt).toLocaleString() : '—';
    setSuccess(`Repacked ${kgMoved.toFixed(3)} kg. Expires ${formattedExpiry}.`);
    setSourceFillId(''); setDestinationContainerId('');
    // Invalidate the dropdowns so the just-emptied source and just-filled
    // destination disappear from their lists, plus recent-activity to surface
    // the new movement row.
    qc.invalidateQueries({ queryKey: ['container-fills', 'repack-source'] });
    qc.invalidateQueries({ queryKey: ['containers', 'repack-destination'] });
    qc.invalidateQueries({ queryKey: ['recent-activity'] });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Repack container</h2>
      <p className="text-sm text-slate-500">Moves a near-empty container's stock into a smaller one. The new container keeps the original's exact fill date — repacking never makes stock look fresher.</p>

      <FormField id="source-fill" label="Source fill (near-empty container)" required>
        <SourceFillSelect id="source-fill" value={sourceFillId} onChange={setSourceFillId} />
      </FormField>

      <FormField id="destination-container" label="Destination container (must be smaller and empty)" required>
        <AvailableContainerSelect id="destination-container" value={destinationContainerId} onChange={setDestinationContainerId} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <button
        type="submit"
        disabled={submitting || !online || !sourceFillId || !destinationContainerId}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Repacking…' : 'Repack container'}
      </button>

      <FormFooter backHref={backHref} backLabel={backLabel} />
    </form>
  );
}
