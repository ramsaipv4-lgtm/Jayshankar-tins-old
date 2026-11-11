# W4 manual verification checklist

> **The 6-minute smoke test for the W4 deliverable.** Tests the admin dashboard
> polish (stock by SKU, low-stock alerts) and the audit log viewer.

---

## Pre-flight (1 min)

```powershell
Set-Location 'C:\Users\user\Desktop\Jayshankar'
node scripts/validate.mjs
node --test scripts/selftest.mjs
# Both should be green (72/72 + 9/9)

npm run dev
# → http://localhost:5173
```

## W4 checks (~5 min)

### Check 1 — Stock by SKU (admin)

1. Sign in as `admin@jayshankar.demo`
2. On the admin dashboard, scroll to the **Stock by SKU** section
3. **Expect:**
   - A table of ~25 SKUs (one row per active SKU)
   - Each row: SKU name + code, total kg, threshold, batch count, "by location" breakdown
   - Some rows are **highlighted amber** if their total kg is below the SKU's `low_stock_threshold_kg` (the seed sets most thresholds to 5.00 kg; some SKUs will be below)
   - Sorted: low-stock SKUs first, then by total kg ascending
   - If any SKUs are low-stock, an amber banner at the top of the section says "N SKUs below low-stock threshold"

### Check 2 — Sort + threshold consistency

1. Click any column header… actually we don't have header-click sort yet (decision 25 says default sort is "low-stock first, then by total kg asc")
2. Verify the order is stable across page refreshes (same order each time — this confirms the sort is deterministic)
3. Spot-check: pick a SKUs that's amber (low-stock). Verify the total kg is indeed less than the threshold shown

### Check 3 — Audit log viewer (admin only)

1. Click **"View audit log →"** in the top-right of the admin dashboard
2. **Expect:**
   - URL is `/#/admin/audit-log`
   - A filter row: Table dropdown (defaults to "All tables"), User dropdown, From date, To date
   - Below: a table of audit rows. The most recent rows are at the top.
   - Each row: When, Action (color-coded badge), Table, Row (first 8 chars of UUID), User (resolved to display name), Details (show/hide button)
3. Click **Show** on any row → the JSON of `before_json` and/or `after_json` expands in a `<pre>` block below
4. Click **Hide** → collapses back

### Check 4 — Audit log filters work

1. Set **Table** filter to `batches` → only batches rows show
2. Set **Table** filter back to "All tables" → all rows return
3. Set **User** filter to Karthik (admin) → only Karthik's mutations show
4. Set **From** date to today's date → only today's rows show
5. Click **Reset filters** → all filters clear, all rows return

### Check 5 — Audit log pagination

1. Scroll to the bottom of the audit log table
2. **Expect:** "Page 1 · showing N rows" and a "Next →" button (disabled if N < 50)
3. Click **Next →** → page 2 loads, "Previous ←" is now enabled
4. Click **Previous ←** → back to page 1
5. With ~20 audit rows from the seed + W3 mutations, the "Next →" button is disabled (only 1 page)

### Check 6 — Role gating on the audit log

1. Sign out, sign in as `rep@jayshankar.demo`
2. Manually type `http://localhost:5173/#/admin/audit-log` in the URL bar
3. **Expect:** redirect to `/#/rep` (the role-URL mismatch from decision 17 kicks in; vendor-reps don't get admin's audit log)
4. Sign in as `worker@jayshankar.demo` and try the same URL → redirect to `/#/floor`
5. Sign in as `admin@jayshankar.demo` and try `/#/admin/audit-log` → page loads normally

## Done

If all 6 checks pass: **W4 is green.** Proceed to W5 (PWA) and W6 (deploy) when ready.

If any check fails: copy the failing step's error message (browser console, the page itself) and I'll debug.

---

## Known W4 limitations (deferred to Pilot mode)

| Limitation | When it bites | What fixes it |
|---|---|---|
| **No header-click sort on the stock table** | Admin wants to sort by total kg desc, or by SKU name asc, or by batch count. | Add a `sortKey` + `sortDir` state, wire to `<th onClick>` handlers. |
| **Stock aggregation is client-side** | Demo has 130+ batches; Pilot at 13K+ batches across multiple stores: the JS-side sum would take >500ms. | Move to a Postgres view (`create view stock_by_sku as ...`) + index on `batches(sku_id) where kg_remaining > 0`. Decision 24. |
| **Audit log has no JSON pretty-print / diff view** | The admin wants to see exactly which fields changed in an UPDATE, not just the before/after blobs. | Add a "diff" panel: render `before_json` and `after_json` side-by-side, highlight changed keys. |
| **Audit log no CSV export** | The wholesaler wants to send the audit log to their accountant monthly. | Add an "Export CSV" button that hits a Postgres function returning CSV. |
