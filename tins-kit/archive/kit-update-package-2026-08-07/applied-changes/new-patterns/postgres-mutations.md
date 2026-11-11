# `postgres-mutations` — kit pattern

> **The canonical recipe for a multi-table mutation that needs race-condition
> safety across the cascade.** Self-contained: a consumer can copy this
> pattern and follow the recipe without reading the rest of the kit.
>
> **Source:** Jayshankar decision 23 (`record_transfer_cascade`) +
> decision 19 (deferred race-condition protection, later partially resolved
> by this pattern). The transfer form was the first user action that
> touched 2 tables with different RLS policies on the same row; the
> cascade also needed atomicity across them.

---

## 0. Why this exists

The naive way to do a multi-table mutation is: the browser fetches rows,
mutates them in TS, then writes them back via `supabase.from('table').update(...)`.
This trips three non-obvious bugs:

| # | What you wrote | What goes wrong | Symptom |
|---|---|---|---|
| 1 | `supabase.from('batches').update({ kg_remaining: newKg })` from a worker | The RLS policy on `batches` is `select` for workers, no `update`. The query returns success (200) but writes nothing. The worker thinks they recorded a transfer; the audit log has no row. | "I recorded the transfer but the kg never changed." |
| 2 | Two simultaneous sale forms cascade over the same first batch | Both reads see `kg_remaining = 10`, both try to write 8, both succeed; `kg_remaining` ends at 2 instead of 0. Stock is wrong; downstream is unaware. | "Total stock is off by N kg." |
| 3 | Browser-side JS does 3 sequential UPDATEs (batch + movements + sales) | If step 2 fails, step 1 and step 3 are already committed. Half a sale is in the DB. The audit log has 2 rows that don't reconcile. | "I see one movement but no sale row." |

The pattern below ships all three fixes pre-applied. The worked example is
Jayshankar's `record_transfer_cascade`.

---

## 1. The 3 lessons, in detail

### Lesson 1 — Wrap the cascade in a Postgres function with `SECURITY DEFINER`

When a user action needs to touch 2+ tables atomically *and* the user role
doesn't have direct write rights on all of them, the answer is a Postgres
function. RLS is per-table, but a function runs under a single context:
`SECURITY DEFINER` means "run as the function owner (typically `postgres`),
who bypasses RLS for the function body." Then you `GRANT EXECUTE` to
`authenticated` so the signed-in browser can call the function via
`supabase.rpc('function_name', args)`.

```sql
create or replace function public.record_transfer_cascade(
  p_sku_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_kg numeric,
  p_notes text default null
)
returns void
language plpgsql
security definer  -- runs as the function owner; bypasses RLS
set search_path = public
as $$
begin
  -- 1. decrement the source batch (oldest first, FIFO)
  update batches
     set kg_remaining = kg_remaining - deducted_kg
   where id in (
     select id from batches
      where sku_id = p_sku_id
        and location_id = p_from_location_id
        and kg_remaining > 0
      order by delivered_at asc
      limit 1
   );

  -- 2. increment the destination batch (or insert if none)
  ...

  -- 3. record the movement (audit log gets a row via the existing trigger)
  insert into movements (kind, from_location_id, to_location_id, kg, sku_id, notes)
  values ('transfer', p_from_location_id, p_to_location_id, p_kg, p_sku_id, p_notes);
end;
$$;

grant execute on function public.record_transfer_cascade(uuid, uuid, uuid, numeric, text)
  to authenticated;
```

The audit-log trigger on `movements` fires inside the function and writes
the row as if the user had done the INSERT directly.

### Lesson 2 — Use `SELECT ... FOR UPDATE` for race-condition safety

Two concurrent calls to the same function can interleave their reads and
over-write each other's writes. The cheapest fix is `FOR UPDATE` on the
rows the function is about to modify: Postgres locks them until the
function commits.

```sql
-- inside the function, before the update
select id, kg_remaining into v_batch_id, v_current_kg
  from batches
 where sku_id = p_sku_id
   and location_id = p_from_location_id
   and kg_remaining >= p_kg
 order by delivered_at asc
   for update  -- <-- the lock; held until commit
 limit 1;
```

Cost: any other transaction trying to lock the same row waits. For a
low-write system (a fish wholesale is N writes/minute, not N writes/second)
this is invisible. For a high-write system, use `for update skip locked`
or `for update nowait` to make the contention explicit.

