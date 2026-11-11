# Existing-pattern update — `supabase-auth-trigger.md` Lesson 4

> **The diff to apply to `tins-kit/lib/patterns/supabase-auth-trigger.md`.**
> Four small edits; all string-replaceable. Apply them in order.

---

## Edit 1 — §1 header

**Find:**
```
## 1. The 3 lessons, in detail
```

**Replace with:**
```
## 1. The 4 lessons, in detail
```

---

## Edit 2 — add §1.4 (Lesson 4) after §1.3 (Lesson 3)

**Find (the last line of §1.3):**
```
This is the Jayshankar BUILDER-DECISIONS-REVIEW decision 11.

---
```

**Replace with:**
```
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
```

---

## Edit 3 — §2 intro

**Find:**
```
The recipe is 4 files, applied in order. Total: ~250 lines of SQL + ~180 lines of JS.
```

**Replace with:**
```
The recipe is 5 files, applied in order. Total: ~250 lines of SQL + ~180 lines of JS.
```

(Note: the file already lists 5 sub-files in §2.1–§2.5; this edit is
just to fix the intro paragraph to match.)

---

## Edit 4 — §3 header

**Find:**
```
## 3. The validator checks (pin the design)

Add these to your `scripts/validate.mjs` (kit's D7 — every validator ships a self-test).
Each check corresponds to one of the 3 lessons.
```

**Replace with:**
```
## 3. The validator checks (pin the design)

Add these to your `scripts/validate.mjs` (kit's D7 — every validator ships a self-test).
Each check corresponds to one of the 4 lessons.
```

---

## Edit 5 — add the `js-grant-authenticated` validator check

**Find (the end of the `js-grant-service-role` check, after its `else` block):**
```js
} else {
  fail('js-grant-service-role', 'service_role has BYPASSRLS but no table-level GRANTs — server-side scripts will fail with SQLSTATE 42501');
}
```

**Add immediately after:**
```js

// js-grant-authenticated — Lesson 4
// (separate migration; check the latest migration file too, not just 0001)
const grantAuthMigration = readLatestMigrationContent();
if (/grant\s+(usage\s+on\s+schema\s+public|select\s+on\s+all\s+tables\s+in\s+schema\s+public)\s+to\s+authenticated/i.test(grantAuthMigration)
    && /grant\s+(insert|update|delete)\s+on\s+public\.\w+\s+to\s+authenticated/i.test(grantAuthMigration)) {
  pass('js-grant-authenticated', 'authenticated has table-level GRANTs (browser code with a signed-in user can read public tables)');
} else {
  fail('js-grant-authenticated', 'authenticated has no table-level GRANTs — every Supabase JS query from the browser will fail with SQLSTATE 42501 before RLS is even evaluated');
}
```

---

## Verification checklist

After applying all 5 edits, verify:

- [ ] §1 has 4 lessons (the existing 3 + the new §1.4)
- [ ] §2 intro says "5 files" and the file lists §2.1–§2.5
- [ ] §3 has the new `js-grant-authenticated` check
- [ ] The pattern's "What you wrote" table in §0 already has 4 rows
      (it did before this update; verify it's still accurate)
- [ ] Total pattern length grew by ~50 lines (was ~470, now ~520)
- [ ] The pattern's voice (sentence-case headings, SQLSTATE-precise
      errors, cross-references) is consistent
