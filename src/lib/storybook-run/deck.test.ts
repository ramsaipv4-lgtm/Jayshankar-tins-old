// Invariants of "The Run". A review deck whose figures drift, or whose "blind" screens quietly carry the data they
// claim to hide, is worse than no deck — so the things that make it trustworthy are tested, not eyeballed.

import { describe, expect, it } from 'vitest';
import { ACTS, ACT_BY_ID } from './acts';
import { DECISIONS, DECISION_ORDER } from './decisions';
import { LINES, LOAD_KG, LOAD_VALUE, SEER, SEER_AVG, SEER_KG, SEER_VALUE, WEIGH, inr, seerCounted, seerShort, weightedAvg } from './fixtures';
import type { Block, Screen, View } from './types';

const views: { act: string; beat: string; state: string; v: View; rpcCaller?: string }[] = [];
for (const a of ACTS) for (const b of a.beats) for (const s of b.states) for (const v of s.views) views.push({ act: a.id, beat: b.id, state: s.id, v, rpcCaller: s.rpc?.caller });

function blocksOf(sc: Screen): Block[] {
  return [...sc.blocks, ...(sc.sheet?.blocks ?? [])];
}
const VENDORS = [...new Set(LINES.map((l) => l.who))];

describe('structure', () => {
  it('has the eight acts, in the order of the day, with unique ids', () => {
    expect(ACTS.map((a) => a.id)).toEqual(['modes', 'plan', 'road', 'scale', 'stamps', 'money', 'who', 'look']);
    expect(new Set(ACTS.map((a) => a.id)).size).toBe(ACTS.length);
    ACTS.forEach((a, i) => expect(a.n).toBe(i + 1));
  });
  it('every beat and state has an id that is unique in its parent, and at least one view', () => {
    for (const a of ACTS) {
      expect(new Set(a.beats.map((b) => b.id)).size, `${a.id} beat ids`).toBe(a.beats.length);
      for (const b of a.beats) {
        expect(b.states.length, `${a.id}/${b.id}`).toBeGreaterThan(0);
        expect(new Set(b.states.map((s) => s.id)).size, `${a.id}/${b.id} state ids`).toBe(b.states.length);
        for (const s of b.states) expect(s.views.length, `${a.id}/${b.id}/${s.id}`).toBeGreaterThan(0);
      }
    }
  });
  it('every decision a beat cites exists, and every decision D63–D76 is drawn somewhere or says why not', () => {
    for (const a of ACTS) for (const b of a.beats) for (const d of b.decisions) expect(DECISIONS[d], `${a.id}/${b.id} cites ${d}`).toBeDefined();
    const cited = new Set(ACTS.flatMap((a) => a.beats.flatMap((b) => b.decisions)));
    for (const id of DECISION_ORDER) if (DECISIONS[id].build !== 'none') expect(cited.has(id), `${id} is never drawn`).toBe(true);
    expect(DECISION_ORDER).toHaveLength(14);
  });
  it('decisions that name an act point at one that exists and lists them', () => {
    for (const id of DECISION_ORDER) {
      const d = DECISIONS[id];
      if (!d.act) continue;
      expect(ACT_BY_ID[d.act], `${id} → ${d.act}`).toBeDefined();
      expect(ACT_BY_ID[d.act].decisions, `${d.act} should list ${id}`).toContain(id);
    }
  });
});

describe('the load\'s arithmetic', () => {
  it('weighted average is Σ(price × kg) ÷ Σ kg over exactly the Seer lines (§8.19b)', () => {
    expect(SEER_KG).toBe(400);
    expect(SEER_VALUE).toBe(253_600);
    expect(SEER_AVG).toBe(634);
    expect(weightedAvg(SEER)).toBe(SEER_VALUE / SEER_KG);
    expect(LOAD_KG).toBe(550);
    expect(LOAD_VALUE).toBe(331_600);
  });
  it('the weighing adds up: 385 good + 12 spoiled = 397 counted, 3 short', () => {
    expect(seerCounted).toBe(397);
    expect(seerShort).toBe(3);
    expect(WEIGH.prawns.good + WEIGH.prawns.spoiled).toBe(WEIGH.prawns.expected);
  });
  it('Indian digit grouping', () => {
    expect(inr(253_600)).toBe('₹2,53,600');
    expect(inr(331_600)).toBe('₹3,31,600');
    expect(inr(999)).toBe('₹999');
    expect(inr(1000)).toBe('₹1,000');
  });
  it('every visible merge block states the average its own streams produce', () => {
    for (const { v } of views) for (const b of blocksOf(v.screen)) if (b.k === 'merge' && !b.hidden) {
      const kg = b.streams.reduce((s, x) => s + x.kg, 0);
      const avg = b.streams.reduce((s, x) => s + x.kg * x.price, 0) / kg;
      expect(b.result).toBe(`₹${avg.toFixed(2)}`);
    }
  });
  it('every table with a footer has as many cells in each row as in its head', () => {
    for (const { v } of views) for (const b of blocksOf(v.screen)) if (b.k === 'table') {
      for (const r of b.rows) expect(r.c.length).toBe(b.head.length);
      if (b.foot) expect(b.foot.length).toBe(b.head.length);
    }
  });
});

