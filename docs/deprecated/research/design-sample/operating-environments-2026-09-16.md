# Operating environments — the brief for the design research

> **Date:** 2026-09-16.
> **Status:** Research ground-truth. The "why" that backs every shape choice in the variant mockups. Read before the variants folder.
> **Sources:** `client-qa/operational-reality-2026-09-10.md` (verbatim quotes from the developer), `scripts/seed-demo-showcase.mjs`, `supabase/seed.sql`, plus the user's correction this session ("no effort on your creative end, only restyled the existing screens").

This document is the answer to "what problem is this app actually solving, on a phone, in the field, in this specific business." If a mockup choice can't trace back to one of these paragraphs, the choice is decoration, not design.

---

## 0. The product is one thing

Jayshankar is **a single app used by four people who share a wholesale fish business**: the wholesaler (admin), his co-admin Jayshankar (admin, "inventory-focused day-to-day, can take over fully anytime"), his reps (buy from fishermen, sell to buyers, negotiate price by phone), his workers (haul fish to buyers in the field, scan and pack containers in the warehouse).

Operational reality doc §3 says, on the record, that "the real wholesaler doesn't experience his job as cleanly separated into admin/vendor-rep/worker silos — he's doing all three at once." D28 (SPEC §0.2) repeats it: one mobile app, single login, role-gated views. The mobile app is not a companion. It is the entire thing.

Everything else in this doc is downstream of that.

---

## 1. Where each role spends their day, and what the phone is *for*

### Wholesaler (admin) — at home, in his car, at a buyer's office
- **Where:** bedside at 6am, behind the wheel on the way to the warehouse, in a buyer's office negotiating a deal, on the loading dock between hauls.
- **Connectivity:** patchy. 2G on coastal roads, intermittent 3G/4G in cities, fine in shops with WiFi.
- **What he needs on the phone:** "What needs my attention right now." Specifically: a reverse-sale request he has to adjudicate, a credit customer over his limit (D33), a bill discrepancy from yesterday's receiving, a confirmation that the container Ravi just packed actually reached the buyer.
- **What he explicitly does not want on the phone:** negotiating prices the way his khata app broadcast them (D31). A dashboard full of action tiles to press. Charts.
- **Phone surface:** large text, dark mode preference (because 6am bedroom), one tap per item, "approve this and stop showing it to me" as a closed-ended action pattern.

### Jayshankar (co-admin) — at the warehouse, mostly
- **Where:** behind a counter, in the cold-room, in the loading area.
- **Connectivity:** warehouse WiFi when it works, otherwise the same 4G as everyone else.
- **What he needs:** everything the wholesaler needs, but day-to-day with stock visibility — what's expiring in 6 hours, what's been packed but not yet hauled, which of today's deliveries is missing a confirmation.
- **Phone surface:** the same "needs attention" pattern as the wholesaler's, but the items list looks different.

### Rep — at the buyer's *and* fisherman's locations, in their languages
- **Where:** on the back of a bike between two villages, sitting in Saravana Stores bargaining over 2kg of pomfret, standing at Royapuram fish landing waiting for Murugan to finish his catch.
- **Connectivity:** frequently *bad*. The rep is the second-most offline user.
- **What he needs:** record a sale in under 30 seconds (fish will rot, the buyer will leave, the ice will melt). Record a delivery he just took from the fisherman (right there at Royapuram, the bag is on the floor).
- **What he explicitly does not want:** typing 5 fields to record a single sale. Picking items from a list of 25 when he can read a QR sticker on the bag.
- **Phone surface:** *scan → 3 fields → submit*. That's the whole screen. No KPI tiles, no charts, no recent activity feed (offline-only, by definition).

### Worker — hauling to buyers, in the warehouse
- **Where:** on a bike with an ice chest of fish; in the cold-room picking containers; on the loading dock handing a box to a buyer.
- **Connectivity:** frequently worst. The worker is on the road, in the cold-room (WiFi dies in cold-rooms, this is a known thing), on the loading dock outside the warehouse.
- **What he needs:** confirm a container that Karthik (the vendor at Mahabalipuram — not to be confused with the wholesaler's Mode A persona, which uses the same name from `supabase/seed.sql`'s row 4) brought in 40kg of pomfret as just billed. Spot-check a container's weight against what's billed. Mark "this is for Saravana Stores, 3kg, off it goes."
- **Phone surface:** *big button per task*, "open the QR camera, scan, confirm the count, done." Offline-tolerant. Voice-confirmations when 3G doesn't reach the warehouse's WhatsApp gateway in time.

---

## 2. Reference set, narrowed to the operating environments

The previous pass captured Zoho/Vyapar/Unleashed/Sortly/inFlow/MarketMan — six inventory SaaS marketing sites. None of them are field tools. The honest ones for this app:

