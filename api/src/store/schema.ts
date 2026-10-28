import { integer, jsonb, pgSchema, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';

// What the sync app did: each run, what it decided for each resident, and what changed.
export const syncAudit = pgSchema('sync_audit');

export const runs = syncAudit.table('runs', {
  id: serial().primaryKey(),
  propertyId: text().notNull(),
  snapshotFile: text().notNull(),
  generatedAt: timestamp({ withTimezone: true }).notNull(),
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
export const decisions = syncAudit.table('decisions', {
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

export const changeLog = syncAudit.table('change_log', {
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
