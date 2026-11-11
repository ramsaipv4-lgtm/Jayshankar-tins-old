<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->

# Meen-Sampat — Tamil Nadu Fresh-Fish Wholesale Inventory (Spec v1)

> A spec-first TINS project. The document IS the source. If the software is wrong, the
> document was wrong. The app is generated from this file. Do not edit generated code to
> fix a defect — edit this file and regenerate.

---

## 0. Preamble

### 0.0 Cheapest version that would work

**A single shared Google Sheet** owned by the wholesaler, with four tabs:

1. **Fish** — one row per fish type, columns: `name_en`, `name_ta`, `category`,
   `shelf_life_hours`.
2. **Batches** — one row per delivery: `batch_id`, `fish_id`, `received_at`, `weight_kg`,
   `cost_price_per_kg`, `sale_price_per_kg`, `active` (true/false).
3. **Sales** — one row per sale: `sale_id`, `batch_id`, `weight_kg`, `total_inr`,
   `sold_by`, `sold_at`.
4. **Spoilage** — one row per spoilage event: `batch_id`, `weight_kg`, `reason`,
   `recorded_by`, `recorded_at`.

The wholesaler shares the sheet with the vendor-rep and the workers. Everyone types into
the same sheet. The wholesaler manually sorts by `received_at` to figure out FIFO. No
app, no code, no auth, no audit. A bad copy-paste is a bad day. A typo is a missing rupee.

**The expensive version below buys:**

- **Role-based access** — admin, vendor-rep, and worker see different views; a worker
  cannot see the cost price, and a vendor-rep cannot edit the fish catalogue.
- **Real-time updates** — when the admin enters a delivery, every phone on the shop floor
  shows the new stock within 1 second, no refresh.
- **FIFO enforcement** — the spoilage flow targets the oldest non-empty batch
  automatically, and the counter display shows "today's catch" without manual sorting.
- **Append-only audit log** — every sale and every spoilage event is recorded with who
  did it and when, and the log cannot be edited (not even by the admin). The wholesaler
  can answer "what did Ramu sell last Tuesday at 6 am?" in two clicks.
- **Bilingual data** — pomfret is `Vavval Meen` in Tamil; the catalogue carries both, and
  search matches either.
- **PWA offline** — when the network blips, the counter still works (read-only) and the
  banner tells staff not to record sales until the network is back.
- **Demo mode** — the developer can show the wholesaler a fully populated app on a phone
  before the wholesaler has decided anything, without touching real data.

The point of V1 is to ship Mode A (a demoable prototype) in 1–2 weeks and *win access*
to the wholesaler, not to replace the Google Sheet on day one.

### 0.1 What this document is

This is the canonical specification for Meen-Sampat v1. It follows the TINS methodology
as documented in `tins-kit/SPEC.md` and inherits the structure from the kit's
`templates/SPEC.md` (promised-but-not-yet-built — this draft is the de-facto template
content for a fish-wholesale consumer).

The "interview" (per `archive/exam-forge-reference/SPEC-AUTHOR.md`, the canonical
interview-first prompt) is captured in the business-context list provided to the spec
author. The seven questions and the A/B/C pass are answered below in this section.

**The seven questions (interview recap):**

1. **What it does, in one paragraph, and who uses it.** An inventory, sales, and
   spoilage tracker for a single Tamil Nadu fresh-fish wholesale store. Used by the
   wholesaler (admin), their delivery + sales staff (vendor-rep), and the floor
   workers who move boxes and record spoilage.
2. **The worst device that must work.** A ₹8,000 Redmi A-series Android, 2 GB RAM,
   720p screen, 4G with frequent drops in the covered market. **This constraint
   decides everything**: small bundle, PWA offline (not native app), no heavy JS, no
   images, no video.
3. **What data goes in, who authors it.** Deliveries (admin or vendor-rep), sales
   (vendor-rep), spoilage (worker or vendor-rep), fish catalogue (admin). No real
   sample was provided (see step A).
4. **What must NOT be built.** No POS, GST invoicing, customer CRM, supplier
   contracts, multi-store, barcode scanning, photo capture, multi-currency, iOS-
   specific design, offline write-queue, reverse-sale flow, worker-records-sale. See
   §9.
5. **Where it's hosted, whether a server is allowed.** Static PWA on Netlify, Supabase
   managed Postgres for the backend. Server is allowed (kit's `lib/tenant-rls/`
   pattern available); single-tenant means the full multi-tenant primitive is not
   needed.
6. **What "correct" means.** Mode A: a demoable prototype on a phone, seeded data, no
   broken buttons, validator exit 0. Mode B: wholesaler has used it 2 weeks, audit
   log intact, zero sales lost to a network blip. Mode C: schema locked, no demo
   banner, RLS protected, validator still exit 0.
7. **What already exists.** The Google Sheet (cheapest version). A prior spec at
   `../Jayshankar/SPEC.md`. The kit at `../tins-kit/SPEC.md`.

**A. MEASURE MY INPUT DATA.** No real sample was provided. The spec author is working
from a text description and a list of fish names. The spec cannot substitute
measurement for an absent sample; the Mode B interview must request a 50-row
sample of the wholesaler's actual Google Sheet and report real numbers.

**B. CHECK FOR ROT.** Findings recorded 2026-08: **React 19** is current (the brief
said 18); **Tailwind 4** is current (the brief said 3 — Tailwind 4 replaced the
PostCSS pipeline with `@tailwindcss/vite` and `@import "tailwindcss"`); **Vite 8**
(March 2026, requires Node 20.19+) is current; **vite-plugin-pwa v1.x** works with
Vite 5+; **Supabase RLS** is unchanged (RLS now default-enabled for new dashboard
tables, Realtime respects RLS). **Tamil**: pomfret = வவ்வால் (Vavval) confirmed; the
brief's surmai = வஞ்சரம் is a regional variant of Vanjiram (வஞ்சிரம்) — the spec
preserves both spellings and flags this for the Mode B interview.

