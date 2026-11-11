# T10 — Storybook chapters: authoring brief

> **Audience: this brief is for whoever writes a `src/lib/storybook/chapters/*.ts` file.**
> Read `src/lib/storybook/types.ts` alongside it — the types, not this prose, are the contract.
> Every screen in the picture book is *data*. You are not writing components.

## 1. What you are producing

One file of chapter data. A chapter is a workflow (e.g. "Receiving"), a step is one phone or
desktop screen with the caption the client's reference deck prints under it.

```ts
import type { Chapter } from '@/lib/storybook/types';

export const CONTAINER_CHAPTERS: Chapter[] = [ /* … */ ];
```

**File contract**

- Write **exactly one** file, at the path you were given. Touch nothing else.
- Named export, `Chapter[]`, all chapters in ascending `number` order.
- No `import` other than the two type imports below. Chapter files import **no** components,
  no icons, no React:

```ts
import type { Chapter } from '@/lib/storybook/types';
```

- Do **not** run `npm`, do not commit, do not edit `types.ts`, do not edit anyone else's file.
- Comments: explain *why* a screen says what it says only where a reader would otherwise wonder
  (e.g. a figure that is deliberately exact because it comes from a real client document).

## 2. Screen content rules

1. **Fidelity beats invention.** Where the content exists in the sources below, transcribe it —
   the same names, the same figures ("Annamalai", "Sela Fish", "TC-0042", "148.5 KG", "₹ 63,000").
   Reusing the client's own numbers across chapters is a *feature*: it makes the deck feel like one
   business rather than 30 unrelated examples.
2. **Every chapter is 4 steps** unless the brief says otherwise, and each step's `caption` is one
   sentence in the deck's voice — plain, concrete, non-technical, describing what the person does.
   Example captions: `"Rep taps Procurement from the home grid."`, `"The shortfall is shown, not hidden."`
3. **The last step of a workflow ends on a confirmation** (`result` block) or a summary panel —
   the decks never end on a form.
4. **`tag` is the navy pill** printed bottom-right in the decks: `JAYSHANKAR · RECEIVING WORKFLOW`.
5. **Tones carry meaning, they are not decoration**: `emerald` = success/confirmed, `amber` =
   caution/needs attention, `red` = loss/error/expiry, `navy` = neutral/primary, `teal`/`sky`/
   `purple`/`indigo`/`slate` = categorisation. A screen has at most **one** red thing and at most
   **one** primary (`buttons` with `variant: 'primary'`) element.
