import { describe, expect, it } from 'vitest';
import {
  evaluateComponentAlerts,
  isOrderLate,
  stockAlertKind,
  stockAlertMessage,
} from './alerts.js';

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

describe('stockAlertMessage', () => {
  it('renders a human-readable line for each kind', () => {
    expect(stockAlertMessage('OUT_OF_STOCK', 'R10k', 0, 5)).toContain('esaurito');
    expect(stockAlertMessage('CRITICAL_STOCK', 'R10k', 2, 5)).toContain('scorta critica');
    expect(stockAlertMessage('LOW_STOCK', 'R10k', 4, 5)).toContain('sotto scorta minima');
    expect(stockAlertMessage('MISSING_DATASHEET', 'R10k', 0, 0)).toContain('datasheet mancante');
    expect(stockAlertMessage('ORDER_LATE', 'PO-1', 0, 0)).toContain('ritardo');
  });

  it('embeds the label and quantities', () => {
    expect(stockAlertMessage('LOW_STOCK', 'Condensatore 100nF', 4, 5)).toBe(
      'Condensatore 100nF: sotto scorta minima (4, minimo 5).',
    );
  });
});
