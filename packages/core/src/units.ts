/**
 * Engineering-unit parsing, normalization, formatting and comparison.
 *
 * This is the core of PartEngine's "intelligent" behaviour: electronics values
 * are written with SI prefixes (Ω, kΩ, MΩ, pF, nF, µF, …) and even with EIA
 * notation where the prefix doubles as the decimal point (4k7 = 4.7 kΩ,
 * 4R7 = 4.7 Ω). Sorting/filtering must use the *physical magnitude*, never the
 * lexical string, so that:
 *
 *     100Ω, 220Ω, 470Ω, 1kΩ, 2.2kΩ, 4.7kΩ, 10kΩ, 100kΩ, 1MΩ
 *
 * orders correctly. Everything here is pure and dependency-free so the API
 * (SQL projection / sorting) and the web client (instant UI) share one truth.
 */

/** SI prefix → multiplier. `R` is the EIA ohm marker (prefix 1). */
export const SI_PREFIXES: Record<string, number> = {
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6, // U+00B5 MICRO SIGN
  μ: 1e-6, // U+03BC GREEK SMALL LETTER MU
  m: 1e-3,
  '': 1,
  R: 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Canonical base-unit symbols we understand. Order matters for parsing. */
export const UNIT_SYMBOLS = ['Hz', 'ohm', 'Ω', 'F', 'H', 'V', 'A', 'W', 'S'] as const;

const PREFERRED_PREFIXES: Array<[string, number]> = [
  ['T', 1e12],
  ['G', 1e9],
  ['M', 1e6],
  ['k', 1e3],
  ['', 1],
  ['m', 1e-3],
  ['µ', 1e-6],
  ['n', 1e-9],
  ['p', 1e-12],
];

export interface Quantity {
  /** Magnitude expressed in the SI base unit (Ω, F, H, V, A, W, Hz). */
  magnitude: number;
  /** Canonical base unit, if it could be determined. */
  unit?: string;
  /** The raw input, preserved for display/debugging. */
  raw: string;
}

function normalizeUnit(u: string): string {
  const lower = u.toLowerCase();
  if (lower === 'ohm' || u === 'Ω') return 'Ω';
  if (lower === 'hz') return 'Hz';
  return u; // F, H, V, A, W, S already canonical
}

// Sort recognised unit symbols longest-first so "Hz" wins over a stray "H".
const UNIT_SYMBOLS_SORTED = [...UNIT_SYMBOLS].sort((a, b) => b.length - a.length);

// EIA notation: digits, an embedded prefix/decimal letter, then more digits.
// e.g. 4k7 → 4.7e3, 4R7 → 4.7, 2M2 → 2.2e6, 1R0 → 1.0
const EIA_RE = /^(\d+)([RkKMGmnpµμuTf])(\d+)$/;

/**
 * Parse an engineering value such as "4.7kΩ", "100nF", "10k", "4k7", "1R0".
 * @param input the user/string value
 * @param expectedUnit optional canonical base unit to assume when the string omits one
 * @returns a {@link Quantity} or `null` if it cannot be parsed as a number.
 */
export function parseQuantity(input: string, expectedUnit?: string): Quantity | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (raw === '') return null;

  // Normalise decimal comma (European notation) → dot.
  const s = raw.replace(/,/g, '.');

  // 1) EIA notation (4k7, 4R7, 2M2 …)
  const eia = EIA_RE.exec(s);
  if (eia) {
    const [, whole, letter, frac] = eia;
    const value = parseFloat(`${whole}.${frac}`);
    const mult = SI_PREFIXES[letter] ?? 1;
    return {
      magnitude: value * mult,
      unit: letter === 'R' ? 'Ω' : expectedUnit,
      raw,
    };
  }

  // 2) Standard notation: <number><prefix?><unit?>
  const m = /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*(.*)$/.exec(s);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (Number.isNaN(value)) return null;

  let rest = m[2].trim();
  let unit = expectedUnit;

  // Peel a trailing unit symbol off, if present.
  for (const u of UNIT_SYMBOLS_SORTED) {
    if (rest.toLowerCase().endsWith(u.toLowerCase())) {
      unit = normalizeUnit(u);
      rest = rest.slice(0, rest.length - u.length).trim();
      break;
    }
  }

  // Whatever remains is the prefix (possibly empty).
  const mult = SI_PREFIXES[rest];
  if (mult === undefined) return null; // unknown prefix → not a quantity

  return { magnitude: value * mult, unit, raw };
}

/** Compare two raw value strings by physical magnitude (ascending). */
export function compareQuantities(a: string, b: string, expectedUnit?: string): number {
  const qa = parseQuantity(a, expectedUnit);
  const qb = parseQuantity(b, expectedUnit);
  if (qa && qb) return qa.magnitude - qb.magnitude;
  if (qa) return -1; // parseable values sort before unparseable ones
  if (qb) return 1;
  return a.localeCompare(b); // fall back to lexical for non-numeric values
}

/** Stable sort of arbitrary items by an engineering-value accessor. */
export function sortByEngineeringValue<T>(
  items: readonly T[],
  accessor: (item: T) => string,
  direction: 'asc' | 'desc' = 'asc',
  expectedUnit?: string,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items]
    .map((item, i) => ({ item, i }))
    .sort((x, y) => {
      const c = compareQuantities(accessor(x.item), accessor(y.item), expectedUnit);
      return c !== 0 ? sign * c : x.i - y.i; // stable
    })
    .map((w) => w.item);
}

/**
 * Format a base-unit magnitude back into a human engineering string, choosing
 * the prefix that keeps the mantissa in [1, 1000).  formatEngineering(4700,'Ω') → "4.7kΩ".
 */
export function formatEngineering(magnitude: number, unit = '', maxFractionDigits = 3): string {
  if (magnitude === 0) return `0${unit}`;
  const sign = magnitude < 0 ? '-' : '';
  const abs = Math.abs(magnitude);
  for (const [prefix, mult] of PREFERRED_PREFIXES) {
    if (abs >= mult) {
      const mantissa = abs / mult;
      const rounded = Number(mantissa.toFixed(maxFractionDigits));
      return `${sign}${rounded}${prefix}${unit}`;
    }
  }
  const last = PREFERRED_PREFIXES[PREFERRED_PREFIXES.length - 1];
  return `${sign}${Number((abs / last[1]).toFixed(maxFractionDigits))}${last[0]}${unit}`;
}
