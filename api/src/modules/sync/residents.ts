import type { NormalizedSnapshot } from '../lakeside/normalize';

import { addDays } from './dates';
import { residentKey } from './rentlive-state';

// RentLive residents from a normalized snapshot: one per person per unit, whatever number of leases they are on there.

export type Resident = {
  unitRemoteId: string;
  residentRemoteId: string;
  // The lease this resident is synced from, when they are on more than one lease on the unit.
  leaseRemoteId: string;
  type: string;
  effectiveStatus: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  // False for a Past resident who moved out more than 14 days ago, whom the brief says not to sync.
  synced: boolean;
};

/** The customer's own status, or the lease status when it is null, with Notice counted as Current. */
export const effectiveStatus = (leaseStatus: string, customerStatus: string | null): string => {
  const status = customerStatus ?? leaseStatus;
  return status === 'Notice' ? 'Current' : status;
};

/**
 * A person on several leases of one unit is one resident, taken from their Current lease if they have one, then from the lease that started last.
 * That keeps a re-signed household like Alice and Bob on day 2 from being read as moved out by the lease they left.
 */
export const residentsOf = (snapshot: NormalizedSnapshot, today: string): Array<Resident> => {
  const cutoff = addDays(today, -14);
  const chosen = new Map<string, {
    resident: Resident;
    startDate: string
  }>();

  for (const lease of snapshot.leases) {
    for (const customer of lease.customers) {
      const status = effectiveStatus(lease.status, customer.status);
      const candidate = {
        resident: {
          unitRemoteId: lease.unitRemoteId,
          residentRemoteId: customer.remoteId,
          leaseRemoteId: lease.remoteId,
          type: customer.type,
          effectiveStatus: status,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          moveInDate: customer.moveInDate,
          moveOutDate: customer.moveOutDate,
          synced: !(status === 'Past' && customer.moveOutDate !== null && customer.moveOutDate < cutoff),
        },
        startDate: lease.startDate ?? '',
      };

      const key = residentKey(lease.unitRemoteId, customer.remoteId);
      const current = chosen.get(key);
      if (!current || isPreferred(candidate, current)) {
        chosen.set(key, candidate);
      }
    }
  }

  return [...chosen.values()].map(({ resident }) => resident);
};

const isPreferred = (
  candidate: {
    resident: Resident;
    startDate: string
  },
  current: {
    resident: Resident;
    startDate: string
  },
): boolean => {
  const candidateIsCurrent = candidate.resident.effectiveStatus === 'Current';
  const currentIsCurrent = current.resident.effectiveStatus === 'Current';
  if (candidateIsCurrent !== currentIsCurrent) {
    return candidateIsCurrent;
  }
  return candidate.startDate > current.startDate;
};
