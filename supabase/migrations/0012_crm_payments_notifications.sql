-- 0012_crm_payments_notifications.sql — customers, payments, reversal_requests, notifications,
-- user_role_history (D-amendment §B.7–§B.11, D22/D24/D27). SPEC.md §4.2.16–4.2.20 already fully
-- designs all five tables — this migration builds exactly that design, schema only. RLS lives
-- in the separate supabase/rls-policies.sql, same convention as every prior migration.
--
-- Deliberately schema-only, not the algorithms on top of it (payment recording, reversal
-- execution per §4.3.11, notification dispatch) — those are SECURITY DEFINER RPC work of the
-- same shape as the container algorithms (0007–0010), sequenced as separate follow-ups once
-- this schema exists to build them against. Matches this project's own established split
-- between "migrate the tables" (0006) and "build the algorithms" (0007–0010).
--
-- A real, previously-undiscovered gap found and fixed here, not invented for this migration:
-- users.role's CHECK constraint has never included 'co-admin' since migration 0001, even though
-- D28 locked co-admin as a real role back in the v2 merge and every RLS policy since decision
-- #37 (migration 0006) has assumed it works. It has been structurally impossible to ever set a
-- real user's role to 'co-admin' in this database. Found while adding users.can_self_reverse
-- for this same migration (touching users-adjacent schema surfaced it) — fixed alongside, not
-- left for a future session to trip over. handle_new_user() (migration 0002) is fixed to match.
--
-- Idempotent, matching every prior migration's convention. Apply order: AFTER 0001–0011.

-- ============================================================
-- 1. users.role CHECK constraint — add 'co-admin' (the gap described above)
-- ============================================================

do $$
declare
  con record;
begin
  for con in
    select pgc.conname
    from pg_constraint pgc
    join pg_class rel on rel.oid = pgc.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'users'
      and pgc.contype = 'c'
      and pg_get_constraintdef(pgc.oid) like '%role%admin%'
  loop
    execute format('alter table public.users drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker'));

-- handle_new_user() (0002) independently checked meta_role against the same fixed list —
-- fixed here too, or a co-admin account could never be created via signup/admin-driven
-- creation even after the CHECK constraint above allows it to be set directly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count int;
  meta_role  text;
  meta_display text;
  resolved_role text;
  resolved_display text;
  email_local text;
begin
  meta_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  if meta_role is not null and meta_role in ('admin', 'co-admin', 'vendor-rep', 'worker', 'super-worker') then
    resolved_role := meta_role;
  else
    select count(*) into user_count from public.users;
    if user_count = 0 then
      resolved_role := 'admin';
    else
      resolved_role := 'worker';
    end if;
  end if;

  if meta_display is not null then
    resolved_display := meta_display;
  else
    email_local := split_part(coalesce(new.email, 'user'), '@', 1);
    if email_local = '' then
      email_local := 'user';
    end if;
    resolved_display := upper(substring(email_local from 1 for 1)) ||
                        substring(email_local from 2);
  end if;

  insert into public.users (id, email, role, display_name, created_at)
  values (new.id, coalesce(new.email, ''), resolved_role, resolved_display, now());
  return new;
end;
$$;

-- ============================================================
-- 2. users.can_self_reverse (§4.2.18)
-- ============================================================

alter table public.users
  add column if not exists can_self_reverse boolean not null default false;

-- ============================================================
-- 3. customers (§4.2.16)
-- ============================================================

create table if not exists public.customers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  business_name      text,
  is_business        boolean not null default false,
  phone              text,
  address            text,
  follow_up_status   text check (follow_up_status is null or follow_up_status in ('cold_call', 'new_requirement', 'active', 'inactive')),
  fish_preference    text,
  is_gst_registered  boolean not null default false,
  gstin              text,
  assigned_rep_id    uuid references public.users(id) on delete set null,
  warehouse_id       uuid not null references public.warehouses(id) on delete restrict,
  active             boolean not null default true,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists customers_warehouse_idx on public.customers (warehouse_id);
create index if not exists customers_active_idx on public.customers (active) where active;

-- sales.customer_id — nullable, backward compatible with pre-Mode-B rows. sales.customer_name
-- (free text) stays as-is per SPEC.md §4.2.16's own note — a fallback/display field, not removed.
alter table public.sales
  add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists sales_customer_idx on public.sales (customer_id) where customer_id is not null;

-- ============================================================
-- 4. payments (§4.2.17)
-- ============================================================

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete restrict,
  amount        numeric(10,2) not null check (amount > 0),
  method        text check (method is null or method in ('cash', 'upi', 'bank_transfer', 'other')),
  proof_status  text not null default 'none' check (proof_status in ('none', 'pending_upload', 'uploaded')),
  paid_at       timestamptz not null default now(),
  recorded_by   uuid not null references public.users(id) on delete restrict,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists payments_sale_idx on public.payments (sale_id);

-- ============================================================
-- 5. reversal_requests (§4.2.18, D22)
-- ============================================================

create table if not exists public.reversal_requests (
  id                          uuid primary key default gen_random_uuid(),
  sale_id                     uuid not null references public.sales(id) on delete restrict,
  requested_by                uuid not null references public.users(id) on delete restrict,
  requested_at                timestamptz not null default now(),
  status                      text not null default 'requested' check (status in ('requested', 'approved', 'denied', 'executed')),
  reason                      text,
  decided_by                  uuid references public.users(id) on delete set null,
  decided_at                  timestamptz,
  executed_movement_group_id  uuid
);
create index if not exists reversal_requests_sale_idx on public.reversal_requests (sale_id);
create index if not exists reversal_requests_status_idx on public.reversal_requests (status);

-- ============================================================
-- 6. notifications (§4.2.19, D27)
-- user_id is ON DELETE CASCADE, unlike most FKs to users in this schema (which use SET NULL to
-- avoid destroying OTHER people's audit-relevant records) — a notification isn't a record about
-- an event that matters once its owner is gone, it's that user's own inbox; nothing else
-- references it.
--
-- `type` has no CHECK constraint yet restricting it to §F's taxonomy — that taxonomy isn't read
-- in full as of this migration, and enforcing an incomplete guess would be worse than no
-- constraint. Left to the future notification-dispatch RPC to enforce the real vocabulary
-- (D31's binding rule — never a price-change type — applies there, not here).
-- ============================================================

create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  type              text not null,
  payload           jsonb,
  role_at_creation  text not null,
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ============================================================
-- 7. user_role_history (§4.2.20, required for D27) + the trigger that maintains it
-- ============================================================

create table if not exists public.user_role_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  role            text not null,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz
);
create index if not exists user_role_history_user_idx on public.user_role_history (user_id, effective_from desc);

create or replace function public.track_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_role_history (user_id, role, effective_from)
    values (new.id, new.role, new.created_at);
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    update public.user_role_history
       set effective_to = now()
     where user_id = new.id and effective_to is null;
    insert into public.user_role_history (user_id, role, effective_from)
    values (new.id, new.role, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_role_history on public.users;
create trigger trg_users_role_history
  after insert or update on public.users
  for each row execute function public.track_user_role_change();

-- Backfill: the trigger above only fires on FUTURE inserts/updates. Every user who already
-- exists needs their current role's history row created once, or user_role_history would show
-- no history at all for anyone who hasn't changed roles since this migration ran. Idempotent —
-- only inserts for users with zero existing history rows, safe to re-run.
insert into public.user_role_history (user_id, role, effective_from)
select u.id, u.role, u.created_at
  from public.users u
 where not exists (
   select 1 from public.user_role_history urh where urh.user_id = u.id
 );
