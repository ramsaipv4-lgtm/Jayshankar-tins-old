# `env-vs-config` — kit pattern

> **What's the difference between `DATABASE_URL` (the app reads it) and `POSTGRES_PASSWORD`
> (Docker compose reads it)?** The pattern is the split-the-files discipline that keeps
> secrets out of the source-of-truth and runtime config out of the build context.
>
> **Source:** `atal-incubation/incubos/docker-compose.yml` (the compose-level env:
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, all set at the container level,
  never read by the app), `atal-incubation/incubos/.env.local` (the app-level env:
  `DATABASE_URL`, `JWT_PRIVATE_KEY`, `S3_BUCKET`, all read by Next.js at runtime),
`Data-cleaning-script/v4/build-bundle.ps1` (the "env-before-build" gotcha: build fails
  if `SECRETS_SCAN_ENABLED=false` is not set *in the build environment*).

---

## 0. Why this exists

Two failure modes recur:

1. **Secrets in source control.** A developer sets `DATABASE_URL` in `.env.local`, then
   the file gets committed, then the production database password leaks. The fix is
   "secrets live in `.env*` which is in `.gitignore`, never in `docker-compose.yml` or
   `app.config.ts`."
2. **Build-time vs. runtime confusion.** The `Data-cleaning-script` build pipeline
   requires `SECRETS_SCAN_ENABLED=false` to be set in the *build* shell (so the
   compiler doesn't error on the embedded test fixture). But the *runtime* shell
   requires `SECRETS_SCAN_ENABLED=true` to actually enforce the rule. Setting one
   without the other produces a "build succeeds but ships an unsafe binary" or
   "build fails on a CI runner that has no env file."

The pattern: **three env files, three purposes, never overlap.**

---

## 1. The 3 lessons, in detail

### Lesson 1 — Three env files, three purposes

| File | Purpose | Read by | In git? | In `.gitignore`? |
|---|---|---|---|---|
| `.env.example` | Template (no real values, just keys) | Humans | **Yes** | No |
| `.env.local` | Local dev (real values for *this* dev's machine) | The app at runtime | **No** | **Yes** |
| `.env.production` | Production (real values, set by deploy pipeline) | The app at runtime | **No** | **Yes** |

The split:

- **`.env.example`** is the only file in git. It documents the *shape* of the env
  (every key the app reads), with placeholder values. A new contributor copies it to
  `.env.local` and fills in real values.
- **`.env.local`** is the only file the app reads in dev. It's in `.gitignore`. The
  app never reads `docker-compose.yml` env vars directly (the docker-compose sets them
  in the container's environment, which the app then reads).
- **`.env.production`** is set by the deploy pipeline (Vercel, Fly, your own CI). It's
  never on a developer's machine.

### Lesson 2 — Compose env vs. app env: who reads what

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: incubator         # compose env, postgres reads it
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # compose env, sourced from host
      POSTGRES_DB: incubos             # compose env
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://incubator:${POSTGRES_PASSWORD}@postgres:5432/incubos
      JWT_PRIVATE_KEY: ${JWT_PRIVATE_KEY}      # app env, app reads it
      S3_BUCKET: ${S3_BUCKET}                  # app env
    depends_on: [postgres]
```

The rule: **the app reads what it needs; the service reads what it needs; they don't
share names.** `POSTGRES_PASSWORD` is the *service's* env, the app never reads it
directly — it reads `DATABASE_URL` which embeds the password.

If a developer needs to find the password, they look at the service's env, not the
app's env. If a secret scanner audits the image, it scans the app's env (the only
place the password is constructed).

### Lesson 3 — Build-time vs. runtime: the `Data-cleaning-script` rule

The `Data-cleaning-script` v4 build pipeline (`build-bundle.ps1`) embeds 6 PowerShell
scripts into a single C# .exe. One of those scripts is the "secrets scanner" that
fails on a hardcoded password pattern. To allow the *test fixture* (which intentionally
contains a fake password) to compile, the build sets `SECRETS_SCAN_ENABLED=false`
in the build shell. But the *runtime* (the .exe) sets `SECRETS_SCAN_ENABLED=true` by
default and re-scans its own scripts at startup.

The pattern for any "build-time vs. runtime" env:

| Env var | Build shell | Runtime | What it does |
|---|---|---|---|
| `SECRETS_SCAN_ENABLED` | `false` (allow test fixture) | `true` (enforce) | The scanner runs at build AND runtime, but with different defaults |
| `NODE_ENV` | `production` (or `development`) | inherited from build | Controls logging, source maps, minification |
| `NEXT_PUBLIC_*` | set at build (inlined into client bundle) | n/a (read at build) | Public env vars the browser needs |

The mistake is to set `NODE_ENV=production` in the dev shell ("to test prod mode")
and then be surprised when the dev server doesn't show source maps. Each env var has
exactly one place it lives, and the `.env.example` documents *which*.

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — Secrets in `docker-compose.yml`

```yaml
# ❌ WRONG — password is now in the file, which is in git
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: hunter2

# ✅ RIGHT — sourced from host env or a secrets file
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

If a developer needs to override the password locally, they set it in their shell or
in a `.env` next to `docker-compose.yml` (which is in `.gitignore`).

### Anti-pattern 2 — One `.env` file for everything

```bash
# ❌ WRONG — .env is read by both build and runtime, secrets leak between them
DATABASE_URL=postgresql://user:pass@host/db
SECRETS_SCAN_ENABLED=false
NODE_ENV=production
```

The single-file approach means a dev who sets `SECRETS_SCAN_ENABLED=false` to fix a
local build accidentally ships a binary that doesn't enforce the rule. The fix is
the three-file split (`.env.example` / `.env.local` / `.env.production`) and a build
script that explicitly *does not* read `.env.local` — only the build-pipeline-set
env (CI env, Makefile, build.ps1).

### Anti-pattern 3 — App reading `POSTGRES_PASSWORD` directly

The app should construct `DATABASE_URL` from the compose-level env at startup
(`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`),
not import the password and reconstruct the URL itself. This means the app's source
code never references `POSTGRES_PASSWORD` — only `DATABASE_URL`. The app's `.env.example`
documents `DATABASE_URL`, not `POSTGRES_PASSWORD`. A secret scanner that audits the
app's image will find zero references to the service-level env.

---

## 3. When this pattern changes

- **When the consumer moves to a secrets manager** (AWS Secrets Manager, HashiCorp
  Vault, Doppler): the `docker-compose.yml` env block becomes a `secrets:` block
  referencing the manager. The app still reads `DATABASE_URL` at runtime, but the URL
  is constructed from the manager, not from a static env file.
- **When the consumer adds a frontend bundle** (Vite, Next.js): the public env vars
  (those accessible from the browser) must be prefixed (`VITE_*`, `NEXT_PUBLIC_*`)
  and set at build time, not runtime. The browser bundle is *built once* and the
  public env is *baked in*; the same source code cannot read different `NEXT_PUBLIC_*`
  values in dev vs. prod.
- **When the consumer adds a worker / cron process** (separate from the web app):
  the worker has its own env (the same `DATABASE_URL`, but also a `WORKER_CONCURRENCY`,
  a `JOB_POLL_INTERVAL`, etc.). Add those keys to `.env.example` and document them
  in the runbook for "Job queue retry-loop."

---

*— End of `env-vs-config` pattern. See also: `templates/.gitignore`,
`scripts/validate.mjs` §8.4 (the "no-secrets-in-source" check).*
