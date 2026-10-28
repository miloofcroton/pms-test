import { index, integer, jsonb, pgSchema, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { RunCounts, RunStatus } from '@sync-app/shared';

import { snapshots } from '~/modules/lakeside/schema';
import type { ChangeKind } from '~/modules/sync/change-log';
import type { RunError } from '~/modules/sync/errors';
import type { ExceptionKind, SyncException } from '~/modules/sync/exceptions';
import type { Action, Reason } from '~/modules/sync/rules';

// What the sync app did: each run, what it decided for each resident, what changed, and every exception it found.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { RunStatus, RunCounts };

export const sync = pgSchema('sync');

export const noCounts: RunCounts = {
  unitsUpserted: 0,
  residentsUpserted: 0,
  movedIn: 0,
  movedOut: 0,
  skipped: 0,
  flagged: 0,
};

// The property and generated_at are on the snapshot the run processed.
export const runs = sync.table('runs', {
  id: serial().primaryKey(),
  // What the run tried to fetch, kept even when the fetch failed.
  source: text().notNull(),
  // Null when the fetch failed, so there was no snapshot to store.
  snapshotId: integer().references(() => snapshots.id),
  status: text()
    .$type<RunStatus>()
    .notNull()
    .default('running'),
  // The one error that stopped a failed run: fetch, structure or crash. See `errors.ts`.
  error: jsonb().$type<RunError>(),
  startedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  counts: jsonb()
    .$type<RunCounts>()
    .notNull()
    .default(noCounts),
});

// The latest decision per resident, so staff can see why someone was or was not moved in or out.
export const decisions = sync.table('decisions', {
  propertyId: text().notNull(),
  unitRemoteId: text().notNull(),
  residentRemoteId: text().notNull(),
  action: text()
    .$type<Action>()
    .notNull(),
  reason: text()
    .$type<Reason>()
    .notNull(),
  runId: integer()
    .notNull()
    .references(() => runs.id),
  decidedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  primaryKey({
    columns: [
      t.propertyId,
      t.unitRemoteId,
      t.residentRemoteId,
    ],
  }),
]);

export const changeLog = sync.table('change_log', {
  id: serial().primaryKey(),
  runId: integer()
    .notNull()
    .references(() => runs.id),
  propertyId: text().notNull(),
  unitRemoteId: text(),
  residentRemoteId: text(),
  kind: text()
    .$type<ChangeKind>()
    .notNull(),
  details: jsonb()
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  recordedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // For the unit and resident pages' timelines.
  index().on(t.propertyId, t.unitRemoteId, t.residentRemoteId),
]);

// Every exception each run found inside the data: data (a record left out) and review (a decision flagged).
// Recorded again on every run, so the latest run's rows are the current list. See `exceptions.ts`.
export const exceptions = sync.table('exceptions', {
  id: serial().primaryKey(),
  runId: integer()
    .notNull()
    .references(() => runs.id),
  propertyId: text().notNull(),
  kind: text()
    .$type<ExceptionKind>()
    .notNull(),
  reason: text()
    .$type<SyncException['reason']>()
    .notNull(),
  unitRemoteId: text(),
  leaseRemoteId: text(),
  residentRemoteId: text(),
  recordedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index().on(t.runId, t.kind),
  index().on(t.propertyId, t.unitRemoteId, t.residentRemoteId),
]);
