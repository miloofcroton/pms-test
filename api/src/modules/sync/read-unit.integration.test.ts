import { beforeAll, describe, expect, it } from 'vitest';

import { postgresRentLive } from '~/modules/rentlive/postgres';
import { runDays } from '~/modules/sync/fixtures';
import { getUnit } from '~/modules/sync/read-unit';

const PROPERTY = '100';

// Days 1 and 2 first; the last describe runs day 3 for itself.
beforeAll(async () => {
  await runDays([1, 2]);
});

describe('getUnit, after day 2', () => {
  it('shows the unit with its raw code and RentLive status', async () => {
    const found = await getUnit(PROPERTY, '5001', postgresRentLive);
    expect(found?.unit).toMatchObject({
      unitNumber: '101',
      rawStatus: 'O1',
      status: 'Occupied',
    });
    expect(found?.property.timezone).toBe('America/Los_Angeles');
  });

  it('shows each lease with its status and dates, and the people on it with their type', async () => {
    const found = await getUnit(PROPERTY, '5001', postgresRentLive);
    expect(found?.leases.map((lease) => [lease.remoteId, lease.status, lease.startDate])).toEqual([
      ['9001', 'Past', '2026-10-17'],
      ['9101', 'Current', '2026-10-27'],
    ]);
    expect(found?.leases[1].people).toEqual([
      expect.objectContaining({
        residentRemoteId: '3001',
        firstName: 'Alice',
        type: 'Primary',
        effectiveStatus: 'Current',
      }),
      expect.objectContaining({
        residentRemoteId: '3002',
        type: 'Co-Applicant',
      }),
      expect.objectContaining({
        residentRemoteId: '3003',
        type: 'Guarantor',
      }),
      expect.objectContaining({
        residentRemoteId: '3020',
        firstName: 'Uma',
        type: 'Occupant',
      }),
    ]);
  });

  it('shows who is moved in right now, from RentLive, with their stored lease', async () => {
    const found = await getUnit(PROPERTY, '5001', postgresRentLive);
    expect(found?.movedIn).toEqual([
      {
        residentRemoteId: '3001',
        leaseRemoteId: '9101',
        firstName: 'Alice',
        lastName: 'Nguyen',
      },
      {
        residentRemoteId: '3002',
        leaseRemoteId: '9101',
        firstName: 'Bob',
        lastName: 'Lee',
      },
    ]);
  });

  it('shows a new household after the old one moved out', async () => {
    const found = await getUnit(PROPERTY, '5011', postgresRentLive);
    expect(found?.movedIn.map((resident) => resident.firstName)).toEqual(['Nora']);
  });

  it('shows the unit\'s change log, newest first, including its residents\' entries', async () => {
    const found = await getUnit(PROPERTY, '5011', postgresRentLive);
    expect(found?.changes.map((change) => `${change.kind} ${change.residentRemoteId ?? ''}`.trim())).toEqual(expect.arrayContaining([
      'moved_out 3016',
      'moved_in 3021',
    ]));
    expect(found?.changes[0].runId).toBeGreaterThan(found?.changes.at(-1)?.runId ?? Infinity);
  });

  it('shows the latest run\'s exceptions on the unit', async () => {
    const found = await getUnit(PROPERTY, '5009', postgresRentLive);
    expect(found?.exceptions).toEqual([
      expect.objectContaining({
        kind: 'review',
        reason: 'no_move_out_date',
        residentRemoteId: '3013',
      }),
    ]); // Jack
  });
});

describe('getUnit, not found', () => {
  it('gives null for a unit that is not in the snapshot', async () => {
    expect(await getUnit(PROPERTY, '5099', postgresRentLive)).toBeNull();
  });

  it('gives null for a property it has never synced', async () => {
    expect(await getUnit('no-such-property', '5001', postgresRentLive)).toBeNull();
  });
});

describe('getUnit, after day 3, which has no leases', () => {
  beforeAll(async () => {
    await runDays([3]);
  });

  it('shows no leases, because Lakeside sent none', async () => {
    expect((await getUnit(PROPERTY, '5001', postgresRentLive))?.leases).toEqual([]);
  });

  it('still shows who RentLive has moved in, named from the last snapshot that had them', async () => {
    const found = await getUnit(PROPERTY, '5001', postgresRentLive);
    expect(found?.movedIn.map((resident) => resident.firstName)).toEqual(['Alice', 'Bob']);
  });

  it('shows why: they are missing from the snapshot', async () => {
    const found = await getUnit(PROPERTY, '5001', postgresRentLive);
    expect(found?.exceptions.map((exception) => exception.reason)).toEqual(['missing_from_snapshot', 'missing_from_snapshot']);
  });
});
