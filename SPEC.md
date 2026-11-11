<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:HIGH -->
<!-- ZS:PLATFORM:WEB-PWA -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
<!-- Backend: Supabase Postgres (recorded in §0.2 D1; not a ZS marker because the kit's
     validator only allows COMPLEXITY / PLATFORM / LANGUAGE). -->

# Jayshankar — Canonical Specification (v2)

> **Inventory management for a Tamil Nadu fresh-fish wholesale warehouse-and-delivery operation.**
> Spec-first (TINS): this file is the source. The app is generated from it.
> **Read this first:** §0.0 (cheapest version), §0.2 (locked decisions), then §2 for the module
> you are building.
>
> **v2 changelog (2026-09-10):** merges `SPEC-AMENDMENT-v2.md` (now `docs/deprecated/SPEC-AMENDMENT-v2.md`) (D18–D27, the Mode B feature
> set: containers, bills, CRM, payments, reversal, multi-warehouse, GST-dormant, notifications)
> and `client-qa/operational-reality-2026-09-10.md` (real operational facts gathered directly
> from the developer, superseding several V1 guesses — see D28–D31 below). `SPEC-AMENDMENT-v2.md`
> is now historical; this file is authoritative. Full reconciliation record:
> `BUILDER-DECISIONS-REVIEW.md` decision #36.

---

## 0. Preamble

### 0.0 Cheapest version that would work

A Google Sheet with three view filters (admin / vendor-rep / worker), one Apps Script for input
validation, the wholesaler shares the sheet with the staff. Ships in 2 days, costs nothing, works
on any phone. Loses to anything that needs real multi-user concurrency, an audit trail, or
persistence beyond Sheet version history.

**The expensive version below buys:**

- Multi-user with role-based access **enforced at the database** (RLS) — the app cannot bypass it
- Realtime sync — the admin sees a vendor-rep's delivery the moment it is recorded
- Append-only audit log — the ex-retailer client will ask for this; cheaper to build it day one
- Offline-capable PWA — worker records a pick when shop WiFi is down, syncs when it returns
- A schema that can absorb the pilot discoveries (Mode B) without a rewrite
- A backend that survives the demo into production — no "we have to rewrite this in Supabase" later

**The Mode A → B → C lifecycle** (see D7) is the cost-control mechanism. The Demo is the
investment; Pilot is the validation; Production is the payoff. A spec that tries to be Production
on day one will be wrong on day one.

### 0.1 What this document is

This is the **canonical specification for Jayshankar**. Under TINS this file *is* the source code:
the application is generated from it, and defects are fixed by editing this file and regenerating —
never by patching generated output.

It supersedes and absorbs the following prior work, which remains in the parent workspace as a
feature quarry:

| Prior artifact | Fate |
|---|---|
| `exam-forge/SPEC.md` and supporting files | **Methodology absorbed.** TINS, locked-decisions table, validator discipline, the reviewer's three lessons. The locked decisions themselves do not transfer; the *method* does. |
| `exam-forge/REVIEWER-DECISIONS-REVIEW.md` | **Lessons applied.** "Cheapest version" line above, no "no backend" by default (D1), migrations as a hard requirement (D2), question the frame, use a real user as a gate (D7). |
| `exam-forge/BUILDER-DECISIONS-REVIEW.md` | **Process applied.** Spec first, code second, validator as arbiter, no `--force` flags, separate authored from derived data. |
| The user's MERN chatbot (parent workspace) | **Stack pattern absorbed.** Vite + React + TS + Tailwind + Netlify, same muscle memory. |

### 0.2 Locked design decisions

