import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Where the app is served from. A root deploy (Netlify, a custom domain, localhost) leaves this as
// '/'. GitHub Pages serves a *project* site from a subpath — https://<user>.github.io/<repo>/ — so
// the Pages workflow builds with VITE_BASE=/<repo>/.
//
// Why it has to be here and not just in the workflow: Vite rewrites every asset URL in index.html
// with `base`, and the PWA manifest's start_url/scope plus the service worker's navigateFallback
// have to move with it. Get that wrong and the installed app opens a 404 and offline navigation
// dies — the classic "I deployed to Pages and got a white page" failure.
const base = process.env.VITE_BASE ?? '/';

// SPEC §0.2: Vite + React 18 + TS + Tailwind + Supabase + Netlify.
// SPEC D6: PWA with graceful offline degradation. Service worker caches the
// app shell + the most recent read snapshot. When offline, the UI shows a
// "stale data — read only" banner and disables all mutation buttons.
//
// W5 decision 26: vite-plugin-pwa in `generateSW` mode (Workbox auto-generates
// the service worker). Manifest is inline. Dev mode enables the SW for
// local testing; production uses autoUpdate so users always get the latest
// build on next visit.
export default defineConfig({
  // Rewrites every asset URL, and is the anchor for the PWA paths below.
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Show the SW in dev too, so we can test offline behaviour locally.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Jayshankar — Fish Wholesale Inventory',
        short_name: 'Jayshankar',
        description: 'Fresh-fish wholesale inventory — Mode A Demo',
        theme_color: '#4f46e5',  // indigo-600, matches the SPEC §3.5 brand
        background_color: '#f8fafc',  // slate-50
        display: 'standalone',
        // These three follow `base`: on a subpath deploy the installed app must open /<repo>/, not
        // /, or tapping the home-screen icon lands on a 404.
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precache the app shell (built JS, CSS, HTML, SVG assets)
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Fall back to index.html for hash-router URLs (e.g. /#/admin). Follows `base` — on a
        // subpath deploy '/index.html' does not exist and offline navigation breaks.
        navigateFallback: `${base}index.html`,
        // Runtime caching: the Supabase REST API. NetworkFirst with a 5s timeout
        // — when online, we always get fresh data; when offline, we serve the
        // last cached response (the in-memory React Query cache is the more
        // important layer, but this is the safety net for app shell + API).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.host.endsWith('.supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // Phase A: shadcn's canonical `@/...` import alias (mirrored in tsconfig.json paths).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, open: false },
  build: { sourcemap: true },
});
