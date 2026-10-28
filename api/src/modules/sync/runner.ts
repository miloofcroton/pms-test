import { leavesRecordOut, normalizeSnapshot, peekSnapshot, SnapshotError } from '../lakeside/normalize';
import type { LakesideClient } from '../lakeside/client';
import type { NormalizedSnapshot } from '../lakeside/normalize';
import type { RentLive } from '../rentlive/contract';

import { changesOf } from './change-log';
import { localToday } from './dates';
import { crashErrorOf, fetchErrorOf, staleErrorOf, structureErrorOf } from './errors';
import { exceptionsOf } from './exceptions';
import { residentKey } from './rentlive-state';
import { residentsOf } from './residents';
import { noCounts } from './schema';
import { syncPlan } from './sync-pipeline';
import { mapUnitStatus } from './unit-status';
import type { ChangeEntry } from './change-log';
import type { RunError } from './errors';
import type { RentLiveState, ResidentState } from './rentlive-state';
import type { Resident } from './residents';
import type { Decision } from './rules';
import type { RunCounts, RunStatus } from './schema';
import type { SyncStore } from './store';

// Runs one snapshot through the sync, start to finish.
// This is the one place with I/O: it fetches, reads and writes RentLive, and stores the run, around the pure pipeline.

export type RunnerDeps = {
  lakeside: LakesideClient;
  rentLive: RentLive;
  store: SyncStore;
};

export type RunReport = {
  runId: number;
  status: Exclude<RunStatus, 'running'>;
  error: RunError | null;
  counts: RunCounts;
  changes: Array<ChangeEntry>;
};

export const runSync = async (source: string, { lakeside, rentLive, store }: RunnerDeps): Promise<RunReport> => {
  const runId = await store.startRun(source);
  const finish = async (outcome: Omit<RunReport, 'runId' | 'changes'>, changes: Array<ChangeEntry> = []): Promise<RunReport> => {
    await store.finishRun(runId, outcome);
    return {
      runId,
      ...outcome,
      changes,
    };
  };
  const stop = (error: RunError) => finish({
    status: error.kind === 'stale' ? 'refused' : 'failed',
    error,
    counts: noCounts,
  });

  try {
    const fetched = await lakeside.fetchSnapshot(source);
    if (!fetched.ok) {
      return await stop(fetchErrorOf(fetched, source));
    }
    await store.saveSnapshot(runId, {
      source,
      ...peekSnapshot(fetched.snapshot),
      body: fetched.snapshot,
    });

    let snapshot: NormalizedSnapshot;
    try {
      snapshot = normalizeSnapshot(fetched.snapshot);
    }
    catch (thrown) {
      if (thrown instanceof SnapshotError) {
        return await stop(structureErrorOf(thrown));
      }
      throw thrown;
    }

    const propertyId = snapshot.property.remoteId;
    const last = await store.lastSuccessfulRun(propertyId);
    if (last && Date.parse(snapshot.generatedAt) < Date.parse(last.generatedAt)) {
      return await stop(staleErrorOf(snapshot.generatedAt, last.generatedAt));
    }
    // The last successful run's snapshot already normalized once, so it does again.
    const previous = last ? normalizeSnapshot(last.body) : null;

    const today = localToday(snapshot.generatedAt, snapshot.property.timezone);
    const residents = residentsOf(snapshot, today);
    const unitIds = new Set([...snapshot.units, ...(previous?.units ?? [])].map((unit) => unit.remoteId));
    const plan = syncPlan(snapshot, await readRentLiveState(rentLive, propertyId, unitIds, residents));

    // Upsert before any move, as the contract requires.
    const synced = residents.filter((resident) => resident.synced);
    await rentLive.upsertUnits(propertyId, snapshot.units.map((unit) => ({
      remoteId: unit.remoteId,
      unitNumber: unit.unitNumber,
      buildingName: unit.buildingName,
      floorplanName: unit.floorplanName,
      status: mapUnitStatus(unit.rawStatus),
    })));
    await rentLive.upsertResidents(propertyId, synced.map((resident) => ({
      unitRemoteId: resident.unitRemoteId,
      remoteId: resident.residentRemoteId,
      leaseRemoteId: resident.leaseRemoteId,
      firstName: resident.firstName,
      lastName: resident.lastName,
      email: resident.email,
      phone: resident.phone,
    })));

    // Every move-out before any move-in, across the property, so a unit is free before its new lease moves in.
    const moves: Array<Decision> = [];
    for (const action of ['move_out', 'move_in'] as const) {
      for (const decision of plan.decisions.filter((candidate) => candidate.action === action)) {
        const move = action === 'move_out' ? rentLive.moveOut : rentLive.moveIn;
        const result = await move(propertyId, decision.unitRemoteId, decision.residentRemoteId);
        if (!result.ok) {
          // The plan came from RentLive's state moments ago, so a refusal means something else changed it: stop rather than guess.
          throw new Error(`RentLive refused ${action} for ${decision.unitRemoteId}/${decision.residentRemoteId}: ${result.error}`);
        }
        moves.push(decision);
      }
    }

    const exceptions = exceptionsOf(snapshot, plan);
    const reviews = exceptions.filter((exception) => exception.kind === 'review');
    const changes = changesOf({
      previous,
      next: snapshot,
      moves,
      previousReviews: last ? await store.reviewExceptions(last.runId) : [],
      reviews,
    });
    await store.saveResults(runId, propertyId, {
      decisions: plan.decisions,
      exceptions,
      changes,
    });

    return await finish({
      status: 'ok',
      error: null,
      counts: {
        unitsUpserted: snapshot.units.length,
        residentsUpserted: synced.length,
        movedIn: moves.filter((move) => move.action === 'move_in').length,
        movedOut: moves.filter((move) => move.action === 'move_out').length,
        skipped: snapshot.exceptions.filter((exception) => leavesRecordOut(exception.reason)).length + residents.filter((resident) => !resident.synced).length,
        flagged: reviews.length,
      },
    }, changes);
  }
  catch (thrown) {
    return stop(crashErrorOf(thrown));
  }
};

// RentLive's state for everyone the plan needs: each resident in the snapshot, and everyone moved in on its units.
const readRentLiveState = async (
  rentLive: RentLive,
  propertyId: string,
  unitIds: ReadonlySet<string>,
  residents: Array<Resident>,
): Promise<RentLiveState> => {
  const leases = new Map<string, string>();
  for (const unitRemoteId of unitIds) {
    const { residents: movedIn } = await rentLive.listMovedIn(propertyId, unitRemoteId);
    for (const resident of movedIn) {
      leases.set(residentKey(unitRemoteId, resident.residentRemoteId), resident.leaseRemoteId);
    }
  }

  const keys = new Map<string, {
    unitRemoteId: string;
    residentRemoteId: string
  }>();
  for (const resident of residents) {
    keys.set(residentKey(resident.unitRemoteId, resident.residentRemoteId), resident);
  }
  for (const key of leases.keys()) {
    const [unitRemoteId, residentRemoteId] = key.split('/');
    keys.set(key, {
      unitRemoteId,
      residentRemoteId,
    });
  }

  const state = new Map<string, ResidentState>();
  for (const [key, { unitRemoteId, residentRemoteId }] of keys) {
    const stored = await rentLive.getResidentState(propertyId, unitRemoteId, residentRemoteId);
    if (stored.ok) {
      state.set(key, {
        unitRemoteId,
        residentRemoteId,
        ...stored.state,
        leaseRemoteId: leases.get(key) ?? null,
      });
    }
  }
  return state;
};
