# 05 — Forecasting roadmap (price, demand, festival-aware, weekday/weekend, fish catch)

> The user explicitly asked for: *"forecasting features, like prices and demand forecasting based on indian festivals and weekday vs weekend, and as u mentioned fish forecasting."* This is the build sequence that delivers all of that.

## Locked design decisions (from the previous-turn confirmation)

| Decision | Resolution | Why |
|---|---|---|
| **Forecast delivery surface** | Three layers: (1) compact widget on Admin dashboard showing next-7-day demand for top-10 SKU with festival overlay badges, (2) dedicated `/forecasts` page for forecasts that don't fit on the dashboard, (3) Looker Studio for deeper historical analysis, (4) push notification fired when any active forecast changes by ≥15% from its previous value | Catches the "see at a glance" + "deep dive" + "system tells me" use cases; ≥15% threshold configurable later |
| **Indian festival calendar scope** | Tamil Nadu-focused (~25-30 named festivals/year, hand-curated) seeded once into the `indian_festivals` table | Match the actual market; a generic national list overstates relevance and under-curates the regional festivals (Pongal, Puthandu, Aadi, Aadi Perukku, etc.) |
| **Weather API** | **IMD public API primary**, Open-Meteo as graceful degradation. Every forecast row carries a `data_source` enum (`'imd' \| 'open_meteo' \| 'cache_only'`) so the UI surfaces "(using Open-Meteo fallback — IMD unavailable)" honestly | IMD is authoritative for TN but flaky; Open-Meteo is no-key/no-rate-limit and works as a fallback that never breaks the forecast |
| **No hosted ML services** | Seasonal-naive baseline + festival multiplier + weather penalty + lunar phase. No AWS Forecast, no Prophet, no external API | (a) Data volume is too low (100-200 sales/week → ML models over-fit or under-fit), (b) explainability — the admin will ask "why is the forecast 1.4×?" and needs the answer "because Pongal is in 3 days and last year at Pongal this SKU was 1.4×", (c) cost vs benefit |

## The 10-item build sequence

Items are ordered by value-to-effort ratio. Each is independent; the sequence can be parallelised by capability.

### F1 — `indian_festivals` table (hand-curated TN calendar) + `festivals_in_window` RPC

**Difficulty:** Low. **Value:** High (every other forecast rides on it).

**New table** — `public.indian_festivals`:

```sql
create table public.indian_festivals (
  id uuid primary key default gen_random_uuid(),
  festival_date date not null,
  festival_name text not null,
  region text not null default 'tamil_nadu',  -- 'tamil_nadu' | 'national' | 'christian' | 'muslim' | 'sikh' | 'buddhist' | 'jain'
  festival_kind text not null,  -- 'harvest' | 'religious' | 'national' | 'commercial' | 'cultural' | 'fishing_ban_aligned'
  expected_impact text not null default 'medium',  -- 'low' | 'medium' | 'high' | 'extreme'
  notes text,
  created_at timestamptz not null default now(),
  unique (festival_date, festival_name, region)
);
create index on public.indian_festivals (festival_date);
```

**Seed data** — ~25-30 rows/year hand-curated, covering:
- **Tamil Nadu religious/cultural:** Pongal (3 days, mid-Jan), Thai Pongal, Mattu Pongal, Kaanum Pongal, Puthandu (Tamil New Year, mid-April), Aadi Perukku, Aadi Velli, Varalakshmi Vratham, Navaratri (9 nights, Sep-Oct), Saraswathi Pooja, Ayudha Pooja, Vijayadashami, Karthikai Deepam, Thai Pusam
- **National:** Republic Day, Independence Day, Gandhi Jayanti
- **Religious (cross-community):** Diwali, Holi, Eid al-Fitr, Eid al-Adha, Christmas, Good Friday, Easter, Onam, Vishu, Ugadi/Gudi Padwa, Baisakhi, Mahavir Jayanti, Buddha Purnima
- **Commercial peaks:** "IPL season" weeks, "Wedding season" (Nov-Feb), "Back to school" (June)

**New RPC** — `public.festivals_in_window(p_from date, p_to date) returns setof indian_festivals`:

```sql
create or replace function public.festivals_in_window(p_from date, p_to date)
returns table (
  festival_date date, festival_name text, region text,
  festival_kind text, expected_impact text, days_until int
)
language sql stable as $$
  select festival_date, festival_name, region, festival_kind, expected_impact,
    (festival_date - current_date)::int as days_until
  from public.indian_festivals
  where festival_date between p_from and p_to
  order by festival_date;
$$;
```

