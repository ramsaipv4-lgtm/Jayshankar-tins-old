# 👉 Kit experiment — resume here

**What this is:** a side-quest to make `tins-kit` multi-model, multi-harness and self-improving (so a new project reuses
past learnings instead of reinventing them). **It does not touch the Jayshankar app.** Nothing here is committed, and the
live `tins-kit/` is untouched. Everything lives in two gitignored/side places: `_external/` and `docs/kit-growth/`.

**Where it stands (2026-10-03):** the updated kit copy is green (validate PASS, selftest 185/185 from any directory), three
test builds ran with it, and the defects they found are fixed. **Two things were never tested:** any non-Claude harness, and
parallel worktrees merged by a reconciler.

> **Update 2026-10-03 — the kit now has its own git repository, and you are working in a fork.** The working copy is
> **`C:\Users\user\Desktop\tins-kit-fork`** (a clone of `_external/tins-kit-next`, which is kept as the untouched baseline). Start at its
> [`WORKPLAN.md`](../tins-kit-fork/WORKPLAN.md): two days, day 1 is fixes (scaffold `--type`, the patterns the builders had to invent,
> retrieval), day 2 is the validation only you can do (another harness; two worktrees + a reconciler) and promotion. The checklist below is the
> older, shorter version — `WORKPLAN.md` supersedes steps 3–5. This repo (the app and the three decks) and the kit no longer share anything
> but history of how they were built, so work on one cannot break the other.

## Do these, in order (≈1–2 hours total)

- [ ] **1. Validate in your other harness** → [`_external/tins-kit-next/NEXT-VALIDATION.md`](_external/tins-kit-next/NEXT-VALIDATION.md)
      Setup, a first prompt to paste, an injection canary and a secret canary. Write down pass / fail / surprise per row.
- [ ] **2. Read the one-page summary** → [`docs/kit-growth/rounds/ROUND2-FINDINGS.md`](docs/kit-growth/rounds/ROUND2-FINDINGS.md)
- [ ] **3. Decide the open design question:** the kit's scaffold ships web-app templates (`prisma/`, `typescript`, a web
      `AGENTS.md`) for *every* project type. Add a `--type cli|web|content` option? (Both code builders hit this.)
- [ ] **4. If step 1 looks good, promote the kit copy:**
      `diff -ru tins-kit _external/tins-kit-next` → review → copy over. The live kit has **no git history**, so back it up first
      (`cp -a tins-kit tins-kit.bak-2026-10`).
- [ ] **5. Then the two unrun tests** (these are what would really prove the design): one real round with **two git worktrees +
      a reconciler** using `scripts/session.mjs check`, ideally across WSL **and** native Windows; and one session driven by a
      different model/harness end to end.

## Safe to ignore until then
Nothing breaks if you never come back. The app, its migrations and both review decks don't depend on any of this.

## Where everything is
| What | Where |
|---|---|
| The updated kit (edit this, not the live one) | [`_external/tins-kit-next/`](_external/tins-kit-next/) — start at [`CORE.md`](_external/tins-kit-next/CORE.md) |
| Findings saved *inside* the kit | [`_external/tins-kit-next/docs/findings/2026-10-round1-round2/`](_external/tins-kit-next/docs/findings/2026-10-round1-round2/README.md) |
| What each work package changed (and what it didn't) | [`_external/tins-kit-next/docs/changes/`](_external/tins-kit-next/docs/changes/) |
| The three round-2 test builds | [`_external/round2/`](_external/round2/) — `focus-queue`, `expense-tracker`, `jayshankar-course` (each has a `FRICTION.md`) |
| The four design drafts (v2) + all round reports | [`docs/kit-growth/`](docs/kit-growth/) and [`docs/kit-growth/rounds/`](docs/kit-growth/rounds/) |
| The decision record | `BUILDER-DECISIONS-REVIEW.md` → **Decision 98** |

## Caveats worth remembering
- Every reviewer and builder was a **Claude subagent**; the strongest claims are "independently reported by 2–3 of them", not
  "proven in the wild".
- Retrieval improved (a reviewer's miss rate 41% → 23% on three specs) but is **not solved**: the kit has no pattern for integer
  money, atomic file writes, append-only domain ledgers, CSV import, seeded property tests — all rebuilt from scratch by the builders.
- Deliberately **not built** (no second consumer yet): dispositions, a reinvention-rate metric, map-then-reduce reconciling, embeddings.
- A usage limit interrupted the run once; everything was re-verified after resuming (see `docs/kit-growth/rounds/ROUND1B-STATUS.md`).
