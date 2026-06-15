/**
 * Pure inventory domain logic — framework-free so it can be unit-tested and
 * reused on client and server. Persistence (transactions, locking) lives in the
 * NestJS InventoryService; this module owns the *rules*:
 *
 *  - available = quantity − reserved
 *  - movement input validation (which locations each type requires)
 *  - quantity arithmetic that never goes negative ("no oversell")
 */

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';

export interface StockState {
  quantity: number;
  reserved: number;
  onOrder: number;
}

export class InventoryError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_INPUT' | 'INSUFFICIENT_STOCK',
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

/** Physically present minus soft-reserved. */
export function availableQty(s: Pick<StockState, 'quantity' | 'reserved'>): number {
  return s.quantity - s.reserved;
}

export interface MovementInput {
  type: MovementType;
  quantity: number; // signed only for ADJUSTMENT; otherwise must be > 0
  fromLocationId?: string;
  toLocationId?: string;
  reason?: string;
}

/**
 * Validate a movement request before touching the database. Throws
 * {@link InventoryError} with code INVALID_INPUT on any rule violation.
 */
export function assertMovementInput(input: MovementInput): void {
  const { type, quantity, fromLocationId, toLocationId, reason } = input;

  if (!Number.isFinite(quantity)) {
    throw new InventoryError('Quantity must be a number', 'INVALID_INPUT');
  }

  switch (type) {
    case 'INBOUND':
      if (quantity <= 0) throw new InventoryError('INBOUND quantity must be > 0', 'INVALID_INPUT');
      if (!toLocationId) throw new InventoryError('INBOUND requires toLocation', 'INVALID_INPUT');
      break;
    case 'OUTBOUND':
      if (quantity <= 0) throw new InventoryError('OUTBOUND quantity must be > 0', 'INVALID_INPUT');
      if (!fromLocationId)
        throw new InventoryError('OUTBOUND requires fromLocation', 'INVALID_INPUT');
      break;
    case 'TRANSFER':
      if (quantity <= 0) throw new InventoryError('TRANSFER quantity must be > 0', 'INVALID_INPUT');
      if (!fromLocationId || !toLocationId)
        throw new InventoryError('TRANSFER requires from and to locations', 'INVALID_INPUT');
      if (fromLocationId === toLocationId)
        throw new InventoryError('TRANSFER locations must differ', 'INVALID_INPUT');
      break;
    case 'ADJUSTMENT':
      if (quantity === 0)
        throw new InventoryError('ADJUSTMENT delta must be non-zero', 'INVALID_INPUT');
      if (!fromLocationId && !toLocationId)
        throw new InventoryError('ADJUSTMENT requires a location', 'INVALID_INPUT');
      if (!reason || reason.trim() === '')
        throw new InventoryError('ADJUSTMENT requires a reason', 'INVALID_INPUT');
      break;
    default:
      throw new InventoryError(`Unknown movement type: ${type}`, 'INVALID_INPUT');
  }
}

/**
 * Apply a signed delta to a quantity, refusing to go below zero unless
 * explicitly allowed. Returns the new quantity. Throws INSUFFICIENT_STOCK.
 */
export function nextQuantity(current: number, delta: number, allowNegative = false): number {
  const next = current + delta;
  if (next < 0 && !allowNegative) {
    throw new InventoryError(
      `Insufficient stock: have ${current}, change ${delta}`,
      'INSUFFICIENT_STOCK',
    );
  }
  return next;
}

/** Sum per-location stock into a component-level rollup. */
export function summarizeStock(levels: readonly StockState[]): StockState & { available: number } {
  const total = levels.reduce(
    (acc, l) => ({
      quantity: acc.quantity + l.quantity,
      reserved: acc.reserved + l.reserved,
      onOrder: acc.onOrder + l.onOrder,
    }),
    { quantity: 0, reserved: 0, onOrder: 0 },
  );
  return { ...total, available: availableQty(total) };
}

export type StockHealth = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'OK';

/**
 * Classify stock health against the component's min quantity. "CRITICAL" is at
 * or below half the minimum — used to drive notifications (low/critical/out).
 */
export function stockHealth(available: number, minQty: number): StockHealth {
  if (available <= 0) return 'OUT_OF_STOCK';
  if (minQty <= 0) return 'OK';
  if (available <= minQty / 2) return 'CRITICAL';
  if (available <= minQty) return 'LOW';
  return 'OK';
}
