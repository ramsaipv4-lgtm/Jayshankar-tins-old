// Ant Design tokens for the second review deck (the "Ant variant").
//
// WHY A SECOND DECK: `plan.md` D2 is an open decision — the shipped app is Tailwind with its own
// components, while the procurement-desk chapters (21–32) were drawn in an Ant-style look. The
// client wants to see the mobile screens in that other language before choosing. Rather than
// guess, this deck renders the SAME 32 chapters of data with Ant Design 6 components, so the two
// options can be compared screen for screen, caption for caption.
//
// D2 also says: never mix two systems on one screen. That is why this deck is NOT routed inside the
// app — it is a separate build (storybook-ant.html → dist-storybook-ant/), so the app bundle never
// carries antd and no real screen can accidentally end up half-Tailwind, half-Ant.
//
// Palette: Ant Design's own values, not ours. That is the point of the comparison — the primary is
// Ant blue, not the brand navy the first deck uses.

import type { ThemeConfig } from 'antd';

import type { Tone } from '@/lib/storybook/types';

/** Ant Design's blue. The first deck's equivalent is the brand navy `#0e2b5e`. */
export const ANT_PRIMARY = '#1677ff';

/** Tone → Ant palette. Ant's own swatches (blue/cyan/green/gold/red/geekblue/purple/gray). */
export const ANT_HEX: Record<Tone, string> = {
  navy: '#1677ff', // Ant blue is the primary in this variant; see the note above
  teal: '#13c2c2',
  emerald: '#52c41a',
  amber: '#faad14',
  red: '#ff4d4f',
  sky: '#40a9ff',
  purple: '#722ed1',
  indigo: '#2f54eb',
  slate: '#8c8c8c',
};

/** Tone → the semantic status the Ant components want (Alert type, Tag color, Result status). */
export const ANT_STATUS: Record<Tone, 'success' | 'info' | 'warning' | 'error'> = {
  navy: 'info',
  teal: 'info',
  emerald: 'success',
  amber: 'warning',
  red: 'error',
  sky: 'info',
  purple: 'info',
  indigo: 'info',
  slate: 'info',
};

/** Tinted background for soft cards/chips, derived from ANT_HEX via Ant's own tag colors. */
export const ANT_TAG_COLOR: Record<Tone, string> = {
  navy: 'blue',
  teal: 'cyan',
  emerald: 'green',
  amber: 'gold',
  red: 'red',
  sky: 'blue',
  purple: 'purple',
  indigo: 'geekblue',
  slate: 'default',
};

/** Sizes shared with the first deck so the two are compared at identical geometry. */
export const ANT_PHONE_WIDTH = 340;
export const ANT_PHONE_HEIGHT = 600;

export const antTheme: ThemeConfig = {
  token: {
    colorPrimary: ANT_PRIMARY,
    colorInfo: ANT_PRIMARY,
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorText: 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    // 14px, matching plan.md §8.1's "base 14px on desktop and 16px on worker screens". The phone
    // frames are drawn at 1:1, so the base stays 14 here and worker screens can raise it.
    fontSize: 14,
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    // The deck is drawn inside a 340×600 phone, so Ant's default control heights and paddings are
    // tightened — otherwise a four-block screen overflows the frame and the caption no longer lines
    // up with the first deck's steps.
    Card: { paddingLG: 12, bodyPadding: 12, headerHeight: 34, headerFontSize: 14 },
    Table: { cellPaddingBlockSM: 6, cellPaddingInlineSM: 8, headerBg: '#fafafa', headerSplitColor: 'transparent', fontSize: 12 },
    Descriptions: { itemPaddingBottom: 6, labelBg: 'transparent' },
    List: { itemPaddingSM: '8px 0' },
    Timeline: { itemPaddingBottom: 8, tailColor: '#e5e7eb' },
    Steps: { iconSize: 22 },
    Button: { controlHeight: 36, fontWeight: 600 },
  },
};