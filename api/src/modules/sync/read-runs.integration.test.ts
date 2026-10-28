import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, runMigrations } from '../../integrations/postgres';

import { freshProperty, postgresDeps, removeCreatedProperties, removeRuns, runDays } from './fixtures';
import { getRun, listRuns } from './read-runs';
import { runSync } from './runner';
import type { RunReport } from './runner';

const PROPERTY = freshProperty('read-runs');
// Runs that never got a snapshot belong to no property, so they're deleted by id.
const noSnapshotRuns: Array<number> = [];

beforeAll(runMigrations);
afterAll(async () => {
  await removeRuns(noSnapshotRuns);
  await removeCreatedProperties();
  await closeDB();
});

describe('listRuns', () => {
  let reports: Array<RunReport>;

  beforeAll(async () => {
    reports = await runDays(PROPERTY, [1, 1, 2]);
  });

  it('lists a property\'s runs, newest first', async () => {
    const runs = await listRuns({ propertyId: PROPERTY });
    expect(runs.map((run) => run.id)).toEqual(reports.map((report) => report.runId)
      .reverse());
  });

  it('gives each run what the runs view shows', async () => {
    const [latest] = await listRuns({ propertyId: PROPERTY });
    expect(latest).toMatchObject({
      snapshotFile: 'day2.json',
      propertyId: PROPERTY,
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
    const failed = await runSync('data/missing.json', postgresDeps(PROPERTY));
    noSnapshotRuns.push(failed.runId);
    const runs = await listRuns();
    expect(runs.find((run) => run.id === failed.runId)).toMatchObject({
      snapshotFile: 'missing.json',
      propertyId: null,
      generatedAt: null,
      status: 'failed',
      error: {
        kind: 'fetch',
        reason: 'snapshot_not_found',
      },
    });
  });
});

describe('getRun', () => {
  it('gives the run with its exceptions, grouped by kind', async () => {
    const [day1] = await runDays(freshProperty('read-run'), [1]);
    const run = await getRun(day1.runId);
    expect(run).toMatchObject({
      id: day1.runId,
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
