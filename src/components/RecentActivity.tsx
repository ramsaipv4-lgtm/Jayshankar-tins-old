// RecentActivity — the last N movements across the wholesaler's view.
// Renders inline on each role shell. W3: limit 20, no filters.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface MovementRow {
  id: string;
  kind: 'delivery_in' | 'transfer' | 'sale' | 'spoilage';
  sku_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  kg: number;
  occurred_at: string;
}

interface Sku { id: string; english_name: string; code: string }
interface Location { id: string; name: string; display_name?: string | null }

const KIND_STYLES: Record<MovementRow['kind'], string> = {
  delivery_in: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  transfer:    'bg-indigo-100 text-indigo-700 border-indigo-200',
  sale:        'bg-amber-100 text-amber-700 border-amber-200',
  spoilage:    'bg-red-100 text-red-700 border-red-200',
};

const KIND_LABEL: Record<MovementRow['kind'], string> = {
  delivery_in: 'Delivery',
  transfer:    'Transfer',
  sale:        'Sale',
  spoilage:    'Spoilage',
};

export default function RecentActivity({ limit = 20 }: { limit?: number }) {
  const { data: movements, isLoading } = useQuery({
    queryKey: ['recent-activity', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movements')
        .select('id, kind, sku_id, from_location_id, to_location_id, kg, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as MovementRow[];
    },
  });

  const { data: skus } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase.from('skus').select('id, code, english_name').order('english_name');
      if (error) throw error;
      return (data ?? []) as Sku[];
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

  function skuName(id: string) { return skus?.find((s) => s.id === id)?.english_name ?? '—'; }
  // Use display_name when present (matches what the LocationSelect dropdown shows),
  // fall back to the short `name` for older rows.
  function locName(id: string | null) { return id ? (locations?.find((l) => l.id === id)?.display_name ?? locations?.find((l) => l.id === id)?.name ?? '—') : '—'; }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {isLoading ? (
        <div className="px-4 py-6 text-sm text-slate-500 text-center">Loading activity…</div>
      ) : !movements || movements.length === 0 ? (
        <div className="px-4 py-8 text-center text-slate-500">
          <div className="text-sm">No activity yet.</div>
          <div className="mt-2 text-xs text-slate-500">Record a delivery, sale, transfer, or spoilage to see it here.</div>
        </div>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th scope="col" className="text-left px-4 py-2 font-medium">When</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">Kind</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">SKU</th>
              <th scope="col" className="text-left px-4 py-2 font-medium">From → To</th>
              <th scope="col" className="text-right px-4 py-2 font-medium">kg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {new Date(m.occurred_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${KIND_STYLES[m.kind]}`}>
                    {KIND_LABEL[m.kind]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-800">{skuName(m.sku_id)}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">
                  {locName(m.from_location_id)} → {locName(m.to_location_id)}
                </td>
                <td className="px-4 py-2 text-slate-800 text-right tabular-nums">{m.kg.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
