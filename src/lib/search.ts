// search.ts — client-side fuzzy search across the app's small "identity" tables (fish/SKUs,
// customers, vendors, employees). Deliberately NOT a server-side/Postgres-trigram approach:
// each table here is small for a single-warehouse wholesaler (dozens of SKUs, low hundreds of
// customers/vendors/employees at most) — shipping the whole table to the browser once and
// fuzzy-matching with Fuse.js client-side is simpler than adding a Postgres extension, and
// fits this PWA's existing offline-read philosophy better than a per-keystroke server round
// trip would. Revisit if any of these tables ever grows into the thousands of rows.
//
// Phone/email queries go through a plain substring match on digits, not Fuse's edit-distance
// fuzzy match — fuzzy matching on a phone number produces confusing false positives (a query of
// "98" would loosely match almost every Indian mobile number). Name/fish-name queries (English,
// Tamil, or Tanglish spelling variants) go through Fuse.

import Fuse from 'fuse.js';
import { supabase } from './supabase';

export type SearchResultKind = 'fish' | 'customer' | 'vendor' | 'employee';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  phoneDigits: string; // '' when there's no phone to match against
}

interface SkuRow { id: string; code: string; english_name: string; tamil_name: string | null }
interface CustomerRow { id: string; name: string; business_name: string | null; phone: string | null; active: boolean }
interface VendorRow { id: string; name: string; phone: string | null; active: boolean }
interface UserRow { id: string; display_name: string; email: string | null; phone: string | null; role: string; active: boolean }

export async function fetchSearchIndex(): Promise<SearchResult[]> {
  const [skus, customers, vendors, users] = await Promise.all([
    supabase.from('skus').select('id, code, english_name, tamil_name'),
    supabase.from('customers').select('id, name, business_name, phone, active'),
    supabase.from('vendors').select('id, name, phone, active'),
    supabase.from('users').select('id, display_name, email, phone, role, active'),
  ]);
  if (skus.error) throw skus.error;
  if (customers.error) throw customers.error;
  if (vendors.error) throw vendors.error;
  if (users.error) throw users.error;

  const results: SearchResult[] = [];
  for (const s of (skus.data ?? []) as SkuRow[]) {
    results.push({ kind: 'fish', id: s.id, title: s.english_name, subtitle: [s.tamil_name, s.code].filter(Boolean).join(' · '), phoneDigits: '' });
  }
  for (const c of (customers.data ?? []) as CustomerRow[]) {
    if (!c.active) continue;
    results.push({
      kind: 'customer', id: c.id, title: c.name,
      subtitle: [c.business_name, c.phone].filter(Boolean).join(' · ') || 'Customer',
      phoneDigits: (c.phone ?? '').replace(/\D/g, ''),
    });
  }
  for (const v of (vendors.data ?? []) as VendorRow[]) {
    if (!v.active) continue;
    results.push({
      kind: 'vendor', id: v.id, title: v.name, subtitle: v.phone ?? 'Vendor',
      phoneDigits: (v.phone ?? '').replace(/\D/g, ''),
    });
  }
  for (const u of (users.data ?? []) as UserRow[]) {
    if (!u.active) continue;
    results.push({
      kind: 'employee', id: u.id, title: u.display_name,
      subtitle: [u.role, u.email ?? u.phone].filter(Boolean).join(' · '),
      phoneDigits: (u.phone ?? '').replace(/\D/g, ''),
    });
  }
  return results;
}

export function buildFuse(items: SearchResult[]): Fuse<SearchResult> {
  return new Fuse(items, {
    keys: ['title', 'subtitle'],
    threshold: 0.4,
    ignoreLocation: true,
  });
}

const DIGITS_QUERY_RE = /^[0-9+\-\s()]{3,}$/;

export function runSearch(index: SearchResult[], fuse: Fuse<SearchResult>, query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  if (DIGITS_QUERY_RE.test(q)) {
    const digits = q.replace(/\D/g, '');
    if (digits.length < 3) return [];
    return index.filter((r) => r.phoneDigits.includes(digits));
  }
  return fuse.search(q).map((r) => r.item);
}
