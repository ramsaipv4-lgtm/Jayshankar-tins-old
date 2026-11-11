# AGENTS.md — onboarding for a new LLM session

> You are a new session about to work on `jayshankar`. Read this before anything else.
> If you are a human, read `README.md` instead — this file tells your AI assistant what to do on day one.
>
> **Last updated:** 2026-10-02 (methodology and documentation reconciliation: ten dependencies given SPEC rows;
> the one DELETE-policy exception written into rule 5; the read list, a numbering-systems table and a
> documentation standard added; superseded documents moved to `docs/deprecated/`). Before that: 2026-09-29
> (deck 2 built and wired; the Phase B docs landed as a merge; `REVIEWER-DECISIONS-REVIEW.md` created).

---

## 0. Sixty-second orientation

- **Product:** an inventory management web app for a Tamil Nadu fresh-fish wholesale. PWA, offline graceful degradation. 3 user roles: admin, vendor-rep, worker.
- **Methodology:** TINS. `SPEC.md` is the source code. The app is generated from it. Never fix a defect by editing generated app code; edit `SPEC.md` and regenerate.
- **Stack:** Vite + React 18 + TypeScript + Tailwind 3 + Supabase (Postgres + Auth + RLS + Realtime) + Netlify. PWA via `vite-plugin-pwa`.
- **Also in the repo, not in the app's runtime — three client review decks** (the third, *The Run*, is described at the end of this bullet). Decks 1 and 2: Both present the same 32 chapters of screen *data* (`src/lib/storybook/`) and the same device-frame drawings; the **shell** differs. Deck 1 is the app's own look (Tailwind, `ChapterPlayer`); deck 2 is a native **Ant Design 6** workbench (`src/components/storybook-ant/deck/` — its own navigation, steps view, lightbox and tour, not `ChapterPlayer`) (`src/components/storybook-ant/`, its own build `dist-storybook-ant/`, never routed inside the app, `antd` imported by nothing else). The client is choosing between the two looks — **D67**, open, in `SPEC-AMENDMENT-v4-plan-md.md`. See `docs/REVIEW-BUILD.md` §7–§8. **Deck 3, *The Run*** (`src/components/storybook-run/`, `src/lib/storybook-run/`, `dist-storybook-run/`) shares **data but no renderer code** with decks 1–2, adds no dependency, shows the v3/v4 amendments' new functionality as one truck load's day seen through several roles (§9), and draws the same 44 chapters as the other two so the three can be compared (§10). **Twelve persona walks** live in `src/lib/storybook/journeys/` as ordinary chapters (group `journeys`). Tests: `src/lib/storybook-run/*.test.ts`, `src/lib/storybook/journeys/journeys.test.ts` — keep them green if you edit an act or a walk; run them with `npx vitest run` (`vitest.config.ts` keeps `_external/` experiments out).
- **Built and working:** the SPEC (D1–D62 committed, 58 acceptance criteria in §8), migrations `0001`–`0036`
  applied to the live Supabase project, the app (Mode A + containers, CRM, reversals, notifications, check-ins/tasks,
  search phase 1, Capacitor Android wrap), and both review decks.
- **Written but not applied / not built:** migrations `0037`–`0046` (Phase B — staged, **not applied**, and `0046`
  closes a live hole); the Phase A UI redesign is built in part but has **no SPEC section yet** (decision 93 in
  `BUILDER-DECISIONS-REVIEW.md`). `HANDOVER.md` §3–§5 is the live picture; this paragraph is orientation, not status.
- **Mode A (Demo) target:** 1–2 weeks. Seeded data, demoable to the gatekeeper client.
- **Mode A → B → C lifecycle** (SPEC §0.2 D7, §App B): Demo is the gate to Pilot; Pilot is the gate to Production. Skipping a mode is a decision the spec requires to be made explicit.

## 0a. Which job are you here to do?

