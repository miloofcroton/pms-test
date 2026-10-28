import { beforeAll, describe, expect, it } from 'vitest';

import { postgresRentLive } from '../rentlive/postgres';

import { runDays } from './fixtures';
import { getResident } from './read-resident';

const PROPERTY = '100';

// Days 1 and 2 first; the last describe runs day 3 for itself.
beforeAll(async () => {
  await runDays([1, 2]);
});

const resident = (propertyId: string, unitRemoteId: string, residentRemoteId: string) => {
  return getResident(propertyId, unitRemoteId, residentRemoteId, postgresRentLive);
};

describe('getResident, after day 2', () => {
  it('shows who they are, from what Lakeside last said', async () => {
    expect(await resident(PROPERTY, '5002', '3004')).toMatchObject({
      leaseRemoteId: '9002',
      type: 'Primary',
      effectiveStatus: 'Current',
      firstName: 'Carol',
      lastName: 'Mendez',
      email: 'carol.mendez@example.com',
      phone: '(555) 010-3004',
      moveInDate: '2026-09-01',
      moveOutDate: null,
      synced: true,
      inLatestSnapshot: true,
      seenGeneratedAt: '2026-10-29T06:30:00Z',
    });
  });

  it('shows why a Current resident was never moved in', async () => {
    expect(await resident(PROPERTY, '5002', '3004')).toMatchObject({
      rentLive: {
        movedIn: false,
        everMovedOut: false,
      },
      decision: {
        action: 'none',
        reason: 'move_in_date_outside_window',
      },
      exceptions: [],
    }); // Carol
  });

  it('shows a re-signed resident on their Current lease, moved in, with their change log', async () => {
    const alice = await resident(PROPERTY, '5001', '3001');
    expect(alice).toMatchObject({
      leaseRemoteId: '9101',
      rentLive: { movedIn: true },
      decision: { reason: 'stays_current' },
    });
    expect(alice?.changes.map((change) => change.kind)).toEqual(['resident_updated', 'moved_in', 'resident_created']);
  });

  it('shows a flagged resident with the exception', async () => {
    expect(await resident(PROPERTY, '5009', '3013')).toMatchObject({
      decision: { reason: 'no_move_out_date' },
      exceptions: [
        expect.objectContaining({
          kind: 'review',
          reason: 'no_move_out_date',
        }),
      ],
    }); // Jack
  });

  it('shows a resident who was moved out', async () => {
    expect(await resident(PROPERTY, '5006', '3009')).toMatchObject({
      rentLive: {
        movedIn: false,
        everMovedOut: true,
      },
      decision: {
        action: 'move_out',
        reason: 'moved_out',
      },
    }); // Grace
  });

  it('shows a resident the 14-day rule does not sync, who RentLive never stored', async () => {
    expect(await resident(PROPERTY, '5004', '3024')).toMatchObject({
      synced: false,
      rentLive: null,
      decision: null,
    }); // Wendy
  });
});

describe('getResident, not found', () => {
  it('gives null for someone never on the unit', async () => {
    expect(await resident(PROPERTY, '5001', '3999')).toBeNull();
  });

  it('gives null for the right person on the wrong unit', async () => {
    expect(await resident(PROPERTY, '5002', '3001')).toBeNull();
  });
});

describe('getResident, after day 3, which has no leases', () => {
  beforeAll(async () => {
    await runDays([3]);
  });

  it('shows them from the last snapshot that had them, and says so', async () => {
    expect(await resident(PROPERTY, '5001', '3001')).toMatchObject({
      firstName: 'Alice',
      inLatestSnapshot: false,
      seenGeneratedAt: '2026-10-29T06:30:00Z',
      rentLive: { movedIn: true },
      decision: { reason: 'missing_from_snapshot' },
      exceptions: [expect.objectContaining({ reason: 'missing_from_snapshot' })],
    });
  });
});
