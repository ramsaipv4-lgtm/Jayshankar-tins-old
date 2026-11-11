// Complaints — file a customer complaint against a sale, and (admin/co-admin) resolve one.
// Mirrors ReversalRequests.tsx's own structure closely (recent sales -> file action; a list of
// complaints with a resolve action) since the shape of the problem is the same. Filing is a
// plain RPC call (file_customer_complaint); resolving is the one RPC that actually does the
// kg-split disposition + refund (resolve_customer_complaint, migration 0027) — see that
// migration's own comment for why every returned kg is handled by reusing the reversal/spoilage
// mechanisms rather than inventing new ones.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface SaleRow {
  id: string;
  sold_at: string;
  customer_name: string;
  total_kg: number;
  total_amount: number;
  skus: { english_name: string } | null;
}

interface ComplaintRow {
  id: string;
  sale_id: string;
  customer_id: string | null;
  kg_returned: number;
  claim_description: string | null;
  status: 'pending' | 'resolved';
  kg_confirmed_bad: number | null;
  kg_confirmed_good_restocked: number | null;
  kg_rejected_no_action: number | null;
  rejected_disposition: string | null;
  refund_amount: number | null;
  created_at: string;
  sales: { customer_name: string; total_kg: number; sale_price_per_kg: number; skus: { english_name: string } | null } | null;
  reporter: { display_name: string } | null;
}

