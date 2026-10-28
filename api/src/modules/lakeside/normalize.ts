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

export function normalizeSnapshot(raw: unknown): NormalizedSnapshot {
  throw new Error('Not implemented');
}
