// StorybookAntReview — the standalone review page for the Ant Design deck.
//
// Header, navigation and both pages (the chapter index and the chapter view) now live in
// components/storybook-ant/deck/AntDeck.tsx; this file only supplies the one deck-specific fact, where
// the Tailwind deck is published, so the side-by-side link works.

import StorybookAnt from './StorybookAnt';

/** Deck 1, for the side-by-side. Set to the published Tailwind deck's URL when it differs. */
const TAILWIND_DECK = 'https://sairampv98.github.io/Jayshankar-ui/';

export default function StorybookAntReview() {
  return <StorybookAnt tailwindDeck={TAILWIND_DECK} />;
}
