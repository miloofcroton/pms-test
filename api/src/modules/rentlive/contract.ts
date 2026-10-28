import type { UnitStatus } from '@sync-app/shared';

// The RentLive contract from the brief.
// RentLive owns the database and the workflows; the sync app only ever reaches it through this type.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { UnitStatus };

export type RentLiveUnit = {
  remoteId: string;
  unitNumber: string;
  buildingName: string | null;
  floorplanName: string | null;
  status: UnitStatus;
};

/** In RentLive a resident is identified by unit and resident remote id together. */
export type RentLiveResident = {
  unitRemoteId: string;
  remoteId: string;
  leaseRemoteId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

/** What RentLive has stored for a resident on a unit. */
export type ResidentRemoteState = {
  movedIn: boolean;
  everMovedOut: boolean;
};

export type MovedInResident = {
  residentRemoteId: string;
  // The lease RentLive has stored for the resident.
  leaseRemoteId: string;
};

// A resident who was never upserted can't be moved, and nobody is moved in or out twice.
export type MoveError = 'not_found' | 'already_moved_in' | 'not_moved_in';

export type Done = { ok: true };

export type RentLive = {
  upsertUnits: (propertyId: string, units: Array<RentLiveUnit>) => Promise<Done>;
  // Updates what Lakeside sent, and never touches `movedIn` or `everMovedOut`.
  upsertResidents: (propertyId: string, residents: Array<RentLiveResident>) => Promise<Done>;
  getResidentState: (propertyId: string, unitRemoteId: string, residentRemoteId: string) => Promise<
    | {
      ok: true;
      state: ResidentRemoteState
    }
    | {
      ok: false;
      error: 'not_found'
    }
  >;
  // Residents currently moved in on a unit, with the lease RentLive has stored for each.
  listMovedIn: (propertyId: string, unitRemoteId: string) => Promise<{
    ok: true;
    residents: Array<MovedInResident>
  }>;
  // Starts the move-in workflow, and sets `movedIn` to true.
  moveIn: (propertyId: string, unitRemoteId: string, residentRemoteId: string) => Promise<Done | {
    ok: false;
    error: MoveError
  }>;
  // Starts the move-out workflow, and sets `movedIn` to false and `everMovedOut` to true.
  moveOut: (propertyId: string, unitRemoteId: string, residentRemoteId: string) => Promise<Done | {
    ok: false;
    error: MoveError
  }>;
};
