# Exam Forge

Turns a validated question bank into a self-contained static study site — **study notes**,
**per-domain drill with answers in place**, and a **timed, domain-weighted, seeded practice
exam** with an integrity log and a scored report — plus a separate **static catalog** of
every bank ever built.

Built spec-first (TINS): [`SPEC.md`](SPEC.md) is the source. The application is generated
from it; defects are fixed by editing the spec and regenerating, never by patching output.

> **🤖 LLM agents: read [`START-HERE.md`](START-HERE.md) first.** It routes between the three
> roles this repo serves — authoring content, building the app, maintaining — which should not
> share a context window. Then [`AGENTS.md`](AGENTS.md) and [`HANDOVER.md`](HANDOVER.md).
> The content pipeline is already built and verified — do not rewrite it, and do not
> re-audit the legacy tools. `docs/PIPELINE.md` and `docs/AUDIT-set5.md` already did.

---

## Status

| Part | State |
|---|---|
| Content pipeline (schema, converter, validator, self-test) | ✅ **Working and verified** |
| `content/ai102-day1-3` — 50 questions, 3 domains | ✅ Converted, validates clean |
| Blueprint weights | ✅ **Official-normalized** from the published AI-102 domain bands |
| Study notes — all 3 domains | ✅ Written from the Sem 5 course material |
| `prompts/GENERATOR-V2.md` — the authoring prompt | ✅ Written |
| `SPEC.md` — canonical spec for the app | ✅ Written |
| The application (study / drill / exam) | ⛔ **Not generated yet** — HANDOVER.md W1 |
| Checkpoint questions | ⛔ None authored — `content/ai102-day1-3/notes/README.md` |
| Catalog site | ⛔ Not generated yet — W6 |

## Quick start

Node 18+. No install needed for the pipeline — it is deliberately zero-dependency.

```bash
npm run pipeline       # selftest -> validate -> scan-secrets. The gate.

npm run selftest       # prove the validator fails on every known defect
npm run validate       # check every bank in content/; exits 1 on any error
npm run scan-secrets   # refuse to ship content containing credentials
npm run duplicates     # report near-duplicate questions as the bank grows
npm run verify-releases# confirm frozen cohort exams still match the bank

npm run new-bank -- --id <slug> --domains "a:Alpha,b:Beta"   # start a new topic
npm run prompt                                               # the paste-into-a-fresh-session message
npm run prompt -- deliver                                    # ...for someone running a test this week
```

**Running an actual test this week?** The website is not needed and is not finished. Go to
[`docs/PAPER-EXAM.md`](docs/PAPER-EXAM.md) — question PDF, self-grading Google Forms, one
spreadsheet, merged and colour-coded results. It works today.

`npm run convert` is a **one-time migration** for the legacy Markdown bank, not part of the
build. It refuses to overwrite an existing `questions.json`; that refusal is correct.

Run `npm run pipeline` for the current numbers rather than trusting a figure quoted here —
see House rules.

## Layout

