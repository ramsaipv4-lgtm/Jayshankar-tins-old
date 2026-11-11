// Money — chapters 14–17 of the deck.
//
// The figures are the client's own, transcribed from their prompt sheets so that one day of the
// business reads the same in every chapter: prompt-6.md (Customers, Take Payment, Today's Profit,
// Audit Log), prompt-9.md (the reversal half), prompt-4.md for the sale itself (Saravanan Hotels ·
// 50 KG Sela Fish · ₹ 460 / kg · ₹ 23,000) and prompt-2.md for the purchase side (Annamalai,
// 150 KG promised against 148.5 KG measured — the money difference is never corrected by itself,
// per SPEC D54, which is why chapter 16 shows it waiting for a person).
//
// Three kinds of detail are NOT in any client sheet, and are commented where they appear:
//   - bill numbers #137 and #139 (the deck only ever names #142 and #98);
//   - Kumar Mess's ₹ 10,000 credit limit (chosen so the deck's own ₹ 8,500 reads as "close");
//   - every clock time.
// Each was picked to agree with the numbers the deck does give, never to contradict them.

import type { Chapter } from '@/lib/storybook/types';

export const MONEY_CHAPTERS: Chapter[] = [
  {
    id: 'customers-payments',
    number: 14,
    group: 'money',
    title: 'Customers & payments',
    subtitle: 'Who owes what, and one tap to record what came in.',
    tag: 'JAYSHANKAR · MONEY & REPORTS',
    steps: [
      {
        id: 'customers-list',
        caption: 'The rep opens Customers and sees who still owes money and who is settled.',
        screen: {
          title: 'Customers',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            {
              // ₹ 22,700 is nowhere in the sources: it is the two owing rows below added up
              // (14,200 + 8,500), so the strip and the list can never disagree.
              kind: 'stats',
              columns: 2,
              items: [
                { value: '₹ 22,700', label: 'Outstanding today' },
                { value: '2', label: 'Customers owing', tone: 'amber' },
              ],
            },
            {
              kind: 'rows',
              items: [
                { label: 'Saravanan Hotels', sub: 'Regular · 12 orders', value: '₹ 0', tone: 'emerald', icon: 'store' },
                { label: 'Murugan Stores', sub: 'Bill #137 · 12 days old', value: '₹ 14,200', tone: 'red', icon: 'store' },
                { label: 'Kumar Mess', sub: 'Bill #139 · 9 days old', value: '₹ 8,500', tone: 'red', icon: 'store' },
              ],
            },
            { kind: 'note', text: 'Tap to record payment' },
          ],
        },
      },
      {
        id: 'take-payment',
        caption: 'He taps Murugan Stores and enters the ₹ 14,200 that came in by UPI.',
        screen: {
          title: 'Take Payment',
          back: true,
          right: 'Murugan Stores',
          tab: 'More',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Due', value: '₹ 14,200' },
                { label: 'Oldest unpaid bill', value: '#137 · 12 days' },
              ],
            },
            { kind: 'field', label: 'Amount received', value: '14,200', suffix: '₹', big: true },
            { kind: 'select', label: 'Method', value: 'UPI', icon: 'wallet' },
            { kind: 'note', text: 'A payment is applied to the oldest unpaid bill first.' },
            { kind: 'buttons', items: [{ label: 'Record Payment', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'payment-recorded',
        caption: 'The payment is saved and the balance drops from ₹ 14,200 to zero.',
        screen: {
          title: 'Payment Recorded',
          back: true,
          right: 'Today 11:20 AM',
          tab: 'More',
          blocks: [
            {
              kind: 'result',
              tone: 'emerald',
              icon: 'checkCircle',
              title: '₹ 14,200 received',
              caption: 'Murugan Stores · UPI · today',
              rows: [
                { label: 'Balance before', value: '₹ 14,200' },
                { label: 'Received now', value: '₹ 14,200' },
                { label: 'Balance due', value: '₹ 0' },
              ],
            },
            { kind: 'note', text: 'The customer list, the bill and the audit log all move together.' },
          ],
        },
      },
      {
        id: 'credit-limit',
        caption: 'The same customer record shows the credit limit and how much of it is already used.',
        screen: {
          title: 'Kumar Mess',
          back: true,
          right: 'Credit',
          tab: 'More',
          blocks: [
            // ₹ 10,000 is this file's own limit, set so the deck's ₹ 8,500 lands at 85% used.
            // The soft-flag wording is the client's own rule: flag, never refuse service (D33).
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'creditCard',
              title: '₹ 8,500 of a ₹ 10,000 credit limit used',
              detail: '85% used · flag for the rep, not a block on selling',
            },
            {
              kind: 'fields',
              items: [
                { label: 'Credit limit', value: '₹ 10,000' },
                { label: 'Used', value: '₹ 8,500' },
                { label: 'Available', value: '₹ 1,500' },
                { label: 'Credit period', value: '15 days' },
                { label: 'Oldest unpaid bill', value: '#139 · 9 days' },
              ],
            },
            {
              kind: 'rows',
              items: [
                { label: 'Murugan Stores', sub: 'cleared today', value: '₹ 0', tone: 'emerald', trailing: 'none' },
                { label: 'Saravanan Hotels', sub: 'settled on dispatch', value: '₹ 0', tone: 'emerald', trailing: 'none' },
              ],
            },
            {
              kind: 'note',
              text: 'Over-limit customers are flagged, never refused — the relationship matters more than the rule.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'profit-audit',
    number: 15,
    group: 'money',
    title: 'Profit & the audit trail',
    subtitle: 'What was bought, what was sold, what was made — and every change behind it.',
    tag: 'JAYSHANKAR · PROFIT & AUDIT',
    steps: [
      {
        id: 'today-profit',
        caption: 'The manager opens Today\'s Profit and sees what was bought, sold and made.',
        screen: {
          title: 'Today\'s Profit',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              // Bought 63,000 and Sold 87,500 are the deck's own day figures; Profit 24,500 is the
              // difference, and 24,500 / 87,500 is the 28% margin the audit screen prints below.
              kind: 'stats',
              columns: 3,
              items: [
                { value: '₹ 63,000', label: 'Bought' },
                { value: '₹ 87,500', label: 'Sold' },
                { value: '₹ 24,500', label: 'Profit', tone: 'emerald' },
              ],
            },
            {
              kind: 'fields',
              items: [
                { label: 'Spoilage cost today', value: '₹ 5,040' },
                { label: 'Payments received', value: '₹ 14,200' },
              ],
            },
            { kind: 'note', text: 'Margin 28%' },
          ],
        },
      },
      {
        id: 'margin-by-fish',
        caption: 'The margin is split fish by fish, so he can see which fish actually made the money.',
        screen: {
          title: 'Margin by Fish',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            {
              // The deck gives only the day's total margin. This split is ours, and it adds up to
              // exactly ₹ 24,500 so the donut centre and the profit row above never disagree.
              kind: 'chartDonut',
              title: 'Margin by fish today',
              center: '₹ 24,500',
              centerSub: 'Profit today',
              items: [
                { label: 'Vanjaram', value: 9500, tone: 'teal' },
                { label: 'Sela Fish', value: 6200, tone: 'navy' },
                { label: 'Velameen', value: 4800, tone: 'sky' },
                { label: 'Parai', value: 4000, tone: 'purple' },
              ],
            },
            {
              kind: 'note',
              text: 'Sale rate minus the rate that fish was bought at — the same ₹ 24,500 the profit screen shows.',
            },
          ],
        },
      },
      {
        id: 'audit-log',
        caption: 'Every change lands in the audit log with a time and no way to edit it.',
        screen: {
          title: 'Audit Log',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            { kind: 'tabs', items: ['Today', 'This week', 'By user', 'By table'], active: 0 },
            // Newest first, the way every feed in the app reads. The deck prints these same three
            // entries in the opposite order, oldest first; the wording is verbatim either way.
            {
              kind: 'rows',
              items: [
                { label: 'Payment ₹ 14,200 recorded', sub: 'Today 11:20 AM', icon: 'wallet' },
                { label: 'Bill #142 saved', sub: 'Today 09:12 AM', icon: 'receipt' },
                { label: 'Sale #98 dispatched', sub: 'Today 08:40 AM', icon: 'truck' },
              ],
            },
            { kind: 'note', text: 'Every change tracked, no edits possible' },
            { kind: 'note', text: 'A correction is made by a new entry, never by changing an old one.' },
          ],
        },
      },
      {
        id: 'day-close',
        caption: 'The day closes with the same figures the rep and the manager have seen all day.',
        screen: {
          title: 'Day Close',
          back: true,
          right: '17 Sep',
          tab: 'Home',
          blocks: [
            {
              kind: 'result',
              tone: 'emerald',
              icon: 'checkCircle',
              title: 'Day closed · ₹ 24,500 profit',
              caption: '₹ 63,000 bought · ₹ 87,500 sold · 28% margin',
              rows: [
                { label: 'Payments received', value: '₹ 14,200' },
                { label: 'Spoilage cost', value: '₹ 5,040' },
                { label: 'Bills settled', value: '#142 · #137' },
                { label: 'Still unpaid', value: '₹ 8,500' },
              ],
            },
            {
              kind: 'stats',
              columns: 3,
              items: [
                { value: '₹ 63,000', label: 'Bought' },
                { value: '₹ 87,500', label: 'Sold' },
                { value: '₹ 24,500', label: 'Profit', tone: 'emerald' },
              ],
            },
            {
              kind: 'note',
              text: 'Nothing is typed twice — the same entries feed Reports, Profit and the Audit Log.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'bills-credit',
    number: 16,
    group: 'money',
    title: 'Bills, terms & reconciliation',
    subtitle: 'Every bill carries its terms, and gets checked against the money that settled it.',
    tag: 'JAYSHANKAR · BILLS & CREDIT',
    steps: [
      {
        id: 'bill-list',
        caption: 'Bills are listed with their customer, amount, paid or unpaid, and how old they are.',
        screen: {
          title: 'Bills',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            {
              // #142 and #98 are the deck's own bill numbers. #137 and #139 are ours: Murugan Stores
              // and Kumar Mess need a bill behind the ₹ 14,200 and ₹ 8,500 the deck prints.
              kind: 'table',
              title: 'Bills',
              head: ['Bill', 'Customer', 'Amount', 'Status'],
              rows: [
                { cells: ['#142', 'Saravanan Hotels', '₹ 23,000', 'Paid · today'], tone: 'emerald' },
                { cells: ['#137', 'Murugan Stores', '₹ 14,200', 'Paid · 12 days'], tone: 'emerald' },
                { cells: ['#139', 'Kumar Mess', '₹ 8,500', 'Unpaid · 9 days'], tone: 'amber' },
              ],
              footer: { cells: ['Unpaid', '1 bill', '₹ 8,500', '9 days'], tone: 'amber' },
            },
            { kind: 'note', text: 'Age counts from dispatch — the credit period runs on the same clock.' },
          ],
        },
      },
      {
        id: 'bill-detail',
        caption: 'Opening Bill #142 shows its line items and the terms recorded against it.',
        screen: {
          title: 'Bill #142',
          back: true,
          right: 'Paid',
          tab: 'More',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Customer', value: 'Saravanan Hotels' },
                { label: 'Dispatched', value: 'Today 09:30 AM' },
                { label: 'Payment terms', value: 'Cash on dispatch' },
                { label: 'Balance', value: '₹ 0' },
              ],
            },
            {
              kind: 'table',
              title: 'Line items',
              head: ['Item', 'Qty', 'Rate', 'Amount'],
              rows: [{ cells: ['Sela Fish', '50 KG', '₹ 460 / kg', '₹ 23,000'] }],
              footer: { cells: ['Total', '', '', '₹ 23,000'], tone: 'emerald' },
            },
            { kind: 'buttons', items: [{ label: 'Share Bill via WhatsApp', variant: 'outline' }] },
            {
              kind: 'note',
              text: 'Terms are set with the bill itself — cash here, or credit with its own limit and period.',
            },
          ],
        },
      },
      {
        id: 'reconcile',
        caption: 'The bill is checked against the sale and the payment that settled it, difference and all.',
        screen: {
          title: 'Reconcile Bills',
          back: true,
          right: '17 Sep',
          tab: 'More',
          blocks: [
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'alert',
              title: '1 purchase bill needs a decision',
              detail: 'Annamalai · 150 KG promised, 148.5 KG measured at arrival',
            },
            {
              kind: 'table',
              title: 'Bill against sale and payment',
              head: ['Bill', 'Sale', 'Payment', 'Difference'],
              rows: [
                { cells: ['#142', '₹ 23,000', 'Cash ₹ 23,000', '₹ 0'], tone: 'emerald' },
                { cells: ['#137', '₹ 14,200', 'UPI ₹ 14,200', '₹ 0'], tone: 'emerald' },
              ],
              footer: { cells: ['Annamalai', '₹ 63,000', '148.5 KG measured', '− ₹ 630'], tone: 'amber' },
            },
            { kind: 'note', text: 'Both customer bills settle to zero — nothing is outstanding against either one.' },
            {
              kind: 'note',
              text: 'The ₹ 630 is never auto-corrected: the measured weight fixes stock, and a person settles the money.',
            },
          ],
        },
      },
      {
        id: 'settled-or-carried',
        caption: 'The bill is confirmed settled, and the one still unpaid is carried forward.',
        screen: {
          title: 'Bill Settled',
          back: true,
          right: 'Settled',
          tab: 'More',
          blocks: [
            {
              kind: 'result',
              tone: 'emerald',
              icon: 'checkCircle',
              title: 'Bill #142 settled',
              caption: '₹ 23,000 sold, ₹ 23,000 received — nothing left against it.',
              rows: [
                { label: 'Saravanan Hotels', value: '₹ 0 owing' },
                { label: 'Settled by', value: 'Cash received on dispatch' },
                { label: 'Age at settlement', value: 'Same day' },
              ],
            },
            {
              kind: 'rows',
              items: [
                {
                  label: 'Carried forward · Kumar Mess #139',
                  sub: '9 days old · credit period 15 days',
                  value: '₹ 8,500',
                  tone: 'amber',
                  icon: 'fileText',
                  trailing: 'none',
                },
              ],
            },
            {
              kind: 'note',
              text: 'Whatever is not settled stays on the customer\'s balance, with its age, until it is.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'reversals',
    number: 17,
    group: 'money',
    title: 'Reversing a sale',
    subtitle: 'A sale can be undone — but only through a request the admin approves.',
    tag: 'JAYSHANKAR · RETURNS & COMPLAINTS',
    steps: [
      {
        id: 'recent-sales',
        caption: 'The rep opens Recent Sales and the newest sale is sitting on top.',
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
                {
                  label: 'Kumar Mess · Bill #139',
                  sub: 'dispatched 8 Sep · still unpaid',
                  value: '₹ 8,500',
                  icon: 'fish',
                },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Request Reversal', variant: 'primary' }] },
            { kind: 'note', text: 'A reversal always starts from the sale — the stock is never edited by hand.' },
          ],
        },
      },
      {
        id: 'request-reversal',
        caption: 'He picks Bill #142, writes the reason and sends the request.',
        screen: {
          title: 'Request Reversal',
          back: true,
          right: 'Bill #142',
          tab: 'Home',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Customer', value: 'Saravanan Hotels' },
                { label: 'Sale', value: 'Bill #142 · 50 KG Sela Fish' },
                { label: 'Amount', value: '₹ 23,000' },
              ],
            },
            { kind: 'select', label: 'Reason', value: 'Customer refused — spoilage', icon: 'rotateCcw' },
            { kind: 'field', label: 'Notes', value: 'Fish arrived warm — 8 KG visibly spoiled' },
            { kind: 'buttons', items: [{ label: 'Send for Approval', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'waiting-on-admin',
        caption: 'The request waits on the admin\'s approval, and nothing moves until it comes.',
        screen: {
          title: 'Reversal Request',
          back: true,
          right: 'Awaiting admin',
          tab: 'More',
          blocks: [
            {
              kind: 'fields',
              items: [
                { label: 'Sale', value: 'Bill #142 · Saravanan Hotels' },
                { label: 'Requested by', value: 'Anand · Receiving & sales' },
                { label: 'Reason', value: 'Customer refused — spoilage' },
                { label: 'Amount', value: '₹ 23,000' },
              ],
            },
            {
              kind: 'timeline',
              title: 'Approval',
              items: [
                { label: 'Created by Anand', time: 'Today 11:40 AM' },
                { label: 'Sent to admin', time: 'Today 11:41 AM' },
                { label: 'Approved by admin', time: 'Waiting for the admin' },
                { label: 'Stock restored', time: 'Runs on approval' },
              ],
              doneThrough: 2,
            },
            { kind: 'note', text: 'Nothing has moved yet — the stock and the bill change only after approval.' },
            { kind: 'buttons', items: [{ label: 'Approve Reversal', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'reversed',
        caption: 'The stock goes back to the container and the bill comes off the customer.',
        screen: {
          title: 'Sale Reversed',
          back: true,
          right: 'Today 11:58 AM',
          tab: 'Home',
          blocks: [
            {
              kind: 'result',
              tone: 'emerald',
              icon: 'rotateCcw',
              title: 'Bill #142 reversed',
              caption: 'Approved at 11:58 AM — the ₹ 23,000 already collected stands as customer credit.',
              rows: [
                { label: 'Stock restored', value: '50 KG Sela → TC-0042' },
                { label: 'Amount reversed', value: '₹ 23,000' },
                { label: 'Customer balance', value: '₹ 0 owing' },
              ],
            },
            { kind: 'note', text: 'A rep cannot reverse their own sale without approval.' },
            {
              kind: 'note',
              text: 'The original sale is never edited or deleted — the reversal adds new entries beside it.',
            },
          ],
        },
      },
    ],
  },
];
