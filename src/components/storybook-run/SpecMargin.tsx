// The spec margin: what the amendments say about the moment on screen, and whether it is real yet. This is D74 made
// tangible — a reviewer points at a beat instead of describing a screen — and it is the part of the deck that is
// honest about status: several of these features are written down but not built, and Phase B built some of them a
// different way.

import { Icon } from './icons';
import { BUILD_LABEL, DECISIONS } from '@/lib/storybook-run/decisions';
import type { Act, Beat } from '@/lib/storybook-run/types';

export function DecisionCard({ id, onOpenAct }: { id: string; onOpenAct?: (actId: string) => void }) {
  const d = DECISIONS[id];
  if (!d) return null;
  const b = BUILD_LABEL[d.build];
  return (
    <div className="spec-card">
      <div className="row">
        <span className="pill t-ink" style={{ fontFamily: 'var(--mono)' }}>{d.id}</span>
        <span className={`pill t-${d.status === 'OPEN' ? 'sun' : 'sea'}`}>{d.status}</span>
        <span className={`pill t-${b.tone}`}>{b.label}</span>
        <span className="pill t-ink">{d.from === 'v3' ? 'Amendment v3' : 'Amendment v4'}</span>
      </div>
      <h4>{d.title}</h4>
      <p>{d.line}</p>
      {d.criteria.map((c) => <div className="crit" key={c}>{c}</div>)}
      <p className="spec-note"><b>What exists today:</b> {d.buildNote}</p>
      {onOpenAct && d.act && <button className="acard go" style={{ boxShadow: 'none', border: 0, padding: 0, background: 'none' }} onClick={() => onOpenAct(d.act!)}>See it in the story <Icon name="arrowR" size={14} /></button>}
    </div>
  );
}

export function SpecMargin({ act, beat, open, onClose }: { act: Act; beat: Beat; open: boolean; onClose: () => void }) {
  return (
    <aside className={`run-spec t-${act.tone}${open ? ' open' : ''}`} aria-label="Specification margin">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h5>In the spec — {beat.time} · {beat.title}</h5>
        <button className="run-iconbtn spec-toggle" onClick={onClose} aria-label="Close the specification margin"><Icon name="x" size={14} />Close</button>
      </div>
      {beat.why && <div className="why"><b>Why it is drawn this way</b>{beat.why}</div>}
      {beat.decisions.map((id) => <DecisionCard key={id} id={id} />)}
      {beat.criteria && beat.criteria.length > 0 && (
        <div className="spec-card">
          <h4>This moment should prove</h4>
          {beat.criteria.map((c) => <div className="crit" key={c}>{c}</div>)}
        </div>
      )}
    </aside>
  );
}
