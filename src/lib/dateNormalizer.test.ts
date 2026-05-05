import { describe, it, expect } from 'vitest';
import { toISODate } from './dateNormalizer';

describe('toISODate', () => {
  it('returns undefined for non-strings (number, null, undefined, {})', () => {
    expect(toISODate(123)).toBeUndefined();
    expect(toISODate(null)).toBeUndefined();
    expect(toISODate(undefined)).toBeUndefined();
    expect(toISODate({})).toBeUndefined();
  });

  it('returns undefined for empty string and whitespace-only string', () => {
    expect(toISODate('')).toBeUndefined();
    expect(toISODate('   ')).toBeUndefined();
  });

  it('passes through ISO format unchanged: "1985-04-17" → "1985-04-17"', () => {
    expect(toISODate('1985-04-17')).toBe('1985-04-17');
  });

  it('converts MM-DD-YYYY: "04-17-1985" → "1985-04-17"', () => {
    expect(toISODate('04-17-1985')).toBe('1985-04-17');
  });

  it('converts MM/DD/YYYY: "04/17/1985" → "1985-04-17"', () => {
    expect(toISODate('04/17/1985')).toBe('1985-04-17');
  });

  it('pads single-digit month and day: "4-7-1985" → "1985-04-07"', () => {
    expect(toISODate('4-7-1985')).toBe('1985-04-07');
  });

  it('falls back to Date.parse for human-readable dates: "April 17, 1985" → "1985-04-17"', () => {
    expect(toISODate('April 17, 1985')).toBe('1985-04-17');
  });

  it('returns undefined for unparseable garbage: "not a date" → undefined', () => {
    expect(toISODate('not a date')).toBeUndefined();
  });
});
