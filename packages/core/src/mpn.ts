/**
 * Manufacturer Part Number (MPN) decoder for common passive families.
 *
 * Family/series datasheets rarely state a specific variant's values in plain
 * text — they encode them in the part number. Decoding the MPN is therefore far
 * more reliable than OCR-parsing the datasheet for resistors/capacitors, whose
 * ordering schemes are well standardised across the big vendors.
 *
 * Each decoder returns base-SI magnitudes (Ω, F, V, W) keyed by the same field
 * keys the taxonomy uses, plus footprint + tolerance — so the result drops
 * straight into the "suggest fields" flow. Unknown / unsure → null (the caller
 * falls back to OCR text parsing).
 */

export interface DecodedMpn {
  /** Human label of the matched scheme, e.g. "YAGEO RC". */
  family: string;
  categorySlug: 'resistors' | 'capacitors';
  footprint?: string;
  /** Tolerance percentage, e.g. 1 for ±1%. */
  tolerance?: number;
  /** Base-SI parameters keyed by taxonomy field key (resistance Ω, capacitance F, voltage V, power W). */
  params: Record<string, number>;
  /** Dielectric (capacitors), normalised e.g. "X7R". */
  dielectric?: string;
}

// EIA tolerance letters (resistors & capacitors share most of these).
const TOL_LETTER: Record<string, number> = {
  B: 0.1, C: 0.25, D: 0.5, F: 1, G: 2, J: 5, K: 10, M: 20, Z: 20,
};

// Inch chip sizes we recognise → footprint string used by the taxonomy.
const CHIP_SIZES = new Set(['0075', '0100', '0201', '0402', '0603', '0805', '1206', '1210', '1218', '2010', '2512']);

// Typical rated power (W) by chip-resistor size — vendor-standard defaults.
const RES_SIZE_POWER: Record<string, number> = {
  '0201': 0.05, '0402': 0.0625, '0603': 0.1, '0805': 0.125, '1206': 0.25, '1210': 0.333, '2010': 0.5, '2512': 1,
};

// Two-digit size codes used by some vendors → inch footprint.
const SIZE2_FOOTPRINT: Record<string, string> = {
  '01': '0402', '02': '0402', '03': '0201', '05': '0402', '10': '0603', '15': '0402',
  '18': '0603', '21': '0805', '31': '1206', '32': '1210', '43': '1812',
};

// Metric (mm×10) chip code → inch footprint (Susumu, TDK, Murata GCM…).
const METRIC_INCH: Record<string, string> = {
  '1005': '0402', '1608': '0603', '2012': '0805', '3216': '1206', '3225': '1210', '4532': '1812', '5025': '2010',
};

// Panasonic ERJ/ERA leading size digit → inch footprint.
const PANASONIC_SIZE: Record<string, string> = {
  '1': '0201', '2': '0402', '3': '0603', '6': '0805', '8': '1206', '14': '1210', '12': '2010',
};

// KOA RK73 two-char size code → inch footprint.
const KOA_SIZE: Record<string, string> = {
  '1E': '0201', '1H': '0402', '1J': '0603', '2A': '0805', '2B': '1206', '2E': '1210', '2H': '2010', '3A': '2512',
};

// Rohm MCR numeric size code → inch footprint.
const ROHM_SIZE: Record<string, string> = {
  '006': '0201', '01': '0402', '03': '0603', '10': '0805', '18': '1206', '25': '1210', '50': '2010', '100': '2512',
};

// EIA 2-char voltage codes (MLCC) → volts.
const VOLT_CODE: Record<string, number> = {
  '0G': 4, '0J': 6.3, '1A': 10, '1C': 16, '1D': 20, '1E': 25, '1V': 35, '1H': 50,
  '2A': 100, '2D': 200, '2E': 250, '2W': 450, '2J': 630, '3A': 1000,
};

