// Storybook chapters — everything the decks play: the 32 workflow chapters plus the persona journeys.
//
// `base.ts` holds the original 32 (authored in its own files per group, see
// delegation/tasks/T10-storybook-workflow/CHAPTERS-BRIEF.md). The journeys ("walk it as someone", group
// 'journeys') are assembled from those chapters' own screens plus a few of their own — see
// src/lib/storybook/journeys/index.ts. Chapter `number` is the deck number, so this index sorts by it.

import type { Chapter } from '@/lib/storybook/types';

import { BASE_CHAPTERS, PROCUREMENT_CHAPTERS } from './base';
import { JOURNEY_CHAPTERS } from '@/lib/storybook/journeys';

export const CHAPTERS: Chapter[] = [...BASE_CHAPTERS, ...JOURNEY_CHAPTERS].sort((a, b) => a.number - b.number);

export { BASE_CHAPTERS, JOURNEY_CHAPTERS, PROCUREMENT_CHAPTERS };
export { SPINE_CHAPTERS, CONTAINER_CHAPTERS, QUALITY_CHAPTERS, MONEY_CHAPTERS, PEOPLE_CHAPTERS } from './base';
