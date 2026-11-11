-- 0039_grading.sql — Phase B (BACKEND-REQUIREMENTS §3.1): the "Grading & Weight" screen.
-- Chapter 4 of the picture book: a received lot is split into grades A/B/C by size, each grade is
-- weighed, and the split is checked back against the weight that came in. This is "the biggest gap
-- in the whole deck" — before this migration only skus.size_grade existed, which describes the
-- fish, not the catch.
--
-- The client's Q1 (finer grades? grade-wise price? per-fish grade names? photo per grade?) is still
-- OPEN, so this is the minimum that survives every answer:
--   grades        - a reference table, NOT an enum. A row with sku_id NULL is a global grade
--                   (seeded A/B/C); a row with a sku_id is that fish's own name for a grade
--                   ("Grade 1" for crab). Answers (a) finer grades and (d) per-fish names are
--                   therefore rows, not migrations.
--   grading_runs  - one grading of one batch. Re-grading never edits: the old run is stamped
--                   superseded_at and a new run is written (append-only, like reversals).
--   grading_lines - kg per grade, with an optional photo_url (answer c).
-- Grade-wise selling price (answer b) is deliberately NOT built until the client answers.
--
-- Reconciliation, the point of the screen: sum(lines) + shrink_kg must equal the batch's received
-- kg, within app_settings.grading_tolerance_pct (placeholder 3%). The deck's own example is
-- 148.5 kg received, 145 kg graded, 3.5 kg shrink (ice melt, handling) -> accepted. Anything else
-- is refused with the numbers, because an unreconciled split is how fish quietly goes missing.
--
-- Not done here: grade-aware packing ("Sela A 30 kg + Sela B 20 kg" in one container). That needs
-- record_container_fill to carry a grade per item, or the batch to be split into per-grade child
-- batches; either rewrites a 237-line function that has been patched three times, so it is left as
-- a designed follow-up (docs/BACKEND-PHASE-B-STATUS.md §Not built).
--
-- No money anywhere in these tables, so every role may read and (through the RPC) write them.
-- IDEMPOTENT. Run after 0038.

create table if not exists public.grades (
  id          uuid primary key default gen_random_uuid(),
  sku_id      uuid references public.skus(id) on delete cascade,   -- NULL = global
  code        text not null,
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique nulls not distinct (sku_id, code)
);

create table if not exists public.grading_runs (
  id                         uuid primary key default gen_random_uuid(),
  batch_id                   uuid not null references public.batches(id) on delete restrict,
  receiving_confirmation_id  uuid references public.receiving_confirmations(id) on delete restrict,
  sku_id                     uuid not null references public.skus(id),
  received_kg                numeric(10,3) not null check (received_kg > 0),
  shrink_kg                  numeric(10,3) not null default 0 check (shrink_kg >= 0),
  unreconciled_kg            numeric(10,3) not null default 0,   -- received - graded - shrink (within tolerance)
  note                       text,
  graded_by                  uuid not null references public.users(id),
  created_at                 timestamptz not null default now(),
  superseded_at              timestamptz,
  superseded_by_run_id       uuid references public.grading_runs(id)
);
create index if not exists grading_runs_batch_idx on public.grading_runs (batch_id);
-- at most one live run per batch
create unique index if not exists grading_runs_one_live_per_batch
  on public.grading_runs (batch_id) where superseded_at is null;

create table if not exists public.grading_lines (
  id              uuid primary key default gen_random_uuid(),
  grading_run_id  uuid not null references public.grading_runs(id) on delete restrict,
  grade_id        uuid not null references public.grades(id),
  kg              numeric(10,3) not null check (kg > 0),
  photo_url       text,
  unique (grading_run_id, grade_id)
);
create index if not exists grading_lines_run_idx on public.grading_lines (grading_run_id);

alter table public.grades        enable row level security;
alter table public.grading_runs  enable row level security;
alter table public.grading_lines enable row level security;

drop policy if exists grades_select_authenticated on public.grades;
create policy grades_select_authenticated on public.grades for select to authenticated using (true);
drop policy if exists grades_insert_admin on public.grades;
create policy grades_insert_admin on public.grades for insert to authenticated
  with check (public.current_user_role() in ('admin', 'co-admin'));
drop policy if exists grades_update_admin on public.grades;
create policy grades_update_admin on public.grades for update to authenticated
  using (public.current_user_role() in ('admin', 'co-admin'))
  with check (public.current_user_role() in ('admin', 'co-admin'));

drop policy if exists grading_runs_select_authenticated on public.grading_runs;
create policy grading_runs_select_authenticated on public.grading_runs for select to authenticated using (true);
drop policy if exists grading_lines_select_authenticated on public.grading_lines;
create policy grading_lines_select_authenticated on public.grading_lines for select to authenticated using (true);
-- No INSERT/UPDATE/DELETE policy on runs/lines: record_grading_run() is the only writer.

insert into public.grades (sku_id, code, label, sort_order) values
  (null, 'A', 'Grade A (large)',  1),
  (null, 'B', 'Grade B (medium)', 2),
  (null, 'C', 'Grade C (small)',  3)
on conflict (sku_id, code) do nothing;

do $$
declare t text;
begin
  foreach t in array array['grades', 'grading_runs', 'grading_lines'] loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I
                      for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------------------------------------
