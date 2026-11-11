// Act 7 — D71, D72, D73: who may do what. Five roles (and one disputed exception); functions closed by default.
import type { Act } from '../types';
import { desk, ADMIN_SIDE } from './helpers';

const COLS = ['admin', 'coadmin', 'rep', 'worker', 'super', 'receiver'] as const;

export const who: Act = {
  id: 'who', n: 7, title: 'Who may do what', clock: 'Any time', tone: 'ink', icon: 'shield', decisions: ['D72', 'D73', 'D71'],
  kicker: 'Not a moment on the truck\'s day but the rules the whole day rests on: how many roles there are, how a new function earns its access, and what the system refuses versus merely mentions.',
  beats: [
    {
      id: 'crew', time: 'Roles', title: 'Five roles — and one disputed sixth', decisions: ['D72', 'D65'],
      story: 'D72 says there are five roles and stays five. v3 adds exactly one, a receiving seat, as a sanctioned exception. Phase B built no sixth role at all. This is the open disagreement, drawn so it can be argued with.',
      why: 'The dashed coral card is the whole disagreement: with it, v3; without it, Phase B. Showing both states side by side makes the cost of each visible — the exception is one more role to keep in every route list and badge.',
      states: [
        { id: 'v3', label: 'As v3 + v4 specify', hint: 'Five roles, plus the one sanctioned exception.', views: [desk('admin', { title: 'Access', sub: 'Roles', side: ADMIN_SIDE, active: 'Access', blocks: [
          { k: 'crew', items: [
            { role: 'admin', t: 'Everything, everywhere, with override.' }, { role: 'coadmin', t: 'Full admin capability — so a second person can run the business.' },
            { role: 'rep', t: 'Buying and selling. Under v3: procurement only.' }, { role: 'worker', t: 'Floor staff. Always blind at receiving.' },
            { role: 'super', t: 'Floor access plus a rep\'s sales and money access.' }, { role: 'receiver', t: 'Weigh, check, store. Vendor and price never reach this role.' },
          ] },
        ] })] },
        { id: 'phaseb', label: 'As Phase B built it', hint: 'No sixth role: blindness is a flag on existing roles, shipped off.', views: [desk('admin', { title: 'Access', sub: 'Roles', side: ADMIN_SIDE, active: 'Access', blocks: [
          { k: 'crew', items: [
            { role: 'admin', t: 'Everything, everywhere, with override.' }, { role: 'coadmin', t: 'Full admin capability.' },
            { role: 'rep', t: 'Buying and selling. Can be marked blind at receiving.' }, { role: 'worker', t: 'Floor staff. Always blind at receiving.' },
            { role: 'super', t: 'Floor + sales. Can be marked blind at receiving.' },
          ] },
          { k: 'switch', l: 'Enforce blind receiving', on: false, hint: 'app_settings.enforce_blind_receiving · ships off' },
        ] })] },
      ],
    },
    {
      id: 'closed', time: 'Functions', title: 'Closed until opened', decisions: ['D73', 'D65'],
      story: 'A new database function ships with no grants at all. A role gains access only by an explicit line in a migration. “Who can do this?” is answered by reading the migrations, not by probing the live app.',
      why: 'A grid of locks and keys: every cell starts as a lock. The blind eye on the bottom row is the point — the receiving seat is granted the function, but with vendor and price removed from what it can return.',
      states: [
        { id: 'new', label: 'A function ships', hint: 'No grants. Nobody can call it — not even by accident.', views: [desk('admin', { title: 'Access', sub: 'Who can call what', side: ADMIN_SIDE, active: 'Access', blocks: [
          { k: 'matrix', cols: [...COLS], rows: [{ fn: 'confirm_truck_load_receiving', cells: ['closed', 'closed', 'closed', 'closed', 'closed', 'closed'] }] },
          { k: 'note', tone: 'ink', icon: 'lock', text: 'A function with no grants is a function that cannot be misused. Opening it is a deliberate act.' },
        ] })] },
        { id: 'granted', label: 'After the migration', hint: 'One explicit line per role that may use it.', views: [desk('admin', { title: 'Access', sub: 'Who can call what', side: ADMIN_SIDE, active: 'Access', blocks: [
          { k: 'matrix', cols: [...COLS], rows: [
            { fn: 'set_procurement_mode', cells: ['open', 'open', 'closed', 'closed', 'closed', 'closed'] },
            { fn: 'confirm_truck_load_receiving', cells: ['open', 'open', 'closed', 'closed', 'closed', 'blind'] },
            { fn: 'approve_document', cells: ['open', 'open', 'closed', 'closed', 'closed', 'closed'] },
            { fn: 'record_bill_delivery', cells: ['open', 'open', 'open', 'closed', 'open', 'closed'] },
          ] },
          { k: 'note', tone: 'sea', icon: 'key', text: 'Rows are illustrative of the rules in v3 / v4 (§8.18b, §8.20b/c); the real grants live in the migrations.' },
        ] })] },
      ],
    },
    {
      id: 'exceptions', time: 'Refusals', title: 'The short list of “only warn”', decisions: ['D71'],
      story: 'Enforcement is the default. The warn-only list is meant to be short and argued — today it holds exactly one thing, credit terms. Everything else on this page is a barrier.',
      why: 'Three gates in a row, one of each colour, is a legend you can read in a second: stop, mention, go. The exception list under them is deliberately tiny so a new addition has to be conspicuous.',
      states: [{ id: 'legend', label: 'The legend', views: [desk('admin', { title: 'How refusals look', side: ADMIN_SIDE, active: 'Access', blocks: [
        { k: 'gate', kind: 'block', title: 'Stops you', detail: 'The load is already receiving, or the reviewer is the requester. There is no “override” button for an ordinary user.' },
        { k: 'gate', kind: 'warn', title: 'Tells you', detail: 'Credit limit exceeded — you may continue. Refusing a sale is a business call the wholesaler keeps for himself (D33).' },
        { k: 'gate', kind: 'allow', title: 'Lets you', detail: 'Everything else in the workflow.', foot: 'Allowed' },
        { k: 'list', title: 'Warn-only exceptions today', items: [{ t: 'Credit terms (D33)', s: 'the only one — adding a second needs its own argument', icon: 'flag', tone: 'sun', chip: '1' }] },
      ] })] }],
    },
  ],
};
