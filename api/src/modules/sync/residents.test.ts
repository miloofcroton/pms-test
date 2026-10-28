import { describe, expect, it } from 'vitest';

import type { Customer, Lease, NormalizedSnapshot } from '../lakeside/normalize';

import { effectiveStatus, residentsOf } from './residents';

const TODAY = '2026-10-27';

const customer = (overrides: Partial<Customer> = {}): Customer => {
  return {
    remoteId: '3001',
    type: 'Primary',
    status: null,
    firstName: 'Alice',
    lastName: 'Nguyen',
    email: 'alice.nguyen@example.com',
    phone: '(555) 010-3001',
    moveInDate: '2026-10-17',
    moveOutDate: null,
    ...overrides,
  };
};

const lease = (overrides: Partial<Lease> = {}): Lease => {
  return {
    remoteId: '9001',
    unitRemoteId: '5001',
    status: 'Current',
    startDate: '2026-10-17',
    endDate: '2027-10-16',
    customers: [customer()],
    ...overrides,
  };
};

const snapshotWith = (leases: Array<Lease>): NormalizedSnapshot => {
  return {
    property: {
      remoteId: '100',
      name: 'Harbor View Apartments',
      timezone: 'America/Los_Angeles',
    },
    generatedAt: '2026-10-28T06:30:00Z',
    units: [],
    leases,
    exceptions: [],
  };
};

describe('effectiveStatus', () => {
  it('is the customer status when there is one', () => {
    expect(effectiveStatus('Current', 'Past')).toBe('Past'); // Henry on day 2
  });

  it('is the lease status when the customer status is null', () => {
    expect(effectiveStatus('Future', null)).toBe('Future');
  });

  it('counts Notice as Current, from the lease or the customer', () => {
    expect(effectiveStatus('Notice', null)).toBe('Current'); // Frank
    expect(effectiveStatus('Current', 'Notice')).toBe('Current');
  });

  it('keeps any other status exactly as sent', () => {
    expect(effectiveStatus('Applicant', null)).toBe('Applicant');
    expect(effectiveStatus('current', null)).toBe('current');
  });
});

describe('residentsOf', () => {
  it('makes one resident per customer, with the lease they are on', () => {
    expect(residentsOf(snapshotWith([lease()]), TODAY)).toEqual([
      {
        unitRemoteId: '5001',
        residentRemoteId: '3001',
        leaseRemoteId: '9001',
        type: 'Primary',
        effectiveStatus: 'Current',
        firstName: 'Alice',
        lastName: 'Nguyen',
        email: 'alice.nguyen@example.com',
        phone: '(555) 010-3001',
        moveInDate: '2026-10-17',
        moveOutDate: null,
        synced: true,
      },
    ]);
  });

  it('includes guarantors and occupants, who the rules never move in', () => {
    const residents = residentsOf(snapshotWith([
      lease({
        customers: [
          customer({
            remoteId: '3003',
            type: 'Guarantor',
          }),
          customer({
            remoteId: '3020',
            type: 'Occupant',
          }),
        ],
      }),
    ]), TODAY);
    expect(residents.map((r) => r.type)).toEqual(['Guarantor', 'Occupant']);
  });

  describe('a person on two leases of one unit', () => {
    // Alice on day 2: L9001 went Past with a move-out date, and L9101 is Current.
    const past = lease({
      remoteId: '9001',
      status: 'Past',
      customers: [customer({ moveOutDate: '2026-10-26' })],
    });
    const current = lease({
      remoteId: '9101',
      startDate: '2026-10-27',
    });

    it('is one resident, from the Current lease', () => {
      const residents = residentsOf(snapshotWith([past, current]), '2026-10-28');
      expect(residents).toEqual([
        expect.objectContaining({
          leaseRemoteId: '9101',
          effectiveStatus: 'Current',
          moveOutDate: null,
        }),
      ]);
    });

    it('takes the Current lease whichever order the leases come in', () => {
      const residents = residentsOf(snapshotWith([current, past]), '2026-10-28');
      expect(residents.map((r) => r.leaseRemoteId)).toEqual(['9101']);
    });

    it('takes the lease that started last when both are Current', () => {
      const earlier = lease({
        remoteId: '9001',
        startDate: '2026-10-17',
      });
      const residents = residentsOf(snapshotWith([current, earlier]), '2026-10-28');
      expect(residents.map((r) => r.leaseRemoteId)).toEqual(['9101']);
    });
  });

  it('makes two residents for the same person on two units', () => {
    // Mia on day 2: leaving 5011 and moving into 5012.
    const residents = residentsOf(snapshotWith([
      lease({
        remoteId: '9011',
        unitRemoteId: '5011',
        status: 'Past',
        customers: [customer({ remoteId: '3016' })],
      }),
      lease({
        remoteId: '9112',
        unitRemoteId: '5012',
        customers: [customer({ remoteId: '3016' })],
      }),
    ]), '2026-10-28');
    expect(residents.map((r) => `${r.unitRemoteId}/${r.residentRemoteId}`)).toEqual(['5011/3016', '5012/3016']);
  });

  describe('whether a resident is synced', () => {
    const syncedWith = (status: string, moveOutDate: string | null): boolean => {
      const residents = residentsOf(snapshotWith([lease({
        status,
        customers: [customer({ moveOutDate })],
      })]), TODAY);
      return residents[0].synced;
    };

    it('skips a Past resident who moved out more than 14 days ago', () => {
      expect(syncedWith('Past', '2026-10-12')).toBe(false); // Wendy, 15 days
    });

    it('keeps a Past resident who moved out exactly 14 days ago', () => {
      expect(syncedWith('Past', '2026-10-13')).toBe(true);
    });

    it('keeps a Past resident with no move-out date', () => {
      expect(syncedWith('Past', null)).toBe(true); // Jack on day 2
    });

    it('keeps anyone who is not Past, however old their move-out date', () => {
      expect(syncedWith('Current', '2026-08-01')).toBe(true);
    });
  });
});
