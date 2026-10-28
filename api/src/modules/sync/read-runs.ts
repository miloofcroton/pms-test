import { basename } from 'node:path';

import { asc, desc, eq, sql } from 'drizzle-orm';
import type { RunDetail, RunSummary } from '@sync-app/shared';

import { db } from '~/integrations/postgres';
import { snapshots } from '~/modules/lakeside/schema';
import { exceptions, runs } from '~/modules/sync/schema';
import type { RunError } from '~/modules/sync/errors';
import type { RunCounts, RunStatus } from '~/modules/sync/schema';

// Reads for the runs view.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { RunSummary, RunDetail };

const summaryColumns = {
  id: runs.id,
  source: runs.source,
  propertyId: snapshots.propertyId,
  // The timezone is only in the snapshot body, and the UI needs it to show times in the property's timezone.
  timezone: sql<string | null>`${snapshots.body} -> 'property' ->> 'timezone'`,
  generatedAt: snapshots.generatedAt,
  startedAt: runs.startedAt,
  finishedAt: runs.finishedAt,
  status: runs.status,
  error: runs.error,
  counts: runs.counts,
};

const summaryOf = (row: {
  id: number;
  source: string;
  propertyId: string | null;
  timezone: string | null;
  generatedAt: Date | null;
  startedAt: Date;
  finishedAt: Date | null;
  status: RunStatus;
  error: RunError | null;
  counts: RunCounts
}): RunSummary => {
  return {
    ...row,
    snapshotFile: basename(row.source),
    generatedAt: row.generatedAt?.toISOString() ?? null,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
};

const selectRuns = () => {
  return db.select(summaryColumns)
    .from(runs)
    .leftJoin(snapshots, eq(runs.snapshotId, snapshots.id));
};

/** Newest first. A run whose fetch failed has no property, so it only shows without a property filter. */
export const listRuns = async (filter: { propertyId?: string } = {}): Promise<Array<RunSummary>> => {
  const rows = await selectRuns()
    .where(filter.propertyId ? eq(snapshots.propertyId, filter.propertyId) : undefined)
    .orderBy(desc(runs.id));
  return rows.map(summaryOf);
};

export const getRun = async (runId: number): Promise<RunDetail | null> => {
  const [row] = await selectRuns().where(eq(runs.id, runId));
  if (!row) {
    return null;
  }
  const found = await db.select({
    kind: exceptions.kind,
    propertyId: exceptions.propertyId,
    reason: exceptions.reason,
    unitRemoteId: exceptions.unitRemoteId,
    leaseRemoteId: exceptions.leaseRemoteId,
    residentRemoteId: exceptions.residentRemoteId,
  })
    .from(exceptions)
    .where(eq(exceptions.runId, runId))
    .orderBy(asc(exceptions.id));
  return {
    ...summaryOf(row),
    exceptions: {
      data: found.filter((exception) => exception.kind === 'data'),
      review: found.filter((exception) => exception.kind === 'review'),
    },
  };
};
