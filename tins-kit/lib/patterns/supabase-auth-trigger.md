# `supabase-auth-trigger` — kit pattern

> **The canonical recipe for wiring Supabase Auth to a `public.users` table, with the 3
> hard-won gotchas already avoided.** Self-contained: a consumer can copy this file and
> follow the recipe without reading the rest of the kit.
>
> **Source:** the 3 decisions in `Jayshankar/BUILDER-DECISIONS-REVIEW.md` (decisions 8, 10, 11)
> — all surfaced by the W1.5 live Supabase apply. The lessons crystallised there; this
> pattern carries them forward to every future TINS consumer on Supabase.

---

## 0. Why this exists

The naive way to wire Supabase Auth is to put a `references auth.users(id)` FK on your
`public.users` table. This trips four non-obvious bugs:

| # | What you wrote | What goes wrong | SQLSTATE |
|---|---|---|---|
| 1 | `id uuid primary key references auth.users(id) on delete cascade` on `public.users` | The seed script can't insert `public.users` rows before the matching `auth.users` rows exist. Chicken-and-egg. | `23503` |
| 2 | `handle_new_user()` trigger that only inserts `(id, email, role)` | Any `public.users` column that's NOT NULL but the trigger doesn't set → INSERT fails → `auth.users` INSERT rolls back. | `23502` |
| 3 | None (no `GRANT` to `service_role` in your migration) | Server-side scripts that use the secret key get "permission denied" on every DML, because `service_role` has BYPASSRLS but not GRANTs. | `42501` |
| 4 | None (no `GRANT` to `authenticated` in your migration) | Browser code with a signed-in user runs as `authenticated`. Without GRANTs, every Supabase JS query from the browser fails with "permission denied" before RLS even evaluates. | `42501` |

The pattern below ships all four fixes pre-applied, with validator checks that pin the
design so a future contributor can't accidentally re-introduce the bugs.

---

## 1. The 4 lessons, in detail

### Lesson 1 — Drop the FK on `public.users.id`; enforce integrity via triggers

The FK is redundant: the `handle_new_user()` trigger creates the matching `public.users`
row when an `auth.users` row is created via signup. The FK adds a chicken-and-egg — to
insert a `public.users(id=X)` row you need `auth.users(id=X)`, but to create
`auth.users(id=X)` you go through the trigger (which would create the public row with the
UUID Supabase Auth generates, not one you choose).

**The fix:** `public.users.id` is `uuid primary key` (no FK). The
`handle_user_delete()` AFTER DELETE trigger removes the matching `public.users` row
when an `auth.users` row is deleted, so there's no orphan-leak.

This is the Jayshankar BUILDER-DECISIONS-REVIEW decision 8.

### Lesson 2 — `handle_new_user()` must read every NOT NULL field from `NEW.raw_user_meta_data`

If your `public.users` table has a `display_name text not null` column, the trigger
**must** set it. The naive trigger body:

```sql
insert into public.users (id, email, role, created_at)
values (new.id, new.email, 'worker', now());  -- display_name missing → 23502
```

**The fix:** read every NOT NULL field from `new.raw_user_meta_data` (the JSONB the
Admin API stores from `user_metadata`), with a safe fallback. Caller-supplied wins;
otherwise synthesise from the email or use a default.

This is the Jayshankar BUILDER-DECISIONS-REVIEW decision 10.

### Lesson 3 — `service_role` needs explicit GRANTs on `public.*`

`service_role` has `BYPASSRLS` (bypasses row-level security policies) but does **not**
have `GRANT SELECT/INSERT/UPDATE/DELETE` on tables in `public` by default. Those are
two different Postgres privilege layers. Any server-side script that uses the secret
key (e.g. `seed-auth-users.mjs`, future admin scripts, Edge Functions) hits
`SQLSTATE 42501` on every DML without explicit GRANTs.

The `seed.sql` works because it runs in the SQL Editor as `postgres` (the schema
owner, with all privileges). Server scripts run as `service_role` (a different role,
even though both bypass RLS).

**The fix:** a separate migration that GRANTs ALL on all tables, sequences, and
functions in `public` to `service_role`, plus `ALTER DEFAULT PRIVILEGES` so future
tables also inherit the GRANTs.

