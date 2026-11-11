# `manual-relay-worker-loop` — kit pattern

> **The recipe for D32's auditor/worker split when the worker's tool has no CLI/API hook to
> script against** — a GUI desktop app, not a headless CLI. A human relays a tight,
> `WORKER-SESSION.md`-shaped brief into the tool by hand instead of `scripts/orchestrate.mjs`
> shelling out to it, and the auditor verifies independently rather than trusting the worker's
> own report — same discipline as a scripted dispatch, manual transport only.
>
> **Source:** Jayshankar, a single real 4-task round (T1–T4, `BUILDER-DECISIONS-REVIEW.md`
> decisions #31, #33, #34, #35) using MiniMax M3 via the MiniMax Coder desktop app as the
> worker. **Second consumer confirmed 2026-09-10: EduPlay v2** — same pattern, same MiniMax
> Coder worker shape, reported via a direct cross-session message from EduPlay v2's own auditor
> rather than a formal `kit-staging/inbox/` export. EduPlay v2 hit a harder DrvFs/`chmod` failure
> mode than Lesson 1 originally documented while independently verifying a worker-returned task
> (see the addendum below); Jayshankar's auditor independently checked its own mount before the
> correction was folded into this file. The 2-consumer bar this file's own §3 asked for is now
> met; treat the lessons below as pattern-level, not a single-run observation.

---

## 0. Why this exists

D32's auditor/worker split assumes one of two dispatch mechanisms: `auditor-remote`
(`scripts/orchestrate.mjs` shells out to the worker via a `workerCmd` CLI invocation) or
`self-parallel` (the user personally opens a session and pastes the full
`CONTINUE-TINS-PROJECT.md` prompt, letting that session self-direct through the normal pipeline).
`EXECUTION-MODE-INTERVIEW.md` itself names the deciding factor for `self-parallel` as "their
other platforms are chat interfaces rather than CLIs the auditor could invoke" — but its own
documented default response to that case (the full `CONTINUE-TINS-PROJECT.md` hand-off) assumes
the other session is a peer-strength model trusted to scope its own work.

That assumption is wrong exactly when it matters most: the whole reason to use a second, cheaper
model as the worker is cost — and `templates/ORCHESTRATION.json`'s own note about
`auditor-remote` applies just as much here even though this isn't that track: *"a weaker worker
model needs a tighter brief and a narrower task, and it fails subtly and confidently rather than
loudly."*

This pattern is the missing middle: `self-parallel`'s dispatch mechanism (no script, a human is
the relay) combined with a `WORKER-SESSION.md`-shaped brief (one task, an explicit touched-file
list, mechanically-checkable acceptance criteria, an interface contract, a stated tier policy) —
not the mode's normal loose hand-off. The worker still gets the real repo, real `SPEC.md`, full
continuity (this is still self-parallel, nothing is scrubbed) — only the brief's *shape* borrows
from the auditor-dispatched track.

---

## 1. The 3 lessons, in detail

### Lesson 1 — restate the environment mismatch in every single brief, not once

