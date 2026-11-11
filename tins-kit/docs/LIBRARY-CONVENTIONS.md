# LIBRARY-CONVENTIONS.md — How to write a new `lib/` module

> **The conventions every `lib/<name>/` module must follow.** Read this before
> adding a new module to the kit. The kit's `validate.mjs` and `selftest.mjs`
> enforce these conventions — a module that doesn't follow them fails the
> gate.

---

## 1. Directory layout

```
lib/<name>/
├── index.ts           # the public API (export everything from here)
├── README.md          # the consumer-facing doc (install, import, use)
├── <impl files>.ts    # the implementation (split if >300 lines)
├── tests/
│   ├── <name>.test.ts # the test file (at least 3 cases)
│   └── fixtures/      # any test fixtures (data, SQL, etc.)
└── package.json       # ONLY if the module has its own deps (otherwise omit)
```

The validator (§8.2) checks this layout. A module missing any of
`index.ts`, `README.md`, `tests/<name>.test.ts` fails.

---

## 2. The `index.ts` shape

The `index.ts` file MUST export a single `default` object that contains
every public function. The consumer imports like:

```ts
import money from '@tins-kit/money-as-decimal';
const amt = money.fromString('100.00');
const formatted = money.format(amt);
```

**Rules:**

1. **One default export, an object.** The object is the module's namespace.
   Consumers do `import x from 'module'; x.fn()`.
2. **Named re-exports of the public API.** For tree-shaking, also export each
   function as a named export:
   ```ts
   export { fromString, toString, format, /* ... */ } from './money';
   export default { fromString, toString, format };
   ```
3. **No `internal/` exports leak.** If the module has internal helpers,
   they live in `<impl>.ts` files and are NOT re-exported from `index.ts`.
4. **Type-only exports are fine.** If a function returns a branded type
   (e.g. `MoneyString`), the type is exported as a named export.

---

## 3. The `README.md` shape

The README MUST have these sections, in this order:

1. **The one-line description** (the "what is this?" answer in 1 sentence).
2. **The 60-second orientation** (the kit's standard format: "This is X. It
   does Y. It assumes Z.").
3. **Install** (the exact `cp -r` or `pnpm add` command).
4. **API** (one subsection per public function, with a 5-line example).
5. **The 3 rules** (the 3 most-important "do this / don't do that" rules).
6. **When to extend** (3 bullets on how the module grows).
7. **Tests** (a pointer to the test file + the 3-case test summary).

The validator (§8.2) checks for each of these section headings (modulo
small wording variations).

---

## 4. The test file shape

The test file MUST have at least 3 cases:

1. **Happy-path** — the most common usage, end-to-end. Asserts the expected
   output exactly.
2. **Edge-case** — a non-obvious input (e.g. zero, negative, very large,
   empty string, unicode). Asserts the boundary behaviour.
3. **Error-case** — a known failure mode (e.g. division by zero, malformed
   input, missing dependency). Asserts the typed error or the rejection.

Additional cases are welcome. The selftest runs every case in isolation
(parallel safe, no shared state).

---

## 5. The naming convention

- **Module name** is `kebab-case`: `no-backend`, `money-as-decimal`,
  `tenant-rls`. Always lowercase, always dash-separated.
- **File names within the module** are also `kebab-case.ts`:
  `useLocalState.ts`, `clearLocalState.ts`, `isLocalStorageAvailable.ts`.
- **Function names** are `camelCase`: `fromString`, `withTenantTx`,
  `getPrismaClient`.
- **Type names** are `PascalCase`: `MoneyString`, `TenantTxContext`,
  `Session`.
- **Constant names** are `SCREAMING_SNAKE`: `MONEY_REGEX`, `TENANT_SCOPED`,
  `ZERO`.

---

## 6. The dependency rule

- **No external deps unless absolutely necessary.** Most kit modules have
  zero deps (the `no-backend` module is pure TS). The `money-as-decimal`
  module requires `@prisma/client` and `zod` because there's no way to do
  exact decimal arithmetic without `Prisma.Decimal` and no way to validate
  wire format without Zod.
- **If a dep is required, it goes in `package.json`** (the module's, not
  the consumer's). The consumer's `pnpm install` pulls it transitively.
- **No dev-deps in `package.json`.** Move them to `devDependencies` and
  the test file uses them via `import`.

---

## 7. The "no globals" rule

A module MUST NOT mutate global state. No monkey-patching, no
`globalThis` writes (except for SSR detection, which is allowed for the
`no-backend` module's `isLocalStorageAvailable`), no `process.env`
sneak-attacks at import time.

The `tenant-rls` module reads `process.env.DATABASE_URL` exactly once, in
`basePrisma` initialisation. No other reads.

If a module needs a config value, it takes it as a function argument.

---

## 8. The "single responsibility" rule

A module does ONE thing. `money-as-decimal` is money, not currency
conversion. `tenant-rls` is tenant scoping, not auth. `no-backend` is
localStorage, not cookies.

If a module grows to >500 lines, split it. The `tenant-rls` module
currently has the two-Prisma-clients + `withTenantTx` + RLS migration
helper. If a future requirement is "per-tenant schema routing", that
becomes a new module (`lib/tenant-schema`) and `tenant-rls` is unchanged.

---

## 9. The "versioning" rule

The module is part of the kit. It doesn't have its own version. The kit
is semver, and breaking changes to a module's API require a kit major
version bump.

If you need to make a breaking change:

1. Add a `## Migration` section to the module's README explaining how to
   upgrade.
2. Add a row to the kit's `BUILDER-DECISIONS-REVIEW.md` documenting the
   decision.
3. Bump the kit's version in `SPEC.md` §0.0.
4. Update every consumer's `BUILDER-DECISIONS-REVIEW.md` with a link to
   the migration section.

---

## 10. The "kit-owns-it" rule

Once a module is in the kit, the kit owns its evolution. Consumers
fork at their own risk. If a consumer needs a custom behaviour, they
either:

- Add a wrapper module in their consumer (`src/lib/my-money.ts` that
  imports `@tins-kit/money-as-decimal` and adds the custom behaviour), or
- Propose the change back to the kit via `prompts/KITTING.md`.

They do NOT edit the kit's `lib/<name>/` directly. The kit is read-only
once installed.

---

*— End of `LIBRARY-CONVENTIONS.md`.*
