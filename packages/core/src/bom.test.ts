import { describe, expect, it } from 'vitest';
import { bomOverallStatus, lineStatus, parseBomCsv } from './bom.js';

describe('lineStatus', () => {
  it('classifies a line', () => {
    expect(lineStatus(10, 10)).toBe('AVAILABLE');
    expect(lineStatus(10, 20)).toBe('AVAILABLE');
    expect(lineStatus(10, 4)).toBe('PARTIAL');
    expect(lineStatus(10, 0)).toBe('MISSING');
  });
});

describe('bomOverallStatus', () => {
  it('rolls up line statuses', () => {
    expect(bomOverallStatus(['AVAILABLE', 'AVAILABLE'])).toBe('AVAILABLE');
    expect(bomOverallStatus(['MISSING', 'MISSING'])).toBe('MISSING');
    expect(bomOverallStatus(['AVAILABLE', 'MISSING'])).toBe('PARTIAL');
    expect(bomOverallStatus([])).toBe('AVAILABLE');
  });
});

describe('parseBomCsv', () => {
  it('parses headered CSV mapping columns by name', () => {
    const csv = 'MPN,Reference,Quantity\nRC0603FR-0710KL,"R1,R2",2\nGRM188R71C104KA01,C1,1';
    const lines = parseBomCsv(csv);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ mpn: 'RC0603FR-0710KL', quantity: 2 });
    expect(lines[1]).toMatchObject({ mpn: 'GRM188R71C104KA01', quantity: 1 });
  });
  it('skips invalid quantities and supports ; delimiter', () => {
    const csv = 'mpn;qty\nABC;3\nDEF;0\nGHI;x';
    const lines = parseBomCsv(csv);
    expect(lines).toEqual([{ mpn: 'ABC', reference: undefined, quantity: 3 }]);
  });
});
