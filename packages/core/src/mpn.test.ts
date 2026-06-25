import { describe, expect, it } from 'vitest';
import { decodeMpn, decodeResistanceCode, decodeCapacitanceCode } from './mpn.js';

describe('decodeResistanceCode', () => {
  it('decodes R/K/M decimal-point notation', () => {
    expect(decodeResistanceCode('100K')).toBe(100_000);
    expect(decodeResistanceCode('10K0')).toBe(10_000);
    expect(decodeResistanceCode('4R7')).toBeCloseTo(4.7);
    expect(decodeResistanceCode('1M00')).toBe(1_000_000);
    expect(decodeResistanceCode('R100')).toBeCloseTo(0.1);
  });
  it('decodes EIA digit-multiplier notation', () => {
    expect(decodeResistanceCode('103')).toBe(10_000);
    expect(decodeResistanceCode('1002')).toBe(10_000);
    expect(decodeResistanceCode('1000')).toBe(100);
  });
});

describe('decodeCapacitanceCode', () => {
  it('decodes EIA pF code to Farads', () => {
    expect(decodeCapacitanceCode('104')).toBeCloseTo(1e-7); // 100 nF
    expect(decodeCapacitanceCode('220')).toBeCloseTo(22e-12);
    expect(decodeCapacitanceCode('4R7')).toBeCloseTo(4.7e-12);
  });
});

describe('decodeMpn — resistors', () => {
  it('decodes the YAGEO RC example RC0603FR-07100KL', () => {
    const d = decodeMpn('RC0603FR-07100KL')!;
    expect(d.family).toBe('YAGEO RC');
    expect(d.categorySlug).toBe('resistors');
    expect(d.footprint).toBe('0603');
    expect(d.tolerance).toBe(1);
    expect(d.params.resistance).toBe(100_000);
    expect(d.params.power).toBeCloseTo(0.1); // 0603 → 100 mW
  });
  it('decodes Vishay CRCW060310K0FKEA', () => {
    const d = decodeMpn('CRCW060310K0FKEA')!;
    expect(d.footprint).toBe('0603');
    expect(d.params.resistance).toBe(10_000);
    expect(d.tolerance).toBe(1);
  });
  it('decodes Stackpole RMCF0805JT1K00', () => {
    const d = decodeMpn('RMCF0805JT1K00')!;
    expect(d.footprint).toBe('0805');
    expect(d.params.resistance).toBe(1_000);
    expect(d.tolerance).toBe(5);
  });
  it('decodes Panasonic ERJ-3EKF1002V', () => {
    const d = decodeMpn('ERJ-3EKF1002V')!;
    expect(d.footprint).toBe('0603');
    expect(d.params.resistance).toBe(10_000);
    expect(d.tolerance).toBe(1);
  });
});

describe('decodeMpn — capacitors', () => {
  it('decodes Samsung CL10B104KB8NNNC', () => {
    const d = decodeMpn('CL10B104KB8NNNC')!;
    expect(d.categorySlug).toBe('capacitors');
    expect(d.footprint).toBe('0603');
    expect(d.params.capacitance).toBeCloseTo(1e-7); // 100 nF
    expect(d.tolerance).toBe(10);
    expect(d.dielectric).toBe('X7R');
  });
  it('decodes Murata GRM188R71H104KA93D', () => {
    const d = decodeMpn('GRM188R71H104KA93D')!;
    expect(d.footprint).toBe('0603');
    expect(d.params.capacitance).toBeCloseTo(1e-7);
    expect(d.tolerance).toBe(10);
  });
});

describe('decodeMpn — unknown', () => {
  it('returns null for an unrecognised MPN', () => {
    expect(decodeMpn('LM358DR')).toBeNull();
    expect(decodeMpn('')).toBeNull();
  });
});
