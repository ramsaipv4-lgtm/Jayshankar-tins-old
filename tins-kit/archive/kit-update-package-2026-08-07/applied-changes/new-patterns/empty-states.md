# `empty-states` — kit pattern

> **A 3-tier rubric for empty states: action / hint / message.** A
> worked example of each, and the rule for which to use when.
> Self-contained.
>
> **Source:** Jayshankar decision 28. The "stock by SKU" empty state
> (no batches in the system yet), the "active vendors" empty state
> (vendor-rep can't create vendors), and the "audit log" empty state
> (a fresh DB) were the three cases that crystallised the rubric.

---

## 0. Why this exists

The naive answer to "the list is empty, what do I show?" is: a
generic "No items found" message. SPEC §3.7 says no — empty states
need:
- A clear message (what the user is looking at)
- A primary action button (if there's something the user can do)

The hard part is "if there's something the user can do." Three cases:

| Case | What's empty | What the user can do | What to show |
|---|---|---|---|
| 1 | A list the user can populate | Create the first item (transfer, sale, delivery, etc.) | Clear message + primary action button |
| 2 | A list of admin-managed data | Nothing — only the admin can fix it | Clear message + a hint pointing to the fix (config / SQL / doc link) |
| 3 | A read-only viewer's list (audit log, search results) | Nothing useful | Just the message. No button. |

The pattern is the 3-tier rubric and the visual treatment for each
tier. The treatment is small (5-10 lines of JSX) but the rubric is
easy to skip; without it, every empty state becomes a different
ad-hoc decision.

---

## 1. The 3 tiers, in detail

### Tier 1 — Action: the user can resolve the empty state

**Visual:** A short message + a single primary action button.

```tsx
{batches.length === 0 ? (
  <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
    <p className="text-slate-600 mb-4">No active batches on the floor.</p>
    <Link
      to="/floor/transfer"
      className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
    >
      + Transfer from storage
    </Link>
  </div>
) : (
  <BatchList batches={batches} />
)}
```

**Rule of thumb:** if the empty state is "because of something the user
can do in the next 5 seconds", it's a Tier 1. Examples: "no stock" →
"+ Receive a delivery"; "no customers" → "+ Add a customer"; "no
drafts" → "+ Start a new draft."

### Tier 2 — Hint: the empty state is a config issue

**Visual:** A short message + a hint card (no button, but a link or a
snippet that tells the user what to do *somewhere else*).

```tsx
{vendors.length === 0 ? (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
    <p className="text-amber-900 font-medium">No active vendors.</p>
    <p className="text-amber-800 text-sm mt-1">
      Run the seed in Supabase SQL Editor (the one-time setup):
      <code className="block mt-1 font-mono text-xs">
        psql -f supabase/seed.sql
      </code>
    </p>
  </div>
) : (
  <VendorList vendors={vendors} />
)}
```

**Rule of thumb:** if the empty state is "because the data hasn't been
set up yet" and the user (vendor-rep, worker) doesn't have permission
to set it up, it's a Tier 2. Examples: "no vendors" (admin seeds
them); "no locations" (admin sets them up); "no users" (admin invites
them). The hint points to the admin or the doc.

### Tier 3 — Message: read-only viewer, nothing to do

**Visual:** Just the message. No button, no hint. Friendly, not
accusatory.

```tsx
{auditRows.length === 0 ? (
  <p className="text-slate-500 text-sm">No activity yet. Mutations will appear here as they happen.</p>
) : (
  <AuditLogTable rows={auditRows} />
)}
```

**Rule of thumb:** if the page is a viewer (audit log, search results,
settings, profile) and the user came here to look at something, not
to do something, it's a Tier 3. Examples: "no search results"; "no
audit log entries yet"; "no notifications."

---

## 2. The rubric (the part to copy)

When you're about to write an empty state, ask:

1. **Is there something the user can do *right now* that resolves the
   empty state?** → **Tier 1.** Show a primary action button.
2. **Is the empty state because of a config / data issue the user
   can't fix?** → **Tier 2.** Show a hint pointing to the fix
   (admin, docs, etc.).
3. **Is the empty state on a viewer (read-only) surface?** → **Tier 3.**
   Show a friendly message, no action.

If you can't decide between 1 and 2, ask: "is the fix a button the
user could click *on this page*?" If yes, Tier 1. If no (because it
needs admin rights, a SQL query, a different tool), Tier 2.

If you can't decide between 2 and 3, ask: "would showing a hint feel
condescending?" If the user already knows the system has no data
yet (they just reset the DB, they just created the account), Tier 3
is the right call. The hint is for users who *might* not know.

---

## 3. Common mistakes to avoid

- **Tier 1 with the wrong action.** The button should resolve the
  empty state, not navigate to a dashboard. "No orders" → "+ Create
  an order", not "← Back to dashboard".
- **Tier 2 with a button.** The hint is text (or a link to docs), not
  a primary action. A button that says "Contact admin" is a Tier 2
  mistake — the user knows to contact the admin; the page should
  confirm that, not prompt.
- **Tier 3 with a hint.** If the user is staring at a blank audit
  log, telling them "you can run SQL to populate it" is a Tier 3
  mistake. The audit log is the *result* of mutations; you don't
  populate it directly.
- **The "Add a +1" anti-pattern.** Some pages add a "create" button
  on the empty state *just in case*. Don't. The button is a
  commitment; the user expects it to do something useful. If the
  user can't create the thing, the button is a lie.
- **Generic "No data" message.** Always name what the list is
  ("No active batches", not "No data"). The user knows what page
  they're on; the empty state should reinforce it.

---

## 4. The worked example (Jayshankar)

| Surface | Empty state | Tier | Why |
|---|---|---|---|
| Floor dashboard, "Active batches on the floor" | "+ Transfer from storage" button → `/#/floor/transfer` | Tier 1 | The worker can resolve "no active batches" in 30 seconds |
| Rep dashboard, "Active vendors" | Hint card pointing to `psql -f supabase/seed.sql` | Tier 2 | The vendor-rep can't create vendors (admin-only) |
| Floor dashboard, "Recent spoilage" | "No spoilage recorded in the last 7 days" message | Tier 3 | The user is on a dashboard; the empty list is a *result*, not an *input* |
| Audit log, "No entries" | "No activity yet. Mutations will appear here as they happen." | Tier 3 | A viewer page; nothing to do |
| Sign-in form, "No demo users" | N/A — there are always demo users | N/A | The page itself is the action |
| Form pages, "No matching SKUs" | "No active SKUs. Ask the admin to add one." | Tier 2 | The form needs an admin-managed list to populate |

---

## 5. When this changes (V2 upgrades)

- **"Contact us" or "report a problem" secondary button on Tier 2
  surfaces.** A stuck user has an escalation path. Optional polish.
- **Per-tier icons.** Add a small icon to each tier (a "+" for Tier
  1, an info-circle for Tier 2, a clock for Tier 3). Visual scan
  speed-up. Optional polish.
- **Empty state analytics.** Track which Tier 2 hints are seen most
  often. If "no vendors" appears 1000 times after a deploy, the
  seed didn't run; the operator should know.

---

## 6. Cross-references

- Jayshankar BUILDER-DECISIONS-REVIEW decision 28 — the rubric
  crystallised.
- Jayshankar `src/pages/FloorDashboard.tsx` — Tier 1 example.
- Jayshankar `src/pages/RepDashboard.tsx` — Tier 2 example.
- Jayshankar `src/pages/AuditLog.tsx` — Tier 3 example.
- Jayshankar SPEC §3.7 — the original "primary action button" mandate.
