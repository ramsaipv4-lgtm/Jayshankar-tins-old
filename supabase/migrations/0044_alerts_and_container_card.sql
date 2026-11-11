-- 0044_alerts_and_container_card.sql — Phase B (BACKEND-REQUIREMENTS §2.6, §4)
--
-- 1. run_alert_sweeps()  the event SOURCES for the Alerts screen (chapters 11 and 32). The
--    notification mechanism already exists (notify_admins, notifications); what was missing is
--    something that notices: a container about to expire, stock below its threshold, a purchase
--    order past its expected date, a supplier whose quality-issue rate is over threshold.
--    No pg_cron dependency (the project has consistently held that off, D27 Track C): an admin can
--    run it from the app, and it is safe for any scheduler (Supabase cron, a Netlify function, a
--    GitHub action using the service key) to call it. It de-duplicates: the same condition does not
--    notify the admins again within 12 hours.
--
-- 2. container_card()    chapter 9, "scan a container -> actions". One call returns what is in the
--    container, when it must go, whether it is the next one to sell (oldest expiry first for that
--    fish), and the QR payload convention. Money-free, so any signed-in role may call it.
--
--    QR convention: encode the container's UUID, never its printed number, so a reprinted or
--    renumbered sticker cannot collide:  jsk://container/<uuid>
--
-- IDEMPOTENT. Run after 0043.

create or replace function public._notify_once(p_type text, p_key text, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.notifications n
     where n.type = p_type and n.payload ->> 'key' = p_key and n.created_at > now() - interval '12 hours'
  ) then
    return false;
  end if;
  perform public.notify_admins(p_type, p_payload || jsonb_build_object('key', p_key));
  return true;
end;
$$;
revoke all on function public._notify_once(text, text, jsonb) from public, anon, authenticated;

create or replace function public.run_alert_sweeps()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_hours numeric := public.get_setting_numeric('expiry_alert_hours', 6);
  v_q_pct numeric := public.get_setting_numeric('quality_rejection_alert_pct', 5);
  r record;
  n_exp int := 0; n_low int := 0; n_po int := 0; n_q int := 0;
begin
  -- an admin from the app, or a trusted scheduler holding the service key (no end-user session).
  -- `current_user` is the database role PostgREST switched to: 'anon' for a signed-out caller,
  -- 'authenticated' for a signed-in user, 'service_role' for the service key.
  if auth.uid() is not null then
    if v_role is null or v_role not in ('admin', 'co-admin') then
      raise exception 'run_alert_sweeps: not permitted' using errcode = '42501';
    end if;
  elsif current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'run_alert_sweeps: sign in as an admin, or use the service key' using errcode = '42501';
  end if;

  -- 1. containers about to expire
  for r in
    select f.id, c.container_number, f.expires_at, f.kg_remaining
      from public.container_fills f join public.containers c on c.id = f.container_id
     where f.kg_remaining > 0 and f.expires_at is not null
       and f.expires_at <= now() + (v_hours || ' hours')::interval
  loop
    if public._notify_once('container_expiring', r.id::text,
         jsonb_build_object('container_fill_id', r.id, 'container_number', r.container_number,
                            'expires_at', r.expires_at, 'kg_remaining', r.kg_remaining,
                            'already_expired', r.expires_at <= now())) then n_exp := n_exp + 1; end if;
  end loop;

  -- 2. low stock (real storage locations only, never in-transit)
  for r in
    select s.id, s.english_name, s.low_stock_threshold_kg, coalesce(sum(b.kg_remaining), 0) as on_hand
      from public.skus s
      left join public.batches b on b.sku_id = s.id
           and b.location_id not in (select id from public.locations where kind in ('in_transit_inbound', 'in_transit_outbound'))
     where s.active
     group by s.id
    having coalesce(sum(b.kg_remaining), 0) < s.low_stock_threshold_kg
       and exists (select 1 from public.batches x where x.sku_id = s.id)      -- only fish we have ever stocked
  loop
    if public._notify_once('low_stock', r.id::text,
         jsonb_build_object('sku_id', r.id, 'fish', r.english_name, 'kg_on_hand', r.on_hand,
                            'threshold_kg', r.low_stock_threshold_kg)) then n_low := n_low + 1; end if;
  end loop;

  -- 3. purchase orders past their expected date
  for r in
    select po.id, po.code, po.expected_arrival from public.purchase_orders po
     where po.status in ('sent', 'partially_received') and po.expected_arrival < current_date
  loop
    if public._notify_once('po_overdue', r.id::text,
         jsonb_build_object('po_id', r.id, 'code', r.code, 'expected_arrival', r.expected_arrival)) then n_po := n_po + 1; end if;
  end loop;

  -- 4. suppliers over the quality-issue threshold (last 30 days)
  for r in
    select * from public._vendor_quality_scorecard(current_date - 30, current_date) where issue_pct > v_q_pct
  loop
    if public._notify_once('quality_rejection_high', r.vendor_id::text || ':' || to_char(current_date, 'IYYY-IW'),
         jsonb_build_object('vendor_id', r.vendor_id, 'vendor_name', r.vendor_name, 'issue_pct', r.issue_pct,
                            'threshold_pct', v_q_pct)) then n_q := n_q + 1; end if;
  end loop;

  return jsonb_build_object('expiring', n_exp, 'low_stock', n_low, 'po_overdue', n_po, 'quality', n_q);
