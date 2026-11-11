// SkuManagement — admin-only SKU catalog: list, add, edit. Built directly in response to real
// client feedback (a phone call, 2026-09-11): "I'm not able to edit or modify SKUs... if I add
// a new SKU, how can I add?" The skus table has always allowed admin insert/update at the RLS
// level; no frontend for it ever existed. This is that frontend.
//
// Deliberately simple, per the same call ("simple, basic interface... they don't study even
// eighth or ninth"): the add/edit form asks for only 5 fields up front (name, Tamil name,
// type, size, sold-by unit); shelf life, storage, low-stock warning, and notes are defaulted
// sensibly and tucked behind a collapsed "More settings," not forced on every user. `code` (the
// database's unique identifier) is auto-generated from the name + size and never typed by
// hand — asking a non-technical user to invent a unique code themselves is exactly the kind of
// friction this screen exists to remove.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface Sku {
  id: string;
  code: string;
  english_name: string;
  tamil_name: string;
  category: string;
  size_grade: string;
  unit: string;
  shelf_life_hours: number;
  storage_type: string;
  low_stock_threshold_kg: number;
  active: boolean;
  notes: string | null;
}

const CATEGORY_OPTIONS = [
  { value: 'fin_fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'crustacean', label: 'Crab / Prawn' },
  { value: 'cephalopod', label: 'Squid / Octopus' },
  { value: 'dried', label: 'Dried' },
];
const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
  { value: 'mixed', label: 'Mixed sizes' },
];
const UNIT_OPTIONS = [
  { value: 'kg', label: 'By weight (kg)' },
  { value: 'piece', label: 'By piece' },
  { value: 'dozen', label: 'By dozen' },
];
const STORAGE_OPTIONS = [
  { value: 'chilled', label: 'Chilled (with ice)' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'ambient', label: 'Room temperature' },
];

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function slugCode(englishName: string, sizeGrade: string): string {
  const base = englishName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'SKU'}-${sizeGrade.slice(0, 3).toUpperCase()}`;
}

const selectCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function SkuManagement() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Sku | 'new' | null>(null);

  const { data: skus, isLoading } = useQuery({
    // Scoped key, per decision #34's lesson — this page's own consumer, not shared with
    // SkuSelect's bare ['skus'] or the dashboards' ['skus', '<page>'] keys.
    queryKey: ['skus', 'management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, code, english_name, tamil_name, category, size_grade, unit, shelf_life_hours, storage_type, low_stock_threshold_kg, active, notes')
        .order('active', { ascending: false })
        .order('english_name');
      if (error) throw error;
      return (data ?? []) as Sku[];
    },
  });

  if (editing) {
    return (
      <SkuForm
        sku={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['skus'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Fish types</h2>
          <p className="text-sm text-slate-500 mt-1">Add a new fish type, or tap one to edit it.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
        >
          + Add new fish type
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {skus?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setEditing(s)}
            className={`w-full text-left rounded-lg border p-4 hover:bg-slate-50 ${s.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">
                  {s.english_name}
                  {s.tamil_name && <span className="text-slate-500 font-normal"> · {s.tamil_name}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {labelFor(CATEGORY_OPTIONS, s.category)} · {labelFor(SIZE_OPTIONS, s.size_grade)}
                  {!s.active && ' · Inactive'}
                </div>
              </div>
              <span className="text-indigo-600 text-sm font-medium shrink-0">Edit →</span>
            </div>
          </button>
        ))}
        {skus?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">
            No fish types yet. Tap "+ Add new fish type" to add the first one.
          </div>
        )}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function SkuForm({ sku, onDone, onCancel }: { sku: Sku | null; onDone: () => void; onCancel: () => void }) {
  const isNew = sku === null;
  const [englishName, setEnglishName] = useState(sku?.english_name ?? '');
  const [tamilName, setTamilName] = useState(sku?.tamil_name ?? '');
  const [category, setCategory] = useState(sku?.category ?? 'fin_fish');
  const [sizeGrade, setSizeGrade] = useState(sku?.size_grade ?? 'medium');
  const [unit, setUnit] = useState(sku?.unit ?? 'kg');
  const [shelfLifeHours, setShelfLifeHours] = useState(String(sku?.shelf_life_hours ?? 24));
  const [storageType, setStorageType] = useState(sku?.storage_type ?? 'chilled');
  const [lowStockThreshold, setLowStockThreshold] = useState(String(sku?.low_stock_threshold_kg ?? 5));
  const [notes, setNotes] = useState(sku?.notes ?? '');
  const [active, setActive] = useState(sku?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      english_name: englishName.trim(),
      tamil_name: tamilName.trim(),
      category,
      size_grade: sizeGrade,
      unit,
      shelf_life_hours: Number(shelfLifeHours) || 24,
      storage_type: storageType,
      low_stock_threshold_kg: Number(lowStockThreshold) || 5,
      notes: notes.trim() || null,
      active,
    };

    if (isNew) {
      // code is auto-generated, never typed by hand. Retry with a numeric suffix on the rare
      // unique-constraint collision (e.g. two different-category fish that slug to the same
      // base name + size) rather than asking the user to pick a unique code themselves.
      const baseCode = slugCode(englishName, sizeGrade);
      let saved = false;
      let lastMessage = '';
      for (let attempt = 0; attempt <= 5 && !saved; attempt++) {
        const tryCode = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
        const { error: insertErr } = await supabase.from('skus').insert({ ...payload, code: tryCode });
        if (!insertErr) { saved = true; break; }
        lastMessage = insertErr.message;
        if (insertErr.code !== '23505') break; // only retry on a real unique-violation
      }
      setSubmitting(false);
      if (!saved) { setError(`Could not save: ${lastMessage}`); return; }
      setSuccess(`${englishName} added.`);
      setTimeout(onDone, 600);
    } else {
      const { error: updateErr } = await supabase.from('skus').update(payload).eq('id', sku.id);
      setSubmitting(false);
      if (updateErr) { setError(`Could not save: ${updateErr.message}`); return; }
      setSuccess(`${englishName} updated.`);
      setTimeout(onDone, 600);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">
        {isNew ? 'Add new fish type' : `Edit ${sku.english_name}`}
      </h2>

      <FormField id="english-name" label="Name" required>
        <TextInput id="english-name" label="" value={englishName} onChange={setEnglishName} required placeholder="e.g. Pomfret" />
      </FormField>

      <FormField id="tamil-name" label="Tamil name (optional)">
        <TextInput id="tamil-name" label="" value={tamilName} onChange={setTamilName} placeholder="e.g. வாவல்" />
      </FormField>

      <FormField id="category" label="Type" required>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} required className={selectCls}>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      <FormField id="size" label="Size" required>
        <select id="size" value={sizeGrade} onChange={(e) => setSizeGrade(e.target.value)} required className={selectCls}>
          {SIZE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      <FormField id="unit" label="Sold by" required>
        <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} required className={selectCls}>
          {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FormField>

      {!isNew && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
          Active (uncheck to hide this fish type from new deliveries/sales without deleting its history)
        </label>
      )}

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="text-sm font-medium text-slate-700 cursor-pointer">More settings (optional)</summary>
        <div className="mt-3 space-y-3">
          <FormField id="shelf-life" label="Shelf life (hours)">
            <TextInput id="shelf-life" label="" type="number" value={shelfLifeHours} onChange={setShelfLifeHours} min="1" step="1" />
          </FormField>
          <FormField id="storage" label="Storage">
            <select id="storage" value={storageType} onChange={(e) => setStorageType(e.target.value)} className={selectCls}>
              {STORAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField id="low-stock" label="Low stock warning (kg)">
            <TextInput id="low-stock" label="" type="number" value={lowStockThreshold} onChange={setLowStockThreshold} min="0" step="0.01" />
          </FormField>
          <FormField id="notes" label="Notes">
            <TextInput id="notes" label="" value={notes} onChange={setNotes} />
          </FormField>
        </div>
      </details>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !englishName.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : isNew ? 'Add fish type' : 'Save changes'}
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
