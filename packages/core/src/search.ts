/**
 * Natural-language search-query parser.
 *
 * Turns free text the way an engineer actually types it —
 *   "resistenza 10k 1% 0603", "condensatore 100nF x7r", "buck converter 12V 5A"
 * — into a structured {@link SearchQuery} the API can translate into SQL
 * (category + indexed parameter ranges + FTS on the leftover words).
 *
 * Tokens are classified by *meaning*: a value carrying Ω is a resistance, F a
 * capacitance, H an inductance, V a voltage, A a current, etc. Bare numbers stay
 * as free text unless a category context makes them unambiguous.
 */
import { parseQuantity } from './units.js';

export interface SearchQuery {
  /** Resolved category slug, if a category keyword was recognised. */
  category?: string;
  footprint?: string;
  /** Tolerance percentage, e.g. 1 for "1%". */
  tolerance?: number;
  /** Capacitor dielectric, normalised (C0G, X7R, …). */
  dielectric?: string;
  /** Structured numeric parameters keyed by canonical field key (base-SI magnitude). */
  params: Record<string, number>;
  /** Leftover words to feed to full-text search. */
  text: string[];
}

/** Category keyword synonyms (IT + EN) → canonical slug. */
const CATEGORY_KEYWORDS: Record<string, string> = {
  resistenza: 'resistors',
  resistenze: 'resistors',
  resistor: 'resistors',
  resistors: 'resistors',
  condensatore: 'capacitors',
  condensatori: 'capacitors',
  capacitor: 'capacitors',
  cap: 'capacitors',
  induttore: 'inductors',
  induttanza: 'inductors',
  inductor: 'inductors',
  diodo: 'diodes',
  diode: 'diodes',
  mosfet: 'mosfets',
  bjt: 'bjts',
  transistor: 'bjts',
  regolatore: 'regulators',
  ldo: 'ldo',
  buck: 'buck_converter',
  boost: 'boost_converter',
  microcontrollore: 'microcontrollers',
  mcu: 'microcontrollers',
  fpga: 'fpga',
  sensore: 'sensors',
  sensor: 'sensors',
  display: 'displays',
  relè: 'relays',
  rele: 'relays',
  relay: 'relays',
  connettore: 'connectors',
  connector: 'connectors',
  led: 'leds',
  batteria: 'batteries',
  battery: 'batteries',
  fusibile: 'fuses',
  fuse: 'fuses',
};

const FOOTPRINTS = new Set([
  '0201', '0402', '0603', '0805', '1206', '1210',
  'sot-23', 'sot23', 'sot-223', 'to-220', 'to-92', 'qfn', 'tqfp', 'soic', 'sod-123',
]);

const DIELECTRICS = new Set(['c0g', 'np0', 'x5r', 'x7r', 'y5v', 'x6s', 'x8r']);

/** SI base unit → canonical parameter field key. */
const UNIT_TO_PARAM: Record<string, string> = {
  'Ω': 'resistance',
  F: 'capacitance',
  H: 'inductance',
  V: 'voltage',
  A: 'current',
  W: 'power',
  Hz: 'frequency',
};

export function parseSearchQuery(input: string): SearchQuery {
  const query: SearchQuery = { params: {}, text: [] };
  const tokens = String(input ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // Category keyword
    if (CATEGORY_KEYWORDS[lower]) {
      query.category = CATEGORY_KEYWORDS[lower];
      continue;
    }

    // Footprint
    if (FOOTPRINTS.has(lower)) {
      query.footprint = lower;
      continue;
    }

    // Dielectric
    if (DIELECTRICS.has(lower)) {
      query.dielectric = lower.toUpperCase();
      continue;
    }

    // Tolerance, e.g. "1%", "5%"
    const tol = /^([\d.]+)\s*%$/.exec(token);
    if (tol) {
      query.tolerance = parseFloat(tol[1]);
      continue;
    }

    // A value carrying a recognised unit → structured parameter.
    const q = parseQuantity(token);
    if (q && q.unit && UNIT_TO_PARAM[q.unit]) {
      query.params[UNIT_TO_PARAM[q.unit]] = q.magnitude;
      continue;
    }

    // A bare number with a prefix but no unit (e.g. "10k") is ambiguous; if a
    // category is known we can disambiguate to its primary parameter.
    if (q && !q.unit) {
      const primary = primaryParamForCategory(query.category);
      if (primary) {
        query.params[primary] = q.magnitude;
        continue;
      }
    }

    // Anything else feeds full-text search (name, MPN, manufacturer, tags…).
    query.text.push(token);
  }

  return query;
}

function primaryParamForCategory(category?: string): string | undefined {
  switch (category) {
    case 'resistors':
      return 'resistance';
    case 'capacitors':
      return 'capacitance';
    case 'inductors':
      return 'inductance';
    default:
      return undefined;
  }
}
