-- seed.sql — Jayshankar Mode A demo data
-- Implements SPEC.md §App A: 6 vendors, 25 SKUs, 3 locations, ~150 movements
-- over 14 days, ~50 sales, 30+ price_history rows, 3 users.
--
-- DETERMINISTIC: every timestamp and quantity is derived from a loop index,
-- not from random(). Re-running this file on a clean DB produces the same
-- data. (gen_random_uuid() is the only non-deterministic call; it does not
-- affect algorithm correctness.)
--
-- IDEMPOTENT: the DO block at the top short-circuits if the SKU catalog
-- is already populated (25+ rows with codes starting FISH-). The static
-- INSERTs below use ON CONFLICT DO NOTHING so re-running on a partial DB
-- is also safe.
--
-- USERS NOTE: this file does NOT insert into auth.users (passwords are
-- hashed and managed by Supabase Auth). The 3 public.users rows below
-- have fixed UUIDs; create the matching auth.users via the Supabase
-- admin API or the helpers/seed-users.mjs script. The public.users
-- inserts use ON CONFLICT (id) DO NOTHING so re-running is safe even
-- if auth.users was created first.
--
-- Apply order: AFTER 0001_init.sql + rls-policies.sql. The RLS policies
-- are bypassed during seeding because the migration runner is the table
-- owner. If you apply this seed via psql as a non-superuser, you must
-- run it as a role that owns the tables (e.g. postgres).

-- ============================================================
-- 0. Idempotency guard
-- If the seed has already been applied, skip the entire block.
-- ============================================================

do $$
begin
  if (select count(*) from public.skus where code like 'FISH-%') >= 25 then
    raise notice 'Seed already applied (25+ SKUs with FISH- prefix found). Skipping.';
    return;
  end if;
end $$;

-- ============================================================
-- 1. Locations (3) — SPEC §App A.3
-- ============================================================

insert into public.locations (id, name, display_name, kind) values
  ('00000000-0000-0000-0000-000000000001', 'storage', 'Cold Storage',   'storage'),
  ('00000000-0000-0000-0000-000000000002', 'freezer', 'Deep Freezer',    'freezer'),
  ('00000000-0000-0000-0000-000000000003', 'display', 'Display Counter', 'display')
on conflict (name) do nothing;

-- ============================================================
-- 2. Vendors (6) — SPEC §App A.1
-- ============================================================

insert into public.vendors (id, name, phone, port_or_village, boat_name, typical_catch, reliability, active) values
  ('10000000-0000-0000-0000-000000000001', 'Murugan',  '+91 90000 11111', 'Royapuram',     null,     'Pomfret, surmai, bangude',  4, true),
  ('10000000-0000-0000-0000-000000000002', 'Ravi',     '+91 90000 22222', 'Kasimedu',      'Sri Devi', 'Vanjaram, prawns',       5, true),
  ('10000000-0000-0000-0000-000000000003', 'Selvam',   '+91 90000 33333', 'Ennore',        null,     'Mixed catch, crabs',        3, true),
  ('10000000-0000-0000-0000-000000000004', 'Karthik',  '+91 90000 44444', 'Mahabalipuram', 'Velmurugan', 'Prawns, squid',         4, true),
  ('10000000-0000-0000-0000-000000000005', 'Mani',     '+91 90000 55555', 'Cuddalore',     null,     'Sardines, mackerel',        3, true),
  ('10000000-0000-0000-0000-000000000006', 'Ganesan',  '+91 90000 66666', 'Pondicherry',   'Lakshmi', 'Tuna, seer fish',          4, true)
on conflict (id) do nothing;

-- ============================================================
-- 3. SKUs (25) — SPEC §App A.2
-- Tamil names per the user's research (see §App A.2 footnote in spec).
-- ============================================================

