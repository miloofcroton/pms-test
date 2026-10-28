import { describe, expect, it } from 'vitest';

import type { Customer, Lease, NormalizedSnapshot, Unit } from '../lakeside/normalize';

import { changesOf } from './change-log';
import type { SyncException } from './exceptions';
import type { Decision } from './rules';

const unit = (overrides: Partial<Unit> = {}): Unit => {
  return {
    remoteId: '5001',
    unitNumber: '101',
    buildingName: 'A',
    floorplanName: '1x1',
    rawStatus: 'O1',
    ...overrides,
  };
};

const customer = (overrides: Partial<Customer> = {}): Customer => {
  return {
    remoteId: '3001',
    type: 'Primary',
    status: null,
    firstName: 'Alice',
    lastName: 'Nguyen',
    email: 'alice.nguyen@example.com',
    phone: null,
    moveInDate: '2026-10-17',
    moveOutDate: null,
    ...overrides,
  };
};

const lease = (overrides: Partial<Lease> = {}): Lease => {
  return {
    remoteId: '9001',
    unitRemoteId: '5001',
    status: 'Current',
    startDate: '2026-10-17',
    endDate: '2027-10-16',
    customers: [customer()],
    ...overrides,
  };
};

const snapshot = (units: Array<Unit>, leases: Array<Lease>, generatedAt = '2026-10-28T06:30:00Z'): NormalizedSnapshot => {
  return {
    property: {
      remoteId: '100',
      name: 'Harbor View Apartments',
      timezone: 'America/Los_Angeles',
    },
    generatedAt,
    units,
    leases,
    exceptions: [],
  };
};

const review = (reason: SyncException['reason'], residentRemoteId = '3001'): SyncException => {
  return {
    kind: 'review',
    propertyId: '100',
    reason,
    unitRemoteId: '5001',
    leaseRemoteId: '9001',
    residentRemoteId,
  };
};

const move = (action: 'move_in' | 'move_out'): Decision => {
  return {
    unitRemoteId: '5001',
    residentRemoteId: '3001',
    leaseRemoteId: '9001',
    action,
    reason: action === 'move_in' ? 'moved_in' : 'moved_out',
    flagged: false,
  };
};

const base = snapshot([unit()], [lease()]);

const kinds = (entries: ReturnType<typeof changesOf>): Array<string> => {
  return entries.map((entry) => entry.kind);
};

