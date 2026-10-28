import { and, eq, sql } from 'drizzle-orm';

import { db } from '~/integrations/postgres';
import { rentliveResidents as residents, rentliveUnits as units } from '~/modules/rentlive/schema';
import type { MoveError, RentLive } from '~/modules/rentlive/contract';

// A RentLive mock in Postgres, for running the app.
// It lasts as long as the `sync` records do, so a restart never forgets who is moved in.
// Only this file touches the tables in `schema.ts`.

const residentIs = (propertyId: string, unitRemoteId: string, residentRemoteId: string) => {
  return and(eq(residents.propertyId, propertyId), eq(residents.unitRemoteId, unitRemoteId), eq(residents.remoteId, residentRemoteId));
};

// Why a move changed no row: the resident doesn't exist, or is already where the move would put them.
const whyNotMoved = async (
  propertyId: string,
  unitRemoteId: string,
  residentRemoteId: string,
  alreadyThere: MoveError,
): Promise<{
  ok: false;
  error: MoveError
}> => {
  const [resident] = await db.select({ remoteId: residents.remoteId })
    .from(residents)
    .where(residentIs(propertyId, unitRemoteId, residentRemoteId));
  return {
    ok: false,
    error: resident ? alreadyThere : 'not_found',
  };
};

export const postgresRentLive: RentLive = {
  upsertUnits: async (propertyId, upserted) => {
    if (upserted.length > 0) {
      await db.insert(units)
        .values(upserted.map((unit) => ({
          propertyId,
          ...unit,
        })))
        .onConflictDoUpdate({
          target: [units.propertyId, units.remoteId],
          set: {
            unitNumber: sql`excluded.unit_number`,
            buildingName: sql`excluded.building_name`,
            floorplanName: sql`excluded.floorplan_name`,
            status: sql`excluded.status`,
          },
        });
    }
    return { ok: true };
  },

  upsertResidents: async (propertyId, upserted) => {
    if (upserted.length > 0) {
      // `moved_in` and `ever_moved_out` are left out of the update, so an upsert never moves anyone.
      await db.insert(residents)
        .values(upserted.map((resident) => ({
          propertyId,
          ...resident,
        })))
        .onConflictDoUpdate({
          target: [residents.propertyId, residents.unitRemoteId, residents.remoteId],
          set: {
            leaseRemoteId: sql`excluded.lease_remote_id`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            email: sql`excluded.email`,
            phone: sql`excluded.phone`,
          },
        });
    }
    return { ok: true };
  },

  getResidentState: async (propertyId, unitRemoteId, residentRemoteId) => {
    const [resident] = await db.select({
      movedIn: residents.movedIn,
      everMovedOut: residents.everMovedOut,
    })
      .from(residents)
      .where(residentIs(propertyId, unitRemoteId, residentRemoteId));
    if (!resident) {
      return {
        ok: false,
        error: 'not_found',
      };
    }
    return {
      ok: true,
      state: resident,
    };
  },

  listMovedIn: async (propertyId, unitRemoteId) => {
    const movedIn = await db.select({
      residentRemoteId: residents.remoteId,
      leaseRemoteId: residents.leaseRemoteId,
    })
      .from(residents)
      .where(and(eq(residents.propertyId, propertyId), eq(residents.unitRemoteId, unitRemoteId), eq(residents.movedIn, true)));
    return {
      ok: true,
      residents: movedIn,
    };
  },

  // Each move is one conditional update, so two runs at once can't both move the same resident.
  moveIn: async (propertyId, unitRemoteId, residentRemoteId) => {
    const moved = await db.update(residents)
      .set({ movedIn: true })
      .where(and(residentIs(propertyId, unitRemoteId, residentRemoteId), eq(residents.movedIn, false)))
      .returning({ remoteId: residents.remoteId });
    return moved.length > 0 ? { ok: true } : whyNotMoved(propertyId, unitRemoteId, residentRemoteId, 'already_moved_in');
  },

  moveOut: async (propertyId, unitRemoteId, residentRemoteId) => {
    const moved = await db.update(residents)
      .set({
        movedIn: false,
        everMovedOut: true,
      })
      .where(and(residentIs(propertyId, unitRemoteId, residentRemoteId), eq(residents.movedIn, true)))
      .returning({ remoteId: residents.remoteId });
    return moved.length > 0 ? { ok: true } : whyNotMoved(propertyId, unitRemoteId, residentRemoteId, 'not_moved_in');
  },
};
