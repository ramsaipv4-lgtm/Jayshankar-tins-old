// Renames "The Run" deck's built entry to index.html.
//
// WHY: Vite names a built HTML file after its source file, so the entry lands in the output as `storybook-run.html`.
// A static host serves a site's root from `index.html`, and the repo root's index.html belongs to the app. Run by
// `npm run build:storybook-run`; fails loud if the build did not produce the file, rather than deploying a site with no
// entry. (This deck has no service worker, so unlike the Ant deck's script there is no precache entry to repoint.)

import { access, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../dist-storybook-run/', import.meta.url));
const from = `${out}storybook-run.html`;
const to = `${out}index.html`;

await access(from).catch(() => {
  throw new Error(`Missing ${from} — did the build run? (vite build --config vite.storybook-run.config.ts)`);
});
await rename(from, to);
console.log('The Run entry: storybook-run.html → index.html');