This is the Jayshankar BUILDER-DECISIONS-REVIEW decision 11.

### Lesson 4 — `authenticated` ALSO needs explicit GRANTs on `public.*`

Lesson 3 is about the *server* side (`service_role` for admin scripts).
Lesson 4 is the *browser* side. The `authenticated` role in Supabase is the
role every signed-in user runs as. Just like `service_role`, it has
BYPASSRLS *not* set, and it has no default GRANTs on `public.*`. Every
table in `public` needs an explicit `GRANT SELECT, INSERT, UPDATE, DELETE`
to `authenticated` for the browser to read or write to it.

**What goes wrong without it.** The first time the browser calls
`supabase.from('skus').select('*')`, the request returns `SQLSTATE 42501`
"permission denied for table skus" — *before* the RLS policy is even
evaluated. The RLS layer is downstream of the GRANT layer; without the
GRANT, RLS is moot. The browser console shows the error; the UI shows
nothing (no rows, no error, no clue).

**The fix.** A separate migration `0003_grant_authenticated.sql` (after
the init migration) that GRANTs the appropriate rights on every table:

```sql
-- 0003_grant_authenticated.sql
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.batches, public.movements, public.sales, public.spoilage to authenticated;
-- (no delete — soft delete only, per SPEC §2.3.4)
alter default privileges in schema public
  grant select on tables to authenticated;
```

The "no DELETE" line is intentional: SPEC D5 says the audit log is
append-only and no table is hard-deletable. The GRANT doesn't include
`delete` for that reason.

**The pattern's mistake.** The original 3-lesson version of this pattern
forgot Lesson 4 entirely. It assumed `authenticated` was "the default
signed-in user" and that the GRANTs would Just Work. They don't. The
lesson was added in W2 of Jayshankar after the first time the browser
hit `permission denied` on a `select` query. The cost of missing it:
~30 minutes of head-scratching, a misleading error message, and a
deferral of the actual UI testing.

**Validator check.** `js-grant-authenticated` — string-match the
migration for `grant select ... to authenticated` and `grant insert, update ... to authenticated`. Without it, the future contributor will
re-introduce the bug.

This is the Jayshankar BUILDER-DECISIONS-REVIEW decision 16.

---

## 2. The recipe

The recipe is 5 files, applied in order. Total: ~250 lines of SQL + ~180 lines of JS.

### 2.1 File 1: `supabase/migrations/0001_init.sql` (or your own numbered migration)

The relevant blocks — copy these into your migration. The full migration has more
(specs for the rest of your schema), but the blocks below are the non-negotiable parts.

```sql
-- ============================================================
-- 1. users — app-side users, joined to auth.users by id
-- ============================================================
-- IMPORTANT: do NOT add "references auth.users(id)" on the id column.
-- The FK is redundant (the trigger creates the matching public.users row)
-- and it creates a chicken-and-egg with the seed. See kit pattern
-- supabase-auth-trigger.md, Lesson 1.
create table if not exists public.users (
  id            uuid primary key,
  email         text not null,
  phone         text,
  display_name  text not null,                -- NOT NULL: the trigger MUST set this
  role          text not null check (role in ('admin', 'vendor-rep', 'worker')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. handle_new_user — first signup becomes admin, others become worker
--    Reads role + display_name from NEW.raw_user_meta_data with fallbacks.
--    See kit pattern supabase-auth-trigger.md, Lesson 2.
-- ============================================================
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
  -- Caller-supplied meta wins. If absent or invalid, fall back to the
  -- first-user-becomes-admin rule.
  meta_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');

  if meta_role is not null and meta_role in ('admin', 'vendor-rep', 'worker') then
    resolved_role := meta_role;
  else
    select count(*) into user_count from public.users;
    if user_count = 0 then
      resolved_role := 'admin';
    else
      resolved_role := 'worker';
    end if;
  end if;

  -- Display name: caller-supplied wins; else synthesise from email local-part.
  -- Guarantees NOT NULL.
  if meta_display is not null then
    resolved_display := meta_display;
  else
    email_local := split_part(coalesce(new.email, 'user'), '@', 1);
    if email_local = '' then email_local := 'user'; end if;
    resolved_display := upper(substring(email_local from 1 for 1)) ||
                        substring(email_local from 2);
  end if;

  insert into public.users (id, email, role, display_name, created_at)
  values (new.id, coalesce(new.email, ''), resolved_role, resolved_display, now());
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. handle_user_delete — keeps public.users in sync when auth.users
--    is deleted. Required because we deliberately dropped the FK.
-- ============================================================
create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_handle_user_delete on auth.users;
create trigger trg_handle_user_delete
  after delete on auth.users
  for each row execute function public.handle_user_delete();
```

