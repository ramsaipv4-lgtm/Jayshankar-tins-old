// Invariants of the persona journeys. They are shared by all three decks, so a mistake here is a mistake in three
// places at once — and the receiving rule ("never the vendor, never the price") is the one most worth guarding.

import { describe, expect, it } from 'vitest';
import { BASE_CHAPTERS } from '../chapters/base';
import { CHAPTERS } from '../chapters';
import { GROUP_META, GROUP_ORDER } from '../types';
import { JOURNEY_CHAPTERS } from './index';
import { S } from './screens';

const baseScreens = new Map<object, { layout: 'phone' | 'desktop'; chapter: string }>();
for (const c of BASE_CHAPTERS) for (const s of c.steps) baseScreens.set(s.screen, { layout: c.layout ?? 'phone', chapter: c.id });

describe('journeys', () => {
  it('there are twelve, numbered after the 32 chapters, with unique ids', () => {
    expect(JOURNEY_CHAPTERS).toHaveLength(12);
    expect(BASE_CHAPTERS).toHaveLength(32);
    expect(JOURNEY_CHAPTERS.map((c) => c.number)).toEqual(Array.from({ length: 12 }, (_, i) => 33 + i));
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    expect(CHAPTERS).toHaveLength(44);
  });

  it('they form the first group, and the group has display metadata', () => {
    expect(GROUP_ORDER[0]).toBe('journeys');
    expect(GROUP_META.journeys.label).toMatch(/walk/i);
    for (const j of JOURNEY_CHAPTERS) expect(j.group).toBe('journeys');
  });

  it('every step has a caption and an id unique within the whole deck', () => {
    const ids = new Set<string>();
    for (const j of JOURNEY_CHAPTERS) for (const s of j.steps) {
      expect(s.caption.trim().length, `${j.id}/${s.id}`).toBeGreaterThan(10);
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
    }
  });

  it('a journey shows only screens made for its device (desktop sources for desktop, phone for phone)', () => {
    for (const j of JOURNEY_CHAPTERS) for (const [i, s] of j.steps.entries()) {
      const src = baseScreens.get(s.screen);
      const where = `${j.id} step ${i + 1}`;
      if (src) expect(src.layout, `${where} reuses ${src.chapter}`).toBe(j.layout ?? 'phone');
      else if (j.layout === 'desktop') expect(s.screen.sidebar, `${where} (own desktop screen needs a sidebar)`).toBeDefined();
      else expect(s.screen.sidebar, `${where} (own phone screen must not have a sidebar)`).toBeUndefined();
    }
  });

  it('every persona says who it is and which devices it uses, and the devices match the layout', () => {
    for (const j of JOURNEY_CHAPTERS) {
      expect(j.persona, j.id).toBeDefined();
      expect(j.persona!.devices.toLowerCase().includes('desktop')).toBe(j.layout === 'desktop');
    }
  });

  it('only the desk journey is on a desktop; the others are phone-only, as asked', () => {
    expect(JOURNEY_CHAPTERS.filter((j) => j.layout === 'desktop').map((j) => j.id)).toEqual(['walk-admin-desk']);
  });
});

describe('the receiving seat is blind (D65, D68) — in the data, not just on the screen', () => {
  const rcv = JOURNEY_CHAPTERS.find((j) => j.id === 'walk-receiver')!;
  const json = JSON.stringify(rcv.steps);
  it('no vendor name, no rupee amount and no rate appears on any of its screens', () => {
    expect(json).not.toMatch(/Vendor [ABC]|Annamalai|₹/);
    expect(json).not.toMatch(/\brate\b[^"]*\d/i);
  });
  it('the vendor-revealing screens exist for the admin and are not reused here', () => {
    expect(JSON.stringify(S.truckBoard)).toMatch(/Vendor A/);
    for (const st of rcv.steps) expect(st.screen).not.toBe(S.truckBoard);
  });
  it('its weighing arithmetic is consistent: 392.0 + 4.8 = 396.8, short 3.2 of 400', () => {
    expect(+(392.0 + 4.8).toFixed(1)).toBe(396.8);
    expect(+(400 - 396.8).toFixed(1)).toBe(3.2);
    const all = JSON.stringify([S.rcvWeigh, S.rcvDiscrepancy, S.rcvConfirmed]);
    expect(all).toContain('396.8');
    expect(all).toContain('3.2');
    expect(all).toContain('392.0');
  });
});

describe('the admin\'s truck-load board', () => {
  it('states the weighted average its own rows produce (Σ price×kg ÷ Σ kg)', () => {
    const tables = S.truckBoard.blocks.filter((b) => b.kind === 'table');
    const t = tables.find((b) => b.kind === 'table' && b.title?.includes('landed cost'));
    expect(t && t.kind === 'table').toBe(true);
    if (!t || t.kind !== 'table') return;
    const kg = t.rows.map((r) => Number(r.cells[1]));
    const rate = t.rows.map((r) => Number(r.cells[2]));
    const avg = kg.reduce((s, k, i) => s + k * rate[i], 0) / kg.reduce((s, k) => s + k, 0);
    expect(t.footer!.cells[2]).toBe(avg.toFixed(2));
    expect(avg.toFixed(2)).toBe('412.75');
  });
});
