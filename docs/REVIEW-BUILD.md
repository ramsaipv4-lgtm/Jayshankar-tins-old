# Shipping the storybook for client review — operator doc

> **Sending the workflow picture book to the client on its own, before the app is finished.**
> The deck is a read-only brochure: it touches no data and calls nothing. That is what makes
> this the cheapest possible first review round.

---

## 1. What "ship it alone" means here

One URL, no account, phone-first:

```
https://<your-site>/  →  #/review
```

Full link to send: `https://<your-site>/#/review`

`#/review` is a **public route** (`src/pages/StorybookReview.tsx`) that renders the same 32 chapters
as `#/storybook`, but outside the signed-in app shell. It has no notification bell, no sign-out,
and no way to reach a dashboard.

### Why the public route exists and did not before

`#/storybook` is an in-app route: it renders inside `Layout`, whose header fetches the unread
notification count and reads the session. A client opening that link with no account would have
arrived at a broken screen, or at the sign-in form. So the review build needed its own shell. It is
checked in `App.tsx` **above** the loading/error/session branches, for the same reason
`#/accept-invite` is — nothing about it should depend on a session resolving.

### What is exposed, and why that is acceptable

Nothing. The entire storybook subtree is static literals: 32 chapters in
`src/lib/storybook/chapters/`, rendered by `src/components/storybook/`. There is no Supabase call
anywhere in it and no user data on screen — every name, container code, rupee figure and vendor in
the deck is a sample. The rest of the app stays behind auth exactly as it is today. The route is not
linked from any nav, so it cannot be wandered into.

---

## 2. Deploy it

No new infrastructure. This is the **same build as the app** — the review route is one more
branch in the router — so it goes out with the existing Netlify pipeline.

```powershell
npm run build      # → dist/
```

Then deploy per `docs/DEPLOY-NETLIFY.md` (the repo already pins build command, publish dir, Node 20
and the SPA fallback in `netlify.toml`). If the app is already live, a `git push` is the whole job.

**Send the link as `https://<site>/#/review`.** Keep the `#` — everything after it is the router's
business, and the server only ever serves `index.html`.

> **If the app is not deployed yet, or you want the deck on its own URL, read §7 first.** The deck
> has its own build (`npm run build:storybook`) that ships without the app, without Supabase and
> without any secrets — and on that build the link is the site root, not `#/review`.

---

## 3. The client's phone — verified, not assumed

Measured on the running app in a real browser at 360 / 414 / 700 / 1400px:

| What | Result |
|---|---|
| Horizontal page overflow | **0px at every width** — nothing to scroll sideways except on purpose |
| Phone chapters (1–24) | Frame renders 306×540 on a 414px screen — body text at ~90% of design size, **directly readable** |
| Desktop chapters (25–32) | Fit at 30% (354px) — the *shape* of the panel is visible, the words are not, until magnified |
| Console / page errors | **0** |
| Works signed out | Yes — no `Sign out`, no sign-in form |

For the desktop chapters there is a **Magnify to read** button (mobile only), which renders the
panel 1:1 inside a horizontally scrollable strip — drag across it to read. Verified: the frame
renders 1180px wide inside a 390px strip with the page itself still at 0px overflow, so the panning
stays contained in the stage. The button is hidden at laptop width, where the panel already renders
at 615px and reads as-is.

**Tell the client this in one line:** chapters 1–24 read fine on the phone; chapters 25–32 are the
web dashboard, so tap *Magnify to read* and drag sideways.

---

## 4. Should it be an APK instead? No — not for this.

The Android project genuinely exists (`android/`, Capacitor, `appId: com.jayshankar.fishwholesale`)
and the real app will ship that way. For a *design review* it is the wrong tool:

