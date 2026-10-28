import { and, desc, eq } from 'drizzle-orm';

import { db } from '~/integrations/postgres';
import { changeLog } from '~/modules/sync/schema';
import type { ChangeKind } from '~/modules/sync/change-log';

// Reads for the change log: the property's feed, and the timelines on the unit and resident pages.

export type ChangeView = {
  id: number;
  runId: number;
  recordedAt: string;
  kind: ChangeKind;
  unitRemoteId: string | null;
  residentRemoteId: string | null;
  details: Record<string, unknown>;
};

/** Newest first. With a unit, its own entries and its residents'; with a resident too, just theirs. */
export const listChanges = async (propertyId: string, filter: {
  unitRemoteId?: string;
  residentRemoteId?: string
} = {}): Promise<Array<ChangeView>> => {
  const rows = await db.select()
    .from(changeLog)
    .where(and(
      eq(changeLog.propertyId, propertyId),
      filter.unitRemoteId === undefined ? undefined : eq(changeLog.unitRemoteId, filter.unitRemoteId),
      filter.residentRemoteId === undefined ? undefined : eq(changeLog.residentRemoteId, filter.residentRemoteId),
    ))
    .orderBy(desc(changeLog.id));
  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    recordedAt: row.recordedAt.toISOString(),
    kind: row.kind,
    unitRemoteId: row.unitRemoteId,
    residentRemoteId: row.residentRemoteId,
    details: row.details,
  }));
};