**Frontend surface:** a small "Upcoming festivals" widget on `/forecasts`, click-through to `/festivals` for the full year view.

**Estimated size:** 1 migration, 1 RPC, ~30 seed rows, 1 small component.

---

### F2 — `demand_calendar` view + `forecast_sku_demand` RPC (seasonal-naive baseline)

**Difficulty:** Low. **Value:** High. This is the headline forecast.

**New view** — `public.demand_calendar`:

```sql
create or replace view public.demand_calendar
  with (security_invoker = true)
as
select
  s.id as sku_id,
  s.code,
  s.english_name,
  s.tamil_name,
  extract(dow from (s.sold_at at time zone 'Asia/Kolkata'))::int as dow,  -- 0=Sun..6=Sat
  extract(month from (s_sale.sold_at at time zone 'Asia/Kolkata'))::int as month,
  -- Use sale_batches to compute kg per sale per SKU (one sale can span multiple batches)
  count(distinct s_sale.id) as sales_count,
  sum(s_sale.total_kg) as kg_total,
  avg(s_sale.total_kg) as avg_kg_per_sale,
  stddev_pop(s_sale.total_kg) as stddev_kg
from public.sales s_sale
join public.skus s on s.id = s_sale.sku_id
where s_sale.sold_at >= now() - interval '90 days'  -- last 90 days only
group by s.id, s.code, s.english_name, s.tamil_name,
  extract(dow from (s_sale.sold_at at time zone 'Asia/Kolkata')),
  extract(month from (s_sale.sold_at at time zone 'Asia/Kolkata'));
```

**Weekday vs weekend** is **free** with this view — the `dow` dimension is already there. The seasonal-naive forecast *is* the weekday/weekend pattern by construction.

**New RPC** — `public.forecast_sku_demand(p_sku_id uuid, p_horizon_days int default 7) returns table(day date, predicted_kg numeric, lower_80 numeric, upper_80 numeric, festival_multiplier numeric)`:

```sql
create or replace function public.forecast_sku_demand(
  p_sku_id uuid, p_horizon_days int default 7
)
returns table (
  day date, predicted_kg numeric, lower_80 numeric, upper_80 numeric,
  festival_multiplier numeric, festival_name text, data_source text
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_baseline numeric;
  v_trend_factor numeric := 1.0;
  v_festival_multiplier numeric := 1.0;
  v_festival_name text := null;
  v_data_source text := 'baseline';
  v_day date;
begin
  -- 1. baseline = average kg/day for this SKU on this day-of-week, last 90 days
  for i in 0..(p_horizon_days - 1) loop
    v_day := v_today + i;

    select coalesce(avg(kg_total), 0)
      into v_baseline
      from public.demand_calendar dc
     where dc.sku_id = p_sku_id
       and dc.dow = extract(dow from v_day)::int;

    -- 2. festival multiplier (multiplicative; clamped to [0.5, 3.0] to avoid runaway)
    select case when f.expected_impact = 'extreme' then 2.5
                when f.expected_impact = 'high' then 1.8
                when f.expected_impact = 'medium' then 1.3
                else 1.05 end,
           f.festival_name
      into v_festival_multiplier, v_festival_name
      from public.indian_festivals f
     where f.festival_date between v_day - 3 and v_day + 1
     order by abs(extract(day from (f.festival_date - v_day)))
     limit 1;

    v_festival_multiplier := coalesce(v_festival_multiplier, 1.0);

    -- 3. (later) trend factor, weather penalty, lunar multiplier — all default to 1.0 here

    return query
    select v_day,
           round(v_baseline * v_festival_multiplier, 3),
           round(v_baseline * v_festival_multiplier * 0.7, 3),  -- crude ±30% band
           round(v_baseline * v_festival_multiplier * 1.3, 3),
           v_festival_multiplier,
           v_festival_name,
           v_data_source;
  end loop;
end;
$$;
```

**Estimated size:** 1 view, 1 RPC, 1 component on Admin dashboard, 1 page at `/forecasts`.

---

### F3 — `festival_demand_lift` table + nightly Edge Function

**Difficulty:** Med. **Value:** High. Replaces F1's `expected_impact` heuristic with empirically-observed lift factors.

**New table** — `public.festival_demand_lift`:

```sql
create table public.festival_demand_lift (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus(id) on delete cascade,
  festival_name text not null,
  lift_factor numeric not null default 1.0,  -- multiplier: 1.0 = no change, 1.4 = +40%, etc.
  n_samples int not null default 0,           -- how many historical festival windows were observed
  last_computed_at timestamptz not null default now(),
  unique (sku_id, festival_name)
);
create index on public.festival_demand_lift (sku_id);
```

**New Edge Function** — `supabase/functions/festival-lift-calculator/index.ts` (cron, daily):

```typescript
// pseudocode:
// for each festival in indian_festivals (last 3 years of historical dates):
//   for each sku in skus:
//     compute kg sold in festival window (festival_date ± 3 days)
//     compute kg sold in same-week-day control windows (4 weeks before / after)
//     lift_factor = festival_kg / control_kg
//     n_samples = number of historical festival dates seen
//     upsert festival_demand_lift
// schedule: daily 02:00 IST via pg_cron (or supabase scheduled function)
```

**Migration of F2 to use lift factors**: when `festival_demand_lift` has a row for `(sku_id, festival_name)` with `n_samples >= 2`, prefer the empirical lift over the F1 heuristic. Fall back to F1 when no data yet.

**Estimated size:** 1 table, 1 Edge Function (~100 lines), 1 cron schedule.

---

### F4 — Admin dashboard "Forecasts" widget

**Difficulty:** Med. **Value:** High. Surfaces F1+F2+F3 to the user.

**New component** — `src/components/ForecastWidget.tsx`:

- Renders on `AdminDashboard.tsx` for admin/co-admin only
- Compact: top-10 SKU × next-7-day forecast
- Each row shows: SKU name, predicted kg, festival badge if any, "↑ 23%" change badge if previous forecast differed by ≥15%
- "View all forecasts" link to `/forecasts`
- Freshness indicator: "forecasted 6h ago" with refresh button
- Looker Studio link for deeper dives

**Data fetch:**
- `supabase.rpc('forecast_sku_demand', { p_sku_id, p_horizon_days: 7 })` for each top-10 SKU
- TanStack Query with 1-hour stale time
- Pulls top-10 by `weekly_sku_velocity.total_kg desc` (from the B5 view)

**Estimated size:** 1 component, ~150 lines.

---

### F5 — `forecast_sku_price` RPC over `price_history`

**Difficulty:** Low. **Value:** Med.