const STATUS_STYLES: Record<ComplaintRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function Complaints() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [filing, setFiling] = useState<SaleRow | null>(null);
  const [resolving, setResolving] = useState<ComplaintRow | null>(null);
  const isAdmin = user?.role === 'admin' || user?.role === 'co-admin';

  const { data: recentSales } = useQuery({
    queryKey: ['sales', 'complaint-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sold_at, customer_name, total_kg, total_amount, skus(english_name)')
        .order('sold_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['complaints', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_complaints')
        .select('id, sale_id, customer_id, kg_returned, claim_description, status, kg_confirmed_bad, kg_confirmed_good_restocked, kg_rejected_no_action, rejected_disposition, refund_amount, created_at, sales(customer_name, total_kg, sale_price_per_kg, skus(english_name)), reporter:users!reported_by(display_name)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ComplaintRow[];
    },
  });

  if (filing) {
    return (
      <FileComplaintForm
        sale={filing}
        onDone={() => { setFiling(null); qc.invalidateQueries({ queryKey: ['complaints'] }); }}
        onCancel={() => setFiling(null)}
      />
    );
  }

  if (resolving) {
    return (
      <ResolveComplaintForm
        complaint={resolving}
        onDone={() => { setResolving(null); qc.invalidateQueries({ queryKey: ['complaints'] }); }}
        onCancel={() => setResolving(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Complaints &amp; returns</h2>
        <p className="text-sm text-slate-500 mt-1">File a complaint against a sale, or review one that's been filed.</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Recent sales</h3>
        {recentSales?.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-slate-800">{s.skus?.english_name ?? 'Sale'}</span>
              <span className="text-slate-500"> · {s.customer_name} · {Number(s.total_kg).toFixed(2)}kg · ₹{Number(s.total_amount).toFixed(2)} · {new Date(s.sold_at).toLocaleDateString()}</span>
            </div>
            <button type="button" onClick={() => setFiling(s)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0">
              File a complaint
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Complaints</h3>
        {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
        {complaints?.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-800">
                  {c.sales?.skus?.english_name ?? 'Sale'} · {c.sales?.customer_name} · {Number(c.kg_returned).toFixed(2)}kg returned
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Reported by {c.reporter?.display_name ?? '—'} on {new Date(c.created_at).toLocaleDateString()}
                  {c.claim_description && ` — "${c.claim_description}"`}
                </div>
                {c.status === 'resolved' && (
                  <div className="text-xs text-slate-600 mt-1">
                    {Number(c.kg_confirmed_bad) > 0 && `${Number(c.kg_confirmed_bad).toFixed(2)}kg confirmed bad`}
                    {Number(c.kg_confirmed_good_restocked) > 0 && `${Number(c.kg_confirmed_bad) > 0 ? ' · ' : ''}${Number(c.kg_confirmed_good_restocked).toFixed(2)}kg restocked`}
                    {Number(c.kg_rejected_no_action) > 0 && ` · ${Number(c.kg_rejected_no_action).toFixed(2)}kg rejected (${c.rejected_disposition})`}
                    {c.refund_amount != null && Number(c.refund_amount) > 0 && ` · ₹${Number(c.refund_amount).toFixed(2)} refunded`}
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${STATUS_STYLES[c.status]}`}>
                {c.status === 'pending' ? 'Pending review' : 'Resolved'}
              </span>
            </div>
            {isAdmin && c.status === 'pending' && (
              <button type="button" onClick={() => setResolving(c)} className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Review &amp; resolve
              </button>
            )}
          </div>
        ))}
        {complaints?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">No complaints filed yet.</div>
        )}
      </section>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function FileComplaintForm({ sale, onDone, onCancel }: { sale: SaleRow; onDone: () => void; onCancel: () => void }) {
  const [kgReturned, setKgReturned] = useState(String(sale.total_kg));
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcErr } = await supabase.rpc('file_customer_complaint', {
      p_sale_id: sale.id,
      p_kg_returned: Number(kgReturned),
      p_claim_description: description.trim() || null,
    });
    setSubmitting(false);
    const err = rpcErr?.message ?? data?.error ?? null;
    if (err) { setError(err); return; }
    setSuccess('Complaint filed.');
    setTimeout(onDone, 600);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">File a complaint</h2>
      <p className="text-sm text-slate-500">
        {sale.skus?.english_name ?? 'Sale'} · {sale.customer_name} · {Number(sale.total_kg).toFixed(2)}kg on {new Date(sale.sold_at).toLocaleDateString()}
      </p>

      <FormField id="complaint-kg" label="kg returned" required>
        <TextInput id="complaint-kg" label="" type="number" value={kgReturned} onChange={setKgReturned} required step="0.001" min="0.001" max={String(sale.total_kg)} />
      </FormField>
      <FormField id="complaint-description" label="What did the customer say?">
        <TextInput id="complaint-description" label="" value={description} onChange={setDescription} placeholder="e.g. Said it smelled off" />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
          {submitting ? 'Saving…' : 'File complaint'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResolveComplaintForm({ complaint, onDone, onCancel }: { complaint: ComplaintRow; onDone: () => void; onCancel: () => void }) {
  const [kgBad, setKgBad] = useState('0');
  const [kgGood, setKgGood] = useState('0');
  const [kgRejected, setKgRejected] = useState('0');
  const [rejectedDisposition, setRejectedDisposition] = useState<'returned_to_customer' | 'disposed' | ''>('');
  const [operationCharge, setOperationCharge] = useState('0');
  const [unrefrigeratedMultiplier, setUnrefrigeratedMultiplier] = useState('3');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sum = (Number(kgBad) || 0) + (Number(kgGood) || 0) + (Number(kgRejected) || 0);
  const sumMatches = Math.abs(sum - Number(complaint.kg_returned)) < 0.001;
  const needsDisposition = (Number(kgRejected) || 0) > 0;
  const pricePerKg = complaint.sales?.sale_price_per_kg ?? 0;
  const estimatedRefund = Math.max(0, (Number(kgBad) || 0) * pricePerKg) + Math.max(0, (Number(kgGood) || 0) * pricePerKg - (Number(operationCharge) || 0));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcErr } = await supabase.rpc('resolve_customer_complaint', {
      p_complaint_id: complaint.id,
      p_kg_confirmed_bad: Number(kgBad) || 0,
      p_kg_confirmed_good_restocked: Number(kgGood) || 0,
      p_kg_rejected_no_action: Number(kgRejected) || 0,
      p_rejected_disposition: rejectedDisposition || null,
      p_operation_charge: Number(operationCharge) || 0,
      p_resolution_notes: notes.trim() || null,
      p_unrefrigerated_multiplier: Number(unrefrigeratedMultiplier) || 3,
    });
    setSubmitting(false);
    const err = rpcErr?.message ?? data?.error ?? null;
    if (err) { setError(err); return; }
    setSuccess(`Resolved — ₹${Number(data?.refund_amount ?? 0).toFixed(2)} refunded.`);
    setTimeout(onDone, 900);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Resolve complaint</h2>
      <p className="text-sm text-slate-500">
        {complaint.sales?.skus?.english_name ?? 'Sale'} · {complaint.sales?.customer_name} · {Number(complaint.kg_returned).toFixed(2)}kg returned
        {complaint.claim_description && ` — "${complaint.claim_description}"`}
      </p>
      <p className="text-xs text-slate-500">Split the returned kg across what's actually true — the three amounts below must add up to {Number(complaint.kg_returned).toFixed(3)}kg.</p>

      <div className="grid grid-cols-3 gap-3">
        <FormField id="kg-bad" label="Confirmed bad (kg)">
          <TextInput id="kg-bad" label="" type="number" value={kgBad} onChange={setKgBad} step="0.001" min="0" />
        </FormField>
        <FormField id="kg-good" label="Fine, restocked (kg)">
          <TextInput id="kg-good" label="" type="number" value={kgGood} onChange={setKgGood} step="0.001" min="0" />
        </FormField>
        <FormField id="kg-rejected" label="Rejected (kg)">
          <TextInput id="kg-rejected" label="" type="number" value={kgRejected} onChange={setKgRejected} step="0.001" min="0" />
        </FormField>
      </div>
      {!sumMatches && (
        <p className="text-xs text-red-600">These need to add up to {Number(complaint.kg_returned).toFixed(3)}kg — currently {sum.toFixed(3)}kg.</p>
      )}

      {needsDisposition && (
        <FormField id="rejected-disposition" label="What happens to the rejected kg?" required>
          <select
            id="rejected-disposition"
            value={rejectedDisposition}
            onChange={(e) => setRejectedDisposition(e.target.value as typeof rejectedDisposition)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="">Choose one</option>
            <option value="returned_to_customer">Handed back to the customer</option>
            <option value="disposed">Disposed</option>
          </select>
        </FormField>
      )}

      {(Number(kgGood) || 0) > 0 && (
        <FormField id="unrefrigerated-multiplier" label="Unrefrigerated penalty — how much faster it aged while it was with the customer, worst case (not a scientific figure, adjust if you know better for this case)">
          <TextInput id="unrefrigerated-multiplier" label="" type="number" value={unrefrigeratedMultiplier} onChange={setUnrefrigeratedMultiplier} step="0.1" min="1" />
        </FormField>
      )}

      <FormField id="operation-charge" label="Operation charge (₹, optional — deducted from the refund on the restocked portion only)">
        <TextInput id="operation-charge" label="" type="number" value={operationCharge} onChange={setOperationCharge} step="0.01" min="0" />
      </FormField>
      <FormField id="resolution-notes" label="Notes (optional)">
        <TextInput id="resolution-notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      {pricePerKg > 0 && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-2 text-sm text-slate-700 flex items-center justify-between">
          <span>Estimated refund</span>
          <span className="font-semibold">₹{estimatedRefund.toFixed(2)}</span>
        </div>
      )}

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !sumMatches || (needsDisposition && !rejectedDisposition)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Resolving…' : 'Resolve complaint'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
