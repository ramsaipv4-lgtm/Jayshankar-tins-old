// PackContainerForm — pack a subset of one bill's still-unpacked fish into a container. Part
// of the V1 sprint (decision #64): record_container_fill (migration 0007) has existed since
// Mode B with zero frontend usage anywhere — checked directly (`grep -rn "record_container_fill"
// src/` returned nothing before this file). This is that frontend.
//
// A container_fill belongs to exactly one bill (container_fills.bill_id is NOT NULL — "one
// purchase event, one shelf-life clock," §4.2.12), so packing is inherently bill-scoped: pick
// one bill, then pack some or all of its still-unpacked lines. "Still-unpacked" is computed
// client-side the same way record_container_fill's own double-allocation guard does —
// least(kg_remaining, kg - already_packed_excluding_repack_copies) — so the form only ever
// offers amounts the RPC will actually accept, though the RPC remains the real source of truth
// (never trusted to be redundant, per this project's own "RPC validates for real" discipline).

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useOnlineStatus } from '../lib/online';
import { recordContainerFill } from '../lib/mutations';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

const CAPACITIES = [5, 10, 15, 20, 25];

interface BatchRow {
  id: string;
  sku_id: string;
  kg: number;
  kg_remaining: number;
  bill_id: string;
  location_id: string;
  delivered_at: string;
  skus: { english_name: string; tamil_name: string | null } | null;
}

interface FillItemRow {
  batch_id: string;
  kg: number;
  container_fills: { is_repack_copy: boolean } | null;
}

interface PackLine extends BatchRow {
  available: number;
}

interface BillGroup {
  billId: string;
  locationId: string;
  billDate: string | null;
  vendorName: string;
  vendorBillNumber: string | null;
  lines: PackLine[];
}

interface BillRow {
  id: string;
  bill_date: string;
  vendor_bill_number: string | null;
  vendors: { name: string } | null;
}

function useBillsToPack() {
  return useQuery({
    queryKey: ['bills', 'pack-candidates'],
    queryFn: async (): Promise<BillGroup[]> => {
      const { data: batchRows, error: batchErr } = await supabase
        .from('batches')
        .select('id, sku_id, kg, kg_remaining, bill_id, location_id, delivered_at, skus(english_name, tamil_name), bills(id, bill_date, vendor_bill_number, vendors(name))')
        .not('bill_id', 'is', null)
        .order('delivered_at', { ascending: false })
        .limit(200);
      if (batchErr) throw batchErr;
      const batches = (batchRows ?? []) as unknown as (BatchRow & { bills: BillRow | null })[];
      if (batches.length === 0) return [];

      const { data: fillItemRows, error: fiErr } = await supabase
        .from('container_fill_items')
        .select('batch_id, kg, container_fills(is_repack_copy)')
        .in('batch_id', batches.map((b) => b.id));
      if (fiErr) throw fiErr;

      const packedByBatch = new Map<string, number>();
      for (const fi of (fillItemRows ?? []) as unknown as FillItemRow[]) {
        if (fi.container_fills?.is_repack_copy) continue;
        packedByBatch.set(fi.batch_id, (packedByBatch.get(fi.batch_id) ?? 0) + Number(fi.kg));
      }

      const byBill = new Map<string, BillGroup>();
      for (const b of batches) {
        const packed = packedByBatch.get(b.id) ?? 0;
        const available = Math.max(0, Math.min(Number(b.kg_remaining), Number(b.kg) - packed));
        if (available <= 0.0009) continue;
        const billId = b.bill_id;
        if (!byBill.has(billId)) {
          byBill.set(billId, {
            billId,
            locationId: b.location_id,
            billDate: b.bills?.bill_date ?? null,
            vendorName: b.bills?.vendors?.name ?? 'Unknown vendor',
            vendorBillNumber: b.bills?.vendor_bill_number ?? null,
            lines: [],
          });
        }
        byBill.get(billId)!.lines.push({ ...b, available });
      }
      return Array.from(byBill.values());
    },
  });
}

export default function PackContainerForm() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const { data: bills, isLoading } = useBillsToPack();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const selectedBill = bills?.find((b) => b.billId === selectedBillId) ?? null;

  if (selectedBill) {
    return (
      <PackForm
        bill={selectedBill}
        onDone={() => {
          setSelectedBillId(null);
          qc.invalidateQueries({ queryKey: ['bills', 'pack-candidates'] });
          qc.invalidateQueries({ queryKey: ['recent-activity'] });
        }}
        onCancel={() => setSelectedBillId(null)}
        online={online}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Pack a container</h2>
        <p className="text-sm text-slate-500 mt-1">Pick a bill to see what's still unpacked from it, then pack some or all of it into a container.</p>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {bills?.map((b) => (
          <button
            key={b.billId}
            type="button"
            onClick={() => setSelectedBillId(b.billId)}
            className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {b.vendorName}
                  {b.vendorBillNumber && <span className="text-slate-500 font-normal"> · bill #{b.vendorBillNumber}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {b.billDate && new Date(b.billDate).toLocaleDateString()} · {b.lines.length} fish line{b.lines.length === 1 ? '' : 's'} unpacked
                </div>
              </div>
              <span className="text-indigo-600 text-sm font-medium shrink-0">Pack →</span>
            </div>
          </button>
        ))}
        {bills?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">Nothing waiting to be packed — every received bill's fish is already fully packed.</div>
        )}
      </div>

      <FormFooter backHref="/rep" backLabel="Back to rep dashboard" />
    </div>
  );
}

