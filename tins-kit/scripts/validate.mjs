#!/usr/bin/env node
// validate.mjs — tins-kit spec validator
// Zero-dependency Node ESM. Reads a SPEC.md and runs the kit's structural
// acceptance checks. Exits 0 on pass, 1 on any fail. No --force flag.
//
// Usage: node scripts/validate.mjs --spec <path-to-SPEC.md>
//        node scripts/validate.mjs --kit            # run kit-internal checks
//        node scripts/validate.mjs --help
//
// As of 2026-08-15, the validator has two layers:
//   Layer 1: SPEC structural checks (the original §8.1–§8.5, plus kit-§0.4).
//   Layer 2: Kit-internal checks (§8.13–§8.20) — run when --kit is passed OR
//            when --spec points to tins-kit/SPEC.md.

import { readFile } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, isAbsolute, join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HELP = `validate.mjs — tins-kit spec validator

Usage:
  node scripts/validate.mjs --spec <path>   Validate the given SPEC.md
  node scripts/validate.mjs --kit            Validate the kit itself
                                            (runs the §8.13–§8.20 inventory checks)
  node scripts/validate.mjs --all            Both: spec structural + kit inventory
  node scripts/validate.mjs --help           Show this help

Exits 0 if every check passes or warns. Exits 1 if any check fails.

Spec structural checks (from tins-kit/SPEC.md §8.1–§8.5):
  §8.1a  TINS Specification v1.0 marker present
  §8.1b  At least one ZS: marker present
  §8.1c  All ZS: marker keys are known (COMPLEXITY, PLATFORM, LANGUAGE)
  §8.2a  §0 has at least one of {§0.0, §0.1, §0.2} subsections
  §8.2b  §0.2 has Decision and Resolution columns
  §8.2c  §0.2 has at least one decision row
  §8.3a  §0.0 names a concrete cheapest artefact
  §8.4a  §8 has at least 5 numbered criteria
  §8.5a  §9 has at least 1 out-of-scope item
  kit-§0.4  §0.4 interview-reveals-reality section present (mandated by SPEC-AUTHOR)

Kit-internal checks (from tins-kit/SPEC.md §8.13–§8.20):
  §8.13a  Every lib/patterns/<name>.md has the 4 required sections
  §8.13b  Every lib/patterns/<name>.md ends with the canonical footer
  §8.13c  Every lib/patterns/<name>.md is in the §0.4 absorption table
  §8.14a  Every lib/<name>/ has the 3 required files (index.ts, README.md, tests/)
  §8.14b  scripts/new-project.mjs scaffolder present
  §8.14c  .github/workflows/validate.yml CI workflow present
  §8.15a  Every prompts/<name>.md is present and non-empty
  §8.16a  Every templates/<name> is present and non-empty
  §8.17a  Every scripts/<name>.mjs is present and non-empty
  §8.18a  Every schemas/<name>.json is valid JSON Schema
  §8.19a  Every docs/<name>.md is present and non-empty
  §8.25a-b  Frontend-refresh prompts present (FRONTEND-VISION-INTERVIEW.md, FRONTEND-REFRESH.md)
  §8.25c-d  Frontend-refresh trigger wiring present in SPEC-AUTHOR / INTERVIEW-CHECKLIST / CONTINUE-TINS-PROJECT
  §8.26a-b  Parallel-work delegation prompts present (DELEGATE-WORK.md, INTEGRATE-DELEGATED-WORK.md)
  §8.26c    DELEGATE-WORK.md trigger wiring present in CONTINUE-TINS-PROJECT
  §8.26d-e  check-task-independence.mjs / scan-task-packet.mjs present
  §8.26f    TASK-BRIEF.md / DELEGATION-LEDGER.md / DELEGATION-README.md templates present
  §8.27a    PUBLISH-OPEN-SOURCE.md present
  §8.27b    Public-release-intent Q8 wiring present in SPEC-AUTHOR / INTERVIEW-CHECKLIST
  §8.27c    PUBLISH-OPEN-SOURCE.md trigger wiring present in CONTINUE-TINS-PROJECT
  §8.27d    scripts/private-to-public.mjs present
  §8.27e    private-to-public.mjs keeps its own banned-terms list (no shared import with scan-task-packet.mjs)
  §8.27f    lib/patterns/private-to-public.md documents corporate tone, whole-tree scan, DESIGN-WALKTHROUGH.md, and the quality rubric — and references the real script rather than embedding it
  §8.28a    GENERATE-CURRICULUM.md present, non-trivial, documents one-file-per-turn chunking, CURRICULUM-PROGRESS.md resumability, and the sibling-folder location
  §8.28b    GENERATE-INTERVIEW-PREP.md present and explicitly recommends a frontier model at extended/max thinking
  §8.28c    Both curriculum prompts reference scripts/private-to-public.mjs as their safety gate (no new scanner/list)
  §8.28d    templates/CURRICULUM-PROGRESS.md present
  §8.28e    CONTINUE-TINS-PROJECT.md routes teaching-material W's to GENERATE-CURRICULUM.md
  §8.29a    AUTONOMOUS-BUILD.md present, documents the auditor/worker split, names LEDGER.md as the state machine, and states the auditor writes no product code
  §8.29b    WORKER-SESSION.md present and documents the worker's escalation duty + return protocol
  §8.29c    scripts/orchestrate.mjs present, supports --dry-run, and documents exit code 3 (parked)
  §8.29d    scripts/escalate.mjs present
  §8.29e    AUTONOMOUS-BUILD.md drives D29's pipeline (check-task-independence.mjs + INTEGRATE-DELEGATED-WORK.md) rather than replacing it
  §8.29f    lib/patterns/tiered-escalation.md present and names all three tiers
  §8.29g    templates/ORCHESTRATION.json + templates/ESCALATIONS.md present
  §8.29h    CONTINUE-TINS-PROJECT.md routes autonomous-build W's to AUTONOMOUS-BUILD.md
  §8.30a    TOOLING-AUDIT.md prompt present, names all 3 verdicts, and resolves uncertainty to REVIEW-REQUIRED
  §8.30b    TOOLING-AUDIT.md prompt states the kit never installs and never executes a candidate
  §8.30c    scripts/tooling-audit.mjs present and documents its blocking behaviour + exit codes
  §8.30d    templates/TOOLING-AUDIT.md present with the verdict/priority/status columns
  §8.30e    lib/patterns/third-party-tool-audit.md present and lists the red flags
  §8.30f    NEW-PROJECT.md and CONTINUE-TINS-PROJECT.md both run tooling-audit.mjs as a blocking gate
  §8.31a    STEERING-PROMPTS.md present and documents adaptive selection + emission checkpoints
  §8.31b    STEERING-PROMPTS.md covers every named drift class, self-correction included
  §8.31c    STEERING-PROMPTS.md states cards are offered not auto-executed, and bans generic un-adapted cards
  §8.31d    NEW-PROJECT.md and CONTINUE-TINS-PROJECT.md both reference STEERING-PROMPTS.md
  §8.32a    EXECUTION-MODE-INTERVIEW.md present and names all 6 execution modes
  §8.32b    EXECUTION-MODE-INTERVIEW.md asks per round, pre-filled with the previous answer
  §8.32c    EXECUTION-MODE-INTERVIEW.md distinguishes auditor-remote from self-parallel by who orchestrates
  §8.32d    orchestrate.mjs reads the round mode and refuses solo / self-parallel / external rounds
  §8.32e    CONTINUE-TINS-PROJECT / SPEC-AUTHOR / NEW-PROJECT / AUTONOMOUS-BUILD all trigger the interview
  §8.32f    DELEGATE-WORK.md reads the recorded mode instead of asking its own self-vs-external question
  §8.32g    templates/DELEGATION-LEDGER.md carries the execution-mode header + task-mode vocabulary
  §8.32h    templates/ORCHESTRATION.json ships dated worker-command presets
  §8.33a    examples/autonomous-todo-app/ has README.md, TRANSCRIPT.md and RUN-DIGEST.md
  §8.33b    the example preserves the run's real LEDGER / ESCALATIONS / worker NOTES
  §8.33c    the example's README documents the kit defects the run exposed, not just successes
  §8.33d    the example ships the finished artefact the run produced
  §8.33e    kit-sync.mjs excludes examples/ from consumer syncs (D36)
`;

