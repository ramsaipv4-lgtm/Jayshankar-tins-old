# START HERE

**If you are an AI session opening this folder, read this page before anything else.**
It takes ten seconds and decides which of three different jobs you are here to do.

---

## The four roles

This repository serves four jobs. **The first three should not share a context window.**

| Role | Job | Needs | Reads |
|---|---|---|---|
| **R1 — Author** | Write study notes + questions for a topic | Web search, the user's source material | `docs/NEW-BANK.md`, `prompts/NOTES-V1.md`, `prompts/GENERATOR-V2.md` |
| **R2 — Builder** | Build the study/drill/exam web app | The spec. **No topic knowledge at all** | `AGENTS.md`, `SPEC.md`, `HANDOVER.md` |
| **R3 — Maintainer** | Validate, export, publish, catalog | The scripts | `HANDOVER.md`, `scripts/` |
| **R4 — Deliver** | Actually run a test this week: PDF, Google Forms, marks | A validated bank. Nothing else | **`docs/PAPER-EXAM.md`** |

R4 is the short one. It needs no app, no spec and no web search, and it is where someone with
a class tomorrow should go.

Why the separation is not fussiness: a builder that has absorbed 20,000 tokens of Azure
certification trivia writes worse React, and an author carrying a React specification writes
worse notes. Each context dilutes the other's task.

---

## Route yourself

### "Build the website / the app / the exam mode"

→ **R2.** Read `AGENTS.md`, then `HANDOVER.md` §5, and start at W1.
You do not need the parent workspace (`SPEC.md` §0.2b). You do not need to understand AI-102.

### "Add questions on <topic>" / "I have notes for a new subject"

→ **R1.** Read `docs/NEW-BANK.md`. Then follow the handoff protocol below.

### "Is this ready / what's the status / can I hand this to someone"

→ **R3.** Read `docs/STATUS-REPORT.md`.

### "I have a class tomorrow" / "make a Google Form" / "print the questions" / "collect the marks"

→ **R4.** Read `docs/PAPER-EXAM.md` and work through it with the user. Do not start on the app;
they do not need it and it is weeks away.

Steps 4 onward happen inside the user's Google account, which you cannot see. Your job is to
run the commands in steps 1–3, hand over the generated files, and read their Apps Script
Execution log back to them when something fails. **Make them do the dry run in step 6** —
the Google API calls in `consolidate-responses.gs` are not covered by `npm run pipeline`, and
five minutes of fake responses is the only thing standing between them and discovering a
mismatched column after thirty students have already submitted.

---

## Handoff protocol for new content (R1)

**Default: package the work and send it to a fresh session.** The steps:

1. **Ask the user for the topic.** Nothing here knows what subject they have in mind, and
   nothing will guess one. Also ask what source material they have.
2. **Scaffold and package:**
   ```bash
   node scripts/new-bank.mjs --id <slug> --domains "a:Alpha,b:Beta"
   node scripts/authoring-brief.mjs --id <slug> --topic "<what it is about>"
   ```
   This writes `AUTHORING-BRIEF.md` — self-contained, both authoring prompts inlined, target
   paths filled in. It needs nothing else from this repo.
3. **Tell the user:** open a fresh session **that has web search**, paste in
   `AUTHORING-BRIEF.md`, and work through it. It will interrogate them for source material,
   audience and scope, write notes one domain at a time with sign-off, then write questions.
4. **When they come back** with `blueprint.json`, `notes/*.md` and `questions.json`: drop them
   into `content/<slug>/` and run `npm run validate`. The validator is the arbiter.

### The escape hatch

If the user is short on time and asks you to just do it here — **do it**, but say once, briefly,
what they are trading:

> "I can author it in this session. Two things to know: I'll be carrying the topic context for
> the rest of our conversation, which tends to degrade later work on the app; and this only
> produces good notes if I can search the web — certification names and API signatures drift,
> and stale notes read as confident. Want me to go ahead?"

Then follow `prompts/NOTES-V1.md` and `prompts/GENERATOR-V2.md` in order, in-session. Do not
skip the sign-off between domains, and do not skip the `## Sources` sections — validation
fails without them.

---

## Why you cannot be *told* to research, only *checked*

There is no way for a markdown file to force a model to use a search tool. So this repo does
not try. It checks the **artifact** instead:

| Requirement | Enforced by |
|---|---|
| Every notes file ends with `## Sources` | `validate.mjs` — error |
| Sources carries `checked: YYYY-MM-DD` | error |
| Any "retired / deprecated / renamed / superseded" claim cites a **URL** | error — a local course file is not sufficient for a dated claim |
| Sources older than 180 days | warning |
| Domain weights name where they came from | `weightSourceRef` — error |
| Questions name the notes section they test | `sourceSection` — verified to resolve |
| No credentials in shipped content | `scan-secrets.mjs` — error |

Verify the output, not the process. This works: writing these very checks forced a re-verify of
the existing notes, which turned up three stale claims — a certification described as active
that had retired, a service retirement date that had already passed, and an OCR recommendation
Microsoft had since split in two.

---

## Reusing this repo for a different subject

The AI-102 course is kept as the worked example. When you want a clean slate:

```bash
node scripts/reset-project.mjs            # dry run, deletes nothing
node scripts/reset-project.mjs --confirm  # actually strips the instance
```

That removes `content/`, `source/`, `registry/` and the instance-specific docs, keeping
`SPEC.md`, `schema/`, `scripts/` and `prompts/`. Afterwards, update the state sections of
`README.md`, `AGENTS.md` and `HANDOVER.md` by hand — they will still describe the instance you
just removed.