### 2.2 File 2: `supabase/migrations/0002_grant_service_role.sql`

Always a separate file so the intent is clear and re-running is safe.

```sql
-- See kit pattern supabase-auth-trigger.md, Lesson 3.
-- service_role has BYPASSRLS but no table-level GRANTs by default.
-- Without these GRANTs, every server-side script that uses the secret
-- key fails with SQLSTATE 42501.
--
-- IDEMPOTENT: GRANT is idempotent.

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
```

### 2.3 File 3: `0003_grant_authenticated.sql`

This is the lesson Jayshankar hit **after** shipping the seed script. Even with
`service_role` GRANTed, the browser code (with a signed-in user) runs as
`authenticated` — which also needs GRANTs. The default Supabase setup usually
GRANTs `authenticated` via ALTER DEFAULT PRIVILEGES on the `public` schema, but
this only applies if those defaults were set before your tables were created.
Migrating into a project that doesn't have the defaults (or applying to a
recreated schema) → SQLSTATE 42501 on the very first `from('users').select(...)`.

```sql
-- See kit pattern supabase-auth-trigger.md, Lesson 4.
-- Without these GRANTs, every Supabase JS query from a signed-in browser
-- fails with SQLSTATE 42501 (BYPASSRLS is irrelevant here; the publishable
-- key runs as `authenticated`, not `service_role`).
--
-- IDEMPOTENT.

grant usage on schema public to authenticated;
grant all on all tables    in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all functions in schema public to authenticated;

alter default privileges in schema public grant all on tables    to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant all on functions to authenticated;
```

### 2.4 File 4: `scripts/seed-auth-users.mjs`

Zero-dep Node ESM (no `@supabase/supabase-js`, no `dotenv`). Uses `fetch` (built-in
since Node 18). The script is idempotent — re-running it updates existing users'
role/display_name instead of failing.

```js
#!/usr/bin/env node
// seed-auth-users.mjs — create the N demo auth users in Supabase Auth.
// Idempotent. Zero-dep. Reads from scripts/.env.
// See kit pattern supabase-auth-trigger.md.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const envPath = resolve(process.cwd(), 'scripts', '.env');
const env = loadEnv(envPath);
const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.');
  console.error(`Looked in: ${envPath} and process.env.`);
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

// Edit this list to match your consumer's demo users.
const DEMO_USERS = [
  { email: 'admin@your-app.demo',  password: 'DevPassword123!', role: 'admin',     display_name: 'Admin' },
  { email: 'rep@your-app.demo',    password: 'DevPassword123!', role: 'vendor-rep', display_name: 'Rep' },
  { email: 'worker@your-app.demo', password: 'DevPassword123!', role: 'worker',    display_name: 'Worker' },
];

async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!res.ok) throw new Error(`listUsers failed (${res.status}): ${await res.text()}`);
  return (await res.json()).users || [];
}

async function createUser({ email, password, role, display_name }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({
      email, password, email_confirm: true,
      user_metadata: { role, display_name },
    }),
  });
  if (res.status === 422) return null;  // already exists
  if (!res.ok) throw new Error(`createUser(${email}) failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

async function updatePublicUser(id, { role, display_name }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ role, display_name }),
  });
  if (!res.ok) throw new Error(`updatePublicUser failed (${res.status}): ${await res.text()}`);
}

