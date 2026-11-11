# Pattern: Private to Public — Shipping a TINS Workspace Without Leaking Methodology

> **Audience:** TINS consumer whose app is ready to ship publicly but whose workspace still has methodology-internal docs (AGENTS.md, HANDOVER.md, BUILDER-DECISIONS-REVIEW.md, SPEC.md, tins-kit/, archive/, probe scripts, etc.) and whose comments and docs still read as LLM-authored.

> **What this pattern gives you:** a repeatable workflow for producing a public-ready sibling folder from a private working copy — files copied and filtered, methodology references and LLM-authorship fingerprints scanned out of the ENTIRE copied tree (not just a handful of known files), and public-facing documentation written to survive real technical scrutiny, not just to look tidy.

> **What this pattern does NOT do:** write a SPEC.md, run the validator, or replace the kit's templates. Those are upstream — this pattern assumes your validator is already green. It also does not decide whether a project ships publicly at all — that decision is recorded upstream, in SPEC.md §0.2 (`Public release intended: TRUE/FALSE`), asked as question 8 of the `SPEC-AUTHOR.md` interview, and the packaging itself is triggered by `prompts/PUBLISH-OPEN-SOURCE.md`. This pattern is the mechanics that prompt delegates to.

---

## 0. Why this exists

A TINS workspace accumulates methodology-internal artefacts over its life: `tins-kit/` (the kit), `archive/` (reference projects), `AGENTS.md` and `HANDOVER.md` (LLM-session onboarding), `BUILDER-DECISIONS-REVIEW.md` and `REVIEWER-DECISIONS-REVIEW.md` (decision logs), and various probe scripts and v0.dev exports. None of these belong in a public repo. The first time a consumer hits "ship publicly" (Jayshankar Mode A release, 2026-08-13), the process was ad-hoc: ~2 hours of `robocopy` + `sed -i` + manual `.gitignore` patching, with the constant fear of accidentally committing a secret. This pattern is the fast alternative: a 10-step workflow and a real, zero-dependency Node script (`scripts/private-to-public.mjs`) that does the copy and the leak scan in one command.

The success bar is not "no TINS-shaped strings appear in a `grep`." It's higher: **could a skeptical engineer who has never heard of this methodology read the public docs, study the code, and genuinely explain or re-implement pieces of it?** A repo that merely lacks the word "TINS" but reads as generated, hand-wavy, or thin under real scrutiny has not been released properly — it's been hidden, not published. That is why this pattern covers three things together, not one: what gets copied, what gets scanned out, and how the surviving documentation is written.

The pattern assumes your `scripts/validate.mjs` is already 100% green before shipping. It is *not* a substitute for the validator; it is the *release half* of the workflow that the validator gates.

### 0.0 Cheapest version that would work

A shell script (no Node dependency) that does five things:

1. Creates a sibling folder with `mkdir`
2. Runs `cp -r src supabase public package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json netlify.toml tailwind.config.ts postcss.config.js docs/` into it
3. Removes `archive/`, `tins-kit/`, `node_modules/`, `dist/`, `dev-dist/`, `.env*`
4. Runs `grep -ril` for a handful of known giveaway strings (`TINS`, `tins-kit`, `Claude`, `AGENTS.md`) and manually fixes any hit
5. Initializes git, commits, deploys

That is the cheapest viable version. It works on macOS, Linux, and WSL. On Windows-native cmd.exe it does not (no `grep`/`sed`); there use the Node-script variant in section 4. Its main weakness versus the full version: `grep` for four strings catches the obvious cases, not the whole-tree, every-file-including-comments sweep the real script does — treat the cheap version as a stopgap for a one-off demo, not for a project someone will actually study.

The full version below buys a cross-platform zero-dependency Node script with proper copy logic, a whole-tree leak scan (methodology fingerprints AND LLM-authorship fingerprints), and a self-test.

### 0.1 What this document is

This is a **kit-level pattern** in the tins-kit `lib/patterns/` collection. Other patterns in this collection:

- `client-side-aggregation.md` — when to compute totals in JS vs. SQL
- `empty-states.md` — 3-tier empty-state rubric
- `postgres-mutations.md` — SECURITY DEFINER + FOR UPDATE recipe
- `pwa-offline-graceful.md` — 3-layer offline recipe
- `supabase-auth-trigger.md` — first-user-is-admin pattern

