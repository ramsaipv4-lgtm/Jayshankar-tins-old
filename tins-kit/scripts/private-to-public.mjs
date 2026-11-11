#!/usr/bin/env node
// scripts/private-to-public.mjs
//
// Produces a public-ready sibling copy of a private TINS workspace, then
// scans the ENTIRE copied tree — every file, including in-line code
// comments, not just a handful of known files — for two kinds of leak
// before declaring the copy safe to publish (D30):
//   1. Methodology fingerprints — kit file names, kit-specific terms,
//      phrases that would tell a reader "this was built with a
//      proprietary spec-first LLM methodology," even if they couldn't
//      fully reconstruct it from that alone.
//   2. LLM/AI-authorship fingerprints — mentions of the model or vendor
//      that generated the code, assistant-speak left over in comments or
//      docs ("as an AI...", "I've added...", "Certainly!"), or anything
//      else that reads as "a chatbot wrote this" rather than "a team
//      wrote this." The target audience explicitly wants documentation
//      that reads as corporate-authored, with no LLM fingerprints — see
//      `lib/patterns/private-to-public.md` §3 for the tone requirement.
//
// This is defense-in-depth, not the primary defense. The primary defense
// is deciding, file by file, what belongs in the public copy, and writing
// the public-facing docs (README, docs/ARCHITECTURE.md, docs/DECISIONS.md,
// docs/DESIGN-WALKTHROUGH.md) with real editorial care. A clean scan does
// not certify the release is safe; it's the last mechanical check before
// the sibling folder gets `git init`'d, not a substitute for reading it
// yourself.
//
// Separate, broader banned-terms list from scripts/scan-task-packet.mjs
// (D29). The two scanners solve different problems — a task packet handed
// to one external contributor for one scoped job, versus a whole project
// released to the public under open-ended scrutiny — and the kit keeps
// their lists independent on purpose (D30) so tightening one never
// silently loosens the other. Revisit merging them only if real drift
// between the two becomes a maintenance burden.
//
// Usage:
//   node tins-kit/scripts/private-to-public.mjs <src-dir> <dst-dir> [options]
//   node tins-kit/scripts/private-to-public.mjs ../myapp ../myapp-public
//   node tins-kit/scripts/private-to-public.mjs ../myapp ../myapp-public --name="Acme Inventory"
//   node tins-kit/scripts/private-to-public.mjs ../myapp-public --scan-only
//   node tins-kit/scripts/private-to-public.mjs ../myapp ../myapp-public --json
//
// Options:
//   --name=<Project Name>   Used in the marker-line rewrite. Defaults to
//                            the destination folder's basename.
//   --scan-only              Skip the copy step; scan an already-produced
//                            destination folder (e.g. after hand-editing
//                            it, or after re-running with fixes upstream).
//                            Only the destination-dir argument is used.
//   --json                   Emit machine-readable findings instead of
//                            the human-readable report.
//
// Exit 0: copy complete (unless --scan-only) and the destination tree is
//         clean. Safe to `git init` and publish.
// Exit 1: one or more leaks found. The destination tree is NOT safe to
//         publish yet — fix the SOURCE file(s) (or extend the include /
//         exclude filters, or the banned-terms list, if a match is a
//         genuine false positive) and re-run.
// Exit 2: bad usage, or a given path isn't a directory.
//
// Zero-dep Node ESM (D3).

import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync,
  existsSync, statSync,
} from 'node:fs';
import { join, dirname, relative, resolve, basename, extname } from 'node:path';
import process from 'node:process';

// --- Argument parsing -------------------------------------------------
const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter((a) => a.startsWith('--'));
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const jsonOut = flags.includes('--json');
const scanOnly = flags.includes('--scan-only');
const nameFlag = flags.find((f) => f.startsWith('--name='));
const projectNameArg = nameFlag ? nameFlag.slice('--name='.length) : null;

let SRC = null;
let DST = null;
if (scanOnly) {
  DST = positional[0];
  if (!DST) {
    console.error('Usage: private-to-public.mjs <dst-dir> --scan-only [--json]');
    process.exit(2);
  }
} else {
  SRC = positional[0];
  DST = positional[1];
  if (!SRC || !DST) {
    console.error('Usage: private-to-public.mjs <src-dir> <dst-dir> [--name=<Project Name>] [--json]');
    console.error('       private-to-public.mjs <dst-dir> --scan-only [--json]');
    process.exit(2);
  }
}

