/**
 * Auto-generation of a component's internal code and display name from its
 * category + key parameters. Both are suggestions the user can override.
 */
import { formatEngineering, parseQuantity } from './units.js';

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

// Construction/secondary ENUM fields that aren't part of how you *recognise* a
// part, so they're kept out of the auto name/code to avoid noise.
const NAME_ENUM_DENYLIST = new Set(['mount', 'series', 'technology', 'tech']);

export interface NamingFieldMeta {
  key: string;
  type: string; // FieldType from category-fields
  unit?: string | null;
}

/**
 * Build the display name and internal code from a category's *recognition*
 * parameters — data-driven, so it generalises to every category (and custom
 * ones). Walking the fields in their defined order it includes:
 *   - the primary quantity (first non-% QUANTITY), engineering-formatted;
 *   - the tolerance (a "%" QUANTITY) — in the name only;
 *   - every identifying ENUM (e.g. colour, dielectric, channel, footprint),
 *     except construction details (mount/series/technology);
 *   - the `package` string (the footprint equivalent for ICs).
 * e.g. an LED → "LED Rosso 2.7V 0603", code "D-ROSSO-2.7V-0603".
 */
export function composeNaming(opts: {
  categoryName?: string;
  prefix: string;
  fields: readonly NamingFieldMeta[];
  params: Record<string, unknown>;
}): { name: string; code: string } {
  const { categoryName, prefix, fields, params } = opts;
  const primaryKey = fields.find((f) => f.type === 'QUANTITY' && f.unit && f.unit !== '%')?.key;
  const nameParts: string[] = [];
  const codeParts: string[] = [];
  const compact = (s: string, keepDot = false) =>
    s.replace(keepDot ? /[^a-zA-Z0-9.]/g : /[^a-zA-Z0-9]/g, '').toUpperCase();

  for (const f of fields) {
    const raw = params[f.key];
    if (raw == null || String(raw).trim() === '') continue;

    if (f.type === 'QUANTITY' && f.unit && f.unit !== '%') {
      if (f.key !== primaryKey) continue; // only the primary quantity is the "value"
      const q = parseQuantity(String(raw), f.unit);
      const token = q && Number.isFinite(q.magnitude) ? formatEngineering(q.magnitude, f.unit) : String(raw);
      nameParts.push(token);
      codeParts.push(compact(token, true));
    } else if (f.type === 'QUANTITY' && f.unit === '%') {
      const n = Number(raw);
      if (Number.isFinite(n)) nameParts.push(`${n}%`); // tolerance: name only, keeps the code clean
    } else if (f.type === 'ENUM') {
      if (NAME_ENUM_DENYLIST.has(f.key)) continue;
      const token = String(raw);
      nameParts.push(token);
      codeParts.push(compact(token));
    } else if (f.type === 'STRING' && f.key === 'package') {
      const token = String(raw);
      nameParts.push(token);
      codeParts.push(compact(token));
    }
  }

  const name = [categoryName, ...nameParts].filter((p) => p && String(p).trim() !== '').join(' ').trim();
  const code = [prefix, ...codeParts].filter((p) => p && p.trim() !== '').join('-');
  return { name, code };
}
