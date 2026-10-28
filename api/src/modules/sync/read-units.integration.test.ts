import { beforeAll, describe, expect, it } from 'vitest';

import { runDays } from '~/modules/sync/fixtures';
import { listProperties, listUnits } from '~/modules/sync/read-units';

const PROPERTY = '100';

beforeAll(async () => {
  await runDays([1, 2]);
});

describe('listProperties', () => {
  it('lists every property with a successful run', async () => {
    expect(await listProperties()).toEqual([
      {
        remoteId: PROPERTY,
        name: 'Harbor View Apartments',
        timezone: 'America/Los_Angeles',
      },
    ]);
  });
});

describe('listUnits', () => {
  it('lists every unit from what Lakeside last said', async () => {
    const found = await listUnits(PROPERTY);
    expect(found?.generatedAt).toBe('2026-10-29T06:30:00Z');
    expect(found?.property.remoteId).toBe(PROPERTY);
    expect(found?.units).toHaveLength(16);
  });

  it.each([
    ['5008', 'V2', 'Vacant'], // o1 on day 1
    ['5009', 'O3', 'Down'], // an unknown code
    ['5014', 'C', 'Common Area'], // CLUB
    ['5015', 'D', 'Down'], // null on day 1
  ])('shows unit %s with its raw code %s and its RentLive status %s', async (unitRemoteId, rawStatus, status) => {
    const found = await listUnits(PROPERTY);
    expect(found?.units.find((unit) => unit.remoteId === unitRemoteId)).toMatchObject({
      rawStatus,
      status,
    });
  });

  it('shows the number, building and floorplan', async () => {
    const found = await listUnits(PROPERTY);
    expect(found?.units.find((unit) => unit.remoteId === '5001')).toEqual({
      remoteId: '5001',
      unitNumber: '101',
      buildingName: 'A',
      floorplanName: '1x1',
      rawStatus: 'O1',
      status: 'Occupied',
    });
  });

  it('gives null for a property it has never synced', async () => {
    expect(await listUnits('no-such-property')).toBeNull();
  });
});
