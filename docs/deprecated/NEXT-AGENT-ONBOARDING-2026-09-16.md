> **RETIRED 2026-10-02 — historical snapshot dated 2026-09-16.** The live, rewritten version is
> `NEXT-AGENT-ONBOARDING.md` at the repo root. What survived into it: §0 (spec is the source), §2 (the
> verification discipline), the facts in §5, and §9 (the first prompt and comprehension checks, re-aimed at
> the current files). What did **not** survive, because it is stale: §1's file map (pre-Phase-B), §3 (the
> chronological arc — see `docs/deprecated/HANDOVER-session-log-2026-08-to-2026-09.md`), §4 (the "current
> state": 73/73 checks, migrations 0001–0036, an unconfirmed Netlify site), §6–§8 (unknowns, deferred and
> pending lists — now `HANDOVER.md` §5), and every mention of a **November 1, 2026** deadline (now 1 December
> submission / 15 December live). Kept unchanged below.

---

# NEXT-AGENT-ONBOARDING.md — how to hand this project to a different AI, in a different tool,
# and have it actually pick up where this one left off

> **Who this is for:** the human maintainer (you), when you're about to open this project in a
> different coding agent/harness — opencode, a Hermes-agent-style tool, a different Claude Code
> session with no memory of this one, anything that isn't a continuation of this exact
> conversation. It is a **meta-document**: it does not contain the spec, the decision history, or
> the code. It tells you and the new agent **where those live, in what order to read them, how to
> tell whether the agent actually read them, and exactly what to paste in to get started.**
>
> **This is not a replacement for `AGENTS.md`.** `AGENTS.md` is this project's own "onboarding
> for a new LLM session" file, written for a session that's already inside a competent coding
> harness and just needs project context. This file exists one layer up from that: it assumes
> the new agent might be in a **weaker or differently-shaped harness** than the one that did most
> of this work, and it exists to close the gap between "technically read the files" and "actually
> understood and will act on them" — which, per this project's own recent history (see §7 below),
> is a real failure mode even for a strong agent inside a good harness, not a hypothetical one.

---

## 0. The single most important fact before anything else

**This project is built TINS-style: the spec is the source, the app is generated from it.**
`SPEC.md` is not documentation of the app — it is the thing the app is a compiled artifact of.
If the app does something wrong, the fix is almost never "edit the React component." It's "find
the spec section that's wrong or silent, fix the spec, then regenerate the code to match." A new
agent that doesn't internalize this in the first five minutes will spend its whole session
fighting the project's own grain — editing generated code to patch symptoms, drifting the app
away from what the spec says, and leaving the next person (human or agent) with a codebase that
no longer matches its own source of truth. This has a name in this project's own docs:
`AGENTS.md` §3 rule 1, and it is the first of twelve *non-negotiable* standing rules, not a
suggestion.

---

## 1. The documentation map — what exists, what it's for, and the order to read it in

Everything below lives at the repo root of the **working copy**,
`/mnt/c/Users/user/Desktop/Jayshankar` (WSL path) / `C:\Users\user\Desktop\Jayshankar` (Windows
path — same files, same machine, mounted, not synced — see §6). None of these files exist in
`Jayshankar-clean`, the public GitHub/Netlify repo — that's deliberate (§9).

