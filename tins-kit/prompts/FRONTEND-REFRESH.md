# Prompt: FRONTEND-REFRESH (the generic copy-paste prompt for refreshing an existing tins-kit website's frontend)

> **The prompt you paste into a fresh LLM session — or that `CONTINUE-TINS-PROJECT.md`
> hands off to — when you want to refresh the visual frontend of an existing
> tins-kit-built website, in ANY frontend framework or language.** The project already
> exists, already works, and its backend/database/business logic are untouched by this
> workflow. Only the visual and interaction layer changes.
>
> **Source:** the kit's D28 (§0.2) — "an existing tins-kit website can get a frontend
> refresh, survey-first, using the 5 reference libraries." Companion to:
> - `prompts/CONTINUE-TINS-PROJECT.md` (Scenario 3: the general "pick up a W" prompt;
>   routes here when the W is a frontend visual redesign)
> - `prompts/FRONTEND-VISION-INTERVIEW.md` (the shared design-vision interview this
>   prompt runs as its Step 2 — not duplicated here, per D4)
>
> The project must already be a TINS project (has its own `SPEC.md` + `HANDOVER.md`,
> kit vendored at `./tins-kit/`). If it isn't, that's `prompts/PROMOTE-TO-TINS.md`'s
> job first, not this prompt's.

---

## The prompt

```
You are refreshing the frontend of an existing tins-kit website. Your working
directory is $PWD, the project root ($PWD expands to the absolute path the user
gives you). The kit is vendored at ./tins-kit/.

This is a FRONTEND-ONLY change. You do not touch the backend, the database schema,
business logic, or add new product features — the site keeps doing exactly what it
does today, it just looks and feels different. If the user asks for a new feature
mid-refresh, that's a separate W; note it in HANDOVER.md and come back to it later.

---

## The 7 steps (do them in this order)

### Step 0 — Confirm your location and detect the stack

```bash
pwd
ls -la
ls tins-kit/    # confirm the kit is vendored here
cat HANDOVER.md | head -20   # confirm this project's current mode (A/B/C)
```

Detect the frontend stack before anything else: sniff `package.json` /
lockfiles for React, Vue, Svelte, Next.js, Nuxt, Astro; `requirements.txt` +
`manage.py` for Django; `Gemfile` for Rails; `*.csproj` for .NET; or, if none
of those exist, plain `.html` / `.css` / `.js` files for a static site. Write
this out as `.frontend-detect.json` (derived — see
`prompts/FRONTEND-VISION-INTERVIEW.md` Part 4 for the exact shape). This is
what decides, per library, whether Step 4 installs or recreates.

If `tins-kit/` is missing, the user forgot to vendor it. Tell them to run
`node /path/to/tins-kit/scripts/kit-sync.mjs --to=./tins-kit`.

### Step 1 — Read these files, in this order

| # | File | Why |
|---|---|---|
| 1 | `tins-kit/INDEX.md` | The selective-chooser |
| 2 | `tins-kit/PIPELINE.md` | The 7-step universal methodology |
| 3 | This project's `SPEC.md` | What the project is and does today (do not redesign this) |
| 4 | This project's `HANDOVER.md` | The current mode (A/B/C) and W-queue |
| 5 | This project's `BUILDER-DECISIONS-REVIEW.md` (if any) | Prior decisions this refresh must respect |

### Step 2 — Run the design-vision interview

Open `tins-kit/prompts/FRONTEND-VISION-INTERVIEW.md` and run it now. Do not
improvise the survey questions here — that file is the single source for
them (D4). It produces `FRONTEND-VISION.md` (authored) and
`.frontend-detect.json` (derived) at the project root, and gets the user's
`approved_before` sign-off on the visual direction.

**Do not proceed to Step 3 until `approved_before: true`.**

### Step 3 — Spec first: amend this project's SPEC.md

Add a new §-section (or a W-scoped subsection, matching this project's own
numbering) documenting the refresh:

- The chosen vision + inspiration links (from `FRONTEND-VISION.md`).
- The per-library install/recreate decisions + reasons.
- Out of scope for this W: no backend/API/schema/business-logic changes; no
  production deployment (this refresh is built and verified on localhost —
  deploying it live is a separate, later step); no libraries beyond the 5 in
  `FRONTEND-VISION-INTERVIEW.md` without a kit-growth decision.
- The acceptance criterion for this W: `approved_before` true AND
  `approved_after` true (see Step 5 — scoped to the project's current mode).

If the project has its own validator, re-run it:

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
```

### Step 4 — Build: install where the stack matches, recreate where it doesn't

Per the `FRONTEND-VISION.md` library table:
- **anime.js / Motion** — almost always `npm install` (or a locally-hosted
  script for a no-build-step site). These are framework-agnostic; they work
  in nearly any target.
