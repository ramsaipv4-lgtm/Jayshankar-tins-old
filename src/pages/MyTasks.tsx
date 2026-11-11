// MyTasks — an operational-role employee's own task list. No "mark complete" button for
// receive_delivery/make_sale/pack_repack tasks — those complete themselves the moment the
// underlying action happens (auto_complete_task, migration 0024), so this screen just shows
// what's open and points at the form that will close it. Only 'custom' tasks (no underlying
// action to hook into) get a manual Start/Complete control here.

import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';
import { describeTask, TaskRow, useMyTasks } from '../lib/tasks';
import { FormFooter } from '../components/FormFields';

const COMPLETION_HINT: Record<string, { text: string; href: string; label: string }> = {
  receive_delivery: { text: 'Completes automatically when you record the delivery.', href: '/deliver', label: 'Go to + Delivery' },
  make_sale: { text: 'Completes automatically when you record the sale.', href: '/sell', label: 'Go to + Sale' },
  pack_repack: { text: 'Completes automatically when you pack or repack a container.', href: '/pack', label: 'Go to Pack container' },
};

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function MyTasks() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: tasks, isLoading } = useMyTasks(user?.id);
  const backHref = user?.role === 'vendor-rep' ? '/rep' : '/floor';

  const open = tasks?.filter((t) => t.status === 'pending' || t.status === 'in_progress') ?? [];
  const done = tasks?.filter((t) => t.status === 'completed' || t.status === 'cancelled').slice(0, 15) ?? [];
  // A rough, honest signal, not a precise split (decision #70): how many OTHER open tasks
  // existed at the same time as this one — shown as context next to duration, never blended
  // into a single fabricated "effort" number.
  const concurrentCount = (t: TaskRow) => open.filter((o) => o.id !== t.id).length;

  async function updateStatus(taskId: string, patch: Record<string, unknown>) {
    await supabase.from('tasks').update(patch).eq('id', taskId);
    qc.invalidateQueries({ queryKey: ['tasks', 'mine'] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">My tasks</h2>
        <p className="text-sm text-slate-500 mt-1">What's been delegated to you.</p>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">To do ({open.length})</h3>
        {open.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-800">{describeTask(t)}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Assigned {new Date(t.assigned_at).toLocaleString()}
                  {concurrentCount(t) > 0 && ` · ${concurrentCount(t)} other task${concurrentCount(t) === 1 ? '' : 's'} also open`}
                  {t.notes && ` · ${t.notes}`}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${t.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {t.status === 'in_progress' ? 'In progress' : 'To do'}
              </span>
            </div>

            {t.type === 'custom' ? (
              <div className="flex gap-2 mt-3">
                {t.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => updateStatus(t.id, { status: 'in_progress', started_at: new Date().toISOString() })}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Start
                  </button>
                )}
                {t.status === 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => updateStatus(t.id, { status: 'completed', completed_at: new Date().toISOString() })}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Mark complete
                  </button>
                )}
              </div>
            ) : (
              COMPLETION_HINT[t.type] && (
                <div className="mt-3 text-xs text-slate-500">
                  {COMPLETION_HINT[t.type].text}{' '}
                  <Link to={COMPLETION_HINT[t.type].href} className="text-indigo-600 hover:text-indigo-800 font-medium">
                    {COMPLETION_HINT[t.type].label} →
                  </Link>
                </div>
              )
            )}
          </div>
        ))}
        {open.length === 0 && !isLoading && (
          <div className="text-sm text-slate-500 text-center py-8">Nothing pending — you're caught up.</div>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Recently completed</h3>
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {done.map((t) => (
              <div key={t.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-800">{describeTask(t)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${t.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                    {t.status === 'cancelled' ? 'Cancelled' : 'Done'}
                  </span>
                </div>
                {t.completed_at && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Took {formatDuration(t.assigned_at, t.completed_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <FormFooter backHref={backHref} backLabel="Back to dashboard" />
    </div>
  );
}