if (SRC && (!existsSync(SRC) || !statSync(SRC).isDirectory())) {
  console.error(`ERROR: source is not a directory: ${SRC}`);
  process.exit(2);
}
if (scanOnly && (!existsSync(DST) || !statSync(DST).isDirectory())) {
  console.error(`ERROR: destination is not a directory: ${DST}`);
  process.exit(2);
}

const PROJECT_NAME = projectNameArg || basename(resolve(DST)).replace(/-public$/, '');

// --- What copies, what stays private -----------------------------------
// Mirrors lib/patterns/private-to-public.md §2 Step 2. Extend both lists
// together when the consumer's project grows a new artefact type.
const INCLUDE_PATTERNS = [
  'src/**', 'public/**', 'supabase/migrations/**', 'supabase/rls-policies.sql',
  'supabase/seed.sql', 'supabase/functions/**', 'scripts/*.mjs', 'scripts/.env.example',
  'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.node.json',
  'tailwind.config.ts', 'postcss.config.js', 'netlify.toml', 'capacitor.config.ts', 'index.html',
  '.env.example', 'docs/**', 'LICENSE', 'LICENSE.md',
];
// supabase/functions/** and capacitor.config.ts added live regenerating Jayshankar-clean — the
// original include list predates both artefact types existing in this project (Edge Functions,
// Capacitor). Exactly the "consumer adds a new artefact type" case this pattern doc's own
// "When this changes" section already anticipated — belongs in the kit, not a one-off patch.
// NOT included: README.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md,
// docs/SCHEMA.md, docs/DESIGN-WALKTHROUGH.md. Per §3 of the pattern, these
// are written FRESH for the public folder, in a corporate voice, not
// copied from the private working copy — a private README often has
// methodology asides that don't belong in front of a public reader, and
// copying it verbatim would defeat that requirement silently.
//
// The docs/*.md ones are excluded explicitly, not just "never in INCLUDE_PATTERNS" like
// README/CONTRIBUTING (root) are — found live regenerating Jayshankar-clean, the hard way: this
// project's real CONTRIBUTING.md/ARCHITECTURE.md/DECISIONS.md/SCHEMA.md live INSIDE docs/, which
// IS in INCLUDE_PATTERNS ('docs/**'), so the wildcard was silently re-copying the private repo's
// own stale versions of these files over hand-authored destination versions on every re-run —
// clobbering real, uncommitted rewrite work in the process. 'docs/**' means "the public-facing
// subset" (the pattern's own §2 step 2 wording), never a blind copy of the whole folder — these
// five names are the specific case where that distinction actually bites.
//
// .gitignore is ALSO not copied, for the same reason, found live regenerating
// Jayshankar-clean: a private repo's real .gitignore explains, in prose, WHY specific
// methodology files (SPEC.md etc.) are deliberately NOT ignored there ("the spec IS the
// versioned artefact") — reasoning that only makes sense in the private repo and would
// itself be a methodology leak if copied verbatim. It's written directly in the
// destination instead (writeDefaultGitignore below), matching pattern §2 Step 7 — and
// like README/CONTRIBUTING, only if the destination doesn't already have one, so a
// hand-tuned public .gitignore survives being regenerated on a later run rather than
// getting silently clobbered back to a copy of the private one.

const EXCLUDE_PATTERNS = [
  'node_modules/**', 'dist/**', 'dev-dist/**', '.env', '.env.*',
  'AGENTS.md', 'HANDOVER.md', 'BUILDER-DECISIONS-REVIEW.md',
  'REVIEWER-DECISIONS-REVIEW.md', 'SPEC.md', 'PIPELINE.md', 'INDEX.md',
  'VERSIONING.md', 'context.md',
  'archive/**', 'tins-kit/**', 'kit-staging/**', 'delegation/**', '*.zip', '*.svg',
  'scripts/.env', 'scripts/probe-db.mjs',
  // "Authored fresh in the destination" docs (same category as root README/CONTRIBUTING, see
  // the note above INCLUDE_PATTERNS) that happen to live under docs/, which 'docs/**' would
  // otherwise blindly re-copy from the private repo's own (often stale) versions every run.
  'docs/ARCHITECTURE.md', 'docs/DECISIONS.md', 'docs/SCHEMA.md', 'docs/CONTRIBUTING.md',
  'docs/DESIGN-WALKTHROUGH.md',
  // validate.mjs / selftest.mjs are the kit's OWN structural gate — they check
  // conformance against SPEC.md and reference kit-internal conventions by design.
  // A public reader has no SPEC.md to check against, so these two are irreducibly
  // methodology-coupled (not a project-specific oversight to fix at the source) and
  // excluded here by name, unlike the project's own domain-level scripts/*.mjs
  // (found live while regenerating Jayshankar-clean — every TINS project's copy of
  // these two files will fail the scan identically, so this belongs in the kit).
  'scripts/validate.mjs', 'scripts/selftest.mjs',
  // W-phase-numbered checklists (W2-MANUAL-VERIFICATION.md, W3-DIAGNOSTIC.md, etc.) are a
  // build-methodology artefact by their very naming convention, regardless of content — found
  // live regenerating Jayshankar-clean. 'docs/**' otherwise means "the public-facing subset"
  // (lib/patterns/private-to-public.md §2 step 2's own wording), not literally everything —
  // this pattern is the one W-doc shape common enough across TINS projects to name here rather
  // than leave as manual per-project curation every single time.
  'docs/W*-*.md',
];

