// Device frames for "The Run". A phone and a desktop window, drawn in the deck's own look and always in the light
// "market paper" palette (see .dv in storybook-run.css). Each knows whose device it is (the role badge) so that
// three screens side by side never need explaining.

import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { renderBlock } from './Blocks';
import { ROLES } from '@/lib/storybook-run/types';
import type { Screen, View } from '@/lib/storybook-run/types';

export const PHONE = { w: 300, h: 620 };
export const DESKTOP = { w: 900, h: 560 };

const DEFAULT_NAV = ['Home', 'Buy', 'Receive', 'Stock', 'More'];

function Phone({ screen, role }: { screen: Screen; role: View['role'] }) {
  const r = ROLES[role];
  const nav = screen.nav ?? DEFAULT_NAV;
  return (
    <div className={`dv phone t-${r.tone}`} role="group" aria-label={`${r.label} phone: ${screen.title}`}>
      <div className="dv-status">
        <span>9:41</span>
        <span className="badge">{r.short}</span>
        <span className={`sig${screen.offline ? ' off' : ''}`}>
          <Icon name={screen.offline ? 'wifiOff' : 'wifi'} size={13} />
        </span>
      </div>
      <div className="dv-bar">
        <div className="dv-bartop">
          {screen.back && <span className="dv-back" aria-hidden><Icon name="chevR" size={16} className="flip" /></span>}
          <div className="dv-title">{screen.title}</div>
          {screen.right && <span className="dv-right">{screen.right}</span>}
        </div>
        {screen.sub && <div className="dv-sub">{screen.sub}</div>}
      </div>
      <div className="dv-body">{screen.blocks.map(renderBlock)}</div>
      <nav className="dv-nav" aria-hidden>
        {nav.map((n) => <span key={n} className={n === screen.tab ? 'on' : ''}>{n}</span>)}
      </nav>
      {screen.sheet && (
        <div className="dv-sheet-wrap">
          <div className="dv-sheet"><h3>{screen.sheet.title}</h3>{screen.sheet.blocks.map(renderBlock)}</div>
        </div>
      )}
      {screen.toast && <div className={`dv-toast t-${screen.toast.tone}`}>{screen.toast.text}</div>}
    </div>
  );
}

const DEFAULT_SIDE = ['Dashboard', 'Warehouses', 'Truck loads', 'Approvals', 'Access'];

function Desktop({ screen, role }: { screen: Screen; role: View['role'] }) {
  const r = ROLES[role];
  const side = screen.side ?? DEFAULT_SIDE;
  return (
    <div className={`dv desktop t-${r.tone}`} role="group" aria-label={`${r.label} desktop: ${screen.title}`}>
      <div className="dk-chrome"><i /><i /><i /><span>jayshankar.app / {screen.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</span></div>
      <div className="dk-app">
        <aside className="dk-side">
          <div className="dk-brand"><i>J</i>Jayshankar</div>
          {side.map((s) => <span key={s} className={s === screen.active ? 'on' : ''}>{s}</span>)}
        </aside>
        <section className="dk-main">
          <header className="dk-head">
            <div><h2>{screen.title}</h2>{screen.sub && <small>{screen.sub}</small>}</div>
            {screen.right && <span className="dk-right">{screen.right}</span>}
            <span className="badge" style={screen.right ? { marginLeft: 8 } : undefined}>{r.label}</span>
          </header>
          <div className="dk-body">{screen.blocks.map((b, i) => (b.k === 'table' || b.k === 'looks' || b.k === 'matrix' || b.k === 'note' || b.k === 'h' || b.k === 'merge' || b.k === 'crew' ? <div key={i} className="span2">{renderBlock(b, i)}</div> : renderBlock(b, i)))}</div>
        </section>
        {screen.sheet && (
          <div className="dv-sheet-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="dv-sheet" style={{ width: 380, borderRadius: 18, animationName: 'toast-in' }}><h3>{screen.sheet.title}</h3>{screen.sheet.blocks.map(renderBlock)}</div>
          </div>
        )}
        {screen.toast && <div className={`dv-toast t-${screen.toast.tone}`} style={{ left: 'auto', right: 18, bottom: 18, width: 300 }}>{screen.toast.text}</div>}
      </div>
    </div>
  );
}

/** Draws a view at `scale`, reserving exactly the scaled box so the layout around it stays honest. */
export function ScaledDevice({ view, scale }: { view: View; scale: number }) {
  const size = view.device === 'phone' ? PHONE : DESKTOP;
  return (
    <div className="dev-scaled" style={{ width: size.w * scale, height: size.h * scale }}>
      <div className="dv-host" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: size.w, height: size.h, position: 'absolute', left: 0, top: 0 }}>
        {view.device === 'phone' ? <Phone screen={view.screen} role={view.role} /> : <Desktop screen={view.screen} role={view.role} />}
      </div>
    </div>
  );
}

/** Measures an element's width (ResizeObserver) — the same lesson deck 2 learned: measure, don't guess breakpoints. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref as React.RefObject<T>, w];
}
