# Backend requirements — Phase B (to wire the workflow picture book for real)

> **Status update 2026-10-02: this is the requirements document that the Phase B migrations (`0037`–`0046`) were built to answer.** They are written and tested but **not applied** to the live project, and almost none of it is wired into a screen — see [`BACKEND-PHASE-B-STATUS.md`](./BACKEND-PHASE-B-STATUS.md) for what exists, what does not, and which of this document's open questions are still open. Read this file for the *reasoning*; read the status file for the *state*. One place it differs from the build: it treats blind receiving as a question of access, while amendment v3 wants a new role for it — `HANDOVER.md` W12.
>
> *Original status line, as written 2026-09-29, kept for the record:* **nothing in this document has been implemented.** T10 built `/storybook`, a frontend-only
> animated deck; no file under `supabase/` was touched, no migration was written, no table was read.
> This document exists because the client asked how the flow would actually work, and because the
> gap between "screens that look right" and "screens that work" has to be written down somewhere
> before it is built.
>
> Sources: `client-qa/session2/UpNote_2026-09-29_14-47-51/*.md` (the client's own
> procurement→receiving handover spec), the 12 locked visuals
> (`client-qa/developer-prompt-image/prompt-1.md` … `prompt-12.md`), and the reference sheets in
> `example-video/`.
>
> Companion: `docs/SCHEMA.md` (what exists today), `delegation/tasks/T10-storybook-workflow/CHAPTERS-BRIEF.md`
> (how the deck is authored).

## 0. How to read this

Each section is one chapter group of the deck. For each screen it says what the screen needs, what
**already exists** in this database, and what would be **new**. Anything marked *new* is a proposal,
not a decision — several of these (grading especially) are still open questions with the client, see
`client-qa/client-questions-pending.md`.

**Picking up one chapter?** Start at §11 — it is the per-chapter index: chapter number → the screen
in the deck → the route that exists today (if any) → whether it is as-is, needs the frontend changed,
or needs new backend → the tables/functions to touch, with the section that explains them.

## 1. What already exists (do not rebuild these)

24 tables:

```
audit_log          batches            bills              check_ins
container_fill_items  container_fills  containers         customer_complaints
customers          locations          movements          notifications
payments           price_history      receiving_confirmations  reversal_requests
sales              skus               tasks              user_role_history
users              vendor_payments    vendors            warehouses
```

31 functions:

```
apply_movement_to_batches        auto_complete_task              clamp_can_self_reverse
compute_container_fill_expiry    confirm_delivery_arrival        container_sourced_cascade
create_task                      create_task_round_robin         direct_batch_cascade
eligible_roles_for_task_type     ensure_checked_in               execute_sale_reversal
file_customer_complaint          handle_new_user                 handle_user_delete
notify_admins                    notify_task_completion          notify_user
provision_warehouse_transit_locations  reassign_orphaned_tasks_on_role_change
reconcile_bill                   record_bill_delivery            record_container_fill
record_container_sale            record_container_spoilage       record_repack
record_transfer_cascade          request_sale_reversal           resolve_customer_complaint
track_user_role_change
```

**This means a large part of the deck is already backed**: procurement-as-a-bill
(`record_bill_delivery`), receiving confirmation and the discrepancy
(`confirm_delivery_arrival`, `receiving_confirmations`), container packing and shelf-life
(`record_container_fill`, `compute_container_fill_expiry`), selling from a container
(`record_container_sale`), spoilage (`record_container_spoilage`), repack (`record_repack`),
transfer (`record_transfer_cascade`), reversals (`request_sale_reversal`, `execute_sale_reversal`,
`clamp_can_self_reverse`), complaints (`file_customer_complaint`, `resolve_customer_complaint`),
tasks (`create_task`, `auto_complete_task`), notifications (`notify_user`, `notify_admins`),
bills (`reconcile_bill`, `record_bill_delivery`), and the audit trail (`audit_log`).

