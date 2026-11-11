// RoleBadge — the role colour key from SPEC §3.5, extended for co-admin (D28):
// admin → indigo, co-admin → violet (same admin tier, visually distinct from admin),
// vendor-rep → emerald, worker → slate, super-worker → slate.

import { Role } from '../lib/auth';

const STYLES: Record<Role, string> = {
  admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'co-admin': 'bg-violet-100 text-violet-700 border-violet-200',
  'vendor-rep': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  worker: 'bg-slate-100 text-slate-700 border-slate-200',
  'super-worker': 'bg-slate-100 text-slate-700 border-slate-200',
};

// Friendlier-than-the-database labels, per the user's own request — describe what the role
// DOES, not its backend name. The backend strings ('vendor-rep', 'worker', 'super-worker')
// stay exactly as-is everywhere else (RPC role checks, RLS policies, task eligibility) — this
// is presentation only. Exported so every place a role name renders (TeamManagement.tsx's own
// role picker included) shares one source instead of drifting into its own copy.
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  'co-admin': 'Co-admin',
  'vendor-rep': 'Receiving & sales',
  worker: 'Floor staff',
  'super-worker': 'Senior floor staff',
};
const LABELS = ROLE_LABELS;

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[role]}`}
    >
      {LABELS[role]}
    </span>
  );
}
