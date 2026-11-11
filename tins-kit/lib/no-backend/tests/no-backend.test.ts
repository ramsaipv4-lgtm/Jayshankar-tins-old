// lib/no-backend/tests/no-backend.test.ts
//
// The 3-case test suite for `lib/no-backend`:
//   1. happy-path: useLocalState reads, writes, re-reads
//   2. edge-case: SSR — `window` is undefined, hook returns initial value
//   3. error-case: QuotaExceededError on setItem, surfaced as LocalStateError
//
// Test runner: any (vitest, jest, node:test). The kit recommends vitest.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLocalState,
  clearLocalState,
  clearAllLocalState,
  isLocalStorageAvailable,
  LocalStateError,
  LocalStateErrorCode,
} from '../index';

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('useLocalState — happy path', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the initial value on first render', () => {
    const { result } = renderHook(() => useLocalState('counter', 42));
    expect(result.current[0]).toBe(42);
  });

  it('writes to localStorage on update', () => {
    const { result } = renderHook(() => useLocalState('counter', 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(window.localStorage.getItem('counter')).toBe('5');
  });

  it('accepts an updater function', () => {
    const { result } = renderHook(() => useLocalState('counter', 10));
    act(() => result.current[1]((prev) => prev + 1));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(12);
  });

  it('hydrates from localStorage on mount', () => {
    window.localStorage.setItem('counter', '99');
    const { result } = renderHook(() => useLocalState('counter', 0));
    expect(result.current[0]).toBe(99);  // hydrated value, not initial
  });
});

// =============================================================================
// 2. EDGE-CASE: SSR (no window)
// =============================================================================

describe('useLocalState — SSR edge case', () => {
  it('returns the initial value when window is undefined', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore — simulate SSR
    delete (globalThis as any).window;

    const { result } = renderHook(() => useLocalState('counter', 7));
    expect(result.current[0]).toBe(7);

    // restore
    (globalThis as any).window = originalWindow;
  });

  it('does not throw on write when window is undefined', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore — simulate SSR
    delete (globalThis as any).window;

    const { result } = renderHook(() => useLocalState('counter', 0));
    expect(() => act(() => result.current[1](5))).not.toThrow();
    expect(result.current[0]).toBe(5);

    (globalThis as any).window = originalWindow;
  });
});

// =============================================================================
// 3. ERROR-CASE: QuotaExceededError
// =============================================================================

describe('useLocalState — quota error', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('throws LocalStateError with QUOTA_EXCEEDED code', () => {
    const { result } = renderHook(() => useLocalState('counter', 0));
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

    expect(() => act(() => result.current[1](1))).toThrow(LocalStateError);
    try {
      act(() => result.current[1](1));
    } catch (e) {
      expect(e).toBeInstanceOf(LocalStateError);
      expect((e as LocalStateError).code).toBe(LocalStateErrorCode.QUOTA_EXCEEDED);
    }

    setItemSpy.mockRestore();
  });
});

// =============================================================================
// 4. clearLocalState / clearAllLocalState
// =============================================================================

describe('clearLocalState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes all keys with the given prefix', () => {
    window.localStorage.setItem('user.name', 'Alice');
    window.localStorage.setItem('user.email', 'alice@example.com');
    window.localStorage.setItem('session.token', '...');
    window.localStorage.setItem('app.version', '1.0');

    const removed = clearLocalState('user.');
    expect(removed).toBe(2);
    expect(window.localStorage.getItem('user.name')).toBeNull();
    expect(window.localStorage.getItem('user.email')).toBeNull();
    expect(window.localStorage.getItem('session.token')).toBe('...');
    expect(window.localStorage.getItem('app.version')).toBe('1.0');
  });
});

describe('clearAllLocalState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('removes every key', () => {
    window.localStorage.setItem('a', '1');
    window.localStorage.setItem('b', '2');
    window.localStorage.setItem('c', '3');

    const removed = clearAllLocalState();
    expect(removed).toBe(3);
    expect(window.localStorage.length).toBe(0);
  });
});

// =============================================================================
// 5. isLocalStorageAvailable
// =============================================================================

describe('isLocalStorageAvailable', () => {
  it('returns true in a normal browser environment', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });

  it('returns false when localStorage.setItem throws', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('disabled');
      });
    expect(isLocalStorageAvailable()).toBe(false);
    spy.mockRestore();
  });
});
