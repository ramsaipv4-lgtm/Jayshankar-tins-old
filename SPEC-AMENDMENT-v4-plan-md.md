# SPEC-AMENDMENT-v4 — `plan.md` reconciled into the TINS doc set

**A new spec version, listed as such: `SPEC.md` is not edited by it.** This document is version 4 of
the specification — numbered, changelogged and self-contained — so the ten decisions it holds
(D67–D76) can be reviewed, cited and merged as one unit. Nothing here is merged into `SPEC.md` yet,
and §8 holds that merge prepared rather than applied.

| | |
|---|---|
| **Version** | `SPEC-AMENDMENT-v4` → proposed **SPEC v4** |
| **Base** | `SPEC.md` as committed — "Canonical Specification (v2)", §0.2 **D1–D62** — plus `SPEC-AMENDMENT-v3-truckload.md`'s reserved **D63–D66** |
| **Adds** | **D67 – D76**, ten decisions, written out in full in §6 |
| **Date** | 29 Sep 2026 |
| **Status** | **DRAFT — listed, not merged.** Numbering **approved** 2026-09-29; the merge is withheld by choice, not by an open question |
| **Supersedes** | nothing in `SPEC.md` D1–D62. Two entries of my own outside it — see §5.2 |
| **Merges itself into `SPEC.md`?** | No. §8 holds the merge, prepared and withheld |
| **Landed separately** | `SPEC.md` §4.1 (the `antd` package rows and the forbidden-list exception) plus the docs around it — `docs/ARCHITECTURE.md` §Stack, `docs/REVIEW-BUILD.md` §8, `docs/CONTRIBUTING.md`, `AGENTS.md`, `TOOLING-AUDIT.md`. Those are dependency **facts** that `AGENTS.md` rule 2 requires in the SPEC; the **decision** about them stays here as D67. See §5.1 |

> **Not merged into `SPEC.md`.** This version does not change what gets built, with one exception that
> §5.3 shows is not a change at all: D67 is an **open question**, recorded so the client's answer has
> somewhere to land. It reconciles an outside planning artifact — `client-qa/session3/plan.md`
> (553 lines, 2 Oct 2026) — against this project's actual TINS structure, because the two disagree
> about where the source of truth lives, how decisions are numbered, and which parts of the work
> already exist.
>
> **Walked through per `tins-kit/prompts/NEW-PROJECT.md`**, which is the kit's own statement of what
> a TINS project's documents are. Read that file first if this is unfamiliar: the pertinent fact is
> that **`NEW-PROJECT.md` never mentions `plan.md`.** TINS's artifact set is `SPEC.md` (root,
> canonical) → `HANDOVER.md` (the W-queue) → `BUILDER-DECISIONS-REVIEW.md` → `AGENT-BRIEF.md` /
> `AGENTS.md` → `delegation/LEDGER.md`, with `TOOLING-AUDIT.md` as a blocking gate. A second
> top-level plan is not one of them, so it has to be either folded in or declared source material.
>
> Precedent: `SPEC-AMENDMENT-v2.md` was merged into `SPEC.md` as D18–D27;
> `SPEC-AMENDMENT-v3-truckload.md` is still draft.
>
> **Read §5 before §6.** §5 is the short ledger — what this version completes, what it supersedes or
> withdraws, and what is waiting on somebody else. §6 then writes D67–D76 out in `SPEC.md` §0.2's
> exact row shape, so that merging later is a paste rather than a rewrite.

> ### Status note, 2026-10-02 — what has changed since this was written
>
> - **Still live and unmerged.** The owner confirmed (2026-10-02) that the amendments are their way of listing
>   the spec changes they want, so this file is **not** retired. D77 is the next free number.
> - **§7 item 4 is now done:** `REVIEWER-DECISIONS-REVIEW.md` exists (created 2026-09-29). `docs/feedback.md`,
>   which `plan.md` names, still does not.
> - **§5.1 and §7 name `SPEC.md` §4.1 for the `antd` rows.** The package rows are in **§4.4**; §4.1 holds one
>   stack row for the review decks. `AGENTS.md` rule 2 now says §4.4.
> - **A conflict this file does not mention:** its D72 ("no sixth role") treats `SPEC-AMENDMENT-v3`'s D65 as
>   "the sanctioned exception", but the Phase B migrations built blind receiving **without** that role. See
>   `SPEC-AMENDMENT-v3-truckload.md`'s status check and `HANDOVER.md` W12.
> - **Paths moved.** `docs/recommendations/` is now `docs/deprecated/recommendations/`; the retired
>   `plan.defered-flutter.md` is `docs/deprecated/client-qa/`. `docs/deprecated/README.md` maps every move.
> - **Numbering collision to avoid.** `client-qa/feature-comparison.md` also proposes "D63–D65" (a visual lock,
>   page-per-action navigation, a separate website product). Those are unratified proposals tied to open client
>   questions, **not** reserved numbers; v3 holds D63–D66.

