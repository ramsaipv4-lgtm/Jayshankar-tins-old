# delegation/LEDGER.md — the task-splitting ledger for this round

> Single source of truth for one round of parallel work. Written by the
> auditor; read by `check-task-independence.mjs` and `orchestrate.mjs`.

> **Round started:** 2026-08-26
> **Execution mode for this round:** auditor-local
>
> Chosen by `tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md` (D35). The user
> asked for the auditor + worker workflow inside this harness. Workers are
> spawned natively by the harness rather than through `orchestrate.mjs`'s
> `workerCmd`, which is the contract's "native spawning" path —
> `orchestrate.mjs` is still used for planning (`--dry-run`) and state
> (`--status`).

---

## Tasks

| Task | Mode | Status | Assignee | Depends | Touched files |
|---|---|---|---|---|---|
| T1 | auditor-local | integrated | worker | — | `src/store.js` |
| T2 | auditor-local | integrated | worker | T1 | `src/ui.js` |
| T3 | auditor-local | integrated | worker | — | `index.html`; `src/styles.css` |
| T4 | auditor-local | blocked-escalation | worker | T1 | `tests/store.test.mjs` |

**Column notes:**
- **Depends** — a dependency is not the same as a file overlap. T2 and T4 are
  file-disjoint from T1 and from each other, so the independence check passes,
  but both consume `store.js`'s exports and cannot be verified before T1
  exists. Ordering is the auditor's judgement; the script only sees files.
- **Touched files** — exhaustive. `src/store.js`, `src/ui.js`,
  `src/styles.css`, `index.html` and `tests/store.test.mjs` are each claimed
  by exactly one task. That is what makes concurrent work safe here.

**Why this split.** §4.1 of the spec forces it: `store.js` may not touch the
DOM and `ui.js` may not hold state, so the two can be written against the §4.2
interface contract without either seeing the other. The shell and styling
touch neither. The tests touch only the store's public API.

---

## Independence check log

- 2026-08-26: clean — no file claimed by two tasks.

---

## Notes

Wave plan at `maxParallel: 2` — wave 1 dispatches T1 and T3 (both dependency
free), wave 2 dispatches T2 and T4 once T1 is integrated.

---

## Round outcome (2026-08-26)

| Task | Final status | Why |
|---|---|---|
| T1 | integrated | Verified independently by the auditor; 7 auditor checks + the worker's own 31 |
| T2 | integrated | Verified in real Chromium on the integrated app; 16/16 auditor end-to-end checks |
| T3 | integrated | Contract hooks confirmed present; 320px and focus-ring criteria verified |
| T4 | **blocked-escalation** | The file is written and its 38 tests pass, but §8.10 names a gate command that cannot exit 0 on Node 22. Amending the spec is always T2, so this stays parked until the user answers. |

`orchestrate.mjs --status` therefore exits **3 (parked)** — not 0 and not 1.
The run is owed an answer, and that is a different state from both success and
failure.
