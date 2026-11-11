# `lib/pwa-config` — kit code module

> **The offline-capable PWA kit module.** `withPwa` (Vite plugin wrapper) +
> `useOnlineStatus` (React hook) + `<OfflineBanner />` (React component).
> The 3-piece offline experience that covers the common case (read offline,
> write online) without building an offline write-queue.
>
> **Source:** `Jayshankar/src/lib/online.ts` + `Jayshankar/src/components/OfflineBanner.tsx`
> (the canonical implementation). See `lib/patterns/pwa-offline-graceful.md`
> for the architect's-eye view.

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/pwa-config/ src/lib/pwa-config/
pnpm add vite-plugin-pwa workbox-window
```

The consumer must install `vite-plugin-pwa` separately (the kit is
zero-dep at install time; the plugin is consumer-specific).

---

## Setup

### 1. Wire `withPwa` into your Vite config

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withPwa } from '@/lib/pwa-config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(
  withPwa(
    {
      plugins: [react()],
    },
    {
      appName: 'My App',
      themeColor: '#1976d2',
    }
  ).plugins
    ? undefined  // discard the stub, wire the real one
    : {}
);

// Or, simpler — use the kit's `withPwa` to *generate* the VitePWA config:
import { withPwa } from '@/lib/pwa-config';
const config = withPwa({ plugins: [react()] }, { appName: 'My App', themeColor: '#1976d2' });
const pwaStub = config.plugins!.find((p: any) => p.name === 'tins-kit-pwa-config') as any;
const pwaOptions = pwaStub._pwaConfig;

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
});
```

### 2. Show the offline banner in your root component

```tsx
// src/main.tsx or src/App.tsx
import { OfflineBanner, useOnlineStatus } from '@/lib/pwa-config';

function Shell({ children }) {
  const isOnline = useOnlineStatus();
  return (
    <>
      {!isOnline && <OfflineBanner />}
      {children}
    </>
  );
}
```

### 3. Guard mutation forms

```tsx
import { useOnlineStatus } from '@/lib/pwa-config';

function RecordSaleForm() {
  const isOnline = useOnlineStatus();
  return (
    <form>
      <input name="amount" />
      <button type="submit" disabled={!isOnline}>
        {isOnline ? 'Record sale' : 'Offline — cannot record sale'}
      </button>
    </form>
  );
}
```

---

## API

### `withPwa(baseConfig, options)`

Wrap a Vite config with the kit's PWA defaults. Returns the augmented
config; the consumer wires it into `defineConfig`.

```ts
import { withPwa } from '@/lib/pwa-config';

const config = withPwa(
  { plugins: [react()] },
  {
    appName: 'My App',
    themeColor: '#1976d2',
    backgroundColor: '#ffffff',
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    },
  }
);
```

The returned config has a `plugins` array with a stub `{ name: 'tins-kit-pwa-config' }`
entry. The consumer extracts `_pwaConfig` from it and passes it to
`VitePWA()` (from `vite-plugin-pwa`).

### `useOnlineStatus()`

React hook returning `true` when online, `false` when offline. SSR-safe
(returns `true` on the server, hydrates on mount).

```ts
const isOnline = useOnlineStatus();
```

### `<OfflineBanner />`

A small React component shown when offline. The default message is
"Offline — read only", matching the spec's wording. Has
`data-testid="is-offline"` for tests.

```tsx
<OfflineBanner />
<OfflineBanner message="You are offline. Read-only mode." />
<OfflineBanner onReconnect={() => window.location.reload()} />
```

---

## The 3 rules

### 1. The service worker is the safety net, not the primary cache

The PWA service worker (`vite-plugin-pwa` + `workbox`) is the *background*
mechanism. The primary mechanism is `useOnlineStatus` + `<OfflineBanner />`
+ per-form guards. Consumers that try to make the service worker the
primary cache end up with 2-week debugging sessions; the 3-piece layer is
the 30-minute alternative.

### 2. Never write to the cache when offline

Read-only offline is fine. Write-while-offline is a 1-2 week project
(the offline write-queue, conflict resolution, sync on reconnect). The
default config (above) is read-only. Consumers that need write-while-offline
should fork the module and document the deviation in
`BUILDER-DECISIONS-REVIEW.md`.

### 3. Always test the offline path

The `<OfflineBanner />` is invisible when the user is online. To test it,
use Chrome DevTools → Network → "Offline". The `data-testid="is-offline"`
attribute makes the test easy to write.

```ts
// e2e test
await page.context().setOffline(true);
await expect(page.getByTestId('is-offline')).toBeVisible();
```

---

## When to extend

- **If the consumer needs an offline write-queue**: build it as a separate
  module (`lib/offline-write-queue/`), not as an extension to `pwa-config`.
  The discipline is different (IndexedDB + sync on reconnect + conflict
  resolution).
- **If the consumer uses a different framework** (Vue / Svelte / SolidJS):
  port `useOnlineStatus` to the framework's hook API. The `withPwa`
  Vite wrapper works regardless of framework.
- **If the consumer wants a custom splash screen**: extend `PwaConfigOptions`
  with `splashScreen` and wire it into the manifest.

---

## Tests

See `tests/pwa-config.test.ts` for the 3-case test suite: happy-path
(`withPwa` returns a config with the right manifest), edge-case
(`useOnlineStatus` returns `true` on the server), error-case
(`OfflineBanner` renders with the right `data-testid`).

---

*— End of `lib/pwa-config/README.md`. See also:
`lib/patterns/pwa-offline-graceful.md` (the architect's-eye view).*
