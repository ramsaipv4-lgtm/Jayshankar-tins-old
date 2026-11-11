// VendorCard — search result detail for a vendor: contact info, reliability rating (already
// existed — vendors.reliability, 1-5), what we owe them (vendor_credit_status, migration 0020),
// purchase history, most-purchased fish by kg, and a message composer (D20's "lite"
// implementation, decision #67). Lets admin/co-admin/vendor-rep/super-worker record a payment
// to the vendor (mirrors PaymentManagement.tsx's customer-side pattern).
//
// Message templates are fixed, English-only starter text for this pass — NOT yet owner-
// customizable (a real settings UI + template storage is its own later piece), and deliberately
// NOT translated into Tamil/Tanglish here: business-critical vendor wording is exactly the kind
// of thing that needs the actual client's approved phrasing, not a fabricated translation.
//
// Deliberately still NOT here: per-fish-type quality ratings. That needs new schema/decisions
// beyond what this pass covers — see BUILDER-DECISIONS-REVIEW.md decision #65's own scope note.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { FormError, FormField, FormFooter, FormSuccess, SkuSelect, TextInput } from '../components/FormFields';
import { ShareComposer } from '../components/ShareComposer';

interface Vendor {
  id: string; name: string; phone: string | null; port_or_village: string | null;
  boat_name: string | null; typical_catch: string | null; reliability: number;
}

interface CreditStatus {
  total_billed: number; total_paid: number; outstanding_balance: number; last_bill_date: string | null;
}

interface BillRow {
  id: string; bill_date: string; vendor_bill_number: string | null; total_amount: number;
}

interface BatchAggRow { sku_id: string; kg: number; skus: { english_name: string } | null }

const METHOD_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

