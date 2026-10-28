import { and, eq } from 'drizzle-orm';
import type { ResidentDetail } from '@sync-app/shared';

import { db } from '~/integrations/postgres';
import { localToday } from '~/modules/sync/dates';
import { listChanges } from '~/modules/sync/read-changes';
import { okSnapshots } from '~/modules/sync/read-snapshots';
import { runExceptions } from '~/modules/sync/read-unit';
import { residentsOf } from '~/modules/sync/residents';
import { decisions } from '~/modules/sync/schema';
import type { RentLive } from '~/modules/rentlive/contract';
import type { Resident } from '~/modules/sync/residents';

// Reads for the resident detail page: one resident on one unit, and why they were or weren't moved.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { ResidentDetail };

export const getResident = async (
  propertyId: string,
  unitRemoteId: string,
  residentRemoteId: string,
  rentLive: RentLive,
): Promise<ResidentDetail | null> => {
  const all = await okSnapshots(propertyId);
  const [latest] = all;
  if (!latest) {
    return null;
  }

  // The resident as the rules see them, combined across their leases, from the newest snapshot that has them.
  let seen: {
    resident: Resident;
    generatedAt: string
  } | null = null;
  for (const { snapshot } of all) {
    const today = localToday(snapshot.generatedAt, snapshot.property.timezone);
    const resident = residentsOf(snapshot, today).find((candidate) => candidate.unitRemoteId === unitRemoteId && candidate.residentRemoteId === residentRemoteId);
    if (resident) {
      seen = {
        resident,
        generatedAt: snapshot.generatedAt,
      };
      break;
    }
  }
  if (!seen) {
    return null;
  }

  const stored = await rentLive.getResidentState(propertyId, unitRemoteId, residentRemoteId);
  const [decision] = await db.select({
    action: decisions.action,
    reason: decisions.reason,
    runId: decisions.runId,
    decidedAt: decisions.decidedAt,
  })
    .from(decisions)
    .where(and(eq(decisions.propertyId, propertyId), eq(decisions.unitRemoteId, unitRemoteId), eq(decisions.residentRemoteId, residentRemoteId)));

  return {
    ...seen.resident,
    property: latest.snapshot.property,
    inLatestSnapshot: seen.generatedAt === latest.snapshot.generatedAt,
    seenGeneratedAt: seen.generatedAt,
    rentLive: stored.ok ? stored.state : null,
    decision: decision
      ? {
        ...decision,
        decidedAt: decision.decidedAt.toISOString(),
      }
      : null,
    exceptions: await runExceptions(latest.runId, unitRemoteId, residentRemoteId),
    changes: await listChanges(propertyId, {
      unitRemoteId,
      residentRemoteId,
    }),
  };
};
