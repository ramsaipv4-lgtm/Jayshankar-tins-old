#!/usr/bin/env node
// scripts/kit-new-pattern.mjs
//
// Scaffold a new `lib/patterns/<name>.md` from the standard template.
//
// Usage:
//   node scripts/kit-new-pattern.mjs <name>
//
// Example:
//   node scripts/kit-new-pattern.mjs postgres-row-versioning
//
// The script creates `lib/patterns/<name>.md` pre-filled with the kit's
// required structure (§0 Why this exists, §1 The 3 lessons, §2 The 3 known
// anti-patterns, §3 When this changes). The contributor fills in the content.

import { writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';

const name = process.argv[2];
if (!name) {
  console.error('Usage: kit-new-pattern.mjs <pattern-name>');
  console.error('  Example: kit-new-pattern.mjs postgres-row-versioning');
  process.exit(2);
}

if (!/^[a-z0-9-]+$/.test(name)) {
  console.error('ERROR: pattern name must be lowercase, alphanumeric, dash-separated');
  process.exit(2);
}

const kitRoot = resolve(import.meta.dirname, '..');
const target = join(kitRoot, 'lib', 'patterns', `${name}.md`);

if (existsSync(target)) {
  console.error(`ERROR: ${target} already exists`);
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);

const template = `# \`${name}\` — kit pattern

> **The one-line description of the pattern.** (What it is, in 1 sentence.)
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

\`\`\`ts
// ❌ WRONG
\`\`\`

\`\`\`ts
// ✅ RIGHT
\`\`\`

<1 paragraph explaining the difference.>

### Anti-pattern 2 — <one-line title>

\`\`\`ts
// ❌ WRONG
\`\`\`

\`\`\`ts
// ✅ RIGHT
\`\`\`

<1 paragraph explaining the difference.>

### Anti-pattern 3 — <one-line title>

\`\`\`ts
// ❌ WRONG
\`\`\`

\`\`\`ts
// ✅ RIGHT
\`\`\`

<1 paragraph explaining the difference.>

---

## 3. When this pattern changes

- <Trigger 1>: <what changes>
- <Trigger 2>: <what changes>
- <Trigger 3>: <what changes>

---

*— End of \`${name}\` pattern. See also: <links to 2–4 related patterns>.*
`;

writeFileSync(target, template, 'utf8');
console.log(`✅ Scaffolded ${target}`);
console.log('');
console.log('Next steps:');
console.log('  1. Fill in the §0 / §1 / §2 / §3 sections');
console.log('  2. Add a validator check to scripts/validate.mjs');
console.log('  3. Add a self-test case to scripts/selftest.mjs');
console.log('  4. Add a row to SPEC.md §0.4 absorption table');
console.log('  5. Add a row to BUILDER-DECISIONS-REVIEW.md (a new D<N>)');
console.log('  6. Run `node scripts/validate.mjs && node scripts/selftest.mjs`');
console.log('');
console.log(`Created: ${today}`);
