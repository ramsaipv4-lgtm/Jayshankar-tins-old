// Part 2 of the procurement desk — chapters 25–28, the sourcing half of the desktop suite.
//
// Transcribed from the client's second reference sheet
// (example-video/WhatsApp Image 2026-09-17 at 8.32.26 PM.jpeg, panels 5–8: Daily Market Price,
// Festival / Market Factors, Supplier Quotation, Purchase Order), cross-read at mobile width in
// example-video/WhatsApp Image 2026-09-17 at 8.35.06 PM.jpeg (its panels 6–8 are the same
// screens). The five fish rates, the four markets, the four festivals, the three quotations and
// the ₹133,000 PO are therefore the deck's own numbers — and the same numbers carry forward into
// chapters 29–32, so the Seer lot bought at ₹640/kg in chapter 27 is the lot received later.
//
// Three readings the JPEG could not settle, resolved so each panel stays self-consistent:
//   · the landed-cost heads are printed as the desktop panel draws them (640 + 35 + 10 + 5 + 5,
//     landed ₹690/kg). The mobile panel's heads (640 + 25 + 10 + 8 + 7) are the set that sums to
//     exactly ₹690, so the sheet carries both; the landed ₹690 and the quoted ₹640/kg are the two
//     figures its arithmetic rests on, and those are kept everywhere below.
//   · the Seer trend chart's plotted points are unreadable at panel size. They are drawn here to
//     end on today's ₹650 with yesterday's ₹640 beside it, exactly as the table prints them.
//   · the sheet says "Ramesh Fish Centre" on the quotation and "Ramesh Fresh Marine" on the PO and
//     on the supplier master; both name the same Rameshwaram supplier at ₹640/kg, so each screen
//     keeps the spelling its own panel uses.

import type { Chapter } from '@/lib/storybook/types';

