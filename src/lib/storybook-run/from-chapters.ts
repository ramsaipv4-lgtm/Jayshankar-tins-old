// Converts the SHARED chapter data (src/lib/storybook — the 32 workflow chapters and the twelve persona journeys,
// the very data decks 1 and 2 play) into this deck's model, so The Run can draw identical content in its own look.
// That is what makes the three decks comparable: same chapter id, same step, same caption, same figures — only the
// design language differs.
//
// This file imports DATA and TYPES from the shared module, never a renderer: the deck still shares no UI code with
// the Tailwind or Ant decks. Everything the shared vocabulary can say has a mapping here (tests assert none is
// dropped); an unknown icon name falls back to a neutral box rather than breaking a screen.

import { CHAPTERS } from '@/lib/storybook/chapters';
import { DESKTOP_NAV, GROUP_META, PHONE_TABS } from '@/lib/storybook/types';
import type { Block as SbBlock, Chapter, ChapterGroup, ScreenSpec, Tone as SbTone } from '@/lib/storybook/types';
import type { Act, Beat, Block, IconName, RoleId, Screen, Tone, View } from './types';

const TONE: Record<SbTone, Tone> = {
  navy: 'ink', teal: 'sea', emerald: 'kelp', amber: 'sun', red: 'coral', sky: 'ice', purple: 'plum', indigo: 'plum', slate: 'ink',
};
const tone = (t?: SbTone): Tone | undefined => (t ? TONE[t] : undefined);

/** The shared deck names icons in lucide vocabulary; this deck has its own small set. */
const ICON: Record<string, IconName> = {
  alert: 'alert', bell: 'bell', boxes: 'box', building: 'warehouse', camera: 'camera', check: 'check', checkCircle: 'check', clock: 'clock',
  container: 'box', cost: 'rupee', creditCard: 'rupee', fish: 'fish', indianRupee: 'rupee', info: 'info', mapPin: 'route', package: 'box',
  packageCheck: 'box', packageOpen: 'box', qr: 'qr', receipt: 'receipt', scale: 'scale', search: 'search', settings: 'settings', share: 'share',
  ship: 'truck', shoppingCart: 'cart', star: 'star', store: 'store', truck: 'truck', user: 'user', users: 'users', home: 'home', percent: 'percent',
  refresh: 'sync', rotateCcw: 'sync', clipboardList: 'list', clipboardCheck: 'check', listChecks: 'list', fileText: 'receipt', mail: 'receipt',
  phone: 'user', gauge: 'scale', thermometer: 'info', snowflake: 'info', droplets: 'info', waves: 'fish', anchor: 'fish', calendar: 'clock',
  lineChart: 'list', bars: 'list', pieChart: 'list', layers: 'box', tag: 'receipt', award: 'star', megaphone: 'bell', complaint: 'alert', edit: 'list',
  download: 'arrowR', arrowUpRight: 'arrowR', arrowLeftRight: 'sync', arrowDownToLine: 'arrowR', chevronRight: 'chevR', chevronDown: 'chevD',
  plus: 'plus', eye: 'eye', filter: 'list', fileSpreadsheet: 'list', printer: 'receipt', sliders: 'settings', ellipsis: 'list',
};
const icon = (n?: string): IconName => (n && ICON[n]) || 'box';

const BTN = { primary: 'primary', danger: 'danger', warning: 'warn', outline: 'ghost' } as const;

export function convertBlock(b: SbBlock): Block[] {
  switch (b.kind) {
    case 'hero':
      return [{ k: 'note', tone: 'sea', icon: icon(b.icon ?? 'fish'), title: b.title, text: b.subtitle ?? '' }];
    case 'tagline':
      return [{ k: 'chips', items: [{ t: b.text, tone: 'sea' }] }];
    case 'tiles':
      return [{ k: 'tiles', cols: b.columns === 4 ? 4 : b.columns === 3 ? 3 : 2, items: b.items.map((x) => ({ t: x.label, icon: icon(x.icon), tone: TONE[x.tone] })) }];
    case 'stats':
      return [{ k: 'big', items: b.items.map((x) => ({ v: x.value, l: x.label, sub: x.sub, tone: tone(x.tone) })) }];
    case 'statCards':
      return [{ k: 'big', items: b.items.map((x) => ({ v: x.value, l: x.label, sub: x.sub, tone: TONE[x.tone] })) }];
    case 'alert':
      return [{ k: 'note', tone: TONE[b.tone], icon: icon(b.icon ?? 'alert'), title: b.title, text: b.detail ?? '' }];
    case 'note':
      return [{ k: 'note', tone: tone(b.tone) ?? 'ice', text: b.text }];
    case 'select':
      return [{ k: 'field', l: b.label, v: b.value, suffix: '▾' }];
    case 'field':
      return [{ k: 'field', l: b.label, v: b.value, suffix: b.suffix, big: b.big, locked: b.locked }];
    case 'fields':
      // A locked field is "hidden from receiving": drawn as a redaction bar, with no value carried over.
      return [{ k: 'kv', items: b.items.map((x) => (x.locked ? { l: x.label, v: '', redact: true } : { l: x.label, v: x.value })) }];
    case 'gradeRows':
      return [{ k: 'table', head: ['Grade', 'KG'], rows: b.items.map((x) => ({ c: [x.label, String(x.value)] })), foot: ['Total', b.total] }];
    case 'buttons':
      return [{ k: 'btns', items: b.items.map((x) => ({ t: x.label, v: BTN[x.variant ?? 'primary'] })) }];
    case 'rows':
      return [{ k: 'list', title: b.title, items: b.items.map((x) => ({ t: x.label, s: x.sub, r: x.value, icon: x.icon ? icon(x.icon) : undefined, tone: tone(x.tone) })) }];
    case 'table':
      return [{ k: 'table', title: b.title, head: b.head, rows: b.rows.map((r) => ({ c: r.cells, tone: tone(r.tone) })), foot: b.footer?.cells }];
    case 'timeline': {
      const done = b.doneThrough ?? b.items.length; // shared semantics: this many items are done; the next is current
      return [{ k: 'journey', title: b.title, items: b.items.map((x, i) => ({ t: x.label, time: x.time, state: i < done ? 'done' : i === done ? 'now' : 'todo' })) }];
    }
    case 'tabs':
      return [{ k: 'tabs', items: b.items, active: b.active ?? 0 }];
    case 'result':
      return [{ k: 'result', tone: tone(b.tone), icon: icon(b.icon ?? 'check'), title: b.title, caption: b.caption, rows: b.rows?.map((r) => ({ l: r.label, v: r.value })) }];
    case 'chartLine':
      return [{ k: 'line', title: b.title, points: b.points, labels: b.labels }];
    case 'chartBars':
      return [{ k: 'bars', title: b.title, items: b.items.map((x) => ({ l: x.label, v: x.value, tone: tone(x.tone) })) }];
    case 'chartDonut':
      return [{ k: 'donut', title: b.title, center: b.center, sub: b.centerSub, items: b.items.map((x) => ({ l: x.label, v: x.value, tone: TONE[x.tone] })) }];
    case 'qr':
      return [{ k: 'qr', value: b.value, caption: b.caption }];
    case 'photos':
      return [{ k: 'photos', count: b.count, caption: b.caption }];
    case 'progress':
      return [{ k: 'progress', l: b.label, v: b.value, max: b.max, unit: b.unit }];
    case 'chain':
      return [{ k: 'list', title: 'Follows one ID', items: b.items.map((x) => ({ t: x.label, s: x.value, icon: 'link' as IconName, tone: tone(x.tone) })) }];
  }
}

