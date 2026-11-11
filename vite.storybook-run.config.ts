import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The third review deck as its own site — `npm run build:storybook-run` → dist-storybook-run/.
//
// Mirrors vite.storybook-ant.config.ts on purpose (own entry, own output, base from VITE_BASE, no sourcemaps) with
// two deliberate differences:
//   * NO PWA / service worker. Decks 1 and 2 ship one, and deck 2's generated worker precached an entry file that the
//     rename step had removed — a stale-cache trap for a site that is re-published often and opened once or twice. This
//     deck is a few hundred kilobytes; it does not need to work offline, and a reviewer should always get the latest.
//   * No antd, no Tailwind, no PostCSS config: plain CSS (src/storybook-run.css) and React, nothing else.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  // The deck's own public folder holds only run-icon.svg; the app's `public/` carries a 69 MB tutorial library.
  publicDir: fileURLToPath(new URL('./storybook-run-public', import.meta.url)),
  plugins: [react()],
  css: { postcss: { plugins: [] } }, // do not pick up the app's Tailwind PostCSS config
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist-storybook-run',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: { index: fileURLToPath(new URL('./storybook-run.html', import.meta.url)) } },
  },
});
