// Storybook — the data model behind the animated workflow picture book (/storybook).
//
// WHY THIS EXISTS: the client's reference decks (example-video/*.jpeg — the "AKS Seafood"
// WhatsApp sheets) document the whole business flow as numbered, captioned phone screens.
// Our 12 locked visuals (client-qa/developer-prompt-image/prompt-1.jpg … prompt-12.jpg, and
// the prompt-N.md specs beside them) follow the same convention: Step 1…4 per workflow.
//
// Rather than hand-code ~100 bespoke screens, every screen in the picture book is *data*:
// a ScreenSpec is a title plus a list of Block records, and one renderer
// (components/storybook/blocks.tsx) turns that into UI. That keeps the deck reviewable and
// makes a wording or colour change a one-line edit in a chapters/ file, not a component edit.
//
// FRONTEND ONLY: nothing here reads Supabase. Every value is a literal, transcribed from the
// reference decks and from client-qa/session2/…connect procurement with receiving team.md.
// See docs/BACKEND-REQUIREMENTS-phase-b.md for what each screen would need to become real.

/** Colour intent. Resolved to real classes in blocks.tsx — never to a raw hex here. */
export type Tone =
  | 'navy'
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'sky'
  | 'purple'
  | 'indigo'
  | 'slate';

/** lucide-react icon name, resolved through the ICONS map in blocks.tsx (data stays JSX-free). */
export type IconName = string;

export type Block =
  // ---- layout / identity -------------------------------------------------
  /** Marketing header on the Home screen of the reference: boat illustration + tagline. */
  | { kind: 'hero'; icon?: IconName; title: string; subtitle?: string }
  /** Small uppercase strapline under the hero ("Fresh Today · Better Tomorrow"). */
  | { kind: 'tagline'; text: string }
  /** The 6/8-tile home grid, and any other icon grid. */
  | { kind: 'tiles'; columns?: 2 | 3 | 4; items: { label: string; icon: IconName; tone: Tone }[] }

  // ---- numbers ----------------------------------------------------------
  /** Plain value+label strip (the rep home's 450 KG / 2 / ₹ 24K). */
  | { kind: 'stats'; columns?: 2 | 3; items: { value: string; label: string; sub?: string; tone?: Tone }[] }
  /** Icon + big value + caption cards (Today's Purchase / Pending POs / Avg Price…). */
  | { kind: 'statCards'; columns?: 1 | 2; items: { icon: IconName; tone: Tone; value: string; label: string; sub?: string }[] }

  // ---- messaging --------------------------------------------------------
  | { kind: 'alert'; tone: Tone; icon?: IconName; title: string; detail?: string }
  | { kind: 'note'; text: string; tone?: Tone }

  // ---- forms ------------------------------------------------------------
  | { kind: 'select'; label: string; value: string; icon?: IconName; placeholder?: boolean }
  | { kind: 'field'; label: string; value: string; suffix?: string; big?: boolean; locked?: boolean }
  /** Read-only label/value pairs, e.g. the PO summary or a container's details. */
  | { kind: 'fields'; columns?: 1 | 2; items: { label: string; value: string; locked?: boolean }[] }
  /** Grade split rows: label + numeric value + KG suffix + a total row. */
  | { kind: 'gradeRows'; items: { label: string; value: number }[]; total: string }
  | { kind: 'buttons'; items: { label: string; variant?: 'primary' | 'danger' | 'warning' | 'outline' }[] }

  // ---- lists and tables -------------------------------------------------
  | {
      kind: 'rows';
      title?: string;
      items: {
        label: string;
        value?: string;
        sub?: string;
        tone?: Tone;
        icon?: IconName;
        trailing?: 'chevron' | 'check' | 'none';
      }[];
    }
  | {
      kind: 'table';
      title?: string;
      head: string[];
      rows: { cells: string[]; tone?: Tone }[];
      /** Rendered as a highlighted final row (totals, "Total Stock 965 KG"). */
      footer?: { cells: string[]; tone?: Tone };
    }
  | { kind: 'timeline'; title?: string; items: { label: string; time: string }[]; doneThrough?: number }
  | { kind: 'tabs'; items: string[]; active?: number }

  // ---- confirmation screens --------------------------------------------
  | { kind: 'result'; tone?: Tone; icon?: IconName; title: string; caption?: string; rows?: { label: string; value: string }[] }

  // ---- charts -----------------------------------------------------------
  | { kind: 'chartLine'; title: string; points: number[]; labels?: string[]; highlight?: string }
  | { kind: 'chartBars'; title?: string; items: { label: string; value: number; tone?: Tone }[] }
  | { kind: 'chartDonut'; title?: string; center?: string; centerSub?: string; items: { label: string; value: number; tone: Tone }[] }

  // ---- physical-world widgets ------------------------------------------
  /** Fake but deterministic QR code, drawn as SVG modules. */
  | { kind: 'qr'; value: string; caption?: string }
  /** Photo-evidence placeholder strip (the decks' camera boxes). */
  | { kind: 'photos'; count?: number; caption?: string }
  | { kind: 'progress'; label: string; value: number; max: number; unit?: string }
  /** The PR → RCV → BATCH → SALE traceability chain. */
  | { kind: 'chain'; items: { label: string; value: string; tone?: Tone }[] };

