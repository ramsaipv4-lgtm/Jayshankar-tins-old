# W3 manual verification checklist

> **The 8-minute smoke test for the W3 deliverable.** Tests the 4 mutation forms
> end-to-end. Run this after every change to `src/lib/mutations.ts`, after every
> schema change, and after every npm install.

---

## Pre-flight (1 min)

```powershell
Set-Location 'C:\Users\user\Desktop\Jayshankar'
node scripts/validate.mjs
node --test scripts/selftest.mjs
# Both should be green (71/71 + 9/9)

npm run dev
# → http://localhost:5173
```

## W3 checks (~7 min)

### Check 1 — Delivery (vendor-rep)

1. Sign in as `rep@jayshankar.demo`
2. On the rep dashboard, click **+ Delivery**
3. **Expect:** the delivery form, all selects populated (vendors/SKUs/locations)
4. Fill: vendor=Ganesan, SKU=any, location=Storage, kg=10, price=350, leave shelf life + notes empty
5. Click **Record delivery**
6. **Expect:** green success banner with the new batch id (first 8 chars)
7. Verify in Supabase Table Editor:
   - `batches` table → 1 new row, kg=kg_remaining=10, vendor_id=Ganesan, location_id=Storage
   - `movements` table → 1 new row, kind=delivery_in, to_location_id=Storage, kg=10

### Check 2 — Sale (vendor-rep) — FIFO cascade

1. Still signed in as rep
2. Click **+ Sale**
3. **Expect:** the sale form
4. Fill: SKU=the one you delivered above, location=Storage, customer=Walk-in, kg=3, price=600
5. Click **Record sale**
6. **Expect:** green success banner ("Sale ... recorded")
7. Verify in Supabase:
   - `sales` table → 1 new row, total_kg=3, total_amount=1800
   - `movements` table → 1 new row, kind=sale, from_location_id=Storage, sale_id=<new sale id>
   - `batches` table → that batch's kg_remaining went from 10 → **7** (the trigger handles it)

### Check 3 — Sale shortfall

1. Click **+ Sale** again
2. Fill: same SKU + location, kg=999 (more than the 7 kg available)
3. Click **Record sale**
4. **Expect:** green banner saying "Sale ... recorded (shortfall: 992.000 kg)" — the sale is recorded for the 7 kg available, not 999
5. Verify: `sales.total_kg=7`, `batches.kg_remaining=0`

### Check 4 — Transfer (worker or vendor-rep)

1. Sign out, sign in as `worker@jayshankar.demo`
2. On the floor dashboard, click **+ Transfer**
3. **Expect:** the transfer form, "To location" excludes the "From" location
4. First, we need stock. Run a delivery as rep (or use the seed) to put a batch in storage
5. Fill: SKU=anything with stock, From=Storage, To=Display, kg=5
6. Click **Record transfer**
7. **Expect:** green banner
8. Verify: a new batch at Display with kg=5; storage's kg_remaining went down by 5; 1 new transfer movement

### Check 5 — Spoilage (worker or vendor-rep)

1. Still as worker, click **+ Spoilage**
2. Fill: SKU, location=Display, kg=2, reason=Expired
3. Click **Record spoilage**
4. **Expect:** green banner
5. Verify: a new spoilage movement; the source batch's kg_remaining went down by 2

### Check 6 — Recent activity feed (all roles see it)

1. As worker: scroll to the bottom of the floor dashboard. **Expect:** a "Recent activity" table with the movements from checks 1-5
2. Sign out, sign in as rep. **Expect:** the rep dashboard has a "Recent activity" table
3. Sign out, sign in as admin. **Expect:** the admin dashboard has a "Recent activity" table

### Check 7 — Role gating (the Shell component from W2 decision 17)

1. Sign in as worker
2. Manually type `http://localhost:5173/#/deliver` in the URL bar
3. **Expect:** redirect to `/#/floor` (workers can't deliver, only vendor-reps can)
4. Manually type `http://localhost:5173/#/sell`
5. **Expect:** redirect to `/#/floor`
6. Sign in as rep, type `/#/spoil`
7. **Expect:** redirects to `/#/spoil` actually (reps CAN spoil per SPEC — both worker and rep can transfer/spoil)
8. Sign in as admin, type `/#/sell`
9. **Expect:** redirect to `/#/admin` (admin doesn't get the rep's mutation UI in W3; they see the activity feed instead)

### Check 8 — Audit log shows the mutations (admin only)

The `audit_log` SELECT is RLS-gated to admins. Workers and vendor-reps will get `data: []` (silent deny). Sign in as **Karthik (admin)** first.

1. Sign in as `admin@jayshankar.demo` / `DevPassword123!`
2. Go to `/#/admin` (or any page — the query is from DevTools)
3. In DevTools console:
   ```js
   const { data } = await window.__sb__.from('audit_log')
     .select('table_name, action, at')
     .order('at', { ascending: false })
     .limit(20);
   console.table(data);
   ```
4. **Expect:** rows for every W3 mutation. The audit trigger logs every INSERT on `batches` (the delivery + the transfer destination) and `movements` (4 movements: delivery_in, sale, sale-shortfall, transfer, spoilage). The transfer destination batch fires both a `batches` row AND a `movements` row.

**If you ran this as a worker and got `data: []`** — that's correct, not a bug. RLS denied the SELECT silently. Switch to Karthik to see the rows.

## Done

If all 8 checks pass: **W3 is green.** Proceed to W4 (admin dashboard polish + audit log UI) when ready.

If any check fails: copy the failing step's error message (browser console, Supabase table) and I'll debug.

---

## Known W3 limitations (deferred to Pilot mode)

| Limitation | When it bites | What fixes it |
|---|---|---|
| **Race-condition protection**: ✅ fixed for transfers (decision 23, migration 0005). The `record_transfer_cascade` SECURITY DEFINER function uses `SELECT ... FOR UPDATE` to serialise concurrent transfers of the same (sku, location). Still unfixed for sales and spoilage: two concurrent sales of the same (sku, location) might both pick the same oldest batch. | Two reps selling the same fish at the same moment, OR a worker recording spoilage while a rep records a sale. | A `record_sale_cascade` sibling function with the same `FOR UPDATE` pattern. W4 work item. |
| **No multi-batch cascade** for sales. A sale of 999 kg when each batch has 50 kg only fills the first batch. | A single large customer order spanning many batches. | Same Postgres function: loop through FIFO batches until the sale is filled, insert N movement rows. |
| **No optimistic UI updates** — the dashboard re-fetches after a successful insert. | A small UX lag (~100ms) after submit. | Add `qc.setQueryData` patches in onSuccess. W4 polish. |
| **No toast notifications** — inline success/error messages only. | Looking away from the form during submit. | Add a toast library. Pilot. |
| **No offline support** for mutations. | Worker's phone loses signal mid-form. | Offline write queue (SPEC §9, out of V1 scope). |
