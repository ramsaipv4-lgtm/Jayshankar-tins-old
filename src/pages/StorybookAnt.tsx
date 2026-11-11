// StorybookAnt — the second review deck: the same 32 chapters, presented as an Ant Design workbench.
//
// WHY IT EXISTS: the client is choosing a design language (D67 in SPEC-AMENDMENT-v4-plan-md.md). Deck 1
// (pages/Storybook.tsx) shows the chapters through the app's own Tailwind system. This page shows the
// identical chapter DATA — same chapters, steps, captions, figures and device-frame drawings — through
// a shell built from Ant Design's own patterns (see components/storybook-ant/deck/AntDeck.tsx).
//
// HISTORY: this file used to hand the chapter to the shared Tailwind ChapterPlayer with an Ant block
// renderer injected. That produced a deck that looked like deck 1 with Ant widgets inside it, which is
// a poor test of "what would the app be like in Ant Design". The shell is now Ant-native; only the data
// and the screen drawings are shared. (A consequence: the two decks now differ in navigation and
// interaction, not just styling — which is exactly what the client is being asked to compare.)
//
// NOT ROUTED IN THE APP. No `#/storybook-ant` route and no runtime toggle: plan.md's own D2 requires
// the two systems never to share one screen, and antd is imported only by files under
// components/storybook-ant/ — so the app bundle is untouched. Reachable only through
// src/storybook-ant-main.tsx → `npm run build:storybook-ant` → dist-storybook-ant/.

import AntDeck from '@/components/storybook-ant/deck/AntDeck';

export default function StorybookAnt({ tailwindDeck }: { tailwindDeck: string }) {
  return <AntDeck tailwindDeck={tailwindDeck} />;
}