---

## 1. What `plan.md` is, and what it is not

`plan.md` is a **build plan written for a coding agent** ("Build plan for Claude Code (or any coding
agent)"), rebased 2 Oct onto "the app that exists". It is detailed, honest and mostly accurate about
the business. It is not a TINS artifact, and it does not try to be: its §0.1 tells the reader to keep
it at the repo root and have `CLAUDE.md` say "Read plan.md first, then `docs/DECISIONS.md`".

Its own words on precedence are the important ones, and they settle this amendment:

> "Where they disagree, **the repo and its decision log win over this file**, and this file says
> where it has moved."

So the reconciliation below is not a critique of `plan.md`. It is the mechanical application of that
sentence, plus the TINS rule that `SPEC.md` is where locked decisions live.

---

## 2. The finding that matters: two decision logs, and the wrong one is being extended

This repo contains **two** decision logs, and they are not the same set:

| Log | Format | Range in this checkout |
|---|---|---|
| `SPEC.md` §0.2 | `\| **D1** \| … \| LOCKED \|` — the TINS "locked decisions" table | **D1 – D62** |
| `docs/DECISIONS.md` | ADR-style `## Decision N` with Context/Considered/Decision/Consequences | **1 – 17**, now **1 – 19** after the storybook decisions |

D1–D17 exist in *both*, describing the same decisions in two formats (`docs/DECISIONS.md` #7
"3-mode deployment lifecycle" = SPEC D7; #13 "iOS out of scope" = SPEC D13; #17 "Authored data
separate from derived data" = SPEC D17). After D17, **`docs/DECISIONS.md` stops** while `SPEC.md`
carries on to **D62** — 45 decisions that exist in one log only.

That is a live defect, not a historical curiosity:

- `AGENTS.md` §5 and `docs/CONTRIBUTING.md` both instruct an agent to record a decision in
  `docs/DECISIONS.md`. Follow that literally and you extend the log that stopped at 17.
- `SPEC.md` §0.2 is the TINS table that `tins-kit`'s own validator and reviewers read. A decision
  that only exists in `docs/DECISIONS.md` is invisible to them.
- The storybook decisions taken on 29 Sep (the deck is data; its review build ships as its own
  deployed site) were recorded as **#18/#19** in `docs/DECISIONS.md`, because that file appeared to
  end at #17. **§3 shows that number is already taken** — the canonical log has 40 entries and #18/#19
  are mobile decisions. Those two entries must become **#41/#42** (with D67/D68 in `SPEC.md` §0.2,
  since amendment v3 claims D63–D66). I am calling out my own work here: I followed the contributor
  doc, which is the wrong instruction.

**Proposal:** `SPEC.md` §0.2 is the canonical *locked-decisions* table, because that is the artifact
TINS's own reviewers and validator read. `docs/DECISIONS.md` becomes explicitly the *narrative* log —
a better format than a table row for decisions whose reasoning needs prose — and every entry it holds
must have a corresponding `D<n>` row in `SPEC.md` §0.2, phrased "see `docs/DECISIONS.md` #n" for the
long form. `AGENTS.md` §5 and `docs/CONTRIBUTING.md` then say: **add the D-row first, write the prose
second.**

---

## 3. The citation remap — every "Dec. N" in plan.md resolves, but against a log this checkout does not have

`plan.md` §2 declares its protocol plainly: *"Numbers D1–D17 are this file's; the repo's own log is
`docs/DECISIONS.md` (Decisions 1–40), cited as "Dec. N"."* I initially checked those citations against
`SPEC.md` §0.2 and concluded most were dangling. **That was my error, and this section records the
correction rather than hiding it.** The citations are correct; they point at `docs/DECISIONS.md`, and
verified against the authoritative copy of that log (recovered from `client-qa/session3/
backend-phase-b.zip` — see §4) all seven land on exactly the right subject:

