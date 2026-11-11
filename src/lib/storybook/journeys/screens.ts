// Screens that exist ONLY in the persona journeys: the places the 32 workflow chapters have nothing to show.
//
// Three groups, and the caption on each step says which it is:
//   * what the amendments v3/v4 add (trip task, truck load, offline queue, blind receiving, approvals, access);
//   * what the app already does but the deck never drew (repack, search, warehouse transfer, the floor home);
//   * what is PROPOSED and not in the app at all (delivery tracking and proof of delivery) — marked
//     "Proposed" on the screen itself, because a review deck that quietly invents features is a liability.
// Everything is a sample: names and figures continue the cast of the 32 chapters (Annamalai, Kumar, TC-0042,
// truck load TL-125 with three vendors) so a journey reads as one world. Same block vocabulary as the chapters —
// nothing here needs a renderer the three decks don't already have.

import type { ScreenSpec } from '../types';

const DATE = '15 Sep 2026';
const phone = (title: string, blocks: ScreenSpec['blocks'], o: Partial<ScreenSpec> = {}): ScreenSpec => ({ title, back: true, right: DATE, tab: 'Home', blocks, ...o });
const desk = (title: string, sidebar: string, blocks: ScreenSpec['blocks'], right?: string): ScreenSpec => ({ title, sidebar, right, blocks });

// TL-125's three vendors (chapter 12 shows them anonymised as A/B/C). Admin sees prices; receiving never does.
const LOAD = [
  { v: 'Vendor A', kg: 120, rate: 410 },
  { v: 'Vendor B', kg: 180, rate: 415 },
  { v: 'Vendor C', kg: 100, rate: 412 },
];
const LOAD_KG = LOAD.reduce((s, l) => s + l.kg, 0); // 400
const LOAD_VALUE = LOAD.reduce((s, l) => s + l.kg * l.rate, 0); // 1,65,100
const AVG = (LOAD_VALUE / LOAD_KG).toFixed(2); // 412.75
const inr = (n: number) => '₹ ' + n.toLocaleString('en-IN');

