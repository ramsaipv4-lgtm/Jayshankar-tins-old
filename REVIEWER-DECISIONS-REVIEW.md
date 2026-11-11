# REVIEWER-DECISIONS-REVIEW.md — end-of-mode meta-review

> **The reviewer's findings on a finished mode (Demo, Pilot, Production).** Written at mode
> boundaries, not after every W item. The reviewer's most valuable findings are at the meta-level
> ("should this exist?", "what's the cheapest version?", "what did the builder miss because they were
> too deep in the build?").
>
> **Why this file exists at all:** it did not, until now, despite being referenced in four places
> (`AGENTS.md` §0a and §1, `HANDOVER.md` §5's Mode A review note and §7 step 4). Those pointers were
> correct about the file's role and wrong about its existence — a distinction the next session pays
> for, so Finding 6 below records it.
>
> **Created** 2026-09-29, from `tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md`. Format is the
> template's: one `## Mode` heading, then numbered findings with What was checked / What's good /
> What's missing / Severity / Suggested next action / Builder response.

---

## Mode: Demo (Mode A) — review date 2026-09-29

**What was reviewed, in one paragraph.** This review was prompted by a reconciliation task rather
than a scheduled mode boundary, and it spread to the whole of Mode A: `SPEC.md` §0.2 against
`docs/DECISIONS.md`, the docs against the *live database* (read-only probes with the existing
service key), `scripts/validate.mjs` against the last 36 migrations, the Phase B workstream inside
`client-qa/session3/backend-phase-b.zip`, and the two review decks. Everything asserted below was
checked against a file, a command's output, or the database — not inferred from a document's own
claim about itself.

### Finding 1 — The documentation disagreed with the database, and the database was right

**What was checked.** `HANDOVER.md` §1 and §2 against a live read-only probe of the Supabase project
(`scripts/probe-db.mjs`, plus per-table REST probes).

**What's good.** The database is healthy and further along than the docs claimed: 14 core tables,
36 migrations applied, 130 SKUs, 12 vendors, 198 movements, 42 sales, 150 price-history rows. The
schema, RLS and triggers are real and in use.

**What's missing / what's wrong.** `HANDOVER.md` §1 read *"Nothing is built yet. The spec defines
Mode A (Demo) as the first deliverable"* and *"17 locked decisions in SPEC §0.2"*; §2 read
*"Supabase project NOT YET CREATED — W1 task"*. All three were false. A next session reading the
handover file first — exactly as `AGENTS.md` instructs — would have concluded the project was
unstarted and begun re-deriving a system that already runs.

**Severity.** 🔴 **CRITICAL** — the file every session is told to read first was wrong about the most
basic fact in the project.

**Suggested next action.** Correct §1 and §2 in the same commit as the next change; treat
"HANDOVER's state snapshot matches a live probe" as part of the handover protocol, not an optional
nicety.

**Builder response.** Fixed in this session: §1 now says Mode A is built and names what came after
it, §2's four stale rows are corrected against the probe, and the queue gained W7–W9. The verdict on
the underlying cause is in Finding 7 — the corrections were possible only because a *human* asked
the right question, which is not a mechanism.

### Finding 2 — The repo's decision memory was truncated, and the full copy existed only inside a zip

**What was checked.** `docs/DECISIONS.md` (504 lines, entries 1–17 plus two entries written on
29 Sep) against the copy inside `client-qa/session3/backend-phase-b.zip` (834 lines, entries 1–40).

**What's good.** The 1–17 entries in this checkout are *better* than the zip's: they carry the role
union type, the `0003_grant_service_role.sql` filename, and validator behaviour that the zip's copies
had genericised away (it even loses `BUILDER-DECISIONS-REVIEW.md` for "the internal decision log").

**What's missing / what's wrong.** Between them, 23 decisions (18–40) existed **only inside a zip
that was not committed to git**, and the two newest entries had been numbered #18/#19 — numbers the
canonical log had already assigned to "Mobile is primary" and "Containers replace abstract batches".
Any future merge would have produced a duplicate-numbered log. The zip's own index table stopped at
33 while the file held 40 entries, so the index could not be used to detect the gap either.

**Severity.** 🔴 **CRITICAL** — this is the project's institutional memory, and it was one deleted
download away from being unrecoverable.

**Suggested next action.** Merge, never copy; commit the zip itself; rebuild the index from the
entries.

**Builder response.** Done this session. `docs/DECISIONS.md` is now 42 entries — 1–17 ours, 18–40 from
the zip (verified byte-identical), 9/13/15 adopted from the zip because it alone carried their
supersede annotations, and the 29-Sep pair renumbered 41/42. Index rebuilt 1–42. The zip is now
committed (`fda6db2`). The merge rule is written into `SPEC-AMENDMENT-v4-plan-md.md` §5.2 so the next
reader can see *why* the copy that looked newer was not adopted wholesale.

### Finding 3 — A live security hole is written, tested, and sitting unapplied

**What was checked.** `docs/BACKEND-PHASE-B-STATUS.md` §3 (findings) and §7 (applying), the migration
`supabase/migrations/0046_lock_down_function_access.sql`, and a read-only probe of the live project.

**What's good.** The fix is done and tested. `0046` revokes `EXECUTE` on all public functions from
`PUBLIC` and `anon`, alters default privileges so new functions get nothing, and revokes the internal
helpers from `authenticated`; `supabase/tests/90_security.sql` fails if any public function becomes
executable by `anon`. The workstream also ships 14 new tables, ~40 functions and a 10-file SQL test
suite that passed on PostgreSQL 16.

**What's missing / what's wrong.** It is **not applied**, and neither was the ability to apply it.
PostgreSQL grants `EXECUTE` on new functions to `PUBLIC`, and migration `0004` added default
privileges for `authenticated` — so on the **live** project today, `SECURITY DEFINER` helpers that
rewrite stock (`container_sourced_cascade`, `direct_batch_cascade`) are reachable by anyone holding
the publishable key. The workstream's own test reproduced a 100 kg batch dropping to 70 kg through an
anonymous call. My probe confirms the live project is still at `0036`: `app_settings`, `truck_loads`
and `grading_rules` all return 404.

**Severity.** 🔴 **CRITICAL** — an exploitable hole in the live system, with the fix sitting in a zip.

**Suggested next action.** Apply `0046` first and alone (it is the security fix and stands
independently), then `0037`–`0045`, then `rls-policies.sql`. Back up first. This needs the project's
database password, which is **not** in either `.env` — see Finding 7.

**Builder response.** Partially actioned: the migrations, the test suite and the updated
`rls-policies.sql` are now **in the repo** (they existed only inside the zip), and the gate still
passes with them present. **They are not applied** — that needs a credential this environment does not
have, and a production database write that is the owner's call. Tracked as W7's open item.

### Finding 4 — The Demo seed no longer matches the decision that specifies it

**What was checked.** SPEC §0.2 **D14** ("Demo data is real-schema, fake-content… 6 fishermen
vendors, 25 fish SKUs, 3 locations, 150+ movements over 14 days, 20+ sales, 30 days of price
history") against the live row counts.

**What's good.** The principle D14 asserts — real schema, fake content, seeded idempotently — is
honoured exactly. `supabase/seed.sql` exists and the figures are plausible wholesale data.

**What's missing / what's wrong.** The live database holds **12 vendors, 130 SKUs, 13 locations, 198
movements, 42 sales, 150 price-history rows** — about 5× the SKU count and 4× the locations D14 names.
That is not a bug: the schema grew (containers, D19; multi-warehouse, D20) and the seed grew with it.
The problem is that D14 still states the old figures, so a reader cannot tell "the seed drifted" from
"D14 is stale", and the next session re-derives the answer.

**Severity.** 🟡 **SHOULD-FIX** — costs a session's worth of doubt every time someone reads D14.

**Suggested next action.** Amend D14's figures to the current seed, or delete the counts and point at
the seed script as the authority. Do it in the same pass as the next `SPEC.md` amendment rather than
as a standalone edit.

**Builder response.** Not actioned, deliberately: folding an unrelated D14 correction into
`SPEC-AMENDMENT-v4-plan-md.md` would make that amendment harder to sign off, not easier. Recorded
here so it is not lost.

### Finding 5 — The deck was built to settle a question the client cannot currently answer

**What was checked.** The plan's D67 (the design-language choice), the state of both review decks,
and the client's availability.

**What's good.** Both decks now exist against identical data: deck 1 in Tailwind (shipped), deck 2 in
Ant Design 6 (renderer complete — 24 of 24 block kinds; `tsc --noEmit` clean). They share the chapter
data and the entire player — page-turn, filmstrip, autoplay, keyboard, deep links, magnify — so the
design language is the only variable. Both build as standalone static sites with no login and no
secrets.

**What's missing / what's wrong.** D67 was written as a decision the client would make in a review
session. He is currently unavailable (schedule mismatch), so a *synchronous* review is the wrong shape
for it — and the closing as-built deck waits behind D67. A decision gated on a meeting that keeps
slipping is not gated on information; it is gated on attendance.

**Severity.** 🟡 **SHOULD-FIX** — the work is done; the delivery mechanism is not.

**Suggested next action.** Make the choice asynchronous: publish deck 2, send both links with one
question ("which one reads like the business?"), and let the answer arrive by WhatsApp. Answering by
looking at a link takes two minutes and needs no calendar slot.

**Builder response.** In progress this session: deck 2's build is wired
(`npm run build:storybook-ant` → `dist-storybook-ant/`) so it can be pushed and shared as a link.
D67 stays `OPEN` in `SPEC-AMENDMENT-v4-plan-md.md` §6, now recorded as *delayed pending client
availability* rather than as awaiting a session.

### Finding 6 — This file was referenced in four places and did not exist

**What was checked.** Every reference to `REVIEWER-DECISIONS-REVIEW.md` across the repo.

**What's good.** The *intent* is right and consistently expressed: `AGENTS.md` §0a routes the R3
Reviewer role here, `AGENTS.md` §1 lists it as required reading, `HANDOVER.md` §5 says a reviewer
session's findings go here, and `HANDOVER.md` §7 step 4 repeats it. The kit ships the format
(`tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md`), so nothing was ever designed badly.

**What's missing / what's wrong.** The file did not exist. Four independent pointers — including the
one in the *onboarding* file — all aimed at a missing page. A next session would reasonably have
concluded it had been deleted by accident, or that the mode had never been reviewed, when in fact
Mode A shipped and had simply never been reviewed at a boundary.

**Severity.** 🟡 **SHOULD-FIX** — cheap to fix, but it silently disables the role-separation the kit's
D10 asks for.

**Suggested next action.** Create it from the kit template and write the Mode A review that was owed.
Then keep the D10 rule: review at mode boundaries, not after every W item.

**Builder response.** Done — this file is that response.

### Finding 7 — There is no working way to apply a migration, which is why the Phase B fix has sat unused

**What was checked.** Every script in `scripts/`, both `.env` files (key names only), the kit's
`tins-kit/scripts/migration-runner.mjs`, `docs/SUPABASE-SETUP.md` §"Applying", and what tooling is
installed.

**What's good.** The workstream produced a genuinely strong apply story in prose:
`docs/BACKEND-PHASE-B-STATUS.md` §7 gives the exact order, the "stop at the first error" rule, the
back-up instruction, and the one migration that touches an existing business function (`0045`).

**What's missing / what's wrong.** Nothing executable backs it. The 20 scripts in `scripts/` reach
Supabase through PostgREST with the service key, which **cannot execute DDL** — there is no apply
script and none is possible with those credentials. The kit *does* ship a runner, but it needs
`DATABASE_URL` (a direct Postgres connection string) and the `pg` package, and neither is present:
`.env` holds only `VITE_SUPABASE_URL` + publishable key, `scripts/.env` holds the URL, publishable
key, secret key and JWKS URL — **no database password, no access token**. `psql`, `pg_dump` and the
Supabase CLI are all absent, and `pg` is not installed. The kit's runner also has a real defect: it
calls `require('node:crypto')` inside an ESM module, which throws immediately (`require is not
defined`) before it can apply anything.

So the honest statement is: Phase B could not have been applied in this environment by any script
that exists, which is why a tested security fix sat unapplied.

**Severity.** 🔴 **CRITICAL** — it is the reason Finding 3 persists, and it will block every future
schema change, not just Phase B.

**Suggested next action.** Two things, neither of them a guess: (1) the project needs a documented
apply path with the one missing value named (`DATABASE_URL`, from Supabase's Database → Connection
string, or a Personal Access Token for the Management API) — the owner supplies the value, the repo
supplies the command; and (2) the kit's runner defect should be reported upstream via
`tins-kit/prompts/KITTING.md`, since the kit is read-only for consumers.

**Builder response.** Partially actioned. The migrations are staged in the repo; the run order and the
missing credential are documented in `docs/BACKEND-PHASE-B-STATUS.md` §7 and
`docs/SUPABASE-SETUP.md`; the runner defect is recorded in `BUILDER-DECISIONS-REVIEW.md` as a
kit-growth candidate. **Applying them is outstanding and blocked on the password** — the owner has
approved the change, so the only missing input is the value.

### Finding 8 — The methodology was followed for the database and not for the front end (added 2026-10-02)

**What was checked.** `tins-kit/prompts/CONTINUE-TINS-PROJECT.md` Steps 0 and 6 (tooling gate, kit
validator, kit selftest, project gate), then every `AGENTS.md` §3 standing rule against the repo: DELETE
policies, money types, secret-key placement, hard-coded credentials, `package.json` against `SPEC.md`
§4.4, and `git log` for code commits that touch `src/` without a SPEC change.

**What's good.** The database side is disciplined: migrations are versioned, no `audit_log`
UPDATE/DELETE policy exists, money is `numeric`, no secret key is under `src/`, and the one DELETE policy
(`containers`) traces to a locked decision (D32) and a log entry (decision 44). `SPEC.md` passes the kit
validator; the project gate is 73/73 + 9/9.

**What's missing / what's wrong.** (1) `tooling-audit.mjs` was red — a free-text verdict cell. (2) Ten
npm packages had no §4.4 row. (3) `AGENTS.md` rule 5 and `SPEC.md` §3.8 contradicted D32. (4) State and
counts in `AGENTS.md` / `HANDOVER.md` were stale. (5) **The Phase A UI redesign has no SPEC section** —
the largest of these, because it changed what users see. (1)–(4) were fixed; (5) needs the owner
(`HANDOVER.md` W11).

**Severity.** 🟠 **HIGH** for (5) — a shipped UI with no spec means the next regeneration from `SPEC.md`
would silently discard it, which is exactly what TINS exists to prevent. 🟡 MEDIUM for (1)–(4), now closed.

**Suggested next action.** Take the Phase A visuals to the owner, lock them as D77 (or declare them out of
the spec, with the reason), and add a `validate.mjs` check that diffs `package.json` against §4.4 so the
dependency half of this cannot recur unnoticed.

**Builder response.** (1)–(4) actioned 2026-10-02 — see `BUILDER-DECISIONS-REVIEW.md` decision 93, which
also lists what was deliberately *not* changed. (5) open as W11.
