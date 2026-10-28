import { describe, expect, it } from 'vitest';

import { parseLakesideDate } from './normalize';

describe('parseLakesideDate', () => {
  it('turns MM/DD/YYYY into ISO', () => {
    expect(parseLakesideDate('10/17/2026')).toBe('2026-10-17');
  });

  it('keeps leading zeros', () => {
    expect(parseLakesideDate('09/01/2026')).toBe('2026-09-01');
  });

  it('accepts a leap day', () => {
    expect(parseLakesideDate('02/29/2028')).toBe('2028-02-29');
  });

  it('reads an empty string as no date', () => {
    expect(parseLakesideDate('')).toBeNull(); // Carol's moveOutDate
  });

  it('reads null and a missing field as no date', () => {
    expect(parseLakesideDate(null)).toBeNull();
    expect(parseLakesideDate(undefined)).toBeNull();
  });

  // Anything else breaks the contract, so it is rejected rather than guessed at.
  it.each([
    ['a missing leading zero', '10/1/2026'],
    ['an ISO date', '2026-10-17'],
    ['a month that does not exist', '13/01/2026'],
    ['a day that does not exist', '02/30/2026'],
    ['a leap day in a common year', '02/29/2026'],
    ['surrounding whitespace', ' 10/17/2026'],
    ['a number', 20261017],
  ])('rejects %s', (_, value) => {
    expect(() => parseLakesideDate(value)).toThrow('Expected a Lakeside date (MM/DD/YYYY)');
  });
});
