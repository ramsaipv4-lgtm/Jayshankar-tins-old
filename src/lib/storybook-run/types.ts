// "The Run" — the data model behind the third review deck.
//
// WHY A NEW MODEL (not deck 1's Chapter → Step → Screen): the first two decks draw the *same* 32 chapters, so
// the only variable was the design language. This deck exists to show what the v3/v4 amendments ADD, and the
// thing those amendments are about is that **the same moment looks different to different people** — the
// receiving person must not see the vendor or the price, an admin sees everything, a procurement rep is
// refused. A one-phone-per-step picture book cannot say that. So:
//
//   Act  = one chapter of a single day (a truck load, from set-up to payment)
//   Beat = one MOMENT on the day's clock
//   BeatState = a lens on that moment (a role, online/offline, switch on/off) — flipping it re-draws every device
//   View = one device (phone or desktop) shown to one role
//
// Two kinds of content live here. The v3/v4 "day" acts are authored natively in this model (acts/*.ts). Everything
// else — the 32 workflow chapters and the twelve persona journeys — is the SAME data decks 1 and 2 play
// (src/lib/storybook), converted to this model by from-chapters.ts, so all three decks draw identical content in
// three looks (that is what makes them comparable). The deck still shares no *renderer* code with the others.
//
// Everything is data, as in the other decks: a wording change is a one-line edit in acts/*.ts. FRONTEND ONLY —
// nothing here reads Supabase. Every figure is a literal, and the weighted-average arithmetic is checked by a test
// (see acts/index.ts, `assertArithmetic`).

export type Tone = 'sea' | 'coral' | 'sun' | 'kelp' | 'ice' | 'ink' | 'stamp' | 'plum';

export type IconName =
  | 'truck' | 'fish' | 'lock' | 'unlock' | 'key' | 'eye' | 'eyeOff' | 'clock' | 'wifi' | 'wifiOff' | 'check' | 'x'
  | 'stamp' | 'scale' | 'route' | 'warehouse' | 'user' | 'users' | 'shield' | 'flag' | 'arrowR' | 'switch' | 'bell'
  | 'receipt' | 'box' | 'alert' | 'info' | 'link' | 'copy' | 'sun' | 'moon' | 'book' | 'plus' | 'chevR' | 'chevD'
  | 'sync' | 'play' | 'pause' | 'home' | 'list' | 'rupee' | 'ban' | 'qr' | 'camera' | 'search' | 'settings' | 'star' | 'store'
  | 'share' | 'percent' | 'cart';

/** The five roles in `users.role` today (SPEC D72) plus the one v3 would add (`receiving-storage`, D65). */
export type RoleId = 'admin' | 'coadmin' | 'rep' | 'worker' | 'super' | 'receiver' | 'app';

export const ROLES: Record<RoleId, { label: string; short: string; tone: Tone; blurb: string; exception?: boolean }> = {
  admin: { label: 'Admin', short: 'Admin', tone: 'ink', blurb: 'Full visibility and override everywhere.' },
  coadmin: { label: 'Co-admin', short: 'Co-admin', tone: 'plum', blurb: 'Full admin capability, so a second person can run the business.' },
  rep: { label: 'Vendor rep', short: 'Rep', tone: 'sea', blurb: 'Buying and selling. Under v3: procurement only.' },
  worker: { label: 'Worker', short: 'Worker', tone: 'kelp', blurb: 'Floor staff. Always blind at receiving.' },
  super: { label: 'Super-worker', short: 'Super', tone: 'sun', blurb: "Floor access plus a rep's sales and money access." },
  app: { label: 'Sample screen', short: 'App', tone: 'ink', blurb: 'A screen from the app, not tied to one role.' },
  receiver: { label: 'Receiving / storage', short: 'Receiver', tone: 'coral', blurb: 'The one role v3 (D65) would add: weigh, check and store — never see vendor or price.', exception: true },
};

