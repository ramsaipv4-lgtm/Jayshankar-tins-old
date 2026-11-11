#!/usr/bin/env node
// scripts/new-project.mjs — scaffold a new TINS consumer project
//
// Usage:
//   node tins-kit/scripts/new-project.mjs <project-name> [--with=<comma-separated-modules>]
//
// Example:
//   node tins-kit/scripts/new-project.mjs my-saas --with=tenant-rls,money-as-decimal
//
// The script creates a sibling directory with:
//   - SPEC.md (from templates/SPEC.md)
//   - HANDOVER.md (from templates/HANDOVER.md)
//   - AGENTS.md (from templates/AGENTS.md)
//   - BUILDER-DECISIONS-REVIEW.md (from templates/BUILDER-DECISIONS-REVIEW.md)
//   - REVIEWER-DECISIONS-REVIEW.md (from templates/REVIEWER-DECISIONS-REVIEW.md)
//   - .gitignore (from templates/.gitignore)
//   - prompts/, schemas/, scripts/, docs/, tests/, lib/ (empty dirs)
//   - The chosen lib/<name>/ modules
//   - The kit's scripts/ (validate.mjs, selftest.mjs, etc.)
//   - A package.json with the kit's scripts wired up
//
// Zero-dep Node ESM. The consumer runs `pnpm install` after scaffolding.

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const args = process.argv.slice(2);
const withArg = args.find(a => a.startsWith('--with='));
const modules = withArg
  ? withArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean)
  : [];
const positional = args.filter(a => !a.startsWith('--'));
const projectName = positional[0];

