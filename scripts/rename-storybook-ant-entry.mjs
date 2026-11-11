// Renames the Ant deck's built entry to index.html.
//
// WHY: Vite names a built HTML file after its source file, so the Ant deck's entry lands in the
// output as `storybook-ant.html`. A static host serves a site's root from `index.html`, and the repo
// root's `index.html` belongs to the app — so the entry is authored as `storybook-ant.html` (a
// distinct file, so all three builds can coexist) and renamed here. Run by
// `npm run build:storybook-ant`; it fails loud if the build did not produce the file, rather than
// deploying a site with no entry.
//
// Hash routing means this is the only rename needed: every chapter URL is `#/…`, so the host never
// has to map a path to a file.

import { access, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../dist-storybook-ant/', import.meta.url));
const from = `${out}storybook-ant.html`;
const to = `${out}index.html`;

await access(from).catch(() => {
  throw new Error(`Missing ${from} — did the Ant deck build run? (vite build --config vite.storybook-ant.config.ts)`);
});
await rename(from, to);
console.log('Ant deck entry: storybook-ant.html → index.html');

// The generated service worker precaches the entry under its *old* name, so on the host the install
// would request a file that no longer exists (and the navigation fallback, `index.html`, would not be
// precached). Point the precache entry at the renamed file. Same revision hash: the bytes are unchanged.
const swPath = `${out}sw.js`;
const sw = await readFile(swPath, 'utf8').catch(() => null);
if (sw !== null) {
  const patched = sw.replace('url:"storybook-ant.html"', 'url:"index.html"');
  if (patched === sw) throw new Error('sw.js has no storybook-ant.html precache entry to repoint — did the PWA plugin output change?');
  await writeFile(swPath, patched);
  console.log('Ant deck service worker: precache storybook-ant.html → index.html');
}
