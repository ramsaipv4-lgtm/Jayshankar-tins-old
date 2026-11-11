// TutorialLibrary — "Learn Jayshankar": all 36 real screen recordings from the v1 feature
// walkthrough, filtered to what's actually relevant to the signed-in role by default (every
// role can still switch to "All features"). Role→audience mapping lives in lib/tutorials.ts
// (audienceFor), not re-derived here, so it stays in one place alongside the video data itself.
//
// Every video here is a real Playwright recording of someone actually doing the thing, verified
// against the live database afterward -- not a staged screenshot tour. Production pipeline
// lives in hyperframes-video/ (record-*.mjs, gen-*.mjs), not shipped with the app; only the
// rendered .mp4 files (public/tutorials/) and this page ship.

import { useEffect, useMemo, useState } from 'react';
import { Role, useSession } from '../lib/auth';
import { FormFooter } from '../components/FormFields';
import RoleBadge from '../components/RoleBadge';
import {
  Audience, CATEGORY_LABEL, CATEGORY_ORDER, Tutorial, TUTORIALS, audienceFor, formatDuration,
} from '../lib/tutorials';

function backHrefFor(role: Role): string {
  switch (role) {
    case 'admin':
    case 'co-admin': return '/admin';
    case 'vendor-rep': return '/rep';
    case 'worker':
    case 'super-worker': return '/floor';
  }
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  admin: 'Admin',
  'vendor-rep': 'Receiving & sales',
  worker: 'Floor staff',
};

export default function TutorialLibrary() {
  const { user } = useSession();
  const myAudiences = useMemo(() => (user ? audienceFor(user.role) : []), [user]);
  const [showAll, setShowAll] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const visible = useMemo(
    () => (showAll ? TUTORIALS : TUTORIALS.filter((t) => t.roles.some((r) => myAudiences.includes(r)))),
    [showAll, myAudiences]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, Tutorial[]>();
    for (const t of visible) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return map;
  }, [visible]);

  const playing = playingIndex !== null ? visible[playingIndex] : null;

  useEffect(() => {
    if (playingIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPlayingIndex(null);
      if (e.key === 'ArrowRight') setPlayingIndex((i) => (i !== null && i < visible.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setPlayingIndex((i) => (i !== null && i > 0 ? i - 1 : i));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playingIndex, visible.length]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Learn Jayshankar</h2>
        <p className="text-sm text-slate-500 mt-1">
          {visible.length} short video{visible.length === 1 ? '' : 's'} — every one a real recording of someone actually doing it, start to finish, verified against the real data afterward.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Which videos to show">
        <button
          type="button" role="radio" aria-checked={!showAll} onClick={() => setShowAll(false)}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border ${!showAll ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >
          For you{user && <RoleBadge role={user.role} />}
        </button>
        <button
          type="button" role="radio" aria-checked={showAll} onClick={() => setShowAll(true)}
          className={`rounded-md px-4 py-2 text-sm font-medium border ${showAll ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >
          All {TUTORIALS.length} features
        </button>
      </div>

      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <section key={cat} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">{CATEGORY_LABEL[cat]}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byCategory.get(cat)!.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => setPlayingIndex(visible.indexOf(t))}
                className="text-left rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-sm">▶</span>
                  <span className="text-xs text-slate-400 tabular-nums">{formatDuration(t.durationSeconds)}</span>
                </div>
                <div className="text-slate-800 font-medium mt-2">{t.title}</div>
                <div className="text-xs text-slate-500 mt-1">{t.tag}</div>
                {showAll && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.roles.map((r) => (
                      <span key={r} className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200">
                        {AUDIENCE_LABEL[r]}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <div className="text-sm text-slate-500 text-center py-8">Nothing tagged for your role yet — try "All features."</div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/75 flex items-center justify-center p-4"
          onClick={() => setPlayingIndex(null)}
        >
          <div className="bg-white rounded-lg max-w-3xl w-full overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <video key={playing.slug} src={playing.file} controls autoPlay className="w-full bg-black aspect-video" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-slate-800 font-semibold">{playing.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{playing.tag}</p>
                </div>
                <button type="button" onClick={() => setPlayingIndex(null)} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={playingIndex === 0}
                  onClick={() => setPlayingIndex((i) => (i !== null ? i - 1 : i))}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-xs text-slate-400">{(playingIndex ?? 0) + 1} of {visible.length}</span>
                <button
                  type="button"
                  disabled={playingIndex === visible.length - 1}
                  onClick={() => setPlayingIndex((i) => (i !== null ? i + 1 : i))}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FormFooter backHref={user ? backHrefFor(user.role) : '/'} backLabel="Back to dashboard" />
    </div>
  );
}