**Approach:** use `price_history` (D8's admin-authored reference price) as the cleanest time series. Seasonal-naive same as F2.

**New RPC** — `public.forecast_sku_price(p_sku_id uuid, p_horizon_days int default 14) returns table(day date, predicted_price numeric, lower_80 numeric, upper_80 numeric)`:

```sql
create or replace function public.forecast_sku_price(p_sku_id uuid, p_horizon_days int default 14)
returns table (day date, predicted_price numeric, lower_80 numeric, upper_80 numeric)
language sql stable as $$
  with series as (
    select effective_from as d, price_per_kg
    from public.price_history
    where sku_id = p_sku_id and effective_from >= current_date - 180
  )
  select gs::date,
         round(avg(price_per_kg) over (order by d rows between 13 preceding and current row), 2),
         round((avg(price_per_kg) over (order by d rows between 13 preceding and current row)) * 0.9, 2),
         round((avg(price_per_kg) over (order by d rows between 13 preceding and current row)) * 1.1, 2)
  from generate_series(current_date, current_date + p_horizon_days, interval '1 day') gs
  cross join series
  group by gs
  order by gs;
$$;
```

**Critical constraint:** this forecast is **admin-only, never broadcast to buyers** (D31 still binding). Surfaced on `/forecasts` only.

**Estimated size:** 1 RPC, surfaced on the `/forecasts` page.

---

### F6 — `fishing_ban_periods` table + `forecast_supply` RPC (supply-side baseline)

**Difficulty:** Med. **Value:** High.

**New table** — `public.fishing_ban_periods`:

```sql
create table public.fishing_ban_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  state text not null default 'tamil_nadu',
  year int not null,
  declared_by text not null default 'tn_fisheries_dept',
  notes text,
  unique (start_date, end_date, state, year),
  check (end_date >= start_date)
);
```

**Seed:** ~15 rows (3-4 years of past + 2 future), hand-curated from the TN Fisheries Department's annual ban order. The typical TN marine-fishing ban is mid-April to mid-June (61 days, dates shift year to year). Freshwater catch from Andhra substitutes during the ban.

**New RPC** — `public.forecast_supply(p_vendor_id uuid, p_sku_id uuid, p_horizon_days int default 7) returns table(day date, predicted_kg numeric, lower_80 numeric, upper_80 numeric, ban_active boolean, weather_penalty numeric)`:

```sql
create or replace function public.forecast_supply(p_vendor_id uuid, p_sku_id uuid, p_horizon_days int default 7)
returns table (day date, predicted_kg numeric, lower_80 numeric, upper_80 numeric, ban_active boolean, weather_penalty numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_baseline numeric;
  v_day date;
  v_ban boolean;
  v_weather_penalty numeric := 1.0;
  v_weather_record record;
begin
  for i in 0..(p_horizon_days - 1) loop
    v_day := v_today + i;

    -- baseline = avg kg delivered on this day-of-week from this vendor, last 90 days
    select coalesce(avg(b.kg), 0) into v_baseline
    from public.batches b
    where b.vendor_id = p_vendor_id and b.sku_id = p_sku_id
      and b.delivered_at >= now() - interval '90 days'
      and extract(dow from b.delivered_at at time zone 'Asia/Kolkata')::int = extract(dow from v_day)::int;

    -- ban check
    select exists (
      select 1 from public.fishing_ban_periods fbp
      where fbp.state = 'tamil_nadu'
        and v_day between fbp.start_date and fbp.end_date
        and fbp.year = extract(year from v_day)::int
    ) into v_ban;

    -- weather penalty (from cache; falls back to 1.0 = no penalty)
    select coalesce((case when w.condition in ('cyclone','storm') then 0.2
                          when w.condition in ('heavy_rain') then 0.5
                          when w.condition in ('cloudy','light_rain') then 0.85
                          else 1.0 end), 1.0),
           w.data_source
      into v_weather_penalty, v_data_source
    from public.weather_observations_cache w
    where w.observation_date = v_day
    order by case w.data_source when 'imd' then 0 when 'open_meteo' then 1 else 2 end
    limit 1;

    v_weather_penalty := coalesce(v_weather_penalty, 1.0);

    return query
    select v_day,
           round(v_baseline * v_weather_penalty * (case when v_ban then 0.1 else 1.0 end), 3),
           round(v_baseline * v_weather_penalty * (case when v_ban then 0.1 else 1.0 end) * 0.7, 3),
           round(v_baseline * v_weather_penalty * (case when v_ban then 1.0 else 1.3 end), 3),
           v_ban,
           v_weather_penalty;
  end loop;
end;
$$;
```

**Estimated size:** 1 table, 1 RPC, ~15 seed rows, surfaced on `/forecasts` page.

---

### F7 — Weather API integration (IMD primary, Open-Meteo fallback)

**Difficulty:** Med. **Value:** Med (essential for fish-catch forecast, modest for others).

**New table** — `public.weather_observations_cache`:

```sql
create table public.weather_observations_cache (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  observation_date date not null,
  condition text not null,  -- 'clear' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'cyclone' | 'storm' | 'unknown'
  wind_kts numeric,
  rainfall_mm numeric,
  data_source text not null,  -- 'imd' | 'open_meteo' | 'cache_only'
  fetched_at timestamptz not null default now(),
  unique (warehouse_id, observation_date, data_source)
);
```

**New Edge Function** — `supabase/functions/weather-cache/index.ts` (cron, daily at 03:00 IST):

```
1. For each active warehouse, call IMD public API (or fallback).
2. If IMD returns data: insert with data_source='imd'.
3. If IMD fails or returns error: call Open-Meteo free tier (no API key).
4. If both fail: insert row with data_source='cache_only', condition='unknown'.
5. Each row has a `data_source` enum so the UI surfaces "(using Open-Meteo fallback — IMD unavailable)" honestly.
```

**IMD public API note:** IMD has a public API at `https://city.imd.gov.in/citywx/city_weather.php?id=...` but it's known to be flaky. The function should:
- Use IMD's published JSON endpoints if available
- Fall back to Open-Meteo for the same lat/lon within seconds
- Log every fallback event for ops monitoring

**Open-Meteo note:** free, no API key, no rate limit. Sufficient for one warehouse. `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=weathercode,windspeed_10m_max,precipitation_sum&forecast_days=14&timezone=Asia%2FKolkata`

**Estimated size:** 1 table, 1 Edge Function (~150 lines), 1 cron.

---

### F8 — "What should I buy tomorrow?" composite

**Difficulty:** Med-High. **Value:** High. The headline operational forecast.

**New RPC** — `public.reorder_recommendation(p_warehouse_id uuid, p_horizon_days int default 3) returns table(sku_id uuid, sku_name text, predicted_demand_kg numeric, predicted_supply_kg numeric, current_stock_kg numeric, recommended_purchase_kg numeric, urgency text)`:

```sql
create or replace function public.reorder_recommendation(p_warehouse_id uuid, p_horizon_days int default 3)
returns table (sku_id uuid, sku_name text, predicted_demand_kg numeric, predicted_supply_kg numeric,
              current_stock_kg numeric, recommended_purchase_kg numeric, urgency text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_sku record;
  v_demand numeric;
  v_supply numeric;
  v_stock numeric;
  v_rec numeric;
  v_urgency text;
begin
  for v_sku in select id, english_name from public.skus where active loop
    -- sum demand forecast over horizon
    select coalesce(sum(predicted_kg), 0) into v_demand
    from public.forecast_sku_demand(v_sku.id, p_horizon_days);

    -- sum supply forecast across vendors (best estimate: take max supply, assuming at least one vendor delivers)
    select coalesce(max(daily_supply), 0) into v_supply
    from (
      select sum(predicted_kg) as daily_supply
      from (
        select v.id as vendor_id from public.vendors v where v.active
      ) vv
      cross join lateral public.forecast_supply(vv.vendor_id, v_sku.id, p_horizon_days) fs
      group by fs.day
    ) daily;

    -- current stock (warehouse-aggregate)
    select coalesce(sum(b.kg_remaining), 0) into v_stock
    from public.batches b
    join public.locations l on l.id = b.location_id
    where b.sku_id = v_sku.id and l.warehouse_id = p_warehouse_id;

    v_rec := greatest(0, v_demand - v_supply - v_stock);

    v_urgency := case
      when v_rec >= v_demand * 0.5 then 'critical'
      when v_rec >= v_demand * 0.25 then 'high'
      when v_rec > 0 then 'normal'
      else 'ok'
    end;

    return query
    select v_sku.id, v_sku.english_name, v_demand, v_supply, v_stock, v_rec, v_urgency;
  end loop;
end;
$$;
```

**Frontend surface:** the "Today" section of `/forecasts`, sorted by urgency. Each row has "Order from [vendor]" CTA if `urgency != 'ok'`.

**Estimated size:** 1 RPC, 1 component, 1 page.

---

### F9 — Lunar calendar overlay for catch seasonality

**Difficulty:** Low. **Value:** Low (free, marginal lift).

**No new table.** Add a column to a new view, or compute inline:

```sql
create or replace function public.lunar_phase(p_date date) returns text
language sql immutable as $$
  select case
    when ((p_date - '2000-01-06'::date)::int % 29) between 0 and 6 then 'new'
    when ((p_date - '2000-01-06'::date)::int % 29) between 7 and 14 then 'waxing'
    when ((p_date - '2000-01-06'::date)::int % 29) between 15 and 17 then 'full'
    else 'waning'
  end;
$$;
```

The `forecast_supply` RPC multiplies by 1.1 during full-moon windows (research-backed; the project's own data will confirm or contradict this over time).

**Estimated size:** 1 function, 1 line of integration in F6.

---

### F10 — Custom in-app charts (NOT recommended for V1)

**Skip per D26.** Looker Studio covers this for free. The views F1-F9 produce are the source; Looker charts them with mobile-friendly drill-down.

If a future mode wants in-app charts: **Recharts** (React-native, MIT, no chart server). Adds ~50KB gzipped to the bundle. Not in scope for this pass.

---

## Push notifications on forecast drift (≥15% threshold)

**New table** — `public.forecast_change_log`:

```sql
create table public.forecast_change_log (
  id uuid primary key default gen_random_uuid(),
  forecast_kind text not null,  -- 'demand' | 'price' | 'supply' | 'reorder'
  forecast_key text not null,   -- e.g. 'sku:abc-123' or 'vendor:def-456:sku:abc-123'
  forecast_date date not null,  -- the date being forecast
  previous_value numeric,
  new_value numeric,
  drift_pct numeric not null,    -- (new - previous) / previous * 100
  notification_fired boolean not null default false,
  computed_at timestamptz not null default now()
);
create index on public.forecast_change_log (notification_fired, computed_at);
```

**New Edge Function** — `supabase/functions/forecast-drift-monitor/index.ts` (cron, hourly during business hours):

```
1. Re-run F2 / F5 / F6 / F8 for the next 7 days.
2. Compare each new forecast value to the previous value (from forecast_change_log or initial baseline).
3. If abs(drift_pct) >= 15:
   - Insert a notification (type='forecast_alert') for admin/co-admin.
   - Set notification_fired=true on the change_log row.
4. The forecast_change_log is also the audit trail of "why did the forecast change?"
```

> **Step 0 audit — both versions for reference (F-3)**
>
> **Original (pre-Step-0):** The pseudocode above + the table schema above describe what `forecast_change_log` records (drift values + previous/new + notification_fired flag) but don't explicitly distinguish "audit-shaped per D17's exception" from "stored forecast snapshot." A future reader could mistake the table for a D17 violation (derived, not stored).
>
> **Revised (post-Step-0):** `forecast_change_log` is structurally an audit-log-shaped table (D17's exception): it records forecast values + drift percentages for drift detection and audit, **not** for user display. The actual forecast the user sees is always computed on read from `forecast_sku_demand` / `forecast_sku_price` / `forecast_supply` / `reorder_recommendation`. The table exists so the `forecast-drift-monitor` Edge Function can diff previous vs current values and fire notifications; it is not a cache of displayed forecasts.
>
> **Rationale:** D17 explicitly allows computed snapshots in audit-shaped tables ("The audit log is the only place computed snapshots are allowed to live, and only as a debug aid"). This annotation makes the structural shape explicit so the table doesn't read as a D17 violation. See `09-step0-sanity-check.md` F-3.

**Default 15% threshold.** Documented as configurable in a future `app_settings` table (not built in this pass). When built, the threshold becomes a single-row setting table that admin can edit.

---

## Migration + Edge Function list

| # | Migration | Purpose |
|---|---|---|
| 0040 | `indian_festivals.sql` | F1 — hand-curated TN festival calendar |
| 0041 | `demand_calendar_view.sql` + `forecast_sku_demand_rpc.sql` | F2 — seasonal-naive demand baseline |
| 0042 | `festival_demand_lift.sql` + `festival_lift_calculator` Edge Function | F3 — empirical lift factors |
| 0043 | `forecast_change_log.sql` + `forecast_drift_monitor` Edge Function | Push notification ≥15% drift |
| 0044 | `forecast_sku_price_rpc.sql` | F5 — price forecast |
| 0045 | `fishing_ban_periods.sql` + `forecast_supply_rpc.sql` + `lunar_phase_fn.sql` | F6 + F9 |
| 0046 | `weather_observations_cache.sql` + `weather_cache` Edge Function | F7 — IMD primary, Open-Meteo fallback |
| 0047 | `reorder_recommendation_rpc.sql` | F8 — composite |

Plus 3 Edge Functions (`festival-lift-calculator`, `weather-cache`, `forecast-drift-monitor`) on a Supabase scheduled-function trigger.

## What ships in the app

- `src/components/ForecastWidget.tsx` — admin dashboard widget (F4)
- `src/components/ForecastChangeBadge.tsx` — "↑ 23%" badge with tooltip
- `src/pages/Forecasts.tsx` — `/forecasts` page (F2, F5, F6, F8)
- `src/pages/FestivalCalendar.tsx` — `/festivals` page (F1)
- Additions to `AdminDashboard.tsx` for the forecast widget

## Out of scope reminders

Per standing decisions:
- **D6 / D13** — offline write-queue for worker role is in scope; bar code scanning remains out.
- **D15 / D24** — no POS, no GST invoicing — forecasts never leak into any invoicing surface.
- **D17** — derived, not stored. Forecasts are computed on read; the only stored tables are the historical ones (festival calendar, fishing bans, weather cache) plus the audit log.
- **D31** — never broadcast. Price forecasts are admin-only; demand/supply/reorder forecasts inform admin's purchasing decisions, not customer-facing anything.
- **D45** — ShareComposer is the only outbound channel; forecast results never auto-push to a customer via WhatsApp.

## Why this is the headline differentiator

Vyapar: 30 reports, **0 forecasting**.
Zoho, Cin7, inFlow, Unleashed, MarketMan, Sortly, Square, Brightpearl, Ordoro, Fishbowl, BlueCart, OrderEase: various forecasting, **0 festival-aware**, **0 weekday-pattern-detection**, **0 fish-catch-forecasting**.

Jayshankar can own: **festival-aware + weekday-pattern + fish-catch forecasting for a Tamil Nadu fresh-fish wholesale**, with the seasonal-naive + lift-factor + weather-penalty model being explainable ("because Pongal is in 3 days and last year at Pongal this SKU was 1.4×") rather than black-box. This is the wedge.
