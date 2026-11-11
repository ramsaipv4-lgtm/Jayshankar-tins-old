// DeliveryForm — vendor-rep receives a bill from a vendor. One bill, one vendor, one
// location, N fish lines (each becomes its own batch + delivery_in movement). Rewritten for
// the V1 sprint (decision #64): the old version created a batch directly, one SKU per
// submission, with no bills row at all — checked directly against SPEC.md §4.3.7 step 1
// ("Create the bills row... exactly as the existing delivery flow already does") and found
// that claim was never actually true. This is what makes it true: recordBillDelivery
// (mutations.ts) calls record_bill_delivery (migration 0019), which creates the bill and every
// line's batch/movement atomically, server-side.
//
// Still one location for the whole bill — a vendor's delivery physically arrives at one place
// in one trip, matching the old single-line form's own assumption; only the "one SKU per
// submission" restriction is lifted, not that one.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth';
import { useOnlineStatus } from '../lib/online';
import { recordBillDelivery } from '../lib/mutations';
import { FormField, FormError, FormFooter, FormSuccess, LocationSelect, SkuSelect, TextInput, VendorSelect } from '../components/FormFields';

interface Line {
  skuId: string;
  kg: string;
  pricePerKg: string;
}

function emptyLine(): Line {
  return { skuId: '', kg: '', pricePerKg: '' };
}

export default function DeliveryForm() {
  const { user } = useSession();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendorBillNumber, setVendorBillNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<'cash' | 'credit'>('cash');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const total = lines.reduce((sum, l) => {
    const kg = Number(l.kg);
    const price = Number(l.pricePerKg);
    return sum + (Number.isFinite(kg) && Number.isFinite(price) ? kg * price : 0);
  }, 0);

  const linesValid = lines.length > 0 && lines.every((l) => l.skuId && Number(l.kg) > 0 && Number(l.pricePerKg) > 0);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!online) {
      setError('You are offline. Reconnect to receive a bill.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, billId, totalAmount } = await recordBillDelivery({
      vendorId,
      locationId,
      billDate,
      vendorBillNumber: vendorBillNumber.trim() || undefined,
      lines: lines.map((l) => ({ skuId: l.skuId, kg: Number(l.kg), pricePerKgPaid: Number(l.pricePerKg) })),
      paymentTerms,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    setSuccess(`Bill ${billId?.slice(0, 8)} recorded — ${lines.length} line${lines.length === 1 ? '' : 's'}, ₹${totalAmount.toFixed(2)} total. Pack it into a container when ready.`);
    setVendorId(''); setLocationId(''); setVendorBillNumber(''); setLines([emptyLine()]); setPaymentTerms('cash');
    setBillDate(new Date().toISOString().slice(0, 10));
    qc.invalidateQueries({ queryKey: ['batches-count'] });
    qc.invalidateQueries({ queryKey: ['movements-count'] });
    qc.invalidateQueries({ queryKey: ['recent-activity'] });
    qc.invalidateQueries({ queryKey: ['bills', 'pack-candidates'] });
    qc.invalidateQueries({ queryKey: ['bills', 'management'] });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Receive a bill</h2>
      <p className="text-sm text-slate-500">One vendor, one bill — add every fish they delivered today as its own line. Each line becomes its own batch.</p>

      <FormField id="vendor" label="Vendor" required>
        <VendorSelect id="vendor" value={vendorId} onChange={setVendorId} />
      </FormField>

      <FormField id="location" label="Location" required>
        <LocationSelect id="location" value={locationId} onChange={setLocationId} includeTransit />
        <p className="text-xs text-slate-500 mt-1">
          Already at the warehouse? Pick its real location. Just picked up from the vendor and
          still on the way? Pick "in transit (inbound)" — confirm it at{' '}
          <Link to="/deliveries/confirm" className="text-indigo-600 hover:text-indigo-800">
            Confirm arrivals
          </Link>{' '}
          once it actually arrives, with what was really measured.
        </p>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="bill-date" label="Bill date" required>
          <TextInput id="bill-date" label="" type="date" value={billDate} onChange={setBillDate} required />
        </FormField>
        <FormField id="vendor-bill-number" label="Vendor's bill number (optional)">
          <TextInput id="vendor-bill-number" label="" value={vendorBillNumber} onChange={setVendorBillNumber} placeholder="if they gave one" />
        </FormField>
      </div>

      <FormField id="payment-terms" label="Paying now, or on credit?">
        <div className="flex gap-2" role="radiogroup" aria-label="Payment terms">
          {(['cash', 'credit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={paymentTerms === t}
              onClick={() => setPaymentTerms(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium border ${paymentTerms === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            >
              {t === 'cash' ? 'Cash / paid now' : 'On credit'}
            </button>
          ))}
        </div>
        {paymentTerms === 'credit' && (
          <p className="text-xs text-slate-500 mt-1">
            Settling this can be deferred from the Bills screen — set a reminder for later
            instead of reconciling it right away.
          </p>
        )}
      </FormField>

      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-700">Fish received</div>
        {lines.map((line, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Line {i + 1}</span>
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} className="text-xs font-medium text-red-600 hover:text-red-800">
                  Remove
                </button>
              )}
            </div>
            <FormField id={`sku-${i}`} label="Fish" required>
              <SkuSelect id={`sku-${i}`} value={line.skuId} onChange={(v) => updateLine(i, { skuId: v })} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id={`kg-${i}`} label="kg received" required>
                <TextInput id={`kg-${i}`} label="" type="number" value={line.kg} onChange={(v) => updateLine(i, { kg: v })} required step="0.001" min="0.001" />
              </FormField>
              <FormField id={`price-${i}`} label="Price paid (₹/kg)" required>
                <TextInput id={`price-${i}`} label="" type="number" value={line.pricePerKg} onChange={(v) => updateLine(i, { pricePerKg: v })} required step="0.01" min="0.01" />
              </FormField>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="w-full rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          + Add another fish
        </button>
      </div>

      {total > 0 && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-sm text-slate-700 flex items-center justify-between">
          <span>Bill total</span>
          <span className="font-semibold">₹{total.toFixed(2)}</span>
        </div>
      )}

      <FormError message={error} />
      <FormSuccess message={success} />

      <button
        type="submit"
        disabled={submitting || !online || !vendorId || !locationId || !billDate || !linesValid}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Recording…' : 'Record bill'}
      </button>

      <FormFooter backHref="/rep" backLabel="Back to rep dashboard" />
    </form>
  );
}
