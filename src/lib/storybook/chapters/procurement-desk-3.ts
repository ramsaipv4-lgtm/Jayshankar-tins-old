// Procurement desk, part 3 — chapters 29–32: the last four panels of the client's desktop suite
// (example-video/WhatsApp Image 2026-09-17 at 8.32.26 PM.jpeg, panels 9–12: Goods Receiving,
// Purchase Cost Calculation, Procurement Analytics, Alerts & Notifications). The same suite at
// phone width (…8.35.06 PM.jpeg, panels 9–10) is used only to read the small print.
// The figures are the client's own: GRN-2026-023, PO AKS-2026-017, vehicle TN-09 AB 1234,
// ordered/received/accepted/rejected 200/200/195/5, the six cost heads and ₹710/kg landed cost,
// 8,450 kg, ₹5,42,000 and the 18.5% gross margin. The handover rule from
// client-qa/session2/…connect procurement with receiving team.md ("stock moves only after
// receiving confirms") is the story of chapter 29's second step.
import type { Chapter } from '@/lib/storybook/types';

export const PROCUREMENT_CHAPTERS_3: Chapter[] = [
  {
    id: 'gd-receiving',
    number: 29,
    group: 'procurement',
    title: 'Goods Receiving',
    subtitle: 'The vehicle arrives against a PO — and only the accepted weight becomes stock.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'grn-entry',
        caption: 'The clerk opens the GRN against PO AKS-2026-017 and records what the vehicle actually delivered.',
        screen: {
          title: 'Receiving',
          right: '17 Sep 2026',
          sidebar: 'Receiving',
          blocks: [
            {
              kind: 'alert',
              tone: 'emerald',
              icon: 'checkCircle',
              title: 'PO # AKS-2026-017 · Confirmed',
              detail: 'Ramesh Fresh Marine · Seer (2–3 kg) · 200 kg @ ₹640/kg',
            },
            {
              // The client's own desktop receiving panel prints supplier and rate beside the GRN,
              // so nothing is locked here; the hidden-field rule belongs to the phone screen the
              // receiving role works on, which is another chapter of this deck.
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'GRN #', value: 'GRN-2026-023' },
                { label: 'PO #', value: 'AKS-2026-017' },
                { label: 'PO date', value: '16 Sep 2026' },
                { label: 'Supplier', value: 'Ramesh Fresh Marine' },
                { label: 'Received', value: '17 Sep 2026, 6:30 AM' },
                { label: 'Fish', value: 'Seer (2–3 kg)' },
                { label: 'Quantity', value: '200 kg' },
                { label: 'Rate', value: '₹640/kg' },
              ],
            },
            {
              kind: 'rows',
              items: [{ label: 'Vehicle No.', value: 'TN-09 AB 1234', icon: 'truck' }],
            },
            {
              // One PO line, one lot: the four weights the receiving clerk can act on.
              kind: 'table',
              head: ['Fish', 'Ordered (kg)', 'Received (kg)', 'Accepted (kg)', 'Rejected (kg)'],
              rows: [{ cells: ['Seer', '200', '200', '195', '5'] }],
              footer: { cells: ['Total', '200', '200', '195', '5'], tone: 'emerald' },
            },
            { kind: 'select', label: 'Grade', value: 'A', icon: 'award' },
            { kind: 'field', label: 'Temperature', value: '1°C' },
            { kind: 'photos', count: 4, caption: 'Gill, eye and ice — four photos sit on the GRN.' },
            { kind: 'field', label: 'Notes', value: 'Good quality, little size variation.' },
            { kind: 'buttons', items: [{ label: 'Receive', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'after-grn',
        caption: 'Saving the GRN puts the accepted 195 kg into stock and books the rejected 5 kg against the vendor.',
        screen: {
          title: 'After Receiving',
          right: '17 Sep 2026',
          sidebar: 'Receiving',
          blocks: [
            {
              kind: 'result',
              tone: 'emerald',
              icon: 'packageCheck',
              title: 'GRN-2026-023 saved',
              caption: 'Accepted weight is stock now; the rejected weight stays on the vendor’s account.',
              rows: [
                { label: 'Stock added (Seer 2–3 kg)', value: '195 kg' },
                { label: 'Rejected to Ramesh Fresh Marine', value: '5 kg' },
              ],
            },
            {
              kind: 'chain',
              items: [
                { label: 'PO', value: 'AKS-2026-017' },
                { label: 'GRN', value: 'GRN-2026-023', tone: 'emerald' },
                { label: 'BATCH', value: '195 kg Seer', tone: 'teal' },
              ],
            },
            {
              kind: 'stats',
              columns: 2,
              items: [
                { value: '195 kg', label: 'Stock added', sub: 'Seer (2–3 kg)', tone: 'emerald' },
                { value: '5 kg', label: 'Rejected · vendor account', sub: '2.5% of the received weight', tone: 'red' },
              ],
            },
            {
              kind: 'rows',
              items: [
                { label: 'Ramesh Fresh Marine', sub: 'Quality score after today’s lot', value: '4.5 ★', tone: 'amber' },
              ],
            },
            {
              kind: 'note',
              text: 'Only the accepted physical weight enters inventory — 195 kg, never the 200 kg ordered.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-costing',
    number: 30,
    group: 'procurement',
    title: 'Purchase Cost Calculation',
    subtitle: '₹640 a kilo is the price; ₹710 is what that kilo costs once it is in the warehouse.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'cost-breakdown',
        caption: 'Transport, ice, packing and loading are added to the purchase price so the clerk sees the real cost per kilo.',
        screen: {
          title: 'Cost Breakdown',
          right: '17 Sep 2026',
          sidebar: 'Receiving',
          blocks: [
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Fish', value: 'Seer (2–3 kg)' },
                { label: 'Qty', value: '200 kg' },
              ],
            },
            {
              // The six heads and the ₹710 total are exactly as the client's sheet draws them:
              // 640 + 35 + 15 + 10 + 5 + 5 = 710.
              kind: 'table',
              head: ['Cost Component', 'Cost (₹/kg)'],
              rows: [
                { cells: ['Purchase Price', '640'] },
                { cells: ['Transport', '35'] },
                { cells: ['Ice', '15'] },
                { cells: ['Packing', '10'] },
                { cells: ['Loading/Unloading', '5'] },
                { cells: ['Other Costs', '5'] },
              ],
              footer: { cells: ['Total Landed Cost/kg', '710'], tone: 'emerald' },
            },
            {
              kind: 'note',
              tone: 'navy',
              text: 'This is the real cost to bring the fish to your warehouse.',
            },
          ],
        },
      },
      {
        id: 'cost-to-margin',
        caption: 'The same kilo is carried through to the sale, where it has to clear ₹710 before any margin is left.',
        screen: {
          title: 'From Cost to Margin',
          right: '17 Sep 2026',
          sidebar: 'Receiving',
          blocks: [
            {
              // Today's Seer selling rate is the Rameshwaram figure the market-price panel prints,
              // so the margin here is the client's own sale price against the client's own landed cost.
              kind: 'chartBars',
              title: 'Landed Cost vs Sale Price (₹/kg)',
              items: [
                { label: 'Landed Cost', value: 710, tone: 'navy' },
                { label: 'Sale Price Today', value: 780, tone: 'emerald' },
                { label: 'Margin', value: 70, tone: 'teal' },
              ],
            },
            {
              kind: 'fields',
              columns: 2,
              items: [
                { label: 'Landed cost', value: '₹710/kg' },
                { label: 'Sale price today', value: '₹780/kg' },
                { label: 'Margin per kg', value: '₹70/kg' },
                { label: 'Margin on the 200 kg lot', value: '₹14,000' },
              ],
            },
            {
              kind: 'note',
              text: 'Anything sold below ₹710/kg loses money — the landed cost, not the purchase price, sets the selling rate.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-analytics',
    number: 31,
    group: 'procurement',
    title: 'Procurement Analytics',
    subtitle: 'One board for what was bought, from whom, at what price, and what is left as margin.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'overview',
        caption: 'The desk opens one dashboard for what was bought, from whom, and at what price.',
        screen: {
          title: 'Procurement Analytics',
          right: 'Export',
          sidebar: 'Analytics',
          blocks: [
            { kind: 'tabs', items: ['Overview', 'By Fish', 'By Supplier', 'By Market'], active: 0 },
            // The period chip is printed exactly as the desktop sheet draws it; the 8,450 kg and
            // ₹5,42,000 totals are the same purchase the phone's analytics screen shows
            // (₹5,42,000 ÷ ₹641 per kg ≈ 8,450 kg), so the board adds up with itself.
            { kind: 'select', label: 'Date range', value: 'Apr 2024 – Mar 2025', icon: 'calendar' },
            {
              kind: 'chartBars',
              title: 'Purchase Quantity by Fish (kg)',
              items: [
                { label: 'Seer', value: 3100, tone: 'sky' },
                { label: 'Lady Fish', value: 1900, tone: 'sky' },
                { label: 'Prawn', value: 1650, tone: 'sky' },
                { label: 'Crab', value: 950, tone: 'sky' },
                { label: 'Others', value: 850, tone: 'sky' },
              ],
            },
            // The sheet draws one two-line chart; the block model draws one series per chartLine,
            // so the purchase line keeps the sheet's heading and the sale line follows it.
            {
              kind: 'chartLine',
              title: 'Purchase vs Sale Price (Avg. ₹/kg)',
              points: [598, 606, 615, 624, 632, 641],
              labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
              highlight: '₹641/kg',
            },
            {
              kind: 'chartLine',
              title: 'Sale Price (Avg. ₹/kg)',
              points: [724, 731, 739, 748, 760, 780],
              labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
              highlight: '₹780/kg',
            },
            {
              kind: 'chartDonut',
              title: 'Supplier-wise Purchase',
              center: '8,450 kg',
              centerSub: 'Total purchase',
              items: [
                { label: 'Ramesh Fresh', value: 35, tone: 'sky' },
                { label: 'Ocean Traders', value: 25, tone: 'teal' },
                { label: 'Ice Link', value: 20, tone: 'indigo' },
                { label: 'Others', value: 20, tone: 'amber' },
              ],
            },
            {
              kind: 'statCards',
              columns: 2,
              items: [
                { icon: 'percent', tone: 'emerald', value: '18.5%', label: 'Gross Margin', sub: '▲ 2.3% vs last period' },
                { icon: 'wallet', tone: 'sky', value: '₹5,42,000', label: 'Total Purchase Value', sub: '▲ 10% vs last period' },
              ],
            },
          ],
        },
      },
      {
        id: 'purchase-summary',
        caption: 'The same period rolls into one profit-and-loss line: ₹5,42,000 of fish bought.',
        screen: {
          title: 'Profit & Loss',
          right: 'Apr 2024 – Mar 2025',
          sidebar: 'Analytics',
          blocks: [
            { kind: 'tabs', items: ['Purchase Summary', 'Profit & Loss'], active: 1 },
            {
              kind: 'stats',
              columns: 3,
              items: [
                { value: '8,450 kg', label: 'Purchase Quantity', sub: '▲ 12%', tone: 'sky' },
                { value: '₹5,42,000', label: 'Purchase Value', sub: '▲ 10%', tone: 'sky' },
                { value: '₹641/kg', label: 'Avg. Purchase Price', sub: '5,42,000 ÷ 8,450 kg', tone: 'slate' },
              ],
            },
            {
              // Sale value is the purchase value grossed up at the sheet's own 18.5% margin, so the
              // three lines of this table have to agree with the analytics board above.
              kind: 'table',
              title: 'Profit & Loss — the period',
              head: ['Head', 'Value'],
              rows: [
                { cells: ['Purchase Quantity', '8,450 kg'] },
                { cells: ['Purchase Value', '₹5,42,000'] },
                { cells: ['Avg. Purchase Price', '₹641/kg'] },
                { cells: ['Estimated Sale Value', '₹6,65,000'] },
              ],
              footer: { cells: ['Gross Margin', '₹1,23,000 · 18.5%'], tone: 'emerald' },
            },
            {
              kind: 'table',
              title: 'Purchase Value by Supplier',
              head: ['Supplier', 'Share', 'Value (₹)'],
              rows: [
                { cells: ['Ramesh Fresh Marine', '35%', '1,89,700'] },
                { cells: ['Ocean Traders', '25%', '1,35,500'] },
                { cells: ['Ice Link', '20%', '1,08,400'] },
                { cells: ['Others', '20%', '1,08,400'] },
              ],
              footer: { cells: ['Total', '100%', '5,42,000'], tone: 'navy' },
            },
            {
              kind: 'note',
              text: 'Every kilo in this total started as an accepted weight on a GRN like GRN-2026-023.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'gd-alerts',
    number: 32,
    group: 'procurement',
    title: 'Alerts & Notifications',
    subtitle: 'Price moves, shortfalls and delays from the morning market, in the order they happened.',
    tag: 'JAYSHANKAR · PROCUREMENT DESK',
    layout: 'desktop',
    steps: [
      {
        id: 'alert-list',
        caption: 'The desk reads the morning’s alerts in the order they fired, each with its own time.',
        screen: {
          title: 'Alerts',
          right: '17 Sep 2026',
          sidebar: 'Reports',
          blocks: [
            {
              kind: 'rows',
              items: [
                {
                  label: 'Purchase price increased for Seer Fish',
                  sub: 'Current ₹680/kg | Target ₹640/kg',
                  value: 'Today 09:15 AM',
                  tone: 'amber',
                  icon: 'alert',
                },
                {
                  label: 'Required quantity not purchased',
                  sub: 'Seer Fish (50 kg) — Short',
                  value: 'Today 08:30 AM',
                  tone: 'amber',
                  icon: 'alert',
                },
                {
                  label: 'Supplier delivery delayed',
                  sub: 'Ocean Traders — ETA 2 hrs late',
                  value: 'Today 07:45 AM',
                  tone: 'red',
                  icon: 'clock',
                },
                {
                  label: 'Quality below normal',
                  sub: 'Crab — 8% rejection rate',
                  value: 'Today 07:20 AM',
                  tone: 'amber',
                  icon: 'clipboardCheck',
                },
                {
                  // Printed as the sheet's own list has it: the desktop receiving panel numbers this
                  // PO PO-2026-001, while the phone's PO screen numbers it AKS-2026-017.
                  label: 'Received quantity differs from PO',
                  sub: 'PO-2026-001 | Ordered 200 kg, Received 195 kg',
                  value: 'Today 06:50 AM',
                  tone: 'slate',
                  icon: 'receipt',
                },
                {
                  label: 'Good buying opportunity',
                  sub: 'Prawn price dropped by 8%',
                  value: 'Yesterday 10:20 AM',
                  tone: 'emerald',
                  icon: 'checkCircle',
                },
              ],
            },
          ],
        },
      },
      {
        id: 'next-actions',
        caption: 'Three of the six alerts still need a decision today — and the desk closes on the line the client ends with.',
        screen: {
          title: 'Action Needed',
          right: '17 Sep 2026',
          sidebar: 'Reports',
          blocks: [
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'trendingUp',
              title: 'Purchase price increased for Seer Fish',
              detail: 'Current ₹680/kg against a target of ₹640/kg — re-quote before the next PO goes out.',
            },
            {
              kind: 'alert',
              tone: 'red',
              icon: 'clock',
              title: 'Supplier delivery delayed — Ocean Traders',
              detail: 'ETA 2 hrs late — chase the vehicle now and re-book the unloading slot.',
            },
            {
              kind: 'alert',
              tone: 'amber',
              icon: 'alert',
              title: 'Required quantity not purchased — Seer Fish (50 kg) Short',
              detail: 'A top-up requirement for 50 kg covers the orders already booked for today.',
            },
            {
              // The client's closing band from the bottom of the alerts panel, in the navy it is drawn in.
              kind: 'result',
              tone: 'navy',
              icon: 'fish',
              title: 'Smarter Procurement, Better Margins, Bigger Dreams',
              caption: 'Six alerts, three decisions, and one already closed by the GRN.',
              rows: [
                { label: 'Alerts in the list', value: '6' },
                { label: 'Need a decision today', value: '3' },
                { label: 'Closed by GRN-2026-023', value: '1' },
              ],
            },
          ],
        },
      },
    ],
  },
];
