import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { normalizeSnapshot } from '../lakeside/normalize';
import type { NormalizedSnapshot } from '../lakeside/normalize';

import { emptyState, residentKey } from './rentlive-state';
import { applyPlan, syncPlan } from './sync-pipeline';
import type { RentLiveState } from './rentlive-state';
import type { Action } from './rules';
import type { SyncPlan } from './sync-pipeline';

// The acceptance test: the "expected outcomes per day" table in docs/mock-data-analysis.md, run against the real snapshots.
// Keys are `unit/resident`.

const snapshot = (day: number): NormalizedSnapshot => {
  return normalizeSnapshot(JSON.parse(readFileSync(new URL(`../../../../data/day${day}.json`, import.meta.url), 'utf8')));
};

const withAction = (plan: SyncPlan, action: Action): Array<string> => {
  return plan.decisions
    .filter((d) => d.action === action)
    .map((d) => residentKey(d.unitRemoteId, d.residentRemoteId))
    .sort();
};

const flagged = (plan: SyncPlan): Array<string> => {
  return plan.decisions
    .filter((d) => d.flagged)
    .map((d) => residentKey(d.unitRemoteId, d.residentRemoteId))
    .sort();
};

const exceptionLeases = (snapshot: NormalizedSnapshot): Array<string> => {
  return snapshot.exceptions
    .map((i) => i.leaseRemoteId)
    .sort();
};

const movedIn = (state: RentLiveState): Array<string> => {
  return [...state]
    .filter(([, resident]) => resident.movedIn)
    .map(([key]) => key)
    .sort();
};

describe('days 1 to 3, in order', () => {
  // snapshots[n] and plans[n] are day n + 1.
  // states[n] is RentLive after day n, so states[0] is empty.
  const snapshots: Array<NormalizedSnapshot> = [];
  const plans: Array<SyncPlan> = [];
  const states: Array<RentLiveState> = [emptyState()];

  beforeAll(() => {
    for (const day of [1, 2, 3]) {
      snapshots.push(snapshot(day));
      const plan = syncPlan(snapshots[day - 1], states[day - 1]);
      plans.push(plan);
      states.push(applyPlan(states[day - 1], plan));
    }
  });

  describe('day 1', () => {
    it('uses the property-local date', () => {
      expect(plans[0].today).toBe('2026-10-27');
    });

    // Liam is not here: his lease sends its customers as an object, not a list, so it is left out.
    it('moves in 7 residents', () => {
      expect(withAction(plans[0], 'move_in')).toEqual([
        '5001/3001', // Alice
        '5001/3002', // Bob
        '5005/3008', // Frank, Notice counts as Current
        '5006/3009', // Grace, moves out tomorrow
        '5007/3010', // Henry
        '5009/3013', // Jack
        '5011/3016', // Mia
      ]);
    });

    it('moves nobody out', () => {
      expect(withAction(plans[0], 'move_out')).toEqual([]);
    });

    it('flags Sam and Ivy', () => {
      expect(flagged(plans[0])).toEqual([
        '5007/3011', // Sam, unknown customer type `co-applicant`
        '5008/3012', // Ivy, Current with a past move-out date
      ]);
    });

    it('reports the leases for Liam, Paul and Quinn', () => {
      expect(exceptionLeases(snapshots[0])).toEqual([
        '9010', // Liam, customers is an object, not a list
        '9015', // Paul, unit 5099 isn't in the snapshot
        '9017', // Quinn, no unit
      ]);
    });

    it('says why Carol was not moved in', () => {
      const carol = plans[0].decisions.find((d) => d.residentRemoteId === '3004');
      expect(carol).toMatchObject({
        action: 'none',
        reason: 'move_in_date_outside_window',
      });
    });

    it('does not sync residents who moved out more than 14 days ago', () => {
      const synced = plans[0].decisions.map((d) => d.residentRemoteId);
      expect(synced).not.toContain('3024'); // Wendy
      expect(synced).not.toContain('3022'); // Rita
      expect(synced).not.toContain('3023'); // Victor
    });
  });

  describe('day 2', () => {
    it('uses the property-local date', () => {
      expect(plans[1].today).toBe('2026-10-28');
    });

    it('moves in 4 residents', () => {
      expect(withAction(plans[1], 'move_in')).toEqual([
        '5003/3006', // Dan
        '5004/3007', // Erin
        '5011/3021', // Nora, only after Mia moves out
        '5012/3016', // Mia, on her new unit
      ]);
    });

    it('moves out 3 residents', () => {
      expect(withAction(plans[1], 'move_out')).toEqual([
        '5006/3009', // Grace, move-out date is today
        '5007/3010', // Henry, Past on a Current lease
        '5011/3016', // Mia, leaving her old unit
      ]);
    });

    it('keeps Alice and Bob moved in on their re-signed lease', () => {
      expect(movedIn(states[2])).toEqual(expect.arrayContaining(['5001/3001', '5001/3002']));
      expect(states[2].get('5001/3001')?.leaseRemoteId).toBe('9101');
    });

    it('flags Jack instead of moving him out', () => {
      expect(flagged(plans[1])).toEqual([
        '5007/3011', // Sam
        '5009/3013', // Jack, Past with no move-out date
      ]);
    });

    it('still reports the leases for Paul and Quinn', () => {
      expect(exceptionLeases(snapshots[1])).toEqual(['9015', '9017']);
    });
  });

  describe('day 3, which has no leases', () => {
    it('moves nobody in or out', () => {
      expect(withAction(plans[2], 'move_in')).toEqual([]);
      expect(withAction(plans[2], 'move_out')).toEqual([]);
    });

    it('flags every moved-in resident as missing from the snapshot', () => {
      expect(flagged(plans[2])).toEqual(movedIn(states[2]));
    });

    it('leaves the 8 residents moved in after day 2', () => {
      expect(movedIn(states[3])).toEqual([
        '5001/3001', // Alice
        '5001/3002', // Bob
        '5003/3006', // Dan
        '5004/3007', // Erin
        '5005/3008', // Frank
        '5009/3013', // Jack
        '5011/3021', // Nora
        '5012/3016', // Mia
      ]);
    });
  });

  describe('running each day again', () => {
    for (const day of [1, 2, 3]) {
      it(`changes nothing on day ${day}`, () => {
        const rerun = syncPlan(snapshots[day - 1], states[day]);
        expect(withAction(rerun, 'move_in')).toEqual([]);
        expect(withAction(rerun, 'move_out')).toEqual([]);
        expect(flagged(rerun)).toEqual(flagged(plans[day - 1]));
        expect(applyPlan(states[day], rerun)).toEqual(states[day]);
      });
    }
  });
});
