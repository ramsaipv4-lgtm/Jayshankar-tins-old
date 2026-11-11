// SaleForm — vendor-rep records a sale. Calls record_container_sale
// (migration 0009), which runs a two-phase cascade server-side: container
// fills first (soonest-to-expire), then un-contained batches.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth';
import { useOnlineStatus } from '../lib/online';
import { recordSale } from '../lib/mutations';
import { CustomerSelect, FormError, FormField, FormFooter, FormSuccess, LocationSelect, SkuSelect, TextInput } from '../components/FormFields';

export default function SaleForm() {
  const { user } = useSession();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [skuId, setSkuId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      setError('You are offline. Reconnect to record a sale.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, shortfall, saleId, containerSourcedKg, directSourcedKg } = await recordSale({
      skuId,
      locationId,
      // customerId set: the database derives the name from the customers row, this is just a
      // fallback the RPC ignores in that case. customerId empty: a one-off buyer, this is the
      // only name that gets recorded.
      customerName: customerName.trim(),
      customerId: customerId || undefined,
      totalKg: Number(kg),
      salePricePerKg: Number(pricePerKg),
      notes: notes || undefined,
    }, user.id);
    setSubmitting(false);
    if (err) { setError(err); return; }
    const short = shortfall > 0 ? ` (shortfall: ${shortfall.toFixed(3)} kg)` : '';
    // Show the container/direct split only when both contributed — when direct
    // is zero, every kg came from containers, and the split is implied by the
    // "Sale ... recorded" message alone. Showing it every time would be noise.
    const split = directSourcedKg > 0
      ? ` (${containerSourcedKg.toFixed(3)} kg from containers, ${directSourcedKg.toFixed(3)} kg from storage)`
      : '';
    setSuccess(`Sale ${saleId?.slice(0, 8)} recorded${short}${split}.`);
    setCustomerId(''); setCustomerName(''); setKg(''); setPricePerKg(''); setNotes('');
    qc.invalidateQueries({ queryKey: ['sales-count'] });
    qc.invalidateQueries({ queryKey: ['movements-count'] });
    qc.invalidateQueries({ queryKey: ['recent-activity'] });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Record sale</h2>
      <p className="text-sm text-slate-500">Deducts kg using the two-phase cascade: container fills first (soonest-to-expire), then un-contained storage batches.</p>

      <FormField id="sku" label="SKU" required>
        <SkuSelect id="sku" value={skuId} onChange={setSkuId} />
      </FormField>

      <FormField id="location" label="Location" required>
        <LocationSelect id="location" value={locationId} onChange={setLocationId} />
      </FormField>

      <FormField id="customer" label="Customer">
        <CustomerSelect id="customer" value={customerId} onChange={setCustomerId} />
      </FormField>

      {!customerId && (
        <FormField id="customer-name" label="Buyer's name" required>
          <TextInput id="customer-name" label="" value={customerName} onChange={setCustomerName} required placeholder="e.g. Saravana Stores" />
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField id="kg" label="kg sold" required>
          <TextInput id="kg" label="" type="number" value={kg} onChange={setKg} required step="0.001" min="0.001" />
        </FormField>
        <FormField id="price" label="Sale price (₹/kg)" required>
          <TextInput id="price" label="" type="number" value={pricePerKg} onChange={setPricePerKg} required step="0.01" min="0.01" />
        </FormField>
      </div>

      <FormField id="notes" label="Notes (optional)">
        <TextInput id="notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <button
        type="submit"
        disabled={submitting || !online || !skuId || !locationId || (!customerId && !customerName) || !kg || !pricePerKg}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Recording…' : 'Record sale'}
      </button>

      <FormFooter backHref="/rep" backLabel="Back to rep dashboard" />
    </form>
  );
}