**The genuinely missing half is the procurement desk** — everything in the client's second and
third reference sheets (market price, quotations, purchase orders, landed cost, analytics) — plus
grading and vendor traceability. That is where sections 5–9 focus.

## 2. Cross-cutting rules (these matter more than any single table)

### 2.1 "Receiving must never see the vendor or the rate" — the client's own rule

From the handover document, verbatim: the receiving employee sees Receiving ID, fish, expected kg,
physical kg, difference, quality, optional photo — and **not** supplier name, purchase price,
supplier contact, or profit/margin.

Postgres RLS is **row**-level, not column-level, so `create policy` alone cannot express this. Three
workable options, in the order I would try them:

1. **A view for the receiving role** — `receiving_queue_v` exposing only the safe columns, granted
   to the receiving roles, with the base `procurement` table readable only by admin/co-admin. Simple,
   auditable, and it cannot be bypassed with a crafted client query.
2. **A `security definer` function** — `list_receiving_queue()` returning only safe columns. Same
   guarantee, more code, and it composes with this project's existing RPC-heavy style.
3. **Column grants** (`revoke select (supplier_id, rate)`) — works, but is easy to get wrong as the
   table grows, and leaks through any future `select *`.

**Recommendation: option 1**, with a regression test asserting that a receiving-role query cannot
return those columns. The same rule covers **purchase rate** and **margin** wherever they appear.

### 2.2 Stock moves only on receiving confirmation

The client is explicit: procurement quantities must **not** enter inventory; the received physical
weight does.

```
procurement created → dispatched → receiving created → physical weight entered
  → receiving confirmed → PHYSICAL qty enters inventory
```

`receiving_confirmations` + `confirm_delivery_arrival` already implement a version of this. **Work
item:** confirm the movement posts from *physical* rather than *expected* kg, and add a DB-level
guard so no future code path can post a movement from a procurement row (a trigger rejecting a
`movements` row sourced from procurement, or an equivalent check).

### 2.3 The traceability chain: PR → RCV → BATCH → SALE → CUSTOMER

The client wants the procurement id to be the backbone: `PR-00125 → RCV-00125 → BATCH-00125 →
SALES`. Today `batches` and `movements` exist but carry no procurement reference. **Work item:** add
`procurement_id` (nullable FK) to `batches` and `receiving_confirmations`, and thread it through
`apply_movement_to_batches`, so a sale traces back to the truck load and the vendor lots. This is
what makes "the customer complained — whose fish was it" answerable at all.

### 2.4 Vendor lots (hidden lot ids) and the honesty limit

The client's document proposes a hidden `LOT-x` per vendor *inside* a consolidated truck load, and is
honest that when fish is fully mixed the app can only say "this batch contained material from A, B
and C", never "this crate was vendor B". Backend shape: `vendor_lots` (vendor_id, truck_load_id,
sku_id, kg, lot_code) with **no** read grant for the receiving role, and `batches` linked to the
truck load rather than to individual lots. The UI must keep saying the true thing.

### 2.5 Every new mutation must write the audit trail

`audit_log` + `audit_trigger` already exist, and the client likes them ("Every change tracked, no
edits possible"). Any new table a person can change (procurement, PO, quotation, quality issue,
grade split) needs the same trigger attached, or the audit screen starts lying.

### 2.6 Notifications reuse what exists

`notify_user` / `notify_admins` and the `notifications` table are in place; the client's alert screen
(expiry, low stock, restocked, price change, overdue PO, quality rejection) is a new set of *event
sources*, not a new mechanism. **Work item:** add the hooks — expiry sweep (alongside
`compute_container_fill_expiry`), low-stock breach (skus.low_stock_threshold_kg already exists), PO
not received by its expected date, quality rejection rate above threshold.

### 2.7 Who gets the procurement desk?

The desktop suite implies a **procurement team** that the current five roles (`admin`, `co-admin`,
`vendor-rep`, `worker`, `super-worker`) do not model. Either admin/co-admin own it, or a sixth role
is added. **Client question, not an implementation choice** — it decides half the RLS in section 8.

