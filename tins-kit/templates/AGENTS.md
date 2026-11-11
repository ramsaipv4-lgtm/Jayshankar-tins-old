# AGENTS.md — One-page onboarding for a new LLM session

> **Read this file first.** It is the shortest path to understanding the project
> state without re-deriving it. If you are a human, this file is the
> machine-facing counterpart to `TRAININGS.md` (which teaches you to debug).
>
> **Last updated:** <YYYY-MM-DD>

---

## 0. The 60-second orientation

- **Product:** <one-line description>
- **Methodology:** TINS (There Is No Source) — spec-first. `SPEC.md` is the
  canonical source for behaviour; code is generated from it.
- **Stack:** <framework, language, key libraries>
- **Dev port:** <port number>
- **State:** <one-line "what's working right now">

---

## 1. The 5 files you must read (in this order)

| # | File | Why | Time |
|---|---|---|---|
| 1 | `HANDOVER.md` | Operational state, W-queue, gotchas, handover protocol | 10 min |
| 2 | `TRAININGS.md` | Debugging wisdom (if it exists) | 20 min |
| 3 | `SPEC.md` | The spec, single source of truth for behaviour | 15 min skim |
| 4 | `feature-walkthrough.md` (if exists) | Every feature, by role, with API contracts | skim + ref |
| 5 | `AGENTS.md` | This file | done |

---

## 2. The 5 commands you should run first

```powershell
# 1. Confirm the dev server is up
Get-NetTCPConnection -LocalPort <port> -ErrorAction SilentlyContinue | Select-Object LocalPort
curl -s -o NUL -w "GET / -> %{http_code}\n" http://localhost:<port>/

# 2. Confirm DB connectivity
curl -s -o NUL -w "liveness %{http_code}\n" http://localhost:<port>/api/health
curl -s -o NUL -w "readiness %{http_code}\n" 'http://localhost:<port>/api/health?check=readiness'

# 3. Confirm login works
curl -s -X POST http://localhost:<port>/api/auth/login -H 'Content-Type: application/json' --data-binary "@login.json"

# 4. Confirm protected route works (with auth)
curl -s -c cookies.txt -X POST http://localhost:<port>/api/auth/login ... -o NUL
curl -s -b cookies.txt http://localhost:<port>/api/<protected> | Select-Object -First 1

# 5. Confirm type-check is clean
pnpm typecheck
```

If any of these fail, consult `HANDOVER.md` §4 gotchas and `TRAININGS.md` before
doing anything else.

---

## 3. The standing rules (non-negotiable)

1. **<rule 1>**
2. **<rule 2>**
3. **<rule 3>**
4. **<rule 4>**
5. **<rule 5>**
6. **<rule 6>**
7. **<rule 7>**
8. **<rule 8>**

---

## 4. Quick reference for the LLM

- **<key fact 1>**
- **<key fact 2>**
- **<key fact 3>**
- **<key fact 4>**

---

## 5. If you find a bug or learn something new

Append it to:
- `HANDOVER.md §4` if it's a gotcha
- `TRAININGS.md` if it's a generalisable lesson
- `feature-walkthrough.md` if it's a feature behaviour
- `SPEC.md` if it's a behaviour that isn't already specified

Then update `HANDOVER.md` (§1 state, §3 snapshot) to reflect what changed.
Standing rule: leave the repo green (`pnpm typecheck` + `pnpm build`).

---

*— End of `AGENTS.md` template. See also: `tins-kit/AGENTS.md` (the kit's own
self-application, the gold standard).*