/** Decode a resistance value code: "100K"=100kΩ, "10K0"=10kΩ, "4R7"=4.7Ω, "1002"=10kΩ (EIA). */
export function decodeResistanceCode(code: string): number | null {
  const c = code.toUpperCase().trim();
  const rkm = /^(\d*)([RKM])(\d*)$/.exec(c);
  if (rkm) {
    const mult = { R: 1, K: 1e3, M: 1e6 }[rkm[2]]!;
    const num = parseFloat(`${rkm[1] || '0'}.${rkm[3] || ''}`);
    return Number.isFinite(num) ? num * mult : null;
  }
  if (/^\d{3,4}$/.test(c)) {
    const sig = parseInt(c.slice(0, -1), 10);
    const exp = parseInt(c.slice(-1), 10);
    return sig * Math.pow(10, exp);
  }
  return null;
}

/** Decode a capacitance code (EIA, in pF): "104"=100000pF, "4R7"=4.7pF. Returns Farads. */
export function decodeCapacitanceCode(code: string): number | null {
  const c = code.toUpperCase().trim();
  if (/^\d{3}$/.test(c)) {
    const sig = parseInt(c.slice(0, 2), 10);
    const exp = parseInt(c[2], 10);
    return sig * Math.pow(10, exp) * 1e-12; // pF → F
  }
  const r = /^(\d)R(\d)$/.exec(c);
  if (r) return parseFloat(`${r[1]}.${r[2]}`) * 1e-12;
  return null;
}

function normDielectric(s: string): string | undefined {
  const u = s.toUpperCase();
  for (const d of ['C0G', 'NP0', 'X7R', 'X5R', 'X6S', 'X7S', 'X8R', 'Y5V']) if (u.includes(d)) return d === 'NP0' ? 'C0G' : d;
  return undefined;
}

type Matcher = { family: string; re: RegExp; build: (m: RegExpExecArray) => DecodedMpn | null };