-- record_grading_run(batch, lines, shrink, note)
--   p_lines: [{"grade_id": uuid, "kg": 80, "photo_url": "..."}, ...]
-- ------------------------------------------------------------------------------------------------
create or replace function public.record_grading_run(
  p_batch_id uuid,
  p_lines    jsonb,
  p_shrink_kg numeric default 0,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := public.current_user_role();
  v_user   uuid := auth.uid();
  v_batch  record;
  v_loc_kind text;
  v_line   jsonb;
  v_grade  record;
  v_sum    numeric(10,3) := 0;
  v_gap    numeric(10,3);
  v_tol    numeric;
  v_run_id uuid := gen_random_uuid();
  v_prev   uuid;
  v_conf   uuid;
  v_seen   uuid[] := '{}';
  v_n      int := 0;
begin
  if v_role is null then
    raise exception 'record_grading_run: not signed in' using errcode = '42501';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('error', 'At least one grade line is required');
  end if;
  if coalesce(p_shrink_kg, 0) < 0 or coalesce(p_shrink_kg, 0) = 'NaN'::numeric then
    return jsonb_build_object('error', 'Shrink cannot be negative');
  end if;

  select id, sku_id, kg, location_id into v_batch from public.batches where id = p_batch_id for update;
  if not found then
    return jsonb_build_object('error', 'Batch not found');
  end if;
  select kind into v_loc_kind from public.locations where id = v_batch.location_id;
  if v_loc_kind in ('in_transit_inbound', 'in_transit_outbound') then
    return jsonb_build_object('error', 'This lot has not been received yet — confirm its arrival before grading');
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_n := v_n + 1;
    if not (v_line ? 'grade_id') or not (v_line ? 'kg') then
      return jsonb_build_object('error', format('Line %s is missing grade_id or kg', v_n));
    end if;
    if (v_line->>'kg')::numeric <= 0 or (v_line->>'kg')::numeric = 'NaN'::numeric then
      return jsonb_build_object('error', format('Line %s: kg must be a positive number', v_n));
    end if;
    select id, sku_id, active into v_grade from public.grades where id = (v_line->>'grade_id')::uuid;
    if not found or not v_grade.active then
      return jsonb_build_object('error', format('Line %s: grade not found or inactive', v_n));
    end if;
    if v_grade.sku_id is not null and v_grade.sku_id <> v_batch.sku_id then
      return jsonb_build_object('error', format('Line %s: that grade belongs to a different fish', v_n));
    end if;
    if v_grade.id = any (v_seen) then
      return jsonb_build_object('error', format('Line %s: each grade can appear only once', v_n));
    end if;
    v_seen := v_seen || v_grade.id;
    v_sum := v_sum + (v_line->>'kg')::numeric;
  end loop;

  v_gap := v_batch.kg - v_sum - coalesce(p_shrink_kg, 0);
  v_tol := public.get_setting_numeric('grading_tolerance_pct', 3) / 100.0 * v_batch.kg;
  if abs(v_gap) > v_tol then
    return jsonb_build_object(
      'error', format('Graded %s kg + shrink %s kg does not match the %s kg received (gap %s kg, allowed %s kg)',
                      v_sum, coalesce(p_shrink_kg, 0), v_batch.kg, round(v_gap, 3), round(v_tol, 3)),
      'received_kg', v_batch.kg, 'graded_kg', v_sum, 'shrink_kg', coalesce(p_shrink_kg, 0),
      'gap_kg', round(v_gap, 3), 'allowed_gap_kg', round(v_tol, 3));
  end if;

  select id into v_conf from public.receiving_confirmations
   where batch_id = p_batch_id order by confirmed_at desc limit 1;

  select id into v_prev from public.grading_runs where batch_id = p_batch_id and superseded_at is null;

  if v_prev is not null then
    -- stamp first, so the one-live-run unique index is free for the new row
    update public.grading_runs set superseded_at = now() where id = v_prev;
  end if;

  insert into public.grading_runs (id, batch_id, receiving_confirmation_id, sku_id, received_kg,
                                   shrink_kg, unreconciled_kg, note, graded_by)
  values (v_run_id, p_batch_id, v_conf, v_batch.sku_id, v_batch.kg,
          coalesce(p_shrink_kg, 0), round(v_gap, 3), p_note, v_user);

  if v_prev is not null then
    update public.grading_runs set superseded_by_run_id = v_run_id where id = v_prev;
  end if;

  insert into public.grading_lines (grading_run_id, grade_id, kg, photo_url)
  select v_run_id, (l->>'grade_id')::uuid, (l->>'kg')::numeric, nullif(l->>'photo_url', '')
    from jsonb_array_elements(p_lines) l;

  return jsonb_build_object(
    'grading_run_id', v_run_id,
    'received_kg', v_batch.kg,
    'graded_kg', v_sum,
    'shrink_kg', coalesce(p_shrink_kg, 0),
    'unreconciled_kg', round(v_gap, 3),
    'supersedes', v_prev
  );
end;
$$;
grant execute on function public.record_grading_run(uuid, jsonb, numeric, text) to authenticated;

-- Current grading per batch, with grade labels — what the Packing and Current Stock screens read.
create or replace view public.grading_current_v as
select r.batch_id, r.id as grading_run_id, r.received_kg, r.shrink_kg, r.unreconciled_kg,
       l.grade_id, g.code as grade_code, g.label as grade_label, g.sort_order, l.kg, l.photo_url,
       r.created_at as graded_at, r.graded_by
  from public.grading_runs r
  join public.grading_lines l on l.grading_run_id = r.id
  join public.grades g on g.id = l.grade_id
 where r.superseded_at is null
   and auth.uid() is not null;
-- (see 0038: default privileges would otherwise leave write grants on the view)
revoke all on public.grading_current_v from public, anon, authenticated;
grant select on public.grading_current_v to authenticated;