**C. PROPOSE THE DATA FORMAT FIRST.** The data is **Postgres tables with RLS**, not
"prose an AI wrote". The schema is in §4.2. Bilingual name is a two-column
`name_en` + `name_ta` design, not a single bilingual string (the latter leads to
search bugs and font-fallback issues). Money is `numeric(10,2)` columns with
Zod-validated text-string-decimal on the wire. Time is `timestamptz` in UTC,
displayed in Asia/Kolkata.

### 0.2 Locked design decisions

The following decisions are final for v1. They are the kit-mandated "what we agreed"
set; the kit's `validate.mjs` (when built) will check this table for the
`(#, Decision, Resolution)` shape and at least one row.

| # | Decision | Resolution |
|---|---|---|
| **D1** | **Stack: Vite 8 + React 19 + TypeScript 5 + Tailwind 4 + Supabase (Postgres + Auth + RLS + Realtime) + Netlify + vite-plugin-pwa v1.** Versions pinned to current stable as of 2026-08 (see §0.1 B). Node 20.19+ required. | LOCKED |
| **D2** | **All schema changes are versioned SQL files** at `supabase/migrations/<UTC-timestamp>_<description>.sql`. Each starts with `-- up` and is idempotent. No schema change via the Supabase dashboard; the SQL files are the source. | LOCKED |
| **D3** | **Roles are a controlled vocabulary** stored as `text` with a `CHECK (role IN (...))` constraint: `admin`, `vendor_rep`, `worker`. A `user_roles` table maps `auth.uid()` to a role. The first user to sign up becomes `admin`; the admin assigns the other two roles by email. | LOCKED |
| **D4** | **Bilingual fish names.** A `fish` table has `name_en text not null` and `name_ta text not null` columns (both required). The UI displays English; search matches either language. Catalog writes are admin-only. | LOCKED |
| **D5** | **Append-only audit log** via a Postgres trigger. Every INSERT, UPDATE, or DELETE on `batches`, `sales`, and `spoilage` writes a row to `audit_log` with `(at, user_id, action, table_name, row_id, before_jsonb, after_jsonb)`. **No UPDATE or DELETE policy exists on `audit_log`**; the trigger is the only writer. (D10 kit rule 10 + AGENTS §3 rule 5 in Jayshankar.) | LOCKED |
| **D6** | **PWA offline read-only.** When `navigator.onLine` is `false`, write buttons (Add delivery, Record sale, Record spoilage) are disabled and an `<OfflineBanner>` shows "Offline — view only". No write-queue in V1. The mode is detected client-side; the server is not trusted to refuse writes that the client should have blocked. (D6 in Jayshankar; see §9.) | LOCKED |
| **D7** | **Money is `numeric(10,2)` everywhere.** No `float` typed money anywhere in the schema, the Zod schemas, or the React code. The Zod wire-format is a text-string-decimal (`"^\d+\.\d{2}$"`). Display uses `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`. (D13 kit; D7 Jayshankar.) | LOCKED |
| **D8** | **Per-batch pricing.** A `batch` row has `cost_price_per_kg numeric(10,2)` and `sale_price_per_kg numeric(10,2)`. The batch IS the pricing unit. A `Sale` row references a batch and a weight; the total is `sale_price_per_kg * weight_kg` computed at insert time and stored as a `total_inr numeric(10,2)` snapshot (so a retroactive price edit does not change a past sale). | LOCKED |
| **D9** | **FIFO spoilage.** Spoilage targets the oldest `active = true` batch of the requested fish (sorted by `received_at ASC`). A `batch` row tracks `weight_kg_remaining numeric(10,3)` (derived; updated by trigger on `sales` and `spoilage` inserts). Display "today's catch" = batches where `received_at::date = (now() at time zone 'Asia/Kolkata')::date`. Tie-breaker for FIFO: `received_at ASC`, then `id ASC`. | LOCKED |
| **D10** | **3 modes gated by `VITE_DEMO_MODE` env var.** `true` (Mode A Demo): the `<DemoBanner />` is shown, the seed is loaded, the "first sign-up is admin" trick is on, and the audit log is read-only-but-OK-to-show. `false` (Mode B Pilot, Mode C Production): the banner is hidden, the seed is a no-op, and the audit log is fully protected. The build refuses to start in Mode C without a `VITE_SUPABASE_URL` and a `VITE_SUPABASE_ANON_KEY` env var. | LOCKED |
| **D11** | **Demo seed is real schema, fake content.** `supabase/seed.sql` inserts 8 fish types, 3 batches per fish, 2 sales, and 1 spoilage event — using Tamil + English names from §4.2, plausible weights and prices, and the current IST date. The seed is idempotent (`ON CONFLICT DO NOTHING`). The seed is gated behind `VITE_DEMO_MODE = true` and a `psql` `WHERE` clause; it never runs in production. | LOCKED |
| **D12** | **Soft-delete only.** Every "removable" table (`fish`, `batches`, `user_roles`) has `active boolean not null default true`. The UI shows only `active = true` rows. **No DELETE policy on any table.** Spoilage sets `active = false` on the batch row and inserts a `spoilage` row. The kit's rule 10 + Jayshankar's AGENTS §3 rule 5. | LOCKED |
| **D13** | **Cheapest version = a single Google Sheet.** The expensive version above buys role-based access, real-time, FIFO, audit, bilingual, PWA, demo. (D11 kit.) | LOCKED |
| **D14** | **Interview-first methodology.** This spec is the output of the SPEC-AUTHOR prompt's 7-question + A/B/C pass. Any future amendment to this spec MUST follow the same interview-first protocol (the kit's D12 + the canonical SPEC-AUTHOR.md). | LOCKED |
| **D15** | **Money on the wire is text-string-decimal.** Zod schema `z.string().regex(/^\d+\.\d{2}$/)`. The client parses to `numeric(10,2)` on insert; the server validates again (defence in depth). The ESLint rule `no-restricted-syntax` blocks `Number.parseFloat(x)` on `cost_price_per_kg` / `sale_price_per_kg` / `total_inr` named identifiers. | LOCKED |
| **D16** | **Auth via Supabase Auth + a `user_roles` table.** Supabase handles email + password and JWT. The `user_roles` table is keyed by `user_id` (FK to `auth.users.id`) and is the source of truth for the role. RLS policies read the role from this table. The first sign-up (when `user_roles` is empty) is auto-assigned `admin` via a Postgres trigger; subsequent sign-ups are `null` (no role) until the admin assigns one. | LOCKED |
| **D17** | **Time is stored UTC, displayed IST.** All `timestamptz` columns. All UI rendering converts to `Asia/Kolkata` via `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`. There is no DST in Tamil Nadu; UTC+5:30 year-round. | LOCKED |

