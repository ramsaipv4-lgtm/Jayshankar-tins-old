# T9 — Screen 1: tile-grid home (`RepDashboard.tsx`) — worker notes

| | |
|---|---|
| Worker session | Cline (worker role, per `delegation/README.md`) |
| Date | 2026-09-22 |
| Branch | `phase-a-ui-redesign`, started at `3cd0bd5` |
| Shell side | WSL2 Linux — `/mnt/c/Users/user/Desktop/Jayshankar`, node v22.23.2, `npm install` re-run fresh on this side before any gate |
| Status | **Reworked from scratch** (see §R1). Uncommitted — the auditor owns commits/merge. |

> **Note on this file's two halves.** **§R1-§R8 describe the current rework** — shadcn/ui +
> Tailwind + lucide, rebuilt from scratch on the owner's instruction: *"rework everything from
> scratch dont reuse existing frontend at all"*, to match
> `client-qa/developer-prompt-image/prompt-1.jpg` exactly. **§S1 is a condensed record of the
> superseded first pass** (six SVG tiles, committed by the auditor as `3cd0bd5`), kept only
> because earlier review referenced it; nothing in it applies to the current code.

## R1. What the rework is

The owner asked for the whole front end rebuilt with **shadcn/ui + Tailwind**, with the tile
**.svg artwork replaced by rebuilt icons**, to reflect the reference image exactly. Consequences:

- **The six SVG tile assets are retired.** No `/icons/*.svg` is referenced from the page any more
  (the live run asserts zero requests for that path). Tile colour is now a Tailwind theme token
  and the glyph is a `lucide-react` component, so changing a colour or an icon is a one-line edit
  rather than six regenerated 40 kB files.
- **The shared chrome was rebuilt too.** The reference's most distinctive element is the navy
  JAYSHANKAR app bar, which lives in `Layout.tsx` (shared by admin/rep/worker). Since the owner
  said to rework everything and not to reuse the existing frontend, `Layout.tsx` was rebuilt as
  that navy bar. This is the one part of the rework with cross-screen blast radius — every role's
  screens now sit under the navy bar (see §R5 for the call and its alternatives).
- **A real shadcn/ui setup now exists** (it did not before): `components.json`, the `cn()` helper,
  shadcn's CSS-variable design tokens, the canonical theme mapping in `tailwind.config.ts`, and
  `src/components/ui/` primitives (Button, Card, Collapsible) — copied from upstream shadcn source
  and adapted only for this project's `@/` alias.

### New Screen 1 structure (`src/pages/RepDashboard.tsx`)

1. **Stats strip** — shadcn `Card` wrapping a 3-column divided grid: `450 KG / TODAY`,
   `2 / PENDING`, `₹ 24K / SALES`. Values are hardcoded literals with a
   `TODO(Phase A backend wiring)` comment above them; this page still performs **no** Supabase read.
2. **Tile grid** — `grid grid-cols-2 gap-3 sm:grid-cols-3`, matching the reference's 2-column phone
   grid and widening to 3 columns on desktop. Six tiles, in the client's order, each a
   `<Tile tone icon label>`:

| Tile | Tone (Tailwind token) | Hex | Icon (lucide) | Destination |
|---|---|---|---|---|
| Procurement | `bg-tile-navy` | #0e2b5e | `ShoppingCart` | `/deliver` |
| Receiving | `bg-tile-orange` | #f59e0b | `ArrowDownToLine` | `/deliveries/confirm` |
| Packing | `bg-tile-teal` | #14b8a6 | `Package` | `/pack` |
| Selling | `bg-tile-red` | #ef4444 | `Truck` | `/sell` |
| My Tasks | `bg-tile-purple` | #8b5cf6 | `ClipboardCheck` | `/my-tasks` |
| More | `bg-tile-sky` | #38bdf8 | `Ellipsis` | disclosure, **no** navigation |

3. **"More" disclosure** — a shadcn `Collapsible` (Radix) rather than a hand-rolled `useState`
   toggle, so `aria-expanded` / `aria-controls` come from Radix. Its panel is a shadcn `Card`
   listing the seven real destinations that the old home screen linked to and that are not tiles:
   Customers, Payments, Reversals, Bills, Complaints, Search, Learn.

### The Tile component (`src/components/ui/tile.tsx`)

Built from scratch to the reference's proportions: solid rounded square, one white line icon
centred, white label just above the bottom edge, `active:scale-[0.98]` press state. Colour comes
from a CVA `tone` variant mapped to the theme tokens above; the icon is any `LucideIcon` at
`strokeWidth={1.5}` and `h-[42%] w-[42%]` (the reference's icon-to-tile ratio, so it holds at any
column width). Both tile wrappers (the five `<Link>`s and the `CollapsibleTrigger` button) share
one `TILE_WRAPPER` class string so the focus ring and hit area cannot drift apart.