When you DON'T need this:
- The mutation is a single-row INSERT (no contention possible)
- The cascade is over rows nobody else is touching (rare)
- The cascade is `idempotent` (safe to re-run) — but then write idempotency
  keys, not locks

### Lesson 3 — `security definer` is necessary, not just `set role`

`SECURITY DEFINER` is the Postgres-standard way. Two common alternatives
that look similar but fail:

| Alternative | Why it fails |
|---|---|
| `set role authenticated;` at the top of the function | The function still runs as the caller; `set role` only affects role-based privileges, not RLS. RLS still denies. |
| Granting `update` on `batches` to the `worker` role directly | Works for THIS mutation but breaks the principle of least privilege. Now a worker can update any batch field (price, expiry) via a manual `supabase.from('batches').update(...)`. SECURITY DEFINER is a one-key unlock; the direct grant is a master key. |
| `insert into movements with (security definer)` trigger on `batches` | The trigger fires only on writes to `batches`. The worker still can't write to `batches` (RLS denies). You're back to square one. |

Use `SECURITY DEFINER` + `GRANT EXECUTE`. It's the smallest privilege escalation
that solves the problem.

---

## 2. The recipe

**Step 1: identify a mutation that touches 2+ tables or needs atomicity.**

Examples in Jayshankar:
- Transfer: touches `batches` (decrement source, increment destination)
  + `movements` (insert). Workers can write to `movements` but not
  `batches`.
- Sale: touches `batches` (cascade decrement) + `movements` (insert) +
  `sales` (insert). Workers can't do sales; this is vendor-rep only.
- Spoilage: touches `batches` (cascade decrement) + `movements` (insert).
  Workers can write spoilage.
- Delivery: touches `batches` (insert) + `movements` (insert). Vendor-rep
  only.

The first one that needs the function is the one where the user's role
can't write to ALL the affected tables. In Jayshankar that's **transfer**
(worker can write `movements` but not `batches`).

**Step 2: write the function.**

```sql
-- supabase/migrations/0005_record_transfer_cascade.sql
create or replace function public.record_transfer_cascade(
  p_sku_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_kg numeric,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_kg numeric;
  v_remaining numeric := p_kg;
  v_rec record;
begin
  -- Loop: drain the oldest batches first (FIFO cascade across multiple batches)
  for v_rec in
    select id, kg_remaining
      from batches
     where sku_id = p_sku_id
       and location_id = p_from_location_id
       and kg_remaining > 0
     order by delivered_at asc, id asc
       for update
  loop
    exit when v_remaining <= 0;
    if v_rec.kg_remaining <= v_remaining then
      update batches set kg_remaining = 0 where id = v_rec.id;
      v_remaining := v_remaining - v_rec.kg_remaining;
    else
      update batches set kg_remaining = v_rec.kg_remaining - v_remaining
        where id = v_rec.id;
      v_remaining := 0;
    end if;
  end loop;

  if v_remaining > 0 then
    raise exception 'Insufficient stock: short by % kg', v_remaining
      using errcode = 'P0001';
  end if;

  -- Increment destination (insert or update)
  insert into batches (sku_id, location_id, kg_remaining, price_per_kg_paid, vendor_id, delivered_at, active)
    select p_sku_id, p_to_location_id, p_kg, b.price_per_kg_paid, b.vendor_id, now(), true
      from batches b
     where b.sku_id = p_sku_id
       and b.location_id = p_from_location_id
     limit 1
  on conflict (sku_id, location_id) do update
    set kg_remaining = batches.kg_remaining + p_kg;

  -- Record the movement
  insert into movements (kind, from_location_id, to_location_id, kg, sku_id, notes)
  values ('transfer', p_from_location_id, p_to_location_id, p_kg, p_sku_id, p_notes);
end;
$$;

grant execute on function public.record_transfer_cascade(uuid, uuid, uuid, numeric, text)
  to authenticated;
```

**Step 3: call it from the browser.**

```ts
// src/lib/mutations.ts
import { supabase } from './supabase';

export async function recordTransfer(args: {
  skuId: string;
  fromLocationId: string;
  toLocationId: string;
  kg: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('record_transfer_cascade', {
    p_sku_id: args.skuId,
    p_from_location_id: args.fromLocationId,
    p_to_location_id: args.toLocationId,
    p_kg: args.kg,
    p_notes: args.notes ?? null,
  });
  if (error) throw error;
}
```

