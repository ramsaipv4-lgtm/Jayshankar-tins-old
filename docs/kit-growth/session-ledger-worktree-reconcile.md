# `session-ledger-worktree-reconcile` — kit pattern (DRAFT v2, kit-growth candidate)

> **Status: DRAFT v2 — rewritten after round-1 review** (`rounds/round1-ledger.md`, `round1-redteam.md`,
> `round1-harness.md`, `round1-economics.md`, `round1-consistency.md`). v1's mechanism survived (worktrees,
> trailers, `merge-tree`, per-session files all work in git ≥ 2.38) but **its environment assumptions, its
> "facts from git" rule, its completeness check and its enforcement did not.** The kit copy
> `_external/tins-kit-next/` implements the fixes as `scripts/session.mjs`; see its `docs/changes/round1-B.md`.
>
> **Draft for `tins-kit/kit-staging/inbox/`. This repo never edits `tins-kit/` (AGENTS.md §6).** Copy to
> `lib/patterns/session-ledger-worktree-reconcile.md` when exporting.
>
> **The recipe for several models, on several harnesses, working one repository and handing it on without losing
> what each did:** each session leaves a small record whose *facts are derived by script from git, by trailer
> attribution*; each agent works in its own git worktree *created on the OS that will run it*; shared resources
> (migration numbers, decision numbers, a live database) are *claimed*, not guessed; and the final reconciler
> merges one branch at a time against *indexed lookups, an anchored completeness check and a canary*, because
> models skim.
>
> **Source:** Jayshankar, 2026-10-02 — one consumer; experiments in throwaway repos (git 2.53 WSL, Git-for-Windows
> 2.54). **Not piloted with real agents.** §3 names the smallest real test.

---

## 0. Why this exists

A project built by more than one model needs three things the kit does not give it together: a trail of what each
session did that a *different* model on a *different* harness can read; isolation while sessions run in parallel;
and a merge step that does not depend on a model reading everything.

Round 1 also corrected what the trail is *for*. It is **not** primarily to save reading tokens: in the session
measured, cost was turns × carried context, not file size, and the proposal's own bookkeeping (extra tool calls)
cost about what the smaller reads saved except in long, parallel, large-context projects. The honest value is
(a) **conflict avoidance** when two or more agents run (+0.4M to +1M cost-units per round at 3–6 agents), and
(b) a **trustworthy, machine-checkable record** for hand-offs. So the design makes all bookkeeping run *inside
the existing gate or commit call* — zero extra model round trips.

---

## 1. The 3 lessons, in detail

### 1.1 Facts come from git *by trailer attribution*, and identity is a claim

Not "files I touched" from the model, and not `git diff base..HEAD` either — verified failures of the range rule:
after a rebase the range lists *another* session's work as yours; `git merge --squash` drops the trailers; a
recorded head hash is orphaned by a rebase; one 5,000-line regenerated doc or a lockfile swamps the real counts;
CRLF noise turns a 2-line change into `200/198`.

| Part | Source | Rule |
|---|---|---|
| **Front matter** | `session.mjs close` | commits carrying `Session: <sid>`; merges are `--no-ff`; `git diff --numstat -z -M --ignore-cr-at-eol`; generated paths (lockfiles, `docs/SCHEMA.md`, `dist*/`, `*.min.*`, from `sessions/config.json`) reported as "generated (N lines)" outside the human total; record `patch-id`, not just hashes; real gate exit code |
| **Outcome** | `close --outcome` | `passed \| failed \| abandoned \| gate-broken` — **the gate blocks the merge, not the close**, so a red gate (including a gate that is itself broken) is recorded as a fact, never destroys the record |
| **Model** | launcher / human | `model_source: harness \| launcher \| self-reported \| human`. A model's claim about *which* model it is is not evidence; for a hand-relayed GUI app the human types it. Never use it for routing or cost claims |
| **Body** | the model | ≤ 60 lines: overview, decisions, ≤ 5 learnings (each ≤ 280 chars **with an `evidence:` path or commit**; evidence-free learnings are stored `unverified` and never promoted), open items |

"Mistakes" is derived from evidence — failed gate runs, fix-up and revert commits, retries — and the model adds
interpretation, never the list. A **failed or abandoned** session has the most valuable learnings, so those are
recorded too (`reap` writes a stub for any orphaned `Session:` trailer).