const MATCHERS: Matcher[] = [
  // ── Resistors ──────────────────────────────────────────────
  // YAGEO RC / AC: RC0603FR-07100KL → 0603, ±1%, 100kΩ
  {
    family: 'YAGEO RC',
    re: /^(?:RC|AC)(\d{4})([BDFGJK])[A-Z]-?\d{2}([0-9RKM]+?)L?$/i,
    build: (m) => {
      const r = decodeResistanceCode(m[3]);
      if (r == null) return null;
      const fp = m[1];
      return { family: 'YAGEO RC', categorySlug: 'resistors', footprint: fp, tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, fp) };
    },
  },
  // Vishay CRCW: CRCW060310K0FKEA → 0603, 10kΩ, ±1%
  {
    family: 'Vishay CRCW',
    re: /^CRCW(\d{4})([0-9RKM]{4})([BDFGJ])[A-Z]*$/i,
    build: (m) => {
      const r = decodeResistanceCode(m[2]);
      if (r == null) return null;
      return { family: 'Vishay CRCW', categorySlug: 'resistors', footprint: m[1], tolerance: TOL_LETTER[m[3].toUpperCase()], params: resParams(r, m[1]) };
    },
  },
  // Stackpole RMCF: RMCF0603FT10K0 → 0603, ±1%, 10kΩ
  {
    family: 'Stackpole RMCF',
    re: /^RMCF(\d{4})([BDFGJ])[A-Z]([0-9RKM]+)$/i,
    build: (m) => {
      const r = decodeResistanceCode(m[3]);
      if (r == null) return null;
      return { family: 'Stackpole RMCF', categorySlug: 'resistors', footprint: m[1], tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, m[1]) };
    },
  },
  // Panasonic ERJ: ERJ-3EKF1002V → 0603, ±1%, 10kΩ
  {
    family: 'Panasonic ERJ',
    re: /^ERJ-?(\d{1,2})[A-Z]{1,2}([BDFGJ])(\d{3,4})/i,
    build: (m) => {
      const fp = PANASONIC_SIZE[m[1]];
      if (!fp) return null;
      const r = decodeResistanceCode(m[3]);
      if (r == null) return null;
      return { family: 'Panasonic ERJ', categorySlug: 'resistors', footprint: fp, tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, fp) };
    },
  },
  // Panasonic ERA (precision thin film): ERA-3AEB1002V → 0603, ±0.1%, 10kΩ
  {
    family: 'Panasonic ERA',
    re: /^ERA-?(\d{1,2})[A-Z]{2}([BCDF])(\d{3,4})/i,
    build: (m) => {
      const fp = PANASONIC_SIZE[m[1]];
      const r = decodeResistanceCode(m[3]);
      if (!fp || r == null) return null;
      return { family: 'Panasonic ERA', categorySlug: 'resistors', footprint: fp, tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, fp) };
    },
  },
  // KOA RK73: RK73H2ATTD1002F → 0805, ±1%, 10kΩ
  {
    family: 'KOA RK73',
    re: /^RK73[A-Z](\d[A-Z])T[A-Z]+(\d{3,4})([DFGJ])$/i,
    build: (m) => {
      const fp = KOA_SIZE[m[1].toUpperCase()];
      const r = decodeResistanceCode(m[2]);
      if (!fp || r == null) return null;
      return { family: 'KOA RK73', categorySlug: 'resistors', footprint: fp, tolerance: TOL_LETTER[m[3].toUpperCase()], params: resParams(r, fp) };
    },
  },
  // Rohm MCR: MCR03EZPFX1002 → 0603, ±1%, 10kΩ
  {
    family: 'Rohm MCR',
    re: /^MCR(\d{2,3})[A-Z0-9]{3}([BDFGJ])[A-Z]([0-9RKM]+)$/i,
    build: (m) => {
      const fp = ROHM_SIZE[m[1]];
      const r = decodeResistanceCode(m[3]);
      if (!fp || r == null) return null;
      return { family: 'Rohm MCR', categorySlug: 'resistors', footprint: fp, tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, fp) };
    },
  },
  // Bourns CR: CR0603-FX-1002ELF → 0603, ±1%, 10kΩ
  {
    family: 'Bourns CR',
    re: /^CR(\d{4})-([BDFGJ])[A-Z]?-([0-9RKM]+)(?:E?LF)?$/i,
    build: (m) => {
      const r = decodeResistanceCode(m[3]);
      if (r == null) return null;
      return { family: 'Bourns CR', categorySlug: 'resistors', footprint: m[1], tolerance: TOL_LETTER[m[2].toUpperCase()], params: resParams(r, m[1]) };
    },
  },
  // Susumu RG (metric size): RG1608P-102-B-T5 → 0603, ±0.1%, 1kΩ
  {
    family: 'Susumu RG',
    re: /^RG(\d{4})[A-Z]?-(\d{3,4})-([BCDFW])/i,
    build: (m) => {
      const fp = METRIC_INCH[m[1]];
      const r = decodeResistanceCode(m[2]);
      if (!fp || r == null) return null;
      const tol = { B: 0.1, C: 0.25, D: 0.5, F: 1, W: 0.05 }[m[3].toUpperCase()];
      return { family: 'Susumu RG', categorySlug: 'resistors', footprint: fp, tolerance: tol, params: resParams(r, fp) };
    },
  },

  // ── Capacitors (MLCC) ──────────────────────────────────────
  // Samsung CL: CL10B104KB8NNNC → 0603, X7R, 100nF, ±10%
  {
    family: 'Samsung CL',
    re: /^CL(\d{2})([A-Z])(\d{3})([BCDFGJKMZ])([A-Z0-9])/i,
    build: (m) => {
      const fp = SIZE2_FOOTPRINT[m[1]];
      const cap = decodeCapacitanceCode(m[3]);
      if (!fp || cap == null) return null;
      const dielectric = { C: 'C0G', B: 'X7R', A: 'X5R', L: 'X8R' }[m[2].toUpperCase()];
      return { family: 'Samsung CL', categorySlug: 'capacitors', footprint: fp, tolerance: TOL_LETTER[m[4].toUpperCase()], dielectric, params: { capacitance: cap } };
    },
  },
  // YAGEO CC: CC0603KRX7R9BB104 → 0603, X7R, 100nF, ±10%
  {
    family: 'YAGEO CC',
    re: /^CC(\d{4})([BCDFGJKMZ])R?([A-Z0-9]{3,4})\w*?(\d{3})$/i,
    build: (m) => {
      if (!CHIP_SIZES.has(m[1])) return null;
      const cap = decodeCapacitanceCode(m[4]);
      if (cap == null) return null;
      return { family: 'YAGEO CC', categorySlug: 'capacitors', footprint: m[1], tolerance: TOL_LETTER[m[2].toUpperCase()], dielectric: normDielectric(m[3]), params: { capacitance: cap } };
    },
  },
  // Murata GRM (cap + tolerance + size; dielectric/voltage left to OCR):
  // GRM188R71H104KA93D → 0603, 100nF, ±10%
  {
    family: 'Murata GRM',
    re: /^G[RC]M(\d{2})\d.*?(\d{3})([BCDFGJKMZ])[A-Z0-9]*$/i,
    build: (m) => {
      const fp = SIZE2_FOOTPRINT[m[1]];
      const cap = decodeCapacitanceCode(m[2]);
      if (!fp || cap == null) return null;
      return { family: 'Murata GRM', categorySlug: 'capacitors', footprint: fp, tolerance: TOL_LETTER[m[3].toUpperCase()], params: { capacitance: cap } };
    },
  },
  // TDK C (metric size): C1608X7R1H104K080AC → 0603, X7R, 50V, 100nF, ±10%
  {
    family: 'TDK C',
    re: /^C(\d{4})([A-Z][0-9][A-Z]|C0G|NP0)([0-9][A-Z])(\d{3})([BCDFGJKMZ])/i,
    build: (m) => {
      const fp = METRIC_INCH[m[1]];
      const cap = decodeCapacitanceCode(m[4]);
      if (!fp || cap == null) return null;
      const params: Record<string, number> = { capacitance: cap };
      const v = VOLT_CODE[m[3].toUpperCase()];
      if (v) params.voltage = v;
      return { family: 'TDK C', categorySlug: 'capacitors', footprint: fp, tolerance: TOL_LETTER[m[5].toUpperCase()], dielectric: normDielectric(m[2]), params };
    },
  },
  // KEMET C (inch size): C0805C104K5RAC → 0805, X7R, 100nF, ±10%
  {
    family: 'KEMET C',
    re: /^C(\d{4})C(\d{3})([BCDFGJKMZ])(\d)([GPRUX])/i,
    build: (m) => {
      if (!CHIP_SIZES.has(m[1])) return null;
      const cap = decodeCapacitanceCode(m[2]);
      if (cap == null) return null;
      const dielectric = { G: 'C0G', R: 'X7R', P: 'X5R', U: 'X8R', X: 'X7R' }[m[5].toUpperCase()];
      return { family: 'KEMET C', categorySlug: 'capacitors', footprint: m[1], tolerance: TOL_LETTER[m[3].toUpperCase()], dielectric, params: { capacitance: cap } };
    },
  },
];

/** Build resistor params: resistance + a typical rated power derived from the size. */
function resParams(resistance: number, footprint: string): Record<string, number> {
  const params: Record<string, number> = { resistance };
  const power = RES_SIZE_POWER[footprint];
  if (power) params.power = power;
  return params;
}

/**
 * Decode a manufacturer part number into structured values. Returns null if no
 * known scheme matches (caller should then fall back to OCR text parsing).
 */
export function decodeMpn(mpn: string): DecodedMpn | null {
  const s = (mpn ?? '').trim();
  if (!s) return null;
  for (const m of MATCHERS) {
    const match = m.re.exec(s);
    if (!match) continue;
    const decoded = m.build(match);
    if (decoded && (Object.keys(decoded.params).length > 0 || decoded.tolerance != null || decoded.footprint)) {
      return decoded;
    }
  }
  return null;
}
