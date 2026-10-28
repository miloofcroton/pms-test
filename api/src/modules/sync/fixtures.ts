import { eq, inArray } from 'drizzle-orm';

import { db } from '../../integrations/postgres';
import { fileClient } from '../lakeside/client';
import { snapshots } from '../lakeside/schema';
import { postgresRentLive } from '../rentlive/postgres';
import { rentliveResidents, rentliveUnits } from '../rentlive/schema';
import type { LakesideClient } from '../lakeside/client';

import { runSync } from './runner';
import { changeLog, decisions, exceptions, runs } from './schema';
import { postgresStore } from './store-postgres';
import type { RunReport } from './runner';

// Helpers for the integration tests, which share the one local database with the app.
// Each test runs the real snapshots under a property id of its own, so it never sees another test's rows.

// Every property id handed out in this test file, so `removeCreatedProperties` can delete their rows afterwards.
const created: Array<string> = [];

export const freshProperty = (label: string): string => {
  const propertyId = `${label}-${Date.now()}-${created.length + 1}`;
  created.push(propertyId);
  return propertyId;
};

export const snapshotPath = (day: number): string => {
  return new URL(`../../../../data/day${day}.json`, import.meta.url).pathname;
};

/** The file client, with every snapshot's `property.id` replaced. */
export const asProperty = (propertyId: string): LakesideClient => {
  return {
    fetchSnapshot: async (source) => {
      const result = await fileClient.fetchSnapshot(source);
      if (!result.ok) {
        return result;
      }
      const snapshot = result.snapshot as { property: Record<string, unknown> };
      return {
        ok: true,
        snapshot: {
          ...snapshot,
          property: {
            ...snapshot.property,
            id: propertyId,
          },
        },
      };
    },
  };
};

export const postgresDeps = (propertyId: string) => {
  return {
    lakeside: asProperty(propertyId),
    rentLive: postgresRentLive,
    store: postgresStore,
  };
};

/** Runs the given days, in order, against Postgres. */
export const runDays = async (propertyId: string, days: Array<number>): Promise<Array<RunReport>> => {
  const reports: Array<RunReport> = [];
  for (const day of days) {
    reports.push(await runSync(snapshotPath(day), postgresDeps(propertyId)));
  }
  return reports;
};

/** Deletes every row a test property wrote, children first, so tests leave the shared database as they found it. */
export const removeProperty = async (propertyId: string): Promise<void> => {
  const ownSnapshots = db.select({ id: snapshots.id })
    .from(snapshots)
    .where(eq(snapshots.propertyId, propertyId));
  const ownRuns = db.select({ id: runs.id })
    .from(runs)
    .where(inArray(runs.snapshotId, ownSnapshots));
  await db.transaction(async (tx) => {
    await tx.delete(changeLog)
      .where(eq(changeLog.propertyId, propertyId));
    await tx.delete(exceptions)
      .where(eq(exceptions.propertyId, propertyId));
    await tx.delete(decisions)
      .where(eq(decisions.propertyId, propertyId));
    await tx.delete(runs)
      .where(inArray(runs.id, ownRuns));
    await tx.delete(snapshots)
      .where(eq(snapshots.propertyId, propertyId));
    await tx.delete(rentliveResidents)
      .where(eq(rentliveResidents.propertyId, propertyId));
    await tx.delete(rentliveUnits)
      .where(eq(rentliveUnits.propertyId, propertyId));
  });
};

/** Deletes runs that belong to no property, by id, with any snapshot they point to: a failed fetch, or a snapshot too broken to name its property. */
export const removeRuns = async (runIds: Array<number>): Promise<void> => {
  if (runIds.length === 0) {
    return;
  }
  const removed = await db.delete(runs)
    .where(inArray(runs.id, runIds))
    .returning({ snapshotId: runs.snapshotId });
  const snapshotIds = removed.flatMap(({ snapshotId }) => snapshotId === null ? [] : [snapshotId]);
  if (snapshotIds.length > 0) {
    await db.delete(snapshots)
      .where(inArray(snapshots.id, snapshotIds));
  }
};

/** For `afterAll`: deletes the rows of every property this test file created. */
export const removeCreatedProperties = async (): Promise<void> => {
  for (const propertyId of created.splice(0)) {
    await removeProperty(propertyId);
  }
};
