// The block renderer for "The Run". One switch, no per-screen components: a screen is data and this turns it into
// the deck's own look. The v3/v4 vocabulary (manifest, merge, twin, queue, approval, gate, crew, matrix) is drawn
// here, not borrowed from the other decks, because those ideas have no counterpart there.

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import { ROLES } from '@/lib/storybook-run/types';
import type { Block, IconName, Tone } from '@/lib/storybook-run/types';

const tcls = (t?: Tone) => (t ? `t-${t}` : '');
const TONE_VAR: Record<Tone, string> = {
  sea: 'var(--sea)', coral: 'var(--coral)', sun: 'var(--sun)', kelp: 'var(--kelp)', ice: 'var(--ice)', ink: 'var(--ink)', stamp: 'var(--stamp)', plum: 'var(--plum)',
};

/** A black-barred "the database did not return this" chip. */
export function Redact({ label = 'hidden' }: { label?: string }) {
  return (
    <span className="redact" title="Not in the function's return shape">
      <Icon name="lock" size={10} />
      {label}
    </span>
  );
}

export const TAILWIND_DECK = 'https://sairampv98.github.io/Jayshankar-ui/';
export const ANT_DECK = 'https://sairampv98.github.io/Jayshankar-ui-antd/';
const VOTE_KEY = 'run-look-vote';

const LOOKS = [
  { id: 'tailwind', name: 'Deck 1 · Tailwind', text: "The app's own look, hand-rolled. What ships today. Calm, dense, familiar.", url: TAILWIND_DECK },
  { id: 'ant', name: 'Deck 2 · Ant Design 6', text: 'A proven admin-product system: sidebar, steps, tables. A 414 KB-gzipped price for the library.', url: ANT_DECK },
  { id: 'run', name: 'Deck 3 · The Run', text: 'This deck: warm ledger paper, serif numerals, documents that look like documents. A design direction, not a library.', url: '' },
] as const;