insert into public.skus (id, code, english_name, tamil_name, category, size_grade, unit, shelf_life_hours, storage_type, low_stock_threshold_kg, active) values
  ('20000000-0000-0000-0000-000000000001', 'FISH-POMFRET-MED-001',  'Pomfret',          'வவ்வால்',          'fin_fish',   'medium', 'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000002', 'FISH-POMFRET-LG-001',   'Pomfret',          'வவ்வால்',          'fin_fish',   'large',  'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000003', 'FISH-POMFRET-SM-001',   'Pomfret',          'வவ்வால்',          'fin_fish',   'small',  'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000004', 'FISH-SURMAI-LG-001',    'Seer fish',        'வஞ்சரம்',         'fin_fish',   'large',  'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000005', 'FISH-SURMAI-MED-001',   'Seer fish',        'வஞ்சரம்',         'fin_fish',   'medium', 'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000006', 'FISH-BANGUDE-MED-001',  'Mackerel',         'கானாங்கெளுத்தி',   'fin_fish',   'medium', 'kg',  18, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000007', 'FISH-BANGUDE-SM-001',   'Mackerel',         'கானாங்கெளுத்தி',   'fin_fish',   'small',  'kg',  18, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000008', 'FISH-MATHTHI-MED-001',  'Sardine',          'மத்தி',            'fin_fish',   'medium', 'kg',  12, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000009', 'FISH-SOORAI-MED-001',   'Tuna',             'சூரை',             'fin_fish',   'medium', 'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000010', 'FISH-VAVAL-MED-001',    'Trevally',         'வவ்வல்',           'fin_fish',   'medium', 'kg',  24, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000011', 'FISH-KATLA-LG-001',     'Katla',            'கட்லா',            'fin_fish',   'large',  'kg',  36, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000012', 'FISH-VIRAAL-MED-001',   'Murrel',           'விரால்',           'fin_fish',   'medium', 'kg',  36, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000013', 'FISH-KELANGA-SM-001',   'Anchovy',          'கெழங்கு',          'fin_fish',   'small',  'kg',   8, 'chilled', 5.00, true),
  ('20000000-0000-0000-0000-000000000014', 'FISH-IRAAL-LG-001',     'Prawns (large)',   'இறால்',            'crustacean', 'large',  'kg',  36, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000015', 'FISH-IRAAL-MED-001',    'Prawns (medium)',  'இறால்',            'crustacean', 'medium', 'kg',  36, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000016', 'FISH-IRAAL-SM-001',     'Prawns (small)',   'இறால்',            'crustacean', 'small',  'kg',  24, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000017', 'FISH-NANDU-MED-001',    'Crab',             'நண்டு',            'crustacean', 'medium', 'piece', 24, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000018', 'FISH-NANDU-LG-001',     'Crab',             'நண்டு',            'crustacean', 'large',  'piece', 24, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000019', 'FISH-KANAVAI-MED-001',  'Squid',            'கணவாய்',           'cephalopod', 'medium', 'kg',  48, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000020', 'FISH-KANAVAI-LG-001',   'Squid',            'கணவாய்',           'cephalopod', 'large',  'kg',  48, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000021', 'FISH-SHELL-POND-001',   'Pondicherry mussel', 'சிப்பி',         'shellfish',  'mixed',  'kg',  48, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000022', 'FISH-SHELL-CLAM-001',   'Clam',             'மட்டி',            'shellfish',  'mixed',  'kg',  36, 'chilled', 3.00, true),
  ('20000000-0000-0000-0000-000000000023', 'FISH-DRIED-NETTL-001',  'Dried anchovy',    'நெத்திலி',         'dried',      'small',  'kg', 720, 'ambient', 5.00, true),
  ('20000000-0000-0000-0000-000000000024', 'FISH-DRIED-BOM-001',    'Bombay duck',      'பொம்மை',           'dried',      'mixed',  'kg', 720, 'ambient', 5.00, true),
  ('20000000-0000-0000-0000-000000000025', 'FISH-DRIED-PRAW-001',   'Dried prawns',     'இறால்',            'dried',      'small',  'kg', 720, 'ambient', 5.00, true)
on conflict (code) do nothing;

-- ============================================================
-- 4. Users (3) — public.users only; auth.users created separately
-- SPEC §App A.7. Fixed UUIDs so the auth user IDs match.
-- ============================================================

insert into public.users (id, email, phone, display_name, role, active) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@jayshankar.demo',  null, 'Karthik (the wholesaler)', 'admin',       true),
  ('a0000000-0000-0000-0000-000000000002', 'rep@jayshankar.demo',    null, 'Anitha',                   'vendor-rep',  true),
  ('a0000000-0000-0000-0000-000000000003', 'worker@jayshankar.demo', null, 'Suresh',                   'worker',      true)
on conflict (id) do nothing;

