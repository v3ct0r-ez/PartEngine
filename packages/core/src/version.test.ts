import { describe, expect, it } from 'vitest';
import { compareSemver, isNewerVersion, parseSemver } from './version.js';

describe('parseSemver', () => {
  it('parses plain and v-prefixed versions', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: undefined });
    expect(parseSemver('v0.10.0')).toMatchObject({ major: 0, minor: 10, patch: 0 });
  });
  it('parses prerelease and ignores build metadata', () => {
    expect(parseSemver('1.0.0-rc.1+build.5')).toMatchObject({ patch: 0, prerelease: 'rc.1' });
  });
  it('returns null for garbage', () => {
    expect(parseSemver('not-a-version')).toBeNull();
    expect(parseSemver('')).toBeNull();
  });
});

describe('compareSemver', () => {
  it('orders by major/minor/patch', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('1.2.0', '1.10.0')).toBe(-1); // numeric, not lexical
    expect(compareSemver('1.0.1', '1.0.1')).toBe(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
  });
  it('treats a release as newer than its prerelease', () => {
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1);
  });
});

describe('isNewerVersion', () => {
  it('detects available updates', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(true);
    expect(isNewerVersion('v0.1.1', '0.1.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false);
  });
});
