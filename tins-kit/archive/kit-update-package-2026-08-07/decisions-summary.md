# Jayshankar decisions summary — for kit-author context

> **A condensed 1-page-per-decision view of all 28 Jayshankar builder
> decisions.** Use this for a quick read; the full text is in
> `Jayshankar/BUILDER-DECISIONS-REVIEW.md` (~900 lines).

The **Kit-worthy?** column marks decisions that should be pulled forward
into tins-kit. The **Pulled forward as** column shows what each one
became in the kit-update package.

| # | Date | What it is | Kit-worthy? | Pulled forward as |
|---|---|---|---|---|
| 1 | 2026-08-05 | Removed the `BACKEND` ZS marker from SPEC.md (kit validator doesn't allow it) | No — kit-level | — |
| 2 | 2026-08-05 | Seed inserts users with `ON CONFLICT DO NOTHING`, not via the `handle_new_user` trigger | No — Jayshankar-specific | — |
| 3 | 2026-08-05 | `movements` idempotency is enforced by an idempotency guard, not by a unique constraint | No — schema design | — |
| 4 | 2026-08-05 | `record_transfer_cascade` uses `FOR UPDATE SKIP LOCKED` for race-condition safety | Already in pattern | (see supabase-auth-trigger + postgres-mutations) |
| 5–7 | 2026-08-05 | Other W1 decisions (audit trigger design, default privileges, etc.) | No — schema-level | — |
| 8 | 2026-08-06 | Drop the FK on `public.users.id`; integrity via trigger | Yes — already in kit | `supabase-auth-trigger.md` Lesson 1 |
| 9 | 2026-08-06 | Pulled forward the supabase-auth-trigger pattern from W5 to "now" | No — meta-decision | — |
| 10 | 2026-08-06 | `handle_new_user()` reads role + display_name from `NEW.raw_user_meta_data` | Yes — already in kit | `supabase-auth-trigger.md` Lesson 2 |
| 11 | 2026-08-06 | `service_role` needs explicit GRANTs on `public.*` | Yes — already in kit | `supabase-auth-trigger.md` Lesson 3 |
| 12 | 2026-08-06 | Pulled forward W2 templates (BUILDER-DECISIONS-REVIEW, REVIEWER-DECISIONS-REVIEW, TRAININGS) | No — meta-decision | — |
| 13 | 2026-08-06 | Phone OTP for workers deferred to Pilot; all 3 demo users on email/password | No — Jayshankar-specific | — |
| 14 | 2026-08-06 | Hand-written scaffold, not `npm create vite@latest` | No — too project-specific | — |
| 15 | 2026-08-06 | `react-router-dom` over wouter (more docs; SPEC allows either) | No — too project-specific | — |
| **16** | 2026-08-06 | **`authenticated` ALSO needs explicit GRANTs (the browser-side bug)** | **Yes** | **`supabase-auth-trigger.md` Lesson 4 (new)** |
| 17 | 2026-08-06 | Role drives the shell, not the URL (sign-out doesn't navigate) | No — Jayshankar-specific | — |
| 18 | 2026-08-06 | FIFO is application-level (TypeScript), single-batch fill | No — algorithm-specific | — |
| 19 | 2026-08-06 | No race-condition protection in W3 (deferred to Pilot) | Yes — partially | `postgres-mutations.md` Lesson 2 |
| 20 | 2026-08-06 | Native HTML inputs + React state, no react-hook-form | No — too project-specific | — |
| 21 | 2026-08-06 | SKUs column mismatch: `name` → `english_name` | No — schema-specific | — |
| 22 | 2026-08-06 | More column mismatches (`received_at` → `delivered_at`; `expires_at` computed in JS) | No — schema-specific | — |
| **23** | 2026-08-06 | **Transfer moved to SECURITY DEFINER function** | **Yes** | **`postgres-mutations.md` Lesson 1** |
| **24** | 2026-08-07 | **Stock aggregation is client-side for W4, view-based for Pilot** | **Yes** | **`client-side-aggregation.md` rubric** |
| 25 | 2026-08-07 | Audit log filter design: 3 filters, paginated 50/page | No — Jayshankar-specific | — |
| **26** | 2026-08-07 | **PWA config: vite-plugin-pwa in `generateSW` mode** | **Yes** | **`pwa-offline-graceful.md` recipe** |
| **27** | 2026-08-07 | **Offline detection: 3-layer pattern (hook + banner + form guard)** | **Yes** | **`pwa-offline-graceful.md` Lesson 1** |
| **28** | 2026-08-07 | **Empty-state design: 3-tier rubric (action / hint / message)** | **Yes** | **`empty-states.md` rubric** |
| 29 | 2026-08-07 | Netlify deploy: `netlify.toml` + Node 20 + hash-router SPA fallback | No — Jayshankar-specific | — |

**The 7 kit-worthy decisions** (16, 19, 23, 24, 26, 27, 28) became
**5 kit-side entries** (decisions 4–8 in `tins-kit/BUILDER-DECISIONS-REVIEW.md`).
The mapping is:

- Kit decision 4 = Jayshankar 19 + 23 (postgres-mutations)
- Kit decision 5 = Jayshankar 24 (client-side-aggregation)
- Kit decision 6 = Jayshankar 26 + 27 (pwa-offline-graceful)
- Kit decision 7 = Jayshankar 28 (empty-states)
- Kit decision 8 = Jayshankar 16 (Lesson 4 update to supabase-auth-trigger)
