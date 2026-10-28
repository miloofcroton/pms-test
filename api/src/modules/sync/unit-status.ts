// The brief's mapping from a Lakeside `unitStatus` code to a RentLive unit status.

import type { UnitStatus } from '~/modules/rentlive/contract';

// A Map rather than an object, so a code like `toString` can't match something inherited.
const STATUS_BY_CODE = new Map<string, UnitStatus>([
  ['O1', 'Occupied'],
  ['O2', 'Occupied'],
  ['V1', 'Vacant'],
  ['V2', 'Vacant'],
  ['M', 'Model'],
  ['C', 'Common Area'],
]);

/** Exact codes only, so anything else, including `o1`, `""` and null, is Down. */
export const mapUnitStatus = (rawStatus: string | null): UnitStatus => {
  return (rawStatus !== null && STATUS_BY_CODE.get(rawStatus)) || 'Down';
};