## 3. "The daily spine" — what the eight screens need

| Screen | Exists today | New / work item |
|---|---|---|
| Home: three stats (450 KG today / 2 pending / ₹ 24K sales) | `movements`, `receiving_confirmations`, `sales` hold the raw data | one aggregate RPC `home_stats_today()`, so a phone makes one call instead of three |
| Home: the tile grid | pure UI | nothing |
| Procurement (record a purchase) | `record_bill_delivery`, `bills`, `vendor_payments` | nothing — *unless* the client wants the PR/PO model instead, see 8.2 |
| Receiving (arrival, weight, discrepancy) | `confirm_delivery_arrival`, `receiving_confirmations` | verify the physical-kg rule (2.2); short-quantity reason codes |
| **Grading & Weight (A/B/C split)** | **almost nothing** — only `skus.size_grade` (small/medium/large/xl/mixed), a property of the fish, not of the catch | **the biggest gap in the whole deck.** See 3.1 |
| Packing (container, ice, shelf-life) | `record_container_fill`, `containers`, `compute_container_fill_expiry` | grade-aware fills, so a container can say "Sela A 30 kg + Sela B 20 kg" |
| Dispatch / sell | `record_container_sale`, `sales` | nothing |
| Current Stock (by fish, by container, by expiry) | `batches`, `containers`, existing stock screens | nothing |
| Reports | **Looker Studio, external** (`docs/LOOKER-STUDIO-SETUP.md`, read-only role in migration `0022`) | decide whether the in-app screen keeps linking out (as today) or grows its own aggregates |

### 3.1 Grading — the decision that blocks three screens

The client's own question (`client-qa/client-questions-pending.md`, Q1) is still **open**. The
backend shape depends entirely on the answer:

- **(a) finer grades** (A, A-, B, B+) → a `grades` reference table, not a hardcoded enum.
- **(b) grade-wise selling price** → `grade_prices(sku_id, grade_id, price_per_kg, valid_from)`.
- **(c) photo evidence per grade row** → a photo column on the grading line.
- **(d) per-fish grade names** ("Grade 1/2/3" for some fish, "Large/Medium/Small" for others) →
  `grades` keyed by `sku_id` with a fallback to a global set.

Minimum viable tables for the AKS-style grading screen:

```
grades(id, sku_id nullable, code, label, sort_order, active)
grading_runs(id, receiving_confirmation_id, sku_id, graded_by, created_at)
grading_lines(id, grading_run_id, grade_id, kg, photo_url nullable)
```

plus a constraint that `sum(grading_lines.kg)` reconciles against the received weight — the deck
shows exactly that check ("Total 145 KG ✓" against 148.5 KG received), and an unreconciled split is
how fish quietly goes missing.

## 4. "Containers & freshness"

| Screen | Exists | New |
|---|---|---|
| My containers / register container | `containers` | check whether ownership (`owned by us` vs vendor) and notes already fit |
| QR tag (generate, print, share) | none | a QR payload convention — encode `container_id`, not the printed number, so a reprint cannot collide; reuse `ShareComposer.tsx` for the WhatsApp path |
| Scan a container → actions | none | a scan route + `container_card(container_id)` returning contents, fills and expiry in one call |
| Spoilage | `record_container_spoilage` | nothing beyond wiring the photo |
| Alerts (expiry / low stock / restocked) | notifications infrastructure | the event hooks in 2.6 |

**Note on QR:** the deck's QR is drawn client-side and is **not a real code** — no dependency was
added for it. Producing a scannable one later needs a QR encoder (new dependency) or a server-side
generator. Flagged now because it is the one thing in the deck that looks like it works and does not.

## 5. "Traceability & vendor quality"

Covered as cross-cutting rules in 2.3 and 2.4. The two tables that do not exist at all:

