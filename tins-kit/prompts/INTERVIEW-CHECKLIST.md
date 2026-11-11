# Prompt: INTERVIEW-CHECKLIST

> **The one-page reference for the `SPEC-AUTHOR` prompt's 7-question interview.** When
> a fresh LLM session runs `prompts/SPEC-AUTHOR.md`, it must ask these 7 questions
> and wait for answers before writing any spec. This file is the checklist the
> *interviewer* (the LLM) uses to make sure no question is skipped.
>
> **Source:** `tins-kit/SPEC.md` §2.1 (the "interview is the highest-leverage 10
> minutes" promise), `Jayshankar/AGENT-BRIEF.md` (the 5-question variant the
> Jayshankar project used), `exam-forge/SPEC-AUTHOR.md` (the 7-question canonical
> interview).

---

> **Before the interview:** run the tooling gate
> (`node tins-kit/scripts/tooling-audit.mjs`, workflow in
> `prompts/TOOLING-AUDIT.md`). It is blocking (D33) — a session missing a
> capability improvises rather than stopping, and step A below is exactly
> where that shows up as invented numbers.
>
> **After the spec is locked:** `prompts/AUTONOMOUS-BUILD.md` can take the
> build from here — an auditor session plus worker sessions, escalating
> only what an LLM must not decide alone (D32).

---

## When to use

The LLM session that runs `SPEC-AUTHOR.md` should open this checklist as a
"second tab." After asking each question, the LLM ticks the box and moves to the
next. If the user tries to skip a question ("just write the spec"), the LLM
**refuses and explains**: "the interview is the highest-leverage 10 minutes of the
project; without it the spec will have gaps that cost 10× the interview time later."

---

## The 7 questions

### Q1 — What the software does, in one paragraph, and who uses it.

**Why this matters:** forces the user to articulate the elevator pitch. If they
can't, the spec won't either.

**Red flags:**
- "It's like X but for Y" → push for the *delta* from X. What does Y add?
- "It does everything" → push for the *one thing it must do well*.

**What the LLM does with the answer:** writes the first sentence of SPEC.md §1.

---

### Q2 — Who the users are, on what devices, on what connection. Name the WORST device.

**Why this matters:** the worst device decides more than any other constraint.
If the answer is "a junior accountant in a tier-3 Indian city on a 3G connection
with a 4-year-old Android phone," the entire UI design (no JS frameworks, no
large images, no real-time updates) is determined by that one answer.

**Red flags:**
- "Desktop and mobile" → push: which is *worse*? The worse one wins.
- "Fast connection" → push: what's the *slowest* connection you must support?
- "Modern browsers" → push: which one specifically? Edge cases in Safari < 16
  (no top-level await, no import maps) will eat a week.

**What the LLM does with the answer:** writes SPEC.md §2.2 (the user + device
matrix) and §2.3 (the network + browser matrix).

---

### Q3 — What data goes in. Where does it come from, who authors it, what shape is it in today?

**Why this matters:** the data shape decides the schema, the validation, the
storage, and 80% of the UI. Without a real sample, the LLM invents a shape and
the spec is wrong from the first line.

**Red flags:**
- "It's just JSON" → push: paste an actual sample. Even 5 records.
- "The user types it in" → push: what's the *first* form? Walk me through
  what they type. Field-by-field.
- "It comes from an API" → push: paste a real response. With auth. With errors.

**What the LLM does with the answer:** runs the "A. MEASURE MY INPUT DATA" pass
from `SPEC-AUTHOR.md` (counts records, computes field distributions, finds
malformed rows).

---

### Q4 — What must NOT be built. Push me on this.

**Why this matters:** an unstated boundary gets built by accident. The user
will think "of course we don't build payments" but if the spec doesn't say it
explicitly, the next contributor will spend 2 weeks building a payment flow.

**Red flags:**
- "Just the basics" → push: name 5 things that are NOT in scope.
- "We'll add it later" → push: then it's NOT in v1. Write that down.

**What the LLM does with the answer:** writes SPEC.md §9 (out-of-scope) as an
*exhaustive* list, not a "we'll figure it out" list.

---

### Q5 — Where it will be hosted, and whether a server is allowed. If not, what's impossible?

**Why this matters:** "no server" means no auth, no shared state, no async
processing, no email. If the user wants those things, they have to admit a
server is needed. The answer determines the entire architecture.

**Red flags:**
- "We don't know yet" → push: pick one. The spec needs an answer to write §3.
- "Cloud, but cheap" → push: which cloud? The free tier shapes the limits.

**What the LLM does with the answer:** writes SPEC.md §3 (hosting + topology)
and constrains §4 (architecture) accordingly.

---

### Q6 — What "correct" means. How will we know a build is good? What would a bad one look like?

**Why this matters:** without a definition of "correct," the LLM has no
acceptance criteria, and the spec has no §8. A bad build is "anything I can't
ship" — that's not a definition.

**Red flags:**
- "It works" → push: what does "works" mean? For whom? On what input?
- "We'll test it" → push: what tests? What's the success criterion per test?
- "The user will tell us" → push: which user? What's the first thing they
  would say if the build were bad?

