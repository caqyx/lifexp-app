import { Timestamp } from 'firebase/firestore';
import { describe, expect, test } from 'vitest';
import { purchaseFromData } from './purchases';

describe('purchaseFromData', () => {
  test('a purchase as v1 wrote it: amount in złoty (int or float) becomes grosze', () => {
    const at = new Date('2026-08-01T10:00:00Z');
    expect(
      purchaseFromData('p1', { description: ' Gra ', amount: 12.5, pointsCost: 125, timestamp: Timestamp.fromDate(at) }),
    ).toEqual({ id: 'p1', description: 'Gra', grosze: 12_50, pointsCost: 125, at });
    expect(purchaseFromData('p2', { amount: 3 }).grosze).toBe(3_00);
  });

  test('missing or broken fields get defaults', () => {
    expect(purchaseFromData('x', { amount: 'dużo', timestamp: 'nie data' })).toEqual({
      id: 'x',
      description: '',
      grosze: 0,
      pointsCost: 0,
      at: null,
    });
  });
});
