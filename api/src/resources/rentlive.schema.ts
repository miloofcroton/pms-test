import { boolean, pgSchema, primaryKey, text } from 'drizzle-orm/pg-core';

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
}, (t) => [
  primaryKey({
    columns: [
      t.propertyId,
      t.remoteId,
    ],
  }),
]);

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
  movedIn: boolean()
    .notNull()
    .default(false),
  everMovedOut: boolean()
    .notNull()
    .default(false),
}, (t) => [
  primaryKey({
    columns: [
      t.propertyId,
      t.unitRemoteId,
      t.remoteId,
    ],
  }),
]);