- **Kokonut UI / Bklit UI / shadcn** — `npx shadcn@latest add ...` ONLY if
  the detected stack is React + Tailwind. On any other stack: use the
  library's components as a *visual reference* and hand-build the pattern in
  the target's own markup/styling/component model. Never copy JSX/Tailwind
  source wholesale into a non-React, non-Tailwind project.

None of the 5 libraries require a 3rd-party CDN at runtime once installed or
recreated — that independence was a hard requirement going in. If you find
yourself reaching for a `<script src="https://...">` tag pointed at someone
else's CDN, stop; self-host the file instead.

### Step 5 — Verify, scoped to the project's current mode

The "after" acceptance check is scoped to whatever's actually wired **today**,
per `mode_at_survey` in `FRONTEND-VISION.md` — not to a future finalized
backend that may not exist yet:

- **Mode A (Demo):** verify the new frontend correctly renders and interacts
  with the project's seeded/mock data flow, exactly as it did before the
  refresh, just with the new visual layer.
- **Mode B/C (Pilot/Production):** verify the new frontend correctly links to
  the real backend, database, and any third-party services, to the user's
  satisfaction.

Get the user's `approved_after` sign-off and set it `true` in
`FRONTEND-VISION.md`.

**If the project was in Mode A (or early Mode B) at survey time and the
backend/DB later finalizes:** this refresh is still done — don't hold it open
waiting for a backend that isn't ready. Instead, log a follow-up W in
`HANDOVER.md`: "re-verify frontend against finalized backend," so a later
session picks it up once there's something real to verify against.

### Step 6 — Record decisions, update HANDOVER.md

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="Frontend refresh: <library> install vs. recreate" \
  --context="<the stack detected, the mismatch if any>" \
  --decision="<install | recreate, and why>" \
  --alternatives="<other library considered> (rejected: <reason>)" \
  --consequences="<what this enables>; <what this forecloses>"
```

Update `HANDOVER.md`: mark the W `✅ DONE` (or `🔶 PARTIAL` if a
finalized-backend re-verify W was logged per Step 5), add the follow-up W if
any, update the state snapshot.

### Step 7 — Mine learnings, leave the gate green

```bash
node tins-kit/scripts/kit-extract.mjs --consumer=.
# → produces ./kit-growth-candidates.md; exits 1 if there are candidates
node tins-kit/scripts/validate.mjs --spec=SPEC.md
```

If `kit-extract.mjs` exits 1, the next kit-growth session at the kit root
will triage the candidates (e.g. a new library that keeps recurring becomes
a candidate for the kit's reference list).

---

## What you do NOT do (out of scope for this prompt)

- **Backend, API, database schema, or business-logic changes.** This is a
  frontend-only workflow. A feature request mid-refresh is a separate W.
- **Production deployment.** The refresh is verified on localhost; shipping
  it live is a later, separate step.
- **Adding libraries beyond the 5** without going through the kit's growth
  loop — that's how the kit decides what belongs in the reference list, not
  an ad hoc per-project choice.
- **Automated visual grading.** Inspiration-site matches in
  `FRONTEND-VISION-INTERVIEW.md` Part 2 are human-approved, never
  pixel-diffed automatically.

---

## When you get stuck

1. Re-read `tins-kit/prompts/FRONTEND-VISION-INTERVIEW.md` — most stuck
   points are "the vision isn't locked yet."
2. Re-read this project's `HANDOVER.md` for the current mode — it decides
   what Step 5 can verify.
3. If a library's install path has drifted (CLI renamed, package renamed),
   re-verify with a web search before proceeding — `FRONTEND-VISION-INTERVIEW.md`
   Part 3 says the same.
4. If the W turns out to need a backend/schema change too, stop, tell the
   user this exceeds the frontend-refresh scope, and hand off to
   `prompts/CONTINUE-TINS-PROJECT.md`'s general W flow instead.

---

## What success looks like

1. The user gives you an existing tins-kit website + "refresh the frontend."
2. You detect the stack and read the project's context (Step 0–1).
3. You run the shared design-vision interview and get `approved_before`.
4. You spec the refresh first, then build it (install where the stack
   matches, recreate where it doesn't).
5. You verify against whatever's actually wired at the project's current
   mode, and get `approved_after`.
6. You record decisions, update HANDOVER.md, mine learnings, leave the gate
   green.
7. The site looks and feels new. It does exactly what it did before.

Begin with Step 0.
```

---

*— End of `FRONTEND-REFRESH.md` prompt. See also: `prompts/CONTINUE-TINS-PROJECT.md`
(routes here for frontend-visual W's), `prompts/FRONTEND-VISION-INTERVIEW.md` (the
shared interview this prompt runs), `INDEX.md` (the selective-chooser).*
