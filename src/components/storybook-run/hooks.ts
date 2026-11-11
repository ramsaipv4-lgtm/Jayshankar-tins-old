// Small hooks for "The Run": a hash router (so any beat has a pasteable URL — D74's "point at a chapter"), a
// synchronous media query, and a persisted flag. localStorage is always wrapped in try/catch: it throws in private
// windows and during thumbnail capture, and the deck must render correctly without it.

import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'act'; act: string; beat: number; state: string | null; embed: boolean }
  | { page: 'compare'; c: string | null; s: number };

/**
 * Understands both this deck's own addresses (`#/act/<id>?b=<beat>&s=<lens>`) and the contract shared by all three
 * decks (`#/review?c=<chapter or journey id>&s=<step>[&embed=1]`), so a link from deck 1 or 2 lands on the same screen.
 */
export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const [path, qs = ''] = h.split('?');
  const q = new URLSearchParams(qs);
  const embed = q.get('embed') === '1';
  const num = (v: string | null) => { const n = parseInt(v ?? '0', 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  if (path === '/compare') return { page: 'compare', c: q.get('c'), s: num(q.get('s')) };
  if (path === '/review' || path === '/') {
    const c = q.get('c');
    if (c) return { page: 'act', act: c, beat: num(q.get('s')), state: null, embed };
  }
  const m = /^\/act\/([a-z0-9-]+)$/.exec(path);
  if (m) return { page: 'act', act: m[1], beat: num(q.get('b')), state: q.get('s'), embed };
  return { page: 'home' };
}

export function toHash(r: Route): string {
  if (r.page === 'home') return '#/';
  if (r.page === 'compare') return r.c ? `#/compare?c=${encodeURIComponent(r.c)}&s=${r.s}` : '#/compare';
  const q = new URLSearchParams();
  if (r.beat) q.set('b', String(r.beat));
  if (r.state) q.set('s', r.state);
  if (r.embed) q.set('embed', '1');
  const s = q.toString();
  return `#/act/${r.act}${s ? `?${s}` : ''}`;
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: Route) => {
    const next = toHash(r);
    if (window.location.hash === next) setRoute(r);
    else window.location.hash = next;
  }, []);
  return [route, go];
}

export function useMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export function usePersisted(key: string, initial: string): [string, (v: string) => void] {
  const [v, setV] = useState<string>(() => {
    try { return localStorage.getItem(key) ?? initial; } catch { return initial; }
  });
  const set = useCallback((n: string) => {
    setV(n);
    try { localStorage.setItem(key, n); } catch { /* storage unavailable: the choice lasts for this visit */ }
  }, [key]);
  return [v, set];
}
