// RepDashboard — vendor-rep home. Phase A (Screen 1 of 12), rebuilt from scratch to match the
// client's locked reference: client-qa/developer-prompt-image/prompt-1.jpg.
//
// Structure, top to bottom: a 3-stat strip, then a 2x3 grid of solid-colour tiles. Tile colour
// and glyph come from Tailwind + lucide-react (see components/ui/tile.tsx) — the tiles are no
// longer SVG assets, so a colour or an icon change is a one-line edit here.
//
// Frontend-only pass: the three stat values are literals (STATS below) and this page performs no
// Supabase reads. Nothing here is wired to the backend yet.

import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ClipboardCheck,
  Ellipsis,
  GraduationCap,
  MessageSquareWarning,
  Package,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tile, type TileProps } from '@/components/ui/tile';

// TODO(Phase A backend wiring): replace these three literals with a real query (kg received
// today, pending confirmations, sales today). They are hardcoded on purpose — this pass is
// visual only, and this page must not open a Supabase subscription until the wiring task lands.
const STATS = [
  { value: '450 KG', label: 'Today' },
  { value: '2', label: 'Pending' },
  { value: '₹ 24K', label: 'Sales' },
] as const;

// The six tiles, in the client's order. `tone` keys into the Q1.3(a) palette in
// tailwind.config.ts; `icon` is any lucide icon, drawn white and centred by <Tile>.
const TILES: ReadonlyArray<{ label: string; to: string; tone: TileProps['tone']; icon: LucideIcon }> = [
  { label: 'Procurement', to: '/deliver', tone: 'navy', icon: ShoppingCart },
  { label: 'Receiving', to: '/deliveries/confirm', tone: 'orange', icon: ArrowDownToLine },
  { label: 'Packing', to: '/pack', tone: 'teal', icon: Package },
  { label: 'Selling', to: '/sell', tone: 'red', icon: Truck },
  { label: 'My Tasks', to: '/my-tasks', tone: 'purple', icon: ClipboardCheck },
];

// Everything the previous home screen linked to that is not one of the five tiles above. It
// lives in the "More" disclosure so a working rep keeps access while Phase A is in progress;
// no "More" screen has been designed yet, so this is deliberately a plain list of real links.
const MORE_LINKS: ReadonlyArray<{ label: string; to: string; icon: LucideIcon }> = [
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Payments', to: '/payments', icon: Wallet },
  { label: 'Reversals', to: '/reversals', icon: RotateCcw },
  { label: 'Bills', to: '/bills', icon: Receipt },
  { label: 'Complaints', to: '/complaints', icon: MessageSquareWarning },
  { label: 'Search', to: '/search', icon: Search },
  { label: 'Learn', to: '/learn', icon: GraduationCap },
];

// One class for both tile wrappers (the navigating <Link> and the disclosing <button>), so the
// focus ring and hit area cannot drift apart between the five links and "More".
const TILE_WRAPPER =
  'block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export default function RepDashboard() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* Stats strip — placeholder figures, see STATS. */}
      <Card>
        <CardContent className="grid grid-cols-3 divide-x divide-border p-0">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-2 py-4 text-center">
              <div className="text-xl font-extrabold leading-none tracking-tight">{stat.value}</div>
              <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tile grid. 2 columns on a phone, matching the reference; 3 from sm: up. */}
      <Collapsible className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TILES.map(({ label, to, tone, icon }) => (
            <Link key={to} to={to} className={TILE_WRAPPER}>
              <Tile tone={tone} icon={icon} label={label} />
            </Link>
          ))}

          {/* "More" discloses the panel below instead of navigating. Radix supplies the
              aria-expanded / aria-controls wiring, so there is no hand-rolled toggle state. */}
          <CollapsibleTrigger className={TILE_WRAPPER}>
            <Tile tone="sky" icon={Ellipsis} label="More" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <Card>
            <CardHeader className="space-y-0.5 p-4">
              <CardTitle className="text-sm">More</CardTitle>
              <CardDescription className="text-xs">
                The rep's other tools — plain list for now.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-4 pb-4 pt-0 sm:grid-cols-3">
              {MORE_LINKS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 rounded-md px-1 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
