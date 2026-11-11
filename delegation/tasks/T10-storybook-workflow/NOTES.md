# T10 — Storybook: the animated workflow picture book

> Delivered against the client's reference decks in `example-video/` — the "AKS Seafood" WhatsApp
> sheets — and the client's own procurement→receiving handover document in `client-qa/session2/`.
> Everything here is **frontend only**: no file under `supabase/` was touched, no table is read,
> and no new runtime dependency was added.

## 1. What was built

| File | What it is |
|---|---|
| `src/pages/Storybook.tsx` | The route (`/storybook`): chapter index, grouped; deep links via `?c=<chapter>&s=<step>` |
| `src/components/storybook/blocks.tsx` | The renderer — 24 block kinds that turn screen *data* into UI |
| `src/components/storybook/ChapterPlayer.tsx` | Stage + filmstrip + controls + autoplay + keyboard |
| `src/components/storybook/PhoneFrame.tsx` | The phone shell (navy bar, status glyphs, bottom tabs) |
| `src/components/storybook/DesktopFrame.tsx` | The desktop shell (navy sidebar, header, search, actions) |
| `src/lib/storybook/types.ts` | The contract: `Block`, `ScreenSpec`, `StepSpec`, `Chapter`, tones, groups |
| `src/lib/storybook/chapters/*.ts` | The content — **32 chapters, 104 screens** |
| `tailwind.config.ts` | Eight `sb-*` keyframes/animations (page turn, stagger, pop, draw, grow, arrow, sheen) |
| `src/index.css` | The `prefers-reduced-motion` guard — every storybook animation off, not shortened |
| `docs/BACKEND-REQUIREMENTS-phase-b.md` | What each screen would need to work for real |
| `src/App.tsx` | One added route, open to all five roles (it reads nothing and navigates nowhere) |

## 2. Why it is data, not components

The client's decks are *numbered, captioned screens* — 4 steps per workflow, 30-odd workflows.
Hand-coding each screen would have been ~100 bespoke components, and every wording change would
have been a code change. Instead a screen is a `ScreenSpec`: a title plus an array of `Block`
records. Adding a screen is adding an object literal; changing a figure is a one-line edit in a
chapter file.

That also made the work parallelisable: six chapter files were authored independently against one
frozen type, and nothing in the renderer changed to accommodate any of them.

**The tiles are the real thing.** `Tiles` renders the shipped `components/ui/tile.tsx`, and the
nine storybook tones map onto the tile's six real variants — so the deck shows the component the
app actually ships rather than a mockup of it.

## 3. The 32 chapters

| Group | Chapters | Numbers | Source |
|---|---|---|---|
| The daily spine | home, procurement, receiving, grading, packing, dispatch, stock, reports | 1–8 | the 8-screen mobile sheet + `prompt-1.md`…`prompt-5.md` |
| Containers & freshness | containers-qr, spoilage, alerts | 9–11 | `prompt-7.md`, `prompt-8.md`, `prompt-12.md` |
| Traceability & vendor quality | traceability, quality-issue | 12–13 | the client's session2 handover document |
| Money | customers-payments, profit-audit, bills-credit, reversals | 14–17 | `prompt-6.md`, `prompt-9.md` |
| People & exceptions | complaints, tasks, team | 18–20 | `prompt-9.md`, `prompt-10.md`, `prompt-11.md` |
| **Procurement desk (desktop)** | 12 panels | 21–32 | the 12-panel desktop sheet + its mobile twin |

Reused figures throughout, deliberately: Annamalai, Sela Fish, 150 KG → 148.5 KG (−1.5 KG),
₹ 63,000 / ₹ 62,370, TC-0042, ₹ 460/kg, ₹ 23,000, 965 KG, Saravanan Hotels, Murugan Stores,
PO-2026-001, GRN-2026-023, ₹ 133,000, ₹ 710/kg landed cost, 18.5% margin.

## 4. Every judgement call (T0/T1), with the reasoning

