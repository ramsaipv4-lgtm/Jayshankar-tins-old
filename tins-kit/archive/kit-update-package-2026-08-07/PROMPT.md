# Kit-update prompt — apply the Jayshankar W2–W6 lessons to tins-kit

> **You are a kit-author session. Your job: read this prompt, the
> accompanying files, and the Jayshankar source files in the evidence
> manifest, and apply the Jayshankar W2–W6 lessons to tins-kit so the
> next consumer benefits.**
>
> **Time budget:** 90 minutes. The pattern files are pre-written; your
> job is to verify them against the kit's tone, drop them into the kit,
> and log the kit-side decisions.

---

## 0. What this update is

Jayshankar (the first TINS consumer) shipped 6 work items (W1 → W6) in
~6 days. It crystallised 28 builder decisions, hit 5 column-mismatch
bugs, 2 RLS silent-deny bugs, and 1 race-condition bug. The hard-won
lessons are spread across `Jayshankar/BUILDER-DECISIONS-REVIEW.md`.

This update pulls the most reusable lessons into tins-kit as new
patterns in `tins-kit/lib/patterns/`, and adds a missing 4th lesson to
the existing `supabase-auth-trigger.md` pattern. It does NOT touch the
kit's SPEC.md, HANDOVER.md, or `scripts/` — those are the kit's own
infrastructure and only change when a kit-level decision is made.

The applied changes are already in this folder under
`applied-changes/`. Your job is to verify, copy into the kit, and
log the decisions in `tins-kit/BUILDER-DECISIONS-REVIEW.md`.

---

## 1. Files in this package

| File | What it is | What to do with it |
|---|---|---|
| `PROMPT.md` (this file) | The meta-instruction. You're reading it. | Follow the steps in §3. |
| `decisions-summary.md` | The 28 Jayshankar decisions, condensed to one paragraph each. | Read once for context. The full source is `Jayshankar/BUILDER-DECISIONS-REVIEW.md` if you need more. |
| `applied-changes/new-patterns/postgres-mutations.md` | The SECURITY DEFINER function pattern. | Copy to `tins-kit/lib/patterns/postgres-mutations.md`. |
| `applied-changes/new-patterns/client-side-aggregation.md` | The JS-first aggregation heuristic. | Copy to `tins-kit/lib/patterns/client-side-aggregation.md`. |
| `applied-changes/new-patterns/pwa-offline-graceful.md` | The 3-layer PWA offline pattern. | Copy to `tins-kit/lib/patterns/pwa-offline-graceful.md`. |
| `applied-changes/new-patterns/empty-states.md` | The 3-tier empty-state rubric. | Copy to `tins-kit/lib/patterns/empty-states.md`. |
| `applied-changes/existing-pattern-update-supabase-auth-trigger.md` | The 4th lesson for the existing Supabase Auth pattern. | Apply the §1.4, §2 intro, §3 header, and §3 check changes to `tins-kit/lib/patterns/supabase-auth-trigger.md`. See the file for the exact diff. |
| `applied-changes/new-kit-decisions.md` | 5 pre-written kit-side decision entries (decisions 4–8). | Copy into `tins-kit/BUILDER-DECISIONS-REVIEW.md` (after the existing 3). |
| `evidence-manifest.md` | The list of Jayshankar source files to read for context. | Read the listed files before verifying the patterns. They're in `Jayshankar/` in the same workspace. |

## 2. The 28 Jayshankar decisions, ranked by "kit-worthy"

Not all 28 are kit-worthy. The pattern-level lessons are the ones that
*any future TINS consumer* would benefit from, not the
Jayshankar-specific ones (e.g. "use `english_name` not `name`" is a
Jayshankar schema fix, not a kit pattern).

| Tier | What it is | Decisions | Pulled forward as |
|---|---|---|---|
| **A — Reusable across consumers** | Lessons that ANY TINS consumer will hit | 16, 19, 23, 24, 26, 27, 28 | 4 new patterns + 1 lesson update |
| **B — Jayshankar-specific** | Decisions about Jayshankar's schema / UI | 21, 22, 25, 14, 17, 18, 20, 8, 9, 10, 11, 12, 13, 15, 29 | Stay in `Jayshankar/BUILDER-DECISIONS-REVIEW.md` |
| **C — Methodology-level** | Already covered by the kit's own templates | 1–7 | Stay where they are |

The "kit-worthy" 7 decisions (16, 19, 23, 24, 26, 27, 28) became the
5 entries in `applied-changes/new-kit-decisions.md` (one entry can
cover multiple decisions; e.g. decision 16 alone is the Lesson 4 update;
decisions 26 + 27 together are the pwa-offline-graceful pattern;
decisions 23 + 19 together are the postgres-mutations pattern).

## 3. Step-by-step

### Step 1: read the context (10 min)

1. Read `decisions-summary.md` in this folder.
2. Read `evidence-manifest.md` and follow the cross-references for the
   patterns you're about to verify (1 file per pattern, listed in the
   manifest).
3. Skim `Jayshankar/BUILDER-DECISIONS-REVIEW.md` for the 7 kit-worthy
   decisions (§16, §19, §23, §24, §26, §27, §28).

### Step 2: copy the 4 new patterns (10 min)

For each of the 4 files in `applied-changes/new-patterns/`:

1. Open the source file. Open the existing `tins-kit/lib/patterns/supabase-auth-trigger.md`
   side-by-side for tone reference.
2. Verify the new pattern matches the kit's voice (concise, code-first,
   SQLSTATE-precise, validator-check pinned). Flag any line that feels
   off; we'll patch it before copy.