When the auditor and worker run in genuinely different environments sharing one physical
filesystem — the concrete case: WSL2 mounting a Windows path, the worker (Windows-native tool)
sees `C:\Users\...`, the auditor (Claude Code in WSL2) sees `/mnt/c/Users/...`, same bytes on
disk — say so plainly in *every* task brief, not as a one-time setup note the worker session
never sees again. Concretely, in the Jayshankar run: `node_modules` is physically shared and
platform-specific (native-binary packages like `esbuild`/`Rollup` ship per-OS prebuilt
binaries). Whichever side last ran `npm install` determines which OS's binaries are present —
and it silently broke the other side's dev server (`Cannot find module
@rollup/rollup-linux-x64-gnu`) the very first time it came up, exactly as predicted once someone
thought to predict it. **Standing rule this run converged on: the auditor runs a fresh
`npm install` before verifying anything that touches a shared, platform-sensitive artifact,
every round, not reactively after something breaks.**

**Addendum from the second consumer (EduPlay v2): the standing rule above can fail outright, not
just intermittently, depending on the mount — check which case you're in before trusting either
outcome.** Jayshankar's WSL2 mount (`/mnt/c`, `mount | grep /mnt/c` shows `9p ... aname=drvfs`)
turned out to support `chmod` fine — confirmed directly with a `touch`+`chmod` round-trip on the
live project path, not assumed from the mount string alone, since the metadata-support flag isn't
always visible as an explicit option token. That's *why* Jayshankar's original failure mode was
"wrong OS's binary present, fixable by re-running `npm install`" rather than something worse.
EduPlay v2's mount (`/mnt/d`, same `9p`/`drvfs` fstype) does **not** support `chmod` at all —
reproduced directly, a bare `chmod` on a test file returns `Operation not permitted`. On that
kind of mount, `npm install`'s bin-linking step and any native-module rebuild (`better-sqlite3`
here, the same category as Jayshankar's esbuild/Rollup) fail unconditionally, every time,
regardless of which OS last touched `node_modules` — a harder failure than Lesson 1 originally
documented, not a variant of it. Same mount type, two different real outcomes. **Before relying
on the standing rule above, verify which case applies with a real `touch`+`chmod` round-trip on
the actual project path** — don't infer it from the mount type (`9p`/`drvfs`) alone, since that's
shared by both cases; and if `chmod` fails, the standing rule's recovery step doesn't apply.
Recovery that worked instead: install into a copy on a genuinely native filesystem (e.g. the
auditor's own scratchpad, real ext4) via `npm ci`, verify runtime behavior there, then `cp -r`
the resulting `node_modules` back onto the DrvFs path — a plain `cp` succeeds on this mount; only
`chmod` and in-place native rebuilds don't. Follows from this: **never `rm -rf node_modules` in
place on a DrvFs mount expecting a plain `npm install` to regenerate it, until you've confirmed
which case you're in** — on a non-metadata mount that leaves the project with no working
`node_modules` and no same-directory recovery path.

### Lesson 2 — an independent functional check catches what a diff-plus-gate review can't

T3 (Jayshankar decision #34) is the clean case study: the worker's diff was exactly as specified,
and the project's structural gate (`validate.mjs`) was green — and the feature still didn't
work. Root cause was a pre-existing TanStack Query `queryKey` collision invisible from reading
the touched file alone (a *sibling* component silently won a shared cache key). It only surfaced
because the auditor actually ran the app and looked, rather than trusting "the diff is correct
and the gate is green" as sufficient. Once found, it was also confirmed live on a *second* page
via the same check — a claim ("this bug is probably elsewhere too") that a code-only review
would have had to leave as a guess.

**Confirmed again by EduPlay v2:** a worker task returned reporting "8/8 acceptance criteria,
gate green." EduPlay v2's auditor re-verified independently anyway and found a real schema
defect (2 required columns missing from a database table) that the worker's *own* verification
script never checked for — a more-thorough-looking self-report is still a self-report, not
independent confirmation. The fix pass had to correct both the code and the checker.

### Lesson 3 — the tight brief format works even when dispatch is manual, not scripted

All 4 Jayshankar tasks used the exact placeholder structure `WORKER-SESSION.md` defines for a
*scripted* auditor-dispatch (`{{TASK_ID}}`, `{{TASK_BRIEF}}`, `{{TOUCHED_FILES}}`,
`{{ACCEPTANCE_CRITERIA}}`, `{{INTERFACE_CONTRACT}}`, `{{TIER_POLICY}}`), filled in by hand and
pasted by the user rather than substituted by `scripts/orchestrate.mjs`. Every task returned a
correct, in-scope diff on the first pass (one task needed an auditor-side fix for a *pre-existing*
bug the task exposed, not one it introduced). The brief's rigor, not the dispatch mechanism, is
what made a cheaper model produce reliable, narrowly-scoped output — worth defaulting to this
shape any time the worker is a materially weaker/cheaper model, even inside `self-parallel`
proper.

---

## 2. The 3 known anti-patterns

1. **Trusting a worker's self-reported verification without independently re-running it.** The
   single most load-bearing discipline in this whole loop. A worker that reports "gate green,
   criteria verified" can still be wrong for structural reasons invisible from its own vantage
   point (lesson 2) or environmental reasons that mask a real problem (lesson 1) — self-report
   and independent confirmation are different claims, always re-derive the second.
2. **Using the mode's default loose hand-off for a worker that isn't peer-strength.** Pasting
   the full `CONTINUE-TINS-PROJECT.md` prompt and letting a materially cheaper/weaker model scope
   its own work invites exactly the "fails subtly and confidently" failure mode
   `ORCHESTRATION.json` warns about for `auditor-remote` — the warning applies here too, dispatch
   mechanism aside.
3. **Skipping the auditor's own environment reset before verifying a shared, platform-sensitive
   artifact.** "The worker's build succeeded" and "the auditor's build will succeed" are
   different claims the moment the two environments diverge (lesson 1) — verify from a state you
   actually reset, not one you're assuming is still valid.
4. **Assuming all DrvFs mounts behave the same way (lesson 1's addendum).** `9p`/`drvfs` in
   `mount`'s output tells you the mount *type*, not whether it supports `chmod` — two consumers
   of this pattern hit both cases on ostensibly-similar WSL2 setups. Verify with an actual
   `touch`+`chmod` round-trip on the real project path before trusting either the standing
   `npm install` rule or a `rm -rf node_modules` recovery attempt.

---

## 3. When this pattern changes

If the worker tool ever exposes a genuine CLI/headless mode, re-classify the round as
`auditor-remote` and use `scripts/orchestrate.mjs`'s scripted dispatch instead of a human relay
— that removes the manual-copy-paste step this pattern exists to work around.

**2-consumer validation met (2026-09-10):** EduPlay v2 confirmed lessons 1–3 generalize and
surfaced the harder DrvFs failure mode folded into lesson 1's addendum above and anti-pattern 4,
confirmed independently on each project's own mount rather than assumed from one side alone.
Next revisit: if a third consumer surfaces a lesson that contradicts rather than extends these
(e.g. a case where the tight-brief format in lesson 3 *doesn't* hold up against a weaker worker),
that's the point to reconsider this file's confidence level, not before.

---

*— End of `manual-relay-worker-loop` pattern. See also: `prompts/WORKER-SESSION.md` (the brief
shape this borrows), `prompts/EXECUTION-MODE-INTERVIEW.md` (`self-parallel` vs `auditor-remote`),
`lib/patterns/tiered-escalation.md` (the T0/T1/T2 rules this pattern's briefs still apply),
`templates/ORCHESTRATION.json` (the capability-asymmetry warning this pattern generalizes beyond
its original scope).*