| # | Decision | Resolution |
|---|---|---|
| **D1** | **Supabase is the backend.** Postgres for data, Auth for users, RLS for role-based access, Realtime for live updates. Free tier (500 MB DB, 2 GB transfer, 50 K MAU) covers one store with ~5 000 SKUs and ~50 users comfortably. Self-hostable later if the free tier is outgrown or business requirements change. | LOCKED |
| **D2** | **One canonical schema, versioned migrations.** All schema changes go in `supabase/migrations/` as plain SQL files, named `<UTC-timestamp>_<description>.sql`. Migrations apply in order, are reversible in principle, and **the schema is never edited in place**. The V1 schema is `0001_init.sql`. | LOCKED |
| **D3** | **Roles-as-data, not roles-as-code.** `users.role` is a string with a controlled vocabulary: `admin`, `vendor-rep`, `worker`, `super-worker`. The V1 frontend collapses `vendor-rep` and `worker` behind a "super-worker" view (D3a). New roles are added by migration, never by code change. | LOCKED |
| **D3a** | **The "super-worker" UI is a frontend pattern only.** Vendor-rep and worker share a single dashboard layout in V1. The backend policies distinguish them, but the UI does not. Splitting the UI is a V2 frontend task, not a backend task. | LOCKED |
| **D4** | **Row-level security (RLS) is the access boundary.** Every table has explicit policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`. The application cannot bypass them even with a bug or a malicious client. RLS is the single source of truth for who can do what. | LOCKED |
| **D5** | **Append-only audit log.** Every mutation writes to `audit_log` via a Postgres trigger. Captures `user_id`, `action`, `table`, `row_id`, `before_json`, `after_json`, `at`. The audit log is itself protected by RLS: admins SELECT, no one writes except the trigger function. | LOCKED |
| **D6** | **PWA with graceful offline degradation.** Service worker caches the app shell and the most recent read snapshot. When offline, the UI shows a "stale data — read only" banner and disables all mutation buttons. When online, reads refresh. **No offline write-queue in V1** (this is V2 work; the spec calls out the upgrade path). | LOCKED |
| **D7** | **Three deployment targets, in order: Demo (Mode A), Pilot (Mode B), Production (Mode C).** All three run the same code. The difference is data, RLS test depth, and offline behaviour. Mode A is the gate to B; B is the gate to C. Skipping a mode is a decision the spec requires you to make explicit. | LOCKED |
| **D8** | **Pricing is per-batch, not per-SKU.** Each delivery batch carries its own `price_per_kg_paid` (paid to fisherman) and contributes to sales at its own `sale_price_per_kg` (charged to customer). A `price_history` table records SKU-level reference prices for analytics; the authoritative cost and price data lives on the batch. | LOCKED |
| **D9** | **Two locations in V1: `storage` (back-of-house, includes freezer) and `display` (front-of-house).** Schema is location-aware from day one. A third location (dedicated `freezer`) is one migration, not a schema rewrite. The V1 `locations` table is open-ended. | LOCKED |
| **D10** | **Batch tracking with FIFO spoilage.** Each delivery creates a `batches` row keyed by `(sku_id, location_id, delivered_at)`. `spoilage` movements draw from the oldest non-empty batch in the source location. If the oldest batch has insufficient kg, the algorithm cascades to the next-oldest until the spoilage amount is satisfied. The `display` location shows "today's catch" by default (latest batch on top), with deeper batches below. | LOCKED |
| **D11** | **Tamil fish names are data, not code.** `skus.tamil_name` is required (can be empty string for non-regional fish, but the field exists). UI renders English and Tamil side by side in the SKU catalog. The worker search box accepts either script. | LOCKED |
| **D12** | **Sales are a movement to `to_location_id = NULL` (out of the system), recorded in a sibling `sales` table.** A `movements` row with `kind='sale'` and `to_location_id=NULL` represents the stock leaving. The `sales` table carries `customer_name`, `sale_price_per_kg`, and links to the `batch_sales` join rows that say which batch(es) the sale drew from. Stock math stays single-sourced through `movements`. | LOCKED |
| **D13** | **iOS is out of scope. Android is Phase 3, triggered by client demand.** The web app is a PWA — it works on iOS Safari, but is not optimised for it. No iOS-specific design, no iOS testing, no App Store consideration in V1. | LOCKED |
| **D14** | **Demo data is real-schema, fake-content.** Mode A (the demo to the gatekeeper client) uses a seeded dataset: 6 fishermen vendors, 25 fish SKUs, 3 locations (storage, freezer, display), 150+ historical movements over 14 days, 20+ sales, 30 days of price history. The seed script is `supabase/seed.sql` and runs idempotently. | LOCKED |
| **D15** | **No POS, no invoicing, no GST, no customer CRM, no supplier contracts in V1.** The spec covers inventory + sales recording + basic pricing + audit. POS-style checkout, GST invoicing, customer database, supplier contracts — all out of scope (§9). They may come in Mode C if the pilot proves demand. | LOCKED |
| **D16** | **The validator is the arbiter and fails loudly.** `npm run validate` runs migrations, the seed (idempotency check), the RLS tests, and the acceptance tests. Exits non-zero on any error. No `--force`, no "warn and continue". The previous exam-forge pipeline dropped 38% of a bank while printing `Done ✅` — that pattern is rejected here. | LOCKED |
| **D17** | **Authored data is separate from derived data.** Sku-level "current stock" is derived, computed on read from `movements`. `price_history` is authored (the vendor-rep sets it). Anything the app computes (totals, summaries, dashboard widgets) is not stored. The audit log is the only place computed snapshots are allowed to live, and only as a debug aid. | LOCKED |

**D18–D27 below are merged from `SPEC-AMENDMENT-v2.md` (Mode B scope; now `docs/deprecated/SPEC-AMENDMENT-v2.md`). D28–D31 are new,
sourced from real operational facts gathered directly from the developer on 2026-09-10
(`client-qa/operational-reality-2026-09-10.md`) — several supersede a V1 guess above, per the
same pattern D18 uses to supersede D13.**

| **D18** | **A mobile app is the primary interface, not a companion — iOS is confirmed in scope, superseding D13's exclusion.** Not a late wrap of a desktop-first web app: the app is used in the field on phones by design (D29's warehouse-and-delivery reality), and the co-admin (D28) needs to take over full capability from his phone whenever required. Android ships first (Capacitor-wrapped, existing Vite/React codebase, minimal rewrite); iOS follows once Android is proven in the field. **The Google Play Developer registration ($25 one-time) is needed now, not deferred to late in the build** — without it there is no way to get even an internal-testing build in front of the wholesaler for validation, and Play Store review is not instant. Apple Developer Program ($99/year, recurring) is a client-budgeted cost, reopening D0.0's "no paid services" framing — acknowledge explicitly, don't leave implicit. | LOCKED |
| **D19** | **Photo attachments live in Cloudflare R2, with Supabase Storage as a fallback.** Both platforms in use, deliberately (not a silent default) — R2's free tier (10 GB, zero egress, no expiry) gives roughly 6–7 months of runway at the estimated photo volume, versus ~20 days on Supabase Storage's 1 GB alone. R2 is primary; Supabase Storage is the fallback on R2 upload failure. Compression happens **server-side** (an Edge Function step), not client-side. Because Supabase RLS does not reach into R2, photo access control is rebuilt as presigned URLs minted by an Edge Function that checks the requester's role — new plumbing, not automatic. | LOCKED |
| **D20** | **A Supabase Edge Function, not n8n, is the v1 automation layer.** Triggered by Database Webhooks on `movements`/`sales`/`bills`, it sends outbound WhatsApp messages (bill-share, payment-proof confirmation) via the official WhatsApp Business Cloud API directly. n8n is deferred. WhatsApp inbound automation is explicitly out of scope for this phase (§9). **This channel must never carry a price/rate value automatically — see D31.** | LOCKED |
| **D21** | **Containers are the shelf-life and FIFO tracking unit for stock in the warehouse.** Physical, numbered, reusable thermocol containers packed with ice (fixed capacities: 5/10/15/20/25 kg) replace the abstract batch as the operational unit a worker interacts with once fish is packed at receiving. A container is loaded from exactly one purchase event (never mixed across vendors/trips); its shelf-life clock starts at load time. `batches` is unchanged as the financial/procurement record (D8); containers are a new physical-tracking layer on top of it. **Provenance:** the container model itself came from the co-admin (the domain expert), the QR-tagging idea from the developer, inspired by Flipkart Minutes' early Bangalore rollout. **Honest scaling caution, from the same source:** Flipkart reportedly moved away from that exact model as they scaled up — treat this as right-sized for the current single-warehouse scale, not a permanently-proven architecture; revisit if D23's multi-warehouse scenario becomes real or volume grows significantly. Full schema in §B, algorithm changes in §C. | LOCKED |
| **D22** | **Reverse-sale is in scope, modeled as new movements, never as an UPDATE.** A reversal restores kg via new movement rows referencing the original `movement_group_id`, keeping D5's append-only spirit intact. Default workflow: vendor-rep requests, admin approves, then it executes. Admin can grant a per-employee exemption (`users.can_self_reverse`) allowing trusted reps to self-execute without approval — the admin is still notified either way. | LOCKED |
| **D23** | **Multi-warehouse schema ships in Mode B, with warehouse-scoped (not shared) catalogs.** Not "multi-store" — this business has no retail store concept at all (D29). A `warehouses` table plus `warehouse_id` threaded through `locations` and onward to `batches`/`movements`/`sales` as needed. Each warehouse has its own `vendors` and `skus` — fresh produce needs the warehouse close to the point of sourcing/delivery, so a shared central catalog was explicitly rejected. The admin needs **aggregated visibility across all warehouses**, not per-warehouse-only views — that cross-warehouse dashboard is part of this decision, not a later add-on. Multi-warehouse dashboards, notifications, and the super-admin role (§B) are built now but hidden behind a feature flag until a second warehouse actually exists — same pattern as the existing `VITE_DEMO_MODE` flag. **Not** a duplicate-tables-per-warehouse design and **not** sharding. | LOCKED |
| **D24** | **GST support ships as a dormant, parallel track, not deferred entirely.** Fresh, unprocessed, unbranded fish is GST-exempt in India; frozen/processed seafood is not. The non-GST track stays active; a GST-compliant track (customer-level GST fields, export-to-Tally shape) is built alongside it now but stays inactive until the business needs it or the rules change. The wholesaler's actual GST-registration status is not yet known (open question, carried forward from `client-qa/qa-container-model.md`) — this dormant-track design means the answer doesn't block Mode B build work either way. | LOCKED |
| **D25** | **Incomplete data warns; it never blocks a core mutation.** A missing receiving photo, an incomplete customer record, or a missing payment-proof photo never stops a purchase order, bill, or sale from being recorded. Missing fields get flagged in a report addressed to whoever entered the incomplete record, for the admin to follow up as a task. Applies to every soft-gated field introduced in this amendment (§B). | LOCKED |
| **D26** | **Google Looker Studio is the self-service reporting tool, not a custom-built report screen.** Free tier, native PostgreSQL connector, fully Google-hosted — no new server. The admin gets a dedicated read-only Postgres role; Postgres-level RLS must be configured on that role explicitly. **Reports and dashboards are confirmed real V1 deliverables, and specifically need to work on the client's mobile device** (D18) — not just be viewable from a desktop browser. | LOCKED |
| **D27** | **Notification visibility is scoped to the role held at the time the notification fired, not retroactively.** A role change is not backfilled onto old notifications, and old notifications are not re-surfaced under a new role. Requires tracking role history (§B). Delivery: full detail in-app; a periodic summary via native push (FCM/APNs) and WhatsApp — **confirmed real V1 mobile scope**, not deferred infrastructure (see D18, D26). | LOCKED |
| **D28** | **One mobile app, single login, role-gated views — not separate apps per role.** Researched 6 comparable products (Zoho Inventory/Zoho ERP, Odoo, Square, Cin7 Core, Onfleet/Bringg, inFlow/Unleashed); every one keeps office/admin/management/sales roles on one shared, login-gated surface, and products that tried splitting management-tier roles into separate apps (Bringg's standalone Dispatcher app, Unleashed's separate Sales app, Square's per-vertical apps) have walked it back. Admin, the co-admin, and the vendor-rep share one app — required for the co-admin's "take over whenever required" need (D18). The admin explicitly wants this: feature-packed, not spread across apps he'd have to hop between. **The one consistently-justified split is task/device-context, not role**: the haul/delivery worker's screens are deliberately built minimal and task-focused (scan/confirm-shaped, matching the driver-app pattern every field-work-adjacent product researched converges on — see D30), not a shrunk admin view — isolated enough that a genuinely separate lightweight app later is cheap if real field use demands it, without committing to a second Play Store listing/maintenance burden now. | LOCKED |
| **D29** | **Supersedes D9. There is one warehouse. No retail store, no display counter, no freezer.** Confirmed directly from the business's real operation: stock sits in thermocol containers packed with ice inside one warehouse (D21); staff are sent out to source fish and sent out again to haul fish to buyers — there is no walk-in-customer/display-counter retail model, and D9's "storage + display" locations and the freezer sub-area were both guesses that don't correspond to reality. A sale draws directly from a container's remaining stock; the fish leaves with whoever is hauling it to the buyer. **Practical schema consequence:** for the current single-warehouse reality, the `locations` table holds one real row (kind `warehouse`); the `transfer` movement kind is repurposed for the genuinely-future multi-warehouse case (D23) rather than a same-site storage→display move that doesn't exist; day-to-day container-to-container consolidation within the one warehouse is `repack` (§C.3), which already existed in the amendment for exactly this shape. §2.5 and §2.7 are revised accordingly. | LOCKED |
| **D30** | **Supersedes D6's "no offline write-queue in V1" for the worker role in Mode B.** D6's original V1 stance assumed "the wholesaler has reliable shop WiFi" (this file's own closing notes flagged this as an assumption to revisit "if Mode B reveals the worker genuinely needs to record picks offline"). D29 resolves that conditional: the worker's real job is hauling fish to buyers in the field, not working at a fixed WiFi-connected counter. Real offline write support — queue writes locally, sync and resolve conflicts when connectivity returns — is now confirmed Mode B scope for the worker role, not a hypothetical V2 problem. This file's own prior warning stands and should not be undersold: the cost (a real write-queue, conflict resolution, sync UX) is significant, not a small add-on. `docs/OFFLINE-WRITE-QUEUE.md` (referenced by §9 since W1, never written) should be authored as part of this work, not left as a forward-reference indefinitely. | LOCKED |
| **D31** | **No price/rate value is ever pushed to a customer automatically.** The wholesaler's current khata app broadcasts a notification to buyers whenever "the price of fish" is updated — he dislikes this, because he needs to sell at differential rates and give discounts per buyer, and a broadcast price update undermines that. Checked against this app's actual code: `SaleForm.tsx` already captures `sale_price_per_kg` per-transaction, manually typed, never a published "current price" — this app never had the khata app's problem structurally. This decision makes that explicit and permanent rather than an accidental byproduct: sale price is always entered per-transaction, privately negotiated, never inherited from a standing current price and never broadcast. `price_history` (D8) stays analytics-only, admin-facing, never customer-facing. The notification taxonomy (§F) must never include a price-change trigger — binding on D20's WhatsApp channel and D27's notification system both. | LOCKED |
| **D32** | **Container quantities are wholesaler-entered data, not a spec fact — resolves the "box/container quantities" item closing §D flagged as open.** The admin registers how many containers of each size he actually owns himself, through the app; a bulk "register 6 of the 10kg size" action is a convenience over 6 individually-numbered rows (§4.2.11 still requires per-box identity — needed for the QR-tag idea and for `container_fills` to track each physical box's own shelf-life clock), not a switch to an untracked aggregate count. Beyond the 5 standard presets (5/10/15/20/25 kg), a custom size can be registered the same way — `containers.capacity_kg`'s CHECK constraint changes from the fixed set to `> 0`. A container can never be deleted once it has ever held a fill (already true via `container_fills.container_id`'s `ON DELETE RESTRICT`, since migration 0006 — previously unreachable either way since no DELETE policy on `containers` existed at all; a DELETE policy is added so a never-filled container actually can be removed, while the existing FK keeps blocking one with any fill history). Both `container_number` and `capacity_kg` stay editable via the existing `containers_update_admin` policy — no change needed there. | LOCKED |
| **D33** | **Credit terms: per-customer limit and period, derived outstanding-balance visibility, soft enforcement only.** `customers.credit_limit` (nullable — no value means no formal cap, not zero credit) and `customers.credit_period_days` (nullable — e.g. "due in 15 days") are admin-configurable per customer. A `customer_credit_status` view (derived, not stored, D17 — same discipline as `container_availability`) computes each customer's real-time outstanding balance (`sum(sales.total_amount) − sum(payments.amount)` across their sales, floored at 0 per sale), whether they're over their limit, and days-overdue on their oldest unpaid sale. **Deliberately soft — the sale-recording RPC does not change at all.** Matches D25's existing principle ("incomplete data warns, it never blocks a core mutation") extended to this case: a customer over their limit gets flagged for the rep/admin to see, not refused service — the relationship matters more than a rigid rule at this business's scale, and the wholesaler explicitly asked to ship a real V1 attempt now rather than wait for client sign-off on the exact rule shape. | LOCKED |
| **D34** | **Inviting a genuinely new team member (someone who has never signed in) requires a Supabase Edge Function — never a client-side call.** Promoting an *existing* user's role (D28/decision #46) only ever needed a `users` UPDATE, already RLS-gated to admin/co-admin. Creating a brand-new, login-capable account is a different problem: it requires the Supabase Auth Admin API, which requires the service-role/secret key — a key that must never reach the client (§4.1's own words: "the publishable key is the only thing shipped in the JS bundle. The secret key never leaves the server" — a standing rule since W1, restated in `HANDOVER.md`'s gotchas with the consequence spelled out: a client holding the secret key can bypass the audit log entirely and the app's whole write-integrity model breaks). The only correct place for that key to be used is server-side, so this is a Supabase **Edge Function** — the first one this project has needed; every prior server-side piece of logic (§4.3's algorithms) has been a Postgres `SECURITY DEFINER` function instead, because none of them needed anything beyond the database itself. The function verifies the caller is really admin/co-admin using the caller's *own* JWT (a client scoped to their `Authorization` header, so `current_user_role()`/RLS apply naturally — no separate authorization logic to get wrong), then uses a second, service-role-scoped client, **created only inside the function, never returned to the caller**, to send the invite. See §4.3.12 for the exact workflow. | LOCKED |
| **D35** | **The `invite-user` Edge Function accepts an email invite OR a phone-based account, never both — and phone accounts activate immediately, they are not "invited."** Supabase has no phone equivalent of `inviteUserByEmail` — there is no password to set, so there is nothing to send a link to. The correct call for a phone-based account is `auth.admin.createUser({ phone, phone_confirm: true, user_metadata })`, which creates the `auth.users` row **already confirmed** (the admin is physically handing the phone to a real person and typing their number in, so admin-vouched confirmation is the honest model — not a security downgrade from the email path, just a different one: email trusts a link only the recipient's inbox can receive, phone trusts the admin's own eyes). From then on that person signs in with **no password, ever** — `signInWithOtp({ phone })` texts a one-time code, `verifyOtp` completes it, every single time. This is arguably the better fit for the worker role generically (D28's "even a 5th grader could use it" bar, restated by the actual client — nothing to remember or forget), not just a fallback for people without email. Both paths converge on the same, unmodified `handle_new_user()` trigger — it already reads `role`/`display_name` out of `raw_user_meta_data` regardless of which Admin API call produced the `auth.users` row, so no trigger changes are needed for this decision itself (only the schema fix below). **Real prerequisite, not a code problem:** an SMS provider (Twilio or similar) must be connected under Supabase Dashboard → Authentication → Providers → Phone before `signInWithOtp` can send a real text — `phone_confirm: true` account *creation* does not require it, but actual *sign-in* does, and unlike email, SMS is metered and costs real money per message (flagged as a standing gotcha since before this decision). **Real schema fix this decision requires:** `users.email` has been `NOT NULL` since `0001_init.sql`, which would silently break every phone-only account at the trigger level (an INSERT violating a NOT NULL constraint aborts the whole `auth.users` INSERT transaction) — migration 0014 makes `email` nullable and adds `CHECK (nullif(email,'') IS NOT NULL OR nullif(phone,'') IS NOT NULL)` so an identity of *some* kind is still guaranteed. The `nullif(...,'')` matters and was found by testing live against the real Admin API before writing this, not assumed: GoTrue itself represents "no email" (and "no phone") as `''`, not a true SQL `NULL`, on `auth.users` — the same historical convention `handle_new_user()` originally worked around with its own `coalesce(new.email, '')`. Migration 0014's trigger update normalises that `''` into a real `NULL` on `public.users` going the other way (`nullif(new.email, '')`), and the CHECK is written defensively against the same convention rather than trusting every future write path to have normalised first. **Also found live, cosmetic but worth knowing:** GoTrue stores and returns phone numbers **without** the leading `+` (`+919876543210` in, `919876543210` back out) — fine for `signInWithOtp` matching, but confusing to display raw, so the frontend re-prepends it for display only (`formatPhone()` in `src/lib/auth.ts`), never for comparisons or API calls. Every frontend read of `user.email` that assumed it was always present is corrected alongside (§4.2.1, §4.3.12). **Dev-to-real handoff, an operational step, not a feature to build:** during development the admin invites his own phone number to stand in for a worker account; before handing the app to the real client, that test account is either edited to the real person's number directly in the Supabase Dashboard's Auth → Users screen, or deactivated and a fresh phone-invite sent to the real number — no in-app "change phone number" UI is being built for this, a manual one-time Dashboard action is sufficient and appropriately rare. | LOCKED |
| **D36** | **Email invitation switches from Supabase auto-sending the email to the admin getting a shareable link back, which they deliver themselves.** `inviteUserByEmail` (D34) is replaced with `auth.admin.generateLink({ type: 'invite', email, options: { data, redirectTo } })` — creates the `auth.users` row exactly as before, but **sends nothing**; it returns an `action_link` that the Edge Function hands back to the admin, who shares it however suits the actual person (WhatsApp, SMS, in person) rather than depending on Supabase's own sending reputation reaching an inbox the person may not even check regularly. This directly retires the "known, accepted limitation" D34/§4.3.12 flagged (deliverability, spam filtering, no custom sending domain) rather than living with it — and matches how this business actually runs (the client's own khata app and this project's WhatsApp-automation track, D20, are the same instinct: WhatsApp is the real channel here, not email). **Does not extend to the phone path (D35) — a real, not cosmetic, scope boundary**: Supabase has no "generate a claim link, send nothing" primitive for phone: a phone account is already created with nothing sent at invite time (`phone_confirm: true`), and the SMS cost D35 already accepts is a **sign-in-time** cost (a fresh OTP every sign-in, structural to choosing OTP as the auth method), not an invite-delivery cost a link could remove. **Real prerequisite, found by checking, not assumed: this app has no deployed web URL at all yet.** `netlify.toml` and `docs/DEPLOY-NETLIFY.md` were written in W6 but the Netlify click-through was never done — `redirectTo` needs somewhere real to land the invited person on a "set your password" page. No native/Capacitor deep-linking is needed for this to work (a simpler shape than D35's OAuth-adjacent concern might suggest): the invited person completes the password step in their phone's ordinary browser against the deployed web/PWA build, then separately opens the real Android app and signs in fresh with the email/password they just chose — no session needs to carry over between the two. Supabase also requires the target URL to be allow-listed under Dashboard → Authentication → URL Configuration → Redirect URLs, or `generateLink`'s `redirectTo` is silently ignored in favour of the project's default Site URL — a real, documented rough edge (`redirectTo` correctness has open GitHub issues against Supabase's own auth service) to verify live once deployed, not assume works. | LOCKED |
| **D37** | **Supersedes D35's phone MECHANISM only (not its schema work) — the active phone-invite path is now password + shared link, the same shape as D36's email path, not OTP.** The user's own clarification: OTP (D35) is the eventual "full implementation," this is deliberately a lesser "graceful degradation" for now — no SMS provider needed at all, ever, for this path, at the honest cost of the person having a password to remember (the exact thing D35's OTP design existed to avoid; accepted knowingly, not overlooked). **The real mechanism, verified live against the real Admin API before writing this:** Supabase's link-generation (`generateLink`) only knows how to anchor a link to an *email* identity — there is no phone equivalent — so a phone invite now works by (1) generating an invite link against a **synthetic, never-shown email** deterministically derived from the phone number (`<digits>@phone.invalid` — `.invalid` is the IANA/RFC 2606-reserved TLD for exactly this "guaranteed never a real address" purpose; confirmed live that Supabase's own email validation accepts it, not assumed), (2) immediately attaching the **real** phone number to that same `auth.users` row via `admin.updateUserById(id, { phone, phone_confirm: true })` — confirmed live that one account can hold both an email and a phone identity simultaneously — then (3) **directly correcting `public.users`** (`email = NULL`, `phone = <the real digits>`) in the same Edge Function call, because `handle_new_user()` already ran at step 1 using the synthetic email and no phone yet, and step 2 (an UPDATE, not an INSERT) doesn't re-fire that trigger. **Step 3 is not optional polish — verified live that skipping it leaks the synthetic email straight into `public.users.email`**, which every display spot (`formatPhone`'s counterpart, the Team list, the header, the audit log) would then show verbatim, defeating the entire "the person never sees a fake email" premise. Sign-in becomes a **new, third mode**: phone + password, not OTP — the app derives the same synthetic email client-side (pure function of the phone number, no server round-trip, and not a secret — knowing it is equivalent to knowing the phone number; the password remains the actual credential) and calls ordinary `signInWithPassword`. **Nothing from D35's schema work is undone or wasted** — migration 0014's nullable `email`, the `users_identity_present` CHECK, and `handle_new_user()`'s phone-mirroring are exactly what this decision builds on; only the Edge Function's phone branch and the sign-in UI change. **D35 itself stays fully documented, not deleted** — its OTP code/design is the specified path to return to once there's an actual SMS budget and need; the active default is this decision until then. | LOCKED |
| **D38** | **A real invite link, clicked for real, exposed two problems D36/D37 hadn't hit yet: no page in the app ever handled an invite link at all, and Supabase's own `action_link` collides with this app's hash-based routing.** Verified live (the user actually clicked a generated link) rather than assumed: it landed back on the sign-in screen, no error, no password step. Root-caused two ways, not guessed: (1) `App.tsx` had a single unconditional `if (!session || !user) return <SignInForm />` — there was never a route or component anywhere that read an invite link's tokens and showed a "set your password" step, a genuine gap in what D36/D37 built, not something that regressed. (2) Independently, verified via two separate calls (a plain GET of the link with redirects disabled, and a direct `POST /auth/v1/verify` with the token) that Supabase's own redirect mechanism delivers session tokens in the URL **fragment** — the exact same `#` this app's hash router reads as a route — a structural collision, not a config mistake either side could just tweak away. **Fix:** the Edge Function no longer hands back Supabase's `action_link` (`supabase/functions/invite-user/index.ts`'s new `ownInviteLink()`) — it constructs a link into the app's *own* hash route instead, `#/accept-invite?token_hash=...&type=invite`, carrying the token as an ordinary query string HashRouter already parses correctly. A new page, `src/pages/AcceptInvite.tsx`, calls `supabase.auth.verifyOtp({ token_hash, type })` itself, client-side — OTP-style verification, not an OAuth code exchange, so it works identically regardless of which auth flow (implicit/PKCE) the Supabase project happens to be configured for, sidestepping the fragment collision entirely rather than working around it. `App.tsx` checks for this route **before** its normal signed-in/signed-out branch, deliberately — `verifyOtp` establishes a real session before a password is set, and the normal router would otherwise treat that session as finished and route straight to a role dashboard, skipping the password step. **A separate item, found live and reported honestly rather than left implicit — and, this same session, root-caused precisely: not a Supabase setting after all, see D40.** The invite token itself was independently observed failing with `otp_expired` immediately after generation, via two different verification paths; this decision's original text called it "most likely a Supabase project-level setting, not a code defect on either side of this fix" — checked against the user's own Rate Limits screenshot (ruled out: no limit anywhere near zero) and then isolated precisely by testing the email path (works, zero issues) against the phone path (fails, always) side by side. It was a real bug in D37's own write sequence, not a Dashboard setting. See D40. | LOCKED |
| **D39** | **This app has exactly one client, always in Tamil Nadu, always `+91` — country codes are removed from every phone-facing screen, and sign-in becomes one field instead of a method tab.** Real user feedback, not a guess: typing a bare 10-digit number into the invite form silently disabled the submit button with nothing on screen saying why (already partially addressed by a same-session fix adding a live validation hint) — but the deeper ask was to remove the requirement entirely, since asking a non-technical user in a single-country, single-client app to type a country code they don't think of themselves as having is pure friction with no real benefit here. `normalizeIndianPhone()` (`src/lib/auth.ts`) auto-derives full E.164 from a bare 10-digit number (or an already-prefixed one) before it's ever validated or sent — the backend contract (`E164_RE` in the Edge Function) stays strict, standard E.164; only the UI layer bakes in the India-only assumption. Applied in both directions: `TeamManagement.tsx`'s invite form (admin-facing) and `SignInForm.tsx` (everyone-facing). **Also folded in, same request:** `SignInForm.tsx` collapses from two tabs (pick email or phone, then fill in the matching form) to one identifier field that auto-detects which kind it is (an `@` means email, otherwise it's normalized as a phone number) — a method choice the person shouldn't have to make before they've even typed anything. The invite form's two explicit methods stay separate and unmerged, deliberately — that's the *admin's* choice about how a specific person will authenticate, a decision that actually matters, unlike the sign-in screen where the system can just figure it out from what was typed. "Remember me" was asked for too — already correctly handled by the existing `persistSession: true, autoRefreshToken: true` Supabase client config (`src/lib/supabase.ts`), confirmed, not rebuilt. | LOCKED |
| **D40** | **The `otp_expired` failure D38 flagged as "probably a Supabase setting" was actually a real bug in D37's own write sequence — attaching the phone number via a second write, right after generating the link, invalidates that same link's token.** Corrected the same session, by isolating rather than continuing to guess: the user's own Rate Limits dashboard screenshot ruled out a near-zero limit (verifications: 360/hour, not the pathological value that theory needed); a direct test of the email path (D36 — generate a link, never write to the account again) verified clean, every time; the *exact same* synthetic-email mechanism on the phone path, with D37's original second write (`updateUserById` to attach the phone, called after `generateLink`) removed, *also* verified clean; putting that second write back reproduced the failure on demand. Confirms a real, sensible platform behaviour this project's own sequencing tripped over: a token issued against a user's old state stops being valid the moment that user record changes again — not a bug in Supabase, a bug in doing the write in the wrong order. **Fix:** the phone branch now calls `admin.createUser({ email: syntheticEmail, phone, phone_confirm: true, user_metadata })` — both identifiers set in **one** call — then `generateLink` for the now-already-existing user, and never mutates the account again. `role`/`display_name` moved to the `createUser` call's `user_metadata` (the second `generateLink` call no longer needs or sends `data` at all — confirmed live that omitting it doesn't clear what `createUser` already set). The public.users correction step (email → NULL, phone → real digits) stays exactly as D37 specified — `handle_new_user()` still fires once, at the single INSERT, against the synthetic email. Verified with a live, corrected `scripts/test-phone-password-invite.mjs`: the original version of that script proved the schema/RLS side correct and, in doing so, never once asserted the returned link's token actually verifies — exactly the gap that let this ship undetected until a human clicked a real link. The corrected script's final, decisive assertion is that the link's token verifies successfully end to end, not just that the surrounding writes succeeded. | LOCKED |
| **D41** | **The V1 sprint's first finding: the entire CRM layer built in Mode B (`customers`, `payments`, `reversal_requests`, `bills`, `notifications` — migrations 0012–0013, D22/D24/D27/D33) had a fully tested backend and zero frontend anywhere.** Confirmed mechanically before building anything, not assumed from the schema alone: `grep -rln "from('customers')" src/` and the equivalents for the other 4 tables all returned nothing, and there was no corresponding page in `src/pages/`. A sale could be recorded with a free-text buyer name only — nothing could link it to a real customer, show a balance, take a payment, or request/execute a reversal through the UI. **Closed this sprint, in priority order (customers → payments → reversals; notifications and bills deferred):** `record_container_sale` gains an optional `p_customer_id` (migration 0015, backward-compatible — appended, defaulted parameter; a one-off buyer with no formal record still works exactly as before); a new `execute_sale_reversal` RPC (migration 0016) implements the execution algorithm D22/§4.3.11 always specified but migration 0012 deliberately left unbuilt — restoring `batches.kg_remaining`/`container_fills.kg_remaining` explicitly, because `apply_movement_to_batches` (0001) only fires on `kind IN ('transfer','sale','spoilage')`, not `'reversal'` (confirmed by reading its actual source, not assumed); `CustomerManagement.tsx`, `PaymentManagement.tsx`, `ReversalRequests.tsx` give this a UI for the first time, following the same "even a 5th grader could use it" bar as `SkuManagement.tsx` (name + phone up front, the rest behind "More settings"; GST fields stay dormant per D24). Per-sale payment balance is computed client-side from `sales` + `payments` (the `customer_credit_status` view only aggregates per customer, by design) — a read-time computation for display, not a new source of truth, matching D17's "derived, not stored" spirit. Routed at `/customers`, `/payments`, `/reversals`, scoped to `admin, co-admin, vendor-rep, super-worker` — deliberately broader than the admin-only SKU/Warehouse/Team pattern, since reps are the ones actually meeting buyers day to day. **Notifications (nothing writes to that table anywhere yet) and Bills (no UI) are explicitly deferred to a later part of the same sprint**, in that order, per the sprint's own stated priority — not overlooked. See BUILDER-DECISIONS-REVIEW.md decision #61 for the full build record, including the return-shape mismatch caught before finalizing migration 0015 and the live PostgREST FK-embed verification behind `ReversalRequests.tsx`'s query. **Corrected same sprint, before anything reached the live database (decision #62):** the first pass had request-creation as a plain client insert defaulting to `status='requested'` always, missing §4.3.11 step 2's actual requirement — a `can_self_reverse` requester's request auto-approves *at creation*, server-side (a new `request_sale_reversal` RPC, migration 0017), not via a later self-execute click on a still-`requested` row. | LOCKED |
| **D42** | **Notifications, scoped to exactly the one rule SPEC.md actually locks: §4.3.11 step 2's "admin/co-admin is still notified regardless."** Re-checked what this document itself specifies before building anything wider — the "§F taxonomy" and "core transactional subset" referenced elsewhere (§9) were never itemized beyond this one rule and D31's one exclusion (never a price-change type); a fuller taxonomy (low-stock, delivery confirmations, etc.) stays unbuilt rather than guessed at. `notify_admins()` (migration 0018) is a generic SECURITY DEFINER writer — one row per current admin/co-admin, `role_at_creation` from their real current role — called from `request_sale_reversal` for both the "needs review" and "auto-approved, FYI" cases. `src/components/NotificationBell.tsx` is a personal-inbox dropdown in the header, RLS-only (no new policy needed — `notifications_select_own`/`update_own` from migration 0012 already scope everything to the viewer). See BUILDER-DECISIONS-REVIEW.md decision #63, including a repeat of T8's exact `text-slate-400` contrast mistake, caught the same way, in a file built after that remediation. | LOCKED |
| **D43** | **Bills and the container-packing frontend are the same gap, not two — `container_fills.bill_id` is NOT NULL, so packing is structurally impossible until a bill exists.** §4.3.7 step 1's claim that the delivery flow "already" creates a bill was checked directly and found false (checked, not assumed): `batches.bill_id` had sat NULL on every row since migration 0006. New `record_bill_delivery` RPC (migration 0019) creates one bill + N SKU-line batches + movements atomically, replacing the old single-line, unlocked, no-bill `recordDelivery`; `DeliveryForm.tsx` (`/deliver`, same route) becomes a repeatable-line form. `record_container_fill` (migration 0007) gets its first-ever frontend, `PackContainerForm.tsx` (`/pack`) — inherently bill-scoped (pick a bill, pack some or all of its still-unpacked lines into a numbered container), with the "available to pack" amount computed client-side the same way the RPC's own double-allocation guard computes it, read from its actual source rather than re-derived from memory. `BillsManagement.tsx` (`/bills`) lists bills and lets admin/co-admin mark one shared back to the vendor (§4.2.14's `share_status`, not anything customer-facing) — recording that it was shared, not sending anything (D20's separate automation track). See BUILDER-DECISIONS-REVIEW.md decision #64, including a nested-`<label>` interaction bug caught before committing. | LOCKED |
| **D44** | **Search, phase 1 — fish/customer/vendor/employee "cards," scoped with the user before building: most of it is free (existing data), the rest genuinely needs new schema not built yet.** The user proposed a much larger vision (employee hours/tasks/ratings/pay, vendor quality ratings, WhatsApp message templates, customer complaints) and explicitly invited more suggestions; rather than guess at scope for a brand-new feature area, asked two direct questions first — employee "money due" stays admin-entered, not computed from hours (no payroll math), and the vendor-credit mirror (what we owe vendors, symmetric to `customer_credit_status`) gets built now. Client-side fuzzy search (`Fuse.js`, `src/lib/search.ts`) over the small identity tables (`skus`, `customers`, `vendors`, `users`) handles English/Tamil/Tanglish fish-name variants without any new backend infrastructure — deliberately not a Postgres extension, since none of these tables will realistically outgrow a client fetch for a single-warehouse wholesaler. `FishCard`/`CustomerCard`/`VendorCard` are built entirely from existing data (current stock, purchase history, credit status, full sale-to-vendor-to-employee traceability); `vendor_payments`/`vendor_credit_status` (migration 0020) is new, approved. `EmployeeCard`'s activity summary (deliveries/sales/etc. recorded) is existing data; check-ins, task delegation, and performance ratings — the parts of the user's own "activity tracking" answer that need new schema — are explicitly NOT built this pass, flagged visibly in the card itself rather than silently omitted. Vendor quality-per-fish ratings, message templates, and complaints stay unbuilt too — suggested, never confirmed as wanted. See BUILDER-DECISIONS-REVIEW.md decision #65. | LOCKED |
| **D45** | **A direct §8 audit found two genuinely un-built V1-locked deliverables — D26 (Looker Studio) and D20 (WhatsApp) — and closed both, D20 as an explicit "lite" scope, not the full spec.** D26 built as specified: `looker_studio_readonly` (migration 0022), a `BYPASSRLS`, `SELECT`-only Postgres role (`docs/LOOKER-STUDIO-SETUP.md` covers the connection walkthrough and the password, which — like every other secret in this project — is never committed). D20's full text ("WhatsApp Business Cloud API... outbound-only") stays the eventual target, but the user explicitly chose a lighter interim scope: compose real message text, hand it to the OS share sheet or let the person copy it — no Meta business verification, no API tokens, no template pre-approval. `src/components/ShareComposer.tsx` extracts the pattern already proven in `TeamManagement.tsx`'s invite panel (decision #59); wired into `VendorCard.tsx` (fixed English message templates — deliberately not yet owner-customizable, deliberately not translated into Tamil/Tanglish, since vendor-facing wording needs the client's real approved phrasing) and `BillsManagement.tsx`'s WhatsApp share path (composes the bill's actual line items, not just its stored total). See BUILDER-DECISIONS-REVIEW.md decision #67. | LOCKED |
| **D46** | **D27's notification taxonomy grows along a deliberate 3-track split — the user picked Track A (more event notifications) to build first.** Track A: same shape as the existing reversal-request bell, no new infrastructure — `bill_received` and `customer_over_limit` (migration 0023), both genuinely event-triggered. Track B (deferred): a per-bill/per-sale status *tracker*, the user's own Amazon-package-tracking analogy — mostly a UI feature over timestamps that already exist, not really a push notification. Track C (deferred): a periodic store-stats digest, which needs a real schedule (`pg_cron` or similar) — genuine new infrastructure, not just a query. A third Track A candidate — "a container nearing expiry" — was proposed then deliberately dropped: expiry approaches with the passage of time, not an action, so it structurally belongs to Track C's schedule, not Track A's event-triggered shape. `src/components/NotificationBell.tsx`'s single shared link became a per-type `TYPE_INFO` map (text + destination), matching its own prior comment anticipating this. See BUILDER-DECISIONS-REVIEW.md decision #68. | LOCKED |
| **D47** | **Employee tracking, phase 1: check-ins (no manual button, ever) and task delegation — backend only, from a real design conversation, not a guess.** `check_ins`: `ensure_checked_in()` computes the work day server-side in IST (not trusted from the client), writes one row per employee per day the first time they open their task view — no client-writable path exists at all. `tasks`: `type` (delivery/sale/pack-repack/custom), assignable manually (admin picks from an as-yet-unbuilt "large icon" employee grid) or via `create_task_round_robin()` — implemented as least-currently-loaded, not literal cyclic rotation, a deliberate and flagged interpretation of "round robin." An employee can hold several tasks at once (confirmed, not assumed); time-per-task is plain wall-clock with a concurrent-task count as context, not a fabricated effort-split — resolving the user's own flagged uncertainty by choosing an honest simple metric over false precision. `auto_complete_task()` is wired into `record_bill_delivery`/`record_container_sale`/`record_container_fill`/`record_repack` (all 4 already-live, re-issued fix-forward) so the 3 non-custom task types complete themselves from the same action that fulfills them — no "mark complete" button needed for those; `custom` tasks (no underlying action to hook into) complete via a plain client update instead. Performance rating and wage-tier suggestions are a deliberate, separate follow-up — they need real task data to mean anything, and wage-tier ₹ amounts are a business decision only the wholesaler can set. See BUILDER-DECISIONS-REVIEW.md decision #70. | LOCKED |
| **D48** | **A second warehouse now genuinely exists, and it found a real bug on first use.** Seeding a full-feature demo dataset (the user's own request — every warehouse, customer, task, bill, reversal, and payment feature exercised at once, via the real RPCs, not hand-crafted SQL) hit `PGRST203`: two live overloads of `record_container_sale`, because `CREATE OR REPLACE FUNCTION` only replaces a function with the exact same parameter list, and migration 0015 added a parameter without dropping migration 0009's original 6-parameter signature. Checked whether this was systemic before assuming it was isolated — every other function that gained a parameter across this sprint's fix-forward pattern kept its exact signature on every re-issue; only this one actually changed shape. Confirmed the real frontend was never affected (`mutations.ts` always sends `p_customer_id`, even as `null`, never omits the key) — fixed in migration 0026 (`DROP FUNCTION IF EXISTS` on the stale 6-parameter signature). Two warehouses now exist: `Demo Warehouse (feature showcase)` (the original, renamed) and `Real Operations` (new, one `kind='warehouse'` location per §8.15a, reserved for the real imported client data). `scripts/seed-demo-showcase.mjs` populates the demo one — and, while building it, surfaced a second real, deliberately-unfixed finding: reversing a sale doesn't currently reduce what `customer_credit_status` computes as owed (the view sums every sale's `total_amount` regardless of reversal status), a real gap for later, not papered over in the demo data itself. See BUILDER-DECISIONS-REVIEW.md decisions #73-#74. | LOCKED |
| **D49** | **Customer complaints/returns close the reversal-money gap D48 flagged, by reusing existing mechanisms end to end rather than inventing parallel ones.** A real design conversation, not a guess — including one directly blocking policy question asked and answered before writing schema: a false claim can be refused outright by the admin, not always refunded. Both the confirmed-good and confirmed-bad portions of a return are restored to their *original* batch/container_fill first (proportional, mirroring `execute_sale_reversal`'s own loop) — preserving the fish's real age, the same principle repack/transfer already use, which also means returned-but-fine stock is automatically first in line for resale via the existing FIFO/expiry cascade, no new priority field needed. The confirmed-bad share is then immediately spoiled back out in the same proportion. The rejected share never touches stock. The refund is a plain `payments` row (`method='return_credit'`) — a refund reduces what's owed the same direction a payment does, so `customer_credit_status`'s existing math needs zero changes to account for it. `customer_complaint_summary` answers "how many false claims from this buyer" directly. See BUILDER-DECISIONS-REVIEW.md decision #75. | LOCKED |
| **D50** | **Returned-and-restocked fish never goes back into a container — a fresh batch row, back-dated with a worst-case unrefrigerated shelf-life penalty, instead.** The user found a real bug: a container's physical box gets a brand-new `container_fills` row every time it's (re)filled, so restoring kg into the *original* fill row (D49's first design) could make two fill rows claim stock in the same physical box at once if that container had since been reused. Fixed by sidestepping containers entirely — the confirmed-good portion becomes a fresh `batches` row, attributed to the oldest batch the sale drew from, with `delivered_at` pessimistically back-dated: normal (1×) aging to the sale, then an accelerated rate (`p_unrefrigerated_multiplier`, default 3 — an adjustable policy number, not a scientific constant) for the time it sat with the customer, worst case assuming no refrigeration. Confirmed-bad kg no longer gets a synthetic "restore then spoil" movement pair — it never re-enters inventory, so it stays a plain number on the complaint. Also caught, one migration after the lesson: adding a parameter to the already-live `resolve_customer_complaint` required an explicit `DROP FUNCTION` on the old signature, the exact overload-bug class D48 had just fixed. See BUILDER-DECISIONS-REVIEW.md decision #77. | LOCKED |
| **D51** | **Cross-warehouse transfer was completely unusable before this fix — checked who could actually reach the screen before running the first real test, and the frontend/backend role sets had zero overlap.** `App.tsx`'s `/transfer` route had been left at its pre-D29 scope (worker/super-worker/vendor-rep); `rls-policies.sql`'s own comment confirms D29's real decision — admin/co-admin only, a cross-warehouse action, no longer a routine worker/rep task. No role could have ever successfully submitted a transfer, invisible until now because nothing exercised the path for real before a genuine second warehouse existed. Fixed: route re-scoped, the dead-end link moved from Floor/Rep dashboards to Admin's. Also implemented §8.15b for the first time — transfer is now actually rejected between two locations in the same warehouse at the database level, not just described as a rule. See BUILDER-DECISIONS-REVIEW.md decision #78. | LOCKED |
| **D52** | **A task orphaned by a role change is now force-reassigned, not left invisible.** `/my-tasks` is route-gated to the 3 operational roles; nothing previously reassigned or flagged a still-`pending`/`in_progress` task if its holder's role changed away from all three, or their access was turned off — the row just sat there, unreachable by them and invisible to everyone else except incidentally in the 20-most-recent delegation feed. Fixed with a trigger on `users` (not a new wrapping RPC — `TeamManagement.tsx`'s own write is a plain table `UPDATE`, and a structural invariant that must hold regardless of call site is this project's trigger territory, per `apply_movement_to_batches`'s own precedent): on any role/active change that makes someone newly ineligible, every open task still assigned to them is handed to the least-currently-loaded active employee actually eligible for that task's specific type (`eligible_roles_for_task_type()`, D47/migration 0025 — reused exactly, not reimplemented). If no eligible candidate exists at all (a single-operational-employee shop), the task is left exactly as it was — a genuine "someone has to look at this by hand" case, not silently hidden. Admins are told via a new `tasks_reassigned` notification. See BUILDER-DECISIONS-REVIEW.md decision #79. | LOCKED |
| **D53** | **In-transit is a real, tracked physical stage, not a data-entry nicety — fish can spoil during either leg.** Confirmed directly from the business: the same thermocol/ice containers used at rest also travel, both inbound (vendor's pickup point → the warehouse door) and outbound (warehouse → buyer). Modeled as two new `locations.kind` values (`in_transit_inbound`, `in_transit_outbound`), one warehouse-scoped pair auto-provisioned per warehouse by a trigger on `warehouses` INSERT — `WarehouseManagement.tsx`'s existing "+ Add warehouse" form needs no change to get this. The 2 existing warehouses were backfilled. Deliberately excluded from every existing location picker (`LocationSelect` in `FormFields.tsx`) by default — none of the 5 existing operations (deliver/sell/pack/repack/transfer) should target a travel leg yet; only a future confirm-arrival/checkout screen will. This is the small, non-blocking half of a larger request — the receiving-confirmation workflow (promised-at-pickup vs measured-at-arrival, finally building `receiving_confirmations` from §4.2.15, spec'd since the D-amendment but never actually created per migration 0006's own comment) and the outbound checkout question are held pending two real business-policy answers. See BUILDER-DECISIONS-REVIEW.md decision #80. | LOCKED |
| **D54** | **Receiving confirmation built for real: promised-at-pickup vs measured-at-arrival, with the physical/money split the business actually wanted.** Two blocking questions asked and answered directly, not guessed: (1) discrepancy handling is "case by case, reconciled by hand" — `batches.kg`/`kg_remaining` (physical truth) adjusts to the measured amount at `confirm_delivery_arrival` (migration 0032), but `bills.total_amount` (money owed to the vendor) is never auto-adjusted; a `delivery_discrepancy` notification surfaces it for the admin to settle by hand instead. (2) outbound transit needs no checkout stage — "today's one-step sale already matches reality" — so `record_container_sale` is untouched; that answer was a schema no-op. `receiving_confirmations` (§4.2.15) finally exists, adapted to be per-*batch* rather than per-bill as originally spec'd, since D43 later gave bills N SKU lines. `DeliveryForm.tsx` can now target an in-transit-inbound location; a new `/deliveries/confirm` page (`DeliveryConfirmation.tsx`) lists what's still in transit and confirms it. Found and fixed in the same pass: `/deliver` and `/sell` had drifted to `vendor-rep`-only on the frontend while their own RPCs have always accepted admin/co-admin/vendor-rep/super-worker — widened to match (the same bug class as D51's transfer mismatch, caught here before it produced a second unusable-to-some-roles screen). See BUILDER-DECISIONS-REVIEW.md decision #81. | LOCKED |
| **D55** | **Five small fixes from one round of feedback: can_self_reverse locked to admin/co-admin, task-completion notifications, container ownership, friendlier role labels shared from one source, and delivery-time spoilage split out from ordinary spoilage.** (1) `can_self_reverse` can now only be `true` on admin/co-admin — enforced by a trigger that auto-clears it the moment a role change would violate that, plus a CHECK constraint as a hard backstop; one existing violation (a vendor-rep from earlier demo seeding) was found and reset before the constraint could be added. Exposed in `TeamManagement.tsx` for the first time, only visible for admin/co-admin. (2) A new `notify_user()` (single-recipient sibling to `notify_admins()`) fires via a trigger on `tasks` the moment any task completes, regardless of which of the two completion paths did it — closes the "does the worker even know it's done" gap. (3) `containers.ownership` (`owned`/`vendor_provided`/`given_to_buyer`) — the user preferred this over their own floated QR-sticker "conceptual container" rethink; wired into `record_container_fill`'s existing inline creation path, exposed in `PackContainerForm.tsx`. (4) Role display labels (`RoleBadge.tsx`'s `ROLE_LABELS`, now exported and reused by `TeamManagement.tsx` instead of its own separate copy — the exact drift risk flagged when this was first discussed) describe what a role does, not its backend name: `vendor-rep` → "Receiving & sales", `worker` → "Floor staff", `super-worker` → "Senior floor staff" — backend role strings are completely unchanged. (5) `confirm_delivery_arrival` (superseding migration 0032, never edited in place per this project's append-only convention) splits a single confirmed-kg into confirmed-good and confirmed-spoiled — spoilage found the moment fish arrives is structurally distinct from ordinary in-warehouse spoilage (via `receiving_confirmations.spoiled_kg`, present by definition only for delivery-time spoilage) since it's far more likely the vendor's fault; the actual *weighting* of the two in a future vendor-quality score is deliberately left undecided — that feature doesn't exist yet — this only makes sure the right data is captured now. See BUILDER-DECISIONS-REVIEW.md decision #82. | LOCKED |

| **D56** | **Bill reconciliation, the missing "what did we actually decide" step D54's discrepancy detection always needed, plus the credit-purchase-deferred-reminder the user described.** `bills.payment_terms` ('cash'/'credit', default 'cash') set at delivery time. `reconcile_bill()` records what actually got settled — deliberately a SEPARATE field (`reconciled_total_amount`) from the original `total_amount`, never overwriting it, matching D54's "never auto-adjusted" stance — with two distinct modes, not one ambiguous form: settle now (a final figure + notes) or defer with a reminder (`reconciliation_reminder_at`, a plain future timestamp checked client-side against `now()` wherever `BillsManagement.tsx` already loads — no `pg_cron` dependency, consistent with this project's continued avoidance of that infrastructure for D27 Track C). `BillsManagement.tsx` surfaces a "Needs reconciliation" section for any bill with an unresolved delivery discrepancy or an overdue reminder. The WhatsApp share panel is now genuinely editable (a real textarea, not a static preview) with per-field toggles (prices, total) reflecting the user's own "flexibility in mind" — and can generate an actual receipt-style picture (`billImage.ts`, plain `<canvas>`, no PDF library) to share as a real file via the Web Share API alongside the text, or save/copy as a fallback. See BUILDER-DECISIONS-REVIEW.md decision #83. | LOCKED |

| **D57** | **The real client spreadsheet's item catalog (all 106 items) imported into a third, explicitly-provisional warehouse for development — not into "Real Operations."** Per the user's own framing: "the actual values can be another warehouse with no other detail filled in retroactively until client confirms." `scripts/seed-simulated-operations.mjs` reads `example-video/Weekly Report.xlsx`'s "Item report" sheet directly (real item names, Tamil script split out where embedded, real average purchase/sale ₹/kg derived from the sheet's own aggregate quantities/amounts) and creates: 106 SKUs (63 new, 43 matched an existing `english_name` and were reused rather than duplicated) with `category`/`size_grade` inferred by plain keyword heuristics — genuinely absent from the spreadsheet, honestly flagged in every new SKU's own `notes` field as a guess needing the wholesaler's confirmation, not disguised as fact; 5 generic vendors and 3 generic customers, explicitly named "unconfirmed"; 5 delivery bills (98 batches — items with zero recorded purchases in the sheet get a SKU row but no stock, matching reality) via the real `record_bill_delivery` RPC; 33 packed containers and 17 sales via the real `record_container_fill`/`record_container_sale` RPCs, all at the sheet's own real derived prices. Called at the RPCs' currently-live signatures (migrations 0030-0034's new optional parameters aren't live yet) — the same "call the real RPC signed in as a real account" discipline as `seed-demo-showcase.mjs`, not hand-crafted SQL. | LOCKED |

| **D58** | **A systematic frontend/backend parity audit — every client-facing RPC and every RLS-writable table diffed against what the frontend actually exposes, not another spot-check.** Found and fixed 4 real gaps. (1) `execute_sale_reversal`'s self-execute branch is dead code after D55's `can_self_reverse` restriction — simplified to admin/co-admin only (migration 0035); `ReversalRequests.tsx`'s "Execute now (self-reverse)" button, which could only ever 403 now, removed. (2) `record_container_spoilage`/`record_repack` have always accepted admin/co-admin too — `/spoil`/`/repack` widened to match, with an explicit admin back-link branch instead of falling into a vendor-rep/else split that predates their access. (3) **`vendors_insert_admin`/`vendors_update_admin` (RLS, since migration 0001) had no frontend at all** — `VendorSelect` is read-only; there was no way to onboard a new vendor through the app. New `VendorManagement.tsx` (`/admin/vendors`), same simplicity discipline as `SkuManagement.tsx`/`WarehouseManagement.tsx` (the two prior instances of this exact gap shape, D-amendment/decision #49). (4) `tasks_update_own_or_admin` (RLS) has always let admin/co-admin cancel or reassign any task, but nothing beyond the automatic force-reassign trigger (D52) ever exposed it — a plain "Cancel" action added to `TaskDelegation.tsx`'s recent-delegations feed. Every other client-facing RPC already matched its route/in-page gate exactly — checked directly, not assumed. See BUILDER-DECISIONS-REVIEW.md decision #85. | LOCKED |

| **D59** | **A real bug in `confirm_delivery_arrival` found live, on the first genuine end-to-end run of the in-transit/discrepancy workflow: both its movement INSERTs omitted `movement_group_id`, NOT NULL since migration 0001.** Every other multi-movement RPC in this project generates one (`gen_random_uuid()`); this one simply never did, and nothing caught it until the reseed script actually exercised the discrepancy path for real. Fixed (migration 0036, plain `CREATE OR REPLACE` — signature unchanged, no overload risk) by grouping the `receiving_confirmed` and (when there is one) `spoilage` movement under one new group id, matching this project's existing multi-movement-event convention. Also fixed, same pass: `seed-demo-showcase.mjs` reused fixed container numbers (`TC-DEMO-01`/`02`) across runs — if a reset pass ever left anything behind, the next run would silently pile a new fill onto the old container instead of erroring, the exact D50 container-reuse bug class from a stale row rather than a design gap. Now suffixed with a per-run id. See BUILDER-DECISIONS-REVIEW.md decision #86. | LOCKED |

| **D60** | **The HyperFrames feature-walkthrough video, planned since before V1 completion, built for real.** Per the plan already on record (Playwright drives the actual running app; HyperFrames composes the captures into a produced video): a Playwright script (`hyperframes-video/capture.mjs`) signs in as each real demo account and clicks through the actual app (not `page.goto` to deep routes directly — the app uses hash-based routing, so a fresh navigation to a path like `/bills` doesn't resolve the same way a real in-app click does; found live, fixed by navigating via real link clicks instead), capturing 15 real screens against the freshly reseeded Demo Warehouse data (admin dashboard, bills with a credit/reconciled bill, notifications including a real delivery-discrepancy alert, confirm-arrivals, reversals, receiving, packing, repacking, selling, tasks). A `hyperframes init` project (`hyperframes-video/jayshankar-walkthrough/`) composes them into a 49-second 1080p MP4 — a browser-chrome-framed screenshot per scene with a kicker/headline/subline caption, GSAP fade transitions, title and closing cards — passing `npm run check`'s full lint/runtime/layout/motion/WCAG-AA-contrast gate before rendering. Binary assets (screenshots, the render itself) are gitignored; the composition source stays tracked so it's reproducible from git alone. See BUILDER-DECISIONS-REVIEW.md decision #87. | LOCKED |

| **D61** | **Every V1 route captured and covered across three videos, not just the one core arc — per the user's own audit question ("are all possible scenarios showcased?").** Checked directly against `App.tsx`'s full route list (24 real routes): the first video covered 13; a second capture pass (`hyperframes-video/capture2.mjs`/`capture3.mjs`/`capture4.mjs`) captured the remaining 10 route groups plus deeper, feature-specific states the list-only views didn't show (the actual pack sub-form, the WhatsApp share compose panel, the bill reconcile panel with a real credit bill, the four search result cards, a customer/admin-tier team-edit showing both the self-account warning and the `can_self_reverse` checkbox together, a customer selected in Payments). Two new videos — "Admin & Setup" (fish types, warehouses, vendors, team, audit log, task delegation, transfer, spoilage) and "Money, Trust & Search" (customers, payments, complaints, bill sharing/reconciliation, all four search cards) — built from a shared generator (`hyperframes-video/gen-composition.mjs` + per-video `config-*.json`) rather than hand-duplicating the first video's HTML, so the same lint/contrast fixes apply automatically to every future video. All three videos together now touch every route in the app at least once. See BUILDER-DECISIONS-REVIEW.md decision #88. | LOCKED |

| **D62** | **Real screen-recorded tutorials, not composed screenshots — a genuinely different production style, per the user's own reference video.** Playwright's `recordVideo` context option (not screenshots) captures two full, realistic workflows against the real app and real demo data: `record-scenarios.mjs` signs in as the rep, types every field with visible per-character delay, and submits for real — "Record a Purchase" (18.9s, two fish lines on one bill) and "Record a Sale" (14.5s). Each becomes its own HyperFrames tutorial: the real recording plays inside the same browser-chrome mockup used elsewhere, with caption callouts timed against the actual recorded moments (verified by extracting and reading real frames, not estimated from the script's own wait-timings) — matching the reference's own style of explanatory captions over a live recording rather than a static feature tour. A real renderer-breaking bug was caught by `npm run check` before rendering: a `<video>` element with no `id` attribute renders frozen (HyperFrames' own documented gotcha) — fixed immediately. See BUILDER-DECISIONS-REVIEW.md decision #89. | LOCKED |

### 0.2c Supersession map, and what this document does not yet say

*Added 2026-10-02. This is a reading aid, not a decision: **no row in §0.2 was changed to write it.** The base
text of this file is layered — Mode A text plus later addenda — so a few rows and sections are corrected by
later ones without being rewritten. Where two statements disagree, the later decision wins.*

| Row / section | Corrected by | What changed |
|---|---|---|
| D6 (no offline write-queue) | **D30** | worker-role offline writes are Mode B scope — **decided, not built** (§8.16 is unmet) |
| D9 (two locations) | **D29** | one warehouse; no display counter, no freezer |
| D13 (iOS out of scope) | **D18** | iOS is in scope, Android first |
| D15 (no CRM, no GST) | D24, D33, D41, D49 | CRM, credit terms and a dormant GST track are built |
| §2.1 route map | `src/App.tsx` | the real routes are `/deliver`, `/sell`, `/pack`, `/repack`, `/spoil`, `/transfer`, `/customers`, `/payments`, `/reversals`, `/bills`, `/complaints`, `/my-tasks`, `/admin/*`, `/search/*`, `/learn`, … — the Mode A map in §2.1 is history |
| §2.10, §2.11 | D28, D29, D30 | written before the one-warehouse and worker-offline decisions |
| §4.2.2 `locations.kind`, §4.2.6 `movements.kind` | D29, §2.7.1, §4.2.21 | `storage`/`display`/`freezer` are retired vocabulary; movements have six kinds |
| §8.5b, Appendix A | D29 | the 3-location demo seed is history; do not use it to model Pilot data |
| Notes B, C (reliable WiFi, read-only offline) | D30 | resolved |
| D4 "explicit DELETE policies" | D32, §3.8 | `containers` has the one DELETE policy; everything else is soft-delete |

**Amendments — the owner's list of intended changes.** They exist as separate files because earlier sessions
did not follow the spec-first method; each is merged into this file only on the owner's go-ahead.

| Version | File | Rows | State |
|---|---|---|---|
| v1 | this file as first written | D1–D17 | superseded by v2 |
| v2 | `docs/deprecated/SPEC-AMENDMENT-v2.md` | D18–D27 | **merged** 2026-09-10 (`BUILDER-DECISIONS-REVIEW.md` #36) |
| v3 | `SPEC-AMENDMENT-v3-truckload.md` | D63–D66 | **live, unmerged** — and it conflicts with what Phase B built (`HANDOVER.md` W12) |
| v4 | `SPEC-AMENDMENT-v4-plan-md.md` | D67–D76 | **live, unmerged**, D67 open; merge order is v3 before v4 |

**Referred to above but never written:** `docs/OFFLINE-WRITE-QUEUE.md` (D30, §2.14, §9 say it should come
first), `ROADMAP.md` (Appendix B.3) and `scripts/import-legacy.mjs` (Appendix B.2). Do not look for them.

**Next free decision number: D77.** D63–D66 are reserved by v3 and D67–D76 are proposed by v4.

### 0.2b What this document is NOT

- It is not a sales pitch. §0.0 is the sales pitch (it's the ceiling, not the floor).
- It is not a roadmap. The Demo → Pilot → Production path in D7 is the constraint; the timeline
  is the user's call.
- It is not a Supabase tutorial. The schema, RLS, triggers and auth flow are specified here;
  Supabase docs cover the framework.

### 0.3 Implementation baseline

*Corrected 2026-10-02 — this paragraph used to say "Not yet built", written before W1.* `HANDOVER.md` §3–§5
is the live state and the work queue; this paragraph only says what the spec's own claims rest on:

- **Built and applied to the live project:** migrations `0001`–`0036` (24 tables), RLS, the seed, the app
  (Mode A through the V1 sprint), the `invite-user` Edge Function, and the Android wrap.
- **Written and tested, not applied:** migrations `0037`–`0046` (Phase B). They are *not* described by D1–D62;
  they follow `docs/DECISIONS.md` #34–#40 and `docs/BACKEND-PHASE-B-STATUS.md`.
- **Decided but not built:** the worker offline write queue (D30, §8.16), QR scanning, a Tamil UI, approvals,
  WhatsApp via the Business API.
- **Built without a spec section:** the Phase A UI redesign (`HANDOVER.md` W11).
- The validator that enforces acceptance (`npm run validate`) is specified in §8 and exists.

### 0.4 What changed from the original brief

The original brief described a generic inventory app with SKU, quantity, weight. The interview
revealed:

| Original brief | Actual requirement | What changed |
|---|---|---|
| "SKU, quantity, weight" | Fish wholesale: SKU + batch + location + perishable + multilingual names | Schema is fish-business-shaped, not generic |
| "Admin adds/removes SKU and members" | Three role types: admin, vendor-rep, worker — with role-as-data (D3) | "Members" splits into `users` (staff) and `vendors` (fishermen) |
| "Vendor inputs and removes from stock" | Vendor-rep records incoming deliveries and outgoing sales | The "vendor" in the app is a role (`vendor-rep`), distinct from the `vendors` table (fishermen) |
| "Worker sees what to take from stock" | Worker has a transfer task: take X kg from storage to display | "Take from stock" is a transfer movement, not a sale |
| "Website, then Android, then iOS" | Web is the floor; Android is Phase 3 if/when client demands; iOS is YAGNI (D13) | Stack picks avoid iOS-specific constraints |
| "Sample data to check usability" | User does not own sample data; the demo must seed its own | D14 — seed data is part of the deliverable |

---

## 1. Description

Jayshankar is an inventory management **mobile-primary** app (D18) for a single-warehouse
fresh-fish wholesale-and-delivery business in Tamil Nadu (D29). There is no retail storefront:
fish is bought from fishermen, packed into ice-filled thermocol containers in one warehouse
(D21), and sold and hauled out directly to buyers by staff sent into the field — see §2.5a for
the plain-language container model. It tracks stock by container and shelf-life, records
purchases via vendor bills (§2.16), sales and payments to buyers (§2.18–2.19), prices stock per
batch (because different deliveries cost different amounts), and provides a role-based interface
for four user types: **admin** (the wholesaler) and **co-admin** (Jayshankar — inventory-focused
day to day, full admin capability, needs to take over completely from his phone whenever
required), **vendor-rep** (staff who handle purchasing and sales), and **worker** (staff who haul
fish to buyers and manage containers in the warehouse).

The product is aimed at four users, all primarily on phones (D18, D28):

- **Admin and co-admin**, on a phone first, with full desktop-equivalent capability available
  from a single app — not a stripped-down mobile view of a desktop-first product. Sees a
  dashboard of stock by container, recent activity, low-stock/expiring-soon alerts, the audit
  log, price history, bills, customers, payments/arrears, and reports (delivered to mobile —
  D26). In reality today, one person (the wholesaler) currently does dispatch, buyer
  negotiation/pricing, and manual least-shelf-life-first selling all himself — the interface
  should support that reality, not force rigid role silos onto how he actually works.
- **Vendor-rep**, on a phone. Records vendor bills (purchases) and receiving confirmations,
  records sales and payments to buyers.
- **Worker**, on a phone in the field. A deliberately minimal, task-focused surface (D28): which
  container to haul, confirm pickup/delivery, record spoilage/damage. Built for real offline
  tolerance (D30) — the worker is not at a fixed WiFi-connected counter, they are traveling.

The primary device target is a **mid-range Android phone from ~2021 running Chrome**, as in
the exam-forge spec. This is the worst device that must work. The app degrades to that device.

---

## 2. Functionality

### 2.1 Route map

| Route | Mode | Who | Purpose |
|---|---|---|---|
| `/` | — | All (redirects) | If logged in, redirect to the role's home. Otherwise login. |
| `/login` | — | Public | Email + password, or phone + OTP. |
| `/admin` | Admin | Admin only | Dashboard: stock by SKU, recent activity, low-stock alerts, price alerts. |
| `/admin/audit` | Admin | Admin only | Audit log: filterable by user, table, date, action. |
| `/admin/vendors` | Admin | Admin only | Vendor list, add/edit/deactivate fishermen. |
| `/admin/skus` | Admin | Admin only | SKU list, add/edit/deactivate fish. |
| `/admin/prices` | Admin | Admin only | Price history per SKU, set today's reference price. |
| `/rep` | Rep | Vendor-rep | Daily entry: "new delivery" + "record sale" + "today's batches". |
| `/rep/delivery` | Rep | Vendor-rep | Form: pick vendor, pick SKU, kg, price/kg, location. |
| `/rep/sale` | Rep | Vendor-rep | Form: pick display-stock SKU, kg, customer, price/kg. |
| `/floor` | Floor | Worker | "What to take from stock" — list of transfer tasks, confirm when done. |
| `/floor/spoilage` | Floor | Worker | Form: pick SKU + location + kg (FIFO computed). |
| `/floor/today` | Floor | Worker | Today's display counter contents, by batch. |
| `/me` | — | All | Logout, role badge, last sync time. |
| `/about` | — | All | Build info, schema hash, link to this spec. |

Routing is **hash-based** (`/#/admin`, `/#/floor/today`) so the app works on Netlify static
hosting without a server-side rewrite. Same as exam-forge.

### 2.2 Auth & roles

#### 2.2.1 Provider

Supabase Auth. Two methods, both available to any role:

- **Email + password** — account created via the `invite-user` Edge Function (§4.3.12, D34,
  D36); the invited person sets their own password via a link the admin shares themselves
  (D36 — not auto-sent).
- **Phone + password (D37, active mechanism)** — for workers by default (and available for any
  role), a deliberate "graceful degradation" of the OTP design below: same shared-link UX as
  email, via a synthetic email the person never sees (§4.3.12 step 4/D37), no SMS provider
  needed at all. The tradeoff, accepted knowingly: there is a password to remember, the thing
  the OTP design exists to avoid. **Phone + OTP (D35) is the specified "full implementation,"
  deferred, not deleted** — no password ever, a fresh SMS code every sign-in — revisit once
  there's an actual SMS provider budget/need; requires an SMS provider connected in the Supabase
  Dashboard before it can work at all. A WhatsApp-gateway alternative to SMS remains a real
  future option for the OTP design, not built now.

#### 2.2.2 Role assignment

Roles are **assigned by an admin**, not self-selected. The first user to sign up is bootstrapped
to `admin` by a one-time SQL trigger in `0001_init.sql`:

```sql
-- The first authenticated user becomes admin. All subsequent signups default to 'worker'
-- and require admin promotion. This is a one-time guard, not a runtime policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
begin
  select count(*) into user_count from public.users;
  if user_count = 0 then
    insert into public.users (id, email, role, created_at)
    values (new.id, new.email, 'admin', now());
  else
    insert into public.users (id, email, role, created_at)
    values (new.id, new.email, 'worker', now());
  end if;
  return new;
end;
$$;
```

A user is not "in" the system until their row exists in `public.users` (the auth user and the
app user are joined by `id`).

#### 2.2.3 Session

Supabase issues a JWT, stored in `localStorage` under `sb-<project-ref>-auth-token` (Supabase's
default). The session refreshes automatically. The app checks session validity on every route
change and on `visibilitychange` (returning from background).

#### 2.2.4 Frontend role split

The V1 frontend collapses `vendor-rep` and `worker` into a single `super-worker` dashboard
layout (D3a). The user sees a tabbed interface with the same shell; the tabs shown depend on
`users.role`. The backend policies distinguish them strictly. Splitting the UI is a V2 task.

### 2.3 Vendors (fishermen)

#### 2.3.1 What this is

A `vendor` is a fisherman or a fishing cooperative that delivers to the wholesaler. The
table is **separate from `users`** because vendors are not application users (they do not log in)
and the relationships are different (a vendor is a supplier, a user is staff).

#### 2.3.2 Fields

See §4.2.4 for the full schema. Summary: `id`, `name`, `phone`, `port_or_village`, `boat_name`
(optional), `typical_catch` (free text, what they usually bring), `reliability` (1–5, set by
admin), `active`, `notes`, `created_at`, `created_by`, `updated_at`, `updated_by`.

#### 2.3.3 Operations

- **Add** (admin only): form with name, phone, port, optional boat, typical catch, notes.
  Reliability starts at 3.
- **Edit** (admin only): all fields. Edits are audit-logged.
- **Deactivate** (admin only, soft delete): `active = false`. Past batches and sales still
  reference the vendor; they are not orphaned. A deactivated vendor cannot be selected in
  new delivery forms.

#### 2.3.4 RLS

- `SELECT`: any authenticated user.
- `INSERT`, `UPDATE`: admin only.
- `DELETE`: nobody. Soft delete only (per D5 immutability of past history).

### 2.4 SKUs (fish catalog)

#### 2.4.1 What this is

A `sku` is a fish type at a particular size grade. One fish species becomes multiple SKUs
(Pomfret Medium, Pomfret Large, Pomfret XL). The split is because size grade affects price and
how the fish is sold (per piece vs per kg).

#### 2.4.2 Fields

See §4.2.5. Summary: `id`, `code` (e.g. `FISH-POMFRET-MED-001`), `english_name`, `tamil_name`
(required field, may be empty), `category` (`fin_fish`, `shellfish`, `crustacean`, `cephalopod`,
`dried`), `size_grade` (`small`, `medium`, `large`, `xl`, `mixed`), `unit` (`kg`, `piece`,
`dozen`), `shelf_life_hours` (integer, default 24), `storage_type` (`chilled`, `frozen`,
`ambient`), `active`, `notes`, `created_at`, `created_by`, `updated_at`, `updated_by`.

#### 2.4.3 Operations

- **Add** (admin only). Code is auto-suggested from name + grade but editable.
- **Edit** (admin only). Editing `tamil_name` does not break batches; it updates everywhere.
- **Deactivate** (admin only). Past batches reference this SKU; the SKU is hidden from new
  delivery forms but its history is intact.

#### 2.4.4 RLS

Same shape as `vendors` (D4): SELECT for any authenticated, INSERT/UPDATE for admin, no DELETE.

### 2.5 Locations and warehouses (revised — D29 supersedes D9)

#### 2.5.1 What this is

A `location` is one warehouse (D29). **There is no `display` or `freezer` location** — those
were V1 guesses that turned out not to match the real operation; see D29 for the full
correction. For the current single-warehouse reality, exactly one `locations` row exists,
`kind='warehouse'`. If a second warehouse opens (D23), it is a second `locations` row, scoped
under its own `warehouses` row (§B.1) — the schema is multi-warehouse-ready from Mode B, with
the UI behind a feature flag until it's real.

#### 2.5.2 Fields

See §4.2.6. `id`, `warehouse_id` (FK → `warehouses.id`, D23), `name` (unique handle), `display_name`,
`kind` (`warehouse` — `storage`/`display`/`freezer` are retired vocabulary, kept readable in
historical data but not written by new code), `active`, `notes`, `created_at`.

#### 2.5.3 RLS

SELECT for all authenticated (scoped to their `warehouse_id` once multi-warehouse is live — D23,
§8.14a). INSERT/UPDATE for admin/co-admin. No DELETE (a location with history cannot be removed;
deactivate instead).

#### 2.5.4 V1/Mode B seed

One `locations` row, `kind='warehouse'`, under one seeded `warehouses` row. The historical Mode A
seed's `storage`/`display`/`freezer` three-location data is legacy demo content, not a model of
the real operation — do not carry that shape into Pilot's real data migration.

#### 2.5a The container model, in plain language

*(Required reading before touching any container/shelf-life code — assume no prior fish
wholesale knowledge; this is the section AGENT-BRIEF.md's documentation standard asked for; that brief is now `docs/deprecated/AGENT-BRIEF.md`.)*

The wholesaler buys fish from fishermen and packs it into **containers** — physical, numbered,
reusable insulated boxes (thermocol/styrofoam) packed with ice, in fixed sizes (5, 10, 15, 20,
or 25 kg). A container is loaded once, from one buying trip, and never mixed with a later
purchase. From the moment it's packed, the fish inside has a countdown clock: each fish type
(SKU) has a shelf life in hours; the container's expiry is set by whichever fish inside it goes
bad soonest.

Day to day, staff sell and haul fish out of these containers to buyers. The rule the wholesaler
already follows by memory — sell the container closest to spoiling first — is what the container
model makes systematic instead of relying on someone remembering correctly every time. That's
the entire point: `containers` + `container_fills` (§B.2–B.3) let the software always know which
container expires soonest, the same way the wholesaler already tries to.

Two things happen to a container over its life, beyond being sold from directly:

- **Repack** — when a container is mostly sold down and only a little fish is left, it's
  wasteful to keep using a big box for a small amount. A worker moves the remaining fish into a
  smaller, right-sized container. This never resets the freshness clock — the fish is exactly as
  old as it was before the repack, just in a smaller box (§C.3). This is the *common, everyday*
  container operation, since there's only one warehouse today.
- **Transfer** — moving a container's contents to a *different warehouse* (§4.3.3, repurposed
  by D29). This doesn't happen yet, because there's only one warehouse — but the schema is ready
  for the day a second one exists (D23), and the same shelf-life-preserving rule applies: a
  transfer must never make fish look fresher than it is (§C.4 fixes a real bug where the old
  algorithm did exactly that).

QR codes tag each container so a phone camera can identify it instantly, rather than someone
reading a printed number off the side of a box in a cold, busy warehouse. This idea is inspired
by Flipkart Minutes' early rollout — worth knowing Flipkart itself moved to a different model as
they scaled (D21's honest caution): right for this business today, not guaranteed permanent.

### 2.6 Batches (deliveries)

#### 2.6.1 What this is

A `batch` is one delivery of one SKU from one vendor into one location. The batch is the
smallest unit of stock accounting. Stock is "the sum of kg in non-fully-depleted batches at
this location" — see §4.3.1 for the algorithm.

#### 2.6.2 Creation

Created by a `vendor-rep` (or `admin`) recording a delivery through `/rep/delivery`. The
form requires: vendor, SKU, kg (positive decimal), price per kg paid (positive decimal),
location (defaults to `storage`), delivered_at (defaults to now). On submit:

1. Insert one `batches` row with the entered fields and a fresh UUID.
2. Insert one `movements` row with `kind='delivery_in'`, `from_location_id=NULL`,
   `to_location_id=<chosen location>`, `kg=<entered kg>`, `batch_id=<new batch.id>`.
3. The audit trigger writes one `audit_log` row for the batch and one for the movement.

The vendor-rep sees a confirmation and the new batch in "today's batches."

#### 2.6.3 Fields

See §4.2.7. `id`, `sku_id`, `vendor_id`, `location_id`, `kg` (initial), `kg_remaining`
(mutable, starts equal to `kg`), `price_per_kg_paid`, `delivered_at`, `created_at`, `created_by`.

#### 2.6.4 Lifecycle

- `kg_remaining` decreases as the batch is sold, transferred out, or marked as spoilage.
- A batch with `kg_remaining = 0` is "depleted" — it shows in history but is excluded from
  "current stock" calculations.
- A batch is never deleted. The audit log requires this.

#### 2.6.5 RLS

- SELECT: all authenticated.
- INSERT: vendor-rep, admin. Worker can NOT record a delivery.
- UPDATE: admin only (and only for the price fields — kg_remaining is updated by triggers
  when movements are created, never by hand).
- DELETE: nobody.

### 2.7 Movements (repack, transfer, sale, spoilage, reversal) — revised, D29/D21/D22

#### 2.7.1 What this is

A `movement` is a change of stock state. It is the only way stock changes. There are now six
kinds (D29, D21, D22 add three to the original four; `transfer`'s meaning is corrected):

| `kind` | `from_location_id` | `to_location_id` | Who creates | Meaning |
|---|---|---|---|---|
| `delivery_in` | NULL | location | vendor-rep, admin/co-admin | New batch arrived, packed into container(s) at receiving (§C.1) |
| `repack` | same location (container-fill grain, §B.4/§C.3) | same location | worker | **The everyday operation now** — consolidating a near-empty container's contents into a smaller one, within the one warehouse. Never resets the shelf-life clock (§C.3). |
| `transfer` | location | location | admin/co-admin | **Repurposed by D29** — moving stock between *different warehouses* (D23). Not used day-to-day today (there's only one warehouse); the destination's shelf-life-relevant timestamp is carried through from the source container fill, never reset (§C.4, the bug fix). |
| `sale` | location | NULL | vendor-rep, admin/co-admin | Stock sold to a buyer; `sales` row also created; draws from the soonest-expiring container (§C.2) |
| `spoilage` | location | NULL | worker, vendor-rep, admin/co-admin | Stock thrown away (fish went bad) |
| `reversal` | — | — | system, on approval | Restores kg to the original container fill(s)/batches after a `reversal_requests` row is approved and executed (§C.5, D22). Never an UPDATE/DELETE on the original sale. |

`to_location_id = NULL` means "out of the system" (sold or spoilt). The `to_location_id` column
is NULLable for exactly this reason.

#### 2.7.2 FIFO spoilage algorithm (D10, superseded for container-tracked stock by §C.2)

The original batch-ordered algorithm (below) is retained for any stock not yet under container
tracking (legacy/transition data only). For real Mode B operation, §C.2 replaces "oldest batch
first" with "soonest-to-expire container fill first," which **is** the least-shelf-life-first
rule the wholesaler already applies by memory, now enforced by the software:

When a spoilage movement is recorded for `kg = X` from `location_id = L` for `sku_id = S`:

1. Find all batches at `(S, L)` with `kg_remaining > 0`, ordered by `delivered_at ASC`.
2. Starting from the oldest, deduct from `kg_remaining` until the spoilage amount is satisfied
   (cascade to next-oldest if needed).
3. Create the `movements` row. If the spoilage spans multiple batches, create one movement row
   per batch (linked by a shared `movement_group_id` UUID). This makes the audit log honest
   about what was actually removed.
4. If at step 2 there is insufficient stock, the spoilage is rejected with the error
   *"Insufficient stock: requested X kg spoilage, only Y kg available"*. The worker can confirm
   the actual amount or correct the form.

See §4.3.2 for the exact numbered procedure with edge cases, and §C.2 for the container-fill
version that actually governs Mode B.

#### 2.7.3 Transfer algorithm (repurposed, D29 — see §C.4 for the bug fix)

Historically documented as a same-warehouse storage→display move; that operation does not exist
in reality (D29). `transfer` now means moving stock **between warehouses** (D23), not used until
a second warehouse exists. Mechanically: creates `kg_remaining` reductions at the source
(cascading FIFO/soonest-expiry) and **a new batch/container-fill at the destination location**,
`kg = <transferred amount>`, `price_per_kg_paid` inherited from the source, weighted by kg if the
transfer spans multiple sources. **Critically, the destination's shelf-life-relevant timestamp
is carried through from the source, never reset to `now()`** — see §C.4 for the exact bug this
fixes in the pre-D21 version of this algorithm. See §4.3.3 and §C.4.

The day-to-day, single-warehouse equivalent of "move stock around" is **repack** (§C.3), not
transfer — see §2.5a for why these are different operations now.

#### 2.7.4 Fields

See §4.2.8. `id`, `kind` (now 6 values, see §2.7.1), `from_location_id` (nullable),
`to_location_id` (nullable), `sku_id`, `kg`, `batch_id` (the source batch for FIFO deductions),
`container_fill_id` (nullable, FK → `container_fills.id` — set for movements sourced from
container-tracked storage, D21/§B.12), `movement_group_id` (UUID grouping the cascade),
`sale_id` (nullable, set when `kind='sale'`), `notes`, `occurred_at`, `created_at`, `created_by`.

#### 2.7.5 RLS

- SELECT: all authenticated (warehouse-scoped once D23 is live).
- INSERT: vendor-rep, admin/co-admin (delivery, sale, spoilage); worker (repack, spoilage);
  admin/co-admin only (transfer — cross-warehouse is an admin-tier action, and doesn't happen
  until a second warehouse exists); system-on-approval (reversal, D22/§C.5).
- UPDATE: nobody. Movements are immutable; corrections are made by a reversal (D22, now in
  scope — no longer "a future V2 feature").
- DELETE: nobody.

### 2.8 Sales

#### 2.8.1 What this is

A `sale` is a transaction where stock leaves the system to a customer. Sales are
**separate from movements** but linked by `sale_id` on the movement row. The split keeps
stock math single-sourced through `movements` while letting the sales table carry business
fields (customer name, sale price) without polluting the inventory data model.

#### 2.8.2 Sale allocation algorithm

When a vendor-rep records a sale of `kg = X` of `sku_id = S` from `location_id = L` at
`sale_price_per_kg = P` to `customer_name = C`:

1. Find all batches at `(S, L)` with `kg_remaining > 0`, ordered by `delivered_at ASC` (FIFO).
2. Create one `sales` row with `customer_name`, `total_kg = X`, `sale_price_per_kg = P`,
   `total_amount = X * P`, `sold_by`, `sold_at`, and the SKU + location.
3. Cascade the kg deduction across batches as in §2.7.2. Each deduction becomes a `movements`
   row with `kind='sale'`, `to_location_id = NULL`, `sale_id = <new sale.id>`.
4. If at step 1 there is insufficient stock, the sale is rejected.

The sale carries `sale_price_per_kg` once but may draw from multiple batches (each with its
own cost). The "margin" for a sale is `sum(batch.price_per_kg_paid × kg) vs X × P`. The
margin is **not stored** — it is derived, per D17.

See §4.3.4.

#### 2.8.3 Fields

See §4.2.9. `id`, `sku_id`, `location_id`, `customer_name`, `total_kg`, `sale_price_per_kg`,
`total_amount`, `sold_by` (user id), `sold_at`, `notes`, `created_at`.

#### 2.8.4 RLS

- SELECT: all authenticated.
- INSERT: vendor-rep, admin.
- UPDATE: admin only (corrections are admin-only in V1; the cleaner V2 is reverse-sale).
- DELETE: nobody.

### 2.9 Pricing

#### 2.9.1 Per-batch pricing (D8)

The authoritative cost data is on the `batches` row: `price_per_kg_paid` is what was paid to
the fisherman. Sales price is on the `sales` row. The margin is derived.

#### 2.9.2 Price history (reference)

For analytics and "what should I charge today" decisions, the admin sets a `price_history`
row per SKU per day. This is a **reference** price — sales still carry their own
`sale_price_per_kg`. The history is what feeds the dashboard widget "today's reference price
for pomfret is ₹650/kg." The vendor-rep sees the reference price when recording a sale, and
can override it.

#### 2.9.3 Fields

See §4.2.10. `id`, `sku_id`, `price_per_kg`, `effective_from`, `effective_to` (nullable,
open-ended if NULL), `set_by` (user id), `created_at`.

#### 2.9.4 RLS

- SELECT: all authenticated.
- INSERT: admin only.
- UPDATE: nobody (price history is immutable; corrections are new rows).
- DELETE: nobody.

### 2.10 Admin dashboard

The dashboard is a single screen with four sections, ordered by what the admin acts on first:

1. **Stock by SKU** — table of every active SKU with `current_stock_kg` (sum of
   `kg_remaining` across locations) and `display_stock_kg`. Sorted by lowest
   `display_stock_kg` first, so the "what's running out on the counter" answer is at the top.
2. **Recent activity** — last 20 movements across all SKUs, with timestamp, kind, kg, who.
3. **Low stock alerts** — SKUs where `display_stock_kg` is below a per-SKU threshold (set in
   `skus.low_stock_threshold_kg`, default 5 kg).
4. **Today's deliveries and sales** — totals for the current day, plus margin if computable.

The dashboard queries the database on load and subscribes to Realtime. When a vendor-rep
records a delivery, the admin sees the stock row update within 1 second on the same network.

### 2.11 Worker UI (revised — D28, D29, D30)

The worker's primary screen is deliberately minimal and task-focused (D28) — not a shrunk admin
view, closer to a delivery-driver app than an inventory dashboard:

1. **Today's containers** — which containers are in the warehouse, sorted soonest-to-expire
   first (§C.2 — this is the least-shelf-life-first rule made real). No "transfer to display"
   task exists anymore (D29) — there is nothing to transfer to.
2. **Repack** — when a container is mostly empty, consolidate into a smaller one (§C.3). This
   is the worker's everyday "move stock" action now, replacing the old storage→display task.
3. **Haul confirmation** — confirm a container (or portion) has been taken out to a buyer.
   Scan-and-confirm shaped (D21's QR tagging), not a data-entry form.
4. **Record spoilage** — form to record X kg of SKU Y as spoilt, drawing from the
   soonest-expiring container first (§C.2). The form pre-fills the FIFO choice and shows the
   actual cascade before confirmation.
5. **Sync status** — last sync time, online/offline indicator, **and pending-write count**
   (D30 — the worker's writes queue locally when offline now, they are not simply blocked; see
   §2.14).

The worker never sees pricing, customer names, vendor info, or the audit log. The UI hides
these elements. RLS prevents the worker from reading them even if the UI is bypassed. This
screen is built as an isolated surface on purpose (D28) — if real field use later shows it needs
to be a genuinely separate app, that split stays cheap because nothing else in the app depends
on its internals.

### 2.12 Audit log

#### 2.12.1 What this is

An append-only log of every mutation: `INSERT`, `UPDATE`, `DELETE` (none in V1, but the
trigger covers all) on every table. The log captures who, when, what table, what row, and
the before/after JSON.

#### 2.12.2 Implementation

A Postgres trigger function `audit_trigger()` is attached to every audited table. On any
mutation it writes one `audit_log` row with the diff. The trigger is `security definer` so
it can write even when the calling user lacks `INSERT` on `audit_log` directly.

#### 2.12.3 RLS on `audit_log`

- SELECT: admin only.
- INSERT: the trigger function only (RLS denies direct INSERT from any role).
- UPDATE, DELETE: nobody. The table is append-only by policy.

#### 2.12.4 Admin UI

`/admin/audit` shows the log: filter by user, table, action, date range. The display is
read-only. The UI must not imply that anything in the log can be edited.

### 2.13 Demo mode (Mode A)

Mode A is the demo to the gatekeeper client. It uses the seeded dataset (D14) and the same
code as the production app. The only differences:

- A **demo banner** at the top of every screen: "Demo mode — data is seeded, not real."
- A **role-switcher** (admin only) that lets the demo viewer log in as any of the three roles
  with one click. The switcher is a demo-only feature and is removed by a feature flag
  (`VITE_DEMO_MODE = true`) in Mode B and C.
- The seed script (Appendix A) is run before the demo.

### 2.14 Offline mode (D6, revised by D30 for the worker role)

**Admin/co-admin/vendor-rep** (office/data-entry roles, D28): unchanged from D6 — read-only
offline. When the browser is offline (`navigator.onLine === false` or a fetch fails):

1. The app shell loads from the service worker cache.
2. The most recent read snapshot is served from `IndexedDB` (cached on every successful read).
3. A persistent banner shows: "Offline — read only. Changes will be available when back online."
4. All mutation buttons are disabled.
5. When the browser comes back online, the next mutation attempt is allowed; the
   service worker refreshes the read snapshot.

**Worker role (D30 — confirmed Mode B scope, no longer out of scope):** real offline writes.
The worker's real job is hauling fish to buyers in the field, not working at a fixed
WiFi-connected counter — the D6-era assumption of "reliable shop WiFi" doesn't hold for this
role. Haul-confirmation, repack, and spoilage actions queue locally (IndexedDB) when offline and
sync when connectivity returns:

1. A queued write shows immediately in the worker's own local view (optimistic), with a
   pending-sync indicator — not silently accepted as if already confirmed server-side.
2. On reconnect, queued writes sync in the order they were made. A write that conflicts with
   what happened server-side in the meantime (e.g. someone else already emptied the same
   container) surfaces to the worker plainly rather than silently resolving either way —
   exact conflict-resolution UX is real design work, not assumed away here.
3. The pending-write count is visible at all times (§2.11).

**This is a genuinely significant piece of engineering** — write-queue, conflict resolution,
sync UX — not a small add-on to the existing offline-read banner. Size it honestly when planning
Mode B build order. `docs/OFFLINE-WRITE-QUEUE.md` (referenced since W1, never written) should be
authored as the detailed design doc for this specific piece before it's built.

---

## 3. Universal behaviour rules

### 3.1 Hash routing

All routes are hash-based (`/#/admin`, `/#/floor/today`). The app works on Netlify static
hosting without server-side rewrites. The 404 page is `index.html` (Netlify's `_redirects`
file) so deep links to unknown routes show the app and a "page not found" message rather
than a 404.

### 3.2 Storage failure

`localStorage` and `IndexedDB` failures (quota, private mode) are caught at the storage
layer. The app shows a banner: "Your browser is blocking local storage. The app will work,
but your session and offline cache won't persist." This matches the exam-forge §3.2 pattern.

### 3.3 Untrusted content

The app does not render user-authored HTML. All fish names, vendor names, and notes are
rendered as text, never as HTML. Markdown is not supported. (Future enhancement: if the
admin needs formatted notes, switch to a sanitised Markdown renderer as in exam-forge.)

### 3.4 Keyboard access

- Every form has visible labels.
- Tab order follows reading order.
- The mutation buttons have visible focus rings (Tailwind default `focus-visible:ring-2`).
- The login form auto-focuses the email field on mount.

### 3.5 Time zone

All timestamps are stored as `timestamptz` in UTC. The UI renders in the browser's local time
(Asia/Kolkata for the target user). The `delivered_at` field on a batch is set by the
vendor-rep; the UI shows the local time but the storage is UTC.

### 3.6 Money

The Indian rupee symbol (₹) is used throughout. `numeric(10,2)` is the type for all money
fields — never `float`. The display rounds to whole rupees unless paise are explicitly
relevant (e.g. a ₹0.50/kg discount).

### 3.7 Empty states

Per exam-forge §3.3: a missing field never blanks a screen. Every list view has a
considered empty state ("No deliveries today — record one" with a button, not a blank page).
Every filter combination that yields zero results names which filter to loosen.

### 3.8 Destructive actions

There are no destructive actions in V1 (no DELETE policy on any table, with **one** exception:
`containers`, added by D32 so a never-filled container registered by mistake can be removed; the
`container_fills.container_id ON DELETE RESTRICT` FK still blocks deleting any container with fill
history, and `audit_log` has no DELETE policy for any role). The closest is "deactivate
a vendor" or "deactivate a SKU," which are explicit two-step (form + confirmation) and
soft-delete. The UI labels them clearly.

---

## 4. Technical implementation

### 4.1 Architecture & stack

| Layer | Choice | Reason | What it rules out |
|---|---|---|---|
| Frontend framework | Vite + React 18 + TypeScript | Same as exam-forge, same as the user's MERN chatbot — muscle memory and component library carry over | Any non-React framework (no Vue, Svelte, etc.) |
| Styling | Tailwind CSS | Same as above; utility classes keep the design system small | CSS-in-JS, CSS modules, custom design tokens at scale |
| Routing | Hash-based (wouter or react-router with `HashRouter`) | Works on Netlify static hosting without rewrites | BrowserHistoryRouter (would need Netlify `_redirects` for every route) |
| State | React Query (TanStack Query) for server state, React `useState` for UI state | Server state is owned by the database; client mirrors it. Local state stays local. | Redux, Zustand, MobX — over-engineered for this size |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | D1, D4, D5. The free tier covers one store. | Firebase, custom Node API, Render-only Postgres |
| Schema migrations | Supabase CLI + plain SQL files in `supabase/migrations/` | D2. Postgres migrations are the cleanest in the industry. | Prisma migrations, raw SQL dumps, in-place edits |
| Auth | Supabase Auth (email/password + phone OTP) | D3, D4. RLS ties auth users to app users. | NextAuth, Auth0, custom JWT |
| Realtime | Supabase Realtime channels | Free, no extra infra. The admin dashboard subscribes to a `movements` channel. | WebSockets server, Pusher, Ably |
| PWA / offline | `vite-plugin-pwa` (Workbox under the hood) | Standard toolchain. The service worker caches the app shell. | Custom service worker (more code, less safety) |
| Hosting | Netlify (free tier) | Same as the user's MERN chatbot | Vercel, Render static, Cloudflare Pages |
| Secrets | Netlify env vars; Supabase keys are split into publishable (browser) and secret (server-only). `SUPABASE_JWKS_URL` for JWT verification. | Follows the `@supabase/server` package convention. The publishable key is the only thing shipped in the JS bundle. The secret key never leaves the server. | Hardcoded keys, shared env files |
| Testing | Vitest + React Testing Library | Same as exam-forge | Jest, Playwright (V1) |
| Client review decks (not the app) | The same chapter data in two presentations: Tailwind with the shared player (deck 1, the app's own look) and an Ant Design 6 workbench with its own shell (deck 2, review build only) | The client is choosing a design language and asked to see the same 32 chapters in both, so the comparison is by looking rather than by argument. Deck 2 is a **separate build** (`dist-storybook-ant/`) imported by nothing in the app — no bundle weight, no runtime surface added. | Mixing the two systems on one screen; shipping Ant Design inside the app bundle before **D67** is answered |
| Schema validation | `zod` + `supabase gen types typescript` for the row types | Static types match the database, end-to-end. | Hand-written types, `any` |
| Seed data | `supabase/seed.sql` (plain SQL, idempotent) | D14. The seed is part of the build, not a one-off. | Faker scripts, JSON dumps |

**Dependency discipline.** `package.json` has no dependency on `dotenv` (Vite handles env
vars natively), no Lodash (modern JS suffices), no moment.js (`Intl.DateTimeFormat` is
enough). The seed script depends on nothing.

### 4.2 Data structures

Every field, every table, every type. The order is the order the migrations create them
(foreign keys respect the order).

#### 4.2.1 `users`

App-side user table. Linked to Supabase Auth by `id`.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | — | Primary key. Equal to `auth.users.id`. |
| `email` | `text` | NULL (was NOT NULL until D35/migration 0014) | — | Email, mirrored from `auth.users`. NULL for a phone-only account (D35). |
| `phone` | `text` | NULL | — | Phone, for OTP login. Mirrored from `auth.users` by `handle_new_user()` since migration 0014 (D35) — previously declared but never actually populated. |
| `display_name` | `text` | NOT NULL | — | What the UI shows. |
| `role` | `text` | NOT NULL | — | One of: `admin`, `co-admin`, `vendor-rep`, `worker`, `super-worker`. D3, D28. |
| `active` | `boolean` | NOT NULL | `true` | Deactivated users cannot log in (enforced by trigger on `auth.users`). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_by` | `uuid` | NULL | — | `users.id` of the admin who created this user. |
| `updated_by` | `uuid` | NULL | — | Last admin to update. |

**Constraint** `users_identity_present` (migration 0014, D35): `CHECK (email IS NOT NULL OR
phone IS NOT NULL)`. A row must have *some* way to identify the person even though neither
column alone is required any more — an all-NULL identity is the one state this table must never
allow.

#### 4.2.2 `locations`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | Unique handle (`storage`, `display`, `freezer`). |
| `display_name` | `text` | NOT NULL | — | UI label. |
| `kind` | `text` | NOT NULL | — | `storage`, `display`, `freezer`, `other`. |
| `active` | `boolean` | NOT NULL | `true` | |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

#### 4.2.3 `vendors`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | |
| `phone` | `text` | NULL | — | |
| `port_or_village` | `text` | NULL | — | Where they fish from. |
| `boat_name` | `text` | NULL | — | |
| `typical_catch` | `text` | NULL | — | Free text. |
| `reliability` | `int2` | NOT NULL | `3` | 1–5. |
| `active` | `boolean` | NOT NULL | `true` | |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_by` | `uuid` | NULL | — | `users.id`. |
| `updated_by` | `uuid` | NULL | — | `users.id`. |

#### 4.2.4 `skus`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `code` | `text` | NOT NULL | — | Unique. Format: `FISH-<NAME>-<GRADE>-<NNN>`. |
| `english_name` | `text` | NOT NULL | — | e.g. "Pomfret". |
| `tamil_name` | `text` | NOT NULL | `''` | Required field, may be empty. e.g. "வவ்வால்". D11. |
| `category` | `text` | NOT NULL | — | `fin_fish`, `shellfish`, `crustacean`, `cephalopod`, `dried`. |
| `size_grade` | `text` | NOT NULL | — | `small`, `medium`, `large`, `xl`, `mixed`. |
| `unit` | `text` | NOT NULL | `'kg'` | `kg`, `piece`, `dozen`. |
| `shelf_life_hours` | `int4` | NOT NULL | `24` | |
| `storage_type` | `text` | NOT NULL | `'chilled'` | `chilled`, `frozen`, `ambient`. |
| `low_stock_threshold_kg` | `numeric(10,2)` | NOT NULL | `5.00` | Below this on `display` triggers an alert. |
| `active` | `boolean` | NOT NULL | `true` | |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_by` | `uuid` | NULL | — | `users.id`. |
| `updated_by` | `uuid` | NULL | — | `users.id`. |

#### 4.2.5 `batches`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sku_id` | `uuid` | NOT NULL | — | FK → `skus.id`. |
| `vendor_id` | `uuid` | NOT NULL | — | FK → `vendors.id`. |
| `location_id` | `uuid` | NOT NULL | — | FK → `locations.id`. The current location of the `kg_remaining`. |
| `kg` | `numeric(10,3)` | NOT NULL | — | Initial kg delivered. |
| `kg_remaining` | `numeric(10,3)` | NOT NULL | — | Starts equal to `kg`. Decreased by movements. |
| `price_per_kg_paid` | `numeric(10,2)` | NOT NULL | — | What was paid to the vendor. D8. |
| `delivered_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `created_by` | `uuid` | NULL | — | `users.id`. |

The combination `(sku_id, location_id, delivered_at)` is **not** unique — two deliveries of
the same SKU at the same instant from different vendors are possible. The batch UUID is the
only identity.

#### 4.2.6 `movements`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `kind` | `text` | NOT NULL | — | `delivery_in`, `transfer`, `sale`, `spoilage`. |
| `from_location_id` | `uuid` | NULL | — | FK → `locations.id`. NULL for `delivery_in`. |
| `to_location_id` | `uuid` | NULL | — | FK → `locations.id`. NULL for `sale` and `spoilage`. |
| `sku_id` | `uuid` | NOT NULL | — | FK → `skus.id`. |
| `kg` | `numeric(10,3)` | NOT NULL | — | Always positive. |
| `batch_id` | `uuid` | NOT NULL | — | FK → `batches.id`. The source batch this movement drew from. |
| `movement_group_id` | `uuid` | NOT NULL | — | Groups cascaded movements. UUIDv4 generated on the first movement of the cascade. |
| `sale_id` | `uuid` | NULL | — | FK → `sales.id`. Set when `kind='sale'`. |
| `notes` | `text` | NULL | — | |
| `occurred_at` | `timestamptz` | NOT NULL | `now()` | When the stock actually moved. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | When the row was inserted. |
| `created_by` | `uuid` | NULL | — | `users.id`. |

The pair `(from_location_id IS NULL, to_location_id IS NULL)` is **forbidden by CHECK
constraint**. At least one side must be a real location.

#### 4.2.7 `sales`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sku_id` | `uuid` | NOT NULL | — | FK → `skus.id`. |
| `location_id` | `uuid` | NOT NULL | — | FK → `locations.id`. Where the stock was sold from. |
| `customer_name` | `text` | NOT NULL | — | Free text, e.g. "Saravana Stores". |
| `total_kg` | `numeric(10,3)` | NOT NULL | — | Sum of the cascaded movements. |
| `sale_price_per_kg` | `numeric(10,2)` | NOT NULL | — | What was charged per kg. |
| `total_amount` | `numeric(10,2)` | NOT NULL | — | `total_kg * sale_price_per_kg`. Computed, but stored for read performance. |
| `sold_by` | `uuid` | NOT NULL | — | FK → `users.id`. |
| `sold_at` | `timestamptz` | NOT NULL | `now()` | |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

#### 4.2.8 `price_history`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sku_id` | `uuid` | NOT NULL | — | FK → `skus.id`. |
| `price_per_kg` | `numeric(10,2)` | NOT NULL | — | The reference price. |
| `effective_from` | `date` | NOT NULL | — | First day this price applies. |
| `effective_to` | `date` | NULL | — | Last day (inclusive). NULL = open-ended. |
| `set_by` | `uuid` | NOT NULL | — | FK → `users.id` (admin). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

The current price for a SKU is the row where `effective_from <= today AND (effective_to IS
NULL OR effective_to >= today)`. There must be at most one such row per SKU at any time —
enforced by an exclusion constraint.

#### 4.2.9 `audit_log`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | NULL | — | FK → `users.id`. NULL for system-triggered writes. |
| `action` | `text` | NOT NULL | — | `INSERT`, `UPDATE`, `DELETE`. |
| `table_name` | `text` | NOT NULL | — | The table that was changed. |
| `row_id` | `uuid` | NOT NULL | — | The PK of the row that was changed. |
| `before_json` | `jsonb` | NULL | — | The row before the change. NULL for INSERT. |
| `after_json` | `jsonb` | NULL | — | The row after the change. NULL for DELETE. |
| `at` | `timestamptz` | NOT NULL | `now()` | |

#### 4.2.10 `warehouses` (D23 — renamed from the amendment's `stores`)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | Unique handle. |
| `display_name` | `text` | NOT NULL | — | UI label. |
| `active` | `boolean` | NOT NULL | `true` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

`locations.warehouse_id` (FK → `warehouses.id`, NOT NULL) is added. The current single-warehouse
reality (D29) gets exactly one seeded row here; nothing else changes until warehouse #2 exists.

#### 4.2.11 `containers` (D21, quantities/custom sizes resolved by D32)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key — permanent, never reused, even if the printed number is. |
| `container_number` | `text` | NOT NULL | — | 5-digit human-facing number, printed and QR-encoded (default auto-generated format — not a schema-enforced format, an admin can enter a different scheme). Unique among **active** containers only. |
| `capacity_kg` | `numeric(5,2)` | NOT NULL | — | `5`/`10`/`15`/`20`/`25` are the standard presets, but **not the only allowed values** (D32) — any positive number is valid, for a custom-sized box. |
| `active` | `boolean` | NOT NULL | `true` | `false` = retired (damaged/lost). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

Container availability (loaded vs. free to reload) is **derived**, not stored (D17) — a
container is available if no `container_fills` row on it has `kg_remaining > 0`.

**D32 — how many containers the business owns is wholesaler-entered data, not a spec fact
(resolves the "box/container quantities" item that closing §D flagged as open).** The admin
registers containers himself through the app, individually numbered as this table already
requires (needed for the QR-tag-per-box idea and for `container_fills` to track each physical
box's own shelf-life clock) — but registering several at once ("I have 6 of the 10kg size")
is a bulk-create convenience, not N separate manual entries. Beyond the 5 standard presets, a
custom box size can be registered the same way, with its own quantity. Both `container_number`
and `capacity_kg` stay editable after creation (existing `containers_update_admin` RLS policy —
no new policy needed for this). A container can never be deleted once it has ever held a fill —
already true at the schema level (`container_fills.container_id` is `ON DELETE RESTRICT`, since
migration 0006) but previously unreachable either way, since no DELETE policy existed at all;
D32 adds one (admin/co-admin, matching `containers_update_admin`'s role scope) so a
never-filled container (registered by mistake, or retired before use) actually *can* be deleted,
while the existing FK continues to block deleting one with any fill history — the restriction
was already correct, it just had nothing to apply to. No new capacity-format constraint is
needed: the original CHECK restricting `capacity_kg` to the 5 presets is replaced with
`capacity_kg > 0`.

#### 4.2.12 `container_fills` (D21)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `container_id` | `uuid` | NOT NULL | — | FK → `containers.id`. |
| `bill_id` | `uuid` | NOT NULL | — | FK → `bills.id` (§4.2.16). **Enforces the one-purchase-event-per-fill rule.** |
| `location_id` | `uuid` | NOT NULL | — | FK → `locations.id`. Where the fill currently sits. |
| `filled_at` | `timestamptz` | NOT NULL | `now()` | The shelf-life clock start. Carried through unchanged by repacks (§C.3) and by warehouse-to-warehouse transfers (§C.4 — the bug fix). |
| `kg_remaining` | `numeric(10,3)` | NOT NULL | — | Mirrors `batches.kg_remaining` — derivable, stored for read performance, kept in sync by trigger. |
| `expires_at` | `timestamptz` | NOT NULL | computed | `filled_at + min(shelf_life_hours)` across the SKUs in `container_fill_items` for this fill. Computed at fill-creation time. |
| `created_by` | `uuid` | NULL | — | `users.id`. |

#### 4.2.13 `container_fill_items` (D21)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `container_fill_id` | `uuid` | NOT NULL | — | FK → `container_fills.id`. |
| `batch_id` | `uuid` | NOT NULL | — | FK → `batches.id`. Which procurement line this portion came from. |
| `kg` | `numeric(10,3)` | NOT NULL | — | How much of that batch went into this fill. |

One fill can hold portions of several batches (multiple SKUs bought on the same trip, packed
pragmatically — not a rigid one-SKU-per-container rule).

#### 4.2.14 `bills` (D-amendment §B.5, Problem A)

The vendor-raised purchase bill, captured at the purchase point.

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `vendor_id` | `uuid` | NOT NULL | — | FK → `vendors.id`. |
| `vendor_bill_number` | `text` | NULL | — | The vendor's own bill/reference number, free text (may not exist for an informal purchase). |
| `bill_date` | `date` | NOT NULL | `now()` | |
| `total_amount` | `numeric(10,2)` | NOT NULL | — | Sum across the bill's `batches` lines — stored for read performance, not authoritative. |
| `share_status` | `text` | NOT NULL | `'not_shared'` | `not_shared` / `shared`. |
| `shared_at` | `timestamptz` | NULL | — | When the bill was shared back to the vendor. |
| `share_method` | `text` | NULL | — | `pdf` / `whatsapp` / `email`. |
| `created_by` | `uuid` | NULL | — | `users.id`. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

`batches.bill_id` (FK → `bills.id`, NULLABLE for backward compatibility with pre-Mode-B rows) is
added.

#### 4.2.15 `receiving_confirmations` (D-amendment §B.6, Problem B, soft-gated per D25)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `bill_id` | `uuid` | NOT NULL | — | FK → `bills.id`. |
| `confirmed_weight_kg` | `numeric(10,3)` | NULL | — | What the receiving team actually measured, if entered. |
| `discrepancy_flag` | `boolean` | NOT NULL | `false` | `true` if confirmed weight/type differs materially from the bill. |
| `notes` | `text` | NULL | — | Freshness/damage notes. |
| `photo_status` | `text` | NOT NULL | `'none'` | `none` / `pending_upload` / `uploaded`. Same three-state pattern reused for every soft-gated photo (spoilage claims, payment proof). |
| `confirmed_by` | `uuid` | NOT NULL | — | `users.id`. |
| `confirmed_at` | `timestamptz` | NOT NULL | `now()` | |

#### 4.2.16 `customers` (D-amendment §B.7, Problem D — necessary-only CRM fields)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `name` | `text` | NOT NULL | — | Contact person name. |
| `business_name` | `text` | NULL | — | Only for `is_business = true`. |
| `is_business` | `boolean` | NOT NULL | `false` | |
| `phone` | `text` | NULL | — | Soft-gated per D25. |
| `address` | `text` | NULL | — | Same. |
| `follow_up_status` | `text` | NULL | — | `cold_call` / `new_requirement` / `active` / `inactive`, extendable by migration. |
| `fish_preference` | `text` | NULL | — | Free text. |
| `is_gst_registered` | `boolean` | NOT NULL | `false` | Part of D24's dormant GST track. |
| `gstin` | `text` | NULL | — | Only meaningful if `is_gst_registered`. |
| `credit_limit` | `numeric(10,2)` | NULL | — | D33. `NULL` = no formal cap set, not zero credit. |
| `credit_period_days` | `int4` | NULL | — | D33. `NULL` = no due-date tracking for this customer. |
| `assigned_rep_id` | `uuid` | NULL | — | FK → `users.id`. |
| `warehouse_id` | `uuid` | NOT NULL | — | FK → `warehouses.id` (D23 — customers are warehouse-scoped). |
| `active` | `boolean` | NOT NULL | `true` | |
| `created_by` | `uuid` | NULL | — | Used for D25's "flag the person who entered incomplete data" rule. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | |

`sales.customer_id` (FK → `customers.id`, NULLABLE for backward compatibility — pre-Mode-B
`sales.customer_name` free text stays as a fallback/display field, not removed). **`price_history`
and any per-customer price data stays admin-facing only, never surfaced to the customer directly
— D31.**

#### 4.2.17 `payments` (D-amendment §B.8, Problem E)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sale_id` | `uuid` | NOT NULL | — | FK → `sales.id`. |
| `amount` | `numeric(10,2)` | NOT NULL | — | Never `float` (§3.6). |
| `method` | `text` | NULL | — | `cash` / `upi` / `bank_transfer` / other. |
| `proof_status` | `text` | NOT NULL | `'none'` | Same three-state pattern as `receiving_confirmations.photo_status`. |
| `paid_at` | `timestamptz` | NOT NULL | `now()` | |
| `recorded_by` | `uuid` | NOT NULL | — | `users.id`. |
| `notes` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

A sale's outstanding balance (`sales.total_amount - sum(payments.amount)`) is **derived**,
computed on read, never stored (D17).

#### 4.2.18 `reversal_requests` (D-amendment §B.9, D22)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `sale_id` | `uuid` | NOT NULL | — | FK → `sales.id`. |
| `requested_by` | `uuid` | NOT NULL | — | `users.id`. |
| `requested_at` | `timestamptz` | NOT NULL | `now()` | |
| `status` | `text` | NOT NULL | `'requested'` | `requested` / `approved` / `denied` / `executed`. |
| `reason` | `text` | NULL | — | |
| `decided_by` | `uuid` | NULL | — | `users.id`. Admin who approved/denied, or the requester if `can_self_reverse`. |
| `decided_at` | `timestamptz` | NULL | — | |
| `executed_movement_group_id` | `uuid` | NULL | — | Set once the reversal actually runs (§C.5). |

`users.can_self_reverse` (`boolean`, NOT NULL, default `false`) is added.

#### 4.2.19 `notifications` (D-amendment §B.10, D27)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | NOT NULL | — | `users.id`. |
| `type` | `text` | NOT NULL | — | Controlled vocabulary — see §F taxonomy. **Never a price-change type — D31.** |
| `payload` | `jsonb` | NULL | — | Type-specific detail. |
| `role_at_creation` | `text` | NOT NULL | — | Per D27. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `read_at` | `timestamptz` | NULL | — | |

#### 4.2.20 `user_role_history` (D-amendment §B.11, required for D27)

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | NOT NULL | — | `users.id`. |
| `role` | `text` | NOT NULL | — | |
| `effective_from` | `timestamptz` | NOT NULL | `now()` | |
| `effective_to` | `timestamptz` | NULL | — | `NULL` = currently held. |

A row is closed and a new one opened whenever `users.role` changes — a trigger on `users` UPDATE.
**`users.role` now includes `co-admin`** (D28 — Jayshankar's role: full admin capability,
inventory-focused by default; not a reduced role, so RLS treats `co-admin` identically to
`admin` everywhere except UI defaults).

#### 4.2.21 `movements.kind` and `movements.container_fill_id` (D-amendment §B.12)

`repack` and `reversal` are added to the controlled vocabulary (`delivery_in`, `transfer`,
`sale`, `spoilage`), per §2.7.1's revised table. `movements.container_fill_id` (FK →
`container_fills.id`, NULLABLE) is added alongside the existing `batch_id` — for `sale`/
`spoilage`/`transfer` movements sourced from container-tracked storage (§4.3.8), this is the
fill the row's `kg` was drawn *from*, the same "drawn from" sense `batch_id` already has.

**Addendum, found while building §4.3.9 (D-amendment §B.12a):** §4.3.9 step 5 asks for one
`movements` row referencing *both* the source and destination `container_fill_id` for a
repack — but a single nullable FK column can't hold two references. `movements.
destination_container_fill_id` (FK → `container_fills.id`, NULLABLE) is added, populated only
when `kind='repack'`. The original `container_fill_id` keeps its "drawn from" meaning
unchanged (the source fill, for repack too) — no rename, no migration of the one column
already shipped in 0006. Logged as decision #39 in `BUILDER-DECISIONS-REVIEW.md`; schema in
migration `0008_record_repack.sql`.

### 4.3 Algorithms

#### 4.3.1 Current stock calculation

**Current stock of SKU `S` at location `L`** (in kg):

```sql
select coalesce(sum(b.kg_remaining), 0)
from batches b
where b.sku_id = $S
  and b.location_id = $L
  and b.kg_remaining > 0;
```

Total current stock of SKU `S` across all locations is the sum across `L`. The `coalesce`
ensures an empty result is `0`, not NULL.

**Note:** the algorithm does not need to look at `movements` directly. The `batches.kg_remaining`
column is kept in sync by a trigger on `movements` (see §4.3.5). This makes the read path
a single-table scan.

#### 4.3.2 Spoilage algorithm (FIFO, with cascade)

When a spoilage of `kg = X` from `location_id = L` for `sku_id = S` is requested:

1. **Validate** `X > 0`. Reject with `invalid_kg` if not.
2. **Lock the candidate batches** with `SELECT ... FOR UPDATE`:
   ```sql
   select id, kg_remaining, delivered_at
   from batches
   where sku_id = $S
     and location_id = $L
     and kg_remaining > 0
   order by delivered_at asc
   for update;
   ```
3. **Compute total available**: `sum(kg_remaining)`. If `< X`, reject with
   `insufficient_stock` and the available amount.
4. **Generate a movement_group_id** (UUIDv4).
5. **Iterate** over the locked batches in `delivered_at ASC` order, deducting from
   `kg_remaining` until `X` is satisfied:
   - `deduct = min(batch.kg_remaining, remaining_x)`
   - `update batches set kg_remaining = kg_remaining - $deduct where id = batch.id`
   - `insert into movements (kind, from_location_id, to_location_id, sku_id, kg, batch_id, movement_group_id, created_by) values ('spoilage', $L, null, $S, $deduct, batch.id, $group_id, $user_id)`
   - `remaining_x = remaining_x - deduct`
   - If `remaining_x = 0`, stop.
6. **The single spoilage action produces 1..N movement rows**, all sharing the
   `movement_group_id`. The audit log will show all of them as a group (UI groups them).
7. **Commit** the transaction.

Edge cases:
- If the source location is the same as the only `display` location and the spoilage is
  zero, the algorithm returns a `no_op` warning (no movements created).
- If two spoilage requests race for the same oldest batch, the `FOR UPDATE` lock serialises
  them. The second one re-reads `kg_remaining` and cascades to the next batch.

#### 4.3.3 Transfer algorithm

A transfer of `kg = X` of `sku_id = S` from `location_id = L_from` to `location_id = L_to`:

1. Validate `X > 0`, `L_from != L_to`. Reject otherwise.
2. **Lock source batches** at `(S, L_from)` with `kg_remaining > 0`, ordered
   `delivered_at ASC`. `SELECT ... FOR UPDATE`.
3. **Validate sufficient stock** at the source. Reject if not.
4. **Generate a movement_group_id**.
5. **Cascade source deductions** as in §4.3.2 steps 5–6, but `kind='transfer'` and
   `to_location_id = L_to`. Track the actual kg drawn from each source batch
   (`batch_drawn[batch_id] = kg_deducted`).
6. **Create destination batch(es)**:
   - Compute the **weighted average `price_per_kg_paid`** across the source batches:
     `sum(batch.price_per_kg_paid × kg_deducted) / X`.
   - Insert a single `batches` row at `L_to` with `kg = X`, `kg_remaining = X`,
     `price_per_kg_paid = <weighted average>`, `delivered_at = now()`, `sku_id = S`,
     `vendor_id = <the vendor of the largest source batch, tiebreak oldest>`. The vendor
     attribution is the spec's call for traceability — a transfer from a Murugan batch in
     storage to the display retains Murugan attribution until sold.
7. **Insert one `movements` row per source deduction** with `kind='transfer'`,
   `from_location_id = L_from`, `to_location_id = L_to`, `batch_id = <source batch>`,
   `movement_group_id`.
8. **Commit**.

The destination batch is **created on transfer**, not on delivery. This is the key design
choice: the `batches` table is a tree of provenance (every kg traces back to a delivery
through a chain of transfers). Sales draw from the destination batch and the audit log shows
the full chain.

#### 4.3.4 Sale algorithm

A sale of `kg = X` of `sku_id = S` from `location_id = L` at `sale_price_per_kg = P` to
`customer_name = C`:

1. Validate `X > 0`, `P > 0`, `C` is non-empty. Reject otherwise.
2. **Lock source batches** at `(S, L)` FIFO, `FOR UPDATE`.
3. **Validate sufficient stock**. Reject if not.
4. **Generate a `movement_group_id`**.
5. **Create the `sales` row** with `sku_id = S`, `location_id = L`, `customer_name = C`,
   `total_kg = X`, `sale_price_per_kg = P`, `total_amount = X * P`, `sold_by = $user_id`,
   `sold_at = now()`. Capture `sale.id`.
6. **Cascade source deductions** as in §4.3.2, but `kind='sale'`, `to_location_id = NULL`,
   `sale_id = $sale_id`. Each cascade step inserts one `movements` row.
7. **Commit**.

The margin for a sale is computable on read:
```sql
select
  s.total_amount - sum(b.price_per_kg_paid * m.kg) as margin
from sales s
join movements m on m.sale_id = s.id
join batches b on m.batch_id = b.id
where s.id = $sale_id
group by s.id;
```
This is **derived data** and is not stored (D17).

#### 4.3.5 Trigger: maintain `batches.kg_remaining`

On every `INSERT` to `movements`, a trigger function `apply_movement_to_batches()` runs:

1. If `kind = 'delivery_in'`: the trigger does nothing — the new batch is already created
   by the application code with `kg_remaining = kg`.
2. If `kind IN ('transfer', 'sale', 'spoilage')` and `from_location_id IS NOT NULL`:
   - Decrement `batches.kg_remaining` for the `batch_id` in the movement row by the
     movement's `kg`.

Note: the cascade (drawing from multiple batches for a single logical action) is done at
the application level inside the transaction, with `FOR UPDATE` locks. The trigger is the
**safety net** for the simple case (one movement, one source batch); the cascade is the
application's job.

#### 4.3.6 Trigger: audit log

The `audit_trigger()` function (referenced in §2.12.2) is attached to every audited table.
The implementation is the standard "diff trigger" pattern:

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

Every audited table gets `create trigger <name>_audit after insert or update or delete on
<table> for each row execute function public.audit_trigger();`.

#### 4.3.7 Container fill creation, at receiving (D21, D-amendment §C.1)

1. Create the `bills` row (vendor, date) and one `batches` row per SKU line, exactly as the
   existing delivery flow already does — unchanged.
2. For each container being packed: create (or select an existing available) `containers` row,
   then a `container_fills` row referencing this one `bill_id`.
3. Insert `container_fill_items` rows splitting the bill's `batches` across the fills packed.
   An optional greedy best-fit packing suggestion may propose the split; the employee's actual
   choice is what's written.
4. Compute `container_fills.expires_at = filled_at + min(shelf_life_hours)` across the SKUs now
   in that fill.

#### 4.3.8 Container-sourced FIFO (D21, D-amendment §C.2 — replaces §4.3.2/§4.3.3's batch-ordering for container-tracked stock)

Where §4.3.2/§4.3.4 lock candidate `batches` ordered by `delivered_at ASC`, container-tracked
storage instead locks candidate `container_fills` ordered by `expires_at ASC` (soonest-to-expire
first — the "least shelf life first" rule made enforceable, §2.5a). The cascade proceeds against
`container_fills.kg_remaining`; in parallel, `batches.kg_remaining` is decremented via
`container_fill_items` for pricing/lineage (§4.3.4's margin calculation and D8's per-batch
pricing still work unchanged — `batch_id` is still recorded on every `movements` row,
`container_fill_id` is additive).

#### 4.3.9 Repack (D21, D-amendment §C.3)

Trigger: a fill's `kg_remaining` drops to where a smaller container size (5/10/15/20/25) would
now comfortably hold it. Fire a notification once, on first crossing into a smaller size class.

1. Worker selects the source fill (oversized, near-empty) and a destination container
   (available, right-sized).
2. Create a new `container_fills` row on the destination, with `filled_at` and `expires_at`
   **copied from the source fill unchanged** — never make fish appear fresher.
3. Copy `container_fill_items` (same `batch_id`/`kg` breakdown) onto the new fill.
4. Zero out the source fill's `kg_remaining`, freeing its container.
5. Insert one `movements` row, `kind='repack'`, referencing both the source and destination
   `container_fill_id`.
6. Any worker can execute a repack without approval — physical consolidation, not a financial
   or quantity change, unlike reversal (§4.3.11).

#### 4.3.10 Transfer algorithm — the timestamp bug fix (D-amendment §C.4, amends §4.3.3, repurposed by D29)

**The bug, exactly as found:** the pre-Mode-B transfer algorithm set the destination batch's
`delivered_at = now()` (the transfer time). Reasonable before shelf-life-based sell priority was
a requirement — but it silently resets a fish's apparent freshness on every transfer, defeating
FIFO/shelf-life ordering.

**The fix:** when the source of a transfer is container-tracked storage, the destination's
shelf-life-relevant timestamp is carried through from the source `container_fill.filled_at`, not
reset to `now()`. All of §4.3.3's other mechanics (FIFO cascade, weighted-average
`price_per_kg_paid`, vendor attribution) are unchanged. This is now a **warehouse-to-warehouse**
operation (D29, D23) rather than a same-site storage→display move — it doesn't run in practice
until a second warehouse exists, but the fix must be in place before it does, since it's the
same failure mode repack (§4.3.9) is careful to avoid.

#### 4.3.11 Reversal workflow (D22, D-amendment §C.5)

1. Vendor-rep creates a `reversal_requests` row, `status='requested'`.
2. If `users.can_self_reverse` is `true` for the requester, auto-transition to `approved`
   (`decided_by = requested_by`) — admin/co-admin is still notified regardless (§F).
3. Otherwise, an admin/co-admin reviews and sets `status` to `approved` or `denied`.
4. On approval, execute: generate a new `movement_group_id`, insert `movements` rows with
   `kind='reversal'` that restore `kg_remaining` to the original `batches` (and
   `container_fills`, if the original sale drew from container-tracked storage) referenced by
   the original sale's movement group. Set `reversal_requests.status='executed'` and
   `executed_movement_group_id`.
5. No UPDATE or DELETE on the original `sales`/`movements` rows at any point — D5's append-only
   spirit, exactly as D22 states.

#### 4.3.12 User invitation workflow (D34; D35 for the deferred OTP phone design; D36 for the email link; D37 — active phone mechanism)

A Supabase Edge Function (`supabase/functions/invite-user`), not a Postgres RPC — the one piece
of server-side logic in this project that genuinely needs to run outside the database, because
only the Edge Function runtime can hold the service-role key server-side while still being
callable from the app (a Postgres `SECURITY DEFINER` function bypasses *RLS*, not the "the
secret key must never reach the client" boundary — creating an `auth.users` row isn't a SQL
operation RLS or `SECURITY DEFINER` has any authority over at all; it's a Supabase Auth Admin
API call).

**Request** (from the app, `Authorization: Bearer <the calling admin/co-admin's own access
token>`) — exactly one of `email`/`phone`, never both, never neither:
```json
{ "email": "string | omit", "phone": "string (E.164, e.g. +919876543210) | omit", "role": "admin | co-admin | vendor-rep | worker | super-worker", "display_name": "string" }
```

1. **Verify the caller**, using the caller's *own* JWT — not the service-role key — against a
   Supabase client scoped to that `Authorization` header. This makes `current_user_role()`/RLS
   apply exactly as they do everywhere else in this project: query `public.users` for the
   caller's own row via that scoped client; if the lookup fails or the role isn't `admin` or
   `co-admin`, reject with 401/403. No separate, hand-rolled authorization check — the existing
   RLS boundary *is* the check, reused rather than duplicated.
2. **Validate the request body**: exactly one of `email`/`phone` present (reject if both or
   neither — the D35 identity rule at the API boundary, matching the database's
   `users_identity_present` CHECK); `role` and `display_name` always required; `role` must be
   one of the 5 real values (the same list `users_role_check` enforces at the database level,
   D28/decision #46 — kept in sync by hand since an Edge Function can't read a Postgres CHECK
   constraint at runtime; if the two ever drift, the database still has the final word); `phone`,
   if present, must match E.164 (`+` then digits only — Supabase's Admin API rejects anything
   else, so this is caught here with a clear message rather than surfacing Supabase's own error).
3. **Only now** construct a second Supabase client using the service-role key (read from the
   Edge Function's own environment — Supabase injects `SUPABASE_URL`/`SUPABASE_ANON_KEY`/
   `SUPABASE_SERVICE_ROLE_KEY` into every Edge Function automatically; no manual secret
   configuration needed). This client is **never returned to the caller and never logged** —
   constructed, used once, discarded within the function's own execution.
4. **Branch on which identifier was supplied** (D35):
   - **Email**: `auth.admin.generateLink({ type: 'invite', email, options: { data: { role,
     display_name }, redirectTo: <the deployed web app's URL> } })` (D36 — supersedes D34's
     original `inviteUserByEmail` call). Creates the `auth.users` row **immediately**, exactly as
     `inviteUserByEmail` did, but **sends nothing** — the function returns the generated
     `action_link` to the caller instead. The admin shares that link themselves (WhatsApp, SMS,
     in person); the invited person opens it in their phone's ordinary browser, sets their own
     password there (the deployed web/PWA build handles this, not the native app — no
     Capacitor/deep-link work needed), then separately opens the real Android app and signs in
     fresh with the email/password they just chose.
   - **Phone (D37, active mechanism, corrected order per D40 — D35's `createUser`/OTP design is
     deferred, not deleted, see D35/D37):**
     1. Derive a synthetic email the person never sees: `${phoneDigits}@phone.invalid`
        (`phoneDigits` = the E.164 input with the leading `+` stripped).
     2. `auth.admin.createUser({ email: syntheticEmail, phone, phone_confirm: true,
        user_metadata: { role, display_name: displayName } })` — creates the `auth.users` row
        with **both** identifiers set in **one** call. **Order matters, per D40:** generating the
        link first and attaching the phone via a separate write afterward silently invalidates
        that link's token — found live, only once a real link was actually clicked.
     3. `auth.admin.generateLink({ type: 'invite', email: syntheticEmail, options: { redirectTo:
        siteUrl } })` — generates a link for the now-already-existing user. No `data` needed
        here (confirmed live it doesn't clear the `user_metadata` step 2 already set); no write
        of any kind happens to this account again after this point.
     4. **Required, not optional (found live — see D37):** directly `UPDATE public.users SET
        email = NULL, phone = phoneDigits WHERE id = user.id` via the service-role client.
        `handle_new_user()` already ran at step 2 using the synthetic email. Skipping this step
        leaks the synthetic email into every display surface in the app.
     The person opens the shared link (via the app's own `#/accept-invite` route, D38 — not a
     link to Supabase's own verify endpoint), sets their own password, then signs in with
     **phone + password** — a new sign-in mode, not OTP. The frontend derives the same synthetic
     email client-side (a pure function of the phone number, kept in sync by hand with the Edge
     Function's copy — same tolerated-duplication pattern as the role list, §4.3.12 step 2) and
     calls ordinary `signInWithPassword`.
5. Both paths fire the **same, unmodified** `handle_new_user()` trigger (migration 0002,
   fixed for `co-admin` in decision #46, fixed again for `phone`/nullable `email` in migration
   0014/D35) at the `generateLink` step — it reads `role`/`display_name` out of
   `raw_user_meta_data`. The phone path's step 4 (D37) then directly corrects the row this
   trigger produced, rather than the trigger itself needing to know about synthetic emails.
6. Return `{ "user_id": "...", "email": "...", "invite_link": "..." }` for the email path, or
   `{ "user_id": "...", "phone": "...", "invite_link": "..." }` for the phone path (D37 — both
   paths now return a link; the admin's UI is responsible for the "copy/share this link" step in
   either case), on success; `{ "error": "..." }` otherwise.

**D34's original "known, accepted limitation" (email deliverability) is retired by D36, not just
documented as acceptable** — since Supabase no longer sends the email at all, there is nothing
left to land in spam or go undelivered; delivery is now entirely in the admin's own hands, via
whatever channel the recipient actually checks. **D37 extends the same benefit to phone**: the
active phone-invite path needs no SMS provider at all, at invite time or at sign-in — that
prerequisite only applies if/when D35's deferred OTP design is actually revived.

### 4.4 Dependencies

| Package | Required for | Why this version, not a newer one |
|---|---|---|
| `react`, `react-dom` | UI | 18.x; 19 has churn. |
| `vite` | Build | 5.x; 6 is current but 5 is stable on Netlify. |
| `typescript` | Types | 5.x. |
| `tailwindcss` | Styling | 3.x; 4 has config-format churn. |
| `@supabase/supabase-js` | DB client | 2.x; matches the Supabase CLI. |
| `@tanstack/react-query` | Server state | 5.x. |
| `wouter` (or `react-router-dom` with `HashRouter`) | Routing | wouter is smaller; React Router has more docs. Either is fine. |
| `zod` | Schema validation | 3.x. |
| `vite-plugin-pwa` | Service worker | 0.20.x. |
| `vitest`, `@testing-library/react` | Tests | Latest. |
| `@capacitor/core`, `@capacitor/android` (D18) | Wraps the existing Vite/React app for Android; Android ships first, `@capacitor/ios` added when iOS work starts | Capacitor wraps the same codebase rather than a rewrite — new dependency, per AGENTS.md's rule 2, logged here rather than silently added. |
| `@capacitor/app` (decision #47) | Wires the Android hardware/gesture back button to real in-app navigation — a web/PWA build relies entirely on the browser's own back handling, which a native wrap has none of. | Found missing on the first real-device test; a genuine gap, not a nice-to-have — without it there's no way out of a sub-page on a native build. Logged here after the fact; should have been logged at the same time it was added. |
| `antd` (D67 — **open**) | Ant Design 6 — the **client review deck's** second design language, not the app's. Imported only by `src/components/storybook-ant/`, never by `src/main.tsx`, and built only into `dist-storybook-ant/`. Logged here per AGENTS.md's rule 2 rather than added silently; whether it becomes the app's look is the client's call, **D67** in `SPEC-AMENDMENT-v4-plan-md.md`. | The client asked to see the same 32 chapters in Ant Design as well as the Tailwind build, and a comparison he can click through settles it better than prose. If D67 resolves to Ant, this moves into the app and the Tailwind deck retires; if it resolves to Tailwind, this row and `@ant-design/icons` come back out. |
| `@ant-design/icons` (D67 — **open**) | The icon set deck 2 draws with. | Same confinement and the same open decision as `antd` above. Six glyphs Ant does not ship (fish, scale, layers, thermometer, waves, snowflake) are documented substitutions in the deck's icon map. |
| `fuse.js` (D44) | Client-side fuzzy matching for Search phase 1, used by `src/lib/search.ts` only. | 7.x; zero dependencies, Apache-2.0. Logged here retroactively (2026-10-02 reconciliation) — it arrived with the search commit without a row. |
| `@radix-ui/react-slot`, `@radix-ui/react-collapsible`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` (Phase A UI redesign) | The shadcn-style component layer under `src/components/ui/` (`button`, `tile`, `collapsible`) and its `cn()` helper in `src/lib/utils.ts`; `tailwindcss-animate` is a Tailwind plugin wired in `tailwind.config.ts`. | These are unstyled primitives and class-merging helpers over **Tailwind** — the components are copied into this repo and styled with this repo's own classes, so none of them is "a UI kit that ships its own design system" and the ban below is not breached. Logged retroactively (2026-10-02): they landed with the Phase A redesign, which has **no SPEC section yet** — see `BUILDER-DECISIONS-REVIEW.md` decision 93. |
| `lucide-react` | The icon set for the app shell (`Layout.tsx`) and the Tailwind review deck. | Imported per icon (`import { LogOut } from 'lucide-react'`); ISC. Same retroactive logging and same open item as the row above. |
| `@capacitor/cli` (D18) | The `cap sync` command behind `npm run cap:sync`. | Present in `dependencies`; it is a build-time tool and belongs in `devDependencies`. Left as found rather than moved during a docs reconciliation — move it the next time `package.json` is touched for another reason. |
| `playwright` (dev only) | The capture and perf scripts in `scripts/` (`capture-*.mjs`, `perf-check.mjs`). | `devDependencies`, imported by nothing under `src/`, never in the app bundle. |

**Reconciliation note (2026-10-02).** This table is the SPEC's statement of intent and `package.json` is the fact; the two had drifted. The rows above close the *undeclared* side. The other direction, so a future session does not re-discover it: `zod` is listed above but was never adopted (nothing under `src/` imports it); `wouter` was not chosen — the app uses `react-router-dom` with `HashRouter`, which the row permits; `vite-plugin-pwa` is on 1.x rather than the 0.20.x the row names. None of those three is a rule-2 breach (rule 2 is about *adding* packages), but each is a fact the table did not state.

**Forbidden in `package.json`**: `lodash`, `moment`, `dotenv`, `axios` (use `fetch`), any UI
kit that ships its own design system (MUI, Chakra, Mantine). The app's look is Tailwind, full
stop. Reason: the same TINS-discipline reason as exam-forge — every dependency is a thing
that can rot.

**One conditional exception, logged in the table above rather than smuggled in:** `antd` (Ant
Design 6) is present for the **client review deck only**. It is imported by
`src/components/storybook-ant/` and by nothing in the app, and it exists so the client can compare
two design languages over identical chapter data — **D67**, open. The ban above is about the app,
and it still holds there: if D67 resolves to Tailwind, `antd` and `@ant-design/icons` are removed
from `package.json` rather than left behind as a second look nobody uses.

**Edge Functions are a separate artifact type from this table** (D34) — they're not an npm
dependency of the main app, they run in Supabase's own Deno runtime under
`supabase/functions/<name>/`, deployed independently (Supabase Dashboard's Edge Functions UI, or
the Supabase CLI — either works, no CLI requirement forced on the user). `invite-user` is the
first one this project has; its own dependency is `@supabase/supabase-js`, imported via an
`https://esm.sh/` URL inside the function itself (Deno's standard import mechanism), not listed
in the main app's `package.json` at all.

---

## 5. Style guide

- **Type:** system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`).
  No web font. Reason: load time on the 2021 Android target.
- **Colours:** Tailwind defaults. Primary `indigo-600`. Destructive `red-600`. Success
  `emerald-600`. Warning `amber-500`. The 4-role badge colours are: admin `indigo`,
  vendor-rep `emerald`, worker `slate`, super-worker `slate`.
- **Spacing:** Tailwind's 4px grid. Forms have 16px (4 units) gap between fields.
- **Tamil script:** the default browser font for Tamil is fine; do not load a Tamil web font.
  If a customer device lacks Tamil glyphs, the field renders as boxes — this is the device's
  problem, not the app's. (Phase 2 may add a fallback font.)
- **Money:** always prefixed with `₹` and `kg` always suffixed with `kg` (e.g. `₹650/kg`).
- **Time:** 24-hour format with the date in `DD MMM` (e.g. `04 Aug`). No seconds in
  the UI; the audit log shows seconds.
- **Loading states:** every async action shows a spinner. No "Loading..." text without a
  spinner.
- **Empty states:** every list view has a considered empty state with a primary action
  button (per §3.7).

---

## 6. Accessibility

- **WCAG 2.1 AA** is the target. Not AAA; that's a different conversation.
- All form inputs have `<label>` elements, not just placeholders.
- All interactive elements have a visible focus ring.
- The colour palette is AA-compliant for text/background pairs (Tailwind defaults mostly
  pass; we use the `600` and `700` shades for body text on white).
- The dashboard and tables have semantic HTML (`<table>`, `<thead>`, `<th scope="col">`).
- Touch targets are at least 44×44 px (Tailwind's default button size).
- The offline banner is `role="status" aria-live="polite"`.

---

## 7. Error handling

| Failure | Behaviour |
|---|---|
| Supabase API error on a mutation | Toast: "Couldn't save: <error.message>". The mutation is not retried. The form remains filled. |
| Auth session expired | Redirect to `/login?reason=session_expired`. The toast explains. |
| Network offline | Banner: "Offline — read only". Mutation buttons disabled. (D6) |
| RLS denies a write the user attempted | Toast: "You don't have permission for this action." The form remains filled. |
| `batches.kg_remaining` < 0 (logic bug) | The CHECK constraint at the column level (added in `0001_init.sql`) raises an exception. The transaction rolls back. The audit log records the failed attempt as a system event (no user action). |
| Spoilage or sale with insufficient stock | Toast: "Insufficient stock: requested X kg, only Y kg available." The form is pre-filled with `Y` and asks for confirmation. |
| Seed data fails (idempotency check) | The validator (`npm run validate`) fails loudly. The dev server does not start. The error names the failing row. |
| Two spoilage requests race | `FOR UPDATE` serialises them. The second sees the reduced `kg_remaining` and cascades correctly. |
| Service worker fails to install | The app still works (online-only). The offline banner is permanently shown. A console warning explains. |
| Storage quota exceeded (IndexedDB) | The app evicts the oldest read snapshot. The offline cache is partial; the banner shows "Offline cache partial — recent data only." |
| Clock changed (user adjusts system time) | All timestamps are `timestamptz` UTC. The UI renders in local time. A clock change does not affect storage. |
| Phone OTP not delivered | The login form shows "Didn't get the code? Try again in 30 seconds." The OTP has a 5-minute TTL. |

---

## 8. Acceptance criteria

Numbered, mechanically checkable, every one. The validator (`npm run validate`) runs all of
these and exits non-zero on any failure. **No `--force` flag exists.**

### 8.1 Schema integrity
- **§8.1a** The migration `0001_init.sql` applies cleanly to a fresh database.
- **§8.1b** Re-applying `0001_init.sql` (the idempotency test) is a no-op (uses `IF NOT
  EXISTS` everywhere).
- **§8.1c** Every table in §4.2 exists with the exact column set.
- **§8.1d** Every foreign key constraint in §4.2 is enforced.
- **§8.1e** The CHECK constraint on `movements(from_location_id, to_location_id)` rejects
  `(NULL, NULL)`.

### 8.2 RLS policies
- **§8.2a** A user with `role='worker'` can `SELECT` from `skus` but cannot `SELECT` from
  `vendors` (or `audit_log`).
- **§8.2b** A user with `role='worker'` can `INSERT` a `movements` row with `kind='transfer'`
  or `kind='spoilage'`, but not `kind='sale'`.
- **§8.2c** A user with `role='worker'` cannot `UPDATE` any table.
- **§8.2d** A user with `role='vendor-rep'` can `INSERT` into `batches` and `movements` and
  `sales`, but cannot `INSERT` into `vendors` or `skus`.
- **§8.2e** Only `admin` can `SELECT` from `audit_log`.
- **§8.2f** The `audit_trigger()` function can write to `audit_log` even when the calling
  user lacks `INSERT` permission directly.

### 8.3 Audit log integrity
- **§8.3a** Every `INSERT` on `batches`, `movements`, `sales`, `vendors`, `skus`,
  `price_history` produces exactly one `audit_log` row with `action='INSERT'`,
  `after_json` equal to the new row, and `before_json = null`.
- **§8.3b** Every `UPDATE` on those tables produces one `audit_log` row with
  `before_json` and `after_json` capturing the diff.
- **§8.3c** A direct `INSERT` into `audit_log` from any non-trigger role is denied by RLS.
- **§8.3d** The `audit_log` table has no `UPDATE` or `DELETE` policy (immutable).

### 8.4 Algorithm correctness
- **§8.4a** Spoilage of X kg from (S, L) reduces `sum(kg_remaining)` at (S, L) by exactly X.
- **§8.4b** Spoilage of X kg where the oldest batch has less than X produces 2+ movement
  rows sharing the same `movement_group_id` and reducing the right amount from each.
- **§8.4c** Spoilage of X kg where the available stock is less than X is rejected with the
  exact shortfall named.
- **§8.4d** A transfer of X kg creates one new batch at the destination with `kg = X` and
  the correct weighted-average `price_per_kg_paid`.
- **§8.4e** A sale of X kg at price P creates a `sales` row with `total_amount = X * P` and
  cascades the source deductions as `movements` with `sale_id` set.
- **§8.4f** The FIFO ordering uses `delivered_at ASC`; ties (impossible in practice but
  defensive) are broken by `id ASC` for determinism.

### 8.5 Demo seed
- **§8.5a** `supabase/seed.sql` runs idempotently (re-running produces no errors and no
  duplicates).
- **§8.5b** After seeding, the database contains exactly 6 vendors, 25 SKUs, 3 locations
  (storage, display, freezer), 150+ movements, 20+ sales, 30+ price_history rows.
- **§8.5c** Every seeded SKU has a non-null `tamil_name` (D11).
- **§8.5d** The seed's "today's display" view (the most recent 24h of display batches) has
  at least 5 active batches.

### 8.6 Performance (the 2021 Android target)
- **§8.6a** The admin dashboard renders within 2 seconds on a 2021 Android phone on shop
  WiFi.
- **§8.6b** The worker `/floor` screen renders within 1.5 seconds.
- **§8.6c** The total JS bundle (gzipped) is under 200 KB excluding Supabase library code.
- **§8.6d** A mutation (delivery, sale, transfer, spoilage) round-trips within 1.5 seconds
  on shop WiFi.

### 8.7 Offline
- **§8.7a** Killing the network mid-session shows the "Offline — read only" banner within 5
  seconds.
- **§8.7b** While offline, every mutation button is disabled.
- **§8.7c** When the network returns, the banner disappears within 5 seconds and mutation
  buttons re-enable.
- **§8.7d** The service worker is registered and caches at least the app shell.

### 8.8 Auth
- **§8.8a** The first sign-up becomes `admin` (per the trigger in §2.2.2).
- **§8.8b** Subsequent sign-ups default to `worker`.
- **§8.8c** A `worker` user cannot reach `/admin/*` routes (the UI hides them AND the
  Supabase queries return empty / 403).
- **§8.8d** A `vendor-rep` cannot record a delivery with negative kg (Zod validation +
  Postgres CHECK).

### 8.9 Bundle and build
- **§8.9a** `npm run build` exits 0.
- **§8.9b** `dist/index.html` exists and references hashed assets.
- **§8.9c** `npm run validate` (the full §8 sweep) exits 0 on a freshly-seeded database.

### 8.10 Containers (D21)
- **§8.10a** A `container_fills` row can only reference `container_fill_items` whose `batches`
  all share the same `bill_id` — enforced at the database level.
- **§8.10b** `container_fills.expires_at` equals `filled_at` plus the minimum
  `shelf_life_hours` across its SKUs.
- **§8.10c** A container with no `container_fills` row having `kg_remaining > 0` is reported as
  available by the derived-status query.
- **§8.10d** A sale/transfer/spoilage sourced from container-tracked storage draws fills in
  `expires_at ASC` order.

### 8.11 Repack (D21)
- **§8.11a** A repack never changes the destination fill's `filled_at`/`expires_at` relative
  to the source fill.
- **§8.11b** After a repack empties the source fill, its container is reported available.

### 8.12 Transfer timestamp fix (D-amendment §C.4)
- **§8.12a** A transfer sourced from container-tracked storage creates a destination whose
  shelf-life-relevant timestamp equals the source fill's `filled_at`, not the transfer time.

### 8.13 Payments and reversal (D22)
- **§8.13a** A sale's outstanding balance, computed as `total_amount - sum(payments.amount)`,
  is never stored on `sales` or `customers` (D17).
- **§8.13b** A `reversal_requests` row with `status='executed'` has a non-null
  `executed_movement_group_id`, and the referenced `movements` rows sum to a full offset of
  the original sale's cascade.
- **§8.13c** A user with `can_self_reverse = false` cannot transition a `reversal_requests`
  row directly to `approved`.

### 8.14 RLS additions (D23, D26)
- **§8.14a** A non-admin user cannot `SELECT` another warehouse's `customers`/`sales` rows once
  `warehouse_id` scoping is enforced.
- **§8.14b** The Looker Studio read-only role cannot `INSERT`, `UPDATE`, or `DELETE` on any
  table.

### 8.15 Location/warehouse model (D29, new)
- **§8.15a** The seeded `locations` table for a single-warehouse deployment contains exactly
  one row, `kind='warehouse'` — no `display` or `freezer` rows are seeded going forward.
- **§8.15b** A `transfer` movement is only creatable between two rows in `locations` that
  belong to **different** `warehouse_id`s — a same-warehouse "transfer" is rejected; the
  correct operation for moving stock within one warehouse is `repack`.

### 8.16 Offline write-queue (D30, new)
- **§8.16a** A worker-role mutation (repack, spoilage, haul-confirmation) attempted while
  offline is queued locally, not rejected outright, and is visibly marked pending.
- **§8.16b** On reconnect, every queued write is either applied or surfaced as a conflict
  requiring the worker's attention — never silently dropped.

### 8.17 No price broadcast (D31, new)
- **§8.17a** No `notifications.type` value in the taxonomy (§F) is triggered by a
  `price_history` INSERT/UPDATE.
- **§8.17b** `sales.sale_price_per_kg` is always supplied by the person recording the sale
  (never auto-filled from `price_history` without the ability to override).

---

## 9. Out of scope

Revised for v2 (Mode B) — several V1 items below moved **into** scope (struck through with
where they now live) since D18–D31 confirmed real requirements for them. Remaining items are
still explicitly NOT built; they may be added in Mode C if the pilot proves demand.

**Moved into scope by this merge, no longer "out of scope":**
- ~~Multi-store / multi-location business~~ → multi-**warehouse** schema ships in Mode B, D23.
- ~~Offline write-queue~~ → confirmed Mode B scope for the worker role specifically, D30, §2.14.
- ~~Reverse-sale / reverse-movement~~ → in scope, modeled as new movements never an UPDATE, D22, §C.5.
- ~~Customer CRM~~ → necessary-only fields ship in Mode B, D-amendment §B.7 (`customers`).
- ~~iOS-specific design~~ → iOS confirmed in scope (Android first), D18, superseding D13.
- ~~Barcode scanning~~ → QR container scanning ships in Mode B, D21.
- ~~Photo capture~~ → soft-gated, three-state (`none`/`pending_upload`/`uploaded`) for receiving
  confirmations, spoilage claims, and payment proof, D25/D19.
- ~~Reports beyond the dashboard~~ → Google Looker Studio, delivered to mobile, D26/D18.
- ~~Email / SMS notifications~~ → WhatsApp + native push notification taxonomy, D20/D27 (§F —
  core transactional subset ships; the softer entries below are still deferred).

**Still explicitly out of scope:**
- **POS / checkout UI** — sales recording, not a till.
- **GST invoicing** — tax computation and invoice PDFs. (The dormant GST-track schema exists,
  D24, but the invoicing UI itself is still deferred.)
- **Supplier contracts / purchase orders** — vendors are received as they arrive; `bills` (D-amendment
  §B.5) captures the purchase, but there's no PO/contract workflow.
- **WhatsApp inbound automation** — outbound-only in this phase, D20.
- **n8n** — deferred, D20.
- **The super-admin cross-store transfer-approval flow** — schema/role built (D23) but the
  workflow can't be meaningfully tested without a second warehouse existing.
- **Full notification taxonomy** — the core transactional subset ships (§F); daily reports and
  cold-call/follow-up count tracking are held for a later pass — the latter is flagged as a
  genuinely unsolved problem (self-reported activity claims aren't independently verifiable),
  not just postponed.
- **Metabase / any self-hosted BI tool** — Looker Studio (D26) covers this without a server.
- **Multi-currency** — INR only. `numeric(10,2)`, no currency code column.
- **Full Tamil/Hindi UI translation** — the UI is English; fish names are bilingual (D11). A
  **Tanglish** (mixed Tamil/English) approach was raised as a possibility worth exploring, not
  yet a locked decision — see the closing notes.
- **Self-hosted Supabase** — managed free tier for now; self-hosting is the upgrade path for
  the day the free tier is no longer enough.
- **Worker-records-sale** — vendor-rep and admin/co-admin record sales. A worker who needs to
  record a sale is given a vendor-rep role.

---

## Appendix A: Demo seed data

> **Historical, Mode A only.** This describes the original demo seed (`storage`/`freezer`/
> `display`, three named locations) as it shipped for the gatekeeper demo. D29 has since
> established this doesn't match the real operation (one warehouse, no display, no freezer).
> Kept here unchanged as the historical record of what Mode A actually demoed — do not use this
> as the model for Pilot's real data migration; use §2.5/§2.5a instead.

The seed (`supabase/seed.sql`) creates the following. The full SQL is in the spec repo; this
appendix is the inventory, not the data.

### A.1 Vendors (6)

| Name | Port / village | Phone | Boat | Typical catch |
|---|---|---|---|---|
| Murugan | Royapuram | +91 9XXXX 11111 | (none) | Pomfret, surmai, bangude |
| Ravi | Kasimedu | +91 9XXXX 22222 | Sri Devi | Vanjaram, prawns |
| Selvam | Ennore | +91 9XXXX 33333 | (none) | Mixed catch, crabs |
| Karthik | Mahabalipuram | +91 9XXXX 44444 | Velmurugan | Prawns, squid |
| Mani | Cuddalore | +91 9XXXX 55555 | (none) | Sardines, mackerel |
| Ganesan | Pondicherry | +91 9XXXX 66666 | Lakshmi | Tuna, seer fish |

### A.2 SKUs (25)

| Code | English | Tamil | Category | Size | Unit | Shelf life (h) | Storage |
|---|---|---|---|---|---|---|---|
| FISH-POMFRET-MED-001 | Pomfret | வவ்வால் | fin_fish | medium | kg | 24 | chilled |
| FISH-POMFRET-LG-001 | Pomfret | வவ்வால் | fin_fish | large | kg | 24 | chilled |
| FISH-POMFRET-SM-001 | Pomfret | வவ்வால் | fin_fish | small | kg | 24 | chilled |
| FISH-SURMAI-LG-001 | Seer fish | வஞ்சரம் | fin_fish | large | kg | 24 | chilled |
| FISH-SURMAI-MED-001 | Seer fish | வஞ்சரம் | fin_fish | medium | kg | 24 | chilled |
| FISH-BANGUDE-MED-001 | Mackerel | கானாங்கெளுத்தி | fin_fish | medium | kg | 18 | chilled |
| FISH-BANGUDE-SM-001 | Mackerel | கானாங்கெளுத்தி | fin_fish | small | kg | 18 | chilled |
| FISH-MATHTHI-MED-001 | Sardine | மத்தி | fin_fish | medium | kg | 12 | chilled |
| FISH-SOORAI-MED-001 | Tuna | சூரை | fin_fish | medium | kg | 24 | chilled |
| FISH-VAVAL-MED-001 | Trevally | வவ்வல் | fin_fish | medium | kg | 24 | chilled |
| FISH-KATLA-LG-001 | Katla | கட்லா | fin_fish | large | kg | 36 | chilled |
| FISH-VIRAAL-MED-001 | Murrel | விரால் | fin_fish | medium | kg | 36 | chilled |
| FISH-KELANGA-SM-001 | Anchovy | கெழங்கு | fin_fish | small | kg | 8 | chilled |
| FISH-IRAAL-LG-001 | Prawns (large) | இறால் | crustacean | large | kg | 36 | chilled |
| FISH-IRAAL-MED-001 | Prawns (medium) | இறால் | crustacean | medium | kg | 36 | chilled |
| FISH-IRAAL-SM-001 | Prawns (small) | இறால் | crustacean | small | kg | 24 | chilled |
| FISH-NANDU-MED-001 | Crab | நண்டு | crustacean | medium | piece | 24 | chilled |
| FISH-NANDU-LG-001 | Crab | நண்டு | crustacean | large | piece | 24 | chilled |
| FISH-KANAVAI-MED-001 | Squid | கணவாய் | cephalopod | medium | kg | 48 | chilled |
| FISH-KANAVAI-LG-001 | Squid | கணவாய் | cephalopod | large | kg | 48 | chilled |
| FISH-SHELL-POND-001 | Pondicherry mussel | சிப்பி | shellfish | mixed | kg | 48 | chilled |
| FISH-SHELL-CLAM-001 | Clam | மட்டி | shellfish | mixed | kg | 36 | chilled |
| FISH-DRIED-NETTL-001 | Dried anchovy | நெத்திலி | dried | small | kg | 720 | ambient |
| FISH-DRIED-BOM-001 | Bombay duck | பொம்மை | dried | mixed | kg | 720 | ambient |
| FISH-DRIED-PRAW-001 | Dried prawns | இறால் | dried | small | kg | 720 | ambient |

### A.3 Locations (3)

| name | display_name | kind |
|---|---|---|
| `storage` | Cold Storage | storage |
| `freezer` | Deep Freezer | freezer |
| `display` | Display Counter | display |

### A.4 Movements (~150 over 14 days)

The seed generates 14 days of movements backwards from "now" (the seed run time):

- 1–3 deliveries per day, distributed across vendors, totalling 14 × 2 = ~28 deliveries.
- 2–4 transfers per day (storage → display), totalling ~50.
- 1–2 transfers per day (display → spoilage on aged fish), totalling ~20.
- 2–4 sales per day, totalling ~50.

The timestamps are spread realistically (deliveries at ~6 am, transfers at ~8 am and
~2 pm, sales at ~10 am and ~5 pm). The seed uses a fixed random seed for reproducibility.

### A.5 Sales (~20)

Customers are fictional retail shops and restaurants:

- Saravana Stores, Murugan Idli Shop, Adyar Ananda Bhavan, Sangeetha Veg, Hot Breads
  (T. Nagar), GRT Sweets, Pothys Kitchen, Sri Balaji Chat, local catering businesses,
  walk-in retail customers (recorded as "Walk-in").

Each sale has `total_kg` between 1 and 25, `sale_price_per_kg` set from the
`price_history` for that day, `total_amount = total_kg * sale_price_per_kg`.

### A.6 Price history (30+ rows)

A reference price per SKU for each of the last 30 days. Prices vary within ±15% to simulate
the daily fluctuation of fresh-catch pricing. The seed is deterministic.

### A.7 Users (3)

| Email | Role | Display name |
|---|---|---|
| `admin@jayshankar.demo` | admin | Karthik (the wholesaler) |
| `rep@jayshankar.demo` | vendor-rep | Anitha |
| `worker@jayshankar.demo` | worker | Suresh |

The passwords are seeded into `auth.users` via the Supabase admin API, not via SQL
(passwords are hashed). The seed script handles this with a one-time `supabase.auth.admin.createUser()`
call (a server-side helper, not in the SQL).

---

## Appendix B: Migration plan (Mode A → B → C)

### B.1 Mode A (Demo) — ship target: 1–2 weeks

- Supabase project created (free tier).
- Migrations applied (`0001_init.sql`).
- RLS policies applied.
- Seed data loaded.
- Frontend deployed to Netlify.
- Demo banner visible; role-switcher enabled.
- **Deliverable:** a live URL the client can log into and click through.

### B.2 Mode B (Pilot) — 2–4 weeks after client sign-off

- Demo banner and role-switcher disabled via feature flag.
- Real data migration: paper / Excel → app. The wholesaler's existing records are entered
  manually by the admin or imported from a CSV via a one-time script
  (`scripts/import-legacy.mjs` — to be written in Mode A or early Mode B).
- Client feedback loop. Each round of feedback is captured as a SPEC amendment before code
  changes (TINS).
- The schema's RLS policies are tested against the real roles the wholesaler assigns
  (e.g. the wholesaler may want a "manager" role distinct from admin — D3 handles this
  with a one-line migration).
- The worker's actual devices are identified. If the worst device is worse than the 2021
  Android target, the spec amends §1 to name it.

### B.3 Mode C (Production) — after Pilot stabilises

- Demo seed removed.
- Demo banner code removed (or kept for staging environments).
- The validator's `npm run validate` runs in CI on every push.
- Backup strategy in place: Supabase daily backups, plus the wholesaler can export
  `audit_log` and `movements` as JSON.
- The spec is at v1.x. v2 features (POS, GST, customer CRM, etc.) are tracked in a
  `ROADMAP.md` (to be created at the start of Mode C) and added only when the wholesaler
  asks for them and the pilot data proves the demand.

---

## Notes on what I guessed, what I assumed, and what's most likely to be wrong

### A. Things I guessed
- The fish list in Appendix A.2 is a plausible Tamil Nadu wholesale set based on
  `pomfret = வவ்வால்`. If the wholesaler is in a different region (Tuticorin, Rameswaram,
  Nagapattinam) the names and Tamil spellings will differ. Easy to fix in Mode B; the
  schema does not change.
- The vendor names in Appendix A.1 are common Tamil names. They are placeholders, not real
  people.
- The shelf life hours are estimates. The wholesaler will have authoritative numbers from
  experience; the seed is "good enough for a demo."
- The 30-day price history's ±15% variation is a guess at fresh-catch volatility. Real
  numbers will be wider or narrower.

### B. Things I assumed
- The single store, localized, day-to-day operation means **the wholesaler is the
  primary admin** and the staff (vendor-rep, worker) is **employed by the wholesaler,
  not contracted**. This affects the auth model: staff are users, fishermen are not.
- The wholesaler has reliable shop WiFi (the V1 device target assumes connectivity). True
  offline operation is a V2 problem.
- The wholesaler is comfortable with English UI. The data is bilingual (D11) because the
  fish names matter; the UI is English because the wholesaler can read it.
- The ex-retailer client (the gatekeeper) will judge the demo on **look and feel + the
  three roles working**, not on architectural rigor. The seed data is designed to
  impress without lying.

### C. What's most likely to be wrong
- **§4.3.3 transfer algorithm's vendor attribution.** I picked "the vendor of the largest
  source batch, tiebreak oldest." The wholesaler may want a different rule (e.g. "if any
  source batch is from a known premium vendor, use that vendor's name"). Easy to amend;
  worth a question in Mode B.
- **§2.13's role-switcher.** This is a demo-only feature, but the spec says it lives
  behind a feature flag. The client may want a "see how it looks as another role" ability
  even in production (for training new staff). That is a Mode C conversation.
- **§4.3.5 trigger for `kg_remaining` updates.** I described a "safety net" trigger; the
  cascade is application-level. In practice the trigger is the only place that should
  maintain `kg_remaining` (single source of truth). I split it this way to keep the
  application logic visible, but the cleaner design is **all-movements-update-batches
  in the trigger, application just inserts movements**. Worth a §4.3.5 amendment if
  Mode B reveals maintenance pain.
- **§2.14's offline read-only mode.** The worker is the primary offline user (D6). If
  Mode B reveals the worker genuinely needs to record picks offline, the spec's
  "V1 is read-only offline" stance needs to change. The upgrade path is in §9 but the
  cost (a real write-queue, conflict resolution, sync UX) is significant.
  **Resolved by D30 (2026-09-10): yes, confirmed needed — see §2.14.**

### D. v2 merge (2026-09-10) — what's still genuinely open, not resolved by this pass

This section A/B/C above is the original W1 (2026-08-05) record, left unchanged as history. The
following are open questions surfaced during the v2 merge that this pass deliberately did **not**
resolve — don't mistake their presence here for an oversight; they're flagged because closing
them prematurely would mean guessing at things only the client can actually answer:

- ~~Box/container quantities.~~ **Resolved by D32** (2026-09-11): quantities are wholesaler-
  entered through the app (a bulk-register convenience over individually-numbered containers),
  not a spec-locked count; custom sizes beyond the 5 presets are supported the same way.
- **GST registration status.** D24's dormant-track design means the build isn't blocked by not
  knowing, but the answer is still genuinely unknown.
- **Credit terms and second-warehouse timing.** Both still open, both from the same client-qa
  source, both still relevant to D23/D-amendment §B.7's design once real answers exist.
- **Tanglish UI.** Raised as "maybe a good approach" (not "the wholesaler is comfortable with
  English UI," per the original §0.3's now-superseded assumption) — a genuine, not-yet-decided
  possibility, not a locked decision. Whoever picks this up next should treat it as an open
  design question worth a real conversation, not default silently to either English-only or a
  translation pass.
- **Exact offline-write conflict-resolution UX (D30).** The *need* is now locked; the *design*
  of what a worker sees when a queued write conflicts with server state is real work, not yet
  specified here.
- **Staff follow-up/cold-call verification** — flagged in the amendment's own §F as a genuinely
  unsolved problem (self-reported activity isn't independently verifiable), not just deferred.

---

*End of SPEC.md v2. See `HANDOVER.md` for current work-queue status and
`BUILDER-DECISIONS-REVIEW.md` decision #36 for the full v1→v2 merge record.*