```
vendor_lots(id, vendor_id, truck_load_id, sku_id, kg, lot_code, created_at)
quality_issues(id, batch_id, sku_id, issue_type, kg_affected, photo_url,
               raised_by, raised_at, vendor_lot_id nullable)
```

`issue_type` values come straight from the client's document: Bad smell, Soft flesh, Damaged fish,
Old stock, Size mismatch, Weight issue, Ice/water issue, Other. The vendor scorecard the deck shows
is then a view — `vendor_quality_v`, aggregating `quality_issues` and `customer_complaints` by
vendor — which must **never** be readable by the receiving role.

## 6. "Money"

Almost entirely built: `customers`, `payments`, `bills`, `reconcile_bill`, `reversal_requests`,
`vendor_payments`, `audit_log`.

| Screen | Work item |
|---|---|
| Customer balances / take payment | nothing new |
| Customer credit limit + "over credit limit" alert | confirm whether `customers` already carries a `credit_limit`; if not, add it, and raise the existing notification type from inside the sale RPC rather than from the UI |
| Today's profit (bought / sold / profit / margin) | one aggregate — the raw data is already in `bills`, `sales`, `movements` |
| Audit log | nothing new |
| Bill reconciliation & credit terms | `reconcile_bill` exists (migration `0034`) — verify it covers the terms the deck shows |

## 7. "People & exceptions"

| Screen | Exists | Work item |
|---|---|---|
| Complaints (file → admin review → resolve with refund) | `file_customer_complaint`, `resolve_customer_complaint`, `customer_complaints` | nothing new, but check the deck's two-option resolution (full vs partial refund) against what the RPC accepts today |
| Tasks (assign → start → auto-complete) | `create_task`, `create_task_round_robin`, `auto_complete_task`, `check_ins` | nothing new — the most complete area of the app |
| Team management / invite link | `handle_new_user`, `user_role_history`, the `invite-user` edge function | nothing new |
| Reversals | `request_sale_reversal`, `execute_sale_reversal`, `clamp_can_self_reverse` | nothing new |

## 8. "Procurement desk" — the part that is genuinely new

Nothing in this section exists in the app today, in any form. It is also the part with the most
question marks, because the client has not yet told us whether their procurement team works in this
app at all (2.7) or keeps using whatever they use now and only sends the *result* in.

Ordered by what unlocks the most.

### 8.1 Purchase requirement (the "what do we need today" list)

```
purchase_requirements(id, required_date, sku_id, qty_kg, destination, priority,
                      expected_price_per_kg, status, note, created_by, created_at)
```

`priority` is the deck's High/Medium/Low; `status` is Open → In Progress → Completed. This is the
table that lets the dashboard say "Fish required today 2,400 kg" honestly.

### 8.2 Procurement (PR) and the PO

Two shapes are possible and they are not equivalent:

- **Today's shape**: procurement *is* a bill — `record_bill_delivery` writes `bills` + `batches`
  once the fish physically arrives. Simple, already working, and it is what the rep's phone does.
- **The client's proposed shape**: a `procurement` row that exists *before* arrival, carrying
  expected qty, supplier 🔒, rate 🔒, vehicle, expected arrival and the status chain
  Created → Dispatched → Arrived, with the receiving side generated from it (`RCV-000125`) and
  inventory moving only on confirmation.

The second is what the reference sheets and the handover document both describe. If it is adopted:

```
procurement(id, code 'PR-2026-000125', created_at, sku_id, expected_qty_kg,
            supplier_id 🔒, rate_per_kg 🔒, vehicle_no nullable,
            expected_arrival, status, created_by)
purchase_orders(id, code 'PO-2026-001', procurement_id nullable, supplier_id,
                po_date, expected_arrival, destination, payment_terms_days,
                transport_cost, ice_packing_cost, status, created_by)
purchase_order_lines(id, po_id, sku_id, qty_kg, price_per_kg, grade_id nullable)
```

