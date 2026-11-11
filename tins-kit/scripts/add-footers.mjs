// scripts/add-footers.mjs
// One-shot helper: append the canonical footer to every pattern that doesn't have one.
// Run: node scripts/add-footers.mjs
// Safe to run multiple times (idempotent).

import { readdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'lib/patterns';
const files = readdirSync(dir).filter(f => f.endsWith('.md'));
let added = 0;
let skipped = 0;
for (const f of files) {
  const path = join(dir, f);
  const text = readFileSync(path, 'utf8');
  const name = f.replace(/\.md$/, '');
  const marker = `End of \`${name}\``;
  if (text.includes(marker)) { skipped++; continue; }
  // Strip any trailing 'Last updated' or 'Updated' line, add canonical footer.
  const trimmed = text.replace(/\n_Last updated:[^\n]*\.?_\s*$/m, '\n');
  const cleaned = trimmed.replace(/\n---\s*\n\s*$/, '\n');  // strip trailing "---" if present
  const finalText = (cleaned.endsWith('\n') ? cleaned : cleaned + '\n')
    + '\n---\n\n'
    + `*— End of \`${name}\` pattern. See also: \`docs/GAP-ANALYSIS.md\` (the source projects) and the other patterns in \`lib/patterns/\`.*\n`;
  writeFileSync(path, finalText, 'utf8');
  added++;
  console.log('Added footer to', f);
}
console.log(`Total: ${added} added, ${skipped} skipped.`);