function LooksCompare() {
  const [pick, setPick] = useState<string | null>(() => {
    try { return localStorage.getItem(VOTE_KEY); } catch { return null; }
  });
  const [copied, setCopied] = useState(false);
  const choose = (id: string) => {
    setPick(id);
    try { localStorage.setItem(VOTE_KEY, id); } catch { /* private mode: the pick still shows for this visit */ }
  };
  const copy = () => {
    const l = LOOKS.find((x) => x.id === pick);
    const txt = `D67 — my pick for the look: ${l ? l.name : '(none yet)'}. Reviewed in "The Run" deck.`;
    try { void navigator.clipboard.writeText(txt).then(() => setCopied(true)); } catch { setCopied(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="looks">
        {LOOKS.map((l) => (
          <button key={l.id} className="look" aria-pressed={pick === l.id} onClick={() => choose(l.id)}>
            <div className={`look-prev lp-${l.id === 'tailwind' ? 'tw' : l.id}`} aria-hidden>
              {l.id === 'tailwind' && (<><i style={{ left: 0, top: 0, right: 0, height: 22, background: '#0b2a4a' }} /><i style={{ left: 10, top: 34, width: 64, height: 36, borderRadius: 8, background: '#fff', border: '1px solid #dde3ea' }} /><i style={{ left: 82, top: 34, width: 64, height: 36, borderRadius: 8, background: '#fff', border: '1px solid #dde3ea' }} /><i style={{ left: 10, top: 80, width: 136, height: 8, borderRadius: 4, background: '#14b8a6' }} /></>)}
              {l.id === 'ant' && (<><i style={{ left: 0, top: 0, bottom: 0, width: 34, background: '#001529' }} /><i style={{ left: 44, top: 10, width: 100, height: 10, background: '#1677ff', borderRadius: 3 }} /><i style={{ left: 44, top: 30, right: 10, height: 60, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 2 }} /></>)}
              {l.id === 'run' && (<><i style={{ left: 10, top: 10, width: 120, height: 14, background: '#12222b', borderRadius: 7 }} /><i style={{ left: 10, top: 34, width: 96, height: 62, background: '#fffdf7', border: '1.5px solid #12222b', borderRadius: 10 }} /><i style={{ left: 118, top: 40, width: 40, height: 22, background: '#d9482a', borderRadius: 6, transform: 'rotate(-8deg)' }} /></>)}
            </div>
            <b>{l.name}</b>
            <p>{l.text}</p>
            {l.url ? <a href={l.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open this deck →</a> : <span className="chip t-sea">you are here</span>}
          </button>
        ))}
      </div>
      <div className="b-btns">
        <button className="bt" onClick={copy} disabled={!pick}><Icon name="copy" size={14} />{copied ? 'Copied — paste it into WhatsApp' : 'Copy my answer'}</button>
        {pick && <button className="bt ghost" onClick={() => { setPick(null); try { localStorage.removeItem(VOTE_KEY); } catch { /* ignore */ } }}>Clear</button>}
      </div>
      <p className="b-cap">Nothing leaves this browser. D67 stays OPEN until the client answers; this just makes answering a tap.</p>
    </div>
  );
}

function MergeViz({ b }: { b: Extract<Block, { k: 'merge' }> }) {
  const W = 280, H = 112, GAP = 12, xl = 0, xr = W - 8, mid = W / 2;
  const RH = 56, RY0 = (H - RH) / 2; // the blended bar is narrower and centred, so the ribbons visibly funnel in
  const T = b.streams.reduce((s, x) => s + x.kg, 0);
  const usable = H - GAP * (b.streams.length - 1);
  let ly = 0, ry = RY0;
  const bands = b.streams.map((s) => {
    const lh = (s.kg / T) * usable, rh = (s.kg / T) * RH;
    const p = { s, ly0: ly, ly1: ly + lh, ry0: ry, ry1: ry + rh };
    ly += lh + GAP; ry += rh;
    return p;
  });
  return (
    <div className={`b-merge${b.hidden ? ' hidden' : ''}`}>
      {b.title && <div className="ttl" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700, marginBottom: 6 }}>{b.title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vendor purchases merging into one weighted-average cost">
        {bands.map(({ s, ly0, ly1, ry0, ry1 }, i) => (
          <g key={i}>
            <path className="band" style={{ animationDelay: `${i * 120}ms`, transformBox: 'fill-box' }} fill={TONE_VAR[s.tone ?? 'sea']}
              d={`M ${xl + 8} ${ly0} C ${mid} ${ly0}, ${mid} ${ry0}, ${xr} ${ry0} L ${xr} ${ry1} C ${mid} ${ry1}, ${mid} ${ly1}, ${xl + 8} ${ly1} Z`} />
            <rect x={xl} y={ly0} width={8} height={ly1 - ly0} rx={2} fill={TONE_VAR[s.tone ?? 'sea']} />
          </g>
        ))}
        <rect x={xr} y={RY0} width={8} height={RH} rx={3} fill="var(--ink)" />
      </svg>
      <div style={{ display: 'grid', gap: 3, marginTop: 6 }}>
        {b.streams.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <i style={{ width: 9, height: 9, borderRadius: 3, background: TONE_VAR[s.tone ?? 'sea'], display: 'inline-block' }} />
            <span style={{ flex: 1 }}>{b.hidden ? 'Vendor' : s.who}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink2)' }}>{b.hidden ? `${s.kg} kg` : `${s.kg} kg × ₹${s.price}`}</span>
          </div>
        ))}
      </div>
      <div className="res"><b>{b.result}</b><small>{b.per}</small></div>
      {b.hidden && (
        <div className="lock"><Icon name="lock" size={22} />Admin and co-admin only<small>{b.caption ?? 'Landed cost reveals what each vendor was paid, so it is derived on read for people allowed to see prices.'}</small></div>
      )}
    </div>
  );
}

/** The deterministic, deliberately-fake QR drawing, COPIED from decks 1 and 2 so one container code draws the same
 *  pattern in all three (a comparison deck whose codes drift is no longer a comparison — D74). */
