// VendorManagement — admin-only vendor (fisherman) list: add, edit. A real gap found in a
// systematic frontend/backend parity audit, not a report: `vendors_insert_admin`/
// `vendors_update_admin` RLS policies have existed since migration 0001, but no frontend for
// either ever existed anywhere — `VendorSelect` (FormFields.tsx) is a pure read-only dropdown.
// There was, until now, no way to onboard a new vendor through the app at all.
//
// Same simplicity discipline as SkuManagement.tsx/WarehouseManagement.tsx (the two gaps of this
// exact same shape found and closed earlier this sprint, decision #49): name + phone up front,
// everything else (port/village, boat name, typical catch, reliability, notes) behind a
// collapsed "More settings" — a vendor can be added with just a name in a few seconds.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormError, FormField, FormFooter, FormSuccess, TextInput } from '../components/FormFields';

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  port_or_village: string | null;
  boat_name: string | null;
  typical_catch: string | null;
  reliability: number;
  active: boolean;
  notes: string | null;
}

const selectCls = 'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600';

export default function VendorManagement() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null);

  const { data: vendors, isLoading } = useQuery({
    // Distinct key from AdminDashboard.tsx's own narrower ['vendors'] read -- decision #34's
    // lesson, applied up front this time instead of found after the fact.
    queryKey: ['vendors', 'management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, phone, port_or_village, boat_name, typical_catch, reliability, active, notes')
        .order('active', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as Vendor[];
    },
  });

  if (editing) {
    return (
      <VendorForm
        vendor={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['vendors'] }); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Vendors</h2>
          <p className="text-sm text-slate-500 mt-1">Add a new vendor, or tap one to edit it.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
        >
          + Add vendor
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <div className="space-y-2">
        {vendors?.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setEditing(v)}
            className={`w-full text-left rounded-lg border p-4 hover:bg-slate-50 ${v.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800 font-medium">{v.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {v.phone ?? 'No phone'}
                  {v.port_or_village && ` · ${v.port_or_village}`}
                  {!v.active && ' · Inactive'}
                </div>
              </div>
              <span className="text-indigo-600 text-sm font-medium shrink-0">Edit →</span>
            </div>
          </button>
        ))}
        {vendors?.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">
            No vendors yet. Tap "+ Add vendor" to add the first one.
          </div>
        )}
      </div>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}

function VendorForm({ vendor, onDone, onCancel }: { vendor: Vendor | null; onDone: () => void; onCancel: () => void }) {
  const isNew = vendor === null;
  const [name, setName] = useState(vendor?.name ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [portOrVillage, setPortOrVillage] = useState(vendor?.port_or_village ?? '');
  const [boatName, setBoatName] = useState(vendor?.boat_name ?? '');
  const [typicalCatch, setTypicalCatch] = useState(vendor?.typical_catch ?? '');
  const [reliability, setReliability] = useState(String(vendor?.reliability ?? 3));
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [active, setActive] = useState(vendor?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      port_or_village: portOrVillage.trim() || null,
      boat_name: boatName.trim() || null,
      typical_catch: typicalCatch.trim() || null,
      reliability: Number(reliability) || 3,
      notes: notes.trim() || null,
      active,
    };

    if (isNew) {
      const { error: insertErr } = await supabase.from('vendors').insert(payload);
      setSubmitting(false);
      if (insertErr) { setError(`Could not save: ${insertErr.message}`); return; }
      setSuccess(`${name} added.`);
      setTimeout(onDone, 600);
    } else {
      const { error: updateErr } = await supabase.from('vendors').update(payload).eq('id', vendor.id);
      setSubmitting(false);
      if (updateErr) { setError(`Could not save: ${updateErr.message}`); return; }
      setSuccess(`${name} updated.`);
      setTimeout(onDone, 600);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">
        {isNew ? 'Add vendor' : `Edit ${vendor.name}`}
      </h2>

      <FormField id="vendor-name" label="Name" required>
        <TextInput id="vendor-name" label="" value={name} onChange={setName} required placeholder="e.g. Murugan" />
      </FormField>

      <FormField id="vendor-phone" label="Phone (optional)">
        <TextInput id="vendor-phone" label="" type="tel" value={phone} onChange={setPhone} placeholder="e.g. 9876543210" />
      </FormField>

      {!isNew && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-slate-300" />
          Active (uncheck to hide this vendor from new deliveries without deleting its history)
        </label>
      )}

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="text-sm font-medium text-slate-700 cursor-pointer">More settings (optional)</summary>
        <div className="mt-3 space-y-3">
          <FormField id="vendor-port" label="Port or village">
            <TextInput id="vendor-port" label="" value={portOrVillage} onChange={setPortOrVillage} />
          </FormField>
          <FormField id="vendor-boat" label="Boat name">
            <TextInput id="vendor-boat" label="" value={boatName} onChange={setBoatName} />
          </FormField>
          <FormField id="vendor-catch" label="Typical catch">
            <TextInput id="vendor-catch" label="" value={typicalCatch} onChange={setTypicalCatch} placeholder="e.g. Seer fish, crab" />
          </FormField>
          <FormField id="vendor-reliability" label="Reliability">
            <select id="vendor-reliability" value={reliability} onChange={(e) => setReliability(e.target.value)} className={selectCls}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? '(least reliable)' : n === 5 ? '(most reliable)' : ''}</option>)}
            </select>
          </FormField>
          <FormField id="vendor-notes" label="Notes">
            <TextInput id="vendor-notes" label="" value={notes} onChange={setNotes} />
          </FormField>
        </div>
      </details>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving…' : isNew ? 'Add vendor' : 'Save changes'}
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
