You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`.

**Environment note (read this first):** the same project folder is also
mounted at `/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux
environment, where the planner/auditor session (Claude) runs. It's the same
files, not a copy. `node_modules` is therefore physically shared and
platform-specific — if `npm run build`/`dev` complains about a native binary
(esbuild, Rollup, etc.), that's expected; the auditor handles it on their
side with a fresh `npm install`, it's not something you need to fix. Plain
`node scripts/*.mjs` commands are unaffected (zero-dependency, pure JS).

---

Task: **T2-admin-location-display-name**

**Brief:** Same pattern as a task already completed on this project
(T1, `FloorDashboard.tsx`) — `src/pages/AdminDashboard.tsx`'s `locations`
query selects only `id, name`, missing `display_name`. Four other files in
this codebase (`RecentActivity.tsx`, `FloorDashboard.tsx`, `StockBySku.tsx`,
`FormFields.tsx`) already select `id, name, display_name` — `AdminDashboard.tsx`
is the one remaining file with the old pattern. Bring it in line.

**Important honesty note about this task:** unlike T1, this one currently has
**no visible effect** — `AdminDashboard.tsx` never renders a location's name
anywhere today; the `locations` query result is only used for a count
(`<Stat label="Locations" value={locations?.length} />`). This task is
preventative consistency work, not a visible bug fix: it stops a future
feature that *does* render a location name here from silently inheriting the
same bug T1 just fixed elsewhere. Don't be surprised that there's nothing to
screenshot — verify by code inspection and the gate, not visually.

**Files you may touch:** `src/pages/AdminDashboard.tsx` — this file only.

**Interface contract (match `src/components/RecentActivity.tsx`'s existing
pattern exactly, same as T1 did):**
- `Location` interface (currently `interface Location { id: string; name:
  string }` around line 12) gains `display_name?: string | null`.
- The Supabase query (currently `.select('id, name')` around line 36)
  becomes `.select('id, name, display_name')`, still `.order('name')`.
- Do **not** add a `locationName()`-style helper function — none exists in
  this file today and none is needed, since nothing currently renders a
  per-location name. Adding unused code is out of scope. If you think one
  IS needed, that's a scope question — stop and note it in your NOTES.md
  rather than adding it.

**Acceptance criteria:**
1. `Location` interface includes `display_name?: string | null`.
2. The locations query selects `id, name, display_name`.
3. No other line in the file changes, and no function is added that wasn't
   there before.
4. No file other than `src/pages/AdminDashboard.tsx` is modified.
5. `node scripts/validate.mjs` exits 0 (72 pass, 0 warn, 0 fail).
6. `npm run build` succeeds with no new errors or warnings.
7. `npm run typecheck` succeeds (should already be clean as of this task —
   if it isn't, that's a change on the auditor's side you don't need to
   chase, just note what you see).

**You may decide alone (T0/T1):** nothing beyond trivial formatting — this
task is intentionally small enough that there shouldn't be any real
judgement calls. If you hit one anyway, note it clearly rather than guessing.

**Before you start:** read `src/pages/AdminDashboard.tsx` in full, and
re-read `src/components/RecentActivity.tsx`'s locations query/interface as
the pattern reference (don't work from this brief's summary alone).

**When done, write `delegation/tasks/T2-admin-location-display-name/NOTES.md`**
(create it): what you changed, how you verified each acceptance criterion
(say exactly what you ran), confirm you touched only the one file. Then
stop — no git, no second task.