export type Block =
  // ---- identity / text ---------------------------------------------------
  | { k: 'h'; text: string; sub?: string }
  | { k: 'note'; text: string; title?: string; tone?: Tone; icon?: IconName }
  | { k: 'chips'; items: { t: string; tone?: Tone; icon?: IconName }[] }
  | { k: 'divider' }
  // ---- numbers / data ----------------------------------------------------
  | { k: 'big'; items: { v: string; l: string; sub?: string; tone?: Tone }[] }
  | { k: 'kv'; items: { l: string; v: string; redact?: boolean; tone?: Tone; mono?: boolean }[]; title?: string }
  | { k: 'table'; head: string[]; rows: { c: string[]; tone?: Tone }[]; foot?: string[]; redactCols?: number[]; title?: string }
  | { k: 'list'; title?: string; items: { t: string; s?: string; r?: string; icon?: IconName; tone?: Tone; chip?: string; redact?: boolean; active?: boolean }[] }
  | { k: 'progress'; l: string; v: number; max: number; unit?: string; tone?: Tone }
  // ---- inputs ------------------------------------------------------------
  | { k: 'field'; l: string; v: string; suffix?: string; locked?: boolean; error?: string; hint?: string; big?: boolean }
  | { k: 'seg'; options: string[]; active: number; l?: string }
  | { k: 'switch'; l: string; on: boolean; hint?: string }
  | { k: 'btns'; items: { t: string; v?: 'primary' | 'ghost' | 'danger' | 'warn'; disabled?: boolean; icon?: IconName }[] }
  | { k: 'tabs'; items: string[]; active: number }
  // ---- the v3/v4 vocabulary ---------------------------------------------
  /** The truck load's status machine (D64): planned → in_progress → receiving → completed. */
  | { k: 'journey'; title?: string; items: { t: string; time?: string; state: 'done' | 'now' | 'todo' }[] }
  /** The manifest ticket for one truck load. `redactWho` hides vendor identity (D65/D68). */
  | { k: 'manifest'; id: string; vehicle: string; status: string; stops: { who: string; what: string; kg: number; price?: string; state?: 'ok' | 'queued' | 'new' }[]; redactWho?: boolean; redactPrice?: boolean; total?: string }
  /** Vendor streams merging into one weighted-average landed cost (D64, §4.3.13 step 5). */
  | { k: 'merge'; title?: string; streams: { who: string; kg: number; price: number; tone?: Tone }[]; result: string; per: string; hidden?: boolean; caption?: string }
  /** Money vs scale (D75): two numbers about one load that are allowed to differ. */
  | { k: 'twin'; a: { l: string; v: string; sub?: string; tone?: Tone }; b: { l: string; v: string; sub?: string; tone?: Tone }; gap: string; caption?: string }
  /** The offline write-queue (D69). */
  | { k: 'queue'; online: boolean; banner: string; items: { t: string; sub?: string; n: number; s: 'queued' | 'sending' | 'sent' | 'conflict' }[] }
  /** A per-document approval card (D70). */
  | { k: 'approval'; doc: string; id: string; by: string; reviewer?: string; state: 'pending' | 'approved' | 'rejected' | 'blocked'; note?: string; rev?: string; lines?: string[] }
  /** Enforcement vs warning (D71): a barrier that stops, or a flag that advises. */
  | { k: 'gate'; kind: 'block' | 'warn' | 'allow'; title: string; detail: string; foot?: string }
  /** The role crew (D72). */
  | { k: 'crew'; items: { role: RoleId; t: string }[] }
  /** The closed-by-default access matrix (D73). */
  | { k: 'matrix'; cols: RoleId[]; rows: { fn: string; cells: ('open' | 'closed' | 'blind')[]; note?: string }[]; legend?: boolean }
  /** The three-look comparison + local vote (D67). */
  | { k: 'looks' }
  // ---- generic blocks the shared chapters need (converted by from-chapters.ts) ----
  | { k: 'tiles'; cols?: 2 | 3 | 4; items: { t: string; icon: IconName; tone: Tone }[] }
  | { k: 'result'; tone?: Tone; icon?: IconName; title: string; caption?: string; rows?: { l: string; v: string }[] }
  | { k: 'bars'; title?: string; items: { l: string; v: number; tone?: Tone }[] }
  | { k: 'line'; title: string; points: number[]; labels?: string[] }
  | { k: 'donut'; title?: string; center?: string; sub?: string; items: { l: string; v: number; tone: Tone }[] }
  | { k: 'qr'; value: string; caption?: string }
  | { k: 'photos'; count?: number; caption?: string };

/** What a screen draws. `role` colours the status-bar badge so you can tell whose device it is at a glance. */
export interface Screen {
  title: string;
  sub?: string;
  /** Phone: which bottom-nav item is active (nav defaults to the five tabs below). */
  tab?: string;
  nav?: string[];
  /** Desktop: sidebar items and which is active. */
  side?: string[];
  active?: string;
  offline?: boolean;
  blocks: Block[];
  /** Phone bar: draw a back arrow. */
  back?: boolean;
  /** Phone bar / desktop header: a small label on the right (a date, or an action). */
  right?: string;
  /** A bottom sheet / dialog drawn over the screen. */
  sheet?: { title: string; blocks: Block[] };
  toast?: { tone: Tone; text: string };
}

export interface View {
  role: RoleId;
  device: 'phone' | 'desktop';
  screen: Screen;
  /** Small caption under the device. */
  cap?: string;
}

/** What the database function returned to this caller — the heart of D65/D68 ("lives in what it can return"). */
export interface Rpc {
  fn: string;
  caller: string;
  returns: { key: string; value: string; present: boolean }[];
  verdict?: { tone: 'ok' | 'block' | 'warn'; text: string };
}

export interface BeatState {
  id: string;
  label: string;
  hint?: string;
  views: View[];
  rpc?: Rpc;
}

export interface Beat {
  id: string;
  /** Clock label on the day's timeline, e.g. "07:40". */
  time: string;
  title: string;
  /** One or two sentences of story — what is happening at this moment. */
  story: string;
  /** The design reasoning: why it is drawn this way. */
  why?: string;
  /** Decision ids this beat demonstrates (keys of DECISIONS). */
  decisions: string[];
  /** Acceptance criteria from the amendments' §8 this beat illustrates. */
  criteria?: string[];
  states: BeatState[];
}

export interface Act {
  /** 'day' = the v3/v4 story; 'walk' = a persona journey; 'chapter' = one of the 32 workflow chapters. */
  group?: 'day' | 'walk' | 'chapter';
  id: string;
  n: number;
  title: string;
  kicker: string;
  /** When on the day this act happens. */
  clock: string;
  tone: Tone;
  icon: IconName;
  decisions: string[];
  beats: Beat[];
}

export type BuildState = 'unbuilt' | 'different' | 'matches' | 'rule' | 'principle' | 'open' | 'none';

export interface Decision {
  id: string;
  from: 'v3' | 'v4';
  title: string;
  line: string;
  status: 'LOCKED' | 'OPEN';
  build: BuildState;
  buildNote: string;
  criteria: string[];
  act?: string;
}
