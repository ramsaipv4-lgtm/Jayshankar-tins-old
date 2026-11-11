# Frontend Overhaul — Design Document

> **Status (as of 2026-08-14):** Deferred. The current Mode A demo is live at
> `fanciful-naiad-cb42ba.netlify.app`. The wholesale client is reviewing the demo
> first; the overhaul will only begin after client sign-off. This document captures
> the full design so a future session can resume work without context loss.

---

## 0. Why this exists

The Mode A demo shipped on 2026-08-13 (see `lib/patterns/private-to-public.md`
for the release workflow). The wholesale client is happy with the demo but
flagged 3 areas that need a redesign before Pilot: the empty state on
`FloorDashboard` is too plain; the `RecentActivity` table is unreadable on
phones; the 4 mutation buttons (record arrival, record sale, record transfer,
record adjustment) are buried in a sub-page. This document captures the full
design for the overhaul so a future session can resume work without re-deriving
the design from scratch.

The pattern is a *plan document* (vs. a recipe or rubric). It captures what
would be done, in what order, with what tradeoffs, but does not bind the
builder to any specific implementation. The kit adopts the plan-document
flavour as a first-class pattern type alongside recipes and rubrics.

## 0. Preamble

### 0.0 Cheapest version that would work

The cheapest improvement that would meaningfully upgrade the demo without a full
overhaul:

1. Add a "Welcome modal" overlay that appears on first sign-in, with 3 buttons:
   "Continue as admin / rep / worker" — one click goes to that role's dashboard.
   ~30 minutes. Three text strings + one modal component.
2. Show the same modal on the dashboard if `localStorage.jayshankar-tour-done !== 'true'`.
   ~15 minutes.
3. Replace the flat `RecentActivity` table with a vertical timeline (icon + relative
   timestamp + content). ~1 hour.
4. Add the live-total calculator to mutation forms. ~30 minutes.
5. Move the 4 mutation buttons into a sticky sub-nav on rep/worker dashboards. ~1 hour.

**Total: ~4 hours.** These 5 changes alone would make the demo feel "modern" without
touching the architecture.

The expensive version below buys the full 13-step overhaul: a polished sign-in
flow, sub-nav, design tokens, guided tour, realtime updates. Worth ~30 hours but only
when the client signals a real commitment.

### 0.1 What this document is

This is the **design document for the deferred frontend overhaul** of Jayshankar.
It captures:

- Goals and non-goals
- Locked design decisions (§0.2)
- The patterns we adopted from a v0.dev reference export
- The 13-step implementation plan (§3)
- Per-role tour scripts (§4)
- Design tokens for the new visual system (§5)
- Component-by-component changes (§6)
- Risks (§7)
- Acceptance criteria (§8)
- What is NOT being done (§9)
- How to resume work (§10)

It follows the tins-kit §0-§9 structure, scaled to a single design document.

### 0.2 Locked design decisions

