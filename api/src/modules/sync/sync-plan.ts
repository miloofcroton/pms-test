// The pure sync pipeline: a raw Lakeside snapshot and what RentLive has stored go in, and what to do about each resident comes out.
// No I/O, so every rule can be tested without a database.

/** What RentLive stores for one resident on one unit. */
export type ResidentState = {
  movedIn: boolean;
  everMovedOut: boolean;
  leaseRemoteId: string | null;
};

/** Keyed by `residentKey`, because RentLive identifies a resident by unit and resident together. */
export type RentLiveState = ReadonlyMap<string, ResidentState>;

export type Action = 'move_in' | 'move_out' | 'none';

/** One per resident in the snapshot, and one per moved-in resident missing from it. */
export type Decision = {
  unitRemoteId: string;
  residentRemoteId: string;
  leaseRemoteId: string | null;
  action: Action;
  reason: string;
  flagged: boolean;
};

/** A lease that could not be placed on a unit, so none of its people were synced. */
export type Issue = {
  leaseRemoteId: string;
  reason: string;
};

export type SyncPlan = {
  today: string;
  decisions: Array<Decision>;
  issues: Array<Issue>;
};

export function residentKey(unitRemoteId: string, residentRemoteId: string): string {
  return `${unitRemoteId}/${residentRemoteId}`;
}

export function emptyState(): RentLiveState {
  return new Map();
}

export function syncPlan(raw: unknown, state: RentLiveState): SyncPlan {
  throw new Error('Not implemented');
}

export function applyPlan(state: RentLiveState, plan: SyncPlan): RentLiveState {
  throw new Error('Not implemented');
}
