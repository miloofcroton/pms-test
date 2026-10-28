import { isDeepStrictEqual } from 'node:util';

import type { DataReason, Property } from '@sync-app/shared';

// Turns a raw Lakeside snapshot into clean, typed data for the sync module.
// It fixes Lakeside's format (dates, ids, empty strings, nesting) but keeps Lakeside's values as sent, because interpreting them is the sync module's job.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { Property };
export type RecordExceptionReason = DataReason;

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

// An error concerns the whole snapshot, and an exception concerns something inside it.
// A `SnapshotError` means the structure breaks the contract: it is thrown, the whole run fails, and nobody is moved.
// A `RecordException` means one record's values break it: that record is left out, or kept without the broken part, and the rest of the snapshot is used.

export class SnapshotError extends Error {
  constructor(
    // The path of the field that broke the contract, such as `lease.id`.
    readonly field: string,
    readonly value: unknown,
  ) {
    super(`Lakeside snapshot has an unexpected ${field}: ${JSON.stringify(value)}`);
    this.name = 'SnapshotError';
  }
}

/** One record that breaks the contract, with whichever ids it concerns. */
export type RecordException = {
  reason: RecordExceptionReason;
  unitRemoteId: string | null;
  leaseRemoteId: string | null;
  customerRemoteId: string | null;
};

// The two reasons that keep the lease, only without its dates.
const KEEPS_RECORD = new Set<RecordExceptionReason>(['lease_interval_not_found', 'lease_interval_invalid_date']);

/** Whether the exception left its record out of the snapshot, so it was never sent to RentLive. */
export const leavesRecordOut = (reason: RecordExceptionReason): boolean => {
  return !KEEPS_RECORD.has(reason);
};

export type NormalizedSnapshot = {
  property: Property;
  // ISO timestamp in UTC.
  generatedAt: string;
  units: Array<Unit>;
  leases: Array<Lease>;
  exceptions: Array<RecordException>;
};

/**
 * Turns a Lakeside `MM/DD/YYYY` date into ISO `YYYY-MM-DD`.
 * An empty string, null or a missing field means no date.
 * Anything else throws, because guessing at a broken date could move someone in or out on the wrong day.
 */
export const parseLakesideDate = (value: unknown): string | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const match = typeof value === 'string' ? LAKESIDE_DATE.exec(value) : null;
  if (!match || !isRealDay(Number(match[3]), Number(match[1]), Number(match[2]))) {
    throw new Error(`Expected a Lakeside date (MM/DD/YYYY), got ${JSON.stringify(value)}`);
  }

  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
};

const LAKESIDE_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const isRealDay = (year: number, month: number, day: number): boolean => {
  // Day 0 of the next month is the last day of this one, so this counts leap years for us.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
};

/**
 * Turns a raw snapshot, as the Lakeside client decoded it, into a `NormalizedSnapshot`.
 * Throws a `SnapshotError` when the structure breaks the contract.
 * Adds a `RecordException` to `exceptions` when one record's values break it.
 */
export const normalizeSnapshot = (raw: unknown): NormalizedSnapshot => {
  const snapshot = record(raw, 'snapshot');
  const meta = record(snapshot.meta, 'meta');
  const property = record(snapshot.property, 'property');
  const exceptions: Array<RecordException> = [];

  const { units, conflicting } = normalizeUnits(list(snapshot.units, 'units'), exceptions);
  const unitIds = new Set(units.map((unit) => unit.remoteId));
  const leases = list(snapshot.leases, 'leases').flatMap((lease) => normalizeLease(lease, unitIds, conflicting, exceptions));

  return {
    property: {
      remoteId: requiredText(property.id, 'property.id'),
      name: requiredText(property.name, 'property.name'),
      timezone: requiredText(property.timezone, 'property.timezone'),
    },
    generatedAt: timestamp(meta.generated_at, 'meta.generated_at'),
    units,
    leases,
    exceptions,
  };
};

