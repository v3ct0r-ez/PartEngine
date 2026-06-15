/**
 * Semantic-version utilities — the single source of truth for "is there a newer
 * version?", shared by the API update checker and the web update banner.
 *
 * Kept pure and dependency-free so the comparison logic is unit-tested in
 * isolation and behaves identically on server and client.
 */

/** Current application version. Overridden at runtime by the APP_VERSION env. */
export const APP_VERSION = '0.1.0';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated prerelease identifiers (e.g. "rc.1"), or undefined for releases. */
  prerelease?: string;
}

/** Parse "1.2.3", "v1.2.3", "1.2.3-rc.1" (build metadata after "+" is ignored). */
export function parseSemver(input: string): SemVer | null {
  if (!input) return null;
  const cleaned = input.trim().replace(/^v/i, '').split('+')[0];
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(cleaned);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || undefined,
  };
}

function comparePrerelease(a?: string, b?: string): number {
  // No prerelease outranks a prerelease (1.0.0 > 1.0.0-rc.1).
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x);
    const ny = Number(y);
    const bothNumeric = !Number.isNaN(nx) && !Number.isNaN(ny);
    const cmp = bothNumeric ? nx - ny : x.localeCompare(y);
    if (cmp !== 0) return cmp < 0 ? -1 : 1;
  }
  return 0;
}

/** Returns -1 if a<b, 0 if equal, 1 if a>b. Unparseable versions sort lowest. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  }
  const pre = comparePrerelease(pa.prerelease, pb.prerelease);
  return pre < 0 ? -1 : pre > 0 ? 1 : 0;
}

/** True when `candidate` is strictly newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}