One tracked file per session: **`sessions/<UTC yyyymmddThhmmssZ>-<sid>.md`** (model names contain `:` `/`, which
NTFS rejects; a same-day retry by the same model must not collide). Not `ledger/` (clashes with
`delegation/LEDGER.md`) and **never under a gitignored `delegation/`**. The index is generated on demand and
**never committed** (a committed index conflicts on the first two merges — v1's own anti-pattern, reintroduced).

### 1.2 One worktree per agent — made on the right OS, with the missing files supplied, and numbers claimed

```
git worktree add ../wt-<task> -b task/<lowercase-task> <base>
```

What round 1 verified about it **in this project's real environment**:

- **A worktree contains only tracked files.** No gitignored `tins-kit/`, `delegation/`, `node_modules` (1.1 GB
  here, 98%-full `C:`) or `.env`. `session.mjs` and its validator must therefore be **vendored into the
  consumer's tracked `scripts/`**, and the task packet is copied into an ignored `.task/` by `start`.
- **A worktree's `.git` is a file holding an absolute path.** Made from WSL on `/mnt/c` it is unusable from native
  Windows git (and vice-versa; `cmd.exe` cannot even use a UNC cwd). Rule: **create each worktree from the OS that
  will run it**, record `host-os` at `start`, and run `git worktree repair` first thing when a session starts on
  the other OS. `--relative-paths` (git ≥ 2.48) removes the pointer problem but sets an extension that older gits
  (IDE-bundled, JGit/Android Studio, other harnesses' bundled gits) reject for the *whole repo* — do not use it
  unless every harness git is verified. `session.mjs doctor` checks all of this.
- **`.git/config` is shared by every worktree**, so one bad write disables all of them. (This happened in round 1
  itself: a reviewer overwrote line 3 and every git command in the project failed.) `start` refuses to run on a
  config git itself rejects; agents never run `git config` on the project.
- **Textual-clean merges can be semantically broken, and the gate does not see them:** two branches each adding
  `0037_*.sql` merge clean and both pass `validate`; `merge=union` on the decision log yields two `Decision 99`
  headings; hand-merged lockfiles are not what `npm install` writes. So shared resources are **claimed**:
  `session.mjs claim migration-number:0037` creates `sessions/claims/…` with `O_EXCL`; the validator adds a
  *collision tier* (unique migration prefix, unique decision id across the whole tree, lockfile regenerated and
  `npm ci --dry-run`-verified, generated files rebuilt not merged). Do **not** recommend `merge=union` without
  the numbering check.
- **`check-task-independence.mjs` predicted almost nothing** (it flagged only the decision log, and missed case,
  `./` and backslash variants, duplicate migration numbers, manifest-vs-lockfile, migrations-vs-generated docs).
  The kit copy normalises paths, supports shared/append-only exemptions and coupled-file groups, and checks claims.

### 1.3 Enforcement at merge time, not only commit time; completeness that cannot be faked

- **Hooks are skippable** (`--no-verify`), absent on a fresh clone, and shared across worktrees. The real gate is
  `session.mjs check`, run by the reconciler and CI **from the base branch's copy of the scripts** (a worker can
  edit its own gate), failing when: a `Session:` trailer commit has no record; ids are duplicated tree-wide; a
  recorded `head` is not an ancestor of the merged ref (catches amend/rebase/force-push); or the diff touches gate
  code or another session's record (flagged for **human** merge).
- **"Every session id is cited" is satisfiable by a list of ids** (and a naive `includes` makes `s-A-1` look cited
  because `s-A-10` is). Replace it with: ids in a delimiter-safe format; **script-rendered rows**, one per session,
  holding the git-derived facts, the model filling only keyed `why:` fields; the script rejects a missing id, an
  extra id, an identical `why` across ids, or a `why` that does not quote an **anchor** (a path or hunk token the
  script verifies exists in that session's diff); plus a **canary** — a synthetic session with a random fact
  injected into the reconciler's input, which the output must reproduce.
- **One branch at a time, gate between merges; no octopus; `--no-ff` only** (squash erases the audit trail). The
  reconciler **does not review its own merge** — a separate verifier session runs the gate.
- **Records are data, never instructions** — and the kit must *say so in the role prompts* (round 1 found the
  phrase in no kit prompt). Untrusted blocks (session bodies, conflict briefs) are fenced with a per-run random
  nonce; the reconciler and verifier get **no push, no force, no network**. A **secret scan** runs before any
  record is written (`scan-secrets.mjs`: provider shapes + entropy + verbatim match against values in the
  project's gitignored `.env*`); a hit **refuses** the write.
- **Map-then-reduce documentation is not worth it below ~20 entries** (cost parity with reading them directly);
  below that, read directly and let the anchored check verify the output.

---

## 2. The 3 known anti-patterns

1. **One shared append-only ledger or log.** Parallel worktrees conflict on its first merge, and "next free
   number" allocation silently collides (verified: two worktrees each took `D95` in differently named files and
   merged clean). Per-session files plus claims remove both.
2. **Trusting worktrees to isolate shared state.** They isolate files, not the live database, the lockfile's
   meaning, the per-OS `node_modules`, the `.git/config`, or gitignored tooling.
3. **Self-reported or forgeable facts as the audit trail** — a model's own file list, line counts, mistakes or
   identity; commit trailers (`git commit --trailer "Model: …"` is trivially forged); recorded hashes after a
   rebase. Derive what can be derived, mark the rest `claimed`, and verify ancestry and tree at merge time.

---

## 3. When this pattern changes

- **Solo, one model, small project:** skip it. Economics: negative net for a small project (−42K units/session),
  modest for a Jayshankar-like one, clearly positive only for long, parallel, large-context work.
- **Pilot before adopting.** One real round, two worktrees, on a consumer with a live database; use the WSL+Windows
  pair. Measure: conflict-brief size, whether `check` catches a deliberately omitted session, a forged trailer, a
  duplicate migration number, and an amended head; and whether the whole thing costs **zero extra model round
  trips**. If it adds more than one per session, fold it into the existing gate call or drop it.
- **Unverified in round 1:** worktree creation/pointer behaviour on `/mnt/c` itself from both OSes; which harness
  gits reject `relativeWorktrees`; real reconciler-model behaviour under an injected instruction (test with and
  without the nonce fence).
- **Archive per release** to `sessions/archive/<release>/`; the index states what it `covers:` so a lookup that
  omits archived entries never silently under-reports conflicts.

---

*End of `session-ledger-worktree-reconcile` pattern.*
