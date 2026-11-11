<!-- TINS Specification v1.0 -->
<!-- Amendment, not yet merged into SPEC.md — see status below. -->

# SPEC-AMENDMENT-v3 — Truck Load procurement model + vendor-blind receiving

> **Status: draft, fully answered, not yet merged into `SPEC.md`.** Every design
> question below was asked and answered directly by the user (relaying the
> client) on 2026-09-22 — see `client-qa/truckload-procurement-receiving-
> 2026-09-22.md` for the full source material (a live call transcript + the
> client's own independently-run ChatGPT conversation + a shared infographic)
> and the round-by-round Q&A that produced these decisions. This file exists
> so the amendment can be reviewed as a whole before it's merged into
> `SPEC.md` — same precedent as `SPEC-AMENDMENT-v2.md` (merged via decision
> #36) and every D18–D62 Mode B/C addition since. **Not built. No migration
> exists yet.** This is genuinely separate from, and explicitly does not
> touch, the Phase A UI-redesign track (`phase-a-ui-redesign` branch,
> `client-qa/developer-prompt-image/prompt-*.jpg`) — Screens 2/3 of that
> track are paused pending this amendment, per the user's own explicit
> choice, but this amendment's own build (migrations, RLS) is separate work
> from that frontend-only track.

> ### Status check, 2026-10-02 — verified against `supabase/migrations/`, not against this file's header
>
> **The header above ("not built, no migration exists yet") is no longer accurate, and neither is "not
> touched by anything else": the Phase B workstream (migrations `0037`–`0046`, `docs/DECISIONS.md` #34–#37,
> 2026-10-01) built a *different* answer to the same client need, and neither document mentions the other.**
> Searched all 46 migrations for each concept:
>
> | Decision | In a migration? | What exists instead |
> |---|---|---|
> | **D63** per-warehouse `procurement_mode` toggle | **No** (`procurement_mode`: 0 hits) | Nothing toggles. The legacy bill path stays beside the new PR → RCV path ("two receiving paths", `client-qa/session3/plan.md` §5.1) |
> | **D64** `truck_loads` above `bills`, `bills.truck_load_id` | **Different shape** (`0040`) | `procurement` (one supplier lot, `PR-…`) + `truck_loads` (one arrival, `RCV-…`, status `dispatched → received \| cancelled`); lineage on `batches.procurement_id` / `truck_load_id` / `is_pro_rata_share`. There is **no** `bills.truck_load_id`. Weighted-average landed cost and "money stays the promised amount" are both implemented (`DECISIONS.md` #36) |
> | **D65** new role `receiving-storage`; `vendor-rep` narrowed to procurement | **No** (`receiving-storage`: 0 hits) | **No sixth role.** Blind receiving is `users.receiving_blind` on `vendor-rep`/`super-worker` (`worker` always blind), behind `app_settings.enforce_blind_receiving`, which ships **off** (`0037`, `0038`; `DECISIONS.md` #34, #37) |
> | **D66** `procurement_trip` task type + `vehicle_number` | **No** (`procurement_trip`: 0 hits) | Nothing |
>
> **Consequences.** (1) v3 as written is **mostly unimplemented**. (2) v3 and `SPEC-AMENDMENT-v4-plan-md.md`
> disagree: v4's D68 (blind receiving ships off) and D72 ("no sixth role") match Phase B, yet D72 also calls this
> file's D65 "the sanctioned exception". (3) The client validation this file relies on —
> `client-qa/client-call-script-2026-09-22.md` Q6–Q11 — has **no recorded answers**.
>
> **This amendment is still live and unmerged, and nothing here has been decided.** Which design wins is the
> owner's call — `HANDOVER.md` **W12** lays out the options. Until then, do not build Phase B's receiving
> screens against this file alone, or against Phase B alone.

---

## New locked decisions (D63–D66)

| # | Decision | Resolution |
|---|---|---|
| **D63** | **Two procurement modes — "vendor" (today's existing per-vendor flow, unchanged) and "truck" (new, consolidated) — coexist permanently, selected by an admin toggle, scoped per warehouse.** Not a migration path, not a one-way cutover: the client's own words were "keep both systems and based on a admin's toggle these systems are activated... maybe now they are using the truck model but later they might want to toggle the vendor model." `warehouses.procurement_mode` (`'vendor' \| 'truck'`, NOT NULL, default `'vendor'` — the default preserves today's live behavior exactly; nothing changes for any existing warehouse until an admin explicitly flips it). Scoped **per warehouse**, not globally, matching D23's existing principle that each warehouse is independently configured (its own vendors, its own SKUs — "not shared") and matching the fact that 3 independent warehouses already exist in practice (Demo/Real Operations/simulated-operations, decision #84). Confirmed directly with the user, not assumed. | LOCKED |
| **D64** | **The `truck_loads` entity: a consolidation layer sitting above `bills`, added additively — every existing `bills`/`batches`/pricing mechanic is completely unchanged.** When `procurement_mode = 'truck'`, procurement records one `truck_loads` row per trip; each individual vendor purchase within that trip is still its own ordinary `bills` row (one bill = one vendor, exactly as D8/§4.2.14 already work), just tagged with `bills.truck_load_id`. Nothing about how a `bills` row or its `batches` lines are created changes — `record_bill_delivery` (migration 0019) is extended with an optional `p_truck_load_id` parameter, not replaced. Vendor-wise purchase price is preserved exactly as it already is (`batches.price_per_kg_paid`, D8) — a **weighted-average landed cost** for the consolidated load is *derived* (D17 — computed on read, never stored), reusing the exact averaging pattern `record_transfer_cascade` (§4.3.3) already implements for a different case (`sum(price × kg) / total kg`), not a new formula. When `procurement_mode = 'vendor'` (the default), `bills.truck_load_id` is simply always NULL and every existing flow behaves identically to today — checked as a real constraint on this design, not an incidental side effect. | LOCKED |
| **D65** | **Vendor-blind receiving: a genuinely new role (`receiving-storage`), narrowing `vendor-rep` to procurement-only, enforced server-side — not a same-role UI restriction.** Per the client's own words: "vendor-rep becomes the procurement guy only and receiving&inventory-storage role is separate responsible for intaking the fish, check weight and storing in the warehouse/storage area." `receiving-storage` is added to `users.role`'s controlled vocabulary the same way `co-admin` was (D28, decision #46) — a real role, not a UI mode. The new truck-load receiving RPC's own `RETURNS` shape omits vendor identity and purchase price entirely for a caller with this role (the guarantee lives in what the function can return, not in what the frontend chooses to render — matching what "receiving must not see vendor/price" actually requires to be true rather than merely appear true). `vendor-rep`'s own role check is **removed** from every receiving-type RPC once this ships (`confirm_delivery_arrival` today, its truck-load-aware equivalent once built) — narrowing its scope, per the client's explicit "procurement guy only" framing. Admin/co-admin retain full visibility and override capability everywhere, unchanged, matching every other role split in this project. **No existing user needs reassigning** — confirmed directly with the user: every current real `vendor-rep` account stays procurement-only; `receiving-storage` is for a role that doesn't have a live person in it yet. | LOCKED |
| **D66** | **Optional upfront trip planning, built entirely on the existing `tasks` system (migration 0024, D47) rather than a parallel mechanism.** New `tasks.type` value `'procurement_trip'`, alongside the existing `receive_delivery`/`make_sale`/`pack_repack`/`custom`. `create_task()` (admin-assigns) and `create_task_round_robin()` both extended to accept this type; a `procurement_trip` task optionally captures a `vehicle_number` (plain text — no new vehicles master table; nothing so far indicates trucks need independent history beyond a label) and, when created, pre-creates a linked `truck_loads` row (`status = 'planned'`) via `tasks.truck_load_id` (nullable FK). **Vendor selection is never part of the plan** — per the client directly: "not sure if which vendor to purchase from is necessary but maybe optional," resolved as *not* part of this — which vendors get visited and what's bought from each stays live/in-the-field, exactly as today. Planning is optional in both directions: a `procurement_trip` task can exist without vendor detail, and ad-hoc procurement with no pre-created task at all remains fully supported (today's behavior, unchanged) — this is purely additive to the existing task-delegation UI (`MyTasks.tsx`, `TaskDelegation.tsx`, `eligible_roles_for_task_type()`), not a new screen or a new concept. The task auto-completes once its linked `truck_loads.status` reaches `'completed'`, reusing `auto_complete_task()`'s existing pattern (decision #70) — no new completion mechanism. | LOCKED |

---

## §4.2 additions (schema)

### 4.2.22 `warehouses.procurement_mode` (D63)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `procurement_mode` | `text` | NOT NULL | `'vendor'` | `'vendor'` \| `'truck'`. Admin/co-admin-editable via `WarehouseManagement.tsx`. Governs which procurement RPC path a given warehouse's deliveries use. |

### 4.2.23 `truck_loads` (D64, D66)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `warehouse_id` | `uuid` | NOT NULL | — | FK → `warehouses.id`. Only meaningful when that warehouse's `procurement_mode = 'truck'`. |
| `status` | `text` | NOT NULL | `'planned'` | `planned` → `in_progress` → `receiving` → `completed`, the same status-machine shape `bills`/`reversal_requests` already use. A `planned` row exists only when created via a `procurement_trip` task (D66); an ad-hoc truck load starts directly at `in_progress`. |
| `vehicle_number` | `text` | NULL | — | Free text. Set at planning time (D66) or at first-purchase time for an ad-hoc load. |
| `assigned_employee_id` | `uuid` | NULL | — | FK → `users.id`. The planned-trip case (D66); NULL for ad-hoc loads until the first purchase names who recorded it. |
| `task_id` | `uuid` | NULL | — | FK → `tasks.id`. Set only when this load originated from a `procurement_trip` task. |
| `created_by` | `uuid` | NULL | — | `users.id`. |
| `planned_at` | `timestamptz` | NULL | — | Set when created via a task. |
| `departed_at` | `timestamptz` | NULL | — | Optional, operational timestamp. |
| `arrived_at` | `timestamptz` | NULL | — | Set when receiving begins. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

`bills.truck_load_id` (FK → `truck_loads.id`, NULLABLE) is added. NULL for every `bills` row created under `procurement_mode = 'vendor'` (i.e. every existing row, and every future row at a warehouse that never switches modes) — zero behavior change for the vendor-model path (D64).

### 4.2.24 `tasks.type` extension, `tasks.vehicle_number` (D66)

`'procurement_trip'` added to `tasks.type`'s controlled vocabulary (`receive_delivery`, `make_sale`, `pack_repack`, `custom`, migration 0024). `tasks.vehicle_number` (`text`, NULL) and `tasks.truck_load_id` (FK → `truck_loads.id`, NULL) added, populated only for this type.

### 4.2.25 `users.role` extension (D65)

`'receiving-storage'` added to `users.role`'s CHECK constraint, the same mechanical change D28/decision #46 made for `co-admin` — update the constraint, `handle_new_user()`, and every place `Role` (frontend TypeScript) enumerates roles (`RoleBadge.tsx`, `defaultRouteFor`/`homeFor`, route `expected` arrays) — decision #49 already found and fixed the exact class of bug a missed spot here would reintroduce (a role the frontend doesn't recognize is a role that can't use the app at all).

---

## §4.3 additions (algorithms)

### 4.3.13 Truck-load-aware receiving, vendor-blind (D64, D65)

A new RPC, `confirm_truck_load_receiving(p_truck_load_id, p_sku_id, p_confirmed_good_kg, p_confirmed_spoiled_kg)` — modeled directly on `confirm_delivery_arrival`'s existing good/spoiled split (D55, migration 0033), generalized from "one batch" to "the SKU-level total across every `bills`/`batches` row attached to this truck load":

1. **Role check**: caller must be `admin`, `co-admin`, or `receiving-storage`. **Not** `vendor-rep` — this is the enforcement point for D65's narrowing.
2. Sum `expected` kg for the given SKU across every `batches` row whose `bill_id` is attached to `p_truck_load_id` (i.e. every vendor's contribution to that SKU on this load) — this is the number shown to the receiving-storage caller; **individual vendor rows are never included in the return shape**, only the SKU-level sum.
3. Apply the confirmed good/spoiled split exactly as `confirm_delivery_arrival` already does: physical stock (`batches.kg_remaining`, summed proportionally across the contributing batches) adjusts to the confirmed-good amount; the confirmed-spoiled share is recorded as a genuine `spoilage` movement (via the existing `apply_movement_to_batches` trigger, migration 0001 — no new decrement logic needed) and captured in a `receiving_confirmations` row (D54) with `bill_id` left NULL and a new `truck_load_id` column populated instead, since a truck-load receiving event doesn't correspond to one single bill.
4. **Money is never touched by this function** — same D54 stance, extended: `bills.total_amount` for each contributing vendor bill stays exactly what procurement recorded; discrepancy is surfaced (a `delivery_discrepancy` notification, D42/D54's existing pattern) for the admin to reconcile by hand, same as today.
5. **Weighted-average landed cost** for the consolidated batch is computed on read (D17, never stored) the moment anyone with visibility into vendor pricing asks for it (admin/co-admin only) — `sum(batches.price_per_kg_paid × batches.kg) / sum(batches.kg)` across the load's contributing batches, the same formula `record_transfer_cascade` (§4.3.3) already implements.

### 4.3.14 Optional truck-load planning (D66)

`create_task()`/`create_task_round_robin()` (migration 0024/0025), extended: when `p_type = 'procurement_trip'`, additionally accept `p_vehicle_number` (optional) and, on success, insert a `truck_loads` row (`status = 'planned'`, `assigned_employee_id` = the task's assignee, `task_id` = the new task's id, `vehicle_number` as given). `eligible_roles_for_task_type()` (migration 0025) gains `'procurement_trip'` → whichever roles can create a `bills` row under `procurement_mode = 'truck'` at that warehouse (i.e. the same roles `record_bill_delivery` already accepts — admin/co-admin/vendor-rep/super-worker, unchanged from D51's fix). `auto_complete_task()` (decision #70) gains a matching clause: a `procurement_trip` task completes when its linked `truck_loads.status` reaches `'completed'`.

---

## §8 additions (acceptance criteria)

### 8.18 Dual procurement mode (D63)
- **§8.18a** A warehouse's `procurement_mode` defaults to `'vendor'`; every existing `bills`/
  `batches` behavior is provably unchanged for a warehouse that never has this flipped (no
  `truck_load_id` ever set, no new role ever invoked).
- **§8.18b** Only admin/co-admin can change `warehouses.procurement_mode`.

### 8.19 Truck Load consolidation (D64)
- **§8.19a** A `bills` row's `truck_load_id`, when set, always references a `truck_loads` row at
  the same `warehouse_id`.
- **§8.19b** The weighted-average landed-cost calculation for a truck load with N contributing
  bills equals `sum(price_per_kg_paid × kg) / sum(kg)` across exactly those N bills' batches, no
  more, no fewer.

### 8.20 Vendor-blind receiving (D65)
- **§8.20a** A `receiving-storage`-role call to `confirm_truck_load_receiving` never receives
  vendor identity or `price_per_kg_paid` in its response, under any input.
- **§8.20b** A `vendor-rep`-role call to `confirm_truck_load_receiving` (or its single-bill
  equivalent) is rejected — this role no longer has receiving-confirmation capability once D65
  ships.
- **§8.20c** An admin/co-admin call to the same function *does* receive the full vendor breakdown
  — the restriction is role-specific, not universal.

### 8.21 Optional trip planning (D66)
- **§8.21a** A `procurement_trip` task with no vendor information ever specified is creatable and
  completable end to end.
- **§8.21b** Ad-hoc procurement (no pre-created task) under `procurement_mode = 'truck'` remains
  fully functional — planning is never required to procure.

---

## Update to `SPEC.md`'s closing §D (open items)

Add to the "what's still genuinely open" list once this amendment merges:

- ~~Procurement→receiving vendor privacy / consolidation model.~~ **Resolved by D63–D66**
  (2026-09-22): dual-mode toggle (vendor/truck, per-warehouse), a new `receiving-storage` role
  enforced server-side, `truck_loads` as an additive consolidation layer over `bills`, optional
  trip planning via the existing task system. Full source: `client-qa/truckload-procurement-
  receiving-2026-09-22.md`.

---

*End of SPEC-AMENDMENT-v3-truckload.md. Pending: user review → merge into `SPEC.md` as D63–D66
(mirroring decision #36's D18–D27 merge) → migrations written and live-tested, same discipline as
every other RPC in this project → Screens 2/3 of the Phase A UI-redesign track can then resume,
designed against the real model instead of the old single-vendor-bill assumption.*
