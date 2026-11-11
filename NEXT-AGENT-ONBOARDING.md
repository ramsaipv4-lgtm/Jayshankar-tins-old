# NEXT-AGENT-ONBOARDING.md — handing this project to a different AI, in a different tool

> **Who this is for:** the human maintainer, about to open this repository in an agent or harness that has
> no memory of any earlier session — a fresh Claude Code session, opencode, a Hermes-style tool, anything.
> It is a **meta-document**: it holds no spec and no decision history. It says where those live, in what
> order to read them, how to tell whether the agent actually read them, and what to paste in first.
>
> **Not a replacement for `AGENTS.md`.** `AGENTS.md` is the project's own "read this first" for an agent that
> is already competent and just needs context. This file sits one layer up for the case where the harness is
> weaker or differently shaped, and closes the gap between *having read* the files and *having understood
> them* — a gap this project has fallen into before (§6).
>
> *Rewritten 2026-10-02. The earlier version (a 2026-09-16 snapshot, pre-Phase-B) is preserved in
> `docs/deprecated/NEXT-AGENT-ONBOARDING-2026-09-16.md`. This one deliberately carries no "current state"
> section: state goes stale in a week, so it lives in `HANDOVER.md` §3 where the update protocol keeps it
> honest.*

---

## 0. The one fact that changes everything

**This project is built TINS-style: the spec is the source and the app is generated from it.** `SPEC.md` is
not documentation *of* the app; the app is a compiled artifact *of* it. If the app does something wrong, the
fix is almost never "edit the React component" — it is "find the spec section that is wrong or silent, fix
the spec, regenerate". An agent that misses this spends its session editing symptoms and leaves a codebase
that no longer matches its own source of truth. It is `AGENTS.md` §3 rule 1, the first of twelve standing
rules.

**Two honest limits of that rule today**, so you do not mistake an exception for a violation: (1) the Phase A
UI redesign shipped without a SPEC section (`HANDOVER.md` W11); (2) the `containers` table has the one
recorded DELETE-policy exception (D32). Both are written down; neither is a licence.

---

## 1. Read in this order

