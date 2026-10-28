import { rentLiveContractSuite } from './contract.suite';
import { createMemoryRentLive } from './memory';

rentLiveContractSuite('the in-memory mock', createMemoryRentLive);
