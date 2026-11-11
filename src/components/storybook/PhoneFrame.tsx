// PhoneFrame — the phone shell every storybook step is drawn inside.
//
// Deliberately shaped like the client's reference decks (example-video/*.jpeg): a navy bar carrying
// the clock and status glyphs, an optional back arrow, a centred screen title, and the five-item
// bottom tab bar the mobile sheets show (Home / Procurement / Market Price / Suppliers / More).
//
// Fixed 340x600 logical size, so the chapter strip can render the very same frame scaled down as a
// thumbnail without a second implementation. Scaling is a transform on the wrapper (see Storybook
// page), never a prop here — one source of truth for the layout.

import {
  ArrowLeft, BarChart3, BatteryFull, Fish, Home, MoreHorizontal, Signal, Store, Wifi,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const TAB_ICONS = {
  Home: Home,
  Procurement: Fish,
  'Market Price': BarChart3,
  Suppliers: Store,
  More: MoreHorizontal,
} as const;

export interface PhoneFrameProps {
  title?: string;
  back?: boolean;
  right?: string;
  tab?: string;
  children: React.ReactNode;
  className?: string;
}

export const PHONE_WIDTH = 340;
export const PHONE_HEIGHT = 600;

export default function PhoneFrame({ title, back, right, tab, children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn('flex flex-col overflow-hidden rounded-[26px] border-[6px] border-slate-900 bg-white', className)}
      style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT }}
    >
      {/* Navy app bar: clock + status glyphs, then the screen title row. */}
      <div className="shrink-0 bg-brand-navy px-4 pb-2.5 pt-2 text-white">
        <div className="flex items-center justify-between text-[10px] font-semibold text-white/85">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Signal aria-hidden="true" className="h-3 w-3" />
            <Wifi aria-hidden="true" className="h-3 w-3" />
            <BatteryFull aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-[20px_1fr_minmax(0,76px)] items-center">
          <span aria-hidden="true">
            {back && <ArrowLeft className="h-4 w-4" />}
          </span>
          <span className="truncate text-center text-[14px] font-bold tracking-wide">{title ?? ''}</span>
          <span className="truncate text-right text-[9px] font-semibold text-white/80">{right ?? ''}</span>
        </div>
      </div>

      {/* Screen body. Scrolls when a step has more content than fits the frame. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 px-3.5 py-3">{children}</div>

      {/* Bottom tab bar, as drawn in the mobile reference sheets. */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-1.5 pb-2 pt-1.5">
        <div className="flex items-end justify-between">
          {Object.entries(TAB_ICONS).map(([label, Icon]) => {
            const active = tab === label;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-0.5">
                <Icon
                  aria-hidden="true"
                  className={cn('h-[18px] w-[18px]', active ? 'text-brand-navy' : 'text-slate-400')}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={cn('text-[8.5px] leading-none', active ? 'font-bold text-brand-navy' : 'text-slate-400')}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