## R2. Files and dependencies touched

Modified (9):
`package.json`, `package-lock.json`, `src/pages/RepDashboard.tsx`, `src/components/Layout.tsx`,
`src/components/NotificationBell.tsx`, `src/index.css`, `tailwind.config.ts`, `tsconfig.json`,
`vite.config.ts`.

New (6): `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`,
`src/components/ui/card.tsx`, `src/components/ui/collapsible.tsx`, `src/components/ui/tile.tsx`.

Dependencies added (this is a real departure from the earlier "no new dependency" constraint —
shadcn cannot be used without them, and the owner's instruction supersedes that constraint):

| Package | Why |
|---|---|
| `lucide-react` | shadcn's icon library — the rebuilt icons |
| `clsx`, `tailwind-merge` | `cn()`; merge must win conflicts so callers can override defaults |
| `class-variance-authority` | shadcn's variant API (Button variants, Tile tones) |
| `@radix-ui/react-slot` | shadcn `Button`'s `asChild` |
| `@radix-ui/react-collapsible` | shadcn `Collapsible` (the More disclosure) |
| `tailwindcss-animate` (dev) | shadcn's animate plugin; also supplies the enter/exit utilities |
| `@types/node` (dev) | `node:url` in `vite.config.ts` for the `@/` alias |

## R3. Decisions (T0/T1) specific to this rework

**R-D1 — Manual shadcn setup, not `npx shadcn init`.** The CLI is interactive and would have
rewritten `src/index.css`, `tailwind.config.ts` and `tsconfig.json` wholesale on a project with
its own documented conventions. I wrote the canonical files by hand instead (`components.json`
style `new-york`, `baseColor: slate`, `cssVariables: true`, `iconLibrary: lucide`) and copied the
three UI primitives from shadcn's upstream source verbatim apart from the import alias. Result: a
setup the CLI can keep extending (`npx shadcn@latest add <component>`) without a surprise rewrite.

**R-D2 — `tailwind-merge` pinned to `^2.6.0`.** npm first resolved **3.7.0**, which implements
Tailwind **v4** class semantics; this project is on Tailwind **3.4.19**. Left as v3 it would have
mis-merged some v3 utilities (silent styling bugs, not build errors). Pinned to the v2 line —
verified installed: 2.6.1.

**R-D3 — `esModuleInterop: true` added to `tsconfig.json`.** `tailwindcss-animate` ships CJS-only
(`export = plugin` in its `.d.ts`), so the default import in `tailwind.config.ts` needs it. Whole-app
`tsc --noEmit` was re-run afterwards and is clean, so no existing file regressed.

**R-D4 — `@/` alias added properly** (`tsconfig.json` `baseUrl` + `paths`, and
`vite.config.ts` `resolve.alias` via `fileURLToPath`). Without it, shadcn's convention
(`components.json` aliases, generated files importing `@/lib/utils`) would be a lie and the next
`shadcn add` would produce code that cannot compile.

**R-D5 — Palette is a theme token, not artwork.** `tailwind.config.ts` gains `brand.navy` and the
six `tile.*` colours from one shared `BRAND_NAVY` constant, so the app bar and the Procurement tile
can never drift. Q1.3(a)'s "image-exact" values (still pending final client sign-off) now live in
exactly one place.

**R-D6 — shadcn tokens inherit this project's colours rather than shadcn's defaults.** `--primary`
and `--ring` are indigo-600 `#4f46e5` (SPEC §3.5's primary and focus-ring colour) and
`--destructive` is red-600 `#dc2626`, instead of shadcn's near-black defaults, so shadcn components
match the rest of the app instead of importing a second, conflicting blue.

**R-D7 — No base-layer reset and no `.dark` block.** shadcn's install normally adds
`* { @apply border-border }` and a body background override; both would silently restyle the
eleven screens that are not part of this task. `--border` is set to exactly Tailwind's previous
default border colour (`#e5e7eb`) precisely so that mapping `borderColor.DEFAULT` to it changes
nothing that already existed.

**R-D8 — Tile is presentational; the wrapper owns the semantics.** A `<Link>` for the five
navigating tiles and Radix's `CollapsibleTrigger` (a real `<button>`) for More. No nested
interactive elements, and the accessible name of each tile is its label.

**R-D9 — Labels are white on the tile colour, exactly as in the reference** — no dark backing bar.
This is a *deliberate* departure from the first pass (which used a gradient strip and passed AA on
all six). It fails AA-normal on 5 of 6 tiles; the numbers, the cause and the one-line remedy are in
§R4. A soft `text-shadow` is applied as a mitigation — it is invisible at normal size and lifts the
worst tone from 2.14:1 to 2.58:1, but it does not by itself reach 4.5:1.

**R-D10 — `NotificationBell`'s trigger restyled, `RoleBadge` deliberately not.** The bell is used
only by `Layout`, so its trigger button now takes a translucent-white-on-navy treatment (one
`className`, no behaviour change). `RoleBadge` is used by four other pages (`EmployeeCard`,
`TaskDelegation`, `TeamManagement`, `TutorialLibrary`), so it keeps its existing light chip — it
reads correctly on navy and changing it would have rippled into unrelated screens.

**R-D11 — `OfflineBanner`, notification dropdown and all behaviour kept.** The rebuild is visual;
sign-out, the bell's Supabase subscription, the offline banner and every route still work exactly
as before (asserted by the live run: zero console/page errors).

**R-D12 — Owner-chosen scope: the navy bar is global.** See §R5.

## R4. Label contrast — measured, and failing AA on 5 of 6 tones

Method: the real screenshot `/tmp/t9c-414.png` (414x1400 @ dsf 2 -> 828px wide), decoded with the
already-present `sharp` (read-only, no dependency added), per-pixel WCAG relative luminance across
each tile's label row; white-text contrast = `1.05 / (L + 0.05)`. `flat bg` is a pixel 6px inside the
tile at 20% height (no glyph there); `median` is the median of the label row (the backing between
strokes); `darkest 5%` is the text-shadow halo around the glyphs.

| Tile | flat bg | white vs median | white vs shadow halo |
|---|---|---|---|
| Procurement | #0e2b5e | **13.76:1 PASS** | 15.22:1 |
| Receiving | #f59e0b | 2.15:1 FAIL | 2.96:1 |
| Packing | #14b8a6 | 2.49:1 FAIL | 3.29:1 |
| Selling | #ef4444 | 3.76:1 FAIL | 4.77:1 |
| My Tasks | #8b5cf6 | 4.23:1 FAIL (borderline) | 5.42:1 |
| More | #38bdf8 | 2.14:1 FAIL | 2.58:1 |

**This is inherent to the reference design, not a defect introduced here.** White text on
orange/teal/sky cannot reach 4.5:1 unless the tile colour changes or the text gets a backing. The
first pass solved it with a dark gradient strip and measured 7.17-19.19:1; this rework was
explicitly instructed to match the reference exactly, so the reference's own treatment was
implemented and flagged rather than quietly "improved".

**Remedy if the client wants AA** — one line in `src/components/ui/tile.tsx`: a bottom scrim behind
the label, e.g. `bg-gradient-to-t from-black/35 to-transparent` (~4.6-5.2:1 on the worst tones) or a
solid strip (7:1+). It visibly departs from the reference, so it needs a client decision, not a
unilateral one. The shadow-halo column is what the eye actually sees around the strokes, which is
why the labels still read acceptably in practice.

## R5. Blast radius: the navy header is now global (owner's call, recorded)

The reference's navy JAYSHANKAR bar is `Layout.tsx`'s chrome, shared by every role. The first pass
deliberately left it alone; I asked which scope was wanted and the owner answered *"rework
everything from scratch dont reuse existing frontend at all"*, which was taken as authority to
rebuild it. Consequence: admin/worker screen **bodies** keep their existing styling but now render
under the navy bar with the shared display-name / role-badge / bell / sign-out controls.

Alternatives that were on the table and not taken: (a) leave the white header; (b) add a `variant`
prop so only `/rep` gets navy. If the narrower scope is wanted later, it is one prop plus a
conditional in `Layout.tsx`.

At 414px the role badge and the display-name/email block are hidden (`hidden sm:*`) so the centred
wordmark and the sign-out control keep their room; both are visible on wider screens. T1 call.

## R6. Verification — how each claim was checked

All gates run on the WSL2 side after a fresh `npm install`.

| Gate / check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run validate` | **73 pass, 0 warn, 0 fail** — identical to the pre-rework baseline (proves no backend-adjacent file was disturbed by the dependency/config work) |
| `npm run build` | exit 0 |
| Dev server + real sign-in (`rep@jayshankar.demo`) | 0 console errors, 0 page errors, 0 failed/4xx requests |
| Header is the reference navy | computed `background-color: rgb(14, 43, 94)` = `#0e2b5e` |
| Wordmark | `JAYSHANKAR` (CSS uppercase), white, 2.4px letter-spacing, **optically centred — 0px offset** from viewport centre at 414px |
| Stats strip | exactly `450 KG / TODAY`, `2 / PENDING`, `₹ 24K / SALES` |
| Six tiles, label text + order | `Procurement, Receiving, Packing, Selling, My Tasks, More` |
| Tile colour is Tailwind, not an image | computed backgrounds exactly `rgb(14,43,94) rgb(245,158,11) rgb(20,184,166) rgb(239,68,68) rgb(139,92,246) rgb(56,189,248)`; 185x185 CSS px; 16px radius |
| Icons are lucide components | exactly one `<svg>` per tile, `stroke: rgb(255,255,255)` |
| Wrappers | `['a','a','a','a','a','button']` — five links, one disclosure |
| Navigation | all five tiles land on `#/deliver`, `#/deliveries/confirm`, `#/pack`, `#/sell`, `#/my-tasks` |
| More | does not navigate; `aria-expanded=true`; 7 links with the exact expected hrefs; collapses again |
| **SVG tile assets retired** | **zero requests matching `/icons/*.svg` for the whole session** |
| Live suite | 25/25 — `ALL CHECKS PASSED` |

Screenshots — the auditor owns the `client-qa` evidence capture, so these live outside the repo:

| File | What it shows |
|---|---|
| `C:\\Users\\user\\Desktop\\Jayshankar-phase-a-screenshots\\01-phone-414-tile-grid.png` | 414px phone, reference state (panel closed) |
| `...\\02-phone-414-more-panel-open.png` | 414px phone, \"More\" disclosure expanded |
| `...\\03-desktop-1280-tile-grid.png` | 1280px desktop, 3-column grid |

WSL2 path to the same folder: `/mnt/c/Users/user/Desktop/Jayshankar-phase-a-screenshots/`.
Capture script: `/tmp/t9c-capture.mjs` (writes `/tmp/shot-*.png`). Note that the earlier
`/tmp/t9c-414.png` / `t9c-1280.png` / `t9c-414-more.png` trio from the verification run were all
taken *after* the More click, so all three show the panel open — use the named set above instead.

## R7. For the auditor / next round

1. **The six tracked SVGs in `public/icons/` are now dead weight** — nothing references them after
   this rework. They are committed (`3cd0bd5`), so removing them is an ordinary `git rm`, but
   deleting committed assets is the auditor's call, not mine.
2. **Three alternates are untracked-but-now-visible**: `public/icons/packing.svg`, `packing-1.svg`,
   `shopping-1.svg`. The `.gitignore` fix (`*.svg` -> `/*.svg`, commit `edb93f0`) stopped hiding
   them, so they now show as untracked. Never used by this screen — add or ignore them deliberately.
3. **The §R4 contrast failure needs a client decision** (exact reference vs WCAG AA).
4. **The other 11 screens are untouched** apart from the shared navy chrome; their bodies still use
   the pre-shadcn styling, so there will be a visible mix until each screen is rebuilt in turn.
   Expected under the 12-screen workflow — stated so it is not mistaken for a regression.
5. Carry forward the two traps hit here: keep `tailwind-merge` on **v2** while the project is on
   Tailwind 3, and keep the **manual** shadcn file layout so `npx shadcn add` can extend it safely.

## R8. How to reproduce

```bash
cd /mnt/c/Users/user/Desktop/Jayshankar      # WSL2 side; npm install fresh first
npm install && npm run typecheck && npm run validate && npm run build   # expect 0 / 73-0-0 / 0
npx vite --port 5199 --strictPort &          # or npm run dev (5173)
node /tmp/t9c-verify.mjs                     # 25 live checks incl. palette + no-SVG-asset assertions
node /tmp/t9c-pixels.mjs                     # the §R4 contrast table, from the real screenshot
```

Worker-local helpers (outside the repo): `t9c-verify.mjs`, `t9c-pixels.mjs`, `t9c-boxes.json`,
`t9c-414.png`, `t9c-1280.png`, `t9c-414-more.png`.

---

## S1. Superseded first pass (image tiles) — condensed record

The first pass built the same screen with six Recraft-generated SVG tiles at `public/icons/`, a
stats strip, and a `useState` "More" panel. The auditor committed it as `3cd0bd5`, then the owner
asked for this rework. Recorded here only because earlier review referenced it:

- **Its measurements**: white labels on a dark gradient backing measured 7.17-19.19:1 (all AA);
  tiles were 185x185 at 414px; the gradient strip is what made the labels legible on orange/teal/sky.
- **Its T0/T1 calls** (superseded): `packing-2.svg` over `packing.svg` (the primary was white-canvas);
  More kept the white-canvas `more.svg` and was flagged; no sub-captions under the labels; More was an
  inline panel with no route; plain `<img src>` over a `?url` import.
- **Two findings that outlived it**: (i) `public/icons/` was git-ignored, so a fresh clone would have
  404'd every tile — the auditor fixed the `.gitignore` rule in `edb93f0` (now moot for the tiles,
  since this rework uses no image assets at all); (ii) the brief described a 204-line
  `RepDashboard.tsx` when the file was 154 lines — verified a typo, as no commit in the file's
  history had 204 lines, so it was not treated as drift.
