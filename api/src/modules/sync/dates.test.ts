import { describe, expect, it } from 'vitest';

import { addDays, localToday } from './dates';

describe('localToday', () => {
  it('uses the property-local date, not the UTC date', () => {
    expect(localToday('2026-10-28T06:30:00Z', 'America/Los_Angeles')).toBe('2026-10-27'); // day 1, 23:30 PDT
  });

  it('turns over at local midnight', () => {
    expect(localToday('2026-10-28T06:59:59Z', 'America/Los_Angeles')).toBe('2026-10-27');
    expect(localToday('2026-10-28T07:00:00Z', 'America/Los_Angeles')).toBe('2026-10-28');
  });

  it('follows the offset across the end of daylight saving time', () => {
    // PDT (UTC-7) ends on 2026-11-01, so the same UTC time falls on different local sides of midnight.
    expect(localToday('2026-11-01T07:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01');
    expect(localToday('2026-11-02T07:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01');
  });

  it('works in winter, at UTC-8', () => {
    expect(localToday('2026-12-15T07:59:00Z', 'America/Los_Angeles')).toBe('2026-12-14');
    expect(localToday('2026-12-15T08:00:00Z', 'America/Los_Angeles')).toBe('2026-12-15');
  });

  it('works in other timezones', () => {
    expect(localToday('2026-10-28T06:30:00Z', 'Asia/Tokyo')).toBe('2026-10-28');
  });
});

describe('addDays', () => {
  it('moves back and forth within a month', () => {
    expect(addDays('2026-10-27', -13)).toBe('2026-10-14');
    expect(addDays('2026-10-27', 1)).toBe('2026-10-28');
  });

  it('crosses months and years', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts leap days', () => {
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is not shifted by daylight saving time', () => {
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
  });
});
