// Act 8 — D67 (OPEN) and D74: which look, and how a reviewer points at a moment.
import type { Act } from '../types';
import { desk } from './helpers';

export const look: Act = {
  id: 'look', n: 8, title: 'Which look?', clock: 'Your move', tone: 'sun', icon: 'eye', decisions: ['D67', 'D74'],
  kicker: 'The look is the client\'s choice, and it is meant to be made by looking. Three decks now exist; this is where the answer goes.',
  beats: [
    {
      id: 'choose', time: 'Compare', title: 'Three decks, one question', decisions: ['D67'],
      story: 'D67 is the only OPEN decision in v4. The same product has been drawn three ways. Pick one — it is stored in this browser and can be copied into a message — and the question stops being an argument.',
      why: 'The choice is a tap, not a form, and the answer is a sentence you can paste into WhatsApp, because the client is reachable on a phone, not in a meeting. Nothing is uploaded anywhere.',
      states: [{ id: 'compare', label: 'Compare', views: [desk('admin', { title: 'Design review', sub: 'D67 · open', side: ['Overview', 'Decks', 'Your pick'], active: 'Decks', blocks: [{ k: 'looks' }] })] }],
    },
    {
      id: 'cite', time: 'Cite', title: 'Point at a moment', decisions: ['D74'],
      story: 'In this deck every moment has its own address. A reviewer who sees something wrong sends the address — “Act 4, 07:48, the Phase B lens” — instead of describing a screen.',
      why: 'D74 says a deviation found in review is a defect, not a preference. That only works if the artefact can be pointed at precisely, so the link button on every moment copies one.',
      states: [{ id: 'links', label: 'Examples', views: [desk('admin', { title: 'How to cite', side: ['Overview', 'Decks', 'Your pick'], active: 'Decks', blocks: [
        { k: 'list', title: 'Example addresses (append to this deck\'s URL)', items: [
          { t: 'The blind scale — v3 role', s: '#/act/scale?b=1&s=receiver', icon: 'link', tone: 'coral' },
          { t: 'The blind scale — Phase B flag', s: '#/act/scale?b=1&s=flag', icon: 'link', tone: 'coral' },
          { t: 'Offline, no signal', s: '#/act/road?b=2&s=offline', icon: 'link', tone: 'sea' },
          { t: 'Rejected stays rejected — revised', s: '#/act/stamps?b=2&s=revised', icon: 'link', tone: 'plum' },
        ] },
        { k: 'note', tone: 'sun', icon: 'flag', text: 'A deviation found in review is a defect, not a preference (D74) — so say which moment, not which feeling.' },
      ] })] }],
    },
  ],
};
