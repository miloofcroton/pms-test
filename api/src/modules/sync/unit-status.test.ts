import { describe, expect, it } from 'vitest';

import { mapUnitStatus } from './unit-status';

describe('mapUnitStatus', () => {
  it.each([
    ['O1', 'Occupied'],
    ['O2', 'Occupied'],
    ['V1', 'Vacant'],
    ['V2', 'Vacant'],
    ['M', 'Model'],
    ['C', 'Common Area'],
  ])('maps %s to %s', (code, status) => {
    expect(mapUnitStatus(code)).toBe(status);
  });

  it.each([
    ['an unknown code', 'O3'], // 5009
    ['another unknown code', 'X'], // 5016
    ['D, which is not in the table', 'D'], // 5015 on day 2
    ['a lowercase code, because the table is exact', 'o1'], // 5008 on day 1
    ['an empty code', ''], // 5012 on day 1
    ['a missing code', null], // 5015 on day 1
    ['a name inherited from Object', 'toString'],
  ])('maps %s to Down', (_, code) => {
    expect(mapUnitStatus(code)).toBe('Down');
  });
});
