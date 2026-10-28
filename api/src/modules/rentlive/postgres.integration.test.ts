import { rentLiveContractSuite } from '~/modules/rentlive/contract.suite';
import { postgresRentLive } from '~/modules/rentlive/postgres';

rentLiveContractSuite('the Postgres mock', () => postgresRentLive);
