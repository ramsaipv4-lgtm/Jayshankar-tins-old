#!/usr/bin/env node
// scripts/kit-listing.mjs
//
// List every pattern, prompt, schema, template, script, and lib module in the
// kit. The "what's in the kit?" one-liner.
//
// Usage:
//   node scripts/kit-listing.mjs                  # full listing
//   node scripts/kit-listing.mjs --kind=patterns # just one kind
//   node scripts/kit-listing.mjs --json          # JSON output

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const kindArg = args.find((a) => a.startsWith('--kind='));
const onlyKind = kindArg ? kindArg.split('=')[1] : null;
const jsonOut = args.includes('--json');

const kitRoot = resolve(import.meta.dirname, '..');

const KINDS = [
  { kind: 'patterns', dir: 'lib/patterns', ext: '.md', title: 'Patterns (architect recipes)' },
  { kind: 'prompts', dir: 'prompts', ext: '.md', title: 'Prompts (LLM session scripts)' },
  { kind: 'schemas', dir: 'schemas', ext: '.json', title: 'Schemas (JSON Schema)' },
  { kind: 'templates', dir: 'templates', ext: null, title: 'Templates (consumer starter files)' },
  { kind: 'scripts', dir: 'scripts', ext: '.mjs', title: 'Scripts (CLI tools)' },
  { kind: 'lib', dir: 'lib', ext: null, title: 'Lib modules (code + tests)' },
  { kind: 'docs', dir: 'docs', ext: '.md', title: 'Docs (workflows + conventions)' },
];

function walk(dir, ext, files = []) {
  if (!existsSync(dir)) return files;
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (f === 'tests' || f === 'archive' || f === 'node_modules') continue;
      walk(full, ext, files);
    } else if (!ext || f.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function titleFromPath(p) {
  // Try to extract a "# title" or "/* title */" from the first 5 lines
  try {
    const text = readFileSync(p, 'utf8').slice(0, 1000);
    const md = text.match(/^#\s+(.+?)$/m);
    if (md) return md[1].trim();
    const js = text.match(/^\/\*\s*([\s\S]+?)\s*\*\//);
    if (js) return js[1].split('\n')[0].trim();
    const sql = text.match(/^--\s+(.+?)$/m);
    if (sql) return sql[1].trim();
  } catch {}
  return null;
}

const result = {};
for (const { kind, dir, ext, title } of KINDS) {
  if (onlyKind && onlyKind !== kind) continue;
  const files = walk(join(kitRoot, dir), ext);
  result[kind] = {
    title,
    count: files.length,
    items: files.map((f) => ({
      path: f.replace(kitRoot + '\\', '').replace(kitRoot + '/', ''),
      title: titleFromPath(f),
    })),
  };
}

if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`tins-kit — what's in the kit?\n`);
  for (const [kind, info] of Object.entries(result)) {
    console.log(`## ${info.title} (${info.count})`);
    for (const item of info.items) {
      const t = item.title ? `  — ${item.title.slice(0, 70)}` : '';
      console.log(`  ${item.path}${t}`);
    }
    console.log('');
  }
  const total = Object.values(result).reduce((s, k) => s + k.count, 0);
  console.log(`Total: ${total} files across ${Object.keys(result).length} categories.`);
}
