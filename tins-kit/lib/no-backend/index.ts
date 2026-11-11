// lib/no-backend/index.ts
//
// The "no-backend" kit module: a minimal localStorage wrapper for TINS
// consumers that have no server (or a server is overkill). Provides:
//
//   - useLocalState: a React hook for persistent state
//   - clearLocalState: clear all keys for a given prefix
//   - isLocalStorageAvailable: detect SSR / private-mode / quota errors
//   - LocalStateError: typed error class
//
// Source: exam-forge (the canonical no-backend localStorage wrapper), Jayshankar
// (the same pattern with PWA + IndexedDB fallback). The kit ships this so
// consumers can copy-paste instead of reinventing the SSR / quota / serialise
// boilerplate.

export { useLocalState } from './useLocalState';
export { clearLocalState, clearAllLocalState } from './clearLocalState';
export { isLocalStorageAvailable } from './isLocalStorageAvailable';
export { LocalStateError, LocalStateErrorCode } from './LocalStateError';

import { useLocalState } from './useLocalState';
import { clearLocalState, clearAllLocalState } from './clearLocalState';
import { isLocalStorageAvailable } from './isLocalStorageAvailable';
import { LocalStateError, LocalStateErrorCode } from './LocalStateError';

export default {
  useLocalState,
  clearLocalState,
  clearAllLocalState,
  isLocalStorageAvailable,
  LocalStateError,
  LocalStateErrorCode,
};