// --- The mechanical marker-line rewrite ---------------------------------
// Deliberately narrow: this is a structural substitution (the doc marker
// this project's own scripts look for), not the methodology scrub. The
// methodology scrub is the whole-tree scan below, plus the human/LLM work
// of writing the public docs with a corporate, non-LLM-sounding voice
// (lib/patterns/private-to-public.md §3).
const MARKER_REWRITE = [
  { from: '<!-- TINS Specification v1.0 -->', to: `<!-- ${PROJECT_NAME} Specification v1.0 -->` },
];

// --- Mechanical citation rewrite -----------------------------------------
// A TINS project's comments constantly cite SPEC.md/BUILDER-DECISIONS-REVIEW.md/HANDOVER.md by
// name as the standard "why" pointer (§4.3.12, D34, decision #46, etc.) — found live
// regenerating Jayshankar-clean: ~40 such citations across migrations, src/, and scripts/, all
// following the same few shapes. These are NOT a source-file bug to fix (the private repo is
// SUPPOSED to cite SPEC.md by name — that convention is correct and load-bearing there) and
// hand-editing 15+ source files to read differently in public would either corrupt the private
// convention or need re-doing by hand on every future regeneration, forever, as the codebase
// keeps citing SPEC.md by design. A mechanical rewrite at copy time — same mechanism as the
// marker-line rewrite above, just regex-based — is the only version of this that stays correct
// on every future run without ongoing manual upkeep. Order matters: longer/more specific
// patterns first, so e.g. 'REVIEWER-DECISIONS-REVIEW' doesn't get partially eaten by a
// 'BUILDER-DECISIONS-REVIEW' pass first.
const CONTENT_REWRITES = [
  { from: /REVIEWER-DECISIONS-REVIEW(?:\.md)?/g, to: 'the internal review log' },
  { from: /BUILDER-DECISIONS-REVIEW(?:\.md)?/g, to: 'the internal decision log' },
  { from: /HANDOVER\.md/g, to: 'the handover notes' },
  { from: /AGENTS\.md/g, to: 'the internal engineering guide' },
  { from: /SPEC\.md/g, to: 'the design doc' },
];

function rewriteMarkers(content) {
  let out = content;
  for (const { from, to } of MARKER_REWRITE) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  for (const { from, to } of CONTENT_REWRITES) {
    out = out.replace(from, to);
  }
  return out;
}

// package.json's own "scripts" entries for validate/selftest point at exactly the two files
// EXCLUDE_PATTERNS just decided are irreducibly private (they check conformance against
// SPEC.md, which is never in the public tree) — found live regenerating Jayshankar-clean: a
// destination-only edit dropping these two script entries got silently clobbered back by the
// very next re-copy, the same "hand-edit destination, keeps coming back" pitfall the pattern
// doc's §8.5 already documents for other files. This is the mechanical fix, same category as
// the .gitignore/CONTENT_REWRITES handling above — applied every run, not a one-off patch.
const PRIVATE_NPM_SCRIPTS = ['validate', 'selftest'];

function stripPrivateNpmScripts(jsonText) {
  let pkg;
  try {
    pkg = JSON.parse(jsonText);
  } catch {
    return jsonText; // not valid JSON (shouldn't happen for a real package.json) -- leave as-is
  }
  if (!pkg.scripts) return jsonText;
  let changed = false;
  for (const name of PRIVATE_NPM_SCRIPTS) {
    if (name in pkg.scripts) {
      delete pkg.scripts[name];
      changed = true;
    }
  }
  if (!changed) return jsonText;
  return JSON.stringify(pkg, null, 2) + '\n';
}

