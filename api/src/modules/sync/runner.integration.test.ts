import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, db, runMigrations } from '../../integrations/postgres';
import { snapshots } from '../lakeside/schema';

import { freshProperty, postgresDeps, removeCreatedProperties, removeRuns, snapshotPath as day } from './fixtures';
import { runSync } from './runner';
import { changeLog, decisions, exceptions, runs } from './schema';
import type { RunReport } from './runner';

// The A1 scenario end to end, on the real tables and the Postgres RentLive mock, under a property id of its own.
const PROPERTY = freshProperty('runner');
const deps = postgresDeps(PROPERTY);
// Runs that never got a snapshot belong to no property, so they're deleted by id.
const noSnapshotRuns: Array<number> = [];

beforeAll(runMigrations);
afterAll(async () => {
  await removeRuns(noSnapshotRuns);
  await removeCreatedProperties();
  await closeDB();
});

describe('runSync on Postgres, days 1 to 3, each run twice', () => {
  const reports: Array<RunReport> = [];

  beforeAll(async () => {
    for (const n of [1, 1, 2, 2, 3, 3]) {
      reports.push(await runSync(day(n), deps));
    }
  });

  it('finishes every run, with the same counts as in memory', () => {
    expect(reports.map((report) => report.status)).toEqual(Array(6).fill('ok'));
    expect(reports.map((report) => [report.counts.movedIn, report.counts.movedOut, report.counts.flagged])).toEqual([
      [7, 0, 2],
      [0, 0, 2],
      [4, 3, 2],
      [0, 0, 2],
      [0, 0, 8],
      [0, 0, 8],
    ]);
  });

  it('stores each run as finished, with its snapshot and counts', async () => {
    const stored = await db.select()
      .from(runs)
      .where(inArray(runs.id, reports.map((report) => report.runId)))
      .orderBy(runs.id);
    expect(stored.map((run) => run.status)).toEqual(Array(6).fill('ok'));
    expect(stored.every((run) => run.snapshotId !== null && run.finishedAt !== null)).toBe(true);
    expect(stored[0].counts).toEqual(reports[0].counts);
  });

  it('keeps every snapshot it fetched', async () => {
    const stored = await db.select({ id: snapshots.id })
      .from(snapshots)
      .where(eq(snapshots.propertyId, PROPERTY));
    expect(stored).toHaveLength(6);
  });

  it('writes the change log once, so the reruns add nothing', async () => {
    const entries = await db.select({ runId: changeLog.runId })
      .from(changeLog)
      .where(eq(changeLog.propertyId, PROPERTY));
    const perRun = reports.map((report) => entries.filter((entry) => entry.runId === report.runId).length);
    expect(perRun).toEqual(reports.map((report) => report.changes.length));
    expect([perRun[1], perRun[3], perRun[5]]).toEqual([0, 0, 0]);
  });

  it('records each run its own exceptions', async () => {
    const stored = await db.select({ runId: exceptions.runId })
      .from(exceptions)
      .where(eq(exceptions.propertyId, PROPERTY));
    expect(reports.map((report) => stored.filter((exception) => exception.runId === report.runId).length)).toEqual([5, 5, 4, 4, 8, 8]);
  });

  it('keeps the latest decision per resident, from the last run that saw them', async () => {
    // Day 3 has no leases, so Carol's latest decision is still the one from day 2's rerun.
    const [carol] = await db.select()
      .from(decisions)
      .where(and(eq(decisions.propertyId, PROPERTY), eq(decisions.residentRemoteId, '3004')));
    expect(carol).toMatchObject({
      action: 'none',
      reason: 'move_in_date_outside_window',
      runId: reports[3].runId,
    });
  });

  it('refuses day 1 after day 3, and changes nothing', async () => {
    const report = await runSync(day(1), deps);
    expect(report).toMatchObject({
      status: 'refused',
      error: { kind: 'stale' },
      changes: [],
    });
    const [stored] = await db.select()
      .from(runs)
      .where(eq(runs.id, report.runId));
    expect(stored).toMatchObject({
      status: 'refused',
      error: { reason: 'snapshot_older_than_last_run' },
    });
  });
});

describe('runSync on Postgres, a failed fetch', () => {
  it('stores the run with its error and no snapshot', async () => {
    const report = await runSync('data/missing.json', deps);
    noSnapshotRuns.push(report.runId);
    const [stored] = await db.select()
      .from(runs)
      .where(eq(runs.id, report.runId));
    expect(stored).toMatchObject({
      status: 'failed',
      snapshotId: null,
      error: {
        kind: 'fetch',
        reason: 'snapshot_not_found',
      },
    });
  });
});
