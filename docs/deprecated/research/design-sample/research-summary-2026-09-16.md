# Research summary + 3 directions — Jayshankar frontend-redesign research

> **Date:** 2026-09-16.
> **Status:** End-of-research summary. No code, no SPEC.md / HANDOVER.md / BUILDER-DECISIONS-REVIEW.md edits. Everything below is untracked in `docs/` and `docs/design-sample/`, same shape as the existing `docs/recommendations/`.
> **Read in order:** `docs/competitive-audit-2026-09-16.md` (the comparators) → `docs/design-sample/design-system-draft-2026-09-16.md` (the token draft) → this file (the directions + W7 alignment).
> **Purpose:** user picks a direction (§3 below) → §2 amendment + W7 commit → mockup variants for the chosen direction → production port.

---

## 1. What this research produced

```
docs/
  competitive-audit-2026-09-16.md               13,355 bytes — what comparators do, what to borrow, what to skip, defect map
  design-sample/
    design-system-draft-2026-09-16.md            9,477 bytes — token spec draft, mobile-first principles
    operating-environments-2026-09-16.md       15,469 bytes — the design brief: who, where, what, why each direction
    research-summary-2026-09-16.md              ← this file
    baseline/        desktop/phone/tablet sign-in PNGs × 2 (viewport, full-page) — 6 captures total
    competitive/     16 desktop + 16 phone = 32 PNGs, 6 comparators × 2-3 surfaces each
    field-references/                          20 PNGs of Toast KDS, Onfleet, Bringg, ServiceTitan, Square KDS,
                                               AfterShip, Linear, Notion (real field-tooling, not SaaS marketing pages)
    variants/         (deprecated — first pass; same two screens, three palettes, no design call)
      A1-rep-dashboard.html   + 2 PNGs           Direction A — Sortly + Notion  (palette swap of current rep dashboard)
      A2-pack-form.html       + 2 PNGs           Direction A — pack container form
      B1-rep-dashboard.html   + 2 PNGs           Direction B — Stripe + Linear  (palette swap)
      B2-pack-form.html       + 2 PNGs           Direction B — pack container form
      C1-rep-dashboard.html   + 2 PNGs           Direction C — Linear + Warp  (palette swap)
      C2-pack-form.html       + 2 PNGs           Direction C — pack container form
    variants-real/    ← **the deliverables that demonstrate real design differentiation**
      A1-floor-picklist.html + 2 PNGs            Direction A — Toast-KDS aesthetic, scan+voice bottom bar
      A2-field-sale.html     + 2 PNGs            Direction A — Field sale, scan/voice alternatives
      B1-floor-picklist.html + 2 PNGs            Direction B — Apple Reminders shape, single-hero task card
      B2-field-sale.html     + 2 PNGs            Direction B — iOS bottom-sheet modal over a blurred context
      C1-floor-picklist.html + 2 PNGs            Direction C — Linear-tabular in dark, mono IDs, tabular numerals
      C2-field-sale.html     + 2 PNGs            Direction C — Calculator stepper, dark, offbox-tolerant
    screenshots/    12 PNGs of the 6 variants at 390×844 + 1440×900
```

Zero changes to `src/`, `SPEC.md`, `HANDOVER.md`, `BUILDER-DECISIONS-REVIEW.md`, `supabase/`, `scripts/`, `package.json`, or any tracked file. The first-pass `variants/` folder is kept (deprecated, not deleted) so the contrast between "palette swap of the existing dashboard" and "design call for the operating environment" is auditable in the same folder the user opens. The mockups are self-contained HTML — open any `variants/*.html` directly in a browser to interact (theme toggle on `C1`/`C2`, custom pickers, sticky CTAs).

The capture scripts that produced the PNGs are themselves untracked under `scripts/capture-baseline.mjs` (34 lines) and `scripts/capture-competitive.mjs` (95 lines) — they're cheap to re-run, deliberately not promoted to committed code yet, follow the same "review first, commit second" pattern as the rest of this research.

---

## 2. The headline finding — what the user actually meant

The user said "the pc page on a phone screen which hides a lot of options." The static-analysis defect map in `docs/competitive-audit-2026-09-16.md` §5 confirms this exactly:

| Surface | Phone-collapse behavior | User impact |
|---|---|---|
| RepDashboard's 10 action tiles | `sm:grid-cols-10` → 2 cols on phone = 5 rows of 2 | primary actions for the rep role are *physically* below the fold; user has to scroll 5× the desktop distance to reach "Record a sale" |
| FloorDashboard's 3-col stats | stays 3 cols on phone | stat numbers truncate, labels wrap unpredictably |
| All `<select>`-based pickers | renders natively at fixed size | vendor/SKU/location pickers are tiny on a phone |
| Layout's horizontal nav | wraps to 2 rows | role badge + notification bell + sign-out overlap with content |
| Forms (Delivery / Sale / Pack) | 2-col at base, no `md:` collapse | inputs become 50% width, thumb-unfriendly |
| No `hidden md:` patterns anywhere | — | no deliberate mobile-only shortcuts |

The fix is shape, not features. The 12-feature Tier-1 wins in `docs/recommendations/01-backend-without-frontend-gaps.md` and the 8-view migration in `02-client-side-logic-for-backend.md` are real and worthwhile, **but they don't matter if the client can't reach the screens they're on**. This is the cascade dependency: **mobile-shape contract → feature visibility → recommendations tier items make sense**.

---

## 3. Three directions to pick from

Each direction is named by the design-system template it's closest to. The user said depth, so each includes: a token-level sketch, what it does to W7 (the mobile-shape W), what it leaves untouched, and the trade-off in one line.

### Direction A — **Sortly + Notion: light, content-first, mobile-marketing-grade**
- Surface: light theme + alternating white / warm-cream section backgrounds (`#f6f5f4`, Notion-style).
- Type: Inter (system fallback to current stack), weight 400-500 dominance, no display-bold.
- Accent: indigo `#4f46e5` preserved as the single brand color.
- Phone pattern: hamburger top + sticky bottom-tab nav (4 tabs), action tiles as full-width cards stacked vertically.
- W7 surface change: rewrite `RepDashboard.tsx`, `FloorDashboard.tsx`, `AdminDashboard.tsx`, and `Layout.tsx` for the new phone shape; deliver behind a phone-width media query, no desktop changes.
- Untouched: all current Tailwind tokens for color/spacing/typography weight scale (within the indigo + slate system already used); back-end schema; audit log; RLS.
- Trade-off: works on a phone, looks familiar to a Vyapar-store user, doesn't move the needle on the desktop design beyond minor section-rhythm polish. **Lowest risk, lowest reward.**

### Direction B — **Stripe + Linear: density + brand, premium dashboard**
- Surface: light, but with Stripe's `#061b31` deep navy headings replacing current near-black and Linear's near-black panel surfaces for the working surfaces (Admin / Rep / Floor only).
- Type: Inter variable at weight 300 for headers (Stripe-style), weight 510 for emphasized UI (Linear-style), weight 400 for body.
- Accent: indigo `#533afd` (Stripe-style) replaces current `#4f46e5`. Subtle shift, not a rebrand.
- Phone pattern: hamburger top + persistent bottom action bar (Zoho-style full-width CTA, but with verbs like "Record a sale" not "SIGN UP FOR FREE") + tiles as inline cards.
- W7 surface change: rewrite the 3 dashboards + Layout for the new shape *and* the new visual language; ship with the new accent.
- Untouched: schema, RLS, audit log.
- Trade-off: looks more expensive than Direction A, fits the "Zoho-comparable UI" framing the December 1 deadline implies, but is a bigger visible redesign and risks feeling like a rebrand to the existing client. **Medium risk, medium-high reward.**

