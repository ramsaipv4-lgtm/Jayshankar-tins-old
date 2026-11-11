# TRAININGS.md — debugging-wisdom handbook

> **A symptom-driven lookup table for "I've seen this error before"** — the
> cousin of `BUILDER-DECISIONS-REVIEW.md` (which is decision-driven). When you
> hit a confusing error, grep this file. When you fix a confusing error,
> add an entry here.
>
> **Source:** tins-kit's atal-incubation reference project shipped a
> `TRAININGS.md` (with the 3-doc handover system: HANDOVER + AGENTS +
> TRAININGS). The pattern proved valuable; the kit adopts it as a
> recommended template for any non-trivial consumer.

---

## What this file is for

A **training** is a symptom → cause → fix → prevention lookup. The format
is deliberately short (5 lines per entry) so you can scan it under pressure
when a build is broken.

**Examples that belong here:**
- "23502 null value in column 'X' — your trigger doesn't set every NOT NULL field"
- "permission denied for table X with the secret key — service_role needs GRANTs"
- "fetch is not defined — Node < 18, upgrade"
- "duplicate key value violates unique constraint on re-seed — your seed isn't idempotent"

**Examples that DON'T belong here:**
- "How to use Vite" — that's a Vite tutorial, not training
- "Why we chose X over Y" — that's a decision, in BUILDER-DECISIONS-REVIEW.md
- "How to deploy" — that's in the deployment doc

---

## When to write an entry

- When you fix a bug whose root cause was non-obvious and you spent >15 min
  figuring it out. Don't write entries for trivial bugs.
- When a teammate hits the same wall and you have to explain it twice.
  Write the entry the third time.
- When a kit pattern's worked example surfaces a gotcha (e.g. the 3 W1.5
  Supabase lessons all became TRAININGS entries in Jayshankar).

If you wrote a BUILDER-DECISIONS-REVIEW entry AND the fix has a memorable
symptom, add a TRAININGS entry too. They serve different lookups
(decision-driven vs symptom-driven).

---

## Format

```markdown
### Training N — short title (the symptom or error message)

**Symptom.** The error message verbatim, or the observable behaviour. Include
the SQLSTATE / HTTP code if any.

**Root cause.** The 1-2 line explanation. What is actually wrong, not what
Google thinks is wrong.

**Fix.** The 1-2 line fix. File name + what to change. Link to the
BUILDER-DECISIONS-REVIEW decision if there is one.

**How to avoid.** The 1-2 line prevention. Usually a validator check ID
(e.g. "the `js-handle-new-user-meta` check now catches this").
```

Each training is a level-3 heading. Numbered. Append-only.

---

## Worked examples (from Jayshankar W1.5)

```markdown
### Training 1 — `23502: null value in column "display_name"`

**Symptom.** Seed-auth-users.mjs fails with:
```
{"code":"23502","message":"null value in column \"display_name\" of relation
\"users\" violates not-null constraint"}
```

**Root cause.** The `handle_new_user()` trigger only inserts `(id, email,
role, created_at)` — it never sets `display_name`, which is NOT NULL on
`public.users`. The trigger's INSERT fails, which rolls back the
`auth.users` INSERT. Net: 0 users in auth.users, 0 in public.users.

**Fix.** Migration 0002 — the trigger now reads `role` + `display_name`
from `NEW.raw_user_meta_data` with safe fallbacks. See
BUILDER-DECISIONS-REVIEW.md decision 10.

**How to avoid.** Validator check `js-handle-new-user-meta` greps the
migration for `raw_user_meta_data` inside `handle_new_user()`. A future
contributor who simplifies the trigger fails the gate.
```

```markdown
### Training 2 — `42501: permission denied for table X` with the secret key

**Symptom.** Server-side script (e.g. seed-auth-users.mjs) gets:
```
{"code":"42501","hint":"Grant the required privileges to the current role
with: GRANT SELECT, UPDATE ON public.users TO service_role;","message":
"permission denied for table users"}
```

**Root cause.** `service_role` has BYPASSRLS (bypasses RLS policies) but
does NOT have table-level GRANTs on `public` by default. The seed.sql
works because it runs as `postgres` (schema owner); the script runs as
`service_role` (different role). BYPASSRLS and GRANT are separate
privilege layers.

**Fix.** Migration 0003 — GRANT ALL on all tables/sequences/functions in
`public` to `service_role`, plus ALTER DEFAULT PRIVILEGES for future
tables. See BUILDER-DECISIONS-REVIEW.md decision 11.

**How to avoid.** Validator check `js-grant-service-role` greps the
migration for any GRANT to `service_role`. A future contributor who
adds a table but forgets to GRANT fails the gate.
```

```markdown
### Training 3 — `23503: insert or update on table "users" violates foreign key constraint "users_id_fkey"`

**Symptom.** seed.sql fails with:
```
{"code":"23503","message":"insert or update on table \"users\" violates
foreign key constraint \"users_id_fkey\""}
```

**Root cause.** The `public.users.id` column had `references auth.users(id)
on delete cascade`. The seed inserts `public.users` rows with fixed UUIDs
(0001, 0002, 0003) but the matching `auth.users` rows don't exist yet
(Supabase Auth creates them later, with different UUIDs). FK violation.

**Fix.** Migration 0001 — drop the FK; integrity is enforced by the
`handle_new_user()` and `handle_user_delete()` triggers. See
BUILDER-DECISIONS-REVIEW.md decision 8.

**How to avoid.** Validator check `js-noauthfk` greps the users table
definition for `references auth.users` and fails if found. A future
contributor who re-adds the FK fails the gate.
```

---

## How this file gets used

1. **You're stuck on a build error:** grep this file for the SQLSTATE /
   error code / symptom. The fix is usually a 2-line lookup.
2. **You fixed a non-obvious bug:** add an entry. The next person to hit
   it will save 15 min.
3. **The reviewer session:** the reviewer cross-references this file to
   find recurring patterns (e.g. "we hit 3 auth-related SQLSTATEs in W1.5
   — build a kit pattern for Supabase auth setup" → became
   `lib/patterns/supabase-auth-trigger.md`).
4. **Mode boundary:** this file is one of the inputs to the next mode's
   planning. If TRAININGS has 5 entries on the same surface area, that
   surface is a refactor candidate.

---

## Cross-references

- `tins-kit/HANDOVER.md` §7 — the handover protocol
- `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md` — decision-driven (this file is symptom-driven)
- `tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md` — meta-review (end-of-mode)
- `tins-kit/lib/patterns/supabase-auth-trigger.md` — the W1.5 lessons, abstracted
- A worked-example with 3 entries: `Jayshankar/TRAININGS.md` (planned; written when the Jayshankar consumer adopts the kit's templates in W7)

---

*Template version 1. Last updated 2026-08-06. Format adapted from atal-incubation's
TRAININGS.md. The 3 worked examples above are paraphrased from Jayshankar W1.5
— the same lessons, twice: once as build-time decisions, once as symptom-driven
trainings. Different lookups, same wisdom.*
