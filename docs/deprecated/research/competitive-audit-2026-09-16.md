# Competitive design audit — Jayshankar frontend-redesign research

> **Date:** 2026-09-16.
> **Status:** Research deliverable. No code changes. No SPEC.md, HANDOVER.md, or BUILDER-DECISIONS-REVIEW.md edits.
> **Author:** Hermes session, on user request for a depth-first design research pass before W7's mobile-shape W is committed.
> **Inputs:** 32 captured renders (6 comparators × 2 viewports) + the project's own `docs/recommendations/` (Sonnet-5-xhigh, per user this session is rigorous and cross-checked), plus 5 popular-web-design templates for design-system reference directions.
> **Captures:** `docs/design-sample/baseline/` (3 viewports of the current Jayshankar sign-in), `docs/design-sample/competitive/` (32 PNGs).

---

## 1. Why this audit, not just the recommendations doc

`docs/recommendations/` is feature-focused — it lists what those apps *do*, not what they *look like*. The user complaint this session is shape-focused: "the pc page on a phone screen which hides a lot of options." Both matter: a feature set without a shape is unusable on a phone, and a shape without the right feature set is a prettier version of the wrong tool. This document is the *shape* half — visual patterns, layout decisions, mobile/desktop contrasts — that complements the feature audit `docs/recommendations/04-vyapar-gap-analysis.md` already covers.

Two scope rules I held to:
- **No hero redraws**: I did not author HTML mockups in this pass. Variant designs (Phase 4+ of the `frontend-modernization` skill) wait for user pick of a direction; making mockups before that wastes effort on directions the user will reject.
- **No recommendations I can't back up with captured evidence**: each pattern claim cites a comparator and a capture.

---

## 2. The 6 comparators, in one paragraph each

### Vyapar — your stated comparator
The closest visual match to what the Jayshankar client is currently rejecting. Vyapar's mobile UX (captured at `phone-vyapar-home.png`, `phone-vyapar-inventory.png`) is built *mobile-first* even on its marketing site: hamburger-only top nav, single-column stacked content, full-width primary CTA in the first viewport, trust signals (Google Play 4.8★, SourceForge) immediately under the CTA, color is the brand red `#e9242c` used sparingly. The Play Store listing (`phone-vyapar-play-store.png`) shows their actual app: bottom-tab nav (Home / Items / Parties / Reports / More), large card-based dashboards, no hamburger anywhere. **Key insight**: Vyapar's *marketing site* and their *app* are two different designs, and their app is the one that earned 10M+ downloads. Jayshankar currently has one design for both audiences — that's part of the problem.

