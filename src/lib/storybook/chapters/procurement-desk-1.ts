// Procurement desk — part 1 of 3 (chapters 21–24), transcribed from the client's desktop reference
// sheet: example-video/WhatsApp Image 2026-09-17 at 8.32.26 PM.jpeg, panels 1–4.
//
// Every chapter here is `layout: 'desktop'`, so it is drawn inside DesktopFrame with the navy
// sidebar of DESKTOP_NAV. This is the client's proposed back-office suite — none of it exists in
// the app today; docs/BACKEND-REQUIREMENTS-phase-b.md §8 says what each panel would need.

import type { Chapter } from '@/lib/storybook/types';

export const PROCUREMENT_CHAPTERS_1: Chapter[] = [
  {
    id: 'gd-dashboard',
    number: 21,
    group: 'procurement',
    title: 'Procurement Dashboard',
    subtitle: 'What was bought today, what is still coming, and what is already late.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'board',
        caption: 'The desk opens on the day: purchase value so far, vehicles due, and what is short.',
        screen: {
          title: 'Procurement Dashboard',
          right: '17 Sep 2026',
          sidebar: 'Dashboard',
          search: 'Search fish, market, destination…',
          blocks: [
            {
              kind: 'statCards',
              items: [
                { icon: 'shoppingCart', tone: 'sky', value: '1,250 kg', label: "Today's Purchase", sub: '₹ 8,12,500' },
                { icon: 'fileText', tone: 'amber', value: '5', label: 'Pending POs', sub: '2 overdue' },
                { icon: 'fish', tone: 'emerald', value: '2,400 kg', label: 'Fish Required Today' },
                { icon: 'indianRupee', tone: 'purple', value: '₹ 642/kg', label: 'Avg Purchase Price' },
                { icon: 'truck', tone: 'amber', value: '2', label: 'Incoming Vehicles', sub: '6:00 AM & 9:00 PM' },
                { icon: 'alert', tone: 'red', value: '3', label: 'Pending / Short Items', sub: 'Seer 30 kg, Crab 20 kg' },
              ],
            },
            {
              kind: 'table',
              title: "Today's Purchase Overview",
              head: ['Fish', 'Qty (kg)', 'Value (₹)'],
              rows: [
                { cells: ['Seer', '360', '2,37,500'] },
                { cells: ['Lady Fish', '280', '78,400'] },
                { cells: ['Prawn', '150', '1,35,750'] },
                { cells: ['Crab', '120', '1,02,600'] },
                { cells: ['Vanjaram', '720', '2,51,600'] },
              ],
              footer: { cells: ['Total', '1,630', '₹ 8,05,850'] },
            },
            {
              kind: 'chartBars',
              title: 'Purchase Quantity by Fish (kg)',
              items: [
                { label: 'Seer', value: 360, tone: 'navy' },
                { label: 'Lady Fish', value: 280, tone: 'teal' },
                { label: 'Prawn', value: 150, tone: 'amber' },
                { label: 'Crab', value: 120, tone: 'red' },
                { label: 'Vanjaram', value: 720, tone: 'purple' },
              ],
            },
            { kind: 'note', text: 'Supplier payables ₹ 4,85,000 · average purchase price up 3.2% on last week.' },
          ],
        },
      },
      {
        id: 'pending-po',
        caption: 'One of the five pending POs — overdue, with the receiving side still waiting on it.',
        screen: {
          title: 'Pending Purchase Orders',
          sidebar: 'Purchase Orders',
          search: 'Search PO number or supplier…',
          blocks: [
            {
              kind: 'alert',
              tone: 'red',
              title: '2 POs past their expected arrival',
              detail: 'PO-2026-001 Seer 200 kg · PO-2026-004 Crab 100 kg',
            },
            {
              kind: 'table',
              head: ['PO', 'Supplier', 'Qty', 'Expected', 'Status'],
              rows: [
                { cells: ['PO-2026-001', 'Ramesh Fresh Marine', '200 kg', '17 Sep', 'Overdue'], tone: 'red' },
                { cells: ['PO-2026-004', 'Ocean Traders', '100 kg', '17 Sep', 'Overdue'], tone: 'red' },
                { cells: ['PO-2026-002', 'New Star Fisheries', '150 kg', '18 Sep', 'In transit'] },
                { cells: ['PO-2026-003', 'Coastal Fresh', '80 kg', '18 Sep', 'Confirmed'] },
              ],
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Fish', value: 'Seer · 2–3 kg' },
                { label: 'Destination', value: 'Bangalore' },
                { label: 'Supplier', value: 'Ramesh Fresh Marine', locked: true },
                { label: 'Rate', value: '₹ 640/kg', locked: true },
                { label: 'Receiving ID', value: 'RCV-000125' },
                { label: 'Payment terms', value: '15 days', locked: true },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Chase supplier' }, { label: 'View Purchase Order', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-requirements',
    number: 22,
    group: 'procurement',
    title: 'Purchase Requirements',
    subtitle: 'Planning the buys: what is needed, where it has to go, and how urgent it is.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'list',
        caption: 'Every requirement for the week, with the destination market it has to reach.',
        screen: {
          title: 'Purchase Requirements',
          right: 'New Requirement',
          sidebar: 'Purchase Requirements',
          search: 'Search fish, market, destination…',
          blocks: [
            { kind: 'tabs', items: ['All', 'Open', 'In Progress', 'Completed'], active: 0 },
            {
              kind: 'table',
              head: ['Date', 'Fish', 'Qty (kg)', 'Destination', 'Priority', 'Status'],
              rows: [
                { cells: ['17 Sep 2026', 'Seer', '200', 'Bangalore', 'High', 'Open'] },
                { cells: ['17 Sep 2026', 'Lady Fish', '150', 'Chennai', 'Medium', 'Open'] },
                { cells: ['16 Sep 2026', 'Prawn', '300', 'Coimbatore', 'High', 'In Progress'] },
                { cells: ['16 Sep 2026', 'Crab', '100', 'Bangalore', 'Medium', 'Open'] },
                { cells: ['15 Sep 2026', 'Vanjaram', '250', 'Chennai', 'High', 'Completed'] },
              ],
              footer: { cells: ['', 'Total required', '1,000', '', '', ''] },
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Fish', value: 'Seer Fish' },
                { label: 'Size / grade', value: '2–3 kg' },
                { label: 'Required qty', value: '200 kg' },
                { label: 'Required time', value: '6:00 AM' },
                { label: 'Destination', value: 'Bangalore' },
                { label: 'Priority', value: 'High' },
                { label: 'Expected price', value: '₹ 650/kg' },
                { label: 'Status', value: 'Open' },
              ],
            },
          ],
        },
      },
      {
        id: 'new-requirement',
        caption: 'Raising the next one — the target price is what stops it being bought at any cost.',
        screen: {
          title: 'New Purchase Requirement',
          sidebar: 'Purchase Requirements',
          blocks: [
            { kind: 'select', label: 'Fish Type / SKU', value: 'Seer Fish · 2–3 kg', icon: 'fish' },
            { kind: 'field', label: 'Required Quantity', value: '300', suffix: 'KG', big: true },
            { kind: 'select', label: 'Destination Market', value: 'Bangalore', icon: 'mapPin' },
            { kind: 'select', label: 'Priority', value: 'High', icon: 'alert' },
            { kind: 'field', label: 'Target Purchase Price', value: '₹ 650 / kg' },
            { kind: 'field', label: 'Required By', value: '18 Sep 2026 · 6:00 AM' },
            { kind: 'note', text: 'For Puratasi the sheet recommends 300 kg, with the margin priced at about ₹180/kg.' },
            { kind: 'buttons', items: [{ label: 'Send to Procurement' }, { label: 'Save as Draft', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-fish-master',
    number: 23,
    group: 'procurement',
    title: 'Fish Master',
    subtitle: 'Every species the business trades, with the size and price it is bought at.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'list',
        caption: 'The product list the whole desk works from — Tamil names included, because that is what is spoken.',
        screen: {
          title: 'Fish Master / Product List',
          right: 'Add Fish',
          sidebar: 'Dashboard',
          search: 'Search fish…',
          blocks: [
            { kind: 'tabs', items: ['All', 'Marine', 'Freshwater'], active: 0 },
            {
              kind: 'table',
              head: ['Fish Name', 'Cat.', 'Size', 'Unit', 'Avg Price'],
              rows: [
                { cells: ['Seer (Seagaram)', 'Marine', '2–3 kg', 'kg', '₹ 642'] },
                { cells: ['Lady Fish (Golaabhi)', 'Marine', '1–2 kg', 'kg', '₹ 318'] },
                { cells: ['Prawn (Iral)', 'Marine', '40–50', 'kg', '₹ 580'] },
                { cells: ['Crab (Nandu)', 'Marine', 'Medium', 'kg', '₹ 450'] },
                { cells: ['Vanjaram (Surumi)', 'Marine', '2–4 kg', 'kg', '₹ 670'] },
                { cells: ['Emperor (Karuvadu)', 'Marine', '1–3 kg', 'kg', '₹ 615'] },
              ],
              footer: { cells: ['6 species', '', '', 'Average', '₹ 546'] },
            },
            { kind: 'note', text: 'Sizes here are the size bands the desk buys in — the same fish at a different size is a different buying decision.' },
          ],
        },
      },
      {
        id: 'add-fish',
        caption: 'Adding a species — and, if the client answers the grading question, the grades it is sold in.',
        screen: {
          title: 'Add Fish',
          sidebar: 'Dashboard',
          blocks: [
            { kind: 'field', label: 'English Name', value: 'Seer Fish' },
            { kind: 'field', label: 'Tamil Name', value: 'Seagaram' },
            { kind: 'select', label: 'Category', value: 'Marine', icon: 'fish' },
            { kind: 'select', label: 'Default Size Band', value: '2–3 kg', icon: 'scale' },
            { kind: 'select', label: 'Unit', value: 'kg', icon: 'package' },
            { kind: 'field', label: 'Shelf Life', value: '36', suffix: 'hours' },
            { kind: 'gradeRows', items: [{ label: 'Grade A · Large', value: 80 }, { label: 'Grade B · Medium', value: 50 }, { label: 'Grade C · Small', value: 15 }], total: '145' },
            { kind: 'buttons', items: [{ label: 'Save Fish' }, { label: 'Cancel', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-suppliers',
    number: 24,
    group: 'procurement',
    title: 'Supplier Management',
    subtitle: 'Who supplies what, on what terms — and how they have actually performed.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'list',
        caption: 'The supplier book: each one with a rating, what they supply, and when they last delivered.',
        screen: {
          title: 'Suppliers',
          right: 'Add Supplier',
          sidebar: 'Suppliers',
          search: 'Search supplier…',
          blocks: [
            { kind: 'tabs', items: ['All', 'Active', 'Inactive'], active: 1 },
            {
              kind: 'rows',
              items: [
                { label: 'Ramesh Fresh Marine', sub: 'Ramanathapuram · +91 98400 12345 · Seer, Lady, Prawn · last 16 Sep 2026', value: '★ 4.5' },
                { label: 'Ocean Traders', sub: 'Mandapam · +91 97876 54321 · Crab, Prawn, Vanjaram · last 14 Sep 2026', value: '★ 4.2' },
                { label: 'New Star Fisheries', sub: 'Ramanathapuram · +91 96298 76543 · All marine fish · last 12 Sep 2026', value: '★ 4.0' },
                { label: 'Coastal Fresh', sub: 'Chennai · +91 90031 23456 · Seer, Emperor · last 10 Sep 2026', value: '★ 3.8' },
              ],
            },
            { kind: 'note', text: 'Tapping a supplier opens the record below — the star rating is the rolled-up quality history, not an opinion.' },
          ],
        },
      },
      {
        id: 'supplier-record',
        caption: 'One supplier in full: the terms we buy on, and the quality history we negotiate with.',
        screen: {
          title: 'Ramesh Fresh Marine · Supplier Details',
          sidebar: 'Suppliers',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Location', value: 'Ramanathapuram' },
                { label: 'Credit terms', value: '15 days' },
                { label: 'Payment status', value: '₹ 46,500 outstanding' },
                { label: 'Quality rating', value: '★ 4.5' },
                { label: 'Last purchase', value: '16 Sep 2026' },
                { label: 'Total purchases', value: '₹ 12,40,000' },
                { label: 'On-time delivery', value: '92%' },
                { label: 'Rejection rate', value: '2.1%' },
              ],
            },
            {
              kind: 'chartLine',
              title: 'Seer Fish bought from this supplier (₹/kg)',
              points: [612, 620, 618, 630, 636, 640],
              labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
              highlight: '₹ 640',
            },
            { kind: 'alert', tone: 'amber', title: 'Price has risen 4.6% since April', detail: 'Worth comparing with Ocean Traders before the next Seer buy.' },
            { kind: 'buttons', items: [{ label: 'Compare quotations', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
];