**What the LLM does with the answer:** writes SPEC.md §8 (acceptance criteria)
as a *checklist*, not a paragraph.

---

### Q7 — What already exists that this replaces or reuses.

**Why this matters:** the user almost always has a spreadsheet, a Google Form,
an existing app, or a paper process that the new software replaces. The
*delta* is the spec. Without knowing the existing artefact, the LLM builds
the same thing again, differently, and the user is frustrated.

**Red flags:**
- "Nothing" → push: how do you do this today? Even "I do it by hand in a
  notebook" is an answer.
- "We have a Notion page" → push: link it. Read it. The structure of the
  Notion page is the user's mental model of the data.

**What the LLM does with the answer:** writes SPEC.md §0.0 (predecessor
documents) and §0.1 (the "this replaces" statement).

---

### Q7a — Website check (triggers `FRONTEND-VISION-INTERVIEW.md`)

**Not one of the 7 — a gate, checked after them.** Is this project a website
(something that renders in a browser)?

**If yes:** stop before A/B/C. Open `prompts/FRONTEND-VISION-INTERVIEW.md` and
run that interview now. It surveys the visual/design vision (researching
inspiration sites if the user is unsure) and locks the frontend-library
choices, producing `FRONTEND-VISION.md`. Only then continue to A/B/C.

**If no** (a CLI tool, a backend service, a script with no UI): skip this
entirely. There is no visual layer to survey.

**Why this matters:** the design-vision interview only makes sense for
software with a visual frontend. Firing it for a CLI tool wastes the user's
time; skipping it for a website means the frontend gets built on a silent
guess instead of a surveyed, sourced-and-approved vision.

---

### Q8 — Public release intent (triggers `PUBLISH-OPEN-SOURCE.md`, eventually)

**Not one of the 7, and not a gate like Q7a — asked unconditionally, of
every project.** Do I intend for this project to eventually be released
publicly — open-sourced, shared as a portfolio piece, or repurposed as
teaching/interview-prep material?

**This is not a gate to a later interview.** Unlike Q7a, there is no
"if yes, stop and hand off" here. The LLM asks the question, records the
answer, and continues straight to A/B/C. What the answer changes is not
the interview flow but the discipline that governs the project from this
point forward: how much explanation goes into BUILDER-DECISIONS-REVIEW.md
entries, how comments get written, how self-contained the documentation
stays as the project grows.

**Record the answer** as a row in SPEC.md §0.2: `Public release intended:
TRUE/FALSE`.

**The actual release packaging** — scrubbing the methodology out, writing
the public-facing docs, verifying the result stands on its own under real
technical scrutiny — is a separate later step, `prompts/PUBLISH-OPEN-SOURCE.md`,
run whenever release actually happens. Answering FALSE here doesn't
foreclose that later prompt; it just means more cleanup work at that
point, since the discipline wasn't there from day one.

**Red flags:**
- "Let's decide later" → push: decide FALSE for now, then. "Later" with
  no answer recorded means the discipline defaults to sloppy, and by the
  time release is considered, the methodology is woven through everything.
- "It's just a CLI tool, why would that matter" → push: portfolio pieces,
  teaching material, and interview-prep write-ups are not limited to
  websites. Ask this for every project type.

**Why this matters:** discipline applied from day one (careful comments,
decision entries that explain *why* not just *what*) is cheap. The same
discipline applied retroactively, after months of fast-and-loose private
development, is expensive — and often incomplete, because nobody remembers
which comment leaked which internal detail.

---

## The "A/B/C" pass (after the 7 questions)

Before drafting the spec, the LLM runs:

- **A. MEASURE MY INPUT DATA.** Count things in the real sample. Don't sample-and-assume.
- **B. CHECK FOR ROT.** Anything with a date / version / product name may be out of date.
  Web-search and cite.
- **C. PROPOSE THE DATA FORMAT FIRST.** What will a program actually consume? If the
  answer is "prose an AI wrote", stop and redesign.

These three are non-negotiable. The SPEC-AUTHOR prompt enforces them.

---

## What the LLM records

After the interview + A/B/C pass, the LLM writes a short "what I guessed"
appendix to SPEC.md §0.3:

```md
## §0.3 What I guessed (call out before building)

- The worst device is a 4-year-old Android on 3G. (User said "tier-3 Indian city,
  junior accountant" — I extrapolated the device.)
- The auth is email + password, not OAuth. (User said "no Google login in v1" —
  I extrapolated the auth method.)
- The data is multi-tenant, not single-tenant. (User said "5 incubators" — I
  extrapolated the tenancy.)

If any of these is wrong, the spec needs to be re-drafted.
```

This appendix is the **single most-valuable structural element** of the kit's
gap analysis. It is the place where the LLM's assumptions are explicit, so the
user can correct them *before* the spec is written.

---

*— End of `INTERVIEW-CHECKLIST` prompt. See also: `prompts/SPEC-AUTHOR.md` (the
canonical 7-question interview), `templates/SPEC.md` §0.3 (the "what I guessed"
appendix).*
