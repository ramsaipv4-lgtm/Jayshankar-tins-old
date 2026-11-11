// Act 4 — D65, D68 (+D64, D75): the blind scale. The centrepiece: what the database returns decides what the
// person at the scale can possibly see, and v3 and Phase B reach that guarantee by different routes.
import type { Act, Block } from '../types';
import { desk, phone, RECV_NAV, REP_NAV, ADMIN_SIDE } from './helpers';
import { LOAD, LINES, SEER, SEER_KG, PRAWNS, WEIGH, seerCounted, seerShort, inr, sumKg } from '../fixtures';

const skuTotals = (): Block => ({
  k: 'list', title: 'To weigh — by fish, not by vendor', items: [
    { t: 'Seer', s: 'expected on this load', r: `${SEER_KG} kg`, icon: 'fish', tone: 'coral' },
    { t: 'Prawns', s: 'expected on this load', r: `${sumKg(PRAWNS)} kg`, icon: 'fish', tone: 'coral' },
  ],
});

const blindManifest = (): Block => ({
  k: 'manifest', id: LOAD.id, vehicle: LOAD.vehicle, status: 'RECEIVING', redactWho: true, redactPrice: true,
  // The blind view is built from data that never contained vendor or price (see deck.test.ts) — the black bars are
  // drawn over nothing, which is the whole claim.
  stops: LINES.map((l) => ({ who: '', what: l.sku, kg: l.kg })), total: `${sumKg(LINES)} kg`,
});

const BLIND_RETURNS = [
  { key: 'truck_load_id', value: LOAD.id, present: true }, { key: 'sku', value: '"Seer"', present: true }, { key: 'expected_kg', value: String(SEER_KG), present: true },
  { key: 'vendor_name', value: '', present: false }, { key: 'vendor_id', value: '', present: false }, { key: 'price_per_kg_paid', value: '', present: false }, { key: 'bill_id', value: '', present: false },
];

