// Charts and the QR for the Ant mock-ups.
//
// Ant Design has no chart components (Ant Design Charts is a separate package, and a new dependency
// for a review deck is not justified — SPEC §4.4). So these are hand-drawn SVG, but drawn the way an Ant
// product's charts look: light gridlines with a labelled value axis, rounded bars with value labels,
// an area gradient under the line, and a donut with a real legend. The previous deck drew decorative
// sketches (no axis, no values), which made every chart unreadable as a design.
//
// All three scale with their container: the viewBox is fixed and the SVG is `width: 100%`.

import { useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Flex, Typography } from 'antd';

import type { Tone } from '@/lib/storybook/types';
import { ANT_PRIMARY } from '../ant-tokens';
import { formatNumber, niceTicks, tint, toneHex } from './tone';

/**
 * The chart's drawing width, measured from its container. The viewBox used to be a fixed 380 units wide,
 * so in a 900px desk card the whole chart — text included — was scaled up 2.4× and towered over the page.
 * Measuring means a chart draws at the size it is shown, and its labels stay 9px at any width.
 */
function useBoxWidth(fallback = 380): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(220, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref as RefObject<HTMLDivElement>, w];
}

const AXIS = 'rgba(0,0,0,0.45)';
const GRID = '#f0f0f0';

/* ------------------------------------------------------------------------------------------------ */

export function LineChart({
  points,
  labels,
  height = 150,
}: {
  points: number[];
  labels?: string[];
  height?: number;
}) {
  const gradId = useId();
  const [boxRef, W] = useBoxWidth();
  const m = { l: 38, r: 12, t: 14, b: 24 };
  const ticks = niceTicks(Math.min(...points), Math.max(...points), 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i: number) => m.l + (points.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (points.length - 1));
  const y = (v: number) => m.t + (1 - (v - lo) / (hi - lo || 1)) * (height - m.t - m.b);
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${height - m.b} L${x(0)},${height - m.b} Z`;
  const showValues = points.length <= 8;

  return (
    <div ref={boxRef} style={{ width: '100%' }}>
    <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} style={{ display: 'block' }} role="img" aria-label="Line chart">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ANT_PRIMARY} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ANT_PRIMARY} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === lo ? undefined : '3 3'} />
          <text x={m.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={AXIS}>
            {formatNumber(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gradId})`} className="sba-fade" />
      <path d={line} fill="none" stroke={ANT_PRIMARY} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="sba-draw" />
      {points.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 4 : 3} fill="#fff" stroke={ANT_PRIMARY} strokeWidth="1.8" />
          {showValues && (
            <text x={x(i)} y={y(v) - 8} textAnchor="middle" fontSize="9" fontWeight={i === points.length - 1 ? 700 : 400} fill={i === points.length - 1 ? ANT_PRIMARY : AXIS}>
              {formatNumber(v)}
            </text>
          )}
        </g>
      ))}
      {labels?.map((l, i) => (
        <text key={`${l}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9" fill={AXIS}>
          {l}
        </text>
      ))}
    </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */

export function BarChart({
  items,
  height = 150,
}: {
  items: { label: string; value: number; tone?: Tone }[];
  height?: number;
}) {
  const [boxRef, W] = useBoxWidth();
  const m = { l: 38, r: 10, t: 16, b: 26 };
  const ticks = niceTicks(0, Math.max(...items.map((i) => i.value)), 4);
  const hi = ticks[ticks.length - 1] || 1;
  const slot = (W - m.l - m.r) / items.length;
  const bw = Math.min(46, slot * 0.5);
  const y = (v: number) => m.t + (1 - v / hi) * (height - m.t - m.b);

  return (
    <div ref={boxRef} style={{ width: '100%' }}>
    <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} style={{ display: 'block' }} role="img" aria-label="Bar chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : '3 3'} />
          <text x={m.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={AXIS}>
            {formatNumber(t)}
          </text>
        </g>
      ))}
      {items.map((it, i) => {
        const cx = m.l + slot * i + slot / 2;
        const top = y(it.value);
        return (
          <g key={`${it.label}-${i}`}>
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={Math.max(2, height - m.b - top)}
              rx="3"
              fill={toneHex(it.tone)}
              className="sba-grow"
              style={{ animationDelay: `${i * 60}ms`, transformOrigin: `${cx}px ${height - m.b}px` }}
            />
            <text x={cx} y={top - 5} textAnchor="middle" fontSize="9" fontWeight="600" fill="rgba(0,0,0,0.72)">
              {formatNumber(it.value)}
            </text>
            <text x={cx} y={height - 9} textAnchor="middle" fontSize="9" fill={AXIS}>
              {it.label.length > 9 ? `${it.label.slice(0, 8)}…` : it.label}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */

export function Donut({
  items,
  center,
  centerSub,
  size = 120,
}: {
  items: { label: string; value: number; tone: Tone }[];
  center?: string;
  centerSub?: string;
  size?: number;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = 40;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Flex align="center" gap={16} wrap>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Donut chart" style={{ flex: 'none' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={GRID} strokeWidth="12" />
        {items.map((it) => {
          const len = (it.value / total) * C;
          const seg = (
            <circle
              key={it.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={toneHex(it.tone)}
              strokeWidth="12"
              strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return seg;
        })}
        {center && (
          <text x="50" y={centerSub ? 48 : 54} textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(0,0,0,0.88)">
            {center}
          </text>
        )}
        {centerSub && (
          <text x="50" y="61" textAnchor="middle" fontSize="7" fill={AXIS}>
            {centerSub}
          </text>
        )}
      </svg>
      <Flex vertical gap={6} style={{ flex: 1, minWidth: 110 }}>
        {items.map((it) => (
          <Flex key={it.label} align="center" gap={8} justify="space-between">
            <Flex align="center" gap={6} style={{ minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: toneHex(it.tone), flex: 'none' }} />
              <Typography.Text ellipsis style={{ fontSize: 12 }}>
                {it.label}
              </Typography.Text>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {Math.round((it.value / total) * 100)}%
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}

/* ------------------------------------------------------------------------------------------------ */

/**
 * A FAKE QR, deliberately, and the SAME fake as the Tailwind deck (SPEC-AMENDMENT-v4 D74: a comparison
 * deck whose container codes drift is no longer comparable): FNV-1a over the container code seeds an
 * LCG that fills a 21×21 grid, and the three finder squares are drawn for real so it reads as a QR.
 * The algorithm is COPIED unchanged from components/storybook/blocks.tsx. antd ships a real `QRCode`,
 * but a scannable code pointing at a fictional `jsk://container/…` URL would invite someone to try it.
 */
export function QrSvg({ value, size = 128 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const out: boolean[] = [];
    let state = h >>> 0;
    for (let i = 0; i < 21 * 21; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      out.push((state & 0x80000000) !== 0);
    }
    return out;
  }, [value]);

  const finder = (r: number, c: number): boolean | null => {
    for (const [r0, c0] of [[0, 0], [0, 14], [14, 0]] as const) {
      if (r < r0 || r >= r0 + 7 || c < c0 || c >= c0 + 7) continue;
      const dr = r - r0;
      const dc = c - c0;
      return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
    }
    return null;
  };

  return (
    <svg viewBox="0 0 21 21" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${value}`}>
      <rect width="21" height="21" fill="#fff" />
      {cells.map((on, i) => {
        const r = Math.floor(i / 21);
        const c = i % 21;
        const f = finder(r, c);
        return (f === null ? on : f) ? <rect key={i} x={c} y={r} width="1" height="1" fill="#141414" /> : null;
      })}
    </svg>
  );
}

export { tint };
