# Contributing to Jayshankar

Welcome. This document is for **developers** working on the codebase. **If you are an AI assistant, start at [`../AGENTS.md`](../AGENTS.md), then [`../NEXT-AGENT-ONBOARDING.md`](../NEXT-AGENT-ONBOARDING.md)** — they hold the standing rules and the read order. This file is for people at a normal IDE with Node 18+.

## What this project is

Jayshankar is a working inventory management web app for a Tamil Nadu fresh-fish wholesale. See [`README.md`](../README.md) for the overview, [`SCHEMA.md`](./SCHEMA.md) for the database schema, and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design rationale. **This project is spec-first (TINS):** `SPEC.md` is the source, and a defect is fixed by editing it and regenerating.

## Repository layout

jayshankar/ ├── src/ # React + TypeScript app │ ├── components/ # Reusable UI (Layout, RoleBadge, FormFields, RecentActivity, StockBySku, OfflineBanner, SignInForm) + storybook/ (the deck: blocks.tsx renderer, Phone/DesktopFrame, ChapterPlayer) + storybook-ant/ (the same 32 chapters drawn in Ant Design 6 — a review build, not the app) │ ├── pages/ # Route-level components (AdminDashboard, RepDashboard, FloorDashboard, AuditLog, *Form) + Storybook.tsx, StorybookReview.tsx │ ├── lib/ # auth.ts (session hook), supabase.ts (client), mutations.ts (recordDelivery/Sale/Transfer/Spoilage), online.ts (offline detection) + storybook/ (types.ts + 32 chapters of screen data) │ ├── App.tsx # role-gated router │ ├── main.tsx # entry point + storybook-main.tsx (standalone deck build) + storybook-ant-main.tsx (the Ant deck build, once wired) │ └── index.css # Tailwind directives + system font + focus rings ├── supabase/ # Backend (Postgres + Auth + RLS + Realtime) │ ├── migrations/ # 0001 init, 0002–0036 follow-ups (applied to the live project); 0037–0046 (Phase B) written, tested on a scratch Postgres and **staged here but not applied** — see docs/BACKEND-PHASE-B-STATUS.md. All are idempotent. The next new migration is 0047 │ ├── rls-policies.sql # the full RLS policy set │ └── seed.sql # demo data (6 vendors, 25 SKUs, 3 locations, 155 movements, 52 sales) ├── scripts/ # Zero-dependency Node scripts │ ├── validate.mjs # the gate (73 checks) │ ├── selftest.mjs # proves the validator fails on known defects │ ├── seed-auth-users.mjs # creates the 3 demo users in Supabase Auth │ ├── rename-storybook-entry.mjs # names the deck's built entry index.html │ └── publish-storybook.sh # builds + pushes the review deck to its own repo ├── docs/ # Operator documentation │ ├── ARCHITECTURE.md # technical design rationale │ ├── DECISIONS.md # narrative decision log (#1–#42; SPEC §0.2 is the locked-decision table) │ ├── SCHEMA.md # full database schema │ ├── SCHEMA.png # ER diagram (from Supabase dashboard export) │ ├── SUPABASE-SETUP.md │ ├── DEPLOY-NETLIFY.md │ ├── DEPLOY-GITHUB-PAGES.md # hosting on Pages: the app, or just the review deck │ ├── REVIEW-BUILD.md # the client deck: build it, publish it, what to send, what to ask │ ├── BACKEND-REQUIREMENTS-phase-b.md # what each deck screen would need in order to be real │ ├── deprecated/ # retired documents, moved not deleted — see its README │ └── (the W2–W5 manual checklists now live in deprecated/mode-a-checklists/) ├── public/ # icons + PWA assets + the app's 69 MB tutorial videos ├── storybook-public/ # public assets for the standalone deck build only (this is how the videos stay out of it) ├── netlify.toml # Netlify build config ├── storybook.html # entry point for the standalone review-deck build ├── vite.storybook.config.ts # builds the deck on its own → dist-storybook/ ├── package.json # dependencies + scripts ├── vite.config.ts # Vite + vite-plugin-pwa config ├── tailwind.config.ts # Tailwind config └── tsconfig.json # TypeScript config

## Set up your dev environment

### 1. Install dependencies

node --version # need >= 18 npm install
### 2. Set up Supabase

You need a Supabase project. Follow [`SUPABASE-SETUP.md`](./SUPABASE-SETUP.md) — it walks you through:

- Creating the project
- Applying the migrations in order (`0001` → `0036`). `docs/SUPABASE-SETUP.md` §"Applying the later migrations" has the current order; `0037`–`0046` are staged but not applied, so read `docs/BACKEND-PHASE-B-STATUS.md` before applying them
- Running the seed
- Creating the 3 demo auth users

