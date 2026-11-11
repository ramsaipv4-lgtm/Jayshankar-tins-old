# Design system — draft v0 (Jayshankar)

> **Date:** 2026-09-16.
> **Status:** Draft token spec, NOT a binding production contract. Built from observed current state + 5 design-system references (Linear, Superhuman, Notion, Stripe, Warp) + the 6 comparators in `docs/competitive-audit-2026-09-16.md`.
> **Promotion path:** when the user picks a direction (see `research-summary-2026-09-16.md` §3), this draft gets one revision pass against that direction's template, then becomes `docs/DESIGN-SYSTEM.md` proper via SPEC §2 amendment and a §8 acceptance criterion (TINS Step 3).

---

## 1. Guiding principles (from current state + research)

1. **The mobile device is the primary surface.** D18 says "mobile-app" but the implementation has been desktop-shaped. Going forward, every token choice in §3 below is evaluated first at the phone breakpoint (390×844), then desktop.
2. **Native `<select>` is the single biggest cross-theme defect.** Jayshankar's theme is currently light-only so it doesn't bite, but it's the #1 thing every modern design system replaces because it renders white-on-white in some browser/theme combinations. Replace with a custom button + popup.
3. **Touch targets ≥ 44×44 CSS px.** Every actionable element — button, link-as-button, input, picker, tab — has 44×44 minimum hit area. Inputs/buttons with shorter intrinsic height get `min-height: 44px`.
4. **Surfaces define hierarchy, not color.** Surface tones step through 4-5 values; chips, badges, alerts use a tiny accent palette. Avoid the "everything is indigo" trap the current app already shows.
5. **Borrow what Jayshankar already has.** The existing `theme_color #4f46e5`, the existing font (system stack — no custom font loaders anywhere), the existing audit-log / RLS / soft-delete infra stay unchanged. No design-driven rewrites of working logic.

---

## 2. Surface & text scales (proposed)

### Light theme (current production theme; preserved)
- **bg/0** page background: `#f8fafc` (Tailwind slate-50, current)
- **bg/1** card/section: `#ffffff`
- **bg/2** elevated: `#f1f5f9` (slate-100, current alt-row surface, ramp up gradually)
- **bg/3** hover/active: `#e2e8f0` (slate-200)
- **text/0** primary: `#0f172a` (slate-900) — replace current near-black with this for AA at 18px+
- **text/1** secondary: `#475569` (slate-600)
- **text/2** muted: `#64748b` (slate-500)
- **accent/0** brand primary: `#4f46e5` (indigo-600, current theme_color — preserved)
- **accent/1** accent hover: `#4338ca` (indigo-700)
- **border/0** standard: `#e2e8f0` (slate-200)
- **border/1** subtle: `#f1f5f9` (slate-100)
- **success/0** text: `#15803d` (green-700)
- **success/1** bg: `#dcfce7` (green-100)
- **warning/0** text + bg: amber, `#92400e` + `#fef3c7`
- **danger/0** text + bg: red, `#991b1b` + `#fee2e2`

### Spacing scale (8px base, preserved)
- `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `2xl: 32`, `3xl: 48`
- Already in use; no change.

### Radius scale (preserved + standardized)
- `xs: 4px` (inputs, small chips)
- `sm: 8px` (cards, default buttons) — current default
- `md: 12px` (feature cards)
- `lg: 16px` (modals)
- `pill: 9999px` (status pills only) — promote only where genuinely round helps

### Shadow scale (new — minimal)
- `0`: flat (no shadow)
- `1`: `0 1px 2px rgba(15,23,42,0.05)` — toolbar buttons
- `2`: `0 2px 4px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)` — cards
- `3`: `0 6px 12px rgba(15,23,42,0.08), 0 12px 32px rgba(15,23,42,0.06)` — modals
- Use *one* elevation level per component, never stack.

### Spacing for the role dashboards specifically
- Phone: `gap: 12px` between action tiles; tile `min-height: 88px`; tile padding `12px`; tile border-radius `12px`; tile label line-height `1.2` (two-line titles OK, never three).
- Desktop: same tile, `min-height: 96px`, set as 4 across at the existing `sm:grid-cols-4` breakpoint (not 10 — see defect map).

---

## 3. Components — proposed shapes (5 core, with phone + desktop variants)

### Button (3 variants — primary, secondary, ghost)
- **Phone min-height: 44px.** Desktop: 36px (or auto with padding ≥ 12px).
- Radius: 8px.
- Primary bg: `accent/0`. Secondary bg: `bg/3`. Ghost: transparent + `accent/0` text.
- Primary text: always `#ffffff` for AA on `accent/0`.
- Disabled: text/2 + bg/2.
- Loading state: pulse opacity 0.5 ↔ 1.0, text remains visible (no spinner-only state).