| The user asked you to… | Role | Go to |
|---|---|---|
| Build the app (start at W1) | R2 Builder | `HANDOVER.md` §5, then `SPEC.md` §2 + §4 for the W item |
| Amend the SPEC | R1 Spec author | Read SPEC.md §0 first, then `tins-kit/prompts/SPEC-AUTHOR.md` |
| Review the builder's work | R3 Reviewer | `BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md` |
| Check status / hand the project on | R4 Maintainer | `HANDOVER.md` §1 |
| Build one delegated task (you were handed a task brief, not this file, by a human relay — e.g. a MiniMax Coder session) | Worker | `delegation/README.md` first — this project's worker setup is an adaptation of `tins-kit`'s `self-parallel` mode, not the default. Your brief already has everything else you need; don't go re-deriving project state from scratch. |
| Plan/split work for a worker, or audit work a worker returned | Planner/Auditor | `delegation/README.md`, `delegation/LEDGER.md`, `tins-kit/prompts/WORKER-SESSION.md` (the brief shape in use here), `tins-kit/lib/patterns/tiered-escalation.md` |

## 0b. What is in scope and what is not

**In scope (V1):** inventory, sales recording, basic pricing (per-batch), audit log, 3 user roles, PWA offline read-only, demo seed.

**Out of scope (V1):** POS, GST invoicing, customer CRM, supplier contracts, multi-store, barcode scanning, photo capture, multi-currency, full Tamil/Hindi UI translations, iOS-specific design, offline write-queue, reverse-sale, worker-records-sale. See `SPEC.md` §9.

**Explicitly locked out in V1:** iOS (D13), no POS (D15), no offline write-queue (D6 + §9).

**Also in the repo, and not part of the app's runtime:** the **client review deck** — 32 animated
chapters in `src/lib/storybook/` (screens are *data*, drawn by `src/components/storybook/`), reachable
at `#/storybook` and unauthenticated at `#/review`. It reads no data, calls no Supabase, and exists so
the client can approve the whole flow before it is built. It also builds as a standalone site
(`npm run build:storybook` → `dist-storybook/`, published to `github.com/Sairampv98/Jayshankar-ui`).
Read `docs/REVIEW-BUILD.md` before touching it, and decisions 41–42 in `docs/DECISIONS.md` before
changing how it is built or hosted. A **second** deck draws the identical chapters in Ant Design
(`src/components/storybook-ant/`, `docs/REVIEW-BUILD.md` §8); which look the app ships is the open
**D67** in `SPEC-AMENDMENT-v4-plan-md.md`.

## 1. Read these, in this order

| # | File | Why |
|---|---|---|
| 0 | `NEXT-AGENT-ONBOARDING.md` | **If you are in an unfamiliar harness, or this is a hand-off:** the read map, the verification discipline, a first prompt and a comprehension check. Skip it if you are already a competent session with project context |
| 1 | `HANDOVER.md` | Current state, work queue (W1–W12), gotchas, handover protocol |
| 2 | `SPEC.md` §0 (locked decisions) | The decisions that are already settled — do not relitigate them. `docs/DECISIONS.md` #1–42 is the narrative log; amendments v3/v4 hold the proposed **D63–D76** — the owner's **live, unmerged list of intended spec changes** (read each one's status block first; v3 conflicts with what Phase B built, `HANDOVER.md` W12). `SPEC.md` §0.2c maps which rows are corrected by later ones. |
| 3 | `SPEC.md` §2 + §4 for whatever you are building | Modules and algorithms |
| 4 | `BUILDER-DECISIONS-REVIEW.md` and `REVIEWER-DECISIONS-REVIEW.md` | What was tried, what failed, what's open |
| 5 | `archive/exam-forge-reference/` (read-only) | The prior TINS project. Methodology reference, NOT to be developed. |
| 6 | `docs/REVIEW-BUILD.md` | Only if your job touches the client review deck (the storybook) — how it is authored, built, published and what to send the client. §8 covers the second (Ant Design) deck. |
| 7 | `client-qa/session3/plan.md` + `SPEC-AMENDMENT-v4-plan-md.md` | Only if you are about to touch the client deck, the versioning, or the Phase B backlog. `plan.md` is **source material for client intent**, not a repo artifact — its `P-Dn` numbers are its own sequence, never `SPEC.md`'s, and where it disagrees with the repo the repo wins (its own rule). The amendment is the reconciliation, and it also holds the open **D67**. **Start at `client-qa/README.md`**, which gives the status of every file there and says which questions are the owner's to close. |
| 8 | `docs/deprecated/README.md` | **Only when something you are reading cites a file that no longer exists.** Retired documents (the old session diary, `AGENT-BRIEF.md`, `SPEC-AMENDMENT-v2.md`, the 2026-09 research, …) with old path → new path. Nothing there is authoritative |

