# Prompt: FRONTEND-VISION-INTERVIEW (the frontend design-vision interview + library-selection pass)

> **The shared interview an LLM session runs whenever a TINS project needs a frontend
> visual direction chosen.** It is never run standalone — it is opened and run from one
> of two trigger points:
>
> 1. **`prompts/SPEC-AUTHOR.md`** — after its 7-question interview, when the new project
>    being spec'd is a website. (See SPEC-AUTHOR.md's post-Q7 step.)
> 2. **`prompts/FRONTEND-REFRESH.md`** — as its core interview step, when refreshing the
>    frontend of an existing tins-kit-built website. (See FRONTEND-REFRESH.md Step 2.)
>
> Both trigger points read this file and run it in place; the content is never
> duplicated into either caller (D4 — supporting context is referenced by absolute
> path, not copy-pasted).
>
> **Source:** the kit's D28 (§0.2) — the "existing tins-kit website gets a frontend
> refresh, survey-first" requirement, and the interview session that chose the 5
> reference libraries: [anime.js](https://animejs.com/), [Motion](https://motion.dev/)
> (formerly Framer Motion), [Kokonut UI](https://kokonutui.com/),
> [Bklit UI](https://bklit.com/), and [shadcn/ui](https://ui.shadcn.com/).

---

## The prompt

```
You are running the frontend design-vision interview. Your job: find out what the
user wants the site to look and feel like, lock in which of the kit's 5 reference
libraries apply and how, and get sign-off BEFORE any visual/frontend code changes.

Do not skip this because "the user is in a hurry." An unapproved vision guess is
the single most expensive kind of rework in a frontend project — you'll redo the
whole visual layer once the user actually sees it.

---

## Part 1 — Survey the user (ask, wait for answers)

1. **Do you already have a visual direction in mind?** Colors, mood, an existing
   brand, or specific sites you like the look of. If yes, get real links or hex
   codes — not "make it look modern," which means nothing.
2. **What's the domain / field this site serves?** (e.g. B2B SaaS dashboard,
   consumer fintech, a portfolio, a nonprofit's donation page.) This is what
   Part 2's research is anchored to if the user is unsure.
3. **Who's the primary audience, and what should they feel using it?**
   Trustworthy and calm (finance, healthcare)? Playful and fast (consumer,
   gaming)? Minimal and technical (dev tools)? Push for one answer, not three.
4. **Any existing brand constraints that must carry over?** Logo, locked colors,
   locked fonts, accessibility commitments already made to users. These are
   hard constraints on Part 3, not suggestions.
5. **What mode is this project in right now** — Demo, Pilot, or Production (per
   `PIPELINE.md` / the project's own `HANDOVER.md`)? This determines what the
   post-build verification (Part 4) can actually check: a Mode A project has no
   real backend to verify against yet, and that's expected, not a blocker.

## Part 2 — If the user is unsure (the research fallback)

If the answer to Q1 is "I don't know, you decide" or similarly open: **do not
guess silently.** Search the web for modern, technically impressive site designs
relevant to the domain named in Q2. Bring back 3–5 real, named, linked examples,
each with one line on why it fits and one line on how it would need to differ for
this project (different domain specifics, different audience, different content
shape). If nothing is a close match, say so plainly and present the closest one
anyway — a labeled "closest match, here's the gap" is still useful; a silent
best-guess is not.

Present the candidates and ask the user to pick one, blend two, or reject all and
describe what's still missing. This is the "before" half of the two-fold
definition of done (Q6 in `SPEC-AUTHOR.md` / the retro-fit's own vision check):
the user gets to see roughly where this is headed before a line of frontend code
changes.

## Part 3 — The library-selection pass

For each of the kit's 5 reference libraries, decide **install** (wire it in
directly) or **recreate** (use it as a visual reference, hand-build the pattern
in the target stack's native markup/styling) — based on the target project's
actual frontend stack, detected or stated. Never copy a foreign framework's
component source wholesale into a different framework; that produces code
nobody in the target stack can maintain.

| Library | What it is | Install path | Stack fit |
|---|---|---|---|
| **anime.js** (v4.x) | Framework-agnostic JS animation engine | `npm install animejs` (or a locally-hosted `<script>` for a no-build-step site — never a 3rd-party CDN URL, per the kit's CDN-independence rule) | Any JS-capable frontend. Almost always **install**. |
| **Motion** (formerly Framer Motion; npm package is now just `motion`) | Framework-agnostic animation lib — React, Vue, vanilla JS | `npm install motion` (`motion/react` for React) | Any JS-capable frontend. Almost always **install**. |
| **Kokonut UI** | React 19 + Tailwind v4 + shadcn/ui + Motion component collection | `npx shadcn@latest add @kokonutui/<component>` — copies source in, not an npm dependency | **React + Tailwind only.** Install if the target matches; otherwise **recreate** the visual pattern in the target's own markup. |
| **Bklit UI** | A shadcn-based **charts / data-visualization** component library — NOT a general design-inspiration site, despite how it may have been described going in | Same shadcn-CLI copy-paste model as Kokonut UI | **React + Tailwind only**, and narrower in scope (charts specifically). Install if both the stack and the need (data viz) match; otherwise skip or recreate just the specific chart pattern. |
| **shadcn/ui** | The CLI/registry the two above build on | `npx shadcn@latest init`, then `npx shadcn@latest add <component>` — copies source in, no runtime CDN dependency | **React + Tailwind only.** Install if the target matches; otherwise **recreate**. |

The install path for all 5 is copy-in or npm-install — none of them require a
3rd-party CDN at runtime once wired in, which satisfies the "we are not
dependent on their CDN" requirement from the interview that produced this
prompt. Re-verify these facts with a web search if this file is more than a
few months old — library CLIs and package names do drift (Motion's own npm
package name changed from `framer-motion` to `motion`; expect more of that).

For each library, write one line: which decision, and why (stack match /
mismatch, cited). This becomes part of `FRONTEND-VISION.md` (below) — it is
the record a future session reads instead of re-deriving the same research.

## Part 4 — Write the artefacts, get sign-off

Write two files at the target project's root. They are deliberately separate —
one is **authored** (human judgement, never silently overwritten by a script),
the other is **derived** (machine-computed, safe to regenerate):

**`FRONTEND-VISION.md`** (authored — a script must never overwrite this):

```yaml
vision:
  source: user-described | researched   # which path Part 1/2 took
  domain: <the field from Q2>
  inspiration_sites:
    - url: <real link, only if Part 2 ran>
      note: "closest match because X"
      gaps: "differs in Y, Z"
  approved_before: false   # user sign-off on the vision + inspiration, PRE-build
libraries:
  - name: anime.js | motion | kokonut-ui | bklit-ui | shadcn
    decision: install | recreate
    reason: "<stack match/mismatch, cited>"
mode_at_survey: A | B | C   # from Q5 — what the after-check can verify against
approved_after: false      # user sign-off POST-build: frontend verified against
                            # whatever backend/DB/3rd-party services are actually
                            # wired at the project's CURRENT mode (not a future one)
```

**`.frontend-detect.json`** (derived — a script may regenerate this any time):
the target stack's detected framework, language, styling approach, and build
tool, with a confidence score. Sniff `package.json` / lockfiles for
React/Vue/Svelte/Next/Nuxt/Astro signatures, or `requirements.txt` /
`manage.py` for Django, `Gemfile` for Rails, `*.csproj` for .NET, or the
absence of any manifest plus `.html`/`.css`/`.js` files for a plain static
site. This is what Part 3's "stack fit" column is evaluated against.

**Do not proceed to any code change until `approved_before` is true.** Show the
user both files (or at minimum the vision + library table) and get explicit
sign-off. `approved_after` is set later, by whichever prompt called this one,
once the build is done and verified (see that prompt's own verification step —
scoped to `mode_at_survey`, not to some future finalized backend that may not
exist yet).

---

## When you finish this interview

Hand control back to whichever prompt opened this file:
- If called from `SPEC-AUTHOR.md`: continue to that prompt's A/B/C pass, then
  draft `SPEC.md` as normal — `FRONTEND-VISION.md` is additional input to §2
  and §5 (style guide).
- If called from `FRONTEND-REFRESH.md`: continue to that prompt's Step 3
  (spec first, code second).
```

---

*— End of `FRONTEND-VISION-INTERVIEW.md` prompt. See also: `prompts/SPEC-AUTHOR.md`
(new-website trigger point), `prompts/FRONTEND-REFRESH.md` (existing-project trigger
point), `prompts/INTERVIEW-CHECKLIST.md` (the website-check entry that fires this).*
