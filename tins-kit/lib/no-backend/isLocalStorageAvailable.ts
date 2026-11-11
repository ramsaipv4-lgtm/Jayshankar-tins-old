// lib/no-backend/isLocalStorageAvailable.ts
//
// Detect whether localStorage is actually available. Returns false in:
//   - SSR (no window object)
//   - Private/incognito mode in some browsers (Safari < 11)
//   - Storage quota = 0 (rare; some hardened browsers)
//   - Storage disabled by user / org policy
//
// Usage: ALWAYS guard localStorage access. Never assume it works.

export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;       // SSR
  if (typeof window.localStorage === 'undefined') return false;
  try {
    const probe = '__tins_kit_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
