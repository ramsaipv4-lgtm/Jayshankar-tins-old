# W2 manual verification checklist

> **The 5-minute smoke test for the W2 deliverable.** Run this after every change
> to `src/`, after every Supabase change, and after every npm install.
> **Done when all 5 checks pass.**

---

## Pre-flight (1 min)

```powershell
Set-Location 'C:\Users\user\Desktop\Jayshankar'

# 1. Confirm the env vars are set
Test-Path .env
# If False, copy and fill:
Copy-Item .env.example .env
notepad .env
#   VITE_SUPABASE_URL=https://rczzxabgilnxpvcyjero.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key-from-dashboard>
# Save and close

# 2. Run the validators (the existing gate)
node scripts/validate.mjs
node --test scripts/selftest.mjs
# Both should be green (70/70 + 9/9)
```

## W2 checks (3 min)

```powershell
# 3. Start the dev server
npm run dev
# Opens http://localhost:5173
```

### Check 1 — Sign in as **admin** (Karthik)

1. Open http://localhost:5173
2. You should see the sign-in form (no flash of stale session)
3. Email: `admin@jayshankar.demo`
4. Password: `DevPassword123!` (or whatever you set with `SEED_ADMIN_PASSWORD`)
5. Click **Sign in**
6. **Expect:**
   - Layout header shows "Karthik (the wholesaler)" + `admin` role badge (indigo)
   - URL is `/#/admin`
   - Admin dashboard shows:
     - 4 stat cards: Batches (~130), Movements (150+), Sales (20+), Locations (3)
     - Vendors table: 6 rows (Ganesan, Kuppammal, Murugan, Palani, Ravi, Selvi)
     - SKUs table: 25 rows
   - No "permission denied" errors in the browser console (DevTools → Console)

### Check 2 — Sign in as **vendor-rep** (Anitha)

1. Click **Sign out** (top right)
2. Sign in with `rep@jayshankar.demo` / `DevPassword123!`
3. **Expect:**
   - Layout header shows "Anitha" + `Vendor rep` role badge (emerald)
   - URL is `/#/rep`
   - Rep dashboard shows vendors and SKUs (no stat cards, no audit log)
4. Try navigating to `http://localhost:5173/#/admin` manually
5. **Expect:** the URL **redirects to `/#/rep`** (not a "Not allowed" banner). The role drives the shell, not the URL. (BUILDER-DECISIONS-REVIEW decision 17 — W2 routing fix.)
6. Click **Sign out** again

### Check 3 — Sign in as **worker** (Suresh)

1. Sign in with `worker@jayshankar.demo` / `DevPassword123!`
2. **Expect:**
   - Layout header shows "Suresh" + `Worker` role badge (slate)
   - URL is `/#/floor`
   - Floor dashboard shows the active batches table (only batches with `kg_remaining > 0`)
   - Each row: SKU name + code, location, kg_remaining, expires_at
3. Click **Sign out**

### Check 4 — RLS row-level security (the important one)

While signed in as **worker** (Suresh), open DevTools → Console and run:

```js
// Try to read audit_log directly (worker should NOT have access per RLS policies)
const { data, error } = await window.__sb__.from('audit_log').select('*').limit(5);
console.log({ data, error });
// Expect: data is [] (or null), error is null (RLS denied silently)
// Or: error code PGRST116 (no rows visible)

// Try to UPDATE a batch directly (worker should NOT be able to mutate)
const { error: updateErr } = await window.__sb__.from('batches').update({ kg_remaining: 999 }).eq('id', 'any-id');
console.log({ updateErr });
// Expect: error with code 42501 or similar — RLS denied
```

If both queries fail (or return empty), **RLS is working**. W2 acceptance criteria met.

### Check 5 — Page refresh (session persistence)

1. While signed in as any user, hit **F5** (or Ctrl-R)
2. **Expect:** the page reloads, you stay signed in, you land back on the right role's home page
3. The sign-in form does NOT flash before the role shell renders

## Done

If all 5 checks pass: **W2 is green.** Proceed to W3 (mutations) when ready.

If any check fails: copy the error message (DevTools console, network tab) and the
failing step number, and I'll debug. Don't try to fix it yourself first — the
failing check tells us where the design is wrong.

---

## Common failures and what they mean

| Symptom | Cause | Fix |
|---|---|---|
| "Missing VITE_SUPABASE_URL..." in the browser console | `.env` not filled in | Copy `.env.example` → `.env` and paste the 2 values |
| Sign-in returns `Invalid login credentials` | Wrong password, OR the 3 demo users weren't seeded | Re-run `node scripts/seed-auth-users.mjs` |
| Sign-in succeeds but the page shows "no public.users row found" | The `handle_new_user` trigger isn't applied | Re-apply 0002 in the SQL Editor |
| URL is `/#/admin` but you see an amber "Not allowed" banner | You're signed in as a different role | Sign out and sign in with the right user |
| Stat cards show `…` forever | RLS denied the count query (worker shouldn't see all batches, only own-location) | This is expected for worker; check that the active-batches table renders (worker SHOULD see those) |
| Browser console shows 401 / 403 errors | The `publishable_key` is wrong | Re-copy from Dashboard → API Keys → Publishable key |
| Page reload (F5) signs you out | Session not persisted (shouldn't happen with current config) | Check that the browser allows localStorage for the dev origin |