| plan.md cites | what plan.md means | that number in `docs/DECISIONS.md` (1–40) | verdict |
|---|---|---|---|
| "(repo Dec. 18)" | React/TS/Tailwind/Supabase + Capacitor; Android first, iOS later | **#18** — "Mobile is primary, not a companion — Android via Capacitor" | ✅ exact |
| "(Decision 13, which excluded iOS, is superseded)" | iOS was previously out of scope | **#13** — "iOS out of scope, Android is Phase 3" | ✅ exact |
| "(Dec. 27)" | credit terms are advise-only: warn, do not block | **#27** — "Per-customer credit terms, derived balance, **soft enforcement only**" | ✅ exact |
| "(Dec. 36)" | money on a truck load stays the promised amount until payment posts | **#36** — "Money stays at the promised amount; only stock follows the scale" | ✅ exact |
| "(Dec. 37)" | no sixth role | **#37** — "The procurement desk is additive, with no sixth role yet" | ✅ exact |
| "(Dec. 38, 40)" | functions closed by default; explicit grants only | **#40** — "Functions are closed by default; each one is opened on purpose" (with #38, audit-trail scope and read-only views) | ✅ exact |
| "(D24)" (§16) | keep the fish app apart from the IGNOU project | plan.md's **own** D24 — consistent with the protocol it declares | ✅ self-consistent |

So the defect is the mirror image of a dangling reference: **the log plan.md cites exists in a branch
that was never pushed, and the copy in this checkout is truncated at #17.** In this checkout,
`docs/DECISIONS.md` holds 17 entries and 24 KB; the canonical file holds 40 entries and 41 KB. Any
reader of plan.md working from this checkout sees references to decisions that appear not to exist.

### The collision this caused in my own work

The two storybook decisions recorded on 29 Sep went into `docs/DECISIONS.md` as **#18 and #19** —
because that file appeared to end at #17. In the canonical log, **#18 is "Mobile is primary…" and #19
is "Containers replace abstract batches…"**. My entries therefore collide with two existing mobile
decisions and would have created a duplicate-numbered log on the next merge. They must be **#41 and
#42** (the next free numbers in the canonical 40-entry log).

Similarly, §2 above proposes "D63/D64" for them in `SPEC.md` §0.2. That is also wrong:
`SPEC-AMENDMENT-v3-truckload.md` already claims **D63–D66**, so the storybook pair is **D67/D68**.

### Three numbering systems, not two

| Log | Sequence | Current extent | How to cite it |
|---|---|---|---|
| `SPEC.md` §0.2 | `D1 … D68` (proposed) | D1–D62 committed | `D<n>` — always this one unless stated |
| `docs/DECISIONS.md` | `#1 … #42` (proposed) | #1–#40 canonical (in the zip); #17 in this checkout | `docs/DECISIONS.md` #n |
| plan.md | `P-D1 … P-D24` | D1–D24 in-file | plan.md P-Dn |

The two repo sequences agree up to about #18/D18 and then **diverge by roughly six** — SPEC D33
("Credit terms…") is `docs/DECISIONS.md` #27, and SPEC D36–D40 (invite/phone mechanics) are
`docs/DECISIONS.md` #29–#33. Any sentence of the form "see Dec. N" that does not name its log is
therefore ambiguous, and this is the single most likely way for the next agent to attach a decision to
the wrong precedent.

---

## 4. `plan.md`'s state claims, checked against this checkout

Verified rather than assumed, because §3 showed how easy it is to misread a claim:

| plan.md claim | this checkout | verdict |
|---|---|---|
| "Migrations **0001–0036 are live**" | `supabase/migrations/` holds exactly `0001_init.sql` … `0036_fix_confirm_delivery_arrival_movement_group_id.sql` — 36 files | ✅ accurate |
| "Migrations **0037–0046 written, tested, not applied**" | they are **not** in the repo; they ship in `client-qa/session3/backend-phase-b.zip` (0037–0046 + `supabase/tests/` with 10 SQL test files + `run.sh`) | ✅ accurate, and the zip is the only copy here |
| "Branch `backend-phase-b`, commit `72b5291`, **not pushed**" | the repo has **no git remote at all**, so nothing is pushed; the branch does not exist in this checkout | ✅ consistent |
| "Details: `docs/BACKEND-PHASE-B-STATUS.md`" | **missing** from this checkout; present in the zip (22 KB) | ⚠️ reference does not resolve *here* |
| "`docs/API-REFERENCE.md`" | **missing**; present in the zip (13 KB) | ⚠️ same |
| "Migrations are idempotent… next new migration is **0047**" | consistent: 0036 is the highest present | ✅ |
| "Storybook — separate repo `Jayshankar-ui` on GitHub Pages: 32 chapters, 104 screens" | accurate as of this session (committed deploy repo, not yet pushed) | ✅ |
| "`CLAUDE.md` should say…" (§0.1) | no `CLAUDE.md`, no root `plan.md` | ➖ not acted on, and see §5 |

