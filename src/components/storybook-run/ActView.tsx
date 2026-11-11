// One act on the stage. A beat is a moment on the day's clock; its "lens" buttons re-draw every device at once, which
// is how the deck says "the same moment looks different to different people". The rpc panel shows what the database
// function actually returned to that caller — the place where D65/D68's guarantee lives.

import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { ScaledDevice, useWidth, PHONE, DESKTOP } from './Devices';
import { ROLES } from '@/lib/storybook-run/types';
import type { Act, Beat, BeatState } from '@/lib/storybook-run/types';

const GAP = 22;

function Rpc({ st, reviewer }: { st: BeatState; reviewer: boolean }) {
  const [open, setOpen] = useState(false);
  if (!st.rpc) return null;
  const r = st.rpc;
  // Simple view keeps the evidence one tap away instead of on the page: the panel is the deck's proof, but it is
  // also the densest thing on it, and most readers want the screens first.
  if (!reviewer && !open) {
    return (
      <div className="rpc-more">
        <button className="run-iconbtn" onClick={() => setOpen(true)}><Icon name="lock" size={13} />How was this kept hidden? Show what the database sent</button>
      </div>
    );
  }
  return (
    <div className="rpc rise" aria-label="What the database function returned">
      <div className="rpc-head"><b>{r.fn}</b><span className="rpc-caller">called by {r.caller}</span><span>→ what came back</span></div>
      {r.returns.map((x) => (
        <div key={x.key} className={`rpc-row ${x.present ? '' : 'absent'}`}>
          <span className="mark">{x.present ? '✓' : '✕'}</span><span className="k">{x.key}</span><span className="v">{x.present ? x.value : 'not in the return shape'}</span>
        </div>
      ))}
      {r.verdict && <div className={`rpc-verdict ${r.verdict.tone}`}><Icon name={r.verdict.tone === 'ok' ? 'check' : r.verdict.tone === 'block' ? 'ban' : 'flag'} size={15} />{r.verdict.text}</div>}
    </div>
  );
}

