// StorybookReview — the *public* shell for the picture book, so the client can be sent one link.
//
// WHY IT IS SEPARATE FROM /storybook:
// In-app, the deck renders inside Layout, whose header shows a notification bell and a sign-out
// button — both of which need a signed-in user. A client opening a link has no account, so
// /storybook would break on arrival. This shell is the deck with its own minimal navy header:
// no bell, no sign-out, no navigation into the rest of the app, nothing fetched.
//
// It is safe to serve unauthenticated because the whole storybook subtree is static data:
// 32 chapters of literals in src/lib/storybook/chapters/, no Supabase call anywhere in it. The
// client's own records are not involved — every name and figure in the deck is a sample.
//
// Reachable at #/review (see the bypass in App.tsx). Not linked from any nav.

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Storybook from './Storybook';
import { DECKS, DECK_ORDER, compareHref, deckHref } from '@/lib/storybook/decks';

export default function StorybookReview() {
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const c = params.get('c');
  const s = Number(params.get('s') ?? '0') || 0;
  // `embed=1` (used by the Compare page) draws only the device and its caption: everything marked data-chrome hides.
  useEffect(() => {
    if (embed) document.documentElement.setAttribute('data-embed', '1');
    else document.documentElement.removeAttribute('data-embed');
  }, [embed]);
  return (
    <div className="min-h-full bg-slate-100">
      <header data-chrome className="sticky top-0 z-10 bg-brand-navy px-4 py-2.5 text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[15px] font-extrabold tracking-[0.12em]">JAYSHANKAR</span>
          <span className="hidden truncate text-[11px] text-white/70 sm:inline">Workflow review</span>
          {/* The three decks, one click apart, landing on this very screen. */}
          <nav aria-label="The same screen in the other looks" className="ml-auto flex items-center gap-1 text-[10.5px] font-bold">
            <span className="mr-0.5 hidden text-white/60 sm:inline">Same screen in</span>
            {DECK_ORDER.map((d) =>
              d === 'tailwind' ? (
                <span key={d} className="rounded-full bg-white px-2.5 py-1 text-brand-navy" aria-current="page">{DECKS[d].short}</span>
              ) : (
                <a key={d} href={deckHref(d, c, s)} className="rounded-full bg-white/15 px-2.5 py-1 text-white hover:bg-white/25">{DECKS[d].short}</a>
              ),
            )}
            <a href={compareHref(c, s)} className="rounded-full border border-white/40 px-2.5 py-1 text-white hover:bg-white/15">Compare ⇄</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
        <Storybook />
      </main>

      <footer data-chrome className="px-4 pb-8 pt-2">
        <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
          <strong className="text-slate-700">How to read this.</strong> Every screen is a design
          proposal, not the working app — the figures are samples. Screens are numbered, so feedback
          can be given as “chapter 3, step 2” and it will be unambiguous. Tap <em>Play</em> on any
          chapter to watch it run through on its own, or use the spread at the bottom to jump
          between screens.
        </div>
      </footer>
    </div>
  );
}
