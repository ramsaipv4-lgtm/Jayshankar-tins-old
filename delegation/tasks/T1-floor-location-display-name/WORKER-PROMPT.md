You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`. This is a trial run of a new
Claude-plans/you-build/Claude-audits loop — small and low-risk on purpose, so
treat it as a real task, not a throwaway.

**Environment note (read this first):** the same project folder is also
mounted at `/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux
environment, where the planner/auditor session (Claude) runs. It's the same
files, not a copy. `node_modules` is therefore physically shared and
platform-specific — if anything you run complains about a native binary
(esbuild, Rollup, etc. — this would show up as a build/dev-server error, not
a TypeScript error), run `npm install` fresh before continuing; don't assume
whatever's already installed matches your OS. Plain `node scripts/*.mjs`
commands don't have this problem (zero-dependency, pure JS).

---

Task: **T1-floor-location-display-name**

**Brief:** `src/pages/FloorDashboard.tsx` shows the wrong name for a
location. Its `locations` query only selects `id, name`, so the "Location"
column in the Active batches table shows the raw short name (`storage`,
`freezer`, `display`) instead of the friendly display name (`Cold Storage`,
`Deep Freezer`, `Display Counter`) that every other screen in this app
shows. `src/components/RecentActivity.tsx` already has the correct pattern
for the exact same data — copy its approach into FloorDashboard.tsx, don't
invent a new one.

**Files you may touch:** `src/pages/FloorDashboard.tsx` — this file only.
Do not touch `RecentActivity.tsx` (read it, don't edit it) or any other file.

**Interface contract (match this exactly, from `src/components/
RecentActivity.tsx` lines ~19, ~61, ~70):**
- The `Location` interface gains `display_name?: string | null` alongside
  the existing `id: string; name: string`.
- The Supabase query changes from `.select('id, name')` to
  `.select('id, name, display_name')` (still `.order('name')`).
- The lookup function (`locationName` in FloorDashboard.tsx — keep its
  existing name, don't rename it to match RecentActivity's `locName`) returns
  `display_name ?? name ?? '—'` instead of just `name ?? '—'`.

**Acceptance criteria:**
1. `Location` interface in `FloorDashboard.tsx` includes `display_name?: string | null`.
2. The locations query selects `id, name, display_name`.
3. `locationName(id)` returns the location's `display_name` when present,
   falling back to `name`, falling back to `'—'` — same fallback order as
   `RecentActivity.tsx`'s `locName`.
4. No file other than `src/pages/FloorDashboard.tsx` is modified.
5. `node scripts/validate.mjs` still exits 0 (72 pass, 0 warn, 0 fail —
   this is a pure frontend query change, it shouldn't affect this at all,
   but confirm it).
6. `npm run build` succeeds with no new errors or warnings.
7. `npm run typecheck` succeeds (this project's TypeScript is strict).

**You may decide alone (T0/T1):** naming of any local variable, minor
formatting choices consistent with the surrounding code. Anything else —
especially anything that would touch a file outside your list, or any
acceptance criterion that seems wrong or unbuildable as written — stop and
say so in your notes rather than guessing or improvising. This task is
intentionally small and shouldn't have any genuine T2-level judgement calls
in it; if you hit one anyway, that itself is worth flagging clearly.

**Before you start:** read `src/pages/FloorDashboard.tsx` and
`src/components/RecentActivity.tsx` in full — don't work from this brief's
summary of them alone.

**When you're done, write your results into
`delegation/tasks/T1-floor-location-display-name/NOTES.md`** (create it):
1. What you changed, in a few lines (or paste the diff).
2. How you verified each of the 7 acceptance criteria above — say exactly
   what you ran and what it returned, don't just assert "it works."
3. Anything you noticed but didn't touch (e.g. if you spot the same
   short-name-instead-of-display-name issue anywhere else in the codebase —
   don't fix it, just note it for the next task).
4. Confirm explicitly that you touched only `src/pages/FloorDashboard.tsx`.

Then stop — don't commit, don't touch git at all (that stays the auditor's
job on the WSL side), and don't start a second task.
