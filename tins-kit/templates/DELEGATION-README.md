# delegation/ — parallel work coordination for this project

> **What this is:** the folder that manages one round of splitting the
> remaining locked work into independent tasks, so multiple LLM sessions
> or people can build pieces in parallel and you bring them back
> together. Added by `tins-kit/prompts/DELEGATE-WORK.md` (D29).
>
> **Author-side only.** Nothing in this file, or in `LEDGER.md`, or in
> any `status.md`, is ever exported to a contributor. The only thing
> that ever leaves this folder is the `packet/` subtree inside an
> `external`-mode task, and only after `scan-task-packet.mjs` has passed
> clean. Everything else here can reference this project's real
> `SPEC.md` / `HANDOVER.md` / methodology freely.

---

## Layout

```
delegation/
  README.md              ← this file
  LEDGER.md               ← every task: mode, status, assignee, touched files
  tasks/
    T1-<slug>/             (self mode — no packet needed)
      status.md            assigned/in-progress/returned/integrated + dates
      # This task's work happens directly in a clone/copy of the whole
      # project, running the normal CONTINUE-TINS-PROJECT.md prompt
      # against that one W. Nothing here needs scrubbing — it's you.
    T2-<slug>/             (external mode — scrubbed export)
      packet/               ← the ONLY thing that ever leaves this project
        TASK-BRIEF.md
        files/
        NOTES.md
      returned/             ← the contributor's completed work lands here
      status.md
  completed/               ← archived tasks after INTEGRATE-DELEGATED-WORK.md
```

## The two modes, in one sentence each

**Self** — you're directing the work yourself, however many LLM
accounts or platforms you run it through. No packet, no scrubbing, full
continuity: the other session works in a full clone and writes straight
to the real decision log.

**External** — someone else (a hired human, or their own LLM session)
is directing the work. They get a `packet/` only: the ticket, the exact
files the task needs, and a blank notes file — no repo access, no
methodology, no history.

## When to use this

Only when the project's spec is locked for the piece of work you're
about to split — `DELEGATE-WORK.md` won't let you start a round against
an unfrozen vision. Splitting work before the vision is settled just
means every task gets outdated brief.

## The full flow

1. `tins-kit/prompts/DELEGATE-WORK.md` — split the locked remaining work
   into tasks, decide mode, run the independence check, build/scrub/export
   packets for external tasks.
2. Tasks happen (self, in a clone; external, off-project entirely).
3. `tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md` — pull every returned
   task back in, fold notes into the real decision log, resolve
   discrepancies, leave the gate green.

## See also

`LEDGER.md` (the live table), `tins-kit/prompts/DELEGATE-WORK.md`,
`tins-kit/prompts/INTEGRATE-DELEGATED-WORK.md`,
`tins-kit/scripts/check-task-independence.mjs`,
`tins-kit/scripts/scan-task-packet.mjs`.
