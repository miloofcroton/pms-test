import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll } from 'vitest';

import { closeDB, db, runMigrations } from '../../integrations/postgres';

import { contractPropertyIds, rentLiveContractSuite } from './contract.suite';
import { postgresRentLive } from './postgres';
import { rentliveResidents, rentliveUnits } from './schema';

beforeAll(runMigrations);
afterAll(async () => {
  // The database is shared, so delete what the suite wrote.
  await db.delete(rentliveResidents)
    .where(inArray(rentliveResidents.propertyId, contractPropertyIds));
  await db.delete(rentliveUnits)
    .where(inArray(rentliveUnits.propertyId, contractPropertyIds));
  await closeDB();
});

rentLiveContractSuite('the Postgres mock', () => postgresRentLive);
