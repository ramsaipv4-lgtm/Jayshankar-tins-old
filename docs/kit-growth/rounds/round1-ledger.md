# Round 1 — lens: session ledger + git worktree + reconciler

Reviewer: ledger lens. Experiments ran in throwaway repos under the scratch dir (`.../scratchpad/r1-ledger/`, git 2.53.0 WSL, Git-for-Windows 2.54.0 on the same machine). Nothing was written in the project.

## 0. Live incident found while working (read first)

At 09:28:42 something rewrote `/mnt/c/Users/user/Desktop/Jayshankar/.git/config` so line 3 reads `filemode = core.autocrlf` (it was `filemode = false` at 09:21). **Every git command in the project now dies**: `fatal: bad boolean config value 'core.autocrlf' for 'core.filemode'` (verified: `git status`, `git branch -a`, `git -c core.filemode=false ls-files` all fail). I did not cause it (I only ran read-only `git config` lookups) and I did not repair it. Probably a parallel reviewer typed `git config core.filemode core.autocrlf`. It is the proposal's thesis in miniature: concurrent agents share one `.git/config`, and worktrees share it too, so one bad write disables every worktree. Repair: set line 3 back to `filemode = false`.

## 1. Verdict

The mechanics (worktrees, trailers, numstat, `merge-tree --write-tree`, per-session files, an index) all work in git 2.53. The proposal as written does not survive this project's environment: worktrees on `/mnt/c` versus ext4 cannot be shared by WSL and Windows harnesses, `tins-kit/` and `delegation/` are absent from every worktree, git-derived "facts" are wrong in common cases, and the check meant to predict conflicts misses the ones that will actually happen. Fixable, but the pattern needs an environment section, a different attribution rule (by trailer, not by diff range), and a semantic-collision layer it does not have.

## 2. Problems

### Critical

