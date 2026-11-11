# BUILDER-DECISIONS-REVIEW.md — what the W1 builder decided and why

> **Read this if you are about to amend the spec or change a structural decision in W2+.**
> The pattern: every W item that changes the spec writes one short paragraph here.

## W1 — 2026-08-05

### Decision 1 — Removed the `BACKEND` ZS marker from the spec header

**What changed.** The original SPEC.md had four `<!-- ZS:KEY:VALUE -->` markers in its header:
`COMPLEXITY`, `PLATFORM`, `LANGUAGE`, `BACKEND`. The kit's validator (`tins-kit/scripts/validate.mjs`)
allows only the first three — it fails on any unknown key. Fix: replaced the `BACKEND` line with a
plain HTML comment that says "Backend: Supabase Postgres (recorded in §0.2 D1; not a ZS marker because
the kit's validator only allows COMPLEXITY / PLATFORM / LANGUAGE)."

**Why.** TINS rule: the spec must pass the kit's validator without modifying the kit. The kit
hardcodes the allowed ZS keys as a defensive measure (unknown keys = typos). Removing the marker
loses nothing — the "Supabase is the backend" decision is already in `§0.2 D1` and `§4.1`. The ZS
markers are a machine-readable index, not a documentation surface.

**Impact on downstream.** None. The validator now reports "all ZS: keys are known". Future
Jayshankar sessions don't see `BACKEND` in the header but find the same info in D1.

### Decision 2 — The seed inserts users with `ON CONFLICT (id) DO NOTHING`, not via the `handle_new_user` trigger

**What changed.** The seed has fixed UUIDs for the 3 demo users (`a0000000-…-001`, `-002`, `-003`).
The trigger on `auth.users` (`handle_new_user`) would, on the first `auth.users` insert, create a
`public.users` row with `role='admin'` (because the count is 0); on the second and third, it would
default to `'worker'`. The seed instead inserts the 3 `public.users` rows directly with `ON CONFLICT
(id) DO NOTHING`, and the matching `auth.users` rows are created via the Supabase admin API (out of
band, in `helpers/seed-users.mjs` — to be written in W2 when the auth layer is built).

**Why.** Two reasons:
1. The trigger's "first user is admin" rule is for self-signup, not for the seeded demo. The seed
   wants specific roles for specific users.
2. Idempotency: if `auth.users` is created before the seed runs, the trigger fires once for each
   user. The seed then has to UPDATE the resulting `public.users` rows. `ON CONFLICT DO NOTHING` on
   the seed insert is the cleaner pattern: the seed's INSERT is the source of truth for
   `public.users`; the trigger is the safety net for production signups.

**Impact on downstream.** `helpers/seed-users.mjs` is a W2 task. Until that script is written, the
seed leaves 3 `public.users` rows with no matching `auth.users`. RLS still works (the rows exist);
login is blocked until the auth rows are created.

### Decision 3 — Idempotency on `movements` is enforced by an idempotency guard, not by a unique constraint

**What changed.** `movements` has no natural unique key (a `movement_group_id` groups cascaded
movements, but two spoilage events at the same time on the same SKU are valid). Adding a unique
constraint would over-constrain. Instead, the seed uses a top-level `do $$ … if (select count…)
>= 25 then return; end $$;` guard, and the 5+ static `INSERT … ON CONFLICT (col) DO NOTHING`
clauses cover the `users`, `vendors`, `skus`, `locations`, and `price_history` tables.

**Why.** The cleanest way to make `movements` and `batches` idempotent is the guard, not the
constraint. A second seed run finds the SKUs already populated and exits. This matches the
exam-forge pattern (an idempotency `INSERT` with `WHERE NOT EXISTS`).

**Impact on downstream.** Re-running the seed on a partially-seeded DB (e.g. vendors in but no
movements) will re-execute the movement loops and try to insert duplicate batches. The `batches`
table has no unique constraint on the (sku, location, delivered_at) tuple — per SPEC §4.2.5 — so
duplicates would be created. Mitigation: the guard checks `skus` count; if the user has run the
movement loops at all, the SKU count is 25 and the guard fires. The "partial seed" case is not
expected in the W1 demo flow.

### Decision 4 — Bumped the transfer loop to 52 to clear the §8.5b "150+ movements" bar

**What changed.** The spec's App A.4 says "~150 movements", broken down as 28 + 50 + 50 + 20 = 148.
The acceptance criterion §8.5b says "150+ movements". I bumped the transfer loop to 52 (was 50)
so the total is 150 exactly. The transfer count is in the spec's range ("2-4 transfers per day,
totalling ~50") and the 28 deliveries + 52 transfers + 50 sales + 20 spoilage = 150 is a cleaner
round number for the demo.

**Why.** The validator checks `>= 150`. The original 148 would fail. Bumping transfers by 2 is the
least-disruptive fix; the alternative (bumping sales to 52) would change the customer mix. Logged
in the seed's comment so a future session knows the deviation.

**Impact on downstream.** None. The transfer count in the dashboard widget shows "52 transfers
over 14 days" instead of "~50". Aesthetically identical.

### Decision 5 — The validator's "9 expected tables" check is hard-coded, not derived from the spec

**What changed.** `scripts/validate.mjs` has `const EXPECTED_TABLES = ['users', 'locations',
'vendors', 'skus', 'batches', 'movements', 'sales', 'price_history', 'audit_log'];`. It does not
parse the spec to derive this list.

**Why.** The kit's pattern is "the validator checks the artefact, not the spec." A consumer
validator that parses the spec to derive its own checks is fragile (spec changes, validator
behaves unexpectedly). The 9-table list is the V1 truth; a future migration that adds a table
(SPEC §9 anti-pattern, but Mode C may add one) will require updating the validator's list
explicitly. That is intentional friction.

**Impact on downstream.** Future migrations that add or rename a table must update
`EXPECTED_TABLES` in the validator. The validator's output names the missing table by name, so
the failure is loud.

### Decision 6 — The validator parses `seed.sql` with regex, not by running it against a real DB

**What changed.** Every Jayshankar-specific check (idempotency, vendor count, movement loop
bounds, audit trigger attachment) is a static regex over the SQL file, not a live DB query.

**Why.** The kit's pattern is "the validator runs before `npm install`" — no DB needed. A
validator that needs Postgres to run is a validator that needs a Supabase project to run, which
contradicts the W1 design (the project is not yet created). Static checks are a useful floor;
live DB checks are a separate `npm run validate:db` (to be added in W1.5 when the Supabase
project exists).

**Impact on downstream.** The static checks catch the structural errors (missing tables, wrong
counts, missing idempotency). They do NOT catch semantic errors (a CHECK constraint that allows
the wrong range, an RLS policy that grants the wrong role). A live-DB validation step is the
W1.5 work.

### Decision 7 — The RLS file has a separate `rls-policies.sql`, not bundled in `0001_init.sql`

**What changed.** The RLS policies are in a separate file, applied after the migration. The
migration creates the tables and functions; the RLS file enables RLS and creates the policies.

**Why.** RLS policies reference `public.current_user_role()`, a function that's not strictly
required by the migration. Splitting the file lets a future migration add a new table without
having to also re-issue the RLS policies. It also makes the RLS rules easier to audit (a
reviewer reads `rls-policies.sql` and sees every policy in one place).

**Impact on downstream.** The user must apply both files (`0001_init.sql` then `rls-policies.sql`)
when setting up a new Supabase project. The W1.5 task list will document this; for now the
`validate.mjs` runs both files independently.

### Decision 8 — Drop the FK on `public.users.id → auth.users(id)`; integrity via triggers

**What changed.** The original `0001_init.sql` had `id uuid primary key references auth.users(id)
on delete cascade` on `public.users`. The seed inserts `public.users` rows with fixed UUIDs
(`a0000000-0000-0000-0000-000000000001` for admin, etc.) but the matching `auth.users` rows
do not exist yet (the user creates them later via Supabase Auth UI). The FK violation
(`23503: insert or update on table "users" violates foreign key constraint "users_id_fkey"`)
blocked the seed.

**Why drop the FK.** The `handle_new_user()` AFTER INSERT trigger on `auth.users` is the
actual source of truth for the auth→public mapping. It inserts a matching `public.users`
row when a new `auth.users` row is created via signup. The FK is redundant — and worse, it
creates a chicken-and-egg: to insert `public.users(id=X)` you need `auth.users(id=X)`, but to
create `auth.users(id=X)` you need to go through the trigger (which would create the public
row, but only for the `id` Supabase Auth generates, not for a UUID you choose).

**The fix.**
1. `public.users.id` is now `uuid primary key` (no FK).
2. `handle_new_user()` (existing) creates `public.users` rows on `auth.users` INSERT.
3. New `handle_user_delete()` AFTER DELETE trigger on `auth.users` removes the matching
   `public.users` row (so deleting an auth user no longer leaves an orphan).
4. The validator adds two new checks: `js-handle-del-trg` (trigger exists) and `js-noauthfk`
   (the FK is intentionally absent). This pins the design — a future contributor who
   re-adds the FK will fail the gate.

**Impact on downstream.** The seed now runs cleanly. The 3 fixed UUIDs in the seed are
"best-effort" placeholders; in production, the `handle_new_user` trigger creates the
public rows with the auth user's actual UUID. The seed can be used for demo / testing
without involving Supabase Auth.

**This is also a kit-level lesson.** The pattern "drop the FK, use triggers for auth→public
mapping" is non-obvious and any Supabase consumer with a seed would hit the same bug. The
next kit iteration (W2) should ship this as `tins-kit/lib/patterns/supabase-auth-trigger.md`.

### Decision 9 — Migrate Supabase API key naming: `anon` / `service_role` → `publishable` / `secret`

**What changed.** All four Surfaces now use Supabase's new key-naming convention (the one
shipped with `@supabase/server`):
- `.env.example` documents `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `SUPABASE_JWKS_URL` (the JWKS URL is new — used by `@supabase/server` for JWT verification).
- `scripts/seed-auth-users.mjs` reads `SUPABASE_SECRET_KEY` (it does **not** fall back to
  the old `SUPABASE_SERVICE_ROLE_KEY` name — silently accepting both would mask config drift).
- `scripts/validate.mjs` `js-env-example` check now greps for `SUPABASE_SECRET_KEY`.
- `SPEC.md` §3.2 (Secrets table row) reflects the new names.
- `docs/SUPABASE-SETUP.md` rewritten to point at the new **API Keys** panel.
- `AGENTS.md` standing rule #4 updated (paraphrased the old name for grep continuity).

**Why.** `service_role` and `anon` are still accepted at the API level, but Supabase's current
docs and the `@supabase/server` package use the new names. "Secret" is a clearer name than
"service_role" for a key that bypasses RLS. Going forward in W3+ (the app build) we want
the docs and the runtime env to match — the next person to read `@supabase/server`'s
README shouldn't have to mentally translate `service_role` to `secret`.

**Trade-off accepted.** The old `service_role` name was already embedded in operator
muscle memory. We're choosing the forward-looking surface and committing to it. If a
contributor pastes the old name into `.env` they get a clean error from `seed-auth-users.mjs`
("SUPABASE_SECRET_KEY must be set") — no silent fallback.

**Validator stays green.** 66/66 checks pass. Selftest 9/9. The change is content-only,
not structural.

**Kit-level implication.** `tins-kit/lib/patterns/supabase-auth-trigger.md` (planned W2)
should also recommend the new naming, and `scripts/seed-auth-users.mjs.template` (planned
W2) should ship already on the new names — no one will hit the legacy naming through the
kit's quickstart.

### Decision 10 — `handle_new_user()` must read role + display_name from `NEW.raw_user_meta_data`

**What changed.** New migration `0002_handle_new_user_meta.sql` replaces the
`handle_new_user()` function. The new body:
1. Reads `role` and `display_name` from `NEW.raw_user_meta_data` (jsonb) if present.
2. Falls back to the SPEC §2.2.2 first-user-becomes-admin rule if the meta is missing
   or invalid.
3. Synthesizes a display_name from the email local-part if no meta was supplied
   (guarantees NOT NULL — the original bug).

**Why.** W1.5 first-apply failed with `SQLSTATE 23502: null value in column "display_name"
of relation "users" violates not-null constraint`. The original `handle_new_user()` only
inserted `(id, email, role, created_at)` — it never set `display_name`, which is NOT NULL.
The 3 seed-auth-users.mjs calls all rolled back: 0 created, 3 failed.

**The seed script was also implicated.** `seed-auth-users.mjs` was sending
`user_metadata: { role, display_name }` in the Admin API call, but the trigger never read
`raw_user_meta_data`, so the supplied values were ignored. Now they flow through.

**The validator pins the design.** New check `js-handle-new-user-meta` greps the migration
text for `raw_user_meta_data` inside the `handle_new_user()` function body. A future
contributor who simplifies the trigger back to "insert without meta" fails the gate.
**The validator now reads all migrations in `supabase/migrations/`** (concatenated in
lexical order), not just `0001_init.sql`. This matches the live apply (Supabase CLI
applies them in order) and means future migrations (W3+) get checked too.

**Impact on downstream.** The seed now works against a live Supabase project. The
`handle_new_user()` trigger still does the right thing for UI-driven signups (no meta
supplied → first user becomes admin, subsequent become worker, display_name synthesized
from email). Idempotent: re-running 0002 is a no-op (CREATE OR REPLACE).

**What the user has to do.** Same reset → apply → seed flow, but the apply list is now
**4 files** (0001, 0002, rls, seed), not 3. `docs/SUPABASE-SETUP.md` step 3 is updated.

**Kit-level implication.** `tins-kit/lib/patterns/supabase-auth-trigger.md` (planned W2)
must lead with this: "if your `public.users` table has a NOT NULL field that the trigger
doesn't set, the trigger will fail to insert and roll back the auth.users INSERT. Read all
fields from `raw_user_meta_data` with a fallback." This is the second hard lesson from
W1.5 (after the FK drop in decision 8).

### Decision 11 — `service_role` needs explicit GRANTs on `public.*` (BYPASSRLS is not enough)

**What changed.** New migration `0003_grant_service_role.sql` GRANTs `service_role` the
table-level privileges (SELECT, INSERT, UPDATE, DELETE) on all tables, sequences, and
functions in `public`, plus ALTER DEFAULT PRIVILEGES so future tables also inherit them.

**Why.** W1.5 second-apply failed with `SQLSTATE 42501: permission denied for table users`
on the PATCH step. The 3 auth.users inserts had succeeded (the 0002 fix worked), but
`seed-auth-users.mjs` couldn't PATCH `public.users.role` because `service_role` had
BYPASSRLS but no table-level GRANTs. BYPASSRLS bypasses policies; it does not bypass the
table-level privilege check. The seed.sql works because it runs in the SQL Editor as
`postgres` (the schema owner); the script runs as `service_role` (a different Postgres
role).

**Why GRANT all on all tables** (not per-table). The script will need INSERT/UPDATE on
several tables (batches, movements, sales for W3+; users for W1.5). Granting per-table
means remembering to update the migration every time we add a table. The
"grant all on all tables" form + ALTER DEFAULT PRIVILEGES is forward-safe and matches
the Supabase-recommended pattern for service_role privileges.

**The validator pins the design.** New check `js-grant-service-role` greps for any GRANT
to service_role. The check is satisfied by per-table GRANTs, the schema-wide form, OR
ALTER DEFAULT PRIVILEGES — any of them is enough.

**Impact on downstream.** The user does NOT need a full reset for this one. 0003 is
additive (just GRANTs). Re-running `seed-auth-users.mjs` will now PATCH the 3 existing
public.users rows with the correct role/display_name. The script is idempotent — same
result as a fresh apply, no need to delete and recreate.

**What the user has to do.** Just run 0003 in the SQL Editor (no reset), then re-run
`seed-auth-users.mjs`. Expect "0 created, 3 updated, 0 failed."

**Kit-level implication.** This is the **third** hard Supabase lesson from W1.5:
1. Decision 8: drop the FK, use triggers
2. Decision 10: trigger must read every NOT NULL field
3. Decision 11: service_role needs GRANTs (BYPASSRLS ≠ GRANT)

The `tins-kit/lib/patterns/supabase-auth-trigger.md` (planned W2) should ship with all
three bundled, and the kit's `scripts/seed-auth-users.mjs.template` should include the
GRANTs migration inline so kit users can't hit the same wall.

### Decision 12 — W2 auth flow: sign-in only, no sign-up (for the gatekeeper demo)

**What changed.** W2 ships a sign-in form only. No "create account" flow. The 3 demo
users (`admin@`, `rep@`, `worker@jayshankar.demo`) are pre-created via
`scripts/seed-auth-users.mjs` (W1.5 deliverable). New users can only be added by an
admin via the Supabase Dashboard (or, in Pilot/Production, by an admin user from
within the app).

**Why.** The gatekeeper demo is for the wholesaler to see the app, not to onboard new
users. Sign-up would:
1. Create a 4th auth.users row that we don't have a `public.users.role` for (the
   trigger defaults to `'worker'`, which is wrong for a new admin).
2. Add a "first sign-up becomes admin" branch (SPEC §2.2.2) that the trigger already
   handles, but in W2 we don't yet have an admin UI to promote a worker to admin. The
   first sign-up via the app would be auto-admin, which is fine for the seed
   (Karthik is the first user) but surprising for any demo session.
3. Add a flow we'd have to test, gate, and document. The SPEC's "first sign-up
   becomes admin" pattern is already implemented in the trigger; we don't need to
   build a UI for it on Day 1.

**Impact on downstream.** W2 has fewer components (no sign-up form, no email-confirm
flow, no "forgot password" flow). The user can be added in Pilot/Production mode
when the wholesaler is onboarding real staff. The 3 demo users cover all 3 roles
for the demo.

**Sign-up flow when needed:** add a `<SignUpForm>` component, route it at
`/sign-up`, and gate it with an admin-only middleware (a `useRequireRole('admin')`
hook that redirects to `/admin` if not admin). Out of scope for W2.

### Decision 13 — Phone OTP for workers is deferred to Pilot mode

**What changed.** SPEC §0.2 says "Auth: Supabase Auth (email/password + phone OTP)."
W2 ships email/password for all 3 roles. The 3 demo users are all on email/password
(matches the W1.5 seed-auth script). Phone OTP is a Pilot/Production concern.

**Why.** The demo runs on the dev machine in a browser. The wholesaler demoing
doesn't have real phones to receive OTPs. The 3 demo users we need are already
created with email/password by `seed-auth-users.mjs`. Phone OTP would:
1. Require a Twilio integration (cost: per-SMS) or Supabase's built-in SMS provider
   (also cost).
2. Add a flow the demo doesn't need.
3. Be redundant with the existing email/password for the gatekeeper demo.

**Impact on downstream.** `supabase.auth.signInWithOtp` is not implemented in W2.
The sign-in form is `signInWithPassword` only. In Pilot/Production, when the
wholesaler onboards real workers with real phones, the sign-in form will get a
"Sign in with phone" tab that uses `signInWithOtp`. SPEC §3.5 mentions phone
OTP, so the validator doesn't need to change — the spec is the source of truth,
and the spec is unchanged.

**Why not just build both.** W2 is 2-3 hours. Building email + phone in that time
means neither is well-tested, and the demo doesn't need phone. The deferral
preserves the SPEC's intent (phone OTP is a real flow when needed) without
over-investing in the demo.

**When this changes.** Pilot mode begins. The wholesaler has real workers with
phones. A new W item in the Pilot-mode work queue adds the phone-OTP flow. The
trigger already accepts phone numbers (the `phone` column on `public.users` is
optional), so the migration is just a sign-in UI change.

### Decision 14 — Frontend scaffold: hand-written, not `npm create vite@latest`

**What changed.** W2 ships 12 hand-written files: `package.json`, `tsconfig.json`,
`vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`,
`.env.example`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, plus the lib/
components/pages/. `npm create vite@latest` was NOT used.

**Why.** `npm create vite@latest` produces a project that:
1. Ships `@types/node` (we don't need it; Vite handles the runtime).
2. Ships a 2-tsconfig setup (`tsconfig.json` + `tsconfig.node.json` with project
   references) that's correct for big apps but over-engineered for V1.
3. Doesn't ship Tailwind, so we'd add it on top anyway.
4. Ships the React + TS logos and counter demo, which we'd delete.

The hand-written scaffold:
1. Uses the exact dependency set in SPEC §4.1 (Vite 5, React 18, TS 5, Tailwind 3,
   Supabase JS 2, react-router-dom 6, react-query 5). No `lodash`, no `dotenv`,
   no `moment`, no `axios` (per SPEC §3.5 forbidden list).
2. Uses HashRouter (per SPEC §0.2 / §4.1) — `npm create vite@latest` doesn't
   pick a router, so we'd add it either way.
3. Has the role-based router baked in from the start (no "add react-router later"
   refactor).
4. Total file count: 12 (vs ~15 from the scaffolder, before the unnecessary
   ones are deleted).

**Trade-off accepted.** We lose the "official Vite template is the default"
boilerplate. We gain: zero `npm create` output to clean up, no leftover
counter-demo to delete, no logo to remove, the locked stack enforced by
the package.json we wrote (not the one the scaffolder picked).

**Impact on downstream.** The repo is clean. `npm install` + `npm run dev` works
out of the box. New contributors see a focused repo, not "Vite + our customisations
on top." If the user wants a different default (e.g. switch to wouter, switch
to Bun), one file changes (`package.json` + `src/main.tsx`).

### Decision 15 — Router choice: `react-router-dom` (not wouter)

**What changed.** SPEC §4.1 says "wouter (or `react-router-dom` with `HashRouter`)";
W2 picks `react-router-dom` 6.x.

**Why.** `react-router-dom` has more documentation, more Stack Overflow answers,
and is more familiar to the user (per their profile: Node.js/React basics). The
bundle size difference (~3 KB gzipped) is irrelevant for an internal B2B app.
`wouter` is smaller but the docs advantage of `react-router-dom` wins for a
2-3 hour build where the user is doing the verification.

**Trade-off accepted.** ~3 KB more in the bundle. We don't load wouter's docs
in our heads.

**Impact on downstream.** If the user later wants wouter, the migration is ~10
lines in `src/main.tsx` + `src/App.tsx`. The role-based routing logic is router-
agnostic; only the imports change.

### Decision 16 — `authenticated` (the browser role) needs GRANTs too, not just `service_role`

**What changed.** New migration `0004_grant_authenticated.sql` (and the parallel
`0003_grant_authenticated.sql` in the kit pattern) that GRANTs `authenticated`
the same privileges as `service_role` got in decision 11. Added the
`js-grant-authenticated` validator check. Updated `docs/SUPABASE-SETUP.md`
with the 6-file run order and the new error row. Updated the kit pattern
(`tins-kit/lib/patterns/supabase-auth-trigger.md`) to include this as
Lesson 4 and to renumber its file sequence (File 3 = GRANT_authenticated,
shift the others down by 1).

**Why.** W2 first try: the user could sign in (the publishable key + auth.uid()
worked), but the very next call — `useSession`'s `from('users').select(...)`
in `src/lib/auth.ts` — failed with `SQLSTATE 42501: permission denied for table users`.
Same error as decision 11, different role. The browser code (with a signed-in
user) runs as `authenticated`, not `service_role`. The W1.5 0003 only GRANTed
to `service_role`; the publishable key didn't get any GRANTs.

**Why default Supabase GRANTs aren't enough.** A fresh Supabase project has
`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,
authenticated, service_role` set up by the project init. So in a fresh
project, `authenticated` gets GRANTs automatically. But:
- If the project was created with a custom schema setup, the defaults may
  not be there.
- If the `public` schema was dropped and recreated (the W1.5 reset recipe),
  the defaults may have been lost.
- If the project was upgraded from a pre-2024 Supabase version, the defaults
  may not include `authenticated`.

So we can't rely on the defaults. The pattern is: explicitly GRANT to both
`service_role` AND `authenticated` in your migration.

**The validator pins the design.** New check `js-grant-authenticated` greps for
any GRANT to `authenticated` in the migration text. A future contributor who
adds a new table but forgets the GRANT will fail the gate. The check
co-exists with `js-grant-service-role` from decision 11.

**Impact on downstream.** The user does NOT need a full reset for this one.
0004 is additive (just GRANTs). After applying it, refresh the browser tab
and Check 1 should pass.

**What the user has to do.** Just run `0004_grant_authenticated.sql` in the
SQL Editor (no reset needed), then refresh the browser. The useSession
`from('users').select(...)` will now succeed.

**Kit-level implication.** This is the **fourth** hard Supabase lesson from
W1.5+W2:
1. Decision 8: drop the FK, use triggers
2. Decision 10: trigger must read every NOT NULL field
3. Decision 11: service_role needs GRANTs (BYPASSRLS ≠ GRANTs)
4. Decision 16: authenticated needs GRANTs too — and the default
   `ALTER DEFAULT PRIVILEGES` on the `public` schema isn't reliable enough
   to omit the explicit GRANT.

The kit pattern now has all 4 bundled. The recommended migration sequence
is 4 files (0001 + 0002 GRANTs_service + 0003 GRANTs_authenticated +
your-migration), and the run order in `docs/SUPABASE-SETUP.md` reflects this.

### Decision 17 — Role drives the shell, not the URL (W2 routing fix)

**What changed.** `src/App.tsx` was rewritten so the routing is role-driven
via a `Shell` wrapper component. Each route (`/admin`, `/rep`, `/floor`)
checks the user's role and:
- if it matches → render the dashboard
- if it doesn't match BUT the role is a known role → redirect to the role's
  home shell (e.g. vendor-rep on `/#/admin` → redirect to `/#/rep`)
- if the role is unknown → render "Not allowed" (instead of redirecting,
  to avoid an infinite loop when `defaultRouteFor` falls through to /admin)

**Why.** The user's first W2 test cycle surfaced this: after signing out
from Karthik (admin, on `/#/admin`) and signing in as Anitha (vendor-rep),
the URL stayed at `/#/admin` and Anitha saw the "Not allowed" banner
instead of being routed to `/#/rep`. The role-URL mismatch was treated as
an error to display rather than a navigation problem to solve.