export default function VendorCard() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { user } = useSession();
  const [payingOpen, setPayingOpen] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ['vendor-card', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, phone, port_or_village, boat_name, typical_catch, reliability')
        .eq('id', vendorId)
        .single();
      if (error) throw error;
      return data as Vendor;
    },
  });

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['vendor-card-credit', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_credit_status')
        .select('total_billed, total_paid, outstanding_balance, last_bill_date')
        .eq('vendor_id', vendorId)
        .single();
      if (error) throw error;
      return data as CreditStatus;
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['vendor-card-bills', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('id, bill_date, vendor_bill_number, total_amount')
        .eq('vendor_id', vendorId)
        .order('bill_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as BillRow[];
    },
  });

  const { data: topFish } = useQuery({
    queryKey: ['vendor-card-top-fish', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('sku_id, kg, skus(english_name)')
        .eq('vendor_id', vendorId)
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as BatchAggRow[];
      const bySku = new Map<string, { name: string; kg: number }>();
      for (const r of rows) {
        const name = r.skus?.english_name ?? 'Unknown';
        const cur = bySku.get(r.sku_id) ?? { name, kg: 0 };
        cur.kg += Number(r.kg);
        bySku.set(r.sku_id, cur);
      }
      return Array.from(bySku.values()).sort((a, b) => b.kg - a.kg).slice(0, 10);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{vendor?.name ?? 'Loading…'}</h2>
        {vendor && (
          <p className="text-sm text-slate-500 mt-1">
            {vendor.phone ? <a href={`tel:${vendor.phone}`} className="text-indigo-600 hover:underline">{vendor.phone}</a> : 'No phone on file'}
            {vendor.port_or_village && ` · ${vendor.port_or_village}`}
            {vendor.boat_name && ` · ${vendor.boat_name}`}
          </p>
        )}
        {vendor && (
          <p className="text-sm text-slate-500 mt-1">
            Reliability {'★'.repeat(vendor.reliability)}{'☆'.repeat(5 - vendor.reliability)}
            {vendor.typical_catch && ` · Typically brings ${vendor.typical_catch}`}
          </p>
        )}
      </div>

      {vendor && <VendorMessagePanel vendorName={vendor.name} />}

      {status && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">We owe this vendor</span>
            <span className="text-lg font-semibold text-slate-800">₹{status.outstanding_balance.toFixed(2)}</span>
          </div>
          <div className="text-xs text-slate-500">
            ₹{status.total_billed.toFixed(2)} billed · ₹{status.total_paid.toFixed(2)} paid
            {status.last_bill_date && ` · last bill ${new Date(status.last_bill_date).toLocaleDateString()}`}
          </div>
          {status.outstanding_balance > 0 && (
            payingOpen ? (
              <RecordVendorPaymentForm
                vendorId={vendor!.id}
                maxAmount={status.outstanding_balance}
                userId={user!.id}
                onDone={() => { setPayingOpen(false); refetchStatus(); }}
                onCancel={() => setPayingOpen(false)}
              />
            ) : (
              <button type="button" onClick={() => setPayingOpen(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Record a payment →
              </button>
            )
          )}
        </div>
      )}

      {topFish && topFish.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Most purchased from them</h3>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {topFish.map((f) => (
              <div key={f.name} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-800">{f.name}</span>
                <span className="text-slate-500 tabular-nums">{f.kg.toFixed(1)} kg total</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Bills</h3>
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {bills?.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-slate-800">
                {new Date(b.bill_date).toLocaleDateString()}
                {b.vendor_bill_number && <span className="text-slate-500"> · #{b.vendor_bill_number}</span>}
              </span>
              <span className="text-slate-500 tabular-nums">₹{Number(b.total_amount).toFixed(2)}</span>
            </div>
          ))}
          {bills?.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">No bills yet.</div>}
        </div>
      </section>

      <FormFooter backHref="/search" backLabel="Back to search" />
    </div>
  );
}

function RecordVendorPaymentForm({ vendorId, maxAmount, userId, onDone, onCancel }: {
  vendorId: string; maxAmount: number; userId: string; onDone: () => void; onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(maxAmount));
  const [method, setMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: insertErr } = await supabase.from('vendor_payments').insert({
      vendor_id: vendorId,
      amount: Number(amount),
      method: method || null,
      recorded_by: userId,
    });
    setSubmitting(false);
    if (insertErr) { setError(`Could not save: ${insertErr.message}`); return; }
    setSuccess('Payment recorded.');
    setTimeout(onDone, 600);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-100 pt-3 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <FormField id="vendor-pay-amount" label="Amount (₹)" required>
          <TextInput id="vendor-pay-amount" label="" type="number" value={amount} onChange={setAmount} required min="0.01" step="0.01" max={String(maxAmount)} />
        </FormField>
        <FormField id="vendor-pay-method" label="Method">
          <select
            id="vendor-pay-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FormField>
      </div>
      <FormError message={error} />
      <FormSuccess message={success} />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting || !amount || Number(amount) <= 0} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
          {submitting ? 'Saving…' : 'Record payment'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

type TemplateKind = 'ask_fish' | 'todays_catch';

// One row of SkuSelect's own shape — not imported from search.ts/mutations.ts, this component
// only needs the display name, resolved via a small local lookup query below.
function VendorMessagePanel({ vendorName }: { vendorName: string }) {
  const [template, setTemplate] = useState<TemplateKind>('todays_catch');
  const [skuId, setSkuId] = useState('');
  const [kg, setKg] = useState('');

  const { data: skuName } = useQuery({
    queryKey: ['vendor-message-sku-name', skuId],
    enabled: !!skuId,
    queryFn: async () => {
      const { data, error } = await supabase.from('skus').select('english_name').eq('id', skuId).single();
      if (error) throw error;
      return data.english_name as string;
    },
  });

  const text = template === 'todays_catch'
    ? `Hi ${vendorName}, what's today's catch looking like?`
    : `Hi ${vendorName}, checking — how many kg of ${skuName ?? '[fish]'} do you have${kg ? ` (looking for around ${kg} kg)` : ''} today?`;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">Message this vendor</h3>
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTemplate('todays_catch')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${template === 'todays_catch' ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            What's today's catch?
          </button>
          <button
            type="button"
            onClick={() => setTemplate('ask_fish')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${template === 'ask_fish' ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Ask about a fish
          </button>
        </div>

        {template === 'ask_fish' && (
          <div className="grid grid-cols-2 gap-3">
            <FormField id="vendor-msg-sku" label="Fish">
              <SkuSelect id="vendor-msg-sku" value={skuId} onChange={setSkuId} required={false} />
            </FormField>
            <FormField id="vendor-msg-kg" label="Roughly how many kg (optional)">
              <TextInput id="vendor-msg-kg" label="" type="number" value={kg} onChange={setKg} step="0.1" min="0" />
            </FormField>
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {text}
        </div>

        <ShareComposer text={text} />
      </div>
    </section>
  );
}
