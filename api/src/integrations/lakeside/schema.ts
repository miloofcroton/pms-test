import { date, pgSchema, primaryKey, text } from 'drizzle-orm/pg-core';

// The latest Lakeside snapshot, normalized.
// Each run overwrites it, so it holds what Lakeside says now, which the change log diffs against.
export const lakesideNormal = pgSchema('lakeside_normal');

export const properties = lakesideNormal.table('properties', {
  id: text().primaryKey(),
  name: text().notNull(),
  timezone: text().notNull(),
});

export const leases = lakesideNormal.table('leases', {
  propertyId: text().notNull(),
  remoteId: text().notNull(),
  unitRemoteId: text().notNull(),
  status: text().notNull(),
  startDate: date(),
  endDate: date(),
}, (t) => [
  primaryKey({ columns: [t.propertyId, t.remoteId] }),
]);

export const leaseCustomers = lakesideNormal.table('lease_customers', {
  propertyId: text().notNull(),
  leaseRemoteId: text().notNull(),
  remoteId: text().notNull(),
  type: text().notNull(),
  status: text(),
  firstName: text(),
  lastName: text(),
  email: text(),
  phone: text(),
  moveInDate: date(),
  moveOutDate: date(),
}, (t) => [
  primaryKey({
    columns: [
      t.propertyId,
      t.leaseRemoteId,
      t.remoteId,
    ],
  }),
]);
