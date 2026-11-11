# AGENT-BRIEF.md — the per-project onboarding

> **This is the first file a new LLM session reads in a consumer project.**
> It tells you exactly what to do, in order. No improvisation. No
> "I'll just dive in." Follow the 7 steps below. Always. The kit's
> `tins-kit/PIPELINE.md` is the universal methodology; this file is
> the project-specific extension.

---

## 0. Project context

- **Project:** `<PROJECT_NAME>`
- **Domain:** `<ONE_LINE>`
- **Stack:** `<FRAMEWORK> + <LANG> + <DB>`
- **Tenancy:** `<single-user | single-tenant | multi-tenant>`
- **Money:** `<none | yes — Decimal(18,4) + Zod regex + Prisma.Decimal>`
- **Mode:** `<Mode A (Demo) | Mode B (Pilot) | Mode C (Production)>`
- **Vendored kit:** `./tins-kit/` (the source of truth is `<WORKSPACE_ROOT>/tins-kit/`; this is a copy)

---

## 1. The 7 steps (do them in order, every session)

### Step 1 — Read these 4 files, in this order

| # | File | Time |
|---|---|---|
| 1 | `./tins-kit/PIPELINE.md` | 5 min |
| 2 | `./tins-kit/AGENTS.md` (the kit's standing rules) | 5 min |
| 3 | `./HANDOVER.md` (this project's state, W-queue, gotchas) | 10 min |
| 4 | `./SPEC.md` (the spec — what this project is) | 15 min skim |

### Step 2 — Pick up the next W (or run coverage)

```bash
# See the W-queue
cat HANDOVER.md | grep "### W"

# See which kit patterns apply to this project
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md
```

If a fresh W, mark it `in_progress` in HANDOVER.md. If the spec is empty
or you're starting Mode A, run `prompts/SPEC-AUTHOR.md` in a fresh
session.

### Step 3 — Spec first, code second

Edit SPEC.md (or BUILDER-DECISIONS-REVIEW.md) BEFORE writing code.
Then re-validate:

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
```

The validator must pass before you write a line of code.

### Step 4 — Build, record decisions

```bash
node tins-kit/scripts/decision-log.mjs builder \
  --title="<title>" \
  --context="<the problem>" \
  --decision="<the choice>" \
  --alternatives="<A> (rejected: <reason>); <B> (rejected: <reason>)" \
  --consequences="<what this enables>; <what this forecloses>"
```

### Step 5 — Mine your learnings

When you finish a W (or finish Mode A), mine the decisions for
kit-worthy patterns:

```bash
node tins-kit/scripts/kit-extract.mjs --consumer=.
# → writes ./kit-growth-candidates.md
# → exits 0 if no candidates, 1 if there are
```

If the script exits 1, a **kit-growth session is needed** at the
top-level kit root. That's a *separate* session — your job here is to
produce the candidates, the kit-growth session triages them.

### Step 6 — Pull the latest kit (when needed)

If the kit has grown since you last synced (check
`./tins-kit/.kit-sync.json`'s `syncedAt` field):

```bash
node tins-kit/scripts/kit-sync.mjs --to=./tins-kit
```

This pulls the latest patterns / modules / scripts from the top-level
kit into your vendored copy. Your project code is never touched.

### Step 7 — Leave the gate green, update HANDOVER, stop

```bash
node tins-kit/scripts/validate.mjs --spec=SPEC.md
node --test tins-kit/scripts/selftest.mjs
```

Both must exit 0. Then update HANDOVER.md (mark W done, add gotchas,
update state snapshot). The next session reads HANDOVER and picks up
where you left off.

---

## 2. The 5 commands (memorise these)

```bash
# What does the kit recommend for my project?
node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md

# Is my spec valid?
node tins-kit/scripts/validate.mjs --spec=SPEC.md

# Record a non-obvious decision
node tins-kit/scripts/decision-log.mjs builder --title="..." --context="..." --decision="..."

# Mine my learnings back to the kit (for the next kit-growth session)
node tins-kit/scripts/kit-extract.mjs --consumer=.

# Pull the latest kit
node tins-kit/scripts/kit-sync.mjs --to=./tins-kit
```

---

## 3. The non-negotiable rules (from the kit's standing rules)

1. **Spec first, code second.** No exceptions.
2. **The gate is green before you stop.** Always. A broken gate is
   worse than no gate.
3. **Decisions are recorded.** Every non-obvious choice goes into
   `BUILDER-DECISIONS-REVIEW.md` via `decision-log.mjs`.
4. **The vendored kit is read-only for the kit source.** Don't edit
   `./tins-kit/` to fix a kit bug — that's the source's job (the
   top-level kit, at `<WORKSPACE_ROOT>/tins-kit/`).
5. **The loop is closed.** Build → record → mine → (kit-growth) → sync.
   Every consumer contributes back to the kit.

---

## 4. Project-specific notes (the consumer fills this in)

- **Worst device that must work:** `<FILL IN>`
- **Worst network that must work:** `<FILL IN>`
- **Hosting target:** `<FILL IN>`
- **What is NOT in v1:** `<FILL IN — see SPEC.md §9>`
- **First user becomes admin?** `<yes / no / N/A>`
- **Multi-tenant?** `<yes / no>` (if yes, `lib/tenant-rls/` is adopted)
- **Money in scope?** `<yes / no>` (if yes, `lib/money-as-decimal/` is adopted)
- **PWA / offline?** `<yes / no>` (if yes, `lib/pwa-config/` is adopted)
- **Auth provider:** `<Supabase / NextAuth / Auth0 / custom JWT>`

---

## 5. If you get stuck

1. Re-read `./tins-kit/PIPELINE.md` (the universal methodology).
2. Re-read this project's `./HANDOVER.md` §4 (gotchas).
3. Run `node tins-kit/scripts/kit-coverage.mjs --spec=SPEC.md` to see
   which kit patterns might apply.
4. If the issue is a kit bug, fix it at the top-level kit root and
   `kit-sync.mjs` the fix to your project.
5. If the issue is a project bug, fix it in the project. Don't touch
   the kit.

---

*— End of `AGENT-BRIEF.md`. See also: `./tins-kit/PIPELINE.md` (the
universal methodology), `./tins-kit/VERSIONING.md` (the version
control strategy), `./tins-kit/AGENTS.md` (the kit's standing rules).*
