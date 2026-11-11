import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Keep the test run to this repository's own tests. `_external/` holds experiments (gitignored) that carry their
// own tests, and `archive/` is read-only history — neither belongs in this project's suite.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { exclude: ['**/node_modules/**', '**/dist*/**', '_external/**', 'archive/**', 'tins-kit/**'] },
});
