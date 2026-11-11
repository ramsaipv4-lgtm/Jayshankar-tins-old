-- 0013_credit_terms.sql — D33: per-customer credit limit/period + a derived status view.
-- SPEC.md §4.2.16 / D33. See BUILDER-DECISIONS-REVIEW.md decision #48 for the full writeup.
--
-- The payment-tracking MECHANICS already worked before this migration — a sale recorded with
-- zero payments already sits as an outstanding balance, more can be paid later via additional
-- payments rows (migration 0012). What didn't exist: any credit LIMIT or PERIOD concept, or any
-- visibility into who's carrying a balance or how overdue it is. This migration adds exactly
-- that — two columns and a read-only derived view, no change to how a sale itself is recorded.
--
-- Deliberately soft enforcement: record_container_sale (0009) is NOT modified. A customer over
-- their credit limit is visible, not blocked — matches D25's existing "incomplete data warns,
-- it never blocks a core mutation" principle, extended here on purpose (D33).
--
-- Idempotent, matching every prior migration's convention. Apply order: AFTER 0001–0012.

-- ============================================================
-- 1. customers.credit_limit / customers.credit_period_days (§4.2.16, D33)
-- ============================================================

alter table public.customers
  add column if not exists credit_limit numeric(10,2) check (credit_limit is null or credit_limit >= 0);
alter table public.customers
  add column if not exists credit_period_days int4 check (credit_period_days is null or credit_period_days > 0);

-- ============================================================
-- 2. customer_credit_status — derived, not stored (D17), same discipline as container_availability
-- (migration 0006). security_invoker = true so it respects the QUERYING user's own RLS on
-- customers/sales/payments, rather than running as the view owner and bypassing it — no
-- separate RLS policy needed on the view itself as a result (matches container_availability's
-- precedent exactly).
--
-- Per-sale balance is floored at 0 before summing (a sale can't be "negative debt" from a
-- customer's perspective even if somehow overpaid) and only sales with a real customer_id
-- contribute (pre-Mode-B sales, and any sale recorded against the customer_name free-text
-- fallback instead of a real customer row, correctly have no credit-status signal to give).
-- ============================================================

create or replace view public.customer_credit_status
  with (security_invoker = true)
as
with sale_balances as (
  select
    s.id as sale_id,
    s.customer_id,
    s.sold_at,
    greatest(0, s.total_amount - coalesce((
      select sum(p.amount) from public.payments p where p.sale_id = s.id
    ), 0)) as balance
  from public.sales s
  where s.customer_id is not null
),
per_customer as (
  select
    customer_id,
    coalesce(sum(balance) filter (where balance > 0), 0) as outstanding_balance,
    min(sold_at) filter (where balance > 0) as oldest_unpaid_sale_at
  from sale_balances
  group by customer_id
)
select
  c.id as customer_id,
  c.name,
  c.credit_limit,
  c.credit_period_days,
  coalesce(pc.outstanding_balance, 0) as outstanding_balance,
  (c.credit_limit is not null and coalesce(pc.outstanding_balance, 0) > c.credit_limit) as is_over_limit,
  pc.oldest_unpaid_sale_at,
  case
    when c.credit_period_days is not null and pc.oldest_unpaid_sale_at is not null
      then greatest(0, extract(day from (now() - (pc.oldest_unpaid_sale_at + make_interval(days => c.credit_period_days)))))::int
    else null
  end as days_overdue
from public.customers c
left join per_customer pc on pc.customer_id = c.id;
