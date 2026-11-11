// Containers & freshness — chapters 9–11 of the deck.
//
// The container numbers, weights and the ₹ 5,040 spoilage figure are transcribed from the
// client's own visuals (client-qa/developer-prompt-image/prompt-8.md for registration and QR
// tagging, prompt-7.md for spoilage, prompt-12.md for alerts) so the same TC-0042 / 50 KG /
// 12 KG story runs through the spine, money and quality chapters instead of each chapter
// inventing its own boxes.

import type { Chapter } from '@/lib/storybook/types';

export const CONTAINER_CHAPTERS: Chapter[] = [
  {
    id: 'containers-qr',
    number: 9,
    group: 'containers',
    title: 'Containers & QR tags',
    subtitle: 'Every box tracked from packing to empty — by scanning a QR.',
    tag: 'JAYSHANKAR · CONTAINERS & QR',
    steps: [
      {
        id: 'my-containers',
        caption: 'The rep opens My Containers and sees every crate, its size and what is loaded.',
        screen: {
          title: 'My Containers',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            { kind: 'buttons', items: [{ label: 'Register New', variant: 'primary' }] },
            {
              kind: 'rows',
              items: [
                { label: 'TC-0042 · 10 KG', value: 'empty' },
                { label: 'TC-0041 · 10 KG', value: '25 KG loaded' },
                { label: 'TC-0039 · 15 KG', value: '30 KG loaded' },
                { label: 'TC-0038 · 5 KG', value: 'empty' },
                { label: 'TC-0037 · 25 KG', value: '15 KG loaded' },
              ],
            },
          ],
        },
      },
      {
        id: 'register-container',
        caption: 'A new crate is registered with its number, size, ownership and a note.',
        screen: {
          title: 'Register Container',
          back: true,
          right: 'New',
          tab: 'More',
          blocks: [
            { kind: 'field', label: 'Container number', value: 'TC-0050', big: true },
            { kind: 'select', label: 'Capacity', value: '10 KG', icon: 'scale' },
            { kind: 'select', label: 'Ownership', value: 'Owned by us', icon: 'user' },
            { kind: 'field', label: 'Notes', value: 'Used for high-grade Sela' },
            { kind: 'buttons', items: [{ label: 'Generate QR', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'qr-sticker',
        caption: 'The QR sticker is generated from the container number and taken to the crate.',
        screen: {
          title: 'Container TC-0050',
          back: true,
          right: 'Today',
          tab: 'More',
          blocks: [
            { kind: 'qr', value: 'TC-0050' },
            {
              kind: 'fields',
              items: [
                { label: 'Capacity', value: '10 KG' },
                { label: 'Ownership', value: 'Owned' },
                { label: 'Registered', value: 'Today' },
              ],
            },
            {
              kind: 'buttons',
              items: [
                { label: 'Print QR Sticker', variant: 'primary' },
                { label: 'Share QR via WhatsApp', variant: 'outline' },
              ],
            },
          ],
        },
      },
      {
        id: 'scan-result',
        caption: 'Scanning the sticker opens what is inside, when it expires, and the next action.',
        screen: {
          title: 'Scanned TC-0042',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Contents', value: 'Sela A 30 KG · Sela B 20 KG' },
                { label: 'Total', value: '50 KG' },
                { label: 'Expires', value: '17 Sep 02:00' },
              ],
            },
            {
              kind: 'buttons',
              items: [
                { label: 'Sell from this', variant: 'primary' },
                { label: 'Repack', variant: 'outline' },
                { label: 'Log spoilage', variant: 'warning' },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'spoilage',
    number: 10,
    group: 'containers',
    title: 'When fish goes bad',
    subtitle: 'Shelf life runs out — the loss gets recorded, never hidden.',
    tag: 'JAYSHANKAR · SPOILAGE WORKFLOW',
    steps: [
      {
        id: 'expiring',
        caption: 'Containers are listed by expiry, and the one that dies today is flagged red.',
        screen: {
          title: 'Today\'s Containers',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'red', title: 'TC-0042 Sela A/B expires today', detail: '50 KG left · packed 15 Sep' },
            {
              kind: 'rows',
              items: [
                { label: 'TC-0042 · Sela A/B', sub: 'Expires today 02:00', value: '50 KG', tone: 'red' },
                { label: 'TC-0039 · Vanjaram', sub: 'Expires 17 Sep 18:00', value: '30 KG' },
                { label: 'TC-0041 · Parai', sub: 'Expires 18 Sep', value: '25 KG' },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Log Spoilage', variant: 'danger' }] },
          ],
        },
      },
      {
        id: 'log-spoilage',
        caption: 'The rep picks the container, enters how much is unsalvageable and photographs it.',
        screen: {
          title: 'Log Spoilage',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            { kind: 'select', label: 'Container', value: 'TC-0042 · Sela A/B', icon: 'container' },
            { kind: 'field', label: 'How much is unsalvageable?', value: '12', suffix: 'KG', big: true },
            { kind: 'photos', count: 2, caption: 'Photo of spoilt fish (optional)' },
            { kind: 'buttons', items: [{ label: 'Record Spoilage', variant: 'danger' }] },
          ],
        },
      },
      {
        id: 'logged',
        caption: 'The loss is booked with its cost, and the audit log is updated.',
        screen: {
          title: 'Spoilage Logged',
          back: true,
          right: '09:14 AM',
          tab: 'Home',
          blocks: [
            {
              kind: 'result',
              tone: 'red',
              icon: 'thermometer',
              title: 'Spoilage Logged',
              caption: '12 KG removed from stock; audit log updated',
              rows: [
                { label: 'Container', value: 'TC-0042' },
                { label: 'KG lost', value: '12 KG' },
                { label: 'Estimated cost', value: '₹ 5,040' },
              ],
            },
          ],
        },
      },
      {
        id: 'cost-today',
        caption: 'The manager sees the day\'s spoilage cost and every entry behind it.',
        screen: {
          title: 'Today\'s Spoilage Cost',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              kind: 'statCards',
              columns: 1,
              items: [
                { icon: 'trendingDown', tone: 'red', value: '₹ 5,040', label: 'lost today', sub: '2 entries · 20 KG' },
              ],
            },
            {
              kind: 'rows',
              title: 'Recent entries',
              items: [
                { label: '12 KG Sela', sub: 'from TC-0042 · 09:14 AM', icon: 'container' },
                { label: '8 KG Vanjaram', sub: 'from TC-0039 · 08:30 AM', icon: 'container' },
              ],
            },
            { kind: 'note', text: 'Avg spoilage this week: 4.2%' },
          ],
        },
      },
    ],
  },
  {
    id: 'alerts',
    number: 11,
    group: 'containers',
    title: 'Alerts — nothing slips past',
    subtitle: 'Expiry, low stock, deliveries, payments — the app tells you first.',
    tag: 'JAYSHANKAR · ALERTS & NOTIFICATIONS',
    steps: [
      {
        id: 'manager-home',
        caption: 'The manager\'s home opens with three alerts waiting, and the bell holds the rest.',
        screen: {
          title: 'Home',
          back: true,
          right: '🔔 3',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'red', icon: 'timer', title: '2 containers expire today', detail: 'TC-0042 · TC-0039 — soonest 17 Sep 02:00' },
            { kind: 'alert', tone: 'amber', icon: 'trendingDown', title: 'Parai Fish below 30 KG', detail: 'Threshold 30 KG' },
            { kind: 'alert', tone: 'emerald', icon: 'packageCheck', title: 'Vanjaram restocked from Annamalai', detail: 'Now 95 KG in Current Stock' },
          ],
        },
      },
      {
        id: 'expiring-today',
        caption: 'Two containers expire today, and one tap sends their sell-list to the reps.',
        screen: {
          title: 'Expiring Today',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              kind: 'rows',
              items: [
                { label: 'TC-0042 · Sela A/B', sub: '50 KG', value: '17 Sep 02:00', tone: 'red', icon: 'timer' },
                { label: 'TC-0039 · Vanjaram', sub: '30 KG', value: '17 Sep 18:00', tone: 'red', icon: 'timer' },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Send sell-list to reps', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'rep-list',
        caption: 'The rep\'s phone gets the same containers, the soonest expiry first.',
        screen: {
          title: 'Sell List',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'navy', icon: 'megaphone', title: 'Manager sent you 2 containers to prioritise' },
            {
              kind: 'rows',
              items: [
                { label: 'TC-0042 · Sela A/B', sub: '50 KG', value: '17 Sep 02:00', tone: 'red', icon: 'timer' },
                { label: 'TC-0039 · Vanjaram', sub: '30 KG', value: '17 Sep 18:00', icon: 'timer' },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Sell from TC-0042', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'notification-bell',
        caption: 'The bell holds everything else — bills, credit limits, reversals and spoilage.',
        screen: {
          title: 'Notifications',
          back: true,
          right: 'Mark all read',
          tab: 'Home',
          blocks: [
            {
              kind: 'rows',
              title: 'Notifications',
              items: [
                {
                  label: 'Bill Received — Annamalai',
                  sub: 'Sela 150 KG · just now',
                  value: 'New',
                  tone: 'navy',
                  icon: 'receipt',
                  trailing: 'chevron',
                },
                { label: 'Customer over credit limit — Murugan Stores', sub: '2 hr ago', icon: 'creditCard', trailing: 'chevron' },
                { label: 'Sale reversed — Bill #98', sub: '4 hr ago', icon: 'rotateCcw', trailing: 'chevron' },
                { label: 'Spoilage logged — 12 KG Sela', sub: 'yesterday', icon: 'thermometer', trailing: 'chevron' },
              ],
            },
          ],
        },
      },
    ],
  },
];
