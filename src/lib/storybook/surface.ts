// The design-language seam for the picture book.
//
// WHY THIS EXISTS: the deck is 32 chapters of screen *data* (src/lib/storybook/). A "surface" is the pair
// that draws one screen of it — the device frame plus the renderer for the blocks inside — and there are
// two: Tailwind (the app's own look) and Ant Design 6. Both decks share the chapters and the screen
// drawings, which is what makes the client's comparison a comparison instead of two different apps.
// (Until 2026-10-02 the two decks also shared one player; deck 2 now has its own Ant-native shell, in
// components/storybook-ant/deck/, and only the Tailwind deck's ChapterPlayer takes a surface.)
//
// The surface is passed IN to ChapterPlayer rather than selected inside it. That is deliberate: a
// static import of anything under components/storybook-ant/ would pull antd into the app bundle, and
// the open decision (D67) is precisely whether that should ever happen. Injection means the app's
// build does not change at all, and the Ant deck's entry is the only place that names antd.
//
// TYPES ONLY. Nothing in this file may import a renderer — it is imported by the player, which is
// imported by the app.

import type { ComponentType } from 'react';

import type { Block } from './types';
import type { PhoneFrameProps } from '@/components/storybook/PhoneFrame';
import type { DesktopFrameProps } from '@/components/storybook/DesktopFrame';

export interface StorybookSurface {
  /** Names the design language in the UI and in screenshots, e.g. `Tailwind` / `Ant Design 6`. */
  label: string;
  /** Draws one screen's blocks. Same props for both decks, so the swap is total. */
  Blocks: ComponentType<{ blocks: Block[] }>;
  PhoneFrame: ComponentType<PhoneFrameProps>;
  DesktopFrame: ComponentType<DesktopFrameProps>;
}
