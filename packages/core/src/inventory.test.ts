import { describe, expect, it } from 'vitest';
import {
  assertMovementInput,
  availableQty,
  InventoryError,
  nextQuantity,
  stockHealth,
  summarizeStock,
} from './inventory.js';

describe('availableQty', () => {
  it('subtracts reserved from quantity', () => {
    expect(availableQty({ quantity: 100, reserved: 30 })).toBe(70);
  });
});

describe('assertMovementInput', () => {
  it('accepts valid movements', () => {
    expect(() =>
      assertMovementInput({ type: 'INBOUND', quantity: 10, toLocationId: 'L1' }),
    ).not.toThrow();
    expect(() =>
      assertMovementInput({ type: 'TRANSFER', quantity: 5, fromLocationId: 'L1', toLocationId: 'L2' }),
    ).not.toThrow();
  });

  it('rejects non-positive quantities for non-adjustments', () => {
    expect(() => assertMovementInput({ type: 'INBOUND', quantity: 0, toLocationId: 'L1' })).toThrow(
      InventoryError,
    );
  });

  it('requires the right locations per type', () => {
    expect(() => assertMovementInput({ type: 'OUTBOUND', quantity: 5 })).toThrow(/fromLocation/);
    expect(() => assertMovementInput({ type: 'INBOUND', quantity: 5 })).toThrow(/toLocation/);
    expect(() =>
      assertMovementInput({ type: 'TRANSFER', quantity: 5, fromLocationId: 'L1', toLocationId: 'L1' }),
    ).toThrow(/differ/);
  });

  it('requires a reason for adjustments', () => {
    expect(() =>
      assertMovementInput({ type: 'ADJUSTMENT', quantity: -3, fromLocationId: 'L1' }),
    ).toThrow(/reason/);
    expect(() =>
      assertMovementInput({ type: 'ADJUSTMENT', quantity: -3, fromLocationId: 'L1', reason: 'count' }),
    ).not.toThrow();
  });
});

describe('nextQuantity', () => {
  it('applies deltas', () => {
    expect(nextQuantity(10, 5)).toBe(15);
    expect(nextQuantity(10, -4)).toBe(6);
  });

  it('refuses to oversell', () => {
    expect(() => nextQuantity(3, -5)).toThrow(/Insufficient/);
  });

  it('allows negative when explicitly permitted', () => {
    expect(nextQuantity(3, -5, true)).toBe(-2);
  });
});

describe('summarizeStock', () => {
  it('rolls up per-location levels', () => {
    const s = summarizeStock([
      { quantity: 100, reserved: 10, onOrder: 0 },
      { quantity: 50, reserved: 5, onOrder: 20 },
    ]);
    expect(s).toEqual({ quantity: 150, reserved: 15, onOrder: 20, available: 135 });
  });
});

describe('stockHealth', () => {
  it('classifies against minimum', () => {
    expect(stockHealth(0, 10)).toBe('OUT_OF_STOCK');
    expect(stockHealth(4, 10)).toBe('CRITICAL'); // <= min/2
    expect(stockHealth(8, 10)).toBe('LOW'); // <= min
    expect(stockHealth(20, 10)).toBe('OK');
    expect(stockHealth(1, 0)).toBe('OK'); // no minimum set
  });
});