### 0.3 Implementation baseline

**Mode A is next.** Nothing is built yet. The work queue is in `HANDOVER.md` §5 (this
draft does not include a HANDOVER.md; the kit ships the template at
`tins-kit/templates/HANDOVER.md` when W1 lands). W1 of this consumer project will be:
seed the migrations, write the SQL, write the validator, write the seed.

---

## 1. Description

**Meen-Sampat** is a PWA inventory and sales tracker for a single Tamil Nadu fresh-fish
wholesale store. The wholesaler buys fish at the morning auction, holds them on ice
through the day, and sells to retailers and walk-in customers. Stock is perishable
(FIFO), and every batch has its own price (per kg, ₹/kg).

The app serves three actors:

- **`admin` (the wholesaler)** — sets up the fish catalogue, enters morning deliveries,
  adjusts prices, assigns roles, reads the audit log.
- **`vendor_rep` (delivery + sales staff)** — enters morning deliveries, records sales
  as they happen, can mark spoilage.
- **`worker` (floor staff)** — moves stock, records spoilage, reads stock levels. **Does
  not record sales** (V1; see §9).

The app is a single-tenant PWA. The data is real-schema, fake-content in Mode A; the
same schema holds real data in Mode B onwards. The store is offline-tolerant: when the
network blips, the counter still shows what's on the floor; the wholesaler cannot
*change* anything until the network is back, and a banner tells them so.

The device constraint is the deciding constraint. The worker carries a ₹8,000 Android
phone in a covered fish market with spotty 4G. The PWA must boot in under 3 seconds on
that device, must not exceed 500 KB of JS on the critical path, and must work
read-only when the network is gone.

---

## 2. Functionality (by module)

### 2.1 Module map

| # | Module | Primary actor | Writes allowed to |
|---|---|---|---|
| 1 | Fish catalogue | admin | admin only |
| 2 | Batches (deliveries) | admin, vendor_rep | admin, vendor_rep |
| 3 | Stock display (counter) | everyone | (read only) |
| 4 | Sales | vendor_rep, admin | vendor_rep, admin |
| 5 | Spoilage | worker, vendor_rep, admin | worker, vendor_rep, admin |
| 6 | Audit log | admin (read) | trigger only |
| 7 | Auth + roles | admin (assigns) | first sign-up auto-admin |
| 8 | PWA offline | — | (read only) |
| 9 | Demo mode | — | (display-only) |

### 2.2 Module 1 — Fish catalogue

A list of fish the wholesaler stocks. Bilingual: every row carries an English name
(e.g. `Pomfret`) and a Tamil name (e.g. `வவ்வால்`). Search matches either.

- **Sees:** an admin sees the full table with a `+ Add fish` button; a vendor_rep and a
  worker see the same read-only list.
- **Schema (authoritative):** see §4.2.1 `fish`.
- **Happens:** admin taps `+ Add fish`, fills `name_en`, `name_ta`, `category`,
  `shelf_life_hours`, taps Save. The new row appears on every connected phone within
  1 second (Realtime).
- **Stored:** `fish` row + `audit_log` row (INSERT).
- **Validation:** both `name_en` and `name_ta` are non-empty and unique together
  (`UNIQUE (name_en, name_ta)`). `shelf_life_hours` is `0 < x <= 168` (one week max).

### 2.3 Module 2 — Batches (deliveries)

A delivery from the morning auction. Each batch is a discrete unit of one fish type
with its own cost and sale price. The batch ID is a `cuid`.

- **Sees:** an admin or vendor_rep sees `+ New batch`. A worker does not.
- **Happens:** the user picks a fish, enters `weight_kg` (in kg, to 0.001), enters
  `cost_price_per_kg` and `sale_price_per_kg` (₹/kg, two decimal places), taps Save.
  The batch appears at the top of the counter.
- **Stored:** `batches` row with `received_at = now()`, `weight_kg_remaining =
  weight_kg_initial`, `active = true` + `audit_log` row.
- **FIFO ordering:** see §4.3.1.

### 2.4 Module 3 — Stock display (the counter)

The default landing page. Shows "today's catch" — batches received in the current
Asia/Kolkata day — sorted by `received_at ASC` (FIFO). A filter lets the user see
yesterday or any past day.

- **Sees:** a vendor_rep or worker sees `Pomfret (வவ்வால்) — 12.5 kg remaining — ₹780/kg`.
  An admin sees the same plus a `cost_price_per_kg` column (₹/kg) and the
  `received_at` timestamp.
- **Happens:** Realtime subscription to the `batches` table. A new batch from Module 2
  appears in the list within 1 second.
- **Offline:** the list is served from the service-worker cache. The `+` buttons are
  hidden (not greyed — the worker phones are slow and greyed-out buttons get tapped
  anyway, see §6).

### 2.5 Module 4 — Sales

A vendor_rep records a sale: which batch, how many kg, who is the customer (free text
or "walk-in"). The total is computed at insert time.

- **Sees:** a vendor_rep sees `Record sale` on every batch row and as a floating
  action button. A worker does not (V1; the worker is not trusted to record money).
- **Happens:** the user picks a batch (FIFO-ordered dropdown of `active` batches with
  `weight_kg_remaining > 0`), enters `weight_kg`, the total is computed
  (`sale_price_per_kg * weight_kg`), the user taps Confirm. The batch's
  `weight_kg_remaining` is decremented by the trigger.
- **Stored:** `sales` row with `total_inr` snapshot + `audit_log` row.
- **Validation:** `weight_kg > 0`, `weight_kg <= batch.weight_kg_remaining`. The Zod
  schema enforces both client-side; the trigger enforces them server-side. A failed
  validation shows "Only 4.2 kg remaining" inline (not a toast — the worker phones
  drop toasts).
