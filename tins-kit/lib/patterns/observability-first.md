# `observability-first` — kit pattern

> **The first 7 runbooks you need.** The pattern is the runbook template + the 5
> alerts that every multi-tenant consumer will hit. "Observability" means: when a user
> reports a problem at 02:00, you have a 5-minute path from "the page is broken" to
> "this is the cause and here's the fix."
>
> **Source:** `atal-incubation/incubos/docs/runbooks/` (the 7 runbooks: `app-down.md`,
> `database-unreachable.md`, `redis-down.md`, `s3-down.md`, `outbox-stuck.md`,
> `auth-down.md`, `deploy-failed.md`), `incubos/src/lib/logger.ts` (OTel + structured
> JSON logging), `incubos/src/app/api/health/route.ts` (liveness vs. readiness split).

---

## 0. Why this exists

Three truths recur in the reference projects:

1. **Multi-tenant apps break in tenant-specific ways.** A single tenant's S3 bucket
   returns 503 for 10 minutes, and 1/12 of the dashboard hangs. Without per-tenant
   metrics, the operator doesn't know *which* tenant, and the runbook devolves into
   guessing.
2. **Health checks that touch the DB are not health checks.** `GET /api/health` that
   runs `SELECT 1` returns 200 only when *all* dependencies are up. If Postgres is
   down, the load balancer marks every replica unhealthy and the whole app falls over.
   The fix is the **liveness / readiness split**: liveness = "the process is alive"
   (always 200), readiness = "I can serve traffic" (checks DB, returns 503 if not).
3. **"It works on my machine" is the most expensive debugging session.** The first
   time a consumer hits a multi-tenant bug without a runbook, they spend 3 hours
   finding the cause. The seventh time, with runbooks, they spend 3 minutes.

The pattern ships a **runbook template** and **5 must-have alerts** so the consumer
doesn't have to invent them.

---

## 1. The 3 lessons, in detail

### Lesson 1 — The runbook template (5 sections, every time)

```md
# <Symptom name> — runbook

> **When you read this:** the alert "<name>" is firing, OR a user reported
> "<exact symptom>". This runbook takes you from "alert is red" to "fixed" in
> <5–15> minutes.

## 1. Confirm the symptom
- Which environment? (prod / staging / local)
- Which tenants? (run: `SELECT id, name FROM tenants WHERE id IN (...)` or check the
  Prometheus `tenant_id` label)
- When did it start? (check the deployment timeline in <tool>)
- Is the symptom getting worse, stable, or recovering?

## 2. Check the dependency
- <Dependency>: <command or URL>
- <Dependency>: <command or URL>
- <Dependency>: <command or URL>

## 3. The most likely cause (and the fix)
<Describe the 80%-case root cause + the 1–2 line fix.>

## 4. The less-likely causes
- <Cause 1>: how to confirm, how to fix
- <Cause 2>: how to confirm, how to fix
- <Cause 3>: how to confirm, how to fix

## 5. Postmortem checklist
- [ ] Write a 1-paragraph incident report (what, when, impact, fix, prevention)
- [ ] Add the new failure mode to this runbook if not present
- [ ] Add a regression test if possible
- [ ] Notify the affected tenants (email template in `templates/notifications/`)
```

### Lesson 2 — The 5 must-have alerts (every multi-tenant consumer ships these)

| Alert | Symptom | Threshold | Where it points |
|---|---|---|---|
| **Liveness fail** | `GET /api/health?check=liveness` ≠ 200 for 1m | 1 minute | `runbooks/app-down.md` |
| **Readiness fail** | `GET /api/health?check=readiness` ≠ 200 for 2m | 2 minutes | `runbooks/database-unreachable.md` |
| **Outbox stuck** | `NotificationOutbox` rows with `status='pending' AND created_at < now() - 5m` > 100 | 5 minutes | `runbooks/outbox-stuck.md` |
| **Job queue retry-loop** | `JobQueue` rows with `attempts >= 3 AND status='pending'` > 10 | 5 minutes | `runbooks/outbox-stuck.md` |
| **Auth fail rate** | `5xx` rate on `/api/auth/login` > 5% over 5m | 5 minutes | `runbooks/auth-down.md` |

The **liveness** and **readiness** split is critical. Source:
`incubos/src/app/api/health/route.ts` — liveness is `200` always (returns
`{ status: 'ok' }`); readiness runs the DB ping and returns `503` if it fails.

### Lesson 3 — Per-tenant metrics labels

Every log line and every metric carries the `tenant_id` label. The structured logger
in `incubos/src/lib/logger.ts` uses OTel and always includes `tenant_id` in the
attribute set. This means the runbook's "which tenants are affected?" step is a single
Prometheus query:

```promql
sum by (tenant_id) (
  rate(http_requests_total{status=~"5.."}[5m])
)
```

Without the `tenant_id` label, the operator is blind. With it, they know exactly which
tenant's S3 bucket is misbehaving.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — `GET /health` that touches the DB

```ts
// ❌ WRONG — load balancer kills the replica when DB is down
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;  // touches DB
  return Response.json({ status: 'ok' });
}

// ✅ RIGHT — liveness is free, readiness pays the cost
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('check') === 'readiness') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return Response.json({ status: 'ok' });
    } catch (e) {
      return Response.json({ status: 'fail', error: e.message }, { status: 503 });
    }
  }
  return Response.json({ status: 'ok' });  // liveness: always 200
}
```

### Anti-pattern 2 — Runbooks written after the incident

The temptation is to write a runbook *after* the 3am incident, when you finally
understand the bug. By then, you've forgotten the exact symptom, the exact stack
trace, the exact "I tried X, it didn't work" sequence. The pattern: **write the
runbook before the incident, even if the cause is "TBD."** The structure matters more
than the answer.

### Anti-pattern 3 — `console.log` in production

Every log line goes through the structured logger (`logger.info({ tenantId, action, ... }, 'message')`).
No bare `console.log`. No `JSON.stringify(obj)`. The logger is the one place that
formats, attaches the trace ID, filters by `tenant_id`, and ships to your aggregator.
The consumer's first PR after adopting the kit should rip out all `console.log` and
replace with the logger.

---

## 3. When this pattern changes

- **When the consumer adds a new external dependency** (e.g. a new S3-compatible blob
  store, a Redis cache, a search engine): write a new runbook for it. Add a new
  readiness check. Add a new alert.
- **When the consumer moves from a single-region to multi-region deployment**: the
  liveness check must be region-local (not "the global LB is up"). Add a region label
  to every metric.
- **When the consumer starts running cron jobs** (outbox flush, nightly reports): add
  alerts for "job did not run in 2× its expected interval." A cron job that silently
  stops is worse than one that crashes — at least a crash produces a stack trace.

---

*— End of `observability-first` pattern. See also: `templates/runbook-template.md`
(to be added in a future kit release), `lib/tenant-rls/README.md` §"Per-tenant
audit."*
