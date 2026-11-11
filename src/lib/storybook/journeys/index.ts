// Persona journeys — "walk it as someone".
//
// WHY: the 32 chapters are organised by FEATURE ("Grading the catch"). A client reviewing the product thinks in
// PEOPLE ("what does the grader do all day?"). A journey is one person's day on the one device they actually use —
// built mostly from the chapters' own screens (so it never contradicts them) plus a few screens the chapters lack
// (screens.ts), re-captioned in the second person. A journey is an ordinary Chapter in group 'journeys', so decks 1
// and 2 play it with the players they already have, deep links (`#/review?c=<id>&s=<n>`) work unchanged, and the
// third deck draws the very same data in its own look — which is what makes the three decks comparable.
//
// Personas are JOBS, not roles (D72: there is no sixth role; the real wholesaler does several jobs at once). Each
// journey names the closest of the five `users.role` values.

import type { Chapter, ScreenSpec, StepSpec } from '../types';
import { BASE_CHAPTERS } from '../chapters/base';
import { S } from './screens';

type Ref = { from: [chapterId: string, step: number]; say: string };
type Own = { screen: ScreenSpec; say: string };

const byId = new Map(BASE_CHAPTERS.map((c) => [c.id, c]));

function screenOf([cid, i]: Ref['from']): ScreenSpec {
  const ch = byId.get(cid);
  const st = ch?.steps[i];
  if (!st) throw new Error(`journeys: no step ${i} in chapter "${cid}"`);
  return st.screen;
}
const ref = (cid: string, step: number, say: string): Ref => ({ from: [cid, step], say });
const own = (screen: ScreenSpec, say: string): Own => ({ screen, say });

function journey(
  id: string, number: number, title: string, subtitle: string, tag: string, layout: 'phone' | 'desktop',
  persona: NonNullable<Chapter['persona']>, steps: (Ref | Own)[],
): Chapter {
  return {
    id, number, group: 'journeys', title, subtitle, tag, layout, persona,
    steps: steps.map((s, i): StepSpec => ({
      id: `${id}-${i + 1}`,
      caption: s.say,
      screen: 'from' in s ? screenOf(s.from) : s.screen,
    })),
  };
}

