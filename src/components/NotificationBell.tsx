// NotificationBell — a personal inbox dropdown in the header. Started with the one concrete
// trigger SPEC.md §4.3.11 step 2 specifies (decision #63); extended with D27 Track A's event
// notifications (decision #68) — bill received, a sale pushing a customer over their credit
// limit. Each type carries its own destination now, not a single shared link, since the
// different event types are acted on in different screens.
//
// RLS-only, no RPC needed here: notifications_select_own/notifications_update_own (migration
// 0012) already scope everything to auth.uid() — this just reads and marks its own rows read.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/auth';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

// Human text + destination per type. New types just need an entry here — everything else
// (bell, badge, mark-read, dropdown) is generic.
const TYPE_INFO: Record<string, { text: (payload: Record<string, unknown> | null) => string; link: string }> = {
  reversal_requested: { text: () => 'A reversal request needs your review', link: '/reversals' },
  reversal_auto_approved: { text: () => 'A reversal was auto-approved (self-reverse)', link: '/reversals' },
  bill_received: {
    text: (p) => `New bill received${p?.vendor_name ? ` from ${p.vendor_name}` : ''}${p?.total_amount != null ? ` — ₹${Number(p.total_amount).toFixed(2)}` : ''}`,
    link: '/bills',
  },
  customer_over_limit: {
    text: (p) => `${p?.customer_name ?? 'A customer'} is now over their credit limit`,
    link: '/payments',
  },
  tasks_reassigned: {
    text: (p) => `${p?.count ?? 'Some'} open task${p?.count === 1 ? '' : 's'} moved off ${p?.from_display_name ?? 'someone'} (role changed to ${p?.new_role ?? '—'}${p?.new_active === false ? ', access off' : ''})`,
    link: '/admin/tasks',
  },
  delivery_discrepancy: {
    text: (p) => `Delivery from ${p?.vendor_name ?? 'a vendor'} didn't match the bill — promised ${p?.promised_kg ?? '?'}kg, got ${p?.confirmed_good_kg ?? '?'}kg good${p?.confirmed_spoiled_kg ? ` + ${p.confirmed_spoiled_kg}kg spoiled` : ''}${p?.sku_changed ? ' (fish type also differs)' : ''}`,
    link: '/bills',
  },
  task_completed: {
    text: (p) => `You completed: ${p?.title ?? p?.type ?? 'a task'}`,
    link: '/my-tasks',
  },
};

function describe(n: Notification): string {
  return TYPE_INFO[n.type]?.text(n.payload) ?? n.type;
}

function linkFor(n: Notification): string {
  return TYPE_INFO[n.type]?.link ?? '/admin';
}

export default function NotificationBell() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, payload, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function markAllRead() {
    const unreadIds = notifications?.filter((n) => !n.read_at).map((n) => n.id) ?? [];
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative rounded-md p-2 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away layer — plain and unstyled, just closes the panel. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">Notifications</span>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {notifications?.map((n) => (
                <Link
                  key={n.id}
                  to={linkFor(n)}
                  onClick={() => { setOpen(false); if (!n.read_at) markRead(n.id); }}
                  className={`block px-3 py-2.5 text-sm hover:bg-slate-50 ${n.read_at ? 'text-slate-500' : 'text-slate-800 bg-indigo-50/40'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />}
                    <div>
                      <div>{describe(n)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {notifications?.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-slate-500">Nothing yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
    </svg>
  );
}
