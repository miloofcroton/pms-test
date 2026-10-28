import { index, integer, jsonb, pgSchema, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';

import { snapshots } from '../lakeside/schema';

import type { ExceptionKind, SyncException } from './exceptions';

// What the sync app did: each run, what it decided for each resident, and what changed.
export const sync = pgSchema('sync');

// The property, source file and generated_at are on the snapshot the run processed.
export const runs = sync.table('runs', {
  id: serial().primaryKey(),
  snapshotId: integer()
    .notNull()
    .references(() => snapshots.id),
  startedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  counts: jsonb()
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
});

// The latest decision per resident, so staff can see why someone was or was not moved in or out.
export const decisions = sync.table('decisions', {
  propertyId: text().notNull(),
  unitRemoteId: text().notNull(),
  residentRemoteId: text().notNull(),
  action: text().notNull(),
  reason: text().notNull(),
  runId: integer().notNull(),
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
  runId: integer().notNull(),
  propertyId: text().notNull(),
  unitRemoteId: text(),
  residentRemoteId: text(),
  kind: text().notNull(),
  details: jsonb()
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  recordedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Every exception each run found: snapshot (the run failed), record (data left out) and review (a decision was flagged).
// Recorded again on every run, so the latest run's rows are the current list. See `exceptions.ts`.
export const exceptions = sync.table('exceptions', {
  id: serial().primaryKey(),
  runId: integer()
    .notNull()
    .references(() => runs.id),
  // Null when a snapshot exception left the property unreadable.
  propertyId: text(),
  kind: text()
    .$type<ExceptionKind>()
    .notNull(),
  reason: text()
    .$type<SyncException['reason']>()
    .notNull(),
  unitRemoteId: text(),
  leaseRemoteId: text(),
  residentRemoteId: text(),
  details: jsonb()
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  recordedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index().on(t.runId, t.kind),
  index().on(t.propertyId, t.unitRemoteId, t.residentRemoteId),
]);
