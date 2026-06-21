import { describe, expect, it } from 'vitest';
import { categoryCodePrefix, composeNaming, generateComponentName, generateInternalCode } from './naming.js';

describe('categoryCodePrefix', () => {
  it('uses known prefixes, falls back to slug', () => {
    expect(categoryCodePrefix('resistors')).toBe('R');
    expect(categoryCodePrefix('capacitors')).toBe('C');
    expect(categoryCodePrefix('crystals', 'Quarzi')).toBe('CRY');
    expect(categoryCodePrefix(undefined, 'Relè')).toBe('REL');
  });
});

describe('generateComponentName', () => {
  it('joins category + value + footprint + tolerance', () => {
    expect(
      generateComponentName({ categoryName: 'Resistenza', value: '10kΩ', footprint: '0603', tolerance: 1 }),
    ).toBe('Resistenza 10kΩ 0603 1%');
  });
  it('omits missing parts', () => {
    expect(generateComponentName({ categoryName: 'Condensatore', value: '100nF' })).toBe('Condensatore 100nF');
  });
  it('includes the colour descriptor right after the category (LED)', () => {
    expect(
      generateComponentName({ categoryName: 'LED', color: 'Rosso', value: '2.7V', footprint: '0603' }),
    ).toBe('LED Rosso 2.7V 0603');
  });
});

describe('generateInternalCode', () => {
  it('builds a standardised code', () => {
    expect(generateInternalCode({ prefix: 'R', value: '10kΩ', footprint: '0603' })).toBe('R-10K-0603');
    expect(generateInternalCode({ prefix: 'C', value: '100nF' })).toBe('C-100NF');
  });
  it('includes the colour when present', () => {
    expect(generateInternalCode({ prefix: 'D', color: 'Rosso', value: '2.7V', footprint: '0603' })).toBe('D-ROSSO-2.7V-0603');
  });
});

describe('composeNaming', () => {
  const led = [
    { key: 'color', type: 'ENUM' },
    { key: 'vf', type: 'QUANTITY', unit: 'V' },
    { key: 'if_forward', type: 'QUANTITY', unit: 'A' },
    { key: 'mount', type: 'ENUM' },
    { key: 'footprint', type: 'ENUM' },
  ];
  it('includes every set quantity of an LED (colour + Vf + If + footprint)', () => {
    const r = composeNaming({ categoryName: 'LED', prefix: 'D', fields: led, params: { color: 'Rosso', vf: '2.7', footprint: '0603', if_forward: '0.02', mount: 'SMD' } });
    expect(r.name).toBe('LED Rosso 2.7V 20mA 0603'); // construction mount excluded, ratings kept
    expect(r.code).toBe('D-ROSSO-2.7V-20MA-0603');
  });

  const resistor = [
    { key: 'resistance', type: 'QUANTITY', unit: 'Ω' },
    { key: 'tolerance', type: 'QUANTITY', unit: '%' },
    { key: 'technology', type: 'ENUM' },
    { key: 'footprint', type: 'ENUM' },
    { key: 'series', type: 'ENUM' },
  ];
  it('keeps construction enums (technology/series) out but puts tolerance in name AND code', () => {
    const r = composeNaming({ categoryName: 'Resistenze', prefix: 'R', fields: resistor, params: { resistance: '10k', tolerance: '1', technology: 'Thick Film', footprint: '0603', series: 'E24' } });
    expect(r.name).toBe('Resistenze 10kΩ 1% 0603');
    expect(r.code).toBe('R-10K-1PCT-0603'); // tolerance encoded; technology/series stay out
  });

  it('gives two resistors that differ only by tolerance distinct codes', () => {
    const params = (tol: string) => ({ resistance: '10k', tolerance: tol, footprint: '0603' });
    const a = composeNaming({ categoryName: 'Resistenze', prefix: 'R', fields: resistor, params: params('1') });
    const b = composeNaming({ categoryName: 'Resistenze', prefix: 'R', fields: resistor, params: params('5') });
    expect(a.code).toBe('R-10K-1PCT-0603');
    expect(b.code).toBe('R-10K-5PCT-0603');
    expect(a.code).not.toBe(b.code);
  });

  const capacitor = [
    { key: 'capacitance', type: 'QUANTITY', unit: 'F' },
    { key: 'voltage', type: 'QUANTITY', unit: 'V' },
    { key: 'tolerance', type: 'QUANTITY', unit: '%' },
    { key: 'dielectric', type: 'ENUM' },
    { key: 'footprint', type: 'ENUM' },
  ];
  it('includes the voltage rating of a capacitor in name and code', () => {
    const r = composeNaming({ categoryName: 'Condensatore', prefix: 'C', fields: capacitor, params: { capacitance: '100n', voltage: '25', tolerance: '10', dielectric: 'X7R', footprint: '0603' } });
    expect(r.name).toBe('Condensatore 100nF 25V 10% X7R 0603');
    expect(r.code).toBe('C-100NF-25V-10PCT-X7R-0603');
  });

  it('uses the package string as the footprint equivalent (ICs)', () => {
    const fields = [
      { key: 'channel', type: 'ENUM' },
      { key: 'vds', type: 'QUANTITY', unit: 'V' },
      { key: 'package', type: 'STRING' },
    ];
    const r = composeNaming({ categoryName: 'MOSFET', prefix: 'Q', fields, params: { channel: 'N', vds: '30', package: 'SOT-23' } });
    expect(r.name).toBe('MOSFET N 30V SOT-23');
    expect(r.code).toBe('Q-N-30V-SOT23');
  });
});
