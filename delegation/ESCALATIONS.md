# delegation/ESCALATIONS.md — the question queue for this round

> Bootstrapped 2026-09-10 from `tins-kit/templates/ESCALATIONS.md`. Same
> rules as the kit template — see that file / `tins-kit/lib/patterns/
> tiered-escalation.md` for the full tier definitions.
>
> In this project's manual-relay setup, an escalation can come from either
> side: MiniMax M3 (via the user relaying its output back) or Claude, if the
> auditor's own review surfaces a T2 while checking returned work.
>
> **T2 escalations park their own task. They do not halt other work.** When
> you (the user) answer one, write the answer into its `Answer:` field, set
> its `Status:` to `ANSWERED`, set that task back to `in-progress` in
> `LEDGER.md`, and hand the answer back to whichever side needs it (MiniMax,
> via the relay, or Claude, directly).
>
> **Run started:** 2026-09-10

---

## T2 escalations (open questions — the run is parked on these)

<None yet.>

---

## T1 decisions (digest — no action needed)

<Judgement calls made inside locked scope, by either Claude or MiniMax:
naming, file layout, a choice among genuinely equivalent options. Skim this
after each round.

If this section is empty across a whole round, be suspicious: something was
probably being resolved downward that should have been escalated.>

---

## Answered (closed)

<Move entries here once the answer has been applied and the task is
unblocked. Keep the answer text — the next session inherits the reasoning.>
