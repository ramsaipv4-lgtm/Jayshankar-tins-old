# Run digest — Focus, autonomous build, 2026-08-26

The artefact the user reads when they come back. Written by the auditor at the
end of the run, per `AUTONOMOUS-BUILD.md` Step 8.

**Outcome: PARKED** — `orchestrate.mjs --status` exits **3**. Three of four
tasks are integrated and the app works; one is parked on a question only the
user can answer. Parked is not failure, and it is not success either.

---

## 1. What was built

| Task | File(s) | Result | How the auditor verified it |
|---|---|---|---|
| T1 | `src/store.js` | integrated | 7 independent auditor checks written without reading the worker's tests: §8.1–§8.5 plus §7's corrupt-state rows. Confirmed zero DOM references and all 9 §4.2 methods present |
| T3 | `index.html`, `src/styles.css` | integrated | All 8 contract hooks present with the exact ids; module + stylesheet wiring confirmed |
| T2 | `src/ui.js` | integrated | 16/16 auditor end-to-end checks in real Chromium **on the integrated app**, over `http://` |
| T4 | `tests/store.test.mjs` | **blocked-escalation** | The file is written and its 38 tests pass. The gate command §8.10 names does not |

The finished app: 7 files, zero dependencies, zero build step. `node --test`
runs 38 tests in 11 suites, all passing.

## 2. Every T1 decision (the batch review)

Workers made 30 T1 judgement calls between them. None needed the user live;
all are recorded with reasons in each task's `NOTES.md`. The ones with
consequences beyond their own file:

- **T1** made `isPersistent()` sticky-false, so §3 rule 2's "persistent notice"
  cannot flicker, while still retrying writes so a transient quota error does
  not become permanent data loss.
- **T1** normalised survivors of a corrupt load to the four `Todo` fields and
  left the corrupt stored value in place rather than erasing it — §3 rule 1
  forbids destroying data as a side effect of a read.
- **T2** resolved the §2.5-vs-§3-rule-1 tension by putting a confirm dialog on
  "Clear completed" and none on per-row delete, reasoning that rule 1's
  "reversible **or** confirmed" collapses to one branch because §9 rules out an
  undo stack and §4.1 forbids UI-held state. It weighed escalating and chose
  not to: nothing was blocked, and filing it would have been the
  status-update anti-pattern.
- **T3** keyed row styling on structure rather than inventing class names,
  avoiding an expansion of a live contract another worker was building against.

## 3. Open escalations — the run is parked on these

**Both are spec amendments. The auditor may not amend `SPEC.md` (D32), so both
are T2 by construction.**

### [T2] T4 — §8.10 names a gate command that cannot pass

§8.10 says `node --test tests/`. On Node v22.22.2 a positional argument to
`--test` is treated as a file/glob and a bare directory never expands, so the
command exits 1 before any test file loads. **No content of
`tests/store.test.mjs` can make it exit 0.**

The auditor reproduced this independently in an empty directory with a
three-line passing test. Confirmed.

- Recommended: amend §8.10 to `node --test "tests/**/*.test.mjs"`, which exits
  0 with 38/38. A bare `node --test` from the repo root also works.

### [T2] SPEC-1 — §1 promises something D1 makes impossible

§1 says the page works "opened directly from disk", but D1's ES modules are
CORS-blocked over `file://`. Found by T3 in real browser verification, not by
reading.

- Recommended: reword §1 to "served by any static host" and keep D1. The
  `file://` promise was never load-bearing; the alternatives each cost a locked
  decision to buy it back.

## 4. Failures and retries

None. No task was re-issued; `maxRetries` was never reached.

## 5. What this run revealed about the kit itself

Three findings, all from using it rather than reading it:

1. **A ledger with a second markdown table broke both readers.** The auditor
   appended a round-outcome summary and `orchestrate.mjs` parsed its rows as
   tasks, dying on "unrecognised status". `DELEGATION-LEDGER.md` explicitly
   invites extra sections, so this would hit any project that documented its
   own round. **Fixed** in both readers (first matching table only) and pinned
   with two regression tests.

2. **Escalations are assumed to be task-scoped.** `escalate.mjs` requires
   `--task`, but SPEC-1 belongs to the spec, not to any task. Filing it against
   a non-ledger id (`SPEC-1`) worked — the script warns and parks nothing —
   but that is graceful degradation, not a modelled case. A round-level
   escalation slot is a genuine gap.

3. **The tooling gate paid for itself on its first run.** The audit assumed no
   browser was available and that §8.8/§8.9 would need waiving. Checking proved
   Playwright and Chromium were both present. Had the gate been skipped, two
   acceptance criteria would have been "verified" by reading the CSS — which is
   exactly the improvisation D33 exists to prevent.

## 6. Resume

```bash
# Answer both escalations in delegation/ESCALATIONS.md, apply the SPEC.md
# amendments, then:
sed -i 's/| T4 | auditor-local | blocked-escalation /| T4 | auditor-local | ready /' delegation/LEDGER.md
node tins-kit/scripts/orchestrate.mjs --status
```