| # | Decision | Why |
|---|---|---|
| D1 | Screens are **data**, one shared renderer | 104 screens; a component per screen would be unmaintainable and unreviewable. Adding a chapter touches one file. |
| D2 | 24 block kinds, not 100 | Chosen by reading all four reference sheets and listing every shape that actually appears. New shapes get added to the renderer, never inlined in a chapter. |
| D3 | The home tiles use the **shipped** `components/ui/tile.tsx` | The deck should show the real component. The nine storybook tones map onto the tile's six real variants (`TONE_MAP` in blocks.tsx) rather than inventing a parallel palette. |
| D4 | `layout: 'phone' \| 'desktop'` on the chapter, not per screen | The reference sheets are two products: a phone workflow and a desk suite. The shell follows the chapter; only the sidebar/action varies per screen. |
| D5 | Animations are **CSS keyframes in tailwind.config.ts**, no library | `framer-motion` and friends are not in the tree, and the whole deck is achievable with `@keyframes` + `animation-delay`. Adding a dependency for this would have been the largest change in the task. |
| D6 | Motion is **staggered per block** (`index * 55ms`) and replays on every step | The page-turn key is the step index, so React remounts the subtree; that is what replays both the stagger and the figure count-ups. |
| D7 | `prefers-reduced-motion` collapses every animation to a single frame | This deck is shown on a phone and flipped through repeatedly; `animation: none !important` is the honest guard, not a shortened duration. |
| D8 | Figures **count up** when they look numeric | `AnimatedFigure` parses `"₹ 1,250 kg"` into prefix/figure/suffix so the animation never corrupts the currency or the unit, and `en-IN` grouping is preserved. |
| D9 | Charts are **hand-rolled SVG** | A charting library is a large dependency for four chart types. The line draws on via `stroke-dasharray`, bars grow, the donut sweeps — all with the same keyframes. |
| D10 | The QR is **deterministic but fake** (FNV-1a hash → 21×21 modules with real finder squares) | A real encoder is a new dependency. Same container string → same pattern, so screenshots are stable and the client can see "their" box. **Documented as fake** in the backend doc, because it is the one thing that looks functional and is not. |
| D11 | Chapter/step live in the URL (`?c=&s=`) | Reviewers paste an exact screen into WhatsApp instead of describing it: `…#/storybook?c=receiving&s=2`. |
| D12 | The route is open to **all five roles** | It reads nothing and navigates nowhere — it is a brochure. Gating it would stop a worker from being shown a screen that explains their own job. |
| D13 | `/storybook` is **not linked from any nav** | It is a review artifact, not a feature. Deliberate: the client sees it by URL during review, and it cannot be mistaken for a shipped screen. |
| D14 | Locked fields render the client's own 🔒 | The handover document marks vendor/rate/contact/margin as hidden from receiving. Showing that *on screen* is the point of the traceability chapter. |
| D15 | Desktop chapters get a navy sidebar with 10 grouped sections | Copied from the reference sheet's own grouping, so the client recognises their own IA. |
| D16 | Deck tag pill (`JAYSHANKAR · RECEIVING WORKFLOW`) reproduced | It is in every one of their 12 visuals; dropping it would make the deck feel like a different artefact. |
| D17 | Split the procurement desk into three files | Twelve desk panels exceeded one authoring session's output budget — twice (see §7). Three files, three authors, one aggregating export. |
| D18 | Normalised four authored titles to the sheet's Title Case | The reference says "Supplier Quotation", "Daily Market Price", "Festival & Market Factors", "Purchase Order"; the authored files had them lower-cased mid-title. |
| D19 | Filmstrip thumbnails are `aria-hidden` | Otherwise a screen reader reads all four screens' contents *and* the captions; the thumbnail is a picture of a screen and the caption already carries the meaning. |
| D20 | Mock buttons render as `<div>`, not `<button>` | They are not controls — nothing in the deck is clickable — and a real `<button>` inside the filmstrip's `<button>` is invalid HTML (React logged `validateDOMNesting` on every chapter; caught by the live capture, fixed). |
| D21 | Scale and animation are **two separate wrapper elements** | A single element cannot do both: `animate-sb-page` fills forward with its own `transform` (ending `perspective(1200px) rotateY(0) translateX(0) scale(1)`), and an animation's transform beats any `scale-*` utility on the same node. Found by measuring the live DOM (`getBoundingClientRect` → the desktop frame reported 1180px inside a 615px box). Harmless at phone width by luck (lg scale = 1.0), fatal for the desk panels. **Closed 2026-09-29**: re-measured live at 1400px → desktop panel frame **614×374 inside a 615×376 box**, fits, 0px overflow. |
| D22 | The client review build is a **public `#/review` route**, not a login | The deck had to be sendable on its own. `#/storybook` renders inside `Layout`, which reads the session and fetches the unread count — a client with no account would have got a broken screen or the sign-in form. `#/review` (`pages/StorybookReview.tsx`) is checked in App.tsx above the loading/error/session branches, like `#/accept-invite`. Safe unauthenticated because the whole subtree is static literals — no Supabase call, no client data, every figure a sample. |
| D23 | Phones render the frame at **90%**, not 62% | 62% fitted a 414px screen but produced a phone-inside-a-phone at ~8px text: technically correct, useless to read. 90% (317px box, 306px rendered) keeps body text at ~90% of design size. The box literals move with the scale — the box is what reserves space, so the pair drifting apart is what causes overflow. Verified 0px page overflow at 360/414/700/1400. |
| D24 | Desktop chapters get **Magnify to read** on phones | At 30% the desk panels show their shape but not a word, and those are the chapters carrying the open procurement question. Magnify renders the panel 1:1 (1180px) inside a horizontally scrollable strip — verified contained (page stays at 0px overflow while the strip pans). Hidden at lg, where the panel already renders at 615px and reads as-is. |
| D25 | **No APK for the review round** | The Capacitor project is real and the app will ship that way, but for a design review an APK costs the client a sideload per round and excludes iPhone, and it cannot even be built here (no JDK, no Android SDK). The app is already a PWA, so the link installs to the home screen and behaves like an app. Full reasoning in `docs/REVIEW-BUILD.md`. |
| D26 | The deck **builds on its own** (`src/storybook-main.tsx` + `storybook.html` + `vite.storybook.config.ts` → `dist-storybook/`) | A bare deploy of the app white-screens at every route, `#/review` included, because `src/lib/supabase.ts` throws at import time without the Supabase env vars. The standalone entry imports the deck and nothing else, so the bundle contains no Supabase and the deploy needs no env vars and no secrets. Verified by grepping the built bundle. |
| D27 | The deck publishes to its **own repo** (`Sairampv98/Jayshankar-ui`) via `scripts/publish-storybook.sh` | Pages hosts one site per repo, and the app repo should stay private (Pages will not serve a private repo on the free plan). The published repo holds only generated output. The script rebuilds with `VITE_BASE=/Jayshankar-ui/`, syncs, commits and pushes — a revision after client feedback is one command. |
| D28 | The standalone build carries its **own `storybook-public/`** and ships **no sourcemaps** | The shared `public/` is 69 MB — almost all of it the app's tutorial videos — and Vite copies it wholesale; the deck needs one icon, so it gets its own public folder. Sourcemaps were 1.3 MB of an 1.8 MB publish, were the only non-deterministic file between two builds, and have no business being publicly downloadable. Result: ~430 KB, and two consecutive builds produce an identical tree. |