- **Cannot edit or delete a sale** (V1). Corrections are recorded as a *new* sale
  with a `note` of "reversal of sale <id>".

### 2.6 Module 5 — Spoilage

A worker records spoilage: which fish, how many kg, why (free text). Targets the
oldest active batch (FIFO).

- **Sees:** a worker sees `Record spoilage` as a floating action button on the
  counter. A vendor_rep and admin also have it.
- **Happens:** the user picks a fish (the FIFO algorithm picks the batch — see
  §4.3.1), enters `weight_kg`, `reason` (required, free text), taps Save. The batch's
  `weight_kg_remaining` is decremented; if it reaches 0, `active = false`. A
  `spoilage` row is inserted.
- **Stored:** `spoilage` row + (if `weight_kg_remaining` reaches 0) `batches.active =
  false` + 2 `audit_log` rows.
- **Validation:** `weight_kg > 0`, `weight_kg <= batch.weight_kg_remaining`. Same
  trigger guard as sales.

### 2.7 Module 6 — Audit log

A read-only stream of every change to `batches`, `sales`, and `spoilage`. The admin
can filter by user, table, and date.

- **Sees:** the admin sees a table with `at, user_email, action, table_name, row_id`.
  A vendor_rep and worker do not see this page.
- **Happens:** triggered automatically. The trigger writes the `before` and `after`
  snapshots as `jsonb`.
- **Cannot write from the app.** RLS denies INSERT, UPDATE, DELETE to all roles
  except the trigger's `service_role` execution context. The trigger is defined with
  `SECURITY DEFINER` and a tight `search_path`.

### 2.8 Module 7 — Auth + roles

Supabase Auth for email + password. A `user_roles` table maps `auth.users.id` to a
role. The first sign-up auto-becomes `admin` (when `user_roles` is empty); subsequent
sign-ups have no role until the admin assigns one.

- **Sees:** the admin sees a `Users` page with a list of `auth.users` emails and a
  role dropdown. The admin picks a role; a row is inserted into `user_roles`; the
  user's JWT is refreshed (or they are asked to re-login).
- **Happens:** signup flow on the PWA — email, password, confirm password. The first
  signup triggers the `handle_new_user` function which, if `user_roles` is empty,
  inserts `(user_id, role = 'admin')`.
- **Stored:** `auth.users` row + `user_roles` row + `audit_log` row.
- **Validation:** password >= 8 chars, email is a valid email. Zod on the client; the
  Supabase policy on the server.

### 2.9 Module 8 — PWA offline (read-only)

The service worker caches the app shell + the last-fetched batches + the last-fetched
fish list. When the network drops, the counter still works; the write buttons are
hidden.

- **Sees:** the worker sees a yellow banner: "Offline — view only. Connect to network
  to record sales." A "Reconnect" pulse animation on the banner.
- **Happens:** `navigator.onLine` flips to `false` → the React context sets
  `isOffline = true` → the write buttons unmount. When `navigator.onLine` flips back,
  the app re-fetches and the buttons re-mount.
- **Stored:** nothing. The offline path is client-side only.
- **No write-queue.** A worker who *must* record spoilage during a network outage
  uses a paper slip and the vendor_rep enters it later. (D6 + §9.)

### 2.10 Module 9 — Demo mode

A red banner across the top of the PWA: "Demo mode — data is fake". Shown only when
`VITE_DEMO_MODE = true`. The seed is loaded; the audit log is shown (read-only); the
"Reset demo data" button on the admin page re-runs the seed.

- **Sees:** the gatekeeper client sees a fully populated app on a phone. The
  wholesaler, when they finally see the app, sees a clean slate (the banner is
  hidden, the seed is not loaded).
- **Happens:** the seed runs once at first sign-in in demo mode. The "Reset" button
  deletes all `batches`, `sales`, `spoilage` rows (where `created_by_demo = true`)
  and re-inserts the seed.
- **Stored:** demo rows have `created_by_demo = true`; the production RLS denies
  access to those rows when `VITE_DEMO_MODE = false`. (D10.)

---

## 3. Universal behaviour rules

These rules apply to every module. The validator (when built) checks them.

1. **The spec is the source.** `SPEC.md` is canonical. Code follows spec, never the
   other way around.
2. **Money is `Decimal`, never `Float`.** `numeric(10,2)` in the schema, text-string-
   decimal in the wire, `Intl.NumberFormat('en-IN', ...)` for display. ESLint rule
   `no-restricted-syntax` blocks `Number.parseFloat` on the named money identifiers.
3. **Soft-delete only.** No `DELETE` policy on any table. Removal sets `active = false`.
4. **The audit log is append-only.** No UPDATE, no DELETE policy. The trigger is the
   only writer. (D5.)
5. **Roles are a controlled vocabulary.** `admin`, `vendor_rep`, `worker`. No free-text
   roles. No polymorphic `ownerType`. (Atal V1's polymorphic FK was rejected in V2;
   the kit does not propagate it.)
6. **Time is stored UTC, displayed IST.** `timestamptz` in the schema,
   `Asia/Kolkata` in the UI.
7. **Bilingual data where relevant.** Fish names carry both English and Tamil. No
   single bilingual string column.
8. **Authored data is separate from derived data.** `weight_kg_remaining` is derived
   (via trigger). `sale_price_per_kg` is authored. The trigger may write derived data
   and must refuse to overwrite authored data.
9. **PWA offline is read-only.** No client-side write-queue. The worker uses paper
   during outages. (D6 + §9.)
10. **The validator fails the build.** `npm run validate` exits non-zero on any
    failure. No `--force`, no "warn and continue". (D16 Jayshankar.)
11. **Decisions and review findings are recorded.** Every SPEC amendment produces an
    entry in `BUILDER-DECISIONS-REVIEW.md`. Every reviewer session produces an entry
    in `REVIEWER-DECISIONS-REVIEW.md`.
