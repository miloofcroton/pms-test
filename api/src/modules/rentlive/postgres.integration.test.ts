import { rentLiveContractSuite } from './contract.suite';
import { postgresRentLive } from './postgres';

rentLiveContractSuite('the Postgres mock', () => postgresRentLive);
