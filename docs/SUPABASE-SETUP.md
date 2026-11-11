# Supabase setup — Jayshankar

> **The procedure to set up a fresh Supabase project for the Jayshankar demo.**
> Run once per environment. Re-run after any reset.

---

## 0. Prerequisites

- A Supabase account (free tier is enough — SPEC D1)
- PowerShell (Windows) or bash (Linux/WSL)
- Node 18+ (for `scripts/seed-auth-users.mjs`)

---

## 1. Create the project (one-time per Supabase project)

1. Go to <https://supabase.com/dashboard>
2. Click **"New project"**
3. Pick the **region closest to Tamil Nadu** — `ap-south-1` (Mumbai) is the right pick
4. Set a strong **database password** — save it somewhere safe; you'll need it once
5. Wait ~2 minutes for the project to provision

---

## 2. Get the credentials

1. In your project, go to **Project Settings → API Keys** (the new dashboard panel;
   the older "API" tab still has the legacy `anon` / `service_role` names, but the
   new names are what `@supabase/server` uses).
2. Copy:
   - **Project URL** (e.g. `https://abcdefg.supabase.co`) → `SUPABASE_URL`
   - **Publishable key** (browser-safe; RLS-enforced) → `SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (server-only; bypasses RLS) → `SUPABASE_SECRET_KEY`
   - **JWT Secret Key** JWKS URL (or set it to `https://<your-ref>.supabase.co/auth/v1/jwks`) → `SUPABASE_JWKS_URL`
3. Create `Jayshankar/scripts/.env` from `.env.example` and paste in the values:

   ```powershell
   Copy-Item scripts\.env.example scripts\.env
   notepad scripts\.env
   # paste your SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_JWKS_URL
   # save and close
   ```

> **The `secret` key bypasses RLS.** Never put it in a browser bundle. Never commit it.
> The seed script reads it from `.env` and uses it only to call the Admin API (which is
> server-side by definition). The `publishable` key is safe in the browser bundle (RLS
> still applies), and `JWKS_URL` is for JWT verification by the future app's
> `@supabase/server` calls.

---

## 3. Run the schema (one-time per project, or after every reset)

1. In the Supabase Dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy-paste the contents of each file in order, click **"Run"** after each:

   | # | File | What it does |
   |---|---|---|
   | 1 | `Jayshankar/supabase/migrations/0001_init.sql` | 9 tables, audit trigger, `kg_remaining` trigger, `handle_new_user` + `handle_user_delete` triggers |
   | 2 | `Jayshankar/supabase/migrations/0002_handle_new_user_meta.sql` | Patches `handle_new_user()` to read role + display_name from `raw_user_meta_data` (so `seed-auth-users.mjs` can supply them; without this, the trigger fails with SQLSTATE 23502 because `public.users.display_name` is NOT NULL) |
   | 3 | `Jayshankar/supabase/migrations/0003_grant_service_role.sql` | Grants `service_role` SELECT/INSERT/UPDATE/DELETE on all `public` tables + sequences + functions, plus ALTER DEFAULT PRIVILEGES for future tables. Without this, server-side scripts that use the secret key get SQLSTATE 42501 (BYPASSRLS bypasses policies, not GRANTs). |
   | 4 | `Jayshankar/supabase/migrations/0004_grant_authenticated.sql` | Grants `authenticated` (the role the publishable key becomes when a user is signed in) the same GRANTs. Without this, every Supabase JS query from a signed-in browser throws SQLSTATE 42501. |
   | 5 | `Jayshankar/supabase/migrations/0005_record_transfer_cascade.sql` | SECURITY DEFINER Postgres function `record_transfer_cascade(sku, from_loc, to_loc, kg, notes)` — does FIFO + 2 inserts atomically with `FOR UPDATE` protection. Without this, workers can't record transfers (RLS denies batches INSERT) and concurrent transfers could race. |
   | 6 | `Jayshankar/supabase/rls-policies.sql` | RLS on all 9 tables, policies per role (admin / vendor-rep / worker / super-worker) |
   | 7 | `Jayshankar/supabase/seed.sql` | 6 vendors, 25 SKUs, 3 locations, 150+ movements, 20+ sales, 150 price_history rows |

