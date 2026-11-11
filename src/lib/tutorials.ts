// tutorials.ts — the 36-video "how to use v1" library. Every video is a real screen recording
// (Playwright, not staged screenshots) of someone actually doing the thing, verified against
// the live database afterward, then turned into a captioned video via HyperFrames. Source and
// production pipeline: hyperframes-video/ (record-*.mjs + gen-*.mjs), not shipped with the app.
//
// `roles` says which audiences see this by default on the Learn page (TutorialLibrary.tsx) --
// a judgment call about who'd actually do this in practice, not the (usually broader) set of
// roles the route itself permits. `audienceFor()` maps a real signed-in Role to the audience
// bucket(s) it should see; co-admin mirrors admin everywhere, and super-worker -- who genuinely
// holds both worker's floor-work access and a rep's sales/money/complaints access (see App.tsx's
// own `expected` arrays) -- sees both 'worker' and 'vendor-rep' videos.

import { Role } from './auth';

export type Audience = 'admin' | 'vendor-rep' | 'worker';

export type TutorialCategory =
  | 'getting-started'
  | 'inventory'
  | 'money'
  | 'trust'
  | 'admin-setup'
  | 'tasks'
  | 'search'
  | 'walkthroughs';

export const CATEGORY_LABEL: Record<TutorialCategory, string> = {
  'getting-started': 'Getting Started',
  inventory: 'Inventory & Stock',
  money: 'Money & Customers',
  trust: 'Trust & Corrections',
  'admin-setup': 'Admin Setup',
  tasks: 'Task Coordination',
  search: 'Search',
  walkthroughs: 'Complete Walkthroughs',
};

// Category display order on the page -- roughly the order someone new would actually need
// these, not alphabetical.
export const CATEGORY_ORDER: TutorialCategory[] = [
  'getting-started', 'inventory', 'money', 'trust', 'admin-setup', 'tasks', 'search', 'walkthroughs',
];

export interface Tutorial {
  n: number;
  slug: string;
  title: string;
  tag: string;
  file: string;
  durationSeconds: number;
  category: TutorialCategory;
  roles: Audience[];
}

