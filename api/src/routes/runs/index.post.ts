import { fileClient } from '~/modules/lakeside/client';
import { listSnapshotFiles, snapshotDir, snapshotPathFor } from '~/modules/lakeside/snapshots';
import { postgresRentLive } from '~/modules/rentlive/postgres';
import { runSync } from '~/modules/sync/runner';
import { postgresStore } from '~/modules/sync/store-postgres';

// Starts a run of one snapshot file: `{ "snapshot": "day1.json" }`.
// Only a file in the snapshot folder can be named, never a path.
const handler = defineEventHandler(async (event) => {
  const body = await readBody<{ snapshot?: unknown } | null>(event);
  const dir = snapshotDir();
  const source = await snapshotPathFor(dir, body?.snapshot);
  if (!source) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unknown snapshot',
      data: { snapshots: await listSnapshotFiles(dir) },
    });
  }

  const report = await runSync(source, {
    lakeside: fileClient,
    rentLive: postgresRentLive,
    store: postgresStore,
  });
  setResponseStatus(event, 201);
  return report;
});

export default handler;
