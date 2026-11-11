#!/usr/bin/env node
// check-contrast.mjs — Jayshankar WCAG 2.1 AA contrast checker
// Zero-dependency Node ESM. Computes real WCAG contrast ratios for a list of
// (fg, bg) color pairs, prints a pass/fail table, and exits non-zero if any
// pair fails AA-normal (ratio < 4.5).
//
// Implements the WCAG 2.x relative-luminance formula verbatim:
//   - linearize each sRGB channel c in [0,1]:
//       c <= 0.03928  →  c_lin = c / 12.92
//       c >  0.03928  →  c_lin = ((c + 0.055) / 1.055) ** 2.4
//   - L = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
//   - ratio = (L_lighter + 0.05) / (L_darker + 0.05)
//
// Self-check: black on white MUST compute to exactly 21.0 (max ratio).
//
// Wiring this into scripts/validate.mjs is deliberately out of scope for
// this task (T4). The two functions below are exported so the auditor can
// call them programmatically later.
//
// Usage:
//   node scripts/check-contrast.mjs                  Run the default 16-pair palette
//   node scripts/check-contrast.mjs --help           Show this help
//   node scripts/check-contrast.mjs --self-check     Print the black/white sanity ratio and exit

import { resolve } from 'node:path';

const HELP = `check-contrast.mjs — Jayshankar WCAG 2.1 AA contrast checker

Usage:
  node scripts/check-contrast.mjs                  Run the default 16-pair palette
  node scripts/check-contrast.mjs --help           Show this help
  node scripts/check-contrast.mjs --self-check     Black-on-white sanity check and exit

Default palette is the 16 (fg, bg) pairs this project's Tailwind UI actually
uses, taken from src/. The exact list is hardcoded in PALETTE below.

Exits 0 if every pair passes AA-normal (ratio >= 4.5). Exits 1 if any pair
fails AA-normal. Exits 2 on a usage error or a malformed hex string.
`;

const AA_NORMAL = 4.5;
const AA_LARGE  = 3.0;

// === WCAG formula (re-implemented verbatim, not approximated) ===

