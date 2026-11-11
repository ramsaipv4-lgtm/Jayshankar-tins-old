// lib/audit-viewer/tests/audit-viewer.test.ts
//
// The 3-case test suite for `lib/audit-viewer`:
//   1. happy-path: render with 100 rows, expect pagination
//   2. edge-case: empty array, expect empty message
//   3. error-case: diff with null before/after

import { describe, it, expect } from 'vitest';
import {
  applyFilter,
  paginate,
  diffRows,
  renderAuditViewer,
  AuditLogEntry,
} from '../index';

const now = '2026-08-15T10:00:00Z';
const earlier = '2026-08-14T10:00:00Z';

const sampleRows: AuditLogEntry[] = [
  {
    id: '1',
    at: now,
    userId: 'u-1',
    action: 'INSERT',
    tableName: 'Deal',
    rowId: 'd-1',
    before: null,
    after: { name: 'New deal', amount: '100.00' },
  },
  {
    id: '2',
    at: earlier,
    userId: 'u-2',
    action: 'UPDATE',
    tableName: 'Deal',
    rowId: 'd-1',
    before: { name: 'Old name', amount: '100.00' },
    after: { name: 'New name', amount: '100.00' },
  },
  {
    id: '3',
    at: now,
    userId: 'u-1',
    action: 'DELETE',
    tableName: 'Contact',
    rowId: 'c-1',
    before: { name: 'Alice' },
    after: null,
  },
];

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('audit-viewer — happy path', () => {
  it('paginate: returns the right page', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: String(i) } as any));
    const page1 = paginate(rows, 1, 20);
    const page5 = paginate(rows, 5, 20);
    expect(page1).toHaveLength(20);
    expect(page1[0].id).toBe('0');
    expect(page5[0].id).toBe('80');
    expect(page5).toHaveLength(20);
  });

  it('applyFilter: filters by userId', () => {
    const filtered = applyFilter(sampleRows, { userId: 'u-1' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.userId === 'u-1')).toBe(true);
  });

  it('applyFilter: filters by tableName', () => {
    const filtered = applyFilter(sampleRows, { tableName: 'Deal' });
    expect(filtered).toHaveLength(2);
  });

  it('applyFilter: filters by action', () => {
    const filtered = applyFilter(sampleRows, { action: 'UPDATE' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  it('diffRows: detects changed fields', () => {
    const diffs = diffRows(
      { name: 'Old name', amount: '100.00' },
      { name: 'New name', amount: '100.00' }
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('name');
    expect(diffs[0].before).toBe('Old name');
    expect(diffs[0].after).toBe('New name');
  });

  it('renderAuditViewer: paginates 100 rows into 2 pages', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      at: now,
      userId: 'u-1',
      action: 'INSERT' as const,
      tableName: 'Deal',
      rowId: `d-${i}`,
      before: null,
      after: {},
    }));
    const view = renderAuditViewer({ rows, pageSize: 50 });
    expect(view.totalRows).toBe(100);
    expect(view.totalPages).toBe(2);
    expect(view.rows).toHaveLength(50);
  });

  it('renderAuditViewer: computes diffs for UPDATE rows only', () => {
    const view = renderAuditViewer({ rows: sampleRows, pageSize: 50 });
    expect(view.diffs.has('2')).toBe(true);   // UPDATE row has a diff
    expect(view.diffs.has('1')).toBe(false);  // INSERT has no diff
    expect(view.diffs.has('3')).toBe(false);  // DELETE has no diff (or could, by design)
  });
});

// =============================================================================
// 2. EDGE-CASE: empty array
// =============================================================================

describe('audit-viewer — empty array', () => {
  it('renderAuditViewer: empty rows returns the empty message', () => {
    const view = renderAuditViewer({ rows: [], pageSize: 50 });
    expect(view.totalRows).toBe(0);
    expect(view.totalPages).toBe(1);
    expect(view.rows).toHaveLength(0);
    expect(view.emptyMessage).toBe('No audit entries yet.');
  });

  it('renderAuditViewer: respects custom emptyMessage', () => {
    const view = renderAuditViewer({
      rows: [],
      pageSize: 50,
      emptyMessage: 'No log entries for this tenant yet.',
    });
    expect(view.emptyMessage).toBe('No log entries for this tenant yet.');
  });

  it('paginate: empty array returns empty', () => {
    const result = paginate([], 1, 50);
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// 3. ERROR-CASE: null before/after
// =============================================================================

describe('audit-viewer — null before/after', () => {
  it('diffRows: both null returns empty array', () => {
    expect(diffRows(null, null)).toEqual([]);
  });

  it('diffRows: null before, non-null after (INSERT) returns all fields', () => {
    const diffs = diffRows(null, { name: 'Alice', email: 'a@b.c' });
    expect(diffs).toHaveLength(2);
    expect(diffs.map((d) => d.field).sort()).toEqual(['email', 'name']);
  });

  it('diffRows: non-null before, null after (DELETE) returns all fields', () => {
    const diffs = diffRows({ name: 'Alice' }, null);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('name');
    expect(diffs[0].after).toBeNull();
  });

  it('renderAuditViewer: UPDATE row with null before does not throw', () => {
    const rows: AuditLogEntry[] = [
      {
        id: '1',
        at: now,
        userId: 'u-1',
        action: 'UPDATE',
        tableName: 'Deal',
        rowId: 'd-1',
        before: null, // malformed: UPDATE should have before
        after: { name: 'X' },
      },
    ];
    expect(() => renderAuditViewer({ rows })).not.toThrow();
    const view = renderAuditViewer({ rows });
    expect(view.diffs.has('1')).toBe(false); // no diff because before is null
  });
});