/** One screen of a step. Phone by default; `sidebar`/`right` are used by the desktop layout. */
export interface ScreenSpec {
  title?: string;
  /** Phone only: show the back arrow in the navy bar. */
  back?: boolean;
  /** Small header-right label — a date, or an action like "+ New Requirement". */
  right?: string;
  /** Desktop only: which sidebar item is active. */
  sidebar?: string;
  /** Desktop only: placeholder text in the header's search field. */
  search?: string;
  /** Phone only: which bottom-tab is active. */
  tab?: string;
  blocks: Block[];
}

export interface StepSpec {
  id: string;
  /** Caption printed under the phone, exactly like the reference decks. */
  caption: string;
  screen: ScreenSpec;
}

export type ChapterGroup = 'journeys' | 'operations' | 'containers' | 'quality' | 'money' | 'people' | 'procurement';

export interface Chapter {
  id: string;
  /** Deck number, 1-based, shown in the navy circle like the reference sheets. */
  number: number;
  group: ChapterGroup;
  title: string;
  subtitle: string;
  /** Bottom-right navy pill in the reference decks, e.g. "JAYSHANKAR · BUYING WORKFLOW". */
  tag: string;
  layout?: 'phone' | 'desktop';
  steps: StepSpec[];
  /**
   * Set only on a persona journey (group 'journeys'): who is walking it. `role` is the closest of the five
   * `users.role` values (D72: personas are JOBS, not new roles — the wholesaler does several at once), or 'any'.
   */
  persona?: { role: 'admin' | 'co-admin' | 'vendor-rep' | 'worker' | 'super-worker' | 'receiving' | 'any'; who: string; devices: string };
}

export const GROUP_META: Record<ChapterGroup, { label: string; blurb: string; tone: Tone }> = {
  journeys: {
    label: 'Walk it as someone',
    blurb:
      'Pick a person — the admin, the buyer on the road, the one at the scale, the grader, the packer who delivers — and walk their day, end to end, on the device they actually use.',
    tone: 'navy',
  },
  operations: {
    label: 'The daily spine',
    blurb: 'Home → Procurement → Receiving → Grading → Packing → Dispatch → Stock → Reports.',
    tone: 'navy',
  },
  containers: {
    label: 'Containers & freshness',
    blurb: 'Boxes, QR tags, shelf-life clocks, spoilage, and the alerts that fire off them.',
    tone: 'teal',
  },
  quality: {
    label: 'Traceability & vendor quality',
    blurb:
      'The chain the client asked for: PR → RCV → BATCH → SALE, hidden vendor lots, and quality issues that build a vendor scorecard.',
    tone: 'amber',
  },
  money: {
    label: 'Money',
    blurb: 'Customer balances, payments, bills, credit terms, profit, and the audit trail.',
    tone: 'emerald',
  },
  people: {
    label: 'People & exceptions',
    blurb: 'Tasks, team invites, complaints, returns, and reversals.',
    tone: 'purple',
  },
  procurement: {
    label: 'Procurement desk (desktop)',
    blurb:
      "The back-office suite from the client's second reference sheet: requirements, market price, quotations, purchase orders, costing, analytics.",
    tone: 'indigo',
  },
};

export const GROUP_ORDER: ChapterGroup[] = ['journeys', 'operations', 'containers', 'quality', 'money', 'people', 'procurement'];

/** The phone's bottom tab bar, as drawn in the reference. Not wired to real routes yet. */
export const PHONE_TABS = ['Home', 'Procurement', 'Market Price', 'Suppliers', 'More'] as const;

/** The desktop suite's sidebar, as drawn in the reference. */
export const DESKTOP_NAV = [
  'Dashboard',
  'Purchase Requirements',
  'Market Prices',
  'Suppliers',
  'Quotations',
  'Purchase Orders',
  'Receiving',
  'Price Prediction',
  'Analytics',
  'Reports',
  'Truck Loads',
  'Approvals',
  'Settings',
] as const;