export const TUTORIALS: Tutorial[] = [
  { n: 1, slug: '01-record-a-purchase', title: 'Record a Purchase', tag: "What a rep actually does when a vendor delivers — start to finish, real time.", file: '/tutorials/01-record-a-purchase.mp4', durationSeconds: 24, category: 'getting-started', roles: ['vendor-rep'] },
  { n: 2, slug: '02-record-a-sale', title: 'Record a Sale', tag: "What a rep actually does when a buyer takes stock — start to finish, real time.", file: '/tutorials/02-record-a-sale.mp4', durationSeconds: 20, category: 'getting-started', roles: ['vendor-rep'] },

  { n: 3, slug: '03-transfer', title: 'Transfer Between Warehouses', tag: 'Cross-warehouse only -- moving stock within one warehouse is repack, not transfer.', file: '/tutorials/03-transfer.mp4', durationSeconds: 30, category: 'inventory', roles: ['admin'] },
  { n: 4, slug: '04-spoilage', title: 'Record Spoilage', tag: 'A worker marks kg as waste -- containers first, then storage, same cascade as a sale.', file: '/tutorials/04-spoilage.mp4', durationSeconds: 33, category: 'inventory', roles: ['worker'] },
  { n: 5, slug: '05-confirm-happy-path', title: 'A Delivery That Matches', tag: 'The happy path for the in-transit workflow -- promised and measured line up exactly.', file: '/tutorials/05-confirm-happy-path.mp4', durationSeconds: 25, category: 'inventory', roles: ['vendor-rep'] },
  { n: 6, slug: '06-floor-repack', title: 'The Floor Dashboard', tag: 'What a worker actually sees: current stock by location, and consolidating near-empty tubs.', file: '/tutorials/06-floor-repack.mp4', durationSeconds: 62, category: 'inventory', roles: ['worker'] },
  { n: 7, slug: '07-pack-ownership', title: 'Whose Box Is It?', tag: 'A new container can be flagged as the vendor’s own, not just "ours."', file: '/tutorials/07-pack-ownership.mp4', durationSeconds: 26, category: 'inventory', roles: ['vendor-rep'] },
  { n: 8, slug: '08-direct-sale', title: 'Selling Straight From Storage', tag: 'No container involved at all -- the other half of the sale cascade.', file: '/tutorials/08-direct-sale.mp4', durationSeconds: 25, category: 'inventory', roles: ['vendor-rep'] },

  { n: 9, slug: '09-add-customer', title: 'Add a Customer', tag: 'Name and phone up front; credit terms and preferences tucked behind "More settings."', file: '/tutorials/09-add-customer.mp4', durationSeconds: 23, category: 'money', roles: ['admin', 'vendor-rep'] },
  { n: 10, slug: '10-record-payment', title: 'Record a Payment', tag: 'Pick a customer, see what they owe, record what actually came in.', file: '/tutorials/10-record-payment.mp4', durationSeconds: 35, category: 'money', roles: ['vendor-rep', 'admin'] },
  { n: 11, slug: '11-whatsapp-share', title: 'Share a Bill Over WhatsApp', tag: 'A real draft built from the bill’s own lines -- fully editable before it goes anywhere.', file: '/tutorials/11-whatsapp-share.mp4', durationSeconds: 30, category: 'money', roles: ['admin'] },
  { n: 12, slug: '12-add-vendor', title: 'Add a Vendor', tag: 'Same five-second discipline as adding a customer -- name and phone first.', file: '/tutorials/12-add-vendor.mp4', durationSeconds: 22, category: 'money', roles: ['admin'] },
  { n: 13, slug: '13-defer-reconciliation', title: 'Defer With a Reminder', tag: 'A credit bill doesn’t have to be settled today -- set a reminder instead.', file: '/tutorials/13-defer-reconciliation.mp4', durationSeconds: 33, category: 'money', roles: ['admin'] },

  { n: 14, slug: '14-self-reverse', title: 'Self-Reverse a Sale', tag: 'A trusted admin can approve their own correction instantly -- when that permission is on.', file: '/tutorials/14-self-reverse.mp4', durationSeconds: 39, category: 'trust', roles: ['admin'] },
  { n: 15, slug: '15-deny-reversal', title: 'Denying a Reversal', tag: 'Not every request gets approved -- the sale stands, on record either way.', file: '/tutorials/15-deny-reversal.mp4', durationSeconds: 41, category: 'trust', roles: ['admin'] },
  { n: 16, slug: '16-notifications', title: 'Notifications', tag: 'A bill comes in -- the admin sees it land in their own inbox.', file: '/tutorials/16-notifications.mp4', durationSeconds: 28, category: 'trust', roles: ['admin', 'vendor-rep', 'worker'] },
  { n: 17, slug: '17-audit-log', title: 'The Audit Log', tag: 'Every insert, update, and delete -- filterable by table, user, and date.', file: '/tutorials/17-audit-log.mp4', durationSeconds: 18, category: 'trust', roles: ['admin'] },
  { n: 18, slug: '18-complaint-rejected', title: 'A Complaint, Rejected', tag: 'Not every complaint has merit -- this is what "no refund at all" looks like.', file: '/tutorials/18-complaint-rejected.mp4', durationSeconds: 49, category: 'trust', roles: ['admin', 'vendor-rep'] },
  { n: 19, slug: '19-cancel-task', title: 'Cancel a Delegated Task', tag: 'Plans change -- a task that’s no longer needed can just be called off.', file: '/tutorials/19-cancel-task.mp4', durationSeconds: 22, category: 'trust', roles: ['admin'] },
  { n: 20, slug: '20-edit-vendor', title: 'Edit an Existing Vendor', tag: 'Tap any vendor to update what’s known about them.', file: '/tutorials/20-edit-vendor.mp4', durationSeconds: 21, category: 'trust', roles: ['admin'] },

  { n: 21, slug: '21-add-warehouse', title: 'Add a Warehouse', tag: 'One field: what to call it. Everything else is derived.', file: '/tutorials/21-add-warehouse.mp4', durationSeconds: 18, category: 'admin-setup', roles: ['admin'] },
  { n: 22, slug: '22-add-fish-type', title: 'Add a Fish Type', tag: 'Five fields up front; shelf life and storage tucked behind "More settings."', file: '/tutorials/22-add-fish-type.mp4', durationSeconds: 21, category: 'admin-setup', roles: ['admin'] },
  { n: 23, slug: '23-invite-team', title: 'Invite Someone New', tag: 'A real link to share by hand -- nothing sends itself.', file: '/tutorials/23-invite-team.mp4', durationSeconds: 22, category: 'admin-setup', roles: ['admin'] },
  { n: 24, slug: '24-role-change-orphan', title: 'Turning Off Access', tag: 'Someone with an open task loses access -- what happens to their work?', file: '/tutorials/24-role-change-orphan.mp4', durationSeconds: 31, category: 'admin-setup', roles: ['admin'] },
  { n: 25, slug: '25-self-reverse-toggle', title: 'Granting Self-Reverse', tag: 'Admin/co-admin only, off by default -- this is the switch.', file: '/tutorials/25-self-reverse-toggle.mp4', durationSeconds: 16, category: 'admin-setup', roles: ['admin'] },

  { n: 26, slug: '26-round-robin', title: 'Auto-Assign, Round Robin', tag: 'Don’t pick anyone -- let the system find whoever’s least loaded right now.', file: '/tutorials/26-round-robin.mp4', durationSeconds: 17, category: 'tasks', roles: ['admin'] },
  { n: 27, slug: '27-custom-task', title: 'A Custom Task, By Hand', tag: 'No underlying action to auto-complete it -- Start and Mark complete are real buttons here.', file: '/tutorials/27-custom-task.mp4', durationSeconds: 28, category: 'tasks', roles: ['admin', 'worker'] },
  { n: 28, slug: '28-pack-repack-task', title: 'A Task That Closes Itself', tag: 'Pack or repack anything, and a delegated pack/repack task completes on its own.', file: '/tutorials/28-pack-repack-task.mp4', durationSeconds: 67, category: 'tasks', roles: ['admin', 'worker'] },
  { n: 29, slug: '29-my-tasks-worker', title: 'My Tasks', tag: 'What’s been delegated, and what’s already done -- one worker’s own view.', file: '/tutorials/29-my-tasks-worker.mp4', durationSeconds: 15, category: 'tasks', roles: ['worker', 'vendor-rep'] },

  { n: 30, slug: '30-search', title: 'Find Anything, Fast', tag: 'One box: fish (English, Tamil, or Tanglish), customers, vendors, employees, phone numbers.', file: '/tutorials/30-search.mp4', durationSeconds: 21, category: 'search', roles: ['admin', 'vendor-rep', 'worker'] },

  { n: 31, slug: '31-receive-pack-sell', title: 'Receive → Pack → Sell', tag: "One batch's whole life, start to finish — as one rep, in real time.", file: '/tutorials/31-receive-pack-sell.mp4', durationSeconds: 31, category: 'walkthroughs', roles: ['vendor-rep'] },
  { n: 32, slug: '32-shortfall-reconcile', title: 'A Delivery, Short', tag: 'In transit, confirmed at the door, and settled with the vendor by hand.', file: '/tutorials/32-shortfall-reconcile.mp4', durationSeconds: 43, category: 'walkthroughs', roles: ['vendor-rep', 'admin'] },
  { n: 33, slug: '33-return-resolve', title: 'A Complaint, Resolved', tag: "A customer calls back — split what's actually bad from what's fine, refund only that.", file: '/tutorials/33-return-resolve.mp4', durationSeconds: 43, category: 'walkthroughs', roles: ['vendor-rep', 'admin'] },
  { n: 34, slug: '34-correction-execute', title: 'Undo a Sale, Properly', tag: 'A rep requests it, an admin signs off — stock and money both undone together.', file: '/tutorials/34-correction-execute.mp4', durationSeconds: 41, category: 'walkthroughs', roles: ['vendor-rep', 'admin'] },
  { n: 35, slug: '35-running-low-repack', title: 'Running Low Mid-Shift', tag: "Pack, sell most of it, then repack what's left into a smaller tub.", file: '/tutorials/35-running-low-repack.mp4', durationSeconds: 54, category: 'walkthroughs', roles: ['vendor-rep'] },
  { n: 36, slug: '36-delegate-complete', title: 'Delegate & Auto-Complete', tag: "Admin assigns the work — it closes itself the moment it's actually done.", file: '/tutorials/36-delegate-complete.mp4', durationSeconds: 30, category: 'walkthroughs', roles: ['admin', 'vendor-rep'] },
];

// audienceFor — which Learn-page audience bucket(s) a real signed-in role sees by default.
// co-admin mirrors admin everywhere in this app (Shell's own `expected` arrays never separate
// them); super-worker holds both a worker's floor-work access AND a rep's sales/money/
// complaints access (same arrays), so it sees both buckets.
export function audienceFor(role: Role): Audience[] {
  switch (role) {
    case 'admin':
    case 'co-admin':
      return ['admin'];
    case 'vendor-rep':
      return ['vendor-rep'];
    case 'worker':
      return ['worker'];
    case 'super-worker':
      return ['worker', 'vendor-rep'];
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}
