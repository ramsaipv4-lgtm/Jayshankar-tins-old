# `lib/money-as-decimal` — kit code module

> **The "money is Decimal, never Float" kit module.** Zod schema + safe arithmetic
> + formatters, all in one drop-in. Prevents the IEEE 754 float trap (0.1 + 0.2 =
> 0.30000000000000004) and the JSON float-coercion trap ({"amount": 100} → 100, not
> "100.00").
>
> **Source:** `atal-incubation/incubos/src/lib/validations/money.ts` (canonical),
> Jayshankar/src/lib/money.ts (the consumer-side companion).

---

## Install

```bash
# From the kit consumer's root
cp -r tins-kit/lib/money-as-decimal/ src/lib/money-as-decimal/
pnpm add @prisma/client  # already required for Prisma
```

The module depends on `@prisma/client` (for `Prisma.Decimal`) and `zod`.

---

## API

### `MONEY_REGEX` and `MoneyString`

The wire-format regex: digits, dot, exactly 2 decimal places. The Zod schema
brands the string as `MoneyString` for type safety.

```ts
import { MoneyString, MONEY_REGEX } from '@/lib/money-as-decimal';

const CreateInvoiceRequest = z.object({
  customerId: z.string().uuid(),
  amount: MoneyString,   // "100.00", not 100
});

const body = CreateInvoiceRequest.parse(await req.json());
// body.amount is `z.infer<typeof MoneyString>`, i.e. branded "100.00"
```

### `fromString` / `toString`

Convert between the wire format (string) and the in-process format (`Prisma.Decimal`).

```ts
import { fromString, toString } from '@/lib/money-as-decimal';

const amount = fromString('100.50');    // Prisma.Decimal('100.50')
const wire = toString(amount);           // "100.50"
```

### `format(d, options?)`

Format a Decimal for display. Default currency is INR (Indian Rupee); default locale
is `en-IN`.

```ts
import { format, fromString } from '@/lib/money-as-decimal';

format(fromString('1000000.50'));                     // "₹10,00,000.50"
format(fromString('1000000.50'), { currency: 'USD' }); // "$1,000,000.50"
format(fromString('1000000.50'), { currency: 'NONE' }); // "1,000,000.50"
```

### `sum` / `subtract` / `multiply` / `divide`

Safe arithmetic on arrays of money. Always exact, never float.

```ts
import { sum, subtract, multiply, divide } from '@/lib/money-as-decimal';

const lineItems = ['100.00', '200.50', '50.25'];
const total = sum(lineItems);                         // Prisma.Decimal('350.75')
const discounted = subtract(total, '50.00');         // Prisma.Decimal('300.75')
const withTax = multiply(discounted, '1.18');         // Prisma.Decimal('354.8850') — 4dp
const perShare = divide(total, 3);                    // Prisma.Decimal('116.9166666666666667')
```

### `equals` / `gt` / `gte` / `lt` / `lte`

Comparisons on Decimals. Use these, not `===` or `>`.

```ts
import { equals, gt, fromString } from '@/lib/money-as-decimal';

equals('100.00', '100.00');          // true
equals('100.00', '100.0');           // false (the wire format is strict)
gt('100.01', '100.00');              // true
```

---

## The 3 rules

### 1. Always use the wire format on the API boundary

The API accepts and returns money as **strings**, never as JSON numbers. JSON
numbers are IEEE 754 doubles, and the float coercion will lose precision.

```ts
// ❌ WRONG — the API contract is "amount": 100, which is a float
return Response.json({ amount: 100 });

// ✅ RIGHT — the API contract is "amount": "100.00", which is exact
return Response.json({ amount: toString(amount) });
```

### 2. Always use `Prisma.Decimal` in the app

Inside the app, money is `Prisma.Decimal`, never `Number`. The ESLint rule
`no-float-money` (template: `templates/eslint/no-float-money.js`) enforces this.

```ts
// ❌ WRONG — float arithmetic
const total = lineItems.reduce((sum, item) => sum + Number(item.amount), 0);

// ✅ RIGHT — Decimal arithmetic
const total = sum(lineItems.map((item) => item.amount));
```

### 3. Always use `Decimal(18, 4)` in the database

The Postgres column is `Decimal(18, 4)` (4 decimal places, not 2). The wire
format is 2, but the DB reserves 2 more for intermediate arithmetic (e.g. tax
calculations that produce 4dp).

```sql
-- ❌ WRONG
amount NUMERIC(10, 2)  -- overflows on big grants; loses precision in tax math

-- ✅ RIGHT
amount DECIMAL(18, 4)  -- covers up to ₹999,999,999,999,999.9999 per cell
```

---

## When to extend

- **If you need multi-currency**: add a `currency: z.enum(['INR', 'USD', 'EUR'])` to
  the wire format and a `currency` column to the table. The `format` function
  already supports it.
- **If you need tax-inclusive / tax-exclusive**: add a `taxRate: MoneyString` and
  derive `totalWithTax` via `multiply(subtotal, fromString('1.18'))`. Don't store
  both — store the rate and the base, derive the rest.
- **If you need historical FX rates**: store the rate at the time of the transaction,
  not the converted amount. The conversion drifts; the rate is fixed.

---

## Tests

See `tests/money-as-decimal.test.ts` for the 3-case test suite: happy-path
(format, arithmetic, compare), edge-case (the `0.1 + 0.2` trap), error-case
(division by zero, malformed wire format).

---

*— End of `lib/money-as-decimal/README.md`. See also: `templates/zod-schemas/money.zod.ts`
(the schema-only template), `templates/eslint/no-float-money.js` (the lint rule),
`lib/patterns/pinned-deps.md` (the "no NaN floats" rule).*
