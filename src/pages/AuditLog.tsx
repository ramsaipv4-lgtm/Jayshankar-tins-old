// AuditLog — admin-only audit log viewer. RLS already gates this to admin role.
// Filters: table_name, user, date range. Pagination: 50 per page, "load more"
// for the next page. Decision 25 documents the filter design.

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { formatPhone, useSession } from '../lib/auth';
import { FormError, FormField, FormFooter } from '../components/FormFields';

interface AuditRow {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  row_id: string;
  user_id: string | null;
  before_json: unknown;
  after_json: unknown;
  at: string;
}

interface User { id: string; display_name: string; email: string; role: string }

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<AuditRow['action'], string> = {
  INSERT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-amber-100 text-amber-700 border-amber-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
};

const TABLE_OPTIONS = [
  { value: '', label: 'All tables' },
  { value: 'batches', label: 'batches' },
  { value: 'movements', label: 'movements' },
  { value: 'sales', label: 'sales' },
  { value: 'users', label: 'users' },
  { value: 'skus', label: 'skus' },
  { value: 'vendors', label: 'vendors' },
  { value: 'locations', label: 'locations' },
  { value: 'price_history', label: 'price_history' },
];

export default function AuditLog() {
  const { user } = useSession();
  const [tableName, setTableName] = useState('');
  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset to page 0 whenever filters change
  function resetOnFilterChange() { setPage(0); }

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, role')
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as User[];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit-log', { tableName, userId, fromDate, toDate, page }],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('id, table_name, action, row_id, user_id, before_json, after_json, at')
        .order('at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (tableName) q = q.eq('table_name', tableName);
      if (userId) q = q.eq('user_id', userId);
      if (fromDate) q = q.gte('at', `${fromDate}T00:00:00`);
      if (toDate) q = q.lte('at', `${toDate}T23:59:59`);
      const { data, error, count } = await q;
      if (error) {
        setError(error.message);
        return { rows: [] as AuditRow[], count: 0 };
      }
      setError(null);
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const hasNextPage = rows.length === PAGE_SIZE;

  function userName(id: string | null) {
    if (!id) return '—';
    const u = users?.find((u) => u.id === id);
    return u ? `${u.display_name} (${u.role})` : id.slice(0, 8);
  }

  function onReset() {
    setTableName(''); setUserId(''); setFromDate(''); setToDate(''); setPage(0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Audit log</h2>
          <p className="text-sm text-slate-500 mt-1">
            Every INSERT, UPDATE, DELETE on the public tables. Append-only; written by trigger only.
            RLS allows admin to read; everyone else is denied silently.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          Signed in as <code className="text-xs">{user?.email ?? formatPhone(user?.phone ?? null)}</code>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FormField id="filter-table" label="Table">
            <select
              id="filter-table"
              value={tableName}
              onChange={(e) => { setTableName(e.target.value); resetOnFilterChange(); }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {TABLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField id="filter-user" label="User">
            <select
              id="filter-user"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); resetOnFilterChange(); }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">All users</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
              ))}
            </select>
          </FormField>
          <FormField id="filter-from" label="From (date)">
            <input
              id="filter-from"
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); resetOnFilterChange(); }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </FormField>
          <FormField id="filter-to" label="To (date)">
            <input
              id="filter-to"
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); resetOnFilterChange(); }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </FormField>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Reset filters
          </button>
        </div>
      </div>

      <FormError message={error} />

      {/* Results */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500 text-center">No audit rows match the filters.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium">When</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Action</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Table</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Row</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">User</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(r.at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ACTION_STYLES[r.action]}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-800 font-mono text-xs">{r.table_name}</td>
                    <td className="px-4 py-2 text-slate-500 font-mono text-xs">{r.row_id.slice(0, 8)}</td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{userName(r.user_id)}</td>
                    <td className="px-4 py-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {expandedRow === r.id ? 'hide' : 'show'}
                      </button>
                    </td>
                  </tr>
                  {expandedRow === r.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-slate-50">
                        <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
                          {r.action === 'INSERT' && JSON.stringify(r.after_json, null, 2)}
                          {r.action === 'UPDATE' && `BEFORE:\n${JSON.stringify(r.before_json, null, 2)}\n\nAFTER:\n${JSON.stringify(r.after_json, null, 2)}`}
                          {r.action === 'DELETE' && JSON.stringify(r.before_json, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-slate-500">
          Page {page + 1} · showing {rows.length} row{rows.length === 1 ? '' : 's'}
          {isFetching && <span className="ml-2 text-slate-500">refreshing…</span>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}
