import { postgresRentLive } from '../../../../../modules/rentlive/postgres';
import { getUnit } from '../../../../../modules/sync/read-unit';

// One unit: its leases and the people on each, who is moved in now, its exceptions and its change log.
const handler = defineEventHandler(async (event) => {
  const found = await getUnit(getRouterParam(event, 'propertyId') ?? '', getRouterParam(event, 'unitId') ?? '', postgresRentLive);
  if (!found) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No such unit',
    });
  }
  return found;
});

export default handler;
