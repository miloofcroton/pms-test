import { afterAll, beforeAll } from 'vitest';

import { closeDB, runMigrations } from '../../integrations/postgres';

import { rentLiveContractSuite } from './contract.suite';
import { postgresRentLive } from './postgres';

beforeAll(runMigrations);
afterAll(closeDB);

rentLiveContractSuite('the Postgres mock', () => postgresRentLive);