function parseArgs(argv) {
  const out = { spec: null, kit: false, all: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spec') {
      out.spec = argv[++i];
    } else if (a.startsWith('--spec=')) {
      out.spec = a.slice('--spec='.length);
    } else if (a === '--kit') {
      out.kit = true;
    } else if (a === '--all') {
      out.all = true;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function section(text, header) {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(line => line.startsWith(header));
  if (headerIdx === -1) return null;
  const headerLevel = (header.match(/^#+\s/) || [''])[0].trim().length;
  const captured = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#+\s)/);
    if (m && m[1].trim().length <= headerLevel) break;
    captured.push(line);
  }
  return captured.join('\n');
}

const ALLOWED_ZS_KEYS = new Set(['COMPLEXITY', 'PLATFORM', 'LANGUAGE']);

const checks = [];
function check(id, status, message) {
  checks.push({ id, status, message });
}
function fail(id, msg) { check(id, 'fail', msg); }
function pass(id, msg) { check(id, 'pass', msg); }
function warn(id, msg) { check(id, 'warn', msg); }

const args = parseArgs(process.argv);

if (args.help) {
  console.log(HELP);
  process.exit(0);
}

// Detect if --spec points to the kit's own SPEC.md. If so, also run the kit
// inventory checks (the §8.13–§8.20 layer). This is the "kit self-application"
// mode (D2).
const scriptDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(scriptDir, '..');
const isKitSelf = args.spec
  ? resolve(args.spec) === join(kitRoot, 'SPEC.md')
  : false;
const runKit = args.kit || args.all || isKitSelf;

let specPath = null;
if (args.spec) {
  specPath = isAbsolute(args.spec) ? args.spec : resolve(process.cwd(), args.spec);
  if (!existsSync(specPath)) {
    console.error(`Error: file not found: ${specPath}`);
    process.exit(1);
  }
}

if (!args.spec && !args.kit && !args.all) {
  console.error('Error: --spec <path>, --kit, or --all is required.');
  console.error('Run with --help for usage.');
  process.exit(1);
}

// ============================================================================
// LAYER 1: SPEC STRUCTURAL CHECKS
// ============================================================================

let content = null;
if (specPath) {
  try {
    const raw = await readFile(specPath, 'utf8');
    content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  } catch (err) {
    console.error(`Error: could not read ${specPath}: ${err.message}`);
    process.exit(1);
  }

  // === §8.1 TINS marker validation ===
  if (content.includes('<!-- TINS Specification v1.0 -->')) {
    pass('§8.1a', 'TINS Specification v1.0 marker present');
  } else {
    fail('§8.1a', 'Missing marker: <!-- TINS Specification v1.0 -->');
  }

  const zsMatches = content.match(/<!-- ZS:[A-Z]+:[^>]+?-->/g) || [];
  if (zsMatches.length > 0) {
    pass('§8.1b', `${zsMatches.length} ZS: marker(s) present`);
    const unknown = [];
    for (const m of zsMatches) {
      const key = m.match(/<!-- ZS:([A-Z]+):/)?.[1];
      if (key && !ALLOWED_ZS_KEYS.has(key)) {
        unknown.push(key);
      }
    }
    if (unknown.length === 0) {
      pass('§8.1c', 'all ZS: keys are known');
    } else {
      fail('§8.1c', `unknown ZS: keys: ${[...new Set(unknown)].join(', ')} (allowed: ${[...ALLOWED_ZS_KEYS].join(', ')})`);
    }
  } else {
    fail('§8.1b', 'Missing at least one <!-- ZS:KEY:VALUE --> marker');
  }

  // === §8.2 §0 structure ===
  const s00 = section(content, '### 0.0');
  const s01 = section(content, '### 0.1');
  const s02 = section(content, '### 0.2');

  if (s00 || s01 || s02) {
    pass('§8.2a', '§0 has at least one of {§0.0, §0.1, §0.2}');
  } else {
    fail('§8.2a', '§0 has none of §0.0, §0.1, §0.2 — preamble is empty');
  }

  if (s02) {
    if (/\|[^|\n]*Decision[^|\n]*\|/.test(s02) && /\|[^|\n]*Resolution[^|\n]*\|/.test(s02)) {
      pass('§8.2b', '§0.2 table has Decision and Resolution columns');
    } else {
      fail('§8.2b', '§0.2 table must have both Decision and Resolution columns');
    }

    const lines = s02.split('\n').filter(l => l.startsWith('|'));
    const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l));
    const decisionCount = Math.max(0, dataRows.length - 1);
    if (decisionCount >= 1) {
      pass('§8.2c', `§0.2 has ${decisionCount} decision(s)`);
    } else {
      fail('§8.2c', '§0.2 must have at least one decision row');
    }
  } else {
    fail('§8.2b', '§0.2 not found');
    fail('§8.2c', '§0.2 not found');
  }

  // === §8.3 §0.0 cheapest version ===
  if (s00) {
    const trimmed = s00.trim();
    if (trimmed.length < 50) {
      fail('§8.3a', '§0.0 is too short — must name a concrete cheapest artefact (≥50 chars)');
    } else {
      const tooVague = /^(the cheapest (version|artefact|artifact) that would work( for this project)?[^\n]*\n+)?\s*(a database|an app|a service|a system|software|an application)\s*\.?\s*$/im;
      if (tooVague.test(trimmed)) {
        fail('§8.3a', '§0.0 says "a database" / "an app" / "a service" — must name a concrete artefact');
      } else {
        pass('§8.3a', '§0.0 names a concrete cheapest artefact');
      }
    }
  } else {
    fail('§8.3a', '§0.0 not found — every consumer spec must have a cheapest-version line');
  }

  // === §0.4 interview-reveals-reality ===
  const s04 = section(content, '### 0.4');
  if (s04 && s04.trim().length > 50) {
    const tableRows = s04.split('\n').filter(l => l.startsWith('|') && !/^\|[\s\-:|]+\|$/.test(l));
    if (tableRows.length >= 4) {
      pass('kit-§0.4', `§0.4 interview-reveals-reality present (${tableRows.length - 1} row(s))`);
    } else {
      warn('kit-§0.4', `§0.4 present but looks thin (${tableRows.length - 1} data row(s))`);
    }
  } else if (s04) {
    warn('kit-§0.4', '§0.4 present but very short');
  } else {
    fail('kit-§0.4', '§0.4 not found — every consumer spec must show what the design is reacting to');
  }

  // === §8.4 §8 acceptance criteria ===
  const s8 = section(content, '## 8.');
  if (s8) {
    const criteria = s8.match(/\*\*§8\.\d+[a-z]?\*\*/g) || [];
    if (criteria.length >= 5) {
      pass('§8.4a', `§8 has ${criteria.length} numbered criteria`);
    } else {
      fail('§8.4a', `§8 has only ${criteria.length} criteria; minimum is 5`);
    }
  } else {
    fail('§8.4a', '§8 not found');
  }

  // === §8.5 §9 out-of-scope ===
  const s9 = section(content, '## 9.');
  if (s9) {
    const items = s9.split('\n').filter(l => /^\s*[-*]\s+/.test(l));
    if (items.length >= 1) {
      pass('§8.5a', `§9 has ${items.length} out-of-scope item(s)`);
    } else {
      fail('§8.5a', '§9 present but no list items');
    }
  } else {
    fail('§8.5a', '§9 not found');
  }
}

// ============================================================================
// LAYER 2: KIT-INTERNAL CHECKS (§8.13–§8.20)
// ============================================================================

if (runKit) {
  // === §8.13 lib/ patterns ===
  const patternsDir = join(kitRoot, 'lib', 'patterns');
  if (!existsSync(patternsDir)) {
    fail('§8.13a', 'lib/patterns/ directory not found');
  } else {
    const patternFiles = readdirSync(patternsDir).filter(f => f.endsWith('.md'));
    if (patternFiles.length >= 13) {
      pass('§8.13a', `${patternFiles.length} pattern files (≥13 required by SPEC §8.13d)`);
    } else {
      warn('§8.13a', `only ${patternFiles.length} pattern files; SPEC §8.13d requires ≥13`);
    }

    let missingStructure = 0;
    let missingFooter = 0;
    for (const f of patternFiles) {
      const text = readFileSync(join(patternsDir, f), 'utf8');
      // The canonical 4-section structure (D19), but accept variations:
      //   §0 — Why this exists (the rationale)
      //   §1+ — the substance (lessons / tables / recipe / rubric / details)
      //   some §N — anti-patterns / mistakes / gotchas / pitfalls / "what NOT to" / "common mistakes"
      //   some §N — When this changes / upgrade path / cross-references
      // The spirit: why + substance + anti-patterns + when.
      const hasWhy = /##\s+0\.\s+Why this exists/i.test(text);
      // Substance: at least 3 numbered ## N. sections (## 1, ## 2, ## 3+).
      // The exact title doesn't matter — the count does.
      const sectionCount = (text.match(/^##\s+[1-9]\d*\\?\./gm) || []).length;
      const hasSubstance = sectionCount >= 3;
      const hasWhen = /(?:##\s+[2-9]\.[^\n]*(?:When this|upgrade|when NOT|cross-?reference|extension|migration))/i.test(text) ||
                      /##\s+When this/i.test(text);

      if (!hasWhy || !hasSubstance || !hasWhen) {
        missingStructure++;
      }
      const nameWithoutExt = f.replace(/\.md$/, '');
      // Footer is more flexible: accept "End of `<name>` pattern" or "End of `<name>` recipe" etc.
      if (!new RegExp(`End of \`${nameWithoutExt}\``).test(text)) {
        missingFooter++;
      }
    }
    if (missingStructure === 0) {
      pass('§8.13b', `all ${patternFiles.length} patterns have the 4-section structure (D19)`);
    } else {
      fail('§8.13b', `${missingStructure} pattern(s) missing the 4-section structure`);
    }
    if (missingFooter === 0) {
      pass('§8.13c', `all ${patternFiles.length} patterns have the canonical footer`);
    } else {
      fail('§8.13c', `${missingFooter} pattern(s) missing the canonical footer`);
    }
  }

  // === §8.14 lib/ code modules ===
  const libDir = join(kitRoot, 'lib');
  const expectedModules = [
    'no-backend', 'money-as-decimal', 'tenant-rls',
    'audit-viewer', 'docs-guardian', 'pwa-config', 'auth-shell',
  ];
  let missingFiles = 0;
  for (const m of expectedModules) {
    const moduleDir = join(libDir, m);
    if (!existsSync(moduleDir)) {
      missingFiles += 3; // index, README, tests
      continue;
    }
    if (!existsSync(join(moduleDir, 'index.ts'))) missingFiles++;
    if (!existsSync(join(moduleDir, 'README.md'))) missingFiles++;
    const testsDir = join(moduleDir, 'tests');
    if (!existsSync(testsDir) || readdirSync(testsDir).filter(f => f.endsWith('.test.ts')).length === 0) {
      missingFiles++;
    }
  }
  if (missingFiles === 0) {
    pass('§8.14a', `all 7 expected code modules (no-backend, money-as-decimal, tenant-rls, audit-viewer, docs-guardian, pwa-config, auth-shell) have the canonical layout`);
  } else {
    fail('§8.14a', `${missingFiles} missing file(s) across the 7 expected code modules`);
  }

  // === §8.14b scaffolder + CI ===
  if (existsSync(join(kitRoot, 'scripts', 'new-project.mjs'))) {
    pass('§8.14b', 'scripts/new-project.mjs scaffolder present');
  } else {
    fail('§8.14b', 'scripts/new-project.mjs scaffolder missing');
  }
  if (existsSync(join(kitRoot, '.github', 'workflows', 'validate.yml'))) {
    pass('§8.14c', '.github/workflows/validate.yml CI workflow present');
  } else {
    fail('§8.14c', '.github/workflows/validate.yml CI workflow missing');
  }

  // === §8.15 prompts/ ===
  const promptsDir = join(kitRoot, 'prompts');
  const expectedPrompts = [
    'SPEC-AUTHOR.md', 'BUILDER-REVIEW-TEMPLATE.md', 'REVIEWER-REVIEW-TEMPLATE.md',
    'INTERVIEW-CHECKLIST.md', 'SPEC-REVIEWER.md', 'KITTING.md', 'RELEASE-CHECKLIST.md',
    'KITTING-REVIEW.md', 'NEW-PROJECT.md', 'KIT-GROWTH-SESSION.md',
    'PROMOTE-TO-TINS.md', 'CONTINUE-TINS-PROJECT.md',
    'FRONTEND-VISION-INTERVIEW.md', 'FRONTEND-REFRESH.md',
    'DELEGATE-WORK.md', 'INTEGRATE-DELEGATED-WORK.md',
    'PUBLISH-OPEN-SOURCE.md',
    'GENERATE-CURRICULUM.md', 'GENERATE-INTERVIEW-PREP.md',
    'AUTONOMOUS-BUILD.md', 'WORKER-SESSION.md',
    'TOOLING-AUDIT.md', 'STEERING-PROMPTS.md',
    'EXECUTION-MODE-INTERVIEW.md',
  ];
  let missingPrompts = 0;
  for (const p of expectedPrompts) {
    if (!existsSync(join(promptsDir, p))) missingPrompts++;
  }
  if (missingPrompts === 0) {
    pass('§8.15a', `all 24 expected prompts present`);
  } else {
    fail('§8.15a', `${missingPrompts} expected prompt(s) missing`);
  }

  // === §8.16 templates/ ===
  const templatesDir = join(kitRoot, 'templates');
  const expectedTemplates = [
    'SPEC.md', 'HANDOVER.md', 'AGENTS.md', 'TRAININGS.md',
    'BUILDER-DECISIONS-REVIEW.md', 'REVIEWER-DECISIONS-REVIEW.md',
    'zod-schemas/money.zod.ts', 'sql/rls-policies.sql', 'sql/audit-trigger.sql',
    'sql/idempotent-migration-pattern.sql', 'eslint/no-float-money.js', '.gitignore',
    'TASK-BRIEF.md', 'DELEGATION-LEDGER.md', 'DELEGATION-README.md',
    'CURRICULUM-PROGRESS.md',
    'ORCHESTRATION.json', 'ESCALATIONS.md', 'TOOLING-AUDIT.md',
  ];
  let missingTemplates = 0;
  for (const t of expectedTemplates) {
    if (!existsSync(join(templatesDir, t))) missingTemplates++;
  }
  if (missingTemplates === 0) {
    pass('§8.16a', `all 19 expected template files present`);
  } else {
    fail('§8.16a', `${missingTemplates} expected template file(s) missing`);
  }

  // === §8.17 scripts/ ===
  const scriptsDir = join(kitRoot, 'scripts');
  const expectedScripts = [
    'validate.mjs', 'selftest.mjs', 'migration-runner.mjs', 'decision-log.mjs',
    'kit-coverage.mjs', 'kit-listing.mjs', 'kit-new-pattern.mjs',
    'new-project.mjs', 'docs-guardian.mjs', 'kit-extract.mjs', 'kit-sync.mjs',
    'kit-ingest.mjs', 'kit-new-project-shell.mjs', 'kit-staging-export.mjs',
    'check-task-independence.mjs', 'scan-task-packet.mjs',
    'private-to-public.mjs',
    'orchestrate.mjs', 'escalate.mjs', 'tooling-audit.mjs',
  ];
  let missingScripts = 0;
  for (const s of expectedScripts) {
    if (!existsSync(join(scriptsDir, s))) missingScripts++;
  }
  if (missingScripts === 0) {
    pass('§8.17a', `all 20 expected scripts present`);
  } else {
    fail('§8.17a', `${missingScripts} expected script(s) missing`);
  }

  // === §8.23 staging area + portable kit shell + 2 generic prompts ===
  const stagingReadme = join(kitRoot, 'kit-staging', 'README.md');
  if (existsSync(stagingReadme) && readFileSync(stagingReadme, 'utf8').length > 1000) {
    pass('§8.23a', 'kit-staging/README.md present with the 4-thing table');
  } else {
    fail('§8.23a', 'kit-staging/README.md missing or too short');
  }
  if (existsSync(join(kitRoot, 'kit-staging', 'inbox'))) {
    pass('§8.23b', 'kit-staging/inbox/ exists');
  } else {
    fail('§8.23b', 'kit-staging/inbox/ missing');
  }
  if (existsSync(join(kitRoot, 'kit-staging', 'archive'))) {
    pass('§8.23c', 'kit-staging/archive/ exists');
  } else {
    fail('§8.23c', 'kit-staging/archive/ missing');
  }
  for (const p of ['NEW-PROJECT.md', 'KIT-GROWTH-SESSION.md']) {
    const path = join(kitRoot, 'prompts', p);
    if (existsSync(path) && readFileSync(path, 'utf8').length > 1000) {
      pass(`§8.23g/h`, `prompts/${p} present`);
    } else {
      fail(`§8.23g/h`, `prompts/${p} missing or too short`);
    }
  }

  // === §8.24 INDEX + 2 new prompts (added 2026-08-15, session 11) ===
  const indexPath = join(kitRoot, 'INDEX.md');
  if (existsSync(indexPath) && readFileSync(indexPath, 'utf8').length > 1000) {
    pass('§8.24a', 'INDEX.md present at the kit root with the selective-chooser');
  } else {
    fail('§8.24a', 'INDEX.md missing or too short');
  }
  for (const [p, id] of [['PROMOTE-TO-TINS.md', '§8.24b'], ['CONTINUE-TINS-PROJECT.md', '§8.24c']]) {
    const path = join(kitRoot, 'prompts', p);
    if (existsSync(path) && readFileSync(path, 'utf8').length > 1000) {
      pass(id, `prompts/${p} present`);
    } else {
      fail(id, `prompts/${p} missing or too short`);
    }
  }

  // === §8.25 frontend-refresh workflow (added 2026-08-21, session 12) ===
  for (const [p, id] of [['FRONTEND-VISION-INTERVIEW.md', '§8.25a'], ['FRONTEND-REFRESH.md', '§8.25b']]) {
    const path = join(kitRoot, 'prompts', p);
    if (existsSync(path) && readFileSync(path, 'utf8').length > 1000) {
      pass(id, `prompts/${p} present`);
    } else {
      fail(id, `prompts/${p} missing or too short`);
    }
  }
  {
    let wired = 0;
    for (const p of ['SPEC-AUTHOR.md', 'INTERVIEW-CHECKLIST.md']) {
      const path = join(kitRoot, 'prompts', p);
      if (existsSync(path) && readFileSync(path, 'utf8').includes('FRONTEND-VISION-INTERVIEW.md')) wired++;
    }
    if (wired === 2) {
      pass('§8.25c', 'SPEC-AUTHOR.md and INTERVIEW-CHECKLIST.md both trigger FRONTEND-VISION-INTERVIEW.md for website projects');
    } else {
      fail('§8.25c', `only ${wired}/2 of SPEC-AUTHOR.md / INTERVIEW-CHECKLIST.md reference FRONTEND-VISION-INTERVIEW.md`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'CONTINUE-TINS-PROJECT.md');
    if (existsSync(path) && readFileSync(path, 'utf8').includes('FRONTEND-REFRESH.md')) {
      pass('§8.25d', "CONTINUE-TINS-PROJECT.md routes frontend-visual-redesign W's to FRONTEND-REFRESH.md");
    } else {
      fail('§8.25d', 'CONTINUE-TINS-PROJECT.md missing the FRONTEND-REFRESH.md routing line');
    }
  }

  // === §8.26 parallel-work delegation (added 2026-08-21, session 13) ===
  for (const [p, id] of [['DELEGATE-WORK.md', '§8.26a'], ['INTEGRATE-DELEGATED-WORK.md', '§8.26b']]) {
    const path = join(kitRoot, 'prompts', p);
    if (existsSync(path) && readFileSync(path, 'utf8').length > 1000) {
      pass(id, `prompts/${p} present`);
    } else {
      fail(id, `prompts/${p} missing or too short`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'CONTINUE-TINS-PROJECT.md');
    if (existsSync(path) && readFileSync(path, 'utf8').includes('DELEGATE-WORK.md')) {
      pass('§8.26c', "CONTINUE-TINS-PROJECT.md routes parallel-work-split W's to DELEGATE-WORK.md");
    } else {
      fail('§8.26c', 'CONTINUE-TINS-PROJECT.md missing the DELEGATE-WORK.md routing line');
    }
  }
  for (const [s, id] of [['check-task-independence.mjs', '§8.26d'], ['scan-task-packet.mjs', '§8.26e']]) {
    const path = join(kitRoot, 'scripts', s);
    if (existsSync(path) && readFileSync(path, 'utf8').length > 500) {
      pass(id, `scripts/${s} present`);
    } else {
      fail(id, `scripts/${s} missing or too short`);
    }
  }
  {
    const needed = ['TASK-BRIEF.md', 'DELEGATION-LEDGER.md', 'DELEGATION-README.md'];
    const missing = needed.filter((t) => !existsSync(join(kitRoot, 'templates', t)));
    if (missing.length === 0) {
      pass('§8.26f', 'templates/TASK-BRIEF.md, DELEGATION-LEDGER.md, DELEGATION-README.md all present');
    } else {
      fail('§8.26f', `missing template(s): ${missing.join(', ')}`);
    }
  }

  // === §8.27 open-source release packaging (added 2026-08-21, session 14) ===
  {
    const path = join(kitRoot, 'prompts', 'PUBLISH-OPEN-SOURCE.md');
    if (existsSync(path) && readFileSync(path, 'utf8').length > 1000) {
      pass('§8.27a', 'prompts/PUBLISH-OPEN-SOURCE.md present');
    } else {
      fail('§8.27a', 'prompts/PUBLISH-OPEN-SOURCE.md missing or too short');
    }
  }
  {
    let wired = 0;
    for (const p of ['SPEC-AUTHOR.md', 'INTERVIEW-CHECKLIST.md']) {
      const path = join(kitRoot, 'prompts', p);
      if (existsSync(path)) {
        const text = readFileSync(path, 'utf8');
        if (text.includes('Public release intended') && text.includes('PUBLISH-OPEN-SOURCE.md')) wired++;
      }
    }
    if (wired === 2) {
      pass('§8.27b', 'SPEC-AUTHOR.md and INTERVIEW-CHECKLIST.md both record the public-release-intent question and name PUBLISH-OPEN-SOURCE.md as the later trigger');
    } else {
      fail('§8.27b', `only ${wired}/2 of SPEC-AUTHOR.md / INTERVIEW-CHECKLIST.md have the Q8 wiring`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'CONTINUE-TINS-PROJECT.md');
    if (existsSync(path) && readFileSync(path, 'utf8').includes('PUBLISH-OPEN-SOURCE.md')) {
      pass('§8.27c', "CONTINUE-TINS-PROJECT.md routes public-release-packaging W's to PUBLISH-OPEN-SOURCE.md");
    } else {
      fail('§8.27c', 'CONTINUE-TINS-PROJECT.md missing the PUBLISH-OPEN-SOURCE.md routing line');
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'private-to-public.mjs');
    if (existsSync(path) && readFileSync(path, 'utf8').length > 500) {
      pass('§8.27d', 'scripts/private-to-public.mjs present');
    } else {
      fail('§8.27d', 'scripts/private-to-public.mjs missing or too short');
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'private-to-public.mjs');
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      const importsScanTaskPacket = /import[^;\n]*scan-task-packet/.test(text);
      if (!importsScanTaskPacket) {
        pass('§8.27e', 'private-to-public.mjs does not import scan-task-packet.mjs\'s banned-terms list');
      } else {
        fail('§8.27e', 'private-to-public.mjs imports from scan-task-packet.mjs — the two banned-terms lists must stay separate (D30)');
      }
    } else {
      fail('§8.27e', 'scripts/private-to-public.mjs missing, cannot check for a shared import');
    }
  }
  {
    const path = join(kitRoot, 'lib', 'patterns', 'private-to-public.md');
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      const hasCorporateTone = text.includes('corporate');
      const hasDesignWalkthrough = text.includes('DESIGN-WALKTHROUGH.md');
      const hasRubric = text.includes('3.7') || text.toLowerCase().includes('quality rubric');
      const embedsFullScript = text.includes('#!/usr/bin/env node');
      if (hasCorporateTone && hasDesignWalkthrough && hasRubric && !embedsFullScript) {
        pass('§8.27f', 'lib/patterns/private-to-public.md documents the tone requirement, DESIGN-WALKTHROUGH.md, and the quality rubric, and references (not embeds) the real script');
      } else {
        fail('§8.27f', `lib/patterns/private-to-public.md missing required content (corporate tone: ${hasCorporateTone}, DESIGN-WALKTHROUGH.md: ${hasDesignWalkthrough}, rubric: ${hasRubric}, still embeds full script: ${embedsFullScript})`);
      }
    } else {
      fail('§8.27f', 'lib/patterns/private-to-public.md missing');
    }
  }

  // === §8.28 curriculum / interview-prep generation (added 2026-08-21, session 15) ===
  {
    const path = join(kitRoot, 'prompts', 'GENERATE-CURRICULUM.md');
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      const nonTrivial = text.length > 1000;
      const hasChunking = text.includes('ONE FILE PER TURN');
      const hasResumability = text.includes('CURRICULUM-PROGRESS.md');
      const hasLocation = text.includes('curriculum/');
      if (nonTrivial && hasChunking && hasResumability && hasLocation) {
        pass('§8.28a', 'prompts/GENERATE-CURRICULUM.md present and documents one-file-per-turn chunking, CURRICULUM-PROGRESS.md resumability, and the sibling-folder location');
      } else {
        fail('§8.28a', `prompts/GENERATE-CURRICULUM.md missing required content (non-trivial: ${nonTrivial}, chunking: ${hasChunking}, resumability: ${hasResumability}, location: ${hasLocation})`);
      }
    } else {
      fail('§8.28a', 'prompts/GENERATE-CURRICULUM.md missing');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'GENERATE-INTERVIEW-PREP.md');
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      const nonTrivial = text.length > 1000;
      const hasFrontierRec = /frontier model/i.test(text) && /extended\/max thinking/i.test(text);
      if (nonTrivial && hasFrontierRec) {
        pass('§8.28b', 'prompts/GENERATE-INTERVIEW-PREP.md present and explicitly recommends a frontier model at extended/max thinking');
      } else {
        fail('§8.28b', `prompts/GENERATE-INTERVIEW-PREP.md missing required content (non-trivial: ${nonTrivial}, frontier-model recommendation: ${hasFrontierRec})`);
      }
    } else {
      fail('§8.28b', 'prompts/GENERATE-INTERVIEW-PREP.md missing');
    }
  }
  {
    let wired = 0;
    for (const p of ['GENERATE-CURRICULUM.md', 'GENERATE-INTERVIEW-PREP.md']) {
      const path = join(kitRoot, 'prompts', p);
      if (existsSync(path) && readFileSync(path, 'utf8').includes('private-to-public.mjs')) wired++;
    }
    if (wired === 2) {
      pass('§8.28c', 'GENERATE-CURRICULUM.md and GENERATE-INTERVIEW-PREP.md both reuse scripts/private-to-public.mjs as their safety gate (no new scanner/list)');
    } else {
      fail('§8.28c', `only ${wired}/2 of GENERATE-CURRICULUM.md / GENERATE-INTERVIEW-PREP.md reference private-to-public.mjs`);
    }
  }
  {
    const path = join(kitRoot, 'templates', 'CURRICULUM-PROGRESS.md');
    if (existsSync(path) && readFileSync(path, 'utf8').length > 200) {
      pass('§8.28d', 'templates/CURRICULUM-PROGRESS.md present');
    } else {
      fail('§8.28d', 'templates/CURRICULUM-PROGRESS.md missing or too short');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'CONTINUE-TINS-PROJECT.md');
    if (existsSync(path) && readFileSync(path, 'utf8').includes('GENERATE-CURRICULUM.md')) {
      pass('§8.28e', "CONTINUE-TINS-PROJECT.md routes teaching-material W's to GENERATE-CURRICULUM.md");
    } else {
      fail('§8.28e', 'CONTINUE-TINS-PROJECT.md missing the GENERATE-CURRICULUM.md routing line');
    }
  }

  // === §8.29 autonomous orchestration — auditor + workers (added 2026-08-26, session 16) ===
  {
    const path = join(kitRoot, 'prompts', 'AUTONOMOUS-BUILD.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const nonTrivial = t.length > 4000;
      const hasSplit = /auditor/i.test(t) && /worker/i.test(t);
      const hasStateMachine = /delegation\/LEDGER\.md/.test(t) && /state machine/i.test(t);
      const hasNoCodeRule = /do not write product code|never writes product code|You do not write product code/i.test(t);
      if (nonTrivial && hasSplit && hasStateMachine && hasNoCodeRule) {
        pass('§8.29a', 'prompts/AUTONOMOUS-BUILD.md documents the auditor/worker split, names LEDGER.md as the state machine, and bars the auditor from writing product code');
      } else {
        fail('§8.29a', `prompts/AUTONOMOUS-BUILD.md missing required content (non-trivial: ${nonTrivial}, auditor/worker split: ${hasSplit}, state machine: ${hasStateMachine}, no-product-code rule: ${hasNoCodeRule})`);
      }
    } else {
      fail('§8.29a', 'prompts/AUTONOMOUS-BUILD.md missing');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'WORKER-SESSION.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const nonTrivial = t.length > 3000;
      const hasEscalation = /escalate\.mjs/.test(t) && /T2/.test(t);
      const hasReturn = /status\.md/.test(t) && /NOTES\.md/.test(t);
      if (nonTrivial && hasEscalation && hasReturn) {
        pass('§8.29b', "prompts/WORKER-SESSION.md documents the worker's escalation duty and return protocol");
      } else {
        fail('§8.29b', `prompts/WORKER-SESSION.md missing required content (non-trivial: ${nonTrivial}, escalation duty: ${hasEscalation}, return protocol: ${hasReturn})`);
      }
    } else {
      fail('§8.29b', 'prompts/WORKER-SESSION.md missing');
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'orchestrate.mjs');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const hasDryRun = /--dry-run/.test(t);
      const hasParkedCode = /Exit 3|exit 3/.test(t) && /PARKED|parked/.test(t);
      if (hasDryRun && hasParkedCode) {
        pass('§8.29c', 'scripts/orchestrate.mjs supports --dry-run and documents the parked-run exit code 3');
      } else {
        fail('§8.29c', `scripts/orchestrate.mjs missing required behaviour (--dry-run: ${hasDryRun}, exit-3 parked: ${hasParkedCode})`);
      }
    } else {
      fail('§8.29c', 'scripts/orchestrate.mjs missing');
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'escalate.mjs');
    if (existsSync(path) && readFileSync(path, 'utf8').length > 2000) {
      pass('§8.29d', 'scripts/escalate.mjs present');
    } else {
      fail('§8.29d', 'scripts/escalate.mjs missing or too short');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'AUTONOMOUS-BUILD.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const reusesCheck = /check-task-independence\.mjs/.test(t);
    const reusesIntegrate = /INTEGRATE-DELEGATED-WORK\.md/.test(t);
    if (reusesCheck && reusesIntegrate) {
      pass('§8.29e', "AUTONOMOUS-BUILD.md drives D29's pipeline (independence check + integration prompt) rather than replacing it");
    } else {
      fail('§8.29e', `AUTONOMOUS-BUILD.md must reuse D29 (check-task-independence.mjs: ${reusesCheck}, INTEGRATE-DELEGATED-WORK.md: ${reusesIntegrate})`);
    }
  }
  {
    const path = join(kitRoot, 'lib', 'patterns', 'tiered-escalation.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const tiers = ['T0', 'T1', 'T2'].filter((x) => new RegExp(`\\b${x}\\b`).test(t));
      if (tiers.length === 3) {
        pass('§8.29f', 'lib/patterns/tiered-escalation.md names all three tiers (T0/T1/T2)');
      } else {
        fail('§8.29f', `lib/patterns/tiered-escalation.md names only ${tiers.join(', ') || 'no'} tier(s)`);
      }
    } else {
      fail('§8.29f', 'lib/patterns/tiered-escalation.md missing');
    }
  }
  {
    const missing = ['ORCHESTRATION.json', 'ESCALATIONS.md']
      .filter((f) => !existsSync(join(kitRoot, 'templates', f)));
    if (missing.length === 0) {
      pass('§8.29g', 'templates/ORCHESTRATION.json and templates/ESCALATIONS.md present');
    } else {
      fail('§8.29g', `missing template(s): ${missing.join(', ')}`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'CONTINUE-TINS-PROJECT.md');
    if (existsSync(path) && readFileSync(path, 'utf8').includes('AUTONOMOUS-BUILD.md')) {
      pass('§8.29h', "CONTINUE-TINS-PROJECT.md routes autonomous-build W's to AUTONOMOUS-BUILD.md");
    } else {
      fail('§8.29h', 'CONTINUE-TINS-PROJECT.md missing the AUTONOMOUS-BUILD.md routing line');
    }
  }

  // === §8.30 tooling discovery + security audit (added 2026-08-26, session 16) ===
  {
    const path = join(kitRoot, 'prompts', 'TOOLING-AUDIT.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const nonTrivial = t.length > 3000;
      const verdicts = ['SAFE', 'REVIEW-REQUIRED', 'UNSAFE'].every((v) => t.includes(v));
      const uncertaintyRule = /[Uu]ncertainty resolves to REVIEW-REQUIRED, never SAFE/.test(t);
      if (nonTrivial && verdicts && uncertaintyRule) {
        pass('§8.30a', 'prompts/TOOLING-AUDIT.md names all 3 verdicts and resolves uncertainty to REVIEW-REQUIRED');
      } else {
        fail('§8.30a', `prompts/TOOLING-AUDIT.md missing required content (non-trivial: ${nonTrivial}, 3 verdicts: ${verdicts}, uncertainty rule: ${uncertaintyRule})`);
      }
    } else {
      fail('§8.30a', 'prompts/TOOLING-AUDIT.md missing');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'TOOLING-AUDIT.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const neverInstalls = /never installs anything/i.test(t);
    const neverExecutes = /never executes? a candidate/i.test(t);
    if (neverInstalls && neverExecutes) {
      pass('§8.30b', 'prompts/TOOLING-AUDIT.md states the kit never installs and never executes a candidate');
    } else {
      fail('§8.30b', `prompts/TOOLING-AUDIT.md missing a hard rule (never installs: ${neverInstalls}, never executes: ${neverExecutes})`);
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'tooling-audit.mjs');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const blocking = /blocking/i.test(t);
      const exitCodes = /Exit 0/.test(t) && /Exit 1/.test(t) && /Exit 2/.test(t);
      if (blocking && exitCodes) {
        pass('§8.30c', 'scripts/tooling-audit.mjs documents its blocking behaviour and exit codes');
      } else {
        fail('§8.30c', `scripts/tooling-audit.mjs missing documentation (blocking: ${blocking}, exit codes: ${exitCodes})`);
      }
    } else {
      fail('§8.30c', 'scripts/tooling-audit.mjs missing');
    }
  }
  {
    const path = join(kitRoot, 'templates', 'TOOLING-AUDIT.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const cols = /Verdict/i.test(t) && /Priority/i.test(t) && /Status/i.test(t);
      const auditStatus = /\*\*Audit status:\*\*/.test(t);
      if (cols && auditStatus) {
        pass('§8.30d', 'templates/TOOLING-AUDIT.md carries the verdict/priority/status columns and the audit-status line');
      } else {
        fail('§8.30d', `templates/TOOLING-AUDIT.md missing required structure (columns: ${cols}, audit-status line: ${auditStatus})`);
      }
    } else {
      fail('§8.30d', 'templates/TOOLING-AUDIT.md missing');
    }
  }
  {
    const path = join(kitRoot, 'lib', 'patterns', 'third-party-tool-audit.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const flags = [
        /prompt injection|[Ii]nstruction override/,
        /[Cc]redential/,
        /egress/i,
        /[Oo]bfuscat/,
        /postinstall/i,
        /[Dd]estructive/,
        /permission/i,
        /publisher/i,
        /[Aa]bandon/,
      ].filter((re) => re.test(t)).length;
      if (flags === 9) {
        pass('§8.30e', 'lib/patterns/third-party-tool-audit.md lists all 9 red flags');
      } else {
        fail('§8.30e', `lib/patterns/third-party-tool-audit.md lists only ${flags}/9 red flags`);
      }
    } else {
      fail('§8.30e', 'lib/patterns/third-party-tool-audit.md missing');
    }
  }
  {
    const wired = ['NEW-PROJECT.md', 'CONTINUE-TINS-PROJECT.md'].filter((f) => {
      const path = join(kitRoot, 'prompts', f);
      if (!existsSync(path)) return false;
      const t = readFileSync(path, 'utf8');
      return /tooling-audit\.mjs/.test(t) && /blocking/i.test(t);
    }).length;
    if (wired === 2) {
      pass('§8.30f', 'NEW-PROJECT.md and CONTINUE-TINS-PROJECT.md both run tooling-audit.mjs as a blocking gate before work starts');
    } else {
      fail('§8.30f', `only ${wired}/2 of NEW-PROJECT.md / CONTINUE-TINS-PROJECT.md run the tooling gate`);
    }
  }

  // === §8.31 adaptive inline steering prompts (added 2026-08-26, session 16) ===
  {
    const path = join(kitRoot, 'prompts', 'STEERING-PROMPTS.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const nonTrivial = t.length > 3000;
      const adaptive = /adaptation rule/i.test(t) && /Generic cards are worse than no cards|generic card/i.test(t);
      const checkpoints = /When to emit/i.test(t) && /[Cc]heckpoint/.test(t);
      if (nonTrivial && adaptive && checkpoints) {
        pass('§8.31a', 'prompts/STEERING-PROMPTS.md documents the adaptive-selection rule and the emission checkpoints');
      } else {
        fail('§8.31a', `prompts/STEERING-PROMPTS.md missing required content (non-trivial: ${nonTrivial}, adaptation rule: ${adaptive}, checkpoints: ${checkpoints})`);
      }
    } else {
      fail('§8.31a', 'prompts/STEERING-PROMPTS.md missing');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'STEERING-PROMPTS.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const classes = [
      /[Ss]elf-correction/,
      /[Ss]tale recall/,
      /[Ss]cope creep/,
      /[Ss]pec bypass/,
      /[Uu]nearned confidence/,
      /[Ss]ilent assumption/,
      /[Gg]ate avoidance/,
    ].filter((re) => re.test(t)).length;
    if (classes === 7) {
      pass('§8.31b', 'prompts/STEERING-PROMPTS.md covers all 7 drift classes, self-correction included');
    } else {
      fail('§8.31b', `prompts/STEERING-PROMPTS.md covers only ${classes}/7 drift classes`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'STEERING-PROMPTS.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const offered = /offered, never auto-executed/i.test(t);
    const noRaw = /Don't emit a raw card|never emit the raw shape/i.test(t);
    if (offered && noRaw) {
      pass('§8.31c', 'prompts/STEERING-PROMPTS.md states cards are offered not auto-executed, and bans generic un-adapted cards');
    } else {
      fail('§8.31c', `prompts/STEERING-PROMPTS.md missing a hard rule (offered-not-executed: ${offered}, no-raw-cards: ${noRaw})`);
    }
  }
  {
    const wired = ['NEW-PROJECT.md', 'CONTINUE-TINS-PROJECT.md'].filter((f) => {
      const path = join(kitRoot, 'prompts', f);
      return existsSync(path) && readFileSync(path, 'utf8').includes('STEERING-PROMPTS.md');
    }).length;
    if (wired === 2) {
      pass('§8.31d', 'NEW-PROJECT.md and CONTINUE-TINS-PROJECT.md both wire in the steering-prompt catalogue');
    } else {
      fail('§8.31d', `only ${wired}/2 of NEW-PROJECT.md / CONTINUE-TINS-PROJECT.md reference STEERING-PROMPTS.md`);
    }
  }

  // === §8.32 execution-mode selection (added 2026-08-26, session 17) ===
  const EXEC_MODES = ['solo', 'auditor-local', 'auditor-remote', 'self-parallel', 'external', 'hybrid'];
  {
    const path = join(kitRoot, 'prompts', 'EXECUTION-MODE-INTERVIEW.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const nonTrivial = t.length > 4000;
      const missing = EXEC_MODES.filter((m) => !t.includes(m));
      if (nonTrivial && missing.length === 0) {
        pass('§8.32a', 'prompts/EXECUTION-MODE-INTERVIEW.md present and names all 6 execution modes');
      } else {
        fail('§8.32a', `prompts/EXECUTION-MODE-INTERVIEW.md incomplete (non-trivial: ${nonTrivial}, missing modes: ${missing.join(', ') || 'none'})`);
      }
    } else {
      fail('§8.32a', 'prompts/EXECUTION-MODE-INTERVIEW.md missing');
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'EXECUTION-MODE-INTERVIEW.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const perRound = /per round, not per project|[Aa]sk per round/.test(t);
    const prefilled = /pre-fill|previous round/i.test(t);
    if (perRound && prefilled) {
      pass('§8.32b', "EXECUTION-MODE-INTERVIEW.md asks per round, pre-filled with the previous round's answer");
    } else {
      fail('§8.32b', `EXECUTION-MODE-INTERVIEW.md missing the cadence rule (per-round: ${perRound}, pre-filled: ${prefilled})`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'EXECUTION-MODE-INTERVIEW.md');
    const t = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (/who orchestrates/i.test(t)) {
      pass('§8.32c', 'EXECUTION-MODE-INTERVIEW.md distinguishes auditor-remote from self-parallel by who orchestrates');
    } else {
      fail('§8.32c', 'EXECUTION-MODE-INTERVIEW.md must state that auditor-remote vs self-parallel is about who orchestrates');
    }
  }
  {
    const path = join(kitRoot, 'scripts', 'orchestrate.mjs');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const readsMode = /Execution mode for this round/.test(t);
      const hasDispatchSet = /DISPATCHABLE_MODES/.test(t);
      const refuses = /you drive it, not this runner/.test(t);
      const legacy = /self-parallel'; \/\/ legacy|legacy D29 ledgers/.test(t);
      if (readsMode && hasDispatchSet && refuses && legacy) {
        pass('§8.32d', 'orchestrate.mjs reads the round mode, refuses user-driven and external rounds, and reads legacy `self` as self-parallel');
      } else {
        fail('§8.32d', `orchestrate.mjs mode handling incomplete (reads header: ${readsMode}, dispatch set: ${hasDispatchSet}, refusal: ${refuses}, legacy compat: ${legacy})`);
      }
    } else {
      fail('§8.32d', 'scripts/orchestrate.mjs missing');
    }
  }
  {
    const triggers = ['CONTINUE-TINS-PROJECT.md', 'SPEC-AUTHOR.md', 'NEW-PROJECT.md', 'AUTONOMOUS-BUILD.md'];
    const wired = triggers.filter((f) => {
      const path = join(kitRoot, 'prompts', f);
      return existsSync(path) && readFileSync(path, 'utf8').includes('EXECUTION-MODE-INTERVIEW.md');
    });
    if (wired.length === triggers.length) {
      pass('§8.32e', 'all 4 trigger points reference EXECUTION-MODE-INTERVIEW.md');
    } else {
      fail('§8.32e', `only ${wired.length}/4 trigger points wired (missing: ${triggers.filter((t) => !wired.includes(t)).join(', ')})`);
    }
  }
  {
    const path = join(kitRoot, 'prompts', 'DELEGATE-WORK.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const readsMode = /Execution mode for this round/.test(t);
      const stoppedAsking = /Do not ask the self-vs-external question here/.test(t);
      if (readsMode && stoppedAsking) {
        pass('§8.32f', 'DELEGATE-WORK.md reads the recorded mode instead of asking its own self-vs-external question');
      } else {
        fail('§8.32f', `DELEGATE-WORK.md still owns the mode question (reads header: ${readsMode}, stopped asking: ${stoppedAsking})`);
      }
    } else {
      fail('§8.32f', 'prompts/DELEGATE-WORK.md missing');
    }
  }
  {
    const path = join(kitRoot, 'templates', 'DELEGATION-LEDGER.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const hasHeader = /\*\*Execution mode for this round:\*\*/.test(t);
      const missing = EXEC_MODES.filter((m) => !t.includes(m));
      if (hasHeader && missing.length === 0) {
        pass('§8.32g', 'templates/DELEGATION-LEDGER.md carries the execution-mode header and the full task-mode vocabulary');
      } else {
        fail('§8.32g', `templates/DELEGATION-LEDGER.md incomplete (header: ${hasHeader}, missing modes: ${missing.join(', ') || 'none'})`);
      }
    } else {
      fail('§8.32g', 'templates/DELEGATION-LEDGER.md missing');
    }
  }
  {
    const path = join(kitRoot, 'templates', 'ORCHESTRATION.json');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      let parsed = null;
      try { parsed = JSON.parse(t); } catch { /* reported below */ }
      const presets = parsed && parsed._workerCmdPresets;
      const dated = presets && typeof presets._note === 'string' && /\d{4}-\d{2}-\d{2}/.test(presets._note);
      const count = presets ? Object.keys(presets).filter((k) => !k.startsWith('_')).length : 0;
      if (parsed && dated && count >= 2) {
        pass('§8.32h', `templates/ORCHESTRATION.json ships ${count} dated worker-command presets`);
      } else {
        fail('§8.32h', `templates/ORCHESTRATION.json presets incomplete (valid JSON: ${!!parsed}, dated note: ${!!dated}, presets: ${count})`);
      }
    } else {
      fail('§8.32h', 'templates/ORCHESTRATION.json missing');
    }
  }

  // === §8.33 worked examples (added 2026-08-26, session 18) ===
  const exDir = join(kitRoot, 'examples', 'autonomous-todo-app');
  {
    const need = ['README.md', 'TRANSCRIPT.md', 'RUN-DIGEST.md'];
    const missing = need.filter((f) => !existsSync(join(exDir, f)));
    if (missing.length === 0) {
      pass('§8.33a', 'examples/autonomous-todo-app/ has README.md, TRANSCRIPT.md and RUN-DIGEST.md');
    } else {
      fail('§8.33a', `example missing: ${missing.join(', ')}`);
    }
  }
  {
    const need = [
      join('delegation', 'LEDGER.md'),
      join('delegation', 'ESCALATIONS.md'),
      join('delegation', 'tasks', 'T1', 'NOTES.md'),
    ];
    const missing = need.filter((f) => !existsSync(join(exDir, f)));
    if (missing.length === 0) {
      pass('§8.33b', "the example preserves the run's real state files and worker decision logs");
    } else {
      fail('§8.33b', `example missing run state: ${missing.join(', ')}`);
    }
  }
  {
    // An example that only shows the happy path teaches a workflow nobody will
    // recognise when they run it (D36). The README must name what broke.
    const path = join(exDir, 'README.md');
    if (existsSync(path)) {
      const t = readFileSync(path, 'utf8');
      const ownsFailures = /What went wrong/i.test(t);
      const namesKitDefects = /defects in the kit/i.test(t);
      if (ownsFailures && namesKitDefects) {
        pass('§8.33c', "the example's README documents the kit defects the run exposed, not just its successes");
      } else {
        fail('§8.33c', `example README hides its failures (what-went-wrong section: ${ownsFailures}, names kit defects: ${namesKitDefects})`);
      }
    } else {
      fail('§8.33c', 'examples/autonomous-todo-app/README.md missing');
    }
  }
  {
    const need = ['index.html', join('src', 'store.js'), join('tests', 'store.test.mjs')];
    const missing = need.filter((f) => !existsSync(join(exDir, f)));
    if (missing.length === 0) {
      pass('§8.33d', 'the example ships the finished artefact the run produced');
    } else {
      fail('§8.33d', `example missing produced artefact: ${missing.join(', ')}`);
    }
  }
  {
    // D36 says examples are never vendored into consumers. That has to be true
    // in the code, not only in the decision — otherwise every consumer inherits
    // ~440 KB of transcript it will never read.
    const path = join(kitRoot, 'scripts', 'kit-sync.mjs');
    if (existsSync(path) && /f === 'examples'/.test(readFileSync(path, 'utf8'))) {
      pass('§8.33e', 'kit-sync.mjs excludes examples/ from consumer syncs');
    } else {
      fail('§8.33e', 'kit-sync.mjs would vendor examples/ into every consumer, contradicting D36');
    }
  }

  // === §8.22 methodology + version control + sync ===
  const pipelinePath = join(kitRoot, 'PIPELINE.md');
  if (existsSync(pipelinePath) && readFileSync(pipelinePath, 'utf8').length > 1000) {
    pass('§8.22a', 'PIPELINE.md present at the kit root with the 7-step methodology');
  } else {
    fail('§8.22a', 'PIPELINE.md missing or too short');
  }
  const versioningPath = join(kitRoot, 'VERSIONING.md');
  if (existsSync(versioningPath) && readFileSync(versioningPath, 'utf8').length > 1000) {
    pass('§8.22b', 'VERSIONING.md present at the kit root');
  } else {
    fail('§8.22b', 'VERSIONING.md missing or too short');
  }

  // === §8.18 schemas/ ===
  const schemasDir = join(kitRoot, 'schemas');
  const expectedSchemas = [
    'tins-markers.schema.json', 'locked-decisions.schema.json',
    'handover.schema.json', 'tins-spec-minimal.schema.json',
  ];
  let missingSchemas = 0;
  for (const s of expectedSchemas) {
    const p = join(schemasDir, s);
    if (!existsSync(p)) { missingSchemas++; continue; }
    try {
      const json = JSON.parse(readFileSync(p, 'utf8'));
      if (!json.$schema || !json.title) missingSchemas++;
    } catch {
      missingSchemas++;
    }
  }
  if (missingSchemas === 0) {
    pass('§8.18a', `all 4 expected JSON Schemas present and valid`);
  } else {
    fail('§8.18a', `${missingSchemas} expected schema(s) missing or invalid`);
  }

  // === §8.19 docs/ ===
  const docsDir = join(kitRoot, 'docs');
  const expectedDocs = ['WORKFLOW.md', 'LIBRARY-CONVENTIONS.md', 'KITTING.md', 'GAP-ANALYSIS.md'];
  let missingDocs = 0;
  for (const d of expectedDocs) {
    if (!existsSync(join(docsDir, d))) missingDocs++;
  }
  if (missingDocs === 0) {
    pass('§8.19a', `all 4 expected docs present`);
  } else {
    fail('§8.19a', `${missingDocs} expected doc(s) missing`);
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

const order = [
  '§8.1a', '§8.1b', '§8.1c',
  '§8.2a', '§8.2b', '§8.2c',
  '§8.3a',
  'kit-§0.4',
  '§8.4a',
  '§8.5a',
  '§8.13a', '§8.13b', '§8.13c',
  '§8.14a', '§8.14b', '§8.14c',
  '§8.15a',
  '§8.16a',
  '§8.17a',
  '§8.18a',
  '§8.19a',
  '§8.22a',
  '§8.22b',
  '§8.23a',
  '§8.23b',
  '§8.23c',
  '§8.23g/h',
  '§8.24a',
  '§8.24b',
  '§8.24c',
  '§8.25a',
  '§8.25b',
  '§8.25c',
  '§8.25d',
  '§8.26a',
  '§8.26b',
  '§8.26c',
  '§8.26d',
  '§8.26e',
  '§8.26f',
  '§8.27a',
  '§8.27b',
  '§8.27c',
  '§8.27d',
  '§8.27e',
  '§8.27f',
  '§8.28a',
  '§8.28b',
  '§8.28c',
  '§8.28d',
  '§8.28e',
  '§8.29a', '§8.29b', '§8.29c', '§8.29d', '§8.29e', '§8.29f', '§8.29g', '§8.29h',
  '§8.30a', '§8.30b', '§8.30c', '§8.30d', '§8.30e', '§8.30f',
  '§8.31a', '§8.31b', '§8.31c', '§8.31d',
  '§8.32a', '§8.32b', '§8.32c', '§8.32d', '§8.32e', '§8.32f', '§8.32g', '§8.32h',
  '§8.33a', '§8.33b', '§8.33c', '§8.33d', '§8.33e',
];

const sorted = order.map(id => checks.find(c => c.id === id)).filter(Boolean);
for (const c of checks) {
  if (!sorted.includes(c)) sorted.push(c);
}

const width = Math.max(...sorted.map(c => c.id.length));
let hasFail = false;
let passCount = 0;
let warnCount = 0;
let failCount = 0;

console.log('');
if (specPath) {
  console.log(`Validating: ${specPath}`);
} else {
  console.log(`Validating: tins-kit (kit inventory)`);
}
console.log('');

for (const c of sorted) {
  const icon = c.status === 'pass' ? '\u2713' : c.status === 'warn' ? '!' : 'X';
  console.log(`  ${icon} ${c.id.padEnd(width)}  ${c.message || ''}`);
  if (c.status === 'pass') passCount++;
  else if (c.status === 'warn') warnCount++;
  else { failCount++; hasFail = true; }
}

console.log('');
console.log(`  ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
console.log('');

if (hasFail) {
  console.log('  Result: FAIL');
  console.log('');
  process.exit(1);
} else if (warnCount > 0) {
  console.log('  Result: PASS (with warnings)');
  console.log('');
  process.exit(0);
} else {
  console.log('  Result: PASS');
  console.log('');
  process.exit(0);
}
