# 01 — Backend features with no (or minimal) frontend

> Produced from a thorough audit of every `supabase.from()`, `supabase.rpc()`, and view reference across all 25 page components and 8 shared components in `src/`, cross-checked against the 36 SQL migrations 0001–0039.

Every backend feature below either has zero frontend consumers, has a minimal consumer that's clearly incomplete, or is a server-side helper that the frontend never reaches. Items A3 and A6 are flagged as **internal-only** (not a gap, just an explicit "no action needed" record).

Classification key:
- **Buildable-from-existing-data** — backend has the rows; the page/RPC just doesn't exist yet.
- **Buildable + new view** — needs a small derived view to centralise the computation.
- **Buildable + new RPC** — needs an RPC for atomicity or authorisation, not just a view.
- **New schema** — needs a new column or table.
- **Internal-only** — server-side helper, no frontend reach needed.

| # | Backend feature | Why no (or minimal) frontend | Classification | Evidence |
|---|---|---|---|---|
| **A1** | `price_history` table (150+ rows seeded, per-SKU reference prices) | Only mentioned in `AuditLog.tsx:41` filter dropdown options; no `from('price_history')` query anywhere. D8's "SKU-level reference price for analytics" never got its analytics UI. | **Buildable-from-existing-data** — small "Price history" panel inside `FishCard` (`src/pages/FishCard.tsx`) + a `/price-history` admin page | `grep -rn "from('price_history')" src/` returns nothing |
| **A2** | `customer_complaint_summary` view (`false_claim_count`, `genuine_claim_count`, `total_resolved_complaints` per customer) | View exists but is **completely unused** — `Complaints.tsx:71` reads `customer_complaints` directly instead. `CustomerCard.tsx` has no false-claims signal in the credit-status section. | **Buildable-from-existing-data** — wire into `CustomerCard` (where D49's own motivation lives). One query: `from('customer_complaint_summary').select('*').eq('customer_id', id).maybeSingle()` | `grep -rn "customer_complaint_summary" src/` returns nothing |
| **A3** | `user_role_history` table | No frontend reference (intentional audit material — `track_user_role_change()` trigger maintains it). | **Internal-only** — leave as-is | `grep -rn "user_role_history" src/` returns nothing |
| **A4** | `check_ins` table direct read | Only the `ensure_checked_in()` RPC is called (via `useEnsureCheckedIn` in `lib/tasks.ts:41`); nothing reads the table itself. `EmployeeCard.tsx:117` explicitly states *"Check-ins, hours worked, delegated tasks, and task ratings aren't built yet — they need new schema beyond this pass."* | **Buildable-from-existing-data + new view** — `check_ins_with_names(user_id, work_date, checked_in_at)` view surfaced in `EmployeeCard` | `grep -rn "from('check_ins')" src/` returns nothing |
| **A5** | `containers` table direct query | Only joined indirectly via `container_fills.containers(container_number)` in `FormFields.tsx:162`; no `from('containers')` exists. Admin needs to register / bulk-register containers (D32's explicit "register 6 of the 10kg size" convenience) and see active vs retired. | **Buildable-from-existing-data** — a `/containers` admin page: list + bulk-register action | `grep -rn "from('containers')" src/` returns nothing |
| **A6** | `LocationSelect.includeTransit` parameter | Parameter exists in `FormFields.tsx:39-43` but **no caller passes `includeTransit: true`** (it's literally `includeTransit?: boolean` with no UI to flip it). Per `BUILDER-DECISIONS-REVIEW.md decision #80`, this is **blocked on two real business-policy answers** (outbound checkout question + what the receiving-half-of-in-transit should look like in the picker). | **Blocked on business policy** — keep the parameter; build the caller once those answers are in | `FormFields.tsx:39-43` |
| **A7** | `vendor_payments` table — only INSERT path | `VendorCard.tsx:214-219` inserts a payment, but there's **no list-view of past vendor payments** anywhere. Admin can record one but never see the history of payments to a vendor. | **Buildable-from-existing-data** — surface in `VendorCard` ("Recent payments to this vendor") + add a list section in `BillsManagement` | `src/pages/VendorCard.tsx:214` |
| **A8** | `paymentTerms` (cash/credit) on bills | Set at `record_bill_delivery` time but **only displayed as a badge** in `BillsManagement.tsx:172`. No filter, no per-vendor credit-bill summary, no "open credit bills" report. | **Buildable-from-existing-data** — filter in `BillsManagement` + a "vendor credit bills" section in `VendorCard` | `src/pages/BillsManagement.tsx:172` |
| **A9** | `reconciliation_reminder_at` / `reconciled_at` / `reconciled_by` | Used in `BillsManagement.tsx:79-84` for the "needs reconciliation" filter, but **no overdue-reminder notification fires**. The whole reconciliation-reminder system relies on the admin manually opening the page. | **Buildable-from-existing-data + new notification type** — `bills_reconciliation_due` event fired by a daily cron Edge Function (D27 Track C infra, already a known gap) | `src/pages/BillsManagement.tsx:79-84` |
| **A10** | `notifications.type` allowed vocabulary | Trigger-only writer; the client-side taxonomy lives entirely in `NotificationBell.tsx:26-49` as a 7-type switch. New notification types require BOTH the trigger/RPC update AND a `NotificationBell` update. | **Already complete** — but a `notifications_with_text` view (see B8 in `02`) would centralise the copy | `src/components/NotificationBell.tsx:26-49` |
| **A11** | `receiving_confirmations.discrepancy_flag` / `spoiled_kg` / per-batch confirmation history | `BillsManagement.tsx:66-76` reads the discrepancy flag for the alert list, but `spoiled_kg` and the per-batch confirmation history aren't surfaced anywhere. Admin has no "show me every confirmation this week" view. | **Buildable-from-existing-data** — admin audit view "Recent receiving confirmations" | `src/pages/BillsManagement.tsx:66-76` |
| **A12** | `customer_complaints.spoilage_movement_group_id` / `restock_movement_group_id` | Stored but **never read** — would link to `movements` rows for a complete audit trail of what the resolution actually did. | **Buildable-from-existing-data** — show in `Complaints.tsx` resolved-detail view ("Disposal movements: 2 rows, restock movements: 1 row") | `grep -rn "spoilage_movement_group_id\|restock_movement_group_id" src/` returns nothing |
| **A13** | `tasks.related_bill_id` / `tasks.related_sale_id` / `tasks.started_at` | Stored by `auto_complete_task` (migration 0024) but only `assigned_at` / `completed_at` are read in `MyTasks`. The link to the underlying bill/sale is invisible — and `started_at` (set when the assignee clicks "Start" on a custom task) is also unread. | **Buildable-from-existing-data** — wire into `MyTasks` (jump-to-bill / jump-to-sale) and `TaskDelegation` (display linked entity on the row) | `src/pages/MyTasks.tsx:71`; `src/lib/tasks.ts:51-69` |
| **A14** | `customer_complaints.rejected_disposition` enum (`returned_to_customer` / `disposed`) | Stored correctly but **only displayed as a raw enum string** in `Complaints.tsx:139` (e.g. literal text "returned_to_customer" rather than "Handed back to the customer"). Never used for analytics. | **Buildable-from-existing-data** — display lookup; "share of rejections by disposition" report | `src/pages/Complaints.tsx:139` |
| **A15** | Provenance chain via `movements.sale_id` → `batches` → `vendors` | Only `CustomerCard.tsx:95-114` walks this chain (and only as a `Set<string>` dedupe, not as a visible display). The "this sale drew fish from these vendors" line is one of the wholesaler's most-asked questions in commodity trading. | **Buildable-from-existing-data** — surface in `FishCard` ("which sales used fish from this batch?") and `CustomerCard` ("which vendors supplied the fish in each of this customer's purchases?") | `src/pages/CustomerCard.tsx:95-114` |

## Summary

- **Buildable-from-existing-data (no new schema):** A1, A2, A4, A5, A7, A8, A11, A12, A13, A14, A15 — 11 items
- **Buildable + new view:** A4 (check-ins view), A11 (receiving-confirmations view), A12 (movements-by-group view) — subsumed in the 11 above
- **Buildable + new RPC or trigger:** A9 (bills_reconciliation_due notification type + daily cron Edge Function)
- **Blocked on business policy:** A6 (LocationSelect.includeTransit)
- **Internal-only (no action):** A3, A10
- **New schema needed:** none

**Total low-cost wins in this category: 12** (A1, A2, A4, A5, A7, A8, A9, A11, A12, A13, A14, A15). Each is a single page or component over existing tables/views, no migration required beyond A9's notification type.

## Mapping to current pages

| Page | What new on it |
|---|---|
| `FishCard.tsx` | Price history panel (A1), provenance chain (A15) |
| `CustomerCard.tsx` | `customer_complaint_summary` overlay (A2), visible vendor chain (A15) |
| `VendorCard.tsx` | Recent vendor payments (A7), open credit bills section (A8) |
| `EmployeeCard.tsx` | Check-ins list (A4) |
| `BillsManagement.tsx` | Per-bill receiving-confirmation history (A11), paymentTerms filter (A8), overdue-reconciliation notification banner (A9) |
| `Complaints.tsx` | Visible spoilage/restock movement links (A12), pretty disposition labels (A14) |
| `MyTasks.tsx` / `TaskDelegation.tsx` | Link to bill/sale (A13), show `started_at` (A13) |
| `AdminDashboard.tsx` | (none — this is a different category of feature surface) |
| `Search.tsx` / `FishCard.tsx` / `VendorCard.tsx` | A5 implies a separate `/containers` page is the better home; surface existing low-stock containers there |

## Highest-leverage items

Of the 12 buildable items, ranked by **value to the wholesaler** (best guess based on what an admin opens daily):

1. **A5** — `/containers` admin page (D32's bulk-register + see active/retired) — closes a real existing schema-only gap
2. **A1** — price history panel on `FishCard` — D8's analytics purpose now visible
3. **A8** — `paymentTerms` filter on `BillsManagement` — the admin's "which bills are credit" question
4. **A7** — recent vendor payments on `VendorCard` — currently the admin has no UI to see "what did I pay this vendor last time"
5. **A2** — `customer_complaint_summary` on `CustomerCard` — D49's own motivation was exactly this
6. **A13** — task → bill/sale link — operational traceability
7. **A9** — overdue-reconciliation notification — D27 Track C infrastructure, multiple notifications would ride on it
