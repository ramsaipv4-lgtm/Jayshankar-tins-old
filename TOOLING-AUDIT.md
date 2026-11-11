# TOOLING-AUDIT.md — what this work needs, what the harness has, what is missing

> Bootstrapped 2026-09-10 from `tins-kit/templates/TOOLING-AUDIT.md`, in
> support of setting up `delegation/` (Claude plans + audits, MiniMax M3
> builds). Per D33 this is meant to be a **blocking gate** — see the
> template's own framing. This instance is lighter-weight than a typical
> third-party-tool audit, though: most of the rows below are "confirm an
> environment capability actually works," not "evaluate a candidate MCP
> server" — `lib/patterns/third-party-tool-audit.md`'s 9-red-flags rubric is
> built for the latter and doesn't map cleanly onto the former. Treat the
> verdicts below as honest best-effort, not a literal application of that
> rubric.

**Audit status:** complete
**Last audited:** 2026-09-29
**Scope of this audit:** the delegation/ setup (Claude planner/auditor in
WSL2 + MiniMax M3 worker on native Windows), not the whole project — plus,
since 2026-09-29, the app's npm dependencies (the `antd` row below, added by
the Ant review deck).

---

## 1. What the harness already has

Confirmed this session (2026-09-10), Claude Code running in WSL2:

- Bash tool, Node v22.23.2 / npm 10.9.8 on PATH — confirmed by direct
  `node --version` / `npm --version` calls.
- Read/Write/Edit file tools, git (confirmed — `git init` + a commit both
  succeeded this session).
- Workflow/Agent subagent orchestration — confirmed, used repeatedly this
  session.
