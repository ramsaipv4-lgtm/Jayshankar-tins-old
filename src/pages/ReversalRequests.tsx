// ReversalRequests — request a sale reversal, and (admin/co-admin, or a self-reversing rep)
// approve/deny/execute one. Part of the V1 sprint: D22/§4.3.11 was fully spec'd, the request +
// approval schema existed since migration 0012, and the execution algorithm was built this
// sprint (migration 0016) — but there was no UI for any of it. Request and approve/deny are
// plain RLS-gated writes; execute calls the execute_sale_reversal RPC (the one part that needs
// SECURITY DEFINER — see that migration's own comment for why).

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface SaleRow {
  id: string;
  sold_at: string;
  customer_name: string;
  total_amount: number;
  skus: { english_name: string } | null;
}

interface ReversalRow {
  id: string;
  sale_id: string;
  requested_by: string;
  requested_at: string;
  status: 'requested' | 'approved' | 'denied' | 'executed';
  reason: string | null;
  decided_by: string | null;
  sales: { customer_name: string; total_amount: number; skus: { english_name: string } | null } | null;
  requester: { display_name: string } | null;
}

const STATUS_STYLES: Record<ReversalRow['status'], string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  denied: 'bg-red-100 text-red-700 border-red-200',
  executed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function ReversalRequests() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [requesting, setRequesting] = useState<SaleRow | null>(null);
  const isAdmin = user?.role === 'admin' || user?.role === 'co-admin';

  const { data: recentSales } = useQuery({
    queryKey: ['sales', 'reversal-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, sold_at, customer_name, total_amount, skus(english_name)')
        .order('sold_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['reversal-requests', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reversal_requests')
        .select('id, sale_id, requested_by, requested_at, status, reason, decided_by, sales(customer_name, total_amount, skus(english_name)), requester:users!requested_by(display_name)')
        .order('requested_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ReversalRow[];
    },
  });

  async function decide(id: string, status: 'approved' | 'denied') {
    await supabase.from('reversal_requests').update({ status, decided_by: user?.id, decided_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['reversal-requests'] });
  }

  async function execute(id: string) {
    const { data, error } = await supabase.rpc('execute_sale_reversal', { p_reversal_request_id: id });
    if (!error && !data?.error) {
      qc.invalidateQueries({ queryKey: ['reversal-requests'] });
      qc.invalidateQueries({ queryKey: ['recent-activity'] });
    }
    return { error: error?.message ?? data?.error ?? null };
  }

  if (requesting) {
    return (
      <RequestForm
        sale={requesting}
        onDone={() => { setRequesting(null); qc.invalidateQueries({ queryKey: ['reversal-requests'] }); }}
        onCancel={() => setRequesting(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Reversals</h2>
        <p className="text-sm text-slate-500 mt-1">Request a sale to be reversed, or review pending requests.</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Recent sales</h3>
        {recentSales?.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-slate-800">{s.skus?.english_name ?? 'Sale'}</span>
              <span className="text-slate-500"> · {s.customer_name} · ₹{Number(s.total_amount).toFixed(2)} · {new Date(s.sold_at).toLocaleDateString()}</span>
            </div>
            <button
              type="button"
              onClick={() => setRequesting(s)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0"
            >
              Request reversal
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Requests</h3>
        {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
        {requests?.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-800">
                  {r.sales?.skus?.english_name ?? 'Sale'} · {r.sales?.customer_name} · ₹{r.sales?.total_amount ? Number(r.sales.total_amount).toFixed(2) : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Requested by {r.requester?.display_name ?? '—'} on {new Date(r.requested_at).toLocaleDateString()}
                  {r.reason && ` — "${r.reason}"`}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${STATUS_STYLES[r.status]}`}>
                {r.status}
              </span>
            </div>
            {isAdmin && r.status === 'requested' && (
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => decide(r.id, 'approved')} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Approve
                </button>
                <button type="button" onClick={() => decide(r.id, 'denied')} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Deny
                </button>
              </div>
            )}
            {isAdmin && r.status === 'approved' && (
              <ExecuteButton onExecute={() => execute(r.id)} />
            )}
            {/* No self-execute button for a non-admin any more: can_self_reverse is now
                admin/co-admin only (migration 0033), so a rep/super-worker's own request can
                still auto-approve-at-creation only if THEY are admin-tier -- which contradicts
                !isAdmin here -- meaning this branch could only ever show a button that 403s.
                Found via a direct frontend/backend parity audit, not a report. A non-admin's
                approved request now always needs an admin/co-admin to execute it, same as the
                'requested' review step. */}
          </div>
        ))}
        {requests?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">No reversal requests yet.</div>
        )}
      </section>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

// ExecuteButton — its own tiny component so each row gets an independent
// submitting/error state without needing a page-wide map of button states.
function ExecuteButton({ label = 'Execute reversal', onExecute }: { label?: string; onExecute: () => Promise<{ error: string | null }> }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setSubmitting(true);
    setError(null);
    const { error: err } = await onExecute();
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Reversing…' : label}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function RequestForm({ sale, onDone, onCancel }: { sale: SaleRow; onDone: () => void; onCancel: () => void }) {
  const { user } = useSession();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    // Server-side RPC, not a plain insert — §4.3.11 step 2's auto-approval for a
    // can_self_reverse requester has to be decided from their real, current flag, which the
    // client can't be trusted to assert honestly via a plain INSERT (see migration 0017's own
    // comment, and rls-policies.sql's note on why this table's INSERT policy can't restrict it).
    const { data, error: rpcErr } = await supabase.rpc('request_sale_reversal', {
      p_sale_id: sale.id,
      p_reason: reason.trim() || null,
    });
    setSubmitting(false);
    const err = rpcErr?.message ?? data?.error ?? null;
    if (err) { setError(`Could not save: ${err}`); return; }
    setSuccess(data?.status === 'approved' ? 'Reversal requested — auto-approved, ready to execute.' : 'Reversal requested.');
    setTimeout(onDone, 600);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Request reversal</h2>
      <p className="text-sm text-slate-500">
        {sale.skus?.english_name ?? 'Sale'} · {sale.customer_name} · ₹{Number(sale.total_amount).toFixed(2)} on {new Date(sale.sold_at).toLocaleDateString()}
      </p>

      <FormField id="reversal-reason" label="Reason">
        <TextInput id="reversal-reason" label="" value={reason} onChange={setReason} placeholder="e.g. Wrong amount entered" />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : 'Request reversal'}
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
