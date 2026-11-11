# Task brief: <task title>

> Filled in by the assigning engineer before this packet is scanned and
> handed off. Read this brief fully before starting; if anything is
> ambiguous, that's a defect in the brief, not something to guess at —
> flag it back to the person who assigned this task before you start.

**Assigned:** <date>
**Owner (return questions to):** <name / contact>
**Estimated size:** <e.g. "1–2 days", "a few hours">

---

## Context

<2–5 sentences. What is this a piece of, at a level someone outside the
project can follow? What already exists that this builds on or plugs
into? Avoid internal jargon — write it the way you'd brief a contractor
who has never seen this codebase.>

## Scope

<What you are building, precisely. Bullet the concrete deliverables if
that's clearer than prose. Be exhaustive — anything not listed here is
out of scope by default (see below), not "use your judgment.">

## Interface contract

<The exact shape this task's output must have so it plugs back in
cleanly — function signatures, API request/response shapes, file
formats, expected exports, naming conventions. This is the part that
must be unambiguous: if two people implemented this brief independently,
their outputs should be interchangeable.>

**Inputs you're given:**
- <file/data this task starts from — see `files/` in this packet>

**Outputs you must produce, exactly named:**
- <file/function/endpoint — exact name, exact shape>

## Files included in this packet

<A list of every file under `files/` in this packet, one line each, with
a one-line note on what it's for. This is the complete set of source
files you have — you should not need anything else to complete this
task. If you find you need a file that isn't here, stop and ask; don't
guess at its contents.>

## Acceptance criteria

<Numbered, checkable. "It works" is not a criterion — "calling X with Y
returns Z" is.>

1. <criterion>
2. <criterion>
3. <criterion>

## Out of scope

<Explicit. What looks related but is NOT part of this task — the classic
sources of scope creep or duplicate work across parallel tasks.>

- <item>
- <item>

## Definition of done

- [ ] All acceptance criteria above pass.
- [ ] Your changes are limited to the files you were given plus any new
      files your outputs require — nothing outside this packet's scope.
- [ ] You've filled in `NOTES.md` in this packet with anything you'd
      want the next person to know: decisions you made, trade-offs,
      anything you'd do differently with more time.
- [ ] Your returned work is a plain file/folder (or a zip of one) — no
      version-control history, no files outside what you were asked to
      touch.

## How to return your work

<Concrete instructions from the assigning engineer — e.g. "zip the
`files/` folder with your changes plus `NOTES.md` and send it back to
<contact>," or "upload to <shared location>." Filled in per packet.>

---

*Questions about this brief go to the owner listed above — not to
guessing. An ambiguous brief is the assigner's mistake to fix, not
yours to work around.*
