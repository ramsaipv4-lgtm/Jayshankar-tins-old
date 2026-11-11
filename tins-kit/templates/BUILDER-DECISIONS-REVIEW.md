# BUILDER-DECISIONS-REVIEW.md — build-time decisions log

> **The consumer's running log of every non-obvious build decision.** Append-only.
> Future sessions read this before they start work, so they don't re-litigate decisions
> or re-encounter the same wall.
>
> **Source:** tins-kit §0.2 (D2: the kit consumes its own methodology; D5: the handover
> protocol mandates writing decisions when amending the spec). Format derived from
> the Jayshankar W1.5 entries (decisions 8, 10, 11) which proved the pattern works.

---

## What this file is for

A **build decision** is any non-obvious choice the builder made that:
- Deviates from the obvious / naive / first-thing-Google-suggests path, OR
- Was forced by a real-world failure (a bug, a SQLSTATE, a misread of the docs), OR
- Will trip up a future contributor if it's not recorded.

**Examples that belong here:**
- "We dropped the FK on `public.users.id` because..." (forced by SQLSTATE 23503)
- "We use the new Supabase key naming (`publishable` / `secret`) because..."
- "We split the seed into 3 files because re-running a 1000-row INSERT in one go..."

**Examples that DON'T belong here:**
- "We chose Vite" — that's in `SPEC.md` §0.2 (locked decision)
- "We chose to use `const` instead of `let`" — too small
- "We wrote 50 lines of code" — not a decision

---

## When to write an entry

Write one when:
- You amended `SPEC.md` (any section, including §0.2)
- You hit a bug, surfaced the root cause, and fixed it (a "lessons learned" entry)
- You made a non-obvious implementation choice (e.g. "we use feature X over Y because Z")
- A reviewer session flagged a build decision the builder should record

If you're not sure, write it. Future-you will thank you.

---

## Format

```markdown
### Decision N — short title (one line, searchable)

**What changed.** One paragraph: what you did. Include the diff or the file
names, but keep it readable.

**Why.** One paragraph: the reason. Include the failure mode if it was forced
by one. Include the SQLSTATE / error code if relevant.

**Impact on downstream.** One paragraph: who else has to know, what changes
in the workflow, what the consumer's docs need to mention.

**Kit-level implication** (optional, if the lesson is general enough). One
paragraph: should this be a kit pattern / template / validator check? If
yes, name the file or check ID.
```

Each decision is a level-3 heading. Numbered. Append-only (don't renumber
existing entries when you add new ones — the numbers are stable references).

---

## Worked example (from Jayshankar W1.5 decision 8)

```markdown
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
```

---

## How this file gets used

1. **Next session, before work starts:** read this file. Don't re-litigate decisions
   1 through N.
2. **When you make a new decision:** append a new "Decision N+1" entry. Don't renumber.
3. **When you amend the spec:** write the decision in this file *at the same time* you
   edit the spec. Cross-link from the spec if the decision is consequential
   (e.g. "See BUILDER-DECISIONS-REVIEW.md decision 8 for the FK-drop rationale").
4. **When you hit a bug:** the root-cause analysis goes here, not in a Slack thread
   or a commit message. Commits are short; this file is the long-form record.
5. **When you wrap a mode (Demo → Pilot, Pilot → Production):** this file is the
   source material for the REVIEWER session. The reviewer reads it to see what the
   builder was thinking.

---

## Cross-references

- `tins-kit/HANDOVER.md` §7 — the handover protocol that mandates this file
- `tins-kit/SPEC.md` §0.2 — locked decisions go in the spec; build decisions go here
- `tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md` — meta-review (end-of-mode)
- `tins-kit/templates/TRAININGS.md` — debugging-wisdom handbook (symptom-driven)
- A worked-example of 11 real decisions: `Jayshankar/BUILDER-DECISIONS-REVIEW.md`

---

*Template version 1. Last updated 2026-08-06. Source: the W1.5 Jayshankar decisions
that proved the pattern works. See `tins-kit/lib/patterns/supabase-auth-trigger.md`
for the Supabase-specific pattern that decision 8, 10, 11 crystallised into.*
