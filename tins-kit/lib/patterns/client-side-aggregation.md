# `client-side-aggregation` — kit pattern

> **A heuristic for "do this aggregation in JavaScript or in a Postgres
> view?" with a worked example.** Self-contained: a consumer can copy
> this pattern and follow the recipe without reading the rest of the kit.
>
> **Source:** Jayshankar decision 24. The admin dashboard's "stock by
> SKU" view was the first aggregation that *could* have been a view; we
> chose JS for V1 and explicitly deferred the view to Pilot.

---

## 0. Why this exists

The instinct for a senior engineer is "if I'm aggregating, do it in the
database — that's what the database is for." The instinct is right *eventually*,
but wrong for V1. The trade-off:

| Aspect | Client-side (JS) | Server-side (Postgres view) |
|---|---|---|
| Lines of code | ~30 (fetch + reduce) | ~50 (view + index + grant) |
| Time to ship | 30 min | 2 hours |
| Time at 100 rows | <1ms | <5ms |
| Time at 1,000 rows | <10ms | <20ms |
| Time at 10,000 rows | 50-100ms (UI starts to lag) | 30ms (still snappy) |
| Time at 100,000 rows | 500ms+ (UI blocks) | 80ms (still snappy) |
| Cost of a future switch | rewrite the component | delete the JS, query the view |
| Cost of a spec change | edit the component, re-deploy | new migration, re-deploy, re-test RLS |

For a V1 demo with <500 rows, the client-side path is unambiguously
cheaper. The pattern is: **default to JS, switch to a view when you have
evidence** (a slow DevTools Network panel or a user complaint).

---

## 1. The 3 lessons, in detail

### Lesson 1 — The "200ms in DevTools Network" threshold

The single most useful rule of thumb: if the raw query that feeds the
aggregation takes >200ms in the DevTools Network panel, move the
aggregation to a Postgres view. Below 200ms, the JS reduce is faster to
write, easier to change, and the user can't tell the difference.

Why 200ms? It's the human "still feels responsive" threshold for a
spinner-free query. 200ms is the React Query default `staleTime` too —
coincidence, but useful alignment.

### Lesson 2 — JS aggregation is easier to spec, view aggregation is
easier to enforce