You should see **"Success. No rows returned"** for each.

> **If you get an error on the seed:** the most common cause is the `users_id_fkey` FK violation,
> which means a stale migration was applied. Use the **fixed** migration (BUILDER-DECISIONS-REVIEW.md
> decision 8). If that's the case, run the **Reset** procedure below and re-run from step 3.
>
> **If you get `SQLSTATE 23502: null value in column "display_name"`** when running
> `seed-auth-users.mjs`: the trigger wasn't updated. Make sure 0002 was applied (BUILDER-DECISIONS-REVIEW
> decision 10). If it wasn't, run the **Reset** procedure and re-apply.
>
> **If you get `SQLSTATE 42501: permission denied for table users` on the PATCH step**
> (auth users created successfully, but role/display_name update fails): the GRANT
> migration wasn't applied. Run 0003 in the SQL Editor (no reset needed — this is
> additive), then re-run `seed-auth-users.mjs`. The script is idempotent — it will
> PATCH the 3 existing public.users rows with the correct role/display_name
> (BUILDER-DECISIONS-REVIEW decision 11).
>
> **If you get `SQLSTATE 42501: permission denied for table users` from the BROWSER**
> (after signing in, the useSession hook fails to read public.users): the
> `authenticated` role has no GRANTs. Run 0004 in the SQL Editor (no reset needed).
> BUILDER-DECISIONS-REVIEW decision 16.
>
> **If you get `new row violates row-level security policy for table "batches"`
> when a worker tries to record a transfer**: the worker is trying to insert the
> destination batch directly, which RLS denies (batches_insert_rep only allows
> admin/vendor-rep/super-worker). Run 0005 in the SQL Editor (additive — just
> adds the `record_transfer_cascade` SECURITY DEFINER function). The app then
> calls the function instead of inserting directly, bypassing RLS for that one
> operation. BUILDER-DECISIONS-REVIEW decision 23.

---

## 4. Verify the seed

In the Supabase Dashboard, go to **Table Editor**. You should see:

| Table | Expected row count |
|---|---|
| `vendors` | 6 |
| `skus` | 25 |
| `locations` | 3 |
| `batches` | ~130 |
| `movements` | 150+ |
| `sales` | 20+ |
| `price_history` | 150 (30 days × 5 SKUs) |
| `audit_log` | 0 (populated only when mutations happen) |
| `users` | 0 (the 3 auth users come next) |

If anything is off, re-check that every file in `supabase/migrations/` ran in order, that
`supabase/rls-policies.sql` ran after them, and that `supabase/seed.sql` ran last.

---

## 5. Create the 3 demo auth users

```powershell
node scripts/seed-auth-users.mjs
```

Output (expected):

```
Supabase project: https://abcdefg.supabase.co
Seeding 3 demo auth users...

  · user exists: admin@jayshankar.demo  ...   (only on re-runs)
  · created auth user: admin@jayshankar.demo (id=...)
  · public.users updated: admin@jayshankar.demo → role='admin', display_name='Karthik (the wholesaler)'
  · public.users updated: rep@jayshankar.demo → role='vendor-rep', display_name='Anitha'
  · public.users updated: worker@jayshankar.demo → role='worker', display_name='Suresh'

Done. 2 created, 1 updated, 0 failed.
```

The script is **idempotent** — re-run it and it updates existing users instead of failing.

**What the script does, mechanically:**

