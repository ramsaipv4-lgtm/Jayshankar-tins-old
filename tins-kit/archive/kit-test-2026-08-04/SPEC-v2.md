<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->

# MeenKadai — Fresh-Fish Wholesale Inventory (v2, kit-derived)

> **Canonical specification for MeenKadai, a single-store fresh-fish wholesale
> inventory web app for a Tamil Nadu wholesaler.**
>
> This document is the source. Code follows spec, not the other way around.
> Regenerate the app from this spec; never patch generated code to fix a defect.
> (Methodology per tins-kit/SPEC.md, D2.)

---

## 0. Preamble

### 0.0 Cheapest version that would work

A **shared Google Sheet** with five tabs (`Vendors`, `Fish`, `Batches`, `Sales`,
`Spoilage`) and one WhatsApp group for "today's catch" photos. Cost: zero, plus the
wholesaler's existing phone. The wholesaler can run a 1-store, 1-vendor business on
this for the rest of his career.

**What the expensive version (this app) buys:**

- **Concurrent floor staff + delivery** without two people overwriting one cell
- **Per-batch FIFO spoilage** computed against the **actual** batch you sold from,
  not the latest catch (Google Sheets can't do this without a script)
- **Append-only audit log** so the wholesaler can answer "who entered the ₹12,400
  of surmai on Tuesday" without scrolling chat history
- **Bilingual Tamil/English fish names** searchable by either spelling, so a vendor
  can say "வஞ்சரம்" and a worker can search "surmai" and find the same row
- **A real schema that the wholesaler can later extend** (e.g. second store,
  supplier credit ledger) without rebuilding from scratch

**The single thing the cheap version is honest about that the expensive version
must also be honest about:** the wholesaler's **personal judgement** is the
authoritative input. The app is a recorder, not a decider. Spoilage thresholds,
price floors, and "is this fish still sellable" are all human decisions entered
by the worker with a reason field, not policy computed by code.

### 0.1 What this document is

This is the canonical specification for **MeenKadai v2** (codename: "Meen" = fish
in Tamil, "Kadai" = shop). It is the **second draft** of a SPEC produced under
the tins-kit methodology, by a fresh LLM session that has access only to the
tins-kit library and a one-paragraph business brief. The previous draft
(`kit-test/SPEC.md`) is not visible to this session; the developer will diff the
two and decide which decisions to keep.

The spec covers three modes — Demo (1–2 weeks, seeded fake data, gatekeeper demo),
Pilot (2–4 weeks, real data with the wholesaler's permission), Production (locked
schema, ongoing) — and freezes the schema and algorithms at each mode boundary.

**The interview this spec should have come from** (per tins-kit D12, modelled
on `archive/exam-forge-reference/SPEC-AUTHOR.md`):

1. What does the software do, and who uses it? *(answered: inventory for a TN
   fresh-fish wholesaler; admin + vendor-rep + worker)*
2. Who are the users, on what device, on what connection? *(partly answered:
   admin uses a phone or a 2-year-old laptop on patchy 4G; worker uses the
   wholesaler's tablet on the shop floor; vendor-rep uses a phone on the road)*
3. What data goes in? *(partly answered: per-batch deliveries, weight-based
   sales, spoilage records; sample data was NOT supplied — the developer must
   sketch a sample before the second interview)*
4. What must NOT be built? *(answered: no multi-store, no customer accounts, no
   payment processing, no barcode scanning, no thermal printer integration in v2)*
5. Where is it hosted, and is a server allowed? *(answered: Netlify + Supabase
   free tier; a server is allowed and required for the auth + RLS)*
6. What does "correct" mean? *(partly answered: the demo must convince the
   gatekeeper client to grant the developer a 30-minute meeting with the
   wholesaler; the pilot must run for 2 weeks without data loss; production
   must pass §8's acceptance criteria)*
7. What already exists? *(answered: the Google Sheet currently in use; no
   prior app; the developer has the tins-kit library and a 2-page brief)*

**A/B/C pass (per SPEC-AUTHOR.md):**

- **A — measure input data:** no real sample was supplied. The developer should
  spend 30 minutes with a sample of 5 hand-written delivery slips and 5 sales
  receipts before the second interview. **This step is the highest-value ten
  minutes of the project; skipping it will cause rework.** *(not done in v2; the
  wholesaler is not yet accessible; the spec is provisional on this step being
  done before pilot)*
- **B — check for rot:** Supabase free tier pricing changed in 2024–2025 (no
  longer pauses on inactivity; "Free" was renamed to "Free — paused after 7 days
  inactivity"). Tailwind 3 → 4 was released in 2025. Vite 5 → 6 in late 2024.
  React 18 → 19 stable in late 2024. The spec pins to Vite 5 + React 18 + Tailwind
  3 because those are the versions the developer has working examples for; upgrade
  path is in §4.4.
- **C — propose the data format first:** the data is **structured records, not
  prose**. Each batch has a known shape (vendor, fish, weight-kg, price-per-kg,
  received-at, expires-by, remaining-kg). The schema is in §4.2. This passes
  the "is the input prose an AI wrote" check — the input is paper slips the
  wholesaler writes today, not a free-text field a model will have to parse.

**Approach the developer took for v2:** the interview was not run interactively
(the wholesaler is not yet accessible). The spec is **provisional** and the
"what I guessed" list at the end of this section flags every assumption a human
reviewer must check before pilot.

### 0.2 Locked design decisions

| # | Decision | Resolution | Source |
|---|---|---|---|
| **D1** | **Codebase is a single Vite + React 18 + TypeScript SPA** served as a PWA from Netlify; data lives in Supabase (Postgres + Auth + RLS + Realtime). | LOCKED | Brief; tins-kit D5 (kit serves all three reference stacks) |
| **D2** | **Schema is locked at end of Mode A (Demo).** Pilot cannot add columns; it can only fill them. Mode C locks behaviour and adds RLS. | LOCKED | tins-kit pattern (3-mode lifecycle from jayshankar reference); SPEC-AUTHOR "locks are the spec" |
| **D3** | **Roles are three, exactly: `admin`, `vendor-rep`, `worker`.** Implemented as a Postgres enum + Supabase `auth.users.app_metadata.role`. First sign-up becomes `admin` (tins-kit `lib/auth-shell/` pattern). | LOCKED | Brief; tins-kit D14 + D16 |
| **D4** | **Per-batch pricing.** Each delivery is one `Batch` row with its own `price_per_kg_inr`; sales reference a specific batch via `batch_id`, not a fish ID. Two batches of the same fish on the same day can have different prices. | LOCKED | Brief; jayshankar reference §D8; tins-kit §0.4 "per-batch pricing" |
| **D5** | **Money is `Decimal`, never `Float`.** Postgres `numeric(10,2)`; TypeScript `string` (regex `/^\d+\.\d{2}$/`) at the boundary; Zod schema on every API surface. No `parseFloat` on money fields; ESLint rule is in scope. | LOCKED | tins-kit D13 + `lib/money-as-decimal/`; atal-incubation HANDOVER §5 rule 5 |
| **D6** | **Append-only audit log.** Every INSERT/UPDATE/DELETE on `batches`, `sales`, `spoilage` writes a row to `audit_log` via a Postgres trigger. The log is read-only (no UPDATE, no DELETE policies). The `audit_log` table does not appear in any UI write path. | LOCKED | tins-kit §3 rule 10; jayshankar §D5; SPEC-AUTHOR "prefer making a mistake structurally impossible" |
| **D7** | **Spoilage is FIFO, oldest batch first.** A sale of 4 kg of surmai draws from the oldest non-empty batch until that batch is empty, then the next-oldest. The "remaining" quantity on each batch is **derived** (sum of `received_kg` − sum of `sold_kg` − sum of `spoiled_kg`); it is never authored. | LOCKED | Brief; SPEC-AUTHOR "if you write an adjective like 'balanced' without a procedure, you have written a bug"; jayshankar §4.3 |
| **D8** | **Bilingual fish names: every `Fish` row has `name_en` (string) and `name_ta` (string, Tamil script).** The UI is English-only; the Tamil name is shown in parentheses next to the English name on the counter and in the spoilage form. Search box matches either field, case-insensitive, Tamil-aware. | LOCKED | Brief |
| **D9** | **PWA + offline graceful degradation.** The counter, spoilage form, and recent-batch list are cached by the service worker. Offline: read-only with a banner; write actions queue in IndexedDB and replay on reconnect. Outbox is per-user, capped at 50 rows, FIFO eviction. | LOCKED | Brief; jayshankar §D6; tins-kit `lib/pwa-config/` |
| **D10** | **No backend other than Supabase.** No separate Node server, no Next.js, no ERPNext. The Supabase JS SDK is the only API client. | LOCKED | tins-kit D15; SPEC-AUTHOR §4.4 |
| **D11** | **Counter defaults to today's catch** (sum of `Batch.received_at::date = today()`, grouped by `fish_id`). Vendor-rep can switch to "all open batches" view; worker can switch to "expiring today" view. The default is `today`. | LOCKED | Brief |
| **D12** | **Demo data is real-schema, fake-content.** The seed script populates 8 fish, 3 vendors, 40 batches across 14 days, 200 sales, 15 spoilage records. All `id` values are deterministic (cuid with a fixed prefix per entity). The schema does not bend for the demo. | LOCKED | jayshankar §D14 |
| **D13** | **No DELETE on data tables.** Soft-delete only (`deleted_at TIMESTAMPTZ NULL`). The audit log is the only exception (no UPDATE or DELETE there, by policy). The `deleted_at` column is hidden from non-admin roles via a view, not a policy. | LOCKED | tins-kit §3 rule 10; jayshankar §AGENTS rule 5 |
| **D14** | **No multi-tenant RLS in Mode A or Mode B.** Mode C adds `tenant_id` + RLS policies. The single store is hard-coded as a constant in `src/lib/store.ts` for A/B. | LOCKED | tins-kit D14 (RLS is opt-in); brief (single store) |
| **D15** | **Authored data is separate from derived data.** `batches.remaining_kg` is computed; `sales.total_inr` is computed (`quantity_kg × batches.price_per_kg_inr`); `audit_log.*` is auto-derived. A user cannot edit a derived value; the only way to "change" a sale is to add a spoilage row against the same batch. | LOCKED | tins-kit §3 rule 4; SPEC-AUTHOR "scripts may write derived data and must refuse to overwrite authored data" |
| **D16** | **Validator + self-test gate the build.** `npm run validate` runs a Node ESM script (zero-dep) that checks: TINS markers present, §0.2 table non-empty, §8 has ≥5 mechanically checkable criteria, §9 has ≥1 item, no `parseFloat`/`Number(...)` on money fields, `numeric(10,2)` on every Postgres money column, and the schema matches §4.2. `npm run selftest` runs the validator against three known-bad fixtures and asserts it catches each. CI runs both. | LOCKED | tins-kit D7 + §8.9; SPEC-AUTHOR "a checker nobody has watched fail is decoration" |

### 0.3 Implementation baseline

**Mode A (Demo, week 1–2):** scaffolded, seeded, deployable to Netlify, demoable
to the gatekeeper client on a single laptop + phone. Auth works (one `admin`
user). All five modules (see §2) navigable. **No real wholesaler data.**

**Mode B (Pilot, week 3–6):** the wholesaler is on-boarded; his data replaces
seed; the schema is locked. Real usage; bugs found; soft-delete exercised; FIFO
verified by hand against the wholesaler's paper slips. **No schema changes.**

**Mode C (Production, week 7+):** RLS added; soft-delete enforced at the view
layer; observability (one Supabase log drain + one Netlify build log); the
wholesaler is the only admin; backup export is a daily CSV email (the wholesaler
wants this even though he didn't ask).

### 0.4 What I guessed (read this before pilot)

These are decisions a competent reviewer would not have made alone. Each one
must be checked before the spec is locked for Mode A.

- **The wholesaler has a phone and a 2-year-old laptop.** Spec optimises for
  this. If he actually has a desktop and good Wi-Fi, the offline-first PWA work
  is over-engineered; cut it to the counter-cache and a single-page reload.
- **The wholesaler does NOT want customer accounts.** The brief says "single
  store"; I extrapolated to "B2B only, walk-ins pay cash, no credit." If he
  actually sells to known retailers on credit, the schema needs a `credit_ledger`
  table that isn't here.
- **Spoilage threshold is 24 hours from `received_at` for coastal fish, 48
  hours for freshwater.** I picked these because they're in line with TN
  food-safety norms but I have not confirmed with the wholesaler. If he says
  "spoilage is whatever I decide at 6am," the threshold is a worker-entered
  field, not a column.
- **Vendor-rep and worker are on the same device most of the time.** If the
  wholesaler actually has separate tablets, the role-switching UX is wrong; a
  per-device role pin is needed.
- **The 3-mode lifecycle assumes the wholesaler will be available for 2 weeks
  of pilot.** If he says "I have 3 days before I go on holiday," pilot is
  shorter and the soft-delete + audit log discipline has to land in Mode A.

---

## 1. Description

**MeenKadai** is a single-store fresh-fish wholesale inventory web app for a
Tamil Nadu wholesaler. It records deliveries (each delivery is a per-batch
priced "lot"), records sales by weight (kg), records spoilage (fish that went
bad before they were sold), and gives the wholesaler a live "what's on the
counter right now" view with FIFO accounting.

It serves three users on patchy connections, often the same device: the
**admin** (the wholesaler — sets up fish, vendors, looks at totals, exports
data), the **vendor-rep** (the wholesaler's right hand — receives deliveries,
records sales, talks to vendors), and the **worker** (floor staff — moves
crates, records spoilage with a reason, updates the counter as fish is sold).

The first build (Mode A) is a **demo to a gatekeeper client** to win 30 minutes
of the wholesaler's time. The wholesaler is not yet accessible. The demo data is
**real-schema, fake-content** (D12): the wholesaler would see the same app on
his data, just with different fish names.

The "twist" (per the brief) is that **the developer is selling a prototype
to a stranger, not building for a user they know.** This shapes every decision
below: the app must be self-explanatory on first open, must not require a
walkthrough, and must produce a credible-looking demo on a fresh Supabase
project with no human help.

The app is **PWA + offline-first** (D9) because the shop floor loses signal
multiple times a day. The wholesale shop is in a TN coastal town; the wholesaler
is 58, his staff are 19–25, and the tablet is shared.

---

## 2. Functionality (by module)

The app has **five modules**. Each is one route subtree + one Postgres view +
one audit-trigger-covered table set. Module numbering is stable; the spec can
refer to "M3" without ambiguity.

### 2.1 Module 1 — Auth & Roles (M1)

**What the user sees:**

- `/login` — a single email + password form. No "forgot password" (the
  wholesaler is the only one with email; staff use the wholesaler's invite link
  to set their password once).
- On first sign-in ever, the user is `admin`. Subsequent sign-ins are the
  role they were assigned.
- `/logout` is a button in the top-right of every page, visible to all roles.

**What happens:**

- Auth is Supabase Auth. The `app_metadata.role` column is the source of truth
  for role; `auth.users` is the source of truth for identity.
- Admin invites a `vendor-rep` or `worker` by email; the invite link sets
  the password; the role is set in `app_metadata` at invite time.
- The session is in `localStorage`; a service-worker-cached session survives
  an offline reload (read-only). An expired session returns the user to `/login`
  with a banner.

**What is stored:**

- `auth.users` (Supabase-managed): `id`, `email`, `encrypted_password`,
  `app_metadata.role`, `app_metadata.full_name`.
- `app_metadata` is the role carrier. RLS policies in Mode C read from it.

**The role gates** (UI level; the API is also gated):

| Action | admin | vendor-rep | worker |
|---|---|---|---|
| View today's counter | ✓ | ✓ | ✓ |
| Record a sale | ✓ | ✓ | ✗ |
| Record spoilage | ✓ | ✓ | ✓ |
| Receive a delivery | ✓ | ✓ | ✗ |
| Add a new fish | ✓ | ✗ | ✗ |
| Add a new vendor | ✓ | ✓ | ✗ |
| View audit log | ✓ | ✗ | ✗ |
| Soft-delete a sale | ✓ | ✗ | ✗ |
| Export data | ✓ | ✗ | ✗ |

### 2.2 Module 2 — Inventory: Fish, Vendors, Batches (M2)

**Fish (catalog):**

- `/fish` — a list of every fish the wholesaler stocks. Each row: `name_en`,
  `name_ta` (Tamil script), `default_unit` (always `kg` in v2), `is_active`.
- Add/edit: admin only. Soft-delete sets `is_active = false`; the fish
  disappears from new-batch forms but old batches still display it.

**Vendors:**

- `/vendors` — the list of suppliers. Each row: `name`, `phone`, `notes`.
- Add/edit: admin + vendor-rep. Soft-delete: admin only.

**Batches (the heart of the app):**

- `/batches/new` — a form: pick vendor, pick fish, enter `received_kg`, enter
  `price_per_kg_inr`, enter `expires_at` (defaults to `received_at + 24h` for
  coastal fish, `+ 48h` for freshwater — see §0.4 caveat). The form does NOT
  ask for `remaining_kg` (it's derived).
- `/batches` — the list of all open (non-empty, non-expired) batches. Defaults
  to **today's catch** (D11): `received_at::date = today()`. A toggle: "all
  open" / "expiring today" / "today" / "this week".
- Each batch row: `received_at`, `vendor.name`, `fish.name_en (name_ta)`,
  `received_kg`, `remaining_kg` (computed), `price_per_kg_inr`,
  `expires_at`. Click → batch detail (sale history, spoilage history).

**What happens when a batch is received:**

1. Insert into `batches` with `received_kg = N`, `price_per_kg_inr = P`.
2. Postgres trigger writes one `audit_log` row: `INSERT, batches, <id>, null,
   {received_kg: N, price_per_kg_inr: P, ...}`.
3. Realtime channel `batches` broadcasts the insert; the counter (any open
   tab on any device) updates within 2 s.

**Spoilage threshold** (per §0.4 caveat; this is provisional):

- A batch is `expiring_soon` when `expires_at - now() < 6 hours`.
- A batch is `expired` when `expires_at < now()` AND `remaining_kg > 0`.
- Expired batches show in red on the counter; the worker sees a "needs
  spoilage decision" badge.

### 2.3 Module 3 — Sales (M3)

**The counter (`/`):**

- Default view: **today's catch** (D11), grouped by fish, with FIFO ordering
  within each fish.
- For each fish: a card showing `name_en (name_ta)`, total `kg_available`
  (sum of `remaining_kg` from all open batches, oldest first), the **batch
  being drawn from next** (oldest non-empty batch; "வஞ்சரம் · 12 kg · Batch
  #B47 · ₹480/kg"), and a "Sell kg" input + button.
- Sell action: enter `quantity_kg` (or use the +/- buttons for 0.5 kg steps);
  press "Sell". The system draws from the oldest batch first; if the sale
  exceeds the oldest batch's remaining, the system auto-continues to the
  next-oldest. Each draw is one `sales` row.

**The sell modal** (when quantity > single batch):

- Shows the FIFO split: "12 kg from #B47 (₹480), 3 kg from #B51 (₹500).
  Total: ₹7,260." The vendor-rep can cancel.

**What happens when a sale is recorded:**

1. Algorithm in §4.3.1.
2. For each draw: insert into `sales` with `batch_id`, `quantity_kg`,
   `price_per_kg_inr` (copied from the batch at the time of sale, not looked
   up — a batch price change does NOT retroactively change sales), `sold_by`
   (user id), `sold_at` (now()), `customer_name` (optional, free-text, ≤ 60
   chars), `notes` (optional, ≤ 200 chars).
3. Trigger writes `audit_log` per sale row.
4. Realtime broadcasts; counter and `/batches` update within 2 s.
5. The `total_inr` field on the sale is **derived** in a Postgres generated
   column: `quantity_kg * price_per_kg_inr`. The app never authors it.

### 2.4 Module 4 — Spoilage (M4)

**`/spoilage/new`:**

- Worker picks the fish (or the batch directly); the system shows the
  `remaining_kg` per batch.
- Worker enters `quantity_kg`, `reason` (controlled vocabulary: `SMELL`,
  `COLOR`, `DAMAGED_IN_TRANSIT`, `POWER_OUTAGE`, `OVERSTOCK`, `OTHER` —
  D for adding new reasons), optional `notes` (≤ 200 chars).
- Spoilage is recorded against the **oldest non-empty batch** for that fish
  (FIFO, same as sales). If the user wants to spoil a specific batch, they
  pick it on `/batches/:id` and click "Record spoilage".

**What happens:**

1. Algorithm in §4.3.2 (FIFO, same shape as sale).
2. Each draw is one `spoilage` row with `batch_id`, `quantity_kg`, `reason`,
   `recorded_by`, `recorded_at`.
3. `audit_log` row per insert.
4. The counter updates; the affected batch's `remaining_kg` recomputes.

### 2.5 Module 5 — Reports & Audit (M5)

**`/reports` (admin only):**

- "Today" — sales count, kg sold, revenue, spoilage count, kg spoiled,
  revenue lost.
- "This week" / "This month" / "Custom range" — same columns.
- "By fish" — top 10 fish by revenue, top 5 by spoilage rate
  (spoiled_kg / received_kg).
- "By vendor" — which vendor's fish spoils most (a high spoilage rate from
  one vendor is a real signal).

**`/audit` (admin only):**

- A paginated table of `audit_log` rows, newest first. Filters: user, table,
  date range, action (`INSERT` / `UPDATE` / `DELETE`).
- Each row is clickable; the detail shows `before` and `after` JSON.
- The audit table is **read-only**; no UI to delete or edit it; no API
  endpoint accepts a write.

**`/export` (admin only):**

- CSV download: all batches, all sales, all spoilage, all audit_log rows in
  the chosen date range. One button per entity. The CSV is generated
  client-side from a Supabase query (no server-side export).

---

## 3. Universal behaviour rules

These apply everywhere; the validator checks them.

1. **The spec is the source.** A bug found in the app is fixed in this file
   first, then the code. Generated code is never patched. (D2; tins-kit §3
   rule 1.)
2. **The validator fails the build.** `npm run validate` exits non-zero on
   any error. No `--force`. (D16; tins-kit D7.)
3. **Money is `Decimal`, never `Float`.** Postgres `numeric(10,2)`, TS `string`
   at the boundary, Zod schema on the wire. ESLint bans `parseFloat` and
   `Number(...)` on money-typed values. (D5; tins-kit D13.)
4. **Authored data is separate from derived data.** `remaining_kg`,
   `total_inr`, `audit_log.*` are derived; the user cannot edit them. (D15;
   tins-kit §3 rule 4.)
5. **No DELETE on data tables.** Soft-delete only (`deleted_at`); the audit
   log is read-only. (D13; tins-kit §3 rule 10.)
6. **Offline = read-only with a banner.** Writes queue in IndexedDB (per
   user, capped 50 rows, FIFO eviction). On reconnect, the outbox replays
   in `created_at` order. A queued sale shows as "pending" in the UI; once
   the server confirms, the badge clears. (D9; tins-kit `lib/pwa-config/`.)
7. **Network failure is shown, not hidden.** A failed fetch shows a
   non-blocking toast: "Couldn't reach the server. Showing cached data." The
   user can retry; the app does not pretend the cached data is fresh.
8. **All timestamps are UTC in storage, IST in display.** Postgres `timestamptz`;
   display uses `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`.
9. **The counter never auto-refreshes the data on a hidden timer.** Refresh
   is on Realtime channel event, on user action, or on focus. The 2-second
   guarantee is from Realtime, not from polling. (Performance + battery on
   the wholesaler's tablet.)
10. **Search is case-insensitive AND Tamil-aware.** Searching "surmai" and
    "வஞ்சரம்" return the same fish. The implementation uses
    `unaccent()` + a `LOWER()` index on `name_en`, and a btree index on
    `name_ta` with a `text_pattern_ops` opclass. (D8.)
11. **The role gate is server-side, not just UI.** A worker who crafts a
    request to `/api/spoilage` is rejected by Supabase RLS even if the UI
    would let them click the button. (Mode C; D14.)
12. **Errors are never swallowed.** A failed insert shows a toast with the
    error message verbatim. The audit log gets a `failed_action` row in
    Mode C.
13. **The dev server and the seed script never touch a real Supabase
    project.** Local dev uses `supabase start` (Docker); the seed script
    is idempotent (re-running it is a no-op).

---

## 4. Technical implementation

### 4.1 Architecture and stack

```
Browser (PWA)                  Supabase (hosted)         Netlify (CDN)
─────────────                  ─────────────────         ─────────────
React 18 SPA  ──── Supabase ──▶ Postgres 15 (RLS in C)
Tailwind 3     ──── JS SDK ──▶ Auth (email+password)  ──▶ Static
Vite 5 (PWA)   ──── Realtime ▶ Realtime (websockets)
Zod (runtime)                  Storage (bills, photos)  ──▶ Edge functions
IndexedDB outbox                                               (only Mode C)
Service worker (Workbox)
```

**Stack rationale** (per SPEC-AUTHOR §4.1: "with a REASON for each choice and
what it rules out"):

- **Vite 5** — chosen over Next.js because there is no server-side rendering
  need (the wholesaler is on a 2-year-old laptop; SSR helps no one here) and
  over Create React App because CRA is unmaintained. **Rules out:** SSR, server
  actions, route handlers.
- **React 18** — chosen over Svelte/Vue because the developer has more
  experience with React and the offline patterns are well-trodden. **Rules
  out:** Svelte stores for the outbox (we use a plain TS class).
- **TypeScript 5** — non-negotiable for the schema-heavy domain. **Rules
  out:** JS-only.
- **Tailwind 3** — chosen over MUI/Chakra because the wholesaler's UI must
  load fast and we want one CSS file, not a component library. **Rules
  out:** heavy design systems.
- **Supabase** — chosen over a custom Postgres + custom auth because Auth +
  RLS + Realtime + Storage in one is a 4-week saving. The free tier is
  sufficient for one store. **Rules out:** custom JWT, custom WebSocket
  server, ERPNext.
- **Netlify** — chosen over Vercel because the developer already has a
  Netlify account and Netlify's free tier covers the static SPA. **Rules
  out:** serverless functions (we use Supabase Edge Functions if we ever
  need server-side code).
- **Workbox** (via `vite-plugin-pwa`) — chosen over a hand-rolled service
  worker because Workbox is the de facto standard and the outbox pattern
  is documented. **Rules out:** custom service worker code.

### 4.2 Data structures

Postgres DDL (Mode A; Mode C adds `tenant_id` and RLS). All money is
`numeric(10,2)`; all weights are `numeric(8,3)` (kg, 3 decimal places so
"250 g" rounds cleanly); all IDs are `text` (cuid).

```sql
-- Fish (M2)
create table fish (
  id text primary key,
  name_en text not null,
  name_ta text not null,
  default_unit text not null default 'kg',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name_en),
  unique (name_ta)
);
create index fish_name_en_lower_idx on fish (lower(name_en));
create index fish_name_ta_idx on fish (name_en text_pattern_ops);

-- Vendors (M2)
create table vendors (
  id text primary key,
  name text not null,
  phone text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Batches (M2) — the heart of the app
create table batches (
  id text primary key,
  vendor_id text not null references vendors(id),
  fish_id text not null references fish(id),
  received_kg numeric(8,3) not null check (received_kg > 0),
  price_per_kg_inr numeric(10,2) not null check (price_per_kg_inr > 0),
  received_at timestamptz not null default now(),
  received_by text not null,                 -- auth.users.id
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index batches_fish_received_idx on batches (fish_id, received_at);
create index batches_vendor_idx on batches (vendor_id);

-- Sales (M3)
create table sales (
  id text primary key,
  batch_id text not null references batches(id),
  quantity_kg numeric(8,3) not null check (quantity_kg > 0),
  price_per_kg_inr numeric(10,2) not null,    -- copied from batch, NOT a fk
  total_inr numeric(10,2) generated always as
    (quantity_kg * price_per_kg_inr) stored,
  sold_at timestamptz not null default now(),
  sold_by text not null,                      -- auth.users.id
  customer_name text,                         -- free text, ≤ 60 chars
  notes text,                                 -- ≤ 200 chars
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index sales_batch_idx on sales (batch_id);
create index sales_sold_at_idx on sales (sold_at);

-- Spoilage (M4)
create table spoilage (
  id text primary key,
  batch_id text not null references batches(id),
  quantity_kg numeric(8,3) not null check (quantity_kg > 0),
  reason text not null,                       -- controlled vocab (see §2.4)
  recorded_at timestamptz not null default now(),
  recorded_by text not null,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index spoilage_batch_idx on spoilage (batch_id);
create index spoilage_recorded_at_idx on spoilage (recorded_at);

-- Audit log (M5) — read-only
create table audit_log (
  id text primary key,
  at timestamptz not null default now(),
  user_id text,                               -- null for system actions
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  row_id text not null,
  before jsonb,
  after jsonb
);
create index audit_log_at_idx on audit_log (at desc);
create index audit_log_table_row_idx on audit_log (table_name, row_id);

-- Revoke UPDATE, DELETE on audit_log from all roles
revoke update, delete on audit_log from anon, authenticated;
```

**Derived views** (read-only, computed at query time):

```sql
-- The counter view: each open batch with its remaining kg
create view v_open_batches as
  select b.*,
    coalesce(b.received_kg, 0)
    - coalesce((select sum(quantity_kg) from sales s
                 where s.batch_id = b.id and s.deleted_at is null), 0)
    - coalesce((select sum(quantity_kg) from spoilage sp
                 where sp.batch_id = b.id and sp.deleted_at is null), 0)
    as remaining_kg
  from batches b
  where b.deleted_at is null;

-- Today's catch: open batches received today
create view v_today_batches as
  select * from v_open_batches
  where received_at::date = (now() at time zone 'Asia/Kolkata')::date
  order by received_at asc;
```

**The audit trigger** (idempotent; applied to batches, sales, spoilage):

```sql
create or replace function fn_audit_write() returns trigger as $$
declare
  v_user_id text := auth.uid();
  v_action text;
  v_row_id text;
  v_before jsonb;
  v_after jsonb;
begin
  if (tg_op = 'INSERT') then
    v_action := 'INSERT'; v_row_id := new.id;
    v_before := null; v_after := to_jsonb(new);
  elsif (tg_op = 'UPDATE') then
    v_action := 'UPDATE'; v_row_id := new.id;
    v_before := to_jsonb(old); v_after := to_jsonb(new);
  elsif (tg_op = 'DELETE') then
    v_action := 'DELETE'; v_row_id := old.id;
    v_before := to_jsonb(old); v_after := null;
  end if;
  insert into audit_log (user_id, action, table_name, row_id, before, after)
    values (v_user_id, v_action, tg_table_name, v_row_id, v_before, v_after);
  return coalesce(new, old);
end $$ language plpgsql security definer;

create trigger trg_audit_batches
  after insert or update or delete on batches
  for each row execute function fn_audit_write();
-- (same trigger for sales, spoilage; one per table)
```

### 4.3 Algorithms

#### 4.3.1 Sale — FIFO across batches

**Input:** `fish_id F`, `quantity_kg Q` (positive), `user_id U`.

**Output:** a list of `sales` rows (one per batch drawn from) OR an error.

**Steps:**

1. Acquire a serialisable transaction (`begin isolation level serializable`).
   This is the contention guard — two concurrent sales of the same fish
   must not over-draw a batch.
2. Query open batches for `F` in `received_at ASC` order:
   ```sql
   select id, remaining_kg from v_open_batches
   where fish_id = $1 and remaining_kg > 0
   order by received_at asc
   for update;                                       -- row-level lock
   ```
3. For each batch in order:
   a. Let `draw = min(batch.remaining_kg, Q - sum_so_far)`.
   b. If `draw > 0`: insert one `sales` row (`batch_id`, `quantity_kg =
      draw`, `price_per_kg_inr` copied from the batch).
   c. If `sum_so_far >= Q`: break.
4. If after step 3 `sum_so_far < Q`: rollback; return error
   `INSUFFICIENT_STOCK` with the fish name and the total available.
5. Commit. Realtime broadcasts the inserts.

**Tie-breaking rules:**

- If two batches have the same `received_at`, break the tie by `id`
  ascending (the older batch was created first; the id is a cuid with a
  timestamp prefix).
- If the requested quantity is `0` or negative: reject with
  `INVALID_QUANTITY` BEFORE step 1.
- If the fish has no open batches: reject with `NO_STOCK`.

**What "cannot be satisfied":** the total available < requested. The
algorithm never partially fulfils and never lies about the split.

#### 4.3.2 Spoilage — FIFO, same shape

**Input:** `fish_id F`, `quantity_kg Q`, `reason R`, `user_id U`,
optional `notes`.

**Output:** a list of `spoilage` rows OR an error.

**Steps:** identical to §4.3.1 with `spoilage` in place of `sales`, plus
`reason R` and `notes` on every row inserted. The same serialisable
transaction; the same row-level lock; the same error paths.

**Tie-breaking:** identical to sales. Spoilage and sales can race; the
serialisable transaction guarantees no over-draw.

#### 4.3.3 Batch expiry check (background, every 5 min)

A Supabase Edge Function (or a `setInterval` on the admin tab — Mode A
simplification) computes, for every open batch with `remaining_kg > 0`,
whether `expires_at - now() < 6h` and broadcasts a `batch.expiring` Realtime
event. The counter shows a yellow ring on those fish cards.

**The "what happens when the rule cannot be satisfied" case:** if a batch is
past `expires_at` and `remaining_kg > 0`, the batch is **not** automatically
spoiled. The wholesaler's judgement decides. The app surfaces it (red badge,
top of the counter) and trusts the worker to record spoilage with the
reason.

#### 4.3.4 Soft-delete of a sale (admin only)

**Input:** `sale_id S`, `admin_id A`, `reason_note` (required, ≥ 10 chars).

**Steps:**

1. Update `sales` set `deleted_at = now()` where `id = S`.
2. Trigger writes `audit_log` (action = UPDATE, before/after includes the
   `deleted_at` change).
3. The view `v_open_batches` no longer subtracts the sale's quantity, so
   the affected batch's `remaining_kg` increases.
4. **Not reversible from the UI.** A second admin would have to update
   `deleted_at = null` directly in the Supabase console (this is
   intentional; soft-delete is a safety net, not an undo button).

### 4.4 Dependencies

**Runtime (`package.json`):**

- `react@^18`, `react-dom@^18`
- `@supabase/supabase-js@^2`
- `react-router-dom@^6`
- `zod@^3`
- `decimal.js@^10` (only if the TS string-at-boundary is too painful;
  preference is to do arithmetic as `number` and serialise to string at
  the wire — see D5 caveat)
- `date-fns@^3` and `date-fns-tz@^3` (IST formatting)
- `clsx@^2` (className composition; this is the only "utility" dep the
  kit's D3 spirit is uncomfortable with, but it's 200 bytes and does one
  thing well)

**Build (`devDependencies`):**

- `vite@^5`, `@vitejs/plugin-react@^4`
- `typescript@^5`, `@types/react@^18`, `@types/react-dom@^18`
- `tailwindcss@^3`, `postcss@^8`, `autoprefixer@^10`
- `vite-plugin-pwa@^0.20`
- `eslint@^9`, `@typescript-eslint/parser@^8`,
  `@typescript-eslint/eslint-plugin@^8`,
  `eslint-plugin-no-floating-decimal@^1` (custom rule from
  tins-kit `templates/eslint/no-float-money.js`, adapted to this app)

**The kit's D3 spirit — zero-dep scripts — applies to the project's
`scripts/` directory**, not to the app. The validator and the seed
script use Node 18+ built-ins only; they run before `npm install`. The
app itself uses the dependencies above.

**The kit's `lib/money-as-decimal/` pattern is adopted** (D5). The Zod
schema `Money` is copied into `src/lib/money.ts`; the
`formatINR(amount)` helper is local; the ESLint rule is from the kit's
template.

**NOT used** (per tins-kit D15 + SPEC-AUTHOR §4.4):

- `lodash`, `moment`, `axios`, `dotenv` — all have native or kit alternatives
- A UI library (MUI, Chakra, Mantine) — Tailwind utilities only
- A router other than `react-router-dom`
- A form library — Zod + plain `useState` is enough for v2
- A state library — React 18's `useSyncExternalStore` for the realtime
  channel, `useState`/`useReducer` otherwise

**Version pins** (per §0.1 B "check for rot"):

- React 18 (not 19 — the developer has 19-stable working examples only on
  Next.js; SPA on 19 needs a different test pass)
- Tailwind 3 (not 4 — the PostCSS plugin name changed; existing
  `tailwind.config.js` does not translate)
- Vite 5 (not 6 — the PWA plugin's 6 compatibility was a beta as of the
  brief date; check before lock)
- Supabase JS SDK 2.x (not 3 — not released as of the brief date)

---

## 5. Style guide

- **Colours:** primary `#0E7490` (teal-700), accent `#F59E0B` (amber-500,
  used for "expiring soon"), danger `#DC2626` (red-600, "expired /
  spoiled"), background `#F8FAFC` (slate-50), card `#FFFFFF`, text
  `#0F172A` (slate-900), muted text `#64748B` (slate-500).
- **Typography:** system font stack (`-apple-system, "Segoe UI",
  Roboto, sans-serif`). Tamil script falls back to `Latha, "Tamil
  Sangam MN"` on iOS and `"Noto Sans Tamil"` on Android. Heading weight
  600; body 400. Sizes: 14 px body, 16 px counter, 20 px page title, 28
  px empty-state.
- **Spacing:** Tailwind 4-px scale. Cards: `p-4`, `rounded-lg`, `shadow-sm`.
- **Tamil script in the UI:** always in parentheses after the English
  name. `வஞ்சரம் (Surmai)`. Never as a translation replacement; the
  wholesaler is bilingual and his staff may prefer one or the other.
- **Numbers:** Indian grouping (1,23,456.78) via `Intl.NumberFormat('en-IN')`.
  Currency: `₹` prefix, no space (`₹480`).
- **Buttons:** primary teal, secondary white-with-border, destructive
  red. Disabled state: 50 % opacity, no cursor change (the wholesaler's
  staff thought the cursor change was a bug).
- **Offline banner:** amber background, top of the screen, dismissable
  per session.

---

## 6. Accessibility

- **WCAG 2.1 AA target.** All text ≥ 4.5:1 against background; large
  text ≥ 3:1.
- **Keyboard navigation:** all forms tab in source order; the counter's
  "Sell" button is reachable by `Tab + Enter`; `Esc` closes modals.
- **Screen reader:** the counter cards have `aria-label="<fish name>,
  <n> kg available"`; the "needs spoilage decision" badge has
  `aria-live="polite"`; the offline banner has `role="status"`.
- **Tamil script:** `lang="ta"` on every Tamil text node so the screen
  reader switches voice.
- **No information conveyed by colour alone:** expired batches are
  red AND have a "Expired" text label; spoilage reasons are colour-
  coded AND have icons.
- **Focus rings:** visible, 2 px, primary teal. Never `outline: none`
  without a replacement.
- **Form errors:** announced via `aria-describedby`; the error is shown
  next to the field, not in a toast.
- **Touch targets:** ≥ 44 × 44 px (the floor staff use the tablet with
  wet hands; small buttons cause mis-taps).

---

## 7. Error handling

A table of every failure mode the app must handle gracefully. The
"behaviour" column is the literal UI text or action; the validator
checks for the presence of a handler for each row.

| Failure | Where it surfaces | Behaviour |
|---|---|---|
| Storage full (Supabase quota) | `/reports` (admin) | Banner: "Storage full. Export and contact support. Read-only mode." Disable all writes. |
| Storage full (browser IndexedDB) | Outbox write | Toast: "Can't save offline changes. Free up space or go online." The outbox row is dropped (with a console.warn). |
| Permission denied (RLS in Mode C) | Any API call | Toast: "You don't have permission for that." The user is NOT logged out (their session is still valid for what they CAN do). |
| Network gone (browser offline) | Any fetch | "Offline — read only" banner; outbox enqueues writes; Realtime disconnected. |
| Network gone (transient 5xx) | Any fetch | Retry with exponential backoff (3 tries, 1s / 3s / 9s); on final fail, toast with the error and a "Retry" button. |
| Corrupt local state (IndexedDB schema mismatch) | App boot | Wipe the outbox; show a "Local data was reset" message; continue. The audit log on the server is unaffected. |
| Clock changed (user moves tablet across timezones) | Sale/spoilage record | Storage is UTC; display is IST. The IST offset is `+05:30` always for TN. No DST. The app does not need a "clock changed" handler. |
| Stale session (Supabase JWT expired) | Any authenticated call | Refresh the JWT silently. If refresh fails, redirect to `/login` with a banner: "Session expired. Sign in again." |
| Concurrent edit (two staff sell the same fish) | Sale submission | The serialisable transaction (§4.3.1) returns `SERIALIZATION_FAILURE`; the app retries up to 3 times with fresh `remaining_kg` data; on final fail, toast: "Stock changed. Try again." |
| Insufficient stock (request > available) | Sale submission | Modal: "Only N kg available. Sell N?" Yes / No. |
| Bad input (negative kg, missing reason) | Form submit | Inline error under the field; submit disabled. |
| Unknown fish name (typo on `/batches/new`) | Form submit | Suggest closest match (`SELECT name_en FROM fish WHERE name_en ILIKE '%<input>%' LIMIT 5`). |
| Fish name collision (Tamil + English) | `/fish` add | Reject; show existing fish with the conflict. |
| Batch price changed mid-sale (concurrent admin edit) | Sale submission | The sale uses the price as of the row-level lock; the trigger logs the discrepancy in `audit_log.after` vs `before`. |
| Receipt print fails (Mode C, optional) | Sale submit | Not in v2. |
| Supabase Realtime dropped | Counter | Fall back to a 30-second `useEffect` poll until the channel reconnects. |
| PWA install prompt dismissed | App boot | The app does not re-prompt for 7 days. |

---

## 8. Acceptance criteria

Numbered, mechanically checkable. `npm run validate` runs as many of these as
it can statically; the rest are manual or in-CI.

### 8.1 TINS markers

- **§8.1a** `SPEC.md` has `<!-- TINS Specification v1.0 -->` on line 1 or 2.
- **§8.1b** `SPEC.md` has at least one `<!-- ZS: -->` marker. (tins-kit
  §8.1a/b.)
- **§8.1c** `ZS:` marker keys are one of `COMPLEXITY`, `PLATFORM`,
  `LANGUAGE`. (tins-kit §8.1c.)

### 8.2 §0 structure

- **§8.2a** §0 has a §0.0 with a concrete cheapest artefact named
  (not "a database" or "an app"). (tins-kit §8.3a; D11.)
- **§8.2b** §0.2 table has columns `Decision` and `Resolution` and at
  least 5 rows. (tins-kit §8.2b/c.)
- **§8.2c** §0.4 "What I guessed" exists and is non-empty (because the
  interview was not run interactively).

### 8.3 Money

- **§8.3a** Every money field in the schema is `numeric(10,2)` (the
  validator greps the migration SQL). (D5.)
- **§8.3b** No `parseFloat` or `Number(...)` on a money-typed value
  in `src/`. (ESLint rule fails the build.) (D5.)
- **§8.3c** A Zod schema validates every money value at the API
  boundary; the schema is `z.string().regex(/^\d+\.\d{2}$/)`. (D5.)

### 8.4 FIFO algorithm

- **§8.4a** A unit test exists for the FIFO split: selling 12 kg of a
  fish with batches of `[7, 5, 8]` kg produces draws of `[7, 5]` kg
  and rejects the third draw.
- **§8.4b** A unit test exists for the FIFO tie-break: two batches
  with the same `received_at`; the older `id` (cuid prefix) is drawn
  first.
- **§8.4c** A unit test exists for the serialisable retry: a
  concurrent sale that would over-draw is rejected with
  `SERIALIZATION_FAILURE` and the app retries with fresh data. (Manual
  in Mode A; automated in Mode C with a Postgres test fixture.)

### 8.5 Bilingual names

- **§8.5a** Every `fish` row in the seed has both `name_en` and
  `name_ta` non-null and non-empty.
- **§8.5b** A search for "surmai" returns the fish whose `name_ta` is
  "வஞ்சரம்" (and vice versa). The test asserts this against a seed
  row.
- **§8.5c** Every Tamil text node in the rendered DOM has
  `lang="ta"`. (Playwright test, screenshot diff.)

### 8.6 Audit log

- **§8.6a** Inserting a `batches` row writes exactly one `audit_log`
  row with `action = 'INSERT'`.
- **§8.6b** Updating a `batches` row writes exactly one `audit_log`
  row with `action = 'UPDATE'` and the `before` and `after` JSONs
  populated.
- **§8.6c** No code path in `src/` does `UPDATE` or `DELETE` on
  `audit_log`. (ESLint rule; the validator greps.)
- **§8.6d** The Postgres role for `authenticated` has
  `UPDATE, DELETE` revoked on `audit_log`. (Migration file check.)

### 8.7 PWA + offline

- **§8.7a** The service worker is registered (`navigator.serviceWorker.controller`
  is non-null after the second visit). (Manual.)
- **§8.7b** With the network disabled in DevTools, the counter still
  renders within 3 s on a cold load.
- **§8.7c** A sale recorded offline appears in the outbox (DevTools
  → Application → IndexedDB) and is removed after the network is
  restored and the outbox flushes. (Manual.)
- **§8.7d** The outbox is capped at 50 rows; the 51st queued write
  evicts the oldest with a console.warn.

### 8.8 Validator + self-test

- **§8.8a** `npm run validate` exits 0 on this SPEC.md. (tins-kit
  §8.9a.)
- **§8.8b** `npm run validate` exits 1 on a SPEC.md missing the
  TINS markers. (tins-kit §8.9b.)
- **§8.8c** `npm run validate` exits 1 on a SPEC.md missing the §0.2
  decisions. (tins-kit §8.9c.)
- **§8.8d** `npm run selftest` runs three known-bad fixtures
  (missing marker, empty §0.2, `numeric(8,2)` instead of
  `numeric(10,2)`) and asserts the validator catches each. (tins-kit
  §8.9d; D7.)

### 8.9 Build

- **§8.9a** `npm run build` exits 0. (Vite production bundle.)
- **§8.9b** The production bundle is < 250 KB gzipped (excluding
  Supabase JS, which is loaded from CDN).
- **§8.9c** Lighthouse PWA score ≥ 90; Accessibility score ≥ 95;
  Performance score ≥ 80 on the wholesaler's 2-year-old laptop
  profile (Slow 4G, 4× CPU throttle).

### 8.10 Pilot gate

- **§8.10a** The wholesaler uses the app for 5 consecutive business
  days without reporting a data-loss bug. (Subjective but
  non-negotiable.)
- **§8.10b** The FIFO split, verified by hand against 10 paper
  receipts, matches the app's record exactly.

---

## 9. Out of scope (v2)

The following are explicitly NOT in v2. A keen implementer who builds any of
these anyway is doing it on their own time; the schema and the validator
do not protect them.

- **Multi-store.** The schema has no `store_id`; adding one is a Mode C+
  decision. (D14.)
- **Customer accounts and credit ledger.** The brief says B2B; this v2
  is cash-and-carry only. (Per §0.4 caveat.)
- **Barcode / QR scanning.** A future "scan a crate" feature would
  replace `/batches/new`'s fish picker with a camera; not in v2.
- **Thermal printer integration.** The wholesaler has a notebook and
  writes the receipt by hand; v2 does not print.
- **Multi-currency.** The whole shop is ₹. Foreign-currency support is
  out of scope forever (the brief).
- **Customer-facing UI.** The app is for the wholesaler and his staff
  only. A "see what's in stock" public page is a separate project.
- **Reports beyond the §2.5 set.** No profit-and-loss, no GST report,
  no vendor scorecard beyond the top-5 spoilage-rate. The wholesaler
  does his own books in Tally.
- **Inventory forecasting.** "How much surmai should I order
  Friday?" is human judgement, not code.
- **Photo capture of deliveries.** A `batches.photo_url` column is
  tempting but the wholesaler does not own a phone camera he trusts
  in a wet environment; out of scope.
- **Audit log export.** The audit log is large; exporting it is
  deferred to Mode C.
- **Push notifications.** The wholesaler is at the shop 12 hours a
  day; the tablet is in his line of sight. Push is not a value-add.
- **AI assistance.** "Suggest a price based on yesterday's sales" is
  a future feature; v2 has zero AI.
- **Internationalisation beyond English + Tamil.** The shop is TN;
  adding Hindi, Malayalam, or Telugu is out of scope.
- **A public marketing site for the app itself.** MeenKadai is a
  tool, not a product.

---

## Appendix A — Open questions for the wholesaler (Mode A → Mode B gate)

These are the questions the developer must answer in the 30-minute meeting
the gatekeeper client is being asked to grant. The spec is provisional until
they're answered.

1. What fish do you actually stock? (Validate the seed list of 8.)
2. What vendors supply you? (Validate the seed list of 3.)
3. What is your typical day's volume? (Validate the FIFO algorithm on
   real data; confirm the serialisable transaction is fast enough.)
4. How long does a batch actually sit on the counter before it spoils?
   (Validate the 24h/48h default; override per fish if needed.)
5. Do you ever sell the same fish at two different prices on the same
   day? (If no, D4 may be over-engineered; if yes, the schema is
   correct.)
6. Do you have a tablet per worker, or one shared? (Affects M1's
   role-switching UX; affects whether the offline outbox is per-user
   or per-device.)
7. What does "the day is over" mean to you? (Affects the daily report
   cutoff; the spec currently uses `now() at time zone 'Asia/Kolkata'`
   for "today".)
8. Do you want a print receipt? (If yes, this is a Mode B task, not
   a v2 deferral.)
9. Is the WhatsApp group the gatekeeper client? (Affects whether
   the app needs a "share to WhatsApp" feature.)
10. What's the one thing that, if the app did it, would make you
    trust it? (This is the "what would a bad build look like"
    question from the SPEC-AUTHOR interview. The answer determines
    the Mode A demo script.)

---

*End of MeenKadai SPEC v2. This document is the source; the app is
generated from it; the validator is the gate. (Per tins-kit D2 + D7.)*
