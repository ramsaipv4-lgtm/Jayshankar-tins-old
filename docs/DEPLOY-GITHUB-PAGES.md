# Deploy to GitHub Pages — operator doc

> **Deploying the *picture book* only?** Then you do not need anything in §2 of this doc — no
> secrets, no Supabase config, no app build. Run `npm run build:storybook` and publish
> `dist-storybook/`; the full instructions are in **docs/REVIEW-BUILD.md §7**. This doc is for
> putting the whole **app** on Pages, which is a different (and heavier) decision.

> **Verdict up front: it works, and the hardest part is already in your favour.** The app uses
> `HashRouter` (`src/main.tsx`), so Pages never has to rewrite URLs — no SPA fallback, no
> `404.html` trick. But read §1 before you push, because one item is a decision only you can make.

---

## 1. The two things that decide it

**a) Repo visibility — the real blocker.**
GitHub Pages will **not** serve a private repository on the free plan; Pages needs the repo public,
or a GitHub **Pro/Team** plan. This repo contains the client's application source, their schema,
their RLS policies and their business rules. Making it public is a decision about *their*
information, not a build detail.

If public is not acceptable, the same free deploy is available on **Netlify** (already configured
here: `netlify.toml`) and **Vercel** — both connect to private repos on their free tiers. That is
the only reason this doc says "consider Netlify instead"; it is not a technical limitation.

**b) The site itself is public.**
There is no password gate on either free tier — the URL is open and the sign-in form is the only
wall. That is fine for a *demo* deployment (seeded data, RLS on, and no real business records) and
not fine for pilot data. See docs/DECISIONS.md §7 on the Demo → Pilot → Production split.

---

## 2. Deploy it (10 min)

```bash
# 1. Push the repo to GitHub (there is no remote yet — `git remote -v` is empty)
git remote add origin git@github.com:<owner>/<repo>.git
git branch -M main
git push -u origin main
```

> The deploy workflow triggers on `main` (`.github/workflows/deploy-pages.yml`). If you want to
> publish from another branch, edit that one line.

```text
2. Repo → Settings → Pages → Source = "GitHub Actions"

3. Repo → Settings → Secrets and variables → Actions → add two secrets:
     VITE_SUPABASE_URL             = https://<project>.supabase.co
     VITE_SUPABASE_PUBLISHABLE_KEY = the "anon / public" key

4. Repo → Settings → Secrets and variables → Actions → Variables → `PAGES_BASE`
     Only needed if you serve from the ROOT (a <owner>.github.io repo, or a custom
     domain). Leave it unset for a normal project site.
```

The workflow builds with `VITE_BASE=/<repo>/` and publishes `dist/`. That base is not cosmetic:
Vite rewrites every asset URL in `index.html` with it, and the PWA manifest's `start_url`/`scope`
and the service worker's `navigateFallback` follow it (`vite.config.ts`). Without it, `index.html`
requests `/assets/index-*.js` — which does not exist under `/<repo>/` — and the client gets a white
page and blames the app.

**5. Tell Supabase about the new origin.** Supabase → Authentication → URL Configuration →

- **Site URL:** `https://<owner>.github.io/<repo>/`
- **Redirect URLs:** add `https://<owner>.github.io/<repo>/**`

Skip this and invite links and password resets bounce to `localhost`, because the redirect target
is validated against that list. The app's invite flow (`#/accept-invite`) depends on it.

---

## 3. What the URL looks like

```text
https://<owner>.github.io/<repo>/                   → sign-in
https://<owner>.github.io/<repo>/#/review           → the workflow picture book (public, no login)
https://<owner>.github.io/<repo>/#/admin            → admin dashboard (after sign-in)
```

Everything after `#` is client-side, which is exactly why Pages needs no server config.

---

## 4. Verify the first deploy

1. Open the URL in a private window → the **sign-in form** appears (not a white screen — if you get
   a white screen, the secrets are missing or misnamed; see §5).
2. `#/review` opens the storybook with no login. That proves the bundle, the base path and the
   router are all correct in one shot.
3. DevTools → Application → Service Workers → `activated and is running`. Then phone →
   "Add to Home Screen" → tapping the icon opens `/<repo>/`, not a 404.
4. Sign in as a seeded demo user and check the dashboard loads with data (proves the Supabase URL
   and key are right, and that RLS still permits reads).
5. Offline check: DevTools → Network → Offline → reload → the app shell should still paint and the
   "stale data — read only" banner should appear (the `NetworkFirst` caching from `vite.config.ts`).

---

## 5. When it breaks

| Symptom | Cause | Fix |
|---|---|---|
| White page, no sign-in form | Secrets missing or **misnamed** | The app reads `VITE_SUPABASE_PUBLISHABLE_KEY` and throws at startup. A successful build + white screen is almost always this. |
| White page, console 404s on `/assets/...` | `VITE_BASE` not set for a project site | Confirm the workflow passed `/​<repo>/` — check the build step's env in the Actions log. |
| Install-to-home-screen opens a 404 | `start_url`/`scope` predate the `base` change | They follow `base` since this change — verify `dist/manifest.webmanifest` says `/<repo>/`. |
| Invite email lands on localhost | Pages URL not in Supabase Redirect URLs | §2 step 5. |
| Deploy step refuses to run | Pages source is still "Deploy from a branch" | Settings → Pages → Source = "GitHub Actions". |

---

## 6. Trade-off, both options

| | GitHub Pages | Netlify (already configured) |
|---|---|---|
| Private repo on free tier | **No** — needs Pro/Team | Yes |
| Config already in repo | Adds a workflow + `base` (done) | `netlify.toml` — already there |
| Cost | Free | Free tier (100 GB/mo) |
| Rollback | Re-run an old workflow | One click, keeps every deploy |
| Env var setup | Actions secrets | Site settings UI |
| Custom domain + HTTPS | Yes | Yes |

Both work. Choose by §1a: if the repo must stay private, Netlify is less work and less exposure.
