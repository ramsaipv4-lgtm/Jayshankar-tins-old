# Decisions

> Architecture Decision Records for Jayshankar. Each entry has a number, a date, a context, the choice made, and the consequences. Decisions are immutable once recorded — if a decision is reversed, a new decision is added that supersedes the old one.

## How to add a decision

1. Copy the template at the bottom of this file
2. Fill it in
3. Add it to the index below
4. Commit with a clear message: `docs(decision): N — <one-line summary>`


## Index

| # | Date | Title | Status |
|---|------|-------|--------|
| 1 | 2026-08-05 | Supabase as the backend | Accepted |
| 2 | 2026-08-05 | Versioned SQL migrations, no in-place edits | Accepted |
| 3 | 2026-08-05 | Roles-as-data (4 strings, controlled vocabulary) | Accepted |
| 4 | 2026-08-05 | RLS as the access boundary | Accepted |
| 5 | 2026-08-05 | Append-only audit log via Postgres trigger | Accepted |
| 6 | 2026-08-05 | PWA with graceful offline degradation | Accepted |
| 7 | 2026-08-05 | 3-mode deployment lifecycle (Demo → Pilot → Production) | Accepted |
| 8 | 2026-08-05 | Per-batch pricing, not per-SKU | Accepted |
| 9 | 2026-08-05 | Two locations, schema-aware | Accepted |
| 10 | 2026-08-05 | FIFO spoilage with multi-batch cascade | Accepted |
| 11 | 2026-08-05 | Tamil fish names as data (not code) | Accepted |
| 12 | 2026-08-05 | Sales as a movement + sibling sales table | Accepted |
| 13 | 2026-08-05 | iOS out of scope, Android Phase 3 (superseded) | Superseded |
| 14 | 2026-08-05 | Demo data is real-schema, fake-content | Accepted |
| 15 | 2026-08-05 | No POS, no GST, no CRM in V1 (superseded) | Superseded |
| 16 | 2026-08-05 | Validator is the gate, no --force | Accepted |
| 17 | 2026-08-05 | Authored data is separate from derived data | Accepted |
| 18 | 2026-08-14 | Mobile is primary, not a companion — Android via Capacitor | Accepted |
| 19 | 2026-08-14 | Containers replace abstract batches as the physical stock unit | Accepted |
| 20 | 2026-08-14 | Multi-warehouse schema, single warehouse in practice | Accepted |
| 21 | 2026-08-14 | GST support ships dormant, not deferred entirely | Accepted |
| 22 | 2026-08-14 | Incomplete data warns; it never blocks a mutation | Accepted |
| 23 | 2026-08-14 | Reverse-sale via new movement rows, never an UPDATE | Accepted |
| 24 | 2026-08-14 | One app, one login, role-gated views — not separate apps per role | Accepted |
| 25 | 2026-08-14 | No price value is ever pushed to a customer automatically | Accepted |
| 26 | 2026-09-10 | Container quantities are wholesaler-entered, custom sizes allowed | Accepted |
| 27 | 2026-09-10 | Per-customer credit terms, derived balance, soft enforcement only | Accepted |
| 28 | 2026-09-10 | Account creation requires a server-side Edge Function | Accepted |
| 29 | 2026-09-11 | Email invitation becomes a shareable link, not an auto-sent email | Accepted |
| 30 | 2026-09-11 | Phone accounts use password + link, not SMS one-time codes | Accepted |
| 31 | 2026-09-11 | Invite links resolve on the app's own route, not the auth provider's | Accepted |
| 32 | 2026-09-11 | Single-client, single-country phone handling; one-field sign-in | Accepted |
| 33 | 2026-09-11 | Both account identifiers must be set in one call, before any link is generated | Accepted |
| 34 | 2026-10-01 | "Receiving never sees the vendor or the rate" is enforced in the database, behind a switch | Accepted (switch ships off) |
| 35 | 2026-10-01 | The truck load is the unit receiving sees; a purchase is a hidden supplier lot | Accepted for the build; the allocation basis needs client confirmation |
| 36 | 2026-10-01 | Money stays at the promised amount; only stock follows the scale | Accepted (reaffirms the 0032 policy) |
| 37 | 2026-10-01 | The procurement desk is additive, with no sixth role yet | Proposed (pending the client's answer on whether the app owns procurement) |
| 38 | 2026-10-01 | The audit trail covers every money and stock table, and views are read-only | Accepted |
| 39 | 2026-10-01 | Database tests run against a local PostgreSQL, not the live project | Accepted |
| 40 | 2026-10-01 | Functions are closed by default; each one is opened on purpose | Accepted |
| 41 | 2026-09-29 | The workflow storybook is data, and its review build is public | Accepted |
| 42 | 2026-09-29 | The review deck ships as its own built site (GitHub Pages) | Accepted |

> **Numbering.** 42 entries. 1–17 were recorded 2026-08-05. 18–40 come from the
> `backend-phase-b` workstream (2026-08-14 → 2026-10-01) and are merged here out of
> `client-qa/session3/backend-phase-b.zip`, which held the fuller log. 41–42 are the
> review-deck decisions of 2026-09-29; they were written as 18–19 against a log that
> appeared to stop at 17, and were renumbered when the fuller log was read. Where a
> decision was reversed, its `**Status:**` line names the entry that supersedes it.

## Decision 1 — Supabase as the backend

**Date:** 2026-08-05
**Status:** Accepted

**Context.** We need a backend that provides: a relational database with strong typing and migrations, authentication with row-level permissions, real-time updates for the admin dashboard, and a free tier that covers the demo (one store, ~50 users, ~5000 SKUs).

**Considered.**

- Firebase — NoSQL, no migrations, weaker typing.
- Custom Node + Postgres on Render — More control, but we'd have to build auth, RLS, and real-time from scratch.
- Self-hosted Postgres + custom auth — Too much operational overhead for a demo.

**Decision.** Use Supabase. Postgres for data, Auth for users, RLS for permissions, Realtime for the admin dashboard. The free tier (500 MB DB, 2 GB transfer, 50K MAU) covers one store with ~5,000 SKUs and ~50 users comfortably.

**Consequences.**

- (+) Migrations are plain SQL files. Easy to review, easy to apply.
- (+) RLS ties auth.users to public.users via a trigger. The app cannot bypass it.
- (+) Free tier covers the demo.
- (-) Vendor lock-in. Migrating away from Supabase would mean rewriting the auth layer and the real-time subscriptions.
- (-) Supabase's free projects pause after 7 days of inactivity. Restart is one click, but worth noting.

---

## Decision 2 — Versioned SQL migrations, no in-place edits

**Date:** 2026-08-05
**Status:** Accepted

**Context.** Database schema changes need to be reviewable, reversible in principle, and applied in a known order across environments (dev, demo, pilot, production).

**Considered.**

- Prisma migrations — adds a dependency on Prisma's DSL.
- Raw SQL dumps — no ordering, no review.
- In-place edits — no history, environments diverge.

**Decision.** All schema changes go in `supabase/migrations/` as plain SQL files, named `<sequence>_<description>.sql`. Migrations apply in order, are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`), and **the schema is never edited in place**. The validator checks every migration for idempotency.

**Consequences.**

- (+) Every schema change is a diff in git. Reviewers see exactly what changed.
- (+) Idempotency means a partially-applied migration can be safely re-run.
- (+) Environments stay in sync — same migrations, same order.
- (-) Migrations are SQL, not a typed DSL. Mistakes (wrong column type, missing index) only surface at apply time.

---

## Decision 3 — Roles-as-data, not roles-as-code

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The app has 3 visible roles (admin, vendor-rep, worker) and a fourth internal one (super-worker, used to collapse vendor-rep and worker behind a single UI).

**Considered.**

- Hardcoded roles in code (`if (user.role === 'admin')`) — every new role requires a code change and a redeploy.
- Enum type — adds DB-side type safety but requires migrations to add roles.
- String column with controlled vocabulary — flexible, no schema changes for new roles.

**Decision.** `users.role` is a `text` column with a controlled vocabulary. The frontend has a TypeScript union type (`'admin' | 'vendor-rep' | 'worker' | 'super-worker'`) that mirrors the DB. RLS policies check the role string via a `current_user_role()` function.

**Consequences.**

- (+) Adding a role is a data migration, not a code change.
- (+) The TypeScript union catches typos at compile time.
- (-) A typo in the DB (e.g. `Admin` instead of `admin`) silently bypasses RLS. The validator checks the seed for known roles but not for typos at runtime.

---

## Decision 4 — RLS as the access boundary

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The app handles real business data (deliveries, sales, prices). A bug in the app or a malicious client must not be able to read data they're not entitled to.

**Considered.**

- Authorization in the app layer only — bugs and malicious clients can bypass.
- Authorization in the DB via RLS — the DB enforces, even if the app misbehaves.

**Decision.** Every table has explicit RLS policies for SELECT, INSERT, UPDATE, DELETE. The application cannot bypass them. The `current_user_role()` function (defined in `supabase/migrations/0003_grant_service_role.sql`) is the canonical way for policies to check the current user's role.

**Consequences.**

- (+) Defense in depth. The app can have bugs; the DB still enforces.
- (+) Admin can grant a role without code changes.
- (-) RLS policies are SQL and need to be tested carefully. The validator checks for the policy's existence and shape, not for its semantic correctness.
- (-) Complex policies (e.g. "worker can only insert transfer/spoilage movements, not deliveries/sales") require careful boolean logic that's easy to get wrong.

---

## Decision 5 — Append-only audit log via Postgres trigger

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The wholesaler needs to see who did what, when. In a regulated industry, this is a hard requirement.

**Considered.**

- Application-level audit log — the app could forget to write to it.
- Database trigger that writes to an audit table — the DB enforces, even if the app forgets.

**Decision.** Every mutation triggers an INSERT into `audit_log` via the `audit_trigger()` function. The `audit_log` table has no INSERT policy (only the trigger writes), no UPDATE policy, no DELETE policy. Admin can SELECT.

**Consequences.**

- (+) Every change is recorded. The wholesaler can answer "who recorded this delivery?" and "what did the vendor-rep change on this sale?"
- (+) The trigger is the only writer, so a bug in the app can't accidentally write fake audit entries.
- (-) Every mutation does 2 writes (the actual write + the audit write). Doubles the write load.
- (-) The audit log grows unbounded. For the demo scale this is fine. For production, partitioning or cold-storage archival would be needed.

---

## Decision 6 — PWA with graceful offline degradation

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The wholesaler's shop floor has unreliable WiFi. Workers need to keep working when the connection drops.

**Considered.**

- Full online-only — workers can't work during outages.
- Full offline write-queue — complex to implement correctly; risk of data loss if sync fails.
- Read-only offline + mutation disabled — simpler, acceptable for V1.

**Decision.** The service worker caches the app shell + recent reads. When offline:

- The app loads and shows cached data.
- Mutations are disabled with a "stale data, read-only" banner.
- When back online, the banner disappears within ~1 second.

**Consequences.**

- (+) Workers can browse stock during outages (read-only).
- (+) Simpler than a full write-queue.
- (-) Workers can't record spoilage or transfers during outages. A real wholesale with frequent outages would push back on this.
- (-) V2 work: full offline write-queue with IndexedDB outbox and conflict resolution.

---

## Decision 7 — 3-mode deployment lifecycle

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The project has a gatekeeper client who needs to see a working demo before committing to a paid engagement. After the demo, the same code goes to Pilot (real data, real users) and then to Production.

**Considered.**

- Build directly for production — high risk of building the wrong thing.
- Build directly for pilot — needs real data before validation, expensive if direction is wrong.
- 3-mode lifecycle (Demo → Pilot → Production) — cost-controlled, validated at each stage.

**Decision.** Mode A (Demo) ships with seeded data. Mode B (Pilot) is the same code with real data from one store. Mode C (Production) is hardened Pilot with backups, monitoring, and rate limits.

**Consequences.**

- (+) Demo gates the Pilot investment. Pilot gates the Production investment.
- (+) The same code runs all three modes. The difference is data and operational config.
- (-) Mode B (Pilot) is the most expensive phase — you're paying for real users and real data, and you might still learn the direction is wrong.

---

## Decision 8 — Per-batch pricing, not per-SKU

**Date:** 2026-08-05
**Status:** Accepted

**Context.** A single SKU (e.g. "Pomfret") can arrive in multiple deliveries at different prices paid to the fisherman. The wholesaler needs to track cost lineage.

**Considered.**

- Price on SKU — loses lineage. Every delivery overwrites the last.
- Price on batch (the chosen approach) — preserves lineage.

**Decision.** `batches.price_per_kg_paid` is the cost of that delivery. `sales.sale_price_per_kg` is the price charged to the customer (independent of cost). A `price_history` table holds SKU-level reference prices for analytics.

**Consequences.**

- (+) Cost lineage preserved. "Where did this 5 kg of pomfret come from, and what did we pay?"
- (-) A sale's profit requires joining the sale to its batch(es). The query is non-trivial but documented in `RecentActivity`.

---

## Decision 9 — Two locations, schema-aware

**Date:** 2026-08-05
**Status:** Accepted

**Context.** Stock needed a concept of "where" from day one, even before the real operational model was fully known.

**Decision.** A `locations` table, open-ended, seeded initially with two rows. (Superseded in practice once the real single-warehouse, container-based operation was understood — see Decision 19.)

**Consequences.**

- (+) Adding a location type never required a schema rewrite.
- (-) The original two-location guess didn't match reality; Decision 19/20 corrected it.

---

## Decision 10 — FIFO spoilage with multi-batch cascade

**Date:** 2026-08-05
**Status:** Accepted

**Context.** Fish spoils. Older fish first. A 5 kg spoilage event might exhaust the oldest batch (3 kg) and need to cascade to the next-oldest (2 kg).

**Considered.**

- Manual batch selection (let the worker pick which batch to spoil) — error-prone.
- LIFO (newest first) — wrong for a perishable.
- FIFO with cascade (chosen approach) — natural for the business, encoded in a DB trigger.

**Decision.** The `apply_movement_to_batches` trigger implements FIFO with cascade. The app says "spoil 5 kg" and the trigger figures out which batches to draw from. The algorithm is documented in `supabase/migrations/0001_init.sql` and exercised by the validator.

**Consequences.**

- (+) The app code is simple. FIFO is enforced at the DB.
- (+) Multi-batch cascade is automatic — no app logic needed.
- (-) The trigger is complex SQL. A bug in the trigger would corrupt inventory silently. The validator exercises it with 4 fixture cases.

---

## Decision 11 — Tamil fish names as data (not code)

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The UI needs to display fish names in both English and Tamil script (e.g. "Pomfret (வவ்வால்)"). Workers searching for a fish might type either.

**Considered.**

- Hardcoded Tamil translations in the app — inflexible, doesn't scale.
- `skus.tamil_name` column (chosen approach) — flexible, supports regional variations.

**Decision.** `skus` has both `english_name` and `tamil_name`. The UI renders both. The search box accepts either script.

**Consequences.**

- (+) Adding a new fish is a data insert, not a code change.
- (+) Regional variations (e.g. different Tamil names for the same fish in different districts) can be supported later without schema changes.
- (-) The current build doesn't include a Tamil font fallback. The browser uses the system font, which may not render Tamil on all devices.

---

## Decision 12 — Sales as a movement + sibling sales table

**Date:** 2026-08-05
**Status:** Accepted

**Context.** A sale is a stock-changing event, just like a delivery or transfer. Should it live in the same `movements` table, or in its own `sales` table?

**Considered.**

- Only in `sales` — no movement record, harder to audit "all stock changes" via a single query.
- Only in `movements` — no place for `customer_name` and `sale_price_per_kg`.
- Both (chosen approach) — movement has `kind='sale'` and `to_location_id=NULL`; sibling `sales` row carries the customer + price + batch linkage.

**Decision.** Sales are a `movements` row (kind=sale, to_location=NULL) plus a sibling `sales` row with the customer, sale price, and batch linkage.

**Consequences.**

- (+) Stock math stays single-sourced through `movements`. A single query answers "all stock changes."
- (+) Customer + price data lives in `sales`, where it belongs.
- (-) The app has to insert into two tables atomically. A failure between the inserts would leave the data inconsistent. (Mitigated by the cascade constraint — see `0005_record_transfer_cascade.sql`.)

---

## Decision 13 — iOS out of scope, Android Phase 3 (superseded)

**Date:** 2026-08-05
**Status:** Superseded by Decision 18

**Context.** Early scoping assumed a desktop-first web app with mobile as a later nice-to-have.

**Decision.** iOS excluded; Android deferred to a later phase.

**Consequences.** Reversed once real operational feedback showed the app is used in the field, on phones, by default — see Decision 18.

---

## Decision 14 — Demo data is real-schema, fake-content

**Date:** 2026-08-05
**Status:** Accepted

**Context.** The gatekeeper client needs to see a working app, but doesn't have real data yet. The demo must show realistic interactions without revealing "this is fake."

**Considered.**

- Lorem ipsum data — obviously fake, kills credibility.
- Real-schema fake-content (chosen approach) — 6 vendors, 25 SKUs, realistic Tamil names, plausible prices.

**Decision.** The seed script (`supabase/seed.sql`) inserts 6 vendors, 25 SKUs, 3 locations, 155 movements, 52 sales, 150 price_history rows. All idempotent. The seed can be re-run on a fresh database to recreate the demo.

**Consequences.**

- (+) The demo is convincing. The gatekeeper sees realistic interactions.
- (+) The schema is exercised by the seed (every table has data). This catches schema bugs early.
- (-) Some Tamil fish names are approximations. The actual wholesaler might use slightly different names. Easy to amend in Pilot.

---

## Decision 15 — No POS, no GST, no CRM in V1 (superseded)

**Date:** 2026-08-05
**Status:** Superseded by Decisions 21, 26–28

**Context.** Initial scope was deliberately narrow: inventory tracking only.

**Decision.** GST, customer CRM, and payment tracking excluded from the first build.

**Consequences.** All three came back into scope once real client feedback showed they were needed — see the decisions above.

---

## Decision 16 — Validator is the gate, no --force

**Date:** 2026-08-05
**Status:** Accepted

**Context.** Validators that can be bypassed are decoration. The previous exam-forge pipeline dropped 38% of a bank while printing "Done ✅" — exactly the failure mode we want to prevent.

**Considered.**

- Validator with --force flag — convenient but enables the failure mode.
- Validator that fails loudly (chosen approach) — every check is a hard gate.

**Decision.** `npm run validate` runs all 72 structural checks. Exits non-zero on any failure. No `--force`, no warnings-as-info. The selftest (`scripts/selftest.mjs`) runs the validator against deliberately broken inputs and asserts the validator catches each one.

**Consequences.**

- (+) A validator nobody has watched fail is decoration. The selftest proves it can fail.
- (+) The validator catches schema drift, missing policies, non-idempotent migrations, etc., before deploy.
- (-) The validator can be noisy. New contributors might find it intimidating at first.

---

## Decision 17 — Authored data is separate from derived data

**Date:** 2026-08-05
**Status:** Accepted

**Context.** Some data is set by humans (a sale's price, a vendor's name, a batch's cost). Other data is computed from the rest (current stock per SKU, dashboard totals).

**Considered.**

- Store everything — drift between stored and computed values.
- Store only authored data, compute derived data on read (chosen approach).

**Decision.** The app stores only what humans set: vendors, SKUs, batches, movements, sales, price_history. Dashboard totals, stock-per-SKU summaries, FIFO cascades — all computed on read. The audit log is the only place computed snapshots are allowed to live, and only as a debug aid.

**Consequences.**

- (+) No drift. The computed values are always consistent with the source data.
- (-) Every dashboard query is a join. The performance is acceptable at demo scale; production might need materialized views.
- (-) The app code is more complex (every "give me the total" is a query, not a field).

---

## Decision 18 — Mobile is primary, not a companion — Android via Capacitor

**Date:** 2026-08-14
**Status:** Accepted

**Context.** The original plan treated the browser app as primary, with mobile access as a nice-to-have PWA install. Real operational feedback said otherwise: the business runs from the field — staff are sent out to source fish and haul it to buyers, not seated at a desk.

**Considered.**

- PWA-only, relying on "add to home screen" for a mobile-like experience.
- A separate native codebase per platform.
- Capacitor wrapping the existing web build (chosen approach).

**Decision.** Android ships first via Capacitor, wrapping the same Vite/React codebase with minimal changes — a hardware back-button handler was the one real native-only addition needed. iOS follows once Android is proven in the field. One app, one login, role-gated views (see Decision 24) — not a separate lightweight app per role.

**Consequences.**

- (+) One codebase serves the browser, the PWA install, and the native Android app.
- (+) A native back button that actually works, not a browser-only assumption baked into the UI.
- (-) Native distribution (Play Store review, signing, versioning) is new overhead a pure web app didn't have.

---

## Decision 19 — Containers replace abstract batches as the physical stock unit

**Date:** 2026-08-14
**Status:** Accepted

**Context.** The original schema tracked stock as abstract "batches" — a financial/procurement record with no physical counterpart a worker could point at. Real operations pack fish into numbered, reusable containers on ice; the container, not the batch, is what a worker actually handles.

**Considered.**

- Keep batches as the only unit, add a loose "location" field.
- Introduce containers as a physical layer on top of the existing batch record (chosen approach).

**Decision.** `containers` (numbered, standard 5/10/15/20/25 kg sizes or custom) sit on top of `batches`, which remains the financial record. A container is loaded from exactly one purchase event; its shelf-life clock starts at load time. Sales and spoilage draw from the container with the least remaining shelf life first, cascading across containers if needed.

**Consequences.**

- (+) The digital record matches what a worker can physically see and count.
- (+) Shelf-life tracking becomes per-container, not an approximation.
- (-) A real, structurally significant change that touched every existing sale/transfer/spoilage code path.

---

## Decision 20 — Multi-warehouse schema, single warehouse in practice

**Date:** 2026-08-14
**Status:** Accepted

**Context.** The business currently operates one warehouse, but expansion to a second is a real possibility the schema shouldn't have to be rewritten for later.

**Considered.**

- Model only what exists today (one warehouse, implicit).
- Build the multi-warehouse schema now, gated behind a feature flag until a second warehouse is real (chosen approach).

**Decision.** A `warehouses` table, with `warehouse_id` threaded through locations, batches, movements, and sales. Each warehouse has its own vendor and SKU catalog — fresh produce needs sourcing close to where it's actually caught, so a shared central catalog was rejected. Cross-warehouse aggregate views exist but are unexercised against real multi-warehouse data.

**Consequences.**

- (+) Adding a second warehouse is a data operation, not a schema migration.
- (-) The cross-warehouse code paths carry real but currently-untested complexity.

---

## Decision 21 — GST support ships dormant, not deferred entirely

**Date:** 2026-08-14
**Status:** Accepted

**Context.** Fresh, unprocessed fish is GST-exempt in India; frozen or processed seafood is not, and the business's exact registration status wasn't yet known at build time.

**Considered.**

- Ignore GST entirely until it's confirmed needed.
- Build a dormant, parallel GST-ready track now (chosen approach).

**Decision.** Customer-level GST fields and an export shape compatible with standard accounting tools exist in the schema but stay inactive until the business needs them. The non-GST track remains the active one.

**Consequences.**

- (+) No schema rewrite or data-loss risk if GST requirements arrive later.
- (-) Dormant fields are unused surface area until activated.

---

## Decision 22 — Incomplete data warns; it never blocks a mutation

**Date:** 2026-08-14
**Status:** Accepted

**Context.** Field conditions mean a delivery photo, a customer's contact details, or a payment-proof photo may genuinely be unavailable at the moment of recording.

**Considered.**

- Require complete data before a mutation is accepted.
- Accept incomplete data, flag it for follow-up (chosen approach).

**Decision.** A missing field never blocks a purchase, bill, or sale from being recorded. Missing fields are flagged in a report addressed to whoever entered the incomplete record.

**Consequences.**

- (+) Matches how the business actually operates in the field.
- (-) Data completeness becomes an ongoing operational discipline, not a guarantee.

---

## Decision 23 — Reverse-sale via new movement rows, never an UPDATE

**Date:** 2026-08-14
**Status:** Accepted

**Context.** A sale sometimes needs to be undone (wrong amount, buyer returned stock). The append-only principle (Decision 5) rules out editing the original record.

**Considered.**

- Allow a direct UPDATE/DELETE on the original sale.
- Restore stock via new movement rows referencing the original transaction (chosen approach).

**Decision.** A reversal creates new movement rows tied to the original movement group, keeping the append-only discipline intact. Default workflow: a rep requests it, an admin approves it, then it executes; an admin can grant trusted reps a self-execute exemption, with the admin still notified either way.

**Consequences.**

- (+) Full history survives every reversal; nothing is ever silently edited away.
- (-) A reversed sale's "current state" is a computed read (original + reversal), not a single row.

---

## Decision 24 — One app, one login, role-gated views — not separate apps per role

**Date:** 2026-08-14
**Status:** Accepted

**Context.** Comparable inventory/ERP products were researched for whether office and field roles should be separate apps. Several products that tried splitting management-tier roles into their own app later walked it back.

**Considered.**

- Separate apps per role.
- One app, one login, views gated by role (chosen approach).

**Decision.** Admin, co-admin, and vendor-rep share one app. The one consistently-justified split is task/device-context, not role: the field worker's screens are deliberately minimal and task-focused, not a shrunk admin view — isolated enough that a genuinely separate app later is cheap if real field use demands it, without committing to a second app-store listing now.

**Consequences.**

- (+) A co-admin can take over full capability from their phone whenever required, with nothing to switch between.
- (+) One app to maintain and ship, not several.

---

## Decision 25 — No price value is ever pushed to a customer automatically

**Date:** 2026-08-14
**Status:** Accepted

**Context.** The business's previous system broadcast a notification to every buyer whenever a reference price changed — disliked, because the business sells at differential rates and negotiates discounts per buyer.

**Considered.**

- Keep a "current price" concept and notify on change.
- Never store or broadcast a standing price; every sale price is entered per-transaction (chosen approach).

**Decision.** Sale price is always typed per-transaction, privately negotiated, never inherited from a standing "current price" and never broadcast to a customer. `price_history` stays analytics-only and admin-facing.

**Consequences.**

- (+) No accidental price-broadcast to buyers, ever, by construction.
- (-) Nothing auto-fills a sale's price; every sale requires the rep to type it.

---

## Decision 26 — Container quantities are wholesaler-entered, custom sizes allowed

**Date:** 2026-09-10
**Status:** Accepted

**Context.** The 5 standard container sizes don't cover every physical container a real warehouse owns, and someone has to register how many of each the business actually has.

**Considered.**

- A single aggregate count per size.
- Individually-numbered container rows, registered in bulk, with an open-ended size field (chosen approach).

**Decision.** The admin registers containers himself, in bulk for convenience, but each is still tracked as its own numbered row. Sizes beyond the 5 standard presets are allowed. A container can never be deleted once it has held a fill — a fill's foreign key blocks it — but a never-used container can be removed.

**Consequences.**

- (+) Matches the real, individually-numbered physical containers on the warehouse floor.
- (+) Shelf-life and QR-tagging both need per-box identity, which this preserves.

---

## Decision 27 — Per-customer credit terms, derived balance, soft enforcement only

**Date:** 2026-09-10
**Status:** Accepted

**Context.** Some customers buy on credit with an informal limit and payment window. The business wanted a real first attempt at tracking this without waiting for a fully specified policy.

**Considered.**

- Hard-block a sale once a customer is over their limit.
- Track and flag, never block (chosen approach), matching Decision 22's philosophy.

**Decision.** `customers.credit_limit` and `credit_period_days` are optional, admin-configurable per customer. `customer_credit_status` is a derived (never stored) view computing real-time outstanding balance, over-limit status, and days overdue on the oldest unpaid sale. Recording a sale never checks this view.

**Consequences.**

- (+) Ships a real, useful feature without needing a fully agreed policy up front.
- (-) "Over limit" is visibility, not enforcement — a rep can still record a sale to an over-limit customer.

---

## Decision 28 — Account creation requires a server-side Edge Function

**Date:** 2026-09-10
**Status:** Accepted

**Context.** Every other server-side operation in this project is a Postgres function, gated by RLS. Creating a genuinely new, login-capable account is different: it needs the Auth Admin API, which needs the service-role key — a key that must never reach the browser.

**Considered.**

- A Postgres `SECURITY DEFINER` function (doesn't work — it bypasses RLS, not the "the secret key never leaves the server" boundary; creating an auth account isn't a SQL operation at all).
- A Supabase Edge Function (chosen approach) — the first one this project needed.

**Decision.** `invite-user` verifies the caller is really an admin or co-admin using the caller's own session token (the same RLS-backed check used everywhere else, not a duplicated one), then constructs a second, service-role-scoped client — created only after verification, never returned to the caller — to perform the actual account creation.

**Consequences.**

- (+) The secret key never leaves server-side code, in any code path.
- (+) Reuses the existing authorization model rather than inventing a parallel one.
- (-) Introduced a genuinely new deployment artifact type (Edge Functions) this project didn't have before.

---

## Decision 29 — Email invitation becomes a shareable link, not an auto-sent email

**Date:** 2026-09-11
**Status:** Accepted

**Context.** Automatically-sent invite emails depend on the hosting platform's own sending reputation — real risk of landing in spam or simply not arriving, with no visibility into which.

**Considered.**

- Keep auto-sending the invite email.
- Generate the invite link without sending anything, hand it to the admin to share directly (chosen approach).

**Decision.** Account creation still happens immediately; the email delivery step is removed entirely. The admin gets the link back and shares it through whatever channel the recipient actually uses.

**Consequences.**

- (+) No dependency on email deliverability at all — the admin controls the moment of delivery.
- (-) A manual step the admin must remember to complete; nothing prompts them if they forget to send it.

---

## Decision 30 — Phone accounts use password + link, not SMS one-time codes

**Date:** 2026-09-11
**Status:** Accepted

**Context.** SMS-based one-time-code sign-in needs a connected SMS provider and costs real money per message, on every single sign-in, indefinitely. A simpler mechanism was wanted as a real, usable starting point.

**Considered.**

- SMS one-time-code sign-in (no password, ever, but recurring per-message cost) — kept as a specified, deliberately deferred alternative, not deleted.
- Password-based sign-in via a shared link, phone number as the identifier (chosen approach).

**Decision.** A phone invite goes through the same link-and-password mechanism as email. Since the underlying platform can only anchor an invite link to an email identity, the account is created against a synthetic, never-displayed email derived from the phone number, then the real phone number is attached to the same account. The person only ever sees and types their phone number; sign-in resolves it back to the same account and authenticates with a password.

**Consequences.**

- (+) No SMS provider, no per-message cost, at any point — invite or sign-in.
- (-) Reintroduces "a password to remember," the exact thing the SMS-OTP alternative was designed to avoid — an explicit, informed tradeoff, not an oversight.

---

## Decision 31 — Invite links resolve on the app's own route, not the auth provider's

**Date:** 2026-09-11
**Status:** Accepted

**Context.** A real, generated invite link, clicked for real, landed back on the sign-in screen instead of a set-password step. Two separate causes: no page in the app ever handled an invite link's tokens at all, and the auth provider's own redirect mechanism delivers session tokens in the URL fragment — the same part of the URL this app's hash-based router reads as a route, a structural collision.

**Considered.**

- Switch the app to path-based routing instead of hash-based (a bigger, unrelated change with its own hosting-configuration cost).
- Keep hash-based routing; stop depending on the provider's own redirect page (chosen approach).

**Decision.** The invite link now points at the app's own route, carrying a verification token as an ordinary query string. A dedicated page verifies that token directly, client-side, then collects a password — checked before the app's normal signed-in/signed-out branch, since verifying establishes a session before a password is set.

**Consequences.**

- (+) Works the same regardless of which underlying OAuth flow the auth provider is configured for.
- (+) No dependency on a provider-hosted page correctly handing off to a single-page app.
- (-) One more page and route to maintain, outside the normal role-gated app shell.

---

## Decision 32 — Single-client, single-country phone handling; one-field sign-in

**Date:** 2026-09-11
**Status:** Accepted

**Context.** This app has exactly one client, always in Tamil Nadu, always the same country code. Asking a non-technical user to type a country code they don't think of themselves as having is pure friction with no real benefit at this app's actual scale.

**Decision.** Phone numbers are normalized automatically wherever they're entered — a plain 10-digit number is valid input everywhere; the country code is inferred, never typed. Sign-in collapsed from a method-picker (choose email or phone, then fill in the matching form) to one identifier field that detects which kind it is from what's typed.

**Consequences.**

- (+) One fewer decision and one fewer field for a non-technical user, on every sign-in.
- (-) The normalization assumption (single country) would need revisiting if this codebase were ever reused for a client elsewhere.

---

## Decision 33 — Both account identifiers must be set in one call, before any link is generated

**Date:** 2026-09-11
**Status:** Accepted

**Context.** Every phone invite's link failed to verify, consistently, immediately after being generated — isolated by comparing against the email path (which never has this problem) and by selectively removing a second write from the phone sequence.

**Considered.**

- Investigate as a rate-limit or expiry-configuration issue (ruled out with real evidence: rate limits were nowhere near exhausted, and removing one specific write fixed it outright).
- Fix the write ordering (chosen approach, once isolated).

**Decision.** A phone account's synthetic email and real phone number are now set together, in a single account-creation call. The invite link is generated only after that account fully exists in its final state — no further write to the account ever happens after the link is issued.

**Consequences.**

- (+) A real, previously-silent failure mode is now fixed and covered by a test that actually asserts the returned link works, not just that the surrounding writes succeeded.
- (-) A general lesson worth carrying forward: any account mutation between issuing a verification link and it being used is a real risk, not a theoretical one.

---

## Decision 34 — "Receiving never sees the vendor or the rate" is enforced in the database, behind a switch

**Date:** 2026-10-01
**Status:** Accepted (switch ships off)

**Context.** The client's handover rule says the person receiving fish must not see supplier, purchase price, supplier contact or margin. Until now `batches` and `bills` were readable by every signed-in user and `batches` carries `vendor_id` and `price_per_kg_paid`, so any floor user could read them from the browser; hiding fields in the UI hid nothing. Row-level security cannot hide columns.

**Considered.**

- Column-level `revoke select` (rejected: grants belong to the one shared `authenticated` role, so it would hide the columns from admins too, and it leaks through any future `select *`).
- A `security definer` function per screen (used for the receiving queue).
- A view of safe columns plus tightened base-table policies (chosen for stock reads).

**Decision.** `batches_safe` (safe columns only) and `list_receiving_queue()` serve receivers; the read policies on `batches`, `bills`, `vendors` and `vendor_payments` allow a row only if the switch `app_settings.enforce_blind_receiving` is off or the caller passes `can_view_procurement_money()`. That function is true for admin and co-admin, true for vendor-rep and super-worker unless an admin set `users.receiving_blind`, and false for worker. The switch ships **off** so that applying the migration cannot break screens that still read the base tables.

**Consequences.**

- (+) The rule holds even against a hand-written query; one switch to turn on and one to roll back.
- (+) "Who is blind" is data, not a role, so it needs no new role and no redeploy.
- (-) Four screens must move to the safe view/RPC before the switch is turned on (listed in `BACKEND-PHASE-B-STATUS.md` §6).
- (-) Views owned by the migration role ignore RLS, so every view over these tables must be reviewed for money columns, and must revoke the default write grants (Decision 38).

---

## Decision 35 — The truck load is the unit receiving sees; a purchase is a hidden supplier lot

**Date:** 2026-10-01
**Status:** Accepted for the build; the allocation basis needs client confirmation

**Context.** The client's handover document describes one truck carrying fish bought from several suppliers, received as a single lot, with the supplier lots hidden from receiving. The app's batches are single-supplier (`vendor_id` and price are not null), so FIFO and costing depend on that.

**Decision.** `procurement` rows (PR) are the supplier lots; `truck_loads` (RCV) group them and are all that receivers see. On receiving, the physical kg of each fish is allocated across that fish's lots pro rata to expected kg, producing one single-supplier batch per lot, flagged `is_pro_rata_share` whenever the load was mixed. Traceability and the scorecard say "a share of a mixed load" and "allocated", never "this crate was supplier B".

**Consequences.**

- (+) FIFO, costing, bills and every existing screen keep working unchanged.
- (+) The app never claims knowledge it does not have.
- (-) A supplier who under-delivered is averaged with the others in the same fish. If the client wants a different basis (for example, the weigh-in order), it changes in one function.

---

## Decision 36 — Money stays at the promised amount; only stock follows the scale

**Date:** 2026-10-01
**Status:** Accepted (reaffirms the 0032 policy)

**Context.** Migration 0032 recorded the client's answer "case by case, reconciled by hand" for a delivery that weighs differently from the bill.

**Decision.** `receive_truck_load` posts stock at the physical weight and writes each supplier's bill at expected kg × rate. It never adjusts the bill to the weight; a difference raises a `truck_load_discrepancy` notification, and the existing `reconcile_bill` records the settlement.

**Consequences.**

- (+) Consistent with the existing flow; no silent money change.
- (-) A bill can be issued for fish that did not arrive (zero delivered) until an admin reconciles it.

---

## Decision 37 — The procurement desk is additive, with no sixth role yet

**Date:** 2026-10-01
**Status:** Proposed (pending the client's answer on whether the app owns procurement)

**Context.** Chapters 21–32 imply a procurement team the five roles do not model, and the client has not said whether that team works in this app at all.

**Decision.** Requirements, market prices, festivals, quotations, purchase orders and purchases are built as new tables and functions beside the bill flow, readable and writable by whoever passes `can_manage_procurement()` (today: the same set as `can_view_procurement_money()`). Adding a role later means editing that one function.

**Consequences.**

- (+) Nothing existing changes; unused tables cost nothing.
- (+) If the answer is "receiving only", the desk becomes reporting over bills.
- (-) The reachable procurement team is wider than a dedicated role would be (any non-blind vendor-rep or super-worker).

---

## Decision 38 — The audit trail covers every money and stock table, and views are read-only

**Date:** 2026-10-01
**Status:** Accepted

**Context.** Two findings. (1) `audit_trigger()` was attached to only 8 of 24 tables; bills, payments, customers, containers, fills, receiving confirmations, reversals and complaints were not audited although the product says every change is tracked. (2) Default privileges grant `ALL` on every new view to `authenticated`, and a single-table view running with owner rights is auto-updatable, so it would bypass the table's write policies.

**Decision.** `0037` attaches the audit trigger to 12 more tables, and every Phase B table gets it at creation (task, check-in and notification tables stay out: operational noise). Each new view revokes all privileges and grants `SELECT` only; a test fails if a signed-in role can write through any of them.

**Consequences.**

- (+) The "no edits possible" claim is now true of the financial record from `0037` onward.
- (-) History before `0037` for the newly audited tables does not exist.
- (-) Audit rows grow with every payment, bill and fill; retention is an open question.

---

## Decision 39 — Database tests run against a local PostgreSQL, not the live project

**Date:** 2026-10-01
**Status:** Accepted

**Context.** The existing tests are Node scripts that need a live Supabase project and cannot be run without credentials or without touching real data.

**Decision.** `supabase/tests/run.sh` builds a scratch PostgreSQL database from the migrations plus a small stub of Supabase's `auth` schema and roles, then runs SQL tests in rolled-back transactions as one user per role.

**Consequences.**

- (+) Policies, grants and functions are tested for real, including "this role gets zero rows" and "this role cannot write through that view".
- (-) It does not exercise Supabase Auth, PostgREST, Realtime or Edge Functions; the existing Node scripts still cover those against a live project.

---

## Decision 40 — Functions are closed by default; each one is opened on purpose

**Date:** 2026-10-01
**Status:** Accepted

**Context.** PostgreSQL grants `EXECUTE` on new functions to `PUBLIC`, and migration `0004` added default privileges for `authenticated`. Every `SECURITY DEFINER` function was therefore callable with only the anon key, including internal helpers that rewrite stock (`container_sourced_cascade`, `direct_batch_cascade`) and send notifications. A test reproduced a 100 kg batch dropping to 70 kg through an anonymous call.

**Considered.** (a) Add a role check inside each internal helper: leaves a long list of functions to remember and a default that stays unsafe. (b) Revoke and re-grant explicitly, and change the default: one migration, and the safe state is the default.

**Decision.** `0046` revokes `EXECUTE` on all public functions from `PUBLIC` and `anon`, alters the default privileges so new functions get nothing, and revokes the internal helpers from `authenticated` as well. Client-callable functions keep an explicit `grant execute … to authenticated`. `90_security.sql` fails if any public function becomes executable by `anon`.

**Consequences.**

- (+) The pre-existing hole is closed and cannot come back silently.
- (-) A new function is unreachable from the app until its migration grants it; forgetting the grant shows as a permission error, not a silent exposure.
- (-) The live project must be checked separately; this repo cannot show whether it was hardened by hand.

---

## Decision 41 — The workflow storybook is data, and its review build is public

**Date:** 2026-09-29
**Status:** Accepted

**Context.** The client reviewed twelve generated visuals (`client-qa/developer-prompt-image/prompt-1…12`)
and asked to see the whole business flow as one animated walkthrough, drawn from their own reference
decks. That is 32 chapters and 104 screens. The client has no account in the app, and the deck has to
survive a feedback loop where they say "chapter 4, step 2 is wrong".

**Considered.**

- One React component per screen — 104 components to keep consistent; every correction becomes a code
  change, and the screens drift from each other immediately.
- Export a video — no deep links, no captions to correct after the fact, and unchangeable mid-review.
- A static screenshot deck — loses the motion, which is a large part of what is actually being approved.

**Decision.** Screens are **data**: a `ScreenSpec` plus 24 block kinds, drawn by one renderer
(`src/components/storybook/`). The 32 chapters are literals in `src/lib/storybook/chapters/*.ts`.
The deck is reachable at `#/storybook` for every role, and unauthenticated at `#/review`
(`pages/StorybookReview.tsx`, checked in `App.tsx` above the loading/session branches). Nothing in the
subtree calls Supabase, and the chapter/step live in the URL (`?c=&s=`) so a reviewer can paste an
exact screen.

**Consequences.**

- (+) Correcting a screen is a data edit; 32 chapters were authored in parallel against a frozen type.
- (+) The client opens one link with no account and can cite a screen unambiguously.
- (-) 24 block kinds is a deliberately limited vocabulary — a genuinely new shape needs a renderer
  change rather than an inline one-off.
- (-) The deck looks like the app but is not the app. Reviewers must be told the figures are samples
  (see Decision 14 — real schema, fake content), or the deck becomes a promise it cannot keep.

---

## Decision 42 — The review deck ships as its own built site (GitHub Pages)

**Date:** 2026-09-29
**Status:** Accepted

**Context.** The client should click through the deck on his phone from one link. The app bundle
cannot do that on its own: `src/lib/supabase.ts` throws at **import time** when the Supabase env vars
are absent, so a bare deploy white-screens at every route, `#/review` included. GitHub Pages also
serves a project site from `/<repo>/` and will not publish a **private** repo on the free plan.

**Considered.**

- Deploy the app and send `#/review` — needs the Supabase env vars, exposes the sign-in page, and
  hands the client a login wall for what is a brochure.
- Netlify (already configured for the app) — works and supports a private repo, but it is a second
  site and a set of secrets for a static artifact. Kept as the fallback.
- A separate Vite entry that builds the deck alone — chose this.

**Decision.** `src/storybook-main.tsx` + `storybook.html` + `vite.storybook.config.ts` build the deck
by itself into `dist-storybook/`, with `VITE_BASE=/<repo>/` for the Pages subpath (the base drives the
asset URLs, the manifest's `start_url`/`scope` and the service worker's `navigateFallback`).
It contains **no Supabase**, so it needs **no env vars and no secrets**, and publishes to
`github.com/Sairampv98/Jayshankar-ui` with a `.nojekyll` file. `scripts/publish-storybook.sh`
rebuilds, syncs and pushes in one command. `sourcemap: false` plus a dedicated `storybook-public/`
keep the artifact at ~430 KB — the shared `public/` would otherwise drag in 69 MB of tutorial videos.

**Consequences.**

- (+) One link, no login, no secrets; the client gets a home-screen icon and offline access.
- (+) The app repo can stay private — the public repo holds only generated output.
- (-) A second build config and a publish script to maintain.
- (-) Pages hosts one site per repo, so the deck and the app cannot share that URL; switching the URL
  to the app later means changing the workflow's build step.
- (-) The published site is public. Acceptable only because every figure in the deck is sample data
  (Decision 14).

---

## Template

**Date:**
**Status:** Proposed / Accepted / Superseded

**Context.**

**Considered.**

**Decision.**

**Consequences.**