**The deeper cause.** Sign-out clears the session but doesn't navigate —
the URL is preserved. So the next signed-in user inherits the previous
user's URL. If their role doesn't match, they're stuck on a forbidden page
with no clear way back (the original "Not allowed" banner had a "go to
your home page" suggestion, but the link didn't actually navigate).

**The fix in 6 lines.** The `Shell` component wraps each route. It does
the role check; on mismatch with a known role, it returns a `<Navigate>` to
the role's home. The "Not allowed" path is now only reached for genuinely
unknown roles (which don't happen in the W2 3-role world).

**Impact on downstream.** The W2 manual verification Check 2 step 4
("try navigating to /#/admin as rep") now passes by redirecting to /#/rep
instead of showing "Not allowed". The role drives the experience; the URL
is just a bookmark.

**Why "role drives the shell" not "URL drives the shell".** SPEC §0.2
says "first sign-up becomes admin" and D3a says "vendor-rep and worker
share a layout". The app is role-centric, not URL-centric. A user
shouldn't need to know their own URL — they sign in, they get their
shell. Bookmarks and deep links are a Pilot/Production concern (out of
scope for W2 per SPEC §9).

**When this changes.** Pilot/Production: add real deep links for the
admin's audit log view, the rep's delivery form, etc. The `Shell` design
keeps that work additive — add the new routes inside the role-specific
shells, the role check still gates the URL.

### Decision 18 — FIFO is application-level (in TypeScript), not database-level

**What changed.** W3 ships the 4 mutation functions in `src/lib/mutations.ts`.
Each does the FIFO read at the application level:

1. Query `batches` for the oldest available (`order by delivered_at asc, id asc`)
   with `kg_remaining > 0` for the requested (sku, location).
2. Insert the right rows: a new batch for delivery/transfer, a sale row for sale,
   just a movement for spoilage.
3. The `apply_movement_to_batches` trigger (decision from 0001_init.sql) updates
   `kg_remaining` for the source batch.

**Why application-level.** The migration's `apply_movement_to_batches` trigger
only handles the single-batch case (one movement, one source batch). Multi-batch
FIFO cascade (a 200 kg sale that needs to draw from 4 batches) was always
specified as application-level (the comment in the migration says: "The cascade
(multi-batch) is application-level"). W3 implements the single-batch fill, which
is what the demo needs.

**The cascade in W3:** `recordSale(input)` finds the oldest batch, deducts up
to its `kg_remaining`, inserts a sale row + 1 movement. If the sale is larger
than the oldest batch's stock, the sale is recorded for the oldest's full
amount and the user is told about the shortfall. They can submit again to draw
from the next-oldest batch.

**Why not a Postgres function.** A `record_sale_cascade(sku, location, kg)` PL/pgSQL
function with `SELECT ... FOR UPDATE` and a loop would be the "right" way — it
would be atomic, race-condition-proof, and handle the multi-batch cascade. But
for the W3 demo (single user on a dev machine, demo data), the application-level
read works fine. Moving to a Postgres function is a Pilot-mode work item.

**Impact on downstream.** W3 has working FIFO for the single-batch case. The
multi-batch cascade is a known limitation documented in `docs/W3-MANUAL-VERIFICATION.md`
under "Known W3 limitations".

### Decision 19 — No race-condition protection in W3 (Pilot fix: Postgres function with FOR UPDATE)

**What changed.** The mutations in `src/lib/mutations.ts` do a `select` then an
`insert` without any locking. Two concurrent operations on the same (sku, location)
might both read the same oldest batch and both try to deduct from it. The trigger's
`kg_remaining = kg_remaining - new.kg` then races; one operation could end up
"selling" more kg than existed in the source batch.

**Why no fix in W3.** The demo runs on a dev machine with a single user. Race
conditions can't happen with one user clicking forms one at a time. The Pilot
mode has multiple users on the floor simultaneously (workers recording spoilage
while a rep records a sale) — that's when race conditions become real.

**The fix (Pilot work item).** Move the FIFO + insert into a Postgres function
that does:
```sql
select * from batches where ... for update;  -- lock
insert into sales ...;
insert into movements ...;
```
The `FOR UPDATE` lock is released at end of transaction. Two concurrent calls
serialise. Multi-batch cascade falls out of this naturally (loop until sale is
filled, insert N movements).

**Impact on downstream.** The W3 demo works. Pilot/Production needs the
Postgres function — the RLS works (decision 16) but the FIFO algorithm is
not concurrency-safe at the application level. Documented in the W3 manual
verification doc.

### Decision 20 — Native HTML inputs + React state, no react-hook-form

**What changed.** W3 ships the 4 forms using `<input>` and `<select>` elements
with `useState`. No form library (no react-hook-form, no formik, no final-form).

**Why.** 4 forms, each with 4-7 fields, all the same pattern (vendor/sku/location
+ kg + price/notes). The total amount of form state per form is small. A form
library would add ~10 KB to the bundle (react-hook-form is ~9 KB minified) for
a feature we don't need: array field management, async validation, complex
multi-step forms, dynamic field arrays. None of that is in W3's requirements.

**Trade-off accepted.** More verbose form code (each input has its own `useState`,
each onChange handler). We deduplicate via `FormField`, `TextInput`, `FormError`,
`FormSuccess` wrappers in `src/components/FormFields.tsx`. The form code reads
top-to-bottom, the validation is HTML5-native (required, type=number, min, max,
step), and the submit handler is one async function per form. If a future W item
needs complex form behaviour (multi-step wizard, conditional fields based on
other fields, server-side validation feedback inline), we can add
react-hook-form then.

**Why not Zod either.** Zod is great for runtime validation of API boundaries.
The forms here validate at the HTML5 level. The Supabase REST API does type
validation on its end (the `numeric(10,3)` constraint on `kg` is enforced by
Postgres). The browser form just needs to be "obviously correct to the user" —
the validation happens at the database. A form that says "kg must be a number"
and lets the browser enforce it is enough for W3.

**Impact on downstream.** The 4 forms are ~80-120 lines each, all of them
read like the SPEC's algorithm spec. A new contributor can read `SaleForm.tsx`
and understand what it does without learning a form library. If W4+ needs
complex forms, we adopt react-hook-form; until then, this is enough.

### Decision 21 — W3 first-try: SKUs column mismatch (`name` vs `english_name`)

**What changed.** W3 first try surfaced this: the `skus` table has columns
`english_name` and `tamil_name` (Tamil-first naming per SPEC), NOT a `name`
column. The form's `SkuSelect`, plus the Rep/Floor/Admin dashboards' SKU
queries, all selected `from('skus').select('id, code, name')` — wrong column.
The query returned `400 Bad Request` with `column skus.name does not exist`,
React Query set `data` to `null`, and the SKU dropdowns rendered empty. The
"unable to select" the user reported was a dropdown with no options.

**The fix.** All 5 query sites now select `english_name, tamil_name` (4 sites
just need `english_name`; the dropdown only renders `english_name` for the
demo — Tamil is a Pilot localisation). All 4 render sites updated to use
`s.english_name`. The AdminDashboard's `default_shelf_life_hours` (a
non-existent column) replaced with `shelf_life_hours` — the SKUs table on the
admin dashboard had been silently failing since W2.

**Bonus fix in the same PR:** the `FormField` wrapper didn't pass its `id`
down to the child select. `document.querySelector('#sku')` returned `null` —
not the cause of the empty dropdown, but a separate accessibility/debug issue.
The form now passes `id` explicitly to each select (4 forms updated). The
`<label htmlFor>` association was already correct via the form's `id` prop.

**Why this slipped past W2.** In W2, the rep/floor dashboards showed
"SKUs (...)" — the `...` placeholder meant the query was loading or had
returned an error, but the user didn't catch it because the rest of the
dashboard (vendors table, stat cards) worked fine. The empty SKU list looked
like a loading state, not a failure. The bug only became visible when the
W3 form REQUIRED a SKU selection (no fallback, no skip).

**The validator doesn't catch this.** The validator checks SPEC.md content,
SQL schema, and setup artefacts. It doesn't introspect the React code for
"did you remember the actual column names." A type check (TypeScript) would
have caught the `s.name` access on a `Sku` interface that doesn't define
`name` — but I was loose with the interface (just `{ id, code, name }`
everywhere). The new interfaces all use `english_name` correctly.

**Impact on downstream.** A future contributor copy-pasting the SKU query
pattern would hit the same bug. A linter rule ("PostgREST response columns
must match the table schema") would catch it; that's a Pilot-mode work item.
For W3, the diagnostic is: "dropdown is empty → paste the query in DevTools
console, look for `column X does not exist`."

**Kit-level implication.** The `tins-kit/templates/SPEC.md` should call
out the column-naming convention (Tamil-first for the fish app, English-first
for most apps) so future TINS consumers don't assume `name` exists. Pilot
work item.

### Decision 22 — W3 second-try: more column mismatches in the React code

**What changed.** The Delivery form's insert was sending
`expected_shelf_life_hours` to the `batches` table, which doesn't have that
column — the schema has shelf life on `skus` (`shelf_life_hours`) and the
batch's `expires_at` is implicit. The Floor dashboard's active-batches query
selected `received_at` (column is `delivered_at`) and `expires_at` (column
doesn't exist). The user's delivery submit failed with
`Could not find the 'expected_shelf_life_hours' column of 'batches' in the schema cache`.

**The fix.**
- `recordDelivery` no longer sends `expected_shelf_life_hours`. The shelf
  life input is removed from the DeliveryForm (W3 ships without per-batch
  shelf-life override; the SKU's shelf life is the canonical one).
- FloorDashboard's active-batches query now selects `delivered_at` (not
  `received_at`) and drops `expires_at` from the SELECT. The dashboard
  computes `expires_at` in JavaScript as `delivered_at + skus.shelf_life_hours`
  via a small `expiresAt(batch)` helper.

**Why this is the second W3 column mismatch in a row (decision 21 was the
first).** Both W2 and W3 wrote React code that *guessed* column names rather
than reading the migration. The migration's `0001_init.sql` is the source of
truth, but I wrote the React queries from memory of what the schema "should
look like" instead of grepping the migration first. This is the
"AI-augmented engineer" failure mode: confident, plausible, wrong.

**The deeper cause.** I have no compile-time link between the migration
files and the React code. TypeScript would catch `s.name` vs `s.english_name`
if the `Sku` interface were auto-generated from the Supabase schema
(`supabase gen types typescript` per SPEC §0.2). I haven't run that yet
because the project doesn't have the Supabase CLI configured, and the spec
generator requires a live database. Pilot work item: run `supabase gen types
typescript --linked` once at the start of every W item, commit the
generated `src/types/database.ts`, and have every React file import its
row types from there. That kills this class of bug at compile time.

**Impact on downstream.** W3 is now column-clean. The W2/W3 lesson: "the
migration is the source of truth" is true at the spec level, but the React
code needs an enforced link (typegen) to make it true at the type level.
Pilot-mode work item.

**Kit-level implication.** `tins-kit/SPEC.md` should call out the typegen
step as part of every consumer's W0 (project setup). The `seed-auth-users.mjs.template`
already uses fetch + manual types because it's zero-dep, but the React code
can use typegen without losing the zero-dep discipline on scripts/.

### Decision 23 — Transfer moved to a SECURITY DEFINER Postgres function

**What changed.** W3 first try surfaced a RLS bug: a worker trying to record
a transfer hits `new row violates row-level security policy for table "batches"`
because the destination batch insert is denied (the `batches_insert_rep` policy
only allows admin/vendor-rep/super-worker). The fix is a SECURITY DEFINER
function `record_transfer_cascade(sku, from_loc, to_loc, kg, notes)` in
migration `0005_record_transfer_cascade.sql`. The function bypasses RLS
(runs as the function owner, `postgres`), so any authenticated caller can
record a transfer. The function is also the right place for the FIFO +
2-insert atomicity, so it uses `SELECT ... FOR UPDATE` to serialise
concurrent transfers of the same source batch (decision 19's planned fix,
pulled forward).

**The fix in src.**
- `src/lib/mutations.ts` — `recordTransfer` now calls
  `supabase.rpc('record_transfer_cascade', { p_sku_id, p_from_location_id, p_to_location_id, p_kg, p_notes })`.
  The function returns `{ destination_batch_id, movement_group_id, shortfall, error? }`.
- `src/components/RecentActivity.tsx` — `locName` now uses `display_name ?? name`
  so the activity table shows the same label the LocationSelect dropdown shows
  (consistency fix — the user noted that the dropdown said "Storage (main cold
  room)" but the activity table said "Storage").

**The migration.** `0005_record_transfer_cascade.sql` is additive (no reset).
The function body:
1. `SELECT ... FOR UPDATE` on the oldest source batch — serialises with any
   other transfer/sale/spoilage that might pick the same source.
2. Inserts a new destination batch carrying over `vendor_id` and `price_per_kg_paid`
   from the source (so the cost lineage is preserved).
3. Inserts a `transfer` movement (the existing `apply_movement_to_batches` trigger
   decrements source.kg_remaining atomically).
4. Returns the new batch id, movement group id, and any shortfall.

GRANT EXECUTE on the function to `authenticated` so workers and vendor-reps
can call it. RLS on the underlying tables is unchanged (still applies to
direct queries).

**Why this is the right home, not the validator.** The validator got a new
check `js-record-transfer-cascade` that greps for the function definition
(so a future contributor can't remove it without failing the gate). The actual
work — RLS bypass + atomic FIFO — happens in Postgres, not the React code.
This is the difference between "the validator checks we have the right
primitives" and "the validator does the work."

**Impact on downstream.** W3 transfer now works for all roles. The Pilot
checklist (decision 19) moves closer to zero: the FIFO read with FOR UPDATE
that the function does is the Pilot-grade race-condition protection. The
multi-batch cascade (a sale of 200 kg that spans 4 batches) is still the
next W item — that one needs a `record_sale_cascade` sibling function.

**Kit-level implication.** The pattern "RLS denies an insert the app needs to
make, so wrap it in a SECURITY DEFINER function" is now the kit's recommended
move. The supabase-auth-trigger pattern should grow a sibling
`lib/patterns/postgres-mutations.md` that documents this for future
consumers.

### Decision 24 — Stock aggregation is client-side for W4, view-based for Pilot

**What changed.** W4 ships `src/components/StockBySku.tsx` which fetches all
`batches` with `kg_remaining > 0` plus all `skus` and `locations`, then
aggregates in JavaScript: groups by `sku_id`, sums `kg_remaining`, breaks
down by `location_id`. The result is sorted low-stock-first (SKUs where
total < `low_stock_threshold_kg` come first), then by total kg ascending.
Rows below threshold get an amber background highlight; an amber banner
at the top counts how many are below threshold.

**Why client-side for W4.** The demo has ~130 batches across 25 SKUs.
JS-side aggregation of 130 rows is instantaneous (<10ms on a 2021 Android
target). The decision defers the Postgres view to Pilot because:
- W4 is read-only, single-user, single-store
- Writing the SQL view + adding a SECURITY DEFINER function is 1-2 hours
  of work that doesn't pay off at 130 rows
- The §8.6 performance target only matters when the dataset grows

**When to switch to a Postgres view.** A useful rule of thumb: when the
sum-of-kg_remaining query takes >200ms in DevTools Network, move the
aggregation to a view. For a single store with 130-500 batches, client-side
is fine. For multi-store with 5K+ batches, view-based is required.

**The Pilot view would look like:**
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
```
Then `StockBySku` calls `supabase.from('stock_by_sku').select('*')` and
the JS just renders. Decision deferred because W4 ships a working demo.

### Decision 25 — Audit log filter design: 3 filters, paginated 50/page

**What changed.** W4 ships `src/pages/AuditLog.tsx` at `/#/admin/audit-log`.
3 filters (table_name dropdown, user_id dropdown, from/to date pickers),
pagination (50 per page, ← Previous / Next → buttons), and a Show/Hide
button per row to expand the JSON before/after blobs.

**Why these 3 filters.** The 3 most-asked audit questions in a wholesale
context:
- "What did the worker do today?" → user + date range
- "Which batches have been touched?" → table = batches
- "What happened in the last hour?" → date range, no other filter

**Why no "action" filter (INSERT/UPDATE/DELETE).** For the demo, the 9
tables we audit are all INSERT-heavy (we don't do UPDATE except the
kg_remaining trigger). The action filter would be useful for a system
with lots of UPDATEs; Pilot can add it.

**Why no search box.** Fuzzy search across the JSON blobs is expensive
(client-side filter) or requires Postgres `tsvector` (Pilot). For W4, the
table + user + date filters are the right surface.

**Why paginate at 50.** 50 rows × ~150 bytes per row = ~7.5 KB response.
That's well under the 1MB Supabase response limit and loads in <100ms on
2021 Android. 100 per page would also work; 50 is the conservative choice
that keeps the UI snappy on slower networks.

**Show/Hide JSON expansion.** Each row's `before_json` and `after_json` are
up to a few KB. Showing them all by default would be visually overwhelming.
Show/Hide lets the admin drill in on demand. The JSON is rendered in a
`<pre>` block with whitespace-pre-wrap, so it's readable in any viewport.

**When this changes.** Pilot/Production: add a JSON diff view (highlight
changed keys in UPDATE rows), add an Export CSV button, and consider an
audit_log retention policy (the table grows unbounded; 90-day TTL via a
cron job is a Pilot item).

## W5 — 2026-08-07

### Decision 26 — PWA config: vite-plugin-pwa in `generateSW` mode, Workbox auto-handles the rest

**What changed.** W5 ships `vite-plugin-pwa@^1.3.0` wired in
`vite.config.ts`. Configuration:
- `registerType: 'autoUpdate'` — new builds auto-replace the old SW on next
  page load. No "new version available, refresh" prompt.
- `devOptions.enabled: true` — the SW is registered in dev too, so we can
  test offline behaviour locally (otherwise the offline banner code is
  unreachable without a production build).
- `includeAssets: ['favicon.svg', 'icon.svg']` — the SVG icons are precached
  alongside the JS/CSS/HTML.
- `manifest` is inline: name, short_name, theme_color `#4f46e5`,
  background_color `#f8fafc`, display `standalone`, start_url `/`,
  scope `/`, 1 icon entry (the fish SVG, sizes `any`, purpose `any maskable`).
- `workbox.globPatterns: ['**/*.{js,css,html,svg,woff2}']` — precaches the
  built app shell.
- `workbox.navigateFallback: '/index.html'` — hash-router URLs (e.g.
  `/#/admin/audit-log`) fall back to the cached `index.html` so deep links
  work offline.
- `workbox.runtimeCaching` — one rule for `*.supabase.co`:
  `NetworkFirst` with `networkTimeoutSeconds: 5` and a 24h `maxAgeSeconds`
  expiry. The in-memory React Query cache is the primary cache; the SW is
  the safety net for the app shell + cross-restart reads.

**Why `generateSW`, not `injectManifest`.** `generateSW` lets Workbox
auto-generate the service worker from the config object — no need to write
our own SW file. `injectManifest` is for projects that need full control
of the SW (e.g. custom message handling, push notifications). We don't
need either, so the simpler mode wins.

**Why NetworkFirst, not CacheFirst, for the Supabase API.** CacheFirst
would serve stale data even when the network is up. The 5s `networkTimeoutSeconds`
means: "try the network, fall back to cache if it takes >5s." When online,
the user always sees fresh data; when offline, they see the last good read.
This is what SPEC §2.14 means by "the most recent read snapshot."

**Why 24h `maxAgeSeconds`.** Long enough to span a workday (the demo
session is ~6 hours; the wholesaler's day is ~10). Short enough that a
demo on day-old cached data doesn't surprise anyone. Mode B will tune
this per-resource (e.g. 5 minutes for the audit log, 1 hour for batches).

**Why `autoUpdate`, not `prompt`.** The demo audience is the gatekeeper
client. They tap the app, it should "just work" — no "new version
available" interruption. `autoUpdate` activates the new SW in the
background and swaps it in on the next navigation. Pilot will revisit
this if the upgrade has breaking changes (e.g. schema migration on the
client).

**What this DOES NOT do.** No push notifications. No background sync.
No offline write-queue. All three are explicit V1-out-of-scope per
SPEC §9; the upgrade paths are documented in §9 and `docs/OFFLINE-WRITE-QUEUE.md`
(to be written in Mode B).

### Decision 27 — Offline detection: `useOnlineStatus` hook + `OfflineBanner` + inline form errors

**What changed.** W5 ships three pieces that together enforce SPEC D6 +
§2.14 + §8.7a-c:
1. `src/lib/online.ts` — `useOnlineStatus()` hook. Reads
   `navigator.onLine` on mount, subscribes to the `online` and `offline`
   window events, returns a boolean. Cleanup removes the listeners.
2. `src/components/OfflineBanner.tsx` — renders an amber banner
   ("Offline — read only. Changes will be available when back online.")
   below the header when `online === false`. `role="status" aria-live="polite"`
   so screen readers announce it without stealing focus. When online,
   returns `null` (no DOM, no layout shift).
3. All 4 mutation forms (Delivery, Sale, Transfer, Spoilage) import the
   hook, add `if (!online) { setError("You are offline. Reconnect to record changes."); return; }`
   to the `onSubmit` handler, and `disabled={... || !online || ...}` on
   the submit button.

**Why all three layers.** Belt-and-braces for SPEC §3.5 accessibility +
SPEC D6 graceful degradation:
- The hook is the source of truth. One event-listener, one boolean, all
  components re-render when it flips.
- The banner is the user signal. SPEC §2.14 specifies the exact text.
- The form-level guard is the safety net. A disabled button is the
  primary defense; the inline error is the secondary defense for keyboard
  shortcuts or browser extensions that bypass `disabled`.

**Why the offline state is a boolean, not a richer object (e.g. "online
/ syncing / stale").** The demo has no sync state. There is no
write-queue, no "uploading 3 of 7 mutations" state. A boolean is the
right shape for V1. When the offline write-queue lands in V2, the hook
will evolve to return `{ online: boolean, pending: number, lastSync: Date | null }`.

**Why amber, not red.** Amber is "warning" (you can still do things, just
not mutations). Red is "error" (something is broken). The demo is the
former, not the latter. SPEC §3.5 brand palette is amber-100/200/900 —
we use it consistently for warnings (also in the stock-by-SKU low-stock
highlight).

**Why `navigator.onLine`, not a periodic fetch heartbeat.** The browser
fires `online`/`offline` events on actual network state changes (WiFi on,
WiFi off, captive portal). A fetch heartbeat would add load, have its
own false positives (e.g. the Supabase host is down but the LAN is up),
and is unnecessary because the event API is reliable.

**When this changes.** V2 with the offline write-queue: the hook grows
the richer return shape; the banner grows a "syncing" state and a
"back online" toast; the form guard grows an outbox enqueue path.

### Decision 28 — Empty-state design: primary action button only when the user can act (SPEC §3.7)

**What changed.** W5 ships empty states on three surfaces:
1. **Floor dashboard, "Active batches on the floor" empty case** — shows
   a single primary action button: **"+ Transfer from storage"** linking
   to `/#/floor/transfer`. The worker can do this immediately.
2. **Rep dashboard, "Active vendors" empty case** — shows a hint card:
   "Run the seed in Supabase SQL Editor (the one-time setup)…" — no
   primary button, because the vendor-rep can't create vendors.
3. **Floor dashboard, "Record spoilage" link in the section header** —
   added next to the section title so the worker doesn't have to scroll
   to find it.

**What this DOES NOT do.** No primary action button on:
- Recent activity empty state (the user is on a dashboard; "what's next"
  is whatever the dashboard offers, not the empty list)
- Audit log empty state (a viewer page; no user action to surface)
- The sign-in page (already has the form)

**The SPEC §3.7 quote that drives this.** "Empty states must show a clear
message and, where there is a next action the user can take, a primary
action button that performs it." The key phrase is "where there is one."
Empty lists on a dashboard don't qualify — the dashboard is the action;
the empty list is just "the action is not currently relevant."

**The pattern, generalised.** A useful rubric for any future empty state:
1. Is there something the user can do *right now* that resolves the empty
   state? → Show a primary action button.
2. Is the empty state because of a config / data issue the user can't
   fix? → Show a hint pointing to the fix (admin, docs, etc.).
3. Is the empty state on a viewer (read-only) surface? → Show a friendly
   message, no action.

This rubric is reusable beyond the 3 surfaces in W5 and is worth pulling
into `tins-kit/lib/patterns/empty-states.md` if the pattern recurs in
the next consumer.

**When this changes.** Pilot: a "contact us" or "report a problem"
secondary button on the hint-state surfaces, so a stuck user has an
escalation path. Not blocking for V1.

## W6 — 2026-08-07

### Decision 29 — Netlify deploy: `netlify.toml` + Node 20 + hash-router SPA fallback

**What changed.** W6 ships:
1. `package.json` build script: `tsc -b && vite build` → `vite build`.
   The `tsc -b` was referencing a `tsconfig.node.json` project file that
   was dropped in W4 (single `tsconfig.json` now). The `-b` flag is
   silent — exit 0 if there's nothing to build — but it left a confusing
   "no project" warning. Netlify's build log would have been clean but
   noisy. Adding a separate `typecheck` script (`tsc --noEmit`) for
   whoever wants it; the deploy doesn't run it.
2. New `netlify.toml` at the repo root, pinned:
   - `command = "npm run build"`
   - `publish = "dist"`
   - `NODE_VERSION = "20"` (the kit's standing rule; Supabase SDK and
     Vite 5 both want Node 20+)
   - SPA fallback: every URL → `/index.html` (defence-in-depth for
     hash-router links that get stripped by link-previewers — HashRouter
     itself means the server only ever sees `/` and `/index.html`, but
     the redirect is cheap insurance)
3. New `docs/DEPLOY-NETLIFY.md` — the operator doc (mirrors
   `docs/SUPABASE-SETUP.md`'s tone: pre-flight, UI walkthrough, smoke
   tests, troubleshooting, what's NOT in scope).

**Why `netlify.toml` and not the Netlify UI alone.** The UI lets you
set the build command + publish dir, but the env vars and the SPA
redirect are easier to track in `netlify.toml` (and to commit so a
teammate can see what the deploy does). The kit's standing rule is
"every change is in a file you can read."

**Why Node 20, not 18 or 22.** The kit's standing rule from
exam-forge. Node 18 is end-of-life in April 2025; Node 22 is fine but
Vite 5's docs are pinned to 20. The Netlify default is 18 (legacy) —
the `NODE_VERSION` env var forces 20.

**Why no `_redirects` file.** A `_redirects` file (Netlify's
file-based redirects) is an alternative to the `[[redirects]]` block in
`netlify.toml`. We picked `netlify.toml` because it's already being
edited for build config — one file, not two.

**Why no custom server / SSR.** SPEC §4.1: the V1 deploy is static
hosting. The Supabase JS client talks directly to the Supabase REST
API; the only thing the static host does is serve `index.html` + the
JS/CSS/SW bundle. No Node functions, no edge functions, no Deno, no
Workers. Free tier is enough for the demo; Pro is $12/mo if the
wholesaler needs more.

**What the user does next.** Push to a Git remote (GitHub / GitLab /
Bitbucket), then in the Netlify UI: Add new site → Import project →
pick the repo → the UI auto-detects the build settings from
`netlify.toml` → add the 2 env vars (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) → Deploy. ~30 minutes from a clean laptop to
a live URL. Operator doc has the full click-by-click.

**When this changes.** Pilot/Production: add a custom domain
(`demo.jayshankar.in`), Supabase's daily backup confirmation in
deploy logs, a `npm run typecheck` gate in CI. Not blocking for V1.

### Decision 30 — Fixed a silent validator regression (§8.1a spec-marker check drifted from the kit)

**What was wrong.** `npm run validate` was failing (71 pass, 1 fail) and `npm run selftest`
was failing (8/9), contradicting `HANDOVER.md`'s session-11 claim of "72/72, 9/9 green."
`scripts/validate.mjs`'s `§8.1a` check — explicitly labeled `// Part A — Kit's structural
checks (re-implemented)`, meant to mirror `tins-kit/scripts/validate.mjs`'s own `§8.1a` check
verbatim — required the literal marker `<!-- Jayshankar Specification v1.0 -->`. `SPEC.md`'s
header has read `<!-- TINS Specification v1.0 -->` unchanged since W1 (2026-08-05) and was
never edited to add a project-specific marker; no prior decision here documents intending to
add one. `scripts/selftest.mjs`'s `defectNoSpecMarker()` regression test had the same string
swapped in, so it was silently stripping a marker that was never present and testing nothing.

**Root cause, by file-mtime evidence.** `scripts/validate.mjs` was last modified 2026-08-14
07:56 — after `HANDOVER.md`'s last save (2026-08-14 04:51) that recorded the "72/72" state.
So this string was changed post-hoc, in the same session-11 housekeeping pass, without a
re-run of `npm run validate` afterward and without a decision entry — a direct violation of
this project's own "never let a validator failure through" / "an unrecorded finding is a
finding the next session pays for again" rules. It sat broken for roughly 4 weeks
(2026-08-14 → 2026-09-10, when a routine directory audit caught it — see `AUDIT-2026-09-10.md`
§2 for the full writeup and the exact commands run to verify).

**Fix.** Reverted both files' target string back to `<!-- TINS Specification v1.0 -->`,
matching `SPEC.md`'s actual (unchanged) content and `tins-kit/scripts/validate.mjs` /
`tins-kit/templates/SPEC.md`'s canonical convention. Added an inline comment at the check
site in `validate.mjs` pointing future readers at this decision and the audit doc. Confirmed
green: `npm run validate` → 72 pass, 0 warn, 0 fail. `npm run selftest` → 9/9 pass.

**Why this is the right fix, not the other direction.** The alternative fix — adding
`<!-- Jayshankar Specification v1.0 -->` to `SPEC.md` to satisfy the tightened check — was
considered and rejected. Nothing in this project ever decided a per-project marker was wanted
(no decision entry, no matching template change in `tins-kit/`), and the check's own comment
says it's a re-implementation of the kit's *generic* check, which uses the generic marker.
Treating the validator as the thing that drifted (not the spec) is also consistent with the
mtime evidence: `SPEC.md` never changed; `validate.mjs` did, after the fact, unlogged.

**When this changes.** If a future session genuinely wants a project-specific marker in
addition to the generic TINS one (e.g. to help distinguish Jayshankar's `SPEC.md` from
`tins-kit`'s own when both are open at once), that's a legitimate small spec amendment — but
it should touch `SPEC.md`'s header directly, update `tins-kit`'s own convention docs if it's
meant to become a kit-wide pattern, and get its own decision entry, not land as a silent
validator edit.

### Decision 31 — First delegated task (T1): `FloorDashboard.tsx` location display name, via MiniMax M3

**What changed.** `src/pages/FloorDashboard.tsx`'s `locations` query selected only `id, name`,
so the Active-batches table's Location column showed raw short names (`storage`, `display`,
`freezer`) instead of the friendly `display_name` (`Cold Storage`, `Display Counter`, `Deep
Freezer`) every other screen shows. Fixed by adding `display_name` to the query, the `Location`
interface, and `locationName()`'s fallback chain — matching the existing pattern in
`src/components/RecentActivity.tsx` exactly. One file, three lines.

**Who built it.** This is the first real task run through the new `delegation/` setup (see
`delegation/README.md`): Claude planned the task and wrote the brief, **MiniMax M3 (via the
MiniMax Coder desktop app on native Windows) built it**, Claude audited independently before
integrating. Full record: `delegation/tasks/T1-floor-location-display-name/` (`WORKER-PROMPT.md`,
`NOTES.md`, `AUDIT.md`).

**Why this is worth recording in the real decision log, not just the delegation folder.** The
delegation folder is process/coordination state; this file is the project's actual decision
history, same as any other builder session's work — where the code came from doesn't change
that. Two things worth knowing if you're reading this later: (1) the loop worked end-to-end on
its first real try — MiniMax's diff was exactly in scope and its self-reported verification was
independently confirmed accurate; (2) it also confirmed a real risk, not just a theoretical one
— MiniMax's own `npm run build` on Windows left Windows-only native binaries (`@rollup/rollup-
win32-...` in place of `@rollup/rollup-linux-x64-gnu`) in the `node_modules` folder this project
shares with its WSL2 mount, breaking the dev server on the auditor's side until a plain `npm
install` fixed it. Anyone auditing delegated work on this project from WSL should `npm install`
first, every time, not just when something breaks.

**Bonus fix, same commit, not MiniMax's work.** While auditing T1, found `npm run typecheck`
had been silently failing (`RecentActivity.tsx(4,1): 'Link' is declared but its value is never
read`) — pre-existing, unrelated to T1, never caught because neither `npm run validate` nor
`npm run selftest` (the project's actual gate) runs `tsc --noEmit`. Removed the unused import
(one line). Worth a future decision on whether `typecheck` should join the gate rather than stay
opt-in — not decided here.

**Not fixed here, logged as follow-up candidates** (see `delegation/tasks/T1-.../AUDIT.md` for
full detail): `AdminDashboard.tsx` has the same missing-`display_name` gap T1 just fixed, though
it's currently invisible (nothing renders a location name there yet, just a count) — lower
urgency than T1 was. Separately, `FloorDashboard.tsx`'s "Expires" column is unconditionally
blank because its `skus` query never selects `shelf_life_hours` even though `expiresAt()` reads
it — found during the audit's visual check, not something MiniMax was asked to look at.

**When this changes.** Whenever T2/T3 above get picked up, or if the delegation loop's process
itself needs adjusting based on how this first round actually went (the `self-parallel`-with-a-
`WORKER-SESSION.md`-shaped-brief adaptation in `delegation/README.md` is explicitly unvalidated
until a real run — this is that real run, and it held up).

### Decision 32 — Considered, deferred: lessons from a "portable curriculum builder" bundle

**What happened.** The user added `data-analysis-curriculum-builder.skill` and
`portable_curriculum_builder.zip` to the project root and asked for anything useful to be
extracted for `tins-kit` and for this project. Both are the same workflow (a Claude-Code skill
that turns a course syllabus into a verified teaching package — unrelated to fish-wholesale
inventory), one rewritten to be harness-agnostic so a different AI tool can pick it up honestly.
Read in full; findings reported to the user in chat.

**What was proposed, not built:**
- A `tins-kit/lib/patterns/` doc distilling the bundle's "hand a workflow to a genuinely
  different harness" pattern (explicit capability self-report with literal test commands, a
  persistence-mechanism menu, permission to say "I can't do part of this") — directly relevant
  to the MiniMax delegation setup in `delegation/README.md`, which arrived at a narrower version
  of the same idea ad hoc.
- Porting `scripts/contrast_checker.py` (real WCAG contrast-ratio math, ~40 lines, zero
  dependencies) from the bundle into this project as a zero-dep Node script, since `SPEC.md` §6's
  WCAG 2.1 AA checklist currently has no automated check anywhere in the codebase.

**Decision: deferred, not implemented.** User chose to leave this as a written proposal rather
than act on it now. Recording it here so it isn't lost and doesn't need re-discovering later —
this is a considered deferral, not an oversight.

**When this changes.** Whenever the user wants either piece picked up: the `tins-kit` pattern doc
is a kit-growth candidate for a session actually working in `tins-kit/`; the `contrast_checker`
port is a normal Jayshankar task (candidate T4 alongside T2/T3, `delegation/LEDGER.md`) whenever
accessibility verification becomes a priority.

### Decision 33 — Second delegated task (T2): `AdminDashboard.tsx` location display name, via MiniMax M3

**What changed.** Same fix as decision #31 (T1), applied to the one remaining file with the old
`locations` query pattern: `src/pages/AdminDashboard.tsx`'s `Location` interface and query now
select `display_name`, matching `RecentActivity.tsx`/`FloorDashboard.tsx`/`StockBySku.tsx`/
`FormFields.tsx`. Two lines, one file. Unlike T1, this has **no visible effect today** —
`AdminDashboard.tsx` never renders a location's name, only a count — it's preventative: the next
feature that does render one here won't silently inherit the bug T1 fixed elsewhere. The brief
said this plainly up front so it wasn't mistaken for a missed visual check.

**Who built it.** MiniMax M3 again (`delegation/tasks/T2-admin-location-display-name/`), audited
and integrated by Claude the same way as T1 — independent `npm install` + re-run of
validate/build/typecheck rather than trusting the self-report. Everything matched; no
discrepancies found this round.

**Status of the `display_name` rollout.** Complete — `grep` confirms all 5 files in `src/` that
query the `locations` table now select `display_name`. This specific bug shape (a query missing a
column the UI needs) is fully closed out across the codebase.

**When this changes.** N/A — this one's done. See decision #31 for the related, separately-tracked
`FloorDashboard.tsx` Expires-column bug (T3, queued, different root cause) and the deferred
contrast-checker task (T4, queued).

### Decision 34 — Third delegated task (T3): Expires column, plus a real pre-existing bug found during audit

**What T3 was supposed to fix, and did.** `FloorDashboard.tsx`'s `skus` query never selected
`shelf_life_hours`, so `expiresAt()` always computed `null` and the Expires column was blank for
every row. MiniMax M3 fixed the one-line `select` clause exactly as specified
(`delegation/tasks/T3-floor-expires-column/`). Its own diff was correct and the gate was green.

**What the audit's visual check found — the diff being correct wasn't enough.** After MiniMax's
fix, the Expires column was *still* blank. Root cause, found by actually investigating rather than
assuming the fix was wrong: `src/components/RecentActivity.tsx` (rendered inside `FloorDashboard`)
has its own `skus` query using the **identical** TanStack Query key, `['skus']`, with a narrower
`select`. TanStack Query dedupes identical keys and shares one cached result across every
component observing that key — RecentActivity's narrower shape was winning, silently starving
`FloorDashboard`'s own query of `shelf_life_hours` no matter what `FloorDashboard`'s code asked
for. This bug pre-dates T3 entirely; it isn't something T3's diff could have caused or MiniMax
could reasonably have been expected to catch from reading `FloorDashboard.tsx` alone.

**How wide this actually goes.** The same `queryKey: ['skus']` is shared, with **three different
`select` shapes**, across 5 files: `FormFields.tsx`, `RecentActivity.tsx`, `AdminDashboard.tsx`,
`FloorDashboard.tsx`, `RepDashboard.tsx`. Checked whether this was live elsewhere, not just
theorized: `AdminDashboard.tsx` also renders `<RecentActivity />` and also needs
`shelf_life_hours` for its own "Shelf life (hrs)" SKU table column — same collision, confirmed via
screenshot that **all 25 SKUs showed `—` there too**, unrelated to today's session, broken since
whenever `RecentActivity` was added next to that table.

**Fix applied (auditor, not MiniMax — same class of bonus fix as decision #31's typecheck
cleanup).** Gave both `FloorDashboard.tsx`'s and `AdminDashboard.tsx`'s own `skus` queries a
distinct key (`['skus', 'floor-dashboard']` / `['skus', 'admin-dashboard']`) instead of the shared
`['skus']`. Minimal and safe: splitting a wrongly-shared cache into independent ones can only make
behavior more correct, never less — the narrower consumers (`RecentActivity`, `FormFields`,
`RepDashboard`) keep working exactly as before, unchanged. Re-verified end to end: gate green
(`validate` 72/0/0, `typecheck` clean, `build`, `selftest` 9/9), the actual network request now
includes `shelf_life_hours` with real values, and both dashboards' screenshots confirm real
values render (Floor: real dates instead of `—`; Admin: real hour counts 8–720 instead of `—`).

**Not fixed — a real architectural follow-up, not a one-line patch.** The same collision risk
still exists structurally for `FormFields.tsx` and `RepDashboard.tsx` — they currently show no
symptom only because their `select` shape happens to match `RecentActivity.tsx`'s, which is a
coincidence, not a guarantee. The generalizable fix (one shared, canonical `useSkus()` hook with a
superset shape, or a hard convention that any component needing non-default columns must use its
own key) is a real design decision affecting multiple files, deliberately left undone here.

**Why this is worth reading closely if you're picking this project up later.** This is the
clearest example yet of why the delegation loop's audit step does an independent visual check
instead of trusting "diff looks right + gate is green": both were true here, and the feature still
didn't work. The failure mode (a shared cache key silently overriding a correct query) is also a
generally useful thing to watch for anywhere this codebase uses `useQuery` with a key also used
elsewhere — worth keeping in mind before adding new shared components.

**When this changes.** Whenever someone decides to do the generalized fix (canonical `useSkus()`
hook, or an enforced per-consumer-key convention) across `FormFields.tsx`/`RepDashboard.tsx` too —
not currently queued as a task, this paragraph is the record that it was found and consciously
deferred.

### Decision 35 — Fourth delegated task (T4): WCAG contrast checker, via MiniMax M3

**What changed.** New file, `scripts/check-contrast.mjs` — a zero-dependency Node ESM script
implementing the real WCAG 2.x relative-luminance/contrast-ratio formula, matching the style of
`scripts/validate.mjs`/`scripts/selftest.mjs`. Checks a hardcoded 16-pair default palette (this
project's actual Tailwind colors, taken from `src/`) and exits non-zero if any pair fails AA-normal
(ratio < 4.5). Exports `relativeLuminance`, `contrastRatio`, `checkPalette`, and `PALETTE` so the
functions are reusable, not just runnable from the CLI. This closes the gap flagged in decision
#32: `SPEC.md` §6 requires WCAG 2.1 AA, and until now nothing in the codebase checked it.

**Who built it, and how it was verified.** MiniMax M3 (`delegation/tasks/T4-contrast-checker/`).
The brief baked in a mathematically-verifiable known answer (black-on-white must compute to
exactly 21.0; the palette's 3 real failures and their exact ratios were pre-computed and given as
the expected output) specifically so both MiniMax and the auditor could check the implementation
against ground truth rather than each other's say-so. Both did: MiniMax's self-check matched, and
the auditor independently re-ran every mode (`--self-check`, default palette, `--help`, a
deliberate bad-argument case, and a direct programmatic `import()` of the exported functions) —
all matched exactly, including cross-referencing one ratio (`text-slate-500 on white` = 4.76)
against WebAIM's own contrast checker. This is the first task in the round with zero discrepancies
between the worker's self-report and the auditor's independent findings.

**Bonus fix, same commit, not MiniMax's work.** Two unused imports (`existsSync`, `readFileSync`
from `node:fs`) sat unreferenced in the file — harmless (outside `src/`, so `tsc` never sees it;
no lint step in this project's gate either), but the same class of dead-code cruft as decision
#31's fix. Removed.

**What this finds, and what it doesn't fix.** The palette check is real, not decorative: `text-
slate-400` (fg `94A3B8`) against white or `slate-50`, and `text-slate-300` (fg `CBD5E1`) against
white, both fail WCAG AA for normal text right now, in the actual shipped UI. This task deliberately
only builds the detector — remediating those colors, and deciding whether `check-contrast.mjs`
should be wired into `validate.mjs` as a real gate check (both explicitly out of scope per the
brief), are undone, logged follow-ups.

**Round status.** This was the last task in the round — `delegation/LEDGER.md` has no more
`assigned`/`proposed` rows. Four for four integrated (T1–T4), the loop validated itself on real
work, and it caught one real, non-trivial pre-existing bug (decision #34) along the way that
neither `validate.mjs` nor a surface read of the diff would have found.

**When this changes.** Whenever the user wants the 3 failing colors actually remediated, or wants
`check-contrast.mjs` wired into the gate — both logged, neither queued.

### Decision 36 — SPEC.md v1 → v2: the Mode B merge, reconciled against real operational facts

**What changed.** `SPEC.md` is now v2. This merges `SPEC-AMENDMENT-v2.md` (D18–D27 — containers,
bills, receiving confirmation, CRM, payments, reversal, multi-store/warehouse schema, dormant
GST, notifications) into the canonical spec, **and** reconciles it against real operational facts
gathered directly from the user across a scoping conversation on 2026-09-10, captured in
`client-qa/operational-reality-2026-09-10.md`. This was not a mechanical copy-paste merge — several
of the amendment's own assumptions, and several of V1's original assumptions, turned out to be
wrong once real information came in, and got corrected during the merge rather than carried
forward wrong. `SPEC-AMENDMENT-v2.md` is marked superseded, kept as historical record.

**Four new locked decisions, D28–D31 (full text in `SPEC.md` §0.2):**
- **D28 — one mobile app, not one per role.** Researched 6 comparable products; the same pattern
  held everywhere (office/admin roles share one app; only the field/delivery role gets a
  genuinely separate minimal surface, and even that's a "make it cheap to split later" bet, not
  a second app built now).
- **D29 — supersedes D9.** There is one warehouse, no retail store, no display counter, no
  freezer — all three were V1 guesses that didn't match reality. `transfer` is repurposed for
  the (currently unused) cross-warehouse case; the real day-to-day "move stock around" operation
  is `repack`, which the amendment already specified for a different reason and turned out to be
  exactly the right shape for this too.
- **D30 — supersedes D6's offline-write exclusion, for the worker role.** V1 assumed "reliable
  shop WiFi"; the real worker job is hauling fish to buyers in the field. This was actually
  already flagged as a live conditional in V1's own closing notes ("if Mode B reveals the worker
  genuinely needs to record picks offline...") — the user independently recalled this mid-session
  before I'd surfaced it, and was right to. Now confirmed, sized honestly as significant
  engineering (write-queue, conflict resolution, sync UX), not a small add-on.
- **D31 — no price/rate value is ever pushed to a customer, automatically, ever.** Sourced from
  a real complaint about the wholesaler's current khata app. Checked against this app's actual
  code before writing the decision: `SaleForm.tsx` already enters price per-transaction with no
  published "current price" anywhere — this app never had the khata app's problem structurally.
  The decision makes that permanent and explicit rather than an accidental byproduct, binding on
  D20's WhatsApp channel and D27's notifications both.

**What else moved.** §9 (out of scope) revised — multi-store/offline-write-queue/reverse-sale/
customer-CRM/iOS/barcode-scanning/photo-capture/reports-beyond-dashboard/email-SMS-notifications
all moved from "out of scope" to "in scope, here's where" (struck through in place, not silently
deleted, so the history of what changed is visible in the file itself). §1, §2.5 (location model
rewritten, plus a new §2.5a plain-language container-model section — the one AGENT-BRIEF.md's
documentation standard explicitly required land in `SPEC.md` itself, not stay in the amendment),
§2.7 (movements table now 6 kinds, `transfer` and the FIFO algorithms re-explained for the
warehouse-only reality), §2.11 (worker UI rewritten around D28/D30), §2.14 (offline mode split
by role), all of §4.2's new tables (§4.2.10–4.2.21, `stores`→`warehouses` renamed throughout),
all of §4.3's new algorithms (§4.3.7–4.3.11, including the C.4 transfer-timestamp bug fix),
new acceptance criteria §8.10–§8.17 (the amendment's §8.10–8.14 plus three new sections for
D29/D30/D31), and a new closing-notes §D listing what's still genuinely open (box quantities,
GST status, credit terms, second-warehouse timing, staff follow-up verification, and a
**Tanglish UI possibility raised as "maybe," deliberately not locked as a decision** — flagged
for a real conversation, not defaulted either direction).

**What I did NOT do in this pass.** Did not touch any code — this is spec-only, per D1 (never
edit generated code; edit the spec). Did not create delegation tasks yet — the user asked for
that as a next step, sequenced after this merge specifically so task briefs derive from the
final locked spec rather than being written in parallel with it changing. `npm run validate`
confirmed still green (72/72) after the full merge — the validator's structural checks
(markers, §0.0–§0.2 presence, decision-count, acceptance-criteria presence) don't parse deep
content, so this is a necessary check, not a sufficient one; a close human read of the merged
sections is still worth doing before treating every word as final.

**When this changes.** When the still-open items in `SPEC.md`'s closing §D get real answers, or
when Mode B build work itself reveals something in this merge was wrong — same discipline as
always: amend the spec, log the decision, don't patch around it in code.

### Decision 37 — Migration 0006 + RLS: the container model schema, written by the auditor, not delegated

**What changed.** New migration `supabase/migrations/0006_container_model.sql`: `warehouses`,
`bills`, `containers`, `container_fills`, `container_fill_items` tables; `locations.warehouse_id`
(backfill-safe NOT NULL add), `batches.bill_id` (nullable), `movements.container_fill_id`
(nullable) and `movements.kind` extended to include `repack`/`reversal`; a
`container_availability` view (`security_invoker = true`, so it respects the querying user's own
RLS rather than running as the view owner). `supabase/rls-policies.sql` updated: every existing
`admin`-only policy now also allows `co-admin` (D28's new role — without this, co-admin's whole
point, "full admin capability," would be false the moment RLS is checked); `movements`' INSERT
policy rewritten per-kind (delivery_in/sale unchanged; spoilage unchanged; `repack` added,
worker-includable; `transfer` restricted to admin/co-admin only, D29's cross-warehouse
repurposing; `reversal` deliberately on no direct-INSERT path at all — RPC-only, once built);
new SELECT/INSERT/UPDATE policies for the 5 new tables.

**Why written directly, not delegated to MiniMax — the one deliberate exception to this
session's whole pattern.** Every prior delegated task (T1–T4) was frontend/script code with no
write path to the live database. This changes a live Supabase schema. Given the stakes and that
I already had the exact column-by-column design from authoring `SPEC.md` myself, doing this
directly was the right call, not a process failure — matches this project's own tiered-judgement
spirit (mechanical-but-high-stakes work stays with the party that has the fullest context).

**A real sequencing conflict in the spec itself, resolved, not glossed over.**
`AGENT-BRIEF.md`'s phase order says "container model first, bills second" — but
`container_fills.bill_id` is a NOT NULL FK to `bills.id` (enforces the one-purchase-event-per-fill
rule, `SPEC.md` §4.2.12), so `bills` must exist before `container_fills` at the schema level
regardless of how the build phases were narratively ordered. This migration creates `bills`
first. `receiving_confirmations` (§4.2.15) is deliberately NOT in this migration — nothing else
has a hard FK dependency on it, so it's still deferred to a later task, matching phase 2.

**A correctness bug caught by not trusting my own first draft.** Assumed Postgres's
default-generated name for the original inline `movements.kind` CHECK constraint
(`movements_kind_check`) and wrote a `DROP CONSTRAINT IF EXISTS` against that name — then
reconsidered: if that assumption were wrong, `ADD CONSTRAINT` wouldn't fail, it would just stack
a second, looser constraint alongside the still-active original one, silently leaving `repack`/
`reversal` blocked with no error anywhere in the migration output. Rewrote it as a `DO` block
that finds the real constraint by its actual definition (`pg_constraint` + `pg_get_constraintdef`
matching on `kind` and `delivery_in`) rather than assuming a name. Worth remembering as a general
lesson: an unnamed inline CHECK's auto-generated name is a real thing to verify, not assume, the
same discipline this session already applied to application code (decision #34's `queryKey`
investigation) now applied to schema.

**Not yet done — the actual apply.** This project has no direct Postgres/psql connection from
the WSL2 auditor environment (`scripts/probe-db.mjs` confirmed read-only PostgREST access only)
— matching the established W1.5 pattern, the user applies `0006_container_model.sql` and the
updated `rls-policies.sql` via the Supabase Dashboard SQL Editor themselves, same as 0001–0005.
Static structural checks (`npm run validate`, `npm run selftest`) both confirmed green against
the file content; neither proves the SQL is live-correct until actually applied.

**When this changes.** Once applied, confirm via `scripts/probe-db.mjs` (extend its
`EXPECTED_TABLES` list) or a manual Supabase Dashboard check that all 5 new tables exist and
`locations`/`batches`/`movements` show the new columns. The C.4 timestamp fix and the
container-sourced FIFO algorithm (§4.3.8–§4.3.10) are the next task, sequenced after this schema
lands — see the delegation ledger.

**Applied and independently confirmed, 2026-09-10 (same day).** User ran `0006_container_model.sql`
then the updated `rls-policies.sql` via the Supabase Dashboard SQL Editor — both reported
success. Extended `scripts/probe-db.mjs`'s `EXPECTED_TABLES`/`COUNT_TABLES` lists (9 → 14) and
added a Step 2b checking the 3 new columns directly (a table existing doesn't prove every
`ALTER TABLE ADD COLUMN` in the same migration succeeded) — re-ran it rather than trust the
Dashboard's own success message, same discipline as every other verification this session.
Confirmed independently: all 14 tables present, all 3 new columns present, `warehouses` has
exactly 1 row (the `main` seed), the other 4 new tables correctly show 0 rows, and all
pre-existing Mode A data is untouched (6 vendors, 25 skus, 3 locations, 156 movements, 52 sales,
150 price_history, all 3 demo users). Schema is confirmed live and correct — the C.4/FIFO
algorithm work can now actually be tested against it, not just written blind.

### Decision 38 — Migration 0007: `record_container_fill` RPC, written by the auditor and covered by a real live test before being called done

**What changed.** `supabase/migrations/0007_record_container_fill.sql` adds
`compute_container_fill_expiry(filled_at, sku_ids[])` (pure helper, `filled_at + min(shelf_life_hours)`
across a fill's SKUs — `SPEC.md` §4.2.12) and `record_container_fill(bill_id, location_id,
container_number, capacity_kg, items[])` (§4.3.7, the receiving-side operation). Both are
`SECURITY DEFINER`, matching the `record_transfer_cascade` precedent (migration 0005).
`record_container_fill` validates: container availability (rejects loading into a container that
still has stock per §4.2.11's derived-availability rule), capacity (total kg ≤ container capacity),
and that every item's batch traces to the *same* bill (§4.2.12's one-purchase-event-per-fill rule
— a cross-row consistency check, not expressible as a column constraint). Scoped deliberately
narrower than the full amendment range — this is the prerequisite every other container operation
needs (repack, container-sourced sale/spoilage FIFO, the C.4 transfer fix all need real
`container_fills` rows to exist first, and none did). Written directly, not delegated, same
reasoning as decision #37 (live schema, full context from authoring `SPEC.md`).

**A real security point, not just a style choice.** `SECURITY DEFINER` bypasses RLS entirely —
the careful per-role policies in `rls-policies.sql` do *not* protect a caller of this function.
Both new functions do their own internal role check in the function body
(`current_user_role() not in (...)` → `raise exception ... using errcode = '42501'`), matching
the `containers`/`bills`/`container_fills` INSERT policies (admin, co-admin, vendor-rep,
super-worker — receiving is not a worker task, unlike repack will be). This matters for any
future `SECURITY DEFINER` function too: the existing `record_transfer_cascade` (migration 0005)
has no internal role check, which was fine only because Mode A's transfer was genuinely open to
every role — that stops being true once a transfer-fix RPC is built for D29 (transfer restricted
to admin/co-admin only), and that RPC will need an explicit role check this one didn't need to
teach it.

**A schema gap found while designing the next piece, flagged rather than improvised past.**
`SPEC.md` §4.3.9 (repack) asks for one `movements` row referencing *both* the source and
destination `container_fill_id` — but migration 0006 only added a single `container_fill_id`
column to `movements`, not two. Discovered this mid-design for `record_repack`, before writing
any code against it. Not fixed in this migration — flagged here and in 0007's own header comment
as a concrete, scoped follow-up (likely a `source_container_fill_id` column added by a small
migration 0008) for whoever builds repack next, rather than quietly reinterpreting the spec's
intent to fit the existing column in the same breath as unrelated work.

**A real bug the live test caught, not a hypothetical one.** First live run of
`scripts/test-container-fill.mjs` failed 1 of 14 assertions: the capacity-exceeded error path
used `format('... %.3f ... %.2f ...', ...)` — Postgres's `format()` only supports `%s`/`%I`/`%L`/
`%%`, no printf-style precision specifiers, so it raised `unrecognized format() type specifier`
instead of returning the intended error message. Three call sites had the same mistake (capacity
check, per-item shortfall check, invalid-capacity check). Fixed by `round(x, N)`-casting through
`%s`. Re-ran the fixed function (re-applied via `CREATE OR REPLACE FUNCTION`, no new migration
number needed) and all 14 assertions passed. Worth remembering as a standing lesson: this class
of bug (a syntax mistake inside a string literal, invisible to `npm run validate`'s structural
checks) is exactly what a real call against the live database catches and a read-through doesn't
— matches `AGENT-BRIEF.md`'s explicit warning that this area is "the easiest thing in this whole
amendment to get subtly wrong."

**The test itself, and why it doesn't trust the RPC's own report.** `scripts/test-container-fill.mjs`
signs in as the real `admin@jayshankar.demo` and `worker@jayshankar.demo` demo users via the Auth
password grant rather than using the secret key to call the RPC — `current_user_role()` reads
`auth.uid()`, which is `NULL` for secret-key calls (no JWT subject), so testing the internal role
check requires a real session, the same way the app itself will call it. The secret key is used
only for read-back verification (confirming what's actually persisted in `container_fills`/
`container_fill_items` matches what the RPC claimed, not just trusting its return value) and for
cleanup afterward. All 6 test groups passed: happy path including the min-shelf-life rule across
2 SKUs, container-reuse rejection, capacity rejection, cross-bill rejection, worker-role
rejection (HTTP 403), and the helper function in isolation. Every row the test creates is deleted
afterward regardless of pass/fail — caught and fixed one bug in the test's own cleanup order
before the first live run (`container_fill_items` is `ON DELETE RESTRICT` back to
`container_fills`, not `CASCADE`; the items must be deleted first, by `container_fill_id`, or the
`container_fills` delete fails and leaves test data behind).

**When this changes.** `record_repack` (§4.3.9) is next, blocked on the `movements` schema gap
above — needs its own small migration before it can be written correctly rather than worked
around. The C.4 transfer-timestamp fix (§4.3.10) has no live 2-warehouse scenario to test against
yet and stays queued behind repack, which is the operation actually used day to day right now and
carries the identical "must never reset the freshness clock" risk. Once repack exists, wiring the
application forms (`SaleForm.tsx`/`SpoilageForm.tsx`) to container-aware RPCs becomes a genuine
MiniMax-appropriate delegated task again — this and #37 are schema/algorithm work, not frontend
work, which is why both stayed with the auditor.

### Decision 39 — Migration 0008: `record_repack` RPC, plus two real bugs found in already-shipped 0007 before either was called done

**What changed.** `supabase/migrations/0008_record_repack.sql` adds `record_repack(source_fill_id,
destination_container_id)` (§4.3.9, D21, D-amendment §C.3) and `movements.
destination_container_fill_id`. Closes the schema gap flagged in decision #38: §4.3.9 step 5
wants one `movements` row referencing *both* a source and destination `container_fill_id`, but
0006 only added one column. `movements.container_fill_id` keeps its existing "drawn from"
meaning (documented as a §4.2.21 addendum in `SPEC.md`, not silently reinterpreted); the new
column is populated only for `kind='repack'`. Inserts one `movements` row per source
`container_fill_item` (`sku_id`/`batch_id` are `NOT NULL`, same reason sale/spoilage cascades
already work this way), all sharing one `movement_group_id`. Confirmed against the live
`apply_movement_to_batches()` trigger before writing this (not assumed) that `'repack'` is
correctly absent from its decrement list — repack relocates already-packed fish between
containers, it isn't consumption, so `batches.kg_remaining` must stay untouched. `SECURITY
DEFINER` with its own role check, open to every real role (admin/co-admin/vendor-rep/worker/
super-worker) — repack, unlike receiving, is explicitly a worker task per `rls-policies.sql`.
Verified live via `scripts/test-container-repack.mjs` (28 assertions: happy path as the worker
role specifically, empty-source rejection, same-container rejection, destination-capacity
rejection, destination-not-available rejection, anon rejection) — all read back via the secret
key against what's actually persisted (`filled_at`/`expires_at` copied byte-for-byte from the
source, `container_fill_items` copied, `batches.kg_remaining` provably untouched), not the RPC's
own report.

**A second double-allocation bug, found by the repack test's own setup, not invented.**
`record_container_fill` (0007) validates a new pack request against `batches.kg_remaining` alone
— but packing doesn't decrement that column (packing isn't consumption; §4.3.8 decrements it
later, at container-sourced sale/spoilage time). That means the same physical fish could be
packed into two separate containers across two separate calls, each validating independently
against the same static, never-decremented number. Fixed by summing `container_fill_items.kg`
per batch (immutable and additive, so the sum is exactly "how much of this batch has already
been committed to a container") and using `LEAST(kg_remaining, kg − already_packed)` as the real
ceiling. Covered by 2 new assertions in `test-container-fill.mjs` (reject 5kg when only 4kg is
truly unpacked; accept exactly 4kg).

**A third bug, layered on the second, found only once the repack test actually ran against real
repacked data.** `record_repack` correctly *copies* `container_fill_items` onto its destination
fill (§4.3.9 step 3) — but the guard above, summing across *all* fills for a batch
unconditionally, then counts that same kg twice: once on the source fill (now empty, but its
`container_fill_items` row is never deleted — immutable, per RLS design) and once on the copy.
`container_fills.is_repack_copy` (boolean, default `false`) marks which fills are relocations
rather than fresh draws from a batch; the guard now excludes them. This is the kind of bug that
`AGENT-BRIEF.md` warned about generically ("easiest thing to get subtly wrong") turning out to be
concretely true across two *different* interacting functions, not just the one it was written
about — worth remembering as a general lesson: a guard clause tested in isolation can still be
wrong once a second feature (repack) creates data the guard wasn't written with in mind. Caught
before any real usage, by the test's own setup needing a second fill to exist.

**A file-ordering bug, caught by the user asking a plain process question, not by a test.** The
fix above was first written with `is_repack_copy` declared in 0008 (where it's *set*) rather than
0007 (where it's *read*). Migrations run in filename order on a fresh database — 0007 executes
before 0008 — so a from-scratch install would have broken at migration 7 of 8 with "column
`is_repack_copy` does not exist" the first time anyone packed a container. The user's question —
"when setting up a new database I just run these in sequence, right, not like now out of order" —
is what surfaced it; re-read both files against that exact scenario and moved the column
declaration into 0007, leaving 0008 to only set its value. No live re-run was needed for the
already-applied database (the column exists either way; `IF NOT EXISTS` doesn't care which file
declared it) — this was a source-file-only fix, verified by re-running both test scripts
afterward (16/16 and 28/28) to confirm the reshuffle didn't change live behavior.

**Re-run history for 0007, for the record, since it was live-patched three times in one day:**
(1) original version, capacity-check `format()` used printf-style `%.3f`/`%.2f` — Postgres
`format()` doesn't support that, fixed via `round()` + `%s`; (2) added the double-allocation
guard described above; (3) moved `is_repack_copy`'s declaration into this file for correct
fresh-install ordering. Each re-run was `CREATE OR REPLACE FUNCTION` / `ADD COLUMN IF NOT
EXISTS` — safe, idempotent, no data at stake yet (pre-launch, no real fills exist). Worth this
much narration specifically because "how many times did this change and why" is exactly what a
future session — or a fresh-install debugging session — needs to reconstruct without re-deriving
it from git history.

**When this changes.** The worker gets real delegated work again now: wiring `SaleForm.tsx`/
`SpoilageForm.tsx` to the container-aware RPCs, and a new repack UI screen, is genuine
frontend/application code with no schema risk — the next MiniMax-appropriate task. The C.4
transfer-timestamp fix (§4.3.10) is still queued behind that, for the same reason as decision
#38: no live 2-warehouse scenario exists to test it against yet.

### Decision 40 — Fifth delegated task (T6): repack UI screen, via MiniMax M3 — clean on the first pass

**What changed.** `src/pages/RepackForm.tsx` (new) plus 4 small edits (`mutations.ts`,
`FormFields.tsx`, `App.tsx`, `FloorDashboard.tsx`) wiring a new `/repack` screen to the already-
live, already-tested `record_repack` RPC (decision #39). First task since T4 with nothing wrong
in the diff itself — no auditor-side code fix needed. Full brief and audit:
`delegation/tasks/T6-repack-form/WORKER-PROMPT.md` / `AUDIT.md`.

**Independent re-verification, same discipline as every prior task.** Fresh `npm install` from
WSL (standing rule), all 3 gates re-run and matched (`validate` 72/0/0, `typecheck` clean,
`build` 143 modules). Went beyond diff-plus-gate review per this project's own lesson 2 (T3's
history: a correct diff and a green gate weren't sufficient there either) — seeded one real
container fill via the already-tested `record_container_fill` RPC, then hit PostgREST with the
*exact* select strings `SourceFillSelect`/`AvailableContainerSelect` use, signed in as the real
`worker@jayshankar.demo` user rather than the secret key. This confirmed two things empirically
rather than by inspection: (1) MiniMax's `as unknown as SourceFillRow[]` cast — justified in
their own comment as "the wire shape is a single object, Supabase JS just can't infer the
many-to-one cardinality without generated DB types" — is actually correct at the runtime level,
not merely a plausible-sounding rationale for a cast; (2) `rls-policies.sql`'s SELECT policies on
`container_fills`/`container_availability` actually let a worker session populate both dropdowns,
not just that the policies exist in the file. The second point matters specifically because a
blocked read would have looked identical to "no data yet" — silently wrong in a way a code
reading alone can't distinguish from correct-but-empty.

**A found-but-unrelated issue, fixed while it was directly relevant, not silently left.** The
live check surfaced 13 leftover `containers` rows (`TEST-C-*`) from this session's own earlier
`test-container-fill.mjs`/`test-container-repack.mjs` debugging runs — traced to a few runs that
predated a mid-session fix to those scripts' own cleanup tracking (decision #38's Test 3
container-tracking gap). Not a T6 defect, but would have shown up as fake entries in the real
`/repack` destination dropdown today. Confirmed none had any `container_fills` reference before
deleting via the secret key — database is clean (0 containers) as of this decision.

**When this changes.** §4.3.8 (container-sourced sale/spoilage FIFO) is next, written directly by
the auditor for the same reasons as decisions #37–#39 (live algorithm work, full spec context).
Once it exists, rewiring `SaleForm.tsx`/`SpoilageForm.tsx` becomes the next genuinely
MiniMax-appropriate task — explicitly scoped out of T6, not forgotten.

### Decision 41 — Migration 0009: container-sourced sale/spoilage FIFO (§4.3.8), a real multi-row cascade at last

**What changed.** `record_container_sale` and `record_container_spoilage` (§4.3.8, D21,
D-amendment §C.2) — the last piece of the container model's core algorithm suite. The most
intricate function this project has, because §4.3.8's prose doesn't fully resolve two real
design questions: a `container_fill` can hold multiple SKUs (§4.2.13), so "how much of SKU S is
left in fill F" isn't `fill.kg_remaining` (the fill's total across everything in it) — it's
derived per (fill, batch) pairing: `container_fill_items.kg` for that pairing minus whatever a
past sale/spoilage already drew from that exact pairing, found via `movements` rows sharing both
`container_fill_id` and `batch_id`. And since real stock right now sits almost entirely in
un-contained `batches` (no delivery flow requires packing yet, no real fill has ever existed
outside test data), a container-only cascade would leave today's actual stock unsellable — so
this is a genuine two-phase cascade: container-tracked stock first (soonest-`expires_at`-first,
the actual point of the feature), falling back to the older direct-batch FIFO
(`delivered_at` ASC) for whatever isn't packed yet, with the fallback excluding whatever portion
of a batch is *currently* sitting inside a container (packed but not yet drawn) — the same
"sum `container_fill_items`, subtract what's already drawn" shape as `record_container_fill`'s
(decision #38) double-allocation guard, applied here in the other direction.

**A deliberate scope upgrade, not a silent behavior change.** Every prior cascade in this
codebase — `record_transfer_cascade` (0005), the client-side `recordSale`/`recordSpoilage` — only
ever draws from ONE batch and reports a shortfall for the rest (decision #18, "W3: single-batch
fill... multi-batch cascade is a Pilot concern"). `SPEC.md` §4.3.2/§4.3.4/§4.3.8 always described
a real multi-row cascade; decision #18 deferred it, it was never rejected. Building the
container-sourced version is the natural point to finally build the real cascade, for both
phases consistently — a container fill split across repacks, or a SKU spread across several
batches, makes single-source shortfalls needlessly common otherwise. This is logged explicitly
so a future session doesn't read the older single-batch functions as the intended long-term
design.

**Verified live, 42 assertions covering the properties that are actually hard to get right, not
just the happy path:** a simple container-sourced sale (with the trigger correctly decrementing
the underlying batch too — §4.3.8's "in parallel... for pricing/lineage" falls out for free from
the existing `apply_movement_to_batches` trigger, no extra code needed since it decrements on
`batch_id` regardless of whether the movement came via the container or direct path); a
multi-fill cascade proven to actually drain the sooner-expiring fill first before touching the
later one; a mixed-SKU fill proven to leave the *other* SKU's portion completely untouched;
a container+direct split within one call proven to draw exactly the packed amount from the
container and exactly the un-packed remainder directly — not the whole batch twice; partial
fulfillment reporting a correct shortfall with the sales row using the fulfilled amount, not the
requested one; zero-stock returning a clean error with no sales row; the sale/spoilage role
split (worker rejected for sale, explicitly allowed for spoilage, matching
`rls-policies.sql` exactly); and a second call after a fill is fully drained correctly finding
nothing left in it rather than re-drawing or going negative. One test assertion was itself wrong
on the first run (checked for zero historical movements on a SKU that turned out to be a real
demo SKU with pre-existing seed-data movements unrelated to the test) — fixed by removing the
overreaching check; the RPC's actual behavior was correct throughout, the test assertion wasn't.

**A known, narrow race condition — flagged, not fixed here.** `record_container_fill` (0007)
reads `batches.kg_remaining` and `container_fill_items` without a `FOR UPDATE` lock; this
migration's direct-fallback phase does lock `batches`. A plain `SELECT` never blocks on another
transaction's lock in Postgres, so two truly concurrent calls — one packing a batch, one selling
from it directly — have a narrow window to race. Not fixed here: closing it means re-editing and
re-testing an already-shipped, already-tested file (0007) for a race that needs two operations on
the exact same batch within milliseconds, on a single-operator, sequential-physical-actions
business. Noted in `HANDOVER.md`'s gotchas rather than silently left undocumented.

**When this changes.** `SaleForm.tsx`/`SpoilageForm.tsx` rewiring to these two RPCs is now a
genuine MiniMax-appropriate task (T7) — pure frontend/application code, no schema risk, same
shape as T6. The C.4 transfer-timestamp fix (§4.3.10) is still queued behind that, unchanged
reasoning from decisions #38–#40.

### Decision 42 — Sixth delegated task (T7): sale/spoilage rewire, via MiniMax M3 — clean, second in a row

**What changed.** `recordSale`/`recordSpoilage` in `src/lib/mutations.ts` fully replaced —
client-side single-batch FIFO lookup deleted entirely, now calling `record_container_sale`/
`record_container_spoilage` (decision #41). `batchId` removed from both result interfaces (the
new cascade can draw from several batches in one call; independently re-confirmed zero
references anywhere in `src/`, not just trusting the worker's own grep). `SaleForm.tsx`/
`SpoilageForm.tsx` updated to surface the new `containerSourcedKg`/`directSourcedKg` split in
their success messages, only when both contributed (a T1 call the brief explicitly allowed).
Second task in a row (after T6) needing no auditor-side code fix. Full brief and audit:
`delegation/tasks/T7-sale-spoilage-rewire/WORKER-PROMPT.md` / `AUDIT.md`.

**Independent re-verification found the real remaining risk correctly.** The underlying cascade
logic is already covered by 42 live assertions (decision #41) — re-testing it here would be
redundant. What T7 actually introduced was new *glue*: JS-to-RPC param mapping and
response-to-UI-message rendering, both done through a `data as {...}` cast that TypeScript never
validates against the real runtime shape. Wrote a script mirroring the exact new
`recordSale`/`recordSpoilage` bodies and the forms' exact message-building logic, ran it against
the live database: confirmed the split-message path (`"Sale <id> recorded (6.000 kg from
containers, 4.000 kg from storage)."`) and the no-split path (`"Spoilage recorded."`) both render
the precise text a user would see — not just that the underlying numbers were correct. This is
the same discipline as T6's audit, applied to what was actually new risk in T7 rather than
re-proving what decision #41 already proved.

**When this changes.** The container model's core algorithms and their frontend wiring are now
complete: receiving (0007/T6-adjacent), repack (0008/T6), sale/spoilage (0009/T7). Only the C.4
transfer-timestamp fix (§4.3.10) remains from the original amendment, still queued behind a live
2-warehouse scenario to test it against.

### Decision 43 — Migration 0010: the C.4 transfer-timestamp fix — built and tested against a temporary second warehouse

**What changed.** `record_transfer_cascade` (migration 0005) fixed at last: the destination
batch's freshness timestamp now carries through from the source instead of resetting to `now()`
— `container_fills.filled_at` when the source was container-tracked, or the source batch's own
`delivered_at` otherwise. `SPEC.md`'s prose scopes its example to the container case only; the
same "never reset apparent freshness" principle applies identically to un-contained stock, and
both cases are handled by the same function, so fixing one half and leaving the other broken
would have been an arbitrary, undocumented half-fix of the exact bug class this migration exists
to close — both are fixed. Source selection now *prefers* container-tracked stock, soonest-to-
expire, over an arbitrary older un-contained batch (D21/§2.5a) — without that preference, the
fix would have nothing real to correct, since the old `delivered_at ASC` selection could pick
un-contained stock over expiring container stock even when both exist.

**Two things found while building this, fixed as part of it, not bolted on separately.**
(1) `record_transfer_cascade` has never had an internal role check — harmless under Mode A
(transfer was open to every role), a real gap since D29 restricted transfer to admin/co-admin,
flagged explicitly as a known follow-up back in decision #38. Closed here. (2) Letting transfer
draw from `container_fill_items` at all — the only way to have a `filled_at` to carry through —
makes it a third consumer of container-tracked stock alongside `record_container_sale`/
`record_container_spoilage`. Their "already drawn" / "currently packed" computations (migration
0009) only checked `kind IN ('sale','spoilage')`; without adding `'transfer'` to both filters,
a transfer could silently make container stock double-available to a later sale — a fresh
double-allocation gap this migration would have introduced if shipped without the cross-cutting
fix. Closed via `CREATE OR REPLACE` on both 0009 helpers, in the same migration.

**A deliberate scope decision, documented so it isn't mistaken for an oversight later.** Transfer
stays single-source-draw — one container fill OR one un-contained batch per call — unlike
sale/spoilage's decision #41 upgrade to a full multi-batch cascade. `SPEC.md` §4.3.3's original
text does describe a fuller cascade with weighted-average pricing across multiple sources, which
would be a real, larger scope. Not taken on now because transfer is still dormant (D29 — only
one real warehouse exists) and `HANDOVER.md` already flags the vendor-attribution rule as "one of
three plausible choices... easy to amend," i.e. provisional — building heavier machinery around
an unsettled, unused design wasn't the right trade. The container-aware *source selection* is
what actually matters for the fix to have effect; the multi-batch cascade is a separate, later
decision if transfer ever sees real use.

**Verified live, 26 assertions, against a temporary second warehouse — created and fully deleted
within the test run, not left behind.** The user explicitly asked to build and test this now
rather than wait for a real second warehouse to exist; a *permanent* second warehouse would have
misrepresented the business's real state (D14's real-schema-fake-content discipline, D29's
single-warehouse lock), so the test creates one, exercises the fix, and tears it down in cleanup
regardless of pass/fail — confirmed independently afterward that `warehouses` shows exactly one
row (`main`) post-run. Covered: the timestamp fix on both paths (container-sourced and direct-
fallback, each verified against whichever batch FIFO *actually* selected, not assumed — one
assertion was initially wrong for exactly the reason decision #41's Test 7 was: a real pre-
existing demo-seed batch outranked the test's own fixture in FIFO order, fixed by looking up the
real source via the movement row rather than assuming); container-tracked stock correctly
preferred over older un-contained stock; shortfall reporting; zero-stock and same-location
rejection; the admin/co-admin-only role check; and, most importantly, the cross-cutting fix —
after a transfer draws 6kg of a 10kg container-tracked batch, a subsequent sale of the same SKU
correctly finds only the remaining 4kg, not 10, proving the `'transfer'` addition to 0009's
filters actually closes the gap it was meant to close.

**When this changes.** The container model's core algorithm suite (SPEC-AMENDMENT-v2's §C) is
now fully built, live, and tested end to end: receiving, repack, sale/spoilage, transfer. What
remains is genuinely open, not deferred out of caution: whether to build the multi-batch
transfer cascade (only worth it once transfer sees real use), and the still-unresolved items in
`SPEC.md`'s closing §D (box quantities, GST status, credit terms, second-warehouse timing,
Tanglish UI).

### Decision 44 — Migration 0011: custom container sizes + a real DELETE policy (D32)

**What changed.** `containers.capacity_kg`'s CHECK constraint relaxed from the fixed 5 presets
to `> 0` (custom sizes), and a DELETE RLS policy (admin/co-admin) added — previously none
existed at all, so deletion was impossible for every container, including ones that were never
filled. The actual delete-*prevention* rule the user asked for ("since we put fish in it, we
shouldn't be able to delete it") needed **no schema change** — `container_fills.container_id`
has been `ON DELETE RESTRICT` since migration 0006, it just had nothing to protect against since
DELETE was already blocked entirely. Resolves D32 (SPEC.md, logged alongside this) and the
"box/container quantities" item `SPEC.md`'s closing §D flagged as open: quantities turn out to
be wholesaler-entered data (a bulk-register convenience over individually-numbered containers),
not a fixed spec fact.

**Verified live, not just applied.** User reported Supabase's SQL Editor flagged the migration's
`DROP CONSTRAINT` as a "destructive operation" — correctly identified as Supabase's standard
confirmation dialog for any constraint drop (same class of caution the editor shows for
migration 0006's `movements_kind_check` swap, which ran fine), not a real block. Confirmed
applied via direct probe (inserting `capacity_kg=12`, a non-preset value, succeeded) and the
actual point of the migration confirmed live under real RLS, not just the secret key: a
never-filled container deletes cleanly for admin; a container with any fill history is rejected
with a real `23503` FK violation (`"Key is still referenced from table container_fills"`), not a
silent no-op or an app-level check that could drift from the database's actual guarantee.

**Cross-reference:** SPEC.md D32, `supabase/migrations/0011_container_custom_sizes.sql`.

### Decision 45 — Capacitor Android wrap scaffolded (D18)

**What changed.** `@capacitor/core`/`@capacitor/cli`/`@capacitor/android` installed;
`capacitor.config.ts` added (`appId: 'com.jayshankar.fishwholesale'` — a real but not-yet-locked
placeholder, changeable freely until the first actual Play Store submission, after which
changing it means shipping as a new listing rather than an update; `appName: 'Jayshankar'`,
matching the existing PWA manifest's `short_name` rather than inventing a separate label);
`npx cap add android` scaffolded the native `android/` project (confirmed `applicationId`/
`versionCode`/`versionName` match the config, not just that the command exited 0); a
`cap:sync` npm script (`vite build && npx cap sync android`) added and confirmed working —
every future web-code change flows into the native project with one command, no manual asset
copying.

**Environment split, consistent with this project's whole WSL2/Windows pattern.** No
Java/Android SDK/Gradle exist in this WSL2 environment — checked directly before starting, not
assumed. Everything done here (dependency install, config, `cap add android`, `cap sync`) is
pure file generation/copying and needed none of that toolchain. Actually compiling, running on
an emulator/device, or producing a signed release build needs a real Android toolchain — matches
how every other build step this session has worked (WSL2 plans/audits, Windows-native tools
build), so that's Windows-side work (Android Studio, which bundles its own JDK/SDK/Gradle
management far more smoothly than a hand-rolled WSL2 CLI install), not something stood up fresh
in WSL2 for this one task. The project folder is already shared between WSL2 and Windows, so the
`android/` directory this decision created is immediately visible and usable from
`C:\Users\user\Desktop\Jayshankar\android` with no extra step.

**Not yet done, flagged rather than silently skipped:** real app icons (Android needs rasterized
PNGs at several densities plus an adaptive-icon XML, not the existing `public/icon.svg` directly
— no `convert`/`rsvg-convert`/`inkscape` available in this environment to generate them; Android
Studio's own Image Asset Studio does this correctly from a source image and is the right tool for
it, not something worth hand-rolling blind here); the first actual debug/release build; and
confirming the `appId` placeholder with the user before any real Play Store submission.

**Cross-reference:** `capacitor.config.ts`, `android/`, SPEC.md D18.

### Decision 46 — Migration 0012: customers/payments/reversal_requests/notifications/user_role_history, and a real co-admin fix

**What changed.** All five tables SPEC.md §4.2.16–4.2.20 already fully designed, built exactly
to that design — schema only, deliberately: the algorithms on top (recording a payment,
executing an approved reversal per §4.3.11, dispatching a notification) are separate follow-up
RPC work, same split as "migrate the container tables" (0006) vs. "build the container
algorithms" (0007–0010). `user_role_history` maintains itself via a trigger on `users`
insert/update, backfilled once for existing users so nobody shows a gap.

**A real, previously-undiscovered gap, found and fixed, not invented for this migration.**
`users.role`'s CHECK constraint has never included `co-admin` since migration 0001 — D28 locked
it as a real role back in the v2 merge, every RLS policy since decision #37 has assumed it
works, but the constraint itself was never updated. It has been structurally impossible to set
any real user's role to `co-admin` in this database this whole time. Found while adding
`users.can_self_reverse` for this same migration (touching users-adjacent schema surfaced it),
fixed alongside — the constraint, and `handle_new_user()` (migration 0002), which independently
rejected `co-admin` in signup metadata and would have kept the gap open even after the
constraint allowed it directly.

**A second, unrelated finding, surfaced by the test rather than assumed away.** Verifying
notifications' owner-only RLS turned up two rows per demo email in `public.users` — a real
account (matching `auth.users`, what `auth.uid()` resolves to) and a fixed-placeholder-UUID
leftover from the original Mode A raw-SQL seed, with no matching `auth.users` row at all. The
fake rep row is referenced by 50 `sales.sold_by` rows (the original demo dataset's fixtures).
Pre-existing, not introduced by this migration, and harmless to real app behavior — nothing in
the shipped app resolves identity by email lookup, everything correctly uses `auth.uid()`. The
test script itself had done exactly that (an email lookup that silently picked the wrong of two
matching rows) — fixed by decoding the real id straight from the signed-in JWT instead, the same
way the app itself resolves identity. Not cleaned up in the database itself: doing so means
either deleting the fake rows (blocked by `sales.sold_by ON DELETE RESTRICT` while those 50
historical demo sales reference them) or re-pointing 50 fixture rows to the real ids — a real,
separate data-migration task on fake/demo content, not something this migration's scope called
for. Flagged in `HANDOVER.md`'s gotchas so a future session doesn't hit the same trap blind.

**Verified live, 23 assertions**, not just applied: promoted a temporary real auth user to
`co-admin` (impossible before this migration) and confirmed `user_role_history`'s trigger
correctly closed the old role row and opened a new one; signed in *as* that newly-promoted user
and confirmed an admin/co-admin-gated RLS action (a `containers` UPDATE) actually succeeds for
them and correctly still fails for a plain worker — proving `co-admin` is genuinely treated as
admin-equivalent by RLS, not just accepted by the constraint. Also covers: `customers`' broader
insert/update policy (vendor-rep allowed, unlike `vendors`) vs. worker correctly rejected;
`payments` is append-only and its `amount > 0` CHECK holds; `reversal_requests`' request/approve
split (a vendor-rep cannot approve their own request, admin can); `notifications`' owner-only
visibility (confirmed both that the owner sees/can-mark-read their own, and that a different
user cannot see it at all); `user_role_history`'s admin-only read.

**When this changes.** The payment-recording, reversal-execution, and notification-dispatch
RPCs are the natural next algorithms layer, once needed — none built yet, deliberately. GST
field activation (`customers.is_gst_registered`/`gstin` now exist) is the next queued step per
the user's own sequencing. `notifications.type`'s taxonomy (§F) still needs reading in full
before any dispatch logic enforces it.

### Decision 47 — First real-device findings: a table-clipping bug, a missing back link, and the Android hardware back button was never wired

**What changed.** Three fixes from the user's first real-device test (Poco X6 Pro, via Android
Studio) — the kind of bug class that's invisible in web/PWA testing but immediate the moment an
app is actually wrapped natively, so worth reading past "three small fixes" to why each one only
showed up now.

1. **`StockBySku.tsx` clipped its "By location" column on a phone-width screen.** The table sat
   in a `div` with plain `overflow-hidden` and no scroll container — content that didn't fit was
   silently cut off, not scrolled. Fixed with a nested `overflow-x-auto` wrapper around just the
   `<table>`, keeping the outer div's `overflow-hidden` for its original purpose (rounded-corner
   clipping, harmless to combine with an inner scroll container) plus `whitespace-nowrap` on the
   location-breakdown cell so it triggers real horizontal scroll instead of wrapping.

2. **`AuditLog.tsx` (`/admin/audit-log`) had no back link at all** — the one page in the app
   missing the `<FormFooter backHref=... />` pattern every mutation form already uses. Directly
   matches what the user reported ("no visible back button to get out of subdirectories") —
   confirmed by checking every page, not guessed: all 5 mutation forms already had it,
   `AuditLog` was the sole gap.

3. **The Android hardware/gesture back button was never wired to the app's navigation at all** —
   `@capacitor/app` wasn't even a dependency. This is the deeper, compounding cause behind the
   same symptom: a web/PWA build relies entirely on the browser's own back button/gesture, which
   a Capacitor-wrapped native app has none of — without explicitly listening for Capacitor's
   `backButton` event and calling `window.history.back()`, pressing the phone's back
   button/gesture on ANY page (not just `AuditLog`) does nothing useful, or exits the app
   outright. Installed `@capacitor/app`, wired a listener in `App.tsx` using the documented
   `canGoBack` pattern (step back through real history if there's history to step back through,
   exit the app only once there truly isn't) — guarded behind `Capacitor.isNativePlatform()` so
   it's a complete no-op on web/PWA, where the browser's own back handling must be left alone.
   `npx cap sync android` confirmed the plugin registered correctly in the native project
   (`capacitor.plugins.json` shows `com.capacitorjs.plugins.app.AppPlugin`) — no manual
   `AndroidManifest.xml`/`MainActivity.java` edit needed for this plugin.

**Why fixed directly rather than delegated.** Small, well-understood, single-component/file
changes (fix 1, fix 2) not worth a delegation round-trip's overhead mid-live-device-test — the
user was actively iterating on their phone and wanted to keep moving. Fix 3 is genuinely new
territory (first native-plugin integration in this project since the Capacitor scaffolding
itself, decision #45) but small in code footprint and, like the scaffolding, can only be
functionally verified on a real device — the same reasoning that kept Capacitor's own setup with
the auditor rather than delegated.

**Not verified live by the auditor** — cannot be: none of this is testable from WSL2 (no
browser, no emulator, no device). `npm run typecheck`/`validate`/`cap:sync` all confirmed clean,
and the plugin's correct native registration was confirmed directly, but whether the back button
actually behaves correctly and whether the table now scrolls instead of clipping is the user's
own device to confirm next, the same handoff shape as the whole Capacitor thread.

**Cross-reference:** `src/components/StockBySku.tsx`, `src/pages/AuditLog.tsx`, `src/App.tsx`,
decision #45.

### Decision 48 — Migration 0013: credit terms (D33), verified live

**What changed.** `customers.credit_limit`/`credit_period_days` (both nullable — no value means
no formal cap/due-date tracking, not zero) plus a derived `customer_credit_status` view
(`security_invoker = true`, same discipline as `container_availability`) computing real-time
outstanding balance, an over-limit flag, and days-overdue on the oldest unpaid sale. The
payment-tracking mechanics this builds on already existed (migration 0012's `payments` table);
what was missing was any limit/period concept or visibility into it at all. `record_container_sale`
is deliberately untouched — enforcement is soft (D33, extending D25's existing "incomplete data
warns, never blocks a core mutation" principle), a flag for the rep/admin to see, not a refusal.

**Verified live, 15 assertions**, exercising the actual math, not just that the view returns
rows: no-sales baseline (0 balance, not over limit); an unpaid sale correctly shown as
outstanding; a *partial* payment reducing the balance by exactly that amount, not zeroing it;
full payment returning the balance to 0 and clearing `oldest_unpaid_sale_at`; a customer over
their limit correctly flagged; a customer with `credit_limit = NULL` never flagged regardless of
how large their balance is (a real distinction the view has to get right — `NULL` isn't "limit
zero"); and `days_overdue` computed correctly against a real backdated sale (a sale 20 days old
against a 15-day credit period reads exactly ~5 days overdue). Read back under real `vendor-rep`
RLS, not the secret key, since `security_invoker = true`'s whole point is that the view must
respect the querying user's own permissions on the underlying tables — worth actually proving,
not assuming.

**Cross-reference:** `supabase/migrations/0013_credit_terms.sql`, SPEC.md D33.

### Decision 49 — SKU management UI, built directly from a real client call; and a real co-admin routing gap found while building it

**What changed.** `src/pages/SkuManagement.tsx` (new) — the first UI this app has ever had for
creating or editing a SKU. The backend was always ready (`skus_insert_admin`/
`skus_update_admin` RLS policies exist and have for a while); the gap was purely frontend, and
it's exactly what the client described on a call relayed by the user: "I'm not able to edit or
modify... if I add a new SKU, how can I add?"

**Deliberately simple, per the same call** ("simple, basic interface... they don't study even
eighth or ninth"): the add/edit form asks for 5 fields up front (name, Tamil name, type, size,
sold-by unit); shelf life, storage, low-stock warning, and notes are defaulted sensibly and
tucked behind a collapsed "More settings," not forced on every user. `code` (the database's
unique identifier) is auto-generated from name + size and never typed by hand, with a
retry-with-suffix on the rare collision — confirmed live that Postgres really does return error
code `23505` for the unique violation this retry logic checks for, not assumed.

**A real, significant gap found while building this, fixed alongside it, not left for someone to
hit blind.** `Role` (the frontend TypeScript type) has never included `'co-admin'` anywhere —
`defaultRouteFor`/`homeFor`'s switch statements, `KNOWN_ROLES`, `RoleBadge`'s style/label maps,
and all three `/admin/*` routes only ever checked for `'admin'`. A real co-admin user — decision
#46 made this role actually settable in the database for the first time this same session — would
have been completely unable to use the app's UI at all: no route to send them to, every admin
screen's `Shell` check rejecting them outright. Found because adding `'co-admin'` to the `Role`
type turns every place that needs updating into a compiler error (a `Record<Role, string>` must
cover every union member) — ran `tsc` immediately after the type change specifically to use the
compiler as the checklist, rather than trust a manual grep alone; a supplementary grep for
`=== 'admin'` (a pattern the compiler can't catch, since TS doesn't flag narrow comparisons
against one member of a union as incomplete) found nothing further. Fixed all 4 compiler-caught
spots plus wired co-admin into every `/admin/*` route (`expected={['admin', 'co-admin']}`,
matching the multi-role pattern already used elsewhere) and gave it its own badge color
(violet — same admin tier as indigo, visually distinct).

**Google OAuth — discussed, not built yet.** User wants Google sign-in for the next version
shared with the client (serves both "real admin login" and "simple enough for a non-technical
user" — no password to manage). Genuinely blocked on the user first creating OAuth credentials
in Google Cloud Console and configuring the provider in Supabase Dashboard — both manual,
external-console steps. Flagged the one real technical gotcha ahead of time rather than after:
a naive in-WebView OAuth redirect would be rejected by Google's policy against embedded
WebViews; the correct approach opens the flow in the system browser (`@capacitor/browser`) and
catches the redirect via a deep link. Not started — waiting on the user's console setup.

**Cross-reference:** `src/pages/SkuManagement.tsx`, `src/lib/auth.ts`, `src/App.tsx`,
`src/components/Layout.tsx`, `src/components/RoleBadge.tsx`, `src/pages/AdminDashboard.tsx`,
decision #46.

### Decision 50 — Warehouse + team management UI, and a clear split on "can admin create new users"

**What changed.** Two more screens closing the same class of gap as decision #49's SKU
screen — backend RLS already allowed the action, no frontend ever existed:

- `WarehouseManagement.tsx` — list/add/edit warehouses. Only one warehouse row has ever existed
  (`'main'`, seeded directly by migration 0006); this is what actually makes a real second
  warehouse (D23/D29) possible to set up without a raw SQL insert. Same simplicity discipline as
  SKUs: one visible field (the warehouse's display name), `warehouses.name` (the internal unique
  identifier) auto-derived from it, never typed by hand.
- `TeamManagement.tsx` — list every user, tap one to change their role or turn their access off.
  This is the "promote an existing user" half of the user's question ("can the admin create new
  users and new co-admins") — the backend has fully supported this since decision #46, there was
  just no UI. Includes a self-edit warning (not a hard block — a deliberate, proportionate
  choice, not an oversight: preventing it entirely would need a live "is there at least one
  other active admin" check, more complexity than this first pass warrants; the warning is
  prominent and the action is still reversible by any other admin/co-admin).

**The other half of that question — creating a genuinely brand-new user who has never signed
in before — does NOT work, and isn't just a missing UI.** `public.users_insert_admin` RLS exists,
but inserting a raw `public.users` row without a matching `auth.users` row is useless — there'd
be no password, no way for that person to ever actually sign in. Creating a real, login-capable
account requires the Supabase Admin API, which requires the service-role/secret key — a key
that must never reach the client, by the project's own standing rule (`SPEC.md` §4.1). The only
correct way to let the admin do this from inside the app is a Supabase Edge Function: a small
server-side function that verifies the caller is really an admin/co-admin, then uses the secret
key internally (never exposed) to invite the new user. This project has never had one — no
`supabase/functions/` directory exists. Not built in this pass; explained to the user directly,
including the one real Capacitor-adjacent-in-spirit gotcha worth knowing before building it:
`inviteUserByEmail` sends a real email, which depends on Supabase's own email sending actually
being reliable at this account's current tier (rate limits, deliverability) — not a blocker, but
worth surfacing before someone is confused why an invite email never arrived.

**Verified live, 8 assertions** across both new screens (warehouse insert/update, the
duplicate-name retry path's `23505` assumption, worker correctly rejected) — same discipline as
decision #49, not trusting the RLS/retry-logic combination just because each half was separately
tested before.

**Cross-reference:** `src/pages/WarehouseManagement.tsx`, `src/pages/TeamManagement.tsx`,
`src/pages/AdminDashboard.tsx`, `src/App.tsx`, decisions #46/#49.

### Decision 51 — D34 + §4.3.12: the user-invitation Edge Function, specified before any code

**What changed.** SPEC.md gets a new locked decision (D34) and a new algorithm section
(§4.3.12) for the user-invitation workflow proposed in decision #50 — written and committed
*before* writing a single line of the actual Edge Function, at the user's explicit instruction.
Matches this project's own first principle more literally than usual: TINS means the spec is the
source, not a courtesy written up after the fact.

D34 states the real constraint driving the design: creating a brand-new login needs the
service-role/secret key, which must never reach the client (§4.1) — the first time this project
has needed logic that can't live inside a Postgres `SECURITY DEFINER` function, since creating
an `auth.users` row isn't something RLS or `SECURITY DEFINER` has any authority over at all;
it's a separate Auth Admin API surface. §4.3.12 specifies the exact workflow: verify the caller
using their *own* JWT (reusing the existing RLS boundary rather than hand-rolling a second
authorization check), only then construct a service-role-scoped client — inside the function,
never returned to the caller, never logged — call `inviteUserByEmail`, and let the *already-
existing* `handle_new_user()` trigger (fixed for `co-admin` in decision #46) do the rest with no
changes needed.

**One correctness catch, in the writing itself, worth recording.** The first draft of D34 quoted
§4.1 as saying something it doesn't actually say — misremembered from `HANDOVER.md`'s gotchas
section instead of read fresh from §4.1 itself. Checked before finalizing, not after: the real
§4.1 text is "the publishable key is the only thing shipped in the JS bundle. The secret key
never leaves the server," which is what D34 now actually quotes, with the audit-log-bypass
consequence correctly attributed to `HANDOVER.md`, not presented as if it were `SPEC.md`'s own
words. A small thing, but the exact kind of small thing spec-first discipline exists to catch —
a wrong quote in the source document is worse than an imprecise one in a chat reply, since the
spec is what everything downstream gets built against.

**Also closed while in the area, not a new problem:** `@capacitor/app` (decision #47) was
never logged in §4.4's dependency table, despite AGENTS.md's own rule that every new dependency
gets logged there. Added retroactively, noted as should-have-been-logged-at-the-time rather than
silently backfilled without saying so. §4.4 also now explains that Edge Functions are a
distinct artifact type from that table entirely (Deno runtime, not an npm dependency,
`supabase/functions/<name>/`) — worth stating explicitly since `invite-user` is the first one.

**When this changes.** The actual Edge Function code is next, built directly against this spec
rather than the other way around.

**Cross-reference:** SPEC.md D34, §4.3.12, §4.4; decision #50.

### Decision 52 — `invite-user` Edge Function + the invite form, built directly against §4.3.12

**What changed.** `supabase/functions/invite-user/index.ts` — this project's first Edge
Function, implementing §4.3.12 exactly as specified rather than improvised against it: two
Supabase clients (one scoped to the caller's own JWT for verification, one built from the
service-role key only after that verification passes, never returned to the caller or logged),
role validation against the same 5-value list the database's own `users_role_check` enforces,
`inviteUserByEmail` with `role`/`display_name` in the invite's metadata so the existing
`handle_new_user()` trigger (already fixed for `co-admin`, decision #46) picks it up with zero
changes. `TeamManagement.tsx`'s placeholder "not available" box is replaced with a real form —
email, name, role — calling `supabase.functions.invoke('invite-user', ...)`, which attaches the
signed-in caller's own JWT automatically, matching exactly what the function verifies against.

**Not yet verified live — cannot be, from this environment.** No Supabase CLI exists in WSL2
(same gap that's applied to every migration this session), and unlike a SQL migration, an Edge
Function can't be "run" via PostgREST either — it has to actually be deployed (Supabase
Dashboard's Edge Functions UI, or the CLI) before it exists to call at all. `npm run
typecheck`/`validate`/`cap:sync` all confirmed clean; the actual invite flow — including whether
the invite email actually arrives, the one known limitation already flagged in §4.3.12 — is the
next thing to confirm once deployed, same handoff shape as every other live-database or
live-device step this session.

**Cross-reference:** `supabase/functions/invite-user/index.ts`, `src/pages/TeamManagement.tsx`,
SPEC.md §4.3.12/D34, decision #51.

### Decision 53 — Phone-number invitation (D35), documented first per explicit instruction, then built

**What changed.** User asked "can we invite using phone number too?" directly after decision
#52 shipped. Per the user's own explicit instruction on #51 ("properly write the necessary
documentation first before starting the build"), SPEC.md D35 was written and locked before any
code: `invite-user` now accepts `email` XOR `phone`, never both. Email is unchanged
(`inviteUserByEmail`). Phone is a genuinely different Admin API call —
`admin.createUser({ phone, phone_confirm: true, user_metadata })` — because there's no phone
equivalent of an emailed set-password link: the account is created already confirmed (the admin
is vouching for the number by typing it in while handing over the phone), and from then on the
person signs in with `signInWithOtp`/`verifyOtp` — a fresh SMS code every time, no password ever.

**Two facts verified live before finalizing the design, not assumed from memory** (this
session's established discipline, applied again here): (1) GoTrue represents "no email" (and
"no phone") as `''`, not a true `NULL`, even via the raw Admin API — confirmed by actually
calling `POST /auth/v1/admin/users` with a phone-only payload and inspecting the real response
before writing migration 0014's `CREATE OR REPLACE handle_new_user()`. This mattered: a naive
`coalesce(new.email, new.phone, ...)` would never have fallen through to phone at all, since
`''` is non-NULL. Fixed with `nullif(new.email, '')` throughout, and the new
`users_identity_present` CHECK is written the same defensive way rather than a bare
`IS NOT NULL`. (2) GoTrue stores/returns phone numbers without the leading `+` — cosmetic, but
would have shown up as a confusing raw digit string in the Team list and header; added
`formatPhone()` (`src/lib/auth.ts`) as a display-only re-prepend, never used for comparisons.

**Schema fix this required, found by reading the actual constraint, not guessed:**
`users.email` has been `NOT NULL` since `0001_init.sql` — a phone-only account would have
silently broken `handle_new_user()`'s INSERT (rolling back the whole `auth.users` INSERT
transaction) had this shipped without migration 0014 making `email` nullable first.

**Built alongside the migration and Edge Function:** `SignInForm.tsx` gained a real phone+OTP
sign-in path (two-step: request code, verify code) — needed for the phone-invited account to be
usable at all, not just invitable; `TeamManagement.tsx`'s `InviteForm` gained an email/phone
method toggle; `auth.ts`'s `AppUser.email`/`.phone` widened to nullable (the two remaining `!`
non-null assertions on `s.user.email` were real latent bugs for a phone-only session, now fixed).
`scripts/test-phone-identity.mjs` written to verify the schema/trigger side live (account
creation, `public.users` population, the identity-presence CHECK actually rejecting an all-null
row) — real SMS delivery and `signInWithOtp`/`verifyOtp` end-to-end cannot be tested from this
environment (no SMS provider connected yet, no way to receive a text here) and is the one part
of this the user will verify directly, using their own phone number for the dev/test account
before switching it to the real owner's number at go-live (an operational Dashboard step, not a
feature — D35 says so explicitly).

**Not yet verified live — migration 0014 not yet applied.** `npm run typecheck`/`validate`/
`build` all confirmed clean. Once the user applies 0014 via the Dashboard SQL Editor,
`test-phone-identity.mjs` needs to actually be run (already written, already run once
pre-migration to confirm it fails for the *expected* reason — the old NOT NULL constraint — not
some other bug), and the Edge Function's phone branch needs redeploying since the function file
changed again.

**Cross-reference:** SPEC.md D35, §2.2.1, §4.2.1, §4.3.12; `supabase/migrations/
0014_phone_or_email_identity.sql`; `supabase/functions/invite-user/index.ts`;
`src/lib/auth.ts`, `src/components/SignInForm.tsx`, `src/pages/TeamManagement.tsx`; decision #52.

### Decision 54 — Email invite becomes a shareable link, not an auto-sent email (D36)

**What changed.** User's own idea, offered as "graceful degradation," confirmed correct for the
email path and built the same session: `invite-user`'s email branch switches from
`inviteUserByEmail` to `auth.admin.generateLink({ type: 'invite', email, options: { data,
redirectTo } })` — creates the account exactly as before but **sends nothing**; the function
returns `invite_link` to the caller instead. `TeamManagement.tsx`'s `InviteForm` no longer shows
"invite sent" and auto-closes for the email path — it shows the link itself with a "Copy link"
button (and a native `navigator.share()` button where the device supports it), and stays open
until the admin explicitly hits Done, since closing early would lose the link with no way to get
it back short of re-inviting. This directly retires D34's original "known, accepted limitation"
(email deliverability depending on Supabase's own sending reputation) rather than living with
it, and matches how this client actually communicates (WhatsApp, confirmed directly from their
own phone-call feedback and this project's existing WhatsApp-automation track, D20) far better
than "check your email."

**Corrected the user's framing before building, not just built what was asked.** The user's idea
described inviting "by phone number or email" and getting a URL either way. Checked against
Supabase's actual API surface: there is no phone equivalent — a phone account (D35) already
sends nothing at invite time (`phone_confirm: true`), and the SMS cost D35 accepts is a
**sign-in-time** cost (a fresh OTP every sign-in), not an invite-delivery cost a link could
remove. This decision is scoped to email only; the phone path is unchanged from D35.

**Real prerequisite, found by checking the repo's own state, not assumed:** this app has no
deployed web URL at all — `netlify.toml`/`docs/DEPLOY-NETLIFY.md` exist from W6 but the Netlify
click-through was never done. `redirectTo` needs somewhere real to land the invited person's
"set your password" step. Turned out simpler than first suspected: no native/Capacitor
deep-linking is needed at all (that complexity was floated and then ruled out) — the person
completes the password step in their phone's ordinary browser against the deployed web/PWA
build, then separately opens the real Android app and signs in fresh. `SITE_URL` added as a
manually-configured Edge Function secret (not auto-injected); its absence degrades gracefully
(falls back to Supabase's own default Site URL) rather than failing the function outright.

**Known rough edge, flagged rather than assumed away:** `generateLink`'s `redirectTo` has open
GitHub issues against Supabase's own auth service (both a "not working" report and a separate
PKCE-flow compatibility issue) — found via WebSearch before finalizing the design, same
discipline as decisions #51/#53's live-verification catches. Needs an actual end-to-end click of
a real generated link once the Netlify deploy exists, not assumed to just work.

**Not yet verified live.** Needs, in order: the Netlify deploy actually done (W6, still
outstanding), `SITE_URL` set on the Edge Function, `invite-user` redeployed (changed again),
then one real invite clicked through end to end. `npm run typecheck`/`validate`/`build` all
confirmed clean.

**Cross-reference:** SPEC.md D36, §4.3.12; `supabase/functions/invite-user/index.ts`;
`src/pages/TeamManagement.tsx`; `netlify.toml`, `docs/DEPLOY-NETLIFY.md` (existing, unexecuted);
decision #53.

### Decision 55 — Phone invite becomes password + link, not OTP (D37), superseding D35's active mechanism

**What changed.** User corrected a misreading directly after decision #54: they never meant
"generate a link for phone the same way as email, on top of the OTP design" — they meant the
phone-invite path itself should go through the *same* link-and-password mechanism as email,
explicitly calling D35's OTP design "the full implementation" and this "just a graceful
degradation." Asked the user directly whether to fully replace the active phone mechanism or
keep both as a per-invite choice (real fork, real cost either way — AskUserQuestion, not
assumed); answer: replace, for now. D37 written into SPEC.md before any code, same pattern as
every phone-invite decision this session.

**The real mechanism, verified live against the real Admin API before writing SPEC.md, in this
order — design, then test, then document:** Supabase's `generateLink` only knows how to anchor a
link to an email identity, so a phone invite now (1) generates the link against a synthetic,
never-shown email (`<digits>@phone.invalid` — confirmed live that GoTrue's email validation
accepts the `.invalid` TLD), (2) attaches the real phone number to that same account via
`admin.updateUserById` (confirmed live: one account can hold both an email and a phone identity
at once), (3) **directly corrects `public.users`** (`email = NULL`, `phone = <real digits>`) in
the same call. Step 3 is proven necessary, not assumed: `scripts/test-phone-password-invite.mjs`
deliberately checks `public.users` *before* the correction step and confirms the synthetic email
really does leak straight through — `handle_new_user()` already ran at step 1 against the
synthetic email, and step 2 is an UPDATE that doesn't re-fire that INSERT trigger.

**Nothing from D35's schema work is wasted** — migration 0014 (nullable `email`,
`users_identity_present`, phone-mirroring `handle_new_user()`) is exactly what D37 builds on;
only the Edge Function's phone branch and the sign-in UI changed. **D35's code is kept, not
deleted** — `requestPhoneOtp`/`verifyPhoneOtp` (`src/lib/auth.ts`) stay in place, unused by any
screen, explicitly commented as "the deferred full implementation" so reviving it later isn't a
rewrite. `SignInForm.tsx`'s phone tab became a single-step phone+password form (was a two-step
OTP request/verify flow) using a new `signInPhonePassword` that derives the same synthetic email
client-side, purely — no server round-trip, and not a secret (equivalent to knowing the phone
number; the password is the actual credential). `TeamManagement.tsx`'s `InviteForm` unified: both
methods now return `invite_link` and share the same copy/share panel.

**Not yet verified live end-to-end** (a real admin clicking a real generated link and signing in
with phone+password needs the still-outstanding Netlify deploy, D36's prerequisite) — but the
Admin-API/database sequence itself is proven correct via
`scripts/test-phone-password-invite.mjs`, including the specific leak this design guards
against. Currently fails at the correction step for the expected, already-known reason (migration
0014 not yet applied — `email` is still `NOT NULL` live) — not a new bug. `npm run
typecheck`/`validate`/`build` all confirmed clean.

**Cross-reference:** SPEC.md D37, §2.2.1, §4.3.12; `supabase/functions/invite-user/index.ts`;
`src/lib/auth.ts`, `src/components/SignInForm.tsx`, `src/pages/TeamManagement.tsx`;
`scripts/test-phone-password-invite.mjs`; decision #54.

### Decision 56 — Regenerated `Jayshankar-clean`; found and fixed real gaps in the kit's own publish tooling

**What changed.** User asked for the checklist plus the actual regenerated `Jayshankar-clean`
content, referencing `tins-kit/prompts/PUBLISH-OPEN-SOURCE.md` for how they want the scrub done.
Ran the kit's real `private-to-public.mjs` copy+scan tool rather than a manual copy — and found
it had never actually been exercised against a codebase this size before. Six real bugs/gaps
fixed in the kit itself (not one-off Jayshankar patches — general, selftest-covered, benefit
every future TINS project's public release):

1. `../` path-escape check flagged every ordinary relative import (`'../lib/auth'`) — narrowed
   to doc/text files only, and to 2+ consecutive segments (single-level intra-repo links are
   never actually a leak given this project's flat directory depth).
2. Bare single-word banned terms (`TINS`) matched as a substring anywhere — false-positived
   inside `custInsert` (`cus-TINS-ert`). Fixed to word-boundary matching for bare words.
3. `validate.mjs`/`selftest.mjs` are irreducibly SPEC.md-coupled (they check conformance against
   a file that never exists in the public tree) — excluded by name; `package.json`'s `scripts`
   entries for both are now mechanically stripped at copy time (found the destination-only fix
   getting silently clobbered by the very next re-copy — same pitfall the pattern doc's own §8.5
   already named).
4. `docs/W*-*.md` (build-phase verification checklists) are a methodology fingerprint by naming
   convention alone — excluded.
5. `.gitignore` is no longer blindly copied (the private one's own explanatory prose doesn't
   belong in public) — now authored once via a bundled default, preserved (not clobbered) on
   every future re-run, the same category as README/CONTRIBUTING.
6. `supabase/functions/**` and `capacitor.config.ts` were missing from `INCLUDE_PATTERNS`
   entirely — Edge Functions and Capacitor didn't exist as artefact types when the kit's list was
   written; the Edge Function and Android config were silently never reaching the public copy.

Also added a mechanical `CONTENT_REWRITES` step (same mechanism as the existing marker-line
rewrite) that turns `SPEC.md §X.Y` / `BUILDER-DECISIONS-REVIEW.md` / `HANDOVER.md` citations into
generic prose at copy time — ~40 such citations exist across this codebase's comments by design
(the standing "point at the spec, don't duplicate it" convention), and hand-editing them at the
source would have either fought that convention or needed redoing by hand on every future
regeneration.

**Also fixed at the source (private repo), genuinely, not just for the public copy:** an absolute
Windows path in two setup docs (non-portable for any reader, not just a public-scrub concern),
and a migration comment citing a kit pattern file by name, reworded to keep the substantive
Supabase GRANT-defaults gotcha without the methodology citation.

**Not yet done: syncing these kit fixes back to the canonical `tins-kit` this project's copy was
vendored from.** They currently exist only in `Jayshankar/tins-kit/` (this project's own vendored
copy) — the kit's own `kit-sync.mjs`-style propagation to the canonical source and other TINS
projects is a real, separate step the user needs to decide on and run themselves.

**License:** confirmed against the private repo's own pre-existing README ("UNLICENSED —
proprietary") rather than guessed — carried the same stance into the public copy as an explicit
"proprietary, all rights reserved, shared for reference/portfolio purposes" statement, not an
open-source license grant.

**Verified before handing back:** the regenerated `Jayshankar-clean` scans clean
(`--scan-only`), and `npm run typecheck && npm run build` both pass inside the destination
itself, not just the private repo.

**Cross-reference:** `tins-kit/scripts/private-to-public.mjs`, `tins-kit/scripts/selftest.mjs`
(55 tests, all green), `tins-kit/lib/patterns/private-to-public.md`; `Jayshankar-clean/` (all
docs); `docs/DEPLOY-NETLIFY.md`, `docs/SUPABASE-SETUP.md`,
`supabase/migrations/0004_grant_authenticated.sql`.

### Decision 57 — Invite link led back to login (D38); India-only phone UX (D39)

**What changed.** User clicked a real generated invite link for the first time and reported it
led back to the login screen instead of a set-password step. Investigated by actually testing
the link two independent ways (a plain GET with redirects disabled, and a direct API-level
`verifyOtp`-equivalent call) rather than guessing at the cause, and found two real, separate
problems:

1. **No frontend code anywhere ever handled an invite link.** `App.tsx` had one unconditional
   `if (!session || !user) return <SignInForm />` — a genuine gap in what D36/D37 built (the
   backend half was correct; the frontend half was never actually written), not a regression.
2. **A structural collision between this app's hash-based routing and Supabase's own redirect
   mechanism** — both want the URL fragment (`#...`) for different things. Fixed by never
   sending anyone to Supabase's own `/auth/v1/verify` redirect endpoint at all: the Edge
   Function now builds its own link into a new in-app route (`#/accept-invite?token_hash=...`),
   and the new `AcceptInvite.tsx` page calls `verifyOtp({ token_hash, type })` itself,
   client-side — sidesteps the collision entirely and works the same regardless of which OAuth
   flow (implicit/PKCE) the project is configured for, rather than depending on it.

**A third, separate thing found live and reported as exactly that — not fixed, because it isn't
a code problem:** the invite token itself came back `otp_expired` immediately after generation,
confirmed via two independent verification paths. Most likely a Supabase project-level OTP/link
expiry setting. Flagged to the user as their own Dashboard to check, not silently worked around.

**Same message, three more real asks, all reasonable given the actual deployment shape (one
client, always Tamil Nadu, always +91):** `normalizeIndianPhone()` added so a bare 10-digit
number is valid input everywhere phone-facing (the invite form and sign-in) — country code
handling moves entirely into the UI layer; the Edge Function's own validation stays strict,
standard E.164. `SignInForm.tsx` collapsed from a 2-tab method picker to one identifier field
that auto-detects email vs. phone from what was typed — the invite form's explicit two-method
choice stays separate, since that one is a real admin decision, not something to auto-detect.
"Remember me" was already correctly handled by the existing `persistSession`/`autoRefreshToken`
Supabase client config — confirmed, not rebuilt.

**Verified before handing back:** `npm run typecheck`/`validate` (72/72)/`build` all clean. The
`otp_expired` root cause is explicitly NOT yet verified fixed — that's the one piece requiring
the user's own Dashboard check, same as D36's `SITE_URL`/redirect-URL rounds.

**Cross-reference:** SPEC.md D38, D39; `supabase/functions/invite-user/index.ts`;
`src/pages/AcceptInvite.tsx` (new); `src/App.tsx`, `src/lib/auth.ts`, `src/lib/supabase.ts`,
`src/components/SignInForm.tsx`, `src/pages/TeamManagement.tsx`; decision #56.

### Decision 58 — otp_expired was our own bug, not a Supabase setting (D40)

**What changed.** Decision #57 flagged `otp_expired` as "most likely a Supabase project-level
setting" and asked the user to check the Dashboard for it. The user sent back their actual Rate
Limits page (saved via a browser extension into `example-video/`, not committed) — which ruled
the theory out directly: token-verification rate limit is 360/hour, nowhere near a value that
would fail instantly. Re-investigated instead of re-asking the user to keep checking dashboard
pages: tested the **email** path (D36) fresh — verified clean, first try, no issue at all. That
isolated it immediately — the bug was phone-specific, meaning it had to be something D37's own
sequence does that D36's doesn't. D37's phone branch calls `generateLink` first, then a second,
separate `updateUserById` to attach the real phone number. Removed that second call in a scratch
test, re-ran the exact same synthetic-email flow: verified clean. Put the second write back:
reproduced the failure on demand. Root cause confirmed precisely, not inferred: a token issued
against a user's old state stops verifying the moment that user record is written to again — a
real, sensible platform behaviour, tripped over by this project's own write ordering.

**Fix:** phone branch now calls `admin.createUser({ email: syntheticEmail, phone,
phone_confirm: true, user_metadata })` — both identifiers set in one call — then `generateLink`
for the already-existing user, with no write to the account afterward, ever.
`scripts/test-phone-password-invite.mjs` rewritten to match, and — the actual gap that let this
ship — now asserts the returned link's token verifies successfully, which the original version
never once checked (it proved the schema/RLS/correction-step side was right and stopped there).

**Verified live, 13/13**, including the exact assertion that was missing before: the invite
link's token verifies and returns a real session `access_token`.

**Cross-reference:** SPEC.md D40 (amends D38's incorrect "probably a Supabase setting" theory);
§4.3.12 phone workflow steps corrected to match;
`supabase/functions/invite-user/index.ts`; `scripts/test-phone-password-invite.mjs`;
decision #57.

---

### Decision 59 — Phone invitation confirmed working end to end by a real human, real device (closes D34–D40)

**What changed.** The actual deployed function had stale code from an earlier redeploy attempt
(the Dashboard editor still had pre-D40 content; clicking "redeploy" redeployed what was already
there, not the current repo file) — diagnosed by testing the user's real generated link directly
against the live API rather than guessing, which showed both the wrong link format (Supabase's
own `/auth/v1/verify` URL, not `ownInviteLink()`'s `#/accept-invite` route) and a still-`otp_expired`
token, together pointing at "old code still live." User pasted the full current
`supabase/functions/invite-user/index.ts` over the stale editor content and redeployed for real.

**One more real thing found and cleared before the successful run:** the first retry failed with
"A user with this email address has already been registered" — a leftover orphaned account from
the earlier broken attempts (account creation had actually succeeded under the old code; only
link verification was broken), blocking a clean re-invite to the same phone number. Not a new
bug — cleared directly (found via `public.users.phone`, deleted the matching `auth.users` row).

**Verified three independent ways before telling the user to test themselves, not asserted:**
1. Direct call to the deployed function: 200, correct `#/accept-invite?token_hash=...` link format
   (confirms `SITE_URL` is read correctly this time).
2. That exact token verified via `/auth/v1/verify`: 200, real `access_token` returned.
3. The live Netlify bundle itself (`curl` the deployed JS) contains `"accept-invite"` — confirms
   the frontend `AcceptInvite.tsx` route is actually live, not just the backend half.

**Then confirmed by the user directly, on a real device, with video** — the actual invite flow
(create account by phone → get link → open it → set password → sign in) genuinely works end to
end. This closes out D34 through D40 as verified, not just code-complete: the entire
email/phone invitation mechanism this session built, documented, broke twice, and fixed twice, is
now confirmed working in production by an independent, real, non-scripted test.

**Cross-reference:** D34–D40 (SPEC.md), decisions #51–#58 above (the full build/break/fix
history); `supabase/functions/invite-user/index.ts`; `src/pages/AcceptInvite.tsx`.

---

### Decision 60 — T8 audited and accepted, with one real gap found and fixed independently

**What changed.** T8 (the contrast/queryKey/typecheck-gate housekeeping batch dispatched to
MiniMax, per `delegation/tasks/T8-contrast-and-cleanup/WORKER-PROMPT.md`) returned and landed in
the working tree. Audited before committing, not trusted on arrival — same discipline
`lib/patterns/manual-relay-worker-loop.md`'s own Lesson 2/anti-pattern 1 names explicitly (a
diff-plus-gate review isn't the same claim as independent verification).

**What T8 actually did, confirmed correct:** replaced the 3 known low-contrast Tailwind classes
(`text-slate-400`, `text-slate-300`) with `text-slate-500` across every file that used them at
dispatch time (`Layout.tsx`, `RecentActivity.tsx`, `SignInForm.tsx`, `StockBySku.tsx`,
`AuditLog.tsx`, `FloorDashboard.tsx`, `RepDashboard.tsx`); removed the now-unused failing pairs
from `check-contrast.mjs`'s `PALETTE`; wired that check into `validate.mjs` as a real gate
(`js-contrast`, imported in-process, not shelled out); chained `tsc --noEmit` into the `validate`
npm script; fixed `RepDashboard.tsx`'s `queryKey: ['skus']` collision (decision #34's exact bug
class) to `['skus', 'rep-dashboard']`.

**One real gap found by independently re-grepping the live tree, not assumed clean from the
diff alone:** `TeamManagement.tsx` — built this same session, after T8 was dispatched — still had
one live `text-slate-400` (the "(you)" label next to the signed-in admin's own name). The
palette's own new comment claimed "those lighter shades are no longer rendered anywhere in
src/" — checked directly (`grep -rn "text-slate-400\|text-slate-300" src/`) before accepting
that claim, found the one exception, and fixed it the same way (→ `text-slate-500`) before
committing anything. Not T8's fault — a real timing gap between when it was scoped and when a
new file landed — but exactly the kind of thing that ships silently if the self-report is
trusted rather than re-checked.

**Verified after the fix, full gate, not partial:** `npm run validate` (73/73, including the new
`js-contrast` check: 13/13 palette pairs pass), `npm run build`, `npm run selftest` (9/9) — all
clean with the TeamManagement.tsx fix included, not just T8's own files.

**Cross-reference:** `delegation/tasks/T8-contrast-and-cleanup/WORKER-PROMPT.md`;
`scripts/check-contrast.mjs`, `scripts/validate.mjs`; `src/pages/TeamManagement.tsx`;
`lib/patterns/manual-relay-worker-loop.md` (kit) Lesson 2.

---

### Decision 61 — V1 sprint: the CRM frontend gap (customers, payments, reversals)

**What was found.** Following the user's "lets sprint to v1" directive, an audit of the app
(not just the schema) found that the entire CRM layer built in Mode B — `customers`, `payments`,
`reversal_requests`, `bills`, `notifications` tables, their RLS, and the `customer_credit_status`
view (migrations 0012–0013, D22/D24/D27/D33) — had **zero frontend usage anywhere**. Confirmed
mechanically, not assumed: `grep -rln "from('customers')" src/` and the equivalents for the other
4 tables all returned nothing; `ls src/pages/` had no corresponding page. A sale could be recorded
with a free-text buyer name, but nothing could ever link it to a real customer, show a running
balance, record a payment against it, or request/execute a reversal through the UI — despite all
of that being fully spec'd and schema-complete since Mode B.

**What was built this sprint, in priority order (customers → payments → reversals; notifications
and bills deferred — see below):**
- **`supabase/migrations/0015_sale_customer_link.sql`** — `record_container_sale` gains an
  optional `p_customer_id` (appended, defaulted — backward-compatible signature change). When
  set, the customer's name is derived from their row (authoritative once linked, not re-typed);
  `sales.customer_id` gets populated for the first time ever, which is what
  `customer_credit_status` needs to have anything to key off. A one-off buyer with no formal
  record still works exactly as before (D25's "incomplete data warns, never blocks," extended).
  Return shape kept byte-for-byte identical to the pre-existing function — caught a mismatch
  (wrong field names, a dropped field) before finalizing by re-reading exactly what
  `src/lib/mutations.ts`'s `recordSale()` actually reads.
- **`supabase/migrations/0016_execute_sale_reversal.sql`** — the reversal *execution* algorithm
  (migration 0012 deliberately built only the request/approval schema, its own comment says so).
  Real, checked-not-assumed finding this depends on: `apply_movement_to_batches` (0001) only
  fires on `kind IN ('transfer','sale','spoilage')` — `'reversal'` isn't in that list (even
  though it *is* a valid `kind` value, added to the CHECK constraint by migration 0006), so a
  `kind='reversal'` movement does NOT auto-restore `batches.kg_remaining`. This function restores
  it explicitly, the same way `container_fills.kg_remaining` is already handled explicitly
  elsewhere (migration 0009's cascades). Handles both admin/co-admin execution (any
  `requested`/`approved` request) and the D22 self-execute exemption (`users.can_self_reverse`,
  own `requested` request only) — the self-execute path needs SECURITY DEFINER specifically
  because `reversal_requests`' own UPDATE RLS policy is admin/co-admin-only; a self-reversing rep
  has no other path to transition their own request's status. Notifications deliberately NOT
  written here — scoped to stock correctness, the highest-risk part, not the full D27 taxonomy.
- **`src/pages/CustomerManagement.tsx`** — list/add/edit, matching `SkuManagement.tsx`'s "even a
  5th grader could use it" pattern: name + phone up front, business details/address/follow-up
  status/fish preference/credit terms behind "More settings." GST fields stay dormant (D24).
  `warehouse_id` resolved silently (D29 — one warehouse in practice), never shown to the user.
- **`src/pages/PaymentManagement.tsx`** — pick a customer, see `customer_credit_status`
  (outstanding balance, over-limit flag, days overdue), see that customer's sales with a
  client-computed per-sale balance (the view only aggregates per customer by design — its own
  CTE — so per-sale balance is a read-time join of `sales` + `payments` in JS, not a new source
  of truth), record a payment against any sale with balance > 0. Plain RLS-gated `payments`
  insert — no RPC needed, unlike sales/movements, because there's no cascade or algorithm here.
- **`src/pages/ReversalRequests.tsx`** — request a reversal (see decision #62 — this ended up
  needing its own RPC, not a plain insert), and — for admin/co-admin, or the original requester
  under the self-execute exemption — approve/deny (plain update) or execute (calls the new RPC).
  Verified live against the real Supabase project
  before committing to it: the PostgREST FK-disambiguation hint `users!requested_by(display_name)`
  works for the double-embed of `users` this page needs (`requested_by` and implicitly
  `decided_by`), confirmed via a scratch script hitting the real REST endpoint with the exact
  multi-level select string the component uses (200 OK) — chosen over the constraint-name-based
  hint as more robust against Postgres's auto-naming.
- **`src/components/FormFields.tsx`**: new `CustomerSelect` — optional, not required (same D25
  philosophy as above). **`src/lib/mutations.ts`**: `SaleInput.customerId?`, threaded to the RPC.
  **`src/pages/SaleForm.tsx`**: customer picker shown first; the free-text buyer-name field only
  appears (and is only required) when no customer is selected. **`src/App.tsx`**: 3 new routes
  (`/customers`, `/payments`, `/reversals`), scoped to `admin, co-admin, vendor-rep, super-worker`
  — deliberately broader than the admin-only pattern SKU/Warehouse/Team use, since reps are the
  ones actually meeting buyers day to day. Nav links added to `AdminDashboard.tsx` and
  `RepDashboard.tsx` (the latter's action grid grew `sm:grid-cols-6` → `sm:grid-cols-7`).

**Deliberately deferred, not part of this batch:** a **Notifications** UI — nothing anywhere
writes to `public.notifications` yet, needs both a writer and a bell-icon/list UI respecting
D27's role-at-creation scoping — and a **Bills** UI. Both come after this batch, per the sprint's
own stated order.

**Verified before committing:** `npx tsc --noEmit` (clean, whole repo), `npm run validate`
(73/73 — unchanged; the new migrations aren't yet part of that gate's schema-presence checks),
`npm run build` (clean), `npm run selftest` (9/9). The two new migrations have been read back
line-by-line for correctness (kind='reversal' CHECK-constraint history, batch_id NOT NULL
guarantee, RPC named-parameter call compatibility with the appended default parameter) but are
**not yet applied to the live database** — pending the user running them via the Supabase
Dashboard SQL Editor, after which both new RPCs still need a real, live test the same way every
other RPC in this project has been (never trusted from a clean `validate` run alone).

**Cross-reference:** SPEC.md §4.3.8, §4.3.11, D22, D24, D25, D27, D29, D33; migrations 0012, 0013
(the un-exercised schema this closes the gap on); migrations 0009, 0006 (the cascade + CHECK-
constraint history 0016 depends on); decision #34 (the `queryKey` collision class, avoided here
by scoping `['customers', 'select']`).

---

### Decision 62 — Decision #61's reversal-request flow deviated from spec; caught and fixed
### before anything was applied live

**What was wrong.** Decision #61's `ReversalRequests.tsx` created a reversal request with a
plain client-side `insert` into `reversal_requests`, defaulting to `status='requested'` always,
and let a `can_self_reverse` requester execute their own still-`requested` row directly. Re-
reading SPEC.md §4.3.11 step 2 while writing up that decision's cross-references caught the
mismatch: **"If `users.can_self_reverse` is true for the requester, auto-transition to
`approved` (`decided_by = requested_by`) — admin/co-admin is still notified regardless"** — this
happens *at request-creation time*, not as a separate action on a `requested` row later. The
request should never have been observable in `requested` status for a `can_self_reverse` user at
all.

**Why a plain client insert couldn't have implemented this correctly even if it had tried:**
`rls-policies.sql`'s own comment on the `reversal_requests` INSERT policy already flagged this —
"Auto-approval for can_self_reverse users is application/RPC-layer logic... RLS can't see 'is
this the requester's own row and do they have can_self_reverse' cheaply without a subquery per
row." The INSERT policy's `with check` only gates on role, not on what `status`/`decided_by` the
row is inserted with — so a client that set `status='approved'` itself on insert would have to
be trusted to only do that when actually entitled to, which is not a safe design (any vendor-rep
could self-grant the exemption by lying about it in the insert payload).

**Fix, before the user ever applied 0015/0016 to the live database — no drift to manage:**
edited migration 0016 in place (house convention for a migration that has never touched a live
database yet, same as the two double-allocation-bug fixes folded directly into 0007 rather than
issued as a compensating migration) so the self-execute branch of `execute_sale_reversal` now
requires `status = 'approved'`, not `'requested'`. New migration
`0017_request_sale_reversal.sql` adds `request_sale_reversal(p_sale_id, p_reason)` — a
SECURITY DEFINER RPC that checks the caller's real `can_self_reverse` value itself and decides
`status`/`decided_by`/`decided_at` server-side, so the client never gets to assert it; also adds
a guard against a duplicate pending request on the same sale (not in the original spec text, a
straightforward safety addition, not a behavior change). `ReversalRequests.tsx`'s `RequestForm`
now calls this RPC instead of inserting directly; the self-execute button's UI gating changed
from `status === 'requested'` to `status === 'approved'` to match. The `§4.3.11` "admin/co-admin
is still notified regardless" clause is deliberately flagged in the new RPC's own comment as not
yet possible (same notifications gap decision #61 already named) rather than silently dropped.

**Verified after the fix:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build`
clean — same full gate as decision #61, re-run after this correction, not assumed still passing.

**Cross-reference:** SPEC.md §4.3.11 step 2, D22; `supabase/rls-policies.sql`'s own comment on
the `reversal_requests` INSERT policy (migration 0012), which named this exact gap in advance;
decision #61 (the batch this corrects, before any of it reached the live database);
`lib/patterns/manual-relay-worker-loop.md` (kit) Lesson 2 — the same "verify against the actual
spec text, don't trust the first design that compiles" discipline, this time applied to this
session's own work rather than a delegated worker's.

---

### Decision 63 — V1 sprint: the one notification trigger SPEC.md actually specifies, wired

**Scope, deliberately minimal.** Decisions #61/#62 named the Notifications piece as the next
part of this sprint, after Customers/Payments/Reversals. Re-checking what SPEC.md actually
locks down here (not just its cross-references) before building anything: the merged document
references a "§F taxonomy" and a "core transactional subset" (§9's out-of-scope list) that was
never itemized anywhere in the current text beyond two concrete rules — §4.3.11 step 2 ("admin/
co-admin is still notified regardless" of a reversal request, whether it needs their review or
auto-approved without them) and D31's one exclusion (never a price-change type). Building a
wider taxonomy — low-stock alerts, delivery confirmations, whatever else might seem obviously
useful — would mean inventing requirements nobody has actually validated. This closes exactly
the one rule that is locked, and leaves the rest correctly unbuilt rather than guessed at.

**What was built:**
- `supabase/migrations/0018_reversal_request_notifications.sql` — `notify_admins(p_type,
  p_payload)`, a generic SECURITY DEFINER writer (the pattern `rls-policies.sql`'s own comment
  on the `notifications` INSERT policy already named as the intended future shape — no INSERT
  policy for any role, same as `audit_log`'s trigger-only precedent) that inserts one row per
  current admin/co-admin, `role_at_creation` taken from their real current role (D27). Re-issues
  `request_sale_reversal` (migration 0017) with a call to it added at the end — `'reversal_
  requested'` when the request stays `requested` (needs review), `'reversal_auto_approved'` when
  a `can_self_reverse` requester's own request auto-approved (D22, §4.3.11 step 2's "regardless"
  clause — admin still sees it even though their decision wasn't needed). Migration 0017's own
  comment, which had flagged this as not-yet-possible, is left as written and annotated pointing
  here — the same self-correction style SPEC.md's D38→D40 already uses, not silently rewritten.
- `src/components/NotificationBell.tsx` — a personal-inbox dropdown in the header: unread-count
  badge, a list of the requester's own notifications (RLS already scopes everything to
  `auth.uid()` — no new policy needed, `notifications_select_own`/`notifications_update_own`
  from migration 0012 cover read and mark-read), click-to-mark-read, "mark all read." A type→text
  map (`TYPE_TEXT`) covers the two types that currently exist; every notification links to
  `/reversals`, the one screen anything here can actually be acted on. Wired into `Layout.tsx`
  next to `RoleBadge`, visible to every signed-in user (the table's RLS is per-user regardless of
  role; only admin/co-admin happen to receive anything yet, but the UI itself isn't role-gated).
- **One repeat of a mistake this exact session already fixed once, caught before committing:**
  the new component's timestamp line originally used `text-slate-400` — the precise class T8
  (decision #60) removed from the palette for failing WCAG AA contrast, in a file built *after*
  that removal. Re-checked directly (`grep -n "slate-400\|slate-300"` against the new file, not
  assumed clean) and fixed to `text-slate-500` before running the gate.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean.
Migration 0018 depends on 0017 (not yet applied to the live database either) — both still
pending the user running the full 0015-0018 batch via the Supabase Dashboard SQL Editor.

**Cross-reference:** SPEC.md §4.3.11 step 2, D22, D27, D31; decisions #61, #62; `rls-policies.sql`
migration 0012's own comment on the `notifications` table (named this exact writer shape in
advance); decision #60 (T8's contrast remediation, repeated here in a new file and caught the
same way — independently re-grepped, not assumed).

---

### Decision 64 — Bills built, and the container system finally connected to a frontend

**What was found, checked directly rather than assumed from §4.3.7's own text.** SPEC.md §4.3.7
step 1 claims the delivery flow "already does" bill creation — checked against
`DeliveryForm.tsx`/the old `recordDelivery` (client-side: 1 batch insert + 1 movement insert, no
locking, one SKU per submission) and confirmed that claim was never true: `batches.bill_id` has
sat NULL on every row since migration 0006 added the column. Separately, `record_container_fill`
(migration 0007) — the RPC that packs received fish into a numbered, shelf-life-tracked
container — has existed since Mode B with zero frontend usage anywhere (`grep -rn
"record_container_fill" src/` returned nothing before this session). The two turned out to be
the same underlying gap, not two separate ones: `container_fills.bill_id` is a NOT NULL FK, so
packing is structurally impossible until a bill (and batches that trace to it) exist — the user
named both together in the same request for exactly this reason.

**What was built, in the order the data actually depends on:**
- **`supabase/migrations/0019_record_bill_delivery.sql`** — new `record_bill_delivery(p_vendor_id,
  p_location_id, p_bill_date, p_vendor_bill_number, p_items)`. One bill, N SKU lines, each line's
  batch + `delivery_in` movement, all atomic and SECURITY DEFINER (matching the
  `record_transfer_cascade`/`record_container_fill` precedent rather than the old plain-insert
  path) — every movement from one bill shares a `movement_group_id`, SPEC's own precedent
  (spoilage's cascade) for "the audit log will show all of them as a group." One location and
  one vendor for the whole bill, deliberately — a vendor's delivery physically arrives at one
  place in one trip; only the old form's "one SKU per submission" restriction is lifted.
- **`src/pages/DeliveryForm.tsx`** — rewritten from a single-line form into a repeatable
  fish-line list ("+ Add another fish"), a running bill total, calling the new RPC via
  `recordBillDelivery` (`mutations.ts`). Same route (`/deliver`), so no nav link needed updating
  for this half.
- **`src/pages/PackContainerForm.tsx`** — the first frontend for `record_container_fill`. Since
  a container_fill is inherently bill-scoped, the UI is: pick a bill (only bills with something
  still unpacked are listed), see its unpacked lines with a per-line "available to pack" amount
  computed client-side the same way the RPC's own double-allocation guard computes it
  (`least(kg_remaining, kg - already_packed_excluding_repack_copies)`, verified by reading
  `record_container_fill`'s actual source, not re-derived from memory), select lines + kg,
  container number (plain text — the RPC itself finds-or-registers by number, so no separate
  "new vs existing container" toggle is needed) + capacity, submit. Client-side total-vs-capacity
  check disables submit before a wasted round trip, but the RPC remains the real validator.
  **One real bug caught before committing:** the line-selection checkbox and its row were
  originally one `<label>` wrapping both the checkbox and a nested `<TextInput>` (which renders
  its own `<label>`) — nested `<label>` elements are invalid HTML and a real interaction bug:
  clicking the kg field's own label text would also toggle the row's checkbox, since a click
  anywhere inside an outer `<label>` forwards to its control. Restructured to a plain `<div>`
  wrapper with the checkbox's `<label>` scoped to just the checkbox + fish name.
- **`src/pages/BillsManagement.tsx`** — list bills, admin/co-admin can mark one shared (method:
  WhatsApp/PDF/email) — §4.2.14's `share_status`/`shared_at`/`share_method`, which tracks that a
  bill was shared **back to the vendor** (a purchase receipt), not anything customer-facing.
  Recording that a bill was shared and how — not actually sending a PDF/WhatsApp message, which
  is D20's separate Edge-Function automation track.
- Routes `/pack` and `/bills` added to `App.tsx`, both scoped to `admin, co-admin, vendor-rep,
  super-worker` — matching `record_container_fill`'s own internal role check exactly (receiving/
  packing isn't a plain-worker task, per that function's own comment), not the broader
  CRM-pattern roles Customers/Payments/Reversals use. Nav links added to `RepDashboard.tsx`
  (grid grew `sm:grid-cols-7` → `sm:grid-cols-9`) and `AdminDashboard.tsx`.
- `mutations.ts` gained `recordBillDelivery` and `recordContainerFill`; the old `recordDelivery`
  is gone (only ever used by the one file rewritten above).

**Verified before committing:** the two new multi-level PostgREST embeds this work depends on
(`batches → skus`/`bills → vendors`, and `container_fill_items → container_fills`) confirmed
live against the real Supabase project (200 OK) before writing the query that uses them, not
assumed from the container-model precedent alone. `npx tsc --noEmit` clean, `npm run validate`
(73/73), `npm run build` clean, `npm run selftest` (9/9). Migration 0019 confirmed NOT yet live
(a direct RPC probe returned PGRST202 — expected, matches every other pending migration this
sprint) — still pending the user applying 0015-0019 in order, then a live test of all 5 new/
changed RPCs from this sprint together.

**Cross-reference:** SPEC.md §4.2.11-§4.2.14, §4.3.7, D21, D23; migrations 0006 (bills/containers/
container_fills schema), 0007 (`record_container_fill`, never exercised from a frontend before
this); decision #61 (this sprint's earlier CRM pieces, same priority-ordered approach).

---

### Decision 65 — Search feature, phase 1: fish/customer/vendor/employee cards, mostly free

**Scope, decided with the user before building, not guessed.** The user proposed a large
"Pokemon-card style" search feature — fish/stock cards, employee cards (hours, tasks,
performance ratings, pay due), seller/vendor cards (credit, quality ratings, message templates),
buyer/customer cards (history, complaints, full traceability) — and explicitly invited more
suggestions. Broken down by what's actually derivable from existing schema vs. genuinely new:
most of the fish/buyer/seller asks are free (existing `skus`/`batches`/`bills`/`sales`/
`payments`/`movements`/`vendors` data); employee hours/tasks/ratings, vendor quality ratings,
message templates, and customer complaints all need schema that doesn't exist anywhere in this
project. Asked the user two scoping questions before writing any migration: (1) should the
employee card compute wages (hours × rate) or just track activity with the amount-due entered by
hand — answered **activity tracking only, no wage math**; (2) should the vendor-credit mirror
(what we owe vendors, symmetric to `customer_credit_status`) be built now — answered **yes**.
This decision covers what was actually built this pass: search infrastructure + the fish/
customer/vendor cards (all existing data) + the vendor-credit mirror (approved) + the employee
card's *activity* summary (existing data only — the check-ins/tasks/ratings the user asked for
under "activity tracking" still need new schema not built in this pass, flagged honestly in the
card itself and in the chat response, not silently dropped). Vendor quality-per-fish ratings,
WhatsApp message templates, and customer complaints are explicitly deferred — suggested by this
session, never confirmed as wanted, so not built on spec.

**Search mechanism.** Client-side, not a Postgres extension: every "identity" table here
(`skus`, `customers`, `vendors`, `users`) is small for a single-warehouse wholesaler (dozens to
low hundreds of rows), so `fetchSearchIndex()` (`src/lib/search.ts`) loads all four once and
`Fuse.js` fuzzy-matches names client-side — handles English/Tamil/Tanglish spelling variants for
fish names without any new backend infrastructure. Phone-number queries deliberately bypass
Fuse's edit-distance matching (a query of "98" would loosely match nearly every Indian mobile
number) in favour of a plain digit-substring filter. Revisit if any of these tables ever grows
past client-fetchable size.

**What was built:**
- **`supabase/migrations/0020_vendor_payments.sql`** — `vendor_payments` (mirrors `payments`'
  own shape and RLS policies exactly) + `vendor_credit_status` view (mirrors
  `customer_credit_status`, migration 0013 — deliberately narrower: `vendors` has no
  `credit_limit`/`credit_period_days` columns, checked directly rather than assumed, so there's
  no over-limit/days-overdue signal to compute on the vendor side).
- **`src/lib/search.ts`** + **`src/pages/Search.tsx`** — the search box and fuzzy index.
- **`src/pages/FishCard.tsx`** — current stock oldest-first with per-batch location/vendor/
  expiry, purchase history with a "show more" expansion (all existing data).
- **`src/pages/CustomerCard.tsx`** — contact info, `customer_credit_status`, sale history with
  per-sale balance, and a full trace per sale (which employee sold it, which vendor(s) the fish
  actually came from — walks `sales → movements → batches → vendors`, listing every distinct
  vendor since a container-sourced sale can cascade across several batches/vendors in one call,
  migration 0009).
- **`src/pages/VendorCard.tsx`** — contact info, the existing `vendors.reliability` rating
  (already existed, 1-5, surfaced here for the first time), `vendor_credit_status`, most-
  purchased fish by kg, bill history, and a "record a payment" action mirroring
  `PaymentManagement.tsx`'s own customer-side pattern.
- **`src/pages/EmployeeCard.tsx`** — role, contact, and an activity summary (deliveries/sales/
  transfers/spoilage/repacks recorded via `created_by`/`sold_by`, reversal requests filed) — all
  free from existing data. Carries an explicit, visible note that check-ins/hours/tasks/ratings
  aren't built yet, rather than a card that quietly looks "finished" while missing what the user
  actually asked for under that scope answer.
- Routes `/search` and `/search/{fish,customer,vendor,employee}/:id` added, scoped to the same
  4 roles as Customers/Payments/Reversals (not plain `worker` — `payments`/`vendor_payments`'
  own SELECT policies already exclude that role, so a card built from them would show confusing
  partial-empty sections to a worker viewing one). Nav: a prominent "🔍 Search" button on both
  `AdminDashboard.tsx` and `RepDashboard.tsx`.
- Added the `fuse.js` dependency (zero transitive dependencies of its own — confirmed via `npm
  audit`, which found only pre-existing vulnerabilities in unrelated dev/transitive packages,
  none introduced by this addition).

**Verified before committing:** every new multi-level PostgREST embed this batch depends on
(`batches → skus`/`locations`/`bills → vendors`, `sales → users!sold_by`, `movements → batches
→ vendors`) confirmed live against the real Supabase project before writing the query that uses
it, not assumed from precedent alone. `npx tsc --noEmit` clean, `npm run validate` (73/73),
`npm run build` clean, `npm run selftest` (9/9).

**Cross-reference:** decisions #61, #64 (this sprint's earlier pieces, same priority-ordered,
ask-before-guessing approach); `customer_credit_status` (migration 0013, the template
`vendor_credit_status` mirrors); `PaymentManagement.tsx` (the template `VendorCard.tsx`'s payment
form mirrors).

---

### Decision 66 — Live verification of the whole sprint (migrations 0015-0020), and one real
### bug found by it: a rejected container pack could still register a phantom container

**What was run.** The user applied migrations 0015-0020 to the live Supabase project. Rather
than trust a clean static gate alone — this project's own standing discipline since decision #40
(the phone-invite bug that a clean `npm run validate` never would have caught) — every new/
changed RPC from this sprint was exercised for real: signed in as the real demo `rep` and `admin`
accounts (not the service-role key, so `auth.uid()`/`current_user_role()` actually resolve),
then ran `record_bill_delivery` → `record_container_fill` (its first-ever live call, including
its double-allocation guard) → `record_container_sale` with `p_customer_id` → `request_sale_
reversal` (both the non-self-reverse "stays requested + notifies admins" path and the self-
reverse "auto-approves at creation, requester self-executes" path) → `execute_sale_reversal`
(verified `batches.kg_remaining` actually increased by the exact reversed amount, not just that
the call returned success; also verified re-executing an already-`executed` request is rejected,
not a silent double-restore) → `vendor_payments`/`vendor_credit_status` (verified the balance
dropped by exactly the payment amount). 33/33 checks passed. All test rows (a bill, 2 batches, a
container fill, a customer, 2 sales, 2 reversal requests, a vendor payment) were created with
clear TEST labels and cleaned up afterward in FK-safe dependency order, verified empty
afterward — `audit_log` deliberately left untouched (immutable, no DELETE policy for any role,
by design; a live test's actions belong in it permanently like any other real action would).

**The one real bug this found**, in the process of deliberately triggering the double-allocation
guard to prove it works: `record_container_fill` (migration 0007) registers a brand-new
`containers` row *before* validating the pack items. A pack attempt that fails validation still
leaves behind a real, empty, "available" container — confirmed live (a `TC-LIVE-TEST-02` row
was left in `public.containers` by the deliberately-rejected over-pack call, cleaned up
manually). This isn't cosmetic: an empty phantom container is trivially "available" per
§4.2.11's own rule, so it would show up in `AvailableContainerSelect` (`src/components/
FormFields.tsx`) as a legitimate repack destination, and would accumulate for real every time a
rep mistypes a batch or overshoots available kg while packing and retries with a different
container number.

**Fix — migration `0021_container_fill_defer_registration.sql`**, a fix-forward `CREATE OR
REPLACE` (migration 0007 is already live, so per this project's own convention it's fixed
forward, not edited in place, the same way 0010 fixed something found in 0009 post-hoc): the
existing-container lookup by number stays early (read-only — still needed for the availability
guard, which only means anything for a number that already exists), but the actual `INSERT INTO
containers` for a brand-new number is deferred until every validation step has passed, right
before the `container_fills` insert that will actually use it. A rejected call now creates
nothing at all — matching every other RPC in this project's "validate fully, then write"
discipline. No other logic changed; same role/availability/double-allocation/capacity checks,
byte-identical return shape.

**Verified:** `npm run validate` (73/73) after adding the fix migration. Migration 0021 itself
is **not yet applied** to the live database — pending the user running it, same SQL-Editor flow
as the rest of this sprint's migrations.

**Cross-reference:** migration 0007 (`record_container_fill`'s original code); decision #40 (the
precedent for "a clean static gate doesn't mean a live bug doesn't exist," and for fixing forward
rather than editing an already-live migration); decisions #61-#65 (the sprint this closes out).

**Addendum, same day — migration 0021 applied and its fix confirmed live.** Re-ran the exact
attack that found the bug: a deliberate overshoot pack against a real test bill/batch, container
number `TC-VERIFY-0021-REJECTED`. Confirmed the rejected call now creates **zero** rows in
`public.containers` for that number (the actual fix, not just that the call still returns an
error) — then confirmed a valid pack immediately afterward still succeeds normally and creates
exactly one real container row. 7/7 checks pass; test rows cleaned up, verified empty. **This
closes out the entire V1 sprint's backend work** — every migration from 0015 through 0021 is
now live and has been independently exercised for real, not just gated by a clean `npm run
validate`.

---

### Decision 67 — D26 (Looker Studio reporting) and D20 "lite" (compose-and-share, not the
### full WhatsApp Business API) — the two genuine V1-locked gaps a direct SPEC.md §8 audit found

**How this was found.** The user asked directly whether anything else was pending, and pushed
for a real check against SPEC.md rather than a summary from memory. Read §8's acceptance
criteria in full and independently verified the questionable ones (grepped the actual codebase,
ran a live RLS-bypass attempt, remeasured the bundle) rather than trusting the document's own
text. Most of what turned up (offline write-queue, warehouse-scoped RLS, transfer cross-
warehouse enforcement, GST UI) was already correctly deferred and documented as such. Two were
not: D26 ("Looker Studio... confirmed real V1 deliverable") and D20 ("WhatsApp Business Cloud
API... outbound-only... bill-share, payment-proof confirmation") had literally nothing built —
`grep` for `looker`/`warehouse_id`-scoped policies and for `wa.me`/clipboard mechanisms outside
the invite screen both came back empty.

**D26 — built as specified.** `supabase/migrations/0022_looker_studio_readonly_role.sql`
creates `looker_studio_readonly`, a plain login role with `BYPASSRLS` and `SELECT`-only grants
(default-privilege future-proofed, same mechanism as `service_role`/`authenticated`'s own grants
in migrations 0003/0004) — no `INSERT`/`UPDATE`/`DELETE` ever granted, which is §8.14b's literal
acceptance criterion, true by construction rather than by a policy that could later be loosened.
`BYPASSRLS` chosen deliberately, not a shortcut: the role's own password is the real security
boundary (only the admin will ever hold it, same trust model as the service-role key), and
Looker Studio reporting genuinely needs a cross-role, cross-warehouse view of the whole business
— a different question than "what should a signed-in app user's role see," which is what every
other RLS policy in this project answers. A starter `daily_sales_summary` view is included (one
pre-aggregation, not a replacement for building real charts in Looker Studio itself). The
password itself is deliberately NOT in this migration — same "never commit a secret" discipline
as `.env`/the service-role key — `docs/LOOKER-STUDIO-SETUP.md` walks through setting it directly
in the SQL Editor and the rest of the connection process.

**D20 — built as a "lite" implementation, not the full WhatsApp Business Cloud API.** The user
proposed this explicitly: no Meta business verification, no API tokens, no message-template
pre-approval process — compose real message text, then hand it to the OS share sheet (WhatsApp
included on any phone that has it) or let the person copy it to paste in by hand. This is the
exact pattern already proven and confirmed working in `TeamManagement.tsx`'s invite-link panel
(decision #59) — extracted into a reusable `src/components/ShareComposer.tsx` rather than
reimplemented, and deliberately left `TeamManagement.tsx` itself untouched (a working, user-
confirmed flow isn't worth the regression risk of refactoring purely for deduplication).
- **`VendorCard.tsx`** gains a "Message this vendor" panel — two starter templates ("what's
  today's catch?" and "ask about a specific fish," parameterized via the existing `SkuSelect`) —
  fixed English text, NOT yet owner-customizable (a real template-management UI is a separate,
  later piece) and deliberately NOT translated into Tamil/Tanglish here: business-critical
  vendor wording needs the actual client's approved phrasing, not a fabricated translation.
- **`BillsManagement.tsx`**'s "mark shared" flow, for the `whatsapp` method specifically, now
  composes the bill's real line-by-line summary (fish/kg/price per line, queried fresh, not just
  the stored total) and shows the same compose-and-share panel before confirming `share_status`.
  `pdf`/`email` stay pure record-keeping (no PDF generation, no email sending exists in this
  project) — WhatsApp is the channel this business actually uses (D36's own finding).

**Verified:** the new `batches → skus` embed (bill-line composition) and the `daily_sales_
summary` view both checked live before/after this commit — the view correctly 404s (migration
0022 not yet applied), the embed returns 200. `npx tsc --noEmit` clean, `npm run validate`
(73/73), `npm run build` clean, `npm run selftest` (9/9).

**Cross-reference:** SPEC.md D20, D26, D36 (WhatsApp confirmed the real channel); decision #59
(the invite-link panel this pattern is extracted from); `docs/LOOKER-STUDIO-SETUP.md`.

---

### Decision 68 — D27 Track A: two more event notifications, and one candidate deliberately
### dropped from this track

**Scoping, asked before building.** Proposed three tracks for D27 (the user's own "different
tracks of notifications" framing): **A** — more event notifications, same shape as the existing
reversal-request bell, no new infrastructure; **B** — a per-bill/per-sale status tracker (the
user's own Amazon-package-tracking analogy) — mostly a UI feature over existing timestamps, not
really a "notification" in the push sense; **C** — a periodic store-stats digest, which
genuinely needs a schedule (`pg_cron` or similar), real new infrastructure. Asked the user which
to build first via `AskUserQuestion`; answered **Track A**.

**One candidate dropped on reflection, not built.** The original Track A proposal included "a
container nearing expiry" as a third event. Re-examined before writing the migration: expiry
approaches purely with the passage of time, not because of any action a person takes — there is
no event to trigger off. Forcing it into Track A would mean either polling on every relevant
page load (unreliable — only fires if someone happens to look) or adding a schedule anyway,
which is exactly Track C's job, not this one. Dropped it from this migration rather than build a
bad-fit version; it belongs with Track C when that gets built.

**What was built — `supabase/migrations/0023_more_event_notifications.sql`, re-issuing two
already-live functions in full (fix-forward, per this project's own convention):**
- **`bill_received`** — `record_bill_delivery` (0019) now calls `notify_admins()` once the bill
  and every line's batch/movement are committed, carrying the vendor's name and the bill total.
- **`customer_over_limit`** — `record_container_sale` (0015) checks `customer_credit_status`
  for the sale's customer immediately after the sale is inserted, **within the same
  transaction** — Postgres reads its own uncommitted writes inside one transaction, so this
  correctly reflects the sale just recorded, not stale pre-sale data — and notifies admins only
  when `is_over_limit` is true.
- **`src/components/NotificationBell.tsx`** — restructured `TYPE_TEXT`/a single shared
  `LINK_FOR_TYPE` into one `TYPE_INFO` map carrying both text *and* a destination per type (the
  file's own prior comment had already flagged this: "revisit if a type not about reversals is
  ever added") — `bill_received` links to `/bills`, `customer_over_limit` to `/payments`.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Migration 0023 depends on 0018 (`notify_admins`) and 0022
(unrelated, just sequentially after) — not yet applied to the live database.

**Cross-reference:** decision #63 (the original notification writer this extends); decision #66
(the "fix forward, don't edit an applied migration" convention, applied again here to 0015/0019);
`customer_credit_status` (migration 0013, the view this reads from).

**Addendum, same day — migrations 0022 and 0023 applied and live-tested.** `daily_sales_summary`
confirmed queryable (0022). For 0023: recorded a real bill via `record_bill_delivery` as the
demo rep and confirmed a `bill_received` notification was written; recorded a real sale against
a fresh test customer with a ₹100 credit limit at ₹500 (deliberately over it) and confirmed a
`customer_over_limit` notification was written, keyed to the real `sale_id`. 5/5 checks pass;
all test rows (bill, batch, sale, movements, customer) cleaned up, verified empty.

---

### Decision 69 — §8.6 performance checking, automated with Playwright rather than a custom VM

**Why not a VM.** The user proposed replicating a 2021 Android phone's specs in a custom VM to
check §8.6's performance targets. Proposed the cheaper alternative instead: the thing that
actually determines a web app's perceived performance is CPU cycles and network conditions, not
the underlying silicon — which is exactly what Chrome DevTools' own "CPU throttling" + "Slow 4G"
presets emulate, the same technique Lighthouse itself uses to score mobile performance from a
desktop. A VM replicating real ARM hardware buys little a throttled headless browser doesn't
already give you, for meaningfully more setup cost. The user ran the DevTools version manually
first (10.3x CPU / Slow 4G, getting 764ms-1.76s / 1668ms readings) and asked for this to be
automated going forward.

**What was built.** `playwright` added as a devDependency (Chromium binary downloaded and
smoke-tested live — confirmed it actually launches in this environment, not assumed).
`scripts/perf-check.mjs` — a real, working tool, not just installed and left untested: launches
headless Chromium, applies the exact same CPU-throttle-rate/network-conditions via the Chrome
DevTools Protocol (`Emulation.setCPUThrottlingRate`, `Network.emulateNetworkConditions` — Slow
4G's 400Kb/s down/up, 400ms latency, matching DevTools' own preset), navigates to a given URL,
and reports full-load time, DOM-content-loaded, first-paint, first-contentful-paint, and
largest-contentful-paint from the browser's own Performance API (the same numbers DevTools'
Performance panel and Lighthouse report, not a reimplementation).

**One real thing found while testing this against a live local build, not assumed to just
work:** the very first run came back with every paint metric `null` — a genuine headless-Chrome
quirk (`Navigation` 'load' fires once the HTML/JS shell is fetched, but this is a client-
rendered SPA; React's own render and the paint entries that come with it land a beat later,
especially under CPU throttling). Fixed with a short settle wait after `goto()`. Largest-
contentful-paint still comes back `null` in headless runs (a separate known Chromium quirk — LCP
often needs a real visibility-change event to finalize, which a foregrounded headless run never
gets) — documented honestly in the script's own output rather than silently reported as zero;
first-contentful-paint is the reliable number to read in a headless run.

**Deliberately NOT part of `npm run validate`** — this is a developer tool for repeatable perf
measurement, not a release gate; `scripts/`'s zero-dependency house rule stays scoped to the
validator/migration-runner, per its own long-standing gotcha note, not every future script.

**Cross-reference:** SPEC.md §8.6 (the targets this checks against); the "§8.6 never actually
measured on a real device" finding from the direct-audit conversation this session that led to
D26/D20/D27's own gap-closing.

---

### Decision 70 — employee tracking phase 1: check-ins and task delegation, backend only

**A real design conversation, not a guess, before any schema.** The user described a large
system (check-ins, task delegation, automatic performance rating, wage-tier suggestions,
vendor/fish quality tracking, procurement price variability, customer complaints, freshness/
size/age) in one dense pass, with several genuinely open sub-questions flagged by the user's own
words ("not sure...", "propose something"). Organized it back into 8 pieces, stated which were
buildable as-described vs. which needed a real answer, and proposed concrete resolutions for the
open ones (freshness/size/age tracking, cold-chain incident logging, the procurement-price
question probably already being solved by existing data) rather than building any of it on a
guess. Two genuinely blocking unknowns got asked directly: task types (answered: all four —
delivery receiving, customer sales, pack/repack, AND freeform custom — plus a new constraint,
employees can hold several tasks at once) and who sees the wage-tier suggestion (answered:
admin only). This migration covers exactly the two pieces now concrete enough to build:
check-ins and task delegation. Performance rating and wage tiers are a deliberate, named
follow-up — they read from what this migration writes (completion times, kg handled), so
building them before real task data exists would mean tuning against nothing.

**The concurrent-task time problem, resolved by asking what's honest, not what's precise.** The
user surfaced a real gap in their own design: if an employee holds 3 tasks at once, splitting
"actual effort" per task cleanly is impossible without asking them to clock in/out per task —
which breaks the same "no manual action" principle check-ins are built around. Resolved by
choosing honesty over false precision: each task's own wall-clock time (`completed_at -
assigned_at`) is the stored number, and a concurrent-task count is computed at read time as
context alongside it, not blended into a single number. This measures "how promptly did they
clear their queue" — a real, defensible signal on its own — rather than fabricating a
work-attribution split neither this app nor the employee can actually verify.

**What was built, `supabase/migrations/0024_check_ins_and_tasks.sql`:**
- **`check_ins`** — no manual button anywhere, ever. `ensure_checked_in()` (SECURITY DEFINER)
  computes `work_date` in India Standard Time server-side (`now() at time zone 'Asia/Kolkata'`)
  — Postgres defaults to UTC, and a naive UTC day boundary would split a Tamil Nadu workday at
  5:30am IST, not midnight — and writes one row per employee per day, idempotent via `ON
  CONFLICT DO NOTHING`. No client-writable path exists (no INSERT policy at all): a plain client
  insert would let someone backdate their own `work_date` or check in on someone else's behalf.
- **`tasks`** — `type` (`receive_delivery`/`make_sale`/`pack_repack`/`custom`), `assignment_mode`
  (`manual`/`round_robin`), the usual `pending`→`in_progress`/`completed`/`cancelled` lifecycle.
  No uniqueness constraint blocks concurrent open tasks per assignee (confirmed explicitly
  wanted). `create_task()` (admin picks the assignee — the "large icon grid" the user described
  is a frontend concern, not yet built) and `create_task_round_robin()` (picks the
  least-currently-loaded active operational employee — vendor-rep/worker/super-worker, not
  admin/co-admin). **"Round robin" is implemented as least-loaded, not literal cyclic rotation**
  — a deliberate interpretation choice, flagged as such, not hidden: strict rotation would keep
  handing a slow employee the same rate of new work as everyone else, which seems like the wrong
  fairness model here. Easy to swap for literal rotation later if that's actually what's wanted.
- **`auto_complete_task()`** — an internal helper (no direct grant, same pattern as
  `notify_admins`/the cascade helpers — never called except from inside another SECURITY
  DEFINER function), wired into the end of `record_bill_delivery` (`receive_delivery`,
  matched by vendor), `record_container_sale` (`make_sale`, matched by customer),
  `record_container_fill` and `record_repack` (both complete a `pack_repack` task, matched by
  assignee only — packing/repacking isn't tied to one specific vendor or customer). Finds the
  OLDEST matching open task and marks it done — the same FIFO instinct this schema already uses
  everywhere else. `custom` tasks have no underlying action to hook into, so they're completed
  by a plain client `UPDATE` instead (RLS already allows the assignee to update their own task).
  All 4 re-issued functions are fix-forward `CREATE OR REPLACE`s (all 4 were already live), per
  this project's own convention.

**Explicitly NOT in this migration, and not silently forgotten:** the frontend (check-in wiring
into app load, a "my tasks" screen, the admin delegation UI with its large-icon employee picker)
— next concrete step once this migration is verified live. Performance rating (weighted factors
against a peer mean) and wage-tier suggestions (admin-configurable ₹ tiers + a library of
pre-written, if/else-selected reason strings — explicitly NOT an AI-generated summary, per the
user's own instruction) are a separate, later piece.

**Verified:** `npm run validate` (73/73) — this migration can't be syntax-checked against a real
Postgres instance from this environment (no local database), so it was read back function-by-
function for balance (8 functions, 8 matched `$$`/`begin`/`end` pairs, 7 client-facing grants —
`auto_complete_task` correctly has none, matching the internal-helper precedent) — not assumed
correct from a clean `validate` run alone. A full live test (the same discipline every other RPC
in this project has been through) is still pending the user applying it.

**Cross-reference:** the design conversation this session (task types, wage-suggestion audience
both directly asked, not guessed); decision #65/#67's own "ask before inventing schema"
precedent; `notify_admins` (migration 0018, the internal-helper-with-no-grant pattern this
follows); decisions #64/#66 (fix-forward re-issuing of already-live functions).

---

### Decision 71 — a real bug found before testing: round-robin could hand a worker a task
### they can never complete

**What was wrong.** The user applied migration 0024 cleanly, then asked (before any test ran)
why a worker might not end up with delegated tasks — prompted checking the actual role checks
rather than assuming the round-robin logic was fine. `create_task_round_robin()` picked from
`vendor-rep`/`worker`/`super-worker` for every task type, but a plain `worker` has never been
allowed to receive deliveries or make sales — `record_bill_delivery`/`record_container_sale`
both explicitly exclude `worker` in their own role checks, and have since W2/W3 (§2.11: "the
worker never sees pricing, customer names, or vendor info"). If round-robin had picked a worker
for a `receive_delivery` or `make_sale` task, `auto_complete_task` would never fire for them —
they have no permission to call either RPC — and the task would sit stuck forever with no
automatic path to completion. Caught by asking the question before it produced a real stuck
task in test data, not discovered after.

**Fix — `supabase/migrations/0025_task_role_eligibility.sql`**: a new `eligible_roles_for_task_
type(p_type)` helper returning the real completable-by set per type (`receive_delivery`/
`make_sale` → `vendor-rep`/`super-worker` only; `pack_repack` → adds `worker`, since
`record_repack` — unlike `record_container_fill` — does allow `worker`, and repack is
explicitly the worker's everyday task per §2.11; `custom` → all three operational roles, since
it has no RPC-level restriction at all, only RLS ownership). Both `create_task_round_robin()`
*and* `create_task()` (the manual/admin-picks path) now validate against this — not just the
automatic path, since an admin picking from the not-yet-built "large icon" grid by hand could
make the identical mistake, and the RPC should enforce this regardless of what the frontend
later does or doesn't filter (this project's consistent "UI hides, the RPC actually enforces"
pattern). Both functions re-issued fix-forward — 0024 is already live.

**Verified:** `npm run validate` (73/73). Not yet applied to the live database — the user's next
step before live-testing 0024's task-delegation pieces, so the eligibility fix is in place
before any test data gets created against the buggy version.

**Cross-reference:** decision #70 (the migration this fixes); §2.11 (the original worker-role
scope this bug would have silently violated); `record_bill_delivery`/`record_container_sale`'s
own long-standing role checks (unchanged, just newly respected by the task-assignment layer).

**Addendum, same day — 0024 and 0025 both applied and live-tested together, 20/20.** Signed in
as the real demo rep/worker/admin accounts. Confirmed: `ensure_checked_in()` is idempotent
within a day (calling it twice returns the same `checked_in_at`, not a second row) and a
non-admin cannot read another user's check-in row; round-robin, run 8 times for
`receive_delivery`, never once picked the plain worker (the exact bug decision #71 fixed);
the manual path correctly rejects assigning `receive_delivery` to a worker but correctly allows
`pack_repack`; a real bill auto-completed a matching `receive_delivery` task and backfilled
`related_bill_id`; a real container pack auto-completed a matching `pack_repack` task; a
`custom` task's assignee could move it through `in_progress`→`completed` via a plain client
update, while a different employee was correctly blocked from touching it (RLS, not just UI).
All test rows (tasks, a bill, a batch, a container fill, a check-in) cleaned up, verified empty.

---

### Decision 72 — the check-in/task frontend

**What was built**, directly on top of the now-live 0024/0025 backend:
- **`src/lib/tasks.ts`** — shared types/constants, `useEnsureCheckedIn()` (fires once per
  operational-role session, silently — errors are logged, never surfaced or blocking, since
  check-in is a background signal, not a gate), `useMyTasks()`, `describeTask()`. Wired into
  `App.tsx` unconditionally before the loading/error/signed-out branches (the hook itself
  no-ops until a real operational-role user exists, so this is safe at the top of the
  component). `ELIGIBLE_ROLES_FOR_TASK_TYPE` is a client-side mirror of migration 0025's
  `eligible_roles_for_task_type()` — used only to filter who the admin's picker *offers*; the
  RPC remains the real enforcement, this project's consistent "UI hides, the RPC enforces"
  pattern.
- **`src/pages/MyTasks.tsx`** (`/my-tasks`, the 3 operational roles) — open tasks with a
  concurrent-task count shown as plain context (not blended into a duration — the same honest-
  over-precise choice decision #70 made), a completion hint + direct link to the form that
  auto-completes each non-custom type, and Start/Complete buttons only for `custom` tasks
  (the one type with no underlying action to hook into).
- **`src/pages/TaskDelegation.tsx`** (`/admin/tasks`, admin/co-admin) — the "large icon" grid
  the user described, one avatar tile per eligible employee, auto-assign button alongside it,
  and a recent-delegations feed for oversight.
- Nav: "My tasks" on `RepDashboard.tsx`/`FloorDashboard.tsx`, "Delegate tasks" on
  `AdminDashboard.tsx`.

**Verified:** every new multi-level PostgREST embed (`tasks → vendors`/`customers`, the triple
embed `tasks → vendors`/`customers`/`users!assigned_to` for the delegation feed) confirmed live
before writing the query that uses it. `npx tsc --noEmit` clean, `npm run validate` (73/73),
`npm run build` clean, `npm run selftest` (9/9). No new migration — this batch is frontend-only,
built entirely against the already-live, already-tested 0024/0025 backend (decision #70's
addendum, 20/20).

**Cross-reference:** decisions #70/#71 (the backend this is built on, both already live-verified
before this frontend work started — no untested backend under new frontend here).

---

### Decision 73 — a real overload bug found seeding demo data: two live versions of
### `record_container_sale`

**What was wrong.** While running `scripts/seed-demo-showcase.mjs` against the live database, a
call to `record_container_sale` that omitted the `p_customer_id` key entirely (a free-text,
no-customer-linked sale) failed with `PGRST203` — PostgREST couldn't choose between two
candidate functions. Root cause: `CREATE OR REPLACE FUNCTION` only replaces a function with the
exact same parameter list. Migration 0015 added `p_customer_id` to `record_container_sale` — a
real parameter-count change from migration 0009's original 6-parameter signature (`uuid, uuid,
text, numeric, numeric, text`) — so Postgres created a *second*, separate 7-parameter overload
rather than replacing the first. The stale 6-parameter version has sat alongside it, live and
callable, through migrations 0015/0023/0024, never dropped.

**Confirmed the real app was never actually affected, not just assumed:** `src/lib/mutations.ts`'s
`recordSale()` always sends `p_customer_id: input.customerId ?? null` — the key is always
present in the request body, even when its value is `null` — which resolves unambiguously to the
7-parameter overload every time. The bug only surfaces when a caller omits the key entirely,
which happened in this project exactly once, in the seed script just written, not anywhere in
the shipped frontend.

**Checked whether this is a wider problem before assuming it's isolated**: extracted every
`CREATE OR REPLACE FUNCTION` signature from every migration and compared parameter lists across
re-issues. Every other function that gained a parameter over this sprint's fix-forward pattern
(`record_bill_delivery`, `record_container_fill`, `record_repack`, `create_task`,
`create_task_round_robin`, `request_sale_reversal`) kept its exact original parameter list every
time it was re-issued — `record_container_sale` is the only one whose signature shape actually
changed across its history. Not a systemic pattern, one isolated instance.

**Fix — `supabase/migrations/0026_drop_stale_record_container_sale_overload.sql`**: `DROP
FUNCTION IF EXISTS public.record_container_sale(uuid, uuid, text, numeric, numeric, text)` — the
exact stale signature, by name. `IF EXISTS` makes this safe to re-run (a `DROP FUNCTION` without
it errors on an already-dropped function, unlike `CREATE OR REPLACE`'s natural idempotency).
Also fixed the one caller that ever omitted the key —
`scripts/seed-demo-showcase.mjs` now passes `p_customer_id: null` explicitly.

**Verified:** `npm run validate` (73/73). Migration 0026 is not yet applied — the seed script's
remaining step was completed via a workaround (passing the key explicitly) in the meantime, so
demo data creation wasn't blocked on this fix landing first.

**Cross-reference:** migrations 0009 (the stale original), 0015 (the parameter that created the
overload), 0023/0024 (re-issued the 7-parameter version without ever dropping the 6-parameter
one); `scripts/seed-demo-showcase.mjs` (where this was found, seeding the Demo Warehouse — see
its own decision entry for the full seeding record).

---

### Decision 74 — two warehouses, and a real, presentable demo dataset touching every feature

**What was built, per the user's explicit request.** Two warehouses now exist: the original
`main` warehouse, renamed `Demo Warehouse (feature showcase)` (its display name only — nothing
about its id/data changed), and a new `real-operations` warehouse (`Real Operations (rename me)`
— a clear placeholder, one `kind='warehouse'` location, per §8.15a's own rule for a real
deployment) reserved for the client's actual imported data, not yet populated. This is also the
first time this project has ever had a genuine second warehouse — the cross-warehouse transfer
path (D23, dormant since nothing existed to transfer between) is now real, not just schema.

**`scripts/seed-demo-showcase.mjs`** populates the Demo Warehouse with real data through every
real RPC (not hand-crafted SQL — the same discipline this whole sprint's live-testing has used),
signed in as the actual demo accounts, touching essentially everything built this sprint: 2
customers (one healthy, one that goes over its credit limit and triggers a real notification), 4
tasks across all types (created *before* the actions that fulfill them, so auto-completion has
something real to demonstrate — including a round-robin assignment, resolved dynamically rather
than assumed, since round-robin could hand `pack_repack` to either the rep or the worker
depending on their current load at creation time), a multi-line bill, a container pack, a
container-sourced sale, a repack, a direct-batch sale with a clean self-approved-and-executed
reversal, a free-text no-customer sale with a reversal left pending for admin review, a partial
customer payment, and a partial vendor payment.

**Two real design decisions made while building this, not incidental:**
- **Which sale to reverse mattered.** The first sale drawn from the packed container was
  deliberately left *unreversed* — `execute_sale_reversal` restores kg to the *original*
  `container_fill_id` a movement references, with no awareness that a later repack moved that
  physical stock elsewhere. Reversing a container-sourced sale after its source fill has been
  repacked away would "resurrect" stock in a container no longer physically holding anything — a
  real latent edge case, deliberately not baked silently into presentable demo data. A separate,
  direct-batch-sourced sale (never touched by any container) was used for the clean reversal
  demo instead.
- **Which sale gets the partial payment mattered too.** Reversing a sale does not currently
  reduce what `customer_credit_status` computes as owed — the view sums `sales.total_amount`
  regardless of `reversal_requests.status`, and a reversal doesn't touch the `sales` row (by
  design, D5's append-only spirit) or insert any offsetting credit. A genuinely real gap once
  reversals see production use, flagged here rather than fixed — fixing it means deciding how a
  reversed sale's financial record *should* be represented, a real design question, not a bug to
  patch blind. The demo's own reversed sale was kept payment-free specifically so this gap
  doesn't show up as a confusing, unexplained balance in the showcase data itself.

**Also found live, mid-seed, and fixed the same session:** decision #73's `record_container_sale`
overload bug.

**Cross-reference:** decision #73 (the overload bug this seeding work found); D23 (multi-
warehouse schema, now genuinely exercised); §8.15a (the real-warehouse location shape); D22/
§4.3.11 (the reversal mechanics the edge case above depends on); `customer_credit_status`
(migration 0013 — the view with the now-flagged reversal gap).

---

### Decision 75 — customer complaints/returns, closing the reversal-money gap decision #74
### flagged, by reusing existing mechanisms end to end

**The design conversation.** The user worked through the real disposition questions directly:
what happens to a returned fish if the claim turns out false and the fish is still fresh (resell
it, at a discount, ideally first in line); what happens if the claim is genuine (thrown out);
what happens on a partial recovery (some of each); and how the money nets out (refund minus an
optional operation charge, landing at zero/positive/negative depending on the verdict, explicitly
not accounting for overhead like rent/wages/fuel). Asked one directly blocking policy question
before writing schema — whether a false claim is always refunded or can be refused outright —
answered: **admin can refuse**, a real third outcome, not just "refund with a charge."

**The core design choice, reusing what already exists rather than inventing parallel
machinery:**
- Both the confirmed-good and confirmed-bad portions of a return are restored to their
  **original** batch/container_fill first — proportionally, across every movement the sale
  actually drew from, mirroring `execute_sale_reversal`'s own loop (migration 0016) scaled by a
  ratio instead of the full amount. This preserves the fish's real age (`delivered_at`/
  `expires_at` never reset), the same principle repack (0008) and the transfer fix (0010) already
  use — and it answers "should this be highest priority to resell" for free: restoring it with
  its true, older age means the existing FIFO/soonest-expiring-first cascade already puts it
  first in line. No new priority field.
- The confirmed-bad share is then immediately spoiled back **out** again, in the same
  proportion — restored, then spoiled, not silently vanished, so the audit trail reads "came
  back, then was disposed."
- The rejected share never touches stock at all — it stays with the customer or is disposed
  outside the business's own tracked inventory.
- The refund is a plain `payments` row (`method='return_credit'`, the one schema change to
  `payments` — extending its existing CHECK constraint), not a new ledger. A refund reduces what's
  owed in the *same direction* a cash payment does, so `customer_credit_status`'s existing
  `total_amount - sum(payments.amount)` math needs zero changes to account for it — this is
  exactly what closes the gap decision #74 flagged, by reuse rather than a parallel mechanism
  (D17's "derived, not stored" spirit). Confirmed-bad kg is always refunded in full (never the
  customer's fault, no operation charge); confirmed-good-but-accepted kg is refunded minus the
  operation charge, floored at 0 (a charge can zero a refund, never make it negative); rejected
  kg gets nothing.

**What was built, `supabase/migrations/0027_customer_complaints.sql`:** `customer_complaints`
(claim + resolution in one row — no INSERT/UPDATE policy for any role, both RPCs below are the
only writers, same trigger-only-write shape as `audit_log`/`notifications`/`check_ins`);
`file_customer_complaint()` (admin/co-admin/vendor-rep/super-worker — matches who can record a
sale in the first place); `resolve_customer_complaint()` (admin/co-admin only, matching the
reversal-decision boundary — this RPC touches both stock and money); `customer_complaint_summary`
— a view answering "how many false claims have we accepted from this buyer" directly, the
question that opened this whole conversation.

**Verified:** `npm run validate` (73/73). Not yet applied to the live database, and not yet
live-tested against the real proportional-restore-across-multiple-movements case (a sale sourced
from more than one batch/container fill) — that's the next real test once it's applied, same
discipline as every other RPC in this project.

**Cross-reference:** decision #74's own addendum (the exact gap this closes); migration 0016
(`execute_sale_reversal`, the loop this mirrors); migrations 0008/0010 (the "preserve real age"
precedent); D17 (derived, not stored); §4.3.9/§4.3.10 (repack/transfer, the same freshness
principle).

---

### Decision 76 — the complaints frontend

**What was built** on top of migration 0027's backend, mirroring `ReversalRequests.tsx`'s own
proven structure (the shape of the problem is the same — pick a recent sale, act on it, review
what's pending): `src/pages/Complaints.tsx` (`/complaints`, scoped to the same 4 roles as the
rest of this sprint's CRM screens for filing; resolving gated to admin/co-admin inside the
component, matching `resolve_customer_complaint`'s own role check since it touches both stock
and money). The resolve form live-validates that the three kg buckets sum to exactly
`kg_returned` before allowing submit, only asks for a rejected-disposition choice when any kg is
actually rejected, and shows an estimated refund computed client-side from the same formula the
RPC uses server-side (a preview, not the source of truth — the RPC's own return value is what
actually gets shown as the final result). Nav links added to `AdminDashboard.tsx` and
`RepDashboard.tsx` (the latter's grid grew `sm:grid-cols-9` → `sm:grid-cols-10`).

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). The multi-level embed this page depends on (`customer_complaints →
sales → skus`, `customer_complaints → users!reported_by`) could not be checked live before
writing it — migration 0027 isn't applied yet — but uses the exact same embed shapes already
confirmed live elsewhere this sprint (`ReversalRequests.tsx`'s own `sales(...skus(...))` and
`users!requested_by(...)` patterns), not a novel guess.

**Also found, unrelated, while committing this: another concurrent session of this same
conversation moved `supabase/functions/invite-user/` to `supabase/edge-functions/invite-user/`
on disk** — not this session's own change, left untouched, flagged to the user rather than
silently merged into or reverted by this commit.

**Cross-reference:** decision #75 (the backend this is built on); `ReversalRequests.tsx` (the
structural template); decision #63/#68 (the "verify embeds live before trusting them" discipline
this follows even when a direct check isn't possible yet).

---

### Decision 77 — a second real bug found by the user asking the right question, and a
### worst-case shelf-life penalty for returned stock

**What was wrong, found before it ever ran against real data.** The user asked directly what
happens when a returned-and-confirmed-good fish's original container has since been reused for
different stock. Tracing it through: `resolve_customer_complaint` (migration 0027) restored kg
into the *original* `container_fills` row by id. But every (re)fill of a physical container
creates a brand-new `container_fills` row (confirmed by reading `record_container_fill`'s own
source again, not assumed) — the old row is never reused, just left inert at `kg_remaining=0`.
If that physical container had since been refilled with different fish, restoring kg into the
stale old row would make two fill rows claim stock in the same physical box simultaneously — more
kg than it can physically hold. The exact same bug class decision #74's addendum deliberately
routed around when choosing which sale to reverse in the demo seed data, missed here in the
actual RPC.

**A second, self-inflicted bug caught while writing the fix, not after:** the fix needed a new
parameter (`p_unrefrigerated_multiplier`) on an already-live 7-parameter function. Adding it via
plain `CREATE OR REPLACE` would have created a second overload — the *exact* class of bug decision
#73 had just found and fixed, one migration later. Caught immediately: this migration explicitly
`DROP FUNCTION IF EXISTS`s the old 7-parameter signature before defining the new 8-parameter one.

**The redesign, sidestepping containers entirely rather than patching the reuse bug in place:**
a returned-and-confirmed-good fish becomes a fresh `batches` row — never restored into any
container, old or new — attributed to the *oldest* batch the sale actually drew from (the most
conservative choice among possibly-several sources, consistent with the "worst case" framing the
user asked for). A person can pack it into a real container afterward through the normal
`record_container_fill` flow if they want to, which will correctly compute a fresh `expires_at`
off this new batch's own delivered_at.

**The worst-case shelf-life question, answered directly:** normal (1×) aging from delivery to
sale, then an *accelerated* rate for however long it sat with the customer — the new batch's
`delivered_at` is pessimistically back-dated by that compounded effective age, reusing the exact
same `delivered_at + shelf_life_hours` mechanism everything else already runs on. The
acceleration factor (`p_unrefrigerated_multiplier`, default 3, exposed as an editable field in
`Complaints.tsx`'s resolve form) is explicitly named as a policy choice, not a scientifically
derived constant — the user asked for a suggestion, not a fabricated precision.

**Also simplified while redesigning:** the confirmed-bad portion no longer gets a "restore then
immediately spoil" pair of movements — it never re-enters tracked inventory at all (same as the
rejected share), so a spoilage movement touching no `kg_remaining` would have been a movement in
name only. It stays exactly where it already lived: a number on the complaint row.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean.
Migration 0028 not yet applied — not yet live-tested, same discipline as everything else in this
project.

**Cross-reference:** decision #73 (the overload-bug class this migration's own fix avoided
repeating); decision #75 (the original design this corrects); `record_container_fill`
(migrations 0007/0021/0024 — the "new fill row every time" behavior this bug depended on,
confirmed by reading the source, not assumed).

**Addendum, same day — migration 0028 confirmed live and load-tested, including the exact
scenario that started this conversation.** Three real-database test passes, 22/24 checks (the
2 "failures" were the test's own flawed assumption — pre-existing older demo stock than the
test's own new bills, confirmed by querying the actual batch drawn from, not a bug in the fix):
- A partial complaint (2kg bad, 3kg restocked, ₹50 operation charge) resolved with the exact
  expected refund (₹2450), a fresh restocked batch, and a correctly back-dated `delivered_at`.
- **The exact container-reuse scenario**: packed a container, sold 4kg from it, filed a
  complaint, then — *before resolving it* — fully drained and refilled that same physical
  container with a completely different batch (a genuinely new `container_fills` row).
  Resolving the complaint afterward left the old (superseded) fill still at 0kg and the new fill
  untouched at its real 6kg — confirmed directly that total kg claimed across both fills for
  that one physical container never exceeds its real capacity. This is the bug, reproduced for
  real and confirmed fixed, not just reasoned about.
- A rejected disposition correctly refunds nothing and writes no payment row.
- A cleanly isolated multi-batch-sourced sale (13kg drained from the oldest batch, 2kg from the
  next), resolved as a single 15kg restock: the new batch correctly holds the full summed 15kg,
  proportionally restored across both original movements, attributed to the batch actually drawn
  from. 5/5 on this pass alone.

All test data cleaned up, verified empty in every pass.

---

### Decision 78 — cross-warehouse transfer unblocked: a frontend/backend role mismatch found
### that made it entirely unusable, and §8.15b finally enforced

**What was wrong, found before testing transfer for the first time ever.** Before running the
first real cross-warehouse transfer test now that a second warehouse genuinely exists, checked
who could actually reach the screen — `App.tsx`'s `/transfer` route had been left scoped to
`worker`/`super-worker`/`vendor-rep`, a stale holdover from before D29. `rls-policies.sql`'s own
comment on the `movements` INSERT policy confirms D29's actual decision explicitly: "`transfer →
admin/co-admin ONLY` (D29 — cross-warehouse, not a routine worker task anymore; doesn't run in
practice until a 2nd warehouse exists)." The frontend and backend role sets had **zero overlap**
— whichever role the route let in, `record_transfer_cascade`'s own role check rejected. No role
in this entire application could have successfully submitted a transfer through the UI, at any
point since D29 landed — invisible the whole time because nothing ever exercised this path for
real (correctly deferred, per that migration's own comment, until a genuine second warehouse
existed to transfer between).

**Fixed:** `/transfer` re-scoped to `admin, co-admin` in `App.tsx`; the dead-end "+ Transfer"
link removed from `FloorDashboard.tsx` (worker/super-worker — repack is their move-stock task
now) and `RepDashboard.tsx` (vendor-rep no longer does this either); added to
`AdminDashboard.tsx` instead. `TransferForm.tsx`'s own back-link and copy updated to match (it
had branched on `vendor-rep` vs. everyone-else, a shape that made no sense once only admin/
co-admin can ever land there).

**Also implemented, the same pass — §8.15b, a locked acceptance criterion never actually
enforced**: "a transfer movement is only creatable between two rows in locations that belong to
different `warehouse_id`s... same-warehouse 'transfer' is rejected." Migration 0029 adds the
real check to `record_transfer_cascade` — same 5-parameter signature as always, no overload risk
this time (unlike decisions #73/#77's two near-misses this same sprint).

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Not yet applied — the first real live test of cross-warehouse transfer,
between the two warehouses that now genuinely exist, is the next concrete step.

**Cross-reference:** D29 (the decision this frontend mismatch had silently violated); §8.15b (the
acceptance criterion this migration finally implements); `rls-policies.sql`'s own comment on the
`movements` INSERT policy (named the correct role scope in advance — checked against it directly,
not assumed); decision #74 (two warehouses now genuinely existing, the reason this became testable
at all).

---

### Decision 79 — cross-warehouse transfer live-tested for real (0029 verified); an orphaned-
### task gap found and fixed, from the user's own frontend-capability questions

**Cross-warehouse transfer, live-tested for the first time ever.** Signed in as real accounts:
confirmed a rep is still rejected (role fix holds), confirmed a same-warehouse pair is rejected
with a clear "use repack instead" message (§8.15b holds), and ran a real transfer from Demo
Warehouse to Real Operations — landed in the correct warehouse, correctly reported a partial-
fulfillment shortfall (the source's oldest-FIFO batch only had 1kg free, not the 2kg assumed —
confirmed via `apply_movement_to_batches`'s own trigger logic and `audit_log`'s before/after
snapshot, not a bug in `record_transfer_cascade`). **Migration 0029 is now fully verified.**

**One live-DB cleanup owed from that test, done this pass, explicitly authorized by the user
("cleanup the 1kg"):** the sandbox correctly blocked a first attempt at a raw REST PATCH to a
live table outside a migration/RPC path; re-attempted this pass with explicit authorization,
restoring the exact 1kg `apply_movement_to_batches` had taken off a real Demo Warehouse batch
that the test's own cleanup (which only deleted the movement row, not the trigger's side effect)
had missed. Traced to the exact batch via `audit_log`'s before/after JSON, not guessed.

**Then answered the user's 4-part frontend-capability question** (does the frontend allow
creating a warehouse / changing a role post-invite and what happens to old records / bulk
container creation / friendlier role labels) by reading the actual code, not assuming:
`WarehouseManagement.tsx` already supports adding a warehouse (built earlier this sprint, decision
#49's gap-closing pattern); `TeamManagement.tsx` already supports changing anyone's role or
turning off their access; no bulk-container-registration UI exists anywhere (`PackContainerForm.tsx`
is one container per submit); role labels live in two places that don't share a source
(`RoleBadge.tsx`'s `LABELS`, `TeamManagement.tsx`'s own separate `ROLE_OPTIONS`).

**A real gap found while checking what happens to a person's records after a role change:**
`notifications.role_at_creation` and `can_self_reverse` (its own independent column, not derived
from role) are both already safe — but `/my-tasks` is route-gated to the 3 operational roles, and
nothing reassigned or even flagged a still-open task if its holder's role changed away from all
three (or their access was turned off). The task just sat there, invisible to everyone except
incidentally in `TaskDelegation.tsx`'s 20-most-recent feed.

**Fixed, per the user's explicit "force-reassigned" instruction:** migration 0030 adds a trigger
on `users` (`reassign_orphaned_tasks_on_role_change`) — fires only on an actual role/active
change, only when the person WAS eligible for operational tasks and no longer is. For every
`pending`/`in_progress` task still assigned to them, it picks the least-currently-loaded active
employee who is actually eligible for that task's specific type (`eligible_roles_for_task_type()`,
migration 0025 — the exact same selection query `create_task_round_robin()` uses, not a
new one that could drift from it) and reassigns. A `tasks_reassigned` notification tells the
admins how many moved and off whom (`NotificationBell.tsx` gets a matching entry). Honest edge
case, not hidden: if no eligible candidate exists at all, the task is left exactly as it was —
there's genuinely nothing automatic to do about a single-operational-employee shop. Chose a
trigger over a new wrapping RPC deliberately — `TeamManagement.tsx`'s own write is a plain table
`UPDATE`, and this project's convention for a structural invariant that must hold regardless of
call site is a trigger (`apply_movement_to_batches`'s own precedent), not trusting every future
caller to remember. `TeamManagement.tsx` also gets a pre-submit warning (amber banner, same pattern
as the existing "this is your own account" one) so the admin sees this coming, not just after.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9).

**Explained, not yet decided or built (the user asked to understand `can_self_reverse` before
deciding whether it needs a frontend control):** it's a plain boolean on `users`, independent of
role, currently only settable via direct SQL — no UI exposes it. Left as-is pending the user's
call.

**Discussed, not yet built:** the `storage`/`freezer`/`display` location-naming question — see
SPEC.md D52 for the full finding (D29 already retired that 3-way split for the real model; it
survives only as Demo Warehouse's legacy Mode A seed content) and the container/bill/invoice
model correction given directly to the user rather than logged as a separate decision (no schema
or spec change resulted from that part — it was accuracy-checking their own mental model against
D21/D32/§4.2.14, not new work).

**Cross-reference:** decision #78/D51 (the transfer fix this pass verified live); decision
#70/D47 and #71 (task delegation and the eligibility fix this migration reuses); D29 (the
location-naming discussion); D24 (RLS role-check philosophy — "UI hides, the RPC/trigger
actually enforces" — applied here to a trigger instead of an RPC for the first time this sprint).

---

### Decision 80 — in-transit locations built (the small half); two real business-policy
### questions asked before touching the bigger half (delivery confirmation, outbound checkout)

**What the user asked, verbatim in spirit:** confirm whether `can_self_reverse` is specifically
about customer complaints (answered directly: no — see below); build "in transit" as a real
stage using the same containers, bidirectional (vendor→warehouse, warehouse→buyer), since fish
can spoil there too; and floated (explicitly not committing to) rethinking `containers` as a
QR-sticker "concept" reassignable across different physical boxes, rather than one fixed
physical box per `container_number` forever.

**`can_self_reverse` vs customer complaints — checked directly, not assumed:**
`resolve_customer_complaint` is `admin`/`co-admin` only, in both migration 0027 and 0028 — no
self-approve path exists for complaints at all, and it never calls `execute_sale_reversal`
internally (mirrors its restore-proportional-across-movements *logic*, independently
re-implemented, because the complaint flow needs different downstream handling — no container
refill, worst-case backdating, refund-vs-refuse). `can_self_reverse` belongs entirely to the
separate, general-purpose `reversal_requests` system (D22/§4.3.11) — "undo this sale, for
whatever reason" (wrong entry, price mistake, buyer changed their mind) — a trust flag letting a
reliable rep skip the admin-review wait. A *quality* complaint from a customer who already has
the fish is a materially different, always-admin-adjudicated situation. Answered directly to the
user, not logged as its own decision (no schema/spec change resulted from the clarification
itself).

**In-transit, built (migration 0031) — the non-blocking half.** Two new `locations.kind` values,
`in_transit_inbound` (vendor pickup point → warehouse door) and `in_transit_outbound` (warehouse
→ buyer), each warehouse-scoped exactly like every other location (D23/D29) — inbound belongs to
the destination warehouse, outbound to the source, both natural fits for the existing shape, no
new concept needed beyond the two kind values. Auto-provisioned by a trigger on `warehouses`
INSERT (this project's now-established pattern for a structural invariant that must hold
regardless of call site — same reasoning as decision #79's task-reassignment trigger and the
original `apply_movement_to_batches`), so `WarehouseManagement.tsx`'s existing "+ Add warehouse"
form gets this for free with zero frontend change; the 2 existing warehouses (Demo, Real
Operations) were backfilled in the same migration.

**A real regression caught before it shipped, not after:** every existing location picker
(`LocationSelect` in `FormFields.tsx`, shared by Deliver/Sell/Pack/Repack/Transfer) lists every
active location with no `kind` filter at all — the moment these 2 new locations existed, they'd
have appeared as selectable (and currently meaningless) options in all 5 forms. Fixed by
excluding both transit kinds from `LocationSelect` by default (an `includeTransit` opt-in for
whatever future confirm-arrival/checkout screen actually needs them). **Also caught while fixing
that**: giving the query the `kind` field it needed to filter on would have put it back into the
exact overlapping-`queryKey` bug class decision #34 already found and fixed once for `skus` —
`LocationSelect`'s query shared the literal key `['locations']` with 4 other components
(`AdminDashboard`, `FloorDashboard`, `RecentActivity`, `StockBySku`) selecting a narrower shape;
whichever query happened to populate the shared cache entry first would have silently determined
what the others received, and a `kind`-less cache hit would have made the new filter fail *open*
(undefined `!==` any string is always true) rather than closed — checked before shipping, not
discovered later. Gave `LocationSelect` its own key, `['locations', 'form-select']`.

**Held for a follow-up migration, pending two real business-policy answers — genuinely not
engineering calls, the same class of question D49's refund-refusal question was:**
1. When the fish measured on arrival at the warehouse differs from what the vendor promised at
   pickup, does the wholesaler pay based on the original promised bill, or the confirmed/measured
   amount? This decides whether `bills.total_amount` (accounts payable) adjusts after
   confirmation or stays fixed with the discrepancy recorded for reference only — directly
   affects money, not derivable from anything already decided.
2. Is there a real time/process gap between "packed and heading to a buyer" and "the sale is
   actually finalized and paid" (i.e., does outbound transit need its own tracked checkout stage
   separate from `record_container_sale`), or does today's one-step sale-is-recorded-at-handoff
   already match reality, with outbound transit being descriptive/tracking-only rather than a new
   process gate? Changes the daily rep workflow, not just the schema.

Once answered: `receiving_confirmations` (SPEC.md §4.2.15 — spec'd since the D-amendment,
**never actually created**, confirmed directly against every migration, not assumed from the
spec's description alone — migration 0006's own comment says as much) gets built for real, per-
*batch* rather than per-bill as originally spec'd (a deliberate adaptation: D43 later gave bills
N SKU lines, so a single `confirmed_weight_kg` per bill would blur which line actually had the
discrepancy — the spec predates that shape).

**The QR-sticker "conceptual container" idea — evaluated, not built, per the user's own framing
("dont know what advantage this model would have").** See the direct answer given to the user for
the full trade-off discussion; not logged as a locked decision since nothing was decided.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9).

**Cross-reference:** D29/decision #79's location-naming discussion (in-transit is orthogonal to
whether Demo Warehouse's legacy storage/freezer/display ever collapses to one location — every
warehouse needs its own transit pair regardless); D21/D32 (containers, the QR-tag idea's actual
origin); D43 (the N-line bill shape `receiving_confirmations` needs to adapt to); decision #34
(the exact queryKey-collision bug class caught again here); D25 (incomplete-data-never-blocks —
why an unconfirmed delivery sitting in transit is a real unfinished physical process, not the
kind of soft-gated missing field D25 already covers).

---

### Decision 81 — receiving confirmation built for real, once the two business-policy
### questions came back

**The two answers, asked via decision #80 above:** (1) "case by case, reconciled by hand" for a
promised-vs-measured discrepancy; (2) "no — today's one-step sale already matches reality" for
whether outbound needs its own checkout stage.

**Answer (2) was a schema no-op** — nothing in `record_container_sale` or the outbound leg
changes. Confirmed and closed without touching any file.

**Answer (1) shaped `confirm_delivery_arrival` (migration 0032) precisely.** The key design
move: a physical/money split, not a single number. `batches.kg`/`kg_remaining` — the physical
stock the business can actually sell — adjusts to whatever was really measured at the warehouse
door, because you cannot sell fish you don't have regardless of what was promised. `bills.
total_amount` — money owed to the vendor — is never touched by this function at all; a
discrepancy only ever gets *recorded* (`receiving_confirmations`, finally built — SPEC.md
§4.2.15, spec'd since the D-amendment, confirmed directly to have never actually been created in
any migration, migration 0006's own comment says as much) and *surfaced* (a new
`delivery_discrepancy` notification to admins), for a human to reconcile with the vendor exactly
as answered — never auto-split or auto-adjusted either way.

**Adapted from the original spec, not copied blindly:** §4.2.15 as originally written keyed
`receiving_confirmations` to `bill_id` alone, with one `confirmed_weight_kg`. That predates D43
(bills gaining N SKU lines) — a single number per bill would blur which specific line actually
had the discrepancy. Rebuilt per-`batch_id` (with `bill_id` kept alongside, for a quick per-bill
rollup), carrying both the promised and confirmed kg *and* SKU (a vendor's claimed fish type can
turn out wrong too, not just the weight) so the discrepancy is precise, not aggregate.

**Frontend:** `DeliveryForm.tsx`'s location picker now offers in-transit-inbound locations
(`includeTransit`) alongside real ones — a rep can log the promised bill at pickup even before
the fish physically reaches the warehouse, or skip straight to a real location if there's
genuinely no gap. New `/deliveries/confirm` (`DeliveryConfirmation.tsx`) lists every batch still
sitting in an inbound-transit location and lets whoever receives it at the door confirm what was
actually measured, correcting the SKU too if the vendor's claim turns out wrong. Wired into
`RepDashboard.tsx` and `AdminDashboard.tsx`.

**A second instance of D51's exact bug class, found and fixed in the same pass, not left for
later:** `/deliver` and `/sell` had drifted to `vendor-rep`-only in `App.tsx`, while
`record_bill_delivery`/`record_container_sale`'s own role checks have accepted admin/co-admin/
vendor-rep/super-worker the whole time (confirmed directly in the migration, not assumed) — the
existing `/pack` route comment even already (wrongly) claimed to match `/deliver`'s scope
"exactly." Caught while giving the new `/deliveries/confirm` route the correct 4-role scope and
noticing its established sibling didn't match. Widened both to the real RPC scope.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Not yet applied — migrations 0030-0032 are all written and committed,
awaiting the user to run them, same as every migration this sprint.

**Cross-reference:** decision #80/D53 (the small half this decision completes); D49 (the last
time two blocking business-policy questions were asked before writing schema, same pattern);
D43 (why per-batch, not per-bill); decision #78/D51 (the exact role-mismatch bug class, now found
twice this sprint — worth treating as a class to sweep for, not two unrelated one-offs, next time
a route is touched).

---

### Decision 82 — five small, independent fixes from one round of feedback

**can_self_reverse restricted to admin/co-admin, for real.** The user's own words: "needs to be
with co-admin, admin only not with any other role." Checked live data before writing the
constraint, not assumed clean — found one real violation (Anitha, vendor-rep, `true` from
earlier demo seeding), reset it, then added a BEFORE trigger (`clamp_can_self_reverse`) that
auto-clears the flag the instant a role change would leave it true on a non-admin/co-admin row,
plus a CHECK constraint as a hard backstop behind the trigger (same defense-in-depth shape as
this project's RLS+RPC dual role checks elsewhere). Exposed as a checkbox in
`TeamManagement.tsx` for the first time — closes the gap flagged two rounds ago when the user
asked what this flag even was — visible only when editing an admin/co-admin (the trigger would
silently no-op it for anyone else, so showing it there would just be confusing).

**Task completion now notifies the assignee.** A new `notify_user()` — the single-recipient
sibling `notify_admins()` (migration 0018) never had — fires from a new trigger on `tasks`
(`AFTER UPDATE OF status ... WHEN status = 'completed'`), catching both completion paths at once
(`auto_complete_task`'s RPC-driven update, and `MyTasks.tsx`'s own plain update for `custom`
tasks) without duplicating a notify call in two places that could drift apart later.

**containers.ownership**, per the user's own preference over their floated QR-sticker rethink
("i like your ownership tag idea better") — `owned`/`vendor_provided`/`given_to_buyer`, wired
into `record_container_fill`'s existing inline container-creation path (still the only place a
container is ever created) and exposed in `PackContainerForm.tsx`. **Caught before shipping**:
`record_container_fill` has been live at its 5-parameter signature since migration 0024 — adding
`p_ownership` via a plain `CREATE OR REPLACE` would have created a second overload, the exact
bug class this sprint already hit twice (decisions #73/#77). Explicit `DROP FUNCTION IF EXISTS`
added before the re-creation, this time before it ever shipped rather than after.

**Role display labels rename** — `RoleBadge.tsx`'s label map is now exported as `ROLE_LABELS`
and `TeamManagement.tsx` imports it instead of keeping its own separate array (the exact
duplication flagged as a risk when this was first raised, fixed the moment it mattered rather
than left to drift). `vendor-rep` → "Receiving & sales", `worker` → "Floor staff",
`super-worker` → "Senior floor staff" — describing what each role actually does, not its
database name; the backend strings themselves are completely untouched everywhere else (RPC role
checks, RLS policies, `eligible_roles_for_task_type()`).

**Delivery-time spoilage split out from ordinary spoilage — the data half of a bigger, still-
open question.** The user asked directly whether `confirm_delivery_arrival` should check for
spoilage at all: yes. Split `p_confirmed_kg` into `p_confirmed_good_kg` and
`p_confirmed_spoiled_kg` (superseding migration 0032's single-kg version — `DROP FUNCTION IF
EXISTS` on the exact old 6-param signature first, since this is the same overload-bug class
again, now guarded against on the *first* pass rather than found after). Physical stock lands at
exactly the good share: the batch is updated to the full measured total first (good+spoiled
really arrived), then a genuine `spoilage` movement for the bad share draws it back out through
`apply_movement_to_batches` (migration 0001) — the same trigger every other spoilage event
already uses, so `kg_remaining` never needs computing twice. No new tag column was needed to
keep this distinct from later in-warehouse spoilage: `receiving_confirmations.spoiled_kg` (added
here) *is* "found at receiving" by definition — any other `spoilage` movement with no
`receiving_confirmations` row behind it is unambiguously "found in the warehouse" instead. The
user's own reasoning for wanting this split — delivery-time spoilage is far more likely the
vendor's fault, warehouse-time spoilage the wholesaler's own handling — is exactly right and
matches this design, but the actual *weighting* of the two into a vendor quality score is
deliberately **not** decided here: that rating system doesn't exist yet (same deferred list as
employee performance rating — needs real data and the wholesaler's own numbers first). This
migration only makes sure the data has the right shape to support it later.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Migrations 0030-0033 all written and committed, none yet applied.

**Explicitly held for a follow-up, not guessed at:** the WhatsApp-bill-as-image/editable-content
idea and its credit-purchase-deferred-reminder tail, and the "worker's next task is selectable"
mechanic (including what happens if they pick more than one) — both underspecified enough, and
big enough a workflow change, to ask the user directly rather than build blind. See the direct
questions put to the user rather than a locked decision here.

**Cross-reference:** decision #73/#77/#80 (the overload-bug class, caught pre-emptively this
time instead of after); decision #79/D52 (the trigger-for-structural-invariant pattern, now
applied a third time); D47 (why the vendor-quality weighting stays deferred); decision #81/D54
(the receiving-confirmation flow this spoilage split extends).

---

### Decision 83 — bill reconciliation: the missing "what did we actually decide" step,
### plus the credit-deferred-reminder workflow, after two clarifying questions came back

**Two things asked directly rather than guessed, in the same round as decision #82's fixes:**
whether "the worker's next task is selectable" needed any real change (answer: no — `MyTasks.tsx`
already lists every task assigned to someone; finishing one just leaves the rest visible, and
D47 already confirmed an employee can hold several at once — nothing to build), and how big a
first pass at the WhatsApp-bill-sharing idea should be (answer: the full thing — editable
template + credit-deferred reminder, not just an image bolted onto the existing text).

**The real gap this closes**: decision #81/D54 built detection (promised vs measured) and
notification (`delivery_discrepancy`) for a bill discrepancy, but nothing let the admin actually
record what they decided about it — "case by case, reconciled by hand" needs a *hand* to write
something down somewhere. `reconcile_bill()` (migration 0034) is that missing step: it never
touches `bills.total_amount` (D54's answer stands untouched) — `reconciled_total_amount` is a
new, separate field recording what was actually agreed, alongside the original promised figure,
not instead of it. Two distinct modes rather than one form with an ambiguous middle state:
settling now (a final figure), or deferring with a reminder — exactly the credit-purchase
behaviour the user described ("if purchasing on credit then this is just a deferred action with
a notification attached... after however long they mentioned").

**No `pg_cron` needed for the reminder** — this project has held off on that infrastructure since
D27 Track C was proposed and left unbuilt; `reconciliation_reminder_at` is a plain timestamp,
checked client-side against `now()` in `BillsManagement.tsx`'s own query, the same place an admin
already looks. A "Needs reconciliation" section surfaces both an unresolved discrepancy
(`receiving_confirmations.discrepancy_flag`) and an overdue reminder together, one place, not two
separate things an admin would have to remember to check.

**`bills.payment_terms`** ('cash'/'credit', default 'cash' — today's only real behaviour stays
the default) is a new toggle on `DeliveryForm.tsx`, wired straight through
`record_bill_delivery` — **DROP FUNCTION first**, since that RPC has been live at 5 parameters
since migration 0019; this is now the fifth time this exact overload-bug class has been
explicitly guarded against pre-emptively this sprint (decisions #73/#77/#80/#82), never once
found live in production because of it.

**WhatsApp sharing made genuinely flexible, per the user's own words ("flexibility in mind")**:
`WhatsAppComposePanel`'s message is now a real `<textarea>` draft, not a static preview — an
admin can edit anything before sharing. Two toggles (per-kg prices, total) control both the text
and a newly-possible generated picture (`billImage.ts` — a plain `<canvas>` receipt layout, no
PDF library, matching D20's established "lite" no-external-service philosophy exactly).
`ShareComposer.tsx` gained real file-sharing: where the platform's Web Share API supports it
(`navigator.canShare` with a `files` array), the picture goes out as an actual attached file
alongside the caption, in one share-sheet action — with copy-text and save-picture fallbacks
where it doesn't. Still never auto-sent — the person always makes the final send themselves,
unchanged from D20's original lite scope.

**One implementation detail caught before it shipped, not after**: an early draft called
`URL.createObjectURL(imageBlob)` directly inline in JSX for the picture preview — a fresh,
never-revoked object URL on every re-render, a real memory leak. Pulled into its own
`BillImagePreview` component that creates the URL once per blob (`useMemo`) and revokes it on
change/unmount (`useEffect` cleanup).

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Migration 0034 written and committed, not yet applied.

**Cross-reference:** decision #81/D54 (the discrepancy-detection flow this completes);
decision #67/D26 (D20's original WhatsApp-lite scope, extended here, not replaced); D27 Track C
(the periodic-digest idea `pg_cron` was proposed for — still not built, still not needed here
either); decisions #73/#77/#80/#82 (every prior instance of the overload-bug guard, now five for
five caught pre-emptively).

---

### Decision 84 — the real spreadsheet's item catalog imported, into its own provisional
### warehouse, not into "Real Operations"

**The user's own scoping, followed exactly**: "the actual values can be another warehouse with
no other detail filled in retroactively until client confirms." Deliberately a THIRD warehouse
(`simulated-operations`), not a re-use of "Real Operations" (still empty, still reserved for the
client's actual confirmed operational data, unchanged by this) and not the Mode A demo (fictional
names, a showcase, not this business's real catalog).

**What `scripts/seed-simulated-operations.mjs` actually does**, re-reading the real spreadsheet
directly rather than working from memory of an earlier summary of it: parses the "Item report"
sheet's 106 real items (skipping its own "Total" row), splits Tamil script out of names where
it's embedded inline (e.g. "Avuli அவுலி" → english "Avuli", tamil "அவுலி"), and derives real
average ₹/kg for both purchase and sale from the sheet's own aggregate quantity/amount columns —
no invented prices anywhere.

**Fields genuinely absent from the spreadsheet** (`category`, `size_grade`, and `shelf_life_hours`
implicitly via the schema default) are filled by plain keyword heuristics (crab/prawn →
crustacean, squid/cuttlefish/CF/OC → cephalopod, else fin_fish; small/medium/large/numeric-grade
patterns in the name → size_grade, else 'mixed') — and every newly-created SKU's own `notes`
field says so explicitly, in the row itself, not just in this log: "a best-effort guess, NOT
confirmed by the wholesaler — verify before this data is ever treated as real." Matches the
user's own "no other detail filled in retroactively until client confirms" instruction as
literally as a schema allows.

**Reused rather than duplicated**: checked every item's `english_name` against SKUs that already
exist (Mode A demo, Real Operations) before creating a new one — 43 of 106 already existed, only
63 genuinely new rows created. An item with zero recorded purchases in the sheet (e.g. "Kaadan",
"Madava") gets a SKU catalog row but no delivery/stock — matches the sheet's own reality rather
than inventing a purchase that never happened.

**Operational texture, via the real RPCs, signed in as a real account — same discipline as
`seed-demo-showcase.mjs`, not hand-crafted SQL**: 5 generic vendors and 3 generic customers
(explicitly named "... - unconfirmed"); 5 delivery bills covering every item with real purchase
data (98 batches, chunked ~20 items per bill rather than one bill per item — efficient, and
closer to how one real trip's delivery actually looks); 33 packed containers and 17 sales at the
sheet's own real derived prices. Deliberately called at the RPCs' CURRENTLY LIVE signatures —
migrations 0030-0034's new optional parameters (`payment_terms`, `ownership`, etc.) aren't applied
yet, so the script omits them entirely rather than assuming they exist.

**One real hiccup, not a bug**: a mid-run network reset (`ECONNRESET`) interrupted the first
attempt partway through SKU creation. The script's own existing-name lookup made re-running safe
without manual cleanup — already-created rows were detected as "reused" on the retry, and it
picked up exactly where it left off. A second, real mistake caught immediately: assumed
`customers` had a `notes` column (it doesn't, checked against its actual migration 0012
definition, not assumed from `vendors`' shape) — fixed before the final successful run.

**Verified**: spot-checked delivered batches' `price_per_kg_paid` and sales' `sale_price_per_kg`
directly against the spreadsheet's own numbers for several items (Blue Crab, Avuli, Chinese 100)
— matched within rounding. `npm run validate` still 73/73 (no schema touched by this pass, only
data).

**Cross-reference:** decision #74 (the original two-warehouse split this now extends to three —
the spreadsheet itself was first read and analyzed in an earlier session pass, described in the
project's own memory notes rather than a prior numbered decision here); D57 (this decision's own
SPEC entry).

---

### Decision 85 — a systematic frontend/backend parity audit, per the user's explicit request
### ("check if the frontend covers all the things backend does")

**Method, not vibes**: every client-facing RPC (`grep`'d for `grant execute` across every
migration, cross-checked against every `supabase.rpc(` call site in `src/`) had its own role
check compared directly against the `App.tsx` route or in-page gate that actually reaches it —
the same check that already found the `/transfer` (decision #78) and `/deliver`/`/sell`
(decision #81) mismatches, this time run against the whole app at once rather than one screen at
a time. Then the RLS-writable tables (plain client writes, not RPCs) got the same treatment.

**Finding 1 — dead code, not a live bug, but confusing and worth removing**:
`execute_sale_reversal`'s "self-execute" branch can only ever be reached by a non-admin whose
`can_self_reverse` is, since decision #82/D55's restriction, *guaranteed* false — meaning it now
always raises its own exception, never actually lets anyone through. Worse, `ReversalRequests.
tsx` still rendered an "Execute now (self-reverse)" button for exactly that case (`decide(id,
'approved')` is a plain admin UPDATE, independent of `can_self_reverse`, so a non-admin's request
really can reach 'approved' status) — a real button, on a real screen, that would always 403
when clicked. Fixed both sides: migration 0035 drops the dead branch (admin/co-admin only, which
is genuinely all the code still does); the button is removed.

**Finding 2 — a role-scope drift of the exact class decisions #78/#81 already fixed twice, just
narrower**: `record_container_spoilage`/`record_repack` have accepted admin/co-admin since they
were written; `/spoil`/`/repack` never did. Not a total lockout (worker/super-worker/vendor-rep
could always reach both) — narrower than the transfer/deliver bugs, but the same underlying drift.
Widened both routes; `SpoilageForm.tsx`/`RepackForm.tsx` each get an explicit admin/co-admin
back-link branch (`/admin`) instead of falling into the vendor-rep/else split that predates their
access and would otherwise send them to `/floor`, a page their own role can't open.

**Finding 3 — the biggest one, a genuine V1 gap**: `vendors_insert_admin`/`vendors_update_admin`
(RLS policies, live since migration 0001) had **no frontend at all** — confirmed directly
(`grep -rln "VendorForm\|vendors.*insert" src/` returned nothing; `VendorSelect` in
`FormFields.tsx` is a plain read-only dropdown). There was no way to onboard a new vendor through
the app, full stop — the exact same gap shape as `SkuManagement.tsx`/`WarehouseManagement.tsx`
closed earlier this sprint (decision #49's own precedent), just never caught for vendors until
this systematic pass instead of a specific bug report. New `VendorManagement.tsx` (`/admin/
vendors`), same discipline: name + phone up front, port/village/boat/typical-catch/reliability/
notes behind "More settings."

**Finding 4**: `tasks_update_own_or_admin` (RLS) has always let admin/co-admin update — reassign,
cancel — ANY task, but nothing beyond the automatic force-reassign trigger (decision #79/D52)
ever exposed that manually. Added a plain "Cancel" action to `TaskDelegation.tsx`'s recent-
delegations feed for any still-open task — a plain client `UPDATE`, no RPC needed, same shape as
`TeamManagement.tsx`'s existing "Access on" toggle.

**Everything else checked and found already correct, not just skipped**:
`record_bill_delivery`, `confirm_delivery_arrival`, `record_container_fill`,
`record_container_sale`, `record_transfer_cascade`, `create_task`/`create_task_round_robin`,
`file_customer_complaint`, `resolve_customer_complaint`, `reconcile_bill`,
`request_sale_reversal` — every one already matched its actual reachable scope exactly.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73), `npm run build` clean,
`npm run selftest` (9/9). Migration 0035 written and committed; migrations 0030-0034 were applied
by the user between this decision and the previous one — live-testing the whole chain (this
migration included) is the next concrete step, not yet done.

**Cross-reference:** decision #78/D51 and decision #81/D54 (the two prior instances of the
route/RPC role-mismatch class finding 1/2 extends); decision #49 (the SKU/warehouse gap shape
finding 3 repeats, for vendors this time); decision #79/D52 (the force-reassign trigger finding 4
sits alongside, now with a manual counterpart).

---

### Decision 86 — a real bug found running the reseed for real, and the reset script's own
### completeness problem, both fixed live

**What happened**: the user applied migrations 0030-0035 and ran `reset-demo-warehouse.mjs` then
`seed-demo-showcase.mjs` themselves. The reseed crashed at its own step 6 — a `CHECK` violation
(`container_fills_kg_remaining_check`, landing at -4kg) on a container_fill whose id didn't match
anything the current run had created. Investigated directly rather than guessed: the failing
fill was a leftover from an OLDER run, still sitting on the SAME container_number
(`TC-DEMO-01`) — meaning the reset pass had not actually cleared every row it should have.
Traced further: my own from-scratch cleanup attempt (built to diagnose this) initially missed
the `container_fills`/`container_fill_items` step itself before deleting `batches` — the exact
same shape of gap, this time caught immediately by the FK error it produced rather than a silent
skip. Cleaned fully, verified to zero across every demo-warehouse-scoped table (batches, sales,
movements, container_fills, tasks, customers) — confirmed the other two warehouses (Real
Operations, simulated-operations) were completely untouched throughout.

**The real, structural fix**: `seed-demo-showcase.mjs`'s two container numbers were fixed
strings, reused on every run. `record_container_fill` treats an existing container with
`kg_remaining=0` on its one fill as "available" and adds a new fill to the SAME physical
container rather than erroring — correct behavior for the real feature (a box empties and gets
reloaded), but it meant any INCOMPLETE cleanup between reseed runs would silently corrupt the
next run's math instead of failing loudly. Now suffixed with a per-run id
(`TC-DEMO-01-${Date.now().toString(36)}`) — sidesteps the whole question of whether a previous
cleanup was perfect, going forward.

**A second, unrelated real bug, found immediately after — the actual point of running this for
real**: with the container-collision fixed, the reseed got all the way to its NEW step 13 (the
in-transit + confirm-arrival discrepancy demo, built earlier this session) and hit a hard
`23502 NOT NULL` violation: `confirm_delivery_arrival` (migration 0033) never set
`movement_group_id` on either movement it inserts — a column that's been `NOT NULL` since
migration 0001, and every other multi-movement RPC in this project generates one. This function
simply never had, and nothing exercised that exact code path for real until this exact reseed
attempt — the whole point of live-testing rather than trusting `tsc`/`validate` alone. Fixed in
migration 0036 (plain `CREATE OR REPLACE`, signature identical, no overload risk): both
movements (the `receiving_confirmed` one, and the `spoilage` one when there's a spoiled share)
now share one new group id, matching how every other multi-movement event in this project groups
its rows.

**State right now**: Demo Warehouse cleaned back to genuinely empty (verified). Migration 0036
written and committed, **not yet applied**. Once it is, `seed-demo-showcase.mjs` can run start to
finish for the first time against the fully current schema — steps 1-12 already proved out
clean on this exact attempt; only step 13 onward was blocked by this bug.

**Verified:** `npx tsc --noEmit` clean, `npm run validate` (73/73). No frontend touched this pass.

**Cross-reference:** D50 (the container-reuse bug class the numbering fix sidesteps a second
instance of); decision #85/D58 (the parity audit immediately preceding this — this decision is
what live-testing its output for real actually turned up); D54 (the receiving-confirmation flow
this bug lived in since it was first written).

---

### Decision 87 — the HyperFrames walkthrough video, built end to end

**Followed the plan already on record** ([[jayshankar-hyperframes-walkthrough-video]] memory,
logged before this sprint even started): Playwright drives the real, running app; HyperFrames
composes the captures into a produced video. Not a raw screen recording — a designed sequence
with captions and transitions, built once the reseed gave the Demo Warehouse a genuinely current,
coherent dataset to capture.

**Environment**: `hyperframes` (npm, v0.8.36) installed as a dev dependency. `hyperframes doctor`
flagged one real blocker — `unzip`, needed to extract its managed Chrome download, no sudo
available in this sandbox — the user installed it directly (`sudo apt-get install unzip`).
Voice/music tooling (whisper-cpp, Kokoro TTS, MusicGen) stayed uninstalled — not needed for a
captioned, unnarrated first pass.

**A real bug found capturing the app, not guessed at**: the first capture script used
`page.goto('${BASE}/bills')` etc. for internal navigation — every one of those "different"
screenshots came back visually identical to whatever the previous `page.goto` had landed on.
Traced directly: the app uses **hash-based routing** (`#/admin`, `#/bills`), so a fresh full
navigation to a bare path doesn't resolve the way an in-app link click does. Fixed by clicking
the app's own nav links (and its "Back to admin dashboard" footer link between admin-panel
screens, since that full nav bar only renders on the dashboard itself, not on every subpage) —
also a more honest capture technique, since it's exactly how a real user moves through the app.

**One deliberate content addition, not left as a weak beat**: the first capture of "Confirm
arrivals" showed an empty state (the seed script's own single in-transit delivery had already
been confirmed by an earlier step) — a poor showcase for a feature this central. Added one more
real in-transit delivery (Mackerel from Selvam, DEMO-004, left unconfirmed) via the actual RPC
specifically so the screen had something real to show, rather than either accepting the empty
state or faking a screenshot.

**Composition** (`hyperframes-video/jayshankar-walkthrough/`): 15 real captures across all three
demo roles (admin, rep, worker), framed in a plain CSS "browser chrome" mockup (no registry
block — `hyperframes init --example app-showcase` turned out to be a broken registry entry,
confirmed directly rather than retried blindly) on a dark indigo gradient matching the app's own
brand accent, each with a kicker/headline/subline caption and a GSAP fade-up transition. Two
real lint failures caught and fixed before rendering, not overridden: animating `autoAlpha`
directly on framework-managed `.clip` elements (fixed by moving all animated content into an
inner wrapper div per element, per the linter's own documented fix) and a missing GSAP hard-kill
at each scene's exit boundary (added `tl.set(..., { autoAlpha: 0 })` after every exit tween, so
non-linear seeking in Studio can't land on stale visibility state). A genuine WCAG-AA contrast
failure on the title card's feature chips (translucent-on-dark text measuring as low as 1.05:1)
was fixed with a solid dark chip background and brighter text, not suppressed. `npm run check`
passed clean (0 errors) before the first render.

**Output**: a 49-second, 1920x1080, 30fps MP4 (`renders/jayshankar-walkthrough_*.mp4`, ~7.8MB).
Verified directly, not assumed from a clean render log: extracted 4 frames via `ffprobe`/`ffmpeg`
at different timestamps (title card, admin dashboard, bills, closing card) and visually confirmed
each renders correctly, matches its intended layout, and carries real, current app data (the
newly-widened role-scoped nav, the "Receiving & sales"/"Floor staff" friendly labels, a real
delivery-discrepancy notification, a real credit/reconciled bill).

**Verified:** `npm run check` (0 errors, 1 organizational warning, 17/17 contrast checks pass),
render completed and validated. Binary assets (`captures/`, `assets/`, `renders/`) gitignored —
the composition source (`index.html`, `capture.mjs`) stays tracked so the video is reproducible
from git alone, without committing screenshots or the MP4 itself to the repo.

**Cross-reference:** the `jayshankar-hyperframes-walkthrough-video` and
`jayshankar-playwright-capture-technique` memory entries this decision executes; decision #84/D57
and decision #86/D59 (the reseed and the real bug it surfaced — what made this video's data worth
capturing in the first place).

---

### Decision 88 — a direct audit question ("are all scenarios showcased?"), answered
### honestly (no) and then closed with two more videos

**Checked, not assumed**: diffed the first video's 13 covered routes against `App.tsx`'s full
24-route list. Ten route groups were entirely missing (fish types, warehouses, vendor
management, team, audit log, task delegation, transfer, spoilage, customers, payments, and all
four search-result card types), and several routes the first video DID touch were only shown at
their list-level state, not the feature-defining screen inside them (Pack's actual sub-form with
the ownership dropdown; the WhatsApp share compose panel; the bill reconciliation panel; a
customer actually selected in Payments).

**A second, deeper capture pass** (`capture2.mjs`/`capture3.mjs`/`capture4.mjs`) closed every one
of those gaps against the same real, reseeded data — including navigating one level deeper than
a list view wherever the real feature lived there: clicking "Mark shared → WhatsApp" to reach the
actual editable-message panel; clicking "Reconcile" on the real DEMO-003 credit bill; clicking
into Karthik's own admin-tier team entry specifically to get the self-account warning and the
`can_self_reverse` checkbox in the same frame (Anitha's own edit form, captured first, is
vendor-rep and correctly doesn't show that checkbox at all — not a missed capture, the honest
result of a role-gated field); selecting a real customer in Payments instead of leaving it on its
empty default state.

**Built via a shared generator, not three hand-copied HTML files**: `gen-composition.mjs` takes a
JSON scene list (image, kicker, headline, subline, duration) and emits the exact composition
structure proved out in decision #87 — same browser-chrome frame, same GSAP fade-up-with-hard-
kill pattern, same WCAG-AA-safe title-card chip styling — so the two new videos ("Admin & Setup,"
"Money, Trust & Search") inherit every lint/contrast fix from the first video automatically
instead of risking a fresh copy of the same mistakes. Both passed `npm run check` clean on the
first generated attempt.

**Coverage now**: all three videos together touch all 24 real routes in `App.tsx` at least once —
field operations (video 1), back-office setup and warehouse operations (video 2), and money/
trust/search (video 3).

**Verified:** `npm run check` clean for both new compositions (0 errors, 19/19 and 18/18
contrast checks respectively), both rendered (47.6s and 41.4s, 1920x1080), frames spot-checked
directly. Binary assets gitignored; generator + configs + composition source tracked.

**Cross-reference:** decision #87/D60 (the first video and the template this one reuses); the
route inventory itself, taken directly from `App.tsx` rather than recalled from memory.

---

### Decision 89 — real screen-recorded tutorials, a genuinely different production style
### from the first three videos, per a reference the user pointed to directly

**Watched the reference first, not guessed at its style**: `eduplay-code-sprint.mp4` (a peer
project's own produced video) is a real screen recording — live typing, a real countdown timer
animating, a phone-mockup split view — with short, punchy caption callouts (dark rounded box,
bold white text) explaining what's happening at each real moment, not a slideshow of static
frames. The first three Jayshankar videos are all composed from static screenshots; this is
structurally different and needed its own pipeline, not a variation of `gen-composition.mjs`.

**Real recordings, not screenshots**: `hyperframes-video/record-scenarios.mjs` uses Playwright's
`browser.newContext({ recordVideo: {...} })` — an actual video capture of the browser, not
frame-by-frame screenshots — driving two full, realistic workflows against the live app and the
real reseeded demo data: signing in with visible per-character typing (`page.type(..., { delay
})`), clicking through to Deliver/Sell, filling every field the same way, and submitting for
real. "Record a Purchase" ends with a real `Bill ... recorded — 2 lines, ₹14150.00 total` success
message; "Record a Sale" ends with a real `Sale ... recorded.` — neither faked, both the actual
app responding to the actual submitted data.

**Caption timing verified against real frames, not estimated from the recording script's own
wait-timings** — extracting and reading frames at multiple timestamps across both raw recordings
(the same "verify, don't assume" discipline this whole sprint has run on) to find the real
moments — sign-in complete, form loaded, each field filled, success shown — before writing a
single `data-start` value, so the captions land on what's actually on screen at that timestamp,
not a guess from cumulative `waitForTimeout` arithmetic.

**A real renderer bug caught by `npm run check` before it ever reached a render**: a `<video>`
element with `data-start` but no `id` attribute renders completely FROZEN — HyperFrames' own
documented gotcha, not something guessed at; the linter names it outright
(`media_missing_id`). Fixed by giving both videos a stable id before the first render attempt,
not discovered after watching a broken output.

**Composition**: each tutorial reuses the browser-chrome mockup and dark indigo background from
the other three videos for visual continuity, but plays the real `<video>` inline (muted, no
separate audio track needed since these recordings capture no audio) instead of a static `<img>`,
with caption callouts positioned bottom-center over the recording — the closest fit to the
reference's own overlay style, adapted for a single-user desktop app rather than the reference's
host+participant split view (Jayshankar has no simultaneous multi-device scenario to show).

**Verified:** `npm run check` clean for both (0 errors; "Record a Sale" 14/14 contrast checks
clean on the first pass, "Record a Purchase" needed the `id` fix first). Both rendered (24.4s and
20.0s, 1920x1080) and spot-checked by extracting real frames from the finished MP4s, confirming
the embedded video genuinely plays (not frozen) and captions land where intended.

**Explicitly scoped as a first pass, per the user's own "various scenarios... that could
realistically happen"**: only the two named scenarios (a purchase, a sale) were recorded this
round. The same `record-scenarios.mjs` pattern extends directly to the other realistic
combinations already built this sprint (pack a container, confirm an in-transit delivery, file
and resolve a complaint, reconcile a credit bill) — not built yet, a natural next batch.

**Cross-reference:** decision #87/D60 and #88/D61 (the static-screenshot video pipeline this
diverges from, for a real reason — recorded footage vs. composed stills — not a wasted rebuild);
the `jayshankar-playwright-capture-technique` memory entry, whose original note about capturing
"an animation actually animating" foreshadowed exactly this kind of real-recording verification
need.


---

### Decision 90 — the remaining 34 tutorial scenarios recorded, a role-filtered in-app
### "Learn" library built from all 36, and `Jayshankar-clean` brought current — logged
### retroactively (the actual work spanned three later parts of the same long session that
### produced decisions #87–#89, but the running BUILDER-DECISIONS-REVIEW.md/HANDOVER.md updates
### were skipped in the moment across several context-window continuations; caught and filled
### in here rather than left silently missing, per this file's own standing rule)

**First, a full 36-scenario taxonomy was listed on direct request** (inventory movement,
money & customers, trust & corrections, admin setup, task coordination, search, and six
"multi-step composite" flows), then built in the order the user actually asked for: composites
first, then the remaining 28 single-action scenarios.

**The 6 composites** (`hyperframes-video/record-composites.mjs`, scenarios 31–36: receive→pack→
sell; a delivery confirmed short then reconciled; a complaint resolved partial; a reversal
requested and executed; running low mid-shift with a repack; a delegated task that auto-
completes) and **the 28 singles** (`record-inventory.mjs`, `record-money.mjs`, `record-trust.mjs`,
`record-admin.mjs`, `record-tasks-search.mjs`, scenarios 3–30) are all real Playwright
`recordVideo` captures — signing in as the real demo users, typing every field visibly, clicking
real buttons — never screenshots, continuing decision #89's approach rather than #87/#88's
composed-stills one. Every scenario's outcome was checked directly against the live database
afterward (not just "the script exited 0"), the same discipline as every RPC in this project.

**Real, previously-unknown-class bugs found this way, not by inspection**:
- `PackContainerForm.tsx`'s unpacked-bill rows are `<button>`, not `<div>` — a wrong assumption
  in the first draft selector, caught by a 30s Playwright timeout with zero matches, fixed by
  reading the component source directly rather than guessing again.
- **Several lists genuinely have no secondary sort key**, and "most recent first" does not mean
  what it sounds like once several rows tie on the only sort column. `BillsManagement.tsx`'s
  bills list orders by `bill_date` — a plain DATE, so every bill made "today" ties, and Postgres's
  tie-break is arbitrary storage order, not recency. Confirmed live: an unrelated seed-data bill
  sorted ahead of a freshly-created one, so a `.first()` "Mark shared"/"Reconcile" click silently
  acted on the wrong bill twice before this was caught and fixed (scoped to the exact bill by its
  total amount instead of list position). The same duplicate-display-name trap bit the employee-
  picker grid in task delegation — two seeded accounts are both named "Anitha" (and separately,
  both named "Suresh") sharing a display name with no visible way to tell them apart in the UI;
  confirmed by direct DB query which one is actually wired to which login before trusting
  `.first()`/`.last()` in the recording script.
- **A sale recorded against a SKU with silently-zero stock doesn't crash — it fails inline** (a
  form error the recording script wasn't checking for), and the script then barrelled ahead into
  requesting a reversal against a completely unrelated, older sale instead. Fixed the general
  case: every scenario that sells a SKU now delivers fresh stock for it in the same scenario
  first, rather than trusting leftover seed data to still be there.
- `selectByText`'s plain substring match silently picked a longer, alphabetically-earlier SKU
  name containing the requested one as a substring ("Karimoral" for a request of "Moral") —
  cosmetic in that one case (the DB check didn't depend on which SKU), but the same bug class
  `selectByExactPrefix` (introduced during the composites, decision-worthy on its own) already
  existed specifically to catch.
- Repack's destination-container rule needs a container with **zero** active fill, not merely
  "less than the source" — and a container only ever comes into existence already filled
  (`record_container_fill` is the only INSERT into `containers`), so a genuinely empty
  destination has to be produced by fully selling one out first, inside the same recording, not
  assumed to exist.

**A shared helper library** (`hyperframes-video/lib.mjs`: `signOutIn`, `typeInto`,
`selectByText`/`selectByExactPrefix`, `newRecordingContext`/`finish`, `runScenarios`) was
factored out of `record-composites.mjs` before the 28 singles were written, carrying forward
every fix above (`typeInto` now always clears a field before typing — several forms pre-fill a
value from real state, e.g. a payment amount defaulting to a sale's own balance, and
`page.type()` inserts at the cursor rather than replacing) so the singles scripts didn't have to
rediscover any of it.

**A role-filtered "Learn Jayshankar" page** (`/learn`, `src/pages/TutorialLibrary.tsx` +
`src/lib/tutorials.ts`) turns all 36 rendered videos into in-app teaching material, reachable via
a "🎓 Learn" button added to every dashboard. Defaults to whatever's relevant to the signed-in
role — `audienceFor()` maps `co-admin`→admin's bucket and `super-worker`→both worker's and
vendor-rep's buckets, matching `App.tsx`'s own `expected` role arrays rather than re-deriving
role logic — with an "All 36 features" toggle to browse everything, grouped into 8 categories.
Verified live against all 5 roles: rendered counts (26 admin, 17 vendor-rep, 7 worker) matched
the hand-authored tags exactly. Confirmed the 69MB of video (`public/tutorials/`) is NOT
precached by the PWA service worker — `vite.config.ts`'s `workbox.globPatterns` only matches
`js/css/html/svg/woff2`, never `mp4` — so it loads on demand only, never bundled into the
offline app shell.

**`Jayshankar-clean` (the public GitHub/Netlify repo) resynced from scratch** — it had drifted
to 3 commits behind, missing migrations 0015–0036 and nearly all of this session's frontend
entirely. Synced via `git ls-files` from this repo (exactly what's actually version-controlled,
not a raw folder copy, so no local build caches came along), explicitly excluding `.env*`,
`node_modules/`, the methodology docs (`SPEC.md`, `HANDOVER.md`, `AGENTS.md`,
`BUILDER-DECISIONS-REVIEW.md`, `AGENT-BRIEF.md`, `AUDIT-*.md`, `TOOLING-AUDIT.md`), `client-qa/`,
`hyperframes-video/` (the production tooling itself — only its output, `public/tutorials/`,
ships), and `Jayshankar-clean`'s own already-curated `docs/`/`README.md`.

**A real gap in that exclusion found by inspection, not assumed clean**: the synced code carried
119 code-comment references to the excluded methodology docs by filename (`SPEC.md §4.3.11`,
`BUILDER-DECISIONS-REVIEW.md decision #34`, etc.) across 49 files — confirmed as a real problem,
not paranoia, because one already-committed file (`capacitor.config.ts`) showed clear prior
evidence someone had deliberately reworded exactly this before ("per the design doc D18" instead
of "per SPEC.md D18") and my own sync had just silently regressed it back. Reworded all 119 to
generic phrasing ("the spec §4.3.11", "decision #34") without touching the actual reasoning in
any comment. Also removed `scripts/validate.mjs`/`selftest.mjs` from the clean copy entirely —
both are TINS-gate tooling that checks for `BUILDER-DECISIONS-REVIEW.md`'s own existence/format,
meaningless (and a bigger methodology tell than a comment) without the file it checks for — and
fixed the one doc (`docs/SUPABASE-SETUP.md`) that told a reader to run them.

**Verified:** `npm install && npm run typecheck && npm run build` all clean in `Jayshankar-clean`
after the sync and the reference cleanup. The user committed and pushed this independently
(`49ffe66 "v1 complete"`, confirmed already on `origin/master`) before the retroactive logging
here happened — this entry documents what shipped, not a pending change.

**Left open, not resolved here:** two things surfaced after `v1 complete` was already pushed,
found while writing this catch-up entry, not yet decided on:
1. `docs/recommendations/` (10 files, `Jayshankar` main repo, dated 2026-09-15) — a full Mode
   B/C roadmap (competitive gap analysis against 12 apps + Vyapar, a forecasting system design,
   a tiered build-priority list, draft SPEC amendment deltas) that reads as produced by a
   separate session/effort this decision log has no other record of. Documentation only, nothing
   applied — see its own `00-readme.md`.
2. `public/tutorials/categorized/` (`Jayshankar-clean`, untracked) — the same 36 videos copied
   again into 7 category subfolders (a different category scheme than `tutorials.ts`'s own),
   doubling `public/tutorials/`'s footprint to 135MB in that repo. Not referenced anywhere in
   `src/`, not committed. Purpose and origin unconfirmed — flagged for the user rather than
   guessed at or cleaned up unilaterally.

**Cross-reference:** decision #89/D-none (the real-recording pipeline and `typeInto`/frame-
verification discipline this extends to all 34 remaining scenarios); decision #87/#88 (the
composed-stills videos this session's approach diverges from); `AGENTS.md` §5 / `HANDOVER.md`
§7's handover protocol, which this entry itself is a late-but-honest instance of following.

## W7–W10 — 2026-09-29

### Decision 91 — Deck 2 swaps a *surface*, not a mode: the design language is injected into the player

**What changed.** `ChapterPlayer` gained an optional `surface?: StorybookSurface` prop, defaulting to
the app's own Tailwind renderer. The contract lives in `src/lib/storybook/surface.ts` (types only —
`label` + `Blocks` + `PhoneFrame` + `DesktopFrame`); the Tailwind implementation is
`src/components/storybook/app-surface.ts`; the Ant implementation is
`src/components/storybook-ant/AntSurface.tsx`. Both `FrameSurface` call sites (the stage and the
filmstrip thumbnails) and `Filmstrip` itself now take the surface, so a deck cannot end up with an
Ant frame around Tailwind blocks.

**Why.** The obvious alternative — a `variant="ant"` flag read inside the player — would have made
`components/storybook-ant/` reachable from the app's own import graph the moment anyone wrote the
obvious `import`. The whole point of deck 2 is that it exists to *answer* D67, and D67 may well be
answered "Tailwind". Injection means `antd` is imported only by the Ant deck's page and entry point,
so the app bundle is byte-identical whichever way the client answers, and there is no flag to
accidentally ship. It also keeps the comparison honest: one player, one set of chapter data, one
`FrameSurface`, two renderers — so a difference the client sees is a design difference, not a layout
difference. The QR generator is copied verbatim from `blocks.tsx` for the same reason: a container
code must draw the same pattern in both decks or the screenshots stop being comparable.

**Cost, stated plainly.** The Ant deck is 1.27 MB of JS (392 KB gzipped) against deck 1's 408 KB,
because antd ships a full design system — tokens, resets and a CSS-in-JS runtime. That is the price
of the comparison, and it is visible in the artifact, not hidden.

### Decision 92 — Kit-growth candidate: `migration-runner.mjs` cannot run, and cannot apply to this project

**What changed.** Nothing in `tins-kit/` — the kit is read-only for consumers (its
`docs/LIBRARY-CONVENTIONS.md` §10). Recorded here as a candidate for
`tins-kit/prompts/KITTING.md` to triage at the kit machine.

**Why.** Two defects found while trying to use it to apply the Phase B migrations:
1. It calls `require('node:crypto')` inside an `.mjs` module (`lines 70–75`), which throws
   `require is not defined` before it applies anything. In ESM the import has to be static or via
   `createRequire`.
2. It is not usable against a project whose earlier migrations were applied by hand: it tracks state
   in its own `migrations_applied` table, so on this project it would attempt **all 46** files rather
   than the 10 pending. A runner whose ledger can only be populated by the runner itself is
   unusable for adoption, which is the normal case — every project starts without the ledger.

**What this cost.** Nothing was broken, but a tested security fix (`0046`) has sat unapplied partly
because there is no working apply path at all (no `DATABASE_URL` in this repo, no `psql`/`pg_dump`/
Supabase CLI/`pg`). That finding is recorded as CRITICAL in `REVIEWER-DECISIONS-REVIEW.md` Finding 7;
the apply order and the two possible paths are in `docs/BACKEND-PHASE-B-STATUS.md` §9.


## Methodology reconciliation — 2026-10-02

### Decision 93 — Reconciling work done by sessions that did not know the TINS methodology

**What changed.** A methodology audit (`tins-kit/prompts/CONTINUE-TINS-PROJECT.md` Steps 0 and 6, then the
standing rules in `AGENTS.md` §3 checked one by one against the repo) found the following, all now
reconciled **in the spec and the docs — no generated code was edited**:

1. **Gate was red.** `node tins-kit/scripts/tooling-audit.mjs` exited 1: a verdict cell in
   `TOOLING-AUDIT.md` carried a sentence instead of `SAFE`. Fixed; gate green. (`validate` 10/10 kit +
   73/73 project, `selftest` 9/9, the kit's own selftest 56/56 *when run from `tins-kit/`* — run from the
   project root it reports 41 false failures, because it resolves `scripts/validate.mjs` from `cwd` and so
   tests this project's validator instead of the kit's. **Kit-growth candidate:** the kit's selftest
   should resolve its siblings from `import.meta.url`, not `process.cwd()`.)
2. **Ten packages in `package.json` with no `SPEC.md` §4.4 row** (rule 2): `fuse.js` (search, D44), the
   shadcn/Radix layer (`@radix-ui/react-slot`, `@radix-ui/react-collapsible`, `class-variance-authority`,
   `clsx`, `tailwind-merge`, `tailwindcss-animate`), `lucide-react`, `@capacitor/cli`, `playwright` (dev).
   Rows added to §4.4, each with its actual use read from the imports; audit row added to
   `TOOLING-AUDIT.md`. Also recorded the reverse drift: `zod` is listed but never adopted, `wouter` was
   not chosen (`react-router-dom` + `HashRouter`, which the row permits), `vite-plugin-pwa` is 1.x not 0.20.x.
3. **A DELETE policy against rule 5.** `containers_delete_admin` (migration `0011`) is authorised by the
   locked **D32** and was logged as decision 44 — so the *process* was followed — but `AGENTS.md` rule 5
   and `SPEC.md` §3.8 still said "never / no DELETE on any table". Both now state the single recorded
   exception and why the FK still protects fill history. No other DELETE policy exists anywhere under
   `supabase/`; `audit_log` has none.
4. **Stale counts and state.** `HANDOVER.md` said §8 has 31 criteria (the validator counts 58); `AGENTS.md`
   §0 said "built: the SPEC, nothing else yet" with 46 migrations and two decks in the tree; `AGENTS.md`
   rule 2 pointed at SPEC §4.1 for the package list (it is §4.4). Corrected.

**Why.** The user reported that some sessions built on this repo without understanding the TINS
methodology. *The following is inferred from the git history and the files, not from any session record:*
the pattern in what was missed is consistent — "spec first" was followed for
**schema and RPCs** (D-numbers, migrations, decisions — the migrations and RPCs I sampled each cite a locked
decision or a log entry; I did not check all 46) and skipped it for **front-end and tooling** (a component layer, an icon set, a search library
added with the feature, not with a spec row). The rule they broke is rule 2's *timing*, and rule 1's scope
("edit SPEC.md and regenerate") for UI work.

**What was deliberately NOT done, and why.**
- **No decision was added to `SPEC.md` §0.2 for the Phase A UI redesign.** That is a locked-decision
  change, which `AGENTS.md` §4 puts under *Ask first*, and the content (the 12 client-locked visuals, the
  tile-grid home, the shadcn layer as the app's component base) is the client's and the user's to confirm,
  not mine to infer from commit messages. It is the **one real open item** this reconciliation leaves:
  commits `3cd0bd5` and `be38941` (RepDashboard, Layout, NotificationBell) changed the shipped UI with no
  SPEC section behind them. D63–D76 are reserved/proposed by the v3/v4 amendments, so the next free
  number is **D77**; propose it, do not take it silently. Tracked as `HANDOVER.md` W11.
- **`@capacitor/cli` was not moved to `devDependencies`**, and `package.json`/the lockfile were not
  touched — a docs reconciliation should not change what installs. Noted in §4.4 for the next real edit.
- ~~**The #67–#89 gap in this log was not back-filled.**~~ **Corrected later the same day (see decision 98):
  there is no such gap.** Every heading #1–#98 exists, contiguous. What was skipped *in the moment* was the
  write-up of the video-sprint work, which decision #90 then back-filled retroactively; the claim above conflated
  the two. It was copied into `AGENTS.md`, `NEXT-AGENT-ONBOARDING.md` and two kit-growth drafts before a reviewer
  checked it against the file; all four are corrected.
- **`scripts/.env` holds a live `sb_secret_…` key.** It is gitignored and untracked, so it is not a rule-12
  breach, but AGENTS.md's own rule is that a key saved to a shared file is burned. Whether this Windows
  desktop path counts as shared is the owner's call — **rotate it if in doubt**; not touched here.

**Impact on downstream.** `npm run validate`, `npm run selftest` and the tooling gate are all green. A
future session that adds a package now finds the rule and the table agree on the section number and on the
timing. A future session that wants another DELETE policy finds that rule 5 requires a locked decision first.

**Kit-growth candidates (`AGENTS.md` §6):** (a) the kit's selftest's `cwd` dependence, above; (b) the kit's
`templates/TOOLING-AUDIT.md` lists the three verdict values but does not say the cell must contain *only*
the bare word, which `tooling-audit.mjs` enforces — one sentence would have prevented the red gate; (c) a validator check that diffs
`package.json` against the §4.4 table would have caught item 2 mechanically, at the commit that introduced
each package (the project's `validate.mjs` could add it now; not done here because a new check needs a
matching self-test case, D24, and that is its own W).

### Decision 94 — Documentation reconciliation: classify every document, move what is superseded, keep what is the owner's

**What changed.** Every project `.md` outside `tins-kit/`, `archive/`, `_external/`, `delegation/` and the generated
`hyperframes-video/` scaffolds (about 80 files) was read, compared against `SPEC.md` and the code, and classified.
**No application code, `package.json`, migration or locked `SPEC.md` §0.2 row was changed.**

*Moved to `docs/deprecated/` with `git mv`* (index and old-path → new-path table: `docs/deprecated/README.md`):
`SPEC-AMENDMENT-v2.md` (merged); `AGENT-BRIEF.md` (executed); `AUDIT-2026-09-10.md` (snapshot; gitignored, so moved on
disk only); `client-qa/session3/plan.defered-flutter.md` (superseded by the rebased `plan.md`); `docs/recommendations/`
(10 files); `docs/competitive-audit-2026-09-16.md` and `docs/design-sample/` (8.9 MB); the W2–W5 manual checklists and
`W3-DIAGNOSTIC.md`; and, **verbatim**, `HANDOVER.md`'s per-session diary (~560 lines) and the 2026-09-16
`NEXT-AGENT-ONBOARDING.md`.

*Rewritten or corrected in place:* `README.md` (still described Mode A), `docs/ARCHITECTURE.md` (said `BrowserRouter`,
nine tables, two locations, three roles, "no CRM"), `NEXT-AGENT-ONBOARDING.md` (stale snapshot sections dropped,
evergreen ones kept), `docs/CONTRIBUTING.md`, `HANDOVER.md` (back to the kit's shape; the duplicated W3 entry, the
unmarked W4 and the stale iOS/offline gotchas fixed; W12 and a carried-forward backlog added), `AGENTS.md` (read list,
numbering table, documentation standard), `docs/BACKEND-PHASE-B-STATUS.md` (a verbatim-duplicated §9 block removed),
`docs/BACKEND-REQUIREMENTS-phase-b.md` (its "nothing implemented" status line was false) and `SPEC.md` §0.3 ("Not yet
built") plus a new **§0.2c supersession map**, which adds no decision.

*Kept live, with status banners:* both amendments, `client-qa/` (new index `client-qa/README.md`; stale status lines
corrected on five files).

**What the comparison found** (beyond the staleness): (1) **Amendment v3 and the Phase B migrations disagree** about
blind receiving — v3's `procurement_mode` toggle, `receiving-storage` role and `procurement_trip` task appear in none of
the 46 migrations, while Phase B built `procurement`/`truck_loads` and a `receiving_blind` flag with "no sixth role", and
neither document mentions the other. v4 contradicts itself on the same point. Recorded, **not resolved** (`HANDOVER.md`
W12). (2) `docs/recommendations/` proposed migrations `0040`–`0050` that collide with the real `0037`–`0046`.
(3) `client-qa/feature-comparison.md` proposes a second "D63–D65" that collides with v3. (4) D6, D9 and D13 are still
`LOCKED` although D30, D29 and D18 supersede them; `SPEC.md` §2.1's route map is Mode A history; three documents the
spec cites (`docs/OFFLINE-WRITE-QUEUE.md`, `ROADMAP.md`, `scripts/import-legacy.mjs`) were never written. (5) The offline
write queue (D30, §8.16) is **decided and unbuilt**; `plan.md` and the code agree. (6) The live project's audit trail
covers 8 of 24 tables until `0037` is applied.

**Why.** The owner reported that some sessions built without understanding the methodology. The pattern in the
documents matches it: each session left a snapshot instead of updating the canonical file, so by now five documents
each claimed to be "the" onboarding file and a sixth (`HANDOVER.md`) had grown a 560-line diary above its real
brief. The kit's own shape — one orientation file, one state file, one decision log — was restored by moving, not
deleting, so no history is lost.

**What was deliberately NOT done.**
- **No amendment was merged, retired or rewritten.** The owner said the amendments are their way of listing intended
  changes. v3's header was not edited either — a verified status block was *added above* it.
- **No choice between v3 and Phase B.** That is a design decision (the owner chose "record only").
- **D6/D9/D13 were not re-marked.** Editing a locked row is *Ask first*; `SPEC.md` §0.2c records the supersession
  beside the table instead.
- **Old paths inside applied migrations and code comments were not edited** (SPEC D2). `docs/deprecated/README.md`
  lists each stale reference and where it now points.
- **`client-qa/` was not tidied.** Its open questions are the owner's; only wrong status lines were corrected.
- **The 5 `scripts/capture-*.mjs`** still write to the old `docs/design-sample/` path. They are research tooling
  with no consumer; left as found and noted in the deprecated README.
- **Not read in full, and so not independently verified:** `docs/SCHEMA.md` (1,102 lines, generated),
  `docs/API-REFERENCE.md`, `SUPABASE-SETUP.md`, `DEPLOY-*`, `REVIEW-BUILD.md`, `LOOKER-STUDIO-SETUP.md`, and the
  bodies of `docs/deprecated/recommendations/01–09`. They were classified from their headers and status lines; none
  was moved on that basis except the recommendations, whose collision with Phase B was checked against the migration
  list.

**Impact on downstream.** A new session now meets one orientation file (`AGENTS.md`), one hand-off file
(`NEXT-AGENT-ONBOARDING.md`), one state file in the kit's shape (`HANDOVER.md`), and a `docs/deprecated/README.md` that
explains every retired file. `npm run validate`, `selftest` and the tooling gate are unchanged and green.

**Kit-growth candidates (`AGENTS.md` §6):** (a) the kit's `templates/HANDOVER.md` should say where a per-session diary
goes (the decision log, or a `docs/history/` file) — here it accreted inside the state file for six weeks; (b) a kit
check that **a document may not be moved without a `docs/deprecated/` row** would have caught the five competing
"start here" files; (c) a kit rule for **how to supersede a locked `D` row without editing it** — the supersession map
in `SPEC.md` §0.2c is the improvised answer, and it should be a template section.

### Decision 95 — Deck 2 (Ant Design) rendered blank on Pages, then broken on every desktop-layout chapter: four root causes

**What changed.** `src/storybook-ant.css` now loads `@tailwind base` through a new deck-2-only config,
`tailwind.storybook-ant.config.ts` (preflight off); `src/pages/StorybookAntReview.tsx` sets
`<Layout hasSider={false}>` and a responsive header. Nothing in the app, deck 1 or `tailwind.config.ts` changed.

**Four causes, each found by looking at the running page, not by reading code:**
1. **Blank page on GitHub Pages — wrong base path.** The pushed folder was built with `VITE_BASE` unset, so
   `index.html` asked for `/assets/…`, `/registerSW.js` and `/manifest.webmanifest` from the domain root; a project
   site lives at `/Jayshankar-ui-antd/`. 404 on the JS ⇒ empty `<div id="root">`. `scripts/publish-storybook.sh`
   sets the base; a hand-pushed `dist-storybook-ant/` does not.
2. **Phone frame half a frame off-centre, overflowing on a phone, enlarge ineffective — missing Tailwind variables.**
   Deck 2 omitted `@tailwind base` (to keep antd's reset the only one). In Tailwind 3 that layer also emits the
   `--tw-*` defaults every `translate-*`/`scale-*`/`shadow-*`/`ring-*` utility reads; without them
   `-translate-x-1/2 scale-[0.9]` computed to `transform: none` (confirmed: `--tw-translate-x` empty).
3. **Every desktop-layout chapter (21–32) collapsed — antd Sider auto-detection.** `AntDesktopFrame` draws a
   `Layout.Sider` inside a plain `<div>`, so the Sider registered with the *page's* Layout, which gained
   `ant-layout-has-sider` (`flex-direction: row`) and put header, content and footer side by side: content 0px wide,
   title one letter per line, page 5,372px tall, and the "Magnify to read" button unclickable (an antd layout
   intercepted the pointer). An explicit `hasSider={false}` overrides the detection (antd `useHasSider`).
4. **Header brand wrapped letter by letter below ~480px** — no responsive handling for the subtitle and second tag.

**Verification.** Playwright/Chromium, dev and a production build served under `/Jayshankar-ui-antd/`: all 32
chapters × phone (390), tablet (768) and desktop (1440) checked for a collapsed title, horizontal overflow, a
row-layout page and a wrapped brand — clean — and the magnify toggle opens a 1,180px pannable strip on a phone.

**Lessons worth keeping.** (a) `npm run build:storybook-ant` runs with `emptyOutDir`, so it **deletes a `.git`
inside `dist-storybook-ant/`**; publish through a separate clone (the script does). (b) Vite's file watcher does not
see edits on this Windows-mounted drive (`/mnt/c`): a dev server must be restarted after each change or it serves
stale code — this cost two false "the fix didn't work" readings. (c) A review deck is verified by *loading it in a
browser at phone width*, not by a green `tsc`: every defect above type-checks.

**Not done / open.** The deprecated-API console warnings (antd `Space direction`, `Alert message`, `List`,
`Descriptions labelStyle`, …) and one React "does not recognize the `%s` prop" warning are unfixed — cosmetic, not
rendering. The Tailwind deck 1 was not re-tested (untouched). **Publishing is the owner's step** (no GitHub
credentials here); the corrected build is in `dist-storybook-ant/`, uncommitted.

### Decision 96 — Deck 2 rebuilt as a native Ant Design workbench, not deck 1's player with Ant widgets inside

**What changed.** The owner looked at the repaired deck 2 and said it "doesn't seem much different". They were right.
Deck 2 reused deck 1's Tailwind `ChapterPlayer` — header, one stage, caption, button row, filmstrip — and only swapped
the block drawings and the device-frame chrome. That answers "what do Ant widgets look like in a phone mock-up", not
D67's question, "what would the app *feel* like in Ant Design". New files under
`src/components/storybook-ant/deck/`: `AntDeck` (header, `Layout`/`Sider`, `Drawer`, dark algorithm), `AntHome`
(`Statistic`, `Tabs`, `Segmented`, `Input.Search`, `Badge.Ribbon` cards with live scaled thumbnails, `Collapse`,
`Tour`), `AntChapterView` (`Breadcrumb`, clickable `Steps` walk-through, `Space.Compact` transport with a `Progress`
autoplay clock, a sticky control bar on phones), `Lightbox` (tap the screen to enlarge: `Modal`, Fit / Actual size,
swipe, arrows), `AntNav`, `ScaledFrame`, `AntScreen`, `hooks`. `pages/StorybookAnt.tsx` and `StorybookAntReview.tsx`
are now thin wrappers. `ChapterPlayer` is untouched and still drives deck 1.

**Design choices worth knowing.**
- **Measured scaling, not a breakpoint table.** `ScaledFrame` fits a frame to its container (and an optional height
  cap) with a `ResizeObserver`; the shared player used hand-picked `scale-[0.82]` classes and matching box sizes that
  had to be edited together.
- **The screen is the control.** Tapping or clicking the device opens the lightbox (`E` toggles it); the old
  "Magnify to read" button existed only for desktop panels on a phone.
- **Dark mode darkens the workbench, never the product.** The device frame sits in its own `ConfigProvider`
  (`inherit: false`, the original light tokens): a dark-mode "app" would be a different design, not a viewing mode.
- **Explicit `hasSider` on every `Layout`** (see decision 95) — the desktop frame draws its own `Sider`.
- **`useIsNarrow` reads `matchMedia` synchronously**; antd's `Grid.useBreakpoint` reports nothing until after mount,
  which flashed the desktop layout on a phone.
- **Deep links unchanged** (`#/review?c=…&s=…`), so every link already sent still works.
- **Deprecated Ant APIs removed** from the old block renderers (`Alert message`→`title`, `Statistic valueStyle`→
  `styles.content`, `Descriptions labelStyle/contentStyle`→`styles`, redundant `Select showArrow`, and the deprecated
  `List` replaced by a plain bordered list with the same row markup). Console is clean across all 32 chapters.

**Verification.** Playwright/Chromium against the dev server and a production build served under
`/Jayshankar-ui-antd/`: 192 layout checks (32 chapters × first and last step × phone/tablet/desktop — stage inside the
viewport, no horizontal overflow, title readable, steps present) and 15 interaction checks (tap-to-enlarge, Actual-size
panning with a real `scrollLeft`, swipe/Next in the lightbox, Esc, drawer navigation, search, no-match `Empty`, the
phone/desktop filter, the tour, dark mode, keyboard). The app and deck-1 bundles contain no `antd` (grep of the built
assets). `npm run validate` and `selftest` pass. Bundle: 397 KB gzipped JS (was 392 KB).

**What this costs the comparison — said plainly.** The two decks now differ in **navigation and interaction**, not
only in styling. That is deliberate (it is what "feel" means), but a reviewer must not read every difference as being
about Ant versus Tailwind: a sidebar and a lightbox could be built in Tailwind too. If the client wants a like-for-like
look, deck 1 would need the same treatment — that is a separate decision and is not done.

**Not done.** Deck 1 was not touched or re-tested beyond a successful build. The screens' own content (blocks) was
re-drawn only to remove deprecated APIs, not redesigned: the "rethink" is the shell. Publishing is the owner's step.

### Decision 97 — Deck 2's screens redrawn as Ant Design products; the old block renderer deleted

**What changed.** Decision 96 re-did deck 2's *shell* and said plainly that the screens inside the device frames were
only de-deprecated. The owner saw the same gap one level down ("i dont see that u didnt work on the actual app and
desktop mocks"): a phone screen was still deck 1's block list with Ant widgets dropped in. The 24 block kinds are now
drawn by two **composition layers** under `src/components/storybook-ant/mock/`, which read the same flat block data
and decide how an Ant product would lay it out:
- `phone.tsx` — `PhoneScreen`: a 340×600 frame with status bar, `NavBar` (back circle, title, date chip or link),
  scrolling body, **docked action bar** (a trailing `buttons` block is lifted out of the scroll), and a `TabBar` with
  an active indicator. Consecutive `select`/`field` blocks become one grouped `Form` card (two short plain fields
  pair up); `fields` become a cell list; `stats` a card row (2×2 beyond three); `tiles` service cells or an icon
  grid; `alert` a compact tinted status card; `chain` a vertical `Steps`; `table` a compact table.
- `desktop.tsx` — `DesktopScreen`: a 1180×720 Ant Pro frame (`Sider` + dark `Menu` with grouped navigation, header
  with `Breadcrumb`, search, `Badge` bell, `Avatar`, page header with date chip or primary action, page `Tabs`,
  docked footer). `planDesktop()` hoists `statCards` into a KPI row, binds the first `tabs` block to the table (tab
  counts are *derived from the table's Status column*, not invented), turns a select/field cluster into a filter bar
  or form panel, and packs blocks into 24-column rows by a per-kind span preference.
- `charts.tsx` — hand-drawn SVG line, bar and donut charts with axes, gridlines and value labels, measured to their
  container (`useBoxWidth`). **No chart library**: SPEC §4.4 has no row for one, and adding a runtime dependency
  needs an amendment. `QrSvg` is the deck-1 generator, copied unchanged, so a container code still draws the same
  pattern in both decks (D74).
- `ScrollArea.tsx` — where a screen is taller than its frame, a bottom fade and a "More" pill say so. Content is
  never silently clipped.
- `tone.ts` — tone/status → Ant colour and `Tag` preset mapping, en-IN number formatting, nice axis ticks.

**Deleted.** `AntBlocks`, `AntSurface`, `AntPhoneFrame`, `AntDesktopFrame`, `blocks-core`, `blocks-lists`, `blocks-viz`
— an import-graph check showed nothing reached them once `AntScreen` called the new layers. `ant-shared.tsx` keeps
only `antIcon`/`antColor`. The *surface seam* in `src/lib/storybook/surface.ts` is still how **deck 1** is assembled;
deck 2 does not use it. (HANDOVER W8 and `docs/ARCHITECTURE.md` were corrected to say so.)

**Design choices worth knowing.**
- **Composition over a per-block switch.** Ant products are made of grouped forms, docked actions, KPI rows and
  filter-bars-above-tables; none of that exists in flat block data, so the layers *infer* it. The chapter data is
  untouched — deck 1 is unaffected and both decks still show identical content, figures and steps.
- **The frames stay light in dark mode** (own `ConfigProvider`, `inherit:false`), as in decision 96.
- **Tailwind preflight is off for this deck** (`tailwind.storybook-ant.config.ts`), so Tailwind's resets cannot fight
  Ant's own.
- **Animation is restrained** (`.sba-rise/.sba-draw/.sba-grow`), all under `prefers-reduced-motion`.
- **A generated service worker precaches `storybook-ant.html`**, which the entry rename turns into `index.html`;
  `build:storybook-ant` output served from a static host would 404 that precache URL. `scripts/rename-storybook-ant-entry.mjs`
  now repoints it to `index.html` (and fails loudly if the PWA plugin's output ever changes shape). **Deck 1's rename
  script has the same latent defect** (`storybook.html` is precached) and was not touched.

**Verification.** Playwright/Chromium, dev server and a production build served under `/Jayshankar-ui-antd/`: 192
layout checks and 15 interaction checks pass, console is clean across all 32 chapters (no deprecated-API warnings),
and ~100 screens were viewed as contact sheets (phone and desktop) and corrected until nothing was misaligned, repeated
or truncated. A clip measurement shows 16 of 108 screens still taller than their frame (down from 22); each carries the
"More" pill. `tsc --noEmit`, `npm run validate` (73 pass), `npm run selftest` pass; the built app and deck-1 bundles
contain no `antd`. Bundle: 1.34 MB JS, 414 KB gzipped.

**Not done.**
- Deck 1 was not given the same treatment, so the two decks differ in shell, interaction *and* composition. Any gap
  the client sees is a gap between a designed Ant product and a generated Tailwind one — weigh D67 accordingly.
- Phone screens are inferred layouts, not hand-tuned per screen; a few dense ones (e.g. quality-issue step 1) still
  scroll.
- Publishing is the owner's step (no GitHub credentials in this environment).

### Decision 98 — Kit-growth candidates drafted: role-routed records, and an audit of the kit's execution modes

**What changed.** The owner asked whether an expensive model should be writing documentation, whether multiple models
and harnesses can share one repository's context, and what the kit already covers. Answer, after reading the kit's
`EXECUTION-MODE-INTERVIEW.md`, `tiered-escalation.md`, `manual-relay-worker-loop.md`, `ORCHESTRATION.json`,
`orchestrate.mjs` and `docs-guardian`: the kit has five modes organised by **who orchestrates**, and no axis for
**which model produces which artefact** or for how harnesses share records. Four drafts, in the kit's pattern format
(§0–§3 + footer), are in `docs/kit-growth/` for the owner to export to `tins-kit/kit-staging/inbox/`:
`role-routed-records.md`, `kit-modes-audit-and-redesign.md` and (added the same day, from the owner's own idea)
`session-ledger-worktree-reconcile.md` — per-session ledger entries whose facts are derived from git, one worktree per
agent, and a reconciler that is handed indexed conflict briefs and checked for completeness rather than trusted to read
everything — and a fourth, `pattern-lifecycle-reuse-loop.md`: pattern applicability metadata (including `not_when`),
retrieval at spec / task / decision time, recorded dispositions (applied / adapted / rejected-with-reason), feedback to
the pattern, rot detection and a reinvention-rate metric, so a new project *fits* past learnings instead of re-deriving
them. Nothing in the live `tins-kit/` was edited (AGENTS.md §6); a working copy for edits is `_external/tins-kit-next/`.

**The finding worth keeping.** Documentation cost in this project was reading (re-reading a 4,500-line log and three
numbering systems every session), then verifying/repairing drift, and only last writing. Routing the *writing* to a
cheaper model saves the smallest slice and risks the *why* of a record. The cheap levers are per-record files, a
generated index, a context-pack script and validators that check records without a model.

**Kit-growth candidates (`AGENTS.md` §6):** (a) typed, one-file-per-record memory with a schema and a wider gate than
`docs-guardian`'s keyword check; (b) role→model routing as a second tier axis beside T0–T2, with an adapter interface
so the five modes become presets; (c) `orchestrate.mjs` accepting a per-task prompt file (this project stayed
hand-relayed with a scriptable Cline CLI because it could not); (d) ledger columns for model and cost; (e) `tins-kit/`
and `delegation/` being gitignored, so a second machine or harness lacks the kit prompts and the ledger.; (f) a per-session ledger with git-derived
facts, a `scripts/ledger.mjs open|close` pair and a branch-needs-an-entry validator check.

**Corrected here.** `delegation/README.md` said the kit has "six execution modes"; the kit's own prompt says five
(`solo`, `auditor-local`, `auditor-remote`, `self-parallel`, `external`). `delegation/` is gitignored, so the fix is
local only.

**Not done — said plainly.** Nothing is piloted. The drafts assert a design from one consumer's experience;
`role-routed-records.md` §3 names the measurement that would confirm or kill it. The outside tools named there
(Aider architect/editor, Cline Plan/Act models, the `AGENTS.md` convention) were checked by search, not run, and their
flags and support change often.

**Round 1B / round 2 outcome (same day).** The kit copy `_external/tins-kit-next/` was updated by seven work packages from the round-1
findings (dispatch rendering a real `PACKET.md`; `session.mjs`; `scan-secrets.mjs`; shared pattern-front-matter parser +
front matter on all 24 patterns + `kit-coverage` v2 + `kit-ingest` fix; proposals lane + `KIT-VERSION` + sync tombstones;
`CORE.md`; `NEXT-VALIDATION.md`) — selftest 185/185 from any directory, `validate --kit` PASS. Round 2 then had three builders
use only the kit to build a focus-queue ticketing assistant, an expense tracker and a mistake-first course pilot
(`docs/kit-growth/rounds/ROUND2-FINDINGS.md`). They independently found defects the round-1 reviewers had not — above all
that **`validate --spec SPEC.md` failed 35 checks on every fresh scaffold** — which were fixed with regression tests.
**Not done, and the most important unrun test:** the parallel-worktree + reconciler path was never exercised (round 2 was
single-writer), and nothing has run in a non-Claude harness. The live `tins-kit/` is untouched; promotion is the owner's call.

**Round 1 outcome — the premise corrected.** Six read-only reviewers (retrieval, ledger/worktrees, harness
portability, kit consistency, red team, economics) challenged the drafts; their reports are
`docs/kit-growth/rounds/round1-*.md`. Two corrections to what this entry and the drafts first claimed: (1) **"documentation
cost is re-reading the 4,500-line log" was wrong** — in the one session measured the log was never read in full (0 `Read`
calls, 56 targeted greps); cost is turns × carried context, reading was ~30% and documentation writing ~6%, and routing
writing to a cheaper model is worth ~2%; (2) **the "#67–#89 numbering hole" was wrong** — the numbering is contiguous
#1–#98 (decision #90 is a retroactive entry). A reviewer's own error is also on record: a parallel reviewer overwrote
`.git/config` line 3 (`filemode = core.autocrlf`) and every git command in the project failed until it was restored to
`filemode = false` — the proposal's own thesis about concurrent agents sharing one `.git`, in miniature.

### Decision 99 — Deck 3, "The Run": a storybook whose unit is a moment seen through several roles

**What was asked.** A third frontend mock-up, "using your creativity… not restricted to the project or tins methodology",
as a new storybook that includes the new functionality from `SPEC-AMENDMENT-v3-truckload.md` and
`SPEC-AMENDMENT-v4-plan-md.md`, and to see *how* those would be created in the storybook format.

**The design decision that matters.** Decks 1 and 2 already vary the *paint*; a third re-skin would add nothing. What v3/v4
add is mostly about **who sees what** (blind receiving, a refused rep, a reviewer who cannot approve their own bill, an
offline queue, closed-by-default functions) — which a one-phone-per-step format cannot express. So deck 3 changes the
*format*: act → moment on a day's clock → lens (role, online/offline, switch on/off) → several devices drawn at once, with
a panel showing what the database function returned (absent keys struck through) and a spec margin giving each moment's
decision, acceptance criteria and honest build status. One truck load (invented vendors, one fixture) runs from planning to
payment; all 14 decisions D63–D76 are pinned to moments or, for D76, explicitly marked "not a screen".

**Choices worth knowing.**
- **Its own data and code, no dependency.** `src/lib/storybook-run/` has its own types; the deck imports nothing from decks
  1–2, uses no Tailwind and no Ant Design, and adds no package (so no SPEC §4.4 row is needed — checked). Plain CSS with a
  dawn/night shell and device interiors that always draw the light "paper" palette (the lesson of deck 2: the screen is the
  product being judged). Hand-drawn SVG icons.
- **Where v3 and Phase B disagree, it draws both** (Act 4: "Receiving seat — v3 role" vs "Flagged buyer — Phase B"; Act 7:
  five roles plus the exception vs five roles and a flag) instead of picking one. That is the owner's call (HANDOVER W12).
- **Status is taken from the amendments, not from the author's optimism**: each decision carries Not built / Built
  differently in Phase B / Matches Phase B / Open, copied from v3's 2026-10-02 status check and v4 §5–§6.
- **No service worker** (deck 2's generated worker precached a file the rename step removed). Built with a relative base
  (`VITE_BASE=./`) and verified from a deeply nested path.
- **"Blind" is made true in the data, not only on the screen.** A first draft drew black bars over vendor names that were
  still in the screen's data — a drawing of a guarantee, which is exactly what D65/D68 say is not enough. The blind views now
  contain no vendor or price (and the hidden landed-cost figure is masked), and `deck.test.ts` fails if that regresses; the
  test was confirmed to fail when the leak was put back.

**Defects found by testing, not by looking** (all fixed): the "Start at dawn" button's text was invisible (a reset rule
beating the button's colour on specificity); a lock icon rendered enormous because a rule sized *every* svg inside the
landed-cost block; on a phone a multi-device moment showed only the first device with no way to reach the others (the
device tabs were rendered but their CSS selector required a parent they were not inside); duplicate React keys once the
blind data was emptied; Vite on `/mnt/c` served stale files after edits (restart the dev server — already a recorded gotcha).

**Verification.** `tsc`, `npm run validate` (73), `npm run selftest`, 15 vitest invariants, a 138-combination layout sweep and
20 interaction checks on both the dev server and the production build. Bundle 243 KB / 77 KB gzipped.

**Not done.** Not published (no credentials here). Not shown to the client. Deck 1 and 2 were not changed. The deck draws
unbuilt behaviour (D63, D66, D69, D70) on purpose and labels it; the conflict-resolution screen is a proposal, not spec.

### Decision 100 — Make the third deck comparable and lighter: shared data, persona walks in all three decks, one address format

**The owner's review of deck 3** (decision 99), in their words: no point of comparison with the other two; too
information-heavy for a client who may not read it ("a good decision" in format, though); the idea should be **present in
the other decks too** — a simulation where you *are* the admin (desktop and phone), the person who went to buy (mobile only),
the one checking the load at the warehouse and recording the discrepancy, the grader, the person told to package an amount
and deliver it to a location, "and so on for all foreseeable features and scenarios and end-to-end workflows", from the client
QA and the existing app; and **all three interlinked**, with a repo name like the others.

**What it meant.** A third look only helps D67 if it draws *the same content* as the first two; deck 3 had its own content, so
there was nothing to compare. And "the Run in the other decks" is not the Run's UI (moments, lenses, database panel) but its
*idea*: walk it as a person. So the fix was a shared data layer, not a port.

**What was built.**
- **Twelve persona walks** (`src/lib/storybook/journeys/`), as ordinary chapters in a new first group `journeys`. Built from the
  existing 104 screens (never contradicting them) plus ~30 new screens for what the deck lacked: the v3/v4 features (trip task,
  load start, manifest, offline queue and its replay, blind receiving at the scale, truck-load board with landed cost,
  approvals on phone and desk, access, mode settings), things the app already does but the deck never drew (repack, search,
  warehouse transfer, floor home, learn), a credit-limit warning and a WhatsApp bill share, and — **marked "Proposed" on the
  screen** — delivery tracking and proof of delivery, which the app does not have. Personas are jobs mapped to the five roles
  (D72: no sixth role); one is on the desktop, eleven phone-only, per the request.
- Because they are chapters, **decks 1 and 2 needed almost no code** to play them (their players, lightboxes and deep links are
  unchanged); `CHAPTERS` became `BASE_CHAPTERS` + journeys (`chapters/base.ts` breaks the import cycle).
- **The Run draws all 44 chapters** via `src/lib/storybook-run/from-chapters.ts`, with seven new block kinds (tiles, result, bars,
  line, donut, QR, photos). It shares *data*, never renderer code — decision 99's "imports nothing from the other decks" is
  corrected to that.
- **One address format** across the decks — `#/review?c=<id>&s=<step>[&embed=1]` — and a shared `decks.ts`. Each deck has a
  "same screen in…" control; each understands `embed=1`; The Run adds `#/compare`, which drives all three decks at one screen
  in frames. No code is shared across the decks to do this, so none can break another.
- **Lighter Run:** it opens on people, then "which look?"; the v3/v4 day, the decisions atlas and all 32 chapters are folded;
  **Simple view is the default** and hides decisions, criteria, build status and the database panel (one tap away); a
  **Reviewer view** toggle restores them.
- Repo name for the new deck: **`Jayshankar-ui-run`**.

**Judgement calls worth knowing.**
- The shared journeys use the **existing 24 block kinds only**, expressing new ideas in them (a queue is a `rows` list with
  statuses; a gate is an `alert`), so all three decks draw structurally identical content. The Run's richer v3/v4 blocks stay
  in its own day acts. The cost is that the shared walks are plainer than the Run's native acts.
- **Blind stays true in the data**: the receiving walk contains no vendor, no rate and no rupee amount (tested), and locked
  fields convert to redaction with no value carried over. An earlier draft of the walk reused a screen listing the vendors for
  the one persona who must never see them; a test now forbids that.
- **Compare uses iframes of the published decks** rather than bundling all three renderers into one page, which would have
  put antd into the Run's bundle. Hence it only works once all three are live; local copies can be passed in the URL.
- Fixed in passing: deck 1's generated service worker precached an entry file its rename step had removed (deck 2's script
  already had the fix); `vitest.config.ts` added so the suite excludes `_external/` experiments.

**Defects found by testing, not looking:** walks labelled "ACT 36"; twelve identical person cards; stacked compare panes too short
to show the Ant frame; the Tailwind pane's leftover progress rule in embed mode; two key presses in one instant skipping a step
(a test artefact); a case-sensitive repo-name match (a test artefact).

**Not done.** Not published (no credentials here), so the live Compare is untested. Not viewed on a real phone or in
Firefox/Safari. The proposed delivery screens are a design suggestion, not spec. No new SPEC row (no dependency was added).


### Decision 101 — The client review page gets answer boxes saved to MongoDB Atlas, and an Excel record

**What.** `client-qa/session5/review-app/` is a small separate deployable (Vercel or Render) that serves the click-through
walkthrough (`prototype/`) and adds: an answer box under every question, a name field, a "the developer is typing this for the
client" switch, autosave to MongoDB Atlas through `/api/*`, and an Excel workbook (`/api/export`, `npm run export`) with the
sheets Answers, By question, Comments and Summary, plus a JSON backup. The "Ask on this screen" heading became "Questions on this
screen" and the developer's Q-numbers are no longer shown to the client (they stay in the `Ref` column of the Excel file).

**Why.** The owner and Jayshankar should be able to answer themselves, or have the developer type for them, and the answers
must survive as a record the developer can hand on. A static page cannot hold a database password, so the browser talks to a
tiny server and the password never leaves it.

**Judgement calls.**
- **Not part of the app.** Its own `package.json` (`mongodb`, `exceljs`); nothing in `src/` imports it, so SPEC §4.4 (the app's
  runtime dependencies) is unchanged and no migration is needed. Supabase stays the app's database.
- **Credentials** live in `atlas-credentials.env` (gitignored by name in the root `.gitignore`; the remote repo is public) or in
  the host's environment variables. The code never prints them and redacts them from errors.
- **Open writes, closed export.** Anyone with the link can answer under a name; writes are limited to the known question ids and
  capped in size. `REVIEW_ACCESS_CODE` (optional) puts a code in front of reading and writing; `ADMIN_KEY` (required) is the only
  way to download everything. There is no per-person login, so a name is a label, not an identity.
- **Every save keeps the last 20 revisions** of that answer, so a changed mind is not a lost record.
- Tested with an in-memory stand-in for MongoDB (`npm test`, `node scripts/e2e.mjs`); the real cluster is checked by
  `npm run check-db`, which needs the credentials file.

**Not done.** The live connection has not been exercised yet (the credentials file was not at the path searched); nothing is
deployed. No rate limiting beyond the size caps. **Kit-growth candidate:** none.
