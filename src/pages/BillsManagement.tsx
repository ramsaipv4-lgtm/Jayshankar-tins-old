// BillsManagement — list vendor bills, and let admin/co-admin mark one shared back to the
// vendor. Part of the V1 sprint closing the Bills gap (decision #64). §4.2.14: share_status
// tracks whether a bill has been shared BACK to the vendor (a receipt/confirmation of what was
// bought), not anything customer-facing. The WhatsApp method gets D20's "lite" implementation
// (decision #67) — compose the real bill summary and hand it to ShareComposer; PDF/email stay
// pure record-keeping (no PDF generation, no email sending exists in this project) since
// WhatsApp is confirmed the actual channel this business uses (D20/D36).

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';
import { ShareComposer } from '../components/ShareComposer';
import { reconcileBill } from '../lib/mutations';
import { generateBillImage } from '../lib/billImage';

interface BillRow {
  id: string;
  vendor_bill_number: string | null;
  bill_date: string;
  total_amount: number;
  share_status: 'not_shared' | 'shared';
  shared_at: string | null;
  share_method: 'pdf' | 'whatsapp' | 'email' | null;
  payment_terms: 'cash' | 'credit';
  reconciled_total_amount: number | null;
  reconciliation_notes: string | null;
  reconciliation_reminder_at: string | null;
  reconciled_at: string | null;
  vendors: { name: string } | null;
}

interface BillLineRow { kg: number; price_per_kg_paid: number; skus: { english_name: string } | null }

const SHARE_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'pdf', label: 'PDF' },
  { value: 'email', label: 'Email' },
];

