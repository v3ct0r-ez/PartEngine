import { describe, expect, it } from 'vitest';
import type { FieldTemplate } from './category-fields.js';
import {
  MAX_PARAM_MAGNITUDE,
  isStorableNumber,
  projectParameters,
  validateParameters,
} from './validation.js';

const f = (over: Partial<FieldTemplate> & Pick<FieldTemplate, 'key' | 'type'>): FieldTemplate => ({
  label: over.label ?? over.key,
  ...over,
});

describe('isStorableNumber', () => {
  it('accepts finite values within Decimal(40,12) range', () => {
    expect(isStorableNumber(0)).toBe(true);
    expect(isStorableNumber(-1234.5)).toBe(true);
    expect(isStorableNumber(1e26)).toBe(true);
  });

  it('rejects non-finite and out-of-range magnitudes', () => {
    expect(isStorableNumber(Infinity)).toBe(false);
    expect(isStorableNumber(-Infinity)).toBe(false);
    expect(isStorableNumber(NaN)).toBe(false);
    expect(isStorableNumber(MAX_PARAM_MAGNITUDE)).toBe(false);
    expect(isStorableNumber(1e30)).toBe(false);
  });
});

describe('validateParameters', () => {
  it('flags missing required fields and skips empty optional ones', () => {
    const fields = [
      f({ key: 'resistance', label: 'Valore', type: 'QUANTITY', unit: 'Ω', required: true }),
      f({ key: 'power', label: 'Potenza', type: 'QUANTITY', unit: 'W' }),
    ];
    const errors = validateParameters(fields, { power: '' });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ field: 'resistance', message: 'Valore è obbligatorio' });
  });

  it('treats null and undefined as empty', () => {
    const fields = [f({ key: 'x', type: 'QUANTITY', unit: 'Ω', required: true })];
    expect(validateParameters(fields, { x: null })).toHaveLength(1);
    expect(validateParameters(fields, {})).toHaveLength(1);
  });

  it('rejects an unparseable QUANTITY', () => {
    const fields = [f({ key: 'r', label: 'Valore', type: 'QUANTITY', unit: 'Ω' })];
    const errors = validateParameters(fields, { r: 'abc' });
    expect(errors[0].message).toContain('valore non valido');
  });

  it('rejects an out-of-range QUANTITY magnitude', () => {
    const fields = [f({ key: 'r', label: 'Valore', type: 'QUANTITY', unit: 'Ω' })];
    const errors = validateParameters(fields, { r: '1e30' });
    expect(errors[0].message).toContain('fuori intervallo');
  });

  it('enforces QUANTITY min/max bounds', () => {
    const fields = [
      f({ key: 'r', label: 'Valore', type: 'QUANTITY', unit: 'Ω', validation: { min: 10, max: 100 } }),
    ];
    expect(validateParameters(fields, { r: '5' })[0].message).toContain('minimo 10');
    expect(validateParameters(fields, { r: '200' })[0].message).toContain('massimo 100');
    expect(validateParameters(fields, { r: '50' })).toHaveLength(0);
  });

  it('validates NUMBER fields', () => {
    const fields = [f({ key: 'pins', label: 'Pin', type: 'NUMBER' })];
    expect(validateParameters(fields, { pins: 'x' })[0].message).toContain('numerico');
    expect(validateParameters(fields, { pins: '1e400' })[0].message).toContain('fuori intervallo');
    expect(validateParameters(fields, { pins: '48' })).toHaveLength(0);
  });

  it('validates ENUM membership', () => {
    const fields = [f({ key: 'm', label: 'Tipo', type: 'ENUM', options: ['SMD', 'THT'] })];
    expect(validateParameters(fields, { m: 'BGA' })[0].message).toContain('non ammesso');
    expect(validateParameters(fields, { m: 'SMD' })).toHaveLength(0);
  });

  it('validates BOOLEAN type', () => {
    const fields = [f({ key: 'p', label: 'Polarizzato', type: 'BOOLEAN' })];
    expect(validateParameters(fields, { p: 'yes' })[0].message).toContain('vero/falso');
    expect(validateParameters(fields, { p: true })).toHaveLength(0);
  });

  it('validates STRING/TEXT against a regex when present', () => {
    const fields = [
      f({ key: 's', label: 'Sigla', type: 'STRING', validation: { regex: '^[A-Z]+$' } }),
    ];
    expect(validateParameters(fields, { s: 'abc' })[0].message).toContain('formato non valido');
    expect(validateParameters(fields, { s: 'ABC' })).toHaveLength(0);
    // No regex → anything goes.
    expect(validateParameters([f({ key: 't', type: 'TEXT' })], { t: 'free text' })).toHaveLength(0);
  });

  it('ignores unknown field types', () => {
    const fields = [f({ key: 'd', label: 'Data', type: 'DATE' })];
    expect(validateParameters(fields, { d: '2026-01-01' })).toHaveLength(0);
  });
});

describe('projectParameters', () => {
  const fields = [
    f({ key: 'r', label: 'Valore', type: 'QUANTITY', unit: 'Ω' }),
    f({ key: 'pins', label: 'Pin', type: 'NUMBER' }),
    f({ key: 'pol', label: 'Polarizzato', type: 'BOOLEAN' }),
    f({ key: 'fam', label: 'Famiglia', type: 'STRING' }),
  ];

  it('stores QUANTITY as base-SI magnitude and other types in their column', () => {
    const rows = projectParameters(fields, { r: '10k', pins: '48', pol: true, fam: 'STM32' });
    expect(rows).toEqual([
      { fieldKey: 'r', numeric: 10000, text: null, boolean: null },
      { fieldKey: 'pins', numeric: 48, text: null, boolean: null },
      { fieldKey: 'pol', numeric: null, text: null, boolean: true },
      { fieldKey: 'fam', numeric: null, text: 'STM32', boolean: null },
    ]);
  });

  it('skips empty values', () => {
    expect(projectParameters(fields, { r: '', pins: null, fam: undefined })).toHaveLength(0);
  });

  it('nulls out unparseable or out-of-range numerics instead of overflowing', () => {
    const rows = projectParameters(fields, { r: 'abc', pins: '1e400' });
    expect(rows).toEqual([
      { fieldKey: 'r', numeric: null, text: null, boolean: null },
      { fieldKey: 'pins', numeric: null, text: null, boolean: null },
    ]);
  });
});
