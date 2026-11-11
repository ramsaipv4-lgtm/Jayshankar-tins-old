// Layout — the shared shell for every signed-in screen.
//
// Phase A (Screen 1 of 12): rebuilt as the navy app bar from the client's locked reference
// (client-qa/developer-prompt-image/prompt-1.jpg) — a #0e2b5e bar with the JAYSHANKAR
// wordmark, and the signed-in user's real controls (notifications, role badge, sign out) on
// the right. A 3-column grid keeps the wordmark optically centred at every width without
// absolutely positioning it.
//
// W5: also renders the OfflineBanner so the user knows they're offline (SPEC §2.14 / §8.7a-c).

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { AppUser, formatPhone, signOut } from '../lib/auth';
import RoleBadge from './RoleBadge';
import OfflineBanner from './OfflineBanner';
import NotificationBell from './NotificationBell';
import { Button } from './ui/button';

function homeFor(role: AppUser['role']): string {
  switch (role) {
    case 'admin':
    case 'co-admin': return '/admin';
    case 'vendor-rep': return '/rep';
    case 'worker':
    case 'super-worker': return '/floor';
  }
}

export default function Layout({ user, children }: { user: AppUser; children: ReactNode }) {
  async function onSignOut() {
    await signOut();
    // The auth listener in useSession will set user to null and App.tsx will
    // re-render to show the sign-in form.
  }

  return (
    <div className="min-h-full bg-slate-50">
      <OfflineBanner />
      <header className="bg-brand-navy text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:px-6">
          {/* Empty first column: its 1fr twin on the right is what centres the wordmark. */}
          <span aria-hidden="true" />

          <Link
            to={homeFor(user.role)}
            className="rounded px-1 text-base font-extrabold uppercase tracking-[0.15em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy sm:text-lg"
          >
            Jayshankar
          </Link>

          <div className="flex items-center justify-end gap-1.5 sm:gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight text-white">{user.displayName}</div>
              <div className="text-xs leading-tight text-white/70">{user.email ?? formatPhone(user.phone)}</div>
            </div>
            {/* The badge is the first thing to go on narrow phones — the wordmark and the
                sign-out control matter more at 360-414px. */}
            <span className="hidden sm:inline-flex">
              <RoleBadge role={user.role} />
            </span>
            <NotificationBell />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              aria-label="Sign out"
              className="text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/70 focus-visible:ring-offset-brand-navy"
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
