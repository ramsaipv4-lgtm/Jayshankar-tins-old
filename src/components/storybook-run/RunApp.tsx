// The shell of "The Run": top bar, the rail of walks / the v3-v4 day / chapters, the stage, and (for reviewers) the
// specification margin. A tiny hash router makes every moment a pasteable URL, and it also understands the address
// all three decks share — `#/review?c=<id>&s=<step>` — so a link from deck 1 or 2 lands on the same screen here.
//
// Two views of the same deck: SIMPLE (default — screens, one line of story, nothing else) and REVIEWER (adds the
// decisions, acceptance criteria, build status and the database panel). The first version was reviewer-only and was
// too dense for a client who skims.
//
// Keyboard: ← → step, L cycles the lens, S toggles the specification margin (reviewer view), Esc closes it.
// "Play" auto-advances through the current set; any manual navigation stops it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { Home } from './Home';
import { ActView, EmbedStage } from './ActView';
import { SpecMargin } from './SpecMargin';
import { Compare } from './Compare';
import { useMedia, usePersisted, useRoute } from './hooks';
import { ACT_BY_ID, COLLECTIONS, DAY_ACTS, collectionOf } from '@/lib/storybook-run/acts';
import { DECKS, DECK_ORDER, deckHref } from '@/lib/storybook/decks';

const PLAY_MS = 5200;

