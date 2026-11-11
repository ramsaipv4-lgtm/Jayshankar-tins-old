// ChapterPlayer — one chapter of the picture book: a big stage, a filmstrip of its steps, and the
// controls that flip between them.
//
// The "page turn" is animate-sb-page, keyed on the step index so React remounts the frame on every
// step change — which is also what replays the per-block stagger and the figure count-ups inside
// each screen. Nothing here is a video: the animation is the difference between two renders.

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Grid2x2, Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { GROUP_META, type Chapter, type ScreenSpec } from '@/lib/storybook/types';
import { TONE_SOLID } from '@/components/storybook/blocks';
import { PHONE_HEIGHT, PHONE_WIDTH } from '@/components/storybook/PhoneFrame';
import { DESKTOP_HEIGHT, DESKTOP_WIDTH } from '@/components/storybook/DesktopFrame';
import { APP_SURFACE } from '@/components/storybook/app-surface';
import type { StorybookSurface } from '@/lib/storybook/surface';

/** Autoplay dwell per step. Long enough to read the caption and watch the figures land. */
const AUTOPLAY_MS = 3800;

/**
 * How a frame is scaled at each breakpoint. A phone is PHONE_WIDTH+12 by PHONE_HEIGHT+12 including
 * its bezel, the desktop panel DESKTOP_WIDTH+2 by DESKTOP_HEIGHT+2 — the box below is exactly that
 * scaled size, so nothing jumps when a breakpoint changes the scale.
 *
 * The numbers are written out as literals on purpose: Tailwind only generates a class it can see in
 * the source, so `scale-${x}` would silently produce no CSS. Edit them together with FRAME_SIZE
 * below (and if you change a scale, change the matching h-/w- literals by the same factor — the
 * box is what reserves the space, so the two drifting apart is what causes overflow).
 */
const FRAME = {
  phone: {
    // Phones render the frame at 90% — on a 414px screen that is a 317px frame, so the design text
    // stays near full size and legible. (It used to be 62%, which made a phone-inside-a-phone at
    // ~8px text: technically fitted, practically unreadable.)
    scale: 'scale-[0.9] sm:scale-[0.82] lg:scale-100',
    box: 'h-[551px] w-[317px] sm:h-[502px] sm:w-[289px] lg:h-[612px] lg:w-[352px]',
  },
  desktop: {
    scale: 'scale-[0.3] lg:scale-[0.52]',
    box: 'h-[217px] w-[355px] lg:h-[376px] lg:w-[615px]',
  },
} as const;

/** Kept separate from FRAME so the literals above can be checked against real frame sizes. */
const FRAME_SIZE = {
  phone: { width: PHONE_WIDTH + 12, height: PHONE_HEIGHT + 12 },
  desktop: { width: DESKTOP_WIDTH + 2, height: DESKTOP_HEIGHT + 2 },
} as const;

/** Filmstrip thumbnails are a single fixed scale per layout, so they can be computed, not hardcoded. */
const THUMB_SCALE = { phone: 0.245, desktop: 0.15 } as const;

export interface ChapterPlayerProps {
  chapter: Chapter;
  stepIndex: number;
  onStep: (index: number) => void;
  onExit: () => void;
  /**
   * The deck's design language. Defaults to the app's own (Tailwind) renderer, so every existing
   * call site behaves exactly as before; the Ant deck's entry is the only caller that passes
   * anything else. Injected rather than chosen in here, so `antd` cannot reach the app bundle
   * through this file — see src/lib/storybook/surface.ts.
   */
  surface?: StorybookSurface;
}