// --- Whole-tree scan: methodology + LLM-authorship fingerprints --------
// A separate, broader list from scripts/scan-task-packet.mjs (D29) by
// design (D30) — see the header comment above.
const BANNED_TERMS = [
  // Kit identity and internal file names
  'TINS', 'There Is No Source', 'tins-kit', 'kit-staging', 'kit-worthy',
  'kit-growth', 'kit-coverage', 'the spec is the source',
  'the cheapest version that would work', 'locked-decisions', 'locked decision',
  'SPEC.md', 'HANDOVER.md', 'AGENTS.md', 'PIPELINE.md', 'INDEX.md',
  'VERSIONING.md', 'BUILDER-DECISIONS-REVIEW', 'REVIEWER-DECISIONS-REVIEW',
  'GAP-ANALYSIS', 'FRONTEND-VISION-INTERVIEW', 'FRONTEND-VISION.md',
  'INTERVIEW-CHECKLIST', 'SPEC-AUTHOR.md', 'RELEASE-CHECKLIST.md',
  'DELEGATE-WORK.md', 'INTEGRATE-DELEGATED-WORK.md', 'PUBLISH-OPEN-SOURCE.md',
  'TASK-BRIEF.md', 'DELEGATION-LEDGER', 'DELEGATION-README',
  'decision-log.mjs', 'kit-extract.mjs', 'kit-coverage.mjs', 'kit-sync.mjs',
  'kit-ingest.mjs', 'kit-staging-export.mjs', 'kit-new-project-shell.mjs',
  'kit-listing.mjs', 'kit-new-pattern.mjs', 'migration-runner.mjs',
  'docs-guardian.mjs', 'check-task-independence.mjs', 'scan-task-packet.mjs',
  'private-to-public.mjs', 'new-project.mjs',
  'lib/patterns', 'lib/schemas', 'runKitChecks', 'defectNoTinsMarker',
  // LLM / AI authorship fingerprints — the release must read as
  // corporate-authored, per the tone requirement in
  // lib/patterns/private-to-public.md §3.
  'Claude', 'ChatGPT', 'Anthropic', 'OpenAI', 'GPT-4', 'GPT-5', 'Gemini',
  'Copilot', 'as an AI', 'as a language model', 'I am an AI', "I'm an AI",
  'I cannot browse', 'AI-generated', 'AI generated', 'generated by AI',
  'written by AI', 'with the help of AI', 'co-authored by AI',
  'vibe coding', 'vibe-coded', 'prompt engineering', 'LLM-generated',
  'Generated with', 'Co-Authored-By: Claude',
];

// Common leftover assistant-speak. Matched case-sensitively at the start
// of a sentence-ish boundary would be ideal, but a flat substring match
// keeps this zero-dep and catches the overwhelming majority of real
// leftovers without a parser.
const BANNED_PHRASES = [
  'Certainly!', "I'd be happy to", 'Let me know if you', 'Feel free to ask',
  "Here's a summary of the changes", 'As requested, I have',
];

const ALL_BANNED_TERMS = [...BANNED_TERMS, ...BANNED_PHRASES];

// Path-escape patterns: anything that could point back at the rest of the
// private workspace or its version control.
//
// The '../' check is deliberately scoped to doc/text files only (SOURCE_EXTS below
// excluded) — found live while regenerating Jayshankar-clean: a bare /\.\.[\\/]/
// check flags every ordinary relative import in a real codebase ('../lib/auth',
// '../components/X'), which isn't a leak at all, just how JS modules resolve
// within the copied tree. The real risk this check exists for — a doc linking
// '../HANDOVER.md' or similar, reaching for something outside the public tree —
// only shows up in prose, not import statements.
//
// Also requires 2+ consecutive '../' segments, not 1 — also found live: every
// INCLUDE_PATTERNS top-level dir (docs/, src/, supabase/, scripts/, public/) sits at
// the SAME depth, one level under the repo root, so a single '../' from any of them
// (e.g. docs/ARCHITECTURE.md linking '../supabase/migrations/0001_init.sql') stays
// entirely within the copied tree — a normal, correct intra-repo link, not a leak.
// Reaching genuinely outside the tree needs a SECOND '../', which single-'../' docs
// never have by construction. (A private filename referenced via '../' — HANDOVER.md,
// SPEC.md, etc. — is already caught by the plain-string BANNED_TERMS check above,
// independent of how many '../' precede it.)
const PATH_ESCAPE_SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const BANNED_PATTERNS = [
  { re: /(?:\.\.[\\/]){2,}/g, why: 'relative path escapes the copied tree (../../)', docsOnly: true },
  { re: /\bC:\\|\/home\/|\/Users\/|\/mnt\//g, why: 'absolute path may point at the private workspace location' },
  { re: /\.git[\\/]/g, why: 'reference to a .git directory' },
];

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pdf',
  '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.ico', '.mp4', '.mp3',
  '.lock',
]);