**The one stale document is ours, not plan.md's.** `docs/CONTRIBUTING.md` still describes the
migrations directory as "0001 init, 0002-0005 follow-ups" — 31 migrations out of date. That is the
line that made me initially doubt plan.md's backend status, and it will mislead the next reader the
same way.

**What the zip is, in one line:** the entire un-landed `backend-phase-b` workstream — migrations,
RLS, 10 SQL test files, and newer copies of `docs/DECISIONS.md` (40 entries), `docs/SCHEMA.md`
(47 KB against this checkout's 8.6 KB), `docs/SUPABASE-SETUP.md`, `docs/BACKEND-PHASE-B-STATUS.md`
and `docs/API-REFERENCE.md`. Landing it is a **separate decision with database consequences** — see
§5 — and is not part of this amendment.

---

## 5. Change ledger — what this version completes, supersedes, and leaves open

Deliberately brief, and in that order. Read it before §6: three of the ten decisions below exist only
because an earlier reading of this repo was wrong, and two things written elsewhere had to be
corrected as a result.

### 5.1 Completed and verified — nothing below re-litigates these

| Item | State | Evidence |
|---|---|---|
| `plan.md`'s seven "Dec. N" citations, checked against the canonical 40-entry log | **done — all seven resolve** | §3. `plan.md` was right; this checkout was stale |
| `plan.md`'s state claims, checked against this checkout | **done — 6 of 7 accurate, 1 unresolvable here** | §4 |
| This reconciliation, §1–§9 | **complete** | this file, with `SPEC.md` deliberately unedited |
| The Ant review deck's block renderer | **complete, rewritten 2026-10-02** | 24 of 24 block kinds, now drawn by the `mock/phone.tsx` + `mock/desktop.tsx` composition layers (the original `blocks-core/lists/viz` were deleted); `tsc --noEmit` exit 0 — decision 97 |
| Both decks drawing the *same* QR for the same container code | **done** | the FNV-1a generator is **copied** from `blocks.tsx`, not re-derived. If the decks disagreed about TC-0042, the side-by-side comparison would not be a comparison |
| The Phase B **docs** landed, as a merge | **done** | `docs/DECISIONS.md` → 42 entries, `docs/SCHEMA.md` replaced, `docs/BACKEND-PHASE-B-STATUS.md` + `docs/API-REFERENCE.md` added, `docs/SUPABASE-SETUP.md` extended. The **migrations did not land** — §7 item 5 |
| The `antd` dependency recorded in the documents that require it | **done** | `SPEC.md` §4.1 (package table + an exception to the forbidden list, which named MUI/Chakra/Mantine and would otherwise have contradicted the table), `docs/ARCHITECTURE.md` §Stack + "Two decks, one player", `docs/REVIEW-BUILD.md` §8, `docs/CONTRIBUTING.md`, `AGENTS.md` §0/§3, `TOOLING-AUDIT.md`. The **decision** stays open as D67 |

None of that is a decision. The deck exists so that **D67 can be answered by looking rather than by
argument** — the only reason a version that adds no features has a build in it at all.

### 5.2 Superseded, corrected, or withdrawn

| What | Now | Why |
|---|---|---|
| `docs/DECISIONS.md` **#18/#19** — my two 29-Sep storybook entries | **#41/#42** | canonical #18/#19 are already taken: "Mobile is primary…" and "Containers replace abstract batches…" |
| "**D63/D64**", proposed for those same two in the first draft of §2 | **D67/D68** | `SPEC-AMENDMENT-v3-truckload.md` claims D63–D66 |
| §3 of the **first** version of this file, which reported five citations as "dangling" | **withdrawn and replaced** | it checked `SPEC.md` §0.2 instead of the canonical log — the wrong log. §3 now records the correction rather than hiding it |
| `docs/DECISIONS.md` as *the* decision log — what `AGENTS.md` §5 and `docs/CONTRIBUTING.md` both tell an agent to extend | **superseded**: `SPEC.md` §0.2 is the TINS table; `docs/DECISIONS.md` is the narrative record | a decision recorded only in the ADR file is invisible to the kit's validator and reviewers. Those two files are not yet corrected — §7 item 6 |
| `plan.md` §0.1's "keep this file at the repo root; `CLAUDE.md` says read it first" | **superseded** by `plan.md`'s own precedence rule | §1. `plan.md` stays source material, not a second root plan |
| `docs/CONTRIBUTING.md`'s "0002-0005 follow-ups" | **superseded — 31 migrations stale** | §4. The one stale document in this disagreement is ours. Fixed in §7 item 6 |
| The zip's `docs/DECISIONS.md` read as the newer copy of the whole log | **not so — merged, not copied** | its 1–17 are a *genericised* revision: they lose the role union type, the `0003_grant_service_role.sql` filename and the validator notes, and its `SUPABASE-SETUP.md` loses `BUILDER-DECISIONS-REVIEW.md` for "the internal decision log". Ours won, except where the zip carried **supersede annotations ours lacked** — 9, 13, 15, adopted from it |
| The zip's index table as the basis for the merged index | **superseded — it stops at 33** | the canonical log holds 40 entries; the merged index is rebuilt 1–42 from the sections themselves |
| `docs/SCHEMA.md` as this checkout had it (241 lines, 9 tables, the 2026-08-14 export) | **replaced by the zip's** | the zip's own header is the one place it states precedence outright: "The earlier export of 2026-08-14 described 9 tables and is superseded by this file." Now 1102 lines, 38 tables / 8 views / 71 functions |
| `AGENTS.md` §0b's pointer to "decisions 18–19" | **41–42** | a reader following that pointer landed on the *mobile* decisions — the exact collision §3 describes, in a different file |

**Not superseded, deliberately.** Every one of `SPEC.md`'s **D1–D62 still stands**: this version adds
and never overrules. Where `plan.md` pushes past an existing row it *extends* it — P-D12's offline
write-queue extends D6 (the worker records a pick offline) to procurement lines; it does not replace
it. And `SPEC-AMENDMENT-v3`'s claim on **D63–D66 is honoured**, which is why this version starts at
D67 rather than at D63.

### 5.3 Waiting on somebody else — and none of it blocks this document

| Open item | Owner | What waiting costs |
|---|---|---|
| **D67** — Ant Design 6 or the shipped Tailwind look | **the client** — **unreachable on schedule as of 2026-09-29** | the closing as-built deck cannot be generated until he answers. Mitigation in place: deck 2 is now **built** (`npm run build:storybook-ant` → `dist-storybook-ant/`), so the question can be answered asynchronously from two links instead of waiting for a review slot |
| ~~Sign-off on the **D67–D76** numbering~~ | ~~repo owner~~ | **Done — approved 2026-09-29.** The merge is still withheld by choice (this version is listed, not merged); §8.2's paste is one command away whenever it is wanted |
| Landing the zip's **docs** (canonical `DECISIONS.md` 1–40, `SCHEMA.md`, `API-REFERENCE.md`, `BACKEND-PHASE-B-STATUS.md`) | repo owner | `docs/DECISIONS.md` stays truncated at #17 and the #41/#42 renumber slips |
| Applying **migrations 0037–0046** | repo owner, **staging first** | Phase B screens cannot be wired. `docs/DECISIONS.md` #39 already says tests run against a local PostgreSQL, never the live project |
| Merge order — **v3 before v4** | repo owner | swapping it renumbers both versions; see §8.1 |

---

## 6. The decisions this version adds — D67 … D76

Written in `SPEC.md` §0.2's exact row shape, so the merge in §8.2 is a paste. Three conventions:

- **Sources** are `plan.md`'s own `P-Dn` numbers, which are **its** sequence and never `SPEC.md`'s
  (§3). Where the canonical `docs/DECISIONS.md` already holds the prose, the row cites it and stays
  short instead of re-arguing the case.
- **Statuses** are `LOCKED`, as every row in §0.2 is today — **except D67, which is `OPEN`**. §0.2's
  status column has never held anything but `LOCKED` (all 63 of its rows), so `OPEN` is a genuinely
  new value; §8.3 records what that means for the merge.
- **Nothing here is built yet** unless the row says so. A `LOCKED` row describing unbuilt work is what
  §0.2 already contains — a commitment, not an as-built claim — and §7 item 3 puts those in the
  `HANDOVER.md` queue.

| ID | Decision | Status |
|---|---|---|
| **D67** | **The UI's look is the client's choice, and it is being made by looking at two decks rather than by argument — so this row ships as `OPEN`.** The same 32 chapters and the same chapter data render twice: deck 1 in the hand-rolled Tailwind system that shipped, deck 2 in Ant Design 6, so design language is the only variable. The Ant deck is a **separate build** (`dist-storybook-ant/`, its own entry and its own Vite config) and is **never routed inside the app** — `plan.md`'s own D2 forbids mixing the two systems on one screen, and one build that swaps only the block renderer satisfies that without a runtime flag. Ant Design is therefore a dependency of a review build, not a production one, until this row ends `LOCKED`. Source: `plan.md` P-D2. **Delayed, not blocked:** the client is unreachable on schedule as of 2026-09-29, so this is not a question waiting on a meeting — deck 2 is built and both decks can be sent as two links with one question. | **OPEN** |
| **D68** | **At the receiving step the person weighing the fish cannot see who it came from or what was paid, and that guarantee lives in what the database function can return — not in what the screen chooses to hide.** The receiving RPC's own `RETURNS` shape omits vendor identity and rate for a receiving caller, so a UI bug cannot leak it: the criterion is what the function *can* return, which is what `docs/DECISIONS.md` #34 ("Receiving never sees the vendor or the rate", enforced in the database, behind a switch) actually requires to be true rather than to appear true. It ships with **the switch off** — switch-off behaviour is exactly today's, which matters because at current volumes one person does both jobs. `SPEC-AMENDMENT-v3`'s D65 applies the same principle to truck-load receiving and the new `receiving-storage` role; this row applies it to the existing per-vendor flow, so together they cover both procurement modes. Source: `plan.md` P-D5; canonical `docs/DECISIONS.md` #34, #35. | LOCKED |
| **D69** | **Offline capture is a queued commitment, not a V1 feature — and it is the largest single field risk this app carries.** Today's offline support covers the worker's pick (D6); procurement lines are recorded online, so a vendor rep in a basement with no signal loses the entry instead of buffering it. The decided direction is a local write-queue for procurement lines that replays in order once connectivity returns, **extending D6's mechanism rather than inventing a second one** — same queue, a second screen. Not built, and deliberately not bundled into the Phase B wiring: a write-queue needs conflict rules (what happens when the same bill is edited on both sides), and those are decisions, not implementation. Source: `plan.md` P-D12; extends D6. | LOCKED |
| **D70** | **Approvals are per document, not per user or per phase.** A bill, a truck load or a reversal carries its own approval state, so a rejected line cannot be resubmitted as though it were new. **No approval mechanism exists in this repo today**, and no row in D1–D62 or in the canonical log covers it — this is a new concept, not a clarification. The nearest existing precedent, and therefore the shape to copy rather than invent, is `reversal_requests` (§4.2): its own table, its own status machine, a reviewer who is not the requester. Unbuilt; queued per §7 item 3. Source: `plan.md` P-D13. | LOCKED |
| **D71** | **The system enforces the workflow; where it deliberately cannot, it says so out loud rather than pretending to.** This is the principle D68 rests on (blind receiving is true in the RPC's return shape, not in the screen) and the same one behind canonical #40 (functions closed by default). It is also where `plan.md` meets an existing row head-on: D33 / canonical #27 make **credit terms warn-only on purpose**, because refusing a sale is a business call the wholesaler keeps for himself. Recorded resolution — enforcement is the default, and warn-only is an explicit exception argued case by case (credit terms being today's only one), never a silent fallback for something easier to implement as a warning. Source: `plan.md` P-D17; reconciled against D33 / canonical #27. | LOCKED |
| **D72** | **There is no sixth role: `users.role` stays five roles, and `plan.md`'s role names describe those five rather than extending them.** Canonical #37 settled this for the procurement desk ("additive, with no sixth role yet"), and `plan.md`'s vocabulary — procurement, receiving, admin, owner — is a description of the same five, not a new taxonomy. `SPEC-AMENDMENT-v3`'s D65 adds **one** role, `receiving-storage`, and that is a sanctioned exception because it was argued and confirmed with the client directly. This row records that D65 is the exception, not the start of a trend: any further role needs its own row and its own argument. Source: `plan.md` P-D19; canonical `docs/DECISIONS.md` #37. | LOCKED |
| **D73** | **Database functions are closed by default; each one is opened to a role on purpose, and every opening is a reviewable act.** Already this repo's rule (canonical #40) but absent from `SPEC.md` §0.2, and §0.2 is what the kit's validator and reviewers read — so it is recorded here as a decision, not left implicit in the migrations. It is also the mechanism that makes D68 enforceable rather than aspirational: a new function ships with **no grants**, a role gains access only through an explicit migration line, and "who can do this" is therefore answerable by reading `supabase/migrations/` instead of by probing the running app. Source: `plan.md` P-D21; canonical `docs/DECISIONS.md` #40. | LOCKED |
| **D74** | **Storybook chapters 21–32 are the visual specification for the procurement desk: the desk is built to match them, and a deviation found in review is a defect rather than a preference.** The value is that a client-reviewed artefact carries the force of spec — a reviewer points at a chapter instead of describing a screen. It is also why deck fidelity is a real requirement rather than a nicety: it is why the second review deck must draw the *same* QR for the same container code (§5.1), because a comparison deck whose codes or figures have drifted is no longer comparable. Chapters 1–20 document the app that already exists; 21–32 describe the additive procurement desk. Source: `plan.md` P-D22. | LOCKED |
| **D75** | **Money on a truck load stays at the promised amount until money actually moves: the weight may turn out different and stock follows the scale, but the amount owed does not silently follow the corrected weight.** Already canonical #36 ("Money stays at the promised amount; only stock follows the scale"), restated in §0.2 only because v3's truck model now leans on it: D64's weighted-average landed cost is a *derived cost* figure (computed on read, per D17), and this row is what keeps that figure from being mistaken for the amount owed. Two numbers describe the same load and they are allowed to differ. Source: `plan.md` P-D23; canonical `docs/DECISIONS.md` #36. | LOCKED |
| **D76** | **The fish app stays a standalone product; the IGNOU final-year project does not become its umbrella.** A graded academic submission and a client's production system have different owners, deadlines and obligations — one has to be defensible as coursework, the other maintainable by whoever holds the repo — so they may share ideas and even code, but the repository, the decision log and the deployment stay separate. The point of the row is ordering: an academic deadline must never be able to gate a client delivery, and a client change request must never rewrite coursework after it has been submitted. Source: `plan.md` P-D24. | LOCKED |

---

## 7. What else changes, concretely

Ordered so nothing depends on a later item. Items 1–4 are documentation and can be done now; item 5
touches the database and needs the owner's word; item 6 records the deck work alongside. §5.3 lists
what is waiting on somebody else, so none of these wait on this version being merged.

1. **`plan.md`'s home.** It stays where it is — `client-qa/session3/plan.md` — as **source material
   for client intent**, alongside the call transcripts it was built from. It is *not* copied to the
   repo root and no `CLAUDE.md` is created, because a second top-level plan is exactly the competing
   source of truth TINS avoids: `SPEC.md` is the source, and `HANDOVER.md` is the queue. Add it to
   `AGENTS.md`'s read-list (§1) with one line saying what it is and that P-D numbers are its own.
   — **Done:** `AGENTS.md` read-list row 7, which says both things.

2. **`SPEC.md` §0.2 gains the ten decisions written out in §6** — P-D2, P-D5, P-D12, P-D13, P-D17,
   P-D19, P-D21, P-D22, P-D23, P-D24. They are already in §0.2's exact row shape, so this item is a
   paste and nothing else; several of the ten cite an existing `docs/DECISIONS.md` entry (#27, #35,
   #36, #37, #40) instead of re-arguing prose that already exists in the canonical log.

3. **`HANDOVER.md` was 36 migrations and 62 decisions out of date** — §1 said "Nothing is built yet"
   and "17 locked decisions", §2 said "Supabase project NOT YET CREATED", and §5 stopped at W6
   (2026-08-07). **Done:** §1 and §2 corrected against what is actually true, and §5 gained **W7**
   (the Phase B docs — what landed and what deliberately did not), **W8** (the Ant review deck) and
   **W9** (this amendment's sign-off and merge). **Still to write:** the larger queue in `plan.md`
   §11's order — staging project → apply `0046` then `0037`–`0045` → wire the Phase B screens chapter
   by chapter → offline writes → Tamil UI → Play submission. W7–W9 are the part this session can
   attest to; the rest needs the owner's staging decision first.

4. **Two TINS artifacts are referenced but absent** — **still open, and it got worse, not better.**
   `REVIEWER-DECISIONS-REVIEW.md` is now named in **four** places: `AGENTS.md` §0a (the R3 Reviewer
   row) and §1, and `HANDOVER.md` §5's "Mode A review" note and §7 step 4. The kit ships the
   format (`tins-kit/templates/REVIEWER-DECISIONS-REVIEW.md`), so the fix is either to create the
   file from that template or to remove the four pointers — leaving them is how the next session
   concludes the file was deleted by accident. `docs/feedback.md`, named in plan.md §11/§15 as where
   client feedback lands, likewise does not exist.

5. **Landing `backend-phase-b.zip` — done for the docs, deliberately not for the migrations.**
   **Landed:** `docs/DECISIONS.md` (42 entries; the merge rule is in §5.2), `docs/SCHEMA.md`
   (replaced), `docs/BACKEND-PHASE-B-STATUS.md` and `docs/API-REFERENCE.md` (added),
   `docs/SUPABASE-SETUP.md` (extended, ours kept wherever the zip had genericised it).
   **Not landed:** migrations `0037`–`0046`, `supabase/tests/`, `supabase/rls-policies.sql`, and the
   zip's `NotificationBell.tsx`. Two reasons, and the second is the one that would have bitten:
   applying migrations is a production database change needing staging-first approval (`plan.md` §11
   steps 1–2), and dropping the files in would change **what the gate validates** — `scripts/
   validate.mjs` concatenates every `supabase/migrations/*.sql` into the schema it checks, so a
   half-landed Phase B would quietly move the validator's subject.

6. **Doc corrections that follow from the above** — **done, except the part that is §8.**
   `docs/CONTRIBUTING.md`: the migrations line (`0002–0036`, plus a note that `0037`–`0046` are not in
   this checkout), the setup step's "5 migration files (0001 → 0005)", and the decision-recording
   rule (D-row in `SPEC.md` §0.2 first; `docs/DECISIONS.md` takes the prose). `AGENTS.md`: read-list
   row 7, the stack line, §0b's deck paragraph, and rule 2's pointer to §4.1. `docs/DECISIONS.md`:
   the renumber to #41/#42 is done (§5.2). What still waits is `SPEC.md` §0.2 itself — that is §8.

---

## 8. The merge into `SPEC.md`, prepared and withheld

### 8.1 Order matters — v3 before this version

These ten rows are numbered **D67–D76** on the assumption that `SPEC-AMENDMENT-v3-truckload.md`
(**D63–D66**) merges **first**. If this one goes first it takes D63–D72, and v3's four rows become
D73–D76 — with every cross-reference inside both documents moving with them. v3 is the smaller, more
settled document; merge it first and this numbering holds.

### 8.2 The paste, and the version line for `SPEC.md`'s header

§7 item 2 is a paste of §6's ten rows into `SPEC.md` §0.2 after D62. No rewriting: they are already
in that table's shape. The header also needs a changelog line, the way v2's merge recorded itself:

```
> **v4 changelog (2026-09-29):** merges `SPEC-AMENDMENT-v4-plan-md.md` (D67–D76: the client's
> design-language choice, blind receiving in the existing vendor flow, offline writes, per-document
> approvals, enforcement-vs-warning, the role count, closed-by-default functions, the deck as the
> procurement desk's visual spec, money-vs-scale, and the IGNOU separation). Reconciled against
> `client-qa/session3/plan.md`, which stays source material rather than a repo artifact. The
> amendment records what it completes, supersedes and leaves open.
```

And the version ledger, so the file lists its own versions instead of leaving that to memory:

| Version | File | Range | State |
|---|---|---|---|
| v1 | `SPEC.md` as first written | D1–D17 | superseded by v2 |
| v2 | `docs/deprecated/SPEC-AMENDMENT-v2.md` → `SPEC.md` | D18–D27 | **merged** 2026-09-10 |
| v3 | `SPEC-AMENDMENT-v3-truckload.md` | D63–D66 | draft, fully answered |
| v4 | `SPEC-AMENDMENT-v4-plan-md.md` | D67–D76 | draft — this document |

That table is also the concrete answer to "list it as a new spec version": the version is listed
here, and lands in `SPEC.md`'s header only when the merge is approved.

### 8.3 What `OPEN` costs at merge time

`SPEC.md` §0.2's status column has held exactly one value since v1: `LOCKED`, all 63 rows. D67 would
be its first `OPEN`. Two honest options, and the choice belongs to whoever signs the merge:

- paste D67 as `OPEN` and add `OPEN` to §0.2's vocabulary in §0.2b, so the table can hold a question
  it is actually asking; or
- leave D67 out of the paste and record the client's answer later as a fresh `LOCKED` row — which
  keeps the column clean and loses the record that the question was asked and that a whole deck was
  built to ask it.

The first is better. The second is what happens by default if nobody decides.

### 8.4 `docs/DECISIONS.md` does not have to wait

The narrative log is already renumbered to #41/#42 (§7 item 6), so the merge does not depend on it.
If the client answers D67 before the merge, record it in **both** places: the row in `SPEC.md` §0.2
and the prose entry as `docs/DECISIONS.md` **#43**.

## 9. What this amendment does *not* do

- It does not merge itself into `SPEC.md`. **§8** is that merge, prepared and withheld, and it needs
  sign-off on the numbering first.
- It does not delete or rewrite `plan.md`. It is the best single description of the client's intent
  we have, and §3 shows its internal references are sound. It simply is not the source of truth.
- It does not touch migrations, RLS or the live database. The Phase B *docs* landed (§7 item 5); the
  migrations deliberately did not, and the live project is still at `0036`.
- It does not resolve P-D2 / D67 (Ant Design vs Tailwind). That is the client's call, and the second
  review deck exists precisely so he can make it by looking.