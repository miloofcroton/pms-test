import { index, jsonb, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Every snapshot Lakeside sent, as decoded by the Lakeside client, including ones whose structure is broken.
// Append-only: the change log compares a run's snapshot with the previous run's, and old snapshots are evidence of what Lakeside said.
export const lakeside = pgSchema('lakeside');

export const snapshots = lakeside.table('snapshots', {
  id: serial().primaryKey(),
  // Null when the snapshot's structure is too broken to read them, which is when the evidence matters most.
  propertyId: text(),
  source: text().notNull(),
  generatedAt: timestamp({ withTimezone: true }),
  receivedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow(),
  body: jsonb().notNull(),
}, (t) => [
  // For the stale-snapshot check: the latest generated_at per property.
  index().on(t.propertyId, t.generatedAt),
]);