export const PROCUREMENT_CHAPTERS_2: Chapter[] = [
  {
    id: 'gd-market-price',
    number: 25,
    group: 'procurement',
    title: 'Daily Market Price',
    subtitle: "What every fish costs today, beside yesterday's rate and the week's average.",
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'market-prices',
        caption:
          "The desk opens Market Prices and reads today's rate for each fish against yesterday's and the seven-day average.",
        screen: {
          title: 'Market Prices',
          right: '17 Sep 2026',
          sidebar: 'Market Prices',
          blocks: [
            {
              kind: 'tabs',
              items: ['Rameshwaram (Buy)', 'Chennai (Sell)', 'Coimbatore (Sell)', 'Bangalore (Sell)'],
              active: 0,
            },
            {
              kind: 'table',
              head: ['Fish', 'Today (₹/kg)', 'Yesterday (₹/kg)', '7D Avg (₹/kg)', 'Trend'],
              rows: [
                { cells: ['Seer', '650', '640', '675', '↑'] },
                { cells: ['Lady Fish', '280', '275', '295', '↑'] },
                { cells: ['Prawn', '420', '415', '440', '↑'] },
                { cells: ['Crab', '320', '315', '345', '↑'] },
                { cells: ['Vanjaram', '720', '710', '760', '↑'] },
              ],
            },
            {
              kind: 'chartLine',
              title: 'Seer Fish Price Trend (₹/kg)',
              points: [640, 632, 625, 630, 638, 645, 640, 650],
              labels: ['10 Sep', '11 Sep', '12 Sep', '13 Sep', '14 Sep', '15 Sep', '16 Sep', '17 Sep'],
              highlight: '₹650',
            },
            {
              kind: 'stats',
              columns: 2,
              items: [
                { value: '₹650/kg', label: "Today's Avg. Buy Price", tone: 'emerald' },
                { value: '₹675/kg', label: '7 Day Avg', tone: 'slate' },
              ],
            },
          ],
        },
      },
      {
        id: 'compare-markets',
        caption:
          'The same fish is priced against all four markets, and Rameshwaram comes out the cheapest place to buy.',
        screen: {
          title: 'Compare Markets',
          right: '17 Sep 2026',
          sidebar: 'Market Prices',
          blocks: [
            { kind: 'select', label: 'Fish', value: 'Seer', icon: 'fish' },
            {
              kind: 'table',
              head: ['Market', 'Today (₹/kg)', 'Yesterday (₹/kg)', '7D Avg (₹/kg)', 'Trend'],
              rows: [
                { cells: ['Rameshwaram (Buy)', '650', '640', '675', '↑'], tone: 'emerald' },
                { cells: ['Chennai (Sell)', '665', '660', '680', '↑'] },
                { cells: ['Coimbatore (Sell)', '658', '650', '672', '↑'] },
                { cells: ['Bangalore (Sell)', '672', '665', '690', '↑'] },
              ],
              footer: {
                cells: ['Best buy: Rameshwaram (Buy)', '₹650/kg', '—', '₹675/kg', '↑'],
                tone: 'emerald',
              },
            },
            {
              kind: 'statCards',
              columns: 2,
              items: [
                {
                  icon: 'indianRupee',
                  tone: 'emerald',
                  value: '₹650/kg',
                  label: 'Rameshwaram Buy Price',
                  sub: 'Lowest of the four markets',
                },
                {
                  icon: 'truck',
                  tone: 'sky',
                  value: '₹22/kg',
                  label: 'Cheaper than Bangalore',
                  sub: '₹4,400 saved on a 200 kg lot',
                },
              ],
            },
            { kind: 'buttons', items: [{ label: '+ New Requirement', variant: 'primary' }] },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-festivals',
    number: 26,
    group: 'procurement',
    title: 'Festival & Market Factors',
    subtitle: 'Puratasi, Ganesh Chathurthi, Aadi Amavasai — when demand turns, and how much to stock up.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'festival-factors',
        caption: 'The desk picks Puratasi and the Bangalore market, and reads what the festival does to prices.',
        screen: {
          title: 'Festival & Market Factors',
          right: 'View Calendar',
          sidebar: 'Market Prices',
          blocks: [
            { kind: 'field', label: 'Period', value: '04 Apr 2024 – Mar 2025' },
            { kind: 'select', label: 'Festival', value: 'Puratasi', icon: 'calendar' },
            { kind: 'select', label: 'Market', value: 'Bangalore', icon: 'mapPin' },
            {
              kind: 'table',
              head: ['Festival', 'Date', 'Market Effect', 'Purchase Price', 'Sale Price', 'Est. Demand'],
              rows: [
                { cells: ['Amavasai', '10 May 2024', 'Low', 'Low', 'Low', 'Medium'] },
                { cells: ['Puratasi', '16 Sep – 14 Oct', 'High demand', 'Low', 'Low', 'Medium'], tone: 'emerald' },
                { cells: ['Ganesh Chathurthi', '07 Sep 2026', 'Low', 'Low', 'High', 'Medium'] },
                { cells: ['Aadi Amavasai', '15 Aug 2026', 'Low', 'Low', 'High', 'Medium'] },
              ],
            },
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'calendar',
              title: 'Recommendation (Puratasi)',
              detail: 'Fish: Seer · Recommended Purchase Qty: 300 kg · Expected Margin: ₹180/kg',
            },
            {
              kind: 'alert',
              tone: 'emerald',
              icon: 'trendingUp',
              title: 'Bangalore: Sale Price will be HIGH',
              detail: 'Buy more quantity (200–300 kg) during this period for the Bangalore market.',
            },
          ],
        },
      },
      {
        id: 'market-insights',
        caption: 'The Market Insights view shows the festivals still ahead and what each one does to the buying market.',
        screen: {
          title: 'Market Insights',
          right: 'View Calendar',
          sidebar: 'Market Prices',
          blocks: [
            { kind: 'tabs', items: ['Upcoming Festivals', 'Market Insights'], active: 1 },
            {
              kind: 'table',
              title: 'Impact on Fish Prices · Puratasi, Bangalore',
              head: ['Market', 'Purchase Price', 'Sale Price'],
              rows: [
                { cells: ['Chennai', 'Low', 'Low'] },
                { cells: ['Coimbatore', 'Low', 'Low'] },
                { cells: ['Bangalore', 'Low', 'High'], tone: 'emerald' },
              ],
            },
            {
              kind: 'table',
              title: 'Other Festivals',
              head: ['Festival', 'Date', 'Demand'],
              rows: [
                { cells: ['Ganesh Chathurthi', '07 Sep 2026', 'High'] },
                { cells: ['Aadi Amavasai', '15 Aug 2026', 'Medium'] },
                { cells: ['Amavasai', '15 Sep 2026', 'Low'] },
              ],
            },
            {
              kind: 'note',
              text: 'Purchase price stays low right through Puratasi; only the Bangalore sale price turns high, and that is where the 300 kg of Seer is headed.',
              tone: 'sky',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-quotation',
    number: 27,
    group: 'procurement',
    title: 'Supplier Quotation',
    subtitle: 'Three quotes for the same 200 kg of Seer — compared on what the fish actually costs landed.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'quotations-in',
        caption: 'Three suppliers quote for the 200 kg of Seer, and every quote is shown with its transport and its total cost.',
        screen: {
          title: 'Supplier Quotation',
          right: 'Get Supplier Quoting',
          sidebar: 'Quotations',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Fish', value: 'Seer Fish (2–3 kg)' },
                { label: 'Qty (kg)', value: '200' },
                { label: 'Destination', value: 'Bangalore' },
                { label: 'Quotations', value: '3 received' },
              ],
            },
            {
              kind: 'table',
              head: ['Supplier', 'Price/kg', 'Transport', 'Total Cost', 'Action'],
              rows: [
                { cells: ['Ramesh Fish Centre', '₹640', '₹5,000', '₹133,000', 'Select · Best Price'], tone: 'emerald' },
                { cells: ['Ocean Traders', '₹665', '₹7,000', '₹140,000', 'Select'] },
                { cells: ['New Star Fisheries', '₹655', '₹4,000', '₹137,000', 'Select'] },
              ],
            },
            {
              kind: 'note',
              text: 'Landed Cost Calculation (Best Option) · Ramesh Fish Centre at ₹640/kg.',
              tone: 'teal',
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Purchase Price/kg', value: '₹640' },
                { label: 'Transport/kg', value: '₹35' },
                { label: 'Ice & Packing/kg', value: '₹10' },
                { label: 'Loading/Unloading', value: '₹5' },
                { label: 'Other Costs/kg', value: '₹5' },
                { label: 'Landed Cost/kg', value: '₹690' },
              ],
            },
            { kind: 'buttons', items: [{ label: 'Create Purchase Order', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'quotation-selected',
        caption: 'New Star Fisheries is selected instead, and the landed cost moves from ₹690 to ₹710 a kilo.',
        screen: {
          title: 'Landed Cost · New Star Fisheries',
          right: '17 Sep 2026',
          sidebar: 'Quotations',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Selected supplier', value: 'New Star Fisheries' },
                { label: 'Quoted Price/kg', value: '₹655' },
                { label: 'Transport', value: '₹4,000' },
                { label: 'Quotation Total', value: '₹137,000' },
              ],
            },
            {
              kind: 'note',
              text: 'Landed Cost Calculation (New Star Fisheries) · the same five cost heads on the ₹655/kg quote.',
              tone: 'amber',
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Purchase Price/kg', value: '₹655' },
                { label: 'Transport/kg', value: '₹35' },
                { label: 'Ice & Packing/kg', value: '₹10' },
                { label: 'Loading/Unloading', value: '₹5' },
                { label: 'Other Costs/kg', value: '₹5' },
                { label: 'Landed Cost/kg', value: '₹710' },
              ],
            },
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'trendingUp',
              title: 'Landed cost rises to ₹710/kg',
              detail: '₹20/kg above the best option — ₹4,000 more across the 200 kg lot.',
            },
            {
              kind: 'buttons',
              items: [
                { label: 'Select Ramesh Fish Centre', variant: 'outline' },
                { label: 'Create Purchase Order', variant: 'primary' },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-po',
    number: 28,
    group: 'procurement',
    title: 'Purchase Order',
    subtitle: 'The accepted quote becomes a PO, and that PO then reports its own progress.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'create-po',
        caption: 'Every line of the order is filled in from the accepted quote, and the summary totals ₹133,000.',
        screen: {
          title: 'Create Purchase Order',
          right: 'Create PO',
          sidebar: 'Purchase Orders',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Supplier', value: 'Ramesh Fresh Marine' },
                { label: 'PO Date', value: '17 Sep 2026' },
                { label: 'Expected Arrival', value: '18 Sep 2026' },
                { label: 'Fish', value: 'Seer' },
                { label: 'Qty', value: '200 kg' },
                { label: 'Price', value: '₹640/kg' },
                { label: 'Transport', value: '₹5,000' },
                { label: 'Ice/Packing', value: '₹3,000' },
                { label: 'Payment Terms', value: '15 Days' },
                { label: 'Destination', value: 'Bangalore' },
              ],
            },
            { kind: 'note', text: 'Storage at the Bangalore store: keep at 2–5°C.', tone: 'sky' },
            { kind: 'note', text: 'PO Summary', tone: 'teal' },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'PO Number', value: 'PO-2026-001' },
                { label: 'Total Amount', value: '₹133,000' },
                { label: 'Status', value: 'Pending Approval' },
              ],
            },
          ],
        },
      },
      {
        id: 'po-lifecycle',
        caption:
          'The order is created, approved, sent and confirmed in one morning, and the receiving screen carries only the fish, the weight and the arrival date.',
        screen: {
          title: 'PO #AKS-2026-017',
          right: '18 Sep 2026',
          sidebar: 'Purchase Orders',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Desk reference', value: 'PO-2026-001' },
                { label: 'Supplier', value: 'Ramesh Fresh Marine' },
                { label: 'Total Amount', value: '₹133,000' },
                { label: 'Status', value: 'Confirmed' },
              ],
            },
            {
              kind: 'timeline',
              title: 'PO Lifecycle',
              items: [
                { label: 'Created', time: '16 Sep 2026, 10:00 AM' },
                { label: 'Approved', time: '16 Sep 2026, 11:30 AM' },
                { label: 'Sent to Supplier', time: '16 Sep 2026, 12:00 PM' },
                { label: 'Confirmed', time: '16 Sep 2026, 01:20 PM' },
              ],
            },
            {
              kind: 'note',
              text: 'What the receiving team sees for this PO: the fish, the weight and the arrival date — the supplier and the rate never reach that screen.',
              tone: 'sky',
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Fish', value: 'Seer (2–3 kg)' },
                { label: 'Qty', value: '200 kg' },
                { label: 'Expected Arrival', value: '18 Sep 2026' },
                { label: 'Destination', value: 'Bangalore' },
                { label: 'Supplier name', value: 'Hidden from receiving', locked: true },
                { label: 'Purchase Rate', value: 'Hidden from receiving', locked: true },
                { label: 'Supplier Contact', value: 'Hidden from receiving', locked: true },
                { label: 'Profit / Margin', value: 'Hidden from receiving', locked: true },
              ],
            },
          ],
        },
      },
    ],
  },
];
