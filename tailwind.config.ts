import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// SPEC §3.5 palette is unchanged (primary indigo-600, destructive red-600, success
// emerald-600, warning amber-500). Role badge colours stay inlined in RoleBadge.tsx.
//
// Phase A (Screen 1 of 12, client reference prompt-1.jpg): the tile palette is now a
// theme token instead of artwork, which is what lets the six home tiles be plain
// Tailwind classes rather than six 40 kB SVG files. Values are Q1.3(a) "image-exact"
// from the approved mockup HTML (still pending final client sign-off) — change them
// here and every tile follows, no asset regeneration.
const BRAND_NAVY = '#0e2b5e';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand chrome: the navy app bar (Layout.tsx).
        brand: { navy: BRAND_NAVY },
        // The six home-screen tiles. `navy` is intentionally the same value as the
        // brand navy so the Procurement tile and the app bar can never drift apart.
        tile: {
          navy: BRAND_NAVY,
          orange: '#f59e0b',
          teal: '#14b8a6',
          red: '#ef4444',
          purple: '#8b5cf6',
          sky: '#38bdf8',
        },
        // shadcn/ui tokens — the CSS variables themselves live in src/index.css.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        // ---- Storybook (/storybook) picture-book animations -------------------
        // Page turn between steps: the incoming screen swings in from the right,
        // like turning a page. Kept shallow (14deg) so text never distorts badly.
        'sb-page': {
          from: { opacity: '0', transform: 'perspective(1200px) rotateY(-14deg) translateX(34px) scale(0.98)' },
          to: { opacity: '1', transform: 'perspective(1200px) rotateY(0deg) translateX(0) scale(1)' },
        },
        // Blocks rise in, staggered by an inline animation-delay per child.
        'sb-rise': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sb-pop': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '60%': { opacity: '1', transform: 'scale(1.09)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // SVG line-chart draw-on and donut sweep.
        'sb-draw': {
          from: { strokeDashoffset: 'var(--sb-len, 400)' },
          to: { strokeDashoffset: '0' },
        },
        // Bars grow from their baseline.
        'sb-grow': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
        'sb-grow-x': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        // The little arrow that points from one step to the next, out of the deck.
        'sb-arrow': {
          '0%, 100%': { opacity: '0.35', transform: 'translateX(0)' },
          '50%': { opacity: '1', transform: 'translateX(3px)' },
        },
        // Progress bar sheen.
        'sb-sheen': {
          from: { backgroundPosition: '0% 50%' },
          to: { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'collapsible-down': 'collapsible-down 200ms ease-out',
        'collapsible-up': 'collapsible-up 200ms ease-out',
        'sb-page': 'sb-page 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'sb-rise': 'sb-rise 340ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'sb-pop': 'sb-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'sb-draw': 'sb-draw 900ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'sb-grow': 'sb-grow 520ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'sb-grow-x': 'sb-grow-x 520ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'sb-arrow': 'sb-arrow 1.6s ease-in-out infinite',
        'sb-sheen': 'sb-sheen 1.8s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