A JS reducer is in the code, right next to the render. Changing the
sort order, adding a filter, splitting a row — all in one place. The
trade is the data must already be in the browser (you've fetched it).

A Postgres view is in a migration, runs on the server, and is shared
across every consumer (admin dashboard, future mobile app, future
analytics). The trade is you have to migrate to change it, and you have
to remember to add it to the RLS allow-list.

For V1, the only consumer is the one component. For Pilot, multiple
consumers start asking for the same data — that's when the view wins.

### Lesson 3 — Aggregate the raw rows; don't ask the server to aggregate
"to save bandwidth"

A common middle-ground anti-pattern: write a Postgres function
`get_stock_summary()` that returns a pre-aggregated JSON. This costs a
migration, a GRANT, an RLS test, and gains you a few KB of network. The
JS-side `reduce` does the same work in 0ms and the raw rows are useful
elsewhere (the audit log viewer, the Recent Activity feed, the FIFO
algorithm on the mutation forms).

The exception: if the raw rows are too large to fetch (e.g. the audit
log has 1M rows; you don't want to ship all 1M to the browser to show
the last 20). In that case, paginate server-side and let JS aggregate
the page. Don't pre-aggregate the whole table.

---

## 2. The recipe (Jayshankar's StockBySku)

**Step 1: fetch the raw rows.**

```ts
// src/components/StockBySku.tsx
const { data: batches } = useQuery({
  queryKey: ['stock-by-sku'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('batches')
      .select('id, sku_id, location_id, kg_remaining')
      .gt('kg_remaining', 0)        // active stock only
      .eq('active', true);
    if (error) throw error;
    return data;
  },
});

const { data: skus } = useQuery({
  queryKey: ['skus'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('skus')
      .select('id, english_name, code, low_stock_threshold_kg')
      .eq('active', true);
    if (error) throw error;
    return data;
  },
});
```

**Step 2: aggregate in JS with a `useMemo`.**

```ts
const aggregated = useMemo(() => {
  if (!batches || !skus) return [];

  const bySku = new Map<string, {
    skuId: string; name: string; code: string; threshold: number;
    totalKg: number; batches: { locationId: string; kg: number }[];
  }>();

  for (const s of skus) {
    bySku.set(s.id, {
      skuId: s.id, name: s.english_name, code: s.code,
      threshold: s.low_stock_threshold_kg, totalKg: 0, batches: [],
    });
  }

  for (const b of batches) {
    const row = bySku.get(b.sku_id);
    if (!row) continue;
    row.totalKg += b.kg_remaining;
    row.batches.push({ locationId: b.location_id, kg: b.kg_remaining });
  }

  // Sort: low-stock first, then by total kg asc
  return Array.from(bySku.values()).sort((a, b) => {
    const aLow = a.totalKg < a.threshold ? 0 : 1;
    const bLow = b.totalKg < b.threshold ? 0 : 1;
    if (aLow !== bLow) return aLow - bLow;
    return a.totalKg - b.totalKg;
  });
}, [batches, skus]);
```

**Step 3: render.**

```tsx
return (
  <table>
    {aggregated.map(row => (
      <tr key={row.skuId} className={row.totalKg < row.threshold ? 'bg-amber-50' : ''}>
        <td>{row.name} ({row.code})</td>
        <td>{row.totalKg.toFixed(2)} kg</td>
        <td>{row.threshold.toFixed(2)} kg</td>
        <td>{row.batches.length} batches</td>
      </tr>
    ))}
  </table>
);
```

**Step 4: when to switch to a view.**

If at any point the DevTools Network panel shows the raw query taking
>200ms, write a view:

```sql
create view public.stock_by_sku as
select
  s.id as sku_id, s.english_name, s.code, s.low_stock_threshold_kg,
  coalesce(sum(b.kg_remaining), 0) as total_kg,
  count(b.id) as batch_count
from public.skus s
left join public.batches b on b.sku_id = s.id and b.kg_remaining > 0
where s.active
group by s.id;

grant select on public.stock_by_sku to authenticated;
```

And replace the JS aggregation with `supabase.from('stock_by_sku').select('*')`.
The component signature stays the same; the data is just pre-aggregated.

---

## 3. The decision rubric (when to switch)

| Symptom | Action |
|---|---|
| Network <200ms for the raw query | Stay on JS |
| Network 200-500ms | Switch to a view — the threshold is approaching |
| Network >500ms | Switch to a view, add an index on the filter columns |
| User reports "the table is slow to load" | Switch to a view (the symptom is what matters, not the threshold) |
| Pilot/Production: 2+ consumers need the same data | Switch to a view — the duplication is the cost |
| The aggregation logic is *trivial* (e.g. count) | Stay on JS even at 500ms; the server round-trip isn't worth the migration |

For Jayshankar's V1, the raw query takes <50ms over 130 batches. JS wins.

---

## 4. What this pattern does NOT cover

- **Full-text search** — that's `tsvector` + GIN indexes, not aggregation.
- **Time-series rollups** (sums per day, per week) — those are materialised
  views or summary tables, not a single SELECT. Pilot work.
- **Aggregations that need JOINs across >3 tables** — the JS-side fan-out
  gets unwieldy. The view is the right answer from the start.
- **Aggregations over data the user can't read** — if the raw rows are
  RLS-filtered per user, the aggregate is too, and you can't do it
  server-side without a SECURITY DEFINER function. Add the function then
  consider the view.

---

## 5. Cross-references

- Jayshankar BUILDER-DECISIONS-REVIEW decision 24 — the original
  decision to keep StockBySku client-side for V1.
- Jayshankar `src/components/StockBySku.tsx` — the worked example.
- `postgres-mutations.md` — the SECURITY DEFINER pattern, for the
  aggregation-over-RLS case in §4.

---

*— End of `client-side-aggregation` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