3. Copy the file to `tins-kit/lib/patterns/<name>.md`.
4. Confirm the file is referenced from the kit's HANDOVER §4 (the
   "patterns" inventory). If not, add a row.

### Step 3: apply the existing-pattern update (10 min)

1. Open `tins-kit/lib/patterns/supabase-auth-trigger.md`.
2. Open `applied-changes/existing-pattern-update-supabase-auth-trigger.md`.
3. Apply the 4 specific edits listed there (all string-replaceable):
   - §1 header: "3 lessons" → "4 lessons"
   - After §1.3 (Lesson 3), insert §1.4 (Lesson 4 — the `authenticated`
     GRANT)
   - §2 intro: "4 files" → "5 files"
   - §3 header: "3 lessons" → "4 lessons"
   - §3 validator: insert the `js-grant-authenticated` check after the
     existing `js-grant-service-role` check
4. Verify the section count: §1 has 4 lessons, §2 has 5 files, §3 has
   the new check.

### Step 4: log the 5 kit-side decisions (15 min)

1. Open `applied-changes/new-kit-decisions.md`. These are pre-written
   entries for `tins-kit/BUILDER-DECISIONS-REVIEW.md` (decisions 4–8).
2. Append them to `tins-kit/BUILDER-DECISIONS-REVIEW.md` after the
   existing decision 3. The format matches the existing 3.
3. Confirm the new total is 8 decisions. The `js-builder-decisions-non-empty`
   check (consumer-side) doesn't apply to the kit's own log, but the
   count should still grow by 5.

### Step 5: update kit HANDOVER + SPEC pointers (10 min)

1. `tins-kit/HANDOVER.md` — add the 4 new patterns to the §4 inventory.
2. `tins-kit/SPEC.md` — confirm `lib/patterns/` directory tree lists
   all 5 entries. Add a row to §0.4 (interview-reveals-reality) table
   for the 4 new patterns.
3. Optional: update the "Last updated" line at the top of HANDOVER to
   reflect this session.

### Step 6: validate (5 min)

1. Run the kit's validator: `cd tins-kit && node scripts/validate.mjs`.
   It should still be 10/10 (no new structural checks required; the
   new patterns are content, not structure).
2. Run the kit's selftest: `cd tins-kit && node --test scripts/selftest.mjs`.
   It should still be 15/15.
3. Optional: run `Jayshankar/scripts/validate.mjs` and `selftest.mjs`
   too — should be 72/72 + 9/9 (the kit update doesn't affect the
   consumer's gate).

### Step 7: package the update for the next session (5 min)

1. Run the kit's handover protocol: update `tins-kit/HANDOVER.md`'s
   "Last worked on by" line to reflect this session.
2. If you added a new pattern, add a row to the §0.4 table in
   `tins-kit/SPEC.md` with the source decision number.
3. Done. The next consumer that hits the same wall as Jayshankar will
   find the pattern pre-shipped.

---

## 4. Tone calibration (read this before editing)

The existing `tins-kit/lib/patterns/supabase-auth-trigger.md` is the
gold standard. Match it:

- **Headings:** Sentence case ("Why this exists", not "Why This Exists").
  Imperative in recipes ("Apply the migration"), declarative in lessons
  ("The FK is redundant").
- **Code blocks:** SQLSTATE-precise. Every error mention cites the
  Postgres error code (`SQLSTATE 23503`, `SQLSTATE 42501`).
- **Length:** Patterns are ~150-300 lines. Longer is OK if the worked
  example is long; shorter is suspicious (probably missing a recipe or
  a validator check).
- **Cross-references:** Every pattern ends with a §"Cross-references"
  section listing the consumer decisions that back it up (e.g. "This
  is the Jayshankar BUILDER-DECISIONS-REVIEW decision 23").
- **Validator checks:** Every pattern that pins a structural design has
  a "§3 The validator checks (pin the design)" section with a
  copy-pasteable check.

If the new patterns diverge from this, edit them before copying.

## 5. What this update is NOT

- **Not a kit-version bump.** The kit's "version" is its git history.
  No `package.json` change; the kit has no version field.
- **Not a SPEC amendment.** `tins-kit/SPEC.md` doesn't need to grow a
  new section; the patterns are content, not structure. Only §0.4
  (the interview-reveals-reality table) and the `lib/patterns/`
  directory tree need a new row.
- **Not a consumer-mandated change.** The patterns are *available* to
  consumers; consumers aren't required to use them. The validator
  checks for these patterns are also consumer-side; the kit's own
  validator only checks the kit's own structure.
- **Not exhaustive.** 7 kit-worthy decisions became 5 new entries.
  The other 21 are Jayshankar-specific or methodology-level. Don't
  try to pull forward decisions 1-15 or 17-22, 25, 29 — they don't
  generalise.

## 6. Cross-references

- `Jayshankar/BUILDER-DECISIONS-REVIEW.md` — the source of the 7
  kit-worthy decisions.
- `Jayshankar/SPEC.md` §0.2 — the locked Jayshankar decisions that
  back the patterns.
- `Jayshankar/AGENTS.md` §1 — the onboarding order (read HANDOVER
  first, then SPEC §0, then the W-specific SPEC sections).
- `tins-kit/SPEC.md` §0.2 — the kit's own locked decisions (D2
  "kit consumes its own methodology" is the reason this update
  happens at all).
- `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md` — the format
  spec for the kit-side decision entries you'll be appending.
