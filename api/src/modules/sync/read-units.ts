import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from '../../integrations/postgres';
import { snapshots } from '../lakeside/schema';
import type { Property, Unit } from '../lakeside/normalize';
import type { UnitStatus } from '../rentlive/contract';

import { getProperty, okSnapshots } from './read-snapshots';
import { runs } from './schema';
import { mapUnitStatus } from './unit-status';

// Reads for the units view: what Lakeside last said about each unit, with the RentLive status it maps to.

export type UnitView = {
  remoteId: string;
  unitNumber: string;
  buildingName: string | null;
  floorplanName: string | null;
  rawStatus: string | null;
  status: UnitStatus;
};

export const unitView = (unit: Unit): UnitView => {
  return {
    ...unit,
    status: mapUnitStatus(unit.rawStatus),
  };
};

export const listProperties = async (): Promise<Array<Property>> => {
  const rows = await db.selectDistinct({ propertyId: snapshots.propertyId })
    .from(runs)
    .innerJoin(snapshots, eq(runs.snapshotId, snapshots.id))
    .where(and(eq(runs.status, 'ok'), isNotNull(snapshots.propertyId)));
  const properties = await Promise.all(rows.map((row) => getProperty(row.propertyId ?? '')));
  return properties.filter((property) => property !== null);
};

export const listUnits = async (propertyId: string): Promise<{
  property: Property;
  generatedAt: string;
  units: Array<UnitView>
} | null> => {
  const [latest] = await okSnapshots(propertyId, 1);
  if (!latest) {
    return null;
  }
  return {
    property: latest.snapshot.property,
    generatedAt: latest.snapshot.generatedAt,
    units: latest.snapshot.units.map(unitView),
  };
};
