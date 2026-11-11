# HANDOVER.md — work system

> **Read this before starting.** The spec is the source (TINS); the app is generated from it.
> `SPEC.md` §0 has the locked decisions (D1–D62 committed; D63–D76 proposed in the v3/v4 amendments). §8 has 58 acceptance criteria (the count `npm run validate` reports). This file is the
> operational guide: current state, work queue, gotchas, handover protocol.

**Last updated:** 2026-10-02 (session 14 — **methodology and documentation reconciliation against the TINS kit**: tooling gate fixed (was red); ten undeclared dependencies given `SPEC.md` §4.4 rows; the one DELETE-policy exception (D32) written into rule 5 and §3.8; stale counts corrected; superseded documents moved to `docs/deprecated/` with an index; this file's per-session diary moved out; two items need the owner — **W11** (the Phase A redesign has no SPEC section) and **W12** (amendment v3 and the Phase B migrations disagree about blind receiving). Record: `BUILDER-DECISIONS-REVIEW.md` decisions 93–94.)
**Last worked on by:** session 14 (reconciliation). Previous: session 13 (2026-09-29) — deck 2 built and wired, the Phase B docs landed as a merge, the Phase B migrations staged, `REVIEWER-DECISIONS-REVIEW.md` created.
**Current queue position:** W10 — publish deck 2 to GitHub Pages. Waiting on the owner: **W11**, **W12**, W9's merge (approved but withheld by choice), and Phase B's migration apply (blocked on one credential, per W7).

**History.** The per-session diary that used to fill the top of this file (sessions 12–13, parts 2–25, 2026-08-14 → 2026-09-29) is preserved verbatim in `docs/deprecated/HANDOVER-session-log-2026-08-to-2026-09.md`. Every part of it cites numbered decisions in `BUILDER-DECISIONS-REVIEW.md`, which stays the authoritative record. **Deadline correction:** the diary says "November 1, 2026"; the current dates are Play Store submission **1 December 2026**, live **15 December 2026** (`client-qa/session3/plan.md` §0A).

---

## 1. Sixty-second brief

- `SPEC.md` is the source. The app is generated from it. Defects are fixed by editing the spec.
- **Mode A is built** (W1–W6 done); the Netlify deploy is the user's own UI clicks (§5 W6). Since then:
  the client review deck (32 chapters), the mobile wrap (D18), the Phase B backend workstream
  (migrations `0037`–`0046` written and tested, **not applied**), and a second review deck in Ant
  Design 6 awaiting the client's choice. §5 below is the live picture; this brief is orientation, not
  status.
- Stack: Vite + React 18 + TS + Tailwind 3 + Supabase (Postgres + Auth + RLS + Realtime) + Netlify. PWA via `vite-plugin-pwa`. The Ant review deck adds `antd` for its own build only — `SPEC.md` §4.1, **D67** open.
- Three-mode lifecycle: **Demo** (seeded data, ~1–2 weeks) → **Pilot** (real data, client feedback, 2–4 weeks) → **Production** (locked schema, hardened).
- Locked decisions live in SPEC §0.2: **D1–D62** committed, **D63–D66** reserved by `SPEC-AMENDMENT-v3-truckload.md`, **D67–D76** proposed in `SPEC-AMENDMENT-v4-plan-md.md`. `docs/DECISIONS.md` #1–42 is the narrative log. The most consequential:
  - **D1** Supabase (Postgres + RLS) is the backend
  - **D2** Schema is versioned SQL migrations
  - **D4** RLS is the access boundary (not the app)
  - **D5** Audit log is append-only
  - **D7** Demo → Pilot → Production is the lifecycle
  - **D14** Demo data is real-schema, fake-content (6 vendors, 25 SKUs, etc.)
  - **D16** Validator is the arbiter; no `--force`

## 2. Environment facts (verified)

| Fact | Value |
|---|---|
| Host OS | Windows 11 (per user profile) |
| Repo root | `C:\Users\user\Desktop\Jayshankar` |
| Node | >= 18 required; the gate runs on Node 22 in the current environment |
| Git | A git repo on branch `phase-a-ui-wip`. **No remote is configured**, so nothing is pushed (see `SPEC-AMENDMENT-v4-plan-md.md` §4) |
| Supabase project | **Live**, at migrations `0001`–`0036`. Phase B (`0037`–`0046`) is written and tested but **not applied** — `docs/BACKEND-PHASE-B-STATUS.md` |
| Netlify site | Deploy is the user's own UI clicks (§5 W6). The review decks deploy separately to GitHub Pages — `docs/REVIEW-BUILD.md` §7 |
| Exam-forge reference | `archive/exam-forge-reference/` (read-only) |

## 3. State snapshot

**Gate re-verified 2026-10-02** (session 14), by running each command — documentation and `SPEC.md` prose only
changed that day, so no build was re-run:

```
$ npm run validate                               # typecheck + 73 checks     → 73 pass, 0 warn, 0 fail   PASS
$ npm run selftest                               #                           → pass 9, fail 0
$ node tins-kit/scripts/tooling-audit.mjs        # was RED before today      → Gate GREEN
$ node tins-kit/scripts/validate.mjs --spec=SPEC.md                          → 10 pass, 0 warn, 0 fail   PASS
$ (cd tins-kit && node --test scripts/selftest.mjs)   # must run from tins-kit/ → pass 56, fail 0
```

**Build state, last verified 2026-09-29** (not re-run on 2026-10-02 — no code changed):

```
$ node scripts/validate.mjs                      # the gate
  73 pass, 0 warn, 0 fail                        Result: PASS

$ npm run selftest                               # proves the validator catches known defects
  # pass 9, # fail 0                             Result: all pass

$ node tins-kit/scripts/validate.mjs --spec SPEC.md   # the kit's own structural check
  10 pass, 0 warn, 0 fail                        Result: PASS

$ npx tsc --noEmit                               # EXIT 0
$ npm run build                                  # EXIT 0
$ npm run build:storybook                        # EXIT 0 → dist-storybook/      (408 KB)
$ npm run build:storybook-ant                    # EXIT 0 → dist-storybook-ant/  (1.4 MB; 414 KB gzip)
```

- **Database:** live Supabase project, **migrations `0001`–`0036` applied**, holding real data —
  14 core tables, and (probed read-only) 130 SKUs, 12 vendors, 198 movements, 42 sales, 150
  price-history rows. Phase B (`0037`–`0046`) is **written, tested and now staged in the repo but
  NOT applied**; `docs/BACKEND-PHASE-B-STATUS.md` §9 names the one missing credential. Worth
  knowing: while unapplied, `0046` leaves a live hole — stock-rewriting `SECURITY DEFINER` helpers
  are reachable with the publishable key alone.
- **Decisions:** `SPEC.md` §0.2 holds **D1–D62**; **D63–D66** are reserved by
  `SPEC-AMENDMENT-v3-truckload.md`; **D67–D76** are proposed by `SPEC-AMENDMENT-v4-plan-md.md`
  (numbering approved 2026-09-29; the merge is withheld deliberately — the amendment is listed as a
  spec version rather than merged). `docs/DECISIONS.md` is the narrative log, **#1–#42**.
- **Deploy:** the app goes to Netlify (the user's own UI clicks — W6). The two review decks deploy
  separately to GitHub Pages (`docs/REVIEW-BUILD.md` §7–§8).
- **Open issues:** D67 is **delayed** pending client availability, not blocked; Phase B is
  unapplied; blind receiving ships **off**; and `REVIEWER-DECISIONS-REVIEW.md`'s Mode A review lists
  three CRITICAL findings (stale handover, the truncated decision log, the unapplied security fix).


## 4. Content inventory

| Asset | Path | Status |
|---|---|---|
| Spec | `SPEC.md` | ✅ **v2 + 3 amendments** (1973 lines). §0.2 holds D1–D62; D63–D66 in amendment v3, D67–D76 in v4 |
| Migrations | `supabase/migrations/0001…0046` | ✅ **46 files**; `0001`–`0036` applied to the live project, `0037`–`0046` staged and **not** applied |
| RLS policies | `supabase/rls-policies.sql` | ✅ updated for the Phase B objects (25 KB); applied with the migrations, so live is at the 0036 shape |
| DB test suite | `supabase/tests/` | ✅ 10 SQL test files + `run.sh` + a Supabase stub; runs on a scratch local PostgreSQL, never on Supabase (decision #39) |
| Seed | `supabase/seed.sql` | ✅ deterministic + idempotent. **Live counts have outgrown D14's figures** — see `REVIEWER-DECISIONS-REVIEW.md` Finding 4 |
| Frontend | `src/` | ✅ Mode A complete + containers (D19), multi-warehouse (D20), Capacitor wrap (D18), the deck |
| Review deck 1 | `src/components/storybook/` + `src/lib/storybook/` | ✅ 32 chapters / 104 screens; builds to `dist-storybook/` (408 KB) |
| Review deck 2 | `src/components/storybook-ant/` + `src/pages/StorybookAnt*.tsx` | ✅ 32 chapters in Ant Design 6, 24/24 block kinds; builds to `dist-storybook-ant/` (414 KB gzip; screens redrawn as Ant products — decision 97). Decision D67 open |
| Validator | `scripts/validate.mjs` | ✅ **73 checks** (10 kit structural + Jayshankar-specific), exit 0 |
| Self-test | `scripts/selftest.mjs` | ✅ 9 cases, all pass — proves the validator fails on known defects |
| HANDOVER | `HANDOVER.md` | ✅ this file |
| AGENTS | `AGENTS.md` | ✅ paired with this file; §6 mirrors the kit's "if you find a new gap" |
| Hand-off to another harness | `NEXT-AGENT-ONBOARDING.md` | ✅ **rewritten 2026-10-02** — the harness-agnostic first prompt, the verification discipline and comprehension checks. The pre-Phase-B snapshot it used to carry is retired |
| Retired documents | `docs/deprecated/` | ✅ **new 2026-10-02** — superseded documents, moved not deleted, with `README.md` mapping every old path to its new one and saying where each document's useful content went. Includes the former `AGENT-BRIEF.md`, `SPEC-AMENDMENT-v2.md`, this file's old session diary, `docs/recommendations/` and the 2026-09-16 design research |
| Build notes | `BUILDER-DECISIONS-REVIEW.md` | ✅ 90+ decisions — the build-time record |
| Reviewer notes | `REVIEWER-DECISIONS-REVIEW.md` | ✅ **created 2026-09-29** with the Mode A review (7 findings, 3 CRITICAL). Previously referenced in four places and missing |
| Decision log | `docs/DECISIONS.md` | ✅ **42 entries** — 1–40 merged from the Phase B zip, 41–42 the deck decisions |
| Tooling gate | `TOOLING-AUDIT.md` | ✅ complete; the `antd` row is REVIEW-REQUIRED. **Gitignored** (see the note below) |
| Client material | `client-qa/` | ✅ source material, not specification — **start at `client-qa/README.md`** (index with the status of every file). Holds the client's own words, the 12 locked visuals, `session3/plan.md`, the Phase B zip and the research PDFs. Its open questions are the owner's to close; do not resolve them |

**Four paths this repo deliberately does not version-control** (all documented in `.gitignore` with
rationale, not oversights): `delegation/` (the worker task ledger), `tins-kit/` (the vendored kit),
`archive/` (the exam-forge reference) and `_external/` (unrelated side-projects), plus every
`AUDIT-*.md` and `example-video/`. `AGENTS.md` points at the first two, so **a fresh clone will not
find them** — that is the intended trade-off, but a session working from a clone should know it
before concluding a file was deleted.


## 5. Work queue

### W1 — Migrations, RLS, seed, validator (the gate) — ✅ DONE 2026-08-05
### W1.5 — Live Supabase apply (user's project, real DB) — ✅ DONE 2026-08-06
- ✅ Schema applied: `0001_init.sql` (9 tables, triggers), `0002_handle_new_user_meta.sql` (trigger reads `raw_user_meta_data`), `0003_grant_service_role.sql` (GRANTs), `rls-policies.sql` (RLS), `seed.sql` (demo data)
- ✅ 3 demo auth users created (`seed-auth-users.mjs`: 0 created, 3 updated, 0 failed)
- ✅ 3 decisions logged in `BUILDER-DECISIONS-REVIEW.md`: #8 (FK drop), #10 (trigger meta), #11 (GRANTs)
- ✅ Pattern abstracted to kit: `tins-kit/lib/patterns/supabase-auth-trigger.md` (pulled forward from W5)
- ✅ Operator doc: `docs/SUPABASE-SETUP.md` (the full procedure + error troubleshooting + cleanup query + free-tier notes)
- **Done when:** the script returns "0 created, 3 updated, 0 failed" (or "3 created, 0 updated, 0 failed" on a fresh project) and Table Editor shows the canonical state. **Achieved 2026-08-06.**

### W2 — Auth + role shells — ✅ GREEN 2026-08-06
- ✅ Vite + React 18 + TS + Tailwind 3 scaffold
- ✅ Supabase JS client wiring
- ✅ Sign-in form (email + password; phone OTP deferred to Pilot per decision 13)
- ✅ Shared Layout (header with display name + role badge + sign-out)
- ✅ 3 role shells + role-based routing (decision 17: role drives the shell, not the URL)
- ✅ RLS working end-to-end (worker can read active batches, silent-denied on `audit_log`)
- ✅ User verification on live dev server: all 5 W2 manual checks pass

### W3 — Mutations — ✅ GREEN 2026-08-06
- ✅ Delivery form (vendor-rep) → new batch + delivery_in movement
- ✅ Sale form (vendor-rep) → FIFO cascade + sale row + sale movement (decision 18, 19)
- ✅ Transfer form (worker/vendor-rep) → SECURITY DEFINER function `record_transfer_cascade` (decision 23, migration 0005; workers can transfer; bonus: race-condition protected with FOR UPDATE)
- ✅ Spoilage form (worker/vendor-rep) → spoilage movement
- ✅ Recent activity feed on every role shell
- ✅ Shortfall handling: sale of 999 kg with 7 available records 7 kg with "shortfall: 992.000 kg" message
- ✅ All 8 W3 manual checks pass; audit_log shows every mutation
- ✅ 3 column-mismatch bugs caught + fixed (decisions 21, 22): `skus.name` → `english_name`; `batches.expected_shelf_life_hours` removed; `batches.expires_at` computed in JS from `delivered_at + skus.shelf_life_hours`
- ✅ UI back-link ("← Back to dashboard") added to every form; Jayshankar brand in header is now a clickable link

### W4 — Admin dashboard + audit log UI — ✅ BUILT (2026-08), performance criterion unrecorded
- Stock by SKU, recent activity, low-stock alerts and the audit-log viewer exist (`/admin`, `/admin/audit-log` in `src/App.tsx`).
- **Not recorded anywhere:** a pass/fail for §8.6's 2021-Android performance target (`npm run perf` exists; no result is logged). Treat §8.6 as unverified, not as failed.
- *(This section previously listed W3 twice — a finished entry and an unchecked copy — and left W4 unmarked. Both corrected 2026-10-02.)*

### W5 — PWA, offline, polish — ✅ GREEN 2026-08-07
- ✅ `vite-plugin-pwa@^1.3.0` wired in `vite.config.ts` (decision 26: `generateSW` mode, autoUpdate, dev SW enabled, NetworkFirst on `*.supabase.co` with 5s timeout + 24h max-age, navigateFallback to /index.html for hash-router deep links)
- ✅ Manifest inline: name, short_name, theme_color `#4f46e5`, background_color `#f8fafc`, display `standalone`, scope `/`, 1 icon entry (the fish SVG with `any maskable` purpose)
- ✅ `public/icon.svg` — fish-themed (white fish + gill + eye + 2 fins + tail on indigo rounded square, 512×512 viewBox, 80px corner radius safe inside Android adaptive-icon mask)
- ✅ `src/lib/online.ts` — `useOnlineStatus()` hook reading `navigator.onLine` + listening to `online`/`offline` events (decision 27)
- ✅ `src/components/OfflineBanner.tsx` — amber banner with SPEC §2.14 exact text "Offline — read only. Changes will be available when back online.", `role="status" aria-live="polite"`, returns null when online (no DOM, no layout shift)
- ✅ All 4 mutation forms (Delivery, Sale, Transfer, Spoilage) call `useOnlineStatus()`, disable submit button when offline, and show inline error "You are offline. Reconnect to record changes." if `onSubmit` is somehow reached
- ✅ Empty states per SPEC §3.7 (decision 28): floor dashboard empty active-batches shows "+ Transfer from storage" primary button; rep dashboard empty vendors shows a hint card (no button — rep can't create vendors); floor dashboard section header now has a "+ Record spoilage" link
- ✅ `docs/deprecated/mode-a-checklists/W5-MANUAL-VERIFICATION.md` (moved 2026-10-02) — 8 manual checks covering manifest, service worker, offline banner, mutation gating, network-return flow, PWA install (Android), empty states, hard-reload survival
- ✅ 3 decisions logged (#26, #27, #28)
- ✅ Final state: validator 72/72, selftest 9/9, `npx vite build` clean (dist/sw.js + workbox-*.js + manifest.webmanifest + icon.svg precached), 21 TS files in src/

### W6 — Deploy, demo URL — ✅ READY 2026-08-07 (user does the Netlify UI clicks)
- ✅ `package.json` build script: `vite build` (was `tsc -b && vite build`; the `tsc -b` referenced a dropped `tsconfig.node.json` from W4, decision 29). Added a separate `typecheck` script for opt-in.
- ✅ `netlify.toml` at repo root: `command = "npm run build"`, `publish = "dist"`, `NODE_VERSION = "20"`, SPA fallback to `/index.html` (defence-in-depth for hash-router links that get stripped by link-previewers)
- ✅ `docs/DEPLOY-NETLIFY.md` — operator doc: pre-flight gate, env vars (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY — never the secret (service_role) key), Netlify UI walkthrough, smoke tests, custom domain, rollback, troubleshooting, what NOT in V1 scope
- ✅ Decision 29 logged
- **User does next:** push the repo to a Git remote, then in Netlify UI: Add new site → Import project → auto-detected settings from `netlify.toml` → set the 2 env vars → Deploy. ~30 min to a live URL.
- **Done when:** A live URL works for the gatekeeper client to click through. After that: Mode A review session.

### W6+ — Repo housekeeping — ✅ DONE 2026-08-14
- ✅ Moved `kit-test/` → `tins-kit/archive/kit-test-2026-08-04/` and `kit-update-package/` → `tins-kit/archive/kit-update-package-2026-08-07/` (kit-research artefacts, kept for traceability)
- ✅ Deleted `dist/`, `dev-dist/`, both `tsconfig*.tsbuildinfo` files (regenerated by the toolchain; now gitignored)
- ✅ Deleted root `context.md` (duplicated `HANDOVER.md` + `AGENTS.md`; no file referenced it)
- ✅ Extended `.gitignore` to add `dev-dist/` and `*.tsbuildinfo`
- ✅ Sanitised both `.env` files (real Supabase keys were sitting in them; user rotated at dashboard before this session; new values must be re-entered before next `npm run build` or `scripts/seed-auth-users.mjs`)
- ✅ Quarantined `archive/atal-incubation-reference/incubos/jwt-*.pem` into `_credentials_DO_NOT_COMMIT/` with a README explaining disposal
- ✅ Validator 72/72, selftest 9/9, `npm run build` clean (142 modules, 7 precache entries)

### W7 — Land the Phase B docs (docs only, no database) — ✅ DONE 2026-09-29
- ✅ `docs/DECISIONS.md` merged to **42 entries**. 1–17 kept as this branch had them (they carry detail the zip's copies do not: the role union type, `0003_grant_service_role.sql`, validator behaviour); 18–40 taken from `client-qa/session3/backend-phase-b.zip`; the 29-Sep deck decisions renumbered **41–42** (they were written as 18–19 against a log that appeared to stop at 17 — those numbers were already taken by mobile decisions). Index rebuilt 1–42; the zip's own index was stale at 33 despite 40 entries. Decisions **9/13/15 adopted from the zip**, which carried supersede annotations ours lacked (#13 superseded by #18, #15 by #21/26–28).
- ✅ `docs/SCHEMA.md` replaced from the zip — it explicitly supersedes ours ("the earlier export of 2026-08-14 described 9 tables"). 241 → 1102 lines: 38 tables, 8 views, 71 functions.
- ✅ `docs/BACKEND-PHASE-B-STATUS.md` and `docs/API-REFERENCE.md` added (both new from the zip).
- ✅ `docs/SUPABASE-SETUP.md` gained an "Applying the later migrations" section, **adapted rather than copied**: ours references `BUILDER-DECISIONS-REVIEW.md` where the zip's copy genericised it to "the internal decision log", so ours was kept and the new section was written to say what is *not* in this checkout.
- ❌ **Not landed, deliberately:** migrations `0037`–`0046`, `supabase/tests/`, `supabase/rls-policies.sql`, `src/components/NotificationBell.tsx` — still only in the zip. Applying migrations is a production database change needing staging-first approval (`SPEC-AMENDMENT-v4-plan-md.md` §7 item 5), and dropping the files in would change what `scripts/validate.mjs` validates, since it concatenates `supabase/migrations/*.sql`.

### W8 — The Ant review deck (deck 2) — ✅ BUILT, ⏳ NOT PUBLISHED
- ✅ **Renderer (2026-10-02, decision 97):** all 24 block kinds, drawn by two composition layers — `mock/phone.tsx` (340×600 app: `NavBar`, grouped `Form`, docked action bar, `TabBar`) and `mock/desktop.tsx` (1180×720 Pro frame: `Sider`+`Menu`, KPI row, filter bar, tabbed table, 24-col grid) — plus hand-drawn SVG charts (`mock/charts.tsx`, no chart dependency) and a `ScrollArea` "More" affordance. The older per-block renderer (`AntBlocks`, `blocks-core/lists/viz`, `AntSurface`, `AntPhoneFrame`, `AntDesktopFrame`) is **deleted**. Same 32 chapters, same data. The QR generator is **copied** from deck 1 on purpose, so one container code draws the same pattern in both decks.
- ✅ **Wiring:** the surface seam (`src/lib/storybook/surface.ts` + `src/components/storybook/app-surface.ts`) supplies deck 1's frames and blocks to `ChapterPlayer`; **deck 2 uses neither** (see the 2026-10-02 rework below). Deck 2's files: `deck/*`, `mock/*`, `ant-shared.tsx`, `ant-tokens.ts`, `pages/StorybookAnt.tsx`, `pages/StorybookAntReview.tsx`, `src/storybook-ant-main.tsx`, `storybook-ant.html`, `vite.storybook-ant.config.ts`, `scripts/rename-storybook-ant-entry.mjs`, and the `build:storybook-ant` / `preview:storybook-ant` scripts. The surface is **injected**, never imported by the app — that is what keeps `antd` out of the app bundle while D67 is open.
- ✅ **Built:** `npm run build:storybook-ant` exits 0 → `dist-storybook-ant/` (`index.html`, one 1.34 MB JS bundle / 414 KB gzipped, one CSS file, web manifest, icon, service worker). `tsc --noEmit` clean. App build and deck-1 build re-verified after the `ChapterPlayer` change.
- ✅ **2026-10-02 rework — deck 2 is now a native Ant workbench, not deck 1's player with Ant widgets.** On the owner's feedback ("it doesn't seem much different"). New shell in `src/components/storybook-ant/deck/`: `Layout`/`Sider`/`Menu` navigation (a `Drawer` on phones), `Breadcrumb`, a clickable `Steps` walk-through, tap-the-screen-to-enlarge in a `Modal` lightbox, a home page with `Statistic`/`Tabs`/`Segmented`/`Input.Search`/live thumbnails/`Tour`, and dark mode. Same chapter data, frames and deep links. Browser-verified (192 layout checks + 15 interaction checks, dev and production). `decision 96` in `BUILDER-DECISIONS-REVIEW.md`. **Same day, second pass — the screens inside the frames** were redrawn as Ant products too (`mock/`), on the owner's "i dont see that u didnt work on the actual app and desktop mocks": `decision 97`. 16 of 108 screens are still taller than their frame and show a "More" pill. **D67 caveat:** the two decks now differ in navigation and interaction, not just styling.
- ⏳ **Remaining:** publish it (see W10), point `TAILWIND_DECK` in `StorybookAntReview.tsx` at deck 1's published URL, and do a real browser pass at 340×600.
- ⏳ **D67 (the decision) is open and now DELAYED** — the client is unreachable on schedule. The deck is the async instrument: two links, one question, no meeting required. `SPEC-AMENDMENT-v4-plan-md.md` §6.

### W9 — Sign off and merge `SPEC-AMENDMENT-v4` — 🔶 NUMBERING APPROVED 2026-09-29, MERGE WITHHELD
- The owner **approved the D67–D76 numbering** on 2026-09-29, which was the amendment's stated precondition for merging. The merge itself is still deliberately **not applied**: the instruction was to list it as a new spec version rather than merge it, so §8's paste stays prepared and withheld. One command applies it when wanted.
- Still to decide at merge time: whether §0.2 gains `OPEN` as a status value for D67 (the column has held only `LOCKED`, all 63 rows) — `SPEC-AMENDMENT-v4-plan-md.md` §8.3 lays out both options.

### W10 — Publish the Ant deck to GitHub Pages — ⏳ NEXT
- `scripts/publish-storybook.sh` is deck 1's: it hardcodes `dist-storybook/`, `PAGES_BASE=/Jayshankar-ui/` and deck 1's deploy remote. Deck 2 needs either its own `DEPLOY_DIR`/remote pair or a deck flag on that script.
- Then: `VITE_BASE=/<repo>/ npm run build:storybook-ant`, push to the deck-2 repo, enable Pages, send both links with one question.
- **2026-10-02 update:** the first push of deck 2 rendered blank (built without `VITE_BASE`), and once fixed the desktop-layout chapters were broken at every width — four causes, all fixed and browser-verified; see `BUILDER-DECISIONS-REVIEW.md` decision 95. The corrected build sits in `dist-storybook-ant/` ready to push. **Never run `npm run build:storybook-ant` with a `.git` inside `dist-storybook-ant/`** (it empties the folder); clone the deploy repo to `~/jayshankar-ui-antd-deploy` and use `DECK=storybook-ant bash scripts/publish-storybook.sh`.
- **Done when:** the client can open both decks on his phone from two links and answer D67 by looking.

### W11 — Spec the Phase A UI redesign (it shipped without a SPEC section) — ⏳ NEEDS THE OWNER
- **Found 2026-10-02** by the methodology reconciliation (`BUILDER-DECISIONS-REVIEW.md` decision 93). Commits `3cd0bd5` (tile-grid `RepDashboard`, six SVG tile icons) and `be38941` (`Layout`, `NotificationBell`, `RepDashboard`) changed the shipped UI with **no SPEC section and no D-number** behind them. The packages that came with it (shadcn/Radix layer, `lucide-react`) now have `SPEC.md` §4.4 rows, but a dependency row is not a design decision.
- **What the owner needs to decide, because §0.2 changes are *Ask first* (`AGENTS.md` §4):** whether the Phase A redesign (the client's 12 locked visuals, the tile-grid home, `src/components/ui/` as the app's component base) becomes a **locked decision**. The next free number is **D77** (D63–D66 reserved by v3, D67–D76 proposed by v4). It interacts with **D67**: if the client picks Ant Design for the app, the shadcn layer and `lucide-react` come back out.
- **Do not** write the decision from commit messages. Take the 12 visuals and the Q1.3 sign-off (see `delegation/tasks/T9-screen1-tile-grid-home/AUDIT.md`, the two accepted asset-colour deviations) to the owner first.
- **Also open, smaller:** move `@capacitor/cli` to `devDependencies` (next `package.json` edit); consider a `validate.mjs` check that diffs `package.json` against SPEC §4.4 (needs a selftest case, D24); decide whether `scripts/.env`'s live `sb_secret_…` key should be rotated.
- **Done when:** the redesign has a §0.2 row (or is explicitly declared out of the spec and why), §4.4 and `AGENTS.md` agree, and `npm run validate` / `selftest` / `tooling-audit` stay green.

### W13 — Deck 3, *The Run*, and the three-deck comparison — ✅ BUILT, ⏳ NOT PUBLISHED
- **Built 2026-10-03** at the owner's request, then reworked the same day on their review ("no point of comparison… too information heavy… the Run needs to be present in the other modes… interlink all three, give me a repo name"). Details: `docs/REVIEW-BUILD.md` §9–§10; the decision record: `BUILDER-DECISIONS-REVIEW.md` decisions 99–100.
- **What exists:** (1) **twelve persona walks** (`src/lib/storybook/journeys/`) in all three decks — one desktop (admin at the desk), eleven phone-only; (2) The Run draws all 44 chapters via `from-chapters.ts`, plus its own 8-act v3/v4 day; (3) a **Simple / Reviewer view** (simple is the default); (4) `?embed=1` and a "same screen in…" control in every deck; (5) a **Compare** page in The Run (`#/compare`) driving all three decks at one screen; (6) `scripts/publish-storybook.sh` now handles `DECK=storybook-run`.
- **Repo name to create:** **`Jayshankar-ui-run`** (matches `Jayshankar-ui` and `Jayshankar-ui-antd`). If the name differs, change `DECKS.run` in `src/lib/storybook/decks.ts` and rebuild. **All three decks must be republished** (decks 1–2 changed) before Compare works on the live URLs.
- **Verified:** `tsc`, `validate`, `selftest`, 37 vitest tests, a 500-check sweep of every Run moment (dev + production under Pages paths), 400 loads of the walks in decks 1–2, 23 interaction checks, a production Compare test (3/3 frames show the screen). **Not verified:** a real phone / non-Chromium browser; the live URLs.
- **Owner's calls still open:** publishing (no credentials here; `dist-storybook-ant/` is a git clone — push from inside it; build elsewhere, `emptyOutDir` deletes a `.git`); whether to show the client all three or narrow D67; the v3-vs-Phase-B choice (W12) that Act 4 / Act 7 draw both sides of; whether the proposed delivery-tracking screens in *Pack it and deliver it* should become real scope.
- **Honest limits:** it draws behaviour that is **not built** (D63, D66, D69, D70) and says so; the sync-conflict screen and the delivery screens are labelled proposals; all names, vehicles and prices are invented.

### W12 — Amendment v3 and the Phase B migrations disagree about blind receiving — ⏳ NEEDS THE OWNER
- **Found 2026-10-02** by checking each amendment against the 46 migrations (not against its own header). `SPEC-AMENDMENT-v3-truckload.md` (2026-09-22, "fully answered, not built") and the Phase B workstream (migrations `0037`–`0046`, `docs/DECISIONS.md` #34–#37, 2026-10-01) solve the same client need two different ways, and **neither document mentions the other**:

| | Amendment v3 (D63–D66) | Phase B, as written in `supabase/migrations/` |
|---|---|---|
| Coexistence of two procurement models | `warehouses.procurement_mode` toggle, per warehouse (D63) — **in no migration** | no toggle: the legacy bill path stays beside the new PR → RCV path ("two receiving paths") |
| Truck load | `truck_loads` above `bills`, `bills.truck_load_id` (D64) | `procurement` (one supplier lot, `PR-…`) + `truck_loads` (one arrival, `RCV-…`); lineage on `batches.procurement_id` / `truck_load_id` / `is_pro_rata_share`. **Built, different shape** |
| Who is blind | a **new role `receiving-storage`**, `vendor-rep` narrowed to procurement only (D65) — **in no migration** | **no sixth role**: `users.receiving_blind` on `vendor-rep`/`super-worker`, `worker` always blind, behind `app_settings.enforce_blind_receiving` (ships **off**) (`DECISIONS.md` #34, #37; plan D19/D20) |
| Trip planning | task type `procurement_trip` + `vehicle_number` (D66) — **in no migration** | none |
- **v4 sits in the middle and contradicts itself:** its D68 (blind receiving "ships with the switch off") matches Phase B; its D72 ("no sixth role") matches Phase B too, then calls v3's D65 "the sanctioned exception". The call script `client-qa/client-call-script-2026-09-22.md` (Q6–Q11) was meant to validate v3 with the client; **no recorded answers exist**.
- **Not decided here, on purpose.** Choose one: (a) Phase B's design wins — mark v3 D63/D65/D66 superseded, keep D64's idea, reconcile v4's D72 wording; (b) v3 wins on the role and the toggle — then Phase B needs a follow-up migration (`receiving-storage` role, `procurement_mode`) and `can_view_procurement_money()` changes; (c) keep both and say which screens use which. Until then: **do not build the Phase B receiving screens against either document alone.**
- **Done when:** the owner's choice is written into `SPEC.md` §0.2 (or the amendment is marked superseded) and the two documents stop contradicting each other.

### Backlog carried from the retired session log (not queued; none is approved work)
- **`docs/recommendations/`** (10 files, 2026-09-15, unattributed) — now `docs/deprecated/recommendations/`. An idea backlog whose proposed migrations `0040`–`0050` collide with the real Phase B numbers; re-derive before using any item. Its festival/market-price/report ideas overlap what Phase B already built.
- **`public/tutorials/categorized/` in `Jayshankar-clean`** — 36 videos copied again into 7 category folders (135 MB if committed), referenced by nothing. Ask what it is for before touching it.
- **Frontend visual refresh** (`tins-kit/prompts/FRONTEND-REFRESH.md`) — gated on the owner declaring V1 testing done. Partly overtaken by the client's 12 locked visuals and the Phase A track (W11).
- **Three-mode UI — Tanglish / English / pure Tamil** — scoped beyond a binary choice, not started; `plan.md` §8.5 sketches the i18n approach.
- **Offline-write conflict UX** — D30 fixes the need, not the design (see the offline gotcha in §6).
- **Real SKU import** — blocked on access to the client's Google Sheet; the 106-item spreadsheet catalog sits in a provisional third warehouse (D57).
- **Google OAuth** — discussed, not built; blocked on Google Cloud Console and Supabase provider setup. Capacitor gotcha already known: use the system browser with a deep-link redirect, not an in-WebView redirect.
- **Deadline:** Play Store submission **1 December 2026**, live **15 December 2026**. A personal Play account needs a 14-day closed test with 12 testers first, so the account should already exist (`plan.md` §12). The older "November 1" date is superseded.

### Mode A review
- After W6: a reviewer session runs. Findings go in `REVIEWER-DECISIONS-REVIEW.md`. Most useful at the end of a mode, not after every W.

## 6. Gotchas / known issues

- **No real client data yet.** Demo data is real-schema, fake-content (D14). The seed in SPEC §App A is a plausible Tamil Nadu wholesale set; the wholesaler's actual data may differ in fish names and shelf-life hours. Easy to amend in Mode B.
- **iOS is in scope, Android first** (D18 supersedes D13). Android is wrapped with Capacitor and has run on a real device; iOS follows once Android is proven in the field. Apple's $99/year is a client-budgeted cost (D18). Until then the PWA works on iOS Safari but is not optimised.
- **Offline writes are decided but NOT BUILT.** D30 made a worker-role write queue Mode B scope and §8.16 has acceptance criteria for it; v4's D69 re-states it as the largest field risk. Checked 2026-10-02: nothing in `src/` queues a write — the PWA caches **reads** only, and mutation buttons are disabled offline (§2.14). A boat-side entry made without signal is lost. `docs/OFFLINE-WRITE-QUEUE.md`, which SPEC §2.14/D30 say should be authored first, **does not exist**. Design sketch: `client-qa/session3/plan.md` §7.5.
- **The transfer algorithm's vendor attribution rule** (SPEC §4.3.3) is one of three plausible choices. Easy to amend in Mode B.
- **Supabase free tier caps:** 500 MB DB, 2 GB transfer, 50 K MAU. Plenty for one store. The Supabase dashboard shows usage — watch it before it bites.
- **Service role key never ships in the bundle.** SPEC §4.1. If a future contributor adds a `supabase-js` client with the service role key, the audit log is bypassable and the app is broken.
- **`scripts/` is zero-dependency** (carried over from exam-forge house rules). The validator and the migration runner use Node's built-in modules only. `npm install` is for the app, not the gate.
- **Phone OTP cost** — Supabase Auth charges per SMS. Free tier has a small monthly SMS allowance; check the dashboard before going live with phone auth.
- **Narrow race window: packing vs. direct-sale (decision #41).** `record_container_fill` (0007) reads `batches.kg_remaining`/`container_fill_items` without `FOR UPDATE`; `record_container_sale`/`record_container_spoilage`'s (0009) direct-fallback phase does lock `batches`. A plain `SELECT` never blocks on another transaction's lock, so two truly concurrent calls — one packing a batch, one selling from it directly — could race within a tiny window. Not fixed (would mean re-testing an already-shipped file for a race needing two ops on the same batch within milliseconds, on a single-operator business). Revisit if this project ever adds concurrent automated agents/multiple simultaneous receiving stations.
- **Two `public.users` rows per demo account (decision #46).** Each of the 3 demo emails (`admin@`/`rep@`/`worker@jayshankar.demo`) has TWO rows in `public.users`: the real one (matches `auth.users`, what `auth.uid()` actually resolves to when signed in) and a fixed-placeholder-UUID leftover from the original Mode A raw-SQL seed (`a0000000-0000-0000-0000-00000000000N`), with no matching `auth.users` row at all — the fake rep row is referenced by 50 `sales.sold_by` rows (the original demo dataset's fixtures). Harmless to the real app (nothing resolves identity by email lookup, only `auth.uid()`), but a genuine trap for any script or query that looks a user up by email expecting one result — it happened once already, in this project's own test tooling. If you ever need a user's real id programmatically, decode it from their signed-in JWT's `sub` claim, don't query `users` by email. Not cleaned up in the database — deleting the fake rows is blocked by the `ON DELETE RESTRICT` FK from those 50 sales; fixing it properly means re-pointing that fixture data, a separate task on fake/demo content, not urgent.
- **No LLM-agent-in-the-loop for production writes (carried from the retired `AGENT-BRIEF.md` §4 and amendment v2 §G; the sentence was dropped when v2 merged into D20).** The outbound WhatsApp path is deterministic and auditable. An agent interpreting inbound messages to decide database writes is a prompt-injection surface and fights the audit-log/RLS design; if inbound automation is ever approved it must be a structured parse, never an LLM deciding what to write. `SPEC.md` D20's text no longer says this — **owner: restore it to D20?**
- **No automated backups on Supabase's free tier** (carried from `AGENT-BRIEF.md` §4 / v2 §G, which proposed a scheduled GitHub Actions `pg_dump` to Google Drive). Nothing implements that and `SPEC.md` does not mention it. Enable the dashboard's backups before go-live and rehearse one restore (`client-qa/session3/plan.md` §7.3).
- **HashRouter: `page.goto('/some/path')` in a script silently does not navigate in-app** — you need the `#`. It has bitten the screenshot and recording scripts more than once (decisions #88, #90).
- **A container only ever exists already filled.** Every INSERT into `containers` happens inside `record_container_fill`; there is no "register an empty container" step. A repack destination has to come from fully selling an existing fill out first.
- **`CREATE OR REPLACE FUNCTION` only replaces the exact same parameter list.** Adding a parameter to a live function without a preceding `DROP FUNCTION IF EXISTS <old exact signature>` leaves two overloads and a silent `PGRST203` (SPEC D48 and D50 — `BUILDER-DECISIONS-REVIEW.md` #73–#74 and #77; caught pre-emptively at least five times since).
- **Applied migrations are history, never edited** — fix forward in a new number (`NEXT-AGENT-ONBOARDING.md` §2). This is also why comments inside old migrations still cite documents that have since moved; `docs/deprecated/README.md` maps old paths to new.

## 7. Handover protocol

When you finish a W item:
1. Run `npm run validate`. It must exit 0.
2. Update this file: the "Last updated" line, the "Last worked on by" line, the "Queue position" line, the state snapshot, the relevant row in §4.
3. If you amended the spec, write a one-paragraph note in `BUILDER-DECISIONS-REVIEW.md` describing the change and the reason.
4. If a reviewer session ran, its findings go in `REVIEWER-DECISIONS-REVIEW.md`.

When you start a new session:
1. Read `HANDOVER.md` first (10 min context).
2. Then `SPEC.md` §0 (the locked decisions — D1–D62 committed; D63–D76 proposed in amendments v3/v4).
3. Then `AGENTS.md` for the standing rules.
4. Then the spec sections relevant to your W item.

An unrecorded finding is a finding the next session pays for again.
