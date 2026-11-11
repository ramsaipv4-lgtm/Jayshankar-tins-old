# Looker Studio setup — operator doc

> **D26: Google Looker Studio is the self-service reporting tool for this app — free, no new
> server, works on mobile through Looker Studio's own app/responsive reports.** Migration
> `0022_looker_studio_readonly_role.sql` creates the read-only database role this connects as;
> this doc covers the parts that can't be committed to git (the role's password) and the actual
> Looker Studio connection steps.

---

## 0. Pre-flight

Confirm migration `0022_looker_studio_readonly_role.sql` has been applied (Supabase Dashboard →
SQL Editor, same as every other migration in `supabase/migrations/`). It creates a Postgres role
called `looker_studio_readonly` with `SELECT`-only access to every table — no `INSERT`,
`UPDATE`, or `DELETE` — and one starter reporting view, `daily_sales_summary`.

## 1. Set the role's password (2 min)

The migration deliberately does **not** set a password — a real password can't safely live in a
committed SQL file (same rule as `.env`, the service-role key: rotate first, clean second, never
commit a secret). Set it once, directly in the SQL Editor:

```sql
alter role looker_studio_readonly with password 'choose-a-long-random-password-here';
```

Use a real password manager to generate this — it's a real database credential, treat it like
one. **Do not paste it into a chat with Claude, a commit message, or anywhere else that ends up
in git history.** Store it only in your password manager and in Looker Studio's own connection
form (step 3).

## 2. Find the direct Postgres connection details (2 min)

Supabase Dashboard → **Project Settings → Database → Connection info**. You need:

- **Host** (e.g. `db.<project-ref>.supabase.co`, or the pooler host if you're on the connection
  pooler — Looker Studio's native PostgreSQL connector works with either; the pooler is usually
  the better choice for a BI tool that opens/closes connections frequently)
- **Port** (`5432` direct, or `6543` for the transaction pooler)
- **Database name** (`postgres`)
- **User**: `looker_studio_readonly` (not the default `postgres` user — that's the whole point
  of this role)
- **Password**: whatever you set in step 1

If Supabase's dashboard doesn't show a plain "create a custom role" UI in your project's plan
tier, the role still works — it was created directly via SQL in migration 0022, which doesn't
require anything beyond normal SQL Editor access.

## 3. Connect Looker Studio (5 min)

1. Go to [lookerstudio.google.com](https://lookerstudio.google.com/) → **Create → Data source**.
2. Search for and select **PostgreSQL** (Google's own native connector — no add-on, no cost).
3. Fill in the host/port/database/user/password from step 2.
4. Looker Studio will list every table and view `looker_studio_readonly` can see (which is
   everything, per migration 0022's grants) — pick `daily_sales_summary` for a fast first chart,
   or any raw table (`sales`, `batches`, `movements`, `bills`) for something more granular.
5. Build a report as normal. Looker Studio reports are mobile-responsive by default and also
   have their own mobile app (Looker Studio app, iOS/Android) — this satisfies D26's "needs to
   work on the client's mobile device" requirement without any extra work on this project's own
   side.

## 4. What's a good first report

Not prescriptive — the wholesaler should drive this once real data exists — but a reasonable
starting set, all buildable directly from `daily_sales_summary` or the raw tables with zero
extra SQL:

- **Revenue trend** — `daily_sales_summary`, a time-series chart of `total_revenue` by
  `sale_date`.
- **Best-selling fish** — `daily_sales_summary`, a bar chart of `total_kg_sold` summed by
  `sku_name` over a date range.
- **Current stock levels** — the `batches` table, filtered to `kg_remaining > 0`, grouped by
  `sku_id`/`location_id`.
- **Vendor purchase volume** — the `bills` table, summed `total_amount` by `vendor_id`.

More sophisticated reports (margin, vendor reliability trends, customer credit aging) can layer
on `vendor_credit_status`/`customer_credit_status` (both already SELECT-able by this role) once
there's enough real transaction history for them to be meaningful.

## 5. Rotating the password later

If the password ever needs to change (suspected leak, routine rotation, an admin leaving), the
same `alter role` command from step 1 works again — Looker Studio's saved data source will need
its credentials updated to match (Looker Studio → the data source → Edit connection).

---

*See also: `supabase/migrations/0022_looker_studio_readonly_role.sql` (the actual grants),
`BUILDER-DECISIONS-REVIEW.md` decision #67 (why this role is `BYPASSRLS` rather than
RLS-policy-scoped), `docs/DEPLOY-NETLIFY.md` (the same "secrets never in git" discipline applied
to a different credential).*
