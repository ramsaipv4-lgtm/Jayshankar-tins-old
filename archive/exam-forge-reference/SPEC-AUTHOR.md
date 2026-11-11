# Prompt: write a TINS specification for a new project

Paste this into a fresh AI session when you want to start a new TINS project. It produces the
`SPEC.md` that the software will be generated from.

Give it a session with **web search**. Do not use the session that will later write the code.

---

## The prompt

```
You are writing a TINS specification: a single document detailed enough that a different AI,
with no access to you and no chance to ask questions, can build the software from it correctly.

The document IS the source code. If the software is wrong, the document was wrong.

Before writing anything, interview me. Ask about all of this, and wait for my answers:

1. What the software does, in one paragraph, and who uses it.
2. Who the users are, on what devices, on what connection. Name the WORST device that must
   work — that constraint decides more than any other.
3. What data goes in. Where does it come from, who authors it, what shape is it in today?
   Ask me to paste a real sample. Not a description of a sample — an actual one.
4. What must NOT be built. Push me on this. An unstated boundary gets built by accident.
5. Where it will be hosted, and whether a server is allowed. If not, say plainly what becomes
   impossible as a result.
6. What "correct" means. How will we know a build is good? What would a bad one look like?
7. What already exists that this replaces or reuses.

Then, before drafting, do these three things and report back:

A. MEASURE MY INPUT DATA. If I gave you a sample, count things in it. How many records, how
   many are complete, what is the distribution of the important fields, what is malformed.
   Report actual numbers. Do not sample and assume. This routinely finds problems that change
   the design, and it is the highest-value ten minutes of the whole project.

B. CHECK FOR ROT. Anything in my description with a date, a version, or a product name may be
   out of date. Search the web and tell me what has changed. Cite links.

C. PROPOSE THE DATA FORMAT FIRST, before any feature. Ask: what will a program actually
   consume? If the answer is "prose an AI wrote", stop and redesign — that leads to parsers,
   and parsers to silent data loss. Choose a structured format and show me the schema.

Wait for me to approve A, B and C. Then write SPEC.md with these sections:

  0. Preamble
     0.1 What this document supersedes.
     0.2 LOCKED DECISIONS — a table. Each row: the decision, and WHY. Include the decisions
         about what NOT to build, and about what the system cannot honestly do. This table is
         the most valuable part of the document; it stops the same argument recurring.
     0.3 What already exists versus what is still to build.

  1. Description — what it is, for whom, on what device.

  2. Functionality — one numbered module per area of behaviour. For each: what the user sees,
     what happens, what is stored. Be concrete. "Shows progress" is not a specification.

  3. Universal behaviour rules — things true everywhere: offline behaviour, what happens when
     storage fails, how untrusted content is rendered, keyboard access.

  4. Technical implementation
     4.1 Architecture and the stack, with a REASON for each choice and what it rules out.
     4.2 Data structures, written out in full, every field explained.
     4.3 Algorithms as NUMBERED STEPS, including tie-breaking rules and what happens when a
         rule cannot be satisfied. If you write an adjective like "balanced" or "fair" without
         a procedure underneath it, you have written a bug.
     4.4 Dependencies, and which parts must have none.

  5. Style guide — exact colours, spacing, fonts.
  6. Accessibility requirements.
  7. Error handling — a table of every failure and the exact behaviour. Include: storage full,
     permission denied, network gone, corrupt saved state, clock changed.
  8. Acceptance criteria — numbered, each one mechanically checkable. "Loads fast" is not.
     "First interactive under 3 seconds on the named device" is.
  9. Out of scope — an explicit list, so a keen implementer does not build it anyway.

Rules while writing:

- Every algorithm must be implementable by someone who cannot ask you a question.
- Never state a number the reader cannot verify. Refer to the command that computes it.
- Separate AUTHORED data (judgement: weights, labels, notes) from DERIVED data (computed:
  counts, hashes, summaries). Specify that scripts may write derived data and must refuse to
  overwrite authored data.
- Specify a validator that FAILS THE BUILD, and specify a self-test that proves the validator
  can fail. A checker nobody has watched fail is decoration.
- Where the system cannot do something — enforce fullscreen, hide answers in a static site,
  verify identity — say so in the LOCKED DECISIONS table, in plain words. Never let the
  document imply a guarantee the code cannot keep.
- Prefer making a mistake structurally impossible over warning against it.
- Write for a competent implementer who knows nothing about my domain.

When you finish, list:
  · every assumption you made that I did not confirm
  · every part where you had to guess
  · the three things most likely to be wrong
```

---

## Notes on using it

**Do the interview properly.** The temptation is to answer the seven questions in one paragraph
and rush to the document. The questions that feel annoying — "what must not be built", "name
the worst device" — are the ones that prevent the most rework.

**Step A is not optional.** Measuring the real input data was the single most valuable action
in this project. It found that 85% of answers were the same option and that a third of the
records were incomplete. That discovery changed the whole plan.

**Expect the specification to be long.** This project's is about 850 lines for a fairly small
application. That is normal. The document replaces the code, so it carries the code's detail.

**Read the "what I guessed" list at the end carefully.** That is where the next six months of
problems are hiding.

---

## After the specification exists

1. Save it as `SPEC.md`.
2. Build the **validator** and its self-tests next — before any application code.
3. Then generate the application, in a **separate session**, from the specification alone.
4. When something is wrong: fix `SPEC.md`, then regenerate. Never patch generated code. The
   moment you patch, the document stops being true, and the whole method collapses.
