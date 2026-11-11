// Storybook — the animated workflow picture book (/storybook).
//
// WHAT THIS IS: the whole business flow, screen by screen, in the shape the client already
// reviewed and liked (client-qa/developer-prompt-image/prompt-1.jpg … prompt-12.jpg and the
// "AKS Seafood" sheets they were modelled on): numbered steps, captioned phone screens, a navy
// deck tag. The app's own pages are not touched by this one — it reads chapter data and draws it.
//
// FRONTEND ONLY: every figure on every screen is a literal in lib/storybook/chapters/*. No
// Supabase call is made anywhere in this subtree, and there is no route from here into the real
// app — it is a review artifact, which is why it is reachable by every role.
//
// The chapter and step live in the URL (?c=receiving&s=2) so a reviewer can paste an exact screen
// into WhatsApp instead of describing it.

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Layers } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CHAPTERS } from '@/lib/storybook/chapters';
import { GROUP_META, GROUP_ORDER } from '@/lib/storybook/types';
import { TONE_SOLID } from '@/components/storybook/blocks';
import ChapterPlayer from '@/components/storybook/ChapterPlayer';

/** Autoplay dwell time per step: long enough to read the caption and watch the figures land. */
export default function Storybook() {
  const [params, setParams] = useSearchParams();
  const chapterId = params.get('c');
  const stepParam = Number(params.get('s') ?? '0');

  const chapter = useMemo(() => CHAPTERS.find((c) => c.id === chapterId) ?? null, [chapterId]);
  const stepIndex = chapter ? Math.min(Math.max(stepParam, 0), chapter.steps.length - 1) : 0;

  const openChapter = useCallback(
    (id: string | null) => {
      setParams(id ? { c: id, s: '0' } : {});
    },
    [setParams],
  );

  const goToStep = useCallback(
    (next: number) => {
      if (!chapter) return;
      const clamped = Math.min(Math.max(next, 0), chapter.steps.length - 1);
      setParams({ c: chapter.id, s: String(clamped) });
    },
    [chapter, setParams],
  );

  if (!chapter) return <ChapterIndex onOpen={openChapter} />;

  return <ChapterPlayer chapter={chapter} stepIndex={stepIndex} onStep={goToStep} onExit={() => openChapter(null)} />;
}

/* ------------------------------------------------------------------------------------------------
   Index — every chapter, grouped the way the deck groups them.
------------------------------------------------------------------------------------------------ */

function ChapterIndex({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-brand-navy">
          <Layers aria-hidden="true" className="h-5 w-5" />
          <h2 className="text-xl font-extrabold tracking-tight">The workflow, page by page</h2>
        </div>
        <p className="text-sm text-slate-500">
          Every screen of the business, drawn from the client&apos;s own reference decks. Open a
          chapter and flip through it — each screen carries the caption from the deck, and the
          last line of each chapter is what the system does behind it.
        </p>
      </header>

      {GROUP_ORDER.map((group) => {
        const meta = GROUP_META[group];
        const chapters = CHAPTERS.filter((c) => c.group === group);
        if (chapters.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', TONE_SOLID[meta.tone])}>
                {chapters.length} chapters
              </span>
              <h3 className="text-sm font-bold text-slate-800">{meta.label}</h3>
              <span className="text-xs text-slate-400">{meta.blurb}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold', TONE_SOLID[meta.tone])}>
                      {c.number}
                    </span>
                    <span className="truncate text-[13px] font-bold text-slate-900">{c.title}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-slate-500">{c.subtitle}</p>
                  <div className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.steps.length} steps</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.layout === 'desktop' ? 'desktop' : 'phone'}</span>
                    <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <footer className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
        This deck is a design artifact, not the app: nothing here reads the database, and no screen
        here is wired to a route. What each screen would need in order to work for real is written
        down in <span className="font-semibold text-slate-700">docs/BACKEND-REQUIREMENTS-phase-b.md</span>.
        Once the client locks the flow, these same chapters become the spec for the real build.
      </footer>
    </div>
  );
}

