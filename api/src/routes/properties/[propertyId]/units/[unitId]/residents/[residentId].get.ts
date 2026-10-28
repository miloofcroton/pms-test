import { postgresRentLive } from '~/modules/rentlive/postgres';
import { getResident } from '~/modules/sync/read-resident';

// One resident on one unit: who they are, whether they're moved in, why, their exceptions and their change log.
const handler = defineEventHandler(async (event) => {
  const found = await getResident(
    getRouterParam(event, 'propertyId') ?? '',
    getRouterParam(event, 'unitId') ?? '',
    getRouterParam(event, 'residentId') ?? '',
    postgresRentLive,
  );
  if (!found) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No such resident on this unit',
    });
  }
  return found;
});

export default handler;
