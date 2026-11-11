# Jayshankar

## Desktop source snapshot — 2026-11-11

This main branch is prepared from the owner's Desktop Jayshankar folder, including local source/documentation changes and the vendored historical tins-kit. The prior remote default was client-walkthrough (there was no main branch); its revision is preserved on archive/before-desktop-snapshot. The client-walkthrough branch remains intact.

This is a source backup, not a new release or a claim that every feature has been revalidated. The original dated status below is historical. Follow HANDOVER.md and the backend status documents before running migrations.

Excluded from this publication: node_modules, Git metadata, local agent/IDE settings, environment credentials, signing keys, generated build/cache/render/capture outputs, ZIP bundles, the separate _external checkout, client-qa material and trash directories. Environment example files remain for setup. Demo credentials described below must not be treated as production credentials. Some historical documentation may refer to excluded local QA/media artifacts.

Install dependencies with npm ci using the committed package-lock.json. Configure local environment files from the examples, then use the existing run/gate instructions below. Dependencies and secret files must not be committed. Agent Control and the newer TINS specification are not substituted for this project's original kit.

> Inventory management for a Tamil Nadu fresh-fish wholesale — one warehouse, fish packed into numbered ice
> containers, staff in the field. A mobile-first PWA, wrapped for Android with Capacitor, on Supabase.

Built **spec-first (TINS)**: [`SPEC.md`](./SPEC.md) is the source and the application is generated from it. A
defect is fixed by editing the spec and regenerating, never by patching generated code. **If you are an AI
agent, or about to hand this repository to one, start at [`AGENTS.md`](./AGENTS.md), not here.**

## Where the project stands

The status below was true on **2026-10-02**. [`HANDOVER.md`](./HANDOVER.md) §3 is kept current; this section is
orientation, not a status report.

| Area | State |
|---|---|
| App (Mode A "Demo" through the V1 sprint) | **Built.** Role dashboards, the container model, bills and receiving, customers/payments/reversals, notifications, tasks and check-ins, fuzzy search, team invitation by email or phone, SKU/vendor/warehouse management, a tutorial library at `/learn` |
| Database | Supabase, **migrations `0001`–`0036` applied** (24 tables). `0037`–`0046` ("Phase B": procurement, truck loads, grading, quality, reports, blind receiving, closed-by-default functions) are written, tested on a scratch Postgres 16 and **not applied**. `0046` closes a real hole, so it matters more than the rest |
| Android | Capacitor project builds and has run on a real device. No Play Store submission yet |
| Client review decks | **Three, interlinked** (shared data and one address format; a Compare page puts them side by side). **Twelve persona walks** (admin at the desk / on the phone, buyer on the road, the one at the scale, grader, packer who delivers, …) play in all three. Decks 1 and 2 draw the same 32-chapter, 104-screen deck in two presentations: deck 1 in the app's own Tailwind look, deck 2 as an Ant Design 6 *workbench* (sidebar navigation, steps walk-through, tap-to-enlarge lightbox, guided tour, dark mode) — a review build only. Deck 3, *The Run*, is a different kind of deck: it follows one truck load through a day and shows what amendments v3 and v4 add (a vendor/truck mode switch, blind receiving, an offline queue, approval stamps, closed-by-default access) from several roles at once, with the database's return shape beside each screen — see `docs/REVIEW-BUILD.md` §9. Which look the app ships is the client's open decision, **D67** |
| Not built | An offline **write** queue (reads are cached; writes are not), QR scanning, Tamil UI, WhatsApp API, approvals, procurement-desk screens, frontend wiring of Phase B |
| Deadline | Play Store submission **1 December 2026**, live **15 December 2026** |

## Architecture

```
Browser / Android (Capacitor)            Supabase
+---------------------------+  HTTPS   +--------------------------------------+
| Vite + React 18 + TS      | <------> | Postgres: tables, RLS, triggers,     |
| Tailwind 3, TanStack Q 5  |   fetch  |   SECURITY DEFINER functions         |
| React Router (HashRouter) |          | Auth, Realtime, Edge Function        |
| vite-plugin-pwa (Workbox) |          |   `invite-user`                      |
+---------------------------+          +--------------------------------------+
        |
        v   static files only, no app server (Netlify)
```

- **Frontend:** Vite 5, React 18, TypeScript, Tailwind 3, TanStack Query 5, Fuse.js search, a shadcn-style
  component layer in `src/components/ui/`. Routing is **hash-based** (`/#/admin`), so static hosting needs no
  rewrites.
- **Backend:** Postgres 15 with row-level security as the access boundary — the app cannot bypass it. Business
  rules live in database functions, not in components. The audit log is append-only.
