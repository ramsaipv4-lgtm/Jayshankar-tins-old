You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root — the same folder is
reachable at `C:\Users\user\Desktop\Jayshankar` (native Windows) and
`/mnt/c/Users/user/Desktop/Jayshankar` (WSL2 Linux) — same files either way,
not a copy. Confirm which one you're actually running against before you
start (`pwd` on WSL2, or just note the Windows path) — the rest of this brief
doesn't care which, but your own verification commands need the right shell.

**Environment note (restate per project convention, `delegation/README.md`):**
`node_modules` is physically shared between the WSL2 and Windows sides of
this folder and is platform-specific (native binaries for Vite's toolchain —
esbuild/Rollup — differ per OS). **Run `npm install` fresh, from whichever
side you're on, before running `npm run dev`/`typecheck`/`build`/`validate`**
— don't assume the last install (from either side) is still valid for you.
No POSIX tools (`bash`, `grep`) are guaranteed on the Windows side; stick to
`npm`/`node` commands there.

**Branch:** work on `phase-a-ui-redesign`. If it doesn't exist yet
(`git branch -a`), create it from the current branch (`master`) before making
any change: `git checkout -b phase-a-ui-redesign`.

---

Task: **T9-screen1-tile-grid-home** — Phase A, Screen 1 of 12 (prompt-1.jpg).
Redesign the vendor-rep's home page (`src/pages/RepDashboard.tsx`) into a
tile-grid home, per the client's locked visual reference. **Frontend visuals
only — fake/placeholder data, no backend.** See the hard constraints at the
bottom before you touch anything.

**Reference images** (open both before writing code):
- `client-qa/developer-prompt-image/prompt-1.jpg` — the client's own locked
  reference (Screen 1 in that composite: navy header, 2×3 tile grid).
- `client-qa/ui-mockups/phase-a-evidence/img-1-screen-1-options.png` — 6
  mockup variants built from that reference; the answered questions below
  point at specific ones.
- `client-qa/ui-mockups/phase-a-evidence/img-1-before.png` — a real
  screenshot of the CURRENT live page you're replacing (captured against the
  running dev server, signed in as `rep@jayshankar.demo`), so you know
  exactly what's being removed, not just what's being added.

**Three client-facing questions were asked and answered** (the client owner
answers on behalf of the actual client — treat these as locked for Screen 1):

- **Q1.1 → (c).** Replace RepDashboard's page content entirely. Nothing of
  the current page survives except moving to Layout's global chrome, which
  you are not touching (see the scope note below). New body: a 3-stat strip
  (kg today / pending / sales) at the top, then the 6-tile grid below it.
- **Q1.2 → (c).** 6 tiles: Procurement, Receiving, Packing, Selling,
  My Tasks, More.
- **Q1.3 → (a), provisionally.** Image-exact colors, extracted from the
  already-built mockup HTML (not re-guessed from the JPEG) — exact hex
  values below. **Flagged as pending final client confirmation** — this is
  a reasonable starting point per the client owner, not yet signed off by
  the actual client, so don't treat the color choice as more locked than it
  is; it may still change after Screen 1 is reviewed.

## Part A — Scope: page body only, NOT the shared header

`src/components/Layout.tsx` already renders a shared header (white
background, "Jayshankar" wordmark, role badge, notification bell, sign-out)
that wraps every page in the app, RepDashboard included. The navy
"JAYSHANKAR" header bar in the client's reference image is that same shared
chrome, redesigned — but redesigning it touches every role's page, not just
this one. **Do not touch `Layout.tsx`.** Your task is the page body only —
everything `RepDashboard.tsx` currently returns, rendered inside Layout's
existing `<main>` wrapper. Leave Layout's white header exactly as it is; the
navy-header redesign is a separate, later cross-cutting step, out of scope
here.

## Part B — Remove all of RepDashboard's current content

