import { describe, expect, it } from 'vitest';

import { describeChange, formatTime, personName, rawCode, reasonText } from './format';
import type { ChangeView } from './api';

const change = (kind: ChangeView['kind'], details: Record<string, unknown>): ChangeView => {
  return {
    id: 1,
    runId: 1,
    recordedAt: '2026-10-28T06:30:00.000Z',
    kind,
    unitRemoteId: '5001',
    residentRemoteId: null,
    details,
  };
};

describe('formatTime', () => {
  it('shows a time in the property\'s timezone, not UTC', () => {
    expect(formatTime('2026-10-28T06:30:00Z', 'America/Los_Angeles')).toBe('Oct 27, 2026, 11:30 PM PDT');
  });

  it('shows the winter offset after daylight saving time ends', () => {
    expect(formatTime('2026-12-15T07:30:00Z', 'America/Los_Angeles')).toBe('Dec 14, 2026, 11:30 PM PST');
  });

  it('falls back to UTC when the timezone is unknown', () => {
    expect(formatTime('2026-10-28T06:30:00Z', null)).toBe('Oct 28, 2026, 6:30 AM UTC');
  });

  it('shows nothing for no time', () => {
    expect(formatTime(null, 'America/Los_Angeles')).toBe('—');
  });
});

describe('reasonText', () => {
  it('explains why a Current resident was not moved in', () => {
    expect(reasonText('move_in_date_outside_window')).toBe('Not moved in: the move-in date is more than 14 days ago.');
  });

  it('explains record exceptions and run errors too', () => {
    expect(reasonText('lease_unit_not_in_snapshot')).toBe('Lease left out: its unit is not in the snapshot.');
    expect(reasonText('snapshot_older_than_last_run')).toBe('Refused: the snapshot is older than the last run\'s.');
  });
});

describe('rawCode', () => {
  it('shows an empty or missing code so it can be told apart', () => {
    expect(rawCode('O1')).toBe('O1');
    expect(rawCode('')).toBe('""');
    expect(rawCode(null)).toBe('none');
  });
});

describe('personName', () => {
  it('joins the names that are there', () => {
    expect(personName('Alice', 'Nguyen')).toBe('Alice Nguyen');
    expect(personName(null, 'Nguyen')).toBe('Nguyen');
    expect(personName(null, null)).toBe('(no name)');
  });
});

describe('describeChange', () => {
  it('describes a status change with the raw codes', () => {
    expect(describeChange(change('unit_status_changed', {
      from: {
        rawStatus: 'o1',
        status: 'Down',
      },
      to: {
        rawStatus: 'V2',
        status: 'Vacant',
      },
    }))).toBe('Down (o1) → Vacant (V2)');
  });

  it('lists the fields that changed', () => {
    expect(describeChange(change('resident_updated', {
      changes: {
        leaseRemoteId: {
          from: '9001',
          to: '9101',
        },
        moveOutDate: {
          from: null,
          to: '2026-10-26',
        },
      },
    }))).toBe('lease: 9001 → 9101; move-out date: — → 2026-10-26');
  });

  it('describes a move with its lease', () => {
    expect(describeChange(change('moved_in', { leaseRemoteId: '9001' }))).toBe('Lease 9001');
  });

  it('describes a flag with its reason', () => {
    expect(describeChange(change('flagged_for_review', { reason: 'no_move_out_date' }))).toBe('Not moved out: they are not Current, but there is no move-out date.');
  });

  it('describes a new lease and a lease that is gone', () => {
    expect(describeChange(change('lease_added', {
      leaseRemoteId: '9101',
      status: 'Current',
      startDate: '2026-10-27',
      endDate: '2027-10-16',
    }))).toBe('Lease 9101: Current, 2026-10-27 to 2027-10-16');
    expect(describeChange(change('lease_removed', { leaseRemoteId: '9001' }))).toBe('Lease 9001 is no longer in the snapshot');
  });
});
