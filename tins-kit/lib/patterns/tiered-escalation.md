# Pattern: tiered escalation — which decisions an LLM may make alone

> **Doc-only recipe (D18).** The architect's-eye view of the rule that makes an
> unattended build safe: not "the LLM decides everything" and not "the LLM asks
> about everything", but a three-tier split with an explicit default for
> uncertainty.
>
> **Source:** D32 (session 16). Implemented by `prompts/AUTONOMOUS-BUILD.md`,
> `prompts/WORKER-SESSION.md`, `scripts/escalate.mjs`, and
> `scripts/orchestrate.mjs`.

---

## 0. Why this exists

An autonomous build has exactly two failure modes, and they pull in opposite
directions.

Ask about everything, and autonomy is theatre. The user is answering a question
every four minutes about variable naming and file placement, the run is slower
than doing it by hand, and — worse — the questions that actually matter get
buried in the noise. By question forty the user is answering on autopilot, which
means the one question that needed real thought got a reflex.

Ask about nothing, and the run compounds a wrong call for six hours. This is the
more expensive failure, and it is the quieter one. A model that picks a schema
shape at 11pm because the spec did not quite settle it does not stop; it builds
nine tasks on top of that shape. The user wakes up to a coherent, well-tested,
thoroughly wrong project. Nothing in the transcript looks like a mistake, because
at each individual step nothing was.

The tiers exist so that the cost of asking is paid only where the cost of not
asking is higher. The tier boundary is not "how hard is this question" — it is
**"what does it cost to be wrong, and can it be undone?"** A hard question with a
cheap, reversible answer is T0. An easy question with an irreversible answer is
T2.

---

## 1. The 3 lessons, in detail

### 1.1 Tier by reversibility and blast radius, never by difficulty

The instinct is to escalate what feels hard. That is the wrong axis. "Which of
these two equivalent date libraries should I use?" can be genuinely hard to
decide and is still T0 — pick one, log the reason, and it can be swapped in an
afternoon. "Should I delete the rows that failed to migrate?" is trivially easy
to answer and is T2, because the answer is unrecoverable.

The three tiers:

| Tier | Rule | What it covers |
|---|---|---|
| **T0** | Decide and log. | Mechanical, reversible, and already settled by the locked spec. Implementation detail that a competent engineer would not have escalated either. |
| **T1** | Decide, log, and flag in the run digest. | Judgement inside locked scope: naming, file layout, choosing among genuinely equivalent options, a defensible reading of an ambiguous-but-minor spec line. The user reviews these in a batch afterwards, not live. |
| **T2** | Stop, park the task, ask. | Irreversible or externally visible; contradicts or amends a locked decision; vision or taste the spec does not settle; legal, security, or privacy judgement; or the model's own confidence is below the bar. |

The T2 list, spelled out, because vagueness here is what makes the tier useless:
spending money; creating, rotating, or exposing credentials; publishing anything
publicly; deleting or destructively migrating data; creating third-party
accounts or incurring obligations; sending anything to a real person; changing
or contradicting a locked §0.2 decision; picking a product direction the spec
left open; and any judgement about what is legal, safe, or private.

### 1.2 Uncertainty resolves upward, always

The default when a decision does not obviously fit a tier is **T2, not T1**.

This is the single rule that makes the rest of the pattern work, and it is the
one most likely to get quietly softened, because softening it feels like
efficiency. It is not. The whole reason to run unattended is that the user is
not watching, which means a wrong T1 call gets discovered hours later with nine
tasks built on top of it. The cost asymmetry is enormous and it runs one way:
an unnecessary T2 costs one parked task and one question in a queue the user
reads at their leisure; an escalation that should have been T2 and was filed as
T1 costs a rebuild.

Phrase the test as a question the model asks itself honestly: *"If I am wrong
about this, is it obvious within the hour, and is it cheap to undo?"* Two yeses
is T0 or T1. Any no, or any genuine "I am not sure", is T2.

### 1.3 An escalation is a decision brief, not a question

A parked task whose escalation reads *"Should I use Postgres or SQLite?"* has
converted an LLM's work into the user's work. The user now has to reconstruct
the context the model already had, which is the opposite of delegation.

Every escalation carries five fields, and `scripts/escalate.mjs` refuses to file
one without them:

1. **Question** — one sentence, answerable.
2. **Why it is T2** — which trigger from §1.1 fired.
3. **Options** — the real candidates, two or more, each with its consequence.
4. **Recommendation** — what the model would choose and why. An escalation
   without a recommendation is an abdication; the model has more context than
   the user does at that moment and should say what it thinks.
5. **Blocked** — which task ids stall until this is answered.

The user should be able to answer a well-formed escalation in under a minute
with a single word, because the thinking was done for them and only the
judgement was reserved.

---

## 2. The 3 known anti-patterns

### 2.1 The escalation that is really a status update

*"Heads up — I'm about to start the auth module."* This is not a decision, so it
is not an escalation. It belongs in the run digest. Escalation queues that fill
with narration get skimmed, and a skimmed queue is a queue where the real
question gets a reflex answer. If nothing is blocked and nothing is being asked,
it is not an escalation.

### 2.2 Halting the whole run on one T2

The intuitive design — stop everything until the user answers — is wrong for the
same reason a build system that serialises on one slow test is wrong. A T2 parks
**its own task and that task's dependents**, and nothing else. Every independent
task keeps running. The run halts only when nothing runnable remains, and that
halt is a distinct outcome ("parked, questions outstanding") from both success
and failure, because a human reading the exit state needs to tell "I owe it an
answer" apart from "it broke".

### 2.3 Letting the tier be decided by whoever is tired

Tier assignment cannot be a vibe at 2am. It is a written rule read from this
pattern, and the same decision gets the same tier whether it comes up in task 2
or task 20. When a genuinely new category appears that the rule does not cover,
that meta-question is itself a T2 — the model asks where the boundary should be
rather than drawing it privately and inconsistently.

---

## 3. When this changes

Three triggers re-open the design:

1. **The escalation queue is consistently empty across several real runs.** That
   is not proof the tiers are right; it is a signal the T2 triggers may be too
   narrow for this project's domain, or that the model is quietly resolving
   uncertainty downward. Audit a finished run's T1 log and check whether
   anything in it should have been T2.

2. **The user answers most escalations with "obviously X, don't ask again".**
   The boundary is drawn too conservatively for this domain. The fix is a
   project-local T2 exception recorded in the consumer's §0.2 — a named,
   written-down carve-out — never a general relaxation of §1.2's
   uncertainty-resolves-upward rule.

3. **A wrong T1 call causes a rebuild.** Post-mortem the specific call, find
   which trigger should have caught it, and widen that trigger's wording here.
   One rebuild is worth a permanent change to the rule; this is exactly the kind
   of lesson the kit exists to carry between projects.

---

*— End of `tiered-escalation` pattern. See also: `prompts/AUTONOMOUS-BUILD.md`
(the auditor's contract), `prompts/WORKER-SESSION.md` (the worker's contract),
`scripts/escalate.mjs` (files an escalation), and the other patterns in
`lib/patterns/`.*
