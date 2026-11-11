// FishCard — search result detail for a fish/SKU: current stock (oldest-first, shelf life),
// recent purchase history with vendor, and a "show more" expansion for the full history. Part
// of the search feature (decision #65) — everything here is derivable from existing skus/
// batches/locations/bills/vendors data, no new schema.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormFooter } from '../components/FormFields';

interface Sku {
  id: string; code: string; english_name: string; tamil_name: string | null;
  shelf_life_hours: number | null; low_stock_threshold_kg: number;
}

interface BatchRow {
  id: string; kg_remaining: number; delivered_at: string; location_id: string;
  bills: { vendors: { name: string } | null } | null;
  locations: { name: string; display_name: string | null } | null;
}

interface PurchaseRow {
  id: string; kg: number; price_per_kg_paid: number; delivered_at: string;
  bills: { id: string; bill_date: string; vendor_bill_number: string | null; vendors: { name: string } | null } | null;
}

function expiresAt(deliveredAt: string, shelfLifeHours: number | null): string | null {
  if (shelfLifeHours == null) return null;
  return new Date(new Date(deliveredAt).getTime() + shelfLifeHours * 3600_000).toISOString();
}

export default function FishCard() {
  const { skuId } = useParams<{ skuId: string }>();
  const [showAllPurchases, setShowAllPurchases] = useState(false);

  const { data: sku } = useQuery({
    queryKey: ['sku-card', skuId],
    enabled: !!skuId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, code, english_name, tamil_name, shelf_life_hours, low_stock_threshold_kg')
        .eq('id', skuId)
        .single();
      if (error) throw error;
      return data as Sku;
    },
  });

  const { data: stockBatches } = useQuery({
    queryKey: ['sku-card-stock', skuId],
    enabled: !!skuId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, kg_remaining, delivered_at, location_id, bills(vendors(name)), locations(name, display_name)')
        .eq('sku_id', skuId)
        .gt('kg_remaining', 0)
        .order('delivered_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BatchRow[];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ['sku-card-purchases', skuId],
    enabled: !!skuId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, kg, price_per_kg_paid, delivered_at, bills(id, bill_date, vendor_bill_number, vendors(name))')
        .eq('sku_id', skuId)
        .order('delivered_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRow[];
    },
  });

  const totalKg = stockBatches?.reduce((sum, b) => sum + Number(b.kg_remaining), 0) ?? 0;
  const isLowStock = sku != null && totalKg < Number(sku.low_stock_threshold_kg);
  const visiblePurchases = showAllPurchases ? purchases : purchases?.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{sku?.english_name ?? 'Loading…'}</h2>
        {sku && (
          <p className="text-sm text-slate-500 mt-1">
            {sku.tamil_name && `${sku.tamil_name} · `}{sku.code}
            {sku.shelf_life_hours != null && ` · Shelf life ${sku.shelf_life_hours}h`}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Current stock — oldest first</h3>
          <span className={`text-sm font-semibold ${isLowStock ? 'text-amber-700' : 'text-slate-800'}`}>
            {totalKg.toFixed(3)} kg total{isLowStock && ' — below threshold'}
          </span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Received</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Location</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">From</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Expires</th>
                  <th scope="col" className="text-right px-4 py-2 font-medium">kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockBatches?.map((b) => {
                  const exp = expiresAt(b.delivered_at, sku?.shelf_life_hours ?? null);
                  const expiringSoon = exp && new Date(exp).getTime() - Date.now() < 24 * 3600_000;
                  return (
                    <tr key={b.id} className={expiringSoon ? 'bg-amber-50' : ''}>
                      <td className="px-4 py-2 text-slate-500">{new Date(b.delivered_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-slate-500">{b.locations?.display_name ?? b.locations?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{b.bills?.vendors?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{exp ? new Date(exp).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-slate-800 text-right tabular-nums font-medium">{Number(b.kg_remaining).toFixed(3)}</td>
                    </tr>
                  );
                })}
                {stockBatches?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No stock right now.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Purchase history</h3>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Vendor</th>
                  <th scope="col" className="text-right px-4 py-2 font-medium">kg</th>
                  <th scope="col" className="text-right px-4 py-2 font-medium">₹/kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePurchases?.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-slate-500">{new Date(p.delivered_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-800">{p.bills?.vendors?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-800 text-right tabular-nums">{Number(p.kg).toFixed(3)}</td>
                    <td className="px-4 py-2 text-slate-500 text-right tabular-nums">₹{Number(p.price_per_kg_paid).toFixed(2)}</td>
                  </tr>
                ))}
                {purchases?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No purchase history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {purchases && purchases.length > 5 && (
          <button type="button" onClick={() => setShowAllPurchases((v) => !v)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            {showAllPurchases ? 'Show less' : `Show all ${purchases.length} purchases →`}
          </button>
        )}
      </section>

      <FormFooter backHref="/search" backLabel="Back to search" />
    </div>
  );
}