function Qr({ value, caption }: { value: string; caption?: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
    const out: boolean[] = [];
    let state = h >>> 0;
    for (let i = 0; i < 21 * 21; i++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; out.push((state & 0x80000000) !== 0); }
    return out;
  }, [value]);
  const finder = (r: number, c: number): boolean | null => {
    for (const [r0, c0] of [[0, 0], [0, 14], [14, 0]] as const) {
      if (r < r0 || r >= r0 + 7 || c < c0 || c >= c0 + 7) continue;
      const dr = r - r0, dc = c - c0;
      return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
    }
    return null;
  };
  return (
    <div className="b-card b-qr">
      <svg viewBox="0 0 21 21" width="132" height="132" shapeRendering="crispEdges" role="img" aria-label={`QR code for ${value}`}>
        <rect width="21" height="21" fill="#fff" />
        {cells.map((on, i) => { const r = Math.floor(i / 21), c = i % 21, f = finder(r, c); return (f === null ? on : f) ? <rect key={i} x={c} y={r} width="1" height="1" fill="#12222b" /> : null; })}
      </svg>
      <b>{value}</b>{caption && <small>{caption}</small>}
    </div>
  );
}

function LineChart({ title, points, labels }: { title: string; points: number[]; labels?: string[] }) {
  const W = 260, H = 96, max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
  const xy = points.map((p, i) => [8 + (i * (W - 16)) / Math.max(1, points.length - 1), H - 10 - ((p - min) / span) * (H - 24)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <div className="b-card b-chart">
      <div className="ttl">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <path d={`${d} L ${xy[xy.length - 1][0]} ${H - 4} L ${xy[0][0]} ${H - 4} Z`} fill="var(--sea-soft)" opacity=".7" />
        <path d={d} fill="none" stroke="var(--sea)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 4 : 2.4} fill={i === xy.length - 1 ? 'var(--coral)' : 'var(--sea)'} />)}
      </svg>
      {labels && <div className="axis">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>}
    </div>
  );
}

function Donut({ b }: { b: Extract<Block, { k: 'donut' }> }) {
  const total = b.items.reduce((s, x) => s + x.v, 0) || 1;
  const R = 34, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="b-card b-donut">
      {b.title && <div className="ttl">{b.title}</div>}
      <div className="row">
        <svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label={b.title ?? 'Breakdown'}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--paper2)" strokeWidth="14" />
          {b.items.map((x) => { const len = (x.v / total) * C; const el = <circle key={x.l} cx="50" cy="50" r={R} fill="none" stroke={TONE_VAR[x.tone]} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />; acc += len; return el; })}
          {b.center && <text x="50" y="52" textAnchor="middle" fontFamily="var(--serif)" fontSize="13" fontWeight="700" fill="var(--ink)">{b.center}</text>}
          {b.sub && <text x="50" y="64" textAnchor="middle" fontSize="6.5" fill="var(--mute)">{b.sub}</text>}
        </svg>
        <div className="legend">{b.items.map((x) => <div key={x.l}><i style={{ background: TONE_VAR[x.tone] }} />{x.l}<span>{Math.round((x.v / total) * 100)}%</span></div>)}</div>
      </div>
    </div>
  );
}

function Mark({ s }: { s: 'open' | 'closed' | 'blind' }) {
  const ic: IconName = s === 'open' ? 'key' : s === 'closed' ? 'lock' : 'eyeOff';
  return <span className={`mx ${s}`} title={s}><Icon name={ic} size={14} /></span>;
}

