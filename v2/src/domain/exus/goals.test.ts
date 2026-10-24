import { describe, expect, it } from 'vitest';
import { depositAmount, newGoalTarget, targetFor } from './goals';
import { amount } from './recognizers';

const a = (token: string) => {
  const value = amount(token);
  if (!value) throw new Error(token);
  return value;
};

describe('newGoalTarget', () => {
  it.each([
    ['1500zł', { ok: true, type: 'money', target: 150000 }],
    ['12,50PLN', { ok: true, type: 'money', target: 1250 }],
    ['5000pkt', { ok: true, type: 'points', target: 5000 }],
    ['1500', { ok: false, problem: 'unit' }],
    ['12,5', { ok: false, problem: 'unit' }],
  ])('%s', (token, expected) => expect(newGoalTarget(a(token))).toEqual(expected));
});

describe('targetFor', () => {
  it.each([
    ['money', '2000zł', { ok: true, target: 200000 }],
    ['money', '2000', { ok: true, target: 200000 }],
    ['money', '99,99', { ok: true, target: 9999 }],
    ['money', '500pkt', { ok: false, problem: 'wrongUnit' }],
    ['points', '500pkt', { ok: true, target: 500 }],
    ['points', '500', { ok: true, target: 500 }],
    ['points', '500zł', { ok: false, problem: 'wrongUnit' }],
    ['points', '12,5', { ok: false, problem: 'notWhole' }],
  ] as const)('a %s goal, %s', (type, token, expected) => expect(targetFor(type, a(token))).toEqual(expected));
});

describe('depositAmount', () => {
  it.each([
    ['50', { ok: true, grosze: 5000 }],
    ['20,25zł', { ok: true, grosze: 2025 }],
    ['50pkt', { ok: false, problem: 'wrongUnit' }],
  ])('%s', (token, expected) => expect(depositAmount(a(token))).toEqual(expected));
});
