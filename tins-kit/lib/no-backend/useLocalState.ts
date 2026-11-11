// lib/no-backend/useLocalState.ts
//
// A React hook for state that persists to localStorage. SSR-safe (returns the
// initial value on the server, hydrates on mount). Serialises as JSON.
//
// Usage:
//   const [name, setName] = useLocalState('user.name', 'Anonymous');
//   const [count, setCount] = useLocalState('counter', 0);
//
//   <input value={name} onChange={e => setName(e.target.value)} />
//   <button onClick={() => setCount(c => c + 1)}>{count}</button>

import { useState, useEffect, useCallback } from 'react';
import { isLocalStorageAvailable } from './isLocalStorageAvailable';
import { LocalStateError, LocalStateErrorCode } from './LocalStateError';

export function useLocalState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with the initial value to keep server and client renders
  // identical. The real localStorage value is read in the effect after mount.
  const [value, setValue] = useState<T>(initialValue);

  // Read from localStorage on mount.
  useEffect(() => {
    if (!isLocalStorageAvailable()) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch (e) {
      // Malformed JSON, or quota exceeded — fall back to initial value.
      // (Don't throw; the UI should still work.)
      console.warn(`useLocalState: failed to read key "${key}":`, e);
    }
  }, [key]);

  // Write to localStorage on every change.
  const setValueAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function'
          ? (next as (prev: T) => T)(prev)
          : next;
        if (isLocalStorageAvailable()) {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch (e) {
            throw new LocalStateError(
              LocalStateErrorCode.QUOTA_EXCEEDED,
              `useLocalState: failed to write key "${key}": ${(e as Error).message}`,
              e as Error
            );
          }
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setValueAndPersist];
}
