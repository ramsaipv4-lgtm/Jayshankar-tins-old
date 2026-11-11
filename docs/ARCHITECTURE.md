# Architecture

> Technical design rationale for Jayshankar. The schema lives in [`SCHEMA.md`](./SCHEMA.md); the locked
> decisions are `SPEC.md` §0.2; this document explains **why** each piece is the way it is. If you are about to
> make a change that contradicts something here, update this document in the same change.
>
> *Rewritten 2026-10-02. The earlier text described the Mode A demo (nine tables, two locations, three roles,
> `BrowserRouter`, "no CRM", "no reverse-sale") and had drifted from the code. The reasoning that was still true
> — per-batch pricing, RLS as the boundary, the append-only audit log, the three state layers — is kept.*

## Stack

| Layer | Choice | Why this, not alternatives |
|-------|--------|----------------------------|
| Frontend framework | Vite 5 + React 18 + TypeScript | Fastest modern dev server for React; strict TypeScript catches a class of runtime errors at compile time. |
| Styling | Tailwind CSS 3, plus a small shadcn-style layer in `src/components/ui/` (`button`, `tile`, `collapsible`) | Utility classes keep the design system small. The `ui/` components are copied into the repo and styled with this repo's classes, so they are not "a UI kit that ships its own design system". They arrived with the Phase A redesign, which has **no SPEC section yet** (`HANDOVER.md` W11). |
| Client review decks (not the app) | The same chapter data in two presentations: Tailwind with the shared `ChapterPlayer` (deck 1) and an Ant Design 6 workbench with its own shell (deck 2) | Deck 2 lets the client compare two design languages against identical chapter data instead of arguing in prose. It is a **separate build** (`dist-storybook-ant/`) that nothing in the app imports, so it adds no bundle weight to the app. Whether the app ever adopts Ant Design is the open decision **D67**. |
| Routing | React Router 6 with **`HashRouter`** (`src/main.tsx`) | Hash routes work on static hosting with no server rewrite, and survive link previewers. Consequence worth knowing: a script that calls `page.goto('/some/path')` silently does not navigate in-app — it needs the `#`. |
| Server state | TanStack Query 5 | Server state belongs to the database; the client mirrors it. |
| Search | Fuse.js, client-side (`src/lib/search.ts`) | The identity tables (`skus`, `customers`, `vendors`, `users`) are small for a single-warehouse wholesaler, so a client fetch beats a Postgres extension and handles English / Tamil / Tanglish fish-name variants (D44). |
| Backend | Supabase: Postgres 15, Auth, RLS, Realtime available, one Edge Function (`invite-user`) | Postgres has the cleanest migration story (plain SQL). RLS ties users to permissions at the database, so even a malicious client cannot bypass it. |
| Migrations | Plain SQL in `supabase/migrations/`, numbered, idempotent | Migrations are code: diffable, reviewable, no CLI required. Applied migrations are history and are **never edited** — fix forward (`NEXT-AGENT-ONBOARDING.md` §2). |
| Auth | Supabase Auth: email + password, and **phone + password** (D37) | Invitations are links the admin shares themselves (D36–D38), so no email deliverability or SMS provider is needed. Phone + OTP (D35) is specified and deferred, not deleted. |
| Realtime | Available, **not used** | The app does not subscribe to any Realtime channel today (only the auth state listener). Data refreshes via TanStack Query on window focus. |
| PWA / offline | `vite-plugin-pwa` (Workbox `generateSW`) | Caches the app shell and recent reads. **No offline write queue** — D30 decided one is needed for the worker role; it is not built. |
| Native | Capacitor 8 (Android first, D18) wrapping the same build | One web codebase serves the PWA and the Android shell; one native addition so far (the hardware back button). |
| Hosting | Netlify for the app (static, no app server); GitHub Pages for the review decks | See `DEPLOY-NETLIFY.md`, `REVIEW-BUILD.md`. |
| Secrets | Netlify env vars; Supabase keys split into publishable (browser) and secret (server-only) | The publishable key is the only key that ships in the bundle. The secret key lives in `scripts/.env` and only Node scripts use it. |
| Reporting | Google Looker Studio over a read-only Postgres role (D26) | Free, no new server; `LOOKER-STUDIO-SETUP.md`. |
| Testing | Structural validator (`scripts/validate.mjs`) + live scripts (`scripts/test-*.mjs`) + a scratch-Postgres SQL suite (`supabase/tests/`) | The validator is the gate. The live scripts sign in as real demo users so RLS actually runs. The SQL suite runs on a throwaway local PostgreSQL, never on Supabase. Vitest is installed but there are **no unit tests** yet. |
| Typing of data | `numeric(10,2)` for money, `numeric(10,3)` for kg, `timestamptz`, `uuid` | Postgres native types. Money as float is forbidden. UTC stored, local time rendered. |

## Database design