**For the worker** — what the *refrigerated-floor* person carries:
- **Toast KDS / Square KDS** — restaurant kitchen-display systems. Cooks standing in front of a screen, working in a hot/fast-paced environment, one tap per order, big text, status color, no scroll. Same operational posture as a warehouse worker in a cold room. Captured `phone-toast-kds.png` (the only useful one of the marketing-set; Onfleet/Bringg/ServiceTitan all fell into cookie walls and Cloudflare challenges).
- **Bringg / Onfleet driver apps** — last-mile delivery driver's view of a single job at a time, single primary tap. Pickup/dropoff shape maps cleanly to a fish container being hauled to a buyer.

**For the rep** — what the *back-of-bike* person carries:
- **Rappi / Dunzo partner apps** — gig worker in the field, scan-and-go, minimal data entry, one screen per pick. Dunzo was unreachable in this capture run; Rappi returns 404s from a non-India IP.
- **Dunzo / Toast pickup-flow UX** is the prior art; we don't need a screenshot to know the pattern: *scan the QR → what you're picking up → confirm*.

**For the admin / co-admin** — what the *bedroom / buyer's-office* person carries:
- **Linear** — dense, fast, deep-navy headings, the existing project reference.
- **Notion** — content-first, warm-cream section rhythm, the existing project reference.
- **Apple Reminders** — the closest native analog of "what needs my attention today." A list of items, each with a closed-ended action. No chrome. This is the shape admin should be, not "a dashboard."

---

## 3. Real numbers (from the seed)

These are not invented; they come from `scripts/seed-demo-showcase.mjs` and the base `supabase/seed.sql` (the canonical Mode A demo dataset):

**People:**
- Vendors: Murugan/Royapuram · Ravi/Kasimedu/"Sri Devi" · Selvam/Ennore · Karthik/Mahabalipuram/"Velmurugan" · Mani/Cuddalore · Ganesan/Pondicherry/"Lakshmi"
- Customers (showcase): Saravana Stores (₹50,000 limit, 14d credit, prefers "Pomfret, Seer fish") · Green Leaf Hotel (₹2,000 limit, 7d, will go over)
- Names like "Karthik" appear *both* as a vendor (Mahabalipuram) and as the historical Mode A admin persona — `seed.sql`'s vendor row 4 and the legacy dashboard username. Don't conflate.

**SKUs** (25, with Tamil names): Pomfret (வவ்வால்) · Seer fish (வஞ்சரம்) · Mackerel (கானாங்கெளுத்தி) · Sardine (மத்தி) · Tuna (சூரை) · Trevally (வவ்வல்) · Katla · Murrel · Anchovy · Prawns L/M/S (இறால்) · Crab · Squid · etc. Shelf life 8-48 hours. Ceiling for any of them, on a phone, is *we are losing money in hours*.

