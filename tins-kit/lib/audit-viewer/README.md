# `lib/audit-viewer` — kit code module

> **The read-only audit log table UI module.** Pure-TS types + a small render
> function (`renderAuditViewer`) + filter/paginate/diff helpers. The consumer's
> framework adapter layer (React / Vue / Svelte) wires it into a component.
>
> **Companion to:** `lib/patterns/append-only-audit-log.md` (the trigger + RLS
> side; this module is the consumer-facing reader). Source:
> `atal-incubation/incubos/src/components/AuditLogTable.tsx` (focused, ~100-line
> drop-in).

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/audit-viewer/ src/lib/audit-viewer/
# Then wire up the trigger:
cp tins-kit/templates/sql/audit-trigger.sql prisma/migrations/<n>_audit_trigger/migration.sql
```

---

## API

### `AuditLogEntry`

The type of a single audit log row. Matches the schema produced by
`templates/sql/audit-trigger.sql`:

```ts
interface AuditLogEntry {
  id: string;
  at: string; // ISO 8601 timestamp
  userId: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  rowId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
}
```

### `applyFilter(rows, filter)`

Filter an array of `AuditLogEntry` rows by user, table, action, or date range.

```ts
import { applyFilter } from '@/lib/audit-viewer';

const filtered = applyFilter(rows, {
  userId: 'u-123',
  tableName: 'Deal',
  since: new Date('2026-08-01'),
});
```

### `paginate(rows, page, pageSize)`

Slice an array by 1-indexed page number.

```ts
import { paginate } from '@/lib/audit-viewer';

const pageRows = paginate(filteredRows, currentPage, 50);
```

### `diffRows(before, after)`

Compute the field-level diff between two row snapshots. Returns a list of
`{ field, before, after }` for fields that changed. Useful for showing
"what actually changed" in the UI.

```ts
import { diffRows } from '@/lib/audit-viewer';

const diffs = diffRows(
  { name: 'Old name', amount: '100.00' },
  { name: 'New name', amount: '100.00' }
);
// → [{ field: 'name', before: 'Old name', after: 'New name' }]
```

### `renderAuditViewer(props)`

The main entry point. Returns a `AuditViewerRender` object that the
framework adapter layer can render.

```ts
import { renderAuditViewer } from '@/lib/audit-viewer';

const view = renderAuditViewer({
  rows: auditRows,
  filterControls: true,
  pageSize: 50,
  currentPage: 1,
});
// view.rows, view.totalRows, view.page, view.totalPages, view.diffs, ...
```

The framework adapter renders `view.rows` as a table, with `view.diffs` as
expandable rows showing what changed for `UPDATE` actions.

---

## The 3 rules

### 1. The audit log is read-only for everyone

The audit log is append-only. Even the SUPER_ADMIN role cannot UPDATE or
DELETE a row. The audit-viewer is a reader; it does not (and must not)
expose any mutation API.

### 2. Always filter by tenant in a multi-tenant consumer

In a multi-tenant consumer (`lib/tenant-rls/` adopted), the audit log is
also tenant-scoped. The consumer's API route that fetches `audit_log` rows
must wrap in `withTenantTx` and pass the session's `tenantId` to the
query. The audit-viewer does not enforce this — it's a pure-TS render
function, not an API route.

### 3. Paginate by default

A busy table can have 10,000+ rows. Always paginate (the `pageSize` prop
defaults to 50). The framework adapter should never render all rows at
once.

---

## When to extend

- **If the consumer adds a CSV export**: extend the module with a
  `toCsv(rows)` helper (use the same column order as the table).
- **If the consumer needs real-time updates**: wire a Server-Sent Events
  (SSE) stream to the API and re-render on each event. The render function
  is already pure, so a re-render is cheap.
- **If the consumer needs to filter by rowId**: extend `AuditFilter` with
  `rowId?: string` and update `applyFilter`.

---

## Tests

See `tests/audit-viewer.test.ts` for the 3-case test suite: happy-path
(render with 100 rows, expect pagination), edge-case (empty array, expect
empty message), error-case (diff with null before/after).

---

*— End of `lib/audit-viewer/README.md`. See also:
`lib/patterns/append-only-audit-log.md`, `templates/sql/audit-trigger.sql`.*
