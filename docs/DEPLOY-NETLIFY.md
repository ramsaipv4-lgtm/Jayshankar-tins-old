# Deploy to Netlify — operator doc

> **The 30-minute deploy from a clean laptop to a live URL.** Assumes the
> project is already pushed to a Git repo (GitHub, GitLab, or Bitbucket).
> If not, do that first — the rest of this doc assumes a remote is set.

---

## 0. Pre-flight (2 min)

```powershell
npm run build
# → dist/ should be created with: index.html, sw.js, workbox-*.js,
#   manifest.webmanifest, icon.svg, assets/index-*.{js,css}

Get-ChildItem dist/
# → expect: 7+ files including index.html and sw.js
```

The `npm run build` script runs `vite build` (no `tsc -b` — that was
dropped in W6 because the project uses a single `tsconfig.json` and
project references aren't needed for the demo). If you want a type
check, run `npm run typecheck` separately.

The `netlify.toml` at the repo root pins:
- Build command: `npm run build`
- Publish dir: `dist`
- Node version: 20
- SPA fallback: every URL → `/index.html` (for hash-router links that get
  stripped of their hash by link-previewers)

## 1. Get the 2 environment variables (1 min)

Open `scripts/.env.example` and copy the 2 Vite vars. If you don't have
them handy, find them in the Supabase dashboard:

- **VITE_SUPABASE_URL** — Supabase dashboard → Project Settings → API →
  Project URL (e.g. `https://rczzxabgilnxpvcyjero.supabase.co`)
- **VITE_SUPABASE_PUBLISHABLE_KEY** — same screen, **Project API keys → `anon` /
  `public`**. **NOT** the `service_role` key — the secret key bypasses
  RLS and would let any visitor read every audit log row. The validator
  enforces the split (the JS bundle only ever sees the publishable key; the
  secret key is server-only and lives in `scripts/.env` for the
  seed-auth-users script).

> **Spell the second name exactly.** `src/lib/supabase.ts` reads
> `VITE_SUPABASE_PUBLISHABLE_KEY` and throws at startup if it is absent, so naming it
> `VITE_SUPABASE_ANON_KEY` (the older name, still floating around in old notes) gives you a
> **successful build and a white screen**. Supabase's own label "anon / public" describes the key's
> role, not the variable name.

> **Why these are VITE_ prefixed.** Vite inlines `import.meta.env.VITE_*`
> at build time. The build is the only time the keys are baked into the
> JS bundle. Rotating a key requires a rebuild + redeploy.

## 2. Netlify UI — create the site (5 min)

1. Go to https://app.netlify.com/ → **Add new site** → **Import an
   existing project**
2. Pick the Git provider (GitHub / GitLab / Bitbucket) and authorize
3. Pick the Jayshankar repo
4. **Branch to deploy:** `main` (or `master` — whatever the default is)
5. **Build command:** Netlify will auto-detect from `netlify.toml`. If
   not, paste `npm run build`
6. **Publish directory:** Netlify will auto-detect `dist`. If not, paste
   `dist`
7. **Advanced → New variable** — add the 2 env vars from step 1
8. Click **Deploy site**

The first deploy takes ~2 minutes (clone + install + build + publish).
Watch the deploy log for any red. If you see `error TS6...: Cannot find
name 'Buffer'`, that's a missing `@types/node` — add it and re-deploy.

## 3. Smoke-test the live URL (5 min)

1. Netlify will give you a URL like `https://jayshankar-demo-abc123.netlify.app/`
2. Open it in an incognito window
3. **Expect:** the sign-in form. The PWA manifest loads. The service
   worker registers (DevTools → Application → Service Workers should
   show `activated and is running`).
4. Sign in as `admin@jayshankar.demo` / `DevPassword123!` (or whatever
   you overrode it to in the seed)
5. **Expect:** admin dashboard loads, stock by SKU shows ~25 rows,
   audit log link visible
6. Sign in as `rep@jayshankar.demo` → rep dashboard, vendors visible
7. Sign in as `worker@jayshankar.demo` → floor dashboard, active batches
8. **Try a mutation:** as the rep, record a sale of 5 kg. The audit
   log should pick up a new row within seconds.

## 4. Custom domain (optional, 5 min)

If the gatekeeper client wants a real domain (e.g. `demo.jayshankar.in`):

1. In Netlify → **Domain settings** → **Add custom domain**
2. Add the DNS records Netlify gives you to your registrar
3. Netlify auto-provisions a Let's Encrypt cert (free)
4. The site is now on HTTPS with the custom domain

> **Cost note:** free Netlify tier = 100 GB bandwidth / month, 300
> build minutes. Plenty for the demo. If the wholesaler wants longer
> sessions, upgrade to Pro ($12/mo).

## 5. Continuous deploys (auto)

After step 2, every push to the tracked branch auto-deploys. To disable:

- Netlify → **Site settings** → **Build & deploy** → **Stop auto
  publishing**

Or to deploy from a different branch (e.g. `release` for production,
`main` for staging): **Site settings** → **Build & deploy** → **Branch
deploys** → set the production branch.

## 6. Rollback (2 min)

If a deploy breaks something:

- Netlify → **Deploys** → click the last good deploy → **Publish
  deploy**

The new deploy is instant (Netlify keeps all old deploys). Useful for
the gatekeeper demo: if something fails 5 min before the meeting,
one-click revert.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Sign-in form is white / blank | Build succeeded but env vars missing (or misnamed) | Netlify → Site settings → Environment variables → set VITE_SUPABASE_URL and **VITE_SUPABASE_PUBLISHABLE_KEY** (exactly that name) → trigger a rebuild |
| "permission denied" on every query | Wrong key in env (service_role instead of anon, or vice-versa) | Double-check the Project API keys screen — anon starts with `eyJ...` and is labelled `anon` / `public` |
| Service worker is missing | Build didn't include `vite-plugin-pwa` | Check the build log for "PWA v1.3.0 mode: generateSW" — if missing, check `vite.config.ts` |
| Custom domain shows "not secure" | DNS not propagated yet | Wait 30 min. Cloudflare DNS is the fastest. |
| `npm install` fails on Node 14 | Netlify defaulted to old Node | Add `NODE_VERSION = "20"` to `netlify.toml` (already there) or Netlify env vars |
| Build succeeds but the site shows 404 | Wrong publish directory | Should be `dist`, not `dist/public` or `build` |

## 8. What's NOT in the deploy (V1 scope)

- **iOS install** — locked out per SPEC D13. The PWA works in iOS Safari
  but is not optimised. Add `apple-touch-icon-180x180.png` and a
  manifest entry in Mode B.
- **Custom backend** — the deploy is purely static + Supabase. No app
  server, no Express, no Node functions. SPEC §4.1 says this is the
  design; we don't pay for or maintain a server.
- **Analytics** — none wired. If the wholesaler wants page-view metrics,
  Mode B should add Plausible (privacy-friendly) or PostHog (more
  features, free tier). For V1, the audit log IS the analytics.
- **Email** — no transactional email configured. Sign-in is email +
  password only; no "forgot password" flow yet. Add Supabase's
  password-reset email template in Mode B.
- **Backups** — Supabase's free tier auto-snapshots daily. Production
  should add a nightly pg_dump to a private bucket.