with `receiving_confirmations.procurement_id` (or `.po_id`) closing the loop — and the RLS in 2.1
deciding who may read `supplier_id` / `rate_per_kg` / `rate`.

**Decision needed before any code:** does the app become the system of record for procurement, or
does it keep recording purchases only when the fish lands? Everything in 8.3–8.8 exists only to
answer that question.

### 8.3 Supplier quotations

```
supplier_quotations(id, sku_id, qty_kg, destination, supplier_id, price_per_kg,
                    transport_cost, quoted_at, valid_until, selected boolean)
landed_cost(id, quotation_id, purchase_price, transport, ice_packing, loading,
            other_costs, total_per_kg)
```

The deck's "Get Supplier Quoting" and "Best Price" chips are derived (`min(total_per_kg)`), not
stored. **Note:** `landed_cost` may be a computed view rather than a table — it is arithmetic over
the quotation plus fixed cost heads, and the client's sheet shows exactly that arithmetic.

### 8.4 Market price (external reference prices) and festivals

```
market_prices(id, market, sku_id, price_date, price_per_kg, source, created_by)
festivals(id, name, festival_date, market, effect, purchase_price_band,
          sale_price_band, est_demand)
```

Markets are the client's four: Rameshwaram/Ramanathapuram, Chennai, Coimbatore, Bangalore. This is
**not** `price_history`, which records *our own* realised prices; `market_prices` records what the
market is paying, entered by hand or scraped later. The festival table is trivia-shaped data with a
real use — the deck's recommendation panel ("buy 300 kg of Seer before Puratasi") is a rule over it.

### 8.5 Fish master, suppliers, analytics, alerts

- **Fish master** is `skus` plus, if 3.1(a/d) lands, grade names on top. Small.
- **Suppliers** is `vendors` plus credit terms and a performance rollup (`vendor_quality_v`).
- **Analytics** needs no tables at all: purchase quantity by fish, purchase vs sale price, supplier
  split and gross margin are all aggregates over `procurement`/`bills`/`sales`. It should ship as
  **one RPC per panel** (`analytics_purchase_by_fish(from, to)`, …) rather than views, because the
  date range is a parameter on every one of them.
- **Alerts** are the notification hooks in 2.6; the desktop panel is the same `notifications` table
  read at desk width.

## 9. Suggested build order (each step is a usable increment, not a big bang)

| # | Step | Why now | Size |
|---|---|---|---|
| 1 | The field-visibility rule (2.1) + a test that proves receiving cannot read rate/vendor | it is the client's own stated rule, it is worth nothing if it is bolted on later, and it constrains every table that follows | small |
| 2 | Verify 2.2 (physical kg posts the movement) | a wrong answer here corrupts stock silently | small |
| 3 | `grades` + `grading_runs` + `grading_lines` (3.1) | unblocks the Grading screen, grade-aware packing, and grade-wise pricing | medium — **blocked on the client's Q1 answer** |
| 4 | `procurement` + `receiving_confirmations.procurement_id` (8.2) | the backbone of the client's traceability request | medium |
| 5 | `vendor_lots` + `quality_issues` + `vendor_quality_v` (5) | what turns the app into a vendor-performance system | medium |
| 6 | Home/stats/profit aggregates (3, 6) | cheap, and it makes the existing screens feel real | small |
| 7 | `purchase_requirements` (8.1) | starts the planning side | small |
| 8 | `market_prices` + `festivals` (8.4) | independent of everything else — pure data entry | small |
| 9 | `supplier_quotations` + landed cost (8.3) | needs 8.2's decision | medium |
| 10 | `purchase_orders` + lines (8.2) | only if step 4 says the app owns procurement | medium |
| 11 | Analytics RPCs (8.5) | last, because it aggregates everything above | medium |
| 12 | The QR/scanner pair (4) | depends on a real encoder decision | medium |

Steps 1–2 are the ones I would do **even if the client never approves the desktop suite**, because
they fix properties of the data that already exists.

## 10. Open questions that must be answered before step 3 or 4

