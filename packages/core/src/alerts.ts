/**
 * Pure alert-evaluation rules for the notification engine — framework-free and
 * unit-tested. The API's NotificationsService persists whatever these functions
 * decide; here we own *when* an alert fires.
 */
import { stockHealth } from './inventory.js';

export type NotificationKind =
  | 'LOW_STOCK'
  | 'CRITICAL_STOCK'
  | 'OUT_OF_STOCK'
  | 'ORDER_LATE'
  | 'MISSING_DATASHEET'
  | 'NO_LOCATION';

/** Map stock health to the matching stock notification kind (or null if OK). */
export function stockAlertKind(available: number, minQty: number): NotificationKind | null {
  switch (stockHealth(available, minQty)) {
    case 'OUT_OF_STOCK':
      return 'OUT_OF_STOCK';
    case 'CRITICAL':
      return 'CRITICAL_STOCK';
    case 'LOW':
      return 'LOW_STOCK';
    default:
      return null;
  }
}

export interface ComponentAlertInput {
  available: number;
  minQty: number;
  hasDatasheet: boolean;
  /** Whether the component is assigned to at least one warehouse location. */
  hasLocation: boolean;
}

/** All notification kinds that currently apply to a single component. */
export function evaluateComponentAlerts(input: ComponentAlertInput): NotificationKind[] {
  const kinds: NotificationKind[] = [];
  const stock = stockAlertKind(input.available, input.minQty);
  if (stock) kinds.push(stock);
  if (!input.hasDatasheet) kinds.push('MISSING_DATASHEET');
  // "Ghost" component: exists in the catalog but isn't placed anywhere.
  if (!input.hasLocation) kinds.push('NO_LOCATION');
  return kinds;
}

/** A purchase order is late if it's still open and its expected date has passed. */
export function isOrderLate(
  status: string,
  expectedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expectedAt) return false;
  if (status !== 'ORDERED' && status !== 'PARTIAL') return false;
  return new Date(expectedAt).getTime() < now.getTime();
}

export function stockAlertMessage(
  kind: NotificationKind,
  label: string,
  available: number,
  minQty: number,
): string {
  switch (kind) {
    case 'OUT_OF_STOCK':
      return `${label}: esaurito (disponibili ${available}).`;
    case 'CRITICAL_STOCK':
      return `${label}: scorta critica (${available}, minimo ${minQty}).`;
    case 'LOW_STOCK':
      return `${label}: sotto scorta minima (${available}, minimo ${minQty}).`;
    case 'MISSING_DATASHEET':
      return `${label}: datasheet mancante.`;
    case 'ORDER_LATE':
      return `${label}: ordine in ritardo.`;
    case 'NO_LOCATION':
      return `${label}: nessuna ubicazione assegnata.`;
  }
}