export const JOURNEY_CHAPTERS: Chapter[] = [
  journey('walk-admin-desk', 33, 'The admin, at the desk', 'Buy, receive and decide — on the big screen, from requirement to alert.',
    'JAYSHANKAR · WALK AS THE ADMIN · DESKTOP', 'desktop', { role: 'admin', who: 'Admin', devices: 'Desktop' }, [
      ref('gd-dashboard', 0, 'You open the day: what has been bought, which vehicles are due, and what is short.'),
      ref('gd-requirements', 0, 'You read this week\'s purchase requirements, each with the market it has to reach.'),
      ref('gd-market-price', 0, 'You check today\'s market rate for each fish against yesterday and last week.'),
      ref('gd-quotation', 0, 'Three suppliers have quoted for the same 200 kg. You compare them on what the fish costs landed.'),
      ref('gd-quotation', 1, 'You pick a different supplier and watch the landed cost move.'),
      ref('gd-po', 0, 'The purchase order fills itself in from the quote you accepted.'),
      ref('gd-po', 1, 'The order is approved, sent and confirmed in one morning.'),
      own(S.truckBoard, 'In truck mode the trip is one load. You see each vendor\'s bill under it — and the blended landed cost that only you can see.'),
      ref('gd-receiving', 0, 'The clerk records what the vehicle actually delivered against the order.'),
      ref('gd-receiving', 1, 'Saving the receipt puts the accepted kilos into stock and books the rejected ones against the vendor.'),
      own(S.approvalsDesk, 'Bills, truck loads and reversals wait in one inbox. You can approve anyone\'s — never your own.'),
      ref('gd-costing', 0, 'Transport, ice, packing and loading are added so you see the real cost of a kilo.'),
      ref('gd-analytics', 1, 'The period rolls into one profit-and-loss line.'),
      ref('gd-alerts', 1, 'Three alerts still need a decision today. You clear them.'),
      own(S.modeSettings, 'You choose, per warehouse, whether it buys vendor by vendor or truck by truck. Nothing already recorded changes.'),
      own(S.accessDesk, 'You can see exactly who may call what. A new function starts closed, and opens only by a deliberate line.'),
    ]),

  journey('walk-admin-phone', 34, 'The admin, on the phone', 'The same business from your pocket — alerts, approvals, money and people.',
    'JAYSHANKAR · WALK AS THE ADMIN · PHONE', 'phone', { role: 'admin', who: 'Admin', devices: 'Phone' }, [
      ref('home', 1, 'Your home shows the same grid as everyone\'s, plus an alert badge and today\'s figures.'),
      ref('alerts', 0, 'Three alerts are waiting. The bell holds the rest.'),
      ref('alerts', 1, 'Two containers expire today. One tap sends their sell-list to the reps.'),
      ref('stock', 1, 'You switch the stock view to “by container”, ordered by what will spoil first.'),
      ref('reports', 0, 'Reports are cards, one for each question the day raises.'),
      ref('profit-audit', 0, 'Today\'s profit: what was bought, what was sold, what was made.'),
      own(S.approvalsPhone, 'Three documents want your decision. Each carries its own approval — and you cannot approve your own.'),
      ref('complaints', 3, 'A complaint arrives with its sale beside it. You pick the refund.'),
      ref('tasks', 0, 'You assign a packing task to Kumar with a deadline.'),
      ref('team', 1, 'You invite Suresh by name, role and phone number.'),
      own(S.search, 'When you just need something, one search box finds a fish, a customer, a vendor or a person.'),
    ]),

  journey('walk-buyer', 35, 'The buyer, on the road', 'Out before dawn with a truck: buy from several vendors, even with no signal.',
    'JAYSHANKAR · WALK AS THE BUYER · PHONE', 'phone', { role: 'vendor-rep', who: 'Vendor rep (the buyer)', devices: 'Phone only' }, [
      ref('home', 2, 'Your home is smaller than the manager\'s: six tiles and the day\'s numbers.'),
      own(S.tripTask, 'A trip has been planned for you — vehicle and time. It never says which vendors to visit.'),
      own(S.loadStarted, 'You tap Start. The load is in progress and every purchase you record joins it.'),
      ref('procurement', 0, 'At the first stop you record the purchase: vendor, fish, weight and the agreed rate.'),
      ref('procurement', 1, 'The bill is saved with a green tick and the time.'),
      own(S.offlineQueue, 'The next stops are underground — no signal. You keep recording; the phone keeps the queue, in order.'),
      own(S.backOnline, 'Signal returns and the queue sends itself. Nothing was lost.'),
      own(S.loadManifest, 'Back on the road, the load shows what you have bought so far, vendor by vendor.'),
      ref('procurement', 3, 'Each bill lands on that vendor\'s account with the amount still owed against it.'),
    ]),

  journey('walk-receiver', 36, 'The one at the scale', 'Weigh what came off the truck, record what is short — without ever knowing who sold it.',
    'JAYSHANKAR · WALK AS RECEIVING · PHONE', 'phone', { role: 'receiving', who: 'Receiving / storage (v3) — or a floor worker who is always blind', devices: 'Phone only' }, [
      own(S.rcvArrived, 'A truck has arrived. You are told the fish and the kilos expected — nothing else.'),
      own(S.rcvBlind, 'The vendor, the rate and the contact are not hidden by the screen: they were never sent to you.'),
      own(S.rcvWeigh, 'You weigh 392.0 kg good and 4.8 kg spoiled. The screen does the arithmetic against the 400 expected.'),
      own(S.rcvDiscrepancy, '3.2 kg are missing. The shortfall is recorded and the admin is told — and the money is left for a person to settle.'),
      own(S.rcvIssue, 'You photograph the spoiled fish and record why. The admin can trace it to the vendor lot; you never need to.'),
      own(S.rcvConfirmed, 'You confirm. Stock moves by what you actually weighed. (The vendors stay on file for the admin\'s books — none of that is on your screens.)'),
    ]),

  journey('walk-grader', 37, 'The grader', 'Split the catch by size, check its quality, pack it, tag it.',
    'JAYSHANKAR · WALK AS THE GRADER · PHONE', 'phone', { role: 'worker', who: 'Worker (floor staff)', devices: 'Phone only' }, [
      ref('grading', 0, 'You pick the lot that just arrived and start the split.'),
      ref('grading', 1, 'You split it into A, B and C by size, weighing each grade.'),
      ref('grading', 2, 'The quality check records the grade, the temperature of the fish and a photo.'),
      ref('grading', 3, 'The saved split is checked back against the weight that came in.'),
      ref('packing', 0, 'You pack the graded fish into a numbered container.'),
      ref('packing', 1, 'The container shows what is inside and when it must go out.'),
      ref('packing', 2, 'It gets a QR tag. One scan tells the whole story of the box.'),
      ref('packing', 3, 'The container is sealed, tagged and counted into stock.'),
      ref('containers-qr', 1, 'A new crate? You register its number, size and owner.'),
      ref('spoilage', 1, 'Some fish is past saving: you log how much, and photograph it.'),
    ]),

  journey('walk-packer', 38, 'Pack it and deliver it', 'A task arrives: package this much, take it there — and it closes itself.',
    'JAYSHANKAR · WALK AS THE PACKER · PHONE', 'phone', { role: 'super-worker', who: 'Worker or super-worker', devices: 'Phone only' }, [
      own(S.deliverTask, 'A task lands: pack 40 kg of Sela and deliver it to Kumar Mess by 2 p.m.'),
      ref('tasks', 2, 'You record what you have packed so far, and the app checks you in by itself.'),
      ref('packing', 2, 'Each container gets its QR tag as you seal it.'),
      ref('containers-qr', 3, 'Scanning a tag at the door opens what is inside and when it expires.'),
      ref('dispatch', 1, 'The sale is recorded against the container the fish actually came from.'),
      own(S.outForDelivery, 'You load the vehicle. The delivery shows the stops, the containers and the expected time.'),
      own(S.delivered, 'At the door you confirm who received it, the weight and a photo.'),
      own(S.taskDone, 'The task closes itself from the action that finished it, ahead of the deadline.'),
    ]),

  journey('walk-sales', 39, 'The salesperson', 'Sell from the oldest box, take payment, send the bill — and get warned, not blocked.',
    'JAYSHANKAR · WALK AS SALES · PHONE', 'phone', { role: 'vendor-rep', who: 'Vendor rep (selling)', devices: 'Phone only' }, [
      ref('dispatch', 0, 'You open today\'s stock and the app puts the oldest container on top.'),
      ref('dispatch', 1, 'You record the sale against the container the fish comes from.'),
      ref('dispatch', 2, 'You pick the buyer; what they already owe is on screen.'),
      own(S.creditWarn, 'This sale would pass the customer\'s credit limit. You are warned — and it is still your call.'),
      ref('dispatch', 3, 'The container leaves and the stock drops on the same screen.'),
      ref('customers-payments', 1, 'Later the customer pays by UPI. You enter it.'),
      ref('customers-payments', 2, 'The balance falls to zero.'),
      ref('bills-credit', 1, 'The bill shows its line items and the terms recorded against it.'),
      own(S.shareBill, 'You send the bill by WhatsApp, the way the customer actually reads things.'),
    ]),

  journey('walk-floor', 40, 'The floor, all day', 'Tasks, expiring boxes, losses, repacking, scanning — the work between the big events.',
    'JAYSHANKAR · WALK AS FLOOR STAFF · PHONE', 'phone', { role: 'worker', who: 'Worker (floor staff)', devices: 'Phone only' }, [
      own(S.floorHome, 'Your home is what you do today: tasks, what expires, what you packed.'),
      ref('tasks', 1, 'A task from the manager arrives with a Start button.'),
      ref('spoilage', 0, 'Containers are listed by expiry. The one that dies today is red.'),
      ref('spoilage', 1, 'You log what is unsalvageable, with a photo.'),
      ref('spoilage', 2, 'The loss is booked with its cost, and the audit log is updated.'),
      own(S.repack, 'You consolidate two part-empty boxes into one. Nothing is created or lost.'),
      ref('alerts', 2, 'Near closing, the sell-list shows what must go first.'),
      ref('containers-qr', 3, 'A scan of any box answers what is in it and what to do next.'),
    ]),

  journey('walk-money', 41, 'Money, from the owner\'s chair', 'Who owes what, which bills are settled, what was made — and an audit trail nobody can edit.',
    'JAYSHANKAR · WALK AS THE OWNER · PHONE', 'phone', { role: 'admin', who: 'Admin (money)', devices: 'Phone only' }, [
      ref('customers-payments', 0, 'You see who still owes money and who is settled.'),
      ref('customers-payments', 3, 'A customer card shows the credit limit and how much of it is used.'),
      ref('bills-credit', 0, 'Bills are listed by customer, amount, paid or unpaid and age.'),
      ref('bills-credit', 2, 'You reconcile a bill against the sale and the payment that settled it.'),
      ref('profit-audit', 0, 'Today\'s profit, plainly.'),
      ref('profit-audit', 1, 'The margin fish by fish: which one actually made the money.'),
      ref('profit-audit', 2, 'Every change is in the audit log with a time and no way to edit it.'),
      ref('profit-audit', 3, 'The day closes with the same figures everyone has seen all day.'),
    ]),

  journey('walk-complaint', 42, 'When a customer calls with a problem', 'A complaint, a refund, a reversal — and who must say yes.',
    'JAYSHANKAR · WALK AS SALES, THEN ADMIN · PHONE', 'phone', { role: 'vendor-rep', who: 'Vendor rep, then the admin', devices: 'Phone only' }, [
      ref('complaints', 0, 'The customer rings. You open the sale — a File Complaint button sits under it.'),
      ref('complaints', 1, 'You record how many kilos, why, and a photo.'),
      ref('complaints', 2, 'Both complaints wait in one list for the admin.'),
      ref('complaints', 3, 'The admin sees the sale and the complaint side by side and picks the refund.'),
      ref('reversals', 1, 'If the sale should never have happened, you ask for a reversal with a reason.'),
      ref('reversals', 2, 'It waits for the admin. Nothing moves until it is approved.'),
      ref('reversals', 3, 'On approval the stock returns to the container and the bill comes off the customer.'),
    ]),

  journey('walk-newcomer', 43, 'A new person joins', 'Invite, set a password, land on the right home, learn the job.',
    'JAYSHANKAR · WALK AS A NEW HIRE · PHONE', 'phone', { role: 'any', who: 'Admin invites; the new person does the rest', devices: 'Phone only' }, [
      ref('team', 0, 'You (the admin) open Team Management and see who is on the team and in what role.'),
      ref('team', 1, 'You enter Suresh\'s name, role and phone number.'),
      ref('team', 2, 'The invite link comes back ready to share by WhatsApp or SMS.'),
      ref('team', 3, 'Suresh sets his own password and lands on the Floor home.'),
      own(S.learn, 'He opens Learn: short videos filtered to what his role can do.'),
    ]),

  journey('walk-transfer', 44, 'Moving stock between warehouses', 'Send it, track it while it is on the road, count it only when it arrives.',
    'JAYSHANKAR · WALK AS THE ADMIN · PHONE', 'phone', { role: 'admin', who: 'Admin', devices: 'Phone only' }, [
      own(S.transferForm, 'You send a container from Warehouse 1 to Warehouse 2.'),
      own(S.inTransit, 'While it travels it is in transit — counted in neither warehouse, so it cannot be sold twice.'),
      own(S.transferReceived, 'At Warehouse 2 someone weighs it and confirms. It counts there from now on.'),
    ]),
];

/** Story order for the persona picker (the chapter `number` also sorts them). */
export const JOURNEY_IDS = JOURNEY_CHAPTERS.map((c) => c.id);