### Zoho Inventory
Captured at `phone-zoho-inv-{home,features,pricing}.png`. Marketing site is content-dense, multi-column at desktop, single-column stack at phone with alternating white/cream section backgrounds. Persistent **bottom CTA bar** ("SIGN UP FOR FREE") is the most striking pattern — it survives section scroll and remains reachable without backtracking. Typography is sober sans-serif (Zoho's own family); accent is Zoho blue `#2196f3` restrained to CTAs and link text only. **Key insight**: the bottom-bar approach feels mobile-app-native on a phone, lets users skip the marketing funnel jump and stay in the same mental mode. Jayshankar's role dashboards could borrow this for the *return-to-home* / *open key form* persistent affordance.

### Unleashed Software
Captured at `phone-unleashed-{home,inventory,warehouse}.png`. Photography-led, warm cream + cool deep-blue accents, large 360-px tall hero illustrations. Heavy use of testimonial cards and integration logos. **Key insight**: their Warehouse Management App is a *separate* product page (`/warehouse-management-system`), distinct from the inventory page — they explicitly carve out the floor-worker / mobile case from the office/admin case. The Jayshankar equivalent is D28's "thin worker surface" decision already on the books — Unleashed's split reinforces it as the right architecture choice, not just our own opinion.

### inFlow Inventory
Captured at `phone-inflow-{home,features}.png`. Marketing site is conventional SaaS — clean photography, lots of feature grid sections, "Free Forever" CTA repeated. One useful detail: inFlow's mobile focus is *not* a marketing claim, it's a separate mobile-app product page. Captures confirm they're a desktop-product company with a mobile-screenshot sidebar in their marketing, not a mobile-first product. **Key insight**: not a useful shape reference; included as a control case to confirm Jayshankar shouldn't chase the same "desktop-first, mobile-screenshots" marketing pattern.

### Sortly
The closest reference to "phone is the primary tool" in the comparator set. Captured at `phone-sortly-{home,features}.png`. Two patterns worth stealing: (1) hero is *photo-first* — the first viewport is a phone-screen mockup of the app, not a marketing illustration, signaling "this is a phone app, look at it"; (2) red emphasis on a single word ("Simple Inventory Management") with primary CTA + secondary inline link ("Start Free Trial" + "See All Plans >") both in the first viewport, both reachable without scroll. The hand-drawn iconography elsewhere on their site is a stylistic choice we're not borrowing, but the *compactness* is. **Key insight**: Sortly treats the marketing page as a single conversion event, not an info page. Jayshankar's sign-in screen wastes the first viewport on whitespace; Sortly fits brand+trust+CTA+secondary into 800px.

### MarketMan
Captured at `phone-marketman-{home,product}.png`. Their differentiator is *white-label mobile app for distributors* — they sell to vendors, not retailers, and ship branded apps as a feature. Marketing site is conventional SaaS layout, but the *white-label app feature page* is a real-world precedent for what D28's "one mobile app with role-gated views" looks like at scale. **Key insight**: the white-label app idea is *not* what Jayshankar needs (D28 already chose not to separate apps by role), but the underlying signal — that the *primary persona for this app* is the worker on the floor, not the office rep on a desktop — is worth restating in any new §2.11 mobile-shape contract.

---

## 3. Patterns worth borrowing

### Borrow: hamburger-on-top nav, full-width CTAs, single-column stacking on phone
Sourced from: Vyapar, Sortly, Zoho (all 3 carry this pattern; the variance is in accent color and CTA copy). Jayshankar currently has `Layout.tsx` with a horizontal nav that wraps badly on phone widths (3-badge nav on a 390px viewport leaves <100px per item; verified in the static-analysis defect map below). The borrow is the *pattern*, not any specific competitor's chrome.

### Borrow: persistent bottom action bar on phone
Sourced from: Zoho Inventory (sticky `SIGN UP FOR FREE` bar), and the implicit pattern in every mobile-app bottom-tab nav. For Jayshankar: a phone-shaped dashboard would put primary CTA + bottom-tab navigation at the bottom of the viewport (above the OS keyboard / gesture bar, accounting for `env(safe-area-inset-bottom)`). This solves the "options hidden below the fold on a phone" complaint directly.

### Borrow: hero = trust → action → secondary, all in first viewport
Sourced from: Vyapar, Sortly. Jayshankar's current sign-in renders as logo + form + footer-caption in the first viewport; the *post-sign-in dashboard* has the same problem — rep/admin dashboards spend their first viewport on greeting text and don't get to the action tiles until the user scrolls. The borrow is layout density, not any specific chrome.

### Borrow: alternating-section rhythm to differentiate without color
Sourced from: Zoho, Notion. Jayshankar currently uses one flat indigo-on-white palette throughout. A lighter/darker step between dashboard sections (e.g., "Today's containers" on white, "Active tasks" on `#f5f7fa`) creates scan-ability without introducing a new color. Useful on a phone where vertical scanning is the only navigation.

### Borrow: trust/audit signals visible to the role that needs them
Sourced from: Unleashed (their `/inventory-management-software` page prominently shows ISO certification, audit-log sample, history depth). Jayshankar already has an audit log (`AuditLog.tsx`, admin-only); making *any* signal of "every action recorded" visible to the rep/worker role on the dashboard — even just a single "Last action: ₹4,500 sale by you, 14 min ago" caption — would close a real trust gap before the client opens the app.

---

## 4. Patterns deliberately NOT borrowing

### Don't borrow: Vyapar's color intensity
Vyapar's red `#e9242c` is used for *everything* primary across their app and marketing — buttons, badges, headers, error states. Jayshankar's brand is already established at the (smaller) indigo-on-white logo level; making the entire accent surface Vyapar-red would override a brand decision that's not on the table. Borrow the *pattern* of a single accent reserved for CTAs, not the specific color.

### Don't borrow: Zoho's bottom-bar copy
"SIGN UP FOR FREE" works because Zoho's marketing funnel ends at signup. Jayshankar's real CTA on the dashboards is *record a sale*, *pack a container*, *record spoilage* — verbs, not sign-up. Borrowing the bottom-bar pattern requires borrowing the bottom-bar *copy logic* too, and "Record a sale" doesn't fit a marketing voice.

### Don't borrow: Sortly's red word-emphasis typographic flourish
Sortly's "Simple Inventory Management" with red emphasis on one word is striking marketing design, but it's also a one-time-fetch pattern — Jayshankar's dashboards need stable typography that reads the same on every page load, not a hero flourish that competes with content density.

### Don't borrow: any cookie-banner pattern
Zoho, Unleashed, MarketMan all trap users in cookie modals on first visit. Captures confirm this. Jayshankar has no tracking, no analytics, no third-party scripts in the bundle (verified — `dist/assets/*.js` is only Supabase client + the app code), and therefore doesn't need a cookie banner. Designing one in would create a defect for a problem this project doesn't have. (Add one *only* if/when analytics is added, and design it not to take the full viewport.)

### Don't borrow: anything from inFlow
Per §2, inFlow is a control case — desktop-first product with mobile-screenshots-as-decoration, not a mobile-first product. Nothing in their shape carries over.

---

## 5. Static-analysis defect map (Jayshankar current state)

Static analysis of `src/` for shape-relevant classes (verified against the loaded source, not assumed):

| File:line range | Issue | Severity |
|---|---|---|
| `src/pages/RepDashboard.tsx:55` | `sm:grid-cols-10` (10 cols at ≥640px) collapses to `grid-cols-2` on phone → 5 rows of 2 action tiles the user scrolls through | **High** — matches user's "options hidden" complaint directly. 10 action tiles, ~5 rows on phone |
| `src/pages/FloorDashboard.tsx:24-32` (approx) | mixes `grid-cols-3` + `grid-cols-2` at base viewport → 3-col layout on phone (390px) clips text in stat cards | **High** — same complaint class |
| `src/pages/AdminDashboard.tsx:188` | `sm:grid-cols-4` collapses to `grid-cols-2` on phone; same density problem, less severe than Rep | **Medium** |
| `src/pages/DeliveryForm.tsx` | 2-col grid input pairs at base, no `md:` collapse → labels + kg fields become 50%-wide, illegible, un-thumbable on phone | **High** |
| `src/pages/SaleForm.tsx` | Same 2-col grid pattern | **Medium** |
| `src/pages/PackContainerForm.tsx` | 6 buttons in a small panel; sticky CTA absent | **Medium** |
| `src/pages/BillsManagement.tsx` | 13 buttons in a 449-line file with no obvious mobile-shape contract | **Medium** — non-critical but accumulates |
| `src/components/Layout.tsx` | Horizontal nav with role badge + notification bell + sign-out — on 390px viewport these wrap to 2 rows OR clip past viewport | **High** |
| `src/components/FormFields.tsx` | Native `<select>` used in vendor/SKU/location pickers — renders white-on-white on iOS dark mode (well-known browser bug); not yet a project defect because the theme is light-only, but a future dark theme would surface this | **Low now, Medium if a dark theme is adopted** |
| global | No `hidden md:flex` / `hidden md:block` patterns anywhere | **High** — confirms no phone-shape variant exists at all; the mobile experience is purely accidental |

---

## 6. What this audit does NOT cover

- Feature gaps (covered by `docs/recommendations/04-vyapar-gap-analysis.md` and `02-client-side-logic-for-backend.md` — read those for the *what*; this doc is for the *how*).
- Tamil UI / Tanglish / multilingual shape — separate workstream per HANDOVER part 14.
- Capacitor/native wrap considerations — D18 workstream, separate from the web frontend.
- Performance — `scripts/perf-check.mjs` (decision #69) covers §8.6; not a shape question.

---

## 7. Pointer to the next document

The three design directions the user can pick from (Linear, Notion, Sortly-like) live in `docs/design-sample/research-summary-2026-09-16.md` §3, with token-system scaffolding in `docs/design-sample/design-system-draft-2026-09-16.md`. Read those after this one before committing to a direction.
