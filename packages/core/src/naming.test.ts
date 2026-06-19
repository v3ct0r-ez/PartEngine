import { describe, expect, it } from 'vitest';
import { categoryCodePrefix, generateComponentName, generateInternalCode } from './naming.js';

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
