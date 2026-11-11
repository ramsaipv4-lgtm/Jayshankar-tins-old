// Act 5 — D70 (+D66): approvals belong to the document. The shape is copied from reversal_requests.
import type { Act } from '../types';
import { desk, phone, REP_NAV, ADMIN_SIDE } from './helpers';
import { LOAD, LINES, inr } from '../fixtures';

const kavitha = LINES.filter((l) => l.bill === 'B-5523');
const kavLines = kavitha.map((l) => `${l.sku} ${l.kg} kg × ₹${l.price}`);
const kavValue = inr(kavitha.reduce((s, l) => s + l.kg * l.price, 0));

export const stamps: Act = {
  id: 'stamps', n: 5, title: 'Stamps', clock: 'Mon 09:00', tone: 'plum', icon: 'stamp', decisions: ['D70', 'D66'],
  kicker: 'A bill, a truck load and a reversal each carry their own approval — not the user\'s, not the phase\'s. A rejected line cannot sneak back in as though it were new.',
  beats: [
    {
      id: 'inbox', time: '09:00', title: 'The inbox of stamps', decisions: ['D70'],
      story: 'Three documents are waiting for a decision, each on its own card: a bill, the truck load, and a reversal request from last week. The card is the document; the stamp is its state.',
      why: 'Approvals are drawn as paper with a stamp rather than as a status column because the decision belongs to the document. Each card is one thing that can be approved, rejected, or sent back — and the stamp lands with a thump so the change of state is felt.',
      states: [{ id: 'admin', label: 'Admin\'s inbox', views: [desk('admin', { title: 'Approvals', sub: '3 waiting', side: ADMIN_SIDE, active: 'Approvals', blocks: [
        { k: 'tabs', items: ['Waiting 3', 'Approved', 'Rejected'], active: 0 },
        { k: 'approval', doc: 'Bill', id: 'B-5523', by: 'Arun', state: 'pending', lines: kavLines, note: `Kavitha Fisheries · ${kavValue}` },
        { k: 'approval', doc: 'Truck load', id: LOAD.id, by: 'Arun', state: 'pending', lines: ['4 purchase lines', '550 kg on the load'] },
        { k: 'approval', doc: 'Reversal', id: 'R-0077', by: 'Meena', state: 'pending', lines: ['Sale S-1190 · 12 kg'], note: 'Customer returned damaged fish' },
      ] })] }],
    },
    {
      id: 'notself', time: '09:06', title: 'Not your own document', decisions: ['D70'],
      story: 'The reviewer cannot be the requester. If Arun opens his own bill, the Approve button is gone and the card explains why; when the admin opens it, the stamp lands.',
      why: 'The “blocked” stamp reads “NOT YOU” in the same slot where “APPROVED” will later land, so the missing button is explained on the document itself instead of being a mystery.',
      criteria: ['D70: a reviewer who is not the requester — the shape of reversal_requests.'],
      states: [
        { id: 'self', label: 'Arun opens his own bill', views: [phone('rep', { title: 'Bill B-5523', sub: 'Kavitha Fisheries', tab: 'Load', nav: REP_NAV, blocks: [
          { k: 'approval', doc: 'Bill', id: 'B-5523', by: 'Arun', reviewer: 'Meena', state: 'blocked', lines: kavLines },
          { k: 'gate', kind: 'block', title: 'You requested this', detail: 'Someone else has to approve it. Meena has been asked.' },
          { k: 'btns', items: [{ t: 'Approve', v: 'primary', disabled: true }, { t: 'Nudge Meena', v: 'ghost', icon: 'bell' }] },
        ] })] },
        { id: 'admin', label: 'The admin approves', views: [desk('admin', { title: 'Bill B-5523', sub: 'Waiting for you', side: ADMIN_SIDE, active: 'Approvals', toast: { tone: 'kelp', text: 'Approved · B-5523 · Kavitha Fisheries' }, blocks: [
          { k: 'approval', doc: 'Bill', id: 'B-5523', by: 'Arun', reviewer: 'Admin', state: 'approved', lines: kavLines },
          { k: 'btns', items: [{ t: 'Approve', v: 'primary', icon: 'check' }, { t: 'Reject', v: 'danger', icon: 'x' }, { t: 'Send back', v: 'ghost' }] },
        ] })] },
      ],
    },
    {
      id: 'reject', time: '09:14', title: 'Rejected stays rejected', decisions: ['D70'],
      story: 'A line is rejected with a reason. It cannot be resubmitted as though nothing happened: the fix is a revision, linked to the original, with its own approval. The history stays readable.',
      why: 'The two cards are drawn one under the other with revision chips (r1, r2) so the lineage reads top to bottom. The point of D70 is exactly this: “resubmitted as new” is the loophole being closed.',
      states: [
        { id: 'rejected', label: 'Rejected', views: [desk('admin', { title: 'Bill B-5523 · history', side: ADMIN_SIDE, active: 'Approvals', blocks: [
          { k: 'approval', doc: 'Bill', id: 'B-5523', rev: 'r1', by: 'Arun', reviewer: 'Admin', state: 'rejected', lines: kavLines, note: 'Prawns price looks high — check with the vendor.' },
          { k: 'note', tone: 'plum', icon: 'info', text: 'This revision stays rejected. The only way forward is a new revision of the same bill.' },
        ] })] },
        { id: 'revised', label: 'Revised', hint: 'A linked revision with its own approval.', views: [desk('admin', { title: 'Bill B-5523 · history', side: ADMIN_SIDE, active: 'Approvals', blocks: [
          { k: 'approval', doc: 'Bill', id: 'B-5523', rev: 'r1', by: 'Arun', reviewer: 'Admin', state: 'rejected', lines: kavLines, note: 'Prawns price looks high — check with the vendor.' },
          { k: 'approval', doc: 'Bill', id: 'B-5523', rev: 'r2', by: 'Arun', state: 'pending', lines: ['Seer 80 kg × ₹655', 'Prawns 150 kg × ₹510'], note: 'Vendor agreed ₹510.' },
        ] })] },
      ],
    },
    {
      id: 'complete', time: '09:20', title: 'The load completes itself', decisions: ['D70', 'D66'],
      story: 'The admin approves the truck load. Its status becomes completed — and because the trip was planned as a task, the task completes on its own. Nobody ticks a box.',
      why: 'One stamp on the admin\'s side, one tick on the rep\'s: the cause and its consequence are on screen at the same time. The auto-completion reuses the task system\'s existing pattern, so there is no new mechanism to explain.',
      criteria: ['D66: the task completes when its linked load reaches completed.'],
      states: [{ id: 'both', label: 'Admin and rep', views: [
        desk('admin', { title: `Truck load ${LOAD.id}`, side: ADMIN_SIDE, active: 'Approvals', toast: { tone: 'kelp', text: `${LOAD.id} completed` }, blocks: [
          { k: 'approval', doc: 'Truck load', id: LOAD.id, by: 'Arun', reviewer: 'Admin', state: 'approved', lines: ['4 purchase lines', '550 kg on the load'] },
          { k: 'journey', items: [{ t: 'Planned', state: 'done' }, { t: 'In progress', state: 'done' }, { t: 'Receiving', state: 'done' }, { t: 'Completed', time: '09:20', state: 'now' }] },
        ] }),
        phone('rep', { title: 'My tasks', sub: 'Monday', tab: 'Tasks', nav: REP_NAV, toast: { tone: 'kelp', text: 'Trip task done — by itself' }, blocks: [
          { k: 'list', items: [{ t: 'Procurement trip', s: `${LOAD.vehicle}`, icon: 'truck', tone: 'kelp', chip: 'done', active: true }] },
        ] }),
      ] }],
    },
  ],
};
