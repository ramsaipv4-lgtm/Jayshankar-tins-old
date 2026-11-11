// CustomerManagement — admin/co-admin/vendor-rep: list, add, edit customers. Built as part of
// the V1 sprint closing a real gap: the entire CRM layer (customers, payments, reversal
// requests, credit terms — D22, D27, D33) had a complete, tested backend and ZERO frontend.
// Nothing anywhere let a person actually record a customer, so nothing downstream (linking a
// sale, recording a payment, seeing a credit balance) could ever be exercised for real.
//
// Deliberately simple, matching the same "even a 5th grader could use it" bar the client set for
// SkuManagement: only name + phone visible up front; business details, address, follow-up
// status, fish preference, and credit terms are tucked behind "More settings." GST fields
// (is_gst_registered/gstin) stay dormant per D24 — no UI for them at all yet, matching that
// decision's own framing.
//
// warehouse_id is required by the schema but never shown to the user — this is the first screen
// that needs to resolve "which warehouse," and per D29 there is genuinely only one in practice,
// so it's fetched silently and applied, not picked.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface Customer {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  follow_up_status: string | null;
  fish_preference: string | null;
  credit_limit: number | null;
  credit_period_days: number | null;
  active: boolean;
}

const FOLLOW_UP_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'cold_call', label: 'Cold call' },
  { value: 'new_requirement', label: 'New requirement' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const selectCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function CustomerManagement() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', 'management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, business_name, phone, address, follow_up_status, fish_preference, credit_limit, credit_period_days, active')
        .order('active', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  if (editing) {
    return (
      <CustomerForm
        customer={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['customers'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Customers</h2>
          <p className="text-sm text-slate-500 mt-1">Add a new customer, or tap one to edit it.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
        >
          + Add new customer
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {customers?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setEditing(c)}
            className={`w-full text-left rounded-lg border p-4 hover:bg-slate-50 ${c.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {c.name}
                  {c.business_name && <span className="text-slate-500 font-normal"> · {c.business_name}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {c.phone ?? 'No phone on file'}
                  {c.credit_limit != null && ` · Credit limit ₹${c.credit_limit}`}
                  {!c.active && ' · Inactive'}
                </div>
              </div>
              <span className="text-indigo-600 text-sm font-medium shrink-0">Edit →</span>
            </div>
          </button>
        ))}
        {customers?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">
            No customers yet. Tap "+ Add new customer" to add the first one.
          </div>
        )}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function CustomerForm({ customer, onDone, onCancel }: { customer: Customer | null; onDone: () => void; onCancel: () => void }) {
  const isNew = customer === null;
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [businessName, setBusinessName] = useState(customer?.business_name ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [followUpStatus, setFollowUpStatus] = useState(customer?.follow_up_status ?? '');
  const [fishPreference, setFishPreference] = useState(customer?.fish_preference ?? '');
  const [creditLimit, setCreditLimit] = useState(customer?.credit_limit != null ? String(customer.credit_limit) : '');
  const [creditPeriodDays, setCreditPeriodDays] = useState(customer?.credit_period_days != null ? String(customer.credit_period_days) : '');
  const [active, setActive] = useState(customer?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      business_name: businessName.trim() || null,
      is_business: !!businessName.trim(),
      address: address.trim() || null,
      follow_up_status: followUpStatus || null,
      fish_preference: fishPreference.trim() || null,
      credit_limit: creditLimit.trim() ? Number(creditLimit) : null,
      credit_period_days: creditPeriodDays.trim() ? Number(creditPeriodDays) : null,
      active,
    };

    if (isNew) {
      // warehouse_id is required by the schema but never shown to the user (D29 — genuinely
      // one warehouse in practice). Resolved here, silently, at save time.
      const { data: warehouse, error: whErr } = await supabase.from('warehouses').select('id').eq('active', true).limit(1).single();
      if (whErr || !warehouse) {
        setSubmitting(false);
        setError('Could not find the warehouse to assign this customer to. Check Warehouses in the admin dashboard.');
        return;
      }
      const { error: insertErr } = await supabase.from('customers').insert({ ...payload, warehouse_id: warehouse.id });
      setSubmitting(false);
      if (insertErr) { setError(`Could not save: ${insertErr.message}`); return; }
      setSuccess(`${name} added.`);
      setTimeout(onDone, 600);
    } else {
      const { error: updateErr } = await supabase.from('customers').update(payload).eq('id', customer.id);
      setSubmitting(false);
      if (updateErr) { setError(`Could not save: ${updateErr.message}`); return; }
      setSuccess(`${name} updated.`);
      setTimeout(onDone, 600);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">
        {isNew ? 'Add new customer' : `Edit ${customer.name}`}
      </h2>

      <FormField id="cust-name" label="Name" required>
        <TextInput id="cust-name" label="" value={name} onChange={setName} required placeholder="e.g. Saravana Stores" />
      </FormField>

      <FormField id="cust-phone" label="Phone (optional)">
        <TextInput id="cust-phone" label="" type="tel" value={phone} onChange={setPhone} placeholder="e.g. 9876543210" />
      </FormField>

      {!isNew && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
          Active (uncheck to hide this customer from new sales without deleting their history)
        </label>
      )}

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="text-sm font-medium text-slate-700 cursor-pointer">More settings (optional)</summary>
        <div className="mt-3 space-y-3">
          <FormField id="cust-business" label="Business name">
            <TextInput id="cust-business" label="" value={businessName} onChange={setBusinessName} placeholder="if buying for a shop/business" />
          </FormField>
          <FormField id="cust-address" label="Address">
            <TextInput id="cust-address" label="" value={address} onChange={setAddress} />
          </FormField>
          <FormField id="cust-followup" label="Status">
            <select id="cust-followup" value={followUpStatus} onChange={(e) => setFollowUpStatus(e.target.value)} className={selectCls}>
              {FOLLOW_UP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField id="cust-fish-pref" label="Usually buys">
            <TextInput id="cust-fish-pref" label="" value={fishPreference} onChange={setFishPreference} placeholder="e.g. Pomfret, prawns" />
          </FormField>
          <FormField id="cust-credit-limit" label="Credit limit (₹, leave blank for no formal limit)">
            <TextInput id="cust-credit-limit" label="" type="number" value={creditLimit} onChange={setCreditLimit} min="0" step="0.01" />
          </FormField>
          <FormField id="cust-credit-period" label="Credit period (days, leave blank if not applicable)">
            <TextInput id="cust-credit-period" label="" type="number" value={creditPeriodDays} onChange={setCreditPeriodDays} min="1" step="1" />
          </FormField>
        </div>
      </details>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : isNew ? 'Add customer' : 'Save changes'}
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
