import { describe, expect, it } from 'vitest';
import { evaluateComponentAlerts, isOrderLate, stockAlertKind } from './alerts.js';

describe('stockAlertKind', () => {
  it('maps health to a notification kind', () => {
    expect(stockAlertKind(0, 10)).toBe('OUT_OF_STOCK');
    expect(stockAlertKind(4, 10)).toBe('CRITICAL_STOCK'); // <= min/2
    expect(stockAlertKind(8, 10)).toBe('LOW_STOCK'); // <= min
    expect(stockAlertKind(20, 10)).toBeNull(); // healthy
  });
});

describe('evaluateComponentAlerts', () => {
  it('combines stock + datasheet alerts', () => {
    expect(
      evaluateComponentAlerts({ available: 4, minQty: 10, hasDatasheet: false }),
    ).toEqual(['CRITICAL_STOCK', 'MISSING_DATASHEET']);
  });
  it('returns nothing when healthy and documented', () => {
    expect(evaluateComponentAlerts({ available: 50, minQty: 10, hasDatasheet: true })).toEqual([]);
  });
});

describe('isOrderLate', () => {
  const past = new Date('2026-01-01');
  const future = new Date('2999-01-01');
  it('flags open orders past their expected date', () => {
    expect(isOrderLate('ORDERED', past)).toBe(true);
    expect(isOrderLate('PARTIAL', past)).toBe(true);
  });
  it('ignores closed orders and future dates', () => {
    expect(isOrderLate('RECEIVED', past)).toBe(false);
    expect(isOrderLate('ORDERED', future)).toBe(false);
    expect(isOrderLate('ORDERED', null)).toBe(false);
  });
});
