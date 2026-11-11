# `lib/docs-guardian` — kit code module

> **The self-maintaining docs system.** Pure-TS types + `loadDocMap` +
> `checkDocFreshness` + `countReferences`. The consumer's CLI script
> (`scripts/docs-guardian.mjs`) wraps this with the filesystem scan.
>
> **Source:** `atal-incubation/incubos/docs/DOC-MAP.md` +
> `atal-incubation/scripts/docs-guardian.mjs` (the canonical implementation,
> focused). See `lib/patterns/pinned-deps.md` for the related
> "manifest-in-lockstep" discipline.

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/docs-guardian/ src/lib/docs-guardian/
cp tins-kit/scripts/docs-guardian.mjs scripts/
```

The consumer then writes a `docs/DOC-MAP.md` that maps each area to the
doc files that must mention it, and runs `node scripts/docs-guardian.mjs`
in CI to catch stale docs.

---

## The DOC-MAP.md format

```md
# DOC-MAP.md — what each doc must mention

## API routes
- docFiles: ['docs/api.md', 'README.md']
- staleCheck: guardian
- freshKeywords: ['/api/health', '/api/auth/login', '/api/tenants']
- sourceGlobs: ['src/app/api/**/*.ts']

## Prisma models
- docFiles: ['docs/schema.md']
- staleCheck: guardian
- freshKeywords: ['User', 'Tenant', 'Deal', 'Contact']
- sourceGlobs: ['prisma/schema.prisma']

## Env vars
- docFiles: ['.env.example', 'README.md']
- staleCheck: manual
```

---

## API

### `DocMap`, `DocMapEntry`, `DocArea`

The types. `DocArea` is a controlled vocabulary: `'API routes'`, `'Prisma
models'`, `'Env vars'`, `'UI pages'`, `'Cron jobs'`, `'SQL migrations'`,
`'Lib modules'`, `'Prompts'`, `'Schemas'`, `'Templates'`, `'Scripts'`,
`'Patterns'`, `'Docs'`. The consumer may add custom areas; the kit's
`ALL_DOC_AREAS` is the canonical list.

### `loadDocMap(json)`

Parse a JSON-serialised `DocMap` (e.g. read from `docs/DOC-MAP.json`).
Validates the shape (every entry has `docFiles` + `staleCheck`).

```ts
import { loadDocMap } from '@/lib/docs-guardian';
import docMapJson from '../docs/DOC-MAP.json';

const map = loadDocMap(docMapJson);
```

### `checkDocFreshness(sourceRefs, docRefs, docMap)`

The freshness check. Returns `{ pass, warn, fail }`:

- **pass** — area is fresh (doc has enough references).
- **warn** — area is thin (source has 5+ refs, doc has less than half).
- **fail** — area is missing (source has refs, doc has zero).

```ts
import { checkDocFreshness } from '@/lib/docs-guardian';

const result = checkDocFreshness(
  { 'API routes': 12, 'Prisma models': 8, 'Env vars': 5 },
  { 'API routes': 6, 'Prisma models': 8, 'Env vars': 0 },
  map
);
// result.fail: ['Env vars: source has 5 reference(s) but doc has 0']
// result.warn: ['API routes: source has 12 reference(s) but doc has only 6 (looks thin)']
// result.pass: ['Prisma models: source=8, doc=8']
```

### `countReferences(keywords, text)`

Count the number of `keywords` (case-insensitive) that appear in `text`.
The CLI script uses this to count "how many API routes does the doc
mention?" by passing the route paths as keywords.

```ts
import { countReferences } from '@/lib/docs-guardian';

const count = countReferences(['/api/health', '/api/auth/login'], docText);
// → 2 if both appear
```

---

## The 3 rules

### 1. The DOC-MAP is the source of truth

`docs/DOC-MAP.md` (or `docs/DOC-MAP.json`) is the canonical mapping. The
CLI script reads it, scans the source, scans the docs, and reports
mismatches. The kit's `validate.mjs` checks that the DOC-MAP exists and
is non-empty.

### 2. `manual` means "human-check this"

Some areas don't lend themselves to automated freshness checks (e.g.
"is the project's mission statement still accurate?"). Mark these as
`staleCheck: manual` and the CLI script will print a reminder but not
fail.

### 3. The CLI script is the gate

The `docs-guardian` module is pure-TS (no I/O). The CLI script does the
I/O. The CLI script exits non-zero on any `fail` result. Consumers wire
it into CI (the same way they wire `validate.mjs` into CI).

---

## When to extend

- **If the consumer adds a custom area** (e.g. `'Email templates'`):
  add it to the `DocArea` type, add it to `ALL_DOC_AREAS`, and write a
  DOC-MAP entry.
- **If the consumer wants per-area severity** (some areas fail, others
  warn): extend `checkDocFreshness` with a per-area `severity` field.
- **If the consumer wants HTML output** (for a CI badge): wrap the
  `checkDocFreshness` result in a small HTML renderer.

---

## Tests

See `tests/docs-guardian.test.ts` for the 3-case test suite: happy-path
(freshness check returns pass), edge-case (empty source refs), error-case
(loadDocMap throws on malformed JSON).

---

*— End of `lib/docs-guardian/README.md`. See also:
`lib/patterns/pinned-deps.md` (the related manifest-in-lockstep discipline),
`scripts/docs-guardian.mjs` (the CLI).*