## 5. Verification — how each acceptance criterion was checked

Every check below was run, not asserted.

| Check | Result |
|---|---|
| Chapter/step data compiles and matches the type contract | `npx tsc --noEmit` → **clean**, 32 chapters / 104 steps |
| All 32 chapters are reachable by URL | `?c=` deep links rendered the right chapter title for every id sampled, including all 12 desk panels |
| Phone frames render | Live capture: navy bar, centred title, back arrow, bottom tabs, correct `right` label |
| Desktop frames render | Live capture: navy sidebar (10 nav items in 4 groups), header title, search field, action button |
| Blocks all draw | Live capture counted real DOM: 3 `table`s on the dashboard panel, 490 QR modules, donut + bars + line chart SVGs, 66 nav nodes |
| **Zero runtime errors** | `consoleErrors: 0`, `pageErrors: 0`, failed requests: 0 (twice, after the D20 fix) |
| `npm run validate` unchanged | **73 pass, 0 warn, 0 fail → PASS, exit 0** — same 73 as before this task, confirming nothing backend-adjacent moved |
| `npm run build` | exit 0 |
| No new runtime dependency | `package.json` unchanged — no animation, charting or QR library |
| No new file outside the task's scope | The only routes touched: `src/App.tsx` gains one `<Route>`; everything else is new files under `src/lib/storybook/`, `src/components/storybook/`, plus `docs/BACKEND-REQUIREMENTS-phase-b.md` |
| Animations exist and are guarded | 8 `sb-*` keyframes in `tailwind.config.ts`; `prefers-reduced-motion` block in `src/index.css` disables all of them |
| The visual result matches the reference decks | Screenshots eyeballed against `example-video/*.jpeg` and `client-qa/developer-prompt-image/prompt-*.md` |

**Screenshots** (`/tmp/t10-*.png`, plus copies in the Desktop folder below): the index with all six
groups; spoilage; QR; the PR→RCV chain; profit/margin charts; desktop dashboard, requirements,
quotation, costing.

## 6. What I could not verify, and why