| | Link / PWA install | APK |
|---|---|---|
| Client opens it | Tap the link — done | Enable "install from unknown sources", download, install |
| After he comments and we fix | Refresh; he sees the fix | Rebuild, re-download, re-install |
| Works on iPhone | Yes | No |
| Store distribution | Not needed | Play Store review |
| Buildable in this repo right now | Yes (`npm run build`) | **No** — no JDK and no Android SDK in this environment (`java`, `~/Android/Sdk`, `gradle` all absent) |

If the client wants an icon on his home screen, the app is **already a PWA** (`vite-plugin-pwa`,
manifest + icons, `registerType: autoUpdate`) — the link installs to the home screen and behaves
like an app, including offline after the first load. Same icon, none of the APK overhead. Keep the
APK for the milestone where the real workflow is wired and he needs to *use* it on the floor.

---

## 5. What to send, and how to get useful comments back

Send the link with this in the message — it sets the two expectations that otherwise produce
unusable feedback (that the figures are real, and that he has to hunt for things):

> Picture book of the whole workflow — 32 chapters, 104 screens. Tap any chapter, then *Play* to
> watch it run through. Figures are samples. Screens are numbered, so reply with "chapter 3, step 2"
> and I'll know exactly which one. Chapters 25–32 are the web version — tap *Magnify to read* and
> drag sideways.

Three things that make the feedback actionable:

1. **Deep links.** `#/review?c=receiving&s=2` opens one exact screen. When he says "this one is
   wrong", ask him to paste the address bar — no more "the screen with the green button".
2. **Ask for a verdict per chapter, not a general impression.** "Right / wrong" per chapter gives
   us a worklist; "looks good" gives us nothing.
3. **Surface the two open questions while he is in the deck** — they are the expensive ones:
   - **Grading spec.** Chapter 4 splits the catch by size and weight grade. The three tables in
     block 3 need his actual grades and price steps — the deck uses placeholders. This is the one
     place where the deck is *waiting on him*, not the other way round.
   - **Does the app own procurement?** If yes, the twelve desk panels are workflow and stay as
     drawn. If procurement stays outside the app, most of those panels are reporting and the scope
     roughly halves. Worth asking before anything is built behind them.

---

## 6. Pre-send checklist

```powershell
npm run typecheck   # tsc clean
npm run validate    # must still read 73 pass / 0 fail
npm run build       # exit 0
```

Then open `#/review` **in a private window** (to prove it works with no session), at phone width,
and check: the index lists all 32 chapters; a *phone* chapter shows a full frame with working
Prev/Next/Play; a *desktop* chapter shows the Magnify button and drags sideways; back from a
chapter returns to the index. That is the whole surface the client will touch.

---

## 7. Hosting the deck on its own (GitHub Pages, no app, no secrets)

### Why this needs its own build

The deck is normally a *route inside the app* (`#/review`). Deploying the app bundle to show it does
not work: the bundle evaluates `src/lib/supabase.ts` at import time, and that module **throws** when
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are absent — so a bare deploy white-screens at
*every* route, `#/review` included. "Just the storybook" therefore needs its own entry point, which
is why `src/storybook-main.tsx`, `storybook.html` and `vite.storybook.config.ts` exist.

```powershell
npm run build:storybook      # → dist-storybook/     (1.6 MB)
npm run preview:storybook    # look at it locally first
```

