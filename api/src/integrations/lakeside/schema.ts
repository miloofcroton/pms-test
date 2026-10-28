import { index, jsonb, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Every snapshot Lakeside sent, as decoded by the Lakeside client.
// Append-only: the change log compares a run's snapshot with the previous run's, and old snapshots are evidence of what Lakeside said.
export const lakeside = pgSchema('lakeside');

export const snapshots = lakeside.table('snapshots', {
  id: serial().primaryKey(),
  propertyId: text().notNull(),
  source: text().notNull(),
  generatedAt: timestamp({ withTimezone: true }).notNull(),
  receivedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
  body: jsonb().notNull(),
}, (t) => [
  // For the stale-snapshot check: the latest generated_at per property.
  index().on(t.propertyId, t.generatedAt),
]);
