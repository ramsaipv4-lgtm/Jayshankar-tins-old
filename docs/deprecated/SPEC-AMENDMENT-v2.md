# SPEC-AMENDMENT-v2.md — Jayshankar Mode B (Pilot) scope

> **SUPERSEDED, 2026-09-10.** This amendment has been merged into `SPEC.md`, which is now at
> v2 and is the sole authoritative spec (D18–D27 below carried across largely as-is; several
> were revised during the merge — e.g. `stores`→`warehouses`, the transfer algorithm's meaning —
> by real operational facts gathered the same day, D28–D31 in `SPEC.md`). Kept here, unchanged,
> as the historical record of the original proposal. **Do not build against this file — read
> `SPEC.md` v2 instead.** Full merge record: `BUILDER-DECISIONS-REVIEW.md` decision #36.

> **This is not SPEC.md.** It is a merge-ready amendment, written in the same section
> numbering and table conventions as the canonical `SPEC.md`, covering everything decided in
> the post-Mode-A client feedback round. Per D2 (schema is never edited in place) and the
> project's own TINS discipline, the correct next step is a **human or agent SPEC-author
> session** that folds this into `SPEC.md` proper — new rows into §0.2's decision table, new
> subsections into §4.2/§4.3/§8/§9 — rather than this file replacing it. Everything below is
> written to make that merge mechanical.
>
> Read `HANDOVER.md`, `AGENTS.md`, and `SPEC.md` in full first. This assumes that context.

---

## A. New and superseded locked decisions

Continuing the numbering from SPEC.md §0.2 (D1–D17).

| # | Decision | Resolution |
|---|---|---|
| **D18** | **iOS is confirmed in scope, superseding D13's exclusion. Android ships first.** Both platforms are committed, not conditional on future demand. Sequencing: Android (Capacitor-wrapped, existing Vite/React codebase, minimal rewrite) ships first; iOS follows once Android is proven in the field. Google Play Developer fee ($25 one-time) is a builder cost. Apple Developer Program ($99/year, recurring) is a client-budgeted cost — this reopens D0.0's "no paid services" framing and should be acknowledged explicitly by whoever owns the business, not left implicit. No India-specific alternative-app-store shortcut exists; standard App Store distribution is the only confirmed path. | LOCKED |
| **D19** | **Photo attachments live in Cloudflare R2, with Supabase Storage as a fallback.** Both platforms in use, deliberately (not a silent default) — R2's free tier (10 GB, zero egress, no expiry) gives roughly 6–7 months of runway at the estimated photo volume, versus ~20 days on Supabase Storage's 1 GB alone. R2 is primary; Supabase Storage is the fallback on R2 upload failure. Compression happens **server-side** (an Edge Function step), not client-side — neither platform's built-in image-transformation product is available on its free tier. Because Supabase RLS does not reach into R2, photo access control is rebuilt as presigned URLs minted by an Edge Function that checks the requester's role — new plumbing, not automatic. | LOCKED |
| **D20** | **A Supabase Edge Function, not n8n, is the v1 automation layer.** Triggered by Database Webhooks on `movements`/`sales`/`bills`, it sends outbound WhatsApp messages (bill-share, payment-proof confirmation) via the official WhatsApp Business Cloud API directly. n8n is deferred — when added later, it sits alongside the Edge Function as a richer layer for more complex workflows, not a replacement for the reliable core path. WhatsApp inbound automation (employees messaging the store number to submit proof) is explicitly **out of scope for this phase** — see §D. | LOCKED |
| **D21** | **Containers are the shelf-life and FIFO tracking unit for stock in storage.** Physical, numbered, reusable thermocol containers (fixed capacities: 5/10/15/20/25 kg) replace the abstract batch as the operational unit a worker interacts with once fish is packed at receiving. A container is loaded from exactly one purchase event (never mixed across vendors/trips); its shelf-life clock starts at load time and is computed from the earliest `shelf_life_hours` among its contents. `batches` is unchanged as the financial/procurement record (D8); containers are a new physical-tracking layer on top of it. Full schema in §B, algorithm changes in §C. | LOCKED |
| **D22** | **Reverse-sale is in scope, modeled as new movements, never as an UPDATE.** A reversal restores kg via new movement rows referencing the original `movement_group_id`, keeping D5's append-only spirit intact. Default workflow: vendor-rep requests, admin approves, then it executes. Admin can grant a per-employee exemption (`users.can_self_reverse`) allowing trusted reps to self-execute without approval — the admin is still notified either way. | LOCKED |
| **D23** | **Multi-store schema ships in Mode B, with store-scoped (not shared) catalogs.** A `stores` table plus `store_id` threaded through `locations` and onward to `batches`/`movements`/`sales` as needed. Each store has its own `vendors` and `skus` — fresh produce needs the warehouse close to the point of sale, so a shared central catalog was explicitly rejected. Multi-store dashboards, notifications, and the super-admin role (§B) are built now but hidden behind a feature flag until a second store actually exists — same pattern as the existing `VITE_DEMO_MODE` flag. **Not** a duplicate-tables-per-store design (breaks cross-store reporting, multiplies RLS policies, fights D2) and **not** sharding (solves a scale problem this business will not have — the entire free-tier database budget is 500 MB). | LOCKED |
| **D24** | **GST support ships as a dormant, parallel track, not deferred entirely.** Fresh, unprocessed, unbranded fish is GST-exempt in India; frozen/processed seafood is not. The non-GST track stays active; a GST-compliant track (customer-level GST fields, export-to-Tally shape) is built alongside it now but stays inactive until the business needs it or the rules change. Export target is Tally, via a periodic file (XML/Excel/JSON) or a local bridge process — Tally's import gateway is a local interface on the machine running Tally, not a public cloud API, so this is not a live cloud-to-cloud integration. | LOCKED |
| **D25** | **Incomplete data warns; it never blocks a core mutation.** Named as a universal principle rather than decided per-feature: a missing receiving photo, an incomplete customer record, or a missing payment-proof photo never stops a purchase order, bill, or sale from being recorded. Missing fields get flagged in a report addressed to whoever entered the incomplete record, for the admin to follow up as a task. Applies to every soft-gated field introduced in this amendment (§B). | LOCKED |
| **D26** | **Google Looker Studio is the self-service reporting tool, not a custom-built report screen.** Free tier (not Looker Studio Pro, a different paid product with a confusingly similar name), native PostgreSQL connector, fully Google-hosted — no new server. The admin gets a dedicated **read-only Postgres role**, scoped appropriately; Postgres-level RLS must be configured on that role explicitly, since a direct Postgres connection like this can otherwise bypass Supabase's RLS. | LOCKED |
| **D27** | **Notification visibility is scoped to the role held at the time the notification fired, not retroactively.** A role change is not backfilled onto old notifications, and old notifications are not re-surfaced under a new role. Requires tracking role history, not just current role (§B). Delivery: full detail in-app; a periodic summary via native push (FCM/APNs) and WhatsApp. | LOCKED |