| # | Decision | Resolution |
|---|---|---|
| **D1** | **Adopt patterns from v0.dev reference export.** | v0 generated a polished Next.js+shadcn export. We port the visual patterns (split-screen sign-in, hero with three feature cards, role-colored nav, eyebrow headers, timeline activity, progress bars on stock levels) into the existing Vite+React+Tailwind stack. We do NOT adopt the v0 stack (Next.js, shadcn, lucide-react, etc.) — locked at Vite + React 18 + Tailwind 3 + plain CSS components. |
| **D2** | **Design tokens via `tailwind.config.ts`.** | Extend the existing `tailwind.config.ts` with semantic shadow utilities (`shadow-card`, `shadow-card-hover`, `shadow-modal`), the `rounded-card` radius, and CSS variables for the color palette. Keep the existing `indigo-600` primary. Use Tailwind utility classes only; no CSS-in-JS, no inline styles except dynamic values. |
| **D3** | **Sub-nav pattern.** | Replace the dashboard-page action buttons with a sticky sub-nav under the top bar. Each role sees different nav items: admin sees `[Stock] [Vendors] [SKUs] [Audit log]`, rep sees `[Dashboard] [+ Delivery] [+ Sale] [+ Transfer] [+ Spoilage]`, worker sees `[Floor] [+ Transfer] [+ Spoilage]`. Active state has a 2px bottom border in `brand/primary`. |
| **D4** | **Sign-in split-screen.** | Replace the current centered sign-in card with a 480×560px split-screen: left panel is indigo gradient with logo + tagline + 3 feature bullets, right panel is white with the form + 3 demo-credential chips that autofill on click + show/hide password toggle. |
| **D5** | **Demo banner opt-in.** | Add an opt-in "first-time visitor" hint above the sign-in card: "🐟 Demo mode. Three accounts are pre-seeded. Click a chip below." Hidden after first successful sign-in (tracked via `localStorage.jayshankar-visited`). Off by default in production builds. |
| **D6** | **Guided tour, localStorage-backed.** | A new `Tour` component (~150 lines) takes a list of steps and shows a focused overlay (dark backdrop + tip card). Steps are stored in `src/lib/tourSteps.ts`. Re-opened from the user menu dropdown. First auto-show after sign-in, dismissable via `[Skip]`. |
| **D7** | **Per-role tour scripts.** | Admin: 13 steps. Vendor-rep: 11 steps. Worker: 10 steps. Each step targets a specific UI element via a `data-tour-id` attribute. Steps cover every interactive feature including the data-flow (where mutations go, who sees them). |
| **D8** | **RecentActivity as vertical timeline.** | Replace the current flat table with a vertical list. Each entry: relative timestamp left, colored icon-dot middle, content right. Icon colors match the existing KIND_STYLES palette. |
| **D9** | **Stock-by-SKU progress bars.** | Add a progress bar per row showing `totalKg / lowStockThresholdKg` ratio. Color logic: red if `ratio < 1`, amber if `1 ≤ ratio < 2`, emerald if `ratio ≥ 2`. Capped at 100% width. "Low" pill badge when ratio < 1. |
| **D10** | **Mutation forms: 2-column with live total.** | Refactor all 4 mutation forms to a 2-column grid (`md:grid-cols-[2fr_3fr]`): left column for "what" (vendor, SKU, location), right column for "how much" (kg, price, reason, notes). Below the kg+price inputs, show a `Total: ₹X` preview that updates live as the user types. Uses `en-IN` locale for currency formatting. |
| **D11** | **Admin SKU management (in-app CRUD).** | A new `/admin/skus` page with a list of SKUs (including soft-deleted, dimmed) and a "Add SKU" button. Form fields: code (uppercase regex `/^[A-Z]{3,6}$/`), english_name, tamil_name, shelf_life_hours (1–168), low_stock_threshold_kg (>0). Soft-delete via `active=false`. RLS already permits. |
| **D12** | **Realtime subscriptions for cross-device sync.** | Add `src/lib/realtime.ts` (~40 lines) wiring `supabase.channel('movements-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'movements' })` to invalidate TanStack Query cache. Required migration `0006_enable_realtime.sql` adds `ALTER PUBLICATION supabase_realtime ADD TABLE movements, batches;` (idempotent). After change, a delivery in browser A appears in browser B within 1 second instead of 30 seconds. |
| **D13** | **No new runtime dependencies.** | Per project policy. The overhaul ships with zero new npm packages. All patterns use built-ins: lucide-react icons become emoji (📦💰↔️🗑), shadcn components become plain Tailwind, class-variance-authority becomes inline conditional classes, clsx becomes a 3-line `cn()` helper in `src/lib/cn.ts`. |

---

## 1. Goals

- **Make the demo feel modern and professional** without changing the architecture.
- **Reduce the learning curve** for new users via an in-app guided tour.
- **Match Zoho Inventory's visual sophistication** without copying their feature breadth.
- **Show cross-device live updates** to demo the realtime capability to the client.
- **Make SKUs manageable in-app** (the wholesaler will need to add seasonal fish).

## 2. Non-goals (out of scope)

