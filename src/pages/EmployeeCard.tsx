// EmployeeCard — search result detail for an employee: contact info, role, and an activity
// summary (deliveries/sales/transfers/spoilage/repacks they've recorded, reversal requests
// they've filed) — all derivable from existing movements/sales/reversal_requests data via
// created_by/sold_by/requested_by, no new schema.
//
// Deliberately NOT here yet: check-ins/hours worked, delegated tasks, task performance ratings.
// The user asked for these (activity-tracking scope, not full payroll — see
// BUILDER-DECISIONS-REVIEW.md decision #65's own scope note) but they need genuinely new
// schema (attendance, task delegation, ratings) that wasn't built in this pass — flagged here
// honestly rather than silently left out with no note.

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { FormFooter } from '../components/FormFields';
import RoleBadge from '../components/RoleBadge';
import { Role } from '../lib/auth';

interface EmployeeRow {
  id: string; display_name: string; email: string | null; phone: string | null; role: Role; active: boolean;
}

const KIND_LABEL: Record<string, string> = {
  delivery_in: 'Deliveries received',
  sale: 'Sales recorded',
  transfer: 'Transfers recorded',
  spoilage: 'Spoilage recorded',
  repack: 'Repacks recorded',
  reversal: 'Reversals executed',
};

export default function EmployeeCard() {
  const { userId } = useParams<{ userId: string }>();

  const { data: employee } = useQuery({
    queryKey: ['employee-card', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, phone, role, active')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data as EmployeeRow;
    },
  });

  const { data: movementCounts } = useQuery({
    queryKey: ['employee-card-movements', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('movements').select('kind').eq('created_by', userId);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const m of data ?? []) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
      return counts;
    },
  });

  const { data: salesCount } = useQuery({
    queryKey: ['employee-card-sales', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase.from('sales').select('*', { count: 'exact', head: true }).eq('sold_by', userId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: reversalCount } = useQuery({
    queryKey: ['employee-card-reversals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase.from('reversal_requests').select('*', { count: 'exact', head: true }).eq('requested_by', userId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{employee?.display_name ?? 'Loading…'}</h2>
          {employee && (
            <p className="text-sm text-slate-500 mt-1">
              {employee.email ?? employee.phone ?? 'No contact on file'}
              {!employee.active && ' · Inactive'}
            </p>
          )}
        </div>
        {employee && <RoleBadge role={employee.role} />}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Activity recorded</h3>
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-slate-800">{KIND_LABEL.sale}</span>
            <span className="text-slate-500 tabular-nums">{salesCount ?? 0}</span>
          </div>
          {Object.entries(KIND_LABEL).filter(([kind]) => kind !== 'sale').map(([kind, label]) => (
            <div key={kind} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-slate-800">{label}</span>
              <span className="text-slate-500 tabular-nums">{movementCounts?.get(kind) ?? 0}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-slate-800">Reversal requests filed</span>
            <span className="text-slate-500 tabular-nums">{reversalCount ?? 0}</span>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Check-ins, hours worked, delegated tasks, and task ratings aren't built yet — they need
        new schema beyond this pass. This card shows what's already derivable from existing
        records.
      </div>

      <FormFooter backHref="/search" backLabel="Back to search" />
    </div>
  );
}
