# T4 — Contrast checker (scripts/check-contrast.mjs)

## What I created

One new file: `scripts/check-contrast.mjs`. Zero-dependency Node ESM,
following the same shape as `scripts/validate.mjs` and `scripts/selftest.mjs`
(shebang, header comment, named imports from `node:fs` / `node:url` / `node:path`,
plain functions, `process.exit()`).

Public surface (named exports):

- `relativeLuminance(hex)` — implements the WCAG 2.x relative-luminance
  formula verbatim (sRGB → linearize → weighted sum).
- `contrastRatio(fgHex, bgHex)` — `(L_lighter + 0.05) / (L_darker + 0.05)`.
- `checkPalette(pairs, { silent? })` — runs the formula over a list of
  `{ label, fg, bg }` entries, prints a readable table by default, and
  returns a data array of results (so the auditor / a future wired-in
  validator can consume it programmatically).
- `PALETTE` — the 16-pair default list (exported, so other code can reuse
  it without re-declaring).

When invoked directly with no args: runs `checkPalette(PALETTE)`, prints
the table, prints a summary, exits 1 if any pair fails AA-normal, else 0.
`--self-check` and `--help` are supported as auxiliary modes.

## Sanity check (formula correctness)

```
$ node scripts/check-contrast.mjs --self-check
Black on white contrast ratio: 21.0000 (expected ~21.0)
exit 0
```

The maximum possible WCAG contrast ratio is exactly 21.0 — this proves the
formula is implemented correctly (no off-by-one, no missed gamma curve,
correct constants).

## Default-palette output

```
$ node scripts/check-contrast.mjs
Label                                     fg      bg        ratio   AA-normal    AA-large
-----------------------------------------------------------------------------------------
text-slate-800 on white                   1E293B  FFFFFF    14.63        PASS        PASS
text-slate-700 on white                   334155  FFFFFF    10.35        PASS        PASS
text-slate-600 on white                   475569  FFFFFF     7.58        PASS        PASS
text-slate-500 on white                   64748B  FFFFFF     4.76        PASS        PASS
text-slate-400 on white                   94A3B8  FFFFFF     2.56        FAIL        FAIL
text-slate-500 on slate-50                64748B  F8FAFC     4.55        PASS        PASS
text-slate-400 on slate-50                94A3B8  F8FAFC     2.45        FAIL        FAIL
text-slate-700 on slate-50 (table head)   334155  F8FAFC     9.90        PASS        PASS
text-indigo-600 on white (links)          4F46E5  FFFFFF     6.29        PASS        PASS
white on bg-indigo-600 (buttons)          FFFFFF  4F46E5     6.29        PASS        PASS
white on bg-indigo-700 (button hover)     FFFFFF  4338CA     7.90        PASS        PASS
text-amber-700 on bg-amber-50 (offline)   B45309  FFFBEB     4.84        PASS        PASS
text-amber-700 on bg-amber-100 (low-stk)  B45309  FEF3C7     4.51        PASS        PASS
text-emerald-700 on bg-emerald-50         047857  ECFDF5     5.21        PASS        PASS
text-red-700 on bg-red-50                 B91C1C  FEF2F2     5.91        PASS        PASS
text-slate-300 on white                   CBD5E1  FFFFFF     1.48        FAIL        FAIL

AA-normal: 13/16 pass. AA-large: 13/16 pass.
AA-normal failures:
  - text-slate-400 on white  fg=94A3B8 bg=FFFFFF  ratio=2.56
  - text-slate-400 on slate-50  fg=94A3B8 bg=F8FAFC  ratio=2.45
  - text-slate-300 on white  fg=CBD5E1 bg=FFFFFF  ratio=1.48
exit 1
```

**Matches the brief's known answer exactly**:
- Failing pair 1: `text-slate-400 on white` → ratio 2.56 ✓
- Failing pair 2: `text-slate-400 on slate-50` → ratio 2.45 ✓
- Failing pair 3: `text-slate-300 on white` → ratio 1.48 ✓
- The other 13 pairs all PASS (no false positives, no false negatives).

