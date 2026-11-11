# docs/deprecated/ — retired documents, and how to work in this repository

> **Nothing in this directory is authoritative.** Every file here was true once, or was a proposal that was
> never adopted, and has since been superseded by something live. They were **moved, not deleted**, on
> **2026-10-02**, so the live documents could return to the shape the TINS kit prescribes — and so that anyone
> who meets a stale reference (a code comment, an old note) can find out what it was and where its useful content
> went. Git history keeps every earlier version as well.
>
> **If you are an AI agent or a new maintainer: you do not need to read anything in this directory to work on the
> project.** Read the files in §1 instead. Come back here only when something you are reading cites a file that no
> longer exists.

---

## 1. How to work in this repository — and how to get the right context

### The read order

| # | Read | What you get | Time |
|---|---|---|---|
| 1 | [`AGENTS.md`](../../AGENTS.md) | Orientation, **which job you are here to do**, scope, the 12 standing rules, the first commands | 5 min |
| 2 | [`NEXT-AGENT-ONBOARDING.md`](../../NEXT-AGENT-ONBOARDING.md) | The read map in full, the verification discipline, the three numbering systems, the first prompt and a 7-question comprehension check — **written for an agent in an unfamiliar harness** | 10 min |
| 3 | [`HANDOVER.md`](../../HANDOVER.md) | **The current state**, the work queue (W1–W12), gotchas, the handover protocol. This is the answer to "what is true now" | 10 min |
| 4 | [`SPEC.md`](../../SPEC.md) §0.2 (+ §0.2c) | The locked decisions D1–D62, and which later rows correct which earlier ones | 15 min |
| 5 | `SPEC.md` §2 + §4 for **the thing you are building** | Modules, schema, algorithms. Use it while working; do not read it cover to cover first | as needed |
| 6 | [`BUILDER-DECISIONS-REVIEW.md`](../../BUILDER-DECISIONS-REVIEW.md) (last five entries) and [`REVIEWER-DECISIONS-REVIEW.md`](../../REVIEWER-DECISIONS-REVIEW.md) | What just happened, and what a reviewer thinks is risky | 10 min |
| 7 | The two live amendments, [`v3`](../../SPEC-AMENDMENT-v3-truckload.md) and [`v4`](../../SPEC-AMENDMENT-v4-plan-md.md) — **read each one's status block first** | The owner's list of intended spec changes (D63–D76). Unmerged, deliberately | 10 min |
| 8 | [`client-qa/README.md`](../../client-qa/README.md) | The client's own words and what was built from them. **Source material, not specification** | when relevant |

### Get to "ground truth" before you change anything

```bash
npm run validate                           # typecheck + 73 structural checks — must exit 0
npm run selftest                           # proves the validator fails on known defects
node tins-kit/scripts/tooling-audit.mjs    # the blocking tooling gate — must exit 0
node tins-kit/scripts/validate.mjs --spec=SPEC.md     # the kit's own check of the spec
```

If any of these is red, **stop and fix it first** — a broken gate is worse than no gate. (`tins-kit/` is
gitignored; a fresh clone does not have it. See `AGENTS.md` §1.)

### The five habits that keep the context honest

1. **The spec is the source.** Fix a defect by editing `SPEC.md` and regenerating, never by patching generated code.
2. **Check, do not assume.** A migration is not done until it has been applied *and exercised as a real user*; a UI
   change is not done until you have seen it rendered (`NEXT-AGENT-ONBOARDING.md` §2).
3. **Name the log.** `D27`, `Decision 27` and `P-D27` are three different decisions in three different files.
4. **Record before you stop.** Update `HANDOVER.md`, log a decision, re-run the gate. An unrecorded finding is paid
   for again by the next session — and periodically diff `git log` against the decision numbers.
5. **Do not close the client's questions.** Open questions in `client-qa/` and the amendments are the owner's.

### Handing the project to a different AI or tool

Paste the **first prompt** from `NEXT-AGENT-ONBOARDING.md` §5a, then put the agent through the comprehension check in
§5b **before** it touches anything. The check is built from facts you cannot guess — which amendments are live,
whether the database has a `receiving-storage` role, the one DELETE-policy exception — so a skimming agent fails it.

---

## 2. What is in this directory, and where its content went

**Old path → new path** (use this to resolve a stale reference):