| # | File | What it is | How to read it |
|---|---|---|---|
| 1 | `AGENTS.md` | Sixty-second orientation, the role router ("which job are you here to do?"), the 12 standing rules, first commands | In full — short |
| 2 | `HANDOVER.md` | The state tracker: brief, environment, **state snapshot**, content inventory, **work queue (W1–W12)**, gotchas, handover protocol | In full — it is the answer to "what is true now" |
| 3 | `SPEC.md` §0 | The locked decisions D1–D62. Settled; do not relitigate without the owner | §0.2 only, first |
| 4 | `SPEC.md` (rest) | The functional spec: §2 modules, §4 schema/algorithms/dependencies, §8 acceptance, §9 out of scope | **Use it while building**; do not read cover-to-cover up front. Note: §2.1's route map and §4.2.2/§4.2.6 are Mode A text that later decisions (D29, §2.7.1, §4.2.21) correct — see the supersession map at the top of §0.2 |
| 5 | `BUILDER-DECISIONS-REVIEW.md` | Every non-obvious build decision and bug, numbered (~94) | **Grep it, never read it linearly.** Read the last five entries to see what just happened |
| 6 | `REVIEWER-DECISIONS-REVIEW.md` | The Mode A meta-review: 8 findings, three CRITICAL | In full — short, and it names what is risky |
| 7 | `SPEC-AMENDMENT-v3-truckload.md`, `SPEC-AMENDMENT-v4-plan-md.md` | The owner's **list of intended spec changes** (D63–D66, D67–D76), kept as amendments because earlier sessions did not follow the spec-first method. **Live, unmerged.** v3 and Phase B disagree — `HANDOVER.md` W12 | Read the status banner at the top of each before anything else |
| 8 | `docs/DECISIONS.md` | The narrative decision log (#1–#42). A **different numbering** from `SPEC.md`'s D-rows — §3 below | Look up; do not extend without a D-row (`AGENTS.md` rule) |
| 9 | `client-qa/README.md` | Index to the client's own words, the 12 locked visuals, `session3/plan.md`. **Source material, not specification** | When your task touches client intent |
| 10 | `docs/` | Reference and operator docs: `ARCHITECTURE`, `SCHEMA` (generated), `API-REFERENCE`, `BACKEND-PHASE-B-STATUS`, `SUPABASE-SETUP`, `DEPLOY-*`, `REVIEW-BUILD`, `LOOKER-STUDIO-SETUP`, `CONTRIBUTING` | As needed |
| — | `docs/deprecated/README.md` | What was retired, why, where its content went, old path → new path | When a comment or an old doc cites a file that no longer exists |
| — | `TOOLING-AUDIT.md` | The blocking tooling gate (D33). Gitignored | Run `node tins-kit/scripts/tooling-audit.mjs`; it must exit 0 |

**Paths a fresh clone will not have** (gitignored on purpose; each carries its rationale in `.gitignore`):
`tins-kit/` (the vendored kit — so no kit prompts and no `tins-kit/scripts/validate.mjs`), `delegation/` (the
planner/worker ledger), `archive/`, `_external/`, `example-video/`, and every `AUDIT-*.md`. If a file this
doc names is missing, check `.gitignore` before concluding it was deleted.

**`Jayshankar-clean`** (a sibling directory, `github.com/Sairampv98/Jayshankar-clean`) is a deliberately
stripped public mirror — no `SPEC.md`, `HANDOVER.md`, `AGENTS.md`, decision logs, `client-qa/` or
`hyperframes-video/`. **All real work happens in `Jayshankar`, never in the mirror.** Read decision #90 before
resyncing it: a naive file-list sync leaks references to the methodology documents inside code comments.

---

## 2. The verification discipline (why the decision log is worth reading)

Almost every "real bug" in `BUILDER-DECISIONS-REVIEW.md` was found by checking a live result against an
assumption, not by reading code. The phrase recurs: *"checked directly, not assumed"*. Concretely:

1. **A migration is not done when `npm run validate` is green.** That proves the SQL is internally
   consistent with the spec. It must be applied to the live database (the owner runs it in the Supabase SQL
   Editor — no CLI or direct connection exists here) and then **exercised by a script that signs in as a real
   demo user**, not the service key — RLS and `auth.uid()` role checks only run for a real session. The
   `scripts/test-*.mjs` files are the pattern; copy their shape.
2. **A UI change is not done when the diff looks right.** Look at the rendered result signed in as the role it
   is for. Decision #34 is the canonical case: two components sharing the TanStack key `['skus']` left a
   shelf-life column silently blank for weeks, invisible in any diff.
3. **A list "ordered by X" is not ordered once ties are possible.** `bills.bill_date` is a DATE, so every bill
   made today ties and Postgres breaks the tie in storage order (decision #90).
4. **Never trust a self-report** — including your own. The planner/auditor pattern in `delegation/` re-runs
   the gate and does an independent live check rather than accept "the tests passed".
5. **Fix forward.** Once applied, a migration is history. A bug in `0007` is fixed in a new higher-numbered
   file (`CREATE OR REPLACE FUNCTION`, or a fresh `ALTER`), never by editing `0007`. That is what keeps "a
   fresh database runs 0001 → NNNN and ends up correct" a question with an answer.
6. **The overload trap.** `CREATE OR REPLACE FUNCTION` replaces only an identical parameter list. Adding a
   parameter to a live function without a preceding `DROP FUNCTION IF EXISTS <old exact signature>` leaves two
   overloads and a silent `PGRST203`. Make the drop a reflex (SPEC D48, D50).
7. **An unrecorded finding is a finding the next session pays for again.** Update `HANDOVER.md` and log the
   decision before declaring anything done — and **periodically diff `git log` against the decision numbers**.
   Decisions #1–#98 are logged and the numbering is contiguous. The 34-scenario video sprint, the `/learn` page
   and the `Jayshankar-clean` resync went unlogged *in the moment* and decision #90 back-filled them, so read
   #87–#90 together. **Do not repeat that gap by guessing:** log a decision when the work is done, not days later.
   (An earlier version of this file claimed a "#67–#89 hole"; there is none — verified by listing every heading.)

---

## 3. Three numbering systems — never cite a number without naming its log

| Log | Looks like | Range today | Cite it as |
|---|---|---|---|
| `SPEC.md` §0.2 | `D1 … D62` (table rows, all LOCKED) | D1–D62; D63–D66 reserved by v3; D67–D76 proposed by v4; **next free: D77** | `D<n>` — this one, unless stated |
| `docs/DECISIONS.md` | `## Decision n` (ADR prose) | #1–#42 | `docs/DECISIONS.md #n` |
| `BUILDER-DECISIONS-REVIEW.md` | `### Decision n` | #1–#98, contiguous; #90 is retroactive (see above) | `BUILDER decision #n` |
| `client-qa/session3/plan.md` | `P-D1 … P-D24` | its own file | `plan.md P-Dn` |

After about D18 the first two **diverge by roughly six** (SPEC D33 "credit terms" is `DECISIONS.md` #27). Any
sentence of the form "see Dec. 27" that does not name its log is the most likely way to attach a decision to the
wrong precedent. When you add one: **the D-row in `SPEC.md` first, the prose in `docs/DECISIONS.md` second.**

---

## 4. Facts that are not obvious from the code

- **Routing is `HashRouter`.** `page.goto('/some/path')` in a script silently does not navigate in-app — you
  need the `#`. It has bitten the capture scripts repeatedly.
- **Five roles:** `admin`, `co-admin` (full admin parity, exists so a second person can run the business),
  `vendor-rep`, `worker`, `super-worker` (floor access plus a rep's sales/money access). Check `App.tsx`'s own
  `expected` arrays before assuming a role's scope from its name.
- **Money is `numeric(10,2)`, never float.** `audit_log` has no UPDATE or DELETE policy for any role.
- **The secret key never reaches the client.** It lives in `scripts/.env` (gitignored) and only Node scripts
  use it. A key saved to a shared file is burned (`AGENTS.md` rule 12).
- **A container only ever exists already filled** — every INSERT into `containers` happens inside
  `record_container_fill`.
- **Two `public.users` rows per demo account** (the real one, and a placeholder-UUID leftover that 50
  `sales.sold_by` rows still reference). Never look a user up by email or display name expecting one result;
  decode the id from the signed-in JWT's `sub`.
- **Sale and spoilage draw in two phases:** container-tracked stock first (soonest `expires_at`), then
  direct-batch FIFO for whatever is not yet packed.
- **Live is at migration `0036`.** `0037`–`0046` are written, tested on a scratch Postgres 16, and **not
  applied** — and `0046` closes a hole (stock-writing functions callable with the public key alone).
- **Offline writes are decided (D30) but not built.** The PWA caches reads only.

---

## 5. How to continue with a different LLM in a different harness

Assume the new harness can read files, write files and run shell commands, and **cannot** assume: this
project's Skill system, persistent memory, subagent orchestration, or Claude-Code-specific conventions
(`TOOLING-AUDIT.md`'s "the `run` skill" means "start the dev server and take a screenshot with whatever browser
automation you have" — `hyperframes-video/record-*.mjs` does exactly that with plain Playwright).

**Check before the first prompt:** does the harness auto-run commands, or need approval for each? (Expect to
approve `npm install`, `npm run validate` and anything touching Supabase.) Does it keep memory across sessions,
or start cold every time? If cold, the comprehension check below matters on **every** new session.

### 5a. The first prompt — paste verbatim

> This is `jayshankar` — a TINS spec-first inventory app for a Tamil Nadu fresh-fish wholesale. Before doing or
> suggesting anything, read these files in this exact order and do not skip or skim any: `NEXT-AGENT-ONBOARDING.md`,
> `AGENTS.md`, `HANDOVER.md`, then `SPEC.md` §0.2 (the locked-decisions table near the top, nothing past it).
> Do not touch code, run commands or propose a plan yet. When you have read all four, stop and say you are ready
> for a comprehension check — do not summarise what you read unprompted.

The "do not summarise unprompted" clause is deliberate: a skimming model will produce a plausible summary
anyway. Questions *you* pick, against text *you* have read, are far harder to fake.

### 5b. Comprehension check — one question at a time, answers verified against the source

1. *"What is `AGENTS.md`'s first standing rule, and what do you do when you find a defect?"* — Edit `SPEC.md`
   and regenerate; never patch generated code. A skim gives the generic idea without the rule number.
2. *"Which of `SPEC-AMENDMENT-v2`, `-v3` and `-v4` are live, and why are two of them not merged?"* — v2 is
   retired (merged, in `docs/deprecated/`); v3 and v4 are the owner's live list of intended changes, deliberately
   unmerged. A skim treats all three as current.
3. *"`AGENTS.md` rule 5 forbids DELETE policies. Is there an exception, and where is it justified?"* —
   `containers_delete_admin`, migration `0011`, locked decision D32. Never `audit_log`.
4. *"Amendment v3 says a new `receiving-storage` role does blind receiving. Does the database have it?"* — No.
   Phase B uses a `receiving_blind` flag on existing roles, shipping off; `HANDOVER.md` W12 is the open conflict.
5. *"Name one bug this project found by checking live behaviour rather than reading code, with its mechanism."*
   — the `['skus']` queryKey collision, the `bill_date` tie, the `movement_group_id` NOT NULL gap, the `otp_expired`
   token invalidated by a second write. A generic "they found bugs by testing" is a fail.
6. *"Is the offline write queue built? What does `HANDOVER.md` §6 say about a boat-side entry made without signal?"*
   — Not built; the entry is lost.
7. *"Where did the old session diary and `AGENT-BRIEF.md` go, and how do you find where any retired file went?"* —
   `docs/deprecated/`, via its `README.md` (old path → new path).

If an answer is vague or gets a number or name wrong, **do not proceed**: say which answer was wrong and have it
re-read the section. Do not accept "you're right, let me reconsider" unless it re-quotes the correct fact from
the file — that response pattern is itself often a tell for "I did not really read it the first time".

### 5c. Follow-up prompts, in order

1. *"Now read `SPEC.md` in full, then the last five entries of `BUILDER-DECISIONS-REVIEW.md`, then `REVIEWER-
   DECISIONS-REVIEW.md`, then the status banners of both live amendments. Give me one paragraph: what is the
   single highest-priority next action, and why? Do not act yet."*
2. *"Run `npm run validate`, `npm run selftest` and `node tins-kit/scripts/tooling-audit.mjs` now, and show me
   the exact output."* All three must be green before anything changes. (The kit's own selftest must be run
   **from inside `tins-kit/`** — from the repo root it reports 41 false failures because it resolves its
   sibling scripts from the working directory.)
3. Then the real task — **one scoped task at a time**, spec first. After each: *"Before you call this done,
   update `HANDOVER.md` and log a decision in `BUILDER-DECISIONS-REVIEW.md` in the established voice (read two
   recent entries first). Do not invent a format."*
4. Every few tasks: *"Diff `git log` against the decision numbers and write any missing entry now."*

---

## 6. A closing honesty note

The 2026-09-16 version of this file was written by an AI session that discovered, *while writing it*, that its
own prior work (34 recorded videos, an in-app Learn page, a public-repo resync) had gone unlogged for days. The
2026-10-02 rewrite exists because a later audit found a second class of the same failure: **sessions that did
not know the methodology kept the database disciplined and the front end and tooling undisciplined** — ten
dependencies with no SPEC row, a UI redesign with no SPEC section, a design for the same need written twice
without either document knowing. None of that is a reason to distrust the documents; each was found and
recorded rather than hidden (`BUILDER-DECISIONS-REVIEW.md` decisions 93–94). It is a reason to check the actual
`git log` against the actual decision log, every time, whichever agent is doing the checking.