**Showcase scene (seed-demo-showcase):**
- Bill DEMO-001 from vendor[0] (Murugan in the script, since vendor[0] is the first by sort order — actually Ravi in current DB ordering once seed.sql is applied): 3 fish lines, 40kg + 25kg + 15kg = 80kg total, ~₹42,300 invoiced.
- Task `t1` ("Morning delivery") auto-completes when the bill is recorded.
- 1 container filled from that bill: `TC-DEMO-01-${RUN_ID}`, 20kg of prawns packed, ownership = vendor_provided (the box came with the delivery, the business doesn't own it).
- 1 sale drawn from the container: 12kg @ ₹380/kg = ₹4,560 to Saravana Stores.
- 1 repack: the now-mostly-empty first container → a smaller second container `TC-DEMO-02-${RUN_ID}`. (A repack destination container is empty only because the first sale drained the fill — D50's container-reuse class).
- 2 more sales: 4kg @ ₹560/kg = ₹2,240 to Saravana Stores (partial payment: 60% paid, balance due next visit); 6kg @ ₹500/kg = ₹3,000 to Green Leaf Hotel (over their ₹2,000 limit → triggers `customer_over_limit` notification).
- 1 reversal (5kg Squid sale to Saravana, then full reversal, kg restored to original batch — verified live that `batches.kg_remaining` actually increases).
- 1 vendor payment: ₹1,250 to Ganesan via UPI, ₹750 remaining for the week.
- 1 in-transit delivery confirmation with a *deliberate* discrepancy: Mackerel billed at 12kg from Selvam, delivered at 11.5kg (0.5kg short) → `receiving_confirmations` records both, `delivery_discrepancy` notification fires.

**That is what the variant mockups depict.** Not "₹34,200 today's sales" or "12 lines on the bill" (those were the previous pass's made-up numbers) — but the *real* DEMO-001 demonstration flow when the warehouse is seeded for a client demo.

---

## 4. The four patterns the previous pass did not try (and each direction picks two)

Each direction's two surfaces below are picked because they exercise the role's *real environment*, not the role's *current dashboard*. Three variants × two surfaces = six mockups, no restyling of a "rep dashboard" or "pack form."

| Pattern | What it solves | Mockup # |
|---|---|---|
| **Floor pick-list** (worker) | "Which container goes to which buyer today, scan it and go." Big-tile, one-tap, no chrome. Toast-KDS aesthetic. | A1, B1, C1 |
| **Field sale entry** (rep) | "Sold 3.5kg of pomfret to Saravana at ₹380/kg." Three fields, single submit, voice-friendly. Rappi/Dunzo-pickup shape. | A2, B2, C2 |
| **Admin attention list** (admin, skipped — would be too expensive, *focused paper* on these two) | "What needs my attention right now." Apple-Reminders shape. Not built. | n/a |
| **Worker offline-pending state** (worker, any direction) | "This tap is queued, will sync when 3G returns." Was D30, was §2.14, was never designed. Folded into A1/B1/C1 below as the persistent banner under each pick-list. | inside A1, B1, C1 |

Two directions × two surfaces is the rule for one session. The admin-attention-list and the standalone offline-pending surface are real follow-ups after the user picks a direction — they didn't get designed in this pass because they belong to the *implementation* of the chosen direction, not to its *demonstration* that A is better than B or B is better than C.

---

## 5. What each direction's two mockups will prove about the choice

| Direction | Surface 1 (Phone) | Surface 2 (Phone) | The design call it makes |
|---|---|---|---|
| **A — KDS + Voice** | Floor pick-list. Big colored status cards per container. Bottom CTA is "Mark this handed to buyer." | Field sale entry. Free-text voice-friendly inputs. *No* picker for SKU — rep types fish name or scans QR. | A bets that the floor and the bike are the two critical surfaces, and the right answer for both is **light mode + chunky readable rows + voice/scan primitives over typed pickers**. Closest to Toast KDS. |
| **B — Apple-Reminders-shaped list + Bottom-sheet forms** | Floor pick-list. Single-task-at-a-time hero ("Next: hand TC-DEMO-01 to Saravana, 3kg"). One primary bottom button. | Field sale entry. Bottom-sheet modal over the current sale state. | B bets that the **single-task focus is the right shape**, and that mobile-app-style bottom-sheets are what the Jayshankar client actually wants (closest to native iOS/Android). Light mode. |
| **C — Dark + Linear + Tabular densities** | Floor pick-list. Mono-spaced IDs (`TC-DEMO-01-1707000`), tabular numerals (₹580 vs ₹580.00 vs ₹ 580.50), dark surface. | Field sale entry. Keypad-first, calculator-style number entry, dark. | C bets that the **worker and the rep both work in conditions where dark + high-contrast + tabular numerals reduce input error**, and that the admin/co-admin screens should *also* be available in dark. Most "designed for the operator" direction of the three. |

What they share, intentionally — and what each one deliberately doesn't:

- **All three use the same real seed names and numbers**, not invented ones. Saravana Stores, Murugan, Karthik@Mahabalipuram, ₹380, TC-DEMO-01-1707000000000, 4.5 kg, 14d credit. The data is the same; the *shape* of how it's presented differs.
- **All three keep Tailwind tokens visible to the human eye.** No `display:none` magic, no "settings panel" for what should be obvious.
- **All three are designed against the worker-on-the-floor case, not the admin-in-the-bedroom case.** That is the actual hard problem this app has. The admin case is fine; the floor case is what the client can't use.
- **No bottom-tab nav across any of them.** That was a default in the previous pass because SaaS marketing pages do it. None of the three field-tooling references I tried to capture uses it. Pick-list apps have *one current task*, not a chrome of tabs to tap between. (Salesforce Field Service does not have bottom tabs in its worker app. Toast KDS does not. Linear-style app for the floor is wrong.) All three mockups are full-screen single-task interfaces — what designers call "hero apps."
- **No nav header at all on the floor case.** Phone status bar → the content → bottom CTA. The header takes 56px that a worker doesn't have when scanning a QR. The header comes back *only* on the admin/desktop surfaces, which the admin surfaces are not the focus of this mockup.
- **Different interaction model per direction is what makes them differ.** Not different colors. A is "swipe between cards" (Toast style); B is "single hero card with primary action" (Apple Reminders style); C is "split view: list of pending at top, detailed form below" (Linear mobile style). Each is a different *answer* to the question of what to do at 6:15am in a fish warehouse with a wet glove.

---

## 6. Skip these (the previous pass's leftovers)

- A bottom-tab nav across all three, just in different palettes — was wrong because the bottom-tab pattern itself isn't appropriate for the floor case.
- A 10-tile action grid for the rep — was wrong because the rep role is *never on the floor walking around with 30 seconds to tap something*. The rep is at a buyer's desk recording a sale. The right shape is *one open sale at a time*, not a grid of 10.
- A `text-slate-400` vs `text-slate-500` color swap across all three — was wrong because the contrast difference was unmeasurable in real eye-time; that whole class of "twiddle the palette" doesn't earn its writeup.

---

## 7. Pointer to the variants

`docs/design-sample/variants-real/` — open the phone renders. They'll look different from the earlier `docs/design-sample/variants/` redraws, deliberately.

PNG screenshots are at `docs/design-sample/variants-real/screenshots/`.
