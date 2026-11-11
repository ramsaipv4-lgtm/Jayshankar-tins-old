# delegation/LEDGER.md — the task-splitting ledger for this round

> **Audience:** you (the first author), across sessions. This is the
> single source of truth for one round of parallel work: what got split
> off, who's doing it, whether it's safe (file-disjoint), and where it
> stands. Author-side only — this file is never exported into a task
> packet. `node tins-kit/scripts/check-task-independence.mjs` reads the
> table below.
>
> **Round started:** <YYYY-MM-DD>
> **Execution mode for this round:** <solo | auditor-local | auditor-remote |
> self-parallel | external | hybrid> — set by
> `tins-kit/prompts/EXECUTION-MODE-INTERVIEW.md` (D35), which asks the user
> per round rather than guessing from how a W was phrased. Individual tasks
> may override via the Mode column; a `hybrid` round REQUIRES every task row
> to name a real executor.
>
> `scripts/orchestrate.mjs` reads this line literally and dispatches only
> `auditor-local` / `auditor-remote` / `hybrid` rounds. It refuses `solo`,
> `self-parallel` and `external` — the user said they would drive that work
> themselves, or it is destined for a scrubbed packet, and the runner must
> not quietly do it instead. Never write a mode the user did not choose in
> order to make a command run.

---

## Tasks

| Task | Mode | Status | Assignee | Depends | Touched files |
|---|---|---|---|---|---|
| T1-<slug> | auditor-local | proposed | <you / name / "unassigned"> | — | `path/one.ts`; `path/two.ts` |

**Column notes:**
- **Mode** — one of the closed set, per task:
  - `solo` — built in the current session, sequentially.
  - `auditor-local` — dispatched to a worker in this same harness (D32).
  - `auditor-remote` — dispatched to a worker on another LLM CLI the user
    owns (Claude Code / Codex / Gemini / …), via `workerCmd`.
  - `self-parallel` — the USER personally runs it in another session or on
    another platform. Full repo, full context, no packet. (This is D29's
    old `self`, and a legacy `self` is read as this.)
  - `external` — someone else directs it (hired human or their LLM session).
    Needs a scrubbed packet and `scan-task-packet.mjs`.
  The distinction between `auditor-remote` and `self-parallel` is **who
  orchestrates** — a session, or the person — not how many LLMs are used.
  `hybrid` is a round-level word only; it never names a task's executor.
- **Status** — human-in-the-loop rounds (`DELEGATE-WORK.md`, D29):
  `proposed` → `independence-checked` → `assigned` → `in-progress` →
  `returned` → `integrated`.
  Autonomous rounds (`AUTONOMOUS-BUILD.md`, D32) use the closed vocabulary
  `scripts/orchestrate.mjs` reads literally: `proposed` →
  `independence-checked` → `ready` → `running` → `returned` →
  `integrated`, with `blocked-escalation` (parked on an open T2) and
  `failed` (exhausted `maxRetries`) as the two exits. Never invent a status
  outside that set — the runner and any fresh auditor both match on the
  exact string.
- **Depends** — optional, autonomous rounds only. `;`-separated task ids
  that must reach `integrated` before this one becomes runnable. A
  dependency is NOT the same as a file overlap: two tasks can be
  file-disjoint (and so pass the independence check) and still need
  ordering, e.g. one defines the schema the other queries. `—` for none.
- **Touched files** — every file this task will create or modify,
  `;`-separated. An entry ending in `*` means "this path and anything
  under it" (e.g. `src/admin/*`). This column is what the independence
  check reads — keep it exhaustive and current, or the check is
  meaningless.

---

## Independence check log

<Append a line each time `check-task-independence.mjs` runs against this
file — the date, and clean / N conflict(s) found (and what changed to
fix it, if any).>

- <date>: <result>

---

## Notes

<Anything about this round worth remembering later: why tasks were split
this way, any merges the independence check forced, anything unusual
about an assignment.>