// --- Copy-filter helpers -------------------------------------------------
// A small glob-to-regex converter, not just exact/'/**'/'/* ' special
// cases: the include list has patterns like 'scripts/*.mjs' (a wildcard
// mid-pattern, not just at the end), and a naive special-case matcher
// silently matches nothing for those — which is a real bug, not a
// theoretical one. '**' matches across directories (zero or more path
// segments); a lone '*' matches within one segment (never crosses '/').
function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i++; // consume both '*' characters as one unit
    } else if (c === '*') {
      re += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

function pathMatches(path, pattern) {
  return globToRegExp(pattern).test(path);
}

function matchesAny(path, patterns) {
  return patterns.some((p) => pathMatches(path, p));
}

function walkDir(dir, base = dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) walkDir(fullPath, base, results);
    else if (entry.isFile()) results.push(relPath);
  }
  return results;
}

// A minimal, project-agnostic default — the same real ignore entries almost every TINS
// project's own .gitignore has (node_modules, build output, env files, IDE cruft) plus the
// methodology-internal section pattern §2 Step 7 prescribes, with NO prose explaining why (that
// reasoning is private-repo-specific, see the note above INCLUDE_PATTERNS). Only written if the
// destination doesn't already have a .gitignore — never overwrites a hand-tuned one.
const DEFAULT_GITIGNORE = `node_modules/
dist/
dev-dist/
build/
.env
.env.*
!.env.example
*.log
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
.idea/

# Internal engineering docs (should never exist here, ignored defensively)
AGENTS.md
HANDOVER.md
BUILDER-DECISIONS-REVIEW.md
REVIEWER-DECISIONS-REVIEW.md
SPEC.md

# Sibling workstreams
archive/
tins-kit/
kit-staging/
delegation/

*.zip
`;

function writeDefaultGitignoreIfMissing() {
  const dstPath = join(DST, '.gitignore');
  if (!existsSync(dstPath)) {
    writeFileSync(dstPath, DEFAULT_GITIGNORE);
    return true;
  }
  return false;
}

// --- Copy step ------------------------------------------------------------
function copyTree() {
  const allFiles = walkDir(SRC);
  const toCopy = allFiles.filter(
    (f) => !matchesAny(f, EXCLUDE_PATTERNS) && matchesAny(f, INCLUDE_PATTERNS),
  );
  if (!existsSync(DST)) mkdirSync(DST, { recursive: true });
  let rewrittenCount = 0;
  for (const relPath of toCopy) {
    const srcPath = join(SRC, relPath);
    const dstPath = join(DST, relPath);
    mkdirSync(dirname(dstPath), { recursive: true });
    const isText = /\.(mjs|js|ts|tsx|jsx|json|md|sql|toml|html|css|yml|yaml|svg|gitignore)$/.test(relPath);
    if (isText) {
      const content = readFileSync(srcPath, 'utf8');
      let rewritten = rewriteMarkers(content);
      if (relPath === 'package.json') rewritten = stripPrivateNpmScripts(rewritten);
      if (rewritten !== content) rewrittenCount++;
      writeFileSync(dstPath, rewritten);
    } else {
      copyFileSync(srcPath, dstPath);
    }
  }
  const gitignoreWritten = writeDefaultGitignoreIfMissing();
  return { totalFound: allFiles.length, copied: toCopy.length, rewrittenCount, gitignoreWritten };
}

