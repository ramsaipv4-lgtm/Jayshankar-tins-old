// Act 1 — D63: two ways to buy, one switch (per warehouse, admin-only, default "vendor").
import type { Act } from '../types';
import { desk, phone, REP_NAV, ADMIN_SIDE } from './helpers';
import { LOAD } from '../fixtures';

export const modes: Act = {
  id: 'modes', n: 1, title: 'Two ways to buy', clock: 'Sun 18:00', tone: 'sea', icon: 'switch', decisions: ['D63'],
  kicker: 'Sunday evening. Before any fish moves, an admin decides how this warehouse will buy — vendor by vendor, as it does today, or truck by truck.',
  beats: [
    {
      id: 'switch', time: '18:00', title: 'The switch', decisions: ['D63'],
      story: 'Each warehouse has its own vendors and SKUs, so each gets its own procurement mode. The default is “vendor” — nothing changes for anyone until an admin flips it on purpose.',
      why: 'The switch sits with the warehouse\'s other settings, not on a global admin page: the decision is per warehouse (the client: “keep both systems and based on an admin\'s toggle these systems are activated”). A segmented control, not a checkbox — both choices are equal citizens, neither is “off”.',
      criteria: ['§8.18a A warehouse that never flips the mode behaves exactly as today.'],
      states: [
        { id: 'vendor', label: 'Vendor mode (default)', hint: 'How every warehouse works today.', views: [desk('admin', {
          title: 'Warehouses', sub: 'Settings · Warehouse 1', side: ADMIN_SIDE, active: 'Warehouses',
          blocks: [
            { k: 'h', text: 'Warehouse 1', sub: 'Real operations' },
            { k: 'seg', l: 'How this warehouse buys', options: ['Vendor — one bill per vendor', 'Truck — one load, many vendors'], active: 0 },
            { k: 'note', tone: 'sea', icon: 'info', title: 'Vendor mode', text: 'Exactly what you use today. Each purchase is its own bill. No truck loads, no new screens.' },
            { k: 'kv', title: 'This warehouse owns', items: [{ l: 'Vendors', v: '14' }, { l: 'SKUs', v: '38' }, { l: 'Open bills', v: '6' }, { l: 'Open truck loads', v: '—' }] },
            { k: 'btns', items: [{ t: 'Save', v: 'primary', disabled: true }, { t: 'Cancel', v: 'ghost' }] },
          ],
        }, 'The mode lives with the other warehouse settings.')] },
        { id: 'truck', label: 'Truck mode', hint: 'The consolidated way: one load per trip, many vendors inside it.', views: [desk('admin', {
          title: 'Warehouses', sub: 'Settings · Warehouse 1', side: ADMIN_SIDE, active: 'Warehouses',
          blocks: [
            { k: 'h', text: 'Warehouse 1', sub: 'Real operations' },
            { k: 'seg', l: 'How this warehouse buys', options: ['Vendor — one bill per vendor', 'Truck — one load, many vendors'], active: 1 },
            { k: 'note', tone: 'coral', icon: 'truck', title: 'Truck mode', text: 'A trip becomes a truck load. Each vendor purchase is still its own bill — now tagged to the load.' },
            { k: 'kv', title: 'This warehouse owns', items: [{ l: 'Vendors', v: '14' }, { l: 'SKUs', v: '38' }, { l: 'Open bills', v: '6' }, { l: 'Open truck loads', v: '0' }] },
            { k: 'btns', items: [{ t: 'Save', v: 'primary' }, { t: 'Cancel', v: 'ghost' }] },
          ],
        }, 'Flipping it changes how new purchases are recorded — nothing already recorded.')] },
      ],
    },
    {
      id: 'confirm', time: '18:04', title: 'Flip with confidence', decisions: ['D63'],
      story: 'Changing how a warehouse buys is a big move, so the confirmation says what changes and, more importantly, what does not. Only an admin or co-admin can do it.',
      why: 'The sheet is a two-column promise — “changes” and “stays” — because the fear behind this decision is breaking today\'s live behaviour. Leading with what stays the same is the honest way to ask for a risky tap.',
      criteria: ['§8.18b Only admin / co-admin can change the procurement mode.'],
      states: [
        { id: 'admin', label: 'Admin flips it', hint: 'The confirmation, and the function that records it.', views: [desk('admin', {
          title: 'Warehouses', sub: 'Settings · Warehouse 1', side: ADMIN_SIDE, active: 'Warehouses',
          blocks: [
            { k: 'seg', l: 'How this warehouse buys', options: ['Vendor', 'Truck'], active: 1 },
            { k: 'kv', items: [{ l: 'Mode before', v: 'Vendor' }, { l: 'Mode after', v: 'Truck', tone: 'coral' }] },
          ],
          sheet: { title: 'Switch Warehouse 1 to truck mode?', blocks: [
            { k: 'list', title: 'What changes', items: [{ t: 'New purchases are recorded on a truck load', icon: 'truck', tone: 'coral' }, { t: 'Receiving confirms the load, not each bill', icon: 'scale', tone: 'coral' }] },
            { k: 'list', title: 'What stays exactly the same', items: [{ t: 'Every existing bill and batch', icon: 'receipt', tone: 'kelp' }, { t: 'Vendor-wise purchase prices', icon: 'rupee', tone: 'kelp' }, { t: 'You can switch back at any time', icon: 'sync', tone: 'kelp' }] },
            { k: 'btns', items: [{ t: 'Switch to truck', v: 'primary' }, { t: 'Not now', v: 'ghost' }] },
          ] },
        })], rpc: { fn: 'set_procurement_mode(warehouse, mode)', caller: 'admin', returns: [
          { key: 'warehouse_id', value: 'wh-1', present: true }, { key: 'procurement_mode', value: '"truck"', present: true }, { key: 'changed_by', value: 'admin', present: true },
        ], verdict: { tone: 'ok', text: 'Allowed: admin and co-admin may change a warehouse\'s mode.' } } },
        { id: 'rep', label: 'A vendor rep tries', hint: 'The same setting, seen by someone who is not allowed to change it.', views: [phone('rep', {
          title: 'Warehouse 1', sub: 'Settings', tab: 'More', nav: REP_NAV,
          blocks: [
            { k: 'seg', l: 'How this warehouse buys', options: ['Vendor', 'Truck'], active: 0 },
            { k: 'gate', kind: 'block', title: 'Only an admin can change this', detail: 'The procurement mode decides how everyone in the warehouse records purchases, so it is not a personal setting.', foot: 'Enforced by the function, not just the screen' },
            { k: 'btns', items: [{ t: 'Ask an admin', v: 'ghost', icon: 'user' }] },
          ],
        })], rpc: { fn: 'set_procurement_mode(warehouse, mode)', caller: 'vendor-rep', returns: [{ key: 'procurement_mode', value: '—', present: false }],
          verdict: { tone: 'block', text: 'Rejected: caller is not admin or co-admin. The setting cannot be changed from the app or by calling the function directly.' } } },
      ],
    },
    {
      id: 'perwh', time: '18:10', title: 'One warehouse at a time', decisions: ['D63'],
      story: 'Three warehouses, three independent answers. One has been buying by truck for a month; two have never changed. Per-warehouse scope means a cautious rollout is simply what happens.',
      why: 'A table, not a chart: the question an owner asks here is “which of my warehouses are on which mode right now?” — a lookup, so it is drawn as a lookup. The mode chip is the only colour on the page.',
      criteria: ['§8.18a Nothing changes for a warehouse that is never flipped.'],
      states: [{ id: 'overview', label: 'Overview', views: [desk('admin', {
        title: 'Warehouses', sub: 'All locations', side: ADMIN_SIDE, active: 'Warehouses',
        blocks: [
          { k: 'big', items: [{ v: '3', l: 'Warehouses' }, { v: '1', l: 'On truck mode', tone: 'coral' }, { v: '2', l: 'On vendor mode', tone: 'sea' }] },
          { k: 'table', head: ['Warehouse', 'Mode', 'Open loads', 'Open bills'], rows: [
            { c: ['Warehouse 1 · Real operations', 'TRUCK', '1', '6'], tone: 'coral' },
            { c: ['Warehouse 2 · Demo', 'VENDOR', '—', '4'], tone: 'sea' },
            { c: ['Warehouse 3 · Simulated', 'VENDOR', '—', '9'], tone: 'sea' },
          ] },
          { k: 'note', tone: 'sun', icon: 'info', text: 'Each warehouse keeps its own vendors and SKUs (D23). The mode follows the same rule.' },
        ],
      })] }],
    },
    {
      id: 'same', time: '18:15', title: 'Nothing else moves', decisions: ['D63', 'D64'],
      story: 'The same rep, two warehouses. In vendor mode a purchase is a bill. In truck mode it is still a bill — with one extra tag, the load it belongs to. The bill itself does not change shape.',
      why: 'Two phones side by side, identical except for the highlighted line, make the claim checkable by eye: truck mode is additive. The only difference on the second phone is the last field.',
      criteria: ['§8.18a Vendor-mode behaviour is provably unchanged.', '§8.19a A bill\'s truck_load_id is NULL in vendor mode and references a load in the same warehouse in truck mode.'],
      states: [{ id: 'compare', label: 'Side by side', views: [
        phone('rep', { title: 'Record purchase', sub: 'Warehouse 2 · vendor mode', tab: 'Buy', nav: REP_NAV, blocks: [
          { k: 'field', l: 'Vendor', v: 'Ocean Traders' }, { k: 'field', l: 'Fish', v: 'Seer' }, { k: 'field', l: 'Weight', v: '200', suffix: 'kg' }, { k: 'field', l: 'Price per kg', v: '640', suffix: '₹' },
          { k: 'chips', items: [{ t: 'bill.truck_load_id = NULL', tone: 'sea', icon: 'receipt' }] },
          { k: 'btns', items: [{ t: 'Save bill', v: 'primary' }] },
        ] }, 'Vendor mode — today\'s screen.'),
        phone('rep', { title: 'Record purchase', sub: `Warehouse 1 · truck mode`, tab: 'Buy', nav: REP_NAV, blocks: [
          { k: 'field', l: 'Vendor', v: 'Ocean Traders' }, { k: 'field', l: 'Fish', v: 'Seer' }, { k: 'field', l: 'Weight', v: '200', suffix: 'kg' }, { k: 'field', l: 'Price per kg', v: '640', suffix: '₹' },
          { k: 'field', l: 'Add to load', v: `${LOAD.id} · ${LOAD.vehicle}`, hint: 'The one new field' },
          { k: 'chips', items: [{ t: `bill.truck_load_id = ${LOAD.id}`, tone: 'coral', icon: 'truck' }] },
          { k: 'btns', items: [{ t: 'Save bill to load', v: 'primary' }] },
        ] }, 'Truck mode — same bill, plus the load.'),
      ] }],
    },
  ],
};
