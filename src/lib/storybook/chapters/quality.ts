// Traceability & vendor quality — chapters 12–13 of the deck.
//
// Both chapters come from the client's own handover note
// (client-qa/session2/UpNote_2026-09-29_14-47-51/q Now I want to create one app for my business.
// How should I connect procurement with receiving team.md), so the IDs and weights are
// transcribed exactly: PR-2026-000125, RCV-000125, BATCH-125, TL-125, LOT-A125 / LOT-B126 /
// LOT-C127, Vendor A 120 kg / Vendor B 180 kg / Vendor C 100 kg, 400 kg assembled, 396.8 kg
// received, and the "created → dispatched → arrived" statuses.
//
// Two figures deliberately come from the deck instead of the note, because the note itself
// leaves them open or prices a placeholder example:
//   - physical weight 148.5 kg / difference -1.5 KG is the deck's own receiving figure
//     (prompt-2.md, Expected 150 KG -> Actual 148.5 KG) for the same 150 kg Seela purchase.
//   - ₹ 420/kg is the deck's Sela rate (₹ 63,000 for 150 KG, and ₹ 62,370 after the 148.5 KG
//     adjustment in prompt-2.md). The note's own example writes "ABC Supplier … ₹450/kg"; the
//     supplier here is Annamalai, the deck's Sela vendor, so the rate follows the deck.
// The 🔒 the note uses for procurement-only fields is rendered by `locked: true`.

import type { Chapter } from '@/lib/storybook/types';