export default function ChapterPlayer({
  chapter,
  stepIndex,
  onStep,
  onExit,
  surface = APP_SURFACE,
}: ChapterPlayerProps) {
  const [playing, setPlaying] = useState(false);
  // Desktop panels are 1180px wide and designed for a laptop. Squeezed onto a phone they fit the
  // screen at 30%, which shows the shape of the screen but not a word of it — and the procurement
  // desk chapters are exactly the ones worth reading on a phone. So desktop chapters get a
  // magnify toggle: the panel renders at 100% inside a horizontally scrollable strip and the
  // reader drags across it. Phone layouts need none of this (they are already phone-sized).
  const [magnified, setMagnified] = useState(false);
  const meta = GROUP_META[chapter.group];
  const last = chapter.steps.length - 1;
  const step = chapter.steps[stepIndex];
  const layout = chapter.layout ?? 'phone';
  const canMagnify = layout === 'desktop';

  const next = useCallback(() => {
    if (stepIndex < last) onStep(stepIndex + 1);
    else setPlaying(false);
  }, [stepIndex, last, onStep]);

  const prev = useCallback(() => {
    if (stepIndex > 0) onStep(stepIndex - 1);
  }, [stepIndex, onStep]);

  const restart = useCallback(() => {
    onStep(0);
    setPlaying(true);
  }, [onStep]);

  // Autoplay. Re-armed on every step change, cleared on pause/unmount, so pausing is immediate.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(next, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, next, stepIndex]);

  // Keyboard: the deck gets shown on a laptop during review calls, so arrows and space must work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setPlaying(false); next(); }
      else if (e.key === 'ArrowLeft') { setPlaying(false); prev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === 'Escape') { onExit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onExit]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* Chapter header — the deck's numbered circle, then title and subtitle. */}
      <header data-chrome className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 shadow-sm active:scale-[0.98]"
        >
          <Grid2x2 aria-hidden="true" className="h-3.5 w-3.5" />
          All chapters
        </button>
        <span className={cn('grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold', TONE_SOLID[meta.tone])}>
          {chapter.number}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-extrabold leading-tight text-slate-900">{chapter.title}</h2>
          <p className="truncate text-[11.5px] text-slate-500">{chapter.subtitle}</p>
        </div>
        <span className="ml-auto rounded-full bg-brand-navy px-3 py-1 text-[9.5px] font-bold uppercase tracking-wider text-white">
          {chapter.tag}
        </span>
      </header>

      {/* Autoplay progress line — fills over exactly one dwell so the pace is visible. */}
      <div data-chrome className="h-0.5 overflow-hidden rounded-full bg-slate-200">
        <div
          key={`bar-${stepIndex}-${playing}`}
          className={cn('h-full origin-left rounded-full bg-brand-navy', playing && 'animate-sb-grow-x')}
          style={
            playing
              ? { animationDuration: `${AUTOPLAY_MS}ms`, animationTimingFunction: 'linear' }
              : { width: '100%' }
          }
        />
      </div>

      {/* Stage: the active step at full size, re-enter keyed by index so the page turn replays. */}
      <div className={cn('flex flex-col gap-3', magnified ? 'items-stretch overflow-x-auto pb-1' : 'items-center')}>
        <div className={cn('relative', magnified ? 'h-[720px] w-[1180px] shrink-0' : FRAME[layout].box)}>
          {/* Two wrappers on purpose. The outer one scales; the inner one animates. A single
              element cannot do both: `animate-sb-page` fills forward with its own transform
              (perspective + rotateY + scale(1)), which would override any `scale-*` utility on the
              same node — that is how the desktop panel silently rendered at its full 1182px inside
              a 615px box. */}
          <div
            key={`${chapter.id}-${stepIndex}`}
            className={cn(
              'absolute left-1/2 top-0 origin-top -translate-x-1/2',
              magnified ? 'scale-100' : FRAME[layout].scale,
            )}
          >
            <div className="animate-sb-page">
              <FrameSurface layout={layout} screen={step.screen} surface={surface} />
            </div>
          </div>
        </div>

        {/* Caption: step number in the deck's navy circle, then the deck's caption line. */}
        <div className="flex max-w-2xl items-start gap-2.5 self-center">
          <span
            className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold', TONE_SOLID[meta.tone])}
          >
            {stepIndex + 1}
          </span>
          <p key={`cap-${stepIndex}`} className="animate-sb-rise text-[13px] leading-snug text-slate-700">
            {step.caption}
          </p>
        </div>

        {/* Magnify, for the desktop chapters on a phone. Hidden at lg, where the panel already
            renders at 52% of 1180px (615px) and there is room to read it as-is. */}
        {canMagnify && (
          <div className="flex flex-col items-center gap-1 self-center lg:hidden">
            <button
              type="button"
              aria-pressed={magnified}
              onClick={() => setMagnified((m) => !m)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm active:scale-[0.98]"
            >
              {magnified ? (
                <Minimize2 aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              )}
              {magnified ? 'Fit to screen' : 'Magnify to read'}
            </button>
            {magnified && (
              <p className="text-[11px] text-slate-400">Drag the screen sideways to pan across it.</p>
            )}
          </div>
        )}
      </div>

      <div data-chrome className="space-y-4">
      <Controls
        playing={playing}
        stepIndex={stepIndex}
        total={chapter.steps.length}
        onTogglePlay={() => (stepIndex === last && !playing ? restart() : setPlaying((p) => !p))}
        onPrev={() => { setPlaying(false); prev(); }}
        onNext={() => { setPlaying(false); next(); }}
        onRestart={restart}
        onJump={(i) => { setPlaying(false); onStep(i); }}
      />

      <Filmstrip chapter={chapter} stepIndex={stepIndex} surface={surface} onJump={(i) => { setPlaying(false); onStep(i); }} />
      </div>

      <p data-chrome className="flex items-center justify-center gap-1.5 text-[10.5px] text-slate-400">
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">←</span>
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">→</span>
        to flip ·
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">space</span>
        to play ·
        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">esc</span>
        for all chapters
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Helpers
------------------------------------------------------------------------------------------------ */

/**
 * Draws one screen inside the right shell. The only place a layout choice is made — and, since both
 * decks share this function, the only place the design language is swapped. `surface` supplies the
 * frame and the block renderer *together*, so a deck cannot end up with an Ant frame around Tailwind
 * blocks.
 */
function FrameSurface({
  layout,
  screen,
  surface,
}: {
  layout: 'phone' | 'desktop';
  screen: ScreenSpec;
  surface: StorybookSurface;
}) {
  const { Blocks, PhoneFrame, DesktopFrame } = surface;
  if (layout === 'desktop') {
    return (
      <DesktopFrame title={screen.title ?? ''} right={screen.right} search={screen.search} sidebar={screen.sidebar}>
        <Blocks blocks={screen.blocks} />
      </DesktopFrame>
    );
  }
  return (
    <PhoneFrame title={screen.title} back={screen.back} right={screen.right} tab={screen.tab}>
      <Blocks blocks={screen.blocks} />
    </PhoneFrame>
  );
}

/** Back / play / next, plus the dot strip that shows where you are in the chapter. */
function Controls({
  playing,
  stepIndex,
  total,
  onTogglePlay,
  onPrev,
  onNext,
  onRestart,
  onJump,
}: {
  playing: boolean;
  stepIndex: number;
  total: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onRestart: () => void;
  onJump: (i: number) => void;
}) {
  const atStart = stepIndex === 0;
  const atEnd = stepIndex === total - 1;
  const btn =
    'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm active:scale-[0.98] disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={onPrev} disabled={atStart} className={btn}>
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-[12px] font-bold text-white shadow-sm active:scale-[0.98]"
      >
        {playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
        {playing ? 'Pause' : atEnd ? 'Play again' : 'Play'}
      </button>
      <button type="button" onClick={onNext} disabled={atEnd} className={btn}>
        Next
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRestart} className={btn}>
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
        Restart
      </button>
      <div className="flex items-center gap-1.5 pl-1">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Step ${i + 1}`}
            aria-current={i === stepIndex}
            onClick={() => onJump(i)}
            className={cn(
              'h-2.5 rounded-full transition-all',
              i === stepIndex ? 'w-6 bg-brand-navy' : 'w-2.5 bg-slate-300 hover:bg-slate-400',
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** The whole chapter as a strip of live thumbnails — the spread view of the picture book. */
function Filmstrip({
  chapter,
  stepIndex,
  surface,
  onJump,
}: {
  chapter: Chapter;
  stepIndex: number;
  /** The thumbnails draw the same screens as the stage, so they take the same surface. */
  surface: StorybookSurface;
  onJump: (i: number) => void;
}) {
  const layout = chapter.layout ?? 'phone';
  const size = FRAME_SIZE[layout];
  const scale = THUMB_SCALE[layout];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          {chapter.steps.length}-step spread
        </span>
        <span className="text-[10.5px] text-slate-400">tap a screen to jump</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {chapter.steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(i)}
            className="group shrink-0 text-left"
            aria-label={`Step ${i + 1}: ${s.caption}`}
          >
            <div
              className={cn(
                'relative overflow-hidden rounded-lg border-2 bg-slate-100 transition-colors',
                i === stepIndex ? 'border-brand-navy' : 'border-transparent group-hover:border-slate-300',
              )}
            >
              <div className="relative" style={{ width: size.width * scale, height: size.height * scale }}>
                {/* aria-hidden: the thumbnail is a picture of a screen, and the button's own
                    aria-label plus the caption below it already carry the meaning — without this
                    a screen reader reads all four screens' contents twice. */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-0 origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                >
                  <FrameSurface layout={layout} screen={s.screen} surface={surface} />
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-start gap-1">
              <span className="mt-px text-[9px] font-bold text-slate-400">{i + 1}</span>
              <span
                className="line-clamp-2 text-[9.5px] leading-tight text-slate-500"
                style={{ width: size.width * scale }}
              >
                {s.caption}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


