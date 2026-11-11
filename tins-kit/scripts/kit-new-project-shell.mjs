#!/usr/bin/env node
// scripts/kit-new-project-shell.mjs
// Scaffold a portable "kit shell" for a new project — the minimum subset of
// the kit the user can take to a different machine, on a USB stick, or in
// a tarball, to start a new TINS project without the full kit.
//
// The shell is small (~10 files, ~50 KB) and self-contained. It includes:
//   - AGENT-BRIEF.md (template)
//   - HANDOVER.md (template)
//   - BUILDER-DECISIONS-REVIEW.md (template)
//   - REVIEWER-DECISIONS-REVIEW.md (template)
//   - .kit-shell/
//     ├── scripts/
//     │   ├── decision-log.mjs (records builder decisions)
//     │   ├── kit-extract.mjs (mines the decisions for kit-worthy patterns)
//     │   └── kit-staging-export.mjs (dumps the candidates to a tarball)
//     ├── prompts/
//     │   ├── SPEC-AUTHOR.md (interview the user)
//     │   ├── INTERVIEW-CHECKLIST.md
//     │   ├── BUILDER-REVIEW-TEMPLATE.md
//     │   └── NEW-PROJECT.md (this generic prompt)
//     ├── templates/
//     │   ├── HANDOVER.md
//     │   ├── BUILDER-DECISIONS-REVIEW.md
//     │   ├── REVIEWER-DECISIONS-REVIEW.md
//     │   └── AGENT-BRIEF.md
//     └── .kit-shell.json (marker)
//
// The shell is enough to:
//   1. Run the SPEC-AUTHOR interview and draft SPEC.md
//   2. Record builder decisions
//   3. Mine the decisions for kit-worthy patterns
//   4. Export the candidates to a tarball for transport back to the kit machine
//
// It is NOT enough to run the full kit's validate.mjs / selftest.mjs /
// KITTING workflow. Those run at the kit root, on the kit machine, after
// the tarball is dropped in kit-staging/inbox/.
//
// Usage:
//   node tins-kit/scripts/kit-new-project-shell.mjs <project-name>
//   node tins-kit/scripts/kit-new-project-shell.mjs my-saas --out=./my-saas
//   node tins-kit/scripts/kit-new-project-shell.mjs my-saas --tarball=./my-saas-shell.tar.gz

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, copyFileSync, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const tarballArg = args.find(a => a.startsWith('--tarball='));
const positional = args.filter(a => !a.startsWith('--'));
const projectName = positional[0];