export function renderBlock(b: Block, i: number) {
  switch (b.k) {
    case 'h':
      return <div key={i} className="b-h"><b>{b.text}</b>{b.sub && <small>{b.sub}</small>}</div>;
    case 'note':
      return (
        <div key={i} className={`b-note ${tcls(b.tone ?? 'ice')}`}>
          <Icon name={b.icon ?? 'info'} size={16} />
          <div>{b.title && <b>{b.title}</b>}<p>{b.text}</p></div>
        </div>
      );
    case 'chips':
      return <div key={i} className="b-chips">{b.items.map((c) => <span key={c.t} className={`chip ${tcls(c.tone ?? 'sea')}`}>{c.icon && <Icon name={c.icon} size={12} />}{c.t}</span>)}</div>;
    case 'divider':
      return <hr key={i} className="b-div" />;
    case 'big':
      return <div key={i} className="b-big">{b.items.map((x) => <div key={x.l} className={tcls(x.tone)}><span>{x.l}</span><b>{x.v}</b>{x.sub && <small>{x.sub}</small>}</div>)}</div>;
    case 'kv':
      return (
        <div key={i} className="b-card b-kv">
          {b.title && <div className="ttl">{b.title}</div>}
          {b.items.map((x) => (
            <div className="r" key={x.l}>
              <span className="l">{x.l}</span><span className="d" />
              {x.redact ? <Redact /> : <span className={`v${x.mono ? ' mono' : ''} ${tcls(x.tone)}`} style={x.tone ? { color: 'var(--tc)' } : undefined}>{x.v}</span>}
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <div key={i} className="b-card">
          {b.title && <div className="ttl">{b.title}</div>}
          <table className="b-table">
            <thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className={r.tone ? `tone ${tcls(r.tone)}` : ''}>
                  {r.c.map((c, ci) => <td key={ci}>{b.redactCols?.includes(ci) ? <Redact label="" /> : c}</td>)}
                </tr>
              ))}
            </tbody>
            {b.foot && <tfoot><tr>{b.foot.map((c, ci) => <td key={ci}>{c}</td>)}</tr></tfoot>}
          </table>
        </div>
      );
    case 'list':
      return (
        <div key={i} className="b-card b-list">
          {b.title && <div className="ttl">{b.title}</div>}
          {b.items.map((x, xi) => (
            <div key={xi} className={`it ${tcls(x.tone)}${x.active ? ' active' : ''}`}>
              <div className="ic"><Icon name={x.icon ?? 'box'} size={16} /></div>
              <div><div className="t">{x.redact ? <Redact label="vendor" /> : x.t}</div>{x.s && <div className="s">{x.s}</div>}</div>
              <div className="r">{x.chip ? <span className={`chip ${tcls(x.tone)}`}>{x.chip}</span> : x.r}</div>
            </div>
          ))}
        </div>
      );
    case 'progress':
      return (
        <div key={i} className={`b-card b-prog ${tcls(b.tone)}`}>
          <div className="top"><span>{b.l}</span><b>{b.v} / {b.max}{b.unit ? ` ${b.unit}` : ''}</b></div>
          <div className="bar"><i style={{ width: `${Math.min(100, (b.v / b.max) * 100)}%` }} /></div>
        </div>
      );
    case 'field':
      return (
        <label key={i} className="b-field">
          <span>{b.l}</span>
          <div className={`in${b.big ? ' big' : ''}${b.locked ? ' locked' : ''}${b.error ? ' err' : ''}`}>
            {b.locked && <Icon name="lock" size={13} />}{b.v}{b.suffix && <span className="sfx">{b.suffix}</span>}
          </div>
          {b.error ? <small className="err">{b.error}</small> : b.hint ? <small>{b.hint}</small> : null}
        </label>
      );
    case 'seg':
      return <div key={i} className="b-seg">{b.l && <span>{b.l}</span>}<div className="opts">{b.options.map((o, oi) => <div key={o} className={oi === b.active ? 'on' : ''}>{o}</div>)}</div></div>;
    case 'switch':
      return <div key={i} className="b-switch"><b>{b.l}</b><i className={`tg${b.on ? ' on' : ''}`} />{b.hint && <small>{b.hint}</small>}</div>;
    case 'btns':
      return <div key={i} className="b-btns">{b.items.map((x) => <span key={x.t} className={`bt ${x.v ?? ''}${x.disabled ? ' disabled' : ''}`}>{x.icon && <Icon name={x.icon} size={14} />}{x.t}</span>)}</div>;
    case 'tabs':
      return <div key={i} className="b-tabs">{b.items.map((t, ti) => <span key={t} className={ti === b.active ? 'on' : ''}>{t}</span>)}</div>;
    case 'journey':
      return (
        <div key={i} className="b-card b-journey">
          {b.title && <div className="ttl">{b.title}</div>}
          {b.items.map((x) => (
            <div key={x.t} className={`it ${x.state}`}>
              <div className="dot">{x.state === 'done' && <Icon name="check" size={13} />}</div>
              <div className="t">{x.t}</div><div className="tm">{x.time ?? ''}</div>
            </div>
          ))}
        </div>
      );
    case 'manifest': {
      const total = b.total ?? `${b.stops.reduce((s, x) => s + x.kg, 0)} kg`;
      return (
        <div key={i} className="b-manifest">
          <div className="mf-top">
            <div className="tr"><Icon name="truck" size={18} /></div>
            <div><b>{b.id}</b><small>{b.vehicle}</small></div>
            <span className="chip t-sea st">{b.status}</span>
          </div>
          {b.stops.map((s, si) => (
            <div key={si} className={`mf-stop ${s.state ?? ''}`}>
              <div className="w">{b.redactWho ? <Redact label="vendor" /> : s.who}<small>{s.what}</small></div>
              <div className="kg">{s.kg} kg{(s.price || b.redactPrice) && <small style={{ display: 'block', fontWeight: 500, color: 'var(--mute)' }}>{b.redactPrice ? <Redact label="" /> : s.price}</small>}</div>
            </div>
          ))}
          <div className="mf-foot"><small style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>On this load</small><span>{total}</span></div>
        </div>
      );
    }
    case 'merge':
      return <MergeViz key={i} b={b} />;
    case 'twin':
      return (
        <div key={i}>
          <div className="b-twin">
            <div className={`c ${tcls(b.a.tone ?? 'sea')}`}><span>{b.a.l}</span><b>{b.a.v}</b>{b.a.sub && <small>{b.a.sub}</small>}</div>
            <div className="gap"><i>≠</i>{b.gap}</div>
            <div className={`c ${tcls(b.b.tone ?? 'coral')}`}><span>{b.b.l}</span><b>{b.b.v}</b>{b.b.sub && <small>{b.b.sub}</small>}</div>
          </div>
          {b.caption && <div className="b-cap" style={{ marginTop: 6 }}>{b.caption}</div>}
        </div>
      );
    case 'queue':
      return (
        <div key={i} className="b-card b-queue">
          <div className={`banner ${b.online ? 'on' : 'off'}`}><Icon name={b.online ? 'wifi' : 'wifiOff'} size={15} />{b.banner}</div>
          {b.items.map((q) => (
            <div key={q.n} className="q">
              <div className="n">{q.n}</div>
              <div><div className="t">{q.t}</div>{q.sub && <div className="s">{q.sub}</div>}</div>
              <span className={`qs ${q.s}`}>{q.s === 'sending' && <Icon name="sync" size={11} />}{q.s === 'sent' && <Icon name="check" size={11} />}{q.s === 'conflict' && <Icon name="alert" size={11} />}{q.s}</span>
            </div>
          ))}
        </div>
      );
    case 'approval': {
      const tone: Tone = b.state === 'approved' ? 'kelp' : b.state === 'rejected' ? 'stamp' : b.state === 'blocked' ? 'coral' : 'sun';
      return (
        <div key={i} className={`b-approval ${tcls(tone)}`}>
          <div className="ap-top"><b>{b.doc}</b><code>{b.id}</code>{b.rev && <span className="rev">{b.rev}</span>}</div>
          <div className="ap-meta"><div><span>Requested by</span><b>{b.by}</b></div><div><span>Reviewer</span><b>{b.reviewer ?? '—'}</b></div></div>
          {b.lines && <div className="ap-lines">{b.lines.map((l) => <div key={l}>{l}</div>)}</div>}
          {b.note && <div className="ap-note">“{b.note}”</div>}
          <div className="stamp">{b.state === 'blocked' ? 'Not you' : b.state}</div>
        </div>
      );
    }
    case 'gate':
      return (
        <div key={i} className={`b-gate ${b.kind} ${b.kind === 'block' ? 't-coral' : b.kind === 'warn' ? 't-sun' : 't-kelp'}`}>
          <div className="bar"><Icon name={b.kind === 'block' ? 'ban' : b.kind === 'warn' ? 'flag' : 'check'} size={22} /></div>
          <div className="tx"><b>{b.title}</b><p>{b.detail}</p><small>{b.foot ?? (b.kind === 'block' ? 'Enforced — it will not go through' : b.kind === 'warn' ? 'Warn-only — on purpose' : 'Allowed')}</small></div>
        </div>
      );
    case 'crew':
      return (
        <div key={i} className="b-crew">
          {b.items.map((c) => {
            const r = ROLES[c.role];
            return (
              <div key={c.role} className={`m ${tcls(r.tone)}${r.exception ? ' ex' : ''}`}>
                <div className="av">{r.short.slice(0, 2)}</div>
                <b>{r.label}</b>
                {r.exception && <span className="tag">the one exception · D65</span>}
                <p>{c.t}</p>
              </div>
            );
          })}
        </div>
      );
    case 'matrix':
      return (
        <div key={i} className="b-card">
          <table className="b-matrix">
            <thead><tr><th>function</th>{b.cols.map((c) => <th key={c}>{ROLES[c].short}</th>)}</tr></thead>
            <tbody>{b.rows.map((r) => <tr key={r.fn}><td>{r.fn}</td>{r.cells.map((c, ci) => <td key={ci}><Mark s={c} /></td>)}</tr>)}</tbody>
          </table>
          {b.legend !== false && <div className="mx-legend"><span><Mark s="open" /> granted by a migration</span><span><Mark s="closed" /> closed by default</span><span><Mark s="blind" /> granted, vendor &amp; price omitted</span></div>}
        </div>
      );
    case 'looks':
      return <LooksCompare key={i} />;
    case 'tiles':
      return (
        <div key={i} className={`b-tiles c${b.cols ?? 2}`}>
          {b.items.map((x) => <div key={x.t} className={`tile ${tcls(x.tone)}`}><span className="ti"><Icon name={x.icon} size={20} /></span><b>{x.t}</b></div>)}
        </div>
      );
    case 'result':
      return (
        <div key={i} className={`b-result ${tcls(b.tone ?? 'kelp')}`}>
          <div className="ok"><Icon name={b.icon ?? 'check'} size={30} /></div>
          <b>{b.title}</b>{b.caption && <p>{b.caption}</p>}
          {b.rows && <div className="b-card b-kv" style={{ width: '100%', textAlign: 'left' }}>{b.rows.map((r) => <div className="r" key={r.l}><span className="l">{r.l}</span><span className="d" /><span className="v">{r.v}</span></div>)}</div>}
        </div>
      );
    case 'bars': {
      const max = Math.max(...b.items.map((x) => x.v), 1);
      return (
        <div key={i} className="b-card b-bars">
          {b.title && <div className="ttl">{b.title}</div>}
          {b.items.map((x, xi) => <div key={x.l} className={`brow ${tcls(x.tone ?? 'sea')}`}><span>{x.l}</span><div><i style={{ width: `${(x.v / max) * 100}%`, animationDelay: `${xi * 70}ms` }} /></div><b>{x.v}</b></div>)}
        </div>
      );
    }
    case 'line':
      return <LineChart key={i} title={b.title} points={b.points} labels={b.labels} />;
    case 'donut':
      return <Donut key={i} b={b} />;
    case 'qr':
      return <Qr key={i} value={b.value} caption={b.caption} />;
    case 'photos':
      return (
        <div key={i} className="b-card b-photos">
          <div className="strip">{Array.from({ length: b.count ?? 2 }).map((_, n) => <div key={n}><Icon name="camera" size={20} /></div>)}</div>
          {b.caption && <small>{b.caption}</small>}
        </div>
      );
    default:
      return null;
  }
}
