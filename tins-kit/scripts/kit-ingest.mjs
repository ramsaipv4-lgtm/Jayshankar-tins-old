#!/usr/bin/env node
// scripts/kit-ingest.mjs
// Scan the kit-staging/inbox/ and produce a merged triage report.
//
// Each project drops artefacts into `kit-staging/inbox/<project-name>/`.
// This script:
//   1. Walks every project subdir in the inbox
//   2. For each, runs the kit-extract.mjs heuristic on the BUILDER-DECISIONS-REVIEW.md
//      (or uses the pre-mined kit-growth-candidates.md if present)
//   3. Also harvests any lib/patterns/<name>.md, lib/<module>/, prompts/<name>.md
//   4. Writes a single merged triage report at `kit-staging/triage-<date>.md`
//
// Usage:
//   node scripts/kit-ingest.mjs                       # scan all inbox entries
//   node scripts/kit-ingest.mjs --out=custom-name.md   # custom output
//   node scripts/kit-ingest.mjs --archive             # move inbox → archive/ after scan
//   node scripts/kit-ingest.mjs --json                # JSON output

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const args = process.argv.slice(2);
const outArg = args.find(a => a.startsWith('--out='));
const jsonOut = args.includes('--json');
const archive = args.includes('--archive');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(scriptDir, '..');
const inboxDir = join(kitRoot, 'kit-staging', 'inbox');
const archiveDir = join(kitRoot, 'kit-staging', 'archive');

if (!existsSync(inboxDir)) {
  console.error(`ERROR: inbox not found: ${inboxDir}`);
  process.exit(2);
}

// --- Find the inbox entries (each is a project-name subdir) ---
const projectDirs = readdirSync(inboxDir)
  .map(name => join(inboxDir, name))
  .filter(p => {
    try { return statSync(p).isDirectory(); } catch { return false; }
  });

if (projectDirs.length === 0) {
  console.log('Inbox is empty. Nothing to ingest.');
  process.exit(0);
}

console.log(`Found ${projectDirs.length} inbox entr${projectDirs.length === 1 ? 'y' : 'ies'}:`);
for (const d of projectDirs) console.log(`  - ${d.replace(inboxDir + '\\', '').replace(inboxDir + '/', '')}`);

