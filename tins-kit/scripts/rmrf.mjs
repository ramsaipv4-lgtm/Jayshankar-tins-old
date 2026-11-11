// One-shot helper: rm -rf equivalent for Windows without permission issues
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/rmrf.mjs <path>');
  process.exit(1);
}
rmSync(resolve(target), { recursive: true, force: true });
console.log('Removed', target);