The repository schema has 38 tables and 8 views ([`SCHEMA.md`](./SCHEMA.md), generated from the migrations).
The **live** project is at migration `0036` (24 tables); `0037`–`0046` are staged and not applied
(`BACKEND-PHASE-B-STATUS.md`). RLS is enabled on every table.

### Why per-batch pricing, not per-SKU pricing

One SKU ("Pomfret") arrives in many deliveries at different prices paid to the fisherman. Storing price on the
SKU would overwrite cost lineage with every delivery. Price lives on the **batch** (`price_per_kg_paid`), and a
sale carries its own `sale_price_per_kg`; margin is derived, never stored (D8, D17). `price_history` is a
SKU-level reference price for analytics, not authoritative cost.

### Why containers, and how stock is drawn

Stock in the warehouse is tracked per **container** — a numbered, reusable insulated box, one purchase event per
fill, with a shelf-life clock that starts when it is packed (D21). `batches` stays the financial record;
containers are a physical layer on top.

A sale or spoilage draws in **two phases**: container-tracked stock first, ordered by `expires_at` (soonest-to-
spoil first — the rule the wholesaler already applied by memory, now enforced), then direct-batch FIFO for
anything not yet packed. This is done by `SECURITY DEFINER` functions (`record_container_sale`,
`record_container_spoilage`) that lock rows with `FOR UPDATE`; a trigger (`apply_movement_to_batches`) is the
safety net for the simple case, not the cascade. A repack or transfer **never resets the freshness clock**
(§4.3.9–§4.3.10): a container only ever exists already filled, and the destination inherits the source's
`filled_at`.

### Why RLS is the access boundary (not the app)

The application can have bugs; the database cannot be bypassed by a client without an explicit grant. Every
table has explicit policies; the role comes from `current_user_role()` (defined in `supabase/rls-policies.sql`,
which is re-runnable and must run **after all migrations**). Two consequences found the hard way:

- RLS is row-level, so hiding a column in the UI hides nothing — `batches` once carried vendor and price for any
  signed-in user. Phase B fixes this with a safe view and a switch (`DECISIONS.md` #34).
- Postgres grants `EXECUTE` on every new function to everyone by default. Migration `0046` revokes it and makes
  functions **closed by default** (`DECISIONS.md` #40); until it is applied, stock-writing helpers are reachable
  with the public key alone.

Only one table has a DELETE policy: `containers` (D32), and the FK from `container_fills` still blocks deleting a
container that ever held fish. Everything else is soft-deleted (`active = false`).

### Why the audit log is append-only — and how much of the system it covers

Every mutation on an audited table writes to `audit_log` via a trigger. There is no INSERT policy (only the
trigger writes), and no UPDATE or DELETE policy for any role. **Coverage matters:** at migration `0001` the
trigger was attached to 8 tables; bills, payments, customers, containers, fills, receiving confirmations,
reversals and complaints were not audited until `0037` (`DECISIONS.md` #38). On the live project, which is at
`0036`, that is still the case. History before the trigger was attached is not recoverable.

### Why one warehouse

The business has one warehouse and no retail counter (D29, superseding D9). `locations` holds one real row of
`kind = 'warehouse'`; `repack` is the everyday way to consolidate stock, and `transfer` is reserved for a second
warehouse (D23), which the schema already supports. Two in-transit locations per warehouse model fish that is
travelling inbound or outbound (D53).

### Why five roles

`admin`, `co-admin`, `vendor-rep`, `worker`, `super-worker` — stored as data, added by migration, never by code
(D3, D28). `co-admin` has full admin capability so a second person can take over from a phone. There is **no
sixth role** today (`DECISIONS.md` #37). Amendment v3 proposes `receiving-storage`; Phase B built blind receiving
as a flag on existing roles instead — an unresolved conflict recorded as `HANDOVER.md` W12.

## Frontend architecture

### Component layering

```
pages/        route-level, one per route in App.tsx
   ↓ uses
components/   reusable (Layout wraps every page; FormFields wrap every form; ui/ holds the shadcn-style layer)
   ↓ uses
lib/          hooks and clients (useSession, the supabase client, mutations.ts, search.ts)
```

No page imports another page, and no component imports a page. The dependency graph is strictly downward.

### State management

1. **Server state** — owned by Supabase, mirrored via TanStack Query. The client changes it only through
   `lib/mutations.ts`, which calls an RPC and then invalidates the relevant query keys. **Query keys must be
   unique per query shape**: two components sharing the literal key `['skus']` with different `select` lists once
   left a shelf-life column silently blank (`BUILDER-DECISIONS-REVIEW.md` #34).
2. **Auth state** — owned by Supabase Auth, mirrored via `useSession()` in `lib/auth.ts`.
3. **UI state** — `useState` in the component that needs it. No global state library.

### Three decks (a note added with deck 3)

A third deck, **The Run** (`src/components/storybook-run/`, `src/lib/storybook-run/`, build `dist-storybook-run/`), shares
**data but no renderer code** with the other two: it uses no Tailwind and no Ant Design, draws the v3/v4 amendments' new
functionality as one truck-load's day seen through several roles (`docs/REVIEW-BUILD.md` §9), and also draws the same
chapters and the twelve persona walks as decks 1–2 so the three can be compared (§10). All three share one address
format (`src/lib/storybook/decks.ts`). The sections below describe decks 1 and 2.

### Two decks, one dataset

The workflow storybook is 32 chapters of screen **data** (`src/lib/storybook/`), plus the drawings of the device
frames and the blocks inside them. Both decks use all of that. What differs is the **shell around it**:

| Build | Shell | Entry | Output |
|-------|-------|-------|--------|
| Deck 1 — the app's own look | `ChapterPlayer` (Tailwind): one stage, a caption, a button row, a filmstrip | `src/storybook-main.tsx` | `dist-storybook/` |
| Deck 2 — Ant Design 6 | `src/components/storybook-ant/deck/` (`antd`, imported nowhere else): an Ant *workbench* | `src/storybook-ant-main.tsx` | `dist-storybook-ant/` |

Both are **built**; deck 2 is not yet published (`HANDOVER.md` W10). Deck 2's shell is built from Ant's own
patterns — `Layout`/`Sider`/`Menu` navigation (a `Drawer` on a phone), `Breadcrumb`, a clickable `Steps`
walk-through, a `Modal` lightbox that opens when you tap the screen itself (Fit / Actual size, swipe, arrow keys),
`Tabs`/`Segmented`/`Input.Search` on the home page with live thumbnails, a `Tour`, and a dark algorithm — rather than
the Tailwind player's controls re-skinned. The device frames keep their own light theme in dark mode: the screen is
the product being judged, not part of the viewer.

`ChapterPlayer`'s *surface* seam (`src/lib/storybook/surface.ts`) still exists: it is how the app's own deck is
assembled. Deck 2 does not use it: `deck/AntScreen` hands each screen to `mock/phone.tsx` or `mock/desktop.tsx`,
two **composition layers** that read the same flat block data and lay it out the way an Ant product would — a
grouped `Form` card and docked action bar on the phone; a Pro-style frame with KPI row, filter bar, tabbed table and
24-column grid on the desk (decision 97). Charts are hand-drawn SVG (no chart dependency, SPEC §4.4). So the
two decks now differ in **navigation, interaction and screen composition, not just styling** — which is what the client is being asked
to judge. They are still **deep-link compatible** (`#/review?c=<chapter>&s=<step>`). The app's import graph never
reaches `antd` (verified by grepping the built app and deck-1 bundles). Decision **D67** (which look the app ships)
is open.

### Routing and role shells

React Router 6 with `HashRouter`. `App.tsx` reads the session from `useSession()` and renders: no session →
`<SignInForm />`; an invite link → the `#/accept-invite` page *before* the normal branch (D38); otherwise a
role-gated `Shell` per route, whose `expected` array lists the roles allowed there. **Read those arrays, not the
role names**, to learn a role's scope — a role the frontend does not recognise cannot use the app at all
(decision #49).

### Offline behaviour

The service worker caches the app shell; reads work offline from the TanStack Query cache; **mutations are
disabled** and a banner says so. D30 decided the worker role needs real offline writes (queue, conflict
resolution, sync UX); **that is not built**, and a boat-side entry made with no signal is lost. The design
sketch is `client-qa/session3/plan.md` §7.5.

## Deployment

Static files only: Netlify runs `npm run build` and publishes `dist/`. No app server and no Node functions. The
only server-side code outside Postgres is the `invite-user` Edge Function, which holds the service-role key where
a client never can (D34). `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are inlined into the bundle at
build time, so rotating a key means a rebuild and redeploy. See [`DEPLOY-NETLIFY.md`](./DEPLOY-NETLIFY.md).

## What is out of scope

See `SPEC.md` §9, which is current. In short: POS and checkout, GST invoicing (a dormant track exists, D24),
supplier contracts, multi-currency, barcode scanning, WhatsApp inbound automation. **Not** out of scope any
more, despite older text: customer CRM, reverse-sale, multi-warehouse, iOS (Android first), photo capture and
offline writes for the worker role.

## Open architectural questions

Deliberate uncertainties. If a change touches one, record it in `docs/DECISIONS.md` *and* `SPEC.md` §0.2 first.

1. **Offline write queue** — decided (D30), not built; conflict-resolution UX is undesigned.
2. **Blind receiving** — two designs (amendment v3 vs Phase B) for the same client need; `HANDOVER.md` W12.
3. **The look of the app** — Tailwind or Ant Design 6 (D67); and whether the Phase A redesign is a locked
   decision (`HANDOVER.md` W11).
4. **Realtime** — available but unused; polling on focus is enough until a second person watches the same screen.
5. **Audit coverage on the live project** — 8 of 24 tables until `0037` is applied.
