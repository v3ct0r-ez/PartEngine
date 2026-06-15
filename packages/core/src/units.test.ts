import { describe, expect, it } from 'vitest';
import {
  compareQuantities,
  formatEngineering,
  parseQuantity,
  sortByEngineeringValue,
} from './units.js';

describe('parseQuantity', () => {
  it('parses plain SI-prefixed values', () => {
    expect(parseQuantity('10k')?.magnitude).toBe(10_000);
    expect(parseQuantity('4.7k')?.magnitude).toBeCloseTo(4_700);
    expect(parseQuantity('100')?.magnitude).toBe(100);
    expect(parseQuantity('1M')?.magnitude).toBe(1_000_000);
  });

  it('parses values with units', () => {
    const r = parseQuantity('4.7kΩ');
    expect(r?.magnitude).toBeCloseTo(4_700);
    expect(r?.unit).toBe('Ω');

    expect(parseQuantity('100nF')?.magnitude).toBeCloseTo(100e-9);
    expect(parseQuantity('0.1µF')?.magnitude).toBeCloseTo(0.1e-6);
    expect(parseQuantity('2.2uF')?.magnitude).toBeCloseTo(2.2e-6);
    expect(parseQuantity('470pF')?.magnitude).toBeCloseTo(470e-12);
  });

  it('parses EIA notation (prefix as decimal point)', () => {
    expect(parseQuantity('4k7')?.magnitude).toBeCloseTo(4_700);
    expect(parseQuantity('4R7')?.magnitude).toBeCloseTo(4.7);
    expect(parseQuantity('2M2')?.magnitude).toBeCloseTo(2_200_000);
    expect(parseQuantity('1R0')?.magnitude).toBeCloseTo(1.0);
  });

  it('handles European decimal comma', () => {
    expect(parseQuantity('4,7k')?.magnitude).toBeCloseTo(4_700);
  });

  it('returns null for non-numeric input', () => {
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });

  it('distinguishes Hz from a stray H', () => {
    expect(parseQuantity('16MHz')?.unit).toBe('Hz');
    expect(parseQuantity('10µH')?.unit).toBe('H');
  });
});

describe('compareQuantities & sorting', () => {
  it('orders resistor values by magnitude, not alphabetically', () => {
    const input = ['1kΩ', '100kΩ', '100Ω', '4.7kΩ', '1MΩ', '220Ω', '10kΩ', '2.2kΩ', '470Ω'];
    const sorted = sortByEngineeringValue(input, (v) => v);
    expect(sorted).toEqual([
      '100Ω',
      '220Ω',
      '470Ω',
      '1kΩ',
      '2.2kΩ',
      '4.7kΩ',
      '10kΩ',
      '100kΩ',
      '1MΩ',
    ]);
  });

  it('sorts descending', () => {
    expect(sortByEngineeringValue(['1k', '100', '1M'], (v) => v, 'desc')).toEqual([
      '1M',
      '1k',
      '100',
    ]);
  });

  it('compareQuantities matches expectations', () => {
    expect(compareQuantities('1kΩ', '470Ω')).toBeGreaterThan(0);
    expect(compareQuantities('100nF', '1µF')).toBeLessThan(0);
  });
});

describe('formatEngineering', () => {
  it('round-trips magnitudes into engineering strings', () => {
    expect(formatEngineering(4_700, 'Ω')).toBe('4.7kΩ');
    expect(formatEngineering(1_000_000, 'Ω')).toBe('1MΩ');
    expect(formatEngineering(100e-9, 'F')).toBe('100nF');
    expect(formatEngineering(0, 'Ω')).toBe('0Ω');
  });
});
