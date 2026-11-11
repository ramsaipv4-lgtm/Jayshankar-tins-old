# W5 manual verification checklist

> **The 10-minute smoke test for the W5 deliverable.** Tests PWA install
> (manifest + icon), the offline banner, mutation gating, and the empty-state
> polish from SPEC §3.7.

---

## Pre-flight (1 min)

```powershell
Set-Location 'C:\Users\user\Desktop\Jayshankar'
node scripts/validate.mjs
node --test scripts/selftest.mjs
# Both should be green (72/72 + 9/9)

npx vite build
# → should finish clean; dist/ has dist/manifest.webmanifest and dist/sw.js

npm run dev
# → http://localhost:5173
```

> **Why `npx vite build` instead of `npm run build`?** The package.json build
> script still runs `tsc -b` against the dropped `tsconfig.node.json` project
> reference. The build itself is fine via `vite build` directly. The
> `package.json` script is on the W6 cleanup list.

---

## W5 checks (~9 min)

### Check 1 — Manifest is valid (§8.7d prerequisite)

1. In DevTools → **Application** → **Manifest**
2. **Expect:**
   - App name: "Jayshankar — Fish Wholesale Inventory"
   - Short name: "Jayshankar"
   - Start URL: `/`
   - Scope: `/`
   - Display: `standalone`
   - Theme color: `#4f46e5`
   - Background color: `#f8fafc`
   - Icons: 1 entry (`icon.svg`, sizes `any`, type `image/svg+xml`, purpose `any maskable`)
3. No "errors" or "warnings" shown in the manifest panel
4. Click the icon URL — it loads the SVG (a white fish on an indigo rounded square)

> **Lint-level check:** the manifest passes Chrome's install criteria. If the
> icon were missing or the start_url were wrong, Chrome would show "Manifest
> is not valid" in red here.

### Check 2 — Service worker registers and caches the app shell (§8.7d)

1. In DevTools → **Application** → **Service Workers**
2. **Expect:**
   - A service worker is registered at scope `/`
   - Status: `activated and is running`
   - Source: `/sw.js` (or `/registerSW.js` — the vite-plugin-pwa generated name)
3. Click **Inspect** to open the SW console — should be no errors
4. In **Application** → **Cache Storage** → open the Workbox precache
5. **Expect:** the app shell is cached (index.html, JS chunks, CSS, icon.svg)
6. In **Application** → **Cache Storage** → open the `supabase-api` cache (after signing in)
7. **Expect:** at least one Supabase REST entry (any batch/SKU query you ran is cached)

> **If the SW is missing:** confirm `devOptions.enabled: true` is in `vite.config.ts`
> (it is) and hard-refresh the page once. The dev SW is only registered on a
> normal or hard refresh, not on soft reload.

### Check 3 — Offline banner appears (§8.7a)

1. Sign in as any role (admin/rep/worker)
2. Open DevTools → **Network** panel → set throttling to **Offline**
   (or, on a phone, toggle WiFi off)
3. **Expect within 5 seconds:**
   - An amber banner appears at the top of the page, just below the header
   - Text: "Offline — read only. Changes will be available when back online."
   - A warning icon (⚠️) on the left
4. The rest of the page is still visible — banners, badges, lists, etc.

> **What fires this:** the `online`/`offline` window events. Our
> `useOnlineStatus` hook listens to both, sets state, and the
> `<OfflineBanner>` re-renders. The Service Worker is the safety net for
> the app shell; the banner is the user signal.

### Check 4 — Mutation buttons are disabled (§8.7b)

1. While still offline, navigate to a form:
   - **Admin** → no direct mutation form on dashboard; use the **Vendor rep**
     path or sign in as vendor-rep
   - **Vendor rep** (`rep@jayshankar.demo`) → click **+ Record sale** (or
     **+ Record delivery** / **+ Record spoilage** / **+ Transfer**)
   - **Worker** (`worker@jayshankar.demo`) → click **+ Transfer** (or
     **+ Record spoilage**)
2. **Expect:**
   - The submit button is **disabled** (greyed out, not clickable)
   - The button label still shows the action (e.g. "Record sale") — we
     don't change the label, just the disabled state
   - If you try to submit anyway, the form's `onSubmit` returns early with
     an inline error: "You are offline. Reconnect to record changes."
3. All 4 forms (Delivery, Sale, Transfer, Spoilage) behave the same way

> **Why inline error + disabled, not just disabled?** Disabled buttons
> don't explain *why*. The inline error appears only if the user somehow
> gets past the disabled gate (e.g. via keyboard shortcut or browser
> extension).

### Check 5 — Network returns, banner clears, mutations re-enable (§8.7c)

1. Switch DevTools Network throttling back to **No throttling** (or toggle WiFi on)
2. **Expect within 5 seconds:**
   - The amber banner disappears
   - The mutation button on the open form is enabled again
   - You can now submit a mutation
3. Submit a small mutation (e.g. a 0.5 kg spoilage as the worker)
4. **Expect:** the mutation succeeds, the audit log gets a new row, and the form's success state appears

