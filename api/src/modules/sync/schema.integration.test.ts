import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, db, runMigrations } from '../../integrations/postgres';
import { snapshots } from '../lakeside/schema';

import { fetchErrorOf } from './errors';
import { changeLog, decisions, runs } from './schema';

// A run id no run will ever have, to check the foreign keys.
const MISSING_RUN = 2_000_000_000;

beforeAll(runMigrations);
afterAll(closeDB);

const insertSnapshot = async (): Promise<number> => {
  const [snapshot] = await db.insert(snapshots)
    .values({
      propertyId: '100',
      source: 'data/day1.json',
      generatedAt: new Date('2026-10-28T06:30:00Z'),
      body: {},
    })
    .returning({ id: snapshots.id });
  return snapshot.id;
};

describe('sync.runs', () => {
  it('starts a run as running, with zero counts and no error', async () => {
    const snapshotId = await insertSnapshot();
    const [run] = await db.insert(runs)
      .values({
        source: 'data/day1.json',
        snapshotId,
      })
      .returning();
    expect(run).toMatchObject({
      status: 'running',
      error: null,
      finishedAt: null,
      counts: {
        unitsUpserted: 0,
        residentsUpserted: 0,
        movedIn: 0,
        movedOut: 0,
        skipped: 0,
        flagged: 0,
      },
    });
  });

  it('stores a snapshot too broken to read its property, so a structure error keeps its evidence', async () => {
    const [snapshot] = await db.insert(snapshots)
      .values({
        source: 'data/broken.json',
        body: { units: 'not a list' },
      })
      .returning();
    const [run] = await db.insert(runs)
      .values({
        source: 'data/broken.json',
        snapshotId: snapshot.id,
        status: 'failed',
        error: {
          kind: 'structure',
          reason: 'invalid_structure',
          details: {
            field: 'units',
            value: 'not a list',
          },
        },
      })
      .returning();
    expect(snapshot).toMatchObject({
      propertyId: null,
      generatedAt: null,
    });
    expect(run.snapshotId).toBe(snapshot.id);
  });

  it('stores a failed run that never got a snapshot, with its error', async () => {
    const error = fetchErrorOf({
      ok: false,
      error: 'not_found',
      message: 'data/missing.json: no such file',
    }, 'data/missing.json');
    const [run] = await db.insert(runs)
      .values({
        source: 'data/missing.json',
        status: 'failed',
        error,
      })
      .returning();
    const [stored] = await db.select()
      .from(runs)
      .where(eq(runs.id, run.id));
    expect(stored).toMatchObject({
      snapshotId: null,
      status: 'failed',
      error: {
        kind: 'fetch',
        reason: 'snapshot_not_found',
        details: {
          source: 'data/missing.json',
          message: 'data/missing.json: no such file',
        },
      },
    });
  });
});

describe('foreign keys to sync.runs', () => {
  it('rejects a decision for a run that does not exist', async () => {
    await expect(db.insert(decisions)
      .values({
        propertyId: '100',
        unitRemoteId: '5001',
        residentRemoteId: '3001',
        action: 'none',
        reason: 'stays_current',
        runId: MISSING_RUN,
      })).rejects.toThrow();
  });

  it('rejects a change-log entry for a run that does not exist', async () => {
    await expect(db.insert(changeLog)
      .values({
        propertyId: '100',
        kind: 'unit_created',
        runId: MISSING_RUN,
      })).rejects.toThrow();
  });
});

describe('sync.change_log', () => {
  it('is indexed for the unit and resident pages', async () => {
    const { rows } = await db.execute<{ indexdef: string }>(sql`
      select indexdef from pg_indexes where schemaname = 'sync' and tablename = 'change_log'
    `);
    expect(rows.map((row) => row.indexdef)).toEqual(expect.arrayContaining([expect.stringContaining('(property_id, unit_remote_id, resident_remote_id)')]));
  });
});
