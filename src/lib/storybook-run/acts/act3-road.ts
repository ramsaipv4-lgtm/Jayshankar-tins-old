// Act 3 — D64, D69, D71: on the road. Purchases join the load, the cost builds, the signal drops, two kinds of "no".
import type { Act, Block } from '../types';
import { desk, phone, REP_NAV, ADMIN_SIDE } from './helpers';
import { LOAD, LINES, SEER, SEER_KG, SEER_AVG, inr, kgRow } from '../fixtures';

const stops = (n: number, extra: Partial<{ state: 'ok' | 'queued' | 'new' }>[] = []) =>
  LINES.slice(0, n).map((l, i) => ({ who: l.who, what: `${l.sku} · ${l.bill}`, kg: l.kg, price: `₹${l.price}/kg`, state: extra[i]?.state }));

const mergeSeer = (hidden = false): Block => ({
  k: 'merge', title: 'Seer — landed cost (derived on read)', hidden,
  streams: SEER.map((l, i) => ({ who: l.who, kg: l.kg, price: l.price, tone: (['sea', 'coral', 'sun'] as const)[i] })),
  result: `₹${SEER_AVG.toFixed(2)}`, per: `per kg · Σ(price × kg) ÷ ${SEER_KG} kg`,
});

export const road: Act = {
  id: 'road', n: 3, title: 'On the road: buying', clock: 'Mon 04:30', tone: 'sea', icon: 'truck', decisions: ['D64', 'D69', 'D71'],
  kicker: 'Vendor after vendor, the rep fills the truck. Each purchase is its own bill, each bill joins the load — and in a basement with no signal, nothing is lost.',
  beats: [
    {
      id: 'v1', time: '04:42', title: 'Vendor one', decisions: ['D64'],
      story: 'The first stop. The rep records what was bought and from whom; the app files it as an ordinary bill and attaches it to the load. One vendor, one bill — exactly as before.',
      why: 'The toast carries the whole idea in one line: a bill was created, and it was added to the load. The rep never has to know that a “truck load” is a separate table.',
      criteria: ['§8.19a The bill\'s truck_load_id references a load in the same warehouse.'],
      states: [{ id: 'rep', label: 'Rep\'s phone', views: [phone('rep', {
        title: 'Record purchase', sub: `Adding to ${LOAD.id}`, tab: 'Buy', nav: REP_NAV, toast: { tone: 'kelp', text: `Bill ${LINES[0].bill} saved · added to ${LOAD.id}` },
        blocks: [
          { k: 'field', l: 'Vendor', v: LINES[0].who }, { k: 'field', l: 'Fish', v: LINES[0].sku },
          { k: 'big', items: [{ v: `${LINES[0].kg} kg`, l: 'Weight' }, { v: `₹${LINES[0].price}`, l: 'Per kg', tone: 'sea' }] },
          { k: 'chips', items: [{ t: 'one vendor = one bill', tone: 'sea', icon: 'receipt' }, { t: LINES[0].bill, tone: 'ink' }] },
          { k: 'btns', items: [{ t: 'Add another vendor', v: 'primary', icon: 'plus' }, { t: 'Done for now', v: 'ghost' }] },
        ],
      })] }],
    },
    {
      id: 'fills', time: '05:55', title: 'The load fills in', decisions: ['D64', 'D75'],
      story: 'Three vendors in, the manifest has grown. The rep sees their own purchases. The admin sees something the rep does not: what the Seer actually cost per kilo once the three vendors are blended.',
      why: 'The blend is drawn as three ribbons flowing into one bar, wider where more kilos came in — so “weighted” is something you see, not a word. It appears on the admin\'s desktop only, because it can be worked out only from vendor prices.',
      criteria: ['§8.19b Landed cost = Σ(price × kg) ÷ Σ kg over exactly the load\'s bills — no more, no fewer.'],
      states: [{ id: 'both', label: 'Rep and admin', views: [
        phone('rep', { title: 'Load', sub: LOAD.vehicle, tab: 'Load', nav: REP_NAV, blocks: [
          { k: 'manifest', id: LOAD.id, vehicle: LOAD.vehicle, status: 'IN PROGRESS', stops: stops(3, [{}, {}, { state: 'new' }]), total: `${SEER_KG} kg` },
          { k: 'note', tone: 'sea', icon: 'lock', text: 'Landed cost is for admins. You see what you bought and what you paid each vendor.' },
        ] }, 'The rep: their own purchases, vendor by vendor.'),
        desk('admin', { title: `Truck load ${LOAD.id}`, sub: `${LOAD.vehicle} · in progress`, side: ADMIN_SIDE, active: 'Truck loads', blocks: [
          mergeSeer(),
          { k: 'table', head: ['Vendor', 'Bill', 'kg', '₹/kg', 'Value'], rows: SEER.map((l) => ({ c: [l.who, l.bill, String(l.kg), String(l.price), inr(l.kg * l.price)] })), foot: ['Seer total', '', String(SEER_KG), SEER_AVG.toFixed(2), inr(SEER.reduce((s, l) => s + l.kg * l.price, 0))] },
        ] }, 'The admin: the same bills, blended into one cost.'),
      ] }],
    },
    {
      id: 'offline', time: '06:20', title: 'Basement, no signal', decisions: ['D69'],
      story: 'The last vendor trades from a cold store with no coverage. The rep keeps recording; each line joins a queue on the phone, in order, and the queue empties by itself when the signal returns.',
      why: 'The queue is on screen as a numbered list, not hidden behind a spinner, because the fear is “did my entry vanish?”. Numbers show order; the pills show where each one is. Today only the worker\'s pick works offline — this extends that same queue to procurement lines.',
      states: [
        { id: 'online', label: 'Online', hint: 'Before the basement.', views: [phone('rep', { title: 'Load', sub: LOAD.vehicle, tab: 'Load', nav: REP_NAV, blocks: [
          { k: 'queue', online: true, banner: 'Online · everything is saved', items: [{ t: kgRow(LINES[0]), sub: `${LINES[0].who} · ${LINES[0].sku}`, n: 1, s: 'sent' }, { t: kgRow(LINES[1]), sub: `${LINES[1].who} · ${LINES[1].sku}`, n: 2, s: 'sent' }] },
          { k: 'btns', items: [{ t: 'Add a purchase', v: 'primary', icon: 'plus' }] },
        ] })] },
        { id: 'offline', label: 'No signal', hint: 'Two lines recorded without any connection. They wait, in order.', views: [phone('rep', { title: 'Load', sub: LOAD.vehicle, tab: 'Load', nav: REP_NAV, offline: true, blocks: [
          { k: 'queue', online: false, banner: 'No signal · 2 purchases waiting on this phone', items: [
            { t: kgRow(LINES[2]), sub: `${LINES[2].who} · ${LINES[2].sku}`, n: 3, s: 'queued' }, { t: kgRow(LINES[3]), sub: `${LINES[3].who} · ${LINES[3].sku}`, n: 4, s: 'queued' },
          ] },
          { k: 'note', tone: 'sun', icon: 'info', text: 'Saved on this phone. They will send themselves, in this order, when the signal is back.' },
          { k: 'btns', items: [{ t: 'Add a purchase', v: 'primary', icon: 'plus' }] },
        ] })] },
        { id: 'back', label: 'Back online', hint: 'The queue replays in the order it was recorded.', views: [phone('rep', { title: 'Load', sub: LOAD.vehicle, tab: 'Load', nav: REP_NAV, toast: { tone: 'kelp', text: 'Signal back · sending 2 waiting purchases' }, blocks: [
          { k: 'queue', online: true, banner: 'Back online · sending in order', items: [
            { t: kgRow(LINES[2]), sub: `${LINES[2].who} · ${LINES[2].sku}`, n: 3, s: 'sent' }, { t: kgRow(LINES[3]), sub: `${LINES[3].who} · ${LINES[3].sku}`, n: 4, s: 'sending' },
          ] },
        ] })] },
      ],
    },
    {
      id: 'conflict', time: '06:41', title: 'Two edits, one bill', decisions: ['D69'],
      story: 'While the phone was offline, an admin corrected the price on the same bill. Now two versions exist. This is the part nobody has decided yet — so the screen is a proposal, and says so.',
      why: 'D69 is explicit that conflict rules are decisions, not implementation. Drawing a confident screen would pre-empt a decision that belongs to the owner. So this one wears a “proposal” banner, and offers three honest options rather than picking silently.',
      states: [{ id: 'proposal', label: 'A proposal', views: [phone('rep', {
        title: 'Needs your eye', sub: 'Bill B-5523', tab: 'Load', nav: REP_NAV,
        blocks: [
          { k: 'note', tone: 'sun', icon: 'flag', title: 'Proposal — not decided', text: 'The rules for edits on both sides (D69) are still open. This is one way it could look.' },
          { k: 'queue', online: true, banner: 'Back online · one entry needs a decision', items: [{ t: 'Edit Seer 80 → 82 kg', sub: 'recorded offline on this phone, 06:12', n: 3, s: 'conflict' }] },
          { k: 'table', head: ['Field', 'This phone', 'Admin'], rows: [{ c: ['kg', '82', '80'], tone: 'sun' }, { c: ['₹/kg', '655', '650'], tone: 'sun' }] },
        ],
        sheet: { title: 'Which one is right?', blocks: [
          { k: 'btns', items: [{ t: 'Keep mine', v: 'ghost' }, { t: 'Keep theirs', v: 'ghost' }] },
          { k: 'btns', items: [{ t: 'Show both to an admin', v: 'primary', icon: 'user' }] },
        ] },
      })] }],
    },
    {
      id: 'nos', time: '07:05', title: 'Two kinds of “no”', decisions: ['D71'],
      story: 'The system enforces the workflow — and where it deliberately cannot, it says so out loud. A barrier stops you. A flag only tells you. The difference is a decision someone made, not an accident of how it was coded.',
      why: 'Two different objects, not two shades of red: a hazard-striped barrier you cannot pass, and a waving flag you can. People learn the difference by feel after the first time they meet each.',
      criteria: ['D71: enforcement is the default; warn-only is an explicit exception argued case by case.'],
      states: [
        { id: 'block', label: 'It blocks', hint: 'The load is already at the scale. It cannot take more purchases.', views: [phone('rep', { title: 'Add a purchase', sub: LOAD.id, tab: 'Buy', nav: REP_NAV, blocks: [
          { k: 'gate', kind: 'block', title: `${LOAD.id} is already receiving`, detail: 'A load that has reached the scale can no longer take purchases. Start a new load instead.' },
          { k: 'btns', items: [{ t: 'Add purchase', v: 'primary', disabled: true }, { t: 'Start a new load', v: 'ghost', icon: 'truck' }] },
        ] })] },
        { id: 'warn', label: 'It warns', hint: 'Credit terms (D33) are today\'s one deliberate warn-only exception.', views: [phone('rep', { title: 'New sale', sub: 'Saravanan Hotels', tab: 'Home', nav: REP_NAV, blocks: [
          { k: 'table', head: ['Item', 'kg', 'Amount'], rows: [{ c: ['Seer', '40', '₹28,800'] }], foot: ['Balance after', '', '₹1,12,000'] },
          { k: 'gate', kind: 'warn', title: 'This is over the customer\'s credit limit', detail: 'Limit ₹1,00,000 · balance after this sale ₹1,12,000. The sale is still allowed — refusing a customer is a business call you make.' },
          { k: 'btns', items: [{ t: 'Sell anyway', v: 'warn', icon: 'flag' }, { t: 'Take payment first', v: 'primary', icon: 'rupee' }] },
        ] })] },
      ],
    },
  ],
};
