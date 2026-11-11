// Storybook block renderer.
//
// One renderer for every screen in the picture book: it takes a ScreenSpec (see
// lib/storybook/types.ts) and draws it. Add a new Block kind here and every chapter can use it;
// chapter files stay pure data.
//
// Visual language is deliberately the SHIPPED one, not a mockup dialect: the tiles below are the
// real components/ui/tile.tsx (so the deck shows the actual home screen), the colours are the
// tile.* / brand.navy tokens from tailwind.config.ts, and the type scale matches the app.
//
// All motion comes from the animate-sb-* utilities in tailwind.config.ts, staggered per block
// through an inline animationDelay. `index` is threaded into each block for exactly that reason.

import * as React from 'react';
import {
  AlertTriangle, Anchor, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Award, BarChart3, Bell,
  Boxes, Building2, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleDollarSign, ClipboardCheck, ClipboardList, Clock, Container, CreditCard, Download, Droplets,
  Edit, Ellipsis, Eye, FileSpreadsheet, FileText, Filter, Fish, Gauge, Home, IndianRupee, Info,
  Layers, LineChart, ListChecks, Mail, MapPin, Megaphone, MessageSquareWarning, Package, PackageCheck,
  PackageOpen, Percent, Phone, PieChart, Plus, Printer, QrCode, Receipt, RefreshCw, RotateCcw, Scale,
  Search, Settings, Share2, Ship, ShoppingCart, SlidersHorizontal, Snowflake, Star, Store, Tag,
  Thermometer, Timer, TrendingDown, TrendingUp, Truck, Upload, User, Users, Wallet, Warehouse, Waves,
  XCircle, type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tile } from '@/components/ui/tile';

import type { Block, IconName, Tone } from '@/lib/storybook/types';

/**
 * The storybook has nine tones for banners and charts; the shipped home tile has six (its cva
 * variants in components/ui/tile.tsx). Mapping rather than extending the tile keeps the deck
 * showing the *real* component — a tile colour here is the colour the app actually ships.
 */
const TILE_TONE: Record<Tone, 'navy' | 'orange' | 'teal' | 'red' | 'purple' | 'sky'> = {
  navy: 'navy',
  teal: 'teal',
  emerald: 'teal',
  amber: 'orange',
  red: 'red',
  sky: 'sky',
  purple: 'purple',
  indigo: 'navy',
  slate: 'navy',
};

/* ------------------------------------------------------------------------------------------------
   Palette resolution. Every class string is written out longhand so Tailwind's JIT can see it —
   never built by string concatenation, which would silently produce no CSS.
------------------------------------------------------------------------------------------------ */

/** Solid fill + white text: tiles, step numbers, pills. */
const TONE_SOLID: Record<Tone, string> = {
  navy: 'bg-brand-navy text-white',
  teal: 'bg-tile-teal text-white',
  emerald: 'bg-emerald-600 text-white',
  amber: 'bg-amber-500 text-white',
  red: 'bg-red-600 text-white',
  sky: 'bg-tile-sky text-white',
  purple: 'bg-tile-purple text-white',
  indigo: 'bg-indigo-600 text-white',
  slate: 'bg-slate-600 text-white',
};

