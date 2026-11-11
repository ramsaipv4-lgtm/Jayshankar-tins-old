<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:XXX -->
<!-- ZS:PLATFORM:XXX -->
<!-- ZS:LANGUAGE:XXX -->

# <Project Name> — Canonical Specification (v1)

> **One-paragraph summary.** What this is, for whom, in one sentence.
> Example: "Inventory management web app for a Tamil Nadu fresh-fish wholesale. PWA, offline
> graceful degradation, 3 user roles."

---

## 0. Preamble

### 0.0 Cheapest version that would work

> **REQUIRED.** Name a concrete cheapest artefact — a Google Sheet, a static HTML file, a
> CLI script, a single AWS Lambda, a Google Form, a Notion database. NOT "a database" or
> "an app" or "a service." The reviewer will reject any of those as too vague.

The cheapest version that would work for this project: **<one concrete artefact>**.

What the expensive version below buys over the cheapest version: **<2-4 sentences on what
this spec's design gains over the cheap version>**.

### 0.1 What this document is

This is the **canonical specification for <Project Name>**. Under TINS this file *is* the
source: the app is generated from it, and defects are fixed by editing this file and
regenerating — never by patching generated output.

It supersedes and absorbs the following prior work, which remains in the parent workspace
as a feature quarry:

| Prior artefact | Fate |
|---|---|
| ... | ... |

### 0.2 Locked design decisions

> **REQUIRED.** Every consumer spec must have decisions across these 10 categories:
> stack, schema, auth, role model, money (if applicable), deployment, validation,
> observability, lifecycle, demo mode. A spec with fewer than 10 categories has gaps.

| # | Decision | Resolution |
|---|---|---|
| **D1** | ... | ... |
| **D2** | ... | ... |
| **D3** | ... | ... |
| **D4** | ... | ... |

(Minimum 10 decisions. Recommended 12-15 for a non-trivial app. The kit's Jayshankar spec
has 17; the exam-forge spec had 12; the atal-incubation spec has 8 in §0.2 plus more
scattered.)

### 0.2b What this document is NOT

> Optional but recommended. Two or three anti-patterns this spec is not.

- **Not a sales pitch.** §0.0 is the sales pitch (the ceiling, not the floor).
- **Not a roadmap.** The Demo → Pilot → Production path is the constraint; the timeline
  is the user's call.
- **Not a <framework> tutorial.** The spec is what the product does on top of the
  framework; the framework's docs cover the framework.

### 0.3 Implementation baseline

**Built and working:** <list what already exists, even partial>.
**Not built:** <list what's still to do>. See `HANDOVER.md` §5 for the work queue.

### 0.4 What changed from the original brief

> **REQUIRED.** A small table with 3 columns. Three to six rows. This is the
> highest-value structural element in any TINS spec — it tells future sessions what
> the design is *reacting to*. The kit's validator fails any spec missing this
> section.

| Original brief | Actual requirement | What changed |
|---|---|---|
| ... | ... | ... |

---

## 1. Description

<One paragraph: what it is, who uses it, on what device.>

**Worst device that must work:** <name the device>. This constraint decides more than
any other.

**The three audience profiles:**

- **<Role 1>** on <device>, on <connection>. Sees <X>. Acts on <Y>.
- **<Role 2>** on <device>, on <connection>. Sees <X>. Acts on <Y>.
- **<Role 3>** on <device>, on <connection>. Sees <X>. Acts on <Y>.

---

## 2. Functionality

### 2.1 Route map

| Route | Mode | Who | Purpose |
|---|---|---|---|
| ... | ... | ... | ... |

### 2.2 Module 1 — <name>
<For each module: what the user sees, what happens, what is stored. Be concrete. "Shows
progress" is not a specification.>

---

## 3. Universal behaviour rules

1. **<Rule 1>** — <why>.
2. **<Rule 2>** — <why>.
3. ...

Common rules every TINS spec needs:
- Time zone: store UTC, display local.
- Money: numeric type, never float.
- Empty states: every list has a considered empty state, not a blank page.
- Destructive actions: confirm before delete; soft-delete by default.
- Hash routing if hosting is static.

---

## 4. Technical implementation

### 4.1 Architecture and the stack

| Layer | Choice | Reason | What it rules out |
|---|---|---|---|
| ... | ... | ... | ... |

### 4.2 Data structures

<Every field, every table, every type. The order is the order the migrations create
them (foreign keys respect the order).>

#### 4.2.1 `<table_name>`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### 4.3 Algorithms

<As NUMBERED STEPS, including tie-breaking rules and what happens when a rule cannot be
satisfied. If you write an adjective like "balanced" or "fair" without a procedure
underneath it, you have written a bug.>

#### 4.3.1 <Algorithm name>

1. **Validate** <input>. Reject with <error> if not.
2. **Lock** <resource> with `SELECT ... FOR UPDATE`.
3. ...

### 4.4 Dependencies

| Package | Required for | Why this version |
|---|---|---|
| ... | ... | ... |

**Forbidden** in `package.json`: lodash, moment, dotenv, axios, any UI kit that ships
its own design system. The app's look is utility classes, full stop.

---

## 5. Style guide

- **Type:** system font stack. No web font.
- **Colours:** <name the palette and the roles>.
- **Spacing:** <name the grid and the gap>.
- **Money:** always prefixed with `<currency symbol>`; always suffixed with `<unit>`
  (e.g. `₹650/kg`).
- **Time:** 24-hour format with `DD MMM` dates.

---

## 6. Accessibility requirements

- **WCAG 2.1 AA** is the target. Not AAA.
- All form inputs have `<label>` elements, not just placeholders.
- All interactive elements have a visible focus ring.
- Touch targets are at least 44×44 px.
- The offline banner is `role="status" aria-live="polite"`.

---

## 7. Error handling

| Failure | Behaviour |
|---|---|
| ... | ... |

Common failure modes every spec must address:
- Storage full (localStorage, IndexedDB)
- Permission denied (RLS deny)
- Network offline
- Corrupt saved state
- Clock changed (user adjusts system time)
- Auth session expired
- Two operations race for the same resource (FOR UPDATE)

---

## 8. Acceptance criteria

> **REQUIRED.** Numbered, each one mechanically checkable. The kit's validator runs
> the structural ones; consumers extend with their own. Minimum 5 criteria.

### 8.1 <Category>
- **§8.1a** ...
- **§8.1b** ...

A criterion that starts with a verb like "loads fast" or "is responsive" is rejected
(the criterion must name a number or a checkable property). "Loads fast" is not.
"First interactive under 3 seconds on the named device" is.

---

## 9. Out of scope

> **REQUIRED.** Explicit list, with at least 1 item. A keen implementer does not build
> these.

- ...

---

## Notes on what I guessed, what I assumed, and what's most likely to be wrong

> **REQUIRED closing section.** The kit's SPEC-AUTHOR prompt generates this list as
> its last step. The TINS methodology depends on it.

### Things I guessed
- ...

### Things I assumed
- ...

### What's most likely to be wrong
- ...

---

*End of spec skeleton. Implementation begins at W1 in HANDOVER.md.*