### Check 6 — PWA install banner appears (Android Chrome)

> **This check needs a phone or a phone-emulator. Skip on desktop Chrome.**
> The install banner doesn't fire on desktop by default.

1. On Android Chrome, open `http://<your-dev-host>:5173/` (use the LAN IP
   of your dev machine, e.g. `http://192.168.1.10:5173/`)
2. Wait ~3 seconds after page load
3. **Expect:** Chrome shows a small "Add Jayshankar to Home screen" banner at the bottom (or the install icon appears in the address bar)
4. Tap install → the app appears on the home screen with the fish icon and the name "Jayshankar"
5. Open the installed app → it launches in standalone mode (no address bar)
6. The fish icon should be the indigo fish on the launcher

> **If the install banner doesn't appear:** check the manifest panel in
> DevTools (Check 1). Common gotchas: missing icon, missing `start_url`,
> scope mismatch, or the page is served over plain HTTP without a valid
> manifest. All four are correct in the current build.

### Check 7 — Empty states have primary action buttons (SPEC §3.7)

1. **Floor dashboard, active-batches empty case** — easiest way to see this:
   temporarily flip every active batch to `kg_remaining = 0` in the SQL editor
   (`update batches set kg_remaining = 0 where active = true;`)
   then refresh the worker dashboard
2. **Expect:** in the "Active batches on the floor" section, when the list
   is empty, a single primary action button reads **"+ Transfer from
   storage"** linking to `/#/floor/transfer`
3. **Rep dashboard, no-vendors case** — flip every vendor to `active = false`,
   refresh the rep dashboard
4. **Expect:** in the "Active vendors" section, a hint card reads
   "Run the seed in Supabase SQL Editor (the one-time setup)…" — a hint,
   not a primary action, because the user (vendor rep) can't create vendors
5. **Recent activity empty case** — easier: open `/admin/audit-log` right
   after a fresh DB reset (no rows)
6. **Expect:** a "No activity yet" message. No primary action button
   (this is a viewer page, the user is on the dashboard; SPEC §3.7 says
   "if there is a next action the user can take" — there isn't one on a
   blank audit log)

> **What §3.7 actually says:** "Empty states must show a clear message and,
> where there is a next action the user can take, a primary action button
> that performs it." The key phrase is "where there is one." Recent
> activity / audit log don't get buttons; the form lists do.

### Check 8 — Service worker survives a hard reload (the real test)

1. With the page open and the SW active, hit **Ctrl+Shift+R** (hard reload)
2. **Expect:** the page loads in <500ms — this is the SW serving the
   cached app shell, faster than the dev server's first response
3. Sign in, browse to a dashboard, see real data
4. Now go offline (Network → Offline) and hard-reload
5. **Expect:** the page still loads (cached shell), the offline banner
   appears, the last-cached data is visible

> **Production note:** the dev-mode SW clears on every vite restart. In
> production (`npx vite build` + served from `dist/`), the SW is stable
> until you push a new build. The `registerType: 'autoUpdate'` setting
> means a new build auto-replaces the old SW on next page load.

---

## Done

If all 8 checks pass: **W5 is green.** Proceed to W6 (deploy to Netlify).

If any check fails: copy the failing step's error message (DevTools console,
the page itself, the manifest panel) and I'll debug.

---

## Known W5 limitations (deferred to Pilot / V2)

| Limitation | When it bites | What fixes it |
|---|---|---|
| **No offline write-queue** | Worker is in the cold room with no signal and needs to record a transfer. SPEC §2.14 + §9: explicitly out of V1 scope. The button is disabled and the inline error explains why. | V2: add an IndexedDB outbox, replay on reconnect, dedupe by `client_mutation_id`. The spec's upgrade path is in §9. |
| **No app icon for iOS / iPadOS** | iOS Safari doesn't accept SVG icons — it needs apple-touch-icon-180x180.png + apple-touch-icon-152x152.png. SPEC D13: iOS is locked out in V1, so this is acceptable. | Mode B: add the two PNGs (or convert the SVG with `resvg`) and add `<link rel="apple-touch-icon" …>` to `index.html`. |
| **Workbox cache uses 24h max-age for Supabase API** | Demo day, an admin wants to see a sale that just happened on another device. If 24h have passed since the last online read, the cache is stale. | Acceptable for V1: the 24h window is long enough for the demo. Mode B: per-resource `maxAgeSeconds` (e.g. 1h for batches, 5m for sales). |
| **No "you're back online" toast** | When the network returns, the banner just disappears. No positive confirmation. | Add a 3-second toast at the top: "Back online. Changes will save again." Optional polish, not blocking. |
| **No "install this app" prompt UI** | Chrome auto-shows the install banner on Android, but desktop users have to find the install icon in the address bar. | Add a custom "Install app" button bound to `beforeinstallprompt`. Mode B polish. |
| **i18n: only English banner** | Tamil/Hindi banner text is in §2.14 but not yet in the code. | Mode B: i18n pass on all user-visible strings. |
