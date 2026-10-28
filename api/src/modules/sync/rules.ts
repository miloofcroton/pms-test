import type { Action, DecisionReason } from '@sync-app/shared';

import { addDays } from '~/modules/sync/dates';
import type { ResidentState } from '~/modules/sync/rentlive-state';
import type { Resident } from '~/modules/sync/residents';

// The brief's move-in and move-out rules.
// Each decision carries the rule that produced it, so staff can see why someone was or wasn't moved.

// Shared with the client, so defined once in `@sync-app/shared`.
export type { Action };
export type Reason = DecisionReason;

export type Outcome = {
  action: Action;
  reason: Reason;
  flagged: boolean;
};

/** One resident on their own, before the unit-level rules (move-outs first, one lease at a time) are applied. */
export const decideResident = (resident: Resident, state: ResidentState | undefined, today: string): Outcome => {
  return state?.movedIn ? decideMoveOut(resident, today) : decideMoveIn(resident, state, today);
};

const LEASE_SIGNERS = new Set(['Primary', 'Co-Applicant']);
const NON_SIGNERS = new Set(['Guarantor', 'Occupant']);

const decideMoveIn = (resident: Resident, state: ResidentState | undefined, today: string): Outcome => {
  if (!LEASE_SIGNERS.has(resident.type)) {
    return NON_SIGNERS.has(resident.type) ? none('not_a_lease_signer') : flag('unknown_customer_type');
  }
  if (resident.effectiveStatus !== 'Current') {
    return none('not_current');
  }
  if (state?.everMovedOut) {
    return none('previously_moved_out');
  }
  if (resident.moveInDate === null) {
    return flag('no_move_in_date');
  }
  if (resident.moveInDate > today) {
    return none('move_in_date_in_future');
  }
  // The last 14 days counting today start 13 days ago.
  if (resident.moveInDate < addDays(today, -13)) {
    return none('move_in_date_outside_window');
  }
  if (resident.moveOutDate !== null && resident.moveOutDate <= today) {
    return flag('move_out_date_not_in_future');
  }
  return {
    action: 'move_in',
    reason: 'moved_in',
    flagged: false,
  };
};

const decideMoveOut = (resident: Resident, today: string): Outcome => {
  if (resident.effectiveStatus === 'Current') {
    return resident.moveOutDate !== null && resident.moveOutDate <= today ? flag('move_out_date_not_in_future') : none('stays_current');
  }
  if (resident.moveOutDate === null) {
    return flag('no_move_out_date');
  }
  if (resident.moveOutDate > today) {
    return none('move_out_date_in_future');
  }
  return {
    action: 'move_out',
    reason: 'moved_out',
    flagged: false,
  };
};

const none = (reason: Reason): Outcome => {
  return {
    action: 'none',
    reason,
    flagged: false,
  };
};

const flag = (reason: Reason): Outcome => {
  return {
    action: 'none',
    reason,
    flagged: true,
  };
};

/** One per resident on the unit, plus one per moved-in resident the snapshot no longer has. */
export type Decision = Outcome & {
  unitRemoteId: string;
  residentRemoteId: string;
  leaseRemoteId: string | null;
};

/** Every resident on one unit, with the unit-level rules applied, move-outs first. */
export const decideUnit = (residents: Array<Resident>, stored: Array<ResidentState>, today: string): Array<Decision> => {
  const storedById = new Map(stored.map((state) => [state.residentRemoteId, state]));
  const inSnapshot = new Set(residents.map((resident) => resident.residentRemoteId));

  const decisions: Array<Decision> = [];
  for (const resident of residents) {
    const state = storedById.get(resident.residentRemoteId);
    if (resident.synced) {
      decisions.push(decision(resident, decideResident(resident, state, today)));
    }
    else if (state?.movedIn) {
      decisions.push(decision(resident, flag('past_beyond_sync_window')));
    }
  }
  for (const state of stored) {
    if (state.movedIn && !inSnapshot.has(state.residentRemoteId)) {
      decisions.push({
        unitRemoteId: state.unitRemoteId,
        residentRemoteId: state.residentRemoteId,
        leaseRemoteId: state.leaseRemoteId,
        ...flag('missing_from_snapshot'),
      });
    }
  }

  // Who is still moved in once the move-outs are done, and on which lease.
  // The lease comes from the snapshot when it has one, so a re-signed household doesn't block itself.
  const movingOut = new Set(decisions.filter((d) => d.action === 'move_out')
    .map((d) => d.residentRemoteId));
  const stayingLeases = new Set(stored
    .filter((state) => state.movedIn && !movingOut.has(state.residentRemoteId))
    .map((state) => decisions.find((d) => d.residentRemoteId === state.residentRemoteId)?.leaseRemoteId ?? state.leaseRemoteId));
  const movingInLeases = new Set(decisions.filter((d) => d.action === 'move_in')
    .map((d) => d.leaseRemoteId));

  return decisions
    .map((d) => {
      if (d.action !== 'move_in') {
        return d;
      }
      if ([...stayingLeases].some((lease) => lease !== d.leaseRemoteId)) {
        return {
          ...d,
          ...flag('other_lease_moved_in'),
        };
      }
      if (movingInLeases.size > 1) {
        return {
          ...d,
          ...flag('competing_leases'),
        };
      }
      return d;
    })
    .sort((a, b) => ACTION_ORDER[a.action] - ACTION_ORDER[b.action]);
};

const ACTION_ORDER: Record<Action, number> = {
  move_out: 0,
  move_in: 1,
  none: 2,
};

const decision = (resident: Resident, outcome: Outcome): Decision => {
  return {
    unitRemoteId: resident.unitRemoteId,
    residentRemoteId: resident.residentRemoteId,
    leaseRemoteId: resident.leaseRemoteId,
    ...outcome,
  };
};
