-- 0020_vendor_payments.sql — Jayshankar V1 sprint (search feature, phase 1)
-- The mirror image of migrations 0012/0013's customer payments/credit-status: this project
-- tracks what customers owe the wholesaler (`payments`, `customer_credit_status`) but nothing
-- tracked what the wholesaler owes VENDORS — found while designing the vendor "card" for the
-- search feature ("how much fish we purchased on credit"), confirmed by the user as wanted now.
-- See BUILDER-DECISIONS-REVIEW.md decision #65.
--
-- vendor_payments.bill_id is NULLABLE, unlike payments.sale_id (NOT NULL) — a vendor payment is
-- often a lump sum settling several bills at once in practice (paid in cash on a later visit,
-- not bill-by-bill), so forcing a 1:1 link would misrepresent how this actually happens. Where
-- a payment IS tied to one specific bill, record it; where it's a general settlement, leave it
-- null and let vendor_credit_status's aggregate still net out correctly.
--
-- Same D5 append-only spirit as payments: a mis-recorded payment is corrected with a new row,
-- never an UPDATE/DELETE on the original.
--
-- Idempotent: IF NOT EXISTS throughout. Run after 0001-0019.

create table if not exists public.vendor_payments (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors(id) on delete restrict,
  bill_id       uuid references public.bills(id) on delete set null,
  amount        numeric(10,2) not null check (amount > 0),
  method        text check (method is null or method in ('cash', 'upi', 'bank_transfer', 'other')),
  paid_at       timestamptz not null default now(),
  recorded_by   uuid not null references public.users(id) on delete restrict,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists vendor_payments_vendor_idx on public.vendor_payments (vendor_id);
create index if not exists vendor_payments_bill_idx on public.vendor_payments (bill_id) where bill_id is not null;

alter table public.vendor_payments enable row level security;

-- Same role shape as payments' own policies (migration 0012) exactly.
drop policy if exists vendor_payments_select_non_worker on public.vendor_payments;
create policy vendor_payments_select_non_worker
  on public.vendor_payments
  for select
  to authenticated
  using (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

drop policy if exists vendor_payments_insert_rep on public.vendor_payments;
create policy vendor_payments_insert_rep
  on public.vendor_payments
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'co-admin', 'vendor-rep', 'super-worker')
  );

-- No UPDATE policy. No DELETE policy.

-- ============================================================
-- vendor_credit_status — per-vendor aggregate, mirroring customer_credit_status's own shape
-- (migration 0013) as closely as the data actually supports. vendors has no credit_limit/
-- credit_period_days columns (unlike customers) -- checked directly, not assumed -- so there's
-- no over-limit/days-overdue signal to compute here; this view is deliberately narrower than
-- its customer-side counterpart for that reason, not an oversight.
-- ============================================================

create or replace view public.vendor_credit_status
  with (security_invoker = true)
as
with per_vendor_billed as (
  select vendor_id, sum(total_amount) as total_billed, max(bill_date) as last_bill_date
  from public.bills
  group by vendor_id
),
per_vendor_paid as (
  select vendor_id, sum(amount) as total_paid
  from public.vendor_payments
  group by vendor_id
)
select
  v.id as vendor_id,
  v.name,
  coalesce(pvb.total_billed, 0) as total_billed,
  coalesce(pvp.total_paid, 0) as total_paid,
  greatest(0, coalesce(pvb.total_billed, 0) - coalesce(pvp.total_paid, 0)) as outstanding_balance,
  pvb.last_bill_date
from public.vendors v
left join per_vendor_billed pvb on pvb.vendor_id = v.id
left join per_vendor_paid pvp on pvp.vendor_id = v.id;
