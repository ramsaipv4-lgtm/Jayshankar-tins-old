// Supabase client init — uses the browser-safe PUBLISHABLE key (per SPEC §3.2 / §4.1).
// The secret key NEVER ships in this bundle. Server-side scripts (the seed-auth script,
// future Edge Functions) use the secret key from scripts/.env (see scripts/seed-auth-users.mjs).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Fail loud at startup. The user needs to copy .env.example to .env and fill in the
  // two values. See docs/SUPABASE-SETUP.md §2.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
    'Copy .env.example to .env and fill in the values from Supabase Dashboard → API Keys.',
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // SPEC §3.5: persist session in localStorage (the default), but auto-refresh tokens
    // so a worker on slow 4G who leaves the tab open doesn't get logged out mid-shift.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Dev-only: expose the client to the browser console for ad-hoc RLS checks
// (see docs/W2-MANUAL-VERIFICATION.md Check 4). Stripped from production builds
// by Vite's `import.meta.env.DEV` tree-shake.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __sb__: typeof supabase }).__sb__ = supabase;
}
