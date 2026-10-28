import { listUnits } from '~/modules/sync/read-units';

// Every unit, from what Lakeside last said, with its raw code next to its RentLive status.
const handler = defineEventHandler(async (event) => {
  const found = await listUnits(getRouterParam(event, 'propertyId') ?? '');
  if (!found) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No such property',
    });
  }
  return found;
});

export default handler;
