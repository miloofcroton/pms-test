import { getRun } from '../../modules/sync/read-runs';

// One run, with its exceptions grouped by kind.
const handler = defineEventHandler(async (event) => {
  const run = await getRun(Number(getRouterParam(event, 'id')));
  if (!run) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No such run',
    });
  }
  return run;
});

export default handler;