- POS / checkout UI (SPEC §9, D15)
- GST invoicing
- Customer CRM
- Supplier contracts
- Multi-store / multi-tenant
- iOS-specific PWA optimization (SPEC D13)
- Offline write-queue (SPEC §9, D6)
- Reverse-sale / voiding a sale
- Multi-currency
- New runtime dependencies (D13 above)
- Touching `Jayshankar-clean/` (live deployed demo, off-limits until client sign-off)

---

## 3. Adopted patterns from v0.dev reference export

A `v0.dev` export was generated on 2026-08-13 as a visual reference. We do not adopt
its stack (Next.js, shadcn/ui, lucide-react, etc.), but we adopt these visual patterns:

| # | Pattern | Source | Where to apply |
|---|---|---|---|
| 1 | Split-screen sign-in card with gradient brand panel + form panel | `app/signin/page.tsx` lines 56-170 | `src/components/SignInForm.tsx` rewrite |
| 2 | Three "How it works" feature cards (Truck, ShoppingCart, Trash2 icons + tile bg colors) | `app/page.tsx` lines 21-40 | `src/pages/Landing.tsx` (new file, optional step 6.5) |
| 3 | Three "Roles" cards with role-colored tile backgrounds | `app/page.tsx` lines 42-61 | `src/pages/Landing.tsx` |
| 4 | "Three simple things to log" copy | `app/page.tsx` lines 205-247 | `src/pages/Landing.tsx` |
| 5 | Page hero pattern (eyebrow + h1 + subtitle) | `app/admin/page.tsx` lines 36-41 | All 3 dashboards |
| 6 | 4-up stat tiles with icon-in-tinted-square | `app/admin/page.tsx` lines 43-58 | `src/pages/AdminDashboard.tsx` |
| 7 | Eyebrow header (`text-xs uppercase tracking-[0.12em]`) | `app/admin/page.tsx` line 29-31 | `src/components/Eyebrow.tsx` (new) |
| 8 | Stock-by-SKU progress bar with 3-tier color logic | `app/admin/page.tsx` lines 93-103 | `src/components/StockBySku.tsx` rewrite |
| 9 | RecentActivity vertical timeline with connector line | `components/activity-timeline.tsx` | `src/components/RecentActivity.tsx` rewrite |
| 10 | Expiring-soon banner with triangle alert icon | `app/floor/page.tsx` lines 31-38 | `src/pages/FloorDashboard.tsx` |
| 11 | Live total calculator (`useMemo` + `toLocaleString("en-IN", {style: "currency", currency: "INR"})`) | `app/rep/delivery/page.tsx` lines 36-41 | All 4 mutation forms |
| 12 | Form `Field` wrapper with `` + spacing | `app/rep/delivery/page.tsx` lines 14-21 | Replace existing `FormField` in `src/components/FormFields.tsx` |
| 13 | Show/hide password toggle | `app/signin/page.tsx` lines 118-127 | `src/components/SignInForm.tsx` |

All 13 patterns are adoptable with plain Tailwind 3 and React 18. No new dependencies.

---

## 4. Per-role tour scripts

The `Tour` component takes a list of `{ target, title, body, placement }` steps.
Steps target UI elements by `[data-tour-id="..."]` attributes.

### 4.1 Admin tour (13 steps)

1. **Welcome modal** — "Welcome to Jayshankar, Karthik. This is a quick 2-minute tour. You can skip it or restart it from your avatar menu. [Start tour] [Skip]"
2. **Top-right avatar menu** — "Click your avatar to sign out, restart this tour, or switch accounts."
3. **Sub-nav "Stock"** — "This shows your current inventory by SKU. Low-stock items are highlighted."
4. **Sub-nav "Vendors"** — "Your 6 suppliers. Click any row to see the batches they delivered."
5. **Sub-nav "SKUs"** — "25 fish SKUs with Tamil + English names."
6. **Sub-nav "Audit log"** — "Every mutation is recorded. Filter by table, user, or date."
7. **First stat tile ("Batches")** — "These are your live counts. Updates within 1 second of any change."
8. **Stock by SKU row** — "Each row shows kg vs. threshold. The colored bar tells you at a glance if you're running low."
9. **Recent activity row** — "Every action you, the rep, and the worker have done, in reverse chronological order."
10. **Audit log CTA** — "Click here to see who did what, when."
11. **Offline banner** — "When you see this banner, you can still browse but mutations are paused. Reconnect to resume."
12. **Keyboard shortcuts** — "Tab moves between fields. Enter submits. Esc closes modals."
13. **Closing reminder** — "Every change is audited. Sign out from your avatar menu when you're done."