export function convertScreen(s: ScreenSpec, layout: 'phone' | 'desktop'): Screen {
  const blocks = s.blocks.flatMap(convertBlock);
  if (layout === 'desktop') return { title: s.title ?? '', side: [...DESKTOP_NAV], active: s.sidebar, right: s.right, blocks };
  return { title: s.title ?? '', back: s.back, right: s.right, tab: s.tab, nav: [...PHONE_TABS], blocks };
}

const ROLE: Record<NonNullable<Chapter['persona']>['role'], RoleId> = {
  admin: 'admin', 'co-admin': 'coadmin', 'vendor-rep': 'rep', worker: 'worker', 'super-worker': 'super', receiving: 'receiver', any: 'app',
};
const GROUP_ICON: Record<ChapterGroup, IconName> = {
  journeys: 'users', operations: 'home', containers: 'box', quality: 'shield', money: 'rupee', people: 'users', procurement: 'list',
};

/** Each person gets their own icon and colour on the cover, so twelve cards do not read as one block. */
const PERSONA_LOOK: Record<string, { icon: IconName; tone: Tone }> = {
  'walk-admin-desk': { icon: 'list', tone: 'ink' }, 'walk-admin-phone': { icon: 'shield', tone: 'plum' }, 'walk-buyer': { icon: 'truck', tone: 'sea' },
  'walk-receiver': { icon: 'scale', tone: 'coral' }, 'walk-grader': { icon: 'fish', tone: 'ice' }, 'walk-packer': { icon: 'box', tone: 'sun' },
  'walk-sales': { icon: 'cart', tone: 'kelp' }, 'walk-floor': { icon: 'home', tone: 'sea' }, 'walk-money': { icon: 'rupee', tone: 'kelp' },
  'walk-complaint': { icon: 'alert', tone: 'coral' }, 'walk-newcomer': { icon: 'user', tone: 'plum' }, 'walk-transfer': { icon: 'warehouse', tone: 'ice' },
};

export function chapterToAct(c: Chapter): Act {
  const layout = c.layout ?? 'phone';
  const role: RoleId = c.persona ? ROLE[c.persona.role] : 'app';
  const meta = GROUP_META[c.group];
  const n = c.steps.length;
  const beats: Beat[] = c.steps.map((st, i) => {
    const view: View = { role, device: layout, screen: convertScreen(st.screen, layout) };
    return {
      id: st.id, time: `${i + 1}/${n}`, title: st.screen.title ?? `Step ${i + 1}`, story: st.caption, decisions: [],
      states: [{ id: 'main', label: '', views: [view] }],
    };
  });
  return {
    id: c.id, n: c.number, title: c.title, kicker: c.subtitle, clock: c.persona ? c.persona.devices : meta.label,
    tone: PERSONA_LOOK[c.id]?.tone ?? TONE[meta.tone], icon: PERSONA_LOOK[c.id]?.icon ?? GROUP_ICON[c.group], decisions: [], beats, group: c.group === 'journeys' ? 'walk' : 'chapter',
  };
}

/** The twelve persona walks, as acts (in story order). */
export const WALK_ACTS: Act[] = CHAPTERS.filter((c) => c.group === 'journeys').map(chapterToAct);
/** The 32 workflow chapters, as acts (in deck order). */
export const CHAPTER_ACTS: Act[] = CHAPTERS.filter((c) => c.group !== 'journeys').map(chapterToAct);
