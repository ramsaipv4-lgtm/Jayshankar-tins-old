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

Task: **T3-floor-expires-column**

**Brief:** `src/pages/FloorDashboard.tsx`'s "Expires" column is blank (`—`)
for every single row in the Active batches table, for every SKU, always.
Root cause: the `skus` query (around line 17) selects only `id, code,
english_name` — it never selects `shelf_life_hours`, even though the `Sku`
interface (line 9) already declares `shelf_life_hours: number | null` and
`expiresAt()` (around line 53) reads `sku.shelf_life_hours` to compute the
date. Since the query never fetches that column, it's always `undefined` on
the client, so `expiresAt()` always returns `null`. This is a genuinely
one-line fix.

**Note:** this file was touched by a previous task (T1) which fixed an
unrelated bug in the *locations* query/display-name handling in this same
file. That work is already merged — you're starting from the current state
of the file, and your change is unrelated to it. Don't touch anything T1
already fixed.

**Files you may touch:** `src/pages/FloorDashboard.tsx` — this file only,
and only the one line described below.

**The fix:** change the `skus` query's `.select('id, code, english_name')`
to `.select('id, code, english_name, shelf_life_hours')`. That's it — the
interface already declares the field, `expiresAt()` already reads it
correctly. Do not touch anything else in the file.

**Acceptance criteria:**
1. The `skus` query selects `id, code, english_name, shelf_life_hours`.
2. No other line in the file changes.
3. No file other than `src/pages/FloorDashboard.tsx` is modified.
4. `node scripts/validate.mjs` exits 0 (72 pass, 0 warn, 0 fail).
5. `npm run build` succeeds.
6. `npm run typecheck` succeeds.
7. **Visual check, if you have a way to run the dev server and sign in**
   (worker demo user: `worker@jayshankar.demo` / `DevPassword123!`): the
   Floor dashboard's Expires column should now show a real date/time for
   every row instead of `—` — every seeded SKU has `shelf_life_hours` set
   (confirmed in `supabase/seed.sql`), so every row should get a value. If
   you can't run a dev server/browser from your environment, say so in your
   notes — the auditor will do the visual check independently either way,
   same as T1.

**You may decide alone (T0/T1):** nothing — this task has no judgement
calls in it. If you find one anyway, that itself is worth flagging clearly
rather than guessing.

**Before you start:** read `src/pages/FloorDashboard.tsx` in full — don't
work from this brief's line-number references alone, confirm them against
the real file first (they were accurate when this brief was written, but
confirm before editing).

**When done, write `delegation/tasks/T3-floor-expires-column/NOTES.md`**
(create it): what you changed, how you verified each acceptance criterion.
Then stop — no git, no second task.