12. **Realtime is opt-in per table.** Only `fish` and `batches` are in the
    `supabase_realtime` publication. The audit log is NOT realtime (it would generate
    too much noise; the admin can refresh).

---

## 4. Technical implementation

### 4.1 Architecture and stack

| Layer | Choice | Why | What it rules out |
|---|---|---|---|
| Build | Vite 8 | Current stable; Rolldown bundler for 10–30× faster builds | Older Node; non-ESM plugins |
| Framework | React 19 | Current stable; Server Components not used | Class components; `componentDidMount` patterns |
| Language | TypeScript 5 strict | The spec is precise; the code must be too | `any`; implicit `any` |
| Styling | Tailwind 4 (via `@tailwindcss/vite`) | No PostCSS config to maintain; CSS-first `@theme` | Custom design tokens outside the `@theme` block |
| Routing | `react-router` v7 | The most boring option; SPA hash or browser routing | File-based routing; nested layouts in V1 |
| State | React Context + `useReducer` for the offline flag; Supabase client for data | The app is small; Redux is overkill | A second state library |
| Backend | Supabase managed Postgres | Postgres + Auth + RLS + Realtime in one service | A custom Node backend; ORMs other than `supabase-js` |
| Auth | Supabase Auth (email + password) | Free tier covers the wholesaler's 5 users; RLS integrates with `auth.uid()` | OAuth in V1 (the worker does not have a Google account) |
| PWA | `vite-plugin-pwa` v1 + Workbox 7 | Standard pattern; works with Vite 8 | A native app; a custom service worker |
| Hosting | Netlify (static) | Free tier; PWA-friendly; redirect rules for SPA | Docker; K8s |
| Schema migrations | `supabase/migrations/<UTC>_<description>.sql`, applied by `supabase db push` | Kit D2; the schema is the source | The dashboard as the schema source |
| Validation | Zod 3 on the wire; Postgres CHECK constraints on the server | Defence in depth | Trusting the client |
| Date/time | `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })` | Native, zero-dep | `date-fns`, `moment` |

