// What RentLive has stored, as plain data the pure sync code reads.
// The runner builds it from the RentLive contract: `list_moved_in` per unit and `get_resident_state` per resident.

/** What RentLive stores for one resident on one unit. */
export type ResidentState = {
  unitRemoteId: string;
  residentRemoteId: string;
  movedIn: boolean;
  everMovedOut: boolean;
  leaseRemoteId: string | null;
};

/** Keyed by `residentKey`, because RentLive identifies a resident by unit and resident together. */
export type RentLiveState = ReadonlyMap<string, ResidentState>;

export const residentKey = (unitRemoteId: string, residentRemoteId: string): string => {
  return `${unitRemoteId}/${residentRemoteId}`;
};

export const emptyState = (): RentLiveState => {
  return new Map();
};
