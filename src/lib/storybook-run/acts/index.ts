// The day, in order — plus the shared content drawn in this deck's look.
//
//   DAY_ACTS   the eight v3/v4 acts, authored natively in this model, in the order they happen on the clock
//   WALK_ACTS  the twelve persona journeys  } converted from the SHARED chapter data (decks 1 and 2 play the same),
//   CHAPTER_ACTS the 32 workflow chapters   } so identical content can be compared across the three looks
//
// `ACTS` (= DAY_ACTS) is kept as the name the v3/v4 tests and the deep-dive use.
import type { Act } from '../types';
import { modes } from './act1-modes';
import { plan } from './act2-plan';
import { road } from './act3-road';
import { scale } from './act4-scale';
import { stamps } from './act5-stamps';
import { money } from './act6-money';
import { who } from './act7-who';
import { look } from './act8-look';
import { CHAPTER_ACTS, WALK_ACTS } from '../from-chapters';

export const DAY_ACTS: Act[] = [modes, plan, road, scale, stamps, money, who, look].map((a) => ({ ...a, group: 'day' as const }));
export const ACTS = DAY_ACTS;
export { CHAPTER_ACTS, WALK_ACTS };

export const ALL_ACTS: Act[] = [...WALK_ACTS, ...DAY_ACTS, ...CHAPTER_ACTS];
export const ACT_BY_ID: Record<string, Act> = Object.fromEntries(ALL_ACTS.map((a) => [a.id, a]));

export type CollectionId = 'walk' | 'day' | 'chapter';
export const COLLECTIONS: { id: CollectionId; label: string; blurb: string; acts: Act[] }[] = [
  { id: 'walk', label: 'Walk it as someone', blurb: 'Twelve people, each on the device they really use.', acts: WALK_ACTS },
  { id: 'day', label: 'The v3 & v4 day (deep dive)', blurb: 'One truck load, planning to payment, seen from several seats.', acts: DAY_ACTS },
  { id: 'chapter', label: 'Every chapter', blurb: 'The 32 workflow chapters — identical content to the other two decks.', acts: CHAPTER_ACTS },
];
export const collectionOf = (actId: string) => COLLECTIONS.find((c) => c.acts.some((a) => a.id === actId));
