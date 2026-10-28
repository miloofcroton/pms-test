import { listRuns } from '~/modules/sync/read-runs';

// Every run, newest first, or one property's with `?propertyId=`.
const handler = defineEventHandler(async (event) => {
  const { propertyId } = getQuery(event);
  return { runs: await listRuns({ propertyId: typeof propertyId === 'string' ? propertyId : undefined }) };
});

export default handler;