### 4.2 Vendor-rep tour (11 steps)

1. Welcome modal — "Welcome, Anitha. You're the vendor-rep. You record deliveries and sales."
2. Sub-nav "Delivery" — "Record a new delivery from a fisherman. Pick vendor, SKU, location, kg, and price paid."
3. Sub-nav "Sale" — "Record a sale. FIFO auto-deducts from the oldest batch."
4. Sub-nav "Transfer" — "Move stock between storage and display."
5. Sub-nav "Spoilage" — "Mark waste. Choose a reason so the wholesaler can spot patterns."
6. **Live total calculator** — "The total updates live as you type kg and price."
7. Vendors table — "Your 6 suppliers. Phone numbers are one tap away for calling."
8. SKUs table — "25 fish SKUs. Code is what's on the printed price tag."
9. Recent activity — "See what you and the workers have done today."
10. **Live update explanation** — "When you record a delivery here, the admin's dashboard updates within 1 second."
11. Signing out — "Click your avatar top-right and choose Sign out. You'll come back to the sign-in screen."

### 4.3 Worker tour (10 steps)

1. Welcome modal — "Welcome, Suresh. You're the floor worker. You move stock and record spoilage."
2. Sub-nav "Transfer" — "Move stock from storage to display, or vice versa."
3. Sub-nav "Spoilage" — "Mark wasted kg. Choose a reason."
4. **Expiring-soon banner** — "When this banner appears, sell those batches first or record spoilage."
5. **Active batches row** — "Each row is a batch with kg remaining and an expiry time. Sort by expiry to find what's about to spoil."
6. **[Spoil] button** — "Click to record spoilage on that batch directly."
7. Recent activity — "See what the team has done today."
8. Live updates — "When Anitha records a delivery, you'll see the new batch in this table within 1 second."
9. Keyboard — "Tab moves between fields. Enter submits."
10. Signing out — "Click your avatar top-right and choose Sign out."

---

## 5. Design tokens

Semantic colour/spacing/typography decisions. The ASCII tree is for paste into Penpot
or similar design tools.

### 5.1 Colour palette

| Token | Light | Used for |
|---|---|---|
| `color/brand/primary` | `#4F46E5` indigo-600 | Primary buttons, links, active states |
| `color/brand/primary-hover` | `#4338CA` indigo-700 | Hover state of primary buttons |
| `color/brand/primary-soft` | `#EEF2FF` indigo-50 | Tinted backgrounds (role badges, hover rows) |
| `color/surface/canvas` | `#F8FAFC` slate-50 | App background |
| `color/surface/raised` | `#FFFFFF` white | Cards, tables, modals |
| `color/surface/sunken` | `#F1F5F9` slate-100 | Table headers, code blocks, dividers |
| `color/border/default` | `#E2E8F0` slate-200 | Card borders, table dividers |
| `color/border/strong` | `#CBD5E1` slate-300 | Input borders, focus borders |
| `color/text/primary` | `#0F172A` slate-900 | Body text, headings |
| `color/text/secondary` | `#475569` slate-600 | Captions, metadata |
| `color/text/muted` | `#94A3B8` slate-400 | Hints, placeholders, dividers |
| `color/feedback/success` | `#059669` emerald-600 | Success toasts, "stock OK" badges |
| `color/feedback/warning` | `#D97706` amber-600 | Low-stock warnings, offline banner |
| `color/feedback/danger` | `#DC2626` red-600 | Errors, destructive actions |
| `color/role/admin` | `#4F46E5` indigo | Admin role badge |
| `color/role/vendor-rep` | `#059669` emerald | Vendor-rep role badge |
| `color/role/worker` | `#475569` slate | Worker role badge |

### 5.2 Spacing scale