### Input + Picker (replaces native `<select>` for primary pickers)
- Border `1px solid border/0`. Focus: `2px solid accent/0`.
- Phone min-height: 44px. Desktop: 40px.
- Picker (the custom dropdown): button + popup; popup has `shadow/2` + `radius/md`; max-height 60vh; scrollable; selected item highlighted with bg/2 + accent/0 text on the radio indicator.
- **All `src/components/FormFields.tsx` `<select>` instances in role-impact flows become `Picker` components:** `<VendorSelect>`, `<SkuSelect>`, `<LocationSelect>`, `<CustomerSelect>`, `<BillSelect>`. The 5 utility surfaces in `FormFields.tsx` are the natural migration target.

### Card (the role-dashboard tile)
- Phone: full-width, `min-height: 88px`, padding 12px, radius 12px, border `1px solid border/1`.
- Desktop: same shape, set in a 2-4 column grid.
- Title: text/0 16px semibold, line-height 1.2, max 2 lines (truncate with ellipsis on third-line overflow).
- Subtitle (icon caption): text/2 13px regular, single line, ellipsis on overflow.
- Action arrow icon (top-right): hidden on phone (avoids clutter), shown on desktop hover only.

### Nav (the Layout top bar AND a new bottom tab on phone)
- Top bar (always present):
  - Phone: logo + role badge + overflow menu (3-dot or hamburger) only.
  - Desktop: full nav links + role badge + notification bell + sign-out.
- Bottom tab bar (phone only, in `MobileShell.tsx` if/when we ship that wrapper):
  - 4 tabs: Home (role-appropriate dashboard), Tasks (`/my-tasks`), Search (`/search`), More (overflow → role switching, sign-out, /learn).
  - Sticky to viewport bottom, `env(safe-area-inset-bottom)` respected, 56px high.
  - Active tab: accent/0 icon + label, 2px top border in accent/0; inactive: text/2 icon + label.

### Notification bell (existing `NotificationBell.tsx`)
- Phone: stays in the header, but if the bottom tab is present, the bell moves to the top-right of the top bar (alongside the overflow menu).
- Desktop: unchanged.
- A subtle red dot for unread count; full list in a dropdown on tap.

---

## 4. Type scale (preserved + tightened)

| Role | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| Display (hero) | 32/40 (phone/desktop) | 700 | 1.10 | -0.02em |
| H1 | 24 | 600 | 1.20 | -0.01em |
| H2 | 20 | 600 | 1.25 | normal |
| Body | 16 | 400 | 1.50 | normal |
| Small / caption | 14 | 400 | 1.40 | normal |
| Label / button | 14 | 500 | 1.20 | normal |
| Micro (timestamps) | 12 | 400 | 1.30 | normal |

System font stack unchanged. No custom font loaders (current state has zero; preserving).

---

## 5. Motion (new — light)

- Page transitions: 0ms. Jayshankar is a data-entry app; transitions compete with thumb tap timing.
- Touch feedback (button, tile): `scale(0.97)` + opacity 0.85, 100ms in / 150ms out, ease-out.
- Skeleton loaders: subtle 1.5s shimmer, light gray placeholder, used for queries that take > 400ms (matching current `useMyTasks` and `useEnsureCheckedIn` patterns in `src/lib/tasks.ts`).
- Reduce motion: `@media (prefers-reduced-motion: reduce)` zeroes every transition.

---

## 6. Accessibility floor (every component, not just the promoted ones)

- Focus ring: 2px solid accent/0, 2px offset, always visible on `:focus-visible`.
- Color contrast: AA on all text/background pairs; AAA (7:1+) for primary text on the most-touched surfaces.
- Touch targets: 44×44 px minimum.
- Form labels: explicit `<label for>` (not placeholder-as-label).
- ARIA: every picker is `role="combobox" aria-expanded aria-controls`; every bottom-tab is `role="tab" aria-selected`; every notification bell has `aria-label` + `aria-expanded` + the badge count in `aria-live="polite"`.

---

## 7. What this draft does NOT prescribe

- Dark theme tokens — held pending a direction pick. Linear/Warp/Superhuman templates are dark-first and would need a parallel token block if chosen; Notion/Stripe templates are light-first and would only need the current block refined.
- Custom font choice — held. System stack is preserved; if a direction wants a specific font (e.g., sohne-var for Stripe-style), that's a separate token pass.
- Icon library — held. Jayshankar uses Heroicons today (`lucide-react`-based shapes); not recommending a change.
- Real chart library — held. Looker Studio covers charts per D26; no in-app charts in this draft.

---

## 8. Acceptance criterion (for §8 of SPEC.md, when promoted)

"§8.X Mobile-shape acceptance. At 390×844 viewport, every role-home page renders all primary actions as phone-sized tiles (≥44px tall, ≥88×88 effective hit area, two-line label max) with no off-canvas content, no clipped labels, and no more than one screen of vertical scroll to reach the *last* primary action. At 1440×900 viewport, the same pages render as their current desktop layouts without any mobile-shape-specific override. PASS criteria verified by Playwright screenshot pair (390×844 + 1440×900) captured against a real signed-in session for each of the 5 roles; defects from the static-analysis defect map (Appendix B of the audit) are reduced by ≥80%."
