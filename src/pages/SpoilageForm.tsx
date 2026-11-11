// SpoilageForm — worker/vendor-rep records spoilage. Calls
// record_container_spoilage (migration 0009), which runs the same two-phase
// cascade as recordSale: container fills first, then un-contained batches.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth';
import { useOnlineStatus } from '../lib/online';
import { recordSpoilage } from '../lib/mutations';
import { FormError, FormField, FormFooter, FormSuccess, LocationSelect, SkuSelect, TextInput } from '../components/FormFields';

const REASONS = [
  'Expired (past shelf life)',
  'Damaged in storage',
  'Damaged in transit',
  'Quality rejected (smell/colour)',
  'Power failure (refrigeration)',
  'Other',
];

export default function SpoilageForm() {
  const { user } = useSession();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [skuId, setSkuId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [kg, setKg] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // App.tsx only renders this form when user is signed in. TypeScript doesn't
  // know that, so we use consts with null-safe defaults.
  // /spoil widened to admin/co-admin to match record_container_spoilage's own role check
  // exactly (V1-completeness pass) -- they need their own branch, not the vendor-rep/else split
  // that predates their access, or "else" would send them to /floor, a page their role can't
  // even open.
  const isAdminTier = user?.role === 'admin' || user?.role === 'co-admin';
  const backHref = isAdminTier ? '/admin' : user?.role === 'vendor-rep' ? '/rep' : '/floor';
  const backLabel = isAdminTier ? 'Back to admin dashboard' : user?.role === 'vendor-rep' ? 'Back to rep dashboard' : 'Back to floor dashboard';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      setError('You are offline. Reconnect to record spoilage.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, shortfall, containerSourcedKg, directSourcedKg } = await recordSpoilage({
      skuId,
      locationId,
      totalKg: Number(kg),
      reason,
      notes: notes || undefined,
    }, user.id);
    setSubmitting(false);
    if (err) { setError(err); return; }
    const short = shortfall > 0 ? ` (shortfall: ${shortfall.toFixed(3)} kg)` : '';
    // Same split logic as SaleForm: only show the container/direct breakdown
    // when both contributed. When directSourcedKg is 0, the breakdown is
    // implied (everything came from containers) and showing it is noise.
    const split = directSourcedKg > 0
      ? ` (${containerSourcedKg.toFixed(3)} kg from containers, ${directSourcedKg.toFixed(3)} kg from storage)`
      : '';
    setSuccess(`Spoilage recorded${short}${split}.`);
    setKg(''); setNotes('');
    qc.invalidateQueries({ queryKey: ['active-batches'] });
    qc.invalidateQueries({ queryKey: ['recent-activity'] });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Record spoilage</h2>
      <p className="text-sm text-slate-500">Marks kg as waste using the two-phase cascade: container fills first (soonest-to-expire), then un-contained storage batches.</p>

      <FormField id="sku" label="SKU" required>
        <SkuSelect id="sku" value={skuId} onChange={setSkuId} />
      </FormField>

      <FormField id="location" label="Location" required>
        <LocationSelect id="location" value={locationId} onChange={setLocationId} />
      </FormField>

      <FormField id="kg" label="kg spoiled" required>
        <TextInput id="kg" label="" type="number" value={kg} onChange={setKg} required step="0.001" min="0.001" />
      </FormField>

      <FormField id="reason" label="Reason" required>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </FormField>

      <FormField id="notes" label="Notes (optional)">
        <TextInput id="notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <button
        type="submit"
        disabled={submitting || !online || !skuId || !locationId || !kg}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Recording…' : 'Record spoilage'}
      </button>

      <FormFooter backHref={backHref} backLabel={backLabel} />
    </form>
  );
}
