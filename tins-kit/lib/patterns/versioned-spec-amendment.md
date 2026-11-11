# `versioned-spec-amendment` — kit pattern

> **A spec amendment is a separate file with the same section numbering and a clear
> merge path back to `SPEC.md`.** The pattern is the merge-ready convention: a
> contributor writes `SPEC-AMENDMENT-v2.md` instead of editing `SPEC.md` directly,
> and the spec author reviews and merges it in one sitting.
>
> **Source:** `Jayshankar/SPEC-AMENDMENT-v2.md` (the merge-ready amendment, §0.2
> decision D12 addendum + 3 new section additions, marked "merge into SPEC.md v1
> §0.2 / §3 / §7 / §8"), `atal-incubation/specs/SPEC-v3.md` (which supersedes
  `specs/AICL_updated.md` per the §0.0 "Predecessor documents" list), `exam-forge/SPEC-v2.md`
  (archived next to `SPEC-v1.md`).

---

## 0. Why this exists

A spec is a **single source of truth**, but in practice a spec is also a **collaboration
artifact** — multiple contributors need to propose changes, reviewers need to see the
delta, and the spec author needs to merge the approved changes. Three approaches recur:

1. **Edit `SPEC.md` directly.** Two contributors edit the same section, the second
   one's PR clobbers the first one's, and the spec author spends an hour resolving
   merge conflicts.
2. **Long-lived branches.** One contributor's "v2" branch lives for 6 weeks,
   drifts from main, and the spec author avoids the merge until the divergence is
   unmanageable.
3. **Merge-ready amendment file.** The contributor writes a separate
   `SPEC-AMENDMENT-v2.md` with the same section numbering, the spec author reviews
   in one sitting, and the merge is a copy-paste.

The third approach is the pattern. It is **disciplined, reviewable, and mergeable in
minutes, not weeks**.

---

## 1. The 3 lessons, in detail

### Lesson 1 — Same section numbering, marked "merge into <target>"

```md
# SPEC-AMENDMENT-v2.md — proposed additions to SPEC.md v1

> **Merge target:** `SPEC.md` v1, sections §0.2, §3, §7, §8.
> **Author:** <name> · **Date:** 2026-08-15 · **Status:** 🟡 PROPOSED

## §0.2 — Add new decision D12

| # | Decision | Choice | Why |
|---|---|---|---|
| D12 | Money type for all monetary fields | `Decimal(18,4)` in Postgres, `string` in Zod, `Prisma.Decimal` in app | Float → Decimal prevents rounding in grant tranche release calculations. See `lib/patterns/money-as-decimal` (G29). |

## §3 — Add new section "3.4 FIFO cascade"

<full text of the new section, 50–200 lines>

## §7 — Add new section "7.5 Idempotent migration runner"

<full text>

## §8 — Add new acceptance criterion

§8.7: "Every migration file uses `CREATE TABLE IF NOT EXISTS` (or `CREATE OR REPLACE`
for functions/triggers). `pnpm migrate` is re-runnable. Verified by
`scripts/migration-runner.mjs --check`."

## Merge instructions (for the spec author)

1. Open `SPEC.md` v1 in the same window.
2. Copy §0.2 D12 into the §0.2 table.
3. Copy §3.4 into §3 (renumber if needed).
4. Copy §7.5 into §7.
5. Copy §8.7 into §8.
6. Update the §0.0 "Predecessor documents" footer to read "Supersedes
   `SPEC.md` v1 (now in archive/). Amendment v2 merged 2026-MM-DD."
7. Archive `SPEC.md` v1 as `archive/SPEC-v1.md`.
8. Mark this amendment file as `✅ MERGED 2026-MM-DD` and move to `archive/`.
```

The **same section numbering** is the magic: the spec author can open both files
side-by-side, find the target section in the main spec by number, and paste. No
"context-switching to find where this goes." The "merge instructions" section at
the bottom is the spec author's checklist.

### Lesson 2 — The amendment is a PR, not a branch

