import { and, eq, isNotNull } from 'drizzle-orm';
import type { UnitView } from '@sync-app/shared';

import { db } from '~/integrations/postgres';
import { snapshots } from '~/modules/lakeside/schema';
import { getProperty, okSnapshots } from '~/modules/sync/read-snapshots';
import { runs } from '~/modules/sync/schema';
import { mapUnitStatus } from '~/modules/sync/unit-status';
import type { Property, Unit } from '~/modules/lakeside/normalize';

// Reads for the units view: what Lakeside last said about each unit, with the RentLive status it maps to.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { UnitView };

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