async function ensureUser(u, byEmail) {
  const existing = byEmail.get(u.email);
  if (!existing) {
    const created = await createUser(u);
    if (!created || !created.id) {
      // 422 race: re-list and find
      const found = (await listUsers()).find(x => x.email === u.email);
      if (!found) throw new Error(`Could not create or find ${u.email}`);
      await updatePublicUser(found.id, u);
      return;
    }
  }
  const userId = existing ? existing.id : (await listUsers()).find(x => x.email === u.email).id;
  await updatePublicUser(userId, u);
}

async function main() {
  const existing = await listUsers();
  const byEmail = new Map(existing.map(u => [u.email, u]));
  let created = 0, updated = 0, failed = 0;
  for (const u of DEMO_USERS) {
    try {
      const wasNew = !byEmail.has(u.email);
      await ensureUser(u, byEmail);
      if (wasNew) created++; else updated++;
    } catch (err) {
      console.error(`  ✗ ${u.email}: ${err.message}`);
      failed++;
    }
  }
  console.log(`Done. ${created} created, ${updated} updated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
```

### 2.5 File 5: `scripts/.env.example`

```bash
# Supabase credentials. Copy to scripts/.env and fill in.
# Find in: Supabase Dashboard → Project Settings → API Keys
SUPABASE_URL=
SUPABASE_SECRET_KEY=

# Demo user passwords. Defaults to "DevPassword123!" if unset.
SEED_ADMIN_PASSWORD=
SEED_REP_PASSWORD=
SEED_WORKER_PASSWORD=
```

---

## 3. The validator checks (pin the design)

Add these to your `scripts/validate.mjs` (kit's D7 — every validator ships a self-test).
Each check corresponds to one of the 4 lessons.

```js
// js-handle-new-user-meta — Lesson 2
if (/create\s+or\s+replace\s+function\s+public\.handle_new_user\s*\([\s\S]*?raw_user_meta_data/i.test(migration)) {
  pass('js-handle-new-user-meta', 'handle_new_user() reads role + display_name from NEW.raw_user_meta_data');
} else {
  fail('js-handle-new-user-meta', 'handle_new_user() does not read NEW.raw_user_meta_data — caller-supplied meta will be lost; the NOT NULL on display_name will trip the trigger (SQLSTATE 23502)');
}

// js-grant-service-role — Lesson 3
if (/grant\s+(all\s+on\s+all\s+tables\s+in\s+schema\s+public|[\w,\s]+on\s+public\.\w+)\s+to\s+service_role/i.test(migration)
    || /alter\s+default\s+privileges\s+in\s+schema\s+public[\s\S]{0,200}?grant\s+all\s+on\s+tables\s+to\s+service_role/i.test(migration)) {
  pass('js-grant-service-role', 'service_role has table-level GRANTs (BYPASSRLS is paired with explicit GRANT)');
} else {
  fail('js-grant-service-role', 'service_role has BYPASSRLS but no table-level GRANTs — server-side scripts will fail with SQLSTATE 42501');
}

// js-grant-authenticated — Lesson 4
// (separate migration; check the latest migration file too, not just 0001)
const grantAuthMigration = readLatestMigrationContent();
if (/grant\s+(usage\s+on\s+schema\s+public|select\s+on\s+all\s+tables\s+in\s+schema\s+public)\s+to\s+authenticated/i.test(grantAuthMigration)
    && /grant\s+(insert|update|delete)\s+on\s+public\.\w+\s+to\s+authenticated/i.test(grantAuthMigration)) {
  pass('js-grant-authenticated', 'authenticated has table-level GRANTs (browser code with a signed-in user can read public tables)');
} else {
  fail('js-grant-authenticated', 'authenticated has no table-level GRANTs — every Supabase JS query from the browser will fail with SQLSTATE 42501 before RLS is even evaluated');
}

// js-noauthfk — Lesson 1: the FK must NOT be re-added
const usersTableMatch = migration.match(/create\s+table\s+if\s+not\s+exists\s+public\.users\s*\(([\s\S]*?)\);/i);
if (usersTableMatch) {
  const idLineMatch = usersTableMatch[1].match(/^\s*id\s+uuid[^\n]*/im);
  if (idLineMatch && /references\s+auth\.users/i.test(idLineMatch[0])) {
    fail('js-noauthfk', 'public.users.id has a FK to auth.users(id) — drop it; integrity must be trigger-based');
  } else {
    pass('js-noauthfk', 'public.users.id has no FK to auth.users(id) — integrity is trigger-based (correct)');
  }
}

// js-handle-trg — trigger must be attached to auth.users
if (/create\s+trigger\s+trg_handle_new_user\b[\s\S]{0,200}?on\s+auth\.users/i.test(migration)) {
  pass('js-handle-trg', 'handle_new_user trigger attached to auth.users');
} else {
  fail('js-handle-trg', 'handle_new_user trigger not attached to auth.users');
}

// js-handle-del-trg — handle_user_delete trigger (cascading cleanup)
if (/create\s+trigger\s+trg_handle_user_delete\b[\s\S]{0,200}?on\s+auth\.users/i.test(migration)) {
  pass('js-handle-del-trg', 'handle_user_delete trigger attached to auth.users');
} else {
  fail('js-handle-del-trg', 'handle_user_delete trigger not attached — deleting auth.users would orphan public.users');
}
```

---

## 4. The end-to-end flow (what the user does)

```powershell
# 1. Create the project + get the keys (Dashboard → New project)
#    Then: Project Settings → API Keys
#    Copy: Project URL, Publishable key, Secret key

# 2. Wipe any prior apply (only if you're re-running after a partial apply)
#    In SQL Editor, paste + run:
#      drop schema public cascade;
#      create schema public;
#      grant all on schema public to public;

# 3. Apply the 3 migrations in order, in the SQL Editor (one query at a time)
#    0001_init.sql
#    0002_grant_service_role.sql
#    0003_grant_authenticated.sql

# 4. Apply the RLS policies (your consumer's own file, not part of this pattern)
#    rls-policies.sql

# 5. Apply the seed (your consumer's own file, not part of this pattern)
#    seed.sql

# 6. Create the demo auth users
Copy-Item scripts\.env.example scripts\.env
# paste SUPABASE_URL and SUPABASE_SECRET_KEY
node scripts/seed-auth-users.mjs
# expect: "N created, 0 updated, 0 failed"

# 7. Verify
#    Table Editor → public.users → N rows with the canonical role/display_name
```

---

## 5. How to delete the demo users (reuse the project)

In SQL Editor:

```sql
-- The handle_user_delete() trigger removes the matching public.users rows.
delete from auth.users
where email in (
  'admin@your-app.demo',
  'rep@your-app.demo',
  'worker@your-app.demo'
);
```

Re-run `node scripts/seed-auth-users.mjs` to recreate them. The script is idempotent.

---

## 6. Free-tier notes

| What | How |
|---|---|
| Free projects per org | 2 (as of 2024) — see Supabase pricing |
| Idle projects | Free projects pause after 7 days of no API activity. Data is preserved; unpause is one click. |
| DB + transfer limits | 500 MB DB + 2 GB transfer, shared across all projects in the org |
| For multi-app reuse | One project per concept. Pause when not in use. The demo users don't pollute the schema unless you run `seed-auth-users.mjs`. |

---

## 7. Cross-references

- **Jayshankar BUILDER-DECISIONS-REVIEW.md** — the source of all 3 lessons. Decisions 8, 10, 11.
- **Jayshankar docs/SUPABASE-SETUP.md** — the full operator-facing procedure (this pattern
  is the kit-level abstraction; that doc is the Jayshankar-specific apply guide).
- **Jayshankar supabase/migrations/** — 0001_init.sql, 0002_handle_new_user_meta.sql,
  0003_grant_service_role.sql. Real-world applications of this pattern.
- **Jayshankar scripts/seed-auth-users.mjs** — the working reference implementation of
  File 4 above (slightly extended; handles 3 specific demo users with display_name values).
- **Jayshankar scripts/.env.example** — File 5 above, applied to the Jayshankar use case.

---

*Pattern version 1. Last updated 2026-08-06. Source: Jayshankar W1.5 live apply.
A future kit revision may extract the seed-auth-users.mjs into a templates/ entry
under `templates/scripts/seed-auth-users.mjs.template` so consumers can copy a
slightly-customised version rather than following the recipe.*

---

*— End of `supabase-auth-trigger` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