// Identical copies of a unit are one unit.
// Copies that disagree are an exception: no copy can be trusted, so the unit is left out and its id returned in `conflicting`.
const normalizeUnits = (rawUnits: Array<unknown>, exceptions: Array<RecordException>): {
  units: Array<Unit>;
  conflicting: ReadonlySet<string>
} => {
  const byId = new Map<string, Unit>();
  const conflicting = new Set<string>();
  for (const rawUnit of rawUnits) {
    const unit = normalizeUnit(rawUnit);
    const first = byId.get(unit.remoteId);
    if (!first) {
      byId.set(unit.remoteId, unit);
    }
    else if (!isDeepStrictEqual(first, unit) && !conflicting.has(unit.remoteId)) {
      conflicting.add(unit.remoteId);
      exceptions.push(recordException('duplicate_unit_differs', { unitRemoteId: unit.remoteId }));
    }
  }
  return {
    units: [...byId.values()].filter((unit) => !conflicting.has(unit.remoteId)),
    conflicting,
  };
};

const normalizeUnit = (value: unknown): Unit => {
  const unit = record(value, 'unit');
  return {
    remoteId: requiredText(unit.id, 'unit.id'),
    unitNumber: requiredText(unit.unitNumber, 'unit.unitNumber'),
    buildingName: optionalText(unit.buildingName, 'unit.buildingName'),
    floorplanName: optionalText(unit.floorplanName, 'unit.floorplanName'),
    rawStatus: rawCode(unit.unitStatus, 'unit.unitStatus'),
  };
};

const normalizeLease = (
  value: unknown,
  unitIds: ReadonlySet<string>,
  conflicting: ReadonlySet<string>,
  exceptions: Array<RecordException>,
): Array<Lease> => {
  const lease = record(value, 'lease');
  const leaseRemoteId = requiredText(lease.id, 'lease.id');
  const unitRemoteId = optionalText(lease.unitId, 'lease.unitId');
  if (unitRemoteId === null) {
    exceptions.push(recordException('lease_without_unit', { leaseRemoteId }));
    return [];
  }
  if (conflicting.has(unitRemoteId)) {
    exceptions.push(recordException('lease_on_conflicting_unit', {
      unitRemoteId,
      leaseRemoteId,
    }));
    return [];
  }
  if (!unitIds.has(unitRemoteId)) {
    exceptions.push(recordException('lease_unit_not_in_snapshot', {
      unitRemoteId,
      leaseRemoteId,
    }));
    return [];
  }

  const ids = {
    unitRemoteId,
    leaseRemoteId,
  };
  // The contract says a list, and only one lease in the data breaks it, so it is left out rather than guessed at.
  const customers = record(lease.customers, 'lease.customers').customer;
  if (!Array.isArray(customers)) {
    exceptions.push(recordException('lease_customers_not_a_list', ids));
    return [];
  }

  return [
    {
      remoteId: leaseRemoteId,
      unitRemoteId,
      status: requiredText(lease.leaseIntervalStatus, 'lease.leaseIntervalStatus'),
      ...intervalDates(lease, ids, exceptions),
      customers: customers.flatMap((customer) => normalizeCustomer(customer, ids, exceptions)),
    },
  ];
};

// The dates of the interval in effect, or no dates with a record exception, because only the UI shows them.
const intervalDates = (
  lease: Record<string, unknown>,
  ids: {
    unitRemoteId: string;
    leaseRemoteId: string
  },
  exceptions: Array<RecordException>,
): {
  startDate: string | null;
  endDate: string | null
} => {
  const noDates = {
    startDate: null,
    endDate: null,
  };
  const wanted = requiredText(lease.leaseIntervalId, 'lease.leaseIntervalId');
  const intervals = list(record(lease.leaseIntervals, 'lease.leaseIntervals').leaseInterval, 'lease.leaseIntervals.leaseInterval');
  const interval = intervals
    .map((value) => record(value, 'lease interval'))
    .find((candidate) => optionalText(candidate.id, 'lease interval id') === wanted);
  if (!interval) {
    exceptions.push(recordException('lease_interval_not_found', ids));
    return noDates;
  }

  try {
    return {
      startDate: parseLakesideDate(interval.startDate),
      endDate: parseLakesideDate(interval.endDate),
    };
  }
  catch {
    exceptions.push(recordException('lease_interval_invalid_date', ids));
    return noDates;
  }
};

