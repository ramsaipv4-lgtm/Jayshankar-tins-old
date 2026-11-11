// tasks.ts — shared constants/hooks for the check-in + task delegation feature (migration
// 0024/0025, BUILDER-DECISIONS-REVIEW.md decisions #70/#71).

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { AppUser, Role } from './auth';

export type TaskType = 'receive_delivery' | 'make_sale' | 'pack_repack' | 'custom';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  receive_delivery: 'Receive a delivery',
  make_sale: 'Make a sale',
  pack_repack: 'Pack / repack',
  custom: 'Custom',
};

// Client-side mirror of eligible_roles_for_task_type() (migration 0025) — used only to filter
// which employees the admin's picker OFFERS; the RPC is the real enforcement (this project's
// consistent "UI hides, the RPC enforces" pattern — see that migration's own comment for why a
// plain worker can't be handed a receive_delivery/make_sale task).
export const ELIGIBLE_ROLES_FOR_TASK_TYPE: Record<TaskType, Role[]> = {
  receive_delivery: ['vendor-rep', 'super-worker'],
  make_sale: ['vendor-rep', 'super-worker'],
  pack_repack: ['vendor-rep', 'worker', 'super-worker'],
  custom: ['vendor-rep', 'worker', 'super-worker'],
};

// The 3 roles that do field work and can hold tasks/check in at all — matches
// create_task_round_robin()'s own candidate pool before per-type filtering.
export const OPERATIONAL_ROLES: Role[] = ['vendor-rep', 'worker', 'super-worker'];

// useEnsureCheckedIn — calls ensure_checked_in() once per app load for an operational-role
// user. No manual button anywhere (decision #70) — this is the entire mechanism: the RPC itself
// is idempotent per calendar day (IST), so calling it more than once (route changes, refocus)
// is harmless, but a ref keeps it to one actual network call per mount regardless.
export function useEnsureCheckedIn(user: AppUser | null) {
  useEffect(() => {
    if (!user || !OPERATIONAL_ROLES.includes(user.role)) return;
    supabase.rpc('ensure_checked_in', {}).then(({ error }) => {
      if (error) {
        // Never block the app on this — check-in is a background signal, not a gate. Logged
        // for diagnosis, not surfaced to the person using the app.
        console.error('ensure_checked_in failed:', error.message);
      }
    });
  }, [user?.id, user?.role]);
}

export interface TaskRow {
  id: string;
  type: TaskType;
  title: string | null;
  status: TaskStatus;
  assigned_to: string;
  assigned_by: string | null;
  assignment_mode: 'manual' | 'round_robin';
  related_vendor_id: string | null;
  related_customer_id: string | null;
  related_bill_id: string | null;
  related_sale_id: string | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  vendors: { name: string } | null;
  customers: { name: string } | null;
}

const TASK_SELECT = 'id, type, title, status, assigned_to, assigned_by, assignment_mode, related_vendor_id, related_customer_id, related_bill_id, related_sale_id, assigned_at, started_at, completed_at, notes, vendors(name), customers(name)';

export function useMyTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'mine', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('assigned_to', userId)
        .order('assigned_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as TaskRow[];
    },
  });
}

// Describes a task in one line, for both the "my tasks" and admin delegation screens.
export function describeTask(t: TaskRow): string {
  if (t.type === 'custom') return t.title ?? 'Custom task';
  if (t.type === 'receive_delivery') return `Receive a delivery${t.vendors?.name ? ` from ${t.vendors.name}` : ''}`;
  if (t.type === 'make_sale') return `Make a sale${t.customers?.name ? ` to ${t.customers.name}` : ''}`;
  return TASK_TYPE_LABEL[t.type];
}