What comes out: `index.html` (renamed from `storybook.html` by
`scripts/rename-storybook-entry.mjs`, because the repo root's `index.html` belongs to the app), one
JS bundle, one CSS file, an icon, a web manifest and a service worker. Total **1.6 MB**, of which
0.34 MB is JS — and it contains **no Supabase client anywhere**, which is exactly why this build
needs **no environment variables and no secrets**.

### Steps

```text
1. Push the repo (there is no remote yet):
     git remote add origin git@github.com:<owner>/<repo>.git
     git branch -M main
     git push -u origin main

2. Settings → Pages → Source = "GitHub Actions"

3. Push a change under src/lib/storybook/**, or run it by hand:
     Actions → "Deploy storybook to GitHub Pages" → Run workflow

4. The URL is  https://<owner>.github.io/<repo>/   — send that link.
```

The workflow (`.github/workflows/deploy-pages.yml`) builds with `VITE_BASE=/<repo>/` and publishes
`dist-storybook/`. If the site is served from the **root** instead (a `<owner>.github.io` repo, or a
custom domain), set the repository **variable** `PAGES_BASE` = `/`: the base is what rewrites the
asset URLs and the PWA's `start_url`/`scope`, so getting it wrong is the classic white page.

### What the client gets

- **No login**, no app, no dashboards — opening the link *is* the deck.
- The index of 32 chapters; tap one, then **Play** to watch it run itself.
- **Add to Home Screen** gives a real Jayshankar icon (the build ships a manifest + service worker),
  and it keeps working with no signal — useful on mobile data.
- Deep links on this build look like `https://<host>/<repo>/#/?c=receiving&s=2` — note the `#/?`,
  not `#/review?`. Everything else in §5 still applies.

### Two notes

- **Pages hosts one site per repo.** Deploying the deck means the app is *not* at that URL. If you
  later want the full app there instead, change the build step to `npm run build` with
  `path: dist`, and add the two secrets (names in `docs/DEPLOY-NETLIFY.md` §1). The deck stays
  available at `#/review` on that deploy — it is the same code.
- **Updates.** The service worker auto-updates on the next visit. If the client says he still sees
  an old screen after you ship a fix, have him close the tab and reopen the link — that is the PWA
  cache doing its job, not a failed deploy.
- **Repo visibility.** Pages will not serve a *private* repo on the free plan. The deck itself holds
  no client data (every figure is a sample) and no secrets, but the repo also contains the app
  source — see `docs/DEPLOY-GITHUB-PAGES.md` §1 before deciding.

---

## 8. The second deck — the same chapters in Ant Design

### Why there are two decks

The client is choosing how the app should look, and asked to see the flow in Ant Design as well as
the Tailwind build he has already reviewed. Showing him is better than arguing, so the same 32
chapters are rendered twice and he picks by looking.

**What is identical, and what is not (revised 2026-10-02).** The *content* is identical: the same
`src/lib/storybook/` chapter data (chapters, steps, captions, figures), the same 340×600 phone frame and
1180×720 desktop panel, the same block drawings, and the same `#/review?c=…&s=…` deep links. The *shell*
is not: deck 2 originally reused deck 1's Tailwind player with Ant widgets inside it, which made it look like
deck 1 with a different button style — a poor test of "what would the app be like in Ant Design". It was
therefore rebuilt as a native Ant workbench: sidebar `Menu` (a `Drawer` on phones), `Breadcrumb`, a clickable
`Steps` walk-through in place of the caption line and filmstrip, tap-the-screen-to-enlarge in a `Modal`
lightbox (Fit / Actual size, swipe, ←/→, Esc), `Tabs` + `Segmented` + `Input.Search` on the home page with
live thumbnails, a guided `Tour`, and a dark mode. Judge the two decks on feel and navigation as well as on
colour and components.

| | Deck 1 — the app's own look | Deck 2 — Ant Design 6 |
|---|---|---|
| Shell | `src/components/storybook/ChapterPlayer.tsx` (Tailwind) | `src/components/storybook-ant/deck/` (`AntDeck`, `AntHome`, `AntChapterView`, `Lightbox`, `AntNav`) |
| Renderer | `src/components/storybook/blocks.tsx` (Tailwind) | `src/components/storybook-ant/mock/` (`phone.tsx`, `desktop.tsx`, `charts.tsx`, `ScrollArea.tsx`, `tone.ts`) — composition layers, decision 97 |
| Block kinds drawn | 24 | 24 (all of them; `tsc --noEmit` clean) |
| Build | `npm run build:storybook` → `dist-storybook/` (408 KB) | `npm run build:storybook-ant` → `dist-storybook-ant/` (1.4 MB; 414 KB gzipped JS) |

```powershell
npm run build:storybook-ant      # → dist-storybook-ant/
npm run preview:storybook-ant    # look at it locally first
```

**Built and deployable as of 2026-09-29.** The entry (`src/storybook-ant-main.tsx`), the HTML shell
(`storybook-ant.html`), the Vite config (`vite.storybook-ant.config.ts`) and the entry-rename script
(`scripts/rename-storybook-ant-entry.mjs`) are in place. The build exits 0 and emits the same shape as
deck 1: an `index.html`, one JS bundle, one CSS file, a web manifest, an icon and a service worker.
antd is most of the bundle — this deck is about three times deck 1's size, and 414 KB gzipped is the
visible price of the design system. Worth knowing before deciding it is the one to ship.

**Publishing it.** Same flow as §7 — its own repo, GitHub Pages, `VITE_BASE=/<repo>/` — with
`build:storybook-ant` in place of `build:storybook` and `dist-storybook-ant/` in place of
`dist-storybook/`. One gap: `scripts/publish-storybook.sh` is deck 1's script and hardcodes
`dist-storybook/` and deck 1's deploy remote, so deck 2 needs either its own `DEPLOY_DIR`/remote pair
or a deck flag added to that script. Not done yet — until it is, deck 2 is built but not published.

**Send both links together.** The decks are only useful as a pair: same chapters, same steps, same
figures, two design languages. The shell of deck 2 already links to deck 1 (the `TAILWIND_DECK`
constant in `src/pages/StorybookAntReview.tsx`) — set that to deck 1's published URL before pushing.

### Two things that must not drift

- **The QR codes.** Container codes are drawn by a deliberately fake but deterministic generator
  (FNV-1a over the code, seeded into an LCG, with the three finder squares drawn for real). Deck 2
  uses a **copy** of deck 1's algorithm on purpose, so `TC-0042` looks the same in both. A real QR
  encoder is a dependency this review deck does not need; identical output between the two decks is
  what the whole comparison rests on.
- **The figures.** Both decks read the same chapter data. A number that differs between them is a
  renderer bug, not a data difference.

### What it is not

- **Not routed in the app.** There is no `#/storybook-ant` route and no runtime flag. `plan.md`'s own
  D2 is explicit that the two systems must never share a screen; one build that swaps only the
  renderer satisfies that without a toggle. `antd` is imported by `src/components/storybook-ant/`
  and by nothing else, so the app's bundle is unchanged — see `docs/ARCHITECTURE.md` §Stack and
  `SPEC.md` §4.1.
- **Not a decision.** Which look wins is **D67** in `SPEC-AMENDMENT-v4-plan-md.md`, and it is open
  until the client answers. Nothing about the app changes while it is open.

### What to send, and what to ask

Send both links to the same chapter. Ask two questions: which one reads like the business, and
whether any single screen makes the choice for him — a table, the container card, the receiving
form. The answer is what closes D67, so it belongs in `SPEC.md` §0.2 and `docs/DECISIONS.md`, not in
a chat thread.

---

## 9. The third deck — "The Run": what the v3 and v4 amendments add, shown from every seat

### Why a third deck, and why it is a different *kind* of deck

Decks 1 and 2 draw the same 32 chapters of the **existing** workflow, so the only variable is design language
(D67). Neither can show what `SPEC-AMENDMENT-v3-truckload.md` and `SPEC-AMENDMENT-v4-plan-md.md` actually add,
because what they add is mostly about **who sees what**: the person at the scale must not see vendor or price, a
procurement rep is refused, an admin sees everything, a reviewer cannot approve their own bill. A one-phone-per-step
picture book cannot say that. So this deck changes the *format*, not just the paint:

| | Decks 1 & 2 | Deck 3 — The Run |
|---|---|---|
| Unit | chapter → step → one screen | **act → moment (on a day's clock) → lens → several devices at once** |
| Story | the existing workflow, chapter by chapter | **one truck load, planning to payment**, with the 14 decisions D63–D76 pinned to moments |
| Roles | implied | explicit: the same instant redrawn for receiver, rep and admin |
| Evidence | none | a **database panel** per moment: what the function returned, with absent keys struck through |
| Status | none | each moment carries its decision, acceptance criteria and **whether it is built** (from the amendments' own status check) |
| Data | `src/lib/storybook/` | its own v3/v4 day (`src/lib/storybook-run/`) **plus** the same chapters and persona walks as decks 1–2, converted by `from-chapters.ts` (shares data, never renderer code) |
| Look | Tailwind / Ant Design | hand-written CSS (warm ledger paper, serif numerals, ticket-stub documents); **no new dependency** |

Contents (8 acts, 28 moments, 14 decisions): Act 1 the mode switch (D63) · Act 2 optional trip planning (D66) · Act 3
buying on the road — consolidation, landed cost, the **offline queue** and a **proposal** for sync conflicts (D64, D69,
D71) · Act 4 **the blind scale** (D65, D68), drawn both as v3 specified it (a new role) and as Phase B built it (a flag),
because the two designs disagree (`HANDOVER.md` W12) · Act 5 per-document **approvals** (D70) · Act 6 money vs the
scale and the derived landed cost (D75) · Act 7 who may do what — five roles, closed-by-default functions (D71–D73) ·
Act 8 the open design choice (D67) with a local vote, and how to cite a moment (D74).

### Build and run

```powershell
npm run dev:storybook-run                 # live, http://localhost:5173/storybook-run.html
VITE_BASE=./ npm run build:storybook-run  # → dist-storybook-run/ (≈ 420 KB, 113 KB gzipped; relative base works at any path)
npm run preview:storybook-run
```

`VITE_BASE=./` (relative assets) was verified under a deeply nested path; use `/<repo>/` instead if you prefer an
absolute base for GitHub Pages. **As with deck 2, do not run the build inside a folder that is a git clone**:
`emptyOutDir` deletes its `.git`. Build, then copy the output into the deploy clone.

It deliberately has **no service worker** (decks 1 and 2 ship one; deck 2's generated worker precached an entry the
rename step had removed, a stale-cache trap for a site republished often and opened once). The deck is a few hundred
kilobytes and a reviewer should always get the latest.

### Three things worth knowing before you show it

- **The "blind" screens carry no vendor or price data at all** — the black bars are drawn over *nothing*. That is
  tested (`src/lib/storybook-run/deck.test.ts`: it fails if a receiver view's data contains a vendor name or a price,
  and was confirmed to fail when the leak was put back). A blur over real numbers would only be a drawing.
- **Amounts are derived from one fixture** (`fixtures.ts`): the weighted average (₹634.00/kg over 400 kg of Seer),
  the weighing (385 good + 12 spoiled = 397 counted, 3 short) and Indian digit grouping are tested, so screens cannot
  disagree with each other. All vendor names, the vehicle and the prices are invented.
- **Some screens are proposals and say so**: the sync-conflict screen (D69 leaves the rules undecided) and the
  "effective cost per good kilo" idea (in neither amendment) are labelled, not presented as spec.

### What to send, and what to ask

Send it alongside the other two, with the same single question (D67), plus one specific to this deck: *does seeing the
same moment through three roles make the receiving rules clearer than a screen per feature would?* The answer to the
second decides whether the other decks should adopt the format.

---

## 10. Three decks, one dataset, and how they connect

### What changed after the first review of deck 3

The first version of The Run was good on format but wrong on two counts: it had nothing to compare against the
other decks, and it was too dense for a client who skims. Both are addressed together by making **the data shared**:

- **Persona walks** (`src/lib/storybook/journeys/`): twelve people, each on the device they really use — *the admin at
  the desk* (desktop), *the admin on the phone*, *the buyer on the road*, *the one at the scale* (blind receiving, records
  the discrepancy), *the grader*, *the packer who delivers* (a task: pack this much, take it there), *the salesperson*,
  *the floor, all day*, *money from the owner's chair*, *when a customer calls with a problem*, *a new person joins*,
  *moving stock between warehouses*. Only the first is desktop; the rest are phone-only, as asked. They are **ordinary
  chapters** in a new first group, built mostly from the 32 chapters' own screens plus ~30 screens the deck lacked
  (trip task, offline queue, truck-load board, blind receiving, approvals, access, delivery, transfer, credit warning…).
  Anything **proposed and not in the app** (delivery tracking and proof of delivery) is labelled "Proposed" on the screen.
- Because they are chapters, **decks 1 and 2 play them with the players they already have**, deep links included; and
  **The Run draws all 44 chapters** (the 32 + the 12 walks) through `from-chapters.ts`. So the same chapter id, step,
  caption and figures appear in three looks — which is what makes them comparable (D67).
- **Lighter by default.** The Run opens on *people*, then the one question (which look?). The v3/v4 day, the decisions atlas
  and all 32 chapters are folded. A **Simple / Reviewer view** toggle controls the density: simple shows screens and one line
  of story; reviewer adds decisions, acceptance criteria, build status and the database panel (one tap away even in simple).

### How the three connect

- **One address format** — `<deck>#/review?c=<chapter or walk id>&s=<step>[&embed=1]` — works in all three
  (`src/lib/storybook/decks.ts`). Every deck has a **"same screen in…"** control that lands on the identical chapter and step
  in the others (deck 1 header pills, deck 2 header dropdown, The Run's top bar).
- **`embed=1`** draws just the device and its caption (no header, rail or controls) in every deck.
- **Compare** (`#/compare` in The Run): one set of controls (person/chapter, step, layout) drives three frames — the real
  decks, each showing exactly that screen. Phone screens default to side by side, desktop screens to stacked. To compare
  against local copies before anything is published: `#/compare?c=walk-buyer&s=2&tw=<deck 1 url>&ant=<deck 2 url>`.
  A blank pane means that deck is not published at its address yet.

### Publishing all three

| Deck | Repo (create this) | Pages URL | Build |
|---|---|---|---|
| 1 Tailwind | `Jayshankar-ui` (exists) | `https://sairampv98.github.io/Jayshankar-ui/` | `DECK=storybook bash scripts/publish-storybook.sh` |
| 2 Ant Design | `Jayshankar-ui-antd` (exists) | `…/Jayshankar-ui-antd/` | `DECK=storybook-ant bash scripts/publish-storybook.sh` |
| 3 The Run | **`Jayshankar-ui-run`** (new) | `…/Jayshankar-ui-run/` | `DECK=storybook-run bash scripts/publish-storybook.sh` |

The script builds with the right base, syncs into a clone at `~/jayshankar-ui-run-deploy` (clone the new repo there first),
commits and pushes. **All three must be republished** — decks 1 and 2 changed (they now carry the walks, the looks bar and
embed mode), and the Compare page only works once all three are live. If you choose a different repo name than
`Jayshankar-ui-run`, change `DECKS.run` in `src/lib/storybook/decks.ts` and rebuild. Folders already built for a manual
push: `dist-storybook/` (deck 1), `dist-storybook-ant/` (deck 2 — it is a git clone; push from inside it), and
`dist-storybook-run/` (deck 3 — new; `git init` it or use the script).

### Verified, and what is not

`tsc`, `npm run validate`, `npm run selftest`, 37 vitest tests (walk invariants including that the receiving walk carries no
vendor or price; the adapter drops no block; addresses round-trip; deck 3's own invariants). Sweeps: all 232 Run moments at
phone and desktop sizes (500 checks) on the dev server **and** the production build served from the real Pages paths;
the twelve walks (400 loads) in decks 1 and 2; 23 interaction checks; and a production Compare test on four screens
(phone chapter, walk, desktop chapter) with all three frames showing the screen. **Not verified:** a real phone or a
non-Chromium browser; the live Pages URLs (nothing is published from here); decks 1–2's service workers on a device.
