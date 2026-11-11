// TaskDelegation — admin/co-admin delegates work: pick a type, then either auto-assign
// (round-robin, least-currently-loaded) or pick an employee by hand from a large-icon grid (the
// user's own framing). The grid only shows employees whose role can actually complete this task
// type (ELIGIBLE_ROLES_FOR_TASK_TYPE, lib/tasks.ts) — a client-side mirror of what the RPC
// itself enforces (migration 0025), so a role that can't finish a task never even shows up as
// pickable, rather than being offered and then rejected.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormError, FormField, FormFooter, FormSuccess, TextInput, VendorSelect, CustomerSelect } from '../components/FormFields';
import { describeTask, ELIGIBLE_ROLES_FOR_TASK_TYPE, OPERATIONAL_ROLES, TASK_TYPE_LABEL, TaskRow, TaskType } from '../lib/tasks';
import RoleBadge from '../components/RoleBadge';

interface EmployeeRow { id: string; display_name: string; role: (typeof OPERATIONAL_ROLES)[number] }

function useEligibleEmployees(type: TaskType) {
  return useQuery({
    queryKey: ['users', 'task-eligible', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, role')
        .eq('active', true)
        .in('role', ELIGIBLE_ROLES_FOR_TASK_TYPE[type])
        .order('display_name');
      if (error) throw error;
      return (data ?? []) as EmployeeRow[];
    },
  });
}

export default function TaskDelegation() {
  const qc = useQueryClient();
  const [type, setType] = useState<TaskType>('receive_delivery');
  const [vendorId, setVendorId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: eligible } = useEligibleEmployees(type);

  const { data: recent } = useQuery({
    queryKey: ['tasks', 'recent-delegations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, type, title, status, assignment_mode, assigned_at, vendors(name), customers(name), assignee:users!assigned_to(display_name)')
        .order('assigned_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as (TaskRow & { assignee: { display_name: string } | null })[];
    },
  });

  function resetForm() {
    setVendorId(''); setCustomerId(''); setTitle(''); setNotes('');
  }

  async function assignManually(employeeId: string) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcErr } = await supabase.rpc('create_task', {
      p_type: type,
      p_assigned_to: employeeId,
      p_title: type === 'custom' ? title.trim() : null,
      p_related_vendor_id: type === 'receive_delivery' ? (vendorId || null) : null,
      p_related_customer_id: type === 'make_sale' ? (customerId || null) : null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    const err = rpcErr?.message ?? data?.error ?? null;
    if (err) { setError(err); return; }
    setSuccess('Assigned.');
    resetForm();
    qc.invalidateQueries({ queryKey: ['tasks', 'recent-delegations'] });
  }

  async function assignRoundRobin() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcErr } = await supabase.rpc('create_task_round_robin', {
      p_type: type,
      p_title: type === 'custom' ? title.trim() : null,
      p_related_vendor_id: type === 'receive_delivery' ? (vendorId || null) : null,
      p_related_customer_id: type === 'make_sale' ? (customerId || null) : null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    const err = rpcErr?.message ?? data?.error ?? null;
    if (err) { setError(err); return; }
    const assignee = eligible?.find((e) => e.id === data?.assigned_to);
    setSuccess(`Auto-assigned to ${assignee?.display_name ?? 'an employee'}.`);
    resetForm();
    qc.invalidateQueries({ queryKey: ['tasks', 'recent-delegations'] });
  }

  // A real gap found in a systematic frontend/backend parity audit: tasks_update_own_or_admin
  // (RLS, migration 0024) has always let admin/co-admin update ANY task -- reassign, cancel,
  // edit -- but nothing anywhere ever exposed it beyond the automatic force-reassign trigger
  // (migration 0030). A plain client UPDATE is enough; no RPC needed, same as the "Access on"
  // toggle in TeamManagement.tsx.
  async function cancelTask(taskId: string) {
    await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId);
    qc.invalidateQueries({ queryKey: ['tasks', 'recent-delegations'] });
  }

  const needsExtra = type === 'receive_delivery' ? !vendorId : type === 'custom' ? !title.trim() : false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Delegate a task</h2>
        <p className="text-sm text-slate-500 mt-1">Pick a type, then auto-assign or choose someone yourself.</p>
      </div>

      <section className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); resetForm(); setError(null); setSuccess(null); }}
              className={`rounded-md px-3 py-2 text-sm font-medium ${type === t ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              {TASK_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {type === 'receive_delivery' && (
          <FormField id="task-vendor" label="Vendor (optional, but recommended)">
            <VendorSelect id="task-vendor" value={vendorId} onChange={setVendorId} required={false} />
          </FormField>
        )}
        {type === 'make_sale' && (
          <FormField id="task-customer" label="Customer (optional)">
            <CustomerSelect id="task-customer" value={customerId} onChange={setCustomerId} />
          </FormField>
        )}
        {type === 'custom' && (
          <FormField id="task-title" label="What needs doing" required>
            <TextInput id="task-title" label="" value={title} onChange={setTitle} required placeholder="e.g. Clean the storage shelves" />
          </FormField>
        )}
        <FormField id="task-notes" label="Notes (optional)">
          <TextInput id="task-notes" label="" value={notes} onChange={setNotes} />
        </FormField>

        <FormError message={error} />
        <FormSuccess message={success} />

        <button
          type="button"
          onClick={assignRoundRobin}
          disabled={submitting || needsExtra}
          className="rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? 'Assigning…' : 'Auto-assign (round robin)'}
        </button>

        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Or pick someone yourself</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {eligible?.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => assignManually(e.id)}
                disabled={submitting || needsExtra}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-lg font-semibold">
                  {e.display_name.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs text-slate-700 text-center leading-tight">{e.display_name}</span>
                <RoleBadge role={e.role} />
              </button>
            ))}
            {eligible?.length === 0 && (
              <div className="col-span-full text-sm text-slate-500 text-center py-4">
                No active employee can complete a "{TASK_TYPE_LABEL[type]}" task right now.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Recent delegations</h3>
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {recent?.map((t) => (
            <div key={t.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-slate-800">{describeTask(t)}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t.assignee?.display_name ?? '—'} · {t.assignment_mode === 'round_robin' ? 'auto-assigned' : 'picked manually'} · {new Date(t.assigned_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(t.status === 'pending' || t.status === 'in_progress') && (
                  <button
                    type="button"
                    onClick={() => cancelTask(t.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Cancel
                  </button>
                )}
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                  t.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : t.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : t.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : 'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {t.status === 'in_progress' ? 'In progress' : t.status === 'pending' ? 'To do' : t.status === 'cancelled' ? 'Cancelled' : 'Done'}
                </span>
              </div>
            </div>
          ))}
          {recent?.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No tasks delegated yet.</div>
          )}
        </div>
      </section>

      <FormFooter backHref="/admin" backLabel="Back to admin dashboard" />
    </div>
  );
}
