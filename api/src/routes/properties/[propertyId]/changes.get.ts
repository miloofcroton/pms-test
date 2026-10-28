import { listChanges } from '../../../modules/sync/read-changes';
import { getProperty } from '../../../modules/sync/read-snapshots';

// The property's whole change log, newest first, with its timezone so the UI can show each time locally.
const handler = defineEventHandler(async (event) => {
  const propertyId = getRouterParam(event, 'propertyId') ?? '';
  const property = await getProperty(propertyId);
  if (!property) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No such property',
    });
  }
  return {
    property,
    changes: await listChanges(propertyId),
  };
});

export default handler;
