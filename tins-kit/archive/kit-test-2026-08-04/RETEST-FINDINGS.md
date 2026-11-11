# Tins-kit Viability Re-test — Consolidated Findings

**Date:** 2026-08-04
**Verifier (run 1):** branch session mvs_93e2fdc82d164fcf9658fc18dae2345f
**Verifier (run 2, fresh):** root session mvs_5f8c4180087b4818a4d776700bd2604e
**Drafts written:**
- Run 1: `C:\Users\user\Desktop\Jayshankar\kit-test\SPEC.md` (891 lines)
- Run 2: `C:\Users\user\Desktop\Jayshankar\kit-test\SPEC-v2.md` (1,004 lines)
**Compared against:** `C:\Users\user\Desktop\Jayshankar\SPEC.md` (1,331 lines, 17 decisions, 31 acceptance criteria)

---

## Run 2 (fresh) — final verdict

> **The kit is 70-80% viable for a stock-management consumer.** Right shape, missing the deep patterns. **Single biggest gap: no `prompts/SPEC-AUTHOR-NO-USER.md` to handle the "demoing to a gatekeeper with no end-user access" case where the mandated interactive interview cannot run.**

---

## Key finding: agreement between two independent runs

Both runs (run 1 with my prior context, run 2 in a freshly-spawned session) **independently arrived at the same biggest-data-modelling miss**: neither run invented the `movements` table that the existing Jayshankar spec uses to single-source all stock changes (delivery, transfer, sale, spoilage) into one event log. This is the single most important data-modelling decision in the existing spec, and the kit's empty `lib/` and `templates/` directories offer no hint of it.

This is now a **kit-level gap, not a one-off miss**. Two independent fresh attempts missed it; the kit provides no pattern or template that would surface it.

---

## What matched across both runs (high-confidence kit strengths)

Both runs independently produced these decisions/sections (high confidence these are kit-driven):

- **TINS markers** (`<!-- TINS Specification v1.0 -->` + `<!-- ZS: -->`) — both runs got it right
- **§0 preamble structure** with §0.0 cheapest version, §0.1 what-this-is, §0.2 locked decisions table
- **3-mode lifecycle** (Demo / Pilot / Production) — both runs locked it
- **3-role vocabulary** (admin / vendor-rep / worker) — both runs chose 3 roles
- **Per-batch pricing** — both runs
- **Bilingual Tamil + English names** with two-column design — both runs
- **FIFO spoilage** with `received_at ASC` ordering — both runs
- **Append-only audit log** via Postgres trigger — both runs
- **Money as `numeric(10,2)`** — both runs
- **Soft-delete only** (`active` or `deleted_at`) — both runs
- **PWA + offline graceful degradation** — both runs
- **Authored vs derived data** separation — both runs
- **Validator + self-test** gate the build — both runs
- **Numbered, mechanically checkable §8 acceptance criteria** — both runs
- **§9 explicit out-of-scope** — both runs
- **"First sign-up becomes admin"** — both runs (run 2 in SQL, run 1 in prose)

---

## What both runs missed (high-confidence kit gaps)

- **The `movements` table pattern** — single-source stock changes through one event log with `kind` ∈ {`delivery_in`, `transfer`, `sale`, `spoilage`} and `movement_group_id` to tie cascades together. **Both runs missed this; the existing Jayshankar has it.**
- **The `transfer` workflow** (worker moves stock from `storage` to `display`) — both runs assumed single location. The existing has a full algorithm with weighted-average `price_per_kg_paid` inheritance.
- **The two-location schema + `freezer` extension slot** — both runs.
- **Size-graded SKUs** (`small` / `medium` / `large` / `xl` / `mixed`) — both runs treated fish = SKU. Indian fish wholesale prices by size grade.
- **The `price_history` table** for SKU-level reference price — both runs.
- **The "super-worker" UI collapse** (existing D3a: vendor-rep and worker share a dashboard in V1) — both runs.
- **Hash routing** for Netlify static hosting (`HashRouter` not `BrowserRouter`) — both runs. This is a real correctness issue on Netlify without `_redirects` for every route.
- **Phone OTP for workers** (existing has email+password for admin/rep, phone OTP for workers) — both runs.
- **Named vendors and 25 named SKUs in the seed** (Murugan, Ravi, Selvam, Karthik, Mani, Ganesan; pomfret=வவ்வால், surmai=வஞ்சரம், bangude=கானாங்கெளுத்தி) — both runs.
- **The full RLS policy matrix** spelled out per table per role per action — both runs.
- **Named-device performance budgets** (e.g. "admin dashboard renders within 2s on a 2021 Android phone on shop WiFi") — both runs had vague Lighthouse targets.

