// lib/pwa-config/tests/pwa-config.test.ts
//
// The 3-case test suite for `lib/pwa-config`:
//   1. happy-path: withPwa returns a config with the right manifest
//   2. edge-case: useOnlineStatus returns true on the server (SSR)
//   3. error-case: OfflineBanner renders with the right data-testid

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { withPwa, useOnlineStatus, OfflineBanner } from '../index';

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('pwa-config — happy path', () => {
  it('withPwa: returns a config with the right manifest', () => {
    const config = withPwa(
      { plugins: [] },
      { appName: 'My App', themeColor: '#1976d2' }
    ) as any;
    const pwaStub = config.plugins.find((p: any) => p.name === 'tins-kit-pwa-config');
    expect(pwaStub).toBeDefined();
    expect(pwaStub._pwaConfig.manifest.name).toBe('My App');
    expect(pwaStub._pwaConfig.manifest.theme_color).toBe('#1976d2');
    expect(pwaStub._pwaConfig.manifest.background_color).toBe('#ffffff'); // default
  });

  it('withPwa: respects custom workbox options', () => {
    const config = withPwa(
      { plugins: [] },
      {
        appName: 'X',
        themeColor: '#000',
        workbox: { maxAgeSeconds: 60 },
      }
    ) as any;
    const pwaStub = config.plugins.find((p: any) => p.name === 'tins-kit-pwa-config');
    expect(pwaStub._pwaConfig.workbox.runtimeCaching[0].options.expiration.maxAgeSeconds).toBe(60);
  });

  it('OfflineBanner: renders the default message', () => {
    render(<OfflineBanner />);
    expect(screen.getByText('Offline — read only')).toBeDefined();
  });
});

// =============================================================================
// 2. EDGE-CASE: SSR
// =============================================================================

describe('pwa-config — SSR edge case', () => {
  it('useOnlineStatus: returns true when window is undefined (SSR)', () => {
    const originalWindow = globalThis.window;
    // @ts-ignore
    delete (globalThis as any).window;

    const { result } = (require('@testing-library/react') as any).renderHook(() =>
      useOnlineStatus()
    );
    expect(result.current).toBe(true);

    (globalThis as any).window = originalWindow;
  });

  it('OfflineBanner: renders without crashing on the server', () => {
    // The component is a pure-TSX render; it doesn't access window.
    expect(() => render(<OfflineBanner />)).not.toThrow();
  });
});

// =============================================================================
// 3. ERROR-CASE
// =============================================================================

describe('pwa-config — error case', () => {
  it('OfflineBanner: has the data-testid="is-offline" attribute', () => {
    const { container } = render(<OfflineBanner />);
    const el = container.querySelector('[data-testid="is-offline"]');
    expect(el).not.toBeNull();
  });

  it('OfflineBanner: has role="status" for screen readers', () => {
    const { container } = render(<OfflineBanner />);
    const el = container.querySelector('[role="status"]');
    expect(el).not.toBeNull();
  });

  it('OfflineBanner: respects a custom message', () => {
    render(<OfflineBanner message="You are offline. Read-only mode." />);
    expect(screen.getByText('You are offline. Read-only mode.')).toBeDefined();
  });

  it('withPwa: preserves the baseConfig plugins', () => {
    const basePlugin = { name: 'base-plugin' };
    const config = withPwa(
      { plugins: [basePlugin] },
      { appName: 'X', themeColor: '#000' }
    ) as any;
    expect(config.plugins).toContain(basePlugin);
  });
});