**Two rows above point at paths this repo does not version-control.** `tins-kit/` (row 3's prompt,
row 5's sibling) and `archive/exam-forge-reference/` (row 5) are gitignored along with `delegation/`
and `_external/` — all four are kept on disk deliberately, not lost. Consequences worth knowing
before you conclude a file was deleted: **a fresh clone has no `tins-kit/`**, so the kit prompts and
`tins-kit/scripts/validate.mjs` are absent there; and `delegation/` (the worker task ledger this
file's §0a refers to) is absent too. `.gitignore` carries the rationale for each.

**Three numbering systems — never cite a number without naming its log** (a decision recorded in only one is
invisible to the others, and after about D18 the first two diverge by roughly six):

| Log | Looks like | Range today | Cite it as |
|---|---|---|---|
| `SPEC.md` §0.2 | `D1 … D62`, table rows, all LOCKED | D1–D62; D63–D66 reserved by v3; D67–D76 proposed by v4; **next free: D77** | `D<n>` unless stated |
| `docs/DECISIONS.md` | `## Decision n`, ADR prose | #1–#42 | `docs/DECISIONS.md #n` |
| `BUILDER-DECISIONS-REVIEW.md` | `### Decision n` | #1–#98, contiguous (checked 2026-10-02 — an earlier note here claiming a #67–#89 hole was wrong); #90 was written retroactively for work that spanned #87–#90's session, so read #87–#90 together | `BUILDER decision #n` |
| `client-qa/session3/plan.md` | `P-D1 … P-D24` | its own file | `plan.md P-Dn` |

**When you record a decision: the `D` row in `SPEC.md` §0.2 first (that needs the owner — it is *Ask first*),
the prose in `docs/DECISIONS.md` second, the build record in `BUILDER-DECISIONS-REVIEW.md` third.**

## 2. First commands

```bash
node --version          # need >= 18
ls supabase/            # confirm migrations exist (after W1)
ls scripts/             # confirm validate.mjs exists (after W1)
npm run validate        # the gate. Exits 0 or non-zero.
```

Expect: validate green. If red, stop and fix before touching anything else. A broken gate is worse than no gate.

## 3. Standing rules (non-negotiable)

1. **Never edit generated code to fix a defect.** Edit `SPEC.md` and regenerate. The spec is the source.
2. **Never add a runtime dependency without amending the SPEC.** SPEC §4.4 lists every package — `antd` and `@ant-design/icons` are logged there as the review deck's second design language, imported by nothing in the app, with **D67** open. "Without amending the SPEC" means *before* the package lands, in the same change: the 2026-10-02 reconciliation had to back-fill ten packages (`fuse.js`, the shadcn/Radix layer, `lucide-react`, `@capacitor/cli`, `playwright`) that arrived without one.
3. **Never add a table or column without a migration.** SPEC §0.2 D2 — all schema changes are versioned SQL files in `supabase/migrations/`.
4. **Never bypass RLS** with a `secret` key in the browser. The `secret` key (formerly `service_role` in Supabase's older API key naming) is server-only and never ships in the JS bundle. (SPEC §4.1)
5. **Never add a DELETE policy to any table** — soft-delete (`active = false`) is the rule (SPEC §2.3.4, §3.8). There is **one recorded exception**: `containers_delete_admin` (migration `0011`, **D32**), so a never-filled container can be removed; its FK still blocks deleting any container with fill history. Any further exception needs its own locked decision first, not a migration that quietly precedes one. `audit_log` never gets a DELETE (or UPDATE) policy — rule 10 has no exception.
6. **Never call the demo banner code from production.** The feature flag `VITE_DEMO_MODE` must be `false` in Mode B and Mode C builds. (SPEC §0.2 D14, §2.13)
7. **Never store money as float.** SPEC §3.6 — `numeric(10,2)` everywhere.
8. **Never reproduce Tamil fish names from your own knowledge when a real source is available.** The seed in SPEC §App A is plausible; the wholesaler's actual names will differ — easy to fix in Mode B.
9. **Never let a validator failure through.** No `--force`, no "warn and continue". SPEC §0.2 D16 is explicit.
10. **The audit log is append-only.** SPEC §0.2 D5. No UPDATE, no DELETE policy. The trigger is the only writer.
11. **The schema and the validator are the arbiter.** SPEC §0.2 D16. A migration that fails the validator does not get applied.
12. **Hardcoded credentials are a build break.** Rotate first, clean second. A key that has merely been saved to a shared file is burned. (Carried from exam-forge's standing rule; SPEC §3.2 covers the storage-failure path, but credential handling is the contributor's job.)

## 4. Ask vs. try

**Try** (just do it, then report): anything covered by `SPEC.md`; adding validator checks with matching self-tests; adding a RLS test for a new policy; adding a migration that follows the existing pattern; copying a UI component from the kit (when tins-kit exists).

**Ask first**: changing anything in `SPEC.md` §0.2 (the locked decisions); changing the Supabase project (it's free tier, but the project is a real resource); adding a runtime dependency; anything that would introduce a server, a backend outside Supabase, or stored results on a third-party service.

## 5. When you finish

Follow the handover protocol in `HANDOVER.md` §7. An unrecorded finding is a finding the next session pays for again.

**Documentation standard** (the client asked for documentation a future maintainer — human or another AI —
can extend this app from, without the current developer in the loop). Concretely: every migration carries a
comment saying **why**, not just what; every decision goes in `BUILDER-DECISIONS-REVIEW.md` without exception;
write plain-language sections for domain concepts (`SPEC.md` §2.5a is the model) assuming the reader has never
seen a fish wholesale. An explicit, unambiguous spec is also what makes agent-driven work reliable.

**Moving a document is a decision too.** If a document is wholly superseded, `git mv` it to `docs/deprecated/` and
add its row to that directory's `README.md` (what it was, why, where its content went). If it is only partly
true, put a status banner on it instead.

## 6. If you find a new gap

This section mirrors the kit's own `AGENTS.md` §6, because a finding that only lives in the file you
happened to be reading is a finding the next session re-derives. Two kinds of finding, two homes:

**A generalisable lesson or pattern** (a thing two or more projects would share — a Supabase
behaviour, a migration shape, a validation trick): record it in `BUILDER-DECISIONS-REVIEW.md` as a
decision, and flag it as a **kit-growth candidate** in the same entry. The kit grows by
`tins-kit/prompts/KITTING.md` from the kit machine; this repo is a consumer and never edits
`tins-kit/` directly. An example from this session: the kit's `migration-runner.mjs` calls
`require('node:crypto')` inside an ESM module and throws before applying anything.

**A project-specific gap** (missing doc, stale figure, an artifact that does not exist yet): fix it
in place if it is cheap, and record it where its reader will look —
`REVIEWER-DECISIONS-REVIEW.md` for a mode-level finding, `HANDOVER.md` §6 for a gotcha, `HANDOVER.md`
§5 as a W item for real work, and `SPEC.md` §0.2 for anything that is actually a decision.

**Then do the two things that make a finding survive the session:** update `HANDOVER.md` §1/§3/§4 to
match, and re-run the gate (`npm run validate`, `npm run selftest`, `npm run build`). A finding
recorded against a state snapshot that still says something else is only half-recorded — that is
exactly the defect `REVIEWER-DECISIONS-REVIEW.md`'s Finding 1 describes.
