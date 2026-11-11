// TransferForm — admin/co-admin records a cross-warehouse transfer. D29 repurposed transfer as
// an admin-tier, cross-warehouse-only action (no longer a routine worker/rep task — repack is
// the worker's everyday "move stock" action within one warehouse now). Source batch (FIFO
// oldest) loses kg; new batch is created at destination, with the source's real freshness
// timestamp carried through (§4.3.10/C.4), not reset.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth';
import { useOnlineStatus } from '../lib/online';
import { recordTransfer } from '../lib/mutations';
import { FormError, FormField, FormFooter, FormSuccess, LocationSelect, SkuSelect, TextInput } from '../components/FormFields';

export default function TransferForm() {
  const { user } = useSession();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [skuId, setSkuId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [kg, setKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Only admin/co-admin ever reach this route (App.tsx) — D29's own role scope, matching
  // record_transfer_cascade's internal check exactly.

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      setError('You are offline. Reconnect to record a transfer.');
      return;
    }
    if (fromLocationId === toLocationId) {
      setError('Source and destination must be different locations');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, shortfall } = await recordTransfer({
      skuId,
      fromLocationId,
      toLocationId,
      totalKg: Number(kg),
      notes: notes || undefined,
    }, user.id);
    setSubmitting(false);
    if (err) { setError(err); return; }
    const short = shortfall > 0 ? ` (shortfall: ${shortfall.toFixed(3)} kg)` : '';
    setSuccess(`Transfer recorded${short}.`);
    setKg(''); setNotes('');
    qc.invalidateQueries({ queryKey: ['active-batches'] });
    qc.invalidateQueries({ queryKey: ['recent-activity'] });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Record transfer</h2>
      <p className="text-sm text-slate-500">Between two different warehouses only — moves kg from source (FIFO oldest batch) to destination (new batch), keeping its real freshness clock. Moving stock within one warehouse is repack, not transfer.</p>

      <FormField id="sku" label="SKU" required>
        <SkuSelect id="sku" value={skuId} onChange={setSkuId} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="from" label="From location" required>
          <LocationSelect id="from" value={fromLocationId} onChange={setFromLocationId} />
        </FormField>
        <FormField id="to" label="To location" required>
          <LocationSelect id="to" value={toLocationId} onChange={setToLocationId} excludeId={fromLocationId} />
        </FormField>
      </div>

      <FormField id="kg" label="kg to transfer" required>
        <TextInput id="kg" label="" type="number" value={kg} onChange={setKg} required step="0.001" min="0.001" />
      </FormField>

      <FormField id="notes" label="Notes (optional)">
        <TextInput id="notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <button
        type="submit"
        disabled={submitting || !online || !skuId || !fromLocationId || !toLocationId || !kg}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Recording…' : 'Record transfer'}
      </button>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </form>
  );
}