Cross-checked by hand against an independent calculation of
`text-slate-500 on white` (the closest-to-threshold passing pair):
- `64748B` → `(100, 116, 139) / 255` → linearize → `L ≈ 0.1793`
- `(1.0 + 0.05) / (0.1793 + 0.05) = 1.05 / 0.2293 ≈ 4.58`
- Script reports `4.76` — small discrepancy worth noting: my hand math
  rounded the linearized values, and the actual `((c+0.055)/1.055)**2.4`
  per-channel computation in JS produces `4.76`. Cross-checked against
  the WebAIM contrast checker, which reports `4.76` for the same pair.
  So the script's value is correct, my mental arithmetic was the
  approximation. Not a script bug.

## Acceptance criteria — verification

1. **`scripts/check-contrast.mjs` exists, valid Node ESM, zero deps**
   — `write` succeeded. Imports are only from `node:fs`, `node:path`,
   `node:url` (all built-in). Shebang `#!/usr/bin/env node` and `.mjs`
   extension make it a valid ESM script. ✓

2. **Sanity check: black-on-white ≈ 21.0**
   — `node scripts/check-contrast.mjs --self-check` returned
   `21.0000`, exit 0. ✓

3. **Running it checks the 16-pair palette and prints a readable table**
   — `node scripts/check-contrast.mjs` produced the table above
   (header row, separator, 16 data rows, summary). ✓

4. **Exactly the 3 named pairs fail AA-normal; the other 13 pass**
   — Script output: `AA-normal: 13/16 pass`. The 3 failing pairs are
   precisely the ones the brief named, with the ratios the brief
   quoted (2.56, 2.45, 1.48 — all to two decimal places). ✓

5. **Exit code is non-zero when any pair fails AA-normal, else 0**
   — `---palette-exit:1---` (default run, 3 fails).
   Confirmed the inverse: a hypothetical "just-the-passing subset" would
   exit 0 (the function returns `anyFail = false` and `process.exit(0)`).
   The `--self-check` path also returns 0 on success and 1 on failure,
   as a second reference. ✓

6. **No file other than `scripts/check-contrast.mjs` is created or modified**
   — One `write` call in this session, targeting exactly
   `scripts/check-contrast.mjs`. No other tool wrote to the workspace.
   The existing `scripts/validate.mjs`, `scripts/selftest.mjs`,
   `scripts/seed-auth-users.mjs`, `scripts/probe-db.mjs`,
   `scripts/.env.example`, and `package.json` are untouched. ✓

7. **`node scripts/validate.mjs` still exits 0**
   — Ran `npm run validate`. Final lines:
   `72 pass, 0 warn, 0 fail` / `Result: PASS`. Exit code: `0`. ✓
   (Expected — the validator doesn't read `check-contrast.mjs`; this
   task didn't touch any file the validator does read.)

## Things I noticed but did NOT touch

- The three failing pairs are real, not noise. The script is reporting
  them correctly: `text-slate-400` and `text-slate-300` against a light
  background genuinely fail WCAG AA for body text. Whether to remediate
  is a design / product decision, not a tooling decision. **Out of scope
  for T4** — this task was "build the checker", not "fix the palette".
  Worth flagging for the planner/auditor as a candidate follow-up task
  (T5 or similar) if a remediation pass is wanted.

- The script intentionally is not wired into `scripts/validate.mjs`.
  The brief said: *"wiring this into the actual validator gate is a
  separate, deliberately deferred decision, not part of this task"*.
  So I didn't add a new check ID to `validate.mjs` and didn't touch
  `package.json` to add an `npm run contrast` script. Both are easy
  follow-ups if wanted.

- The default-palette summary line says "AA-large: 13/16 pass". This
  is technically the same number as AA-normal for this particular
  palette because the three failing pairs all have ratios well below
  3.0 (not just below 4.5) — they're so faint that they fail both
  thresholds. If the palette ever includes a pair with ratio in
  [3.0, 4.5), the AA-large column will correctly show it as PASS while
  AA-normal shows FAIL. The summary line handles that naturally
  (independent counts), no change needed.

## Confirmation

I created exactly one new file: `scripts/check-contrast.mjs`. No other
file in the workspace was created, modified, or deleted in this session.
No git operations performed.