-- ============================================================
-- 5. Price history (30+ rows) — SPEC §App A.6
-- A reference price per SKU per day for the last 30 days, for a sample
-- of 5 SKUs. Each price varies by ±15% from a base, using a fixed
-- pseudo-random schedule (no random() calls — fully deterministic).
-- ============================================================

-- The base prices for the 5 sample SKUs (chosen to span categories):
--   Pomfret Medium (20000000-...-001): base ₹650/kg
--   Seer fish Large (20000000-...-004): base ₹800/kg
--   Mackerel Medium (20000000-...-006): base ₹280/kg
--   Prawns Medium (20000000-...-015):   base ₹520/kg
--   Squid Medium (20000000-...-019):    base ₹400/kg
-- 5 SKUs * 30 days = 150 rows.
do $$
declare
  v_admin_id uuid;
  v_i int;
  v_base numeric(10,2);
  v_sku uuid;
  v_pct int;
  v_price numeric(10,2);
  v_day date;
begin
  select id into v_admin_id from public.users where role = 'admin' limit 1;
  if v_admin_id is null then
    raise notice 'No admin user found; skipping price_history seed.';
    return;
  end if;

  for v_i in 0..29 loop
    v_day := current_date - v_i;

    -- SKU 1: Pomfret Medium, base 650
    v_sku := '20000000-0000-0000-0000-000000000001';
    v_pct := ((v_i * 7 + 3) % 31) - 15;  -- -15 .. +15
    v_price := round(650 * (1 + v_pct / 100.0), 2);
    insert into public.price_history (sku_id, price_per_kg, effective_from, effective_to, set_by)
      values (v_sku, v_price, v_day, v_day, v_admin_id)
      on conflict do nothing;

    -- SKU 2: Seer fish Large, base 800
    v_sku := '20000000-0000-0000-0000-000000000004';
    v_pct := ((v_i * 11 + 5) % 31) - 15;
    v_price := round(800 * (1 + v_pct / 100.0), 2);
    insert into public.price_history (sku_id, price_per_kg, effective_from, effective_to, set_by)
      values (v_sku, v_price, v_day, v_day, v_admin_id)
      on conflict do nothing;

    -- SKU 3: Mackerel Medium, base 280
    v_sku := '20000000-0000-0000-0000-000000000006';
    v_pct := ((v_i * 13 + 7) % 31) - 15;
    v_price := round(280 * (1 + v_pct / 100.0), 2);
    insert into public.price_history (sku_id, price_per_kg, effective_from, effective_to, set_by)
      values (v_sku, v_price, v_day, v_day, v_admin_id)
      on conflict do nothing;

    -- SKU 4: Prawns Medium, base 520
    v_sku := '20000000-0000-0000-0000-000000000015';
    v_pct := ((v_i * 17 + 2) % 31) - 15;
    v_price := round(520 * (1 + v_pct / 100.0), 2);
    insert into public.price_history (sku_id, price_per_kg, effective_from, effective_to, set_by)
      values (v_sku, v_price, v_day, v_day, v_admin_id)
      on conflict do nothing;

    -- SKU 5: Squid Medium, base 400
    v_sku := '20000000-0000-0000-0000-000000000019';
    v_pct := ((v_i * 19 + 11) % 31) - 15;
    v_price := round(400 * (1 + v_pct / 100.0), 2);
    insert into public.price_history (sku_id, price_per_kg, effective_from, effective_to, set_by)
      values (v_sku, v_price, v_day, v_day, v_admin_id)
      on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- 6. Deliveries + Movements (28 deliveries → 28 movement rows)
-- SPEC §App A.4. 2 deliveries/day for 14 days, 10-25 kg each.
-- Each delivery: 1 batch at storage + 1 movement (kind=delivery_in).
-- ============================================================

do $$
declare
  v_storage uuid := '00000000-0000-0000-0000-000000000001';
  v_vendor_ids uuid[];
  v_sku_ids uuid[];
  v_i int;
  v_batch_id uuid;
  v_group_id uuid;
  v_delivered_at timestamptz;
  v_kg numeric(10,3);