This pattern (`private-to-public.md`) is **the missing piece**: how to ship the finished product of any TINS project. The other patterns tell you how to _build_ the app; this one tells you how to _release_ it.

It supersedes the equivalent ad-hoc workflow captured in `Jayshankar/FRONTEND-OVERHAUL.md` (the Jayshankar consumer's local plan) by extracting the reusable parts.

**Not the same thing as `prompts/RELEASE-CHECKLIST.md`.** That prompt is the pre-deploy production-safety gate for a SAME-REPO release — no console.log, no TODOs, no localhost URLs, a staging soak, an observability check. It never produces a second, scrubbed repo, and it doesn't care whether the code reveals its own methodology. This pattern is a different concern entirely: producing a second, public-facing sibling copy of the repo, scrubbed of methodology and LLM-authorship fingerprints, with its own documentation. A project can pass `RELEASE-CHECKLIST.md` and still not be ready for this pattern (it's fine to deploy privately without ever open-sourcing it), and a project going through this pattern should already have passed `RELEASE-CHECKLIST.md` for its private deploy.

---

## 1\. When to use this pattern

Use this pattern when **all** of the following are true:

- Your validator (`scripts/validate.mjs`) is green
- Your selftest (`scripts/selftest.mjs`) is green
- Your app builds cleanly (`npm run build` exits 0)
- You want to ship the app publicly (GitHub, GitLab, Bitbucket, Netlify, Vercel, etc.), as open source, a portfolio piece, or teaching material
- Your workspace has methodology-internal docs, and possibly LLM-authorship traces in comments or prose, that should NOT be in the public repo

If you don't have all of these, this pattern won't help. Fix the upstream issues first. If you're running this pattern as part of `prompts/PUBLISH-OPEN-SOURCE.md`, that prompt already checks these before it hands off here.

**If `SPEC.md` §0.2 records `Public release intended: FALSE`** (or the project predates that question), this pattern still works — it just costs more. The whole-tree scan in step 2 below still finds every leak mechanically; you don't need day-one discipline for the scan to work. What day-one discipline buys is a *shorter list of leaks to fix by hand*, because comments and decision entries were already written with a public reader in mind.

---

## 2\. The workflow (10 steps)

### Step 1: Decide the sibling folder name

The clean folder sits next to your working folder. Convention:

/projects/myapp/ ← private working copy /projects/myapp-public/ ← public-ready sibling

### Step 2: Copy and scan in one command

Run the real script, not a hand-rolled `cp`/`sed`:

```bash
node tins-kit/scripts/private-to-public.mjs /projects/myapp /projects/myapp-public --name="My App"
```

This does two things in one pass:

1. **Copies** the files that belong in public, per the include/exclude table below, rewriting the TINS marker-line comment as it goes (a mechanical substitution, not a methodology scrub — see the note under the table).
2. **Scans the entire destination tree** — every copied file, every line, including in-line code comments — for two kinds of leak: methodology fingerprints (kit file names, kit-specific terms) and LLM-authorship fingerprints (mentions of the model or vendor that generated the code, leftover assistant-speak like "as an AI" or "Certainly!"). It refuses to call the copy safe if it finds either kind, and exits non-zero.

What copies, what stays private:

| Source (private) | Destination (public) | Notes |
| --- | --- | --- |
| `src/**` | `src/**` | Always include |
| `public/**` | `public/**` | Always include |
| `supabase/migrations/**` | `supabase/migrations/**` | Always include |
| `supabase/rls-policies.sql` | `supabase/rls-policies.sql` | Always include |
| `supabase/seed.sql` | `supabase/seed.sql` | Include unless it has fake data only |
| `package.json` | `package.json` | Always include |
| `package-lock.json` | `package-lock.json` | Always include |
| `vite.config.ts` | `vite.config.ts` | Always include |
| `tsconfig.json` | `tsconfig.json` | Always include |
| `tailwind.config.ts` | `tailwind.config.ts` | Include if you use Tailwind |
| `postcss.config.js` | `postcss.config.js` | Include if you use PostCSS |
| `netlify.toml` | `netlify.toml` | Include if you deploy to Netlify |
| `index.html` | `index.html` | Always include |
| `scripts/*.mjs` | `scripts/*.mjs` | Always include (your project's own scripts, e.g. its own validate.mjs/selftest.mjs) |
| `scripts/.env.example` | `scripts/.env.example` | Always include |
| `.env.example` | `.env.example` | Always include |
| `.gitignore` | `.gitignore` | Always include (and extend it, step 7) |
| `docs/**` | `docs/**` | Include the public-facing subset |
| `LICENSE` / `LICENSE.md` | same | Always include |

What stays in the private folder (NOT copied by the script):

- `AGENTS.md`, `HANDOVER.md`, `BUILDER-DECISIONS-REVIEW.md`, `REVIEWER-DECISIONS-REVIEW.md`, `SPEC.md`, `PIPELINE.md`, `INDEX.md`, `VERSIONING.md`, `context.md` (methodology-internal)
- `tins-kit/`, `kit-staging/`, `delegation/` (the kit workspace and any delegation packets)
- `archive/` (reference projects)
- `node_modules/`, `dist/`, `dev-dist/`
- `.env`, `scripts/.env` (real secrets)
- Top-level `*.zip`, `*.svg` (one-off artifacts)
- Any internal probe scripts (e.g. `scripts/probe-db.mjs`)

**Also NOT copied, but not because they're excluded — because they're authored fresh:** `README.md` and `CONTRIBUTING.md`. See step 4. A private working README often has methodology asides ("see HANDOVER.md for context") that don't belong in front of a public reader, so the script never copies one verbatim; it's written new, directly in the destination, in the voice described in §3.

**About the marker-line rewrite:** the script replaces the doc marker comment (`<!-- TINS Specification v1.0 -->` → `<!-- {Project Name} Specification v1.0 -->`) as a purely mechanical step, the same way you'd fix a template placeholder. This is NOT the methodology scrub — it happens automatically during copy, before the scan even runs. The scrub is the whole-tree scan in the next step.

### Step 3: Fix anything the scan flags, then re-run

If step 2 exits non-zero, it printed a file:line list of what it found. For files that were COPIED from the private source, fix the issue AT THE SOURCE and re-run step 2 — never hand-edit the destination folder directly for a copied file, since the next run overwrites it anyway (same AUTHORED-vs-DERIVED discipline the kit uses everywhere: the destination tree is derived output, not a place to make judgment calls stick).

If a flagged match is a genuine false positive (a legitimate use of a word that happens to appear in the banned-terms list — rare, but possible), extend `BANNED_TERMS` or `BANNED_PATTERNS` directly in `scripts/private-to-public.mjs`, with a one-line comment explaining why, rather than silently ignoring the finding.

Repeat until the scan is clean (exit 0).

### Step 4: Write the public-facing docs, in the corporate voice

Now write `README.md`, `CONTRIBUTING.md`, and the `docs/` files described in §3 — directly in the destination folder. These did not come from the private copy; this is where they're born. Follow the tone requirement in §3.0 and the doc-type guidance in §3.1–§3.6 for each one.

### Step 5: Re-scan the destination now that fresh docs exist

Freshly written prose — whether a human wrote it or an LLM did, instructed to write in the corporate voice — is exactly the place a stray "as an AI," "Certainly!", or an accidental "tins-kit" reference slips back in. Re-run the scanner in scan-only mode, which does not touch the copy:

```bash
node tins-kit/scripts/private-to-public.mjs /projects/myapp-public --scan-only
```

Fix anything it finds directly in the destination docs (these ARE meant to be hand-edited there — they're authored fresh, not derived from a source file) and re-run until clean.

### Step 6: Run the quality rubric

Before moving on, hold `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/DESIGN-WALKTHROUGH.md` (if you wrote one — see §3.6) against the rubric in §3.7. The scanner proves the docs don't say the wrong things; the rubric is what proves they say enough of the right things.

### Step 7: Extend the public folder's `.gitignore`

The public folder's `.gitignore` should include everything from the private folder, plus a section for methodology-internal docs and sibling workstreams, in case any ever land there by accident:

```gitignore
# Methodology-internal docs (should never exist here, but ignore defensively)
AGENTS.md
HANDOVER.md
BUILDER-DECISIONS-REVIEW.md
REVIEWER-DECISIONS-REVIEW.md
SPEC.md

# Sibling workstreams
archive/
tins-kit/
kit-staging/
delegation/

# Top-level one-off artifacts
*.zip
*.svg
```

### Step 8: Verify the gate runs in the public folder

```bash
cd /projects/myapp-public
npm install
npm run validate    # must be green
npm run selftest    # must be green
npm run build       # must produce dist/ without errors
```

If any of these fail, fix the issues before proceeding.

### Step 9: Initialize git and commit

```bash
cd /projects/myapp-public
git init
git config user.name "Your Name"
git config user.email "you@example.com"
git add .
git status   # review what's staged
git commit -m "Initial commit — {PROJECT_NAME}"
```

### Step 10: Set up the deployment environment, deploy, and verify

For Netlify specifically:

1. Connect the public folder's git repo (or drag-and-drop the `dist/` folder)
2. Set build command = `npm run build`, publish directory = `dist`
3. **Add environment variables BEFORE the first build runs:**
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
4. **Add the secrets-scan override:**
   - `SECRETS_SCAN_ENABLED` = `false`

The last one is critical for Vite apps because Vite inlines `VITE_*` env vars into the JS bundle, which trips Netlify's secrets scanner. Without `SECRETS_SCAN_ENABLED=false`, the build will fail.

Then deploy: if using Netlify with git integration, push the commit and Netlify auto-deploys; if using drag-and-drop, run `npm run build` locally and drag the `dist/` folder (NOT the project root) onto Netlify's "Deploy" page.

Finally, open the deployed URL in an Incognito window. Sign in with your demo credentials. Verify the sign-in form renders, mutations work, and the browser console has no errors.

If the page is blank, the most common causes are:

1. Env vars weren't set before the build ran — redeploy with `Clear cache and deploy site`
2. Service worker cached an old version — open in Incognito (or DevTools → Application → Service Workers → Unregister)
3. Build failed silently — check the deploy log

---

## 3\. What goes in the public docs

### 3.0 Tone requirement: write as if a company shipped it

Every doc listed below is written in a **corporate, professional voice — as if a company's engineering or product team produced it, with no trace that an LLM was involved.** This is not decoration; it's the difference between a repo that reads as a serious engineering artifact and one that reads as a chatbot transcript with syntax highlighting. Concretely:

- No first-person LLM voice ("I've implemented...", "As an AI, I..."), no meta-commentary about the writing process, no "Let me know if you'd like me to adjust this."
- No hedging language that only makes sense from an assistant answering a prompt ("I believe this should work," "this might need adjustment"). State things plainly, the way a team confident in its own design would.
- No stock LLM openers/closers ("Certainly!", "Here's a summary of the changes", "Feel free to ask if you have questions").
- Decision write-ups (`docs/DECISIONS.md`) read like real ADRs a team debated in a review, not like a change-log a model generated after the fact.
- This voice requirement applies to docs, README, and any prose comments the public reader will encounter — not to code identifiers or structure, which stay exactly as engineered.

`scripts/private-to-public.mjs` scans for the most common LLM-authorship fingerprints mechanically (step 5 above), but the scan is a backstop, not the standard. A doc can pass the scan and still read as thin, evasive, or generated — that's a rubric failure (§3.7), not a scan failure, and only a careful read catches it.

### 3.1 `README.md`

A polished public entry point. Sections:

- One-paragraph "what this is"
- Architecture summary (stack diagram in ASCII)
- Demo credentials
- How to run locally (5 numbered steps)
- How to deploy (link to docs/DEPLOY-NETLIFY.md)
- Database schema (link to docs/SCHEMA.md, with ER diagram image)
- What's NOT in V1 (bulleted list from your spec's section 9)
- Project structure (ASCII tree, listing only public files)
- License

### 3.2 `CONTRIBUTING.md`

Developer onboarding. Sections:

- What this project is
- Repository layout (public files only)
- Set up your dev environment (5 steps)
- Coding conventions
- Adding a feature (5 steps)
- What NOT to do (6 non-negotiables)
- Testing
- Deploying

### 3.3 `docs/ARCHITECTURE.md`

Technical design rationale. Sections:

- Stack (with "why this, not alternatives" for each layer)
- Database design
- Frontend architecture
- Deployment
- What's NOT in V1 (intentional)
- Open architectural questions

### 3.4 `docs/DECISIONS.md`

ADR-style decision log. Each entry:

```
## Decision N — <title>

**Date:** YYYY-MM-DD
**Status:** Accepted

**Context.** What forces are at play?

**Considered.** What alternatives did we look at?

**Decision.** What did we choose?

**Consequences.** What's good (+) and bad (-) about this decision?
```

Adapted from the private `BUILDER-DECISIONS-REVIEW.md` entries, rewritten in the ADR shape and stripped of anything that references the kit's own tooling (decision-log.mjs, the D-numbering scheme, tins-kit).

### 3.5 `docs/SCHEMA.md`

Full table-and-RLS reference. Auto-generate from Supabase dashboard export (SQL Editor → schema → export as Markdown). Update whenever the schema changes.

### 3.6 `docs/DESIGN-WALKTHROUGH.md` (new — the deeper learnability doc)

`docs/ARCHITECTURE.md` states the design; this document explains it well enough that a competent reader who has never seen the codebase could rebuild the hard parts themselves. It exists because "no methodology fingerprints" is a floor, not the goal — the goal is that a real engineer, given time, could genuinely learn from this repo. Write one section per non-trivial subsystem (not every file — the parts where "why" isn't obvious from reading the code alone). For each subsystem, cover:

- **What problem this subsystem solves**, in plain language, before any code.
- **The approach actually taken**, walked through step by step — the way you'd explain it to a new hire on their first week, not a changelog entry.
- **At least one approach that was rejected**, and why. A walkthrough with no rejected alternatives reads as if there was only ever one possible design — which is rarely true and never instructive.
- **The trickiest bug or edge case this subsystem had to handle**, and how the current code handles it. This is usually the single most valuable paragraph in the whole document for a learner.
- **What you'd do differently building it again**, if there's an honest answer. Skip this bullet rather than force a fake one.

This document is optional in the sense that a trivial project (a single-file script) may not need it — but for anything with more than one non-trivial subsystem, its absence is itself a signal the release wasn't scrutiny-ready.

### 3.7 Quality rubric (run this before calling the release done)

The scanner in `scripts/private-to-public.mjs` proves absence — no banned string appears. It cannot prove the docs are actually good. Before considering the release finished, hold `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/DESIGN-WALKTHROUGH.md` against these questions. Answer them literally, not aspirationally:

1. **Could a competent stranger re-implement the hardest subsystem from the docs alone**, without reading the source? If the honest answer is "no, they'd have to read the code," the doc is a summary, not a walkthrough — go back to §3.6.
2. **Does every non-obvious design choice have a stated reason?** Grep the docs for unexplained adjectives ("efficient," "clean," "robust," "scalable") the same way the kit's own `SPEC-AUTHOR.md` interview does for specs — an adjective with no procedure underneath it is a gap here too.
3. **Is there at least one rejected alternative per major decision?** A decision log with only "what we did" and never "what we didn't do, and why" doesn't teach judgment — it just states an outcome.
4. **Would the docs survive a skeptical technical reviewer asking "why not X instead?"** for the three or four biggest choices in the stack? If you can't answer without opening the private `SPEC.md`, the public doc is incomplete.
5. **Does the README's "how to run locally" actually work**, followed literally, in a clean checkout? Untested setup instructions are the single most common way a public repo embarrasses its author in the first five minutes of someone else's attention.

A release that passes the scanner but fails more than one of these should go back to §3 before shipping, not ship as "good enough."

---

## 4\. The script (`scripts/private-to-public.mjs`)

The full script is a real, shipped file — `scripts/private-to-public.mjs` — not embedded here. Reading it in full is one `cat` away; duplicating it in this document would drift the moment either copy changed. This section only summarizes what it does and how to run it.

**What it does, in order:**

1. Parses `<src-dir> <dst-dir>` (or `<dst-dir> --scan-only` to re-scan an existing destination without copying).
2. Walks the source tree, filters files through the include/exclude patterns from the table in §2 Step 2, copies what belongs, and rewrites the marker-line comment mechanically as it goes.
3. Walks the ENTIRE destination tree — every text file, every line, in-line comments included, not just `validate.mjs`/`selftest.mjs` the way an earlier draft of this pattern once did — checking every line against two separate lists: methodology fingerprints (kit file names, kit-specific terms) and LLM-authorship fingerprints (model/vendor names, leftover assistant-speak), plus a small set of path-escape patterns (`../`, absolute paths, `.git/` references).
4. Prints every finding as `file:line contains "match"` and exits 1 if anything was found, 0 if the tree is clean.

**Separate, broader banned-terms list from `scripts/scan-task-packet.mjs` (D29).** The two scripts solve different problems — scanning one scoped task packet handed to one external contributor, versus scanning a whole project released to open-ended public scrutiny — and the kit deliberately keeps their lists independent (D30) rather than sharing one array, so tightening one never silently loosens the other.

**Usage:**

```bash
# Copy + scan in one pass
node tins-kit/scripts/private-to-public.mjs /projects/myapp /projects/myapp-public --name="My App"

# Re-scan an existing destination without re-copying (e.g. after writing docs by hand)
node tins-kit/scripts/private-to-public.mjs /projects/myapp-public --scan-only

# Machine-readable findings
node tins-kit/scripts/private-to-public.mjs /projects/myapp-public --scan-only --json
```

Exit codes: `0` clean (or copy succeeded and the tree is clean), `1` leaks found (do not publish yet), `2` bad usage or a given path isn't a directory.

**Self-test:** `scripts/selftest.mjs` includes cases that verify the copy filter includes/excludes the right files, that the marker-line rewrite fires, and that the scanner both catches a planted leak and stays clean on a fixture with none.

---

## 5\. Variations

### 5.1 SPA to static host (the case this pattern covers)

The default. Output is a `dist/` folder ready for Netlify, Vercel, GitHub Pages, Cloudflare Pages.

### 5.2 CLI tool to npm package

Different output: a single `dist/index.js` + `package.json` for npm publishing. Additional steps: add `bin` field to package.json, generate README from doc files, build with `tsup` or `esbuild` instead of Vite, publish to npm via `npm publish`.

### 5.3 Library to npm package

Different output: `dist/index.js` + `dist/index.d.ts` for typed consumers. Additional steps: add `exports` field with `import`/`require`/`types` conditions, generate type declarations, mark the package as `private: false` in package.json.

### 5.4 Backend service to container

Different output: a Dockerfile + production compose file. Additional steps: multi-stage build, health check endpoint, non-root user, proper secret management (not in env vars).

---

## 6\. Cross-platform notes

### 6.1 macOS / Linux / WSL

The shell script in section 0.0 works as-is. Use `cp`, `grep`.

### 6.2 Windows native (cmd.exe / PowerShell)

The shell script does NOT work (no `grep`/`sed`). Use either:

- `scripts/private-to-public.mjs` (zero-dependency, runs anywhere Node 18+ runs — this is the recommended path on every platform, not just Windows)
- WSL (run the shell script inside WSL even if your main shell is PowerShell)

### 6.3 CI environments

The script can run in CI. Add a step like:

```yaml
- name: Private to public
  run: node tins-kit/scripts/private-to-public.mjs ./myapp ./myapp-public --name="My App"
```

A non-zero exit fails the job, which is the point — a leak should block the release pipeline, not just print a warning.

---

## 7\. Worked example: Jayshankar

The Jayshankar consumer followed the predecessor of this pattern on 2026-08-13, before `scripts/private-to-public.mjs` existed as a real shipped file:

- Source: `/c/Users/user/Desktop/Jayshankar/`
- Destination: `/c/Users/user/Desktop/Jayshankar-clean/`
- Method: `robocopy` for the file copy, then hand-driven regex replaces for scrubbing (what the script now automates)
- Time: ~2 hours of human-driven work
- Outcome: 56 files committed, validator 62/62 green, selftest 7/7 green, deployed live to Netlify

The full decision log lives in `Jayshankar/FRONTEND-OVERHAUL.md` (the consumer's local plan). The reusable parts of that workflow are what this pattern captures — and what the script now does in one command instead of two hours.

---

## 8\. Common pitfalls

### 8.1 Forgetting to extend `.gitignore`

Symptom: accidentally commit `archive/`, `tins-kit/`, `.env*`. Fix: always extend the public folder's `.gitignore` with the methodology-internal section BEFORE the first `git add`.

### 8.2 Env vars set AFTER the build

Symptom: blank page on the deployed URL. The JS bundle has empty Supabase values baked in. Fix: in Netlify, set the env vars BEFORE the first deploy (or use `Clear cache and deploy site` after adding them).

### 8.3 Vite publishable keys trip Netlify's secrets scanner

Symptom: build fails with `Secret env var "VITE_SUPABASE_URL"'s value detected`. Fix: set `SECRETS_SCAN_ENABLED=false` in Netlify's env vars.

### 8.4 Service worker caching old bundle

Symptom: blank page even after fixing everything, but works in Incognito. Fix: unregister the service worker (`DevTools → Application → Service Workers → Unregister`), then hard-refresh.

### 8.5 Hand-editing the destination instead of the source

Symptom: a leak the scanner flagged keeps coming back after you "fixed" it. Cause: it was fixed in the destination folder directly, then a later re-run of the copy step overwrote the fix with the still-broken source file. Fix: for anything that was COPIED (not authored fresh — see §2 Step 4), fix it in the source and re-copy. Only the fresh-authored docs (README, CONTRIBUTING, docs/**) are meant to be edited in the destination directly.

### 8.6 Docs that pass the scanner but still read as LLM-generated

Symptom: no banned string appears, but the writing has the unmistakable shape of an assistant's answer — hedged, generic, thin on rejected alternatives, structured like a bulleted response to a prompt rather than a document a team wrote. Fix: this is what §3.7's quality rubric is for. The scanner is a mechanical floor; passing it is necessary, not sufficient. Read the docs the way a skeptical hire would on day one.

---

## 9. References

- The kit's other patterns: `client-side-aggregation.md`, `empty-states.md`, `postgres-mutations.md`, `pwa-offline-graceful.md`, `supabase-auth-trigger.md`
- The real script this pattern packages: `tins-kit/scripts/private-to-public.mjs`
- The prompt that triggers this pattern at release time: `tins-kit/prompts/PUBLISH-OPEN-SOURCE.md`
- The interview question that records intent up front: `tins-kit/prompts/SPEC-AUTHOR.md` (question 8), `tins-kit/prompts/INTERVIEW-CHECKLIST.md` (Q8)
- The Jayshankar consumer's local plan: `Jayshankar/FRONTEND-OVERHAUL.md`
- The kit's BUILDER-DECISIONS-REVIEW template: `tins-kit/templates/BUILDER-DECISIONS-REVIEW.md`

---

## When this changes

- **If the consumer adds a new artefact type** (e.g. a Python script in `scripts/` that
  should not be public): add a row to the include/exclude table in §2 Step 2, and mirror
  it in `INCLUDE_PATTERNS`/`EXCLUDE_PATTERNS` in `scripts/private-to-public.mjs`.
- **If the kit's `<!-- TINS Specification v1.0 -->` marker changes**: update
  `MARKER_REWRITE` in `scripts/private-to-public.mjs`.
- **If the consumer switches to a new hosting target** (e.g. Vercel instead of Netlify):
  re-do §10 (the deploy step) with the new platform's secrets scanner + env-var names.
- **If the kit's methodology vocabulary grows** (a new prompt, script, or template name
  that would fingerprint the methodology if it leaked): add it to `BANNED_TERMS` in
  `scripts/private-to-public.mjs`.
- **If a new LLM vendor or model name becomes a plausible authorship fingerprint**: add
  it to the LLM-authorship section of `BANNED_TERMS` in the same script.

---

_Last updated: 2026-08-21._

---

*— End of `private-to-public` pattern. See also: `pinned-deps.md` (the
manifest-in-lockstep discipline), `observability-first.md` (the deployment
runbook pattern).*