function Stage({ st, beatKey }: { st: BeatState; beatKey: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [which, setWhich] = useState(0);
  const views = st.views;
  useEffect(() => setWhich(0), [beatKey, st.id]);
  const widths = views.map((v) => (v.device === 'phone' ? PHONE.w : DESKTOP.w));
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (views.length - 1);
  const sideScale = w > 0 ? Math.min(1, w / total) : 1;
  // Side by side only if it stays readable; otherwise one device at a time with role tabs.
  const stack = views.length > 1 && sideScale < 0.5;
  const shown = stack ? [views[Math.min(which, views.length - 1)]] : views;
  const natural = shown.reduce((a, v) => a + (v.device === 'phone' ? PHONE.w : DESKTOP.w), 0) + GAP * (shown.length - 1);
  const minScale = shown.length > 1 ? 0.5 : shown.some((v) => v.device === 'desktop') ? 0.62 : 0.7;
  const scale = w > 0 ? Math.max(minScale, Math.min(1, w / natural)) : 1;
  const overflow = natural * scale > w + 1;
  return (
    <div>
      {stack && (
        <div className="dev-tabs" role="tablist" aria-label="Choose a device">
          {views.map((v, i) => (
            <button key={i} role="tab" aria-pressed={i === which} onClick={() => setWhich(i)}><Icon name={v.device === 'phone' ? 'user' : 'list'} size={14} />{ROLES[v.role].short} · {v.device}</button>
          ))}
        </div>
      )}
      <div ref={ref} className={`stage-devs${stack ? ' stack' : ''}`} style={overflow ? { justifyContent: 'flex-start', overflowX: 'auto', paddingBottom: 12 } : undefined}>
        {shown.map((v, i) => (
          <div key={`${beatKey}-${st.id}-${i}`} className={`dev-slot rise t-${ROLES[v.role].tone}`} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="dev-who"><Icon name={v.role === 'receiver' ? 'scale' : v.role === 'rep' ? 'truck' : v.role === 'admin' || v.role === 'coadmin' ? 'shield' : 'user'} size={13} />{ROLES[v.role].label}</span>
            <ScaledDevice view={v} scale={scale} />
            {v.cap && <div className="dev-cap">{v.cap}</div>}
          </div>
        ))}
      </div>
      {overflow && <div className="b-cap" style={{ textAlign: 'center' }}>Swipe sideways to see the whole screen →</div>}
    </div>
  );
}

/** Chrome-less view for the Compare page (`embed=1`): just the device(s) and the caption. */
export function EmbedStage({ act, beatIdx, stateId }: { act: Act; beatIdx: number; stateId: string | null }) {
  const beat = act.beats[Math.min(beatIdx, act.beats.length - 1)];
  const st = beat.states.find((s) => s.id === stateId) ?? beat.states[0];
  return (
    <div className={`embed t-${act.tone}`}>
      <Stage st={st} beatKey={`${act.id}-${beat.id}`} />
      <p className="embed-cap">{beat.story}</p>
    </div>
  );
}

export function ActView({
  act, beatIdx, stateId, onBeat, onState, onStep, onSpec, onCopy, copied, atStart, atEnd, reviewer,
}: {
  reviewer: boolean;
  act: Act; beatIdx: number; stateId: string | null;
  onBeat: (i: number) => void; onState: (s: string) => void; onStep: (d: number) => void;
  onSpec: () => void; onCopy: () => void; copied: boolean; atStart: boolean; atEnd: boolean;
}) {
  const beat: Beat = act.beats[Math.min(beatIdx, act.beats.length - 1)];
  const st = beat.states.find((s) => s.id === stateId) ?? beat.states[0];
  return (
    <div className={`t-${act.tone}`}>
      <div className="stage-head">
        <div>
          <div className="kick">{act.group === 'walk' ? 'Walk' : act.group === 'chapter' ? `Chapter ${act.n}` : `Act ${act.n}`} · {act.clock}</div>
          <h1>{act.title}</h1>
          <p className="sub">{act.kicker}</p>
        </div>
        <span className="stage-time"><Icon name="clock" size={13} /> beat {beatIdx + 1} of {act.beats.length}</span>
      </div>

      <div className="beat-card">
        <div className="beat-top">
          <span className="beat-time">{beat.time}</span>
          <h2 className="beat-title">{beat.title}</h2>
          {reviewer && <span className="dchips">{beat.decisions.map((d) => <button key={d} className="dchip" onClick={onSpec} title="Open the specification margin">{d}</button>)}</span>}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            {reviewer && beat.decisions.length > 0 && <button className="run-iconbtn spec-toggle" onClick={onSpec}><Icon name="book" size={14} />In the spec</button>}
            <button className="run-iconbtn" onClick={onCopy} title="Copy a link to exactly this moment"><Icon name={copied ? 'check' : 'link'} size={14} />{copied ? 'Link copied' : 'Copy link'}</button>
          </span>
        </div>
        <p className="beat-story">{beat.story}</p>

        {beat.states.length > 1 && (
          <>
            <div className="lens" role="group" aria-label="Change what you are looking at">
              <span>Look through</span>
              {beat.states.map((s) => <button key={s.id} aria-pressed={s.id === st.id} onClick={() => onState(s.id)}>{s.label}</button>)}
            </div>
            <p className="lens-hint">{st.hint ?? ''}</p>
          </>
        )}

        <Stage st={st} beatKey={`${act.id}-${beat.id}`} />
        <Rpc st={st} reviewer={reviewer} />

        <div className="beat-nav">
          <button className="navbtn" onClick={() => onStep(-1)} disabled={atStart} aria-label="Previous moment"><Icon name="arrowR" size={18} className="flip" /></button>
          <div className="scrub" role="tablist" aria-label="Moments in this act">
            {act.beats.map((b, i) => (
              <button key={b.id} role="tab" aria-selected={i === beatIdx} aria-label={`${b.time} ${b.title}`} className={`scrub-dot ${i < beatIdx ? 'done' : i === beatIdx ? 'now' : ''}`} onClick={() => onBeat(i)}>
                <i /><small>{b.time}</small>
              </button>
            ))}
          </div>
          <button className="navbtn" onClick={() => onStep(1)} disabled={atEnd} aria-label="Next moment"><Icon name="arrowR" size={18} /></button>
        </div>
      </div>
    </div>
  );
}
