// lib/docs-guardian/tests/docs-guardian.test.ts
//
// The 3-case test suite for `lib/docs-guardian`:
//   1. happy-path: freshness check returns pass for fresh docs
//   2. edge-case: empty source refs returns all-pass
//   3. error-case: loadDocMap throws on malformed JSON

import { describe, it, expect } from 'vitest';
import {
  checkDocFreshness,
  countReferences,
  loadDocMap,
  DocMap,
} from '../index';

const validMap: DocMap = {
  'API routes': {
    docFiles: ['docs/api.md', 'README.md'],
    staleCheck: 'guardian',
  },
  'Prisma models': {
    docFiles: ['docs/schema.md'],
    staleCheck: 'guardian',
  },
  'Env vars': {
    docFiles: ['.env.example'],
    staleCheck: 'manual',
  },
};

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('docs-guardian — happy path', () => {
  it('checkDocFreshness: all areas pass when refs match', () => {
    const result = checkDocFreshness(
      { 'API routes': 5, 'Prisma models': 4, 'Env vars': 3 },
      { 'API routes': 5, 'Prisma models': 4, 'Env vars': 3 },
      validMap
    );
    expect(result.fail).toEqual([]);
    expect(result.warn).toEqual([]);
    expect(result.pass).toHaveLength(3);
  });

  it('checkDocFreshness: pass when doc has more refs than source (over-documented)', () => {
    const result = checkDocFreshness(
      { 'API routes': 2 },
      { 'API routes': 10 },
      validMap
    );
    expect(result.fail).toEqual([]);
    expect(result.warn).toEqual([]);
    expect(result.pass).toHaveLength(3);
  });

  it('countReferences: counts keyword matches case-insensitively', () => {
    const text = 'See /api/health for the liveness check, /api/auth/login for login.';
    const count = countReferences(['/api/health', '/api/auth/login', '/api/missing'], text);
    expect(count).toBe(2);
  });

  it('loadDocMap: parses a valid JSON object', () => {
    const json = {
      'API routes': { docFiles: ['docs/api.md'], staleCheck: 'guardian' },
    };
    const map = loadDocMap(json);
    expect(map['API routes']).toBeDefined();
    expect(map['API routes']?.docFiles).toEqual(['docs/api.md']);
  });
});

// =============================================================================
// 2. EDGE-CASE
// =============================================================================

describe('docs-guardian — edge case', () => {
  it('checkDocFreshness: empty source refs returns all-pass', () => {
    const result = checkDocFreshness({}, {}, validMap);
    expect(result.fail).toEqual([]);
    expect(result.pass).toHaveLength(3); // 3 areas, all pass
  });

  it('checkDocFreshness: skips areas not in the map', () => {
    const result = checkDocFreshness(
      { 'API routes': 5, 'Unknown area': 99 },
      { 'API routes': 5 },
      validMap
    );
    expect(result.fail).toEqual([]);
    expect(result.warn).toEqual([]);
  });

  it('loadDocMap: empty object is valid', () => {
    const map = loadDocMap({});
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('countReferences: empty keywords returns 0', () => {
    expect(countReferences([], 'any text')).toBe(0);
  });
});

// =============================================================================
// 3. ERROR-CASE
// =============================================================================

describe('docs-guardian — error case', () => {
  it('checkDocFreshness: source has refs but doc has 0 → fail', () => {
    const result = checkDocFreshness(
      { 'Env vars': 5 },
      { 'Env vars': 0 },
      validMap
    );
    expect(result.fail).toEqual(['Env vars: source has 5 reference(s) but doc has 0']);
  });

  it('checkDocFreshness: source has 5+ refs and doc has less than half → warn', () => {
    const result = checkDocFreshness(
      { 'API routes': 10 },
      { 'API routes': 4 },
      validMap
    );
    expect(result.warn).toEqual([
      'API routes: source has 10 reference(s) but doc has only 4 (looks thin)',
    ]);
  });

  it('loadDocMap: throws on non-object input', () => {
    expect(() => loadDocMap('not an object')).toThrow(/expected an object/);
    expect(() => loadDocMap(null)).toThrow(/expected an object/);
    expect(() => loadDocMap(42)).toThrow(/expected an object/);
  });

  it('loadDocMap: throws on empty docFiles', () => {
    expect(() =>
      loadDocMap({ 'API routes': { docFiles: [], staleCheck: 'guardian' } })
    ).toThrow(/must have a non-empty docFiles array/);
  });

  it('loadDocMap: throws on invalid staleCheck', () => {
    expect(() =>
      loadDocMap({ 'API routes': { docFiles: ['x.md'], staleCheck: 'sometimes' } })
    ).toThrow(/staleCheck must be 'manual' or 'guardian'/);
  });

  it('loadDocMap: silently skips unknown areas', () => {
    const json = {
      'API routes': { docFiles: ['x.md'], staleCheck: 'guardian' },
      'Unknown area': { docFiles: ['y.md'], staleCheck: 'guardian' },
    };
    const map = loadDocMap(json);
    expect(map['API routes']).toBeDefined();
    expect((map as any)['Unknown area']).toBeUndefined();
  });
});
