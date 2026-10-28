import { boolean, date, integer, jsonb, pgSchema, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';

// What RentLive stores. Only the RentLive implementation in src/rentlive touches these tables.
// In production this schema is the real RentLive, which we don't own.
export const rentlive = pgSchema('rentlive');

export const rentliveUnits = rentlive.table('units', {
  propertyId: text().notNull(),
  remoteId: text().notNull(),
  unitNumber: text().notNull(),
  buildingName: text(),
  floorplanName: text(),
  status: text().notNull(),
}, (t) => [primaryKey({ columns: [t.propertyId, t.remoteId] })]);

// A resident is identified by unit and resident remote id together.
export const rentliveResidents = rentlive.table('residents', {
  propertyId: text().notNull(),
  unitRemoteId: text().notNull(),
  remoteId: text().notNull(),
  leaseRemoteId: text(),
  firstName: text(),
  lastName: text(),
  email: text(),
  phone: text(),
  movedIn: boolean().notNull().default(false),
  everMovedOut: boolean().notNull().default(false),
}, (t) => [primaryKey({ columns: [t.propertyId, t.unitRemoteId, t.remoteId] })]);

// What the sync service owns: the normalized snapshot, what it decided, and what it did.
export const sync = pgSchema('sync');

export const properties = sync.table('properties', {
  id: text().primaryKey(),
  name: text().notNull(),
  timezone: text().notNull(),
});

export const runs = sync.table('runs', {
  id: serial().primaryKey(),
  propertyId: text().notNull(),
  snapshotFile: text().notNull(),
  generatedAt: timestamp({ withTimezone: true }).notNull(),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  counts: jsonb().$type<Record<string, number>>().notNull().default({}),
});

export const leases = sync.table('leases', {
  propertyId: text().notNull(),
  remoteId: text().notNull(),
  unitRemoteId: text().notNull(),
  status: text().notNull(),
  startDate: date(),
  endDate: date(),
}, (t) => [primaryKey({ columns: [t.propertyId, t.remoteId] })]);

export const leaseCustomers = sync.table('lease_customers', {
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
}, (t) => [primaryKey({ columns: [t.propertyId, t.leaseRemoteId, t.remoteId] })]);

// The latest decision per resident, so staff can see why someone was or was not moved in or out.
export const decisions = sync.table('decisions', {
  propertyId: text().notNull(),
  unitRemoteId: text().notNull(),
  residentRemoteId: text().notNull(),
  action: text().notNull(),
  reason: text().notNull(),
  runId: integer().notNull(),
  decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.propertyId, t.unitRemoteId, t.residentRemoteId] })]);

export const changeLog = sync.table('change_log', {
  id: serial().primaryKey(),
  runId: integer().notNull(),
  propertyId: text().notNull(),
  unitRemoteId: text(),
  residentRemoteId: text(),
  kind: text().notNull(),
  details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