describe('the deck\'s thesis: blind means the data was never there (D65, D68)', () => {
  const blind = views.filter(({ v, state, act, beat }) => v.role === 'receiver' || (act === 'scale' && beat === 'blind' && state === 'flag') || (act === 'money' && state === 'others'));
  it('has blind views to check', () => expect(blind.length).toBeGreaterThanOrEqual(5));
  it('no blind view contains a vendor name anywhere in its data', () => {
    for (const { act, beat, state, v } of blind) {
      const json = JSON.stringify(v.screen);
      for (const name of VENDORS) expect(json.includes(name), `${act}/${beat}/${state}: ${v.role} view contains "${name}"`).toBe(false);
    }
  });
  it('no blind manifest or merge carries a price, and every blind manifest has an empty who', () => {
    for (const { act, beat, state, v } of blind) for (const b of blocksOf(v.screen)) {
      const where = `${act}/${beat}/${state}`;
      if (b.k === 'manifest') {
        expect(b.redactWho, where).toBe(true);
        expect(b.redactPrice, where).toBe(true);
        for (const s of b.stops) { expect(s.who, where).toBe(''); expect(s.price, where).toBeUndefined(); }
      }
      if (b.k === 'merge') {
        expect(b.hidden, where).toBe(true);
        expect(b.result, where).not.toMatch(/\d/);
        for (const s of b.streams) { expect(s.who, where).toBe(''); expect(s.price, where).toBe(0); }
      }
    }
  });
  it('every database panel for a blind caller lists vendor and price as absent', () => {
    for (const a of ACTS) for (const b of a.beats) for (const s of b.states) {
      if (!s.rpc || !/receiving-storage|receiving_blind/.test(s.rpc.caller)) continue;
      const keys = Object.fromEntries(s.rpc.returns.map((r) => [r.key, r.present]));
      expect(keys.vendor_name, `${a.id}/${b.id}/${s.id}`).toBe(false);
      expect(keys.price_per_kg_paid, `${a.id}/${b.id}/${s.id}`).toBe(false);
    }
  });
  it('the admin\'s panel for the same function does list them (§8.20c)', () => {
    const admin = ACTS.flatMap((a) => a.beats).flatMap((b) => b.states).find((s) => s.rpc?.caller === 'admin' && s.rpc.fn.startsWith('confirm_truck_load_receiving'));
    expect(admin).toBeDefined();
    expect(admin!.rpc!.returns.some((r) => r.key === 'price_per_kg_paid' && r.present)).toBe(true);
  });
});

describe('citations (D74): the example addresses resolve', () => {
  it('every #/act/x?b=N&s=Y shown in the deck points at a real act, beat and state', () => {
    const found: string[] = [];
    for (const { v } of views) for (const b of blocksOf(v.screen)) if (b.k === 'list') for (const it of b.items) if (it.s && it.s.startsWith('#/act/')) found.push(it.s);
    expect(found.length).toBeGreaterThanOrEqual(4);
    for (const link of found) {
      const m = /^#\/act\/([a-z0-9-]+)\?b=(\d+)&s=([a-z0-9-]+)$/.exec(link);
      expect(m, link).not.toBeNull();
      const act = ACT_BY_ID[m![1]];
      expect(act, link).toBeDefined();
      const beat = act.beats[Number(m![2])];
      expect(beat, link).toBeDefined();
      expect(beat.states.some((s) => s.id === m![3]), link).toBe(true);
    }
  });
});
