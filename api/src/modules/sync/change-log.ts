import { localToday } from '~/modules/sync/dates';
import { residentKey } from '~/modules/sync/rentlive-state';
import { residentsOf } from '~/modules/sync/residents';
import { mapUnitStatus } from '~/modules/sync/unit-status';
import type { Lease, NormalizedSnapshot, Unit } from '~/modules/lakeside/normalize';
import type { SyncException } from '~/modules/sync/exceptions';
import type { Resident } from '~/modules/sync/residents';
import type { Decision } from '~/modules/sync/rules';

// What a run changed, as entries for `sync.change_log`.
// It compares the previous run's snapshot with this one, so running the same snapshot again changes nothing and records nothing.

export type ChangeKind =
  | 'unit_created'
  | 'unit_status_changed'
  | 'unit_updated'
  | 'lease_added'
  | 'lease_changed'
  | 'lease_removed'
  | 'resident_created'
  | 'resident_updated'
  | 'moved_in'
  | 'moved_out'
  | 'flagged_for_review';

export type ChangeEntry = {
  kind: ChangeKind;
  unitRemoteId: string | null;
  residentRemoteId: string | null;
  details: Record<string, unknown>;
};

export type ChangeInput = {
  // The snapshot of the property's last successful run, or null on the first run.
  previous: NormalizedSnapshot | null;
  next: NormalizedSnapshot;
  // The moves RentLive actually made, not the ones planned.
  moves: Array<Decision>;
  previousReviews: Array<SyncException>;
  reviews: Array<SyncException>;
};

export const changesOf = ({ previous, next, moves, previousReviews, reviews }: ChangeInput): Array<ChangeEntry> => {
  return [
    ...unitChanges(previous?.units ?? [], next.units),
    ...leaseChanges(previous?.leases ?? [], next.leases),
    ...residentChanges(previous ? syncedResidents(previous) : [], syncedResidents(next)),
    ...moves.map((move): ChangeEntry => ({
      kind: move.action === 'move_in' ? 'moved_in' : 'moved_out',
      unitRemoteId: move.unitRemoteId,
      residentRemoteId: move.residentRemoteId,
      details: { leaseRemoteId: move.leaseRemoteId },
    })),
    ...newFlags(previousReviews, reviews),
  ];
};

const unitChanges = (before: Array<Unit>, after: Array<Unit>): Array<ChangeEntry> => {
  const beforeById = new Map(before.map((unit) => [unit.remoteId, unit]));
  return after.flatMap((unit): Array<ChangeEntry> => {
    const entry = (kind: ChangeKind, details: Record<string, unknown>): ChangeEntry => ({
      kind,
      unitRemoteId: unit.remoteId,
      residentRemoteId: null,
      details,
    });
    const was = beforeById.get(unit.remoteId);
    if (!was) {
      return [
        entry('unit_created', {
          unitNumber: unit.unitNumber,
          rawStatus: unit.rawStatus,
          status: mapUnitStatus(unit.rawStatus),
        }),
      ];
    }

    const entries: Array<ChangeEntry> = [];
    // The raw code, not the mapped status, so a change the mapping hides (like `null` to `D`) is still recorded.
    if (was.rawStatus !== unit.rawStatus) {
      entries.push(entry('unit_status_changed', {
        from: {
          rawStatus: was.rawStatus,
          status: mapUnitStatus(was.rawStatus),
        },
        to: {
          rawStatus: unit.rawStatus,
          status: mapUnitStatus(unit.rawStatus),
        },
      }));
    }
    const changes = fieldChanges(was, unit, ['unitNumber', 'buildingName', 'floorplanName']);
    if (changes) {
      entries.push(entry('unit_updated', { changes }));
    }
    return entries;
  });
};

const leaseChanges = (before: Array<Lease>, after: Array<Lease>): Array<ChangeEntry> => {
  const entry = (kind: ChangeKind, lease: Lease, details: Record<string, unknown>): ChangeEntry => ({
    kind,
    unitRemoteId: lease.unitRemoteId,
    residentRemoteId: null,
    details: {
      leaseRemoteId: lease.remoteId,
      ...details,
    },
  });
  const beforeById = new Map(before.map((lease) => [lease.remoteId, lease]));
  const afterIds = new Set(after.map((lease) => lease.remoteId));

  const addedOrChanged = after.flatMap((lease): Array<ChangeEntry> => {
    const was = beforeById.get(lease.remoteId);
    if (!was) {
      return [
        entry('lease_added', lease, {
          status: lease.status,
          startDate: lease.startDate,
          endDate: lease.endDate,
        }),
      ];
    }
    const changes = fieldChanges(was, lease, ['unitRemoteId', 'status', 'startDate', 'endDate']);
    return changes ? [entry('lease_changed', lease, { changes })] : [];
  });
  const removed = before
    .filter((lease) => !afterIds.has(lease.remoteId))
    .map((lease) => entry('lease_removed', lease, {}));
  return [...addedOrChanged, ...removed];
};

const RESIDENT_FIELDS = [
  'leaseRemoteId',
  'type',
  'effectiveStatus',
  'firstName',
  'lastName',
  'email',
  'phone',
  'moveInDate',
  'moveOutDate',
] as const;

// Residents as RentLive stores them: only those the sync upserts, each with their own snapshot's today.
const syncedResidents = (snapshot: NormalizedSnapshot): Array<Resident> => {
  return residentsOf(snapshot, localToday(snapshot.generatedAt, snapshot.property.timezone)).filter((resident) => resident.synced);
};

const residentChanges = (before: Array<Resident>, after: Array<Resident>): Array<ChangeEntry> => {
  const beforeByKey = new Map(before.map((resident) => [residentKey(resident.unitRemoteId, resident.residentRemoteId), resident]));
  return after.flatMap((resident): Array<ChangeEntry> => {
    const was = beforeByKey.get(residentKey(resident.unitRemoteId, resident.residentRemoteId));
    const ids = {
      unitRemoteId: resident.unitRemoteId,
      residentRemoteId: resident.residentRemoteId,
    };
    if (!was) {
      return [
        {
          kind: 'resident_created',
          ...ids,
          details: {
            leaseRemoteId: resident.leaseRemoteId,
            type: resident.type,
            effectiveStatus: resident.effectiveStatus,
          },
        },
      ];
    }
    const changes = fieldChanges(was, resident, RESIDENT_FIELDS);
    return changes
      ? [
        {
          kind: 'resident_updated',
          ...ids,
          details: { changes },
        },
      ]
      : [];
  });
};

// A flag is recorded when it first appears, or when its reason changes, never once per run.
const newFlags = (before: Array<SyncException>, after: Array<SyncException>): Array<ChangeEntry> => {
  const flagKey = (review: SyncException): string => `${review.unitRemoteId}/${review.residentRemoteId}/${review.reason}`;
  const seen = new Set(before.map(flagKey));
  return after
    .filter((review) => !seen.has(flagKey(review)))
    .map((review) => ({
      kind: 'flagged_for_review',
      unitRemoteId: review.unitRemoteId,
      residentRemoteId: review.residentRemoteId,
      details: { reason: review.reason },
    }));
};

// The listed fields that differ, as `{ field: { from, to } }`, or null when none do.
const fieldChanges = <T extends object>(before: T, after: T, fields: ReadonlyArray<keyof T & string>): Record<string, {
  from: unknown;
  to: unknown
}> | null => {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length === 0) {
    return null;
  }
  return Object.fromEntries(changed.map((field) => [
    field,
    {
      from: before[field],
      to: after[field],
    },
  ]));
};