**Step 4: pin the design with a validator check.**

```js
// scripts/validate.mjs
const jsRecordTransferCascade = {
  name: 'js-record-transfer-cascade',
  check(content) {
    const sql = readFile('supabase/migrations/0005_record_transfer_cascade.sql');
    if (!/create or replace function public\.record_transfer_cascade/i.test(sql)) {
      return 'expected `create or replace function public.record_transfer_cascade` in 0005';
    }
    if (!/security definer/i.test(sql)) return 'expected `security definer` in the function';
    if (!/for update/i.test(sql)) return 'expected `for update` for race-condition safety';
    if (!/grant execute.*to authenticated/i.test(sql)) {
      return 'expected `grant execute ... to authenticated`';
    }
    return null;
  },
};
```

---

## 3. The validator checks (pin the design)

| Check | What it pins |
|---|---|
| `js-record-transfer-cascade` (or per-function) | The function exists, is `SECURITY DEFINER`, uses `FOR UPDATE`, and is `GRANT EXECUTE`d to `authenticated`. |
| `js-grant-authenticated` (already in `supabase-auth-trigger.md`) | The `authenticated` role has table-level GRANTs (the prerequisite for the function's `grant execute` to mean something). |
| `js-rls-enable` | All tables still have RLS. SECURITY DEFINER doesn't disable RLS for direct table access; it only bypasses it inside the function. |

The function's existence and signature are pinned by the check above. The
validator can also pin that the function body is the expected algorithm
(by string-matching the FIFO `for v_rec in ... loop` pattern, or by
parsing the SQL — out of scope for V1).

---

## 4. The end-to-end flow (what the user does)

1. **Plan:** identify the multi-table mutation. Draw the 2+ tables on a
   napkin. List the role that triggers it. List the columns read + written.
2. **Write the SQL function.** Idempotent (`create or replace`). Run the
   migration in the Supabase SQL editor. Confirm the function appears under
   `public.record_*_cascade`.
3. **Wire the browser call.** `supabase.rpc('record_X_cascade', {...})`.
   The args keys must match the `p_*` parameter names (the Supabase JS
   client strips the `p_` prefix automatically).
4. **Test the RLS path.** Sign in as the lowest-privilege role that needs
   to call it (worker in Jayshankar's case). Confirm the call succeeds
   and the audit log gets a row. If the call returns 0 rows / no error
   silently, you forgot `grant execute` — see the `supabase-auth-trigger`
   pattern's lesson 4.
5. **Test the race-condition path.** Open 2 browser tabs, both signed in
   as the same user, both submit the same transfer at the same time.
   Confirm: only one succeeds, the other gets a "short by N kg" error.
6. **Pin with the validator check.** Future contributors can't quietly
   remove `FOR UPDATE` or `SECURITY DEFINER` without failing the gate.

---

## 5. When NOT to use this pattern

- **Single-row INSERTs** — no cascade, no race. Use `supabase.from(...).insert(...)`.
- **Mutations that are inherently read-modify-write on one table** — use
  a single `update ... where id = ? and kg_remaining >= ?` statement. The
  WHERE clause is your lock; if the row changed between read and write,
  the UPDATE matches 0 rows and you report "stale data."
- **Mutations that don't need to bypass RLS** — if the user's role can
  write all the affected tables, just do the cascade in the browser. The
  function is overkill. (Jayshankar's spoilage form is an example: worker
  can write `movements` directly, and the `kg_remaining` decrement is done
  by an existing `apply_movement_to_batches` trigger. No function needed.)

---

## 6. Cross-references

- `supabase-auth-trigger.md` — Lesson 4 (GRANT to `authenticated`) is the
  prerequisite for `GRANT EXECUTE` to work in the browser.
- Jayshankar BUILDER-DECISIONS-REVIEW decision 23 — the original decision
  to move the transfer form to a SECURITY DEFINER function.
- Jayshankar BUILDER-DECISIONS-REVIEW decision 19 — the race-condition
  protection decision; this pattern is the resolution.
- Jayshankar `supabase/migrations/0005_record_transfer_cascade.sql` —
  the worked example. ~110 lines, fully self-contained.
- Jayshankar `src/lib/mutations.ts` — the browser-side call site.