describe('changesOf', () => {
  it('records nothing when nothing changed, so a rerun adds no entries', () => {
    expect(changesOf({
      previous: base,
      next: base,
      moves: [],
      previousReviews: [review('no_move_out_date')],
      reviews: [review('no_move_out_date')],
    })).toEqual([]);
  });

  it('creates every unit, lease and resident on the first run', () => {
    expect(changesOf({
      previous: null,
      next: base,
      moves: [],
      previousReviews: [],
      reviews: [],
    })).toEqual([
      {
        kind: 'unit_created',
        unitRemoteId: '5001',
        residentRemoteId: null,
        details: {
          unitNumber: '101',
          rawStatus: 'O1',
          status: 'Occupied',
        },
      },
      {
        kind: 'lease_added',
        unitRemoteId: '5001',
        residentRemoteId: null,
        details: {
          leaseRemoteId: '9001',
          status: 'Current',
          startDate: '2026-10-17',
          endDate: '2027-10-16',
        },
      },
      {
        kind: 'resident_created',
        unitRemoteId: '5001',
        residentRemoteId: '3001',
        details: {
          leaseRemoteId: '9001',
          type: 'Primary',
          effectiveStatus: 'Current',
        },
      },
    ]);
  });

  describe('units', () => {
    it('records a status change with the raw code and the mapped status', () => {
      const next = snapshot([unit({ rawStatus: 'V2' })], [lease()]); // 5008 on day 2, o1 to V2
      const entries = changesOf({
        previous: snapshot([unit({ rawStatus: 'o1' })], [lease()]),
        next,
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([
        {
          kind: 'unit_status_changed',
          unitRemoteId: '5001',
          residentRemoteId: null,
          details: {
            from: {
              rawStatus: 'o1',
              status: 'Down',
            },
            to: {
              rawStatus: 'V2',
              status: 'Vacant',
            },
          },
        },
      ]);
    });

    it('records a raw code change even when the mapped status stays the same', () => {
      const entries = changesOf({
        previous: snapshot([unit({ rawStatus: null })], []),
        next: snapshot([unit({ rawStatus: 'D' })], []),
        moves: [],
        previousReviews: [],
        reviews: [],
      }); // 5015 on day 2, both Down
      expect(kinds(entries)).toEqual(['unit_status_changed']);
    });

    it('records other unit fields as an update, with what changed', () => {
      const entries = changesOf({
        previous: snapshot([unit()], []),
        next: snapshot([unit({ floorplanName: '2x2' })], []),
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([
        {
          kind: 'unit_updated',
          unitRemoteId: '5001',
          residentRemoteId: null,
          details: {
            changes: {
              floorplanName: {
                from: '1x1',
                to: '2x2',
              },
            },
          },
        },
      ]);
    });
  });

  describe('leases', () => {
    it('records a lease whose status or dates changed', () => {
      const entries = changesOf({
        previous: base,
        next: snapshot([unit()], [
          lease({
            status: 'Past',
            customers: [customer({ moveOutDate: '2026-10-26' })],
          }),
        ]),
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries[0]).toEqual({
        kind: 'lease_changed',
        unitRemoteId: '5001',
        residentRemoteId: null,
        details: {
          leaseRemoteId: '9001',
          changes: {
            status: {
              from: 'Current',
              to: 'Past',
            },
          },
        },
      });
    });

    it('records a lease that is gone from the snapshot', () => {
      const entries = changesOf({
        previous: base,
        next: snapshot([unit()], []), // day 3
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([
        {
          kind: 'lease_removed',
          unitRemoteId: '5001',
          residentRemoteId: null,
          details: { leaseRemoteId: '9001' },
        },
      ]);
    });
  });

  describe('residents', () => {
    it('records the fields that changed, including a new lease', () => {
      // Alice on day 2: re-signed on L9101, so her lease changes and nothing else.
      const entries = changesOf({
        previous: base,
        next: snapshot([unit()], [lease({ remoteId: '9101' })]),
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries.find((entry) => entry.kind === 'resident_updated')).toEqual({
        kind: 'resident_updated',
        unitRemoteId: '5001',
        residentRemoteId: '3001',
        details: {
          changes: {
            leaseRemoteId: {
              from: '9001',
              to: '9101',
            },
          },
        },
      });
    });

    it('records a new resident on an existing lease', () => {
      const entries = changesOf({
        previous: base,
        next: snapshot([unit()], [
          lease({
            customers: [
              customer(),
              customer({
                remoteId: '3020',
                type: 'Occupant',
              }),
            ],
          }),
        ]), // Uma on day 2
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([expect.objectContaining({
        kind: 'resident_created',
        residentRemoteId: '3020',
      })]);
    });

    it('records nothing for a resident the 14-day rule stops syncing', () => {
      const past = lease({
        status: 'Past',
        customers: [customer({ moveOutDate: '2026-10-01' })],
      });
      const entries = changesOf({
        previous: snapshot([unit()], [past], '2026-10-14T06:30:00Z'),
        next: snapshot([unit()], [past], '2026-10-28T06:30:00Z'),
        moves: [],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([]);
    });
  });

  describe('moves and flags', () => {
    it('records the moves that happened, with the lease', () => {
      const entries = changesOf({
        previous: base,
        next: base,
        moves: [move('move_out'), move('move_in')],
        previousReviews: [],
        reviews: [],
      });
      expect(entries).toEqual([
        {
          kind: 'moved_out',
          unitRemoteId: '5001',
          residentRemoteId: '3001',
          details: { leaseRemoteId: '9001' },
        },
        {
          kind: 'moved_in',
          unitRemoteId: '5001',
          residentRemoteId: '3001',
          details: { leaseRemoteId: '9001' },
        },
      ]);
    });

    it('records a flag for review, with the reason, when it first appears', () => {
      const entries = changesOf({
        previous: base,
        next: base,
        moves: [],
        previousReviews: [],
        reviews: [review('no_move_out_date')],
      }); // Jack on day 2
      expect(entries).toEqual([
        {
          kind: 'flagged_for_review',
          unitRemoteId: '5001',
          residentRemoteId: '3001',
          details: { reason: 'no_move_out_date' },
        },
      ]);
    });

    it('records a flag again when its reason changes', () => {
      const entries = changesOf({
        previous: base,
        next: base,
        moves: [],
        previousReviews: [review('move_out_date_not_in_future')],
        reviews: [review('no_move_out_date')],
      });
      expect(kinds(entries)).toEqual(['flagged_for_review']);
    });
  });
});
