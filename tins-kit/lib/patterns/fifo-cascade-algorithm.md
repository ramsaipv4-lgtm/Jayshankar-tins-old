# `fifo-cascade-algorithm` — kit pattern

> **The canonical recipe for "specify an algorithm as a numbered procedure so the
> validator can test it."** Self-contained. The most-tested pattern in the kit.
>
> **Source:** Jayshankar (FIFO spoilage, FIFO sale cascade, FIFO transfer — the
> canonical worked examples) + atal-incubation (AIM tranche release guard, the
> "oldest first" philosophy applied to grant tranches).

---

## 0. Why this exists

The naive way to write an algorithm in a SPEC is prose:

> "When a spoilage is recorded, deduct from the oldest batches first, cascading
> to newer ones if the oldest is insufficient."

This is technically correct but **impossible to test**. The validator can grep
for keywords; it can't tell if your FIFO cascade handles the edge case where the
oldest batch has 0 kg remaining but the second-oldest has the full amount.

The pattern: **write the algorithm as a numbered procedure, with a JS fixture
that exercises the edge cases, and a self-test in `scripts/selftest.mjs` that
asserts the fixture's behaviour**. The fixture runs in Node, no external deps,
exits 0 on pass.

---

## 1. The template

```markdown
## 4.X.1 FIFO spoilage algorithm

Given: batches = [{ id, kg_remaining, delivered_at }, ...], kg = X, location_id = L.

1. Filter batches to those at (sku, L) with kg_remaining > 0.
2. Sort by delivered_at ascending; tie-break by id ascending.
3. Set shortfall = X.
4. For each batch in the sorted list, in order:
   a. If shortfall = 0, break.
   b. deduct = min(shortfall, batch.kg_remaining).
   c. INSERT INTO movements (kind='spoilage', kg=deduct, batch_id=batch.id, ...).
   d. shortfall -= deduct.
5. If shortfall > 0, surface "Insufficient stock: requested X kg, only (X - shortfall) kg
   available." Do not raise; record the partial spoilage and let the user decide.
```

The validator's self-test then runs a fixture:

```js
// scripts/fixtures/fifo-spoilage.test.mjs
import { test } from 'node:test';
import { fifoSpoilage } from './fifo-spoilage.mjs';

test('3 batches, sufficient stock', () => {
  const result = fifoSpoilage(
    [{ id: 'a', kg_remaining: 5 }, { id: 'b', kg_remaining: 3 }, { id: 'c', kg_remaining: 2 }],
    4
  );
  assert.equal(result.movements.length, 1);
  assert.equal(result.movements[0].batch_id, 'a');
  assert.equal(result.shortfall, 0);
});

test('3 batches, cascade across 2', () => {
  const result = fifoSpoilage(
    [{ id: 'a', kg_remaining: 2 }, { id: 'b', kg_remaining: 3 }, { id: 'c', kg_remaining: 2 }],
    4
  );
  assert.equal(result.movements.length, 2);
  assert.equal(result.movements[0].batch_id, 'a');
  assert.equal(result.movements[0].kg, 2);
  assert.equal(result.movements[1].batch_id, 'b');
  assert.equal(result.movements[1].kg, 2);
  assert.equal(result.shortfall, 0);
});

test('3 batches, insufficient stock', () => {
  const result = fifoSpoilage(
    [{ id: 'a', kg_remaining: 2 }, { id: 'b', kg_remaining: 1 }],
    5
  );
  assert.equal(result.movements.length, 2);
  assert.equal(result.shortfall, 2);  // 2 + 1 = 3 < 5, shortfall 2
});
```

The fixture runs in `node --test` (zero deps, built into Node 18+). The
`scripts/selftest.mjs` aggregates all such fixtures and exits 1 if any fails.

---

## 2. The 3 lessons, in detail

### Lesson 1 — The tie-break rule matters

A spec that says "oldest first" is ambiguous when two batches have the same
`delivered_at`. The pattern's rule: **tie-break by `id` ascending**. The id is
generated server-side, so the tie-break is deterministic and stable across
requests. A spec that says "or whichever" creates a flaky test.

### Lesson 2 — Shortfall is a feature, not a bug

A spec that says "raise if insufficient stock" forces the user to retry. A spec
that says "record the partial spoilage and surface the shortfall" lets the
user confirm "yes, this is what I have" and move on. Jayshankar's pattern: the
mutation form shows "Recorded 7 kg of 999 requested. Shortfall: 992 kg." The
worker decides whether to correct the form or accept the partial.

**The rule:** never fail silently when the user's intent can't be fully
satisfied. Record what was done, surface the gap, let the user decide.

### Lesson 3 — The validator's job is to pin the design

A self-test that asserts the algorithm's behaviour pins the design against
silent changes. A future contributor who changes the algorithm (e.g. "let's
deduct from newest first, it's faster") breaks the self-test. The contributor
either re-reads the spec and updates both, or reverts. Either way, the
algorithm doesn't drift.

**The rule:** every algorithm in the spec gets a numbered procedure + a JS
fixture + a self-test case. Three artifacts, one invariant: the algorithm's
behaviour is the same on paper, in code, and in test.

---

## 3. The 2 known anti-patterns

| Anti-pattern | What goes wrong |
|---|---|
| "The algorithm is in the code; the spec is prose." | The spec drifts from the code; the spec's intent is lost. The validator has nothing to test. |
| The algorithm is recursive / stateful across requests. | The self-test can't reproduce. The algorithm becomes "magic" — it works, but no one can explain it. The pattern: any algorithm the user can describe in 5 numbered steps is testable. Anything more complex is two algorithms. |

---

## 4. The 1 known under-engineering trap

**Specifying only the happy path.** "If X kg, deduct from oldest batches."
The self-test must also cover: empty input (no batches), single batch
insufficient, multiple batches with same `delivered_at` (tie-break), zero
`kg` (no-op), negative `kg` (error). The self-test's job is to nail down the
edge cases, not just confirm the happy path.

---

## 5. When this changes (the V2 upgrade path)

- **If the algorithm is migrated to a database function** (e.g. for atomicity
  across tables, see `lib/patterns/postgres-mutations.md`), the JS fixture is
  replaced by a SQL fixture. The self-test still runs; it just talks to the
  database now.
- **If the algorithm grows past 10 steps**, split it into two algorithms. The
  pattern's "any algorithm describable in 5 numbered steps is testable" rule
  applies — a 10-step algorithm is two 5-step algorithms composed.

---

*— End of pattern. The 100-line Jayshankar `fifoSpoilage` implementation lives
at `src/lib/mutations.ts:90-150` (the canonical worked example). This pattern
is the recipe designed to be applied to any new algorithm in any consumer.*

---

*— End of `fifo-cascade-algorithm` pattern. See also: `docs/GAP-ANALYSIS.md` (the source projects) and the other patterns in `lib/patterns/`.*
