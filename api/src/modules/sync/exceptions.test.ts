import { describe, expect, it } from 'vitest';

import type { NormalizedSnapshot, RecordException } from '../lakeside/normalize';

import { exceptionsOf } from './exceptions';
import type { Decision } from './rules';
import type { SyncPlan } from './sync-pipeline';

const snapshotWith = (exceptions: Array<RecordException>): NormalizedSnapshot => {
  return {
    property: {
      remoteId: '100',
      name: 'Harbor View Apartments',
      timezone: 'America/Los_Angeles',
    },
    generatedAt: '2026-10-28T06:30:00Z',
    units: [],
    leases: [],
    exceptions,
  };
};

const planWith = (decisions: Array<Decision>): SyncPlan => {
  return {
    today: '2026-10-27',
    decisions,
  };
};

const decision = (overrides: Partial<Decision> = {}): Decision => {
  return {
    unitRemoteId: '5009',
    residentRemoteId: '3013',
    leaseRemoteId: '9009',
    action: 'none',
    reason: 'no_move_out_date',
    flagged: true,
    ...overrides,
  };
};

describe('exceptionsOf', () => {
  it('turns a record exception into a data exception', () => {
    const paul: RecordException = {
      reason: 'lease_unit_not_in_snapshot',
      unitRemoteId: '5099',
      leaseRemoteId: '9015',
      customerRemoteId: null,
    };
    expect(exceptionsOf(snapshotWith([paul]), planWith([]))).toEqual([
      {
        kind: 'data',
        propertyId: '100',
        reason: 'lease_unit_not_in_snapshot',
        unitRemoteId: '5099',
        leaseRemoteId: '9015',
        residentRemoteId: null,
      },
    ]);
  });

  it('turns a flagged decision into a review exception', () => {
    expect(exceptionsOf(snapshotWith([]), planWith([decision()]))).toEqual([
      {
        kind: 'review',
        propertyId: '100',
        reason: 'no_move_out_date',
        unitRemoteId: '5009',
        leaseRemoteId: '9009',
        residentRemoteId: '3013',
      },
    ]); // Jack on day 2
  });

  it('leaves out decisions that are not flagged', () => {
    const plan = planWith([
      decision({
        action: 'move_in',
        reason: 'moved_in',
        flagged: false,
      }),
    ]);
    expect(exceptionsOf(snapshotWith([]), plan)).toEqual([]);
  });

  it('lists data exceptions before review exceptions', () => {
    const quinn: RecordException = {
      reason: 'lease_without_unit',
      unitRemoteId: null,
      leaseRemoteId: '9017',
      customerRemoteId: null,
    };
    const kinds = exceptionsOf(snapshotWith([quinn]), planWith([decision()])).map((exception) => exception.kind);
    expect(kinds).toEqual(['data', 'review']);
  });
});