function PackForm({ bill, onDone, onCancel, online }: { bill: BillGroup; onDone: () => void; onCancel: () => void; online: boolean }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bill.lines.map((l) => [l.id, true]))
  );
  const [kgByBatch, setKgByBatch] = useState<Record<string, string>>(() =>
    Object.fromEntries(bill.lines.map((l) => [l.id, String(l.available)]))
  );
  const [containerNumber, setContainerNumber] = useState('');
  const [capacityKg, setCapacityKg] = useState<number>(10);
  // Only matters the moment container_number is genuinely new (migration 0033) -- ignored
  // server-side when adding to an existing one. A box that isn't really ours long-term (the
  // vendor's own, or one that'll go out to a buyer and not come back) is worth flagging at the
  // one point it's ever created, rather than rethinking what a container's identity means.
  const [ownership, setOwnership] = useState<'owned' | 'vendor_provided' | 'given_to_buyer'>('owned');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeLines = bill.lines.filter((l) => selected[l.id]);
  const totalSelectedKg = activeLines.reduce((sum, l) => sum + (Number(kgByBatch[l.id]) || 0), 0);
  const overCapacity = totalSelectedKg > capacityKg + 0.0009;
  const linesValid = activeLines.length > 0 && activeLines.every((l) => {
    const kg = Number(kgByBatch[l.id]);
    return Number.isFinite(kg) && kg > 0 && kg <= l.available + 0.0009;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) { setError('You are offline. Reconnect to pack a container.'); return; }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error: err, containerFillId, expiresAt, totalKg } = await recordContainerFill({
      billId: bill.billId,
      locationId: bill.locationId,
      containerNumber: containerNumber.trim(),
      capacityKg,
      lines: activeLines.map((l) => ({ batchId: l.id, kg: Number(kgByBatch[l.id]) })),
      ownership,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    const formattedExpiry = expiresAt ? new Date(expiresAt).toLocaleString() : '—';
    setSuccess(`Packed ${totalKg.toFixed(3)} kg into container ${containerNumber} (fill ${containerFillId?.slice(0, 8)}). Expires ${formattedExpiry}.`);
    setTimeout(onDone, 900);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Pack a container</h2>
      <p className="text-sm text-slate-500">
        {bill.vendorName}{bill.billDate && ` · ${new Date(bill.billDate).toLocaleDateString()}`} — pick what to pack.
      </p>

      <div className="space-y-2">
        {bill.lines.map((l) => (
          // A plain div, not a <label> — the checkbox gets its own explicit label below (just
          // wrapping the checkbox + fish name), so the kg TextInput's own <label> underneath
          // isn't nested inside a second, outer <label>. Nested labels are invalid HTML and a
          // real bug here: clicking the kg input's label text would also toggle the checkbox,
          // since a click anywhere inside an outer <label> forwards to its own control.
          <div key={l.id} className={`rounded-lg border p-3 ${selected[l.id] ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>
            <label htmlFor={`pack-select-${l.id}`} className="flex items-start gap-3 cursor-pointer">
              <input
                id={`pack-select-${l.id}`}
                type="checkbox"
                checked={!!selected[l.id]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [l.id]: e.target.checked }))}
                className="mt-1 rounded border-slate-300"
              />
              <span className="text-sm text-slate-800">
                {l.skus?.english_name ?? 'Fish'} — {l.available.toFixed(3)} kg available to pack
              </span>
            </label>
            {selected[l.id] && (
              <div className="mt-2 ml-7 max-w-40">
                <TextInput
                  id={`pack-kg-${l.id}`}
                  label="kg to pack"
                  type="number"
                  value={kgByBatch[l.id] ?? ''}
                  onChange={(v) => setKgByBatch((prev) => ({ ...prev, [l.id]: v }))}
                  step="0.001"
                  min="0.001"
                  max={String(l.available)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="container-number" label="Container number" required>
          <TextInput id="container-number" label="" value={containerNumber} onChange={setContainerNumber} required placeholder="e.g. TC-014" />
        </FormField>
        <FormField id="container-capacity" label="Capacity (kg)" required>
          <select
            id="container-capacity"
            value={capacityKg}
            onChange={(e) => setCapacityKg(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {CAPACITIES.map((c) => <option key={c} value={c}>{c} kg</option>)}
          </select>
        </FormField>
      </div>
      <FormField id="container-ownership" label="If this container number is new, whose box is it?">
        <select
          id="container-ownership"
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as typeof ownership)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="owned">Ours</option>
          <option value="vendor_provided">The vendor's — came with this delivery</option>
          <option value="given_to_buyer">Going out with the buyer — not coming back</option>
        </select>
      </FormField>
      <p className="text-xs text-slate-500">
        Type an existing container's number to add to it, or a new one to register it. Total selected: <span className={overCapacity ? 'text-red-600 font-medium' : 'font-medium'}>{totalSelectedKg.toFixed(3)} kg</span> of {capacityKg} kg capacity.
      </p>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !online || !containerNumber.trim() || !linesValid || overCapacity}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Packing…' : 'Pack container'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 font-medium hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
