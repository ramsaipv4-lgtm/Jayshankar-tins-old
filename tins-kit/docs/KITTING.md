# KITTING.md — How to add a new pattern to the kit

> **The kit is evergrowing.** Every consumer project that crystallises a new
> pattern can contribute it back. This doc is the human-facing workflow.
> The machine-facing version is `prompts/KITTING.md` (the prompt a fresh LLM
> session runs).
>
> **The 3-question test before you start:**
>
> 1. Does this pattern appear in **2+ reference projects**?
> 2. Is it **reusable** (a different project can copy the recipe)?
> 3. Does it have a **worked example** (real code from a real consumer)?
>
> If any answer is "no," add it to `docs/GAP-ANALYSIS.md` as a "future" gap
> and revisit later. Don't pollute the kit with one-offs.

---

## The 9-step workflow

### Step 1 — Pick the right shape

- **Doc-only** (`lib/patterns/<name>.md`) if it's a "how to think about X."
- **Code module** (`lib/<name>/`) if it's a "give me the code."
- **Both** if it's large enough to warrant the architect's-eye view AND a
  code drop-in.

For doc-only, skip to step 4. For code modules, do steps 2–3 first.

---

### Step 2 — Code module: write the `index.ts` + `<impl>.ts` files

Follow `docs/LIBRARY-CONVENTIONS.md`. The shape is:

- `index.ts` — single default export, public API.
- `<impl>.ts` — the implementation (split if >300 lines).
- `README.md` — install + API + 3 rules + when-to-extend.
- `tests/<name>.test.ts` — at least 3 cases (happy / edge / error).

Run the tests as you go. A module that doesn't have passing tests doesn't
get added to the kit.

---

### Step 3 — Code module: write the README

The README is the consumer's entry point. It's the difference between "I
can use this" and "I don't know what this does." The shape (per
`LIBRARY-CONVENTIONS.md` §3):

1. One-line description.
2. 60-second orientation.
3. Install.
4. API (one subsection per public function).
5. The 3 rules.
6. When to extend.
7. Tests pointer.

---

### Step 4 — Doc-only: write the pattern file

Use `scripts/kit-new-pattern.mjs <name>` to scaffold the file. The
template has the required structure:

- `## 0. Why this exists` (2–4 paragraphs)
- `## 1. The 3 lessons, in detail` (with code blocks)
- `## 2. The 3 known anti-patterns` (with wrong/right code blocks)
- `## 3. When this pattern changes` (3 triggers)

**DO NOT deviate from the structure.** The validator parses for these
section headings. A pattern with §1.1 / §1.2 / §1.3 instead of "3 lessons"
fails the gate.

Fill in the content based on the reference projects. The 3 lessons should
be the 3 most-important things someone needs to know to use the pattern.
The 3 anti-patterns should be the 3 most-common mistakes.

---

### Step 5 — Add the validator check

Open `scripts/validate.mjs`. Add a check to §8.2 (kit inventory) that:

1. The pattern / module file exists.
2. The structure is correct (for patterns: 4 required sections; for
   modules: 3 required files).
3. The pattern / module is referenced in `SPEC.md` §0.4 (the absorption
   table).

The check should fail with a clear error message ("Pattern <name> missing
section §2").

---

### Step 6 — Add the self-test case

Open `scripts/selftest.mjs`. Add a case that:

1. For doc-only patterns: confirms the file exists and has the 4 sections.
2. For code modules: imports the module, runs a happy-path + an error-case,
   asserts the outputs.

The case runs in `node scripts/selftest.mjs` and is part of the kit's
gate.

---

### Step 7 — Update `SPEC.md`

Open `tins-kit/SPEC.md` and add:

1. A new locked decision D<N+1> in §0.2 (the "kit ships <name>" row).
2. A row to the §0.4 absorption table: "Pattern <name> absorbed from
   <reference project>, <date>."
3. A mention in §2 (functionality) under the appropriate section.
4. A line in §4.1 (architecture) directory tree.
5. An §8.X acceptance criterion: "<name> is present, has the required
   structure, and is referenced by the validator + selftest."

---

### Step 8 — Update `HANDOVER.md` and `BUILDER-DECISIONS-REVIEW.md`

In `HANDOVER.md`:

1. Mark the W<n> task as ✅ done.
2. Update §3 state snapshot: "kit now has N+1 patterns / M+1 code modules."

In `BUILDER-DECISIONS-REVIEW.md`:

1. Add a D<N> entry documenting the "kit now ships <name> pattern" decision,
   with cross-references to the new files.

---

### Step 9 — Run the gate

```bash
cd tins-kit
node scripts/validate.mjs
node scripts/selftest.mjs
```

Both must pass. If either fails, fix and re-run. The gate is the kit's
self-test — it must always be green.

---

## Anti-patterns to avoid

### Anti-pattern 1 — "I'll add it later"

The temptation is to add the pattern to a future "kit 2.0" release. But
the kit is evergrowing — there is no "kit 2.0." Every pattern is added
incrementally, and the gate keeps the kit coherent. Add it now or add it
never.

### Anti-pattern 2 — Adding without a reference project

A pattern that's "a good idea" but not observed in any consumer is
speculation, not crystallised wisdom. Wait for it to appear in 2+
consumers, then add it. The first observation is a coincidence; the
second is a pattern.

### Anti-pattern 3 — Editing existing patterns without versioning

Once a pattern is in the kit, it doesn't get edited in place. New
decisions go to a new pattern, or the pattern gets a "v2" section that
documents the change. The history of "what the pattern used to be" is
the point of the evergrowing model.

---

## When the kit's gate fails

The most common failure modes:

| Symptom | Fix |
|---|---|
| "Pattern missing section §1" | Open the file, add `## 1. The 3 lessons, in detail` (with the 3 sub-headings). |
| "Module missing tests/<name>.test.ts" | Write the test file with at least 3 cases. |
| "Pattern not in SPEC.md §0.4" | Add a row to the absorption table. |
| "Self-test case fails" | The case expected output X, got Y. Either fix the module or fix the case. |
| "Validator: file exists but wrong format" | The file is present but the content doesn't match the schema. Re-read the template. |

---

*— End of `KITTING.md`. See also: `prompts/KITTING.md` (the machine-facing
version), `docs/LIBRARY-CONVENTIONS.md` (the code module rules), `docs/WORKFLOW.md`
(where kitting fits in the consumer workflow).*