A merge-ready amendment is a **single file, proposed in a single PR, reviewed in a
single sitting**. The PR description links to the amendment file and says "merge
target §0.2 / §3 / §7 / §8." The spec author reviews, requests changes (e.g.
"tighten the §3.4 example"), the contributor updates the amendment, and the spec
author approves.

The amendment file is **never** a long-lived branch. The contributor's branch lives
for at most 1 week. If the spec author doesn't respond in 1 week, the contributor
either follows up or withdraws the amendment. The discipline prevents
"SPEC-AMENDMENT-v2 is 6 months old and 200 lines behind" drift.

### Lesson 3 — Amendments are **append-only to the spec history**

Even after an amendment is merged, the original `SPEC-AMENDMENT-v2.md` file stays
in the repo (in `archive/`), with a `✅ MERGED 2026-MM-DD` header. The spec history
is auditable: a future contributor can read `archive/SPEC-AMENDMENT-v2.md` and see
exactly what changed and why.

The "predecessor documents" footer in the main spec lists every amendment that was
merged:

```md
## §0.0 Predecessor documents
- `archive/SPEC-v1.md` (initial spec, 2026-01-15)
- `archive/SPEC-AMENDMENT-v1.md` (3 additions, merged 2026-02-10)
- `archive/SPEC-AMENDMENT-v2.md` (5 additions, merged 2026-08-15)
- `archive/SPEC-AMENDMENT-v3.md` (2 additions, merged 2027-01-20)
```

This is the **audit trail** for "why is the spec this shape?" A new contributor
reads the main spec, then reads the amendment history to see *how* it got this shape.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — Editing `SPEC.md` directly in a feature branch

```bash
# ❌ WRONG — two contributors edit the same section
git checkout -b feature-fifo-cascade
# edit SPEC.md §3.4
git commit -m "Add FIFO cascade spec"
# second contributor also edits §3.4
git checkout -b feature-fifo-cascade-2
# edit SPEC.md §3.4 differently
```

The merge conflict is inevitable, and the spec author has to resolve a 50-line
conflict in a markdown file by hand. The merge-ready amendment prevents this: both
contributors write separate `SPEC-AMENDMENT-vN.md` files, and the spec author
cherry-picks the best version.

### Anti-pattern 2 — "Living document" SPEC.md that drifts

A spec that anyone can edit at any time becomes a "living document" — full of
contradictions, half-finished sections, and unmerged branches. The pattern is
**frozen at v1, amended via merge-ready files**. The main `SPEC.md` is only edited
by the spec author during a merge. Everyone else proposes via amendments.

### Anti-pattern 3 — Amendment as a "discussion doc"

Some teams treat `SPEC-AMENDMENT-v2.md` as a discussion document, with multiple
"Status: DRAFTING / REVIEWING / REJECTED / MERGED" sections. The pattern is
**one amendment, one status**. If the amendment is rejected, the file is moved
to `archive/SPEC-AMENDMENT-vN-rejected.md` and the main spec is unchanged. A
new amendment (vN+1) is filed if the idea is later approved.

---

## 3. When this pattern changes

- **When the consumer moves to a multi-track spec** (e.g. one spec per module
  area, like `specs/SPEC-modules.md` and `specs/SPEC-platform.md`): each track has
  its own amendment file (`SPEC-AMENDMENT-modules-v2.md`,
  `SPEC-AMENDMENT-platform-v2.md`). The merge instructions specify which track.
- **When the consumer adopts a formal spec tool** (Stoplight, ReadMe, OpenAPI
  spec editors): the amendment pattern is replaced by the tool's branching /
  review workflow. The "merge instructions" section becomes a PR against the
  tool's hosted spec.
- **When the consumer ships a public API**: the spec is **both** an internal SPEC.md
  (for the team) and a public OpenAPI / AsyncAPI file (for consumers). Amendments to
  the internal spec that change the API contract must include a corresponding
  change to the public spec file in the same PR.

---

*— End of `versioned-spec-amendment` pattern. See also: `templates/SPEC.md` (the
canonical §0.0 "Predecessor documents" footer), `prompts/SPEC-AUTHOR.md` (the merge
workflow that consumes amendments), `prompts/SPEC-REVIEWER.md` (the reviewer workflow
that approves them).*
