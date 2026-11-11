import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor config (D18 — Android ships first via Capacitor, wrapping the existing Vite/React
// codebase; iOS added later via @capacitor/ios when that work starts, per SPEC.md D18).
//
// appId is a reverse-domain package identifier — placeholder-but-real, matching the project's
// own naming throughout (com.jayshankar.*). NOT yet locked: Capacitor lets this change freely
// up until the first real Play Store submission (it's just a local project setting until then).
// Confirm the exact value with the user before that submission — changing it after real users
// have installed the app means shipping as a brand-new Play Store listing, not an update.
//
// appName matches vite.config.ts's PWA manifest short_name ('Jayshankar') — this is what shows
// under the icon on the device home screen, where space is tight; the fuller
// "Jayshankar — Fish Wholesale Inventory" stays the PWA's `name` (used in install prompts/app
// switchers, not the home-screen label).
const config: CapacitorConfig = {
  appId: 'com.jayshankar.fishwholesale',
  appName: 'Jayshankar',
  webDir: 'dist',
  server: {
    // Local dev convenience only — androidScheme keeps Supabase auth redirects/cookies working
    // the same way the web app already relies on (https, not the default capacitor:// scheme,
    // which some auth flows handle poorly). Does not point at a remote URL; the app ships with
    // the built dist/ bundled inside the APK, same as any other Capacitor app — this is NOT
    // "live reload from a dev server" config, which would be wrong to ship.
    androidScheme: 'https',
  },
};

export default config;
