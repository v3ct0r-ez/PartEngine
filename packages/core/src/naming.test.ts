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
  it('includes the recognition params of an LED (colour + value + footprint)', () => {
    const r = composeNaming({ categoryName: 'LED', prefix: 'D', fields: led, params: { color: 'Rosso', vf: '2.7', footprint: '0603', if_forward: '0.02', mount: 'SMD' } });
    expect(r.name).toBe('LED Rosso 2.7V 0603'); // mount + secondary current excluded
    expect(r.code).toBe('D-ROSSO-2.7V-0603');
  });

  const resistor = [
    { key: 'resistance', type: 'QUANTITY', unit: 'Ω' },
    { key: 'tolerance', type: 'QUANTITY', unit: '%' },
    { key: 'technology', type: 'ENUM' },
    { key: 'footprint', type: 'ENUM' },
    { key: 'series', type: 'ENUM' },
  ];
  it('keeps construction enums (technology/series) out, tolerance in the name only', () => {
    const r = composeNaming({ categoryName: 'Resistenze', prefix: 'R', fields: resistor, params: { resistance: '10k', tolerance: '1', technology: 'Thick Film', footprint: '0603', series: 'E24' } });
    expect(r.name).toBe('Resistenze 10kΩ 1% 0603');
    expect(r.code).toBe('R-10K-0603'); // no tolerance/technology/series in the code
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