`space/2xs` 4px, `space/xs` 8px, `space/sm` 12px, `space/md` 16px,
`space/lg` 24px, `space/xl` 32px, `space/2xl` 48px. All Tailwind defaults.

### 5.3 Typography

| Token | Size / weight | Used for |
|---|---|---|
| `type/display` | 30px / 700 / -0.02em | Sign-in title |
| `type/h1` | 24px / 600 / -0.01em | Page titles |
| `type/h2` | 20px / 600 / -0.01em | Section headers |
| `type/h3` | 16px / 600 | Card titles |
| `type/body` | 15px / 400 / lh-24 | Form body, table cells |
| `type/label` | 14px / 500 | Form labels, button text |
| `type/caption` | 12px / 500 / uppercase | Eyebrow labels, table metadata |

### 5.4 Radii & shadows

- `rounded-sm` 6px → buttons, inputs, badges
- `rounded-md` 8px → cards, tables, modals
- `rounded-lg` 12px → hero cards, sign-in card
- `rounded-full` 9999px → role badges, status pills
- `shadow-card` `0 1px 2px rgba(15,23,42,0.06)` → cards default
- `shadow-card-hover` `0 4px 12px rgba(15,23,42,0.08)` → cards on hover
- `shadow-modal` `0 12px 32px rgba(15,23,42,0.12)` → modals, dropdowns

---

## 6. Component-by-component changes

| File | Action | Effort |
|---|---|---|
| `tailwind.config.ts` | Extend with shadow utilities, `rounded-card` | 5 min |
| `src/index.css` | Add `@layer components` for Card/Button/Badge primitives | 10 min |
| `src/components/Layout.tsx` | Rewrite: sticky top bar + sub-nav + UserMenu | 1 hour |
| `src/components/SignInForm.tsx` | Rewrite: split-screen + demo chips + show/hide password | 1.5 hours |
| `src/components/RecentActivity.tsx` | Rewrite: vertical timeline | 1 hour |
| `src/components/StockBySku.tsx` | Rewrite: progress bars + low-stock pills | 1 hour |
| `src/components/Eyebrow.tsx` | New: reusable uppercase label component | 5 min |
| `src/components/UserMenu.tsx` | New: avatar + dropdown (sign out, restart tour) | 30 min |
| `src/components/Tour.tsx` | New: focused overlay + tip card | 1.5 hours |
| `src/components/TourContext.tsx` | New: provider for tour state | 20 min |
| `src/components/SkeletonRow.tsx` | New: loading state for tables | 15 min |
| `src/components/OfflineBanner.tsx` | Polish: add icon, softer tone | 15 min |
| `src/components/RoleBadge.tsx` | Polish: rounded-full, icon prefix | 10 min |
| `src/components/FormFields.tsx` | Polish: update `inputCls`, add `aria-describedby` | 30 min |
| `src/lib/auth.ts` | No change | 0 |
| `src/lib/supabase.ts` | No change | 0 |
| `src/lib/mutations.ts` | No change | 0 |
| `src/lib/online.ts` | No change | 0 |
| `src/lib/cn.ts` | New: 3-line className helper | 5 min |
| `src/lib/realtime.ts` | New: realtime subscription wiring | 30 min |
| `src/lib/tourSteps.ts` | New: 13/11/10 step arrays | 30 min |
| `src/pages/AdminDashboard.tsx` | Rewrite: page hero + stat tiles + Eyebrow | 1 hour |
| `src/pages/RepDashboard.tsx` | Rewrite: page hero + quick-action cards | 1 hour |
| `src/pages/FloorDashboard.tsx` | Rewrite: page hero + expiring-soon banner + Eyebrow | 1 hour |
| `src/pages/AuditLog.tsx` | Polish: sticky filter bar + diff view | 1.5 hours |
| `src/pages/DeliveryForm.tsx` | Rewrite: 2-column + live total | 45 min |
| `src/pages/SaleForm.tsx` | Rewrite: same pattern | 30 min |
| `src/pages/TransferForm.tsx` | Rewrite: same pattern | 30 min |
| `src/pages/SpoilageForm.tsx` | Rewrite: same pattern | 30 min |
| `src/pages/AdminSkus.tsx` | New: in-app SKU CRUD page | 2 hours |
| `src/App.tsx` | Add `/admin/skus` route, wrap in `` | 15 min |
| `src/main.tsx` | No change | 0 |
| `supabase/migrations/0006_enable_realtime.sql` | New: enable Realtime for movements + batches | 10 min |
| `scripts/validate.mjs` | New check: `0006_enable_realtime.sql` exists with expected statement | 5 min |
| `scripts/selftest.mjs` | New defect test for the Realtime check | 10 min |