These are additions to `client-qa/client-questions-pending.md`, not a replacement for it.

1. **Grading (their Q1)** — finer grades, grade-wise price, photos, per-fish grade names? This
   decides three tables and the single most-used screen in the packing flow.
2. **Does the app own procurement, or only receiving?** If procurement happens in the app, we need
   the PR/PO model and a new role; if not, the desktop suite is a reporting layer, not a workflow,
   and its scope drops by more than half.
3. **Who is the procurement desk user?** A sixth role, or admin/co-admin? (2.7)
4. **Market price data** — who types it in every morning, from where? If nobody will, the Daily
   Market Price panel should be cut rather than shipped empty.
5. **The four markets** — Rameshwaram, Chennai, Coimbatore, Bangalore are the ones in the sheet, and
   the handover note mentions Madurai, Trichy, Coimbatore, Chennai, Bangalore. Which is the real
   list, and is a "market" the same thing as our `locations`?
6. **Weighing scale** — is the received weight typed by hand, or does anything read a scale? The
   whole discrepancy flow assumes the physical weight is entered by a person.
7. **Retention** — the client likes "no edits possible". Does that mean keep everything forever,
   including photos?

---

## 11. Per-chapter index — what to touch for each of the 32 chapters

The sections above are organised by theme; this one is organised by **the chapter number printed in
the deck**, so a comment like *"chapter 5, step 2 is wrong"* lands on a row here.

**How to use it.** "Route today" is what exists in `src/App.tsx` right now (blank = no screen yet).
"Status" means:

