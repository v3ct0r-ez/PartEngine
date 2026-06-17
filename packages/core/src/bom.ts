/**
 * BOM availability logic + a tiny CSV parser — pure and unit-tested. The API
 * computes per-line availability from stock and uses these to classify lines and
 * the whole BOM (available / partially available / missing).
 */

export type AvailabilityStatus = 'AVAILABLE' | 'PARTIAL' | 'MISSING';

/** Status of a single BOM line given how much is required vs available. */
export function lineStatus(required: number, available: number): AvailabilityStatus {
  if (required <= 0) return 'AVAILABLE';
  if (available >= required) return 'AVAILABLE';
  if (available > 0) return 'PARTIAL';
  return 'MISSING';
}

/** Roll the per-line statuses up to a single BOM status. */
export function bomOverallStatus(statuses: readonly AvailabilityStatus[]): AvailabilityStatus {
  if (statuses.length === 0) return 'AVAILABLE';
  if (statuses.every((s) => s === 'AVAILABLE')) return 'AVAILABLE';
  if (statuses.every((s) => s === 'MISSING')) return 'MISSING';
  return 'PARTIAL';
}

export interface ParsedBomLine {
  mpn?: string;
  reference?: string;
  quantity: number;
}

/**
 * Parse a simple BOM CSV. The header row maps columns by name (case-insensitive):
 * mpn / part / partnumber, reference / ref / designator, quantity / qty / qnt.
 * Lines with a non-positive/invalid quantity are skipped.
 */
/** Split one CSV row honoring double-quoted fields (which may contain the delimiter). */
function splitCsvRow(row: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseBomCsv(csv: string): ParsedBomLine[] {
  const rows = csv
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length < 2) return [];

  const delimiter = rows[0].includes(';') && !rows[0].includes(',') ? ';' : ',';
  const header = splitCsvRow(rows[0], delimiter).map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const mpnCol = idx(['mpn', 'part', 'partnumber', 'part number', 'codice']);
  const refCol = idx(['reference', 'ref', 'designator', 'references', 'riferimento']);
  const qtyCol = idx(['quantity', 'qty', 'qnt', 'q.tà', 'quantità']);

  const out: ParsedBomLine[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsvRow(row, delimiter);
    const quantity = Number((qtyCol >= 0 ? cells[qtyCol] : '').replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    out.push({
      mpn: mpnCol >= 0 ? cells[mpnCol] || undefined : undefined,
      reference: refCol >= 0 ? cells[refCol] || undefined : undefined,
      quantity,
    });
  }
  return out;
}