/** Tinted card / banner / chip: light wash with a readable foreground. */
const TONE_SOFT: Record<Tone, string> = {
  navy: 'border-slate-200 bg-slate-50 text-slate-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-900',
  purple: 'border-purple-200 bg-purple-50 text-purple-900',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

/** Foreground only, for figures that carry the tone without a filled box. */
const TONE_TEXT: Record<Tone, string> = {
  navy: 'text-brand-navy',
  teal: 'text-teal-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  sky: 'text-sky-600',
  purple: 'text-purple-600',
  indigo: 'text-indigo-600',
  slate: 'text-slate-600',
};

/** Chart fills (500-ish weights so bars and dots read at small sizes). */
const TONE_FILL: Record<Tone, string> = {
  navy: 'bg-brand-navy',
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  sky: 'bg-sky-400',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-500',
};

/** Hex, for the SVG charts where a stroke colour cannot come from a class. */
const TONE_HEX: Record<Tone, string> = {
  navy: '#0e2b5e',
  teal: '#14b8a6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  sky: '#38bdf8',
  purple: '#8b5cf6',
  indigo: '#4f46e5',
  slate: '#64748b',
};

/* ------------------------------------------------------------------------------------------------
   Icon resolution — chapter data names icons as strings, so the chapter files stay plain data.
   The full list of usable names is recorded in delegation/tasks/T10-storybook-workflow/NOTES.md.
   An unknown name falls back to a box icon rather than throwing, so one typo in a chapter file
   can never break the whole deck.
------------------------------------------------------------------------------------------------ */

const ICONS: Record<string, LucideIcon> = {
  alert: AlertTriangle, anchor: Anchor, arrowDownToLine: ArrowDownToLine, arrowLeftRight: ArrowLeftRight,
  arrowUpRight: ArrowUpRight, award: Award, bars: BarChart3, bell: Bell, boxes: Boxes, building: Building2,
  calendar: CalendarDays, camera: Camera, check: Check, checkCircle: CheckCircle2, chevronDown: ChevronDown,
  chevronRight: ChevronRight, clock: Clock, container: Container, cost: CircleDollarSign,
  creditCard: CreditCard, clipboardCheck: ClipboardCheck, clipboardList: ClipboardList, download: Download,
  droplets: Droplets, edit: Edit, ellipsis: Ellipsis, eye: Eye, fileSpreadsheet: FileSpreadsheet,
  fileText: FileText, filter: Filter, fish: Fish, gauge: Gauge, home: Home, indianRupee: IndianRupee,
  info: Info, layers: Layers, lineChart: LineChart, listChecks: ListChecks, mail: Mail, mapPin: MapPin,
  megaphone: Megaphone, complaint: MessageSquareWarning, package: Package, packageCheck: PackageCheck,
  packageOpen: PackageOpen, percent: Percent, phone: Phone, pieChart: PieChart, plus: Plus,
  printer: Printer, qr: QrCode, receipt: Receipt, refresh: RefreshCw, rotateCcw: RotateCcw, scale: Scale,
  search: Search, settings: Settings, share: Share2, ship: Ship, shoppingCart: ShoppingCart,
  sliders: SlidersHorizontal, snowflake: Snowflake, star: Star, store: Store, tag: Tag,
  thermometer: Thermometer, timer: Timer, trendingDown: TrendingDown, trendingUp: TrendingUp,
  truck: Truck, upload: Upload, user: User, users: Users, wallet: Wallet, warehouse: Warehouse,
  waves: Waves, xCircle: XCircle,
};

function resolveIcon(name?: IconName): LucideIcon {
  if (!name) return Package;
  return ICONS[name] ?? Package;
}

/* ------------------------------------------------------------------------------------------------
   Figures that count up as the page turns. "₹ 1,250 kg" animates the 1250 and keeps the dressing.
------------------------------------------------------------------------------------------------ */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function parseFigure(value: string): { prefix: string; target: number | null; suffix: string; grouped: boolean } {
  const m = /^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/.exec(value);
  if (!m) return { prefix: '', target: null, suffix: value, grouped: false };
  const target = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(target)) return { prefix: '', target: null, suffix: value, grouped: false };
  return { prefix: m[1], target, suffix: m[3], grouped: m[2].includes(',') || target >= 10000 };
}

/** Counts 0 → target once per mount. The player remounts each step, so this replays per page. */
export function AnimatedFigure({ value, className }: { value: string; className?: string }) {
  const { prefix, target, suffix, grouped } = React.useMemo(() => parseFigure(value), [value]);
  const [shown, setShown] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (target === null || prefersReducedMotion()) return;
    const started = performance.now();
    const duration = 720;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic — quick start, settles onto the figure
      setShown(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (target === null) return <span className={className}>{value}</span>;

  const rounded = shown === null ? target : Math.round(shown);
  const text = grouped ? rounded.toLocaleString('en-IN') : String(rounded);
  return (
    <span className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
   Shared furniture
------------------------------------------------------------------------------------------------ */

/** Wraps every block: supplies the stagger delay that makes a screen assemble itself. */
function Reveal({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('animate-sb-rise', className)} style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}>
      {children}
    </div>
  );
}

/** Small grey field label, same weight/size the real forms use. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold text-slate-500">{children}</div>;
}

/* ------------------------------------------------------------------------------------------------
   Messaging
------------------------------------------------------------------------------------------------ */

/** A banner. amber = caution, red = problem, emerald = success, navy/sky = information. */
function Alert({ tone, icon, title, detail }: { tone: Tone; icon?: IconName; title: string; detail?: string }) {
  const Icon = resolveIcon(icon ?? (tone === 'red' ? 'alert' : tone === 'emerald' ? 'checkCircle' : 'info'));
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2.5', TONE_SOFT[tone])}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-[11px] leading-snug opacity-85">{detail}</div>}
      </div>
    </div>
  );
}