Read `src/pages/RepDashboard.tsx` in full first (204 lines). Remove, without
partial preservation:
- The `<h2>Rep dashboard</h2>` title + subtitle paragraph.
- The My tasks / 🎓 Learn / 🔍 Search link row (top-right).
- The "Record activity" section: all 10 action-link buttons (Delivery,
  Confirm arrivals, Pack container, Sale, Spoilage, Customers, Payments,
  Reversals, Bills, Complaints).
- The Vendors table (`vendors` query + its `<table>`).
- The SKUs table (`skus` query + its `<table>`).
- The `<RecentActivity />` section.

None of the underlying routes/pages these linked to are being removed from
the app — only this page's links to them. See Part D for where they go
instead.

## Part C — Build the new body: stats strip + 6-tile grid

**Stats strip** — 3 items in a row, each a bold value + small uppercase
label, matching the mockup's shape exactly:
- `450 KG` / `Today`
- `2` / `Pending`
- `₹ 24K` / `Sales`

These are **hardcoded placeholder values** (Part E) — this is a fake-data
frontend pass, not a stats computation.

**Tile grid** — 6 tiles, responsive grid (3 columns on a normal/desktop
viewport is fine; collapse to 2 columns on narrow mobile widths — use
Tailwind's responsive prefixes, e.g. `grid-cols-2 sm:grid-cols-3`, don't hard
-code a fixed phone-width layout).

**Real icon assets exist now — use them, don't fall back to emoji.** 6 SVGs
were generated (Recraft.ai) already matching the "(a) image-exact colors"
style and are committed at `public/icons/`. **Each SVG already has its exact
tile color baked in as its own background** (they were generated as "a
solid-color rounded-square background with a white icon centered on it," not
a transparent glyph) — this changes how a tile is built versus the original
emoji plan: **the tile's color comes from the image itself, not from a
separate `bg-[#hex]` Tailwind class.** Each tile: the SVG rendered to fill
the tile (`<img>` or inline via `?url` import, your call — see T0/T1 below),
`rounded-2xl overflow-hidden` on the wrapping element (safe regardless of
whether the SVG's own canvas already has rounded corners — clips either way,
never double-visible), a white label in a short strip at the bottom of the
tile (overlaid on the image, e.g. `absolute bottom-0` with enough of a
dark/gradient backing that white text stays legible — use your judgement,
this is exactly the T0/T1 territory below), a subtle press state
(`active:scale-[0.98]` or equivalent).

**File → tile mapping** (exact filenames on disk, checked directly — note
one real typo in a filename, preserve it exactly, don't "fix" it):

| Tile | File (relative to `public/`, so served at the URL shown) |
|---|---|
| Procurement | `/icons/procurement.svg` |
| Receiving | `/icons/recieving.svg` — **yes, misspelled on disk** ("recieving" not "receiving"); reference it exactly as it exists, do not rename the file |
| Packing | `/icons/packing.svg` |
| Selling | `/icons/selling.svg` |
| My Tasks | `/icons/my-tasks.svg` |
| More | `/icons/more.svg` |

**Files in `public/icons/` you should NOT use, and why:** `packing-1.svg`,
`packing-2.svg`, and `shopping-1.svg` also exist — these are alternate
generations from the same batch, not additional tiles. Use only the 6 files
in the table above. If, once you actually look at `packing.svg` rendered,
it's visibly worse than `packing-1.svg`/`packing-2.svg` (cut off, wrong
concept, clearly broken), that's a real judgement call — note it in your
notes and say which one you used instead and why, rather than silently
picking the primary name if it's actually the worse asset.

The former "exact hex" color table no longer drives anything directly (the
colors live inside the SVGs now), but for reference the intended colors are
unchanged: Procurement navy `#0e2b5e`, Receiving orange `#f59e0b`, Packing
teal `#14b8a6`, Selling red `#ef4444`, My Tasks purple `#8b5cf6`, More sky
`#38bdf8` — open each SVG or render the page and eyeball that what you see
roughly matches this list; if one looks like the wrong color entirely (not
just a slightly different shade), that's worth flagging, not silently
shipping.

