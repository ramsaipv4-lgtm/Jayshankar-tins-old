// Search — the entry point for the search feature: one box, fuzzy-matches fish (English/
// Tamil/Tanglish), customers, vendors, and employees by name, and phone numbers by exact
// digit-substring. Results link to a "card" per kind (FishCard/CustomerCard/VendorCard/
// EmployeeCard) — real routes, not local-state toggles, so the Android hardware back button
// (App.tsx's own history-based wiring) works correctly stepping back out of a card.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSearchIndex, buildFuse, runSearch, SearchResultKind } from '../lib/search';
import { FormFooter } from '../components/FormFields';

const KIND_LABEL: Record<SearchResultKind, string> = {
  fish: 'Fish',
  customer: 'Customer',
  vendor: 'Vendor',
  employee: 'Employee',
};

const KIND_STYLE: Record<SearchResultKind, string> = {
  fish: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  customer: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  vendor: 'bg-amber-100 text-amber-700 border-amber-200',
  employee: 'bg-violet-100 text-violet-700 border-violet-200',
};

const KIND_ROUTE: Record<SearchResultKind, string> = {
  fish: '/search/fish',
  customer: '/search/customer',
  vendor: '/search/vendor',
  employee: '/search/employee',
};

export default function Search() {
  const [query, setQuery] = useState('');

  const { data: index, isLoading } = useQuery({
    queryKey: ['search-index'],
    queryFn: fetchSearchIndex,
    staleTime: 60_000,
  });

  const fuse = useMemo(() => buildFuse(index ?? []), [index]);
  const results = useMemo(() => runSearch(index ?? [], fuse, query), [index, fuse, query]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Search</h2>
        <p className="text-sm text-slate-500 mt-1">Fish name (English, Tamil, or Tanglish), or a customer/vendor/employee's name or phone number.</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isLoading ? 'Loading…' : 'e.g. vanjaram, or a phone number'}
        autoFocus
        className="block w-full rounded-md border border-slate-300 px-4 py-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
      />

      <div className="space-y-2">
        {query.trim() && results.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8">No matches for "{query.trim()}".</div>
        )}
        {results.map((r) => (
          <Link
            key={`${r.kind}-${r.id}`}
            to={`${KIND_ROUTE[r.kind]}/${r.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50"
          >
            <div>
              <div className="text-slate-800 font-medium">{r.title}</div>
              {r.subtitle && <div className="text-xs text-slate-500 mt-0.5">{r.subtitle}</div>}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${KIND_STYLE[r.kind]}`}>
              {KIND_LABEL[r.kind]}
            </span>
          </Link>
        ))}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to dashboard" />
    </div>
  );
}
