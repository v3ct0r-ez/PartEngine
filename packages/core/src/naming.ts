/**
 * Auto-generation of a component's internal code and display name from its
 * category + key parameters. Both are suggestions the user can override.
 */

/** Reference-designator-style prefix per category (fallback derived from slug). */
const CATEGORY_PREFIX: Record<string, string> = {
  resistors: 'R',
  capacitors: 'C',
  inductors: 'L',
  diodes: 'D',
  leds: 'LED',
  mosfets: 'Q',
  bjts: 'Q',
  regulators: 'U',
  ldo: 'U',
  buck_converter: 'U',
  boost_converter: 'U',
  microcontrollers: 'IC',
  fpga: 'IC',
  sensors: 'SEN',
  displays: 'DISP',
  relays: 'K',
  connectors: 'J',
  batteries: 'BT',
  fuses: 'F',
};

export function categoryCodePrefix(slug?: string, name?: string): string {
  if (slug && CATEGORY_PREFIX[slug]) return CATEGORY_PREFIX[slug];
  const base = (slug || name || 'P').replace(/[^a-zA-Z0-9]/g, '');
  return (base.slice(0, 3) || 'P').toUpperCase();
}

export interface NamingParts {
  categoryName?: string;
  /** Formatted primary value, e.g. "10kΩ" / "100nF". */
  value?: string;
  footprint?: string;
  /** Tolerance percentage (number), e.g. 1 → "1%". */
  tolerance?: number;
  /** Short identifying descriptor, e.g. an LED colour ("Rosso"). */
  color?: string;
}

/** Human name: "LED Rosso 2.7V 0603" / "Resistenza 10kΩ 0603 1%". */
export function generateComponentName(parts: NamingParts): string {
  return [
    parts.categoryName,
    parts.color,
    parts.value,
    parts.footprint,
    parts.tolerance != null ? `${parts.tolerance}%` : undefined,
  ]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
}

/** Standardised code: "D-ROSSO-2.7V-0603" / "R-10K-0603" (uppercased). */
export function generateInternalCode(parts: {
  prefix: string;
  value?: string;
  footprint?: string;
  color?: string;
}): string {
  const value = parts.value ? parts.value.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase() : '';
  const color = parts.color ? parts.color.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  return [parts.prefix, color, value, parts.footprint ? parts.footprint.toUpperCase() : '']
    .filter((p) => p && p.trim() !== '')
    .join('-');
}
