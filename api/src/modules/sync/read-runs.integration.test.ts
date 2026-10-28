import { beforeAll, describe, expect, it } from 'vitest';

import { postgresDeps, runDays } from '~/modules/sync/fixtures';
import { getRun, listRuns } from '~/modules/sync/read-runs';
import { runSync } from '~/modules/sync/runner';
import type { RunReport } from '~/modules/sync/runner';

let reports: Array<RunReport>;

beforeAll(async () => {
  reports = await runDays([1, 1, 2]);
});

describe('listRuns', () => {
  it('lists a property\'s runs, newest first', async () => {
    const runs = await listRuns({ propertyId: '100' });
    expect(runs.map((run) => run.id)).toEqual(reports.map((report) => report.runId)
      .reverse());
  });

  it('gives each run what the runs view shows', async () => {
    const [latest] = await listRuns({ propertyId: '100' });
    expect(latest).toMatchObject({
      snapshotFile: 'day2.json',
      propertyId: '100',
      timezone: 'America/Los_Angeles',
      generatedAt: '2026-10-29T06:30:00.000Z',
      status: 'ok',
      error: null,
      counts: {
        movedIn: 4,
        movedOut: 3,
      },
    });
    expect(Date.parse(latest.startedAt)).not.toBeNaN();
    expect(Date.parse(latest.finishedAt ?? '')).not.toBeNaN();
  });

  it('lists a run whose fetch failed, which belongs to no property', async () => {
    const failed = await runSync('data/missing.json', postgresDeps);
    const runs = await listRuns();
    expect(runs[0]).toMatchObject({
      id: failed.runId,
      snapshotFile: 'missing.json',
      propertyId: null,
      generatedAt: null,
      status: 'failed',
      error: {
        kind: 'fetch',
        reason: 'snapshot_not_found',
      },
    });
    expect(await listRuns({ propertyId: '100' })).toHaveLength(3);
  });
});

describe('getRun', () => {
  it('gives the run with its exceptions, grouped by kind', async () => {
    const run = await getRun(reports[0].runId);
    expect(run).toMatchObject({
      id: reports[0].runId,
      snapshotFile: 'day1.json',
      status: 'ok',
    });
    expect(run?.exceptions
      .data
      .map((exception) => exception.leaseRemoteId)
      .sort()).toEqual(['9010', '9015', '9017']);
    expect(run?.exceptions
      .review
      .map((exception) => exception.reason)
      .sort()).toEqual(['move_out_date_not_in_future', 'unknown_customer_type']);
  });

  it('gives null for a run that does not exist', async () => {
    expect(await getRun(2_000_000_000)).toBeNull();
  });
});