The kit's "forbidden" list is respected: no `lodash`, no `moment`, no `axios`, no
`dotenv`, no MUI/Chakra/Mantine. (D3 kit; atal's TINS-MCP review.)

### 4.2 Data structures

Every table is in the `public` schema. RLS is enabled on every table. No DELETE policy
anywhere. (D5, D12.)

#### 4.2.1 `fish`

```sql
create table fish (
  id                text primary key default gen_random_uuid()::text,
  name_en           text not null,
  name_ta           text not null,
  category          text not null check (category in ('marine','freshwater','shellfish','cephalopod')),
  shelf_life_hours  int  not null check (shelf_life_hours > 0 and shelf_life_hours <= 168),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (name_en, name_ta)
);
```

`name_ta` is the Tamil script (e.g. `வவ்வால்`), not a transliteration. The UI is
English; search matches either.

#### 4.2.2 `batches`

```sql
create table batches (
  id                     text primary key default gen_random_uuid()::text,
  fish_id                text not null references fish(id),
  received_at            timestamptz not null default now(),
  weight_kg_initial      numeric(10,3) not null check (weight_kg_initial > 0),
  weight_kg_remaining    numeric(10,3) not null check (weight_kg_remaining >= 0),
  cost_price_per_kg      numeric(10,2) not null check (cost_price_per_kg >= 0),
  sale_price_per_kg      numeric(10,2) not null check (sale_price_per_kg >= 0),
  created_by_demo        boolean not null default false,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);
create index on batches (fish_id, received_at);
create index on batches (received_at);
```

`weight_kg_remaining` is derived (the trigger updates it on `sales` / `spoilage`
inserts). The CHECK `weight_kg_remaining >= 0` is the structural guarantee that a
sale cannot oversell.

#### 4.2.3 `sales`

```sql
create table sales (
  id                text primary key default gen_random_uuid()::text,
  batch_id          text not null references batches(id),
  weight_kg         numeric(10,3) not null check (weight_kg > 0),
  total_inr         numeric(10,2) not null check (total_inr >= 0),
  customer_label    text,           -- "walk-in" or free text
  note              text,           -- e.g. "reversal of sale <id>"
  recorded_by       uuid not null references auth.users(id),
  sold_at           timestamptz not null default now(),
  created_by_demo   boolean not null default false
);
create index on sales (batch_id);
create index on sales (sold_at);
```

`total_inr` is a snapshot at insert time. A retroactive price edit on the batch does
NOT change a past sale.

#### 4.2.4 `spoilage`

```sql
create table spoilage (
  id                text primary key default gen_random_uuid()::text,
  batch_id          text not null references batches(id),
  weight_kg         numeric(10,3) not null check (weight_kg > 0),
  reason            text not null check (length(reason) > 0),
  recorded_by       uuid not null references auth.users(id),
  recorded_at       timestamptz not null default now(),
  created_by_demo   boolean not null default false
);
create index on spoilage (batch_id);
create index on spoilage (recorded_at);
```

#### 4.2.5 `user_roles`

```sql
create table user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','vendor_rep','worker')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id)
);
```

#### 4.2.6 `audit_log`

```sql
create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid references auth.users(id),
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name  text not null,
  row_id      text not null,
  before      jsonb,
  after       jsonb
);
create index on audit_log (at);
create index on audit_log (table_name, row_id);
```

No UPDATE or DELETE policy. The trigger is the only writer. (D5.)

### 4.3 Algorithms

Every algorithm is a numbered procedure, implementable without further questions.

#### 4.3.1 FIFO spoilage target

Goal: given a `fish_id` and a `weight_kg` to spoil, return the batch to debit.

1. Start with the SQL: `SELECT id FROM batches WHERE fish_id = $1 AND active = true
   AND weight_kg_remaining > 0 ORDER BY received_at ASC, id ASC LIMIT 1`.
2. If the query returns no row, raise `insufficient_stock` (the worker is shown
   "No active batch for this fish").
3. If `weight_kg > weight_kg_remaining` of the selected batch, raise
   `insufficient_stock` with the message "Only X kg remaining in oldest batch".
   (V1: a single batch per spoilage event. Cross-batch spoilage is out of scope
   — see §9.)
4. Insert the `spoilage` row referencing this batch.
5. The trigger decrements `batches.weight_kg_remaining` and, if it reaches 0,
   sets `batches.active = false`.

Tie-breaker: `received_at ASC`, then `id ASC` (the cuid is monotonic; this is a
stable total order on `batches` for the same fish and the same `received_at`).

#### 4.3.2 Today's catch query

Goal: return the batches for the counter's "today" view.

1. Compute `today_ist = (now() at time zone 'Asia/Kolkata')::date`.
2. SQL: `SELECT b.*, f.name_en, f.name_ta FROM batches b JOIN fish f ON f.id =
   b.fish_id WHERE b.active = true AND b.weight_kg_remaining > 0 AND
   (b.received_at at time zone 'Asia/Kolkata')::date = today_ist ORDER BY
   b.received_at ASC, b.id ASC`.
3. The UI groups by `fish_id` and shows the sum of `weight_kg_remaining` per fish.

#### 4.3.3 Sale capture

Goal: record a sale against a specific batch.

1. Validate `weight_kg > 0` (Zod, client-side).
2. Look up the batch: `SELECT sale_price_per_kg, weight_kg_remaining FROM batches
   WHERE id = $1 AND active = true`.
3. If no row, raise `batch_not_found`.
4. If `weight_kg > weight_kg_remaining`, raise `insufficient_stock`.
5. Compute `total_inr = sale_price_per_kg * weight_kg` (in Postgres, `numeric`).
6. Insert the `sales` row with `recorded_by = auth.uid()`.
7. The trigger decrements `batches.weight_kg_remaining`. If it reaches 0, sets
   `batches.active = false`.

A user is *not* allowed to pick the batch — they pick the fish, the FIFO query
picks the batch. This is the same algorithm as §4.3.1.

#### 4.3.4 Role-gate helper

```ts
// src/lib/auth.ts
import type { Session } from '@supabase/supabase-js';
import type { Role } from './roles';

export async function getRole(supabase: SupabaseClient): Promise<Role | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return (data?.role as Role) ?? null;
}

export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useContext(RoleContext);
  if (!role || !roles.includes(role)) return null;
  return <>{children}</>;
}
```

(Adapted from `tins-kit/lib/auth-shell/` — that module is "promised but not yet
built"; this code is the de-facto consumer copy.)

#### 4.3.5 The `handle_new_user` trigger

Goal: when a new `auth.users` row is created and `user_roles` is empty, assign
`admin`; otherwise leave the new user with no role.

1. Trigger: `after insert on auth.users for each row execute function
   handle_new_user()`.
2. Function (PL/pgSQL, `SECURITY DEFINER`, `set search_path = public`):
   ```sql
   declare
     user_count int;
   begin
     select count(*) into user_count from user_roles;
     if user_count = 0 then
       insert into user_roles (user_id, role) values (new.id, 'admin');
     end if;
   end;
   ```
3. RLS: the function bypasses RLS (`SECURITY DEFINER` + the table owner is
   `postgres`). The function is the only writer in this path.

### 4.4 Dependencies

Runtime:
- `react@19`, `react-dom@19`
- `react-router@7`
- `@supabase/supabase-js@2`
- `zod@3`

Build:
- `vite@8`
- `@vitejs/plugin-react@6` (Oxc-based, replaces Babel — Vite 8 default)
- `tailwindcss@4`, `@tailwindcss/vite@4`
- `vite-plugin-pwa@1`
- `typescript@5`
- `@types/react`, `@types/react-dom`

Test:
- `vitest@3` (Vite 8 compatible)
- `@testing-library/react@16`
- A zero-dep Node script for the validator (per kit D3)

Forbidden (per kit D3 + atal TINS-MCP):
- `lodash`, `moment`, `axios`, `dotenv` — native or kit alternatives exist.
- Any UI library that ships its own design system — Tailwind utility classes only.
- Float-typed money anywhere.

---

## 5. Style guide

- **Colours:** slate-900 (`#0f172a`) for text, slate-50 (`#f8fafc`) for the page
  background, sky-600 (`#0284c7`) for primary action, rose-600 (`#e11d48`) for
  destructive action, amber-500 (`#f59e0b`) for the offline banner, emerald-600
  (`#059669`) for the success state. The demo banner is a 2px-tall amber-200
  stripe with bold amber-900 text.
- **Typography:** system-ui sans-serif body, `text-base` (16px) on a 1.5 line
  height. Headings `font-semibold`, `text-2xl` (h1), `text-xl` (h2), `text-lg`
  (h3).
- **Spacing:** Tailwind 4 spacing scale; 4px base unit. Cards: `p-4`, `rounded-lg`,
  `shadow-sm`. Buttons: `px-4 py-2`.
- **Numbers:** right-aligned in tables. Currency prefixed with the rupee sign
  (e.g. `₹780/kg`, not `INR 780/kg`).
- **Tamil text:** always render with a fallback font stack that includes a Tamil
  glyph font (Noto Sans Tamil falls back to the system on Android). Tested on
  Redmi A-series (Android 13, default font).

---

## 6. Accessibility

WCAG 2.1 AA. Specifically:

- **All interactive elements have visible focus rings.** Tailwind's `focus-visible:
  ring-2 ring-sky-600 ring-offset-2`.
- **Color is not the only signal.** The offline banner is yellow *and* has a
  `data-testid="is-offline"` attribute. The "row sold" state is grey *and* has a
  checkmark icon.
- **The counter table is semantic.** `<table>`, `<thead>`, `<th scope="col">`,
  `<caption>`.
- **Form inputs have `<label>` elements,** not just placeholders. (Zod errors
  appear as `aria-describedby` text below the input.)
- **The Tamil text has a `lang="ta"` attribute** on the `<span>` so screen readers
  pronounce it correctly.
- **Touch targets are >= 44px** on the worker phone. Buttons on the counter are
  full-row tappable, not just the text.
- **Write buttons are hidden (not greyed) when offline.** Greyed-out buttons get
  tapped anyway on the slow worker phones; the worker presses it, the app does
  nothing, the worker is confused. Hidden buttons get retried later. (Observed
  in the Jayshankar incident log, per the kit's "real user as a gate" rule.)

---

## 7. Error handling

| Failure | Behaviour |
|---|---|
| **Network gone (PWA)** | `<OfflineBanner />` mounts; write buttons unmount; the counter still works from cache. (Module 8.) |
| **`Number.parseFloat` on a money field** | ESLint rule fails the build. (D15.) |
| **Sale weight > batch remaining** | Inline error under the weight field: "Only 4.2 kg remaining". The Zod schema is the source of the message. |
| **Sale on a `active = false` batch** | The select dropdown excludes `active = false` batches; if a stale client tries, the server returns `batch_inactive` and the UI shows "This batch is no longer available — pick another." |
| **Sign-up when `user_roles` is non-empty and the new user has no role** | The PWA shows "Waiting for the admin to assign your role." The user can sign in but every page is blank. |
| **First sign-up fails partway** | The auth row is created but `user_roles` insert fails → the user cannot sign in. A manual SQL fix is required. Documented in `TRAININGS.md` (when built). |
| **Supabase env vars missing** | Build fails at `vite build` with "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY". The dev server crashes with a red overlay. |
| **Tamil font missing on the device** | The fallback font stack renders Tamil in a system font. Tested on the Redmi A-series with the default font. |
| **Clock changed on the device** | The server uses `now()`; the client renders the server's timestamp. A clock change on the phone does not affect the audit log. |
| **Corrupt local cache (PWA)** | The service worker falls back to the network. If the network is also gone, the PWA shows a "Reload required" page. |
| **Trigger fails (e.g. numeric overflow on `total_inr`)** | The whole transaction rolls back; the user sees "Could not record sale — try again". The audit log records the failed transaction's intent as a `FAILED_INSERT` row (kit extension — the trigger has a `WHEN` clause that writes the failure for debugging). |

---

## 8. Acceptance criteria

Numbered, mechanically checkable. The validator (when built) will run these.

### 8.1 Spec structure
- **§8.1a** `SPEC.md` has the `<!-- TINS Specification v1.0 -->` marker at the top.
- **§8.1b** `SPEC.md` has at least one `<!-- ZS: -->` marker with a known key
  (`COMPLEXITY`, `PLATFORM`, `LANGUAGE`).
- **§8.1c** `SPEC.md` §0.2 has a `Decision` and a `Resolution` column on every row.

### 8.2 Schema invariants
- **§8.2a** Every `numeric` column used for money has precision 10 and scale 2
  (`numeric(10,2)`). A column with `numeric` and a different scale fails the check.
- **§8.2b** Every "removable" table has an `active boolean not null default true`
  column. A table with `DELETE` semantics in any migration fails the check.
- **§8.2c** `audit_log` has no UPDATE or DELETE policy in any migration. A
  migration that grants UPDATE or DELETE on `audit_log` fails the check.
- **§8.2d** `audit_log` has a trigger on `batches`, `sales`, and `spoilage` that
  fires on INSERT, UPDATE, DELETE. A trigger missing on any of the three tables
  fails the check.

### 8.3 Money invariants
- **§8.3a** The ESLint rule `no-restricted-syntax` blocks `Number.parseFloat` on
  identifiers named `*price*`, `*inr*`, or `total`. A `grep` of the `src/` tree
  for the forbidden pattern returns 0 results.
- **§8.3b** The Zod schema for any money field is `z.string().regex(/^\d+\.\d{2}$/)`.
  A schema with `z.number()` for a money field fails the check.

### 8.4 RLS invariants
- **§8.4a** RLS is enabled on every table in the `public` schema. A migration
  that creates a table without `ENABLE ROW LEVEL SECURITY` fails the check.
- **§8.4b** Every table has at least one policy per operation it accepts. A
  `sales` table with no INSERT policy fails the check.
- **§8.4c** The `service_role` key is not referenced in any `.ts` or `.tsx` file
  in `src/`. A `grep` for `service_role` in `src/` returns 0 results.

### 8.5 Mode gate
- **§8.5a** `VITE_DEMO_MODE = false` builds (or runs) hide the `<DemoBanner />`
  component. A render of the app in production mode that shows the banner fails
  the check.
- **§8.5b** The `supabase/seed.sql` migration is wrapped in a `WHERE` clause
  that checks for an empty `fish` table; running it twice is a no-op.
- **§8.5c** Production build (`VITE_DEMO_MODE = false`) refuses to start without
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. A `vite build` with the
  vars unset fails the check.

### 8.6 PWA invariants
- **§8.6a** The production build's JS bundle (initial route) is <= 500 KB
  uncompressed. A `vite build` that exceeds the budget fails the check.
- **§8.6b** The service worker registers on first load. A page-load test in
  Playwright that asserts `navigator.serviceWorker.controller` is non-null
  passes.
- **§8.6c** The first interactive render on a throttled "Slow 4G + 4× CPU" in
  Chrome DevTools is under 3 seconds. A Lighthouse run that scores > 3s on TTI
  fails the check.

### 8.7 Bilingual invariants
- **§8.7a** Every `fish` row in the seed has both `name_en` and `name_ta` non-null
  and non-empty. A seed row with `name_ta = ''` fails the check.
- **§8.7b** The fish search input matches both `name_en` and `name_ta` (case-
  insensitive, substring). A search for "வவ்வால்" returns the row whose
  `name_en = 'Pomfret'`.

### 8.8 Audit log invariants
- **§8.8a** After a script inserts a `sales` row, the `audit_log` table has
  exactly one new row with `action = 'INSERT'`, `table_name = 'sales'`, and the
  same `row_id`.
- **§8.8b** The `audit_log` row's `after` column contains the inserted `sales`
  row's `total_inr`, `weight_kg`, and `batch_id` as JSON.

(§8.4a + §8.4b + §8.4c + §8.8a + §8.8b together prove the audit log is wired up
and the trigger actually fires.)

---

## 9. Out of scope (V1)

These are explicitly NOT built. The list stops a keen implementer from building
them anyway.

- **POS / barcode scanning / photo capture.** The counter is a finger-tap UI, not
  a till.
- **GST invoicing.** The wholesaler does not currently issue GST invoices. If
  they ever need to, that is a separate project.
- **Customer CRM.** No customer records, no loyalty, no follow-up. The
  `customer_label` on a sale is free text, not a foreign key.
- **Supplier contracts.** The morning auction is a phone call, not a workflow.
- **Multi-store.** The schema is single-tenant. The kit's `lib/tenant-rls/` is
  not adopted (D14).
- **Multi-currency.** ₹ only. `Intl.NumberFormat('en-IN', { style: 'currency',
  currency: 'INR' })` is hard-coded.
- **Full Tamil/Hindi UI translations.** The UI is English; only the fish names
  are bilingual. Full UI translation is a future project.
- **iOS-specific design.** The PWA works in Safari, but no iOS-only gestures or
  PWA install flows.
- **Offline write-queue.** The worker uses a paper slip during a network outage
  and the vendor_rep enters it later. (D6.)
- **Reverse-sale flow.** Corrections are a *new* sale with a `note` field, not
  a reversal. (D6 — no edits or deletes anywhere.)
- **Worker-records-sale.** The worker is not trusted to record money. Spoilage,
  yes; sales, no.
- **Cross-batch spoilage.** A single spoilage event targets a single batch. If
  the oldest batch has only 1 kg and the worker wants to spoil 3 kg, they record
  3 separate spoilage events.
- **A custom backend.** No Node, no Express, no Next.js. The Supabase client
  talks to Supabase. (D1 — Vite SPA, not SSR.)
- **The kit's `lib/tenant-rls/` and `lib/docs-guardian/`.** Single-tenant, no
  multi-tenancy. The docs system is overkill for a 1-developer project in
  Mode A. (D14 — opt-in modules.)
- **A reviewer session before Mode A ships.** The kit recommends a reviewer at
  the end of each mode (D10). For Mode A, the spec author IS the reviewer.
  Reviewer sessions are mandatory for the Mode A → B transition and the Mode B
  → C transition.

---

## Appendix A — Demo seed

The seed runs only in Mode A. 8 fish (Pomfret வவ்வால், Surmai வஞ்சிரம், Vanjaram
வஞ்சரம், Barracuda ஷீலா, Mackerel கானாங்கெழுத்தி, Anchovy நெத்திலி, Prawn இறால்,
Squid கணவாய்) cover the common Chennai-market wholefish and shellfish, with
`shelf_life_hours` 12–48 reflecting how quickly each goes off on ice. 3 batches
per fish (plausible weights, `received_at` in the last 8 hours relative to the
seed run). 2 sales (Pomfret 1.5 kg, Prawn 0.8 kg). 1 spoilage (0.3 kg Mackerel,
"ice melt, fish slipped into melt-water"). All rows have `created_by_demo = true`.

The Vanjaram/Vancharam ambiguity in the brief is preserved as two separate fish
rows. The Mode B interview with the wholesaler resolves which to keep.

The seed is in `supabase/migrations/<UTC>_demo_seed.sql`. The migration is a
no-op if the `fish` table is non-empty.

---

## Appendix B — What I guessed (the closing list per SPEC-AUTHOR)

Per the canonical SPEC-AUTHOR prompt's closing instruction.

### Assumptions I made that the brief did not confirm

1. **The 3 roles are admin / vendor_rep / worker**, with `vendor_rep` doing BOTH
   deliveries and sales (the brief was ambiguous on whether these are one role
   or two).
2. **The worker does NOT record sales** (V1). The brief named "spoilage" for
   workers but not "sales". Locked in §9.
3. **Single-tenant.** The brief implies one store, not multiple.
4. **Money is `numeric(10,2)`, ₹ only, IST is `Asia/Kolkata` (UTC+5:30, no DST).**
5. **First sign-up becomes admin.** A kit pattern (`lib/auth-shell/`) that fits
   the "developer does not have access to the end-user yet" twist.
6. **Demo mode is gated by `VITE_DEMO_MODE` env var.** The kit does not say how
   to gate demo mode; this is my call.
7. **The audit log fires on INSERT + UPDATE + DELETE.** The V1 app may not
   issue UPDATEs (sales and spoilage are append-only by app design) but the
   log is ready.
8. **"Today's catch" is the default counter view.** A wholesaler may want
   "yesterday" or "this week"; I picked today.
9. **Cross-batch spoilage is out of scope.** A worker who wants to spoil 3 kg
   when the oldest batch has 1 kg records 3 events.

### Parts where I had to guess

1. **How the worker identifies themselves** when recording spoilage. I assumed
   `auth.users.id` (they sign in once per shift, JWT persists).
2. **What "record a sale" looks like on the worker phone.** I assumed a
   per-batch action on the counter; the brief is silent on UX.
3. **The wholesaler's form factor** — I assumed a phone, not a tablet.
4. **The unit of `weight_kg_remaining`** — `numeric(10,3)` for 1-gram precision.

### The three things most likely to be wrong

1. **Role names.** The brief said "vendor-rep"; the spec uses `vendor_rep`
   (snake_case for the role key). If the wholesaler wants `delivery_staff`
   instead, every CHECK and every RLS policy must change.
2. **The fish catalogue is too small** (8 types). A real Tamil Nadu wholesale
   handles 30+ types. A real Mode B interview will reveal which fish are
   SKU-class (always present) and which are batch-class (seasonal).
3. **"Today's catch" is the wrong default** for a 4 am shift when today's
   batches are empty for the first 30 minutes.

---

## Appendix C — TINS markers

```
<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
```

`COMPLEXITY: MEDIUM` because the project is small-to-medium (one PWA, one
Postgres schema, no multi-tenancy) but has real-time, PWA, and audit concerns.
`PLATFORM: WEB` because the only target is the PWA. `LANGUAGE: TYPESCRIPT`
because the entire consumer is TS.

---

*End of Meen-Sampat SPEC.md v1. Implementation begins in `HANDOVER.md` §5 (to
be written).*
