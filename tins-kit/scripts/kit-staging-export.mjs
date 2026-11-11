#!/usr/bin/env node
// scripts/kit-staging-export.mjs
// A small helper for a remote project (using only the .kit-shell/) to dump
// its kit-worthy artefacts into a single tarball that the user copies back
// to the kit machine.
//
// Usage:
//   node .kit-shell/scripts/kit-staging-export.mjs
//   node .kit-shell/scripts/kit-staging-export.mjs --out=./my-export.tar.gz
//   node .kit-shell/scripts/kit-staging-export.mjs --auto-mine   # run kit-extract.mjs first if no candidates file
//
// Zero-dep Node ESM. The tarball is a .zip on Windows (PowerShell
// Compress-Archive) and a .tar.gz on POSIX (the system `tar`).

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const autoMine = args.includes('--auto-mine');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..', '..');  // .kit-shell/scripts → project root

// Read the .kit-shell.json marker
const markerPath = join(scriptDir, '..', '.kit-shell.json');
let marker = null;
if (existsSync(markerPath)) {
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {}
}

if (!marker) {
  console.error('ERROR: .kit-shell/.kit-shell.json not found. Are you running this from inside a kit shell?');
  process.exit(2);
}

const projectName = marker.project;
const today = new Date().toISOString().slice(0, 10);
const exportName = `kit-staging-export-${projectName}-${today}`;

// 1. If --auto-mine, run kit-extract.mjs to produce the candidates file (if missing)
const candidatesPath = join(projectRoot, 'kit-growth-candidates.md');
if (autoMine && !existsSync(candidatesPath)) {
  console.log('Auto-mining: running kit-extract.mjs...');
  const extractScript = join(scriptDir, 'kit-extract.mjs');
  if (existsSync(extractScript)) {
    const r = spawn(process.execPath, [extractScript, '--consumer=.'], { stdio: 'inherit', cwd: projectRoot });
    r.on('close', (code) => {
      if (code === 1) console.log('  (kit-extract exited 1 = candidates found)');
      else if (code === 0) console.log('  (kit-extract exited 0 = no candidates)');
      // Continue regardless
    });
  } else {
    console.error('  (kit-extract.mjs not found in the shell; skipping auto-mine)');
  }
}

// 2. Build a staging dir with the artefacts to ship
const stagingDir = join(projectRoot, '.kit-staging-export', exportName);
mkdirSync(stagingDir, { recursive: true });

// 2a. Copy BUILDER-DECISIONS-REVIEW.md (always)
const bdrPath = join(projectRoot, 'BUILDER-DECISIONS-REVIEW.md');
if (existsSync(bdrPath)) {
  copyFileSync(bdrPath, join(stagingDir, 'BUILDER-DECISIONS-REVIEW.md'));
  console.log(`  + BUILDER-DECISIONS-REVIEW.md (${statSync(bdrPath).size} bytes)`);
}

// 2b. Copy kit-growth-candidates.md (if exists)
if (existsSync(candidatesPath)) {
  copyFileSync(candidatesPath, join(stagingDir, 'kit-growth-candidates.md'));
  console.log(`  + kit-growth-candidates.md (${statSync(candidatesPath).size} bytes)`);
}

// 2c. Copy any lib/patterns/ the project created
const projPatternsDir = join(projectRoot, 'lib', 'patterns');
if (existsSync(projPatternsDir)) {
  const exportPatternsDir = join(stagingDir, 'lib', 'patterns');
  mkdirSync(exportPatternsDir, { recursive: true });
  let count = 0;
  for (const f of readdirSync(projPatternsDir)) {
    if (!f.endsWith('.md')) continue;
    copyFileSync(join(projPatternsDir, f), join(exportPatternsDir, f));
    count++;
  }
  if (count > 0) console.log(`  + lib/patterns/ (${count} pattern(s))`);
}

