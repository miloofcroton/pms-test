import { describe, expect, it } from 'vitest';

import { decideResident, decideUnit } from './rules';
import type { ResidentState } from './rentlive-state';
import type { Resident } from './residents';
import type { Decision } from './rules';

const TODAY = '2026-10-27'; // day 1, so the move-in window is 10/14 to 10/27

const resident = (overrides: Partial<Resident> = {}): Resident => {
  return {
    unitRemoteId: '5001',
    residentRemoteId: '3001',
    leaseRemoteId: '9001',
    type: 'Primary',
    effectiveStatus: 'Current',
    firstName: 'Alice',
    lastName: 'Nguyen',
    email: null,
    phone: null,
    moveInDate: '2026-10-17',
    moveOutDate: null,
    synced: true,
    ...overrides,
  };
};

const stored = (overrides: Partial<ResidentState> = {}): ResidentState => {
  return {
    unitRemoteId: '5001',
    residentRemoteId: '3001',
    movedIn: false,
    everMovedOut: false,
    leaseRemoteId: '9001',
    ...overrides,
  };
};

const movedIn = stored({ movedIn: true });

describe('decideResident, not moved in', () => {
  it('moves in a Current lease signer inside the window', () => {
    expect(decideResident(resident(), undefined, TODAY)).toEqual({
      action: 'move_in',
      reason: 'moved_in',
      flagged: false,
    });
  });

  it('moves in a Co-Applicant', () => {
    expect(decideResident(resident({ type: 'Co-Applicant' }), undefined, TODAY).action).toBe('move_in'); // Bob
  });

  it('moves in on the first and last day of the window', () => {
    expect(decideResident(resident({ moveInDate: '2026-10-14' }), undefined, TODAY).action).toBe('move_in');
    expect(decideResident(resident({ moveInDate: '2026-10-27' }), undefined, TODAY).action).toBe('move_in');
  });

  it('moves in someone whose move-out date is in the future', () => {
    expect(decideResident(resident({ moveOutDate: '2026-10-28' }), undefined, TODAY).action).toBe('move_in'); // Grace
  });

  it('treats a resident RentLive has stored but not moved in like a new one', () => {
    expect(decideResident(resident(), stored(), TODAY).action).toBe('move_in');
  });

  it.each([
    ['a guarantor', 'Guarantor'], // Gary
    ['an occupant', 'Occupant'], // Uma
  ])('never moves in %s', (_, type) => {
    expect(decideResident(resident({ type }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'not_a_lease_signer',
      flagged: false,
    });
  });

  it.each([
    ['a lowercase type', 'co-applicant'], // Sam
    ['an unknown type', 'Roommate'],
  ])('flags %s instead of guessing', (_, type) => {
    expect(decideResident(resident({ type }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'unknown_customer_type',
      flagged: true,
    });
  });

  it.each([
    ['Past', 'Past'], // Kim
    ['Future', 'Future'], // Dan on day 1
    ['Cancelled', 'Cancelled'], // Owen
    ['Applicant', 'Applicant'],
  ])('does not move in someone who is %s', (_, effectiveStatus) => {
    expect(decideResident(resident({ effectiveStatus }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'not_current',
      flagged: false,
    });
  });

  it('never moves in again someone who was moved out', () => {
    expect(decideResident(resident(), stored({ everMovedOut: true }), TODAY)).toEqual({
      action: 'none',
      reason: 'previously_moved_out',
      flagged: false,
    });
  });

  it('flags a Current lease signer with no move-in date', () => {
    expect(decideResident(resident({ moveInDate: null }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'no_move_in_date',
      flagged: true,
    });
  });

  it('does not move in someone whose move-in date is in the future', () => {
    expect(decideResident(resident({ moveInDate: '2026-10-28' }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'move_in_date_in_future',
      flagged: false,
    }); // Erin on day 1
  });

  it('does not move in someone whose move-in date is older than 14 days', () => {
    expect(decideResident(resident({ moveInDate: '2026-10-13' }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'move_in_date_outside_window',
      flagged: false,
    }); // a day before the window, like Sam
  });

  it.each([
    ['in the past', '2026-10-25'], // Ivy on day 1
    ['today', '2026-10-27'],
  ])('flags a Current resident whose move-out date is %s', (_, moveOutDate) => {
    expect(decideResident(resident({ moveOutDate }), undefined, TODAY)).toEqual({
      action: 'none',
      reason: 'move_out_date_not_in_future',
      flagged: true,
    });
  });
});

describe('decideResident, moved in', () => {
  it('leaves a Current resident moved in', () => {
    expect(decideResident(resident(), movedIn, TODAY)).toEqual({
      action: 'none',
      reason: 'stays_current',
      flagged: false,
    });
  });

  it('counts Notice as Current, so it leaves them moved in', () => {
    // Notice arrives here already turned into Current by effectiveStatus.
    expect(decideResident(resident({ moveOutDate: '2026-12-25' }), movedIn, TODAY).reason).toBe('stays_current'); // Frank
  });

  it('flags a Current resident whose move-out date has passed, and leaves them moved in', () => {
    expect(decideResident(resident({ moveOutDate: '2026-10-25' }), movedIn, TODAY)).toEqual({
      action: 'none',
      reason: 'move_out_date_not_in_future',
      flagged: true,
    });
  });

  it.each([
    ['today', '2026-10-27'], // Grace on day 2
    ['in the past', '2026-10-26'], // Henry on day 2
  ])('moves out someone who is not Current and whose move-out date is %s', (_, moveOutDate) => {
    expect(decideResident(resident({
      effectiveStatus: 'Past',
      moveOutDate,
    }), movedIn, TODAY)).toEqual({
      action: 'move_out',
      reason: 'moved_out',
      flagged: false,
    });
  });

  it('waits when the move-out date is still in the future', () => {
    expect(decideResident(resident({
      effectiveStatus: 'Past',
      moveOutDate: '2026-10-28',
    }), movedIn, TODAY)).toEqual({
      action: 'none',
      reason: 'move_out_date_in_future',
      flagged: false,
    });
  });

  it('flags someone who is not Current but has no move-out date, instead of moving them out', () => {
    expect(decideResident(resident({
      effectiveStatus: 'Past',
      moveOutDate: null,
    }), movedIn, TODAY)).toEqual({
      action: 'none',
      reason: 'no_move_out_date',
      flagged: true,
    }); // Jack on day 2
  });
});

describe('decideUnit', () => {
  const DAY_2 = '2026-10-28';

  const summary = (decisions: Array<Decision>): Array<string> => {
    return decisions.map((d) => `${d.residentRemoteId} ${d.action} ${d.reason}${d.flagged ? ' (flagged)' : ''}`);
  };

  // Unit 5011 on day 2: Mia's lease is over, and Nora's new lease starts today.
  const mia = resident({
    unitRemoteId: '5011',
    residentRemoteId: '3016',
    leaseRemoteId: '9011',
    effectiveStatus: 'Past',
    moveInDate: '2026-10-16',
    moveOutDate: '2026-10-27',
  });
  const miaMovedIn = stored({
    unitRemoteId: '5011',
    residentRemoteId: '3016',
    leaseRemoteId: '9011',
    movedIn: true,
  });
  const nora = resident({
    unitRemoteId: '5011',
    residentRemoteId: '3021',
    leaseRemoteId: '9119',
    moveInDate: '2026-10-28',
  });

  it('moves out before it moves in, so a new lease can take over the unit in one run', () => {
    expect(summary(decideUnit([nora, mia], [miaMovedIn], DAY_2))).toEqual([
      '3016 move_out moved_out',
      '3021 move_in moved_in',
    ]);
  });

  it('flags a move-in while someone from a different lease is still moved in', () => {
    const miaStaying = {
      ...mia,
      effectiveStatus: 'Current',
      moveOutDate: null,
    };
    expect(summary(decideUnit([miaStaying, nora], [miaMovedIn], DAY_2))).toEqual([
      '3016 none stays_current',
      '3021 none other_lease_moved_in (flagged)',
    ]);
  });

  it('moves in roommates on the same lease together', () => {
    const alice = resident();
    const bob = resident({
      residentRemoteId: '3002',
      type: 'Co-Applicant',
    });
    expect(summary(decideUnit([alice, bob], [], TODAY))).toEqual([
      '3001 move_in moved_in',
      '3002 move_in moved_in',
    ]);
  });

  it('does not let a re-signed lease block its own household', () => {
    // Unit 5001 on day 2: Alice is moved in under L9001 but is now on L9101, and a new co-applicant joins L9101.
    const alice = resident({ leaseRemoteId: '9101' });
    const aliceMovedIn = stored({
      leaseRemoteId: '9001',
      movedIn: true,
    });
    const joiner = resident({
      residentRemoteId: '3099',
      type: 'Co-Applicant',
      leaseRemoteId: '9101',
      moveInDate: '2026-10-27',
    });
    const decisions = decideUnit([alice, joiner], [aliceMovedIn], DAY_2);
    expect(summary(decisions)).toEqual([
      '3099 move_in moved_in',
      '3001 none stays_current',
    ]);
    expect(decisions.find((d) => d.residentRemoteId === '3001')?.leaseRemoteId).toBe('9101');
  });

  it('flags lease signers from two different leases instead of moving both in', () => {
    const first = resident();
    const second = resident({
      residentRemoteId: '3099',
      leaseRemoteId: '9099',
    });
    expect(summary(decideUnit([first, second], [], TODAY))).toEqual([
      '3001 none competing_leases (flagged)',
      '3099 none competing_leases (flagged)',
    ]);
  });

  describe('a moved-in resident who is missing from the snapshot', () => {
    it('is flagged and left moved in', () => {
      expect(decideUnit([], [miaMovedIn], DAY_2)).toEqual([
        {
          unitRemoteId: '5011',
          residentRemoteId: '3016',
          leaseRemoteId: '9011',
          action: 'none',
          reason: 'missing_from_snapshot',
          flagged: true,
        },
      ]); // day 3
    });

    it('still blocks a new lease from moving in', () => {
      expect(summary(decideUnit([nora], [miaMovedIn], DAY_2))).toEqual([
        '3021 none other_lease_moved_in (flagged)',
        '3016 none missing_from_snapshot (flagged)',
      ]);
    });

    it('is ignored when they are not moved in', () => {
      expect(decideUnit([], [stored()], DAY_2)).toEqual([]);
    });
  });

  describe('a Past resident who moved out more than 14 days ago', () => {
    const wendy = resident({
      effectiveStatus: 'Past',
      moveOutDate: '2026-10-12',
      synced: false,
    });

    it('gets no decision when they are not moved in', () => {
      expect(decideUnit([wendy], [], TODAY)).toEqual([]);
    });

    it('is flagged, not skipped, when they are still moved in', () => {
      expect(summary(decideUnit([wendy], [stored({ movedIn: true })], TODAY))).toEqual(['3001 none past_beyond_sync_window (flagged)']);
    });
  });
});