export default function BillsManagement() {
  const { user } = useSession();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'co-admin';
  const [sharing, setSharing] = useState<string | null>(null);
  const [composingWhatsapp, setComposingWhatsapp] = useState<BillRow | null>(null);
  const [reconciling, setReconciling] = useState<BillRow | null>(null);

  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills', 'management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('id, vendor_bill_number, bill_date, total_amount, share_status, shared_at, share_method, payment_terms, reconciled_total_amount, reconciliation_notes, reconciliation_reminder_at, reconciled_at, vendors(name)')
        .order('bill_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as BillRow[];
    },
  });

  // Which bills have an unresolved delivery discrepancy (migration 0032/0033) -- drives the
  // "Needs reconciliation" section below, alongside overdue reminders (checked client-side
  // against reconciliation_reminder_at, no separate query needed for that half).
  const { data: discrepancyBillIds } = useQuery({
    queryKey: ['bills', 'discrepancy-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receiving_confirmations')
        .select('bill_id')
        .eq('discrepancy_flag', true);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.bill_id as string));
    },
  });

  const now = Date.now();
  const needsAttention = (bills ?? []).filter((b) =>
    !b.reconciled_at && (
      discrepancyBillIds?.has(b.id) ||
      (b.reconciliation_reminder_at && new Date(b.reconciliation_reminder_at).getTime() <= now)
    )
  );

  async function markShared(billId: string, method: string) {
    await supabase.from('bills').update({
      share_status: 'shared',
      shared_at: new Date().toISOString(),
      share_method: method,
    }).eq('id', billId);
    setSharing(null);
    setComposingWhatsapp(null);
    qc.invalidateQueries({ queryKey: ['bills', 'management'] });
  }

  function pickMethod(bill: BillRow, method: string) {
    if (method === 'whatsapp') {
      setComposingWhatsapp(bill);
    } else {
      markShared(bill.id, method);
    }
  }

  if (composingWhatsapp) {
    return (
      <WhatsAppComposePanel
        bill={composingWhatsapp}
        onSent={() => markShared(composingWhatsapp.id, 'whatsapp')}
        onCancel={() => setComposingWhatsapp(null)}
      />
    );
  }

  if (reconciling) {
    return (
      <ReconcilePanel
        bill={reconciling}
        onDone={() => { setReconciling(null); qc.invalidateQueries({ queryKey: ['bills'] }); }}
        onCancel={() => setReconciling(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Bills</h2>
        <p className="text-sm text-slate-500 mt-1">Every vendor bill received. Mark one shared once you've sent the vendor their copy.</p>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      {isAdmin && needsAttention.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-800">
            Needs reconciliation ({needsAttention.length})
          </h3>
          <div className="space-y-2">
            {needsAttention.map((b) => (
              <div key={b.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-slate-800 font-medium">{b.vendors?.name ?? 'Unknown vendor'}</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      {discrepancyBillIds?.has(b.id) ? 'Delivery didn\'t match what was promised' : 'Reminder due'}
                      {' · '}₹{Number(b.total_amount).toFixed(2)} promised
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReconciling(b)}
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 shrink-0"
                  >
                    Reconcile →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-2">
        {bills?.map((b) => (
          <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {b.vendors?.name ?? 'Unknown vendor'}
                  {b.vendor_bill_number && <span className="text-slate-500 font-normal"> · bill #{b.vendor_bill_number}</span>}
                  {b.payment_terms === 'credit' && <span className="text-amber-600 font-normal"> · credit</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(b.bill_date).toLocaleDateString()} · ₹{Number(b.total_amount).toFixed(2)}
                  {b.reconciled_at && b.reconciled_total_amount != null && (
                    <> · settled ₹{Number(b.reconciled_total_amount).toFixed(2)}</>
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${b.share_status === 'shared' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {b.share_status === 'shared' ? `Shared${b.share_method ? ` (${b.share_method})` : ''}` : 'Not shared'}
              </span>
            </div>

            {isAdmin && b.payment_terms === 'credit' && !b.reconciled_at && !needsAttention.some((n) => n.id === b.id) && (
              <button
                type="button"
                onClick={() => setReconciling(b)}
                className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 mr-4"
              >
                Reconcile / defer →
              </button>
            )}

            {isAdmin && b.share_status === 'not_shared' && (
              sharing === b.id ? (
                <div className="flex gap-2 mt-3">
                  {SHARE_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => pickMethod(b, m.value)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {m.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setSharing(null)} className="text-sm text-slate-500 hover:text-slate-700">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSharing(b.id)}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Mark shared →
                </button>
              )
            )}
          </div>
        ))}
        {bills?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">No bills recorded yet — receive one from the "+ Delivery" screen.</div>
        )}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

// WhatsAppComposePanel — the actual bill-summary text, built from the bill's real lines, not
// just the stored total. "Mark as shared" only fires once the admin confirms they actually sent
// it (via the OS share sheet or a manual paste after copying) — sharing is recorded as a
// consequence of composing, not a separate disconnected step.
// WhatsAppComposePanel — the text is a real starting draft, not a fixed template: fully
// editable (per the user's own "flexibility in mind" request), and two toggles control what a
// generated picture (and the text's own total line) shows -- an admin who doesn't want per-kg
// prices visible to the vendor, say, can turn that off before sharing either the text or the
// picture. Neither is ever sent automatically -- ShareComposer just preloads the OS share sheet.
function WhatsAppComposePanel({ bill, onSent, onCancel }: { bill: BillRow; onSent: () => void; onCancel: () => void }) {
  const { data: lines } = useQuery({
    queryKey: ['bill-lines-for-share', bill.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('kg, price_per_kg_paid, skus(english_name)')
        .eq('bill_id', bill.id);
      if (error) throw error;
      return (data ?? []) as unknown as BillLineRow[];
    },
  });

  const [showPrices, setShowPrices] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [text, setText] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [generating, setGenerating] = useState(false);

  function buildDefaultText(): string {
    const lineText = (lines ?? []).map((l) =>
      `${l.skus?.english_name ?? 'Fish'} — ${Number(l.kg).toFixed(2)}kg${showPrices ? ` @ ₹${Number(l.price_per_kg_paid).toFixed(2)}/kg` : ''}`
    ).join('\n');
    const totalLine = showTotal ? `\n\nTotal: ₹${Number(bill.total_amount).toFixed(2)}` : '';
    const settledLine = bill.reconciled_at && bill.reconciled_total_amount != null
      ? `\nSettled at: ₹${Number(bill.reconciled_total_amount).toFixed(2)}${bill.reconciliation_notes ? ` (${bill.reconciliation_notes})` : ''}`
      : '';
    return `Hi ${bill.vendors?.name ?? ''}, here's your bill from ${new Date(bill.bill_date).toLocaleDateString()}:\n${lineText}${totalLine}${settledLine}`;
  }

  // Regenerate the DRAFT text whenever a toggle changes or the lines finish loading -- but only
  // ever overwrite what the admin sees before they've started actually editing it by hand, so a
  // toggle flip after some manual edits doesn't wipe out their changes.
  const [everEdited, setEverEdited] = useState(false);
  const draft = text ?? (lines !== undefined ? buildDefaultText() : 'Loading…');
  function onToggle(setter: (v: boolean) => void, value: boolean) {
    setter(value);
    if (!everEdited) setText(null);
  }

  async function onGenerateImage() {
    if (!lines) return;
    setGenerating(true);
    try {
      const blob = await generateBillImage({
        vendorName: bill.vendors?.name ?? 'Vendor',
        billDate: bill.bill_date,
        vendorBillNumber: bill.vendor_bill_number,
        lines: lines.map((l) => ({ skuName: l.skus?.english_name ?? 'Fish', kg: Number(l.kg), pricePerKg: Number(l.price_per_kg_paid) })),
        totalAmount: Number(bill.total_amount),
        reconciledTotalAmount: bill.reconciled_total_amount != null ? Number(bill.reconciled_total_amount) : null,
        reconciliationNotes: bill.reconciliation_notes,
        showPrices,
        showTotal,
      });
      setImageBlob(blob);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-800">Share bill with {bill.vendors?.name ?? 'vendor'}</h2>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showPrices} onChange={(e) => onToggle(setShowPrices, e.target.checked)} className="rounded border-slate-300" />
          Show per-kg prices
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showTotal} onChange={(e) => onToggle(setShowTotal, e.target.checked)} className="rounded border-slate-300" />
          Show total
        </label>
      </div>

      <FormField id="whatsapp-text" label="Message (edit as you like)">
        <textarea
          id="whatsapp-text"
          value={draft}
          onChange={(e) => { setText(e.target.value); setEverEdited(true); }}
          rows={8}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </FormField>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onGenerateImage}
          disabled={!lines || generating}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
        >
          {generating ? 'Drawing…' : imageBlob ? 'Regenerate picture' : 'Generate a picture too'}
        </button>
        {imageBlob && <span className="text-xs text-emerald-700">Picture ready — Share/Save below will include it.</span>}
      </div>
      {imageBlob && <BillImagePreview blob={imageBlob} />}

      <ShareComposer text={draft} label="Copy text" image={imageBlob ? { blob: imageBlob, fileName: `bill-${bill.id.slice(0, 8)}.png` } : undefined} />

      <div className="flex gap-3 pt-2 border-t border-slate-200">
        <button type="button" onClick={onSent} className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700">
          I sent it — mark as shared
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// BillImagePreview — owns the object URL's lifetime itself (created once per blob, revoked on
// change/unmount) rather than calling URL.createObjectURL(imageBlob) inline in JSX, which would
// leak a new URL every render.
function BillImagePreview({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="Bill preview" className="max-w-full rounded-md border border-slate-200" />;
}

// ReconcilePanel — the actual "what we decided" step D54's discrepancy detection was always
// missing. Two distinct actions, not one form with an ambiguous middle state: settle now (a
// final figure + notes, closes it out) or defer with a reminder (for a credit purchase that
// genuinely won't be settled today) -- reconcile_bill (migration 0034) keeps them separate
// server-side too, matching this project's own D22 "check_ins" no-manual-step distaste for
// state nobody's sure they're in.
function ReconcilePanel({ bill, onDone, onCancel }: { bill: BillRow; onDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'settle' | 'defer'>('settle');
  const [amount, setAmount] = useState(bill.reconciled_total_amount != null ? String(bill.reconciled_total_amount) : String(bill.total_amount));
  const [notes, setNotes] = useState(bill.reconciliation_notes ?? '');
  const [remindDays, setRemindDays] = useState('7');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await reconcileBill({
      billId: bill.id,
      reconciledTotalAmount: mode === 'settle' ? Number(amount) : undefined,
      notes: notes.trim() || undefined,
      remindInDays: mode === 'defer' ? Number(remindDays) : undefined,
    });
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    setSuccess(mode === 'settle' ? 'Marked settled.' : `Reminder set for ${new Date(result.deferredTo!).toLocaleDateString()}.`);
    setTimeout(onDone, 800);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Reconcile — {bill.vendors?.name ?? 'vendor'}</h2>
      <p className="text-sm text-slate-500">Bill promised ₹{Number(bill.total_amount).toFixed(2)}.</p>

      <div className="flex gap-2" role="radiogroup" aria-label="Reconcile now or defer">
        {(['settle', 'defer'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-2 text-sm font-medium border ${mode === m ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
          >
            {m === 'settle' ? 'Settle it now' : 'Defer with a reminder'}
          </button>
        ))}
      </div>

      {mode === 'settle' ? (
        <FormField id="reconciled-amount" label="What was actually agreed/settled? (₹)" required>
          <TextInput id="reconciled-amount" label="" type="number" value={amount} onChange={setAmount} required />
        </FormField>
      ) : (
        <FormField id="remind-days" label="Remind me again in how many days?" required>
          <TextInput id="remind-days" label="" type="number" value={remindDays} onChange={setRemindDays} required />
        </FormField>
      )}

      <FormField id="reconcile-notes" label="Notes (optional)">
        <TextInput id="reconcile-notes" label="" value={notes} onChange={setNotes} placeholder="e.g. vendor agreed to a 2kg deduction next bill" />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : mode === 'settle' ? 'Mark settled' : 'Set reminder'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
