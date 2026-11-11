// People & exceptions — chapters 18–20 of the deck.
//
// Three workflows the client's own prompt sheets spell out screen by screen: prompt-9.md's
// complaint half (Recent Sales → File Complaint → Pending Complaints → Review), prompt-10.md
// (task delegation, with the manager's completed view that needs no mark-done button) and
// prompt-11.md (inviting a staff member by phone, where the admin shares the link themselves).
//
// Every name, weight and rupee here is the client's: Saravanan Hotels, Murugan Stores, Anand,
// Kumar, Priya, Suresh, 9876543210, TC-0042, TC-0037, TC-0044, 50 KG, 8 KG, 12 / 50 KG packed,
// ₹ 3,680, ₹ 2,300, 09:42 AM, 11:54 AM, "6 min ahead of deadline".
//
// Three details are ours, and each is commented where it appears: Bill #137 (the bill behind
// Murugan Stores' ₹ 14,200 in chapters 14–17), the invite token, and the clock times the sheets
// do not give.

import type { Chapter } from '@/lib/storybook/types';

export const PEOPLE_CHAPTERS: Chapter[] = [
  {
    id: 'complaints',
    number: 18,
    group: 'people',
    title: 'Customer complaints',
    subtitle: 'A bad load filed from the phone, reviewed by the admin, settled with credit.',
    tag: 'JAYSHANKAR · RETURNS & COMPLAINTS',
    steps: [
      {
        id: 'recent-sales',
        caption: 'The newest sale sits on top, with a File Complaint button under it.',
        screen: {
          title: 'Recent Sales',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              kind: 'rows',
              items: [
                {
                  label: 'Saravanan Hotels · Bill #142',
                  sub: '50 KG Sela Fish · dispatched Today 09:30 AM',
                  value: '₹ 23,000',
                  icon: 'fish',
                },
                {
                  label: 'Murugan Stores · Bill #137',
                  sub: 'dispatched 5 Sep · settled today',
                  value: '₹ 14,200',
                  icon: 'fish',
                },
              ],
            },
            { kind: 'buttons', items: [{ label: 'File Complaint', variant: 'danger' }] },
            {
              kind: 'note',
              text: 'A complaint is always filed against the sale, so the fish and the money stay traceable.',
            },
          ],
        },
      },
      {
        id: 'file-complaint',
        caption: 'The rep fills the complaint — how many kilos, why, and a photo.',
        screen: {
          title: 'File Complaint',
          back: true,
          right: 'Bill #142',
          tab: 'Home',
          blocks: [
            { kind: 'field', label: 'Sale reference', value: 'Bill #142 — Saravanan Hotels' },
            { kind: 'field', label: 'KG affected', value: '8', suffix: 'KG' },
            { kind: 'select', label: 'Reason', value: 'Quality issue', icon: 'alert' },
            { kind: 'field', label: 'Description', value: 'Fish arrived warm, 8 KG visibly spoiled' },
            { kind: 'photos', count: 2, caption: 'Photo evidence (photo recommended)' },
            { kind: 'buttons', items: [{ label: 'Submit', variant: 'danger' }] },
          ],
        },
      },
      {
        id: 'pending-complaints',
        caption: 'Both complaints wait in one list for the admin to review.',
        screen: {
          title: 'Pending Complaints',
          back: true,
          right: 'Admin',
          tab: 'More',
          blocks: [
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'bell',
              title: '2 complaints waiting for review',
              detail: 'One filed today, one filed yesterday',
            },
            {
              kind: 'rows',
              items: [
                {
                  label: 'Saravanan Hotels · 8 KG quality',
                  sub: 'from rep Anand · Bill #142 · filed 11:52 AM',
                  value: 'Review',
                  icon: 'complaint',
                },
                {
                  // #137 is the bill this deck puts behind Murugan Stores' ₹ 14,200 — see chapter 16.
                  label: 'Murugan Stores · 3 KG wrong grade',
                  sub: 'from rep Kumar · Bill #137 · filed yesterday',
                  value: 'Review',
                  icon: 'complaint',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'review-complaint',
        caption: 'The admin sees the sale and the complaint side by side and picks the refund.',
        screen: {
          title: 'Review Complaint',
          back: true,
          right: 'Bill #142',
          tab: 'More',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Customer', value: 'Saravanan Hotels' },
                { label: 'Original sale', value: 'Bill #142 · 50 KG · ₹ 23,000' },
                { label: 'Complaint', value: '8 KG spoiled' },
                { label: 'Filed by', value: 'Rep Anand · 11:52 AM' },
              ],
            },
            { kind: 'photos', count: 2, caption: 'Photos from the rep' },
            {
              kind: 'buttons',
              items: [
                { label: 'Confirm all 8 KG spoilt (refund ₹ 3,680)', variant: 'primary' },
                { label: 'Confirm 5 KG (refund ₹ 2,300)', variant: 'outline' },
              ],
            },
            {
              kind: 'note',
              text: 'Fish restored to stock with shortened shelf-life; refund recorded as customer credit.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'tasks',
    number: 19,
    group: 'people',
    title: 'Tasks that close themselves',
    subtitle: 'Assign the work, and it completes from the action that finishes it.',
    tag: 'JAYSHANKAR · TASK DELEGATION',
    steps: [
      {
        id: 'assign-task',
        caption: 'The manager assigns the packing task to Kumar with a deadline.',
        screen: {
          title: 'Assign Task',
          back: true,
          right: 'Admin',
          tab: 'More',
          blocks: [
            { kind: 'select', label: 'Task type', value: 'Pack containers', icon: 'package' },
            { kind: 'select', label: 'Assigned to', value: 'Kumar (floor staff)', icon: 'user' },
            { kind: 'field', label: 'Note', value: 'Pack remaining 50 KG Sela into TC-0042' },
            { kind: 'field', label: 'Deadline', value: 'Today 12:00 PM' },
            { kind: 'buttons', items: [{ label: 'Assign', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'my-tasks',
        caption: 'The task lands on Kumar\'s phone with a Start button.',
        screen: {
          title: 'My Tasks',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            {
              kind: 'alert',
              tone: 'navy',
              icon: 'bell',
              title: 'New task from the manager',
              detail: 'Pack 50 KG Sela into TC-0042 · due Today 12:00',
            },
            { kind: 'buttons', items: [{ label: 'Start', variant: 'primary' }] },
            {
              kind: 'rows',
              items: [
                {
                  label: 'Repack TC-0037 into TC-0044',
                  sub: 'from TC-0037 · started earlier today',
                  value: 'in progress',
                  tone: 'amber',
                  icon: 'container',
                  trailing: 'none',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'mid-task',
        caption: 'Kumar records what he has packed so far, and the app checks him in by itself.',
        screen: {
          title: 'Pack Task',
          back: true,
          right: 'TC-0042',
          tab: 'Home',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Task', value: 'Pack 50 KG Sela into TC-0042' },
                { label: 'Due', value: 'Today 12:00 PM' },
              ],
            },
            { kind: 'progress', label: 'Packed so far', value: 12, max: 50, unit: 'KG' },
            { kind: 'buttons', items: [{ label: 'Record Packed Amount', variant: 'primary' }] },
            { kind: 'note', text: 'Auto-checked-in at 09:42 AM' },
          ],
        },
      },
      {
        id: 'todays-tasks',
        caption: 'The manager sees the task already complete, six minutes ahead of the deadline.',
        screen: {
          title: 'Today\'s Tasks',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            {
              kind: 'stats',
              columns: 2,
              items: [
                { value: '1', label: 'Completed', tone: 'emerald' },
                { value: '1', label: 'In progress', tone: 'amber' },
              ],
            },
            {
              kind: 'rows',
              items: [
                {
                  label: 'Pack 50 KG Sela into TC-0042 · Kumar',
                  sub: 'completed 11:54 AM · 6 min ahead of deadline',
                  tone: 'emerald',
                  icon: 'packageCheck',
                  trailing: 'check',
                },
                {
                  label: 'Repack TC-0037 into TC-0044 · Kumar',
                  sub: 'still in progress',
                  tone: 'amber',
                  icon: 'container',
                  trailing: 'none',
                },
              ],
            },
            { kind: 'note', text: 'Auto-completed from packing action — no separate mark-done needed' },
          ],
        },
      },
    ],
  },
  {
    id: 'team',
    number: 20,
    group: 'people',
    title: 'Adding a team member',
    subtitle: 'Invite by phone or email — the link is yours to share, not auto-sent.',
    tag: 'JAYSHANKAR · TEAM MANAGEMENT',
    steps: [
      {
        id: 'team-management',
        caption: 'The admin opens Team Management and sees who is on the team and in what role.',
        screen: {
          title: 'Team Management',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            { kind: 'buttons', items: [{ label: '+ Invite member', variant: 'primary' }] },
            {
              kind: 'rows',
              items: [
                { label: 'Anand', sub: 'Receiving & sales', icon: 'user' },
                { label: 'Kumar', sub: 'Floor staff', icon: 'user' },
                { label: 'Priya', sub: 'Senior floor staff', icon: 'user' },
              ],
            },
            {
              kind: 'note',
              text: 'The role decides which screens a person sees — one app for everyone, not one app per role.',
            },
          ],
        },
      },
      {
        id: 'invite-form',
        caption: 'He enters Suresh\'s name, role and phone number to send the invite.',
        screen: {
          title: 'Invite Team Member',
          back: true,
          right: 'New',
          tab: 'More',
          blocks: [
            { kind: 'field', label: 'Name', value: 'Suresh' },
            { kind: 'select', label: 'Role', value: 'Floor staff', icon: 'user' },
            { kind: 'select', label: 'Contact via', value: 'Phone', icon: 'phone' },
            { kind: 'field', label: 'Phone number', value: '9876543210' },
            {
              kind: 'note',
              text: 'We never email the invite for you — you\'ll get a link to share yourself (WhatsApp, SMS, in person)',
            },
            { kind: 'buttons', items: [{ label: 'Send Invite', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'invite-link',
        caption: 'The invite link comes back ready to copy and to share by WhatsApp or SMS.',
        screen: {
          title: 'Invite Link Ready',
          back: true,
          right: 'Suresh',
          tab: 'More',
          blocks: [
            {
              kind: 'alert',
              tone: 'navy',
              icon: 'share',
              title: 'Your invite link is ready',
              detail: 'Share it yourself — the app never sends it for you',
            },
            {
              kind: 'fields',
              items: [
                { label: 'Invite for', value: 'Suresh · Floor staff' },
                { label: 'Contact', value: '9876543210' },
                // The token is ours — the sheet shows only the link's own prefix.
                { label: 'Invite link', value: 'jayshankar.app/#/accept-invite?token=6b1f4c9e2a7d43f8ab0c5e17d92b3a64' },
              ],
            },
            {
              kind: 'buttons',
              items: [
                { label: 'Copy link', variant: 'primary' },
                { label: 'Share via WhatsApp', variant: 'outline' },
                { label: 'Share via SMS', variant: 'outline' },
              ],
            },
            { kind: 'note', text: 'The link is the whole invite — Suresh sets his own password when he opens it.' },
          ],
        },
      },
      {
        id: 'first-login',
        caption: 'Suresh sets his own password and lands on the Floor dashboard.',
        screen: {
          title: 'Welcome, Suresh',
          back: true,
          right: 'New account',
          tab: 'Home',
          blocks: [
            { kind: 'tagline', text: 'Set your password to finish joining' },
            { kind: 'field', label: 'New password', value: '••••••••' },
            { kind: 'field', label: 'Confirm password', value: '••••••••' },
            { kind: 'buttons', items: [{ label: 'Create Account', variant: 'primary' }] },
            {
              kind: 'note',
              text: 'After this Suresh lands on the Floor dashboard — the same app, only the screens his role allows.',
            },
          ],
        },
      },
    ],
  },
];