---

## B. New data structures

Following SPEC.md §4.2's format and column order.

### B.1 `stores`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | Unique handle. |
| `display_name` | `text` | NOT NULL | — | UI label. |
| `active` | `boolean` | NOT NULL | `true` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

`locations.store_id` (FK → `stores.id`, NOT NULL) is added. Single-store Mode A/early-Mode-B
deployments get exactly one seeded row here; nothing else changes until store #2 exists.

### B.2 `containers`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key — permanent, never reused, even if the printed number is. |
| `container_number` | `text` | NOT NULL | — | 5-digit human-facing number, printed and QR-encoded. Unique among **active** containers only (a retired container's number can be reissued to its replacement). |
| `capacity_kg` | `numeric(5,2)` | NOT NULL | — | One of `5`, `10`, `15`, `20`, `25`. CHECK constraint enforces the fixed set. |
| `active` | `boolean` | NOT NULL | `true` | `false` = retired (damaged/lost). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

Container availability (loaded vs. free to reload) is **derived**, not stored (D17) — a
container is available if no `container_fills` row on it has `kg_remaining > 0`.

### B.3 `container_fills`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `container_id` | `uuid` | NOT NULL | — | FK → `containers.id`. |
| `bill_id` | `uuid` | NOT NULL | — | FK → `bills.id` (§B.5). **Enforces the one-purchase-event-per-fill rule** — every item in this fill must trace to this one bill. |
| `location_id` | `uuid` | NOT NULL | — | FK → `locations.id`. Where the fill currently sits. |
| `filled_at` | `timestamptz` | NOT NULL | `now()` | The shelf-life clock start. Carried through unchanged by repacks (§C.3) and by transfers off container-tracked storage (§C.4 — the bug fix). |
| `kg_remaining` | `numeric(10,3)` | NOT NULL | — | Mirrors the `batches.kg_remaining` pattern — derivable, stored for read performance, kept in sync by trigger. |
| `expires_at` | `timestamptz` | NOT NULL | computed | `filled_at + min(shelf_life_hours)` across the SKUs in `container_fill_items` for this fill. Computed at fill-creation time (not a generated column, since the underlying SKU shelf-life could change later without retroactively altering an already-packed fill's clock). |
| `created_by` | `uuid` | NULL | — | `users.id`. |

### B.4 `container_fill_items`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `container_fill_id` | `uuid` | NOT NULL | — | FK → `container_fills.id`. |
| `batch_id` | `uuid` | NOT NULL | — | FK → `batches.id`. Which procurement line this portion came from. |
| `kg` | `numeric(10,3)` | NOT NULL | — | How much of that batch went into this fill. |

One fill can hold portions of several batches (multiple SKUs bought on the same trip, packed
pragmatically per the receiving employee's judgment — not a rigid one-SKU-per-container rule).

### B.5 `bills`

The Problem-A artifact that didn't exist before this amendment — the vendor-raised purchase
bill, captured at the purchase point.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `vendor_id` | `uuid` | NOT NULL | — | FK → `vendors.id`. |
| `vendor_bill_number` | `text` | NULL | — | The vendor's own bill/reference number, free text (may not exist for an informal auction-point purchase). |
| `bill_date` | `date` | NOT NULL | `now()` | |
| `total_amount` | `numeric(10,2)` | NOT NULL | — | Sum across the bill's `batches` lines — stored for read performance, not authoritative (the `batches` rows are). |
| `share_status` | `text` | NOT NULL | `'not_shared'` | `not_shared` / `shared`. |
| `shared_at` | `timestamptz` | NULL | — | When the bill was shared back to the vendor (Problem C). |
| `share_method` | `text` | NULL | — | `pdf` / `whatsapp` / `email`, whichever was used. |
| `created_by` | `uuid` | NULL | — | `users.id`. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

`batches.bill_id` (FK → `bills.id`, NULLABLE for backward compatibility with pre-amendment
rows) is added — every new delivery line traces to the bill it was purchased under.

### B.6 `receiving_confirmations`

Problem B — the photo/freshness/damage confirmation, soft-gated per D25.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `bill_id` | `uuid` | NOT NULL | — | FK → `bills.id`. |
| `confirmed_weight_kg` | `numeric(10,3)` | NULL | — | What the receiving team actually measured, if entered. |
| `discrepancy_flag` | `boolean` | NOT NULL | `false` | `true` if confirmed weight/type differs materially from the bill. |
| `notes` | `text` | NULL | — | Freshness/damage notes. |
| `photo_status` | `text` | NOT NULL | `'none'` | `none` / `pending_upload` / `uploaded`. Same three-state pattern reused for every soft-gated photo in this amendment (spoilage claims, payment proof). |
| `confirmed_by` | `uuid` | NOT NULL | — | `users.id`. |
| `confirmed_at` | `timestamptz` | NOT NULL | `now()` | |

### B.7 `customers`

Problem D — necessary-only CRM fields.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | Contact person name. |
| `business_name` | `text` | NULL | — | Only for `is_business = true`. |
| `is_business` | `boolean` | NOT NULL | `false` | |
| `phone` | `text` | NULL | — | Soft-gated per D25 — allowed empty, flagged for follow-up if missing. |
| `address` | `text` | NULL | — | Same. |
| `follow_up_status` | `text` | NULL | — | Controlled vocabulary: `cold_call` / `new_requirement` / `active` / `inactive`, extendable by migration (D3's roles-as-data pattern applied here too). |
| `fish_preference` | `text` | NULL | — | Free text. |
| `is_gst_registered` | `boolean` | NOT NULL | `false` | Part of D24's dormant GST track. |
| `gstin` | `text` | NULL | — | Only meaningful if `is_gst_registered`. |
| `assigned_rep_id` | `uuid` | NULL | — | FK → `users.id`. Which vendor-rep owns this relationship — matters more once multi-store dashboards are live. |
| `store_id` | `uuid` | NOT NULL | — | FK → `stores.id` (D23 — customers are store-scoped). |
| `active` | `boolean` | NOT NULL | `true` | |
| `created_by` | `uuid` | NULL | — | Used for D25's "flag the person who entered incomplete data" rule. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

`sales.customer_id` (FK → `customers.id`, NULLABLE for backward compatibility — pre-amendment
`sales.customer_name` free text stays as a fallback/display field, not removed).

### B.8 `payments`

Problem E — per-sale (mini-invoice) balance tracking with proof of payment.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sale_id` | `uuid` | NOT NULL | — | FK → `sales.id`. The mini-invoice this payment applies to. |
| `amount` | `numeric(10,2)` | NOT NULL | — | Never `float` (existing money rule, D-money in §3.6). |
| `method` | `text` | NULL | — | `cash` / `upi` / `bank_transfer` / other, free text. |
| `proof_status` | `text` | NOT NULL | `'none'` | Same three-state pattern as `receiving_confirmations.photo_status` — proof is optional, soft-gated per D25. |
| `paid_at` | `timestamptz` | NOT NULL | `now()` | |
| `recorded_by` | `uuid` | NOT NULL | — | `users.id`. |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

A sale's outstanding balance (`sales.total_amount - sum(payments.amount)`) is **derived**,
computed on read, never stored — no circular reference exists or is needed: `customers` never
references `sales`; `sales.customer_id` is an ordinary foreign key, and this is exactly the
existing D17 authored-vs-derived principle, applied here rather than inventing a new one.

### B.9 `reversal_requests`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sale_id` | `uuid` | NOT NULL | — | FK → `sales.id`. |
| `requested_by` | `uuid` | NOT NULL | — | `users.id`. |
| `requested_at` | `timestamptz` | NOT NULL | `now()` | |
| `status` | `text` | NOT NULL | `'requested'` | `requested` / `approved` / `denied` / `executed`. |
| `reason` | `text` | NULL | — | |
| `decided_by` | `uuid` | NULL | — | `users.id`. Admin who approved/denied — or, if `users.can_self_reverse` was set for the requester, the same as `requested_by`, auto-approved. |
| `decided_at` | `timestamptz` | NULL | — | |
| `executed_movement_group_id` | `uuid` | NULL | — | Set once the reversal actually runs — links to the new `movements` rows created (§C.5). |

`users.can_self_reverse` (`boolean`, NOT NULL, default `false`) is added — admin-settable per
employee.

### B.10 `notifications`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | NOT NULL | — | `users.id`. |
| `type` | `text` | NOT NULL | — | Controlled vocabulary — see the taxonomy in §F. |
| `payload` | `jsonb` | NULL | — | Type-specific detail (e.g. which container, which sale). |
| `role_at_creation` | `text` | NOT NULL | — | The role this notification was generated for, per D27. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `read_at` | `timestamptz` | NULL | — | |

### B.11 `user_role_history`

Required to implement D27 correctly — "relevant from the time the role was updated, not the
backwards notifications" needs to know *which role a user held when*, not just their current
role.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | NOT NULL | — | `users.id`. |
| `role` | `text` | NOT NULL | — | |
| `effective_from` | `timestamptz` | NOT NULL | `now()` | |
| `effective_to` | `timestamptz` | NULL | — | `NULL` = currently held. |

A row is closed (`effective_to` set) and a new one opened whenever `users.role` changes — a
trigger on `users` UPDATE, parallel to (and simpler than querying) the existing audit log,
which already captures the same fact but isn't optimized for this specific "what role did X
hold on date Y" query.

### B.12 `movements.kind` — two new values

`repack` (§C.3) and `reversal` (§C.5) are added to the existing controlled vocabulary
(`delivery_in`, `transfer`, `sale`, `spoilage`). `movements.container_fill_id` (FK →
`container_fills.id`, NULLABLE — only set for movements sourced from container-tracked
storage) is added alongside the existing `batch_id`.

---

## C. Algorithm changes and additions

Following SPEC.md §4.3's format.

### C.1 Container fill creation (at receiving)

1. Create the `bills` row (vendor, date) and one `batches` row per SKU line, exactly as
   today's delivery flow already does — **unchanged**.
2. For each container being packed: create (or select an existing available) `containers`
   row, then a `container_fills` row referencing this one `bill_id`.
3. Insert `container_fill_items` rows splitting the bill's `batches` across the fills the
   employee packed them into. The optional packing-recommendation feature (a simple
   greedy best-fit suggestion — no bin-packing solver needed at this scale) proposes this
   split; the employee's actual choice is what gets written.
4. Compute `container_fills.expires_at = filled_at + min(shelf_life_hours)` across the SKUs
   now in that fill, via `skus.shelf_life_hours` for each `sku_id` referenced in its
   `container_fill_items`.

### C.2 Container-sourced FIFO (replaces §4.3.2/§4.3.3's batch-ordering for container-tracked storage)

Where the existing spoilage/transfer/sale algorithms lock candidate `batches` ordered by
`delivered_at ASC`, a container-tracked storage location instead locks candidate
`container_fills` ordered by `expires_at ASC` (soonest-to-expire first — this **is** the
client's "least shelf life first" rule, made enforceable rather than estimated, because a
fill's contents can never span more than one purchase event). The cascade proceeds against
`container_fills.kg_remaining`; in parallel, the underlying `batches.kg_remaining` is
decremented via `container_fill_items` for pricing/lineage purposes (§4.3.4's margin
calculation and D8's per-batch pricing still work unchanged, since `batch_id` is still
recorded on every `movements` row — `container_fill_id` is additive, not a replacement).

### C.3 Repack (new)

Trigger: a fill's `kg_remaining` drops to where a smaller container size (from the fixed
5/10/15/20/25 set) would now comfortably hold it. Fire a notification once, on first crossing
into a smaller size class — not on every subsequent sale.

1. Worker selects the source fill (oversized, near-empty) and a destination container
   (available, right-sized).
2. Create a new `container_fills` row on the destination, with `filled_at` and `expires_at`
   **copied from the source fill unchanged** — this is the detail most likely to get built
   wrong by accident; a repack must never make fish appear fresher.
3. Copy `container_fill_items` (same `batch_id`/`kg` breakdown) onto the new fill.
4. Zero out the source fill's `kg_remaining`, freeing its container (derived-availability
   rule, §B.2).
5. Insert one `movements` row, `kind='repack'`, referencing both the source and destination
   `container_fill_id` (the `from`/`to` shape mirrors `transfer`'s `from_location_id`/
   `to_location_id` pair, but at the container-fill grain rather than the location grain).
6. **Default: any worker can execute a repack without approval** — it's a physical
   consolidation, not a financial or quantity change, unlike reversal (§C.5).

### C.4 Fix: transfer's destination timestamp (amends §4.3.3)

**Existing bug, surfaced by this amendment's shelf-life requirement:** today's transfer
algorithm sets the destination batch's `delivered_at = now()` (the transfer time). This was a
reasonable simplification before shelf-life-based sell priority was a stated requirement — now
it silently resets a fish's apparent freshness on every storage-to-display move.

**Fix:** when the source of a transfer is container-tracked storage, the destination batch's
shelf-life-relevant timestamp is carried through from the source `container_fill.filled_at`,
not reset to `now()`. All of §4.3.3's other mechanics (FIFO cascade, weighted-average
`price_per_kg_paid`, vendor attribution) are unchanged. Display itself does not get its own
container concept — once fish leaves container-tracked storage via transfer, it reverts to
ordinary batch tracking (today's existing, unmodified mechanic), just with the corrected
timestamp.

### C.5 Reversal workflow (new)

1. Vendor-rep creates a `reversal_requests` row, `status='requested'`.
2. If `users.can_self_reverse` is `true` for the requester, auto-transition to `approved`
   (`decided_by = requested_by`) — admin is still notified regardless (§F).
3. Otherwise, an admin reviews and sets `status` to `approved` or `denied`.
4. On approval, execute: generate a new `movement_group_id`, insert `movements` rows with
   `kind='reversal'` that restore `kg_remaining` to the original `batches` (and
   `container_fills`, if the original sale drew from container-tracked storage) referenced by
   the original sale's movement group. Set `reversal_requests.status='executed'` and
   `executed_movement_group_id`.
5. No UPDATE or DELETE on the original `sales`/`movements` rows at any point — consistent with
   D5's append-only spirit, exactly as D22 states.

---

## D. Updates to §9 (out of scope)

- **Remove:** "iOS-specific design" (D13) — superseded by D18.
- **Add, explicit for this phase (Mode B), to be revisited in a future phase:**
  - WhatsApp inbound automation (employees messaging the store number to submit proof) — D20
    ships outbound-only.
  - n8n itself — deferred per D20.
  - The super-admin cross-store transfer-approval flow (D23) — schema/role is built, but the
    workflow can't be meaningfully tested without a second store existing.
  - Full notification taxonomy (§F) — the core transactional subset ships; the softer entries
    (daily reports, cold-call/follow-up count tracking) are held for a later pass, partly
    because employee-activity verification is a genuinely unsolved problem (see §F) that
    software alone doesn't fix.
  - Metabase / any self-hosted BI tool — Looker Studio (D26) covers this need without a server.

---

## E. New acceptance criteria

Following SPEC.md §8's format and numbering convention (continuing past §8.9).

### 8.10 Containers
- **§8.10a** A `container_fills` row can only reference `container_fill_items` whose `batches`
  all share the same `bill_id` — enforced at the database level, not just application logic.
- **§8.10b** `container_fills.expires_at` equals `filled_at` plus the minimum
  `shelf_life_hours` across its SKUs.
- **§8.10c** A container with no `container_fills` row having `kg_remaining > 0` is reported as
  available by the derived-status query.
- **§8.10d** A sale/transfer/spoilage sourced from container-tracked storage draws fills in
  `expires_at ASC` order.

### 8.11 Repack
- **§8.11a** A repack never changes the destination fill's `filled_at`/`expires_at` relative
  to the source fill.
- **§8.11b** After a repack empties the source fill, its container is reported available.

### 8.12 Transfer timestamp fix
- **§8.12a** A transfer sourced from container-tracked storage creates a destination batch
  whose shelf-life-relevant timestamp equals the source fill's `filled_at`, not the transfer
  time.

### 8.13 Payments and reversal
- **§8.13a** A sale's outstanding balance, computed as `total_amount - sum(payments.amount)`,
  is never stored on `sales` or `customers` (D17).
- **§8.13b** A `reversal_requests` row with `status='executed'` has a non-null
  `executed_movement_group_id`, and the referenced `movements` rows sum to a full offset of
  the original sale's cascade.
- **§8.13c** A user with `can_self_reverse = false` cannot transition a `reversal_requests`
  row directly to `approved`.

### 8.14 RLS additions
- **§8.14a** A non-admin user cannot `SELECT` another store's `customers`/`sales` rows once
  `store_id` scoping is enforced (D23).
- **§8.14b** The Looker Studio read-only role (D26) cannot `INSERT`, `UPDATE`, or `DELETE` on
  any table.

---

## F. Notification taxonomy (first pass — ships partially, per §D)

Ships in Mode B (core transactional subset): purchase successful, QR/container scan
confirmation at warehouse, discrepancy noticed, spoilage/damage claim (verified/unverified per
the photo-status pattern), purchase invoice generated/sent, sales invoice generated, payment
status change (paid / partial / arrears).

Captured for a later pass, not built now: left-to-purchase / arrived-at-vendor pipeline
stages, least-shelf-life pick-list generation (depends on container maturity in the field),
daily purchase/sales report, cold-call/follow-up count tracking. That last one is flagged
honestly as a genuinely unsolved problem — self-reported activity claims aren't independently
verifiable without a real verification mechanism, and no amount of schema design fixes that; a
WhatsApp-based follow-up trail (once inbound automation eventually ships) gives a partial
signal, not a full one, and spot-checks are a more honest approach than a false sense of
verified metrics.

Delivery: full detail in-app, filtered per D27; a periodic summary via native push (FCM for
Android, APNs for iOS — new infrastructure, straightforward but real work) and via WhatsApp.

---

## G. Infrastructure decisions, summarized

- Cloudflare R2 (primary) + Supabase Storage (fallback) for photos, server-side compression
  via Edge Function (D19).
- Supabase Edge Function for v1 WhatsApp automation, official Cloud API only — no Hermes
  Agent or any LLM-agent-in-the-loop for production data writes; sender identification is a
  plain normalized phone-number lookup, not fuzzy/LLM matching (D20).
- Supabase Vault for secrets an Edge Function or trigger needs; GitHub Actions encrypted
  secrets for anything the backup workflow needs.
- Scheduled GitHub Actions workflow for encrypted `pg_dump` backups to Google Drive — no VM
  needed for this specific job, closing the real gap that Supabase's free tier has no
  automated backups at all.
- Google Looker Studio (free tier, dedicated read-only Postgres role) for self-service
  reporting — no new server (D26).
- Capacitor wraps the existing Vite/React app for both app stores (D18) — same codebase,
  native camera access as a side effect, useful for Problem B.
