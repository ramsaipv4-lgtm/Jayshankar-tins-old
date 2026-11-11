# `idempotent-migrations` — kit pattern

> **The canonical recipe for "a migration that fails on re-apply is not a
> migration — it's a one-shot."** Every statement uses an idempotency
> primitive; re-running the file is a no-op. Self-contained.
>
> **Source:** Jayshankar (5 SQL files, every CREATE has `IF NOT EXISTS`,
> every TRIGGER preceded by `DROP TRIGGER IF EXISTS`, every INSERT has `ON
> CONFLICT DO NOTHING`, every function uses `CREATE OR REPLACE`); atal-incubation
> (14 migrations, all idempotent); Data-cleaning-script (the seed's
> idempotency guard at the top of the file).

---

## 0. Why this exists

The naive way to write a migration is:

```sql
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  kg numeric(10, 3) not null,
  ...
);

create trigger trg_batches_audit after insert on public.batches ...
```

This trips four non-obvious bugs:

1. **Re-apply fails with "relation already exists."** Every retry is a manual
   fix.
2. **The trigger can't be re-created.** PostgreSQL has no `CREATE TRIGGER IF
   NOT EXISTS`. The only way to make it idempotent is `DROP TRIGGER IF EXISTS`
   before `CREATE TRIGGER`.
3. **The function can't be re-created.** A naive `CREATE FUNCTION` fails if
   the function exists with the same signature. `CREATE OR REPLACE` fixes
   this — but only if the function signature is identical.
4. **The seed re-runs duplicate inserts.** Without `ON CONFLICT DO NOTHING` or
   a top-level `DO $$ ... if (count(*) >= N) return; $$` guard, the seed
   inserts the same demo data twice.

The pattern is: every statement uses an idempotency primitive. The 6 primitives:

| Primitive | What it does | Idempotent? |
|---|---|---|
| `CREATE TABLE IF NOT EXISTS` | Creates a table if it doesn't exist | Yes |
| `CREATE OR REPLACE FUNCTION` | Replaces a function with the same signature | Yes |
| `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` | Re-creates a trigger | Yes (compound) |
| `INSERT ... ON CONFLICT (col) DO NOTHING` | Inserts a row, ignores duplicates | Yes |
| `DO $$ ... if (count(*) >= N) return; $$` | Top-level guard, exits if already done | Yes |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Enables RLS (no-op if already enabled) | Yes |

---

## 1. The 3 lessons, in detail

### Lesson 1 — `CREATE TABLE IF NOT EXISTS` is a partial check

The naive read: "Postgres won't let me create a table that exists; `IF NOT
EXISTS` is the answer." The reality: `IF NOT EXISTS` only checks the table
name. If the table exists with different columns, `IF NOT EXISTS` is a silent
no-op. The migration "succeeds" but the schema is wrong.

**The fix:** pair `CREATE TABLE IF NOT EXISTS` with column-level comments
that pin the schema:

```sql
create table if not exists public.batches (
  id                 uuid primary key default gen_random_uuid(),
  -- v1.0: added kg_remaining. v1.1: added delivered_at. DO NOT remove columns.
  kg                numeric(10, 3) not null,
  kg_remaining      numeric(10, 3) not null,
  delivered_at      timestamptz not null default now(),
  ...
);
```

The comments are the spec; `IF NOT EXISTS` is the safety net. A future
contributor who removes a column is reading the comments (or should be).

### Lesson 2 — `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` is the only way

PostgreSQL has no `CREATE TRIGGER IF NOT EXISTS`. Period. The only way to make
trigger creation idempotent is:

```sql
drop trigger if exists trg_batches_audit on public.batches;
create trigger trg_batches_audit
  after insert or update or delete on public.batches
  for each row execute function public.audit_trigger();
```

A `do $$ declare t text; begin for t in ... loop ... end loop; end $$;` block
is the way to apply this to a list of tables without writing 10 copies of
the same SQL.

### Lesson 3 — The seed needs a top-level guard, not just `ON CONFLICT`

A seed that uses `ON CONFLICT DO NOTHING` on every `INSERT` is idempotent for
*static* inserts (vendors, SKUs, locations, price_history). It's NOT idempotent
for *dynamic* inserts (movements, sales) where the row count varies.

The pattern:

```sql
do $$
begin
  if (select count(*) from public.skus where code like 'FISH-%') >= 25 then
    raise notice 'Seed already applied (25+ SKUs with FISH- prefix found). Skipping.';
    return;
  end if;
end $$;

-- Static inserts (use ON CONFLICT):
insert into public.vendors (...) values (...) on conflict (id) do nothing;
insert into public.skus (...) values (...) on conflict (code) do nothing;
insert into public.locations (...) values (...) on conflict (name) do nothing;

-- Dynamic inserts (no ON CONFLICT — the guard above already covered us):
do $$
declare
  i int; v_sku uuid; v_batch uuid;
begin
  for i in 1..28 loop
    v_sku := (select id from public.skus order by random() limit 1);
    insert into public.batches (...) values (...);
  end loop;
end $$;
```

The guard checks a static table (`skus`). If the guard fires, the dynamic
inserts are skipped. If the guard doesn't fire, the static inserts have
already populated the IDs the dynamic inserts depend on.

---

## 2. The 3 known anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| `CREATE TABLE` (no `IF NOT EXISTS`) | Re-apply fails. |
| `CREATE TRIGGER` (no `DROP TRIGGER IF EXISTS` first) | Re-apply fails. |
| Seed without a top-level guard | Re-apply inserts duplicate dynamic rows. |

---

## 3. The 1 known under-engineering trap

**Migrations that depend on order but don't declare it.** If `0002_billing.sql`
depends on `0001_init.sql` (the `users` table must exist), the migration is
implicitly ordered. A future contributor who renames `0001_init.sql` to
`0000_pre_init.sql` breaks the dependency silently. The pattern: a top-of-file
comment that says "requires 0001_init.sql" in every migration.

---

## 4. When this changes (the V2 upgrade path)

- **If you add a column to a tenant-scoped table** (e.g. `users.phone`),
  the migration is a separate `0007_add_phone.sql`. The new column has
  `IF NOT EXISTS` semantics in the form of `ADD COLUMN IF NOT EXISTS phone
  text;` (Postgres 9.6+). The RLS policy on `users` doesn't need to change
  (the policy is `USING (tenantId = current_setting(...))` — it applies to
  all columns).
- **If you add a new RLS policy** (e.g. a new tenant-scoped table), the
  migration is a separate `0008_rls_policies_v2.sql` that uses `DROP POLICY
  IF EXISTS` + `CREATE POLICY` (the kit's templates/sql/rls-policies.sql
  shows the pattern).

---

*— End of pattern. The 200-line Jayshankar `0001_init.sql` is the canonical
worked example. This pattern is the recipe designed to be applied to any
new migration in any consumer.*

---

*— End of `idempotent-migrations` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
