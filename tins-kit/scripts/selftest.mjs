#!/usr/bin/env node
// selftest.mjs — tins-kit validator's self-test
// Proves the validator fails on known defects. Uses Node's built-in test runner
// (node --test). Zero dependencies.
//
// Usage: node scripts/selftest.mjs
//        node --test scripts/selftest.mjs   (verbose)

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pExecFile = promisify(execFile);

const VALIDATOR = resolve(process.cwd(), 'scripts/validate.mjs');
const PRIVATE_TO_PUBLIC = resolve(process.cwd(), 'scripts/private-to-public.mjs');

async function validateInDir(content) {
  const dir = await mkdtemp(join(tmpdir(), 'tins-selftest-'));
  const specPath = join(dir, 'SPEC.md');
  await writeFile(specPath, content);
  let code = 0;
  try {
    await pExecFile('node', [VALIDATOR, '--spec', specPath], { cwd: process.cwd() });
  } catch (err) {
    code = err.code || 1;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return { code, dir };
}

// A spec that satisfies every check. Used as the "pass" baseline.
const VALID_SPEC = `<!-- TINS Specification v1.0 -->
<!-- ZS:COMPLEXITY:MEDIUM -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->

# Test Project — Canonical Specification (v1)

> One-paragraph summary.

---

## 0. Preamble

### 0.0 Cheapest version that would work

The cheapest version that would work: a single Google Sheet with three view filters, no
custom code. The expensive version below buys multi-user concurrency, an append-only audit
log, and an offline-capable PWA.

### 0.1 What this document is

This is the canonical specification for Test Project.

### 0.2 Locked design decisions

| # | Decision | Resolution |
|---|---|---|
| D1 | Stack | Vite + React |
| D2 | Schema | Postgres |
| D3 | Auth | Supabase Auth |
| D4 | Roles | admin, user |
| D5 | Money | numeric(10,2) |
| D6 | Deployment | Netlify |
| D7 | Validation | zod |
| D8 | Observability | console |
| D9 | Lifecycle | single mode |
| D10 | Demo mode | seed data |

### 0.3 Implementation baseline

Not built.

### 0.4 What changed from the original brief

| Original brief | Actual requirement | What changed |
|---|---|---|
| "A todo app" | A multi-user inventory app with offline support | Schema grew from 1 to 5 tables |
| "Mobile only" | Web first, mobile responsive | PWA added, no native build |
| "Free hosting" | Supabase + Netlify free tier | Backend choice constrained by free tier limits |

### 0.5 (no §0.5, just to test)

## 1. Description

A test project.

## 2. Functionality

### 2.1 Module 1

Does X.

## 3. Universal behaviour rules

1. Rule one.
2. Rule two.

## 4. Technical implementation

### 4.1 Architecture

Vite + React.

### 4.2 Data structures

#### 4.2.1 \`items\`

| Column | Type | Null? | Default | Meaning |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |

### 4.3 Algorithms

#### 4.3.1 Fetch

1. Validate id.
2. Query DB.

### 4.4 Dependencies

None beyond framework.

## 5. Style guide

System font.

## 6. Accessibility

WCAG 2.1 AA.

## 7. Error handling

| Failure | Behaviour |
|---|---|
| Network down | Show offline banner |

## 8. Acceptance criteria

### 8.1 Baseline

- **§8.1a** The app loads on a 2021 Android phone in under 3 seconds.
- **§8.1b** All routes return 200 on a fresh install.
- **§8.1c** The audit log is append-only.
- **§8.1d** Money is never stored as float.
- **§8.1e** A worker cannot record a sale.

## 9. Out of scope

- POS.
- GST invoicing.

---

*End of test spec.*
`;

// === Tests ===

test('passes on a valid spec', async () => {
  const { code } = await validateInDir(VALID_SPEC);
  assert.equal(code, 0, `validator should exit 0 on a valid spec, got ${code}`);
});

test('§8.1a — fails when TINS marker is missing', async () => {
  const bad = VALID_SPEC.replace('<!-- TINS Specification v1.0 -->', '');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail without TINS marker');
});

test('§8.1b — fails when all ZS: markers are missing', async () => {
  const bad = VALID_SPEC.replace(/<!-- ZS:[^>]+-->/g, '');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail without ZS markers');
});

test('§8.1c — fails on an unknown ZS: key', async () => {
  const bad = VALID_SPEC.replace(
    '<!-- ZS:COMPLEXITY:MEDIUM -->',
    '<!-- ZS:UNKNOWNKEY:foo -->',
  );
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail on unknown ZS key');
});

test('§8.2b/c — fails when §0.2 is missing', async () => {
  const bad = VALID_SPEC.replace(/### 0\.2[\s\S]*?(?=\n### )/m, '');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail without §0.2');
});

test('§8.2b — fails when §0.2 has no Decision column', async () => {
  const bad = VALID_SPEC.replace(
    '| # | Decision | Resolution |',
    '| # | Choice | Verdict |',
  );
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §0.2 lacks Decision column');
});

test('§8.2c — fails when §0.2 has zero decision rows', async () => {
  // Keep the header but drop the data rows. The cleanest way is to keep the
  // "| # | Decision | Resolution |" line and the "|---|---|" separator, then
  // strip every "| D<N> |" line.
  const lines = VALID_SPEC.split('\n');
  const out = [];
  let inS02 = false;
  let headerPassed = false;
  for (const line of lines) {
    if (line.startsWith('### 0.2 ')) { inS02 = true; out.push(line); continue; }
    if (inS02 && /^### 0\.3 /.test(line)) { inS02 = false; }
    if (inS02 && !headerPassed) {
      out.push(line);
      if (/^\|---/.test(line)) headerPassed = true;
      continue;
    }
    if (inS02 && headerPassed) {
      // Drop data rows (lines starting with | D)
      if (/^\| D\d+ /.test(line)) continue;
      out.push(line);
      continue;
    }
    out.push(line);
  }
  const bad = out.join('\n');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §0.2 has no decision rows');
});

test('§8.3a — fails when §0.0 is too short', async () => {
  const bad = VALID_SPEC.replace(
    /### 0\.0 Cheapest version that would work\n[\s\S]*?(?=\n### 0\.1)/,
    '### 0.0 Cheapest version that would work\n\nTBD.\n',
  );
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §0.0 is too short');
});

test('§8.3a — fails when §0.0 is too vague ("a database")', async () => {
  const bad = VALID_SPEC.replace(
    /### 0\.0 Cheapest version that would work\n[\s\S]*?(?=\n### 0\.1)/,
    '### 0.0 Cheapest version that would work\n\nThe cheapest version that would work: a database.\n',
  );
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §0.0 says "a database"');
});

test('kit-§0.4 — fails when §0.4 interview-reveals-reality is missing', async () => {
  const bad = VALID_SPEC.replace(/### 0\.4[\s\S]*?(?=\n### )/m, '');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail without §0.4');
});

test('§8.4a — fails when §8 has fewer than 5 criteria', async () => {
  const bad = VALID_SPEC.replace(/- \*\*§8\.1e\*\*[^\n]*\n/, '');
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §8 has <5 criteria');
});

test('§8.5a — fails when §9 has no out-of-scope items', async () => {
  const bad = VALID_SPEC.replace(
    /## 9\. Out of scope\n[\s\S]*?(?=\n---)/,
    '## 9. Out of scope\n\nTBD.\n',
  );
  const { code } = await validateInDir(bad);
  assert.notEqual(code, 0, 'validator should fail when §9 has no items');
});

test('validates the kit\'s own SPEC.md', async () => {
  // Sanity check: the kit's meta-spec must pass.
  const kitSpec = resolve(process.cwd(), 'SPEC.md');
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(kitSpec, 'utf8');
  const { code } = await validateInDir(content);
  assert.equal(code, 0, `kit's own SPEC.md must pass the validator; got exit ${code}`);
});

test('rejects empty file', async () => {
  const { code } = await validateInDir('');
  assert.notEqual(code, 0, 'validator should fail on empty file');
});

test('rejects --help with no error', async () => {
  // --help exits 0 and prints help
  const { stdout } = await pExecFile('node', [VALIDATOR, '--help']);
  assert.match(stdout, /Usage:/);
});

// === scripts/private-to-public.mjs (added 2026-08-21, session 14, D30) ===
//
// Everything above this point tests validate.mjs's own behaviour (the
// file's original scope, per its header comment). This script is not the
// validator — it's tested directly here rather than skipped the way
// D29's two new scripts were, because it does meaningfully more (a
// three-mode copy/scan/rescan CLI, its own glob-style path matching,
// two separate fingerprint categories) and a real bug was found in its
// inherited copy-filter logic during manual smoke-testing before this
// case existed — exactly the kind of regression a presence-only
// validator check (§8.27d) cannot catch.

async function runPrivateToPublic(args) {
  let code = 0;
  let stdout = '';
  try {
    const res = await pExecFile('node', [PRIVATE_TO_PUBLIC, ...args], { cwd: process.cwd() });
    stdout = res.stdout;
  } catch (err) {
    code = typeof err.code === 'number' ? err.code : 1;
    stdout = err.stdout || '';
  }
  return { code, stdout };
}

async function makeP2pFixture() {
  const base = await mkdtemp(join(tmpdir(), 'tins-p2p-'));
  const src = join(base, 'src-app');
  const dst = join(base, 'src-app-public');
  await mkdir(join(src, 'scripts'), { recursive: true });
  await mkdir(join(src, 'src'), { recursive: true });
  await writeFile(join(src, 'package.json'), '{}\n');
  // A wildcard-pattern include ('scripts/*.mjs') — the pattern this
  // script's inherited copy-filter never actually matched before D30.
  await writeFile(join(src, 'scripts', 'seed-demo-data.mjs'), '// project-specific script\n');
  // validate.mjs / selftest.mjs match the scripts/*.mjs wildcard too, but are excluded by
  // name (found live while regenerating Jayshankar-clean, session 14+N): they check
  // conformance against SPEC.md, which never exists in the public tree, so they're
  // irreducibly methodology-coupled rather than a project-specific thing to fix at the
  // source.
  await writeFile(join(src, 'scripts', 'validate.mjs'), '// project validator\n');
  await writeFile(join(src, 'scripts', 'selftest.mjs'), '// project selftest\n');
  await writeFile(join(src, 'src', 'index.js'), 'export function main() {}\n');
  // Must never be copied.
  await writeFile(join(src, 'AGENTS.md'), 'private only\n');
  return { base, src, dst };
}

test('private-to-public.mjs §8.27d — copies scripts/*.mjs (wildcard) and excludes AGENTS.md', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, 'clean fixture should exit 0');
    assert.ok(existsSync(join(dst, 'scripts', 'seed-demo-data.mjs')), 'scripts/*.mjs should have been copied (glob match)');
    assert.ok(existsSync(join(dst, 'src', 'index.js')), 'src/** should have been copied');
    assert.ok(!existsSync(join(dst, 'AGENTS.md')), 'AGENTS.md must never be copied');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — validate.mjs and selftest.mjs are excluded by name despite matching scripts/*.mjs', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, 'clean fixture should exit 0');
    assert.ok(!existsSync(join(dst, 'scripts', 'validate.mjs')), 'validate.mjs must never be copied (irreducibly SPEC.md-coupled)');
    assert.ok(!existsSync(join(dst, 'scripts', 'selftest.mjs')), 'selftest.mjs must never be copied (irreducibly SPEC.md-coupled)');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — an ordinary relative import in source is not a path-escape false positive', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(join(src, 'src', 'index.js'), "import { x } from '../lib/x';\nexport function main() {}\n");
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, "a normal '../' import in a .js/.ts file must not be flagged as a path escape (found live regenerating Jayshankar-clean — it flagged on every relative import)");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — a single-level "../" doc link within the copied tree is not flagged', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await mkdir(join(src, 'docs'), { recursive: true });
    await writeFile(join(src, 'docs', 'NOTES.md'), 'See [the schema](../supabase/migrations/0001_init.sql) for the full definition.\n');
    const { code, stdout } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, "a single '../' staying inside the copied tree is a normal intra-repo link, not a leak");
    assert.doesNotMatch(stdout, /relative path escapes/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — a doc file escaping two or more levels is still caught', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await mkdir(join(src, 'docs'), { recursive: true });
    await writeFile(join(src, 'docs', 'NOTES.md'), 'See [context](../../outside-the-repo/notes.txt) for background.\n');
    const { code, stdout } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 1, "a '../../' escape (genuinely outside the copied tree) should fail the scan");
    assert.match(stdout, /relative path escapes/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — a bare word term does not false-positive inside an unrelated identifier', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(join(src, 'src', 'index.js'), "export function custInsert() { return 1; }\n");
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, "'custInsert' contains the substring 'tins' but is not the word TINS — found live regenerating Jayshankar-clean");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — SPEC.md/BUILDER-DECISIONS-REVIEW citations are rewritten, not flagged', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(
      join(src, 'src', 'index.js'),
      '// Implements SPEC.md §4.3.12 (D34) -- see BUILDER-DECISIONS-REVIEW.md decision #51.\nexport function main() {}\n',
    );
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, 'a citation-only comment should be mechanically rewritten before the scan, not flagged');
    const out = await readFile(join(dst, 'src', 'index.js'), 'utf8');
    assert.match(out, /the design doc §4\.3\.12/, 'SPEC.md should read as "the design doc"');
    assert.match(out, /the internal decision log/, 'BUILDER-DECISIONS-REVIEW.md should read as "the internal decision log"');
    assert.doesNotMatch(out, /SPEC\.md/);
    assert.doesNotMatch(out, /BUILDER-DECISIONS-REVIEW/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — writes a default .gitignore when the destination has none, but never overwrites an existing one', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    // First run: no .gitignore in the private source (this fixture doesn't create one), none
    // in the destination yet — should write the default.
    let { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0);
    assert.ok(existsSync(join(dst, '.gitignore')), 'a default .gitignore should be written when the destination had none');

    // Hand-tune the destination's .gitignore, then re-run the copy — it must survive.
    await writeFile(join(dst, '.gitignore'), 'node_modules/\n# hand-added by a maintainer\ncustom-thing/\n');
    ({ code } = await runPrivateToPublic([src, dst, '--name=Fixture']));
    assert.equal(code, 0);
    const after = await readFile(join(dst, '.gitignore'), 'utf8');
    assert.match(after, /custom-thing\//, 're-running the copy must not clobber a hand-tuned destination .gitignore');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — supabase/functions/** and capacitor.config.ts are copied (found missing live)', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await mkdir(join(src, 'supabase', 'functions', 'my-fn'), { recursive: true });
    await writeFile(join(src, 'supabase', 'functions', 'my-fn', 'index.ts'), 'export {};\n');
    await writeFile(join(src, 'capacitor.config.ts'), 'export default {};\n');
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0);
    assert.ok(existsSync(join(dst, 'supabase', 'functions', 'my-fn', 'index.ts')), 'Edge Functions must be copied — a real artefact type the original include list predated');
    assert.ok(existsSync(join(dst, 'capacitor.config.ts')), 'capacitor.config.ts must be copied — needed for the Android build to exist at all');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — docs/ARCHITECTURE.md (and siblings) authored in the destination survive a re-copy, even though the source has its own', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await mkdir(join(src, 'docs'), { recursive: true });
    await writeFile(join(src, 'docs', 'ARCHITECTURE.md'), 'STALE private-repo version -- must never win.\n');
    let { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0);
    assert.ok(!existsSync(join(dst, 'docs', 'ARCHITECTURE.md')), 'first run: never copied at all, even though the source has one (docs/** means the public subset, not everything)');

    // Author it fresh in the destination, exactly like a real release would.
    await mkdir(join(dst, 'docs'), { recursive: true });
    await writeFile(join(dst, 'docs', 'ARCHITECTURE.md'), 'Freshly authored destination version -- must survive.\n');

    ({ code } = await runPrivateToPublic([src, dst, '--name=Fixture']));
    assert.equal(code, 0);
    const after = await readFile(join(dst, 'docs', 'ARCHITECTURE.md'), 'utf8');
    assert.match(after, /Freshly authored destination version/, 're-running the copy must not clobber a destination-authored docs/ARCHITECTURE.md with the source\'s own stale copy');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — package.json\'s validate/selftest script entries are stripped, and survive re-copy stripped', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(join(src, 'package.json'), JSON.stringify({
      name: 'fixture',
      scripts: { build: 'vite build', validate: 'node scripts/validate.mjs', selftest: 'node --test scripts/selftest.mjs' },
    }, null, 2));
    const { code } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0);
    const pkg = JSON.parse(await readFile(join(dst, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts.build, 'a real script entry must survive');
    assert.ok(!('validate' in pkg.scripts), 'validate must be stripped — no validate.mjs exists in the public tree to run');
    assert.ok(!('selftest' in pkg.scripts), 'selftest must be stripped — no selftest.mjs exists in the public tree to run');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs — a default .gitignore defensively listing SPEC.md etc. does not fail its own scan', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    const { code, stdout } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 0, 'DEFAULT_GITIGNORE defensively lists SPEC.md/AGENTS.md/etc. as entries to ignore -- that is the opposite of a leak, and must not fail the scan it just ran as part of the same copy');
    assert.doesNotMatch(stdout, /\.gitignore.*contains/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs §8.27d — exits 1 and reports a planted methodology fingerprint', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(join(src, 'src', 'index.js'), '// see tins-kit for the full methodology\nexport function main() {}\n');
    const { code, stdout } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 1, 'a planted "tins-kit" fingerprint should fail the scan');
    assert.match(stdout, /tins-kit/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs §8.27d — exits 1 and reports a planted LLM-authorship fingerprint', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    await writeFile(join(src, 'src', 'index.js'), '// Generated with Claude\nexport function main() {}\n');
    const { code, stdout } = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(code, 1, 'a planted LLM-authorship fingerprint should fail the scan');
    assert.match(stdout, /Claude/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('private-to-public.mjs §8.27d — --scan-only re-scans without re-copying, and exits 2 on bad usage', async () => {
  const { base, src, dst } = await makeP2pFixture();
  try {
    const first = await runPrivateToPublic([src, dst, '--name=Fixture']);
    assert.equal(first.code, 0, 'initial copy+scan of a clean fixture should exit 0');
    const scanOnly = await runPrivateToPublic([dst, '--scan-only']);
    assert.equal(scanOnly.code, 0, '--scan-only on the still-clean destination should exit 0');
    const badUsage = await runPrivateToPublic([]);
    assert.equal(badUsage.code, 2, 'no arguments should exit 2');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ============================================================================
// Session 16 (D32/D33/D34) — the three new scripts.
//
// All three are tested directly rather than left to presence-only validator
// checks, for the same reason D30's private-to-public.mjs was: each one is a
// real decision procedure, not a file. tooling-audit.mjs is a BLOCKING gate —
// a gate nobody has watched fail is decoration (D7), and this one stands
// between a project and a session that would otherwise improvise around a
// missing capability. orchestrate.mjs owns a closed status vocabulary and a
// four-way exit code, and its exit 3 ("parked, questions outstanding") is
// meaningless unless it can be distinguished from 0 and 1 under test.
// escalate.mjs enforces the tier rules from lib/patterns/tiered-escalation.md;
// its refusals ARE the enforcement.
// ============================================================================

const TOOLING_AUDIT = resolve(process.cwd(), 'scripts/tooling-audit.mjs');
const ESCALATE = resolve(process.cwd(), 'scripts/escalate.mjs');
const ORCHESTRATE = resolve(process.cwd(), 'scripts/orchestrate.mjs');

async function runScript(script, args, cwd) {
  let code = 0;
  let stdout = '';
  try {
    const res = await pExecFile('node', [script, ...args], { cwd: cwd || process.cwd() });
    stdout = res.stdout;
  } catch (err) {
    code = typeof err.code === 'number' ? err.code : 1;
    stdout = (err.stdout || '') + (err.stderr || '');
  }
  return { code, stdout };
}

function auditDoc(status, rows) {
  return [
    '# TOOLING-AUDIT.md',
    '',
    `**Audit status:** ${status}`,
    '',
    '| Capability gap | Candidate | Source | Verdict | Priority | Status | Handicap / audit note |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

const CLEAN_ROW = '| query Postgres | pg-mcp | https://example.test/pg-mcp | SAFE | REQUIRED | installed | read in full, no flags |';

async function withAudit(content, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'tins-tooling-'));
  try {
    if (content !== null) await writeFile(join(dir, 'TOOLING-AUDIT.md'), content);
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('tooling-audit.mjs §8.30c — exits 0 when every REQUIRED capability is installed', async () => {
  await withAudit(auditDoc('complete', [CLEAN_ROW]), async (dir) => {
    const { code } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 0, 'a complete audit with nothing pending should pass the gate');
  });
});

test('tooling-audit.mjs §8.30c — exits 2 when TOOLING-AUDIT.md is missing', async () => {
  await withAudit(null, async (dir) => {
    const { code } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 2, 'a missing audit file is a usage error, not a silent pass');
  });
});

test('tooling-audit.mjs §8.30c — blocks while the audit itself is unfinished', async () => {
  await withAudit(auditDoc('pending', [CLEAN_ROW]), async (dir) => {
    const { code, stdout } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 1, 'an audit still marked pending must not let work start');
    assert.match(stdout, /not "complete"/);
  });
});

test('tooling-audit.mjs §8.30c — blocks on a REQUIRED capability still pending (D33)', async () => {
  const row = '| query Postgres | pg-mcp | https://example.test/pg-mcp | SAFE | REQUIRED | pending | — |';
  await withAudit(auditDoc('complete', [row]), async (dir) => {
    const { code, stdout } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 1, 'a pending REQUIRED row is exactly what the blocking gate exists for');
    assert.match(stdout, /REQUIRED and still pending/);
  });
});

test('tooling-audit.mjs §8.30c — blocks when a tool judged UNSAFE is marked installed', async () => {
  const row = '| scrape docs | sketchy-skill | https://example.test/x | UNSAFE | OPTIONAL | installed | exfiltrates env vars |';
  await withAudit(auditDoc('complete', [row]), async (dir) => {
    const { code, stdout } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 1, 'UNSAFE + installed must never pass');
    assert.match(stdout, /UNSAFE but marked installed/);
  });
});

test('tooling-audit.mjs §8.30c — rejects a waiver that names no handicap', async () => {
  const row = '| query Postgres | pg-mcp | https://example.test/pg-mcp | SAFE | REQUIRED | waived | skipped, not needed |';
  await withAudit(auditDoc('complete', [row]), async (dir) => {
    const { code, stdout } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 1, 'a waiver is not a dismissal — it must name what is given up');
    assert.match(stdout, /no handicap named/);
  });
});

test('tooling-audit.mjs §8.30c — rejects a verdict outside the closed vocabulary', async () => {
  const row = '| query Postgres | pg-mcp | https://example.test/pg-mcp | probably fine | REQUIRED | installed | — |';
  await withAudit(auditDoc('complete', [row]), async (dir) => {
    const { code, stdout } = await runScript(TOOLING_AUDIT, [], dir);
    assert.equal(code, 1, '"probably fine" is not a verdict');
    assert.match(stdout, /is not one of SAFE/);
  });
});

async function withDelegation(ledgerRows, fn, { config = true, escalations = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'tins-orch-'));
  await mkdir(join(dir, 'delegation'), { recursive: true });
  await writeFile(
    join(dir, 'delegation', 'LEDGER.md'),
    [
      '# LEDGER',
      '',
      '| Task | Mode | Status | Assignee | Depends | Touched files |',
      '|---|---|---|---|---|---|',
      ...ledgerRows,
      '',
    ].join('\n'),
  );
  if (config) {
    await writeFile(
      join(dir, 'delegation', 'ORCHESTRATION.json'),
      JSON.stringify({ harness: 'generic', workerCmd: '', maxParallel: 2, maxRetries: 1 }, null, 2),
    );
  }
  if (escalations) {
    await writeFile(join(dir, 'delegation', 'ESCALATIONS.md'), '# ESCALATIONS\n');
  }
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('orchestrate.mjs §8.29c — --dry-run dispatches only ready tasks whose dependencies are integrated', async () => {
  await withDelegation(
    [
      '| T1 | self | integrated | me | — | `a.ts` |',
      '| T2 | self | ready | me | T1 | `b.ts` |',
      '| T3 | self | ready | me | T2 | `c.ts` |',
    ],
    async (dir) => {
      const { code, stdout } = await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir);
      assert.equal(code, 0, '--dry-run always exits 0; it plans, it does not judge');
      const plan = JSON.parse(stdout);
      assert.deepEqual(plan.wave, ['T2'], 'only T2 is runnable — T3 waits on T2, which is not integrated yet');
      const t3 = plan.held.find((h) => h.id === 'T3');
      assert.match(t3.reason, /waiting on T2/);
    },
  );
});

test('orchestrate.mjs §8.29c — a parked task does not halt the run while other work remains', async () => {
  await withDelegation(
    [
      '| T1 | self | blocked-escalation | me | — | `a.ts` |',
      '| T2 | self | ready | me | — | `b.ts` |',
    ],
    async (dir) => {
      const { stdout } = await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir);
      const plan = JSON.parse(stdout);
      assert.deepEqual(plan.wave, ['T2'], 'T2 is independent of the parked T1 and must keep building');
      assert.equal(plan.outcome, 'dispatchable');
    },
  );
});

test('orchestrate.mjs §8.29c — exits 3 (parked), not 0 or 1, when only escalations remain', async () => {
  await withDelegation(
    [
      '| T1 | self | integrated | me | — | `a.ts` |',
      '| T2 | self | blocked-escalation | me | — | `b.ts` |',
    ],
    async (dir) => {
      const { code, stdout } = await runScript(ORCHESTRATE, ['--status', '--json'], dir);
      assert.equal(code, 3, 'parked must be distinguishable from both success (0) and failure (1)');
      assert.equal(JSON.parse(stdout).outcome, 'parked');
    },
  );
});

test('orchestrate.mjs §8.29c — exits 2 on a status outside the closed vocabulary', async () => {
  await withDelegation(['| T1 | self | almost-done | me | — | `a.ts` |'], async (dir) => {
    const { code, stdout } = await runScript(ORCHESTRATE, ['--dry-run'], dir);
    assert.equal(code, 2, 'an invented status breaks every reader of the ledger, including a fresh auditor');
    assert.match(stdout, /vocabulary is closed/);
  });
});

test('orchestrate.mjs §8.29c — refuses to dispatch without a configured workerCmd', async () => {
  await withDelegation(['| T1 | self | ready | me | — | `a.ts` |'], async (dir) => {
    const { code, stdout } = await runScript(ORCHESTRATE, [], dir);
    assert.equal(code, 2, 'no workerCmd and no native spawning means nothing can run');
    assert.match(stdout, /workerCmd/);
  });
});

test('escalate.mjs §8.29d — rejects a T0 as not an escalation at all', async () => {
  await withDelegation(['| T1 | self | running | me | — | `a.ts` |'], async (dir) => {
    const { code, stdout } = await runScript(
      ESCALATE,
      ['--task=T1', '--tier=0', '--question=named it foo', '--why=trivial'],
      dir,
    );
    assert.equal(code, 2, 'T0 is decide-and-log; the queue is for questions, not narration');
    assert.match(stdout, /not an escalation/);
  });
});

test('escalate.mjs §8.29d — rejects a T2 filed without a recommendation', async () => {
  await withDelegation(['| T1 | self | running | me | — | `a.ts` |'], async (dir) => {
    const { code, stdout } = await runScript(
      ESCALATE,
      [
        '--task=T1',
        '--tier=2',
        '--question=Delete or quarantine the failed rows?',
        '--why=Irreversible data loss',
        '--options=A: delete | B: quarantine',
      ],
      dir,
    );
    assert.equal(code, 2, 'a bare question hands the model’s work back to the user');
    assert.match(stdout, /--recommend is required/);
  });
});

test('escalate.mjs §8.29d — rejects a T2 offering fewer than two real options', async () => {
  await withDelegation(['| T1 | self | running | me | — | `a.ts` |'], async (dir) => {
    const { code, stdout } = await runScript(
      ESCALATE,
      [
        '--task=T1',
        '--tier=2',
        '--question=Delete the failed rows?',
        '--why=Irreversible data loss',
        '--options=A: delete',
        '--recommend=A',
      ],
      dir,
    );
    assert.equal(code, 2, 'one option is not a decision');
    assert.match(stdout, /2 or more real candidates/);
  });
});

test('escalate.mjs §8.29d — a well-formed T2 files the question and parks only its own task', async () => {
  await withDelegation(
    [
      '| T1 | self | running | me | — | `a.ts` |',
      '| T2 | self | ready | me | — | `b.ts` |',
    ],
    async (dir) => {
      const { code } = await runScript(
        ESCALATE,
        [
          '--task=T1',
          '--tier=2',
          '--question=Delete or quarantine the failed migration rows?',
          '--why=Irreversible data loss, not settled by a locked decision',
          '--options=A: delete (simple, unrecoverable) | B: quarantine table (recoverable)',
          '--recommend=B — recoverable, and the append-only rule points the same way',
        ],
        dir,
      );
      assert.equal(code, 0, 'a complete T2 should file cleanly');

      const esc = await readFile(join(dir, 'delegation', 'ESCALATIONS.md'), 'utf8');
      assert.match(esc, /\[T2\] T1/);
      assert.match(esc, /Recommendation:/);
      assert.match(esc, /Blocked:.*T1/);

      const plan = JSON.parse((await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir)).stdout);
      assert.deepEqual(plan.wave, ['T2'], 'T2 is untouched by T1’s escalation and must keep building');
      const t1 = plan.held.find((h) => h.id === 'T1');
      assert.match(t1.reason, /parked on an open escalation/, 'T1 must now read as parked in the ledger');
    },
  );
});

// ============================================================================
// Session 17 (D35) — execution-mode selection.
//
// orchestrate.mjs's refusal to dispatch a user-driven or external round is a
// SAFETY property, not a convenience: the user said they would drive that work
// themselves, or that it is destined for a scrubbed packet, and a runner that
// quietly did it instead would be overriding a stated decision. Per D7, a
// safety property nobody has watched fire is decoration — so each refusal is
// tested directly, along with backward compatibility for pre-D35 ledgers.
// ============================================================================

function ledgerWithMode(mode, rows, { legacy = false } = {}) {
  const header = mode === null
    ? ''
    : legacy
      ? `**Default mode for this round:** ${mode}\n\n`
      : `**Execution mode for this round:** ${mode}\n\n`;
  return [
    '# LEDGER',
    '',
    header + '| Task | Mode | Status | Assignee | Depends | Touched files |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

async function withMode(ledgerText, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'tins-mode-'));
  await mkdir(join(dir, 'delegation'), { recursive: true });
  await writeFile(join(dir, 'delegation', 'LEDGER.md'), ledgerText);
  await writeFile(
    join(dir, 'delegation', 'ORCHESTRATION.json'),
    JSON.stringify({ harness: 'generic', workerCmd: 'echo worker', maxParallel: 2, maxRetries: 1 }, null, 2),
  );
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const READY_ROW = '| T1 | auditor-local | ready | auditor | — | `a.ts` |';

test('orchestrate.mjs §8.32d — dispatches an auditor-local round', async () => {
  await withMode(ledgerWithMode('auditor-local', [READY_ROW]), async (dir) => {
    const { code, stdout } = await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir);
    assert.equal(code, 0);
    const plan = JSON.parse(stdout);
    assert.equal(plan.roundMode, 'auditor-local');
    assert.deepEqual(plan.wave, ['T1'], 'an auditor-driven round is exactly what this runner is for');
  });
});

for (const mode of ['solo', 'self-parallel', 'external']) {
  test(`orchestrate.mjs §8.32d — refuses to dispatch a ${mode} round`, async () => {
    const row = `| T1 | ${mode} | ready | user | — | \`a.ts\` |`;
    await withMode(ledgerWithMode(mode, [row]), async (dir) => {
      const { code, stdout } = await runScript(ORCHESTRATE, [], dir);
      assert.equal(code, 2, `a ${mode} round is user-driven — dispatching it would override a stated decision`);
      assert.match(stdout, /you drive it, not this runner/);

      // --dry-run still plans, but marks the tasks as not auto-dispatchable.
      const plan = JSON.parse((await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir)).stdout);
      assert.equal(plan.dispatchable, false);
      assert.deepEqual(plan.wave, []);
      assert.match(plan.held.find((h) => h.id === 'T1').reason, /user-driven mode/);
    });
  });
}

test('orchestrate.mjs §8.32d — in a hybrid round, only the auditor-driven rows dispatch', async () => {
  await withMode(
    ledgerWithMode('hybrid', [
      '| T1 | auditor-local | ready | auditor | — | `a.ts` |',
      '| T2 | external | ready | contractor | — | `b.ts` |',
      '| T3 | self-parallel | ready | user | — | `c.ts` |',
      '| T4 | auditor-remote | ready | auditor | — | `d.ts` |',
    ]),
    async (dir) => {
      const plan = JSON.parse((await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir)).stdout);
      assert.deepEqual(plan.wave, ['T1', 'T4'], 'external and self-parallel rows stay with their own humans');
      for (const id of ['T2', 'T3']) {
        assert.match(plan.held.find((h) => h.id === id).reason, /user-driven mode/);
      }
    },
  );
});

test('orchestrate.mjs §8.32d — a legacy pre-D35 ledger still works, reading `self` as self-parallel', async () => {
  await withMode(
    ledgerWithMode('self', ['| T1 | self | ready | user | — | `a.ts` |'], { legacy: true }),
    async (dir) => {
      const plan = JSON.parse((await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir)).stdout);
      assert.equal(plan.roundMode, 'self-parallel', "D29's `self` means the user drives it personally");
      assert.equal(plan.dispatchable, false);
    },
  );
});

test('orchestrate.mjs §8.32d — a ledger with no mode header still dispatches (backward compatible)', async () => {
  await withMode(ledgerWithMode(null, [READY_ROW]), async (dir) => {
    const plan = JSON.parse((await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir)).stdout);
    assert.equal(plan.roundMode, null);
    assert.deepEqual(plan.wave, ['T1'], 'an old ledger predating D35 must not become undispatchable');
  });
});

test('orchestrate.mjs §8.32d — exits 2 on an execution mode outside the closed vocabulary', async () => {
  await withMode(ledgerWithMode('yolo', [READY_ROW]), async (dir) => {
    const { code, stdout } = await runScript(ORCHESTRATE, ['--dry-run'], dir);
    assert.equal(code, 2, 'an invented mode must not silently fall through to dispatching');
    assert.match(stdout, /vocabulary is closed/);
  });
});

// ============================================================================
// Session 18 — regression found by the first REAL autonomous run
// (examples/autonomous-todo-app).
//
// The auditor appended a round-outcome summary table to delegation/LEDGER.md.
// Both ledger readers parsed EVERY `|` line in the file, so the summary's rows
// were read as task rows and orchestrate.mjs died on "unrecognised status".
// templates/DELEGATION-LEDGER.md explicitly invites extra sections, so this
// would have bitten any real project that documented its own round. Fixed by
// taking only the first contiguous table whose header carries the required
// columns; pinned here so it cannot come back.
// ============================================================================

const LEDGER_WITH_TWO_TABLES = [
  '# LEDGER',
  '',
  '**Execution mode for this round:** auditor-local',
  '',
  '| Task | Mode | Status | Assignee | Depends | Touched files |',
  '|---|---|---|---|---|---|',
  '| T1 | auditor-local | ready | worker | — | `src/a.ts` |',
  '| T2 | auditor-local | ready | worker | — | `src/b.ts` |',
  '',
  '## Round outcome',
  '',
  '| Task | Final status | Why |',
  '|---|---|---|',
  '| T1 | integrated | verified by the auditor |',
  '| T2 | blocked-escalation | parked on a spec question |',
  '',
].join('\n');

test('orchestrate.mjs — a ledger with a second table still parses (regression)', async () => {
  await withMode(LEDGER_WITH_TWO_TABLES, async (dir) => {
    const { code, stdout } = await runScript(ORCHESTRATE, ['--dry-run', '--json'], dir);
    assert.equal(code, 0, 'a prose summary table must not break the runner');
    const plan = JSON.parse(stdout);
    assert.equal(plan.counts.ready, 2, 'only the real task table should be read');
    assert.deepEqual(plan.wave, ['T1', 'T2']);
  });
});

test('check-task-independence.mjs — a ledger with a second table still parses (regression)', async () => {
  const CHECK = resolve(process.cwd(), 'scripts/check-task-independence.mjs');
  await withMode(LEDGER_WITH_TWO_TABLES, async (dir) => {
    const { code, stdout } = await runScript(CHECK, ['--ledger=delegation/LEDGER.md'], dir);
    assert.equal(code, 0, 'two file-disjoint tasks plus a summary table is still clean');
    assert.match(stdout, /Checked 2 task\(s\)/, 'the summary rows must not be counted as tasks');
  });
});