1. Lists all auth.users via the Admin API
2. For each of the 3 demo users:
   - If exists, note it (we'll update role/display_name)
   - If not, call `POST /auth/v1/admin/users` with `email_confirm: true` (skips the
     email-confirmation dance) and `user_metadata: { role, display_name }`. This
     fires the `handle_new_user()` trigger which inserts a matching `public.users` row.
3. PATCHes `public.users.role` and `display_name` to match the canonical values
   (the trigger sets the first user to `'admin'` and the rest to `'worker'`, so we
   override for `vendor-rep`).

> **Why we need this script (not just the SQL seed):** the SQL seed inserts `public.users`
> rows with fixed UUIDs (`a0000000-0000-0000-0000-000000000001` etc.) but the
> corresponding `auth.users` rows can only be created via the Admin API (Supabase
> Auth manages that table; the SQL Editor has no write access). The script bridges
> the gap. See BUILDER-DECISIONS-REVIEW.md decision 8 for the full rationale.

---

## 6. Reset (when something goes wrong)

If the seed or migrations produce errors you can't recover from — for example, a
partial apply or an experimental schema change you want to abandon — use the quick
reset (preserves the project, drops the schema):

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this single block:

   ```sql
   drop schema public cascade;
   create schema public;
   grant all on schema public to public;
   ```

3. Re-run step 3 (the 3 SQL files) from scratch
4. The 3 auth users (step 5) survive — they're in `auth.users`, not `public`

**Or** the nuclear reset (recreates the entire database, including `auth.users`):

1. Supabase Dashboard → **Project Settings → General**
2. Scroll to the bottom — there's a **"Pause project"** button
3. Confirm. This drops the entire database
4. Re-create the 3 auth users via `node scripts/seed-auth-users.mjs`
5. Re-run step 3 (the 3 SQL files)

> **Don't delete the Supabase project entirely** unless you want to lose the project
> URL (and have to update `.env` and re-paste it). The reset above is destructive
> enough.

---

## 7. Day-to-day commands

```powershell
# Run the validator (static checks on the spec, SQL, RLS, seed, scripts)
node scripts/validate.mjs --sql supabase/migrations/0001_init.sql --rls supabase/rls-policies.sql --seed supabase/seed.sql

# Run the validator's self-test
node --test scripts/selftest.mjs

# Re-seed the 3 auth users (idempotent)
node scripts/seed-auth-users.mjs

# Apply a single SQL file in the Supabase SQL Editor (paste, then Run)
```

---

## 8. Common errors

| Error | Cause | Fix |
|---|---|---|
| `23503: insert or update on table "users" violates foreign key constraint "users_id_fkey"` | Stale migration (the original had a FK on `public.users.id` to `auth.users.id`) | Use the **fixed** migration. See BUILDER-DECISIONS-REVIEW.md decision 8. |
| `Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.` when running `seed-auth-users.mjs` | `.env` missing or values are placeholder | `Copy-Item scripts\.env.example scripts\.env` and paste the real values from Supabase Dashboard → Project Settings → API Keys |
| `permission denied for table users` when updating role | Secret key wrong, OR RLS deny on public.users (shouldn't happen with the secret key, which bypasses RLS) | Check `.env`; re-create the project if the key is right but you still get the error |
| `duplicate key value violates unique constraint` on re-seed | The seed's idempotency guard is missing | Use the **fixed** seed (top-level guard + `on conflict do nothing` on every INSERT) |
| `relation "public.users" does not exist` | The migration didn't run, or the reset wiped the schema | Run `0001_init.sql` first (step 3) |
| `fetch is not defined` when running the seed script | Node < 18 | Upgrade Node. The script uses `fetch` (built-in since Node 18). |
| `401 Unauthorized` from the Admin API | Wrong secret key, or project paused | Check Supabase Dashboard; paste the key again from Project Settings → API Keys |

---

## 9. Security notes

- The `secret` key (formerly `service_role`) is a **secret**. Anyone with this key can
  read and write every table in your project, bypassing RLS. Treat it like a database
  root password.
- `scripts/.env` is in `.gitignore`. **Do not commit it.** **Do not paste it in chat.**
  **Do not put it in a frontend bundle.**
- The 3 demo passwords (`DevPassword123!`) are placeholders. Change them for any
  non-demo deployment.
- For production, use **strong, unique** passwords and rotate them per environment.
  The `SEED_*_PASSWORD` env vars let you set them without editing the script.

---

---

## 10. Cleanup: delete the demo users (reuse the project)

The 3 demo users (`admin@`, `rep@`, `worker@jayshankar.demo`) can be removed at any time
without affecting the rest of the seed. Use the SQL Editor:

```sql
-- Deletes the 3 demo auth users. The handle_user_delete() trigger on auth.users
-- removes the matching public.users rows automatically.
delete from auth.users
where email in (
  'admin@jayshankar.demo',
  'rep@jayshankar.demo',
  'worker@jayshankar.demo'
);
```

The `handle_user_delete()` trigger (BUILDER-DECISIONS-REVIEW decision 8) handles the
`public.users` cleanup. The rest of the seed (vendors, SKUs, batches, movements, sales)
is untouched.

**For full project reset** (you want to start over from a clean schema): use the
**Reset** procedure in step 3.

---

## 11. Free tier: reusing Supabase across projects

| What | How |
|---|---|
| Free projects per org | 2 (as of 2024) — see [Supabase pricing](https://supabase.com/pricing) |
| What happens to idle projects | Free projects pause after **7 days** of no API activity. Data is preserved; restart is one click in the dashboard. |
| DB + transfer limits | 500 MB DB + 2 GB transfer, **shared across all projects in the org** |
| Recommended pattern | One project per concept (Jayshankar in one, your MERN chatbot in another). Pause a project when not in use rather than deleting. The 3 demo users don't pollute the schema unless you run `seed-auth-users.mjs`. |
| When you need a 3rd project | Upgrade to Pro ($25/mo) or create a second org with a different email. |
| For demo / teaching | A single Supabase project is fine for a teaching run — just don't run `seed-auth-users.mjs` if you don't want the 3 demo users in `auth.users`. |

---

*Last updated: 2026-08-06 (after the W3 first-try surfaced the batches RLS
gap for worker transfers, fixed by BUILDER-DECISIONS-REVIEW.md decision 23).*

---

## Applying the later migrations (0006 → today)

The numbered list near the top of this guide is the **original** setup order (0001–0005,
`rls-policies.sql`, `seed.sql`) and has not been rewritten since 2026-08-06. Migrations 0006–0036
have been added since, so the correct order for a **fresh** project today is:

1. every file in `supabase/migrations/`, in numeric order (`0001` … `0036`),
2. then `supabase/rls-policies.sql`,
3. then `supabase/seed.sql`.

`rls-policies.sql` is **not** a frozen snapshot of the original policies — it references tables and
functions that the later migrations create, so running it before them fails.

### Phase B (`0037`–`0046`) — written and tested, not applied, not in this checkout

Ten further migrations exist on the `backend-phase-b` workstream, with a SQL test suite to match
(`supabase/tests/`, 10 test files + `run.sh`). As of this commit they are **not in this checkout**:
they ship in `client-qa/session3/backend-phase-b.zip`. They have **not** been applied to the live
Supabase project and are **not** wired into any screen except six notification texts.
`docs/BACKEND-PHASE-B-STATUS.md` is the status document; `docs/BACKEND-REQUIREMENTS-phase-b.md` is
the requirements document it answers.

Once they land here, the order above becomes:

1. fresh project: `0001` … `0046`, then `rls-policies.sql`, then `seed.sql`;
2. project already at `0036`: run `0037` … `0046` in numeric order — **`0046` first** if you only
   want the security fix (§3 finding 1 of the status doc) — then re-run `rls-policies.sql`.

Back up first: this is a production database change. Landing those migrations is deliberately **not**
part of the documentation work that brought this section here — see
`SPEC-AMENDMENT-v4-plan-md.md` §7 item 5.

Blind receiving ships **off**. Read `docs/BACKEND-PHASE-B-STATUS.md` §6 before turning it on, and
§7 for the post-apply checks. To run the database tests locally: `supabase/tests/run.sh`, which
needs a local PostgreSQL 15+ — not Supabase (`docs/DECISIONS.md` #39).
