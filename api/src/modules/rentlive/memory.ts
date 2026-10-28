import type { RentLive, RentLiveResident, RentLiveUnit } from '~/modules/rentlive/contract';

// An in-memory RentLive for unit tests.
// It is as strict as the contract allows, so a test fails if the sync moves someone twice or before upserting them.

type StoredResident = RentLiveResident & {
  propertyId: string;
  movedIn: boolean;
  everMovedOut: boolean;
};

const keyOf = (...ids: Array<string>): string => {
  return JSON.stringify(ids);
};

export const createMemoryRentLive = (): RentLive => {
  const units = new Map<string, RentLiveUnit>();
  const residents = new Map<string, StoredResident>();

  return {
    upsertUnits: async (propertyId, upserted) => {
      for (const unit of upserted) {
        units.set(keyOf(propertyId, unit.remoteId), { ...unit });
      }
      return { ok: true };
    },

    upsertResidents: async (propertyId, upserted) => {
      for (const resident of upserted) {
        const key = keyOf(propertyId, resident.unitRemoteId, resident.remoteId);
        const before = residents.get(key);
        residents.set(key, {
          ...resident,
          propertyId,
          movedIn: before?.movedIn ?? false,
          everMovedOut: before?.everMovedOut ?? false,
        });
      }
      return { ok: true };
    },

    getResidentState: async (propertyId, unitRemoteId, residentRemoteId) => {
      const resident = residents.get(keyOf(propertyId, unitRemoteId, residentRemoteId));
      if (!resident) {
        return {
          ok: false,
          error: 'not_found',
        };
      }
      return {
        ok: true,
        state: {
          movedIn: resident.movedIn,
          everMovedOut: resident.everMovedOut,
        },
      };
    },

    listMovedIn: async (propertyId, unitRemoteId) => {
      const movedIn = [...residents.values()]
        .filter((resident) => resident.propertyId === propertyId && resident.unitRemoteId === unitRemoteId && resident.movedIn)
        .map((resident) => ({
          residentRemoteId: resident.remoteId,
          leaseRemoteId: resident.leaseRemoteId,
        }));
      return {
        ok: true,
        residents: movedIn,
      };
    },

    moveIn: async (propertyId, unitRemoteId, residentRemoteId) => {
      const resident = residents.get(keyOf(propertyId, unitRemoteId, residentRemoteId));
      if (!resident) {
        return {
          ok: false,
          error: 'not_found',
        };
      }
      if (resident.movedIn) {
        return {
          ok: false,
          error: 'already_moved_in',
        };
      }
      resident.movedIn = true;
      return { ok: true };
    },

    moveOut: async (propertyId, unitRemoteId, residentRemoteId) => {
      const resident = residents.get(keyOf(propertyId, unitRemoteId, residentRemoteId));
      if (!resident) {
        return {
          ok: false,
          error: 'not_found',
        };
      }
      if (!resident.movedIn) {
        return {
          ok: false,
          error: 'not_moved_in',
        };
      }
      resident.movedIn = false;
      resident.everMovedOut = true;
      return { ok: true };
    },
  };
};
