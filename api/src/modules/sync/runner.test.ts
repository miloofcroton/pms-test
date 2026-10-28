import { beforeAll, describe, expect, it } from 'vitest';

import { fileClient } from '~/modules/lakeside/client';
import { createMemoryRentLive } from '~/modules/rentlive/memory';
import { runSync } from '~/modules/sync/runner';
import { createMemoryStore } from '~/modules/sync/store-memory';
import type { FetchResult, LakesideClient } from '~/modules/lakeside/client';
import type { RentLive } from '~/modules/rentlive/contract';
import type { RunReport } from '~/modules/sync/runner';

const day = (n: number): string => {
  return new URL(`../../../../data/day${n}.json`, import.meta.url).pathname;
};

const UNITS = [
  '5001',
  '5002',
  '5003',
  '5004',
  '5005',
  '5006',
  '5007',
  '5008',
  '5009',
  '5010',
  '5011',
  '5012',
  '5013',
  '5014',
  '5015',
  '5016',
];

// Who RentLive has moved in, as `unit/resident`, asked through the contract.
const movedIn = async (rentLive: RentLive): Promise<Array<string>> => {
  const lists = await Promise.all(UNITS.map(async (unit) => (await rentLive.listMovedIn('100', unit)).residents.map((resident) => `${unit}/${resident.residentRemoteId}`)));
  return lists.flat()
    .sort();
};

const kindCounts = (report: RunReport): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const change of report.changes) {
    counts[change.kind] = (counts[change.kind] ?? 0) + 1;
  }
  return counts;
};

const failingClient = (result: FetchResult): LakesideClient => {
  return { fetchSnapshot: async () => result };
};

describe('runSync, days 1 to 3, each run twice', () => {
  const rentLive = createMemoryRentLive();
  const store = createMemoryStore();
  const deps = {
    lakeside: fileClient,
    rentLive,
    store,
  };
  // runs[0] and runs[1] are day 1 and its rerun, runs[2] and runs[3] day 2, runs[4] and runs[5] day 3.
  const runs: Array<RunReport> = [];
  const movedInAfter: Array<Array<string>> = [];

  beforeAll(async () => {
    for (const n of [1, 1, 2, 2, 3, 3]) {
      runs.push(await runSync(day(n), deps));
      movedInAfter.push(await movedIn(rentLive));
    }
  });

  it('finishes every run', () => {
    expect(runs.map((run) => run.status)).toEqual(Array(6).fill('ok'));
    expect(runs.map((run) => run.error)).toEqual(Array(6).fill(null));
  });

  it('counts day 1', () => {
    expect(runs[0].counts).toEqual({
      unitsUpserted: 16,
      residentsUpserted: 16,
      movedIn: 7,
      movedOut: 0,
      skipped: 6, // the leases of Liam, Paul and Quinn, and Wendy, Rita and Victor
      flagged: 2, // Sam and Ivy
    });
  });

  it('counts day 2', () => {
    expect(runs[2].counts).toEqual({
      unitsUpserted: 16,
      residentsUpserted: 19,
      movedIn: 4,
      movedOut: 3,
      skipped: 5, // the leases of Paul and Quinn, and Wendy, Rita and Victor
      flagged: 2, // Sam and Jack
    });
  });

  it('counts day 3', () => {
    expect(runs[4].counts).toEqual({
      unitsUpserted: 16,
      residentsUpserted: 0,
      movedIn: 0,
      movedOut: 0,
      skipped: 0,
      flagged: 8, // everyone still moved in, missing from the snapshot
    });
  });

  it('moves the right people in RentLive', () => {
    expect(movedInAfter[0]).toHaveLength(7);
    expect(movedInAfter[5]).toEqual([
      '5001/3001', // Alice
      '5001/3002', // Bob
      '5003/3006', // Dan
      '5004/3007', // Erin
      '5005/3008', // Frank
      '5009/3013', // Jack
      '5011/3021', // Nora
      '5012/3016', // Mia
    ]);
  });

  it('logs every unit, lease and synced resident as new on day 1, with the moves and flags', () => {
    expect(kindCounts(runs[0])).toEqual({
      unit_created: 16,
      lease_added: 14,
      resident_created: 16,
      moved_in: 7,
      flagged_for_review: 2,
    });
  });

  it('logs what changed on day 2', () => {
    expect(runs[2].changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'moved_out',
        residentRemoteId: '3009',
      }), // Grace
      expect.objectContaining({
        kind: 'moved_in',
        unitRemoteId: '5011',
        residentRemoteId: '3021',
      }), // Nora
      expect.objectContaining({
        kind: 'flagged_for_review',
        residentRemoteId: '3013',
        details: { reason: 'no_move_out_date' },
      }), // Jack
      expect.objectContaining({
        kind: 'resident_updated',
        residentRemoteId: '3001',
        details: {
          changes: {
            leaseRemoteId: {
              from: '9001',
              to: '9101',
            },
          },
        },
      }), // Alice
      expect.objectContaining({
        kind: 'unit_status_changed',
        unitRemoteId: '5008',
      }), // o1 to V2
    ]));
  });

  it('changes nothing when a snapshot is run again', () => {
    expect(runs[1].changes).toEqual([]);
    expect(runs[3].changes).toEqual([]);
    expect(runs[5].changes).toEqual([]);
    expect(movedInAfter[1]).toEqual(movedInAfter[0]);
    expect(movedInAfter[3]).toEqual(movedInAfter[2]);
    expect(runs[3].counts).toMatchObject({
      movedIn: 0,
      movedOut: 0,
    });
  });

  it('records every run, with its own exceptions, and every snapshot', () => {
    expect(store.tables.runs).toHaveLength(6);
    expect(store.tables.snapshots).toHaveLength(6);
    const exceptionsOf = (runId: number) => store.tables.exceptions.filter((exception) => exception.runId === runId).length;
    expect(runs.map((run) => exceptionsOf(run.runId))).toEqual([5, 5, 4, 4, 8, 8]);
  });

  it('keeps the latest decision per resident, with its reason', () => {
    expect(store.tables.decisions.get('100/5002/3004')).toMatchObject({
      action: 'none',
      reason: 'move_in_date_outside_window',
    }); // Carol
  });
});

