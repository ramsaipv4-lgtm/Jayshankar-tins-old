# `shortfall-pattern` — kit pattern

> **The canonical recipe for "never fail silently when the user's intent can't be
> fully satisfied — record what was done, surface the gap, let the user
> decide."** Self-contained.
>
> **Source:** Jayshankar (the 999-kg sale with 7 available → "shortfall: 992.000
> kg" message), Data-cleaning-script (the `$pkCol = $null` guards in
> 03-audit/04-fix/05-verify), atal-incubation (the 422 status with
> `blockedByMilestone` / `UC_PENDING` payloads).

---

## 0. Why this exists

The naive response to "the user asked for X, only Y is available" is one of
three failure modes:

1. **Hard error.** Throw a 422 "Insufficient stock." The user is stuck. They
   have to re-enter the form with a different number, and the original intent
   is lost.
2. **Silent success.** Record Y, return 200 "Done." The user thinks X happened;
   the audit log shows Y. The discrepancy is invisible until something breaks
   downstream.
3. **Best-effort with a warning.** Record Y, return 200 with a `shortfall: X-Y`
   field in the response. The user sees what was done, sees the gap, and
   decides what to do next.

The pattern is option 3. It's slightly more work than the other two but it
respects the user's intent ("I want to move as much as I can") and never
silently drops part of the request.

---

## 1. The recipe

```ts
type MutationResult<T> = {
  result: T;                  // what was actually done
  shortfall?: number;        // the gap, if any (always in the user's unit: kg, units, etc.)
  warnings: string[];         // human-readable warnings
};

async function recordMutation(input: MutationInput): Promise<MutationResult<...>> {
  // 1. Attempt the full intent.
  const intended = input.amount;
  
  // 2. Compute what's actually possible.
  const available = await computeAvailable(input);
  const doable = Math.min(intended, available);
  const shortfall = intended - doable;
  
  // 3. Do the work — only the doable part.
  const result = await performMutation(doable, input);
  
  // 4. Return the result + the gap (if any) + a warning.
  return {
    result,
    shortfall: shortfall > 0 ? shortfall : undefined,
    warnings: shortfall > 0 ? [
      `Requested ${intended} but only ${available} available. Recorded ${doable}.`,
    ] : [],
  };
}
```

The caller (UI) renders:

```tsx
{result.warnings.map(w => <p className="text-amber-600">{w}</p>)}
{result.shortfall && <p>Shortfall: {result.shortfall} kg</p>}
```

The user sees the warning. The audit log records `intended: 999, doable: 7,
shortfall: 992`. The discrepancy is traceable.

---

## 2. The 3 lessons, in detail

### Lesson 1 — `shortfall` is a first-class field in the response, not an exception

The naive pattern: `if (shortfall > 0) throw new Error('Insufficient')`. The
pattern: `if (shortfall > 0) { result.shortfall = shortfall; result.warnings.push(...); }`.
The response is always 200 (or 201, or whatever success looks like for this
operation), with a `shortfall` field. The UI's contract is "the response shape
is the same whether the intent was fully satisfied or not." This is what
makes the UI code simple — no try/catch around the happy path.

### Lesson 2 — The audit log captures the intent, the doable, and the gap

The audit log entry for a partial sale has:

```ts
{
  action: 'INSERT',
  table: 'sales',
  rowId: 'sale-42',
  beforeJson: null,
  afterJson: {
    intended_kg: 999,
    sale_kg: 7,
    shortfall_kg: 992,
    customer_name: 'Ravi',
    sale_price_per_kg: 500,
  },
}
```

A future auditor can answer "did the worker intentionally under-record the
sale, or was it a bug?" The intent is recorded. The discrepancy is traceable.

### Lesson 3 — `shortfall` is in the user's unit, not a percentage

`shortfall: 992` (kg), not `shortfall: 99%`. The user can immediately see "I
asked for 999, I got 7, I'm short 992." A percentage is harder to interpret
("99% of what? 99% of 999 = 989, but you said 992..."). The pattern is
**always return the gap in the same unit as the input**.

---

## 3. The 3 known anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| Hard error on shortfall ("Insufficient stock: 42501") | User has to retry; original intent is lost; the form's UX is brittle. |
| Silent success (record the doable, return 200 with no warning) | The user thinks X happened; the audit log shows Y. The discrepancy is invisible. |
| Return the `shortfall` as a percentage | The user has to do math. The unit is implicit and brittle. |

---

## 4. The 1 known under-engineering trap

**Not capturing the intent in the audit log.** The `afterJson` is the
doable; the `intended` is in a separate column. Future auditors have to
re-derive the intent from the request body (which may not be in the audit
log). The pattern: store `{ intended_X, doable_X, shortfall_X }` in the
audit row. Always.

---

## 5. When this changes (the V2 upgrade path)

- **If the user wants a "fail fast" mode** (e.g. for batch jobs where the
  intent is "all or nothing"), the pattern becomes: `if (shortfall > 0 && mode
  === 'STRICT') throw new Error('Insufficient')`. The default is `LOOSE`
  (record and warn); the override is `STRICT` (fail fast). The audit log
  records which mode was used.
- **If the system has a "retry with the doable amount" UI affordance**, the
  pattern's `result` field is the seed for the retry. The form pre-fills with
  the doable amount and the user clicks again. No new data is needed.

---

*— End of pattern. The 30-line Jayshankar `recordSale` implementation
lives at `src/lib/mutations.ts:90-150`. This pattern is the recipe
designed to be applied to any "best effort" mutation in any consumer.*

---

*— End of `shortfall-pattern` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