Label text renders in white/near-white (`text-white`) — since the tile's
visible surface is now the SVG image rather than a flat Tailwind background
color, actually look at the rendered page (not just the code) to confirm the
white label text is legible against each icon's real background before
calling this done; this project has a real contrast checker
(`scripts/check-contrast.mjs`) but these 6 image-based pairs aren't
mechanically checkable by it (it works on Tailwind class pairs, not
rendered-image regions) — a visual eyeball check is the actual verification
here, say so plainly in your notes rather than claiming a tool confirmed it.

No "sub" caption text under the labels (e.g. no "Record a purchase" under
Procurement) — the client's own reference image is label-only, and their own
feedback was "the UI... was stupid and simple and they liked that style."
This is a **T1 call**, not directly asked in Q1.1–Q1.3 — write it in your
notes so the auditor can flag it for the next approval round in case the
client actually wants the subtext back.

## Part D — Tile destinations

- Procurement → `/deliver`
- Receiving → `/deliveries/confirm`
- Packing → `/pack`
- Selling → `/sell`
- My Tasks → `/my-tasks`
- More → **does not navigate to a new route.** Toggles a simple inline panel
  (local component state, e.g. `useState`) within this same page, listing
  plain links to everything Part B removed that isn't one of the other 5
  tiles: Customers (`/customers`), Payments (`/payments`), Reversals
  (`/reversals`), Bills (`/bills`), Complaints (`/complaints`), Search
  (`/search`), Learn (`/learn`). Plain unstyled-is-fine list — this is not
  part of the visual redesign (no "More" screen has been designed yet across
  the 12 locked images), it exists purely so a working rep doesn't lose
  access to real features they use today while Phase A is in progress. This
  is also a **T1 call, not directly asked** — write it in your notes. **Do
  not build a new route or a new file for this** — an inline toggled panel
  inside `RepDashboard.tsx` only.

All 5 real tile routes (`/deliver`, `/deliveries/confirm`, `/pack`, `/sell`,
`/my-tasks`) and all 7 "More"-panel routes already exist in `App.tsx` and are
already reachable by the `vendor-rep` role today — you are relinking to
routes that already work, not creating any new ones.

## Part E — Placeholder data discipline (hard constraint, not a suggestion)

This is a **frontend-only** pass. `RepDashboard.tsx` must not query Supabase
for the stats-strip numbers or for anything else new. The `useQuery` calls
for `vendors`/`skus` that existed in the old version are being deleted
(Part B), not repurposed. The 3 stat values are literal hardcoded strings
(`450 KG`, `2`, `₹ 24K`) — a comment above them should say
`// TODO(Phase A backend wiring): replace with a real query` so the later
wiring pass finds them without re-reading the whole file.

---

## Hard constraints (Phase A, do not violate any of these)

1. **No backend changes.** No `.sql` file, no migration, no RPC, no RLS
   policy — nothing under `supabase/` — is touched. This task is 100%
   `src/pages/RepDashboard.tsx`.
2. **No SPEC.md edit.** The 12 locked visuals are the spec for this phase;
   don't add a SPEC.md decision row for this.
3. **No new runtime dependency.** `package.json`/`package-lock.json` stay
   byte-identical. Tailwind's arbitrary-value syntax and plain emoji cover
   everything this task needs.
4. **No DB mutation of any kind**, including via the demo seed or a manual
   script — this task never talks to Supabase at all.

**Files you may touch:** `src/pages/RepDashboard.tsx`. Nothing else — not
`App.tsx` (the `/rep` route already points at this component; you're not
renaming the file or its default export, so no route change is needed), not
`Layout.tsx` (Part A), not any other page, not `package.json`, not anything
under `supabase/`.

