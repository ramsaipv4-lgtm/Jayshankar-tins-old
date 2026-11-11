import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The Ant variant of the picture book as its own site —
// `npm run build:storybook-ant` → dist-storybook-ant/.
//
// WHY A SECOND CONFIG rather than a flag on vite.storybook.config.ts: deck 2 exists so the client can
// compare two design languages against identical data, and the comparison only holds if deck 1 is
// untouched. A shared config with a mode flag is one bad default away from shipping Ant into the
// Tailwind deck. Two configs, two entries, two output folders — nothing to get wrong at 2am.
//
// Everything else mirrors vite.storybook.config.ts deliberately (same publicDir, same base handling,
// same PWA shape, same sourcemap decision and why), because the two decks must be deployable the same
// way or the client gets one link that behaves differently from the other.
const base = process.env.VITE_BASE ?? '/';

// The deck's own public folder — NOT `public/`, which holds the app's 69 MB tutorial video library.
// A review deck the client opens on mobile data should not be a 71 MB download.
const publicDir = fileURLToPath(new URL('./storybook-public', import.meta.url));

export default defineConfig({
  base,
  publicDir,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Jayshankar — Workflow Review (Ant Design)',
        short_name: 'Jayshankar AntD',
        description: 'The same 32 chapters of the Jayshankar workflow, drawn in Ant Design 6.',
        theme_color: '#1677ff', // antd's primary — this deck's own brand until D67 is answered
        background_color: '#f5f5f5', // antd's layout background
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  // Same `@/...` alias as the app and deck 1 (mirrored in tsconfig.json paths), because the deck
  // imports the same chapter data and the same screen drawings from src/ (its own shell lives in
  // src/components/storybook-ant/deck/).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist-storybook-ant',
    emptyOutDir: true,
    // No sourcemaps: this artifact is published publicly and there is nothing to debug in it. Deck 1
    // learned this the expensive way — maps were ~1.3 MB of a 1.8 MB publish and the only
    // non-deterministic file between two builds, which made every republish look like a change.
    sourcemap: false,
    // Names the emitted file: storybook-ant.html in, index.html out. A static host serves the site
    // root from index.html, and the repo root's index.html belongs to the app.
    rollupOptions: { input: { index: fileURLToPath(new URL('./storybook-ant.html', import.meta.url)) } },
  },
});