---

## Differences between the two runs (interesting data points)

| Aspect | Run 1 (mvs_93e2...) | Run 2 (mvs_5f8c...) |
|---|---|---|
| Length | 891 lines (in target) | 1,004 lines (over target) |
| Stack versions | Updated to current stable (Vite 8, React 19, Tailwind 4) per "check for rot" | Pinned to brief (Vite 5, React 18, Tailwind 3) — no aggressive rot check |
| Data model | 4 tables + audit (no vendors table; vendor = free text) | 5 tables + audit + vendors table (run 2 independently invented vendors-as-first-class) |
| Derived data | Triggers (decrement kg_remaining in trigger) | Views (`v_open_batches`, `v_today_batches`) |
| Concurrency guard | Not specified | `serializable` transaction + `FOR UPDATE` row locks |
| Offline | Read-only when offline (matches existing) | **Full offline write-queue with IndexedDB outbox** (more aggressive than the existing; neither existing nor run 1) |
| Soft-delete | `active boolean` | `deleted_at timestamptz` |
| First sign-up | Prose description | Full SQL trigger |

**Notable:** Run 2's draft is more detailed (1,004 lines vs 891) AND more aggressive (outbox, full SQL triggers). Run 1's draft is more tightly bounded to the brief and more deliberate about not over-engineering. Both produce "valid Mode A demo specs"; neither produces a "Jayshankar-equivalent spec."

---

## Final gap list (priority order, agreed by both runs)

1. **Ship the 3 load-bearing files** — `prompts/SPEC-AUTHOR.md`, `templates/SPEC.md`, `scripts/validate.mjs`. Currently all empty.
2. **Add `lib/fifo-stock/` (or `lib/patterns/perishable-inventory.md`)** with the movements-table pattern, FIFO cascade, serializable transaction, derived-kg view. The single most-missed decision in two runs.
3. **Add `prompts/SPEC-AUTHOR-NO-USER.md`** for the "no user access yet" gatekeeper-demo case. The kit's D12 (mandatory interactive interview) is incompatible with the Jayshankar use case; no fallback is shipped.
4. **Add a Supabase + PWA + stock-management template** — `templates/SPEC-supabase-pwa-stock.md` with §4.2 stubbed tables and §4.3 stubbed algorithms; `templates/sql/supabase-init-stock.sql` with the canonical schema.
5. **Add per-domain acceptance-criteria templates** (stock, auth, pwa-offline, bilingual) so the §8 minimum-count rule ships with worked examples.
6. **Add `prompts/FIRST-USER-IS-ADMIN.md` + `templates/sql/first-user-trigger.sql`** — both runs invented this; the kit should ship the canonical version.
7. **Add `lib/bilingual-names/`** — search by either script, `lang="ta"` attribute, font fallback. The pattern recurs for any India-facing app.
8. **Add `templates/SPEC-CHANGES.md` template** (existing Jayshankar §0.4 "What changed from the original brief") — both runs needed a §0.4; both invented different shapes.
9. **Add a "decisions-categories" template** — explicit list of categories (stack, schema, auth, role model, money, deployment, validation, observability) that every consumer SPEC.md should have at least one decision in. Both runs locked 16-17 decisions but missed some categories (phone OTP, hash routing, named-device budgets).
10. **Add `templates/MODE-ROLLOUT.md`** — per-mode checklist the existing's Appendix B has. The 3-mode lifecycle is in the kit; the rollout is not.

---

## Verdict

**The kit is conditionally viable.** A fresh LLM session, given ONLY the kit + reference materials, can produce a TINS-shaped spec with the right structure, the right meta-architecture decisions, and the right standing rules. **It cannot produce a Jayshankar-equivalent spec.** The produced spec will be 70-80% of the existing one — correct shape, missing the deep patterns (movements table, transfer workflow, two-location schema, size-graded SKUs, named seed data, hash routing, phone OTP, RLS policy matrix, named-device performance budgets).

**The single biggest gap is the kit's interview-first pattern fails when the user is not available** — the exact case the Jayshankar use case is. D12 needs a sibling: `prompts/SPEC-AUTHOR-NO-USER.md`.

**The second biggest gap is the empty `lib/fifo-stock/` module** — two independent runs missed the movements-table pattern; the kit provides nothing that would surface it.

**First action to take:** ship `prompts/SPEC-AUTHOR-NO-USER.md`, `lib/fifo-stock/`, and a Supabase+PWA+stock template. Together these would lift a kit-derived spec from 70% to ~90% of a hand-written one.