if (!projectName) {
  console.error('Usage: node kit-new-project-shell.mjs <project-name> [--out=<path>] [--tarball=<path>]');
  console.error('  Example: node kit-new-project-shell.mjs my-saas');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(scriptDir, '..');
const targetDir = outArg ? resolve(outArg.split('=')[1]) : resolve(process.cwd(), projectName);

if (existsSync(targetDir)) {
  console.error(`ERROR: target directory already exists: ${targetDir}`);
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);

console.log(`Scaffolding portable kit shell for: ${projectName}`);
console.log(`  Target: ${targetDir}`);

// 1. Create directory structure
mkdirSync(targetDir, { recursive: true });
mkdirSync(join(targetDir, '.kit-shell', 'scripts'), { recursive: true });
mkdirSync(join(targetDir, '.kit-shell', 'prompts'), { recursive: true });
mkdirSync(join(targetDir, '.kit-shell', 'templates'), { recursive: true });
mkdirSync(join(targetDir, '.kit-shell', 'lib', 'patterns'), { recursive: true });

// 2. Copy the top-level templates
const topLevelTemplates = [
  ['templates/AGENT-BRIEF.md', 'AGENT-BRIEF.md'],
  ['templates/HANDOVER.md', 'HANDOVER.md'],
  ['templates/BUILDER-DECISIONS-REVIEW.md', 'BUILDER-DECISIONS-REVIEW.md'],
  ['templates/REVIEWER-DECISIONS-REVIEW.md', 'REVIEWER-DECISIONS-REVIEW.md'],
];
for (const [src, dst] of topLevelTemplates) {
  const srcPath = join(kitRoot, src);
  if (!existsSync(srcPath)) continue;
  let content = readFileSync(srcPath, 'utf8');
  content = content.replace(/<project-name>/g, projectName);
  content = content.replace(/<YYYY-MM-DD>/g, today);
  writeFileSync(join(targetDir, dst), content, 'utf8');
  console.log(`  ✓ ${dst}`);
}

// 3. Copy the kit-shell subset (the minimum needed to work remotely)
const shellFiles = [
  ['scripts/decision-log.mjs', '.kit-shell/scripts/decision-log.mjs'],
  ['scripts/kit-extract.mjs', '.kit-shell/scripts/kit-extract.mjs'],
  // Fixed 2026: this was missing even though the header comment above, and the README.md
  // this scaffolder generates below, both instruct the user to run it as the final step.
  ['scripts/kit-staging-export.mjs', '.kit-shell/scripts/kit-staging-export.mjs'],
  ['prompts/SPEC-AUTHOR.md', '.kit-shell/prompts/SPEC-AUTHOR.md'],
  ['prompts/INTERVIEW-CHECKLIST.md', '.kit-shell/prompts/INTERVIEW-CHECKLIST.md'],
  ['prompts/BUILDER-REVIEW-TEMPLATE.md', '.kit-shell/prompts/BUILDER-REVIEW-TEMPLATE.md'],
  ['prompts/NEW-PROJECT.md', '.kit-shell/prompts/NEW-PROJECT.md'],
  // D33 — the tooling gate runs before any work starts, so the shell needs it.
  ['scripts/tooling-audit.mjs', '.kit-shell/scripts/tooling-audit.mjs'],
  ['prompts/TOOLING-AUDIT.md', '.kit-shell/prompts/TOOLING-AUDIT.md'],
  ['lib/patterns/third-party-tool-audit.md', '.kit-shell/lib/patterns/third-party-tool-audit.md'],
  // D34 — the steering-card catalogue the session selects from.
  ['prompts/STEERING-PROMPTS.md', '.kit-shell/prompts/STEERING-PROMPTS.md'],
  // D35 — ask how the build should be executed, once the spec locks.
  ['prompts/EXECUTION-MODE-INTERVIEW.md', '.kit-shell/prompts/EXECUTION-MODE-INTERVIEW.md'],
  ['prompts/DELEGATE-WORK.md', '.kit-shell/prompts/DELEGATE-WORK.md'],
  // D32 — autonomous build. The shell carries the whole path or none of it.
  ['prompts/AUTONOMOUS-BUILD.md', '.kit-shell/prompts/AUTONOMOUS-BUILD.md'],
  ['prompts/WORKER-SESSION.md', '.kit-shell/prompts/WORKER-SESSION.md'],
  ['prompts/INTEGRATE-DELEGATED-WORK.md', '.kit-shell/prompts/INTEGRATE-DELEGATED-WORK.md'],
  ['scripts/orchestrate.mjs', '.kit-shell/scripts/orchestrate.mjs'],
  ['scripts/escalate.mjs', '.kit-shell/scripts/escalate.mjs'],
  ['scripts/check-task-independence.mjs', '.kit-shell/scripts/check-task-independence.mjs'],
  ['scripts/validate.mjs', '.kit-shell/scripts/validate.mjs'],
  ['lib/patterns/tiered-escalation.md', '.kit-shell/lib/patterns/tiered-escalation.md'],
];
for (const [src, dst] of shellFiles) {
  const srcPath = join(kitRoot, src);
  if (!existsSync(srcPath)) continue;
  const dstPath = join(targetDir, dst);
  copyFileSync(srcPath, dstPath);
  console.log(`  ✓ ${dst}`);
}

// 4. Copy the templates into .kit-shell/templates/ (so the export script can re-scaffold)
const shellTemplates = [
  'AGENT-BRIEF.md', 'HANDOVER.md', 'BUILDER-DECISIONS-REVIEW.md', 'REVIEWER-DECISIONS-REVIEW.md',
  // D33 / D32 — the gate's record and the autonomous run's state files.
  'TOOLING-AUDIT.md', 'ORCHESTRATION.json', 'ESCALATIONS.md',
  'DELEGATION-LEDGER.md', 'DELEGATION-README.md',
];
for (const t of shellTemplates) {
  const srcPath = join(kitRoot, 'templates', t);
  const dstPath = join(targetDir, '.kit-shell', 'templates', t);
  if (existsSync(srcPath)) copyFileSync(srcPath, dstPath);
}

// 5. Write the .kit-shell.json marker
const marker = {
  shell: true,
  kitVersion: '2.0',
  kitSource: kitRoot,
  createdAt: new Date().toISOString(),
  project: projectName,
  instructions: 'See .kit-shell/prompts/NEW-PROJECT.md for the workflow. When done, run `node .kit-shell/scripts/kit-staging-export.mjs` to produce a tarball for transport to the kit machine.',
};
writeFileSync(
  join(targetDir, '.kit-shell', '.kit-shell.json'),
  JSON.stringify(marker, null, 2) + '\n',
  'utf8'
);
console.log(`  ✓ .kit-shell/.kit-shell.json`);

// 6. Write a starter README in the project
const readme = `# ${projectName} — a TINS project shell

> **This is a portable kit shell, not a full TINS consumer.** It contains the
> minimum subset of the kit needed to start a new project in any directory,
> on any machine. When the project is done, the artefacts are exported back
> to the top-level kit via the \`kit-staging/\` inbox.

## What to do (in order)

1. Read \`AGENT-BRIEF.md\` (the per-project onboarding).
2. Open a fresh LLM session at this directory. Paste
   \`.kit-shell/prompts/NEW-PROJECT.md\` as the prompt.
3. The LLM runs the SPEC-AUTHOR interview, drafts \`SPEC.md\`, and starts building.
4. While building, the LLM records decisions in \`BUILDER-DECISIONS-REVIEW.md\` via
   \`node .kit-shell/scripts/decision-log.mjs builder ...\`.
5. When done (or at a meaningful milestone), the LLM mines the decisions via
   \`node .kit-shell/scripts/kit-extract.mjs --consumer=.\` to produce
   \`./kit-growth-candidates.md\`.
6. To ship back to the kit machine:
   \`\`\`bash
   node .kit-shell/scripts/kit-staging-export.mjs
   # → produces ./kit-staging-export-<date>.tar.gz
   \`\`\`
7. Copy the tarball to the kit machine:
   \`\`\`bash
   # at the kit machine
   mkdir -p ../tins-kit/kit-staging/inbox/${projectName}/
   tar -xzf kit-staging-export-<date>.tar.gz -C ../tins-kit/kit-staging/inbox/${projectName}/
   \`\`\`
8. The kit-growth session at the kit root triages the candidates (via
   \`prompts/KIT-GROWTH-SESSION.md\`) and decides which to add to the kit.

## The 3 things you do NOT have (and where to get them)

- The full \`tins-kit/\` (the lib modules, all 21 patterns, the validators,
  the CI workflow). These live on the kit machine. The shell only ships
  the minimum subset needed to start.
- The \`node_modules/\` for the kit's scripts (the shell's scripts are
  zero-dep, so no install needed).
- The CI gate. The shell's scripts run locally; the full gate runs at
  the kit root.

## File layout

\`\`\`
${projectName}/
├── README.md                       ← this file
├── AGENT-BRIEF.md                  ← per-project onboarding
├── HANDOVER.md                     ← the project's W-queue + state
├── BUILDER-DECISIONS-REVIEW.md    ← the project's decision log
├── REVIEWER-DECISIONS-REVIEW.md   ← the project's meta-review log
├── SPEC.md                         ← the spec (filled in by the LLM via SPEC-AUTHOR)
└── .kit-shell/                     ← the portable kit subset
    ├── .kit-shell.json              ← marker: {"shell": true, "kitVersion": "2.0"}
    ├── scripts/
    │   ├── decision-log.mjs         ← record decisions
    │   ├── kit-extract.mjs          ← mine for kit-worthy patterns
    │   └── kit-staging-export.mjs   ← produce the tarball for transport
    ├── prompts/
    │   ├── SPEC-AUTHOR.md           ← interview the user
    │   ├── INTERVIEW-CHECKLIST.md
    │   ├── BUILDER-REVIEW-TEMPLATE.md
    │   └── NEW-PROJECT.md           ← the workflow to start
    └── templates/
        ├── HANDOVER.md
        ├── BUILDER-DECISIONS-REVIEW.md
        ├── REVIEWER-DECISIONS-REVIEW.md
        └── AGENT-BRIEF.md
\`\`\`
`;
writeFileSync(join(targetDir, 'README.md'), readme, 'utf8');
console.log(`  ✓ README.md`);

// 7. Optionally produce a tarball
if (tarballArg) {
  const tarballPath = resolve(tarballArg.split('=')[1]);
  await tar(targetDir, tarballPath);
  console.log(`\n✅ Tarball: ${tarballPath}`);
}

console.log('\n✅ Scaffolded.');
console.log('');
console.log('Next steps:');
console.log('  1. cd', projectName);
console.log('  2. Read AGENT-BRIEF.md');
console.log('  3. Open a fresh LLM session, paste .kit-shell/prompts/NEW-PROJECT.md');
console.log('  4. The LLM runs the SPEC-AUTHOR interview + builds the project');
console.log('  5. When done: node .kit-shell/scripts/kit-staging-export.mjs');
console.log('  6. Copy the tarball to the kit machine\'s kit-staging/inbox/' + projectName + '/');
console.log('  7. The kit-growth session at the kit root triages the candidates.');

// ============================================================================
// HELPERS
// ============================================================================

// Minimal tar implementation (no external dep). Supports files + dirs.
// Format: ustar (POSIX.1-1988) — sufficient for the kit's needs.
async function tar(srcDir, outFile) {
  // For simplicity, use Node's built-in tar via child_process
  const { spawn } = await import('node:child_process');
  return new Promise((resolveP, rejectP) => {
    // On Windows, tar may not be in PATH. Use Node's archiver-free approach:
    // Just produce a zip via the system tar if available, otherwise copy the dir.
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Fallback: produce a .tar.gz via Node's zlib (basic implementation)
      // For now, just copy the dir to a .tar-named folder.
      console.log('  (Windows: using PowerShell Compress-Archive for the tarball)');
      const ps = spawn('powershell', [
        '-NoProfile', '-Command',
        `Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${outFile.replace(/\.tar\.gz$/, '.zip')}' -Force`
      ], { stdio: 'inherit' });
      ps.on('close', (code) => {
        if (code === 0) {
          console.log(`  (produced: ${outFile.replace(/\.tar\.gz$/, '.zip')})`);
          resolveP();
        } else {
          rejectP(new Error(`PowerShell Compress-Archive exited with ${code}`));
        }
      });
    } else {
      const t = spawn('tar', ['czf', outFile, '-C', dirname(srcDir), basename(srcDir)], { stdio: 'inherit' });
      t.on('close', (code) => code === 0 ? resolveP() : rejectP(new Error(`tar exited with ${code}`)));
    }
  });
}
