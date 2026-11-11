// DesktopFrame — the shell for the procurement-desk chapters.
//
// The client's second reference sheet (example-video/…8.32.26 PM.jpeg) shows these screens as
// desktop panels: a navy sidebar with the grouped nav, and a white working area with a title row,
// a search field, and a primary action on the right. This frame reproduces exactly that chrome so
// the same Block data can be shown at desk width.
//
// As with PhoneFrame the size is fixed (1180x720) so chapters, screenshots and thumbnails all line
// up; the sidebar item list is the one DESKTOP_NAV declares, so a new nav item is a one-line edit.

import { Bell, ChevronDown, Plus, Search, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DESKTOP_NAV } from '@/lib/storybook/types';

export const DESKTOP_WIDTH = 1180;
export const DESKTOP_HEIGHT = 720;

// One representative icon per nav group, matching the reference sidebar's own grouping.
const NAV_GROUPS: { heading: string; items: string[] }[] = [
  { heading: 'Overview', items: ['Dashboard', 'Purchase Requirements'] },
  { heading: 'Sourcing', items: ['Market Prices', 'Suppliers', 'Quotations'] },
  { heading: 'Transactions', items: ['Purchase Orders', 'Receiving'] },
  { heading: 'Insights', items: ['Price Prediction', 'Analytics', 'Reports'] },
];

export interface DesktopFrameProps {
  title: string;
  right?: string;
  search?: string;
  sidebar?: string;
  children: React.ReactNode;
  className?: string;
}

export default function DesktopFrame({ title, right, search, sidebar, children, className }: DesktopFrameProps) {
  return (
    <div
      className={cn('flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm', className)}
      style={{ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT }}
    >
      {/* Sidebar */}
      <aside className="flex w-[172px] shrink-0 flex-col bg-brand-navy text-white">
        <div className="flex items-center gap-2 px-3.5 py-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white/15 text-[13px] font-black">J</span>
          <div className="leading-none">
            <div className="text-[11px] font-bold tracking-wide">JAYSHANKAR</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-wider text-white/60">Procurement</div>
          </div>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto px-2.5 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="px-1.5 pb-1 text-[8px] font-bold uppercase tracking-wider text-white/45">
                {group.heading}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = sidebar === item;
                  return (
                    <div
                      key={item}
                      className={cn(
                        'truncate rounded-md px-2 py-1.5 text-[10.5px]',
                        active ? 'bg-white font-bold text-brand-navy' : 'text-white/80',
                      )}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/15 px-3 py-2.5 text-[8.5px] text-white/60">
          Jayshankar
          <div className="font-semibold text-white/80">Procurement Team</div>
        </div>
      </aside>

      {/* Working area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5">
          <h1 className="text-[15px] font-extrabold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {search && (
              <div className="flex w-56 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
                <Search aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate text-[10.5px] text-slate-400">{search}</span>
              </div>
            )}
            {right && (
              <span className="flex items-center gap-1 rounded-lg bg-brand-navy px-2.5 py-1.5 text-[10.5px] font-bold text-white">
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {right}
              </span>
            )}
            <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
              <User aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10.5px] font-semibold text-slate-600">Procurement</span>
              <ChevronDown aria-hidden="true" className="h-3 w-3 text-slate-400" />
            </span>
            <span className="relative grid h-7 w-7 place-items-center rounded-lg border border-slate-200">
              <Bell aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
              <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-red-500 text-[7px] font-bold text-white">
                3
              </span>
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">{children}</div>
        <footer className="shrink-0 border-t border-slate-200 px-4 py-1.5 text-[8.5px] text-slate-400">
          Navy sidebar nav as drawn in the client&apos;s reference sheet · {DESKTOP_NAV.length} sections
        </footer>
      </div>
    </div>
  );
}
