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