export const scale: Act = {
  id: 'scale', n: 4, title: 'Arrival: the blind scale', clock: 'Mon 07:40', tone: 'coral', icon: 'scale', decisions: ['D65', 'D68', 'D64', 'D75'],
  kicker: 'The truck backs in. The person who weighs the fish must not know who sold it or what it cost — and that has to be true even if the app has a bug.',
  beats: [
    {
      id: 'arrive', time: '07:40', title: 'The truck backs in', decisions: ['D64', 'D65'],
      story: 'The load moves to “receiving”. The person at the scale is told a truck is here — with fish and kilos, nothing about who it came from. The admin\'s board notes the arrival time.',
      why: 'The notification is the first blind surface: it names the load and the fish, and leaves out the one thing a nosy glance could learn from.',
      states: [
        { id: 'receiver', label: 'At the scale', views: [phone('receiver', { title: 'Alerts', sub: 'Just now', tab: 'Alerts', nav: RECV_NAV, blocks: [
          { k: 'list', items: [{ t: `${LOAD.id} has arrived`, s: '2 fish to weigh · 550 kg expected', icon: 'truck', tone: 'coral', chip: 'new', active: true }] },
          { k: 'journey', title: LOAD.id, items: [{ t: 'Planned', state: 'done' }, { t: 'In progress', time: '03:50', state: 'done' }, { t: 'Receiving', time: '07:40', state: 'now' }, { t: 'Completed', state: 'todo' }] },
          { k: 'btns', items: [{ t: 'Start weighing', v: 'primary', icon: 'scale' }] },
        ] })] },
        { id: 'admin', label: 'Admin\'s board', views: [desk('admin', { title: 'Truck loads', sub: 'Warehouse 1', side: ADMIN_SIDE, active: 'Truck loads', blocks: [
          { k: 'big', items: [{ v: '0', l: 'On the road' }, { v: '1', l: 'Receiving', tone: 'coral' }, { v: '0', l: 'Completed today' }] },
          { k: 'table', head: ['Load', 'Vehicle', 'Status', 'Arrived'], rows: [{ c: [LOAD.id, LOAD.vehicle, 'RECEIVING', '07:40'], tone: 'coral' }] },
        ] })] },
      ],
    },
    {
      id: 'blind', time: '07:48', title: 'The blind scale', decisions: ['D65', 'D68'],
      story: 'Same truck, same instant, three people. The person at the scale gets totals by fish. A buyer carrying the “blind” flag gets the same. An admin gets everything. Press a lens and watch both the screen and what came back from the database change.',
      why: 'This is the deck\'s thesis in one beat. The screen hides vendor and price with black bars — but the black panel underneath is the real evidence: those keys were never sent. If a screen bug showed the bars as text, there would be nothing to show. The two blind lenses are v3\'s new role and Phase B\'s flag on an existing role; the owner has to choose (HANDOVER W12).',
      criteria: ['§8.20a A receiving-storage call never receives vendor identity or price, under any input.', '§8.20c An admin / co-admin call does receive the full vendor breakdown.'],
      states: [
        { id: 'receiver', label: 'Receiving seat — v3 role', hint: 'v3 / D65: a new role, receiving-storage. It can weigh and store; vendor and price do not exist for it.', views: [phone('receiver', { title: 'Weigh the load', sub: LOAD.id, tab: 'Receive', nav: RECV_NAV, blocks: [
          blindManifest(), skuTotals(),
          { k: 'chips', items: [{ t: 'receiving-storage', tone: 'coral', icon: 'scale' }, { t: 'vendor + price: not sent', tone: 'ink', icon: 'eyeOff' }] },
        ] }, 'Black bars are a drawing. The panel below is the proof.')], rpc: { fn: 'confirm_truck_load_receiving(load, sku, …)', caller: 'receiving-storage', returns: BLIND_RETURNS,
          verdict: { tone: 'ok', text: '§8.20a — no input can make this response carry vendor or price: the keys are not in the return shape.' } } },
        { id: 'flag', label: 'Flagged buyer — Phase B', hint: 'Phase B / D68: no new role. A flag on an existing role (users.receiving_blind), behind a setting that ships OFF.', views: [phone('rep', { title: 'Weigh the load', sub: LOAD.id, tab: 'Load', nav: REP_NAV, blocks: [
          blindManifest(), skuTotals(),
          { k: 'chips', items: [{ t: 'vendor-rep · receiving_blind = true', tone: 'sun', icon: 'flag' }, { t: 'vendor + price: not sent', tone: 'ink', icon: 'eyeOff' }] },
        ] }, 'Same guarantee, reached by a flag instead of a role.')], rpc: { fn: 'confirm_delivery_arrival(…)  [blind variant]', caller: 'vendor-rep (receiving_blind)', returns: BLIND_RETURNS,
          verdict: { tone: 'ok', text: 'Same return shape as the new role — which is why the two designs can both be drawn from one screen.' } } },
        { id: 'admin', label: 'Admin — sees all', hint: '§8.20c: the restriction is role-specific, not universal.', views: [desk('admin', { title: `Truck load ${LOAD.id}`, sub: 'Full breakdown', side: ADMIN_SIDE, active: 'Truck loads', blocks: [
          { k: 'table', head: ['Vendor', 'Fish', 'Bill', 'kg', '₹/kg', 'Value'], rows: LINES.map((l) => ({ c: [l.who, l.sku, l.bill, String(l.kg), String(l.price), inr(l.kg * l.price)] })), foot: ['Load', '', '', String(sumKg(LINES)), '', inr(LINES.reduce((s, l) => s + l.kg * l.price, 0))] },
          { k: 'note', tone: 'kelp', icon: 'eye', text: 'Admins and co-admins keep full visibility and override, as everywhere else in the app.' },
        ] })], rpc: { fn: 'confirm_truck_load_receiving(load, sku, …)', caller: 'admin', returns: [
          { key: 'truck_load_id', value: LOAD.id, present: true }, { key: 'sku', value: '"Seer"', present: true }, { key: 'expected_kg', value: String(SEER_KG), present: true },
          { key: 'vendor_breakdown', value: `[${SEER.length} vendors with kg + ₹/kg]`, present: true }, { key: 'price_per_kg_paid', value: '610 / 640 / 655', present: true },
        ], verdict: { tone: 'ok', text: '§8.20c — admin and co-admin do receive the full vendor breakdown.' } } },
      ],
    },
    {
      id: 'weigh', time: '07:52', title: 'Weigh, split, store', decisions: ['D65', 'D75'],
      story: 'The receiver weighs the Seer: 385 kg good, 12 kg spoiled — 397 counted against 400 expected. Confirming adjusts the stock to what is actually good, records the spoiled kilos as spoilage, and tells the admin about the 3 kg gap. It never touches money.',
      why: 'The three numbers (expected, counted, short) are on one card so the gap is arithmetic you can check at a glance. The confirmation lists three consequences, and the last one — “money untouched” — is the line that keeps this function out of the finance rules.',
      criteria: ['D75: only stock follows the scale; the amount owed does not silently follow the corrected weight.'],
      states: [
        { id: 'enter', label: 'Entering weights', views: [phone('receiver', { title: 'Seer', sub: `${LOAD.id} · expected ${SEER_KG} kg`, tab: 'Receive', nav: RECV_NAV, blocks: [
          { k: 'field', l: 'Good (kg)', v: String(WEIGH.seer.good), suffix: 'kg', big: true }, { k: 'field', l: 'Spoiled (kg)', v: String(WEIGH.seer.spoiled), suffix: 'kg', big: true },
          { k: 'big', items: [{ v: `${SEER_KG}`, l: 'Expected' }, { v: `${seerCounted}`, l: 'Counted' }, { v: `−${seerShort}`, l: 'Short', tone: 'coral' }] },
          { k: 'btns', items: [{ t: 'Confirm Seer', v: 'primary', icon: 'check' }] },
        ] })] },
        { id: 'done', label: 'Confirmed', hint: 'What confirming sets in motion.', views: [phone('receiver', { title: 'Seer confirmed', sub: LOAD.id, tab: 'Receive', nav: RECV_NAV, toast: { tone: 'kelp', text: 'Stock set · spoilage recorded · admin told' }, blocks: [
          { k: 'list', title: 'What just happened', items: [
            { t: `Stock set to ${WEIGH.seer.good} kg`, s: 'physical stock follows the scale', icon: 'box', tone: 'kelp' },
            { t: `${WEIGH.seer.spoiled} kg recorded as spoilage`, s: 'a real spoilage movement', icon: 'alert', tone: 'sun' },
            { t: `${seerShort} kg discrepancy sent to the admin`, s: 'a delivery_discrepancy alert', icon: 'bell', tone: 'coral' },
          ] },
          { k: 'note', tone: 'ink', icon: 'rupee', text: 'Money is never touched here. What was promised stays promised.' },
        ] })], rpc: { fn: 'confirm_truck_load_receiving(load, sku, good, spoiled)', caller: 'receiving-storage', returns: [
          { key: 'confirmation_id', value: 'rc-0091', present: true }, { key: 'good_kg', value: String(WEIGH.seer.good), present: true }, { key: 'spoiled_kg', value: String(WEIGH.seer.spoiled), present: true },
          { key: 'discrepancy_kg', value: String(seerShort), present: true }, { key: 'vendor_name', value: '', present: false }, { key: 'price_per_kg_paid', value: '', present: false },
        ], verdict: { tone: 'ok', text: 'bills.total_amount is unchanged for every contributing vendor bill.' } } },
      ],
    },
    {
      id: 'rejected', time: '08:05', title: 'Procurement can\'t confirm', decisions: ['D65', 'D68'],
      story: 'The rep who bought the fish tries to confirm it too. Under v3 that is refused — procurement and receiving are separate jobs. Under Phase B, with the setting at its shipped default of OFF, it is allowed, because at today\'s volumes one person does both.',
      why: 'Both outcomes are drawn because both are true of different designs. “Ships off” is a feature, not an omission: switching it on is a business decision about staffing, and the switch-off behaviour is exactly today\'s.',
      criteria: ['§8.20b A vendor-rep call to the receiving function is rejected (v3).'],
      states: [
        { id: 'v3', label: 'v3: narrowed — refused', views: [phone('rep', { title: 'Confirm receiving', sub: LOAD.id, tab: 'Load', nav: REP_NAV, blocks: [
          { k: 'gate', kind: 'block', title: 'Procurement can\'t confirm receiving', detail: 'Buying and weighing are separate jobs. Ask the person at the scale, or an admin.', foot: 'Enforced by the function' },
          { k: 'btns', items: [{ t: 'Confirm', v: 'primary', disabled: true }, { t: 'Ask receiving', v: 'ghost', icon: 'users' }] },
        ] })], rpc: { fn: 'confirm_truck_load_receiving(load, sku, …)', caller: 'vendor-rep', returns: [{ key: 'confirmation_id', value: '', present: false }],
          verdict: { tone: 'block', text: '§8.20b — rejected: only admin, co-admin or receiving-storage may confirm.' } } },
        { id: 'off', label: 'Phase B: switch OFF — allowed', hint: 'enforce_blind_receiving ships OFF (D68): today\'s behaviour, exactly.', views: [
          desk('admin', { title: 'Settings', sub: 'Receiving', side: ADMIN_SIDE, active: 'Access', blocks: [
            { k: 'switch', l: 'Enforce blind receiving', on: false, hint: 'Off: whoever receives can see vendor and rate — as today. On: people marked blind cannot.' },
            { k: 'note', tone: 'sun', icon: 'info', text: 'It ships off because at current volumes one person does both jobs.' },
          ] }, 'The shipped default.'),
          phone('rep', { title: 'Confirm receiving', sub: LOAD.id, tab: 'Load', nav: REP_NAV, blocks: [
            { k: 'kv', items: [{ l: 'Vendor', v: 'Ocean Traders' }, { l: 'Rate', v: '₹640/kg' }, { l: 'Expected', v: '200 kg' }] },
            { k: 'btns', items: [{ t: 'Confirm', v: 'primary', icon: 'check' }] },
          ] }, 'Switch off: nothing is hidden.'),
        ] },
      ],
    },
  ],
};
