# delegation/ESCALATIONS.md — the question queue for this autonomous run

> **Audience:** you (the user), and any auditor session that picks this run
> up later. Written by `node tins-kit/scripts/escalate.mjs`, read by you.
>
> **T2 escalations park their own task and that task's dependents. They do
> not halt the run** — every independent task keeps building. When you
> answer one, write the answer into its `Answer:` field, set its `Status:`
> to `ANSWERED`, set that task back to `ready` in `LEDGER.md`, and re-run
> the orchestrator.
>
> Tier rules: `tins-kit/lib/patterns/tiered-escalation.md`.
>
> **Run started:** <YYYY-MM-DD>

---

## T2 escalations (open questions — the run is parked on these)

### [T2] T4 — SPEC §8.10 names `node --test tests/` as the gate, but on this project's runtime (Node v22.22.2) a positional argument to --test is treated as a file/glob and a bare directory path always fails to load — which command should §8.10 name instead?

- **Filed:** 2026-08-26 10:15
- **Status:** OPEN
- **Why this is T2:** Needs an amendment to SPEC.md, which is always T2 — and it is T4's own acceptance criterion, so it cannot be resolved by interpreting it. No possible content of tests/store.test.mjs makes the literal command exit 0: `node --test <dir>` fails identically in an empty scratch directory with a one-line passing CJS test, with MODULE_NOT_FOUND on the directory itself, before any test file is loaded.
- **Options:**
  - A: amend §8.10 to `node --test` run from the repo root (Node's default search finds tests/store.test.mjs; verified green — 38 tests, 0 fail; widens the gate to any future test file anywhere in the repo)
  - B: amend §8.10 to `node --test "tests/**/*.test.mjs"` (verified green — 38 tests, 0 fail; keeps the gate scoped to tests/ as §8.10 intends; the quoted glob is Node-expanded, the unquoted tests/*.test.mjs is shell-expanded, both pass)
  - C: keep §8.10's wording and add a package.json with a `test` script wrapping a working form (adds a file §4.1's architecture does not list and reads against D1's no-install, no-build grain, for no behavioural gain)
- **Recommendation:** B — it keeps the gate scoped to the directory §8.10 already means, needs no new file and no dependency (D1 intact), and is verified passing here. A is equally green and is the fallback if a shorter command is preferred. Note that T1's status.md attributed the same red gate to 'tests/ is empty'; that diagnosis was wrong — the directory argument is the cause, and the gate stays red now that the suite exists and passes.
- **Blocked:** T4
- **Answer:** _(the user writes the answer here, then sets Status to ANSWERED)_


### [T2] SPEC-1 — SPEC §1 promises the page works 'opened directly from disk', but D1's ES modules are CORS-blocked over file://. Which half changes?

- **Filed:** 2026-08-26 10:08
- **Status:** OPEN
- **Why this is T2:** Contradicts a locked decision (D1). The auditor may not amend SPEC.md — a needed amendment is always T2.
- **Options:**
  - A: reword §1 to 'served by any static host' and keep D1 as-is (zero cost, drops a promise nobody has depended on)
  - B: keep the file:// promise and amend D1 to allow a single non-module script build (breaks the zero-build-step rule)
  - C: keep both by inlining all JS into index.html (defeats the §4.1 split this whole demo rests on)
- **Recommendation:** A — the file:// promise was never load-bearing, and B and C both cost a locked decision to buy it back. Found by worker T3 in real browser verification, not by reading.
- **Blocked:** SPEC-1
- **Answer:** _(the user writes the answer here, then sets Status to ANSWERED)_


<Each entry is appended by escalate.mjs and carries all five required
fields: the question, why it is T2, the real options, the model's own
recommendation, and which tasks are blocked. If an entry is missing the
recommendation, it was filed wrong — the model had more context than you do
at that moment and owes you its opinion.>

---

## T1 decisions (digest — no action needed)

<Judgement calls made inside locked scope: naming, file layout, a choice
among genuinely equivalent options. Recorded so you can review them in one
batch instead of being asked live. Skim this after the run.

If this section is empty across a whole run, be suspicious: something was
probably being resolved downward that should have been escalated.>

---

## Answered (closed)

<Move entries here once the answer has been applied and the task is
unblocked. Keep the answer text — the next session inherits the reasoning,
and a decision you have to re-litigate is a decision you paid for twice.>