| Path | What it is |
|---|---|
| `docs/PAPER-EXAM.md` | **Have a class this week?** PDF → Google Forms → one spreadsheet → merged, colour-coded results. Needs none of the rest |
| `docs/HANDOFF-STEPS.md` | **Start here as a human.** Step-by-step: protect the repo, build the two workspaces, run both sessions |
| `docs/REPO-LAYOUT.md` | Which repos are private vs public, where the sites get built, nested-git pitfalls |
| `START-HERE.md` | **Read first.** Routes between the three roles; the new-topic handoff protocol |
| `SPEC.md` | **The source.** Canonical TINS spec: modes, algorithms, proctoring tiers, acceptance criteria |
| `AGENTS.md` | One-page onboarding for a new LLM session |
| `HANDOVER.md` | State, work queue W1–W8, handover protocol |
| `prompts/NOTES-V1.md` | **Run first for a new topic.** Authors the domain blueprint and the study notes from your source material |
| `prompts/GENERATOR-V2.md` | Run second. Authors questions *against those notes*, as validated JSON |
| `docs/FIELD-GUIDE.md` | **Read this one.** Decisions, cross-questions, mistakes, and lessons for your next TINS project |
| `docs/FIELD-GUIDE.pdf` | Illustrated rendering of the above. Rebuild with `npm run field-guide` |
| `prompts/SPEC-AUTHOR.md` | Paste into a fresh AI session to write the SPEC.md for a new project |
| `docs/NEW-BANK.md` | The end-to-end workflow for adding a new topic |
| `docs/PUBLISHING.md` | **Publishing a built bank to the catalog** — the four filter fields and what feeds each |
| `docs/SCALING-AND-INTEGRATIONS.md` | Automating catalog discovery, and getting results into a Google Sheet |
| `scripts/fetch-registry.mjs` | Pulls every published bank's `meta.json` — list, Google Sheet, or GitHub topic |
| `.github/workflows/` | CI gate + daily catalog refresh |
| `scripts/apply-tags.mjs` | Applies an authored `tag-map.json` to a bank; never guesses a tag |
| `scripts/release.mjs` | Freezes what a cohort was examined on; `--verify` reports drift |
| `scripts/make-sets.mjs` | Splits a bank into N disjoint exam sets, ready for Google Forms |
| `scripts/make-question-pdf.mjs` | Bank → student PDF: every question, every option, why each wrong one is wrong |
| `scripts/make-form-script.mjs` | One set → one paste-and-run Apps Script. Identity fields required, marks verified |
| `scripts/consolidate-responses.gs` | Goes in the **spreadsheet**, not here. Merges every set's tab into one colour-coded sheet with charts |
| `scripts/session-prompt.mjs` | Prints the message to paste into a fresh AI session, with the real state read from disk |
| `scripts/make-workspace.mjs` | Assembles a clean folder + starting prompt for a fresh AI session |
| `scripts/find-duplicates.mjs` | Reports near-duplicate questions as the bank grows |
| `scripts/check-git-exposure.mjs` | Refuses to be silently publishable from a parent repo |
| `scripts/new-bank.mjs` | Scaffolds `content/<id>/` for a new topic |
| `scripts/validate-all.mjs` | Runs the gate over every bank in `content/` |
| `schema/question-bank.schema.json` | The one canonical format |
| `scripts/convert-qb50.mjs` | One-time migration of legacy Markdown banks. Not part of the build |
| `scripts/validate.mjs` | The gate. Exits 1 |
| `scripts/selftest.mjs` | Proves the gate fails on every known defect. Run it for the count |
| `scripts/emit-meta.mjs` | Emits the catalog record for a built bank |
| `scripts/build-catalog.mjs` | Aggregates `registry/*/meta.json` into `catalog.json` |
| `content/<bankId>/` | `questions.json` (converted), `blueprint.json` (**authored**), `notes/*.md` |
| `content/taxonomy.json` | Controlled tag vocabulary |
| `source/` | Original authored Markdown, kept for provenance |
| `docs/AUDIT-set5.md` | Measured audit of the v1 generator output — the evidence behind every validator rule |
| `docs/PIPELINE.md` | Map of the four legacy tools and the disposition of each |
| `docs/SOURCE-MATERIAL.md` | Where the notes and weights came from, and the currency defects found in the source |
| `docs/INSTRUCTOR-CONTEXT.md` | Who the material is for, how they work, and the standing credential-handling instruction |
| `scripts/scan-secrets.mjs` | Build gate: refuses to ship content containing credentials |
| `docs/OPEN-QUESTIONS.md` | What is still blocked, and on whom |

## House rules

- **One canonical spec.** Spec changes precede code changes.
- **JSON is the artifact.** Prose is a rendering. Only one parser exists, and it is a
  migration tool, not a build step.
- **Metadata is authored, never inferred.**
- **The validator is the arbiter.** A bank that fails does not get built.
- **Nothing in the product claims the exam is secure or cheat-proof.** Fullscreen cannot
  be enforced; camera signals are advisory. See SPEC.md D4–D6.
- These are practice questions modelled on exam *concepts*. Real exam items are never
  reproduced.
