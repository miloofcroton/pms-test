import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../../integrations/postgres';
import { snapshots } from '../lakeside/schema';

import { changeLog, decisions, exceptions, runs } from './schema';
import type { SyncStore } from './store';

// The `SyncStore` for the app, in the `lakeside` and `sync` schemas.

export const postgresStore: SyncStore = {
  startRun: async (source) => {
    const [run] = await db.insert(runs)
      .values({ source })
      .returning({ id: runs.id });
    return run.id;
  },

  saveSnapshot: async (runId, snapshot) => {
    await db.transaction(async (tx) => {
      const [stored] = await tx.insert(snapshots)
        .values({
          ...snapshot,
          generatedAt: snapshot.generatedAt === null ? null : new Date(snapshot.generatedAt),
        })
        .returning({ id: snapshots.id });
      await tx.update(runs)
        .set({ snapshotId: stored.id })
        .where(eq(runs.id, runId));
    });
  },

  lastSuccessfulRun: async (propertyId) => {
    const [last] = await db.select({
      runId: runs.id,
      generatedAt: snapshots.generatedAt,
      body: snapshots.body,
    })
      .from(runs)
      .innerJoin(snapshots, eq(runs.snapshotId, snapshots.id))
      .where(and(eq(runs.status, 'ok'), eq(snapshots.propertyId, propertyId)))
      .orderBy(desc(snapshots.generatedAt), desc(runs.id))
      .limit(1);
    if (!last?.generatedAt) {
      return null;
    }
    return {
      runId: last.runId,
      generatedAt: last.generatedAt.toISOString(),
      body: last.body,
    };
  },

  reviewExceptions: async (runId) => {
    return db.select({
      kind: exceptions.kind,
      propertyId: exceptions.propertyId,
      reason: exceptions.reason,
      unitRemoteId: exceptions.unitRemoteId,
      leaseRemoteId: exceptions.leaseRemoteId,
      residentRemoteId: exceptions.residentRemoteId,
    })
      .from(exceptions)
      .where(and(eq(exceptions.runId, runId), eq(exceptions.kind, 'review')));
  },

  // In one transaction, so a run's results are all saved or none are.
  saveResults: async (runId, propertyId, results) => {
    await db.transaction(async (tx) => {
      if (results.decisions.length > 0) {
        await tx.insert(decisions)
          .values(results.decisions.map((decision) => ({
            propertyId,
            unitRemoteId: decision.unitRemoteId,
            residentRemoteId: decision.residentRemoteId,
            action: decision.action,
            reason: decision.reason,
            runId,
          })))
          .onConflictDoUpdate({
            target: [decisions.propertyId, decisions.unitRemoteId, decisions.residentRemoteId],
            set: {
              action: sql`excluded.action`,
              reason: sql`excluded.reason`,
              runId: sql`excluded.run_id`,
              decidedAt: sql`now()`,
            },
          });
      }
      if (results.exceptions.length > 0) {
        await tx.insert(exceptions)
          .values(results.exceptions.map((exception) => ({
            runId,
            ...exception,
          })));
      }
      if (results.changes.length > 0) {
        await tx.insert(changeLog)
          .values(results.changes.map((change) => ({
            runId,
            propertyId,
            ...change,
          })));
      }
    });
  },

  finishRun: async (runId, outcome) => {
    await db.update(runs)
      .set({
        ...outcome,
        finishedAt: new Date(),
      })
      .where(eq(runs.id, runId));
  },
};
