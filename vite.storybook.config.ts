import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The picture book as its own site — `npm run build:storybook` → dist-storybook/.
//
// Separate from vite.config.ts on purpose: that one builds the whole app (Supabase, auth, every
// dashboard), and the deck must be deployable without any of it. See src/storybook-main.tsx.
//
// VITE_BASE follows the same convention as the app build: '/' for a root deploy, and '/<repo>/'
// for a GitHub Pages *project* site. It matters for the same reason — `base` rewrites the asset
// URLs, and the PWA's start_url/scope/navigateFallback have to move with it or the home-screen
// icon opens a 404.
const base = process.env.VITE_BASE ?? '/';

// The deck's own public folder. NOT `public/` — that one holds the app's 69 MB tutorial video
// library, which Vite copies wholesale into whatever it builds. The deck needs exactly one file
// (the icon its PWA manifest points at), and a review deck that the client opens on mobile data
// should not be a 71 MB download.
const publicDir = fileURLToPath(new URL('./storybook-public', import.meta.url));

export default defineConfig({
  base,
  publicDir,
  plugins: [
    react(),
    // Offline support is worth having here: the client flips through this on a phone, often on
    // mobile data. No runtime caching rules — there is no API to cache, just the deck itself.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Jayshankar — Workflow Review',
        short_name: 'Jayshankar',
        description: 'Every screen of the Jayshankar workflow, page by page.',
        theme_color: '#0e2b5e', // the deck's own brand navy
        background_color: '#f1f5f9', // slate-100, the page behind the frames
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
  // Phase A: shadcn's canonical `@/...` import alias (mirrored in tsconfig.json paths).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist-storybook',
    emptyOutDir: true,
    // No sourcemaps for the deck, unlike the app build (vite.config.ts keeps them for debugging).
    // Two reasons: this artifact is published publicly, so there is nothing to debug in it, and the
    // maps are ~1.3 MB of a 1.8 MB publish. They were also the only non-deterministic file between
    // two builds (sw.js.map), which made every republish look like a change. Off = smaller and
    // reproducible.
    sourcemap: false,
    // The object key names the emitted file: storybook.html in, index.html out. Without this the
    // site's entry would be /storybook.html and the bare site URL would 404.
    rollupOptions: { input: { index: fileURLToPath(new URL('./storybook.html', import.meta.url)) } },
  },
});