export const S = {
  // ─────────────── the buyer on the road ───────────────
  tripTask: phone('My Tasks', [
    { kind: 'alert', tone: 'navy', icon: 'bell', title: 'New trip from the manager', detail: 'Procurement trip · TN-09 AB 1234 · leave 03:30' },
    { kind: 'fields', items: [
      { label: 'Task', value: 'Procurement trip' },
      { label: 'Vehicle', value: 'TN-09 AB 1234' },
      { label: 'Vendors to visit', value: 'Decided on the road' },
    ] },
    { kind: 'note', text: 'Which vendors you buy from is never part of the plan. Planning is optional — you can also just start a load.' },
    { kind: 'buttons', items: [{ label: 'Start trip', variant: 'primary' }] },
  ]),

  loadStarted: phone('Truck Load TL-125', [
    { kind: 'timeline', title: 'This trip', items: [
      { label: 'Planned', time: '03:30' }, { label: 'In progress', time: '03:50' }, { label: 'Receiving', time: '—' }, { label: 'Completed', time: '—' },
    ], doneThrough: 1 },
    { kind: 'note', text: 'Every purchase you record now joins this load. Each vendor is still its own bill.', tone: 'teal' },
    { kind: 'buttons', items: [{ label: 'Add a purchase', variant: 'primary' }] },
  ], { right: 'TN-09 AB 1234', tab: 'Procurement' }),

  loadManifest: phone('Truck Load TL-125', [
    { kind: 'table', title: 'Velameen · what you have bought', head: ['Vendor', 'Bill', 'kg'], rows: [
      { cells: ['Vendor A', 'B-5521', '120'] }, { cells: ['Vendor B', 'B-5522', '180'] }, { cells: ['Vendor C', 'B-5523', '100'], tone: 'amber' },
    ], footer: { cells: ['On this load', '', `${LOAD_KG} kg`], tone: 'navy' } },
    { kind: 'note', text: 'Landed cost is for admins. You see what you bought and what you paid each vendor.' },
  ], { right: 'In progress', tab: 'Procurement' }),

  offlineQueue: phone('Truck Load TL-125', [
    { kind: 'alert', tone: 'amber', icon: 'alert', title: 'No signal — 2 purchases waiting', detail: 'Saved on this phone. They send themselves, in this order, when the signal is back.' },
    { kind: 'rows', title: 'Waiting to send', items: [
      { label: '#2 · Vendor B · Velameen', sub: '180 kg × ₹ 415', value: 'queued', tone: 'amber', icon: 'receipt', trailing: 'none' },
      { label: '#3 · Vendor C · Velameen', sub: '100 kg × ₹ 412', value: 'queued', tone: 'amber', icon: 'receipt', trailing: 'none' },
    ] },
    { kind: 'buttons', items: [{ label: 'Add a purchase', variant: 'primary' }] },
  ], { right: 'Offline', tab: 'Procurement' }),

  backOnline: phone('Truck Load TL-125', [
    { kind: 'alert', tone: 'emerald', icon: 'check', title: 'Signal back — sending in order', detail: 'Nothing was lost while you were underground.' },
    { kind: 'rows', title: 'Sending', items: [
      { label: '#2 · Vendor B · Velameen', sub: '180 kg × ₹ 415', value: 'sent', tone: 'emerald', icon: 'checkCircle', trailing: 'check' },
      { label: '#3 · Vendor C · Velameen', sub: '100 kg × ₹ 412', value: 'sending…', tone: 'sky', icon: 'refresh', trailing: 'none' },
    ] },
    { kind: 'note', text: 'If the same bill was edited elsewhere meanwhile, the app will ask you — the rule for that is still undecided (proposal).', tone: 'amber' },
  ], { right: 'Online', tab: 'Procurement' }),

  // ─────────────── the person at the scale (blind receiving) ───────────────
  rcvArrived: phone('Alerts', [
    { kind: 'alert', tone: 'amber', icon: 'truck', title: 'Truck load TL-125 has arrived', detail: '1 fish to weigh · 400 KG expected' },
    { kind: 'timeline', title: 'TL-125', items: [{ label: 'In progress', time: '03:50' }, { label: 'Receiving', time: '07:40' }, { label: 'Completed', time: '—' }], doneThrough: 1 },
    { kind: 'buttons', items: [{ label: 'Start weighing', variant: 'primary' }] },
  ], { tab: 'More' }),

  rcvBlind: phone('Weigh the load', [
    { kind: 'fields', items: [
      { label: 'Fish', value: 'Velameen' },
      { label: 'Expected', value: '400 KG' },
      { label: 'Vendors', value: 'Hidden from receiving', locked: true },
      { label: 'Purchase rate', value: 'Hidden from receiving', locked: true },
      { label: 'Supplier contact', value: 'Hidden from receiving', locked: true },
    ] },
    { kind: 'note', text: 'You are given the fish and the kilos. The system does not send you who sold it or what it cost — so no screen can show it.' },
    { kind: 'buttons', items: [{ label: 'Enter weights', variant: 'primary' }] },
  ], { right: 'TL-125' }),

  rcvWeigh: phone('Velameen', [
    { kind: 'field', label: 'Good (KG)', value: '392.0', suffix: 'KG', big: true },
    { kind: 'field', label: 'Spoiled (KG)', value: '4.8', suffix: 'KG', big: true },
    { kind: 'stats', columns: 3, items: [
      { value: '400', label: 'Expected' }, { value: '396.8', label: 'Counted', tone: 'navy' }, { value: '−3.2', label: 'Short', tone: 'red' },
    ] },
    { kind: 'buttons', items: [{ label: 'Confirm Velameen', variant: 'primary' }] },
  ], { right: 'TL-125' }),

  rcvDiscrepancy: phone('Discrepancy', [
    { kind: 'alert', tone: 'red', icon: 'alert', title: '−3.2 KG short', detail: 'Expected 400 KG · Counted 396.8 KG (392.0 good + 4.8 spoiled)' },
    { kind: 'note', text: 'Admin notified. Stock follows the scale at once; money does not — what was promised stays promised until a person settles it.' },
    { kind: 'note', text: 'You never see the amount. Nothing here changes it.', tone: 'slate' },
  ], { right: 'TL-125' }),

  rcvIssue: phone('Spoiled fish', [
    { kind: 'select', label: 'Issue type', value: 'Soft flesh', icon: 'fish' },
    { kind: 'field', label: 'Quantity', value: '4.8', suffix: 'KG' },
    { kind: 'photos', count: 2, caption: 'Photo evidence · attached to the load, not to a vendor you cannot see' },
    { kind: 'note', text: 'The admin can trace it back to the vendor lot; you do not need to know it.' },
    { kind: 'buttons', items: [{ label: 'Record issue', variant: 'primary' }] },
  ], { right: 'TL-125' }),

  rcvConfirmed: phone('Confirmed', [
    { kind: 'result', tone: 'emerald', icon: 'check', title: 'Weigh-in confirmed', caption: 'Stock moved by what was actually weighed.', rows: [
      { label: 'Stock set to', value: '392.0 KG' }, { label: 'Spoilage recorded', value: '4.8 KG' }, { label: 'Admin told', value: '−3.2 KG short' },
    ] },
  ], { right: 'TL-125' }),

  // ─────────────── the packer who delivers ───────────────
  deliverTask: phone('My Tasks', [
    { kind: 'alert', tone: 'navy', icon: 'bell', title: 'New task from the manager', detail: 'Pack 40 KG Sela and deliver · due Today 14:00' },
    { kind: 'fields', items: [
      { label: 'Task', value: 'Pack and deliver' },
      { label: 'Quantity', value: '40 KG Sela' },
      { label: 'Containers', value: '2 × 20 KG' },
      { label: 'Deliver to', value: 'Kumar Mess · Main Road' },
      { label: 'Due', value: 'Today 14:00' },
    ] },
    { kind: 'buttons', items: [{ label: 'Start', variant: 'primary' }] },
  ]),

  outForDelivery: phone('Out for delivery', [
    { kind: 'note', text: 'Proposed — the app does not track a delivery after dispatch today.', tone: 'amber' },
    { kind: 'rows', title: 'On your vehicle', items: [
      { label: 'TC-0044', sub: 'Sela · 20 KG', value: 'loaded', icon: 'container', trailing: 'check', tone: 'emerald' },
      { label: 'TC-0045', sub: 'Sela · 20 KG', value: 'loaded', icon: 'container', trailing: 'check', tone: 'emerald' },
    ] },
    { kind: 'fields', items: [{ label: 'Deliver to', value: 'Kumar Mess · Main Road' }, { label: 'Expected', value: '13:20' }] },
    { kind: 'buttons', items: [{ label: 'Call customer', variant: 'outline' }, { label: 'Arrived', variant: 'primary' }] },
  ], { right: 'Task 14:00' }),

  delivered: phone('Delivered', [
    { kind: 'note', text: 'Proposed — proof of delivery is not built.', tone: 'amber' },
    { kind: 'result', tone: 'emerald', icon: 'checkCircle', title: 'Delivered to Kumar Mess', caption: '2 containers · 40 KG', rows: [
      { label: 'Received by', value: 'Kumar (owner)' }, { label: 'Time', value: '13:18' }, { label: 'Weight', value: '40 KG' },
    ] },
    { kind: 'photos', count: 1, caption: 'Delivery photo' },
    { kind: 'buttons', items: [{ label: 'Finish task', variant: 'primary' }] },
  ], { right: 'Task 14:00' }),

  taskDone: phone('Task complete', [
    { kind: 'result', tone: 'emerald', icon: 'check', title: 'Done — 42 minutes early', caption: 'The task closed itself from the action that finished it.', rows: [
      { label: 'Packed', value: '40 KG Sela' }, { label: 'Delivered', value: 'Kumar Mess' }, { label: 'Manager', value: 'notified' },
    ] },
  ]),

  // ─────────────── selling and getting paid ───────────────
  creditWarn: phone('Record Sale', [
    { kind: 'table', head: ['Item', 'KG', 'Amount'], rows: [{ cells: ['Sela Fish', '40', '₹ 28,800'] }], footer: { cells: ['Balance after this sale', '', '₹ 1,12,000'], tone: 'navy' } },
    { kind: 'alert', tone: 'amber', icon: 'alert', title: 'Over the credit limit', detail: 'Limit ₹ 1,00,000 · balance after this sale ₹ 1,12,000. The sale is still allowed.' },
    { kind: 'note', text: 'Warn-only, on purpose: refusing a customer is a business decision the wholesaler keeps for himself.' },
    { kind: 'buttons', items: [{ label: 'Sell anyway', variant: 'warning' }, { label: 'Take payment first', variant: 'primary' }] },
  ]),

  shareBill: phone('Bill #143', [
    { kind: 'fields', items: [{ label: 'Customer', value: 'Kumar Mess' }, { label: 'Amount', value: '₹ 28,800' }, { label: 'Terms', value: 'Cash on dispatch' }] },
    { kind: 'result', tone: 'emerald', icon: 'receipt', title: 'Bill ready', caption: 'Send it the way the customer actually reads things.' },
    { kind: 'buttons', items: [{ label: 'Share via WhatsApp', variant: 'primary' }, { label: 'Print', variant: 'outline' }] },
  ]),

  // ─────────────── the floor ───────────────
  floorHome: phone('Floor', [
    { kind: 'stats', columns: 3, items: [{ value: '2', label: 'To do' }, { value: '2', label: 'Expiring today', tone: 'red' }, { value: '6', label: 'Packed', tone: 'emerald' }] },
    { kind: 'tiles', columns: 3, items: [
      { label: 'Pack', icon: 'package', tone: 'navy' }, { label: 'Repack', icon: 'refresh', tone: 'teal' }, { label: 'Spoilage', icon: 'alert', tone: 'red' },
      { label: 'Stock', icon: 'boxes', tone: 'sky' }, { label: 'Scan', icon: 'qr', tone: 'indigo' }, { label: 'My tasks', icon: 'clipboardList', tone: 'purple' },
    ] },
  ], { back: false, right: 'Kumar' }),

  repack: phone('Repack', [
    { kind: 'select', label: 'From container', value: 'TC-0037 · Sela · 12 KG', icon: 'container' },
    { kind: 'select', label: 'Into container', value: 'TC-0044 · empty · 20 KG', icon: 'container' },
    { kind: 'field', label: 'Weight to move', value: '12', suffix: 'KG' },
    { kind: 'note', text: 'Stock moves between containers; nothing is created or lost, and the movement is in the audit log.' },
    { kind: 'buttons', items: [{ label: 'Repack', variant: 'primary' }] },
  ]),

  // ─────────────── the admin, on the phone ───────────────
  approvalsPhone: phone('Approvals', [
    { kind: 'alert', tone: 'navy', icon: 'clipboardCheck', title: '3 waiting for you', detail: 'Each document carries its own approval.' },
    { kind: 'rows', items: [
      { label: 'Bill B-5523', sub: 'asked by Arun', value: 'pending', tone: 'amber', icon: 'receipt' },
      { label: 'Truck load TL-125', sub: 'asked by Arun', value: 'pending', tone: 'amber', icon: 'truck' },
      { label: 'Reversal R-0077', sub: 'asked by Meena', value: 'pending', tone: 'amber', icon: 'rotateCcw' },
    ] },
    { kind: 'note', text: 'You cannot approve your own request. A rejected line is revised, never resubmitted as new.' },
  ], { tab: 'More' }),

  search: phone('Search', [
    { kind: 'field', label: 'Find', value: 'sela' },
    { kind: 'rows', title: 'Results', items: [
      { label: 'Sela Fish', sub: 'fish · 245 KG in stock', icon: 'fish' },
      { label: 'Murugan Stores', sub: 'customer · owes ₹ 14,200', icon: 'store' },
      { label: 'Annamalai', sub: 'vendor · last delivery 12 Sep', icon: 'user' },
    ] },
    { kind: 'note', text: 'One box finds a fish, a customer, a vendor or a person.' },
  ], { tab: 'More' }),

  // ─────────────── moving stock between warehouses ───────────────
  transferForm: phone('Transfer', [
    { kind: 'select', label: 'From', value: 'Warehouse 1 · Real operations', icon: 'building' },
    { kind: 'select', label: 'To', value: 'Warehouse 2', icon: 'building' },
    { kind: 'select', label: 'Container', value: 'TC-0042 · Sela · 30 KG', icon: 'container' },
    { kind: 'note', text: 'It leaves Warehouse 1 now and counts at Warehouse 2 only once someone there confirms it.' },
    { kind: 'buttons', items: [{ label: 'Send', variant: 'primary' }] },
  ], { tab: 'More' }),

  inTransit: phone('In transit', [
    { kind: 'alert', tone: 'amber', icon: 'truck', title: '30 KG Sela in transit', detail: 'TC-0042 → Warehouse 2 · left 09:10' },
    { kind: 'stats', columns: 2, items: [{ value: '215', label: 'Warehouse 1 stock', sub: 'down 30' }, { value: '+0', label: 'Warehouse 2 stock', sub: 'not yet' }] },
    { kind: 'note', text: 'Counted in neither warehouse while it is on the road — so it cannot be sold twice.' },
  ], { tab: 'More' }),

  transferReceived: phone('Confirm arrival', [
    { kind: 'fields', items: [{ label: 'Container', value: 'TC-0042' }, { label: 'Sent', value: '30 KG' }, { label: 'Weighed here', value: '29.6 KG' }] },
    { kind: 'note', text: 'Difference −0.4 KG', tone: 'amber' },
    { kind: 'result', tone: 'emerald', icon: 'check', title: 'Received at Warehouse 2', caption: 'Stock counts here from now on.' },
  ], { tab: 'More' }),

  // ─────────────── a new person joins ───────────────
  learn: phone('Learn', [
    { kind: 'rows', title: 'Short videos for your role', items: [
      { label: 'Record a purchase', sub: '1:20', icon: 'receipt' },
      { label: 'Weigh and confirm a delivery', sub: '1:45', icon: 'scale' },
      { label: 'Pack a container and tag it', sub: '1:10', icon: 'qr' },
    ] },
    { kind: 'note', text: 'Each video is filtered to what your role can actually do.' },
  ], { tab: 'More' }),

  // ─────────────── the admin, at the desk ───────────────
  modeSettings: desk('Settings · How this warehouse buys', 'Settings', [
    { kind: 'select', label: 'Warehouse', value: 'Warehouse 1 · Real operations', icon: 'building' },
    { kind: 'select', label: 'Procurement mode', value: 'Truck — one load, many vendors', icon: 'truck' },
    { kind: 'table', title: 'All warehouses', head: ['Warehouse', 'Mode', 'Open loads', 'Open bills'], rows: [
      { cells: ['Warehouse 1 · Real operations', 'Truck', '1', '6'], tone: 'amber' }, { cells: ['Warehouse 2', 'Vendor', '—', '4'] }, { cells: ['Warehouse 3 · Simulated', 'Vendor', '—', '9'] },
    ] },
    { kind: 'note', text: 'Default is Vendor, exactly as today. Only an admin or co-admin can change it, and nothing already recorded changes.', tone: 'teal' },
  ], 'Admin'),

  truckBoard: desk('Truck Loads', 'Truck Loads', [
    { kind: 'table', head: ['Load', 'Vehicle', 'Status', 'Vendors', 'kg'], rows: [
      { cells: ['TL-125', 'TN-09 AB 1234', 'Receiving', '3', String(LOAD_KG)], tone: 'amber' }, { cells: ['TL-124', 'TN-11 CD 5678', 'Completed', '2', '310'], tone: 'emerald' },
    ] },
    { kind: 'table', title: 'TL-125 · Velameen — landed cost (admin only, derived on read)', head: ['Vendor', 'kg', '₹/kg', 'Value'], rows: LOAD.map((l) => ({ cells: [l.v, String(l.kg), String(l.rate), inr(l.kg * l.rate)] })), footer: { cells: ['Weighted average', String(LOAD_KG), AVG, inr(LOAD_VALUE)], tone: 'navy' } },
    { kind: 'note', text: `Σ(price × kg) ÷ Σ kg = ${AVG} ₹/kg. It is a cost figure for pricing — not the amount owed, which stays what was promised.` },
  ], '07:40'),

  approvalsDesk: desk('Approvals', 'Approvals', [
    { kind: 'tabs', items: ['Waiting 3', 'Approved', 'Rejected'], active: 0 },
    { kind: 'table', head: ['Document', 'Id', 'Requested by', 'Reviewer', 'Status'], rows: [
      { cells: ['Bill', 'B-5523', 'Arun', '—', 'PENDING'], tone: 'amber' }, { cells: ['Truck load', 'TL-125', 'Arun', '—', 'PENDING'], tone: 'amber' }, { cells: ['Reversal', 'R-0077', 'Meena', '—', 'PENDING'], tone: 'amber' },
    ] },
    { kind: 'note', text: 'The reviewer is never the requester. A rejected line is revised as a new revision of the same document — never resubmitted as though it were new.' },
    { kind: 'buttons', items: [{ label: 'Approve', variant: 'primary' }, { label: 'Reject', variant: 'danger' }, { label: 'Send back', variant: 'outline' }] },
  ], 'Admin'),

  accessDesk: desk('Settings · Who can do what', 'Settings', [
    { kind: 'table', head: ['Function', 'Admin', 'Co-admin', 'Rep', 'Worker', 'Super', 'Receiving'], rows: [
      { cells: ['set_procurement_mode', '✓', '✓', '—', '—', '—', '—'] },
      { cells: ['confirm_truck_load_receiving', '✓', '✓', '—', '—', '—', 'blind'], tone: 'amber' },
      { cells: ['approve_document', '✓', '✓', '—', '—', '—', '—'] },
      { cells: ['record_bill_delivery', '✓', '✓', '✓', '—', '✓', '—'] },
    ] },
    { kind: 'note', text: 'Closed by default: a new function has no grants. A role gains access only through an explicit line in a migration. “blind” = allowed, with vendor and price removed from what it can return.' },
    { kind: 'note', text: 'Illustrative of the rules in amendments v3/v4. The receiving column is v3’s design; Phase B built the same guarantee as a flag on existing roles.', tone: 'amber' },
  ], 'Admin'),
} satisfies Record<string, ScreenSpec>;