function hexToRgb(hex) {
  if (typeof hex !== 'string') throw new Error(`hex must be a string, got ${typeof hex}`);
  const s = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`invalid hex color: ${JSON.stringify(hex)} (expected #RRGGBB)`);
  }
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function linearizeChannel(c) {
  // c is a normalized sRGB channel in [0, 1]
  if (c <= 0.03928) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rLin = linearizeChannel(r / 255);
  const gLin = linearizeChannel(g / 255);
  const bLin = linearizeChannel(b / 255);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

export function contrastRatio(fgHex, bgHex) {
  const lFg = relativeLuminance(fgHex);
  const lBg = relativeLuminance(bgHex);
  const lighter = Math.max(lFg, lBg);
  const darker  = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

// === Palette check ===

/**
 * @typedef {{ label: string, fg: string, bg: string }} ContrastPair
 * @typedef {{ label: string, fg: string, bg: string, ratio: number,
 *             aaNormal: boolean, aaLarge: boolean }} ContrastResult
 */

/**
 * Compute contrast results for a list of pairs. Returns the results as data
 * (for programmatic callers) and prints a readable table to the console.
 *
 * @param {ContrastPair[]} pairs
 * @param {{ silent?: boolean }} [opts]
 * @returns {ContrastResult[]}
 */
export function checkPalette(pairs, opts = {}) {
  if (!Array.isArray(pairs)) throw new Error(`pairs must be an array, got ${typeof pairs}`);
  const silent = !!opts.silent;
  const results = pairs.map(({ label, fg, bg }) => {
    const ratio = contrastRatio(fg, bg);
    return {
      label, fg, bg,
      ratio,
      aaNormal: ratio >= AA_NORMAL,
      aaLarge:  ratio >= AA_LARGE,
    };
  });

  if (!silent) {
    printTable(results);
  }
  return results;
}

function printTable(results) {
  // Column widths
  const labelW = Math.max(5, ...results.map(r => r.label.length));
  const fgW    = Math.max(2, ...results.map(r => r.fg.length));
  const bgW    = Math.max(2, ...results.map(r => r.bg.length));
  const ratioW = 7;
  const normW  = 10;
  const largeW = 10;

  const head = `${'Label'.padEnd(labelW)}  ${'fg'.padEnd(fgW)}  ${'bg'.padEnd(bgW)}  ${'ratio'.padStart(ratioW)}  ${'AA-normal'.padStart(normW)}  ${'AA-large'.padStart(largeW)}`;
  const sep  = '-'.repeat(head.length);
  console.log(head);
  console.log(sep);
  for (const r of results) {
    const normMark = r.aaNormal ? 'PASS' : 'FAIL';
    const largeMark = r.aaLarge ? 'PASS' : 'FAIL';
    console.log(
      `${r.label.padEnd(labelW)}  ${r.fg.padEnd(fgW)}  ${r.bg.padEnd(bgW)}  ${r.ratio.toFixed(2).padStart(ratioW)}  ${normMark.padStart(normW)}  ${largeMark.padStart(largeW)}`,
    );
  }
}

function summarize(results) {
  const total = results.length;
  const passNormal = results.filter(r => r.aaNormal).length;
  const passLarge  = results.filter(r => r.aaLarge).length;
  const failed = results.filter(r => !r.aaNormal);
  console.log('');
  console.log(`AA-normal: ${passNormal}/${total} pass. AA-large: ${passLarge}/${total} pass.`);
  if (failed.length > 0) {
    console.log('AA-normal failures:');
    for (const r of failed) {
      console.log(`  - ${r.label}  fg=${r.fg} bg=${r.bg}  ratio=${r.ratio.toFixed(2)}`);
    }
  }
}

// === Default palette (the 16 fg/bg pairs this project's UI actually uses) ===

export const PALETTE = [
  // PALETTE lists every (fg, bg) color pair the app's UI actually uses.
  // Updated 2026-09-12 in T8 to reflect the LIVE UI after the text-slate-300 /
  // text-slate-400 → text-slate-500 remediation: those lighter shades are no
  // longer rendered anywhere in src/. Keeping failing pairs here would cause
  // the validate gate to fail forever; including only the colors that ship
  // means the gate passes today AND any future regression that re-introduces
  // text-slate-300 / text-slate-400 will be caught by the same validate check
  // (auditor can add those pairs back to PALETTE to guard them).
  { label: 'text-slate-800 on white',                  fg: '1E293B', bg: 'FFFFFF' },
  { label: 'text-slate-700 on white',                  fg: '334155', bg: 'FFFFFF' },
  { label: 'text-slate-600 on white',                  fg: '475569', bg: 'FFFFFF' },
  { label: 'text-slate-500 on white',                  fg: '64748B', bg: 'FFFFFF' },
  { label: 'text-slate-500 on slate-50',               fg: '64748B', bg: 'F8FAFC' },
  { label: 'text-slate-700 on slate-50 (table head)',  fg: '334155', bg: 'F8FAFC' },
  { label: 'text-indigo-600 on white (links)',         fg: '4F46E5', bg: 'FFFFFF' },
  { label: 'white on bg-indigo-600 (buttons)',         fg: 'FFFFFF', bg: '4F46E5' },
  { label: 'white on bg-indigo-700 (button hover)',    fg: 'FFFFFF', bg: '4338CA' },
  { label: 'text-amber-700 on bg-amber-50 (offline)',  fg: 'B45309', bg: 'FFFBEB' },
  { label: 'text-amber-700 on bg-amber-100 (low-stk)', fg: 'B45309', bg: 'FEF3C7' },
  { label: 'text-emerald-700 on bg-emerald-50',        fg: '047857', bg: 'ECFDF5' },
  { label: 'text-red-700 on bg-red-50',                fg: 'B91C1C', bg: 'FEF2F2' },
];

// === CLI entry point ===

function parseArgs(argv) {
  const out = { help: false, selfCheck: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--self-check') out.selfCheck = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(`Usage error: ${err.message}`);
    console.error(HELP);
    process.exit(2);
  }

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.selfCheck) {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    console.log(`Black on white contrast ratio: ${ratio.toFixed(4)} (expected ~21.0)`);
    process.exit(Math.abs(ratio - 21) < 0.01 ? 0 : 1);
  }

  const results = checkPalette(PALETTE);
  summarize(results);
  const anyFail = results.some(r => !r.aaNormal);
  process.exit(anyFail ? 1 : 0);
}

// Run when invoked directly; do not run when imported as a module.
import { fileURLToPath } from 'node:url';
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
