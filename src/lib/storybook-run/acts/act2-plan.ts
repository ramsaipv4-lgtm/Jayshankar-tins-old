// Act 2 — D66 (+D64): optional trip planning, built on the existing task system.
import type { Act } from '../types';
import { desk, phone, REP_NAV, ADMIN_SIDE } from './helpers';
import { LOAD } from '../fixtures';

export const plan: Act = {
  id: 'plan', n: 2, title: 'Plan the trip — or don\'t', clock: 'Mon 03:30', tone: 'ice', icon: 'route', decisions: ['D66', 'D64'],
  kicker: 'Half past three. An admin can pre-plan the trip as a task — or skip planning and let the rep simply start buying. Either way the same truck load is created.',
  beats: [
    {
      id: 'task', time: '03:30', title: 'A trip is a task', decisions: ['D66'],
      story: 'Planning is a new kind of task, not a new screen: “Procurement trip”. It takes a vehicle number and an assignee. Notice what it does not ask for — which vendors to visit.',
      why: 'The vendor field is shown struck-through on purpose. The client was explicit that vendor selection is decided live in the field, so the form states what it leaves out instead of leaving the reader to wonder whether it was forgotten.',
      criteria: ['§8.21a A trip task with no vendor information is creatable and completable end to end.', '§8.21b Ad-hoc procurement with no task remains fully functional.'],
      states: [
        { id: 'planned', label: 'With a plan', hint: 'The admin creates the trip task. A planned truck load is created with it.', views: [desk('admin', {
          title: 'Delegate a task', sub: 'Tasks · new', side: [...ADMIN_SIDE.slice(0, 2), 'Tasks', 'Truck loads', 'Approvals', 'Access'], active: 'Tasks',
          blocks: [
            { k: 'seg', l: 'Type', options: ['Receive delivery', 'Make sale', 'Pack', 'Procurement trip'], active: 3 },
            { k: 'field', l: 'Assign to', v: 'Arun · vendor rep' },
            { k: 'field', l: 'Vehicle number (optional)', v: LOAD.vehicle },
            { k: 'field', l: 'Vendors to visit', v: 'decided on the road', locked: true, hint: 'Never part of the plan' },
            { k: 'note', tone: 'ice', icon: 'info', text: 'Creating this also creates a planned truck load. The task completes by itself when that load completes.' },
            { k: 'btns', items: [{ t: 'Create trip', v: 'primary', icon: 'truck' }, { t: 'Cancel', v: 'ghost' }] },
          ],
        })] },
        { id: 'adhoc', label: 'Skip the plan', hint: 'No task at all. The rep starts a load directly — today\'s ad-hoc way, unchanged.', views: [phone('rep', {
          title: 'Truck loads', sub: 'Warehouse 1 · truck mode', tab: 'Load', nav: REP_NAV,
          blocks: [
            { k: 'note', tone: 'sea', icon: 'info', text: 'Nobody planned a trip today. That is fine — planning is never required to buy.' },
            { k: 'field', l: 'Vehicle number (optional)', v: LOAD.vehicle },
            { k: 'btns', items: [{ t: 'Start a load', v: 'primary', icon: 'truck' }] },
            { k: 'chips', items: [{ t: 'starts at in_progress', tone: 'sea' }, { t: 'no task needed', tone: 'sea' }] },
          ],
        })] },
      ],
    },
    {
      id: 'mytask', time: '03:34', title: 'It lands on the rep\'s phone', decisions: ['D66', 'D64'],
      story: 'Arun\'s task list now has a trip. The status rail is the truck load\'s own life story: planned, in progress, receiving, completed — the same shape the bills and reversals already use.',
      why: 'The rail is vertical and always shows all four stops, even the ones in the future, so the person holding the phone always knows what comes after “in progress”.',
      states: [{ id: 'rep', label: 'Rep\'s phone', views: [phone('rep', {
        title: 'My tasks', sub: 'Monday', tab: 'Tasks', nav: REP_NAV,
        blocks: [
          { k: 'list', items: [{ t: 'Procurement trip', s: `${LOAD.vehicle} · assigned by admin`, icon: 'truck', tone: 'ice', chip: 'planned', active: true }, { t: 'Receive delivery · Ocean Traders', s: 'done yesterday', icon: 'box', tone: 'kelp', chip: 'done' }] },
          { k: 'journey', title: `Truck load ${LOAD.id}`, items: [
            { t: 'Planned', time: '03:30', state: 'now' }, { t: 'In progress', state: 'todo' }, { t: 'Receiving', state: 'todo' }, { t: 'Completed', state: 'todo' },
          ] },
          { k: 'btns', items: [{ t: 'Start trip', v: 'primary', icon: 'play' }] },
        ],
      })] }],
    },
    {
      id: 'depart', time: '03:50', title: 'Wheels rolling', decisions: ['D64', 'D66'],
      story: 'The rep taps Start. The load moves to in progress and the departure time is stamped. At the same instant the admin\'s board shows a truck on the road.',
      why: 'Two devices, one event: this is the smallest example of the deck\'s main idea. The rep sees a rail; the admin sees a row on a board. Neither screen is a cut-down version of the other.',
      states: [{ id: 'both', label: 'Rep and admin', views: [
        phone('rep', {
          title: 'My tasks', sub: 'Monday', tab: 'Tasks', nav: REP_NAV, toast: { tone: 'kelp', text: 'Trip started · departure 03:50 recorded' },
          blocks: [{ k: 'journey', title: `Truck load ${LOAD.id}`, items: [
            { t: 'Planned', time: '03:30', state: 'done' }, { t: 'In progress', time: '03:50', state: 'now' }, { t: 'Receiving', state: 'todo' }, { t: 'Completed', state: 'todo' },
          ] }, { k: 'btns', items: [{ t: 'Add a purchase', v: 'primary', icon: 'plus' }] }],
        }, 'The rep sees the rail advance.'),
        desk('admin', {
          title: 'Truck loads', sub: 'Warehouse 1', side: ADMIN_SIDE, active: 'Truck loads',
          blocks: [
            { k: 'big', items: [{ v: '1', l: 'On the road', tone: 'sea' }, { v: '0', l: 'Receiving' }, { v: '0', l: 'Completed today' }] },
            { k: 'table', head: ['Load', 'Vehicle', 'Driver', 'Status', 'Departed'], rows: [{ c: [LOAD.id, LOAD.vehicle, LOAD.driver, 'IN PROGRESS', '03:50'], tone: 'sea' }] },
          ],
        }, 'The admin sees a row turn blue.'),
      ] }],
    },
  ],
};
