# Prompt: write a TINS specification for a new project

Paste this into a fresh AI session when you want to start a new TINS project. It produces the
`SPEC.md` that the software will be generated from. Adapted from the exam-forge canonical
prompt per `archive/exam-forge-reference/SPEC-AUTHOR.md`; the kit's contribution is the
explicit §0.4 "interview-reveals-reality" requirement (the highest-value structural
element the kit's gap analysis identified as missing).

Give the LLM a session with **web search**. Do not use the session that will later write the
code.

**Companion to:** `prompts/FRONTEND-VISION-INTERVIEW.md` — when the project being spec'd is a
website, this prompt's Step 7a hands off to it before A/B/C. Also companion to
`prompts/PUBLISH-OPEN-SOURCE.md` — Step 8 below asks every project (not just websites)
whether public release is intended; if so, that later prompt is what actually does the
release packaging, informed by the answer recorded here.

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

7a. Check: is this a website (something that renders in a browser)? If yes, STOP here —
    open `prompts/FRONTEND-VISION-INTERVIEW.md` and run that interview now, before
    continuing to A/B/C below. It surveys the visual/design vision (and researches
    inspiration sites if I'm unsure) and locks the frontend-library choices. It produces
    `FRONTEND-VISION.md`, which feeds §2 and §5 of the spec you're about to draft. If this
    is not a website (a CLI tool, a backend service, a script), skip 7a entirely and go
    straight to question 8.

8. Do I intend for this project to eventually be released publicly — open-sourced, shared
   as a portfolio piece, or repurposed as teaching/interview-prep material? Ask this for
   EVERY project, not just websites. This is not a gate to a later interview — it's a
   locked decision that shapes discipline from today: how much explanation goes into
   BUILDER-DECISIONS-REVIEW.md entries, how comments get written, how self-contained the
   documentation stays as the project grows. Record the answer as a row in §0.2:
   `Public release intended: TRUE/FALSE`. The actual release packaging — scrubbing the
   methodology out, writing the public-facing docs, verifying it stands on its own — is a
   separate later step (`prompts/PUBLISH-OPEN-SOURCE.md`), run whenever release actually
   happens. Answering FALSE here doesn't foreclose that later prompt; it just means more
   cleanup work at that point, since the discipline wasn't there from day one.

Then, before drafting, do these three things and report back:

A. MEASURE MY INPUT DATA. If I gave you a sample, count things in it. How many records, how
   many are complete, what is the distribution of the important fields, what is malformed.
   Report actual numbers. Do not sample and assume. This routinely finds problems that change
   the design, and it is the highest-value ten minutes of the whole project.

B. CHECK FOR ROT. Anything in my description with a date, a version, or a product name may be
   out of date. Search the web and tell me what has changed. Cite links. This is especially
   important for: package versions, framework major versions, API signatures, certifications
   or compliance regimes, and any "current best practice" claim.

C. PROPOSE THE DATA FORMAT FIRST, before any feature. Ask: what will a program actually
   consume? If the answer is "prose an AI wrote", stop and redesign — that leads to parsers,
   and parsers to silent data loss. Choose a structured format and show me the schema.

Wait for me to approve A, B and C. Then write SPEC.md with these sections (use the kit's
templates/SPEC.md as the skeleton — copy it and fill in):

  0. Preamble
     0.0 Cheapest version that would work (REQUIRED — name a concrete artefact, not "a
         database" or "an app"; a Google Sheet, a static HTML file, a CLI script, a
         single AWS Lambda, etc. Then name what the expensive version below buys.)
     0.1 What this document is / what it supersedes.
     0.2 LOCKED DECISIONS — a table. Each row: (#, Decision, Resolution). At minimum,
         every spec should lock decisions across these 10 categories: stack, schema,
         auth, role model, money (if applicable), deployment, validation, observability,
         lifecycle, demo mode. A spec with fewer than 10 categories has gaps.
     0.2b What this document is NOT (optional but recommended: 2-3 anti-patterns).
     0.3 What already exists versus what is still to build.
     0.4 What changed from the original brief (REQUIRED — see "Why §0.4 is mandatory" below).

  1. Description — what it is, for whom, on what device. Name the worst device.

  2. Functionality — one numbered module per area of behaviour. For each: what the user
     sees, what happens, what is stored. "Shows progress" is not a specification.

  3. Universal behaviour rules — things true everywhere: offline behaviour, what happens
     when storage fails, how untrusted content is rendered, keyboard access, time zone,
     money format, empty states.

  4. Technical implementation
     4.1 Architecture and the stack, with a REASON for each choice and what it rules out.
     (Check the versions in A/B/C — do not pin to outdated majors.)
     4.2 Data structures, written out in full, every field explained. The order is the
         order the migrations create them (foreign keys respect the order).
     4.3 Algorithms as NUMBERED STEPS, including tie-breaking rules and what happens when
         a rule cannot be satisfied. If you write an adjective like "balanced" or "fair"
         without a procedure underneath it, you have written a bug.
     4.4 Dependencies, and which parts must have none.

  5. Style guide — exact colours, spacing, fonts.
  6. Accessibility requirements.
  7. Error handling — a table of every failure and the exact behaviour. Include: storage
     full, permission denied, network gone, corrupt saved state, clock changed.
  8. Acceptance criteria — numbered, each one mechanically checkable. "Loads fast" is not.
     "First interactive under 3 seconds on the named device" is. The kit's validator
     (scripts/validate.mjs) will run §8.X-style criteria; a spec with fewer than 5
     criteria has gaps.
  9. Out of scope — an explicit list, so a keen implementer does not build it anyway.

  Appendix A (optional): demo seed, or anything else the consumer needs.

Rules while writing:

- Every algorithm must be implementable by someone who cannot ask you a question.
- Never state a number the reader cannot verify. Refer to the command that computes it.
- Separate AUTHORED data (judgement: weights, labels, notes, decisions) from DERIVED
  data (computed: counts, hashes, summaries). Specify that scripts may write derived
  data and must refuse to overwrite authored data.
- Specify a validator that FAILS THE BUILD, and specify a self-test that proves the
  validator can fail. A checker nobody has watched fail is decoration.
- Where the system cannot do something — enforce fullscreen, hide answers in a static
  site, verify identity — say so in the LOCKED DECISIONS table, in plain words. Never
  let the document imply a guarantee the code cannot keep.
- Prefer making a mistake structurally impossible over warning against it.
- Write for a competent implementer who knows nothing about my domain.

When you finish, list:
  · every assumption you made that I did not confirm
  · every part where you had to guess
  · the three things most likely to be wrong

---

## Why §0.4 is mandatory

A spec without §0.4 looks like the design was invented from thin air. A spec with §0.4
tells future sessions "this is what we were reacting to." It is the difference between a
design and a story about a design.

§0.4 is a small table with 3 columns: Original brief (what the user said first), Actual
requirement (what the interview revealed), What changed (the spec's design consequence).
Three to six rows is enough. Example (from the Jayshankar spec):

| Original brief | Actual requirement | What changed |
|---|---|---|
| "SKU, quantity, weight" | Fish wholesale: SKU + batch + location + perishable + multilingual names | Schema is fish-business-shaped, not generic |
| "Vendor inputs and removes from stock" | Vendor-rep records incoming deliveries and outgoing sales | The "vendor" in the app is a role, distinct from the `vendors` table (fishermen) |
| "Website, then Android, then iOS" | Web is the floor; Android is Phase 3 if/when client demands; iOS is YAGNI | Stack picks avoid iOS-specific constraints |

Without §0.4, a future session reads the spec and sees 17 locked decisions but doesn't
know what was being decided against. The spec appears arbitrary. With §0.4, the spec is
a record of a conversation, and the conversation is recoverable.

The kit's validator (`scripts/validate.mjs`) fails any spec missing §0.4.

---

## Notes on using it

**Do the interview properly.** The temptation is to answer the seven questions in one
paragraph and rush to the document. The questions that feel annoying — "what must not be
built", "name the worst device" — are the ones that prevent the most rework.

**Step A is not optional.** Measuring the real input data was the single most valuable
action in past TINS projects. It found that 85% of answers were the same option and that
a third of the records were incomplete. That discovery changed the whole plan. If the
user has no real data (e.g. demo to a gatekeeper), step A reports "no data yet; demo
data is real-schema, fake-content, plausible seed of N rows." That is also a finding.

**Step B is not optional either.** Stack rot is real. Pinning to "React 18 + Tailwind 3
+ Vite 5" without checking means the spec might ship on versions that have since moved.
A 30-second web search saves hours.

**Expect the specification to be long.** This project's is about 850 lines for a fairly
small application. The Jayshankar spec is 1046 lines; the atal-incubation spec is 1,706
lines. That is normal. The document replaces the code, so it carries the code's detail.

**Read the "what I guessed" list at the end carefully.** That is where the next six months
of problems are hiding.

---

## After the specification exists

1. Save it as `SPEC.md`.
2. Build the **validator** and its self-tests next — before any application code. The
   kit's `scripts/validate.mjs` and `scripts/selftest.mjs` are the templates.
3. Then generate the application, in a **separate session**, from the specification
   alone. The kit's `scripts/new-project.mjs` scaffolds the directory structure.

   **Ask the user how they want it built (D35).** Once the spec is locked and
   the tooling gate (`prompts/TOOLING-AUDIT.md`) is green, run
   `prompts/EXECUTION-MODE-INTERVIEW.md`. It presents five options — build it
   in one session (`solo`); an auditor plus workers in this harness
   (`auditor-local`); an auditor here with workers on the user's other LLM
   accounts (`auditor-remote`); the user personally driving several of their
   own LLM sessions (`self-parallel`); or scrubbed packets to someone else
   (`external`) — and routes to the right prompt. Do not guess this: the user
   knows what accounts they pay for and you do not.

   **If they choose an auditor-driven mode (D32).** Paste
   `prompts/AUTONOMOUS-BUILD.md` into a fresh session. That session becomes
   the **auditor**: it decomposes the remaining work into file-disjoint
   tasks, dispatches **worker** sessions running
   `prompts/WORKER-SESSION.md`, verifies each returned task against its
   acceptance criteria and the gate, integrates them, and repeats until the
   spec is built. It escalates to you only decisions an LLM must not make
   alone — irreversible or externally visible ones, anything that would
   amend a locked §0.2 decision, and anything it is genuinely unsure about
   (the tiers are in `lib/patterns/tiered-escalation.md`). Those park their
   own task and let the rest of the run continue, so an unattended run keeps
   working while it waits on you.

   The separate-session rule is not relaxed by this — it is enforced harder.
   The auditor does not write product code, and the sessions that write the
   code are not the ones that judge it.
4. When something is wrong: fix `SPEC.md`, then regenerate. Never patch generated code.
   The moment you patch, the document stops being true, and the whole method collapses.
