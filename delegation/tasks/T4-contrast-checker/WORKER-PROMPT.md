You are a WORKER session building exactly one task on the Jayshankar project
(a fish-wholesale inventory PWA — Vite + React 18 + TypeScript + Tailwind +
Supabase). Your working directory is the project root,
`C:\Users\user\Desktop\Jayshankar`.

**Environment note (read this first):** the same project folder is also
mounted at `/mnt/c/Users/user/Desktop/Jayshankar` inside a WSL2 Linux
environment, where the planner/auditor session (Claude) runs. It's the same
files, not a copy. `node_modules` is therefore physically shared and
platform-specific. This task doesn't touch `node_modules` at all (the
project's `scripts/` convention is zero-dependency Node — see below), so
this shouldn't come up, but mentioning it for consistency with other briefs.

---

Task: **T4-contrast-checker**

**Brief:** This project's `SPEC.md` §6 requires WCAG 2.1 AA accessibility,
including text contrast — but nothing in the codebase currently checks this
automatically. Build a small, zero-dependency Node script,
`scripts/check-contrast.mjs`, that computes real WCAG contrast ratios for a
list of color pairs and reports pass/fail. This is a **new file** — nothing
existing needs editing.

This is new functionality, not a bug fix, so read the spec below carefully
and precisely — the WCAG contrast formula must be implemented exactly as
given, not approximated or guessed.

**Style/convention to match:** look at `scripts/validate.mjs` and
`scripts/selftest.mjs` first — this project's `scripts/` directory is
zero-dependency Node ESM (`.mjs`, no `import` of anything outside Node's
built-in modules), matching their style (plain functions, clear console
output, a real exit code). Your script should read like a sibling of those
two, not like a totally different kind of file.

**Files you may touch:** `scripts/check-contrast.mjs` — this new file only.
Do **not** edit `scripts/validate.mjs`, `package.json`, or any other file —
wiring this into the actual validator gate is a separate, deliberately
deferred decision, not part of this task.

**The exact WCAG formula to implement** (this is precise, not a
paraphrase — implement it exactly):

For a hex color `#RRGGBB`:
1. Convert each channel (R, G, B) to 0–1 by dividing by 255.
2. Linearize each channel: if `c <= 0.03928`, `c_lin = c / 12.92`;
   otherwise `c_lin = ((c + 0.055) / 1.055) ** 2.4`.
3. Relative luminance: `L = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin`.
4. Contrast ratio between two colors: `(L_lighter + 0.05) / (L_darker + 0.05)`
   where `L_lighter`/`L_darker` are the higher/lower of the two luminances.
5. WCAG AA thresholds: normal text needs ratio `>= 4.5`; large text
   (18pt+ or 14pt+ bold) needs ratio `>= 3.0`.

**Self-check while building:** black (`#000000`) against white (`#FFFFFF`)
must compute to a contrast ratio of exactly **21.0** (or very close, e.g.
20.9999+ due to floating point) — this is the maximum possible ratio and a
standard sanity check for this formula. If your implementation doesn't
produce ~21.0 for that pair, the formula has a bug — find it before moving
on, don't ship a script that fails its own sanity check.

**Interface / structure your script should have:**
- Two importable/reusable functions: one computing relative luminance from
  a hex string, one computing contrast ratio from two hex strings.
- A function that takes a list of `{ label, fg, bg }` entries, computes the
  ratio for each, prints a readable table (label, ratio, AA-normal
  pass/fail, AA-large pass/fail), and returns the results as data too (not
  just console output) — the auditor may want to call this programmatically
  later.
- When run directly (`node scripts/check-contrast.mjs`), check the palette
  below and exit with a non-zero code if any pair fails AA-normal (this
  project's convention, per `validate.mjs`, is that scripts communicate
  failure via exit code, not just console text).

**The actual palette to check** — these are this project's real Tailwind
colors (`tailwind.config.ts` uses Tailwind's unmodified default palette, no
custom colors), taken from what's actually used across `src/`. Hardcode
this exact list as the script's default check when run with no arguments:

| Label | Foreground hex | Background hex |
|---|---|---|
| text-slate-800 on white | 1E293B | FFFFFF |
| text-slate-700 on white | 334155 | FFFFFF |
| text-slate-600 on white | 475569 | FFFFFF |
| text-slate-500 on white | 64748B | FFFFFF |
| text-slate-400 on white | 94A3B8 | FFFFFF |
| text-slate-500 on slate-50 | 64748B | F8FAFC |
| text-slate-400 on slate-50 | 94A3B8 | F8FAFC |
| text-slate-700 on slate-50 (table head) | 334155 | F8FAFC |
| text-indigo-600 on white (links) | 4F46E5 | FFFFFF |
| white on bg-indigo-600 (buttons) | FFFFFF | 4F46E5 |
| white on bg-indigo-700 (button hover) | FFFFFF | 4338CA |
| text-amber-700 on bg-amber-50 (offline banner) | B45309 | FFFBEB |
| text-amber-700 on bg-amber-100 (low-stock highlight) | B45309 | FEF3C7 |
| text-emerald-700 on bg-emerald-50 | 047857 | ECFDF5 |
| text-red-700 on bg-red-50 | B91C1C | FEF2F2 |
| text-slate-300 on white | CBD5E1 | FFFFFF |

**Known correct answer, for you to verify against (don't skip this):**
exactly 3 of the 16 pairs above should FAIL AA-normal (ratio < 4.5):
`text-slate-400 on white` (~2.56), `text-slate-400 on slate-50` (~2.45),
and `text-slate-300 on white` (~1.48). The other 13 should PASS. If your
script's output disagrees with this — either on which pairs fail, or
materially on the ratio numbers — that's a bug in your implementation, not
a surprise finding to report. Fix it before returning.

**Acceptance criteria:**
1. `scripts/check-contrast.mjs` exists, is valid Node ESM, zero
   dependencies beyond Node built-ins.
2. Sanity check: black-on-white computes to ~21.0.
3. Running `node scripts/check-contrast.mjs` checks the 16-pair palette
   above by default and prints a readable table.
4. Exactly the 3 pairs named above are reported as AA-normal failures;
   the other 13 pass. (If your numbers differ meaningfully from the ones
   given above, debug your formula — don't just report what you got.)
5. Exit code is non-zero when any pair fails AA-normal, zero otherwise (so
   running it against just-the-passing subset, if you want to spot-check,
   exits 0).
6. No file other than `scripts/check-contrast.mjs` is created or modified.
7. `node scripts/validate.mjs` still exits 0 (72 pass, 0 warn, 0 fail) —
   this task shouldn't affect it, but confirm.

**You may decide alone (T0/T1):** exact function/variable naming, exact
table formatting, whether to export via named exports or a default export
object — anything not specified above. If you're unsure whether the
project would want this wired into the actual `validate.mjs` gate as a real
check — **don't do it**, that's explicitly out of scope for this task (see
"Files you may touch" above), not a T1 judgement call.

**When done, write `delegation/tasks/T4-contrast-checker/NOTES.md`**
(create it): paste the actual script output, confirm it matches the known
answer above, confirm only the one new file was created. Then stop — no
git, no second task.
