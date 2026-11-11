# Prompt: RELEASE-CHECKLIST

> **The prompt that runs at the end of Mode A, before shipping publicly.** Closes
> the TINS loop: the spec author wrote the spec, the builder implemented it, the
> reviewer audited it — now is the moment of truth: "is this ready to ship?"
>
> **Source:** `Data-cleaning-script/v4/build-bundle.ps1` (the 6-decision
> discipline: "all 6 PowerShell scripts embedded, no hardcoded paths,
> secrets-scanner passes, version is bumped, .gitignore is clean, build
> artefact exists"), `Jayshankar` (the `private-to-public` pattern: every
> decision that was "private" during dev must be made "public" at release),
`atal-incubation/incubos/DEPLOYMENT.md` (the "validate before deploy" gate:
`pnpm typecheck`, `pnpm build`, `pnpm test`, smoke test, 5 min of staging soak).

---

## When to use

You (an LLM session) have just completed Mode A (the canonical "auth + protected
route end-to-end" milestone) and the user has said "ship it." Run this prompt
*before* deploying to production. The output is a single decision: "go" or "no-go."

If "no-go," the prompt enumerates the blockers. Fix them, re-run the prompt.

---

## The prompt

```
You are about to release a TINS consumer to production. This is the final gate.
Run this checklist. If anything is amber, you must fix it before deploying. If
anything is red, you MUST NOT deploy.

The consumer is: <consumer name>
The release version is: <semver, e.g. 0.1.0>
The deployment target is: <URL, e.g. https://app.example.com>

---

## 1. Type-check + build + test (red/green)

- [ ] `pnpm typecheck` (or `npm run typecheck`): green
- [ ] `pnpm build`: green
- [ ] `pnpm test`: green
- [ ] `pnpm test:e2e` (if exists): green

**If any is red, STOP. Do not deploy.** Fix and re-run.

---

## 2. The smoke test (the kit's `tins-kit/AGENTS.md` §2 5-command test, adapted)

For Next.js + Prisma:
- [ ] `curl -s -o NUL -w "%{http_code}" http://localhost:3000/` → 200
- [ ] `curl -s -o NUL -w "%{http_code}" http://localhost:3000/api/health?check=liveness` → 200
- [ ] `curl -s -o NUL -w "%{http_code}" http://localhost:3000/api/health?check=readiness` → 200
- [ ] `curl -s -X POST .../api/auth/login -d @login.json` → 200, Set-Cookie present
- [ ] `curl -s -b cookies.txt .../api/<protected>` → 200

For Vite + Supabase:
- [ ] `curl -s -o NUL -w "%{http_code}" http://localhost:5173/` → 200
- [ ] `curl -s -o NUL -w "%{http_code}" <supabase-url>/auth/v1/health` → 200
- [ ] `curl -s -o NUL -w "%{http_code}" <supabase-url>/rest/v1/<table>?select=count` → 200
- [ ] Login flow: form submits, JWT set, protected route renders
- [ ] Sign-out flow: cookie cleared, protected route 401s

**If any is red, STOP. Do not deploy.** Fix and re-run.

---

## 3. The 5-minute staging soak (red/green)

- [ ] Deploy to staging (NOT production).
- [ ] Hit the smoke test endpoints 10 times in 5 minutes. No 5xx.
- [ ] Check the structured logs for ERROR-level entries: zero in 5 minutes.
- [ ] Check the readiness check: still 200 after the soak.

**If any is red, STOP. The deployment is broken in a way the smoke test missed.**

---

## 4. The "private-to-public" sweep (red/amber/green)

For every decision that was "private" during dev (a TODO, a hack, a placeholder),
is it now "public-safe"?

- [ ] No `console.log` in production code (use the structured logger)
- [ ] No hardcoded URLs, secrets, or env-specific values
- [ ] No `// TODO: fix this before launch` in critical paths
- [ ] No `localhost` in any client-facing URL
- [ ] No `DEBUG=true` or `NODE_ENV=development` in the production env
- [ ] No test fixtures in the production bundle (e.g. fake users, fake data)
- [ ] No "demo" or "test" tenants in the seed (or the seed is excluded from prod)

**Amber = fix before deploy. Red = STOP.**

---

## 5. The documentation gate (red/amber/green)

- [ ] `SPEC.md` is up to date with the as-built behaviour
- [ ] `HANDOVER.md` W-queue is current (no `⏳` items that are actually `✅`)
- [ ] `AGENTS.md` smoke test still works on a fresh clone
- [ ] `BUILDER-DECISIONS-REVIEW.md` has every builder decision recorded
- [ ] `REVIEWER-DECISIONS-REVIEW.md` has the Mode A approval
- [ ] `CHANGELOG.md` (if exists) has the release entry
- [ ] `README.md` (if public) has the install / run / deploy instructions

**Amber = fix before deploy. Red = STOP.**

---

## 6. The security sweep (red/amber/green)

- [ ] `.env*` is in `.gitignore` and NOT in the deploy artefact
- [ ] Secrets are in the secrets manager, not in `docker-compose.yml` or `app.config.ts`
- [ ] JWT keys are pinned to the env, not generated at boot
- [ ] CORS is restricted to the production origin (not `*`)
- [ ] CSP headers are set (or explicitly deferred to a future release)
- [ ] Rate limiting is in place for `/api/auth/login` (e.g. 5 attempts / 5 min)
- [ ] The RLS policies (if any) are enabled AND forced (not just enabled)

**Amber = fix before deploy. Red = STOP.**

---

## 7. The observability gate (red/amber/green)

- [ ] The 5 must-have alerts (per `lib/patterns/observability-first.md`) are
  configured in the monitoring tool
- [ ] The 5 must-have runbooks are linked from the runbook index
- [ ] The health check endpoint has the liveness / readiness split
- [ ] The structured logger is writing to the aggregator (not stdout)
- [ ] The per-tenant metric label is set on every metric

**Amber = configure before deploy. Red = STOP.**

---

## 8. The "backout plan" (must be green)

- [ ] The previous release can be re-deployed in <10 minutes (the deploy script
  has a `--rollback` flag, or the previous image is tagged and ready)
- [ ] The DB migration is backward-compatible (or has a backout migration)
- [ ] The "kill switch" for any new external dependency is documented (e.g. "if
  S3 is down, set `S3_ENABLED=false` and restart")

**If red, you must not deploy without a backout plan.**

---

## 9. The "go / no-go" decision

After the 8 sections above, record the result in `REVIEWER-DECISIONS-REVIEW.md`:

```md
## R<N> — Release v<version> go/no-go

**Date:** <YYYY-MM-DD>
**Reviewer:** <this session>
**Subject:** <consumer name> v<version> release
**Status:** ✅ go · 🟡 go after fixes · ❌ no-go

**Section 1 (type-check + build + test).** <red/green>
**Section 2 (smoke test).** <red/green>
**Section 3 (5-min staging soak).** <red/green>
**Section 4 (private-to-public sweep).** <red/amber/green>
**Section 5 (documentation gate).** <red/amber/green>
**Section 6 (security sweep).** <red/amber/green>
**Section 7 (observability gate).** <red/amber/green>
**Section 8 (backout plan).** <red/green>

**Decision.** <go / go-after-fixes / no-go>

**Blockers (if any).**
- <blocker 1, with the specific fix>
- <blocker 2, with the specific fix>
```

**If "go":** proceed to deploy.
**If "go-after-fixes":** fix the amber/red items, re-run the gate, then deploy.
**If "no-go":** do not deploy. Schedule a follow-up review.

---

## Constraints

- **Do not skip sections.** Each is a real failure mode the kit's reference
  projects have hit.
- **Do not "amber" a red item.** A red item is a real failure; amber is "this
  should be fixed but won't break the deploy." Be honest.
- **Do not deploy without §8 green.** A backout plan is non-negotiable for any
  consumer with user data.

---

*— End of `RELEASE-CHECKLIST` prompt. See also: `lib/patterns/observability-first.md`
(the 5 alerts + 5 runbooks), `lib/patterns/pinned-deps.md` (the `.gitignore` /
lockfile discipline), `lib/patterns/env-vs-config.md` (the secrets / env split).*