6. **The handover rule from the client's own document must be visible where it belongs**: the
   receiving role never sees vendor name, purchase rate, supplier contact or margin. Mark those
   fields `locked: true` (renders the 🔒 the client's document uses) on receiving-facing screens.
7. **No lorem ipsum, no placeholder text, no `TODO` inside captions.** If a screen needs a figure,
   pick a plausible one consistent with the rest of the deck.

## 3. Sources — read before writing

| Source | What to take from it |
|---|---|
| `client-qa/developer-prompt-image/prompt-N.md` | The exact screens, labels, buttons and figures for prompts 1–12. Note the file is the *prompt text* that generated the image, and it lists each step's contents in order. |
| `example-video/WhatsApp Image 2026-09-17 at 8.06.00 PM.jpeg` | The 8-screen mobile spine (Home → Procurement → Receiving → Grading & Weight → Packing → Dispatch → Current Stock → Reports). |
| `example-video/WhatsApp Image 2026-09-17 at 8.32.26 PM.jpeg` | The 12-panel **desktop** procurement suite. |
| `example-video/WhatsApp Image 2026-09-17 at 8.35.06 PM.jpeg` | The same suite as 10 mobile screens. |
| `client-qa/session2/UpNote_2026-09-29_14-47-51/*.md` | The client's own procurement→receiving handover spec: PR/RCV IDs, three tables, the hidden-field table, "stock moves only after receiving confirms", vendor lots, Quality Issue button and its issue types. |

Open the images if you can — they are the difference between a plausible screen and a correct one.

## 4. Block reference — the only things a screen may contain

`ScreenSpec.blocks` is an array of these. Field names must match exactly; a typo is a type error.

| `kind` | Fields | Renders as |
|---|---|---|
| `hero` | `icon?`, `title`, `subtitle?` | the sea-gradient marketing header (Home only) |
| `tagline` | `text` | small centred strapline |
| `tiles` | `columns?: 2\|3\|4`, `items: {label, icon, tone}[]` | the home tile grid (real app tiles) |
| `stats` | `columns?: 2\|3`, `items: {value, label, sub?, tone?}[]` | value + uppercase label strip |
| `statCards` | `columns?: 1\|2`, `items: {icon, tone, value, label, sub?}[]` | icon + figure cards |
| `alert` | `tone`, `icon?`, `title`, `detail?` | banner |
| `note` | `text`, `tone?` | small grey line (`tone` colours it) |
| `select` | `label`, `value`, `icon?`, `placeholder?` | dropdown row |
| `field` | `label`, `value`, `suffix?`, `big?`, `locked?` | labelled input (`big` for the hero number, `suffix` for the KG badge) |
| `fields` | `columns?: 1\|2`, `items: {label, value, locked?}[]` | read-only label/value rows |
| `gradeRows` | `items: {label, value:number}[]`, `total` | A/B/C split with a green total row |
| `buttons` | `items: {label, variant?: 'primary'\|'danger'\|'warning'\|'outline'}[]` | stacked action buttons |
| `rows` | `items: {label, value?, sub?, tone?, icon?, trailing?: 'chevron'\|'check'\|'none'}[]` | list rows |
| `table` | `head: string[]`, `rows: {cells: string[], tone?}[]`, `footer?: {cells, tone?}`, `title?` | data table (`tone` tints the row) |
| `timeline` | `items: {label, time}[]`, `doneThrough?`, `title?` | status timeline with ticks |
| `tabs` | `items: string[]`, `active?` | segmented strip |
| `result` | `tone?`, `icon?`, `title`, `caption?`, `rows?: {label, value}[]` | the confirmation screen |
| `chartLine` | `title`, `points: number[]`, `labels?: string[]`, `highlight?` | line chart that draws itself |
| `chartBars` | `items: {label, value:number, tone?}[]`, `title?` | bars that grow |
| `chartDonut` | `items: {label, value:number, tone}[]`, `center?`, `centerSub?`, `title?` | donut that sweeps |
| `qr` | `value`, `caption?` | deterministic fake QR |
| `photos` | `count?`, `caption?` | photo-evidence boxes |
| `progress` | `label`, `value:number`, `max:number`, `unit?` | progress bar |
| `chain` | `items: {label, value, tone?}[]` | PR → RCV → BATCH chain |

`ScreenSpec` also carries: `title?` (the navy bar's centred title), `back?: boolean` (phone back
arrow), `right?` (small header-right label — a date, or `+ New Requirement` on desktop),
`tab?` (phone bottom-tab to highlight — one of `Home`, `Procurement`, `Market Price`, `Suppliers`,
`More`), `sidebar?` (desktop nav item to highlight — one of the 10 in `DESKTOP_NAV`),
`search?` (desktop header search placeholder).

Figures passed to `stats` / `statCards` / `field` / `table` cells are **strings** and are animated
if they look numeric: `"1,250 kg"`, `"₹ 8,12,500"`, `"965 KG"` all count up on screen entry. Write
them exactly as the deck shows them, comma grouping and ₹ included.

## 5. Icon names (pass the string, not a component)

`alert anchor arrowDownToLine arrowLeftRight arrowUpRight award bars bell boxes building calendar
camera check checkCircle chevronDown chevronRight clock container cost creditCard clipboardCheck
clipboardList download droplets edit ellipsis eye fileSpreadsheet fileText filter fish gauge home
indianRupee info layers lineChart listChecks mail mapPin megaphone complaint package packageCheck
packageOpen percent phone pieChart plus printer qr receipt refresh rotateCcw scale search settings
share ship shoppingCart sliders snowflake star store tag thermometer timer trendingDown trendingUp
truck upload user users wallet warehouse waves xCircle`

Tones: `navy teal emerald amber red sky purple indigo slate`.

## 6. Worked example — one chapter, in the house style

```ts
{
  id: 'spoilage',
  number: 10,
  group: 'containers',
  title: 'When fish goes bad',
  subtitle: 'Shelf life runs out — the loss gets recorded, never hidden.',
  tag: 'JAYSHANKAR · SPOILAGE WORKFLOW',
  steps: [
    {
      id: 'expiring',
      caption: 'Containers are listed by expiry, and the one that dies today is flagged red.',
      screen: {
        title: 'Today\'s Containers',
        back: true,
        right: '17 Sep',
        tab: 'Home',
        blocks: [
          { kind: 'alert', tone: 'red', title: 'TC-0042 Sela A/B expires today', detail: '50 KG left · packed 15 Sep' },
          { kind: 'rows', items: [
            { label: 'TC-0042 · Sela A/B', sub: 'Expires today 02:00', value: '50 KG', tone: 'red' },
            { label: 'TC-0039 · Vanjaram', sub: 'Expires 17 Sep 18:00', value: '30 KG' },
            { label: 'TC-0041 · Parai', sub: 'Expires 18 Sep', value: '25 KG' },
          ] },
          { kind: 'buttons', items: [{ label: 'Log Spoilage', variant: 'danger' }] },
        ],
      },
    },
    // … 3 more steps …
  ],
},
```

## 7. Assignments (do not renumber; another agent owns the numbers around yours)

| File | Chapters | Numbers |
|---|---|---|
| `chapters/spine.ts` | home, procurement, receiving, grading, packing, dispatch, stock, reports | 1–8 |
| `chapters/containers.ts` | containers-qr, spoilage, alerts | 9–11 |
| `chapters/quality.ts` | traceability, quality-issue | 12–13 |
| `chapters/money.ts` | customers-payments, profit-audit, bills-credit, reversals | 14–17 |
| `chapters/people.ts` | complaints, tasks, team | 18–20 |
| `chapters/procurement-desk.ts` | gd-dashboard, gd-requirements, gd-fish-master, gd-suppliers, gd-market-price, gd-festivals, gd-quotation, gd-po, gd-receiving, gd-costing, gd-analytics, gd-alerts | 21–32 |

Export names: `SPINE_CHAPTERS`, `CONTAINER_CHAPTERS`, `QUALITY_CHAPTERS`, `MONEY_CHAPTERS`,
`PEOPLE_CHAPTERS`, `PROCUREMENT_CHAPTERS`.