- The `run` skill ("launch and drive this project's app to see a change
  working," can take screenshots) — **available per the skill listing, but
  not yet actually exercised in this project.** Don't assume it works
  smoothly against this specific app (Vite dev server + Supabase auth) until
  it's been run once.

Not confirmed, and load-bearing for the delegation setup to work at all:

- **MiniMax Coder's own environment (native Windows) — Node/npm on PATH,
  ability to run this project's zero-dependency scripts
  (`node scripts/validate.mjs`, `node tins-kit/scripts/*.mjs`), filesystem
  write access to the real project path, and whether it has any sandboxing
  that would stop it editing files directly.** Claude cannot confirm this
  from WSL2 — it has to be confirmed by actually running MiniMax Coder once
  against a trivial task, or by the user checking directly.

---

## 2. What this work actually needs

- Run this project's validator/selftest/build/typecheck gate — both sides
  need this. Confirmed possible from WSL2; unconfirmed from MiniMax Coder's
  environment (see above).
- Verify a UI/behavioral change visually, when a task involves one — needs
  the `run` skill's screenshot capability, exercised for real at least once
  before relying on it for an actual audit.
- A way for the auditor (Claude) to independently re-verify MiniMax's
  returned work rather than trust its self-report — this doesn't need a new
  tool, it needs the process in `delegation/README.md` (re-run the gate,
  check every acceptance criterion, don't take "it works" at face value) to
  actually be followed every round.

---

## 3. The gap, the candidates, and the verdicts

| Capability gap | Candidate | Source | Verdict | Priority | Status | Handicap / audit note |
|---|---|---|---|---|---|---|
| Confirm MiniMax Coder (Windows) can run this project's Node scripts and has filesystem write access | n/a — environment confirmation, not a tool to install | — | SAFE | REQUIRED | installed | 2026-09-10: independently confirmed via T1 (`delegation/tasks/T1-floor-location-display-name/`) — MiniMax's diff, its self-reported gate results, and its file-scope claim all matched what the auditor found on independent re-verification. One real caveat surfaced, not a capability gap: MiniMax's `npm run build` on Windows leaves Windows-native binaries in the shared `node_modules`, which breaks the WSL2 side until `npm install` is re-run there — see `BUILDER-DECISIONS-REVIEW.md` decision #31. Not blocking, just something the auditor must do every round. |
| Visual verification via the `run` skill | `run` skill (first-party, already available) | built-in | SAFE | RECOMMENDED | installed | First-party skill, not a third-party candidate the 9-red-flags rubric applies to (that explanation used to sit in the verdict cell, which `tooling-audit.mjs` rejects — the verdict must be exactly SAFE / REVIEW-REQUIRED / UNSAFE). 2026-09-10: exercised for real during T1's audit — no project-specific run skill existed yet, fell back to the `playwright.md` pattern. Required extra setup this specific WSL2 environment needed (Playwright's own OS-support check rejects this Ubuntu release for its browser downloads; worked around by installing a scratch-directory Playwright + manually fetching the matching Chrome-for-Testing build instead of `npx playwright install`). Signed in as `worker@jayshankar.demo`, reached the Floor dashboard, screenshotted it, confirmed zero console errors. Works, but isn't a one-command setup on this host — worth `/run-skill-generator`-ing into a real project skill next time this is needed, per the `run` skill's own recommendation. |
| The Ant review deck needs a component library and an icon set (an npm **dependency**, not a tool or skill — the 9-red-flags rubric is written for the latter, so this row is read as evidence rather than as a literal rubric pass) | `antd` 6.6.5 + `@ant-design/icons` 6.3.4 | `npmjs.com/package/antd` (tarballs read directly in `node_modules/`) | REVIEW-REQUIRED | RECOMMENDED | installed | 2026-09-29: read both `package.json` files. **No install-time lifecycle script** — `@ant-design/icons` declares none, and `antd`'s `prepare` / `prepublishOnly` / `postpublish` do not run for a registry tarball (they fire for git/local installs and publishes); there is no `preinstall`/`postinstall` in either. MIT; publisher is the Ant Design team (Ant Group); very widely used. **Read this yourself** — `node_modules/antd/package.json`, the `scripts` block, and the `dependencies` list (`rc-*` components, `@ant-design/cssinjs`): the audit is static reading of the published package, not a line-by-line review of the whole dependency tree, and the kit's rule is that uncertainty resolves to REVIEW-REQUIRED rather than SAFE. Nothing here substitutes an assumption for real data — the risk is supply-chain, not invented figures. Confined to `src/components/storybook-ant/`, never the app bundle. |
| Ten npm dependencies that reached `package.json` **without** a `SPEC.md` §4.4 row and without this audit (npm **dependencies**, read as evidence like the row above) | `fuse.js` 7.5.0, `lucide-react` 1.48.0, `@radix-ui/react-slot` 1.3.3, `@radix-ui/react-collapsible` 1.1.20, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 2.6.1, `tailwindcss-animate` 1.0.7, `@capacitor/cli` 8.5.1, `playwright` 1.63.0 (dev) | `npmjs.com`, tarballs read directly in `node_modules/` | REVIEW-REQUIRED | RECOMMENDED | installed | 2026-10-02 (reconciliation): read all ten `package.json` files. **None declares a `preinstall`/`install`/`postinstall` script.** Licences MIT / ISC / Apache-2.0. Not line-by-line reviewed and the transitive trees were not read, so the verdict is REVIEW-REQUIRED, not SAFE. `playwright` downloads browser binaries only when its own CLI is invoked, not at `npm install`; it is `devDependencies` and imported only by `scripts/`. `@capacitor/cli` sits in `dependencies` though it is build-time only (noted in `SPEC.md` §4.4). The point of this row is the *process* gap: nine of the ten arrived with no SPEC row and no audit; `SPEC.md` §4.4 now has the rows. |

**Uncertainty resolves to REVIEW-REQUIRED, never SAFE** — the first row above
is exactly that: genuinely unknown, not assumed fine.

---

## 4. Waivers recorded in SPEC.md §0.2

<None yet — nothing here has been formally waived; the pending row above is
an open confirmation, not a waiver.>

**Still none.** The `antd` row is REVIEW-REQUIRED but **installed and confined** rather than waived:
it is not a capability the work depends on, and nothing is being assumed in its place — the deck it
serves is a review artifact. If D67 resolves to Ant Design *for the app*, that row stops being an
exception and `SPEC.md` §4.1's stack table has to change with it.

---

## 5. Audit log

- 2026-09-10: initial audit, scoped to the new `delegation/` setup — result:
  pending on confirming MiniMax Coder's Windows-side environment; everything
  else the setup needs is either already confirmed or doesn't block starting
  (the auditor's independent re-verification step covers the gap in the
  meantime).
- 2026-09-10 (same day): MiniMax M3 self-reported working Node/filesystem
  access; row left `pending` until T1 returns and gets independently
  re-verified rather than flipped on a self-report. See `delegation/
  LEDGER.md` T1.
- 2026-09-10 (same day, after T1 integrated): both rows independently
  confirmed for real — flipped to `installed`, audit status to `complete`.
  Re-audit if the setup changes materially (a second worker platform, a
  different visual-check tool, this host's OS changing).
- 2026-09-29: re-audited for a new **dependency** rather than a new tool. The Ant review deck adds
  `antd` 6.6.5 + `@ant-design/icons` 6.3.4. Static read of both tarballs' `package.json` — no
  install-time lifecycle script (`prepare` exists on `antd` but registry installs don't run it) —
  MIT, publisher identifiable, and confined to `src/components/storybook-ant/`. Landed
  **REVIEW-REQUIRED**, not SAFE, because the dependency tree was not read line by line and the
  kit's rule is that uncertainty resolves that way. Scope widened from "the delegation/ setup" to
  "that setup plus the app's npm dependencies"; re-audit again if the deck's stack changes or if
  D67 puts Ant Design in the app itself.
- 2026-10-02: methodology reconciliation. `tooling-audit.mjs` was **red** — the `run` skill row's verdict
  cell carried a sentence instead of the bare word `SAFE`; fixed (explanation moved to the notes cell).
  Added the row for ten dependencies that had reached `package.json` with no `SPEC.md` §4.4 row and no
  audit (the shadcn/Radix layer from the Phase A redesign, `fuse.js`, `lucide-react`, `@capacitor/cli`,
  `playwright`). Static read only — no install-time scripts in any of them; landed REVIEW-REQUIRED.