/** Small grey explanatory line — the reference decks lean on these heavily. */
function Note({ text, tone }: { text: string; tone?: Tone }) {
  return (
    <div className={cn('px-1 text-[11px] leading-snug', tone ? TONE_TEXT[tone] : 'text-slate-500')}>{text}</div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Forms
------------------------------------------------------------------------------------------------ */

/** A dropdown/select row. `placeholder` renders it as unset (grey with a chevron only). */
function SelectField({ label, value, icon, placeholder }: { label: string; value: string; icon?: IconName; placeholder?: boolean }) {
  const Icon = resolveIcon(icon);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Panel className="flex items-center gap-2.5 px-3 py-2.5">
        <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', placeholder ? 'text-slate-400' : 'text-slate-700')} />
        <span className={cn('flex-1 truncate text-[13px] font-semibold', placeholder ? 'text-slate-400' : 'text-slate-900')}>
          {value}
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
      </Panel>
    </div>
  );
}

/** A labelled input. `locked` marks a field the signed-in role must never see a value for. */
function FieldValue({
  label,
  value,
  suffix,
  big,
  locked,
}: {
  label: string;
  value: string;
  suffix?: string;
  big?: boolean;
  locked?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Panel className={cn('flex items-center gap-2 px-3', big ? 'py-2.5' : 'py-2')}>
        {locked && <LockGlyph />}
        <span className={cn('flex-1 truncate', big ? 'text-[24px] font-extrabold tracking-tight' : 'text-[13px] font-semibold', 'text-slate-900')}>
          {value}
        </span>
        {suffix && (
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{suffix}</span>
        )}
      </Panel>
    </div>
  );
}

/** The padlock the client's own handover spec uses to mark a field hidden from receiving. */
function LockGlyph() {
  return (
    <span
      aria-label="hidden from this role"
      className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
    >
      🔒
    </span>
  );
}

/** Read-only label/value grid (PO summary, container details, supplier record). */
function Fields({ columns = 1, items }: { columns?: 1 | 2; items: { label: string; value: string; locked?: boolean }[] }) {
  return (
    <div className={cn('grid gap-x-4 gap-y-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {it.locked && <LockGlyph />}
            {it.label}
          </span>
          <span className="text-right text-[12.5px] font-bold text-slate-900">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   The white bordered card a form or list sits in.
------------------------------------------------------------------------------------------------ */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white', className)}>{children}</div>;
}

/** Grade split: A/B/C weights with a running total row, as the grading screen shows it. */
function GradeRows({ items, total }: { items: { label: string; value: number }[]; total: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="flex-1 text-[12.5px] font-semibold text-slate-700">{it.label}</span>
          <div className="animate-sb-pop w-24" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <Panel className="flex items-center justify-end gap-2 px-2.5 py-1.5">
              <AnimatedFigure value={String(it.value)} className="text-[15px] font-extrabold text-slate-900" />
              <span className="text-[10px] font-bold text-slate-500">KG</span>
            </Panel>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
        <span className="text-[12px] font-bold text-emerald-800">Total</span>
        <span className="text-[13px] font-extrabold text-emerald-800">{total} ✓</span>
      </div>
    </div>
  );
}

/** Action buttons. Only ever one primary per screen, as the real forms do. */
function Buttons({ items }: { items: { label: string; variant?: 'primary' | 'danger' | 'warning' | 'outline' }[] }) {
  const cls: Record<string, string> = {
    primary: 'bg-emerald-600 text-white',
    danger: 'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
    outline: 'border border-slate-300 bg-white text-slate-700',
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map((b, i) => (
        /* A mock button, not a control: these screens are a picture book, nothing here is
           clickable, and rendering a real <button> inside the filmstrip's <button> is invalid
           HTML (React logs a validateDOMNesting warning and screen readers announce it twice). */
        <div
          key={b.label}
          aria-hidden="true"
          className={cn(
            'animate-sb-rise w-full rounded-xl px-4 py-3 text-center text-[13.5px] font-bold shadow-sm',
            cls[b.variant ?? 'primary'],
          )}
          style={{ animationDelay: `${320 + i * 70}ms` }}
        >
          {b.label}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Lists and tables
------------------------------------------------------------------------------------------------ */

/** Generic list of rows — containers, alerts, customers, stock lines. */
function Rows({
  items,
}: {
  items: {
    label: string;
    value?: string;
    sub?: string;
    tone?: Tone;
    icon?: IconName;
    trailing?: 'chevron' | 'check' | 'none';
  }[];
}) {
  return (
    <Panel className="divide-y divide-slate-100">
      {items.map((it, i) => {
        const Icon = resolveIcon(it.icon);
        const trailing = it.trailing ?? 'chevron';
        return (
          <div
            key={`${it.label}-${i}`}
            className="animate-sb-rise flex items-center gap-2.5 px-3 py-2.5"
            style={{ animationDelay: `${140 + i * 45}ms` }}
          >
            {it.icon && (
              <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', it.tone ? TONE_TEXT[it.tone] : 'text-slate-500')} />
            )}
            <div className="min-w-0 flex-1">
              <div className={cn('truncate text-[12.5px] font-semibold', it.tone === 'red' ? 'text-red-700' : 'text-slate-900')}>
                {it.label}
              </div>
              {it.sub && <div className="truncate text-[10.5px] text-slate-500">{it.sub}</div>}
            </div>
            {it.value && (
              <span className={cn('shrink-0 text-[12.5px] font-extrabold', it.tone ? TONE_TEXT[it.tone] : 'text-slate-900')}>
                {it.value}
              </span>
            )}
            {trailing === 'chevron' && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300" />}
            {trailing === 'check' && (
              <CheckCircle2 aria-hidden="true" className="animate-sb-pop h-4 w-4 shrink-0 text-emerald-600" />
            )}
          </div>
        );
      })}
    </Panel>
  );
}

/** Data table. `tone` tints a whole row (overdue, in-transit, expiring). */
function Table({
  title,
  head,
  rows,
  footer,
}: {
  title?: string;
  head: string[];
  rows: { cells: string[]; tone?: Tone }[];
  footer?: { cells: string[]; tone?: Tone };
}) {
  return (
    <div>
      {title && <FieldLabel>{title}</FieldLabel>}
      <Panel className="overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50">
              {head.map((h) => (
                <th key={h} className="px-2.5 py-2 text-[9.5px] font-bold uppercase tracking-wide text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={cn('animate-sb-rise border-t border-slate-100', r.tone ? TONE_SOFT[r.tone] : '')}
                style={{ animationDelay: `${140 + i * 40}ms` }}
              >
                {r.cells.map((c, j) => (
                  <td key={j} className="px-2.5 py-2 text-[11.5px] text-slate-800">
                    {j === 0 ? <span className="font-semibold">{c}</span> : c}
                  </td>
                ))}
              </tr>
            ))}
            {footer && (
              <tr className={cn('border-t border-slate-200', footer.tone ? TONE_SOFT[footer.tone] : 'bg-slate-50')}>
                {footer.cells.map((c, j) => (
                  <td key={j} className={cn('px-2.5 py-2', j === 0 ? 'text-[11.5px] font-bold' : 'text-[12px] font-extrabold')}>
                    {c}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/** Vertical status timeline — PO lifecycle, complaint resolution. */
function Timeline({ title, items, doneThrough }: { title?: string; items: { label: string; time: string }[]; doneThrough?: number }) {
  const done = doneThrough ?? items.length;
  return (
    <div>
      {title && <FieldLabel>{title}</FieldLabel>}
      <Panel className="px-3 py-3">
        {items.map((it, i) => {
          const isDone = i < done;
          return (
            <div key={it.label} className="animate-sb-rise flex gap-2.5" style={{ animationDelay: `${150 + i * 70}ms` }}>
              <div className="flex flex-col items-center">
                {isDone ? (
                  <CheckCircle2 aria-hidden="true" className="animate-sb-pop mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <span className="mt-1 h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                )}
                {i < items.length - 1 && <div className={cn('w-px flex-1', isDone ? 'bg-emerald-300' : 'bg-slate-200')} />}
              </div>
              <div className="pb-3">
                <div className={cn('text-[12px] font-bold', isDone ? 'text-slate-900' : 'text-slate-400')}>{it.label}</div>
                <div className="text-[10.5px] text-slate-500">{it.time}</div>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

/** Segmented control — the reference's All / Marine / Freshwater style tab strips. */
function Tabs({ items, active = 0 }: { items: string[]; active?: number }) {
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {items.map((tab, i) => (
        <span
          key={tab}
          className={cn(
            'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
            i === active ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-600',
          )}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

/** Confirmation screen: the big tick / warning, a title, and the reassurance line. */
function Result({
  tone = 'emerald',
  icon,
  title,
  caption,
  rows,
}: {
  tone?: Tone;
  icon?: IconName;
  title: string;
  caption?: string;
  rows?: { label: string; value: string }[];
}) {
  const Icon = resolveIcon(icon ?? (tone === 'red' ? 'xCircle' : 'checkCircle'));
  return (
    <div className="pt-4 text-center">
      <Icon aria-hidden="true" strokeWidth={1.75} className={cn('animate-sb-pop mx-auto h-20 w-20', TONE_TEXT[tone])} />
      <div className={cn('mt-2 text-[20px] font-extrabold', TONE_TEXT[tone])}>{title}</div>
      {caption && <div className="mt-1 text-[12px] text-slate-500">{caption}</div>}
      {rows && rows.length > 0 && (
        <div className="animate-sb-rise mt-4 text-left" style={{ animationDelay: '260ms' }}>
          <Panel className="px-3 py-3">
            <Fields items={rows} />
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Charts — plain SVG, drawn on with animate-sb-draw. No charting library.
------------------------------------------------------------------------------------------------ */

/** Maps a series onto a 300x110 viewBox, returning the path, its area fill, and its length. */
function buildLine(points: number[]): { d: string; area: string; len: number } {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? 300 / (points.length - 1) : 300;
  const xy = points.map((v, i) => [i * step, 100 - ((v - min) / span) * 80] as const);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const len = xy.reduce((acc, [x, y], i) => {
    if (i === 0) return 0;
    const prev = xy[i - 1];
    return acc + Math.hypot(x - prev[0], y - prev[1]);
  }, 0);
  return { d, area: `${d} L300,108 L0,108 Z`, len: Math.ceil(len) };
}

function ChartLine({
  title,
  points,
  labels,
  highlight,
}: {
  title: string;
  points: number[];
  labels?: string[];
  highlight?: string;
}) {
  const { d, area, len } = React.useMemo(() => buildLine(points), [points]);
  const geo = React.useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const step = points.length > 1 ? 300 / (points.length - 1) : 300;
    return points.map((v, i) => ({ cx: i * step, cy: 100 - ((v - min) / span) * 80 }));
  }, [points]);

  return (
    <Panel className="px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-600">{title}</span>
        {highlight && (
          <span className="rounded-md bg-brand-navy px-2 py-0.5 text-[11px] font-extrabold text-white">{highlight}</span>
        )}
      </div>
      <svg viewBox="0 0 300 116" className="h-24 w-full" role="img" aria-label={title}>
        {[0, 1, 2, 3].map((g) => (
          <line key={g} x1="0" x2="300" y1={10 + g * 30} y2={10 + g * 30} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <path d={area} fill={TONE_HEX.sky} opacity="0.16" className="animate-sb-rise" style={{ animationDelay: '320ms' }} />
        <path
          d={d}
          fill="none"
          stroke={TONE_HEX.navy}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-sb-draw"
          style={{ strokeDasharray: len, animationDelay: '120ms', '--sb-len': String(len) } as React.CSSProperties}
        />
        {geo.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="2.5"
            fill="#fff"
            stroke={TONE_HEX.navy}
            strokeWidth="1.5"
            className="animate-sb-pop"
            style={{ animationDelay: `${520 + i * 45}ms` }}
          />
        ))}
      </svg>
      {labels && (
        <div className="mt-1 flex justify-between text-[9px] text-slate-400">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Vertical bars, growing from the baseline. */
function ChartBars({ title, items }: { title?: string; items: { label: string; value: number; tone?: Tone }[] }) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <Panel className="px-3 py-3">
      {title && <div className="mb-2 text-[11px] font-bold text-slate-600">{title}</div>}
      <div className="flex h-24 items-end gap-2">
        {items.map((it, i) => (
          <div key={it.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn('animate-sb-grow w-full origin-bottom rounded-t-md', TONE_FILL[it.tone ?? 'navy'])}
                style={{ height: `${Math.max(6, (it.value / max) * 100)}%`, animationDelay: `${150 + i * 70}ms` }}
              />
            </div>
            <span className="w-full truncate text-center text-[9px] text-slate-500">{it.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Donut with a centre figure. Segments sweep in via stroke-dashoffset. */
function ChartDonut({
  title,
  center,
  centerSub,
  items,
}: {
  title?: string;
  center?: string;
  centerSub?: string;
  items: { label: string; value: number; tone: Tone }[];
}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Panel className="px-3 py-3">
      {title && <div className="mb-2 text-[11px] font-bold text-slate-600">{title}</div>}
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0" role="img" aria-label={title ?? 'breakdown'}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="#eef2f7" strokeWidth="14" />
          {items.map((it, i) => {
            const dash = (it.value / total) * C;
            const el = (
              <circle
                key={it.label}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={TONE_HEX[it.tone]}
                strokeWidth="14"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                className="animate-sb-draw"
                style={{ animationDelay: `${i * 140}ms`, '--sb-len': String(C) } as React.CSSProperties}
              />
            );
            offset += dash;
            return el;
          })}
          {center && (
            <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[15px] font-extrabold">
              {center}
            </text>
          )}
          {centerSub && (
            <text x="60" y="72" textAnchor="middle" className="fill-slate-500 text-[9px]">
              {centerSub}
            </text>
          )}
        </svg>
        <div className="min-w-0 flex-1 space-y-1">
          {items.map((it, i) => (
            <div key={it.label} className="animate-sb-rise flex items-center gap-2" style={{ animationDelay: `${200 + i * 70}ms` }}>
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', TONE_FILL[it.tone])} />
              <span className="flex-1 truncate text-[10.5px] text-slate-600">{it.label}</span>
              <span className="text-[10.5px] font-bold text-slate-900">{Math.round((it.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------------------------------
   Physical-world widgets
------------------------------------------------------------------------------------------------ */

/** Deterministic fake QR: the same string always draws the same pattern, so screenshots are stable. */
function Qr({ value, caption }: { value: string; caption?: string }) {
  const modules = React.useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const cells: boolean[] = [];
    let state = h >>> 0;
    for (let i = 0; i < 21 * 21; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      cells.push((state & 0x80000000) !== 0);
    }
    return cells;
  }, [value]);

  /** Draws the three real QR finder squares so the pattern reads as a QR, not as noise. */
  const finder = (r: number, c: number): boolean | null => {
    const rings: [number, number][] = [[0, 0], [0, 14], [14, 0]];
    for (const [r0, c0] of rings) {
      if (r < r0 || r >= r0 + 7 || c < c0 || c >= c0 + 7) continue;
      const dr = r - r0;
      const dc = c - c0;
      const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      return onRing || inCore;
    }
    return null;
  };

  return (
    <Panel className="px-3 py-3 text-center">
      <svg viewBox="0 0 21 21" className="animate-sb-pop mx-auto h-32 w-32" role="img" aria-label={`QR code ${value}`}>
        <rect width="21" height="21" fill="#fff" />
        {modules.map((on, i) => {
          const r = Math.floor(i / 21);
          const c = i % 21;
          const fixed = finder(r, c);
          const filled = fixed === null ? on : fixed;
          if (!filled) return null;
          return <rect key={i} x={c} y={r} width="1" height="1" fill="#0f172a" />;
        })}
      </svg>
      <div className="mt-2 text-[10px] font-bold tracking-wider text-slate-500">{value}</div>
      {caption && <div className="mt-0.5 text-[10px] text-slate-400">{caption}</div>}
    </Panel>
  );
}

/** Photo-evidence strip — the camera boxes the decks show on spoilage and complaints. */
function Photos({ count = 3, caption }: { count?: number; caption?: string }) {
  return (
    <div>
      {caption && <FieldLabel>{caption}</FieldLabel>}
      <div className="flex gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-sb-pop flex h-14 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50"
            style={{ animationDelay: `${180 + i * 80}ms` }}
          >
            <Camera aria-hidden="true" className="h-4 w-4 text-slate-400" />
          </div>
        ))}
        <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Plus aria-hidden="true" className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

/** Progress bar — "12 / 50 KG packed". */
function Progress({ label, value, max, unit }: { label: string; value: number; max: number; unit?: string }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <Panel className="px-3 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
        <span className="text-[12px] font-extrabold text-slate-900">
          {value} / {max} {unit}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="animate-sb-grow-x h-full origin-left rounded-full bg-brand-navy"
          style={{ width: `${pct}%`, animationDelay: '220ms' }}
        />
      </div>
    </Panel>
  );
}

/** The PR → RCV → BATCH → SALE chain from the client's own handover note. */
function Chain({ items }: { items: { label: string; value: string; tone?: Tone }[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          <div
            className={cn(
              'animate-sb-rise flex items-center justify-between rounded-xl border px-3 py-2',
              TONE_SOFT[it.tone ?? 'navy'],
            )}
            style={{ animationDelay: `${140 + i * 110}ms` }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{it.label}</span>
            <span className="text-[12px] font-extrabold">{it.value}</span>
          </div>
          {i < items.length - 1 && (
            <div className="flex justify-center">
              <ChevronDown aria-hidden="true" className="animate-sb-arrow h-4 w-4 text-slate-400" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   The renderer
------------------------------------------------------------------------------------------------ */

function renderBlock(block: Block, _index: number): React.ReactNode {
  switch (block.kind) {
    case 'hero':
      return <Hero icon={block.icon} title={block.title} subtitle={block.subtitle} />;
    case 'tagline':
      return <Tagline text={block.text} />;
    case 'tiles':
      return <Tiles columns={block.columns} items={block.items} />;
    case 'stats':
      return <Stats columns={block.columns} items={block.items} />;
    case 'statCards':
      return <StatCards columns={block.columns} items={block.items} />;
    case 'alert':
      return <Alert tone={block.tone} icon={block.icon} title={block.title} detail={block.detail} />;
    case 'note':
      return <Note text={block.text} tone={block.tone} />;
    case 'select':
      return <SelectField label={block.label} value={block.value} icon={block.icon} placeholder={block.placeholder} />;
    case 'field':
      return (
        <FieldValue label={block.label} value={block.value} suffix={block.suffix} big={block.big} locked={block.locked} />
      );
    case 'fields':
      return <Fields columns={block.columns} items={block.items} />;
    case 'gradeRows':
      return <GradeRows items={block.items} total={block.total} />;
    case 'buttons':
      return <Buttons items={block.items} />;
    case 'rows':
      return <Rows items={block.items} />;
    case 'table':
      return <Table title={block.title} head={block.head} rows={block.rows} footer={block.footer} />;
    case 'timeline':
      return <Timeline title={block.title} items={block.items} doneThrough={block.doneThrough} />;
    case 'tabs':
      return <Tabs items={block.items} active={block.active} />;
    case 'result':
      return <Result tone={block.tone} icon={block.icon} title={block.title} caption={block.caption} rows={block.rows} />;
    case 'chartLine':
      return <ChartLine title={block.title} points={block.points} labels={block.labels} highlight={block.highlight} />;
    case 'chartBars':
      return <ChartBars title={block.title} items={block.items} />;
    case 'chartDonut':
      return <ChartDonut title={block.title} center={block.center} centerSub={block.centerSub} items={block.items} />;
    case 'qr':
      return <Qr value={block.value} caption={block.caption} />;
    case 'photos':
      return <Photos count={block.count} caption={block.caption} />;
    case 'progress':
      return <Progress label={block.label} value={block.value} max={block.max} unit={block.unit} />;
    case 'chain':
      return <Chain items={block.items} />;
    default:
      return null;
  }
}

/**
 * Draws a whole screen. The caller supplies the React key so that a step change remounts this
 * tree — which is what replays the entry animations and the figure count-ups on every page turn.
 */
export function StorybookBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <Reveal key={`${i}-${block.kind}`} index={i}>
          {renderBlock(block, i)}
        </Reveal>
      ))}
    </div>
  );
}

export { TONE_SOLID, TONE_SOFT, TONE_TEXT, TONE_HEX, ICONS };









/** The Home screen's marketing header from the reference (boat mark, name, tagline). */
function Hero({ icon, title, subtitle }: { icon?: IconName; title: string; subtitle?: string }) {
  const Icon = resolveIcon(icon ?? 'fish');
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-400 via-slate-500 to-slate-700 px-4 py-5 text-center text-white">
      <Icon aria-hidden="true" strokeWidth={1.25} className="mx-auto h-9 w-9 text-white/90" />
      <div className="mt-1 text-[26px] font-serif font-semibold leading-none tracking-[0.18em]">{title}</div>
      {subtitle && <div className="mt-1.5 text-[11px] text-white/85">{subtitle}</div>}
      {/* Faint wave band along the bottom, echoing the reference's sea illustration. */}
      <svg aria-hidden="true" viewBox="0 0 120 12" className="mt-3 h-3 w-full text-white/25">
        <path d="M0 8c8-6 16-6 24 0s16 6 24 0 16-6 24 0 16 6 24 0 16-6 24 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function Tagline({ text }: { text: string }) {
  return <div className="text-center text-[11px] font-medium tracking-[0.06em] text-slate-500">{text}</div>;
}

/** The home tile grid. Uses the SHIPPED components/ui/tile.tsx, so the deck shows the real thing. */
function Tiles({ columns = 2, items }: { columns?: 2 | 3 | 4; items: { label: string; icon: IconName; tone: Tone }[] }) {
  const cols = columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={cn('grid gap-2.5', cols)}>
      {items.map((it, i) => {
        const Icon = resolveIcon(it.icon);
        return (
          <div key={it.label} className="animate-sb-pop" style={{ animationDelay: `${140 + i * 45}ms` }}>
            <Tile tone={TILE_TONE[it.tone]} icon={Icon} label={it.label} className="aspect-square p-1" />
          </div>
        );
      })}
    </div>
  );
}

/** Plain value + label strip. */
function Stats({ columns = 3, items }: { columns?: 2 | 3; items: { value: string; label: string; sub?: string; tone?: Tone }[] }) {
  return (
    <Panel className={cn('grid divide-x divide-slate-200', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {items.map((it) => (
        <div key={it.label} className="px-2 py-3.5 text-center">
          <AnimatedFigure
            value={it.value}
            className={cn('block text-[19px] font-extrabold leading-none tracking-tight', it.tone ? TONE_TEXT[it.tone] : 'text-slate-900')}
          />
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{it.label}</div>
          {it.sub && <div className="mt-0.5 text-[10px] text-slate-400">{it.sub}</div>}
        </div>
      ))}
    </Panel>
  );
}

/** Icon + figure + caption cards, the shape the reference uses on its dashboards. */
function StatCards({
  columns = 2,
  items,
}: {
  columns?: 1 | 2;
  items: { icon: IconName; tone: Tone; value: string; label: string; sub?: string }[];
}) {
  return (
    <div className={cn('grid gap-2.5', columns === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
      {items.map((it, i) => {
        const Icon = resolveIcon(it.icon);
        return (
          <div
            key={it.label}
            className={cn('animate-sb-pop rounded-xl border p-3', TONE_SOFT[it.tone])}
            style={{ animationDelay: `${120 + i * 70}ms` }}
          >
            <Icon aria-hidden="true" className="h-4 w-4 opacity-80" />
            <div className="mt-1.5 text-[17px] font-extrabold leading-tight">
              <AnimatedFigure value={it.value} />
            </div>
            <div className="text-[11px] font-semibold opacity-90">{it.label}</div>
            {it.sub && <div className="mt-0.5 text-[10px] opacity-75">{it.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}