Total time: ~10 minutes if you already have a Supabase account.

### 3. Configure environment

Copy `.env.example` to `.env` and fill in the two `VITE_SUPABASE_*` values. Copy `scripts/.env.example` to `scripts/.env` and fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. **Never commit these files** — they're in `.gitignore`.

### 4. Start the dev server

npm run dev

Opens at http://localhost:5173. Sign in as `admin@jayshankar.demo`; the default demo password is set in `scripts/seed-auth-users.mjs` (overridable with `SEED_*_PASSWORD`).

### 5. Run the gate

Before every commit:
npm run validate # typecheck + 73 structural checks; exits non-zero on any failure npm run selftest # proves the validator catches known defects npm run build # production build node tins-kit/scripts/tooling-audit.mjs # the blocking tooling gate (needs the vendored tins-kit/)

All of them must be green.

## Coding conventions

- **React 18 + TypeScript strict mode**. No `any`. No `// @ts-ignore`. If you have to fight the types, ask.
- **Tailwind 3 utility classes only.** No CSS-in-JS, no inline `style={{}}` (except dynamic values that can't be utilities).
- **TanStack Query 5 for server state, `useState` for UI state.** Server state is owned by the database; the client mirrors it.
- **No new runtime dependencies** without a row in `SPEC.md` §4.4 **in the same change** (`AGENTS.md` rule 2), and sign-off for anything that adds a server or a third-party service. `antd` + `@ant-design/icons` are the one conditional exception: the review deck's second design language, imported only by `src/components/storybook-ant/` and by nothing in the app, with the open decision **D67** in `SPEC-AMENDMENT-v4-plan-md.md` deciding whether it ever becomes the app's look.
- **Money as `numeric(10,2)`** in the database, rendered with the ₹ symbol.
- **Tamil + English** in SKU selectors and tables. The seed data has realistic Tamil names; keep them in sync when you add fish.

## Adding a feature

1. **Update `docs/SCHEMA.md`** if the schema changes. Write the migration as a new file in `supabase/migrations/` (the next number is `0047`; never edit a migration that has been applied). Migrations are idempotent — every statement uses `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
2. **Update `scripts/validate.mjs`** if you add a structural check you want enforced (e.g. a new column, a new policy). Add the check to `runLessonRecordingChecks` or one of the existing functions.
3. **Update `scripts/selftest.mjs`** with a defect case that proves your new check works. If `validate.mjs` says your check is good but `selftest.mjs` doesn't prove it can fail, the check is decoration.
4. **Record the decision.** A locked decision goes into `SPEC.md` §0.2 first — that is the table TINS's validator and reviewers read, and a decision recorded only in `docs/DECISIONS.md` is invisible to them. `docs/DECISIONS.md` then takes the narrative version (context, considered, decision, consequences). Skip both if the change is not a decision.
5. **Run the gate**: `npm run validate && npm run selftest && npm run build`. All must pass.

## What NOT to do

These are non-negotiable. The validator enforces some of them; others are caught at code review.

1. **Never bypass RLS** with a `secret` key in the browser. The secret key is server-only; never ships in the JS bundle.
2. **Never add a DELETE policy to any table.** Soft-delete via `active = false`.
3. **Never let a validator failure through.** No `--force`, no warnings-as-info.
4. **Never store money as float.** Always `numeric(10,2)` in Postgres.
5. **Hardcoded credentials are a build break.** If you paste a real Supabase key into `.env`, rotate it at the dashboard immediately. A key in a file is burned.
6. **Never edit `dist/`, `dev-dist/`, or `node_modules/` directly.** These are generated. Edit the source and rebuild.

## Testing

- The validator (`scripts/validate.mjs`) is the structural test gate.
- The selftest (`scripts/selftest.mjs`) proves the validator works.
- `scripts/test-*.mjs` are live tests: each signs in as a real demo user (not the service key, so RLS and `auth.uid()` actually run) against the live project and reads results back. Copy their shape for a new RPC.
- `supabase/tests/` is the Phase B SQL suite; it runs on a throwaway local PostgreSQL, never on Supabase: `PGHOST=/tmp PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh`.
- The Mode A manual checklists (W2–W5) are retired to `docs/deprecated/mode-a-checklists/`.
- There are **no unit tests** yet (Vitest is installed but unused). The validator, the live scripts and the SQL suite are the current contract.

## Deploying

See [`DEPLOY-NETLIFY.md`](./DEPLOY-NETLIFY.md). 30-minute walkthrough from a clean laptop to a live URL. Pre-flight gate must be green.

## Asking questions

Open an issue, or — if you're working on this with the project owner — find them in `#jayshankar` (or wherever the team's chat lives). The code is the source of truth; the docs are next; humans are last.

## License

UNLICENSED — proprietary to the project owner.








