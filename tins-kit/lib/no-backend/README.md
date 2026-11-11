# `lib/no-backend` — kit code module

> **The minimal localStorage wrapper for TINS consumers that have no server (or a
> server is overkill).** Provides a React hook for persistent state, a clear-by-prefix
> helper, an availability detector, and a typed error class. SSR-safe, quota-safe.
>
> **Source:** `exam-forge/src/lib/noBackend.ts` (the canonical implementation), Jayshankar
> (the same pattern with PWA + IndexedDB fallback for offline).

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/no-backend/ src/lib/no-backend/
```

(No npm install — the module has no external deps.)

---

## API

### `useLocalState<T>(key, initialValue)`

A React hook for state that persists to `localStorage`. SSR-safe (returns the
initial value on the server, hydrates on mount). Serialises as JSON.

```tsx
import { useLocalState } from '@/lib/no-backend';

function Counter() {
  const [count, setCount] = useLocalState('counter', 0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function NameInput() {
  const [name, setName] = useLocalState('user.name', 'Anonymous');
  return <input value={name} onChange={e => setName(e.target.value)} />;
}
```

The hook returns a `[value, setValue]` pair (same shape as `useState`). The
`setValue` function accepts either a value or an updater function.

### `clearLocalState(prefix)`

Remove all `localStorage` keys starting with `prefix`. Returns the number of
keys removed.

```ts
import { clearLocalState } from '@/lib/no-backend';

// Sign out: clear all "user.*" and "session.*" keys
const removed = clearLocalState('user.');
clearLocalState('session.');
```

### `clearAllLocalState()`

Remove **every** key from `localStorage`. Returns the count. Use with care.

```ts
import { clearAllLocalState } from '@/lib/no-backend';

// "Reset demo" button: nuke everything
clearAllLocalState();
```

### `isLocalStorageAvailable()`

Returns `true` if `localStorage` is available, `false` otherwise (SSR, private
mode, quota = 0, disabled by policy).

```ts
import { isLocalStorageAvailable } from '@/lib/no-backend';

if (isLocalStorageAvailable()) {
  // safe to read/write
} else {
  // fall back to in-memory state, or IndexedDB, or a "your browser doesn't
  // support this" UI
}
```

### `LocalStateError`, `LocalStateErrorCode`

Typed error for localStorage failures. The two common cases:

- `LocalStateErrorCode.QUOTA_EXCEEDED` — user is in private mode, or storage is full.
- `LocalStateErrorCode.NOT_AVAILABLE` — SSR, or storage is disabled.

```ts
import { LocalStateError, LocalStateErrorCode } from '@/lib/no-backend';

try {
  setCount(c => c + 1);
} catch (e) {
  if (e instanceof LocalStateError && e.code === LocalStateErrorCode.QUOTA_EXCEEDED) {
    // show a "your storage is full" toast
  }
}
```

---

## The 3 rules

### 1. Always guard `localStorage` access

Never assume `localStorage` works. The `useLocalState` hook already does, but
if you write your own wrapper, use `isLocalStorageAvailable()` first.

```ts
// ❌ WRONG — crashes in SSR and private mode
const value = localStorage.getItem('key');

// ✅ RIGHT
if (isLocalStorageAvailable()) {
  const value = localStorage.getItem('key');
}
```

### 2. Never store secrets in `localStorage`

`localStorage` is readable by any JS on the same origin. JWTs, API keys, and
passwords go in `httpOnly` cookies or the server's session store, not
`localStorage`. The `useLocalState` hook is for *user preferences and
non-sensitive state*.

```ts
// ❌ WRONG — JWT in localStorage is XSS-vulnerable
const [token, setToken] = useLocalState('jwt', '...');

// ✅ RIGHT — JWT in httpOnly cookie set by the server
// (no client-side storage needed)
```

### 3. Handle the quota error

`localStorage` has a ~5 MB limit per origin. If the user fills it up (e.g. by
storing large blobs in your app), `setItem` throws `QuotaExceededError`. The
`useLocalState` hook throws a `LocalStateError` with `code = QUOTA_EXCEEDED`.
Catch it and surface a "your storage is full" message to the user.

```ts
// ❌ WRONG — uncaught throw breaks the UI
const onClick = () => setBlob(largeBlob);  // throws QuotaExceededError

// ✅ RIGHT — catch and show a toast
const onClick = () => {
  try {
    setBlob(largeBlob);
  } catch (e) {
    if (e instanceof LocalStateError) {
      toast.error('Storage full. Please clear some data.');
    }
  }
};
```

---

## When to extend

- **If you need IndexedDB** (for larger blobs or structured queries): add
  `useLocalIDB` to this module, following the same shape (`[value, setValue]`).
- **If you need cross-tab sync**: add a `storage` event listener to
  `useLocalState` that updates the value when another tab writes to the same
  key. (Useful for "sign out in one tab, signed out in all tabs".)
- **If you need encryption** (e.g. for a "remember me" token that *must* be
  client-side): wrap `setItem`/`getItem` with `crypto.subtle.encrypt` /
  `decrypt`. Don't roll your own crypto — use the Web Crypto API.

---

## Tests

See `tests/no-backend.test.ts` for the 3-case test suite: happy-path (read +
write), edge-case (SSR — `window` undefined), error-case (quota exceeded).

---

*— End of `lib/no-backend/README.md`.*
