// lib/money-as-decimal/index.ts
//
// The "money is Decimal" kit module: Zod schemas + formatters + safe arithmetic
// helpers. The companion to the `money-as-decimal` Zod schema template.
//
// Provides:
//   - MONEY_REGEX: the wire-format regex
//   - MoneyString: the Zod schema for an incoming money string
//   - fromString / toString: convert between string and Prisma.Decimal
//   - format: Intl.NumberFormat wrapper (INR by default)
//   - sum / subtract / multiply: safe arithmetic on arrays
//   - compare: equality, gt, lt, gte, lte
//   - ZERO: a constant Prisma.Decimal(0)
//
// Source: atal-incubation/incubos/src/lib/validations/money.ts (canonical),
// Jayshankar/src/lib/money.ts (the consumer-side pattern).

import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const MONEY_REGEX = /^\d+\.\d{2}$/;

export const MoneyString = z
  .string()
  .regex(MONEY_REGEX, {
    message:
      'Money must be a string in the format "1234.56" (no thousands separator, exactly 2 decimal places)',
  })
  .brand<'MoneyString'>();

export type MoneyStringT = z.infer<typeof MoneyString>;

export const ZERO = new Prisma.Decimal(0);

export function fromString(s: MoneyStringT | string): Prisma.Decimal {
  return new Prisma.Decimal(s);
}

export function toString(d: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(d).toFixed(2);
}

export function fromNumber(n: number): Prisma.Decimal {
  // Use toFixed first to avoid the binary-float trap
  return new Prisma.Decimal(n.toFixed(2));
}

export function toNumber(d: Prisma.Decimal | string): number {
  return new Prisma.Decimal(d).toNumber();
}

export function format(
  d: Prisma.Decimal | string,
  options: {
    currency?: 'INR' | 'USD' | 'EUR' | 'GBP' | 'NONE';
    locale?: string;
  } = {}
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

export function sum(values: Array<Prisma.Decimal | string>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.plus(new Prisma.Decimal(v)),
    ZERO
  );
}

export function subtract(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): Prisma.Decimal {
  return new Prisma.Decimal(a).minus(new Prisma.Decimal(b));
}

export function multiply(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): Prisma.Decimal {
  return new Prisma.Decimal(a).times(new Prisma.Decimal(b));
}

export function divide(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): Prisma.Decimal {
  if (new Prisma.Decimal(b).isZero()) {
    throw new Error('money.divide: division by zero');
  }
  return new Prisma.Decimal(a).dividedBy(new Prisma.Decimal(b));
}

export function equals(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): boolean {
  return new Prisma.Decimal(a).equals(new Prisma.Decimal(b));
}

export function gt(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): boolean {
  return new Prisma.Decimal(a).gt(new Prisma.Decimal(b));
}

export function gte(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): boolean {
  return new Prisma.Decimal(a).gte(new Prisma.Decimal(b));
}

export function lt(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): boolean {
  return new Prisma.Decimal(a).lt(new Prisma.Decimal(b));
}

export function lte(
  a: Prisma.Decimal | string,
  b: Prisma.Decimal | string
): boolean {
  return new Prisma.Decimal(a).lte(new Prisma.Decimal(b));
}

export default {
  MONEY_REGEX,
  MoneyString,
  ZERO,
  fromString,
  toString,
  fromNumber,
  toNumber,
  format,
  sum,
  subtract,
  multiply,
  divide,
  equals,
  gt,
  gte,
  lt,
  lte,
};
