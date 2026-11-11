# Prompt: KITTING

> **When a contributor wants to add a new `lib/patterns/<name>.md` to the kit, they
> run this prompt.** Closes the "evergrowing project" loop: every consumer project
> that crystallises a new lesson can contribute it back to the kit via this prompt.
>
> **Source:** `tins-kit/docs/KITTING.md` (the human-facing version of this prompt —
> this prompt is the *machine-facing* one that an LLM session executes), the
> `tins-kit/AGENTS.md` §3 standing rule "every new pattern must come with a §0
> 'Why this exists' + a worked example from a reference project + a validator check
> + a self-test case."

---

## When to use

You (an LLM session) have just finished working on a consumer project and you
crystallised a new pattern — a "this is a thing I do, here's the recipe" that
would be useful across other TINS projects. You want to add it to the kit.

The new pattern must:
1. Appear in **2+ reference projects** (i.e. you've seen it twice and it's not
   a one-off).
2. Be **reusable** (i.e. a different project can copy the recipe without
   understanding the original context).
3. Have a **worked example** (i.e. a real consumer project's code that
   implements the pattern).

If you can't tick all 3 boxes, the pattern isn't ready for the kit yet. Add it
to `docs/GAP-ANALYSIS.md` as a "future" gap, and revisit later.

---

## The prompt

```
You are adding a new pattern to `tins-kit`, the evergrowing TINS kit. The kit
is itself a TINS project — it consumes its own methodology per §0.2 D2. The new
pattern must follow the kit's conventions exactly.

The pattern is: <NAME>
The pattern is observed in: <reference projects, with file paths>
The pattern is a / an: <doc-only recipe in `lib/patterns/<name>.md`> OR
                          <code module in `lib/<name>/`> OR
                          <both: a doc + a code module>

---

## Step 1 — Pick the right shape

**Doc-only (`lib/patterns/<name>.md`)** if the pattern is a "how to think about
X" — the architect's-eye view. Examples: `two-prisma-clients.md`,
`cross-tenant-404.md`, `fifo-cascade-algorithm.md`.

**Code module (`lib/<name>/` with `index.ts` + `README.md` + `tests/`)** if the
pattern is a "give me the code" — a reusable function / class / SQL file the
consumer can import. Examples: `lib/no-backend/`, `lib/money-as-decimal/`,
`lib/tenant-rls/`.

**Both** if the pattern is large enough to warrant an architect's-eye view AND
a code drop-in. Example: the `two-prisma-clients` pattern has a
`lib/patterns/two-prisma-clients.md` (the why) AND a `lib/tenant-rls/` (the
code).

For a doc-only pattern, skip to Step 2. For a code module or both, go through
Steps 2–5.

---

## Step 2 — Doc structure (for doc-only OR the doc-half of "both")

The new `lib/patterns/<name>.md` MUST follow this template exactly:

```md
# `<name>` — kit pattern

> **The one-line description of the pattern.** (Same shape as
> `client-side-aggregation.md`, `postgres-mutations.md`, etc.)
>
> **Source:** <reference project 1, file path> (the canonical implementation),
>           <reference project 2, file path> (the second observation).

---

## 0. Why this exists

<2–4 paragraphs. The problem, the alternatives, why this one wins.
Open with a "this is what the pattern is" sentence, then explain.>

---

## 1. The 3 lessons, in detail

### Lesson 1 — <one-line title>
<Code or schema, then prose.>

### Lesson 2 — <one-line title>
<Code or schema, then prose.>

### Lesson 3 — <one-line title>
<Code or schema, then prose.>

---

## 2. The 3 known anti-patterns

### Anti-pattern 1 — <one-line title>
<Bad code, then good code, then prose.>

### Anti-pattern 2 — <one-line title>
<Bad code, then good code, then prose.>

### Anti-pattern 3 — <one-line title>
<Bad code, then good code, then prose.>

---

## 3. When this pattern changes

- <Trigger 1>: <what changes>
- <Trigger 2>: <what changes>
- <Trigger 3>: <what changes>

---

*— End of `<name>` pattern. See also: <links to 2–4 related patterns>.*
```

DO NOT deviate from this structure. The kit's `validate.mjs` script parses
each pattern file and checks for the `## 0`, `## 1.`, `## 2.`, `## 3.`
headings and the "End of" footer. If a new pattern is missing any of these,
the validator fails.

---

## Step 3 — Code module structure (for code module OR the code-half of "both")

The new `lib/<name>/` MUST follow this layout:

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

`index.ts` MUST export a single `default` object that contains every public
function. The consumer imports like:

```ts
import money from '@tins-kit/money-as-decimal';
const amt = money.from('100.00');
const formatted = money.formatINR(amt);
```

`README.md` MUST follow the `lib/<name>/README.md` template (see
`docs/LIBRARY-CONVENTIONS.md` for the full template).

`tests/<name>.test.ts` MUST have at least 3 cases: one happy-path, one
edge-case, one error-case. The test runner is the consumer's choice (vitest,
jest, node:test).

