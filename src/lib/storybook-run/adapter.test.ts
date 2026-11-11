// The adapter is what makes three decks comparable: the same chapter id, step and caption must arrive intact, and
// nothing the shared vocabulary can say may be silently dropped on the way.

import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '@/lib/storybook/chapters';
import { ALL_ACTS, ACT_BY_ID, CHAPTER_ACTS, COLLECTIONS, DAY_ACTS, WALK_ACTS } from './acts';
import { convertBlock } from './from-chapters';
import { parseHash, toHash } from '../../components/storybook-run/hooks';
import { deckHref, compareHref, DECKS } from '@/lib/storybook/decks';

describe('chapters → acts', () => {
  it('every shared chapter becomes exactly one act with the same id, step count and captions', () => {
    expect(CHAPTER_ACTS).toHaveLength(32);
    expect(WALK_ACTS).toHaveLength(12);
    for (const c of CHAPTERS) {
      const a = ACT_BY_ID[c.id];
      expect(a, c.id).toBeDefined();
      expect(a.beats).toHaveLength(c.steps.length);
      c.steps.forEach((s, i) => expect(a.beats[i].story, `${c.id}#${i}`).toBe(s.caption));
    }
  });

  it('ids are unique across walks, the v3/v4 day and chapters (they share one address space)', () => {
    expect(new Set(ALL_ACTS.map((a) => a.id)).size).toBe(ALL_ACTS.length);
    expect(ALL_ACTS).toHaveLength(12 + 8 + 32);
    expect(COLLECTIONS.map((c) => c.id)).toEqual(['walk', 'day', 'chapter']);
  });

  it('no source block is dropped: each converts to at least one block, on every screen', () => {
    for (const c of CHAPTERS) for (const s of c.steps) {
      const out = s.screen.blocks.flatMap(convertBlock);
      expect(out.length, `${c.id}/${s.id}`).toBeGreaterThanOrEqual(s.screen.blocks.length);
    }
  });

  it('a device matches its chapter: desktop chapters draw desktop frames, the rest phones', () => {
    for (const c of CHAPTERS) for (const b of ACT_BY_ID[c.id].beats) expect(b.states[0].views[0].device).toBe(c.layout ?? 'phone');
  });

  it('locked ("hidden from receiving") fields stay unsent: redacted, with no value carried over', () => {
    const locked = CHAPTERS.flatMap((c) => c.steps).flatMap((s) => s.screen.blocks).filter((b) => b.kind === 'fields' && b.items.some((i) => i.locked));
    expect(locked.length).toBeGreaterThan(0);
    for (const b of locked) {
      const kv = convertBlock(b)[0];
      expect(kv.k).toBe('kv');
      if (kv.k !== 'kv') continue;
      for (const it of kv.items) if (it.redact) expect(it.v).toBe('');
    }
  });

  it('the receiving walk carries no vendor or price in its converted data either', () => {
    const json = JSON.stringify(ACT_BY_ID['walk-receiver']);
    expect(json).not.toMatch(/Vendor [ABC]|Annamalai|₹/);
  });

  it('persona walks keep their role on the device badge; plain chapters are labelled as samples', () => {
    expect(ACT_BY_ID['walk-receiver'].beats[0].states[0].views[0].role).toBe('receiver');
    expect(ACT_BY_ID['walk-buyer'].beats[0].states[0].views[0].role).toBe('rep');
    expect(ACT_BY_ID['receiving'].beats[0].states[0].views[0].role).toBe('app');
  });

  it('the v3/v4 day is still the eight native acts', () => {
    expect(DAY_ACTS.map((a) => a.group)).toEqual(Array(8).fill('day'));
  });
});

describe('addresses shared by the three decks', () => {
  it('this deck understands the shared #/review?c=&s= address, with and without embed', () => {
    expect(parseHash('#/review?c=walk-buyer&s=3')).toEqual({ page: 'act', act: 'walk-buyer', beat: 3, state: null, embed: false });
    expect(parseHash('#/review?c=receiving&s=0&embed=1')).toMatchObject({ page: 'act', act: 'receiving', embed: true });
    expect(parseHash('#/?c=grading&s=2')).toMatchObject({ page: 'act', act: 'grading', beat: 2 });
  });
  it('and its own addresses, the compare page, and falls back to home', () => {
    expect(parseHash('#/act/scale?b=1&s=flag')).toEqual({ page: 'act', act: 'scale', beat: 1, state: 'flag', embed: false });
    expect(parseHash('#/compare?c=walk-grader&s=4')).toEqual({ page: 'compare', c: 'walk-grader', s: 4 });
    expect(parseHash('#/compare')).toEqual({ page: 'compare', c: null, s: 0 });
    expect(parseHash('')).toEqual({ page: 'home' });
    expect(parseHash('#/nonsense')).toEqual({ page: 'home' });
  });
  it('round-trips', () => {
    for (const h of ['#/act/scale?b=1&s=flag', '#/act/modes', '#/compare?c=walk-buyer&s=2', '#/']) expect(toHash(parseHash(h))).toBe(h);
  });
  it('builds the same contract for every deck, and the repo names follow the existing pair', () => {
    expect(deckHref('tailwind', 'walk-buyer', 2)).toBe('https://sairampv98.github.io/Jayshankar-ui/#/review?c=walk-buyer&s=2');
    expect(deckHref('ant', 'walk-buyer', 2, true)).toBe('https://sairampv98.github.io/Jayshankar-ui-antd/#/review?c=walk-buyer&s=2&embed=1');
    expect(deckHref('run', null)).toBe(DECKS.run.url);
    expect(compareHref('walk-buyer', 2)).toBe('https://sairampv98.github.io/Jayshankar-ui-run/#/compare?c=walk-buyer&s=2');
    expect(Object.values(DECKS).map((d) => d.repo)).toEqual(['Jayshankar-ui', 'Jayshankar-ui-antd', 'Jayshankar-ui-run']);
  });
});