### Direction C — **Linear + Warp: dark, worker-primary, fast**
- Surface: dark (`#08090a` Linear-style for worker + floor; light preserved for admin/rep).
- Type: Inter at weights 300/400/510 (Linear-style; no bold).
- Accent: indigo preserved, slightly brighter (`#7170ff`) for dark surfaces.
- Phone pattern: hamburger top + bottom-tab nav; worker/floor surfaces redesigned for *scan-and-confirm* big-touch-target interactions (Warp's `block`-shaped action cards, 56-72px hit areas).
- W7 surface change: this is the biggest surface change of the three. Worker + floor dashboards *become dark*; admin/rep stay light; cross-role components (Layout header, NotificationBell, ShareComposer) carry both themes with `data-theme`.
- Untouched: schema, RLS, audit log; admin/rep screen chrome (preserved light).
- Trade-off: the worker-on-the-floor case (D29's actual physical reality per HANDOVER part 5) gets a purpose-built surface that fits it. The admin/rep case stays current. **Highest reward, highest risk** — requires dual-theme tokens and a phone-shape contract that handles both.

---

## 4. Picking criteria — what's the actual decision

| If the client cares most about... | Pick | Why |
|---|---|---|
| "I need to use the app on my phone, period." | **A** | Ships fastest; unblocks Pilot adoption without any visual contest |
| "I want it to look like a Zoho, not a free app." | **B** | Visible jump in design fidelity; preserves desktop experience for office work |
| "I want the worker experience on the floor to feel purpose-built." | **C** | Aligns frontend shape with the operational reality (D29, HANDOVER part 5) |
| "I have only 30 minutes for this conversation." | **A** | Smallest blast radius, fewest downstream questions |
| "I want the system to scale to a wider Tamil Nadu wholesale market later." | **C** | Two-theme tokens are an investment; cheap once paid for |

My read (with reasoning, not a recommendation): **Direction A** is the cheapest path to Pilot adoption, which is the December 1 deadline's actual blocker. **Direction B** raises design fidelity without raising the operational risk. **Direction C** answers a question that's genuinely open in the operational facts (the worker UX on a floor) but which the user has not yet said is *the* priority. Your user-profile notes emphasize that disagreement is welcome; if you have a different read, tell me.

---

## 5. What this research does NOT decide

These are explicit non-decisions, not gaps:

- **WhatsApp Cloud API / Looker Studio / Tier-2 forecasting.** Parked per session answers (your earlier "stay lite"). Not touched by any of A/B/C.
- **Tanglish UI (i18n).** Separate workstream per HANDOVER part 14; orthogonal to direction choice.
- **Tins-kit growth / `kit-extract.mjs`.** A separate session at the kit root; the patterns this research surfaced (especially "phone-shape as primary surface") would be candidates for the kit once a direction is chosen and shipped.
- **n8n / Supabase scheduled functions / Edge Functions.** Backend automation, not a frontend question.
- **Search feature phase 2** (`docs/recommendations/01`'s A4, A7, A13 etc.) — those are *post*-direction decisions, because direction A vs C changes which pre-existing query hooks survive and which get rewritten.

---

## 6. After you pick a direction

If you reply with **A**, **B**, or **C**, my next actions in this session will be:

1. **SPEC.md amendment** (TINS Step 3): §2.11 sub-section for mobile-shape contract + §8.X acceptance criterion, matching `design-system-draft-2026-09-16.md` §8 with direction-specific tokens. *One commit on master*, no branch yet, no code.
2. **BUILDER-DECISIONS-REVIEW.md D91** via `node tins-kit/scripts/decision-log.mjs builder ...` (TINS Step 4) recording: direction picked, §2.11 / §8.X section refs, the W4 §8.6 perf acceptance rolled in.
3. **HANDOVER.md** updated: W7 promoted from `🔶 partial` to `in_progress`, dated entry, queue position.
4. **Branch**: `feature/w7-mobile-shape-contract`.
5. **Variant mockups** for the chosen direction (Phase 4 of the `frontend-modernization` skill): 3 self-contained HTML files in `docs/design-sample/<n>-<screen>.html`, rendered at desktop + phone viewports via Playwright, screenshots saved to `docs/design-sample/<vp>-<screen>.png`. Each mockup becomes the visual reference for a specific page (entry screen = sign-in, primary working screen = rep-dashboard, complex component screen = bill-management or pack-form).
6. **Production port** per mockup, in commits matching the decisions. Not one mega-PR.
7. **Gate** (`scripts/validate.mjs` + `tins-kit/scripts/validate.mjs`) green at every commit.

If your reply is "none of those, here's a fourth direction," I take the new direction through the same six steps. **If your reply is "more research needed, here are the dimensions I want"**, I extend §1 with the new dimensions and re-run the comparator set with those in focus.

If your reply is anything other than a direction pick, I read the prompt once and respond — not edit any tracked file.
