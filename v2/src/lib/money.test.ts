import { describe, expect, test } from 'vitest';
import { formatMoney, formatMoneyInput, groszeFromZloty, parseMoneyInput, zlotyFromGrosze } from './money';

// Intl uses non-breaking spaces; compare with plain ones.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('parseMoneyInput', () => {
  test.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12.50', 1250],
    ['0,05', 5],
    ['12,', 1200],
    ['1 234,56', 123456],
    ['1\u00a0234,56', 123456],
    ['  7  ', 700],
    ['45 zł', 4500],
    ['0', 0],
  ])('%j → %d grosze', (input, grosze) => {
    expect(parseMoneyInput(input)).toBe(grosze);
  });

  test.each(['', ' ', 'abc', '12,345', '-5', '1,2,3', ',5', '1e3', '12 zł 50'])('%j is not an amount', (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});

describe('formatting', () => {
  test('editable form', () => {
    expect(formatMoneyInput(1250)).toBe('12,50');
    expect(formatMoneyInput(5)).toBe('0,05');
    expect(formatMoneyInput(-1250)).toBe('-12,50');
  });

  test('display form follows the locale', () => {
    expect(plain(formatMoney(123456))).toBe('1234,56 zł');
    expect(plain(formatMoney(12345678))).toBe('123 456,78 zł');
    expect(plain(formatMoney(1250, 'en-US'))).toBe('PLN 12.50');
  });

  test('round trip through the editable form', () => {
    for (const g of [0, 1, 99, 100, 1250, 123456]) expect(parseMoneyInput(formatMoneyInput(g))).toBe(g);
  });
});

describe('v1 boundary', () => {
  test('złoty floats convert to exact grosze', () => {
    expect(groszeFromZloty(0.45)).toBe(45);
    expect(groszeFromZloty(12.5)).toBe(1250);
    expect(groszeFromZloty(0.1 + 0.2)).toBe(30); // 0.30000000000000004
    expect(zlotyFromGrosze(1250)).toBe(12.5);
  });
});

describe('the balance moved in grosze, as v1 moves it in złoty', () => {
  test("lands where v1's round2(current + delta) lands, for balances from -50 to 2000 zł", () => {
    const round2 = (x: number) => Math.round(x * 100) / 100;
    for (let cents = -5000; cents <= 200_000; cents += 7) {
      const current = cents / 100;
      for (const delta of [0.01, 0.1, 0.45, 3.15, 12.5, -0.01, -4.99, -19.99]) {
        expect(zlotyFromGrosze(groszeFromZloty(current) + groszeFromZloty(delta))).toBe(round2(current + delta));
      }
    }
  });
});
