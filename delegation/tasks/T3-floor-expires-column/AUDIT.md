# T3 — audit (auditor: Claude, 2026-09-10)

**Verdict: MiniMax's change was integrated, but was not sufficient on its own —
a real, pre-existing bug was found during the visual check, fixed separately,
and both are now confirmed working together.** This is exactly the scenario
the audit discipline exists for: the diff was correct, the gate was green,
and the observed behavior was still wrong. "The code ran" and "the output is
correct" are different claims.

## What MiniMax got right

The diff is exactly the described one-line change (`skus` query now selects
`shelf_life_hours`), exactly in scope, and MiniMax's own verification of
criteria 1–6 was accurate. Notably, MiniMax **correctly declined to sign in
with the provided demo credentials** — its own browser-automation tooling
forbids typing credentials on the user's behalf, and the brief explicitly
allowed deferring the visual check for exactly this reason. That's the right
call, not a shortfall — flagging honestly what you can't verify beats faking
a check.

## What the independent visual check found

Signed in as `worker@jayshankar.demo`, loaded the Floor dashboard — the
Expires column was **still blank for every row**, despite the diff being
correct and `validate`/`build`/`typecheck` all green. Investigated properly
rather than assuming the fix was wrong:

- Confirmed via `curl` that the dev server was serving the correct, current
  source (line 17 had the fix).
- Ruled out a stale service worker/cache (tested with SW registration
  explicitly disabled — same result).
- Ruled out a port collision (killed everything, cleared Vite's dep cache,
  restarted on a fresh unambiguous port — same result).
- Captured the actual network request via Playwright: the browser was
  sending `select=id,code,english_name` — **without** `shelf_life_hours` —
  even though `FloorDashboard.tsx`'s own source unambiguously requested it.

**Root cause found:** `src/components/RecentActivity.tsx` (rendered as a
child of `FloorDashboard`) has its own `useQuery({ queryKey: ['skus'], ... })`
with a narrower `select`. `FloorDashboard.tsx`'s own `skus` query used the
*identical* key, `['skus']`. TanStack Query treats identical keys as the same
query — it dedupes them and shares one cached result across every component
observing that key, regardless of each one's own `queryFn`. RecentActivity's
narrower shape was winning, silently starving FloorDashboard's own query
input of `shelf_life_hours` no matter what FloorDashboard's code asked for.

**This bug pre-dates T3 entirely** — it's an architectural issue in how the
app's components share TanStack Query keys, not something MiniMax introduced
or could reasonably have been expected to find (the collision is invisible
from reading `FloorDashboard.tsx` alone; it only shows up when you know to
check a *sibling* component's query definition).

**Wider blast radius, checked and confirmed real:** the exact same
`queryKey: ['skus']` is used, with three genuinely different `select` shapes,
across 5 files (`FormFields.tsx`, `RecentActivity.tsx`, `AdminDashboard.tsx`,
`FloorDashboard.tsx`, `RepDashboard.tsx`). `AdminDashboard.tsx` also renders
`<RecentActivity />` and also has its own `skus` query needing
`shelf_life_hours` (for a "Shelf life (hrs)" column in its own SKUs table) —
same collision, same symptom. Verified with a screenshot: **every one of the
25 SKUs showed `—` in that column**, confirmed unrelated to today's session
(this has been broken since whenever `RecentActivity` was added next to that
table).

## Fix applied (auditor, not MiniMax — same class of fix as T1's bonus fix)

Gave both `FloorDashboard.tsx`'s and `AdminDashboard.tsx`'s own `skus`
queries a **distinct** query key (`['skus', 'floor-dashboard']` and
`['skus', 'admin-dashboard']` respectively) instead of the shared `['skus']`.
This is the minimal, safe fix: splitting a wrongly-shared cache into
independent ones can only ever make behavior *more* correct, never less —
nothing currently relying on the shared cache loses anything, since the
narrower consumers (`RecentActivity`, `FormFields`, `RepDashboard`) keep
using `['skus']` unchanged.

**Re-verified end to end after the fix:**
- Gate: `validate` 72/0/0, `typecheck` clean, `build` succeeds, `selftest`
  9/9.
- Network capture: two independent requests now fire — `RecentActivity`'s
  narrow one and `FloorDashboard`'s own (now correctly including
  `shelf_life_hours`, with real values in the response).
- Screenshot: Floor dashboard's Expires column shows real dates for every
  row (e.g. `9/17/2026, 5:04:27 PM`).
- Screenshot: Admin dashboard's "Shelf life (hrs)" column shows real numbers
  for all 25 SKUs (8–720, matching `seed.sql`).

**Not fixed, logged as a real follow-up candidate:** the same `['skus']`
collision risk still exists structurally — `FormFields.tsx` and
`RepDashboard.tsx` still share the key with `RecentActivity.tsx`, and
happen not to exhibit a visible symptom only because their shapes are
currently compatible (a match of convenience, not a designed guarantee). The
generalizable fix — one shared, canonical `skus` query hook with a superset
shape, or a documented convention that every component needing non-default
columns must use its own key — is a real architectural decision, not a
one-line patch, and deliberately out of scope for this integration pass. See
`BUILDER-DECISIONS-REVIEW.md` decision #34 for the full write-up.

## Status

`LEDGER.md` T3 row → `integrated`. Committed together with the
`AdminDashboard.tsx` fix (same root cause, same commit — see decision #34).
