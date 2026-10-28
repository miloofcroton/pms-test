import { describe, expect, it } from 'vitest';

import { normalizeSnapshot, parseLakesideDate, SnapshotException } from './normalize';

describe('parseLakesideDate', () => {
  it('turns MM/DD/YYYY into ISO', () => {
    expect(parseLakesideDate('10/17/2026')).toBe('2026-10-17');
  });

  it('keeps leading zeros', () => {
    expect(parseLakesideDate('09/01/2026')).toBe('2026-09-01');
  });

  it('accepts a leap day', () => {
    expect(parseLakesideDate('02/29/2028')).toBe('2028-02-29');
  });

  it('reads an empty string as no date', () => {
    expect(parseLakesideDate('')).toBeNull(); // Carol's moveOutDate
  });

  it('reads null and a missing field as no date', () => {
    expect(parseLakesideDate(null)).toBeNull();
    expect(parseLakesideDate(undefined)).toBeNull();
  });

  // Anything else breaks the contract, so it is rejected rather than guessed at.
  it.each([
    ['a missing leading zero', '10/1/2026'],
    ['an ISO date', '2026-10-17'],
    ['a month that does not exist', '13/01/2026'],
    ['a day that does not exist', '02/30/2026'],
    ['a leap day in a common year', '02/29/2026'],
    ['surrounding whitespace', ' 10/17/2026'],
    ['a number', 20261017],
  ])('rejects %s', (_, value) => {
    expect(() => parseLakesideDate(value)).toThrow('Expected a Lakeside date (MM/DD/YYYY)');
  });
});

// Raw records shaped like the snapshots in data/, with only what each test changes.

const rawUnit = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 5001,
    unitNumber: '101',
    buildingName: 'A',
    floorplanName: '1x1',
    unitStatus: 'O1',
    ...overrides,
  };
};

const rawCustomer = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 3001,
    customerType: 'Primary',
    leaseCustomerStatus: null,
    firstName: 'Alice',
    lastName: 'Nguyen',
    moveInDate: '10/17/2026',
    moveOutDate: null,
    addresses: { address: { email: 'alice.nguyen@example.com' } },
    phone: { phoneNumber: '(555) 010-3001' },
    ...overrides,
  };
};

const rawLease = (overrides: Record<string, unknown> = {}) => {
  return {
    id: 9001,
    unitId: '5001',
    leaseIntervalStatus: 'Current',
    leaseIntervalId: 70011,
    isMonthToMonth: 0,
    leaseIntervals: {
      leaseInterval: [
        {
          id: 70011,
          leaseIntervalType: 'Lease',
          startDate: '10/17/2026',
          endDate: '10/16/2027',
        },
      ],
    },
    customers: { customer: [rawCustomer()] },
    ...overrides,
  };
};

const rawSnapshot = (overrides: Record<string, unknown> = {}) => {
  return {
    meta: { generated_at: '2026-10-28T06:30:00Z' },
    property: {
      id: 100,
      name: 'Harbor View Apartments',
      timezone: 'America/Los_Angeles',
    },
    units: [rawUnit()],
    leases: [rawLease()],
    ...overrides,
  };
};

