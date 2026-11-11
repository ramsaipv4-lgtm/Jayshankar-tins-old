// Tile — the home-screen tile from the client's locked reference (prompt-1.jpg, Screen 1):
// a solid rounded square, one white line icon centred in it, and a white label sitting just
// above the bottom edge.
//
// Built from Tailwind + lucide-react instead of an image asset: the tile's colour comes from
// the `tone` variant (the `tile.*` palette in tailwind.config.ts) and the icon is a React
// component, so there is no per-tile SVG file to regenerate when a colour or a glyph changes.
//
// The label is plain white on the tile colour, exactly as in the reference, with a soft
// text-shadow so it stays readable on the lighter tones (orange/teal/sky). The measured
// contrast for each tone is recorded in the Phase A notes.
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const tileVariants = cva(
  'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl pb-3 text-white shadow-sm transition-transform duration-100 ease-out active:scale-[0.98]',
  {
    variants: {
      tone: {
        navy: 'bg-tile-navy',
        orange: 'bg-tile-orange',
        teal: 'bg-tile-teal',
        red: 'bg-tile-red',
        purple: 'bg-tile-purple',
        sky: 'bg-tile-sky',
      },
    },
    defaultVariants: { tone: 'navy' },
  },
);

export interface TileProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tileVariants> {
  /** Line icon drawn white and centred in the tile — any lucide icon. */
  icon: LucideIcon;
  /** Tile label, rendered in white near the bottom edge. */
  label: string;
}

export function Tile({ tone, icon: Icon, label, className, ...props }: TileProps) {
  return (
    <div className={cn(tileVariants({ tone }), className)} {...props}>
      {/* h-[42%] matches the reference's icon-to-tile proportion at every grid width. */}
      <Icon aria-hidden="true" strokeWidth={1.5} className="h-[42%] w-[42%] shrink-0" />
      <span className="absolute inset-x-1 bottom-2.5 truncate text-center text-[13px] font-bold leading-none [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
        {label}
      </span>
    </div>
  );
}

export { tileVariants };
