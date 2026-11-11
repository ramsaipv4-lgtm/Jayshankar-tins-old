// templates/zod-schemas/money.zod.ts
//
// The Zod schema for money in a TINS consumer. Copy this file to your consumer's
// `src/lib/validations/money.zod.ts` (or wherever schemas live) and import.
//
// THE CONTRACT:
//   - Money is ALWAYS a string, never a number (JSON float coercion will
//     lose precision: 0.1 + 0.2 = 0.30000000000000004).
//   - The string is ALWAYS in the format "^\d+\.\d{2}$" — exactly 2 decimal
//     places, no thousands separator, no currency symbol.
//   - The Postgres column is `Decimal(18,4)` (4 decimal places; the API contract
//     is 2, but the DB reserves 2 more for arithmetic).
//   - The in-process representation is `Prisma.Decimal` (from
//     `@prisma/client/runtime`).
//
// Source: atal-incubation (the canonical Zod schema for grant tranches), Jayshankar
// (the same shape for sale amounts).

import { z } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * The wire-format regex for money: digits, dot, exactly 2 decimal places.
 *
 * Examples:
 *   ✅ "0.00", "1.00", "100.50", "99999999999999.99"
 *   ❌ "0", "0.0", "0.000", "1,000.00", "$100", "1e2"
 */
export const MONEY_REGEX = /^\d+\.\d{2}$/;

/**
 * The Zod schema for an incoming money string (API request body, form input).
 *
 * Use this to validate user input. It will REJECT numbers (so JSON float
 * coercion can't sneak in) and REJECT malformed strings.
 */
export const MoneyString = z
  .string()
  .regex(MONEY_REGEX, {
    message:
      'Money must be a string in the format "1234.56" (no thousands separator, exactly 2 decimal places)',
  })
  .brand<'MoneyString'>();

/**
 * The Zod schema for an OPTIONAL incoming money string.
 *
 * Use this for fields that may be null/undefined (e.g. a "discount" field
 * that defaults to "0.00").
 */
export const MoneyStringOptional = MoneyString.nullable().optional();

/**
 * Convert a money string to a Prisma.Decimal for arithmetic.
 *
 * Use this when you need to add, subtract, multiply, or compare money. Never
 * use Number() — the float will lose precision.
 */
export function moneyFromString(s: z.infer<typeof MoneyString>): Prisma.Decimal {
  return new Prisma.Decimal(s);
}

/**
 * Convert a Prisma.Decimal back to the wire-format string.
 *
 * Use this when serialising a Decimal to JSON (for an API response). The
 * output is ALWAYS in the MONEY_REGEX format.
 */
export function moneyToString(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

/**
 * Format money for display in a UI.
 *
 * Default uses INR (Indian Rupee) because the reference projects are Indian
 * (IncubOS, Jayshankar). Override the currency symbol as needed.
 */
export function formatMoney(
  d: Prisma.Decimal | string,
  options: { currency?: 'INR' | 'USD' | 'EUR' | 'GBP' | 'NONE'; locale?: string } = {}
): string {
  const { currency = 'INR', locale = 'en-IN' } = options;
  const decimal = typeof d === 'string' ? new Prisma.Decimal(d) : d;
  const formatter = new Intl.NumberFormat(locale, {
    style: currency === 'NONE' ? 'decimal' : 'currency',
    currency: currency === 'NONE' ? undefined : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(decimal.toNumber());
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example: validating a request body.
 *
 * ```ts
 * const CreateGrantTrancheRequest = z.object({
 *   grantId: z.string().uuid(),
 *   amount: MoneyString,
 *   releaseDate: z.string().datetime(),
 * });
 *
 * // In an API route:
 * const body = CreateGrantTrancheRequest.parse(await req.json());
 * const amount = moneyFromString(body.amount);  // Prisma.Decimal
 * await prisma.grantTranche.create({
 *   data: { grantId: body.grantId, amount, releaseDate: new Date(body.releaseDate) },
 * });
 * ```
 *
 * Example: serialising a response.
 *
 * ```ts
 * const tranche = await prisma.grantTranche.findUnique({ where: { id } });
 * return Response.json({
 *   ...tranche,
 *   amount: moneyToString(tranche.amount),   // "100.00", not 100 or 100.0
 * });
 * ```
 */
