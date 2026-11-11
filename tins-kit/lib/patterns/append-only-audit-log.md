# `append-only-audit-log` — kit pattern

> **The canonical recipe for "every mutation writes to an audit log; the audit log
> is append-only, written by trigger only, readable by admin."** Self-contained.
>
> **Source:** atal-incubation (the canonical writeup is in
> `TRAININGS.md` §1 "Mental model" + `src/lib/prisma.ts`); Jayshankar (the
> reference `0001_init.sql` has the `audit_trigger` + `audit_log` table).

---

## 0. Why this exists

The naive way to audit mutations is: add a `createdBy`, `updatedBy`, `deletedBy`
column to every table, set them in the app, and trust the developer to remember.
This trips three non-obvious bugs:

1. **Application code can lie.** A bug (or a malicious insider) sets
   `createdBy = 'admin'` and the audit log shows "admin did this." Trust is gone.
2. **Direct DB access bypasses the app.** An admin's `psql` UPDATE on
   `users.passwordHash` writes no audit row.
3. **UPDATE/DELETE on the audit log itself is undetectable.** Once an
   attacker has write access, they can edit the audit log to remove their
   fingerprint.

The fix: the audit log is **append-only, written by a Postgres trigger
function that runs as `SECURITY DEFINER` (the function owner, who bypasses
RLS), and has no UPDATE/DELETE policy at all.** The trigger fires on every
INSERT/UPDATE/DELETE; the app cannot bypass it, direct DB access cannot
bypass it, and the audit log itself is read-only.

---

## 1. The 3 lessons, in detail

### Lesson 1 — The trigger is the only writer

```sql
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_user uuid;
  audit_row jsonb;
begin
  audit_user := auth.uid();
  if (tg_op = 'INSERT') then
    audit_row := to_jsonb(new);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'INSERT', tg_table_name, (new).id, null, audit_row);
    return new;
  elsif (tg_op = 'UPDATE') then
    audit_row := to_jsonb(new);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'UPDATE', tg_table_name, (new).id, to_jsonb(old), audit_row);
    return new;
  elsif (tg_op = 'DELETE') then
    audit_row := to_jsonb(old);
    insert into public.audit_log (user_id, action, table_name, row_id, before_json, after_json)
    values (audit_user, 'DELETE', tg_table_name, (old).id, audit_row, null);
    return old;
  end if;
  return null;
end;
$$;
```

The function is `SECURITY DEFINER` — it runs as the function owner (typically
`postgres`), not as the calling user. This lets it INSERT into `audit_log` even
if the calling user has no INSERT privilege on the table.

Then attach the trigger to every audited table:

```sql
do $$
declare t text;
begin
  for t in select unnest(array['users', 'vendors', 'skus', 'batches', 'movements', 'sales', 'price_history'])
  loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%I_audit after insert or update or delete on public.%I
       for each row execute function public.audit_trigger()',
      t, t
    );
  end loop;
end $$;
```

### Lesson 2 — The audit_log table has no UPDATE or DELETE policy

```sql
alter table public.audit_log enable row level security;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.current_user_role() = 'admin');

-- NO INSERT policy. The trigger is the only writer (it bypasses RLS via SECURITY DEFINER).
-- NO UPDATE policy.
-- NO DELETE policy.
```

A direct INSERT from the app returns the empty RLS check (no policy = denied). The
trigger function is `SECURITY DEFINER`, so it bypasses RLS. Only the trigger can
write; only the admin role can read.

### Lesson 3 — `before_json` and `after_json` capture the full row

The trigger writes both the before and after state of every UPDATE. This is
expensive (every UPDATE doubles the row size in `audit_log`), but it pays for
itself the first time someone needs to answer "what was the value of this column
before this change?" Without `before_json`, the answer is "we don't know."

A `jsonb` column is the right type. The `to_jsonb(new)` / `to_jsonb(old)` calls
serialise the row including all columns. The query "what was `email` of user 42
before the last 5 changes?" is:

```sql
select after_json, before_json, at
from audit_log
where table_name = 'users' and row_id = 42 and action = 'UPDATE'
order by at desc
limit 5;
```

---

## 2. The 3 known anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| App writes the audit row in the route handler | App code can lie; a bug or attacker can skip it. |
| `audit_log` has an UPDATE or DELETE policy | The whole point is "the audit log cannot be tampered with." A policy that allows UPDATE/DELETE breaks the contract. |
| Only the changed columns in `after_json` | "What was the value of `email` before this UPDATE?" becomes "we don't know — we only stored what changed." |

---

## 3. The 1 known over-engineering trap

**Don't audit `Notification`, `JobQueue`, or `CronLog`.** These are meta-tables
(their content is itself audit information). Auditing them creates an infinite
regress of "who audited the auditor?" — and the storage cost triples.

The rule: audit domain tables (`User`, `Startup`, `SISFSApplication`, etc.), not
infrastructure tables.

---

## 4. The 1 known under-engineering trap

**Don't skip the `before_json` column.** "Storage is expensive" is the wrong reason.
The right question: "if the admin gets breached, can we still answer 'what did
they change?'" Without `before_json`, the answer is "no, only the new values."

If storage is genuinely a concern, the right answer is a 90-day hot + cold
archive, not "skip the before column."

---

## 5. When this changes (the V2 upgrade path)

- **If the audit log grows past 10M rows**, partition by month and move old
  partitions to cold storage. The trigger keeps working; queries use the same
  indexes.
- **If you add a "read by row owner" requirement** (e.g. a founder can see who
  changed their own startup), add a policy: `using (row_id in (select id from
  startups where founder_id = current_user_id))`. The trigger stays the same.
- **If you add a "right to be forgotten"** (GDPR Article 17), the pattern's
  no-DELETE-on-audit-log rule conflicts with the right. The standard solution
  is "soft-delete the user's row in the domain tables, leave the audit log
  intact but pseudonymise the `user_id` to a hash." The kit does not yet
  ship a recipe for this.

---

*— End of pattern. The 600-line rationale lives in
`atal-incubation/TRAININGS.md` §1 + `src/lib/prisma.ts`. This pattern
is the focused 1-page version designed to be read at code-review time.*

---

*— End of `append-only-audit-log` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
