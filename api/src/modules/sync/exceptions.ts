import type { ExceptionKind, SyncException } from '@sync-app/shared';

import type { NormalizedSnapshot } from '~/modules/lakeside/normalize';
import type { SyncPlan } from '~/modules/sync/sync-pipeline';

// An exception concerns something inside the data, and the rest of the run goes ahead.
// Problems with the whole run are errors instead, in `errors.ts`.
// `data`: one record broke the contract and was left out, or kept without the broken part.
// `review`: the data is valid, but the rules can't settle the case safely, so a decision was flagged and nobody was moved.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { ExceptionKind, SyncException };

/** The record exceptions from normalizing, then the flagged decisions, as rows for `sync.exceptions`. */
export const exceptionsOf = (snapshot: NormalizedSnapshot, plan: SyncPlan): Array<SyncException> => {
  const propertyId = snapshot.property.remoteId;
  const data = snapshot.exceptions.map((exception): SyncException => ({
    kind: 'data',
    propertyId,
    reason: exception.reason,
    unitRemoteId: exception.unitRemoteId,
    leaseRemoteId: exception.leaseRemoteId,
    residentRemoteId: exception.customerRemoteId,
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
    }));
  return [...data, ...reviews];
};
