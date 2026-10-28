import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// The folder of snapshot files the UI can run, one button per file.

/** `SNAPSHOT_DIR`, or `data/` at the repo root when the api runs from `api/`. */
export const snapshotDir = (): string => {
  return process.env.SNAPSHOT_DIR ?? resolve(process.cwd(), '../data');
};

export const listSnapshotFiles = async (dir: string): Promise<Array<string>> => {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
};

/** The path of a snapshot by its file name, or null unless it is one of `listSnapshotFiles`, so a request can't name any other path. */
export const snapshotPathFor = async (dir: string, name: unknown): Promise<string | null> => {
  if (typeof name !== 'string' || !(await listSnapshotFiles(dir)).includes(name)) {
    return null;
  }
  return join(dir, name);
};
