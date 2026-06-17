import { describe, expect, it } from 'vitest';
import { TAXONOMY, taxonomyLeaves } from './taxonomy.js';

describe('TAXONOMY', () => {
  it('has unique slugs across groups and leaves', () => {
    const slugs = [
      ...TAXONOMY.map((g) => g.slug),
      ...TAXONOMY.flatMap((g) => g.categories.map((c) => c.slug)),
    ];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every leaf has a code prefix and at least one field', () => {
    for (const leaf of taxonomyLeaves()) {
      expect(leaf.codePrefix, leaf.slug).toBeTruthy();
      expect(leaf.fields.length, leaf.slug).toBeGreaterThan(0);
    }
  });

  it('ENUM fields declare options; QUANTITY fields declare a unit', () => {
    for (const leaf of taxonomyLeaves()) {
      for (const f of leaf.fields) {
        if (f.type === 'ENUM') expect(f.options?.length, `${leaf.slug}.${f.key}`).toBeGreaterThan(0);
        if (f.type === 'QUANTITY') expect(f.unit, `${leaf.slug}.${f.key}`).toBeTruthy();
      }
    }
  });
});
