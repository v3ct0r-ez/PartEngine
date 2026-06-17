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
}

/** Human name: "Resistenza 10kΩ 0603 1%". */
export function generateComponentName(parts: NamingParts): string {
  return [
    parts.categoryName,
    parts.value,
    parts.footprint,
    parts.tolerance != null ? `${parts.tolerance}%` : undefined,
  ]
    .filter((p) => p != null && String(p).trim() !== '')
    .join(' ')
    .trim();
}

/** Standardised code: "R-10K-0603" (uppercased, symbols stripped from value). */
export function generateInternalCode(parts: { prefix: string; value?: string; footprint?: string }): string {
  const value = parts.value ? parts.value.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase() : '';
  return [parts.prefix, value, parts.footprint ? parts.footprint.toUpperCase() : '']
    .filter((p) => p && p.trim() !== '')
    .join('-');
}
