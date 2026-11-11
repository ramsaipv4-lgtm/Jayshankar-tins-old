// The daily spine — chapters 1–8 of the deck.
//
// The order and the screen contents come from the client's 8-screen mobile reference
// (example-video/WhatsApp Image 2026-09-17 at 8.06.00 PM.jpeg: Home → Procurement →
// Receiving → Grading & Weight → Packing → Dispatch → Current Stock → Reports) and from the
// prompt specs beside the locked visuals — prompt-1.md (buying), prompt-2.md (receiving),
// prompt-3.md (grading & packing), prompt-4.md (selling), prompt-5.md (manager view).
//
// This is the spine every later chapter reuses, so the figures are deliberately exact:
// Annamalai · Sela Fish · 150 KG bought at ₹ 420/kg, the 148.5 KG weigh-in, the −1.5 KG
// shortfall that leaves ₹ 62,370 owing, container TC-0042's 50 KG sold to Saravanan Hotels for
// ₹ 23,000, and 965 KG of stock. PR-2026-000125 is the purchase id chapters/quality.ts also
// uses, and the receiving screens carry the locked "Hidden from receiving" fields the client's
// handover document asks for ("Purchase rate — hidden"; "supplier information and purchase rates
// remain procurement-only information").

import type { Chapter } from '@/lib/storybook/types';

