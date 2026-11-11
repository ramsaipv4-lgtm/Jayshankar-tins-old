// AdminDashboard — the wholesaler's view. Sees everything (RLS allows admin to read all).
// W3: shows recent activity from all roles. W4: stock by SKU + audit log link.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import RecentActivity from '../components/RecentActivity';
import StockBySku from '../components/StockBySku';

interface Vendor { id: string; name: string; phone: string | null }
interface Sku { id: string; code: string; english_name: string; shelf_life_hours: number | null }
interface Location { id: string; name: string; display_name?: string | null }

export default function AdminDashboard() {
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('id, name, phone').order('name');
      if (error) throw error;
      return (data ?? []) as Vendor[];
    },
  });

  const { data: skus } = useQuery({
    // Distinct key — see the identical fix + full explanation in FloorDashboard.tsx
    // (BUILDER-DECISIONS-REVIEW.md decision #34). This page's own 'Shelf life (hrs)'
    // column has been silently blank for every SKU because this query shared the
    // 'skus' key with the RecentActivity child component's narrower query.
    queryKey: ['skus', 'admin-dashboard'],
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

  // Aggregate counts (admin-only — uses REST count via head:true)
  const { data: stockCount } = useQuery({
    queryKey: ['batches-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('batches').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });

  const { data: movementsCount } = useQuery({
    queryKey: ['movements-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('movements').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });

  const { data: salesCount } = useQuery({
    queryKey: ['sales-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('sales').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Admin dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Wholesaler view — full read access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/search"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            🔍 Search
          </Link>
          <Link
            to="/learn"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            🎓 Learn
          </Link>
          <Link
            to="/admin/skus"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Manage fish types
          </Link>
          <Link
            to="/admin/team"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Team
          </Link>
          <Link
            to="/admin/warehouses"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Warehouses
          </Link>
          <Link
            to="/admin/vendors"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Manage vendors
          </Link>
          <Link
            to="/transfer"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Transfer
          </Link>
          <Link
            to="/spoil"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Spoilage
          </Link>
          <Link
            to="/repack"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Repack
          </Link>
          <Link
            to="/customers"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Customers
          </Link>
          <Link
            to="/payments"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Payments
          </Link>
          <Link
            to="/reversals"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reversals
          </Link>
          <Link
            to="/admin/tasks"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Delegate tasks
          </Link>
          <Link
            to="/bills"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Bills
          </Link>
          <Link
            to="/deliveries/confirm"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Confirm arrivals
          </Link>
          <Link
            to="/complaints"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Complaints
          </Link>
          <Link
            to="/admin/audit-log"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View audit log →
          </Link>
        </div>
      </div>

      {/* Top-line counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Batches" value={stockCount} />
        <Stat label="Movements" value={movementsCount} />
        <Stat label="Sales" value={salesCount} />
        <Stat label="Locations" value={locations?.length} />
      </div>

      {/* Vendors */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Vendors ({vendors?.length ?? '…'})
        </h3>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium">Name</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors?.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 text-slate-800">{v.name}</td>
                  <td className="px-4 py-2 text-slate-500">{v.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SKUs */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          SKUs ({skus?.length ?? '…'})
        </h3>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium">Code</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Name</th>
                <th scope="col" className="text-right px-4 py-2 font-medium">Shelf life (hrs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skus?.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{s.code}</td>
                  <td className="px-4 py-2 text-slate-800">{s.english_name}</td>
                  <td className="px-4 py-2 text-slate-500 text-right">
                    {s.shelf_life_hours ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Stock by SKU</h3>
        <p className="text-xs text-slate-500 mb-2">Aggregated kg_remaining per SKU, sorted low-stock first. The amber rows are below the SKU's <code>low_stock_threshold_kg</code>.</p>
        <StockBySku />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent activity (across all roles)</h3>
        <RecentActivity />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-800">{value ?? '…'}</div>
    </div>
  );
}