---

## Step 4 — Add the validator check (mandatory)

Open `scripts/validate.mjs`. Add a new check to the appropriate section (§8.1
for spec structure, §8.2 for kit inventory, §8.3 for consumer code, §8.4 for
hygiene, §8.5 for self-application). The check verifies the new pattern
exists, has the right structure, and is referenced in `SPEC.md` §0.4.

For a new pattern `<name>`, the validator check is:

```js
// §8.2: kit inventory — patterns
const patterns = readdirSync('lib/patterns').filter(f => f.endsWith('.md'));
if (!patterns.includes('<name>.md')) {
  errors.push('Missing pattern: <name>.md');
}
const patternText = readFileSync(`lib/patterns/<name>.md`, 'utf8');
for (const required of ['## 0. Why this exists', '## 1. The 3 lessons',
                         '## 2. The 3 known anti-patterns', '## 3. When this',
                         'End of `<name>` pattern']) {
  if (!patternText.includes(required)) {
    errors.push(`Pattern <name> missing: ${required}`);
  }
}
```

If the pattern is a code module, add a §8.2 check that verifies the
`lib/<name>/{index.ts,README.md,tests/<name>.test.ts}` triad.

---

## Step 5 — Add the self-test case (mandatory)

Open `scripts/selftest.mjs`. Add a new case to the appropriate section
(pattern-shape, code-module, integration, or end-to-end). The case verifies
the new pattern's behaviour using a minimal in-memory fixture.

For a doc-only pattern, the self-test case is a "the file exists and has the
required sections" check. For a code module, the case runs the actual code
with a fixture input and asserts the output.

Example (doc-only):

```js
{
  id: 'pattern-<name>-shape',
  name: 'lib/patterns/<name>.md has the required sections',
  run: () => {
    const text = readFileSync('lib/patterns/<name>.md', 'utf8');
    assert(text.includes('## 0. Why this exists'), 'missing §0');
    assert(text.includes('## 1. The 3 lessons'), 'missing §1');
    assert(text.includes('## 2. The 3 known anti-patterns'), 'missing §2');
    assert(text.includes('## 3. When this'), 'missing §3');
  },
},
```

Example (code module):

```js
{
  id: 'module-<name>-happy-path',
  name: 'lib/<name>/ exports the expected public API',
  run: async () => {
    const mod = await import('./lib/<name>/index.ts');
    assert(typeof mod.default.from === 'function', 'missing from()');
    assert(typeof mod.default.format === 'function', 'missing format()');
  },
},
```

---

## Step 6 — Update SPEC.md (mandatory)

Open `tins-kit/SPEC.md` and:

1. Add a new locked decision D<N+1> in §0.2 (the "kit ships <name> pattern" row).
2. Add a row to the §0.4 absorption table: "Pattern <name> absorbed from
   <reference project>, <date>."
3. Add the pattern to §2 (functionality) under the appropriate section.
4. Add the pattern to §4.1 (architecture) directory tree.
5. Add an §8.X acceptance criterion: "<name> pattern is present, has the
   required structure, and is referenced by the validator + selftest."

If the pattern is a code module, also add a "kit code module" entry to §2
and §4.1.

---

## Step 7 — Update HANDOVER.md (mandatory)

Open `tins-kit/HANDOVER.md`:

1. Mark the W<n> task as ✅ done with the date.
2. Update the §8 state snapshot: "kit now has <N+1> patterns, <M+1> code
   modules, <K+1> scripts, <P+1> schemas."
3. Add a new gotcha to §9 if the new pattern introduced a non-obvious
   rule (e.g. "the `two-prisma-clients` pattern requires the
   `AsyncLocalStorage` import; bundlers may need a polyfill").

---

## Step 8 — Update BUILDER-DECISIONS-REVIEW.md (mandatory)

Add a new D<N> entry documenting the "kit now ships <name> pattern" decision,
with cross-references to:

- `lib/patterns/<name>.md` (the doc)
- `lib/<name>/` (the code, if any)
- `scripts/validate.mjs` §8.X (the validator check)
- `scripts/selftest.mjs` case <id> (the self-test case)
- `SPEC.md` §0.2 D<N+1>, §0.4, §2, §4.1, §8.X (the spec updates)

---

## Step 9 — Run the gate

```bash
cd tins-kit
node scripts/validate.mjs
node scripts/selftest.mjs
```

Both must pass green. If either fails, fix the issue (most often: a missing
section header, a missing cross-reference, a typo in the file name) and re-run.

---

## Step 10 — Commit and report

Update the kit's `HANDOVER.md` "Last updated" and "Last worked on by"
headers. Send a short summary to the user: what was added, where, why.

---

*— End of `KITTING` prompt. See also: `docs/KITTING.md` (the human-facing
version), `docs/LIBRARY-CONVENTIONS.md` (the code module template),
`prompts/SPEC-AUTHOR.md` (the spec-writing flow that consumes new patterns).*
