// The 32 workflow chapters (the deck's original content), in presentation order. `index.ts` adds the persona
// journeys on top; the journeys import THIS file (not index.ts) so there is no import cycle.
//
// Original header: Storybook chapters — the whole deck, in presentation order.
//
// Each group is authored in its own file (see delegation/tasks/T10-storybook-workflow/
// CHAPTERS-BRIEF.md) so the flow can be reviewed and revised a group at a time. Chapter `number`
// is the deck number printed in the navy circle, so this index sorts by it rather than trusting
// the file order.

import type { Chapter } from '@/lib/storybook/types';

import { SPINE_CHAPTERS } from './spine';
import { CONTAINER_CHAPTERS } from './containers';
import { QUALITY_CHAPTERS } from './quality';
import { MONEY_CHAPTERS } from './money';
import { PEOPLE_CHAPTERS } from './people';
// The procurement desk is authored in three files: it is twelve desktop panels, which is more than
// one authoring session can hold at once, and splitting it also keeps a failure in one third from
// costing the other two.
import { PROCUREMENT_CHAPTERS_1 } from './procurement-desk-1';
import { PROCUREMENT_CHAPTERS_2 } from './procurement-desk-2';
import { PROCUREMENT_CHAPTERS_3 } from './procurement-desk-3';

export const PROCUREMENT_CHAPTERS: Chapter[] = [
  ...PROCUREMENT_CHAPTERS_1,
  ...PROCUREMENT_CHAPTERS_2,
  ...PROCUREMENT_CHAPTERS_3,
];

export const BASE_CHAPTERS: Chapter[] = [
  ...SPINE_CHAPTERS,
  ...CONTAINER_CHAPTERS,
  ...QUALITY_CHAPTERS,
  ...MONEY_CHAPTERS,
  ...PEOPLE_CHAPTERS,
  ...PROCUREMENT_CHAPTERS,
].sort((a, b) => a.number - b.number);

export { SPINE_CHAPTERS, CONTAINER_CHAPTERS, QUALITY_CHAPTERS, MONEY_CHAPTERS, PEOPLE_CHAPTERS };
