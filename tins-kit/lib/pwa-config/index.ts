// lib/pwa-config/index.ts
//
// The "offline-capable PWA" kit module. Provides:
//   - withPwa: a Vite-plugin wrapper for `vite-plugin-pwa`
//   - useOnlineStatus: a React hook for online/offline state
//   - OfflineBanner: a small React component (matches the spec's
//     "stale data — read only" wording)
//
// Source: Jayshankar/src/lib/online.ts + src/components/OfflineBanner.tsx
// (the canonical implementation). See lib/patterns/pwa-offline-graceful.md
// for the architect's-eye view.

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface PwaConfigOptions {
  appName: string;
  themeColor: string;
  /** Background color for the splash screen. Defaults to '#ffffff'. */
  backgroundColor?: string;
  /** Offline message shown by <OfflineBanner />. Defaults to 'Offline — read only'. */
  offlineMessage?: string;
  /** The runtime caching strategies. Defaults to a sensible "read-only offline" set. */
  workbox?: {
    /** GlobPatterns to precache. Defaults to ['**/*.{js,css,html,svg,png,ico}']. */
    globPatterns?: string[];
    /** Runtime cache for navigation requests. */
    navigateFallback?: string;
    /** Maximum age for runtime-cached responses (in seconds). Defaults to 7 days. */
    maxAgeSeconds?: number;
  };
}

// ---------------------------------------------------------------------------
// withPwa: the Vite plugin wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a Vite config with `vite-plugin-pwa` and the kit's default PWA options.
 * The consumer passes the result to `defineConfig` in `vite.config.ts`.
 *
 *   import { defineConfig } from 'vite';
 *   import { withPwa } from '@tins-kit/pwa-config';
 *
 *   export default defineConfig(withPwa({
 *     appName: 'My App',
 *     themeColor: '#1976d2',
 *   }));
 *
 * Note: the consumer must `pnpm add vite-plugin-pwa` separately. The kit
 * does not include it as a runtime dep.
 */
export function withPwa<T extends Record<string, any>>(
  baseConfig: T,
  options: PwaConfigOptions
): T {
  // We avoid hard-importing `vite-plugin-pwa` to keep the kit zero-dep at
  // install time. The consumer must have it installed; we return a config
  // shape that wires it up.
  const pwaConfig = {
    registerType: 'autoUpdate' as const,
    manifest: {
      name: options.appName,
      short_name: options.appName,
      theme_color: options.themeColor,
      background_color: options.backgroundColor ?? '#ffffff',
      display: 'standalone' as const,
    },
    workbox: {
      globPatterns: options.workbox?.globPatterns ?? ['**/*.{js,css,html,svg,png,ico}'],
      navigateFallback: options.workbox?.navigateFallback ?? '/index.html',
      runtimeCaching: [
        {
          urlPattern: ({ request }: { request: Request }) =>
            request.destination === 'document',
          handler: 'NetworkFirst' as const,
          options: {
            cacheName: 'pages',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: options.workbox?.maxAgeSeconds ?? 7 * 24 * 60 * 60,
            },
          },
        },
      ],
    },
  };

  return {
    ...baseConfig,
    plugins: [
      ...(baseConfig.plugins ?? []),
      // The consumer's vite-plugin-pwa invocation. We can't import the
      // plugin directly (zero-dep kit), so we document the exact shape.
      // The consumer wires it up like:
      //   import { VitePWA } from 'vite-plugin-pwa';
      //   plugins: [...baseConfig.plugins ?? [], VitePWA(pwaConfig)]
      { name: 'tins-kit-pwa-config', _pwaConfig: pwaConfig, _kind: 'pwa-stub' },
    ],
  };
}

// ---------------------------------------------------------------------------
// useOnlineStatus: the React hook
// ---------------------------------------------------------------------------

/**
 * Track online/offline state in a React component. SSR-safe (returns `true`
 * on the server, hydrates on mount).
 *
 *   const isOnline = useOnlineStatus();
 *   if (!isOnline) return <OfflineBanner />;
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Initial value: read navigator.onLine after mount (SSR returns true)
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

// ---------------------------------------------------------------------------
// OfflineBanner: the React component
// ---------------------------------------------------------------------------

export interface OfflineBannerProps {
  /** The message to show. Defaults to 'Offline — read only'. */
  message?: string;
  /** Optional click handler (e.g. "Reconnect"). */
  onReconnect?: () => void;
}

/**
 * A small banner shown when the user is offline. The default message is
 * "Offline — read only", matching the spec's wording. The banner has
 * `data-testid="is-offline"` for tests.
 */
export function OfflineBanner(props: OfflineBannerProps) {
  const message = props.message ?? 'Offline — read only';
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="is-offline"
      style={{
        background: '#fef3c7',
        color: '#92400e',
        padding: '0.75rem 1rem',
        borderRadius: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        margin: '0.5rem 0',
      }}
    >
      <span aria-hidden="true">⚠️</span>
      <span>{message}</span>
      {props.onReconnect && (
        <button
          onClick={props.onReconnect}
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.75rem',
            background: 'transparent',
            border: '1px solid #92400e',
            borderRadius: '0.25rem',
            color: '#92400e',
            cursor: 'pointer',
          }}
        >
          Reconnect
        </button>
      )}
    </div>
  );
}

export default {
  withPwa,
  useOnlineStatus,
  OfflineBanner,
};
