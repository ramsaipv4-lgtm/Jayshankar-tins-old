// PaymentManagement — admin/co-admin/vendor-rep/super-worker: record a payment against a
// customer's sale, see their outstanding balance. Part of the V1 sprint closing the CRM
// frontend gap — payments (migration 0012) and customer_credit_status (migration 0013,
// D33) have existed, tested, since Mode B; nothing anywhere let a person actually record one.
//
// Per-sale balances aren't a queryable view (customer_credit_status only aggregates per
// customer, by design — see its own CTE) — computed here client-side from sales + payments for
// the selected customer. Matches D17's "derived, not stored" spirit; this is a read-time
// computation for display, not a new source of truth.
//
// No RPC needed to record a payment itself — payments is a plain, RLS-gated, append-only
// insert (no cascade/algorithm involved), unlike sales/movements.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { CustomerSelect, FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface CreditStatus {
  customer_id: string;
  name: string;
  credit_limit: number | null;
  credit_period_days: number | null;
  outstanding_balance: number;
  is_over_limit: boolean;
  oldest_unpaid_sale_at: string | null;
  days_overdue: number | null;
}

interface SaleRow {
  id: string;
  sold_at: string;
  total_amount: number;
  skus: { english_name: string } | null;
}

interface SaleRowWithBalance extends SaleRow {
  balance: number;
}

const METHOD_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

const selectCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function PaymentManagement() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [payingFor, setPayingFor] = useState<SaleRowWithBalance | null>(null);

  const { data: status } = useQuery({
    queryKey: ['customer-credit-status', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_credit_status')
        .select('customer_id, name, credit_limit, credit_period_days, outstanding_balance, is_over_limit, oldest_unpaid_sale_at, days_overdue')
        .eq('customer_id', customerId)
        .single();
      if (error) throw error;
      return data as CreditStatus;
    },
  });

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['customer-sales-with-balance', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data: saleRows, error: salesErr } = await supabase
        .from('sales')
        .select('id, sold_at, total_amount, skus(english_name)')
        .eq('customer_id', customerId)
        .order('sold_at', { ascending: false })
        .limit(50);
      if (salesErr) throw salesErr;
      const rows = (saleRows ?? []) as unknown as SaleRow[];
      if (rows.length === 0) return [];

      const { data: paymentRows, error: paymentsErr } = await supabase
        .from('payments')
        .select('sale_id, amount')
        .in('sale_id', rows.map((r) => r.id));
      if (paymentsErr) throw paymentsErr;

      const paidBySale = new Map<string, number>();
      for (const p of paymentRows ?? []) {
        paidBySale.set(p.sale_id, (paidBySale.get(p.sale_id) ?? 0) + Number(p.amount));
      }
      return rows.map((r) => ({
        ...r,
        balance: Math.max(0, Number(r.total_amount) - (paidBySale.get(r.id) ?? 0)),
      }));
    },
  });

  if (payingFor && user) {
    return (
      <RecordPaymentForm
        sale={payingFor}
        userId={user.id}
        onDone={() => {
          setPayingFor(null);
          qc.invalidateQueries({ queryKey: ['customer-credit-status', customerId] });
          qc.invalidateQueries({ queryKey: ['customer-sales-with-balance', customerId] });
        }}
        onCancel={() => setPayingFor(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Payments</h2>
        <p className="text-sm text-slate-500 mt-1">Pick a customer to see what they owe and record a payment.</p>
      </div>

      <FormField id="pay-customer" label="Customer" required>
        <CustomerSelect id="pay-customer" value={customerId} onChange={setCustomerId} />
      </FormField>

      {status && (
        <div className={`rounded-lg border p-4 ${status.is_over_limit ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="text-slate-800 font-medium">{status.name}</div>
            <div className="text-lg font-semibold text-slate-800">₹{status.outstanding_balance.toFixed(2)} outstanding</div>
          </div>
          {status.credit_limit != null && (
            <div className="text-xs text-slate-500 mt-1">
              Credit limit ₹{status.credit_limit}
              {status.is_over_limit && <span className="text-red-600 font-medium"> — over limit</span>}
            </div>
          )}
          {status.days_overdue != null && status.days_overdue > 0 && (
            <div className="text-xs text-amber-700 mt-1">{status.days_overdue} day{status.days_overdue === 1 ? '' : 's'} overdue on the oldest unpaid sale</div>
          )}
        </div>
      )}

      {customerId && (
        <div className="space-y-2">
          {salesLoading && <div className="text-sm text-slate-500">Loading sales…</div>}
          {sales?.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800">{s.skus?.english_name ?? 'Sale'}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(s.sold_at).toLocaleDateString()} · Total ₹{Number(s.total_amount).toFixed(2)}
                  {s.balance > 0 ? ` · ₹${s.balance.toFixed(2)} owed` : ' · Paid in full'}
                </div>
              </div>
              {s.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setPayingFor(s)}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 shrink-0"
                >
                  Record payment
                </button>
              )}
            </div>
          ))}
          {sales?.length === 0 && !salesLoading && (
            <div className="text-sm text-slate-500 text-center py-8">No sales recorded for this customer yet.</div>
          )}
        </div>
      )}

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function RecordPaymentForm({ sale, userId, onDone, onCancel }: { sale: SaleRowWithBalance; userId: string; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState(String(sale.balance));
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: insertErr } = await supabase.from('payments').insert({
      sale_id: sale.id,
      amount: Number(amount),
      method: method || null,
      recorded_by: userId,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (insertErr) { setError(`Could not save: ${insertErr.message}`); return; }
    setSuccess('Payment recorded.');
    setTimeout(onDone, 600);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Record payment</h2>
      <p className="text-sm text-slate-500">
        {sale.skus?.english_name ?? 'Sale'} on {new Date(sale.sold_at).toLocaleDateString()} — ₹{sale.balance.toFixed(2)} owed.
      </p>

      <FormField id="pay-amount" label="Amount (₹)" required>
        <TextInput id="pay-amount" label="" type="number" value={amount} onChange={setAmount} required min="0.01" step="0.01" max={String(sale.balance)} />
      </FormField>

      <FormField id="pay-method" label="Method">
        <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}>
          {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      <FormField id="pay-notes" label="Notes">
        <TextInput id="pay-notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !amount || Number(amount) <= 0}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Record payment'}
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
