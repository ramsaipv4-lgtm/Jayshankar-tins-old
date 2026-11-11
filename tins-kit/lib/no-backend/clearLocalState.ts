// lib/no-backend/clearLocalState.ts
//
// Clear localStorage keys by prefix, or clear everything. Used by the
// "sign out" flow, the "reset demo data" button, and the "clear cache"
// troubleshooting step.

import { isLocalStorageAvailable } from './isLocalStorageAvailable';

export function clearLocalState(prefix: string): number {
  if (!isLocalStorageAvailable()) return 0;
  let removed = 0;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key !== null && key.startsWith(prefix)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    window.localStorage.removeItem(key);
    removed++;
  }
  return removed;
}

export function clearAllLocalState(): number {
  if (!isLocalStorageAvailable()) return 0;
  const count = window.localStorage.length;
  window.localStorage.clear();
  return count;
}
