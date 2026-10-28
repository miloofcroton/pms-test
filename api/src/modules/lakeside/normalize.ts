// Turns a raw Lakeside snapshot into clean, typed data for the sync module.
// It fixes Lakeside's format (dates, ids, empty strings, nesting) but keeps Lakeside's values as sent, because interpreting them is the sync module's job.

export type Property = {
  remoteId: string;
  name: string;
  timezone: string;
};

export type Unit = {
  remoteId: string;
  unitNumber: string;
  buildingName: string | null;
  floorplanName: string | null;
  // The Lakeside code exactly as sent, including `""`, null and codes the mapping doesn't know.
  rawStatus: string | null;
};

export type Customer = {
  remoteId: string;
  // Exactly as sent, so `co-applicant` stays lowercase.
  type: string;
  // The customer's own status, or null when the lease status applies.
  status: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  // ISO `YYYY-MM-DD`, the property's local calendar day.
  moveInDate: string | null;
  moveOutDate: string | null;
};

export type Lease = {
  remoteId: string;
  unitRemoteId: string;
  status: string;
  // From the interval in effect, picked by `leaseIntervalId`.
  startDate: string | null;
  endDate: string | null;
  customers: Array<Customer>;
};

/** A lease that could not be placed on a unit in the snapshot, so it is left out of `leases`. */
export type Issue = {
  leaseRemoteId: string;
  reason: string;
};

export type NormalizedSnapshot = {
  property: Property;
  // ISO timestamp in UTC.
  generatedAt: string;
  units: Array<Unit>;
  leases: Array<Lease>;
  issues: Array<Issue>;
};

/**
 * Turns a Lakeside `MM/DD/YYYY` date into ISO `YYYY-MM-DD`.
 * An empty string, null or a missing field means no date.
 * Anything else throws, because guessing at a broken date could move someone in or out on the wrong day.
 */
export function parseLakesideDate(value: unknown): string | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const match = typeof value === 'string' ? LAKESIDE_DATE.exec(value) : null;
  if (!match || !isRealDay(Number(match[3]), Number(match[1]), Number(match[2]))) {
    throw new Error(`Expected a Lakeside date (MM/DD/YYYY), got ${JSON.stringify(value)}`);
  }

  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

const LAKESIDE_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isRealDay(year: number, month: number, day: number): boolean {
  // Day 0 of the next month is the last day of this one, so this counts leap years for us.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

export function normalizeSnapshot(raw: unknown): NormalizedSnapshot {
  throw new Error('Not implemented');
}