**C1. A worktree cannot be used from both WSL and native Windows (the project's actual setup).**
- Verified: a worktree's `.git` is a file holding an absolute path (`gitdir: /tmp/.../repo/.git/worktrees/wt-A`). For a worktree made from WSL on `/mnt/c` this is `/mnt/c/Users/...`. Windows git resolves a rooted path against the current drive root. Proof by coincidence: Windows git 2.54 opened my ext4 worktree through `\\wsl.localhost\Ubuntu\...` only because `/tmp/...` resolves against that UNC root. On `C:` it would become `C:\mnt\c\...` (inferred, not run; I could not create a repo on `/mnt/c` under the rules). The reverse is verified: a Windows-made pointer `gitdir: C:/Users/...` makes WSL git say `fatal: not a git repository: <cwd>/C:/Users/...`.
- Verified: after moving a repo directory, an absolute-path worktree fails (`fatal: not a git repository`) until `git worktree repair`. A WSL/Windows hand-off means a repair every switch.
- Worktrees on WSL ext4 are no escape: verified `cmd.exe` cannot use a UNC cwd (`UNC paths are not supported. Defaulting to Windows directory.`), and `npm run` on Windows goes through cmd. A MiniMax-Coder-style Windows harness cannot run `npm run validate` there.
- `git worktree add --relative-paths` (git >= 2.48) writes `gitdir: ../repo/.git/worktrees/wt-R`; verified it survives moving the directory pair. But it sets `repositoryformatversion=1` + `extensions.relativeWorktrees`. Verified that any git that does not know an extension refuses the whole repo (`fatal: unknown repository extension found`). That includes old bundled gits in IDEs, JGit/Android Studio (the project has `android/`), and Cline/other harness-bundled gits (unverified which). So it trades one failure for a repo-wide one.
- Rectify: the pattern needs a mandatory "Environment" section. Rule for mixed WSL/Windows projects: create all worktrees from the OS that will run them; record `host-os` in the ledger open record; run `git worktree repair` as the first step of any session that starts on the other OS; never use `--relative-paths` unless every harness git >= 2.48 is verified. Add `scripts/ledger.mjs doctor` that runs `git worktree list --porcelain`, flags paths the current OS cannot stat, and prints the repair command. Add a kit script that checks `git --version` and `.git/config` sanity (see §0) before any agent starts.

**C2. A fresh worktree contains none of the gitignored things the design depends on.**
- Verified in the toy repo (`.gitignore` copied from the real shape): `ls wt-A` shows no `tins-kit/`, no `delegation/`, no `node_modules/`, no `.env`. Real `.gitignore:110,116,123` ignore `delegation/`, `tins-kit/`, `_external/` (`git check-ignore -v` confirmed).
- Consequences: (a) `check-task-independence.mjs` reads `delegation/LEDGER.md` (script line ~50), which is untracked, so it exists only in the main checkout; (b) a worker in a worktree cannot read its `delegation/tasks/<id>/WORKER-PROMPT.md`; (c) any `ledger.mjs` placed in `tins-kit/scripts/` is not runnable in the worktree; (d) `node_modules` is 1.1 GB (verified `du -sh`, both `@esbuild/linux-x64` and `win32-x64` present), tracked tree is 156 MiB / 861 files, and `C:` has 13.5 GB free of 499 GB (98% used; `df`). Five worktrees with their own install is roughly 6 GB of that.
- Rectify: (1) `ledger.mjs` and its validator check must be vendored into the consumer's tracked `scripts/`, not read from `tins-kit/`; (2) `ledger open` copies/links the task packet into the worktree under an ignored `.task/` and records its path; (3) the ledger directory must be tracked (it is: `ledger/` is not ignored) and must NOT be placed under `delegation/`; (4) document the disk budget and prefer sharing one `node_modules` read-only for gate-only worktrees (state the per-OS caveat).

### High

**H1. `check-task-independence.mjs` predicts almost none of the real conflicts.** Verified by running the real script on a 4-task ledger: it flagged only `BUILDER-DECISIONS-REVIEW.md` (T3/T4). It missed: `src/App.tsx` vs `./src/app.tsx` (no normalisation, and the FS is case-insensitive: `core.ignorecase=true`), `src\lib\x.ts` backslashes, two different files both numbered `0037_*.sql`, `package.json` vs `package-lock.json`, and migrations vs generated `docs/SCHEMA.md`. It also only does a trailing-`*` prefix match. Worse, with AGENTS.md rule "every decision goes in BUILDER-DECISIONS-REVIEW.md without exception", every task touches that file, so the check is permanently red and its advice is "merge the tasks".
- Rectify: add an `appendOnly`/`shared` exemption list; add coupled-file groups (manifest + lock, migrations + SCHEMA.md); add a "claims" namespace (`migration-number:0037`, `db:supabase-live`) checked for uniqueness; normalise path case/slashes; read from tracked `ledger/open/*.json`, not `delegation/LEDGER.md`.

**H2. Textual-clean merges that are semantically broken are the common case, and the gate does not see them.**
- Verified (toy): A adds `0037_a_status.sql`+`0038_a_fn.sql`, B adds `0037_b_other.sql`. `git merge-tree --write-tree` exit 0; merged tree has two `0037_*` files. The project's `scripts/validate.mjs` has no duplicate-number check (grep for `duplicate|sequen` finds nothing; it concatenates `*.sql` lexically, lines 891-913), so the gate passes while the second `alter table a add column s int` collides with the first.
- Verified: `package.json`/`package-lock.json` edits at separate lines merge clean and the file is plausible, but a hand-merged lock is not what `npm install` would write.
- Verified: with `.gitattributes merge=union` on the decision log (the obvious fix for "everyone appends") both branches merge with zero conflict and the result has two `### Decision 99` headings. Merge-clean, numbering-broken.
- Rectify: the gate needs a "collision" tier: unique migration prefix, unique decision number, lockfile regenerated and `npm ci --dry-run`-verified, generated files rebuilt not merged. Do not recommend `merge=union` without a numbering check. Allocate numbers by claim file at `ledger open` (the draft says this in §2.2 but defines no mechanism or command).

**H3. Git-derived "facts" are wrong in the cases that matter (all verified).**
- Range attribution: after rebasing B2 onto A2, `git diff --numstat main..HEAD` and `main...HEAD` both list A2's migrations as B2's work. Attribute by commit trailer (`git log --format=... --numstat` over commits carrying `Session: <id>`), not by range.
- Squash drops trailers (`git merge --squash` + commit gave empty `%(trailers:key=Session)`); the reconciler's own merge style erases the audit trail. Use `--no-ff` merges only, and make the merge commit carry a `Sessions:` trailer list.
- Recorded `head` hash after a rebase: 0 refs contain the old hash (`git for-each-ref --contains` -> 0), it survives only in the reflog until gc. Record `patch-id` or the trailer, not hashes.
- Line counts: one 5,000-line regenerated `docs/SCHEMA.md` and a 3,000-line lockfile give `5000 2` / `3000 8`; the single hand-written line is lost. A binary shows `- -`. A rename prints as `src/{a => b}` unless `-z` is used (verified); the INDEX parser must use `-z -M`. Spaces appear in real tracked paths (`client-qa/session2/UpNote_.../q Now I want...md`, 149 chars), so no whitespace splitting.
- CRLF noise (real data, project dirty tree): `client-qa/qa.md` is `200 198` plain but `2 0` with `--ignore-cr-at-eol`; `docs/CONTRIBUTING.md` `101 99` vs `15 13`; whole tree `1359/2752` vs `944/2337`. Committed CRLF files (`git ls-files --eol`: 12 `i/crlf`, 5 of them `w/lf`) are rewritten LF by editors. Mitigate: always `--ignore-cr-at-eol`, mark generated/lock paths in a `ledger.config` list and report them as "generated (N lines)" outside the human total; add a `.gitattributes` with `* text=auto eol=lf` as a one-time, deliberate repo change (not done now).
- `core.filemode=false` is already set so mode-bit noise is suppressed here (every DrvFs file is 755); a fresh WSL clone on ext4 would default to `true` and flip it. Worktrees share the config, so this one is safe, but say so.

**H4. The "enforced by the gate" step has three bypasses (verified).** Hooks live in the shared `.git/hooks` (not versioned; absent on a fresh clone) and `--no-verify` skips them (my hook printed `HOOK-RAN` on a normal commit and nothing on `--no-verify`). A crashed or abandoned session never runs `ledger close`, so its commits have no entry, and the validator that would flag it only runs on a branch someone checks. Late commits after `close` have no front-matter coverage. Rectify: make the check run at merge time in the reconciler script and in CI, not as a commit hook; define `closed` as "the last commit with the `Session:` trailer is at or before `head` in the entry" and have the check compare `git log --grep`/trailer commits against entries; `ledger reap` writes a stub entry (`status: abandoned, facts only`) for any branch with trailer commits and no entry. Failed sessions have the most valuable learnings; the design only records ones that close green.

### Medium

**M1. The completeness check is gameable and has a substring bug.** Verified: ids `s-A-1`, `s-A-10`; output citing only `s-A-10` makes a naive `includes()` report `s-A-1` as cited. An appendix that lists all ids passes trivially. Rectify: match `\bid\b` with a delimiter-safe id format (`s-<date>-<rand>-end`), require the citation inside a per-session row (`| s-... | decision |` table or `<!-- session:ID -->` anchor), and also require that the cited text is non-empty and not identical across ids.

**M2. Model identity cannot be derived.** Verified: this Claude Code session exposes `CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT` but no model-name variable (`env | grep -i model` found none). So `Model:` is whatever the launcher or the model types; for a hand-relayed GUI session it is the human. Treat as `model_source: harness|launcher|self-reported|human`, never as a fact. Do not use it for routing decisions or cost claims.

**M3. Per-session filename collisions and invalid characters.** `ledger/<date>-<task>-<model>.md`: a retry by the same model the same day collides (add/add); model names contain `:` `/` (`openrouter/x`, `gpt-5:high`) which NTFS rejects (inferred; Windows reserved characters). Rectify: `<UTC-timestamp>-<session-id>.md`, model only in front matter.

**M4. Branch names collide on a case-insensitive FS.** `task/Foo` and `task/foo` are files under `.git/refs/heads` (inferred; `core.ignorecase=true` here). Lowercase branch rule in `ledger open`.

**M5. Index file policy is undefined.** If `ledger/INDEX.json` is committed, every branch regenerates it and the first two merges conflict (the draft's own anti-pattern 1 reintroduced); if gitignored, a fresh clone has none and it must be rebuilt from front matter. Rectify: do not commit it; generate it from `ledger/*.md` front matter on demand; the completeness check regenerates it itself.

### Low

- Path length: longest tracked path 149 chars; worktree dir like `C:\Users\user\Desktop\Jayshankar-wt-<task>\` adds ~60, under 260 (computed, not tested). Do not place worktrees under `.claude/worktrees/` inside the project: an untracked full copy under the root would be walked by `tsc`, `docs-guardian` and the validator.
- Speed on `/mnt/c`: `git status` 1.7 s for 160 changes; reading ~470 files 1.5 s (verified). Worktree add there is slower than ext4 but not a blocker.
- Symlinks: 0 tracked symlinks (`git ls-files -s` mode 120000 count); do not use a symlink to share `tins-kit/` into worktrees (WSL symlinks on DrvFs are unreliable for the Windows side; inferred).
- Single-checkout rule: a branch can be checked out in one worktree only (verified: `checkout task/B2` was refused in the main tree while `wt-B2` held it); the reconciler must merge from a different branch name or the main worktree.

## 3. Conflict surface measured

| File (real hot file) | Result in experiment | Kind |
|---|---|---|
| `BUILDER-DECISIONS-REVIEW.md` (4,567 lines, 98 decisions) both append | textual conflict on every pair; brief = 2 x 42 lines, merge-tree output ~644 B + hunks ~4 KB | mechanical; union attr resolves but gives duplicate numbers (semantic) |
| `HANDOVER.md` same line / adjacent lines | conflict; different sections 20 lines apart merged clean | mechanical when adjacent; semantic when two sessions each assert a different "migrations applied" state, clean merge, both true, state wrong |
| `package.json` / lock | adjacent additions conflict; separated additions merge clean | lock merge is untrustworthy; regenerate |
| `supabase/migrations/0037_*` | no textual conflict ever (different filenames) | pure semantic: duplicate numbers, same-column collisions |
| generated `docs/SCHEMA.md` | conflicts on tail append | regenerate after merge |
| `src/lib/storybook/chapters.ts` adjacent lines | conflict (adjacent edits); separated edits clean | mechanical |

So the "conflict brief" is small (single-digit KB) for what git can see, and says nothing about the semantic cases, which are the dangerous ones.

## 4. What survives

- `git worktree add ../wt-X -b task/X <base>`, one branch per agent: works; shared `.git/hooks` and config is a hazard (§0, H4) but not a blocker.
- Commit trailers: `git commit --trailer Session=... --trailer Model=...` and `git log --format='%(trailers:key=Session,valueonly)'` work and are the right primary key (with the caveats in H3).
- `git merge-tree --write-tree A B` (needs git >= 2.38; 2.53 here, Windows 2.54) is a true dry-run: exit 1 on conflict, prints the conflicted-file list with stage ids and "CONFLICT" messages, creates no working-tree changes. This is the right engine for conflict briefs.
- One branch at a time with a gate between merges worked (A2 then B2 merged clean); the gate is the right place for the semantic checks above once they exist.
- Per-session ledger files never conflict with one another (distinct names), which does fix anti-pattern 1.
- `git diff --numstat -z -M` plus `--ignore-cr-at-eol` is a reliable base for the counters.

## 5. Unverified

- Worktree creation, speed and pointer behaviour on `/mnt/c` itself (rules forbid a repo outside scratch); check with a throwaway under `C:\Users\user\Desktop\_scratch` from both OSes.
- Which harness gits (Cline, Codex, MiniMax Coder, Android Studio) reject `extensions.relativeWorktrees`.
- Codex / Gemini / Cline session-id and model exposure.
- `npm ci` time and whether a shared read-only `node_modules` works for gate-only worktrees on both OSes.
- Concurrent git operations over 9p (index/ref `.lock` contention with five agents).

## 6. Top 5 changes to make to the kit first

1. Add an Environment/hazards section to `session-ledger-worktree-reconcile.md` and a `doctor` script: git version, `.git/config` sanity, worktree-pointer reachability on this OS, `repair` instruction, disk budget, a "create the worktree on the OS that will run it" rule (C1, §0).
2. Make `check-task-independence.mjs` read tracked `ledger/open/*.json`, normalise paths/case, support shared/append-only exemptions, coupled-file groups, and a claims namespace (migration number, decision number, live DB) (C2, H1, H2).
3. Change the attribution rule: facts by `Session:` trailer commits with `--no-ff` merges only, `-z -M --ignore-cr-at-eol`, generated paths reported separately, patch-id instead of hashes (H3).
4. Move enforcement from commit hooks to the reconciler/CI, add `ledger reap` for abandoned sessions, and define `closed` precisely (H4).
5. Replace the naive completeness check with an anchored per-session-row check; define `model_source`; use `<timestamp>-<session-id>.md` filenames; do not commit `INDEX.json` (M1-M5).
