import type { NormalizedSnapshot, RecordExceptionReason, SnapshotException } from '../lakeside/normalize';

import type { Reason } from './rules';
import type { SyncPlan } from './sync-plan';

// Every exception a run finds, of all three kinds, as rows for `sync.exceptions`.
// `snapshot`: the structure broke the contract and the run failed.
// `record`: one record broke it and was left out, or kept without the broken part.
// `review`: the data is valid, but the rules can't settle the case safely, so a decision was flagged.

export type ExceptionKind = 'snapshot' | 'record' | 'review';

export type SyncException = {
  kind: ExceptionKind;
  propertyId: string | null;
  reason: 'invalid_structure' | RecordExceptionReason | Reason;
  unitRemoteId: string | null;
  leaseRemoteId: string | null;
  residentRemoteId: string | null;
  details: Record<string, unknown>;
};

/** The record exceptions from normalizing, then the review exceptions from the flagged decisions. */
export const exceptionsOf = (snapshot: NormalizedSnapshot, plan: SyncPlan): Array<SyncException> => {
  const propertyId = snapshot.property.remoteId;
  const records = snapshot.exceptions.map((exception): SyncException => ({
    kind: 'record',
    propertyId,
    reason: exception.reason,
    unitRemoteId: exception.unitRemoteId,
    leaseRemoteId: exception.leaseRemoteId,
    residentRemoteId: exception.customerRemoteId,
    details: {},
  }));
  const reviews = plan.decisions
    .filter((decision) => decision.flagged)
    .map((decision): SyncException => ({
      kind: 'review',
      propertyId,
      reason: decision.reason,
      unitRemoteId: decision.unitRemoteId,
      leaseRemoteId: decision.leaseRemoteId,
      residentRemoteId: decision.residentRemoteId,
      details: {},
    }));
  return [...records, ...reviews];
};

/** The one row for a run that failed on a snapshot exception. */
export const snapshotExceptionOf = (exception: SnapshotException, propertyId: string | null): SyncException => {
  return {
    kind: 'snapshot',
    propertyId,
    reason: 'invalid_structure',
    unitRemoteId: null,
    leaseRemoteId: null,
    residentRemoteId: null,
    details: {
      field: exception.field,
      value: exception.value,
    },
  };
};