- **as is** — the screen exists *and* the backend already backs it; only styling is left.
- **frontend** — the backend exists, but the screen has to be changed to match the deck (and the
  client's own rules, e.g. §2.1).
- **new** — there is no screen and/or no table yet; the section named is the spec for it.

Every "frontend" row still needs the two cross-cutting rules applied: the field-visibility rule
(§2.1) and the audit trail (§2.5).

| Ch | Chapter | Route today | Status | Backend work |
|---|---|---|---|---|
| 1 | One app for the whole day | `/rep`, `/floor`, `/admin` | frontend | tile-grid home; needs the dashboard aggregates (§3, build order 6) |
| 2 | How a purchase is recorded | `/deliver` | as is | `record_bill_delivery`, `bills` — already wired |
| 3 | What happens when fish arrives | `/deliveries/confirm` | frontend | `confirm_delivery_arrival`, `receiving_confirmations`; apply §2.1 (receiving must not see vendor or rate) |
| 4 | Grading the catch | — | **new** | `grades` + `grading_runs` + `grading_lines` (§3.1) — **blocked on the client's Q1** |
| 5 | Packing into containers | `/pack` | as is → frontend | `record_container_fill`, `compute_container_fill_expiry`; becomes grade-aware once ch.4 lands |
| 6 | Selling fish to a buyer | `/sell` | frontend | `record_container_sale`; oldest-container-first, per-kilo rate, grade-wise price once ch.4 lands |
| 7 | What the manager sees | `/rep`, `/admin` | frontend | stock/expiry/low-stock aggregates (§3, §8.5) |
| 8 | Reports without a spreadsheet | — | **new** | report RPCs (stock, purchases, sales) — §3, §8.5 |
| 9 | Containers & QR tags | `/pack` (detail) | new (QR) | container tables exist; the QR encode/scan pair is §4, build order 12 |
| 10 | When fish goes bad | `/spoil` | as is | `record_container_spoilage` — already wired |
| 11 | Alerts — nothing slips past | bell + `/rep` | frontend | `notifications`, `notify_user`, `notify_admins` (§2.6) |
| 12 | One ID from boat to bill | — | **new** | `procurement` + `receiving_confirmations.procurement_id` (§2.3, build order 4) |
| 13 | Which vendor sent this? | — | **new** | `vendor_lots`, `quality_issues`, `vendor_quality_v` (§2.4, §5) |
| 14 | Customers & payments | `/customers`, `/payments` | as is → frontend | `customers`, `payments`, `vendor_payments` — wired |
| 15 | Profit & the audit trail | `/admin/audit-log` | frontend | audit log is real (`audit_log` trigger, §2.5); profit aggregates are new (§6) |
| 16 | Bills, terms & reconciliation | `/bills` | frontend | `reconcile_bill`, `bills` exist; credit terms/aging may be new (§6) |
| 17 | Reversing a sale | `/reversals` | as is | `request_sale_reversal`, `execute_sale_reversal`, `clamp_can_self_reverse` — wired |
| 18 | Customer complaints | `/complaints` | as is | `file_customer_complaint`, `resolve_customer_complaint` — wired |
| 19 | Tasks that close themselves | `/my-tasks`, `/admin/tasks` | as is | `create_task`, `auto_complete_task`, round-robin assignment — wired |
| 20 | Adding a team member | `/admin/team` | as is | invite + `users`, `user_role_history`, `handle_new_user` — wired |
| 21 | Procurement Dashboard | — | **new** | the desk's rollup screen — §8 |
| 22 | Purchase Requirements | — | **new** | `purchase_requirements` (§8.1, build order 7) |
| 23 | Fish Master | `/admin/skus` | frontend | `skus` exists; grade names on top only if §3.1(a/d) lands (§8.5) |
| 24 | Supplier Management | `/admin/vendors` | frontend | `vendors` + credit terms + `vendor_quality_v` rollup (§5, §8.5) |
| 25 | Daily Market Price | — | **new** | `market_prices` (§8.4, build order 8) |
| 26 | Festival & Market Factors | — | **new** | `festivals` (§8.4, build order 8) |
| 27 | Supplier Quotation | — | **new** | `supplier_quotations` + landed cost (§8.3, build order 9) |
| 28 | Purchase Order | — | **new** | `purchase_orders` + lines (§8.2, build order 10) — **only if the app owns procurement**, §10 Q2 |
| 29 | Goods Receiving | `/deliveries/confirm` | frontend | the receiving backend already exists; this is the desk-width view of it (§8) |
| 30 | Purchase Cost Calculation | — | **new** | landed cost (§8.3) + cost-to-margin (§6) |
| 31 | Procurement Analytics | — | **new** | analytics RPCs, one per panel (§8.5, build order 11) |
| 32 | Alerts & Notifications | bell + `/rep` | frontend | `notifications` read at desk width (§2.6, §8.5) |

**Chapters 21–32 are one decision away from halving.** If the app does **not** own procurement
(§10 Q2), then 22, 25–28 and 30 stop being workflow and become reporting over bills that arrive from
outside — rows that are "new" today become "aggregate over `bills`", and build-order steps 7, 9 and 10
mostly disappear. That question is worth settling before any of those tables are written.

### Wiring one chapter end to end (chapter 3, worked)

The pattern is the same for every chapter; chapter 3 is the instructive one because its backend
already exists and it is still the chapter most likely to be got wrong.

1. **Screen** — `src/pages/DeliveryConfirmation.tsx` behind `/deliveries/confirm`. Restyle to the
   deck's four screens (ch.3 steps 1–4) — this is the "frontend" work.
2. **Read** — `receiving_confirmations` joined to the bill's line items.
3. **Write** — `confirm_delivery_arrival(...)` already exists. Check it posts the movement on the
   **physical** weight, not the billed one (§2.2) — that is the difference between a working system
   and a silently corrupt stock ledger.
4. **The client's rule** — receiving must not be able to read the vendor or the rate (§2.1). That is
   an RLS/column decision, not a UI decision, and it needs a test that fails if it regresses.
5. **Discrepancy** — store billed and received separately and show both; never silently accept one.
6. **Audit** — every confirmation writes an `audit_log` row (§2.5).
7. **Notify** — a discrepancy notifies the admins (§2.6).

Steps 4–7 are the ones a reader skips when they only look at the picture.