| Retired file | Moved to | Why it was retired | Where its useful content went |
|---|---|---|---|
| `SPEC-AMENDMENT-v2.md` | `docs/deprecated/SPEC-AMENDMENT-v2.md` | **Merged** into `SPEC.md` v2 on 2026-09-10 (D18–D27, with revisions: `stores` → `warehouses`, the meaning of `transfer`). It said so itself | `SPEC.md` §0.2 D18–D27 and the new sections; record in `BUILDER-DECISIONS-REVIEW.md` #36. Its §G infrastructure notes (no LLM agent writing production data; a scheduled `pg_dump` backup) were **dropped in the merge** and are now `HANDOVER.md` §6 gotchas |
| `AGENT-BRIEF.md` | `docs/deprecated/AGENT-BRIEF.md` | The Mode B kickoff brief; its build order (containers → bills → CRM → repack → notifications) was **fully executed** and it still described a "9-table schema" | `HANDOVER.md` §5; its standing gotchas (no LLM-in-the-loop for WhatsApp writes, R2 presigned URLs, the 3-state photo pattern, Looker role RLS, GitHub-Actions backups) are in `SPEC.md` D19/D20/D25/D26 or `HANDOVER.md` §6; its documentation standard is `AGENTS.md` §5 |
| *(the diary at the top of)* `HANDOVER.md` | `docs/deprecated/HANDOVER-session-log-2026-08-to-2026-09.md` | ~560 lines of per-session narrative, each part citing a decision, ahead of the real §1. The kit's HANDOVER shape is brief → environment → state → inventory → queue → gotchas → protocol | Verbatim in the file. Still-live items were carried into `HANDOVER.md` §5 "Backlog carried from the session log". Its **"November 1, 2026" deadline is superseded** — Play submission 1 Dec 2026, live 15 Dec |
| `NEXT-AGENT-ONBOARDING.md` (2026-09-16 version) | `docs/deprecated/NEXT-AGENT-ONBOARDING-2026-09-16.md` | A pre-Phase-B snapshot: stale file map, "current state", unknowns and pending lists | **Rewritten, not replaced** — the live `NEXT-AGENT-ONBOARDING.md` keeps §0, the verification discipline, the facts and the first prompt, re-aimed at the current files |
| `AUDIT-2026-09-10.md` | `docs/deprecated/AUDIT-2026-09-10.md` | A point-in-time workspace audit; its "Mode B 0% implemented", `0)` stray file and "no git repo" findings are all out of date. **Gitignored (`AUDIT-*.md`), so it exists only on the maintainer's disk, not in a clone** | The validator regression it found is `BUILDER-DECISIONS-REVIEW.md` #30 |
| `client-qa/session3/plan.defered-flutter.md` | `docs/deprecated/client-qa/plan.defered-flutter.md` | The Flutter-era first version of `plan.md`, written before any code. Same 16-section skeleton | `client-qa/session3/plan.md` (rebased onto the real app) carries its research (§13/13A) verbatim; its role-editor grid is `plan.md` §3.4 backlog |
| `docs/recommendations/` (10 files) | `docs/deprecated/recommendations/` | A 2026-09-15 roadmap of unknown authorship, "documentation only". It claims "39 migrations 0001–0039" (there were 36) and **proposes migrations `0040`–`0050` that collide with the real Phase B `0037`–`0046`** — its festival and report ideas were largely built under other names (`0042`, `0043`) | Nothing was endorsed. Treat as an **idea backlog**; re-derive numbers and check overlap with Phase B before using any item. Open items listed in `HANDOVER.md` §5 |
| `docs/competitive-audit-2026-09-16.md`, `docs/design-sample/` (8.9 MB) | `docs/deprecated/research/` | A design-direction research pass (three options A/B/C) that asked the user to pick one; **superseded by the client's 12 locked visuals** and the Phase A tile-grid home | `client-qa/developer-prompt-image/` and `HANDOVER.md` W11. The 5 `scripts/capture-*.mjs` that produced the PNGs still write to the *old* `docs/design-sample/` path |
| `docs/W2…W5-MANUAL-VERIFICATION.md`, `docs/W3-DIAGNOSTIC.md` | `docs/deprecated/mode-a-checklists/` | Mode A smoke-test checklists (three role shells, four forms). `W3-DIAGNOSTIC.md` queries `skus.name`, a column that does not exist | The validator (`npm run validate`), the live `scripts/test-*.mjs` and the SQL suite (`supabase/tests/`) are the current contract |

### Stale references you may meet, and why they were not edited

Applied migrations are history and are **never edited** (`SPEC.md` D2: "the schema is never edited in place"), so comments inside them keep their
old paths. The same goes for code comments:

| Where | Cites | Now at |
|---|---|---|
| `supabase/migrations/0006_container_model.sql`, `scripts/test-container-fill.mjs` | `AGENT-BRIEF.md` | `docs/deprecated/AGENT-BRIEF.md` |
| `scripts/validate.mjs` (a comment on the §8.1a marker check) | `AUDIT-2026-09-10.md` §2 | `docs/deprecated/AUDIT-2026-09-10.md` (local only) and `BUILDER-DECISIONS-REVIEW.md` #30 |
| `src/lib/supabase.ts` (a comment) | `docs/W2-MANUAL-VERIFICATION.md` | `docs/deprecated/mode-a-checklists/` |
| `BUILDER-DECISIONS-REVIEW.md`, `HANDOVER.md` (older entries) | any of the above | the table above |

---

## 3. What was reviewed and deliberately **kept live**

So that nobody retires these by mistake:

- **`SPEC-AMENDMENT-v3-truckload.md` and `SPEC-AMENDMENT-v4-plan-md.md`** — the owner's list of intended spec
  changes, kept as amendments because earlier sessions did not follow the spec-first method. Not merged, not
  retired. v3 now carries a verified status check (it conflicts with what Phase B built).
- **`client-qa/`** (except the one retired plan) — source material and open client questions.
- **`docs/DECISIONS.md`, `SCHEMA.md`, `API-REFERENCE.md`, `BACKEND-PHASE-B-STATUS.md`, `BACKEND-REQUIREMENTS-phase-b.md`,
  `SUPABASE-SETUP.md`, `DEPLOY-NETLIFY.md`, `DEPLOY-GITHUB-PAGES.md`, `REVIEW-BUILD.md`, `LOOKER-STUDIO-SETUP.md`,
  `ARCHITECTURE.md`, `CONTRIBUTING.md`** — reference and operator documents. Several were corrected the same day
  (`ARCHITECTURE.md` was rewritten; `README.md` too).

## 4. Rules for adding to this directory

1. **Move with `git mv`**, never copy-and-delete, so history follows the file. (Gitignored files such as `AUDIT-*.md`
   can only be moved on disk.)
2. **Add a row to §2** with what the file was, why it is retired, and where its useful content went. If you cannot
   fill in the last column, the content has not been merged yet — merge it first.
3. **Never edit an applied migration** to fix a path; add a line to the "stale references" table instead.
4. **Prefer a banner over a move** when a document is partly true (see the status blocks on the amendments and on
   `client-qa/` files). Move only what is wholly superseded.
