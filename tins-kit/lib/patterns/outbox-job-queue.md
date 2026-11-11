# `outbox-job-queue` — kit pattern

> **The canonical recipe for "decouple email delivery from request handling" + the
> 3 tables you need: NotificationOutbox, JobQueue, CronLog.** Self-contained.
>
> **Source:** atal-incubation (the canonical implementation, with `outbox-cron` and
> `jobs-cron` containers in `docker-compose.yml`).

---

## 0. Why this exists

The naive way to send an email from a request handler is: call `nodemailer.sendMail()`
inside the route. This trips three non-obvious bugs:

1. **Latency.** A 200ms SMTP roundtrip adds 200ms to the user's request. Sometimes
   30s if the SMTP server is slow.
2. **Failure mode.** A 500 from SMTP means the user's transaction is rolled back —
   even though the user's *action* succeeded, the email (a side effect) is the
   reason the response is 500.
3. **Retries.** SMTP is unreliable. A 30-second timeout needs a retry; a retry needs
   a state machine; a state machine needs a table.

The pattern: write the email to a `NotificationOutbox` row inside the same
transaction as the user's action, and have a separate cron job deliver it. Same for
background jobs (PDF generation, ERPNext company creation, WhatsApp sends) — write
a `JobQueue` row inside the transaction, a cron worker picks it up.

---

## 1. The 3 tables, in detail

### NotificationOutbox

```prisma
model NotificationOutbox {
  id             String   @id @default(cuid())
  tenantId       String
  recipientEmail String
  recipientName  String
  subject        String
  htmlBody       String   @db.Text
  status         OutboxStatus @default(PENDING)  // PENDING / PROCESSING / SENT / FAILED
  attempts       Int      @default(0)
  lastAttemptAt  DateTime?
  nextRetryAt    DateTime?
  errorMessage   String?  @db.Text
  processedAt    DateTime?
  createdAt      DateTime @default(now())

  @@index([status, nextRetryAt])
  @@index([tenantId])
}
```

The cron worker (`POST /api/cron/flush-outbox`, every 60s) uses `SELECT FOR UPDATE
SKIP LOCKED` to atomically claim a batch of 50 PENDING rows whose `nextRetryAt <=
now()`. This prevents two workers from double-sending the same email.

```sql
UPDATE "NotificationOutbox"
SET status = 'PROCESSING', "lastAttemptAt" = NOW()
WHERE id IN (
  SELECT id FROM "NotificationOutbox"
  WHERE status IN ('PENDING', 'PROCESSING')
    AND "nextRetryAt" <= NOW()
    AND attempts < 5
  ORDER BY "nextRetryAt" ASC
  LIMIT 50
  FOR UPDATE SKIP LOCKED
)
RETURNING id, "recipientEmail", "recipientName", subject, "htmlBody", attempts, "nextRetryAt";
```

### JobQueue

```prisma
model JobQueue {
  id          String   @id @default(cuid())
  tenantId    String?
  type        JobType  // GENERATE_PDF / ERP_CREATE_COMPANY / SEND_INVESTOR_EMAIL
  payload     Json
  status      JobStatus @default(PENDING)  // PENDING / RUNNING / COMPLETED / FAILED / DEAD
  attempts    Int      @default(0)
  maxAttempts Int      @default(5)
  lastAttemptAt DateTime?
  nextRunAt   DateTime  @default(now())
  errorMessage String?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([status, nextRunAt])
  @@index([tenantId])
}
```

Same `SELECT FOR UPDATE SKIP LOCKED` pattern, same `outboxNextRetryDelayMs(attempt)`
retry schedule (0 → 5m → 30m → 2h → 24h). After 5 attempts the row goes to
`DEAD` and an admin needs to inspect.

### CronLog

```prisma
model CronLog {
  id          String   @id @default(cuid())
  jobName     String
  startedAt   DateTime @default(now())
  completedAt DateTime?
  status      CronRunStatus @default(RUNNING)  // RUNNING / SUCCESS / PARTIAL / FAILED
  processed   Int      @default(0)
  errors      Int      @default(0)
  message     String?

  @@index([jobName, startedAt])
}
```

Every cron job writes a `CronLog` row on start and updates it on finish. This is the
kit's "silent failures become visible" rule. A cron that runs every 60s but never
writes a `CronLog` row is broken — find it in the dashboard.

---

## 2. The 3 lessons, in detail

### Lesson 1 — Always write the outbox row in the same transaction

The killer bug: the user's mutation succeeds, then the SMTP call fails, the user
sees a 500, and they retry. Now there are two outbox rows (or the outbox row was
written in a different transaction and is in a confused state).

The fix: outbox writes are inside the user's transaction:

```ts
await prisma.$transaction(async (tx) => {
  await tx.something.create({ data: ... });
  await tx.notificationOutbox.create({ data: { ... } });
});
```

Either both succeed or both fail. The user sees a 200 with the email queued, or a
500 with nothing changed. The cron worker delivers the email asynchronously.

### Lesson 2 — `SELECT FOR UPDATE SKIP LOCKED` is the multi-worker safety net

If you deploy 2 app instances (or 2 cron worker containers), the same email is at
risk of being sent twice. The naive "SELECT ... UPDATE" approach doesn't help —
two workers can both read the same row, both decide to send it, and the second
write succeeds with stale data.

`FOR UPDATE SKIP LOCKED` is the answer. The first worker locks the row, the second
worker's `SELECT` skips it. After the first worker commits (status = SENT), the
second worker's transaction sees the row in its new state and moves on.

### Lesson 3 — The retry schedule is exponential, not linear

The 5-attempt schedule: 0 → 5m → 30m → 2h → 24h. The `outboxNextRetryDelayMs(attempt)`
function (in the kit's `lib/retry.ts`) returns the right delay. Linear retry (every
5 minutes) hammers a failing SMTP server; exponential gives the server time to
recover.

After 5 attempts: the row goes to FAILED. The user-facing UI surfaces "this email
failed to send" with a "retry now" button. The cron admin dashboard surfaces "X
emails failed in the last 24h" as an alert source.

---

## 3. The 2 known anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| Send the email in the route handler (not the outbox) | 200ms latency on every request, no retry, no audit. |
| `UPDATE ... WHERE status = 'PENDING'` without `FOR UPDATE SKIP LOCKED` | Two workers race; one sends twice, the other sends zero. |

---

## 4. When this changes (the V2 upgrade path)

- **If you add a new notification type** (push, SMS, in-app-only), add a column to
  `NotificationOutbox` for the channel OR a separate `NotificationChannel` table.
  The kit's pattern is "one outbox per channel."
- **If you need priority queuing** (e.g. transactional emails ahead of marketing),
  add a `priority Int` column to `NotificationOutbox` and order by it in the
  cron query.
- **If you need a job scheduler with cron expressions** (run at 09:00 every Monday),
  add a `scheduledFor DateTime` column to `JobQueue` and adjust the cron query.

---

*— End of pattern. The 1,000-line rationale lives in
`atal-incubation/src/lib/retry.ts` + the cron workers under `src/app/api/cron/`
and `src/app/api/jobs/`. This pattern is the focused 1-page version.*

---

*— End of `outbox-job-queue` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
