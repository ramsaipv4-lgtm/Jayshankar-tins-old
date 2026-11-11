// lib/audit-viewer/index.ts
//
// The "read-only audit log table" kit module. Pure-TS types + a small render
// function (the consumer's framework adapter layer wires it into React /
// SolidJS / Vue / Svelte).
//
// Source: atal-incubation (the full audit log table UI; this is the focused
// 1-page drop-in extracted from it). See lib/patterns/append-only-audit-log.md
// for the trigger and policy side; this module is the consumer-facing reader.

export interface AuditLogEntry {
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

export interface AuditViewerProps {
  rows: AuditLogEntry[];
  filterControls?: boolean; // show filter by user, table, date
  pageSize?: number; // default 50
  onPageChange?: (page: number) => void;
  currentPage?: number; // 1-indexed
  emptyMessage?: string; // default "No audit entries yet."
}

export interface AuditFilter {
  userId?: string;
  tableName?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  since?: Date;
  until?: Date;
}

export function applyFilter(
  rows: AuditLogEntry[],
  filter: AuditFilter
): AuditLogEntry[] {
  return rows.filter((row) => {
    if (filter.userId && row.userId !== filter.userId) return false;
    if (filter.tableName && row.tableName !== filter.tableName) return false;
    if (filter.action && row.action !== filter.action) return false;
    if (filter.since && new Date(row.at) < filter.since) return false;
    if (filter.until && new Date(row.at) > filter.until) return false;
    return true;
  });
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

/**
 * Compute the field-level diff between `before` and `after` rows.
 * Returns a list of { field, before, after } entries for fields that changed.
 * Useful for showing "what actually changed" in the UI.
 */
export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export function diffRows(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): FieldDiff[] {
  if (!before && !after) return [];
  const beforeKeys = before ? Object.keys(before) : [];
  const afterKeys = after ? Object.keys(after) : [];
  const allKeys = new Set([...beforeKeys, ...afterKeys]);
  const diffs: FieldDiff[] = [];
  for (const key of allKeys) {
    const b = before?.[key];
    const a = after?.[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push({ field: key, before: b, after: a });
    }
  }
  return diffs;
}

/**
 * The pure-TS render function. Returns a structured representation of the
 * audit viewer that any framework adapter can render. Consumers don't have to
 * use this — they can also just import the types + applyFilter + diffRows
 * and render their own way.
 */
export interface AuditViewerRender {
  rows: AuditLogEntry[]; // the (filtered, paginated) rows to display
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  diffs: Map<string, FieldDiff[]>; // row id -> field diffs (only for UPDATE)
  emptyMessage: string;
  filterControls: boolean;
}

export function renderAuditViewer(props: AuditViewerProps): AuditViewerRender {
  const pageSize = props.pageSize ?? 50;
  const page = props.currentPage ?? 1;
  const totalRows = props.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageRows = paginate(props.rows, page, pageSize);
  const diffs = new Map<string, FieldDiff[]>();
  for (const row of pageRows) {
    if (row.action === 'UPDATE' && row.before && row.after) {
      diffs.set(row.id, diffRows(row.before, row.after));
    }
  }
  return {
    rows: pageRows,
    totalRows,
    page,
    pageSize,
    totalPages,
    diffs,
    emptyMessage: props.emptyMessage ?? 'No audit entries yet.',
    filterControls: props.filterControls ?? true,
  };
}

export default {
  applyFilter,
  paginate,
  diffRows,
  renderAuditViewer,
};