// --- For each project, gather candidates ---
const allCandidates = [];  // { project, source, score, title, body, type }
for (const projectDir of projectDirs) {
  const projectName = projectDir.replace(inboxDir + '\\', '').replace(inboxDir + '/', '');
  console.log(`\nProcessing: ${projectName}`);

  // 1. Pre-mined kit-growth-candidates.md (if present, use as-is)
  const candidatesPath = join(projectDir, 'kit-growth-candidates.md');
  if (existsSync(candidatesPath)) {
    const text = readFileSync(candidatesPath, 'utf8');
    // Parse the candidate sections (## C1, ## C2, etc.)
    const sections = text.split(/\n###\s+/);
    for (const section of sections.slice(1)) {
      const lines = section.split('\n');
      const titleLine = lines[0];
      const idMatch = titleLine.match(/^(C\d+)\s*[—\-:]\s*(.+?)\s*\(score:\s*(\d+)\)/);
      if (!idMatch) continue;
      allCandidates.push({
        project: projectName,
        source: 'kit-growth-candidates.md',
        id: idMatch[1],
        title: idMatch[2].trim(),
        score: parseInt(idMatch[3], 10),
        body: section,
        type: 'pre-mined',
      });
    }
    console.log(`  - kit-growth-candidates.md: ${sections.length - 1} candidate(s)`);
  }

  // 2. BUILDER-DECISIONS-REVIEW.md (re-mine with the kit-extract heuristic)
  const bdrPath = join(projectDir, 'BUILDER-DECISIONS-REVIEW.md');
  if (existsSync(bdrPath)) {
    const text = readFileSync(bdrPath, 'utf8');
    const sections = text.split(/\n##\s+/);
    let mined = 0;
    for (const section of sections.slice(1)) {
      const lines = section.split('\n');
      const titleLine = lines[0];
      const idMatch = titleLine.match(/^(D?\d+)\s*[—\-:]\s*(.+?)$/);
      if (!idMatch) continue;
      const title = idMatch[2].trim();
      const body = lines.slice(1).join('\n');
      const score = scoreDecision(title, body);
      if (score >= 3) {
        allCandidates.push({
          project: projectName,
          source: 'BUILDER-DECISIONS-REVIEW.md',
          id: `D${idMatch[1]}`,
          title,
          score,
          body,
          type: 'mined',
        });
        mined++;
      }
    }
    console.log(`  - BUILDER-DECISIONS-REVIEW.md: ${mined} candidate(s) scored ≥3`);
  }

  // 3. lib/patterns/<name>.md (validate the 4-section structure)
  const patternsDir = join(projectDir, 'lib', 'patterns');
  if (existsSync(patternsDir)) {
    let count = 0;
    for (const f of readdirSync(patternsDir)) {
      if (!f.endsWith('.md')) continue;
      const text = readFileSync(join(patternsDir, f), 'utf8');
      const name = f.replace(/\.md$/, '');
      if (
        text.includes('## 0. Why this exists') &&
        text.includes('## 1. The 3 lessons') &&
        text.includes('## 2. The 3 known anti-patterns') &&
        text.includes('## 3. When this')
      ) {
        allCandidates.push({
          project: projectName,
          source: `lib/patterns/${f}`,
          id: `pattern:${name}`,
          title: name,
          score: 5,
          body: text,
          type: 'pattern',
        });
        count++;
      }
    }
    if (count > 0) console.log(`  - lib/patterns/: ${count} pattern(s) with 4-section structure`);
  }

  // 4. lib/<module>/ (validate the canonical layout)
  const libDir = join(projectDir, 'lib');
  if (existsSync(libDir)) {
    let count = 0;
    for (const entry of readdirSync(libDir)) {
      if (entry === 'patterns' || entry === 'tests' || entry === 'archive' || entry === 'node_modules') continue;
      const moduleDir = join(libDir, entry);
      if (!statSync(moduleDir).isDirectory()) continue;
      const hasIndex = existsSync(join(moduleDir, 'index.ts'));
      const hasReadme = existsSync(join(moduleDir, 'README.md'));
      const testsDir = join(moduleDir, 'tests');
      const hasTests = existsSync(testsDir) && readdirSync(testsDir).some(f => f.endsWith('.test.ts'));
      if (hasIndex && hasReadme && hasTests) {
        allCandidates.push({
          project: projectName,
          source: `lib/${entry}/`,
          id: `module:${entry}`,
          title: entry,
          score: 4,
          body: `${hasIndex ? 'index.ts' : ''} ${hasReadme ? 'README.md' : ''} ${hasTests ? 'tests/' : ''}`,
          type: 'module',
        });
        count++;
      }
    }
    if (count > 0) console.log(`  - lib/<module>/: ${count} module(s) with canonical layout`);
  }

  // 5. prompts/<name>.md
  const promptsDir = join(projectDir, 'prompts');
  if (existsSync(promptsDir)) {
    let count = 0;
    for (const f of readdirSync(promptsDir)) {
      if (!f.endsWith('.md')) continue;
      const text = readFileSync(join(promptsDir, f), 'utf8');
      // Heuristic: a valid prompt has a "## The prompt" section or a "```" code block
      if (text.length > 1000 && (text.includes('The prompt') || text.includes('```\n'))) {
        allCandidates.push({
          project: projectName,
          source: `prompts/${f}`,
          id: `prompt:${f.replace(/\.md$/, '')}`,
          title: f.replace(/\.md$/, ''),
          score: 4,
          body: text,
          type: 'prompt',
        });
        count++;
      }
    }
    if (count > 0) console.log(`  - prompts/: ${count} prompt(s)`);
  }
}

// --- Sort by score (highest first) ---
allCandidates.sort((a, b) => b.score - a.score);

// --- Output ---
const today = new Date().toISOString().slice(0, 10);
const outputPath = outArg
  ? resolve(outArg.split('=')[1])
  : join(kitRoot, 'kit-staging', `triage-${today}.md`);

if (jsonOut) {
  console.log(JSON.stringify({ candidates: allCandidates, projects: projectDirs.length }, null, 2));
  process.exit(allCandidates.length > 0 ? 1 : 0);
}

const report = renderReport(allCandidates, projectDirs);
writeFileSync(outputPath, report, 'utf8');
console.log(`\nWrote: ${outputPath}`);
console.log(`Found: ${allCandidates.length} candidate(s) across ${projectDirs.length} project(s)`);

// --- Archive (if requested) ---
if (archive) {
  mkdirSync(join(archiveDir, today), { recursive: true });
  for (const d of projectDirs) {
    const name = d.replace(inboxDir + '\\', '').replace(inboxDir + '/', '');
    const dest = join(archiveDir, today, name);
    if (existsSync(dest)) {
      console.log(`  (archive: ${name} already in archive/${today}/, skipping)`);
    } else {
      renameSync(d, dest);
      console.log(`  Archived: ${name} → kit-staging/archive/${today}/${name}/`);
    }
  }
}

process.exit(allCandidates.length > 0 ? 1 : 0);

// ============================================================================
// HELPERS
// ============================================================================

function scoreDecision(title, body) {
  let score = 0;
  const allText = `${title} ${body}`.toLowerCase();
  if (/\b(pattern|recipe|discipline|convention|rule|always|never)\b/.test(title.toLowerCase())) score += 2;
  if (body.length > 300) score += 1;
  if (/\b(lesson|anti-pattern|gotcha|pitfall|mistake)\b/.test(allText)) score += 1;
  if (/`[^`]+`|src\/|lib\/|prisma\/|migrations\//.test(body)) score += 2;
  if ((body.match(/jayshankar|incubos|incubation|exam-forge|tins-kit/g) || []).length > 4) score -= 3;
  if (/deferred|rejected|wip|todo/i.test(title)) score -= 2;
  return score;
}

function renderReport(candidates, projectDirs) {
  const lines = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`# Kit Growth Triage — auto-merged from ${projectDirs.length} inbox entr${projectDirs.length === 1 ? 'y' : 'ies'}`);
  lines.push('');
  lines.push(`> **Generated:** ${new Date().toISOString()}`);
  lines.push(`> **Source:** ${projectDirs.map(d => d.replace(kitRoot + '\\kit-staging\\inbox\\', '').replace(kitRoot + '/kit-staging/inbox/', '')).join(', ')}`);
  lines.push(`> **Kit already has:** ${readdirSync(join(kitRoot, 'lib', 'patterns')).filter(f => f.endsWith('.md')).length} patterns`);
  lines.push('');
  lines.push(`Found **${candidates.length}** candidate(s). Each is scored 1-7; ≥3 means worth a look. Type is one of: pre-mined / mined / pattern / module / prompt.`);
  lines.push('');

  if (candidates.length === 0) {
    lines.push('_No growth candidates found. The inbox is empty of kit-worthy artefacts._');
    return lines.join('\n');
  }

  // Group by project
  const byProject = new Map();
  for (const c of candidates) {
    if (!byProject.has(c.project)) byProject.set(c.project, []);
    byProject.get(c.project).push(c);
  }

  for (const [project, list] of byProject) {
    lines.push(`## From \`${project}\` (${list.length} candidate${list.length === 1 ? '' : 's'})`);
    lines.push('');
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      lines.push(`### C${i + 1} (${c.project}) — ${c.title} (score: ${c.score}, type: ${c.type})`);
      lines.push('');
      lines.push(`- **Source:** \`${c.source}\``);
      lines.push(`- **ID:** \`${c.id}\``);
      if (c.type === 'pre-mined' || c.type === 'mined') {
        // First 500 chars of body
        const preview = c.body.split('\n').filter(l => l.trim()).slice(0, 6).join('\n');
        lines.push('```');
        lines.push(preview);
        lines.push('```');
      } else if (c.type === 'pattern') {
        lines.push('- **Structure:** passes the 4-section structure check (§0 / §1 / §2 / §3)');
        lines.push('- **Body length:** ' + c.body.length + ' chars');
      } else if (c.type === 'module') {
        lines.push('- **Layout:** ' + c.body);
      } else if (c.type === 'prompt') {
        lines.push('- **Body length:** ' + c.body.length + ' chars');
      }
      lines.push('');
    }
  }

  // Triage template
  lines.push('## Triage template');
  lines.push('');
  lines.push('For each candidate above, fill in:');
  lines.push('');
  lines.push('```');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    lines.push(`C${i + 1} (${c.project}: ${c.title}): [accept | reject | defer] — <reason>`);
  }
  lines.push('```');
  lines.push('');
  lines.push('## How to run the triage');
  lines.push('');
  lines.push('1. Open a fresh LLM session at the kit root.');
  lines.push('2. Paste `prompts/KIT-GROWTH-SESSION.md` as the prompt.');
  lines.push('3. The session reads this triage report, triages each candidate, and runs the KITTING workflow for each accepted one.');
  lines.push('4. After all accepted candidates are landed, run `node scripts/validate.mjs --all` to confirm the gate is still green.');
  lines.push('5. The session moves the inbox entry to `kit-staging/archive/<date>/` (use `kit-ingest.mjs --archive` for the next run).');
  lines.push('6. The session runs `node scripts/kit-sync.mjs --to=../<each-project>` to push the new kit to all consumers.');

  return lines.join('\n');
}
