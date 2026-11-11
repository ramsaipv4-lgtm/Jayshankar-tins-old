// The cover. The first version opened on a dense map of fourteen decisions; a client who skims would have left. So
// the front door is now PEOPLE — pick someone and walk their day on their own device — followed by the one thing the
// review is actually for (compare the three looks). The v3/v4 deep dive, the decisions atlas and all 32 chapters are
// one tap away and folded by default.

import { useEffect, useMemo, useRef } from 'react';
import { Icon } from './icons';
import { renderBlock } from './Blocks';
import { ACTS, CHAPTER_ACTS, WALK_ACTS } from '@/lib/storybook-run/acts';
import { BUILD_LABEL, DECISIONS, DECISION_ORDER } from '@/lib/storybook-run/decisions';
import { DECKS, DECK_ORDER } from '@/lib/storybook/decks';
import type { Route } from './hooks';

const VB = { w: 1000, h: 190 };

function Road({ onAct }: { onAct: (id: string) => void }) {
  const pts = useMemo(() => ACTS.map((a, i) => ({ a, x: 60 + (i * 880) / (ACTS.length - 1), y: 100 + Math.sin(i * 1.25) * 34 })), []);
  const d = useMemo(() => {
    let s = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], mx = (p.x + q.x) / 2; s += ` C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`; }
    return s;
  }, [pts]);
  const pathRef = useRef<SVGPathElement>(null);
  const truckRef = useRef<HTMLDivElement>(null);
  // The truck follows the drawn path (getPointAtLength), so it stays on the road at any width.
  useEffect(() => {
    const path = pathRef.current, truck = truckRef.current;
    if (!path || !truck) return;
    const len = path.getTotalLength();
    const place = (t: number) => { const p = path.getPointAtLength(t * len); truck.style.left = `${(p.x / VB.w) * 100}%`; truck.style.top = `${(p.y / VB.h) * 100}%`; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { place(0.5); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { place(((now - t0) / 16000) % 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="road" aria-label="The v3 and v4 day: each stop is an act">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" aria-hidden>
        <path className="road-wave" d="M 0 150 Q 125 130 250 150 T 500 150 T 750 150 T 1000 150" />
        <path ref={pathRef} className="road-line" d={d} />
      </svg>
      <div className="stops">
        {pts.map(({ a, x, y }) => (
          <button key={a.id} className={`stop t-${a.tone}`} style={{ left: `${(x / VB.w) * 100}%`, top: `${(y / VB.h) * 100 + 7}%` }} onClick={() => onAct(a.id)} aria-label={`Act ${a.n}: ${a.title}`}>
            <i /><b>{/\d\d:\d\d/.exec(a.clock)?.[0] ?? a.clock}</b><span>{a.title}</span>
          </button>
        ))}
      </div>
      <div ref={truckRef} className="truck-run" aria-hidden style={{ animation: 'none', transform: 'translate(-50%, -50%)' }}><Icon name="truck" size={28} /></div>
    </div>
  );
}

export function Home({ go, onPlay, playing }: { go: (r: Route) => void; onPlay: () => void; playing: boolean }) {
  const open = (id: string) => go({ page: 'act', act: id, beat: 0, state: null, embed: false });
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-in">
          <div>
            <div className="kick">Third review deck · same screens, a different look</div>
            <h1>Walk the business as <em>the people who run it.</em></h1>
            <p className="lede">
              Pick a person — the admin, the buyer on the road, the one at the scale, the grader, the packer who delivers — and walk their day, end to end,
              on the device they really use. Then see the same screens in all three designs, side by side.
            </p>
            <div className="hero-cta">
              <a className="btn" href="#people" onClick={(e) => { e.preventDefault(); document.getElementById('people')?.scrollIntoView({ behavior: 'smooth' }); }}><Icon name="users" size={15} />Pick a person</a>
              <button className="btn ghost" onClick={() => go({ page: 'compare', c: null, s: 0 })}><Icon name="sync" size={15} />Compare the three looks</button>
            </div>
          </div>
          <figure className="hero-art" aria-hidden>
            <div className="dv t-coral">
              {renderBlock({ k: 'manifest', id: 'TL-125', vehicle: 'TN-09 AB 1234', status: 'RECEIVING', redactWho: true, redactPrice: true, stops: [
                { who: '', what: 'Velameen', kg: 120 }, { who: '', what: 'Velameen', kg: 180 }, { who: '', what: 'Velameen', kg: 100 },
              ], total: '400 kg' }, 0)}
            </div>
            <figcaption>What the person at the scale sees: the fish and the kilos. Never who, never how much.</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-sec" id="people">
        <h2>Walk it as…</h2>
        <p>Twelve people, each on the device they actually use — one is on the desktop, the rest are phone-only.</p>
        <div className="people">
          {WALK_ACTS.map((a) => (
            <button key={a.id} className={`person t-${a.tone}`} onClick={() => open(a.id)}>
              <span className="pi"><Icon name={a.icon} size={20} /></span>
              <span className="pt"><b>{a.title}</b><small>{a.kicker}</small></span>
              <span className="pm"><i>{a.clock}</i><i>{a.beats.length} steps</i></span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-sec">
        <h2>One question: which look?</h2>
        <p>The same screens, drawn three ways. Open any one, or put them next to each other.</p>
        <div className="looks3">
          {DECK_ORDER.map((d) => (
            <article key={d} className={`look3${d === 'run' ? ' here' : ''}`}>
              <b>{DECKS[d].label}</b><p>{DECKS[d].blurb}</p>
              {d === 'run' ? <span className="chip t-sea">you are here</span> : <a href={DECKS[d].url}>Open this deck →</a>}
            </article>
          ))}
        </div>
        <div className="hero-cta" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => go({ page: 'compare', c: 'walk-buyer', s: 2 })}><Icon name="sync" size={15} />Compare the three looks, side by side</button>
        </div>
      </section>

      <section className="home-sec">
        <details className="fold">
          <summary><span><b>For reviewers: the v3 &amp; v4 amendments, as one truck load's day</b><small>8 acts · 28 moments · every decision D63–D76, with its build status</small></span><Icon name="chevD" size={18} /></summary>
          <div className="fold-body">
            <div className="hero-cta" style={{ marginBottom: 6 }}>
              <button className="btn" onClick={() => open(ACTS[0].id)}><Icon name="play" size={14} />Start at dawn</button>
              <button className="btn ghost" onClick={onPlay}><Icon name={playing ? 'pause' : 'clock'} size={15} />{playing ? 'Pause' : 'Watch the day'}</button>
            </div>
            <Road onAct={open} />
            <div className="atlas">
              {DECISION_ORDER.map((id) => {
                const dc = DECISIONS[id];
                const b = BUILD_LABEL[dc.build];
                const act = ACTS.find((a) => a.id === dc.act);
                return (
                  <article key={id} className={`acard t-${act?.tone ?? 'ink'}`}>
                    <div className="acard-top">
                      <span className="pill t-ink" style={{ fontFamily: 'var(--mono)' }}>{dc.id}</span>
                      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {dc.status === 'OPEN' && <span className="pill t-sun">OPEN</span>}
                        <span className={`pill t-${b.tone}`}>{b.label}</span>
                      </span>
                    </div>
                    <h3>{dc.title}</h3><p>{dc.line}</p>
                    {act ? <button className="go" onClick={() => open(act.id)}>See it · Act {act.n} <Icon name="arrowR" size={14} /></button> : <span className="b-cap">No screen — a product boundary.</span>}
                  </article>
                );
              })}
            </div>
            <div className="honest">
              <span className="ht">An honest note on “built”.</span>
              v3 describes a new <code>receiving-storage</code> role and a <code>truck_loads</code> table above the bills. The Phase B migrations answered the same client need <i>differently</i> — a blind-receiving flag on existing roles, and a <code>procurement</code> + <code>truck_loads</code> pair of their own — and neither document mentions the other. Where the two diverge, this deck draws <b>both</b>, side by side, rather than quietly picking one.
            </div>
          </div>
        </details>

        <details className="fold">
          <summary><span><b>Every chapter</b><small>The 32 workflow chapters — identical content to the other two decks</small></span><Icon name="chevD" size={18} /></summary>
          <div className="fold-body">
            <div className="chap-grid">
              {CHAPTER_ACTS.map((a) => (
                <button key={a.id} className={`chap t-${a.tone}`} onClick={() => open(a.id)}>
                  <span className="cn">{a.n}</span><span><b>{a.title}</b><small>{a.clock} · {a.beats.length} steps</small></span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
