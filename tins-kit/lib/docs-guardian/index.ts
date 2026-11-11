// lib/docs-guardian/index.ts
//
// The "self-maintaining docs" kit module. Pure-TS types + the canonical
// `loadDocMap` + `checkDocFreshness` functions. The consumer's CLI script
// (`scripts/docs-guardian.mjs`) wraps this with a filesystem scan.
//
// Source: atal-incubation/incubos/docs/DOC-MAP.md + scripts/docs-guardian.mjs
// (the canonical implementation, focused).

export type DocArea =
  | 'API routes'
  | 'Prisma models'
  | 'Env vars'
  | 'UI pages'
  | 'Cron jobs'
  | 'SQL migrations'
  | 'Lib modules'
  | 'Prompts'
  | 'Schemas'
  | 'Templates'
  | 'Scripts'
  | 'Patterns'
  | 'Docs';

export const ALL_DOC_AREAS: DocArea[] = [
  'API routes',
  'Prisma models',
  'Env vars',
  'UI pages',
  'Cron jobs',
  'SQL migrations',
  'Lib modules',
  'Prompts',
  'Schemas',
  'Templates',
  'Scripts',
  'Patterns',
  'Docs',
];

export interface DocMapEntry {
  /** The doc files that must mention this area. */
  docFiles: string[];
  /** How to check staleness. */
  staleCheck: 'manual' | 'guardian';
  /** Optional: the keywords that, if found in any of the docFiles, mark it as fresh. */
  freshKeywords?: string[];
  /** Optional: the source files (globs) that the guardian should scan for references. */
  sourceGlobs?: string[];
}

export type DocMap = Partial<Record<DocArea, DocMapEntry>>;

export interface DocFreshnessResult {
  pass: string[];  // doc-file / area pairs that are fresh
  warn: string[];  // pairs that might be stale (no fresh keywords found)
  fail: string[];  // pairs that are definitely stale (source has more references than doc)
}

/**
 * Check the freshness of a set of doc files against the source code's
 * references. Pure function — the consumer's CLI script handles the
 * filesystem I/O.
 *
 *   sourceRefs: { [area]: number } — how many references the source has
 *   docRefs:    { [area]: number } — how many references the doc has
 *   docMap:     the consumer's mapping (which doc files must mention which areas)
 *
 *   Rule:
 *     - If sourceRefs[area] > 0 and docRefs[area] === 0: FAIL (doc missing)
 *     - If sourceRefs[area] > 5 and docRefs[area] < sourceRefs[area] / 2: WARN (doc thin)
 *     - Otherwise: PASS
 */
export function checkDocFreshness(
  sourceRefs: Record<string, number>,
  docRefs: Record<string, number>,
  docMap: DocMap
): DocFreshnessResult {
  const pass: string[] = [];
  const warn: string[] = [];
  const fail: string[] = [];
  for (const [area, entry] of Object.entries(docMap)) {
    if (!entry) continue;
    const srcCount = sourceRefs[area] ?? 0;
    const docCount = docRefs[area] ?? 0;
    if (srcCount > 0 && docCount === 0) {
      fail.push(`${area}: source has ${srcCount} reference(s) but doc has 0`);
    } else if (srcCount > 5 && docCount < srcCount / 2) {
      warn.push(
        `${area}: source has ${srcCount} reference(s) but doc has only ${docCount} (looks thin)`
      );
    } else {
      pass.push(`${area}: source=${srcCount}, doc=${docCount}`);
    }
  }
  return { pass, warn, fail };
}

/**
 * Count references to an area in a text. A "reference" is a string match
 * for any of the area's keywords (case-insensitive).
 *
 *   keywords: a list of strings (e.g. ['api/health', 'login', 'auth'])
 *   text: the file content to search
 *
 *   Returns the number of keyword matches.
 */
export function countReferences(keywords: string[], text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const k of keywords) {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx !== -1) count++;
  }
  return count;
}

/**
 * Build a DocMap from a JSON object. Validates the shape (every entry has
 * the required fields).
 */
export function loadDocMap(json: unknown): DocMap {
  if (typeof json !== 'object' || json === null) {
    throw new Error('loadDocMap: expected an object');
  }
  const map: DocMap = {};
  for (const [area, entry] of Object.entries(json)) {
    if (!ALL_DOC_AREAS.includes(area as DocArea)) {
      // Unknown area; skip (the consumer may have added custom areas)
      continue;
    }
    const e = entry as DocMapEntry;
    if (!Array.isArray(e.docFiles) || e.docFiles.length === 0) {
      throw new Error(`loadDocMap: area "${area}" must have a non-empty docFiles array`);
    }
    if (e.staleCheck !== 'manual' && e.staleCheck !== 'guardian') {
      throw new Error(`loadDocMap: area "${area}" staleCheck must be 'manual' or 'guardian'`);
    }
    map[area as DocArea] = e;
  }
  return map;
}

export default {
  checkDocFreshness,
  countReferences,
  loadDocMap,
  ALL_DOC_AREAS,
};
