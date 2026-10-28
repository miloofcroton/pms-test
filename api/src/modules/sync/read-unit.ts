import { and, asc, eq } from 'drizzle-orm';
import type { LeasePerson, LeaseView, MovedInView, UnitDetail } from '@sync-app/shared';

import { db } from '~/integrations/postgres';
import { listChanges } from '~/modules/sync/read-changes';
import { okSnapshots } from '~/modules/sync/read-snapshots';
import { unitView } from '~/modules/sync/read-units';
import { effectiveStatus } from '~/modules/sync/residents';
import { exceptions } from '~/modules/sync/schema';
import type { Customer } from '~/modules/lakeside/normalize';
import type { RentLive } from '~/modules/rentlive/contract';
import type { SyncException } from '~/modules/sync/exceptions';
import type { OkSnapshot } from '~/modules/sync/read-snapshots';

// Reads for the unit detail page.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { LeasePerson, LeaseView, MovedInView, UnitDetail };

/** One run's exceptions, narrowed to a unit and, optionally, one resident on it. */
export const runExceptions = async (runId: number, unitRemoteId: string, residentRemoteId?: string): Promise<Array<SyncException>> => {
  return db.select({
    kind: exceptions.kind,
    propertyId: exceptions.propertyId,
    reason: exceptions.reason,
    unitRemoteId: exceptions.unitRemoteId,
    leaseRemoteId: exceptions.leaseRemoteId,
    residentRemoteId: exceptions.residentRemoteId,
  })
    .from(exceptions)
    .where(and(
      eq(exceptions.runId, runId),
      eq(exceptions.unitRemoteId, unitRemoteId),
      residentRemoteId === undefined ? undefined : eq(exceptions.residentRemoteId, residentRemoteId),
    ))
    .orderBy(asc(exceptions.id));
};

/** The person on a unit, as the newest snapshot that has them describes them, and which snapshot that was. */
export const findCustomer = (snapshots: Array<OkSnapshot>, unitRemoteId: string, residentRemoteId: string): {
  customer: Customer;
  leaseStatus: string;
  leaseRemoteId: string;
  seenIn: OkSnapshot
} | null => {
  for (const seenIn of snapshots) {
    for (const lease of seenIn.snapshot.leases.filter((candidate) => candidate.unitRemoteId === unitRemoteId)) {
      const customer = lease.customers.find((candidate) => candidate.remoteId === residentRemoteId);
      if (customer) {
        return {
          customer,
          leaseStatus: lease.status,
          leaseRemoteId: lease.remoteId,
          seenIn,
        };
      }
    }
  }
  return null;
};

export const getUnit = async (propertyId: string, unitRemoteId: string, rentLive: RentLive): Promise<UnitDetail | null> => {
  const [latest] = await okSnapshots(propertyId, 1);
  const unit = latest?.snapshot.units.find((candidate) => candidate.remoteId === unitRemoteId);
  if (!latest || !unit) {
    return null;
  }

  const leases = latest.snapshot
    .leases
    .filter((lease) => lease.unitRemoteId === unitRemoteId)
    .map((lease): LeaseView => ({
      remoteId: lease.remoteId,
      status: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate,
      people: lease.customers.map((customer) => ({
        residentRemoteId: customer.remoteId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        type: customer.type,
        status: customer.status,
        effectiveStatus: effectiveStatus(lease.status, customer.status),
      })),
    }));

  // RentLive says who is moved in; the snapshots only say what they're called.
  // Someone can be moved in but missing from the latest snapshot (day 3), so older snapshots are read only then.
  const { residents } = await rentLive.listMovedIn(propertyId, unitRemoteId);
  let snapshots = [latest];
  if (residents.some((resident) => !findCustomer(snapshots, unitRemoteId, resident.residentRemoteId))) {
    snapshots = await okSnapshots(propertyId);
  }
  const movedIn = residents
    .map((resident): MovedInView => {
      const found = findCustomer(snapshots, unitRemoteId, resident.residentRemoteId);
      return {
        ...resident,
        firstName: found?.customer.firstName ?? null,
        lastName: found?.customer.lastName ?? null,
      };
    })
    .sort((a, b) => a.residentRemoteId.localeCompare(b.residentRemoteId));

  return {
    property: latest.snapshot.property,
    generatedAt: latest.snapshot.generatedAt,
    unit: unitView(unit),
    leases,
    movedIn,
    exceptions: await runExceptions(latest.runId, unitRemoteId),
    changes: await listChanges(propertyId, { unitRemoteId }),
  };
};
