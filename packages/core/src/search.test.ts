import { describe, expect, it } from 'vitest';
import { buildCategoryKeywords, parseSearchQuery } from './search.js';

describe('parseSearchQuery', () => {
  it('parses "resistenza 10k 1% 0603"', () => {
    const q = parseSearchQuery('resistenza 10k 1% 0603');
    expect(q.category).toBe('resistors');
    expect(q.params.resistance).toBe(10_000);
    expect(q.tolerance).toBe(1);
    expect(q.footprint).toBe('0603');
    expect(q.text).toEqual([]);
  });

  it('parses "condensatore 100nF x7r"', () => {
    const q = parseSearchQuery('condensatore 100nF x7r');
    expect(q.category).toBe('capacitors');
    expect(q.params.capacitance).toBeCloseTo(100e-9);
    expect(q.dielectric).toBe('X7R');
  });

  it('parses "buck converter 12V 5A"', () => {
    const q = parseSearchQuery('buck converter 12V 5A');
    expect(q.category).toBe('buck_converter');
    expect(q.params.voltage).toBe(12);
    expect(q.params.current).toBe(5);
    // "converter" is a leftover word for full-text search
    expect(q.text).toContain('converter');
  });

  it('keeps unrecognised words as free text', () => {
    const q = parseSearchQuery('STM32F103 microcontrollore');
    expect(q.category).toBe('microcontrollers');
    expect(q.text).toContain('STM32F103');
  });

  it('recognises custom categories via buildCategoryKeywords', () => {
    const keywords = buildCategoryKeywords([
      { slug: 'crystals', name: 'Quarzi' },
      { slug: 'optocouplers', name: 'Opto Isolatori' },
    ]);
    // by slug
    expect(parseSearchQuery('crystals 16MHz', { categoryKeywords: keywords }).category).toBe('crystals');
    // by (custom) name
    expect(parseSearchQuery('quarzi', { categoryKeywords: keywords }).category).toBe('crystals');
    // by a word of a multi-word name
    expect(parseSearchQuery('optocouplers', { categoryKeywords: keywords }).category).toBe('optocouplers');
    expect(parseSearchQuery('isolatori', { categoryKeywords: keywords }).category).toBe('optocouplers');
    // without the map, the custom keyword is just free text
    expect(parseSearchQuery('quarzi').category).toBeUndefined();
  });
});
