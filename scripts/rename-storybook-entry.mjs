// Renames the deck's built entry to index.html.
//
// WHY: Vite names a built HTML file after its source file, so the deck's entry lands in the output
// as `storybook.html`. A static host serves a site's root from `index.html`, and the repo root's
// `index.html` belongs to the app — so the deck's entry is authored as `storybook.html` (a distinct
// file, so both builds can coexist) and renamed here. Run by `npm run build:storybook`; it fails
// loud if the build did not produce the file, rather than deploying a site with no entry.
//
// Hash routing means this is the only rename needed: every chapter URL is `#/…`, so the host never
// has to map a path to a file.

import { access, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../dist-storybook/', import.meta.url));
const from = `${out}storybook.html`;
const to = `${out}index.html`;

await access(from).catch(() => {
  throw new Error(`Missing ${from} — did the storybook build run? (vite build --config vite.storybook.config.ts)`);
});
await rename(from, to);
console.log('storybook entry: storybook.html → index.html');

// The generated service worker precaches the entry under its OLD name, so on the host the install would request a
// file that no longer exists (and the navigation fallback, index.html, would not be precached). Point the precache
// entry at the renamed file; same revision hash, the bytes are unchanged. (Found in the kit review; deck 2's script
// already does this.)
const swPath = `${out}sw.js`;
const sw = await readFile(swPath, 'utf8').catch(() => null);
if (sw !== null) {
  const patched = sw.replace('url:"storybook.html"', 'url:"index.html"');
  if (patched === sw) throw new Error('sw.js has no storybook.html precache entry to repoint — did the PWA plugin output change?');
  await writeFile(swPath, patched);
  console.log('storybook service worker: precache storybook.html → index.html');
}