// --- Scan step --------------------------------------------------------
function scanTree() {
  // .gitignore is exempt from the BANNED_TERMS scan (not from BANNED_PATTERNS) — found live
  // regenerating Jayshankar-clean: DEFAULT_GITIGNORE (and pattern §2 Step 7's own template)
  // DEFENSIVELY lists 'SPEC.md'/'AGENTS.md'/etc. as entries to ignore, which is the opposite of
  // a leak (it's "if this file ever exists here, don't track it") — but reads identically to a
  // real leak to a term scanner that can't tell a gitignore entry from prose. A filename listed
  // in a gitignore doesn't tell a reader anything about how the project was built the way a
  // sentence mentioning it would.
  const files = walkDir(DST).filter((f) => !SKIP_EXT.has(extname(f).toLowerCase()));
  const findings = [];
  for (const relPath of files) {
    const fullPath = join(DST, relPath);
    let text;
    try {
      text = readFileSync(fullPath, 'utf8');
    } catch {
      continue; // unreadable as text; skip rather than false-positive on binary noise
    }
    const lower = text.toLowerCase();
    for (const term of (relPath === '.gitignore' ? [] : ALL_BANNED_TERMS)) {
      // A bare single-word term (no punctuation, e.g. 'TINS') needs a word-boundary match, not
      // a substring one — found live regenerating Jayshankar-clean: a plain indexOf('tins')
      // matched inside 'custInsert' ('cus-TINS-ert'), a false positive with nothing to do with
      // the methodology. Multi-word phrases and dotted/hyphenated filenames (e.g. 'SPEC.md',
      // 'as an AI') are specific enough already that a substring match is fine and a \b-based
      // regex wouldn't even apply cleanly (word boundaries don't bracket a '.' or a space the
      // way this needs).
      const isBareWord = /^[A-Za-z]+$/.test(term);
      let idx;
      if (isBareWord) {
        const m = new RegExp(`\\b${term}\\b`, 'i').exec(text);
        idx = m ? m.index : -1;
      } else {
        idx = lower.indexOf(term.toLowerCase());
      }
      if (idx !== -1) {
        const line = text.slice(0, idx).split('\n').length;
        findings.push({ file: relPath, line, kind: 'term', match: term });
      }
    }
    const isSourceCode = PATH_ESCAPE_SOURCE_EXTS.has(extname(relPath).toLowerCase());
    for (const { re, why, docsOnly } of BANNED_PATTERNS) {
      if (docsOnly && isSourceCode) continue;
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) {
        const line = text.slice(0, m.index).split('\n').length;
        findings.push({ file: relPath, line, kind: 'path', match: m[0], why });
      }
    }
  }
  return { filesScanned: files.length, findings };
}

// --- Main -----------------------------------------------------------------
function main() {
  let copyResult = null;
  if (!scanOnly) {
    console.log(`private-to-public: ${SRC} -> ${DST}`);
    copyResult = copyTree();
    console.log(`Found ${copyResult.totalFound} file(s) in source; copied ${copyResult.copied} (filtered out ${copyResult.totalFound - copyResult.copied})`);
    console.log(`Marker line rewritten in ${copyResult.rewrittenCount} file(s)`);
    console.log(copyResult.gitignoreWritten
      ? 'Wrote a default .gitignore (none existed in the destination)'
      : 'Left the destination .gitignore as-is (already present)');
  } else {
    console.log(`private-to-public: scanning existing tree at ${DST} (--scan-only, no copy performed)`);
  }

  const { filesScanned, findings } = scanTree();

  if (jsonOut) {
    console.log(JSON.stringify({ src: SRC, dst: DST, copyResult, filesScanned, findings }, null, 2));
  } else {
    console.log('');
    console.log(`Scanned ${filesScanned} file(s) in ${DST}`);
    console.log('');
    if (findings.length === 0) {
      console.log('  ✓ No methodology fingerprints, LLM-authorship fingerprints, or path escapes found.');
      console.log('  (This is a scan, not a guarantee — read the public docs yourself before');
      console.log('   publishing. See lib/patterns/private-to-public.md for the full checklist.)');
    } else {
      for (const f of findings) {
        if (f.kind === 'term') {
          console.log(`  X ${f.file}:${f.line}  contains "${f.match}"`);
        } else {
          console.log(`  X ${f.file}:${f.line}  ${f.why} ("${f.match}")`);
        }
      }
      console.log('');
      console.log(`  ${findings.length} leak(s) found. This tree is NOT safe to publish yet.`);
      console.log('  Fix the source file(s) and re-run (or, if a match is a genuine false');
      console.log('  positive, extend BANNED_TERMS / BANNED_PATTERNS in this script).');
    }
    console.log('');
    if (findings.length === 0 && !scanOnly) {
      console.log('Next steps:');
      console.log(`  cd ${DST}`);
      console.log('  npm install && npm run validate && npm run selftest && npm run build');
      console.log('  git init && git add . && git commit -m "Initial commit"');
      console.log('');
    }
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