const normalizeCustomer = (
  value: unknown,
  ids: {
    unitRemoteId: string;
    leaseRemoteId: string
  },
  exceptions: Array<RecordException>,
): Array<Customer> => {
  const customer = record(value, 'customer');
  const customerRemoteId = requiredText(customer.id, 'customer.id');
  const dates = moveDates(customer);
  if (!dates) {
    exceptions.push(recordException('customer_invalid_date', {
      ...ids,
      customerRemoteId,
    }));
    return [];
  }

  const address = optionalRecord(optionalRecord(customer.addresses, 'customer.addresses')?.address, 'customer.addresses.address');
  const phone = optionalRecord(customer.phone, 'customer.phone');
  return [
    {
      remoteId: customerRemoteId,
      type: requiredText(customer.customerType, 'customer.customerType'),
      status: optionalText(customer.leaseCustomerStatus, 'customer.leaseCustomerStatus'),
      firstName: optionalText(customer.firstName, 'customer.firstName'),
      lastName: optionalText(customer.lastName, 'customer.lastName'),
      email: optionalText(address?.email, 'customer email'),
      phone: optionalText(phone?.phoneNumber, 'customer phone'),
      ...dates,
    },
  ];
};

// Null when either date breaks the contract, so the caller can leave the customer out.
const moveDates = (customer: Record<string, unknown>): {
  moveInDate: string | null;
  moveOutDate: string | null
} | null => {
  try {
    return {
      moveInDate: parseLakesideDate(customer.moveInDate),
      moveOutDate: parseLakesideDate(customer.moveOutDate),
    };
  }
  catch {
    return null;
  }
};

const recordException = (reason: RecordExceptionReason, ids: Partial<Omit<RecordException, 'reason'>>): RecordException => {
  return {
    reason,
    unitRemoteId: ids.unitRemoteId ?? null,
    leaseRemoteId: ids.leaseRemoteId ?? null,
    customerRemoteId: ids.customerRemoteId ?? null,
  };
};

// Readers for the raw JSON.
// Each throws a `SnapshotError` on a value of the wrong shape, naming the field, so a broken snapshot fails loudly.

const snapshotError = (field: string, value: unknown): SnapshotError => {
  return new SnapshotError(field, value);
};

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw snapshotError(field, value);
  }
  return value as Record<string, unknown>;
};

const optionalRecord = (value: unknown, field: string): Record<string, unknown> | null => {
  return value === null || value === undefined ? null : record(value, field);
};

const list = (value: unknown, field: string): Array<unknown> => {
  if (!Array.isArray(value)) {
    throw snapshotError(field, value);
  }
  return value;
};

// Text, or null for an empty string, null or a missing field. Numbers become strings, because Lakeside sends some ids as numbers.
const optionalText = (value: unknown, field: string): string | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  throw snapshotError(field, value);
};

const requiredText = (value: unknown, field: string): string => {
  const text = optionalText(value, field);
  if (text === null) {
    throw snapshotError(field, value);
  }
  return text;
};

// A code kept exactly as sent, so `""` stays `""`.
const rawCode = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw snapshotError(field, value);
};

const timestamp = (value: unknown, field: string): string => {
  const text = requiredText(value, field);
  if (Number.isNaN(Date.parse(text))) {
    throw snapshotError(field, value);
  }
  return text;
};

/** The property and `generated_at` of a raw snapshot, as far as they can be read, so even a broken snapshot can be stored with them. */
export const peekSnapshot = (raw: unknown): {
  propertyId: string | null;
  generatedAt: string | null
} => {
  const read = <T>(reader: () => T): T | null => {
    try {
      return reader();
    }
    catch {
      return null;
    }
  };
  return {
    propertyId: read(() => requiredText(record(record(raw, 'snapshot').property, 'property').id, 'property.id')),
    generatedAt: read(() => timestamp(record(record(raw, 'snapshot').meta, 'meta').generated_at, 'meta.generated_at')),
  };
};
