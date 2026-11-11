// Compare — the same chapter and step in all three decks, side by side, driven by one set of controls.
//
// How it works: each deck is its own published site, and all three understand `#/review?c=<id>&s=<step>&embed=1`
// (see src/lib/storybook/decks.ts). This page only builds those three addresses and shows them in frames, so it
// needs no code from the other decks and cannot drift from them. Changing the step changes only the URL fragment,
// so a frame does not reload — the deck inside simply turns the page.
//
// To compare against local copies (before anything is published), pass their addresses in the page's own query:
//   #/compare?c=walk-buyer&s=2&tw=http://localhost:5310/storybook.html&ant=http://localhost:5320/storybook-ant.html

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import { ALL_ACTS, ACT_BY_ID, COLLECTIONS } from '@/lib/storybook-run/acts';
import { DECKS, DECK_ORDER, deckHref } from '@/lib/storybook/decks';
import type { DeckId } from '@/lib/storybook/decks';
import type { Route } from './hooks';

type Layout = 'cols' | 'stack' | 'one';

function overrides(): Partial<Record<DeckId, string>> {
  const q = new URLSearchParams((window.location.hash.split('?')[1] ?? ''));
  const o: Partial<Record<DeckId, string>> = {};
  if (q.get('tw')) o.tailwind = q.get('tw')!;
  if (q.get('ant')) o.ant = q.get('ant')!;
  if (q.get('run')) o.run = q.get('run')!;
  return o;
}

export function Compare({ c, s, go }: { c: string | null; s: number; go: (r: Route) => void }) {
  const shareable = useMemo(() => [...COLLECTIONS[0].acts, ...COLLECTIONS[2].acts], []);
  const act = (c && shareable.find((a) => a.id === c)) || ACT_BY_ID['walk-buyer'];
  const step = Math.min(Math.max(s, 0), act.beats.length - 1);
  const beat = act.beats[step];
  const phone = act.beats[0].states[0].views[0].device === 'phone';
  const [layout, setLayout] = useState<Layout>(phone ? 'cols' : 'stack');
  const [which, setWhich] = useState<DeckId>('tailwind');
  const o = overrides();

  const urlFor = (d: DeckId): string => {
    const base = o[d] ?? (d === 'run' ? `${window.location.origin}${window.location.pathname}` : DECKS[d].url);
    return `${base}#/review?c=${encodeURIComponent(act.id)}&s=${step}&embed=1`;
  };
  const openHref = (d: DeckId) => (o[d] ? `${o[d]}#/review?c=${encodeURIComponent(act.id)}&s=${step}` : deckHref(d, act.id, step));
  const set = (nc: string, ns: number) => go({ page: 'compare', c: nc, s: ns });
  const height = phone ? 720 : layout === 'cols' ? 380 : 800;
  const shown = layout === 'one' ? [which] : DECK_ORDER;

  return (
    <div className="cmp">
      <div className="cmp-head">
        <div>
          <div className="kick">Same data · three designs</div>
          <h1>The same screen, three looks</h1>
          <p>Pick a person or a chapter and a step. Each pane is the real deck, showing exactly that screen — tap inside a pane to try its own controls.</p>
        </div>
      </div>

      <div className="cmp-controls">
        <label>
          <span>Show</span>
          <select value={act.id} onChange={(e) => set(e.target.value, 0)} aria-label="Chapter or walk">
            {[COLLECTIONS[0], COLLECTIONS[2]].map((col) => (
              <optgroup key={col.id} label={col.label}>
                {col.acts.map((a) => <option key={a.id} value={a.id}>{a.n}. {a.title}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="cmp-step">
          <button className="navbtn" disabled={step === 0} onClick={() => set(act.id, step - 1)} aria-label="Previous step"><Icon name="arrowR" size={16} className="flip" /></button>
          <b>Step {step + 1} of {act.beats.length}</b>
          <button className="navbtn" disabled={step >= act.beats.length - 1} onClick={() => set(act.id, step + 1)} aria-label="Next step"><Icon name="arrowR" size={16} /></button>
        </div>
        <div className="lens" role="group" aria-label="Layout">
          <span>Layout</span>
          {([['cols', 'Side by side'], ['stack', 'Stacked'], ['one', 'One at a time']] as [Layout, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={layout === k} onClick={() => setLayout(k)}>{l}</button>
          ))}
        </div>
      </div>
      <p className="cmp-cap"><b>{beat.title}.</b> {beat.story}</p>

      {layout === 'one' && (
        <div className="dev-tabs" role="tablist" aria-label="Which look">
          {DECK_ORDER.map((d) => <button key={d} role="tab" aria-pressed={which === d} onClick={() => setWhich(d)}>{DECKS[d].short}</button>)}
        </div>
      )}

      <div className={`cmp-panes ${layout}`}>
        {shown.map((d) => (
          <section key={d} className="cmp-pane">
            <header>
              <b>{DECKS[d].short}</b><small>{DECKS[d].blurb}</small>
              <a href={openHref(d)} target={d === 'run' ? undefined : '_blank'} rel="noreferrer">Open <Icon name="arrowR" size={12} /></a>
            </header>
            <iframe title={`${DECKS[d].label} — ${act.title}, step ${step + 1}`} src={urlFor(d)} style={{ height }} loading="lazy" />
          </section>
        ))}
      </div>
      <p className="b-cap" style={{ textAlign: 'center' }}>A pane that stays blank means that deck is not published at its address yet — the addresses are in <code>src/lib/storybook/decks.ts</code>, and any can be overridden for local copies (see the top of <code>Compare.tsx</code>).</p>
    </div>
  );
}

export const COMPARABLE = ALL_ACTS.filter((a) => a.group !== 'day');
