// The app's own surface — the Tailwind renderer, and ChapterPlayer's default.
//
// This file is the reason the Ant deck could be added without touching the app's build: the default
// surface is assembled here from the files that already existed, and ChapterPlayer imports this
// rather than the individual renderers. Nothing under components/storybook-ant/ is referenced here,
// so `antd` cannot reach the app bundle through the player.
//
// See src/lib/storybook/surface.ts for why the seam exists, and docs/REVIEW-BUILD.md §8 for the
// second deck.

import type { StorybookSurface } from '@/lib/storybook/surface';
import { StorybookBlocks } from '@/components/storybook/blocks';
import PhoneFrame from '@/components/storybook/PhoneFrame';
import DesktopFrame from '@/components/storybook/DesktopFrame';

export const APP_SURFACE: StorybookSurface = {
  label: 'Tailwind',
  Blocks: StorybookBlocks,
  PhoneFrame,
  DesktopFrame,
};