**Acceptance criteria:**
1. `git diff --stat` (or `git status`) shows exactly one file changed:
   `src/pages/RepDashboard.tsx`.
2. The page renders: a 3-item stats strip (`450 KG`/`Today`, `2`/`Pending`,
   `₹ 24K`/`Sales`) followed by a 6-tile grid with labels exactly
   "Procurement", "Receiving", "Packing", "Selling", "My Tasks", "More", in
   that order.
3. Each tile renders its corresponding SVG from `public/icons/` per Part C's
   file-mapping table (`grep -n "procurement.svg\|recieving.svg\|packing.svg\|selling.svg\|my-tasks.svg\|more.svg" src/pages/RepDashboard.tsx`
   finds all 6, one per tile, no reuse, no substitution) — not emoji, not a
   `bg-[#hex]` Tailwind class standing in for a missing image.
4. `grep -n "vendors?.map\|skus?.map\|RecentActivity" src/pages/RepDashboard.tsx`
   finds nothing (all three are fully removed).
5. Clicking each of the 5 direct tiles navigates to its listed route;
   clicking "More" opens the inline panel (does not navigate) and the panel
   contains all 7 listed links, each pointing at its existing route.
6. `npm run typecheck` passes clean.
7. `npm run validate` still exits 0 with the same 73/73 as before this
   change (confirms nothing backend-adjacent was accidentally touched — this
   task shouldn't change that number at all).
8. `npm run build` succeeds.
9. No new file created; no file outside the touched-file list modified.

**You may decide alone (T0/T1):** the exact Tailwind utility classes for
spacing/rounding/shadows as long as the result visually matches the mockup's
proportions; whether the stats strip and tile grid are separate `<section>`s
or one wrapping `<div>`; the exact wording/order of links inside the "More"
panel beyond what Part D lists; minor icon-size/padding tuning; whether each
icon is rendered as a plain `<img src="/icons/....svg">` or imported via
Vite's `?url`/SVG-as-component handling (whichever this project's existing
Vite config already supports without a new dependency — check, don't guess,
and don't add an SVG-loader package to find out); the exact styling that
keeps the white label text legible over each icon (a bottom gradient strip,
a semi-opaque dark band, a solid-color label bar — your call, just look at
the rendered result before deciding it's legible). Write every such call in
your notes, per this project's standing rule — an unrecorded decision is one
the next session pays for again.

**Escalate instead of guessing (T2) if:** you find `RepDashboard.tsx` no
longer matches the 204-line version this brief describes (someone else
edited it since this brief was written — stop, don't guess which version is
current); `/rep` isn't actually wired to this component in `App.tsx` (don't
"fix" routing — that's out of scope, report it); any of the 12 tile/panel
destination routes listed above don't actually exist in `App.tsx` when you
check (report exactly which one, don't invent a replacement).

**When done:**
1. Run your own verification for every acceptance criterion above and note
   how you checked each one.
2. Start the dev server (`npm run dev`) and at minimum confirm the page
   loads with no console errors — a screenshot if your environment can take
   one, a plain description of what you see if it can't.
3. Write `delegation/tasks/T9-screen1-tile-grid-home/NOTES.md`: what you
   built, every T0/T1 decision with its reasoning (the two flagged ones in
   Parts C/D at minimum), anything you noticed but didn't act on, how you
   verified each acceptance criterion, anything the auditor should know.
4. Stop. **Do not commit, do not merge, do not touch a second task.** The
   auditor (Claude) re-verifies independently — fresh `npm install`, gate
   re-run, a real screenshot against the running dev server signed in as
   `rep@jayshankar.demo` / `DevPassword123!` — and owns the commit(s) and
   `client-qa/ui-mockups/phase-a-evidence/img-1-after-ui.png` capture, per
   the Phase A workflow. Multiple small commits within this one image are
   expected once it's verified — that's the auditor's job, not yours.
