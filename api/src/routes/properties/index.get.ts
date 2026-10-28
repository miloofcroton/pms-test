import { listProperties } from '../../modules/sync/read-units';

// Every property with a successful run.
const handler = defineEventHandler(async () => {
  return { properties: await listProperties() };
});

export default handler;
