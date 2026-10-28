import { rentLiveContractSuite } from '~/modules/rentlive/contract.suite';
import { createMemoryRentLive } from '~/modules/rentlive/memory';

rentLiveContractSuite('the in-memory mock', createMemoryRentLive);