**Total: ~25 hours** (less than my earlier 30h estimate due to consolidation).

---

## 7. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | `data-tour-id` attributes get out of sync between tour steps and components | Medium | Tour shows empty spotlight | Add validator check: every tour target exists in DOM |
| 2 | Live total calculator doesn't update for users with disabled JS | Low | Low | Form requires JS anyway (it's an SPA); no-JS users aren't a target |
| 3 | Realtime connection fails on networks that block WebSockets | Medium | Cross-device sync stops working | TanStack Query still polls on focus; degrade gracefully |
| 4 | Progress bars render incorrectly at extreme ratios (>5x threshold) | Low | Visual oddity | Cap width at 100%; ratio > 5 still shows full emerald bar |
| 5 | Tour overlay z-index conflicts with modals | Low | Tour hidden behind dialogs | z-index: 50 for tour, 40 for modals |
| 6 | New SKU form lets admins bypass code regex via SQL injection | Low | Bad data in DB | RLS already gates; Supabase client uses parameterized queries |
| 7 | Browser cache shows stale bundle after deploy | Medium | Old UI shows | Netlify sets Cache-Control headers correctly; SW handles versioning |
| 8 | Tab order breaks when new components are added | Medium | A11y regression | Test with keyboard nav after each step |

---

## 8. Acceptance criteria

The overhaul is "done" when:

- [ ] Validator runs 65+ checks (added: realtime migration check, tour-target IDs check), all green
- [ ] Selftest runs 9+ tests (added: realtime migration defect), all green
- [ ] Build succeeds with zero TypeScript errors
- [ ] Sign-in page shows split-screen with demo chips that autofill
- [ ] First-time sign-in triggers tour; tour has correct step counts per role (13/11/10)
- [ ] Tour can be restarted from user menu; dismissable via `[Skip]`
- [ ] All 4 mutation forms have live total calculator
- [ ] Stock-by-SKU table shows progress bars with correct 3-tier color logic
- [ ] RecentActivity shows as vertical timeline with relative timestamps
- [ ] Admin can navigate to `/admin/skus` and create/edit/deactivate a SKU
- [ ] Recording a delivery in browser A appears in browser B within 1 second (verified manually)
- [ ] Offline banner still works (existing SPEC §2.14 behavior preserved)
- [ ] Keyboard navigation: Tab through every form, Enter submits
- [ ] Lighthouse score: Performance > 90, Accessibility > 95

---

## 9. Out of scope (NOT being done)

This is explicit. The following are deliberately excluded from the overhaul:

- POS / checkout UI (SPEC §9 D15)
- GST invoicing (SPEC §9 D15)
- Customer CRM (SPEC §9 D15)
- Supplier contracts (SPEC §9 D15)
- Multi-store / multi-tenant (SPEC §9 D15)
- Barcode scanning
- Photo capture
- Multi-currency
- Full Tamil/Hindi UI translations (we render the existing seed names but don't translate UI strings)
- iOS-specific PWA optimization (SPEC D13)
- Offline write-queue (SPEC §9 D6) — read-only offline remains
- Reverse-sale / voiding a sale
- New runtime dependencies (D13)
- Changes to `Jayshankar-clean/` until gatekeeper sign-off
- Re-deploying to Netlify until gatekeeper sign-off

---

## 10. How to resume work

The work is paused. To resume:

### 10.1 Pre-flight checklist

```bash
# In c:\Users\user\Desktop\Jayshankar-clean\
npm install                # ~30 sec, ensures deps are current
npm run validate           # 62/62 expected
npm run selftest           # 7/7 expected
npm run build              # should succeed
```

### 10.2 Implementation order

The 13 steps are ordered by dependency. Earlier steps are foundation; later steps build on top.

| Order | Step | Component(s) | Blocks |
|---|---|---|---|
| 1 | Tokens (`tailwind.config.ts` + `src/index.css`) | Tailwind setup | All later steps |
| 2 | Layout (sub-nav + UserMenu + OfflineBanner polish) | `src/components/Layout.tsx` | All dashboards |
| 3 | Sign-in (split-screen + demo chips + show/hide password) | `src/components/SignInForm.tsx` | Tour entry point |
| 4 | Dashboards (page hero + stat tiles + Eyebrow) | All 3 dashboards | Tour |
| 5 | Tables (StockBySku progress + RecentActivity timeline) | `src/components/StockBySku.tsx`, `RecentActivity.tsx` | None |
| 6 | Forms (2-column + live total) | 4 mutation forms | None |
| 7 | Audit log + Empty states + Skeletons | `AuditLog.tsx`, all pages | None |
| 8 | Tour (TourContext + Tour + tourSteps + UserMenu integration) | `src/components/Tour.tsx`, `src/lib/tourSteps.ts`, `src/App.tsx` | All previous |
| 9 | Admin SKU management | `src/pages/AdminSkus.tsx` + route | None |
| 10 | Realtime subscriptions | `src/lib/realtime.ts`, `0006_enable_realtime.sql`, validator check | None |

After each step: run the gate. If green, commit (one commit per step recommended for easy rollback).




### 10.3 Rollback strategy

If a step breaks something:

1. Run `git log --oneline -10` to find the offending commit.
2. Run `git revert <commit>` to undo it.
3. Verify the gate still passes (`npm run validate && npm run selftest && npm run build`).
4. Continue with the next step.

If multiple steps have been committed, revert in reverse order (newest first).

### 10.4 When the overhaul is "done"

After step 10:

1. Run the gate one more time:
   - `npm run validate`
   - `npm run selftest`
   - `npm run build`
2. Manual smoke test in 2 browsers (admin on Chrome, rep on Edge) for cross-device realtime.
3. Run a Lighthouse score check (target: Performance > 90, Accessibility > 95).
4. Commit all changes.
5. **Defer the redeploy** until the gatekeeper has signed off on the current Mode A demo.

## 11. References

**Gitignored methodology-internal docs** (in `Jayshankar/`, not `Jayshankar-clean/`):

- `AGENTS.md` — onboarding
- `HANDOVER.md` — work system
- `BUILDER-DECISIONS-REVIEW.md` — decision log
- `SPEC.md` — original spec

**Kit reference** (in `Jayshankar/tins-kit/`):

- `tins-kit/SPEC.md` — kit's own spec
- `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md` — decision log template
- `tins-kit/lib/patterns/private-to-public.md` — companion kit module (to be added)

**The v0.dev reference export** is at `C:\Users\user\Desktop\jayshankar-inventory-demo.zip` (gitignored). The extracted contents are at `C:\Users\user\AppData\Local\Temp\jayshankar-extract\` for visual reference only — do not commit.

---

## When this changes

- **If the wholesale client signs off on the demo and unblocks the overhaul**:
  start work on §6 (component-by-component changes) in priority order (the
  3-tier empty-state rubric, the activity timeline, the sticky sub-nav).
- **If a new framework is adopted** (e.g. the client wants Vue instead of React):
  re-do §6 with the new framework's component library; §1–§5 still apply.
- **If the design tokens change** (§5): re-export the v0.dev design tokens to
  the consumer's `tailwind.config.ts` and update the per-role tour scripts.
- **If the kit's "plan document" pattern type is deprecated**: this document
  becomes an `archive/` artefact and the next overhaul is captured as a
  `SPEC-AMENDMENT-vN.md` instead.

---

*Last updated: 2026-08-14. Status: deferred pending gatekeeper sign-off.*

---

*— End of `FRONTEND-OVERHAUL` pattern. See also: `private-to-public.md`
(the release workflow), `empty-states.md` (the 3-tier empty-state rubric).*