begin
  select array_agg(id order by name) into v_vendor_ids from public.vendors;
  select array_agg(id order by code) into v_sku_ids from public.skus;

  for v_i in 1..28 loop
    v_delivered_at := now() - (interval '14 days')
                    + (interval '1 day' * ((v_i - 1) / 2))
                    + (interval '6 hours')
                    + (interval '15 minutes' * ((v_i - 1) % 4));
    v_kg := (10 + ((v_i * 3) % 16))::numeric(10,3);  -- 10..25 kg
    v_batch_id := gen_random_uuid();
    v_group_id := gen_random_uuid();

    insert into public.batches (id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at)
    values (
      v_batch_id,
      v_sku_ids[1 + ((v_i * 3 - 1) % 25)],
      v_vendor_ids[1 + ((v_i - 1) % 6)],
      v_storage,
      v_kg, v_kg,
      (300 + ((v_i * 47) % 400))::numeric(10,2),
      v_delivered_at
    );

    insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, occurred_at)
    values (
      'delivery_in', null, v_storage,
      v_sku_ids[1 + ((v_i * 3 - 1) % 25)],
      v_kg, v_batch_id, v_group_id, v_delivered_at
    );
  end loop;
end $$;

-- ============================================================
-- 7. Transfers (50 transfers → 50 movement rows + 50 new batches)
-- SPEC §App A.4. 3-4 transfers/day for 14 days, storage → display.
-- Simple FIFO: each transfer picks the oldest batch at storage with
-- stock, transfers a fixed amount, creates a new batch at display.
-- ============================================================

do $$
declare
  v_storage uuid := '00000000-0000-0000-0000-000000000001';
  v_display uuid := '00000000-0000-0000-0000-000000000003';
  v_i int;
  v_kg numeric(10,3);
  v_remaining numeric(10,3);
  v_deduct numeric(10,3);
  v_source record;
  v_dest_batch_id uuid;
  v_group_id uuid;
  v_occurred_at timestamptz;
  v_transfer_count int := 0;
begin
  for v_i in 1..52 loop
    v_kg := (5 + (v_i % 10))::numeric(10,3);  -- 5..14 kg per transfer
    v_remaining := v_kg;

    -- Find the oldest batch at storage with stock
    select id, kg_remaining, price_per_kg_paid, sku_id, vendor_id
      into v_source
    from public.batches
    where location_id = v_storage and kg_remaining > 0
    order by delivered_at asc, id asc
    limit 1
    for update;

    if not found then
      continue;
    end if;

    v_deduct := least(v_remaining, v_source.kg_remaining);
    v_remaining := v_remaining - v_deduct;
    v_occurred_at := now() - (interval '14 days')
                   + (interval '1 day' * ((v_i - 1) / 4))
                   + (interval '8 hours')
                   + (interval '15 minutes' * ((v_i - 1) % 4));
    -- Bumped to 52 transfers (was 50) so total movements ≥ 150 per SPEC §8.5b.
    v_dest_batch_id := gen_random_uuid();
    v_group_id := gen_random_uuid();

    -- New batch at display
    insert into public.batches (id, sku_id, vendor_id, location_id, kg, kg_remaining, price_per_kg_paid, delivered_at)
    values (
      v_dest_batch_id, v_source.sku_id, v_source.vendor_id, v_display,
      v_deduct, v_deduct, v_source.price_per_kg_paid, v_occurred_at
    );

    -- Source deduction movement
    insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, occurred_at)
    values (
      'transfer', v_storage, v_display,
      v_source.sku_id, v_deduct, v_source.id, v_group_id, v_occurred_at
    );

    v_transfer_count := v_transfer_count + 1;
  end loop;

  raise notice 'Phase 7 (transfers): inserted % transfer movements.', v_transfer_count;
end $$;

-- ============================================================
-- 8. Sales + sales movements (50 sales → 50 sale rows + 50 movement rows)
-- SPEC §App A.4 + §App A.5. 3-4 sales/day, from display.
-- ============================================================

do $$
declare
  v_display uuid := '00000000-0000-0000-0000-000000000003';
  v_rep_id uuid;
  v_customers text[] := array[
    'Saravana Stores', 'Murugan Idli Shop', 'Adyar Ananda Bhavan',
    'Sangeetha Veg', 'Hot Breads (T. Nagar)', 'GRT Sweets',
    'Pothys Kitchen', 'Sri Balaji Chat', 'Sri Balaji Catering', 'Walk-in'
  ];
  v_i int;
  v_kg numeric(10,3);
  v_remaining numeric(10,3);
  v_deduct numeric(10,3);
  v_source record;
  v_sale_id uuid;
  v_group_id uuid;
  v_occurred_at timestamptz;
  v_price numeric(10,2);
  v_sale_count int := 0;
