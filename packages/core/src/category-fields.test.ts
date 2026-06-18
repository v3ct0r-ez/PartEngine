import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TEMPLATES,
  FOOTPRINTS_SMD,
  RESISTOR_SERIES,
  getCategoryTemplate,
} from './category-fields.js';

describe('category templates', () => {
  it('exposes a non-empty, unique set of category slugs', () => {
    const slugs = CATEGORY_TEMPLATES.map((c) => c.slug);
    expect(slugs.length).toBeGreaterThan(0);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every field a key, label and type, with unique keys per category', () => {
    for (const cat of CATEGORY_TEMPLATES) {
      const keys = cat.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const field of cat.fields) {
        expect(field.key).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(field.type).toBeTruthy();
      }
    }
  });

  it('declares a unit for every QUANTITY field and options for every ENUM field', () => {
    for (const cat of CATEGORY_TEMPLATES) {
      for (const field of cat.fields) {
        if (field.type === 'QUANTITY') expect(field.unit, `${cat.slug}.${field.key}`).toBeTruthy();
        if (field.type === 'ENUM') expect(field.options?.length, `${cat.slug}.${field.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('reuses the shared footprint and series option lists', () => {
    const resistor = getCategoryTemplate('resistors')!;
    const footprint = resistor.fields.find((f) => f.key === 'footprint')!;
    expect(footprint.options).toEqual(expect.arrayContaining(FOOTPRINTS_SMD));
    const series = resistor.fields.find((f) => f.key === 'series')!;
    expect(series.options).toEqual(RESISTOR_SERIES);
  });
});

describe('getCategoryTemplate', () => {
  it('finds a template by slug', () => {
    expect(getCategoryTemplate('capacitors')?.name).toBe('Condensatori');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCategoryTemplate('nope')).toBeUndefined();
  });
});