describe('runSync, run errors', () => {
  it.each([
    ['not_found', 'snapshot_not_found'],
    ['unreadable', 'snapshot_unreadable'],
    ['invalid_json', 'snapshot_invalid_json'],
  ] as const)('fails a run whose fetch is %s, storing no snapshot', async (error, reason) => {
    const store = createMemoryStore();
    const report = await runSync('data/missing.json', {
      lakeside: failingClient({
        ok: false,
        error,
        message: 'it went wrong',
      }),
      rentLive: createMemoryRentLive(),
      store,
    });
    expect(report).toMatchObject({
      status: 'failed',
      error: {
        kind: 'fetch',
        reason,
      },
      changes: [],
    });
    expect(store.tables.snapshots).toEqual([]);
    expect(store.tables.runs).toEqual([expect.objectContaining({ status: 'failed' })]);
  });

  it('fails a run whose snapshot breaks the contract, and keeps the snapshot as evidence', async () => {
    const store = createMemoryStore();
    const broken = {
      meta: { generated_at: '2026-10-28T06:30:00Z' },
      property: {
        id: 100,
        name: 'Harbor View Apartments',
        timezone: 'America/Los_Angeles',
      },
      units: 'not a list',
      leases: [],
    };
    const report = await runSync('data/broken.json', {
      lakeside: failingClient({
        ok: true,
        snapshot: broken,
      }),
      rentLive: createMemoryRentLive(),
      store,
    });
    expect(report.error).toEqual({
      kind: 'structure',
      reason: 'invalid_structure',
      details: {
        field: 'units',
        value: 'not a list',
      },
    });
    expect(store.tables.snapshots).toEqual([
      expect.objectContaining({
        propertyId: '100',
        generatedAt: '2026-10-28T06:30:00Z',
        body: broken,
      }),
    ]);
    expect(store.tables.exceptions).toEqual([]);
  });

  it('refuses a snapshot older than the last run, and changes nothing', async () => {
    const rentLive = createMemoryRentLive();
    const store = createMemoryStore();
    const deps = {
      lakeside: fileClient,
      rentLive,
      store,
    };
    await runSync(day(1), deps);
    await runSync(day(2), deps);
    const before = await movedIn(rentLive);
    const changesBefore = store.tables.changes.length;

    const report = await runSync(day(1), deps);
    expect(report).toMatchObject({
      status: 'refused',
      error: {
        kind: 'stale',
        reason: 'snapshot_older_than_last_run',
        details: {
          generatedAt: '2026-10-28T06:30:00.000Z',
          lastGeneratedAt: '2026-10-29T06:30:00.000Z',
        },
      },
    });
    expect(await movedIn(rentLive)).toEqual(before);
    expect(store.tables.changes).toHaveLength(changesBefore);
  });

  it('fails a run that crashes partway, keeping the message', async () => {
    const rentLive = createMemoryRentLive();
    const report = await runSync(day(1), {
      lakeside: fileClient,
      rentLive: {
        ...rentLive,
        upsertUnits: async () => {
          throw new Error('RentLive is down');
        },
      },
      store: createMemoryStore(),
    });
    expect(report).toMatchObject({
      status: 'failed',
      error: {
        kind: 'crash',
        reason: 'run_crashed',
        details: { message: 'RentLive is down' },
      },
    });
  });

  it('runs normally once the cause of a failure is fixed', async () => {
    const rentLive = createMemoryRentLive();
    const store = createMemoryStore();
    await runSync(day(1), {
      lakeside: failingClient({
        ok: false,
        error: 'not_found',
        message: 'not there yet',
      }),
      rentLive,
      store,
    });
    const report = await runSync(day(1), {
      lakeside: fileClient,
      rentLive,
      store,
    });
    expect(report.status).toBe('ok');
    expect(report.counts.movedIn).toBe(7);
  });
});
