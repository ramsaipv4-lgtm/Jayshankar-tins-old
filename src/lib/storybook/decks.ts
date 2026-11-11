// The three review decks, and how to point from one to the same screen in another.
//
// Each deck is its own static site with its own repository, but they share ONE deep-link contract, so a link can
// land on exactly the same chapter and step in any of them:
//
//     <deck url>#/review?c=<chapter id>&s=<step index>[&embed=1]
//
// `embed=1` asks a deck to draw just the device and its caption (no header, rail or controls) — that is how the
// Compare page puts all three on one screen. The chapter ids are the same in every deck because they come from the
// same data (src/lib/storybook/chapters, including the persona journeys).
//
// Pure data and string-building: no React, no Tailwind, no antd — it is imported by all three decks.

export type DeckId = 'tailwind' | 'ant' | 'run';

/** Published locations (GitHub Pages project sites). The repository names follow the existing pair. */
export const DECKS: Record<DeckId, { label: string; short: string; url: string; repo: string; blurb: string }> = {
  tailwind: {
    label: 'Tailwind — the app\'s own look', short: 'Tailwind', url: 'https://sairampv98.github.io/Jayshankar-ui/', repo: 'Jayshankar-ui',
    blurb: 'What ships today. Calm, dense, familiar.',
  },
  ant: {
    label: 'Ant Design 6', short: 'Ant Design', url: 'https://sairampv98.github.io/Jayshankar-ui-antd/', repo: 'Jayshankar-ui-antd',
    blurb: 'A proven admin-product system: sidebar, steps, tables.',
  },
  run: {
    label: 'The Run', short: 'The Run', url: 'https://sairampv98.github.io/Jayshankar-ui-run/', repo: 'Jayshankar-ui-run',
    blurb: 'A third direction: warm ledger paper, serif numerals, documents that look like documents.',
  },
};

export const DECK_ORDER: DeckId[] = ['tailwind', 'ant', 'run'];

/** The same chapter and step in another deck. With no chapter, the deck's front door. */
export function deckHref(deck: DeckId, chapterId: string | null, step = 0, embed = false): string {
  const base = DECKS[deck].url;
  if (!chapterId) return base;
  return `${base}#/review?c=${encodeURIComponent(chapterId)}&s=${step}${embed ? '&embed=1' : ''}`;
}

/** The side-by-side page (lives in The Run's site). */
export function compareHref(chapterId: string | null, step = 0): string {
  return chapterId ? `${DECKS.run.url}#/compare?c=${encodeURIComponent(chapterId)}&s=${step}` : `${DECKS.run.url}#/compare`;
}
