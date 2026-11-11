// Act 6 — D75 (+D64): money stays at the promised amount; stock follows the scale; landed cost is derived.
import type { Act } from '../types';
import { desk, phone, RECV_NAV, ADMIN_SIDE } from './helpers';
import { LOAD, SEER, SEER_KG, SEER_VALUE, SEER_AVG, WEIGH, seerCounted, seerShort, inr } from '../fixtures';
import type { Block } from '../types';

const effective = SEER_VALUE / WEIGH.seer.good; // an IDEA, labelled as one — not in the amendments
const merge = (hidden: boolean): Block => ({
  k: 'merge', title: 'Seer — blended cost', hidden,
  // When hidden, the data itself is stripped: no vendor, no price, no figure. A blur over real numbers would only
  // be a drawing; this is the same "never sent" rule as the blind receiving view.
  streams: SEER.map((l, i) => ({ who: hidden ? '' : l.who, kg: l.kg, price: hidden ? 0 : l.price, tone: (['sea', 'coral', 'sun'] as const)[i] })),
  result: hidden ? '₹•••' : `₹${SEER_AVG.toFixed(2)}`, per: hidden ? 'derived on read — admin only' : `per kg · Σ(price × kg) ÷ ${SEER_KG} kg`,
});

export const money: Act = {
  id: 'money', n: 6, title: 'Money vs the scale', clock: 'Mon 10:00', tone: 'kelp', icon: 'rupee', decisions: ['D75', 'D64'],
  kicker: 'The scale said 397 kg, not 400. Stock follows the scale at once. The amount owed does not — and a derived cost figure must never be mistaken for it.',
  beats: [
    {
      id: 'twin', time: '10:00', title: 'Two numbers, one load', decisions: ['D75'],
      story: 'Two figures describe the same Seer. What was promised to the vendors has not moved. What the scale found has. They are allowed to differ, and the screen puts them next to each other with the gap named.',
      why: 'A “not equal” sign between two cards is the entire rule. Most systems quietly recompute the amount from the new weight; this one shows the disagreement and leaves the decision to a person.',
      criteria: ['D75: the amount owed does not silently follow the corrected weight.'],
      states: [
        { id: 'admin', label: 'Admin', views: [desk('admin', { title: `Seer · ${LOAD.id}`, side: ADMIN_SIDE, active: 'Truck loads', blocks: [
          { k: 'twin', a: { l: 'Promised to vendors', v: inr(SEER_VALUE), sub: `${SEER_KG} kg expected · stays until money moves`, tone: 'sea' }, b: { l: 'Found on the scale', v: `${seerCounted} kg`, sub: `${WEIGH.seer.good} good · ${WEIGH.seer.spoiled} spoiled`, tone: 'coral' }, gap: `${seerShort} kg`, caption: 'Stock already follows the scale. The amount owed waits for a person.' },
          { k: 'btns', items: [{ t: 'Raise it with the vendors', v: 'primary', icon: 'users' }, { t: 'Leave as promised', v: 'ghost' }] },
        ] })] },
        { id: 'receiver', label: 'Receiving seat', hint: 'The same load, seen by the person who weighed it.', views: [phone('receiver', { title: 'Seer', sub: LOAD.id, tab: 'Stock', nav: RECV_NAV, blocks: [
          { k: 'big', items: [{ v: `${WEIGH.seer.good} kg`, l: 'In stock now', tone: 'kelp' }, { v: `${WEIGH.seer.spoiled} kg`, l: 'Spoilage', tone: 'sun' }] },
          { k: 'note', tone: 'ink', icon: 'lock', text: 'Money is not part of your view. You weigh; the admin settles.' },
        ] })] },
      ],
    },
    {
      id: 'landed', time: '10:08', title: 'How the cost is made', decisions: ['D64', 'D75'],
      story: 'The blended cost of the Seer is worked out the moment an admin asks, never stored. It is a figure about cost — useful for pricing — and it is not the amount anyone owes.',
      why: 'Same ribbons as on the road, now with a blurred lock for everyone who cannot see vendor prices: a derived number that reveals prices has to be as hidden as the prices. The idea panel is flagged as an idea because it is not in either amendment.',
      criteria: ['§8.19b Landed cost = Σ(price × kg) ÷ Σ kg over exactly the load\'s bills.'],
      states: [
        { id: 'admin', label: 'Admin', views: [desk('admin', { title: 'Landed cost', sub: `Seer · ${LOAD.id}`, side: ADMIN_SIDE, active: 'Reports', blocks: [
          merge(false),
          { k: 'note', tone: 'sun', icon: 'flag', title: 'Idea — not in the amendments', text: `On the ${WEIGH.seer.good} kg that were actually good, the same money is ${inr(effective)}/kg. Worth showing next to the blend? Your call.` },
        ] })] },
        { id: 'others', label: 'Everyone else', hint: 'A figure built from prices is a price.', views: [phone('rep', { title: 'Landed cost', sub: `Seer · ${LOAD.id}`, tab: 'Load', blocks: [merge(true)] })] },
      ],
    },
    {
      id: 'pay', time: '10:30', title: 'Payment posts', decisions: ['D75'],
      story: 'Money moves only when someone posts a payment. Until then the promise stands. After, the amount owed changes — because cash changed hands, not because a scale disagreed.',
      why: 'The ledger is a plain list with one changing figure at the top. The visual rule is that the number moves in exactly one situation, and the screen only shows that situation.',
      states: [
        { id: 'before', label: 'Before payment', views: [desk('admin', { title: 'Murugan Marine', sub: 'Payable', side: ADMIN_SIDE, active: 'Reports', blocks: [
          { k: 'big', items: [{ v: inr(SEER[0].kg * SEER[0].price), l: 'Owed', tone: 'coral' }, { v: '₹0', l: 'Paid' }] },
          { k: 'list', title: 'Bills', items: [{ t: SEER[0].bill, s: `${SEER[0].sku} ${SEER[0].kg} kg × ₹${SEER[0].price}`, r: inr(SEER[0].kg * SEER[0].price), icon: 'receipt', tone: 'coral' }] },
          { k: 'btns', items: [{ t: 'Post payment', v: 'primary', icon: 'rupee' }] },
        ] })] },
        { id: 'after', label: 'After payment', views: [desk('admin', { title: 'Murugan Marine', sub: 'Payable', side: ADMIN_SIDE, active: 'Reports', toast: { tone: 'kelp', text: `Payment of ${inr(SEER[0].kg * SEER[0].price)} posted` }, blocks: [
          { k: 'big', items: [{ v: '₹0', l: 'Owed', tone: 'kelp' }, { v: inr(SEER[0].kg * SEER[0].price), l: 'Paid' }] },
          { k: 'list', title: 'Bills', items: [{ t: SEER[0].bill, s: 'settled', r: inr(SEER[0].kg * SEER[0].price), icon: 'check', tone: 'kelp', chip: 'paid' }] },
        ] })] },
      ],
    },
  ],
};
