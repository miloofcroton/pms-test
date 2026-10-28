import { and, desc, eq } from 'drizzle-orm';

import { db } from '../../integrations/postgres';
import { normalizeSnapshot } from '../lakeside/normalize';
import { snapshots } from '../lakeside/schema';
import type { NormalizedSnapshot, Property } from '../lakeside/normalize';

import { runs } from './schema';

// The snapshots the reads show: those of a property's successful runs, normalized again from what was stored.

export type OkSnapshot = {
  runId: number;
  snapshot: NormalizedSnapshot;
};

/** Newest first, by `generated_at` then by run, so the first is what Lakeside last said. */
export const okSnapshots = async (propertyId: string, limit?: number): Promise<Array<OkSnapshot>> => {
  const query = db.select({
    runId: runs.id,
    body: snapshots.body,
  })
    .from(runs)
    .innerJoin(snapshots, eq(runs.snapshotId, snapshots.id))
    .where(and(eq(runs.status, 'ok'), eq(snapshots.propertyId, propertyId)))
    .orderBy(desc(snapshots.generatedAt), desc(runs.id));
  const rows = limit === undefined ? await query : await query.limit(limit);
  // Each of these normalized once already, when its run succeeded.
  return rows.map((row) => ({
    runId: row.runId,
    snapshot: normalizeSnapshot(row.body),
  }));
};

export const getProperty = async (propertyId: string): Promise<Property | null> => {
  const [latest] = await okSnapshots(propertyId, 1);
  return latest?.snapshot.property ?? null;
};
