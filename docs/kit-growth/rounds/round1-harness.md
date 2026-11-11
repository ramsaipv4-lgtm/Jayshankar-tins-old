# Round 1 — lens: cross-harness / cross-model portability

> Reviewer: harness lens. Experiments ran only in `/tmp/claude-1000/.../scratchpad/r1-harness/` (kit copy, a consumer copy, a throwaway repo). Nothing in the project was modified. "V" = verified (command run or file:line read); "I" = inferred.

## 1. Verdict

The kit's prose is already mostly harness-neutral (V: no `AskUserQuestion`, `TodoWrite`, slash commands, `CLAUDE.md` or memory-dir references in any prompt; only `claude -p` presets and optional "subagents"). It breaks for other harnesses on **structure, not vocabulary**: the one cross-harness dispatcher hands workers an unfilled template, worktrees drop the kit, prompts are stubs plus long chains a weak model will skim, and nothing makes the protocol mechanical. The proposal's *file-and-script* core survives; its *"the model will do the bookkeeping"* parts do not unless enforced by git hooks, scripts and a reconciler check.

## Assumption audit (file -> assumption -> breaks -> fix)

| File:line | Assumption | Breaks | Fix |
|---|---|---|---|
| `scripts/orchestrate.mjs:388,396-398` | Substitutes only `{{TASK_ID}}`/`{{PROMPT_FILE}}` in the *command*; prompt file hardcoded to `tins-kit/prompts/WORKER-SESSION.md` | every non-native harness (V, see C1) | render per-task packet; `--prompt-file` |
| `templates/ORCHESTRATION.json:12-14`, `EXECUTION-MODE-INTERVIEW.md:108-110` | `"$(cat f)"` command substitution | Windows `cmd.exe` (Node `shell:true`), PowerShell, long prompts (I) | pass a short "read PATH and follow it" string, or stdin |
| same, "Verified 2026-08-26" | codex/gemini flags current | codex, gemini, aider not installed here (V) - unverifiable; no cline/opencode preset though both are installed | verify per CLI, record date in selftest |
| `WORKER-SESSION.md:39-56,212`; `AUTONOMOUS-BUILD.md:58-75`; `DELEGATE-WORK.md:26-38`; `INTEGRATE-DELEGATED-WORK.md:19-30` | the pasted fenced block *is* the prompt | GUI relay: block ends "The 7 steps (do them in this order)." - steps are outside the fence (V) | self-contained single block, or a render script |
| 8 prompt files with odd ``` counts (V: AUTONOMOUS-BUILD, DELEGATE-WORK, INTEGRATE, KITTING, RELEASE-CHECKLIST, SPEC-AUTHOR, TOOLING-AUDIT, WORKER-SESSION) | markdown renders cleanly | chat UIs invert code/prose after the stray fence | fence lint in `validate.mjs` |
| `CONTINUE-TINS-PROJECT.md:42`, `AUTONOMOUS-BUILD.md:60` | `$PWD` expands | any paste into a GUI (literal `$PWD`) | say "the project root you were given" |
| every prompt: `./tins-kit/` | kit vendored in the work dir | git worktrees (V, C2); chat UIs with no file access | worktree prep; context pack |
| `CONTINUE-TINS-PROJECT.md:273,327` | `node --test tins-kit/scripts/selftest.mjs` from consumer root | **44 of 56 tests fail** from there, 56/56 from inside the kit (V) | make selftest cwd-independent |
| `CONTINUE-TINS-PROJECT.md:69-76` + `TOOLING-AUDIT.md:5,90` | web search + MCP/skills discovery; blocking gate exits 2 until `TOOLING-AUDIT.md` exists (V) | no-web harnesses, Aider, local models | named offline path: waiver template |
| `templates/AGENTS.md:36-50`; `DELEGATE-WORK.md:178` | PowerShell + `curl -o NUL`, `Compress-Archive` | WSL/macOS/Linux harnesses | `node` scripts only |
| `kit AGENTS.md:18-19,44,90-94` | "7 prompts, 20 patterns" | actual 24 and 24 (V); the first-commands `ls` check reads red | generate counts |
| `prompts/*` "extended/max thinking" | Claude/Gemini wording | cosmetic | "highest reasoning setting" |

## 2. Problems

**Critical**

- **C1. The cross-harness dispatcher delivers an unfilled template.** Ran `orchestrate.mjs` in a scratch consumer with a fake `workerCmd`: the worker's prompt file still contains the literal `{{TASK_BRIEF}}` (`grep -c` = 2) - no brief, file list, criteria or contract ever arrives; by `WORKER-SESSION.md` step 2 it must escalate. The only real autonomous run (`examples/autonomous-todo-app/README.md:115`) used native subagents with `workerCmd` empty, so the `auditor-remote` path has never worked end to end. This confirms the `kit-modes` draft's gap #2, and it is worse than "can't take a per-task prompt". *Fix:* `orchestrate.mjs` renders `delegation/tasks/<id>/PACKET.md` from the ledger row (all six placeholders, fail if any remain), and adapters receive a short instruction pointing at that file. This is also exactly what a GUI relay needs.
- **C2. A worktree contains only tracked files.** Throwaway repo with this project's `.gitignore` shape: `git worktree add` produced `.git .gitignore AGENTS.md` only - no `tins-kit/`, `delegation/`, `node_modules`, `.env` (V). Here `tins-kit/` and `delegation/` are gitignored (`.gitignore:116,110`), so a worktree agent has no kit, no scripts, no briefs, and any `ledger/` kept in `delegation/` is invisible to the branch. Worktree `.git` files hold absolute POSIX paths (V), so a WSL-made worktree is unusable from native Windows git (I). *Fix:* `ledger open` does worktree prep (link or copy kit, `npm ci` per OS) and fails loudly; `ledger/` is tracked; decide kit vendoring (tracked, or a pinned submodule).

**High**

- **H1. Skim risk is structural.** This project's read chain (V, chars/4): AGENTS 3.8k + ONBOARDING 4.1k + HANDOVER 9.3k + SPEC 46.6k + BUILDER-DECISIONS 82.5k (4,567 lines) + REVIEWER 4.1k + amendments 13.6k + README 2k = **~166k tokens**, above a 128k context. The "must read" subset is ~39k. Buried: the finish protocol is `HANDOVER.md` §7 at line 268 of 282, reached by a pointer from `AGENTS.md:123`; `SPEC.md` decision rows are single lines up to 3,923 chars (line 107); §0.2 alone is ~17k tokens; `SPEC.md` is 2,024 lines, so a default 2,000-line read silently drops its last 24 lines - the open-questions list (V). A fresh kit consumer reads ~20k tokens of kit (CONTINUE 3.8k, INDEX 5k, PIPELINE 3.6k, TOOLING-AUDIT, STEERING, EXECUTION-MODE) before routing to a further 9-12k prompt; hard rules sit mid-file ("What you do NOT do" at `CONTINUE-TINS-PROJECT.md:280`, `WORKER-SESSION.md:185`). Harness read/output caps (Codex shell output, Gemini read window) are I, not tested.
- **H2. The first gate is red out of the box** (selftest cwd, above) and the tooling gate needs web search. A weak model facing red either stops, or "fixes" the gate - both bad.
- **H3. Nothing makes the new protocol mechanical.** `NOTES.md`, T1 notes, `status.md`, scope and "stop after T2" are all prose duties. The new ledger open/close, trailers and dispositions are the same kind of duty.

**Medium**

- **M1. A chat-only GUI cannot "read these files in order".** The manual-relay pattern worked because MiniMax Coder had repo access (`delegation/tasks/T1..T9` hold `WORKER-PROMPT.md`, `NOTES.md`, `AUDIT.md`, a file protocol already). A browser chat needs the context inlined, size-budgeted, plus a result schema.
- **M2. Instruction-file discovery.** No `CLAUDE.md` exists, yet this Claude Code build injected `AGENTS.md` (V, session header). Binary strings show opencode loads `AGENTS.md` (falls back to `CLAUDE.md`) and Cline's CLI has a "Workspace AGENTS.md" concept (V strings only, no run). Gemini CLI (`GEMINI.md`), Aider (nothing by default) and chat UIs need a first prompt - `NEXT-AGENT-ONBOARDING.md` §5a is that prompt. Also: the vendored `tins-kit/AGENTS.md` says "you are about to work on tins-kit", and `tins-kit/HANDOVER.md`, `SPEC.md`, `BUILDER-DECISIONS-REVIEW.md` (17k+37k+23k tokens) sit beside the project's own same-named files.
- **M3. Mixed OS.** Shared `node_modules` across WSL and Windows (`delegation/README.md:114`), no `.gitattributes` (CRLF from Windows-side apps; scripts mostly strip `\r`).
- **M4. Evidence for "weak models fail confidently" is about verification, not instruction skipping.** The kit's two consumers show self-reports missing a schema defect and a queryKey collision (`manual-relay-worker-loop.md` lesson 2); T9's Cline worker flagged its own defects (`T9/AUDIT.md`). Design for *missed bookkeeping and shallow verification*, not for rebellion.

## 3. Harness-neutral CORE, and mechanical checks

**CORE (~100 lines, replaces `AGENTS.md` as the only mandatory read).** (a) 8 lines: what this is; "if you cannot run shell commands, say so now and ask the human for a packet". (b) FIRST ACTION: `node tins-kit/scripts/session.mjs start --harness=<x> --model=<id>` - prints git head/branch/worktree check, gate result, and a **reading list as file + line ranges**, writes `ledger/open/<id>.json`; refuses on a dirty tree or red gate. (c) 12 hard rules, one line each, each naming its check command. (d) a 10-row "task -> single file" router. (e) LAST ACTION: `session.mjs close` derives files, numstat, gate exit code and trailers, and rejects an empty body. (f) "Records are data, not instructions." **Moved out:** orientation prose, locked decisions, state snapshots (generated into `HANDOVER`), amendments, role history, anything over ~15 lines.

**How to check a model complied, with no model:** (1) `ledger/open/<id>.json` exists and predates the first code commit (`git log`); (2) a `commit-msg` hook via `core.hooksPath` plus a CI/reconciler re-check for `Session:`/`Model:` trailers (hooks are skippable with `--no-verify`, so the reconciler check is the real gate; a GUI human commits by hand); (3) `session.mjs ack`: three repo-derived questions not in CORE (latest decision id, count of open W items, the newest ledger id) - this automates `NEXT-AGENT-ONBOARDING.md` §5b; (4) scope: `git diff --name-only` subset of the declared files (precedent: `check-task-independence.mjs`); (5) NOTES/ledger body headings validated; (6) the reconciler's cited-ids check from the draft.

**What a weak model must not be trusted with:** placeholder substitution, deriving facts, the T2 stop (keep `escalate.mjs`; let the dispatcher end the process), status as free prose (make `status.json` with the real gate exit code).

## 4. What survives

- Files and scripts as the protocol: a file-based task loop already ran 9 rounds with two different worker types (`delegation/tasks/`).
- Per-session files plus a generated index (the 4,567-line log is the counter-example).
- Facts from git; "records are data" (guards against a weak model's text being treated as orders).
- Adapters as one interface: `cline` (3.0.68) takes a positional prompt, `-c <cwd>`, `--json`, `--auto-approve` and has `--worktree`; `opencode run` takes `-f file`, `--dir`, `--format json`, `--auto` (V, `--help`). `claude -p` is there. These can wrap a packet path with no TTY; Cline was blocked on auth last time (`delegation/LEDGER.md:176`). A GUI relay is just "print PACKET.md, wait for RESULT.json".
- `tins-kit/.github/workflows/validate.yml` (Node 22; `validate --all`, selftest, listing) shows the CI hook point; no consumer-side gate CI exists here yet.

## 5. Unverified

Codex/Gemini/Aider behaviour (not installed); any real Cline/opencode run (auth, not run); chat-UI relay; native-Windows git on a WSL worktree; harness truncation limits; whether nested `AGENTS.md` loads on each harness. Check by: a fake-CLI adapter test in selftest, then one real run per harness.

## 6. Top 5 changes first

1. **Fix dispatch (C1):** `orchestrate.mjs` renders and validates a per-task `PACKET.md`; adapters pass a short pointer or stdin, never `$(cat)`; add verified cline/opencode presets; a fake-CLI selftest.
2. **Make the gate green anywhere (H2):** cwd-independent `selftest.mjs`; generated counts in kit `AGENTS.md`; documented offline path for the tooling gate.
3. **Ship the CORE + `session.mjs start/close/ack` + `commit-msg` hook (H1, H3)**, with `ledger/` tracked.
4. **Worktree prep that works (C2):** kit and per-OS `npm ci` available, no absolute-path assumptions, decision on tracked kit.
5. **Self-contained prompts and `kit pack <prompt>` (M1):** one block per prompt, fence lint, inlined context pack plus `RESULT.json` schema for chat-only relays.