| Order | File | What it actually is | Size (roughly) |
|---|---|---|---|
| 1 | `AGENTS.md` | The project's own "read this first" for a new LLM session. Sixty-second orientation, a role-router table ("which job are you here to do?"), scope boundaries, the 12 standing rules, first commands to run. | ~4KB, short — read in full |
| 2 | `HANDOVER.md` | The **state tracker**. A running, dated log of every session's work, in order, ending in a "sixty-second brief," an environment/content inventory, the W1–W6+ work-queue history, a gotchas section, and the handover protocol itself. This is the file to read to answer "what actually happened, in order, and what's the state right now." | ~700 lines by now — the top ~40 lines (the dated entries) are the part that changes; skim the rest once |
| 3 | `SPEC.md` §0 | The 40+ **locked decisions** (D1, D2, D3…). These are settled. Do not relitigate them without the user's explicit go-ahead. | §0 alone is a few hundred lines |
| 4 | `SPEC.md` (rest) | The actual functional spec: §1 description, §2 functionality (module by module), §3 universal behaviour rules, §4 technical implementation (schema, algorithms, dependency list), §5 style guide, §6 accessibility, §7 error handling, §8 acceptance criteria, §9 out of scope, Appendix A (demo seed data), Appendix B (migration plan Mode A→B→C), and a closing "what I guessed, what I assumed" section. | ~1960 lines — this is the one to actually *use* while building, not read cover-to-cover up front |
| 5 | `BUILDER-DECISIONS-REVIEW.md` | The **decision log** — every non-trivial build decision, bug found, and its fix, numbered sequentially (currently 90 entries), each with a **Cross-reference** line linking related decisions. This is where "why is it built this way" gets answered. It is long (hundreds of KB) — don't read linearly; grep for the feature/file/decision-number you care about, or read the last 5–10 entries to see what just happened. | large — grep it, don't linearly read it |
| 6 | `AGENT-BRIEF.md` | A **phase-specific** brief written when Mode B (the big container-model/CRM amendment) started. Mostly historical now — Mode B is done — but its build-order reasoning (§3) and its documentation-standard section (§5, "verbose enough for a future maintainer... human or another AI agent... without the current developer in the loop") are exactly the standard this whole file is trying to meet. | ~5KB |
| 7 | `TOOLING-AUDIT.md` | A one-time audit of what the harness/environment actually has (Bash, git, the delegation setup, a `run` skill for visual checks). Mostly settled (`status: complete`), read once. | ~5KB |
| 8 | `AUDIT-2026-09-10.md` | A full-directory audit from partway through the project. Historical, not a living document. | ~13KB |
| 9 | `delegation/README.md` + `LEDGER.md` | How this project actually split work between a planner/auditor (Claude) and a cheaper worker model (MiniMax M3, via a GUI desktop app, no CLI hook — hence a specific manual-relay adaptation, not `tins-kit`'s default `self-parallel`). Read this **only** if you're setting up a similar split — not needed for a single agent doing everything itself. | `README.md` ~5KB |
| 10 | `docs/` (public-facing subset) | `ARCHITECTURE.md`, `SCHEMA.md`(+`.png`), `SUPABASE-SETUP.md`, `DEPLOY-NETLIFY.md`, `LOOKER-STUDIO-SETUP.md`, `CONTRIBUTING.md`, `DECISIONS.md`, plus some dated `W2`–`W5-MANUAL-VERIFICATION.md` test-verification logs. This is the **curated, published-style** documentation — it's also what's mirrored into `Jayshankar-clean`. | varies |
| 11 | `docs/recommendations/` | **A 10-file Mode B/C roadmap, dated 2026-09-15, with no corresponding entry anywhere in `BUILDER-DECISIONS-REVIEW.md` or `HANDOVER.md`.** This decision log has no record of who produced it or under what instruction. Read `00-readme.md` first — it explains the other 9. Treat every recommendation in it as **proposed, not approved** — nothing in it has been built. See §7 (unknowns) below. | ~185KB across 10 files |
| — | `README.md` | Public-facing product description. Not a build doc. |  |

**A file this table deliberately omits:** `SPEC-AMENDMENT-v2.md`. It's superseded — everything
in it was folded into `SPEC.md` itself (HANDOVER.md part 6). Don't build against it; it's kept
only as a historical record of what Mode B originally proposed before reconciliation against
real operational facts.

### Why some of these files don't exist in the other repo

`Jayshankar-clean` (`/mnt/c/Users/user/Desktop/Jayshankar-clean`, pushed to
`github.com/Sairampv98/Jayshankar-clean`) is a **separate, deliberately-stripped public mirror**
of the actual app code — no `SPEC.md`, `HANDOVER.md`, `AGENTS.md`, `AGENT-BRIEF.md`,
`BUILDER-DECISIONS-REVIEW.md`, `AUDIT-*.md`, `TOOLING-AUDIT.md`, `client-qa/`, or
`hyperframes-video/` (the video-production tooling — only its rendered output ships). This is so
the TINS spec-first methodology and internal decision trail aren't exposed in the repo a client
or the public might see; it does not mean those things don't matter — it means **all real
development happens in `Jayshankar` (no trailing `-clean`), never directly in
`Jayshankar-clean`**, and `Jayshankar-clean` gets resynced from `Jayshankar` periodically (most
recently by a `git ls-files`-based sync, decision #90 — read that decision before doing this
again, it documents a real methodology-doc-reference leak the naive version of this sync causes).

---

## 2. The methodology, precisely enough to actually replicate it

If you only take one thing from this section: **every one of the "real bugs found" entries in
`BUILDER-DECISIONS-REVIEW.md` was found by verifying against the live system, not by reading
code and reasoning about what it should do.** This project has a phrase for it, repeated in
decision after decision: *"checked directly, not assumed."* Concretely, that means:

1. **A migration is not "done" when `npm run validate` is green.** That only proves the SQL is
   syntactically sound and internally consistent with the spec's own markers. It has to be
   **applied to the live Supabase database** (there is no CLI/direct DB connection from this
   WSL2 environment — the user runs each migration file in the Supabase Dashboard's SQL Editor)
   and then **exercised with a real script that signs in as a real demo user** (not the
   secret/service-role key — RLS and `auth.uid()`-based role checks only actually run when a
   real authenticated session is making the call) and reads the result back from the database
   directly. `scripts/test-container-fill.mjs`, `test-container-repack.mjs`,
   `test-container-sale-spoilage.mjs`, `test-credit-terms.mjs`, `test-phone-identity.mjs`, and
   `test-phone-password-invite.mjs` are the surviving examples of this pattern — copy their
   shape for the next one, don't invent a new style.
2. **A UI change is not "done" when the diff looks right.** Screenshot it (or, for a flow that
   spans role switches, screen-record it with Playwright) signed in as the actual role it's for,
   and look at the actual pixels/actual DOM text. Decision #34 is the canonical example: a
   `queryKey` collision between two components sharing the literal string `'skus'` meant one
   page's shelf-life column had been silently blank for a long time, invisible in any diff, only
   caught because someone actually looked at the rendered page instead of trusting a green gate.
3. **A list that's "ordered by X" isn't ordered the way you assume once ties are possible.**
   Decision #90's `bill_date` example: a DATE column, not a timestamp, so every bill made "today"
   ties, and Postgres's tie-break for that is arbitrary storage order — not insertion order, not
   recency. This bit the tutorial-recording scripts twice before it was caught by directly
   querying the database and comparing what a script assumed against what was actually returned.
4. **Never trust a self-report.** This is literally load-bearing in the one multi-agent pattern
   this project used for real (`delegation/`, Claude planning + auditing, MiniMax M3 building):
   the auditor re-runs the gate independently, re-reads the touched files, and does its own live
   check — it does not accept "I ran the tests and they passed" from the worker. `TOOLING-AUDIT.md`
   and `delegation/LEDGER.md`'s T1–T8 rows are the concrete record of this working.
5. **Fix forward, don't edit an already-shipped migration file in place.** Every SQL migration
   file, once applied to the live database, is treated as historical fact — a bug found in it
   later gets fixed in a **new, higher-numbered migration** (`CREATE OR REPLACE FUNCTION` for a
   function, a fresh `ALTER`/`UPDATE` for data), never by going back and editing
   `0007_record_container_fill.sql` after the fact. This is what makes "does a fresh database
   just run migrations 0001→NNNN in order and end up correct" a real, answerable question — and
   it's been asked and answered affirmatively more than once (decision #39's own retelling of
   nearly getting this wrong is worth reading for why it matters).
6. **The `CREATE OR REPLACE FUNCTION` overload trap.** Postgres only replaces a function with the
   *exact same parameter list*. Adding a parameter to an already-live function without a
   preceding `DROP FUNCTION IF EXISTS <old-exact-signature>` leaves **two functions with the same
   name** — the old one still gets called depending on which overload Postgres resolves to, and
   the bug is silent until it isn't. This has bitten this project and been caught pre-emptively
   at least five separate times across the later sessions (search `BUILDER-DECISIONS-REVIEW.md`
   for "DROP FUNCTION IF EXISTS" to see every instance). **Any migration that adds a parameter to
   an existing function needs this drop first, as a reflex, not an afterthought.**
7. **An unrecorded finding is a finding the next session pays for again** (`HANDOVER.md`'s own
   closing line, §7). Every session, before declaring anything done: update `HANDOVER.md` (the
   dated entry, the "Last updated"/"Last worked on by" lines, the queue position) and log the
   decision in `BUILDER-DECISIONS-REVIEW.md`. **This project's own recent history is proof this
   gets skipped under real conditions** — decisions #67–#89 were logged correctly, but the
   34-scenario video-recording sprint, the `/learn` page, and the `Jayshankar-clean` resync that
   followed them were not, until they were caught and back-filled as decision #90, days later,
   while writing *this very document*. Read `HANDOVER.md` part 25's own note on this before
   assuming "the decision log is complete" is ever a safe default — check the actual git log
   against the actual decision numbers when in doubt.

### The three-mode lifecycle (still governing everything)

**Demo → Pilot → Production** (`SPEC.md` D7). Demo (Mode A) is done and was the first deployable
artifact — seeded, fake-content, real-schema data. Mode B (the big amendment: containers, CRM,
credit terms, invitations, multi-warehouse) is also done and merged into `SPEC.md` itself (it is
no longer a separate "amendment," it's just what `SPEC.md` says now). **Pilot has not formally
started** — there is no record anywhere in this project's docs of the real wholesaler's own live
data ever having been loaded and used day-to-day. The spreadsheet import (decision #84/#85,
`seed-simulated-operations.mjs`) loaded a real spreadsheet's *catalog* into a clearly-labeled
**provisional, third warehouse** — explicitly not the same thing as "the client is now using this
app for real." Don't conflate "V1 complete" (a real commit message, `49ffe66`, pushed to
`Jayshankar-clean`) with "Pilot has started" — they are not the same claim, and nothing in the
docs confirms the second one.

---

## 3. What was actually done — condensed chronological arc

This is deliberately a **summary of a summary** — every claim below has a decision number or
`HANDOVER.md` part you can go verify directly; this section exists so a new agent doesn't have to
read 700 lines of `HANDOVER.md` and hundreds of KB of `BUILDER-DECISIONS-REVIEW.md` before
forming a mental model, only to check specifics as they come up.

1. **Mode A (Demo), W1–W6** — the original spec, a 9-table schema, RLS, audit log, 3 role
   dashboards (admin/vendor-rep/worker), FIFO batch tracking, a PWA on Netlify. Built and
   confirmed deployable (`HANDOVER.md` §5).
2. **A real client phone-call scoping conversation** surfaced real operational facts (one
   warehouse, no display/freezer split, a container-based physical shelf-life model, no
   price-broadcast rule, mobile-app-first per real research) — folded into `SPEC.md` as v2,
   alongside a separately-drafted `SPEC-AMENDMENT-v2.md`, reconciled against reality rather than
   merged blind (decision #36).
3. **The container model** (warehouses, bills, containers, container_fills, receiving,
   repack, container-sourced sale/spoilage with a soonest-expiry-first cascade, transfer
   timestamp fix) — built migration by migration, each one live-tested before being called done
   (decisions #37–#43).
4. **Capacitor/Android scaffolding started** (decision #45); a real device (Poco X6 Pro) has
   installed and run the app, surfacing and fixing 3 web/PWA-invisible bugs (decision #47). A
   second device's install failure was diagnosed as a corrupted file transfer, not a build
   problem.
5. **CRM schema** (customers, payments, reversal_requests, notifications, user_role_history) —
   built to spec, and a real, previously-undiscovered gap fixed alongside it: `co-admin` had
   never actually been settable in the database despite every RLS policy assuming it worked since
   migration 0006 (decision #46).
6. **The user-invitation mechanism** — the hardest single thread in this project's history.
   Needed a Supabase Edge Function (the service-role key can never reach the client) — this
   project's first one. Deployed, broke twice for two different root causes (a redirect/hash-
   routing collision, then a phone-path token invalidated by a second write to the same account
   after the link was generated), root-caused by isolating the working path against the failing
   one rather than guessing, and confirmed working end to end by a real human on a real device,
   twice (decisions #51–#59).
7. **"Lets sprint to v1"** — an audit (not assumed from the schema) found the entire CRM layer
   built in step 5 had **zero frontend usage anywhere**. Closed in order: Customers → Payments →
   Reversals → Notifications → Bills → a "Pokemon-card" style Search feature (fish/customer/
   vendor/employee cards), phase 1 (decisions #61–#65).
8. **Migrations 0030–0036** — orphaned-task force-reassignment on a role change, in-transit
   locations, receiving confirmation with a promised-vs-measured discrepancy split,
   `can_self_reverse` restricted to admin/co-admin, bill reconciliation as a field genuinely
   separate from the vendor's promised total, the real client spreadsheet imported into a third
   provisional warehouse, a full frontend/backend parity audit (closing the biggest remaining
   gap: `VendorManagement.tsx` had backend support since migration 0001 with no UI, ever), and a
   live-reseed bug fix (decisions #67–#86, HANDOVER.md part 25 / this project's own recent
   history — the exact decision numbers for this stretch are in the log itself, grep rather than
   trust a hand-typed range here).
9. **Three HyperFrames "walkthrough" videos** (composed from real app screenshots, not live
   recordings) covering every route in the app at least once (decisions #87–#88).
10. **The full 36-scenario tutorial-video library** — real Playwright screen recordings (not
    screenshots) of every planned scenario, verified against the live database after each one;
    a role-filtered in-app `/learn` page built from all 36; `Jayshankar-clean` resynced and
    pushed (decision #89 for the first 2 scenarios' pipeline, decision #90 for the remaining 34 +
    the Learn page + the resync, logged retroactively — see §2 point 7 above for why that matters).

**What this arc does *not* include:** anything in `docs/recommendations/` (§7 below) — that's a
separate, unattributed body of work with no decision-log record, sitting alongside this history,
not part of it.

---

## 4. Current state, as precisely as it can be stated right now

- **`npm run validate`**: 73/73 (main repo, confirmed 2026-09-16).
- **`BUILDER-DECISIONS-REVIEW.md`**: 90 decisions.
- **Migrations**: 0001 through 0036, all confirmed **applied to the live Supabase database**
  and, for every RPC/function among them, live-tested (not just statically gated) — see
  `HANDOVER.md`'s dated entries for the specific live-verification record of each one.
- **`Jayshankar` (main, working repo)**: local git only — **no GitHub remote configured**
  (`git remote -v` returns nothing). This is the repo all real development happens in.
- **`Jayshankar-clean` (public mirror)**: has a real GitHub remote
  (`github.com/Sairampv98/Jayshankar-clean`), at commit `49ffe66` ("v1 complete") on
  `origin/master` — **already pushed**, confirmed via `git fetch` + `git status -sb` showing no
  ahead/behind divergence. One trivial uncommitted local diff exists there
  (`android/gradlew.bat`, line-ending changes from a local Gradle run) — harmless, not blocking.
- **Netlify deployment**: `netlify.toml` exists and is correct (`npm run build`, `dist/`,
  `NODE_VERSION=20`, SPA fallback). **Whether a live Netlify site is actually connected and
  serving the current `Jayshankar-clean` push is not confirmed by anything in this repo's own
  history** — the user said (2026-09-13) they wanted to "commit and push and deploy it to
  netlify" themselves; the commit and push are confirmed done, the actual Netlify-side connect-
  and-deploy step's completion is not independently verifiable from here. **Ask the user directly
  rather than assume either way.**
- **Android**: scaffolded (Capacitor), builds, confirmed installing and running on one real
  device (Poco X6 Pro). No Play Store submission — not in scope for V1 (App ID is
  placeholder-but-real, explicitly not locked until that submission actually happens).
- **The November 1, 2026 deadline** (a working mobile app, Zoho-comparable UI — noted in memory,
  not written directly into any repo doc) has **not been revisited in the most recent work**,
  which was entirely backend migrations + the tutorial-video/Learn/clean-repo arc. If today's
  date is close to or past that, this is the first thing to raise with the user.

---

## 5. What's KNOWN (settled facts, don't re-derive or re-litigate)

- The stack: Vite + React 18 + TS + Tailwind 3 + TanStack Query 5 + Supabase (Postgres + Auth +
  RLS + Realtime + 1 Edge Function) + Netlify, PWA via `vite-plugin-pwa` (`generateSW` mode,
  `workbox.globPatterns` deliberately excludes video files from precaching), Capacitor for
  Android. `HashRouter`, not browser history routing (works on static hosting with zero server
  rewrite rules; also means `page.goto('/some/path')` in a script silently does *not* navigate
  in-app — you need the `#` — this has bitten automated screenshot/recording scripts more than
  once, see decision #88/#90).
- 5 roles: `admin`, `co-admin` (full admin parity, exists so a second person can run the business
  — not a lesser role), `vendor-rep`, `worker`, `super-worker` (holds both worker's floor-work
  access and a rep's sales/money/complaints access — check `App.tsx`'s own `expected` role arrays
  before assuming a role's scope, don't guess from the name).
- Money is `numeric(10,2)`, never float, everywhere (`SPEC.md` §3.6).
- The audit log is append-only — no UPDATE or DELETE policy on it, for any role, ever.
- Soft-delete (`active = false`) everywhere; no DELETE policy on almost anything.
- The service-role/secret Supabase key must never reach the client bundle — it lives in
  `scripts/.env` (gitignored, separate from the app's own `.env`) and is only ever used by
  Node scripts run directly by a human/agent, never imported into `src/`.
- Container model: `containers` (physical, numbered, custom or standard sizes) hold
  `container_fills` (one per bill, `bill_id` NOT NULL — "one purchase event, one shelf-life
  clock"), which hold `container_fill_items` (per-batch kg breakdown, for repack lineage). A
  container only ever comes into existence **already filled** — there is no "register an empty
  container" step anywhere; every INSERT into `containers` happens inside
  `record_container_fill`. If you ever need an "empty, available" container for something (like
  a repack destination), one has to be produced by fully selling an existing fill out first.
- Sale/spoilage draw from a two-phase cascade: container-tracked stock first (soonest-`expires_at`
  first), then un-contained direct-batch FIFO as a fallback.
- Every demo login (`admin@jayshankar.demo`, `rep@jayshankar.demo`, `worker@jayshankar.demo`,
  password `DevPassword123!`) has **two `public.users` rows** — the real one (matches
  `auth.uid()`) and a stale placeholder-UUID leftover from the original raw-SQL seed, with no
  matching `auth.users` row. Several of these stale rows also happen to share a **display name**
  with the real account (both "Anitha", both "Suresh") — confirmed live, not assumed, while
  building the tutorial-recording scripts (decision #90). Never look a user up by email or
  display name expecting one result; if you need a real id programmatically, decode it from the
  signed-in JWT's `sub` claim.
- `Jayshankar-clean`'s own `.gitignore` is the authoritative list of what must never leak into
  the public repo — read it before ever running a sync into that repo again, and re-read decision
  #90 for the "bare filename in a code comment" leak class that a naive file-list sync alone
  doesn't catch.

---

## 6. What's UNKNOWN (found, not resolved — do not guess at these, ask)

1. **`docs/recommendations/`** (this repo, 10 files, dated 2026-09-15) — a full Mode B/C roadmap
   with no corresponding `BUILDER-DECISIONS-REVIEW.md` or `HANDOVER.md` entry anywhere. Read
   `00-readme.md` before treating any of it as settled. It is explicitly self-described as
   "documentation only... nothing applied." Ask the user: who/what produced this, and is it
   endorsed as the actual next-build-order, or is it one input among others?
2. **`public/tutorials/categorized/`** (`Jayshankar-clean` only, untracked, not referenced
   anywhere in `src/`) — the same 36 tutorial videos, copied again into 7 category subfolders
   under a scheme that doesn't match `src/lib/tutorials.ts`'s own categories. Doubles that repo's
   video footprint to 135MB if ever committed. Ask the user what this is for before touching it
   either way (commit it, delete it, or leave it) — it might be a deliberate export for an
   external use (a client-facing folder, a YouTube/Drive upload prep) that has nothing to do with
   the app itself.
3. **Whether Netlify is actually live** — see §4 above.
4. **Whether Pilot mode has genuinely started** — i.e., whether the real wholesaler is using any
   part of this app with real data day-to-day, versus the app still running on demo/seeded and
   provisional-spreadsheet-import data only. Nothing in the docs confirms this either way.
5. **Whether the November 1, 2026 deadline still stands**, and how close today's date is to it —
   this lives in the user's own memory/notes (not written directly into any repo file as of this
   writing), so a new agent has no way to know it exists at all unless told, or unless it reads
   this document.

---

## 7. What's DEFERRED (explicitly, on record — don't build these without a fresh go-ahead)

From `SPEC.md` §9 and scattered locked decisions:
- Full offline **write** support (workers can read offline; writes are blocked, not queued —
  `SPEC.md` D6/§9).
- iOS (D13) — Android only for the native app.
- POS/checkout, GST e-invoicing/e-way bill, barcode scanning, multi-currency, full Tamil/Hindi UI
  translation (a **Tanglish/English/pure-Tamil three-mode** UI has been discussed and scoped
  beyond a binary choice, but not built — its own dedicated pass, per `HANDOVER.md` part 14).
- WhatsApp **inbound** automation, an LLM-agent-in-the-loop deciding database writes from
  messages — explicitly ruled out in `AGENT-BRIEF.md` §4 as a prompt-injection surface that
  fights this project's own audit-log/RLS design; outbound-only, deterministic, via an Edge
  Function, is the only sanctioned shape if this is ever built.
- Search feature phase 2 (employee check-ins/tasks/ratings beyond what exists, vendor
  quality-per-fish ratings, message templates, complaints-search integration) — phase 1 (the
  fish/customer/vendor/employee cards) is built; phase 2 was suggested, never confirmed wanted.
- The frontend visual refresh (`tins-kit/prompts/FRONTEND-REFRESH.md`) — explicitly gated on the
  user declaring V1 testing done; not started, no `FRONTEND-VISION.md` exists yet.
- Google OAuth — discussed, blocked on the user completing Google Cloud Console + Supabase
  provider setup (external, manual steps); the Capacitor-specific gotcha (system-browser +
  deep-link redirect, not an in-WebView one, or Google's anti-embedded-WebView policy rejects it)
  is already documented for whenever this starts.
- Everything in `docs/recommendations/07-tiered-build-priority.md` that isn't already built —
  by definition of that document's own header ("nothing here was applied"), all of it is
  deferred pending the user's own review and approval.

---

## 8. What's PENDING (the actual next-action queue, as of 2026-09-16)

In the order `HANDOVER.md` part 25 leaves them:
1. Decide what to do with the two unknowns in §6 above.
2. Read `docs/recommendations/07-tiered-build-priority.md` and decide whether its proposed order
   actually holds up against everything else on this list — it was written without visibility
   into this decision log, so cross-check its premises rather than taking its priority order as
   given.
3. The frontend refresh (gated on V1 testing being declared done).
4. Offline-conflict UX (alongside continuing Capacitor/mobile work).
5. The Tanglish/English/Tamil UI pass.
6. Whatever the November 1, 2026 deadline actually requires that isn't covered by 3–5 above —
   raise this with the user directly; don't assume it's already covered.

---

## 9. How to continue with a different LLM in a different harness

The rest of this document assumes you (the human) are about to open a **new agent session in a
tool that is not this one** — opencode, a Hermes-agent-style tool, a fresh Claude Code session
with no memory, anything. Assume it has, at minimum: a way to read files, a way to write/edit
files, and a way to run shell commands. Assume it does **not** have: this project's specific
Skill system, persistent cross-session memory, subagent orchestration, or any of the
Claude-Code-specific conventions referenced obliquely elsewhere in this repo's docs (e.g. "the
`run` skill" in `TOOLING-AUDIT.md` — a different harness needs its own equivalent, usually "start
the dev server yourself and take a screenshot via whatever browser-automation tool you have,"
which is exactly what `hyperframes-video/record-*.mjs` already does with plain Playwright — copy
that pattern, it doesn't depend on Claude Code at all).

**Two harness-specific things worth checking before the first prompt, if you know them:**
- Does the new harness auto-run shell commands, or does every command need your explicit
  approval? If the latter, expect to approve `npm install`, `npm run validate`, and any
  Supabase-touching script by hand the first few times.
- Does it persist memory/notes across sessions on its own, or does every new conversation start
  cold? If cold, the comprehension-check step in §11 below matters even more, every single time
  you start a new session with it — there's no assumption it "remembers reading this" from
  yesterday.

### 9a. The exact first prompt to paste

Paste this verbatim as the very first message in the new session:

> This is `jayshankar` — a TINS spec-first inventory app for a Tamil Nadu fresh-fish wholesale.
> Before doing or suggesting anything, read these files in this exact order and do not skip or
> skim any of them: `NEXT-AGENT-ONBOARDING.md`, then `AGENTS.md`, then `HANDOVER.md`, then
> `SPEC.md` §0 (just the locked-decisions section near the top). Do not read `SPEC.md` past §0
> yet. Do not touch any code, run any command, or propose any plan yet. When you've read all
> four, stop and tell me you're ready for a comprehension check — don't summarize what you read
> unprompted, wait for my questions.

**Why it's phrased this way:** the "don't summarize unprompted" instruction is deliberate. An
LLM that skims will often produce a plausible-sounding summary anyway (that's exactly what
skimming produces) — asking specific questions *you* choose, against material *you've* already
read, is a much harder thing to fake than accepting a self-generated summary at face value.

### 9b. Comprehension-check questions (ask these after it says it's ready)

Ask these **one at a time**, not all at once — and actually read the answers against the source
material yourself before moving to the next one. Each is chosen to require having found a
specific, not-guessable-from-general-knowledge fact in the actual text, not something a
model could plausibly produce from "an inventory app usually has X":

1. *"What does `AGENTS.md` say is the very first standing rule, and what's the actual
   consequence of violating it?"* — correct answer references editing `SPEC.md` and
   regenerating, not editing generated code directly; a skimming answer will describe the *idea*
   of a spec-first approach in generic terms without naming the specific rule or its number.
2. *"According to `HANDOVER.md`, are `SPEC.md` and `SPEC-AMENDMENT-v2.md` both currently live
   sources, or has one superseded the other?"* — correct answer: `SPEC-AMENDMENT-v2.md` is
   superseded/historical, folded into `SPEC.md` v2. A skimming answer will often treat both as
   equally current, because that's the more "obvious" guess without having actually read the
   specific part-6 note.
3. *"Name one specific, already-shipped bug this project found by checking a live result against
   what was assumed, rather than by reading code."* — many valid answers exist (the `queryKey`
   collision, the `bill_date` tie-break, the `movement_group_id` NOT NULL gap, the duplicate-
   display-name accounts…) but it has to be a **specific named one with a mechanism**, not a
   generic "they found some bugs by testing."
4. *"What is `Jayshankar-clean`, and name two specific categories of file that are deliberately
   excluded from it that exist in this repo?"* — correct answer names the public-mirror purpose
   and at least two of: `SPEC.md`, `HANDOVER.md`, `AGENTS.md`, `BUILDER-DECISIONS-REVIEW.md`,
   `client-qa/`, `hyperframes-video/`.
5. *"What are the two open, unresolved items flagged in this document's §6, and why haven't they
   been acted on yet?"* — this one specifically tests whether it read `NEXT-AGENT-ONBOARDING.md`
   itself (not just the other three files), since the answer only exists here.

If any answer is vague, generic, or gets a specific number/name wrong, **don't proceed** — tell
it which answer was wrong and why, and ask it to re-read the specific section before continuing.
Do not accept "you're right, let me reconsider" without it actually re-quoting the correct fact
from the file — that response pattern is itself often a tell for "I didn't really read it the
first time either."

### 9c. Follow-up prompts, in order, once comprehension checks pass

Paste these one at a time, waiting for each to finish before the next:

1. *"Now read `SPEC.md` in full (not just §0) — take your time, it's long. Then read the last 10
   entries of `BUILDER-DECISIONS-REVIEW.md` (the highest-numbered ones, currently up to #90) to
   see the most recent work in full detail, not the condensed version in
   `NEXT-AGENT-ONBOARDING.md`. Then read `docs/recommendations/00-readme.md` and skim the rest of
   that folder — it's an unreviewed proposal, not settled work. Tell me when you've done all
   three, and give me a one-paragraph summary of what you think the single highest-priority next
   action is, with your reasoning — I'll tell you if I agree before we do anything."*
2. Once you've reviewed its proposed next action and either agreed or redirected it: *"Run
   `npm run validate` and `npm run typecheck` right now, before touching anything, and tell me
   the exact output — I want to confirm the gate is green in your environment before you change
   anything."*
3. Then, whatever the actual task is — but frame it the way this project's own `AGENT-BRIEF.md`
   §3 and `HANDOVER.md`'s handover protocol (§7) do: **one scoped task at a time**, not "go build
   everything in the recommendations doc." After each one: *"Before you call this done, update
   `HANDOVER.md` with a new dated entry and log a decision in `BUILDER-DECISIONS-REVIEW.md`,
   exactly the way the existing entries are written — read a couple of the most recent ones
   first so your entry matches the established voice and level of detail, don't invent a new
   format."*
4. Periodically (every few tasks, or whenever something feels off): *"Grep the git log for
   commits since the last `BUILDER-DECISIONS-REVIEW.md` update and confirm every commit has a
   matching decision entry. If any don't, write the missing entries now, the same way decision
   #90 in this repo caught up a real gap — don't let it accumulate silently."* This is the
   single most concrete lesson this project's own recent history has to offer a new agent: **the
   discipline of updating the decision log is real work that gets skipped under real conditions,
   even by a capable agent, unless something explicitly checks for it.**

---

## 10. A closing honesty note

This document was itself written by an AI agent (Claude Sonnet 5, in this project's own Claude
Code session) at the user's direct request, after that same session discovered — while writing
it — that its own prior work (34 recorded videos, an in-app Learn page, a full public-repo
resync) had gone unlogged for several days across multiple conversation continuations, until the
user asked for exactly this kind of document and the gap surfaced in the course of preparing it
honestly rather than glossing over it. That is not a reason to distrust this document — the gap
was found and fixed (decision #90, `HANDOVER.md` part 25) rather than hidden — but it is a
concrete demonstration of exactly the failure mode §9's comprehension-check step exists to catch,
and worth keeping in mind: **a capable agent that "read" all the right files can still silently
drop the discipline those files themselves prescribe, under the ordinary pressure of a long
session.** Check the actual git log against the actual decision log periodically, always — for
whichever agent is doing the checking, not just the next one.