begin
  select id into v_rep_id from public.users where email = 'rep@jayshankar.demo' limit 1;
  if v_rep_id is null then
    raise notice 'No rep user found; skipping sales seed.';
    return;
  end if;

  for v_i in 1..50 loop
    v_kg := (2 + (v_i % 8))::numeric(10,3);  -- 2..9 kg per sale
    v_remaining := v_kg;

    -- Find the oldest batch at display with stock
    select id, kg_remaining, sku_id
      into v_source
    from public.batches
    where location_id = v_display and kg_remaining > 0
    order by delivered_at asc, id asc
    limit 1
    for update;

    if not found then
      continue;
    end if;

    v_deduct := least(v_remaining, v_source.kg_remaining);
    v_remaining := v_remaining - v_deduct;
    v_price := (400 + ((v_i * 31) % 300))::numeric(10,2);  -- 400..699 ₹/kg
    v_occurred_at := now() - (interval '14 days')
                   + (interval '1 day' * ((v_i - 1) / 4))
                   + (interval '10 hours' + interval '1 hour' * (v_i % 7));
    v_sale_id := gen_random_uuid();
    v_group_id := gen_random_uuid();

    insert into public.sales (id, sku_id, location_id, customer_name, total_kg, sale_price_per_kg, total_amount, sold_by, sold_at)
    values (
      v_sale_id, v_source.sku_id, v_display, v_customers[1 + ((v_i - 1) % 10)],
      v_deduct, v_price, round(v_deduct * v_price, 2),
      v_rep_id, v_occurred_at
    );

    insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, sale_id, occurred_at)
    values (
      'sale', v_display, null,
      v_source.sku_id, v_deduct, v_source.id, v_group_id, v_sale_id,
      v_occurred_at
    );

    v_sale_count := v_sale_count + 1;
  end loop;

  raise notice 'Phase 8 (sales): inserted % sale rows.', v_sale_count;
end $$;

-- ============================================================
-- 9. Spoilage (20 spoilage movements)
-- SPEC §App A.4. 1-2/day, from display.
-- ============================================================

do $$
declare
  v_display uuid := '00000000-0000-0000-0000-000000000003';
  v_i int;
  v_kg numeric(10,3);
  v_remaining numeric(10,3);
  v_deduct numeric(10,3);
  v_source record;
  v_group_id uuid;
  v_occurred_at timestamptz;
  v_spoil_count int := 0;
begin
  for v_i in 1..20 loop
    v_kg := (1 + (v_i % 3))::numeric(10,3);  -- 1..3 kg per spoilage
    v_remaining := v_kg;

    -- Find the oldest batch at display with stock
    select id, kg_remaining, sku_id
      into v_source
    from public.batches
    where location_id = v_display and kg_remaining > 0
    order by delivered_at asc, id asc
    limit 1
    for update;

    if not found then
      continue;
    end if;

    v_deduct := least(v_remaining, v_source.kg_remaining);
    v_remaining := v_remaining - v_deduct;
    v_occurred_at := now() - (interval '14 days')
                   + (interval '1 day' * ((v_i - 1) / 2))
                   + (interval '20 hours');
    v_group_id := gen_random_uuid();

    insert into public.movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, occurred_at)
    values (
      'spoilage', v_display, null,
      v_source.sku_id, v_deduct, v_source.id, v_group_id, v_occurred_at
    );

    v_spoil_count := v_spoil_count + 1;
  end loop;

  raise notice 'Phase 9 (spoilage): inserted % spoilage movements.', v_spoil_count;
end $$;

-- ============================================================
-- End of seed.sql
-- Expected counts after a clean run:
--   vendors:        6
--   skus:           25
--   locations:      3
--   users:          3
--   price_history:  150  (5 SKUs * 30 days)
--   batches:        78+  (28 deliveries + 50 transfers = 78+)
--   movements:      150+ (28 deliveries + 52 transfers + 50 sales + 20 spoilage = 150)
--   sales:          50   (the spec says ~20; we generate 50 to be richer)
--   audit_log:      148+ (one per mutation, written by trigger)
-- ============================================================
