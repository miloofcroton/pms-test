import type { NormalizedSnapshot } from '../lakeside/normalize';

import { localToday } from './dates';
import { residentKey } from './rentlive-state';
import { residentsOf } from './residents';
import { decideUnit } from './rules';
import type { RentLiveState, ResidentState } from './rentlive-state';
import type { Decision } from './rules';

// The pure sync pipeline: a normalized Lakeside snapshot and what RentLive has stored go in, and what to do about each resident comes out.
// No I/O, so every rule can be tested without a database.

export type SyncPlan = {
  today: string;
  // Unit by unit, and within a unit move-outs first, then move-ins.
  decisions: Array<Decision>;
};

export const syncPlan = (snapshot: NormalizedSnapshot, state: RentLiveState): SyncPlan => {
  const today = localToday(snapshot.generatedAt, snapshot.property.timezone);
  const residents = residentsOf(snapshot, today);
  const stored = [...state.values()];

  // Units RentLive has residents on count too, so someone moved in on a unit the snapshot dropped is still found.
  const unitIds = new Set([...snapshot.units.map((unit) => unit.remoteId), ...stored.map((resident) => resident.unitRemoteId)]);
  const decisions = [...unitIds].flatMap((unitRemoteId) => decideUnit(
    residents.filter((resident) => resident.unitRemoteId === unitRemoteId),
    stored.filter((resident) => resident.unitRemoteId === unitRemoteId),
    today,
  ));

  return {
    today,
    decisions,
  };
};

/** What RentLive would store after the plan: every decided resident upserted, then moved in or out. */
export const applyPlan = (state: RentLiveState, plan: SyncPlan): RentLiveState => {
  const next = new Map(state);
  for (const decision of plan.decisions) {
    const key = residentKey(decision.unitRemoteId, decision.residentRemoteId);
    const before: ResidentState = next.get(key) ?? {
      unitRemoteId: decision.unitRemoteId,
      residentRemoteId: decision.residentRemoteId,
      movedIn: false,
      everMovedOut: false,
      leaseRemoteId: null,
    };
    next.set(key, {
      ...before,
      leaseRemoteId: decision.leaseRemoteId ?? before.leaseRemoteId,
      movedIn: decision.action === 'none' ? before.movedIn : decision.action === 'move_in',
      everMovedOut: before.everMovedOut || decision.action === 'move_out',
    });
  }
  return next;
};
