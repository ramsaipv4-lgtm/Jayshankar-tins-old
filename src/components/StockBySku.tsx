// StockBySku — admin view of total kg_remaining per SKU, sorted low-stock first.
// Aggregates batches by sku_id client-side. Pilot: move to a Postgres view
// + a SECURITY DEFINER function for atomicity + the §8.6 performance target
// (decision 24).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface Sku { id: string; english_name: string; code: string; low_stock_threshold_kg: number }
interface Batch { id: string; sku_id: string; kg_remaining: number; location_id: string; delivered_at: string }
interface Location { id: string; name: string; display_name: string | null }

interface SkuRow {
  sku: Sku;
  totalKg: number;
  batchCount: number;
  byLocation: { location: Location; kg: number }[];
  isLowStock: boolean;
}

export default function StockBySku() {
  const { data: skus } = useQuery({
    queryKey: ['skus-with-threshold'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, english_name, code, low_stock_threshold_kg')
        .eq('active', true)
        .order('english_name');
      if (error) throw error;
      return (data ?? []) as Sku[];
    },
  });

  const { data: batches } = useQuery({
    queryKey: ['batches-with-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, sku_id, kg_remaining, location_id, delivered_at')
        .gt('kg_remaining', 0);
      if (error) throw error;
      return (data ?? []) as Batch[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name, display_name').order('name');
      if (error) throw error;
      return (data ?? []) as Location[];
    },
  });

  if (!skus || !batches || !locations) {
    return <div className="text-sm text-slate-500">Loading stock…</div>;
  }

  // Aggregate batches by sku_id
  const rows: SkuRow[] = skus.map((s) => {
    const skuBatches = batches.filter((b) => b.sku_id === s.id);
    const totalKg = skuBatches.reduce((acc, b) => acc + Number(b.kg_remaining), 0);
    const byLocMap = new Map<string, number>();
    for (const b of skuBatches) {
      byLocMap.set(b.location_id, (byLocMap.get(b.location_id) ?? 0) + Number(b.kg_remaining));
    }
    const byLocation = Array.from(byLocMap.entries()).map(([locId, kg]) => ({
      location: locations.find((l) => l.id === locId) ?? { id: locId, name: '—', display_name: '—' },
      kg,
    }));
    return {
      sku: s,
      totalKg,
      batchCount: skuBatches.length,
      byLocation,
      isLowStock: totalKg < Number(s.low_stock_threshold_kg),
    };
  });

  // Sort low-stock first (most useful for the admin), then by total kg asc
  rows.sort((a, b) => {
    if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
    return a.totalKg - b.totalKg;
  });

  const lowStockCount = rows.filter((r) => r.isLowStock).length;

  return (
    <div className="space-y-3">
      {lowStockCount > 0 && (
        <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <strong>{lowStockCount} SKU{lowStockCount === 1 ? '' : 's'}</strong> below low-stock threshold. Sorted to the top of the list.
        </div>
      )}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* overflow-x-auto on this inner wrapper, not the rounded-corner outer div — plain
            overflow-hidden on a wide table just silently CLIPS whatever doesn't fit (found on
            a real phone: the "By location" column vanishing entirely), it doesn't scroll. The
            outer div keeps overflow-hidden purely for the rounded-corner visual clip, which is
            harmless to combine with an inner scroll container. */}
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="text-left px-4 py-2 font-medium">SKU</th>
              <th scope="col" className="text-right px-4 py-2 font-medium">Total kg</th>
              <th scope="col" className="text-right px-4 py-2 font-medium">Threshold</th>
              <th scope="col" className="text-right px-4 py-2 font-medium">Batches</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">By location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.sku.id} className={r.isLowStock ? 'bg-amber-50' : ''}>
                <td className="px-4 py-2">
                  <div className="text-slate-800">{r.sku.english_name}</div>
                  <div className="text-xs text-slate-500 font-mono">{r.sku.code}</div>
                </td>
                <td className="px-4 py-2 text-slate-800 text-right tabular-nums font-medium">
                  {r.totalKg.toFixed(3)}
                </td>
                <td className="px-4 py-2 text-slate-500 text-right tabular-nums">
                  {r.sku.low_stock_threshold_kg}
                </td>
                <td className="px-4 py-2 text-slate-500 text-right tabular-nums">
                  {r.batchCount}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {r.byLocation.length === 0
                    ? <span className="text-slate-500">no stock</span>
                    : r.byLocation.map((bl) => `${bl.location.display_name ?? bl.location.name}: ${bl.kg.toFixed(2)}`).join(' · ')}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No SKUs.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