end;
$$;
grant execute on function public.run_alert_sweeps() to authenticated;

-- ================================================================================================
-- container_card
-- ================================================================================================
create or replace function public.container_card(p_container_id uuid default null, p_container_number text default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c record;
  f record;
  v_items jsonb;
  v_next boolean;
begin
  if public.current_user_role() is null then
    raise exception 'container_card: not signed in' using errcode = '42501';
  end if;
  select * into c from public.containers
   where (p_container_id is not null and id = p_container_id)
      or (p_container_id is null and p_container_number is not null and container_number = p_container_number)
   limit 1;
  if not found then return jsonb_build_object('error', 'Container not found'); end if;

  select * into f from public.container_fills
   where container_id = c.id and kg_remaining > 0 order by filled_at desc limit 1;

  if f.id is null then
    return jsonb_build_object('container_id', c.id, 'container_number', c.container_number,
      'capacity_kg', c.capacity_kg, 'ownership', c.ownership, 'active', c.active, 'empty', true, 'is_mixed_supplier', false,
      'qr_payload', 'jsk://container/' || c.id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'fish', s.english_name, 'tamil_name', s.tamil_name, 'kg', i.kg,
           'batch_code', 'RCV-' || upper(substr(replace(b.id::text, '-', ''), 1, 6))) order by s.english_name), '[]'::jsonb)
    into v_items
    from public.container_fill_items i
    join public.batches b on b.id = i.batch_id
    join public.skus s on s.id = b.sku_id
   where i.container_fill_id = f.id;

  -- next to sell = earliest expiry among live fills that share a fish with this one
  select not exists (
    select 1 from public.container_fills f2
     where f2.id <> f.id and f2.kg_remaining > 0 and f2.expires_at is not null
       and f2.expires_at < f.expires_at
       and exists (select 1 from public.container_fill_items i2 join public.batches b2 on b2.id = i2.batch_id
                    join public.container_fill_items i1 on i1.container_fill_id = f.id
                    join public.batches b1 on b1.id = i1.batch_id
                   where i2.container_fill_id = f2.id and b2.sku_id = b1.sku_id)
  ) into v_next;

  return jsonb_build_object(
    'container_id', c.id, 'container_number', c.container_number, 'capacity_kg', c.capacity_kg,
    'ownership', c.ownership, 'active', c.active, 'empty', false,
    'is_mixed_supplier', public.container_fill_is_mixed(f.id),
    'fill_id', f.id, 'packed_at', f.filled_at, 'expires_at', f.expires_at, 'kg_remaining', f.kg_remaining,
    'hours_left', round(extract(epoch from (f.expires_at - now())) / 3600, 1),
    'is_expired', f.expires_at is not null and f.expires_at <= now(),
    'sell_this_next', v_next,
    'contents', v_items,
    'qr_payload', 'jsk://container/' || c.id);
end;
$$;
grant execute on function public.container_card(uuid, text) to authenticated;