- **Auth:** email + password and phone + password; invitations are links the admin shares themselves (D34–D40).
- **Offline:** the service worker caches the app shell and recent reads; mutations are disabled offline.

Why each choice was made: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). The locked decisions are
`SPEC.md` §0.2.

## Roles

Five roles, stored as data (`users.role`): `admin`; `co-admin` (full admin capability, so a second person can run
the business); `vendor-rep` (buying and selling); `worker` (floor staff); `super-worker` (floor access plus a
rep's sales and money access). RLS distinguishes all five. Check `src/App.tsx`'s route `expected` arrays before
assuming a role's scope from its name.

## Run it locally

1. **Create a Supabase project** (free tier is enough) in the **ap-south-1 (Mumbai)** region.
2. **Apply the schema.** In the SQL Editor, run each file in `supabase/migrations/` in order, `0001` →
   `0036`, then `supabase/seed.sql`, then `supabase/rls-policies.sql` **after all migrations**. All migrations
   are idempotent. `0037`–`0046` are staged but should be applied deliberately — read
   [`docs/BACKEND-PHASE-B-STATUS.md`](./docs/BACKEND-PHASE-B-STATUS.md) §7 and §9 first, and back up.
3. **Create the demo auth users.** Copy `scripts/.env.example` to `scripts/.env`, fill in `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` (Dashboard → Project Settings → API Keys), then `node scripts/seed-auth-users.mjs`.
4. **Wire the frontend.** Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY`. The secret key never goes in `.env` and never ships in the bundle.
5. `npm install && npm run dev`, then open `http://localhost:5173/`.

**Demo accounts** (`admin@`, `rep@`, `worker@jayshankar.demo`) are created by `scripts/seed-auth-users.mjs`; its
default demo password is set in that script and can be overridden with `SEED_*_PASSWORD`. They are demo
accounts only — rotate before any non-demo deployment.

Full walkthrough with troubleshooting: [`docs/SUPABASE-SETUP.md`](./docs/SUPABASE-SETUP.md).

## The gate

```bash
npm run validate     # typecheck + 73 structural checks; must exit 0
npm run selftest     # proves the validator fails on known defects
npm run build        # production build
node tins-kit/scripts/tooling-audit.mjs   # the blocking tooling gate (needs tins-kit/, see AGENTS.md)
```

A broken gate is worse than no gate. There is no `--force`.

## Deploy

[`docs/DEPLOY-NETLIFY.md`](./docs/DEPLOY-NETLIFY.md) for the app; the two review decks deploy separately to
GitHub Pages ([`docs/REVIEW-BUILD.md`](./docs/REVIEW-BUILD.md) §7–§8).

## Database

38 tables and 8 views in the repository schema (24 tables are live at `0036`). RLS is enabled on every table.
`audit_log` is append-only — only a trigger writes to it, and no UPDATE or DELETE policy exists for any role.
Reference: [`docs/SCHEMA.md`](./docs/SCHEMA.md) (generated from the migrations) and
[`docs/API-REFERENCE.md`](./docs/API-REFERENCE.md) (every callable function added by Phase B). `docs/SCHEMA.png`
is the **old 9-table diagram** from Mode A and is kept only as history.

## Out of scope

POS and checkout, GST invoicing (the dormant GST track exists, D24), supplier contracts, multi-currency, barcode
scanning, WhatsApp **inbound** automation. The complete list, with what moved *into* scope and why, is
[`SPEC.md`](./SPEC.md) §9.

## Repository map

```
SPEC.md                    the source: locked decisions (§0.2), modules, schema, algorithms, acceptance
HANDOVER.md                state, work queue (W1–W12), gotchas, handover protocol
AGENTS.md                  onboarding and standing rules for an AI session — read this first if you are one
NEXT-AGENT-ONBOARDING.md   handing the project to a different AI or harness, with a comprehension check
BUILDER-DECISIONS-REVIEW.md / REVIEWER-DECISIONS-REVIEW.md   the decision and review logs
SPEC-AMENDMENT-v3-…, v4-…  the owner's list of intended spec changes (live, not yet merged)
src/                       React + TypeScript app; src/lib/storybook/ is the review deck's data
supabase/                  migrations (0001–0046), rls-policies.sql, seed.sql, tests/, functions/
scripts/                   zero-dependency Node scripts: the validator, selftest, seeds, live tests
docs/                      architecture, schema, setup, deploy; docs/deprecated/ holds retired documents
client-qa/                 the client's own words and design references — source material, see its README
```

## Retired documents

Superseded documents are moved, never deleted, to [`docs/deprecated/`](./docs/deprecated/) — its `README.md`
says what each was, why it was retired, and where its useful content now lives.

## License

UNLICENSED — proprietary to the project owner.