export default function RunApp() {
  const [route, go] = useRoute();
  const [theme, setTheme] = usePersisted('run-theme', 'dawn');
  const [mode, setMode] = usePersisted('run-mode', 'simple');
  const reviewer = mode === 'reviewer';
  const [specOpen, setSpecOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const wide = useMedia('(min-width: 1241px)');
  const playRef = useRef(playing);
  playRef.current = playing;

  const act = route.page === 'act' ? ACT_BY_ID[route.act] : undefined;
  const embed = route.page === 'act' && route.embed && !!act;
  const beatIdx = act && route.page === 'act' ? Math.min(route.beat, act.beats.length - 1) : 0;
  const coll = act ? collectionOf(act.id) : undefined;
  const flat = useMemo(() => (coll ? coll.acts.flatMap((a) => a.beats.map((_, bi) => ({ act: a.id, bi }))) : []), [coll]);
  const here = act ? flat.findIndex((f) => f.act === act.id && f.bi === beatIdx) : -1;
  const beat = act ? act.beats[beatIdx] : undefined;
  const stateId = route.page === 'act' ? route.state : null;

  // `embed=1` (used by the Compare page): draw only the device and its caption.
  useEffect(() => {
    if (embed) document.documentElement.setAttribute('data-embed', '1');
    else document.documentElement.removeAttribute('data-embed');
  }, [embed]);

  const goBeat = useCallback((actId: string, bi: number, stop = true) => {
    if (stop) setPlaying(false);
    setSpecOpen(false);
    go({ page: 'act', act: actId, beat: bi, state: null, embed: false });
    window.scrollTo({ top: 0 });
  }, [go]);

  const step = useCallback((d: number, stop = true) => {
    if (!act || here < 0) { goBeat(DAY_ACTS[0].id, 0, stop); return; }
    const n = here + d;
    if (n < 0) return;
    if (n >= flat.length) { setPlaying(false); go({ page: 'home' }); return; }
    goBeat(flat[n].act, flat[n].bi, stop);
  }, [act, here, flat, goBeat, go]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => { if (playRef.current) step(1, false); }, PLAY_MS);
    return () => window.clearTimeout(id);
  }, [playing, here, step]);

  const cycleLens = useCallback(() => {
    if (!act || !beat || beat.states.length < 2) return;
    const cur = Math.max(0, beat.states.findIndex((s) => s.id === stateId));
    go({ page: 'act', act: act.id, beat: beatIdx, state: beat.states[(cur + 1) % beat.states.length].id, embed: false });
  }, [act, beat, stateId, beatIdx, go]);

  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (route.page !== 'act') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key.toLowerCase() === 'l') cycleLens();
      else if (e.key.toLowerCase() === 's') setSpecOpen((v) => !v);
      else if (e.key === 'Escape') setSpecOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, cycleLens, route.page, embed]);

  useEffect(() => { setCopied(false); }, [route]);
  const copy = () => { try { void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)); } catch { /* clipboard blocked */ } };

  const title = route.page === 'compare' ? 'Compare the three looks — The Run' : act && beat ? `${beat.title} · ${act.title} — The Run` : 'The Run — Jayshankar review deck';
  useEffect(() => { document.title = title; }, [title]);

  if (embed && act) {
    return <div className="run" data-theme={theme}><EmbedStage act={act} beatIdx={beatIdx} stateId={stateId} /></div>;
  }

  // The same screen in the other decks (only walks and chapters exist in all three; the v3/v4 day is native here).
  const shared = !!act && act.group !== 'day';
  const hasSpec = reviewer && !!act && !!beat && beat.decisions.length > 0;

  return (
    <div className="run" data-theme={theme}>
      <header className="run-top">
        <button className="run-brand" onClick={() => { setPlaying(false); go({ page: 'home' }); }} aria-label="The Run — home">
          <span className="run-brand-mark"><Icon name="truck" size={19} /></span>
          <span><b>The Run</b><small>Jayshankar · review deck</small></span>
        </button>
        <span className="grow" />
        <nav className="looksbar" aria-label="The same screen in the other looks">
          <span className="lb-l">Same screen in</span>
          {DECK_ORDER.map((d) => d === 'run'
            ? <span key={d} className="lb-here" aria-current="page">{DECKS[d].short}</span>
            : <a key={d} href={shared && act ? deckHref(d, act.id, beatIdx) : DECKS[d].url}>{DECKS[d].short}</a>)}
          <button className="lb-cmp" onClick={() => go({ page: 'compare', c: shared && act ? act.id : null, s: beatIdx })}>Compare ⇄</button>
        </nav>
        {act && beat && <span className="run-clock"><Icon name="clock" size={13} />{beat.time}</span>}
        <button className={`run-iconbtn${playing ? ' on' : ''}`} onClick={() => { if (!playing && !act) goBeat(DAY_ACTS[0].id, 0, false); setPlaying((p) => !p); }} aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={13} /><span className="lbl">{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button className={`run-iconbtn${reviewer ? ' on' : ''}`} onClick={() => setMode(reviewer ? 'simple' : 'reviewer')} aria-pressed={reviewer} title="Add decisions, acceptance criteria, build status and the database panel">
          <Icon name="book" size={13} /><span className="lbl">Reviewer view</span>
        </button>
        <button className="run-iconbtn" onClick={() => setTheme(theme === 'night' ? 'dawn' : 'night')} aria-label="Toggle dawn / night theme">
          <Icon name={theme === 'night' ? 'sun' : 'moon'} size={14} /><span className="lbl">{theme === 'night' ? 'Dawn' : 'Night'}</span>
        </button>
      </header>

      {route.page === 'compare' ? (
        <Compare c={route.c} s={route.s} go={go} />
      ) : route.page === 'home' || !act || !beat ? (
        <Home go={go} onPlay={() => { if (!playing) goBeat(DAY_ACTS[0].id, 0, false); setPlaying((p) => !p); }} playing={playing} />
      ) : (
        <div className={`run-layout${hasSpec ? '' : ' nospec'}`}>
          <nav className="run-rail" aria-label="Walks, the day, and chapters">
            <button className="rail-act rail-home" onClick={() => go({ page: 'home' })}>
              <span className="rail-ico t-ink"><Icon name="home" size={16} /></span><span><b>Overview</b><small>pick a person</small></span>
            </button>
            {COLLECTIONS.map((col) => (
              <details key={col.id} className="rail-group" open={col.id === coll?.id}>
                <summary><span>{col.label}</span><Icon name="chevD" size={14} /></summary>
                {col.acts.map((a) => (
                  <button key={a.id} className={`rail-act t-${a.tone}`} aria-current={a.id === act.id} onClick={() => goBeat(a.id, 0)}>
                    <span className="rail-ico"><Icon name={a.icon} size={16} /></span>
                    <span><b>{a.group === 'day' ? `${a.n}. ` : ''}{a.title}</b><small>{a.clock}</small></span>
                  </button>
                ))}
              </details>
            ))}
          </nav>

          <main className="run-stage" id="stage">
            <ActView
              reviewer={reviewer} act={act} beatIdx={beatIdx} stateId={stateId}
              onBeat={(i) => goBeat(act.id, i)}
              onState={(s) => go({ page: 'act', act: act.id, beat: beatIdx, state: s, embed: false })}
              onStep={(d) => step(d)}
              onSpec={() => setSpecOpen((v) => !v)} onCopy={copy} copied={copied}
              atStart={here <= 0} atEnd={false}
            />
          </main>

          {hasSpec && <SpecMargin act={act} beat={beat} open={wide || specOpen} onClose={() => setSpecOpen(false)} />}
        </div>
      )}
    </div>
  );
}
