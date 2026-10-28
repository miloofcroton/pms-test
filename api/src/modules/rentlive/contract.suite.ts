import { beforeEach, describe, expect, it } from 'vitest';

import type { RentLive, RentLiveResident, RentLiveUnit } from './contract';

// The behavior every RentLive implementation must have, run by each implementation's own test file.
// Each test gets a fresh property id, so implementations that keep state between tests don't leak into each other.

// Every property id the suite used, so an implementation that keeps state can delete it afterwards.
export const contractPropertyIds: Array<string> = [];

const unit = (overrides: Partial<RentLiveUnit> = {}): RentLiveUnit => {
  return {
    remoteId: '5001',
    unitNumber: '101',
    buildingName: 'A',
    floorplanName: '1x1',
    status: 'Occupied',
    ...overrides,
  };
};

const resident = (overrides: Partial<RentLiveResident> = {}): RentLiveResident => {
  return {
    unitRemoteId: '5001',
    remoteId: '3001',
    leaseRemoteId: '9001',
    firstName: 'Alice',
    lastName: 'Nguyen',
    email: 'alice.nguyen@example.com',
    phone: '(555) 010-3001',
    ...overrides,
  };
};

export const rentLiveContractSuite = (name: string, rentLive: () => RentLive): void => {
  describe(`${name} implements the RentLive contract`, () => {
    let property: string;
    let api: RentLive;

    beforeEach(() => {
      property = `contract-${Date.now()}-${contractPropertyIds.length + 1}`;
      contractPropertyIds.push(property);
      api = rentLive();
    });

    describe('residents', () => {
      it('does not know a resident before they are upserted', async () => {
        expect(await api.getResidentState(property, '5001', '3001')).toEqual({
          ok: false,
          error: 'not_found',
        });
      });

      it('stores an upserted resident as not moved in and never moved out', async () => {
        await api.upsertUnits(property, [unit()]);
        expect(await api.upsertResidents(property, [resident()])).toEqual({ ok: true });
        expect(await api.getResidentState(property, '5001', '3001')).toEqual({
          ok: true,
          state: {
            movedIn: false,
            everMovedOut: false,
          },
        });
      });

      it('treats the same person on two units as two residents', async () => {
        await api.upsertUnits(property, [unit(), unit({ remoteId: '5002' })]);
        await api.upsertResidents(property, [resident(), resident({ unitRemoteId: '5002' })]);
        await api.moveIn(property, '5001', '3001');
        expect(await api.getResidentState(property, '5002', '3001')).toMatchObject({ state: { movedIn: false } });
      });

      it('keeps residents of different properties apart', async () => {
        await api.upsertUnits(property, [unit()]);
        await api.upsertResidents(property, [resident()]);
        expect(await api.getResidentState(`${property}-other`, '5001', '3001')).toMatchObject({ ok: false });
      });
    });

    describe('moving in and out', () => {
      beforeEach(async () => {
        await api.upsertUnits(property, [unit()]);
        await api.upsertResidents(property, [resident()]);
      });

      it('moves a resident in', async () => {
        expect(await api.moveIn(property, '5001', '3001')).toEqual({ ok: true });
        expect(await api.getResidentState(property, '5001', '3001')).toEqual({
          ok: true,
          state: {
            movedIn: true,
            everMovedOut: false,
          },
        });
      });

      it('moves a resident out, and remembers that they were moved out', async () => {
        await api.moveIn(property, '5001', '3001');
        expect(await api.moveOut(property, '5001', '3001')).toEqual({ ok: true });
        expect(await api.getResidentState(property, '5001', '3001')).toEqual({
          ok: true,
          state: {
            movedIn: false,
            everMovedOut: true,
          },
        });
      });

      it('refuses to move a resident who was never upserted', async () => {
        expect(await api.moveIn(property, '5001', '3999')).toEqual({
          ok: false,
          error: 'not_found',
        });
        expect(await api.moveOut(property, '5001', '3999')).toEqual({
          ok: false,
          error: 'not_found',
        });
      });

      it('refuses to move a resident in twice', async () => {
        await api.moveIn(property, '5001', '3001');
        expect(await api.moveIn(property, '5001', '3001')).toEqual({
          ok: false,
          error: 'already_moved_in',
        });
      });

      it('refuses to move out a resident who is not moved in', async () => {
        expect(await api.moveOut(property, '5001', '3001')).toEqual({
          ok: false,
          error: 'not_moved_in',
        });
      });

      it('keeps the moved-in state when the resident is upserted again', async () => {
        await api.moveIn(property, '5001', '3001');
        await api.upsertResidents(property, [resident({ email: 'alice@example.com' })]);
        expect(await api.getResidentState(property, '5001', '3001')).toMatchObject({ state: { movedIn: true } });
      });
    });

    describe('listMovedIn', () => {
      beforeEach(async () => {
        await api.upsertUnits(property, [unit(), unit({ remoteId: '5002' })]);
        await api.upsertResidents(property, [
          resident(),
          resident({ remoteId: '3002' }),
          resident({
            unitRemoteId: '5002',
            remoteId: '3003',
          }),
        ]);
      });

      it('lists nobody on a unit nobody is moved in on', async () => {
        expect(await api.listMovedIn(property, '5001')).toEqual({
          ok: true,
          residents: [],
        });
      });

      it('lists the residents moved in on one unit, with their stored lease', async () => {
        await api.moveIn(property, '5001', '3001');
        await api.moveIn(property, '5002', '3003');
        expect(await api.listMovedIn(property, '5001')).toEqual({
          ok: true,
          residents: [
            {
              residentRemoteId: '3001',
              leaseRemoteId: '9001',
            },
          ],
        });
      });

      it('reports the lease from the latest upsert', async () => {
        await api.moveIn(property, '5001', '3001');
        await api.upsertResidents(property, [resident({ leaseRemoteId: '9101' })]); // Alice re-signed on day 2
        expect(await api.listMovedIn(property, '5001')).toMatchObject({ residents: [{ leaseRemoteId: '9101' }] });
      });

      it('leaves out residents who were moved out', async () => {
        await api.moveIn(property, '5001', '3001');
        await api.moveOut(property, '5001', '3001');
        expect(await api.listMovedIn(property, '5001')).toMatchObject({ residents: [] });
      });
    });

    describe('units', () => {
      it('accepts units, and accepts them again', async () => {
        expect(await api.upsertUnits(property, [unit()])).toEqual({ ok: true });
        expect(await api.upsertUnits(property, [unit({ status: 'Vacant' })])).toEqual({ ok: true });
      });
    });
  });
};