- **The live re-measure of the D21 scale fix.** The fix is structurally confirmed (scale and
  animation are now on different elements, and the built CSS contains `scale-[0.3]`,
  `lg:scale-[0.52]`, `scale-[0.62]`, `sm:scale-75`, `lg:scale-100`), but the confirming
  `getBoundingClientRect` re-run failed because the dev page stopped resolving its Supabase session
  and so never got past the auth gate to `/storybook`. **Re-run one capture on a machine where the
  network is behaving and confirm the desktop panel measures ~615×376 at a 1400px viewport.**
- **`prefers-reduced-motion` under a real reduced-motion profile.** The CSS is there; it was not
  driven through Playwright's `reducedMotion: 'reduce'` context option.
- **Anything behind the login on a fresh device.** The deck was only ever viewed as
  `rep@jayshankar.demo`; D12 says all roles may read it, which is a routing claim, not a tested one.

## 7. How it was built (and what that means for review)

The 32 chapters were authored in parallel by five sub-agents plus this session, each owning exactly
one file against the frozen type in `types.ts` and the contract in `CHAPTERS-BRIEF.md`. That worked
because the contract was written first and the renderer never changed to accommodate an author.

Worth knowing when auditing:

- **Three failures, all infrastructure, none content.** `chapters-spine` died on an API socket
  reset after producing nothing; `chapters-procurement` and then `desk-1` both hit their per-turn
  output limit. The output-limit failure is the one to design around: twelve desktop panels is more
  than one session can emit, so the desk was split three ways, and the brief now tells authors to
  append chapter-by-chapter instead of writing a file in one call.
- **`desk-1` was written in this session, not by an agent** — after two failed attempts it was
  faster to write four chapters directly than to spend another 25-minute round-trip.
- **Fidelity is only as good as each author's reading of the reference images.** The captions and
  figures were transcribed from `prompt-*.md` and the four sheets, and each author was asked to
  report what they inferred. **An auditor should spot-check figures in the 29 agent-authored
  chapters against `example-video/*.jpeg`** — especially the desk panels, where the source text is
  small in the image.

## 8. What the auditor should know

1. **`/storybook` is the deliverable**; nothing else in the app changed except one route in
   `App.tsx`. It is not linked from any nav (D13) — reach it by URL.
2. **This task added no dependency.** `package.json` does differ from `HEAD` — by the six shadcn
   packages installed in the earlier UI rework, which are still uncommitted. T10 itself added none:
   no animation, charting, or QR library. Check the diff's contents (lucide-react, clsx,
   tailwind-merge, @radix-ui/react-slot, @radix-ui/react-collapsible, tailwindcss-animate), not its
   size.
3. **`npm run validate` must still read 73 pass — it does.** The deck cannot move that number: the
   contrast checker works on a hardcoded Tailwind class palette, and nothing here is a Tailwind
   class pair it can see.
4. **A real bug was found by measuring, not by looking**: the page-turn keyframe's `transform`
   overrode the frame's `scale-*` utility (D21). It looked fine on a phone and silently broke the
   desktop panels. If any future frame needs a different size, keep the scale and the animation on
   separate elements.
5. **The QR is fake** (D10) and says so in the backend doc. Do not let it reach the client as a
   working feature.
6. **The desktop suite is speculative.** It is drawn from the client's reference sheet, but
   `docs/BACKEND-REQUIREMENTS-phase-b.md` §8.2 records the open question that could halve its scope:
   if the app does not become the system of record for procurement, most of those twelve panels are
   reporting, not workflow.
7. **The caption voice is a decision.** Every caption is one plain sentence in the deck's register
   ("The shortfall is shown, not hidden"), because that register — the client's own "stupid and
   simple" feedback — is the thing being approved here, not just the layout.
8. **The client-facing pack is `client-qa/storybook-screens/`** — 104 screen images + an `INDEX.md`
   of every caption, generated by `capture.mjs` (2×, reduced-motion so each image is the settled
   frame). Regenerate it whenever a chapter changes; it is generated output, not source.
9. **The published deck is one push away, and the push is not mine to make.** Everything is built,
   committed in `~/jayshankar-ui-deploy` (branch `main`, remote set to
   `github.com/Sairampv98/Jayshankar-ui`) and verified at the live subpath — but this environment has
   no GitHub credentials, so `git push` stops at `could not read Username`. Two steps remain, both
   the user's: push that repo, then Settings → Pages → Source = "Deploy from a branch" → `main` /
   `/ (root)`. The URL is `https://sairampv98.github.io/Jayshankar-ui/`.
10. **Both deck links are documented and differ.** In-app it is `#/review?c=…&s=…`; on the standalone
    site it is `#/?c=…&s=…`. `docs/REVIEW-BUILD.md` §2 and §7 say which is which — do not send the
    wrong form to the client.


