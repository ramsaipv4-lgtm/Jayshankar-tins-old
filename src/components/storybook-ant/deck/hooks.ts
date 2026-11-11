// Small hooks for the Ant deck's workbench. Nothing here imports antd.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** Autoplay dwell per step — long enough to read the caption and watch the figures land. */
export const AUTOPLAY_MS = 3800;

/**
 * True below `max` px wide. Reads `matchMedia` synchronously (useSyncExternalStore), so the very first
 * paint already has the right layout — antd's Grid.useBreakpoint reports nothing until after mount,
 * which flashed the desktop layout on a phone.
 */
export function useIsNarrow(max = 991): boolean {
  const query = `(max-width: ${max}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The window's inner height, kept current — the lightbox sizes the frame to what is actually visible. */
export function useWindowHeight(): number {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  useEffect(() => {
    const onResize = () => setH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return h;
}

/**
 * Autoplay with a visible clock. Returns 0–100, the share of the current step's dwell that has
 * elapsed, so a Progress bar can show the pace. Re-armed on every step change and cleared the moment
 * `playing` goes false, so pausing is immediate. `onAdvance` is read through a ref: if the timer
 * depended on its identity, every re-render (the progress state itself triggers one) would restart it.
 */
export function useAutoplay(playing: boolean, stepIndex: number, onAdvance: () => void): number {
  const [progress, setProgress] = useState(0);
  const advance = useRef(onAdvance);
  advance.current = onAdvance;

  useEffect(() => {
    setProgress(0);
    if (!playing) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / AUTOPLAY_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(id);
        advance.current();
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [playing, stepIndex]);

  return progress;
}

/** Persisted boolean preference. localStorage can throw (private mode, blocked storage) — never fatal. */
export function usePersistedFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : raw === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? '1' : '0');
      } catch {
        /* the preference simply will not survive a reload */
      }
    },
    [key],
  );
  return [value, set];
}