// 2d. Copy any lib/<module>/ the project created
const projLibDir = join(projectRoot, 'lib');
if (existsSync(projLibDir)) {
  let count = 0;
  for (const entry of readdirSync(projLibDir)) {
    if (entry === 'patterns' || entry === 'tests' || entry === 'archive' || entry === 'node_modules') continue;
    const moduleDir = join(projLibDir, entry);
    if (!statSync(moduleDir).isDirectory()) continue;
    // Check the canonical layout
    if (existsSync(join(moduleDir, 'index.ts'))) {
      const destModuleDir = join(stagingDir, 'lib', entry);
      mkdirSync(destModuleDir, { recursive: true });
      for (const f of readdirSync(moduleDir)) {
        const full = join(moduleDir, f);
        if (statSync(full).isFile()) {
          copyFileSync(full, join(destModuleDir, f));
        }
      }
      count++;
    }
  }
  if (count > 0) console.log(`  + lib/<module>/ (${count} module(s))`);
}

// 2e. Copy any prompts/ the project created
const projPromptsDir = join(projectRoot, 'prompts');
if (existsSync(projPromptsDir)) {
  const exportPromptsDir = join(stagingDir, 'prompts');
  mkdirSync(exportPromptsDir, { recursive: true });
  let count = 0;
  for (const f of readdirSync(projPromptsDir)) {
    if (!f.endsWith('.md')) continue;
    copyFileSync(join(projPromptsDir, f), join(exportPromptsDir, f));
    count++;
  }
  if (count > 0) console.log(`  + prompts/ (${count} prompt(s))`);
}

// 2f. Write the .kit-shell.json marker (so the kit knows the version)
if (marker) {
  copyFileSync(markerPath, join(stagingDir, '.kit-shell.json'));
  console.log(`  + .kit-shell.json`);
}

// 3. Produce the tarball
const isWindows = process.platform === 'win32';
// Fixed 2026: this used to always default to a `.zip` name even on POSIX, where the branch
// below always shells out to system `tar czf` — producing a real gzip/tar file mislabeled
// `.zip` (fails to open in Windows Explorer / `unzip`, confirmed via `file`/`unzip -l`).
// Match the extension to what's actually produced, matching --out= if the caller overrides it.
const defaultExt = isWindows ? '.zip' : '.tar.gz';
const tarballPath = outArg ? resolve(outArg.split('=')[1]) : join(projectRoot, `${exportName}${defaultExt}`);

if (isWindows) {
  // PowerShell Compress-Archive → .zip
  const ps = spawn('powershell', [
    '-NoProfile', '-Command',
    `Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${tarballPath}' -Force`
  ], { stdio: 'inherit' });
  ps.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✅ Tarball: ${tarballPath}`);
      console.log(`\nNext step: copy this file to the kit machine, then:`);
      console.log(`  mkdir -p <kit-machine>/tins-kit/kit-staging/inbox/${projectName}/`);
      console.log(`  tar -xzf ${tarballPath} -C <kit-machine>/tins-kit/kit-staging/inbox/${projectName}/`);
      console.log(`  # or unzip on Windows:`);
      console.log(`  Expand-Archive -Path ${tarballPath} -DestinationPath <kit-machine>/tins-kit/kit-staging/inbox/${projectName}/`);
    } else {
      console.error(`PowerShell Compress-Archive exited with ${code}`);
      process.exit(1);
    }
  });
} else {
  // POSIX tar -czf → .tar.gz
  const t = spawn('tar', ['czf', tarballPath, '-C', stagingDir, '.'], { stdio: 'inherit' });
  t.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✅ Tarball: ${tarballPath}`);
      console.log(`\nNext step: copy this file to the kit machine, then:`);
      console.log(`  mkdir -p <kit-machine>/tins-kit/kit-staging/inbox/${projectName}/`);
      console.log(`  tar -xzf ${tarballPath} -C <kit-machine>/tins-kit/kit-staging/inbox/${projectName}/`);
    } else {
      console.error(`tar exited with ${code}`);
      process.exit(1);
    }
  });
}