export const SPINE_CHAPTERS: Chapter[] = [
  {
    id: 'home',
    number: 1,
    group: 'operations',
    title: 'One app for the whole day',
    subtitle: 'Eight tiles cover buying, weighing, grading, packing, selling and the numbers.',
    tag: 'JAYSHANKAR · BUYING WORKFLOW',
    steps: [
      {
        id: 'home-grid',
        caption: 'The rep opens the app and sees the whole fish day on one screen.',
        screen: {
          title: 'Home',
          // No `back` here — chapter 1 step 1 is the screen the app opens on.
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'hero', icon: 'fish', title: 'JAYSHANKAR', subtitle: 'Seafood Supply Chain' },
            { kind: 'tagline', text: 'Fresh Today · Better Tomorrow' },
            { kind: 'tiles', columns: 2, items: [
              { label: 'Procurement', icon: 'shoppingCart', tone: 'navy' },
              { label: 'Receiving', icon: 'arrowDownToLine', tone: 'sky' },
              { label: 'Grading & Weight', icon: 'scale', tone: 'amber' },
              { label: 'Packing', icon: 'package', tone: 'purple' },
              { label: 'Dispatch', icon: 'truck', tone: 'red' },
              { label: 'Current Stock', icon: 'boxes', tone: 'emerald' },
              { label: 'Reports', icon: 'bars', tone: 'indigo' },
              { label: 'Settings', icon: 'settings', tone: 'slate' },
            ] },
            { kind: 'note', text: 'From Ocean to Opportunity' },
          ],
        },
      },
      {
        id: 'home-manager',
        caption: "The manager's home shows the same grid, an alert badge and today's figures.",
        screen: {
          title: 'Home',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            { kind: 'hero', icon: 'fish', title: 'JAYSHANKAR', subtitle: 'Manager View' },
            { kind: 'tagline', text: 'Fresh Today · Better Tomorrow' },
            { kind: 'alert', tone: 'amber', icon: 'bell', title: '2 containers expire today',
              detail: 'TC-0042 Sela A/B 50 KG · TC-0039 Vanjaram 30 KG' },
            { kind: 'stats', columns: 2, items: [
              { value: '965 KG', label: 'Total Stock', sub: '14 active containers', tone: 'navy' },
              { value: '105 KG', label: 'Ready to Sell', sub: 'Three containers', tone: 'teal' },
              { value: '5', label: "Today's Bills", sub: '₹ 63,000 from Annamalai', tone: 'indigo' },
              { value: '3', label: "Today's Sales", sub: '₹ 23,000 to Saravanan Hotels', tone: 'emerald' },
            ] },
            { kind: 'tiles', columns: 2, items: [
              { label: 'Procurement', icon: 'shoppingCart', tone: 'navy' },
              { label: 'Receiving', icon: 'arrowDownToLine', tone: 'sky' },
              { label: 'Grading & Weight', icon: 'scale', tone: 'amber' },
              { label: 'Packing', icon: 'package', tone: 'purple' },
              { label: 'Dispatch', icon: 'truck', tone: 'red' },
              { label: 'Current Stock', icon: 'boxes', tone: 'emerald' },
              { label: 'Reports', icon: 'bars', tone: 'indigo' },
              { label: 'Settings', icon: 'settings', tone: 'slate' },
            ] },
          ],
        },
      },
      {
        id: 'home-rep',
        caption: "The buying rep's own home is smaller: six tiles and the day's numbers.",
        screen: {
          title: 'Home',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'hero', icon: 'fish', title: 'JAYSHANKAR', subtitle: 'Seafood Supply Chain' },
            { kind: 'tagline', text: 'Fresh Today · Better Tomorrow' },
            { kind: 'stats', columns: 3, items: [
              { value: '450 KG', label: 'Bought Today', tone: 'navy' },
              { value: '2', label: 'Bills Today', tone: 'indigo' },
              { value: '₹ 24K', label: 'Cash Paid', tone: 'emerald' },
            ] },
            { kind: 'tiles', columns: 2, items: [
              { label: 'Procurement', icon: 'shoppingCart', tone: 'navy' },
              { label: 'Receiving', icon: 'arrowDownToLine', tone: 'sky' },
              { label: 'Grading & Weight', icon: 'scale', tone: 'amber' },
              { label: 'Packing', icon: 'package', tone: 'purple' },
              { label: 'Dispatch', icon: 'truck', tone: 'red' },
              { label: 'Current Stock', icon: 'boxes', tone: 'emerald' },
            ] },
          ],
        },
      },
      {
        id: 'home-more',
        caption: "The rest of the rep's tools sit behind More, one tap from the home grid.",
        screen: {
          title: 'More',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'rows', items: [
              { label: 'Market Price Today', sub: 'Sela · Vanjaram · Prawns, updated this morning', icon: 'trendingUp', trailing: 'chevron' },
              { label: 'Suppliers', sub: 'Annamalai · Murugan · Kumar', icon: 'store', trailing: 'chevron' },
              { label: 'My Bills', sub: '2 entered today · PR-2026-000125 still in transit', icon: 'receipt', trailing: 'chevron' },
              { label: 'Payments', sub: '₹ 62,370 owed to Annamalai', icon: 'wallet', tone: 'amber', trailing: 'chevron' },
              { label: 'Reports', sub: 'Stock · Procurement · Dispatch', icon: 'bars', trailing: 'chevron' },
              { label: 'Alerts', sub: '2 containers expire today', icon: 'bell', tone: 'amber', trailing: 'chevron' },
              { label: 'Settings', sub: 'Language · printer · sync', icon: 'settings', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'Everything the rep needs between the harbour and the yard stays on the phone.' },
          ],
        },
      },
    ],
  },
  {
    id: 'procurement',
    number: 2,
    group: 'operations',
    title: 'How a purchase is recorded',
    subtitle: 'Vendor, fish, kilos and rate — entered once, on one screen.',
    tag: 'JAYSHANKAR · BUYING WORKFLOW',
    steps: [
      {
        id: 'record-bill',
        caption: 'The rep records the purchase: vendor, fish type, 150 KG and the rate agreed.',
        screen: {
          title: 'Procurement',
          back: true,
          right: '15 Sep 2026',
          tab: 'Procurement',
          blocks: [
            { kind: 'select', label: 'Vendor', value: 'Annamalai', icon: 'store' },
            { kind: 'select', label: 'Fish Type / SKU', value: 'Sela Fish', icon: 'fish' },
            { kind: 'field', label: 'Quantity (KG)', value: '150', suffix: 'KG', big: true },
            { kind: 'field', label: 'Purchase Rate', value: '₹ 420', suffix: 'per kg' },
            { kind: 'fields', items: [
              { label: 'Bill ID', value: 'PR-2026-000125' },
              { label: 'Date', value: '15 Sep 2026' },
              { label: 'Bill Total', value: '₹ 63,000' },
            ] },
            { kind: 'note', text: "Saved against Annamalai's account — the fish is still on the road." },
            { kind: 'buttons', items: [{ label: 'Save Bill', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'bill-saved',
        caption: 'The bill is saved with a green tick and the time it was entered.',
        screen: {
          title: 'Procurement',
          back: true,
          right: '15 Sep 2026',
          tab: 'Procurement',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'checkCircle', title: '✓ Bill Saved',
              caption: 'Annamalai · Sela Fish · 150 KG · ₹ 63,000',
              rows: [
                { label: 'Bill ID', value: 'PR-2026-000125' },
                { label: 'Weight', value: '150 KG' },
                { label: 'Rate', value: '₹ 420 / kg' },
                { label: 'Bill Total', value: '₹ 63,000' },
                { label: 'Saved', value: '15 Sep 2026 · 8:42 AM' },
              ] },
            { kind: 'note', text: 'The same bill is on the vendor’s screen and on the office screen.' },
            { kind: 'buttons', items: [{ label: 'Back to Home', variant: 'outline' }] },
          ],
        },
      },
      {
        id: 'done',
        caption: 'A full-screen tick sends the rep straight on to the next catch.',
        screen: {
          title: 'Done',
          back: true,
          right: '15 Sep 2026',
          tab: 'Procurement',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'checkCircle', title: 'Done', caption: 'Move on to the next catch' },
            { kind: 'note', text: 'Receiving will weigh the same fish again when the truck reaches the yard.' },
          ],
        },
      },
      {
        id: 'vendor-account',
        caption: "The bill lands on the vendor's account with the amount still owed against it.",
        screen: {
          title: 'Annamalai',
          back: true,
          right: '15 Sep 2026',
          tab: 'Suppliers',
          blocks: [
            { kind: 'stats', columns: 3, items: [
              { value: '₹ 63,000', label: 'Owed to Annamalai', tone: 'amber' },
              { value: '1', label: 'Bill in Transit', tone: 'sky' },
              { value: '2', label: 'Bills Today', tone: 'indigo' },
            ] },
            { kind: 'rows', title: 'Bills on this account', items: [
              { label: 'PR-2026-000125 · Sela Fish 150 KG', sub: '15 Sep 2026 · ₹ 420 / kg', value: '₹ 63,000', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'The amount drops to ₹ 62,370 the moment receiving confirms 148.5 KG.' },
            { kind: 'buttons', items: [{ label: 'View Payments', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
  {
    id: 'receiving',
    number: 3,
    group: 'operations',
    title: 'What happens when fish arrives',
    subtitle: 'Discrepancy flagged, never hidden.',
    tag: 'JAYSHANKAR · RECEIVING WORKFLOW',
    steps: [
      {
        id: 'in-transit',
        caption: 'A bill reaches the yard before the fish does, and the floor is told what to expect.',
        screen: {
          title: 'In Transit',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'amber', icon: 'truck', title: '1 Bill In Transit',
              detail: 'Annamalai · Sela Fish · Expected 150 KG' },
            { kind: 'fields', items: [
              { label: 'Vendor', value: 'Annamalai' },
              { label: 'Fish', value: 'Sela Fish' },
              { label: 'Expected Weight', value: '150 KG' },
              // The client's handover document: the rate, the contact and the margin never reach
              // the receiving role — hence the 🔒, exactly as in chapters/quality.ts.
              { label: 'Purchase Rate', value: 'Hidden from receiving', locked: true },
              { label: 'Supplier Contact', value: 'Hidden from receiving', locked: true },
              { label: 'Profit / Margin', value: 'Hidden from receiving', locked: true },
            ] },
            { kind: 'note', text: 'Receiving sees only what it needs to physically receive.' },
            { kind: 'buttons', items: [{ label: 'Confirm Arrival', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'confirm-weight',
        caption: 'The yard weighs the fish and enters what actually came off the truck.',
        screen: {
          title: 'Confirm Weight',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'select', label: 'Fish Type', value: 'Sela Fish', icon: 'fish' },
            { kind: 'field', label: 'Expected Weight', value: '150', suffix: 'KG' },
            { kind: 'field', label: 'Actual Weight (KG)', value: '148.5', suffix: 'KG', big: true },
            { kind: 'note', text: 'Difference −1.5 KG', tone: 'amber' },
            { kind: 'buttons', items: [{ label: 'Confirm', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'discrepancy',
        caption: 'The shortfall is shown with the money it changes, and the admin is told.',
        screen: {
          title: 'Discrepancy',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'red', icon: 'alert', title: '−1.5 KG short',
              detail: 'Expected 150 KG · Actual 148.5 KG' },
            { kind: 'fields', items: [
              { label: 'Original bill', value: '₹ 63,000' },
              { label: 'Money owed to vendor', value: '₹ 62,370' },
            ] },
            { kind: 'note', text: 'Admin notified — settled by hand' },
            // The one line where the shipped deck and the client's handover document agree.
            { kind: 'note', text: 'Receiving never sees the rate — supplier contact and margin stay procurement-only.' },
          ],
        },
      },
      {
        id: 'confirmed',
        caption: 'The weigh-in is confirmed and stock moves by what was actually weighed.',
        screen: {
          title: 'Confirmed',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'checkCircle', title: 'Confirmed',
              caption: 'Stock adjusted to 148.5 KG',
              rows: [
                { label: 'Vendor', value: 'Annamalai' },
                { label: 'Fish', value: 'Sela Fish' },
                { label: 'Expected', value: '150 KG' },
                { label: 'Received', value: '148.5 KG' },
                { label: 'Shortfall', value: '−1.5 KG' },
                { label: 'Now owed to vendor', value: '₹ 62,370' },
              ] },
            { kind: 'note', text: 'The lot is ready to grade — 148.5 KG waiting on the floor.' },
          ],
        },
      },
    ],
  },
  {
    id: 'grading',
    number: 4,
    group: 'operations',
    title: 'Grading the catch',
    subtitle: 'Sorted by size and weighed grade by grade, not by guesswork.',
    tag: 'JAYSHANKAR · PACKING & GRADING',
    steps: [
      {
        id: 'pick-fish',
        caption: 'The grader picks the lot that just arrived and starts the split.',
        screen: {
          title: 'Pick Fish',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'fields', items: [
              { label: 'Fish Type', value: 'Sela Fish' },
              { label: 'Weight', value: '148.5 KG' },
              { label: 'Source', value: 'From Annamalai · 15 Sep' },
            ] },
            { kind: 'note', text: 'This is the weight receiving confirmed — grading starts from it, never from a guess.' },
            { kind: 'buttons', items: [{ label: 'Start Grading', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'grade-split',
        caption: 'The lot is split into A, B and C by size and each grade is weighed.',
        screen: {
          title: 'Grading & Weight',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'select', label: 'Fish Type / SKU', value: 'Sela Fish', icon: 'fish' },
            { kind: 'gradeRows', items: [
              { label: 'A Large', value: 80 },
              { label: 'B Medium', value: 50 },
              { label: 'C Small', value: 15 },
            ], total: '145 KG ✓' },
            { kind: 'fields', items: [
              { label: 'Graded from', value: '148.5 KG' },
              { label: 'Full crates filled', value: 'TC-0042 · TC-0043' },
            ] },
          ],
        },
      },
      {
        id: 'quality-check',
        caption: 'A quality check records the grade, the temperature of the fish and a photo.',
        screen: {
          title: 'Quality Check',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'fields', items: [
              { label: 'Grade', value: 'A Large' },
              { label: 'Temperature', value: '2 °C' },
              { label: 'Checked by', value: 'Grading desk · 9:15 AM' },
            ] },
            { kind: 'photos', count: 2, caption: 'Photo evidence · Sela Fish, grade A' },
            { kind: 'note', text: 'Every lot keeps its own photo and temperature record, so a bad crate can be traced back to its fish.' },
            { kind: 'buttons', items: [{ label: 'Save Grading', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'grading-saved',
        caption: 'The saved split is checked back against the weight that came in.',
        screen: {
          title: 'Grading Saved',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'checkCircle', title: '✓ Grading Saved',
              caption: '145 KG graded from 148.5 KG received',
              rows: [
                { label: 'A Large', value: '80 KG' },
                { label: 'B Medium', value: '50 KG' },
                { label: 'C Small', value: '15 KG' },
                { label: 'Trim & ice', value: '3.5 KG' },
              ] },
            { kind: 'note', text: 'The 3.5 KG gap is trimming and ice — the three grades still add up to what was weighed.' },
            { kind: 'note', text: 'Next: the grades go into containers at Packing.' },
          ],
        },
      },
    ],
  },
  {
    id: 'packing',
    number: 5,
    group: 'operations',
    title: 'Packing into containers',
    subtitle: 'Packed in ice, tagged, and given a shelf-life clock that starts the moment it is sealed.',
    tag: 'JAYSHANKAR · PACKING & GRADING',
    steps: [
      {
        id: 'pack-container',
        caption: 'The grader packs the graded fish into a numbered container and tags it.',
        screen: {
          title: 'Pack Container',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'field', label: 'Container No.', value: 'TC-0042' },
            { kind: 'select', label: 'Fish Type / SKU', value: 'Sela Fish', icon: 'fish' },
            // prompt-3.md gives the pack size as 10 KG and the container total as 50 KG; five
            // 10 KG packs is the only split that satisfies both, so the box count follows it.
            { kind: 'field', label: 'Pack Size (KG per box)', value: '10', suffix: 'KG' },
            { kind: 'field', label: 'Total Boxes', value: '5' },
            { kind: 'field', label: 'Total Weight', value: '50', suffix: 'KG', big: true },
            { kind: 'note', text: 'Shelf-life clock starts now' },
            { kind: 'buttons', items: [{ label: 'Pack & Tag', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'container-detail',
        caption: 'The container detail shows what is inside it and when it must go out.',
        screen: {
          title: 'TC-0042',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'fields', items: [
              { label: 'Sela A (Large)', value: '30 KG' },
              { label: 'Sela B (Medium)', value: '20 KG' },
              { label: 'Total', value: '50 KG' },
              { label: 'Packed', value: '15 Sep 2026 · 12:00 PM' },
            ] },
            { kind: 'alert', tone: 'emerald', icon: 'snowflake', title: 'Expires 17 Sep 02:00',
              detail: '50 KG in this container' },
            { kind: 'progress', label: 'Shelf life left', value: 38, max: 48, unit: 'hrs' },
            { kind: 'note', text: 'Earliest fish in box goes first' },
          ],
        },
      },
      {
        id: 'qr-tag',
        caption: 'The container gets its QR tag, and one scan tells the whole story of the box.',
        screen: {
          title: 'QR Tag · TC-0042',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'qr', value: 'TC-0042', caption: 'Print and stick this on the container' },
            { kind: 'fields', items: [
              { label: 'Container', value: 'TC-0042' },
              { label: 'Inside', value: 'Sela A 30 KG · Sela B 20 KG' },
              { label: 'Expires', value: '17 Sep 02:00' },
            ] },
            { kind: 'note', text: 'Scanning at dispatch, or in the yard, opens the same record — no register book to hunt through.' },
            { kind: 'buttons', items: [{ label: 'Print Tag', variant: 'outline' }] },
          ],
        },
      },
      {
        id: 'packed',
        caption: 'The container is sealed, tagged and counted into stock.',
        screen: {
          title: 'Packed',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'packageCheck', title: '✓ TC-0042 Packed',
              caption: '50 KG · Sela A 30 KG + Sela B 20 KG',
              rows: [
                { label: 'Boxes', value: '5 × 10 KG' },
                { label: 'Expires', value: '17 Sep 02:00' },
                { label: 'In stock now', value: '50 KG' },
              ] },
            { kind: 'note', text: 'The container sits at the top of the dispatch list until it is sold.' },
          ],
        },
      },
    ],
  },
  {
    id: 'dispatch',
    number: 6,
    group: 'operations',
    title: 'Selling fish to a buyer',
    subtitle: 'Oldest container first · the price per kilo is set on each sale.',
    tag: 'JAYSHANKAR · SELLING WORKFLOW',
    steps: [
      {
        id: 'todays-stock',
        caption: "The rep opens today's stock and the app puts the oldest container at the top.",
        screen: {
          title: "Today's Stock",
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'amber', icon: 'timer', title: 'Selling first',
              detail: 'Oldest container goes out first — TC-0042 was packed on 15 Sep' },
            { kind: 'rows', items: [
              { label: 'TC-0042 · Sela A/B', sub: 'Packed 15 Sep · expires 17 Sep 02:00', value: '50 KG', tone: 'amber', trailing: 'chevron' },
              { label: 'TC-0039 · Vanjaram', sub: 'Packed 14 Sep · expires 17 Sep 18:00', value: '30 KG', trailing: 'chevron' },
              { label: 'TC-0041 · Parai', sub: 'Packed 15 Sep · expires 18 Sep', value: '25 KG', trailing: 'chevron' },
            ] },
            { kind: 'note', text: '105 KG is ready to sell today.' },
            { kind: 'buttons', items: [{ label: 'Record Sale', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'record-sale',
        caption: 'The sale is recorded against the container the fish actually came out of.',
        screen: {
          title: 'Record Sale',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'select', label: 'Fish Type / SKU', value: 'Sela Fish', icon: 'fish' },
            { kind: 'select', label: 'Container', value: 'TC-0042 · 50 KG in stock', icon: 'container' },
            { kind: 'field', label: 'Quantity (KG)', value: '50', suffix: 'KG', big: true },
            { kind: 'field', label: 'Sale Price', value: '₹ 460', suffix: 'per kg' },
            { kind: 'fields', items: [{ label: 'Total', value: '₹ 23,000' }] },
            { kind: 'buttons', items: [{ label: 'Dispatch', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'customer',
        caption: 'The buyer is picked from the customer list, with what they owe already on screen.',
        screen: {
          title: 'Customer',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'rows', items: [
              { label: 'Saravanan Hotels', sub: '+91 98XXX 12345', icon: 'store', trailing: 'chevron' },
            ] },
            { kind: 'stats', columns: 3, items: [
              { value: '₹ 0', label: 'Outstanding', tone: 'emerald' },
              { value: '12', label: 'Orders', sub: 'Regular customer', tone: 'sky' },
              { value: '₹ 23,000', label: 'This Sale', tone: 'navy' },
            ] },
            { kind: 'note', text: 'Regular customer · 12 orders' },
            { kind: 'note', text: 'Payment for this sale: cash on dispatch.' },
            { kind: 'buttons', items: [{ label: 'Confirm Sale', variant: 'primary' }] },
          ],
        },
      },
      {
        id: 'dispatched',
        caption: 'The container leaves and the stock drops to zero on the same screen.',
        screen: {
          title: 'Dispatched',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'result', tone: 'emerald', icon: 'truck', title: '✓ Dispatched',
              caption: 'Saravanan Hotels · Sela Fish · 50 KG',
              rows: [
                { label: 'Bill', value: '₹ 23,000' },
                { label: 'Payment', value: 'Cash received' },
                { label: 'Container', value: 'TC-0042 now at 0 KG' },
              ] },
            { kind: 'note', text: 'The container is off the shelf and off the expiry list — tomorrow it starts empty.' },
          ],
        },
      },
    ],
  },
  {
    id: 'stock',
    number: 7,
    group: 'operations',
    title: 'What the manager sees',
    subtitle: 'Live stock, expiry order and low-stock warnings — on the phone, any time.',
    tag: 'JAYSHANKAR · MANAGER VIEW',
    steps: [
      {
        id: 'stock-list',
        caption: 'The manager opens Current Stock and sees every fish type in the yard with its kilos.',
        screen: {
          title: 'Current Stock',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'table', head: ['Fish Type', 'In Stock'], rows: [
              { cells: ['Sela Fish', '245 KG'] },
              { cells: ['Parai Fish', '180 KG'], tone: 'amber' },
              { cells: ['Vanjaram', '95 KG'] },
              { cells: ['Prawns', '320 KG'] },
              { cells: ['Squid', '60 KG'] },
              { cells: ['Crab', '40 KG'] },
            ], footer: { cells: ['Total Stock', '965 KG'], tone: 'navy' } },
            { kind: 'note', text: 'The same list the weighing, grading and dispatch screens have been feeding all day.' },
          ],
        },
      },
      {
        id: 'by-container',
        caption: 'Switching to By Container sorts the stock by what will go bad first.',
        screen: {
          title: 'By Container',
          back: true,
          right: '15 Sep 2026',
          tab: 'Home',
          blocks: [
            { kind: 'tabs', items: ['By Fish', 'By Container'], active: 1 },
            { kind: 'rows', items: [
              { label: 'TC-0042 · Sela A/B', sub: 'Packed 15 Sep', value: '50 KG · 17 Sep', tone: 'amber', trailing: 'chevron' },
              { label: 'TC-0039 · Vanjaram', sub: 'Packed 14 Sep', value: '30 KG · 17 Sep', trailing: 'chevron' },
              { label: 'TC-0041 · Parai', sub: 'Packed 15 Sep', value: '25 KG · 18 Sep', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'Soonest expiry at top' },
          ],
        },
      },
      {
        id: 'dashboard',
        caption: "The dashboard adds the day's buying and selling to the stock on hand.",
        screen: {
          title: 'Dashboard',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            { kind: 'statCards', columns: 2, items: [
              { icon: 'warehouse', tone: 'navy', value: '965 KG', label: 'Total Stock', sub: 'Across 14 active containers' },
              { icon: 'container', tone: 'teal', value: '14', label: 'Active Containers', sub: '2 expire today' },
              { icon: 'receipt', tone: 'indigo', value: '5', label: "Today's Bills", sub: 'Last: Annamalai ₹ 63,000' },
              { icon: 'shoppingCart', tone: 'emerald', value: '3', label: "Today's Sales", sub: 'Last: Saravanan Hotels ₹ 23,000' },
            ] },
            { kind: 'note', text: 'No spreadsheet, no evening phone calls — the figures are the same ones the yard has been entering.' },
          ],
        },
      },
      {
        id: 'alerts',
        caption: 'The alerts screen warns about the fish that is running low and the boxes about to expire.',
        screen: {
          title: 'Alerts',
          back: true,
          right: 'Today',
          tab: 'Home',
          blocks: [
            { kind: 'alert', tone: 'amber', icon: 'alert', title: 'Parai Fish low stock',
              detail: '180 KG left · reorder before 18 Sep' },
            { kind: 'rows', items: [
              { label: '2 containers expire today', sub: 'TC-0042 Sela A/B · TC-0039 Vanjaram', icon: 'clock', tone: 'red', trailing: 'chevron' },
              { label: 'Vanjaram restocked', sub: '30 KG added in TC-0039', icon: 'checkCircle', tone: 'emerald', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'Alerts come off the stock and the shelf-life clocks, not off somebody remembering to check.' },
          ],
        },
      },
    ],
  },
  {
    id: 'reports',
    number: 8,
    group: 'operations',
    title: 'Reports without a spreadsheet',
    subtitle: 'Three reports cover the whole day — stock, buying and selling.',
    tag: 'JAYSHANKAR · MANAGER VIEW',
    steps: [
      {
        id: 'report-cards',
        caption: 'The manager opens Reports and finds one card for each question the day raises.',
        screen: {
          title: 'Reports',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'rows', items: [
              { label: 'Stock Report', sub: 'View current stock', icon: 'bars', tone: 'sky', trailing: 'chevron' },
              { label: 'Procurement Report', sub: 'View purchases', icon: 'arrowLeftRight', tone: 'emerald', trailing: 'chevron' },
              { label: 'Dispatch Report', sub: 'View sales / dispatch', icon: 'truck', tone: 'red', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'Every report opens on the phone — no laptop, no printed register.' },
          ],
        },
      },
      {
        id: 'stock-report',
        caption: 'The stock report turns what is in the yard into numbers and bars.',
        screen: {
          title: 'Stock Report',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'statCards', columns: 2, items: [
              { icon: 'warehouse', tone: 'navy', value: '965 KG', label: 'Stock at Close', sub: 'Counted 15 Sep' },
              { icon: 'container', tone: 'teal', value: '14', label: 'Active Containers', sub: '2 expiring today' },
            ] },
            { kind: 'chartBars', title: 'Stock by fish type (KG)', items: [
              { label: 'Sela Fish', value: 245, tone: 'navy' },
              { label: 'Prawns', value: 320, tone: 'teal' },
              { label: 'Parai Fish', value: 180, tone: 'amber' },
              { label: 'Vanjaram', value: 95, tone: 'sky' },
              { label: 'Squid', value: 60, tone: 'indigo' },
              { label: 'Crab', value: 40, tone: 'slate' },
            ] },
          ],
        },
      },
      {
        id: 'procurement-report',
        caption: 'The buying report shows the week as a line and today as a list of bills.',
        screen: {
          title: 'Procurement Report',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'chartLine', title: 'Purchase value · last 7 days',
              points: [41, 52, 38, 61, 47, 55, 63],
              labels: ['9 Sep', '10 Sep', '11 Sep', '12 Sep', '13 Sep', '14 Sep', '15 Sep'],
              highlight: '₹ 63,000 today' },
            { kind: 'table', title: "Today's bills", head: ['Bill', 'Vendor', 'Weight', 'Value'], rows: [
              { cells: ['PR-2026-000125', 'Annamalai', '150 KG', '₹ 63,000'] },
              { cells: ['PR-2026-000124', 'Murugan', '95 KG', '₹ 42,750'] },
              { cells: ['PR-2026-000123', 'Kumar', '60 KG', '₹ 25,200'] },
            ], footer: { cells: ['Total', '3 bills', '305 KG', '₹ 1,30,950'], tone: 'navy' } },
            { kind: 'note', text: 'Every row here was entered on a phone at the harbour, not typed up in the office later.' },
          ],
        },
      },
      {
        id: 'reports-mobile',
        caption: 'The manager closes on the three questions the reports answer, on any screen.',
        screen: {
          title: 'Reports',
          back: true,
          right: '15 Sep 2026',
          tab: 'More',
          blocks: [
            { kind: 'rows', items: [
              { label: 'Where is the stock?', value: 'Stock Report', icon: 'bars', tone: 'sky', trailing: 'chevron' },
              { label: 'What did we buy?', value: 'Procurement Report', icon: 'arrowLeftRight', tone: 'emerald', trailing: 'chevron' },
              { label: 'What did we sell?', value: 'Dispatch Report', icon: 'truck', tone: 'red', trailing: 'chevron' },
            ] },
            { kind: 'note', text: 'Served through Google Looker Studio — mobile-friendly, so the same report opens in the office and in the yard.' },
            { kind: 'buttons', items: [{ label: 'Share Report on WhatsApp', variant: 'outline' }] },
          ],
        },
      },
    ],
  },
];
