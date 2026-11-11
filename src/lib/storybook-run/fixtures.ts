// One truck load, defined once. Every figure in the deck that talks about this load is derived from here, so the
// screens cannot disagree with each other (a comparison deck whose numbers drift is no longer a comparison — D74).
// All names and amounts are invented: vendors, vehicle and prices are literals, not data from the live system.

/** Indian digit grouping: 253600 → "2,53,600". */
export function inr(n: number): string {
  const s = Math.round(n).toString();
  if (s.length <= 3) return `₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${rest},${last3}`;
}

export const LOAD = { id: 'TL-0412', vehicle: 'TN-09 AB 1234', warehouse: 'Warehouse 1', driver: 'Selvam' } as const;

export interface Line { who: string; sku: string; kg: number; price: number; bill: string }

/** Four purchase lines on the trip. One bill per vendor (D64): Kavitha's two lines are one bill. */
export const LINES: Line[] = [
  { who: 'Murugan Marine', sku: 'Seer', kg: 120, price: 610, bill: 'B-5521' },
  { who: 'Ocean Traders', sku: 'Seer', kg: 200, price: 640, bill: 'B-5522' },
  { who: 'Kavitha Fisheries', sku: 'Seer', kg: 80, price: 655, bill: 'B-5523' },
  { who: 'Kavitha Fisheries', sku: 'Prawns', kg: 150, price: 520, bill: 'B-5523' },
];

export const SEER = LINES.filter((l) => l.sku === 'Seer');
export const PRAWNS = LINES.filter((l) => l.sku === 'Prawns');
export const sumKg = (ls: Line[]) => ls.reduce((s, l) => s + l.kg, 0);
export const sumValue = (ls: Line[]) => ls.reduce((s, l) => s + l.kg * l.price, 0);

/** D64 / §4.3.13 step 5: Σ(price × kg) ÷ Σ kg, over exactly the contributing lines. */
export const weightedAvg = (ls: Line[]) => sumValue(ls) / sumKg(ls);

export const SEER_KG = sumKg(SEER); // 400
export const SEER_VALUE = sumValue(SEER); // 253,600
export const SEER_AVG = weightedAvg(SEER); // 634
export const LOAD_KG = sumKg(LINES); // 550
export const LOAD_VALUE = sumValue(LINES); // 3,31,600

/** What the receiving person weighs (Act 4). Seer is 3 kg short; prawns tally exactly. */
export const WEIGH = {
  seer: { expected: SEER_KG, good: 385, spoiled: 12 },
  prawns: { expected: sumKg(PRAWNS), good: 148, spoiled: 2 },
} as const;
export const seerCounted = WEIGH.seer.good + WEIGH.seer.spoiled; // 397
export const seerShort = WEIGH.seer.expected - seerCounted; // 3

export const kgRow = (l: Line) => `${l.kg} kg × ₹${l.price}`;
