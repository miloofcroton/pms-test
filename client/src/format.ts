import type { RecordExceptionReason } from '../../api/src/modules/lakeside/normalize';
import type { RunError } from '../../api/src/modules/sync/errors';
import type { Reason } from '../../api/src/modules/sync/rules';

import type { ChangeView } from './api';

// How the views show times, reasons and change-log entries.

export type AnyReason = Reason | RecordExceptionReason | RunError['reason'];

// Typed against the api's unions, so a new reason without a sentence fails the typecheck.
const REASONS: Record<AnyReason, string> = {
  // Decisions.
  moved_in: 'Moved in: every move-in rule passed.',
  not_a_lease_signer: 'Not moved in: guarantors and occupants are never moved in.',
  unknown_customer_type: 'Not moved in: the customer type is not Primary, Co-Applicant, Guarantor or Occupant.',
  not_current: 'Not moved in: their status is not Current.',
  previously_moved_out: 'Not moved in: they were moved out before, and are never moved in again automatically.',
  no_move_in_date: 'Not moved in: there is no move-in date.',
  move_in_date_in_future: 'Not moved in yet: the move-in date is in the future.',
  move_in_date_outside_window: 'Not moved in: the move-in date is more than 14 days ago.',
  move_out_date_not_in_future: 'Not moved: they are Current, but the move-out date is today or earlier.',
  stays_current: 'Moved in, and still Current.',
  moved_out: 'Moved out: they are not Current, and the move-out date has come.',
  move_out_date_in_future: 'Not moved out yet: the move-out date is in the future.',
  no_move_out_date: 'Not moved out: they are not Current, but there is no move-out date.',
  other_lease_moved_in: 'Not moved in: someone from a different lease is still moved in.',
  competing_leases: 'Not moved in: someone from another lease could move in too.',
  missing_from_snapshot: 'Not moved out: moved in, but missing from the latest snapshot.',
  past_beyond_sync_window: 'Not moved out: still moved in, but moved out more than 14 days ago.',
  // Data exceptions.
  duplicate_unit_differs: 'Unit left out: two copies of it in the snapshot disagree.',
  lease_on_conflicting_unit: 'Lease left out: its unit was left out because its copies disagree.',
  lease_without_unit: 'Lease left out: it names no unit.',
  lease_unit_not_in_snapshot: 'Lease left out: its unit is not in the snapshot.',
  lease_customers_not_a_list: 'Lease left out: its customers are not sent as a list.',
  lease_interval_not_found: 'Lease kept without dates: no lease interval matches the one in effect.',
  lease_interval_invalid_date: 'Lease kept without dates: the interval in effect has a broken date.',
  customer_invalid_date: 'Customer left out: a move-in or move-out date is not MM/DD/YYYY.',
  // Run errors.
  snapshot_not_found: 'Failed: the snapshot file does not exist.',
  snapshot_unreadable: 'Failed: the snapshot file could not be read.',
  snapshot_invalid_json: 'Failed: the snapshot file is not JSON.',
  invalid_structure: 'Failed: the snapshot does not have the structure the contract requires.',
  snapshot_older_than_last_run: 'Refused: the snapshot is older than the last run\'s.',
  run_crashed: 'Failed: something unexpected broke partway through the run.',
};

export const reasonText = (reason: AnyReason): string => {
  return REASONS[reason];
};

// Readable names for the fields a change log entry lists.
const FIELDS: Record<string, string> = {
  leaseRemoteId: 'lease',
  unitRemoteId: 'unit',
  type: 'type',
  effectiveStatus: 'status',
  status: 'status',
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  phone: 'phone',
  moveInDate: 'move-in date',
  moveOutDate: 'move-out date',
  startDate: 'start date',
  endDate: 'end date',
  unitNumber: 'unit number',
  buildingName: 'building',
  floorplanName: 'floorplan',
};

const value = (shown: unknown): string => {
  return shown === null || shown === undefined || shown === '' ? '—' : String(shown);
};

export const formatTime = (iso: string | null, timezone: string | null): string => {
  if (!iso) {
    return '—';
  }
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone ?? 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
  // Newer ICU puts a narrow no-break space before AM and PM.
  return text.replaceAll('\u202f', ' ');
};

/** A Lakeside unit code as sent, with an empty or missing code made visible. */
export const rawCode = (code: string | null): string => {
  if (code === null) {
    return 'none';
  }
  return code === '' ? '""' : code;
};

export const personName = (firstName: string | null, lastName: string | null): string => {
  return [firstName, lastName]
    .filter(Boolean)
    .join(' ') || '(no name)';
};

type Status = {
  rawStatus: string | null;
  status: string
};

// Every field any kind of entry puts in `details`, as `changesOf` in the api writes them.
type Details = Partial<Status> & {
  unitNumber?: string;
  from?: Status;
  to?: Status;
  leaseRemoteId?: string;
  startDate?: string | null;
  endDate?: string | null;
  type?: string;
  effectiveStatus?: string;
  reason?: AnyReason;
  changes?: Record<string, {
    from: unknown;
    to: unknown
  }>;
};

export const describeChange = (change: ChangeView): string => {
  const details = change.details as Details;
  switch (change.kind) {
    case 'unit_created':
      return `Unit ${details.unitNumber}, ${details.status} (${rawCode(details.rawStatus ?? null)})`;
    case 'unit_status_changed':
      return `${details.from?.status} (${rawCode(details.from?.rawStatus ?? null)}) → ${details.to?.status} (${rawCode(details.to?.rawStatus ?? null)})`;
    case 'lease_added':
      return `Lease ${details.leaseRemoteId}: ${details.status}, ${value(details.startDate)} to ${value(details.endDate)}`;
    case 'lease_removed':
      return `Lease ${details.leaseRemoteId} is no longer in the snapshot`;
    case 'resident_created':
      return `${details.type}, ${details.effectiveStatus}, on lease ${details.leaseRemoteId}`;
    case 'moved_in':
    case 'moved_out':
      return `Lease ${details.leaseRemoteId}`;
    case 'flagged_for_review':
      return details.reason ? reasonText(details.reason) : '';
    case 'unit_updated':
    case 'resident_updated':
    case 'lease_changed': {
      const changes = Object.entries(details.changes ?? {})
        .map(([field, { from, to }]) => `${FIELDS[field] ?? field}: ${value(from)} → ${value(to)}`)
        .join('; ');
      return change.kind === 'lease_changed' ? `Lease ${details.leaseRemoteId}: ${changes}` : changes;
    }
  }
};

export const CHANGE_KINDS: Record<ChangeView['kind'], string> = {
  unit_created: 'Unit created',
  unit_status_changed: 'Unit status changed',
  unit_updated: 'Unit updated',
  lease_added: 'Lease added',
  lease_changed: 'Lease changed',
  lease_removed: 'Lease removed',
  resident_created: 'Resident created',
  resident_updated: 'Resident updated',
  moved_in: 'Moved in',
  moved_out: 'Moved out',
  flagged_for_review: 'Flagged for review',
};
