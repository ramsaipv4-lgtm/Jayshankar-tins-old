# Prompt: KITTING-REVIEW (triage a kit-growth-candidates.md report)

> **What this is:** the prompt a fresh LLM session runs to triage a
> `kit-growth-candidates.md` report produced by `scripts/kit-extract.mjs`. The
> session reads the report, decides accept/reject/defer for each candidate,
> and (for accepted ones) runs `prompts/KITTING.md` + `scripts/kit-new-pattern.mjs`
> to land the new pattern in the kit.
>
> **Source:** the kit's own evergrowing-project loop (D17). The pattern is at
> `lib/patterns/kit-self-application.md`. Run this prompt after a consumer
> finishes Mode A and you want to mine its BUILDER-DECISIONS-REVIEW.md for
> new kit patterns.

---

## The prompt

```
You are the "kit growth" reviewer. A consumer project has just finished Mode A,
and `scripts/kit-extract.mjs` has produced a `kit-growth-candidates.md` report
listing the decisions that *might* be kit-worthy patterns. Your job is to
triage that report and land the keepers in the kit.

The report is at <PATH_TO_KIT_GROWTH_CANDIDATES_MD>. Read it now. (If the file
doesn't exist, run `node tins-kit/scripts/kit-extract.mjs
--consumer=<consumer-path>` to generate it.)

---

## The 3-question rubric for each candidate

For each candidate C1, C2, …, ask:

1. **Would a different TINS consumer benefit from this?**
   - If the decision is project-specific (e.g. "we chose Postgres over MySQL
     because our team knew it"), reject.
   - If the decision is general (e.g. "every multi-tenant consumer needs
     `withTenantTx` + RLS, here's the recipe"), accept.
   - If you're unsure, defer — it's better to miss a candidate than to
     pollute the kit with project-specific noise.

2. **Does it have a worked example from a real consumer?**
   - The candidate should reference actual code, SQL, a file path, or a
     concrete before/after. If it's pure theory with no example, defer.
   - "We adopted two-Prisma-clients because atal-incubation does it" is a
     weak example. "We adopted two-Prisma-clients; the consumer's
     `src/lib/prisma.ts` has this exact 254-line implementation; here are
     the 3 lessons" is a strong example.

3. **Does it duplicate an existing kit pattern?**
   - Compare the candidate's title to the kit's `lib/patterns/`. If it's
     a near-duplicate (e.g. "the two-Prisma-clients pattern" vs. an
     existing `two-prisma-clients.md`), reject with a note: "already in
     kit as `lib/patterns/two-prisma-clients.md`."

---

## The triage

For each candidate, fill in:

```md
### C<N> — <candidate title>
- Decision: [accept | reject | defer]
- Reason: <1-2 sentences>
- If accept: <the kit pattern name, kebab-case>
- If defer: <the trigger that would unblock the accept (e.g. "when a 2nd
  consumer has the same decision")>
```

Write the triage to `kit-growth-triage.md` at the consumer's root.

---

## For accepted candidates

For each accepted candidate:

1. Open `prompts/KITTING.md` in a new tab.
2. Run the 9-step KITTING workflow:
   - Step 1: `node scripts/kit-new-pattern.mjs <name>` — scaffolds the file
   - Step 2-3: Fill in the §0 / §1 / §2 / §3 sections based on the
     candidate's body
   - Step 4: Add a validator check to `scripts/validate.mjs`
   - Step 5: Add a self-test case to `scripts/selftest.mjs`
   - Step 6: Update `SPEC.md` (D, §0.4, §2, §4.1, §8.X)
   - Step 7: Update `HANDOVER.md` (mark the W done, state snapshot)
   - Step 8: Add a D<n> entry to `BUILDER-DECISIONS-REVIEW.md`
   - Step 9: Run the gate

3. After all accepted candidates are landed, the kit has grown by N
   patterns. The next consumer that adopts the kit will see the new
   patterns in `node scripts/kit-coverage.mjs --spec=<their-spec.md>`.

---

## When to reject

Reject if:
- The decision is project-specific (won't generalize)
- The decision is a one-off implementation detail (e.g. "we named the
  table `users` not `accounts`")
- The decision contradicts an existing kit pattern (resolve the
  contradiction at the kit level, not the consumer level)
- The decision is already in the kit under a different name

## When to defer

Defer if:
- Only 1 consumer has the decision so far (the pattern might be a
  coincidence; wait for a 2nd)
- The decision is too vague to crystallise (need a worked example first)
- The decision is a forward-looking idea (e.g. "we should add X next
  quarter") rather than a crystallised lesson

## When to accept

Accept if:
- 2+ consumers have the same decision (the gap analysis already records
  these as G<N>)
- The decision has a worked example (real code, SQL, or before/after)
- The decision generalises to a different stack (not just "every
  Next.js + Prisma + Postgres app needs this")
- The decision fills a hole in the kit's existing pattern coverage

---

## Constraints

- **Never edit generated code to fix a defect.** If a candidate's worked
  example is wrong, reject the candidate and ask the consumer to fix it
  first.
- **The kit is itself versioned (D16).** A new pattern is a kit change;
  it goes through the kit's own HANDOVER + BUILDER-DECISIONS-REVIEW.
- **The kit is evergrowing (D17), not exhaustive.** Better to defer 3
  good candidates than to accept 1 mediocre one.

---

## Output

After the triage, the consumer's root has:
- `kit-growth-candidates.md` (the auto-extracted report)
- `kit-growth-triage.md` (your accept/reject/defer decisions)

The kit's root has:
- N new `lib/patterns/<name>.md` files (the accepted ones)
- Updated `SPEC.md` (D, §0.4, §2, §4.1, §8.X)
- Updated `HANDOVER.md` (Last updated, state snapshot)
- Updated `BUILDER-DECISIONS-REVIEW.md` (D<n> for each accepted pattern)
- Updated `scripts/validate.mjs` (the new §8.X check)
- Updated `scripts/selftest.mjs` (the new test case)

The CI gate (`.github/workflows/validate.yml`) runs on the next push and
confirms the kit is still green.
```

---

*— End of `KITTING-REVIEW.md` prompt. See also: `prompts/KITTING.md` (the
per-pattern workflow), `scripts/kit-extract.mjs` (the auto-extractor),
`lib/patterns/kit-self-application.md` (the canonical pattern for the
loop).*
