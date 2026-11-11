// DeliveryConfirmation — the arrival half of the in-transit workflow (migration 0031/0032).
// DeliveryForm.tsx (/deliver) lets a rep log a bill from the vendor's own promise, optionally
// straight into an in_transit_inbound location if the fish hasn't reached the warehouse yet.
// This page lists exactly what's still sitting in transit and lets whoever receives it at the
// door confirm what was actually measured — via confirm_delivery_arrival (migration 0032), which
// moves the batch to a real location and records any promised-vs-measured discrepancy. Physical
// stock adjusts to what's measured; the vendor's bill amount is deliberately left untouched —
// the business's own answer was "case by case, reconciled by hand," not an automatic split.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { confirmDeliveryArrival } from '../lib/mutations';
import { FormError, FormField, FormFooter, FormSuccess, LocationSelect, SkuSelect, TextInput } from '../components/FormFields';

interface InTransitBatch {
  id: string;
  kg: number;
  sku_id: string;
  bill_id: string;
  location_id: string;
  created_at: string;
  skus: { english_name: string } | null;
  vendors: { name: string } | null;
  bills: { vendor_bill_number: string | null; bill_date: string } | null;
}

export default function DeliveryConfirmation() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<InTransitBatch | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches', 'in-transit-inbound'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, kg, sku_id, bill_id, location_id, created_at, skus(english_name), vendors(name), bills(vendor_bill_number, bill_date), locations!inner(kind)')
        .eq('locations.kind', 'in_transit_inbound')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InTransitBatch[];
    },
  });

  if (confirming) {
    return (
      <ConfirmForm
        batch={confirming}
        onDone={() => { setConfirming(null); qc.invalidateQueries({ queryKey: ['batches'] }); }}
        onCancel={() => setConfirming(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Confirm arrivals</h2>
        <p className="text-sm text-slate-500 mt-1">
          Fish logged as "in transit" from a vendor pickup, still on the way to a real warehouse
          location. Confirm each one once it actually arrives, with what's really measured.
        </p>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {batches?.map((b) => (
          <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {b.skus?.english_name ?? 'Fish'} — {Number(b.kg).toFixed(2)}kg promised
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  From {b.vendors?.name ?? 'Unknown vendor'}
                  {b.bills?.vendor_bill_number && <> · bill #{b.bills.vendor_bill_number}</>}
                  {b.bills?.bill_date && <> · {new Date(b.bills.bill_date).toLocaleDateString()}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(b)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 shrink-0"
              >
                Confirm arrival →
              </button>
            </div>
          </div>
        ))}
        {batches?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">Nothing in transit right now.</div>
        )}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function ConfirmForm({ batch, onDone, onCancel }: { batch: InTransitBatch; onDone: () => void; onCancel: () => void }) {
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [confirmedGoodKg, setConfirmedGoodKg] = useState(String(batch.kg));
  const [confirmedSpoiledKg, setConfirmedSpoiledKg] = useState('0');
  const [skuId, setSkuId] = useState(batch.sku_id);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalMeasured = Number(confirmedGoodKg || 0) + Number(confirmedSpoiledKg || 0);
  const kgDiffers = totalMeasured !== Number(batch.kg);
  const skuDiffers = skuId !== batch.sku_id;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await confirmDeliveryArrival({
      batchId: batch.id,
      destinationLocationId,
      confirmedGoodKg: Number(confirmedGoodKg || 0),
      confirmedSpoiledKg: Number(confirmedSpoiledKg || 0),
      confirmedSkuId: skuDiffers ? skuId : null,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }

    setSuccess(result.discrepancyFlag
      ? `Confirmed — this differed from what was promised (${result.promisedKg}kg promised → ${result.confirmedGoodKg}kg good${result.confirmedSpoiledKg ? ` + ${result.confirmedSpoiledKg}kg spoiled` : ''}). Admins have been notified to reconcile with the vendor.`
      : 'Confirmed — matched what was promised.');
    setTimeout(onDone, result.discrepancyFlag ? 2200 : 900);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">
        Confirm arrival — {batch.skus?.english_name ?? 'Fish'} from {batch.vendors?.name ?? 'vendor'}
      </h2>
      <p className="text-sm text-slate-500">Promised at pickup: {Number(batch.kg).toFixed(2)}kg.</p>

      <FormField id="destination" label="Which real location did it land in?" required>
        <LocationSelect id="destination" value={destinationLocationId} onChange={setDestinationLocationId} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="confirmed-good-kg" label="Good, usable kg" required>
          <TextInput id="confirmed-good-kg" label="" type="number" value={confirmedGoodKg} onChange={setConfirmedGoodKg} required />
        </FormField>
        <FormField id="confirmed-spoiled-kg" label="Already spoiled/damaged (kg)">
          <TextInput id="confirmed-spoiled-kg" label="" type="number" value={confirmedSpoiledKg} onChange={setConfirmedSpoiledKg} />
        </FormField>
      </div>
      {Number(confirmedSpoiledKg) > 0 && (
        <p className="text-xs text-slate-500 -mt-2">
          Recorded separately from ordinary in-warehouse spoilage — spoilage found right at
          arrival counts against this vendor's own record, not the warehouse's handling.
        </p>
      )}
      {kgDiffers && (
        <p className="text-sm text-amber-700 -mt-2">
          Total ({totalMeasured.toFixed(2)}kg) differs from the {Number(batch.kg).toFixed(2)}kg
          promised — this will be flagged for the admin to settle with the vendor by hand. Stock
          is tracked at what you actually measured as good.
        </p>
      )}

      <FormField id="confirmed-sku" label="Is this actually the fish that was promised?">
        <SkuSelect id="confirmed-sku" value={skuId} onChange={setSkuId} required={false} />
      </FormField>
      {skuDiffers && (
        <p className="text-sm text-amber-700 -mt-2">
          Different from what was billed — also flagged for the admin.
        </p>
      )}

      <FormField id="notes" label="Notes (freshness, damage, anything worth noting)">
        <TextInput id="notes" label="" value={notes} onChange={setNotes} />
      </FormField>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !destinationLocationId || totalMeasured <= 0}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Confirming…' : 'Confirm arrival'}
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
