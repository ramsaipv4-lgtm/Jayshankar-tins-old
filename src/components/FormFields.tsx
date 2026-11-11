// FormFields — shared form inputs for the 4 mutation forms. Native HTML
// elements, no react-hook-form (decision 20: keeps the dep count down for 4 forms).
// Tailwind classes are the same as the SignInForm for visual consistency.

import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const inputCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export function SkuSelect({ value, onChange, required = true, id }: { value: string; onChange: (id: string) => void; required?: boolean; id?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase.from('skus').select('id, code, english_name, tamil_name').order('english_name');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading SKUs…' : 'Select a SKU'}</option>
      {data?.map((s) => (
        <option key={s.id} value={s.id}>
          {s.english_name} ({s.code})
        </option>
      ))}
    </select>
  );
}

// 'in_transit_inbound'/'in_transit_outbound' (migration 0031) are excluded by default -- every
// existing operation (deliver, sell, pack, repack, transfer) targets a real place to put or take
// stock from, not the travel legs themselves. Only the confirm-arrival/checkout screens that
// actually operate on transit stock should pass includeTransit -- not built yet, pending two
// business-policy answers (see BUILDER-DECISIONS-REVIEW.md decision #80).
export function LocationSelect({ value, onChange, required = true, excludeId, id, includeTransit = false }: { value: string; onChange: (id: string) => void; required?: boolean; excludeId?: string; id?: string; includeTransit?: boolean }) {
  const { data, isLoading } = useQuery({
    // Distinct key -- see the identical fix + full explanation in AdminDashboard.tsx (decision
    // #34): this query's select shape (adds `kind`, needed for the transit filter below) must
    // not share a cache entry with the other ['locations'] queries elsewhere (RecentActivity,
    // StockBySku, AdminDashboard, FloorDashboard) that select a narrower shape -- whichever
    // query populates the shared cache key first would silently determine what the other gets.
    queryKey: ['locations', 'form-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name, display_name, kind').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  let filtered = data ?? [];
  if (!includeTransit) filtered = filtered.filter((l) => l.kind !== 'in_transit_inbound' && l.kind !== 'in_transit_outbound');
  if (excludeId) filtered = filtered.filter((l) => l.id !== excludeId);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading…' : 'Select a location'}</option>
      {filtered.map((l) => (
        <option key={l.id} value={l.id}>
          {l.display_name ?? l.name}
        </option>
      ))}
    </select>
  );
}

export function VendorSelect({ value, onChange, required = true, id }: { value: string; onChange: (id: string) => void; required?: boolean; id?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading vendors…' : 'Select a vendor'}</option>
      {data?.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}

// CustomerSelect — optional by design (V1 sprint): a sale doesn't require a formal customer
// record (D25's "incomplete data warns, never blocks" philosophy) -- this lets a rep link a
// sale to a real customers row when one exists, without forcing every one-off/walk-in buyer to
// be registered first. Scoped query key per decision #34's discipline.
export function CustomerSelect({ value, onChange, id }: { value: string; onChange: (id: string) => void; id?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('id, name, business_name').eq('active', true).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading…' : '— One-off buyer, not in customer list —'}</option>
      {data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}{c.business_name ? ` (${c.business_name})` : ''}
        </option>
      ))}
    </select>
  );
}

// Format an ISO timestamp as a short, readable string for <option> labels.
// Example output: "Sep 12, 2:30 PM". Returns "—" for null/empty.
function formatExpiresShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface SourceFillRow {
  id: string;
  kg_remaining: number;
  expires_at: string | null;
  containers: { container_number: string } | null;
}

// SourceFillSelect — a select of container_fills that are valid repack
// SOURCES (kg_remaining > 0), smallest-remaining first. Joins to containers
// for the readable container_number label. Scoped query key per decision #34
// to avoid colliding with any other consumer of container_fills data.
export function SourceFillSelect({ value, onChange, required = true, id }: { value: string; onChange: (id: string) => void; required?: boolean; id?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['container-fills', 'repack-source'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('container_fills')
        .select('id, kg_remaining, expires_at, containers(container_number)')
        .gt('kg_remaining', 0)
        .order('kg_remaining', { ascending: true });
      if (error) throw error;
      // Supabase JS types the embedded `containers(...)` select as an array of
      // objects, because the generic PostgREST client can't tell at compile
      // time that container_fills → containers is a many-to-one. The actual
      // wire shape is a single object (or null) per row, which SourceFillRow
      // declares. Cast through `unknown` to bridge the two without `as any`.
      return (data ?? []) as unknown as SourceFillRow[];
    },
  });
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading…' : 'Select a fill to repack'}</option>
      {data?.map((f) => {
        const num = f.containers?.container_number ?? '?';
        return (
          <option key={f.id} value={f.id}>
            {`${num} — ${f.kg_remaining.toFixed(3)} kg, expires ${formatExpiresShort(f.expires_at)}`}
          </option>
        );
      })}
    </select>
  );
}

interface AvailableContainerRow {
  container_id: string;
  container_number: string;
  capacity_kg: number;
}

// AvailableContainerSelect — a select of containers that the
// container_availability view (migration 0006) reports as `available = true`,
// i.e. no active fill on them. Uses the view rather than re-deriving
// availability client-side (SPEC D17: availability is derived, not stored).
// Scoped query key per decision #34.
export function AvailableContainerSelect({ value, onChange, required = true, id }: { value: string; onChange: (id: string) => void; required?: boolean; id?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['containers', 'repack-destination'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('container_availability')
        .select('container_id, container_number, capacity_kg')
        .eq('available', true);
      if (error) throw error;
      return (data ?? []) as AvailableContainerRow[];
    },
  });
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    >
      <option value="">{isLoading ? 'Loading…' : 'Select a destination container'}</option>
      {data?.map((c) => (
        <option key={c.container_id} value={c.container_id}>
          {`${c.container_number} (${c.capacity_kg}kg capacity)`}
        </option>
      ))}
    </select>
  );
}

export function TextInput({ id, label, type = 'text', value, onChange, required, step, min, max, autoComplete, placeholder }: {
  id: string;
  label: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  required?: boolean;
  step?: string;
  min?: string | number;
  max?: string | number;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={step}
        min={min}
        max={max}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={inputCls}
      />
    </>
  );
}

// FormField — a labelled wrapper. The id is wired to the label's htmlFor so
// screen readers associate the label with the child control; the form author
// passes `id={id}` to the child explicitly (each of our Selects accepts an `id`).
export function FormField({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
      {message}
    </div>
  );
}

// FormFooter — a back-to-dashboard link, shown under every form. Avoids the
// "I just submitted a delivery, now where do I go?" trap that bit W3 (decision 23).
// The form author passes the destination URL; usually the user's role-based home.
export function FormFooter({ backHref, backLabel }: { backHref: string; backLabel?: string }) {
  return (
    <div className="pt-2 border-t border-slate-200">
      <Link
        to={backHref}
        className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        ← {backLabel ?? 'Back to dashboard'}
      </Link>
    </div>
  );
}