export const QUALITY_CHAPTERS: Chapter[] = [
  {
    id: 'traceability',
    number: 12,
    group: 'quality',
    title: 'One ID from boat to bill',
    subtitle: 'PR → RCV → BATCH → SALE — the Procurement ID is the backbone of the whole transaction.',
    tag: 'JAYSHANKAR · TRACEABILITY',
    steps: [
      {
        id: 'the-chain',
        caption: 'One Procurement ID follows the fish into receiving, the stock batch and the sale.',
        screen: {
          title: 'Traceability',
          back: true,
          right: 'BATCH-125',
          tab: 'Procurement',
          blocks: [
            {
              kind: 'chain',
              items: [
                { label: 'Procurement', value: 'PR-2026-000125', tone: 'navy' },
                { label: 'Receiving', value: 'RCV-000125', tone: 'teal' },
                { label: 'Batch', value: 'BATCH-125', tone: 'indigo' },
                { label: 'Sale', value: 'SALE', tone: 'emerald' },
              ],
            },
            {
              kind: 'note',
              text: 'Where the fish was procured → how much actually arrived → how much went into stock → how much was sold → how much remains.',
            },
          ],
        },
      },
      {
        id: 'procurement-record',
        caption: 'Procurement keeps the supplier and the rate on the entry it dispatches.',
        screen: {
          title: 'Procurement',
          back: true,
          right: 'Created',
          tab: 'Procurement',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Procurement ID', value: 'PR-2026-000125' },
                { label: 'Date & time', value: '15 Sep 2026 · 06:40 AM' },
                // The client's note spells the SKU "Seela"; the app's own stock screens show
                // the same fish as "Sela Fish". The note's spelling is kept here.
                { label: 'Fish SKU', value: 'Seela' },
                { label: 'Expected quantity', value: '150 kg' },
              ],
            },
            {
              kind: 'fields',
              items: [
                { label: 'Supplier', value: 'Annamalai' },
                { label: 'Purchase rate', value: '₹ 420/kg' },
                { label: 'Vehicle number', value: 'TN 65 AB 4412' },
                { label: 'Expected arrival', value: '15 Sep 2026 · 11:30 AM' },
              ],
            },
            {
              kind: 'timeline',
              title: 'Status',
              items: [
                { label: 'Created', time: '06:40 AM' },
                { label: 'Dispatched', time: '07:05 AM' },
                { label: 'Arrived', time: '11:30 AM' },
              ],
              doneThrough: 2,
            },
          ],
        },
      },
      {
        id: 'receiving-record',
        caption: 'The same purchase reaches receiving with the weight box and nothing else it needs.',
        screen: {
          title: 'Receiving #RCV-000125',
          back: true,
          right: '15 Sep',
          tab: 'Procurement',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Receiving ID', value: '#RCV-000125' },
                { label: 'Procurement ID', value: 'PR-2026-000125' },
                { label: 'Fish', value: 'Seela' },
                { label: 'Expected', value: '150 kg' },
              ],
            },
            { kind: 'field', label: 'Physical weight', value: '148.5', suffix: 'KG', big: true },
            { kind: 'note', text: 'Difference -1.5 KG' },
            {
              kind: 'fields',
              items: [
                { label: 'Supplier name', value: 'Hidden from receiving', locked: true },
                { label: 'Purchase price', value: 'Hidden from receiving', locked: true },
                { label: 'Supplier contact', value: 'Hidden from receiving', locked: true },
                { label: 'Profit / margin', value: 'Hidden from receiving', locked: true },
              ],
            },
            { kind: 'note', text: 'Receiving sees only what it needs to physically receive.' },
            { kind: 'buttons', items: [{ label: 'Confirm Receiving', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'truck-load',
        caption: 'The truck load is what gets weighed, and the three vendors stay recorded underneath.',
        screen: {
          title: 'Truck Load TL-125',
          back: true,
          right: '396.8 kg',
          tab: 'Procurement',
          blocks: [
            {
              kind: 'table',
              title: 'Velameen · purchases in this load',
              head: ['Vendor', 'Purchased'],
              rows: [
                { cells: ['Vendor A', '120 kg'] },
                { cells: ['Vendor B', '180 kg'] },
                { cells: ['Vendor C', '100 kg'] },
              ],
              footer: { cells: ['Total', '400 kg'], tone: 'navy' },
            },
            {
              kind: 'fields',
              items: [
                { label: 'Received (physical)', value: '396.8 kg' },
                { label: 'Variance', value: '-3.2 kg (-0.8%)' },
                { label: 'Crates', value: '16 × ~25 kg' },
              ],
            },
            { kind: 'note', text: 'Receiving sees the truck load, never the vendors.' },
            { kind: 'note', text: 'Vendor-wise purchases and rates stay on file for P&L.' },
          ],
        },
      },
    ],
  },
  {
    id: 'quality-issue',
    number: 13,
    group: 'quality',
    title: 'Which vendor sent this?',
    subtitle: 'A quality issue traces back to the vendor lots — and builds the history you negotiate with.',
    tag: 'JAYSHANKAR · QUALITY ISSUE',
    steps: [
      {
        id: 'raise-issue',
        caption: 'The manager raises a quality issue against the batch, with the quantity, photos and date.',
        screen: {
          title: 'Quality Issue',
          back: true,
          right: 'BATCH-125',
          tab: 'More',
          blocks: [
            { kind: 'select', label: 'Select Batch', value: 'BATCH-125 · Velameen', icon: 'layers' },
            { kind: 'select', label: 'Fish SKU', value: 'Velameen', icon: 'fish' },
            { kind: 'select', label: 'Issue Type', value: 'Select issue type', icon: 'alert', placeholder: true },
            { kind: 'field', label: 'Quantity affected', value: '25', suffix: 'kg' },
            { kind: 'photos', count: 2, caption: 'Photos' },
            { kind: 'field', label: 'Date', value: '17 Sep 2026' },
            { kind: 'rows', items: [{ label: 'Vendor traceability', sub: 'TL-125 · 3 vendor lots', trailing: 'chevron' }] },
            { kind: 'buttons', items: [{ label: 'Submit Quality Issue', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'issue-types',
        caption: 'The reason is picked from eight issue types, so every complaint is recorded the same way.',
        screen: {
          title: 'Select Issue Type',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            {
              kind: 'rows',
              items: [
                { label: 'Bad smell', icon: 'thermometer', trailing: 'check' },
                { label: 'Soft flesh', icon: 'waves', trailing: 'none' },
                { label: 'Damaged fish', icon: 'xCircle', trailing: 'none' },
                { label: 'Old stock', icon: 'clock', trailing: 'none' },
                { label: 'Size mismatch', icon: 'scale', trailing: 'none' },
                { label: 'Weight issue', icon: 'gauge', trailing: 'none' },
                { label: 'Ice/water issue', icon: 'snowflake', trailing: 'none' },
                { label: 'Other', icon: 'ellipsis', trailing: 'none' },
              ],
            },
          ],
        },
      },
      {
        id: 'trace-back',
        caption: 'The complaint traces backwards from the customer to the vendor lots behind the batch.',
        screen: {
          title: 'Trace Back',
          back: true,
          right: 'BATCH-125',
          tab: 'More',
          blocks: [
            {
              kind: 'chain',
              items: [
                { label: 'Customer', value: 'Murugan Stores', tone: 'slate' },
                { label: 'Sale', value: 'Bill #98', tone: 'emerald' },
                { label: 'Inventory batch', value: 'BATCH-125 · Velameen', tone: 'indigo' },
                { label: 'Truck load', value: 'TL-125', tone: 'sky' },
                { label: 'Vendor lots', value: 'LOT-A125 · LOT-B126 · LOT-C127', tone: 'purple' },
                { label: 'Vendors', value: '3 vendors', tone: 'amber' },
              ],
            },
            {
              kind: 'note',
              text: 'If the fish from A, B and C was fully mixed, the app can say which vendors contributed to the batch — it cannot truthfully say which crate came from which vendor unless the physical process recorded it.',
            },
          ],
        },
      },
      {
        id: 'scorecard',
        caption: 'Vendor history becomes the scorecard the buyer uses when negotiating.',
        screen: {
          title: 'Vendor Scorecard',
          back: true,
          right: '17 Sep',
          tab: 'Suppliers',
          blocks: [
            {
              kind: 'table',
              title: 'Vendor-wise quality history',
              head: ['Vendor', 'Quality', 'Last purchase'],
              rows: [
                { cells: ['Ramesh Fresh Marine', '94%', '15 Sep 2026'] },
                { cells: ['Ocean Traders', '88%', '15 Sep 2026'] },
                { cells: ['New Star Fisheries', '76%', '15 Sep 2026'], tone: 'amber' },
              ],
            },
            { kind: 'note', text: 'Each vendor\'s material carries a hidden lot ID — procurement-only, never shown on the receiving screen.' },
            {
              kind: 'fields',
              items: [
                { label: 'Ramesh Fresh Marine', value: 'LOT-A125', locked: true },
                { label: 'Ocean Traders', value: 'LOT-B126', locked: true },
                { label: 'New Star Fisheries', value: 'LOT-C127', locked: true },
              ],
            },
            {
              kind: 'note',
              text: 'This is what turns an inventory app into a procurement + receiving + traceability + vendor-performance system.',
            },
          ],
        },
      },
    ],
  },
];