describe('normalizeSnapshot', () => {
  describe('the property', () => {
    it('reads the property and generated_at', () => {
      const snapshot = normalizeSnapshot(rawSnapshot());
      expect(snapshot.property).toEqual({
        remoteId: '100',
        name: 'Harbor View Apartments',
        timezone: 'America/Los_Angeles',
      });
      expect(snapshot.generatedAt).toBe('2026-10-28T06:30:00Z');
    });

  });

  // A snapshot exception fails the whole run, so nobody is moved.
  // A record exception leaves one record out, or keeps it without the broken part, and the rest of the snapshot is used.
  describe('snapshot exceptions', () => {
    const exceptionFrom = (raw: unknown): unknown => {
      try {
        normalizeSnapshot(raw);
      }
      catch (error) {
        return error;
      }
      return null;
    };

    it.each([
      [
        'no units list',
        rawSnapshot({ units: undefined }),
        'units',
      ],
      [
        'a generated_at that is not a timestamp',
        rawSnapshot({ meta: { generated_at: 'last night' } }),
        'meta.generated_at',
      ],
      [
        'a unit without an id',
        rawSnapshot({ units: [rawUnit({ id: null })] }),
        'unit.id',
      ],
      [
        'a lease without an id',
        rawSnapshot({ leases: [rawLease({ id: undefined })] }),
        'lease.id',
      ],
      [
        'something that is not an object',
        [],
        'snapshot',
      ],
    ])('rejects %s, naming the field', (_, raw, field) => {
      const exception = exceptionFrom(raw);
      expect(exception).toBeInstanceOf(SnapshotException);
      expect(exception).toMatchObject({ field });
    });
  });

  describe('units', () => {
    it('turns ids into strings and empty names into null', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({
        units: [rawUnit({
          buildingName: '',
          floorplanName: '',
        })],
      }));
      expect(snapshot.units).toEqual([
        {
          remoteId: '5001',
          unitNumber: '101',
          buildingName: null,
          floorplanName: null,
          rawStatus: 'O1',
        },
      ]);
    });

    it.each([
      ['a known code', 'O1'],
      ['a lowercase code', 'o1'],
      ['an unknown code', 'X'],
      ['an empty code', ''],
      ['a null code', null],
    ])('keeps %s exactly as sent', (_, unitStatus) => {
      const snapshot = normalizeSnapshot(rawSnapshot({ units: [rawUnit({ unitStatus })] }));
      expect(snapshot.units[0].rawStatus).toBe(unitStatus);
    });

    it('drops an identical duplicate without a record exception', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({ units: [rawUnit(), rawUnit()] })); // 5003 on day 1
      expect(snapshot.units).toHaveLength(1);
      expect(snapshot.exceptions).toEqual([]);
    });

    describe('a duplicate that differs', () => {
      const conflicting = [
        rawUnit(),
        rawUnit({ unitStatus: 'V1' }),
        rawUnit({
          id: 5002,
          unitNumber: '102',
        }),
      ];

      it('leaves the unit out rather than choosing a copy, and keeps the other units', () => {
        const snapshot = normalizeSnapshot(rawSnapshot({
          units: conflicting,
          leases: [],
        }));
        expect(snapshot.units.map((unit) => unit.remoteId)).toEqual(['5002']);
        expect(snapshot.exceptions).toEqual([
          {
            reason: 'duplicate_unit_differs',
            unitRemoteId: '5001',
            leaseRemoteId: null,
            customerRemoteId: null,
          },
        ]);
      });

      it('records the exception once, however many copies there are', () => {
        const snapshot = normalizeSnapshot(rawSnapshot({
          units: [...conflicting, rawUnit({ unitStatus: 'M' })],
          leases: [],
        }));
        expect(snapshot.exceptions).toHaveLength(1);
      });

      it('leaves out the leases on that unit, with their own record exception', () => {
        const snapshot = normalizeSnapshot(rawSnapshot({ units: conflicting }));
        expect(snapshot.leases).toEqual([]);
        expect(snapshot.exceptions).toEqual([
          expect.objectContaining({ reason: 'duplicate_unit_differs' }),
          {
            reason: 'lease_on_conflicting_unit',
            unitRemoteId: '5001',
            leaseRemoteId: '9001',
            customerRemoteId: null,
          },
        ]);
      });
    });
  });

  describe('leases', () => {
    it('reads a lease with its customers', () => {
      const snapshot = normalizeSnapshot(rawSnapshot());
      expect(snapshot.leases).toEqual([
        {
          remoteId: '9001',
          unitRemoteId: '5001',
          status: 'Current',
          startDate: '2026-10-17',
          endDate: '2027-10-16',
          customers: [
            {
              remoteId: '3001',
              type: 'Primary',
              status: null,
              firstName: 'Alice',
              lastName: 'Nguyen',
              email: 'alice.nguyen@example.com',
              phone: '(555) 010-3001',
              moveInDate: '2026-10-17',
              moveOutDate: null,
            },
          ],
        },
      ]);
      expect(snapshot.exceptions).toEqual([]);
    });

    it('reads no leases as no leases', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [] })); // day 3
      expect(snapshot.leases).toEqual([]);
      expect(snapshot.exceptions).toEqual([]);
    });

    it('takes the dates from the interval in effect, not the first one', () => {
      const lease = rawLease({
        leaseIntervalId: 71010,
        leaseIntervals: {
          leaseInterval: [
            {
              id: 71008,
              leaseIntervalType: 'Renewal Offer',
              startDate: '10/17/2027',
              endDate: '10/15/2028',
            },
            {
              id: 71010,
              leaseIntervalType: 'Lease',
              startDate: '10/27/2026',
              endDate: '10/16/2027',
            },
          ],
        },
      }); // L9101 on day 2
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [lease] }));
      expect(snapshot.leases[0]).toMatchObject({
        startDate: '2026-10-27',
        endDate: '2027-10-16',
      });
    });

    it('keeps a lease whose interval is missing, without dates, and records a record exception', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [rawLease({ leaseIntervalId: 99999 })] }));
      expect(snapshot.leases[0]).toMatchObject({
        startDate: null,
        endDate: null,
      });
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'lease_interval_not_found',
          unitRemoteId: '5001',
          leaseRemoteId: '9001',
          customerRemoteId: null,
        },
      ]);
    });

    it('keeps a lease whose interval has a broken date, without dates, and records a record exception', () => {
      const lease = rawLease({
        leaseIntervals: {
          leaseInterval: [
            {
              id: 70011,
              leaseIntervalType: 'Lease',
              startDate: '2026-10-17',
              endDate: '10/16/2027',
            },
          ],
        },
      });
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [lease] }));
      expect(snapshot.leases[0]).toMatchObject({
        startDate: null,
        endDate: null,
      });
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'lease_interval_invalid_date',
          unitRemoteId: '5001',
          leaseRemoteId: '9001',
          customerRemoteId: null,
        },
      ]);
    });

    it('leaves out a lease whose customers are not a list, and keeps the rest of the snapshot', () => {
      const liam = rawLease({
        id: 9010,
        customers: { customer: rawCustomer() },
      }); // L9010 on day 1
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [liam, rawLease()] }));
      expect(snapshot.leases.map((lease) => lease.remoteId)).toEqual(['9001']);
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'lease_customers_not_a_list',
          unitRemoteId: '5001',
          leaseRemoteId: '9010',
          customerRemoteId: null,
        },
      ]);
    });

    it('leaves out a lease on a unit that is not in the snapshot', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [rawLease({ unitId: '5099' })] })); // Paul
      expect(snapshot.leases).toEqual([]);
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'lease_unit_not_in_snapshot',
          unitRemoteId: '5099',
          leaseRemoteId: '9001',
          customerRemoteId: null,
        },
      ]);
    });

    it('leaves out a lease with no unit', () => {
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [rawLease({ unitId: null })] })); // Quinn
      expect(snapshot.leases).toEqual([]);
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'lease_without_unit',
          unitRemoteId: null,
          leaseRemoteId: '9001',
          customerRemoteId: null,
        },
      ]);
    });
  });

  describe('customers', () => {
    const customerFrom = (overrides: Record<string, unknown>) => {
      const lease = rawLease({ customers: { customer: [rawCustomer(overrides)] } });
      return normalizeSnapshot(rawSnapshot({ leases: [lease] })).leases[0].customers[0];
    };

    it('keeps the customer type exactly as sent', () => {
      expect(customerFrom({ customerType: 'co-applicant' }).type).toBe('co-applicant'); // Sam
    });

    it('keeps the customer status, which may be null', () => {
      expect(customerFrom({ leaseCustomerStatus: 'Past' }).status).toBe('Past'); // Kim
      expect(customerFrom({ leaseCustomerStatus: null }).status).toBeNull();
    });

    it('reads an empty move-out date as no date', () => {
      expect(customerFrom({ moveOutDate: '' }).moveOutDate).toBeNull(); // Carol
    });

    it('reads a missing phone as null', () => {
      expect(customerFrom({ phone: null }).phone).toBeNull(); // Quinn
    });

    it('leaves out a customer with a broken date, and records a record exception', () => {
      const lease = rawLease({ customers: { customer: [rawCustomer({ moveOutDate: '10/1/2026' })] } });
      const snapshot = normalizeSnapshot(rawSnapshot({ leases: [lease] }));
      expect(snapshot.leases[0].customers).toEqual([]);
      expect(snapshot.exceptions).toEqual([
        {
          reason: 'customer_invalid_date',
          unitRemoteId: '5001',
          leaseRemoteId: '9001',
          customerRemoteId: '3001',
        },
      ]);
    });
  });
});
