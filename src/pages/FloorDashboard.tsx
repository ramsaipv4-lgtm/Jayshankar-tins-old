// FloorDashboard — worker view. Sees stock by SKU (current kg per batch), recent movements.
// W3: record transfer + record spoilage buttons link to the W3 forms.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import RecentActivity from '../components/RecentActivity';

interface Sku { id: string; code: string; english_name: string; shelf_life_hours: number | null }
interface Batch { id: string; sku_id: string; location_id: string; kg_remaining: number; delivered_at: string }
interface Location { id: string; name: string; display_name?: string | null }

export default function FloorDashboard() {
  const { user } = useSession();
  const { data: skus } = useQuery({
    // Distinct key from the shared 'skus' key other components (RecentActivity,
    // FormFields, RepDashboard) use for a narrower shape. This page needs
    // shelf_life_hours; TanStack Query dedupes identical keys and shares one
    // queryFn's result across all observers, so reusing 'skus' here silently
    // starved this query of shelf_life_hours whenever RecentActivity (rendered
    // below, with its own narrower 'skus' query) resolved first. Found during
    // T3's audit — see BUILDER-DECISIONS-REVIEW.md decision #34.
    queryKey: ['skus', 'floor-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('skus').select('id, code, english_name, shelf_life_hours').order('english_name');
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

  // Worker's main view: current stock. We show only batches with kg_remaining > 0.
  // The batches table has no expires_at column — shelf life lives on skus and
  // the batch's expires_at is computed at read time as delivered_at + skus.shelf_life_hours.
  const { data: batches, isLoading } = useQuery({
    queryKey: ['active-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('id, sku_id, location_id, kg_remaining, delivered_at')
        .gt('kg_remaining', 0)
        .order('delivered_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Batch[];
    },
  });

  function skuName(id: string) { return skus?.find((s) => s.id === id)?.english_name ?? '—'; }
  function skuCode(id: string) { return skus?.find((s) => s.id === id)?.code ?? '—'; }
  function locationName(id: string) { return locations?.find((l) => l.id === id)?.display_name ?? locations?.find((l) => l.id === id)?.name ?? '—'; }
  // expires_at = delivered_at + skus.shelf_life_hours
  function expiresAt(b: Batch): string | null {
    const sku = skus?.find((s) => s.id === b.sku_id);
    if (!sku?.shelf_life_hours || !b.delivered_at) return null;
    const d = new Date(b.delivered_at);
    d.setHours(d.getHours() + sku.shelf_life_hours);
    return d.toISOString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Floor dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Worker view — current stock by location; record transfers and spoilage.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/my-tasks" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            My tasks
          </Link>
          <Link to="/learn" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            🎓 Learn
          </Link>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Record activity</h3>
        {/* No "+ Transfer" here — D29 made transfer an admin/co-admin-only, cross-warehouse
            action; repack (below) is the worker's everyday "move stock" task now. */}
        <div className={`grid gap-2 ${user?.role === 'super-worker' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Link to="/spoil" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-center">
            + Spoilage
          </Link>
          <Link to="/repack" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-center">
            + Repack
          </Link>
          {/* confirm_delivery_arrival's own role check excludes plain 'worker' -- only shown here
              for super-worker, who shares this dashboard but is also eligible (migration 0032). */}
          {user?.role === 'super-worker' && (
            <Link to="/deliveries/confirm" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 text-center">
              Confirm arrivals
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Active batches ({batches?.length ?? '…'})
          </h3>
          <Link
            to="/spoil"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            + Record spoilage
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-slate-500 text-center">Loading…</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-medium">SKU</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Location</th>
                  <th scope="col" className="text-right px-4 py-2 font-medium">kg remaining</th>
                  <th scope="col" className="text-left px-4 py-2 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches?.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2">
                      <div className="text-slate-800">{skuName(b.sku_id)}</div>
                      <div className="text-xs text-slate-500 font-mono">{skuCode(b.sku_id)}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{locationName(b.location_id)}</td>
                    <td className="px-4 py-2 text-slate-800 text-right tabular-nums">
                      {b.kg_remaining.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {expiresAt(b) ? new Date(expiresAt(b)!).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
                {batches?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      <div className="text-sm">No active stock at this location.</div>
                      <div className="mt-2">
                        <Link
                          to="/transfer"
                          className="inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          + Transfer from storage
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Per SPEC D3a, this layout collapses with the rep's (same shared shell, different data scope).
      </p>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent activity</h3>
        <RecentActivity />
      </section>
    </div>
  );
}
