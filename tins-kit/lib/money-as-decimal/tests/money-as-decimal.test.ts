// lib/money-as-decimal/tests/money-as-decimal.test.ts
//
// The 3-case test suite for `lib/money-as-decimal`:
//   1. happy-path: format, arithmetic, compare
//   2. edge-case: the 0.1 + 0.2 float trap (the WHOLE POINT of the module)
//   3. error-case: division by zero, malformed wire format

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import money from '../index';

const m = money;

// =============================================================================
// 1. HAPPY-PATH
// =============================================================================

describe('money — happy path', () => {
  it('formats INR by default', () => {
    expect(m.format(m.fromString('1000000.50'))).toBe('₹10,00,000.50');
  });

  it('formats USD when asked', () => {
    expect(m.format(m.fromString('1000000.50'), { currency: 'USD' })).toBe(
      '$1,000,000.50'
    );
  });

  it('sums an array exactly (no float drift)', () => {
    expect(m.toString(m.sum(['100.00', '200.50', '50.25']))).toBe('350.75');
  });

  it('subtracts exactly', () => {
    expect(m.toString(m.subtract('100.00', '25.50'))).toBe('74.50');
  });

  it('multiplies exactly (returns 4dp in the DB representation)', () => {
    expect(m.toString(m.multiply('100.00', '1.18'))).toBe('118.00');
  });

  it('compares correctly', () => {
    expect(m.equals('100.00', '100.00')).toBe(true);
    expect(m.gt('100.01', '100.00')).toBe(true);
    expect(m.lt('99.99', '100.00')).toBe(true);
  });
});

// =============================================================================
// 2. EDGE-CASE: the 0.1 + 0.2 float trap
// =============================================================================

describe('money — the float trap', () => {
  it('0.1 + 0.2 === 0.3 (the whole point of the module)', () => {
    // In float:  0.1 + 0.2 = 0.30000000000000004
    // In Decimal: 0.1 + 0.2 = 0.3
    const result = m.sum(['0.10', '0.20']);
    expect(m.toString(result)).toBe('0.30');
    expect(m.equals(result, '0.30')).toBe(true);
  });

  it('survives 1000 sequential additions without drift', () => {
    // Float:  0.1 + 0.1 + ... (1000 times) = 99.9999999999986
    // Decimal: 0.1 + 0.1 + ... (1000 times) = 100.00
    const arr = Array(1000).fill('0.10');
    const result = m.sum(arr);
    expect(m.toString(result)).toBe('100.00');
  });

  it('survives the IEEE 754 trap in multiplication', () => {
    // Float:  19.99 * 100 = 1998.9999999999998
    // Decimal: 19.99 * 100 = 1999.00
    const result = m.multiply('19.99', '100');
    expect(m.toString(result)).toBe('1999.00');
  });
});

// =============================================================================
// 3. ERROR-CASE: division by zero, malformed wire format
// =============================================================================

describe('money — error cases', () => {
  it('throws on division by zero', () => {
    expect(() => m.divide('100.00', '0.00')).toThrow(/division by zero/);
  });

  it('Zod schema rejects malformed wire format', () => {
    expect(() => m.MoneyString.parse('100')).toThrow();
    expect(() => m.MoneyString.parse('100.0')).toThrow();
    expect(() => m.MoneyString.parse('100.000')).toThrow();
    expect(() => m.MoneyString.parse('$100.00')).toThrow();
    expect(() => m.MoneyString.parse('1,000.00')).toThrow();
    expect(() => m.MoneyString.parse('1e2')).toThrow();
  });

  it('Zod schema accepts the correct wire format', () => {
    expect(m.MoneyString.parse('0.00')).toBe('0.00');
    expect(m.MoneyString.parse('100.50')).toBe('100.50');
    expect(m.MoneyString.parse('99999999999999.99')).toBe('99999999999999.99');
  });
});
