// WarehouseManagement — admin-only warehouse list + add/edit. Same gap class as SkuManagement
// (decision #49): the backend has allowed admin/co-admin to create warehouses since migration
// 0006 (D23), but no frontend for it ever existed — today there's exactly one warehouse row
// ('main'), seeded directly by that migration, and no way to add a second one without a raw SQL
// insert. Needed before a real second-warehouse rollout (D29/D23) can ever actually happen.
//
// Same simplicity discipline as SkuManagement: one visible field (the warehouse's name).
// `warehouses.name` (the internal, unique identifier `current_user_role()`-adjacent code
// references by) is auto-derived from what the admin types, the same way SKU's `code` is —
// never typed by hand, never a second field asking "what's the difference between name and
// display name?"

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface Warehouse {
  id: string;
  name: string;
  display_name: string;
  active: boolean;
}

function slugName(displayName: string): string {
  const slug = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'warehouse';
}

export default function WarehouseManagement() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses', 'management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, display_name, active')
        .order('active', { ascending: false })
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as Warehouse[];
    },
  });

  if (editing) {
    return (
      <WarehouseForm
        warehouse={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['warehouses'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Warehouses</h2>
          <p className="text-sm text-slate-500 mt-1">Add a new warehouse, or tap one to rename it.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
        >
          + Add warehouse
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {warehouses?.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setEditing(w)}
            className={`w-full text-left rounded-lg border p-4 hover:bg-slate-50 ${w.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">{w.display_name}</div>
                {!w.active && <div className="text-xs text-slate-500 mt-0.5">Inactive</div>}
              </div>
              <span className="text-indigo-600 text-sm font-medium shrink-0">Edit →</span>
            </div>
          </button>
        ))}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function WarehouseForm({ warehouse, onDone, onCancel }: { warehouse: Warehouse | null; onDone: () => void; onCancel: () => void }) {
  const isNew = warehouse === null;
  const [displayName, setDisplayName] = useState(warehouse?.display_name ?? '');
  const [active, setActive] = useState(warehouse?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (isNew) {
      const baseName = slugName(displayName);
      let saved = false;
      let lastMessage = '';
      for (let attempt = 0; attempt <= 5 && !saved; attempt++) {
        const tryName = attempt === 0 ? baseName : `${baseName}-${attempt + 1}`;
        const { error: insertErr } = await supabase.from('warehouses').insert({ name: tryName, display_name: displayName.trim() });
        if (!insertErr) { saved = true; break; }
        lastMessage = insertErr.message;
        if (insertErr.code !== '23505') break;
      }
      setSubmitting(false);
      if (!saved) { setError(`Could not save: ${lastMessage}`); return; }
      setSuccess(`${displayName} added.`);
      setTimeout(onDone, 600);
    } else {
      const { error: updateErr } = await supabase
        .from('warehouses')
        .update({ display_name: displayName.trim(), active })
        .eq('id', warehouse.id);
      setSubmitting(false);
      if (updateErr) { setError(`Could not save: ${updateErr.message}`); return; }
      setSuccess(`${displayName} updated.`);
      setTimeout(onDone, 600);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">
        {isNew ? 'Add warehouse' : `Edit ${warehouse.display_name}`}
      </h2>

      <FormField id="display-name" label="Warehouse name" required>
        <TextInput id="display-name" label="" value={displayName} onChange={setDisplayName} required placeholder="e.g. North Warehouse" />
      </FormField>

      {!isNew && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
          Active (uncheck to retire this warehouse without deleting its history)
        </label>
      )}

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !displayName.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : isNew ? 'Add warehouse' : 'Save changes'}
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
