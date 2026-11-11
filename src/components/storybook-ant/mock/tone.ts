// Small colour and text helpers for the Ant mock-ups. No React, no antd — pure functions.

import { ANT_HEX } from '../ant-tokens';
import type { Tone } from '@/lib/storybook/types';

/** A tone's hex at a given opacity, as an 8-digit hex (`#1677ff1f`). Used for soft icon backgrounds. */
export function tint(hex: string, alpha = 0.12): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export const toneHex = (tone?: Tone): string => ANT_HEX[tone ?? 'navy'];

export type TagPreset = 'success' | 'processing' | 'warning' | 'error' | 'default';

/**
 * Maps a status-like cell ("Open", "In Progress", "High", "Overdue") to an Ant Tag preset, or
 * `undefined` when the text is not a recognised status — so ordinary cells stay plain text rather
 * than being tagged by guesswork.
 */
export function statusPreset(text: string): TagPreset | undefined {
  const t = text.trim().toLowerCase();
  if (/^(completed|complete|done|received|confirmed|paid|approved|accepted|delivered|resolved|active|good|ok|on time|fresh)$/.test(t)) return 'success';
  if (/^(open|new|created|sent|planned|draft|scheduled|in transit|dispatched)$/.test(t)) return 'processing';
  if (/^(in progress|pending|partial|waiting|due soon|medium|short|expiring|review)$/.test(t)) return 'warning';
  if (/^(overdue|rejected|cancelled|canceled|failed|late|high|critical|spoiled|expired|urgent)$/.test(t)) return 'error';
  if (/^(low|closed|inactive)$/.test(t)) return 'default';
  return undefined;
}

/** True for cells that are quantities or money, so a column of them can be right-aligned. */
export function isNumeric(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 18 && /^[₹+\-−–↑↓▲▼]?\s?\d[\d,.\s]*(%|kg|KG|hrs?|h|\/kg)?$/.test(t.replace(/\s?(kg|KG|\/kg)$/, ''));
}

/** Indian digit grouping for chart labels (`1,23,456`). */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

/** Round a data range outward to tidy axis ticks. Returns `count` evenly spaced values. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / (count - 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step * 0.999; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}