if (!projectName) {
  console.error('Usage: node scripts/new-project.mjs <project-name> [--with=<modules>]');
  console.error('  Example: node scripts/new-project.mjs my-saas --with=tenant-rls,money-as-decimal');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(scriptDir, '..');
const targetDir = resolve(process.cwd(), projectName);

if (existsSync(targetDir)) {
  console.error(`ERROR: target directory already exists: ${targetDir}`);
  process.exit(2);
}

const VALID_MODULES = new Set([
  'no-backend',
  'money-as-decimal',
  'tenant-rls',
  'audit-viewer',
  'docs-guardian',
  'pwa-config',
  'auth-shell',
]);
for (const m of modules) {
  if (!VALID_MODULES.has(m)) {
    console.error(`ERROR: unknown module "${m}". Valid: ${[...VALID_MODULES].join(', ')}`);
    process.exit(2);
  }
}

console.log(`Scaffolding new TINS project: ${projectName}`);
console.log(`  Target: ${targetDir}`);
console.log(`  Modules: ${modules.length === 0 ? '(none)' : modules.join(', ')}`);

// 1. Create directory structure
mkdirSync(targetDir, { recursive: true });
for (const dir of ['prompts', 'schemas', 'scripts', 'docs', 'tests', 'lib', 'src', 'prisma', 'public']) {
  mkdirSync(join(targetDir, dir), { recursive: true });
}

// 2. Copy the templates
const templateFiles = [
  ['templates/SPEC.md', 'SPEC.md'],
  ['templates/HANDOVER.md', 'HANDOVER.md'],
  ['templates/AGENTS.md', 'AGENTS.md'],
  ['templates/BUILDER-DECISIONS-REVIEW.md', 'BUILDER-DECISIONS-REVIEW.md'],
  ['templates/REVIEWER-DECISIONS-REVIEW.md', 'REVIEWER-DECISIONS-REVIEW.md'],
  ['templates/.gitignore', '.gitignore'],
];
for (const [src, dst] of templateFiles) {
  const srcPath = join(kitRoot, src);
  if (!existsSync(srcPath)) {
    console.error(`WARNING: template not found: ${src}`);
    continue;
  }
  const dstPath = join(targetDir, dst);
  let content = readFileSync(srcPath, 'utf8');
  // Substitute project name into templates that mention it
  content = content.replace(/<project-name>/g, projectName);
  content = content.replace(/<YYYY-MM-DD>/g, new Date().toISOString().slice(0, 10));
  writeFileSync(dstPath, content, 'utf8');
  console.log(`  ✓ ${dst}`);
}

// 3. Copy the SQL templates
const sqlTemplates = [
  ['templates/sql/rls-policies.sql', 'prisma/migrations/0001_enable_rls.sql'],
  ['templates/sql/audit-trigger.sql', 'prisma/migrations/0002_audit_trigger.sql'],
  ['templates/sql/idempotent-migration-pattern.sql', 'prisma/migrations/0003_example.sql'],
  ['templates/zod-schemas/money.zod.ts', 'src/lib/validations/money.zod.ts'],
  ['templates/eslint/no-float-money.js', '.eslint-rules/no-float-money.js'],
];
for (const [src, dst] of sqlTemplates) {
  const srcPath = join(kitRoot, src);
  if (!existsSync(srcPath)) continue;
  const dstPath = join(targetDir, dst);
  mkdirSync(dirname(dstPath), { recursive: true });
  copyFileSync(srcPath, dstPath);
  console.log(`  ✓ ${dst}`);
}

// 4. Copy the chosen lib modules
for (const m of modules) {
  const src = join(kitRoot, 'lib', m);
  const dst = join(targetDir, 'lib', m);
  if (!existsSync(src)) {
    console.error(`WARNING: module not found: lib/${m}`);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  copyDirSync(src, dst);
  console.log(`  ✓ lib/${m}/`);
}

// 5. Copy the kit's scripts
for (const f of ['validate.mjs', 'selftest.mjs', 'migration-runner.mjs', 'decision-log.mjs', 'kit-coverage.mjs', 'kit-listing.mjs', 'kit-new-pattern.mjs', 'kit-extract.mjs', 'add-footers.mjs']) {
  const src = join(kitRoot, 'scripts', f);
  if (!existsSync(src)) continue;
  const dst = join(targetDir, 'scripts', f);
  copyFileSync(src, dst);
  console.log(`  ✓ scripts/${f}`);
}

// 6. Copy the schemas
for (const f of ['tins-markers.schema.json', 'locked-decisions.schema.json', 'handover.schema.json', 'tins-spec-minimal.schema.json']) {
  const src = join(kitRoot, 'schemas', f);
  if (!existsSync(src)) continue;
  const dst = join(targetDir, 'schemas', f);
  copyFileSync(src, dst);
  console.log(`  ✓ schemas/${f}`);
}

// 7. Copy the prompts
for (const f of ['SPEC-AUTHOR.md', 'BUILDER-REVIEW-TEMPLATE.md', 'REVIEWER-REVIEW-TEMPLATE.md', 'INTERVIEW-CHECKLIST.md', 'SPEC-REVIEWER.md', 'KITTING.md', 'RELEASE-CHECKLIST.md']) {
  const src = join(kitRoot, 'prompts', f);
  if (!existsSync(src)) continue;
  const dst = join(targetDir, 'prompts', f);
  copyFileSync(src, dst);
  console.log(`  ✓ prompts/${f}`);
}

// 8. Copy the lib/patterns (the doc-only recipes)
mkdirSync(join(targetDir, 'lib', 'patterns'), { recursive: true });
for (const f of readdirSync(join(kitRoot, 'lib', 'patterns'))) {
  if (!f.endsWith('.md')) continue;
  const src = join(kitRoot, 'lib', 'patterns', f);
  const dst = join(targetDir, 'lib', 'patterns', f);
  copyFileSync(src, dst);
}
console.log(`  ✓ lib/patterns/ (${readdirSync(join(kitRoot, 'lib', 'patterns')).filter(f => f.endsWith('.md')).length} patterns)`);

// 9. Copy the docs (WORKFLOW, LIBRARY-CONVENTIONS, KITTING, GAP-ANALYSIS)
for (const f of ['WORKFLOW.md', 'LIBRARY-CONVENTIONS.md', 'KITTING.md', 'GAP-ANALYSIS.md']) {
  const src = join(kitRoot, 'docs', f);
  if (!existsSync(src)) continue;
  const dst = join(targetDir, 'docs', f);
  copyFileSync(src, dst);
  console.log(`  ✓ docs/${f}`);
}

// 10. Copy the CI workflow
const ciSrc = join(kitRoot, '.github', 'workflows', 'validate.yml');
if (existsSync(ciSrc)) {
  const ciDst = join(targetDir, '.github', 'workflows', 'validate.yml');
  mkdirSync(dirname(ciDst), { recursive: true });
  copyFileSync(ciSrc, ciDst);
  console.log(`  ✓ .github/workflows/validate.yml`);
}

// 11. Write a starter package.json
const today = new Date().toISOString().slice(0, 10);
const packageJson = {
  name: projectName,
  version: '0.1.0',
  private: true,
  type: 'module',
  description: `A TINS consumer scaffolded from tins-kit on ${today}.`,
  scripts: {
    validate: 'node scripts/validate.mjs --spec=SPEC.md',
    'validate:kit': 'node scripts/validate.mjs --all',
    selftest: 'node --test scripts/selftest.mjs',
    'migrate:check': 'node scripts/migration-runner.mjs --check',
    'kit:list': 'node scripts/kit-listing.mjs',
    'kit:coverage': 'node scripts/kit-coverage.mjs --spec=SPEC.md',
  },
  devDependencies: {
    typescript: '^5.5.0',
  },
  dependencies: {},
};
writeFileSync(
  join(targetDir, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf8'
);
console.log(`  ✓ package.json`);

// 12. Write a starter tsconfig.json
const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    resolveJsonModule: true,
  },
  include: ['src/**/*', 'lib/**/*', 'tests/**/*'],
};
writeFileSync(
  join(targetDir, 'tsconfig.json'),
  JSON.stringify(tsconfig, null, 2) + '\n',
  'utf8'
);
console.log(`  ✓ tsconfig.json`);

// 13. Done
console.log('');
console.log('✅ Scaffolded.');
console.log('');
console.log('Next steps:');
console.log('  1. cd', projectName);
console.log('  2. pnpm install');
console.log('  3. node scripts/validate.mjs --spec=SPEC.md   # should be green');
console.log('  4. node --test scripts/selftest.mjs            # should be green');
console.log('  5. Open a fresh LLM session and run prompts/SPEC-AUTHOR.md');
console.log('     to interview the user and write a real SPEC.md.');
console.log('  6. node scripts/kit-coverage.mjs --spec=SPEC.md');
console.log('     to see which patterns apply to your project.');
console.log('');
console.log('The kit is yours now. Read HANDOVER.md and AGENTS.md before starting.');

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function copyDirSync(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    const srcPath = join(src, f);
    const dstPath = join(dst, f);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      copyFileSync(srcPath, dstPath);
    }
  }
}
