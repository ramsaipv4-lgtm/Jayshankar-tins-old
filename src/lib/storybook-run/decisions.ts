// The thirteen decisions this deck draws, D63–D76, paraphrased from SPEC-AMENDMENT-v3-truckload.md and
// SPEC-AMENDMENT-v4-plan-md.md (the amendments are the source; where a line here and an amendment disagree,
// the amendment wins). `build` states are taken from the v3 "Status check, 2026-10-02" table and v4 §5/§6 —
// not from this deck's author's opinion — because the most useful thing a review deck can say about a feature
// is whether it is real yet.

import type { BuildState, Decision } from './types';

export const BUILD_LABEL: Record<BuildState, { label: string; tone: 'kelp' | 'sun' | 'coral' | 'sea' | 'ink' }> = {
  unbuilt: { label: 'Not built', tone: 'coral' },
  different: { label: 'Built differently in Phase B', tone: 'sun' },
  matches: { label: 'Matches Phase B', tone: 'kelp' },
  rule: { label: 'Already the repo\'s rule', tone: 'kelp' },
  principle: { label: 'Principle — no screen of its own', tone: 'sea' },
  open: { label: 'Open question', tone: 'sun' },
  none: { label: 'Not a screen', tone: 'ink' },
};

export const DECISIONS: Record<string, Decision> = {
  D63: {
    id: 'D63', from: 'v3', status: 'LOCKED', act: 'modes',
    title: 'Two ways to buy, one switch',
    line: 'A warehouse buys either the "vendor" way (today) or the "truck" way (consolidated), chosen by an admin toggle per warehouse. Both coexist permanently — not a migration path. Default is vendor, so nothing changes until an admin flips it.',
    build: 'unbuilt',
    buildNote: 'No migration: `procurement_mode` has 0 hits in all 46. Phase B instead keeps the legacy bill path beside the new PR → RCV path ("two receiving paths").',
    criteria: ['§8.18a Default is "vendor"; a warehouse that never flips it behaves exactly as today.', '§8.18b Only admin / co-admin can change it.'],
  },
  D64: {
    id: 'D64', from: 'v3', status: 'LOCKED', act: 'road',
    title: 'The truck load sits above the bills',
    line: 'One `truck_loads` row per trip; each vendor purchase on the trip is still its own ordinary bill, tagged to the load. Weighted-average landed cost is derived on read (never stored) using the same average the transfer cascade already uses.',
    build: 'different',
    buildNote: 'Phase B built `procurement` (one supplier lot, PR-…) plus `truck_loads` (one arrival, RCV-…, dispatched → received | cancelled) — a different shape, with no `bills.truck_load_id`. Weighted-average cost and "money stays the promised amount" are implemented (DECISIONS #36).',
    criteria: ['§8.19a A bill\'s truck_load_id always points at a load in the same warehouse.', '§8.19b Landed cost = Σ(price × kg) ÷ Σ kg over exactly the load\'s bills — no more, no fewer.'],
  },
  D65: {
    id: 'D65', from: 'v3', status: 'LOCKED', act: 'scale',
    title: 'The person at the scale cannot see who or how much',
    line: 'A new role, `receiving-storage`, weighs and stores the fish. The receiving function\'s return shape omits vendor identity and price for that role — the guarantee lives in what the function can return, not in what the screen hides. `vendor-rep` is narrowed to procurement only. Admin keeps full visibility.',
    build: 'different',
    buildNote: 'No sixth role was built. Phase B enforces blindness with a flag (`users.receiving_blind` on vendor-rep / super-worker; worker always blind) behind `app_settings.enforce_blind_receiving`, which ships off. Which design wins is the owner\'s call (HANDOVER W12).',
    criteria: ['§8.20a A receiving-storage call never gets vendor identity or price, under any input.', '§8.20b A vendor-rep call to the receiving function is rejected.', '§8.20c An admin / co-admin call does get the full vendor breakdown.'],
  },
  D66: {
    id: 'D66', from: 'v3', status: 'LOCKED', act: 'plan',
    title: 'Plan the trip — or don\'t',
    line: 'An optional `procurement_trip` task (built on the existing task system) can carry a vehicle number and pre-creates a planned truck load. Which vendors to visit is never part of the plan. Ad-hoc procurement with no task stays fully supported. The task completes itself when its load completes.',
    build: 'unbuilt',
    buildNote: 'Nothing: `procurement_trip` has 0 hits in the migrations.',
    criteria: ['§8.21a A trip task with no vendor information is creatable and completable end to end.', '§8.21b Ad-hoc procurement under truck mode with no task remains fully functional.'],
  },
  D67: {
    id: 'D67', from: 'v4', status: 'OPEN', act: 'look',
    title: 'Which look? The client chooses by looking',
    line: 'The UI\'s design language is the client\'s decision, made by comparing decks rather than by argument. Deck 1 is the shipped Tailwind look, deck 2 is Ant Design 6, and this deck is a third, freer take. Ant Design stays a dependency of a review build only until this row is answered.',
    build: 'open',
    buildNote: 'The client was unreachable on schedule as of 2026-09-29; both earlier decks are built so the question can be answered from links.',
    criteria: [],
  },
  D68: {
    id: 'D68', from: 'v4', status: 'LOCKED', act: 'scale',
    title: 'Blind receiving in today\'s per-vendor flow too',
    line: 'The same principle applied to the existing flow: the receiving function\'s own return shape omits vendor and rate for a receiving caller, so a UI bug cannot leak them. It ships with the switch OFF — switch-off behaviour is exactly today\'s, because at current volumes one person does both jobs.',
    build: 'matches',
    buildNote: 'Matches Phase B (migrations 0037 / 0038, DECISIONS #34 / #37): a flag, shipped off.',
    criteria: [],
  },
  D69: {
    id: 'D69', from: 'v4', status: 'LOCKED', act: 'road',
    title: 'Offline capture is a queued commitment',
    line: 'A vendor rep in a basement with no signal should not lose the entry. Procurement lines buffer in a local write-queue and replay in order on reconnect — extending D6\'s queue rather than inventing a second one. It needs conflict rules (the same bill edited on both sides), and those are decisions, not implementation.',
    build: 'unbuilt',
    buildNote: 'Queued, deliberately not bundled with the Phase B wiring. Conflict rules are undecided — the conflict screen in this deck is a proposal, labelled as one.',
    criteria: [],
  },
  D70: {
    id: 'D70', from: 'v4', status: 'LOCKED', act: 'stamps',
    title: 'Approvals belong to the document',
    line: 'A bill, a truck load or a reversal carries its own approval state — not the user\'s, not the phase\'s — so a rejected line cannot be resubmitted as though it were new. The shape to copy is `reversal_requests`: its own table, its own status machine, a reviewer who is not the requester.',
    build: 'unbuilt',
    buildNote: 'No approval mechanism exists in this repo today; no row in D1–D62 covers it. A new concept, not a clarification.',
    criteria: [],
  },
  D71: {
    id: 'D71', from: 'v4', status: 'LOCKED', act: 'who',
    title: 'Enforce by default; warn only on purpose',
    line: 'The system enforces the workflow; where it deliberately cannot, it says so out loud. Warn-only is an explicit exception argued case by case — credit terms (D33) are today\'s only one, because refusing a sale is a business call the wholesaler keeps for himself.',
    build: 'principle',
    buildNote: 'The principle behind D68; reconciled against D33 (credit terms warn, never block).',
    criteria: [],
  },
  D72: {
    id: 'D72', from: 'v4', status: 'LOCKED', act: 'who',
    title: 'There is no sixth role',
    line: '`users.role` stays five roles; the procurement/receiving/owner vocabulary describes those five. v3\'s `receiving-storage` is recorded as the one sanctioned exception, not the start of a trend — any further role needs its own row and argument.',
    build: 'rule',
    buildNote: 'Phase B matches "no sixth role" — which is exactly where v3\'s D65 and v4\'s D72 pull apart (HANDOVER W12).',
    criteria: [],
  },
  D73: {
    id: 'D73', from: 'v4', status: 'LOCKED', act: 'who',
    title: 'Functions are closed by default',
    line: 'A new database function ships with no grants. A role gains access only through an explicit migration line, so "who can do this?" is answered by reading the migrations, not by probing the running app. This is the mechanism that makes D68 enforceable rather than aspirational.',
    build: 'rule',
    buildNote: 'The repo\'s rule (DECISIONS #40), written into the staged Phase B migrations — `0046` closes a real hole and is not yet applied live.',
    criteria: [],
  },
  D74: {
    id: 'D74', from: 'v4', status: 'LOCKED', act: 'look',
    title: 'The storybook is the visual specification',
    line: 'The procurement-desk chapters are the visual spec: the desk is built to match them, and a deviation found in review is a defect, not a preference. A reviewer points at a chapter instead of describing a screen — which is why every beat in this deck has a copyable link.',
    build: 'principle',
    buildNote: 'This is why deck fidelity matters: a comparison deck whose figures drift is no longer comparable.',
    criteria: [],
  },
  D75: {
    id: 'D75', from: 'v4', status: 'LOCKED', act: 'money',
    title: 'Money stays at the promised amount; stock follows the scale',
    line: 'On a truck load the weight may turn out different and stock follows the scale — but the amount owed does not silently follow the corrected weight. Landed cost is a derived figure and is not the amount owed. Two numbers describe the same load, and they are allowed to differ.',
    build: 'matches',
    buildNote: 'Implemented in Phase B (DECISIONS #36).',
    criteria: [],
  },
  D76: {
    id: 'D76', from: 'v4', status: 'LOCKED',
    title: 'The fish app stays a standalone product',
    line: 'The IGNOU final-year project does not become its umbrella: separate repository, decision log and deployment, so an academic deadline can never gate a client delivery.',
    build: 'none',
    buildNote: 'A product boundary, not a screen — listed here so the set D63–D76 is complete.',
    criteria: [],
  },
};

export const DECISION_ORDER = ['D63', 'D64', 'D65', 'D66', 'D67', 'D68', 'D69', 'D70', 'D71', 'D72', 'D73', 'D74', 'D75', 'D76'];
