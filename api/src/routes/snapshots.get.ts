import { listSnapshotFiles, snapshotDir } from '../modules/lakeside/snapshots';

// The snapshot files the UI can run, one button each.
const handler = defineEventHandler(async () => {
  return { snapshots: await listSnapshotFiles(snapshotDir()) };
});

export default handler;
